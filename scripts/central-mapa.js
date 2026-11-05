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
    id: "geral", rotulo: "Comum.geral", icone: "fa-compass",
    lema: "Central.aparencia_do_calendario_hud_e_o",
    secoes: [
      { id: "aparencia", titulo: "Central.aparencia", icone: "fa-palette", campos: [
        { chave: "tema" },
        { chave: "mostrarHud", dica: "Central.liga_ou_desliga_o_hud_no" }
      ] },
      { id: "dnd5e", titulo: "Central.hud_do_d_d_5e", icone: "fa-dragon", campos: [
        { chave: "hudDnd5e", integracao: "dnd5e" }
      ] },
      { id: "jogadores", titulo: "Central.o_que_os_jogadores_veem", icone: "fa-users", campos: [
        { chave: "jogadoresVeemHora" }
      ] }
    ]
  },
  {
    id: "tempo", rotulo: "Comum.tempo", icone: "fa-hourglass-half",
    lema: "Central.relogio_passagem_do_tempo_e_efeitos",
    secoes: [
      { id: "relogio", titulo: "Central.relogio_em_tempo_real", icone: "fa-clock", campos: [
        { chave: "relogioTaxa", minimo: 0 },
        { chave: "pausaJogo", dica: "Central.enquanto_o_jogo_esta_pausado_o" },
        { chave: "pausaCombate" }
      ] },
      { id: "passagem", titulo: "Central.passagem_de_tempo", icone: "fa-forward", campos: [
        { chave: "cinemaMundo" },
        { chave: "cinemaHoras", minimo: 0, dica: "Central.pulos_de_tempo_a_partir_deste", depende: { chave: "cinemaMundo", quando: (v) => v === true, texto: "Central.precisa_de_animacao_ao_pular_muito" } },
        { chave: "cinema" }
      ] },
      { id: "efeitos", titulo: "Central.efeitos_com_duracao", icone: "fa-flask", campos: [
        { chave: "efeitosVencidos" },
        { chave: "efeitosAviso", dica: "Central.mensagem_no_chat_so_para_o", depende: { chave: "efeitosVencidos", quando: (v) => v !== "nao", texto: "Central.nao_vale_com_nao_mexer_acima" } }
      ] }
    ]
  },
  {
    id: "clima", rotulo: "Comum.clima", icone: "fa-cloud-sun-rain",
    lema: "Central.regioes_temperatura_previsao_e_efeitos_na",
    secoes: [
      { id: "regioes", titulo: "Central.regioes_e_temperatura", icone: "fa-earth-americas", campos: [
        { chave: "zonaPadrao" },
        { chave: "climaVariacao" },
        { chave: "climaUnidade", dica: "Central.unidade_em_que_as_temperaturas_aparecem" }
      ] },
      { id: "previsao", titulo: "Central.previsao_e_avisos", icone: "fa-calendar-week", campos: [
        { chave: "previsaoDias" },
        { chave: "climaChat", dica: "Central.quem_recebe_no_chat_o_clima" }
      ] },
      { id: "visual", titulo: "Central.efeitos_visuais", icone: "fa-cloud-showers-heavy", campos: [
        { chave: "climaVisual" },
        { chave: "climaCenasSemRegiao", depende: { chave: "climaVisual", quando: (v) => v === true, texto: "Central.precisa_de_efeito_de_clima_nas" } },
        { chave: "usarFXMaster", integracao: "fxmaster", depende: { chave: "climaVisual", quando: (v) => v === true, texto: "Central.precisa_de_efeito_de_clima_nas" } }
      ] }
    ],
    botoes: [
      { acao: "abrirClima", rotulo: "Central.janela_do_clima", icone: "fa-cloud-sun", dica: "Central.tempo_de_hoje_previsao_climas_e" },
      { acao: "abrirEfeitos", rotulo: "Central.editor_de_efeitos", icone: "fa-wand-magic-sparkles", dica: "Central.aba_climas_efeitos_da_janela_do" },
      { acao: "diagnostico", rotulo: "Central.diagnostico_do_clima", icone: "fa-stethoscope", dica: "Central.mostra_no_console_f12_o_clima" }
    ]
  },
  {
    id: "anomalias", rotulo: "Comum.anomalias", icone: "fa-skull",
    lema: "Central.a_barra_de_anomalias_e_como",
    secoes: [
      { id: "barra", titulo: "Central.barra_de_anomalias", icone: "fa-toggle-on", campos: [
        { chave: "anomaliasAtivas" },
        { chave: "anomaliaRegiaoInteira", depende: { chave: "anomaliasAtivas", quando: (v) => v === true, texto: "Central.precisa_da_barra_de_anomalias_ligada" } }
      ] }
    ],
    botoes: [
      { acao: "abrirAnomalias", rotulo: "Central.editar_anomalias", icone: "fa-skull", dica: "Central.regioes_anomalas_e_climas_exclusivos_de", depende: { chave: "anomaliasAtivas", quando: (v) => v === true } }
    ]
  },
  {
    id: "astronomia", rotulo: "Central.astronomia_e_luz", icone: "fa-moon",
    lema: "Central.luas_eclipses_luz_das_cenas_e",
    secoes: [
      { id: "luas", titulo: "Central.luas_e_eclipses", icone: "fa-circle-half-stroke", campos: [
        { chave: "luasAviso" },
        { chave: "eclipseChance" },
        { chave: "eclipseMudaClima", depende: { chave: "eclipseChance", quando: (v) => Number(v) > 0, texto: "Central.com_chance_de_eclipse_0_nunca" } },
        { chave: "jogadoresVeemLuasOcultas" }
      ] },
      { id: "luz", titulo: "Central.luz_e_nevoa_de_guerra", icone: "fa-sun", campos: [
        { chave: "visaoDiaNoite" },
        { chave: "visaoLimite", depende: { chave: "visaoDiaNoite", quando: (v) => v === true, texto: "Central.precisa_de_nevoa_de_guerra_com" } },
        { chave: "visaoLigarTokens", depende: { chave: "visaoDiaNoite", quando: (v) => v === true, texto: "Central.precisa_de_nevoa_de_guerra_com" } },
        { chave: "visaoDiaAberto", depende: { chave: "visaoDiaNoite", quando: (v) => v === true, texto: "Central.precisa_de_nevoa_de_guerra_com" } }
      ] }
    ],
    botoes: [
      { acao: "abrirLuz", rotulo: "Comum.luz_por_hora", icone: "fa-sun", dica: "Central.nivel_de_luz_de_cada_hora" },
      { acao: "abrirEditor", rotulo: "Central.editor_do_calendario", icone: "fa-gear", dica: "Central.meses_semanas_estacoes_luas_e_eras" }
    ]
  },
  {
    id: "eventos", rotulo: "Central.eventos_e_diarios", icone: "fa-book-open",
    lema: "Central.notas_do_calendario_historico_e_ligacao",
    secoes: [
      { id: "notas", titulo: "Central.notas_e_eventos", icone: "fa-calendar-day", campos: [
        { chave: "editorNotas", integracao: "journal" },
        { chave: "abrirNoJournal", integracao: "journal" },
        { chave: "pastaPorAno" }
      ] },
      { id: "historico", titulo: "Comum.historico", icone: "fa-scroll", campos: [
        { chave: "historicoJogadores" }
      ] },
      { id: "journal", titulo: "Central.journal_da_mesa", icone: "fa-store", campos: [
        { chave: "integrarJournal", integracao: "journal" },
        { chave: "avisoSemana" }
      ] }
    ],
    botoes: [
      { acao: "abrirHistorico", rotulo: "Comum.historico_da_campanha", icone: "fa-scroll" },
      { acao: "abrirCalendario", rotulo: "Central.janela_do_calendario", icone: "fa-calendar-days" }
    ]
  },
  {
    id: "ferramentas", rotulo: "Central.ferramentas", icone: "fa-toolbox",
    lema: "Central.viagem_encontros_e_manutencao",
    secoes: [
      { id: "manutencao", titulo: "Central.manutencao", icone: "fa-screwdriver-wrench", campos: [
        { chave: "recarregarAoMudar" }
      ] }
    ],
    botoes: [
      { acao: "abrirTabelas", rotulo: "Comum.tabelas_de_encontro_da_viagem", icone: "fa-table-list", dica: "Central.quais_tabelas_aparecem_na_janela_de" },
      { acao: "abrirContadores", rotulo: "Comum.contadores_e_prazos", icone: "fa-hourglass-half" },
      { acao: "diagnostico", rotulo: "Central.diagnostico_do_clima", icone: "fa-stethoscope", dica: "Central.mostra_no_console_f12_o_clima" }
    ]
  }
];

/** Todas as chaves que a Central mostra (elas saem da lista padrão de configurações do Foundry). */
export const CHAVES_CENTRAL = new Set(ABAS_CENTRAL.flatMap((a) => a.secoes.flatMap((s) => s.campos.map((c) => c.chave))));
