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

## Gráficos (series mensuales)

| | |
|---|---|
| Alimenta | Módulo Gráficos (`data/charts.json` → `D.snap.charts`); lo genera el mismo proceso que el puntaje (`scripts/macro/charts.mjs`) |
| Fuentes | Las series FRED del puntaje + T10Y2Y, GDPC1, RSAFS, SP500, FEDFUNDS. ISM: `data/manual.json` mes a mes. UMich: FRED + lectura preliminar manual |
| Método | Se conserva el historial guardado y se recalculan los últimos 36 meses en cada ejecución (para recoger revisiones); los meses nuevos se agregan. Diarias → promedio mensual; S&P 500 → último cierre del mes; Fed funds → promedio oficial, con la tasa vigente en el último mes publicado |
| Estado actual | Sale de la fila equivalente del puntaje (16 series). Las 9 sin regla (CPI general, Core PPI a/a, curva, Fed funds, PIB, ventas minoristas nominales y reales, S&P 500 y su a/a) muestran "Sin regla definida" |
| Proyección | Oculta hasta definir sus reglas con el propietario (`PRJ={}` en `app.js`; `D.snap.proj` se conserva sin usar) |

Reproducción verificada (2026-10-24): al 16-oct las 25 series coinciden con el historial anterior salvo revisiones de FRED, y los 16 estados con regla son idénticos.

## Ciclo económico

| | |
|---|---|
| Alimenta | Módulo Ciclo, la frase de ciclo en Resumen y las fases OCDE de Gráficos (`D.snap.cycle`, `D.snap.cycproj`, dentro de `data/macro.json`); `scripts/macro/cycle.mjs` |
| Fuentes | OECD CLI de FRED (desde 1955). LEI 6m (con su lectura previa) y CEI 6m de The Conference Board: `data/manual.json` |
| Regla de fases | CLI ≥ 100 y subiendo = expansión; ≥ 100 y bajando = desaceleración; < 100 y bajando = contracción; < 100 y subiendo = recuperación |
| Proyección | Frecuencias históricas: meses en la misma fase con al menos la racha actual → fase a 3, 6 y 12 meses; variante con impulso a la baja (segunda diferencia < 0). Tiempo restante = cuartiles de lo que duraron las fases iguales que alcanzaron la racha actual |
| Oculto | Sentimiento, Dólar y Régimen (`D.snap.regime_mkt`, modelo de cuadrantes sin reglas documentadas); también se quitó su mención en Resumen |

Reproducción verificada (2026-10-24): con el historial guardado, fase, racha, frecuencias, duraciones, transiciones, proyección a 3/6/12 meses y tiempo restante coinciden exactamente.

## Carry (dirección del swap)

| | |
|---|---|
| Alimenta | Módulo Carry: los 28 pares mayores y menores con la dirección del swap (`data/carry.json` → `D.snap.carry`) |
| Tasas | BIS `WS_CBPOL` (oficial, gratis, los 7 bancos no estadounidenses en una consulta). Fed: FRED DFF (efectiva) y DFEDTARL/DFEDTARU (rango) |
| Override | `data/manual.json` → `tasas`: una tasa con fecha de vigor más reciente que el último cambio del BIS lo sustituye (el BIS publica con 2–7 días de retraso) |
| Calendario | Lunes a viernes 16:00 UTC y al editar `manual.json` |
| Validación | Tasas en −2…30 %, cada banco con dato en los últimos 21 días, 28 pares |

Reproducción verificada (2026-10-24): al 16-oct coinciden las tasas, los diferenciales y la dirección del swap de los 28 pares. Por decisión del propietario el módulo solo muestra la tabla de pares (sin próximas reuniones, precios ni carry en USD).

## Distribución → Datos macroeconómicos

