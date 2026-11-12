# Changelog

## 2026-11-12 — La terminal se muda a Cloudflare Pages
- Producción: https://tfxmacrointelligence.pages.dev (Cloudflare Pages, plan gratuito). Configuración en `docs/architecture.md` → Hosting; `_headers` replica las cabeceras que tenía `netlify.toml`.
- Netlify congelado desde el repo (`netlify.toml` → `ignore = "exit 0"`): no vuelve a construir ni a gastar créditos. tfxmacrointelligence.netlify.app y tfxterminal.netlify.app siguen en línea con su último deploy (leen los datos en vivo), sin cambios de código futuros.
- Los procesos de datos, cron-job.org y el vigilante no cambian: escriben en el repo y la página lee de ahí.

## 2026-11-11 — Componentes del ISM desde la captura manual; Netlify despliega solo cambios de la página
- `data/manual.json` → `ism_componentes` (nuevas órdenes, empleo, precios, actividad de servicios): las tarjetas informativas del ISM se actualizan con el proceso del puntaje; al avanzar el periodo, la lectura anterior pasa a "previo".
- Captura del 11-nov: ISM manufactura oct 55.5 (componentes 55.5 / 52.4 / 75.2), ISM servicios oct 54.5 (actividad 53.8), UMich preliminar nov 51.0 y expectativa 1 año 4.3 %.
- `netlify.toml`: el deploy solo se hace si cambian `index.html`, `assets/` o `netlify.toml`. Antes también desplegaban los cambios de scripts, workflows y documentación (15 créditos cada uno); el 11-nov se agotaron los créditos del ciclo.

## 2026-11-11 — Fase 3: nowcast automático (Modelos y Escenarios)
- Nuevo `scripts/nowcast/` → `data/nowcast.json` (→ `D.snap.nowcast`, `nc_order`, `evt`), paso "Nowcast" del workflow del puntaje, después de la agenda (de ella toma la hora de publicación y el consenso). Modelos y las pestañas Modelo y Escenarios del Catalizador dejan de depender de la carga manual del 16-oct.
- Reconstruido en JavaScript sin dependencias (`stats.mjs`): regresión con las variantes guardadas, ARIMA(p,0,q) por mínimos cuadrados condicionales con orden por AIC, ensamble por inverso del error cuadrático, GARCH(1,1) con errores t cuando la prueba ARCH-LM lo justifica, Monte Carlo de 20,000 escenarios calibrado para que la banda del 90 % cubra el 90 % de los errores históricos, abanico a 6 meses y backtest mensual desde 2016.
- `node scripts/nowcast/check.mjs` reconstruye el modelo con los datos tal como se conocían el 16-oct (ALFRED): CPI oct **0.418 frente a 0.418** guardado, mismo error de la regresión (0.145) y mismo peso del ensamble (0.743 frente a 0.742). Core CPI y NFP quedan cerca; los órdenes ARIMA difieren porque el original usó máxima verosimilitud exacta.
- Estudio de evento (Escenarios): reacción del día del CPI desde 2016 según el tercil de la sorpresa frente al modelo. El "DXY" es el índice amplio del dólar de la Fed (FRED DTWEXBGS); 2Y de FRED; S&P 500 y oro de las velas guardadas + Yahoo.
- Meses inexistentes del CPI (oct-nov 2025, cierre del gobierno): las regresiones nunca los usan; el ARIMA y la base del a/a (abanico, a/a previo) usan el índice interpolado geométricamente, como ya decía la nota bajo el gráfico.
- Sello de Modelos: "Automático · FRED". El vigilante revisa `nowcast.json`. Con esto, los 12 módulos del menú se actualizan solos.
- Decisión del propietario (2026-11-11): la terminal es de **uso propio**, no se comercializa; se pueden usar las fuentes no oficiales o con licencia (Yahoo, ForexFactory, ISM, UMich) para uso personal.

