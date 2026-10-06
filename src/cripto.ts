const enc = new TextEncoder();

export function aBase64url(bytes: Uint8Array): string {
	let binario = "";
	for (const b of bytes) binario += String.fromCharCode(b);
	return btoa(binario).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

/** Lanza si el texto no es base64url válido. */
export function deBase64url(texto: string): Uint8Array {
	const b64 = texto.replaceAll("-", "+").replaceAll("_", "/");
	const binario = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
	return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

export async function hmac(secreto: string, mensaje: string): Promise<Uint8Array> {
	const clave = await crypto.subtle.importKey("raw", enc.encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
	return new Uint8Array(await crypto.subtle.sign("HMAC", clave, enc.encode(mensaje)));
}

/** Comparación en tiempo constante (timingSafeEqual de workerd lanza si los largos difieren). */
export function igualesSeguro(a: Uint8Array, b: Uint8Array): boolean {
	return a.byteLength === b.byteLength && crypto.subtle.timingSafeEqual(a, b);
}
