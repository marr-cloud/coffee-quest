import { describe, expect, it } from "vitest";
import { Jugador, PASOS, jugarHasta } from "./ayuda";

/** Juega del 1 al n, pero con un nombre propio en recepción. */
async function jugarComo(nombre: string, n: number): Promise<Jugador> {
	const j = new Jugador();
	await j.pedir("/");
	const r = await j.pedir(`/recepcion?nombre=${encodeURIComponent(nombre)}&piso=3`);
	if (r.status !== 200) throw new Error(`recepción: ${r.status}`);
	for (let i = 3; i <= n; i++) await PASOS[i]!(j);
	return j;
}

describe("nombres dentro de comandos que el jugador copia", () => {
	const raro = 'Ana "Anita" $(rm) `x` \\ ! “y”';

	it("el saludo usa el nombre real, el comando una versión que la shell no interpreta", async () => {
		const j = new Jugador();
		const res = await j.pedir(`/recepcion?nombre=${encodeURIComponent(raro)}&piso=3`);
		const cuerpo = await res.text();
		expect(cuerpo).toContain(`Bienvenido, ${raro}.`);
		const comando = cuerpo.split("\n").find((l) => l.includes("curl -c cookies.txt"))!;
		expect(comando).not.toMatch(/[`$!“”\\]|%22|%5C/);
	});

	it("/pista: el echo de la firma queda bien entre comillas", async () => {
		const j = await jugarComo(raro, 6);
		const linea = (await (await j.pedir("/pista")).text()).split("\n").find((l) => l.includes("echo "))!;
		expect(linea.trim()).toBe('echo "firma: Ana Anita (rm) x y" > formulario.txt');
	});

	it("nivel 6: el echo de la firma también", async () => {
		const j = await jugarComo(raro, 5);
		const res = await PASOS[6]!(j);
		const linea = (await res.text()).split("\n").find((l) => l.includes("echo "))!;
		expect(linea.trim()).toBe('echo "firma: Ana Anita (rm) x y" > formulario.txt');
	});

	it("un nombre sin nada aprovechable usa TuNombre en los comandos", async () => {
		const j = await jugarComo('"$!"', 6);
		expect(await (await j.pedir("/pista")).text()).toContain('echo "firma: TuNombre" > formulario.txt');
	});
});

describe("caracteres de control", () => {
	it("acepta emojis compuestos con ZWJ", async () => {
		const j = new Jugador();
		const res = await j.pedir(`/recepcion?nombre=${encodeURIComponent("Ana 👩\u200D💻")}&piso=3`);
		expect(res.status).toBe(200);
		expect(j.estado.nombre).toBe("Ana 👩\u200D💻");
	});

	it.each([
		["override bidi", "Ana\u202Eosoh"],
		["escape ANSI", "Ana\u001b[2J"],
	])("rechaza %s en el nombre", async (_, nombre) => {
		const res = await new Jugador().pedir(`/recepcion?nombre=${encodeURIComponent(nombre)}&piso=3`);
		expect(res.status).toBe(400);
	});

	it("no repite caracteres de control que mandó el jugador", async () => {
		const piso = await new Jugador().pedir("/recepcion?nombre=Ana&piso=%1B%5B2J");
		expect(piso.status).toBe(400);
		expect(await piso.text()).not.toContain("\u001b");
		const j = new Jugador();
		await jugarHasta(j, 3);
		const otro = await j.pedir("/piso/%1B%5B2J");
		expect(otro.status).toBe(404);
		expect(await otro.text()).not.toContain("\u001b");
	});
});
