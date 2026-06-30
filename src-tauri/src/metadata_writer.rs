use crate::error::{AppError, AppResult};
use crate::metadata::{is_supported_audio, read_metadata};
use crate::models::{AudioMetadata, MetadataFieldUpdate, MetadataPatch};
use chrono::Utc;
use lofty::config::{ParseOptions, WriteOptions};
use lofty::file::{AudioFile, TaggedFileExt};
use lofty::id3::v2::{Frame, Id3v2Tag, UnsynchronizedTextFrame};
use lofty::picture::{Picture, PictureType};
use lofty::probe::Probe;
use lofty::tag::items::UNKNOWN_LANGUAGE;
use lofty::tag::{ItemKey, Tag, TagType};
use lofty::TextEncoding;
use std::fs;
use std::path::{Path, PathBuf};

const MAX_COVER_ART_BYTES: u64 = 25 * 1024 * 1024;

pub struct MetadataWriteOutcome {
    pub metadata: AudioMetadata,
    pub backup_path: PathBuf,
}

pub fn validate_patch(patch: &MetadataPatch) -> AppResult<()> {
    if !patch.has_changes() {
        return Err(AppError::EmptyMetadataPatch);
    }

    validate_optional_integer("año", patch.year.as_ref(), 1, 9_999)?;
    validate_optional_integer("número de pista", patch.track_number.as_ref(), 1, 99_999)?;
    validate_optional_integer("total de pistas", patch.track_total.as_ref(), 1, 99_999)?;
    validate_optional_integer("número de disco", patch.disc_number.as_ref(), 1, 99_999)?;
    validate_optional_integer("total de discos", patch.disc_total.as_ref(), 1, 99_999)?;

    if let Some(value) = patch.bpm.as_ref().and_then(|update| update.value) {
        if !value.is_finite() || !(0.01..=1_000.0).contains(&value) {
            return Err(AppError::InvalidMetadata(
                "BPM debe estar entre 0.01 y 1000".to_owned(),
            ));
        }
    }

    if let Some(path) = patch
        .cover_art
        .as_ref()
        .and_then(|update| update.value.as_deref())
    {
        let metadata = fs::metadata(path)?;
        if !metadata.is_file() {
            return Err(AppError::InvalidMetadata(
                "la carátula seleccionada no es un archivo".to_owned(),
            ));
        }
        if metadata.len() > MAX_COVER_ART_BYTES {
            return Err(AppError::InvalidMetadata(
                "la carátula supera el límite de 25 MB".to_owned(),
            ));
        }
    }

    Ok(())
}

pub fn write_metadata_safely(
    path: &Path,
    track_id: i64,
    patch: &MetadataPatch,
    backup_root: &Path,
) -> AppResult<MetadataWriteOutcome> {
    validate_patch(patch)?;
    if !is_supported_audio(path) {
        return Err(AppError::UnsupportedAudio(path.to_path_buf()));
    }

    let original_file_metadata = fs::metadata(path)?;
    if original_file_metadata.permissions().readonly() {
        return Err(AppError::ReadOnlyFile(path.to_path_buf()));
    }

    let token = Utc::now().format("%Y%m%dT%H%M%S%3fZ").to_string();
    let working_path = sibling_path(path, "edit", track_id, &token)?;
    let rollback_path = sibling_path(path, "rollback", track_id, &token)?;

    fs::copy(path, &working_path)?;
    let edit_result = edit_working_copy(&working_path, patch);
    let verified_metadata = match edit_result {
        Ok(metadata) => metadata,
        Err(error) => {
            let _ = fs::remove_file(&working_path);
            return Err(error);
        }
    };

    let dated_backup_dir = backup_root.join(Utc::now().format("%Y-%m-%d").to_string());
    fs::create_dir_all(&dated_backup_dir)?;
    let backup_path = unique_backup_path(&dated_backup_dir, path, track_id, &token);
    if let Err(error) = fs::copy(path, &backup_path) {
        let _ = fs::remove_file(&working_path);
        return Err(error.into());
    }

    if let Err(error) = fs::rename(path, &rollback_path) {
        let _ = fs::remove_file(&working_path);
        return Err(error.into());
    }

    if let Err(error) = fs::rename(&working_path, path) {
        let restore_error = fs::rename(&rollback_path, path).err();
        let message = match restore_error {
            Some(restore_error) => {
                format!("{error}; además falló la restauración: {restore_error}")
            }
            None => error.to_string(),
        };
        return Err(AppError::MetadataWrite {
            path: path.to_path_buf(),
            message,
        });
    }

    let _ = fs::remove_file(&rollback_path);
    let final_metadata = read_metadata(path).map_err(|error| AppError::MetadataWrite {
        path: path.to_path_buf(),
        message: format!("el archivo se escribió pero no pudo releerse: {error}"),
    })?;
    verify_patch(&final_metadata, patch)?;

    debug_assert_eq!(
        final_metadata.audio_format, verified_metadata.audio_format,
        "la validación temporal y la final deberían leer el mismo formato"
    );

    Ok(MetadataWriteOutcome {
        metadata: final_metadata,
        backup_path,
    })
}

