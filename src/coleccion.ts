import { H } from "./historia.es";
import { origen } from "./http";
import { NIVELES } from "./niveles";
import { CAFETERA_HEADERS } from "./niveles/12-cafetera";
import type { Cuerpo, PeticionResuelta, Ruta } from "./rutas";

const SCHEMA = "https://schema.getpostman.com/json/collection/v2.1.0/collection.json";

function cuerpoPostman(c: Cuerpo): Record<string, unknown> {
	if (c.modo === "raw") return { mode: "raw", raw: c.raw };
	const campos = Object.entries(c.campos);
	if (c.modo === "urlencoded") return { mode: "urlencoded", urlencoded: campos.map(([key, value]) => ({ key, value })) };
	return { mode: "formdata", formdata: campos.map(([key, value]) => ({ key, value, type: "text" })) };
}

function item(p: PeticionResuelta): Record<string, unknown> {
	const request: Record<string, unknown> = {
		method: p.metodo,
		header: Object.entries(p.headers ?? {}).map(([key, value]) => ({ key, value })),
		url: `{{base}}${p.url}`,
	};
	if (p.cuerpo) request.body = cuerpoPostman(p.cuerpo);
	const it: Record<string, unknown> = { name: p.nombre, request };
	if (p.captura) it.event = [{ listen: "test", script: { type: "text/javascript", exec: p.captura } }];
	if (p.sinRedirect) it.protocolProfileBehavior = { followRedirects: false };
	return it;
}

function brew(nombre: string, extra: Record<string, string> = {}): PeticionResuelta {
	return { nombre, metodo: "POST", url: "/cafetera", headers: { ...CAFETERA_HEADERS, ...extra }, cuerpo: { modo: "raw", raw: "start" } };
}

/** Postman Collection v2.1: la importan Postman, Insomnia, Bruno, Hoppscotch y Thunder Client. */
export function coleccion(base: string, spoilers: boolean): Record<string, unknown> {
	const variable = [
		{ key: "base", value: base },
		{ key: "nombre", value: "Ana" },
		{ key: "token_ti", value: "" },
		...[1, 2, 3, 4, 5].map((n) => ({ key: `receta_${n}`, value: "" })),
	];
	if (!spoilers) {
		return {
			info: { name: "Coffee Quest", description: H.coleccionEsqueleto, schema: SCHEMA },
			item: NIVELES.map((n) => ({
				name: `${n.numero}. ${n.nombre}`,
				request: {
					method: "GET",
					header: [],
					url: `{{base}}${n.esqueleto}`,
					description: `${H.escenasColeccion[n.numero] ?? n.nombre}\n\n${H.coleccionNivel}`,
				},
			})),
			variable,
		};
	}
	const receta = [1, 2, 3, 4, 5].map((n) => `{{receta_${n}}}`).join(",");
	return {
		info: { name: "Coffee Quest (resuelta)", description: H.coleccionResuelta, schema: SCHEMA },
		item: [
			{ name: "Camino (1-11)", item: NIVELES.filter((n) => n.numero <= 11).flatMap((n) => n.resuelta.map(item)) },
			{ name: "Final 418", item: [item(brew("12. BREW (final 418)"))] },
			{ name: "Final 218", description: H.carpetaFinal218, item: [item(brew("12. BREW (final 218)", { "X-Mood": "this is fine" }))] },
			{
				name: "Final 200",
				description: H.carpetaFinal200,
				item: [
					item({
						nombre: "Incidente: ack",
						metodo: "POST",
						url: "/incidente/ack",
						captura: ['pm.collectionVariables.set("receta_5", pm.response.headers.get("X-Receta-5"));'],
					}),
					item(brew("12. BREW (final 200)", { "X-Receta": receta })),
				],
			},
		],
		variable,
	};
}

export const COLECCION: Ruta = {
	metodo: "GET",
	ruta: "/coleccion",
	requiere: 0,
	handler: (c) =>
		c.newResponse(JSON.stringify(coleccion(origen(c), c.req.query("spoilers") === "si"), null, 2), 200, {
			"Content-Type": "application/json; charset=utf-8",
			"Content-Disposition": 'attachment; filename="coffee-quest.postman_collection.json"',
		}),
};
