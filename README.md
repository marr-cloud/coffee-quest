# Coffee Quest

Un juego que se juega con `curl`. Eres el nuevo, son las 8:59, la daily es a las 9:15 y la cafetera del piso 3 está rota.
Para conseguir un café vas a usar query params, cookies, redirects, headers, JSON, multipart, Basic y Bearer auth,
PUT/DELETE, URL-encoding y un protocolo para cafeteras que existe de verdad ([RFC 2324](https://www.rfc-editor.org/rfc/rfc2324)).

Hay tres finales: `418`, `200` y uno secreto.

```sh
curl https://cafe.maurrod.dev
```

En PowerShell usa `curl.exe`. ¿Prefieres un cliente gráfico? Descarga la colección de Postman (sirve en Bruno, Insomnia y Hoppscotch):

```sh
curl -OJ https://cafe.maurrod.dev/coleccion
```

## Desarrollo

Requiere Node `>=22.12` y pnpm (versión fijada en `packageManager`).

```sh
pnpm install
node -e "require('fs').writeFileSync('.dev.vars', 'GAFETE_SECRET=' + require('crypto').randomBytes(32).toString('base64url') + '\n')"
pnpm dev                                  # http://localhost:8787
pnpm check                                # lint + format + typecheck + test
bash scripts/partida.sh http://localhost:8787   # juega los tres finales con curl real
```

## Cómo está hecho

- Cloudflare Workers + [Hono](https://hono.dev). Sin base de datos: el progreso viaja en un gafete (cookie) firmado con HMAC.
- Un archivo por nivel en `src/niveles/`; todos los textos en `src/historia.es.ts`.
- La receta del final verdadero es distinta para cada jugador: se deriva del id del gafete y no se guarda en él.
- `GET /` hace content negotiation: el navegador recibe una portada pixel art, curl recibe el juego.
- Diseño completo: [`docs/superpowers/specs/2026-10-06-coffee-quest-design.md`](docs/superpowers/specs/2026-10-06-coffee-quest-design.md).

## Deploy

```sh
npx wrangler login
pnpm deploy
node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64url'))" | npx wrangler secret put GAFETE_SECRET
```

## Licencia

[MIT](LICENSE)