| | |
|---|---|
| Alimenta | `data/dist.json` → `D.series` (23 series, 70 horizontes); lo genera el proceso del puntaje (`scripts/macro/dist.mjs`) |
| Fuentes | FRED, historial completo: CPIAUCSL, CPILFESL, PPIFIS, PPIFES, DCOILWTICO, T5YIE, T10Y2Y, UNRATE, ICSA, USALOLITOAASTSAM, MICH, DGS2, DGS10, PAYEMS, GDPC1, M2SL, FEDFUNDS, PERMIT, RSAFS. ISM y UMich: series de Gráficos (FRED + `data/manual.json`). S&P 500: cierres mensuales de `markets.json` + Yahoo |
| Definiciones | m/m y a/a por fecha de calendario; 3m anualizado = (x/x₋₃)⁴−1; diarias: cambio contra la observación previa (pb en tasas); semanal = último cierre de la semana (clave viernes) contra el anterior, con rango máx−mín (sobre el mínimo en WTI); mensual = mes calendario cerrado; WTI m/m y a/a sobre el promedio mensual; curva nivel = promedio mensual en pb; ICSA 4 sem a/a = promedio de 4 semanas contra las mismas 52 semanas antes; ventas reales = ventas / CPI; PIB t/t anualizado |
| Historial | Se recalcula completo en cada ejecución (recoge revisiones). Lo anterior a la primera fecha que FRED permite calcular se conserva del archivo previo |
| Validación | Ninguna serie u horizonte puede desaparecer, encogerse más de 3 %, retroceder en fecha, tener fechas desordenadas o valores no numéricos |

Reproducción verificada (2026-11-09): `node scripts/macro/check-dist.mjs` (requiere `.cache/fred/<ID>.json`) → 97.98 % de los valores idénticos; el resto, revisiones de FRED o diferencias del libro A.E.

## Mercados (Volatilidad y Estacionalidad)

| | |
|---|---|
| Alimenta | Módulos Volatilidad (`data/vol.json` → `D.snap.vol`) y Estacionalidad (`data/seas.json` → `D.snap.seas`); `scripts/markets/` |
| Fuente | Yahoo Finance, `query1.finance.yahoo.com/v8/chart` (no oficial, sin clave): 18 cruces FX (`XXXYYY=X`), `^NDX`, `^GSPC`, `^DJI`, `^VIX`, `CL=F`, `GC=F`, `SI=F` |
| Método | `data/markets.json` (histórico de Investing.com) no se modifica. `data/mkt-live.json` guarda las velas diarias de Yahoo posteriores a la última fecha del histórico; cada ejecución relee las últimas 2 semanas (revisiones y vela parcial). Estacionalidad: meses guardados hasta el mes de la última vela mensual y cierres derivados de las velas diarias desde ahí. Volatilidad: sesiones comunes de VIX y S&P 500 desde 1998 |
| Calendario | Lunes a viernes 22:45 UTC y martes a sábado 00:30 UTC (recoge la vela completa), y al editar `scripts/markets/**` |
| Validación | Yahoo debe coincidir con el histórico guardado en el solape (0.05 % índices, 1 % FX, 5 % futuros); cada instrumento con dato de menos de 6 días; 7,000+ sesiones alineadas, VIX y S&P en rango, correlación entre −0.95 y −0.5, tramos que suman las sesiones; 25 instrumentos con estadísticos en rango |
| Velas del día | Índices y futuros: se descarta la vela de hoy hasta las 22:00 UTC (aún se forma). FX: se conserva (precio vigente) y se corrige al día siguiente |
| En la terminal | Sello "Automático · Yahoo Finance · datos al …" en Volatilidad, Estacionalidad y Distribución → Mercados (fecha del instrumento menos actualizado). En el navegador, `MKSEED` (app.js) agrega `mkt-live.json` a las velas guardadas: diarias tras la última fecha; semanas (domingo) y meses (día 1) se completan con los días vivos |

Reproducción verificada (2026-11-09): `node scripts/markets/check.mjs` reconstruye ambos módulos con las velas guardadas y coinciden todos los valores con `data/snapshot.json`.

## Bonos y curva (Cuantitativo)

