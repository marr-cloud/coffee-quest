export type Incidente = null | "abierto" | "atendido";
export type Final = 200 | 218 | 418;

/** Lo que guarda el gafete. `nivel` es el último nivel completado. */
export interface Estado {
	v: 1;
	id: string;
	nombre: string;
	nivel: number;
	incidente: Incidente;
	iat: number;
}

export type Lectura = { tipo: "ninguno" } | { tipo: "falso" } | { tipo: "ok"; estado: Estado };

export interface AppEnv {
	Bindings: CloudflareBindings;
	Variables: { lectura: Lectura; estado: Estado | null; final: Final | null };
}
