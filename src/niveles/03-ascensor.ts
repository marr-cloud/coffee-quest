import { avanzar, guardarGafete, jugador } from "../gafete";
import { H } from "../historia.es";
import { origen, texto } from "../http";
import type { Nivel } from "../rutas";

export const ascensor: Nivel = {
	numero: 3,
	nombre: "Ascensor",
	metodo: "GET",
	ruta: "/ascensor",
	requiere: 2,
	esqueleto: "/ascensor",
	resuelta: [{ nombre: "3. Ascensor", metodo: "GET", url: "/ascensor" }],
	handler: async (c) => {
		await guardarGafete(c, avanzar(jugador(c), 3));
		return texto(c, H.nivel3(origen(c)));
	},
};
