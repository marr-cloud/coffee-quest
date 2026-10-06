import { tokenTi } from "./gafete";
import { H } from "./historia.es";
import { origen, texto } from "./http";
import type { Ruta } from "./rutas";

/** Siempre explícita: el comando exacto del paso que sigue. */
export const PISTA: Ruta = {
	metodo: "GET",
	ruta: "/pista",
	requiere: 0,
	handler: async (c) => {
		const lectura = c.var.lectura;
		if (lectura.tipo === "falso") return texto(c, H.pistaGafeteFalso);
		if (lectura.tipo === "ninguno") return texto(c, H.pista(2, { o: origen(c), nombre: "TuNombre", token: "" }));
		const e = lectura.estado;
		const siguiente = Math.min(e.nivel + 1, 13);
		const token = siguiente === 9 || siguiente === 10 ? await tokenTi(e.id, c.env.GAFETE_SECRET) : "";
		return texto(c, H.pista(siguiente, { o: origen(c), nombre: e.nombre, token }));
	},
};
