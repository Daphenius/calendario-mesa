# Histórico de versões — Calendário da Mesa

## 4.3.1

- **Testada e aprovada pelo autor no Foundry VTT 14 e no D&D 5e** antes da publicação.
- **Efeitos com duração vencidos: o padrão agora é "Não mexer".** Antes, o módulo vinha removendo da ficha os efeitos (magias, venenos…) cuja duração acabou, sem ninguém pedir. Quem quer que o calendário cuide disso escolhe "Remover da ficha" ou "Desativar" na Central › Tempo. Quem já tinha a opção salva não muda nada. A checagem também ficou mais leve: acontece quando o minuto do jogo muda, não a cada tique de 5 s do relógio em tempo real.
- **"Sessão de jogo" no histórico só uma vez por sessão**: recarregar a página (F5) não registra outra. Uma nova sessão entra quando a última tem mais de 6 horas de tempo real ou é de outro dia.
- **Escuridão travada na cena respeitada**: o módulo conferia um campo com o nome errado, então mexia na luz de cenas com a escuridão travada pelo mestre.
- **Estações com nomes próprios no clima**: uma estação cujo nome e ícone não lembram primavera, verão, outono ou inverno (ex.: "Época das Chuvas") deixava o clima sempre em "primavera". Agora vale a posição dela no ano (explicado no README, seção Estações).
- **Nascer e pôr do sol arredondados certo**: 6,999 h aparecia como 06:00; agora 07:00.
- **Vários calendários**: ao trocar de calendário ou mudar as luas, os cálculos guardados das luas (eclipses, luas cheias juntas) e do fim das séries de notas são refeitos, em vez de reaproveitar os do calendário anterior.
- **Eclipses**: o sorteio usa o id da lua quando ela tem um; sem id, continua pelo nome, então os eclipses já vistos não mudam de lugar.
- **Tradução**: 26 textos que ainda apareciam em português para quem joga em inglês (avisos como "Nenhuma cena aberta", "sempre aberta"/"folga hoje" nas lojas, dicas do HUD, título da janela do calendário, avisos da viagem, das vigias, da importação e dos editores do clima) agora passam pela tradução.
- Erros engolidos em silêncio agora aparecem no console (F12) com um aviso curto; comentários repetidos e estilos sem uso foram tirados.
- README: as seções "Novidades da 4.x" (que repetiam este arquivo) saíram; ficou só o link. O ZIP da release não leva mais a pasta `docs` (as imagens só servem ao README no GitHub).
- Nenhum id ou valor salvo mudou; só o padrão de "Efeitos com duração vencidos" para quem nunca mexeu nele.

## 4.3.0

- **Testada e aprovada pelo autor no Foundry VTT 14 e no D&D 5e** antes da publicação.
- **Só Foundry 14**: a versão mínima passou de 13 para 14. Saíram os caminhos de reserva que só existiam para versões antigas (AudioHelper, FilePicker, saveDataToFile, FullCanvasObjectMixin e Scene globais, e o HTML em jQuery na aba de Diários); o módulo usa direto as APIs do Foundry 14. Quem está no Foundry 13 pode continuar na 4.2.1.
- **Inglês completo**: antes, só as configurações e alguns avisos tinham tradução, e o resto aparecia em português para quem joga em inglês. Agora o HUD, a janela do calendário, o editor, a luz por hora, o clima (tempo de hoje, regiões, climas, efeitos e anomalias), a previsão, os contadores, a viagem e as vigias, o histórico, os dias sagrados, a importação, a Central de Configurações, os avisos no chat e as mensagens de erro passam pela tradução (cerca de 1.000 textos novos em `lang/en.json` e `lang/pt-BR.json`).
  - Os textos de fábrica (climas, regiões, anomalias, fases da lua, ícones, o calendário de exemplo e os efeitos de clima do Calendário) aparecem no idioma de quem joga. O que o mestre criou ou editou fica como foi escrito.
  - Datas, repetições ("A cada 2 semanas…"), prazos, durações e pulos de tempo agora são montados no idioma certo, e as listas são ordenadas pelo idioma do jogo.
  - As pastas de notas que o módulo cria ("Calendário" e "Ano 1023") continuam com o mesmo nome em qualquer idioma, para os mundos não ganharem pastas duplicadas.
- Nenhuma configuração, id ou valor salvo mudou.

## 4.2.1

- **Testada e aprovada pelo autor no Foundry VTT e no D&D 5e** antes da publicação.
- O módulo Journal agora se chama **Journal da Mesa**, e o calendário usa o nome novo nos botões, dicas, configurações, Central de Configurações e avisos do chat, em português e inglês. O `id` da integração continua `journal-mesa`, então nada muda nos mundos.
- Tema "Vitoriano (LOTD)" renomeado para **Vitoriano** (o valor salvo continua o mesmo, então quem usava o tema não perde a escolha).
- Pronto para publicar no GitHub: licença MIT, `module.json` com Daphenius como autor e links de manifesto, download, licença, README, changelog e Issues.
- Automação de release: ao publicar uma release, o GitHub monta `calendario-mesa.zip` (com o `module.json` na raiz) e anexa os dois arquivos.
- README: seção "Sobre como este módulo foi feito", compatibilidade, instalação pelo manifesto, suporte e sugestões, licença e créditos, aviso de que o projeto é independente do Calendaria, resumo em inglês e imagem no topo.
- Sem mudança de funcionamento.

