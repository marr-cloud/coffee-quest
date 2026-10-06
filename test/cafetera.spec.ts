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

	it("reusar el gafete de antes del ack no da el 200", async () => {
		const j = new Jugador();
		await jugarHasta(j, 11);
		const previo = j.gafete;
		await j.pedir("/incidente/ack", { method: "POST" });
		j.gafete = previo;
		const receta = [1, 2, 3, 4, 5].map((n) => j.receta[n]).join(",");
		expect((await brew(j, { "X-Receta": receta })).status).toBe(418);
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
