#!/bin/sh
# System Pulse for the XFCE panel, through the Generic Monitor (genmon) plugin.
# Prints CPU and RAM for the panel and memory, swap and the top processes by RSS
# in the tooltip. POSIX sh + awk only: genmon starts it on every refresh, so the
# process list, the only expensive part, is cached between refreshes.

set -u

usage() {
    cat <<'EOF'
Usage: system-pulse-genmon [--mode both|cpu|ram] [--count 1-20] [--process-every 1-3600]

  --mode           metrics shown in the panel (default: both)
  --count          processes listed in the tooltip (default: 5)
  --process-every  refresh the process list every N runs (default: 5)
EOF
}

fail() {
    usage >&2
    exit 2
}

integer() {
    case $1 in ''|*[!0-9]*) return 1 ;; esac
    [ "$1" -ge "$2" ] && [ "$1" -le "$3" ]
}

mode=both
count=5
process_every=5

while [ $# -gt 0 ]; do
    case $1 in
        --mode) [ $# -ge 2 ] || fail; mode=$2; shift 2 ;;
        --count) [ $# -ge 2 ] || fail; count=$2; shift 2 ;;
        --process-every) [ $# -ge 2 ] || fail; process_every=$2; shift 2 ;;
        -h|--help) usage; exit 0 ;;
        *) fail ;;
    esac
done

case $mode in both|cpu|ram) ;; *) fail ;; esac
integer "$count" 1 20 || fail
integer "$process_every" 1 3600 || fail

proc=${SYSTEM_PULSE_PROC:-/proc}
if [ -n "${SYSTEM_PULSE_STATE:-}" ]; then
    state=$SYSTEM_PULSE_STATE
elif [ -n "${XDG_RUNTIME_DIR:-}" ]; then
    state=$XDG_RUNTIME_DIR/system-pulse-genmon
else
    state=/tmp/system-pulse-genmon-$(id -u)
fi
cache=$state.processes
limit=20

case ${LC_ALL:-${LC_MESSAGES:-${LANG:-}}} in
    pt*) language=pt ;;
    *) language=en ;;
esac

# Same number format as the GNOME extension, whatever the locale.
LC_NUMERIC=C
export LC_NUMERIC

monitor=
for candidate in xfce4-taskmanager gnome-system-monitor mate-system-monitor; do
    if command -v "$candidate" >/dev/null 2>&1; then
        monitor=$candidate
        break
    fi
done

