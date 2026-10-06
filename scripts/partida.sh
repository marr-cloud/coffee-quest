#!/usr/bin/env bash
# Juega los tres finales de Coffee Quest con curl real, como lo haría un jugador.
# Uso: scripts/partida.sh [URL]   (por defecto http://localhost:8787)
set -euo pipefail

BASE="${1:-http://localhost:8787}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
JAR="$TMP/cookies.txt"

# esperar <código> <descripción> <args de curl...>: corta el script si el código no coincide.
esperar() {
	local esperado="$1" desc="$2"
	shift 2
	local codigo
	codigo="$(curl -sS -b "$JAR" -c "$JAR" -o "$TMP/cuerpo" -D "$TMP/headers" -w '%{http_code}' "$@")"
	if [[ "$codigo" != "$esperado" ]]; then
		echo "FALLO  $desc: esperaba $esperado, llegó $codigo"
		cat "$TMP/cuerpo"
		exit 1
	fi
	echo "ok $codigo  $desc"
}

header() { grep -i "^$1:" "$TMP/headers" | head -n 1 | cut -d' ' -f2- | tr -d '\r'; }

camino() {
	rm -f "$JAR"
	esperar 200 "1 planta baja" "$BASE/"
	esperar 200 "2 recepción" "$BASE/recepcion?nombre=Prueba&piso=3"
	esperar 200 "3 ascensor" "$BASE/ascensor"
	esperar 301 "4 piso 3" "$BASE/piso/3"
	R1="$(header X-Receta-1)"
	esperar 200 "5 cocina (HEAD)" -I "$BASE/piso/3/cocina"
	esperar 200 "6 solicitud" -H "Content-Type: application/json" -d '{"motivo": "prueba", "urgencia": 10}' "$BASE/rrhh/solicitud"
	printf 'firma: Prueba\n' >"$TMP/formulario.txt"
	esperar 200 "7 formulario" -F "formulario=@$TMP/formulario.txt" "$BASE/rrhh/formulario"
	R2="$(header X-Receta-2)"
	esperar 200 "8 TI" -u becario:cafeina123 "$BASE/ti/maquina"
	TOKEN="$(grep -o 'ti_[A-Za-z0-9_-]*' "$TMP/cuerpo" | head -n 1)"
	esperar 200 "9 config" -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"modo": "barista"}' "$BASE/ti/maquina/config"
	esperar 200 "10 bloqueo" -X DELETE -H "Authorization: Bearer $TOKEN" "$BASE/ti/maquina/bloqueo"
	R3="$(header X-Receta-3)"
	esperar 200 "11 pedido" --data-urlencode "pedido=leche=si & azucar=no" "$BASE/cafetera/pedido"
	R4="$(header X-Receta-4)"
}

BREW=(-H "X-HTTP-Method-Override: BREW" -H "Content-Type: message/coffeepot" -H "Accept-Additions: leche" -d start)

echo "== Final 418"
camino
esperar 418 "12 BREW" "${BREW[@]}" "$BASE/cafetera"

echo "== Final 218"
camino
esperar 218 "12 BREW + X-Mood" "${BREW[@]}" -H "X-Mood: this is fine" "$BASE/cafetera"
curl -sS --http1.1 -b "$JAR" -o /dev/null -D "$TMP/h11" "${BREW[@]}" -H "X-Mood: this is fine" "$BASE/cafetera"
echo "   línea de estado en HTTP/1.1: $(head -n 1 "$TMP/h11" | tr -d '\r')"

echo "== Final 200"
camino
esperar 200 "incidente ack" -X POST "$BASE/incidente/ack"
R5="$(header X-Receta-5)"
esperar 200 "12 BREW + X-Receta" "${BREW[@]}" -H "X-Receta: $R1,$R2,$R3,$R4,$R5" "$BASE/cafetera"

echo "== Extras"
echo "   -X BREW directo: $(curl -sS -o /dev/null -w '%{http_code}' -b "$JAR" -X BREW "$BASE/cafetera" || echo "sin respuesta") (en el edge se espera 501)"
esperar 200 "portada HTML" -H "Accept: text/html" "$BASE/"
grep -q "<svg" "$TMP/cuerpo" || { echo "FALLO  la portada no trae la escena"; exit 1; }
esperar 200 "colección resuelta" "$BASE/coleccion?spoilers=si"
echo "Listo: los tres finales funcionan contra $BASE"
