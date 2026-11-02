/* =========================================================
 * Calendário da Mesa — Núcleo
 * Nome do módulo, tradução (T), utilidades, fila serial, avisos de erro, calendários prontos,
 * configuração do calendário em uso (CFG), o calendário nativo do Foundry com anos de tamanho
 * variável, vários calendários por mundo e os caches.
 * ========================================================= */

import { CalendarioBase } from "./compat-dnd5e.js";
import { FASES_PADRAO, UNIDADES } from "./luas.js";

const MOD = "calendario-mesa";
const JOURNAL = "journal-mesa";

/* ---------------- tradução ----------------
 * Todo texto passa por T("Area.chave", dados). A chave é legível e fica em lang/pt-BR.json e lang/en.json,
 * aninhada por área ("CALMESA": { "Luz": { "sol_nasce": "..." } }); o Foundry carrega lang/ antes do init.
 * O que o próprio Foundry traduz (nome, dica e opções das configurações, título das janelas) recebe a chave
 * completa "CALMESA.Area.chave" em vez de passar por T.
 * T("Clima.previsao_do_tempo_regiao", { regiao }) troca {regiao}; T("...{0}...", [x]) troca {0}.
 * Texto que não é chave (nome criado pelo mestre, por exemplo) volta como foi escrito. */
const PREFIXO_I18N = "CALMESA.";
function T(chave, dados) {
  let s = String(chave ?? "");
  try { const k = PREFIXO_I18N + s; if (game.i18n?.has?.(k)) s = game.i18n.localize(k); } catch { /* i18n ainda não carregado: fica a chave */ }
  if (dados != null) s = s.replace(/\{(\w+)\}/g, (m, n) => (dados[n] !== undefined ? String(dados[n]) : m));
  return s;
}

/* ---------------- utilidades ---------------- */

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const mod = (a, b) => ((a % b) + b) % b;
const pad = (n) => String(n).padStart(2, "0");
const idsGM = () => game.users.filter((u) => u.isGM).map((u) => u.id);
const souGMPrincipal = () => game.user.isGM && (game.users.activeGM?.id ?? game.user.id) === game.user.id;
const Dialogo = () => foundry.applications.api.DialogV2;

/* ---------------- fila serial ----------------
 * Várias rotinas leem um setting inteiro, mudam e gravam de volta (histórico, contadores, clima...).
 * Rodando ao mesmo tempo, a segunda gravação apagaria a primeira. A fila garante que a próxima tarefa
 * de uma mesma chave só começa quando a anterior terminou (com ou sem erro). O erro volta para quem pediu. */
const FILAS = new Map();
function naFila(chave, tarefa) {
  const anterior = FILAS.get(chave) ?? Promise.resolve();
  const atual = anterior.then(() => tarefa());
  const elo = atual.catch(() => {});
  FILAS.set(chave, elo);
  elo.then(() => { if (FILAS.get(chave) === elo) FILAS.delete(chave); });
  return atual;
}

/** Registra um erro no console e, para o mestre, mostra um aviso (no máximo um por chave a cada minuto).
 *  onde = chave de texto da área Erros com o nome da rotina. */
const ULT_AVISO = new Map();
function relatarErro(onde, err, { avisar = true } = {}) {
  console.error(`${MOD} | ${T(onde)}`, err);
  if (!avisar || !game.user?.isGM) return;
  const agoraMs = Date.now();
  if (agoraMs - (ULT_AVISO.get(onde) ?? 0) < 60000) return;
  ULT_AVISO.set(onde, agoraMs);
  ui.notifications?.error(T("Geral.calendario_falha_em_0_1_detalhes", [T(onde), err?.message ?? err]));
}

/* ---------------- calendários prontos ---------------- */

