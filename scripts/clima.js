/* =========================================================
 * Calendário da Mesa — Clima
 * Tipos de clima, regiões e anomalias (de fábrica e criados pelo mestre), sorteio do clima e da
 * temperatura, clima do dia e previsão do tempo.
 * ========================================================= */

import { aplicarClimaNasCenas, TIPO_CLIMA } from "./clima-cenas.js";
import { corHex, normalizarEfeito } from "./clima-efeitos.js";
import { agora, estacaoDe, infoDia } from "./datas.js";
import { registrar } from "./historico.js";
import { eventosLuasDoDia } from "./luas.js";
import { CFG, chat, esc, estacoesOrdenadas, idsGM, MOD, naFila, num, souGMPrincipal, T } from "./nucleo.js";

/* ---------------- previsão do tempo ----------------
 * climaPrevisao = { dias: { td: { zona: { tipo, temp, min, max, onda? } } } }. O mestre vê e ajusta os
 * próximos dias; quando o dia chega, o clima sai da previsão em vez de ser rolado. */
const previsao = () => { const p = game.settings.get(MOD, "climaPrevisao"); return p && typeof p === "object" ? { dias: p.dias ?? {} } : { dias: {} }; };
async function gerarPrevisao(zonas = zonasEmUso(), dias = num(game.settings.get(MOD, "previsaoDias"), 5), { refazer = false } = {}) {
  if (!game.user.isGM) return previsao();
  return naFila("previsao", async () => {
    const p = foundry.utils.deepClone(previsao());
    const hoje = agora().td;
    for (let td = hoje + 1; td <= hoje + dias; td++) {
      p.dias[td] ??= {};
      for (const z of zonas) if (refazer || !p.dias[td][z]) p.dias[td][z] = rolarClima(z, td);
    }
    await game.settings.set(MOD, "climaPrevisao", p);
    return p;
  });
}
async function definirPrevisao(td, zona, clima) {
  if (!game.user.isGM) return;
  return naFila("previsao", async () => {
    const p = foundry.utils.deepClone(previsao());
    p.dias[td] ??= {};
    if (clima == null) delete p.dias[td][zona];
    else p.dias[td][zona] = clima;
    await game.settings.set(MOD, "climaPrevisao", p);
  });
}

/* ---------------- clima por região ---------------- */

/* Tipos de tempo. efeito = efeito de clima mostrado na cena (os "cm-*" são variações registradas por este
 * módulo a partir dos efeitos nativos do Foundry; reserva = efeito nativo usado se a variação não existir).
 * temp = quanto o tipo muda a temperatura do dia (°C). grupo = onde aparece na janela de escolha. */
const CLIMAS = {
  limpo:        { nome: "Clima.ceu_limpo",            icone: "fa-sun",                  efeito: "",                 temp: 1,  grupo: "ceu",   desc: "Clima.ceu_aberto_e_sol_firme" },
  poucasNuvens: { nome: "Clima.poucas_nuvens",        icone: "fa-cloud-sun",            efeito: "",                 temp: 0,  grupo: "ceu",   desc: "Clima.algumas_nuvens_passam_devagar" },
  nublado:      { nome: "Clima.nublado",              icone: "fa-cloud",                efeito: "",                 temp: -1, grupo: "ceu",   desc: "Clima.nuvens_cobrem_boa_parte_do_ceu" },
  encoberto:    { nome: "Clima.ceu_encoberto",        icone: "fa-cloud",                efeito: "cm-encoberto",     reserva: "fog", temp: -2, grupo: "ceu", desc: "Clima.um_teto_cinzento_e_pesado_sem" },
  neblina:      { nome: "Clima.neblina",              icone: "fa-smog",                 efeito: "fog",              temp: -1, grupo: "nevoa", desc: "Clima.a_neblina_esconde_o_que_esta" },
  neblinaDensa: { nome: "Clima.nevoeiro_denso",       icone: "fa-smog",                 efeito: "cm-neblinaDensa",  reserva: "fog", temp: -2, grupo: "nevoa", desc: "Clima.mal_se_ve_a_propria_mao" },
  garoa:        { nome: "Clima.garoa",                icone: "fa-cloud-rain",           efeito: "cm-garoa",         reserva: "rain", temp: -1, grupo: "chuva", desc: "Clima.uma_chuva_fina_e_constante" },
  chuva:        { nome: "Comum.chuva",                icone: "fa-cloud-rain",           efeito: "rain",             temp: -2, grupo: "chuva", desc: "Clima.chuva_firme_o_chao_vira_lama" },
  aguaceiro:    { nome: "Clima.aguaceiro",            icone: "fa-cloud-showers-heavy",  efeito: "cm-aguaceiro",     reserva: "rainStorm", temp: -3, grupo: "chuva", desc: "Clima.chuva_forte_quase_uma_parede_de" },
  chuvaNeblina: { nome: "Clima.chuva_com_neblina",    icone: "fa-cloud-showers-water",  efeito: "cm-chuvaNeblina",  reserva: "rain", temp: -2, grupo: "chuva", desc: "Clima.chuva_miuda_e_nevoa_baixa_entre" },
  tempestade:   { nome: "Clima.tempestade",           icone: "fa-cloud-bolt",           efeito: "rainStorm",        temp: -3, grupo: "chuva", desc: "Clima.raios_trovoes_e_rajadas_de_chuva" },
  granizo:      { nome: "Clima.granizo",              icone: "fa-cloud-meatball",       efeito: "cm-granizo",       reserva: "rainStorm", temp: -5, grupo: "chuva", desc: "Clima.pedras_de_gelo_batem_com_forca" },
  neveLeve:     { nome: "Clima.neve_fraca",           icone: "fa-snowflake",            efeito: "cm-neveLeve",      reserva: "snow", temp: -3, grupo: "frio", desc: "Clima.flocos_esparsos_caem_sem_pressa" },
  neve:         { nome: "Comum.neve",                 icone: "fa-snowflake",            efeito: "snow",             temp: -4, grupo: "frio", desc: "Clima.neve_continua_cobre_as_trilhas" },
  nevasca:      { nome: "Clima.nevasca",              icone: "fa-icicles",              efeito: "blizzard",         temp: -7, grupo: "frio", desc: "Clima.vento_e_neve_cegam_viajar_e" },
  frioIntenso:  { nome: "Clima.frio_intenso",         icone: "fa-temperature-low",      efeito: "",                 temp: -9, grupo: "frio", desc: "Clima.ceu_limpo_e_um_frio_que" },
  vento:        { nome: "Clima.ventania",             icone: "fa-wind",                 efeito: "leaves",           temp: -2, grupo: "vento", desc: "Clima.rajadas_fortes_levantam_folhas_e_poeira" },
  areia:        { nome: "Clima.tempestade_de_areia",  icone: "fa-hurricane",            efeito: "cm-areia",         reserva: "fog", temp: 2, grupo: "vento", desc: "Clima.areia_no_ar_arranha_os_olhos" },
  calor:        { nome: "Clima.calor_extremo",        icone: "fa-temperature-high",     efeito: "",                 temp: 7,  grupo: "vento", desc: "Clima.o_ar_tremula_de_calor_a" },
  cinzas:       { nome: "Clima.chuva_de_cinzas",      icone: "fa-volcano",              efeito: "cm-cinzas",        reserva: "snow", temp: 3, grupo: "vento", desc: "Clima.cinzas_mornas_caem_do_ceu_e" },
  raiosSecos:   { nome: "Clima.relampagos_secos",     icone: "fa-bolt",                 efeito: "cm-relampago",     temp: 0,  grupo: "vento", desc: "Clima.claroes_no_ceu_sem_uma_gota" },
  aurora:       { nome: "Clima.aurora",               icone: "fa-wand-magic-sparkles",  efeito: "cm-aurora",        temp: -3, grupo: "ceu",   desc: "Clima.faixas_de_luz_verde_e_violeta" },
  eclipse:      { nome: "Clima.eclipse",              icone: "fa-circle-half-stroke",   efeito: "cm-eclipse",       temp: -4, grupo: "ceu",   desc: "Clima.a_luz_some_aos_poucos_os" }
};