## 2026-11-11 — Fase 2: Catalizador → agenda automática
- Nuevo `scripts/calendar/` → `data/calendar.json` (→ `D.snap.calendar`), dentro del proceso del puntaje (corre a las horas exactas de los datos vía cron-job.org). Sustituye la agenda escrita a mano el 16-oct, que tenía en blanco los 11 resultados publicados desde el 22-oct.
- Fechas: FRED `release/dates` (CPI, PPI, empleo, ventas, solicitudes, PIB, PCE, ECI, JOLTS: el calendario oficial de cada agencia, 1–2 meses hacia adelante); ISM por regla (1.er y 3.er día hábil); FOMC desde `scripts/calendar/fomc.json` (se actualiza una vez al año; el vigilante avisa cuando quedan menos de 60 días cubiertos).
- Actual y previo desde FRED. Los eventos pasados conservan el dato tal como se publicó; si después se revisa, el siguiente evento marca el previo con "(rev.)" (p. ej. NFP sep: publicado +29k, hoy +60k). ISM y UMich: de `data/manual.json` (licencia).
- Consenso y hora exacta de la semana (incluye cambios por festivos): feed semanal de ForexFactory (no oficial, uso propio). Si no responde (p. ej. HTTP 429), se conserva el consenso ya guardado; el vigilante avisa si pasan más de 8 días sin consenso.
- Los años-a-año del CPI de octubre de 2026 quedan vacíos: FRED no tiene octubre de 2025 (cierre del gobierno de EE.UU.). No se rellenan.
- Sello del Catalizador: "Automático · FRED + ForexFactory". Las pestañas "Modelo vs consenso" y "Escenarios" siguen usando el nowcast manual (Modelos) y lo dicen en pantalla.
- El paso de la agenda es independiente del puntaje: si uno falla, el otro publica igual y la ejecución queda marcada como fallida (correo de GitHub).

## 2026-11-11 — Fase 1: bonos y curva automáticos, tarjetas desde FRED, sello por insumo y vigilante
- Cuantitativo → Rendimientos de los bonos (curva por plazos, diferenciales, régimen de la curva y tablas del 2Y y el 10Y) se calcula desde FRED en el proceso del puntaje (`scripts/macro/curve.mjs` → `data/macro.json`). Antes seguía con los datos del 14-oct bajo el sello "Automático": mostraba el 2Y en 4.82% y el 10Y en 5.19% cuando ya estaban en 4.56% y 4.88%.
- `node scripts/macro/check-curve.mjs` reconstruye la sección con los datos del 14-oct: coinciden 460 de 537 valores (85.7 %). La curva por plazo coincide en 9 de 10 plazos; el 30Y difiere por su hueco de 2002–2006; el resto son meses recientes que entran o salen por la disponibilidad del CPI (oct-2025, cierre del gobierno), con diferencias de décimas de punto básico.
- Tarjetas informativas (ventas minoristas, PPI general, ADP, PIB t/t y a/a) desde FRED (`scripts/macro/info.mjs`); ADP sale de `ADPMNUSNERSA`. Los componentes del ISM siguen siendo manuales. Ya no muestran el consenso (no hay fuente gratuita; llegará con el Catalizador automático).
- Sello por insumo: Resumen, Cuantitativo y Ciclo indican cuántos insumos van atrasados frente a su calendario habitual (al pasar el cursor se ven cuáles) y la tabla los marca como "atrasado".
- Vigilante diario (`scripts/watchdog/check.mjs` + `.github/workflows/watchdog.yml`): abre un issue (llega por correo) si un archivo de `data/` o la captura manual se atrasan, y lo cierra cuando todo vuelve a estar al día. Opcional: secreto `DISCORD_WEBHOOK_URL`.
- Guía del disparador externo para horarios puntuales: `docs/disparador-externo.md`.

