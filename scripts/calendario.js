/* =========================================================
 * Calendário da Mesa — Foundry VTT v14
 * Usa o tempo nativo do Foundry (game.time + CalendarData)
 * com um calendário próprio, HUD, luas, estações, notas e
 * integração com o módulo Journal da Mesa (journal-mesa).
 * ========================================================= */

import { CHAVES_CENTRAL } from "./central-mapa.js";

const MOD = "calendario-mesa";
const JOURNAL = "journal-mesa";

/* ---------------- tradução ----------------
 * Os textos ficam escritos em português no código e passam por T(). A chave de cada texto é um código
 * curto calculado a partir dele ("CALMESA.t<código>"), e lang/pt-BR.json e lang/en.json trazem cada
 * texto nos dois idiomas (o Foundry usa o inglês para quem joga em outro idioma). Texto sem tradução
 * (nomes criados pelo mestre, por exemplo) aparece como foi escrito.
 * T("Clima de {zona}", { zona }) troca {zona}; T("... {0} ...", [x]) troca {0}.
 * K() devolve só a chave, para o que o Foundry traduz sozinho (nomes e dicas das configurações). */
function chaveI18n(pt) {
  let h = 0x811c9dc5;
  for (let i = 0; i < pt.length; i++) { h ^= pt.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `CALMESA.t${h.toString(36)}`;
}
function T(pt, dados) {
  let s = String(pt ?? "");
  try { const k = chaveI18n(s); if (game.i18n?.has?.(k)) s = game.i18n.localize(k); } catch { /* sem tradução: português */ }
  if (dados != null) s = s.replace(/\{(\w+)\}/g, (m, n) => (dados[n] !== undefined ? String(dados[n]) : m));
  return s;
}
/* K(): texto das configurações e menus. Fica em português no registro (assim nunca aparece um código como
 * "CALMESA.t1w83jxm", nem quando o Foundry ainda não leu lang/ — por exemplo, módulo atualizado sem relançar o
 * mundo). No i18nInit, traduzirConfiguracoes() troca pelo texto do idioma, se ele existir. */
const K = (pt) => String(pt);

/** Troca nome, dica e opções das configurações e menus do módulo pelo idioma carregado (sem tradução: fica o português). */
function traduzirConfiguracoes() {
  const tr = (v) => (typeof v === "string" && v ? T(v) : v);
  for (const [chave, def] of game.settings.settings ?? []) {
    if (!String(chave).startsWith(`${MOD}.`)) continue;
    def._pt ??= { name: def.name, hint: def.hint, choices: def.choices && typeof def.choices === "object" && def.choices !== ESCOLHAS_ZONAS ? { ...def.choices } : null };
    def.name = tr(def._pt.name);
    def.hint = tr(def._pt.hint);
    if (def._pt.choices) def.choices = Object.fromEntries(Object.entries(def._pt.choices).map(([k, r]) => [k, tr(r)]));
  }
  for (const [chave, menu] of game.settings.menus ?? []) {
    if (!String(chave).startsWith(`${MOD}.`)) continue;
    menu._pt ??= { name: menu.name, label: menu.label, hint: menu.hint };
    menu.name = tr(menu._pt.name); menu.label = tr(menu._pt.label); menu.hint = tr(menu._pt.hint);
  }
}
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
  try { traduzirConfiguracoes(); } catch (err) { console.warn(`${MOD} | tradução das configurações`, err); }
});

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

/** Registra um erro no console e, para o mestre, mostra um aviso (no máximo um por chave a cada minuto). */
const ULT_AVISO = new Map();
function relatarErro(onde, err, { avisar = true } = {}) {
  console.error(`${MOD} | ${onde}`, err);
  if (!avisar || !game.user?.isGM) return;
  const agoraMs = Date.now();
  if (agoraMs - (ULT_AVISO.get(onde) ?? 0) < 60000) return;
  ULT_AVISO.set(onde, agoraMs);
  ui.notifications?.error(T("Calendário: falha em \"{0}\" ({1}). Detalhes no console (F12).", [T(onde), err?.message ?? err]));
}

/* ---------------- calendários prontos ---------------- */

