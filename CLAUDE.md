# TFX Macro Intelligence Terminal

Terminal de inteligencia macro de TFX Academy (FX, EE.UU. primero). Es de uso propio y no se comercializará (decisión del propietario, 2026-11-11): se pueden usar fuentes no oficiales o con licencia para uso personal.

## Reglas permanentes
- Idioma del producto y de la comunicación con el propietario: español. Propuestas con el formato Problema / Diagnóstico / Solución / Justificación / Impacto / Costo / Riesgos / Plan.
- Producción = https://tfxmacrointelligence.pages.dev (Cloudflare Pages, plan gratuito; desde 2026-11-12), conectada a `main` del repo. Configuración en `docs/architecture.md` → Hosting. Los commits que solo tocan `data/` no se construyen (build watch paths); la página lee `data/` directamente del repo (raw.githubusercontent.com, `main`) y usa la copia publicada como respaldo. En localhost o con `?datos=local` lee solo la copia local. Netlify (tfxmacrointelligence / tfxterminal .netlify.app) quedó congelado con `netlify.toml` → `ignore = "exit 0"`: no borrar ese archivo mientras los sitios sigan conectados al repo. No contratar planes de pago sin autorización.
- Trabajar en ramas; `main` solo con aprobación. El proyecto anterior del repo quedó en la etiqueta `archivo-tfxbasket`.
- Nunca inventar datos. Si una fuente falla se conserva el último valor válido y se marca como desactualizado.
- Separar siempre Actual / Previous / Revised / Consensus / Forecast.
- Secretos (FRED_API_KEY, etc.) solo como secretos de GitHub o variables de Cloudflare, nunca en el repo ni en el frontend.
- Datos con licencia (ISM, UMich, Conference Board, velas del broker, Investing.com, CB.watch) no se pueden redistribuir comercialmente sin licencia; ver `docs/data-sources.md`.
- No contratar servicios ni planes de pago sin autorización expresa.
- Los scripts de datos corren en GitHub Actions (Node 20). La PC del propietario ya tiene Node 24 y Python 3.15 para pruebas locales; la clave de FRED solo existe en Actions (para pruebas: descarga temporal a un artefacto, como en `scripts/dev/`).

