import { avanzar, guardarGafete, jugador, rechazoBearer } from "../gafete";
import { H } from "../historia.es";
import { cuerpoTexto, texto, tipoContenido } from "../http";
import type { Nivel } from "../rutas";

export const config: Nivel = {
	numero: 9,
	nombre: "TI: modo barista",
	metodo: "PUT",
	ruta: "/ti/maquina/config",
	requiere: 8,
	esqueleto: "/ti/maquina/config",
	resuelta: [
		{
			nombre: "9. TI: modo barista (PUT + Bearer)",
			metodo: "PUT",
			url: "/ti/maquina/config",
			headers: { Authorization: "Bearer {{token_ti}}", "Content-Type": "application/json" },
			cuerpo: { modo: "raw", raw: '{"modo": "barista"}' },
		},
	],
	handler: async (c) => {
		const rechazo = await rechazoBearer(c);
		if (rechazo) return rechazo;
		if (tipoContenido(c) !== "application/json") return texto(c, H.soloJson, 415);
		let datos: unknown;
		try {
			datos = JSON.parse(await cuerpoTexto(c));
		} catch {
			return texto(c, H.jsonRoto, 400);
		}
		if ((datos as { modo?: unknown } | null)?.modo !== "barista") return texto(c, H.modoInvalido, 400);
		await guardarGafete(c, avanzar(jugador(c), 9));
		return texto(c, H.nivel9);
	},
};
