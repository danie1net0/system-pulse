# System Pulse

Anteriormente chamado RAM Widget. O nome exibido agora é **System Pulse**.
O UUID `ram-widget@local`, o schema e o caminho GSettings, e o identificador do
atalho instalado são mantidos por compatibilidade: suas preferências, ativação
e favoritos continuam válidos. O diretório deste checkout pode continuar com
o nome antigo; a instalação não depende do nome da pasta do projeto.

Extensão para GNOME Shell 50, escrita em TypeScript. Mostra CPU e RAM na barra
superior e, no menu, RAM utilizável, swap e ranking de processos por RAM ou CPU.

## Recursos

- Ranking por **RAM (RSS)** ou **CPU (atividade recente)**, selecionável no menu.
- **Preferências…**: intervalo de 1–60 segundos, 1–20 processos e barra com CPU,
  RAM ou ambos. As alterações são persistidas e aplicadas imediatamente.
- **Abrir Monitor do Sistema** abre o aplicativo do GNOME.
- **Remover da barra** desativa o widget; o atalho com mascote o adiciona novamente.

O padrão é CPU e RAM na barra, atualização a cada 2 segundos e 5 processos por RAM.

## Instalar

Com Node.js 24 ou superior e npm disponíveis, execute na pasta do projeto:

```sh
node install.ts
```

O instalador verifica GNOME Shell 50 e as dependências, executa `npm ci` e o build,
copia somente os arquivos de execução, instala o mascote e cria o atalho
**System Pulse — Adicionar à barra**. Ao final, tenta habilitar a extensão.
Também pode ser executado com `npm run setup`.

Para incluir o Monitor do Sistema no Ubuntu/Debian:

```sh
node install.ts --with-system-monitor
```

Execute o instalador **sem sudo**. Apenas essa opção usa `sudo apt-get` e pede sua
senha quando o Monitor não está instalado. As demais dependências ausentes são
informadas antes da instalação; Node.js não é instalado automaticamente.

Para manter o projeto conectado à instalação durante o desenvolvimento:

```sh
node install.ts --dev
```

O modo normal instala uma cópia independente do projeto. Se já existir um link
de desenvolvimento, ele será substituído por essa cópia. Use `--dev` para manter
o comportamento de editar, compilar e recarregar diretamente deste checkout.

Outras opções:

```sh
node install.ts --skip-build                  # usa um build já preparado; sem npm ci
node install.ts --skip-build --dest-dir /tmp/system-pulse-teste
node install.ts --help
```

`--dest-dir` instala em uma pasta alternativa, sem ativar a extensão ou atualizar
o catálogo de aplicativos da sessão. É útil para validar a instalação.

A instalação normal usa `$XDG_DATA_HOME` quando é um caminho absoluto, ou
`~/.local/share` por padrão. Em atualizações, a instalação anterior, o ícone e o
atalho são preservados em `system-pulse/backups/` dentro desse diretório. O arquivo
`restore.json` do backup indica o destino original de cada item. Se ocorrer erro
durante a substituição, o instalador tenta restaurar automaticamente os arquivos
anteriores. As preferências GSettings são preservadas.

Se o GNOME ainda não reconhecer a extensão, entre novamente na sessão e abra o
atalho. Para atualizar código já carregado, reabra o GNOME de teste ou entre
novamente na sessão principal; o instalador não encerra sua sessão.

## Preparar e compilar

Requer GNOME Shell 50, Node.js 24 ou superior, npm, `ps` (procps) e
`glib-compile-schemas` (libglib2.0-bin no Ubuntu).

```sh
npm ci
npm run build
```

O build compila `src/` para `build/`, gera os pontos de entrada `extension.js` e
`prefs.js` na raiz e compila o schema GSettings. O link da instalação para a raiz
do projeto continua válido. Não edite os arquivos gerados.

Para recompilar TypeScript enquanto desenvolve:

```sh
npm run watch
```

O watch recompila o código, mas o GNOME ainda precisa recarregar a extensão em
uma nova sessão de teste. Depois de alterar o XML do schema, execute o build
completo novamente. Preferências alteradas pela interface não precisam de build
nem reinício.

O Monitor do Sistema é opcional. Neste computador, sua instalação depende de
uma confirmação administrativa no terminal:

```sh
sudo apt install gnome-system-monitor
```

Sem esse aplicativo, o botão informa como instalá-lo.

