# Roadmap

## Etapa 1 — Stabilization & Code Quality
- [x] Repositorio versionado (rama `terminal`).
- [x] Separar el HTML de 8 MB en `index.html`, `assets/` y `data/` sin cambiar el render (verificado módulo por módulo).
- [x] SheetJS bajo demanda (−1.3 MB).
- [ ] Conectar Netlify al repo con Deploy Previews (requiere aprobación del propietario).
- [ ] Reconstruir el generador de `snapshot.json`: no existe fuera de los chats anteriores. La fuente manual es el libro A.E. (ver CLAUDE.md); los modelos ARIMA/GARCH/Monte Carlo/regresiones deben reescribirse como scripts del repo.
- [ ] Corregir fecha fuera de orden en `snap.charts.pmi` (1950-05).
- [ ] Esquema estándar de observación (valor, previo, revisado, vintage, published_at, fetched_at, estado).
- [ ] Cargar `markets.json` solo cuando se abre un módulo de precios.

Aceptación: el sitio publicado desde el repo se ve igual que hoy.

## Etapa 2 — Automated Macro Data
1. [x] COT (CFTC) — patrón de referencia (`docs/data-pipeline.md`). Falta activarlo: fusionar a `main` y conectar Netlify.
2. [x] Series FRED del puntaje (Resumen + Cuantitativo). Pendiente: confirmar supuestos de `docs/decisions.md`; tarjetas informativas (componentes ISM, ADP, PIB) y módulo Gráficos siguen manuales.
3. Tasas de bancos centrales oficiales.
4. Indicador visual de antigüedad por panel y alertas por fallo persistente.

Aceptación: 7 días sin intervención manual en las fuentes automatizadas.

## Etapa 3 — Macro Intelligence Engine
Llevar nowcast/proyecciones al pipeline; capa de interpretación; reglas metodológicas de escenarios definidas con el propietario antes de programar.

## Etapa 4 — Commercial Readiness
Licencias de datos, autenticación, roles, suscripciones (Stripe), base de datos.