const PRESET_ELEMENTOS = {
  nome: "Calendario.calendario_dos_elementos_exemplo",
  era: "E.E.",
  anoInicial: 1000,
  primeiroDiaSemana: 0,
  horasDia: 24, minutosHora: 60, segundosMinuto: 60,
  semana: [
    { nome: "Calendario.dia_da_agua", abrev: "Calendario.ag" }, { nome: "Calendario.dia_do_fogo", abrev: "Calendario.fo" }, { nome: "Calendario.dia_da_terra", abrev: "Calendario.te" },
    { nome: "Calendario.dia_do_ar", abrev: "Comum.ar" }, { nome: "Calendario.dia_da_luz", abrev: "Calendario.lu" }, { nome: "Calendario.dia_da_sombra", abrev: "Calendario.so" },
    { nome: "Calendario.dia_do_repouso", abrev: "Calendario.re" }
  ],
  meses: ["Calendario.degelo", "Calendario.semeadura", "Calendario.florada", "Calendario.lumiar", "Calendario.solsticio", "Calendario.brasa", "Calendario.colheita", "Calendario.vindima", "Comum.nevoa", "Calendario.geada", "Calendario.longa_noite", "Calendario.renascer"]
    .map((nome) => ({ nome, abrev: nome.slice(0, 3), dias: 30, diasBissexto: 30 })),
  bissexto: { ativo: false, cada: 4, inicio: 0 },
  eras: [],
  estacoes: [
    { nome: "Comum.primavera", mesInicio: 1, diaInicio: 1, nascer: 6, por: 18.5, icone: "fa-seedling" },
    { nome: "Comum.verao", mesInicio: 4, diaInicio: 1, nascer: 5.5, por: 20, icone: "fa-sun" },
    { nome: "Comum.outono", mesInicio: 7, diaInicio: 1, nascer: 6.5, por: 18, icone: "fa-leaf" },
    { nome: "Comum.inverno", mesInicio: 10, diaInicio: 1, nascer: 7.5, por: 17, icone: "fa-snowflake" }
  ],
  luas: [
    { nome: "Calendario.lua_de_prata", ciclo: 30, deslocamento: 0, cor: "#d6dde6" },
    { nome: "Calendario.lua_rubra", ciclo: 47, deslocamento: 12, cor: "#d0675c" },
    { nome: "Calendario.lua_errante", ciclo: 21, deslocamento: 5, cor: "#7fb6a4", aparicao: { cada: 7, unidade: "anos", duracao: 1, inicio: 1000 } }
  ]
};

/* ---------------- configuração ---------------- */

let CFG = null;

