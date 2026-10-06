import { describe, expect, it } from "vitest";
import app from "../src/index";
import { BASE, Jugador, entorno } from "./ayuda";

describe("límites de la API pública", () => {
	it("cuerpo de más de 16 KB → 413 antes de parsear, incluso sin gafete", async () => {
		const res = await new Jugador().pedir("/rrhh/solicitud", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: "x".repeat(20 * 1024),
		});
		expect(res.status).toBe(413);
		expect(await res.text()).toContain("16 KB");
	});

	it("cuerpo en stream sin Content-Length también se corta", async () => {
		const trozo = new TextEncoder().encode("x".repeat(1024));
		let enviados = 0;
		const body = new ReadableStream<Uint8Array>({
			pull(ctrl) {
				if (enviados++ < 40) ctrl.enqueue(trozo);
				else ctrl.close();
			},
		});
		const res = await app.request(`${BASE}/rrhh/solicitud`, { method: "POST", body, duplex: "half" } as RequestInit, entorno());
		expect(res.status).toBe(413);
	});

	it.each([
		["ausente", ""],
		["demasiado corto", "corto"],
	])("GAFETE_SECRET %s → 500, sin firmar con una clave débil", async (_, secreto) => {
		const res = await app.request(`${BASE}/recepcion?nombre=Ana&piso=3`, {}, { ...entorno(), GAFETE_SECRET: secreto });
		expect(res.status).toBe(500);
		expect(res.headers.getSetCookie()).toEqual([]);
	});
});