## 2026-11-11 — Datos fuera de los deploys de Netlify y refresco automático
- La cuenta de Netlify está en el plan Free por créditos (300 al mes, 15 por deploy de producción) y los procesos de datos generaban unos 3 deploys al día: el 11-nov quedaban 70 créditos. `netlify.toml` omite el deploy cuando un commit solo cambia `data/`; la página lee `data/` del repo (`raw.githubusercontent.com`, rama `main`, caché de 5 minutos) y, si no responde, la copia publicada con el código.
- La página abierta revisa cada 5 minutos (solo con la pestaña visible) si cambiaron `macro`, `carry`, `vol` y `mkt-live` (el COT cada 30 minutos); si hay datos nuevos avisa y se recarga a los 30 s, conservando la sección y la posición. "Más tarde" pospone 10 minutos.

## 2026-11-09 — Distribución: datos macroeconómicos automáticos (FRED)
- Nuevo `scripts/macro/dist.mjs`, dentro del proceso diario del puntaje: las 23 series de Distribución → Datos macroeconómicos se recalculan desde FRED (historial completo), los gráficos que ya mantiene el proceso (ISM y UMich con la captura manual) y los cierres mensuales del S&P 500 (histórico + Yahoo) → `data/dist.json` (→ `D.series`).
- `scripts/macro/check-dist.mjs` compara contra los valores anteriores: coinciden 142,065 de 145,001 (97.98 %). Las diferencias son revisiones de FRED (últimos meses de CPI, PPI, NFP, permisos; OECD CLI revisa toda su historia; M2 desde 2021; PIB desde 2021) y series que venían del libro A.E. y FRED publica distinto (Fed funds mensual = promedio oficial FEDFUNDS, la misma decisión ya tomada en Gráficos; UMich ene-2025).
- ISM manufactura 1950: se corrige el mes faltante (may-1950), como en Gráficos.
- Los meses de las series diarias (WTI, bonos, breakeven, curva) solo se cuentan cerrados; las semanas incluyen la semana en curso, como antes.
- `data/snapshot.json` pasa de 3.5 MB a 0.4 MB: las series de Distribución y los datos de Volatilidad y Estacionalidad ya no se cargan de ahí. Los valores originales quedan como referencia en `scripts/reference/snapshot-2026-10-16.json` (solo para las verificaciones).
- Sello de Distribución → Datos macroeconómicos: "Automático · FRED".

## 2026-11-09 — Velas vivas en Distribución (Mercados) y Posicionamiento
- La mesa de velas (Distribución → Mercados: niveles, ATRP, DoR, percentiles, matriz, pips) y el gráfico de precio de Posicionamiento leen también `data/mkt-live.json`: las velas diarias de Yahoo se agregan tras el histórico y forman las semanas (fechadas en domingo) y los meses; la última vela guardada absorbe los días de su periodo.
- `data/mkt-live.json` es opcional para la página: si no carga, se muestran solo las velas guardadas.
- Precios de Yahoo redondeados a los decimales de cotización (5 FX, 3 JPY y plata, 2 resto) y máximo/mínimo corregidos cuando Yahoo deja el cierre fuera del rango.
- El sello de Distribución depende de la vista: Mercados = automático (Yahoo Finance); Datos macroeconómicos sigue manual.

## 2026-11-09 — Volatilidad y Estacionalidad automáticas (Yahoo Finance)
- Nuevo pipeline `scripts/markets/` + `.github/workflows/markets.yml`: velas diarias de Yahoo Finance extienden el histórico guardado (`data/markets.json`, Investing.com) → `data/mkt-live.json`; de ahí se recalculan `data/vol.json` (→ `D.snap.vol`) y `data/seas.json` (→ `D.snap.seas`) cada día hábil.
- `scripts/markets/check.mjs` reconstruye ambos módulos solo con las velas guardadas y los compara con `data/snapshot.json`: coinciden todos los valores (25 instrumentos en Estacionalidad; 7,242 sesiones en Volatilidad).
- Vol y Estacional pasan de "Manual · 16-oct" a "Automático · Yahoo Finance". US30 diario tenía un hueco desde 2025-10-31; queda cubierto.
- Investing.com bloquea la descarga automática (HTTP 403): no se usa como fuente del pipeline.

