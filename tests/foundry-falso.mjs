/* Foundry VTT simulado: o mínimo para carregar o módulo no Node e rodar os hooks init, i18nInit, setup e ready.
 * Não desenha nada (o DOM e o canvas aceitam qualquer chamada); serve para pegar erro de carga, nome sem
 * import e mudança na API. Usado por carga.test.mjs. */
import { readFileSync } from "node:fs";
export function montar(R, { lang = "en", gm = true } = {}) {
  const flat = (o, b = "") => Object.fromEntries(Object.entries(o).flatMap(([k, v]) => typeof v === "object" ? Object.entries(flat(v, b + k + ".")) : [[b + k, v]]));
  const EN = flat(JSON.parse(readFileSync(`${R}/lang/${lang === "en" ? "en" : "pt-BR"}.json`, "utf8")));
  // objeto que aceita qualquer coisa (DOM, canvas...)
  const tudo = () => new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => "" : k === "then" ? undefined : k === Symbol.iterator ? function* () {} : tudo(), apply: () => tudo(), construct: () => tudo() });
  const hooks = {};
  globalThis.Hooks = {
    once: (n, f) => (hooks[n] ??= []).push(f), on: (n, f) => (hooks[n] ??= []).push(f),
    call(n, ...a) { for (const f of hooks[n] ?? []) if (f(...a) === false) return false; return true; },
    callAll(n, ...a) { for (const f of hooks[n] ?? []) f(...a); return true; }
  };
  globalThis.CONST = { REGION_EVENTS: { TOKEN_ENTER: "tokenEnter", TOKEN_EXIT: "tokenExit" } };
  const ef = (id) => ({ id, label: id, effects: [{ id: "a", config: {} }] });
  globalThis.CONFIG = { weatherEffects: Object.fromEntries(["fog", "rain", "snow", "rainStorm", "leaves", "blizzard"].map((k) => [k, ef(k)])), RegionBehavior: { dataModels: {}, typeLabels: {}, typeIcons: {} }, time: { worldCalendarConfig: { name: "Gregorian", description: "x" } }, DND5E: { calendar: { application: "x" } }, TextEditor: { enrichers: [] } };
  class App { static DEFAULT_OPTIONS = {}; constructor(o = {}) { this.options = o; } render() { return this; } close() {} }
  // CalendarData com a mesma conta do Foundry (anos internos, sem yearZero; dia do ano de 0)
  class CalendarData {
    constructor(c) { Object.assign(this, foundry.utils.deepClone(c)); }
    get spd() { const d = this.days; return d.hoursPerDay * d.minutesPerHour * d.secondsPerMinute; }
    isLeapYear(y) { const l = this.years.leapYear; if (!l?.leapInterval) return false; return ((y - l.leapStart) % l.leapInterval + l.leapInterval) % l.leapInterval === 0; }
    countLeapYears(y) { let n = 0; for (let k = 0; k < y; k++) if (this.isLeapYear(k)) n++; return n; }
    diasAno(y) { return this.months.values.reduce((s, m) => s + (this.isLeapYear(y) ? m.leapDays ?? m.days : m.days), 0); }
    timeToComponents(t = 0) {
      const spd = this.spd; let dias = Math.floor(t / spd); const s = t - dias * spd;
      const total = dias; let y = 0;
      while (dias < 0) { y--; dias += this.diasAno(y); }
      while (dias >= this.diasAno(y)) { dias -= this.diasAno(y); y++; }
      const doy = dias; let m = 0;
      for (; m < this.months.values.length; m++) { const md = this.isLeapYear(y) ? this.months.values[m].leapDays ?? this.months.values[m].days : this.months.values[m].days; if (dias < md) break; dias -= md; }
      const sph = this.days.minutesPerHour * this.days.secondsPerMinute;
      const nw = this.days.values.length || 7;
      return { year: y, day: doy, month: m, dayOfMonth: dias, dayOfWeek: (((total + (this.years.firstWeekday ?? 0)) % nw) + nw) % nw, hour: Math.floor(s / sph), minute: Math.floor((s % sph) / this.days.secondsPerMinute), second: s % this.days.secondsPerMinute, season: 0 };
    }
    componentsToTime(c = {}) {
      let dias = 0; const y = c.year ?? 0;
      if (y >= 0) for (let k = 0; k < y; k++) dias += this.diasAno(k); else for (let k = y; k < 0; k++) dias -= this.diasAno(k);
      dias += c.day ?? 0;
      const sph = this.days.minutesPerHour * this.days.secondsPerMinute;
      return dias * this.spd + (c.hour ?? 0) * sph + (c.minute ?? 0) * this.days.secondsPerMinute + (c.second ?? 0);
    }
  }
  const instances = new Map();
  const campo = class { constructor(o) { Object.assign(this, o); } };
  globalThis.foundry = {
    applications: { api: { ApplicationV2: App, HandlebarsApplicationMixin: (c) => c, DialogV2: class extends App {} }, instances, ux: { TextEditor: { implementation: { enrichHTML: async (s) => s } } } },
    data: { CalendarData, fields: { StringField: campo, BooleanField: campo, NumberField: campo, SchemaField: campo, ObjectField: campo }, regionBehaviors: { RegionBehaviorType: class { static defineSchema() { return {}; } } } },
    canvas: { rendering: { filters: {} } },
    utils: { deepClone: (x) => (x == null ? x : JSON.parse(JSON.stringify(x))), mergeObject: (a, b) => Object.assign(a, b), debounce: (f) => f, randomID: () => Math.random().toString(36).slice(2, 18), isNewerVersion: () => true, getProperty: () => undefined }
  };
  globalThis.Handlebars = { registerHelper() {} };
  globalThis.requestAnimationFrame = () => 0;
  // o relógio em tempo real usa setInterval: sem unref, o teste nunca terminaria
  const si = globalThis.setInterval; globalThis.setInterval = (...a) => { const t = si(...a); t.unref?.(); return t; };
  globalThis.ChatMessage = { create: async (d) => { (globalThis.__chat ??= []).push(d.content); return d; }, getWhisperRecipients: () => [] };
  // sorteios repetíveis: os dois lados (4.4.0 e 4.5.0) veem os mesmos números
  let semente = 12345; Math.random = () => ((semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648);
  globalThis.document = tudo(); globalThis.window = globalThis; globalThis.canvas = { scene: null, ready: false };
  const erros = [];
  globalThis.ui = { notifications: { error: (m) => erros.push(m), info() {}, warn() {} } };
  const settings = new Map(), menus = new Map(), valores = new Map();
  const users = [{ id: "u1", isGM: gm, name: "Mestre", active: true }, { id: "u2", isGM: false, name: "Jogadora", active: true }];
  users.get = (id) => users.find((u) => u.id === id); users.activeGM = users[0];
  const socketOuvintes = {};
  const diasJournal = [], macrosRodadas = [];
  globalThis.game = {
    i18n: { lang, has: (k) => k in EN, localize: (k) => EN[k] ?? k, format: (k) => EN[k] ?? k },
    settings: {
      settings, menus,
      register: (m, k, o) => settings.set(`${m}.${k}`, o),
      registerMenu: (m, k, o) => menus.set(`${m}.${k}`, o),
      get: (m, k) => valores.has(`${m}.${k}`) ? valores.get(`${m}.${k}`) : foundry.utils.deepClone(settings.get(`${m}.${k}`)?.default),
      set: async (m, k, v) => { valores.set(`${m}.${k}`, v); settings.get(`${m}.${k}`)?.onChange?.(v); return v; }
    },
    modules: new Map([["calendario-mesa", { id: "calendario-mesa", active: true, version: "4.8.1" }],
      // Journal da Mesa: só o que o calendário chama (dia das lojas); os pedidos ficam em diasJournal
      ["journal-mesa", { id: "journal-mesa", active: true, api: { dia: { somar: async (n) => { diasJournal.push(n); } } } }]]),
    user: users[0], users, system: { id: "dnd5e" },
    time: { worldTime: 400 * 86400 + 13 * 3600, calendar: null, initializeCalendar() { this.calendar = new CONFIG.time.worldCalendarClass(CONFIG.time.worldCalendarConfig); }, get components() { return this.calendar.timeToComponents(this.worldTime); }, advance: async (s) => { game.time.worldTime += s; }, set: async (t) => { game.time.worldTime = t; } },
    journal: Object.assign([], { get: (id) => game.journal.find((j) => j.id === id) ?? null, getName: () => null, contents: [] }), scenes: Object.assign([], { get: () => null, contents: [] }), folders: [], tables: [], actors: [],
    socket: { on: (c, f) => (socketOuvintes[c] ??= []).push(f), emit: (c, d) => (globalThis.__socket ??= []).push([c, d]) },
    macros: { get: (id) => ({ id, execute: async (dados) => { macrosRodadas.push({ id, td: dados.td }); } }) },
    paused: false, ready: false, combat: null
  };
  CONFIG.time.worldCalendarClass = CalendarData;
  globalThis.dnd5e = { dataModels: { calendar: { CalendarData5e: CalendarData } } };
  /** Diário falso com as flags do calendário (nota e ações). */
  const diario = ({ id = foundry.utils.randomID(), name = "Nota", nota, acoes } = {}) => ({
    id, name, uuid: `JournalEntry.${id}`, flags: { "calendario-mesa": { nota, acoes } },
    getFlag: (m, k) => (m === "calendario-mesa" ? (k === "nota" ? nota : k === "acoes" ? acoes : undefined) : undefined),
    testUserPermission: () => true
  });
  return { hooks, settings, menus, socketOuvintes, valores, erros, diasJournal, macrosRodadas, diario, async rodar(n, ...a) { for (const f of hooks[n] ?? []) await f(...a); } };
}
