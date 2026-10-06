import { describe, expect, it } from "vitest";
import { BASE, Jugador } from "./ayuda";

const SCHEMA = "https://schema.getpostman.com/json/collection/v2.1.0/collection.json";

async function bajar(ruta: string) {
	const res = await new Jugador().pedir(ruta);
	expect(res.status).toBe(200);
	expect(res.headers.get("content-type")).toBe("application/json; charset=utf-8");
	expect(res.headers.get("content-disposition")).toBe('attachment; filename="coffee-quest.postman_collection.json"');
	return (await res.json()) as {
		info: { name: string; schema: string };
		item: { name: string; item?: unknown[]; request?: { method: string; url: string; header: unknown[]; body?: unknown } }[];
		variable: { key: string; value: string }[];
	};
}

describe("/coleccion", () => {
	it("esqueleto: 12 peticiones GET sin headers ni body", async () => {
		const col = await bajar("/coleccion");
		expect(col.info.schema).toBe(SCHEMA);
		expect(col.item).toHaveLength(12);
		expect(col.item[0]!.name).toBe("1. Planta baja");
		for (const peticion of col.item) {
			expect(peticion.request!.method).toBe("GET");
			expect(peticion.request!.url).toMatch(/^\{\{base\}\}\//);
			expect(peticion.request!.header).toEqual([]);
			expect(peticion.request!.body).toBeUndefined();
		}
		expect(col.variable).toContainEqual({ key: "base", value: BASE });
	});

	it("esqueleto: cada request describe su propia escena (spec §6)", async () => {
		const col = await bajar("/coleccion");
		const descripciones = col.item.map((p) => (p.request as unknown as { description: string }).description);
		expect(new Set(descripciones).size).toBe(12);
		expect(descripciones[0]).toContain("Planta baja");
		expect(descripciones[11]).toContain("HTCPCP");
		for (const d of descripciones) expect(d).toContain("Completa el método");
	});

	it("resuelta: cuatro carpetas en orden y el camino completo", async () => {
		const col = await bajar("/coleccion?spoilers=si");
		expect(col.info.name).toContain("resuelta");
		expect(col.item.map((c) => c.name)).toEqual(["Camino (1-11)", "Final 418", "Final 218", "Final 200"]);
		const camino = col.item[0]!.item as { name: string; request: { method: string } }[];
		expect(camino).toHaveLength(11);
		expect(camino[4]!.request.method).toBe("HEAD");
		const final200 = col.item[3]!.item as { request: { url: string; header: { key: string; value: string }[] } }[];
		expect(final200[0]!.request.url).toBe("{{base}}/incidente/ack");
		expect(final200[1]!.request.header).toContainEqual({
			key: "X-Receta",
			value: "{{receta_1}},{{receta_2}},{{receta_3}},{{receta_4}},{{receta_5}}",
		});
		const final218 = col.item[2]!.item as { request: { header: { key: string; value: string }[] } }[];
		expect(final218[0]!.request.header).toContainEqual({ key: "X-Mood", value: "this is fine" });
		const claves = col.variable.map((v) => v.key);
		expect(claves).toEqual(["base", "nombre", "token_ti", "receta_1", "receta_2", "receta_3", "receta_4", "receta_5"]);
	});

	it("resuelta: el piso 3 no sigue el redirect y los cuerpos tienen el formato Postman", async () => {
		const col = await bajar("/coleccion?spoilers=si");
		const camino = col.item[0]!.item as Record<string, unknown>[];
		expect(camino[3]).toMatchObject({ protocolProfileBehavior: { followRedirects: false } });
		expect(camino[6]).toMatchObject({
			request: { body: { mode: "formdata", formdata: [{ key: "formulario", value: "firma: {{nombre}}", type: "text" }] } },
		});
		expect(camino[10]).toMatchObject({
			request: { body: { mode: "urlencoded", urlencoded: [{ key: "pedido", value: "leche=si & azucar=no" }] } },
		});
		expect(camino[3]).toMatchObject({ event: [{ listen: "test", script: { type: "text/javascript" } }] });
	});
});
