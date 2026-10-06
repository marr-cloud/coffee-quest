import { H } from "../historia.es";
import { origen, texto } from "../http";
import type { Nivel } from "../rutas";

export const entrada: Nivel = {
	numero: 1,
	nombre: "Planta baja",
	metodo: "GET",
	ruta: "/",
	requiere: 0,
	esqueleto: "/",
	resuelta: [{ nombre: "1. Planta baja", metodo: "GET", url: "/" }],
	handler: (c) => texto(c, H.nivel1(origen(c)), 200, { Vary: "Accept" }),
};
