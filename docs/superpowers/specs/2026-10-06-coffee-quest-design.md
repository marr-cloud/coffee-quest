# Coffee Quest — Diseño

Fecha: 2026-10-06 · Estado: aprobado

## 1. Objetivo

Juego público, en español, que se juega con `curl` contra una API en Cloudflare Workers. Cuenta la historia de "el nuevo"
de la oficina: son las 8:59, la daily es a las 9:15 y necesita un café. Cada nivel enseña una habilidad de curl, de lo
básico a lo que se usa en APIs reales. Hay tres finales, que son códigos HTTP:

| Final     | Código             | Condición (resumen)                                             |
| --------- | ------------------ | --------------------------------------------------------------- |
| Normal    | `418 I'm a teapot` | Terminar el camino principal                                    |
| Verdadero | `200 OK`           | Atender el incidente y entregar la receta completa (5 partes)   |
| Secreto   | `218 This is fine` | Ignorar el incidente y pedir el café con `X-Mood: this is fine` |

Tono: humor de oficina, ligero, sin exagerar.

**Éxito:** alguien que nunca usó curl más allá de un GET llega a un final usando query params, cookies, redirects, headers de
respuesta, JSON, multipart, Basic/Bearer, PUT/DELETE, URL-encoding y method override.

**Fuera de alcance (v1):** binario, inglés (la arquitectura lo deja preparado), ranking/estadísticas, reloj real, CORS para
clientes web en navegador.

## 2. Recorrido

Convención para el jugador desde el nivel 3: `curl -b cookies.txt -c cookies.txt ...` (el gafete es una cookie).
En PowerShell se usa `curl.exe` (el nivel 1 lo avisa).

| #   | Escena                    | Petición esperada                                                                                                        | Lección                            | Fragmento     |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- | ------------- |
| 1   | Llegas a la oficina       | `GET /`                                                                                                                  | GET básico                         |               |
| 2   | Recepción                 | `GET /recepcion?nombre=Ana&piso=3` → entrega el gafete (`Set-Cookie`)                                                    | Query params, comillas, `&`        |               |
| 3   | Torniquete del ascensor   | `GET /ascensor` con la cookie                                                                                            | `-c` / `-b`                        |               |
| 4   | Piso 3                    | `GET /piso/3` → `301 Location: /piso/3/cocina`                                                                           | `-L`                               | 1 (en el 301) |
| 5   | Cafetera rota con post-it | `HEAD /piso/3/cocina` → headers `X-Post-It-*` (siguiente paso + credenciales de TI)                                      | `-I`                               |               |
| 6   | RRHH: solicitud           | `POST /rrhh/solicitud` JSON `{"motivo": "...", "urgencia": 1-10}` → **abre el incidente**                                | POST JSON, `Content-Type`          |               |
| 7   | RRHH: formulario firmado  | `POST /rrhh/formulario` multipart, campo `formulario` = archivo con línea `firma: <nombre>`                              | `-F` y `@archivo`                  | 2             |
| 8   | TI: la máquina buena      | `GET /ti/maquina` → 401 `WWW-Authenticate: Basic`; con `-u becario:<clave>` devuelve un token                            | Basic auth                         |               |
| 9   | TI: configurar            | `PUT /ti/maquina/config` JSON `{"modo": "barista"}` + `Authorization: Bearer <token>`                                    | PUT, Bearer                        |               |
| 10  | TI: desbloquear           | `DELETE /ti/maquina/bloqueo` + Bearer                                                                                    | DELETE                             | 3             |
| 11  | Pedido                    | `POST /cafetera/pedido` con `--data-urlencode "pedido=leche=si & azucar=no"`                                             | URL-encoding                       | 4             |
| 12  | El momento                | `POST /cafetera` + `X-HTTP-Method-Override: BREW` + `Content-Type: message/coffeepot` + `Accept-Additions`, body `start` | Method override, HTCPCP (RFC 2324) |               |
| —   | Incidente (opcional)      | `POST /incidente/ack` (disponible desde que se abre en el nivel 6)                                                       | Decidir con costo                  | 5             |

Notas por nivel:

- **1:** avisa que en PowerShell `curl` puede ser un alias y hay que usar `curl.exe`.
- **2:** `nombre` obligatorio (1–30 caracteres imprimibles) y se guarda en el gafete para personalizar textos. `piso` distinto de
  3 → 400 con chiste ("el piso 2 es contabilidad: ahí no hay café, solo Excel"). Si ya hay un gafete válido se conserva (no
  reinicia). Para reiniciar se borra `cookies.txt`.
- **4:** el 301 avanza el nivel y lleva `X-Receta-1`; solo se ve con `-i`/`-v`. La cocina (`GET`) describe la cafetera rota y
  dice que hay algo pegado atrás que "no está en el cuerpo".
