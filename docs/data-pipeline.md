# Pipeline de datos

Patrón para cada fuente automatizada (el COT es la primera):

```
GitHub Actions (cron) → scripts/<fuente>/update.mjs → validate() → data/<fuente>.json → commit → Netlify publica
```

- `core.mjs` = cálculo puro (sin red ni disco), probado contra los datos anteriores. `update.mjs` = red, reintentos, escritura.
- Si la validación falla o la fuente no responde, el script termina con error, **no se escribe nada** y la terminal sigue mostrando el último dato válido. GitHub envía un correo al propietario por cada ejecución fallida.
- Solo se hace commit cuando hay un informe nuevo; las consultas sin novedad quedan en el log de Actions.
- El historial de git de `data/*.json` es el registro de vintages: cada commit es el dato tal como se conocía ese día.

## COT (CFTC)

| | |
|---|---|
| Fuente | API pública de la CFTC (Socrata), dataset `gpe5-46if` — Traders in Financial Futures, futuros únicamente |
| Costo / clave | Gratis, sin clave. Opcional: secreto `SOCRATA_APP_TOKEN` para más cuota |
| Contratos | AUD, CAD, CHF, EUR, GBP, JPY, MXN, NZD (CME) y USD INDEX (ICE) |
| Calendario | Posiciones del martes, publicadas el viernes 15:30 Nueva York. Ejecuciones: viernes 19:45 y 20:45 UTC, sábado 14:00, lunes y martes 21:00 (festivos) |
| Validación | Historial ≥ 260 semanas, fechas crecientes, valores finitos y no negativos, posiciones ≤ interés abierto, mismo corte en todas las divisas, el historial no puede encogerse ni retroceder |
| Alerta | Error si el último informe tiene más de 17 días |
| En la terminal | Sello "informe del …" y "próximo ≈ …"; marca **desactualizado** si pasan más de 13 días |

Reproducción verificada (2026-10-24): reconstruido hasta el corte 2026-10-13, coincide valor por valor con los datos que tenía la terminal (9 divisas × 1,062 semanas, más `now` y `st`).

### Activación (una sola vez, la hace el propietario)
1. Los cron de GitHub solo corren en la rama por defecto: fusionar `terminal` en `main` (o hacer `terminal` la rama por defecto).
2. GitHub → Settings → Actions → General → Workflow permissions → "Read and write permissions".
3. Netlify → sitio de producción → Site configuration → Build & deploy → Link repository → `tfxbasket`, rama de producción la anterior, publish directory `.`, sin comando de build.
4. Prueba manual: GitHub → Actions → "COT CFTC" → Run workflow.

## Próximas fuentes
FRED (serie por serie), tasas de bancos centrales. Mismo patrón: `scripts/<fuente>/core.mjs` + `update.mjs` + `.github/workflows/<fuente>.yml`.
