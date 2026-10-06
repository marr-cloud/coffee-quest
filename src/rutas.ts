import type { Context, Hono } from "hono";
import { requiereNivel } from "./gafete";
import { H } from "./historia.es";
import { texto } from "./http";
import type { AppEnv } from "./tipos";

export type Metodo = "GET" | "POST" | "PUT" | "DELETE";

export type Cuerpo =
	| { modo: "raw"; raw: string }
	| { modo: "urlencoded"; campos: Record<string, string> }
	| { modo: "formdata"; campos: Record<string, string> };

/** Una petición de la colección resuelta. `url` es relativa y puede usar variables Postman ({{nombre}}). */
export interface PeticionResuelta {
	nombre: string;
	metodo: string;
	url: string;
	headers?: Record<string, string>;
	cuerpo?: Cuerpo;
	/** Líneas de script Postman (evento "test") para capturar variables. */
	captura?: string[];
	sinRedirect?: boolean;
}

export interface Ruta {
	/** "ALL": el handler valida el método por su cuenta (nivel 12). */
	metodo: Metodo | "ALL";
	ruta: string;
	/** Último nivel que el jugador debe haber completado (0 = libre). */
	requiere: number;
	handler: (c: Context<AppEnv>) => Response | Promise<Response>;
}

export interface Nivel extends Ruta {
	numero: number;
	nombre: string;
	/** URL relativa para la colección esqueleto. */
	esqueleto: string;
	resuelta: PeticionResuelta[];
}

/**
 * Monta una ruta. Hono responde 404 si el método no coincide; aquí se agrega un fallback 405 con Allow.
 * Hono convierte HEAD en GET antes de rutear, así que las rutas GET aceptan HEAD solas.
 */
export function montar(app: Hono<AppEnv>, r: Ruta): void {
	if (r.metodo === "ALL") {
		app.all(r.ruta, requiereNivel(r.requiere), r.handler);
		return;
	}
	app.on(r.metodo, r.ruta, requiereNivel(r.requiere), r.handler);
	const permitidos = r.metodo === "GET" ? "GET, HEAD" : r.metodo;
	app.all(r.ruta, (c) => texto(c, H.metodo(permitidos), 405, { Allow: permitidos }));
}
