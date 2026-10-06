/** Formato común de una escena: hora, lugar, cuerpo y siguiente paso. */
export function escena(hora: string, lugar: string, cuerpo: string, siguiente?: string): string {
	return `[${hora}] ${lugar}\n\n${cuerpo}\n${siguiente ? `\n==> Siguiente: ${siguiente}\n` : ""}`;
}

export const H = {
	sinGafete: "Sin gafete el torniquete no gira.\nVuelve a recepción por uno (y guárdalo con -c cookies.txt).",
	gafeteFalso:
		"Seguridad mira tu gafete a contraluz: es falso, está alterado o venció.\nBorra cookies.txt y vuelve a recepción por uno nuevo.",
	noLlegas: (nivel: number, o: string) =>
		`Todavía no llegas aquí. Vas en el nivel ${nivel}.\nSi no sabes qué sigue:  curl -b cookies.txt -c cookies.txt ${o}/pista`,
	tiSinToken: '«¿Y el token?» Va en un header:\n  -H "Authorization: Bearer <tu token>"',
	tiTokenAjeno: "«Ese token no es tuyo.» Usa el que te dio TI (pídelo de nuevo con -u si lo perdiste).",
	nivel1: (o: string) =>
		escena(
			"08:59",
			"Planta baja",
			`Eres el nuevo. Primer día, primera daily a las 9:15, y anoche dormiste
cuatro horas. Necesitas un café. Uno de verdad.

En este edificio todo funciona con HTTP: las puertas, el ascensor,
hasta la cafetera. Tu única herramienta es curl.

  ¿Windows?  En PowerShell usa  curl.exe  (curl a secas puede ser otra cosa).
             Si ves letras raras, ejecuta antes  chcp 65001`,
			`preséntate en recepción con tu nombre y el piso al que vas:
    curl "${o}/recepcion?nombre=TuNombre&piso=3"
    (las comillas importan: sin ellas, la terminal se come el &)`,
		),
	perdido: (o: string) => `Te perdiste en la oficina: esa puerta no existe.\n¿Perdido?  curl -b cookies.txt -c cookies.txt ${o}/pista`,
	metodo: (permitidos: string) =>
		`Esa puerta no se abre así. Aquí se usa: ${permitidos}.\n(con curl el método se elige con -X; -d y -F ya implican POST)`,
	limite: "Vas muy rápido: seguridad te pidió que esperes un minuto.\n(429 Too Many Requests; el header Retry-After dice cuánto)",
	error: "Algo se rompió en el edificio (500). No fue tu culpa. Prueba de nuevo en un rato.",
	// (los textos de cada tarea se agregan arriba de esta línea)
};
