# Coffee Quest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un juego público en español que se juega con `curl` contra una API en Cloudflare Workers: 12 niveles que enseñan curl y
tres finales (418, 200 y 218 "This is fine"), con colección Postman y una portada pixel art para navegador.

**Architecture:** App Hono sobre Workers. Middlewares en cadena: log → leer gafete → rate limit → guardia de nivel → handler.
El estado del jugador viaja en un token firmado con HMAC (cookie `gafete`), sin base de datos. Cada nivel es un módulo con su
ruta, su handler y su entrada para la colección; un registro ordenado los monta, y `/pista` y `/coleccion` lo reutilizan.

**Tech Stack:** TypeScript, Hono 4.13.13, Cloudflare Workers (binding `ratelimits`, secreto `GAFETE_SECRET`), Web Crypto,
Vitest 4 dentro de workerd (`@cloudflare/vitest-plugin`), oxlint, Prettier, pnpm.

**Spec:** `docs/superpowers/specs/2026-10-06-coffee-quest-design.md`

## Global Constraints

- Node `>=22.12.0`, pnpm según `packageManager`. Hono fijado exacto: `"hono": "4.13.13"` (`pnpm add hono@4.13.13 --save-exact`).
- Textos de la historia en español, todos en `src/historia.es.ts` (luego se podrá agregar `historia.en.ts`). Tono: humor de oficina, ligero.
- Respuestas del juego: `text/plain; charset=utf-8`, terminan en `\n`. Headers propios (`X-Receta-*`, `X-Post-It-*`, `X-Perro`) solo ASCII.
- El indicador de siguiente paso es `==> Siguiente:` (ASCII, en vez de `▶`, para que no salga roto en consolas Windows).
- Gafete: `<payload>.<firma>`, HMAC-SHA256 en base64url; cookie `gafete` con `Path=/`, `HttpOnly`, `SameSite=Lax`,
  `Max-Age=2592000`, `Secure` solo si la petición es HTTPS. Vence a los 30 días desde `iat`. No guarda fragmentos de receta.
- Rate limit: binding `RATE_LIMITER`, `simple: { limit: 60, period: 60 }`, clave `g:<id>` o `ip:<CF-Connecting-IP>`.
- Credenciales de TI del juego: usuario `becario`, clave `cafeina123` (son parte del acertijo, no un secreto).
- Secretos: nunca literales en comandos, archivos versionados ni salida. `.dev.vars` se genera con un comando que no imprime el valor.
- Estilo: Prettier (tabs, 140 columnas). Correr `pnpm format` antes de cada commit. Al final de cada tarea: `pnpm test` y `pnpm typecheck` verdes.
- Cada commit termina con la línea `Co-Authored-By: Claude <noreply@anthropic.com>`.
- Desvíos menores respecto de la spec, ya decididos:
  - El nivel 7 acepta el campo `formulario` como archivo **o** como texto multipart, para que la colección resuelta funcione sin archivos locales.
  - La colección resuelta ordena las carpetas como Camino, Final 418, Final 218 y Final 200, así se juegan los tres finales con un solo gafete.

## Review Focus

1. **Windows / PowerShell:** `echo "firma: Ana" > formulario.txt` en Windows PowerShell 5.1 genera UTF-16LE. El nivel 7 debe aceptarlo (test en Tarea 8).
2. **`-d` sin codificar en el nivel 11:** el jugador manda `pedido=leche=si & azucar=no` sin `--data-urlencode`. Debe recibir un 400 que muestre cómo se partió el formulario (test en Tarea 10).
3. **Repetir recepción con gafete:** volver a `/recepcion` con otro nombre no debe reiniciar el progreso ni cambiar el `id` (test en Tarea 5).
4. **Cookie en el redirect:** el 301 del nivel 4 debe traer `Set-Cookie`, porque curl `-L -c` guarda el progreso antes de seguir la flecha (test en Tarea 6).
5. **Content-Type con parámetros:** Postman y otros mandan `application/json; charset=utf-8` o `message/coffeepot; charset=utf-8`. Ambos deben aceptarse (tests en Tareas 7 y 11).

## File Structure

```
src/index.ts            app Hono: middlewares globales, montaje de RUTAS, 404 y 500 de la historia
src/tipos.ts            Estado, Incidente, Final, Lectura, AppEnv
src/cripto.ts           base64url, HMAC-SHA256, comparación en tiempo constante
src/http.ts             texto(), tipoContenido(), origen(), credencialesBasic(), tokenBearer()
src/gafete.ts           nuevoEstado, avanzar, firmar, verificar, cookie, leerGafete, requiereNivel, jugador, tokenTi, rechazoBearer
src/receta.ts           PALABRAS, fragmento, recetaCompleta, recetaCorrecta
src/finales.ts          decidirFinal, ESTADO_HTTP
src/limite.ts           middleware de rate limit
src/rutas.ts            tipos Ruta / Nivel / PeticionResuelta y montar() (incluye 405 con Allow)
src/niveles/NN-*.ts     un archivo por nivel (01 a 12)
src/niveles/index.ts    NIVELES, el registro ordenado
src/incidente.ts        POST /incidente/ack
src/pista.ts            GET /pista
src/coleccion.ts        GET /coleccion (Postman v2.1, esqueleto y resuelta)
src/web/escena.ts       matriz pixel art + paleta, generación del SVG
src/web/portada.ts      HTML de la portada para navegador
src/historia.es.ts      todos los textos
test/ayuda.ts           Jugador (cookie jar como curl), entorno(), PASOS, jugarHasta, brew
test/*.spec.ts          tests por módulo y por grupo de niveles
scripts/partida.sh      juega los tres finales con curl real contra una URL
```

---

### Task 1: Configuración base y cripto

**Files:**
- Modify: `package.json` (name, dependencia hono)
- Modify: `wrangler.jsonc` (name, `secrets.required`, `ratelimits`)
- Modify: `.dev.vars.example`
- Modify: `vitest.config.mts`
- Regenerate: `worker-configuration.d.ts` (`pnpm cf-typegen`)
- Create: `src/cripto.ts`
- Test: `test/cripto.spec.ts`

**Interfaces:**
- Produces: `aBase64url(bytes: Uint8Array): string`, `deBase64url(texto: string): Uint8Array` (lanza si es inválido),
  `hmac(secreto: string, mensaje: string): Promise<Uint8Array>` (32 bytes), `igualesSeguro(a: Uint8Array, b: Uint8Array): boolean`.
- Produces: `env.GAFETE_SECRET: string` y `env.RATE_LIMITER: RateLimit` en `CloudflareBindings`.

- [ ] **Step 1: Renombrar el proyecto e instalar Hono**

En `package.json` cambia `"name": "cloudflare-workers-template"` por `"name": "coffee-quest"`. Luego:

```bash
pnpm add hono@4.13.13 --save-exact
```

Expected: `package.json` tiene `"dependencies": { "hono": "4.13.13" }`.

- [ ] **Step 2: Configurar bindings en `wrangler.jsonc`**

Cambia `"name": "cloudflare-workers-template"` por `"name": "coffee-quest"`. Debajo del bloque `"vars"` agrega:

```jsonc
	/**
	 * Secretos requeridos. GAFETE_SECRET firma el gafete (HMAC).
	 * Local: .dev.vars · Producción: npx wrangler secret put GAFETE_SECRET
	 */
	"secrets": { "required": ["GAFETE_SECRET"] },
	/**
	 * Rate limiting: freno anti-abuso, aproximado y por ubicación.
	 * https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
	 */
	"ratelimits": [{ "name": "RATE_LIMITER", "namespace_id": "2180", "simple": { "limit": 60, "period": 60 } }],
```

- [ ] **Step 3: Secreto local y ejemplo**

Reemplaza la línea de ejemplo de `.dev.vars.example` (`# MY_API_KEY="local-development-value"`) por:

```
# GAFETE_SECRET firma los gafetes. Genera uno con:
#   node -e "require('fs').writeFileSync('.dev.vars', 'GAFETE_SECRET=' + require('crypto').randomBytes(32).toString('base64url') + '\n')"
# GAFETE_SECRET=""
```

Genera el `.dev.vars` real (gitignored) sin imprimir el valor:

```bash
node -e "require('fs').writeFileSync('.dev.vars', 'GAFETE_SECRET=' + require('crypto').randomBytes(32).toString('base64url') + '\n')"
git check-ignore .dev.vars
```

Expected: `git check-ignore` imprime `.dev.vars`.

- [ ] **Step 4: Secreto fijo para tests en `vitest.config.mts`**

```ts
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// Tests run inside workerd with the real bindings from wrangler.jsonc.
// GAFETE_SECRET es un secreto: en tests se inyecta un valor fijo, nunca el real.
export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: { configPath: "./wrangler.jsonc" },
			miniflare: { bindings: { GAFETE_SECRET: "secreto-solo-para-tests" } },
		}),
	],
});
```

- [ ] **Step 5: Regenerar tipos**

```bash
pnpm cf-typegen
grep -n "GAFETE_SECRET\|RATE_LIMITER" worker-configuration.d.ts
```

Expected: aparecen `GAFETE_SECRET: string` y `RATE_LIMITER: RateLimit` dentro de `CloudflareBindings`. Si falta `GAFETE_SECRET`,
revisa que `secrets.required` esté al nivel raíz de `wrangler.jsonc` y vuelve a correr `pnpm cf-typegen`.

- [ ] **Step 6: Escribir el test de cripto (falla)**

`test/cripto.spec.ts`:

```ts
import { describe, expect, it } from "vitest";
import { aBase64url, deBase64url, hmac, igualesSeguro } from "../src/cripto";

describe("cripto", () => {
	it("base64url ida y vuelta, sin relleno ni + /", () => {
		const bytes = Uint8Array.from([0, 251, 255, 62, 63, 1, 2]);
		const texto = aBase64url(bytes);
		expect(texto).not.toMatch(/[+/=]/);
		expect(deBase64url(texto)).toEqual(bytes);
	});

	it("deBase64url lanza con texto inválido", () => {
		expect(() => deBase64url("@@@")).toThrow();
	});

	it("hmac es determinista, de 32 bytes, y depende del secreto", async () => {
		const a = await hmac("s1", "hola");
		expect(a.byteLength).toBe(32);
		expect(await hmac("s1", "hola")).toEqual(a);
		expect(await hmac("s2", "hola")).not.toEqual(a);
	});

	it("igualesSeguro compara contenido y tolera largos distintos", () => {
		expect(igualesSeguro(Uint8Array.from([1, 2]), Uint8Array.from([1, 2]))).toBe(true);
		expect(igualesSeguro(Uint8Array.from([1, 2]), Uint8Array.from([1, 3]))).toBe(false);
		expect(igualesSeguro(Uint8Array.from([1, 2]), Uint8Array.from([1]))).toBe(false);
	});
});
```

- [ ] **Step 7: Correr y verificar que falla**

Run: `pnpm vitest run test/cripto.spec.ts`
Expected: FAIL, no se puede resolver `../src/cripto`.

- [ ] **Step 8: Implementar `src/cripto.ts`**

```ts
const enc = new TextEncoder();

export function aBase64url(bytes: Uint8Array): string {
	let binario = "";
	for (const b of bytes) binario += String.fromCharCode(b);
	return btoa(binario).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

/** Lanza si el texto no es base64url válido. */
export function deBase64url(texto: string): Uint8Array {
	const b64 = texto.replaceAll("-", "+").replaceAll("_", "/");
	const binario = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
	return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

export async function hmac(secreto: string, mensaje: string): Promise<Uint8Array> {
	const clave = await crypto.subtle.importKey("raw", enc.encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
	return new Uint8Array(await crypto.subtle.sign("HMAC", clave, enc.encode(mensaje)));
}

/** Comparación en tiempo constante (timingSafeEqual de workerd lanza si los largos difieren). */
export function igualesSeguro(a: Uint8Array, b: Uint8Array): boolean {
	return a.byteLength === b.byteLength && crypto.subtle.timingSafeEqual(a, b);
}
```

- [ ] **Step 9: Correr tests y typecheck**

Run: `pnpm vitest run test/cripto.spec.ts && pnpm typecheck`
Expected: PASS. El test de la plantilla (`test/index.spec.ts`) sigue pasando, porque todavía no se tocó `src/index.ts`.

- [ ] **Step 10: Commit**

```bash
pnpm format
git add package.json pnpm-lock.yaml wrangler.jsonc .dev.vars.example vitest.config.mts worker-configuration.d.ts src/cripto.ts test/cripto.spec.ts
git commit -m "feat: project config, bindings and crypto helpers

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Gafete, helpers HTTP y textos comunes

**Files:**
- Create: `src/tipos.ts`, `src/http.ts`, `src/gafete.ts`, `src/historia.es.ts`
- Test: `test/gafete.spec.ts`, `test/http.spec.ts`

**Interfaces:**
- Consumes: `aBase64url`, `deBase64url`, `hmac`, `igualesSeguro` (Tarea 1).
- Produces (`src/tipos.ts`):
  ```ts
  export type Incidente = null | "abierto" | "atendido";
  export type Final = 200 | 218 | 418;
  export interface Estado { v: 1; id: string; nombre: string; nivel: number; incidente: Incidente; iat: number }
  export type Lectura = { tipo: "ninguno" } | { tipo: "falso" } | { tipo: "ok"; estado: Estado };
  export interface AppEnv { Bindings: CloudflareBindings; Variables: { lectura: Lectura; estado: Estado | null; final: Final | null } }
  ```
- Produces (`src/http.ts`): `TEXTO`, `texto(c, cuerpo, status?, headers?, statusText?): Response`, `tipoContenido(c): string`,
  `origen(c): string`, `credencialesBasic(c): { usuario: string; clave: string } | null`, `tokenBearer(c): string | null`.
- Produces (`src/gafete.ts`): `COOKIE`, `VIGENCIA_S`, `nuevoEstado(nombre, ahora?)`, `avanzar(estado, n)`, `firmar(estado, secreto)`,
  `verificar(token, secreto, ahora?): Promise<Lectura>`, `guardarGafete(c, estado)`, `leerGafete` (middleware),
  `requiereNivel(n)` (middleware), `jugador(c): Estado`, `tokenTi(id, secreto)`, `tokenTiValido(token, id, secreto)`,
  `rechazoBearer(c): Promise<Response | null>`.
- Produces (`src/historia.es.ts`): `export const H = { ... }` con `sinGafete`, `gafeteFalso`, `noLlegas(nivel, o)`, `tiSinToken`,
  `tiTokenAjeno`, y la función `escena()`. El objeto termina con el comentario marcador
  `// (los textos de cada tarea se agregan arriba de esta línea)`; las tareas siguientes insertan sus claves justo encima.

- [ ] **Step 1: Crear `src/tipos.ts`**

```ts
export type Incidente = null | "abierto" | "atendido";
export type Final = 200 | 218 | 418;

/** Lo que guarda el gafete. `nivel` es el último nivel completado. */
export interface Estado {
	v: 1;
	id: string;
	nombre: string;
	nivel: number;
	incidente: Incidente;
	iat: number;
}

export type Lectura = { tipo: "ninguno" } | { tipo: "falso" } | { tipo: "ok"; estado: Estado };

export interface AppEnv {
	Bindings: CloudflareBindings;
	Variables: { lectura: Lectura; estado: Estado | null; final: Final | null };
}
```

- [ ] **Step 2: Crear `src/historia.es.ts` con los textos comunes**

```ts
/** Formato común de una escena: hora, lugar, cuerpo y siguiente paso. */
export function escena(hora: string, lugar: string, cuerpo: string, siguiente?: string): string {
	return `[${hora}] ${lugar}\n\n${cuerpo}\n${siguiente ? `\n==> Siguiente: ${siguiente}\n` : ""}`;
}

export const H = {
	sinGafete: "Sin gafete el torniquete no gira.\nVuelve a recepción por uno (y guárdalo con -c cookies.txt).",
	gafeteFalso:
		"Seguridad mira tu gafete a contraluz: es falso, está alterado o venció.\nBorra cookies.txt y vuelve a recepción por uno nuevo.",
	noLlegas: (nivel: number, o: string) =>
		`Todavía no llegas aquí. Vas en el nivel ${nivel}.\nSi no sabes qué sigue:  curl -b cookies.txt -c cookies.txt ${o}/pista`,
	tiSinToken: '«¿Y el token?» Va en un header:\n  -H "Authorization: Bearer <tu token>"',
	tiTokenAjeno: "«Ese token no es tuyo.» Usa el que te dio TI (pídelo de nuevo con -u si lo perdiste).",
	// (los textos de cada tarea se agregan arriba de esta línea)
};
```

- [ ] **Step 3: Escribir `test/http.spec.ts` (falla)**

```ts
import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { describe, expect, it } from "vitest";
import { credencialesBasic, origen, texto, tipoContenido, tokenBearer } from "../src/http";

describe("http", () => {
	it("texto: text/plain utf-8, agrega salto final, conserva cookies y aplica statusText", async () => {
		const app = new Hono();
		app.get("/", (c) => {
			setCookie(c, "a", "1");
			return texto(c, "hola", 218, { "X-Uno": "1" }, "This is fine");
		});
		const res = await app.request("https://x.test/");
		expect(res.status).toBe(218);
		expect(res.statusText).toBe("This is fine");
		expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
		expect(res.headers.get("x-uno")).toBe("1");
		expect(res.headers.getSetCookie()).toEqual(["a=1; Path=/"]);
		expect(await res.text()).toBe("hola\n");
	});

	it("tipoContenido ignora parámetros y mayúsculas", async () => {
		const app = new Hono();
		app.post("/", (c) => c.text(tipoContenido(c)));
		const res = await app.request("https://x.test/", { method: "POST", headers: { "Content-Type": "Application/JSON; charset=utf-8" } });
		expect(await res.text()).toBe("application/json");
	});

	it("origen, credencialesBasic y tokenBearer", async () => {
		const app = new Hono();
		app.get("/", (c) => c.json({ o: origen(c), b: credencialesBasic(c), t: tokenBearer(c) }));
		const basic = await app.request("https://x.test/a?b=1", { headers: { Authorization: `Basic ${btoa("becario:caf:eina")}` } });
		expect(await basic.json()).toEqual({ o: "https://x.test", b: { usuario: "becario", clave: "caf:eina" }, t: null });
		const bearer = await app.request("https://x.test/", { headers: { Authorization: "Bearer  ti_abc " } });
		expect(await bearer.json()).toEqual({ o: "https://x.test", b: null, t: "ti_abc" });
		const roto = await app.request("https://x.test/", { headers: { Authorization: "Basic @@@" } });
		expect(await roto.json()).toEqual({ o: "https://x.test", b: null, t: null });
	});
});
```

- [ ] **Step 4: Correr y verificar que falla**

Run: `pnpm vitest run test/http.spec.ts`
Expected: FAIL, no se puede resolver `../src/http`.

- [ ] **Step 5: Implementar `src/http.ts`**

```ts
import type { Context } from "hono";

export const TEXTO = "text/plain; charset=utf-8";

/**
 * Respuesta de texto del juego. c.newResponse conserva las cookies puestas con setCookie,
 * pero descarta statusText: si hace falta (p. ej. "218 This is fine"), se envuelve en un Response nativo.
 */
export function texto(c: Context, cuerpo: string, status = 200, headers: Record<string, string> = {}, statusText?: string): Response {
	const res = c.newResponse(cuerpo.endsWith("\n") ? cuerpo : `${cuerpo}\n`, { status, headers: { "Content-Type": TEXTO, ...headers } });
	return statusText ? new Response(res.body, { status: res.status, statusText, headers: res.headers }) : res;
}

/** Content-Type sin parámetros y en minúsculas ("" si no viene). */
export function tipoContenido(c: Context): string {
	return (c.req.header("Content-Type") ?? "").split(";")[0]!.trim().toLowerCase();
}

export function origen(c: Context): string {
	return new URL(c.req.url).origin;
}

export function credencialesBasic(c: Context): { usuario: string; clave: string } | null {
	const m = /^Basic\s+(\S+)$/i.exec(c.req.header("Authorization") ?? "");
	if (!m?.[1]) return null;
	try {
		const plano = atob(m[1]);
		const i = plano.indexOf(":");
		return i < 0 ? null : { usuario: plano.slice(0, i), clave: plano.slice(i + 1) };
	} catch {
		return null;
	}
}

export function tokenBearer(c: Context): string | null {
	const m = /^Bearer\s+(\S+)\s*$/i.exec(c.req.header("Authorization") ?? "");
	return m?.[1] ?? null;
}
```

