# Implementation Log

## 2026-06-30 - Instalador actualizado 1.4.0-beta.1

- Se ejecuta `npm.cmd run tauri:build` sobre el estado actual tras los hotfixes
  de Session y Explorer.
- El build frontend de produccion se genera correctamente mediante el
  `beforeBuildCommand`.
- Tauri compila release y genera los dos bundles configurados:
  `src-tauri\target\release\bundle\nsis\Soundbender TagDeck_1.4.0-beta.1_x64-setup.exe`
  y
  `src-tauri\target\release\bundle\msi\Soundbender TagDeck_1.4.0-beta.1_x64_es-ES.msi`.

## 2026-06-30 - Paquete GitHub y manifest web 1.4.0-beta.2

- Se sube la version publica del proyecto a `1.4.0-beta.2` para que el
  actualizador manual pueda detectar la beta hotfix frente a `1.4.0-beta.1`.
- Se regenera instalador Tauri beta.2:
  `src-tauri\target\release\bundle\nsis\Soundbender TagDeck_1.4.0-beta.2_x64-setup.exe`
  y
  `src-tauri\target\release\bundle\msi\Soundbender TagDeck_1.4.0-beta.2_x64_es-ES.msi`.
- Se actualiza `docs/web/tagdeck/latest.json` con version `1.4.0-beta.2`,
  hash SHA256 del instalador NSIS y notas de hotfix.
- Se prepara fuente limpia para GitHub en
  `github_upload\Soundbender_TagDeck_GitHub_1.4.0-beta.2\` y ZIP
  `github_upload\Soundbender_TagDeck_GitHub_1.4.0-beta.2.zip`.
- Se prepara carpeta final de release:
  `release\Soundbender_TagDeck_1.4.0-beta.2_Beta_2\`.
- Se prepara ZIP final:
  `release\Soundbender_TagDeck_1.4.0-beta.2_Beta_2_Release.zip`.
- `npm.cmd run tauri:build`: aprobado.
- `npm.cmd run test`: 211 pruebas aprobadas.
- `npm.cmd run build`: aprobado.
- `cargo test`: 60 pruebas aprobadas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- `cargo fmt -- --check`: aprobado.

## 2026-06-29 - Soundbender TagDeck 1.4.0-beta.1 Beta 1

### Alcance

- Actualizada la version publica a `1.4.0-beta.1` en package, Cargo, Tauri y
  manifest web.
- Generado instalador Windows NSIS y MSI con Tauri.
- Creado paquete de codigo fuente compartible sin `node_modules`, `dist`,
  `src-tauri/target`, musica, bases de datos, logs ni backups.
- Aniadida licencia GPL-3.0 oficial en `LICENSE` y README publico actualizado.
- Preparados `latest.json`, pagina `download.md` y release notes para
  `soundbender.live`.
- Creada carpeta final `release/Soundbender_TagDeck_1.4.0-beta.1_Beta_1/` con
  instaladores, source ZIP, checksums y notas.
- Creado ZIP final `Soundbender_TagDeck_1.4.0-beta.1_Beta_1_Release.zip` para
  subir a Google Drive.
- `IMPLEMENTATION_LOG.md` no se incluyo en el source ZIP porque contiene trazas
  locales de trabajo.

### Verificacion

- `npm.cmd run test`: 201 tests pasados.
- `npm.cmd run build`: build frontend pasado.
- `cargo test`: 59 tests pasados.
- `cargo check`: pasado.
- `cargo clippy --all-targets -- -D warnings`: pasado.
- `cargo fmt -- --check`: pasado.
- `npm.cmd run tauri:build`: pasado; generados NSIS y MSI.

## 2026-06-29 - Actualizador manual

### Alcance

- Aniadido comprobador manual de actualizaciones en Ajustes.
- La app consulta `https://soundbender.live/tagdeck/latest.json` mediante un
  GET publico desde Rust, evitando dependencias de CORS del frontend.
- Se valida que el manifest sea para Soundbender TagDeck, version de manifest
  soportada, semver valido y URLs HTTPS bajo `soundbender.live`.
- Se compara semver correctamente, incluyendo prereleases como `beta`.
- Si hay version nueva, la UI muestra instalada/disponible, cambios, descarga y
  notas de version.
- Los botones abren URLs externas validadas. No se descarga ni ejecuta ningun
  instalador desde la app.
- Se guardan `lastUpdateCheckAt` y `lastKnownLatestVersion` en ajustes.
- Aniadida documentacion en `docs/UPDATES.md` y ejemplos listos para subir a la
  web en `docs/examples/`.

### Verificacion

- `npm.cmd run test`: 201 tests pasados.
- `npm.cmd run build`: build frontend pasado.
- `cargo test`: 59 tests pasados.
- `cargo check`: pasado.
- `cargo clippy --all-targets -- -D warnings`: pasado.
- `cargo fmt -- --check`: pasado.
- No se genero instalador ni se ejecuto `tauri:build`.

## 2026-06-26 - Backup restaurable de biblioteca

### Alcance

- Separada la importacion de datos CSV/JSON existente de una nueva restauracion
  completa desde backup JSON de TagDeck.
- Aniadido export JSON de biblioteca restaurable con manifest version, version de
  app, device id, raices, proyectos, tags, tracks y playlists con orden.
- Aniadido preview obligatorio antes de restaurar, con conteo de archivos
  encontrados en ruta original, encontrados por carpeta de reubicacion y
  archivos ausentes.
- Aniadida restauracion segura en SQLite: primero se crea una copia de la base de
  datos y despues se aplican datos internos solo a canciones cuyos archivos
  existen.
- Aniadido soporte para modo conservar, rellenar vacios y sobrescribir datos
  internos.
- La restauracion no escribe tags ni modifica archivos musicales.
- Aniadida UI en Ajustes para exportar backup, seleccionar backup, localizar
  carpeta de musica reubicada, previsualizar y restaurar.

### Verificacion

- `npm.cmd run test`: 197 tests pasados.
- `npm.cmd run build`: build frontend pasado.
- `cargo test`: 55 tests pasados.
- `cargo check`: pasado.
- `cargo clippy --all-targets -- -D warnings`: pasado.
- `cargo fmt -- --check`: pasado.
- No se genero instalador ni se ejecuto `tauri:build`.

## 2026-06-09 - Primer bloque

### Alcance

- Fase 1: base Tauri, React, TypeScript, Tailwind, Rust y SQLite.
- Fase 2: escaneo de solo lectura, lectura de metadatos y biblioteca.
- Rating local 1-10 adelantado al primer MVP.
- Inspector de lectura y `PlayerBar` sin reproducción.

### Decisiones

- SQLite solo se consulta desde Rust.
- La base se crea en el directorio de datos de la aplicación como
  `tagdeck.sqlite3`.
- `file_path_key` contiene una ruta canónica y normalizada para hacer el
  reescaneo idempotente en Windows.
- El `UPSERT` de un escaneo no modifica `rating` ni `play_count`.
- El rating acepta `NULL` o enteros entre 1 y 10. La validación existe en Rust
  y como restricción `CHECK` de SQLite.
- Los errores de metadatos se guardan en `metadata_read_error`; un archivo
  dañado no cancela el resto del escaneo.
- No existe ninguna operación de apertura con permisos de escritura sobre
  archivos de audio.
- Los campos avanzados de metadata ya forman parte del modelo aunque algunos
  permanezcan vacíos cuando el formato no ofrece una clave equivalente.
- Lofty mapea en esta versión título, artista, álbum, album artist, género,
  fecha/año, pista, disco, comentario, letras, BPM, tonalidad y presencia de
  carátula, además de las propiedades técnicas disponibles.
- El hash completo se aplaza para evitar convertir el primer escaneo en una
  operación costosa. La idempotencia actual se basa en la ruta normalizada.
- No se ha utilizado Git porque no está disponible en `PATH`.

### Versiones resueltas principales

- Tauri `2.11.2`
- React `19.2.7`
- TypeScript `6.0.3`
- Tailwind CSS `4.3.0`
- SQLx `0.8.6`
- Lofty `0.24.0`

### Verificaciones

- `npm.cmd run test`: 2 pruebas aprobadas.
- `npm.cmd run build`: aprobado.
- `cargo test --manifest-path src-tauri\Cargo.toml`: 5 pruebas aprobadas.
- `cargo check --manifest-path src-tauri\Cargo.toml`: aprobado.
- `cargo clippy --manifest-path src-tauri\Cargo.toml --all-targets -- -D warnings`:
  aprobado.
- `cargo fmt --manifest-path src-tauri\Cargo.toml -- --check`: aprobado.
- `npm.cmd run tauri:build`: aprobado; ejecutable generado.
- No se realizaron pruebas visuales automatizadas ni inspección visual manual.

### Fuera de alcance

- Escritura de tags.
- Backups y cambios pendientes.
- Edición masiva, playlists, Auto DJ, waveform y radio.

## 2026-06-09 - Etiquetas extendidas y reproductor

### Implementado

- Lectura en vivo de todos los `TagItem` genéricos expuestos por Lofty.
- Identificación del tipo de bloque, clave, tipo de valor y descripción.
- Los valores binarios no se envían completos: se muestra únicamente su tamaño.
- Las imágenes embebidas se muestran como entradas descriptivas sin transferir
  el blob a React.
- Reproductor Rust con Rodio `0.21.1` y Symphonia para MP3, FLAC, M4A, OGG y
  WAV.
- Play/pause, stop, seek, volumen, anterior y siguiente.
- Doble clic sobre una fila para reproducir.
- Sondeo del estado del reproductor y barra de progreso.
- Incremento único de `play_count` cuando se supera el umbral de reproducción.

### Seguridad

- La lectura de etiquetas y la reproducción abren los archivos sin permisos de
  escritura.
- No se añadió ningún comando capaz de modificar tags o audio.
- Los blobs de metadata no se cargan en memoria del frontend.

### Verificación

- `npm.cmd run test`: 2 pruebas aprobadas.
- `npm.cmd run build`: aprobado.
- `cargo test --manifest-path src-tauri\Cargo.toml`: 9 pruebas aprobadas.
- `cargo clippy --manifest-path src-tauri\Cargo.toml --all-targets -- -D warnings`:
  aprobado.
- `cargo fmt --manifest-path src-tauri\Cargo.toml -- --check`: aprobado.
- La salida de audio física y la interfaz se dejan para comprobación manual.

## 2026-06-09 - Unsynced Lyrics

- Se añadió `unsyncedLyrics` como campo explícito de metadata.
- Para MP3 se leen directamente todos los frames ID3v2 `USLT`, conservando
  idioma, descripción y contenido.
- Para FLAC, OGG y M4A se consulta también la clave genérica
  `ItemKey::UnsyncLyrics`.
- Cada letra aparece tanto en el campo dedicado como en las etiquetas
  extendidas bajo la clave `UnsyncLyrics`.
- Se aceptan también variantes no estándar `TXXX:LYRICS`,
  `TXXX:UNSYNCED_LYRICS`, comentarios descritos como letras y frames `SYLT`.
- La inspección de los archivos registrados el 9 de junio de 2026 confirmó que
  ninguno contenía actualmente un frame de letras válido. La UI informa este
  caso explícitamente.

## 2026-06-10 - Corrección con archivo real USLT

- Se validó `Y:\Modelo 2\antigua\Eternal rise 2 (3).mp3`.
- El archivo contiene un frame ID3v2.3 `USLT`, idioma `eng`, con letra completa.
- El inspector usa ahora como fallback `unsyncedLyrics`, `lyrics` de la lectura
  en vivo y `lyrics` almacenado por el escaneo, en ese orden.
- Los errores de lectura de metadata se muestran en el propio inspector y ya no
  se confunden con la ausencia de letras.
- Se detectó mediante una prueba visual real que el layout principal crecía
  hasta `5474px` con las filas de la biblioteca. El inspector existía, pero su
  contenido quedaba centrado fuera del viewport.
- La aplicación queda ahora fijada al alto de la ventana; la tabla y el
  inspector gestionan su propio desplazamiento.
- Se escaneó `Y:\Modelo 2\antigua` desde el backend Tauri real: 547 archivos
  detectados, 547 insertados y 0 errores.
- La prueba visual final confirmó que `Eternal rise 2 (3).mp3` muestra
  `UNSYNCEDLYRICS`, `1749 caracteres`, la letra completa y la entrada extendida
  ID3v2 `USLT; idioma: eng`.

## 2026-06-10 - Edición individual y masiva

- Se añadió escritura real de título, artista, álbum, artista del álbum,
  género, año, pista, total de pistas, disco, total de discos, comentario,
  `UNSYNCEDLYRICS`, BPM, tonalidad y carátula.
- La misma operación Rust admite una canción o hasta 2000 IDs, continuando con
  el resto del lote cuando un archivo falla.
- Cada campo masivo tiene semántica explícita: mantener, establecer o borrar.
- Los MP3 y WAV con ID3 se guardan como ID3v2.3. Los frames `USLT`, `SYLT` y
  alias de letras se reemplazan de forma controlada.
- La escritura se realiza primero en una copia temporal que se relee y valida.
- Antes de sustituir el original se crea una copia completa en
  `<app_data>/backups/YYYY-MM-DD`.
- Si la sustitución falla, el archivo original se restaura desde una copia
  lateral en la misma carpeta.
- SQLite solo se refresca después de completar y releer la escritura.
- Todas las operaciones se registran en `edit_history`, incluyendo errores y
  la ruta de backup cuando existe.
- La tabla permite seleccionar canciones visibles y abrir `Editar N`.
- El inspector incluye edición individual con valores iniciales obtenidos de
  la metadata leída en vivo.
- No se realizaron pruebas visuales por petición del usuario.

## 2026-06-10 - Corrección de selección en el editor masivo

- Se eliminaron etiquetas HTML `label` anidadas en el formulario de metadata.
- Los inputs ya no activan accidentalmente la casilla `Aplicar`.
- La casilla solo cambia mediante su propio control; escribir en un campo
  continúa activándolo automáticamente en modo masivo.
