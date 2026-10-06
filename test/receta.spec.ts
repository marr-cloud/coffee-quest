import { describe, expect, it } from "vitest";
import { PALABRAS, fragmento, recetaCompleta, recetaCorrecta } from "../src/receta";

const S = "secreto-de-prueba";

describe("receta", () => {
	it("32 palabras ASCII únicas en minúsculas", () => {
		expect(PALABRAS).toHaveLength(32);
		expect(new Set(PALABRAS).size).toBe(32);
		for (const p of PALABRAS) expect(p).toMatch(/^[a-z0-9-]+$/);
	});

	it("fragmento es determinista y sale de la lista", async () => {
		const f = await fragmento(S, "jugador-a", 1);
		expect(PALABRAS).toContain(f);
		expect(await fragmento(S, "jugador-a", 1)).toBe(f);
	});

	it("cada jugador tiene su propia receta", async () => {
		const a = await recetaCompleta(S, "jugador-a");
		expect(a).toHaveLength(5);
		expect(await recetaCompleta(S, "jugador-b")).not.toEqual(a);
		expect(await recetaCompleta("otro-secreto", "jugador-a")).not.toEqual(a);
	});

	it("recetaCorrecta tolera espacios y mayúsculas, exige orden y las 5 partes", async () => {
		const r = await recetaCompleta(S, "jugador-a");
		expect(await recetaCorrecta(S, "jugador-a", r.join(","))).toBe(true);
		expect(await recetaCorrecta(S, "jugador-a", ` ${r.map((p) => p.toUpperCase()).join(" , ")} `)).toBe(true);
		expect(await recetaCorrecta(S, "jugador-a", r.slice(0, 4).join(","))).toBe(false);
		expect(await recetaCorrecta(S, "jugador-a", [...r].reverse().join(","))).toBe(r.join() === [...r].reverse().join());
		expect(await recetaCorrecta(S, "jugador-a", undefined)).toBe(false);
		expect(await recetaCorrecta(S, "jugador-b", r.join(","))).toBe(false);
	});
});
