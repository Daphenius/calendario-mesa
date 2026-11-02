/* =========================================================
 * Calendário da Mesa — Importar calendários
 * Calendário gregoriano, importação de outros formatos (Simple Calendar, Seasons & Stars, Calendaria,
 * Fantasy-Calendar.com, Foundry) e notas que acompanham mudanças no calendário.
 * ========================================================= */

import { diasNoMes, infoDia, mesProximoQueExiste, tdDe } from "../datas.js";
import { bisCada, CAL_ANTERIOR, calDaNota, CFG, comConfig, mod, MOD, normalizar, num, T } from "../nucleo.js";
const TRAD = {
  January: T("Gregoriano.janeiro"), February: T("Gregoriano.fevereiro"), March: T("Gregoriano.marco"), April: T("Gregoriano.abril"), May: T("Gregoriano.maio"), June: T("Gregoriano.junho"),
  July: T("Gregoriano.julho"), August: T("Gregoriano.agosto"), September: T("Gregoriano.setembro"), October: T("Gregoriano.outubro"), November: T("Gregoriano.novembro"), December: T("Gregoriano.dezembro"),
  Monday: T("Gregoriano.segunda_feira"), Tuesday: T("Gregoriano.terca_feira"), Wednesday: T("Gregoriano.quarta_feira"), Thursday: T("Gregoriano.quinta_feira"),
  Friday: T("Gregoriano.sexta_feira"), Saturday: T("Gregoriano.sabado"), Sunday: T("Gregoriano.domingo")
};
const traduzir = (n) => {
  const loc = game.i18n?.localize?.(n) ?? n;
  return TRAD[loc] ?? TRAD[String(n).split(".").pop()] ?? loc;
};

function presetGregoriano() {
  const g = foundry.data?.SIMPLIFIED_GREGORIAN_CALENDAR_CONFIG;
  const base = {
    nome: T("Comum.gregoriano"), era: "", anoInicial: 0, primeiroDiaSemana: 0,
    horasDia: 24, minutosHora: 60, segundosMinuto: 60,
    semana: [T("Gregoriano.domingo"), T("Gregoriano.segunda_feira"), T("Gregoriano.terca_feira"), T("Gregoriano.quarta_feira"), T("Gregoriano.quinta_feira"), T("Gregoriano.sexta_feira"), T("Gregoriano.sabado")].map((nome) => ({ nome, abrev: nome.slice(0, 3) })),
    meses: [[T("Gregoriano.janeiro"), 31], [T("Gregoriano.fevereiro"), 28, 29], [T("Gregoriano.marco"), 31], [T("Gregoriano.abril"), 30], [T("Gregoriano.maio"), 31], [T("Gregoriano.junho"), 30], [T("Gregoriano.julho"), 31], [T("Gregoriano.agosto"), 31], [T("Gregoriano.setembro"), 30], [T("Gregoriano.outubro"), 31], [T("Gregoriano.novembro"), 30], [T("Gregoriano.dezembro"), 31]]
      .map(([nome, dias, b]) => ({ nome, abrev: nome.slice(0, 3), dias, diasBissexto: b ?? dias })),
    bissexto: { ativo: true, cada: 4, inicio: 0 },
    estacoes: [
      { nome: T("Comum.inverno"), mesInicio: 12, diaInicio: 21, nascer: 7.5, por: 17, icone: "fa-snowflake" },
      { nome: T("Comum.primavera"), mesInicio: 3, diaInicio: 20, nascer: 6, por: 19, icone: "fa-seedling" },
      { nome: T("Comum.verao"), mesInicio: 6, diaInicio: 21, nascer: 5, por: 21, icone: "fa-sun" },
      { nome: T("Comum.outono"), mesInicio: 9, diaInicio: 22, nascer: 6.5, por: 18.5, icone: "fa-leaf" }
    ],
    luas: [{ nome: T("Comum.lua"), ciclo: 29.53, deslocamento: 0, cor: "#e8e4d8" }]
  };
  if (!g?.months?.values?.length) return base;
  try {
    return {
      ...base,
      nome: T("Gregoriano.gregoriano_do_foundry"),
      anoInicial: num(g.years?.yearZero, 0),
      primeiroDiaSemana: num(g.years?.firstWeekday, 0),
      horasDia: num(g.days?.hoursPerDay, 24), minutosHora: num(g.days?.minutesPerHour, 60), segundosMinuto: num(g.days?.secondsPerMinute, 60),
      semana: g.days.values.map((d) => { const nome = traduzir(d.name); return { nome, abrev: nome.slice(0, 3) }; }),
      meses: g.months.values.map((m) => { const nome = traduzir(m.name); return { nome, abrev: nome.slice(0, 3), dias: m.days, diasBissexto: m.leapDays ?? m.days }; }),
      bissexto: { ativo: num(g.years?.leapYear?.leapInterval, 0) > 0, cada: num(g.years?.leapYear?.leapInterval, 4) || 4, inicio: num(g.years?.leapYear?.leapStart, 0) }
    };
  } catch { return base; }
}