function normalizar(c) {
  c = foundry.utils.deepClone(c ?? {});
  const p = PRESET_ELEMENTOS;
  const r = {
    nome: String(c.nome ?? p.nome),
    era: String(c.era ?? ""),
    anoInicial: Math.trunc(num(c.anoInicial, 0)),
    primeiroDiaSemana: Math.max(0, Math.trunc(num(c.primeiroDiaSemana, 0))),
    horasDia: Math.max(1, Math.trunc(num(c.horasDia, 24))),
    minutosHora: Math.max(1, Math.trunc(num(c.minutosHora, 60))),
    segundosMinuto: Math.max(1, Math.trunc(num(c.segundosMinuto, 60))),
    semana: (Array.isArray(c.semana) && c.semana.length ? c.semana : p.semana)
      .map((d, i) => ({ nome: String(d?.nome || `${T("Calendario.dia_0", [i + 1])}`), abrev: String(d?.abrev || String(d?.nome || `D${i + 1}`).slice(0, 3)) })),
    meses: (Array.isArray(c.meses) && c.meses.length ? c.meses : p.meses)
      .map((m, i) => {
        const dias = Math.max(1, Math.trunc(num(m?.dias, 30)));
        return {
          nome: String(m?.nome || `${T("Comum.mes_0", [i + 1])}`), abrev: String(m?.abrev || String(m?.nome || `M${i + 1}`).slice(0, 3)), dias,
          diasBissexto: Math.max(1, Math.trunc(num(m?.diasBissexto, dias))),
          aparicao: {
            cada: Math.max(0, Math.trunc(num(m?.aparicao?.cada, 0))),
            duracao: Math.max(1, Math.trunc(num(m?.aparicao?.duracao, 1))),
            inicio: Math.trunc(num(m?.aparicao?.inicio, 0))
          }
        };
      }),
    bissexto: {
      // calendários antigos não tinham o interruptor: ativo quando havia intervalo
      ativo: typeof c.bissexto?.ativo === "boolean" ? c.bissexto.ativo : num(c.bissexto?.cada, 0) > 0,
      cada: Math.max(0, Math.trunc(num(c.bissexto?.cada, 0))) || 4,
      inicio: Math.trunc(num(c.bissexto?.inicio, 0))
    },
    eras: (Array.isArray(c.eras) ? c.eras : []).map((e, i) => {
      const inicio = Math.trunc(num(e?.inicio, 0));
      const fim = e?.fim === "" || e?.fim == null || !Number.isFinite(Number(e.fim)) ? null : Math.trunc(Number(e.fim));
      return {
        nome: String(e?.nome || `${T("Calendario.era_0", [i + 1])}`),
        sufixo: String(e?.sufixo ?? ""),
        inicio,
        fim: fim != null && fim < inicio ? inicio : fim,
        contagem: e?.contagem === "relativa" ? "relativa" : "absoluta"
      };
    }),
    estacoes: (Array.isArray(c.estacoes) ? c.estacoes : []).map((e, i) => ({
      nome: String(e?.nome || `${T("Calendario.estacao_0", [i + 1])}`),
      mesInicio: Math.max(1, Math.trunc(num(e?.mesInicio, 1))),
      diaInicio: Math.max(1, Math.trunc(num(e?.diaInicio, 1))),
      nascer: num(e?.nascer, 6), por: num(e?.por, 18),
      icone: String(e?.icone || "fa-cloud-sun")
    })),
    luas: (Array.isArray(c.luas) ? c.luas : []).map((l, i) => ({
      nome: String(l?.nome || `${T("Calendario.lua_0", [i + 1])}`),
      ciclo: Math.max(1, num(l?.ciclo, 29.5)),
      deslocamento: num(l?.deslocamento, 0),
      cor: /^#[0-9a-f]{6}$/i.test(l?.cor) ? l.cor : "#e8e4d8",
      aparicao: {
        cada: Math.max(0, Math.trunc(num(l?.aparicao?.cada, 0))),
        unidade: UNIDADES[l?.aparicao?.unidade] ? l.aparicao.unidade : "anos",
        duracao: Math.max(1, Math.trunc(num(l?.aparicao?.duracao, 1))),
        unidadeDuracao: UNIDADES[l?.aparicao?.unidadeDuracao] ? l.aparicao.unidadeDuracao : (UNIDADES[l?.aparicao?.unidade] ? l.aparicao.unidade : "anos"),
        inicio: Math.trunc(num(l?.aparicao?.inicio, 0))
      },
      fases: (Array.isArray(l?.fases) && l.fases.length ? l.fases : FASES_PADRAO)
        .map((f, k) => ({ nome: String(f?.nome || `${T("Calendario.fase_0", [k + 1])}`), peso: Math.max(0.1, num(f?.peso, 1)) }))
    }))
  };
  r.primeiroDiaSemana = Math.min(r.primeiroDiaSemana, r.semana.length - 1);
  // estação começando num mês que não existe mais, ou num dia além do fim do mês
  for (const e of r.estacoes) {
    e.mesInicio = Math.min(e.mesInicio, r.meses.length);
    e.diaInicio = Math.min(e.diaInicio, r.meses[e.mesInicio - 1].dias);
  }
  r.eras.sort((a, b) => a.inicio - b.inicio);
  return r;
}

/** Intervalo do ano bissexto em uso (0 = sem bissexto, inclusive quando está desligado). */
const bisCada = (cm) => (cm.bissexto?.ativo ? cm.bissexto.cada : 0);

/* ---------- estações por dia e mês ---------- */

const ORDEM_EST = new WeakMap();
/** Estações em ordem de início no ano (chave = mês * 1000 + dia). */
function estacoesOrdenadas(cm) {
  let o = ORDEM_EST.get(cm);
  if (!o) {
    o = cm.estacoes.map((e, i) => ({ i, k: (e.mesInicio - 1) * 1000 + (e.diaInicio - 1) })).sort((a, b) => a.k - b.k);
    ORDEM_EST.set(cm, o);
  }
  return o;
}