## 4.2.0

Ligação com o Journal 4.6: Nexus e Linha do tempo.

### Nexus (anomalias)
- Desde a 2.10 a anomalia cobrindo uma região inteira vem **desligada**, e os limiares dos Nexus só usavam esse jeito: no padrão, o Nexus avisava mas não mudava o clima. Agora o Nexus pode ligar o **"Usar como região"** da anomalia (`api.anomaliaRegiao(id, ligar)`): a região dela aparece e as Regiões do mapa e cenas marcadas com ela ganham o clima drenado; desligar tira a região (lugares que a usavam voltam para a região padrão, como já era). A configuração da anomalia (clima, temperaturas, climas próprios) não muda; só a chave "Usar como região".
- Ao ligar, o clima de hoje da região nova é rolado na hora (só as regiões em uso que ainda não têm clima).
- Com a barra de Anomalias desligada, o pedido é recusado com um aviso (uma vez por sessão).
- `api.anomalias()` traz `icone` e `regiao` (ligada agora); novo `api.modoAnomalias()`.

### Linha do tempo
- Botão **Linha do tempo** no painel do dia (com o Journal 4.6+): abre a Linha do tempo do Journal naquele dia. Jogadores também veem o botão.
- `api.contadores()` (o jogador recebe só os visíveis, com `tdFim`), `api.notas.calendario(diario)` e `textoAno`/`era` em `api.datas.partes(td)`, para o Journal mostrar contadores, separar os calendários e escrever o ano com a era.

### Preservação
- Nenhuma configuração nova, nenhum id, padrão ou valor salvo mudou. `api.anomalia(zona, tipo)` continua igual. Só o texto de ajuda de "Anomalia cobrindo uma região inteira" ganhou a explicação do Nexus.

### Testes
- Foundry simulado com os dois módulos carregados (`teste-ligacao.mjs`): 23 de 23 — anomalia como região ligando/desligando pelo Nexus, dois Nexus com a mesma anomalia, Nexus antigo com região inteira desligada e ligada, barra de Anomalias desligada, contadores, Linha do tempo abrindo no dia e separando calendários.
- Pendente no Foundry: Região do mapa com a região da anomalia recebendo o clima quando o Nexus cai; botão Linha do tempo no painel do dia.

## 4.1.1

### Clima nas cenas sem região própria (correção)
- **Causa:** em `planoClimaCena`, uma cena que usava a região padrão do mundo só recebia o efeito se tivesse uma Region de clima desenhada ou estivesse marcada com "Mostrar o efeito do clima nesta cena". Por isso o Mapa do Mundo sem Region ficava sem efeito, e desenhar uma Region "consertava" (a Region ligava a cena).
- Nova opção **"Clima nas cenas sem região própria"** (Central › Clima › Efeitos visuais): **Todas as cenas** (padrão) — as cenas sem região própria e sem Region usam a região padrão do mundo; **Só as cenas marcadas** — o comportamento até a 4.1.0.
- Continuam de fora: cenas em que o mestre desmarcou o clima, e cenas com um efeito escolhido à mão (o Calendário não troca o efeito de outra pessoa; marque "Mostrar o efeito do clima nesta cena" para ele assumir). Região própria, Regions desenhadas, anomalias e FXMaster seguem as regras de antes. Nenhuma Region é criada.
- `diagnosticoClima()` mostra também região própria, região padrão, se a cena é elegível e a opção atual. Continua só de leitura.

### Central de Configurações
- A Central abria sem o visual (abas empilhadas) quando o módulo era atualizado e a página só recarregada: o Foundry só lê os estilos do `module.json` ao iniciar o mundo. A Central agora carrega o `central.css` sozinha quando ele não está na página.

## 4.1.0

