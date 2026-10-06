import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import app from "../src/index";
import { BASE, Jugador, entorno } from "./ayuda";

describe("app", () => {
	it("GET / da el nivel 1 en texto", async () => {
		const res = await new Jugador().pedir("/");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
		expect(res.headers.get("vary")).toBe("Accept");
		const cuerpo = await res.text();
		expect(cuerpo).toContain("[08:59] Planta baja");
		expect(cuerpo).toContain(`curl "${BASE}/recepcion?nombre=TuNombre&piso=3"`);
		expect(cuerpo).toContain("==> Siguiente:");
	});

	it("HEAD / responde sin cuerpo", async () => {
		const res = await new Jugador().pedir("/", { method: "HEAD" });
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("");
	});

	it("método equivocado → 405 con Allow", async () => {
		const res = await new Jugador().pedir("/", { method: "POST" });
		expect(res.status).toBe(405);
		expect(res.headers.get("allow")).toBe("GET, HEAD");
	});

	it("ruta inexistente → 404 de la historia", async () => {
		const res = await new Jugador().pedir("/sotano");
		expect(res.status).toBe(404);
		expect(await res.text()).toContain("Te perdiste");
	});

	it("rate limit → 429 con Retry-After", async () => {
		const res = await app.request(`${BASE}/`, {}, entorno(false));
		expect(res.status).toBe(429);
		expect(res.headers.get("retry-after")).toBe("60");
	});

	it("funciona a través del entrypoint real del Worker", async () => {
		const res = await exports.default.fetch("https://example.com/");
		expect(res.status).toBe(200);
		expect(await res.text()).toContain("Planta baja");
	});
});
