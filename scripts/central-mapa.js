/* =========================================================
 * Calendário da Mesa — mapa da Central de Configurações
 *
 * Só diz ONDE cada configuração aparece (aba, seção) e como se relaciona com as outras.
 * Nome, descrição, tipo, padrão, escopo, opções e onChange continuam vindo do registro original
 * (game.settings.register em calendario.js): esta lista não é uma segunda fonte de verdade.
 *
 * Campos de cada item de "campos":
 *   chave      id da configuração em game.settings (nunca renomear)
 *   dica       descrição usada só quando o registro não tem "hint"
 *   depende    { chave, quando(valor) } — o campo fica desligado enquanto a condição não vale
 *   integracao "fxmaster" | "journal" | "dnd5e" — mostra se a integração está disponível
 *   minimo     validação extra para números sem "range" no registro
 * Itens de "botoes" abrem janelas que já existem (nenhuma função nova).
 * ========================================================= */

export const ABAS_CENTRAL = [
  {
    id: "geral", rotulo: "Geral", icone: "fa-compass",
    lema: "Aparência do calendário, HUD e o que os jogadores enxergam.",
    secoes: [
      { id: "aparencia", titulo: "Aparência", icone: "fa-palette", campos: [
        { chave: "tema" },
        { chave: "mostrarHud", dica: "Liga ou desliga o HUD no topo da tela, só para você." }
      ] },
      { id: "dnd5e", titulo: "HUD do D&D 5e", icone: "fa-dragon", campos: [
        { chave: "hudDnd5e", integracao: "dnd5e" }
      ] },
      { id: "jogadores", titulo: "O que os jogadores veem", icone: "fa-users", campos: [
        { chave: "jogadoresVeemHora" }
      ] }
    ]
  },
  {
    id: "tempo", rotulo: "Tempo", icone: "fa-hourglass-half",
    lema: "Relógio, passagem do tempo e efeitos com duração.",
    secoes: [
      { id: "relogio", titulo: "Relógio em tempo real", icone: "fa-clock", campos: [
        { chave: "relogioTaxa", minimo: 0 },
        { chave: "pausaJogo", dica: "Enquanto o jogo está pausado, o relógio em tempo real não anda." },
        { chave: "pausaCombate" }
      ] },
      { id: "passagem", titulo: "Passagem de tempo", icone: "fa-forward", campos: [
        { chave: "cinemaMundo" },
        { chave: "cinemaHoras", minimo: 0, dica: "Pulos de tempo a partir deste número de horas mostram a animação.", depende: { chave: "cinemaMundo", quando: (v) => v === true, texto: "Precisa de \"Animação ao pular muito tempo\" ligada" } },
        { chave: "cinema" }
      ] },
      { id: "efeitos", titulo: "Efeitos com duração", icone: "fa-flask", campos: [
        { chave: "efeitosVencidos" },
        { chave: "efeitosAviso", dica: "Mensagem no chat (só para o mestre) com os efeitos que acabaram.", depende: { chave: "efeitosVencidos", quando: (v) => v !== "nao", texto: "Não vale com \"Não mexer\" acima" } }
      ] }
    ]
  },
  {
    id: "clima", rotulo: "Clima", icone: "fa-cloud-sun-rain",
    lema: "Regiões, temperatura, previsão e efeitos na cena.",
    secoes: [
      { id: "regioes", titulo: "Regiões e temperatura", icone: "fa-earth-americas", campos: [
        { chave: "zonaPadrao" },
        { chave: "climaVariacao" },
        { chave: "climaUnidade", dica: "Unidade em que as temperaturas aparecem para todos." }
      ] },
      { id: "previsao", titulo: "Previsão e avisos", icone: "fa-calendar-week", campos: [
        { chave: "previsaoDias" },
        { chave: "climaChat", dica: "Quem recebe no chat o clima de cada dia." }
      ] },
      { id: "visual", titulo: "Efeitos visuais", icone: "fa-cloud-showers-heavy", campos: [
        { chave: "climaVisual" },
        { chave: "climaCenasSemRegiao", depende: { chave: "climaVisual", quando: (v) => v === true, texto: "Precisa de \"Efeito de clima nas cenas\" ligado" } },
        { chave: "usarFXMaster", integracao: "fxmaster", depende: { chave: "climaVisual", quando: (v) => v === true, texto: "Precisa de \"Efeito de clima nas cenas\" ligado" } }
      ] }
    ],
    botoes: [
      { acao: "abrirClima", rotulo: "Janela do clima", icone: "fa-cloud-sun", dica: "Tempo de hoje, previsão, climas e regiões" },
      { acao: "abrirEfeitos", rotulo: "Editor de efeitos", icone: "fa-wand-magic-sparkles", dica: "Aba Climas › Efeitos da janela do clima" },
      { acao: "diagnostico", rotulo: "Diagnóstico do clima", icone: "fa-stethoscope", dica: "Mostra no console (F12) o clima de cada cena e o motivo" }
    ]
  },
  {
    id: "anomalias", rotulo: "Anomalias", icone: "fa-skull",
    lema: "A barra de Anomalias e como elas valem no mundo.",
    secoes: [
      { id: "barra", titulo: "Barra de Anomalias", icone: "fa-toggle-on", campos: [
        { chave: "anomaliasAtivas" },
        { chave: "anomaliaRegiaoInteira", depende: { chave: "anomaliasAtivas", quando: (v) => v === true, texto: "Precisa da barra de Anomalias ligada" } }
      ] }
    ],
    botoes: [
      { acao: "abrirAnomalias", rotulo: "Editar anomalias", icone: "fa-skull", dica: "Regiões anômalas e climas exclusivos de cada anomalia", depende: { chave: "anomaliasAtivas", quando: (v) => v === true } }
    ]
  },
  {
    id: "astronomia", rotulo: "Astronomia e luz", icone: "fa-moon",
    lema: "Luas, eclipses, luz das cenas e névoa de guerra.",
    secoes: [
      { id: "luas", titulo: "Luas e eclipses", icone: "fa-circle-half-stroke", campos: [
        { chave: "luasAviso" },
        { chave: "eclipseChance" },
        { chave: "eclipseMudaClima", depende: { chave: "eclipseChance", quando: (v) => Number(v) > 0, texto: "Com chance de eclipse 0, nunca acontece" } },
        { chave: "jogadoresVeemLuasOcultas" }
      ] },
      { id: "luz", titulo: "Luz e névoa de guerra", icone: "fa-sun", campos: [
        { chave: "visaoDiaNoite" },
        { chave: "visaoLimite", depende: { chave: "visaoDiaNoite", quando: (v) => v === true, texto: "Precisa de \"Névoa de guerra com o dia e a noite\" ligada" } }
      ] }
    ],
    botoes: [
      { acao: "abrirLuz", rotulo: "Luz por hora", icone: "fa-sun", dica: "Nível de luz de cada hora, luz das luas e cor da noite" },
      { acao: "abrirEditor", rotulo: "Editor do calendário", icone: "fa-gear", dica: "Meses, semanas, estações, luas e eras" }
    ]
  },
  {
    id: "eventos", rotulo: "Eventos e diários", icone: "fa-book-open",
    lema: "Notas do calendário, histórico e ligação com o Journal da Mesa.",
    secoes: [
      { id: "notas", titulo: "Notas e eventos", icone: "fa-calendar-day", campos: [
        { chave: "editorNotas", integracao: "journal" },
        { chave: "abrirNoJournal", integracao: "journal" },
        { chave: "pastaPorAno" }
      ] },
      { id: "historico", titulo: "Histórico", icone: "fa-scroll", campos: [
        { chave: "historicoJogadores" }
      ] },
      { id: "journal", titulo: "Journal da Mesa", icone: "fa-store", campos: [
        { chave: "integrarJournal", integracao: "journal" },
        { chave: "avisoSemana" }
      ] }
    ],
    botoes: [
      { acao: "abrirHistorico", rotulo: "Histórico da campanha", icone: "fa-scroll" },
      { acao: "abrirCalendario", rotulo: "Janela do calendário", icone: "fa-calendar-days" }
    ]
  },
  {
    id: "ferramentas", rotulo: "Ferramentas", icone: "fa-toolbox",
    lema: "Viagem, encontros e manutenção.",
    secoes: [
      { id: "manutencao", titulo: "Manutenção", icone: "fa-screwdriver-wrench", campos: [
        { chave: "recarregarAoMudar" }
      ] }
    ],
    botoes: [
      { acao: "abrirTabelas", rotulo: "Tabelas de encontro da viagem", icone: "fa-table-list", dica: "Quais tabelas aparecem na janela de viagem" },
      { acao: "abrirContadores", rotulo: "Contadores e prazos", icone: "fa-hourglass-half" },
      { acao: "diagnostico", rotulo: "Diagnóstico do clima", icone: "fa-stethoscope", dica: "Mostra no console (F12) o clima de cada cena e o motivo" }
    ]
  }
];

/** Todas as chaves que a Central mostra (elas saem da lista padrão de configurações do Foundry). */
export const CHAVES_CENTRAL = new Set(ABAS_CENTRAL.flatMap((a) => a.secoes.flatMap((s) => s.campos.map((c) => c.chave))));
