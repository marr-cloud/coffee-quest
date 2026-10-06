import type { Final, Incidente } from "./tipos";

export const ESTADO_HTTP: Record<Final, string> = { 200: "OK", 218: "This is fine", 418: "I'm a teapot" };

/**
 * Prioridad 218 > 200 > 418 (spec §3). El 200 exige el incidente atendido: así 200 y 218 se excluyen
 * aunque alguien reuse un gafete de antes del ack junto con el fragmento 5.
 */
export function decidirFinal(p: { incidente: Incidente; mood: string | undefined; recetaOk: boolean }): Final {
	const mood = p.mood?.trim().replace(/\s+/g, " ").toLowerCase();
	if (p.incidente === "abierto" && mood === "this is fine") return 218;
	if (p.incidente === "atendido" && p.recetaOk) return 200;
	return 418;
}
