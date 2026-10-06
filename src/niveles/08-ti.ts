import { avanzar, guardarGafete, jugador, tokenTi } from "../gafete";
import { H, TI } from "../historia.es";
import { credencialesBasic, texto } from "../http";
import type { Nivel } from "../rutas";

const DESAFIO = { "WWW-Authenticate": 'Basic realm="TI", charset="UTF-8"' };

export const ti: Nivel = {
	numero: 8,
	nombre: "TI: la máquina buena",
	metodo: "GET",
	ruta: "/ti/maquina",
	requiere: 7,
	esqueleto: "/ti/maquina",
	resuelta: [
		{
			nombre: "8. TI (Basic auth)",
			metodo: "GET",
			url: "/ti/maquina",
			headers: { Authorization: `Basic ${btoa(`${TI.usuario}:${TI.clave}`)}` },
			captura: ["const m = pm.response.text().match(/ti_[A-Za-z0-9_-]+/);", 'if (m) pm.collectionVariables.set("token_ti", m[0]);'],
		},
	],
	handler: async (c) => {
		const cred = credencialesBasic(c);
		if (!cred) return texto(c, H.tiPideCredenciales, 401, DESAFIO);
		if (cred.usuario !== TI.usuario || cred.clave !== TI.clave) return texto(c, H.tiClaveMala, 401, DESAFIO);
		const estado = avanzar(jugador(c), 8);
		await guardarGafete(c, estado);
		return texto(c, H.nivel8(await tokenTi(estado.id, c.env.GAFETE_SECRET)));
	},
};