### Central de Configurações
- Nova janela **Calendário da Mesa — Central de Configurações** (botão **"Abrir Central de Configurações"** nas configurações do módulo; também `api.central()`), com 7 abas: **Geral, Tempo, Clima, Anomalias, Astronomia e luz, Eventos e diários, Ferramentas**. Visual de grimório astronômico nas cores do tema escolhido.
- Mostra as **34** opções que apareciam soltas na lista padrão do Foundry, cada uma com nome, descrição, escopo (Mundo / Só você), dependências ("Precisa de... ligado") e o estado das integrações (FXMaster, Journal, D&D 5e). Botões para as janelas que já existiam: janela do clima, editor de efeitos, editar anomalias, diagnóstico do clima, luz por hora, editor do calendário, histórico, calendário, tabelas de encontro e contadores.
- **Salvar alterações** grava só o que mudou, uma opção por vez, depois de validar (tipo, opções, mínimo e máximo); cada gravação dispara o onChange original. **Cancelar** descarta o que não foi salvo. Fechar com alterações pendentes pergunta antes. Se outra pessoa ou outra janela mudou a mesma opção enquanto a Central estava aberta, pergunta antes de sobrescrever. Trocar de aba não perde nada.
- Jogadores abrem a Central e veem só as preferências pessoais deles (tema, HUD, animação, abrir notas no Journal); as do mundo ficam só com o mestre.
- Recarregamento: segue a opção "Recarregar ao mudar configurações de módulos"; com ela desligada, a opção que exige recarregar (HUD do D&D 5e) pergunta como na janela do Foundry.
- A lista padrão de configurações do Foundry fica só com os botões (Central, Luz por hora, Tabelas de encontro).

### Nomes das opções sempre legíveis
- As opções de **Luas e eclipses** (e as outras da 4.0) podiam aparecer com um código como `CALMESA.t1w83jxm` no lugar do nome — quando o Foundry ainda não tinha lido a pasta `lang/` (por exemplo, módulo atualizado sem relançar o mundo). Agora o registro guarda o texto em português e a tradução só troca o texto quando existe (no `i18nInit`): sem arquivo de idioma, aparece o nome em português, nunca o código.

### Preservação
- Nenhum id, escopo, tipo, padrão, opção ou onChange mudou; as 51 configurações continuam registradas e os valores salvos ficam como estão (sem migração). Só o `config` das 34 opções da Central passou a `false`, para não aparecerem em dobro.
- Nenhuma regra de clima, anomalias, tempo, viagem, astronomia ou eventos foi tocada.

### Arquivos
- Novos: `scripts/central.js`, `scripts/central-mapa.js`, `templates/central/abas.hbs`, `templates/central/corpo.hbs`, `templates/central/rodape.hbs`, `styles/central.css`.
- Alterados: `scripts/calendario.js` (registro do botão, ocultação na lista padrão, carregamento da Central), `module.json` (versão e `styles/central.css`), `lang/pt-BR.json` e `lang/en.json` (93 textos novos).

### Testes
- Foundry simulado: `teste-central.mjs` 31 de 31 (inventário completo, registros iguais aos da 4.0.1, valores salvos preservados, pendências, troca de aba, dependências, validação, conflito externo, salvar só o que mudou, cancelar, fechar com pendência, integrações, recarregamento, jogador); `teste-cal.mjs` 142 de 142.
- Templates renderizados com o Handlebars no Chromium nos temas noite, claro e vitoriano, com a janela estreita e como jogador; nenhuma chave de tradução crua em pt-BR nem em inglês.

## 4.0.1

Correção das regressões do clima nas cenas (auditoria comparando 2.9.0 e 4.0.0) e remoção do som ambiente.

### Removido
- **Som ambiente** (playlists por hora e clima): saiu inteiro (configurações, janela, código, textos). O "tocar som" das ações das notas continua.

### Erros comprovados e corrigidos
Cada um foi reproduzido rodando o código da 4.0.0 entregue num Foundry simulado.

| # | Onde | Erro | Correção |
| --- | --- | --- | --- |
| 1 | `calendario.js` · `redesenharClima()` | Chamava `canvas.weather.initializeEffects()` sem a configuração. Pela API do Foundry, sem configuração o método **limpa** a camada de clima. Ele rodava em **todos os computadores** sempre que qualquer coisa era salva nos editores do clima (climas, regiões, anomalias, efeitos), então o clima sumia da tela até a cena ser redesenhada. | Passa sempre `CONFIG.weatherEffects[scene.weather]`. Depois de salvar tipos, só redesenha se a cena aberta usa um efeito do mestre (`cmx-*`). |
| 2 | `ferramentas.js` · `testarEfeito()` / `pararTeste()` | A prévia gravava `cmx-teste` no documento da cena aberta (`updateSource`) e, ao parar, restaurava a cena **aberta naquele momento**: trocando de mapa durante a prévia, o Mundo recebia o clima do Covil e o Covil ficava com o efeito de teste. | A prévia agora só desenha na tela (`initializeEffects` com o efeito montado), guarda o id da cena, não grava nada em documento nem em `CONFIG.weatherEffects`, e acaba sozinha ao trocar de cena, ao fechar a janela, ao salvar ou apagar o efeito. |
| 3 | `calendario.js` · `aplicarClimaNasCenas()` | Sem fila: pedidos simultâneos (virada do dia, Região do mapa, janela do clima, opção do FXMaster) rodavam juntos; com o FXMaster, o mesmo preset era ligado várias vezes na mesma cena. | Fila própria ("climaCenas"); vários pedidos seguidos viram uma passada que lê o estado mais recente. |
| 4 | `calendario.js` · `aplicarClimaNasCenas()` (já na 2.9.0) | Mapa com Regiões de clima (ex.: mapa-múndi) com o grupo fora de todas as Regiões só recebia efeito no momento em que o grupo saía de uma Região; na virada do dia ele era pulado e ficava com o efeito velho. | Esse tipo de cena passa a seguir a região da cena ou a padrão em toda aplicação. O trecho especial da saída da Região foi removido (agora redundante). |

