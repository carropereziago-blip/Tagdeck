SOUNDBENDER TAGDECK 1.3.0-beta.3
GUIA PARA TESTER

Soundbender TagDeck es una aplicacion local para Windows destinada a organizar,
reproducir, puntuar y curar bibliotecas musicales, especialmente musica
generada con IA/Suno.

IMPORTANTE

Esta es una version beta sin firma digital. Windows SmartScreen puede mostrar
una advertencia de editor desconocido. Empieza con una carpeta copiada de
20-50 canciones, no con tu biblioteca principal.

INSTALACION

1. Ejecuta el instalador EXE (NSIS), recomendado para pruebas normales.
2. Elige el idioma y completa la instalacion para el usuario actual.
3. Tambien se incluye un MSI y un ZIP portable.
4. Para usar el ZIP, extrae todo y abre soundbender-tagdeck.exe.

La aplicacion no necesita Node.js ni Rust. Puede requerir Microsoft Edge
WebView2 Runtime si Windows no lo tiene instalado.

QUE PROBAR

1. Biblioteca: escaneo, reescaneo sin duplicados, busqueda, rating y player.
2. Reproduccion continua en Biblioteca: terminar una pista, Siguiente y
   Anterior con historial.
3. Inspector de Biblioteca: editar inline titulo/artista/genero con backup y
   editar estado/proyecto/tags/notas solo en SQLite.
4. Ajustes > Biblioteca: ocultar columnas, restaurar columnas por defecto y
   comprobar persistencia.
5. Paneles: contraer/ocultar sidebar, ocultar inspector y probar modo enfoque.
6. Organizacion: estados, proyectos, versiones, tags internos y notas.
7. Explorador: elegir criterio y limitar la cola a una carpeta escaneada.
8. Listas: crear, reordenar y seleccionar canciones.
9. Copiar lista a carpeta y comprobar prefijos 01, 02, 03.
10. Arrastrar una lista o seleccion fuera de TagDeck en modo copia.
11. Modo Sesion: cargar una lista existente y respetar su orden.
12. Anadir sugerencias a la cola y guardar la cola como una lista nueva.
13. Exportar CSV/JSON desde Ajustes > Exportacion e importar desde Datos y
    seguridad.
14. Verificar previsualizacion, modo seguro y backup SQLite previo.
15. Cerrar/reabrir y reescanear para comprobar persistencia.

DATOS Y SEGURIDAD

- El escaneo es de solo lectura.
- Copiar listas nunca mueve ni modifica los originales.
- La importacion no crea canciones nuevas.
- Rating, estados, proyectos, versiones, mood, tags y notas se importan solo
  a SQLite.
- El genero importado se actualiza solo en SQLite; no se escribe en archivos.
- Antes de importar se crea siempre un backup consistente de SQLite.
- La ruta de datos y el identificador de la aplicacion son estables entre
  versiones para conservar la biblioteca al actualizar.

COMO REPORTAR UN ERROR

Incluye los pasos exactos, resultado esperado, resultado real, version de
Windows y version de TagDeck (1.3.0-beta.3). No envies canciones, rutas
personales, bases de datos o logs privados sin revisarlos previamente.