/* ---------------- importação de outros calendários ---------------- */

const loc = (t) => { const s = String(t ?? ""); try { return game.i18n?.localize?.(s) ?? s; } catch { return s; } };
const lista = (x) => Array.isArray(x) ? x : Array.isArray(x?.values) ? x.values : x && typeof x === "object" ? Object.values(x) : [];
const nomeDe = (x, i, pref) => loc(x?.name ?? x?.label ?? x?.nome ?? (typeof x === "string" ? x : `${pref} ${i + 1}`));
const abrevDe = (x, nome) => loc(x?.abbreviation ?? x?.abbrev ?? x?.abbr ?? x?.short ?? "") || nome.slice(0, 3);
const ultimoNumero = (v) => { const ns = String(v ?? "").match(/\d+/g); return ns ? Number(ns.at(-1)) : 0; };

/** Conta dias absolutos numa configuração (sem depender do Foundry) — usado para alinhar as luas importadas. */
function diaAbsoluto(c, ano, mes, dia) {
  const diasAno = c.meses.reduce((s, m) => s + m.dias, 0);
  const extra = c.meses.reduce((s, m) => s + (m.diasBissexto - m.dias), 0);
  const b = bisCada(c);
  const ehB = (y) => b > 0 && y >= c.bissexto.inicio && (y - c.bissexto.inicio) % b === 0;
  let bissextos = 0;
  if (b > 0 && ano > c.bissexto.inicio) bissextos = Math.floor((ano - 1 - c.bissexto.inicio) / b) + 1;
  let td = ano * diasAno + bissextos * extra;
  for (let i = 0; i < mes && i < c.meses.length; i++) td += ehB(ano) ? c.meses[i].diasBissexto : c.meses[i].dias;
  return td + dia;
}

/** Converte a data de uma lua nova de referência em "deslocamento" (dia absoluto). */
function deslocamentoDe(c, ref, { anoExibido = true, base1 = true } = {}) {
  if (!ref || typeof ref !== "object") return 0;
  const ano = num(ref.year ?? ref.ano, 0) - (anoExibido ? c.anoInicial : 0);
  const mes = num(ref.month ?? ref.mes, base1 ? 1 : 0) - (base1 ? 1 : 0);
  const dia = num(ref.day ?? ref.dia, base1 ? 1 : 0) - (base1 ? 1 : 0);
  return diaAbsoluto(c, ano, Math.max(0, mes), Math.max(0, dia));
}

/** Monta estações a partir de "mês em que começa" (índice 0..), fechando cada uma no mês antes da próxima. */
function estacoesPorInicio(inicios, nMeses) {
  const ord = [...inicios].sort((a, b) => a.mes - b.mes);
  return ord.map((e, i) => {
    const prox = ord[(i + 1) % ord.length];
    return { nome: e.nome, mesInicio: e.mes + 1, mesFim: mod(prox.mes - 1, nMeses) + 1, nascer: e.nascer ?? 6, por: e.por ?? 18, icone: iconeEstacao(e.nome) };
  });
}

function iconeEstacao(nome) {
  const n = String(nome).toLowerCase();
  if (/inverno|winter|frio|neve|snow/.test(n)) return "fa-snowflake";
  if (/ver[aã]o|summer|calor/.test(n)) return "fa-sun";
  if (/outono|autumn|fall|colheita/.test(n)) return "fa-leaf";
  if (/primavera|spring/.test(n)) return "fa-seedling";
  if (/chuva|rain|mon[cs]/.test(n)) return "fa-cloud-rain";
  return "fa-cloud-sun";
}