## Organização e tipagem

| Arquivo ou pasta | Responsabilidade |
| --- | --- |
| `src/extension.ts` | Entrada do GNOME; cria e descarta o controlador |
| `src/controller.ts` | Ciclo de vida, temporizador e atualização da interface |
| `src/data/` | DTOs em classes separadas, com propriedades readonly, para dados entre camadas |
| `src/domain/` | Parsers, cálculos, ranking e tipos de seleção; sem dependência do GNOME |
| `src/presenters/` | Formatação e tradução das métricas para os DTOs de apresentação |
| `src/services/` | Amostragem de CPU/memória e consulta assíncrona de processos |
| `src/platform/` | Leitura de arquivos e integração com o Monitor do Sistema |
| `src/ui/` | Indicador, linhas de processos e tela de preferências |
| `src/settings.ts` | Chaves e leitura tipada das configurações |
| `src/prefs.ts` | Entrada da janela de preferências |
| `schemas/` | Definição e limites das preferências persistidas |
| `scripts/build.ts` | Build em TypeScript |
| `install.ts` e `scripts/installer/` | Instalador, opções, verificações e atualização com backup |
| `assets/system-pulse.png` | Mascote distribuído com o instalador |
| `tests/` | Testes em TypeScript dos cálculos e casos de borda |

Todo o código-fonte próprio, incluindo instalador, build e testes, está em TypeScript.
`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` e
`noImplicitOverride` estão habilitados, sem `any`, supressões de erro ou
asserções de não nulidade no código próprio. As APIs externas usam `@girs`
para GNOME Shell 50. `skipLibCheck` evita checar internamente as declarações
dessas dependências; o uso delas pelo projeto continua sendo verificado.
Tipagem não substitui a validação em execução dos dados de `/proc`.

As funções livres usam arrow functions, estruturas de controle têm chaves e o fluxo
usa retornos antecipados. Imports do GNOME Shell são diretos; os módulos `gi://`
mantêm o import padrão exigido pelo GJS. Os serviços coletam dados e o presenter
produz os textos. A interface usa gettext com o domínio `system-pulse`; sem catálogo
instalado, as mensagens originais em português continuam sendo exibidas.

As dependências npm são usadas somente no desenvolvimento. O GNOME executa o
JavaScript compilado usando GJS; Node.js e `node_modules` não participam da execução
do widget. GTK/Adwaita são carregados apenas no processo de preferências.

## Como interpretar os valores

CPU total é a média de todas as CPUs lógicas, de 0 a 100%, calculada pela diferença
entre duas leituras de `/proc/stat`. Tempo ocioso e espera de I/O ficam fora do uso.
`guest` e `guest_nice` já estão incluídos nos demais contadores e não são somados
novamente. Na primeira leitura aparece `…`.

A CPU de cada processo usa a diferença de `utime + stime` em `/proc/PID/stat`,
dividida pelo avanço dos contadores totais. **100% representa a capacidade total
do computador**: em 8 CPUs lógicas, uma CPU completamente ocupada representa
aproximadamente 12,5%. Isso pode diferir de ferramentas que mostram 100% por CPU.
A leitura é feita no intervalo recente, e não pela média desde a criação do processo.
Reuso de PID, mudança na quantidade de CPUs e regressão de contadores reiniciam a
amostragem. Processos sem duas amostras válidas mostram `…` e ficam no final do ranking
por CPU. A lista considera processos com RSS maior que zero.

A RAM usada é `MemTotal - MemAvailable`. O total utilizável exclui reservas de
hardware e do sistema e pode ser menor que a RAM instalada. A swap usada é
`SwapTotal - SwapFree`; se não houver swap, o menu informa isso.

RSS inclui páginas compartilhadas: somar as linhas não corresponde ao consumo
total de RAM. Cada PID aparece individualmente, mesmo quando vários processos
pertencem ao mesmo aplicativo.

Processos são consultados somente com o menu aberto. A abertura inicia uma nova
amostragem de CPU; a porcentagem aparece após o próximo intervalo. A leitura é
assíncrona, com concorrência limitada; fechar o menu ou desativar a extensão cancela
consultas pendentes. Desativar também remove o temporizador e os sinais de preferências.

## Verificar

```sh
npm run typecheck  # código da extensão, preferências, build e testes
npm test           # domínio, DTOs, interface, serviços e instalador
npm run coverage   # exige 100% de linhas, branches e funções no código executado
npm run check      # tipagem, cobertura obrigatória e build completo
```

