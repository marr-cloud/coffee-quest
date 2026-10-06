import type { Context } from "hono";

export const TEXTO = "text/plain; charset=utf-8";

/**
 * Respuesta de texto del juego. c.newResponse junta las cookies y headers puestos antes (setCookie, c.header);
 * luego se envuelve en un Response nativo porque Hono descarta statusText y no tipa códigos como 218.
 */
export function texto(c: Context, cuerpo: string, status = 200, headers: Record<string, string> = {}, statusText?: string): Response {
	const base = c.newResponse(cuerpo.endsWith("\n") ? cuerpo : `${cuerpo}\n`, { headers: { "Content-Type": TEXTO, ...headers } });
	return new Response(base.body, { status, statusText, headers: base.headers });
}

/**
 * Cuerpo de la petición como texto UTF-8. c.req.text() hace que workerd avise "body which does not appear to
 * be text" con tipos como x-www-form-urlencoded o message/coffeepot; decodificar a mano evita ese ruido.
 */
export async function cuerpoTexto(c: Context): Promise<string> {
	return new TextDecoder().decode(await c.req.arrayBuffer());
}

/** Content-Type sin parámetros y en minúsculas ("" si no viene). */
export function tipoContenido(c: Context): string {
	return (c.req.header("Content-Type") ?? "").split(";")[0]!.trim().toLowerCase();
}

export function origen(c: Context): string {
	return new URL(c.req.url).origin;
}

export function credencialesBasic(c: Context): { usuario: string; clave: string } | null {
	const m = /^Basic\s+(\S+)$/i.exec(c.req.header("Authorization") ?? "");
	if (!m?.[1]) return null;
	try {
		const plano = atob(m[1]);
		const i = plano.indexOf(":");
		return i < 0 ? null : { usuario: plano.slice(0, i), clave: plano.slice(i + 1) };
	} catch {
		return null;
	}
}

export function tokenBearer(c: Context): string | null {
	const m = /^Bearer\s+(\S+)\s*$/i.exec(c.req.header("Authorization") ?? "");
	return m?.[1] ?? null;
}
