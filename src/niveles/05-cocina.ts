import { avanzar, guardarGafete, jugador } from "../gafete";
import { H } from "../historia.es";
import { origen, texto } from "../http";
import type { Nivel } from "../rutas";

export const cocina: Nivel = {
	numero: 5,
	nombre: "Cocina del piso 3",
	metodo: "GET",
	ruta: "/piso/3/cocina",
	requiere: 4,
	esqueleto: "/piso/3/cocina",
	resuelta: [{ nombre: "5. Cocina (HEAD)", metodo: "HEAD", url: "/piso/3/cocina" }],
	handler: async (c) => {
		// Hono rutea HEAD como GET, pero c.req.method sigue siendo "HEAD".
		if (c.req.method !== "HEAD") return texto(c, H.cocina(origen(c)));
		await guardarGafete(c, avanzar(jugador(c), 5));
		return texto(c, "", 200, H.postIts);
	},
};
