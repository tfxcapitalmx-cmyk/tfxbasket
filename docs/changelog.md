# Changelog

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
