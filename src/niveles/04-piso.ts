import { avanzar, guardarGafete, jugador } from "../gafete";
import { H } from "../historia.es";
import { origen, texto } from "../http";
import { fragmento } from "../receta";
import type { Nivel } from "../rutas";

export const piso: Nivel = {
	numero: 4,
	nombre: "Piso 3",
	metodo: "GET",
	ruta: "/piso/:n",
	requiere: 3,
	esqueleto: "/piso/3",
	resuelta: [
		{
			nombre: "4. Piso 3 (sin seguir el redirect)",
			metodo: "GET",
			url: "/piso/3",
			sinRedirect: true,
			captura: ['pm.collectionVariables.set("receta_1", pm.response.headers.get("X-Receta-1"));'],
		},
	],
	handler: async (c) => {
		const n = c.req.param("n") ?? "";
		if (n !== "3") return texto(c, H.otroPiso(n), 404);
		const estado = avanzar(jugador(c), 4);
		// La cookie va en el 301: curl -L -c la guarda antes de seguir la flecha.
		await guardarGafete(c, estado);
		return texto(c, H.nivel4(origen(c)), 301, {
			Location: "/piso/3/cocina",
			"X-Receta-1": await fragmento(c.env.GAFETE_SECRET, estado.id, 1),
		});
	},
};
