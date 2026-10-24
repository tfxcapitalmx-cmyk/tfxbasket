# Fuentes de datos

Estado al 2026-10-24. "Automatizable" = API oficial con uso comercial razonable; confirmar términos antes de comercializar.

| Dato en la terminal | Fuente actual | Fuente objetivo | Licencia / riesgo | Automatizable |
|---|---|---|---|---|
| CPI, Core CPI, Core PPI, desempleo, solicitudes, NFP, UST 2Y/10Y, breakeven 5Y, WTI, M2, Fed funds, permisos, OECD CLI (puntaje) | **FRED API, automático** | — | BLS/BEA/Fed/Tesoro son dominio público; revisar notas de copyright por serie | **Hecho** (2026-10-24) |
| Curva completa, ventas minoristas, gráficos históricos | FRED (manual) | FRED API | Igual | Sí |
| NFP | Libro A.E. TFX | FRED `PAYEMS` | Dominio público (BLS) | Sí |
| PIB real | Libro A.E. TFX | FRED / BEA API | Dominio público | Sí |
| OECD CLI | FRED | OECD SDMX API | Uso con atribución | Sí |
| ISM manufactura / servicios y componentes | Libro A.E. TFX | — | Copyright ISM; requiere licencia para redistribuir | No sin licencia |
| UMich sentimiento y expectativa de inflación | FRED / Libro | — | Copyright Univ. de Michigan | No sin licencia |
| LEI Conference Board | Manual | — | Propietario, de pago | No sin licencia |
| COT Leveraged Funds, Asset Managers, no reportables | **CFTC Socrata API (TFF), automático** | — | Dominio público | **Hecho** (2026-10-24) |
| Tasas de bancos centrales | BCE, BoJ, BoC, "TFX", CB.watch | APIs/feeds oficiales de cada banco | Oficiales: sí; CB.watch: no | Sí (oficiales) |
| Calendario y consenso | Manual (consenso en 9 de 48 eventos) | Calendarios oficiales; consenso de proveedor con licencia | El consenso no es gratuito | Parcial |
| Velas FX, índices, metales, VIX | Broker / Investing.com (manual) | Proveedor con licencia comercial | Sin derecho de redistribución | Requiere contratar |
| S&P 500 | Investing.com export | Proveedor con licencia | Igual que arriba | Requiere contratar |
