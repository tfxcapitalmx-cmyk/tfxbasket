# Disparador externo (horarios puntuales)

## Problema
Los cron de GitHub Actions en cuentas gratuitas se retrasan. Medido entre el 26-oct y el 11-nov de 2026:

| Proceso | Programado (UTC) | Arrancó (UTC) | Retraso |
|---|---|---|---|
| Puntaje macro | 13:45 | 18:48 – 23:06 | 5 – 9 h |
| Puntaje macro | 22:30 | 01:30 – 04:12 | 3 – 6 h |
| Carry | 16:00 | 20:24 – 23:54 | 4 – 8 h |
| Mercados | 22:45 / 00:30 | 02:18 / 06:54 | 3.5 – 6.5 h |

Con eso, el CPI o el NFP de las 8:30 Nueva York aparecían en la terminal entre las 2 y las 6 pm.

## Solución
Un servicio de cron externo y gratuito llama a la API de GitHub a la hora exacta y lanza el proceso (`workflow_dispatch`, que no se retrasa). Los cron de GitHub se quedan como respaldo. Costo: $0. Cada proceso solo publica si hay datos nuevos, y los commits de datos no generan builds del sitio.

## Configuración (una sola vez, la hace el propietario)

### 1. Token de GitHub con el mínimo permiso
1. GitHub → foto de perfil → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token.
2. Nombre: `disparador-terminal`. Expiración: 1 año (anotar la fecha para renovarlo).
3. Repository access → **Only select repositories** → `tfxbasket`.
4. Permissions → Repository permissions → **Actions: Read and write**. Nada más: con este token solo se pueden lanzar procesos, no cambiar código ni datos.
5. Generate token y copiarlo (solo se muestra una vez). No compartirlo ni pegarlo en el repo.

### 2. Tareas en cron-job.org (gratis)
1. Crear una cuenta en https://cron-job.org.
2. Settings → zona horaria **America/New_York**. Así los horarios siguen al cambio de horario de verano.
3. Crear una tarea por línea de la tabla, con estos datos comunes:
   - Método: **POST**
   - Headers:
     - `Authorization: Bearer <token del paso 1>`
     - `Accept: application/vnd.github+json`
     - `X-GitHub-Api-Version: 2022-11-28`
   - Cuerpo: `{"ref":"main"}`
   - URL: `https://api.github.com/repos/tfxcapitalmx-cmyk/tfxbasket/actions/workflows/<archivo>/dispatches`
   - Notificaciones: activar el aviso por fallo.

| Tarea | `<archivo>` | Días | Horas (Nueva York) | Por qué |
|---|---|---|---|---|
| Macro · datos de la mañana | `macro.yml` | lun–vie | 8:35, 8:50, 9:15, 10:05, 10:30 | CPI, NFP, PPI, solicitudes (8:30) y datos de las 10:00; FRED tarda de minutos a una hora en publicarlos. Si no hay nada nuevo, no publica |
| Macro · cierre | `macro.yml` | lun–vie | 17:30 | Bonos, breakevens y Fed funds del día |
| Carry | `carry.yml` | lun–vie | 11:00 | Tasas del BIS |
| Mercados | `markets.yml` | lun–vie | 17:20, 19:45 | Vela diaria completa de Yahoo |
| COT | `cot.yml` | vie | 15:45, 16:30 | Informe de la CFTC (15:30) |
| Vigilante | `watchdog.yml` | todos | 11:00 | Revisión de antigüedad (abre un issue si algo se atrasa) |

GitHub responde `204 No Content` cuando acepta la llamada. En GitHub → Actions debe aparecer la ejecución con el evento `workflow_dispatch`.

## Riesgos
- El token vive en un servicio externo. Por eso solo tiene permiso para lanzar procesos de este repo. Si se filtra: GitHub → Settings → Developer settings → revocarlo y crear otro.
- Si cron-job.org falla, los cron de GitHub siguen funcionando con su retraso habitual, y el vigilante avisa si algo se queda atrás.
- Minutos de Actions: el repo es público y no tiene límite de minutos. Si se vuelve privado, el plan gratis trae 2,000 minutos al mes; estas tareas usan entre 500 y 700.
