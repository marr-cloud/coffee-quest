import { env } from "cloudflare:workers";
import { deBase64url } from "../src/cripto";
import app from "../src/index";

export const BASE = "https://cafe.test";

export const CLAVE_TI = `Basic ${btoa("becario:cafeina123")}`;

/** Bindings de test. El rate limiter real se reemplaza: los tests sin gafete comparten la misma clave de IP. */
export function entorno(limite = true): CloudflareBindings {
	return { ...env, RATE_LIMITER: { limit: async () => ({ success: limite }) } };
}

/** Un jugador con su propio cookie jar, como curl -b/-c. También guarda fragmentos de receta y el token de TI. */
export class Jugador {
	gafete: string | null = null;
	receta: Record<number, string> = {};
	tokenTi: string | null = null;

	async pedir(ruta: string, init: RequestInit = {}): Promise<Response> {
		const headers = new Headers(init.headers);
		if (this.gafete) headers.set("Cookie", `gafete=${this.gafete}`);
		const res = await app.request(`${BASE}${ruta}`, { ...init, headers }, entorno());
		for (const cookie of res.headers.getSetCookie()) {
			const m = /^gafete=([^;]*)/.exec(cookie);
			if (m?.[1]) this.gafete = m[1];
		}
		for (let n = 1; n <= 5; n++) {
			const v = res.headers.get(`X-Receta-${n}`);
			if (v) this.receta[n] = v;
		}
		return res;
	}

	/** Payload del gafete, decodificado sin verificar (como haría un jugador curioso). */
	get estado(): Record<string, unknown> {
		if (!this.gafete) throw new Error("sin gafete");
		return JSON.parse(new TextDecoder().decode(deBase64url(this.gafete.split(".")[0]!)));
	}
}

/** La petición correcta de cada nivel. */
export const PASOS: Record<number, (j: Jugador) => Promise<Response>> = {
	1: (j) => j.pedir("/"),
	2: (j) => j.pedir("/recepcion?nombre=Ana&piso=3"),
	3: (j) => j.pedir("/ascensor"),
	4: (j) => j.pedir("/piso/3"),
	5: (j) => j.pedir("/piso/3/cocina", { method: "HEAD" }),
	6: (j) =>
		j.pedir("/rrhh/solicitud", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ motivo: "necesito cafe", urgencia: 10 }),
		}),
	7: (j) => {
		const fd = new FormData();
		fd.append("formulario", new File(["firma: Ana\n"], "formulario.txt", { type: "text/plain" }));
		return j.pedir("/rrhh/formulario", { method: "POST", body: fd });
	},
	8: async (j) => {
		const res = await j.pedir("/ti/maquina", { headers: { Authorization: CLAVE_TI } });
		j.tokenTi = /ti_[A-Za-z0-9_-]+/.exec(await res.clone().text())?.[0] ?? null;
		return res;
	},
	9: (j) =>
		j.pedir("/ti/maquina/config", {
			method: "PUT",
			headers: { Authorization: `Bearer ${j.tokenTi}`, "Content-Type": "application/json" },
			body: '{"modo": "barista"}',
		}),
	10: (j) => j.pedir("/ti/maquina/bloqueo", { method: "DELETE", headers: { Authorization: `Bearer ${j.tokenTi}` } }),
	// (cada tarea agrega aquí el paso de su nivel)
};

export async function jugarHasta(j: Jugador, n: number): Promise<void> {
	for (let i = 1; i <= n; i++) {
		const paso = PASOS[i];
		if (!paso) throw new Error(`falta PASOS[${i}]`);
		const res = await paso(j);
		if (res.status >= 400) throw new Error(`paso ${i}: ${res.status} ${await res.text()}`);
	}
}