- Se detectó además que el sondeo del reproductor hacía renderizar la biblioteca
  varias veces por segundo.
- La tabla, el inspector, sus callbacks y las columnas de TanStack quedan ahora
  estabilizados para conservar los nodos nativos `select`, `input` y
  `checkbox` mientras están abiertos o enfocados.
- Se eliminó la recarga de biblioteca provocada únicamente por seleccionar una
  canción.
- Se añadió una prueba de regresión que comprueba identidad de nodos, foco y
  estado de la casilla durante la edición.
- Se unificó la apertura del editor: si existen filas marcadas, también el
  botón del inspector edita esas filas y muestra `Editar N marcadas`.
- Los IDs marcados se copian al abrir el editor y permanecen fijos hasta
  guardar o cerrar. La fila activa solo se usa cuando no hay checks marcados.
- No se realizaron pruebas visuales.

## 2026-06-10 - Limpieza de biblioteca y 1000 canciones

- La consulta principal muestra hasta 1000 canciones.
- `Quitar` elimina de SQLite las filas marcadas o, si no hay checks, la
  cancion activa.
- `Vaciar biblioteca` elimina todos los registros, tambien los ocultos por
  filtros o busquedas.
- Ambas acciones requieren confirmacion y dejan intactos los archivos de audio.
- La seleccion, el inspector, el editor y el reproductor olvidan las canciones
  retiradas.
- Se anadieron pruebas SQLite para borrado selectivo y vaciado completo.
- `npm.cmd run test`: 5 pruebas aprobadas.
- `npm.cmd run build`: aprobado.
- `cargo test --manifest-path src-tauri\Cargo.toml`: 17 pruebas aprobadas.
- `cargo check` y `cargo clippy --all-targets -- -D warnings`: aprobados.
- `cargo fmt -- --check`: aprobado.
- `npm.cmd run tauri:build`: aprobado.
- No se realizaron pruebas visuales por peticion del usuario.

## 2026-06-10 - Orden por numero de pista

- La tabla muestra el campo `Pista` obtenido de `track_number`.
- La cabecera permite ordenar numericamente en sentido ascendente o descendente.
- Se anadio una prueba SQLite que verifica el orden por numero de pista.
- No se realizaron pruebas visuales por peticion del usuario.

## 2026-06-11 - Arrastre externo de archivos

- Las filas de la biblioteca pueden arrastrarse al Explorador de Windows y a
  otras aplicaciones que acepten archivos.
- La operacion nativa usa `tauri-plugin-drag` y fuerza el modo copia.
- Arrastrar una fila marcada incluye todas las filas marcadas visibles.
- Los checkboxes, selects y botones no inician arrastres.
- Los archivos originales no se mueven ni se modifican.
- No se realizaron pruebas visuales.

## 2026-06-11 - Biblioteca creativa IA/Suno

- Se aÃ±adiÃ³ la migraciÃ³n `0002_creative_library.sql`.
- Nuevas tablas `projects`, `internal_tags` y `song_tags`.
- Cada canciÃ³n dispone de `status`, `workflow_notes`, `next_action`,
  `version_label` y `project_id`.
- Los datos creativos son internos a SQLite y el escaneo no los sobrescribe.
- Estados disponibles: idea, generando, revisiÃ³n, seleccionada, editando,
  final, publicada y archivada.
- Smart Collections con contadores para biblioteca completa, trabajo activo,
  siguiente acciÃ³n, sin tags, sin proyecto, sin rating y finalizadas.
- Filtros combinables por smart collection, estado, tag y proyecto.
- Editor independiente para organizaciÃ³n individual o masiva.
- La ediciÃ³n masiva permite aplicar selectivamente estado, proyecto, versiÃ³n,
  tags, siguiente acciÃ³n y notas.
- Los proyectos pueden crearse directamente desde el editor.
- ExportaciÃ³n CSV/JSON de todos los resultados del filtro activo, incluyendo
  tags, proyecto, versiÃ³n, notas y siguiente acciÃ³n.
- Se aÃ±adiÃ³ una prueba que verifica persistencia tras reescaneo y filtros
  combinados por tag, estado, proyecto y smart collection.
- `npm.cmd run test`: 5 pruebas aprobadas.
- `npm.cmd run build`: aprobado.
- `cargo test --manifest-path src-tauri\Cargo.toml`: 19 pruebas aprobadas.
- `cargo check`, `cargo clippy --all-targets -- -D warnings` y formato:
  aprobados.
- `npm.cmd run tauri:build`: aprobado.
- No se realizaron pruebas visuales.

## 2026-06-12 - Pulido UI/UX y navegacion creativa

- La barra principal dispone de Biblioteca, Tags, Organizacion y Ajustes.
- Tags y Organizacion son secciones navegables; Organizacion concentra las
  colecciones inteligentes y filtros creativos.
- El inspector conserva un resumen de la organizacion de la cancion activa.
- Los botones distinguen entre `Organizar seleccion` y `Organizar cancion`.
- `Siguiente` se reemplazo por `Siguiente accion`.
- `UNSYNCEDLYRICS` se presenta como `Letras no sincronizadas` en la UI normal.
- Se corrigieron los casos de mojibake visibles en React y en mensajes Rust.
- Los valores ausentes usan el guion largo `—`.
- La ruta se asocia al elemento `tr` de cada cancion, evitando tooltips de otra
  fila o rutas ambiguas cuando existen versiones MP3/WAV con el mismo titulo.
- Se anadio una prueba frontend con dos rutas homonimas para validar el tooltip.
- La revision visual manual confirmo Biblioteca, Tags y Organizacion sin textos
  como `accion` mal codificada, `cancion` mal codificada, `Version` mal
  codificada, `Organizacion` mal codificada ni secuencias similares a `â€”`.
- `npm.cmd run test`: 6 pruebas aprobadas en 4 archivos.
- `npm.cmd run build`: aprobado.
- `cargo test --manifest-path src-tauri\Cargo.toml`: 19 pruebas aprobadas.
- `cargo check`, Clippy con warnings como errores y formato: aprobados.
- `npm.cmd run tauri:build`: aprobado.

## 2026-06-12 - Centro de organizacion dedicado

- `Organizacion` y `Tags` renderizan una pantalla creativa independiente de
  `Biblioteca`.
- La vista incluye tabla propia, Smart Collections, filtros por estado,
  proyecto, version y tag, busqueda y exportacion CSV/JSON.
- El panel de trabajo permite editar una cancion o todas las filas marcadas:
  estado, proyecto, version, tags internos, siguiente accion y notas.
- Los proyectos pueden crearse desde el panel. Los tags y versiones nuevos se
  crean al asignarlos y guardar.
- La Biblioteca ya no contiene el editor creativo duplicado; conserva escaneo,
  reproduccion, metadatos, rating, exportacion y acciones de biblioteca.
- El inspector derecho queda como resumen contextual y muestra estados con el
  mismo formato que la tabla.
- Se anadio filtrado SQLite por version y el catalogo de versiones existentes.
- Se anadio la Smart Collection de canciones archivadas.
- Se anadio una prueba de navegacion para impedir que Organizacion vuelva a
  renderizar la vista de Biblioteca.
- `npm.cmd run test`: 8 pruebas aprobadas en 5 archivos.
- `npm.cmd run build`: aprobado.
- `cargo test`: 20 pruebas aprobadas, incluida persistencia tras reabrir SQLite.
- `cargo check`, Clippy con warnings como errores y formato: aprobados.

## 2026-06-12 - Pulido final Beta 0.95

- Las canciones nuevas entran con estado interno `review`, mostrado como
  `Sin revisar`. La migracion `0003_beta_095_workflow.sql` convierte los
  antiguos estados `idea` automaticos a `Sin revisar`.
- El workflow visible queda reducido a Sin revisar, Idea, En proceso,
  DAW Rescue, Radio Ready, Release Ready y Archivada.
- Las Smart Collections incluyen Sin revisar, DAW Rescue, Radio Ready,
  Release Ready y Archivadas; se elimina el nombre ambiguo
  `Listas / publicadas`.
- Se retiraron los atributos `title` de las filas de Biblioteca y
  Organizacion para evitar tooltips nativos flotantes con rutas.
- La columna `Tags internos` de Organizacion se acorto a `Tags`.
- El panel derecho diferencia una cancion de una seleccion multiple y cambia
  su boton a `Aplicar a seleccion` cuando corresponde.
- Se anadio el aviso de que la organizacion es interna de TagDeck y no
  modifica los archivos musicales.
- La terminologia visible usa `Rating` de forma consistente.
- Se anadio una prueba frontend del flujo individual/lote y se reforzaron las
  pruebas Rust del estado inicial y las Smart Collections.

## 2026-06-12 - Beta 1.0 Modo Explorador / Curador

- Se anadio `Explorador` a la navegacion principal con el subtitulo
  `Modo Curador`.
- El criterio inicial es `Sin revisar`; tambien admite sin rating, sin
  proyecto, sin tags, con siguiente accion, DAW Rescue, Radio Ready,
  Release Ready, archivadas, aleatorias y todas.
- La pantalla muestra cancion, artista, album, duracion, formato, ruta,
  numero de saltos y fecha de revision.
- Reutiliza el reproductor existente para play/pausa, stop, posicion,
  volumen y navegacion.
- Permite editar rating, estado, proyecto, version, tags, siguiente accion,
  notas, parte fuerte, problema principal y uso previsto.
- Se incorporaron opciones rapidas y texto libre para los tres campos de
  curaduria, ademas de botones rapidos de estado.
- `Guardar y siguiente` persiste la curaduria, establece `reviewed_at` y
  `last_reviewed_at`, y carga otra cancion del criterio activo.
- `Saltar por ahora` incrementa `skip_count` sin marcar la cancion como
  revisada.
- La migracion `0004_explorer_curation.sql` anade `strong_part`,
  `main_problem`, `intended_use`, `reviewed_at`, `last_reviewed_at` y
  `skip_count`.
- Los nuevos datos aparecen en JSON, CSV y en el resumen del inspector.
- Se verifico que guardar curaduria no modifica los bytes del archivo de
  audio.
- La revision visual uso una fixture local temporal, eliminada al terminar,
  para no tocar la biblioteca real.
- Pruebas frontend: 12 aprobadas en 7 archivos.
- Pruebas Rust: 24 aprobadas.

## 2026-06-12 - Pulido UX del Explorador y Mood

- `Guardar y siguiente` se movio a la columna izquierda, inmediatamente
  encima de `Saltar por ahora` y junto al reproductor principal.
- Al guardar, el Explorador carga la siguiente cancion del criterio activo y
  comienza su reproduccion automaticamente con el reproductor existente.
- Si no queda otra cancion, el reproductor se detiene y se muestra el estado
  final sin producir errores.
- Se anadio el campo interno `mood` mediante la migracion
  `0005_curation_mood.sql`; se guarda solo en SQLite y nunca se escribe en el
  archivo musical.
- Mood admite seleccion multiple entre 16 opciones rapidas y texto libre
  complementario.
- Mood aparece en el Explorador, el inspector y las exportaciones CSV/JSON.
- Las pruebas cubren persistencia tras reabrir SQLite, exportacion CSV,
  seleccion multiple, reproduccion automatica, salto sin guardado y fin de
  cola.
- La revision visual manual confirmo la nueva disposicion, la seleccion de
  varios moods y la reproduccion automatica de la siguiente pista.
- `npm.cmd run test`: 13 pruebas aprobadas en 7 archivos.
- `cargo test`: 24 pruebas aprobadas.
- `npm.cmd run build`, `cargo check`, Clippy con warnings como errores y
  formato: aprobados.
- `npm.cmd run tauri:build`: aprobado; ejecutable generado en
  `src-tauri/target/release/soundbender-tagdeck.exe`.

## 2026-06-14 - Ajustes y nuevas apariencias visuales

- Apariencia incorpora `Soundbender Light`, con base clara creativa, violeta
  azulado como acento principal y dorado como acento secundario.
- Apariencia incorpora `Soft Light Studio`, con fondo perla, paneles azul
  grisáceo y un acento azul suave orientado a sesiones largas.
- El selector de tema se convirtió en una cuadrícula visual con muestras de
  color, descripción y selección inmediata. El tema sigue persistiendo en el
  documento versionado de ajustes de SQLite.
- Se amplió la paleta semántica global para fondo, sidebar, paneles, tarjetas,
  controles, bordes, overlays, selección, hover, sombras y textos. Las vistas
  existentes heredan los temas claros sin cambios en su lógica.
- Biblioteca, Organización, Explorador, Listas, Modo Sesión, Ajustes,
  inspector, reproductor, modales y tablas incluyen compatibilidad de
  contraste para ambos temas claros.
- `Tags` deja de ser una pantalla independiente en el menú principal. Sus
  filtros, Smart Collections, creación, edición individual y edición masiva
  permanecen dentro del centro de Organización.
- Se añadieron pruebas de normalización y persistencia estructural de los dos
  nuevos valores de tema, además de actualizar las pruebas de navegación.
- La revisión visual manual recorrió Biblioteca, Organización, Explorador,
  Listas, Modo Sesión, Ajustes y reproductor inferior con ambos temas claros.
  No se detectaron desbordes horizontales, textos ilegibles ni pérdida de
  jerarquía en paneles, controles o estados vacíos.
- `npm.cmd run test`: 51 pruebas aprobadas en 12 archivos.
- `cargo test`: 29 pruebas aprobadas.
- `npm.cmd run build`, `cargo check`, Clippy con warnings como errores y
  `cargo fmt -- --check`: aprobados.
- `npm.cmd run tauri:build`: aprobado; ejecutable actualizado en
  `src-tauri/target/release/soundbender-tagdeck.exe`.

## 2026-06-14 - Paquete beta para tester externo

- La versión de distribución pasa a `1.1.0-beta.1` en Tauri, Cargo y npm.
- El bundle de Windows queda activado para generar instaladores NSIS y MSI.
- NSIS usa instalación por usuario actual, selector de español/inglés, iconos
  de la aplicación y acceso agrupado bajo Soundbender en el menú Inicio.
