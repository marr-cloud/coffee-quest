import { hmac } from "./cripto";

/** 32 palabras: un byte del HMAC módulo 32 elige una sin sesgo. */
export const PALABRAS = [
	"molienda-fina",
	"agua-92",
	"grano-tostado",
	"crema-suave",
	"taza-tibia",
	"filtro-nuevo",
	"espuma-densa",
	"aroma-intenso",
	"cuchara-larga",
	"azucar-morena",
	"canela-molida",
	"vapor-alto",
	"leche-entera",
	"cacao-amargo",
	"hielo-picado",
	"vaso-doble",
	"prensa-francesa",
	"goteo-lento",
	"tueste-medio",
	"origen-unico",
	"notas-citricas",
	"cuerpo-medio",
	"acidez-baja",
	"pausa-larga",
	"sorbo-corto",
	"receta-vieja",
	"jarra-limpia",
	"molino-manual",
	"agua-filtrada",
	"leche-avena",
	"miel-pura",
	"vainilla-real",
] as const;

/** Fragmento n (1..5) de la receta de un jugador. Se recalcula siempre: el gafete no lo guarda. */
export async function fragmento(secreto: string, id: string, n: number): Promise<string> {
	const h = await hmac(secreto, `receta:${id}:${n}`);
	return PALABRAS[h[0]! % PALABRAS.length]!;
}

export function recetaCompleta(secreto: string, id: string): Promise<string[]> {
	return Promise.all([1, 2, 3, 4, 5].map((n) => fragmento(secreto, id, n)));
}

/** Valida el header X-Receta: los 5 fragmentos separados por coma, en orden. */
export async function recetaCorrecta(secreto: string, id: string, header: string | undefined): Promise<boolean> {
	if (!header) return false;
	const enviada = header.split(",").map((p) => p.trim().toLowerCase());
	const esperada = await recetaCompleta(secreto, id);
	return enviada.length === esperada.length && enviada.every((p, i) => p === esperada[i]);
}
