/* =========================================================
 * Calendário da Mesa — Foundry VTT v14
 * Usa o tempo nativo do Foundry (game.time + CalendarData) com um calendário próprio, HUD, luas,
 * estações, clima, notas e integração com o Journal da Mesa (journal-mesa).
 *
 * Arquivo de entrada (module.json → esmodules): registra as configurações e os menus (init), aplica o
 * calendário (setup), monta a API, o HUD e o socket (ready) e liga os hooks do Foundry. O código de cada
 * assunto fica no arquivo dele:
 *   nucleo.js     tradução, utilidades, configuração do calendário (CFG), vários calendários e caches
 *   datas.js      dias, meses, anos, textos de data e hora, @Data/@Hoje
 *   luas.js       fases, ciclos e eventos das luas
 *   notas.js      notas, repetição e ações das notas
 *   luz.js        luz do mapa por hora
 *   relogio.js    passagem do tempo, efeitos vencidos, desfazer, relógio em tempo real
 *   clima.js, clima-efeitos.js, clima-cenas.js   clima, efeitos visuais e clima nas cenas/regiões
 *   historico.js, contadores.js, lojas.js, viagem.js
 *   janela.js     HUD e janela do calendário
 *   socket.js     pedidos dos jogadores ao mestre
 *   api.js        API pública (game.modules.get("calendario-mesa").api)
 *   central.js    Central de Configurações; sob-demanda.js + ferramentas/  janelas abertas sob demanda
 * ========================================================= */

import { montarApi } from "./api.js";
import { CHAVES_CENTRAL } from "./central-mapa.js";
import { CentralConfig } from "./central.js";
import { aplicarClimaNasCenas, registrarRegiaoDeClima } from "./clima-cenas.js";
import { PREFIXO_EFEITO, PREVIA, redesenharClima, registrarEfeitosDeClima, registrarEfeitosPersonalizados } from "./clima-efeitos.js";
import { ANOMALIAS, ANOMALIAS_PADRAO, atualizarClima, CLIMAS, CLIMAS_PADRAO, ESCOLHAS_ZONAS, GRUPOS_CLIMA, recarregarTiposDeClima, ZONAS, ZONAS_PADRAO } from "./clima.js";
import { calendarioDoSistema, corrigirDeltasDnd5e, prepararHudDoSistema } from "./compat-dnd5e.js";
import { registrarEnrichers } from "./datas.js";
import { JanelaLuz, JanelaTabelas } from "./ferramentas/configuracoes.js";
import { registrarSessao } from "./historico.js";
import { HUD, JanelaCalendario, rerenderJanelas } from "./janela.js";
import { FASES_PADRAO, UNIDADE_SING, UNIDADES } from "./luas.js";
import { aplicarLuz, estadoLuz, visaoDiaNoite } from "./luz.js";
import { AVISOS, FIM, ICONES, MODOS_CENA, REPETIR } from "./notas.js";
import { aplicarCalendario, CACHE_CAL, CAL_ID, guardarCalendarioAnterior, idAtivo, limparCache, MOD, num, PRESET_ELEMENTOS, relatarErro, souGMPrincipal, T } from "./nucleo.js";
import { aoMudarTempo, iniciarRelogio, marcarTempo } from "./relogio.js";
import { ouvirSocket } from "./socket.js";
import { PainelVigia } from "./viagem.js";

/** Textos de fábrica definidos no carregamento do módulo (antes de o Foundry ler lang/): no i18nInit, troca pelo
 *  idioma carregado. Só nomes e descrições; ids e chaves não mudam. Dados criados pelo mestre não passam aqui. */
