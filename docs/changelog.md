# Changelog

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