/** Índice da estação em que cai o dia (mes e dia contados de 0); -1 se não houver estações. */
function idxEstacaoCfg(cm, mes, dia) {
  const ord = estacoesOrdenadas(cm);
  if (!ord.length) return -1;
  const k = mes * 1000 + dia;
  let r = ord[ord.length - 1];   // antes da primeira estação do ano ainda vale a última do ano anterior
  for (const o of ord) if (o.k <= k) r = o;
  return r.i;
}

/** Dia (do mês, de 1) e mês (de 1) em que a estação termina: o dia antes de a próxima começar. */
function fimDaEstacao(cm, i) {
  const ord = estacoesOrdenadas(cm);
  const pos = ord.findIndex((o) => o.i === i);
  if (pos < 0) return null;
  const prox = cm.estacoes[ord[(pos + 1) % ord.length].i];
  let mes = prox.mesInicio, dia = prox.diaInicio - 1;
  if (dia < 1) { mes = mes - 1 < 1 ? cm.meses.length : mes - 1; dia = cm.meses[mes - 1].dias; }
  return { mes, dia };
}

/** Dia do ano (de 0, ano comum) em que a estação começa. */
const diaDoAnoCfg = (cm, mes1, dia1) => cm.meses.slice(0, mes1 - 1).reduce((s, m) => s + m.dias, 0) + dia1 - 1;

/** Nascer e pôr do sol (em horas) pela estação do dia. */
function solDeCfg(cm, mes, dia = 0) {
  const e = cm.estacoes[idxEstacaoCfg(cm, mes, dia)];
  const H = cm.horasDia;
  const nascer = Math.min(Math.max(num(e?.nascer, H * 0.25), 0), H);
  const por = Math.min(Math.max(num(e?.por, H * 0.75), nascer + 0.5), H);
  return { nascer, por };
}

/* ---------- anos e eras ---------- */

/** Era em que cai um ano exibido (ex.: 1023), ou null. */
const eraDoAnoCfg = (cm, anoExibido) => cm.eras.find((e) => anoExibido >= e.inicio && (e.fim == null || anoExibido <= e.fim)) ?? null;

/** Texto do ano (interno) com a era: "1023 E.E.", ou "ano 5 da era" na contagem relativa. */
function textoAnoCfg(cm, anoInterno) {
  const a = anoInterno + cm.anoInicial;
  const e = eraDoAnoCfg(cm, a);
  if (!e) return `${a}${cm.era ? " " + cm.era : ""}`;
  const n = e.contagem === "relativa" ? a - e.inicio + 1 : a;
  return `${n}${e.sufixo ? " " + e.sufixo : ""}`;
}

/** Converte a configuração do módulo para o formato do calendário nativo do Foundry. */
function paraCore(c) {
  const daysPerYear = c.meses.reduce((s, m) => s + m.dias, 0);
  return {
    name: c.nome,
    description: "Calendário da Mesa",
    years: {
      yearZero: c.anoInicial,
      firstWeekday: c.primeiroDiaSemana,
      leapYear: bisCada(c) > 0 ? { leapStart: c.bissexto.inicio, leapInterval: bisCada(c) } : null
    },
    months: {
      values: c.meses.map((m, i) => ({ name: m.nome, abbreviation: m.abrev, ordinal: i + 1, days: m.dias, leapDays: bisCada(c) > 0 ? m.diasBissexto : m.dias }))
    },
    days: {
      values: c.semana.map((d, i) => ({ name: d.nome, abbreviation: d.abrev, ordinal: i + 1 })),
      daysPerYear,
      hoursPerDay: c.horasDia,
      minutesPerHour: c.minutosHora,
      secondsPerMinute: c.segundosMinuto
    },
    seasons: {
      // por dia do ano: o Foundry e o D&D 5e (data aproximada "início/fim do inverno") entendem as datas exatas
      values: c.estacoes.map((e, i) => {
        const fim = fimDaEstacao(c, i);
        return { name: e.nome, monthStart: null, monthEnd: null, dayStart: diaDoAnoCfg(c, e.mesInicio, e.diaInicio), dayEnd: fim ? diaDoAnoCfg(c, fim.mes, fim.dia) : null };
      })
    }
  };
}