- [ ] **Step 6: Correr y verificar que pasa**

Run: `pnpm vitest run test/http.spec.ts`
Expected: PASS.

- [ ] **Step 7: Escribir `test/gafete.spec.ts` (falla)**

```ts
import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { aBase64url, deBase64url } from "../src/cripto";
import {
	VIGENCIA_S,
	avanzar,
	firmar,
	guardarGafete,
	jugador,
	leerGafete,
	nuevoEstado,
	requiereNivel,
	tokenTi,
	tokenTiValido,
	verificar,
} from "../src/gafete";
import { texto } from "../src/http";
import type { AppEnv } from "../src/tipos";

const S = "secreto-de-prueba";

describe("gafete", () => {
	it("nuevoEstado: id aleatorio de 22 caracteres, nivel 2, sin incidente", () => {
		const a = nuevoEstado("Ana", 1_000_000);
		expect(a).toMatchObject({ v: 1, nombre: "Ana", nivel: 2, incidente: null, iat: 1000 });
		expect(a.id).toMatch(/^[A-Za-z0-9_-]{22}$/);
		expect(nuevoEstado("Ana").id).not.toBe(a.id);
	});

	it("avanzar nunca baja el nivel", () => {
		const e = { ...nuevoEstado("Ana"), nivel: 6 };
		expect(avanzar(e, 3).nivel).toBe(6);
		expect(avanzar(e, 7).nivel).toBe(7);
	});

	it("firmar y verificar ida y vuelta; el payload trae la nota pero no la receta", async () => {
		const e = nuevoEstado("Ana");
		const token = await firmar(e, S);
		expect(await verificar(token, S)).toEqual({ tipo: "ok", estado: e });
		const payload = JSON.parse(new TextDecoder().decode(deBase64url(token.split(".")[0]!)));
		expect(payload.nota).toContain("base64");
		expect(Object.keys(payload).sort()).toEqual(["iat", "id", "incidente", "nivel", "nombre", "nota", "v"]);
	});

	it("verificar rechaza ausencia, alteración, otro secreto, formato roto y vencimiento", async () => {
		const e = nuevoEstado("Ana", 1_000_000);
		const token = await firmar(e, S);
		const [, firma] = token.split(".");
		const alterado = aBase64url(new TextEncoder().encode(JSON.stringify({ ...e, nivel: 11 })));
		expect(await verificar(undefined, S)).toEqual({ tipo: "ninguno" });
		expect(await verificar(`${alterado}.${firma}`, S, 1_000_000)).toEqual({ tipo: "falso" });
		expect(await verificar(token, "otro", 1_000_000)).toEqual({ tipo: "falso" });
		expect(await verificar("abc", S)).toEqual({ tipo: "falso" });
		expect(await verificar("a.b.c", S)).toEqual({ tipo: "falso" });
		expect(await verificar("@@.@@", S)).toEqual({ tipo: "falso" });
		expect(await verificar(token, S, 1_000_000 + (VIGENCIA_S + 1) * 1000)).toEqual({ tipo: "falso" });
		expect((await verificar(token, S, 1_000_000 + (VIGENCIA_S - 1) * 1000)).tipo).toBe("ok");
	});

	it("tokenTi es determinista por id y se valida", async () => {
		const t = await tokenTi("id-1", S);
		expect(t).toMatch(/^ti_[A-Za-z0-9_-]{43}$/);
		expect(await tokenTi("id-1", S)).toBe(t);
		expect(await tokenTiValido(t, "id-1", S)).toBe(true);
		expect(await tokenTiValido(t, "id-2", S)).toBe(false);
		expect(await tokenTiValido("ti_x", "id-1", S)).toBe(false);
	});
});

describe("middlewares del gafete", () => {
	function app() {
		const a = new Hono<AppEnv>();
		a.use(leerGafete);
		a.get("/emitir", async (c) => {
			await guardarGafete(c, { ...nuevoEstado("Ana"), nivel: 3 });
			return texto(c, "ok");
		});
		a.get("/n3", requiereNivel(3), (c) => texto(c, `nivel ${jugador(c).nivel}`));
		a.get("/n5", requiereNivel(5), (c) => texto(c, "no deberías ver esto"));
		a.get("/libre", requiereNivel(0), (c) => texto(c, `estado ${c.var.estado === null ? "vacío" : "lleno"}`));
		return a;
	}

	it("guardarGafete pone la cookie con sus atributos; Secure solo en https", async () => {
		const https = await app().request("https://x.test/emitir", {}, env);
		const cookie = https.headers.getSetCookie()[0]!;
		expect(cookie).toMatch(/^gafete=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+;/);
		for (const attr of ["Max-Age=2592000", "Path=/", "HttpOnly", "SameSite=Lax", "Secure"]) expect(cookie).toContain(attr);
		const http = await app().request("http://x.test/emitir", {}, env);
		expect(http.headers.getSetCookie()[0]).not.toContain("Secure");
	});

	it("requiereNivel: 403 sin gafete, 403 falso, 409 nivel bajo, pasa si alcanza", async () => {
		const a = app();
		const emitido = await a.request("https://x.test/emitir", {}, env);
		const cookie = emitido.headers.getSetCookie()[0]!.split(";")[0]!;
		const sin = await a.request("https://x.test/n3", {}, env);
		expect(sin.status).toBe(403);
		expect(await sin.text()).toContain("Sin gafete");
		const falso = await a.request("https://x.test/n3", { headers: { Cookie: "gafete=a.b" } }, env);
		expect(falso.status).toBe(403);
		expect(await falso.text()).toContain("falso");
		const bajo = await a.request("https://x.test/n5", { headers: { Cookie: cookie } }, env);
		expect(bajo.status).toBe(409);
		expect(await bajo.text()).toContain("Vas en el nivel 3");
		const ok = await a.request("https://x.test/n3", { headers: { Cookie: cookie } }, env);
		expect(await ok.text()).toBe("nivel 3\n");
		const libre = await a.request("https://x.test/libre", {}, env);
		expect(await libre.text()).toBe("estado vacío\n");
	});
});
```

- [ ] **Step 8: Correr y verificar que falla**

Run: `pnpm vitest run test/gafete.spec.ts`
Expected: FAIL, no se puede resolver `../src/gafete`.

- [ ] **Step 9: Implementar `src/gafete.ts`**

```ts
import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { aBase64url, deBase64url, hmac, igualesSeguro } from "./cripto";
import { H } from "./historia.es";
import { origen, texto, tokenBearer } from "./http";
import type { AppEnv, Estado, Lectura } from "./tipos";

export const COOKIE = "gafete";
export const VIGENCIA_S = 30 * 24 * 60 * 60;
const NOTA = "si lees esto, ya sabes base64. la receta no esta aqui";
const enc = new TextEncoder();
const dec = new TextDecoder();

export function nuevoEstado(nombre: string, ahora = Date.now()): Estado {
	const id = aBase64url(crypto.getRandomValues(new Uint8Array(16)));
	return { v: 1, id, nombre, nivel: 2, incidente: null, iat: Math.floor(ahora / 1000) };
}

/** El nivel solo sube: revisitar niveles pasados no borra progreso. */
export function avanzar(estado: Estado, n: number): Estado {
	return { ...estado, nivel: Math.max(estado.nivel, n) };
}

export async function firmar(estado: Estado, secreto: string): Promise<string> {
	const payload = aBase64url(enc.encode(JSON.stringify({ ...estado, nota: NOTA })));
	return `${payload}.${aBase64url(await hmac(secreto, payload))}`;
}

function esEstado(d: unknown): d is Estado {
	if (typeof d !== "object" || d === null) return false;
	const e = d as Record<string, unknown>;
	return (
		e.v === 1 &&
		typeof e.id === "string" &&
		typeof e.nombre === "string" &&
		Number.isInteger(e.nivel) &&
		(e.incidente === null || e.incidente === "abierto" || e.incidente === "atendido") &&
		typeof e.iat === "number"
	);
}

export async function verificar(token: string | undefined, secreto: string, ahora = Date.now()): Promise<Lectura> {
	if (!token) return { tipo: "ninguno" };
	const [payload, firma, ...resto] = token.split(".");
	if (!payload || !firma || resto.length > 0) return { tipo: "falso" };
	try {
		if (!igualesSeguro(deBase64url(firma), await hmac(secreto, payload))) return { tipo: "falso" };
		const d: unknown = JSON.parse(dec.decode(deBase64url(payload)));
		if (!esEstado(d) || ahora / 1000 - d.iat > VIGENCIA_S) return { tipo: "falso" };
		return { tipo: "ok", estado: { v: 1, id: d.id, nombre: d.nombre, nivel: d.nivel, incidente: d.incidente, iat: d.iat } };
	} catch {
		return { tipo: "falso" };
	}
}

export async function guardarGafete(c: Context<AppEnv>, estado: Estado): Promise<void> {
	setCookie(c, COOKIE, await firmar(estado, c.env.GAFETE_SECRET), {
		path: "/",
		httpOnly: true,
		sameSite: "Lax",
		maxAge: VIGENCIA_S,
		secure: new URL(c.req.url).protocol === "https:",
	});
	c.set("estado", estado);
}

export const leerGafete = createMiddleware<AppEnv>(async (c, next) => {
	const lectura = await verificar(getCookie(c, COOKIE), c.env.GAFETE_SECRET);
	c.set("lectura", lectura);
	c.set("estado", lectura.tipo === "ok" ? lectura.estado : null);
	await next();
});

/** Guardia de nivel: n = último nivel que el jugador debe haber completado (0 = ruta libre). */
export function requiereNivel(n: number) {
	return createMiddleware<AppEnv>(async (c, next) => {
		if (n > 0) {
			const lectura = c.var.lectura;
			if (lectura.tipo === "ninguno") return texto(c, H.sinGafete, 403);
			if (lectura.tipo === "falso") return texto(c, H.gafeteFalso, 403);
			if (lectura.estado.nivel < n) return texto(c, H.noLlegas(lectura.estado.nivel, origen(c)), 409);
		}
		await next();
	});
}

/** Estado del jugador en rutas protegidas por requiereNivel(n > 0). */
export function jugador(c: Context<AppEnv>): Estado {
	const estado = c.var.estado;
	if (!estado) throw new Error("ruta sin requiereNivel");
	return estado;
}

export async function tokenTi(id: string, secreto: string): Promise<string> {
	return `ti_${aBase64url(await hmac(secreto, `ti:${id}`))}`;
}

export async function tokenTiValido(token: string, id: string, secreto: string): Promise<boolean> {
	return igualesSeguro(enc.encode(token), enc.encode(await tokenTi(id, secreto)));
}

/** 401 Bearer si falta el token de TI o no es de este jugador; null si es válido. */
export async function rechazoBearer(c: Context<AppEnv>): Promise<Response | null> {
	const token = tokenBearer(c);
	if (!token) return texto(c, H.tiSinToken, 401, { "WWW-Authenticate": 'Bearer realm="TI"' });
	if (!(await tokenTiValido(token, jugador(c).id, c.env.GAFETE_SECRET)))
		return texto(c, H.tiTokenAjeno, 401, { "WWW-Authenticate": 'Bearer realm="TI", error="invalid_token"' });
	return null;
}
```

- [ ] **Step 10: Correr tests y typecheck**

Run: `pnpm vitest run test/gafete.spec.ts test/http.spec.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
pnpm format
git add src/tipos.ts src/http.ts src/gafete.ts src/historia.es.ts test/gafete.spec.ts test/http.spec.ts
git commit -m "feat: signed badge, http helpers and common texts

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Receta y finales (lógica pura)

**Files:**
- Create: `src/receta.ts`, `src/finales.ts`
- Test: `test/receta.spec.ts`, `test/finales.spec.ts`

**Interfaces:**
- Consumes: `hmac` (Tarea 1), tipos `Final`, `Incidente` (Tarea 2).
- Produces: `PALABRAS: readonly string[]` (32), `fragmento(secreto, id, n): Promise<string>`, `recetaCompleta(secreto, id): Promise<string[]>`,
  `recetaCorrecta(secreto, id, header: string | undefined): Promise<boolean>`,
  `decidirFinal(p: { incidente: Incidente; mood: string | undefined; recetaOk: boolean }): Final`, `ESTADO_HTTP: Record<Final, string>`.

- [ ] **Step 1: Escribir `test/receta.spec.ts` (falla)**

```ts
import { describe, expect, it } from "vitest";
import { PALABRAS, fragmento, recetaCompleta, recetaCorrecta } from "../src/receta";

const S = "secreto-de-prueba";

describe("receta", () => {
	it("32 palabras ASCII únicas en minúsculas", () => {
		expect(PALABRAS).toHaveLength(32);
		expect(new Set(PALABRAS).size).toBe(32);
		for (const p of PALABRAS) expect(p).toMatch(/^[a-z0-9-]+$/);
	});

	it("fragmento es determinista y sale de la lista", async () => {
		const f = await fragmento(S, "jugador-a", 1);
		expect(PALABRAS).toContain(f);
		expect(await fragmento(S, "jugador-a", 1)).toBe(f);
	});

	it("cada jugador tiene su propia receta", async () => {
		const a = await recetaCompleta(S, "jugador-a");
		expect(a).toHaveLength(5);
		expect(await recetaCompleta(S, "jugador-b")).not.toEqual(a);
		expect(await recetaCompleta("otro-secreto", "jugador-a")).not.toEqual(a);
	});

	it("recetaCorrecta tolera espacios y mayúsculas, exige orden y las 5 partes", async () => {
		const r = await recetaCompleta(S, "jugador-a");
		expect(await recetaCorrecta(S, "jugador-a", r.join(","))).toBe(true);
		expect(await recetaCorrecta(S, "jugador-a", ` ${r.map((p) => p.toUpperCase()).join(" , ")} `)).toBe(true);
		expect(await recetaCorrecta(S, "jugador-a", r.slice(0, 4).join(","))).toBe(false);
		expect(await recetaCorrecta(S, "jugador-a", [...r].reverse().join(","))).toBe(r.join() === [...r].reverse().join());
		expect(await recetaCorrecta(S, "jugador-a", undefined)).toBe(false);
		expect(await recetaCorrecta(S, "jugador-b", r.join(","))).toBe(false);
	});
});
```

- [ ] **Step 2: Escribir `test/finales.spec.ts` (falla)**

```ts
import { describe, expect, it } from "vitest";
import { ESTADO_HTTP, decidirFinal } from "../src/finales";

describe("finales", () => {
	it.each([
		{ incidente: "abierto", mood: "this is fine", recetaOk: false, final: 218 },
		{ incidente: "abierto", mood: "  This   IS fine ", recetaOk: true, final: 218 },
		{ incidente: "atendido", mood: "this is fine", recetaOk: false, final: 418 },
		{ incidente: "atendido", mood: "this is fine", recetaOk: true, final: 200 },
		{ incidente: "atendido", mood: undefined, recetaOk: true, final: 200 },
		{ incidente: "abierto", mood: "todo mal", recetaOk: false, final: 418 },
		{ incidente: null, mood: "this is fine", recetaOk: false, final: 418 },
	] as const)("incidente=$incidente mood=$mood receta=$recetaOk → $final", ({ incidente, mood, recetaOk, final }) => {
		expect(decidirFinal({ incidente, mood, recetaOk })).toBe(final);
	});

	it("textos de estado", () => {
		expect(ESTADO_HTTP).toEqual({ 200: "OK", 218: "This is fine", 418: "I'm a teapot" });
	});
});
```

- [ ] **Step 3: Correr y verificar que fallan**

Run: `pnpm vitest run test/receta.spec.ts test/finales.spec.ts`
Expected: FAIL, no se pueden resolver los módulos.

- [ ] **Step 4: Implementar `src/receta.ts`**

```ts
import { hmac } from "./cripto";

/** 32 palabras: un byte del HMAC módulo 32 elige una sin sesgo. */
export const PALABRAS = [
	"molienda-fina", "agua-92", "grano-tostado", "crema-suave", "taza-tibia", "filtro-nuevo", "espuma-densa", "aroma-intenso",
	"cuchara-larga", "azucar-morena", "canela-molida", "vapor-alto", "leche-entera", "cacao-amargo", "hielo-picado", "vaso-doble",
	"prensa-francesa", "goteo-lento", "tueste-medio", "origen-unico", "notas-citricas", "cuerpo-medio", "acidez-baja", "pausa-larga",
	"sorbo-corto", "receta-vieja", "jarra-limpia", "molino-manual", "agua-filtrada", "leche-avena", "miel-pura", "vainilla-real",
] as const;

/** Fragmento n (1..5) de la receta de un jugador. Se recalcula siempre: el gafete no lo guarda. */
export async function fragmento(secreto: string, id: string, n: number): Promise<string> {
	const h = await hmac(secreto, `receta:${id}:${n}`);
	return PALABRAS[h[0]! % PALABRAS.length]!;
}

export function recetaCompleta(secreto: string, id: string): Promise<string[]> {
	return Promise.all([1, 2, 3, 4, 5].map((n) => fragmento(secreto, id, n)));
}

/** Valida el header X-Receta: los 5 fragmentos separados por coma, en orden. */
export async function recetaCorrecta(secreto: string, id: string, header: string | undefined): Promise<boolean> {
	if (!header) return false;
	const enviada = header.split(",").map((p) => p.trim().toLowerCase());
	const esperada = await recetaCompleta(secreto, id);
	return enviada.length === esperada.length && enviada.every((p, i) => p === esperada[i]);
}
```

- [ ] **Step 5: Implementar `src/finales.ts`**

```ts
import type { Final, Incidente } from "./tipos";

export const ESTADO_HTTP: Record<Final, string> = { 200: "OK", 218: "This is fine", 418: "I'm a teapot" };

/** Prioridad 218 > 200 > 418 (spec §3). */
export function decidirFinal(p: { incidente: Incidente; mood: string | undefined; recetaOk: boolean }): Final {
	const mood = p.mood?.trim().replace(/\s+/g, " ").toLowerCase();
	if (p.incidente === "abierto" && mood === "this is fine") return 218;
	if (p.recetaOk) return 200;
	return 418;
}
```

- [ ] **Step 6: Correr tests y typecheck**

Run: `pnpm vitest run test/receta.spec.ts test/finales.spec.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
pnpm format
git add src/receta.ts src/finales.ts test/receta.spec.ts test/finales.spec.ts
git commit -m "feat: per-player recipe fragments and ending rules

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Esqueleto de la app, rate limit y nivel 1

**Files:**
- Create: `src/rutas.ts`, `src/limite.ts`, `src/niveles/01-entrada.ts`, `src/niveles/index.ts`, `test/ayuda.ts`, `test/app.spec.ts`
- Modify: `src/index.ts` (reemplazo completo), `src/historia.es.ts` (textos del nivel 1 y genéricos)
- Delete: `test/index.spec.ts` (test de la plantilla)

**Interfaces:**
- Consumes: `leerGafete`, `requiereNivel`, `texto`, `origen`, `H` (Tarea 2).
- Produces (`src/rutas.ts`):
  ```ts
  export type Metodo = "GET" | "POST" | "PUT" | "DELETE";
  export type Cuerpo = { modo: "raw"; raw: string } | { modo: "urlencoded"; campos: Record<string, string> } | { modo: "formdata"; campos: Record<string, string> };
  export interface PeticionResuelta { nombre: string; metodo: string; url: string; headers?: Record<string, string>; cuerpo?: Cuerpo; captura?: string[]; sinRedirect?: boolean }
  export interface Ruta { metodo: Metodo | "ALL"; ruta: string; requiere: number; handler: (c: Context<AppEnv>) => Response | Promise<Response> }
  export interface Nivel extends Ruta { numero: number; nombre: string; esqueleto: string; resuelta: PeticionResuelta[] }
  export function montar(app: Hono<AppEnv>, r: Ruta): void
  ```
