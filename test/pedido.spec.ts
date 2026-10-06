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