/* Efeito do FXMaster de cada clima de fábrica (preset da API dele). Só vale com o FXMaster ativo e se o
 * preset existir no mundo; sem ele, o clima usa o efeito do Foundry acima. */
const FX_PADRAO = {
  poucasNuvens: "partly-cloudy", nublado: "cloudy", encoberto: "overcast", neblina: "mist", neblinaDensa: "fog",
  garoa: "drizzle", chuva: "rain", aguaceiro: "monsoon", chuvaNeblina: "rolling-fog", tempestade: "thunderstorm", granizo: "hail",
  neveLeve: "snow", neve: "snow", nevasca: "blizzard", frioIntenso: "permafrost-surge", vento: "windy", areia: "sandstorm",
  calor: "heat-wave", cinzas: "ashfall", aurora: "luminous-sky", eclipse: "black-sun"
};
for (const [k, v] of Object.entries(FX_PADRAO)) if (CLIMAS[k]) CLIMAS[k].fx = `fxp:${v}`;
const GRUPOS_CLIMA = { ceu: "Clima.ceu", nevoa: "Comum.nevoa", chuva: "Comum.chuva", frio: "Clima.neve_e_frio", vento: "Clima.vento_e_extremos" };

const zonaDef = (t, p) => ({ temp: t, pesos: p });
const ZONAS = {
  temperada: { nome: "Clima.temperada", ...zonaDef({ primavera: 15, verao: 26, outono: 14, inverno: 2 }, {
    primavera: { limpo: 18, poucasNuvens: 14, nublado: 12, encoberto: 6, garoa: 10, chuva: 14, aguaceiro: 4, tempestade: 5, neblina: 8, chuvaNeblina: 4, vento: 5 },
    verao: { limpo: 30, poucasNuvens: 15, nublado: 8, garoa: 4, chuva: 8, aguaceiro: 6, tempestade: 10, granizo: 2, calor: 12, vento: 5 },
    outono: { limpo: 12, poucasNuvens: 10, nublado: 15, encoberto: 10, garoa: 10, chuva: 12, chuvaNeblina: 6, neblina: 10, neblinaDensa: 4, vento: 11 },
    inverno: { limpo: 12, nublado: 12, encoberto: 12, neblina: 10, neblinaDensa: 5, garoa: 4, neveLeve: 15, neve: 14, nevasca: 4, frioIntenso: 8, granizo: 4 } }) },
  tropical: { nome: "Clima.tropical", ...zonaDef({ primavera: 27, verao: 31, outono: 27, inverno: 23 }, {
    primavera: { limpo: 20, poucasNuvens: 15, nublado: 10, garoa: 8, chuva: 20, aguaceiro: 12, tempestade: 10, calor: 5 },
    verao: { limpo: 12, poucasNuvens: 10, nublado: 10, chuva: 22, aguaceiro: 18, tempestade: 18, chuvaNeblina: 5, calor: 5 },
    outono: { limpo: 25, poucasNuvens: 18, nublado: 12, garoa: 10, chuva: 18, aguaceiro: 7, tempestade: 5, neblina: 5 },
    inverno: { limpo: 35, poucasNuvens: 20, nublado: 12, garoa: 8, chuva: 10, neblina: 8, calor: 7 } }) },
  deserto: { nome: "Clima.deserto", ...zonaDef({ primavera: 30, verao: 40, outono: 30, inverno: 18 }, {
    primavera: { limpo: 45, poucasNuvens: 10, vento: 15, areia: 15, calor: 12, nublado: 3 },
    verao: { limpo: 35, calor: 35, areia: 18, vento: 10, tempestade: 2 },
    outono: { limpo: 45, poucasNuvens: 10, vento: 18, areia: 17, calor: 8, nublado: 2 },
    inverno: { limpo: 50, poucasNuvens: 15, vento: 12, nublado: 8, garoa: 5, frioIntenso: 10 } }) },
  artica: { nome: "Clima.artica", ...zonaDef({ primavera: -8, verao: 3, outono: -10, inverno: -28 }, {
    primavera: { limpo: 15, nublado: 15, encoberto: 10, neveLeve: 22, neve: 20, nevasca: 8, neblina: 5, vento: 5 },
    verao: { limpo: 25, poucasNuvens: 15, nublado: 18, garoa: 8, neveLeve: 14, neblina: 12, vento: 8 },
    outono: { nublado: 18, encoberto: 12, neveLeve: 15, neve: 25, nevasca: 12, vento: 10, frioIntenso: 8 },
    inverno: { encoberto: 12, neve: 25, nevasca: 28, vento: 10, frioIntenso: 20, neblinaDensa: 5, aurora: 6 } }) },
  montanha: { nome: "Comum.montanha", ...zonaDef({ primavera: 6, verao: 15, outono: 5, inverno: -8 }, {
    primavera: { limpo: 18, poucasNuvens: 12, nublado: 15, garoa: 8, chuva: 10, neblina: 15, neblinaDensa: 5, vento: 12, neveLeve: 5 },
    verao: { limpo: 30, poucasNuvens: 15, nublado: 10, tempestade: 14, granizo: 6, vento: 15, chuva: 10 },
    outono: { nublado: 18, encoberto: 10, neblina: 18, neblinaDensa: 10, chuva: 12, garoa: 8, vento: 16, neveLeve: 8 },
    inverno: { neve: 28, nevasca: 20, neveLeve: 12, nublado: 10, vento: 12, frioIntenso: 12, neblinaDensa: 6 } }) },
  // reinos dos elementos: o clima puxa para o elemento dominante
  agua: { nome: "Clima.reino_da_agua", elemento: true, ...zonaDef({ primavera: 16, verao: 24, outono: 15, inverno: 6 }, {
    primavera: { chuva: 22, garoa: 15, chuvaNeblina: 12, neblina: 15, nublado: 14, limpo: 12, aguaceiro: 10 },
    verao: { chuva: 20, aguaceiro: 15, tempestade: 18, garoa: 8, nublado: 14, limpo: 20, chuvaNeblina: 5 },
    outono: { chuva: 20, chuvaNeblina: 15, neblina: 18, neblinaDensa: 8, garoa: 14, nublado: 15, limpo: 10 },
    inverno: { chuva: 14, garoa: 10, neblina: 18, neblinaDensa: 12, neveLeve: 14, neve: 10, nublado: 12, granizo: 10 } }) },
  fogo: { nome: "Clima.reino_do_fogo", elemento: true, ...zonaDef({ primavera: 30, verao: 42, outono: 32, inverno: 22 }, {
    primavera: { limpo: 30, calor: 35, cinzas: 15, poucasNuvens: 10, nublado: 5, tempestade: 5 },
    verao: { calor: 50, cinzas: 20, limpo: 20, tempestade: 5, areia: 5 },
    outono: { limpo: 30, calor: 30, cinzas: 20, poucasNuvens: 10, nublado: 10 },
    inverno: { limpo: 35, calor: 15, cinzas: 15, nublado: 20, poucasNuvens: 15 } }) },
  terra: { nome: "Clima.reino_da_terra", elemento: true, ...zonaDef({ primavera: 16, verao: 25, outono: 15, inverno: 4 }, {
    primavera: { limpo: 30, poucasNuvens: 20, nublado: 20, garoa: 10, chuva: 10, neblina: 10 },
    verao: { limpo: 35, poucasNuvens: 15, nublado: 10, areia: 20, calor: 15, vento: 5 },
    outono: { limpo: 25, nublado: 25, encoberto: 10, neblina: 20, garoa: 10, vento: 10 },
    inverno: { nublado: 30, encoberto: 15, limpo: 20, neveLeve: 15, neve: 10, neblina: 10 } }) },
  ar: { nome: "Clima.reino_do_ar", elemento: true, ...zonaDef({ primavera: 13, verao: 21, outono: 12, inverno: 0 }, {
    primavera: { vento: 30, poucasNuvens: 15, limpo: 15, tempestade: 15, nublado: 10, garoa: 10, granizo: 5 },
    verao: { vento: 25, limpo: 25, tempestade: 25, poucasNuvens: 10, granizo: 10, aguaceiro: 5 },
    outono: { vento: 35, nublado: 20, tempestade: 20, encoberto: 10, chuva: 10, granizo: 5 },
    inverno: { vento: 30, nevasca: 25, neve: 15, neveLeve: 10, nublado: 10, frioIntenso: 10 } }) }
};