| | |
|---|---|
| Alimenta | `D.snap.curve` y `D.snap.yields` dentro de `data/macro.json`; `scripts/macro/curve.mjs` |
| Fuentes | FRED diario desde 1962: DGS3MO, DGS6MO, DGS1, DGS2, DGS3, DGS5, DGS7, DGS10, DGS20, DGS30. Mensuales (de Gráficos): Fed funds, core y CPI a/a, desempleo |
| Definiciones | Rendimiento mensual = promedio de los días del mes (2 decimales en la tabla de la curva; el mes en curso, sin redondear). Tramos de 6 meses: ≤ −75, −75/−25, ±25, +25/+75, ≥ +75 pb. Resultados a 6 y 12 meses; un movimiento de la Fed cuenta si supera 12.5 pb. Régimen: nivel = promedio de 2Y y 10Y, pendiente = 10Y − 2Y; nivel estable si se mueve menos de 25 pb, steepening o flattening si la pendiente se mueve más de 10 pb. Las tablas del 2Y y el 10Y y los regímenes empiezan en 1977 |
| Validación | 10 plazos con rendimientos en rango, al menos 30 meses por tramo y 500 por tabla, régimen conocido; error si la curva lleva más de 10 días sin datos |

Reproducción (2026-11-11): `node scripts/macro/check-curve.mjs` (requiere `.cache/fred/<ID>.json`) → 85.7 % de los valores idénticos; ver `docs/changelog.md`.

## Tarjetas informativas

`scripts/macro/info.mjs`, dentro del proceso del puntaje: ventas minoristas (RSAFS; real = ventas / CPI), PPI demanda final (PPIFIS), ADP (ADPMNUSNERSA), PIB real (GDPC1). Los componentes del ISM se conservan como estén (captura manual).

## Vigilante

`.github/workflows/watchdog.yml` corre a diario y `scripts/watchdog/check.mjs` compara la fecha de cada archivo de `data/` con su máximo (macro 4 días, carry 14, COT 13, mercados 5…) y la captura manual con su calendario. Si algo se atrasa abre un issue (GitHub avisa por correo) o lo actualiza, y lo cierra cuando todo vuelve a estar al día.

## Horarios puntuales

Los cron de GitHub se retrasan entre 3 y 9 horas. Ver `docs/disparador-externo.md` (cron-job.org → `workflow_dispatch`).

## Catalizador → agenda

| | |
|---|---|
| Alimenta | `data/calendar.json` → `D.snap.calendar` (pestaña Agenda y el "próximo catalizador" de Modelo y Escenarios); `scripts/calendar/`, paso "Agenda del Catalizador" de `.github/workflows/macro.yml` |
| Fechas | FRED `release/dates` (IDs: CPI 10, PPI 46, ventas 9, empleo 50, solicitudes 180, PIB 53, PCE 54, ECI 11, JOLTS 192). ISM: 1.er (manufactura) y 3.er (servicios) día hábil, 10:00 NY. FOMC: `scripts/calendar/fomc.json`, 14:00 NY. Horas en hora de Nueva York convertidas a UTC con el horario de verano de EE.UU. |
| Valores | Actual y previo desde FRED (CPIAUCSL, CPILFESL, PPIFIS, PPIFES, RSAFS, PAYEMS, UNRATE, ICSA, GDPC1, PCEPI, ECIALLCIV, JTSJOL, DFEDTARL/U). Un evento pasado conserva el valor tal como se publicó; el previo del siguiente lleva "(rev.)" si FRED lo revisó. ISM y UMich: `data/manual.json` |
| Consenso | ForexFactory, `nfs.faireconomy.media/ff_calendar_thisweek.json` (semana en curso). También corrige la hora exacta (festivos) y agrega eventos sin fecha en FRED (UMich, LEI). Se conserva entre ejecuciones |
| Ventana | 60 días hacia atrás y 120 hacia adelante; los eventos de ejecuciones anteriores dentro de la ventana se conservan |
| Validación | Al menos 20 eventos y 10 futuros, sin duplicados, fechas ISO, CPI y NFP en los próximos 45 días |

Prueba local sin clave: `FRED_CACHE=.cache/fred node scripts/calendar/update.mjs` (requiere `.cache/fred/_dates.json` y las series).

## Próximas fuentes
Gráficos históricos de FRED, modelos. Mismo patrón: `scripts/<fuente>/core.mjs` + `update.mjs` + `.github/workflows/<fuente>.yml`.