- Produces: `NIVELES: Nivel[]` (`src/niveles/index.ts`), `limitar` (middleware), `default export app` (`src/index.ts`).
- Produces (`test/ayuda.ts`): `BASE`, `entorno(limite?)`, `class Jugador { gafete; receta; tokenTi; pedir(ruta, init?); estado }`,
  `PASOS: Record<number, (j: Jugador) => Promise<Response>>`, `jugarHasta(j, n)`. `PASOS` termina con el comentario
  `// (cada tarea agrega aquí el paso de su nivel)` y las tareas siguientes agregan sus entradas encima.

- [ ] **Step 1: Agregar textos a `src/historia.es.ts`**

Inserta encima de `// (los textos de cada tarea se agregan arriba de esta línea)` (el contenido de los template literals va pegado
a la columna 0 a propósito, para que la respuesta no lleve tabs):

```ts
	nivel1: (o: string) =>
		escena(
			"08:59",
			"Planta baja",
			`Eres el nuevo. Primer día, primera daily a las 9:15, y anoche dormiste
cuatro horas. Necesitas un café. Uno de verdad.

En este edificio todo funciona con HTTP: las puertas, el ascensor,
hasta la cafetera. Tu única herramienta es curl.

  ¿Windows?  En PowerShell usa  curl.exe  (curl a secas puede ser otra cosa).
             Si ves letras raras, ejecuta antes  chcp 65001`,
			`preséntate en recepción con tu nombre y el piso al que vas:
    curl "${o}/recepcion?nombre=TuNombre&piso=3"
    (las comillas importan: sin ellas, la terminal se come el &)`,
		),
	perdido: (o: string) => `Te perdiste en la oficina: esa puerta no existe.\n¿Perdido?  curl -b cookies.txt -c cookies.txt ${o}/pista`,
	metodo: (permitidos: string) =>
		`Esa puerta no se abre así. Aquí se usa: ${permitidos}.\n(con curl el método se elige con -X; -d y -F ya implican POST)`,
	limite: "Vas muy rápido: seguridad te pidió que esperes un minuto.\n(429 Too Many Requests; el header Retry-After dice cuánto)",
	error: "Algo se rompió en el edificio (500). No fue tu culpa. Prueba de nuevo en un rato.",
```

- [ ] **Step 2: Crear `src/rutas.ts`**

```ts
import type { Context, Hono } from "hono";
import { requiereNivel } from "./gafete";
import { H } from "./historia.es";
import { texto } from "./http";
import type { AppEnv } from "./tipos";

export type Metodo = "GET" | "POST" | "PUT" | "DELETE";

export type Cuerpo =
	| { modo: "raw"; raw: string }
	| { modo: "urlencoded"; campos: Record<string, string> }
	| { modo: "formdata"; campos: Record<string, string> };

/** Una petición de la colección resuelta. `url` es relativa y puede usar variables Postman ({{nombre}}). */
export interface PeticionResuelta {
	nombre: string;
	metodo: string;
	url: string;
	headers?: Record<string, string>;
	cuerpo?: Cuerpo;
	/** Líneas de script Postman (evento "test") para capturar variables. */
	captura?: string[];
	sinRedirect?: boolean;
}

export interface Ruta {
	/** "ALL": el handler valida el método por su cuenta (nivel 12). */
	metodo: Metodo | "ALL";
	ruta: string;
	/** Último nivel que el jugador debe haber completado (0 = libre). */
	requiere: number;
	handler: (c: Context<AppEnv>) => Response | Promise<Response>;
}

export interface Nivel extends Ruta {
	numero: number;
	nombre: string;
	/** URL relativa para la colección esqueleto. */
	esqueleto: string;
	resuelta: PeticionResuelta[];
}

/**
 * Monta una ruta. Hono responde 404 si el método no coincide; aquí se agrega un fallback 405 con Allow.
 * Hono convierte HEAD en GET antes de rutear, así que las rutas GET aceptan HEAD solas.
 */
export function montar(app: Hono<AppEnv>, r: Ruta): void {
	if (r.metodo === "ALL") {
		app.all(r.ruta, requiereNivel(r.requiere), r.handler);
		return;
	}
	app.on(r.metodo, r.ruta, requiereNivel(r.requiere), r.handler);
	const permitidos = r.metodo === "GET" ? "GET, HEAD" : r.metodo;
	app.all(r.ruta, (c) => texto(c, H.metodo(permitidos), 405, { Allow: permitidos }));
}
```

- [ ] **Step 3: Crear `src/limite.ts`**

```ts
import { createMiddleware } from "hono/factory";
import { H } from "./historia.es";
import { texto } from "./http";
import type { AppEnv } from "./tipos";

/** Freno anti-abuso: por id de gafete si hay uno válido, si no por IP. */
export const limitar = createMiddleware<AppEnv>(async (c, next) => {
	const id = c.var.estado?.id;
	const clave = id ? `g:${id}` : `ip:${c.req.header("CF-Connecting-IP") ?? "desconocida"}`;
	const { success } = await c.env.RATE_LIMITER.limit({ key: clave });
	if (!success) return texto(c, H.limite, 429, { "Retry-After": "60" });
	await next();
});
```

- [ ] **Step 4: Crear el nivel 1 y el registro**

`src/niveles/01-entrada.ts`:

```ts
import { H } from "../historia.es";
import { origen, texto } from "../http";
import type { Nivel } from "../rutas";

export const entrada: Nivel = {
	numero: 1,
	nombre: "Planta baja",
	metodo: "GET",
	ruta: "/",
	requiere: 0,
	esqueleto: "/",
	resuelta: [{ nombre: "1. Planta baja", metodo: "GET", url: "/" }],
	handler: (c) => texto(c, H.nivel1(origen(c)), 200, { Vary: "Accept" }),
};
```

`src/niveles/index.ts`:

```ts
import type { Nivel } from "../rutas";
import { entrada } from "./01-entrada";

/** Registro ordenado de niveles: lo usan el router, /pista y /coleccion. */
export const NIVELES: Nivel[] = [entrada];
```

- [ ] **Step 5: Reemplazar `src/index.ts`**

```ts
import { Hono } from "hono";
import { leerGafete } from "./gafete";
import { H } from "./historia.es";
import { origen, texto } from "./http";
import { limitar } from "./limite";
import { NIVELES } from "./niveles";
import { type Ruta, montar } from "./rutas";
import type { AppEnv } from "./tipos";

const RUTAS: Ruta[] = [...NIVELES];

const app = new Hono<AppEnv>();

// Log estructurado por petición, sin IP ni nombre (spec §5). Va primero para registrar también los 429.
app.use(async (c, next) => {
	c.set("final", null);
	await next();
	const estado = c.var.estado;
	console.log(
		JSON.stringify({
			event: "peticion",
			metodo: c.req.method,
			ruta: new URL(c.req.url).pathname,
			status: c.res.status,
			nivel: estado?.nivel ?? null,
			final: c.var.final,
		}),
	);
});
app.use(leerGafete);
app.use(limitar);

for (const r of RUTAS) montar(app, r);

app.notFound((c) => texto(c, H.perdido(origen(c)), 404));
app.onError((err, c) => {
	console.error(JSON.stringify({ event: "error", mensaje: err.message }));
	return texto(c, H.error, 500);
});

export default app;
```

- [ ] **Step 6: Crear `test/ayuda.ts` y borrar el test de la plantilla**

```bash
git rm test/index.spec.ts
```

`test/ayuda.ts`:

```ts
import { env } from "cloudflare:workers";
import { deBase64url } from "../src/cripto";
import app from "../src/index";

export const BASE = "https://cafe.test";

/** Bindings de test. El rate limiter real se reemplaza: los tests sin gafete comparten la misma clave de IP. */
export function entorno(limite = true): CloudflareBindings {
	return { ...env, RATE_LIMITER: { limit: async () => ({ success: limite }) } };
}

/** Un jugador con su propio cookie jar, como curl -b/-c. También guarda fragmentos de receta y el token de TI. */
export class Jugador {
	gafete: string | null = null;
	receta: Record<number, string> = {};
	tokenTi: string | null = null;

	async pedir(ruta: string, init: RequestInit = {}): Promise<Response> {
		const headers = new Headers(init.headers);
		if (this.gafete) headers.set("Cookie", `gafete=${this.gafete}`);
		const res = await app.request(`${BASE}${ruta}`, { ...init, headers }, entorno());
		for (const cookie of res.headers.getSetCookie()) {
			const m = /^gafete=([^;]*)/.exec(cookie);
			if (m?.[1]) this.gafete = m[1];
		}
		for (let n = 1; n <= 5; n++) {
			const v = res.headers.get(`X-Receta-${n}`);
			if (v) this.receta[n] = v;
		}
		return res;
	}

	/** Payload del gafete, decodificado sin verificar (como haría un jugador curioso). */
	get estado(): Record<string, unknown> {
		if (!this.gafete) throw new Error("sin gafete");
		return JSON.parse(new TextDecoder().decode(deBase64url(this.gafete.split(".")[0]!)));
	}
}

/** La petición correcta de cada nivel. */
export const PASOS: Record<number, (j: Jugador) => Promise<Response>> = {
	1: (j) => j.pedir("/"),
	// (cada tarea agrega aquí el paso de su nivel)
};

export async function jugarHasta(j: Jugador, n: number): Promise<void> {
	for (let i = 1; i <= n; i++) {
		const paso = PASOS[i];
		if (!paso) throw new Error(`falta PASOS[${i}]`);
		const res = await paso(j);
		if (res.status >= 400) throw new Error(`paso ${i}: ${res.status} ${await res.text()}`);
	}
}
```

- [ ] **Step 7: Escribir `test/app.spec.ts` (falla)**

```ts
import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import app from "../src/index";
import { BASE, Jugador, entorno } from "./ayuda";

describe("app", () => {
	it("GET / da el nivel 1 en texto", async () => {
		const res = await new Jugador().pedir("/");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
		expect(res.headers.get("vary")).toBe("Accept");
		const cuerpo = await res.text();
		expect(cuerpo).toContain("[08:59] Planta baja");
		expect(cuerpo).toContain(`curl "${BASE}/recepcion?nombre=TuNombre&piso=3"`);
		expect(cuerpo).toContain("==> Siguiente:");
	});

	it("HEAD / responde sin cuerpo", async () => {
		const res = await new Jugador().pedir("/", { method: "HEAD" });
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("");
	});

	it("método equivocado → 405 con Allow", async () => {
		const res = await new Jugador().pedir("/", { method: "POST" });
		expect(res.status).toBe(405);
		expect(res.headers.get("allow")).toBe("GET, HEAD");
	});

	it("ruta inexistente → 404 de la historia", async () => {
		const res = await new Jugador().pedir("/sotano");
		expect(res.status).toBe(404);
		expect(await res.text()).toContain("Te perdiste");
	});

	it("rate limit → 429 con Retry-After", async () => {
		const res = await app.request(`${BASE}/`, {}, entorno(false));
		expect(res.status).toBe(429);
		expect(res.headers.get("retry-after")).toBe("60");
	});

	it("funciona a través del entrypoint real del Worker", async () => {
		const res = await exports.default.fetch("https://example.com/");
		expect(res.status).toBe(200);
		expect(await res.text()).toContain("Planta baja");
	});
});
```

- [ ] **Step 8: Correr todo y typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: PASS en todos los archivos (cripto, http, gafete, receta, finales, app).

- [ ] **Step 9: Commit**

```bash
pnpm format
git add src/index.ts src/rutas.ts src/limite.ts src/niveles src/historia.es.ts test/ayuda.ts test/app.spec.ts
git commit -m "feat: hono app skeleton, rate limit and level 1

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Niveles 2 y 3 (recepción y ascensor)

**Files:**
- Create: `src/niveles/02-recepcion.ts`, `src/niveles/03-ascensor.ts`, `test/recepcion.spec.ts`
- Modify: `src/niveles/index.ts`, `src/historia.es.ts`, `test/ayuda.ts`

**Interfaces:**
- Consumes: `nuevoEstado`, `avanzar`, `guardarGafete`, `jugador` (Tarea 2); `Nivel` (Tarea 4).
- Produces: `recepcion: Nivel` (GET `/recepcion`, requiere 0), `ascensor: Nivel` (GET `/ascensor`, requiere 2). `PASOS[2]`, `PASOS[3]`.

- [ ] **Step 1: Agregar textos a `src/historia.es.ts`** (encima del marcador)

```ts
	sinNombre: "La recepcionista te mira por encima de los lentes: «¿Y tu nombre?».\nAgrégalo a la URL:  ?nombre=TuNombre&piso=3",
	nombreInvalido: "Ese nombre no cabe en el gafete: máximo 30 caracteres y sin caracteres de control.",
	pisoEquivocado: (piso: string | undefined) =>
		piso === undefined
			? "«¿A qué piso vas?» Agrega &piso=3 a la URL."
			: piso === "2"
				? "«¿Al 2? Eso es contabilidad: ahí no hay café, solo Excel.» Tu equipo está en el 3."
				: `«¿Al piso ${piso.slice(0, 10)}? No, no. Tu equipo está en el 3.»`,
	nivel2: (nombre: string, o: string) =>
		escena(
			"09:00",
			"Recepción",
			`«Bienvenido, ${nombre}.» Te entrega un gafete... bueno, te lo mandó en un
header: Set-Cookie. Si no lo guardaste, ya lo perdiste.

curl no guarda cookies si no se lo pides:
  -c cookies.txt   guarda las cookies que te manden
  -b cookies.txt   las envía en la siguiente petición`,
			`pide el gafete de nuevo guardándolo, y pasa al ascensor:
    curl -c cookies.txt "${o}/recepcion?nombre=${encodeURIComponent(nombre)}&piso=3"
    curl -b cookies.txt -c cookies.txt ${o}/ascensor`,
		),
	nivel3: (o: string) =>
		escena(
			"09:02",
			"Ascensor",
			`El torniquete lee tu gafete y hace bip. Un bip amable.
Subes con alguien que habla por teléfono de «sinergias». Llegas al 3.

De aquí en adelante usa siempre  -b cookies.txt -c cookies.txt
(así el gafete se actualiza cada vez que avanzas).`,
			`entra al piso 3:
    curl -b cookies.txt -c cookies.txt ${o}/piso/3`,
		),
```

- [ ] **Step 2: Agregar pasos a `test/ayuda.ts`** (encima del marcador de `PASOS`)

```ts
	2: (j) => j.pedir("/recepcion?nombre=Ana&piso=3"),
	3: (j) => j.pedir("/ascensor"),
```

- [ ] **Step 3: Escribir `test/recepcion.spec.ts` (falla)**

```ts
import { describe, expect, it } from "vitest";
import { aBase64url } from "../src/cripto";
import { Jugador, jugarHasta } from "./ayuda";

describe("nivel 2: recepción", () => {
	it("entrega el gafete como cookie y saluda por nombre", async () => {
		const j = new Jugador();
		const res = await j.pedir("/recepcion?nombre=Jos%C3%A9&piso=3");
		expect(res.status).toBe(200);
		expect(res.headers.getSetCookie()[0]).toMatch(/^gafete=.+HttpOnly/);
		const cuerpo = await res.text();
		expect(cuerpo).toContain("Bienvenido, José");
		expect(cuerpo).toContain("nombre=Jos%C3%A9&piso=3");
		expect(j.estado).toMatchObject({ nombre: "José", nivel: 2, incidente: null });
	});

	it.each([
		["/recepcion?piso=3", "¿Y tu nombre?"],
		["/recepcion?nombre=%20%20&piso=3", "¿Y tu nombre?"],
		[`/recepcion?nombre=${"a".repeat(31)}&piso=3`, "máximo 30"],
		["/recepcion?nombre=A%07na&piso=3", "máximo 30"],
		["/recepcion?nombre=Ana", "¿A qué piso vas?"],
		["/recepcion?nombre=Ana&piso=2", "solo Excel"],
		["/recepcion?nombre=Ana&piso=7", "Tu equipo está en el 3"],
	])("%s → 400", async (ruta, texto) => {
		const j = new Jugador();
		const res = await j.pedir(ruta);
		expect(res.status).toBe(400);
		expect(await res.text()).toContain(texto);
		expect(j.gafete).toBeNull();
	});

	it("volver a recepción con gafete no reinicia el progreso", async () => {
		const j = new Jugador();
		await jugarHasta(j, 3);
		const { id } = j.estado;
		const res = await j.pedir("/recepcion?nombre=Otro&piso=3");
		expect(res.status).toBe(200);
		expect(j.estado).toMatchObject({ id, nombre: "Ana", nivel: 3 });
	});
});

describe("nivel 3: ascensor", () => {
	it("sin gafete → 403", async () => {
		const res = await new Jugador().pedir("/ascensor");
		expect(res.status).toBe(403);
	});

	it("gafete alterado → 403 falso", async () => {
		const j = new Jugador();
		await jugarHasta(j, 2);
		const [, firma] = j.gafete!.split(".");
		j.gafete = `${aBase64url(new TextEncoder().encode(JSON.stringify({ ...j.estado, nivel: 11 })))}.${firma}`;
		const res = await j.pedir("/ascensor");
		expect(res.status).toBe(403);
		expect(await res.text()).toContain("falso");
	});

	it("con gafete avanza al nivel 3", async () => {
		const j = new Jugador();
		await jugarHasta(j, 2);
		const res = await j.pedir("/ascensor");
		expect(res.status).toBe(200);
		expect(await res.text()).toContain("/piso/3");
		expect(j.estado.nivel).toBe(3);
	});
});
```

- [ ] **Step 4: Correr y verificar que falla**

Run: `pnpm vitest run test/recepcion.spec.ts`
Expected: FAIL (404 en `/recepcion` y `/ascensor`).

- [ ] **Step 5: Implementar los niveles**

`src/niveles/02-recepcion.ts`:

```ts
import { avanzar, guardarGafete, nuevoEstado } from "../gafete";
import { H } from "../historia.es";
import { origen, texto } from "../http";
import type { Nivel } from "../rutas";

export const recepcion: Nivel = {
	numero: 2,
	nombre: "Recepción",
	metodo: "GET",
	ruta: "/recepcion",
	requiere: 0,
	esqueleto: "/recepcion",
	resuelta: [{ nombre: "2. Recepción", metodo: "GET", url: "/recepcion?nombre={{nombre}}&piso=3" }],
	handler: async (c) => {
		const nombre = (c.req.query("nombre") ?? "").trim();
		const piso = c.req.query("piso");
		if (!nombre) return texto(c, H.sinNombre, 400);
		if ([...nombre].length > 30 || /\p{C}/u.test(nombre)) return texto(c, H.nombreInvalido, 400);
		if (piso !== "3") return texto(c, H.pisoEquivocado(piso), 400);
		// Con un gafete válido no se reinicia nada: el progreso y el nombre originales se conservan.
		const previo = c.var.estado;
		const estado = previo ? avanzar(previo, 2) : nuevoEstado(nombre);
		await guardarGafete(c, estado);
		return texto(c, H.nivel2(estado.nombre, origen(c)));
	},
};
```

`src/niveles/03-ascensor.ts`:

```ts
import { avanzar, guardarGafete, jugador } from "../gafete";
import { H } from "../historia.es";
import { origen, texto } from "../http";
import type { Nivel } from "../rutas";

export const ascensor: Nivel = {
	numero: 3,
	nombre: "Ascensor",
	metodo: "GET",
	ruta: "/ascensor",
	requiere: 2,
	esqueleto: "/ascensor",
	resuelta: [{ nombre: "3. Ascensor", metodo: "GET", url: "/ascensor" }],
	handler: async (c) => {
		await guardarGafete(c, avanzar(jugador(c), 3));
		return texto(c, H.nivel3(origen(c)));
	},
};
```

En `src/niveles/index.ts`, importa ambos y agrégalos en orden:

```ts
import type { Nivel } from "../rutas";
import { entrada } from "./01-entrada";
import { recepcion } from "./02-recepcion";
import { ascensor } from "./03-ascensor";

