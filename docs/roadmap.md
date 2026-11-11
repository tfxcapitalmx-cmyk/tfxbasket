# Roadmap

## Etapa 1 — Stabilization & Code Quality
- [x] Repositorio versionado (rama `terminal`).
- [x] Separar el HTML de 8 MB en `index.html`, `assets/` y `data/` sin cambiar el render (verificado módulo por módulo).
- [x] SheetJS bajo demanda (−1.3 MB).
- [ ] Conectar Netlify al repo con Deploy Previews (requiere aprobación del propietario).
- [ ] Reconstruir el generador de `snapshot.json`: no existe fuera de los chats anteriores. La fuente manual es el libro A.E. (ver CLAUDE.md); los modelos ARIMA/GARCH/Monte Carlo/regresiones deben reescribirse como scripts del repo.
- [x] Corregir fecha fuera de orden en `snap.charts.pmi` (1950-05).
- [x] Sello de antigüedad por insumo (2026-11-11), en el navegador; falta el esquema completo.
- [ ] Esquema estándar de observación (valor, previo, revisado, vintage, published_at, fetched_at, estado).
- [ ] Cargar `markets.json` solo cuando se abre un módulo de precios.

Aceptación: el sitio publicado desde el repo se ve igual que hoy.

## Etapa 2 — Automated Macro Data
1. [x] COT (CFTC) — patrón de referencia (`docs/data-pipeline.md`). Activo en `main` y en tfxterminal.netlify.app; falta conectar el sitio de producción en Netlify.
2. [x] Series FRED del puntaje (Resumen + Cuantitativo). Supuestos confirmados. Ciclo automático (régimen de mercado oculto). Gráficos automático (proyección oculta hasta definir reglas). Tarjetas informativas: ventas, PPI, ADP y PIB automáticas desde FRED (2026-11-11); componentes ISM siguen manuales. Bonos y curva automáticos (2026-11-11).
3. [x] Tasas de bancos centrales oficiales (Carry: dirección del swap de 28 pares).
4. [x] Indicador de antigüedad en cada panel (automático/manual, fecha, aviso si está atrasado). Los fallos de los procesos automáticos llegan por correo de GitHub.
5. [x] Volatilidad y Estacionalidad (Yahoo Finance sobre el histórico guardado). La misma capa alimenta Distribución → Mercados y el precio de Posicionamiento. Distribución → Datos macroeconómicos también es automático (FRED, con el puntaje).

6. [x] Catalizador → agenda automática (FRED + ForexFactory, 2026-11-11). Pendiente: nowcast y escenarios (Etapa 3).

Aceptación: 7 días sin intervención manual en las fuentes automatizadas.

## Etapa 3 — Macro Intelligence Engine
Llevar nowcast/proyecciones al pipeline; capa de interpretación; reglas metodológicas de escenarios definidas con el propietario antes de programar.

## Etapa 4 — Commercial Readiness
Licencias de datos, autenticación, roles, suscripciones (Stripe), base de datos.