/* ---------------- calendário do Foundry com anos de tamanho variável ---------------- */
/* O CalendarData nativo só conhece ano bissexto. Esta classe filha faz a mesma conta do tempo,
 * mas também aceita meses que só existem em alguns anos (ex.: um mês que aparece a cada 7 anos). */

let CFG_CORE = null;   // configuração que o Foundry está usando (sempre o calendário principal do mundo)

/** Quantos anos k em [0, y) cumprem mod(k - I, C) < D (y negativo devolve o negativo da contagem em [y, 0)). */
function contarAnos(y, I, C, D) {
  const d = Math.min(D, C);
  const h = (n) => Math.floor((n - I) / C) * d + Math.min(mod(n - I, C), d);
  return h(y) - h(0);
}

const ehBissextoCfg = (cm, y) => bisCada(cm) > 0 && mod(y - cm.bissexto.inicio, bisCada(cm)) === 0;

/** O mês existe no ano (interno) y? */
function mesExisteCfg(cm, m, y) {
  const a = cm.meses[m]?.aparicao;
  if (!a || a.cada <= 0 || a.duracao >= a.cada) return true;
  return mod(y + cm.anoInicial - a.inicio, a.cada) < a.duracao;
}

function diasMesCfg(cm, y, m) {
  if (!mesExisteCfg(cm, m, y)) return 0;
  const mes = cm.meses[m];
  return ehBissextoCfg(cm, y) ? mes.diasBissexto : mes.dias;
}

const diasAnoCfg = (cm, y) => cm.meses.reduce((s, _, m) => s + diasMesCfg(cm, y, m), 0);

/** Tabela de um ciclo completo (o padrão dos anos se repete a cada P anos). */
function tabelaAnos(cm) {
  const mmc = (a, b) => { const g = (x, y) => (y ? g(y, x % y) : x); return (a / g(a, b)) * b; };
  let P = 1;
  if (bisCada(cm) > 0) P = mmc(P, bisCada(cm));
  for (const m of cm.meses) if (m.aparicao?.cada > 0 && m.aparicao.duracao < m.aparicao.cada) P = mmc(P, m.aparicao.cada);
  if (P > 1e6) { console.warn(`${MOD} | ciclo de anos muito longo (${P}); usando aproximação`); P = 1e6; }
  const prefixo = new Float64Array(P + 1);
  for (let k = 0; k < P; k++) prefixo[k + 1] = prefixo[k] + diasAnoCfg(cm, k);
  let S = prefixo[P];
  if (S <= 0) S = 1;   // nenhum mês existe em nenhum ano: evita laço infinito
  return { P, S, inicio: (y) => Math.floor(y / P) * S + prefixo[mod(y, P)] };
}

/* A base (CalendarData5e com o D&D 5e, CalendarData do Foundry nos outros sistemas) vem de compat-dnd5e.js. */
/** Calendário nativo (do Foundry ou do D&D 5e) com o nascer e o pôr do sol das estações. */
class CalendarioNativo extends CalendarioBase {
  constructor(...args) {
    super(...args);
    // o D&D 5e conta dias entre anos usando days.daysPerLeapYear
    try {
      if (this.days && this.days.daysPerLeapYear == null) {
        this.days.daysPerLeapYear = (this.months?.values ?? []).reduce((s, m) => s + (m.leapDays ?? m.days), 0);
      }
    } catch { /* modelo congelado: o D&D usa o daysPerYear */ }
  }

  get cm() { return this._cm ?? CFG_CORE ?? CFG; }

  _comps(time) { return typeof time === "number" ? this.timeToComponents(time) : (time ?? game.time.components); }
  sunrise(time = game.time.components) { const c = this._comps(time); return solDeCfg(this.cm, c.month ?? 0, c.dayOfMonth ?? 0).nascer; }
  sunset(time = game.time.components) { const c = this._comps(time); return solDeCfg(this.cm, c.month ?? 0, c.dayOfMonth ?? 0).por; }
}