- El MSI utiliza la versión técnica `1.1.0` exigida por Windows Installer y
  fija el Upgrade Code `517e6679-b26b-5db8-9ba5-452fb1b68e9b`.
- No se añaden recursos externos al bundle: los instaladores contienen solo
  el binario y los recursos compilados de la aplicación.
- Se creó `distribution/README_TESTER.txt` con instalación, recorrido de
  prueba, seguridad, desinstalación y formato recomendado para incidencias.
- La aplicación crea SQLite, backups, logs y la imagen de arrastre dentro del
  directorio de datos propio de cada usuario mediante `app_data_dir`.
- Se generaron correctamente los bundles NSIS y MSI en
  `src-tauri/target/release/bundle/` y una carpeta final `tester-package` con
  nombres simplificados para entrega.
- El ZIP portable contiene únicamente `soundbender-tagdeck.exe` y
  `README_TESTER.txt`. No incluye SQLite, canciones, logs, backups,
  exportaciones ni el registro interno de implementación.
- Se añadió `distribution/SHA256SUMS.txt` para comprobar la integridad de los
  tres artefactos distribuibles.
- El ejecutable release pasó un arranque breve y permaneció activo hasta su
  cierre controlado. No se realizó una instalación real sobre el perfil
  principal para no interferir con datos o instalaciones existentes.
- `npm.cmd run test`: 51 pruebas aprobadas en 12 archivos.
- `cargo test`: 29 pruebas aprobadas.
- `npm.cmd run build`, `cargo check`, Clippy con warnings como errores y
  `cargo fmt -- --check`: aprobados.
- `npm.cmd run tauri:build`: aprobado; generados NSIS y MSI.
- Los artefactos no están firmados digitalmente y Windows SmartScreen puede
  mostrar una advertencia durante la descarga o instalación.

## 2026-06-12 - Beta 1.05 Listas internas

- Se añadieron las tablas `playlists` y `playlist_songs` mediante la migración
  `0006_internal_playlists.sql`.
- Las listas admiten nombre, descripción y tipo: manual, radio, álbum
  provisional, revisión, DAW Rescue, candidatas a lanzamiento, sesión u otra.
- La nueva entrada `Listas` abre un centro dedicado con catálogo, número de
  canciones, duración total, edición, borrado y exportación.
- El tracklist muestra posición, título, artista, álbum, rating, estado,
  proyecto, tags, duración y formato.
- Se puede reproducir, retirar individualmente o en lote, mover arriba/abajo
  y abrir la canción concreta en Biblioteca u Organización.
- Al abrir una lista, su tracklist se usa como cola del reproductor inferior;
  Anterior y Siguiente respetan el orden guardado.
- Biblioteca y Organización permiten añadir la canción activa o las marcadas
  a una lista, y crear una lista manual a partir del filtro visible.
- Explorador permite añadir directamente la canción en revisión.
- El diálogo compartido permite elegir una lista existente o crear otra sin
  salir del flujo. SQLite evita duplicados dentro de una misma lista.
- CSV y JSON de una lista incluyen sus datos, posición, ruta y los campos
  creativos internos, incluido Mood.
- Las pruebas Rust cubren CRUD, inserción múltiple, duplicados, retirada,
  reordenación, exportación, reapertura de SQLite y conservación tras
  reescaneo.
- La revisión visual manual comprobó Biblioteca, Organización, Explorador,
  Listas, el diálogo de adición y el reproductor inferior.
- `npm.cmd run test`: 16 pruebas aprobadas en 8 archivos.
- `cargo test`: 27 pruebas aprobadas.
- `npm.cmd run build`, `cargo check`, Clippy con warnings como errores y
  formato: aprobados.
- `npm.cmd run tauri:build`: aprobado; ejecutable generado en
  `src-tauri/target/release/soundbender-tagdeck.exe`.

## 2026-06-12 - Cola de Explorador, géneros y drag & drop

- El Explorador genera una cola aleatoria en memoria al entrar o cambiar de
  criterio y la consume sin volver a consultar la primera canción.
- Las canciones mostradas se guardan en historial de sesión; saltar, guardar
  o avanzar no reintroduce canciones ya vistas. `Anterior` conserva su
  comportamiento y permite regresar explícitamente.
- Al agotarse la sesión se muestra `No quedan canciones pendientes para este
  criterio.` y el reproductor se detiene.
- Se añadió el selector múltiple `Géneros` con 25 opciones rápidas y texto
  libre. Los valores se normalizan con `; `.
- `Guardar y siguiente` escribe primero Genre mediante el flujo seguro
  existente de metadatos: copia temporal, validación, backup, sustitución,
  relectura, refresco SQLite e historial. Si falla, no avanza ni guarda una
  curaduría incoherente.
- Mood, tags internos, notas, siguiente acción, parte fuerte, problema
  principal y uso previsto siguen sin escribirse en el archivo musical.
- Genre se incluye en resúmenes de biblioteca y exportaciones CSV/JSON de
  biblioteca y listas.
- Las filas de Listas son arrastrables y muestran un asa visual. El drop
  persiste el orden completo en una transacción SQLite; subir/bajar permanece
  como alternativa.
- La persistencia del orden se prueba tras cerrar y reabrir SQLite, y la cola
  activa del reproductor se actualiza con el nuevo orden.
- La revisión visual con datos simulados confirmó inicio aleatorio, varios
  saltos sin repetición, selector de géneros, mensaje de fin de cola, filas
  arrastrables, ausencia de mojibake y ausencia de desbordamiento global.
- `npm.cmd run test`: 18 pruebas aprobadas en 8 archivos.
- `cargo test`: 27 pruebas aprobadas.
- `npm.cmd run build`, `cargo check`, Clippy con warnings como errores y
  formato: aprobados.
- `npm.cmd run tauri:build`: aprobado; ejecutable actualizado en
  `src-tauri/target/release/soundbender-tagdeck.exe`.

## 2026-06-12 - Beta 1.06 Modo Reproductor / Sesión

- Se añadió `Sesión` al menú principal y accesos `Abrir en Modo Sesión`
  desde Biblioteca, Organización y Explorador.
- Las listas incluyen `Reproducir lista en Modo Sesión` y conservan su orden
  exacto para Anterior, Siguiente y la cola inicial.
- La nueva vista muestra pista actual, datos creativos, reproductor grande,
  acciones rápidas, sugerencias afines y cola temporal.
- El motor de afinidad pondera proyecto, género idéntico o compatible, mood,
  tags, rating, estado y uso previsto.
- Por defecto se excluyen canciones archivadas, ratings de 1 a 3, canciones
  ya reproducidas y canciones ya presentes en la cola. La UI permite incluir
  voluntariamente reproducidas o ratings bajos.
- La cola permite añadir sugerencias, reproducir ahora, avanzar, retroceder,
  retirar, vaciar y guardarse como lista interna de tipo `session`.
- El reproductor avanza automáticamente al siguiente elemento de la cola
  cuando termina una pista.
- Desde la sesión se puede cambiar rating, marcar Radio Ready, Release Ready
  o Archivada, añadir la pista actual o una sugerencia a una lista y abrir la
  canción en Biblioteca u Organización.
- Las listas de sesión usan la exportación CSV/JSON ya existente para todas
  las playlists.
- Las pruebas frontend cubren pesos y prioridad de afinidad, géneros
  compatibles, exclusión de archivadas/rating bajo/reproducidas, orden de
  playlist, añadir y quitar de cola y guardado como lista `session`.
- La revisión visual manual confirmó la nueva entrada lateral, la navegación
  y el estado vacío. La rejilla principal se ajustó para caber en 1280 px.
  Los flujos con canciones se verificaron mediante componentes porque
  `invoke` solo está disponible dentro del runtime Tauri.
- `npm.cmd test -- --run`: 25 pruebas aprobadas en 10 archivos.
- `cargo test`: 27 pruebas aprobadas.
- `npm.cmd run build`, `cargo check`, Clippy con warnings como errores y
  `cargo fmt -- --check`: aprobados.
- `npm.cmd run tauri:build`: aprobado; ejecutable actualizado en
  `src-tauri/target/release/soundbender-tagdeck.exe`.

## 2026-06-13 - Buscador avanzado en Modo Sesión

- Se añadió un buscador visible sobre `Sugerencias afines`. Al escribir,
  el panel cambia a resultados; al limpiar, recupera las sugerencias sin
  modificar la cola.
- El selector permite buscar en todos los campos o específicamente en título,
  artista, álbum, género, mood, tags, proyecto, versión, estado, rating, uso
  previsto, parte fuerte, problema principal, siguiente acción, notas y ruta.
- La búsqueda admite coincidencia parcial, varias palabras, mayúsculas y
  minúsculas indistintas y equivalencia flexible de acentos.
- Todas las palabras escritas deben aparecer en el campo seleccionado; en
  `Todos los campos` pueden estar repartidas entre distintos metadatos.
- Las canciones archivadas se excluyen por defecto y pueden incluirse con un
  control específico mientras la búsqueda está activa.
- Cada resultado muestra título, artista, álbum/proyecto, rating, estado,
  género, mood, tags y duración.
- Desde cada resultado se puede reproducir ahora, añadir a cola, añadir a
  lista y abrir la canción en Organización o Biblioteca.
- La búsqueda trabaja sobre la biblioteca ya cargada en memoria y no añade
  migraciones, escrituras en SQLite ni cambios en archivos musicales.
- Las pruebas cubren todos los campos, acentos, coincidencia parcial, varias
  palabras, búsqueda global, exclusión de archivadas, cola, reproducción,
  diálogo de listas, navegación y retorno a sugerencias al limpiar.
- La revisión visual confirmó la navegación y el estado vacío del Modo Sesión.
  El panel con canciones se verificó mediante pruebas de componentes porque
  `invoke` solo está disponible dentro del runtime Tauri.
- `npm.cmd test -- --run`: 45 pruebas aprobadas en 11 archivos.
- `cargo test`: 27 pruebas aprobadas.
- `npm.cmd run build`, `cargo check`, Clippy con warnings como errores y
  `cargo fmt -- --check`: aprobados.
- `npm.cmd run tauri:build`: aprobado; ejecutable actualizado en
  `src-tauri/target/release/soundbender-tagdeck.exe`.

## 2026-06-13 - Pulido visual dark premium

- Se centralizó la paleta visual en tokens CSS para fondo de aplicación,
  sidebar, paneles, tarjetas, controles, bordes y niveles de texto.
- El fondo principal cambió a gris carbón `#15181d`; paneles y tarjetas usan
  escalones progresivos más claros para evitar el aspecto negro y plano.
- Sidebar, cabeceras, inspector, tablas, modales, Explorador, Listas, Sesión y
  reproductor inferior usan superficies semánticas compartidas.
- Inputs, selects y textareas tienen fondo elevado, bordes más visibles,
  placeholders legibles y esquema oscuro coherente.
- Los botones secundarios ganaron borde, fondo sutil y estado hover; el verde
  lima se mantiene reservado a acciones primarias, reproducción y selección.
- Las tablas muestran cabeceras elevadas, hover más claro y selección mediante
  fondo lima tenue y una línea lateral, sin saturar toda la fila.
- Modo Sesión recibió separación clara entre canción actual, buscador,
  sugerencias y cola, con tarjetas elevadas y controles de reproducción sobre
  una superficie diferenciada.
- Se suavizaron overlays, scrollbar y textos secundarios para mejorar sesiones
  largas sin convertir la aplicación en modo claro.
- La revisión visual manual cubrió Biblioteca, Tags, Organización, Explorador,
  Listas, Modo Sesión, sidebar de Ajustes y reproductor inferior a 1280x720.
  No se detectaron textos ilegibles, bordes perdidos ni desbordes nuevos.
- `npm.cmd test -- --run`: 45 pruebas aprobadas en 11 archivos.
- `cargo test`: 27 pruebas aprobadas.
- `npm.cmd run build`, `cargo check`, Clippy con warnings como errores y
  `cargo fmt -- --check`: aprobados.
- `npm.cmd run tauri:build`: aprobado; ejecutable actualizado en
  `src-tauri/target/release/soundbender-tagdeck.exe`.

## 2026-06-13 - Beta 1.1 Ajustes y personalización

- La entrada `Ajustes` abre un centro real con Apariencia, Biblioteca,
  Reproductor, Explorador, Sesión, Listas, Metadatos, Exportación, Datos y
  seguridad y Acerca de.
- La migración `0007_app_settings.sql` guarda un documento de preferencias
  versionado en SQLite. Los campos ausentes o inválidos se normalizan contra
  valores seguros y el backup previo a escritura no puede desactivarse.
- Apariencia permite Dark Studio u oscuro actual, tres densidades de interfaz,
  tres tamaños de texto y mantiene el verde lima como acento.
- Biblioteca aplica límites de 500, 1000 o 2000 canciones, columnas visibles,
  último filtro, última carpeta escaneada y orden de listas creadas desde el
  filtro.
- El reproductor aplica volumen inicial/recordado, doble clic, umbral de
  play count, acción al terminar y visibilidad de la barra inferior.
- Explorador aplica criterio inicial, cola aleatoria, ocultación de archivadas,
  autoplay al cargar/guardar/saltar, confirmación de archivo y confirmación
  antes de escribir Genre. Guardar puede configurarse para no marcar revisada.
- Sesión aplica exclusiones, rating mínimo, prioridades de afinidad, inclusión
  de reproducidas y comportamiento al terminar la cola.
- Listas aplica confirmaciones de borrado/retirada. La prevención de
  duplicados permanece obligatoria por integridad de SQLite.
- CSV/JSON de biblioteca y CSV de listas aplican separador, ruta, datos
  internos, datos técnicos y curaduría. Se recuerda la carpeta y puede
  revelarse el archivo exportado.
- Datos y seguridad muestra rutas y contadores, abre datos/backups/logs, crea
  backups consistentes de SQLite con `VACUUM INTO` y exporta diagnóstico JSON.
  La restauración automática queda desactivada mientras la base está abierta.
- La revisión visual a 1280x720 confirmó Ajustes y las pantallas principales
  sin desbordamiento global. Tema, tamaño de texto y ocultación del player se
  aplican inmediatamente.