fn edit_working_copy(path: &Path, patch: &MetadataPatch) -> AppResult<AudioMetadata> {
    let mut tagged_file = Probe::open(path)
        .map_err(lofty_io_error)?
        .guess_file_type()
        .map_err(lofty_io_error)?
        .options(ParseOptions::new())
        .read()
        .map_err(lofty_io_error)?;
    let primary_tag_type = tagged_file.primary_tag_type();

    if tagged_file.primary_tag().is_none() {
        tagged_file.insert_tag(Tag::new(primary_tag_type));
    }

    let tag = tagged_file
        .primary_tag_mut()
        .ok_or_else(|| AppError::MetadataWrite {
            path: path.to_path_buf(),
            message: "el formato no admite una etiqueta principal editable".to_owned(),
        })?;
    apply_patch_to_tag(tag, patch)?;

    if primary_tag_type == TagType::Id3v2 && patch.unsynced_lyrics.is_some() {
        replace_id3_lyrics(&mut tagged_file, patch)?;
    }

    let mut write_options = WriteOptions::new();
    if primary_tag_type == TagType::Id3v2 {
        write_options = write_options.use_id3v23(true);
    }
    tagged_file
        .save_to_path(path, write_options)
        .map_err(|error| AppError::MetadataWrite {
            path: path.to_path_buf(),
            message: error.to_string(),
        })?;

    let metadata = read_metadata(path)?;
    verify_patch(&metadata, patch)?;
    Ok(metadata)
}

fn apply_patch_to_tag(tag: &mut Tag, patch: &MetadataPatch) -> AppResult<()> {
    apply_text(tag, ItemKey::TrackTitle, patch.title.as_ref(), "título")?;
    apply_text(tag, ItemKey::TrackArtist, patch.artist.as_ref(), "artista")?;
    apply_text(tag, ItemKey::AlbumTitle, patch.album.as_ref(), "álbum")?;
    apply_text(
        tag,
        ItemKey::AlbumArtist,
        patch.album_artist.as_ref(),
        "artista del álbum",
    )?;
    apply_text(tag, ItemKey::Genre, patch.genre.as_ref(), "género")?;
    apply_number(tag, ItemKey::RecordingDate, patch.year.as_ref(), "año")?;
    apply_number(
        tag,
        ItemKey::TrackNumber,
        patch.track_number.as_ref(),
        "número de pista",
    )?;
    apply_number(
        tag,
        ItemKey::TrackTotal,
        patch.track_total.as_ref(),
        "total de pistas",
    )?;
    apply_number(
        tag,
        ItemKey::DiscNumber,
        patch.disc_number.as_ref(),
        "número de disco",
    )?;
    apply_number(
        tag,
        ItemKey::DiscTotal,
        patch.disc_total.as_ref(),
        "total de discos",
    )?;
    apply_text(tag, ItemKey::Comment, patch.comment.as_ref(), "comentario")?;
    apply_text(
        tag,
        ItemKey::InitialKey,
        patch.musical_key.as_ref(),
        "tonalidad",
    )?;

    if let Some(update) = &patch.unsynced_lyrics {
        tag.remove_key(ItemKey::Lyrics);
        tag.remove_key(ItemKey::UnsyncLyrics);
        if let Some(value) = normalized_multiline(update.value.as_deref()) {
            insert_supported(tag, ItemKey::UnsyncLyrics, value, "letra no sincronizada")?;
        }
    }

    if let Some(update) = &patch.bpm {
        tag.remove_key(ItemKey::Bpm);
        tag.remove_key(ItemKey::IntegerBpm);
        if let Some(value) = update.value {
            let key = if value.fract().abs() < f64::EPSILON {
                ItemKey::IntegerBpm
            } else {
                ItemKey::Bpm
            };
            insert_supported(tag, key, format_decimal(value), "BPM")?;
        }
    }

    if let Some(update) = &patch.cover_art {
        replace_cover_art(tag, update)?;
    }

    Ok(())
}