function traduzirConstantes() {
  const tr = (o, campos) => { for (const c of campos) if (typeof o?.[c] === "string") o[c] = T(o[c]); };
  const valores = (mapa) => { for (const k of Object.keys(mapa)) if (typeof mapa[k] === "string") mapa[k] = T(mapa[k]); };
  for (const mapa of [REPETIR, FIM, ICONES, AVISOS, MODOS_CENA, GRUPOS_CLIMA, UNIDADES, UNIDADE_SING]) valores(mapa);
  for (const f of FASES_PADRAO) tr(f, ["nome"]);
  for (const grupo of [CLIMAS, CLIMAS_PADRAO]) for (const c of Object.values(grupo)) tr(c, ["nome", "desc"]);
  for (const grupo of [ZONAS, ZONAS_PADRAO]) for (const z of Object.values(grupo)) tr(z, ["nome"]);
  for (const grupo of [ANOMALIAS, ANOMALIAS_PADRAO]) for (const a of Object.values(grupo)) tr(a, ["nome", "texto"]);
  for (const k of Object.keys(ESCOLHAS_ZONAS)) if (typeof ESCOLHAS_ZONAS[k] === "string") ESCOLHAS_ZONAS[k] = T(ESCOLHAS_ZONAS[k]);
  const p = PRESET_ELEMENTOS;
  tr(p, ["nome"]);
  for (const d of p.semana) tr(d, ["nome", "abrev"]);
  for (const m of p.meses) { const pt = m.nome; tr(m, ["nome"]); if (m.nome !== pt) m.abrev = m.nome.slice(0, 3); }
  for (const e of p.estacoes) tr(e, ["nome"]);
  for (const l of p.luas) tr(l, ["nome"]);
  for (const [id, ef] of Object.entries(CONFIG.weatherEffects ?? {})) if (id.startsWith("cm-") && typeof ef?.label === "string") ef.label = T(ef.label);
}
Hooks.once("i18nInit", () => {
  try { traduzirConstantes(); } catch (err) { console.warn(`${MOD} | tradução dos textos de fábrica`, err); }
});

/* ---------------- recarregar ao mudar configurações ----------------
 * Guarda as opções de módulos (as que aparecem na janela de configurações) mudadas enquanto a janela está
 * aberta. Ao fechar a janela, recarrega: só este computador (opções do usuário) ou todos (opções do mundo). */
const RECARGA = { mudou: false, mundo: false, chaves: new Set() };
function configuracaoMudou(chave, mundo) {
  const modo = (() => { try { return game.settings.get(MOD, "recarregarAoMudar"); } catch { return "nao"; } })();
  if (modo === "nao" || !chave) return;
  const [ns] = String(chave).split(".");
  if (ns === "core" || !game.modules.get(ns)) return;
  if (modo === "calendario" && ns !== MOD) return;
  const def = game.settings.settings.get(chave);
  if (!def?.config) return;                         // só as que aparecem na janela (não as internas)
  if (!foundry.applications.instances.get("settings-config")?.rendered) return;   // mudadas por código, não pela janela
  RECARGA.mudou = true; RECARGA.chaves.add(chave);
  if (mundo || def.scope === "world") RECARGA.mundo = true;
}
function recarregarSePreciso() {
  if (!RECARGA.mudou) return;
  const todos = RECARGA.mundo && game.user.isGM;
  const n = RECARGA.chaves.size;
  RECARGA.mudou = false; RECARGA.mundo = false; RECARGA.chaves.clear();
  ui.notifications.info(todos ? T("Comum.n_opcao_oes_mudada_s_recarregando", { n }) : T("Comum.n_opcao_oes_mudada_s_recarregando_2", { n }));
  setTimeout(() => {
    try { if (todos) game.socket.emit("reload"); } catch (err) { console.warn(`${MOD} | recarregar jogadores`, err); }
    (foundry.utils.debouncedReload ?? (() => window.location.reload()))();
  }, 900);
}
Hooks.on("updateSetting", (doc) => configuracaoMudou(doc?.key, true));
Hooks.on("createSetting", (doc) => configuracaoMudou(doc?.key, true));
Hooks.on("clientSettingChanged", (chave) => configuracaoMudou(chave, false));
Hooks.on("closeSettingsConfig", () => recarregarSePreciso());

