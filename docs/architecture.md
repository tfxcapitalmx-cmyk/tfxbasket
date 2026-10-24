# Arquitectura

## Estado actual (Etapa 1)
Sitio estático en Netlify, sin backend.

```
index.html ──fetch──> data/snapshot.json  (D: snap + series, ~4.1 MB)
           ──fetch──> data/markets.json   (MKT_ENC: velas OHLC delta base-36, ~2.6 MB)
           ──fetch──> data/cot.json       (COT CFTC, automático cada semana → D.snap.pos)
           ──fetch──> data/macro.json     (puntaje macro FRED + manual, automático diario → se superpone a D.snap)
           ──luego──> assets/app.js       (render de los 12 módulos, Chart.js)
```

- `app.js` usa `D` y `MKT_ENC` como globales; `index.html` los asigna en `window` antes de cargarlo.
- Preferencias del usuario (tema, vista, precios subidos a mano) en `localStorage` con prefijo `tfx-mon-` / `tfx-theme`; solo viven en ese navegador.
- SheetJS 0.18.5 se descarga de cdnjs solo al subir un Excel.

## Módulos
| Vista (`#id`) | Datos que consume |
|---|---|
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
GitHub Actions programado → scripts de ingesta por fuente → validación → JSON por módulo en `data/` → commit → Netlify despliega. El historial de git sirve como registro de vintages y rollback. Ver `docs/roadmap.md`.
