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