- **5:** solo `HEAD` avanza el nivel. Los `X-Post-It-*` solo aparecen en `HEAD`; la respuesta del nivel va entera en headers.
- **6:** `urgencia` debe ser entero 1–10 (`11` → 400 "la escala va hasta 10. Te creemos, pero pon 10."). Content-Type distinto de
  JSON → 415. JSON inválido → 400. Al aprobar: `incidente = "abierto"` y el texto anuncia que producción está en llamas.
- **7:** archivo de 10 KB como máximo (más → 413). Debe contener `firma:` (sin distinguir mayúsculas).
- **8:** las credenciales son fijas (`becario` y una clave definida en `historia.es.ts`) y salen en el post-it del nivel 5. El
  token de TI va atado al `id` del jugador (ver §4).
- **9:** sin Bearer o con token inválido → 401 `WWW-Authenticate: Bearer`. `modo` distinto de `barista` → 400.
- **11:** si el jugador usa `-d` sin codificar, el servidor detecta el pedido partido por `&`/`=` y explica qué entendió.
  El texto pedido es ASCII a propósito: `curl.exe` en Windows puede mandar los acentos en otra codificación.
- **12:** `-X BREW` directo no llega al Worker: el edge de Cloudflare responde 501 a métodos no estándar
  ([docs](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-501/)).
  La historia lo convierte en pista: "la cafetera entiende BREW, pero el edificio no deja pasar métodos raros".
  `POST` sin override → 405 con `Allow`. Content-Type distinto → 415. Sin `Accept-Additions` → 400 ("¿así, sin nada?").
  Body distinto de `start` → 400 (RFC 2324: `start` / `stop`).

Reglas generales de progreso:

- Cada ruta tiene un nivel mínimo. Si el jugador no llegó aún → **409**, con su nivel actual y qué hacer.
- Volver a niveles pasados está permitido: nunca baja el nivel y vuelve a emitir sus headers (así se recuperan fragmentos o
  credenciales perdidas).
- `GET /pista`: lee el gafete y da una pista del nivel actual (sin gafete: cómo empezar).
- Mientras `incidente = "abierto"`, las respuestas llevan `X-Perro`, una línea críptica que insinúa `X-Mood` (el perro del
  meme).

## 3. Finales

Se evalúan en el nivel 12 cuando la petición es válida, en este orden:

1. **218 This is fine:** `incidente === "abierto"` y header `X-Mood` igual a `this is fine` (sin distinguir mayúsculas ni
   espacios extra). Texto: te tomas el café mientras todo arde.
2. **200 OK:** header `X-Receta` con los 5 fragmentos separados por coma, en orden, iguales a los esperados para el `id`.
   Como el fragmento 5 solo sale al atender el incidente, 200 y 218 se excluyen.
3. **418 I'm a teapot:** cualquier otro caso. El texto insinúa que existen otros finales ("dicen que la cafetera de verdad
   necesita una receta... y que hay quien se toma el café mientras todo arde").

El nivel 12 se puede repetir para intentar otro final.

## 4. Estado: el gafete

Token firmado, sin base de datos.