fn replace_id3_lyrics(
    tagged_file: &mut impl TaggedFileExt,
    patch: &MetadataPatch,
) -> AppResult<()> {
    let generic_tag = tagged_file
        .remove(TagType::Id3v2)
        .unwrap_or_else(|| Tag::new(TagType::Id3v2));
    let mut id3_tag: Id3v2Tag = generic_tag.into();
    let mut language = UNKNOWN_LANGUAGE;
    let mut description = String::new();

    for frame in &id3_tag {
        if let Frame::UnsynchronizedText(lyrics) = frame {
            language = lyrics.language;
            description = lyrics.description.to_string();
            break;
        }
    }

    id3_tag.retain(|frame| match frame {
        Frame::UnsynchronizedText(_) => false,
        Frame::UserText(text) => !is_lyrics_alias(&text.description),
        Frame::Comment(comment) => !is_lyrics_alias(&comment.description),
        Frame::Binary(binary) => binary.id().as_str() != "SYLT",
        _ => true,
    });

    if let Some(value) = patch
        .unsynced_lyrics
        .as_ref()
        .and_then(|update| normalized_multiline(update.value.as_deref()))
    {
        id3_tag.insert(Frame::UnsynchronizedText(UnsynchronizedTextFrame::new(
            TextEncoding::UTF8,
            language,
            description,
            value,
        )));
    }

    tagged_file.insert_tag(id3_tag.into());
    Ok(())
}

fn replace_cover_art(tag: &mut Tag, update: &MetadataFieldUpdate<String>) -> AppResult<()> {
    while !tag.pictures().is_empty() {
        tag.remove_picture(0);
    }

    if let Some(path) = update
        .value
        .as_deref()
        .map(str::trim)
        .filter(|path| !path.is_empty())
    {
        let mut file = fs::File::open(path)?;
        let mut picture = Picture::from_reader(&mut file).map_err(lofty_io_error)?;
        picture.set_pic_type(PictureType::CoverFront);
        tag.push_picture(picture);
    }

    Ok(())
}

fn apply_text(
    tag: &mut Tag,
    key: ItemKey,
    update: Option<&MetadataFieldUpdate<String>>,
    field_name: &str,
) -> AppResult<()> {
    let Some(update) = update else {
        return Ok(());
    };
    tag.remove_key(key);
    if let Some(value) = normalized_text(update.value.as_deref()) {
        insert_supported(tag, key, value, field_name)?;
    }
    Ok(())
}

fn apply_number(
    tag: &mut Tag,
    key: ItemKey,
    update: Option<&MetadataFieldUpdate<i64>>,
    field_name: &str,
) -> AppResult<()> {
    let Some(update) = update else {
        return Ok(());
    };
    tag.remove_key(key);
    if let Some(value) = update.value {
        insert_supported(tag, key, value.to_string(), field_name)?;
    }
    Ok(())
}

fn insert_supported(tag: &mut Tag, key: ItemKey, value: String, field_name: &str) -> AppResult<()> {
    if tag.insert_text(key, value) {
        Ok(())
    } else {
        Err(AppError::InvalidMetadata(format!(
            "{field_name} no es compatible con {:?}",
            tag.tag_type()
        )))
    }
}

