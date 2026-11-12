# Decisiones

## 2026-11-12 — a/a cuando falta el mes base (oct-2025)
Opciones: (a) tomar el mes anterior, como se hacía: es una variación de 13 meses rotulada como anual; (b) dejarlo vacío: la terminal perdería el dato de inflación más visto durante un mes; (c) interpolar la base entre los meses vecinos. Se eligió (c): es una estimación del índice base, no del dato publicado, se aplica solo a series mensuales con vecinos a no más de 3 meses y se indica en pantalla. El nowcast ya usaba este criterio.

## 2026-11-12 — Hosting: de Netlify a Cloudflare Pages
Netlify en su plan gratuito por créditos cobra 15 de 300 créditos mensuales por cada deploy de producción; el 11-nov se agotaron con 4 deploys de código y se pausaron los deploys. Cloudflare Pages gratis da 500 builds al mes y ancho de banda ilimitado, y permite proteger el sitio con Cloudflare Access sin costo. La terminal es estática y sus datos ya se leían del repo, así que el cambio no toca código ni procesos de datos. Se descartó GitHub Pages (no permite sitio privado en el plan gratuito) y Vercel (su plan gratuito prohíbe uso comercial y tiene límites similares).

## 2026-11-11 — Uso propio, sin comercialización
El propietario decide que la terminal es solo de uso propio. Las fuentes no oficiales o con licencia (Yahoo Finance, ForexFactory, ISM, UMich, Conference Board) se usan para uso personal. Si algún día se comercializa, hay que sustituirlas o licenciarlas (ver `docs/data-sources.md`). El repo es público: los datos quedan visibles en GitHub.

## 2026-11-11 — Nowcast reconstruido en JavaScript
Python 3.15 (PC del propietario) no tiene paquetes de `statsmodels`/`arch`; los modelos se reescribieron en JavaScript sin dependencias para poder probarlos en local y en Actions con el mismo código. Reglas que no estaban escritas y se fijaron así:
- Insumos: promedios de m/m sobre índices de FRED (el original usaba el último mes redondeado tal como se publica, p. ej. core sep = 0.3); gasolina = promedio mensual de GASREGW con ajuste estacional por el cambio medio del mismo mes en años previos; solicitudes = promedio mensual de ICSA; el mes en pronóstico usa el último dato semanal disponible si aún no hay semanas del mes; UMich de `data/manual.json` cuando FRED aún no tiene el mes.
- Muestra: entrenamiento desde 2000 (PPI desde 2010), backtest desde 2016; NFP excluye mar-2020 a dic-2021 y elige por error de los últimos 36 meses (cambio de régimen tras la pandemia); el resto por error de toda la muestra.
- Central = el de menor error entre regresión, ARIMA y ensamble. Ensamble con pesos recalculados cada mes con los errores conocidos hasta entonces.
- Monte Carlo redondea como la fuente (0.1 pp; NFP ±10k = en línea) y compara contra el consenso si existe, si no contra el dato previo. "Prob. a/a sube" usa el m/m del mismo mes un año antes; si no existe (CPI nov-2025), el promedio de los 12 meses previos.

## 2026-11-09 — Distribución macro: historial completo desde FRED
Las 23 series se reconstruyeron y el 98 % de los valores coincide exactamente con la versión anterior. Se recalcula todo el historial en cada ejecución (no solo los meses recientes) porque FRED es la fuente oficial y sus revisiones afectan años atrás (OECD CLI, M2, PIB). Donde el libro A.E. y FRED difieren se usa FRED: Fed funds mensual = FEDFUNDS (misma decisión que en Gráficos), UMich y PIB vigentes. ISM sigue siendo captura manual (licencia) y llega a través de Gráficos. El S&P 500 usa los cierres mensuales del histórico de Investing.com extendidos con Yahoo (mismo riesgo de licencia que en Mercados).

## 2026-11-09 — Velas de mercado: Yahoo Finance como capa viva sobre el histórico guardado
Investing.com responde 403 a cualquier descarga automatizada y sus condiciones no lo permiten; Yahoo Finance (endpoint `v8/chart`, sin clave) sí responde y se probó contra el histórico guardado: índices (NAS100, SPX500, US30) y VIX coinciden exactamente (0.000 %); los 18 cruces FX difieren ~0.1 % en el cierre diario (otro corte horario) y WTI, oro y plata (futuros continuos, no spot) ~0.3–0.6 %. Por eso el histórico guardado no se toca y las velas de Yahoo solo lo extienden después de su última fecha (el empalme introduce un salto de esa magnitud, irrelevante para retornos mensuales y percentiles). El proceso aborta si Yahoo se aleja del histórico más de lo tolerado (0.05 % índices, 1 % FX, 5 % futuros) o si algún instrumento lleva más de 6 días sin dato.
- **Riesgo de licencia:** Yahoo Finance es un endpoint no oficial y sus condiciones limitan el uso a fines personales. Vale para uso propio hoy; antes de comercializar (Etapa 4) hay que sustituirlo por un proveedor con licencia (ver `docs/data-sources.md`). Además puede cambiar o bloquearse sin aviso: si falla, el proceso conserva el último dato válido y GitHub avisa por correo.
- **Cálculo reconstruido y verificado, no inventado:** las reglas de Estacionalidad (retornos mensuales de cierre a cierre, estadísticas sobre años completos, prueba t, ventanas 5/10/15/20, fiabilidad fuera de muestra) y de Volatilidad (correlación y betas, correlación móvil de 252 sesiones muestreada por semana, tramos de VIX, movimiento calibrado = |retorno| medio / (0.7979 × implícita), rango = (máx − mín)/mín) se dedujeron de los datos guardados y reproducen `data/snapshot.json` al céntimo (`node scripts/markets/check.mjs`). Detalles que no estaban escritos: el año en curso queda fuera de las estadísticas mensuales; un año se puntúa fuera de muestra con al menos 5/10/14/19 años previos (ventanas 5/10/15/20) y un instrumento necesita 10 años puntuados; la semana de la correlación móvil se etiqueta con el mes de su domingo.
- Mes en curso: el último mes (parcial) entra en la rejilla y en el acumulado del año, como antes, pero no en las estadísticas.
- Futuros continuos (WTI, oro, plata): el cambio de contrato puede meter un salto en el empalme; se acepta para uso propio y queda anotado.