- `npm.cmd run test`: 49 pruebas aprobadas en 12 archivos.
- `cargo test`: 29 pruebas aprobadas.
- `npm.cmd run build`, `cargo check`, Clippy con warnings como errores y
  `cargo fmt -- --check`: aprobados.
- `npm.cmd run tauri:build`: aprobado; ejecutable generado en
  `src-tauri/target/release/soundbender-tagdeck.exe`.

## 2026-06-14 - Beta 1.2 Transferencia y restauración

- La versión pasa a `1.2.0-beta.1`; el MSI usa la versión técnica `1.2.0`.
- Se mantienen `live.soundbender.tagdeck`, el nombre del producto y el Upgrade
  Code de WiX para conservar instalación y datos al actualizar.
- Listas permite arrastrar todos sus archivos o la selección fuera de TagDeck
  en modo copia, además de `Copiar lista a carpeta`.
- La copia explícita conserva el orden con prefijos numéricos, evita
  sobrescrituras y resume archivos ausentes o fallidos.
- Modo Sesión carga listas existentes como cola activa respetando el orden.
- Ajustes incorpora importación CSV/JSON con previsualización, coincidencia por
  ruta, nombre o título/artista/duración, modo seguro y sobrescritura.
- Toda importación aplicada crea primero un backup SQLite. Los datos creativos
  y el género importado permanecen solo en SQLite.
- La importación nunca crea canciones y puede reconstruir listas exportadas.
- La migración `0008_scan_roots.sql` registra raíces de escaneo. Explorador
  puede limitar su cola a una raíz o subcarpeta detectada.
- Pruebas añadidas para copia ordenada, colisiones, archivos ausentes, parser
  CSV/JSON, importación segura, no duplicación, listas, carga en Sesión y
  filtro de Explorador por carpeta.
- `npm.cmd run test`: 55 pruebas aprobadas en 13 archivos.
- `cargo test`: 36 pruebas aprobadas.
- `npm.cmd run build`, `cargo check`, Clippy con warnings como errores y
  `cargo fmt -- --check`: aprobados.
- La revisión visual manual confirmó el selector Carpeta, Ajustes, la entrada
  de importación, el diálogo y la versión sin desbordes visibles.
- `npm.cmd run tauri:build`: aprobado; generó MSI y NSIS en
  `src-tauri/target/release/bundle`.

## 2026-06-16 - Beta 1.3 Biblioteca avanzada y paneles

- La versión pasa a `1.3.0-beta.1`; el MSI usa la versión técnica `1.3.0`.
- Biblioteca registra su contexto visible en el reproductor. Al terminar una
  canción puede detenerse, repetir, avanzar en orden o reproducir otra canción
  aleatoria del contexto actual.
- La reproducción aleatoria mantiene una cola de sesión e historial en memoria
  para evitar repeticiones inmediatas hasta agotar el contexto filtrado.
- El botón Siguiente del reproductor usa el modo de Biblioteca activo; Anterior
  usa historial cuando existe.
- Ajustes > Reproductor incorpora `Al terminar canción en Biblioteca` y
  `Evitar repetir en sesión de Biblioteca`, con valores seguros por defecto.
- El inspector de Biblioteca permite edición inline de metadatos simples del
  archivo mediante `updateTrackMetadata`, conservando backup, validación,
  refresco SQLite e historial.
- El mismo inspector permite editar inline campos internos: estado, proyecto,
  versión, tags, siguiente acción, notas, parte fuerte, problema principal,
  uso previsto y mood. Estos cambios permanecen solo en SQLite.
- Biblioteca ofrece controles para ocultar/mostrar inspector y activar modo
  enfoque. El sidebar puede estar expandido, contraído u oculto desde Ajustes
  o desde el propio layout.
- Ajustes > Biblioteca controla columnas visibles: pista, título, artista,
  álbum, artista del álbum, género, año, rating, estado, proyecto, versión,
  tags, mood, duración, formato, BPM, tonalidad, play count, siguiente acción,
  ruta, fecha de revisión y uso previsto.
- La tabla de Biblioteca trae ahora en los resúmenes `album_artist`, `bpm`,
  `musical_key` y `play_count`, y permite ordenar por los nuevos campos
  soportados.
- Los botones CSV/JSON permanentes se retiraron de la cabecera de Biblioteca.
  Ajustes > Exportación concentra exportación completa, filtro actual y lista
  seleccionada en CSV/JSON, respetando carpeta recordada y opciones de campos.
- CSV/JSON de biblioteca incluyen `album_artist` y, cuando se activan datos
  técnicos, también BPM, tonalidad y play count.
- Se añadieron pruebas frontend para reproducción aleatoria, columnas visibles
  e inspector inline.
- `npm.cmd run test`: 61 pruebas aprobadas en 15 archivos.
- `npm.cmd run build`: aprobado.
- `cargo test`: 36 pruebas aprobadas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- `cargo fmt -- --check`: aprobado.

## 2026-06-30 - Hotfix visual campos claros en organizacion interna

- Se corrigen los estilos del bulk editor de Organizacion interna para evitar
  que inputs, selects y textareas pasen a fondo negro al autoactivar Apply.
- Los controles usan ahora clases/tokens semanticos de la app (`field`,
  `--color-card`, `--color-border`, `--color-text`, `--color-accent`) para
  respetar tema claro y oscuro.
- Los chips y contenedores de tags/mood/curaduria usan fondo y borde del tema,
  manteniendo contraste sin hardcodear negro.
- Se anade test de UI que valida que Version y Notes no reciben clases de fondo
  negro al editarse y activar Apply.
- `npm.cmd run test`: 407 pruebas aprobadas en 53 archivos.
- `npm.cmd run build`: aprobado.
- `cargo test`: 60 pruebas aprobadas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- `cargo fmt -- --check`: aprobado.

## 2026-06-30 - Hotfix UX autoactivar Apply en organizacion interna

- El bulk editor de Organizacion interna ya permite editar directamente campos
  sin marcar Apply antes.
- Cualquier cambio real en rating, estado, proyecto, version, modelo, idioma,
  tags internos, mood, parte fuerte, problema principal, uso previsto, siguiente
  accion o notas marca automaticamente Apply.
- Los campos no aplicados ya no se muestran como deshabilitados fuertes; quedan
  interactivos con estilo ligeramente inactivo.
- Crear proyecto desde el modal lo anade localmente al selector y lo asigna sin
  esperar a que el padre recargue opciones.
- Se anaden tests de UI para autoactivar Apply, desmarcar Apply y limpiar campos
  con valor vacio aplicado.
- `npm.cmd run test`: 406 pruebas aprobadas en 53 archivos.
- `npm.cmd run build`: aprobado.
- `cargo test`: 60 pruebas aprobadas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- `cargo fmt -- --check`: aprobado.

## 2026-06-30 - UX bulk editor de organizacion interna

- Se rehace el editor multiple de Organizacion interna para usar el mismo patron
  que el editor multiple de metadata: checkbox Aplicar + campo deshabilitado si
  no esta marcado.
- Se eliminan los dropdowns Leave unchanged / Set / Clear del modal.
- En bulk, marcar Aplicar modifica el campo; dejar el control vacio limpia el
  valor. Los campos no marcados no se tocan.
- Proyecto mantiene selector existente y creacion rapida con boton `+`.
- Tags, mood, parte fuerte, problema principal y uso previsto usan chips
  compactos y se guardan como valores internos de SQLite.
- Se amplia `OrganizationPatch` para cubrir parte fuerte, problema principal y
  uso previsto sin escribir archivos musicales.
- `npm.cmd run test`: 402 pruebas aprobadas en 52 archivos.
- `npm.cmd run build`: aprobado.
- `cargo test`: 60 pruebas aprobadas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- `cargo fmt -- --check`: aprobado.

## 2026-06-21 - Modo Sesion controles junto a portada

- Modo Sesion adopta la misma distribucion visual que Explorador para la ficha
  de cancion actual: portada/placeholder a la izquierda y Rating, Estado,
  Modelo y Proyecto a la derecha.
- Se eliminan duplicados de Rating y Estado bajo el reproductor, y los badges de
  Proyecto/Estado dejan de repetirse en los chips.
- Rating se guarda con `updateTrackRating`; Estado y Proyecto con
  `updateTrackOrganization`; Modelo se guarda como `generation_model` mediante
  `saveCuration`.
- Modelo y Proyecto siguen siendo datos internos de SQLite y no se escriben en
  archivos musicales.
- Se anade test frontend para layout, ausencia de duplicados y persistencia de
  Rating, Estado, Modelo y Proyecto desde Modo Sesion.
- No se genero instalador ni se ejecuto `npm.cmd run tauri:build`.
- `npm.cmd run test`: 88 pruebas aprobadas en 16 archivos.
- `npm.cmd run build`: aprobado.
- `cargo test`: 38 pruebas aprobadas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- `cargo fmt -- --check`: aprobado.

## 2026-06-21 - Explorador controles junto a portada

- Se corrige definitivamente la zona superior de la tarjeta izquierda del
  Explorador: la portada/placeholder queda a la izquierda y Rating, Estado y
  Modelo quedan en un bloque a su derecha.
- Titulo, artista, album, chips, ruta, reproductor y botones quedan debajo de
  esa zona superior.
- El layout usa un grid responsive: en anchura normal mantiene dos columnas y
  en estrecho puede apilarse.
- Se mantiene `Modelo` como campo interno `generation_model`, editable con
  datalist para seleccionar modelos existentes o escribir nuevos.
- El panel derecho no contiene duplicados de Rating, Estado ni Modelo.
- Se actualiza el test frontend para verificar que portada precede al bloque
  de controles y que Modelo queda antes del titulo y del reproductor.
- Revision visual realizada con la app React real en dev server y mock Tauri
  temporal, eliminado al terminar:
  - Tema oscuro `studio`: portada en x=268.8, controles en x=454.8, titulo por
    debajo en y=400.2.
  - Tema claro `soundbender-light`: misma geometria y contraste legible.
  - Prueba funcional visual: cambiar Rating a 7, Estado a Idea, Modelo a
    `Suno v4.5` y pulsar `Guardar` mantuvo la misma cancion.
- No se genero instalador ni se ejecuto `npm.cmd run tauri:build`.
- `npm.cmd run test`: 86 pruebas aprobadas en 16 archivos.
- `npm.cmd run build`: aprobado.
- `cargo test`: 38 pruebas aprobadas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- `cargo fmt -- --check`: aprobado.

## 2026-06-20 - Correccion Explorador Rating Estado Modelo

- Se corrige la ubicacion real de los controles de Explorador: Rating, Estado y
  Modelo se renderizan ahora en la columna izquierda, debajo del reproductor y
  encima de `Guardar`, `Guardar y siguiente` y `Saltar por ahora`.
- Se eliminan los duplicados de Rating, Estado y Modelo del panel derecho; el
  editor derecho empieza con Proyecto y Version, seguido por el resto de campos
  creativos.
- `Modelo` conserva seleccion desde modelos existentes y escritura libre
  mediante `datalist`, guardandose como `generation_model` solo en SQLite.
- La importacion CSV/JSON reconoce `model`, `modelo` y `generation_model`, y la
  vista previa/aplicacion de importacion trata Modelo igual que otros campos
  internos.
- Se refuerzan tests frontend para comprobar ubicacion izquierda, ausencia de
  duplicados en el panel derecho, guardado sin avance y persistencia de Rating,
  Estado y Modelo.
- Se refuerza test Rust de importacion/restauracion para verificar persistencia
  de `generation_model`.
- No se genero instalador ni se ejecuto `npm.cmd run tauri:build`.
- `npm.cmd run test`: 86 pruebas aprobadas en 16 archivos.
- `npm.cmd run build`: aprobado.
- `cargo test`: 38 pruebas aprobadas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- `cargo fmt -- --check`: aprobado.

## 2026-06-20 - Ajuste final orden Explorador

- Se reubican Rating, Estado y Modelo dentro de la tarjeta izquierda del
  Explorador justo despues de la ruta del archivo y antes del reproductor.
- El orden visual queda: ficha de cancion, chips, ruta, Rating/Estado, Modelo,
  reproductor, `Guardar`, `Guardar y siguiente` y `Saltar por ahora`.
- Se mantiene Modelo como campo interno `generation_model` con datalist para
  seleccionar valores existentes o escribir uno nuevo.
- Se actualiza el test frontend para verificar el orden DOM exacto: Rating y
  Modelo aparecen antes del progreso del reproductor, y el reproductor antes de
  `Guardar`.
- No se tocaron Biblioteca, Organizacion, Sesion ni Listas en esta correccion.
- No se genero instalador ni se ejecuto `npm.cmd run tauri:build`.
- `npm.cmd run test`: 86 pruebas aprobadas en 16 archivos.
- `npm.cmd run build`: aprobado.
- `cargo test`: 38 pruebas aprobadas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- `cargo fmt -- --check`: aprobado.

## 2026-06-19 - Entrega final beta 1.3.0-beta.4 selector de carpeta comun

- Cierre de trazabilidad de la entrega: selector de carpeta disponible en
  Biblioteca, Explorador y Modo Sesion.
- Biblioteca filtra tabla, busqueda, rating, contador, contexto de reproduccion
  y exportacion de filtro actual por `folderPath`.
- Modo Sesion limita sugerencias y busqueda manual por carpeta, manteniendo las
  listas cargadas completas aunque mezclen rutas.
- Los selectores solo reciben carpetas con canciones (`track_count > 0`) y
  vuelven a "Toda la biblioteca" si la carpeta activa desaparece.
- Version final de instalador: `1.3.0-beta.4`.
- `npm.cmd run test`: 83 pruebas aprobadas en 16 archivos.
- `npm.cmd run build`: aprobado.
- `cargo test`: 38 pruebas aprobadas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- `cargo fmt -- --check`: aprobado.
- `npm.cmd run tauri:build`: aprobado. Instaladores:
  `src-tauri\target\release\bundle\nsis\Soundbender TagDeck_1.3.0-beta.4_x64-setup.exe`
  y `src-tauri\target\release\bundle\msi\Soundbender TagDeck_1.3.0-beta.4_x64_es-ES.msi`.

