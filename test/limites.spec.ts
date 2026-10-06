import { describe, expect, it } from "vitest";
import app from "../src/index";
import { BASE, Jugador, entorno, jugarHasta } from "./ayuda";

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

	it("con gafete válido, el límite por IP también aplica (juntar gafetes no lo esquiva)", async () => {
		const j = new Jugador();
		await jugarHasta(j, 2);
		const res = await app.request(`${BASE}/ascensor`, { headers: { Cookie: `gafete=${j.gafete}` } }, entorno(true, false));
		expect(res.status).toBe(429);
	});

	it("claves: gafete en RATE_LIMITER, IP siempre en RATE_LIMITER_IP", async () => {
		const j = new Jugador();
		await jugarHasta(j, 2);
		const claves: Record<string, string[]> = { gafete: [], ip: [] };
		const espia = (donde: string[]): RateLimit => ({ limit: async ({ key }) => (donde.push(key), { success: true }) });
		const e = { ...entorno(), RATE_LIMITER: espia(claves.gafete!), RATE_LIMITER_IP: espia(claves.ip!) };
		await app.request(`${BASE}/ascensor`, { headers: { Cookie: `gafete=${j.gafete}`, "CF-Connecting-IP": "203.0.113.7" } }, e);
		await app.request(`${BASE}/`, { headers: { "CF-Connecting-IP": "203.0.113.7" } }, e);
		expect(claves.gafete).toEqual([`g:${j.estado.id}`, "ip:203.0.113.7"]);
		expect(claves.ip).toEqual(["ip:203.0.113.7", "ip:203.0.113.7"]);
	});
});
