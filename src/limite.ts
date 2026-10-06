import { createMiddleware } from "hono/factory";
import { H } from "./historia.es";
import { texto } from "./http";
import type { AppEnv } from "./tipos";

/** Freno anti-abuso: por id de gafete si hay uno válido, si no por IP. */
export const limitar = createMiddleware<AppEnv>(async (c, next) => {
	const id = c.var.estado?.id;
	const clave = id ? `g:${id}` : `ip:${c.req.header("CF-Connecting-IP") ?? "desconocida"}`;
	const { success } = await c.env.RATE_LIMITER.limit({ key: clave });
	if (!success) return texto(c, H.limite, 429, { "Retry-After": "60" });
	await next();
});
