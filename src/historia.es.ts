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
	sinNombre: "La recepcionista te mira por encima de los lentes: «¿Y tu nombre?».\nAgrégalo a la URL:  ?nombre=TuNombre&piso=3",
	nombreInvalido: "Ese nombre no cabe en el gafete: máximo 30 caracteres y sin caracteres de control.",
	pisoEquivocado: (piso: string | undefined) =>
		piso === undefined
			? "«¿A qué piso vas?» Agrega &piso=3 a la URL."
			: piso === "2"
				? "«¿Al 2? Eso es contabilidad: ahí no hay café, solo Excel.» Tu equipo está en el 3."
				: `«¿Al piso ${piso.slice(0, 10)}? No, no. Tu equipo está en el 3.»`,
	nivel2: (nombre: string, o: string) =>
		escena(
			"09:00",
			"Recepción",
			`«Bienvenido, ${nombre}.» Te entrega un gafete... bueno, te lo mandó en un
header: Set-Cookie. Si no lo guardaste, ya lo perdiste.

curl no guarda cookies si no se lo pides:
  -c cookies.txt   guarda las cookies que te manden
  -b cookies.txt   las envía en la siguiente petición`,
			`pide el gafete de nuevo guardándolo, y pasa al ascensor:
    curl -c cookies.txt "${o}/recepcion?nombre=${encodeURIComponent(nombre)}&piso=3"
    curl -b cookies.txt -c cookies.txt ${o}/ascensor`,
		),
	nivel3: (o: string) =>
		escena(
			"09:02",
			"Ascensor",
			`El torniquete lee tu gafete y hace bip. Un bip amable.
Subes con alguien que habla por teléfono de «sinergias». Llegas al 3.

De aquí en adelante usa siempre  -b cookies.txt -c cookies.txt
(así el gafete se actualiza cada vez que avanzas).`,
			`entra al piso 3:
    curl -b cookies.txt -c cookies.txt ${o}/piso/3`,
		),
	// (los textos de cada tarea se agregan arriba de esta línea)
};
