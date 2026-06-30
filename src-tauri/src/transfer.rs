use crate::models::{PlaylistCopyItem, PlaylistCopySummary};
use std::collections::HashSet;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub struct CopySource {
    pub track_id: i64,
    pub path: PathBuf,
    pub file_name: String,
}

pub fn copy_sources(
    sources: &[CopySource],
    destination: &Path,
    numeric_prefix: bool,
) -> Result<PlaylistCopySummary, String> {
    if !destination.is_dir() {
        return Err(format!(
            "La carpeta de destino no existe: {}",
            destination.display()
        ));
    }

    let width = sources.len().max(1).to_string().len().max(2);
    let mut reserved = HashSet::new();
    let mut items = Vec::with_capacity(sources.len());

    for (index, source) in sources.iter().enumerate() {
        if !source.path.is_file() {
            items.push(PlaylistCopyItem {
                track_id: source.track_id,
                source_path: source.path.to_string_lossy().into_owned(),
                destination_path: None,
                success: false,
                missing: true,
                error: Some("Archivo original no encontrado".to_owned()),
            });
            continue;
        }

        let safe_name = sanitize_file_name(&source.file_name);
        let requested_name = if numeric_prefix {
            format!("{:0width$} - {safe_name}", index + 1)
        } else {
            safe_name
        };
        let target = unique_destination(destination, &requested_name, &mut reserved);
        match std::fs::copy(&source.path, &target) {
            Ok(_) => items.push(PlaylistCopyItem {
                track_id: source.track_id,
                source_path: source.path.to_string_lossy().into_owned(),
                destination_path: Some(target.to_string_lossy().into_owned()),
                success: true,
                missing: false,
                error: None,
            }),
            Err(error) => items.push(PlaylistCopyItem {
                track_id: source.track_id,
                source_path: source.path.to_string_lossy().into_owned(),
                destination_path: Some(target.to_string_lossy().into_owned()),
                success: false,
                missing: false,
                error: Some(error.to_string()),
            }),
        }
    }

    Ok(PlaylistCopySummary {
        requested: sources.len(),
        copied: items.iter().filter(|item| item.success).count(),
        missing: items.iter().filter(|item| item.missing).count(),
        failed: items
            .iter()
            .filter(|item| !item.success && !item.missing)
            .count(),
        destination_path: destination.to_string_lossy().into_owned(),
        items,
    })
}

fn sanitize_file_name(name: &str) -> String {
    let mut sanitized = name
        .chars()
        .map(|character| {
            if matches!(
                character,
                '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'
            ) {
                '_'
            } else {
                character
            }
        })
        .collect::<String>();
    while sanitized.ends_with([' ', '.']) {
        sanitized.pop();
    }
    if sanitized.is_empty() {
        "audio".to_owned()
    } else {
        sanitized
    }
}

fn unique_destination(
    destination: &Path,
    requested_name: &str,
    reserved: &mut HashSet<String>,
) -> PathBuf {
    let requested = Path::new(requested_name);
    let stem = requested
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("audio");
    let extension = requested.extension().and_then(|value| value.to_str());
    let mut attempt = 1;

    loop {
        let name = if attempt == 1 {
            requested_name.to_owned()
        } else if let Some(extension) = extension {
            format!("{stem} ({attempt}).{extension}")
        } else {
            format!("{stem} ({attempt})")
        };
        let key = name.to_lowercase();
        let path = destination.join(&name);
        if !path.exists() && reserved.insert(key) {
            return path;
        }
        attempt += 1;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn copies_in_order_and_resolves_existing_names() {
        let source_dir = tempfile::tempdir().unwrap();
        let destination_dir = tempfile::tempdir().unwrap();
        let first = source_dir.path().join("tema.mp3");
        let second = source_dir.path().join("otro.mp3");
        std::fs::write(&first, b"first").unwrap();
        std::fs::write(&second, b"second").unwrap();
        std::fs::write(destination_dir.path().join("01 - tema.mp3"), b"old").unwrap();

        let summary = copy_sources(
            &[
                CopySource {
                    track_id: 1,
                    path: first,
                    file_name: "tema.mp3".to_owned(),
                },
                CopySource {
                    track_id: 2,
                    path: second,
                    file_name: "otro.mp3".to_owned(),
                },
            ],
            destination_dir.path(),
            true,
        )
        .unwrap();

        assert_eq!(summary.copied, 2);
        assert!(destination_dir.path().join("01 - tema (2).mp3").exists());
        assert!(destination_dir.path().join("02 - otro.mp3").exists());
    }

    #[test]
    fn reports_missing_sources_without_stopping_the_copy() {
        let destination_dir = tempfile::tempdir().unwrap();
        let summary = copy_sources(
            &[CopySource {
                track_id: 1,
                path: destination_dir.path().join("missing.mp3"),
                file_name: "missing.mp3".to_owned(),
            }],
            destination_dir.path(),
            true,
        )
        .unwrap();

        assert_eq!(summary.missing, 1);
        assert_eq!(summary.failed, 0);
    }
}