## 2026-10-24 — Ciclo automático
- Fases, reloj, frecuencias y proyección del ciclo se recalculan cada día desde el OECD CLI (FRED) con el proceso del puntaje.
- `data/manual.json` incorpora `lei_6m.previo` y `cei_6m` (índice coincidente).
- Ocultos Sentimiento, Dólar y Régimen de mercado (Ciclo y Resumen) hasta definir sus reglas.

## 2026-10-24 — Gráficos automático
- 25 series mensuales de Gráficos se actualizan con el proceso diario del puntaje (`data/charts.json`); el estado actual sale del puntaje; la proyección queda oculta.
- Corregido el orden de fechas del ISM manufactura (1950-05).
- Los procesos automáticos también se ejecutan al cambiar su propio código, para probarlo en cuanto se publica.

## 2026-10-24 — Carry simplificado e indicador de antigüedad
- Carry muestra solo los 28 pares (7 mayores y 21 menores) con tasas, diferencial y dirección del swap positivo. Se eliminaron próximas reuniones (`data/cb-calendar.json`), precios del BCE y carry en USD/día.
- Cada módulo muestra en su encabezado si sus datos son automáticos (fuente y fecha; rojo si el proceso lleva días sin datos nuevos) o manuales (fecha de carga; resaltado tras 7 días).

## 2026-10-24 — Carry automático
- Nuevo pipeline `scripts/carry/` + `.github/workflows/carry.yml`: tasas del BIS y FRED, precios del BCE, próxima reunión desde `data/cb-calendar.json` → `data/carry.json`. Sustituye a CB.watch y a los precios del bróker.
- `data/manual.json` admite `tasas` para reflejar una decisión antes que el BIS.
- Corregidos 3 textos con caracteres mal codificados introducidos en la Etapa 1 (mensaje de error de carga y aviso del lector de Excel).

## 2026-10-24 — Puntaje macro automático (FRED)
- Nuevo pipeline `scripts/macro/` + `.github/workflows/macro.yml`: 16 series de FRED + `data/manual.json` (ISM, LEI, UMich preliminar) → `data/macro.json`, dos veces por día hábil y al editar la captura manual.
- Resumen y Cuantitativo leen `data/macro.json`. Verificado: al 16-oct reproduce exactamente los 19 puntajes y el compuesto +0.93.
- Supuestos de reglas no documentadas registrados en `docs/decisions.md`.
- El workflow del COT hace `git pull --rebase` antes de publicar, para convivir con el de macro.

## 2026-10-24 — COT automático y lectura swing
- Nuevo pipeline `scripts/cot/` + `.github/workflows/cot.yml`: descarga el COT de la API de la CFTC cada semana, valida y publica `data/cot.json`. Verificado valor por valor contra los datos anteriores.
- `data/cot.json` ya incluye el informe del 2026-10-20 (la terminal estaba en el 13-oct). Se quitó el bloque `pos` de `snapshot.json`.
- Nuevo dato: neto de Asset Managers (dinero real) para cada divisa.
- Posicionamiento: sello con próximo informe y aviso de dato desactualizado; nueva sección "Lectura swing del par" con KPIs, posicionamiento del par frente al precio, índice COT (26/52/156 semanas), flujo semanal, dinero rápido frente a dinero real, mapa de saturación y retornos del par tras extremos (4/8/13 semanas).
- En pares XXXUSD el posicionamiento del par es el del contrato base (los futuros de divisas de CME ya cotizan contra el dólar); en cruces, la diferencia entre ambos contratos.

## 2026-10-24 — Etapa 1: estructura del repositorio
- Importada la terminal publicada (datos al 16-oct-2026) y dividida en `index.html`, `assets/app.css`, `assets/app.js`, `data/snapshot.json`, `data/markets.json`.
- SheetJS 0.18.5 deja de ir embebido (1.3 MB) y se descarga de cdnjs solo al subir un Excel.
- Mensaje de error visible si los datos no cargan.
- `netlify.toml` con revalidación de `/data` y cabeceras básicas.
- Verificación: los 12 módulos producen exactamente el mismo texto y número de gráficos que producción; lectura/escritura de Excel probada; sin errores de consola.