const PRESET_ELEMENTOS = {
  nome: "Calendário dos Elementos (exemplo)",
  era: "E.E.",
  anoInicial: 1000,
  primeiroDiaSemana: 0,
  horasDia: 24, minutosHora: 60, segundosMinuto: 60,
  semana: [
    { nome: "Dia da Água", abrev: "Ág" }, { nome: "Dia do Fogo", abrev: "Fo" }, { nome: "Dia da Terra", abrev: "Te" },
    { nome: "Dia do Ar", abrev: "Ar" }, { nome: "Dia da Luz", abrev: "Lu" }, { nome: "Dia da Sombra", abrev: "So" },
    { nome: "Dia do Repouso", abrev: "Re" }
  ],
  meses: ["Degelo", "Semeadura", "Florada", "Lumiar", "Solstício", "Brasa", "Colheita", "Vindima", "Névoa", "Geada", "Longa Noite", "Renascer"]
    .map((nome) => ({ nome, abrev: nome.slice(0, 3), dias: 30, diasBissexto: 30 })),
  bissexto: { ativo: false, cada: 4, inicio: 0 },
  eras: [],
  estacoes: [
    { nome: "Primavera", mesInicio: 1, diaInicio: 1, nascer: 6, por: 18.5, icone: "fa-seedling" },
    { nome: "Verão", mesInicio: 4, diaInicio: 1, nascer: 5.5, por: 20, icone: "fa-sun" },
    { nome: "Outono", mesInicio: 7, diaInicio: 1, nascer: 6.5, por: 18, icone: "fa-leaf" },
    { nome: "Inverno", mesInicio: 10, diaInicio: 1, nascer: 7.5, por: 17, icone: "fa-snowflake" }
  ],
  luas: [
    { nome: "Lua de Prata", ciclo: 30, deslocamento: 0, cor: "#d6dde6" },
    { nome: "Lua Rubra", ciclo: 47, deslocamento: 12, cor: "#d0675c" },
    { nome: "Lua Errante", ciclo: 21, deslocamento: 5, cor: "#7fb6a4", aparicao: { cada: 7, unidade: "anos", duracao: 1, inicio: 1000 } }
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
      .map((d, i) => ({ nome: String(d?.nome || `${T("Dia {0}", [i + 1])}`), abrev: String(d?.abrev || String(d?.nome || `D${i + 1}`).slice(0, 3)) })),
    meses: (Array.isArray(c.meses) && c.meses.length ? c.meses : p.meses)
      .map((m, i) => {
        const dias = Math.max(1, Math.trunc(num(m?.dias, 30)));
        return {
          nome: String(m?.nome || `${T("Mês {0}", [i + 1])}`), abrev: String(m?.abrev || String(m?.nome || `M${i + 1}`).slice(0, 3)), dias,
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
        nome: String(e?.nome || `${T("Era {0}", [i + 1])}`),
        sufixo: String(e?.sufixo ?? ""),
        inicio,
        fim: fim != null && fim < inicio ? inicio : fim,
        contagem: e?.contagem === "relativa" ? "relativa" : "absoluta"
      };
    }),
    estacoes: (Array.isArray(c.estacoes) ? c.estacoes : []).map((e, i) => ({
      nome: String(e?.nome || `${T("Estação {0}", [i + 1])}`),
      mesInicio: Math.max(1, Math.trunc(num(e?.mesInicio, 1))),
      diaInicio: Math.max(1, Math.trunc(num(e?.diaInicio, 1))),
      nascer: num(e?.nascer, 6), por: num(e?.por, 18),
      icone: String(e?.icone || "fa-cloud-sun")
    })),
    luas: (Array.isArray(c.luas) ? c.luas : []).map((l, i) => ({
      nome: String(l?.nome || `${T("Lua {0}", [i + 1])}`),
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
        .map((f, k) => ({ nome: String(f?.nome || `${T("Fase {0}", [k + 1])}`), peso: Math.max(0.1, num(f?.peso, 1)) }))
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

let CFG_CORE = null;   // configuração que o Foundry está usando (o calendário ativo)

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

/* Com o D&D 5e, o calendário herda do CalendarData5e do sistema: assim o HUD de calendário do D&D
 * continua achando os formatadores dele (formatMonthDay, formatApproximateTime...) e a recuperação
 * "ao amanhecer / ao anoitecer" do D&D 6 usa o nascer e o pôr do sol das nossas estações.
 * Em outros sistemas, herda direto do CalendarData nativo do Foundry. */
const CalendarioBase = globalThis.dnd5e?.dataModels?.calendar?.CalendarData5e ?? foundry.data.CalendarData;

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

let CAL_ID = null;      // calendário em uso neste cliente
let CAL_X = null;       // instância temporária quando calculamos com outro calendário
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

function aplicarCalendario() {
  const { lista } = listaCalendarios();
  CAL_ID = idAtivo();
  CFG = normalizar(lista[CAL_ID]);
  CAL_X = null;
  CFG_CORE = CFG;
  CONFIG.time.worldCalendarClass = classeCalendario(CFG);
  CONFIG.time.worldCalendarConfig = paraCore(CFG);
  try { game.time?.initializeCalendar?.(); }
  catch (err) { console.error(`${MOD} | Não consegui aplicar o calendário`, err); }
  limparCache();
}

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

/* ---------------- tempo ---------------- */

const cal = () => CAL_X ?? game.time.calendar;
const segMinuto = () => CFG.segundosMinuto;
const segHora = () => CFG.minutosHora * CFG.segundosMinuto;
const segDia = () => CFG.horasDia * segHora();
const diaTotalDe = (wt) => Math.floor(wt / segDia());
const segundoDoDia = (wt) => mod(wt, segDia());

let CACHE = new Map();
/** Esvazia os caches que dependem do calendário em uso: dias, eventos das luas e fim das séries de notas. */
function limparCache() { CACHE = new Map(); CACHE_LUAS.clear(); CACHE_FIM.clear(); }

/** Informações de um dia (índice absoluto de dias desde o tempo 0). */
function infoDia(td) {
  if (CACHE.has(td)) return CACHE.get(td);
  const c = cal().timeToComponents(td * segDia());
  const inf = { td, ano: c.year, mes: c.month, dia: c.dayOfMonth, sem: mod(c.dayOfWeek ?? 0, CFG.semana.length), doy: c.day };
  if (CACHE.size > 3000) CACHE.clear();
  CACHE.set(td, inf);
  return inf;
}

function agora() {
  const wt = game.time.worldTime;
  const s = segundoDoDia(wt);
  const inf = infoDia(diaTotalDe(wt));
  return { ...inf, wt, hora: Math.floor(s / segHora()), minuto: Math.floor((s % segHora()) / segMinuto()), horaDec: s / segHora() };
}

const ehBissexto = (ano) => bisCada(CFG) > 0 && !!cal().isLeapYear?.(ano);
/** Dias do mês: 0 se o mês não existe naquele ano; o bissexto vem do calendário em uso (nativo ou o nosso). */
const diasNoMes = (ano, mes) => {
  if (!mesExisteCfg(CFG, mes, ano)) return 0;
  const m = CFG.meses[mes];
  return ehBissexto(ano) ? m.diasBissexto : m.dias;
};
const mesExiste = (ano, mes) => mesExisteCfg(CFG, mes, ano);

/** Mês mais próximo que existe no ano (para notas cujo mês sumiu). */
function mesProximoQueExiste(ano, mes) {
  for (let d = 0; d < CFG.meses.length; d++) {
    if (mes - d >= 0 && mesExiste(ano, mes - d)) return mes - d;
    if (mes + d < CFG.meses.length && mesExiste(ano, mes + d)) return mes + d;
  }
  return mes;
}

/** Índice absoluto do dia a partir de ano interno, mês (0..) e dia do mês (0..). */
function tdDe(ano, mes, dia) {
  let doy = dia;
  for (let i = 0; i < mes; i++) doy += diasNoMes(ano, i);
  const confere = (td) => { const i = infoDia(td); return i.ano === ano && i.mes === mes && i.dia === dia; };
  let td = Math.floor(cal().componentsToTime({ year: ano, day: doy, hour: 0, minute: 0, second: 0 }) / segDia());
  if (confere(td)) return td;
  // Plano B: conta os dias à mão
  const diasAno = CFG.meses.reduce((s, m) => s + m.dias, 0);
  const extra = CFG.meses.reduce((s, m) => s + (m.diasBissexto - m.dias), 0);
  const bissextos = bisCada(CFG) > 0 ? num(cal().countLeapYears?.(ano), 0) : 0;
  td = ano * diasAno + bissextos * extra + doy;
  return td;
}

function textoData(inf, { semana = true, ano = true } = {}) {
  const mes = CFG.meses[inf.mes]?.nome ?? "?";
  const partes = ano ? T("{0} de {1} de {2}", [inf.dia + 1, mes, textoAno(inf.ano)]) : T("{0} de {1}", [inf.dia + 1, mes]);
  return semana ? `${CFG.semana[inf.sem]?.nome ?? ""}, ${partes}` : partes;
}

const textoHora = (h, m) => `${pad(h)}:${pad(m)}`;
/** Relógio com segundos a partir dos segundos do dia. */
function textoRelogio(seg) {
  seg = Math.max(0, Math.floor(seg));
  const h = Math.floor(seg / segHora()), m = Math.floor((seg % segHora()) / segMinuto()), sg = seg % segMinuto();
  return `${pad(h)}:${pad(m)}:${pad(sg)}`;
}
let ULT_TEMPO = 0;   // quando o tempo do mundo mudou pela última vez (para o relógio contar os segundos entre um passo e outro)
/** Hora decimal → "HH:MM". Arredonda para o minuto antes de separar as horas (6,999 h → 07:00, não 06:00). */
function textoHoraDec(hd) { const tot = Math.round(hd * CFG.minutosHora); return textoHora(Math.floor(tot / CFG.minutosHora), tot % CFG.minutosHora); }

/* ---------------- estações, sol e luas ---------------- */

/** Estação do dia (mes e dia contados de 0). */
const estacaoDe = (mes, dia = 0) => CFG.estacoes[idxEstacaoCfg(CFG, mes, dia)] ?? null;
const solDe = (mes, dia = 0) => solDeCfg(CFG, mes, dia);
const textoAno = (anoInterno) => textoAnoCfg(CFG, anoInterno);
const eraDoAno = (anoInterno) => eraDoAnoCfg(CFG, anoInterno + CFG.anoInicial);

function periodoDe(hd, mes, dia = 0) {
  const { nascer, por } = solDe(mes, dia);
  const meio = (nascer + por) / 2;
  if (hd < nascer) return { nome: T("Madrugada"), icone: "fa-moon" };
  if (hd < meio) return { nome: T("Manhã"), icone: "fa-sun" };
  if (hd < por) return { nome: T("Tarde"), icone: "fa-sun" };
  return { nome: T("Noite"), icone: "fa-moon" };
}

const FASES_PADRAO = ["Lua nova", "Crescente", "Quarto crescente", "Gibosa crescente", "Lua cheia", "Gibosa minguante", "Quarto minguante", "Minguante"]
  .map((nome) => ({ nome, peso: 1 }));

/** Quanto da lua está iluminado (0 nova, 1 cheia). */
const iluminacao = (p) => (1 - Math.cos(2 * Math.PI * p)) / 2;

/** Em qual fase cai a posição p do ciclo. A primeira fase fica centrada na lua nova (p = 0). */
function indiceFase(fases, p) {
  const tot = fases.reduce((s, f) => s + f.peso, 0);
  const q = mod(p + fases[0].peso / tot / 2, 1);
  let acc = 0;
  for (let i = 0; i < fases.length; i++) { acc += fases[i].peso / tot; if (q < acc) return i; }
  return fases.length - 1;
}

function faseDe(lua, td) {
  const p = mod(td - lua.deslocamento, lua.ciclo) / lua.ciclo;
  const fases = lua.fases?.length ? lua.fases : FASES_PADRAO;
  const idx = indiceFase(fases, p);
  return { p, idx, nome: fases[idx].nome, nova: idx === 0, cheia: idx === indiceFase(fases, 0.5), iluminacao: iluminacao(p) };
}

const UNIDADES = { dias: "dias", meses: "meses", anos: "anos" };
const UNIDADE_SING = { dias: "dia", meses: "mês", anos: "ano" };

/** Posição do dia na unidade do ciclo de aparição (dias absolutos, meses ou anos exibidos). */
function indiceCiclo(unidade, td) {
  const i = infoDia(td);
  if (unidade === "anos") return i.ano + CFG.anoInicial;
  if (unidade === "meses") return (i.ano + CFG.anoInicial) * CFG.meses.length + i.mes;
  return td;
}

/** Primeiro dia do ano, mês ou dia de índice k (na mesma conta de indiceCiclo). */
function inicioDoIndice(unidade, k) {
  if (unidade === "anos") return tdDe(k - CFG.anoInicial, 0, 0);
  if (unidade === "meses") { const n = CFG.meses.length; return tdDe(Math.floor(k / n) - CFG.anoInicial, mod(k, n), 0); }
  return k;
}

/** Soma q dias, meses ou anos a um dia (mantendo o dia do mês quando dá). */
function somarTempo(td, q, unidade) {
  if (unidade === "dias") return td + q;
  const i = infoDia(td), n = CFG.meses.length;
  const t = unidade === "anos" ? (i.ano + q) * n + i.mes : i.ano * n + i.mes + q;
  const ano = Math.floor(t / n), mes = mod(t, n);
  return tdDe(ano, mes, Math.min(i.dia, diasNoMes(ano, mes) - 1));
}

/** A lua está no céu neste dia? Devolve também em que dia isso muda. */
function visibilidadeLua(lua, td) {
  const a = lua.aparicao;
  if (!a || a.cada <= 0) return { visivel: true, sempre: true };
  const k0 = a.inicio + Math.floor((indiceCiclo(a.unidade, td) - a.inicio) / a.cada) * a.cada;
  // a aparição pode durar mais que um ciclo, então olha alguns ciclos para trás
  for (let j = 0; j < 60; j++) {
    const ini = inicioDoIndice(a.unidade, k0 - j * a.cada);
    const fim = somarTempo(ini, a.duracao, a.unidadeDuracao ?? a.unidade);
    if (fim <= td) break;
    if (td >= ini) {
      // aparições encadeadas (a próxima começa antes desta acabar) contam como uma só
      let ate = fim, k = k0 - j * a.cada;
      for (let g = 0; g < 60; g++) { const prox = inicioDoIndice(a.unidade, k + a.cada); if (prox > ate) break; k += a.cada; ate = Math.max(ate, somarTempo(prox, a.duracao, a.unidadeDuracao ?? a.unidade)); }
      return { visivel: true, alvoTd: ate, faltaDias: ate - td };
    }
  }
  const volta = inicioDoIndice(a.unidade, k0 + a.cada);
  return { visivel: false, alvoTd: volta, faltaDias: volta - td };
}

const luasNoCeu = (td) => CFG.luas.filter((l) => visibilidadeLua(l, td).visivel);
const textoFalta = (v) => `${v.faltaDias === 1 ? T("1 dia") : T("{0} dias", [v.faltaDias])} (${textoData(infoDia(v.alvoTd), { semana: false })})`;

/** Desenha a fase da lua em SVG (p de 0 a 1: 0 nova, 0.5 cheia). */
function luaSVG(p, cor, tam = 16) {
  const r = 7, c = 8;
  const k = Math.cos(2 * Math.PI * p);
  const rx = Math.max(0.01, Math.abs(k) * r).toFixed(2);
  const crescendo = p < 0.5;
  const d = crescendo
    ? `M${c},${c - r} A${r},${r} 0 0 1 ${c},${c + r} A${rx},${r} 0 0 ${k > 0 ? 0 : 1} ${c},${c - r} Z`
    : `M${c},${c - r} A${r},${r} 0 0 0 ${c},${c + r} A${rx},${r} 0 0 ${k > 0 ? 1 : 0} ${c},${c - r} Z`;
  return `<svg class="cm-lua" width="${tam}" height="${tam}" viewBox="0 0 16 16" aria-hidden="true"><circle cx="${c}" cy="${c}" r="${r}" fill="rgba(20,22,30,.85)" stroke="${cor}" stroke-width="1"/><path d="${d}" fill="${cor}"/></svg>`;
}

/* ---------------- notas e eventos ---------------- */

const REPETIR = { nao: "Não repete", dias: "Dias", semanas: "Semanas", meses: "Meses", anos: "Anos" };
const ANTIGOS = { anual: ["anos", 1], mensal: ["meses", 1], semanal: ["semanas", 1], ndias: ["dias", null] };
const MODOS_MES = { dia: "dia", semana: "semana", ultima: "ultima" };
const FIM = { nunca: "Nunca", data: "Numa data", vezes: "Depois de N vezes" };
const ICONES = {
  "fa-star": "Estrela", "fa-flag": "Bandeira", "fa-crown": "Coroa", "fa-skull": "Caveira", "fa-gift": "Festa",
  "fa-hands-praying": "Religioso", "fa-scroll": "Missão", "fa-coins": "Comércio", "fa-moon": "Lua", "fa-fire": "Fogo",
  "fa-droplet": "Água", "fa-mountain": "Terra", "fa-wind": "Ar", "fa-bell": "Lembrete", "fa-cake-candles": "Aniversário"
};
const AVISOS = { nenhum: "Sem aviso", mestre: "Avisar só o mestre", todos: "Avisar todos no chat" };

/** Lê (e corrige) os dados de uma nota. Aceita também objetos crus e o formato antigo (anual, mensal...). */
function normalizarNota(n) {
  if (!n || !Number.isFinite(Number(n.td))) return null;
  const td = Math.trunc(Number(n.td));
  let repetir = n.repetir, cada = Math.max(1, Math.trunc(num(n.cada, 1)));
  if (ANTIGOS[repetir]) { const [r, c] = ANTIGOS[repetir]; repetir = r; if (c) cada = c; }
  if (!REPETIR[repetir]) repetir = "nao";
  const W = CFG.semana.length;
  const diasSemana = [...new Set((Array.isArray(n.diasSemana) ? n.diasSemana : []).map(Number).filter((d) => d >= 0 && d < W))].sort((a, b) => a - b);
  const fimTipo = FIM[n.fim?.tipo] ? n.fim.tipo : "nunca";
  return {
    td,
    hora: /^\d{1,2}:\d{2}$/.test(n.hora ?? "") ? n.hora : "",
    repetir, cada,
    diasSemana: diasSemana.length ? diasSemana : [infoDia(td).sem],
    modoMes: MODOS_MES[n.modoMes] ? n.modoMes : "dia",
    duracao: Math.max(1, Math.trunc(num(n.duracao, 1))),
    fim: { tipo: fimTipo, td: Math.trunc(num(n.fim?.td, td)), vezes: Math.max(1, Math.trunc(num(n.fim?.vezes, 1))) },
    excecoes: [...new Set((Array.isArray(n.excecoes) ? n.excecoes : []).map((x) => Math.trunc(Number(x))).filter(Number.isFinite))],
    cor: /^#[0-9a-f]{6}$/i.test(n.cor) ? n.cor : "#c9a227",
    icone: ICONES[n.icone] ? n.icone : "fa-star",
    aviso: AVISOS[n.aviso] ? n.aviso : "nenhum"
  };
}
const dadosNota = (j) => normalizarNota(j.getFlag(MOD, "nota"));

const podeVer = (j) => game.user.isGM || j.testUserPermission(game.user, "LIMITED");
function notas({ todas = false, id = CAL_ID } = {}) {
  return game.journal.filter((j) => { const r = j.getFlag(MOD, "nota"); return r && calDaNota(r) === id && (todas || podeVer(j)); })
    .map((j) => ({ j, n: dadosNota(j) })).filter((x) => x.n);
}

/** Qual vez do dia da semana no mês (0 = primeira) e se é a última. */
function posNoMes(inf) {
  const W = CFG.semana.length;
  return { nth: Math.floor(inf.dia / W), ultima: inf.dia + W >= diasNoMes(inf.ano, inf.mes) };
}

/** A regra de repetição bate com este dia (sem olhar fim nem exceções)? */
function bateRegra(n, td) {
  if (td < n.td) return false;
  if (n.repetir === "nao") return td === n.td;
  const inf = infoDia(td), base = infoDia(n.td);
  const W = CFG.semana.length, nM = CFG.meses.length;
  const mesmoNoMes = () => {
    if (n.modoMes === "dia") return inf.dia === base.dia;
    if (inf.sem !== base.sem) return false;
    return n.modoMes === "ultima" ? posNoMes(inf).ultima : posNoMes(inf).nth === posNoMes(base).nth;
  };
  switch (n.repetir) {
    case "dias": return (td - n.td) % n.cada === 0;
    case "semanas": {
      if (!n.diasSemana.includes(inf.sem)) return false;
      const semanas = Math.round(((td - inf.sem) - (n.td - base.sem)) / W);
      return semanas % n.cada === 0;
    }
    case "meses": {
      const dm = (inf.ano * nM + inf.mes) - (base.ano * nM + base.mes);
      return dm % n.cada === 0 && mesmoNoMes();
    }
    case "anos": return (inf.ano - base.ano) % n.cada === 0 && inf.mes === base.mes && mesmoNoMes();
  }
  return false;
}

/** Último dia em que uma vez da série pode começar (por data ou por número de vezes). */
const CACHE_FIM = new Map();
function ultimoInicio(n) {
  if (n.repetir === "nao") return n.td;
  if (n.fim.tipo === "data") return n.fim.td;
  if (n.fim.tipo !== "vezes") return Infinity;
  const chave = JSON.stringify([CAL_ID, n.td, n.repetir, n.cada, n.diasSemana, n.modoMes, n.fim.vezes, CFG.nome, CFG.meses.length]);
  if (CACHE_FIM.has(chave)) return CACHE_FIM.get(chave);
  let cont = 0, ult = n.td;
  for (let td = n.td; td < n.td + 200000 && cont < n.fim.vezes; td++) if (bateRegra(n, td)) { cont++; ult = td; }
  if (CACHE_FIM.size > 500) CACHE_FIM.clear();
  CACHE_FIM.set(chave, ult);
  return ult;
}

/** Uma vez da série começa neste dia? */
const comecaEm = (n, td) => td <= ultimoInicio(n) && !n.excecoes.includes(td) && bateRegra(n, td);

/** Dia em que começa a vez da série que cobre este dia (eventos de vários dias), ou null. */
function inicioQueCobre(n, td) {
  for (let s = td; s > td - n.duracao; s--) if (comecaEm(n, s)) return s;
  return null;
}

const acontece = (n, inf) => inicioQueCobre(n, inf.td) !== null;

const notasDoDia = (td, lista = notas()) => {
  const inf = infoDia(td);
  return lista.filter(({ n }) => acontece(n, inf)).sort((a, b) => (a.n.hora || "99").localeCompare(b.n.hora || "99"));
};

/** Próximas vezes que a nota acontece a partir de um dia. */
function proximasVezes(n, desde, qtd = 5, limite = 4000) {
  const r = [];
  const fim = Math.min(desde + limite, ultimoInicio(n));
  for (let td = desde; td <= fim && r.length < qtd; td++) if (comecaEm(n, td)) r.push(td);
  return r;
}

/** Frase que descreve a repetição, ex.: "A cada 2 semanas: Dia da Água e Dia do Fogo, até 3 de Brasa de 1024". */
function descreverRepeticao(n) {
  if (n.repetir === "nao") return n.duracao > 1 ? T("{0} dias", [n.duracao]) : T("Não repete");
  const base = infoDia(n.td);
  const un = { dias: T("dias"), semanas: T("semanas"), meses: T("meses"), anos: T("anos") }[n.repetir];
  let t = n.cada === 1 ? { dias: T("Todo dia"), semanas: T("Toda semana"), meses: T("Todo mês"), anos: T("Todo ano") }[n.repetir] : T("A cada {0} {1}", [n.cada, un]);
  const sem = (i) => CFG.semana[i]?.nome ?? "?";
  const ordinal = (k) => [T("1º"), T("2º"), T("3º"), T("4º"), T("5º"), T("6º")][k] ?? `${k + 1}º`;
  if (n.repetir === "semanas") t += `: ${n.diasSemana.map(sem).join(", ").replace(/, ([^,]*)$/, ` ${T("e")} $1`)}`;
  if (n.repetir === "meses" || n.repetir === "anos") {
    const mes = n.repetir === "anos" ? T(" de {0}", [CFG.meses[base.mes]?.nome]) : "";
    t += n.modoMes === "dia" ? T(", no dia {0}{1}", [base.dia + 1, mes])
      : n.modoMes === "ultima" ? T(", no último {0}{1}", [sem(base.sem), mes])
      : T(", no {0} {1}{2}", [ordinal(posNoMes(base).nth), sem(base.sem), mes]);
  }
  if (n.duracao > 1) t += T(", durando {0} dias", [n.duracao]);
  if (n.fim.tipo === "data") t += T(", até {0}", [textoData(infoDia(n.fim.td), { semana: false })]);
  if (n.fim.tipo === "vezes") t += n.fim.vezes === 1 ? T(", 1 vez") : T(", {0} vezes", [n.fim.vezes]);
  if (n.excecoes.length) t += n.excecoes.length === 1 ? T(" (1 pulada)") : T(" ({0} puladas)", [n.excecoes.length]);
  return t;
}

function segundosDaHora(hora) {
  if (!hora) return 0;
  const [h, m] = hora.split(":").map(Number);
  return Math.min(h, CFG.horasDia - 1) * segHora() + Math.min(m, CFG.minutosHora - 1) * segMinuto();
}

async function pastaCalendario() {
  let f = game.folders.find((f) => f.type === "JournalEntry" && f.getFlag(MOD, "pasta"));
  if (!f && game.user.isGM) f = await Folder.create({ name: "Calendário", type: "JournalEntry", color: "#3a5f8a", flags: { [MOD]: { pasta: true } } });
  return f ?? null;
}

const caminhoPasta = (f) => { const n = []; for (let p = f; p; p = p.folder) n.unshift(p.name); return n.join(" / "); };

/** Pasta onde a nota vai ficar: a escolhida, uma nova, ou a "Calendário"; com subpasta por ano se ligado. */
async function pastaParaNota(escolha, novoNome, td) {
  if (!game.user.isGM) return pastaCalendario();
  let base = null;
  try {
    if (escolha === "__nova" && novoNome) base = await Folder.create({ name: novoNome, type: "JournalEntry", folder: (await pastaCalendario())?.id ?? null });
    else if (escolha) base = game.folders.get(escolha) ?? null;
  } catch (err) { console.warn(`${MOD} | pasta`, err); }
  base ??= await pastaCalendario();
  if (base && escolha !== "__nova") await game.settings.set(MOD, "pastaNotas", escolha === "" ? "" : base.id);
  if (base && game.settings.get(MOD, "pastaPorAno")) {
    const nome = `Ano ${infoDia(td).ano + CFG.anoInicial}`;
    try {
      return game.folders.find((f) => f.type === "JournalEntry" && f.folder?.id === base.id && f.name === nome)
        ?? await Folder.create({ name: nome, type: "JournalEntry", folder: base.id, color: base.color ?? null });
    } catch (err) { console.warn(`${MOD} | subpasta do ano (limite de profundidade?)`, err); }
  }
  return base;
}

function abrirNota(j) {
  const api = game.modules.get(JOURNAL)?.active ? game.modules.get(JOURNAL).api : null;
  if (game.settings.get(MOD, "abrirNoJournal") && typeof api?.abrir === "function") {
    try { return api.abrir(j.id); } catch (err) { console.warn(`${MOD} | Journal da Mesa não abriu a nota`, err); }
  }
  return j.sheet.render(true);
}

const podeCriarNota = () => game.user.isGM || game.user.can?.("JOURNAL_CREATE");

/** O Journal (4.6+) está ativo e tem a Linha do tempo? */
const linhaDoJournal = () => !!game.modules.get(JOURNAL)?.active && typeof game.modules.get(JOURNAL)?.api?.linhaDoTempo === "function";

/** O Journal está ativo e pronto para editar notas? */
const journalPronto = () => !!game.modules.get(JOURNAL)?.active && typeof game.modules.get(JOURNAL)?.api?.abrir === "function";

/** Quem edita as notas: o Journal (quando ativo e escolhido nas configurações) ou o próprio calendário. */
const notasNoJournal = () => game.settings.get(MOD, "editorNotas") === "journal" && journalPronto();

/** Cria a nota já como página do Journal e abre nele para preencher. */
async function novaNotaNoJournal(td) {
  const gm = game.user.isGM;
  const pasta = await pastaParaNota(gm ? game.settings.get(MOD, "pastaNotas") : "", "", td);
  const ownership = { default: 0 };
  if (!gm) ownership[game.user.id] = 3;
  const e = await JournalEntry.create({
    name: T("Novo evento"),
    folder: pasta?.id ?? null,
    ownership,
    flags: { [MOD]: { nota: notaNova(td) } },
    pages: [paginaDeEvento(T("Novo evento"))]
  });
  if (e) game.modules.get(JOURNAL).api.abrir(e.id);
  return e;
}

/** Nova nota pelo editor escolhido. */
const criarNota = (td) => (notasNoJournal() ? novaNotaNoJournal(td) : ferr("dialogoNota", td));
/** Editar nota pelo editor escolhido. */
const editarNota = (j) => (notasNoJournal() ? game.modules.get(JOURNAL).api.abrir(j.id) : ferr("dialogoNota", null, j));

/** Nota no mesmo formato que o Journal grava (repetição "nao", "anual", "mensal", "semanal" ou "ndias"). */
function notaNova(td, campos = {}) {
  return { td, hora: "", repetir: "nao", cada: 7, cor: "#c9a227", icone: "fa-star", aviso: "nenhum", duracao: 1, cal: CAL_ID, ...campos };
}

/** Página de texto já marcada como Anotação do Journal (formato do Monk's), para abrir configurada nele. */
function paginaDeEvento(nome, html = "") {
  return {
    name: nome, type: "text", text: { content: html },
    flags: { "monks-enhanced-journal": { type: "journalentry", relationships: {} }, [JOURNAL]: {} }
  };
}

async function apagarNota(j) {
  const ok = await Dialogo().confirm({
    window: { title: T("Apagar nota"), icon: "fa-solid fa-trash" },
    content: `<p>${T("Apagar")} <b>${esc(j.name)}</b> ${T("do calendário?")}</p><p class="cm-dica">${T("Isso apaga o Diário \"{0}\". Para só tirar do calendário e manter o Diário, escolha \"Tirar do calendário\".", [esc(j.name)])}</p>`,
    yes: { label: T("Apagar o Diário") }, no: { label: T("Cancelar") }
  });
  if (ok) return j.delete();
}

/* ---------------- avisos, Journal e escuridão ---------------- */

async function chat(content, whisper = []) {
  return ChatMessage.create({ content: `<div class="cm-chat">${content}</div>`, speaker: { alias: "Calendário" }, whisper });
}

async function avisarNotas(antes, depois) {
  if (!game.journal.some((j) => { const r = j.getFlag(MOD, "nota"); return r && r.aviso && r.aviso !== "nenhum"; })) return;
  const { lista: cals } = listaCalendarios();
  const msgs = [];
  for (const id of Object.keys(cals)) {
    comCal(id, () => {
      const lista = notas({ todas: true }).filter(({ n }) => n.aviso !== "nenhum");
      if (!lista.length) return;
      const d0 = diaTotalDe(antes), d1 = diaTotalDe(depois);
      if (d1 - d0 > 400) return; // salto grande demais: não inunda o chat
      for (let td = d0; td <= d1; td++) {
        for (const { j, n } of lista.filter((x) => comecaEm(x.n, td))) {
          const gatilho = td * segDia() + segundosDaHora(n.hora);
          if (gatilho <= antes || gatilho > depois) continue;
          const quando = textoData(infoDia(td)) + (n.hora ? ` · ${n.hora}` : "") + (Object.keys(cals).length > 1 ? ` · ${CFG.nome}` : "");
          msgs.push([`<i class="fa-solid ${n.icone}" style="color:${n.cor}"></i> <b>${esc(j.name)}</b><br><small>${esc(quando)}</small>`, n.aviso === "mestre" ? idsGM() : []]);
        }
      }
    });
  }
  for (const [c, w] of msgs) await chat(c, w);
}

async function integrarJournal(dias, semanas) {
  if (!game.settings.get(MOD, "integrarJournal")) return;
  const jm = game.modules.get(JOURNAL);
  if (!jm?.active) return;
  if (dias) {
    // Journal 4.4+: API própria; versões antigas: o setting direto (reserva)
    if (typeof jm.api?.dia?.somar === "function") await jm.api.dia.somar(dias);
    else if (game.settings.settings.has(`${JOURNAL}.dia`)) {
      const atual = num(game.settings.get(JOURNAL, "dia"), 1);
      await game.settings.set(JOURNAL, "dia", Math.max(1, atual + dias));
    }
  }
  if (semanas > 0) {
    // o Journal devolve true quando renovou as lojas sozinho (opção dele); senão, só avisamos o mestre
    let renovou = false;
    if (typeof jm.api?.renovarEstoques === "function") {
      try { renovou = !!(await jm.api.renovarEstoques()); } catch (err) { relatarErro(T("renovar estoques do Journal da Mesa"), err); }
    }
    if (!renovou && game.settings.get(MOD, "avisoSemana")) {
      await chat(`<i class="fa-solid fa-store"></i> ${T("Começou uma nova semana. Hora de renovar o")} <b>${T("estoque das lojas")}</b> ${T("no Journal da Mesa.")}`, idsGM());
    }
  }
}

/* ---------------- luz do mapa (escuridão nativa da cena) ---------------- */

/** Curva padrão de luz (0 a 100) para cada hora do dia, adaptada a quantas horas o dia tiver. */
function luzPadrao(H = CFG.horasDia) {
  const base = { 5: 10, 6: 35, 7: 70, 8: 90, 17: 90, 18: 65, 19: 30 };
  return Array.from({ length: H }, (_, h) => {
    const t = Math.round((h / H) * 24);
    if (t < 5 || t >= 20) return 0;
    return base[t] ?? 100;
  });
}

function luzCfg() {
  const L = foundry.utils.deepClone(game.settings.get(MOD, "luz") ?? {});
  const H = CFG.horasDia;
  let horas = Array.isArray(L.horas) ? L.horas.map((v) => Math.min(100, Math.max(0, num(v, 0)))) : [];
  if (horas.length !== H) {
    // o dia mudou de tamanho: estica ou encolhe a curva salva
    horas = horas.length ? Array.from({ length: H }, (_, h) => horas[Math.floor((h / H) * horas.length)]) : luzPadrao(H);
  }
  return {
    horas,
    luaMax: Math.min(100, Math.max(0, num(L.luaMax, 30))),
    corNoite: /^#[0-9a-f]{6}$/i.test(L.corNoite) ? L.corNoite : "#9db7ff",
    corIntensidade: Math.min(1, Math.max(0, num(L.corIntensidade, 0.4))),
    gradual: L.gradual ?? true,
    transicao: Math.min(30, Math.max(1, num(L.transicao, 6)))
  };
}

function hexParaHsv(hex) {
  const n = parseInt(String(hex).slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) h = max === r ? mod((g - b) / d, 6) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h / 6, s: max ? d / max : 0, v: max };
}

/** Luz do sol pela tabela de horas (0 a 1). Usa uma curva suave (Catmull-Rom) que passa por cada hora,
 *  então a luz não muda "em degraus" na virada das horas. */
function luzDoSol(wt, L = luzCfg()) {
  const H = CFG.horasDia, v = L.horas;
  const hd = segundoDoDia(wt) / segHora();
  const i = Math.floor(hd) % H, f = hd - Math.floor(hd);
  const p0 = v[mod(i - 1, H)], p1 = v[i], p2 = v[(i + 1) % H], p3 = v[(i + 2) % H];
  const c = 0.5 * (2 * p1 + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f);
  return Math.min(100, Math.max(0, Math.min(Math.max(c, Math.min(p1, p2)), Math.max(p1, p2)))) / 100;
}

/** O que a cena deve mostrar neste momento: escuridão e a cor da noite. */
function estadoLuz(wt, L = luzCfg()) {
  const sol = luzDoSol(wt, L);
  const td = diaTotalDe(wt);
  let ilu = 0, corLua = null;
  for (const l of luasNoCeu(td)) { const i = faseDe(l, td).iluminacao; if (i > ilu) { ilu = i; corLua = l.cor; } }
  const luzLua = (L.luaMax / 100) * ilu;          // sem lua no céu (ou lua nova) = sem luz noturna
  const luz = Math.max(sol, luzLua);
  const corDaLua = corLua && ilu > 0.05 && hexParaHsv(corLua).s >= 0.15;
  const hsv = hexParaHsv(corDaLua ? corLua : L.corNoite);
  return {
    escuridao: Math.round((1 - luz) * 1000) / 1000,
    hue: Math.round(hsv.h * 1000) / 1000,
    intensidade: Math.round(L.corIntensidade * (luzLua > 0.01 ? 1 : 0.6) * 100) / 100
  };
}

const cenasDiaNoite = () => game.scenes.filter((s) => s.getFlag(MOD, "diaNoite"));
const cenaEmUso = (s) => s.active || game.users.some((u) => u.active && u.viewedScene === s.id);

/** Atualiza várias cenas de uma vez (uma ida ao servidor). Se o lote for recusado, tenta cena por cena
 *  e relata quais falharam, sem esconder a falha. */
async function atualizarCenas(updates, opcoes = {}, onde = "atualizar cenas") {
  if (!updates.length) return;
  const Cena = CONFIG.Scene.documentClass;
  try {
    await Cena.updateDocuments(updates, opcoes);
  } catch (err) {
    console.warn(`${MOD} | ${onde}: lote recusado, tentando uma cena por vez`, err);
    const r = await Promise.allSettled(updates.map(({ _id, ...upd }) => game.scenes.get(_id)?.update(upd, opcoes)));
    const falhas = r.map((x, i) => (x.status === "rejected" ? game.scenes.get(updates[i]._id)?.name ?? updates[i]._id : null)).filter(Boolean);
    if (falhas.length) relatarErro(`${onde} (${falhas.join(", ")})`, r.find((x) => x.status === "rejected").reason);
  }
}

const visaoDiaNoite = () => { try { return game.settings.get(MOD, "visaoDiaNoite") === true; } catch { return false; } };
const limiteVisao = () => { try { return Math.max(0, Math.min(1, num(game.settings.get(MOD, "visaoLimite"), 0.6))); } catch { return 0.6; } };

async function aplicarLuz(estado, ms = 2000, cenas = cenasDiaNoite(), limiar = 0.004) {
  if (!souGMPrincipal()) return;
  const updates = [];
  for (const s of cenas) {
    const env = s.environment ?? {};
    if (env.darknessLock) continue;   // escuridão travada pelo mestre na configuração da cena
    const upd = {};
    if (Math.abs(num(env.darknessLevel, -1) - estado.escuridao) >= limiar) upd["environment.darknessLevel"] = estado.escuridao;
    if (Math.abs(num(env.dark?.hue, -1) - estado.hue) > 0.004) upd["environment.dark.hue"] = estado.hue;
    if (Math.abs(num(env.dark?.intensity, -1) - estado.intensidade) >= 0.01) upd["environment.dark.intensity"] = estado.intensidade;
    if (env.cycle === false) upd["environment.cycle"] = true;
    // visão pelo dia e noite: a luz global (o mapa todo visível) só vale até um nível de escuridão;
    // de noite ficam só a visão dos tokens e as luzes, e a névoa de guerra volta a esconder o mapa
    if (visaoDiaNoite()) {
      const lim = limiteVisao();
      if (env.globalLight?.enabled !== true) upd["environment.globalLight.enabled"] = true;
      if (Math.abs(num(env.globalLight?.darkness?.max, -1) - lim) > 0.001) upd["environment.globalLight.darkness.max"] = lim;
      if (s.tokenVision === false) upd.tokenVision = true;
    }
    if (Object.keys(upd).length) updates.push({ _id: s.id, ...upd });
  }
  // as cenas são independentes e recebem a mesma animação: um só lote
  await atualizarCenas(updates, { animateDarkness: ms }, "luz das cenas");
}

let SEQ_LUZ = 0;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** Leva a luz das cenas de "antes" até "depois". Saltos grandes passam hora a hora. */
async function atualizarLuz(antes, depois) {
  if (!souGMPrincipal() || !cenasDiaNoite().length) return;
  const id = ++SEQ_LUZ;
  const L = luzCfg();
  const dt = depois - antes;
  // passos pequenos (relógio andando, +10 min): uma animação longa que emenda com a próxima
  const continuo = game.settings.get(MOD, "relogioAtivo") ? 5500 : 2000;
  // passos pequenos só mexem nas cenas que alguém está vendo, e só quando a luz muda de verdade (menos gravações no servidor)
  if (Math.abs(dt) <= segHora() && Number.isFinite(antes)) return aplicarLuz(estadoLuz(depois, L), continuo, cenasDiaNoite().filter(cenaEmUso), 0.01);
  if (!L.gradual || !Number.isFinite(antes)) return aplicarLuz(estadoLuz(depois, L), continuo);
  const passo = segHora() / 4, sentido = Math.sign(dt);          // um passo a cada 15 minutos do jogo
  const ini = Math.abs(dt) > segDia() ? depois - sentido * segDia() : antes;   // no máximo um dia inteiro de passagem
  const passos = [];
  for (let t = ini + sentido * passo; sentido > 0 ? t < depois : t > depois; t += sentido * passo) passos.push(t);
  passos.push(depois);
  const ms = Math.round(Math.max(80, Math.min(1500, (L.transicao * 1000) / passos.length)));
  const emUso = cenasDiaNoite().filter(cenaEmUso);
  for (const t of passos) {
    if (id !== SEQ_LUZ) return;                    // o tempo mudou de novo no meio da passagem
    await aplicarLuz(estadoLuz(t, L), ms, emUso);
    await esperar(ms);
  }
  if (id === SEQ_LUZ) await aplicarLuz(estadoLuz(depois, L), 0);   // cenas que ninguém está vendo vão direto
}

async function aoMudarTempo(wt, delta) {
  const antes = wt - delta;
  const desfazendo = DESFAZER.alvo != null && wt === DESFAZER.alvo;
  const d0 = diaTotalDe(antes), d1 = diaTotalDe(wt);
  if (d0 === d1) HUD.atualizarHora(); else HUD.render();
  if (d0 !== d1) for (const app of foundry.applications.instances.values()) if (app instanceof JanelaCalendario) app.irParaHoje(false);
  foundry.applications.instances.get("cm-contadores")?.render();
  foundry.applications.instances.get("cm-viagem")?.render();
  puloCinematografico(antes, wt);
  if (!souGMPrincipal()) return;
  // a luz não espera a fila (ela mesma cancela passagens antigas pelo SEQ_LUZ)
  atualizarLuz(antes, wt).catch((err) => relatarErro("luz das cenas", err));
  // desfazer: o tempo voltou para trás de propósito; nada de clima, histórico ou avisos novos
  if (desfazendo) { DESFAZER.alvo = null; return naFila("tempo", () => restaurarDesfazer()); }
  // guarda como estava antes deste pulo (para o botão Desfazer)
  guardarParaDesfazer(antes, wt);
  // o resto roda em ordem: dois cliques rápidos não avisam o mesmo prazo duas vezes
  return naFila("tempo", () => processarMudancaDeTempo(antes, wt, delta));
}

async function processarMudancaDeTempo(antes, wt, delta) {
  const d0 = diaTotalDe(antes), d1 = diaTotalDe(wt);
  await verificarContadores(antes, wt);

  if (d0 !== d1) {
    let semanas = 0;
    if (d1 > d0) for (let td = d0 + 1; td <= Math.min(d1, d0 + 400); td++) if (infoDia(td).sem === 0) semanas++;
    Hooks.callAll("calendarioMesa.novoDia", infoDia(d1), d1 - d0);
    if (semanas) Hooks.callAll("calendarioMesa.novaSemana", infoDia(d1), semanas);
    await integrarJournal(d1 - d0, semanas);
    // histórico: eventos que começaram e saltos grandes
    const reg = [];
    if (Math.abs(d1 - d0) > 1) reg.push({ texto: d1 > d0 ? T("Passaram {0} dias", [Math.abs(d1 - d0)]) : T("Voltaram {0} dias", [Math.abs(d1 - d0)]), icone: "fa-forward" });
    if (d1 > d0) {
      const lista = notas({ todas: true });
      for (let td = Math.max(d0 + 1, d1 - 60); td <= d1; td++) {
        for (const { j, n } of lista.filter((x) => comecaEm(x.n, td))) reg.push({ texto: j.name, icone: n.icone === "fa-hands-praying" ? "fa-hands-praying" : "fa-star", wt: td * segDia() });
      }
    }
    await registrarVarios(reg);
    await atualizarClima();
    if (d1 > d0) await avisarEventosLuas(d0 + 1, d1);
  }
  if (delta > 0) {
    await avisarNotas(antes, wt);
    await dispararAcoesDasNotas(antes, wt);
    // efeitos vencidos: não a cada tique de 5 s do relógio em tempo real; só quando o minuto do jogo muda
    // (um pulo de dia ou de hora sempre muda o minuto). Com a opção em "Não mexer", a própria função sai na hora.
    if (Math.floor(antes / segMinuto()) !== Math.floor(wt / segMinuto())) await expirarEfeitos(wt);
  }
}

/* ---------------- efeitos com duração (ActiveEffect) ----------------
 * O Foundry guarda em cada efeito quando ele começou (duration.startTime, em segundos do mundo) e quanto
 * dura (seconds, ou rounds/turns de combate). Quando o tempo passa, os efeitos vencidos dos personagens
 * (atores do mundo e tokens não vinculados das cenas em uso) são removidos ou desativados. */
function fimDoEfeito(e) {
  const d = e._source?.duration ?? e.duration ?? {};
  const inicio = d.startTime;
  if (inicio == null || !Number.isFinite(Number(inicio))) return null;
  const rodada = num(CONFIG.time?.roundTime, 6);
  let seg = num(d.seconds, 0);
  if (!seg && (num(d.rounds, 0) || num(d.turns, 0))) {
    // em combate, rodadas e turnos são do combate (o próprio sistema cuida); fora dele viram segundos
    if (d.combat && game.combats?.get?.(d.combat)?.started) return null;
    seg = num(d.rounds, 0) * rodada + num(d.turns, 0) * (rodada / 10);
  }
  return seg > 0 ? Number(inicio) + seg : null;
}

function atoresParaEfeitos() {
  const lista = new Map();
  for (const a of game.actors ?? []) lista.set(a.uuid, a);
  for (const sc of game.scenes ?? []) {
    if (!(sc.active || game.users?.some?.((u) => u.active && u.viewedScene === sc.id))) continue;
    for (const t of sc.tokens ?? []) if (!t.actorLink && t.actor) lista.set(t.actor.uuid, t.actor);
  }
  return [...lista.values()];
}

async function expirarEfeitos(wt) {
  if (!souGMPrincipal()) return [];
  const modo = game.settings.get(MOD, "efeitosVencidos");
  if (modo === "nao") return [];
  const relatorio = [];
  for (const ator of atoresParaEfeitos()) {
    const vencidos = (ator.effects ?? []).filter((e) => !e.disabled && (() => { const f = fimDoEfeito(e); return f != null && f <= wt; })());
    if (!vencidos.length) continue;
    try {
      if (modo === "desativar") await ator.updateEmbeddedDocuments("ActiveEffect", vencidos.map((e) => ({ _id: e.id, disabled: true })));
      else await ator.deleteEmbeddedDocuments("ActiveEffect", vencidos.map((e) => e.id));
      relatorio.push({ ator: ator.name, efeitos: vencidos.map((e) => e.name) });
    } catch (err) { relatarErro(T("efeitos vencidos de {nome}", { nome: ator.name }), err, { avisar: false }); }
  }
  if (relatorio.length && game.settings.get(MOD, "efeitosAviso")) {
    const linhas = relatorio.map((r) => `<li><b>${esc(r.ator)}</b>: ${r.efeitos.map(esc).join(", ")}</li>`).join("");
    await chat(`<i class="fa-solid fa-hourglass-end"></i> <b>${modo === "desativar" ? T("Efeitos que acabaram (desativados)") : T("Efeitos que acabaram")}</b><ul>${linhas}</ul>`, idsGM());
  }
  return relatorio;
}

/* ---------------- ações das notas ----------------
 * Uma nota pode, quando a hora dela chega: rodar uma macro, tocar um som, trocar de cena e mandar um texto
 * no chat. Fica em flags[MOD].acoes = { macro, som, volume, cena, cenaModo: "ativar"|"ver", chat, chatPara }. */
const MODOS_CENA = { ativar: "Ativar para todos", ver: "Só o mestre vai para a cena" };
function acoesDaNota(j) {
  const a = j?.getFlag?.(MOD, "acoes");
  if (!a || typeof a !== "object") return null;
  const r = {
    macro: String(a.macro ?? "").trim(), som: String(a.som ?? "").trim(), volume: Math.max(0, Math.min(1, num(a.volume, 0.8))),
    cena: String(a.cena ?? "").trim(), cenaModo: MODOS_CENA[a.cenaModo] ? a.cenaModo : "ativar",
    chat: String(a.chat ?? "").trim(), chatPara: a.chatPara === "mestre" ? "mestre" : "todos"
  };
  return r.macro || r.som || r.cena || r.chat ? r : null;
}

async function executarAcoes(j, a, td) {
  const nome = j.name;
  if (a.chat) await chat(`<i class="fa-solid fa-bell"></i> <b>${esc(nome)}</b><br>${esc(a.chat)}`, a.chatPara === "mestre" ? idsGM() : []);
  if (a.som) {
    try {
      await foundry.audio.AudioHelper.play({ src: a.som, volume: a.volume, autoplay: true, loop: false }, true);
    } catch (err) { relatarErro(T("som da nota {nome}", { nome }), err); }
  }
  if (a.cena) {
    const cena = game.scenes.get(a.cena) ?? (await fromUuid(a.cena).catch(() => null));
    if (cena) { try { await (a.cenaModo === "ver" ? cena.view() : cena.activate()); } catch (err) { relatarErro(T("cena da nota {nome}", { nome }), err); } }
  }
  if (a.macro) {
    const m = game.macros?.get(a.macro) ?? (await fromUuid(a.macro).catch(() => null));
    if (m) { try { await m.execute({ nota: j, td, data: infoDia(td) }); } catch (err) { relatarErro(T("macro da nota {nome}", { nome }), err); } }
    else relatarErro(T("macro da nota {nome}", { nome }), new Error(T("Macro não encontrada")));
  }
}

/** Roda as ações das notas cuja hora caiu entre "antes" (exclusive) e "depois" (inclusive). */
async function dispararAcoesDasNotas(antes, depois) {
  if (!souGMPrincipal()) return [];
  const comAcoes = game.journal.filter((j) => j.getFlag(MOD, "nota") && acoesDaNota(j));
  if (!comAcoes.length) return [];
  const d0 = diaTotalDe(antes), d1 = diaTotalDe(depois);
  if (d1 - d0 > 60) return [];   // salto grande: não dispara dezenas de ações de uma vez
  const disparos = [];
  const { lista: cals } = listaCalendarios();
  for (const id of Object.keys(cals)) {
    comCal(id, () => {
      const lista = notas({ todas: true, id }).filter(({ j }) => comAcoes.includes(j));
      for (let td = d0; td <= d1; td++) {
        for (const { j, n } of lista.filter((x) => comecaEm(x.n, td))) {
          const gatilho = td * segDia() + segundosDaHora(n.hora);
          if (gatilho <= antes || gatilho > depois) continue;
          disparos.push({ j, td, gatilho, a: acoesDaNota(j) });
        }
      }
    });
  }
  disparos.sort((x, y) => x.gatilho - y.gatilho);
  for (const d of disparos) await executarAcoes(d.j, d.a, d.td);
  return disparos;
}

/* ---------------- eventos das luas ----------------
 * Calculados a partir das fases e das aparições que o calendário já tem:
 *  · luas cheias juntas: duas ou mais luas visíveis e cheias no mesmo dia;
 *  · eclipse solar: no dia exato da lua nova, em alguns ciclos (a chance por ciclo é uma configuração);
 *  · eclipse lunar: no dia exato da lua cheia, em alguns ciclos;
 *  · noite sem luas: com duas ou mais luas, nenhuma no céu (todas novas ou fora do céu).
 * O sorteio dos eclipses é fixo (depende só da lua e do ciclo), então todo mundo vê os mesmos dias. */
function sorteioFixo(...partes) {
  let h = 2166136261;
  for (const ch of partes.join("|")) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h / 4294967296;
}
const CACHE_LUAS = new Map();
function eventosLuasDoDia(td) {
  if (!CFG?.luas?.length) return [];
  const chave = `${CAL_ID}:${td}`;
  if (CACHE_LUAS.has(chave)) return CACHE_LUAS.get(chave);
  const chance = Math.max(0, Math.min(1, num(game.settings.get(MOD, "eclipseChance"), 15) / 100));
  const ev = [];
  const visiveis = [];
  for (const [i, l] of CFG.luas.entries()) {
    if (!visibilidadeLua(l, td).visivel) continue;
    const f = faseDe(l, td);
    visiveis.push({ l, f });
    if (!(l.ciclo > 1)) continue;
    // dia em que a posição no ciclo passa pelo ponto exato (0 = nova, 0,5 = cheia)
    const pos = mod(td - l.deslocamento, l.ciclo);
    const ciclo = Math.floor((td - l.deslocamento) / l.ciclo);
    // o sorteio usa o id da lua quando ela tem um (renomear não muda os eclipses); sem id, o nome, como sempre foi
    const semente = l.id ?? l.nome;
    if (pos < 1 && chance && sorteioFixo(semente, i, ciclo, "sol") < chance) ev.push({ tipo: "eclipseSolar", luas: [l.nome], icone: "fa-circle-half-stroke", cor: l.cor });
    const metade = l.ciclo / 2;
    if (pos >= metade - 0.5 && pos < metade + 0.5 && chance && sorteioFixo(semente, i, ciclo, "lua") < chance) ev.push({ tipo: "eclipseLunar", luas: [l.nome], icone: "fa-moon", cor: "#c0392b" });
  }
  const cheias = visiveis.filter(({ f }) => f.cheia);
  if (cheias.length >= 2) ev.push({ tipo: "cheiasJuntas", luas: cheias.map(({ l }) => l.nome), icone: "fa-circle", cor: "#f1e3a6" });
  if (CFG.luas.length >= 2 && visiveis.every(({ f }) => f.nova)) ev.push({ tipo: "semLuas", luas: [], icone: "fa-eye-slash", cor: "#8a8fa8" });
  if (CACHE_LUAS.size > 4000) CACHE_LUAS.clear();
  CACHE_LUAS.set(chave, ev);
  return ev;
}
function textoEventoLua(e) {
  const nomes = e.luas.join(T(" e "));
  switch (e.tipo) {
    case "eclipseSolar": return T("Eclipse solar: {lua} cobre o sol", { lua: nomes });
    case "eclipseLunar": return T("Eclipse lunar em {lua}", { lua: nomes });
    case "cheiasJuntas": return T("Luas cheias juntas: {luas}", { luas: nomes });
    case "semLuas": return T("Noite sem luas: todas somem do céu");
    default: return e.tipo;
  }
}
/** Próximos eventos das luas a partir de um dia (até "dias" dias à frente). */
function proximosEventosLuas(desde, dias = 120, max = 8) {
  const r = [];
  for (let td = desde; td <= desde + dias && r.length < max; td++) for (const e of eventosLuasDoDia(td)) if (r.length < max) r.push({ td, ...e });
  return r;
}
async function avisarEventosLuas(de, ate) {
  const quem = game.settings.get(MOD, "luasAviso");
  if (quem === "nenhum" || ate - de > 60) return;
  for (let td = de; td <= ate; td++) {
    const ev = eventosLuasDoDia(td);
    if (!ev.length) continue;
    await chat(`<i class="fa-solid fa-moon"></i> <b>${T("No céu")}</b> · <small>${esc(textoData(infoDia(td), { semana: false }))}</small><ul>${ev.map((e) => `<li><i class="fa-solid ${e.icone}" style="color:${e.cor}"></i> ${esc(textoEventoLua(e))}</li>`).join("")}</ul>`, quem === "mestre" ? idsGM() : []);
    await registrarVarios(ev.map((e) => ({ texto: textoEventoLua(e), icone: e.icone, wt: td * segDia() })));
  }
}

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

/* ---------------- desfazer o último pulo de tempo ----------------
 * Antes de cada mudança de tempo feita pelo mestre, guarda como estavam o tempo, o clima, o histórico,
 * os contadores e o dia do Journal. Desfazer volta o tempo sem rolar clima nem avisar nada e restaura o resto. */
const DESFAZER = { pilha: [], alvo: null, restaurar: null, tique: null };
function guardarParaDesfazer(antes, depois) {
  if (!souGMPrincipal() || antes === depois) return;
  if (DESFAZER.tique != null && depois === DESFAZER.tique) { DESFAZER.tique = null; return; }
  try {
    DESFAZER.pilha.push({
      antes, depois,
      clima: foundry.utils.deepClone(game.settings.get(MOD, "climaAtual") ?? {}),
      historicoIds: new Set(historico().map((h) => h.id)),
      contadores: foundry.utils.deepClone(game.settings.get(MOD, "contadores") ?? { lista: [] }),
      dias: diaTotalDe(depois) - diaTotalDe(antes)
    });
    if (DESFAZER.pilha.length > 5) DESFAZER.pilha.shift();
  } catch (err) { console.warn(`${MOD} | desfazer`, err); }
}
async function desfazerUltimoPulo() {
  if (!game.user.isGM) return false;
  const ult = DESFAZER.pilha.at(-1);
  if (!ult) { ui.notifications.info(T("Não há pulo de tempo para desfazer.")); return false; }
  if (game.time.worldTime !== ult.depois) {
    const ok = await Dialogo().confirm({ window: { title: T("Desfazer") }, content: `<p>${T("O tempo mudou depois desse pulo. Voltar mesmo assim para {quando}?", { quando: esc(textoData(infoDia(diaTotalDe(ult.antes)))) })}</p>` });
    if (!ok) return false;
  }
  DESFAZER.pilha.pop();
  DESFAZER.restaurar = ult;
  DESFAZER.alvo = ult.antes;
  await game.time.set(ult.antes);
  return true;
}
async function restaurarDesfazer() {
  const u = DESFAZER.restaurar;
  DESFAZER.restaurar = null;
  if (!u) return;
  await game.settings.set(MOD, "climaAtual", u.clima);
  await alterarHistorico((itens) => itens.filter((h) => u.historicoIds.has(h.id)));
  await game.settings.set(MOD, "contadores", u.contadores);
  const jm = game.modules.get(JOURNAL);
  if (u.dias && game.settings.get(MOD, "integrarJournal") && jm?.active && typeof jm.api?.dia?.somar === "function") {
    try { await jm.api.dia.somar(-u.dias); } catch (err) { relatarErro(T("dia do Journal da Mesa"), err, { avisar: false }); }
  }
  await aplicarClimaNasCenas();
  HUD.render();
  ui.notifications.info(T("Pulo desfeito: voltou para {quando}.", { quando: `${textoData(infoDia(diaTotalDe(u.antes)), { semana: false })} ${textoRelogio(segundoDoDia(u.antes))}` }));
}

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
  ui.notifications.info(todos ? T("{n} opção(ões) mudada(s): recarregando para todos...", { n }) : T("{n} opção(ões) mudada(s): recarregando...", { n }));
  setTimeout(() => {
    try { if (todos) game.socket.emit("reload"); } catch (err) { console.warn(`${MOD} | recarregar jogadores`, err); }
    (foundry.utils.debouncedReload ?? (() => window.location.reload()))();
  }, 900);
}
Hooks.on("updateSetting", (doc) => configuracaoMudou(doc?.key, true));
Hooks.on("createSetting", (doc) => configuracaoMudou(doc?.key, true));
Hooks.on("clientSettingChanged", (chave) => configuracaoMudou(chave, false));
Hooks.on("closeSettingsConfig", () => recarregarSePreciso());

/* ---------------- controle de tempo ---------------- */

async function avancar(seg) {
  if (!game.user.isGM) return;
  return game.time.advance(Math.round(seg));
}

/** Avança até a próxima vez que o relógio marcar a hora (decimal) pedida. */
async function avancarAte(horaDec) {
  const s = segundoDoDia(game.time.worldTime);
  let diff = Math.round(horaDec * segHora()) - s;
  if (diff <= 0) diff += segDia();
  return avancar(diff);
}

async function irPara(td, { manterHora = true } = {}) {
  if (!game.user.isGM) return;
  const s = manterHora ? segundoDoDia(game.time.worldTime) : 0;
  return game.time.set(td * segDia() + s);
}

async function definirHoraDialogo() {
  const a = agora();
  const dados = await Dialogo().wait({
    window: { title: T("Definir hora"), icon: "fa-solid fa-clock" },
    position: { width: 300 },
    content: `<div class="cm-form"><label>${T("Hora do dia")}<input type="text" name="hora" value="${textoRelogio(segundoDoDia(a.wt))}" placeholder="${T("HH:MM ou HH:MM:SS")}" autofocus></label></div>`,
    buttons: [{ action: "ok", label: T("Definir"), default: true, callback: (ev, btn) => btn.form.elements.hora.value }, { action: "cancelar", label: T("Cancelar") }],
    rejectClose: false
  });
  const m = typeof dados === "string" ? dados.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/) : null;
  if (!m) return;
  const alvo = segundosDaHora(`${m[1]}:${m[2]}`) + Math.min(num(m[3], 0), segMinuto() - 1);
  return game.time.set(diaTotalDe(game.time.worldTime) * segDia() + alvo);
}

/* Relógio em tempo real. O intervalo pertence ao módulo (não a uma janela) e só existe para mestres.
 * A cada tique ele mede quanto tempo real passou de verdade: o navegador espaça os intervalos de abas em
 * segundo plano, e contar "5 s por tique" fazia o relógio atrasar quando o mestre trocava de aba.
 * Frações de segundo acumulam entre tiques, para não somar nem perder tempo no arredondamento. */
let relogio = null;
let RELOGIO_ULT = null;
let RELOGIO_RESTO = 0;
const RELOGIO_MAX_SALTO = 120;   // segundos reais: depois de o PC dormir, não despeja horas de uma vez
function iniciarRelogio() {
  if (relogio || !game.user.isGM) return;
  const PASSO = 5;
  RELOGIO_ULT = performance.now();
  relogio = setInterval(() => {
    const agoraMs = performance.now();
    const passou = Math.min(Math.max(0, (agoraMs - RELOGIO_ULT) / 1000), RELOGIO_MAX_SALTO);
    RELOGIO_ULT = agoraMs;
    const parado = !souGMPrincipal() || !game.settings.get(MOD, "relogioAtivo")
      || (game.paused && game.settings.get(MOD, "pausaJogo"))
      || (game.combat?.started && game.settings.get(MOD, "pausaCombate"));
    if (parado) { RELOGIO_RESTO = 0; return; }
    RELOGIO_RESTO += passou * Math.max(0, num(game.settings.get(MOD, "relogioTaxa"), 1));
    const seg = Math.floor(RELOGIO_RESTO);
    if (seg < 1) return;
    RELOGIO_RESTO -= seg;
    DESFAZER.tique = game.time.worldTime + seg;   // tique do relógio não entra no Desfazer
    game.time.advance(seg).catch((err) => relatarErro(T("relógio em tempo real"), err));
  }, PASSO * 1000);
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

/* ---------------- HUD ---------------- */

class HUD {
  static el = null;

  static montar() {
    if (this.el) return;
    const el = document.createElement("div");
    el.id = "cm-hud";
    document.body.append(el);
    this.el = el;

    el.addEventListener("click", (ev) => {
      const a = ev.target.closest("[data-acao]");
      if (!a) return;
      ev.preventDefault();
      this.acao(a.dataset.acao, a.dataset);
    });

    // arrastar: no modo completo pela alça; no mini (data e hora) e no oculto (bolinha), por qualquer ponto.
    // Só começa a mover depois de 4 px, para o clique duplo (trocar de modo) continuar funcionando.
    el.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      const pelaAlca = !!ev.target.closest(".cm-arrasta");
      const pequeno = el.classList.contains("cm-mini") || el.classList.contains("cm-oculto");
      if (!pelaAlca && !(pequeno && !ev.target.closest("[data-acao], a, button, select, input"))) return;
      if (pelaAlca) ev.preventDefault();
      const r = el.getBoundingClientRect();
      const dx = ev.clientX - r.left, dy = ev.clientY - r.top;
      const x0 = ev.clientX, y0 = ev.clientY;
      let movendo = pelaAlca;
      const mover = (e) => {
        if (!movendo) {
          if (Math.hypot(e.clientX - x0, e.clientY - y0) < 4) return;
          movendo = true;
          el.classList.add("cm-movendo");
        }
        const larg = el.offsetWidth || 60, alt = el.offsetHeight || 30;
        el.style.left = `${Math.max(0, Math.min(window.innerWidth - Math.min(larg, 60), e.clientX - dx))}px`;
        el.style.top = `${Math.max(0, Math.min(window.innerHeight - Math.min(alt, 30), e.clientY - dy))}px`;
        el.style.transform = "none";
      };
      const soltar = () => {
        window.removeEventListener("pointermove", mover);
        window.removeEventListener("pointerup", soltar);
        el.classList.remove("cm-movendo");
        if (!movendo) return;
        game.settings.set(MOD, "posHud", { left: el.style.left, top: el.style.top }).catch((err) => relatarErro(T("posição do HUD"), err, { avisar: false }));
      };
      window.addEventListener("pointermove", mover);
      window.addEventListener("pointerup", soltar);
    });

    // clique duplo: completo → mini (só data e hora) → oculto (bolinha) → completo
    el.addEventListener("dblclick", async (ev) => {
      if (ev.target.closest("[data-acao], .cm-ceu, .cm-arrasta, a, button, select, input")) return;
      ev.preventDefault();
      const prox = { completo: "mini", mini: "oculto", oculto: "completo" }[game.settings.get(MOD, "hudModo")] ?? "completo";
      await game.settings.set(MOD, "hudModo", prox);
      this.render();
    });

    // arrastar o sol/lua na faixa do céu muda a hora do dia (mestre)
    el.addEventListener("pointerdown", (ev) => {
      const ceu = ev.target.closest(".cm-ceu");
      if (!ceu || !game.user.isGM) return;
      ev.preventDefault();
      const r = ceu.getBoundingClientRect();
      const sd = segDia(), base = diaTotalDe(game.time.worldTime) * sd;
      const frac = (x) => Math.min(0.99999, Math.max(0, (x - r.left) / r.width));
      const mostrar = (e) => {
        const f = frac(e.clientX);
        ceu.style.setProperty("--agora", `${(f * 100).toFixed(2)}%`);
        const t = el.querySelector(".cm-hora-txt");
        if (t) t.textContent = textoRelogio(f * sd);
      };
      this.arrastando = true;
      ceu.classList.add("cm-movendo");
      mostrar(ev);
      const soltar = async (e) => {
        window.removeEventListener("pointermove", mostrar);
        window.removeEventListener("pointerup", soltar);
        this.arrastando = false;
        ceu.classList.remove("cm-movendo");
        const alvo = base + Math.round(frac(e.clientX) * sd);
        if (alvo !== game.time.worldTime) await game.time.set(alvo);
        else this.render();
      };
      window.addEventListener("pointermove", mostrar);
      window.addEventListener("pointerup", soltar);
    });

    // segundos andando entre um passo e outro do relógio em tempo real
    setInterval(() => this.tique(), 1000);

    const pos = game.settings.get(MOD, "posHud");
    if (pos?.left) { el.style.left = pos.left; el.style.top = pos.top; el.style.transform = "none"; }
  }

  /** Atualiza só a hora, o sol/lua e o período (sem refazer o HUD inteiro). */
  static atualizarHora() {
    if (!this.el || this.arrastando || !CFG) return;
    const modo = game.settings.get(MOD, "hudModo");
    if (modo === "oculto") return;
    if (modo === "mini") {
      const a = agora(), t = this.el.querySelector(".cm-hora-txt");
      if (t) t.textContent = textoRelogio(segundoDoDia(a.wt));
      return;
    }
    if (!this.el.querySelector(".cm-ceu")) return this.render();
    const a = agora();
    const ceu = this.el.querySelector(".cm-ceu");
    ceu.style.setProperty("--agora", `${((a.horaDec / CFG.horasDia) * 100).toFixed(2)}%`);
    const astro = ceu.querySelector(".cm-astro");
    if (astro) astro.className = `cm-astro ${luzDoSol(a.wt) > 0.4 ? "sol" : "lua"}`;
    const t = this.el.querySelector(".cm-hora-txt");
    if (t) t.textContent = textoRelogio(segundoDoDia(a.wt));
    else {
      const h = this.el.querySelector(".cm-hora");
      const p = periodoDe(a.horaDec, a.mes, a.dia);
      if (h) h.innerHTML = `<i class="fa-solid ${p.icone}"></i> ${p.nome}`;
    }
  }

  static tique() {
    if (!this.el || this.arrastando || !CFG) return;
    if (!game.settings.get(MOD, "relogioAtivo")) return;
    if (game.paused && game.settings.get(MOD, "pausaJogo")) return;
    if (game.combat?.started && game.settings.get(MOD, "pausaCombate")) return;
    const taxa = Math.max(0, num(game.settings.get(MOD, "relogioTaxa"), 1));
    const extra = Math.min((performance.now() - ULT_TEMPO) / 1000, 6) * taxa;
    const wt = game.time.worldTime + extra;
    if (diaTotalDe(wt) !== diaTotalDe(game.time.worldTime)) return;   // a virada do dia espera o próximo passo real
    const t = this.el.querySelector(".cm-hora-txt");
    if (t) t.textContent = textoRelogio(segundoDoDia(wt));
    this.el.querySelector(".cm-ceu")?.style.setProperty("--agora", `${((segundoDoDia(wt) / segDia()) * 100).toFixed(2)}%`);
  }

  static async acao(acao, d) {
    const sh = segHora(), sd = segDia();
    switch (acao) {
      case "abrir": return JanelaCalendario.abrir();
      case "compactar": await game.settings.set(MOD, "hudCompacto", !game.settings.get(MOD, "hudCompacto")); return this.render();
      case "avancar": return avancar(num(d.q) * ({ d: sd, h: sh, m: segMinuto() }[d.un] ?? 0));
      case "amanhecer": { const a = agora(); return avancarAte(solDe(a.mes, a.dia).nascer); }
      case "meiodia": return avancarAte(CFG.horasDia / 2);
      case "anoitecer": { const a = agora(); return avancarAte(solDe(a.mes, a.dia).por); }
      case "meianoite": return avancarAte(0);
      case "descanso": return avancar(8 * sh);
      case "hora": return game.user.isGM ? definirHoraDialogo() : null;
      case "relogio": await game.settings.set(MOD, "relogioAtivo", !game.settings.get(MOD, "relogioAtivo")); return;
      case "cena": {
        const s = canvas?.scene;
        if (!s) return ui.notifications.warn(T("Nenhuma cena aberta."));
        const ligado = !s.getFlag(MOD, "diaNoite");
        await s.setFlag(MOD, "diaNoite", ligado);
        ui.notifications.info(ligado ? `${T("\"{0}\" agora segue o dia e a noite do calendário.", [s.name])}` : `${T("\"{0}\" não segue mais o dia e a noite.", [s.name])}`);
        if (ligado) await aplicarLuz(estadoLuz(game.time.worldTime), 2000, [s]);
        return this.render();
      }
      case "editor": return abrirFerramenta("EditorCalendario");
      case "calCena": return escolherCalendarioDaCena();
      case "clima": return ferr("dialogoClima");
      case "viagem": return viagemAtual() ? abrirFerramenta("JanelaViagem") : ferr("dialogoViagem");
      case "contadores": return abrirFerramenta("JanelaContadores");
      case "historico": return abrirFerramenta("JanelaHistorico");
      case "desfazer": return desfazerUltimoPulo();
    }
  }

  static render() {
    if (!this.el || !CFG || this.arrastando) return;
    if (!game.settings.get(MOD, "mostrarHud")) { this.el.style.display = "none"; return; }
    this.el.style.display = "";
    const gm = game.user.isGM;
    const a = agora();
    const compacto = game.settings.get(MOD, "hudCompacto");
    const modo = game.settings.get(MOD, "hudModo");
    const mostrarHoraMini = gm || game.settings.get(MOD, "jogadoresVeemHora");
    if (modo === "oculto") {
      this.el.className = `cm-tema-${tema()} cm-oculto`;
      this.el.innerHTML = `<div class="cm-bolinha" data-tooltip="${T("{0} — clique duas vezes para mostrar; arraste para mover", [esc(textoData(a))])}"><i class="fa-solid fa-calendar-days"></i></div>`;
      return;
    }
    if (modo === "mini") {
      const p = periodoDe(a.horaDec, a.mes, a.dia);
      this.el.className = `cm-tema-${tema()} cm-mini`;
      this.el.innerHTML = `<div class="cm-linha" data-tooltip="${T("Clique duas vezes para ocultar; arraste para mover")}">
        <span class="cm-mini-data">${esc(textoData(a, { semana: false }))}</span>
        <span class="cm-hora">${mostrarHoraMini ? `<span class="cm-hora-txt">${textoRelogio(segundoDoDia(a.wt))}</span>` : `<i class="fa-solid ${p.icone}"></i> ${p.nome}`}</span>
      </div>`;
      return;
    }
    const est = estacaoDe(a.mes, a.dia);
    const { nascer, por } = solDe(a.mes, a.dia);
    const H = CFG.horasDia;
    const pct = (h) => ((h / H) * 100).toFixed(1);
    const mostrarHora = gm || game.settings.get(MOD, "jogadoresVeemHora");
    const periodo = periodoDe(a.horaDec, a.mes, a.dia);
    const luas = luasNoCeu(a.td).map((l) => { const f = faseDe(l, a.td); return `<span class="cm-lua-wrap" data-tooltip="${esc(l.nome)}: ${esc(f.nome)}">${luaSVG(f.p, l.cor, 16)}</span>`; }).join("");
    const relogioOn = game.settings.get(MOD, "relogioAtivo");
    const cenaOn = !!canvas?.scene?.getFlag(MOD, "diaNoite");
    const btn = (acao, icone, dica, extra = "", cls = "") => `<a class="cm-btn ${cls}" data-acao="${acao}" ${extra} data-tooltip="${esc(dica)}"><i class="fa-solid ${icone}"></i></a>`;

    this.el.className = `cm-tema-${tema()} ${compacto ? "cm-compacto" : ""}`;
    this.el.innerHTML = `
      <div class="cm-ceu ${gm ? "cm-ceu-gm" : ""}" style="--n:${pct(nascer)}%;--p:${pct(por)}%;--agora:${pct(a.horaDec)}%" ${gm ? `data-tooltip="${esc(T("Arraste o sol/lua para mudar a hora"))}"` : ""}>
        <span class="cm-astro ${luzDoSol(a.wt) > 0.4 ? "sol" : "lua"}"></span>
      </div>
      <div class="cm-linha">
        <a class="cm-arrasta" data-tooltip="${T("Arrastar")}"><i class="fa-solid fa-grip-vertical"></i></a>
        <div class="cm-data">
          <div class="cm-data-sem">${esc(CFG.semana[a.sem]?.nome ?? "")}${Object.keys(listaCalendarios().lista).length > 1 ? ` · <span class="cm-cal-nome">${esc(CFG.nome)}</span>` : ""}</div>
          <div class="cm-data-txt">${esc(textoData(a, { semana: false }))}</div>
        </div>
        <div class="cm-hora ${gm ? "cm-clicavel" : ""}" ${gm ? `data-acao="hora" data-tooltip="${esc(T("Definir a hora"))}"` : ""}>
          ${mostrarHora ? `<span class="cm-hora-txt">${textoRelogio(segundoDoDia(a.wt))}</span>` : `<i class="fa-solid ${periodo.icone}"></i> ${periodo.nome}`}
        </div>
        <div class="cm-extras">
          ${est ? `<span class="cm-estacao" data-tooltip="${esc(est.nome)}"><i class="fa-solid ${esc(est.icone)}"></i></span>` : ""}
          ${(() => {
            const zona = zonaDaCena(), c = climaDe(zona);
            if (!c) return gm ? `<a class="cm-clima" data-acao="clima" data-tooltip="${T("Clima (ainda não rolado hoje)")}"><i class="fa-solid fa-cloud-sun"></i></a>` : "";
            const an = anomaliaDe(zona);
            const dica = `${ZONAS[zona].nome}: ${CLIMAS[c.tipo]?.nome}, ${temperaturaTexto(c.temp)}${an ? ` — ${an.texto || ANOMALIAS[an.tipo].texto}` : ""}`;
            return `<span class="cm-clima ${an ? "cm-anomalia" : ""}" ${gm ? `data-acao="clima"` : ""} data-tooltip="${esc(dica)}"><i class="fa-solid ${CLIMAS[c.tipo]?.icone ?? "fa-cloud"}"></i> ${temperaturaTexto(c.temp)}</span>`;
          })()}
          ${luas}
        </div>
        ${(() => { const n = contadores().filter((c) => !c.feito && (gm || c.visivel)).length; return n && !gm ? `<a class="cm-btn cm-badge" data-acao="contadores" data-tooltip="${T("Contadores")}"><i class="fa-solid fa-hourglass-half"></i><b>${n}</b></a>` : ""; })()}
        ${!gm && game.settings.get(MOD, "historicoJogadores") ? btn("historico", "fa-scroll", T("Histórico da campanha")) : ""}
        ${btn("abrir", "fa-calendar-days", T("Abrir o calendário"))}
        ${gm ? btn("compactar", compacto ? "fa-chevron-down" : "fa-chevron-up", compacto ? T("Mostrar controles") : T("Esconder controles")) : ""}
      </div>
      ${gm && !compacto ? `
      <div class="cm-controles">
        <div class="cm-grupo">
          ${btn("avancar", "fa-backward-fast", T("Voltar 1 dia"), `data-un="d" data-q="-1"`)}
          ${btn("avancar", "fa-backward", T("Voltar 1 hora"), `data-un="h" data-q="-1"`)}
          ${btn("avancar", "fa-forward-step", T("Avançar 10 minutos"), `data-un="m" data-q="10"`)}
          ${btn("avancar", "fa-forward", T("Avançar 1 hora"), `data-un="h" data-q="1"`)}
          ${btn("avancar", "fa-forward-fast", T("Avançar 1 dia"), `data-un="d" data-q="1"`)}
          ${DESFAZER.pilha.length ? btn("desfazer", "fa-rotate-left", T("Desfazer o último pulo (volta para {quando})", { quando: textoData(infoDia(diaTotalDe(DESFAZER.pilha.at(-1).antes)), { semana: false }) + " " + textoRelogio(segundoDoDia(DESFAZER.pilha.at(-1).antes)) })) : ""}
        </div>
        <div class="cm-grupo">
          ${btn("amanhecer", "fa-cloud-sun", T("Até o próximo amanhecer"))}
          ${btn("meiodia", "fa-sun", T("Até o meio-dia"))}
          ${btn("anoitecer", "fa-cloud-moon", T("Até o anoitecer"))}
          ${btn("meianoite", "fa-moon", T("Até a meia-noite"))}
          ${btn("descanso", "fa-campground", T("Descanso longo (8 horas)"))}
        </div>
        <div class="cm-grupo">
          ${btn("relogio", relogioOn ? "fa-pause" : "fa-play", relogioOn ? T("Pausar o relógio em tempo real") : T("Ligar o relógio em tempo real"), "", relogioOn ? "ativo" : "")}
          ${Object.keys(listaCalendarios().lista).length > 1 ? btn("calCena", "fa-landmark", `${T("Calendário desta cena: {0}", [CFG.nome])}`) : ""}
          ${btn("cena", "fa-circle-half-stroke", cenaOn ? T("Esta cena segue o dia/noite (clique para desligar)") : T("Fazer esta cena seguir o dia/noite"), "", cenaOn ? "ativo" : "")}
          ${btn("editor", "fa-gear", T("Editar o calendário"))}
        </div>
        <div class="cm-grupo">
          ${btn("clima", "fa-cloud-sun-rain", T("Clima da região"))}
          ${btn("viagem", "fa-route", viagemAtual() ? T("Viagem em andamento") : T("Viajar"), "", viagemAtual() ? "ativo" : "")}
          ${(() => { const n = contadores().filter((c) => !c.feito).length; return `<a class="cm-btn cm-badge" data-acao="contadores" data-tooltip="${T("Contadores e prazos")}"><i class="fa-solid fa-hourglass-half"></i>${n ? `<b>${n}</b>` : ""}</a>`; })()}
          ${btn("historico", "fa-scroll", T("Histórico da campanha"))}
        </div>
      </div>` : ""}`;
  }
}



/* ---------------- escolher calendário ---------------- */

/** Barra para trocar o calendário mostrado (só aparece com mais de um calendário). */
function seletorCalendarios() {
  const { principal, lista } = listaCalendarios();
  const ids = Object.keys(lista);
  if (ids.length < 2) return "";
  let visto = "";
  try { visto = game.settings.get(MOD, "calendarioVisto"); } catch (err) { console.warn(`${MOD} | "ver como" (configuração ainda não registrada?)`, err); }
  const cena = canvas?.scene;
  const daCena = cena?.getFlag(MOD, "calendario");
  const nome = (id) => esc(normalizar(lista[id]).nome);
  const auto = daCena && lista[daCena] ? `${T("Automático (cena: {0})", [nome(daCena)])}` : `${T("Automático ({0})", [nome(principal)])}`;
  return `<div class="cm-cals">
    <i class="fa-solid fa-landmark"></i>
    <select class="cm-ver-como" data-tooltip="${T("Qual calendário ver. Automático segue a cena; sem cena, o principal do mundo.")}">
      <option value="" ${!visto ? "selected" : ""}>${auto}</option>
      ${ids.map((id) => `<option value="${id}" ${visto === id ? "selected" : ""}>${nome(id)}${id === principal ? " ★" : ""}</option>`).join("")}
    </select>
    ${game.user.isGM && cena ? `<button type="button" data-action="usarNaCena" data-tooltip="${T("Escolher o calendário desta cena (vale para todos)")}"><i class="fa-solid fa-map"></i> ${T("Calendário da cena")}</button>` : ""}
  </div>`;
}

async function escolherCalendarioDaCena() {
  const cena = canvas?.scene;
  if (!cena || !game.user.isGM) return;
  const { principal, lista } = listaCalendarios();
  const atual = cena.getFlag(MOD, "calendario") ?? "";
  const escolha = await Dialogo().wait({
    window: { title: `${T("Calendário de \"{0}\"", [cena.name])}`, icon: "fa-solid fa-landmark" },
    content: `<div class="cm-form"><label>${T("Calendário desta cena")}<select name="cal">
      <option value="" ${!atual ? "selected" : ""}>${T("Principal do mundo ({0})", [esc(normalizar(lista[principal]).nome)])}</option>
      ${Object.keys(lista).map((id) => `<option value="${id}" ${atual === id ? "selected" : ""}>${esc(normalizar(lista[id]).nome)}</option>`).join("")}
    </select></label><p class="cm-dica">${T("Quem estiver nesta cena (no modo Automático) vê o calendário, a data e os eventos dele.")}</p></div>`,
    buttons: [{ action: "ok", label: T("Salvar"), default: true, callback: (ev, btn) => btn.form.elements.cal.value }, { action: "cancelar", label: T("Cancelar") }],
    rejectClose: false
  });
  if (typeof escolha !== "string" || escolha === "cancelar") return;
  if (escolha) await cena.setFlag(MOD, "calendario", escolha);
  else await cena.unsetFlag(MOD, "calendario");
}

/* ---------------- janela do calendário ---------------- */

const { ApplicationV2 } = foundry.applications.api;

class JanelaCalendario extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "cm-calendario",
    classes: ["cm-janela"],
    tag: "div",
    window: { title: "Calendário", icon: "fa-solid fa-calendar-days", resizable: true },
    position: { width: 820, height: 600 },
    actions: {
      mes(ev, t) { this.mudarMes(num(t.dataset.q)); },
      ano(ev, t) { this.mudarMes(num(t.dataset.q) * CFG.meses.length); },
      hoje() { this.irParaHoje(true); },
      dia(ev, t) {
        this.sel = num(t.dataset.td);
        const i = infoDia(this.sel);
        this.ano = i.ano; this.mes = i.mes;
        this.render();
      },
      novaNota() { if (podeCriarNota()) criarNota(this.sel); },
      abrirNota(ev, t) { const j = game.journal.get(t.dataset.id); if (j) abrirNota(j); },
      editarNota(ev, t) { const j = game.journal.get(t.dataset.id); if (j?.isOwner) editarNota(j); },
      apagarNota(ev, t) { const j = game.journal.get(t.dataset.id); if (j?.isOwner) apagarNota(j); },
      acoesNota(ev, t) { const j = game.journal.get(t.dataset.id); if (j && game.user.isGM) ferr("dialogoAcoesNota", j); },
      tirarNota(ev, t) { const j = game.journal.get(t.dataset.id); if (j?.isOwner) j.unsetFlag(MOD, "nota"); },
      irDia() { irPara(this.sel); },
      async usarNaCena() { await escolherCalendarioDaCena(); },
      diaSagrado() { ferr("dialogoDiaSagrado"); },
      historico() { abrirFerramenta("JanelaHistorico"); },
      linhaDoTempo() { try { game.modules.get(JOURNAL).api.linhaDoTempo(this.sel); } catch (err) { relatarErro(T("Linha do tempo do Journal da Mesa"), err); } },
      contadores() { abrirFerramenta("JanelaContadores"); },
      editor() { abrirFerramenta("EditorCalendario"); }
    }
  };

  /** O título passa pela tradução na hora de abrir (as opções da classe são lidas antes de o Foundry carregar lang/). */
  get title() { return T("Calendário"); }

  static abrir(td = null) {
    let app = foundry.applications.instances.get("cm-calendario");
    if (app) app.irParaHoje(td == null);
    else app = new JanelaCalendario();
    if (td != null && Number.isFinite(td)) { const i = infoDia(td); app.sel = td; app.ano = i.ano; app.mes = i.mes; }
    // Só traz para a frente se a janela já estava na tela; uma janela nova ainda não tem elemento
    // (o render é assíncrono) e já abre na frente sozinha.
    const jaAberta = app.rendered;
    app.render({ force: true });
    if (jaAberta) app.bringToFront?.();
    return app;
  }

  constructor(opts = {}) {
    super(opts);
    const a = agora();
    this.ano = a.ano; this.mes = a.mes; this.sel = a.td;
  }

  irParaHoje(mover) {
    const a = agora();
    if (mover) { this.ano = a.ano; this.mes = a.mes; this.sel = a.td; }
    if (this.rendered) this.render();
  }

  mudarMes(q, renderizar = true) {
    const n = CFG.meses.length, passo = q === 0 ? 1 : Math.sign(q);
    let idx = this.ano * n + this.mes + q;
    for (let i = 0; i < 100000 && diasNoMes(Math.floor(idx / n), mod(idx, n)) === 0; i++) idx += passo;   // pula meses que não existem neste ano
    this.ano = Math.floor(idx / n);
    this.mes = mod(idx, n);
    this.sel = tdDe(this.ano, this.mes, Math.min(infoDia(this.sel).dia, diasNoMes(this.ano, this.mes) - 1));
    if (renderizar) this.render();
  }

  async _renderHTML() {
    if (this.mes >= CFG.meses.length) this.mes = 0;
    if (diasNoMes(this.ano, this.mes) === 0) this.mudarMes(0, false);
    const gm = game.user.isGM;
    const a = agora();
    const lista = notas();
    const total = diasNoMes(this.ano, this.mes);
    const td0 = tdDe(this.ano, this.mes, 0);
    const vazio = infoDia(td0).sem;
    const W = CFG.semana.length;

    // grade do mês
    let cel = "";
    for (let i = 0; i < vazio; i++) cel += `<div class="cm-cel cm-vazia"></div>`;
    for (let d = 0; d < total; d++) {
      const td = td0 + d;
      const doDia = notasDoDia(td, lista);
      const evLuas = eventosLuasDoDia(td);
      const marcas = luasNoCeu(td).map((l) => { const f = faseDe(l, td); return f.nova || f.cheia ? luaSVG(f.p, l.cor, 11) : ""; }).join("")
        + evLuas.map((e) => `<i class="fa-solid ${e.icone} cm-ev-lua cm-ev-${e.tipo}" style="color:${e.cor}" data-tooltip="${esc(textoEventoLua(e))}"></i>`).join("");
      const pontos = doDia.slice(0, 4).map(({ n }) => `<i class="fa-solid ${n.icone}" style="color:${n.cor}"></i>`).join("") + (doDia.length > 4 ? `<span>+${doDia.length - 4}</span>` : "");
      cel += `<div class="cm-cel ${td === a.td ? "cm-hoje" : ""} ${td === this.sel ? "cm-sel" : ""}" data-action="dia" data-td="${td}">
        <div class="cm-cel-topo"><span class="cm-num">${d + 1}</span><span class="cm-marcas">${marcas}</span></div>
        <div class="cm-pontos">${pontos}</div>
      </div>`;
    }
    const semanaHTML = CFG.semana.map((s) => `<div class="cm-dsem" title="${esc(s.nome)}">${esc(s.abrev)}</div>`).join("");

    // painel do dia selecionado
    const inf = infoDia(this.sel);
    const est = estacaoDe(inf.mes, inf.dia);
    const sol = solDe(inf.mes, inf.dia);
    const doSel = notasDoDia(this.sel, lista);
    const notaHTML = ({ j, n }) => `
      <li class="cm-nota" draggable="${j.isOwner}" data-id="${j.id}">
        <i class="fa-solid ${n.icone}" style="color:${n.cor}"></i>
        <a class="cm-nota-nome" data-action="abrirNota" data-id="${j.id}">${esc(j.name)}</a>
        <span class="cm-nota-info">${n.hora ? esc(n.hora) : ""}${n.repetir !== "nao" || n.duracao > 1 ? ` <i class="fa-solid fa-repeat" data-tooltip="${esc(descreverRepeticao(n))}"></i>` : ""}${n.duracao > 1 ? ` <span>${T("dia {0}/{1}", [this.sel - inicioQueCobre(n, this.sel) + 1, n.duracao])}</span>` : ""}${gm && j.ownership.default === 0 ? ` <i class="fa-solid fa-eye-slash" data-tooltip="${T("Só o mestre vê")}"></i>` : ""}</span>
        ${j.isOwner ? `<span class="cm-nota-acoes">
          <a data-action="editarNota" data-id="${j.id}" data-tooltip="${notasNoJournal() ? T("Editar no Journal da Mesa") : T("Editar")}"><i class="fa-solid fa-pen"></i></a>
          ${gm ? `<a data-action="acoesNota" data-id="${j.id}" class="${acoesDaNota(j) ? "cm-com-acao" : ""}" data-tooltip="${esc(T("Ações quando chegar a hora (macro, som, cena)"))}"><i class="fa-solid fa-bolt"></i></a>` : ""}
          <a data-action="tirarNota" data-id="${j.id}" data-tooltip="${T("Tirar do calendário (mantém o Diário)")}"><i class="fa-solid fa-calendar-xmark"></i></a>
          <a data-action="apagarNota" data-id="${j.id}" data-tooltip="${T("Apagar")}"><i class="fa-solid fa-trash"></i></a>
        </span>` : ""}
      </li>`;

    // próximos eventos
    const proximos = [];
    // todos os eventos dos próximos 30 dias (inclui os que já começaram e ainda estão acontecendo hoje)
    const JANELA = 30;
    for (let td = a.td; td <= a.td + JANELA; td++) {
      for (const x of lista) {
        if (comecaEm(x.n, td) || (td === a.td && inicioQueCobre(x.n, td) !== null)) proximos.push({ td, ...x });
      }
    }
    proximos.sort((p, q) => p.td - q.td || (p.n.hora || "99").localeCompare(q.n.hora || "99"));

    const luasHTML = CFG.luas.map((l) => {
      const v = visibilidadeLua(l, this.sel);
      if (!v.visivel) {
        if (!gm && !game.settings.get(MOD, "jogadoresVeemLuasOcultas")) return "";
        return `<div class="cm-lua-linha cm-lua-oculta"><i class="fa-regular fa-eye-slash"></i> <span><b>${esc(l.nome)}</b> ${T("· fora do céu, volta em {0}", [textoFalta(v)])}</span></div>`;
      }
      const f = faseDe(l, this.sel);
      return `<div class="cm-lua-linha">${luaSVG(f.p, l.cor, 18)} <span><b>${esc(l.nome)}</b> · ${esc(f.nome)}${v.sempre ? "" : ` <small>${T("(some em {0})", [textoFalta(v)])}</small>`}</span></div>`;
    }).join("");

    return `
      <div class="cm-raiz cm-tema-${tema()}">
        <section class="cm-mes">
          <header class="cm-cab">
            <a data-action="ano" data-q="-1" data-tooltip="${T("Ano anterior")}"><i class="fa-solid fa-angles-left"></i></a>
            <a data-action="mes" data-q="-1" data-tooltip="${T("Mês anterior")}"><i class="fa-solid fa-angle-left"></i></a>
            <h2>${esc(CFG.meses[this.mes].nome)} <small ${eraDoAno(this.ano) ? `data-tooltip="${esc(eraDoAno(this.ano).nome)}"` : ""}>${esc(textoAno(this.ano))}</small></h2>
            <a data-action="mes" data-q="1" data-tooltip="${T("Próximo mês")}"><i class="fa-solid fa-angle-right"></i></a>
            <a data-action="ano" data-q="1" data-tooltip="${T("Próximo ano")}"><i class="fa-solid fa-angles-right"></i></a>
            <button type="button" data-action="hoje"><i class="fa-solid fa-location-crosshairs"></i> ${T("Hoje")}</button>
            ${gm ? `<a data-action="editor" data-tooltip="${T("Editar o calendário")}"><i class="fa-solid fa-gear"></i></a>` : ""}
          </header>
          ${seletorCalendarios()}
          <div class="cm-grade" style="--w:${W}">${semanaHTML}${cel}</div>
          ${gm ? `<p class="cm-dica">${T("Arraste um Diário da barra lateral (ou uma nota da lista) para um dia para colocá-lo no calendário.")}</p>` : ""}
        </section>
        <aside class="cm-lado">
          <div class="cm-bloco">
            <h3>${esc(textoData(inf))}</h3>
            <div class="cm-info">
              ${est ? `<span><i class="fa-solid ${esc(est.icone)}"></i> ${esc(est.nome)}</span>` : ""}
              <span><i class="fa-solid fa-sun"></i> ${textoHoraDec(sol.nascer)}</span>
              <span><i class="fa-solid fa-moon"></i> ${textoHoraDec(sol.por)}</span>
            </div>
            ${luasHTML}
            ${(() => {
              const ev = eventosLuasDoDia(this.sel);
              const prox = proximosEventosLuas(a.td, 180, 4).filter((e) => e.td !== this.sel || !ev.length);
              if (!ev.length && !prox.length) return "";
              return `<div class="cm-ev-luas">
                ${ev.map((e) => `<div class="cm-ev-linha cm-ev-${e.tipo}"><i class="fa-solid ${e.icone}" style="color:${e.cor}"></i> <b>${esc(textoEventoLua(e))}</b></div>`).join("")}
                ${prox.length ? `<small class="cm-ev-titulo">${T("Próximos no céu")}</small>${prox.map((e) => `<a class="cm-ev-prox" data-action="dia" data-td="${e.td}"><i class="fa-solid ${e.icone}" style="color:${e.cor}"></i> ${esc(textoEventoLua(e))} <span>${e.td === a.td ? T("hoje") : T("em {n} dias", { n: e.td - a.td })}</span></a>`).join("")}` : ""}
              </div>`;
            })()}
          </div>
          <div class="cm-bloco">
            <div class="cm-bloco-cab"><h4>${T("Notas do dia")}</h4>
              ${podeCriarNota() ? `<button type="button" data-action="novaNota" data-tooltip="${notasNoJournal() ? T("Cria a nota e abre no Journal da Mesa para preencher") : T("Criar uma nota neste dia")}"><i class="fa-solid fa-plus"></i> ${T("Nova nota")}</button>` : ""}
            </div>
            ${doSel.length ? `<ul class="cm-notas">${doSel.map(notaHTML).join("")}</ul>` : `<p class="cm-vazio">${T("Nada marcado neste dia.")}</p>`}
            ${gm && this.sel !== a.td ? `<button type="button" class="cm-largo" data-action="irDia"><i class="fa-solid fa-calendar-check"></i> ${T("Tornar este o dia atual")}</button>` : ""}
          </div>
          ${lojasHTML()}
          ${gm || game.settings.get(MOD, "historicoJogadores") ? `<div class="cm-bloco cm-ferramentas">
            ${gm ? `<button type="button" data-action="diaSagrado"><i class="fa-solid fa-hands-praying"></i> ${T("Dia sagrado")}</button>
            <button type="button" data-action="contadores"><i class="fa-solid fa-hourglass-half"></i> ${T("Contadores")}</button>` : ""}
            <button type="button" data-action="historico"><i class="fa-solid fa-scroll"></i> ${T("Histórico")}</button>
            ${linhaDoJournal() ? `<button type="button" data-action="linhaDoTempo" data-tooltip="${T("Abre a Linha do tempo do Journal da Mesa neste dia")}"><i class="fa-solid fa-timeline"></i> ${T("Linha do tempo")}</button>` : ""}
          </div>` : linhaDoJournal() ? `<div class="cm-bloco cm-ferramentas"><button type="button" data-action="linhaDoTempo" data-tooltip="${T("Abre a Linha do tempo do Journal da Mesa neste dia")}"><i class="fa-solid fa-timeline"></i> ${T("Linha do tempo")}</button></div>` : ""}
          <div class="cm-bloco">
            <h4>${T("Próximos 30 dias")} <small>(${proximos.length})</small></h4>
            ${proximos.length ? `<ul class="cm-proximos">${proximos.map((p) => `
              <li><i class="fa-solid ${p.n.icone}" style="color:${p.n.cor}"></i>
                <a data-action="abrirNota" data-id="${p.j.id}">${esc(p.j.name)}</a>
                <a class="cm-quando" data-action="dia" data-td="${p.td}">${p.td === a.td ? T("hoje") : p.td === a.td + 1 ? T("amanhã") : `${T("em {0} dias · {1}", [p.td - a.td, esc(textoData(infoDia(p.td), { semana: false, ano: false }))])}`}${p.n.hora ? ` · ${esc(p.n.hora)}` : ""}</a></li>`).join("")}</ul>`
              : `<p class="cm-vazio">${T("Nenhum evento nos próximos 30 dias.")}</p>`}
          </div>
        </aside>
      </div>`;
  }

  _replaceHTML(html, content) {
    content.innerHTML = html;
    content.querySelector("select.cm-ver-como")?.addEventListener("change", async (ev) => {
      await game.settings.set(MOD, "calendarioVisto", ev.target.value);
      this.irParaHoje(true);
    });
    content.querySelectorAll(".cm-nota[draggable=true]").forEach((li) => li.addEventListener("dragstart", (ev) => {
      ev.dataTransfer.setData("text/plain", JSON.stringify({ type: "cm-nota", id: li.dataset.id }));
    }));
    content.querySelectorAll(".cm-cel[data-td]").forEach((c) => {
      c.addEventListener("dragover", (ev) => { ev.preventDefault(); c.classList.add("cm-alvo"); });
      c.addEventListener("dragleave", () => c.classList.remove("cm-alvo"));
      c.addEventListener("drop", (ev) => { ev.preventDefault(); c.classList.remove("cm-alvo"); this.soltar(ev, num(c.dataset.td)); });
    });
  }

  async soltar(ev, td) {
    let d;
    try { d = JSON.parse(ev.dataTransfer.getData("text/plain")); } catch { return; }
    let j = null;
    if (d?.type === "cm-nota") j = game.journal.get(d.id);
    else if (d?.type === "JournalEntry") j = await fromUuid(d.uuid);
    else if (d?.type === "JournalEntryPage") j = (await fromUuid(d.uuid))?.parent ?? null;
    if (!j || j.documentName !== "JournalEntry") return;
    if (!j.isOwner) return ui.notifications.warn(T("Você não pode mudar esse Diário."));
    if (j.getFlag(MOD, "nota")) await j.update({ [`flags.${MOD}.nota.td`]: td });
    else await j.update({ [`flags.${MOD}.nota`]: notaNova(td, { icone: "fa-scroll" }) });
    this.sel = td;
  }
}