/* Variação diária da temperatura (±°C) de cada região de fábrica: quanto um dia comum pode fugir da média. */
for (const [k, v] of Object.entries({ temperada: 10, tropical: 6, deserto: 14, artica: 12, montanha: 12, agua: 9, fogo: 11, terra: 10, ar: 12 })) if (ZONAS[k]) ZONAS[k].variacao = v;

/** Anomalias: quando os cultistas drenam um elemento da região.
 *  clima = tempo forçado ("" = não força); trocas = { tempo: outro tempo } enquanto ativa;
 *  base = região usada quando a anomalia é escolhida como região (no mapa ou na cena). */
const ANOMALIAS = {
  nenhuma: { nome: "Clima.nenhuma" },
  agua: { nome: "Clima.agua_drenada", clima: "limpo", base: "agua", trocas: {}, temp: 6, icone: "fa-droplet-slash", texto: "Clima.os_rios_secam_as_geleiras_derretem" },
  fogo: { nome: "Clima.fogo_drenado", clima: "nublado", base: "fogo", trocas: {}, temp: -12, icone: "fa-fire-flame-simple", texto: "Clima.fogueiras_nao_acendem_e_o_calor" },
  terra: { nome: "Clima.terra_drenada", clima: "areia", base: "terra", trocas: {}, temp: 0, icone: "fa-mountain", texto: "Clima.o_solo_racha_e_vira_po" },
  ar: { nome: "Clima.ar_drenado", clima: "neblina", base: "ar", trocas: {}, temp: 4, icone: "fa-wind", texto: "Clima.calmaria_total_nenhuma_brisa_o_ar" }
};

