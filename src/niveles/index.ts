import type { Nivel } from "../rutas";
import { entrada } from "./01-entrada";
import { recepcion } from "./02-recepcion";
import { ascensor } from "./03-ascensor";
import { piso } from "./04-piso";
import { cocina } from "./05-cocina";
import { solicitud } from "./06-solicitud";
import { formulario } from "./07-formulario";
import { ti } from "./08-ti";
import { config } from "./09-config";
import { bloqueo } from "./10-bloqueo";
import { pedido } from "./11-pedido";
import { cafetera } from "./12-cafetera";

/** Registro ordenado de niveles: lo usan el router, /pista y /coleccion. */
export const NIVELES: Nivel[] = [entrada, recepcion, ascensor, piso, cocina, solicitud, formulario, ti, config, bloqueo, pedido, cafetera];
