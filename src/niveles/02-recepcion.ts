import { avanzar, guardarGafete, nuevoEstado } from "../gafete";
import { H } from "../historia.es";
import { origen, texto } from "../http";
import type { Nivel } from "../rutas";

export const recepcion: Nivel = {
	numero: 2,
	nombre: "Recepción",
	metodo: "GET",
	ruta: "/recepcion",
	requiere: 0,
	esqueleto: "/recepcion",
	resuelta: [{ nombre: "2. Recepción", metodo: "GET", url: "/recepcion?nombre={{nombre}}&piso=3" }],
	handler: async (c) => {
		const nombre = (c.req.query("nombre") ?? "").trim();
		const piso = c.req.query("piso");
		if (!nombre) return texto(c, H.sinNombre, 400);
		if ([...nombre].length > 30 || /\p{C}/u.test(nombre)) return texto(c, H.nombreInvalido, 400);
		if (piso !== "3") return texto(c, H.pisoEquivocado(piso), 400);
		// Con un gafete válido no se reinicia nada: el progreso y el nombre originales se conservan.
		const previo = c.var.estado;
		const estado = previo ? avanzar(previo, 2) : nuevoEstado(nombre);
		await guardarGafete(c, estado);
		return texto(c, H.nivel2(estado.nombre, origen(c)));
	},
};