Os testes cobrem CPU ociosa/ocupada, I/O, guest, hotplug, regressão de contadores,
memória inconsistente, swap, nomes de processos com parênteses, reuso de PID,
ranking e modos da barra. Os testes do instalador cobrem cópia, atualização com backup,
link de desenvolvimento, caminhos com espaços, rollback, falha na restauração e opções inválidas.
A cobertura usa o V8 do Node.js, incluindo `src/`, `scripts/` e `install.ts`,
sem exclusões por comentários. Os arquivos que contêm apenas tipos não têm código de execução.

Os testes de controlador, serviços, menus e preferências usam simuladores tipados das
APIs do GNOME em `tests/support/`; não abrem janelas nem alteram a sessão real.
As operações de arquivos do instalador usam diretórios temporários reais; comandos
externos são simulados. A verificação visual em GNOME 50 continua sendo feita no
ambiente de teste descrito abaixo.

## Experimentar

Com `node install.ts --dev`, `~/.local/share/gnome-shell/extensions/ram-widget@local`
é um link para a pasta deste projeto. Na instalação normal, é uma cópia independente.

```sh
gnome-extensions enable ram-widget@local
gnome-extensions info ram-widget@local
```

Se a extensão ainda não for reconhecida, salve seu trabalho, encerre a sessão
do GNOME e entre novamente. Depois, execute o comando de ativação.
Em Wayland, alterações no JavaScript de uma extensão já carregada na barra
principal precisam de uma nova sessão para que o GNOME leia o código atualizado.
Desativar e reativar a extensão não recarrega esse código. Para desenvolver
sem encerrar a sessão principal, use o ambiente em janela descrito abaixo.

## Remover e adicionar novamente

Abra o menu do widget e clique em **Remover da barra**. Isso desativa a extensão,
interrompe as atualizações e mantém os arquivos instalados.

Para adicionar novamente, pressione **Super**, pesquise **System Pulse** e abra
**System Pulse — Adicionar à barra**. O atalho está instalado neste computador
com o ícone do mascote. Você também pode fixá-lo nos favoritos do GNOME.

O arquivo do atalho é `system-pulse-enable.desktop`; sua cópia instalada fica
em `~/.local/share/applications/ram-widget-enable.desktop`. Ele apenas ativa
a extensão e pode ser usado mesmo se ela já estiver habilitada.

Outra opção é abrir o aplicativo **Extensões** do GNOME e ativar **System Pulse**,
ou executar no terminal da sessão em que deseja exibi-lo:

```sh
gnome-extensions enable ram-widget@local
```

Reativar uma versão já carregada não exige sair da sessão. Se estiver usando
o GNOME de teste, execute o comando dentro dele. O widget permanece desativado
até você reativá-lo, inclusive após sair e entrar na sessão.

Também é possível removê-lo da barra pelo terminal:

```sh
gnome-extensions disable ram-widget@local
```

## Desenvolver sem encerrar a sessão principal

No GNOME 50 com Wayland, é possível abrir um GNOME de teste dentro de uma
janela. A cada alteração no código, reinicie apenas esse ambiente de teste.

1. Instale o suporte de desenvolvimento no Ubuntu (apenas uma vez):

   ```sh
   sudo apt install mutter-dev-bin
   ```

2. Em um terminal do desktop principal, abra o GNOME de teste:

   ```sh
   dbus-run-session gnome-shell --devkit --wayland
   ```

3. Dentro da janela do GNOME de teste, abra um terminal e ative a extensão:

   ```sh
   gnome-extensions enable ram-widget@local
   gnome-extensions info ram-widget@local
   ```

4. Edite os arquivos em `src/` e execute `npm run build`. Feche a janela do GNOME de teste e
   repita o passo 2 para carregar a nova versão. Se necessário, ative a
   extensão novamente dentro dela.

O desktop principal continua aberto. As mensagens de diagnóstico do GNOME
de teste aparecem no terminal usado para iniciá-lo. Essa janela usa os
arquivos do mesmo usuário; não é uma máquina virtual isolada.

Referências: [primeira extensão](https://gjs.guide/extensions/development/creating.html),
[menus](https://gjs.guide/extensions/topics/popup-menu.html)
e [recarregamento e depuração](https://gjs.guide/extensions/development/debugging.html#reloading-extensions).