## 2026-06-30 - Hotfix Modo Sesion mantiene cola al cargar playlist

- Se corrige la hidratacion inicial de `SessionView` para que no vuelva a
  inicializar cola/lista activa cuando cambia la identidad del callback de
  reproduccion tras empezar a sonar una pista.
- `loadPlaylistIntoSession(playlistId)` sigue reemplazando la sesion completa de
  forma explicita: carga todas las pistas, reproduce la primera y mantiene el
  resto como cola pendiente.
- `playNow` deja de limpiar la cola por defecto y conserva la lista activa al
  reproducir resultados de busqueda o sugerencias manualmente.
- Solo las acciones explicitas de cola modifican la cola: vaciar cola, cargar
  otra playlist, avanzar en cola o hacer click sobre una pista ya en cola.
- Se anade prueba frontend para cargar una playlist, reproducir una cancion
  manual desde busqueda y confirmar que la lista activa y la cola se conservan.
- No se genera instalador ni `tauri:build` en este hotfix.
- `npm.cmd run test`: 408 pruebas aprobadas en 53 archivos.
- `npm.cmd run build`: aprobado.
- `cargo test`: 60 pruebas aprobadas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- `cargo fmt -- --check`: aprobado.

## 2026-06-30 - Hotfix Modo Sesion no queda en Preparing session

- Se corrige la preparacion inicial de `SessionView`: el estado `loading` ahora
  se cierra siempre desde un `finally`, incluso si React ejecuta el efecto dos
  veces en modo estricto o si la carga falla.
- Se elimina el guard de hidratacion que podia marcar una sesion como preparada
  antes de completar la carga real, dejando la pantalla bloqueada en
  "Preparing session...".
- La preparacion depende solo de una clave estable de pista/cola inicial y del
  boton manual de reintento; no depende del player ni de cambios de pista.
- Se anade mensaje de error recuperable con boton `Reintentar` para volver a
  preparar la sesion sin reiniciar la app.
- Se anaden pruebas para StrictMode, biblioteca vacia y error de preparacion con
  reintento.
- Vitest excluye carpetas de entrega (`github_upload`, `distribution`,
  `release`) para no ejecutar tests de copias publicadas dentro del workspace.
- No se genera instalador ni `tauri:build`.
- `npm.cmd run test`: 210 pruebas aprobadas en 27 archivos.
- `npm.cmd run build`: aprobado.
- `cargo test`: 60 pruebas aprobadas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- `cargo fmt -- --check`: aprobado.

## 2026-06-30 - Hotfix UI Explorer criterio All duplicado

- Se corrige el selector `Criterion` de Explorer para que `All` aparezca una
  sola vez y como primera opcion.
- Se mantiene el criterio interno `random`, pero deja de mostrarse como `All` y
  pasa a usar la etiqueta traducida `Random` / `Aleatorias`.
- La lista de criterios se deduplica por `value` antes de renderizar, evitando
  duplicados futuros si se vuelve a construir desde varias fuentes.
- Se anade prueba frontend que verifica valores unicos, `all` primero, `all`
  una sola vez, etiqueta de `random` diferenciada y carga correcta del criterio
  `all`.
- No se genera instalador ni `tauri:build`.
- `npm.cmd run test`: 211 pruebas aprobadas en 27 archivos.
- `npm.cmd run build`: aprobado.
- `cargo test`: 60 pruebas aprobadas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- `cargo fmt -- --check`: aprobado.

## 2026-06-30 - Biblioteca: editor de organizacion interna y limite 20k

- Se anade un editor propio de Organizacion interna en Biblioteca, separado del
  editor de metadatos reales del archivo.
- El editor permite modo individual y masivo para rating, estado, proyecto,
  version, tags internos, mood, idioma, modelo, notas y siguiente accion.
- En edicion masiva se soportan modos sin cambios / definir / limpiar; tags con
  anadir / quitar / reemplazar; y notas / siguiente accion con reemplazar o
  anadir al final.
- Los cambios se guardan solo en SQLite mediante `update_track_organization`;
  no se invoca escritura de metadatos ni se modifican archivos musicales.
- Se anade el campo interno `language` a SQLite, tipos, importacion/exportacion
  CSV/JSON y backup restaurable.
- Se amplian los limites visibles de Biblioteca a 1000, 5000, 10000 y 20000,
  con aviso de rendimiento para 10k/20k y backend capado a 20000.
- Se anaden indices para mood, language, generation_model, updated_at y tags.
- Git no esta disponible en PATH en esta sesion, asi que no se genera diff/status
  por Git.
- `npm.cmd run test`: 402 pruebas aprobadas en 52 archivos.
- `npm.cmd run build`: aprobado.
- `cargo test`: 60 pruebas aprobadas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- `cargo fmt -- --check`: aprobado.

## 2026-06-25 - Hotfix Export/Import Settings y rutas reales

- Los exports de biblioteca y playlists devuelven ahora recuento y ruta real
  del archivo generado, para confirmar claramente donde se guardo cada salida.
- El backend acepta como destino una carpeta en exports CSV/JSON/manifest/
  diagnostics y genera automaticamente un nombre de archivo con timestamp; si
  falta extension, la anade segun el formato.
- Ajustes muestra confirmacion de exportacion, ruta guardada y acceso para abrir
  la ubicacion del ultimo archivo exportado.
- La seccion de Ajustes agrupa exportacion e importacion de datos; la
  importacion CSV/JSON mantiene vista previa obligatoria y aplica solo datos
  internos SQLite.
- Los exports de biblioteca incluyen identificadores estables (`stable_id`) y
  ruta relativa cuando corresponde; los exports de playlists incluyen
  `track_stable_id` junto a orden, playlist y datos creativos.
- El import CSV/JSON reconoce `stable_id`, `track_stable_id` y `relative_path`.
  El emparejamiento prioriza stable_id, despues ruta exacta y despues ruta
  relativa antes de los fallbacks existentes.
- No se escriben tags reales en archivos musicales durante import/export de
  datos internos.
- `npm.cmd run test`: aprobado en repeticion final, 183 pruebas en 24 archivos.
- `npm.cmd run build`: aprobado.
- `cargo test`: aprobado, 48 pruebas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- `cargo fmt -- --check`: aprobado despues de formatear.
- No se ejecuto `npm.cmd run tauri:build`; no se genero instalador.

## 2026-06-25 - Hotfix Export sin falsos positivos

- Se sustituye la escritura directa con `std::fs::write` por una ruta comun de
  exportacion verificada: escribir a `.tmp`, `flush`, `sync_all`, cerrar,
  validar tamano temporal, renombrar y validar el archivo final con metadata.
- Biblioteca, playlists, manifest, diagnostics y los archivos auxiliares de
  export packs usan la nueva verificacion antes de devolver exito.
- Los comandos de exportacion devuelven ahora ruta real, nombre de archivo y
  bytes verificados. La UI solo muestra `Saved to` / `Guardado en` despues de
  recibir esa confirmacion del backend.
- Ajustes muestra el tamano del archivo exportado y el boton cambia a
  `Show exported file` / `Mostrar archivo exportado` para archivos reales.
- Si la ruta final no existe, no es archivo, esta vacia o no se puede leer, el
  backend devuelve error y elimina el temporal.
- Se anaden pruebas para archivo real exportado con tamano y rechazo de export
  vacio/fallido.
- `npm.cmd run test`: aprobado, 183 pruebas en 24 archivos.
- `npm.cmd run build`: aprobado.
- `cargo test`: aprobado, 50 pruebas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- `cargo fmt -- --check`: aprobado despues de formatear.
- No se ejecuto `npm.cmd run tauri:build`; no se genero instalador.

## 2026-06-25 - QoL Library atajos rapidos

- Biblioteca soporta atajos rapidos de rating: `1-9` asignan rating 1-9 y `0`
  asigna rating 10 cuando hay fila activa o canciones marcadas.
- El rating rapido se aplica a todas las canciones marcadas; si no hay checks,
  se aplica a la fila activa.
- `ArrowUp` y `ArrowDown` mueven la fila activa por las canciones visibles y la
  tabla virtualizada hace scroll para mantenerla en pantalla.
- `Enter` reproduce la fila activa usando la logica existente de Biblioteca.
- `Ctrl+A` selecciona las canciones visibles cargadas en la vista actual y
  `Esc` limpia los checks sin parar el reproductor ni borrar filtros.
- Los atajos se ignoran dentro de inputs, selects, textareas, comboboxes,
  dialogos y contenido editable.
- Se actualiza la ayuda de atajos EN/ES y los mensajes de rating/seleccion.
- `npm.cmd run test`: aprobado, 187 pruebas en 24 archivos.
- `npm.cmd run build`: aprobado.
- `cargo test`: aprobado, 50 pruebas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- `cargo fmt -- --check`: aprobado.
- No se ejecuto `npm.cmd run tauri:build`; no se genero instalador.

## 2026-06-25 - Hotfix edicion de Unsynced Lyrics

- El inspector derecho de Biblioteca muestra ahora `Letras no sincronizadas`
  como textarea editable dentro de `File Metadata`, con botones `Guardar letra`
  y `Limpiar`.
- `Limpiar` solo borra el borrador; el archivo no se modifica hasta pulsar
  `Guardar letra`.
- El guardado usa el callback seguro existente de metadata real y envia
  `unsyncedLyrics` al backend, reutilizando backup, escritura temporal,
  relectura y verificacion ya implementados en Rust.
- Biblioteca muestra confirmacion especifica `Letra guardada de forma segura`
  cuando el patch guardado es de lyrics.
- Explorer mantiene los workflows de metadata/release con `lyrics` editable y
  lo guarda como `unsyncedLyrics`; se alinea la lectura del campo con los datos
  disponibles en `TrackDetails`.
- Se anaden textos i18n EN/ES para guardar letras, cambios pendientes, error de
  guardado y formato no soportado.
- `npm.cmd run test`: aprobado, 190 pruebas en 24 archivos.
- `npm.cmd run build`: aprobado.
- `cargo test`: aprobado, 50 pruebas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- `cargo fmt -- --check`: aprobado.
- No se ejecuto `npm.cmd run tauri:build`; no se genero instalador.

## 2026-06-25 - Hotfix shortcuts rating 10 vs zoom reset

- Se cambia el contrato de `panelZoomActionFromKey`: `0` ya no resetea zoom por
  si solo; el reset requiere `Ctrl+0`.
- En Explorer, `0` asigna rating 10 y no modifica el zoom del panel derecho.
- En Library, `0` mantiene el comportamiento de rating 10 y `Ctrl+0` resetea
  el zoom del inspector.
- `+` y `-` siguen controlando zoom de panel derecho.
- Los atajos siguen ignorandose dentro de inputs, selects, textareas,
  dropdowns, dialogs y campos editables.
- Se actualizan ayudas de shortcuts/guia rapida en EN/ES para indicar
  `0 = rating 10` y `Ctrl+0 = reset zoom`.
- Se anaden pruebas para Explorer `0` rating 10, no reset de zoom, y `Ctrl+0`
  reset; Library usa `Ctrl+0` para reset.
- `npm.cmd run test`: aprobado, 191 pruebas en 24 archivos.
- `npm.cmd run build`: aprobado.
- `cargo test`: aprobado, 50 pruebas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- `cargo fmt -- --check`: aprobado.
- No se ejecuto `npm.cmd run tauri:build`; no se genero instalador.

## 2026-06-25 - Hotfix Explorer Workflow Presets metadatos reales editables

- Los campos reales de metadatos en los presets de Explorer, especialmente
  `Metadata Cleanup` y `Release Prep`, pasan de solo lectura a inputs
  editables dentro de la ficha de workflow.
- `Guardar` y `Guardar y siguiente` construyen un `MetadataPatch` con solo los
  cambios reales y lo envian por `api.updateTrackMetadata`, reutilizando el
  flujo seguro existente con backup y validacion.
- Si falla la escritura segura de metadatos, Explorer muestra el error y no
  avanza de cancion.
- Los campos creativos internos como Mood, Tags, Estado, Proyecto, Version,
  Notas y Modelo siguen guardandose solo en SQLite mediante `saveCuration`.
- La caratula se muestra como dato no editable en esta ficha con ayuda
  explicita para evitar una ruta incompleta de escritura de archivos.
- Se anaden textos EN/ES para cambios pendientes de metadatos, fallo de
  escritura segura, placeholder de letras y ayuda de caratula.
- `npm.cmd run test -- src/features/explorer/ExplorerView.test.tsx`: 37
  pruebas aprobadas.
- `npm.cmd run test -- src/i18n/i18n.test.ts`: 11 pruebas aprobadas.
- `npm.cmd run test`: 181 pruebas aprobadas en 24 archivos.
- `npm.cmd run build`: aprobado.
- `cargo test`: 45 pruebas aprobadas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado; cargo mostro un
  aviso externo de canonicalizacion de ruta, sin fallos ni warnings de codigo.
- `cargo fmt -- --check`: aprobado.

## 2026-06-25 - Hotfix Explorer Next/Previous reproducen tras avanzar

- `Next` en Explorador ahora carga la siguiente cancion y llama a reproduccion
  con contexto `explorer` y razon `explorer_next_button`.
- `Previous` vuelve a la cancion anterior y reproduce con razon
  `explorer_previous_button`.
- `Guardar y siguiente` y `Saltar por ahora` avanzan y reproducen siempre tras
  una accion explicita correcta, sin depender de efectos de carga ni del ajuste
  antiguo de autoplay.
- Se evita reintroducir el autoavance infinito: la carga inicial, re-render,
  cambios de estado del Player y audio terminado siguen sin avanzar ni
  reproducir por si solos.
- Si falla `playTrack`, la cancion queda cargada visualmente, se muestra un
  error traducido y no se salta automaticamente a otra.
- Se actualiza el tipo `PlayReason` con `explorer_previous_button` y los textos
  EN/ES para fallo de reproduccion.
