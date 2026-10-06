/**
 * Controles que no deben entrar en un nombre: C0/C1 (incluye ESC de las secuencias ANSI), sustitutos, uso
 * privado, separadores de línea y overrides bidi. ZWJ/ZWNJ quedan permitidos: arman emojis como 👩\u200D💻.
 */
export const NOMBRE_PROHIBIDO = /[\p{Cc}\p{Cs}\p{Co}\u200B\u200E\u200F\u2028\u2029\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/u;

/** Quita todo carácter de control o de formato antes de repetir algo que mandó el jugador. */
export function sinControl(texto: string): string {
	return texto.replace(/\p{C}/gu, "");
}

/**
 * Versión del nombre segura dentro de comillas dobles en bash y PowerShell: sin " ` $ \ ! ni comillas
 * tipográficas (PowerShell también las trata como comillas). Si no queda nada, "TuNombre".
 */
export function paraComando(nombre: string): string {
	const limpio = nombre
		.replace(/["`$\\!“-„]/g, "")
		.replace(/\s+/g, " ")
		.trim();
	return limpio || "TuNombre";
}