### Mudanças de comportamento (escolhas)
- Cena que usa só a região **padrão do mundo** (sem região própria, sem Regiões no mapa) continua **sem** efeito, como na 2.9.0 — mas agora há a caixa **"Mostrar o efeito do clima nesta cena"** na janela do clima (Região da cena) para ligar, e também para **desligar** o clima visual de qualquer cena.
- O Calendário anota na cena o efeito que ele pôs (`climaAplicado`, na mesma gravação). Ao tirar o clima de uma cena, só remove o efeito que ele mesmo colocou; efeito escolhido à mão fica.
- Mudança da região da cena por fora da janela do clima, e o mestre abrindo uma cena, reaplicam o clima (só gravam o que estiver diferente).

### Diagnóstico
- `game.modules.get("calendario-mesa").api.diagnosticoClima()` lista **todas** as cenas: id, ativa, vista neste computador, região e de onde ela vem (própria / Região do mapa / mapa com Regiões / padrão), anomalia, clima, efeito esperado, preset esperado e ativos, efeito salvo na cena, se ele existe neste computador e o **motivo** quando não foi aplicado.

### Testes
- Foundry simulado: 142 de 142, com 21 novos (cenas com região própria, padrão, por token, mapa com Regiões, desligada pelo mestre, efeito à mão preservado, 5 pedidos simultâneos, FXMaster simultâneo/desativado, redesenhar com configuração, prévia com troca de mapa).
- `repro.mjs` contra a 4.0.0: os 4 erros acima aparecem (6 de 6 verificações).

## 4.0.0

Versão grande: funções novas de tempo, luas, clima e som. (De 2.10 para 4.0 por causa da quantidade de mudanças.)

### Efeitos com duração acabam pelo calendário
- Quando o tempo passa, os efeitos ativos dos personagens cuja duração acabou (magia de 8 horas, veneno de 24 horas...) são **removidos** da ficha, ou **desativados**, conforme a configuração **"Efeitos com duração vencidos"** (remover / desativar / não mexer). Usa o início e a duração que o Foundry já guarda em cada efeito; rodadas e turnos fora de combate viram segundos; efeitos de um combate em andamento ficam com o sistema.
- Vale para os atores do mundo e os tokens não vinculados das cenas em uso. O mestre recebe no chat a lista do que acabou (opção para desligar).

### Notas que disparam ações
- Botão de **raio** em cada nota (lista do dia, só o mestre): ao chegar a hora da nota, o calendário pode **rodar uma macro**, **tocar um som** (com volume), **trocar de cena** (ativar para todos ou só o mestre) e **mandar uma mensagem** no chat. Vale para as repetições. Há "Salvar e testar agora".
- As ações rodam quando o tempo passa pela hora da nota (não repetem se o tempo já passou dela); num pulo de mais de 60 dias, nada dispara.

### Eventos das luas
- Calculados a partir das fases e das aparições: **luas cheias juntas**, **eclipse solar** (lua nova cobrindo o sol), **eclipse lunar** e **noite sem luas** (com duas ou mais luas, nenhuma no céu).
- Aparecem na grade (ícones nos dias), no painel do dia e em "Próximos no céu"; avisados no chat e no histórico no dia (configurável). A chance de eclipse por ciclo é configurável; o sorteio é fixo (os mesmos dias para todos e em toda abertura).
- Opção **"Eclipse solar muda o clima do dia"** (clima vira Eclipse).

### Previsão do tempo
- Nova aba **Previsão** na janela do clima (só o mestre): os próximos 3 a 7 dias de cada região (configurável), com troca do tempo, da temperatura, rolar de novo ou tirar um dia. **Mostrar aos jogadores** manda a previsão no chat. Quando o dia chega, o clima sai da previsão em vez de ser rolado.

### Desfazer o último pulo de tempo
- Botão **Desfazer** no HUD (aparece depois de um pulo): volta o tempo, o clima do dia, o histórico, os contadores e o dia das lojas do Journal para como estavam, sem rolar clima nem avisar nada. Guarda os 5 últimos pulos (enquanto a página estiver aberta); os tiques do relógio em tempo real não entram.

### Som ambiente
- Configuração **"Som ambiente"**: uma playlist de dia, uma de noite e uma para cada clima (a do clima vale mais). Troca sozinha com a hora e o clima da cena aberta, parando só as playlists que ele mesmo ligou.

### Recarregar ao mudar configurações
- Nova opção **"Recarregar ao mudar configurações de módulos"** (qualquer módulo / só o Calendário / não): ao fechar a janela de configurações depois de mudar alguma opção, a página recarrega; se a opção é do mundo, recarrega também para os jogadores conectados. Mudanças feitas por código (clima do dia, histórico...) não contam.