/** Algum mês aparece e some? Só então precisamos da contagem própria de anos; senão fica a conta nativa. */
const temMesesEmCiclo = (cm) => cm.meses.some((m) => m.aparicao?.cada > 0 && m.aparicao.duracao < m.aparicao.cada);
const classeCalendario = (cm) => (temMesesEmCiclo(cm) ? CalendarioMesaData : CalendarioNativo);

class CalendarioMesaData extends CalendarioNativo {
  get tab() { if (!this._tab || this._tabDe !== this.cm) { this._tabDe = this.cm; this._tab = tabelaAnos(this.cm); } return this._tab; }

  isLeapYear(y) { return ehBissextoCfg(this.cm, y); }
  countLeapYears(y) { const b = bisCada(this.cm); return b > 0 ? contarAnos(y, this.cm.bissexto.inicio, b, 1) : 0; }

  /** "Definir data" do HUD do D&D 5e: ano exibido, mês (de 0) e dia (de 1). */
  async jumpToDate({ year, month, day } = {}) {
    const c = { ...game.time.components };
    year ??= c.year + this.cm.anoInicial;
    month ??= c.month;
    day ??= c.dayOfMonth + 1;
    const y = year - this.cm.anoInicial;
    const t = this.componentsToTime({ year: y, month, dayOfMonth: Math.max(0, day - 1), hour: c.hour, minute: c.minute, second: c.second });
    return game.time.set(t);
  }

  timeToComponents(time = 0) {
    const cm = this.cm, t = this.tab;
    const sm = cm.segundosMinuto, sh = cm.minutosHora * sm, sd = cm.horasDia * sh;
    const td = Math.floor(time / sd);
    const resto = time - td * sd;
    let y = Math.floor((td * t.P) / t.S);
    while (t.inicio(y) > td) y--;
    while (t.inicio(y + 1) <= td) y++;
    const day = td - t.inicio(y);
    let month = 0, dom = day;
    for (let m = 0; m < cm.meses.length; m++) {
      const n = diasMesCfg(cm, y, m);
      if (dom < n) { month = m; break; }
      dom -= n;
      month = m;
    }
    const season = idxEstacaoCfg(cm, month, dom);
    return {
      year: y, day, month, dayOfMonth: dom,
      dayOfWeek: mod(cm.primeiroDiaSemana + td, cm.semana.length),
      hour: Math.floor(resto / sh), minute: Math.floor((resto % sh) / sm), second: Math.floor(resto % sm),
      season: Math.max(0, season), leapYear: ehBissextoCfg(cm, y)
    };
  }

  componentsToTime(c = {}) {
    const cm = this.cm;
    const sm = cm.segundosMinuto, sh = cm.minutosHora * sm, sd = cm.horasDia * sh;
    const year = num(c.year, 0);
    let day = c.day;
    if (day == null && c.month != null) { day = num(c.dayOfMonth, 0); for (let m = 0; m < c.month; m++) day += diasMesCfg(cm, year, m); }
    return (this.tab.inicio(year) + num(day, 0)) * sd + num(c.hour, 0) * sh + num(c.minute, 0) * sm + num(c.second, 0);
  }
}

/* ---------------- vários calendários (civilizações) ---------------- */

let CAL_ID = null;      // calendário em uso neste cliente (o de "ver como", o da cena ou o principal)
let CAL_MUNDO = null;   // calendário principal do mundo: o que o Foundry (game.time) usa, igual para todos
let CAL_X = null;       // instância do calendário em uso quando ele não é o principal (ou temporária, em comCal)
const CACHE_CAL = new Map();

/** Todos os calendários do mundo: { principal, lista: { id: config } }. */
function listaCalendarios() {
  let c = {};
  try { c = game.settings.get(MOD, "calendarios") ?? {}; } catch (err) { console.warn(`${MOD} | lista de calendários (configuração ainda não registrada?)`, err); }
  const lista = c.lista && Object.keys(c.lista).length ? c.lista : { padrao: game.settings.get(MOD, "config") };
  const principal = lista[c.principal] ? c.principal : Object.keys(lista)[0];
  return { principal, lista };
}

