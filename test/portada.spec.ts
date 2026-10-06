import { describe, expect, it } from "vitest";
import { ESCENA, PALETA, escenaSvg } from "../src/web/escena";
import { portada } from "../src/web/portada";
import { BASE, Jugador } from "./ayuda";

describe("escena pixel art", () => {
	it("64×36, 16 colores, solo caracteres de la paleta", () => {
		expect(Object.keys(PALETA)).toHaveLength(16);
		expect(ESCENA).toHaveLength(36);
		for (const fila of ESCENA) {
			expect(fila).toHaveLength(64);
			// `c in PALETA` y no toHaveProperty: toHaveProperty(".") interpreta el punto como ruta anidada.
			for (const c of fila) expect(c in PALETA, `carácter ${JSON.stringify(c)}`).toBe(true);
		}
	});

	it("SVG nítido, accesible y con capas animadas", () => {
		const svg = escenaSvg("descripción <de> prueba");
		expect(svg).toContain('viewBox="0 0 64 36"');
		expect(svg).toContain('shape-rendering="crispEdges"');
		expect(svg).toContain('role="img"');
		expect(svg).toContain('<title id="escena-titulo">descripción &lt;de&gt; prueba</title>');
		expect(svg).toContain('class="brillo"');
		expect(svg).toContain('class="humo"');
		// El humo debe contrastar con la pared (#3b4a6b): usa el blanco de la paleta, no el gris del mostrador.
		expect(svg).toContain('<g class="humo" fill="#e9edf5"');
	});
});

describe("portada", () => {
	it("navegador (Accept: text/html) → HTML con el comando y los trofeos", async () => {
		const res = await new Jugador().pedir("/", { headers: { Accept: "text/html,application/xhtml+xml,*/*;q=0.8" } });
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toMatch(/^text\/html/);
		expect(res.headers.get("vary")).toBe("Accept");
		const html = await res.text();
		expect(html).toMatch(/^<!doctype html>/);
		expect(html).toContain(`<code id="cmd">curl ${BASE}</code>`);
		expect(html).toContain("curl.exe");
		for (const t of ["418", "200", "???"]) expect(html).toContain(`<b>${t}</b>`);
		expect(html).toContain('href="/coleccion"');
		expect(html).toContain("<code>Accept: text/html</code>");
		expect(html).toContain("<svg");
		// Favicon inline: sin él, el navegador pide /favicon.ico y recibe un 404.
		expect(html).toContain('<link rel="icon" href="data:image/svg+xml,');
	});

	it("curl (Accept: */*) → nivel 1 en texto", async () => {
		const res = await new Jugador().pedir("/", { headers: { Accept: "*/*" } });
		expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
		expect(await res.text()).toContain("Planta baja");
	});

	it("escapa el origen", () => {
		const html = portada('https://x.test"><script>alert(1)</script>');
		expect(html).not.toContain("<script>alert(1)");
		expect(html).toContain("&quot;&gt;&lt;script&gt;");
	});
});
