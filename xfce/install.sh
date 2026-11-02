#!/bin/sh
# Installs System Pulse for the XFCE panel in ~/.local/bin, without sudo, and adds
# a Generic Monitor (xfce4-genmon-plugin) item running it to the first panel.
# --uninstall removes those items and the script.

set -eu

usage() {
    echo "Usage: install.sh [--no-panel | --uninstall]"
}

add_panel=true
uninstall=false
while [ $# -gt 0 ]; do
    case $1 in
        --no-panel) add_panel=false; shift ;;
        --uninstall) uninstall=true; shift ;;
        -h|--help) usage; exit 0 ;;
        *) usage >&2; exit 2 ;;
    esac
done

source_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
bin_dir=${XDG_BIN_HOME:-$HOME/.local/bin}
target=$bin_dir/system-pulse-genmon
plugins=${SYSTEM_PULSE_PANEL_PLUGINS:-/usr/lib/*/xfce4/panel/plugins /usr/lib/xfce4/panel/plugins}

manual() {
    cat <<EOF
Para adicionar ao painel do XFCE:
  1. Clique com o botão direito no painel → Painel → Adicionar novos itens.
  2. Escolha "Monitor Genérico" (Generic Monitor).
  3. Nas propriedades do item:
       Comando: $target
       Rótulo: desmarcado
       Período: 2 segundos

Opções do comando: --mode both|cpu|ram, --count 1-20, --process-every N.
EOF
}

genmon_installed() {
    for dir in $plugins; do
        [ -e "$dir/libgenmon.so" ] && return 0
    done
    return 1
}

panel_query() {
    xfconf-query -c xfce4-panel "$@" 2>/dev/null
}

# Array values come one per line after a "Value is an array" header.
panel_array() {
    panel_query -p "$1" | grep -E '^[0-9]+$'
}

# Creates a genmon plugin in xfconf, appends it to the first panel and restarts
# the panel so it loads. Returns 1 when the panel configuration is not reachable.
add_to_panel() {
    command -v xfconf-query >/dev/null 2>&1 || return 1
    panel=$(panel_array /panels | head -n 1)
    [ -n "$panel" ] || return 1

    ids=$(panel_array "/panels/panel-$panel/plugin-ids" || true)
    last=0
    for id in $(panel_query -l | sed -n 's|^/plugins/plugin-\([0-9][0-9]*\)$|\1|p') $ids; do
        if ours "$id"; then
            echo "O painel já tem o System Pulse (plugin-$id)."
            return 0
        fi
        [ "$id" -le "$last" ] || last=$id
    done
    id=$((last + 1))

    panel_query -p "/plugins/plugin-$id" -n -t string -s genmon &&
        panel_query -p "/plugins/plugin-$id/command" -n -t string -s "$target" &&
        panel_query -p "/plugins/plugin-$id/use-label" -n -t bool -s false &&
        panel_query -p "/plugins/plugin-$id/update-period" -n -t int -s 2000 || return 1

    set --
    for existing in $ids; do
        set -- "$@" -t int -s "$existing"
    done
    panel_query -p "/panels/panel-$panel/plugin-ids" -n -a "$@" -t int -s "$id" || return 1

    echo "Adicionado ao painel $panel como plugin-$id."
    if ! xfce4-panel -r >/dev/null 2>&1; then
        echo "Não consegui reiniciar o painel; ele aparece no próximo login."
    fi
}

# True when plugin-$1 is a genmon item running this script.
ours() {
    [ "$(panel_query -p "/plugins/plugin-$1")" = genmon ] &&
        [ "$(panel_query -p "/plugins/plugin-$1/command")" = "$target" ]
}

# Drops our items from every panel and from xfconf, then restarts the panel.
remove_from_panel() {
    command -v xfconf-query >/dev/null 2>&1 || return 1
    panels=$(panel_array /panels) || return 1
    removed=
    for panel in $panels; do
        set --
        changed=false
        for id in $(panel_array "/panels/panel-$panel/plugin-ids" || true); do
            if ours "$id"; then
                removed="$removed $id"
                echo "Removido do painel $panel (plugin-$id)."
                changed=true
            else
                set -- "$@" -t int -s "$id"
            fi
        done
        $changed || continue
        if [ $# -gt 0 ]; then
            panel_query -p "/panels/panel-$panel/plugin-ids" -n -a "$@"
        else
            panel_query -p "/panels/panel-$panel/plugin-ids" -r
        fi
    done
    if [ -z "$removed" ]; then
        echo "Nenhum item do System Pulse no painel."
        return 0
    fi
    # genmon saves its settings again while the panel restarts, so they are
    # cleared once the old instance is gone.
    if xfce4-panel -r >/dev/null 2>&1; then
        sleep 2
    else
        echo "Não consegui reiniciar o painel; ele some no próximo login."
    fi
    for id in $removed; do
        panel_query -p "/plugins/plugin-$id" -r -R || true
    done
}

if $uninstall; then
    remove_from_panel || echo "Não encontrei a configuração do painel do XFCE; remova o item à mão, se houver."
    for state in "${XDG_RUNTIME_DIR:-/nonexistent}/system-pulse-genmon" "/tmp/system-pulse-genmon-$(id -u)"; do
        rm -f "$state" "$state.processes"
    done
    rm -f "$target"
    echo "Removido $target"
    exit 0
fi

mkdir -p "$bin_dir"
cp "$source_dir/system-pulse-genmon.sh" "$target.tmp"
chmod 755 "$target.tmp"
mv -f "$target.tmp" "$target"

echo "Instalado em $target"
echo

if ! genmon_installed; then
    echo "Falta o plugin Monitor Genérico. Instale com:"
    echo "  sudo apt install xfce4-genmon-plugin"
    echo "e rode este instalador de novo para adicionar o item ao painel."
    echo
    manual
elif ! $add_panel; then
    manual
elif ! add_to_panel; then
    echo "Não encontrei a configuração do painel do XFCE (rode dentro da sessão XFCE)."
    echo
    manual
fi
