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
- `data/snapshot.json` — objeto `D` (`snap` + `series`); `data/markets.json` — velas codificadas `MKT_ENC`.
- `docs/` — arquitectura, fuentes, roadmap, decisiones y changelog. Actualizar `docs/changelog.md` en cada cambio relevante.

## Verificar un cambio
Servir la carpeta con cualquier servidor estático (no funciona con `file://` porque usa `fetch`) y comprobar que los 12 módulos del menú renderizan sin errores de consola.
