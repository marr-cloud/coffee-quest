import { guardarGafete, jugador } from "./gafete";
import { H } from "./historia.es";
import { texto } from "./http";
import { fragmento } from "./receta";
import type { Ruta } from "./rutas";

/** Atender el incidente: cierra la puerta al 218 y entrega el fragmento 5 (el que falta para el 200). */
export const INCIDENTE: Ruta = {
	metodo: "POST",
	ruta: "/incidente/ack",
	requiere: 6,
	handler: async (c) => {
		const estado = { ...jugador(c), incidente: "atendido" as const };
		await guardarGafete(c, estado);
		return texto(c, H.incidenteAtendido, 200, { "X-Receta-5": await fragmento(c.env.GAFETE_SECRET, estado.id, 5) });
	},
};