### Tradução
- Estrutura de tradução: pasta `lang/` com `pt-BR.json` e `en.json`, função de tradução no código e chaves geradas a partir do texto. Os textos novos desta versão já estão nos dois idiomas; os textos antigos continuam só em português (a tradução completa fica para a 4.1.0).

### Testes
- Foundry simulado: 124 de 124, com 29 novos (efeitos vencidos nos 3 modos, ações das notas antes/na hora/depois/pulo grande, 4 anos de eventos das luas, previsão sendo usada no dia, desfazer, som ambiente, recarregar, tradução com o inglês carregado).
- Pendente no Foundry: efeitos de verdade numa ficha do D&D 5e, macro/som/cena disparando, eventos das luas na grade, previsão, desfazer, playlists, recarregar ao fechar as configurações.

## 2.10.1

### Efeitos
- **FXMaster que não liga o preset → efeito do Foundry.** Antes, com o FXMaster ativo, o Calendário tirava o efeito do Foundry da cena e confiava no preset; se o FXMaster não ligava o preset, a cena ficava sem nenhum efeito. Agora ele confere o resultado de `presets.play` e se o preset aparece ativo na cena (`presets.listActive`); se não, ou se o FXMaster der erro, a cena recebe o efeito do Foundry e aparece um aviso (uma vez por preset).
- **Tempestade** e **Calor extremo** voltaram aos efeitos nativos (tempestade e nenhum); os efeitos de tela novos ficam nos climas novos (Aurora, Eclipse, Relâmpagos secos) e nos efeitos que você criar.
- O efeito de tela (shader próprio) nunca quebra a camada de clima: se não puder ser criado no computador, fica vazio e avisa uma vez. Ele também passa a se animar sozinho ao ser criado.
- **Diagnóstico**: `game.modules.get("calendario-mesa").api.diagnosticoClima()` no console (F12) mostra, para cada cena com clima, o clima, o efeito do Foundry, o preset do FXMaster, o efeito que está na cena agora e se ele existe.

### Névoa de guerra com o dia e a noite
- Nova opção **"Névoa de guerra com o dia e a noite"** (desligada por padrão): nas cenas com dia/noite do Calendário, liga a luz global só até um nível de escuridão (opção **"Escuridão em que a noite esconde o mapa"**, padrão 0,6) e a visão dos tokens. De dia o mapa todo fica visível; à noite, só a visão dos tokens e as luzes revelam o mapa e a névoa de guerra volta a esconder o resto.

### Viagem
- Nova configuração **"Tabelas de encontro da viagem"** (botão "Escolher tabelas"): marque quais tabelas aparecem em "Tabela de encontros" na janela de viagem, com busca e agrupadas por pasta. Sem nenhuma marcada, aparecem todas.

### Testes
- Foundry simulado: 95 de 95, com 12 novos (preset recusado, preset que não fica ativo, erro do FXMaster, sem FXMaster, shader que não compila, visão ligada/desligada, filtro das tabelas).
- Pendente no Foundry: cena com o FXMaster ativo e um preset que não existe; névoa de guerra à noite com tokens; a janela de tabelas.

## 2.10.0

### Anomalias
- **Usar como região** (liga e desliga em cada anomalia): ligado, gera uma região com o **nome da anomalia**, que aparece na lista das Regiões do mapa e das cenas, com ela sempre ativa; desligado, a região some (lugares que a usavam voltam para a região padrão; a configuração fica guardada).
- O **clima da região da anomalia** (temperatura por estação, variação e chance de cada clima) é configurado na própria aba Anomalias e fica salvo **só na anomalia**. "Copiar o clima de" traz uma região como ponto de partida.
- **Climas desta anomalia**: climas que só existem dentro dela (ex.: "Chuva seca"), com nome, grupo, ícone, efeito, temperatura e descrição. Valem no tempo forçado, nas trocas e na tabela da região dela; não aparecem na aba Climas nem nas regiões comuns.
- **Anomalia cobrindo uma região inteira** agora é uma opção nas configurações, **desligada por padrão** (o seletor "Anomalia ativa em…" sumiu da janela). Os limiares dos Nexus do Journal que ligam anomalia numa região só funcionam com essa opção ligada.
- A opção da barra de anomalias passou a se chamar **"Ativar a barra de Anomalias"**.

### Efeitos
- **Aba Climas → Efeitos**: crie efeitos a partir de qualquer efeito do Foundry, do Calendário ou do FXMaster, mudando **cor, força, velocidade, tamanho e direção**, e **junte dois efeitos** (com cor e força próprias). Os ajustes que a base não tem ficam apagados. **Ver nesta cena** mostra o efeito só para você, sem salvar. Salvo, ele aparece em "Efeito na cena", no grupo "Seus efeitos".
- **4 efeitos de tela novos**, desenhados pelo próprio módulo (shaders próprios, sem depender de classes internas do Foundry): **Aurora**, **Calor tremulando**, **Relâmpagos** e **Céu de eclipse**. A Tempestade passou a usar a tempestade nativa com relâmpagos, e o Calor extremo usa o calor tremulando.
- 3 climas novos: **Relâmpagos secos**, **Aurora** (com chance no inverno da Ártica) e **Eclipse**.