fn verify_patch(metadata: &AudioMetadata, patch: &MetadataPatch) -> AppResult<()> {
    verify_text("título", metadata.title.as_deref(), patch.title.as_ref())?;
    verify_text("artista", metadata.artist.as_deref(), patch.artist.as_ref())?;
    verify_text("álbum", metadata.album.as_deref(), patch.album.as_ref())?;
    verify_text(
        "artista del álbum",
        metadata.album_artist.as_deref(),
        patch.album_artist.as_ref(),
    )?;
    verify_text("género", metadata.genre.as_deref(), patch.genre.as_ref())?;
    verify_number("año", metadata.year, patch.year.as_ref())?;
    verify_number(
        "número de pista",
        metadata.track_number,
        patch.track_number.as_ref(),
    )?;
    verify_number(
        "total de pistas",
        metadata.track_total,
        patch.track_total.as_ref(),
    )?;
    verify_number(
        "número de disco",
        metadata.disc_number,
        patch.disc_number.as_ref(),
    )?;
    verify_number(
        "total de discos",
        metadata.disc_total,
        patch.disc_total.as_ref(),
    )?;
    verify_text(
        "comentario",
        metadata.comment.as_deref(),
        patch.comment.as_ref(),
    )?;
    verify_text(
        "letra no sincronizada",
        metadata.unsynced_lyrics.as_deref(),
        patch.unsynced_lyrics.as_ref(),
    )?;
    verify_text(
        "tonalidad",
        metadata.musical_key.as_deref(),
        patch.musical_key.as_ref(),
    )?;

    if let Some(update) = &patch.bpm {
        match (metadata.bpm, update.value) {
            (Some(actual), Some(expected)) if (actual - expected).abs() <= 0.001 => {}
            (None, None) => {}
            _ => return verification_error("BPM"),
        }
    }

    if let Some(update) = &patch.cover_art {
        if metadata.has_cover_art != update.value.is_some() {
            return verification_error("carátula");
        }
    }

    Ok(())
}

fn verify_text(
    field_name: &str,
    actual: Option<&str>,
    update: Option<&MetadataFieldUpdate<String>>,
) -> AppResult<()> {
    let Some(update) = update else {
        return Ok(());
    };
    let expected = if field_name == "letra no sincronizada" {
        normalized_multiline(update.value.as_deref())
    } else {
        normalized_text(update.value.as_deref())
    };
    let actual = if field_name == "letra no sincronizada" {
        normalized_multiline(actual)
    } else {
        normalized_text(actual)
    };
    if actual == expected {
        Ok(())
    } else {
        verification_error(field_name)
    }
}

fn verify_number(
    field_name: &str,
    actual: Option<i64>,
    update: Option<&MetadataFieldUpdate<i64>>,
) -> AppResult<()> {
    match update {
        Some(update) if actual != update.value => verification_error(field_name),
        _ => Ok(()),
    }
}

fn verification_error<T>(field_name: &str) -> AppResult<T> {
    Err(AppError::InvalidMetadata(format!(
        "la verificación posterior falló para {field_name}"
    )))
}

fn validate_optional_integer(
    field_name: &str,
    update: Option<&MetadataFieldUpdate<i64>>,
    minimum: i64,
    maximum: i64,
) -> AppResult<()> {
    if let Some(value) = update.and_then(|update| update.value) {
        if !(minimum..=maximum).contains(&value) {
            return Err(AppError::InvalidMetadata(format!(
                "{field_name} debe estar entre {minimum} y {maximum}"
            )));
        }
    }
    Ok(())
}

fn normalized_text(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
}

fn normalized_multiline(value: Option<&str>) -> Option<String> {
    value
        .map(|value| value.trim_matches('\0').trim())
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
}

fn format_decimal(value: f64) -> String {
    let mut value = value.to_string();
    if value.contains('.') {
        while value.ends_with('0') {
            value.pop();
        }
        if value.ends_with('.') {
            value.pop();
        }
    }
    value
}

fn is_lyrics_alias(description: &str) -> bool {
    let normalized: String = description
        .chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect();
    matches!(
        normalized.as_str(),
        "lyric"
            | "lyrics"
            | "unsyncedlyrics"
            | "unsynchronizedlyrics"
            | "unsyncedtext"
            | "unsynchronizedtext"
    )
}

fn sibling_path(path: &Path, purpose: &str, track_id: i64, token: &str) -> AppResult<PathBuf> {
    let parent = path
        .parent()
        .ok_or_else(|| AppError::InvalidMetadata("el archivo no tiene carpeta padre".to_owned()))?;
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("audio");
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("bin");

    for suffix in 0..1_000 {
        let candidate = parent.join(format!(
            ".{stem}.tagdeck-{purpose}-{track_id}-{token}-{suffix}.{extension}"
        ));
        if !candidate.exists() {
            return Ok(candidate);
        }
    }

    Err(AppError::InvalidMetadata(
        "no se pudo crear un nombre temporal único".to_owned(),
    ))
}

fn unique_backup_path(root: &Path, path: &Path, track_id: i64, token: &str) -> PathBuf {
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("audio");
    let safe_name: String = file_name
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '.' | '-' | '_') {
                character
            } else {
                '_'
            }
        })
        .collect();
    root.join(format!("{track_id}-{token}-{safe_name}.bak"))
}

