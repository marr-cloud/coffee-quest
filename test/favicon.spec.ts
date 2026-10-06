import { describe, expect, it } from "vitest";
import { Jugador } from "./ayuda";

describe("/favicon.svg", () => {
	it("sirve el ☕ de Noto como SVG, cacheable y sin nada ejecutable", async () => {
		const res = await new Jugador().pedir("/favicon.svg");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toBe("image/svg+xml");
		expect(res.headers.get("cache-control")).toBe("public, max-age=86400");
		const svg = await res.text();
		expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 128 128">/);
		expect(svg.match(/<path /g)).toHaveLength(13);
		expect(svg).not.toMatch(/<script|<style|style=|on[a-z]+=|href|xlink|<!--/i);
	});

	it("la portada lo enlaza (y ya no usa un data: URI que la CSP bloquearía)", async () => {
		const html = await (await new Jugador().pedir("/", { headers: { Accept: "text/html" } })).text();
		expect(html).toContain('<link rel="icon" href="/favicon.svg" type="image/svg+xml">');
		expect(html).not.toContain("data:image");
	});

	it("/favicon.ico redirige al SVG en vez de dar 404", async () => {
		const res = await new Jugador().pedir("/favicon.ico", { redirect: "manual" });
		expect(res.status).toBe(301);
		expect(res.headers.get("location")).toBe("/favicon.svg");
	});
});
