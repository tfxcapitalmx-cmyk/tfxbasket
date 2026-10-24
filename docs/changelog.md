# Changelog

## 2026-10-24 — Etapa 1: estructura del repositorio
- Importada la terminal publicada (datos al 16-oct-2026) y dividida en `index.html`, `assets/app.css`, `assets/app.js`, `data/snapshot.json`, `data/markets.json`.
- SheetJS 0.18.5 deja de ir embebido (1.3 MB) y se descarga de cdnjs solo al subir un Excel.
- Mensaje de error visible si los datos no cargan.
- `netlify.toml` con revalidación de `/data` y cabeceras básicas.
- Verificación: los 12 módulos producen exactamente el mismo texto y número de gráficos que producción; lectura/escritura de Excel probada; sin errores de consola.
