import { avanzar, guardarGafete, jugador, rechazoBearer } from "../gafete";
import { H } from "../historia.es";
import { texto } from "../http";
import { fragmento } from "../receta";
import type { Nivel } from "../rutas";

export const bloqueo: Nivel = {
	numero: 10,
	nombre: "TI: quitar el bloqueo",
	metodo: "DELETE",
	ruta: "/ti/maquina/bloqueo",
	requiere: 9,
	esqueleto: "/ti/maquina/bloqueo",
	resuelta: [
		{
			nombre: "10. TI: quitar el bloqueo (DELETE)",
			metodo: "DELETE",
			url: "/ti/maquina/bloqueo",
			headers: { Authorization: "Bearer {{token_ti}}" },
			captura: ['pm.collectionVariables.set("receta_3", pm.response.headers.get("X-Receta-3"));'],
		},
	],
	handler: async (c) => {
		const rechazo = await rechazoBearer(c);
		if (rechazo) return rechazo;
		const estado = avanzar(jugador(c), 10);
		await guardarGafete(c, estado);
		return texto(c, H.nivel10, 200, { "X-Receta-3": await fragmento(c.env.GAFETE_SECRET, estado.id, 3) });
	},
};