/* ---------- tipos de região e anomalias criados ou editados pelo mestre ----------
 * Ficam no setting "climaTipos" = { climas: { id: tempo }, zonas: { id: zona }, anomalias: { id: anomalia } }.
 * Cada anomalia também vira uma região "anom-<id>" (a região base dela com a anomalia sempre ativa),
 * para ser escolhida numa Região do mapa ou numa cena.
 * Um id igual a um de fábrica substitui o de fábrica (editar); um id novo cria um tipo novo.
 * ZONAS e ANOMALIAS continuam sendo os mesmos objetos (todo o módulo e o Journal os leem):
 * eles são remontados no lugar sempre que o setting muda. */
const CLIMAS_PADRAO = JSON.parse(JSON.stringify(CLIMAS));
const ZONAS_PADRAO = JSON.parse(JSON.stringify(ZONAS));
const ANOMALIAS_PADRAO = JSON.parse(JSON.stringify(ANOMALIAS));
const ESTACOES_CLIMA = ["primavera", "verao", "outono", "inverno"];
/** Opções do setting "Região padrão do clima" (o mesmo objeto é atualizado quando os tipos mudam). */
const ESCOLHAS_ZONAS = {};

const PREFIXO_ANOM = "anom-";

function normalizarClima(c, id) {
  const fab = CLIMAS_PADRAO[id];
  return {
    nome: String(c?.nome || id).slice(0, 60),
    icone: /^fa-[a-z0-9-]+$/.test(String(c?.icone ?? "")) ? c.icone : "fa-cloud",
    efeito: /^[\w.-]{0,60}$/.test(String(c?.efeito ?? "")) ? String(c?.efeito ?? "") : "",
    ...(fab?.reserva && c?.efeito === fab.efeito ? { reserva: fab.reserva } : {}),
    temp: Math.max(-30, Math.min(30, Math.round(num(c?.temp, 0)))),
    grupo: GRUPOS_CLIMA[c?.grupo] ? c.grupo : "ceu",
    desc: String(c?.desc ?? "").slice(0, 300),
    fx: /^(fxp:[a-z0-9-]{1,40}|fxmaster\.[\w-]{1,40})$/.test(String(c?.fx ?? "")) ? c.fx : "",
    fxOpcoes: {
      densidade: ["very-low", "low", "medium", "high", "very-high"].includes(c?.fxOpcoes?.densidade) ? c.fxOpcoes.densidade : "",
      velocidade: ["very-low", "low", "medium", "high", "very-high"].includes(c?.fxOpcoes?.velocidade) ? c.fxOpcoes.velocidade : "",
      cor: corHex(c?.fxOpcoes?.cor)
    },
    ...(c?.criada ? { criada: true } : {})
  };
}

const climaComum = (k) => !!CLIMAS[k] && !CLIMAS[k].daAnomalia;
function normalizarZona(z, id, valido = climaComum) {
  const temp = {}, pesos = {};
  for (const e of ESTACOES_CLIMA) {
    temp[e] = Math.max(-80, Math.min(80, Math.round(num(z?.temp?.[e], 15))));
    pesos[e] = {};
    for (const [k, v] of Object.entries(z?.pesos?.[e] ?? {})) { const n = Math.max(0, Math.min(1000, num(v, 0))); if (valido(k) && n > 0) pesos[e][k] = n; }
    if (!Object.keys(pesos[e]).length) pesos[e] = { limpo: 1 };   // estação sem nenhum tempo: céu limpo
  }
  const variacao = Math.max(1, Math.min(40, Math.round(num(z?.variacao, 10))));
  return { nome: String(z?.nome || id).slice(0, 80), elemento: !!z?.elemento, temp, variacao, pesos, ...(z?.criada ? { criada: true } : {}) };
}

