use crate::error::{AppError, AppResult};
use crate::models::{PlayerState, PlayerStatus, TrackDetails};
use rodio::cpal::{
    self,
    traits::{DeviceTrait, HostTrait},
};
use rodio::{Decoder, OutputStream, OutputStreamBuilder, Sink};
use std::fs::File;
use std::sync::{Mutex, MutexGuard};
use std::time::Duration;

macro_rules! player_debug {
    ($($arg:tt)*) => {
        #[cfg(debug_assertions)]
        eprintln!($($arg)*);
    };
}

pub struct AudioPlayer {
    inner: Mutex<PlayerInner>,
}

struct PlayerInner {
    stream: Option<OutputStream>,
    output_device_name: Option<String>,
    sink: Option<Sink>,
    current_track_id: Option<i64>,
    duration_ms: Option<i64>,
    volume: f32,
    manually_stopped: bool,
    play_count_recorded: bool,
}

impl Default for AudioPlayer {
    fn default() -> Self {
        Self {
            inner: Mutex::new(PlayerInner {
                stream: None,
                output_device_name: None,
                sink: None,
                current_track_id: None,
                duration_ms: None,
                volume: 0.8,
                manually_stopped: true,
                play_count_recorded: false,
            }),
        }
    }
}

impl AudioPlayer {
    pub fn play_track(
        &self,
        track: &TrackDetails,
        context: &str,
        reason: &str,
    ) -> AppResult<PlayerState> {
        if context == "unknown" || reason == "unknown" {
            player_debug!(
                "[PLAYER] ERROR play request without clear context/reason id={} context={} reason={}",
                track.id, context, reason
            );
        }
        player_debug!(
            "[PLAYER] play request id={} title=\"{}\" context={} reason={:?} at={:?}",
            track.id,
            track.title.as_deref().unwrap_or(&track.file_name),
            context,
            reason,
            std::time::SystemTime::now()
        );
        {
            let inner = self.lock()?;
            let state = snapshot(&inner);
            if is_duplicate_play_request(&state, track.id) {
                player_debug!(
                    "[PLAYER] ignoring duplicate play request id={} context={} reason={}",
                    track.id,
                    context,
                    reason
                );
                return Ok(state);
            }
        }

        let file = File::open(&track.file_path)?;
        let decoder =
            Decoder::try_from(file).map_err(|error| AppError::Audio(error.to_string()))?;

        let mut inner = self.lock()?;
        let (default_device, default_device_name) = system_default_output_device()?;
        if should_refresh_output_stream(
            inner.stream.is_some(),
            inner.output_device_name.as_deref(),
            &default_device_name,
        ) {
            player_debug!(
                "[AUDIO] selected output device changed or missing: previous={:?} current=\"{}\"",
                inner.output_device_name,
                default_device_name
            );
            if let Some(previous_sink) = inner.sink.take() {
                previous_sink.stop();
            }
            inner.stream = None;
            inner.stream = Some(open_system_default_stream(
                default_device,
                &default_device_name,
            )?);
            inner.output_device_name = Some(default_device_name);
        }
        let sink = Sink::connect_new(
            inner
                .stream
                .as_ref()
                .expect("output stream must exist before creating sink")
                .mixer(),
        );
        if let Some(previous_sink) = inner.sink.take() {
            previous_sink.stop();
        }
        sink.set_volume(inner.volume);
        player_debug!(
            "[AUDIO] sink volume={} system_device={:?}",
            inner.volume,
            inner.output_device_name
        );
        sink.append(decoder);

        inner.sink = Some(sink);
        inner.current_track_id = Some(track.id);
        inner.duration_ms = track.duration_ms;
        inner.manually_stopped = false;
        inner.play_count_recorded = false;
        player_debug!(
            "[PLAYER] playing id={} title=\"{}\" context={} reason={:?} at={:?}",
            track.id,
            track.title.as_deref().unwrap_or(&track.file_name),
            context,
            reason,
            std::time::SystemTime::now()
        );

        Ok(snapshot(&inner))
    }

