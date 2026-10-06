/**
 * Escena de la portada como matriz de píxeles: un carácter por píxel, colores en PALETA.
 * Para reemplazarla por un dibujo de Aseprite: exportar PNG (64×36, esta paleta), servirlo con Static Assets
 * y cambiar el <svg> de la portada por un <img> con el mismo texto alternativo.
 */
export const PALETA: Record<string, string> = {
	".": "#3b4a6b", // pared
	",": "#2f3b57", // zócalo
	_: "#5a4636", // piso
	k: "#1a1423", // contorno
	w: "#e9edf5", // blanco
	b: "#f4a261", // cielo al amanecer
	y: "#ffd166", // sol
	g: "#8d99ae", // mostrador / humo
	m: "#5c677d", // metal
	r: "#e63946", // rojo
	p: "#fff176", // post-it
	s: "#f1c27d", // piel
	h: "#3d2b1f", // pelo
	c: "#457b9d", // camisa
	o: "#ff7b00", // brillo de la puerta (capa animada)
	e: "#7b5ea7", // ojeras
};

export const ESCENA: readonly string[] = [
	"................................................................",
	"................................................................",
	"..kkkkkkkkkkkkkkkkk....kkkkkkk..................................",
	"..kbbbbbbbwbbbbbbbk....kwwwwwk..................................",
	"..kyyyyyyywyyyyyyyk....kwwkwwk..................................",
	"..kyyyyyyywyyyyyyyk....kwkkwwk..................................",
	"..kbbbbbbbwbbbbbbbk....kwwwwwk..................................",
	"..kwwwwwwwwwwwwwwwk....kwwwwwk..................................",
	"..kbbbbbbbwbyyyybbk....kkkkkkk....kkkkkkkkkkk.....kkkkkkkkkk....",
	"..kbbbbbbbwbyyyybbk...............koookmmmmmk.....kmmmmmmmmk....",
	"..kbbbbbbbwbbbbbbbk...............koookmmmmmk.....kmkkkkkkmk....",
	"..kkkkkkkkkkkkkkkkk...............koookmmmmmk.....kmkrkkgkmk....",
	"..wwwwwwwwwwwwwwwww...............koookmmmmmk.....kmkkkkkkpppp..",
	".......khhhhhhhhhhk...............koookmmmmmk.....kmmmmmmmpkkp..",
	".......khhhhhhhhhhk...............koookmmmmmk.....kmmkkkkmpppp..",
	".......khhhhhhhhhhk...............koookmmmmmk.....kmmmwwmmpppp..",
	"......khsssssssssshk..............koookmmmmmk.....kmmmwwmmmk....",
	"......khsssssssssshk..............koookmmmymk.....kmmmwwmmmk....",
	"......khsskksskksshk..............koookmmmmmk.kkkkkkkkkkkkkkkkkk",
	".......ksseesseessk...............koookmmmmmk.wwwwwwwwwwwwwwwwww",
	".......kssssssssssk...............koookmmmmmk.gggggggggggggggggg",
	".......kssskkkksssk...............koookmmmmmk.gggggggggggggggggg",
	"......kksssssssssskk..............koookmmmmmk.gggggggggggggggggg",
	"....kkccccccwwcccccckk............koookmmmmmk.gggggggggggggggggg",
	",,,kccccccccrrcccccccck,,,,,,,,,,,koookmmmmmk,gggggggggggggggggg",
	",,,kccccccccrrcccccccck,,,,,,,,,,,koookmmmmmk,mmmmmmmmmmmmmmmmmm",
	"___kccccccccrrcccccccck_________________________________________",
	"___kccccccccrrcccccccck_________________________________________",
	"___kccccccccrrcccccccck_________________________________________",
	"___kcccccccccccccccccckkk_______________________________________",
	"kkkkccccccccccccccccccwwwwkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk",
	"k__kccccccccccccccccsswwww______k_______k_______k_______k_______",
	"k__kccccccccccccccccsswww_______k_______k_______k_______k_______",
	"k__ksscccccccccccccckk__k_______k_______k_______k_______k_______",
	"k__ksscccccccccccccck___k_______k_______k_______k_______k_______",
	"k___kkcccccccccccccck___k_______k_______k_______k_______k_______",
];

/** Humo que sale de la cafetera rota (capa animada, sobre la pared). */
const HUMO: readonly [number, number][] = [
	[53, 7],
	[54, 6],
	[55, 6],
	[55, 5],
	[56, 4],
	[57, 4],
	[54, 3],
	[55, 2],
];

const esc = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** Un <rect> por tramo horizontal del mismo color, agrupados por color. */
export function escenaSvg(alt: string): string {
	const capas = new Map<string, string[]>();
	ESCENA.forEach((fila, y) => {
		for (let x = 0; x < fila.length;) {
			const color = fila[x]!;
			let fin = x + 1;
			while (fila[fin] === color) fin++;
			const rects = capas.get(color) ?? [];
			rects.push(`<rect x="${x}" y="${y}" width="${fin - x}" height="1"/>`);
			capas.set(color, rects);
			x = fin;
		}
	});
	const grupos = [...capas].map(
		([color, rects]) => `<g fill="${PALETA[color]}"${color === "o" ? ' class="brillo"' : ""}>${rects.join("")}</g>`,
	);
	const humo = HUMO.map(([x, y]) => `<rect x="${x}" y="${y}" width="1" height="1"/>`).join("");
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 36" shape-rendering="crispEdges" role="img" aria-labelledby="escena-titulo"><title id="escena-titulo">${esc(alt)}</title>${grupos.join("")}<g class="humo" fill="${PALETA.w}">${humo}</g></svg>`;
}