- **Contenido** (JSON → base64url): `{ v: 1, id, nombre, nivel, incidente: null | "abierto" | "atendido", iat, nota }`.
  `id` = 16 bytes aleatorios en base64url. `nota` es un mensaje para quien lo decodifique ("si lees esto, ya sabes base64.
  la receta no está aquí").
- **Formato:** `<payload>.<firma>`, firma = HMAC-SHA256(`GAFETE_SECRET`, payload) en base64url (Web Crypto). Comparación de
  firma en tiempo constante. Vence a los 30 días desde `iat`.
- **Cookie:** `gafete`, `Path=/`, `HttpOnly`, `SameSite=Lax`, `Max-Age=2592000`, `Secure` solo si la petición es HTTPS. Se
  reemite en cada respuesta que cambia el estado.
- **No guarda los fragmentos.** Cada fragmento `n` es determinista: `HMAC(GAFETE_SECRET, "receta:" + id + ":" + n)` mapeado a
  una palabra de una lista fija (ej. `molienda-fina`, `agua-92`). Leer el gafete no revela la receta y copiar la de otro
  jugador no sirve.
- **Token de TI** (nivel 8): `ti_` + `HMAC(GAFETE_SECRET, "ti:" + id)` en base64url. Se valida recalculando con el `id` del
  gafete.
- **Errores:** gafete ausente en ruta protegida → 403 ("sin gafete el torniquete no gira; vuelve a recepción"). Firma
  inválida, formato roto o vencido → 403 ("gafete falso").

## 5. Arquitectura

**Hono** (versión exacta fijada) sobre Workers. Middleware en cadena: rate limit → leer gafete → handler del nivel. El
estado viaja en `c.var.estado`.

```
src/index.ts          app Hono: middlewares, montaje de rutas, 404 de la historia
src/http.ts           helpers: respuesta de texto, 405 con Allow (rutas vía all()), chequeo de Content-Type
src/cripto.ts         HMAC, base64url, comparación en tiempo constante
src/gafete.ts         crear / verificar / serializar el gafete y la cookie; token de TI
src/receta.ts         fragmento(id, n), lista de palabras, verificación de X-Receta
src/niveles/NN-*.ts   un archivo por nivel: { numero, metodo, ruta, nivelMinimo, handler, pista, coleccion }
src/niveles/index.ts  registro ordenado de niveles (lo usan router, /pista y /coleccion)
src/incidente.ts      POST /incidente/ack
src/finales.ts        regla 218 > 200 > 418
src/coleccion.ts      genera la colección Postman desde el registro de niveles
src/historia.es.ts    todos los textos de la historia y pistas
src/web/escena.ts     matriz de píxeles + paleta → SVG
src/web/portada.ts    HTML de la página para navegador
```

Respuestas en `text/plain; charset=utf-8`, pensadas para terminal: escena breve, arte ASCII mínimo y una línea
`▶ Siguiente:` con la pista para avanzar (explícita al principio, más vaga al avanzar). Los headers propios (`X-Receta-*`,
`X-Post-It-*`, `X-Perro`) usan solo ASCII.

**Errores con códigos reales:** 400 parámetro/cuerpo inválido · 401 con `WWW-Authenticate` (Basic o Bearer) · 403 gafete
ausente/falso · 404 "te perdiste en la oficina" · 405 con `Allow` · 409 nivel no alcanzado · 413 archivo grande · 415
Content-Type equivocado · 429 rate limit con `Retry-After`.

**Rate limit:** binding `ratelimits` (`simple`, `period: 60`, `limit: 60`). Clave = `id` del gafete o, sin gafete,
`CF-Connecting-IP`. Es aproximado y por ubicación; suficiente como freno anti-abuso.

**Logs:** una línea JSON por petición `{ event, ruta, nivel, resultado, final? }`, sin IP ni nombre. Da una idea de cuántos
llegan a cada final en Workers Logs, sin construir ranking.

**Configuración:**

- `wrangler.jsonc`: `name: "coffee-quest"`, binding `ratelimits`. `package.json`: `name: "coffee-quest"`, dependencia `hono`.
- Secreto `GAFETE_SECRET`: `.dev.vars` en local, `wrangler secret put` en producción, binding de prueba en `vitest.config.mts`.
- `pnpm cf-typegen` después de cambiar bindings.

## 6. Colección (Postman v2.1)

Formato Postman Collection v2.1: lo importan Postman, Insomnia, Bruno, Hoppscotch (desktop) y Thunder Client.

- `GET /coleccion` → **esqueleto**: una request por nivel, todas `GET`, con la URL y la descripción de la escena, sin headers
  ni body. El jugador completa método, headers y body.
- `GET /coleccion?spoilers=si` → **resuelta**: requests completas, en carpetas `Camino (1–11)`, `Final 418`,
  `Final 200 (incluye ack del incidente)` y `Final 218`. Incluye scripts `pm.*` que capturan `X-Receta-N` y el token de TI en
  variables (funciona en Postman; en otros clientes puede requerir copiarlos a mano). Sirve como guía de referencia y para
  probar el juego entero.
- Variables: `base` (el origen de la petición), `nombre`, `token_ti`, `receta_1` … `receta_5`.
- `Content-Disposition: attachment; filename="coffee-quest.postman_collection.json"` → se descarga con `curl -OJ`.
- Se genera desde el registro de niveles (`coleccion` en cada definición), así no se desincroniza.

## 6b. Página para navegador (`GET /` con `Accept: text/html`)

`GET /` hace content negotiation: si `Accept` incluye `text/html` (un navegador) responde una página HTML; si no (curl manda
`*/*`), responde el nivel 1 en texto. La respuesta lleva `Vary: Accept`. La página explica en una línea que eso es content
negotiation. No permite jugar: su único objetivo es mandarte a la terminal.

- **Escena pixel art:** la oficina a las 8:59, el empleado con ojeras, la cafetera rota con post-it, vapor animado con CSS y
  una puerta entreabierta con brillo naranja al fondo (guiño al 218). Se genera como SVG desde una matriz de píxeles en código
  (`src/web/escena.ts`, un `rect` por tramo horizontal, `shape-rendering="crispEdges"`), paleta de 16 colores definida ahí.
- **Gancho:** "Este juego no se juega aquí. Se juega en tu terminal."
- **Comando** `curl <origen>` con botón de copiar y nota para `curl.exe` en PowerShell.
- **Tres trofeos bloqueados:** `418`, `200` y `???`.
- **Link chico** a `/coleccion` para Postman, Bruno y similares.
- Una sola página autocontenida (HTML + CSS inline + un script mínimo para copiar), sin dependencias externas, legible en
  móvil, con modo claro/oscuro según `prefers-color-scheme` y `prefers-reduced-motion` respetado. El texto alternativo de
  la escena la describe.
- **Reemplazo por Aseprite (después, fuera de v1):** exportar PNG, servirlo con Static Assets y cambiar el `<svg>` por `<img>`.

## 7. Pruebas

Vitest dentro de workerd (`@cloudflare/vitest-plugin`, como la plantilla), con TDD:

- Unitarias: `gafete` (firma, alteración, vencimiento), `receta` (determinismo por id, verificación), `finales` (prioridad
  218 > 200 > 418), validaciones de cada nivel (éxito y cada error de la tabla).
- Integración con `exports.default.fetch`: una partida completa por final, manejando cookies como lo haría curl; 409 al
  saltar niveles; revisitar niveles no baja el progreso.
- `coleccion`: JSON con la estructura v2.1 y una request por nivel.
- Portada: `GET /` con `Accept: text/html` devuelve HTML con `Vary: Accept` y el comando; sin `text/html` devuelve el nivel 1.
- `scripts/partida.sh` (bash + curl): juega los tres finales contra una URL dada (`wrangler dev` o el deploy). Cubre lo que
  los tests no pueden: el edge real.

`pnpm check` (lint + format + typecheck + test) debe quedar verde.

## 8. Despliegue

1. `coffee-quest.<cuenta>.workers.dev` con `pnpm deploy`.
2. Cuando esté listo: custom domain `cafe.maurrod.dev`. Es una zona en vivo: solo se agrega una
   entrada nueva y se confirma antes de tocarla.

## 9. Verificaciones contra el edge real (primera tarea con deploy)

- `-X BREW` devuelve 501 de Cloudflare (esperado según docs) y el override funciona.
- Texto del estado: con `--http1.1`, ¿curl muestra `218 This is fine` o Cloudflare lo reemplaza u omite? En HTTP/2 nunca hay
  texto; el body siempre dice "This is fine", así que el final no depende de esto.
- `Accept-Additions`, `X-Mood` y `X-HTTP-Method-Override` llegan intactos al Worker.
- Cookies `Secure` y el flujo `-b/-c` funcionan con `-L` a través del redirect del nivel 4.
- `curl.exe` en PowerShell con las comillas que sugieren los textos de los niveles 2 y 11.

### Resultados (2026-10-06, coffee-quest.meitrix8208.workers.dev)

- `-X BREW`: **501** de Cloudflare antes de llegar al Worker (también en `wrangler dev`). El override funciona.
- Línea de estado con `--http1.1`: `418 I'm a teapot` y `200 OK` se ven bien; el **218 sale como `HTTP/1.1 218 <none>`**. El edge
  arma la línea con su propia tabla y descarta el `statusText` del Worker para códigos no oficiales (en local sí se ve
  `218 This is fine`). El cuerpo lo dice igual, así que el final no cambia.
- `X-HTTP-Method-Override`, `Accept-Additions`, `X-Mood` y `X-Receta` llegan intactos: los tres finales pasaron con
  `scripts/partida.sh` (39 pasos ok).
- Cookies `Secure` con `-L -b -c` a través del 301: sí. El 301 trae `Set-Cookie` y el `HEAD` siguiente avanza con esa cookie.
- `curl.exe` en PowerShell 7: el nivel 2 con comillas llega entero (`&` incluido) y `--data-urlencode` del nivel 11 también.
- Primer deploy: wrangler exige el secreto requerido antes de crear el Worker, así que se usa `--secrets-file` (ver README).
- Custom domain `cafe.maurrod.dev` activo (2026-10-06): `scripts/partida.sh` 39/39 contra el dominio; `maurrod.dev` y `www`
  siguen respondiendo igual. `workers.dev` queda activo a propósito (`workers_dev: true`).

### Auditoría (2026-10-06, cafe.maurrod.dev)

- MDN HTTP Observatory: de C (55) a **A+ (150)**, 12/12. CSP con nonce y `default-src 'none'`, `frame-ancestors 'none'`,
  `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, CORP y COOP `same-origin`. HSTS preload y la redirección
  http→https vienen de la zona.
- Lighthouse 13.5 (Edge, móvil y escritorio): Performance, Accessibility y SEO 100; Best Practices 81. Lo que resta
  viene solo de lo que inyecta la zona (JS detections de Bot Fight Mode y el beacon de Web Analytics), que se mantienen a
  propósito. Con la CSP, los tres scripts llevan nonce (JS detections reusa el del header) y la consola queda sin
  violaciones.
