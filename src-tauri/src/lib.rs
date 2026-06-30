mod commands;
mod database;
mod error;
mod importer;
mod metadata;
mod metadata_writer;
mod models;
mod player;
mod scanner;
mod state;
mod transfer;
mod updates;

use database::Database;
use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_drag::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&app_data_dir)?;
            let database_path = app_data_dir.join("tagdeck.sqlite3");
            let backup_dir = app_data_dir.join("backups");
            std::fs::create_dir_all(&backup_dir)?;
            let logs_dir = app_data_dir.join("logs");
            std::fs::create_dir_all(&logs_dir)?;
            let drag_icon_path = app_data_dir.join("drag-preview.png");
            let drag_icon = include_bytes!("../icons/128x128.png");
            let drag_icon_is_current = std::fs::read(&drag_icon_path)
                .is_ok_and(|existing| existing.as_slice() == drag_icon);
            if !drag_icon_is_current {
                std::fs::write(&drag_icon_path, drag_icon)?;
            }
            let database = tauri::async_runtime::block_on(Database::connect(&database_path))?;
            app.manage(AppState::new(
                database,
                app_data_dir,
                database_path,
                backup_dir,
                logs_dir,
                drag_icon_path,
            ));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_drag_icon_path,
            commands::get_app_settings,
            commands::save_app_settings,
            commands::get_app_diagnostics,
            commands::export_diagnostics,
            commands::get_device_id,
            commands::export_sync_manifest,
            commands::backup_database,
            commands::open_app_path,
            commands::reveal_file,
            commands::scan_folder,
            commands::get_library_folders,
            commands::get_library_tracks,
            commands::get_organization_options,
            commands::create_project,
            commands::update_track_organization,
            commands::export_library,
            commands::export_library_backup,
            commands::get_track,
            commands::get_explorer_tracks,
            commands::save_curation,
            commands::skip_curation_track,
            commands::get_playlists,
            commands::get_playlist_groups,
            commands::create_playlist_group,
            commands::update_playlist_group,
            commands::delete_playlist_group,
            commands::create_playlist,
            commands::update_playlist,
            commands::delete_playlist,
            commands::get_playlist,
            commands::add_tracks_to_playlist,
            commands::remove_tracks_from_playlist,
            commands::move_playlist_track,
            commands::reorder_playlist_tracks,
            commands::export_playlist,
            commands::copy_playlist_files,
            commands::export_pack,
            commands::preview_library_import,
            commands::apply_library_import,
            commands::preview_library_restore,
            commands::apply_library_restore,
            commands::check_for_updates,
            commands::open_update_url,
            commands::update_track_rating,
            commands::remove_tracks_from_library,
            commands::clear_library,
            commands::update_track_metadata,
            commands::read_audio_metadata,
            commands::play_track,
            commands::pause_player,
            commands::resume_player,
            commands::stop_player,
            commands::seek_player,
            commands::set_player_volume,
            commands::get_player_state
        ])
        .run(tauri::generate_context!())
        .expect("error al ejecutar Soundbender TagDeck");
}
