use serde_json::{Map, Value};
use std::collections::HashMap;
use std::path::Path;

#[derive(Debug, Clone, Default)]
pub struct ImportRecord {
    pub source_index: usize,
    pub stable_id: Option<String>,
    pub path: Option<String>,
    pub relative_path: Option<String>,
    pub file_name: Option<String>,
    pub file_hash: Option<String>,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub duration_ms: Option<i64>,
    pub rating: Option<i64>,
    pub status: Option<String>,
    pub project: Option<String>,
    pub version: Option<String>,
    pub tags: Vec<String>,
    pub mood: Option<String>,
    pub strong_part: Option<String>,
    pub main_problem: Option<String>,
    pub intended_use: Option<String>,
    pub model: Option<String>,
    pub next_action: Option<String>,
    pub notes: Option<String>,
    pub genre: Option<String>,
    pub playlist_name: Option<String>,
    pub playlist_type: Option<String>,
    pub position: Option<i64>,
}

impl ImportRecord {
    pub fn source_name(&self) -> String {
        self.title
            .clone()
            .or_else(|| self.file_name.clone())
            .or_else(|| self.path.clone())
            .unwrap_or_else(|| format!("Fila {}", self.source_index))
    }
}

pub fn parse_import_file(path: &Path) -> Result<Vec<ImportRecord>, String> {
    let content = std::fs::read_to_string(path).map_err(|error| error.to_string())?;
    match path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "json" => parse_json(&content),
        "csv" => parse_csv(&content),
        _ => Err("Solo se pueden importar archivos CSV o JSON".to_owned()),
    }
}

fn parse_json(content: &str) -> Result<Vec<ImportRecord>, String> {
    let value: Value = serde_json::from_str(content).map_err(|error| error.to_string())?;
    let rows = match value {
        Value::Array(rows) => rows,
        Value::Object(mut object) => object
            .remove("tracks")
            .or_else(|| object.remove("songs"))
            .and_then(|value| value.as_array().cloned())
            .ok_or_else(|| "El JSON no contiene una lista de canciones".to_owned())?,
        _ => return Err("El JSON no contiene una lista de canciones".to_owned()),
    };
    rows.into_iter()
        .enumerate()
        .filter_map(|(index, row)| row.as_object().cloned().map(|row| (index, row)))
        .map(|(index, row)| record_from_json(index + 1, &row))
        .collect()
}

fn record_from_json(index: usize, row: &Map<String, Value>) -> Result<ImportRecord, String> {
    let values = row
        .iter()
        .map(|(key, value)| (normalize_header(key), json_text(value)))
        .collect::<HashMap<_, _>>();
    Ok(record_from_values(index, &values))
}

fn parse_csv(content: &str) -> Result<Vec<ImportRecord>, String> {
    let delimiter = detect_delimiter(content);
    let rows = parse_delimited_rows(content, delimiter)?;
    let Some(headers) = rows.first() else {
        return Ok(Vec::new());
    };
    let headers = headers
        .iter()
        .map(|header| normalize_header(header))
        .collect::<Vec<_>>();

    Ok(rows
        .into_iter()
        .skip(1)
        .enumerate()
        .filter(|(_, row)| row.iter().any(|value| !value.trim().is_empty()))
        .map(|(index, row)| {
            let values = headers.iter().cloned().zip(row).collect::<HashMap<_, _>>();
            record_from_values(index + 2, &values)
        })
        .collect())
}

fn record_from_values(index: usize, values: &HashMap<String, String>) -> ImportRecord {
    let path = text(values, &["file_path", "path", "ruta"]);
    let file_name = text(values, &["file_name", "filename", "archivo"]).or_else(|| {
        path.as_deref()
            .and_then(|path| Path::new(path).file_name())
            .and_then(|value| value.to_str())
            .map(str::to_owned)
    });
    ImportRecord {
        source_index: index,
        stable_id: text(values, &["stable_id", "track_stable_id", "stableid"]),
        path,
        relative_path: text(values, &["relative_path", "relativepath", "ruta_relativa"]),
        file_name,
        file_hash: text(values, &["file_hash", "hash"]),
        title: text(values, &["title", "titulo"]),
        artist: text(values, &["artist", "artista"]),
        duration_ms: number(values, &["duration_ms", "duration"]),
        rating: number(values, &["rating", "puntuacion"]).filter(|value| (1..=10).contains(value)),
        status: text(values, &["status", "estado"]),
        project: text(values, &["project", "project_name", "proyecto"]),
        version: text(values, &["version", "version_label", "version_etiqueta"]),
        tags: split_values(text(values, &["tags", "tag_names", "etiquetas"])),
        mood: text(values, &["mood"]),
        strong_part: text(values, &["strong_part", "parte_fuerte"]),
        main_problem: text(values, &["main_problem", "problema_principal"]),
        intended_use: text(values, &["intended_use", "uso_previsto"]),
        model: text(values, &["model", "modelo", "generation_model"]),
        next_action: text(values, &["next_action", "siguiente_accion"]),
        notes: text(values, &["notes", "workflow_notes", "notas"]),
        genre: text(values, &["genre", "genero"]),
        playlist_name: text(values, &["playlist_name", "lista"]),
        playlist_type: text(values, &["playlist_type", "tipo_lista"]),
        position: number(values, &["position", "posicion"]),
    }
}

