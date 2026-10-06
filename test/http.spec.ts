import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { describe, expect, it } from "vitest";
import { credencialesBasic, origen, texto, tipoContenido, tokenBearer } from "../src/http";

describe("http", () => {
	it("texto: text/plain utf-8, agrega salto final, conserva cookies y aplica statusText", async () => {
		const app = new Hono();
		app.get("/", (c) => {
			setCookie(c, "a", "1");
			return texto(c, "hola", 218, { "X-Uno": "1" }, "This is fine");
		});
		const res = await app.request("https://x.test/");
		expect(res.status).toBe(218);
		expect(res.statusText).toBe("This is fine");
		expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
		expect(res.headers.get("x-uno")).toBe("1");
		expect(res.headers.getSetCookie()).toEqual(["a=1; Path=/"]);
		expect(await res.text()).toBe("hola\n");
	});

	it("tipoContenido ignora parámetros y mayúsculas", async () => {
		const app = new Hono();
		app.post("/", (c) => c.text(tipoContenido(c)));
		const res = await app.request("https://x.test/", { method: "POST", headers: { "Content-Type": "Application/JSON; charset=utf-8" } });
		expect(await res.text()).toBe("application/json");
	});

	it("origen, credencialesBasic y tokenBearer", async () => {
		const app = new Hono();
		app.get("/", (c) => c.json({ o: origen(c), b: credencialesBasic(c), t: tokenBearer(c) }));
		const basic = await app.request("https://x.test/?b=1", { headers: { Authorization: `Basic ${btoa("becario:caf:eina")}` } });
		expect(await basic.json()).toEqual({ o: "https://x.test", b: { usuario: "becario", clave: "caf:eina" }, t: null });
		const bearer = await app.request("https://x.test/", { headers: { Authorization: "Bearer  ti_abc " } });
		expect(await bearer.json()).toEqual({ o: "https://x.test", b: null, t: "ti_abc" });
		const roto = await app.request("https://x.test/", { headers: { Authorization: "Basic @@@" } });
		expect(await roto.json()).toEqual({ o: "https://x.test", b: null, t: null });
	});
});