### FXMaster
- Com o FXMaster ativo, cada clima pode usar um **preset** do FXMaster (API pública `FXMASTER.api.presets`) ou uma partícula dele, com densidade, velocidade e cor. Os climas de fábrica já vêm com um preset sugerido (Chuva → rain, Tempestade → thunderstorm, Nevasca → blizzard, Calor → heat-wave...). Sem o FXMaster, ou com a nova opção **"Usar o FXMaster nos climas"** desligada, o clima usa o efeito do Foundry.
- O Calendário só liga e desliga os presets que ele mesmo colocou na cena.

### HUD
- Os modos **mini** (data e hora) e **oculto** (bolinha) agora também podem ser **arrastados**, por qualquer ponto. O clique duplo para trocar de modo continua funcionando (o arrasto só começa depois de mover 4 px).

### Testes
- Foundry simulado (`teste-cal.mjs`): 83 de 83, com 19 novos (região de anomalia ligar/desligar, climas da anomalia isolados, opção de região inteira, efeitos do mestre, FXMaster com API simulada).
- Os 4 shaders foram compilados e desenhados em WebGL no Chromium (aurora e calor se movem, relâmpago pisca em momentos sorteados, eclipse escurece).
- Pendente no Foundry: os efeitos de tela e os efeitos do mestre na cena de verdade, "Ver nesta cena", presets do FXMaster, arrastar o HUD mini/oculto.

## 2.9.0

- **Temperatura mais variada**: o dado da temperatura (e o sorteio do dia) ficava preso perto da média (desvio de ~2,7 °C: na Temperada, quase sempre entre -10 e 10 no inverno). Agora cada região tem uma **variação ±°C** editável (Temperada 10, Tropical 6, Deserto 14, Ártica e Montanha 12, Reinos 9 a 12); os extremos chegam a 1,5× isso, mais 10% de "dia fora de época" (a média puxa para a de outra estação) e as ondas de calor/frio. Na Temperada, 3000 rolagens deram de -12 a 35 °C.
- Nova configuração **Variação da temperatura**: baixa, normal, alta ou extrema (multiplica a variação de todas as regiões).
- **Aba Climas**: criar climas novos e editar os 20 de fábrica: nome, grupo, ícone, efeito na cena (qualquer efeito de clima do Foundry ou nenhum), mudança de temperatura e descrição. Clima novo aparece nos cartões, na tabela de chances das regiões e nas anomalias. Apagar um clima o tira das regiões e anomalias que usavam.
- **Anomalias trocam climas**: lista de trocas "clima → outro clima" enquanto a anomalia estiver ativa (ex.: Chuva → "Chuva seca", um clima criado sem efeito de chuva). Vale quando a anomalia não força um tempo. Ligar a anomalia na janela já troca o tempo de hoje.
- **Anomalia como região**: cada anomalia aparece como "Anomalia: <nome>" na lista de regiões das Regiões do mapa e das cenas. O lugar usa a **região base** da anomalia (escolhida na aba Anomalias; as de fábrica usam o Reino do elemento) com ela sempre ativa.
- Nova configuração **Anomalias de clima** (ligada por padrão): desligada, as anomalias param de valer e somem da janela do clima (aba e seletor), do HUD e da lista das Regiões do mapa. Os tipos criados ficam guardados.
- Testes (Foundry simulado, `teste-cal.mjs`): 64 de 64, com 15 novos. Prévia no Chromium das abas Climas, Regiões e Anomalias (com trocas) e da janela sem anomalias.
- Pendente no Foundry: Região do mapa com "Anomalia: ...", clima novo com efeito de cena escolhido, e as duas configurações novas.

## 2.8.0

