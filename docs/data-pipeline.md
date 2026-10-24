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

## Puntaje macro (FRED + captura manual)

| | |
|---|---|
| Alimenta | Resumen (Sesgo TFX Macro, tarjetas) y Cuantitativo (tabla de 19 indicadores, bloques, compuesto). `data/macro.json` se superpone a `D.snap` |
| Fuentes | FRED API (secreto `FRED_API_KEY`): CPILFESL, CPIAUCSL, PPIFES, UNRATE, ICSA, PAYEMS, USALOLITOAASTSAM, UMCSENT, PERMIT, MICH, T5YIE, DCOILWTICO, DFF, DGS2, DGS10, M2SL. Manual (`data/manual.json`): ISM PMI, ISM NMI, LEI 6m; UMich opcional (gana el mes más reciente) |
| Calendario | Lunes a viernes 13:45 y 22:30 UTC, y cada vez que se edita `data/manual.json` |
| Validación | 19 indicadores con puntos en −2…+2, compuesto en ±2, rangos plausibles de niveles, captura manual con periodo AAAA-MM y valores en rango. Error si bonos o Fed funds llevan más de 10 días sin dato |
| Historial | `hist` mensual: al cambiar de mes se agrega el último compuesto calculado del mes anterior. El historial previo a oct-2026 viene del generador original |

Cálculos por fecha de calendario, no por número de fila: FRED no tiene octubre de 2025 en CPI ni desempleo (cierre del gobierno de EE.UU.).

Reproducción verificada (2026-10-24): con los datos recortados al 16-oct, los 19 puntajes, los cinco bloques, líderes (+0.78), catalizadores (+1.06) y el compuesto (+0.93) coinciden exactamente con la versión anterior. Difieren solo valores mostrados por revisiones de FRED (permisos, CLI, solicitudes, core 3m) y la definición del WTI a/a (ver `docs/decisions.md`).

### Cómo actualizar la captura manual (propietario)
1. Abrir https://github.com/tfxcapitalmx-cmyk/tfxbasket/blob/main/data/manual.json → icono de lápiz.
2. Cambiar `periodo` y `valor` del dato publicado (ISM el 1.er y 3.er día hábil del mes; LEI a mediados de mes).
3. "Commit changes". En 1–2 minutos el proceso recalcula y publica; si el dato es inválido, falla sin publicar y llega un correo.

## Próximas fuentes
Tasas de bancos centrales (módulo Carry), gráficos históricos de FRED, modelos. Mismo patrón: `scripts/<fuente>/core.mjs` + `update.mjs` + `.github/workflows/<fuente>.yml`.