/* =========================================================
 * EXTRAS v2: histórico, clima, contadores, viagem, lojas,
 * datas nos textos, pulo cinematográfico e dias sagrados
 * ========================================================= */

/** "2d 3h 10min" nas unidades do calendário. */
function duracaoTexto(seg) {
  seg = Math.max(0, Math.round(seg));
  const d = Math.floor(seg / segDia()), h = Math.floor((seg % segDia()) / segHora()), m = Math.floor((seg % segHora()) / segMinuto());
  const p = [];
  if (d) p.push(`${d}d`);
  if (h) p.push(`${h}h`);
  if (m || !p.length) p.push(`${m}min`);
  return p.join(" ");
}

const opcoes = (obj, sel, rot = (v) => v) => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${esc(rot(v))}</option>`).join("");

/* ---------------- histórico da campanha ---------------- */

function historico() {
  const h = game.settings.get(MOD, "historico");
  return Array.isArray(h?.itens) ? h.itens : [];
}

/** Registra algo no histórico (só o mestre principal grava). */
const registrar = (texto, { icone = "fa-circle", wt = game.time.worldTime } = {}) => registrarVarios([{ texto, icone, wt }]);

async function registrarVarios(lista) {
  if (!souGMPrincipal() || !lista.length) return;
  // monta as entradas agora (com o calendário e a hora de agora) e grava na vez dela na fila
  const novos = lista.map(({ texto, icone = "fa-circle", wt = game.time.worldTime }) =>
    ({ id: foundry.utils.randomID(), wt, td: diaTotalDe(wt), cal: CAL_ID, icone, texto: String(texto) }));
  return alterarHistorico((itens) => { itens.push(...novos); });
}

/** Lê o histórico, deixa fn mudar a lista e grava — sempre um de cada vez (fila "historico"). */
function alterarHistorico(fn) {
  return naFila("historico", async () => {
    const itens = foundry.utils.deepClone(historico());
    const r = await fn(itens);
    const final = Array.isArray(r) ? r : itens;
    // a configuração vai para todos ao entrar no mundo: guarda só os recentes e manda os antigos para um Diário
    if (final.length > HIST_MAX + 100) await arquivarHistorico(final.splice(0, final.length - HIST_MAX));
    await game.settings.set(MOD, "historico", { itens: final });
  });
}

const HIST_MAX = 400;

/** HTML do histórico agrupado por dia. */
function historicoHTML(itens) {
  const porDia = new Map();
  for (const i of [...itens].sort((a, b) => a.wt - b.wt)) {
    if (!porDia.has(i.td)) porDia.set(i.td, []);
    porDia.get(i.td).push(i);
  }
  return [...porDia.entries()].map(([td, l]) => `<h3>${esc(textoData(infoDia(td)))}</h3><ul>${l.map((i) => `<li>${esc(i.texto)}</li>`).join("")}</ul>`).join("");
}

/** Diário "Histórico da campanha" (cria se não existir). */
async function diarioHistorico() {
  let e = game.journal.find((j) => j.getFlag(MOD, "historico"));
  if (!e) {
    const pasta = await pastaCalendario();
    e = await JournalEntry.create({ name: T("Histórico da campanha"), folder: pasta?.id ?? null, flags: { [MOD]: { historico: true } }, pages: [] });
  }
  return e;
}

/** Acrescenta registros antigos na página "Arquivo" do Diário do histórico. */
async function arquivarHistorico(antigos) {
  if (!antigos.length) return;
  try {
    const e = await diarioHistorico();
    const pag = e.pages.find((p) => p.getFlag(MOD, "arquivo"));
    const html = historicoHTML(antigos);
    if (pag) await pag.update({ "text.content": (pag.text?.content ?? "") + html });
    else await e.createEmbeddedDocuments("JournalEntryPage", [{ name: T("Arquivo"), type: "text", sort: 0, text: { content: html }, flags: { [MOD]: { arquivo: true } } }]);
  } catch (err) { console.warn(`${MOD} | não consegui arquivar o histórico`, err); }
}

/* ---------------- clima por região ---------------- */

/* Tipos de tempo. efeito = efeito de clima mostrado na cena (os "cm-*" são variações registradas por este
 * módulo a partir dos efeitos nativos do Foundry; reserva = efeito nativo usado se a variação não existir).
 * temp = quanto o tipo muda a temperatura do dia (°C). grupo = onde aparece na janela de escolha. */
const CLIMAS = {
  limpo:        { nome: "Céu limpo",            icone: "fa-sun",                  efeito: "",                 temp: 1,  grupo: "ceu",   desc: "Céu aberto e sol firme." },
  poucasNuvens: { nome: "Poucas nuvens",        icone: "fa-cloud-sun",            efeito: "",                 temp: 0,  grupo: "ceu",   desc: "Algumas nuvens passam devagar." },
  nublado:      { nome: "Nublado",              icone: "fa-cloud",                efeito: "",                 temp: -1, grupo: "ceu",   desc: "Nuvens cobrem boa parte do céu." },
  encoberto:    { nome: "Céu encoberto",        icone: "fa-cloud",                efeito: "cm-encoberto",     reserva: "fog", temp: -2, grupo: "ceu", desc: "Um teto cinzento e pesado, sem sol." },
  neblina:      { nome: "Neblina",              icone: "fa-smog",                 efeito: "fog",              temp: -1, grupo: "nevoa", desc: "A neblina esconde o que está a poucos metros." },
  neblinaDensa: { nome: "Nevoeiro denso",       icone: "fa-smog",                 efeito: "cm-neblinaDensa",  reserva: "fog", temp: -2, grupo: "nevoa", desc: "Mal se vê a própria mão; os sons ficam abafados." },
  garoa:        { nome: "Garoa",                icone: "fa-cloud-rain",           efeito: "cm-garoa",         reserva: "rain", temp: -1, grupo: "chuva", desc: "Uma chuva fina e constante." },
  chuva:        { nome: "Chuva",                icone: "fa-cloud-rain",           efeito: "rain",             temp: -2, grupo: "chuva", desc: "Chuva firme; o chão vira lama." },
  aguaceiro:    { nome: "Aguaceiro",            icone: "fa-cloud-showers-heavy",  efeito: "cm-aguaceiro",     reserva: "rainStorm", temp: -3, grupo: "chuva", desc: "Chuva forte, quase uma parede de água." },
  chuvaNeblina: { nome: "Chuva com neblina",    icone: "fa-cloud-showers-water",  efeito: "cm-chuvaNeblina",  reserva: "rain", temp: -2, grupo: "chuva", desc: "Chuva miúda e névoa baixa entre as árvores." },
  tempestade:   { nome: "Tempestade",           icone: "fa-cloud-bolt",           efeito: "rainStorm",        temp: -3, grupo: "chuva", desc: "Raios, trovões e rajadas de chuva." },
  granizo:      { nome: "Granizo",              icone: "fa-cloud-meatball",       efeito: "cm-granizo",       reserva: "rainStorm", temp: -5, grupo: "chuva", desc: "Pedras de gelo batem com força; melhor procurar abrigo." },
  neveLeve:     { nome: "Neve fraca",           icone: "fa-snowflake",            efeito: "cm-neveLeve",      reserva: "snow", temp: -3, grupo: "frio", desc: "Flocos esparsos caem sem pressa." },
  neve:         { nome: "Neve",                 icone: "fa-snowflake",            efeito: "snow",             temp: -4, grupo: "frio", desc: "Neve contínua cobre as trilhas." },
  nevasca:      { nome: "Nevasca",              icone: "fa-icicles",              efeito: "blizzard",         temp: -7, grupo: "frio", desc: "Vento e neve cegam; viajar é perigoso." },
  frioIntenso:  { nome: "Frio intenso",         icone: "fa-temperature-low",      efeito: "",                 temp: -9, grupo: "frio", desc: "Céu limpo e um frio que corta a pele." },
  vento:        { nome: "Ventania",             icone: "fa-wind",                 efeito: "leaves",           temp: -2, grupo: "vento", desc: "Rajadas fortes levantam folhas e poeira." },
  areia:        { nome: "Tempestade de areia",  icone: "fa-hurricane",            efeito: "cm-areia",         reserva: "fog", temp: 2, grupo: "vento", desc: "Areia no ar arranha os olhos e apaga o horizonte." },
  calor:        { nome: "Calor extremo",        icone: "fa-temperature-high",     efeito: "",                 temp: 7,  grupo: "vento", desc: "O ar tremula de calor; a água acaba rápido." },
  cinzas:       { nome: "Chuva de cinzas",      icone: "fa-volcano",              efeito: "cm-cinzas",        reserva: "snow", temp: 3, grupo: "vento", desc: "Cinzas mornas caem do céu e cheiram a enxofre." },
  raiosSecos:   { nome: "Relâmpagos secos",     icone: "fa-bolt",                 efeito: "cm-relampago",     temp: 0,  grupo: "vento", desc: "Clarões no céu sem uma gota de chuva; o trovão vem atrasado." },
  aurora:       { nome: "Aurora",               icone: "fa-wand-magic-sparkles",  efeito: "cm-aurora",        temp: -3, grupo: "ceu",   desc: "Faixas de luz verde e violeta ondulam no céu da noite." },
  eclipse:      { nome: "Eclipse",              icone: "fa-circle-half-stroke",   efeito: "cm-eclipse",       temp: -4, grupo: "ceu",   desc: "A luz some aos poucos; os animais se calam e esfria de repente." }
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
const GRUPOS_CLIMA = { ceu: "Céu", nevoa: "Névoa", chuva: "Chuva", frio: "Neve e frio", vento: "Vento e extremos" };

/** Efeito que vale de fato nesta sessão: a variação do módulo, a reserva nativa ou nenhum. */
function efeitoDoClima(tipo) {
  const c = CLIMAS[tipo];
  if (!c?.efeito) return "";
  if (CONFIG.weatherEffects?.[c.efeito]) return c.efeito;
  return c.reserva && CONFIG.weatherEffects?.[c.reserva] ? c.reserva : "";
}

/* Variações dos efeitos nativos: copiam um efeito do Foundry e mudam só números que ele já tem
 * (opacidade, intensidade, velocidade...). Se o Foundry mudar esses efeitos, a variação só fica parecida
 * com o original — nunca quebra. Registradas em todos os clientes (cada um desenha a cena). */
function registrarEfeitosDeClima() {
  const W = CONFIG.weatherEffects;
  if (!W) return;
  const copia = (k) => (W[k] ? foundry.utils.deepClone(W[k]) : null);
  const ajustar = (ef, ajustes) => {
    if (!ef?.config) return;
    for (const [k, v] of Object.entries(ajustes)) {
      if (!(k in ef.config)) continue;
      if (Array.isArray(v) && Array.isArray(ef.config[k])) ef.config[k] = v;
      else if (typeof v === "number" && typeof ef.config[k] === "number") ef.config[k] *= v;
    }
  };
  const variante = (id, rotulo, de, ajustes = {}, junto = []) => {
    try {
      const b = copia(de);
      if (!b || !Array.isArray(b.effects)) return;
      b.effects.forEach((ef) => { ajustar(ef, ajustes); ef.id = `${id}-${ef.id}`; });
      for (const [outro, aj] of junto) {
        for (const ef of copia(outro)?.effects ?? []) { ajustar(ef, aj); ef.id = `${id}-${outro}-${ef.id}`; b.effects.push(ef); }
      }
      b.id = id; b.label = rotulo;
      W[id] = b;
    } catch (err) { console.warn(`${MOD} | efeito de clima ${id}`, err); }
  };
  variante("cm-encoberto", "Céu encoberto (Calendário)", "fog", { intensity: 0.35, speed: 0.6 });
  variante("cm-neblinaDensa", "Nevoeiro denso (Calendário)", "fog", { intensity: 1.9, slope: 1.3 });
  variante("cm-garoa", "Garoa (Calendário)", "rain", { opacity: 0.55, intensity: 0.4, strength: 0.6, speed: 0.75 });
  variante("cm-aguaceiro", "Aguaceiro (Calendário)", "rain", { opacity: 1.5, intensity: 1.8, strength: 1.4, speed: 1.3 });
  variante("cm-chuvaNeblina", "Chuva com neblina (Calendário)", "rain", { opacity: 0.8, intensity: 0.7 }, [["fog", { intensity: 0.7 }]]);
  variante("cm-granizo", "Granizo (Calendário)", "rainStorm", { speed: 1.5, strength: 1.3, tint: [0.95, 0.97, 1] });
  variante("cm-neveLeve", "Neve fraca (Calendário)", "snow", { speed: 0.6 });
  variante("cm-areia", "Tempestade de areia (Calendário)", "fog", { intensity: 1.5, speed: 2, tint: [0.85, 0.68, 0.42] }, [["leaves", {}]]);
  variante("cm-cinzas", "Chuva de cinzas (Calendário)", "snow", { speed: 0.45, tint: [0.38, 0.35, 0.33] });
  // efeitos de tela desenhados por este módulo (ver EfeitoTela abaixo)
  let Classe = null;
  try { Classe = classeEfeitoTela(); } catch (err) { console.warn(`${MOD} | efeitos de tela indisponíveis`, err); }
  if (Classe) try {
    const tela = (id, rotulo, modo, config = {}) => { W[id] = { id, label: rotulo, effects: [{ id: `${id}-tela`, effectClass: Classe, config: { modo, ...config } }] }; };
    tela("cm-aurora", "Aurora (Calendário)", "aurora", { tint: [0.35, 1, 0.6], tint2: [0.75, 0.4, 1], intensity: 1, speed: 1, scale: 1 });
    tela("cm-calor", "Calor tremulando (Calendário)", "calor", { tint: [1, 0.72, 0.4], intensity: 1, speed: 1, scale: 1 });
    tela("cm-relampago", "Relâmpagos (Calendário)", "relampago", { tint: [0.85, 0.9, 1], intensity: 1, speed: 1, scale: 1 });
    tela("cm-eclipse", "Céu de eclipse (Calendário)", "eclipse", { tint: [0.9, 0.35, 0.2], intensity: 1, speed: 1, scale: 1 });
    // tempestade = a nativa + relâmpagos
    try {
      if (W.rainStorm) {
        const b = copia("rainStorm");
        b.effects.forEach((ef) => { ef.id = `cm-tempestade-${ef.id}`; });
        b.effects.push({ id: "cm-tempestade-raios", effectClass: Classe, config: { modo: "relampago", tint: [0.85, 0.9, 1], intensity: 0.8, speed: 1, scale: 1 } });
        b.id = "cm-tempestade"; b.label = "Tempestade com relâmpagos (Calendário)";
        W["cm-tempestade"] = b;
      }
    } catch (err) { console.warn(`${MOD} | efeito cm-tempestade`, err); }
  } catch (err) { console.warn(`${MOD} | efeitos de tela`, err); }
}

/* ---------------- efeitos de tela próprios ----------------
 * Um efeito de clima do Foundry é um objeto { effects: [{ effectClass, config }] }: a camada de clima cria
 * new effectClass(config), põe na tela e chama play()/stop()/destroy(). Esta classe desenha uma malha do
 * tamanho da cena com um shader (GLSL) escrito aqui; o modo escolhe o desenho. Não depende de nenhuma
 * classe interna de shader do Foundry, só do PIXI. */
const VERT_TELA = `
attribute vec2 aVertexPosition;
attribute vec2 aUvs;
uniform mat3 projectionMatrix;
uniform mat3 translationMatrix;
varying vec2 vUvs;
varying vec2 vPos;
void main() {
  vUvs = aUvs;
  vPos = aVertexPosition;
  gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
}`;
const FRAG_COMUM = `
precision mediump float;
varying vec2 vUvs;
varying vec2 vPos;
uniform float time;
uniform float intensity;
uniform float scale;
uniform float grade;
uniform float alpha;
uniform vec3 tint;
uniform vec3 tint2;
uniform vec2 dims;
float hash(float n) { return fract(sin(n) * 43758.5453123); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float ruido(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), u.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * ruido(p); p = p * 2.03 + vec2(17.0, 9.0); a *= 0.5; }
  return v;
}`;
const FRAG_TELA = {
  // faixas de luz verde/violeta que ondulam devagar
  aurora: `${FRAG_COMUM}
