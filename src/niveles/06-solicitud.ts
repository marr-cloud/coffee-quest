import { avanzar, guardarGafete, jugador } from "../gafete";
import { H } from "../historia.es";
import { cuerpoTexto, origen, texto, tipoContenido } from "../http";
import type { Nivel } from "../rutas";
import type { Estado } from "../tipos";

export const solicitud: Nivel = {
	numero: 6,
	nombre: "RRHH: solicitud",
	metodo: "POST",
	ruta: "/rrhh/solicitud",
	requiere: 5,
	esqueleto: "/rrhh/solicitud",
	resuelta: [
		{
			nombre: "6. RRHH: solicitud (JSON)",
			metodo: "POST",
			url: "/rrhh/solicitud",
			headers: { "Content-Type": "application/json" },
			cuerpo: { modo: "raw", raw: '{"motivo": "necesito un cafe antes de la daily", "urgencia": 10}' },
		},
	],
	handler: async (c) => {
		if (tipoContenido(c) !== "application/json") return texto(c, H.soloJson, 415);
		let datos: unknown;
		try {
			datos = JSON.parse(await cuerpoTexto(c));
		} catch {
			return texto(c, H.jsonRoto, 400);
		}
		const { motivo, urgencia } = (typeof datos === "object" && datos !== null && !Array.isArray(datos) ? datos : {}) as Record<
			string,
			unknown
		>;
		if (typeof motivo !== "string" || !motivo.trim() || motivo.length > 200) return texto(c, H.sinMotivo, 400);
		const entero = typeof urgencia === "number" && Number.isInteger(urgencia);
		if (entero && urgencia > 10) return texto(c, H.urgenciaAlta, 400);
		if (!entero || urgencia < 1) return texto(c, H.urgenciaInvalida, 400);
		const previo = jugador(c);
		const estado: Estado = { ...avanzar(previo, 6), incidente: previo.incidente ?? "abierto" };
		await guardarGafete(c, estado);
		return texto(c, H.nivel6(estado.nombre, origen(c)));
	},
};
