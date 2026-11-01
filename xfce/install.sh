#!/bin/sh
# Installs System Pulse for the XFCE panel in ~/.local/bin, without sudo.
# The panel item itself is the Generic Monitor plugin (xfce4-genmon-plugin).

set -eu

source_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
bin_dir=${XDG_BIN_HOME:-$HOME/.local/bin}
target=$bin_dir/system-pulse-genmon

mkdir -p "$bin_dir"
cp "$source_dir/system-pulse-genmon.sh" "$target.tmp"
chmod 755 "$target.tmp"
mv -f "$target.tmp" "$target"

echo "Instalado em $target"
echo

if ! ls /usr/lib/*/xfce4/panel/plugins/libgenmon.so /usr/lib/xfce4/panel/plugins/libgenmon.so >/dev/null 2>&1; then
    echo "Falta o plugin Monitor Genérico. Instale com:"
    echo "  sudo apt install xfce4-genmon-plugin"
    echo
fi

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