    pub fn pause(&self) -> AppResult<PlayerState> {
        let inner = self.lock()?;
        if let Some(sink) = &inner.sink {
            sink.pause();
        }
        Ok(snapshot(&inner))
    }

    pub fn resume(&self) -> AppResult<PlayerState> {
        let mut inner = self.lock()?;
        if inner.manually_stopped {
            return Ok(snapshot(&inner));
        }
        if let Some(sink) = &inner.sink {
            sink.play();
        }
        inner.manually_stopped = false;
        Ok(snapshot(&inner))
    }

    pub fn stop(&self) -> AppResult<PlayerState> {
        let mut inner = self.lock()?;
        if let Some(sink) = inner.sink.take() {
            sink.stop();
        }
        inner.current_track_id = None;
        inner.duration_ms = None;
        inner.manually_stopped = true;
        inner.play_count_recorded = false;
        player_debug!("[PLAYER] stop");
        Ok(snapshot(&inner))
    }

    pub fn seek(&self, position_ms: i64) -> AppResult<PlayerState> {
        if position_ms < 0 {
            return Err(AppError::InvalidPosition);
        }

        let inner = self.lock()?;
        if let Some(sink) = &inner.sink {
            sink.try_seek(Duration::from_millis(position_ms as u64))
                .map_err(|error| AppError::Audio(error.to_string()))?;
        }
        Ok(snapshot(&inner))
    }

    pub fn set_volume(&self, volume: f32) -> AppResult<PlayerState> {
        if !volume.is_finite() || !(0.0..=1.0).contains(&volume) {
            return Err(AppError::InvalidVolume);
        }

        let mut inner = self.lock()?;
        inner.volume = volume;
        if let Some(sink) = &inner.sink {
            sink.set_volume(volume);
        }
        Ok(snapshot(&inner))
    }

    pub fn current_track_id(&self) -> AppResult<Option<i64>> {
        Ok(self.lock()?.current_track_id)
    }

    pub fn state_and_play_count_candidate(
        &self,
        threshold: &str,
    ) -> AppResult<(PlayerState, Option<i64>)> {
        let mut inner = self.lock()?;
        let state = snapshot(&inner);
        let should_record = !inner.play_count_recorded
            && inner.current_track_id.is_some()
            && played_sufficiently(
                state.position_ms,
                state.duration_ms,
                state.status == PlayerStatus::Ended,
                threshold,
            );

        let candidate = if should_record {
            inner.play_count_recorded = true;
            inner.current_track_id
        } else {
            None
        };

        Ok((state, candidate))
    }

    fn lock(&self) -> AppResult<MutexGuard<'_, PlayerInner>> {
        self.inner
            .lock()
            .map_err(|_| AppError::Audio("el estado del reproductor esta bloqueado".to_owned()))
    }
}

fn system_default_output_device() -> AppResult<(cpal::Device, String)> {
    let host = cpal::default_host();
    let device = host.default_output_device().ok_or_else(|| {
        AppError::Audio("No se encontro ningun dispositivo de salida de audio del sistema.".into())
    })?;
    let device_name = device
        .name()
        .unwrap_or_else(|_| "Dispositivo de salida desconocido".to_owned());
    player_debug!("[AUDIO] system default output device=\"{}\"", device_name);
    Ok((device, device_name))
}

fn open_system_default_stream(device: cpal::Device, device_name: &str) -> AppResult<OutputStream> {
    let mut stream = OutputStreamBuilder::from_device(device)
        .and_then(|builder| builder.open_stream())
        .map_err(|error| {
            AppError::Audio(format!(
                "No se pudo inicializar la salida de audio del sistema ({device_name}): {error}"
            ))
        })?;
    stream.log_on_drop(false);
    player_debug!(
        "[AUDIO] stream created for system device=\"{}\"",
        device_name
    );
    Ok(stream)
}

