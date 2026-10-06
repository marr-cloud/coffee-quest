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