# Writes the top processes by RSS to the cache.
refresh_processes() {
    # One grep reads the resident pages of every PID; PIDs that exit meanwhile are skipped.
    top=$(grep -H '' "$proc"/[0-9]*/statm 2>/dev/null | awk -v limit="$limit" -v page="$(getconf PAGESIZE 2>/dev/null || echo 4096)" '
        {
            at = index($0, "/statm:")
            if (at == 0) next
            pid = substr($0, 1, at - 1); sub(/^.*\//, "", pid)
            values = substr($0, at + 7)
            if (pid !~ /^[0-9]+$/ || values !~ /^[0-9]+ [0-9]+/) next
            resident = substr(values, index(values, " ") + 1); sub(/ .*$/, "", resident)
            count++; pids[count] = pid; kib[count] = resident * page / 1024
        }
        END {
            for (shown = 0; shown < limit && shown < count; shown++) {
                best = 0
                for (i = 1; i <= count; i++) {
                    if (!(i in taken) && (best == 0 || kib[i] > kib[best])) best = i
                }
                taken[best] = 1
                print pids[best], kib[best]
            }
        }')

    {
        if [ -n "$top" ]; then
            set --
            while read -r pid _; do
                set -- "$@" "$proc/$pid/comm"
            done <<EOF
$top
EOF
            # Names first, then the ranking, so awk can join them in order.
            { grep -H '' "$@" 2>/dev/null; printf '%s\n' "$top"; } | awk '
                index($0, "/comm:") {
                    at = index($0, "/comm:"); pid = substr($0, 1, at - 1); sub(/^.*\//, "", pid)
                    names[pid] = substr($0, at + 6)
                    next
                }
                ($1 in names) { printf "%d\t%s\n", $2, names[$1] }'
        fi
    } >"$cache.tmp" && mv -f "$cache.tmp" "$cache"
}

[ -e "$cache" ] || refresh_processes

previous=
if [ -r "$state" ]; then
    read -r previous <"$state" || true
fi

# The only command on a regular run. It saves the next CPU sample and a run counter
# in the state file and exits with 3 when the process list is due for a refresh.
awk -v stat="$proc/stat" -v meminfo="$proc/meminfo" -v cache="$cache" -v statefile="$state" \
    -v previous="$previous" -v every="$process_every" \
    -v mode="$mode" -v count="$count" -v language="$language" -v monitor="$monitor" '
function round(value) { return int(value + 0.5) }
function gib(kib) { return sprintf("%.1f GiB", kib / 1048576) }
function escape(text) {
    gsub(/&/, "\\&amp;", text); gsub(/</, "\\&lt;", text); gsub(/>/, "\\&gt;", text)
    return text
}
function message(key) { return language == "pt" ? pt[key] : en[key] }
function fill(text, a, b) { sub(/\{1\}/, a, text); sub(/\{2\}/, b, text); return text }

BEGIN {
    pt["cpu_unavailable"] = "CPU: leitura indisponível."
    en["cpu_unavailable"] = "CPU: reading unavailable."
    pt["cpu_waiting"] = "CPU: calculando…"
    en["cpu_waiting"] = "CPU: calculating…"
    pt["cpu"] = "CPU: {1}% em uso · média de {2} CPUs lógicas"
    en["cpu"] = "CPU: {1}% in use · average of {2} logical CPUs"
    pt["ram_unavailable"] = "RAM: leitura indisponível."
    en["ram_unavailable"] = "RAM: reading unavailable."
    pt["ram"] = "RAM: {1} usados de {2} utilizáveis"
    en["ram"] = "RAM: {1} used of {2} usable"
    pt["swap_unavailable"] = "Swap: leitura indisponível."
    en["swap_unavailable"] = "Swap: reading unavailable."
    pt["swap_none"] = "Swap: não configurada"
    en["swap_none"] = "Swap: not configured"
    pt["swap"] = "Swap: {1} usados de {2}"
    en["swap"] = "Swap: {1} used of {2}"
    pt["processes"] = "Processos · RAM (RSS)"
    en["processes"] = "Processes · RAM (RSS)"
    pt["processes_unavailable"] = "Leitura indisponível"
    en["processes_unavailable"] = "Reading unavailable"
    pt["rss"] = "RSS inclui páginas compartilhadas."
    en["rss"] = "RSS includes shared pages."
    pt["click"] = "Clique para abrir o monitor do sistema."
    en["click"] = "Click to open the system monitor."

    # guest/guest_nice are already included in user/nice.
    cpus = 0; valid = 0
    while ((getline line < stat) > 0) {
        if (line ~ /^cpu[ \t]/) {
            fields = split(line, value, /[ \t]+/)
            valid = fields >= 9
            total = 0
            for (i = 2; i <= 9 && valid; i++) {
                if (value[i] !~ /^[0-9]+$/) valid = 0
                total += value[i]
            }
            idle = value[5] + value[6]
        } else if (line ~ /^cpu[0-9]+[ \t]/) {
            cpus++
        }
    }
    close(stat)
    if (cpus == 0) valid = 0

    split(previous, last, " ")
    cpu_text = "—"; cpu_details = message("cpu_unavailable")
    if (valid) {
        cpu_text = "…"; cpu_details = message("cpu_waiting")
        delta_total = total - last[1]; delta_idle = idle - last[2]
        if (last[3] == cpus && delta_total > 0 && delta_idle >= 0 && delta_idle <= delta_total) {
            percent = round((delta_total - delta_idle) / delta_total * 100)
            cpu_text = percent "%"
            cpu_details = fill(message("cpu"), percent, cpus)
        }
    }
    # The list was just built when there is no previous run.
    run = (last[4] ~ /^[0-9]+$/ ? last[4] + 1 : 1) % every
    if (valid) print total, idle, cpus, run > statefile
    else print "x x 0", run > statefile
    close(statefile)

    while ((getline line < meminfo) > 0) {
        if (split(line, value, /[ \t]+/) == 3 && value[2] ~ /^[0-9]+$/ && value[3] == "kB") {
            key = value[1]; sub(/:$/, "", key); memory[key] = value[2] + 0; seen[key] = 1
        }
    }
    close(meminfo)

    ram_text = "—"
    ram_details = message("ram_unavailable"); swap_details = message("swap_unavailable")
    if (seen["MemTotal"] && seen["MemAvailable"] && seen["SwapTotal"] && seen["SwapFree"] &&
        memory["MemTotal"] > 0 && memory["MemAvailable"] <= memory["MemTotal"] &&
        memory["SwapFree"] <= memory["SwapTotal"]) {
        used = memory["MemTotal"] - memory["MemAvailable"]
        ram_text = round(used / memory["MemTotal"] * 100) "%"
        ram_details = fill(message("ram"), gib(used), gib(memory["MemTotal"]))
        if (memory["SwapTotal"] == 0) swap_details = message("swap_none")
        else swap_details = fill(message("swap"), gib(memory["SwapTotal"] - memory["SwapFree"]), gib(memory["SwapTotal"]))
    }

    if (mode == "cpu") panel = "CPU " cpu_text
    else if (mode == "ram") panel = "RAM " ram_text
    else panel = "CPU " cpu_text " · RAM " ram_text

    tooltip = cpu_details "\n" ram_details "\n" swap_details "\n\n<b>" message("processes") "</b>"
    shown = 0
    while (shown < count && (getline line < cache) > 0) {
        tab = index(line, "\t")
        if (tab == 0) continue
        shown++
        tooltip = tooltip sprintf("\n<tt>%10.1f MiB</tt>  %s", substr(line, 1, tab - 1) / 1024, escape(substr(line, tab + 1)))
    }
    close(cache)
    if (shown == 0) tooltip = tooltip "\n" message("processes_unavailable")
    tooltip = tooltip "\n<small>" message("rss") "</small>"

    printf "<txt>%s</txt>", panel
    if (monitor != "") {
        tooltip = tooltip "\n<small>" message("click") "</small>"
        printf "<txtclick>%s</txtclick>", monitor
    }
    printf "<tool>%s</tool>\n", tooltip
    exit run == 0 ? 3 : 0
}'

[ $? -ne 3 ] || refresh_processes

exit 0