- `npm.cmd run test -- src/features/explorer/ExplorerView.test.tsx`: 39
  pruebas aprobadas.
- `npm.cmd run test -- src/features/library/LibraryView.test.tsx`: 16 pruebas
  aprobadas.
- `npm.cmd run test`: 183 pruebas aprobadas en 24 archivos.
- `npm.cmd run build`: aprobado.
- `cargo test`: 45 pruebas aprobadas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado; cargo mostro un aviso
  externo de canonicalizacion de ruta, sin fallos ni warnings de codigo.
- `cargo fmt -- --check`: aprobado.

## 2026-06-25 - Hotfix Export/Import Settings y rutas reales

- Los exports de biblioteca y playlists devuelven ahora `count` y `path` real
  escrito por backend, para que la UI confirme la ruta final correcta.
- Backend acepta como destino una carpeta en exports CSV/JSON/manifest/diagnostic
  y genera automaticamente un archivo con nombre seguro y timestamp.
- Settings muestra confirmacion clara de export completado, ruta guardada y
  boton "Open folder / Abrir carpeta" para revelar el resultado.
- Settings agrupa importacion CSV/JSON dentro de la tarjeta de import/export y
  mantiene preview obligatorio antes de aplicar cambios internos.
- Los exports de biblioteca incluyen `stable_id` y `relative_path`; los exports
  de playlists incluyen `track_stable_id` y mantienen el orden.
- Import CSV/JSON reconoce `stable_id`, `track_stable_id` y `relative_path`, y
  el matching prioriza stable id antes de ruta exacta, ruta relativa, nombre,
  title/artist/duration y hash.
- La importacion sigue limitada a datos internos SQLite y no escribe metadatos
  reales en archivos musicales.
- `npm.cmd run test -- src/features/settings/ImportLibraryDialog.test.tsx src/i18n/i18n.test.ts`:
  12 pruebas aprobadas.
- `npm.cmd run test -- src/features/library/LibraryView.test.tsx`: 16 pruebas
  aprobadas.
- `npm.cmd run test`: 183 pruebas aprobadas en 24 archivos.
- `npm.cmd run build`: aprobado.
- `cargo test`: 48 pruebas aprobadas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado; cargo mostro un aviso
  externo de canonicalizacion de ruta, sin fallos ni warnings de codigo.
- `cargo fmt -- --check`: aprobado despues de aplicar `cargo fmt`.

## 2026-06-23 - Mostrar version interna en reproductor y fichas principales

- Se anade el helper `displayTitleWithVersion` para mantener el fallback de
  titulo existente y anadir `versionLabel` solo cuando contiene un valor real.
- El reproductor global inferior muestra ahora `Titulo · version` cuando la
  cancion tiene version interna, sin mostrar `null`, `undefined` ni guiones de
  placeholder.
- Se reutiliza el mismo formato en la ficha actual de Explorador, la ficha
  actual de Modo Sesion y el encabezado del inspector de Biblioteca.
- Se anaden traducciones para el tooltip de version interna:
  `Internal version label` / `Etiqueta interna de versión`.
- No se toca escritura de metadatos ni archivos musicales; `versionLabel` sigue
  siendo dato interno de SQLite/TagDeck.
- No se genera instalador ni se ejecuta `tauri:build`.
- `npm.cmd run test`: 168 pruebas aprobadas en 24 archivos.
- `npm.cmd run build`: aprobado.
- `cargo test`: 45 pruebas aprobadas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- `cargo fmt -- --check`: aprobado.

## 2026-06-24 - Seleccion por rango con Shift en Biblioteca

- Se anade `selectionAnchorTrackId` en Biblioteca para recordar la ultima
  seleccion normal y permitir rangos con Shift.
- `Shift + click` en checkbox selecciona o deselecciona el rango calculado
  sobre `tracks`, la lista visible actual ya filtrada, ordenada y limitada por
  el backend.
- `Shift + click` en una fila tambien selecciona rango, sin depender de indices
  del DOM ni de las filas virtualizadas montadas.
- La seleccion existente fuera del rango se conserva; por ejemplo, una cancion
  marcada antes no se pierde al anadir un rango posterior.
- `Seleccionar todas visibles` limpia el anchor para evitar rangos ambiguos.
- Se anaden pruebas para propagacion de `shiftKey`, rango hacia abajo, rango
  hacia arriba, orden visible actual y consumo de la seleccion por
  `Autonumerar versiones`.
- No se genera instalador ni se ejecuta `tauri:build`.
- `npm.cmd run test`: 172 pruebas aprobadas en 24 archivos.
- `npm.cmd run build`: aprobado.
- `cargo test`: 45 pruebas aprobadas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- `cargo fmt -- --check`: aprobado.

## 2026-06-24 - Preparacion de repositorio publico GitHub

- Se prepara el proyecto para una primera publicacion publica del codigo fuente
  como `soundbender-tagdeck`.
- Se refuerza `.gitignore` para excluir musica, bases SQLite, instaladores,
  builds, caches, logs, export packs, carpetas locales de agente,
  `README_TESTER.txt` e `IMPLEMENTATION_LOG.md`.
- Se sustituye el README interno por un README publico en ingles con propuesta
  de valor, flujo, filosofia local-first, separacion entre metadatos reales e
  informacion creativa interna, desarrollo, roadmap y licencia pendiente.
- Se anaden `CONTRIBUTING.md`, `CHANGELOG.md` y `SECURITY.md`.
- Se crean documentos publicos en `docs/`: vision de producto, local-first,
  modelo de metadatos y roadmap general.
- Se anaden templates de GitHub para bugs, feature requests, feedback de
  testers y pull requests.
- Se anade workflow CI en `.github/workflows/ci.yml` con tests frontend, build
  frontend y checks Rust en Windows, sin generar installers.
- Auditoria local: no se encontraron archivos de audio, bases de datos,
  `.env`, logs, instaladores o zips fuera de rutas ignoradas candidatas.
- Auditoria de secretos basica: sin patrones claros de tokens/claves reales.
- Git y GitHub CLI no estan disponibles en PATH; no se pudo crear ni pushear el
  repositorio desde esta sesion.
- No se crea `LICENSE` hasta confirmar MIT/GPL/AGPL.
- No se ejecuta `tauri:build` ni se generan instaladores.
- `npm.cmd run test`: 172 pruebas aprobadas en 24 archivos.
- `npm.cmd run build`: aprobado.
- `cargo test`: 45 pruebas aprobadas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- `cargo fmt -- --check`: aprobado.

## 2026-06-24 - Hotfix seleccion por rango con checkbox controlado

- Se corrige la seleccion por rango en Biblioteca: el checkbox ya no depende de
  `event.currentTarget.checked` durante `onClick`, que podia no reflejar de
  forma fiable la intencion en un input controlado por React.
- Ahora el click calcula la intencion con el estado actual:
  `!selectedIds.has(track.id)`, conservando `event.shiftKey`.
- `Shift + click` en checkbox vuelve a seleccionar rangos sobre la lista visible
  actual, y el click en fila con Shift mantiene el mismo comportamiento.
- Se ajustan las pruebas para simular el click real de usuario.
- `npm.cmd run test -- src/features/library/TrackTable.test.tsx src/features/library/LibraryView.test.tsx`: 20 pruebas aprobadas.
- `npm.cmd run test`: 172 pruebas aprobadas en 24 archivos.
- `npm.cmd run build`: aprobado.

## 2026-06-24 - Hotfix anchor Shift pisado por focus de checkbox

- Se corrige el caso real en el que al hacer click sobre un checkbox, el evento
  `onFocus` de la fila recibia el foco burbujeado desde el input y llamaba a
  `onSelect`, sobrescribiendo el anchor de seleccion justo antes del
  `Shift+click`.
- `VirtualTrackRow` ignora ahora `onFocus` cuando el foco viene de
  `input`, `select` o `button`.
- Se anaden pruebas que simulan foco en checkbox antes del `Shift+click`, tanto
  en `TrackTable` como en `LibraryView`.
- `npm.cmd run test -- src/features/library/TrackTable.test.tsx src/features/library/LibraryView.test.tsx`: 21 pruebas aprobadas.
- `npm.cmd run test`: 173 pruebas aprobadas en 24 archivos.
- `npm.cmd run build`: aprobado.

## 2026-06-25 - Ajuste Session header Folder/Criterion y Load playlist

- Se mueve el selector de carpeta de Session Mode desde el panel central al
  header superior.
- Se sustituye el control visible de `Active workflow` por `Criterion`, con
  opciones localizadas para All, Unreviewed, No rating, estados, colecciones y
  criterios creativos como Custom Model Seeds o Needs Metadata.
- El filtro de criterio se aplica a sugerencias afines, busqueda manual y
  candidatos de sesion sin vaciar colas manuales ni playlists cargadas.
- Se elimina el filtro de carpeta duplicado del panel central, dejando esa zona
  centrada en busqueda y sugerencias.
- `Load playlist` ahora llama a `loadPlaylistIntoSession(playlistId)` con id
  explicito y muestra feedback localizado para lista cargada, lista vacia y
  error.
- Se anaden pruebas para header Folder/Criterion, ausencia de Active workflow,
  ausencia de filtro duplicado, criterio en sugerencias, criterio en busqueda y
  playlist vacia.
- No se ejecuta `tauri:build` ni se genera instalador.
- `npm.cmd run test`: 178 pruebas aprobadas en 24 archivos.
- `npm.cmd run build`: aprobado.
- `cargo test`: 45 pruebas aprobadas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- `cargo fmt -- --check`: aprobado.

## 2026-06-22 - Hotfix abrir reproduccion actual en Explorador desde Biblioteca

- Se corrige la accion "Abrir cancion en Explorador" de Biblioteca para que
  priorice `currentTrack` del `PlayerContext` antes que `playerState.trackId`.
  Esto cubre el primer lanzamiento de una cancion, cuando el contexto de React
  ya conoce la pista actual pero el estado bajo nivel puede no haber publicado
  aun el `trackId`.
- La accion sigue usando la cancion seleccionada como fallback si no hay pista
  actual en el reproductor.
- Se anade prueba frontend para el caso de primera cancion lanzada con
  `currentTrack` definido y `trackId` todavia vacio.
- `npm.cmd run test -- src/features/library/LibraryView.test.tsx`: 12 pruebas
  aprobadas.
- `npm.cmd run build`: aprobado.
- No se genera instalador.

## 2026-06-22 - Hotfix foco determinista al abrir Explorador desde Biblioteca

- Se refuerza `ExplorerView`: cuando recibe `focusTrackId`, carga esa cancion
  directamente con `api.getTrack(focusTrackId)` y la marca como pista activa
  antes de usar la cola del Explorador.
- La cola sigue disponible detras de la cancion enfocada, pero ya no puede
  imponerse la primera pista de una cola filtrada/aleatoria cuando se viene
  desde Biblioteca.
- Se anade prueba para el caso en que la cancion enfocada no aparece en la cola
  inicial del Explorador y aun asi debe abrirse exactamente esa pista.
- `npm.cmd run test -- src/features/explorer/ExplorerView.test.tsx src/features/library/LibraryView.test.tsx`:
  42 pruebas aprobadas.
- `npm.cmd run build`: aprobado.
- No se genera instalador.

## 2026-06-23 - UX Explorer Workflow Presets compactos

- Se compacta la cabecera de Workflow Presets en el panel derecho de Explorer:
  selector, carga de cola sugerida, metricas y ayuda corta ocupan una zona mas
  pequena.
- El aviso de cola no coincidente pasa a chip compacto con tooltip.
- Las metricas quedan colapsadas por defecto bajo un control pequeno.
- Los checklists de publicacion se mueven dentro de la ficha de trabajo y
  permanecen colapsados por defecto.
- Las quick actions separan estado recomendado y aplicado: recomendado usa
  estilo neutro; solo aplicado usa acento verde.
- La ficha de trabajo usa titulos especificos por preset en EN/ES.
- `npm.cmd run test`: 149 pruebas aprobadas.
- `npm.cmd run build`: aprobado.
- `cargo test`: 45 pruebas aprobadas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- `cargo fmt -- --check`: aprobado.
- No se ejecuta `npm.cmd run tauri:build` ni se genera instalador.

## 2026-06-23 - Hotfix Library Inspector title tag vs file name

- El inspector de Biblioteca ahora calcula un titulo visible robusto para el
  header: title tag leido en vivo, titulo guardado, nombre de archivo o basename
  de la ruta.
- En `File Metadata`, el campo `Title` pasa a mostrarse como `Title tag` /
  `Tag de titulo` para distinguir metadata embebida de titulo visual.
- Si no hay tag Title embebido, se muestra `No embedded title` /
  `Sin titulo embebido` en lugar de un guion generico.
- Se anade `File name` / `Nombre de archivo` como campo visible en metadata.
- Se anade la accion explicita `Use file name as title` /
  `Usar nombre de archivo como titulo`, que solo dispara el flujo seguro
  existente de guardado de metadata al pulsarla y usa el nombre sin extension.
- Se cubre con tests el fallback a filename, title tag real, seleccion de
  Biblioteca por ID y las nuevas claves i18n.
- `npm.cmd run test`: 154 pruebas aprobadas.
- `npm.cmd run build`: aprobado.
- `cargo test`: 45 pruebas aprobadas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- `cargo fmt -- --check`: aprobado.
- No se ejecuta `npm.cmd run tauri:build` ni se genera instalador.

## 2026-06-23 - Mejora Library autonumerar versiones

- Se anade en Biblioteca la accion `Auto-number versions` /
  `Autonumerar versiones`, visible cuando hay dos o mas canciones marcadas.
- La accion abre un modal con formato, numero inicial, orden, modo de
  aplicacion y preview de las primeras canciones.
- Formatos soportados: `v{n}`, `take {n}`, `version {n}`, `remix {n}` y
  personalizado con validacion obligatoria de `{n}`.
- Ordenes soportados: orden actual de tabla, nombre A-Z, orden natural, duracion
  ascendente/descendente, agrupacion por formato y ruta.