/** Registro ordenado de niveles: lo usan el router, /pista y /coleccion. */
export const NIVELES: Nivel[] = [entrada, recepcion, ascensor];
```

- [ ] **Step 6: Correr tests y typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
pnpm format
git add src/niveles src/historia.es.ts test/ayuda.ts test/recepcion.spec.ts
git commit -m "feat: levels 2-3, reception badge and elevator

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: Niveles 4 y 5 (redirect y HEAD)

**Files:**
- Create: `src/niveles/04-piso.ts`, `src/niveles/05-cocina.ts`, `test/piso.spec.ts`
- Modify: `src/niveles/index.ts`, `src/historia.es.ts`, `test/ayuda.ts`

**Interfaces:**
- Consumes: `fragmento` (Tarea 3); `avanzar`, `guardarGafete`, `jugador` (Tarea 2).
- Produces: `piso: Nivel` (GET `/piso/:n`, requiere 3), `cocina: Nivel` (GET `/piso/3/cocina`, requiere 4; avanza solo con HEAD).
  `TI = { usuario: "becario", clave: "cafeina123" }` exportado desde `src/historia.es.ts` (lo usan las Tareas 9, 12 y 13). `PASOS[4]`, `PASOS[5]`.

- [ ] **Step 1: Agregar a `src/historia.es.ts`**

Arriba de `export const H` (después de `escena`):

```ts
/** Credenciales de TI del juego: salen en un post-it del nivel 5. Son parte del acertijo, no un secreto. */
export const TI = { usuario: "becario", clave: "cafeina123" } as const;
```

Dentro de `H`, encima del marcador:

```ts
	nivel4: (o: string) =>
		escena(
			"09:03",
			"Piso 3",
			`Un cartel: «La cocina se mudó al fondo del pasillo». Y una flecha.

Eso que recibiste es un 301 Moved Permanently: el servidor te dice que
lo que buscas está en otra parte (mira el header Location). curl no
sigue flechas a menos que se lo pidas con -L.`,
			`repite con -L. Y ya que estás, agrega -i: muestra los headers de la
    respuesta, y en este edificio la gente deja cosas en los headers.
    curl -i -L -b cookies.txt -c cookies.txt ${o}/piso/3`,
		),
	otroPiso: (n: string) =>
		`${n === "2" ? "Contabilidad. Ahí no hay café, solo Excel." : n === "1" ? "En el piso 1 solo hay una planta de plástico." : `El piso ${n.slice(0, 10)} no existe o no tiene café.`} Tu equipo está en el 3.`,
	cocina: (o: string) =>
		escena(
			"09:04",
			"Cocina del piso 3",
			`La cafetera tiene un papel: «FUERA DE SERVICIO desde 2019».
Detrás hay algo pegado. No está en el cuerpo de esta respuesta:
está en los headers.`,
			`pide solo los headers con -I (eso hace una petición HEAD):
    curl -I -b cookies.txt -c cookies.txt ${o}/piso/3/cocina`,
		),
	postIts: {
		"X-Post-It-1": "Cafetera rota. La buena esta en TI, pero TI no presta nada sin papeleo de RRHH.",
		"X-Post-It-2": 'RRHH: POST /rrhh/solicitud con JSON {"motivo": "...", "urgencia": 1-10}',
		"X-Post-It-3": `TI -> usuario: ${TI.usuario} / clave: ${TI.clave} (no se lo digas a nadie)`,
		"X-Post-It-4": "El Content-Type importa. RRHH no lee lo que no entiende.",
	} as Record<string, string>,
```

- [ ] **Step 2: Agregar pasos a `test/ayuda.ts`**

```ts
	4: (j) => j.pedir("/piso/3"),
	5: (j) => j.pedir("/piso/3/cocina", { method: "HEAD" }),
```

- [ ] **Step 3: Escribir `test/piso.spec.ts` (falla)**

```ts
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { fragmento } from "../src/receta";
import { Jugador, jugarHasta } from "./ayuda";

describe("nivel 4: piso 3", () => {
	it("antes del ascensor → 409", async () => {
		const j = new Jugador();
		await jugarHasta(j, 2);
		expect((await j.pedir("/piso/3")).status).toBe(409);
	});

	it("301 a la cocina, con fragmento 1 y la cookie actualizada", async () => {
		const j = new Jugador();
		await jugarHasta(j, 3);
		const res = await j.pedir("/piso/3");
		expect(res.status).toBe(301);
		expect(res.headers.get("location")).toBe("/piso/3/cocina");
		expect(res.headers.getSetCookie()[0]).toMatch(/^gafete=/);
		expect(res.headers.get("x-receta-1")).toBe(await fragmento(env.GAFETE_SECRET, j.estado.id as string, 1));
		expect(await res.text()).toContain("-L");
		expect(j.estado.nivel).toBe(4);
	});

	it.each([
		["2", "solo Excel"],
		["1", "planta de plástico"],
		["9", "no existe"],
	])("/piso/%s → 404 con chiste", async (n, texto) => {
		const j = new Jugador();
		await jugarHasta(j, 3);
		const res = await j.pedir(`/piso/${n}`);
		expect(res.status).toBe(404);
		expect(await res.text()).toContain(texto);
	});
});

describe("nivel 5: cocina", () => {
	it("GET describe la cafetera, sin post-its y sin avanzar", async () => {
		const j = new Jugador();
		await jugarHasta(j, 4);
		const res = await j.pedir("/piso/3/cocina");
		expect(res.status).toBe(200);
		expect(await res.text()).toContain("FUERA DE SERVICIO");
		expect(res.headers.get("x-post-it-1")).toBeNull();
		expect(j.estado.nivel).toBe(4);
	});

	it("HEAD muestra los post-its y avanza al nivel 5", async () => {
		const j = new Jugador();
		await jugarHasta(j, 4);
		const res = await j.pedir("/piso/3/cocina", { method: "HEAD" });
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("");
		expect(res.headers.get("x-post-it-2")).toContain("/rrhh/solicitud");
		expect(res.headers.get("x-post-it-3")).toContain("becario");
		expect(j.estado.nivel).toBe(5);
	});

	it("antes del piso 3 → 409", async () => {
		const j = new Jugador();
		await jugarHasta(j, 3);
		expect((await j.pedir("/piso/3/cocina", { method: "HEAD" })).status).toBe(409);
	});
});
```

- [ ] **Step 4: Correr y verificar que falla**

Run: `pnpm vitest run test/piso.spec.ts`
Expected: FAIL (404 en `/piso/3`).

- [ ] **Step 5: Implementar los niveles**

`src/niveles/04-piso.ts`:

```ts
import { avanzar, guardarGafete, jugador } from "../gafete";
import { H } from "../historia.es";
import { origen, texto } from "../http";
import { fragmento } from "../receta";
import type { Nivel } from "../rutas";

export const piso: Nivel = {
	numero: 4,
	nombre: "Piso 3",
	metodo: "GET",
	ruta: "/piso/:n",
	requiere: 3,
	esqueleto: "/piso/3",
	resuelta: [
		{
			nombre: "4. Piso 3 (sin seguir el redirect)",
			metodo: "GET",
			url: "/piso/3",
			sinRedirect: true,
			captura: ['pm.collectionVariables.set("receta_1", pm.response.headers.get("X-Receta-1"));'],
		},
	],
	handler: async (c) => {
		const n = c.req.param("n") ?? "";
		if (n !== "3") return texto(c, H.otroPiso(n), 404);
		const estado = avanzar(jugador(c), 4);
		// La cookie va en el 301: curl -L -c la guarda antes de seguir la flecha.
		await guardarGafete(c, estado);
		return texto(c, H.nivel4(origen(c)), 301, {
			Location: "/piso/3/cocina",
			"X-Receta-1": await fragmento(c.env.GAFETE_SECRET, estado.id, 1),
		});
	},
};
```

`src/niveles/05-cocina.ts`:

```ts
import { avanzar, guardarGafete, jugador } from "../gafete";
import { H } from "../historia.es";
import { origen, texto } from "../http";
import type { Nivel } from "../rutas";

export const cocina: Nivel = {
	numero: 5,
	nombre: "Cocina del piso 3",
	metodo: "GET",
	ruta: "/piso/3/cocina",
	requiere: 4,
	esqueleto: "/piso/3/cocina",
	resuelta: [{ nombre: "5. Cocina (HEAD)", metodo: "HEAD", url: "/piso/3/cocina" }],
	handler: async (c) => {
		// Hono rutea HEAD como GET, pero c.req.method sigue siendo "HEAD".
		if (c.req.method !== "HEAD") return texto(c, H.cocina(origen(c)));
		await guardarGafete(c, avanzar(jugador(c), 5));
		return texto(c, "", 200, H.postIts);
	},
};
```

`src/niveles/index.ts`: importa `piso` desde `./04-piso` y `cocina` desde `./05-cocina`, y deja
`export const NIVELES: Nivel[] = [entrada, recepcion, ascensor, piso, cocina];`

- [ ] **Step 6: Correr tests y typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
pnpm format
git add src/niveles src/historia.es.ts test/ayuda.ts test/piso.spec.ts
git commit -m "feat: levels 4-5, redirect with fragment and HEAD post-its

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: Nivel 6 (solicitud JSON) e incidente

**Files:**
- Create: `src/niveles/06-solicitud.ts`, `src/incidente.ts`, `test/solicitud.spec.ts`
- Modify: `src/niveles/index.ts`, `src/index.ts` (RUTAS + header `X-Perro`), `src/historia.es.ts`, `test/ayuda.ts`

**Interfaces:**
- Consumes: `tipoContenido` (Tarea 2), `fragmento` (Tarea 3), `Ruta` (Tarea 4).
- Produces: `solicitud: Nivel` (POST `/rrhh/solicitud`, requiere 5; deja `incidente = "abierto"` si era `null`).
  `INCIDENTE: Ruta` (POST `/incidente/ack`, requiere 6; deja `incidente = "atendido"` y entrega `X-Receta-5`).
  `H.jsonRoto` es genérico: también lo usa la Tarea 9. `PASOS[6]`.

- [ ] **Step 1: Agregar textos a `src/historia.es.ts`** (encima del marcador)

```ts
	soloJson: 'RRHH solo lee JSON. Dile a curl qué le mandas:\n  -H "Content-Type: application/json"',
	jsonRoto:
		"Eso no es JSON válido. Revisa comillas y llaves.\n(¿PowerShell peleando con las comillas? Guarda el JSON en un archivo y usa  -d @archivo.json)",
	sinMotivo: 'Falta el motivo: un texto de hasta 200 caracteres.  {"motivo": "...", "urgencia": 1-10}',
	urgenciaAlta: "La escala va hasta 10. Te creemos, pero pon 10.",
	urgenciaInvalida: "urgencia debe ser un número entero del 1 al 10 (sin comillas).",
	nivel6: (nombre: string, o: string) =>
		escena(
			"09:06",
			"RRHH",
			`«Solicitud recibida», dice Marta de RRHH, sin levantar la vista.
«Ahora el formulario C-27 firmado, ${nombre}. Subido como archivo, por favor.»

En ese momento suenan todos los teléfonos del piso a la vez:

  ALERTA: producción está caída. Alguien tiene que atenderlo:
          POST ${o}/incidente/ack

Tú solo querías un café.`,
			`arma el formulario con tu firma y súbelo con -F (multipart):
    echo "firma: ${nombre}" > formulario.txt
    curl -b cookies.txt -c cookies.txt -F "formulario=@formulario.txt" ${o}/rrhh/formulario
    (o atiende el incidente primero. Tú decides.)`,
		),
	incidenteAtendido: escena(
		"--:--",
		"Incidente",
		`Dejas el café para después y abres el dashboard. Era un disco lleno:
40 GB de logs de debug. Los borras y producción vuelve a respirar.
Alguien en el chat te manda un aplauso y te deja un post-it de
agradecimiento (está en los headers).

Ahora sí: el café.`,
	),
	perro: "sentado, con cafe, todo arde. X-Mood: this is fine",
```

- [ ] **Step 2: Agregar paso a `test/ayuda.ts`**

```ts
	6: (j) =>
		j.pedir("/rrhh/solicitud", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ motivo: "necesito cafe", urgencia: 10 }),
		}),
```

- [ ] **Step 3: Escribir `test/solicitud.spec.ts` (falla)**

```ts
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { fragmento } from "../src/receta";
import { Jugador, jugarHasta } from "./ayuda";

const json = (body: string, tipo = "application/json"): RequestInit => ({ method: "POST", headers: { "Content-Type": tipo }, body });

describe("nivel 6: solicitud a RRHH", () => {
	it("antes de la cocina → 409", async () => {
		const j = new Jugador();
		await jugarHasta(j, 4);
		expect((await j.pedir("/rrhh/solicitud", json('{"motivo":"x","urgencia":1}'))).status).toBe(409);
	});

	it.each([
		[json('{"motivo":"x","urgencia":1}', "text/plain"), 415, "solo lee JSON"],
		[json("{motivo: x}"), 400, "no es JSON válido"],
		[json('{"urgencia":3}'), 400, "Falta el motivo"],
		[json(`{"motivo":"${"x".repeat(201)}","urgencia":3}`), 400, "Falta el motivo"],
		[json('{"motivo":"x","urgencia":11}'), 400, "pon 10"],
		[json('{"motivo":"x","urgencia":0}'), 400, "del 1 al 10"],
		[json('{"motivo":"x","urgencia":"alta"}'), 400, "del 1 al 10"],
		[json('{"motivo":"x","urgencia":3.5}'), 400, "del 1 al 10"],
		[json("[1,2]"), 400, "Falta el motivo"],
	])("petición inválida → %#", async (init, status, texto) => {
		const j = new Jugador();
		await jugarHasta(j, 5);
		const res = await j.pedir("/rrhh/solicitud", init);
		expect(res.status).toBe(status);
		expect(await res.text()).toContain(texto);
		expect(j.estado.nivel).toBe(5);
	});

	it("acepta Content-Type con charset, avanza y abre el incidente", async () => {
		const j = new Jugador();
		await jugarHasta(j, 5);
		const res = await j.pedir("/rrhh/solicitud", json('{"motivo":"sueño","urgencia":10}', "application/json; charset=utf-8"));
		expect(res.status).toBe(200);
		expect(await res.text()).toContain("/incidente/ack");
		expect(j.estado).toMatchObject({ nivel: 6, incidente: "abierto" });
	});
});

describe("incidente", () => {
	it("antes del nivel 6 → 409", async () => {
		const j = new Jugador();
		await jugarHasta(j, 5);
		expect((await j.pedir("/incidente/ack", { method: "POST" })).status).toBe(409);
	});

	it("X-Perro aparece mientras el incidente está abierto y se va al atenderlo", async () => {
		const j = new Jugador();
		await jugarHasta(j, 6);
		expect((await j.pedir("/ascensor")).headers.get("x-perro")).toContain("this is fine");
		const ack = await j.pedir("/incidente/ack", { method: "POST" });
		expect(ack.status).toBe(200);
		expect(ack.headers.get("x-receta-5")).toBe(await fragmento(env.GAFETE_SECRET, j.estado.id as string, 5));
		expect(ack.headers.get("x-perro")).toBeNull();
		expect(j.estado.incidente).toBe("atendido");
		expect((await j.pedir("/ascensor")).headers.get("x-perro")).toBeNull();
	});

	it("repetir la solicitud después del ack no reabre el incidente", async () => {
		const j = new Jugador();
		await jugarHasta(j, 6);
		await j.pedir("/incidente/ack", { method: "POST" });
		await j.pedir("/rrhh/solicitud", json('{"motivo":"otra vez","urgencia":5}'));
		expect(j.estado.incidente).toBe("atendido");
	});
});
```

- [ ] **Step 4: Correr y verificar que falla**

Run: `pnpm vitest run test/solicitud.spec.ts`
Expected: FAIL (404 en `/rrhh/solicitud`).

- [ ] **Step 5: Implementar el nivel 6**

`src/niveles/06-solicitud.ts`:

```ts
import { avanzar, guardarGafete, jugador } from "../gafete";
import { H } from "../historia.es";
import { origen, texto, tipoContenido } from "../http";
import type { Nivel } from "../rutas";
import type { Estado } from "../tipos";

export const solicitud: Nivel = {
	numero: 6,
	nombre: "RRHH: solicitud",
	metodo: "POST",
	ruta: "/rrhh/solicitud",
	requiere: 5,
	esqueleto: "/rrhh/solicitud",
	resuelta: [
		{
			nombre: "6. RRHH: solicitud (JSON)",
			metodo: "POST",
			url: "/rrhh/solicitud",
			headers: { "Content-Type": "application/json" },
			cuerpo: { modo: "raw", raw: '{"motivo": "necesito un cafe antes de la daily", "urgencia": 10}' },
		},
	],
	handler: async (c) => {
		if (tipoContenido(c) !== "application/json") return texto(c, H.soloJson, 415);
		let datos: unknown;
		try {
			datos = JSON.parse(await c.req.text());
		} catch {
			return texto(c, H.jsonRoto, 400);
		}
		const { motivo, urgencia } = (typeof datos === "object" && datos !== null && !Array.isArray(datos) ? datos : {}) as Record<
			string,
			unknown
		>;
		if (typeof motivo !== "string" || !motivo.trim() || motivo.length > 200) return texto(c, H.sinMotivo, 400);
		const entero = typeof urgencia === "number" && Number.isInteger(urgencia);
		if (entero && urgencia > 10) return texto(c, H.urgenciaAlta, 400);
		if (!entero || urgencia < 1) return texto(c, H.urgenciaInvalida, 400);
		const previo = jugador(c);
		const estado: Estado = { ...avanzar(previo, 6), incidente: previo.incidente ?? "abierto" };
		await guardarGafete(c, estado);
		return texto(c, H.nivel6(estado.nombre, origen(c)));
	},
};
```

`src/niveles/index.ts`: importa `solicitud` desde `./06-solicitud` y agrégalo al final de `NIVELES`.

- [ ] **Step 6: Implementar el incidente**

`src/incidente.ts`:

```ts
import { guardarGafete, jugador } from "./gafete";
import { H } from "./historia.es";
import { texto } from "./http";
import { fragmento } from "./receta";
import type { Ruta } from "./rutas";

/** Atender el incidente: cierra la puerta al 218 y entrega el fragmento 5 (el que falta para el 200). */
export const INCIDENTE: Ruta = {
	metodo: "POST",
	ruta: "/incidente/ack",
	requiere: 6,
	handler: async (c) => {
		const estado = { ...jugador(c), incidente: "atendido" as const };
		await guardarGafete(c, estado);
		return texto(c, H.incidenteAtendido, 200, { "X-Receta-5": await fragmento(c.env.GAFETE_SECRET, estado.id, 5) });
	},
};
```

- [ ] **Step 7: Montar el incidente y agregar `X-Perro` en `src/index.ts`**

Importa `INCIDENTE` y cambia `RUTAS`:

```ts
import { INCIDENTE } from "./incidente";

const RUTAS: Ruta[] = [...NIVELES, INCIDENTE];
```

En el middleware de log, justo después de `const estado = c.var.estado;`:

```ts
	// Pista para el final secreto: solo la ve quien mira headers mientras producción arde.
	if (estado?.incidente === "abierto") c.res.headers.set("X-Perro", H.perro);
