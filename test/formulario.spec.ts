import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { fragmento } from "../src/receta";
import { Jugador, jugarHasta } from "./ayuda";

function multipart(campo: string, valor: string | File): RequestInit {
	const fd = new FormData();
	fd.append(campo, valor);
	return { method: "POST", body: fd };
}

const archivo = (contenido: string | Uint8Array) => new File([contenido], "formulario.txt", { type: "text/plain" });

/** Lo que genera `echo "firma: Ana" > formulario.txt` en Windows PowerShell 5.1: UTF-16LE con BOM. */
function utf16le(texto: string): Uint8Array {
	const bytes = new Uint8Array(2 + texto.length * 2);
	bytes.set([0xff, 0xfe]);
	for (let i = 0; i < texto.length; i++) bytes[2 + i * 2] = texto.charCodeAt(i);
	return bytes;
}

describe("nivel 7: formulario", () => {
	it("antes de la solicitud → 409", async () => {
		const j = new Jugador();
		await jugarHasta(j, 5);
		expect((await j.pedir("/rrhh/formulario", multipart("formulario", archivo("firma: Ana")))).status).toBe(409);
	});

	it.each([
		[{ method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }, 415, "multipart/form-data"],
		[{ method: "POST", headers: { "Content-Type": "multipart/form-data" }, body: "basura" }, 400, "ningún formulario"],
		[multipart("archivo", archivo("firma: Ana")), 400, "ningún formulario"],
		[multipart("formulario", archivo("x".repeat(10 * 1024 + 1))), 413, "Máximo 10 KB"],
		[multipart("formulario", archivo("hola, soy Ana")), 400, "no está firmado"],
	] as [RequestInit, number, string][])("petición inválida → %#", async (init, status, texto) => {
		const j = new Jugador();
		await jugarHasta(j, 6);
		const res = await j.pedir("/rrhh/formulario", init);
		expect(res.status).toBe(status);
		expect(await res.text()).toContain(texto);
		expect(j.estado.nivel).toBe(6);
	});

	it.each([
		["archivo UTF-8", archivo("Formulario C-27\nFIRMA:Ana\n")],
		["archivo UTF-16LE de PowerShell 5.1", archivo(utf16le("firma: Ana\r\n"))],
		["campo de texto (colección)", "firma: Ana"],
	])("acepta %s, avanza y entrega el fragmento 2", async (_, valor) => {
		const j = new Jugador();
		await jugarHasta(j, 6);
		const res = await j.pedir("/rrhh/formulario", multipart("formulario", valor));
		expect(res.status).toBe(200);
		expect(await res.text()).toContain("/ti/maquina");
		expect(res.headers.get("x-receta-2")).toBe(await fragmento(env.GAFETE_SECRET, j.estado.id as string, 2));
		expect(j.estado.nivel).toBe(7);
	});
});
