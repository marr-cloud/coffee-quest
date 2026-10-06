import type { Final, Incidente } from "./tipos";

export const ESTADO_HTTP: Record<Final, string> = { 200: "OK", 218: "This is fine", 418: "I'm a teapot" };

/** Prioridad 218 > 200 > 418 (spec §3). */
export function decidirFinal(p: { incidente: Incidente; mood: string | undefined; recetaOk: boolean }): Final {
	const mood = p.mood?.trim().replace(/\s+/g, " ").toLowerCase();
	if (p.incidente === "abierto" && mood === "this is fine") return 218;
	if (p.recetaOk) return 200;
	return 418;
}