```

- [ ] **Step 8: Correr tests y typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
pnpm format
git add src/niveles src/incidente.ts src/index.ts src/historia.es.ts test/ayuda.ts test/solicitud.spec.ts
git commit -m "feat: level 6 JSON request and production incident

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: Nivel 7 (formulario multipart)

**Files:**
- Create: `src/niveles/07-formulario.ts`, `test/formulario.spec.ts`
- Modify: `src/niveles/index.ts`, `src/historia.es.ts`, `test/ayuda.ts`

**Interfaces:**
- Consumes: `tipoContenido`, `fragmento`, `avanzar`, `guardarGafete`, `jugador`.
- Produces: `formulario: Nivel` (POST `/rrhh/formulario`, requiere 6; entrega `X-Receta-2`). `PASOS[7]`.

- [ ] **Step 1: Agregar textos a `src/historia.es.ts`** (encima del marcador)

```ts
	noMultipart: 'Marta no acepta eso. El formulario va como multipart/form-data;\ncurl lo arma solo con -F:  -F "formulario=@formulario.txt"',
	sinFormulario: 'No llegó ningún formulario. El campo se llama formulario:\n  -F "formulario=@formulario.txt"   (la @ sube el archivo)',
	formularioGrande: "Marta mira el archivo: «¿Esto es un formulario o una novela?». Máximo 10 KB.",
	sinFirma: "El formulario no está firmado. Debe tener una línea como:  firma: TuNombre",
	nivel7: (o: string) =>
		escena(
			"09:08",
			"RRHH",
			"Marta sella el formulario sin leerlo. «Listo. TI ya puede atenderte.»",
			`TI tiene la máquina buena. Pide acceso:
    curl -b cookies.txt -c cookies.txt ${o}/ti/maquina`,
		),
```

- [ ] **Step 2: Agregar paso a `test/ayuda.ts`**

```ts
	7: (j) => {
		const fd = new FormData();
		fd.append("formulario", new File(["firma: Ana\n"], "formulario.txt", { type: "text/plain" }));
		return j.pedir("/rrhh/formulario", { method: "POST", body: fd });
	},
```

- [ ] **Step 3: Escribir `test/formulario.spec.ts` (falla)**

```ts
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { fragmento } from "../src/receta";
import { Jugador, jugarHasta } from "./ayuda";

function multipart(campo: string, valor: string | File): RequestInit {
	const fd = new FormData();
	fd.append(campo, valor);
	return { method: "POST", body: fd };
}

const archivo = (contenido: BlobPart) => new File([contenido], "formulario.txt", { type: "text/plain" });

/** Lo que genera `echo "firma: Ana" > formulario.txt` en Windows PowerShell 5.1: UTF-16LE con BOM. */
function utf16le(texto: string): Uint8Array {
	const bytes = new Uint8Array(2 + texto.length * 2);
	bytes.set([0xff, 0xfe]);
	for (let i = 0; i < texto.length; i++) bytes[2 + i * 2] = texto.charCodeAt(i);
	return bytes;
}

describe("nivel 7: formulario", () => {
	it("antes de la solicitud → 409", async () => {
		const j = new Jugador();
		await jugarHasta(j, 5);
		expect((await j.pedir("/rrhh/formulario", multipart("formulario", archivo("firma: Ana")))).status).toBe(409);
	});

	it.each([
		[{ method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }, 415, "multipart/form-data"],
		[{ method: "POST", headers: { "Content-Type": "multipart/form-data" }, body: "basura" }, 400, "ningún formulario"],
		[multipart("archivo", archivo("firma: Ana")), 400, "ningún formulario"],
		[multipart("formulario", archivo("x".repeat(10 * 1024 + 1))), 413, "Máximo 10 KB"],
		[multipart("formulario", archivo("hola, soy Ana")), 400, "no está firmado"],
	] as [RequestInit, number, string][])("petición inválida → %#", async (init, status, texto) => {
		const j = new Jugador();
		await jugarHasta(j, 6);
		const res = await j.pedir("/rrhh/formulario", init);
		expect(res.status).toBe(status);
		expect(await res.text()).toContain(texto);
		expect(j.estado.nivel).toBe(6);
	});

	it.each([
		["archivo UTF-8", archivo("Formulario C-27\nFIRMA:Ana\n")],
		["archivo UTF-16LE de PowerShell 5.1", archivo(utf16le("firma: Ana\r\n"))],
		["campo de texto (colección)", "firma: Ana"],
	])("acepta %s, avanza y entrega el fragmento 2", async (_, valor) => {
		const j = new Jugador();
		await jugarHasta(j, 6);
		const res = await j.pedir("/rrhh/formulario", multipart("formulario", valor));
		expect(res.status).toBe(200);
		expect(await res.text()).toContain("/ti/maquina");
		expect(res.headers.get("x-receta-2")).toBe(await fragmento(env.GAFETE_SECRET, j.estado.id as string, 2));
		expect(j.estado.nivel).toBe(7);
	});
});
```

- [ ] **Step 4: Correr y verificar que falla**

Run: `pnpm vitest run test/formulario.spec.ts`
Expected: FAIL (404 en `/rrhh/formulario`).

- [ ] **Step 5: Implementar `src/niveles/07-formulario.ts`**

```ts
import { avanzar, guardarGafete, jugador } from "../gafete";
import { H } from "../historia.es";
import { origen, texto, tipoContenido } from "../http";
import { fragmento } from "../receta";
import type { Nivel } from "../rutas";

const MAXIMO = 10 * 1024;

export const formulario: Nivel = {
	numero: 7,
	nombre: "RRHH: formulario firmado",
	metodo: "POST",
	ruta: "/rrhh/formulario",
	requiere: 6,
	esqueleto: "/rrhh/formulario",
	resuelta: [
		{
			nombre: "7. RRHH: formulario (multipart)",
			metodo: "POST",
			url: "/rrhh/formulario",
			cuerpo: { modo: "formdata", campos: { formulario: "firma: {{nombre}}" } },
			captura: ['pm.collectionVariables.set("receta_2", pm.response.headers.get("X-Receta-2"));'],
		},
	],
	handler: async (c) => {
		if (tipoContenido(c) !== "multipart/form-data") return texto(c, H.noMultipart, 415);
		let campo: unknown;
		try {
			campo = (await c.req.parseBody())["formulario"];
		} catch {
			return texto(c, H.sinFormulario, 400);
		}
		// Archivo (-F "formulario=@archivo") o texto (-F "formulario=firma: Ana", colección Postman).
		if (typeof campo !== "string" && !(campo instanceof File)) return texto(c, H.sinFormulario, 400);
		const tamano = typeof campo === "string" ? new TextEncoder().encode(campo).byteLength : campo.size;
		if (tamano > MAXIMO) return texto(c, H.formularioGrande, 413);
		const contenido = typeof campo === "string" ? campo : await campo.text();
		// Los NUL salen de archivos UTF-16 (echo > archivo en Windows PowerShell 5.1).
		if (!/firma\s*:/i.test(contenido.replaceAll("\u0000", ""))) return texto(c, H.sinFirma, 400);
		const estado = avanzar(jugador(c), 7);
		await guardarGafete(c, estado);
		return texto(c, H.nivel7(origen(c)), 200, { "X-Receta-2": await fragmento(c.env.GAFETE_SECRET, estado.id, 2) });
	},
};
```

`src/niveles/index.ts`: importa `formulario` desde `./07-formulario` y agrégalo al final de `NIVELES`.

- [ ] **Step 6: Correr tests y typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: PASS. Si el caso `"basura"` devuelve 500 en vez de 400, es porque `parseBody` no lanzó dentro del `try`. Revisa que la
llamada esté dentro del bloque y no antes.

- [ ] **Step 7: Commit**

```bash
pnpm format
git add src/niveles src/historia.es.ts test/ayuda.ts test/formulario.spec.ts
git commit -m "feat: level 7 multipart signed form upload

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 9: Niveles 8, 9 y 10 (TI: Basic, Bearer, PUT y DELETE)

**Files:**
- Create: `src/niveles/08-ti.ts`, `src/niveles/09-config.ts`, `src/niveles/10-bloqueo.ts`, `test/ti.spec.ts`
- Modify: `src/niveles/index.ts`, `src/historia.es.ts`, `test/ayuda.ts`

**Interfaces:**
- Consumes: `credencialesBasic`, `tipoContenido` (Tarea 2); `tokenTi`, `rechazoBearer` (Tarea 2); `TI` (Tarea 6); `H.jsonRoto` (Tarea 7).
- Produces: `ti: Nivel` (GET `/ti/maquina`, requiere 7; responde con el token en el cuerpo), `config: Nivel` (PUT `/ti/maquina/config`,
  requiere 8), `bloqueo: Nivel` (DELETE `/ti/maquina/bloqueo`, requiere 9; entrega `X-Receta-3`).
  `PASOS[8]` (guarda `j.tokenTi`), `PASOS[9]`, `PASOS[10]`, y `CLAVE_TI` exportada desde `test/ayuda.ts`.

- [ ] **Step 1: Agregar textos a `src/historia.es.ts`** (encima del marcador)

```ts
	tiPideCredenciales: "Sale alguien de TI con audífonos: «¿Usuario y clave?».\n(curl hace Basic auth con  -u usuario:clave . ¿Viste algún post-it por ahí?)",
	tiClaveMala: "«Esa clave no es.» Revisa los post-its de la cocina (curl -I).",
	nivel8: (token: string) =>
		escena(
			"09:09",
			"TI",
			`«Ah, el nuevo. La máquina está bloqueada y en modo ahorro.
Toma, tu token de acceso:»

  ${token}

«Primero ponla en modo barista: PUT a /ti/maquina/config con JSON.
Después quítale el bloqueo con DELETE a /ti/maquina/bloqueo.
El token va en el header Authorization, tipo Bearer. Nunca en la URL.»`,
			'configura la máquina. El JSON es {"modo": "barista"}.',
		),
	modoInvalido: 'Modos disponibles: barista.  {"modo": "barista"}',
	nivel9: escena(
		"09:10",
		"TI",
		`La máquina hace un ruido de avión despegando. Modo barista activado.
Pero sigue el candado rojo en la pantalla.`,
		"quítale el bloqueo (DELETE, con el mismo token).",
	),
	nivel10: escena(
		"09:11",
		"TI",
		`Candado fuera. La pantalla dice: «Escriba su pedido».
Hay una advertencia pegada con cinta: «este teclado no entiende & ni =
ni espacios sin codificar».`,
		`haz tu pedido, exacto:  leche=si & azucar=no
    Va como formulario (-d) en el campo pedido, a /cafetera/pedido.
    curl tiene una variante de -d que codifica esos caracteres por ti.`,
	),
```

- [ ] **Step 2: Agregar a `test/ayuda.ts`**

Después de `BASE`:

```ts
export const CLAVE_TI = `Basic ${btoa("becario:cafeina123")}`;
```

En `PASOS`, encima del marcador:

```ts
	8: async (j) => {
		const res = await j.pedir("/ti/maquina", { headers: { Authorization: CLAVE_TI } });
		j.tokenTi = /ti_[A-Za-z0-9_-]+/.exec(await res.clone().text())?.[0] ?? null;
		return res;
	},
	9: (j) =>
		j.pedir("/ti/maquina/config", {
			method: "PUT",
			headers: { Authorization: `Bearer ${j.tokenTi}`, "Content-Type": "application/json" },
			body: '{"modo": "barista"}',
		}),
	10: (j) => j.pedir("/ti/maquina/bloqueo", { method: "DELETE", headers: { Authorization: `Bearer ${j.tokenTi}` } }),
```

- [ ] **Step 3: Escribir `test/ti.spec.ts` (falla)**

```ts
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { tokenTi } from "../src/gafete";
import { fragmento } from "../src/receta";
import { CLAVE_TI, Jugador, jugarHasta } from "./ayuda";

describe("nivel 8: TI con Basic auth", () => {
	it("sin credenciales → 401 con WWW-Authenticate: Basic", async () => {
		const j = new Jugador();
		await jugarHasta(j, 7);
		const res = await j.pedir("/ti/maquina");
		expect(res.status).toBe(401);
		expect(res.headers.get("www-authenticate")).toBe('Basic realm="TI", charset="UTF-8"');
		expect(await res.text()).toContain("-u usuario:clave");
	});

	it("clave equivocada → 401", async () => {
		const j = new Jugador();
		await jugarHasta(j, 7);
		const res = await j.pedir("/ti/maquina", { headers: { Authorization: `Basic ${btoa("becario:decaf")}` } });
		expect(res.status).toBe(401);
		expect(await res.text()).toContain("Esa clave no es");
	});

	it("credenciales correctas → token del jugador y nivel 8", async () => {
		const j = new Jugador();
		await jugarHasta(j, 7);
		const res = await j.pedir("/ti/maquina", { headers: { Authorization: CLAVE_TI } });
		expect(res.status).toBe(200);
		expect(await res.text()).toContain(await tokenTi(j.estado.id as string, env.GAFETE_SECRET));
		expect(j.estado.nivel).toBe(8);
	});
});

describe("niveles 9 y 10: Bearer, PUT y DELETE", () => {
	it("PUT sin token → 401 Bearer; token de otro jugador → 401 invalid_token", async () => {
		const j = new Jugador();
		const otro = new Jugador();
		await jugarHasta(j, 8);
		await jugarHasta(otro, 8);
		const init = (auth?: string): RequestInit => ({
			method: "PUT",
			headers: { ...(auth ? { Authorization: auth } : {}), "Content-Type": "application/json" },
			body: '{"modo":"barista"}',
		});
		const sin = await j.pedir("/ti/maquina/config", init());
		expect(sin.status).toBe(401);
		expect(sin.headers.get("www-authenticate")).toBe('Bearer realm="TI"');
		const ajeno = await j.pedir("/ti/maquina/config", init(`Bearer ${otro.tokenTi}`));
		expect(ajeno.status).toBe(401);
		expect(ajeno.headers.get("www-authenticate")).toContain('error="invalid_token"');
		expect(j.estado.nivel).toBe(8);
	});

	it.each([
		[{ "Content-Type": "text/plain" }, '{"modo":"barista"}', 415, "solo lee JSON"],
		[{ "Content-Type": "application/json" }, "{modo}", 400, "no es JSON válido"],
		[{ "Content-Type": "application/json" }, '{"modo":"turbo"}', 400, "barista"],
	])("PUT inválido → %#", async (headers, body, status, texto) => {
		const j = new Jugador();
		await jugarHasta(j, 8);
		const res = await j.pedir("/ti/maquina/config", { method: "PUT", headers: { ...headers, Authorization: `Bearer ${j.tokenTi}` }, body });
		expect(res.status).toBe(status);
		expect(await res.text()).toContain(texto);
	});

	it("GET a la config → 405 con Allow: PUT", async () => {
		const j = new Jugador();
		await jugarHasta(j, 8);
		const res = await j.pedir("/ti/maquina/config");
		expect(res.status).toBe(405);
		expect(res.headers.get("allow")).toBe("PUT");
	});

	it("PUT correcto → nivel 9; DELETE → nivel 10 con fragmento 3", async () => {
		const j = new Jugador();
		await jugarHasta(j, 9);
		expect(j.estado.nivel).toBe(9);
		const sinToken = await j.pedir("/ti/maquina/bloqueo", { method: "DELETE" });
		expect(sinToken.status).toBe(401);
		const res = await j.pedir("/ti/maquina/bloqueo", { method: "DELETE", headers: { Authorization: `Bearer ${j.tokenTi}` } });
		expect(res.status).toBe(200);
		expect(await res.text()).toContain("leche=si & azucar=no");
		expect(res.headers.get("x-receta-3")).toBe(await fragmento(env.GAFETE_SECRET, j.estado.id as string, 3));
		expect(j.estado.nivel).toBe(10);
	});
});
```

- [ ] **Step 4: Correr y verificar que falla**

Run: `pnpm vitest run test/ti.spec.ts`
Expected: FAIL (404 en `/ti/maquina`).

- [ ] **Step 5: Implementar los niveles**

`src/niveles/08-ti.ts`:

```ts
import { avanzar, guardarGafete, jugador, tokenTi } from "../gafete";
import { H, TI } from "../historia.es";
import { credencialesBasic, texto } from "../http";
import type { Nivel } from "../rutas";

const DESAFIO = { "WWW-Authenticate": 'Basic realm="TI", charset="UTF-8"' };

export const ti: Nivel = {
	numero: 8,
	nombre: "TI: la máquina buena",
	metodo: "GET",
	ruta: "/ti/maquina",
	requiere: 7,
	esqueleto: "/ti/maquina",
	resuelta: [
		{
			nombre: "8. TI (Basic auth)",
			metodo: "GET",
			url: "/ti/maquina",
			headers: { Authorization: `Basic ${btoa(`${TI.usuario}:${TI.clave}`)}` },
			captura: ["const m = pm.response.text().match(/ti_[A-Za-z0-9_-]+/);", 'if (m) pm.collectionVariables.set("token_ti", m[0]);'],
		},
	],
	handler: async (c) => {
		const cred = credencialesBasic(c);
		if (!cred) return texto(c, H.tiPideCredenciales, 401, DESAFIO);
		if (cred.usuario !== TI.usuario || cred.clave !== TI.clave) return texto(c, H.tiClaveMala, 401, DESAFIO);
		const estado = avanzar(jugador(c), 8);
		await guardarGafete(c, estado);
		return texto(c, H.nivel8(await tokenTi(estado.id, c.env.GAFETE_SECRET)));
	},
};
```

`src/niveles/09-config.ts`:

```ts
import { avanzar, guardarGafete, jugador, rechazoBearer } from "../gafete";
import { H } from "../historia.es";
import { texto, tipoContenido } from "../http";
import type { Nivel } from "../rutas";

export const config: Nivel = {
	numero: 9,
	nombre: "TI: modo barista",
	metodo: "PUT",
	ruta: "/ti/maquina/config",
	requiere: 8,
	esqueleto: "/ti/maquina/config",
	resuelta: [
		{
			nombre: "9. TI: modo barista (PUT + Bearer)",
			metodo: "PUT",
			url: "/ti/maquina/config",
			headers: { Authorization: "Bearer {{token_ti}}", "Content-Type": "application/json" },
			cuerpo: { modo: "raw", raw: '{"modo": "barista"}' },
		},
	],
	handler: async (c) => {
		const rechazo = await rechazoBearer(c);
		if (rechazo) return rechazo;
		if (tipoContenido(c) !== "application/json") return texto(c, H.soloJson, 415);
		let datos: unknown;
		try {
			datos = JSON.parse(await c.req.text());
		} catch {
			return texto(c, H.jsonRoto, 400);
		}
		if ((datos as { modo?: unknown } | null)?.modo !== "barista") return texto(c, H.modoInvalido, 400);
		await guardarGafete(c, avanzar(jugador(c), 9));
		return texto(c, H.nivel9);
	},
};
```

`src/niveles/10-bloqueo.ts`:

```ts
import { avanzar, guardarGafete, jugador, rechazoBearer } from "../gafete";
import { H } from "../historia.es";
import { texto } from "../http";
import { fragmento } from "../receta";
import type { Nivel } from "../rutas";

export const bloqueo: Nivel = {
	numero: 10,
	nombre: "TI: quitar el bloqueo",
	metodo: "DELETE",
	ruta: "/ti/maquina/bloqueo",
	requiere: 9,
	esqueleto: "/ti/maquina/bloqueo",
	resuelta: [
		{
			nombre: "10. TI: quitar el bloqueo (DELETE)",
			metodo: "DELETE",
			url: "/ti/maquina/bloqueo",
			headers: { Authorization: "Bearer {{token_ti}}" },
			captura: ['pm.collectionVariables.set("receta_3", pm.response.headers.get("X-Receta-3"));'],
		},
	],
	handler: async (c) => {
		const rechazo = await rechazoBearer(c);
		if (rechazo) return rechazo;
		const estado = avanzar(jugador(c), 10);
		await guardarGafete(c, estado);
		return texto(c, H.nivel10, 200, { "X-Receta-3": await fragmento(c.env.GAFETE_SECRET, estado.id, 3) });
	},
};
```

`src/niveles/index.ts`: importa `ti`, `config` y `bloqueo` desde sus archivos y agrégalos en ese orden al final de `NIVELES`.

- [ ] **Step 6: Correr tests y typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
pnpm format
git add src/niveles src/historia.es.ts test/ayuda.ts test/ti.spec.ts
git commit -m "feat: levels 8-10, Basic and Bearer auth with PUT and DELETE

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 10: Nivel 11 (pedido con URL-encoding)

**Files:**
- Create: `src/niveles/11-pedido.ts`, `test/pedido.spec.ts`
- Modify: `src/niveles/index.ts`, `src/historia.es.ts`, `test/ayuda.ts`

