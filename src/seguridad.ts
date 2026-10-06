import { aBase64url } from "./cripto";

/** Headers que llevan todas las respuestas (MDN Observatory). */
export const HEADERS_SEGURIDAD: Record<string, string> = {
	"X-Content-Type-Options": "nosniff",
	"X-Frame-Options": "DENY",
	"Referrer-Policy": "no-referrer",
	"Cross-Origin-Resource-Policy": "same-origin",
};

/** Texto plano, JSON y errores: no cargan nada, así que la CSP no permite nada. */
export const CSP_BASE = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

export function nuevoNonce(): string {
	return aBase64url(crypto.getRandomValues(new Uint8Array(16)));
}

/**
 * CSP de la portada. El nonce cubre el <style> y el <script> propios. 'self' y el host del beacon cubren lo que
 * inyecta la zona de Cloudflare: JS detections carga desde /cdn-cgi/challenge-platform/ y pone este mismo nonce
 * en su script en línea (lo lee del header); Web Analytics carga desde static.cloudflareinsights.com y reporta a
 * /cdn-cgi/rum. https://developers.cloudflare.com/cloudflare-challenges/challenge-types/javascript-detections/
 */
export function cspPortada(nonce: string): string {
	return [
		"default-src 'none'",
		`script-src 'nonce-${nonce}' 'self' https://static.cloudflareinsights.com`,
		`style-src 'nonce-${nonce}'`,
		"img-src 'self'",
		"connect-src 'self'",
		"frame-ancestors 'none'",
		"base-uri 'none'",
		"form-action 'none'",
	].join("; ");
}
