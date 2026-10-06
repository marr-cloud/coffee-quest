import type { Nivel } from "../rutas";
import { entrada } from "./01-entrada";
import { recepcion } from "./02-recepcion";
import { ascensor } from "./03-ascensor";

/** Registro ordenado de niveles: lo usan el router, /pista y /coleccion. */
export const NIVELES: Nivel[] = [entrada, recepcion, ascensor];