const FORMATOS = {
  proprio: "Calendário da Mesa",
  simplecalendar: "Simple Calendar",
  seasonsstars: "Seasons & Stars",
  fantasycalendar: "Fantasy-Calendar.com",
  foundry: "Foundry / Calendaria / D&D 5e"
};

function detectarFormato(o) {
  if (!o || typeof o !== "object") return null;
  if (Array.isArray(o.meses)) return "proprio";
  if (o.static_data?.year_data) return "fantasycalendar";
  if (Array.isArray(o.calendars) && o.calendars.length) return "simplecalendar";
  if (o.monthSettings || o.weekdaySettings || (Array.isArray(o.months) && o.months[0]?.numberOfDays !== undefined)) return "simplecalendar";
  if (Array.isArray(o.months) && (o.weekdays || o.time?.hoursInDay !== undefined || o.year?.epoch !== undefined)) return "seasonsstars";
  if (o.months?.values || o.days?.values || o.config?.months) return "foundry";
  return null;
}

/** Recebe o JSON de outro módulo e devolve { dados, formato, avisos } no formato deste módulo. */
function converterCalendario(entrada) {
  let o = entrada;
  if (o?.config && !o.months && !o.meses) o = o.config;             // entradas do D&D 5e { label, config }
  const formato = detectarFormato(o);
  if (!formato) throw new Error(T("Importar.formato_de_calendario_nao_reconhecido"));
  const avisos = [];
  let c;

  if (formato === "proprio") return { dados: normalizar(o), formato, avisos };

  if (formato === "simplecalendar") {
    let sc = o.calendars ? o.calendars[0] : o;
    if (o.calendars?.length > 1) avisos.push(`${T("Importar.o_arquivo_tem_0_calendarios_importei", [o.calendars.length, sc.name ?? T("Importar.sem_nome")])}`);
    const ms = lista(sc.months ?? sc.monthSettings), ws = lista(sc.weekdays ?? sc.weekdaySettings);
    const ano = sc.year ?? sc.yearSettings ?? {}, tempo = sc.time ?? sc.timeSettings ?? {}, lp = sc.leapYear ?? sc.leapYearSettings ?? {};
    const regra = lp.rule ?? "none";
    c = {
      nome: sc.name ?? T("Importar.importado_do_simple_calendar"),
      era: [ano.prefix, ano.postfix].filter(Boolean).join(" ").trim(),
      anoInicial: num(ano.yearZero, 0),
      primeiroDiaSemana: num(ano.firstWeekday, 0),
      horasDia: num(tempo.hoursInDay, 24), minutosHora: num(tempo.minutesInHour, 60), segundosMinuto: num(tempo.secondsInMinute, 60),
      semana: ws.map((w, i) => { const nome = nomeDe(w, i, T("Comum.dia_2")); return { nome, abrev: abrevDe(w, nome) }; }),
      meses: ms.map((m, i) => { const nome = nomeDe(m, i, T("Comum.mes")); const dias = num(m.numberOfDays ?? m.days, 30); return { nome, abrev: abrevDe(m, nome), dias, diasBissexto: num(m.numberOfLeapYearDays ?? m.leapDays, dias) }; }),
      bissexto: { cada: regra === "gregorian" ? 4 : regra === "custom" ? num(lp.customMod, 0) : 0, inicio: 0 },
      luas: []
    };
    if (ms.some((m) => m.intercalary)) avisos.push(T("Importar.meses_intercalares_viraram_meses_normais"));
    if (regra === "gregorian") avisos.push(T("Importar.a_regra_gregoriana_de_bissexto_virou"));
    const nMeses = c.meses.length;
    c.estacoes = estacoesPorInicio(lista(sc.seasons ?? sc.seasonSettings).map((e, i) => ({
      nome: nomeDe(e, i, T("Comum.estacao")), mes: mod(num(e.startingMonth, 0), nMeses),
      nascer: e.sunriseTime !== undefined ? num(e.sunriseTime) / 3600 : undefined,
      por: e.sunsetTime !== undefined ? num(e.sunsetTime) / 3600 : undefined
    })), nMeses);
    const base = normalizar(c);
    c.luas = lista(sc.moons ?? sc.moonSettings).map((l, i) => ({
      nome: nomeDe(l, i, T("Comum.lua")), ciclo: num(l.cycleLength, 29.5), cor: l.color,
      deslocamento: deslocamentoDe(base, l.firstNewMoon, { anoExibido: true, base1: false }) + num(l.cycleDayAdjust, 0)
    }));
  }

  else if (formato === "seasonsstars") {
    const lab = o.translations?.[game.i18n.lang]?.label ?? o.translations?.["pt-BR"]?.label ?? o.translations?.pt?.label ?? o.translations?.en?.label;
    const ano = o.year ?? {}, tempo = o.time ?? {}, lp = o.leapYear ?? {};
    let ms = o.months.map((m, i) => { const nome = nomeDe(m, i, T("Comum.mes")); const dias = num(m.days ?? m.length, 30); return { nome, abrev: abrevDe(m, nome), dias, diasBissexto: dias }; });
    // dias intercalares (S&S) entram como meses curtos depois do mês indicado
    const inter = lista(o.intercalary);
    if (inter.length) {
      for (const it of [...inter].reverse()) {
        const pos = o.months.findIndex((m) => m.name === it.after);
        const nome = nomeDe(it, 0, T("Importar.intercalar")), dias = num(it.days, 1);
        ms.splice(pos >= 0 ? pos + 1 : ms.length, 0, { nome, abrev: abrevDe(it, nome), dias, diasBissexto: dias });
      }
      avisos.push(T("Importar.dias_intercalares_viraram_meses_curtos"));
    }
    const regra = lp.rule ?? "none";
    if (regra !== "none") {
      const alvo = ms.find((m) => m.nome === loc(lp.month)) ?? ms.find((m) => m.dias === 28) ?? ms[1] ?? ms[0];
      if (alvo) alvo.diasBissexto = alvo.dias + num(lp.extraDays, 1);
    }
    c = {
      nome: loc(lab ?? o.name ?? o.id ?? T("Importar.importado_do_seasons_stars")),
      era: [ano.prefix, ano.suffix].filter(Boolean).join(" ").trim(),
      anoInicial: num(ano.epoch, 0),
      primeiroDiaSemana: num(ano.startDay, 0),
      horasDia: num(tempo.hoursInDay, 24), minutosHora: num(tempo.minutesInHour, 60), segundosMinuto: num(tempo.secondsInMinute, 60),
      semana: lista(o.weekdays).map((w, i) => { const nome = nomeDe(w, i, T("Comum.dia_2")); return { nome, abrev: abrevDe(w, nome) }; }),
      meses: ms,
      bissexto: { cada: regra === "gregorian" ? 4 : regra === "custom" ? num(lp.interval, 0) : 0, inicio: 0 },
      luas: []
    };
    if (regra === "gregorian") avisos.push(T("Importar.a_regra_gregoriana_de_bissexto_virou"));
    const nomes = c.meses.map((m) => m.nome);
    const idxMes = (v) => typeof v === "number" ? v : Math.max(0, nomes.indexOf(loc(v)) + 1);
    c.estacoes = lista(o.seasons).map((e, i) => ({
      nome: nomeDe(e, i, T("Comum.estacao")), mesInicio: idxMes(e.startMonth) || 1, mesFim: idxMes(e.endMonth ?? e.startMonth) || 1,
      nascer: e.sunrise ?? 6, por: e.sunset ?? 18, icone: iconeEstacao(nomeDe(e, i, ""))
    }));
    const base = normalizar(c);
    c.luas = lista(o.moons).map((l, i) => ({
      nome: nomeDe(l, i, T("Comum.lua")), ciclo: num(l.cycleLength, 29.5), cor: l.color,
      deslocamento: deslocamentoDe(base, l.firstNewMoon, { anoExibido: true, base1: true })
    }));
  }

  else if (formato === "fantasycalendar") {
    const sd = o.static_data, yd = sd.year_data;
    const spans = lista(yd.timespans);
    const ms = spans.map((t, i) => { const nome = nomeDe(t, i, T("Comum.mes")); const dias = num(t.length, 30); return { nome, abrev: nome.slice(0, 3), dias, diasBissexto: dias }; });
    if (spans.some((t) => t.type === "intercalary")) avisos.push(T("Importar.meses_intercalares_viraram_meses_normais"));
    if (spans.some((t) => num(t.interval, 1) > 1)) avisos.push(T("Importar.meses_que_so_existem_em_alguns"));
    let cada = 0;
    for (const ld of lista(yd.leap_days)) {
      const m = ms[num(ld.timespan, 0)];
      if (m) m.diasBissexto += 1;
      cada = cada || ultimoNumero(ld.interval);
    }
    if (lista(yd.leap_days).some((ld) => /[,!]/.test(String(ld.interval)))) avisos.push(T("Importar.regras_de_bissexto_com_excecoes_viraram"));
    const sem = lista(yd.global_week);
    const clock = sd.clock ?? {};
    c = {
      nome: o.name ?? T("Importar.importado_do_fantasy_calendar"),
      era: "",
      anoInicial: 0,
      primeiroDiaSemana: Math.max(0, num(yd.first_day, 1) - 1),
      horasDia: num(clock.hours, 24), minutosHora: num(clock.minutes, 60), segundosMinuto: 60,
      semana: sem.map((w, i) => { const nome = nomeDe(w, i, T("Comum.dia_2")); return { nome, abrev: nome.slice(0, 3) }; }),
      meses: ms,
      bissexto: { cada, inicio: 0 },
      luas: lista(sd.moons).map((l, i) => ({ nome: nomeDe(l, i, T("Comum.lua")), ciclo: num(l.cycle, 29.5), deslocamento: num(l.shift, 0), cor: l.color }))
    };
    const nMeses = c.meses.length;
    c.estacoes = estacoesPorInicio(lista(sd.seasons?.data).map((e, i) => ({
      nome: nomeDe(e, i, T("Comum.estacao")), mes: mod(num(e.timespan, 0), nMeses),
      nascer: e.time?.sunrise ? num(e.time.sunrise.hour, 6) + num(e.time.sunrise.minute, 0) / 60 : undefined,
      por: e.time?.sunset ? num(e.time.sunset.hour, 18) + num(e.time.sunset.minute, 0) / 60 : undefined
    })), nMeses);
    if (o.dynamic_data?.year !== undefined) avisos.push(`${T("Importar.o_ano_atual_no_fantasy_calendar", [o.dynamic_data.year])}`);
  }

  else { // formato do Foundry (CalendarConfig), usado pelo D&D 5e e por módulos como o Calendaria
    const ms = lista(o.months);
    const ws = lista(o.days?.values ?? o.weekdays);
    const lp = o.years?.leapYear;
    c = {
      nome: loc(o.name ?? T("Comum.calendario_importado")),
      era: "",
      anoInicial: num(o.years?.yearZero, 0),
      primeiroDiaSemana: num(o.years?.firstWeekday, 0),
      horasDia: num(o.days?.hoursPerDay, 24), minutosHora: num(o.days?.minutesPerHour, 60), segundosMinuto: num(o.days?.secondsPerMinute, 60),
      semana: ws.map((w, i) => { const nome = nomeDe(w, i, T("Comum.dia_2")); return { nome, abrev: abrevDe(w, nome) }; }),
      meses: ms.map((m, i) => { const nome = nomeDe(m, i, T("Comum.mes")); const dias = num(m.days, 30); return { nome, abrev: abrevDe(m, nome), dias, diasBissexto: num(m.leapDays, dias) }; }),
      bissexto: { cada: num(lp?.leapInterval, 0), inicio: num(lp?.leapStart, 0) },
      luas: []
    };
    if (ms.some((m) => m.intercalary)) avisos.push(T("Importar.meses_intercalares_viraram_meses_normais"));
    c.estacoes = lista(o.seasons).map((e, i) => {
      const nome = nomeDe(e, i, T("Comum.estacao"));
      let ini = e.monthStart;
      let diaIni = 1;
      if (ini == null && e.dayStart != null) { // estação por dia do ano → dia e mês exatos
        let d = num(e.dayStart), k = 0;
        while (k < c.meses.length - 1 && d >= c.meses[k].dias) { d -= c.meses[k].dias; k++; }
        ini = k + 1; diaIni = d + 1;
      }
      return { nome, mesInicio: num(ini, 1), diaInicio: diaIni, nascer: 6, por: 18, icone: iconeEstacao(nome) };
    });
    const base = normalizar(c);
    c.luas = lista(o.moons).map((l, i) => ({
      nome: nomeDe(l, i, T("Comum.lua")), ciclo: num(l.cycleLength ?? l.cycle, 29.5), cor: l.color,
      deslocamento: l.referenceDate ? deslocamentoDe(base, l.referenceDate, { anoExibido: true, base1: false }) + num(l.cycleDayAdjust, 0) : num(l.offset, 0)
    }));
    if (!ws.length) avisos.push(T("Importar.o_calendario_nao_tinha_dias_da"));
  }

  if (!c.meses?.length) throw new Error(T("Importar.o_calendario_importado_nao_tem_meses"));
  if (!c.semana?.length) delete c.semana;
  return { dados: normalizar(c), formato, avisos };
}

