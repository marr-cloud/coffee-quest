import type { Context } from "hono";
import { H } from "../historia.es";
import { origen, texto } from "../http";
import type { Nivel } from "../rutas";
import { cspPortada, nuevoNonce } from "../seguridad";
import type { AppEnv } from "../tipos";
import { portada } from "../web/portada";

/** Portada con un nonce nuevo por petición, el mismo en el HTML y en su CSP. */
function portadaHtml(c: Context<AppEnv>): Response {
	const nonce = nuevoNonce();
	return c.html(portada(origen(c), nonce), 200, {
		Vary: "Accept",
		"Content-Security-Policy": cspPortada(nonce),
		"Cross-Origin-Opener-Policy": "same-origin",
	});
}

export const entrada: Nivel = {
	numero: 1,
	nombre: "Planta baja",
	metodo: "GET",
	ruta: "/",
	requiere: 0,
	esqueleto: "/",
	resuelta: [{ nombre: "1. Planta baja", metodo: "GET", url: "/" }],
	// Navegadores piden text/html y reciben la portada; curl pide */* y recibe el juego.
	handler: (c) =>
		(c.req.header("Accept") ?? "").includes("text/html") ? portadaHtml(c) : texto(c, H.nivel1(origen(c)), 200, { Vary: "Accept" }),
};
