# Decisiones

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
