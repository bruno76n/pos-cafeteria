#!/usr/bin/env bash
# Hook "Stop" de Claude Code.
# Mientras docs/04-plan.md tenga tareas "- [ ]", le pide a Claude que siga trabajando.
#
# Frenos para no quedarse en un ciclo infinito:
#   - Si existe .claude/DETENER, deja parar   (touch .claude/DETENER)
#   - Si en 4 paradas seguidas no bajó el número de pendientes, deja parar.
#
# Probarlo a mano:  echo '{}' | bash .claude/hooks/seguir-si-hay-pendientes.sh

set -u

cat > /dev/null 2>&1 || true   # consumir el JSON que manda Claude Code por stdin

DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
PLAN="$DIR/docs/04-plan.md"
ESTADO="$DIR/.claude/.hook-estado"
LIMITE_SIN_AVANCE=4

[ -f "$DIR/.claude/DETENER" ] && exit 0
[ -f "$PLAN" ] || exit 0

PENDIENTES=$(grep -cE '^[[:space:]]*- \[ \]' "$PLAN" 2>/dev/null || true)
case "$PENDIENTES" in ''|*[!0-9]*) exit 0 ;; esac

if [ "$PENDIENTES" -eq 0 ]; then
  rm -f "$ESTADO"
  exit 0
fi

ANTERIOR=""
SIN_AVANCE=0
if [ -f "$ESTADO" ]; then
  read -r ANTERIOR SIN_AVANCE < "$ESTADO" || true
fi
case "$SIN_AVANCE" in ''|*[!0-9]*) SIN_AVANCE=0 ;; esac

if [ "$ANTERIOR" = "$PENDIENTES" ]; then
  SIN_AVANCE=$((SIN_AVANCE + 1))
else
  SIN_AVANCE=0
fi
echo "$PENDIENTES $SIN_AVANCE" > "$ESTADO"

if [ "$SIN_AVANCE" -ge "$LIMITE_SIN_AVANCE" ]; then
  exit 0
fi

printf '{"decision":"block","reason":"Quedan %s tareas pendientes en docs/04-plan.md. Continúa con la siguiente sin preguntar, siguiendo el ciclo de CLAUDE.md (verificar, marcar [x], bitácora, commit). Si una tarea está bloqueada, márcala [~] con el motivo en docs/bitacora.md y pasa a la siguiente."}\n' "$PENDIENTES"
exit 0
