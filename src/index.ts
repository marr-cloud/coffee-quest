import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { COLECCION } from "./coleccion";
import { leerGafete } from "./gafete";
import { H } from "./historia.es";
import { origen, texto } from "./http";
import { INCIDENTE } from "./incidente";
import { limitar } from "./limite";
import { NIVELES } from "./niveles";
import { PISTA } from "./pista";
import { type Ruta, montar } from "./rutas";
import type { AppEnv } from "./tipos";

const RUTAS: Ruta[] = [...NIVELES, INCIDENTE, PISTA, COLECCION];
const MIN_SECRETO = 32;
const MAX_CUERPO = 16 * 1024;

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
// Falla cerrado: sin un secreto fuerte, los gafetes serían falsificables y cualquiera saltaría niveles.
app.use(async (c, next) => {
	if ((c.env.GAFETE_SECRET ?? "").length < MIN_SECRETO) {
		console.error(JSON.stringify({ event: "error", mensaje: "GAFETE_SECRET ausente o demasiado corto" }));
		return texto(c, H.error, 500);
	}
	await next();
});
app.use(leerGafete);
app.use(limitar);
// El cuerpo más grande del juego es el formulario (10 KB + multipart): se corta antes de parsear nada.
app.use(bodyLimit({ maxSize: MAX_CUERPO, onError: (c) => texto(c, H.cuerpoGrande, 413) }));

for (const r of RUTAS) montar(app, r);

app.notFound((c) => texto(c, H.perdido(origen(c)), 404));
app.onError((err, c) => {
	console.error(JSON.stringify({ event: "error", mensaje: err.message }));
	return texto(c, H.error, 500);
});

export default app;
