use crate::error::{AppError, AppResult};
use crate::models::{AudioMetadata, ExtendedMetadataTag};
use lofty::config::ParseOptions;
use lofty::file::{AudioFile, TaggedFileExt};
use lofty::id3::v2::{Frame, Id3v2Tag, SyncTextContentType, SynchronizedTextFrame};
use lofty::mpeg::MpegFile;
use lofty::prelude::Accessor;
use lofty::probe::Probe;
use lofty::tag::{ItemKey, ItemValue};
use std::path::Path;

pub const SUPPORTED_EXTENSIONS: &[&str] = &["mp3", "flac", "m4a", "mp4", "ogg", "wav"];

pub fn is_supported_audio(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            SUPPORTED_EXTENSIONS
                .iter()
                .any(|supported| extension.eq_ignore_ascii_case(supported))
        })
}

pub fn read_metadata(path: &Path) -> AppResult<AudioMetadata> {
    if !is_supported_audio(path) {
        return Err(AppError::UnsupportedAudio(path.to_path_buf()));
    }

    let audio_format = path
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let tagged_file = Probe::open(path)
        .map_err(|error| std::io::Error::other(error.to_string()))?
        .guess_file_type()
        .map_err(|error| std::io::Error::other(error.to_string()))?
        .read()
        .map_err(|error| std::io::Error::other(error.to_string()))?;

    let properties = tagged_file.properties();
    let tag = tagged_file
        .primary_tag()
        .or_else(|| tagged_file.first_tag());
    let duration_ms = i64::try_from(properties.duration().as_millis()).ok();
    let item_text = |key| tag.and_then(|tag| tag.get_string(key)).map(str::to_owned);
    let bpm = item_text(ItemKey::Bpm)
        .or_else(|| item_text(ItemKey::IntegerBpm))
        .and_then(|value| value.parse::<f64>().ok());
    let mut extended_tags = collect_extended_tags(&tagged_file);
    let mut unsynced_lyrics = collect_generic_unsynced_lyrics(&tagged_file);

    if audio_format == "mp3" {
        let id3_lyrics = read_id3_unsynced_lyrics(path)?;
        if !id3_lyrics.is_empty() {
            unsynced_lyrics = id3_lyrics
                .iter()
                .map(|lyrics| lyrics.value.clone())
                .collect();
            extended_tags.retain(|tag| tag.key != "UnsyncLyrics" && tag.key != "UNSYNCEDLYRICS");
            extended_tags.extend(id3_lyrics);
            sort_extended_tags(&mut extended_tags);
        }
    }

    Ok(AudioMetadata {
        title: tag.and_then(|tag| tag.title().map(|value| value.into_owned())),
        artist: tag.and_then(|tag| tag.artist().map(|value| value.into_owned())),
        album: tag.and_then(|tag| tag.album().map(|value| value.into_owned())),
        album_artist: item_text(ItemKey::AlbumArtist),
        genre: tag.and_then(|tag| tag.genre().map(|value| value.into_owned())),
        year: tag
            .and_then(Accessor::date)
            .map(|date| i64::from(date.year)),
        track_number: tag.and_then(|tag| tag.track()).map(i64::from),
        track_total: tag.and_then(|tag| tag.track_total()).map(i64::from),
        disc_number: tag.and_then(|tag| tag.disk()).map(i64::from),
        disc_total: tag.and_then(|tag| tag.disk_total()).map(i64::from),
        comment: tag.and_then(|tag| tag.comment().map(|value| value.into_owned())),
        lyrics: item_text(ItemKey::Lyrics).or_else(|| item_text(ItemKey::UnsyncLyrics)),
        unsynced_lyrics: join_lyrics(&unsynced_lyrics),
        bpm,
        musical_key: item_text(ItemKey::InitialKey),
        duration_ms,
        bitrate_kbps: properties.overall_bitrate().map(i64::from),
        sample_rate_hz: properties.sample_rate().map(i64::from),
        channels: properties.channels().map(i64::from),
        audio_format,
        has_cover_art: tag.is_some_and(|tag| !tag.pictures().is_empty()),
        extended_tags,
    })
}