- **Dado da temperatura**: na barra de baixo da janela do clima, ao lado do controle de temperatura. Rola só a temperatura para o tempo escolhido (ou o de hoje), com mínima, máxima e a chance de onda de calor/frio; o topo mostra o resultado na hora. Aplicar grava essa faixa.
- **Aba Regiões**: editar as 9 regiões de fábrica e criar novas (nome, reino de elemento, temperatura média por estação, peso de cada tempo por estação com a soma ao vivo). Duplicar, tornar padrão do mundo, restaurar de fábrica, apagar as criadas (com aviso de quantas cenas e Regiões do mapa usam). Uma região apagada não quebra nada: cenas, Regiões do mapa e a configuração voltam para a padrão ou a Temperada.
- **Aba Anomalias**: editar as 4 de fábrica e criar novas (nome, ícone, tempo forçado ou "não força", variação de temperatura, texto). Anomalia sem tempo forçado só muda a temperatura e o texto.
- Os tipos ficam no setting `climaTipos` (mundo), aplicados por cima dos de fábrica; gravações em fila; valores conferidos (temperatura de região ±80 °C, de anomalia ±60 °C, só tempos existentes com peso > 0, estação vazia vira céu limpo, ícone só `fa-*`, texto até 600 caracteres).
- **Visual novo da janela**: abas no topo, cartões claros com o ícone num círculo da cor do grupo, gradiente cheio só no escolhido, tempos raros tracejados (antes ficavam acinzentados e escuros), selo "hoje" no lugar da fita diagonal, filtros em pílulas, e campos, listas e caixas de texto nas cores do tema (antes ficavam escuros no tema claro).
- Testes (Foundry simulado, `teste-cal.mjs`): 49 de 49, com 12 novos (região criada, pesos inválidos, editar e restaurar de fábrica, apagar a região padrão, duas anomalias salvas ao mesmo tempo, limites, anomalia que força e que não força, dado da temperatura). Prévia no Chromium das três abas nos temas claro, noite e vitoriano, e em 560×420: barra de baixo visível e lista/tabela rolando.
- Pendente no Foundry: abrir as abas num mundo real, criar uma região, usá-la numa Região do mapa e recarregar.

## 2.7.1

- **Janela do clima nova**, própria do Calendário (não é mais um diálogo do Foundry): topo com o tempo de hoje ou a prévia do escolhido (ícone, temperatura, mínima/máxima, descrição, cores do tipo de tempo), filtros por grupo e "só desta estação", cartões coloridos com a chance na estação em barra, fita "hoje" e marca de efeito na cena, e barra fixa embaixo com Rolar, temperatura e Aplicar.
- Corrigido: a janela antiga ficava mais alta que a tela e não rolava (os tempos de baixo e o botão Aplicar ficavam fora de alcance). Agora a janela tem tamanho fixo, é redimensionável e só a lista rola.
- Região da cena e anomalia ficam em "Região da cena e anomalia", no fim da lista.
- Verificado com uma prévia no Chromium em 780×640 e 560×420: a lista rola e a barra de baixo continua visível.

## 2.7.0

### Tempo e efeitos
- 20 tipos de tempo (eram 10): céu limpo, poucas nuvens, nublado, céu encoberto, neblina, nevoeiro denso, garoa, chuva, aguaceiro, chuva com neblina, tempestade, granizo, neve fraca, neve, nevasca, frio intenso, ventania, tempestade de areia, calor extremo, chuva de cinzas. Cada um com descrição para o chat e efeito na temperatura.
- 9 efeitos de cena novos (`cm-*`), feitos a partir dos efeitos nativos do Foundry com outros valores (garoa, aguaceiro, nevoeiro denso, céu encoberto, chuva com neblina, granizo, neve fraca, areia, cinzas). Se um deles não puder ser criado, o tempo usa o efeito nativo mais próximo. Ficam também disponíveis na configuração de clima da cena.
- Tabelas de clima das 9 regiões refeitas com os tipos novos.

### Mais variedade
- Temperatura com variação em forma de sino (dias perto do normal são mais comuns, extremos são raros), mais o efeito do tipo de tempo.
- 8% de chance de "dia atípico" (um tempo que a região tem em outra época do ano) e 7% de onda de calor ou de frio (±6 a 10 °C).
- Mínima e máxima do dia, mais largas com céu limpo e no deserto, mais estreitas com chuva e névoa.

### Janela do clima
- Cartões com ícone agrupados (Céu, Névoa, Chuva, Neve e frio, Vento e extremos), chance de cada tempo na estação atual da região, marca de "tem efeito na cena", o tempo de hoje destacado.
- Temperatura com controle deslizante; ao escolher um tempo, a temperatura sugerida para ele é preenchida. Na unidade escolhida (°C ou °F).

### Regiões de clima do mapa
- Ao entrar, o efeito da região aparece na tela na hora (ex.: Reino da Água chovendo → chuva na cena) e o chat mostra o tempo com a descrição.
- Novo: aviso ao **sair** da região, com o clima do lugar para onde o grupo foi; a cena volta ao efeito desse clima.
- O grupo só "sai" quando o último personagem de jogador deixa a região (antes, o primeiro que saía já trocava o clima).
- Entradas e saídas em fila: vários tokens cruzando a borda juntos geram um aviso só.

### Testes
Feitos (Foundry simulado, `teste-cal.mjs`, 37 de 37): os 20 anteriores; registro dos 9 efeitos sem alterar os nativos; reserva quando a variação falta; 3000 dias sorteados no Reino da Água (12 tipos, desvio de 3,7 °C, 7,9% de ondas, mínima < temperatura < máxima); entrada simultânea de dois tokens com um aviso e chuva na cena; saída parcial ignorada; saída do último com aviso e efeito trocado.

Pendentes no Foundry: aparência dos 9 efeitos novos (eles mudam números dos efeitos nativos e podem ficar parecidos com o original); janela do clima com o controle deslizante; Região de clima com token de jogador.

## 2.6.0

Correções da auditoria da 2.5.0 (IDs do relatório de auditoria) e viagem dia a dia com vigias.

