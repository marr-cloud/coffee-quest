import { avanzar, guardarGafete, jugador } from "../gafete";
import { H } from "../historia.es";
import { texto, tipoContenido } from "../http";
import { fragmento } from "../receta";
import type { Nivel } from "../rutas";

/** ASCII a propósito: curl.exe en Windows puede mandar acentos en otra codificación. */
export const PEDIDO = "leche=si & azucar=no";

export const pedido: Nivel = {
	numero: 11,
	nombre: "Cafetera: pedido",
	metodo: "POST",
	ruta: "/cafetera/pedido",
	requiere: 10,
	esqueleto: "/cafetera/pedido",
	resuelta: [
		{
			nombre: "11. Pedido (urlencoded)",
			metodo: "POST",
			url: "/cafetera/pedido",
			cuerpo: { modo: "urlencoded", campos: { pedido: PEDIDO } },
			captura: ['pm.collectionVariables.set("receta_4", pm.response.headers.get("X-Receta-4"));'],
		},
	],
	handler: async (c) => {
		if (tipoContenido(c) !== "application/x-www-form-urlencoded") return texto(c, H.pedidoNoFormulario, 415);
		const campos = new URLSearchParams(await c.req.text());
		const valor = campos.get("pedido");
		if (valor === null) return texto(c, H.sinPedido, 400);
		if (valor.trim() !== PEDIDO) return texto(c, H.pedidoMalCodificado([...campos.entries()]), 400);
		const estado = avanzar(jugador(c), 11);
		await guardarGafete(c, estado);
		return texto(c, H.nivel11, 200, { "X-Receta-4": await fragmento(c.env.GAFETE_SECRET, estado.id, 4) });
	},
};