fn text(values: &HashMap<String, String>, keys: &[&str]) -> Option<String> {
    keys.iter()
        .find_map(|key| values.get(*key))
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
}

fn number(values: &HashMap<String, String>, keys: &[&str]) -> Option<i64> {
    text(values, keys).and_then(|value| value.parse().ok())
}

fn split_values(value: Option<String>) -> Vec<String> {
    value
        .unwrap_or_default()
        .split([',', ';', '|'])
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
        .collect()
}

fn json_text(value: &Value) -> String {
    match value {
        Value::Null => String::new(),
        Value::String(value) => value.clone(),
        Value::Array(values) => values.iter().map(json_text).collect::<Vec<_>>().join(", "),
        Value::Bool(value) => value.to_string(),
        Value::Number(value) => value.to_string(),
        Value::Object(_) => value.to_string(),
    }
}

fn normalize_header(value: &str) -> String {
    value
        .trim()
        .trim_start_matches('\u{feff}')
        .to_lowercase()
        .replace([' ', '-'], "_")
        .replace('á', "a")
        .replace('é', "e")
        .replace('í', "i")
        .replace('ó', "o")
        .replace('ú', "u")
}

fn detect_delimiter(content: &str) -> char {
    let header = content.lines().next().unwrap_or_default();
    if header.matches(';').count() > header.matches(',').count() {
        ';'
    } else {
        ','
    }
}

fn parse_delimited_rows(content: &str, delimiter: char) -> Result<Vec<Vec<String>>, String> {
    let mut rows = Vec::new();
    let mut row = Vec::new();
    let mut field = String::new();
    let mut quoted = false;
    let mut characters = content.chars().peekable();

    while let Some(character) = characters.next() {
        if quoted {
            if character == '"' {
                if characters.peek() == Some(&'"') {
                    characters.next();
                    field.push('"');
                } else {
                    quoted = false;
                }
            } else {
                field.push(character);
            }
        } else {
            match character {
                '"' if field.is_empty() => quoted = true,
                value if value == delimiter => {
                    row.push(std::mem::take(&mut field));
                }
                '\n' => {
                    row.push(std::mem::take(&mut field));
                    rows.push(std::mem::take(&mut row));
                }
                '\r' => {}
                value => field.push(value),
            }
        }
    }
    if quoted {
        return Err("El CSV contiene un campo entrecomillado sin cerrar".to_owned());
    }
    if !field.is_empty() || !row.is_empty() {
        row.push(field);
        rows.push(row);
    }
    Ok(rows)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_tagdeck_csv_with_multiline_notes() {
        let csv = "title,artist,path,rating,tags,notes\n\"Tema\",\"Artista\",\"C:\\\\Music\\\\tema.mp3\",\"8\",\"Uno, Dos\",\"Línea 1\nLínea 2\"\n";
        let records = parse_csv(csv).unwrap();
        assert_eq!(records.len(), 1);
        assert_eq!(records[0].rating, Some(8));
        assert_eq!(records[0].tags, vec!["Uno", "Dos"]);
        assert_eq!(records[0].notes.as_deref(), Some("Línea 1\nLínea 2"));
    }

    #[test]
    fn parses_stable_and_relative_path_fields() {
        let csv = "stable_id,relative_path,title\n\"stable-1\",\"Suno/tema.mp3\",\"Tema\"\n";
        let records = parse_csv(csv).unwrap();
        assert_eq!(records[0].stable_id.as_deref(), Some("stable-1"));
        assert_eq!(records[0].relative_path.as_deref(), Some("Suno/tema.mp3"));
    }

    #[test]
    fn parses_playlist_json_fields() {
        let json = r#"[{"playlist_name":"Radio","position":2,"title":"Tema","artist":"A","mood":"Cósmico"}]"#;
        let records = parse_json(json).unwrap();
        assert_eq!(records[0].playlist_name.as_deref(), Some("Radio"));
        assert_eq!(records[0].position, Some(2));
        assert_eq!(records[0].mood.as_deref(), Some("Cósmico"));
    }
}
