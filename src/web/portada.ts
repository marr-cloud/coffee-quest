import { H } from "../historia.es";
import { escenaSvg } from "./escena";

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ESCAPES[ch]!);
/** Para meter strings en el <script> sin cerrar la etiqueta. */
const js = (s: string) => JSON.stringify(s).replaceAll("<", "\\u003c");

const CSS = `
:root{--fondo:#f4efe6;--texto:#1a1423;--suave:#5c677d;--marco:#1a1423;--acento:#c25700;--boton:#ff7b00;--codigo:#2f3b57;--codigo-texto:#ffd166;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--fondo:#14111c;--texto:#e9edf5;--suave:#a3adbf;--marco:#e9edf5;--acento:#ff9a3d;--codigo:#0b0910;color-scheme:dark}}
:root[data-theme="dark"]{--fondo:#14111c;--texto:#e9edf5;--suave:#a3adbf;--marco:#e9edf5;--acento:#ff9a3d;--codigo:#0b0910;color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--fondo);color:var(--texto);font:16px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace}
main{max-width:46rem;margin:0 auto;padding:24px 16px 48px}
.escena{margin:0;border:4px solid var(--marco);box-shadow:6px 6px 0 var(--boton);background:#3b4a6b}
.escena svg{display:block;width:100%;height:auto}
h1{font-size:clamp(2rem,8vw,3.25rem);line-height:1.1;letter-spacing:.04em;text-transform:uppercase;margin:32px 0 6px}
.gancho{font-size:1.15rem;font-weight:700;color:var(--acento);margin:0 0 16px}
.comando{display:flex;gap:8px;margin:24px 0 6px}
.comando code{flex:1;min-width:0;overflow-x:auto;white-space:nowrap;background:var(--codigo);color:var(--codigo-texto);padding:12px 14px;border:3px solid var(--marco)}
button{font:inherit;font-weight:700;padding:0 16px;border:3px solid var(--marco);background:var(--boton);color:#1a1423;cursor:pointer;box-shadow:3px 3px 0 var(--marco)}
button:active{transform:translate(3px,3px);box-shadow:none}
button:focus-visible,a:focus-visible{outline:3px solid var(--acento);outline-offset:3px}
.nota,.chico{color:var(--suave);font-size:.9rem;margin:0}
p code{background:var(--codigo);color:var(--codigo-texto);padding:1px 5px}
.trofeos{list-style:none;padding:0;display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:32px 0}
.trofeos li{border:3px dashed var(--suave);padding:14px 6px;text-align:center;color:var(--suave);font-size:.85rem}
.trofeos b{display:block;font-size:1.6rem;color:var(--texto);opacity:.5}
.chico{margin-top:24px}
a{color:var(--acento)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.brillo{animation:brillo 1.6s steps(2) infinite}
.humo{animation:humo 2.4s steps(4) infinite}
@keyframes brillo{50%{opacity:.6}}
@keyframes humo{0%{opacity:0;transform:translateY(1px)}40%{opacity:.9}100%{opacity:0;transform:translateY(-2px)}}
@media (prefers-reduced-motion:reduce){.brillo,.humo{animation:none}}
`;

/** `nonce` debe coincidir con el de la CSP de la respuesta (ver cspPortada). */
export function portada(origen: string, nonce: string): string {
	const P = H.portada;
	const comando = `curl ${esc(origen)}`;
	const negociacion = P.negociacion.map((parte, i) => (i % 2 ? `<code>${esc(parte)}</code>` : esc(parte))).join(" ");
	const trofeos = P.trofeos.map(([codigo, nombre]) => `<li><b>${esc(codigo)}</b>${esc(nombre)}</li>`).join("");
	return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(P.titulo)}</title>
<meta name="description" content="${esc(P.descripcion)}">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>☕</text></svg>">
<style nonce="${nonce}">${CSS}</style>
</head>
<body>
<main>
<figure class="escena">${escenaSvg(P.alt)}</figure>
<h1>${esc(P.titulo)}</h1>
<p class="gancho">${esc(P.gancho)}</p>
<p>${esc(P.intro)}</p>
<div class="comando"><code id="cmd">${comando}</code><button type="button" id="copiar">${esc(P.copiar)}</button></div>
<p class="nota">${esc(P.nota)}</p>
<span class="sr" role="status" id="aviso"></span>
<ul class="trofeos" aria-label="Finales">${trofeos}</ul>
<p>${negociacion}</p>
<p class="chico">${esc(P.coleccion)} <a href="/coleccion">${esc(P.coleccionLink)}</a>.</p>
</main>
<script nonce="${nonce}">
const b = document.getElementById("copiar"), aviso = document.getElementById("aviso");
b.addEventListener("click", async () => {
	let txt = ${js(P.copiado)};
	try { await navigator.clipboard.writeText(document.getElementById("cmd").textContent); } catch { txt = ${js(P.copiarFallo)}; }
	b.textContent = txt; aviso.textContent = txt;
	setTimeout(() => { b.textContent = ${js(P.copiar)}; }, 1600);
});
</script>
</body>
</html>
`;
}