fn collect_extended_tags(tagged_file: &impl TaggedFileExt) -> Vec<ExtendedMetadataTag> {
    let mut extended_tags = Vec::new();

    for tag in tagged_file.tags() {
        let tag_type = format!("{:?}", tag.tag_type());

        for item in tag.items() {
            extended_tags.push(extended_tag_from_item(&tag_type, item));
        }

        for picture in tag.pictures() {
            let mime_type = picture
                .mime_type()
                .map(|mime| format!("{mime:?}"))
                .unwrap_or_else(|| "desconocido".to_owned());
            extended_tags.push(ExtendedMetadataTag {
                tag_type: tag_type.clone(),
                key: format!("Picture::{:?}", picture.pic_type()),
                value: format!("{mime_type}, {} bytes", picture.data().len()),
                value_type: "picture".to_owned(),
                description: picture.description().map(str::to_owned),
            });
        }
    }

    sort_extended_tags(&mut extended_tags);
    extended_tags
}

fn sort_extended_tags(extended_tags: &mut [ExtendedMetadataTag]) {
    extended_tags.sort_by(|left, right| {
        left.tag_type
            .cmp(&right.tag_type)
            .then(left.key.cmp(&right.key))
            .then(left.value.cmp(&right.value))
    });
}

fn collect_generic_unsynced_lyrics(tagged_file: &impl TaggedFileExt) -> Vec<String> {
    tagged_file
        .tags()
        .iter()
        .flat_map(|tag| {
            tag.get_strings(ItemKey::UnsyncLyrics)
                .chain(tag.get_strings(ItemKey::Lyrics))
        })
        .map(str::to_owned)
        .collect()
}

fn read_id3_unsynced_lyrics(path: &Path) -> AppResult<Vec<ExtendedMetadataTag>> {
    let mut file = std::fs::File::open(path)?;
    let mpeg = MpegFile::read_from(&mut file, ParseOptions::new())
        .map_err(|error| std::io::Error::other(error.to_string()))?;

    Ok(mpeg
        .id3v2()
        .map(extended_id3_unsynced_lyrics)
        .unwrap_or_default())
}

fn extended_id3_unsynced_lyrics(tag: &Id3v2Tag) -> Vec<ExtendedMetadataTag> {
    let mut lyrics_tags = Vec::new();

    for frame in tag {
        match frame {
            Frame::UnsynchronizedText(lyrics) => {
                let language = String::from_utf8_lossy(&lyrics.language);
                let description = if lyrics.description.trim().is_empty() {
                    format!("USLT; idioma: {language}")
                } else {
                    format!("USLT; idioma: {language}; {}", lyrics.description)
                };
                push_lyrics_tag(&mut lyrics_tags, lyrics.content.as_ref(), Some(description));
            }
            Frame::UserText(text) if is_lyrics_alias(&text.description) => {
                push_lyrics_tag(
                    &mut lyrics_tags,
                    text.content.as_ref(),
                    Some(format!("TXXX:{}", text.description)),
                );
            }
            Frame::Comment(comment) if is_lyrics_alias(&comment.description) => {
                push_lyrics_tag(
                    &mut lyrics_tags,
                    comment.content.as_ref(),
                    Some(format!("COMM:{}", comment.description)),
                );
            }
            Frame::Binary(binary) if binary.id().as_str() == "SYLT" => {
                if let Ok(synchronized) = SynchronizedTextFrame::parse(&binary.data, binary.flags())
                {
                    if synchronized.content_type == SyncTextContentType::Lyrics {
                        let value = synchronized
                            .content
                            .iter()
                            .map(|(_, text)| text.as_str())
                            .collect::<Vec<_>>()
                            .join("\n");
                        push_lyrics_tag(
                            &mut lyrics_tags,
                            &value,
                            Some("SYLT convertido a texto".to_owned()),
                        );
                    }
                }
            }
            _ => {}
        }
    }

    lyrics_tags
}

