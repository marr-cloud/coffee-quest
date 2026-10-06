import { describe, expect, it } from "vitest";
import app from "../src/index";
import { BASE, Jugador, entorno } from "./ayuda";

const HTML = { Accept: "text/html" };

/** Directivas de una CSP como mapa nombre → fuentes. */
function csp(res: Response): Record<string, string[]> {
	const valor = res.headers.get("content-security-policy") ?? "";
	return Object.fromEntries(
		valor
			.split(";")
			.map((d) => d.trim().split(/\s+/))
			.filter((p) => p[0])
			.map(([nombre, ...fuentes]) => [nombre!, fuentes]),
	);
}

describe("headers de seguridad (MDN Observatory)", () => {
	it.each([
		["texto del juego", "/", {}],
		["portada HTML", "/", HTML],
		["colección JSON", "/coleccion", {}],
		["404", "/sotano", {}],
		["429", "/", { limite: "agotado" }],
	])("%s: X-Frame-Options, Referrer-Policy, CORP y CSP", async (_, ruta, headers) => {
		const res =
			"limite" in headers
				? await app.request(`${BASE}${ruta}`, {}, entorno(false))
				: await new Jugador().pedir(ruta, { headers: headers as Record<string, string> });
		if ("limite" in headers) expect(res.status).toBe(429);
		expect(res.headers.get("x-frame-options")).toBe("DENY");
		expect(res.headers.get("referrer-policy")).toBe("no-referrer");
		expect(res.headers.get("cross-origin-resource-policy")).toBe("same-origin");
		const d = csp(res);
		expect(d["frame-ancestors"]).toEqual(["'none'"]);
		expect(d["base-uri"]).toEqual(["'none'"]);
		expect(d["form-action"]).toEqual(["'none'"]);
		expect(d["default-src"]).toEqual(["'none'"]);
	});

	it("las respuestas que no son la portada no permiten ningún script", async () => {
		const d = csp(await new Jugador().pedir("/"));
		expect(d["script-src"]).toBeUndefined();
		expect(d["style-src"]).toBeUndefined();
	});
});

describe("CSP de la portada", () => {
	it("usa un nonce por petición, sin unsafe-inline, y lo pone en su style y su script", async () => {
		const res = await new Jugador().pedir("/", { headers: HTML });
		const html = await res.text();
		const d = csp(res);
		const nonce = d["script-src"]!.find((f) => f.startsWith("'nonce-"))!.slice(7, -1);
		expect(nonce).toMatch(/^[A-Za-z0-9_-]{22}$/);
		expect(d["style-src"]).toEqual([`'nonce-${nonce}'`]);
		expect(res.headers.get("content-security-policy")).not.toContain("unsafe-inline");
		expect(html).toContain(`<style nonce="${nonce}">`);
		expect(html).toContain(`<script nonce="${nonce}">`);
		// Ningún <style> o <script> sin nonce.
		expect(html.match(/<(style|script)(?![^>]*nonce=)/g)).toBeNull();
		const otra = csp(await new Jugador().pedir("/", { headers: HTML }));
		expect(otra["script-src"]).not.toContain(`'nonce-${nonce}'`);
	});

	it("deja pasar lo que inyecta Cloudflare (JS detections y Web Analytics)", async () => {
		const res = await new Jugador().pedir("/", { headers: HTML });
		const d = csp(res);
		expect(d["script-src"]).toEqual(expect.arrayContaining(["'self'", "https://static.cloudflareinsights.com"]));
		expect(d["connect-src"]).toEqual(["'self'"]);
		expect(d["img-src"]).toEqual(["'self'"]);
		expect(res.headers.get("cross-origin-opener-policy")).toBe("same-origin");
	});
});
