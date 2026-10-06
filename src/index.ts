import { Hono } from "hono";
import { leerGafete } from "./gafete";
import { H } from "./historia.es";
import { origen, texto } from "./http";
import { INCIDENTE } from "./incidente";
import { limitar } from "./limite";
import { NIVELES } from "./niveles";
import { type Ruta, montar } from "./rutas";
import type { AppEnv } from "./tipos";

const RUTAS: Ruta[] = [...NIVELES, INCIDENTE];

const app = new Hono<AppEnv>();

// Log estructurado por petición, sin IP ni nombre (spec §5). Va primero para registrar también los 429.
app.use(async (c, next) => {
	c.set("final", null);
	await next();
	const estado = c.var.estado;
	// Pista para el final secreto: solo la ve quien mira headers mientras producción arde.
	if (estado?.incidente === "abierto") c.res.headers.set("X-Perro", H.perro);
	console.log(
		JSON.stringify({
			event: "peticion",
			metodo: c.req.method,
			ruta: new URL(c.req.url).pathname,
			status: c.res.status,
			nivel: estado?.nivel ?? null,
			final: c.var.final,
		}),
	);
});
app.use(leerGafete);
app.use(limitar);

for (const r of RUTAS) montar(app, r);

app.notFound((c) => texto(c, H.perdido(origen(c)), 404));
app.onError((err, c) => {
	console.error(JSON.stringify({ event: "error", mensaje: err.message }));
	return texto(c, H.error, 500);
});

export default app;
