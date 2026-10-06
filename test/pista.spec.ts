import { describe, expect, it } from "vitest";
import { BASE, Jugador, brew, jugarHasta } from "./ayuda";

describe("/pista", () => {
	it("sin gafete explica cómo empezar", async () => {
		const res = await new Jugador().pedir("/pista");
		expect(res.status).toBe(200);
		expect(await res.text()).toContain(`curl -c cookies.txt "${BASE}/recepcion?nombre=TuNombre&piso=3"`);
	});

	it("con gafete falso dice que se borre", async () => {
		const j = new Jugador();
		j.gafete = "a.b";
		expect(await (await j.pedir("/pista")).text()).toContain("Borra cookies.txt");
	});

	it.each([
		[2, "/ascensor"],
		[3, "-L"],
		[4, "-I"],
		[5, "/rrhh/solicitud"],
		[6, '-F "formulario=@formulario.txt"'],
		[7, "-u becario:cafeina123"],
		[8, "/ti/maquina/config"],
		[9, "-X DELETE"],
		[10, "--data-urlencode"],
		[11, "X-HTTP-Method-Override: BREW"],
	])("después del nivel %i sugiere %s", async (nivel, esperado) => {
		const j = new Jugador();
		await jugarHasta(j, nivel);
		expect(await (await j.pedir("/pista")).text()).toContain(esperado);
	});

	it("en los niveles 9 y 10 incluye el token de TI del jugador", async () => {
		const j = new Jugador();
		await jugarHasta(j, 8);
		expect(await (await j.pedir("/pista")).text()).toContain(`Bearer ${j.tokenTi}`);
	});

	it("después de un final habla de los tres finales", async () => {
		const j = new Jugador();
		await jugarHasta(j, 11);
		await brew(j);
		expect(await (await j.pedir("/pista")).text()).toContain("tres finales");
	});
});
