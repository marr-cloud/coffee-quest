import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { aBase64url, deBase64url, hmac, igualesSeguro } from "./cripto";
import { H } from "./historia.es";
import { origen, texto, tokenBearer } from "./http";
import type { AppEnv, Estado, Lectura } from "./tipos";

export const COOKIE = "gafete";
export const VIGENCIA_S = 30 * 24 * 60 * 60;
const NOTA = "si lees esto, ya sabes base64. la receta no esta aqui";
const enc = new TextEncoder();
const dec = new TextDecoder();

export function nuevoEstado(nombre: string, ahora = Date.now()): Estado {
	const id = aBase64url(crypto.getRandomValues(new Uint8Array(16)));
	return { v: 1, id, nombre, nivel: 2, incidente: null, iat: Math.floor(ahora / 1000) };
}

/** El nivel solo sube: revisitar niveles pasados no borra progreso. */
export function avanzar(estado: Estado, n: number): Estado {
	return { ...estado, nivel: Math.max(estado.nivel, n) };
}

export async function firmar(estado: Estado, secreto: string): Promise<string> {
	const payload = aBase64url(enc.encode(JSON.stringify({ ...estado, nota: NOTA })));
	return `${payload}.${aBase64url(await hmac(secreto, payload))}`;
}

function esEstado(d: unknown): d is Estado {
	if (typeof d !== "object" || d === null) return false;
	const e = d as Record<string, unknown>;
	return (
		e.v === 1 &&
		typeof e.id === "string" &&
		typeof e.nombre === "string" &&
		Number.isInteger(e.nivel) &&
		(e.incidente === null || e.incidente === "abierto" || e.incidente === "atendido") &&
		typeof e.iat === "number"
	);
}

export async function verificar(token: string | undefined, secreto: string, ahora = Date.now()): Promise<Lectura> {
	if (!token) return { tipo: "ninguno" };
	const [payload, firma, ...resto] = token.split(".");
	if (!payload || !firma || resto.length > 0) return { tipo: "falso" };
	try {
		if (!igualesSeguro(deBase64url(firma), await hmac(secreto, payload))) return { tipo: "falso" };
		const d: unknown = JSON.parse(dec.decode(deBase64url(payload)));
		if (!esEstado(d) || ahora / 1000 - d.iat > VIGENCIA_S) return { tipo: "falso" };
		return { tipo: "ok", estado: { v: 1, id: d.id, nombre: d.nombre, nivel: d.nivel, incidente: d.incidente, iat: d.iat } };
	} catch {
		return { tipo: "falso" };
	}
}

export async function guardarGafete(c: Context<AppEnv>, estado: Estado): Promise<void> {
	setCookie(c, COOKIE, await firmar(estado, c.env.GAFETE_SECRET), {
		path: "/",
		httpOnly: true,
		sameSite: "Lax",
		maxAge: VIGENCIA_S,
		secure: new URL(c.req.url).protocol === "https:",
	});
	c.set("estado", estado);
}

export const leerGafete = createMiddleware<AppEnv>(async (c, next) => {
	const lectura = await verificar(getCookie(c, COOKIE), c.env.GAFETE_SECRET);
	c.set("lectura", lectura);
	c.set("estado", lectura.tipo === "ok" ? lectura.estado : null);
	await next();
});

/** Guardia de nivel: n = último nivel que el jugador debe haber completado (0 = ruta libre). */
export function requiereNivel(n: number) {
	return createMiddleware<AppEnv>(async (c, next) => {
		if (n > 0) {
			const lectura = c.var.lectura;
			if (lectura.tipo === "ninguno") return texto(c, H.sinGafete, 403);
			if (lectura.tipo === "falso") return texto(c, H.gafeteFalso, 403);
			if (lectura.estado.nivel < n) return texto(c, H.noLlegas(lectura.estado.nivel, origen(c)), 409);
		}
		await next();
	});
}

/** Estado del jugador en rutas protegidas por requiereNivel(n > 0). */
export function jugador(c: Context<AppEnv>): Estado {
	const estado = c.var.estado;
	if (!estado) throw new Error("ruta sin requiereNivel");
	return estado;
}

export async function tokenTi(id: string, secreto: string): Promise<string> {
	return `ti_${aBase64url(await hmac(secreto, `ti:${id}`))}`;
}

export async function tokenTiValido(token: string, id: string, secreto: string): Promise<boolean> {
	return igualesSeguro(enc.encode(token), enc.encode(await tokenTi(id, secreto)));
}

/** 401 Bearer si falta el token de TI o no es de este jugador; null si es válido. */
export async function rechazoBearer(c: Context<AppEnv>): Promise<Response | null> {
	const token = tokenBearer(c);
	if (!token) return texto(c, H.tiSinToken, 401, { "WWW-Authenticate": 'Bearer realm="TI"' });
	if (!(await tokenTiValido(token, jugador(c).id, c.env.GAFETE_SECRET)))
		return texto(c, H.tiTokenAjeno, 401, { "WWW-Authenticate": 'Bearer realm="TI", error="invalid_token"' });
	return null;
}
