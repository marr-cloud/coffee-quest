import { describe, expect, it } from "vitest";
import { ESTADO_HTTP, decidirFinal } from "../src/finales";

describe("finales", () => {
	it.each([
		{ incidente: "abierto", mood: "this is fine", recetaOk: false, final: 218 },
		{ incidente: "abierto", mood: "  This   IS fine ", recetaOk: true, final: 218 },
		{ incidente: "atendido", mood: "this is fine", recetaOk: false, final: 418 },
		{ incidente: "atendido", mood: "this is fine", recetaOk: true, final: 200 },
		{ incidente: "atendido", mood: undefined, recetaOk: true, final: 200 },
		{ incidente: "abierto", mood: "todo mal", recetaOk: false, final: 418 },
		{ incidente: null, mood: "this is fine", recetaOk: false, final: 418 },
		// 200 y 218 se excluyen (spec §3): con el incidente abierto, la receta sola no alcanza.
		{ incidente: "abierto", mood: undefined, recetaOk: true, final: 418 },
	] as const)("incidente=$incidente mood=$mood receta=$recetaOk → $final", ({ incidente, mood, recetaOk, final }) => {
		expect(decidirFinal({ incidente, mood, recetaOk })).toBe(final);
	});

	it("textos de estado", () => {
		expect(ESTADO_HTTP).toEqual({ 200: "OK", 218: "This is fine", 418: "I'm a teapot" });
	});
});
