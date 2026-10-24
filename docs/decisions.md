# Decisiones

## 2026-10-24 — Reutilizar el repo `tfxbasket`
El repo contenía un proyecto abandonado (index.html + funciones Netlify claude-proxy / sentiment-proxy). Se conserva en la etiqueta `archivo-tfxbasket`; la terminal se desarrolla en la rama `terminal` sin esos archivos.

## 2026-10-24 — Separar datos del código, sin framework
La terminal era un único HTML con datos embebidos. Se separó en archivos estáticos manteniendo el JS original, para poder actualizar datos con commits sin regenerar la página. No se adopta framework: el código actual funciona y reescribirlo no aporta a la automatización.

## 2026-10-24 — Scripts de datos en JavaScript (Node), no Python
La PC del propietario no tiene Python ni Node; los scripts corren en GitHub Actions. JavaScript permite probar el cálculo (`core.mjs`) en el navegador antes de publicar y usa el mismo lenguaje que la terminal. Para los modelos estadísticos pesados (ARIMA/GARCH) se reevaluará Python en Actions cuando se reconstruyan.

## 2026-10-24 — Posicionamiento del par
Los futuros de divisas de CME cotizan contra el dólar. En XXXUSD se usa el neto/OI del contrato base; restarle el USD INDEX contaría el dólar dos veces y su escala (±50 % del OI) dominaría la lectura. En cruces se usa base − cotizada.

## 2026-10-24 — Pipeline propuesto: GitHub Actions → JSON → Netlify
Frente a Netlify Scheduled Functions + Blobs: Actions permite Python (modelos ARIMA/regresión), no tiene el límite de ~30 s y el historial de git da vintages y rollback gratis. Revisar cuando haya usuarios (Etapa 4) y se necesite base de datos.
