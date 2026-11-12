# Arquitectura

## Estado actual (Etapa 1)
Sitio estático en Cloudflare Pages (https://tfxmacrointelligence.pages.dev), sin backend. Los datos se leen del repo en GitHub (raw.githubusercontent.com, rama `main`); la copia de `data/` publicada con el sitio es solo respaldo.

```
index.html ──fetch──> data/snapshot.json  (D.snap de los módulos manuales, ~0.4 MB)
           ──fetch──> data/dist.json      (D.series: Distribución macro, automático con el puntaje)
           ──fetch──> data/markets.json   (MKT_ENC: velas OHLC delta base-36, ~2.6 MB)
           ──fetch──> data/cot.json       (COT CFTC, automático cada semana → D.snap.pos)
           ──fetch──> data/macro.json     (puntaje macro FRED + manual, automático diario → se superpone a D.snap)
           ──fetch──> data/vol.json, data/seas.json (Volatilidad y Estacionalidad, automático diario)
           ──fetch──> data/mkt-live.json (velas diarias de Yahoo tras el histórico; opcional)
           ──luego──> assets/app.js       (render de los 12 módulos, Chart.js)
```

- `app.js` usa `D` y `MKT_ENC` como globales; `index.html` los asigna en `window` antes de cargarlo.
- Preferencias del usuario (tema, vista, precios subidos a mano) en `localStorage` con prefijo `tfx-mon-` / `tfx-theme`; solo viven en ese navegador.
- SheetJS 0.18.5 se descarga de cdnjs solo al subir un Excel.

## Módulos
| Vista (`#id`) | Datos que consume |
|---|---|
| hoy (vista inicial) | `snap.composite`, `snap.blocks`, `snap.rows`, `snap.cycle`/`cycproj`, `snap.calendar`, `snap.nowcast`, `snap.evt`, `snap.carry`, `snap.pos`, `snap.vol` |
| resumen | `snap.composite`, `snap.hist`, `snap.rows` |
| cuantitativo | `snap.rows`, `snap.blocks`, `snap.curve`, `snap.yields` |
| ciclo | `snap.cycle`, `snap.cycproj` |
| catalizador | `snap.calendar`, `snap.evt` |
| modelos | `snap.nowcast`, `snap.proj` |
| distribucion | `MKT_ENC` (+ subida manual) |
| posicion | `data/cot.json` (CFTC TFF, automático) + `MKT_ENC` para precio y retornos |
| carry | `snap.carry` |
| vol | `snap.vol` |
| estacional | `snap.seas` |
| graficos | `snap.charts`, `series` |
| tv | configuración local (YouTube) |

## Objetivo (Etapa 2)
GitHub Actions programado → scripts de ingesta por fuente → validación → JSON por módulo en `data/` → commit → la página lee el JSON nuevo desde el repo (sin deploy). El historial de git sirve como registro de vintages y rollback. Ver `docs/roadmap.md`.

## Hosting (Cloudflare Pages, desde 2026-11-12)

| Ajuste | Valor |
|---|---|
| Proyecto | `tfxmacrointelligence` → https://tfxmacrointelligence.pages.dev |
| Repositorio / rama de producción | `tfxcapitalmx-cmyk/tfxbasket` / `main` (cada PR genera una vista previa) |
| Framework | Ninguno |
| Comando de build | `mkdir -p dist && cp -r index.html assets data dist/ && if [ -f _headers ]; then cp _headers dist/; fi` |
| Directorio de salida | `dist` |
| Build watch paths | Incluir `*`; excluir `data/*` (los commits de datos no construyen; la página los lee del repo) |
| Cabeceras | `_headers` (revalidación de `/data` y `/assets`, `nosniff`, `Referrer-Policy`) |
| Límites del plan gratuito | 500 builds al mes, ancho de banda ilimitado |

Por qué se dejó Netlify: el plan gratuito por créditos (300 al mes, 15 por deploy de producción) se agotó el 11-nov con 4 deploys de código y pausó los deploys. Netlify queda congelado desde el repo (`netlify.toml` → `ignore = "exit 0"`); sus dos sitios siguen sirviendo su último deploy, que también lee los datos en vivo.

Privacidad (opcional, pendiente de decisión del propietario): Cloudflare Access (Zero Trust, plan gratuito hasta 50 usuarios) puede exigir inicio de sesión con correo para abrir la terminal. El repo es público: los JSON de `data/` siguen visibles en GitHub aunque la página esté protegida.