fn push_lyrics_tag(
    lyrics_tags: &mut Vec<ExtendedMetadataTag>,
    value: &str,
    description: Option<String>,
) {
    let value = value.trim_matches('\0').trim();
    if value.is_empty() || lyrics_tags.iter().any(|tag| tag.value == value) {
        return;
    }

    lyrics_tags.push(ExtendedMetadataTag {
        tag_type: "Id3v2".to_owned(),
        key: "UNSYNCEDLYRICS".to_owned(),
        value: value.to_owned(),
        value_type: "text".to_owned(),
        description,
    });
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

fn join_lyrics(lyrics: &[String]) -> Option<String> {
    (!lyrics.is_empty()).then(|| lyrics.join("\n\n"))
}

fn extended_tag_from_item(tag_type: &str, item: &lofty::tag::TagItem) -> ExtendedMetadataTag {
    let (value, value_type) = match item.value() {
        ItemValue::Text(value) => (value.clone(), "text"),
        ItemValue::Locator(value) => (value.clone(), "locator"),
        ItemValue::Binary(value) => (format!("[datos binarios: {} bytes]", value.len()), "binary"),
    };

    ExtendedMetadataTag {
        tag_type: tag_type.to_owned(),
        key: format!("{:?}", item.key()),
        value,
        value_type: value_type.to_owned(),
        description: non_empty(item.description()),
    }
}

fn non_empty(value: &str) -> Option<String> {
    let value = value.trim();
    (!value.is_empty()).then(|| value.to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;
    use lofty::id3::v2::{ExtendedTextFrame, Frame, UnsynchronizedTextFrame};
    use lofty::tag::items::UNKNOWN_LANGUAGE;
    use lofty::tag::TagItem;
    use lofty::TextEncoding;
    use std::io::Write;

    fn write_minimal_wav(path: &Path) {
        let sample_rate = 8_000_u32;
        let sample_count = 800_u32;
        let data_size = sample_count * 2;
        let mut file = std::fs::File::create(path).unwrap();

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
    fn reads_basic_wav_properties() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("fixture.wav");
        write_minimal_wav(&path);

        let metadata = read_metadata(&path).unwrap();
        assert_eq!(metadata.audio_format, "wav");
        assert_eq!(metadata.sample_rate_hz, Some(8_000));
        assert_eq!(metadata.channels, Some(1));
        assert!(metadata.duration_ms.is_some_and(|duration| duration >= 90));
        assert!(metadata.extended_tags.is_empty());
        assert_eq!(metadata.unsynced_lyrics, None);
    }

    #[test]
    fn extended_values_keep_text_and_summarize_binary_data() {
        let text = TagItem::new(
            ItemKey::Publisher,
            ItemValue::Text("Soundbender".to_owned()),
        );
        let binary = TagItem::new(ItemKey::Publisher, ItemValue::Binary(vec![1; 8]));

        let text_tag = extended_tag_from_item("Id3v2", &text);
        let binary_tag = extended_tag_from_item("Id3v2", &binary);

        assert_eq!(text_tag.value, "Soundbender");
        assert_eq!(text_tag.value_type, "text");
        assert_eq!(binary_tag.value, "[datos binarios: 8 bytes]");
        assert_eq!(binary_tag.value_type, "binary");
    }

    #[test]
    fn id3_uslt_frames_are_exposed_as_unsynced_lyrics() {
        let mut tag = Id3v2Tag::default();
        tag.insert(Frame::UnsynchronizedText(UnsynchronizedTextFrame::new(
            TextEncoding::UTF8,
            UNKNOWN_LANGUAGE,
            "letra principal",
            "Primera línea\nSegunda línea",
        )));

        let lyrics = extended_id3_unsynced_lyrics(&tag);

        assert_eq!(lyrics.len(), 1);
        assert_eq!(lyrics[0].key, "UNSYNCEDLYRICS");
        assert_eq!(lyrics[0].value, "Primera línea\nSegunda línea");
        assert_eq!(
            lyrics[0].description.as_deref(),
            Some("USLT; idioma: XXX; letra principal")
        );
    }

    #[test]
    fn txxx_lyrics_alias_is_exposed_as_unsynced_lyrics() {
        let mut tag = Id3v2Tag::default();
        tag.insert(Frame::UserText(ExtendedTextFrame::new(
            TextEncoding::UTF8,
            "UNSYNCED_LYRICS",
            "Letra guardada en un campo personalizado",
        )));

        let lyrics = extended_id3_unsynced_lyrics(&tag);

        assert_eq!(lyrics.len(), 1);
        assert_eq!(lyrics[0].value, "Letra guardada en un campo personalizado");
        assert_eq!(
            lyrics[0].description.as_deref(),
            Some("TXXX:UNSYNCED_LYRICS")
        );
    }

    #[test]
    fn detects_common_lyrics_aliases() {
        assert!(is_lyrics_alias("Unsynced Lyrics"));
        assert!(is_lyrics_alias("UNSYNCHRONIZED_LYRICS"));
        assert!(is_lyrics_alias("lyrics"));
        assert!(!is_lyrics_alias("subtitle"));
    }
}
