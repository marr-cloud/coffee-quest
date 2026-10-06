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
		["9", "El piso 9 no existe o no tiene café"],
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
