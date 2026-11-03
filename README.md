# Calendário da Mesa

## Sobre como este módulo foi feito

Sei que parte da comunidade não gosta de módulos produzidos com IA, então prefiro ser transparente: este foi desenvolvido com ajuda de IA. Não sou programador.

Tudo começou quando um amigo me disse: “cara, ficou muito mais simples, é só fazer uma macro do que você quer”. Fiz a macro para a minha mesa, fui adaptando conforme a necessidade dos jogos e, no fim, ela virou um módulo. Uso nas minhas próprias sessões e resolvi compartilhar caso seja útil para mais alguém.

Se encontrar bugs ou tiver sugestões, abra uma [issue](https://github.com/Daphenius/calendario-mesa/issues). Todo retorno é bem-vindo.

---

**Versão 4.10.0** · Foundry VTT 14 · D&D 5e 6 · Português e English · Licença MIT · ✅ Testado no Foundry VTT e no D&D 5e

![Calendário da Mesa no Foundry VTT: janela do calendário](docs/screenshot.png)

Calendário próprio do mundo para Foundry VTT, usando o **tempo nativo do Foundry** (o mesmo relógio que avança nas rodadas de combate). Traz HUD com relógio, luz do mapa por hora, estações, eras, luas com fases, clima por região (inclusive pelas Regiões nativas do mapa), contadores e prazos, viagem dia a dia com vigias, histórico da campanha, vários calendários e notas guardadas como Diários nativos. Funciona sozinho ou junto com o **Journal da Mesa**.

> O Calendário da Mesa é um projeto independente. Alguns extras foram inspirados no estilo do Calendaria, mas o projeto não é afiliado a ele nem a seu autor. Simple Calendar, Seasons & Stars, Calendaria e Fantasy-Calendar.com aparecem neste README só porque o módulo importa calendários nesses formatos.

- [Galeria](#galeria)
- [Compatibilidade](#compatibilidade)
- [Instalação e atualização](#instalação-e-atualização)
- [Suporte e sugestões](#suporte-e-sugestões)
- [Primeiro uso](#primeiro-uso)
- [O calendário](#o-calendário) · [HUD](#hud) · [Luz do mapa](#luz-do-mapa) · [Notas e eventos](#notas-e-eventos)
- [Clima](#clima)
- [Contadores, viagem, histórico e lojas](#contadores-e-prazos)
- [D&D 5e](#dd-5e)
- [API para macros e outros módulos](#api-para-macros-e-outros-módulos)
- [Arquivos](#arquivos) · [Licença e créditos](#licença-e-créditos) · [English summary](#english-summary)

## Galeria

| HUD | Clima do dia | Luas |
|---|---|---|
| [![HUD com data, hora, estação e luas](docs/hud.png)](docs/hud.png) | [![Janela do clima com os tempos da estação](docs/clima.png)](docs/clima.png) | [![Luas com fases e ciclos de aparição](docs/luas.png)](docs/luas.png) |
| **Integrado ao Journal da Mesa** | **Efeitos de clima** | **Regiões de clima** |
| [![Nota do calendário aberta no Journal da Mesa](docs/journal-da-mesa.png)](docs/journal-da-mesa.png) | [![Efeitos de clima com prévia na cena](docs/clima-efeitos.png)](docs/clima-efeitos.png) | [![Configuração das regiões de clima](docs/clima-configuracoes.png)](docs/clima-configuracoes.png) |
| **Luz por hora** | **Central de Configurações** | **Configurações** |
| [![Luz do mapa por hora do dia](docs/luz-por-hora.png)](docs/luz-por-hora.png) | [![Central de Configurações em abas](docs/central-configuracoes.png)](docs/central-configuracoes.png) | [![Configurações do módulo](docs/configuracoes.png)](docs/configuracoes.png) |

Clique numa imagem para ver em tamanho maior.

## Compatibilidade

| | Mínimo | Testado |
|---|---|---|
| Foundry VTT | 14 | 14.369 |
| D&D 5e | — | 6.x |

Cada versão é testada pelo autor dentro do Foundry VTT e do D&D 5e antes de ser publicada. Como em qualquer módulo, faça backup do mundo antes de atualizar.

O Foundry 13 não é suportado; quem ainda usa o Foundry 13 pode ficar na 4.2.1 ([releases](https://github.com/Daphenius/calendario-mesa/releases)). Em outros sistemas o calendário usa o calendário nativo do Foundry, mas só foi testado no D&D 5e.

## Instalação e atualização

### Instalar pelo Foundry (recomendado)

1. No Foundry, vá em **Módulos Complementares → Instalar Módulo**.
2. No campo **URL do Manifesto**, cole:

   ```
   https://github.com/Daphenius/calendario-mesa/releases/latest/download/module.json
   ```

3. Clique em **Instalar**, entre no mundo e ative **Calendário da Mesa** em *Gerenciar Módulos*.

Instalado assim, o Foundry avisa quando houver versão nova e atualiza pelo botão de atualizar. **Depois de atualizar, feche e abra o mundo de novo** (só F5 não carrega arquivos novos do módulo).

### Instalar ou atualizar manualmente

1. Baixe `calendario-mesa.zip` na [página de releases](https://github.com/Daphenius/calendario-mesa/releases).
2. Apague a pasta `Data/modules/calendario-mesa` (se já existir) e extraia o ZIP nela (a pasta precisa ter esse nome).
3. Reinicie o Foundry e ative **Calendário da Mesa** em *Gerenciar Módulos* no seu mundo.

O calendário, as notas, o clima e o histórico ficam salvos no mundo, não na pasta do módulo, e são mantidos entre versões.

### Módulos recomendados (opcionais)

- **Journal da Mesa**: notas do calendário editadas no Journal da Mesa, dia e horário das lojas, Linha do tempo, dias sagrados das divindades e Nexus mudando o clima.
- **FXMaster**: presets e partículas para os efeitos de clima.

Use só um módulo de calendário por vez: com Simple Calendar, Seasons & Stars ou Calendaria ativos junto, os dois tentam controlar a data do mundo. Para trazer um calendário de um deles, use **Importar do mundo** (veja abaixo) e depois desative o outro módulo.

## Suporte e sugestões

Encontrou um problema ou tem uma ideia? Abra uma [Issue no GitHub](https://github.com/Daphenius/calendario-mesa/issues) com:

- versão do **Foundry VTT**, do sistema (**D&D 5e**) e do **Calendário da Mesa**;
- outros módulos ativos que possam estar envolvidos (Journal da Mesa, FXMaster, outros módulos de calendário…);
- **passo a passo** para o problema acontecer, o que você esperava e o que aconteceu;
- a **mensagem de erro** do console (aperte **F12**, aba *Console*), se houver;
- se o problema for de clima, o resultado de `game.modules.get("calendario-mesa").api.diagnosticoClima()` no console;
- se possível, uma captura de tela.

---

## Primeiro uso

1. No HUD (barra no topo da tela), clique na engrenagem ⚙ para abrir o **editor**.
2. Na barra azul do topo, escolha um modelo (**Exemplo dos Elementos**, **Gregoriano**) ou um calendário do Foundry/deste mundo e troque nomes de meses, dias da semana, estações e luas.
3. Clique em **Salvar calendário**.
4. Abra o calendário (📅), escolha o dia em que a campanha está e clique em **Tornar este o dia atual**. Clique na hora do HUD para acertar o horário.

As opções do módulo ficam na **Central de Configurações** (Configurações → Calendário da Mesa → Abrir Central de Configurações, ou pelo HUD), organizadas em abas: Geral, Tempo, Clima, Anomalias, Astronomia e luz, Eventos e diários e Ferramentas.

## O calendário

### Janela do calendário

- **‹ ›** mudam o mês e **« »** mudam o ano. **Hoje** volta para o dia atual do jogo.
- **Clique no ano** (ao lado do nome do mês) para abrir o painel de anos: 12 anos de cada vez, com « » para ir 12 anos para trás ou para frente. Clique num ano para ir até ele (no mesmo mês), ou digite o ano em **Ir para o ano** e aperte Enter. O ano atual do jogo fica marcado. O painel só muda o que a janela mostra; para mudar a data do jogo, escolha um dia e use **Tornar este o dia atual**.

### Editor

- A barra azul reúne seus calendários, os modelos e os calendários do Foundry/deste mundo, mais **Novo**, **Duplicar**, **Tornar principal**, **Apagar**, **Importar arquivo** e **Exportar**. Modelos e importações abrem como um calendário novo; nada é salvo até clicar em Salvar, e **Salvar** mantém o editor aberto.
- **Tab** passa para o próximo campo (nome do mês → abreviação → dias...).

### Anos, eras e ano bissexto

- **Primeiro ano**: o ano mostrado no tempo 0 do mundo. **Sufixo padrão**: usado nos anos fora de qualquer era.
- **Ano bissexto**: ligado, aparece "bissexto a cada N anos, começando no ano X" e a coluna **Dias no bissexto** nos meses. Desligado, todo ano tem o mesmo número de dias (o intervalo fica guardado para quando ligar de novo).
- **Eras**: nome, sufixo, ano inicial e ano final (vazio = sem fim). Contagem pelo **ano do mundo** ("1023 E.E.") ou **desde o início da era** (a era que começa em 1000 mostra 1003 como "4 E.E."). Se duas eras se sobrepõem, vale a que começa primeiro.
- **Data atual do jogo**: escolha dia, mês, ano e hora e clique em **Ir para esta data**.

### Meses que aparecem e somem

Cada mês tem uma linha 👁: **aparece a cada** X anos **e fica** Y anos, **a partir de** um ano exibido (o botão ⌖ começa o ciclo neste ano). Com 0, o mês existe todo ano. Ex.: "Mês das Sombras" a cada 7 anos, fica 1 ano, a partir de 1021 → só existe em 1021, 1028, 1035... Nos anos em que o mês não existe, o calendário pula direto para o mês seguinte (grade, navegação, datas e o tempo do Foundry). Funciona junto com o ano bissexto.

### Estações

Cada estação tem o **dia e o mês em que começa** e termina sozinha no dia antes de a próxima começar (a coluna **Termina** mostra isso); pode virar o ano. O nascer e o pôr do sol de cada estação valem para a luz do mapa, o HUD e o D&D 5e.

Para o clima, cada estação é entendida como primavera, verão, outono ou inverno pelo nome e pelo ícone (em português ou inglês, ex.: "Winter", "Colheita", floco de neve); se não reconhecer, vale a posição da estação no ano (a 2ª de 4 estações conta como verão).

### Luas

- **Fases**: cada lua tem a sua lista (abra "Fases" embaixo da lua no editor). O padrão são 8, da lua nova à minguante. Renomeie, adicione ou remova; a primeira é sempre a lua nova. **Duração relativa**: uma fase com 2 dura o dobro das outras. A grade do mês marca os dias de lua nova e de lua cheia.
- **Luas que aparecem e somem** (linha 👁): **aparece a cada** X dias, meses ou anos **e fica** Y (cada um com sua unidade). Fora do céu, a lua some do HUD e da grade e não ilumina a noite. O mestre vê quando ela volta; os jogadores só veem com a opção "Jogadores sabem quando uma lua volta".
- **Eventos das luas** no chat: luas cheias juntas, eclipses (chance por ciclo configurável, sempre nos mesmos dias) e noites sem luas. O eclipse solar pode mudar o clima do dia.

### Vários calendários (civilizações)

- Cada calendário tem meses, semana, estações, luas e **eventos próprios**. O tempo do mundo é um só; cada civilização só conta ele do seu jeito (o mesmo dia pode ser "14 de Brasa de 1023" num e "3 de B5 de 523" no outro).
- **Calendário da cena**: botão 🏛 no HUD ou "Calendário da cena" na janela. Quem está naquela cena vê o calendário, a data e os eventos dela.
- **Ver como**: na janela do calendário, cada pessoa pode escolher outro calendário ou deixar no Automático (segue a cena; sem escolha na cena, o principal).
- O Foundry (e o sistema) contam o tempo sempre pelo **calendário principal**, igual para todos; "ver como" e o calendário da cena só mudam o que o módulo mostra naquele computador. O que vale para o mundo todo também segue o principal: a luz do mapa, o clima do dia e a previsão, a virada do dia (dia das lojas do Journal, semana nova) e os eventos das luas. Avisos e ações das notas seguem o calendário de cada nota.
- Notas novas ficam no calendário que estava aberto. Notas sem calendário (ou de um calendário apagado) ficam no principal.

### Quando o calendário muda

Ao salvar mudanças num calendário (mais dias num mês, meses a mais ou a menos...), as notas dele **continuam na mesma data**: "5 de Brasa" continua "5 de Brasa". Se o mês ou o dia deixarem de existir, a nota vai para o último que existir. Dá para desligar isso na hora de salvar. Mudar a quantidade de horas do dia muda a data mostrada para o mesmo momento salvo.

### Importar de outros calendários

- **Importar arquivo**: JSON do Simple Calendar, Seasons & Stars, Fantasy-Calendar.com, do formato do Foundry (usado pelo Calendaria e pelo D&D 5e) e do próprio Calendário da Mesa. O formato é reconhecido sozinho.
- **Importar do mundo**: os calendários já carregados neste mundo — Simple Calendar, Seasons & Stars ou Calendaria ativos, os calendários prontos do D&D 5e (Harptos, Greyhawk...) e o que estava em uso antes deste módulo.
- Nada é salvo na hora: o calendário abre no editor com um resumo do que precisou ser adaptado (meses intercalares viram meses normais; bissextos com exceções, como o gregoriano, viram "a cada N anos"; as luas mantêm o ciclo e a data da lua nova).

### Datas nos textos

Em qualquer Diário, `@Data[14 de Brasa de 1023]` vira um link que abre o calendário naquele dia (também aceita `@Data[14/Brasa/1023]`, `@Data[14 de Brasa]` e `@Data[1023-6-14]`; para outro texto, `@Data[14 de Brasa de 1023]{o festival}`). `@Hoje` mostra a data atual do jogo.

## HUD

- Data, dia da semana, hora com segundos, estação, clima e a fase de cada lua. A faixa colorida no topo mostra o sol ou a lua andando pelo céu; **arraste o sol/lua** para mudar a hora (mestre). Clicar na hora abre o campo para digitar (HH:MM ou HH:MM:SS).
- Botões do mestre: voltar/avançar 1 dia, 1 hora ou 10 minutos; ir até o amanhecer, meio-dia, anoitecer ou meia-noite; descanso longo (8 h); **desfazer o último pulo** (volta o tempo e restaura o clima, o histórico, os contadores e o dia do Journal).
- ▶ **Relógio em tempo real**: o tempo anda sozinho (velocidade configurável). Para quando o jogo é pausado e durante o combate (configurável). Os segundos andam na tela entre um passo e outro.
- ◐ **Dia/noite da cena**: liga em cada cena que deve seguir a luz do calendário.
- Arraste pela alça ⋮⋮ para mudar de lugar. **Clique duplo** (fora dos botões): completo → **mini** → **oculto** (uma bolinha 📅) → completo. Cada pessoa escolhe o seu.
- Jogadores veem o HUD sem os controles; dá para mostrar só "Manhã/Tarde/Noite/Madrugada" em vez da hora exata.
- **Pulo cinematográfico**: ao avançar muito tempo de uma vez (padrão: 24 horas ou mais), todos veem as datas passando em tela cheia. Cada jogador pode desligar só para si.

## Luz do mapa

Central › Astronomia e luz → **Luz por hora**. Usa a escuridão nativa da cena, sem iluminação extra, e só vale nas cenas com o dia/noite ligado (◐ no HUD); cenas com a escuridão travada são ignoradas.

- Um controle para cada hora do dia (0% = escuridão total, 100% = dia claro); entre uma hora e outra a luz segue uma curva suave.
- **Luz da lua cheia**: quanto a lua mais clara no céu ilumina a noite. Sem lua no céu, ou com lua nova, a noite fica totalmente escura.
- **Cor da noite**: branco-azulado por padrão. Uma lua de cor forte (como a Lua Rubra) tinge a noite com a cor dela.
- **Saltos de tempo**: em pulos de até 6 horas, a luz passa hora a hora até chegar no horário; em pulos maiores, a escuridão vai direto (com uma transição suave) para a luz final, numa gravação só.
- **Névoa de guerra com o dia e a noite** (opção): de dia o mapa todo visível; à noite, só a visão dos tokens e as luzes.
- Para não pesar no servidor, os passos pequenos (relógio em tempo real, +10 min) só mexem nas cenas que alguém está vendo e só quando a luz muda o bastante; com o relógio em tempo real, no máximo uma gravação a cada 30 s.

## Notas e eventos

- Cada nota é um **Diário nativo** do Foundry, numa pasta (padrão **Calendário**, ou a que você escolher; opção de subpastas por ano). Clique num dia → **Nova nota**.
- **Quem cria e edita as notas** (configuração): **Journal da Mesa (quando ativo)**, o padrão — "Nova nota" cria a página do evento naquele dia e abre no Journal da Mesa, que cuida de data, hora, repetição, ícone, cor, aviso e texto; ou **Calendário** — o diálogo do próprio calendário (hora, duração em dias, ícone — os mesmos 107 do Journal da Mesa, em grupos e com prévia —, cor, quem vê, aviso e pasta). Sem o Journal da Mesa ativo, o calendário sempre usa o próprio diálogo.
- **Repetição**: criada no Journal da Mesa (a cada N dias, semanas, meses ou anos; até uma data ou depois de N vezes; com dias pulados). O calendário mostra o evento em todos os dias em que acontece (grade, painel do dia, próximos 30 dias e avisos).
- **Quando chegar o dia**: aviso só para o mestre ou para todos no chat. **Ações** da nota na hora marcada: rodar uma macro, tocar um som ou ativar uma cena.
- **Arraste qualquer Diário** para um dia e ele vira uma nota daquele dia; arraste uma nota para outro dia para mudar a data. 📅 **Tirar do calendário** mantém o Diário; 🗑 apaga.
- **Dias sagrados**: no painel do calendário, escolha uma divindade do Journal da Mesa (ou escreva o nome), o nome do festival, o dia e o mês. Vira uma nota anual com o ícone 🙏.

## Clima

- Botão de clima no HUD (☁ com a temperatura). O clima de cada região é rolado todo dia conforme a **estação** e a **região**, com mínima e máxima, dias atípicos e ondas de calor ou de frio, e avisado no chat (ninguém, só o mestre ou todos). Temperatura em °C ou °F.
- **Janela do clima** (abas):
  - **Tempo de hoje**: escolha o tempo pelos cartões, role de novo ou role só a temperatura; ajuste no controle deslizante. Aqui também se escolhe a **região desta cena** e se a cena mostra o efeito do clima.
  - **Previsão**: os próximos dias (3 a 7, configurável), que o mestre pode ajustar; quando o dia chega, o clima sai da previsão.
  - **Climas**: 23 tipos de tempo de fábrica e os seus (grupo, ícone, efeito na cena, temperatura e descrição). Em **Efeitos**, crie variações dos efeitos (cor, força, velocidade, tamanho, direção, dois efeitos juntos) com prévia na cena antes de salvar; há também efeitos de tela de aurora, calor tremulando, relâmpagos e eclipse.
  - **Regiões**: Temperada, Tropical, Deserto, Ártica, Montanha e os quatro **Reinos dos Elementos**; edite as de fábrica ou crie as suas (temperatura por estação, variação ± e a chance de cada tempo por estação).
  - **Anomalias** (elemento drenado): forçam ou trocam o tempo e mudam a temperatura, com texto para os jogadores. **Usar como região** cria uma região com o nome da anomalia. Anomalia cobrindo uma região inteira é opcional, e a aba some com as anomalias desligadas.
- **Efeito na cena**: chuva, neve, neblina etc. pelo clima nativo do Foundry, ou pelo **FXMaster** (preset ou partícula) quando ele está ativo. Cenas sem região própria usam a **região padrão** (ou só as marcadas, configurável).

### Clima pelas Regiões do mapa (nativo)

Para o mapa-múndi:
1. Na cena do mapa, use a ferramenta nativa de **Regiões** e desenhe uma área (um país, uma costa, o deserto...).
2. Na configuração da Região, em **Comportamentos**, adicione **Clima (Calendário da Mesa)** e escolha a região do clima.
3. Quando um token de jogador entra na área, ela passa a ditar o clima do mapa (HUD, efeito e aviso no chat). Ao sair de todas as áreas de clima, volta para a região da cena ou a padrão.

Tokens de NPC não mudam o clima; nada roda o tempo todo (só reage quando um token do grupo entra ou sai). Combina com o comportamento nativo **Suprimir clima** (cavernas, casas). Cada área pode desligar o efeito visual ou o aviso no chat.

## Contadores e prazos

Botão ⏳ no HUD: "O ritual se completa daqui a 3 dias", "Efeito da poção: 8 horas"... Cada contador mostra quanto falta; ao terminar, avisa no chat (só o mestre ou todos) e entra no histórico. Pode ser visível para os jogadores ou só para o mestre; +1h e +1d para estender.

**Efeitos com duração vencidos** (Central › Tempo): quando o tempo passa, o calendário pode remover ou desativar da ficha os efeitos ativos (magias, venenos…) cuja duração acabou. O padrão é "Não mexer". A conferência acontece a cada mudança de tempo; com o relógio em tempo real andando, uma vez por minuto do jogo (o relógio avança a cada 5 s).

## Viagem

- Botão 🧭 no HUD: destino, distância (km, milhas ou léguas), ritmo (lento, normal, rápido) e horas de viagem por dia. O tempo avança as horas de estrada e as noites de descanso; a luz do mapa acompanha. Encontros: chance por dia e, se quiser, uma tabela de rolagem (rolada em segredo). Resumo no chat e no histórico.
- **Passar os dias separadamente**: a viagem é conduzida um dia de cada vez, com horário de partida e das vigias, +30 min, +1 hora e "Até as 20:00", e uma caixa de **Narração** que vai para o chat e o histórico.
- **Vigias da noite**: o mestre escolhe quantas vigias (2 horas cada) e quais jogadores; cada jogador escolhe a sua no painel **Vigias**, na tela de todos (o mestre escolhe pelos jogadores offline). **Próxima vigia** avança 2 horas; o registro vai para o histórico.
- **Tabelas de encontro**: escolha nas configurações quais tabelas aparecem na janela de viagem.

## Histórico da campanha

Botão 📜 no HUD. Registra sozinho: sessões de jogo, eventos que começaram, clima de cada dia, viagens, prazos que terminaram, anomalias e saltos de tempo. O mestre pode **anotar** o que aconteceu e **criar um Diário** "Histórico da campanha" para os jogadores lerem. A janela guarda os 400 registros mais recentes; os mais antigos vão para a página **Arquivo** desse Diário. Opção para os jogadores verem o histórico.

## Lojas abertas e fechadas

O painel lateral do calendário mostra **Lojas agora**: cada loja do Journal da Mesa ou do Monk's com "aberta até 17:00" ou "fechada · abre 08:00". Lojas do Journal da Mesa seguem o **horário e os dias de folga** configurados nela (sem horário ligado, fica sempre aberta); loja só do Monk's usa a abertura e o fechamento dele. O **dia das ofertas diárias** acompanha o calendário, e o mestre recebe um aviso quando começa uma **nova semana** (para renovar o estoque).

## D&D 5e

Toda a integração com o sistema fica em `scripts/compat-dnd5e.js` e usa só o que o D&D 5e documenta ([wiki do sistema](https://github.com/foundryvtt/dnd5e/wiki/Calendar)):

- O calendário usa como base o calendário do próprio D&D 5e, e o sistema não carrega o calendário dele (o escolhido nas configurações do D&D aparece em **Importar do mundo**).
- **Recuperação "por dia", "ao amanhecer" e "ao anoitecer"**: o D&D usa o nascer e o pôr do sol das estações deste calendário, e a contagem de dias, amanheceres e anoiteceres que passaram é refeita dia a dia (funciona com meses que somem e com o nascer do sol mudando por estação).
- **HUD do D&D 5e**: escondido por padrão, para não ter dois relógios na tela. Dá para mostrar nas configurações do módulo ("HUD de calendário do D&D 5e"; precisa recarregar). "Definir data" do HUD do D&D funciona também com meses que aparecem e somem.
- Se uma versão nova do sistema mudar essas peças, o módulo avisa no console (F12) e segue funcionando sem aquela parte.

---

## API para macros e outros módulos

```js
const cal = game.modules.get("calendario-mesa").api;   // pronta depois do "ready"
```

**Convenções.** `td` é o número do dia desde o tempo zero do mundo (o mesmo que as notas gravam). Ano "exibido" é com o ano inicial do calendário (ex.: 1023); ano "interno" conta de 0. Em `datas.*` o mês conta de 0 e o dia de 1; em `irPara`, mês e dia contam de 1. Funções que gravam (avançar o tempo, anomalias, contadores…) só fazem efeito para o mestre. A descrição de cada chamada também está em `scripts/api.js`.

### Janelas

| Chamada | O que faz |
|---|---|
| `abrir()` | abre a janela do calendário |
| `editor()` | abre o editor do calendário (mestre) |
| `central()` | abre a Central de Configurações |
| `viajar()` | abre a janela da viagem (ou o diálogo para começar uma) |
| `diaSagrado()` | abre o diálogo "Dia sagrado" |

### Tempo e datas

| Chamada | O que faz / devolve |
|---|---|
| `agora()` | `{ td, ano (interno), anoExibido, mes, dia (de 0), sem, doy, wt, hora, minuto, horaDec, texto }` |
| `avancar(segundos)` | avança o tempo do mundo |
| `avancarAte(horaDecimal)` | avança até a próxima vez que o relógio marcar a hora (`6.5` = 06:30) |
| `irPara(ano, mes, dia)` | vai para a data (ano exibido; mês e dia contando de 1), mantendo a hora |
| `desfazer()` | desfaz o último pulo de tempo |
| `estacao()` | estação de hoje (`{ nome, mesInicio, diaInicio, nascer, por, icone }`) ou `null` |
| `era()` | era do ano atual ou `null` |
| `textoAno(anoInterno?)` | texto do ano com a era (ex.: `"1023 E.E."`) |
| `textoDia(td)` | texto da data (ex.: `"Dia da Água, 3 de Brasa de 1023 E.E."`) |
| `config()` | cópia da configuração do calendário em uso (meses, semana, luas, estações, eras…) |
| `calendarioAtual()` | `{ id, nome }` do calendário em uso neste computador |
| `calendarios()` | `[{ id, nome, principal }]` de todos os calendários do mundo |
| `converter(json)` | converte o JSON de outro módulo de calendário para este formato (Promise) |
| `datas.hoje()` | `td` de hoje |
| `datas.partes(td)` | `{ td, ano, anoInterno, mes, dia, sem, nomeMes, nomeSemana, texto, textoCurto, textoAno, era }` |
| `datas.tdDe(ano, mes, dia)` | `td` da data (ano exibido, mês de 0, dia de 1), ou `null` se ela não existe |
| `datas.meses(ano?)` | meses do ano exibido: `[{ i, nome, dias, existe }]` |
| `datas.semana()` | nomes dos dias da semana |

### Notas

Cada nota é um Diário com os dados em `flags["calendario-mesa"].nota`:

```js
{
  td: 12345,                 // dia do mundo em que começa
  hora: "18:30",             // ou ""
  repetir: "semanas",        // nao | dias | semanas | meses | anos
  cada: 2,
  diasSemana: [0, 3],        // índices dos dias da semana (para semanas)
  modoMes: "semana",         // dia | semana | ultima (para meses e anos)
  duracao: 3,                // em dias
  fim: { tipo: "vezes", td: 12345, vezes: 6 },   // nunca | data | vezes
  excecoes: [12359],         // dias de início pulados
  cor: "#c9a227", icone: "fa-star", aviso: "nenhum",   // aviso: nenhum | mestre | todos
  cal: "padrao"              // id do calendário (sem ele: o principal)
}
```

| Chamada | O que faz / devolve |
|---|---|
| `notasDoDia(td?)` | Diários das notas que acontecem no dia (inclusive as que repetem) |
| `notas.ler(diario)` | dados da nota (já corrigidos) ou `null` |
| `notas.normalizar(dados)` | corrige/completa dados crus (aceita o formato antigo: anual, mensal…) |
| `notas.descrever(diario)` | frase da repetição (ex.: "A cada 2 semanas: Dia da Água, até 3 de Brasa de 1024") |
| `notas.proximas(diario, qtd = 5)` | próximas vezes a partir de hoje: `[{ td, texto }]` |
| `notas.acontece(diario, td?)` | a nota acontece (ou está em andamento) neste dia? |
| `notas.nova(td?)` | nova nota pelo editor escolhido nas configurações |
| `notas.editar(diario)` | edita pelo editor escolhido nas configurações |
| `notas.dialogo(td?, diario?)` | sempre o diálogo do próprio calendário |
| `notas.dataDe(td)` | texto da data (igual a `textoDia`) |
| `notas.calendario(diario)` | id do calendário da nota, ou `null` se não for nota |

### Luas

| Chamada | O que faz / devolve |
|---|---|
| `luas()` | luas com fase e visibilidade de hoje: `[{ nome, ciclo, cor…, fase, p, idx, nova, cheia, iluminacao, visivel, … }]` |
| `eventosLuas(td?)` | eventos das luas no dia (eclipses, luas cheias juntas, noite sem luas), com `texto` |
| `proximosEventosLuas(dias = 120)` | próximos eventos (até 20), procurando até `dias` à frente |

### Clima

| Chamada | O que faz / devolve |
|---|---|
| `zonas()` | regiões do clima: `[{ id, nome }]` |
| `clima(zona?)` | clima de hoje na região (padrão: a da cena): `{ zona, tipo, nome, temp, min, max, onda?, anomalia }` |
| `previsao()` | cópia da previsão: `{ dias: { td: { zona: { tipo, temp, min, max } } } }` |
| `gerarPrevisao({ refazer }?)` | rola os dias da previsão que faltam (`refazer: true` refaz todos) |
| `diagnosticoClima()` | mostra no console como o clima está sendo decidido em cada cena |
| `anomalias()` | anomalias (vazio com a barra desligada): `[{ id, nome, icone, regiao }]` |
| `modoAnomalias()` | `{ ligadas, regiaoInteira }` |
| `anomaliaRegiao(id, ligar = true)` | liga/desliga o "Usar como região" da anomalia (o jeito do Nexus do Journal) |
| `anomalia(zona, tipo, texto?)` | liga a anomalia numa região inteira (`tipo` = `null` desliga); exige a opção "cobrindo uma região inteira" |

### Contadores, histórico, lojas, efeitos e viagem

| Chamada | O que faz / devolve |
|---|---|
| `contadores()` | `[{ id, nome, fim, tdFim, feito, visivel }]` (o jogador vê só os visíveis) |
| `contador(nome, segundos, { visivel, aviso }?)` | cria um contador que termina daqui a `segundos` (`aviso`: nenhum, mestre ou todos) |
| `registrar(texto, icone?)` | acrescenta uma linha ao histórico (ícone Font Awesome, ex.: `"fa-dragon"`) |
| `historico()` | cópia do histórico da campanha |
| `historicoVisivel()` | o usuário atual pode ver o histórico? |
| `lojaAberta(diario)` | a loja está aberta agora? |
| `lojaFechadaPor(diario)` | `"folga"`, `"horario"` ou `null` (aberta) |
| `horarioLoja(diario)` | `{ ativo, abre, fecha (minutos do dia), folga: [dias da semana] }` ou `null` |
| `expirarEfeitos()` | aplica agora a regra "Efeitos com duração vencidos" |
| `viagem()` | cópia da viagem em andamento, ou `null` |

### Eventos (hooks)

```js
Hooks.on("calendarioMesa.novoDia", (dia, quantos) => { /* dia = { td, ano, mes, dia, sem, doy } */ });
Hooks.on("calendarioMesa.novaSemana", (dia, semanas) => { /* quantas semanas começaram */ });
```

---

## Arquivos

| Arquivo | Para quê |
|---|---|
| `module.json` | manifesto do módulo |
| `scripts/calendario.js` | entrada: registra as configurações e os menus, aplica o calendário e liga os hooks do Foundry |
| `scripts/nucleo.js`, `scripts/datas.js` | tradução, configuração do calendário, vários calendários, dias, meses, anos e textos de data |
| `scripts/luas.js`, `scripts/luz.js`, `scripts/relogio.js` | luas, luz do mapa por hora, passagem do tempo, efeitos vencidos e relógio em tempo real |
| `scripts/notas.js`, `scripts/historico.js`, `scripts/contadores.js`, `scripts/lojas.js`, `scripts/viagem.js` | notas e eventos, histórico, contadores, horário das lojas, viagem e vigias |
| `scripts/clima.js`, `scripts/clima-efeitos.js`, `scripts/clima-cenas.js` | clima do dia e previsão, efeitos visuais, clima nas cenas e nas Regiões |
| `scripts/janela.js` | HUD e janela do calendário |
| `scripts/api.js` | API pública, com a descrição de cada chamada |
| `scripts/compat-dnd5e.js` | integração com o D&D 5e |
| `scripts/socket.js` | pedidos dos jogadores ao mestre (escolha de vigia) |
| `scripts/central.js`, `scripts/central-mapa.js` | Central de Configurações |
| `scripts/sob-demanda.js`, `scripts/ferramentas.js`, `scripts/ferramentas/` | editor, importação, clima, histórico, contadores, viagem e dias sagrados, carregados só na primeira vez que alguém abre uma dessas janelas; luz por hora e tabelas de encontro carregam junto, porque o menu das configurações abre essas duas |
| `templates/` | modelos Handlebars (Central e Contadores) |
| `styles/` | visual |
| `lang/` | português e inglês, chaves legíveis por área (`CALMESA.Luz.…`, `CALMESA.Clima.…`) |
| `tools/`, `tests/` | script da migração das chaves de tradução e testes (`node --test`: traduções, divisão em arquivos e carga num Foundry simulado); ficam no repositório, não vão no ZIP |
| `CHANGELOG.md` | o que mudou em cada versão, em linguagem simples |
| `LICENSE` | licença MIT |
| `docs/` | imagens deste README |
| `.github/workflows/release.yml` | monta e anexa o ZIP e o `module.json` ao publicar uma release |

---

## Licença e créditos

Distribuído sob a **licença MIT**: você pode usar, copiar, modificar e redistribuir, inclusive em projetos comerciais, desde que mantenha o aviso de copyright e a licença. Veja o arquivo [`LICENSE`](LICENSE).

Copyright © 2026 Daphenius.

Idealizado e desenvolvido por Daphenius, com auxílio de Claude e ChatGPT na elaboração, revisão e refatoração do código. A definição das funcionalidades, as decisões do projeto e os testes dentro do Foundry VTT foram realizados pelo autor.

Calendaria, Simple Calendar, Seasons & Stars, Fantasy-Calendar.com, FXMaster e Monk's Enhanced Journal pertencem a seus respectivos autores e são citados aqui só para explicar a compatibilidade e a importação.

---

## English summary

**Calendário da Mesa** is a world calendar for Foundry VTT 14 built on Foundry's native time: an HUD with clock and day/night bar, scene lighting by hour, seasons with sunrise and sunset, eras and leap years, months and moons that appear and disappear on cycles, moon phases and lunar events, weather by region (including native Scene Regions on a world map), countdowns, day-by-day travel with night watches, a campaign history, multiple calendars per world, and notes stored as native Journal Entries. It can import calendars from Simple Calendar, Seasons & Stars, Calendaria, Fantasy-Calendar.com and Foundry's own format, and it integrates with **Journal da Mesa** (shops, timeline, holy days and Nexus weather). This is an independent project, not affiliated with Calendaria. The interface is available in Portuguese and English. A macro API is available at `game.modules.get("calendario-mesa").api` (documented above and in `scripts/api.js`).

Every version is tested by the author in Foundry VTT with D&D 5e before release. Install from Foundry with the manifest URL `https://github.com/Daphenius/calendario-mesa/releases/latest/download/module.json` (or extract the release ZIP into `Data/modules/calendario-mesa`) and enable it. After updating, relaunch the world. Issues and suggestions: [GitHub Issues](https://github.com/Daphenius/calendario-mesa/issues). Licensed under MIT.

**How this module was made:** I know part of the community doesn't like AI-made modules, so I'd rather be transparent: this one was developed with the help of AI. I'm not a programmer. It started as a macro for my own table, grew as our games needed more, and ended up as a module. I use it in my own sessions and decided to share it in case it's useful to someone else. If you find bugs or have suggestions, please open an issue. All feedback is welcome.