### Correções

| ID | Problema original | Correção | Arquivos |
| --- | --- | --- | --- |
| I2 | `historico`, `contadores` e `climaAtual` eram lidos, alterados e regravados por várias rotinas ao mesmo tempo; a segunda gravação apagava a primeira (reproduzido: dois `registrar` simultâneos guardavam só um). | Fila serial por setting (`naFila`), com `alterarHistorico` e `alterarContadores`. As entradas são montadas na hora do pedido e gravadas na vez delas. | `calendario.js`, `ferramentas.js` |
| C2 | Cada mudança de tempo disparava `aoMudarTempo` sem esperar a anterior; dois cliques rápidos avisavam "terminou" duas vezes (reproduzido). | O processamento do mestre (`processarMudancaDeTempo`) roda na fila "tempo"; o aviso do contador sai depois de gravar o estado "feito". A luz não entra na fila (continua cancelável pelo `SEQ_LUZ`). | `calendario.js` |
| C1 | `ferr()`/`abrirFerramenta()` engoliam qualquer erro de dentro das ferramentas. | `relatarErro`: console sempre e aviso ao mestre (no máximo 1 por minuto por ferramenta). | `calendario.js` |
| C3 | Luz e clima atualizavam cena por cena com `await`. | `atualizarCenas`: um `Scene.updateDocuments` por passo, com `animateDarkness`; se o lote for recusado, tenta cena por cena e relata quais falharam. Mesmos limiares, travas e filtros. | `calendario.js` |
| C4 | O relógio somava 5 s × taxa por tique; com a aba em segundo plano o navegador espaça os tiques e o relógio atrasava. Rodava também nos jogadores. | Mede o tempo real entre tiques (`performance.now`), acumula frações, limita saltos a 120 s (PC dormindo). Só inicia para mestres. Pausa, combate e "desligado" continuam iguais. | `calendario.js` |
| C5 | `comConfig`/`comCal` aceitavam callback assíncrono, que rodaria com o calendário errado. | Callback que devolve Promise é recusado com `TypeError` (os usos atuais são síncronos; nada muda para eles). | `calendario.js` |
| C6 | Rejeições sem tratamento (relógio, posição do HUD, luz). | `.catch` com registro. | `calendario.js` |
| C7 | Salvar o calendário principal recalculava e redesenhava tudo duas vezes. | `onChange` dos dois settings com `debounce` de 50 ms. | `calendario.js`, `ferramentas.js` |
| I3 | "Igual ao Journal" nunca achava o tema Vitoriano (o Journal grava `lotd`). | Mapeamento `lotd → vitoriano`. | `calendario.js` |
| I4 | Leitura/gravação direta dos settings internos do Journal. | Usa `api.dia.somar()` e `api.renovarEstoques()` do Journal 4.4; mantém a gravação direta como reserva para Journal antigo. Nova API própria: `historico()`, `historicoVisivel()`, `viagem()`. | `calendario.js` |

### Novo

- Viagem dia a dia (opção na janela de viagem): partida e horário das vigias definidos pelo mestre, janela de controle da viagem, narração por momento do dia (chat + histórico), encontro testado a cada dia.
- Vigias: liberadas no horário escolhido; o mestre define quantas (2 horas cada) e quem participa; os jogadores escolhem a vigia num painel na tela de todos; a vigia atual aparece para todos; registro no histórico.
- `module.json`: `"socket": true` (escolha das vigias pelos jogadores).
- Janela de Contadores migrada para `HandlebarsApplicationMixin` + `PARTS` (`templates/contadores.hbs`), com os mesmos seletores e ações.

### Riscos e limitações

- A fila só serializa dentro do mesmo computador. Dois mestres conectados ainda podem gravar o histórico ao mesmo tempo (raro: só o mestre principal grava automaticamente).
- `animateDarkness` em lote (`Scene.updateDocuments`) foi verificado por leitura da API, não num Foundry rodando.
- O painel de vigias e a janela de viagem não foram abertos num Foundry real.

### Testes

Feitos (Node 22, Foundry simulado, `teste-cal.mjs`, 20 de 20): fila em ordem e erro não travando a fila; histórico com 3 gravações simultâneas; contador avisado uma vez com 2 checagens simultâneas; `comConfig` recusando função assíncrona e restaurando o calendário; relógio (tique normal, aba em segundo plano, PC dormindo, taxa 0,5 sem perder frações, desligado); vigias (escolha, recusas, horário, saída, painel aparece/some); tema `lotd`; ida e volta de datas com mês que some (295 datas). Os mesmos cenários de concorrência falham na 2.5.0.

Pendentes (precisam do Foundry): v13 e v14; D&D 5e 5.x e 6.x; luz em 3 cenas com salto de 6 h; Região de clima com token de jogador; viagem completa com 2 jogadores e vigias; janela de Contadores (template) abrindo e as ações +1h/+1d/apagar; recarregar 3× sem duplicar relógio.