**Interfaces:**
- Produces: `PEDIDO = "leche=si & azucar=no"` (exportado desde `src/niveles/11-pedido.ts`), `pedido: Nivel` (POST `/cafetera/pedido`,
  requiere 10; entrega `X-Receta-4`). `PASOS[11]`.

- [ ] **Step 1: Agregar textos a `src/historia.es.ts`** (encima del marcador)

```ts
	pedidoNoFormulario:
		"La pantalla espera un formulario (application/x-www-form-urlencoded).\nEs lo que curl manda con -d o --data-urlencode.",
	sinPedido: "Falta el campo pedido.  pedido=...",
	pedidoMalCodificado: (campos: [string, string][]) =>
		`La pantalla entendió esto:
${campos
	.slice(0, 5)
	.map(([k, v]) => `  ${JSON.stringify(k.slice(0, 40))} = ${JSON.stringify(v.slice(0, 60))}`)
	.join("\n")}

No es lo que pediste. Dentro de un formulario, & separa campos y = separa
nombre de valor. Hay que codificarlos: --data-urlencode lo hace por ti.`,
	nivel11: escena(
		"09:12",
		"Cafetera de TI",
		`«Pedido recibido: leche=si & azucar=no». La máquina espera la orden final.
En la pantalla, un texto chiquito: «Compatible con HTCPCP/1.0 (RFC 2324)».`,
		`la cafetera quiere que le hables en su idioma. Averigua qué es HTCPCP;
    el endpoint es /cafetera.`,
	),
```

- [ ] **Step 2: Agregar paso a `test/ayuda.ts`**

```ts
	11: (j) =>
		j.pedir("/cafetera/pedido", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: `pedido=${encodeURIComponent("leche=si & azucar=no")}`,
		}),
```

- [ ] **Step 3: Escribir `test/pedido.spec.ts` (falla)**

```ts
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { fragmento } from "../src/receta";
import { Jugador, jugarHasta } from "./ayuda";

const form = (body: string, tipo = "application/x-www-form-urlencoded"): RequestInit => ({
	method: "POST",
	headers: { "Content-Type": tipo },
	body,
});

describe("nivel 11: pedido", () => {
	it("antes de quitar el bloqueo → 409", async () => {
		const j = new Jugador();
		await jugarHasta(j, 9);
		expect((await j.pedir("/cafetera/pedido", form("pedido=x"))).status).toBe(409);
	});

	it("-d sin codificar → 400 que muestra cómo se partió el formulario", async () => {
		const j = new Jugador();
		await jugarHasta(j, 10);
		const res = await j.pedir("/cafetera/pedido", form("pedido=leche=si & azucar=no"));
		expect(res.status).toBe(400);
		const cuerpo = await res.text();
		expect(cuerpo).toContain('"pedido" = "leche=si "');
		expect(cuerpo).toContain('" azucar" = "no"');
		expect(cuerpo).toContain("--data-urlencode");
		expect(j.estado.nivel).toBe(10);
	});

	it.each([
		[form('{"pedido":"x"}', "application/json"), 415, "x-www-form-urlencoded"],
		[form("otra=cosa"), 400, "Falta el campo pedido"],
		[form("pedido=cafe%20solo"), 400, '"pedido" = "cafe solo"'],
	])("petición inválida → %#", async (init, status, texto) => {
		const j = new Jugador();
		await jugarHasta(j, 10);
		const res = await j.pedir("/cafetera/pedido", init);
		expect(res.status).toBe(status);
		expect(await res.text()).toContain(texto);
	});

	it("pedido codificado (con %20 o con +) → nivel 11 y fragmento 4", async () => {
		for (const body of [`pedido=${encodeURIComponent("leche=si & azucar=no")}`, "pedido=leche%3Dsi+%26+azucar%3Dno"]) {
			const j = new Jugador();
			await jugarHasta(j, 10);
			const res = await j.pedir("/cafetera/pedido", form(body));
			expect(res.status).toBe(200);
			expect(await res.text()).toContain("HTCPCP");
			expect(res.headers.get("x-receta-4")).toBe(await fragmento(env.GAFETE_SECRET, j.estado.id as string, 4));
			expect(j.estado.nivel).toBe(11);
		}
	});
});
```

- [ ] **Step 4: Correr y verificar que falla**

Run: `pnpm vitest run test/pedido.spec.ts`
Expected: FAIL (404 en `/cafetera/pedido`).

- [ ] **Step 5: Implementar `src/niveles/11-pedido.ts`**

```ts
import { avanzar, guardarGafete, jugador } from "../gafete";
import { H } from "../historia.es";
import { texto, tipoContenido } from "../http";
import { fragmento } from "../receta";
import type { Nivel } from "../rutas";

/** ASCII a propósito: curl.exe en Windows puede mandar acentos en otra codificación. */
export const PEDIDO = "leche=si & azucar=no";

export const pedido: Nivel = {
	numero: 11,
	nombre: "Cafetera: pedido",
	metodo: "POST",
	ruta: "/cafetera/pedido",
	requiere: 10,
	esqueleto: "/cafetera/pedido",
	resuelta: [
		{
			nombre: "11. Pedido (urlencoded)",
			metodo: "POST",
			url: "/cafetera/pedido",
			cuerpo: { modo: "urlencoded", campos: { pedido: PEDIDO } },
			captura: ['pm.collectionVariables.set("receta_4", pm.response.headers.get("X-Receta-4"));'],
		},
	],
	handler: async (c) => {
		if (tipoContenido(c) !== "application/x-www-form-urlencoded") return texto(c, H.pedidoNoFormulario, 415);
		const campos = new URLSearchParams(await c.req.text());
		const valor = campos.get("pedido");
		if (valor === null) return texto(c, H.sinPedido, 400);
		if (valor.trim() !== PEDIDO) return texto(c, H.pedidoMalCodificado([...campos.entries()]), 400);
		const estado = avanzar(jugador(c), 11);
		await guardarGafete(c, estado);
		return texto(c, H.nivel11, 200, { "X-Receta-4": await fragmento(c.env.GAFETE_SECRET, estado.id, 4) });
	},
};
```

`src/niveles/index.ts`: importa `pedido` desde `./11-pedido` y agrégalo al final de `NIVELES`.

- [ ] **Step 6: Correr tests y typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
pnpm format
git add src/niveles src/historia.es.ts test/ayuda.ts test/pedido.spec.ts
git commit -m "feat: level 11 url-encoded order

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 11: Nivel 12 (la cafetera) y los tres finales

**Files:**
- Create: `src/niveles/12-cafetera.ts`, `test/cafetera.spec.ts`
- Modify: `src/niveles/index.ts`, `src/historia.es.ts`, `test/ayuda.ts`

**Interfaces:**
- Consumes: `decidirFinal`, `ESTADO_HTTP` (Tarea 3); `recetaCorrecta`, `recetaCompleta` (Tarea 3); `texto` con `statusText` (Tarea 2).
- Produces: `cafetera: Nivel` (ALL `/cafetera`, requiere 11; método efectivo = `X-HTTP-Method-Override` si es POST). Deja `nivel = 12`
  y `c.var.final`. `brew(j, extra?)` exportada desde `test/ayuda.ts`. `CAFETERA_HEADERS` exportado desde `src/niveles/12-cafetera.ts`
  (lo usa la colección).

- [ ] **Step 1: Agregar textos a `src/historia.es.ts`**

Cambia el import de tipos al inicio del archivo (agrégalo si no existe):

```ts
import type { Final } from "./tipos";
```

Dentro de `H`, encima del marcador:

```ts
	soloBrew: `La cafetera solo entiende un método: BREW (lo dice el header Allow).
Pero el edificio no deja pasar métodos raros: con -X BREW lo más probable
es que te conteste un 501 antes de llegar a la cafetera.
Hay un header para disfrazar un POST de otro método: X-HTTP-Method-Override.`,
	soloCoffeepot: "La cafetera solo acepta Content-Type: message/coffeepot. Lo dice el RFC 2324.",
	sinAdiciones: "«¿Así, sin nada?» Dile qué le agregas con el header Accept-Additions (leche, azúcar, lo que sea).",
	sinStart: "El cuerpo debe decir start. (RFC 2324: start o stop. stop no te sirve de nada.)",
	final: (final: Final, nombre: string, receta: string) =>
		final === 218
			? escena(
					"09:13",
					"La cafetera",
					`Producción sigue en llamas. Suenan los teléfonos. Alguien grita en el piso 4.
Tú te sirves un café, te sientas y sonríes.

218 This is fine.

Final secreto. El perro estaría orgulloso.`,
				)
			: final === 200
				? escena(
						"09:13",
						"La cafetera",
						`Cargas la receta: ${receta}.
La máquina se calla. Huele a café. Café de verdad.

Llegas a la daily a las 9:14, ${nombre}, con una taza en la mano y producción
funcionando. Nadie sabe cómo lo lograste.

200 OK. Final verdadero.`,
					)
				: escena(
						"09:13",
						"La cafetera",
						`La máquina zumba, vibra... y sale agua caliente. Solo agua.
En un costado, una etiqueta: «Modelo: TETERA 3000».

418 I'm a teapot. Llegas a la daily con un té.

Final normal. Dicen que la cafetera de verdad necesita una receta completa
(5 partes, en un header X-Receta)... y que hay quien se toma el café
mientras todo arde.`,
					),
```

- [ ] **Step 2: Agregar `brew` a `test/ayuda.ts`** (al final del archivo)

```ts
/** La petición final válida: POST disfrazado de BREW. `extra` agrega o pisa headers. */
export function brew(j: Jugador, extra: Record<string, string> = {}, body = "start"): Promise<Response> {
	return j.pedir("/cafetera", {
		method: "POST",
		headers: { "X-HTTP-Method-Override": "BREW", "Content-Type": "message/coffeepot", "Accept-Additions": "leche", ...extra },
		body,
	});
}
```

- [ ] **Step 3: Escribir `test/cafetera.spec.ts` (falla)**

```ts
import { describe, expect, it } from "vitest";
import { Jugador, brew, jugarHasta } from "./ayuda";

describe("nivel 12: la cafetera", () => {
	it("antes del pedido → 409", async () => {
		const j = new Jugador();
		await jugarHasta(j, 10);
		expect((await brew(j)).status).toBe(409);
	});

	it.each([
		["GET", {}],
		["POST", {}],
		["POST", { "X-HTTP-Method-Override": "PUT" }],
	] as [string, Record<string, string>][])("%s %j → 405 con Allow: BREW", async (method, headers) => {
		const j = new Jugador();
		await jugarHasta(j, 11);
		const res = await j.pedir("/cafetera", { method, headers });
		expect(res.status).toBe(405);
		expect(res.headers.get("allow")).toBe("BREW");
		expect(await res.text()).toContain("X-HTTP-Method-Override");
	});

	it.each([
		[{ "Content-Type": "text/plain" }, "start", 415, "message/coffeepot"],
		[{ "Accept-Additions": "" }, "start", 400, "sin nada"],
		[{}, "stop", 400, "start"],
	] as [Record<string, string>, string, number, string][])("BREW inválido → %#", async (extra, body, status, texto) => {
		const j = new Jugador();
		await jugarHasta(j, 11);
		const res = await brew(j, extra, body);
		expect(res.status).toBe(status);
		expect(await res.text()).toContain(texto);
		expect(j.estado.nivel).toBe(11);
	});

	it("final normal: 418 I'm a teapot", async () => {
		const j = new Jugador();
		await jugarHasta(j, 11);
		const res = await brew(j, { "Content-Type": "message/coffeepot; charset=utf-8" });
		expect(res.status).toBe(418);
		expect(res.statusText).toBe("I'm a teapot");
		expect(await res.text()).toContain("TETERA 3000");
		expect(res.headers.getSetCookie()[0]).toMatch(/^gafete=/);
		expect(j.estado.nivel).toBe(12);
	});

	it("final secreto: 218 This is fine con el incidente abierto", async () => {
		const j = new Jugador();
		await jugarHasta(j, 11);
		const res = await brew(j, { "X-Mood": "  This   is FINE " });
		expect(res.status).toBe(218);
		expect(res.statusText).toBe("This is fine");
		expect(await res.text()).toContain("Final secreto");
	});

	it("final verdadero: 200 con el incidente atendido y la receta completa", async () => {
		const j = new Jugador();
		await jugarHasta(j, 11);
		await j.pedir("/incidente/ack", { method: "POST" });
		const receta = [1, 2, 3, 4, 5].map((n) => j.receta[n]);
		expect(receta.every(Boolean)).toBe(true);
		const res = await brew(j, { "X-Receta": receta.join(",") });
		expect(res.status).toBe(200);
		expect(res.statusText).toBe("OK");
		const cuerpo = await res.text();
		expect(cuerpo).toContain("Final verdadero");
		expect(cuerpo).toContain(receta.join(", "));
	});

	it("después del ack el 218 ya no se puede; sin receta queda en 418", async () => {
		const j = new Jugador();
		await jugarHasta(j, 11);
		await j.pedir("/incidente/ack", { method: "POST" });
		expect((await brew(j, { "X-Mood": "this is fine" })).status).toBe(418);
	});

	it("se puede repetir para buscar otro final", async () => {
		const j = new Jugador();
		await jugarHasta(j, 11);
		expect((await brew(j)).status).toBe(418);
		expect((await brew(j, { "X-Mood": "this is fine" })).status).toBe(218);
	});
});
```

- [ ] **Step 4: Correr y verificar que falla**

Run: `pnpm vitest run test/cafetera.spec.ts`
Expected: FAIL (404 en `/cafetera`).

- [ ] **Step 5: Implementar `src/niveles/12-cafetera.ts`**

```ts
import { ESTADO_HTTP, decidirFinal } from "../finales";
import { avanzar, guardarGafete, jugador } from "../gafete";
import { H } from "../historia.es";
import { texto, tipoContenido } from "../http";
import { recetaCompleta, recetaCorrecta } from "../receta";
import type { Nivel } from "../rutas";

/** Headers de la petición final. -X BREW no llega al Worker (el edge responde 501), así que se disfraza un POST. */
export const CAFETERA_HEADERS = {
	"X-HTTP-Method-Override": "BREW",
	"Content-Type": "message/coffeepot",
	"Accept-Additions": "leche",
};

export const cafetera: Nivel = {
	numero: 12,
	nombre: "La cafetera",
	metodo: "ALL",
	ruta: "/cafetera",
	requiere: 11,
	esqueleto: "/cafetera",
	resuelta: [
		{ nombre: "12. BREW (final 418)", metodo: "POST", url: "/cafetera", headers: CAFETERA_HEADERS, cuerpo: { modo: "raw", raw: "start" } },
	],
	handler: async (c) => {
		const metodo = c.req.method === "POST" ? (c.req.header("X-HTTP-Method-Override") ?? "POST").trim().toUpperCase() : c.req.method;
		if (metodo !== "BREW") return texto(c, H.soloBrew, 405, { Allow: "BREW" });
		if (tipoContenido(c) !== "message/coffeepot") return texto(c, H.soloCoffeepot, 415);
		if (!c.req.header("Accept-Additions")?.trim()) return texto(c, H.sinAdiciones, 400);
		if ((await c.req.text()).trim() !== "start") return texto(c, H.sinStart, 400);
		const previo = jugador(c);
		const recetaOk = await recetaCorrecta(c.env.GAFETE_SECRET, previo.id, c.req.header("X-Receta"));
		const final = decidirFinal({ incidente: previo.incidente, mood: c.req.header("X-Mood"), recetaOk });
		const estado = avanzar(previo, 12);
		await guardarGafete(c, estado);
		c.set("final", final);
		const receta = recetaOk ? (await recetaCompleta(c.env.GAFETE_SECRET, estado.id)).join(", ") : "";
		return texto(c, H.final(final, estado.nombre, receta), final, {}, ESTADO_HTTP[final]);
	},
};
```

`src/niveles/index.ts`: importa `cafetera` desde `./12-cafetera` y agrégalo al final de `NIVELES` (quedan 12 niveles).

- [ ] **Step 6: Correr tests y typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: PASS. El caso `GET /cafetera` también cubre `HEAD`, porque Hono lo rutea como GET y `c.req.method` vale `"HEAD"` (no es POST, así que da 405).

- [ ] **Step 7: Commit**

```bash
pnpm format
git add src/niveles src/historia.es.ts test/ayuda.ts test/cafetera.spec.ts
git commit -m "feat: level 12 HTCPCP coffee pot and the three endings

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 12: `/pista`

**Files:**
- Create: `src/pista.ts`, `test/pista.spec.ts`
- Modify: `src/index.ts` (RUTAS), `src/historia.es.ts`

**Interfaces:**
- Consumes: `c.var.lectura` (Tarea 2), `tokenTi` (Tarea 2), `TI` (Tarea 6).
- Produces: `PISTA: Ruta` (GET `/pista`, requiere 0). `H.pista(n, d: { o: string; nombre: string; token: string }): string` para
  n = 2..13 (13 = ya terminaste) y `H.pistaGafeteFalso`.

- [ ] **Step 1: Agregar textos a `src/historia.es.ts`** (encima del marcador)

```ts
	pistaGafeteFalso: "Tu gafete no sirve (alterado o vencido). Borra cookies.txt y empieza otra vez en recepción.",
	pista: (n: number, d: { o: string; nombre: string; token: string }) => {
		const cj = "curl -b cookies.txt -c cookies.txt";
		const pistas: Record<number, string> = {
			2: `Ve a recepción y guarda el gafete:\n  curl -c cookies.txt "${d.o}/recepcion?nombre=${encodeURIComponent(d.nombre)}&piso=3"`,
			3: `Pasa al ascensor con el gafete:\n  ${cj} ${d.o}/ascensor`,
			4: `Entra al piso 3 y sigue la flecha:\n  ${cj} -L ${d.o}/piso/3`,
			5: `Lee lo que está pegado detrás de la cafetera (solo headers):\n  ${cj} -I ${d.o}/piso/3/cocina`,
			6: `Manda la solicitud a RRHH en JSON:\n  ${cj} -H "Content-Type: application/json" -d '{"motivo": "necesito cafe", "urgencia": 10}' ${d.o}/rrhh/solicitud`,
			7: `Sube el formulario firmado:\n  echo "firma: ${d.nombre}" > formulario.txt\n  ${cj} -F "formulario=@formulario.txt" ${d.o}/rrhh/formulario`,
			8: `Entra a TI con Basic auth (usuario y clave están en los post-its de la cocina):\n  ${cj} -u ${TI.usuario}:${TI.clave} ${d.o}/ti/maquina`,
			9: `Pon la máquina en modo barista:\n  ${cj} -X PUT -H "Authorization: Bearer ${d.token}" -H "Content-Type: application/json" -d '{"modo": "barista"}' ${d.o}/ti/maquina/config`,
			10: `Quita el bloqueo:\n  ${cj} -X DELETE -H "Authorization: Bearer ${d.token}" ${d.o}/ti/maquina/bloqueo`,
			11: `Haz el pedido codificado:\n  ${cj} --data-urlencode "pedido=leche=si & azucar=no" ${d.o}/cafetera/pedido`,
			12: `El método es BREW, pero el edificio bloquea métodos raros. Disfrázalo:\n  ${cj} -H "X-HTTP-Method-Override: BREW" -H "Content-Type: message/coffeepot" -H "Accept-Additions: leche" -d start ${d.o}/cafetera`,
			13: "Ya llegaste a la cafetera. Hay tres finales: 418, 200 y uno secreto.\n¿Miraste los headers de todo lo que te respondieron? (-i)",
		};
		return `Pista:\n${pistas[n] ?? pistas[13]}`;
	},
```

- [ ] **Step 2: Escribir `test/pista.spec.ts` (falla)**

```ts
import { describe, expect, it } from "vitest";
import { BASE, Jugador, brew, jugarHasta } from "./ayuda";