/** Id global de um clima que só existe dentro de uma anomalia. */
const idClimaAnomalia = (anom, cid) => (String(cid).startsWith(`ax_${anom}_`) ? String(cid) : `ax_${anom}_${cid}`);

/* Anomalia: nome, ícone, texto, temp (variação), clima forçado, trocas, climas próprios (só dela) e, com
 * "regiao" ligado, uma região com o nome dela e clima próprio (zona = temperaturas e chances). */
function normalizarAnomalia(a, id) {
  const climas = {};
  for (const [cid, cl] of Object.entries(a?.climas ?? {})) {
    const gid = idClimaAnomalia(id, cid);
    if (/^[\w-]{1,90}$/.test(gid)) climas[gid] = { ...normalizarClima(cl, gid), daAnomalia: id };
  }
  const valido = (k) => climaComum(k) || !!climas[k];
  const base = /^[\w-]{1,40}$/.test(String(a?.base ?? "")) && !String(a.base).startsWith(PREFIXO_ANOM) ? a.base : "temperada";
  return {
    nome: String(a?.nome || id).slice(0, 80),
    clima: valido(a?.clima) ? a.clima : "",                     // "" = não força o tempo
    base,                                                         // modelo para o clima da região (quando ainda não tem um)
    trocas: Object.fromEntries(Object.entries(a?.trocas ?? {}).filter(([de, para]) => valido(de) && valido(para) && de !== para)),
    temp: Math.max(-60, Math.min(60, Math.round(num(a?.temp, 0)))),
    icone: /^fa-[a-z0-9-]+$/.test(String(a?.icone ?? "")) ? a.icone : "fa-skull",
    texto: String(a?.texto ?? "").slice(0, 600),
    climas,
    regiao: !!a?.regiao,
    ...(a?.zona ? { zona: normalizarZona({ ...a.zona, nome: a?.nome }, id, valido) } : {}),
    ...(a?.criada ? { criada: true } : {})
  };
}

/** Remonta ZONAS e ANOMALIAS: os de fábrica + os do mestre (que podem substituir os de fábrica). */
function recarregarTiposDeClima() {
  let c = {};
  try { c = game.settings.get(MOD, "climaTipos") ?? {}; } catch { c = {}; }
  // os tempos primeiro: as regiões e anomalias só aceitam tempos que existem
  for (const k of Object.keys(CLIMAS)) delete CLIMAS[k];
  Object.assign(CLIMAS, JSON.parse(JSON.stringify(CLIMAS_PADRAO)));
  for (const [id, cl] of Object.entries(c.climas ?? {})) if (/^[\w-]{1,40}$/.test(id)) CLIMAS[id] = normalizarClima(cl, id);
  for (const k of Object.keys(ZONAS)) delete ZONAS[k];
  Object.assign(ZONAS, JSON.parse(JSON.stringify(ZONAS_PADRAO)));
  // região de fábrica sem nenhum tempo que ainda exista (tempo de fábrica não some, mas por garantia)
  for (const [id, z] of Object.entries(c.zonas ?? {})) if (/^[\w-]{1,40}$/.test(id) && !id.startsWith(PREFIXO_ANOM)) ZONAS[id] = normalizarZona(z, id);
  for (const k of Object.keys(ANOMALIAS)) delete ANOMALIAS[k];
  Object.assign(ANOMALIAS, JSON.parse(JSON.stringify(ANOMALIAS_PADRAO)));
  for (const [id, a] of Object.entries(c.anomalias ?? {})) if (id !== "nenhuma" && /^[\w-]{1,40}$/.test(id)) ANOMALIAS[id] = normalizarAnomalia(a, id);
  // climas que só existem dentro de uma anomalia
  for (const a of Object.values(ANOMALIAS)) for (const [gid, cl] of Object.entries(a.climas ?? {})) CLIMAS[gid] = cl;
  // anomalia com "Usar como região" ligado: uma região com o nome dela, o clima dela e ela sempre ativa
  if (anomaliasLigadas()) {
    for (const [id, a] of Object.entries(ANOMALIAS)) {
      if (id === "nenhuma" || !a.regiao) continue;
      const modelo = a.zona ?? ZONAS[a.base] ?? ZONAS_PADRAO.temperada;
      ZONAS[`${PREFIXO_ANOM}${id}`] = { ...JSON.parse(JSON.stringify(modelo)), nome: a.nome, elemento: false, virtual: true, anomaliaFixa: id };
    }
  }
  for (const k of Object.keys(ESCOLHAS_ZONAS)) delete ESCOLHAS_ZONAS[k];
  for (const [k, z] of Object.entries(ZONAS)) ESCOLHAS_ZONAS[k] = z.nome;
}

