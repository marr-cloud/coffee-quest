/** Formato común de una escena: hora, lugar, cuerpo y siguiente paso. */
export function escena(hora: string, lugar: string, cuerpo: string, siguiente?: string): string {
	return `[${hora}] ${lugar}\n\n${cuerpo}\n${siguiente ? `\n==> Siguiente: ${siguiente}\n` : ""}`;
}

/** Credenciales de TI del juego: salen en un post-it del nivel 5. Son parte del acertijo, no un secreto. */
export const TI = { usuario: "becario", clave: "cafeina123" } as const;
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
	nivel4: (o: string) =>
		escena(
			"09:03",
			"Piso 3",
			`Un cartel: «La cocina se mudó al fondo del pasillo». Y una flecha.

Eso que recibiste es un 301 Moved Permanently: el servidor te dice que
lo que buscas está en otra parte (mira el header Location). curl no
sigue flechas a menos que se lo pidas con -L.`,
			`repite con -L. Y ya que estás, agrega -i: muestra los headers de la
    respuesta, y en este edificio la gente deja cosas en los headers.
    curl -i -L -b cookies.txt -c cookies.txt ${o}/piso/3`,
		),
	otroPiso: (n: string) =>
		`${n === "2" ? "Contabilidad. Ahí no hay café, solo Excel." : n === "1" ? "En el piso 1 solo hay una planta de plástico." : `El piso ${n.slice(0, 10)} no existe o no tiene café.`} Tu equipo está en el 3.`,
	cocina: (o: string) =>
		escena(
			"09:04",
			"Cocina del piso 3",
			`La cafetera tiene un papel: «FUERA DE SERVICIO desde 2019».
Detrás hay algo pegado. No está en el cuerpo de esta respuesta:
está en los headers.`,
			`pide solo los headers con -I (eso hace una petición HEAD):
    curl -I -b cookies.txt -c cookies.txt ${o}/piso/3/cocina`,
		),
	postIts: {
		"X-Post-It-1": "Cafetera rota. La buena esta en TI, pero TI no presta nada sin papeleo de RRHH.",
		"X-Post-It-2": 'RRHH: POST /rrhh/solicitud con JSON {"motivo": "...", "urgencia": 1-10}',
		"X-Post-It-3": `TI -> usuario: ${TI.usuario} / clave: ${TI.clave} (no se lo digas a nadie)`,
		"X-Post-It-4": "El Content-Type importa. RRHH no lee lo que no entiende.",
	} as Record<string, string>,
	soloJson: 'RRHH solo lee JSON. Dile a curl qué le mandas:\n  -H "Content-Type: application/json"',
	jsonRoto:
		"Eso no es JSON válido. Revisa comillas y llaves.\n(¿PowerShell peleando con las comillas? Guarda el JSON en un archivo y usa  -d @archivo.json)",
	sinMotivo: 'Falta el motivo: un texto de hasta 200 caracteres.  {"motivo": "...", "urgencia": 1-10}',
	urgenciaAlta: "La escala va hasta 10. Te creemos, pero pon 10.",
	urgenciaInvalida: "urgencia debe ser un número entero del 1 al 10 (sin comillas).",
	nivel6: (nombre: string, o: string) =>
		escena(
			"09:06",
			"RRHH",
			`«Solicitud recibida», dice Marta de RRHH, sin levantar la vista.
«Ahora el formulario C-27 firmado, ${nombre}. Subido como archivo, por favor.»

En ese momento suenan todos los teléfonos del piso a la vez:

  ALERTA: producción está caída. Alguien tiene que atenderlo:
          POST ${o}/incidente/ack

Tú solo querías un café.`,
			`arma el formulario con tu firma y súbelo con -F (multipart):
    echo "firma: ${nombre}" > formulario.txt
    curl -b cookies.txt -c cookies.txt -F "formulario=@formulario.txt" ${o}/rrhh/formulario
    (o atiende el incidente primero. Tú decides.)`,
		),
	incidenteAtendido: escena(
		"--:--",
		"Incidente",
		`Dejas el café para después y abres el dashboard. Era un disco lleno:
40 GB de logs de debug. Los borras y producción vuelve a respirar.
Alguien en el chat te manda un aplauso y te deja un post-it de
agradecimiento (está en los headers).

Ahora sí: el café.`,
	),
	perro: "sentado, con cafe, todo arde. X-Mood: this is fine",
	noMultipart:
		'Marta no acepta eso. El formulario va como multipart/form-data;\ncurl lo arma solo con -F:  -F "formulario=@formulario.txt"',
	sinFormulario: 'No llegó ningún formulario. El campo se llama formulario:\n  -F "formulario=@formulario.txt"   (la @ sube el archivo)',
	formularioGrande: "Marta mira el archivo: «¿Esto es un formulario o una novela?». Máximo 10 KB.",
	sinFirma: "El formulario no está firmado. Debe tener una línea como:  firma: TuNombre",
	nivel7: (o: string) =>
		escena(
			"09:08",
			"RRHH",
			"Marta sella el formulario sin leerlo. «Listo. TI ya puede atenderte.»",
			`TI tiene la máquina buena. Pide acceso:
    curl -b cookies.txt -c cookies.txt ${o}/ti/maquina`,
		),
	tiPideCredenciales:
		"Sale alguien de TI con audífonos: «¿Usuario y clave?».\n(curl hace Basic auth con  -u usuario:clave . ¿Viste algún post-it por ahí?)",
	tiClaveMala: "«Esa clave no es.» Revisa los post-its de la cocina (curl -I).",
	nivel8: (token: string) =>
		escena(
			"09:09",
			"TI",
			`«Ah, el nuevo. La máquina está bloqueada y en modo ahorro.
Toma, tu token de acceso:»

  ${token}

«Primero ponla en modo barista: PUT a /ti/maquina/config con JSON.
Después quítale el bloqueo con DELETE a /ti/maquina/bloqueo.
El token va en el header Authorization, tipo Bearer. Nunca en la URL.»`,
			'configura la máquina. El JSON es {"modo": "barista"}.',
		),
	modoInvalido: 'Modos disponibles: barista.  {"modo": "barista"}',
	nivel9: escena(
		"09:10",
		"TI",
		`La máquina hace un ruido de avión despegando. Modo barista activado.
Pero sigue el candado rojo en la pantalla.`,
		"quítale el bloqueo (DELETE, con el mismo token).",
	),
	nivel10: escena(
		"09:11",
		"TI",
		`Candado fuera. La pantalla dice: «Escriba su pedido».
Hay una advertencia pegada con cinta: «este teclado no entiende & ni =
ni espacios sin codificar».`,
		`haz tu pedido, exacto:  leche=si & azucar=no
    Va como formulario (-d) en el campo pedido, a /cafetera/pedido.
    curl tiene una variante de -d que codifica esos caracteres por ti.`,
	),
	pedidoNoFormulario:
		"La pantalla espera un formulario (application/x-www-form-urlencoded).\nEs lo que curl manda con -d o --data-urlencode.",
	sinPedido: "Falta el campo pedido.  pedido=...",
	pedidoMalCodificado: (campos: [string, string][]) =>
		`La pantalla entendió esto:
${campos
	.slice(0, 5)
	.map(([k, v]) => `  ${JSON.stringify(k.slice(0, 40))} = ${JSON.stringify(v.slice(0, 60))}`)
	.join("\n")}

No es lo que pediste. Dentro de un formulario, & separa campos y = separa
nombre de valor. Hay que codificarlos: --data-urlencode lo hace por ti.`,
	nivel11: escena(
		"09:12",
		"Cafetera de TI",
		`«Pedido recibido: leche=si & azucar=no». La máquina espera la orden final.
En la pantalla, un texto chiquito: «Compatible con HTCPCP/1.0 (RFC 2324)».`,
		`la cafetera quiere que le hables en su idioma. Averigua qué es HTCPCP;
    el endpoint es /cafetera.`,
	),
	// (los textos de cada tarea se agregan arriba de esta línea)
};
