# TFX Macro Intelligence Terminal

Terminal de inteligencia macro de TFX Academy (FX, EE.UU. primero). Hoy es de uso propio; la arquitectura debe permitir comercializarla después.

## Reglas permanentes
- Idioma del producto y de la comunicación con el propietario: español. Propuestas con el formato Problema / Diagnóstico / Solución / Justificación / Impacto / Costo / Riesgos / Plan.
- Producción = https://tfxmacrointelligence.netlify.app (hoy se publica arrastrando archivos, sin conexión al repo). No publicar ni conectar Netlify al repo sin autorización.
- Trabajar en ramas; `main` solo con aprobación. El proyecto anterior del repo quedó en la etiqueta `archivo-tfxbasket`.
- Nunca inventar datos. Si una fuente falla se conserva el último valor válido y se marca como desactualizado.
- Separar siempre Actual / Previous / Revised / Consensus / Forecast.
- Secretos (FRED_API_KEY, etc.) solo como secretos de GitHub o variables de Netlify, nunca en el repo ni en el frontend.
- Datos con licencia (ISM, UMich, Conference Board, velas del broker, Investing.com, CB.watch) no se pueden redistribuir comercialmente sin licencia; ver `docs/data-sources.md`.
- No contratar servicios ni planes de pago sin autorización expresa.
- No hay Node ni Python instalados en la PC del propietario; los scripts de datos correrán en GitHub Actions.

## Estructura
- `index.html` — marcado y arranque: descarga `data/*.json` y luego ejecuta `assets/app.js`.
- `assets/app.css`, `assets/app.js` — estilos y lógica (JS sin framework, Chart.js 4.4.1 desde cdnjs).
- `data/snapshot.json` — objeto `D` (`snap` + `series`), manual; `data/markets.json` — velas codificadas `MKT_ENC`, manual.
- `data/macro.json` — automático (FRED + `data/manual.json`), se superpone a `D.snap` (rows, blocks, composite, hist…). Lo generan `scripts/macro/` y `.github/workflows/macro.yml`.
- `data/manual.json` — lo edita el propietario desde GitHub (ISM, LEI con su previo, CEI, UMich preliminar, `tasas` para decisiones recientes).
- `data/macro.json` también lleva `cycle` y `cycproj` (Ciclo), calculados por `scripts/macro/cycle.mjs`. `D.snap.regime_mkt` queda oculto.
- `data/charts.json` — automático, lo genera el proceso del puntaje (`scripts/macro/charts.mjs`) → `D.snap.charts`. Proyección oculta: `PRJ={}` en `app.js`.
- `data/carry.json` — automático (BIS + FRED) → `D.snap.carry`, solo pares y dirección del swap; `scripts/carry/`, `.github/workflows/carry.yml`.
- Los valores de `data/snapshot.json` para `pos`, el puntaje y `carry` quedan sobrescritos por los archivos automáticos.
- Ojo con PowerShell 5.1: lee los `.ps1` sin BOM como ANSI; no poner texto no ASCII en scripts `.ps1` que escriban archivos del sitio.
- `.cache/` (ignorado por git) — CSV de FRED para pruebas locales sin clave.
- `data/cot.json` — automático (se inyecta como `D.snap.pos`). Lo generan `scripts/cot/` y `.github/workflows/cot.yml`; patrón en `docs/data-pipeline.md`.
- Scripts de datos en JavaScript (Node 20 en Actions). `core.mjs` es puro y se prueba importándolo en el navegador contra el servidor local.

## Fuentes manuales del propietario
- Libro A.E.: `C:\Users\Gus-a\OneDrive\Documentos\Proyectos\TFX Capital\Excel Trading\United States Macro\Endogenous\AE EE.UU. 2026 Q4.xlsx` (hojas: DATA, Sources, US Endo' Historical, US Indicators, Cycles, GDP, CPI All, Core CPI, PPI All, Core PPI, NFP, IR, PMI, NMI, M2, Permits, UMCSI, T10%, Govt, CBBS). Sin conexiones externas.
- Los modelos (ARIMA, GARCH, Monte Carlo, regresiones del nowcast) se hicieron en chats anteriores y no existe su código: hay que reconstruirlos en el repo.
- `docs/` — arquitectura, fuentes, roadmap, decisiones y changelog. Actualizar `docs/changelog.md` en cada cambio relevante.

## Verificar un cambio
Servir la carpeta con cualquier servidor estático (no funciona con `file://` porque usa `fetch`) y comprobar que los 12 módulos del menú renderizan sin errores de consola.
