import { avanzar, guardarGafete, jugador } from "../gafete";
import { H } from "../historia.es";
import { origen, texto, tipoContenido } from "../http";
import { fragmento } from "../receta";
import type { Nivel } from "../rutas";

const MAXIMO = 10 * 1024;

export const formulario: Nivel = {
	numero: 7,
	nombre: "RRHH: formulario firmado",
	metodo: "POST",
	ruta: "/rrhh/formulario",
	requiere: 6,
	esqueleto: "/rrhh/formulario",
	resuelta: [
		{
			nombre: "7. RRHH: formulario (multipart)",
			metodo: "POST",
			url: "/rrhh/formulario",
			cuerpo: { modo: "formdata", campos: { formulario: "firma: {{nombre}}" } },
			captura: ['pm.collectionVariables.set("receta_2", pm.response.headers.get("X-Receta-2"));'],
		},
	],
	handler: async (c) => {
		if (tipoContenido(c) !== "multipart/form-data") return texto(c, H.noMultipart, 415);
		let campo: unknown;
		try {
			campo = (await c.req.parseBody())["formulario"];
		} catch {
			return texto(c, H.sinFormulario, 400);
		}
		// Archivo (-F "formulario=@archivo") o texto (-F "formulario=firma: Ana", colección Postman).
		if (typeof campo !== "string" && !(campo instanceof File)) return texto(c, H.sinFormulario, 400);
		const tamano = typeof campo === "string" ? new TextEncoder().encode(campo).byteLength : campo.size;
		if (tamano > MAXIMO) return texto(c, H.formularioGrande, 413);
		const contenido = typeof campo === "string" ? campo : await campo.text();
		// Los NUL salen de archivos UTF-16 (echo > archivo en Windows PowerShell 5.1).
		if (!/firma\s*:/i.test(contenido.replaceAll("\u0000", ""))) return texto(c, H.sinFirma, 400);
		const estado = avanzar(jugador(c), 7);
		await guardarGafete(c, estado);
		return texto(c, H.nivel7(origen(c)), 200, { "X-Receta-2": await fragmento(c.env.GAFETE_SECRET, estado.id, 2) });
	},
};