void main() {
  vec2 p = vPos / (max(grade, 1.0) * 10.0 * scale);
  float t = time * 0.06;
  float curva = fbm(vec2(p.x * 0.35 + t, t * 0.4)) * 2.2;
  float faixa = abs(fract(p.y * 0.35 + curva) - 0.5) * 2.0;
  float cortina = smoothstep(0.75, 0.15, faixa);
  float fios = 0.55 + 0.45 * sin(p.x * 26.0 + fbm(p * 3.0 + vec2(t * 3.0, 0.0)) * 9.0);
  float brilho = cortina * fios * (0.6 + 0.4 * fbm(p * 1.3 - vec2(0.0, t * 2.0)));
  vec3 cor = mix(tint, tint2, smoothstep(0.3, 0.8, fbm(p * 0.5 + vec2(t, 2.0))));
  float a = clamp(brilho * 0.42 * intensity, 0.0, 1.0) * alpha;
  gl_FragColor = vec4(cor * a, a);
}`,
  // ar quente tremulando: linhas de luz morna que sobem ondulando
  calor: `${FRAG_COMUM}
void main() {
  vec2 p = vPos / (max(grade, 1.0) * 4.0 * scale);
  float t = time * 0.8;
  float deriva = fbm(p * 0.9 + vec2(0.0, -t * 0.35)) * 2.6;
  float onda = 0.5 + 0.5 * sin(p.y * 3.2 + deriva + t * 1.6);
  float quebra = smoothstep(0.35, 0.85, fbm(p * 1.8 + vec2(t * 0.25, -t * 0.9)));
  float faixas = smoothstep(0.45, 1.0, onda) * quebra;
  float bafo = 0.05 + 0.05 * fbm(p * 0.3 + vec2(0.0, -t * 0.12));
  float a = clamp((faixas * 0.13 + bafo) * intensity, 0.0, 1.0) * alpha;
  gl_FragColor = vec4(tint * a, a);
}`,
  // clarões de relâmpago em momentos sorteados, mais fortes perto de um ponto do mapa
  relampago: `${FRAG_COMUM}