/** Procura calendários de outros módulos e do sistema que estão carregados neste mundo. */
function fontesDoMundo() {
  const f = [];
  const add = (rotulo, fn) => { try { const d = fn(); if (d) f.push({ rotulo, dados: d }); } catch (err) { console.warn(`${MOD} | ${rotulo}`, err); } };
  if (CAL_ANTERIOR) add(T("Importar.calendario_que_estava_ativo_antes_0", [loc(CAL_ANTERIOR.name ?? T("Importar.sistema"))]), () => CAL_ANTERIOR);
  if (game.modules.get("foundryvtt-simple-calendar")?.active || game.modules.get("foundryvtt-simple-calendar-reborn")?.active)
    add(T("Importar.simple_calendar_calendario_atual"), () => globalThis.SimpleCalendar?.api?.getCurrentCalendar?.());
  if (game.modules.get("seasons-and-stars")?.active)
    add(T("Importar.seasons_stars_calendario_ativo"), () => game.seasonsStars?.manager?.getActiveCalendar?.());
  if (game.modules.get("calendaria")?.active) {
    const api = globalThis.CALENDARIA?.api;
    add(T("Importar.calendaria_calendario_ativo"), () => api?.getActiveCalendar?.() ?? api?.getCalendar?.());
  }
  for (const k of lista(CONFIG.DND5E?.calendar?.calendars)) {
    add(`D&D 5e: ${loc(k.label ?? k.config?.name ?? k.value ?? T("Importar.calendario"))}`, () => k.config ?? k);
  }
  // remove repetidos e converte classes/modelos em objetos simples
  return f.map((x) => ({ ...x, dados: typeof x.dados?.toObject === "function" ? x.dados.toObject() : x.dados }))
    .filter((x) => { try { return !!detectarFormato(x.dados?.config ?? x.dados); } catch { return false; } });
}

