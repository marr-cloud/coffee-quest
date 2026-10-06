import type { Nivel } from "../rutas";
import { entrada } from "./01-entrada";
import { recepcion } from "./02-recepcion";
import { ascensor } from "./03-ascensor";
import { piso } from "./04-piso";
import { cocina } from "./05-cocina";
import { solicitud } from "./06-solicitud";
import { formulario } from "./07-formulario";

/** Registro ordenado de niveles: lo usan el router, /pista y /coleccion. */
export const NIVELES: Nivel[] = [entrada, recepcion, ascensor, piso, cocina, solicitud, formulario];