/** Mestre: grava (ou apaga, com dados null) um tipo de região ou de anomalia. */
async function salvarTipoDeClima(grupo, id, dados) {
  if (!game.user.isGM || !["climas", "zonas", "anomalias", "efeitos"].includes(grupo)) return;
  if (grupo === "zonas" && String(id).startsWith(PREFIXO_ANOM)) return;   // região de anomalia: edita-se a anomalia
  await naFila("climaTipos", async () => {
    const c = foundry.utils.deepClone(game.settings.get(MOD, "climaTipos") ?? {});
    c[grupo] ??= {};
    if (dados == null) delete c[grupo][id];
    else c[grupo][id] = grupo === "zonas" ? normalizarZona(dados, id) : grupo === "climas" ? normalizarClima(dados, id) : grupo === "efeitos" ? normalizarEfeito(dados, id) : normalizarAnomalia(dados, id);
    await game.settings.set(MOD, "climaTipos", c);
  });
}

/** Liga ou desliga o "Usar como região" de uma anomalia sem mexer no resto dela (o Nexus do Journal usa).
 *  Ligar cria a região "anom-<id>"; desligar a tira (lugares que a usavam voltam para a região padrão). */
async function ligarRegiaoDaAnomalia(id, ligar = true) {
  if (!game.user.isGM || id === "nenhuma" || !ANOMALIAS[id]) return false;
  if (!anomaliasLigadas()) { avisoUmaVezCal("anomalias-desligadas", T("Clima.calendario_um_nexus_tentou_ligar_uma")); return false; }
  let ok = false, mudou = false;
  await naFila("climaTipos", async () => {
    const c = foundry.utils.deepClone(game.settings.get(MOD, "climaTipos") ?? {});
    c.anomalias ??= {};
    const atual = c.anomalias[id] ?? ANOMALIAS_PADRAO[id];
    if (!atual) return;
    ok = true;
    if (!!atual.regiao === !!ligar) return;
    c.anomalias[id] = normalizarAnomalia({ ...atual, regiao: !!ligar }, id);
    await game.settings.set(MOD, "climaTipos", c);
    mudou = true;
  });
  // região nova: rola o clima dela hoje (só as regiões em uso que ainda não têm clima)
  if (mudou && ligar) await atualizarClima();
  return ok;
}

const ehDeFabrica = (grupo, id) => !!({ zonas: ZONAS_PADRAO, anomalias: ANOMALIAS_PADRAO, climas: CLIMAS_PADRAO }[grupo] ?? {})[id];

/** Primavera, verão, outono ou inverno da estação atual (pelo nome ou ícone). Se o nome e o ícone não
 *  lembram nenhuma das quatro (ex.: "Época das Chuvas"), vale a posição da estação no ano: a primeira
 *  quarta parte das estações é primavera, depois verão, outono e inverno. Uma estação só continua primavera. */
function tipoEstacao(est) {
  const t = `${est?.nome ?? ""} ${est?.icone ?? ""}`.toLowerCase();
  if (/inverno|winter|frio|neve|snow/.test(t)) return "inverno";
  if (/ver[aã]o|summer|calor|fa-sun/.test(t)) return "verao";
  if (/outono|autumn|fall|colheita|fa-leaf/.test(t)) return "outono";
  if (/primavera|spring|fa-seedling/.test(t)) return "primavera";
  const i = CFG?.estacoes?.indexOf(est) ?? -1;
  const ord = i >= 0 ? estacoesOrdenadas(CFG) : [];
  const pos = ord.findIndex((o) => o.i === i);
  if (pos < 0 || ord.length < 2) return "primavera";
  return ESTACOES_CLIMA[Math.min(3, Math.floor(((pos + 0.5) * 4) / ord.length))];
}

const climaCfg = () => foundry.utils.mergeObject({ zonas: {} }, game.settings.get(MOD, "climaZonas") ?? {}, { inplace: false });
/** Região padrão do mundo; se ela foi apagada, volta para a Temperada. */
const zonaPadraoValida = () => { const p = game.settings.get(MOD, "zonaPadrao"); return ZONAS[p] ? p : (ZONAS.temperada ? "temperada" : Object.keys(ZONAS)[0]); };
/** Região do clima de uma cena: a Região do mapa onde o grupo está > a escolhida para a cena > a padrão do mundo. */
const zonaDaCena = (cena = canvas?.scene) => {
  const ativa = cena?.getFlag(MOD, "zonaAtiva")?.zona;
  if (ZONAS[ativa]) return ativa;
  const z = cena?.getFlag(MOD, "zona");
  return ZONAS[z] ? z : zonaPadraoValida();
};
/** Anomalias ligadas nas configurações? Desligadas: nenhuma vale e a interface delas some. */
const anomaliasLigadas = () => { try { return game.settings.get(MOD, "anomaliasAtivas") !== false; } catch { return true; } };
const AVISADOS_CAL = new Set();
const avisoUmaVezCal = (chave, msg) => { if (AVISADOS_CAL.has(chave)) return; AVISADOS_CAL.add(chave); console.warn(`${MOD} | ${msg}`); if (game.user?.isGM) ui.notifications?.warn(msg); };
/** Anomalia ligada sobre uma região inteira (Temperada, Reino da Água...): desligado por padrão. */
const anomaliaRegiaoInteira = () => { try { return game.settings.get(MOD, "anomaliaRegiaoInteira") === true; } catch { return false; } };
const anomaliaDe = (zona) => {
  if (!anomaliasLigadas()) return null;
  const fixa = ZONAS[zona]?.anomaliaFixa;
  if (fixa && ANOMALIAS[fixa]) return { tipo: fixa, texto: climaCfg().zonas?.[zona]?.anomalia?.texto ?? "" };
  if (!anomaliaRegiaoInteira()) return null;
  const a = climaCfg().zonas?.[zona]?.anomalia;
  return a && ANOMALIAS[a.tipo] && a.tipo !== "nenhuma" ? a : null;
};
/** O tempo depois da anomalia: o forçado por ela, ou a troca dela para esse tempo, ou o mesmo. */
const tempoComAnomalia = (zona, tipo) => {
  const an = anomaliaDe(zona), A = an && ANOMALIAS[an.tipo];
  if (!A) return tipo;
  if (CLIMAS[A.clima]) return A.clima;
  return CLIMAS[A.trocas?.[tipo]] ? A.trocas[tipo] : tipo;
};