Hooks.once("init", () => {
  Handlebars.registerHelper("cmT", (texto) => T(String(texto ?? "")));
  // As configurações mostradas na Central de Configurações saem da lista padrão do Foundry (config: false).
  // O registro continua o mesmo: id, escopo, tipo, padrão, opções e onChange não mudam, e os valores salvos ficam.
  const S = (k, o) => game.settings.register(MOD, k, CHAVES_CENTRAL.has(k) ? { ...o, config: false } : o);
  game.settings.registerMenu(MOD, "menuCentral", {
    name: "CALMESA.Comum.central_de_configuracoes", label: "CALMESA.Config.abrir_central_de_configuracoes",
    hint: "CALMESA.Config.todas_as_opcoes_do_calendario_da",
    icon: "fa-solid fa-star-and-crescent", type: CentralConfig, restricted: false
  });
  registrarEnrichers();
  registrarRegiaoDeClima();
  registrarEfeitosDeClima();
  // salvar o calendário principal grava os dois settings em seguida: um só recálculo para os dois
  const recarregar = foundry.utils.debounce(() => { CACHE_CAL.clear(); aplicarCalendario(); rerenderJanelas(); }, 50);
  S("config", { scope: "world", config: false, type: Object, default: PRESET_ELEMENTOS, onChange: recarregar });
  S("calendarios", { scope: "world", config: false, type: Object, default: {}, onChange: recarregar });
  S("calendarioVisto", { scope: "client", config: false, type: String, default: "", onChange: () => { aplicarCalendario(); rerenderJanelas(); } });
  S("tema", {
    name: "CALMESA.Config.tema", hint: "CALMESA.Config.visual_do_hud_e_da_janela", scope: "client", config: true, type: String,
    choices: { journal: "CALMESA.Config.igual_ao_journal_da_mesa", claro: "CALMESA.Config.claro_fantasia", vitoriano: "CALMESA.Config.vitoriano", noite: "CALMESA.Comum.noite" }, default: "journal", onChange: rerenderJanelas
  });
  S("mostrarHud", { name: "CALMESA.Config.mostrar_o_hud_do_calendario", scope: "client", config: true, type: Boolean, default: true, onChange: rerenderJanelas });
  S("posHud", { scope: "client", config: false, type: Object, default: {} });
  S("hudDnd5e", {
    name: "CALMESA.Config.hud_de_calendario_do_d_d", hint: "CALMESA.Config.o_d_d_5e_tem_o",
    scope: "world", config: !!globalThis.dnd5e, type: String, choices: { esconder: "CALMESA.Config.esconder_usar_so_o_do_calendario", mostrar: "CALMESA.Config.mostrar_os_dois" }, default: "esconder", requiresReload: true
  });
  S("hudModo", { scope: "client", config: false, type: String, default: "completo" });
  S("hudCompacto", { scope: "client", config: false, type: Boolean, default: false });
  S("editorNotas", {
    name: "CALMESA.Config.quem_cria_e_edita_as_notas", hint: "CALMESA.Config.journal_da_mesa_nova_nota_cria",
    scope: "world", config: true, type: String, choices: { journal: "CALMESA.Config.journal_da_mesa_quando_ativo", calendario: "CALMESA.Comum.calendario" }, default: "journal", onChange: () => foundry.applications.instances.get("cm-calendario")?.render()
  });
  S("abrirNoJournal", { name: "CALMESA.Config.abrir_notas_no_journal_da_mesa", hint: "CALMESA.Config.se_o_modulo_journal_da_mesa", scope: "client", config: true, type: Boolean, default: true });
  S("jogadoresVeemHora", { name: "CALMESA.Config.jogadores_veem_a_hora_exata", hint: "CALMESA.Config.desligado_eles_veem_so_madrugada_manha", scope: "world", config: true, type: Boolean, default: true, onChange: rerenderJanelas });
  S("pastaNotas", { scope: "world", config: false, type: String, default: "" });
  S("pastaPorAno", { name: "CALMESA.Config.notas_em_subpastas_por_ano", hint: "CALMESA.Config.dentro_da_pasta_escolhida_cada_nota", scope: "world", config: true, type: Boolean, default: false });
  S("jogadoresVeemLuasOcultas", { name: "CALMESA.Config.jogadores_sabem_quando_uma_lua_volta", hint: "CALMESA.Config.no_painel_do_dia_mostra_as", scope: "world", config: true, type: Boolean, default: false });
  S("relogioAtivo", { scope: "world", config: false, type: Boolean, default: false, onChange: rerenderJanelas });
  S("relogioTaxa", { name: "CALMESA.Config.velocidade_do_relogio_em_tempo_real", hint: "CALMESA.Config.segundos_de_jogo_por_segundo_real", scope: "world", config: true, type: Number, default: 1 });
  S("pausaJogo", { name: "CALMESA.Config.relogio_para_quando_o_jogo_esta", scope: "world", config: true, type: Boolean, default: true });
  S("pausaCombate", { name: "CALMESA.Config.relogio_para_durante_o_combate", hint: "CALMESA.Config.no_combate_o_foundry_ja_avanca", scope: "world", config: true, type: Boolean, default: true });
  S("luz", { scope: "world", config: false, type: Object, default: {}, onChange: () => { if (game.ready) aplicarLuz(estadoLuz(game.time.worldTime), 1500).catch((err) => relatarErro("Erros.luz_das_cenas", err)); } });
  game.settings.registerMenu(MOD, "menuLuz", {
    name: "CALMESA.Config.luz_do_mapa", label: "CALMESA.Comum.luz_por_hora", hint: "CALMESA.Config.nivel_de_luz_de_cada_hora",
    icon: "fa-solid fa-sun", type: JanelaLuz, restricted: true
  });
  S("historico", { scope: "world", config: false, type: Object, default: { itens: [] }, onChange: () => foundry.applications.instances.get("cm-historico")?.render() });
  // quando (hora real, em ms) a última "Sessão de jogo" entrou no histórico: um F5 no meio da sessão não registra outra
  S("ultimaSessao", { scope: "world", config: false, type: Number, default: 0 });
  S("historicoJogadores", { name: "CALMESA.Config.jogadores_veem_o_historico", hint: "CALMESA.Config.libera_o_botao_do_historico_da", scope: "world", config: true, type: Boolean, default: false, onChange: rerenderJanelas });
  S("climaZonas", { scope: "world", config: false, type: Object, default: { zonas: {} }, onChange: () => HUD.render() });
  S("climaAtual", { scope: "world", config: false, type: Object, default: {}, onChange: () => HUD.render() });
  S("anomaliasAtivas", { name: "CALMESA.Config.ativar_a_barra_de_anomalias", hint: "CALMESA.Config.mostra_a_aba_anomalias_na_janela", scope: "world", config: true, type: Boolean, default: true, onChange: () => {
    recarregarTiposDeClima(); HUD.render(); foundry.applications.instances.get("cm-clima")?.render();
  } });
  S("anomaliaRegiaoInteira", { name: "CALMESA.Config.anomalia_cobrindo_uma_regiao_inteira", hint: "CALMESA.Config.ligado_da_para_ativar_uma_anomalia", scope: "world", config: true, type: Boolean, default: false, onChange: () => {
    HUD.render(); foundry.applications.instances.get("cm-clima")?.render();
  } });
  S("climaTipos", { scope: "world", config: false, type: Object, default: { climas: {}, zonas: {}, anomalias: {}, efeitos: {} }, onChange: () => {
    recarregarTiposDeClima();
    registrarEfeitosPersonalizados();
    redesenharClima({ so: (w) => String(w).startsWith(PREFIXO_EFEITO) });
    aplicarClimaNasCenas();   // um clima pode ter trocado de efeito, ou um efeito pode ter sido apagado
    HUD.render();
    foundry.applications.instances.get("cm-clima")?.render();
  } });
  recarregarTiposDeClima();
  S("zonaPadrao", { name: "CALMESA.Config.regiao_padrao_do_clima", hint: "CALMESA.Config.usada_nas_cenas_que_nao_escolheram", scope: "world", config: true, type: String,
    choices: ESCOLHAS_ZONAS, default: "temperada", onChange: () => HUD.render() });
  S("visaoDiaNoite", { name: "CALMESA.Config.nevoa_de_guerra_com_o_dia", hint: "CALMESA.Config.nas_cenas_com_dia_noite_do", scope: "world", config: true, type: Boolean, default: false, onChange: () => { if (game.ready) aplicarLuz(estadoLuz(game.time.worldTime), 800).catch((err) => relatarErro("Erros.luz_das_cenas", err)); } });
  S("visaoLimite", { name: "CALMESA.Config.escuridao_em_que_a_noite_esconde", hint: "CALMESA.Config.0_qualquer_escuridao_ja_esconde_1", scope: "world", config: true, type: Number, range: { min: 0, max: 1, step: 0.05 }, default: 0.6, onChange: () => { if (game.ready && visaoDiaNoite()) aplicarLuz(estadoLuz(game.time.worldTime), 800).catch((err) => relatarErro("Erros.luz_das_cenas", err)); } });
  S("tabelasEncontro", { scope: "world", config: false, type: Object, default: { ids: [] } });
  game.settings.registerMenu(MOD, "menuTabelas", {
    name: "CALMESA.Comum.tabelas_de_encontro_da_viagem", label: "CALMESA.Config.escolher_tabelas", hint: "CALMESA.Config.quais_tabelas_aparecem_em_tabela_de",
    icon: "fa-solid fa-table-list", type: JanelaTabelas, restricted: true
  });
  S("efeitosVencidos", { name: "CALMESA.Config.efeitos_com_duracao_vencidos", hint: "CALMESA.Config.quando_o_tempo_passa_o_que", scope: "world", config: true, type: String,
    choices: { remover: "CALMESA.Config.remover_da_ficha", desativar: "CALMESA.Config.desativar_fica_na_ficha_desligado", nao: "CALMESA.Config.nao_mexer" }, default: "nao" });
  S("efeitosAviso", { name: "CALMESA.Config.avisar_o_mestre_quando_efeitos_acabarem", scope: "world", config: true, type: Boolean, default: true });
  S("luasAviso", { name: "CALMESA.Config.eventos_das_luas_no_chat", hint: "CALMESA.Config.luas_cheias_juntas_eclipses_e_noites", scope: "world", config: true, type: String, choices: { nenhum: "CALMESA.Config.nao_avisar", mestre: "CALMESA.Comum.so_o_mestre", todos: "CALMESA.Comum.todos" }, default: "todos" });
  S("eclipseChance", { name: "CALMESA.Config.chance_de_eclipse_por_ciclo_lunar", hint: "CALMESA.Config.a_cada_lua_nova_eclipse_solar", scope: "world", config: true, type: Number, range: { min: 0, max: 100, step: 1 }, default: 15, onChange: () => { limparCache(); rerenderJanelas(); } });
  S("eclipseMudaClima", { name: "CALMESA.Config.eclipse_solar_muda_o_clima_do", hint: "CALMESA.Config.no_dia_de_um_eclipse_solar", scope: "world", config: true, type: Boolean, default: false });
  S("climaPrevisao", { scope: "world", config: false, type: Object, default: { dias: {} }, onChange: () => foundry.applications.instances.get("cm-clima")?.render() });
  S("previsaoDias", { name: "CALMESA.Config.dias_de_previsao_do_tempo", hint: "CALMESA.Config.quantos_dias_a_frente_o_mestre", scope: "world", config: true, type: Number, range: { min: 3, max: 7, step: 1 }, default: 5 });
  S("recarregarAoMudar", { name: "CALMESA.Config.recarregar_ao_mudar_configuracoes_de_modulos", hint: "CALMESA.Config.quando_voce_muda_alguma_opcao_de", scope: "world", config: true, type: String,
    choices: { todos: "CALMESA.Config.qualquer_modulo", calendario: "CALMESA.Config.so_o_calendario_da_mesa", nao: "CALMESA.Config.nao_recarregar" }, default: "todos" });
  S("usarFXMaster", { name: "CALMESA.Config.usar_o_fxmaster_nos_climas", hint: "CALMESA.Config.com_o_fxmaster_ativo_cada_clima", scope: "world", config: true, type: Boolean, default: true, onChange: () => { aplicarClimaNasCenas().catch((err) => relatarErro("clima das cenas", err)); } });
  S("climaVariacao", { name: "CALMESA.Config.variacao_da_temperatura", hint: "CALMESA.Config.quanto_a_temperatura_de_um_dia", scope: "world", config: true, type: String,
    choices: { baixa: "CALMESA.Config.baixa_dias_parecidos", normal: "CALMESA.Comum.normal", alta: "CALMESA.Config.alta", extrema: "CALMESA.Config.extrema_dias_muito_diferentes" }, default: "normal" });
  S("climaChat", { name: "CALMESA.Config.clima_do_dia_no_chat", scope: "world", config: true, type: String, choices: { nenhum: "CALMESA.Config.nao_avisar", mestre: "CALMESA.Comum.so_o_mestre", todos: "CALMESA.Comum.todos" }, default: "mestre" });
  S("climaCenasSemRegiao", { name: "CALMESA.Config.clima_nas_cenas_sem_regiao_propria", hint: "CALMESA.Config.cenas_que_nao_escolheram_uma_regiao", scope: "world", config: true, type: String,
    choices: { todas: "CALMESA.Config.todas_as_cenas", marcadas: "CALMESA.Config.so_as_cenas_marcadas" }, default: "todas", onChange: () => aplicarClimaNasCenas() });
  S("climaVisual", { name: "CALMESA.Config.efeito_de_clima_nas_cenas", hint: "CALMESA.Config.chuva_neve_neblina_do_foundry_ou", scope: "world", config: true, type: Boolean, default: true });
  S("climaUnidade", { name: "CALMESA.Config.temperatura_em", scope: "world", config: true, type: String, choices: { C: "CALMESA.Config.celsius_c", F: "CALMESA.Config.fahrenheit_f" }, default: "C", onChange: () => HUD.render() });
  S("contadores", { scope: "world", config: false, type: Object, default: { lista: [] }, onChange: () => { foundry.applications.instances.get("cm-contadores")?.render(); HUD.render(); } });
  S("cinemaMundo", { name: "CALMESA.Config.animacao_ao_pular_muito_tempo", hint: "CALMESA.Config.mostra_para_todos_uma_passagem_de", scope: "world", config: true, type: Boolean, default: true });
  S("cinemaHoras", { name: "CALMESA.Config.a_partir_de_quantas_horas_animar", scope: "world", config: true, type: Number, default: 24 });
  S("cinema", { name: "CALMESA.Config.ver_a_animacao_de_passagem_de", hint: "CALMESA.Config.desligue_so_para_voce", scope: "client", config: true, type: Boolean, default: true });
  S("integrarJournal", { name: "CALMESA.Config.ligar_ao_journal_da_mesa", hint: "CALMESA.Config.o_dia_das_ofertas_diarias_do", scope: "world", config: true, type: Boolean, default: true });
  S("viagem", { scope: "world", config: false, type: Object, default: {}, onChange: () => {
    PainelVigia.render();
    foundry.applications.instances.get("cm-viagem")?.render();
    HUD.render();
  } });
  S("avisoSemana", { name: "CALMESA.Config.avisar_nova_semana", hint: "CALMESA.Config.avisa_o_mestre_no_chat_quando", scope: "world", config: true, type: Boolean, default: true });
});

