import { describe, expect, it } from "vitest";
import { aBase64url, deBase64url, hmac, igualesSeguro } from "../src/cripto";

describe("cripto", () => {
	it("base64url ida y vuelta, sin relleno ni + /", () => {
		const bytes = Uint8Array.from([0, 251, 255, 62, 63, 1, 2]);
		const texto = aBase64url(bytes);
		expect(texto).not.toMatch(/[+/=]/);
		expect(deBase64url(texto)).toEqual(bytes);
	});

	it("deBase64url lanza con texto inválido", () => {
		expect(() => deBase64url("@@@")).toThrow();
	});

	it("hmac es determinista, de 32 bytes, y depende del secreto", async () => {
		const a = await hmac("s1", "hola");
		expect(a.byteLength).toBe(32);
		expect(await hmac("s1", "hola")).toEqual(a);
		expect(await hmac("s2", "hola")).not.toEqual(a);
	});

	it("igualesSeguro compara contenido y tolera largos distintos", () => {
		expect(igualesSeguro(Uint8Array.from([1, 2]), Uint8Array.from([1, 2]))).toBe(true);
		expect(igualesSeguro(Uint8Array.from([1, 2]), Uint8Array.from([1, 3]))).toBe(false);
		expect(igualesSeguro(Uint8Array.from([1, 2]), Uint8Array.from([1]))).toBe(false);
	});
});