- Por defecto solo rellena versiones vacias; tambien permite sobrescribir todas
  con aviso. Se incluye opcion de agrupar por titulo y artista.
- La escritura se limita a `versionLabel` via `updateTrackOrganization`; no se
  escriben tags reales ni metadata del archivo.
- Se anaden tests de plan/orden, modo solo vacias, overwrite, orden natural,
  boton de Biblioteca, preview, guardado en SQLite e i18n.
- `npm.cmd run test`: 161 pruebas aprobadas.
- `npm.cmd run build`: aprobado.
- `cargo test`: 45 pruebas aprobadas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- `cargo fmt -- --check`: aprobado.
- No se ejecuta `npm.cmd run tauri:build` ni se genera instalador.

## 2026-06-22 - Entrega 1.4.0 rendimiento de Biblioteca

- Biblioteca separa el texto escrito de la busqueda efectiva con debounce de
  200 ms para evitar consultas en cada pulsacion.
- La tabla principal usa virtualizacion ligera: mantiene el limite visible alto
  pero solo monta en DOM las filas cercanas al scroll.
- El backend de Biblioteca sube el limite real de consulta de 2000 a 5000
  canciones y queda protegido por prueba automatica.
- Se anade la migracion `0012_library_performance_indexes.sql` con indices para
  filtros, busqueda, ordenacion, tags y playlists.
- Version final de instalador: `1.4.0`.
- `npm.cmd run test`: 138 pruebas aprobadas en 21 archivos.
- `npm.cmd run build`: aprobado.
- `cargo test`: 44 pruebas aprobadas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- `cargo fmt -- --check`: aprobado.
- `npm.cmd run tauri:build`: aprobado. Instaladores:
  `src-tauri\target\release\bundle\nsis\Soundbender TagDeck_1.4.0_x64-setup.exe`
  y `src-tauri\target\release\bundle\msi\Soundbender TagDeck_1.4.0_x64_es-ES.msi`.

## 2026-06-22 - Pulido Biblioteca cabecera compacta y busqueda global

- Cabecera de Biblioteca reorganizada en tres filas logicas: acciones
  principales, acciones secundarias y buscador/filtros.
- `Quitar cancion` y `Abrir cancion en Explorador` quedan visibles y
  desactivados con tooltip cuando no hay seleccion.
- El buscador de Biblioteca pasa a "todos los campos y tags" y mantiene el
  debounce existente.
- La busqueda backend ahora tokeniza el texto y busca en metadatos basicos,
  campos creativos internos, proyecto, modelo, rating, estado legible y tags.
- Revision visual manual realizada en navegador interno con viewport 1440x900:
  las tres filas quedan compactas y separadas.
- No se genera instalador ni se ejecuta `tauri:build`.
- `npm.cmd run test`: 140 pruebas aprobadas.
- `npm.cmd run build`: aprobado.
- `cargo test`: 45 pruebas aprobadas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- `cargo fmt -- --check`: aprobado tras aplicar `cargo fmt`.

## 2026-06-22 - Correccion Open Song in Explorer

- Se corrige el boton de Biblioteca `Abrir cancion en Explorador`: ahora abre
  el Modo Explorador/Curador con la cancion seleccionada como pista activa.
- Ya no usa `reveal_file` ni abre el Explorador de Windows.
- App mantiene `focusTrackId` para el lanzamiento del Explorador y Explorer
  prioriza esa cancion en la cola sin autoplay.
- `npm.cmd run test`: 142 pruebas aprobadas.
- `npm.cmd run build`: aprobado.
- `cargo check`: aprobado.
- `cargo fmt -- --check`: aprobado.

## 2026-06-22 - Hotfix reproduccion sin contexto por modo

- Se corrige el flujo de reproduccion para que cada modo envie contexto
  explicito al Player: Biblioteca, Explorador, Sesion, Listas y Organizacion.
- `PlayerContext.playTrack` acepta ahora `contextOverride` y actualiza el
  contexto activo antes de invocar `play_track` en Rust.
- Las listas internas registran su cola como contexto `playlist`, tambien para
  controles globales de siguiente/anterior.
- Esto evita que la reproduccion dependa de un contexto antiguo o `custom` al
  pulsar Play desde distintas pantallas.
- `npm.cmd run test`: 142 pruebas aprobadas.
- `npm.cmd run build`: aprobado.
- `cargo check`: aprobado.
- `cargo fmt -- --check`: aprobado.

## 2026-06-22 - Ajuste Open Song in Explorer usa cancion reproduciendo

- En Biblioteca, `Abrir cancion en Explorador` prioriza ahora la cancion que
  esta sonando/pausada/terminada en el reproductor global.
- Si no hay cancion activa en el reproductor, mantiene el comportamiento de
  abrir la seleccionada o marcada.
- `npm.cmd run test -- src/features/library/LibraryView.test.tsx`: 11 pruebas
  aprobadas.
- `npm.cmd run build`: aprobado.

## 2026-06-22 - Foundation Desktop Mobile/Sync readiness

- Se anade una base local experimental para futura app movil/sync sin activar
  nube, login, servidor, sincronizacion automatica ni app movil.
- SQLite incorpora `library_roots`, `devices`, `sync_changes` y campos de
  preparacion en `tracks`: `stable_id`, `relative_path`, `library_root_id` y
  `updated_by_device`.
- Al arrancar se rellenan IDs estables faltantes, se reflejan raices escaneadas
  existentes como raices de biblioteca, se calculan rutas relativas cuando hay
  raiz conocida y se crea un `device_id` local de escritorio.
- Ajustes > Datos y seguridad muestra una seccion experimental "Mobile / Sync
  readiness" con Device ID y exportacion de `tagdeck_manifest.json`.
- El manifiesto exporta canciones por `stable_id`, rutas relativas, datos
  creativos internos, playlists referenciadas por stable ID y metadatos utiles
  para reconciliacion futura.
- Se documenta la arquitectura y limites en `docs/MOBILE_SYNC_READINESS.md`.
- No se genera instalador ni bundle Tauri en esta fase.

## 2026-06-22 - Reddit Validation Build

- Se refuerza Explorer como flujo principal de curaduria: bloque visual
  Creative Decision / Decision creativa y flujo escuchar, puntuar, detectar
  parte fuerte/problema, decidir siguiente accion y guardar.
- Se anaden presets visuales de workflow en Explorer: Idea Capture, DAW
  Finishing, Release Prep, Radio Selection y Custom Model Seeds. Los presets
  solo cambian ayuda contextual y quick actions; no modifican SQLite por si
  mismos.
- Se anaden quick tags internos: Potential, Rejects I Like, Custom Model Seed,
  Release Candidate y Final Version. Se guardan como tags internos SQLite y no
  se escriben en archivos musicales.
- Smart Collections nuevas por tags internos: Potential, Rejects I Like, Custom
  Model Seeds, Release Candidates y Final Versions.
- Se crea la migracion `0011_reddit_validation_build.sql` con grupos simples de
  listas (`playlist_groups`) y campos nullable `group_id` y `purpose` en
  playlists.
- Listas permite crear, renombrar y borrar grupos vacios, asignar listas a
  grupos y marcar purpose basico.
- Se anade Export Model Seed Pack usando canciones marcadas como Custom Model
  Seed o una playlist seleccionada. Copia archivos y genera CSV/JSON/M3U/README
  sin mover originales.
- La demo visual incluye casos representativos: FINAL, DAW Rescue, Rejects I
  Like, Release Candidate, letras, stems simulados, cover/video simulado,
  archivada y Custom Model Seed.
- Se documenta Track Workspace como roadmap futuro en
  `docs/TRACK_WORKSPACE_ROADMAP.md`; no se implementan tablas ni UI de Track
  Workspace en esta fase.
- No se genera instalador ni bundle Tauri.

## 2026-06-20 - Pulido UI y Modelo interno sin instalador

- Ajustes reduce el espacio lateral de la vista principal para aprovechar mejor
  el ancho disponible entre sidebar y contenido.
- Explorador mueve Rating y Estado a la columna izquierda junto a la tarjeta de
  cancion y reproductor, separa `Guardar` de `Guardar y siguiente`, y mantiene
  el avance/autoplay solo en la segunda accion.
- Se anade el campo interno `Modelo` (`generation_model`) mediante la migracion
  `0009_generation_model.sql`; se guarda solo en SQLite y no se escribe en los
  archivos musicales.
- `Modelo` aparece en Explorador, inspector, opciones de organizacion,
  visibilidad de campos y exportaciones CSV/JSON de biblioteca filtrada y
  playlists.
- Modo Sesion unifica tarjetas de sugerencias y busqueda mostrando Rating,
  Estado, Genero, Mood y Duracion; la afinidad queda como distintivo adicional
  solo para sugerencias.
- Se mejora el contraste de los motivos de sugerencia usando tokens semanticos
  compatibles con temas claros.
- No se genero instalador, no se ejecuto `npm.cmd run tauri:build` y no se
  cambio la version, que sigue en `1.3.0-beta.4`.
- `npm.cmd run test`: 86 pruebas aprobadas en 16 archivos.
- `npm.cmd run build`: aprobado.
- `cargo test`: 38 pruebas aprobadas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- `cargo fmt -- --check`: aprobado.

## 2026-06-19 - Selector de carpeta comun en Biblioteca, Explorador y Modo Sesion

- Se anade `folderPath` a `LibraryQuery` y se reutiliza el filtro SQL seguro por
  `file_path_key` para que Biblioteca y exportaciones puedan limitar resultados
  por carpeta sin confundir rutas como `Pop` y `Pop Rock`.
- `get_library_folders` deja de devolver carpetas con `track_count = 0`; las
  carpetas raiz se mantienen solo si filtran recursivamente al menos una
  cancion.
- Biblioteca incorpora selector `Carpeta`, persiste el ultimo valor junto a los
  filtros recordados, actualiza el contador con "en esta carpeta" y refresca
  carpetas tras escanear, quitar canciones, vaciar o actualizar.
- El contexto de reproduccion de Biblioteca sigue usando las canciones visibles,
  por lo que Siguiente/aleatorio quedan acotados a la carpeta seleccionada.
- La exportacion de vista/filtro actual lee la carpeta guardada en
  `tagdeck.library.filters` y la envia al backend.
- Modo Sesion incorpora `Filtro de carpeta para sugerencias y busqueda`; el
  filtro afecta solo a sugerencias y resultados de busqueda, no recorta una
  lista ya cargada como cola activa.
- Explorador conserva su selector y ahora tambien resetea a "Toda la biblioteca"
  si la carpeta seleccionada desaparece de las opciones disponibles.
- Se crea `src/lib/libraryFolders.ts` con normalizacion comun de rutas Windows,
  filtrado recursivo y deteccion de carpeta disponible, mas pruebas unitarias.
- Se sube la version de prueba a `1.3.0-beta.4` para diferenciar el instalador
  de los hotfixes anteriores.
- Git sigue sin estar disponible en PATH, asi que esta nota queda como
  trazabilidad del cambio.
- `npm.cmd run test`: 83 pruebas aprobadas en 16 archivos.
- `npm.cmd run build`: aprobado.
- `cargo test`: 38 pruebas aprobadas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- `cargo fmt -- --check`: aprobado tras aplicar `cargo fmt`.
- `npm.cmd run tauri:build`: aprobado. Instaladores generados:
  `src-tauri\target\release\bundle\nsis\Soundbender TagDeck_1.3.0-beta.4_x64-setup.exe`
  y `src-tauri\target\release\bundle\msi\Soundbender TagDeck_1.3.0-beta.4_x64_es-ES.msi`.

## 2026-06-17 - Ajustes avanzados de visibilidad por pantalla y zona

- Se anade una matriz de visibilidad de campos en Ajustes, con filas por campo
  y columnas por zona: tabla/inspector de Biblioteca, tabla/panel de
  Organizacion, tarjeta/editor de Explorador, zonas de Sesion y Listas.
- Se anaden categorias de campos, busqueda, marcado/desmarcado por zona y
  presets: Basico, Organizacion IA/Suno, Tecnico, Radio/Sesion, Publicacion y
  Minimal.
- La configuracion se guarda dentro de los ajustes existentes y se normaliza al
  cargar para recuperar valores corruptos o incompletos. Los campos minimos de
  navegacion siguen protegidos.
- La tabla de Biblioteca deriva sus columnas desde la matriz de visibilidad y el
  inspector de Biblioteca respeta al menos rating y letras no sincronizadas.
- El Explorador recibe ajustes separados para tarjeta principal y editor de
  curaduria; se conectan portada, titulo/archivo, artista, duracion, formato,
  saltos, fecha de revision, ruta, rating, estado, proyecto, tags, parte
  fuerte, problema principal, uso previsto, mood, genero y notas.
- Organizacion recibe visibilidad para tabla y panel principal; la tabla oculta
  estado/proyecto/version/tags/siguiente accion y el panel oculta
  estado/proyecto/tags/notas segun la matriz.
- Sesion recibe visibilidad para tarjeta actual, sugerencias/resultados y cola:
  se ocultan portada, titulo/archivo, artista, album, proyecto, estado, mood,
  duracion, formato, tags, ruta, afinidad y motivos de sugerencia cuando
  procede, manteniendo intactos los controles criticos de reproduccion.
- Listas recibe visibilidad inicial para la tabla central: cabeceras de
  artista/rating/estado/proyecto/tags/formato y celdas de estado/formato se
  ocultan segun configuracion. Algunas celdas con guion mojibake heredado
  quedan pendientes de una normalizacion de codificacion mas amplia.
- Se anaden pruebas frontend especificas para normalizacion, presets,
  proteccion de campos minimos y sincronizacion de columnas de Biblioteca.
- Git sigue sin estar disponible en PATH, asi que no se pudo generar diff ni
  status con Git.
- `npm.cmd run test`: 77 pruebas aprobadas en 15 archivos.
- `npm.cmd run build`: aprobado.
- `cargo fmt -- --check`: aprobado.
- `cargo test`: 37 pruebas aprobadas.
- `cargo check`: aprobado.
- `cargo clippy`: aprobado con aviso no bloqueante de canonicalizacion de
  `C:\Users\carro`.