/** Qual calendário vale aqui: o escolhido em "ver como", o da cena ou o principal do mundo. */
function idAtivo() {
  const { principal, lista } = listaCalendarios();
  let visto = "";
  try { visto = game.settings.get(MOD, "calendarioVisto"); } catch (err) { console.warn(`${MOD} | "ver como" (configuração ainda não registrada?)`, err); }
  if (visto && lista[visto]) return visto;
  let daCena = null;
  try { daCena = (globalThis.canvas?.scene ?? game.scenes?.viewed)?.getFlag?.(MOD, "calendario"); } catch (err) { console.warn(`${MOD} | calendário da cena`, err); }
  if (daCena && lista[daCena]) return daCena;
  return principal;
}

/** De qual calendário é uma nota (notas sem calendário ou de um calendário apagado são do principal). */
function calDaNota(raw) {
  const { principal, lista } = listaCalendarios();
  return raw?.cal && lista[raw.cal] ? raw.cal : principal;
}

/** Aplica os calendários: o Foundry (game.time) recebe sempre o principal do mundo, igual em todos os computadores,
 *  porque o sistema (D&D 5e) e outros módulos contam o tempo por ele. "Ver como" e o calendário da cena só mudam o
 *  que este módulo mostra e calcula neste computador (CFG e cal()), sem mexer no game.time. */
function aplicarCalendario() {
  const { principal, lista } = listaCalendarios();
  const cfgMundo = normalizar(lista[principal]);
  CAL_MUNDO = principal;
  CFG_CORE = cfgMundo;
  CONFIG.time.worldCalendarClass = classeCalendario(cfgMundo);
  CONFIG.time.worldCalendarConfig = paraCore(cfgMundo);
  try { game.time?.initializeCalendar?.(); }
  catch (err) { console.error(`${MOD} | Não consegui aplicar o calendário`, err); }
  CAL_ID = idAtivo();
  CFG = CAL_ID === principal ? cfgMundo : normalizar(lista[CAL_ID]);
  CAL_X = null;
  if (CAL_ID !== principal) {
    const Classe = classeCalendario(CFG);
    CAL_X = new Classe(paraCore(CFG));
    CAL_X._cm = CFG;
  }
  limparCache();
}

/** Roda fn com o calendário principal do mundo (o do game.time), seja qual for o "ver como" deste computador.
 *  Para o que vale para o mundo todo: luz das cenas e as contas de tempo do sistema. fn deve ser síncrona. */
const noMundo = (fn) => comCal(CAL_MUNDO, fn);

/* comConfig e comCal trocam o calendário global só enquanto fn roda e restauram logo depois.
 * Por isso fn PRECISA ser síncrona: com await no meio, o resto dela rodaria já com o calendário
 * restaurado e outras rotinas veriam o calendário trocado. Uma fn que devolve Promise é recusada. */
function exigirSincrono(r, quem) {
  if (r && typeof r.then === "function") {
    r.catch?.(() => {});
    throw new TypeError(`${MOD} | ${quem}: a função passada precisa ser síncrona (não use async/await dentro dela).`);
  }
  return r;
}

/** Roda fn usando outra configuração de calendário (sem mudar o que o Foundry usa). fn deve ser síncrona. */
function comConfig(config, id, fn) {
  const salvo = { CFG, CAL_X, CACHE, CAL_ID };
  CFG = normalizar(config);
  const Classe = classeCalendario(CFG);
  CAL_X = new Classe(paraCore(CFG));
  CAL_X._cm = CFG;
  CACHE = new Map();
  CAL_ID = id;
  try { return exigirSincrono(fn(), "comConfig"); }
  finally { CFG = salvo.CFG; CAL_X = salvo.CAL_X; CACHE = salvo.CACHE; CAL_ID = salvo.CAL_ID; }
}

