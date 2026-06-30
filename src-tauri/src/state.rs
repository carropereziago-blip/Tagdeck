use crate::database::Database;
use crate::player::AudioPlayer;
use std::path::PathBuf;

pub struct AppState {
    pub database: Database,
    pub player: AudioPlayer,
    pub app_data_dir: PathBuf,
    pub database_path: PathBuf,
    pub backup_dir: PathBuf,
    pub logs_dir: PathBuf,
    pub drag_icon_path: PathBuf,
}

impl AppState {
    pub fn new(
        database: Database,
        app_data_dir: PathBuf,
        database_path: PathBuf,
        backup_dir: PathBuf,
        logs_dir: PathBuf,
        drag_icon_path: PathBuf,
    ) -> Self {
        Self {
            database,
            player: AudioPlayer::default(),
            app_data_dir,
            database_path,
            backup_dir,
            logs_dir,
            drag_icon_path,
        }
    }
}