function sortearPeso(pesos) {
  const tot = Object.values(pesos).reduce((s, v) => s + v, 0);
  let r = Math.random() * tot;
  for (const [k, v] of Object.entries(pesos)) { r -= v; if (r <= 0) return k; }
  return Object.keys(pesos)[0];
}

/** Ruído com forma de sino (soma de 3 sorteios): perto de 0 é comum, os extremos são raros. Vai de −1 a 1. */
const ruido = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
const FORA_DE_EPOCA = 0.1; // chance de a temperatura puxar para a de outra estação
const MULT_VARIACAO = { baixa: 0.6, normal: 1, alta: 1.5, extrema: 2.2 };
const DIA_ATIPICO = 0.08;   // chance de o dia sair da tabela da estação (qualquer tempo que essa região conhece)
const ONDA_TERMICA = 0.07;  // chance de uma onda de calor ou de frio (±6 a 10 °C)

/** Rola o clima de uma zona para o dia de hoje: tipo, temperatura e mínima/máxima. */
function rolarClima(zona, td = null) {
  const Z = ZONAS[zona] ?? ZONAS.temperada;
  const dia = td == null ? agora() : infoDia(td);
  const est = tipoEstacao(estacaoDe(dia.mes, dia.dia));
  const an = anomaliaDe(zona);
  let tipo;
  if (an && CLIMAS[ANOMALIAS[an.tipo]?.clima]) tipo = ANOMALIAS[an.tipo].clima;
  else if (Math.random() < DIA_ATIPICO) {
    // dia fora do padrão da estação, mas ainda algo que esta região tem em alguma época do ano
    const conhecidos = [...new Set(Object.values(Z.pesos).flatMap((p) => Object.keys(p)))].filter((k) => CLIMAS[k]);
    tipo = conhecidos[Math.floor(Math.random() * conhecidos.length)] ?? sortearPeso(Z.pesos[est]);
  } else tipo = sortearPeso(Z.pesos[est]);
  tipo = tempoComAnomalia(zona, tipo);
  return { tipo, ...rolarTemperatura(zona, tipo, td) };
}

/** Sorteia só a temperatura do dia (e mínima/máxima) para uma região e um tipo de tempo.
 *  Usada pelo sorteio do dia e pelo botão de dado da temperatura na janela do clima. */
function rolarTemperatura(zona, tipo, td = null) {
  const Z = ZONAS[zona] ?? ZONAS.temperada;
  const dia = td == null ? agora() : infoDia(td);
  const est = tipoEstacao(estacaoDe(dia.mes, dia.dia));
  const an = anomaliaDe(zona);
  let mult = 1;
  try { mult = MULT_VARIACAO[game.settings.get(MOD, "climaVariacao")] ?? 1; } catch { /* sem o setting: normal */ }
  const variacao = num(Z.variacao, 10) * mult;
  let base = num(Z.temp?.[est], 15);
  if (Math.random() < FORA_DE_EPOCA) {
    // dia fora de época: puxa a média para a de outra estação (um inverno com dia de primavera, etc.)
    const outra = ESTACOES_CLIMA.filter((e) => e !== est)[Math.floor(Math.random() * 3)];
    base += (num(Z.temp?.[outra], base) - base) * (0.4 + Math.random() * 0.5);
  }
  // ruido() vai de -1 a 1 em forma de sino; × 1,5 deixa o desvio em metade da variação e os extremos em 1,5×
  let temp = Math.round(base + ruido() * variacao * 1.5 + (CLIMAS[tipo]?.temp ?? 0));
  let onda = null;
  if (!an && Math.random() < ONDA_TERMICA) {
    onda = Math.random() < 0.5 ? "frio" : "calor";
    temp += (onda === "calor" ? 1 : -1) * (6 + Math.floor(Math.random() * 5));
  }
  if (an) temp += ANOMALIAS[an.tipo]?.temp ?? 0;
  // amplitude do dia: céu limpo e deserto variam mais; chuva e névoa, menos
  const amplo = ["limpo", "poucasNuvens", "frioIntenso", "calor"].includes(tipo) || zona === "deserto" || Z.base === "deserto" ? 1.6 : ["chuva", "aguaceiro", "neblina", "neblinaDensa", "chuvaNeblina", "garoa", "encoberto"].includes(tipo) ? 0.6 : 1;
  const min = temp - Math.max(1, Math.round((3 + Math.random() * 4) * amplo));
  const max = temp + Math.max(1, Math.round((2 + Math.random() * 4) * amplo));
  return { temp, min, max, ...(onda ? { onda } : {}) };
}

const climaHoje = () => { const c = game.settings.get(MOD, "climaAtual"); return c?.td === agora().td ? c : { td: agora().td, zonas: {} }; };
const climaDe = (zona) => climaHoje().zonas?.[zona] ?? null;

