use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::collections::HashMap;
use std::process::Command;
use std::time::Duration;
use url::Url;

pub const UPDATE_MANIFEST_URL: &str = "https://soundbender.live/tagdeck/latest.json";
const APP_NAME: &str = "Soundbender TagDeck";
const SUPPORTED_MANIFEST_VERSION: i64 = 1;
const TRUSTED_HOST: &str = "soundbender.live";

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all(deserialize = "snake_case", serialize = "camelCase"))]
pub struct UpdateManifest {
    pub app: String,
    pub manifest_version: i64,
    pub channel: String,
    pub latest_version: String,
    pub released_at: String,
    pub minimum_supported_version: Option<String>,
    pub download_url: String,
    pub release_notes_url: String,
    pub mandatory: bool,
    pub sha256: Option<String>,
    pub size: Option<i64>,
    pub notes: HashMap<String, Vec<String>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckResult {
    pub manifest_url: String,
    pub current_version: String,
    pub latest_version: String,
    pub update_available: bool,
    pub checked_at: String,
    pub manifest: UpdateManifest,
}

pub async fn check_for_updates(current_version: &str) -> Result<UpdateCheckResult, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(12))
        .user_agent(format!("Soundbender TagDeck/{current_version}"))
        .build()
        .map_err(|error| error.to_string())?;
    let text = client
        .get(UPDATE_MANIFEST_URL)
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?
        .text()
        .await
        .map_err(|error| error.to_string())?;
    check_manifest_text(current_version, &text)
}

pub fn check_manifest_text(current_version: &str, text: &str) -> Result<UpdateCheckResult, String> {
    let manifest: UpdateManifest = serde_json::from_str(text).map_err(|error| error.to_string())?;
    validate_manifest(&manifest)?;
    let update_available = compare_versions(&manifest.latest_version, current_version)
        .map(|ordering| ordering == Ordering::Greater)?;
    Ok(UpdateCheckResult {
        manifest_url: UPDATE_MANIFEST_URL.to_owned(),
        current_version: current_version.to_owned(),
        latest_version: manifest.latest_version.clone(),
        update_available,
        checked_at: Utc::now().to_rfc3339(),
        manifest,
    })
}

pub fn validate_manifest(manifest: &UpdateManifest) -> Result<(), String> {
    if manifest.app != APP_NAME {
        return Err("Update manifest is not for Soundbender TagDeck".to_owned());
    }
    if manifest.manifest_version != SUPPORTED_MANIFEST_VERSION {
        return Err("Unsupported update manifest version".to_owned());
    }
    parse_version(&manifest.latest_version)?;
    if let Some(minimum) = &manifest.minimum_supported_version {
        parse_version(minimum)?;
    }
    validate_trusted_https_url(&manifest.download_url)?;
    validate_trusted_https_url(&manifest.release_notes_url)?;
    if manifest.channel.trim().is_empty() || manifest.released_at.trim().is_empty() {
        return Err("Update manifest is missing required fields".to_owned());
    }
    if manifest.notes.is_empty() {
        return Err("Update manifest does not include release notes".to_owned());
    }
    Ok(())
}

pub fn open_external_update_url(url: &str) -> Result<(), String> {
    validate_trusted_https_url(url)?;
    #[cfg(target_os = "windows")]
    let result = Command::new("cmd").args(["/C", "start", "", url]).spawn();
    #[cfg(target_os = "macos")]
    let result = Command::new("open").arg(url).spawn();
    #[cfg(all(unix, not(target_os = "macos")))]
    let result = Command::new("xdg-open").arg(url).spawn();
    result.map(|_| ()).map_err(|error| error.to_string())
}

pub fn validate_trusted_https_url(value: &str) -> Result<(), String> {
    let parsed = Url::parse(value).map_err(|_| "Update URL is not valid".to_owned())?;
    if parsed.scheme() != "https" {
        return Err("Update URL must use HTTPS".to_owned());
    }
    if parsed.host_str() != Some(TRUSTED_HOST) {
        return Err("Update URL must use soundbender.live".to_owned());
    }
    Ok(())
}

pub fn compare_versions(left: &str, right: &str) -> Result<Ordering, String> {
    Ok(parse_version(left)?.cmp(&parse_version(right)?))
}

#[derive(Debug, Clone, Eq, PartialEq)]
struct ParsedVersion {
    major: u64,
    minor: u64,
    patch: u64,
    prerelease: Vec<PrereleaseIdentifier>,
}

#[derive(Debug, Clone, Eq, PartialEq)]
enum PrereleaseIdentifier {
    Numeric(u64),
    Text(String),
}

impl Ord for ParsedVersion {
    fn cmp(&self, other: &Self) -> Ordering {
        (self.major, self.minor, self.patch)
            .cmp(&(other.major, other.minor, other.patch))
            .then_with(|| compare_prerelease(&self.prerelease, &other.prerelease))
    }
}