void main() {
  float t = time * 0.55;
  float n = floor(t);
  float lt = fract(t);
  float vem = step(hash(n * 7.13), 0.38 * clamp(intensity, 0.2, 2.0));
  float flash = exp(-lt * 22.0) + 0.7 * step(0.13, lt) * exp(-(lt - 0.13) * 28.0) + 0.35 * step(0.27, lt) * exp(-(lt - 0.27) * 30.0);
  vec2 centro = vec2(hash(n * 3.7), hash(n * 9.1));
  float perto = 1.0 - smoothstep(0.0, 1.1, distance(vUvs, centro));
  float luz = vem * flash * (0.45 + 0.55 * perto);
  float a = clamp(luz * 0.8 * intensity, 0.0, 1.0) * alpha;
  gl_FragColor = vec4(tint * a, a);
}`,
  // a cena escurece com bordas avermelhadas que pulsam devagar
  eclipse: `${FRAG_COMUM}
void main() {
  float d = length((vUvs - 0.5) * vec2(dims.x / max(dims.y, 1.0), 1.0));
  float borda = smoothstep(0.15, 0.95, d);
  float pulso = 0.5 + 0.5 * sin(time * 0.35);
  vec3 cor = mix(vec3(0.03, 0.02, 0.06), tint * 0.35, borda * (0.35 + 0.25 * pulso) + 0.08 * fbm(vPos / max(grade * 6.0, 1.0) + time * 0.02));
  float a = clamp((0.42 + 0.22 * borda) * intensity, 0.0, 0.92) * alpha;
  gl_FragColor = vec4(cor * a, a);
}`
};
const MISTURA_TELA = { aurora: "ADD", calor: "ADD", relampago: "ADD", eclipse: "NORMAL" };
let CLASSE_TELA = null;
function classeEfeitoTela() {
  if (CLASSE_TELA) return CLASSE_TELA;
  const P = globalThis.PIXI;
  if (!P?.Container || !P?.Mesh || !P?.Geometry || !P?.Shader) return null;
  const Mix = foundry.canvas.containers.FullCanvasObjectMixin;
  CLASSE_TELA = class EfeitoTela extends Mix(P.Container) {
    constructor(config = {}) {
      super();
      this.config = config ?? {};
      this.eventMode = "none";
      try { this.#montar(this.config); } catch (err) {
        // se o shader não puder ser criado nesta máquina, o efeito fica vazio em vez de quebrar a camada de clima
        avisoUmaVezCal("efeito-tela", `${T("Calendário: o efeito de tela \"{0}\" não pôde ser criado neste computador ({1}).", [this.config.modo, err?.message ?? err])}`);
        this.malha = null;
      }
      this.play();
    }
    #montar(config) {
      const modo = FRAG_TELA[config.modo] ? config.modo : "aurora";
      const r = canvas?.dimensions?.rect ?? { x: 0, y: 0, width: 4000, height: 3000 };
      const { x, y, width: w, height: h } = r;
      const geo = new P.Geometry()
        .addAttribute("aVertexPosition", [x, y, x + w, y, x + w, y + h, x, y + h], 2)
        .addAttribute("aUvs", [0, 0, 1, 0, 1, 1, 0, 1], 2)
        .addIndex([0, 1, 2, 0, 2, 3]);
      this.uniforms = {
        time: Math.random() * 100, intensity: num(config.intensity, 1), scale: Math.max(0.05, num(config.scale, 1)),
        grade: canvas?.dimensions?.size ?? 100, alpha: 1, dims: [w, h],
        tint: config.tint ?? [1, 1, 1], tint2: config.tint2 ?? config.tint ?? [1, 1, 1]
      };
      this.velocidade = Math.max(0, num(config.speed, 1));
      this.malha = new P.Mesh(geo, P.Shader.from(VERT_TELA, FRAG_TELA[modo], this.uniforms));
      this.malha.blendMode = P.BLEND_MODES?.[MISTURA_TELA[modo]] ?? 0;
      this.addChild(this.malha);
    }
    get shader() { return this.malha?.shader ?? null; }
    _tique = () => { if (this.uniforms) this.uniforms.time += ((P.Ticker?.shared?.deltaMS ?? 16) / 1000) * (this.velocidade ?? 1); };
    play() { if (!this._tocando) { P.Ticker?.shared?.add(this._tique); this._tocando = true; } this.visible = true; }
    stop() { if (this._tocando) { P.Ticker?.shared?.remove(this._tique); this._tocando = false; } }
    destroy(...args) { this.stop(); return super.destroy(...args); }
  };
  return CLASSE_TELA;
}

/* ---------------- efeitos criados pelo mestre ("Novo efeito" na aba Climas) ----------------
 * Ficam em climaTipos.efeitos = { id: { nome, base, cor, forca, velocidade, tamanho, direcao, base2, cor2, forca2 } }
 * e viram CONFIG.weatherEffects["cmx-<id>"]: uma cópia da base com os números mudados (como os cm-*). */
const PREFIXO_EFEITO = "cmx-";
const corHex = (v) => (/^#[0-9a-f]{6}$/i.test(String(v ?? "")) ? String(v).toLowerCase() : "");
const corRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const faixaNum = (v, min, max, pad) => Math.max(min, Math.min(max, num(v, pad)));

function normalizarEfeito(e, id) {
  return {
    nome: String(e?.nome || id).slice(0, 60),
    base: /^[\w.-]{1,60}$/.test(String(e?.base ?? "")) && !String(e.base).startsWith(PREFIXO_EFEITO) ? e.base : "rain",
    cor: corHex(e?.cor),
    forca: faixaNum(e?.forca, 0.05, 4, 1),
    velocidade: faixaNum(e?.velocidade, 0, 5, 1),
    tamanho: faixaNum(e?.tamanho, 0.2, 5, 1),
    direcao: e?.direcao === "" || e?.direcao == null ? null : faixaNum(e.direcao, 0, 360, 0),
    base2: /^[\w.-]{1,60}$/.test(String(e?.base2 ?? "")) && !String(e.base2).startsWith(PREFIXO_EFEITO) ? e.base2 : "",
    cor2: corHex(e?.cor2),
    forca2: faixaNum(e?.forca2, 0.05, 4, 1)
  };
}

/** O que cada efeito-base aceita mudar (lendo a configuração dele): usado pelo editor e pelo registro. */
function ajustesDoEfeito(base) {
  const ef = CONFIG.weatherEffects?.[base];
  const r = { cor: false, forca: false, velocidade: false, tamanho: false, direcao: false };
  for (const e of ef?.effects ?? []) {
    const c = e.config ?? {};
    const fx = String(base).startsWith("fxmaster.");
    if ("tint" in c || fx) r.cor = true;
    if (["intensity", "opacity", "strength", "alpha", "density"].some((k) => k in c) || fx) r.forca = true;
    if ("speed" in c || fx) r.velocidade = true;
    if ("scale" in c || fx) r.tamanho = true;
    if ("rotation" in c || "direction" in c || fx) r.direcao = true;
  }
  return r;
}

function montarEfeito(id, def) {
  const W = CONFIG.weatherEffects;
  const copiar = (base, cor, forca, ehSegundo) => {
    const b = W[base] ? foundry.utils.deepClone(W[base]) : null;
    if (!b?.effects) return [];
    const fx = String(base).startsWith("fxmaster.");
    return b.effects.map((ef) => {
      ef.id = `${PREFIXO_EFEITO}${id}-${ehSegundo ? "b-" : ""}${ef.id}`;
      ef.config = { ...(ef.config ?? {}) };
      const c = ef.config;
      if (fx) {
        // opções das partículas do FXMaster (valores absolutos; os padrões vêm do próprio efeito)
        const pad = ef.effectClass?.default ?? {};
        const valor = (k, p) => { const v = pad[k]?.value ?? pad[k]; return typeof v === "number" ? v : p; };
        c.density = valor("density", 0.5) * forca;
        c.speed = valor("speed", 1) * (ehSegundo ? 1 : def.velocidade);
        c.scale = valor("scale", 1) * (ehSegundo ? 1 : def.tamanho);
        if (!ehSegundo && def.direcao != null) c.direction = def.direcao;
        if (cor) c.tint = { value: cor, apply: true };
        return ef;
      }
      if (cor && "tint" in c) c.tint = corRgb(cor);
      for (const k of ["intensity", "opacity", "strength", "alpha", "density"]) if (typeof c[k] === "number") c[k] *= forca;
      if (!ehSegundo) {
        if (typeof c.speed === "number") c.speed *= def.velocidade;
        if (typeof c.scale === "number") c.scale *= def.tamanho;
        if (def.direcao != null) {
          if ("rotation" in c) c.rotation = (def.direcao * Math.PI) / 180;
          if ("direction" in c) c.direction = (def.direcao * Math.PI) / 180;
        }
      }
      return ef;
    });
  };
  const effects = [...copiar(def.base, def.cor, def.forca, false), ...(def.base2 ? copiar(def.base2, def.cor2, def.forca2, true) : [])];
  if (!effects.length) return null;
  const base = W[def.base] ?? {};
  return { ...foundry.utils.deepClone({ ...base, effects: [] }), id: `${PREFIXO_EFEITO}${id}`, label: def.nome, effects };
}

/** Registra (de novo) os efeitos do mestre. Em todos os clientes: cada um desenha a própria tela. */
function registrarEfeitosPersonalizados() {
  const W = CONFIG.weatherEffects;
  if (!W) return;
  for (const k of Object.keys(W)) if (k.startsWith(PREFIXO_EFEITO)) delete W[k];
  let lista = {};
  try { lista = game.settings.get(MOD, "climaTipos")?.efeitos ?? {}; } catch { lista = {}; }
  for (const [id, e] of Object.entries(lista)) {
    try { const ef = montarEfeito(id, normalizarEfeito(e, id)); if (ef) W[`${PREFIXO_EFEITO}${id}`] = ef; } catch (err) { console.warn(`${MOD} | efeito ${id}`, err); }
  }
}

/* Prévia de um efeito em edição: só na tela deste usuário, só na cena em que começou, sem gravar nada
 * no documento da cena. Se a cena mudar, a prévia acaba sozinha (a cena nova desenha o próprio clima). */
const PREVIA = { cenaId: null, ef: null };
const previaAtiva = () => !!PREVIA.cenaId && PREVIA.cenaId === canvas?.scene?.id;
function iniciarPreviaEfeito(def) {
  if (!canvas?.ready || !canvas.scene || typeof canvas.weather?.initializeEffects !== "function") return false;
  const ef = montarEfeito("previa", normalizarEfeito(def, "previa"));
  if (!ef) return false;
  PREVIA.cenaId = canvas.scene.id;
  PREVIA.ef = ef;
  try { canvas.weather.initializeEffects(ef); } catch (err) { relatarErro(T("prévia do efeito"), err); PREVIA.cenaId = null; PREVIA.ef = null; return false; }
  return true;
}
function pararPreviaEfeito() {
  if (!PREVIA.cenaId) return false;
  const mesma = PREVIA.cenaId === canvas?.scene?.id;
  PREVIA.cenaId = null; PREVIA.ef = null;
  if (mesma) redesenharClima();          // volta ao clima salvo da própria cena aberta
  return true;
}

/** Redesenha o clima da cena aberta com a configuração do efeito que ela usa (ou a prévia em andamento).
 *  initializeEffects(config): sem config, o Foundry LIMPA a camada de clima — por isso a config é sempre passada.
 *  so(weather): redesenha só se a cena aberta usa um efeito que passa no teste (ex.: só efeitos do mestre). */
function redesenharClima({ so = null } = {}) {
  if (!canvas?.ready || !canvas.scene || typeof canvas.weather?.initializeEffects !== "function") return false;
  if (previaAtiva()) { try { canvas.weather.initializeEffects(PREVIA.ef); } catch (err) { console.warn(`${MOD} | prévia`, err); } return true; }
  const atual = canvas.scene.weather ?? "";
  if (so && !so(atual)) return false;
  try { canvas.weather.initializeEffects(atual ? CONFIG.weatherEffects?.[atual] : undefined); } catch (err) { console.warn(`${MOD} | redesenhar clima`, err); }
  return true;
}

/* ---------------- FXMaster ----------------
 * Com o FXMaster ativo, cada clima pode usar um preset dele (FXMASTER.api.presets) ou uma partícula dele
 * (que o próprio FXMaster coloca na lista de efeitos de clima como "fxmaster.<tipo>"). O preset fica
 * marcado na cena (flag fxPreset) para ser desligado quando o clima mudar. */
const PRESETS_FX_CONHECIDOS = ["acid-rain", "aether-haze", "arcane-winds", "ashfall", "autumn-leaves", "black-sun", "blizzard", "blood-rain", "cloudy", "divine-light", "drizzle", "dust-devil", "fog", "gravewind", "hail", "heat-wave", "hurricane", "ice-storm", "ley-surge", "luminous-sky", "meteor-shower", "mist", "monsoon", "nullfront", "overcast", "partly-cloudy", "permafrost-surge", "plague-miasma", "rain", "rolling-fog", "sakura-bloom", "sandstorm", "sleet", "snow", "spore-cloud", "sunshower", "thunderstorm", "tornado", "twilight-sun", "veilfall", "wildfire-smoke", "windy"];
const apiFx = () => (game.modules?.get?.("fxmaster")?.active && globalThis.FXMASTER?.api?.presets ? globalThis.FXMASTER.api : null);
const usarFx = () => { try { return game.settings.get(MOD, "usarFXMaster") !== false; } catch { return true; } };
function presetsFx() {
  const api = apiFx();
  if (!api) return [];
  try { return api.presets.listValid?.() ?? api.presets.list?.() ?? []; } catch { return []; }
}

/** O que o clima mostra na cena: { weather, preset, opcoes }. */
function efeitoCena(tipo) {
  const c = CLIMAS[tipo];
  if (c?.fx && usarFx() && apiFx()) {
    if (c.fx.startsWith("fxp:")) {
      const nome = c.fx.slice(4);
      if (presetsFx().includes(nome)) return { weather: "", preset: nome, opcoes: c.fxOpcoes ?? {} };
    } else if (CONFIG.weatherEffects?.[c.fx]) return { weather: c.fx, preset: null };
  }
  return { weather: efeitoDoClima(tipo), preset: null };
}

/** Liga, troca ou desliga o preset do FXMaster que o Calendário pôs nesta cena.
 *  Devolve true se o preset pedido está valendo na cena (ou se nenhum foi pedido); false se o FXMaster
 *  não conseguiu ligar o preset (quem chamou volta para o efeito do Foundry). */
async function aplicarFxNaCena(cena, ef) {
  const api = apiFx();
  const antes = cena.getFlag(MOD, "fxPreset") ?? null;
  const novo = ef?.preset ? { nome: ef.preset, opcoes: ef.opcoes ?? {} } : null;
  if (JSON.stringify(antes) === JSON.stringify(novo)) {
    if (!novo || !api?.presets?.listActive) return true;
    // a flag diz que está ligado: confere com o FXMaster (alguém pode ter limpado os efeitos)
    try { if ((api.presets.listActive({ scene: cena }) ?? []).includes(novo.nome)) return true; } catch { return true; }
  }
  if (!api) { if (antes) await cena.unsetFlag(MOD, "fxPreset"); return !novo; }
  try {
    if (antes?.nome) await api.presets.stop(antes.nome, { scene: cena });
    if (!novo) { if (antes) await cena.unsetFlag(MOD, "fxPreset"); return true; }
    const o = novo.opcoes;
    const ok = await api.presets.play(novo.nome, { scene: cena, silent: true, ...(o.densidade ? { density: o.densidade } : {}), ...(o.velocidade ? { speed: o.velocidade } : {}), ...(corHex(o.cor) ? { color: o.cor } : {}) });
    let ativo = ok !== false;
    if (ativo && api.presets.listActive) { try { ativo = (api.presets.listActive({ scene: cena }) ?? []).includes(novo.nome); } catch { /* sem como conferir */ } }
    if (ativo) { await cena.setFlag(MOD, "fxPreset", novo); return true; }
    avisoUmaVezCal(`fx-${novo.nome}`, `${T("Calendário: o FXMaster não ligou o preset \"{0}\"; usando o efeito do Foundry no lugar.", [novo.nome])}`);
    if (antes) await cena.unsetFlag(MOD, "fxPreset");
    return false;
  } catch (err) {
    relatarErro(T("efeito do FXMaster"), err, { avisar: false });
    try { if (antes) await cena.unsetFlag(MOD, "fxPreset"); } catch { /* ignora */ }
    return false;
  }
}

/** Efeito final de uma cena para um clima: tenta o FXMaster; se não der, o do Foundry. */
async function aplicarEfeitoNaCena(cena, tipo) {
  const ef = tipo ? efeitoCena(tipo) : { weather: "", preset: null };
  const okFx = await aplicarFxNaCena(cena, ef);
  return okFx ? ef.weather : efeitoDoClima(tipo);
}

const zonaDef = (t, p) => ({ temp: t, pesos: p });
const ZONAS = {
  temperada: { nome: "Temperada", ...zonaDef({ primavera: 15, verao: 26, outono: 14, inverno: 2 }, {
    primavera: { limpo: 18, poucasNuvens: 14, nublado: 12, encoberto: 6, garoa: 10, chuva: 14, aguaceiro: 4, tempestade: 5, neblina: 8, chuvaNeblina: 4, vento: 5 },
    verao: { limpo: 30, poucasNuvens: 15, nublado: 8, garoa: 4, chuva: 8, aguaceiro: 6, tempestade: 10, granizo: 2, calor: 12, vento: 5 },
    outono: { limpo: 12, poucasNuvens: 10, nublado: 15, encoberto: 10, garoa: 10, chuva: 12, chuvaNeblina: 6, neblina: 10, neblinaDensa: 4, vento: 11 },
    inverno: { limpo: 12, nublado: 12, encoberto: 12, neblina: 10, neblinaDensa: 5, garoa: 4, neveLeve: 15, neve: 14, nevasca: 4, frioIntenso: 8, granizo: 4 } }) },
  tropical: { nome: "Tropical", ...zonaDef({ primavera: 27, verao: 31, outono: 27, inverno: 23 }, {
    primavera: { limpo: 20, poucasNuvens: 15, nublado: 10, garoa: 8, chuva: 20, aguaceiro: 12, tempestade: 10, calor: 5 },
    verao: { limpo: 12, poucasNuvens: 10, nublado: 10, chuva: 22, aguaceiro: 18, tempestade: 18, chuvaNeblina: 5, calor: 5 },
    outono: { limpo: 25, poucasNuvens: 18, nublado: 12, garoa: 10, chuva: 18, aguaceiro: 7, tempestade: 5, neblina: 5 },
    inverno: { limpo: 35, poucasNuvens: 20, nublado: 12, garoa: 8, chuva: 10, neblina: 8, calor: 7 } }) },
  deserto: { nome: "Deserto", ...zonaDef({ primavera: 30, verao: 40, outono: 30, inverno: 18 }, {
    primavera: { limpo: 45, poucasNuvens: 10, vento: 15, areia: 15, calor: 12, nublado: 3 },
    verao: { limpo: 35, calor: 35, areia: 18, vento: 10, tempestade: 2 },
    outono: { limpo: 45, poucasNuvens: 10, vento: 18, areia: 17, calor: 8, nublado: 2 },
    inverno: { limpo: 50, poucasNuvens: 15, vento: 12, nublado: 8, garoa: 5, frioIntenso: 10 } }) },
  artica: { nome: "Ártica", ...zonaDef({ primavera: -8, verao: 3, outono: -10, inverno: -28 }, {
    primavera: { limpo: 15, nublado: 15, encoberto: 10, neveLeve: 22, neve: 20, nevasca: 8, neblina: 5, vento: 5 },
    verao: { limpo: 25, poucasNuvens: 15, nublado: 18, garoa: 8, neveLeve: 14, neblina: 12, vento: 8 },
    outono: { nublado: 18, encoberto: 12, neveLeve: 15, neve: 25, nevasca: 12, vento: 10, frioIntenso: 8 },
    inverno: { encoberto: 12, neve: 25, nevasca: 28, vento: 10, frioIntenso: 20, neblinaDensa: 5, aurora: 6 } }) },
  montanha: { nome: "Montanha", ...zonaDef({ primavera: 6, verao: 15, outono: 5, inverno: -8 }, {
    primavera: { limpo: 18, poucasNuvens: 12, nublado: 15, garoa: 8, chuva: 10, neblina: 15, neblinaDensa: 5, vento: 12, neveLeve: 5 },
    verao: { limpo: 30, poucasNuvens: 15, nublado: 10, tempestade: 14, granizo: 6, vento: 15, chuva: 10 },
    outono: { nublado: 18, encoberto: 10, neblina: 18, neblinaDensa: 10, chuva: 12, garoa: 8, vento: 16, neveLeve: 8 },
    inverno: { neve: 28, nevasca: 20, neveLeve: 12, nublado: 10, vento: 12, frioIntenso: 12, neblinaDensa: 6 } }) },
  // reinos dos elementos: o clima puxa para o elemento dominante
  agua: { nome: "Reino da Água", elemento: true, ...zonaDef({ primavera: 16, verao: 24, outono: 15, inverno: 6 }, {
    primavera: { chuva: 22, garoa: 15, chuvaNeblina: 12, neblina: 15, nublado: 14, limpo: 12, aguaceiro: 10 },
    verao: { chuva: 20, aguaceiro: 15, tempestade: 18, garoa: 8, nublado: 14, limpo: 20, chuvaNeblina: 5 },
    outono: { chuva: 20, chuvaNeblina: 15, neblina: 18, neblinaDensa: 8, garoa: 14, nublado: 15, limpo: 10 },
    inverno: { chuva: 14, garoa: 10, neblina: 18, neblinaDensa: 12, neveLeve: 14, neve: 10, nublado: 12, granizo: 10 } }) },
  fogo: { nome: "Reino do Fogo", elemento: true, ...zonaDef({ primavera: 30, verao: 42, outono: 32, inverno: 22 }, {
    primavera: { limpo: 30, calor: 35, cinzas: 15, poucasNuvens: 10, nublado: 5, tempestade: 5 },
    verao: { calor: 50, cinzas: 20, limpo: 20, tempestade: 5, areia: 5 },
    outono: { limpo: 30, calor: 30, cinzas: 20, poucasNuvens: 10, nublado: 10 },
    inverno: { limpo: 35, calor: 15, cinzas: 15, nublado: 20, poucasNuvens: 15 } }) },
  terra: { nome: "Reino da Terra", elemento: true, ...zonaDef({ primavera: 16, verao: 25, outono: 15, inverno: 4 }, {
    primavera: { limpo: 30, poucasNuvens: 20, nublado: 20, garoa: 10, chuva: 10, neblina: 10 },
    verao: { limpo: 35, poucasNuvens: 15, nublado: 10, areia: 20, calor: 15, vento: 5 },
    outono: { limpo: 25, nublado: 25, encoberto: 10, neblina: 20, garoa: 10, vento: 10 },
    inverno: { nublado: 30, encoberto: 15, limpo: 20, neveLeve: 15, neve: 10, neblina: 10 } }) },
  ar: { nome: "Reino do Ar", elemento: true, ...zonaDef({ primavera: 13, verao: 21, outono: 12, inverno: 0 }, {
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
  nenhuma: { nome: "Nenhuma" },
  agua: { nome: "Água drenada", clima: "limpo", base: "agua", trocas: {}, temp: 6, icone: "fa-droplet-slash", texto: "Os rios secam, as geleiras derretem sem explicação e o mar perde as ondas." },
  fogo: { nome: "Fogo drenado", clima: "nublado", base: "fogo", trocas: {}, temp: -12, icone: "fa-fire-flame-simple", texto: "Fogueiras não acendem e o calor some do mundo; tudo fica frio e cinzento." },
  terra: { nome: "Terra drenada", clima: "areia", base: "terra", trocas: {}, temp: 0, icone: "fa-mountain", texto: "O solo racha e vira pó, plantações murcham e as pedras se esfarelam." },
  ar: { nome: "Ar drenado", clima: "neblina", base: "ar", trocas: {}, temp: 4, icone: "fa-wind", texto: "Calmaria total: nenhuma brisa, o ar fica pesado e parado, difícil de respirar." }
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
  if (!anomaliasLigadas()) { avisoUmaVezCal("anomalias-desligadas", T("Calendário: um Nexus tentou ligar uma anomalia, mas a barra de Anomalias está desligada.")); return false; }
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
  if (avisar && quem !== "nenhum") await chat(`<i class="fa-solid fa-cloud-sun"></i> <b>${T("Clima de hoje")}</b><ul>${linhas}</ul>`, quem === "mestre" ? idsGM() : []);
  await registrar(`${T("Clima: {0}", [novas.map((zona) => `${ZONAS[zona].nome} — ${CLIMAS[hoje.zonas[zona].tipo]?.nome}`).join("; ")])}`, { icone: "fa-cloud-sun" });
  await aplicarClimaNasCenas();
}

const temperaturaTexto = (c) => (game.settings.get(MOD, "climaUnidade") === "F" ? `${Math.round(c * 9 / 5 + 32)}°F` : `${c}°C`);

function textoClima(zona) {
  const c = climaDe(zona);
  if (!c) return T("ainda não rolado");
  const an = anomaliaDe(zona);
  const faixa = c.min != null && c.max != null ? ` ${T("(mín. {0}, máx. {1})", [temperaturaTexto(c.min), temperaturaTexto(c.max)])}` : "";
  const onda = c.onda ? ` ${T("· onda de {0}", [T(c.onda)])}` : "";
  return `${esc(CLIMAS[c.tipo]?.nome ?? c.tipo)}, ${temperaturaTexto(c.temp)}${faixa}${onda}${an ? ` · <i>${esc(an.texto || ANOMALIAS[an.tipo].texto)}</i>` : ""}`;
}

/** Linha do clima para o chat: ícone, tipo, temperatura e a descrição do tempo. */
function mensagemClima(zona) {
  const c = climaDe(zona);
  if (!c) return textoClima(zona);
  const info = CLIMAS[c.tipo];
  return `<i class="fa-solid ${info?.icone ?? "fa-cloud"}"></i> ${textoClima(zona)}${info?.desc ? `<br><small>${esc(info.desc)}</small>` : ""}`;
}

/* ---------------- clima nas cenas ----------------
 * Qual cena recebe o efeito do clima:
 *  · região por token (Região do mapa onde o grupo está) — sempre, a não ser que a Região diga "não mostrar";
 *  · região própria da cena (escolhida na janela do clima) — sim;
 *  · mapa com Regiões de clima, com o grupo fora de todas — segue a região da cena ou a padrão;
 *  · região padrão do mundo (cena sem região própria e sem Region desenhada) — conforme a opção
 *    "Clima nas cenas sem região própria": "todas" (padrão) ou só as marcadas com "Mostrar o clima nesta cena".
 *    Nessas cenas, um efeito escolhido à mão pelo mestre não é trocado (só o que o próprio Calendário pôs);
 *  · o mestre pode desligar o clima visual de qualquer cena (flag climaNaCena = false).
 * O efeito que o Calendário põe numa cena fica anotado (flag climaAplicado) na mesma gravação; assim ele só
 * tira de uma cena o efeito que ele mesmo colocou, nunca um escolhido à mão. */
function planoClimaCena(s) {
  const decisao = s.getFlag(MOD, "climaNaCena");
  const ativa = s.getFlag(MOD, "zonaAtiva");
  const porToken = ZONAS[ativa?.zona] ? ativa.zona : null;
  const propria = ZONAS[s.getFlag(MOD, "zona")] ? s.getFlag(MOD, "zona") : null;
  const temRegioes = !!s.regions?.some?.((r) => r.behaviors?.some?.((b) => b.type === TIPO_CLIMA && !b.disabled));
  const origem = porToken ? "token" : propria ? "propria" : temRegioes ? "mapa" : "padrao";
  const zona = zonaDaCena(s);
  const base = { origem, zona, anomalia: ZONAS[zona]?.anomaliaFixa ?? anomaliaDe(zona)?.tipo ?? null };
  if (!game.settings.get(MOD, "climaVisual")) return { ...base, incluir: false, motivo: T("\"Efeito de clima nas cenas\" está desligado nas configurações") };
  if (decisao === false) return { ...base, incluir: false, motivo: T("O mestre desligou o clima visual desta cena") };
  if (porToken && ativa.efeito === false) return { ...base, incluir: false, motivo: T("A Região do mapa onde o grupo está não mostra o clima") };
  if (origem === "padrao" && decisao !== true) {
    let modo = "todas";
    try { modo = game.settings.get(MOD, "climaCenasSemRegiao") ?? "todas"; } catch { /* opção ainda não registrada */ }
    if (modo !== "todas") return { ...base, incluir: false, motivo: T("Usa a região padrão do mundo e não está marcada para mostrar o clima") };
    // efeito escolhido à mão: fica (o Calendário só troca o que ele mesmo pôs)
    const aplicado = s.getFlag(MOD, "climaAplicado");
    const naCena = s.weather ?? "";
    const manual = naCena !== "" && (aplicado == null ? !s.getFlag(MOD, "fxPreset") : naCena !== aplicado);
    if (manual) return { ...base, incluir: false, manual: true, motivo: T("Tem um efeito escolhido à mão ({efeito}); marque \"Mostrar o efeito do clima nesta cena\" para o Calendário assumir", { efeito: naCena }) };
  }
  const clima = climaDe(zona);
  if (!clima) return { ...base, incluir: false, motivo: T("O clima de hoje ainda não foi rolado para esta região") };
  return { ...base, incluir: true, clima, ef: efeitoCena(clima.tipo), motivo: "" };
}

let CLIMA_CENAS = { pendente: false, promessa: Promise.resolve() };
/** Põe o clima nas cenas. Uma de cada vez (fila "climaCenas"); vários pedidos seguidos viram uma só passada,
 *  que lê o estado mais recente quando começa. */
function aplicarClimaNasCenas() {
  if (!souGMPrincipal()) return Promise.resolve();
  if (CLIMA_CENAS.pendente) return CLIMA_CENAS.promessa;
  CLIMA_CENAS.pendente = true;
  CLIMA_CENAS.promessa = naFila("climaCenas", async () => {
    CLIMA_CENAS.pendente = false;
    await aplicarClimaNasCenasAgora();
  }).catch((err) => relatarErro(T("clima das cenas"), err));
  return CLIMA_CENAS.promessa;
}

async function aplicarClimaNasCenasAgora() {
  const updates = [];
  for (const s of game.scenes) {
    const plano = planoClimaCena(s);
    const aplicado = s.getFlag(MOD, "climaAplicado") ?? null;
    if (!plano.incluir) {
      // tira só o que o próprio Calendário pôs (preset do FXMaster e efeito do Foundry)
      if (s.getFlag(MOD, "fxPreset")) await aplicarFxNaCena(s, null);
      if (aplicado != null && (s.weather ?? "") === aplicado && aplicado !== "") updates.push({ _id: s.id, weather: "", [`flags.${MOD}.-=climaAplicado`]: null });
      else if (aplicado != null && (s.weather ?? "") !== aplicado) updates.push({ _id: s.id, [`flags.${MOD}.-=climaAplicado`]: null });
      continue;
    }
    // primeiro o FXMaster (se escolhido); se ele não ligar o preset, a cena recebe o efeito do Foundry
    const weather = await aplicarEfeitoNaCena(s, plano.clima.tipo);
    if ((s.weather ?? "") !== weather || aplicado !== weather) updates.push({ _id: s.id, weather, [`flags.${MOD}.climaAplicado`]: weather });
  }
  await atualizarCenas(updates, {}, "clima das cenas");
}

/** Para conferir no console: todas as cenas, o que cada uma deveria mostrar, o que mostra e por quê. */
function diagnosticoClima({ silencioso = false } = {}) {
  const W = CONFIG.weatherEffects ?? {};
  const ORIGEM = { token: T("Região do mapa (token)"), propria: T("própria da cena"), mapa: T("mapa com Regiões, grupo fora delas"), padrao: T("padrão do mundo") };
  const linhas = [...game.scenes].map((s) => {
    const p = planoClimaCena(s);
    const esperado = p.incluir ? (p.ef.preset ? "" : p.ef.weather) : null;
    let ativos = "";
    try { ativos = apiFx()?.presets?.listActive?.({ scene: s })?.join(", ") ?? ""; } catch { ativos = "?"; }
    const naCena = s.weather ?? "";
    let situacao;
    if (!p.incluir) situacao = p.motivo;
    else if (p.ef.preset && !ativos.split(", ").includes(p.ef.preset)) situacao = T("Preset do FXMaster esperado não está ativo (o Calendário vai usar o efeito do Foundry)");
    else if (naCena !== (esperado ?? naCena) && !p.ef.preset) situacao = T("Diferente do esperado: será corrigido na próxima aplicação");
    else if (naCena && !W[naCena]) situacao = T("O efeito salvo na cena não existe neste computador");
    else situacao = T("OK");
    return {
      cena: s.name, id: s.id, ativa: !!s.active, vistaAqui: s.id === canvas?.scene?.id,
      regiao: `${T(ZONAS[p.zona]?.nome ?? p.zona ?? "")} (${ORIGEM[p.origem]})`,
      regiaoPropria: ZONAS[s.getFlag(MOD, "zona")] ? T(ZONAS[s.getFlag(MOD, "zona")].nome) : "", regiaoPadrao: T(ZONAS[zonaPadraoValida()]?.nome ?? ""),
      elegivel: p.incluir, anomalia: p.anomalia ? T(ANOMALIAS[p.anomalia]?.nome ?? p.anomalia) : "",
      clima: p.clima ? T(CLIMAS[p.clima.tipo]?.nome ?? p.clima.tipo) : "", efeitoEsperado: esperado ?? "", presetEsperado: p.ef?.preset ?? "",
      presetsAtivos: ativos, naCena: naCena || "(nenhum)", existeNoFoundry: naCena ? !!W[naCena] : "", situacao
    };
  });
  if (!silencioso) {
    console.table(linhas);
    let semRegiao = "todas";
    try { semRegiao = game.settings.get(MOD, "climaCenasSemRegiao"); } catch { /* sem a opção */ }
    console.log(`${MOD} | FXMaster ativo: ${!!apiFx()} · usar FXMaster: ${usarFx()} · efeito de clima nas cenas: ${game.settings.get(MOD, "climaVisual")} · cenas sem região própria: ${semRegiao} · região padrão: ${ZONAS[zonaPadraoValida()]?.nome} · efeitos registrados: ${Object.keys(W).length} · prévia: ${PREVIA.cenaId ?? "não"}`);
  }
  return linhas;
}


/* ---------------- clima pelas Regiões nativas do Foundry ---------------- */
/* No mapa-múndi, desenhe Regiões nativas (ferramenta de Regiões) e adicione o comportamento
 * "Clima (Calendário da Mesa)". Quando um token de jogador entra, aquela região passa a ditar o
 * clima do mapa; ao sair de todas, volta para a região da cena ou a padrão. Tudo fica nos dados
 * nativos da Região: nenhum processamento contínuo, só reage a entrar e sair. */

const TIPO_CLIMA = `${MOD}.clima`;
const BaseComportamento = foundry.data?.regionBehaviors?.RegionBehaviorType;

class ClimaRegiao extends (BaseComportamento ?? class {}) {
  static defineSchema() {
    const f = foundry.data.fields;
    return {
      zona: new f.StringField({
        required: true, initial: "temperada", label: chaveI18n("Região do clima"),
        hint: chaveI18n("Clima que o grupo encontra enquanto estiver dentro desta área. As anomalias criadas na janela do clima também aparecem aqui (\"Anomalia: ...\"): a área usa a região base da anomalia com ela sempre ativa."),
        choices: () => Object.fromEntries(Object.entries(ZONAS).filter(([, v]) => !v.virtual || anomaliasLigadas()).map(([k, v]) => [k, v.nome]))
      }),
      efeito: new f.BooleanField({ initial: true, label: chaveI18n("Mostrar o clima no mapa"), hint: chaveI18n("Chuva, neve, neblina... nativos do Foundry enquanto o grupo estiver aqui.") }),
      aviso: new f.BooleanField({ initial: true, label: chaveI18n("Avisar no chat ao entrar e ao sair"), hint: chaveI18n("Mostra o clima do dia quando o grupo entra nesta área e quando sai dela (com o clima do lugar para onde foi).") })
    };
  }

  /* Entrar e sair rodam na fila "regiao": quatro tokens do grupo cruzando a borda juntos geram um aviso só. */
  static _entrar(evento) {
    if (!souGMPrincipal()) return;
    const token = evento.data?.token;
    if (!token?.actor?.hasPlayerOwner) return;
    return naFila("regiao", () => ClimaRegiao._entrarAgora.call(this, token)).catch((err) => relatarErro(T("região de clima (entrada)"), err));
  }

  static async _entrarAgora(token) {
    const cena = this.region?.parent ?? this.parent?.parent?.parent;
    if (!cena || !ZONAS[this.zona]) return;
    const atual = cena.getFlag(MOD, "zonaAtiva");
    if (atual?.zona === this.zona && atual?.regiao === this.region.id) return;
    await cena.setFlag(MOD, "zonaAtiva", { zona: this.zona, regiao: this.region.id, efeito: this.efeito });
    if (!climaDe(this.zona)) await atualizarClima({ avisar: false });
    // o efeito da região aparece na tela já na entrada (ex.: Reino da Água chovendo → chuva na cena)
    await aplicarClimaNasCenas();
    if (this.aviso) {
      const quem = game.settings.get(MOD, "climaChat");
      const nome = this.region.name || ZONAS[this.zona].nome;
      await chat(`<i class="fa-solid fa-map-location-dot"></i> ${T("O grupo entrou em")} <b>${esc(nome)}</b>${nome !== ZONAS[this.zona].nome ? ` (${esc(ZONAS[this.zona].nome)})` : ""}.<br>${mensagemClima(this.zona)}`, quem === "mestre" ? idsGM() : []);
    }
    HUD.render();
  }

  static _sair(evento) {
    if (!souGMPrincipal()) return;
    const token = evento.data?.token;
    if (!token?.actor?.hasPlayerOwner) return;
    return naFila("regiao", () => ClimaRegiao._sairAgora.call(this, token)).catch((err) => relatarErro(T("região de clima (saída)"), err));
  }

  static async _sairAgora(token) {
    const cena = this.region?.parent;
    if (!cena || cena.getFlag(MOD, "zonaAtiva")?.regiao !== this.region.id) return;
    // ainda há personagem de jogador dentro desta região? então o grupo não saiu
    const restam = [...(this.region.tokens ?? [])].filter((t) => t.id !== token.id && t.actor?.hasPlayerOwner);
    if (restam.length) return;
    // ainda dentro de outra região de clima? passa a valer ela
    const outra = [...(token.regions ?? [])].find((r) => r.id !== this.region.id && r.behaviors?.some((b) => b.type === TIPO_CLIMA && !b.disabled));
    const b = outra?.behaviors.find((x) => x.type === TIPO_CLIMA && !x.disabled);
    if (b && ZONAS[b.system.zona]) await cena.setFlag(MOD, "zonaAtiva", { zona: b.system.zona, regiao: outra.id, efeito: b.system.efeito });
    else await cena.unsetFlag(MOD, "zonaAtiva");
    const zonaNova = zonaDaCena(cena);
    if (!climaDe(zonaNova)) await atualizarClima({ avisar: false });
    // a cena tem Regiões de clima: fora delas ela segue a região padrão (planoClimaCena cuida disso)
    await aplicarClimaNasCenas();
    if (this.aviso) {
      const quem = game.settings.get(MOD, "climaChat");
      const nome = this.region.name || ZONAS[this.zona]?.nome || T("a região");
      const destino = b ? `${T("Agora em")} <b>${esc(outra.name || ZONAS[b.system.zona].nome)}</b>` : `${T("De volta ao clima de")} <b>${esc(ZONAS[zonaNova]?.nome ?? zonaNova)}</b>`;
      await chat(`<i class="fa-solid fa-person-walking-arrow-right"></i> ${T("O grupo saiu de")} <b>${esc(nome)}</b>. ${destino}.<br>${mensagemClima(zonaNova)}`, quem === "mestre" ? idsGM() : []);
    }
    HUD.render();
  }
}
if (BaseComportamento) {
  const E = CONST.REGION_EVENTS ?? {};
  ClimaRegiao.events = {
    [E.TOKEN_ENTER ?? "tokenEnter"]: ClimaRegiao._entrar,
    [E.TOKEN_EXIT ?? "tokenExit"]: ClimaRegiao._sair
  };
}

function registrarRegiaoDeClima() {
  if (!BaseComportamento || !CONFIG.RegionBehavior) return;
  CONFIG.RegionBehavior.dataModels[TIPO_CLIMA] = ClimaRegiao;
  if (CONFIG.RegionBehavior.typeIcons) CONFIG.RegionBehavior.typeIcons[TIPO_CLIMA] = "fa-solid fa-cloud-sun";
  if (CONFIG.RegionBehavior.typeLabels) CONFIG.RegionBehavior.typeLabels[TIPO_CLIMA] = chaveI18n("Clima (Calendário da Mesa)");
}

/* ---------------- contadores e prazos ---------------- */

const contadores = () => { const c = game.settings.get(MOD, "contadores"); return Array.isArray(c?.lista) ? c.lista : []; };
const salvarContadores = (lista) => naFila("contadores", () => game.settings.set(MOD, "contadores", { lista }));

/** Lê os contadores, deixa fn mudar a lista e grava, um de cada vez. fn devolve false para não gravar. */
function alterarContadores(fn) {
  return naFila("contadores", async () => {
    const lista = foundry.utils.deepClone(contadores());
    const r = await fn(lista);
    if (r === false) return;
    await game.settings.set(MOD, "contadores", { lista: Array.isArray(r) ? r : lista });
  });
}

async function verificarContadores(antes, depois) {
  if (!souGMPrincipal()) return;
  const terminados = [];
  await alterarContadores((lista) => {
    let mudou = false;
    for (const c of lista) {
      if (!c.feito && depois >= c.fim) { c.feito = true; mudou = true; terminados.push({ ...c }); }
      else if (c.feito && depois < c.fim) { c.feito = false; mudou = true; }
    }
    return mudou ? lista : false;
  });
  // o aviso sai depois de gravar: se o mesmo prazo for checado de novo, ele já está "feito"
  for (const c of terminados) {
    await chat(`<i class="fa-solid fa-hourglass-end"></i> <b>${esc(c.nome)}</b> ${T("terminou.")}`, c.aviso === "todos" ? [] : idsGM());
    await registrar(`${T("Prazo terminou: {0}", [c.nome])}`, { icone: "fa-hourglass-end", wt: c.fim });
  }
}

/* ---------------- lojas abertas e fechadas ---------------- */

const MEJ = "monks-enhanced-journal";
function paginaDeLoja(e) {
  return e?.pages?.contents?.find((p) => p.flags?.[MEJ]?.type === "shop") ?? null;
}

/** Horário da loja em minutos do dia (formato do Monk's/Journal: abre 480 = 08:00, fecha 1020 = 17:00).
 *  O Journal guarda em flags["journal-mesa"].horario se a loja usa horário ({ ativo, folga: [dias da semana] }).
 *  Loja do Journal sem horário ligado = sempre aberta. Loja só do Monk's = usa abertura/fechamento dele. */
function horarioLoja(e) {
  const p = paginaDeLoja(e);
  if (!p) return null;
  const hj = p.flags?.[JOURNAL]?.horario;
  const doJournal = !!p.flags?.[JOURNAL];
  const ativo = hj ? hj.ativo !== false : !doJournal;
  const abre = num(p.flags[MEJ].opening, 480), fecha = num(p.flags[MEJ].closing, 1020);
  const folga = Array.isArray(hj?.folga) ? hj.folga.map(Number).filter(Number.isFinite) : [];
  return { abre, fecha, ativo, folga };
}

/** Motivo de a loja estar fechada agora ("folga", "horario") ou null se aberta. */
function lojaFechadaPor(e, wt = game.time.worldTime) {
  const h = horarioLoja(e);
  if (!h || !h.ativo) return null;
  if (h.folga.length && h.folga.includes(infoDia(diaTotalDe(wt)).sem)) return "folga";
  if (h.abre === h.fecha) return null;
  const s = segundoDoDia(wt);
  const min = Math.floor(s / segHora()) * 60 + Math.floor((s % segHora()) / segMinuto()) * (60 / CFG.minutosHora);
  const dentro = h.abre < h.fecha ? min >= h.abre && min < h.fecha : min >= h.abre || min < h.fecha;
  return dentro ? null : "horario";
}

const lojaAberta = (e, wt = game.time.worldTime) => lojaFechadaPor(e, wt) === null;

const minutoParaHora = (m) => `${pad(Math.floor(m / 60))}:${pad(Math.round(m % 60))}`;

function lojasHTML() {
  const lojas = game.journal.filter((e) => paginaDeLoja(e) && (game.user.isGM || e.testUserPermission(game.user, "LIMITED")));
  if (!lojas.length) return "";
  const linhas = lojas.sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang)).map((e) => {
    const h = horarioLoja(e), motivo = lojaFechadaPor(e), aberta = !motivo;
    const texto = !h.ativo ? T("sempre aberta")
      : motivo === "folga" ? T("folga hoje")
      : aberta ? (h.abre === h.fecha ? T("aberta") : `${T("aberta até {0}", [minutoParaHora(h.fecha)])}`) : `${T("fechada · abre {0}", [minutoParaHora(h.abre)])}`;
    return `<li class="${aberta ? "cm-aberta" : "cm-fechada"}"><i class="fa-solid fa-store"></i>
      <a data-action="abrirNota" data-id="${e.id}">${esc(e.name)}</a>
      <span>${texto}</span></li>`;
  }).join("");
  return `<div class="cm-bloco"><h4>${T("Lojas agora")}</h4><ul class="cm-lojas">${linhas}</ul></div>`;
}

/* ---------------- datas nos textos: @Data[...] e @Hoje ---------------- */

/** Lê "14 de Brasa de 1023", "14/Brasa/1023", "14 Brasa" ou "1023-6-14" e devolve o dia absoluto. */
function lerData(txt) {
  const t = String(txt).trim();
  let m = t.match(/^(-?\d+)-(\d+)-(\d+)$/);
  if (m) return tdDe(num(m[1]) - CFG.anoInicial, num(m[2]) - 1, num(m[3]) - 1);
  m = t.match(/^(\d+)\s*(?:de\s+|\/\s*)?(.+?)(?:\s*(?:de\s+|\/\s*)(-?\d+))?(?:\s+[^\d]*)?$/i);
  if (!m) return null;
  const nome = m[2].trim().toLowerCase();
  const mes = CFG.meses.findIndex((x) => x.nome.toLowerCase() === nome || x.abrev.toLowerCase() === nome);
  if (mes < 0) return null;
  const ano = m[3] != null ? num(m[3]) - CFG.anoInicial : agora().ano;
  return tdDe(ano, mes, Math.max(0, num(m[1], 1) - 1));
}

function registrarEnrichers() {
  const lista = CONFIG.TextEditor?.enrichers;
  if (!Array.isArray(lista)) return;
  lista.push({
    pattern: /@Data\[([^\]]+)\](?:\{([^}]+)\})?/g,
    enricher: async (m) => {
      const a = document.createElement("a");
      a.classList.add("cm-link-data");
      let td = null;
      try { td = CFG ? lerData(m[1]) : null; } catch (err) { console.warn(`${MOD} | @Data[${m[1]}]: não consegui ler a data`, err); }
      if (td == null) { a.classList.add("cm-link-ruim"); a.dataset.tooltip = T("Data não encontrada no calendário"); }
      else a.dataset.td = td;
      a.innerHTML = `<i class="fa-solid fa-calendar-day"></i> ${esc(m[2] ?? m[1])}`;
      return a;
    }
  });
  lista.push({
    pattern: /@Hoje\b/g,
    enricher: async () => {
      const a = document.createElement("a");
      a.classList.add("cm-link-data");
      try { a.dataset.td = agora().td; a.innerHTML = `<i class="fa-solid fa-calendar-day"></i> ${esc(textoData(agora()))}`; }
      catch { a.textContent = T("hoje"); }
      return a;
    }
  });
}

/* ---------------- pulo de tempo cinematográfico ---------------- */

function puloCinematografico(antes, depois) {
  if (!game.settings.get(MOD, "cinema") || !game.settings.get(MOD, "cinemaMundo")) return;
  const limite = num(game.settings.get(MOD, "cinemaHoras"), 24) * segHora();
  if (Math.abs(depois - antes) < limite) return;
  document.getElementById("cm-cinema")?.remove();
  const d0 = diaTotalDe(antes), d1 = diaTotalDe(depois), dias = d1 - d0;
  const el = document.createElement("div");
  el.id = "cm-cinema";
  el.innerHTML = `<div class="cm-cin-caixa">
    <div class="cm-cin-sub">${dias >= 0 ? T("O tempo passa...") : T("O tempo volta...")}</div>
    <div class="cm-cin-data">${esc(textoData(infoDia(d0)))}</div>
    <div class="cm-cin-conta">${dias ? (Math.abs(dias) > 1 ? T("{0} dias", [Math.abs(dias)]) : T("1 dia")) : duracaoTexto(Math.abs(depois - antes))}</div>
  </div>`;
  document.body.append(el);
  const dataEl = el.querySelector(".cm-cin-data");
  const dur = 2200, t0 = performance.now();
  let ultimo = d0;
  const passo = (t) => {
    const f = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - f, 3);
    const td = Math.round(d0 + (d1 - d0) * e);
    if (td !== ultimo) { ultimo = td; dataEl.textContent = textoData(infoDia(td)); }
    if (f < 1) return requestAnimationFrame(passo);
    dataEl.textContent = textoData(infoDia(d1));
    el.classList.add("cm-cin-fim");
    setTimeout(() => { el.classList.add("cm-cin-sai"); setTimeout(() => el.remove(), 900); }, 1300);
  };
  requestAnimationFrame(passo);
  el.addEventListener("click", () => el.remove());
}


/* ---------------- viagem dia a dia e vigias ----------------
 * O estado da viagem fica no setting "viagem" (mundo). Quem muda é o mestre principal, sempre pela fila.
 *   fase: "viajando" (andando no dia) · "escolha" (jogadores escolhem a vigia) · "vigias" (vigias correndo)
 *         · "noite" (vigias terminadas, esperando o amanhecer)
 *   vigias: { n, participantes: [userIds], escolhas: { userId: índice }, atual, inicio (wt) }
 * Cada vigia dura 2 horas do calendário. O painel abaixo aparece na tela de todos. */

const DURACAO_VIGIA_H = 2;
const segVigia = () => DURACAO_VIGIA_H * segHora();
const viagemAtual = () => { const v = game.settings.get(MOD, "viagem"); return v?.ativa ? v : null; };

function alterarViagem(fn) {
  return naFila("viagem", async () => {
    const v = foundry.utils.deepClone(game.settings.get(MOD, "viagem") ?? {});
    const r = await fn(v);
    if (r === false) return v;
    const final = r && typeof r === "object" ? r : v;
    await game.settings.set(MOD, "viagem", final);
    return final;
  });
}

/** Nome para mostrar de um jogador: "Personagem (Jogador)". */
function nomeDoJogador(userId) {
  const u = game.users.get(userId);
  if (!u) return "?";
  return u.character ? `${u.character.name} (${u.name})` : u.name;
}

/** Horário (HH:MM) do início e do fim da vigia i. */
function horarioVigia(vigias, i) {
  const ini = num(vigias.inicio, game.time.worldTime) + i * segVigia();
  const hhmm = (t) => textoRelogio(segundoDoDia(t)).slice(0, 5);
  return `${hhmm(ini)}–${hhmm(ini + segVigia())}`;
}

/** Quem ficou em cada vigia: [[userIds da 1ª], [da 2ª], ...]. */
function gruposDaVigia(vigias) {
  const g = Array.from({ length: num(vigias?.n, 0) }, () => []);
  for (const [uid, i] of Object.entries(vigias?.escolhas ?? {})) if (g[i] && (vigias.participantes ?? []).includes(uid)) g[i].push(uid);
  return g;
}

/** Mestre: grava a vigia escolhida por um jogador (pedido do próprio jogador ou do mestre). */
function escolherVigia(userId, indice) {
  if (!souGMPrincipal()) return;
  return alterarViagem((v) => {
    const vg = v?.vigias;
    if (!v?.ativa || v.fase !== "escolha" || !vg) return false;
    if (!game.users.get(userId) || !(vg.participantes ?? []).includes(userId)) return false;
    vg.escolhas ??= {};
    if (indice == null || indice === "") delete vg.escolhas[userId];
    else {
      const i = Math.trunc(Number(indice));
      if (!(i >= 0 && i < vg.n)) return false;
      vg.escolhas[userId] = i;
    }
    return v;
  });
}

/** Jogador (ou mestre) clicou numa vigia no painel. */
function pedirVigia(indice) {
  if (game.user.isGM && souGMPrincipal()) return escolherVigia(game.user.id, indice);
  if (!game.users.activeGM) return ui.notifications.warn(T("O mestre precisa estar online para isso."));
  game.socket.emit(`module.${MOD}`, { acao: "vigiaEscolher", userId: game.user.id, vigia: indice });
}

/** Painel das vigias na tela de todos (escolha e vigia em andamento). */
const PainelVigia = {
  el: null,
  render() {
    let v = null;
    try { v = viagemAtual(); } catch { v = null; }
    const vg = v?.vigias;
    if (!CFG || !v || !vg || !["escolha", "vigias"].includes(v.fase)) { this.el?.remove(); this.el = null; return; }
    if (!this.el) {
      this.el = document.createElement("div");
      this.el.id = "cm-vigia";
      document.body.append(this.el);
      this.el.addEventListener("click", (ev) => {
        const b = ev.target.closest("[data-vigia-acao]");
        if (!b) return;
        ev.preventDefault();
        const acao = b.dataset.vigiaAcao;
        if (acao === "escolher") return pedirVigia(b.dataset.i);
        if (acao === "sair") return pedirVigia(null);
        if (acao === "minimizar") { this.min = !this.min; return this.render(); }
        if (game.user.isGM) ferr("acaoViagem", acao);
      });
    }
    const gm = game.user.isGM;
    const grupos = gruposDaVigia(vg);
    const souParticipante = (vg.participantes ?? []).includes(game.user.id);
    const minha = vg.escolhas?.[game.user.id];
    const nomes = (ids) => ids.length ? ids.map((id) => `<span class="cm-vg-nome">${esc(nomeDoJogador(id))}</span>`).join("") : `<span class="cm-vg-vazio">${T("ninguém")}</span>`;
    let corpo = "";
    if (v.fase === "escolha") {
      const faltam = (vg.participantes ?? []).filter((id) => vg.escolhas?.[id] == null);
      corpo = `<div class="cm-vg-sub">${souParticipante ? T("Escolha em qual vigia você fica.") : T("Os jogadores estão escolhendo as vigias.")}</div>
        <ol class="cm-vg-lista">${grupos.map((ids, i) => `<li class="${minha === i ? "cm-vg-minha" : ""}">
          <div class="cm-vg-cab"><b>${T("{0}ª vigia", [i + 1])}</b><small>${esc(horarioVigia(vg, i))}</small></div>
          <div class="cm-vg-nomes">${nomes(ids)}</div>
          ${souParticipante ? (minha === i
            ? `<button type="button" data-vigia-acao="sair" class="cm-vg-btn">${T("Sair")}</button>`
            : `<button type="button" data-vigia-acao="escolher" data-i="${i}" class="cm-vg-btn">${T("Ficar nesta")}</button>`) : ""}
        </li>`).join("")}</ol>
        ${faltam.length ? `<div class="cm-vg-falta"><i class="fa-solid fa-hourglass-half"></i> ${T("Ainda não escolheram: {0}", [faltam.map((id) => esc(nomeDoJogador(id))).join(", ")])}</div>` : `<div class="cm-vg-falta pronto"><i class="fa-solid fa-check"></i> ${T("Todos escolheram.")}</div>`}
        ${gm ? `<div class="cm-vg-gm"><button type="button" data-vigia-acao="comecarVigias"><i class="fa-solid fa-play"></i> ${T("Começar as vigias")}</button></div>` : ""}`;
    } else {
      const i = num(vg.atual, 0);
      const ultima = i >= vg.n - 1;
      corpo = `<div class="cm-vg-agora">
          <div class="cm-vg-num">${T("{0}ª vigia", [i + 1])} <small>${T("de {0}", [vg.n])}</small></div>
          <div class="cm-vg-hora"><i class="fa-solid fa-moon"></i> ${esc(horarioVigia(vg, i))}</div>
          <div class="cm-vg-nomes grande">${nomes(grupos[i] ?? [])}</div>
        </div>
        ${!ultima ? `<div class="cm-vg-prox">${T("Depois: {0} ({1})", [(grupos[i + 1] ?? []).map((id) => esc(nomeDoJogador(id))).join(", ") || T("ninguém"), esc(horarioVigia(vg, i + 1))])}</div>` : ""}
        ${gm ? `<div class="cm-vg-gm"><button type="button" data-vigia-acao="proximaVigia"><i class="fa-solid fa-forward"></i> ${ultima ? T("Terminar a última vigia") : T("Próxima vigia (+2 h)")}</button></div>` : ""}`;
    }
    this.el.className = `cm-tema-${tema()} ${this.min ? "cm-vg-min" : ""}`;
    this.el.innerHTML = `<header><i class="fa-solid fa-campground"></i><span>${T("Vigias{0} · dia {1}", [v.destino ? ` ${T("· a caminho de {0}", [esc(v.destino)])}` : "", num(v.dia, 1)])}</span>
        <a data-vigia-acao="minimizar" data-tooltip="${this.min ? T("Mostrar") : T("Minimizar")}"><i class="fa-solid ${this.min ? "fa-chevron-down" : "fa-chevron-up"}"></i></a></header>
      ${this.min ? "" : corpo}`;
  }
};

/* ---------------- ferramentas carregadas só quando usadas ---------------- */
/* Editor, importador, luz por hora, histórico, contadores, viagem, clima e dias sagrados ficam em
 * ferramentas.js. O arquivo só é baixado na primeira vez que alguém abre uma dessas janelas,
 * então o jogo carrega mais rápido (principalmente para os jogadores, que quase nunca usam). */
let _ferramentas = null;
globalThis.__calendarioMesaURL = import.meta.url;
/** Carrega o ferramentas.js. A versão no endereço evita que o navegador (ou o Cloudflare) use um arquivo velho
 *  depois de uma atualização. Se falhar, avisa e tenta de novo na próxima vez, sem afetar o resto do módulo. */
const ferramentas = () => (_ferramentas ??= import(new URL(`./ferramentas.js?v=${game.modules.get(MOD)?.version ?? "0"}`, import.meta.url).href)
  .catch((err) => {
    _ferramentas = null;
    console.error(`${MOD} | não consegui carregar ferramentas.js`, err);
    ui.notifications.error(T("Calendário: não consegui abrir esta ferramenta. Confira se o arquivo ferramentas.js está na pasta do módulo e recarregue (F5). O resto do calendário continua funcionando."));
    throw err;
  }));
/* A falha ao carregar o arquivo já é avisada em ferramentas(); aqui só se relata erro de dentro da ferramenta. */
const ferr = async (nome, ...args) => {
  let F;
  try { F = await ferramentas(); } catch { return null; }
  try { return await F[nome](...args); } catch (err) { relatarErro(nome, err); return null; }
};
async function abrirFerramenta(nome) {
  let F;
  try { F = await ferramentas(); } catch { return null; }
  try { return await new F[nome]().render({ force: true }); } catch (err) { relatarErro(nome, err); return null; }
}

/** Atalho do menu de configurações para a janela de luz (a janela de verdade está em ferramentas.js). */
class MenuLuz extends ApplicationV2 {
  async render() { abrirFerramenta("JanelaLuz"); return this; }
}

/* Central de Configurações: carregada só quando aberta (scripts/central.js). */
let _central = null;
const central = () => (_central ??= import(new URL(`./central.js?v=${game.modules.get(MOD)?.version ?? "0"}`, import.meta.url).href)
  .catch((err) => { _central = null; relatarErro(T("Central de Configurações"), err); throw err; }));
async function abrirCentral() {
  try { return (await central()).abrirCentral(); } catch { return null; }
}
class MenuCentral extends ApplicationV2 {
  async render() { abrirCentral(); return this; }
}

class MenuTabelas extends ApplicationV2 {
  async render() { abrirFerramenta("JanelaTabelas"); return this; }
}

/* ---------------- registro ---------------- */

function rerenderJanelas() {
  limparCache();
  HUD.render();
  foundry.applications.instances.get("cm-calendario")?.render();
}

Hooks.once("init", () => {
  Handlebars.registerHelper("cmT", (texto) => T(String(texto ?? "")));
  // As configurações mostradas na Central de Configurações saem da lista padrão do Foundry (config: false).
  // O registro continua o mesmo: id, escopo, tipo, padrão, opções e onChange não mudam, e os valores salvos ficam.
  const S = (k, o) => game.settings.register(MOD, k, CHAVES_CENTRAL.has(k) ? { ...o, config: false } : o);
  game.settings.registerMenu(MOD, "menuCentral", {
    name: K("Central de Configurações"), label: K("Abrir Central de Configurações"),
    hint: K("Todas as opções do Calendário da Mesa organizadas em abas: Geral, Tempo, Clima, Anomalias, Astronomia e luz, Eventos e diários e Ferramentas."),
    icon: "fa-solid fa-star-and-crescent", type: MenuCentral, restricted: false
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
    name: "Tema", hint: "Visual do HUD e da janela do calendário.", scope: "client", config: true, type: String,
    choices: { journal: "Igual ao Journal da Mesa", claro: "Claro (Fantasia)", vitoriano: "Vitoriano", noite: "Noite" }, default: "journal", onChange: rerenderJanelas
  });
  S("mostrarHud", { name: "Mostrar o HUD do calendário", scope: "client", config: true, type: Boolean, default: true, onChange: rerenderJanelas });
  S("posHud", { scope: "client", config: false, type: Object, default: {} });
  S("hudDnd5e", {
    name: "HUD de calendário do D&D 5e", hint: "O D&D 5e tem o próprio relógio no topo da tela. Ele mostra a data deste calendário; esconda para ficar só com o HUD do Calendário da Mesa.",
    scope: "world", config: !!globalThis.dnd5e, type: String, choices: { esconder: "Esconder (usar só o do Calendário da Mesa)", mostrar: "Mostrar os dois" }, default: "esconder", requiresReload: true
  });
  S("hudModo", { scope: "client", config: false, type: String, default: "completo" });
  S("hudCompacto", { scope: "client", config: false, type: Boolean, default: false });
  S("editorNotas", {
    name: "Quem cria e edita as notas", hint: "Journal da Mesa: \"Nova nota\" cria a página e abre no Journal da Mesa, e é lá que se edita data, hora, repetição, ícone e aviso. Se o Journal da Mesa estiver desativado, o calendário usa o próprio editor. Calendário: sempre o editor do calendário.",
    scope: "world", config: true, type: String, choices: { journal: "Journal da Mesa (quando ativo)", calendario: "Calendário" }, default: "journal", onChange: () => foundry.applications.instances.get("cm-calendario")?.render()
  });
  S("abrirNoJournal", { name: "Abrir notas no Journal da Mesa", hint: "Se o módulo Journal da Mesa estiver ativo, as notas do calendário abrem nele em vez da ficha padrão.", scope: "client", config: true, type: Boolean, default: true });
  S("jogadoresVeemHora", { name: "Jogadores veem a hora exata", hint: "Desligado, eles veem só Madrugada, Manhã, Tarde ou Noite.", scope: "world", config: true, type: Boolean, default: true, onChange: rerenderJanelas });
  S("pastaNotas", { scope: "world", config: false, type: String, default: "" });
  S("pastaPorAno", { name: "Notas em subpastas por ano", hint: "Dentro da pasta escolhida, cada nota vai para uma subpasta \"Ano 1023\", \"Ano 1024\"...", scope: "world", config: true, type: Boolean, default: false });
  S("jogadoresVeemLuasOcultas", { name: "Jogadores sabem quando uma lua volta", hint: "No painel do dia, mostra as luas fora do céu e quanto falta para voltarem.", scope: "world", config: true, type: Boolean, default: false });
  S("relogioAtivo", { scope: "world", config: false, type: Boolean, default: false, onChange: rerenderJanelas });
  S("relogioTaxa", { name: "Velocidade do relógio em tempo real", hint: "Segundos de jogo por segundo real (1 = tempo real, 60 = um minuto por segundo).", scope: "world", config: true, type: Number, default: 1 });
  S("pausaJogo", { name: "Relógio para quando o jogo está pausado", scope: "world", config: true, type: Boolean, default: true });
  S("pausaCombate", { name: "Relógio para durante o combate", hint: "No combate, o Foundry já avança o tempo a cada rodada.", scope: "world", config: true, type: Boolean, default: true });
  S("luz", { scope: "world", config: false, type: Object, default: {}, onChange: () => { if (game.ready) aplicarLuz(estadoLuz(game.time.worldTime), 1500).catch((err) => relatarErro("luz das cenas", err)); } });
  game.settings.registerMenu(MOD, "menuLuz", {
    name: "Luz do mapa", label: "Luz por hora", hint: "Nível de luz de cada hora, luz das luas e cor da noite. Vale para as cenas com o dia/noite ligado (botão de meia-lua no HUD).",
    icon: "fa-solid fa-sun", type: MenuLuz, restricted: true
  });
  S("historico", { scope: "world", config: false, type: Object, default: { itens: [] }, onChange: () => foundry.applications.instances.get("cm-historico")?.render() });
  // quando (hora real, em ms) a última "Sessão de jogo" entrou no histórico: um F5 no meio da sessão não registra outra
  S("ultimaSessao", { scope: "world", config: false, type: Number, default: 0 });
  S("historicoJogadores", { name: "Jogadores veem o histórico", hint: "Libera o botão do histórico da campanha para os jogadores.", scope: "world", config: true, type: Boolean, default: false, onChange: rerenderJanelas });
  S("climaZonas", { scope: "world", config: false, type: Object, default: { zonas: {} }, onChange: () => HUD.render() });
  S("climaAtual", { scope: "world", config: false, type: Object, default: {}, onChange: () => HUD.render() });
  S("anomaliasAtivas", { name: "Ativar a barra de Anomalias", hint: "Mostra a aba Anomalias na janela do clima e faz as anomalias valerem. Desligado: elas somem da janela, do HUD e das Regiões do mapa (as criadas ficam guardadas).", scope: "world", config: true, type: Boolean, default: true, onChange: () => {
    recarregarTiposDeClima(); HUD.render(); foundry.applications.instances.get("cm-clima")?.render();
  } });
  S("anomaliaRegiaoInteira", { name: "Anomalia cobrindo uma região inteira", hint: "Ligado: dá para ativar uma anomalia sobre uma região inteira (Temperada, Reino da Água...) na janela do clima e pelos limiares dos Nexus do Journal da Mesa. Desligado (padrão): a anomalia só vale na região dela (\"Usar como região\" na aba Anomalias), e os Nexus ligam e desligam essa região.", scope: "world", config: true, type: Boolean, default: false, onChange: () => {
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
  S("zonaPadrao", { name: "Região padrão do clima", hint: "Usada nas cenas que não escolheram uma região (botão de clima no HUD).", scope: "world", config: true, type: String,
    choices: ESCOLHAS_ZONAS, default: "temperada", onChange: () => HUD.render() });
  S("visaoDiaNoite", { name: "Névoa de guerra com o dia e a noite", hint: "Nas cenas com dia/noite do Calendário: de dia o mapa todo fica visível (luz global); quando a escuridão passa do limite abaixo, só a visão dos tokens e as luzes revelam o mapa e a névoa de guerra volta a valer. Liga a visão dos tokens nessas cenas.", scope: "world", config: true, type: Boolean, default: false, onChange: () => { if (game.ready) aplicarLuz(estadoLuz(game.time.worldTime), 800).catch((err) => relatarErro("luz das cenas", err)); } });
  S("visaoLimite", { name: "Escuridão em que a noite esconde o mapa", hint: "0 = qualquer escuridão já esconde; 1 = nunca esconde. 0,6 escurece no fim do crepúsculo.", scope: "world", config: true, type: Number, range: { min: 0, max: 1, step: 0.05 }, default: 0.6, onChange: () => { if (game.ready && visaoDiaNoite()) aplicarLuz(estadoLuz(game.time.worldTime), 800).catch((err) => relatarErro("luz das cenas", err)); } });
  S("tabelasEncontro", { scope: "world", config: false, type: Object, default: { ids: [] } });
  game.settings.registerMenu(MOD, "menuTabelas", {
    name: "Tabelas de encontro da viagem", label: "Escolher tabelas", hint: "Quais tabelas aparecem em \"Tabela de encontros\" na janela de viagem. Nenhuma marcada = todas.",
    icon: "fa-solid fa-table-list", type: MenuTabelas, restricted: true
  });
  S("efeitosVencidos", { name: K("Efeitos com duração vencidos"), hint: K("Quando o tempo passa, o que fazer com os efeitos ativos dos personagens cuja duração acabou (magias, venenos...). Usa o início e a duração que o próprio Foundry guarda em cada efeito."), scope: "world", config: true, type: String,
    choices: { remover: K("Remover da ficha"), desativar: K("Desativar (fica na ficha, desligado)"), nao: K("Não mexer") }, default: "nao" });
  S("efeitosAviso", { name: K("Avisar o mestre quando efeitos acabarem"), scope: "world", config: true, type: Boolean, default: true });
  S("luasAviso", { name: K("Eventos das luas no chat"), hint: K("Luas cheias juntas, eclipses e noites sem luas, no dia em que acontecem."), scope: "world", config: true, type: String, choices: { nenhum: K("Não avisar"), mestre: K("Só o mestre"), todos: K("Todos") }, default: "todos" });
  S("eclipseChance", { name: K("Chance de eclipse por ciclo lunar (%)"), hint: K("A cada lua nova (eclipse solar) e a cada lua cheia (eclipse lunar), a chance de acontecer um eclipse. O sorteio é fixo: os eclipses caem sempre nos mesmos dias."), scope: "world", config: true, type: Number, range: { min: 0, max: 100, step: 1 }, default: 15, onChange: () => { limparCache(); rerenderJanelas(); } });
  S("eclipseMudaClima", { name: K("Eclipse solar muda o clima do dia"), hint: K("No dia de um eclipse solar, o clima das regiões vira \"Eclipse\"."), scope: "world", config: true, type: Boolean, default: false });
  S("climaPrevisao", { scope: "world", config: false, type: Object, default: { dias: {} }, onChange: () => foundry.applications.instances.get("cm-clima")?.render() });
  S("previsaoDias", { name: K("Dias de previsão do tempo"), hint: K("Quantos dias à frente o mestre vê e ajusta na aba Previsão da janela do clima."), scope: "world", config: true, type: Number, range: { min: 3, max: 7, step: 1 }, default: 5 });
  S("recarregarAoMudar", { name: K("Recarregar ao mudar configurações de módulos"), hint: K("Quando você muda alguma opção de um módulo na janela de configurações e fecha a janela, a página recarrega sozinha. Se a opção mudada vale para o mundo, recarrega também para os jogadores conectados."), scope: "world", config: true, type: String,
    choices: { todos: K("Qualquer módulo"), calendario: K("Só o Calendário da Mesa"), nao: K("Não recarregar") }, default: "todos" });
  S("usarFXMaster", { name: "Usar o FXMaster nos climas", hint: "Com o FXMaster ativo, cada clima usa o efeito do FXMaster escolhido para ele (aba Climas); sem o FXMaster, ou desligado, usa o efeito do Foundry.", scope: "world", config: true, type: Boolean, default: true, onChange: () => { aplicarClimaNasCenas().catch((err) => relatarErro("clima das cenas", err)); } });
  S("climaVariacao", { name: "Variação da temperatura", hint: "Quanto a temperatura de um dia pode fugir da média da região (no sorteio do dia e no dado da janela do clima).", scope: "world", config: true, type: String,
    choices: { baixa: "Baixa (dias parecidos)", normal: "Normal", alta: "Alta", extrema: "Extrema (dias muito diferentes)" }, default: "normal" });
  S("climaChat", { name: "Clima do dia no chat", scope: "world", config: true, type: String, choices: { nenhum: "Não avisar", mestre: "Só o mestre", todos: "Todos" }, default: "mestre" });
  S("climaCenasSemRegiao", { name: K("Clima nas cenas sem região própria"), hint: K("Cenas que não escolheram uma região e não têm Region de clima desenhada. \"Todas\": usam a região padrão do mundo (menos as desligadas pelo mestre e as com efeito escolhido à mão). \"Só as marcadas\": só as com \"Mostrar o efeito do clima nesta cena\" (como até a 4.1.0)."), scope: "world", config: true, type: String,
    choices: { todas: K("Todas as cenas"), marcadas: K("Só as cenas marcadas") }, default: "todas", onChange: () => aplicarClimaNasCenas() });
  S("climaVisual", { name: "Efeito de clima nas cenas", hint: "Chuva, neve, neblina... (do Foundry ou do FXMaster) nas cenas com região própria, nos mapas com Regions de clima e, conforme a opção \"Clima nas cenas sem região própria\", nas outras cenas.", scope: "world", config: true, type: Boolean, default: true });
  S("climaUnidade", { name: "Temperatura em", scope: "world", config: true, type: String, choices: { C: "Celsius (°C)", F: "Fahrenheit (°F)" }, default: "C", onChange: () => HUD.render() });
  S("contadores", { scope: "world", config: false, type: Object, default: { lista: [] }, onChange: () => { foundry.applications.instances.get("cm-contadores")?.render(); HUD.render(); } });
  S("cinemaMundo", { name: "Animação ao pular muito tempo", hint: "Mostra para todos uma passagem de tempo em tela cheia.", scope: "world", config: true, type: Boolean, default: true });
  S("cinemaHoras", { name: "A partir de quantas horas animar", scope: "world", config: true, type: Number, default: 24 });
  S("cinema", { name: "Ver a animação de passagem de tempo", hint: "Desligue só para você.", scope: "client", config: true, type: Boolean, default: true });
  S("integrarJournal", { name: "Ligar ao Journal da Mesa", hint: "O dia das ofertas diárias do Journal da Mesa avança junto com o calendário.", scope: "world", config: true, type: Boolean, default: true });
  S("viagem", { scope: "world", config: false, type: Object, default: {}, onChange: () => {
    PainelVigia.render();
    foundry.applications.instances.get("cm-viagem")?.render();
    HUD.render();
  } });
  S("avisoSemana", { name: "Avisar nova semana", hint: "Avisa o mestre no chat quando começa uma nova semana, para renovar o estoque das lojas do Journal da Mesa.", scope: "world", config: true, type: Boolean, default: true });
});

// O sistema (ex.: D&D 5e) pode definir o próprio calendário; aplicamos o nosso depois dele.
Hooks.once("setup", () => {
  registrarEfeitosPersonalizados();
  const atual = CONFIG.time.worldCalendarConfig;
  if (atual && atual.description !== "Calendário da Mesa") { try { CAL_ANTERIOR = foundry.utils.deepClone(atual); } catch (err) { console.warn(`${MOD} | não consegui guardar o calendário anterior (para "Importar do mundo")`, err); } }
  aplicarCalendario();
  // D&D 5e: o HUD do sistema é criado no "ready"; desligar aqui evita dois relógios na tela
  if (CONFIG.DND5E?.calendar && game.settings.get(MOD, "hudDnd5e") === "esconder") CONFIG.DND5E.calendar.application = null;
});

Hooks.once("ready", () => {
  aplicarCalendario();
  game.modules.get(MOD).api = {
    abrir: () => JanelaCalendario.abrir(),
    editor: () => abrirFerramenta("EditorCalendario"),
    agora: () => ({ ...agora(), texto: textoData(agora()), anoExibido: agora().ano + CFG.anoInicial }),
    avancar, avancarAte,
    irPara: (ano, mes, dia) => irPara(tdDe(ano - CFG.anoInicial, mes - 1, dia - 1)),
    estacao: () => estacaoDe(agora().mes, agora().dia),
    era: () => eraDoAno(agora().ano),
    textoAno: (anoInterno = agora().ano) => textoAno(anoInterno),
    luas: () => CFG.luas.map((l) => ({ ...l, ...faseDe(l, agora().td), ...visibilidadeLua(l, agora().td) })),
    notasDoDia: (td = agora().td) => notasDoDia(td).map(({ j }) => j),
    config: () => foundry.utils.deepClone(CFG),
    converter: (json) => ferr("converterCalendario", json),
    // Para o Journal e macros: notas do calendário guardadas em flags["calendario-mesa"].nota
    notas: {
      ler: (j) => dadosNota(j),
      normalizar: (dados) => normalizarNota(dados),
      descrever: (j) => { const n = dadosNota(j); return n ? descreverRepeticao(n) : ""; },
      proximas: (j, qtd = 5) => { const n = dadosNota(j); return n ? proximasVezes(n, agora().td, qtd).map((td) => ({ td, texto: textoData(infoDia(td)) })) : []; },
      acontece: (j, td = agora().td) => { const n = dadosNota(j); return !!n && inicioQueCobre(n, td) !== null; },
      nova: (td = agora().td) => criarNota(td),
      editar: (j) => editarNota(j),
      // sempre o diálogo do calendário (útil para o Journal oferecer "editar pelo calendário")
      dialogo: (td = agora().td, j = null) => ferr("dialogoNota", j ? null : td, j),
      dataDe: (td) => textoData(infoDia(td)),
      /** id do calendário da nota (notas sem calendário são do principal) */
      calendario: (j) => { const r = j?.getFlag?.(MOD, "nota"); return r ? calDaNota(r) : null; }
    },
    textoDia: (td) => textoData(infoDia(Math.trunc(Number(td)))),
    lojaAberta: (e) => lojaAberta(e),
    lojaFechadaPor: (e) => lojaFechadaPor(e),
    horarioLoja: (e) => horarioLoja(e),
    // Datas para o Journal e macros (ano mostrado, mês contando de 0, dia contando de 1)
    datas: {
      hoje: () => agora().td,
      partes: (td) => {
        const inf = infoDia(Math.trunc(Number(td)));
        return { td: inf.td, ano: inf.ano + CFG.anoInicial, anoInterno: inf.ano, mes: inf.mes, dia: inf.dia + 1, sem: inf.sem,
          nomeMes: CFG.meses[inf.mes]?.nome ?? "?", nomeSemana: CFG.semana[inf.sem]?.nome ?? "", texto: textoData(inf), textoCurto: textoData(inf, { semana: false }),
          textoAno: textoAno(inf.ano), era: eraDoAno(inf.ano)?.nome ?? "" };
      },
      meses: (anoExibido = agora().ano + CFG.anoInicial) => {
        const ano = Math.trunc(Number(anoExibido)) - CFG.anoInicial;
        return CFG.meses.map((m, i) => ({ i, nome: m.nome, dias: diasNoMes(ano, i), existe: mesExiste(ano, i) }));
      },
      semana: () => CFG.semana.map((d) => d.nome),
      /** td do dia (ou null se a data não existe neste calendário) */
      tdDe: (anoExibido, mes, dia) => {
        const ano = Math.trunc(Number(anoExibido)) - CFG.anoInicial;
        mes = Math.trunc(Number(mes)); dia = Math.trunc(Number(dia));
        if (!(mes >= 0 && mes < CFG.meses.length) || !mesExiste(ano, mes) || dia < 1 || dia > diasNoMes(ano, mes)) return null;
        const td = tdDe(ano, mes, dia - 1);
        const inf = infoDia(td);
        return inf.ano === ano && inf.mes === mes && inf.dia === dia - 1 ? td : null;
      }
    },
    /** Liga ou desliga a anomalia (elemento drenado) de uma região do clima. tipo: "agua", "fogo", "terra", "ar" ou null. */
    anomalia: async (zona, tipo = null, texto = "") => {
      if (!game.user.isGM || !ZONAS[zona]) return false;
      if (!anomaliaRegiaoInteira()) { avisoUmaVezCal("anomalia-inteira", T("Calendário: um Nexus tentou ligar uma anomalia numa região inteira, mas a opção \"Anomalia cobrindo uma região inteira\" está desligada.")); return false; }
      const cfg = climaCfg();
      cfg.zonas[zona] = { ...(cfg.zonas[zona] ?? {}), anomalia: { tipo: tipo && ANOMALIAS[tipo] ? tipo : "nenhuma", texto: String(texto ?? "").trim() } };
      await game.settings.set(MOD, "climaZonas", cfg);
      return true;
    },
    diagnosticoClima,
    central: () => abrirCentral(),
    desfazer: () => desfazerUltimoPulo(),
    eventosLuas: (td = agora().td) => eventosLuasDoDia(td).map((e) => ({ ...e, texto: textoEventoLua(e) })),
    proximosEventosLuas: (dias = 120) => proximosEventosLuas(agora().td, dias, 20).map((e) => ({ ...e, texto: textoEventoLua(e) })),
    previsao: () => foundry.utils.deepClone(previsao()),
    gerarPrevisao: (opcoes) => gerarPrevisao(undefined, undefined, opcoes),
    expirarEfeitos: () => expirarEfeitos(game.time.worldTime),
    zonas: () => Object.entries(ZONAS).filter(([, z]) => !z.virtual).map(([k, z]) => ({ id: k, nome: z.nome })),
    /** Anomalias (vazio com a barra de Anomalias desligada). regiao = "Usar como região" ligado agora. */
    anomalias: () => anomaliasLigadas() ? Object.entries(ANOMALIAS).filter(([k]) => k !== "nenhuma").map(([k, a]) => ({ id: k, nome: a.nome, icone: a.icone, regiao: !!a.regiao })) : [],
    /** Como as anomalias valem agora: { ligadas (barra de Anomalias), regiaoInteira (opção "cobrindo uma região inteira") }. */
    modoAnomalias: () => ({ ligadas: anomaliasLigadas(), regiaoInteira: anomaliaRegiaoInteira() }),
    /** Liga ou desliga o "Usar como região" de uma anomalia (o jeito do Nexus sem a opção de região inteira). */
    anomaliaRegiao: (id, ligar = true) => ligarRegiaoDaAnomalia(id, ligar),
    /** Contadores e prazos (o jogador vê só os visíveis), com o dia em que terminam. */
    contadores: () => contadores().filter((c) => game.user.isGM || c.visivel).map((c) => ({ id: c.id, nome: c.nome, fim: c.fim, tdFim: diaTotalDe(num(c.fim, 0)), feito: !!c.feito, visivel: !!c.visivel })),
    clima: (zona = zonaDaCena()) => { const c = climaDe(zona); return c ? { zona, ...c, nome: CLIMAS[c.tipo]?.nome, anomalia: anomaliaDe(zona) } : null; },
    registrar: (texto, icone) => registrar(texto, { icone }),
    contador: async (nome, segundos, { visivel = true, aviso = "mestre" } = {}) => {
      if (!game.user.isGM) return false;
      const wt = game.time.worldTime;
      await alterarContadores((lista) => { lista.push({ id: foundry.utils.randomID(), nome, inicio: wt, fim: wt + segundos, visivel, aviso, feito: false }); });
      return true;
    },
    viajar: () => (viagemAtual() ? abrirFerramenta("JanelaViagem") : ferr("dialogoViagem")),
    viagem: () => foundry.utils.deepClone(viagemAtual()),
    /** Histórico da campanha (cópia) e se o usuário atual pode vê-lo — para o Journal não ler o setting direto. */
    historico: () => foundry.utils.deepClone(historico()),
    historicoVisivel: () => game.user.isGM || !!game.settings.get(MOD, "historicoJogadores"),
    diaSagrado: () => ferr("dialogoDiaSagrado"),
    calendarioAtual: () => ({ id: CAL_ID, nome: CFG.nome }),
    calendarios: () => { const { principal, lista } = listaCalendarios(); return Object.keys(lista).map((id) => ({ id, nome: normalizar(lista[id]).nome, principal: id === principal })); }
  };
  HUD.montar();
  HUD.render();
  PainelVigia.render();
  iniciarRelogio();
  game.socket.on(`module.${MOD}`, (msg) => {
    if (!souGMPrincipal() || !msg || typeof msg !== "object") return;
    if (msg.acao === "vigiaEscolher") escolherVigia(String(msg.userId ?? ""), msg.vigia)?.catch?.((err) => relatarErro("escolha de vigia", err));
  });
  // links de data nos textos (@Data[...] e @Hoje)
  document.body.addEventListener("click", (ev) => {
    const a = ev.target.closest?.(".cm-link-data[data-td]");
    if (!a) return;
    ev.preventDefault();
    JanelaCalendario.abrir(num(a.dataset.td));
  });
  if (souGMPrincipal()) {
    registrarSessao().catch((err) => relatarErro(T("histórico"), err));
    atualizarClima().catch((err) => relatarErro("clima", err));
  }
});

/** "Sessão de jogo" no histórico: só quando a última registrada tem mais de 6 h de tempo real ou é de outro dia
 *  real — recarregar a página (F5) no meio da sessão não registra outra. */
async function registrarSessao() {
  const agoraMs = Date.now();
  const ultima = num(game.settings.get(MOD, "ultimaSessao"), 0);
  const outroDia = new Date(ultima).toDateString() !== new Date(agoraMs).toDateString();
  if (ultima > 0 && agoraMs - ultima < 6 * 3600 * 1000 && !outroDia) return;
  await game.settings.set(MOD, "ultimaSessao", agoraMs);
  await registrar(`${T("Sessão de jogo ({0})", [new Date(agoraMs).toLocaleDateString(game.i18n.lang)])}`, { icone: "fa-dice-d20" });
}

Hooks.on("updateWorldTime", (wt, delta, options) => {
  ULT_TEMPO = performance.now();
  corrigirDeltasDnd5e(wt, delta, options);
  aoMudarTempo(wt, delta).catch((err) => console.error(`${MOD} |`, err));
});

/** O D&D 5e conta quantas meias-noites, meios-dias, amanheceres e anoiteceres passaram (para recuperar usos
 *  "por dia", "ao amanhecer" e "ao anoitecer"). A conta dele erra com meses que somem e com o nascer do sol
 *  mudando por estação; aqui ela é refeita dia a dia, antes de o sistema usar (ele lê depois, no "ready"). */
function corrigirDeltasDnd5e(wt, delta, options) {
  const d = options?.dnd5e?.deltas;
  if (!d || !CFG || !(delta > 0)) return;
  try {
    const antes = wt - delta, sd = segDia(), sh = segHora();
    const d0 = diaTotalDe(antes), d1 = diaTotalDe(wt);
    const conta = (hora) => {
      let n = 0;
      for (let td = d0; td <= d1 && td <= d0 + 4000; td++) { const t = td * sd + hora(td) * sh; if (t > antes && t <= wt) n++; }
      return d1 - d0 > 4000 ? n + (d1 - d0 - 4000) : n;
    };
    const solDoDia = (td) => { const i = infoDia(td); return solDe(i.mes, i.dia); };
    d.midnights = d1 - d0;
    d.middays = conta(() => CFG.horasDia / 2);
    if (d.sunrises != null) d.sunrises = conta((td) => solDoDia(td).nascer);
    if (d.sunsets != null) d.sunsets = conta((td) => solDoDia(td).por);
  } catch (err) { console.warn(`${MOD} | não consegui ajustar a contagem de tempo do D&D 5e`, err); }
}
Hooks.on("canvasReady", () => {
  // prévia de efeito de outra cena: acaba (a cena nova já desenhou o próprio clima; nada é restaurado nela)
  if (PREVIA.cenaId && PREVIA.cenaId !== canvas?.scene?.id) { PREVIA.cenaId = null; PREVIA.ef = null; foundry.applications.instances.get("cm-clima")?.render(); }
  // o mestre confere o clima das cenas (só grava o que estiver diferente)
  if (souGMPrincipal() && game.ready) aplicarClimaNasCenas();
  if (idAtivo() !== CAL_ID) { aplicarCalendario(); rerenderJanelas(); }
  HUD.render();
  PainelVigia.render();
  aplicarLuz(estadoLuz(game.time.worldTime), 0).catch((err) => relatarErro("luz das cenas", err));
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
  b.innerHTML = `<i class="fa-solid fa-calendar-days"></i> ${T("Calendário")}`;
  b.addEventListener("click", () => JanelaCalendario.abrir());
  (root.querySelector(".header-actions") ?? root.querySelector(".directory-header") ?? root).append(b);
});

/* nomes usados pelo ferramentas.js */
export {
  zonaPadraoValida,
  traduzirConfiguracoes,
  abrirCentral,
  PREVIA,
  aplicarClimaNasCenasAgora,
  iniciarPreviaEfeito,
  pararPreviaEfeito,
  planoClimaCena,
  previaAtiva,
  T,
  K,
  chaveI18n,
  MODOS_CENA,
  DESFAZER,
  acoesDaNota,
  definirPrevisao,
  desfazerUltimoPulo,
  dispararAcoesDasNotas,
  eventosLuasDoDia,
  executarAcoes,
  expirarEfeitos,
  fimDoEfeito,
  gerarPrevisao,
  guardarParaDesfazer,
  previsao,
  proximosEventosLuas,
  restaurarDesfazer,
  textoEventoLua,
  aplicarEfeitoNaCena,
  diagnosticoClima,
  limiteVisao,
  visaoDiaNoite,
  FX_PADRAO,
  PREFIXO_EFEITO,
  PRESETS_FX_CONHECIDOS,
  FRAG_TELA,
  VERT_TELA,
  ajustesDoEfeito,
  anomaliaRegiaoInteira,
  aplicarFxNaCena,
  apiFx,
  efeitoCena,
  idClimaAnomalia,
  montarEfeito,
  normalizarEfeito,
  presetsFx,
  redesenharClima,
  registrarEfeitosPersonalizados,
  CLIMAS_PADRAO,
  PREFIXO_ANOM,
  anomaliasLigadas,
  normalizarClima,
  tempoComAnomalia,
  ANOMALIAS_PADRAO,
  ESTACOES_CLIMA,
  ZONAS_PADRAO,
  ehDeFabrica,
  normalizarAnomalia,
  normalizarZona,
  recarregarTiposDeClima,
  rolarTemperatura,
  salvarTipoDeClima,
  GRUPOS_CLIMA,
  efeitoDoClima,
  mensagemClima,
  registrarEfeitosDeClima,
  DURACAO_VIGIA_H,
  PainelVigia,
  alterarContadores,
  alterarHistorico,
  alterarViagem,
  atualizarCenas,
  atualizarClimaAgora,
  escolherVigia,
  exigirSincrono,
  gruposDaVigia,
  horarioVigia,
  naFila,
  nomeDoJogador,
  pedirVigia,
  processarMudancaDeTempo,
  relatarErro,
  segVigia,
  viagemAtual,
  ANOMALIAS,
  ANTIGOS,
  AVISOS,
  ApplicationV2,
  BaseComportamento,
  CACHE,
  CACHE_CAL,
  CACHE_FIM,
  CAL_ANTERIOR,
  CAL_ID,
  CAL_X,
  CFG,
  CFG_CORE,
  CLIMAS,
  CalendarioBase,
  CalendarioMesaData,
  CalendarioNativo,
  ClimaRegiao,
  Dialogo,
  FASES_PADRAO,
  FIM,
  HIST_MAX,
  HUD,
  ICONES,
  JOURNAL,
  JanelaCalendario,
  MEJ,
  MOD,
  MODOS_MES,
  MenuLuz,
  ORDEM_EST,
  PRESET_ELEMENTOS,
  REPETIR,
  SEQ_LUZ,
  TIPO_CLIMA,
  ULT_TEMPO,
  UNIDADES,
  UNIDADE_SING,
  ZONAS,
  _ferramentas,
  abrirFerramenta,
  abrirNota,
  acontece,
  agora,
  anomaliaDe,
  aoMudarTempo,
  apagarNota,
  aplicarCalendario,
  aplicarClimaNasCenas,
  aplicarLuz,
  arquivarHistorico,
  atualizarClima,
  atualizarLuz,
  avancar,
  avancarAte,
  avisarNotas,
  bateRegra,
  bisCada,
  cal,
  calDaNota,
  caminhoPasta,
  cenaEmUso,
  cenasDiaNoite,
  chat,
  classeCalendario,
  climaCfg,
  climaDe,
  climaHoje,
  comCal,
  comConfig,
  comecaEm,
  contadores,
  contarAnos,
  corrigirDeltasDnd5e,
  criarNota,
  dadosNota,
  definirHoraDialogo,
  descreverRepeticao,
  diaDoAnoCfg,
  diaTotalDe,
  diarioHistorico,
  diasAnoCfg,
  diasMesCfg,
  diasNoMes,
  duracaoTexto,
  editarNota,
  ehBissexto,
  ehBissextoCfg,
  eraDoAno,
  eraDoAnoCfg,
  esc,
  escolherCalendarioDaCena,
  esperar,
  estacaoDe,
  estacoesOrdenadas,
  estadoLuz,
  faseDe,
  ferr,
  ferramentas,
  fimDaEstacao,
  hexParaHsv,
  historico,
  historicoHTML,
  horarioLoja,
  idAtivo,
  idsGM,
  idxEstacaoCfg,
  iluminacao,
  indiceCiclo,
  indiceFase,
  infoDia,
  iniciarRelogio,
  inicioDoIndice,
  inicioQueCobre,
  integrarJournal,
  irPara,
  journalPronto,
  lerData,
  limparCache,
  listaCalendarios,
  lojaAberta,
  lojasHTML,
  luaSVG,
  luasNoCeu,
  luzCfg,
  luzDoSol,
  luzPadrao,
  mesExiste,
  mesExisteCfg,
  mesProximoQueExiste,
  minutoParaHora,
  mod,
  normalizar,
  normalizarNota,
  notaNova,
  notas,
  notasDoDia,
  notasNoJournal,
  novaNotaNoJournal,
  num,
  opcoes,
  pad,
  paginaDeEvento,
  paginaDeLoja,
  paraCore,
  pastaCalendario,
  pastaParaNota,
  periodoDe,
  podeCriarNota,
  podeVer,
  posNoMes,
  proximasVezes,
  puloCinematografico,
  registrar,
  registrarEnrichers,
  registrarRegiaoDeClima,
  registrarVarios,
  relogio,
  rerenderJanelas,
  rolarClima,
  salvarContadores,
  segDia,
  segHora,
  segMinuto,
  segundoDoDia,
  segundosDaHora,
  seletorCalendarios,
  solDe,
  solDeCfg,
  somarTempo,
  sortearPeso,
  souGMPrincipal,
  tabelaAnos,
  tdDe,
  temMesesEmCiclo,
  tema,
  temperaturaTexto,
  textoAno,
  textoAnoCfg,
  textoClima,
  textoData,
  textoFalta,
  textoHora,
  textoHoraDec,
  textoRelogio,
  tipoEstacao,
  ultimoInicio,
  verificarContadores,
  visibilidadeLua,
  zonaDaCena,
  zonaDef,
  zonasEmUso
};
