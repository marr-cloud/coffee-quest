import { createMiddleware } from "hono/factory";
import { H } from "./historia.es";
import { texto } from "./http";
import type { AppEnv } from "./tipos";

/**
 * Freno anti-abuso en dos capas: un tope por IP siempre (así juntar gafetes no lo esquiva) y uno más
 * estricto por gafete, o por IP si todavía no hay gafete.
 */
export const limitar = createMiddleware<AppEnv>(async (c, next) => {
	const ip = `ip:${c.req.header("CF-Connecting-IP") ?? "desconocida"}`;
	const id = c.var.estado?.id;
	const [porIp, porJugador] = await Promise.all([
		c.env.RATE_LIMITER_IP.limit({ key: ip }),
		c.env.RATE_LIMITER.limit({ key: id ? `g:${id}` : ip }),
	]);
	if (!porIp.success || !porJugador.success) return texto(c, H.limite, 429, { "Retry-After": "60" });
	await next();
});