/* ---------------- notas acompanham mudanças no calendário ---------------- */

/** Guarda ano/mês/dia de cada nota de um calendário, na configuração antiga. */
function datasDasNotas(id, config) {
  const alvo = game.journal.filter((j) => { const r = j.getFlag(MOD, "nota"); return r && calDaNota(r) === id; });
  return comConfig(config, id, () => alvo.map((j) => {
    const r = j.getFlag(MOD, "nota");
    const data = (td) => (Number.isFinite(Number(td)) ? (({ ano, mes, dia }) => ({ ano, mes, dia }))(infoDia(Math.trunc(Number(td)))) : null);
    return { j, td: Math.trunc(Number(r.td)), inicio: data(r.td), fim: r.fim?.td != null ? data(r.fim.td) : null, excecoes: (r.excecoes ?? []).map(data).filter(Boolean) };
  }));
}

/** Recoloca as notas na mesma data (ano/mês/dia) usando a configuração nova. */
async function reposicionarNotas(antes, id, config) {
  const upds = comConfig(config, id, () => antes.map(({ j, td, inicio, fim, excecoes }) => {
    const conv = (x) => {
      const mes = mesProximoQueExiste(x.ano, Math.min(x.mes, CFG.meses.length - 1));
      return tdDe(x.ano, mes, Math.min(x.dia, diasNoMes(x.ano, mes) - 1));
    };
    const novoTd = conv(inicio);
    if (novoTd === td) return null;
    const u = { _id: j.id, [`flags.${MOD}.nota.td`]: novoTd };
    if (fim) u[`flags.${MOD}.nota.fim.td`] = conv(fim);
    if (excecoes.length) u[`flags.${MOD}.nota.excecoes`] = excecoes.map(conv);
    return u;
  }).filter(Boolean));
  if (upds.length) await JournalEntry.updateDocuments(upds);
  return upds.length;
}

export {
  converterCalendario,
  datasDasNotas,
  fontesDoMundo,
  FORMATOS,
  presetGregoriano,
  reposicionarNotas
};