fn lofty_io_error(error: impl std::fmt::Display) -> AppError {
    AppError::Io(std::io::Error::other(error.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn write_minimal_wav(path: &Path) {
        let sample_rate = 8_000_u32;
        let sample_count = 800_u32;
        let data_size = sample_count * 2;
        let mut file = fs::File::create(path).unwrap();

        file.write_all(b"RIFF").unwrap();
        file.write_all(&(36 + data_size).to_le_bytes()).unwrap();
        file.write_all(b"WAVEfmt ").unwrap();
        file.write_all(&16_u32.to_le_bytes()).unwrap();
        file.write_all(&1_u16.to_le_bytes()).unwrap();
        file.write_all(&1_u16.to_le_bytes()).unwrap();
        file.write_all(&sample_rate.to_le_bytes()).unwrap();
        file.write_all(&(sample_rate * 2).to_le_bytes()).unwrap();
        file.write_all(&2_u16.to_le_bytes()).unwrap();
        file.write_all(&16_u16.to_le_bytes()).unwrap();
        file.write_all(b"data").unwrap();
        file.write_all(&data_size.to_le_bytes()).unwrap();
        file.write_all(&vec![0_u8; data_size as usize]).unwrap();
    }

    #[test]
    fn rejects_empty_and_invalid_patches() {
        assert!(matches!(
            validate_patch(&MetadataPatch::default()),
            Err(AppError::EmptyMetadataPatch)
        ));

        let patch = MetadataPatch {
            year: Some(MetadataFieldUpdate { value: Some(0) }),
            ..MetadataPatch::default()
        };
        assert!(matches!(
            validate_patch(&patch),
            Err(AppError::InvalidMetadata(_))
        ));
    }

    #[test]
    fn writes_and_clears_wav_metadata_with_backup() {
        let directory = tempfile::tempdir().unwrap();
        let backup_dir = directory.path().join("backups");
        let path = directory.path().join("fixture.wav");
        write_minimal_wav(&path);

        let patch = MetadataPatch {
            title: Some(MetadataFieldUpdate {
                value: Some("Título de prueba".to_owned()),
            }),
            artist: Some(MetadataFieldUpdate {
                value: Some("Artista".to_owned()),
            }),
            genre: Some(MetadataFieldUpdate {
                value: Some("Psytrance; Electronic; Cinematic".to_owned()),
            }),
            year: Some(MetadataFieldUpdate { value: Some(2026) }),
            track_number: Some(MetadataFieldUpdate { value: Some(3) }),
            comment: Some(MetadataFieldUpdate {
                value: Some("Comentario".to_owned()),
            }),
            unsynced_lyrics: Some(MetadataFieldUpdate {
                value: Some("Primera línea\nSegunda línea".to_owned()),
            }),
            bpm: Some(MetadataFieldUpdate { value: Some(128.0) }),
            musical_key: Some(MetadataFieldUpdate {
                value: Some("Am".to_owned()),
            }),
            ..MetadataPatch::default()
        };

        let outcome = write_metadata_safely(&path, 7, &patch, &backup_dir).unwrap();
        assert!(outcome.backup_path.exists());
        assert_eq!(outcome.metadata.title.as_deref(), Some("Título de prueba"));
        assert_eq!(outcome.metadata.artist.as_deref(), Some("Artista"));
        assert_eq!(
            outcome.metadata.genre.as_deref(),
            Some("Psytrance; Electronic; Cinematic")
        );
        assert_eq!(outcome.metadata.year, Some(2026));
        assert_eq!(outcome.metadata.track_number, Some(3));
        assert_eq!(
            outcome.metadata.unsynced_lyrics.as_deref(),
            Some("Primera línea\nSegunda línea")
        );
        assert_eq!(outcome.metadata.bpm, Some(128.0));
        assert_eq!(outcome.metadata.musical_key.as_deref(), Some("Am"));

        let clear_patch = MetadataPatch {
            title: Some(MetadataFieldUpdate { value: None }),
            unsynced_lyrics: Some(MetadataFieldUpdate { value: None }),
            ..MetadataPatch::default()
        };
        let cleared = write_metadata_safely(&path, 7, &clear_patch, &backup_dir).unwrap();
        assert_eq!(cleared.metadata.title, None);
        assert_eq!(cleared.metadata.unsynced_lyrics, None);
    }
}
