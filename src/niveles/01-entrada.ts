import { H } from "../historia.es";
import { origen, texto } from "../http";
import type { Nivel } from "../rutas";
import { portada } from "../web/portada";

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
		(c.req.header("Accept") ?? "").includes("text/html")
			? c.html(portada(origen(c)), 200, { Vary: "Accept" })
			: texto(c, H.nivel1(origen(c)), 200, { Vary: "Accept" }),
};
