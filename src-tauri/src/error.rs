use std::path::PathBuf;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Error de base de datos: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Error de migración: {0}")]
    Migration(#[from] sqlx::migrate::MigrateError),

    #[error("Error de sistema de archivos: {0}")]
    Io(#[from] std::io::Error),

    #[error("La ruta no es una carpeta válida: {0}")]
    InvalidDirectory(PathBuf),

    #[error("El archivo no es un formato de audio compatible: {0}")]
    UnsupportedAudio(PathBuf),

    #[error("No se encontró la canción con id {0}")]
    TrackNotFound(i64),

    #[error("El rating debe ser NULL o un entero entre 1 y 10")]
    InvalidRating,

    #[error("Error de reproducción: {0}")]
    Audio(String),

    #[error("El volumen debe estar entre 0 y 1")]
    InvalidVolume,

    #[error("La posición de reproducción no puede ser negativa")]
    InvalidPosition,

    #[error("La edición de metadatos no contiene ningún cambio")]
    EmptyMetadataPatch,

    #[error("Debes seleccionar al menos una canción")]
    EmptyTrackSelection,

    #[error("Valor de metadatos no válido: {0}")]
    InvalidMetadata(String),

    #[error("El archivo es de solo lectura: {0}")]
    ReadOnlyFile(PathBuf),

    #[error("Error escribiendo metadatos en {path}: {message}")]
    MetadataWrite { path: PathBuf, message: String },

    #[error("La tarea en segundo plano falló: {0}")]
    BackgroundTask(String),
}

pub type AppResult<T> = Result<T, AppError>;
