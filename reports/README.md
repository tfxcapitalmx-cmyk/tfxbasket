# Reportes

Biblioteca de reportes de la terminal (sección **Reportes**).

- **Subir**: deja el archivo en `reports/entrada/`. Un proceso automático (`.github/workflows/reports.yml`) lo clasifica,
  le pone la fecha en el nombre, lo mueve a su carpeta y actualiza `data/reports.json`. Tarda 1–2 minutos.
- **Secciones**: `diarios/`, `semanales/`, `bancarios/`.
- **Cómo se clasifica** (`scripts/reports/core.mjs`):
  1. Si el nombre empieza con `diario`, `daily`, `briefing` → diarios; `semanal`, `weekly` → semanales; `banco`, `bank`, `research` → bancarios.
  2. Si no, por palabras del nombre (un banco o "research" → bancarios; "semanal/weekly" → semanales; "diario/daily/briefing" → diarios).
  3. Si no, por el título y el contenido (solo HTML, Markdown y texto).
  4. Sin señales → diarios.
- **Forzar la sección**: sube el archivo directamente a la carpeta que quieras; ahí se queda.
- **Fecha**: la del nombre (`2026-11-12`, `20261112` o `12-11-2026`); si no trae, el día en que se subió.
- **Formatos**: HTML, PDF, Markdown y texto se leen dentro de la terminal; imágenes también. Word, Excel y PowerPoint se descargan.

El repositorio es público: todo lo que se suba aquí queda visible para cualquiera que tenga el enlace.