fn should_refresh_output_stream(
    has_stream: bool,
    stored_device_name: Option<&str>,
    current_device_name: &str,
) -> bool {
    !has_stream || stored_device_name != Some(current_device_name)
}

fn snapshot(inner: &PlayerInner) -> PlayerState {
    let (status, position_ms) = match &inner.sink {
        Some(_) if inner.manually_stopped => (PlayerStatus::Stopped, 0),
        Some(sink) if sink.empty() => (
            PlayerStatus::Ended,
            inner
                .duration_ms
                .unwrap_or_else(|| duration_to_ms(sink.get_pos())),
        ),
        Some(sink) if sink.is_paused() => (PlayerStatus::Paused, duration_to_ms(sink.get_pos())),
        Some(sink) => (PlayerStatus::Playing, duration_to_ms(sink.get_pos())),
        None => (PlayerStatus::Stopped, 0),
    };

    PlayerState {
        track_id: inner.current_track_id,
        status,
        position_ms,
        duration_ms: inner.duration_ms,
        volume: inner.volume,
    }
}

fn is_duplicate_play_request(state: &PlayerState, requested_track_id: i64) -> bool {
    state.track_id == Some(requested_track_id) && state.status == PlayerStatus::Playing
}

fn duration_to_ms(duration: Duration) -> i64 {
    i64::try_from(duration.as_millis()).unwrap_or(i64::MAX)
}

fn played_sufficiently(
    position_ms: i64,
    duration_ms: Option<i64>,
    ended: bool,
    rule: &str,
) -> bool {
    let threshold = match (rule, duration_ms) {
        ("complete", _) => return ended,
        ("70", Some(duration)) if duration > 0 => duration * 70 / 100,
        ("50", Some(duration)) if duration > 0 => duration / 2,
        ("30s", _) => 30_000,
        (_, Some(duration)) if duration > 0 => duration / 2,
        _ => 30_000,
    };
    ended || position_ms >= threshold
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn play_threshold_is_half_for_short_tracks() {
        assert!(!played_sufficiently(14_999, Some(30_000), false, "50"));
        assert!(played_sufficiently(15_000, Some(30_000), false, "50"));
    }

    #[test]
    fn play_threshold_is_thirty_seconds_for_long_tracks() {
        assert!(!played_sufficiently(29_999, Some(180_000), false, "30s"));
        assert!(played_sufficiently(30_000, Some(180_000), false, "30s"));
        assert!(played_sufficiently(1, None, true, "complete"));
    }

    #[test]
    fn volume_validation_rejects_out_of_range_values() {
        let player = AudioPlayer::default();
        assert!(matches!(
            player.set_volume(-0.1),
            Err(AppError::InvalidVolume)
        ));
        assert!(matches!(
            player.set_volume(1.1),
            Err(AppError::InvalidVolume)
        ));
    }

    #[test]
    fn duplicate_play_request_is_ignored_only_while_same_track_is_playing() {
        let playing = PlayerState {
            track_id: Some(7),
            status: PlayerStatus::Playing,
            position_ms: 1_000,
            duration_ms: Some(180_000),
            volume: 0.8,
        };
        let paused = PlayerState {
            status: PlayerStatus::Paused,
            ..playing.clone()
        };

        assert!(is_duplicate_play_request(&playing, 7));
        assert!(!is_duplicate_play_request(&playing, 8));
        assert!(!is_duplicate_play_request(&paused, 7));
    }

    #[test]
    fn output_stream_refreshes_when_missing_or_system_device_changes() {
        assert!(should_refresh_output_stream(false, None, "Speakers"));
        assert!(should_refresh_output_stream(
            true,
            Some("Headphones"),
            "Speakers"
        ));
        assert!(!should_refresh_output_stream(
            true,
            Some("Speakers"),
            "Speakers"
        ));
    }
}
