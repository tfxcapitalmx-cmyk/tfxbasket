# Decisiones

## 2026-10-24 — Reutilizar el repo `tfxbasket`
El repo contenía un proyecto abandonado (index.html + funciones Netlify claude-proxy / sentiment-proxy). Se conserva en la etiqueta `archivo-tfxbasket`; la terminal se desarrolla en la rama `terminal` sin esos archivos.

## 2026-10-24 — Separar datos del código, sin framework
La terminal era un único HTML con datos embebidos. Se separó en archivos estáticos manteniendo el JS original, para poder actualizar datos con commits sin regenerar la página. No se adopta framework: el código actual funciona y reescribirlo no aporta a la automatización.

## 2026-10-24 — Scripts de datos en JavaScript (Node), no Python
La PC del propietario no tiene Python ni Node; los scripts corren en GitHub Actions. JavaScript permite probar el cálculo (`core.mjs`) en el navegador antes de publicar y usa el mismo lenguaje que la terminal. Para los modelos estadísticos pesados (ARIMA/GARCH) se reevaluará Python en Actions cuando se reconstruyan.

## 2026-10-24 — Puntaje macro: supuestos pendientes de confirmar por el propietario
Reglas que no estaban escritas en la terminal ni en el libro A.E. y se reconstruyeron con los umbrales conocidos:
- **Permisos de construcción → PIB implícito** = (permisos − 900) / 200, sin redondeo. Reproduce los umbrales publicados (estable 1,100–1,299k; calienta ≥ 1,300k) y extiende: +2 desde 1,500k, −1 entre 900 y 1,099k, −2 bajo 900k.
- **UST 2Y/10Y cambio 6m**: ≤ −0.50 −2 · −0.50/−0.25 −1 · ±0.25 0 · +0.25/+0.50 +1 · ≥ +0.50 +2 (umbrales publicados: estable ±0.25, calienta ≥ +0.25).
- **WTI a/a**: último cierre frente al cierre del mismo día un año antes. El +60 % de la versión anterior no se reproduce con ninguna definición estándar; ambos dan +2.
- **Fed funds**: tasa efectiva diaria (DFF). "Anterior" = nivel previo al último movimiento.

## 2026-10-24 — Posicionamiento del par
Los futuros de divisas de CME cotizan contra el dólar. En XXXUSD se usa el neto/OI del contrato base; restarle el USD INDEX contaría el dólar dos veces y su escala (±50 % del OI) dominaría la lectura. En cruces se usa base − cotizada.

## 2026-10-24 — Pipeline propuesto: GitHub Actions → JSON → Netlify
Frente a Netlify Scheduled Functions + Blobs: Actions permite Python (modelos ARIMA/regresión), no tiene el límite de ~30 s y el historial de git da vintages y rollback gratis. Revisar cuando haya usuarios (Etapa 4) y se necesite base de datos.