## 2026-10-24 — Reutilizar el repo `tfxbasket`
El repo contenía un proyecto abandonado (index.html + funciones Netlify claude-proxy / sentiment-proxy). Se conserva en la etiqueta `archivo-tfxbasket`; la terminal se desarrolla en la rama `terminal` sin esos archivos.

## 2026-10-24 — Separar datos del código, sin framework
La terminal era un único HTML con datos embebidos. Se separó en archivos estáticos manteniendo el JS original, para poder actualizar datos con commits sin regenerar la página. No se adopta framework: el código actual funciona y reescribirlo no aporta a la automatización.

## 2026-10-24 — Scripts de datos en JavaScript (Node), no Python
La PC del propietario no tiene Python ni Node; los scripts corren en GitHub Actions. JavaScript permite probar el cálculo (`core.mjs`) en el navegador antes de publicar y usa el mismo lenguaje que la terminal. Para los modelos estadísticos pesados (ARIMA/GARCH) se reevaluará Python en Actions cuando se reconstruyan.

## 2026-10-24 — Ciclo: proyección automática, régimen de mercado oculto
La proyección del ciclo solo usa la regla de fases OCDE (objetiva) y frecuencias históricas; se reprodujo exactamente, así que se automatiza. El régimen de mercado (Reflación, Estanflación…) y sus lecturas de S&P/DXY dependen de umbrales de crecimiento e inflación no documentados y de precios con licencia: se ocultan hasta definirlos. Los textos fijos del módulo ("Sin señal de recesión", "sigue creciendo") se sustituyeron por frases que dependen del dato.

## 2026-10-24 — Gráficos: proyección oculta hasta definir reglas
El "Estado proyectado" se calculó en chats anteriores con bandas por indicador que solo están documentadas para las 16 series del puntaje. Por decisión del propietario se automatizan las series y el estado actual, y la proyección queda oculta. Las 9 series sin bandas muestran "Sin regla definida". Fed funds mensual pasa a ser el promedio oficial (FEDFUNDS) en los meses cerrados: corrige algunos valores antiguos (p. ej. sep-2024 5.21 → 5.13).

## 2026-10-24 — Carry: BIS en lugar de una API por banco
El BIS publica las tasas oficiales de los ocho bancos en un solo dataset gratuito y redistribuible. Una API por banco (BoC Valet, SNB, RBA, RBNZ, BoE, BoJ) daría el dato el mismo día, pero son siete integraciones con formatos distintos que mantener. El retraso de 2–7 días se cubre con el override manual en `data/manual.json`. El mismo día el propietario pidió reducir Carry a la tabla de pares con la dirección del swap: se quitaron próximas reuniones (no hay fuente gratuita), precios y carry en USD.

## 2026-10-24 — Puntaje macro: reglas reconstruidas (confirmadas por el propietario el 2026-10-24)
Reglas que no estaban escritas en la terminal ni en el libro A.E. y se reconstruyeron con los umbrales conocidos:
- **Permisos de construcción → PIB implícito** = (permisos − 900) / 200, sin redondeo. Reproduce los umbrales publicados (estable 1,100–1,299k; calienta ≥ 1,300k) y extiende: +2 desde 1,500k, −1 entre 900 y 1,099k, −2 bajo 900k.
- **UST 2Y/10Y cambio 6m**: ≤ −0.50 −2 · −0.50/−0.25 −1 · ±0.25 0 · +0.25/+0.50 +1 · ≥ +0.50 +2 (umbrales publicados: estable ±0.25, calienta ≥ +0.25).
- **WTI a/a**: último cierre frente al cierre del mismo día un año antes. El +60 % de la versión anterior no se reproduce con ninguna definición estándar; ambos dan +2.
- **Fed funds**: tasa efectiva diaria (DFF). "Anterior" = nivel previo al último movimiento.

## 2026-10-24 — Posicionamiento del par
Los futuros de divisas de CME cotizan contra el dólar. En XXXUSD se usa el neto/OI del contrato base; restarle el USD INDEX contaría el dólar dos veces y su escala (±50 % del OI) dominaría la lectura. En cruces se usa base − cotizada.

## 2026-10-24 — Pipeline propuesto: GitHub Actions → JSON → Netlify
Frente a Netlify Scheduled Functions + Blobs: Actions permite Python (modelos ARIMA/regresión), no tiene el límite de ~30 s y el historial de git da vintages y rollback gratis. Revisar cuando haya usuarios (Etapa 4) y se necesite base de datos.