- `npm.cmd run tauri:build`: aprobado. Genera:
  `src-tauri\target\release\soundbender-tagdeck.exe`,
  `src-tauri\target\release\bundle\nsis\Soundbender TagDeck_1.3.0-beta.1_x64-setup.exe`
  y
  `src-tauri\target\release\bundle\msi\Soundbender TagDeck_1.3.0-beta.1_x64_es-ES.msi`.
- Revisión visual básica en navegador interno: Biblioteca y Ajustes renderizan
  la estructura nueva, textos acentuados, columnas, paneles y controles de
  reproductor. La ejecución fuera de Tauri muestra errores esperados de
  `invoke`, por lo que escaneo/reproducción real e inspector con archivos se
  dejan para comprobación manual dentro de la app instalada.
- `npm.cmd run tauri:build`: aprobado; generó ejecutable release, NSIS y MSI:
  `src-tauri/target/release/soundbender-tagdeck.exe`,
  `src-tauri/target/release/bundle/nsis/Soundbender TagDeck_1.3.0-beta.1_x64-setup.exe`
  y
  `src-tauri/target/release/bundle/msi/Soundbender TagDeck_1.3.0-beta.1_x64_es-ES.msi`.

## 2026-06-16 - Hotfix Explorador sin autoavance continuo

- Se corrige la regresion por la que el Explorador podia saltar canciones al
  heredar la accion global `next` del reproductor cuando una pista terminaba.
- `PlayerContext` distingue contextos de reproduccion (`library`, `explorer`,
  `session`, `playlist`, `organization`, `custom`) y permite registrar
  controles propios por contexto.
- El evento `ended` solo ejecuta la logica continua de Biblioteca dentro del
  contexto `library`. En Explorador no avanza por defecto al terminar el audio.
- El Explorador se registra como contexto `explorer` y expone sus callbacks
  `next`/`previous` al reproductor global para que PlayerBar avance o retroceda
  una sola cancion de la cola del Curador.
- Se anaden pruebas frontend para verificar que Explorador registra contexto
  aislado, no registra handler `ended` de avance y que el boton global
  Siguiente avanza exactamente una cancion.
- Se anaden pruebas de regla en `PlayerContext` para impedir que `next` global
  al terminar se aplique fuera de Biblioteca.
- Git no esta disponible en PATH, asi que la trazabilidad queda documentada en
  este archivo.
- `npm.cmd run test`: 65 pruebas aprobadas en 15 archivos.
- `npm.cmd run build`: aprobado.
- `cargo test`: 36 pruebas aprobadas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- `cargo fmt -- --check`: aprobado.
- `npm.cmd run tauri:build`: aprobado; genero ejecutable release, NSIS y MSI
  para `1.3.0-beta.1` en `src-tauri/target/release/bundle`.

## 2026-06-17 - Hotfix calidad instalador tester 1.3.0-beta.3

- Se configura `src-tauri/src/main.rs` con
  `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]` para que
  el ejecutable release no abra consola CMD en Windows.
- Los logs `[PLAYER]` del backend Rust pasan por un macro `player_debug!` que
  solo escribe en builds debug. En release no hay `eprintln!` directo de
  reproduccion.
- Se verifica el PE de `soundbender-tagdeck.exe`: subsistema `2`, Windows GUI.
- Modo Sesion registra ahora el contexto `session` en `PlayerContext` con
  controles propios `next`, `previous` y `ended`, evitando caer en `custom`.
- Cargar una playlist en Modo Sesion guarda id/nombre de lista activa, muestra
  posicion `Cancion X de Y`, marca la cancion actual en la cola lateral y deja
  las pendientes en orden de playlist.
- La reproduccion al cargar lista usa reason `session_playlist_loaded`; Siguiente
  usa `session_queue_next`; Anterior usa `session_queue_previous`; reproducir un
  resultado manual usa `user_click`.
- Se mejora contraste de Modo Sesion en temas claros mapeando tambien
  `text-white/22` y `text-white/38` a variables semanticas de texto.
- La version visible y de distribucion pasa a `1.3.0-beta.3` en `package.json`,
  `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`,
  `src-tauri/tauri.conf.json`, Acerca de y READMEs de tester.
- `npm.cmd run test`: 77 pruebas aprobadas en 15 archivos.
- `npm.cmd run build`: aprobado.
- `cargo fmt -- --check`: aprobado.
- `cargo test`: 37 pruebas aprobadas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado con aviso no bloqueante
  de canonicalizacion de `C:\Users\carro`.
- `npm.cmd run tauri:build`: aprobado. Genera:
  `src-tauri\target\release\soundbender-tagdeck.exe`,
  `src-tauri\target\release\bundle\nsis\Soundbender TagDeck_1.3.0-beta.3_x64-setup.exe`
  y
  `src-tauri\target\release\bundle\msi\Soundbender TagDeck_1.3.0-beta.3_x64_es-ES.msi`.

## 2026-06-16 - Hotfix bucle de audio y OutputStream

- Se corrige la causa probable del spam `Dropping OutputStream`: el backend
  creaba un `OutputStream` nuevo en cada llamada a `play_track` y sustituia el
  anterior. Si el frontend repetia la orden para la misma cancion, Rodio
  destruia streams continuamente.
- `AudioPlayer` ahora crea el `OutputStream` de forma perezosa una sola vez y
  lo mantiene vivo aunque se cambie de cancion o se pulse Stop. Para cada pista
  se crea un `Sink` nuevo usando el mixer del stream persistente.
- `AudioPlayer::play_track` ignora peticiones duplicadas cuando la misma pista
  ya esta reproduciendose, devolviendo el estado actual sin abrir archivo, sin
  crear sink y sin reiniciar audio.
- `PlayerContext` aplica la misma proteccion antes de invocar Tauri, usando un
  ref del estado del reproductor para no recrear callbacks en cada tick de
  progreso.
- Se dejan logs minimos `[PLAYER]` para creacion de stream, reproduccion, stop
  y duplicados ignorados. No se loggea por polling de progreso.
- Se anaden pruebas Rust y frontend para la idempotencia de play duplicado.
- No se genera instalador ni se sube version aun: falta confirmar manualmente
  en una consola real que `npm.cmd run tauri:dev` no muestra el spam de Rodio
  durante reproduccion.
- `npm.cmd run test`: 66 pruebas aprobadas en 15 archivos.
- `npm.cmd run build`: aprobado.
- `cargo test`: 37 pruebas aprobadas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- `cargo fmt -- --check`: aprobado.

## 2026-06-26 - Hotfix confirmacion segura en Biblioteca

- `Remove song` en Biblioteca ya no ejecuta el borrado con un click: abre un
  modal EN/ES que explica que solo se quitan registros de TagDeck/SQLite y que
  los archivos de audio no se borran del disco.
- La confirmacion distingue entre una cancion y varias canciones, mostrando el
  contador real en el titulo y en el boton de accion.
- `Empty library` ahora usa confirmacion fuerte: el boton final permanece
  deshabilitado hasta escribir exactamente `EMPTY` en ingles o `VACIAR` en
  espanol.
- Al vaciar la biblioteca se limpia tabla, seleccion, inspector, carpetas
  cargadas y estado local, y se detiene el reproductor mediante la ruta
  existente.
- Se reviso backend: `remove_tracks_from_library` y `clear_library` solo llaman
  a operaciones de base de datos (`remove_tracks` / `DELETE FROM tracks`) y no
  borran archivos de audio fisicos.
- Se anaden pruebas frontend para cancelar/confirmar remove, contador multiple,
  confirmacion fuerte de vaciado e i18n EN/ES.
- `npm.cmd run test`: 196 pruebas aprobadas en 24 archivos.
- `npm.cmd run build`: aprobado.
- `cargo test`: 51 pruebas aprobadas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- `cargo fmt -- --check`: aprobado.

## 2026-06-26 - Hotfix salida de audio del sistema

- Se ajusta el reproductor Rust para abrir explicitamente el dispositivo de
  salida predeterminado del sistema mediante `cpal`/`rodio`, en vez de depender
  del fallback generico de `open_default_stream`.
- El stream de audio conserva su vida util mientras reproduce, pero se refresca
  al iniciar reproduccion si Windows informa otro dispositivo predeterminado.
- El volumen interno de TagDeck sigue siendo relativo (`0.0..=1.0`) y se aplica
  solo al `Sink`; el volumen maestro, mute, teclas multimedia y mezclador del
  sistema quedan en manos del sistema operativo.
- En builds debug se registran el dispositivo predeterminado, cambios de
  dispositivo, creacion del stream y volumen aplicado al sink para diagnostico.
- Se anade prueba unitaria para la decision de refrescar stream cuando falta o
  cambia el dispositivo del sistema.
- No se anade selector de dispositivo en Ajustes en este hotfix para mantener
  el cambio acotado y reducir riesgo.
- `npm.cmd run test`: 191 pruebas aprobadas en 24 archivos.
- `npm.cmd run build`: aprobado.
- `cargo test`: 51 pruebas aprobadas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- `cargo fmt -- --check`: aprobado tras aplicar `cargo fmt`.

## 2026-06-16 - Hotfix bloqueo de reproduccion aleatoria en bucle

- Se endurece el handler `ended` del `PlayerContext`: el autoavance de
  Biblioteca solo puede ejecutarse si el contexto activo es `library`, la
  duracion es valida, la posicion esta realmente al final, la pista que termina
  coincide con la pista iniciada y ha pasado al menos 1,5 s desde el inicio.
- Se anade cerrojo anti-bucle: no puede haber mas de un autoavance en curso y
  se bloquean autoavances repetidos en menos de 1,5 s.
- El ajuste por defecto `player.libraryEndAction` pasa de `random` a `stop`.
  La opcion aleatoria sigue existiendo en Ajustes, pero no puede dispararse por
  estados `ended` sospechosos o repetidos.
- Todas las llamadas frontend a reproducir pasan `context` y `reason` hacia el
  backend. Los logs `[PLAYER]` ahora incluyen id, titulo, contexto, razon y
  timestamp; si falta contexto o razon se registra como error.
- Se mantienen logs de bloqueo para `invalid_ended_state` y
  `duplicate_auto_advance`, pensados para diagnosticar cualquier nuevo bucle.
- Se anaden pruebas frontend para duracion cero/nula, progreso que no llega al
  final, estado que no es `ended`, cambio de cancion, contexto no Biblioteca,
  cooldown anti-bucle y play duplicado.
- No se genera instalador ni se sube version aun: falta confirmar manualmente
  con `npm.cmd run tauri:dev` que desaparece el spam de `[PLAYER] playing id=...`.
- `npm.cmd run test`: 70 pruebas aprobadas en 15 archivos.
- `npm.cmd run build`: aprobado.
- `cargo test`: 37 pruebas aprobadas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- `cargo fmt -- --check`: aprobado.

## 2026-06-17 - Hotfix Explorador sin explorer_autoplay_load

- Se elimina `explorer_autoplay_load` de las razones permitidas del Player y se
  retira la llamada que reproducia automaticamente al cargar la primera cancion
  de la cola del Explorador.
- Aunque el ajuste `explorer.autoplayOnLoad` exista o este persistido como
  activo, el Explorador ya no reproduce por el mero hecho de cargar una cancion.
  El autoplay queda limitado a transiciones explicitas: guardar y siguiente,
  saltar por ahora o acciones de reproduccion del usuario.
- `ExplorerView` separa inicializacion de cola y avance de cancion con razones
  explicitas: `explorer_init`, `explorer_criterion_changed`,
  `explorer_folder_changed`, `explorer_save_and_next`, `explorer_skip`,
  `explorer_next_button` y `explorer_previous_button`.
- Se anaden logs `[EXPLORER]` para inicializacion de cola y seleccion de
  cancion, incluyendo id, razon y si procede de accion de usuario.
- Se anade un bloqueo especifico contra navegacion automatica rapida: si una
  seleccion no accionada por usuario intenta cambiar a otra cancion en menos de
  1 s, se bloquea y se registra `[EXPLORER] BLOCKED rapid auto navigation`.
- Las pruebas de Explorador ahora cubren: cola inicial una sola vez, ajuste
  antiguo `autoplayOnLoad=true` sin reproduccion, re-render sin avance, cambios
  de estado `playing/ended` del Player sin avance, cambios de ajustes sin
  reproduccion, y siguiente global avanzando una sola cancion.
- No se genera instalador ni se sube version: falta confirmar manualmente con
  CMD abierto que no aparece `context=explorer reason="explorer_autoplay_load"`.
- `npm.cmd run test`: 74 pruebas aprobadas en 15 archivos.
- `npm.cmd run build`: aprobado.
- `cargo test`: 37 pruebas aprobadas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- `cargo fmt -- --check`: aprobado.

## 2026-06-19 - Entrega final beta 1.3.0-beta.4 selector de carpeta comun

- Cierre de trazabilidad de la entrega: selector de carpeta disponible en
  Biblioteca, Explorador y Modo Sesion.
- Biblioteca filtra tabla, busqueda, rating, contador, contexto de reproduccion
  y exportacion de filtro actual por `folderPath`.
- Modo Sesion limita sugerencias y busqueda manual por carpeta, manteniendo las
  listas cargadas completas aunque mezclen rutas.
- Los selectores solo reciben carpetas con canciones (`track_count > 0`) y
  vuelven a "Toda la biblioteca" si la carpeta activa desaparece.
- Version final de instalador: `1.3.0-beta.4`.
- `npm.cmd run test`: 83 pruebas aprobadas en 16 archivos.
- `npm.cmd run build`: aprobado.
- `cargo test`: 38 pruebas aprobadas.
- `cargo check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado.
- `cargo fmt -- --check`: aprobado.
- `npm.cmd run tauri:build`: aprobado. Instaladores:
  `src-tauri\target\release\bundle\nsis\Soundbender TagDeck_1.3.0-beta.4_x64-setup.exe`
  y `src-tauri\target\release\bundle\msi\Soundbender TagDeck_1.3.0-beta.4_x64_es-ES.msi`.
