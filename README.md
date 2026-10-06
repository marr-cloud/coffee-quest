# Coffee Quest

Un juego que se juega con `curl`. Eres el nuevo, son las 8:59, la daily es a las 9:15 y la cafetera del piso 3 está rota.
Para conseguir un café vas a usar query params, cookies, redirects, headers, JSON, multipart, Basic y Bearer auth,
PUT/DELETE, URL-encoding y un protocolo para cafeteras que existe de verdad ([RFC 2324](https://www.rfc-editor.org/rfc/rfc2324)).

Hay tres finales: `418`, `200` y uno secreto.

## Jugar

```sh
curl https://cafe.maurrod.dev
```

- En PowerShell usa `curl.exe` (`curl` a secas puede ser un alias de `Invoke-WebRequest`).
- ¿Trabado? `curl -b cookies.txt -c cookies.txt https://cafe.maurrod.dev/pista` te da el comando exacto del paso que sigue.
- ¿Prefieres un cliente gráfico? La colección está en formato Postman v2.1:
  `curl -OJ https://cafe.maurrod.dev/coleccion` (agrega `?spoilers=si` para la versión resuelta).

## Desarrollo

Requiere Node `>=22.12` y pnpm (versión fijada en `packageManager`).

```sh
pnpm install
node -e "require('fs').writeFileSync('.dev.vars', 'GAFETE_SECRET=' + require('crypto').randomBytes(32).toString('base64url') + '\n')"
pnpm dev                                      # http://localhost:8787
pnpm check                                    # lint + format + typecheck + test
bash scripts/partida.sh http://localhost:8787 # juega los tres finales con curl real
```

## Cómo está hecho

- Cloudflare Workers + [Hono](https://hono.dev). Sin base de datos: el progreso viaja en un gafete (cookie) firmado con
  HMAC-SHA256, y la receta del final verdadero se deriva de cada jugador sin guardarse en él.
- Un archivo por nivel en `src/niveles/`; todos los textos en `src/historia.es.ts`.
- `GET /` hace content negotiation: el navegador recibe una portada pixel art, curl recibe el juego.
- Rate limit por gafete y por IP, cuerpos de 16 KB como máximo y headers de seguridad en todas las respuestas (la portada
  usa una CSP con nonce).
- Diseño y verificaciones contra el edge: [`docs/superpowers/specs/2026-10-06-coffee-quest-design.md`](docs/superpowers/specs/2026-10-06-coffee-quest-design.md).

## Deploy

```sh
pnpm deploy
```

El secreto `GAFETE_SECRET` vive en Cloudflare (`npx wrangler secret put GAFETE_SECRET` para rotarlo; rotar invalida todos
los gafetes). Sin un secreto de 32 caracteres o más, el Worker responde 500 en vez de firmar con una clave débil. En el
primer deploy de un Worker nuevo, wrangler pide el secreto con `--secrets-file`.

## Créditos y licencia

- Código: [MIT](LICENSE).
- Favicon: ☕ de [Noto Emoji](https://github.com/googlefonts/noto-emoji) (Google), bajo Apache License 2.0.