## Estructura
- `index.html` — marcado y arranque: descarga `data/*.json` y luego ejecuta `assets/app.js`.
- `assets/app.css`, `assets/app.js` — estilos y lógica (JS sin framework, Chart.js 4.4.1 desde cdnjs).
- `data/snapshot.json` — objeto `D.snap` de los módulos manuales (Catalizador, Modelos, etc.); `data/markets.json` — velas codificadas `MKT_ENC`, manual.
- `data/macro.json` — automático (FRED + `data/manual.json`), se superpone a `D.snap` (rows, blocks, composite, hist…). Lo generan `scripts/macro/` y `.github/workflows/macro.yml`.
- `data/manual.json` — lo edita el propietario desde GitHub (ISM, LEI con su previo, CEI, UMich preliminar, `tasas` para decisiones recientes).
- `data/macro.json` también lleva `cycle` y `cycproj` (Ciclo), calculados por `scripts/macro/cycle.mjs`. `D.snap.regime_mkt` queda oculto.
- `data/macro.json` también lleva `curve` y `yields` (Cuantitativo → bonos y curva, `scripts/macro/curve.mjs`, verificación `node scripts/macro/check-curve.mjs`) e `info` (tarjetas de ventas, PPI, ADP y PIB, `scripts/macro/info.mjs`; los componentes ISM siguen manuales).
- `data/calendar.json` (→ `D.snap.calendar`, Catalizador → agenda) — automático: `scripts/calendar/` (FRED + ForexFactory + `data/manual.json`), paso del workflow del puntaje. Fechas del FOMC a mano en `scripts/calendar/fomc.json` (una vez al año).
- `data/nowcast.json` (→ `D.snap.nowcast`, `nc_order`, `evt`: Modelos y Escenarios) — automático: `scripts/nowcast/` (JS sin dependencias: regresión, ARIMA, GARCH, Monte Carlo), paso del workflow del puntaje después de la agenda. Verificación: `node scripts/nowcast/check.mjs`.
- Vigilante diario: `.github/workflows/watchdog.yml` + `scripts/watchdog/check.mjs` (issue si algo se atrasa). Disparador externo: `docs/disparador-externo.md`.
- `data/charts.json` — automático, lo genera el proceso del puntaje (`scripts/macro/charts.mjs`) → `D.snap.charts`. Proyección oculta: `PRJ={}` en `app.js`.
- `data/carry.json` — automático (BIS + FRED) → `D.snap.carry`, solo pares y dirección del swap; `scripts/carry/`, `.github/workflows/carry.yml`.
- Los valores de `data/snapshot.json` para `pos`, el puntaje y `carry` quedan sobrescritos por los archivos automáticos.
- Ojo con PowerShell 5.1: lee los `.ps1` sin BOM como ANSI; no poner texto no ASCII en scripts `.ps1` que escriban archivos del sitio.
- `.cache/` (ignorado por git) — CSV de FRED para pruebas locales sin clave.
- `data/cot.json` — automático (se inyecta como `D.snap.pos`). Lo generan `scripts/cot/` y `.github/workflows/cot.yml`; patrón en `docs/data-pipeline.md`.
- `data/dist.json` (→ `D.series`, Distribución → Datos macroeconómicos) — automático con el puntaje (`scripts/macro/dist.mjs`); `node scripts/macro/check-dist.mjs` lo compara con `scripts/reference/snapshot-2026-10-16.json`.
- `data/vol.json` (→ `D.snap.vol`), `data/seas.json` (→ `D.snap.seas`) y `data/mkt-live.json` (velas diarias de Yahoo Finance posteriores al histórico de `markets.json`) — automáticos; `scripts/markets/` y `.github/workflows/markets.yml`. `node scripts/markets/check.mjs` verifica que el cálculo reproduce `snapshot.json`.
- `reports/` + `data/reports.json` (→ `D.snap.reports`, sección Reportes) — biblioteca de reportes diarios, semanales y bancarios. Lo que llega a `reports/entrada/` se clasifica y se indexa solo (`scripts/reports/`, `.github/workflows/reports.yml`; reglas en `reports/README.md`, prueba con `node scripts/reports/check.mjs`). Para publicar un reporte hecho en Claude: dejar el archivo en `reports/entrada/` con la fecha en el nombre y hacer commit. El repo es público: no subir material que no deba verse.
- `data/tv.json` (→ `D.snap.tvlive`, sección TV) — automático: `scripts/tv/update.mjs` y `.github/workflows/tv.yml` (cada 30 min) guardan el video en vivo de cada canal de YouTube. Canales y sus identificadores: `TVCH` en `app.js` y `CH` en el script (mantenerlos iguales). Un commit de datos cada vez que cambia un programa es normal.
- Scripts de datos en JavaScript (Node 20 en Actions). `core.mjs` es puro y se prueba importándolo en el navegador contra el servidor local.

## Fuentes manuales del propietario
- Libro A.E.: `C:\Users\Gus-a\OneDrive\Documentos\Proyectos\TFX Capital\Excel Trading\United States Macro\Endogenous\AE EE.UU. 2026 Q4.xlsx` (hojas: DATA, Sources, US Endo' Historical, US Indicators, Cycles, GDP, CPI All, Core CPI, PPI All, Core PPI, NFP, IR, PMI, NMI, M2, Permits, UMCSI, T10%, Govt, CBBS). Sin conexiones externas.
- Los modelos del nowcast se reconstruyeron en `scripts/nowcast/` (2026-11-11); reglas en `docs/decisions.md`.
- `docs/` — arquitectura, fuentes, roadmap, decisiones y changelog. Actualizar `docs/changelog.md` en cada cambio relevante.

## Verificar un cambio
Servir la carpeta con cualquier servidor estático (no funciona con `file://` porque usa `fetch`) y comprobar que los 14 módulos del menú renderizan sin errores de consola.