impl PartialOrd for ParsedVersion {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

fn parse_version(value: &str) -> Result<ParsedVersion, String> {
    let without_build = value
        .split_once('+')
        .map_or(value, |(version, _build)| version);
    let (core, prerelease) = without_build
        .split_once('-')
        .map_or((without_build, ""), |(core, prerelease)| (core, prerelease));
    let parts: Vec<&str> = core.split('.').collect();
    if parts.len() != 3 {
        return Err(format!("Invalid semantic version: {value}"));
    }
    let parse_number = |part: &str| {
        if part.is_empty() || (part.len() > 1 && part.starts_with('0')) {
            return Err(format!("Invalid semantic version: {value}"));
        }
        part.parse::<u64>()
            .map_err(|_| format!("Invalid semantic version: {value}"))
    };
    let prerelease = if prerelease.is_empty() {
        Vec::new()
    } else {
        prerelease
            .split('.')
            .map(|part| {
                if part.is_empty() {
                    return Err(format!("Invalid semantic version: {value}"));
                }
                if part.chars().all(|character| character.is_ascii_digit()) {
                    Ok(PrereleaseIdentifier::Numeric(part.parse::<u64>().map_err(
                        |_| format!("Invalid semantic version: {value}"),
                    )?))
                } else if part
                    .chars()
                    .all(|character| character.is_ascii_alphanumeric() || character == '-')
                {
                    Ok(PrereleaseIdentifier::Text(part.to_owned()))
                } else {
                    Err(format!("Invalid semantic version: {value}"))
                }
            })
            .collect::<Result<Vec<_>, _>>()?
    };
    Ok(ParsedVersion {
        major: parse_number(parts[0])?,
        minor: parse_number(parts[1])?,
        patch: parse_number(parts[2])?,
        prerelease,
    })
}

fn compare_prerelease(left: &[PrereleaseIdentifier], right: &[PrereleaseIdentifier]) -> Ordering {
    match (left.is_empty(), right.is_empty()) {
        (true, true) => return Ordering::Equal,
        (true, false) => return Ordering::Greater,
        (false, true) => return Ordering::Less,
        (false, false) => {}
    }

    for (left_part, right_part) in left.iter().zip(right.iter()) {
        let ordering = match (left_part, right_part) {
            (PrereleaseIdentifier::Numeric(left), PrereleaseIdentifier::Numeric(right)) => {
                left.cmp(right)
            }
            (PrereleaseIdentifier::Numeric(_), PrereleaseIdentifier::Text(_)) => Ordering::Less,
            (PrereleaseIdentifier::Text(_), PrereleaseIdentifier::Numeric(_)) => Ordering::Greater,
            (PrereleaseIdentifier::Text(left), PrereleaseIdentifier::Text(right)) => {
                left.cmp(right)
            }
        };
        if ordering != Ordering::Equal {
            return ordering;
        }
    }
    left.len().cmp(&right.len())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_manifest(version: &str) -> String {
        format!(
            r#"{{
  "app": "Soundbender TagDeck",
  "manifest_version": 1,
  "channel": "beta",
  "latest_version": "{version}",
  "released_at": "2026-06-26T12:00:00Z",
  "minimum_supported_version": "0.1.0-beta.1",
  "download_url": "https://soundbender.live/tagdeck/download",
  "release_notes_url": "https://soundbender.live/tagdeck/releases/{version}",
  "mandatory": false,
  "sha256": null,
  "size": null,
  "notes": {{
    "en": ["Manual update checks."],
    "es": ["Comprobacion manual de actualizaciones."]
  }}
}}"#
        )
    }

    #[test]
    fn compares_beta_versions_correctly() {
        assert_eq!(
            compare_versions("0.1.0-beta.2", "0.1.0-beta.1").unwrap(),
            Ordering::Greater
        );
        assert_eq!(
            compare_versions("0.1.0", "0.1.0-beta.9").unwrap(),
            Ordering::Greater
        );
        assert_eq!(
            compare_versions("0.1.1", "0.1.0").unwrap(),
            Ordering::Greater
        );
        assert_eq!(compare_versions("1.4.0", "1.4.0").unwrap(), Ordering::Equal);
    }

    #[test]
    fn parses_valid_manifest_and_detects_update() {
        let result = check_manifest_text("1.4.0", &valid_manifest("1.4.1")).unwrap();
        assert!(result.update_available);
        assert_eq!(result.current_version, "1.4.0");
        assert_eq!(result.latest_version, "1.4.1");
        assert_eq!(result.manifest.channel, "beta");
    }

    #[test]
    fn does_not_detect_update_for_equal_or_older_versions() {
        assert!(
            !check_manifest_text("1.4.0", &valid_manifest("1.4.0"))
                .unwrap()
                .update_available
        );
        assert!(
            !check_manifest_text("1.4.0", &valid_manifest("1.3.9"))
                .unwrap()
                .update_available
        );
    }

    #[test]
    fn rejects_invalid_manifest() {
        assert!(check_manifest_text("1.4.0", "{not json").is_err());
        let wrong_app = valid_manifest("1.4.1").replace("Soundbender TagDeck", "Other App");
        assert!(check_manifest_text("1.4.0", &wrong_app).is_err());
        let http_url =
            valid_manifest("1.4.1").replace("https://soundbender.live", "http://soundbender.live");
        assert!(check_manifest_text("1.4.0", &http_url).is_err());
        let wrong_host =
            valid_manifest("1.4.1").replace("https://soundbender.live", "https://example.com");
        assert!(check_manifest_text("1.4.0", &wrong_host).is_err());
    }
}
