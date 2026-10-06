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
