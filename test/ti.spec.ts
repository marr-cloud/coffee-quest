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