// O calendário do mundo é aplicado no "setup", depois que o sistema terminou o "init" (D&D 5e: compat-dnd5e.js).
Hooks.once("setup", () => {
  registrarEfeitosPersonalizados();
  guardarCalendarioAnterior(calendarioDoSistema() ?? CONFIG.time.worldCalendarConfig);
  aplicarCalendario();
  prepararHudDoSistema(game.settings.get(MOD, "hudDnd5e") === "esconder");
});

Hooks.once("ready", () => {
  aplicarCalendario();
  game.modules.get(MOD).api = montarApi();
  HUD.montar();
  HUD.render();
  PainelVigia.render();
  iniciarRelogio();
  ouvirSocket();
  // links de data nos textos (@Data[...] e @Hoje)
  document.body.addEventListener("click", (ev) => {
    const a = ev.target.closest?.(".cm-link-data[data-td]");
    if (!a) return;
    ev.preventDefault();
    JanelaCalendario.abrir(num(a.dataset.td));
  });
  if (souGMPrincipal()) {
    registrarSessao().catch((err) => relatarErro(T("Config.historico"), err));
    atualizarClima().catch((err) => relatarErro("Erros.clima", err));
  }
});

Hooks.on("updateWorldTime", (wt, delta, options) => {
  marcarTempo();
  corrigirDeltasDnd5e(wt, delta, options);
  aoMudarTempo(wt, delta).catch((err) => console.error(`${MOD} |`, err));
});
Hooks.on("canvasReady", () => {
  // prévia de efeito de outra cena: acaba (a cena nova já desenhou o próprio clima; nada é restaurado nela)
  if (PREVIA.cenaId && PREVIA.cenaId !== canvas?.scene?.id) { PREVIA.cenaId = null; PREVIA.ef = null; foundry.applications.instances.get("cm-clima")?.render(); }
  // o mestre confere o clima das cenas (só grava o que estiver diferente)
  if (souGMPrincipal() && game.ready) aplicarClimaNasCenas();
  if (idAtivo() !== CAL_ID) { aplicarCalendario(); rerenderJanelas(); }
  HUD.render();
  PainelVigia.render();
  aplicarLuz(estadoLuz(game.time.worldTime), 0).catch((err) => relatarErro("Erros.luz_das_cenas", err));
});
Hooks.on("updateScene", (cena, mudou) => {
  // região da cena ou "mostrar o clima" mudou por fora da janela do clima: o mestre reaplica
  const f = mudou?.flags?.[MOD];
  if (f && souGMPrincipal() && ["zona", "-=zona", "climaNaCena", "-=climaNaCena"].some((k) => k in f)) aplicarClimaNasCenas();
  if (cena.id === canvas?.scene?.id && mudou?.flags?.[MOD]?.zonaAtiva !== undefined) HUD.render();
  if (cena.id === canvas?.scene?.id && mudou?.flags?.[MOD] !== undefined && idAtivo() !== CAL_ID) { aplicarCalendario(); rerenderJanelas(); }
});
Hooks.on("pauseGame", () => HUD.render());

for (const h of ["createJournalEntry", "updateJournalEntry", "deleteJournalEntry"]) {
  Hooks.on(h, (doc, mudou) => {
    if (doc.getFlag?.(MOD, "nota") || (h === "updateJournalEntry" && mudou?.flags?.[MOD] !== undefined)) {
      foundry.applications.instances.get("cm-calendario")?.render();
    }
  });
}

// botão no topo da aba de Diários
Hooks.on("renderJournalDirectory", (app, html) => {
  const root = html;
  if (!root || root.querySelector(".cm-abrir")) return;
  const b = document.createElement("button");
  b.type = "button";
  b.className = "cm-abrir";
  b.innerHTML = `<i class="fa-solid fa-calendar-days"></i> ${T("Comum.calendario")}`;
  b.addEventListener("click", () => JanelaCalendario.abrir());
  (root.querySelector(".header-actions") ?? root.querySelector(".directory-header") ?? root).append(b);
});