/** Roda fn com o calendário de id (o ativo roda direto). fn deve ser síncrona. */
function comCal(id, fn) {
  if (!id || id === CAL_ID) return exigirSincrono(fn(), "comCal");
  let c = CACHE_CAL.get(id);
  if (!c) {
    const { lista } = listaCalendarios();
    if (!lista[id]) return exigirSincrono(fn(), "comCal");
    const cfg = normalizar(lista[id]);
    const Classe = classeCalendario(cfg);
    const inst = new Classe(paraCore(cfg));
    inst._cm = cfg;
    c = { cfg, inst, cache: new Map() };
    CACHE_CAL.set(id, c);
  }
  const salvo = { CFG, CAL_X, CACHE, CAL_ID };
  CFG = c.cfg; CAL_X = c.inst; CACHE = c.cache; CAL_ID = id;
  try { return exigirSincrono(fn(), "comCal"); }
  finally { CFG = salvo.CFG; CAL_X = salvo.CAL_X; CACHE = salvo.CACHE; CAL_ID = salvo.CAL_ID; }
}

let CAL_ANTERIOR = null;   // calendário que estava ativo antes deste módulo (para "Importar do mundo")
/** Guarda o calendário que o mundo (ou o sistema) usava antes deste módulo, para "Importar do mundo". */
function guardarCalendarioAnterior(atual) {
  if (!atual || atual.description === "Calendário da Mesa") return;
  try { CAL_ANTERIOR = foundry.utils.deepClone(atual); } catch (err) { console.warn(`${MOD} | não consegui guardar o calendário anterior (para "Importar do mundo")`, err); }
}

/* ---------------- tempo ---------------- */

const cal = () => CAL_X ?? game.time.calendar;
const segMinuto = () => CFG.segundosMinuto;
const segHora = () => CFG.minutosHora * CFG.segundosMinuto;
const segDia = () => CFG.horasDia * segHora();
const diaTotalDe = (wt) => Math.floor(wt / segDia());
const segundoDoDia = (wt) => mod(wt, segDia());

let CACHE = new Map();
/* Outros caches que dependem do calendário em uso (eventos das luas, fim das séries de notas): cada arquivo
 * registra o seu com registrarCache(), e limparCache() esvazia todos junto com o dos dias. (Função comum, e não
 * const, para poder ser chamada por outro arquivo enquanto este ainda está carregando.) */
function registrarCache(mapa) { (registrarCache.lista ??= new Set()).add(mapa); return mapa; }
/** Esvazia os caches que dependem do calendário em uso: dias, eventos das luas e fim das séries de notas. */
function limparCache() { CACHE = new Map(); for (const c of registrarCache.lista ?? []) c.clear(); }

/* ---------------- avisos, Journal e escuridão ---------------- */

async function chat(content, whisper = []) {
  return ChatMessage.create({ content: `<div class="cm-chat">${content}</div>`, speaker: { alias: "Comum.calendario" }, whisper });
}

/* ---------------- tema ---------------- */

function tema() {
  const t = game.settings.get(MOD, "tema");
  if (t !== "journal") return t;
  // o Journal chama o tema vitoriano de "lotd"
  const DO_JOURNAL = { claro: "claro", lotd: "vitoriano", vitoriano: "vitoriano", noite: "noite" };
  if (game.settings.settings.has(`${JOURNAL}.tema`)) return DO_JOURNAL[game.settings.get(JOURNAL, "tema")] ?? "noite";
  return "noite";
}

const opcoes = (obj, sel, rot = (v) => v) => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${esc(rot(v))}</option>`).join("");

export {
  aplicarCalendario,
  bisCada,
  CACHE,
  CACHE_CAL,
  cal,
  CAL_ANTERIOR,
  CAL_ID,
  calDaNota,
  CFG,
  chat,
  comCal,
  comConfig,
  Dialogo,
  diaTotalDe,
  eraDoAnoCfg,
  esc,
  estacoesOrdenadas,
  fimDaEstacao,
  guardarCalendarioAnterior,
  idAtivo,
  idsGM,
  idxEstacaoCfg,
  JOURNAL,
  limparCache,
  listaCalendarios,
  mesExisteCfg,
  mod,
  MOD,
  naFila,
  noMundo,
  normalizar,
  num,
  opcoes,
  pad,
  PRESET_ELEMENTOS,
  registrarCache,
  relatarErro,
  segDia,
  segHora,
  segMinuto,
  segundoDoDia,
  solDeCfg,
  souGMPrincipal,
  T,
  tema,
  textoAnoCfg
};