describe("/pista", () => {
	it("sin gafete explica cómo empezar", async () => {
		const res = await new Jugador().pedir("/pista");
		expect(res.status).toBe(200);
		expect(await res.text()).toContain(`curl -c cookies.txt "${BASE}/recepcion?nombre=TuNombre&piso=3"`);
	});

	it("con gafete falso dice que se borre", async () => {
		const j = new Jugador();
		j.gafete = "a.b";
		expect(await (await j.pedir("/pista")).text()).toContain("Borra cookies.txt");
	});

	it.each([
		[2, "/ascensor"],
		[3, "-L"],
		[4, "-I"],
		[5, "/rrhh/solicitud"],
		[6, '-F "formulario=@formulario.txt"'],
		[7, "-u becario:cafeina123"],
		[8, "/ti/maquina/config"],
		[9, "-X DELETE"],
		[10, "--data-urlencode"],
		[11, "X-HTTP-Method-Override: BREW"],
	])("después del nivel %i sugiere %s", async (nivel, esperado) => {
		const j = new Jugador();
		await jugarHasta(j, nivel);
		expect(await (await j.pedir("/pista")).text()).toContain(esperado);
	});

	it("en los niveles 9 y 10 incluye el token de TI del jugador", async () => {
		const j = new Jugador();
		await jugarHasta(j, 8);
		expect(await (await j.pedir("/pista")).text()).toContain(`Bearer ${j.tokenTi}`);
	});

	it("después de un final habla de los tres finales", async () => {
		const j = new Jugador();
		await jugarHasta(j, 11);
		await brew(j);
		expect(await (await j.pedir("/pista")).text()).toContain("tres finales");
	});
});
```

- [ ] **Step 3: Correr y verificar que falla**

Run: `pnpm vitest run test/pista.spec.ts`
Expected: FAIL (404 en `/pista`).

- [ ] **Step 4: Implementar `src/pista.ts`**

```ts
import { tokenTi } from "./gafete";
import { H } from "./historia.es";
import { origen, texto } from "./http";
import type { Ruta } from "./rutas";

/** Siempre explícita: el comando exacto del paso que sigue. */
export const PISTA: Ruta = {
	metodo: "GET",
	ruta: "/pista",
	requiere: 0,
	handler: async (c) => {
		const lectura = c.var.lectura;
		if (lectura.tipo === "falso") return texto(c, H.pistaGafeteFalso);
		if (lectura.tipo === "ninguno") return texto(c, H.pista(2, { o: origen(c), nombre: "TuNombre", token: "" }));
		const e = lectura.estado;
		const siguiente = Math.min(e.nivel + 1, 13);
		const token = siguiente === 9 || siguiente === 10 ? await tokenTi(e.id, c.env.GAFETE_SECRET) : "";
		return texto(c, H.pista(siguiente, { o: origen(c), nombre: e.nombre, token }));
	},
};
```

En `src/index.ts`, importa `PISTA` desde `./pista` y deja `const RUTAS: Ruta[] = [...NIVELES, INCIDENTE, PISTA];`

- [ ] **Step 5: Correr tests y typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
pnpm format
git add src/pista.ts src/index.ts src/historia.es.ts test/pista.spec.ts
git commit -m "feat: /pista with the exact next command

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 13: Colección Postman v2.1 (`/coleccion`)

**Files:**
- Create: `src/coleccion.ts`, `test/coleccion.spec.ts`
- Modify: `src/index.ts` (RUTAS), `src/historia.es.ts`

**Interfaces:**
- Consumes: `NIVELES` con `esqueleto` y `resuelta` (Tareas 4 a 11), `CAFETERA_HEADERS` (Tarea 11), `PeticionResuelta` y `Cuerpo` (Tarea 4).
- Produces: `coleccion(origen: string, spoilers: boolean): Record<string, unknown>`, `COLECCION: Ruta` (GET `/coleccion`, requiere 0;
  `?spoilers=si` devuelve la resuelta).

- [ ] **Step 1: Agregar textos a `src/historia.es.ts`** (encima del marcador)

```ts
	coleccionEsqueleto:
		"Coffee Quest en modo GUI. Una petición por nivel, todas como GET y sin headers ni body: complétalas tú. Las cookies las maneja tu cliente. Si te trabas: GET {{base}}/pista",
	coleccionNivel: "Completa el método, los headers y el body que hagan falta.",
	coleccionResuelta:
		"SPOILERS: el juego entero resuelto. Corre las carpetas en orden: Camino, Final 418, Final 218 y Final 200. El 200 atiende el incidente, así que después de él ya no se puede el 218 con ese gafete. En Postman los scripts guardan solos los fragmentos y el token; en otros clientes quizá tengas que copiarlos a mano.",
	carpetaFinal218: "Necesita el incidente abierto: córrela antes de Final 200.",
	carpetaFinal200: "Atiende el incidente (fragmento 5) y entrega la receta completa en X-Receta.",
```

- [ ] **Step 2: Escribir `test/coleccion.spec.ts` (falla)**

```ts
import { describe, expect, it } from "vitest";
import { BASE, Jugador } from "./ayuda";

const SCHEMA = "https://schema.getpostman.com/json/collection/v2.1.0/collection.json";

async function bajar(ruta: string) {
	const res = await new Jugador().pedir(ruta);
	expect(res.status).toBe(200);
	expect(res.headers.get("content-type")).toBe("application/json; charset=utf-8");
	expect(res.headers.get("content-disposition")).toBe('attachment; filename="coffee-quest.postman_collection.json"');
	return (await res.json()) as {
		info: { name: string; schema: string };
		item: { name: string; item?: unknown[]; request?: { method: string; url: string; header: unknown[]; body?: unknown } }[];
		variable: { key: string; value: string }[];
	};
}

describe("/coleccion", () => {
	it("esqueleto: 12 peticiones GET sin headers ni body", async () => {
		const col = await bajar("/coleccion");
		expect(col.info.schema).toBe(SCHEMA);
		expect(col.item).toHaveLength(12);
		expect(col.item[0]!.name).toBe("1. Planta baja");
		for (const it of col.item) {
			expect(it.request!.method).toBe("GET");
			expect(it.request!.url).toMatch(/^\{\{base\}\}\//);
			expect(it.request!.header).toEqual([]);
			expect(it.request!.body).toBeUndefined();
		}
		expect(col.variable).toContainEqual({ key: "base", value: BASE });
	});

	it("resuelta: cuatro carpetas en orden y el camino completo", async () => {
		const col = await bajar("/coleccion?spoilers=si");
		expect(col.info.name).toContain("resuelta");
		expect(col.item.map((c) => c.name)).toEqual(["Camino (1-11)", "Final 418", "Final 218", "Final 200"]);
		const camino = col.item[0]!.item as { name: string; request: { method: string } }[];
		expect(camino).toHaveLength(11);
		expect(camino[4]!.request.method).toBe("HEAD");
		const final200 = col.item[3]!.item as { request: { url: string; header: { key: string; value: string }[] } }[];
		expect(final200[0]!.request.url).toBe("{{base}}/incidente/ack");
		expect(final200[1]!.request.header).toContainEqual({
			key: "X-Receta",
			value: "{{receta_1}},{{receta_2}},{{receta_3}},{{receta_4}},{{receta_5}}",
		});
		const final218 = col.item[2]!.item as { request: { header: { key: string; value: string }[] } }[];
		expect(final218[0]!.request.header).toContainEqual({ key: "X-Mood", value: "this is fine" });
		const claves = col.variable.map((v) => v.key);
		expect(claves).toEqual(["base", "nombre", "token_ti", "receta_1", "receta_2", "receta_3", "receta_4", "receta_5"]);
	});

	it("resuelta: el piso 3 no sigue el redirect y los cuerpos tienen el formato Postman", async () => {
		const col = await bajar("/coleccion?spoilers=si");
		const camino = col.item[0]!.item as Record<string, unknown>[];
		expect(camino[3]).toMatchObject({ protocolProfileBehavior: { followRedirects: false } });
		expect(camino[6]).toMatchObject({
			request: { body: { mode: "formdata", formdata: [{ key: "formulario", value: "firma: {{nombre}}", type: "text" }] } },
		});
		expect(camino[10]).toMatchObject({
			request: { body: { mode: "urlencoded", urlencoded: [{ key: "pedido", value: "leche=si & azucar=no" }] } },
		});
		expect(camino[3]).toMatchObject({ event: [{ listen: "test", script: { type: "text/javascript" } }] });
	});
});
```

- [ ] **Step 3: Correr y verificar que falla**

Run: `pnpm vitest run test/coleccion.spec.ts`
Expected: FAIL (404 en `/coleccion`).

- [ ] **Step 4: Implementar `src/coleccion.ts`**

```ts
import { H } from "./historia.es";
import { origen } from "./http";
import { NIVELES } from "./niveles";
import { CAFETERA_HEADERS } from "./niveles/12-cafetera";
import type { Cuerpo, PeticionResuelta, Ruta } from "./rutas";

const SCHEMA = "https://schema.getpostman.com/json/collection/v2.1.0/collection.json";

function cuerpoPostman(c: Cuerpo): Record<string, unknown> {
	if (c.modo === "raw") return { mode: "raw", raw: c.raw };
	const campos = Object.entries(c.campos);
	if (c.modo === "urlencoded") return { mode: "urlencoded", urlencoded: campos.map(([key, value]) => ({ key, value })) };
	return { mode: "formdata", formdata: campos.map(([key, value]) => ({ key, value, type: "text" })) };
}

function item(p: PeticionResuelta): Record<string, unknown> {
	const request: Record<string, unknown> = {
		method: p.metodo,
		header: Object.entries(p.headers ?? {}).map(([key, value]) => ({ key, value })),
		url: `{{base}}${p.url}`,
	};
	if (p.cuerpo) request.body = cuerpoPostman(p.cuerpo);
	const it: Record<string, unknown> = { name: p.nombre, request };
	if (p.captura) it.event = [{ listen: "test", script: { type: "text/javascript", exec: p.captura } }];
	if (p.sinRedirect) it.protocolProfileBehavior = { followRedirects: false };
	return it;
}

function brew(nombre: string, extra: Record<string, string> = {}): PeticionResuelta {
	return { nombre, metodo: "POST", url: "/cafetera", headers: { ...CAFETERA_HEADERS, ...extra }, cuerpo: { modo: "raw", raw: "start" } };
}

/** Postman Collection v2.1: la importan Postman, Insomnia, Bruno, Hoppscotch y Thunder Client. */
export function coleccion(base: string, spoilers: boolean): Record<string, unknown> {
	const variable = [
		{ key: "base", value: base },
		{ key: "nombre", value: "Ana" },
		{ key: "token_ti", value: "" },
		...[1, 2, 3, 4, 5].map((n) => ({ key: `receta_${n}`, value: "" })),
	];
	if (!spoilers) {
		return {
			info: { name: "Coffee Quest", description: H.coleccionEsqueleto, schema: SCHEMA },
			item: NIVELES.map((n) => ({
				name: `${n.numero}. ${n.nombre}`,
				request: { method: "GET", header: [], url: `{{base}}${n.esqueleto}`, description: H.coleccionNivel },
			})),
			variable,
		};
	}
	const receta = [1, 2, 3, 4, 5].map((n) => `{{receta_${n}}}`).join(",");
	return {
		info: { name: "Coffee Quest (resuelta)", description: H.coleccionResuelta, schema: SCHEMA },
		item: [
			{ name: "Camino (1-11)", item: NIVELES.filter((n) => n.numero <= 11).flatMap((n) => n.resuelta.map(item)) },
			{ name: "Final 418", item: [item(brew("12. BREW (final 418)"))] },
			{ name: "Final 218", description: H.carpetaFinal218, item: [item(brew("12. BREW (final 218)", { "X-Mood": "this is fine" }))] },
			{
				name: "Final 200",
				description: H.carpetaFinal200,
				item: [
					item({
						nombre: "Incidente: ack",
						metodo: "POST",
						url: "/incidente/ack",
						captura: ['pm.collectionVariables.set("receta_5", pm.response.headers.get("X-Receta-5"));'],
					}),
					item(brew("12. BREW (final 200)", { "X-Receta": receta })),
				],
			},
		],
		variable,
	};
}

export const COLECCION: Ruta = {
	metodo: "GET",
	ruta: "/coleccion",
	requiere: 0,
	handler: (c) =>
		c.newResponse(JSON.stringify(coleccion(origen(c), c.req.query("spoilers") === "si"), null, 2), 200, {
			"Content-Type": "application/json; charset=utf-8",
			"Content-Disposition": 'attachment; filename="coffee-quest.postman_collection.json"',
		}),
};
```

En `src/index.ts`, importa `COLECCION` desde `./coleccion` y deja `const RUTAS: Ruta[] = [...NIVELES, INCIDENTE, PISTA, COLECCION];`

- [ ] **Step 5: Correr tests y typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
pnpm format
git add src/coleccion.ts src/index.ts src/historia.es.ts test/coleccion.spec.ts
git commit -m "feat: Postman v2.1 collection, skeleton and solved

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 14: Portada pixel art para navegador

**Files:**
- Create: `src/web/escena.ts`, `src/web/portada.ts`, `test/portada.spec.ts`
- Modify: `src/niveles/01-entrada.ts` (content negotiation), `src/historia.es.ts` (textos de la portada)

**Interfaces:**
- Produces: `PALETA: Record<string, string>` (16 colores), `ESCENA: readonly string[]` (36 filas de 64), `escenaSvg(alt: string): string`,
  `portada(origen: string): string`. `GET /` con `Accept` que incluye `text/html` devuelve la portada; si no, el nivel 1 en texto.
  Ambas respuestas llevan `Vary: Accept`.

- [ ] **Step 1: Agregar textos a `src/historia.es.ts`** (encima del marcador)

```ts
	portada: {
		titulo: "Coffee Quest",
		descripcion: "Un juego que se juega con curl: consigue un café antes de la daily.",
		gancho: "Este juego no se juega aquí. Se juega en tu terminal.",
		intro:
			"Son las 8:59, tu daily es a las 9:15 y la cafetera del piso 3 está rota. Consigue un café usando solo curl: headers, cookies, redirects, JSON, auth... y un protocolo para cafeteras que existe de verdad.",
		nota: "¿PowerShell? Usa curl.exe.",
		copiar: "Copiar",
		copiado: "Copiado",
		copiarFallo: "Selecciona y copia",
		trofeos: [
			["418", "Final normal"],
			["200", "Final verdadero"],
			["???", "Secreto"],
		] as [string, string][],
		/** Alterna texto y código: los índices impares van dentro de <code>. */
		negociacion: ["Tu navegador pidió", "Accept: text/html", "y recibió esta página. curl pide", "*/*", "y recibe el juego. Eso es content negotiation."],
		coleccion: "¿Prefieres Postman, Bruno o Insomnia?",
		coleccionLink: "Descarga la colección",
		alt: "Oficina a las 8:59: un empleado con ojeras y una taza vacía, una cafetera rota echando humo con un post-it pegado y, al fondo, una puerta entreabierta con un brillo naranja.",
	},
```

- [ ] **Step 2: Escribir `test/portada.spec.ts` (falla)**

```ts
import { describe, expect, it } from "vitest";
import { ESCENA, PALETA, escenaSvg } from "../src/web/escena";
import { portada } from "../src/web/portada";
import { BASE, Jugador } from "./ayuda";

describe("escena pixel art", () => {
	it("64×36, 16 colores, solo caracteres de la paleta", () => {
		expect(Object.keys(PALETA)).toHaveLength(16);
		expect(ESCENA).toHaveLength(36);
		for (const fila of ESCENA) {
			expect(fila).toHaveLength(64);
			// `c in PALETA` y no toHaveProperty: toHaveProperty(".") interpreta el punto como ruta anidada.
			for (const c of fila) expect(c in PALETA, `carácter ${JSON.stringify(c)}`).toBe(true);
		}
	});

	it("SVG nítido, accesible y con capas animadas", () => {
		const svg = escenaSvg("descripción <de> prueba");
		expect(svg).toContain('viewBox="0 0 64 36"');
		expect(svg).toContain('shape-rendering="crispEdges"');
		expect(svg).toContain('role="img"');
		expect(svg).toContain("<title id=\"escena-titulo\">descripción &lt;de&gt; prueba</title>");
		expect(svg).toContain('class="brillo"');
		expect(svg).toContain('class="humo"');
	});
});

describe("portada", () => {
	it("navegador (Accept: text/html) → HTML con el comando y los trofeos", async () => {
		const res = await new Jugador().pedir("/", { headers: { Accept: "text/html,application/xhtml+xml,*/*;q=0.8" } });
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toMatch(/^text\/html/);
		expect(res.headers.get("vary")).toBe("Accept");
		const html = await res.text();
		expect(html).toMatch(/^<!doctype html>/);
		expect(html).toContain(`<code id="cmd">curl ${BASE}</code>`);
		expect(html).toContain("curl.exe");
		for (const t of ["418", "200", "???"]) expect(html).toContain(`<b>${t}</b>`);
		expect(html).toContain('href="/coleccion"');
		expect(html).toContain("<code>Accept: text/html</code>");
		expect(html).toContain("<svg");
	});

	it("curl (Accept: */*) → nivel 1 en texto", async () => {
		const res = await new Jugador().pedir("/", { headers: { Accept: "*/*" } });
		expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
		expect(await res.text()).toContain("Planta baja");
	});

	it("escapa el origen", () => {
		const html = portada('https://x.test"><script>alert(1)</script>');
		expect(html).not.toContain("<script>alert(1)");
		expect(html).toContain("&quot;&gt;&lt;script&gt;");
	});
});
```

- [ ] **Step 3: Correr y verificar que falla**

Run: `pnpm vitest run test/portada.spec.ts`
Expected: FAIL, no se puede resolver `../src/web/escena`.

- [ ] **Step 4: Implementar `src/web/escena.ts`**

```ts
/**
 * Escena de la portada como matriz de píxeles: un carácter por píxel, colores en PALETA.
 * Para reemplazarla por un dibujo de Aseprite: exportar PNG (64×36, esta paleta), servirlo con Static Assets
 * y cambiar el <svg> de la portada por un <img> con el mismo texto alternativo.
 */
export const PALETA: Record<string, string> = {
	".": "#3b4a6b", // pared
	",": "#2f3b57", // zócalo
	_: "#5a4636", // piso
	k: "#1a1423", // contorno
	w: "#e9edf5", // blanco
	b: "#f4a261", // cielo al amanecer
	y: "#ffd166", // sol
	g: "#8d99ae", // mostrador / humo
	m: "#5c677d", // metal
	r: "#e63946", // rojo
	p: "#fff176", // post-it
	s: "#f1c27d", // piel
	h: "#3d2b1f", // pelo
	c: "#457b9d", // camisa
	o: "#ff7b00", // brillo de la puerta (capa animada)
	e: "#7b5ea7", // ojeras
};

export const ESCENA: readonly string[] = [
	"................................................................",
	"................................................................",
	"..kkkkkkkkkkkkkkkkk....kkkkkkk..................................",
	"..kbbbbbbbwbbbbbbbk....kwwwwwk..................................",
	"..kyyyyyyywyyyyyyyk....kwwkwwk..................................",
	"..kyyyyyyywyyyyyyyk....kwkkwwk..................................",
	"..kbbbbbbbwbbbbbbbk....kwwwwwk..................................",
	"..kwwwwwwwwwwwwwwwk....kwwwwwk..................................",
	"..kbbbbbbbwbyyyybbk....kkkkkkk....kkkkkkkkkkk.....kkkkkkkkkk....",
	"..kbbbbbbbwbyyyybbk...............koookmmmmmk.....kmmmmmmmmk....",
	"..kbbbbbbbwbbbbbbbk...............koookmmmmmk.....kmkkkkkkmk....",
	"..kkkkkkkkkkkkkkkkk...............koookmmmmmk.....kmkrkkgkmk....",
	"..wwwwwwwwwwwwwwwww...............koookmmmmmk.....kmkkkkkkpppp..",
	".......khhhhhhhhhhk...............koookmmmmmk.....kmmmmmmmpkkp..",
	".......khhhhhhhhhhk...............koookmmmmmk.....kmmkkkkmpppp..",
	".......khhhhhhhhhhk...............koookmmmmmk.....kmmmwwmmpppp..",
	"......khsssssssssshk..............koookmmmmmk.....kmmmwwmmmk....",
	"......khsssssssssshk..............koookmmmymk.....kmmmwwmmmk....",
	"......khsskksskksshk..............koookmmmmmk.kkkkkkkkkkkkkkkkkk",
	".......ksseesseessk...............koookmmmmmk.wwwwwwwwwwwwwwwwww",
	".......kssssssssssk...............koookmmmmmk.gggggggggggggggggg",
	".......kssskkkksssk...............koookmmmmmk.gggggggggggggggggg",
	"......kksssssssssskk..............koookmmmmmk.gggggggggggggggggg",
	"....kkccccccwwcccccckk............koookmmmmmk.gggggggggggggggggg",
	",,,kccccccccrrcccccccck,,,,,,,,,,,koookmmmmmk,gggggggggggggggggg",
	",,,kccccccccrrcccccccck,,,,,,,,,,,koookmmmmmk,mmmmmmmmmmmmmmmmmm",
	"___kccccccccrrcccccccck_________________________________________",
	"___kccccccccrrcccccccck_________________________________________",
	"___kccccccccrrcccccccck_________________________________________",
	"___kcccccccccccccccccckkk_______________________________________",
	"kkkkccccccccccccccccccwwwwkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk",
	"k__kccccccccccccccccsswwww______k_______k_______k_______k_______",
	"k__kccccccccccccccccsswww_______k_______k_______k_______k_______",
	"k__ksscccccccccccccckk__k_______k_______k_______k_______k_______",
	"k__ksscccccccccccccck___k_______k_______k_______k_______k_______",
	"k___kkcccccccccccccck___k_______k_______k_______k_______k_______",
];

/** Humo que sale de la cafetera rota (capa animada, sobre la pared). */
const HUMO: readonly [number, number][] = [
	[53, 7], [54, 6], [55, 6], [55, 5], [56, 4], [57, 4], [54, 3], [55, 2],
];

const esc = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** Un <rect> por tramo horizontal del mismo color, agrupados por color. */
export function escenaSvg(alt: string): string {
	const capas = new Map<string, string[]>();
	ESCENA.forEach((fila, y) => {
		for (let x = 0; x < fila.length; ) {
			const color = fila[x]!;
			let fin = x + 1;
			while (fila[fin] === color) fin++;
			const rects = capas.get(color) ?? [];
			rects.push(`<rect x="${x}" y="${y}" width="${fin - x}" height="1"/>`);
			capas.set(color, rects);
			x = fin;
		}
	});
	const grupos = [...capas].map(([color, rects]) => `<g fill="${PALETA[color]}"${color === "o" ? ' class="brillo"' : ""}>${rects.join("")}</g>`);
	const humo = HUMO.map(([x, y]) => `<rect x="${x}" y="${y}" width="1" height="1"/>`).join("");
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 36" shape-rendering="crispEdges" role="img" aria-labelledby="escena-titulo"><title id="escena-titulo">${esc(alt)}</title>${grupos.join("")}<g class="humo" fill="${PALETA.g}">${humo}</g></svg>`;
}
```

- [ ] **Step 5: Implementar `src/web/portada.ts`**

```ts
import { H } from "../historia.es";
import { escenaSvg } from "./escena";

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ESCAPES[ch]!);
/** Para meter strings en el <script> sin cerrar la etiqueta. */
const js = (s: string) => JSON.stringify(s).replaceAll("<", "\\u003c");

