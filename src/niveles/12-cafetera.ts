import { ESTADO_HTTP, decidirFinal } from "../finales";
import { avanzar, guardarGafete, jugador } from "../gafete";
import { H } from "../historia.es";
import { cuerpoTexto, texto, tipoContenido } from "../http";
import { recetaCompleta, recetaCorrecta } from "../receta";
import type { Nivel } from "../rutas";

/** Headers de la petición final. -X BREW no llega al Worker (el edge responde 501), así que se disfraza un POST. */
export const CAFETERA_HEADERS = {
	"X-HTTP-Method-Override": "BREW",
	"Content-Type": "message/coffeepot",
	"Accept-Additions": "leche",
};

export const cafetera: Nivel = {
	numero: 12,
	nombre: "La cafetera",
	metodo: "ALL",
	ruta: "/cafetera",
	requiere: 11,
	esqueleto: "/cafetera",
	resuelta: [
		{ nombre: "12. BREW (final 418)", metodo: "POST", url: "/cafetera", headers: CAFETERA_HEADERS, cuerpo: { modo: "raw", raw: "start" } },
	],
	handler: async (c) => {
		const metodo = c.req.method === "POST" ? (c.req.header("X-HTTP-Method-Override") ?? "POST").trim().toUpperCase() : c.req.method;
		if (metodo !== "BREW") return texto(c, H.soloBrew, 405, { Allow: "BREW" });
		if (tipoContenido(c) !== "message/coffeepot") return texto(c, H.soloCoffeepot, 415);
		if (!c.req.header("Accept-Additions")?.trim()) return texto(c, H.sinAdiciones, 400);
		if ((await cuerpoTexto(c)).trim() !== "start") return texto(c, H.sinStart, 400);
		const previo = jugador(c);
		const recetaOk = await recetaCorrecta(c.env.GAFETE_SECRET, previo.id, c.req.header("X-Receta"));
		const final = decidirFinal({ incidente: previo.incidente, mood: c.req.header("X-Mood"), recetaOk });
		const estado = avanzar(previo, 12);
		await guardarGafete(c, estado);
		c.set("final", final);
		const receta = recetaOk ? (await recetaCompleta(c.env.GAFETE_SECRET, estado.id)).join(", ") : "";
		return texto(c, H.final(final, estado.nombre, receta), final, {}, ESTADO_HTTP[final]);
	},
};