/** Zonas em uso: a padrão, a de cada cena que escolheu uma e as das Regiões de clima desenhadas nos mapas. */
const zonasEmUso = () => {
  const z = new Set([zonaPadraoValida()]);
  for (const s of game.scenes) {
    if (ZONAS[s.getFlag(MOD, "zona")]) z.add(s.getFlag(MOD, "zona"));
    for (const r of s.regions ?? []) for (const b of r.behaviors ?? []) if (b.type === TIPO_CLIMA && !b.disabled && ZONAS[b.system?.zona]) z.add(b.system.zona);
  }
  return [...z];
};

function atualizarClima(opcoes = {}) {
  if (!souGMPrincipal()) return Promise.resolve();
  return naFila("clima", () => atualizarClimaAgora(opcoes));
}

async function atualizarClimaAgora({ forcar = false, avisar = true } = {}) {
  const hoje = foundry.utils.deepClone(climaHoje());
  const novas = [];
  const prev = previsao();
  const dePrev = prev.dias?.[hoje.td] ?? {};
  for (const zona of zonasEmUso()) {
    if (!forcar && hoje.zonas[zona]) continue;
    // a previsão feita pelo mestre vale para o dia (a não ser que ele peça para rolar de novo)
    hoje.zonas[zona] = !forcar && dePrev[zona] && CLIMAS[dePrev[zona].tipo] ? foundry.utils.deepClone(dePrev[zona]) : rolarClima(zona);
    novas.push(zona);
  }
  if (eventosLuasDoDia(hoje.td).some((e) => e.tipo === "eclipseSolar") && game.settings.get(MOD, "eclipseMudaClima") && CLIMAS.eclipse) {
    for (const zona of zonasEmUso()) if (hoje.zonas[zona] && !forcar) { hoje.zonas[zona] = { ...hoje.zonas[zona], tipo: "eclipse" }; if (!novas.includes(zona)) novas.push(zona); }
  }
  if (!novas.length) return;
  await game.settings.set(MOD, "climaAtual", hoje);
  // dias que já passaram saem da previsão
  if (Object.keys(prev.dias ?? {}).some((k) => Number(k) <= hoje.td)) {
    const resto = Object.fromEntries(Object.entries(prev.dias).filter(([k]) => Number(k) > hoje.td));
    await game.settings.set(MOD, "climaPrevisao", { dias: resto });
  }
  const quem = game.settings.get(MOD, "climaChat");
  const linhas = novas.map((zona) => `<li><b>${esc(ZONAS[zona].nome)}</b>: ${textoClima(zona)}</li>`).join("");
  if (avisar && quem !== "nenhum") await chat(`<i class="fa-solid fa-cloud-sun"></i> <b>${T("Clima.clima_de_hoje")}</b><ul>${linhas}</ul>`, quem === "mestre" ? idsGM() : []);
  await registrar(`${T("Clima.clima_0", [novas.map((zona) => `${ZONAS[zona].nome} — ${CLIMAS[hoje.zonas[zona].tipo]?.nome}`).join("; ")])}`, { icone: "fa-cloud-sun" });
  await aplicarClimaNasCenas();
}

const temperaturaTexto = (c) => (game.settings.get(MOD, "climaUnidade") === "F" ? `${Math.round(c * 9 / 5 + 32)}°F` : `${c}°C`);

function textoClima(zona) {
  const c = climaDe(zona);
  if (!c) return T("Clima.ainda_nao_rolado");
  const an = anomaliaDe(zona);
  const faixa = c.min != null && c.max != null ? ` ${T("Clima.min_0_max_1", [temperaturaTexto(c.min), temperaturaTexto(c.max)])}` : "";
  const onda = c.onda ? ` ${T("Clima.onda_de_0", [T(`Clima.${c.onda}`)])}` : "";
  return `${esc(CLIMAS[c.tipo]?.nome ?? c.tipo)}, ${temperaturaTexto(c.temp)}${faixa}${onda}${an ? ` · <i>${esc(an.texto || ANOMALIAS[an.tipo].texto)}</i>` : ""}`;
}

/** Linha do clima para o chat: ícone, tipo, temperatura e a descrição do tempo. */
function mensagemClima(zona) {
  const c = climaDe(zona);
  if (!c) return textoClima(zona);
  const info = CLIMAS[c.tipo];
  return `<i class="fa-solid ${info?.icone ?? "fa-cloud"}"></i> ${textoClima(zona)}${info?.desc ? `<br><small>${esc(info.desc)}</small>` : ""}`;
}

export {
  anomaliaDe,
  anomaliaRegiaoInteira,
  ANOMALIAS,
  ANOMALIAS_PADRAO,
  anomaliasLigadas,
  atualizarClima,
  avisoUmaVezCal,
  climaCfg,
  climaDe,
  climaHoje,
  CLIMAS,
  CLIMAS_PADRAO,
  definirPrevisao,
  ehDeFabrica,
  ESCOLHAS_ZONAS,
  ESTACOES_CLIMA,
  gerarPrevisao,
  GRUPOS_CLIMA,
  idClimaAnomalia,
  ligarRegiaoDaAnomalia,
  mensagemClima,
  PREFIXO_ANOM,
  previsao,
  recarregarTiposDeClima,
  rolarClima,
  rolarTemperatura,
  salvarTipoDeClima,
  temperaturaTexto,
  tempoComAnomalia,
  tipoEstacao,
  zonaDaCena,
  zonaPadraoValida,
  ZONAS,
  ZONAS_PADRAO,
  zonasEmUso
};