const CSS = `
:root{--fondo:#f4efe6;--texto:#1a1423;--suave:#5c677d;--marco:#1a1423;--acento:#c25700;--boton:#ff7b00;--codigo:#2f3b57;--codigo-texto:#ffd166;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--fondo:#14111c;--texto:#e9edf5;--suave:#a3adbf;--marco:#e9edf5;--acento:#ff9a3d;--codigo:#0b0910;color-scheme:dark}}
:root[data-theme="dark"]{--fondo:#14111c;--texto:#e9edf5;--suave:#a3adbf;--marco:#e9edf5;--acento:#ff9a3d;--codigo:#0b0910;color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--fondo);color:var(--texto);font:16px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace}
main{max-width:46rem;margin:0 auto;padding:24px 16px 48px}
.escena{margin:0;border:4px solid var(--marco);box-shadow:6px 6px 0 var(--boton);background:#3b4a6b}
.escena svg{display:block;width:100%;height:auto}
h1{font-size:clamp(2rem,8vw,3.25rem);line-height:1.1;letter-spacing:.04em;text-transform:uppercase;margin:32px 0 6px}
.gancho{font-size:1.15rem;font-weight:700;color:var(--acento);margin:0 0 16px}
.comando{display:flex;gap:8px;margin:24px 0 6px}
.comando code{flex:1;min-width:0;overflow-x:auto;white-space:nowrap;background:var(--codigo);color:var(--codigo-texto);padding:12px 14px;border:3px solid var(--marco)}
button{font:inherit;font-weight:700;padding:0 16px;border:3px solid var(--marco);background:var(--boton);color:#1a1423;cursor:pointer;box-shadow:3px 3px 0 var(--marco)}
button:active{transform:translate(3px,3px);box-shadow:none}
button:focus-visible,a:focus-visible{outline:3px solid var(--acento);outline-offset:3px}
.nota,.chico{color:var(--suave);font-size:.9rem;margin:0}
p code{background:var(--codigo);color:var(--codigo-texto);padding:1px 5px}
.trofeos{list-style:none;padding:0;display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:32px 0}
.trofeos li{border:3px dashed var(--suave);padding:14px 6px;text-align:center;color:var(--suave);font-size:.85rem}
.trofeos b{display:block;font-size:1.6rem;color:var(--texto);opacity:.5}
.chico{margin-top:24px}
a{color:var(--acento)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.brillo{animation:brillo 1.6s steps(2) infinite}
.humo{animation:humo 2.4s steps(4) infinite}
@keyframes brillo{50%{opacity:.6}}
@keyframes humo{0%{opacity:0;transform:translateY(1px)}40%{opacity:.9}100%{opacity:0;transform:translateY(-2px)}}
@media (prefers-reduced-motion:reduce){.brillo,.humo{animation:none}}
`;

export function portada(origen: string): string {
	const P = H.portada;
	const comando = `curl ${esc(origen)}`;
	const negociacion = P.negociacion.map((parte, i) => (i % 2 ? `<code>${esc(parte)}</code>` : esc(parte))).join(" ");
	const trofeos = P.trofeos.map(([codigo, nombre]) => `<li><b>${esc(codigo)}</b>${esc(nombre)}</li>`).join("");
	return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(P.titulo)}</title>
<meta name="description" content="${esc(P.descripcion)}">
<style>${CSS}</style>
</head>
<body>
<main>
<figure class="escena">${escenaSvg(P.alt)}</figure>
<h1>${esc(P.titulo)}</h1>
<p class="gancho">${esc(P.gancho)}</p>
<p>${esc(P.intro)}</p>
<div class="comando"><code id="cmd">${comando}</code><button type="button" id="copiar">${esc(P.copiar)}</button></div>
<p class="nota">${esc(P.nota)}</p>
<span class="sr" role="status" id="aviso"></span>
<ul class="trofeos" aria-label="Finales">${trofeos}</ul>
<p>${negociacion}</p>
<p class="chico">${esc(P.coleccion)} <a href="/coleccion">${esc(P.coleccionLink)}</a>.</p>
</main>
<script>
const b = document.getElementById("copiar"), aviso = document.getElementById("aviso");
b.addEventListener("click", async () => {
	let txt = ${js(P.copiado)};
	try { await navigator.clipboard.writeText(document.getElementById("cmd").textContent); } catch { txt = ${js(P.copiarFallo)}; }
	b.textContent = txt; aviso.textContent = txt;
	setTimeout(() => { b.textContent = ${js(P.copiar)}; }, 1600);
});
</script>
</body>
</html>
`;
}
```

- [ ] **Step 6: Content negotiation en `src/niveles/01-entrada.ts`**

Agrega el import `import { portada } from "../web/portada";` y reemplaza el `handler`:

```ts
	// Navegadores piden text/html y reciben la portada; curl pide */* y recibe el juego.
	handler: (c) =>
		(c.req.header("Accept") ?? "").includes("text/html")
			? c.html(portada(origen(c)), 200, { Vary: "Accept" })
			: texto(c, H.nivel1(origen(c)), 200, { Vary: "Accept" }),
```

- [ ] **Step 7: Correr tests y typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 8: Revisión visual**

```bash
pnpm dev
```

(en segundo plano). Con la skill `playwright-cli`, abre `http://localhost:8787` en 1280×800 y en 390×844, en modo claro y oscuro, y
saca capturas. Comprueba:
- La escena se ve nítida, sin bordes borrosos.
- No hay scroll horizontal a 390 px (el comando hace scroll solo dentro de su caja).
- Los tres trofeos entran en una fila.
- El botón "Copiar" cambia a "Copiado".
- Con `prefers-reduced-motion: reduce` no hay animación.

Detén `pnpm dev` al terminar.

- [ ] **Step 9: Commit**

```bash
pnpm format
git add src/web src/niveles/01-entrada.ts src/historia.es.ts test/portada.spec.ts
git commit -m "feat: pixel-art landing page via content negotiation

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 15: `scripts/partida.sh`, README y verificación local

**Files:**
- Create: `scripts/partida.sh`
- Modify: `README.md` (reemplazo completo)

**Interfaces:**
- Consumes: todas las rutas del juego.
- Produces: `scripts/partida.sh [URL]`, que juega los tres finales con curl real. Termina con código 0 si todo pasa y con 1 en el primer fallo.

- [ ] **Step 1: Crear `scripts/partida.sh`**

```bash
#!/usr/bin/env bash
# Juega los tres finales de Coffee Quest con curl real, como lo haría un jugador.
# Uso: scripts/partida.sh [URL]   (por defecto http://localhost:8787)
set -euo pipefail

BASE="${1:-http://localhost:8787}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
JAR="$TMP/cookies.txt"

# esperar <código> <descripción> <args de curl...>: corta el script si el código no coincide.
esperar() {
	local esperado="$1" desc="$2"
	shift 2
	local codigo
	codigo="$(curl -sS -b "$JAR" -c "$JAR" -o "$TMP/cuerpo" -D "$TMP/headers" -w '%{http_code}' "$@")"
	if [[ "$codigo" != "$esperado" ]]; then
		echo "FALLO  $desc: esperaba $esperado, llegó $codigo"
		cat "$TMP/cuerpo"
		exit 1
	fi
	echo "ok $codigo  $desc"
}

header() { grep -i "^$1:" "$TMP/headers" | head -n 1 | cut -d' ' -f2- | tr -d '\r'; }

camino() {
	rm -f "$JAR"
	esperar 200 "1 planta baja" "$BASE/"
	esperar 200 "2 recepción" "$BASE/recepcion?nombre=Prueba&piso=3"
	esperar 200 "3 ascensor" "$BASE/ascensor"
	esperar 301 "4 piso 3" "$BASE/piso/3"
	R1="$(header X-Receta-1)"
	esperar 200 "5 cocina (HEAD)" -I "$BASE/piso/3/cocina"
	esperar 200 "6 solicitud" -H "Content-Type: application/json" -d '{"motivo": "prueba", "urgencia": 10}' "$BASE/rrhh/solicitud"
	printf 'firma: Prueba\n' >"$TMP/formulario.txt"
	esperar 200 "7 formulario" -F "formulario=@$TMP/formulario.txt" "$BASE/rrhh/formulario"
	R2="$(header X-Receta-2)"
	esperar 200 "8 TI" -u becario:cafeina123 "$BASE/ti/maquina"
	TOKEN="$(grep -o 'ti_[A-Za-z0-9_-]*' "$TMP/cuerpo" | head -n 1)"
	esperar 200 "9 config" -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"modo": "barista"}' "$BASE/ti/maquina/config"
	esperar 200 "10 bloqueo" -X DELETE -H "Authorization: Bearer $TOKEN" "$BASE/ti/maquina/bloqueo"
	R3="$(header X-Receta-3)"
	esperar 200 "11 pedido" --data-urlencode "pedido=leche=si & azucar=no" "$BASE/cafetera/pedido"
	R4="$(header X-Receta-4)"
}

BREW=(-H "X-HTTP-Method-Override: BREW" -H "Content-Type: message/coffeepot" -H "Accept-Additions: leche" -d start)

echo "== Final 418"
camino
esperar 418 "12 BREW" "${BREW[@]}" "$BASE/cafetera"

echo "== Final 218"
camino
esperar 218 "12 BREW + X-Mood" "${BREW[@]}" -H "X-Mood: this is fine" "$BASE/cafetera"
curl -sS --http1.1 -b "$JAR" -o /dev/null -D "$TMP/h11" "${BREW[@]}" -H "X-Mood: this is fine" "$BASE/cafetera"
echo "   línea de estado en HTTP/1.1: $(head -n 1 "$TMP/h11" | tr -d '\r')"

echo "== Final 200"
camino
esperar 200 "incidente ack" -X POST "$BASE/incidente/ack"
R5="$(header X-Receta-5)"
esperar 200 "12 BREW + X-Receta" "${BREW[@]}" -H "X-Receta: $R1,$R2,$R3,$R4,$R5" "$BASE/cafetera"

echo "== Extras"
echo "   -X BREW directo: $(curl -sS -o /dev/null -w '%{http_code}' -b "$JAR" -X BREW "$BASE/cafetera" || echo "sin respuesta") (en el edge se espera 501)"
esperar 200 "portada HTML" -H "Accept: text/html" "$BASE/"
grep -q "<svg" "$TMP/cuerpo" || { echo "FALLO  la portada no trae la escena"; exit 1; }
esperar 200 "colección resuelta" "$BASE/coleccion?spoilers=si"
echo "Listo: los tres finales funcionan contra $BASE"
```

```bash
chmod +x scripts/partida.sh
git add scripts/partida.sh
git update-index --chmod=+x scripts/partida.sh
```

- [ ] **Step 2: Correr contra `wrangler dev`**

```bash
pnpm dev
```

(en segundo plano; espera a `Ready on http://localhost:8787`). Luego:

```bash
bash scripts/partida.sh http://localhost:8787
```

Expected: líneas `ok ...` para los tres finales, la línea de estado HTTP/1.1 y `Listo: los tres finales funcionan`. El código de
`-X BREW` en local queda solo como dato: puede ser 501 o el 405 de la cafetera. El que importa es el del edge, en la Tarea 16.
Detén `pnpm dev` al terminar.

- [ ] **Step 3: Reemplazar `README.md`**

````markdown
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
````

- [ ] **Step 4: Verificación completa**

Run: `pnpm check`
Expected: lint, format, typecheck y test en verde.

- [ ] **Step 5: Commit**

```bash
git add README.md scripts/partida.sh
git commit -m "docs: README and end-to-end curl playthrough script

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 16: Deploy y verificaciones en el edge real

**Files:**
- Modify: `wrangler.jsonc` (custom domain, solo en el Step 6)
- Modify: `docs/superpowers/specs/2026-10-06-coffee-quest-design.md` (resultados de §9)

**Interfaces:**
- Consumes: el Worker completo y `scripts/partida.sh`.
- Produces: un deploy público en `workers.dev` y luego en `cafe.maurrod.dev`, con los resultados de §9 registrados en la spec.

> Esta tarea publica cosas en internet: **cada step marcado con ⚠ requiere confirmación explícita del usuario** antes de ejecutarlo.

- [ ] **Step 1: Cuenta**

Run: `npx wrangler whoami`
Expected: la cuenta de Cloudflare correcta. Si no hay sesión, pide al usuario que ejecute `! npx wrangler login`.

- [ ] **Step 2: ⚠ Primer deploy a workers.dev**

Run: `pnpm deploy`
Expected: la URL `https://coffee-quest.<subdominio>.workers.dev`. Si wrangler se niega a desplegar porque falta el secreto
requerido, haz primero el Step 3 y vuelve a intentar.

- [ ] **Step 3: ⚠ Secreto de producción** (generado sin mostrarlo)

```bash
node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64url'))" | npx wrangler secret put GAFETE_SECRET
```

Expected: `Success! Uploaded secret GAFETE_SECRET`.

- [ ] **Step 4: Jugar contra el edge**

Run: `bash scripts/partida.sh https://coffee-quest.<subdominio>.workers.dev`
Expected: los tres finales `ok`. Anota la línea de estado HTTP/1.1 del 218 y el código de `-X BREW` (se espera 501).

Además, en PowerShell (`curl.exe`), verifica a mano el nivel 2 con comillas y el nivel 11:

```powershell
curl.exe "https://coffee-quest.<subdominio>.workers.dev/recepcion?nombre=Prueba&piso=3"
curl.exe -b cookies.txt -c cookies.txt --data-urlencode "pedido=leche=si & azucar=no" https://coffee-quest.<subdominio>.workers.dev/cafetera/pedido
```

El segundo devuelve 409 si no jugaste hasta el nivel 10. Lo que se verifica es que las comillas lleguen bien, no el nivel.
Abre la URL en el navegador y confirma que se ve la portada.

- [ ] **Step 5: Registrar resultados en la spec**

Agrega al final de la §9 de `docs/superpowers/specs/2026-10-06-coffee-quest-design.md`:

```markdown
### Resultados (YYYY-MM-DD, workers.dev)

- `-X BREW`: <código observado>
- Línea de estado del 218 con `--http1.1`: `<línea observada>`
- `X-HTTP-Method-Override`, `Accept-Additions` y `X-Mood` llegan al Worker: <sí/no> (los tres finales pasaron)
- Cookies `Secure` con `-L -b -c` a través del 301: <sí/no>
- `curl.exe` en PowerShell, niveles 2 y 11: <sí/no y observaciones>
```

Completa cada `<...>` con lo observado en el Step 4. Si la línea de estado no muestra "This is fine", no es un bug: el cuerpo
del 218 lo dice igual (spec §9).

```bash
git add docs/superpowers/specs/2026-10-06-coffee-quest-design.md
git commit -m "docs: record edge verification results

Co-Authored-By: Claude <noreply@anthropic.com>"
```

- [ ] **Step 6: ⚠ Custom domain `cafe.maurrod.dev`**

`maurrod.dev` es una zona en vivo. Antes de tocarla:
1. Confirma con el usuario que no existe un registro DNS `cafe.maurrod.dev`. Wrangler falla si existe, y no hay que borrarlo sin preguntar.
2. Con su visto bueno, agrega a `wrangler.jsonc`, debajo de `"compatibility_flags"`:

```jsonc
	"routes": [{ "pattern": "cafe.maurrod.dev", "custom_domain": true }],
```

```bash
pnpm deploy
bash scripts/partida.sh https://cafe.maurrod.dev
```

Expected: los tres finales `ok` contra `https://cafe.maurrod.dev`.

```bash
git add wrangler.jsonc
git commit -m "feat: serve on cafe.maurrod.dev

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-Review

- **Cobertura de la spec:**
  - §1 → Tareas 4 a 14.
  - §2 (niveles, 409, revisitar, `/pista`, `X-Perro`) → Tareas 4 a 12.
  - §3 → Tareas 3 y 11.
  - §4 → Tarea 2.
  - §5 (Hono, errores 400/401/403/404/405/409/413/415/429/500, rate limit, logs, config) → Tareas 1, 2, 4 y 7 a 11.
  - §6 → Tarea 13.
  - §6b → Tarea 14.
  - §7 → todos los tests y la Tarea 15.
  - §8 y §9 → Tarea 16.
- **Desvíos decididos:** los dos de Global Constraints (formulario como texto y orden de carpetas de la colección), más `==>` en vez de `▶`.
- **Review Focus:** cada punto tiene su test.
  1. UTF-16LE → Tarea 8.
  2. `-d` sin codificar → Tarea 10.
  3. Recepción repetida → Tarea 5.
  4. `Set-Cookie` en el 301 → Tarea 6.
  5. Content-Type con parámetros → Tareas 7 y 11.

