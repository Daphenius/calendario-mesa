/* =========================================================
 * Calendário da Mesa — ferramentas (carregado sob demanda)
 * Editor, importação, luz por hora, histórico, contadores,
 * viagem, clima e dias sagrados.
 * ========================================================= */

/* O núcleo é pego pelo mesmo endereço com que o Foundry o carregou, para usar a mesma instância. */
const N = await import(globalThis.__calendarioMesaURL ?? "./calendario.js");
const { T, K } = N;
const {
  ANOMALIAS,
  ANTIGOS,
  AVISOS,
  ApplicationV2,
  BaseComportamento,
  CACHE_CAL,
  CACHE_FIM,
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
  TIPO_CLIMA,
  UNIDADES,
  UNIDADE_SING,
  ZONAS,
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
  zonasEmUso,
  GRUPOS_CLIMA,
  efeitoDoClima,
  mensagemClima,
  DURACAO_VIGIA_H,
  alterarContadores,
  alterarHistorico,
  alterarViagem,
  gruposDaVigia,
  horarioVigia,
  nomeDoJogador,
  relatarErro,
  segVigia,
  viagemAtual
} = N;
const { HandlebarsApplicationMixin } = foundry.applications.api;
const TRAD = {
  January: "Janeiro", February: "Fevereiro", March: "Março", April: "Abril", May: "Maio", June: "Junho",
  July: "Julho", August: "Agosto", September: "Setembro", October: "Outubro", November: "Novembro", December: "Dezembro",
  Monday: "Segunda-feira", Tuesday: "Terça-feira", Wednesday: "Quarta-feira", Thursday: "Quinta-feira",
  Friday: "Sexta-feira", Saturday: "Sábado", Sunday: "Domingo"
};
const traduzir = (n) => {
  const loc = game.i18n?.localize?.(n) ?? n;
  return TRAD[loc] ?? TRAD[String(n).split(".").pop()] ?? loc;
};

function presetGregoriano() {
  const g = foundry.data?.SIMPLIFIED_GREGORIAN_CALENDAR_CONFIG;
  const base = {
    nome: "Gregoriano", era: "", anoInicial: 0, primeiroDiaSemana: 0,
    horasDia: 24, minutosHora: 60, segundosMinuto: 60,
    semana: ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"].map((nome) => ({ nome, abrev: nome.slice(0, 3) })),
    meses: [["Janeiro", 31], ["Fevereiro", 28, 29], ["Março", 31], ["Abril", 30], ["Maio", 31], ["Junho", 30], ["Julho", 31], ["Agosto", 31], ["Setembro", 30], ["Outubro", 31], ["Novembro", 30], ["Dezembro", 31]]
      .map(([nome, dias, b]) => ({ nome, abrev: nome.slice(0, 3), dias, diasBissexto: b ?? dias })),
    bissexto: { ativo: true, cada: 4, inicio: 0 },
    estacoes: [
      { nome: "Inverno", mesInicio: 12, diaInicio: 21, nascer: 7.5, por: 17, icone: "fa-snowflake" },
      { nome: "Primavera", mesInicio: 3, diaInicio: 20, nascer: 6, por: 19, icone: "fa-seedling" },
      { nome: "Verão", mesInicio: 6, diaInicio: 21, nascer: 5, por: 21, icone: "fa-sun" },
      { nome: "Outono", mesInicio: 9, diaInicio: 22, nascer: 6.5, por: 18.5, icone: "fa-leaf" }
    ],
    luas: [{ nome: "Lua", ciclo: 29.53, deslocamento: 0, cor: "#e8e4d8" }]
  };
  if (!g?.months?.values?.length) return base;
  try {
    return {
      ...base,
      nome: "Gregoriano (do Foundry)",
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
  if (!formato) throw new Error("Formato de calendário não reconhecido.");
  const avisos = [];
  let c;

  if (formato === "proprio") return { dados: normalizar(o), formato, avisos };

  if (formato === "simplecalendar") {
    let sc = o.calendars ? o.calendars[0] : o;
    if (o.calendars?.length > 1) avisos.push(`O arquivo tem ${o.calendars.length} calendários; importei o primeiro ("${sc.name ?? "sem nome"}").`);
    const ms = lista(sc.months ?? sc.monthSettings), ws = lista(sc.weekdays ?? sc.weekdaySettings);
    const ano = sc.year ?? sc.yearSettings ?? {}, tempo = sc.time ?? sc.timeSettings ?? {}, lp = sc.leapYear ?? sc.leapYearSettings ?? {};
    const regra = lp.rule ?? "none";
    c = {
      nome: sc.name ?? "Importado do Simple Calendar",
      era: [ano.prefix, ano.postfix].filter(Boolean).join(" ").trim(),
      anoInicial: num(ano.yearZero, 0),
      primeiroDiaSemana: num(ano.firstWeekday, 0),
      horasDia: num(tempo.hoursInDay, 24), minutosHora: num(tempo.minutesInHour, 60), segundosMinuto: num(tempo.secondsInMinute, 60),
      semana: ws.map((w, i) => { const nome = nomeDe(w, i, "Dia"); return { nome, abrev: abrevDe(w, nome) }; }),
      meses: ms.map((m, i) => { const nome = nomeDe(m, i, "Mês"); const dias = num(m.numberOfDays ?? m.days, 30); return { nome, abrev: abrevDe(m, nome), dias, diasBissexto: num(m.numberOfLeapYearDays ?? m.leapDays, dias) }; }),
      bissexto: { cada: regra === "gregorian" ? 4 : regra === "custom" ? num(lp.customMod, 0) : 0, inicio: 0 },
      luas: []
    };
    if (ms.some((m) => m.intercalary)) avisos.push("Meses intercalares viraram meses normais.");
    if (regra === "gregorian") avisos.push("A regra gregoriana de bissexto virou \"a cada 4 anos\".");
    const nMeses = c.meses.length;
    c.estacoes = estacoesPorInicio(lista(sc.seasons ?? sc.seasonSettings).map((e, i) => ({
      nome: nomeDe(e, i, "Estação"), mes: mod(num(e.startingMonth, 0), nMeses),
      nascer: e.sunriseTime !== undefined ? num(e.sunriseTime) / 3600 : undefined,
      por: e.sunsetTime !== undefined ? num(e.sunsetTime) / 3600 : undefined
    })), nMeses);
    const base = normalizar(c);
    c.luas = lista(sc.moons ?? sc.moonSettings).map((l, i) => ({
      nome: nomeDe(l, i, "Lua"), ciclo: num(l.cycleLength, 29.5), cor: l.color,
      deslocamento: deslocamentoDe(base, l.firstNewMoon, { anoExibido: true, base1: false }) + num(l.cycleDayAdjust, 0)
    }));
  }

  else if (formato === "seasonsstars") {
    const lab = o.translations?.["pt-BR"]?.label ?? o.translations?.pt?.label ?? o.translations?.en?.label;
    const ano = o.year ?? {}, tempo = o.time ?? {}, lp = o.leapYear ?? {};
    let ms = o.months.map((m, i) => { const nome = nomeDe(m, i, "Mês"); const dias = num(m.days ?? m.length, 30); return { nome, abrev: abrevDe(m, nome), dias, diasBissexto: dias }; });
    // dias intercalares (S&S) entram como meses curtos depois do mês indicado
    const inter = lista(o.intercalary);
    if (inter.length) {
      for (const it of [...inter].reverse()) {
        const pos = o.months.findIndex((m) => m.name === it.after);
        const nome = nomeDe(it, 0, "Intercalar"), dias = num(it.days, 1);
        ms.splice(pos >= 0 ? pos + 1 : ms.length, 0, { nome, abrev: abrevDe(it, nome), dias, diasBissexto: dias });
      }
      avisos.push("Dias intercalares viraram meses curtos.");
    }
    const regra = lp.rule ?? "none";
    if (regra !== "none") {
      const alvo = ms.find((m) => m.nome === loc(lp.month)) ?? ms.find((m) => m.dias === 28) ?? ms[1] ?? ms[0];
      if (alvo) alvo.diasBissexto = alvo.dias + num(lp.extraDays, 1);
    }
    c = {
      nome: loc(lab ?? o.name ?? o.id ?? "Importado do Seasons & Stars"),
      era: [ano.prefix, ano.suffix].filter(Boolean).join(" ").trim(),
      anoInicial: num(ano.epoch, 0),
      primeiroDiaSemana: num(ano.startDay, 0),
      horasDia: num(tempo.hoursInDay, 24), minutosHora: num(tempo.minutesInHour, 60), segundosMinuto: num(tempo.secondsInMinute, 60),
      semana: lista(o.weekdays).map((w, i) => { const nome = nomeDe(w, i, "Dia"); return { nome, abrev: abrevDe(w, nome) }; }),
      meses: ms,
      bissexto: { cada: regra === "gregorian" ? 4 : regra === "custom" ? num(lp.interval, 0) : 0, inicio: 0 },
      luas: []
    };
    if (regra === "gregorian") avisos.push("A regra gregoriana de bissexto virou \"a cada 4 anos\".");
    const nomes = c.meses.map((m) => m.nome);
    const idxMes = (v) => typeof v === "number" ? v : Math.max(0, nomes.indexOf(loc(v)) + 1);
    c.estacoes = lista(o.seasons).map((e, i) => ({
      nome: nomeDe(e, i, "Estação"), mesInicio: idxMes(e.startMonth) || 1, mesFim: idxMes(e.endMonth ?? e.startMonth) || 1,
      nascer: e.sunrise ?? 6, por: e.sunset ?? 18, icone: iconeEstacao(nomeDe(e, i, ""))
    }));
    const base = normalizar(c);
    c.luas = lista(o.moons).map((l, i) => ({
      nome: nomeDe(l, i, "Lua"), ciclo: num(l.cycleLength, 29.5), cor: l.color,
      deslocamento: deslocamentoDe(base, l.firstNewMoon, { anoExibido: true, base1: true })
    }));
  }

  else if (formato === "fantasycalendar") {
    const sd = o.static_data, yd = sd.year_data;
    const spans = lista(yd.timespans);
    const ms = spans.map((t, i) => { const nome = nomeDe(t, i, "Mês"); const dias = num(t.length, 30); return { nome, abrev: nome.slice(0, 3), dias, diasBissexto: dias }; });
    if (spans.some((t) => t.type === "intercalary")) avisos.push("Meses intercalares viraram meses normais.");
    if (spans.some((t) => num(t.interval, 1) > 1)) avisos.push("Meses que só existem em alguns anos foram importados como meses de todo ano.");
    let cada = 0;
    for (const ld of lista(yd.leap_days)) {
      const m = ms[num(ld.timespan, 0)];
      if (m) m.diasBissexto += 1;
      cada = cada || ultimoNumero(ld.interval);
    }
    if (lista(yd.leap_days).some((ld) => /[,!]/.test(String(ld.interval)))) avisos.push("Regras de bissexto com exceções viraram só o intervalo principal.");
    const sem = lista(yd.global_week);
    const clock = sd.clock ?? {};
    c = {
      nome: o.name ?? "Importado do Fantasy-Calendar",
      era: "",
      anoInicial: 0,
      primeiroDiaSemana: Math.max(0, num(yd.first_day, 1) - 1),
      horasDia: num(clock.hours, 24), minutosHora: num(clock.minutes, 60), segundosMinuto: 60,
      semana: sem.map((w, i) => { const nome = nomeDe(w, i, "Dia"); return { nome, abrev: nome.slice(0, 3) }; }),
      meses: ms,
      bissexto: { cada, inicio: 0 },
      luas: lista(sd.moons).map((l, i) => ({ nome: nomeDe(l, i, "Lua"), ciclo: num(l.cycle, 29.5), deslocamento: num(l.shift, 0), cor: l.color }))
    };
    const nMeses = c.meses.length;
    c.estacoes = estacoesPorInicio(lista(sd.seasons?.data).map((e, i) => ({
      nome: nomeDe(e, i, "Estação"), mes: mod(num(e.timespan, 0), nMeses),
      nascer: e.time?.sunrise ? num(e.time.sunrise.hour, 6) + num(e.time.sunrise.minute, 0) / 60 : undefined,
      por: e.time?.sunset ? num(e.time.sunset.hour, 18) + num(e.time.sunset.minute, 0) / 60 : undefined
    })), nMeses);
    if (o.dynamic_data?.year !== undefined) avisos.push(`O ano atual no Fantasy-Calendar era ${o.dynamic_data.year}. Ajuste "Primeiro ano" ou use "Tornar este o dia atual".`);
  }

  else { // formato do Foundry (CalendarConfig), usado pelo D&D 5e e por módulos como o Calendaria
    const ms = lista(o.months);
    const ws = lista(o.days?.values ?? o.weekdays);
    const lp = o.years?.leapYear;
    c = {
      nome: loc(o.name ?? "Calendário importado"),
      era: "",
      anoInicial: num(o.years?.yearZero, 0),
      primeiroDiaSemana: num(o.years?.firstWeekday, 0),
      horasDia: num(o.days?.hoursPerDay, 24), minutosHora: num(o.days?.minutesPerHour, 60), segundosMinuto: num(o.days?.secondsPerMinute, 60),
      semana: ws.map((w, i) => { const nome = nomeDe(w, i, "Dia"); return { nome, abrev: abrevDe(w, nome) }; }),
      meses: ms.map((m, i) => { const nome = nomeDe(m, i, "Mês"); const dias = num(m.days, 30); return { nome, abrev: abrevDe(m, nome), dias, diasBissexto: num(m.leapDays, dias) }; }),
      bissexto: { cada: num(lp?.leapInterval, 0), inicio: num(lp?.leapStart, 0) },
      luas: []
    };
    if (ms.some((m) => m.intercalary)) avisos.push("Meses intercalares viraram meses normais.");
    c.estacoes = lista(o.seasons).map((e, i) => {
      const nome = nomeDe(e, i, "Estação");
      let ini = e.monthStart, fim = e.monthEnd;
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
      nome: nomeDe(l, i, "Lua"), ciclo: num(l.cycleLength ?? l.cycle, 29.5), cor: l.color,
      deslocamento: l.referenceDate ? deslocamentoDe(base, l.referenceDate, { anoExibido: true, base1: false }) + num(l.cycleDayAdjust, 0) : num(l.offset, 0)
    }));
    if (!ws.length) avisos.push("O calendário não tinha dias da semana; usei os do exemplo.");
  }

  if (!c.meses?.length) throw new Error("O calendário importado não tem meses.");
  if (!c.semana?.length) delete c.semana;
  return { dados: normalizar(c), formato, avisos };
}

/** Procura calendários de outros módulos e do sistema que estão carregados neste mundo. */
function fontesDoMundo() {
  const f = [];
  const add = (rotulo, fn) => { try { const d = fn(); if (d) f.push({ rotulo, dados: d }); } catch (err) { console.warn(`${MOD} | ${rotulo}`, err); } };
  if (N.CAL_ANTERIOR) add(`Calendário que estava ativo antes (${loc(N.CAL_ANTERIOR.name ?? "sistema")})`, () => N.CAL_ANTERIOR);
  if (game.modules.get("foundryvtt-simple-calendar")?.active || game.modules.get("foundryvtt-simple-calendar-reborn")?.active)
    add("Simple Calendar (calendário atual)", () => globalThis.SimpleCalendar?.api?.getCurrentCalendar?.());
  if (game.modules.get("seasons-and-stars")?.active)
    add("Seasons & Stars (calendário ativo)", () => game.seasonsStars?.manager?.getActiveCalendar?.());
  if (game.modules.get("calendaria")?.active) {
    const api = globalThis.CALENDARIA?.api;
    add("Calendaria (calendário ativo)", () => api?.getActiveCalendar?.() ?? api?.getCalendar?.());
  }
  for (const k of lista(CONFIG.DND5E?.calendar?.calendars)) {
    add(`D&D 5e: ${loc(k.label ?? k.config?.name ?? k.value ?? "calendário")}`, () => k.config ?? k);
  }
  // remove repetidos e converte classes/modelos em objetos simples
  return f.map((x) => ({ ...x, dados: typeof x.dados?.toObject === "function" ? x.dados.toObject() : x.dados }))
    .filter((x) => { try { return !!detectarFormato(x.dados?.config ?? x.dados); } catch { return false; } });
}




async function dialogoNota(td, j = null) {
  const n = j ? dadosNota(j) : normalizarNota({ td, hora: "", repetir: "nao", cada: 1, cor: "#c9a227", icone: "fa-star", aviso: "nenhum" });
  const gm = game.user.isGM;
  const verAtual = j ? (j.ownership.default >= 2 ? "todos" : j.ownership.default >= 1 ? "titulo" : "mestre") : (gm ? "mestre" : "todos");
  const opts = (obj, sel) => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${esc(v)}</option>`).join("");
  const ver = gm
    ? { mestre: "Só o mestre", titulo: "Jogadores veem só o título", todos: "Jogadores veem tudo" }
    : { mestre: "Só eu (e o mestre)", todos: "Todos os jogadores" };

  const padrao = j ? (j.folder?.id ?? "") : game.settings.get(MOD, "pastaNotas");
  const pastas = game.folders.filter((f) => f.type === "JournalEntry" && !f.getFlag(MOD, "pasta"))
    .map((f) => ({ id: f.id, nome: caminhoPasta(f) })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const seletorPasta = gm ? `
      <div class="cm-form-2">
        <label>Pasta no Diário/Journal<select name="pasta">
          <option value="" ${!padrao || !game.folders.get(padrao) ? "selected" : ""}>Calendário (padrão)</option>
          ${pastas.map((f) => `<option value="${f.id}" ${f.id === padrao ? "selected" : ""}>${esc(f.nome)}</option>`).join("")}
          <option value="__nova">+ Nova pasta…</option>
        </select></label>
        <label>Nome da nova pasta<input type="text" name="novaPasta" placeholder="Só se escolher Nova pasta"></label>
      </div>` : "";

  const content = `
    <div class="cm-form">
      <p class="cm-form-data"><i class="fa-solid fa-calendar-day"></i> ${esc(textoData(infoDia(j ? n.td : td)))}</p>
      <label>Título<input type="text" name="nome" value="${esc(j?.name ?? "")}" placeholder="Festival da Maré, Prazo da missão..." autofocus></label>
      <div class="cm-form-2">
        <label>Hora (opcional)<input type="text" name="hora" value="${esc(n.hora)}" placeholder="HH:MM"></label>
        <label>Dura quantos dias<input type="number" name="duracao" min="1" value="${n.duracao}"></label>
      </div>
      <div class="cm-form-2">
        <label>Ícone<select name="icone">${opts(ICONES, n.icone)}</select></label>
      </div>
      <div class="cm-form-2">
        <label>Quem vê<select name="ver">${opts(ver, verAtual)}</select></label>
        <label>Cor<input type="color" name="cor" value="${n.cor}"></label>
      </div>
      ${gm ? `<label>Quando chegar o dia<select name="aviso">${opts(AVISOS, n.aviso)}</select></label>` : ""}
      ${seletorPasta}
      ${n.repetir !== "nao" ? `<p class="cm-dica"><i class="fa-solid fa-repeat"></i> ${esc(descreverRepeticao(n))}. A repetição é editada no Journal da Mesa.</p>` : ""}
      ${j ? `<p class="cm-dica">Para editar o texto, abra a nota. Para mudar o dia, arraste a nota para outro dia no calendário.</p>`
          : `<label>Texto<textarea name="texto" rows="4" placeholder="Detalhes do evento (opcional)"></textarea></label>`}
    </div>`;

  const dados = await Dialogo().wait({
    window: { title: j ? "Editar nota" : "Nova nota", icon: "fa-solid fa-calendar-plus" },
    position: { width: 500 },
    content,
    buttons: [
      { action: "ok", label: "Salvar", icon: "fa-solid fa-check", default: true, callback: (ev, btn) => Object.fromEntries(new FormData(btn.form)) },
      { action: "cancelar", label: "Cancelar", icon: "fa-solid fa-xmark" }
    ],
    rejectClose: false
  });
  if (!dados || typeof dados !== "object") return;

  const nome = String(dados.nome ?? "").trim() || "Evento";
  const inicio = j ? n.td : td;
  // só os campos que o calendário edita; a repetição (repetir, cada...) é do Journal e nunca é regravada aqui
  const campos = {
    hora: /^\d{1,2}:\d{2}$/.test(String(dados.hora ?? "").trim()) ? String(dados.hora).trim() : "",
    duracao: Math.max(1, Math.trunc(num(dados.duracao, 1))),
    cor: dados.cor || "#c9a227",
    icone: ICONES[dados.icone] ? dados.icone : "fa-star",
    aviso: gm ? (AVISOS[dados.aviso] ? dados.aviso : "nenhum") : (n.aviso ?? "nenhum")
  };
  const nivel = { mestre: 0, titulo: 1, todos: 2 }[dados.ver] ?? 0;

  if (j) {
    const upd = { name: nome, "ownership.default": nivel };
    for (const [k, v] of Object.entries(campos)) upd[`flags.${MOD}.nota.${k}`] = v;
    if (gm && (dados.pasta ?? "") !== (j.folder?.id ?? "") && !(dados.pasta === "" && j.folder?.getFlag(MOD, "pasta"))) {
      upd.folder = (await pastaParaNota(dados.pasta ?? "", String(dados.novaPasta ?? "").trim(), n.td))?.id ?? null;
    }
    await j.update(upd);
    return j;
  }
  const pasta = await pastaParaNota(dados.pasta ?? "", String(dados.novaPasta ?? "").trim(), td);
  const texto = String(dados.texto ?? "").trim();
  const ownership = { default: nivel };
  if (!gm) ownership[game.user.id] = 3;
  return JournalEntry.create({
    name: nome,
    folder: pasta?.id ?? null,
    ownership,
    flags: { [MOD]: { nota: notaNova(inicio, campos) } },
    pages: [paginaDeEvento(nome, texto ? texto.split(/\n+/).map((l) => `<p>${esc(l)}</p>`).join("") : "")]
  });
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
      const mes = mesProximoQueExiste(x.ano, Math.min(x.mes, N.CFG.meses.length - 1));
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


/* ---------------- editor do calendário ---------------- */

/** Valor de um campo do editor já no tipo certo. */
function valorDoCampo(el, dados) {
  if (el.type === "checkbox") return el.checked;
  if (el.dataset.desloca) return num(el.value) - num(dados.anoInicial);   // ano exibido → ano interno
  if (el.dataset.n) return num(el.value);
  return el.value;
}

/** Lembra qual campo estava com o cursor (e a seleção) antes de redesenhar uma janela. */
function lerFoco(raiz) {
  const el = document.activeElement;
  if (!el || !raiz.contains(el)) return null;
  let sel = null;
  if (el.dataset?.caminho) sel = `[data-caminho="${CSS.escape(el.dataset.caminho)}"]`;
  else if (el.dataset?.action) sel = `[data-action="${CSS.escape(el.dataset.action)}"]${el.dataset.i != null ? `[data-i="${CSS.escape(el.dataset.i)}"]` : ""}${el.dataset.lista ? `[data-lista="${CSS.escape(el.dataset.lista)}"]` : ""}`;
  else if (el.classList.length) sel = `.${[...el.classList].map((c) => CSS.escape(c)).join(".")}`;
  if (!sel) return null;
  let ini = null, fim = null;
  try { ini = el.selectionStart; fim = el.selectionEnd; } catch { /* selects e números não têm seleção */ }
  return { sel, ini, fim };
}

function voltarFoco(raiz, foco) {
  if (!foco) return;
  const el = raiz.querySelector(foco.sel);
  if (!el) return;
  el.focus({ preventScroll: true });
  try { if (foco.ini != null && el.setSelectionRange) el.setSelectionRange(foco.ini, foco.fim); } catch { /* sem seleção */ }
}

class EditorCalendario extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "cm-editor",
    classes: ["cm-janela"],
    tag: "div",
    window: { title: "Editar calendário", icon: "fa-solid fa-gear", resizable: true },
    position: { width: 760, height: 720 },
    actions: {
      add(ev, t) { (this.dados[t.dataset.lista] ??= []).push(this.novo(t.dataset.lista)); this.render(); },
      rem(ev, t) { const l = this.dados[t.dataset.lista]; if (l.length > 1 || ["estacoes", "luas", "eras"].includes(t.dataset.lista)) l.splice(num(t.dataset.i), 1); this.render(); },
      async irData() { await this.irParaData(); },
      hojeData() { this.render(); },
      subir(ev, t) { const l = this.dados[t.dataset.lista], i = num(t.dataset.i); if (i > 0) [l[i - 1], l[i]] = [l[i], l[i - 1]]; this.render(); },
      preset(ev, t) { this.dados = normalizar(t.dataset.p === "gregoriano" ? presetGregoriano() : PRESET_ELEMENTOS); this.render(); },
      exportar() {
        const salvar = foundry.utils.saveDataToFile ?? globalThis.saveDataToFile;
        salvar(JSON.stringify(this.dados, null, 2), "application/json", `calendario-${this.dados.nome.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`);
      },
      importar() { this.element.querySelector("input.cm-arquivo")?.click(); },
      salvar() { this.salvar(); },
      apHoje(ev, t) {
        const l = this.dados.luas[num(t.dataset.i)];
        if (!l) return;
        // usa a configuração em edição para contar meses/anos
        const anoInicial = num(this.dados.anoInicial, 0), nMeses = this.dados.meses.length;
        const i = infoDia(agora().td);
        l.aparicao.inicio = l.aparicao.unidade === "anos" ? i.ano + anoInicial : l.aparicao.unidade === "meses" ? (i.ano + anoInicial) * nMeses + i.mes : i.td;
        if (!l.aparicao.cada) l.aparicao.cada = 1;
        this.render();
      },
      importarMundo() { this.importarDoMundo(); },
      mesHoje(ev, t) {
        const m = this.dados.meses[num(t.dataset.i)];
        if (!m) return;
        m.aparicao.inicio = agora().ano + num(this.dados.anoInicial, 0);
        if (!m.aparicao.cada) m.aparicao.cada = 2;
        this.render();
      },
      addFase(ev, t) { const l = this.dados.luas[num(t.dataset.i)]; l.fases.push({ nome: "Nova fase", peso: 1 }); this.fasesAbertas.add(num(t.dataset.i)); this.render(); },
      remFase(ev, t) { const l = this.dados.luas[num(t.dataset.i)]; if (l.fases.length > 1) l.fases.splice(num(t.dataset.k), 1); this.render(); },
      fasesPadrao(ev, t) { this.dados.luas[num(t.dataset.i)].fases = foundry.utils.deepClone(FASES_PADRAO); this.render(); },
      novoCal() { this.calId = foundry.utils.randomID(); this.dados = normalizar({ ...PRESET_ELEMENTOS, nome: "Nova civilização", luas: PRESET_ELEMENTOS.luas.slice(0, 1) }); this.render(); },
      duplicarCal() { this.calId = foundry.utils.randomID(); this.dados = normalizar({ ...foundry.utils.deepClone(this.dados), nome: `${this.dados.nome} (cópia)` }); this.render(); },
      async apagarCal() {
        const { principal, lista } = listaCalendarios();
        if (!lista[this.calId]) { this.calId = principal; this.dados = normalizar(lista[principal]); return this.render(); }
        if (Object.keys(lista).length < 2) return ui.notifications.warn("O mundo precisa de pelo menos um calendário.");
        const ok = await Dialogo().confirm({
          window: { title: "Apagar calendário", icon: "fa-solid fa-trash" },
          content: `<p>Apagar o calendário <b>${esc(this.dados.nome)}</b>?</p><p class="cm-dica">As notas dele não são apagadas: passam para o calendário principal. Cenas que usavam ele voltam para o principal.</p>`
        });
        if (!ok) return;
        const nova = { ...lista }; delete nova[this.calId];
        const novoPrincipal = this.calId === principal ? Object.keys(nova)[0] : principal;
        await game.settings.set(MOD, "calendarios", { principal: novoPrincipal, lista: nova });
        if (this.calId === principal) await game.settings.set(MOD, "config", nova[novoPrincipal]);
        this.calId = novoPrincipal; this.dados = normalizar(nova[novoPrincipal]);
        this.render();
      },
      async principalCal() {
        const { lista } = listaCalendarios();
        if (!lista[this.calId]) return ui.notifications.warn("Salve o calendário antes de torná-lo o principal.");
        await game.settings.set(MOD, "calendarios", { principal: this.calId, lista });
        await game.settings.set(MOD, "config", lista[this.calId]);
        ui.notifications.info(`"${this.dados.nome}" agora é o calendário principal do mundo.`);
        this.render();
      }
    }
  };

  constructor(opts = {}) {
    super(opts);
    const { principal, lista } = listaCalendarios();
    this.calId = lista[N.CAL_ID] ? N.CAL_ID : principal;
    this.dados = normalizar(lista[this.calId]);
    this.fasesAbertas = new Set();
  }

  /** Item novo já completo (com todos os campos que a janela desenha). */
  novo(lista) {
    const base = normalizar({ ...this.dados, eras: [], estacoes: [], luas: [] });
    switch (lista) {
      case "semana": return normalizar({ semana: [{ nome: "Novo dia", abrev: "Nov" }] }).semana[0];
      case "meses": return normalizar({ meses: [{ nome: `Mês ${this.dados.meses.length + 1}`, abrev: `M${this.dados.meses.length + 1}`, dias: 30 }] }).meses[0];
      case "estacoes": return normalizar({ ...base, estacoes: [{ nome: "Nova estação", mesInicio: 1, diaInicio: 1, nascer: 6, por: 18, icone: "fa-cloud-sun" }] }).estacoes[0];
      case "luas": return normalizar({ luas: [{ nome: "Nova lua", ciclo: 28, deslocamento: 0, cor: "#e8e4d8" }] }).luas[0];
      case "eras": {
        const ult = this.dados.eras?.at(-1);
        const inicio = ult ? (ult.fim != null && ult.fim !== "" ? num(ult.fim) + 1 : agora().ano + num(this.dados.anoInicial, 0)) : num(this.dados.anoInicial, 0);
        return { nome: "Nova era", sufixo: "", inicio, fim: null, contagem: "absoluta" };
      }
    }
  }

  /** Muda a data do jogo usando este calendário (mesmo que ele não seja o que está em uso). */
  async irParaData() {
    if (!game.user.isGM) return;
    const el = this.element;
    const dia = num(el.querySelector(".cm-ir-dia")?.value, 1), mes = num(el.querySelector(".cm-ir-mes")?.value, 0);
    const anoExibido = num(el.querySelector(".cm-ir-ano")?.value, 0);
    const hora = String(el.querySelector(".cm-ir-hora")?.value ?? "").trim();
    const cfg = normalizar(this.dados);
    const r = comConfig(cfg, this.calId, () => {
      const ano = anoExibido - N.CFG.anoInicial;
      const max = diasNoMes(ano, mes);
      if (!max) return { erro: `${N.CFG.meses[mes]?.nome ?? "Esse mês"} não existe no ano ${anoExibido}.` };
      const m = hora.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
      const seg = m ? segundosDaHora(`${m[1]}:${m[2]}`) + Math.min(num(m[3], 0), segMinuto() - 1) : segundoDoDia(game.time.worldTime);
      const td = tdDe(ano, mes, Math.min(Math.max(1, dia), max) - 1);
      return { t: td * segDia() + seg, texto: textoData(infoDia(td)) };
    });
    if (r.erro) return ui.notifications.warn(r.erro);
    await game.time.set(r.t);
    ui.notifications.info(`Data do jogo: ${r.texto}.`);
    this.render();
  }

  async _renderHTML() {
    const c = this.dados;
    const campo = (caminho, valor, tipo = "text", extra = "") =>
      `<input type="${tipo}" data-caminho="${caminho}" ${tipo === "number" ? `data-n="1"` : ""} value="${esc(valor)}" ${extra}>`;
    const linhaBtns = (lista, i) => `
      <span class="cm-linha-btns">
        ${i > 0 ? `<a data-action="subir" data-lista="${lista}" data-i="${i}" data-tooltip="Subir"><i class="fa-solid fa-arrow-up"></i></a>` : `<span></span>`}
        <a data-action="rem" data-lista="${lista}" data-i="${i}" data-tooltip="Remover"><i class="fa-solid fa-trash"></i></a>
      </span>`;
    const icones = { "fa-seedling": "Broto", "fa-sun": "Sol", "fa-leaf": "Folha", "fa-snowflake": "Neve", "fa-cloud-sun": "Nuvem e sol", "fa-cloud-rain": "Chuva", "fa-fire": "Fogo", "fa-droplet": "Água", "fa-wind": "Vento", "fa-mountain": "Montanha", "fa-star": "Estrela", "fa-moon": "Lua" };
    const diasAno = c.meses.reduce((s, m) => s + num(m.dias), 0);
    const bis = !!c.bissexto?.ativo;
    const diasBis = c.meses.reduce((s, m) => s + num(m.diasBissexto ?? m.dias), 0);
    const cn = normalizar(c);   // cópia limpa para os cálculos (fim das estações, eras)
    const erasSobrepostas = cn.eras.some((e, i) => cn.eras.some((o, k) => k !== i && e.inicio <= (o.fim ?? Infinity) && o.inicio <= (e.fim ?? Infinity)));

    return `
      <div class="cm-raiz cm-editor cm-tema-${tema()}">
        ${(() => {
          const { principal, lista } = listaCalendarios();
          const ids = Object.keys(lista);
          const novo = !lista[this.calId];
          this._fontes = fontesDoMundo();
          return `<div class="cm-ed-cals">
            <div class="cm-ed-cals-linha">
              <i class="fa-solid fa-landmark"></i> Calendário:
              <select class="cm-ed-qual" data-tooltip="Escolha um calendário seu para editar, ou comece um novo a partir de um modelo ou de um calendário do Foundry">
                <optgroup label="Seus calendários">
                  ${ids.map((id) => `<option value="${id}" ${id === this.calId ? "selected" : ""}>${esc(normalizar(lista[id]).nome)}${id === principal ? " ★ principal" : ""}</option>`).join("")}
                  ${novo ? `<option value="${this.calId}" selected>${esc(c.nome)} (novo, não salvo)</option>` : ""}
                </optgroup>
                <optgroup label="Novo a partir de um modelo">
                  <option value="modelo:elementos">Exemplo dos Elementos</option>
                  <option value="modelo:gregoriano">Gregoriano</option>
                </optgroup>
                ${this._fontes.length ? `<optgroup label="Importar do mundo (Foundry, sistema e módulos)">
                  ${this._fontes.map((f, i) => `<option value="mundo:${i}">${esc(f.rotulo)}</option>`).join("")}
                </optgroup>` : ""}
              </select>
              <button type="button" data-action="novoCal" data-tooltip="Outra civilização, com meses e eventos próprios"><i class="fa-solid fa-plus"></i> Novo</button>
              <button type="button" data-action="duplicarCal"><i class="fa-solid fa-copy"></i> Duplicar</button>
              ${!novo && this.calId !== principal ? `<button type="button" data-action="principalCal" data-tooltip="Calendário usado quando a cena não escolhe outro"><i class="fa-solid fa-star"></i> Tornar principal</button>` : ""}
              ${ids.length > 1 || novo ? `<button type="button" data-action="apagarCal"><i class="fa-solid fa-trash"></i> ${novo ? "Descartar" : "Apagar"}</button>` : ""}
            </div>
            <div class="cm-ed-cals-linha">
              <button type="button" data-action="importar" data-tooltip="JSON do Calendário da Mesa, Simple Calendar, Seasons &amp; Stars, Fantasy-Calendar.com ou Foundry/Calendaria"><i class="fa-solid fa-file-import"></i> Importar arquivo</button>
              <button type="button" data-action="exportar" data-tooltip="Salvar este calendário num arquivo JSON"><i class="fa-solid fa-file-export"></i> Exportar</button>
              <span class="cm-dica">Modelos e importações abrem como um calendário novo; nada é salvo até clicar em Salvar.</span>
              <input type="file" class="cm-arquivo" accept=".json,application/json" hidden>
            </div>
          </div>`;
        })()}

        <fieldset><legend>Geral</legend>
          <div class="cm-ed-grade cm-g4">
            <label>Nome do calendário${campo("nome", c.nome)}</label>
            <label>Horas por dia${campo("horasDia", c.horasDia, "number", `min="1"`)}</label>
            <label>Minutos por hora${campo("minutosHora", c.minutosHora, "number", `min="1"`)}</label>
            <label>Segundos por minuto${campo("segundosMinuto", c.segundosMinuto, "number", `min="1"`)}</label>
          </div>
        </fieldset>

        <fieldset><legend>Anos e eras</legend>
          <div class="cm-ed-grade cm-g3">
            <label>Primeiro ano<small>ano mostrado no tempo 0 do mundo</small>${campo("anoInicial", c.anoInicial, "number")}</label>
            <label>Sufixo padrão<small>anos fora de qualquer era (ex.: E.E.)</small>${campo("era", c.era)}</label>
            <label class="cm-check"><input type="checkbox" data-caminho="bissexto.ativo" ${bis ? "checked" : ""}> Ano bissexto<small>${bis ? `${diasBis} dias no ano bissexto` : "desligado: todo ano tem " + diasAno + " dias"}</small></label>
          </div>
          ${bis ? `<div class="cm-ed-rodape"><label class="cm-inline">Bissexto a cada${campo("bissexto.cada", c.bissexto.cada, "number", `min="1"`)} anos, começando no ano${campo("bissexto.inicio", num(c.bissexto.inicio) + num(c.anoInicial), "number", `data-desloca="1"`)}</label>
            <span class="cm-dica">Os dias a mais de cada mês ficam na coluna "Dias no bissexto" dos meses.</span></div>` : ""}

          <h4 class="cm-ed-sub"><i class="fa-solid fa-landmark"></i> Eras</h4>
          <div class="cm-ed-lista">
            ${c.eras?.length ? `<div class="cm-ed-cab cm-c-era"><span>Nome da era</span><span>Sufixo</span><span>Ano inicial</span><span>Ano final</span><span>Contagem dos anos</span><span></span></div>` : ""}
            ${(c.eras ?? []).map((e, i) => `<div class="cm-ed-item cm-c-era">${campo(`eras.${i}.nome`, e.nome)}${campo(`eras.${i}.sufixo`, e.sufixo, "text", `placeholder="ex.: D.R."`)}
              ${campo(`eras.${i}.inicio`, e.inicio, "number")}
              <input type="number" data-caminho="eras.${i}.fim" value="${e.fim ?? ""}" placeholder="sem fim">
              <select data-caminho="eras.${i}.contagem"><option value="absoluta" ${e.contagem !== "relativa" ? "selected" : ""}>Ano do mundo (${num(e.inicio)})</option><option value="relativa" ${e.contagem === "relativa" ? "selected" : ""}>Desde o início da era (ano 1)</option></select>
              ${linhaBtns("eras", i)}</div>`).join("") || `<p class="cm-vazio">Sem eras: todos os anos usam o sufixo padrão.</p>`}
            ${erasSobrepostas ? `<p class="cm-aviso"><i class="fa-solid fa-triangle-exclamation"></i> Há eras com anos em comum; vale a que começa primeiro.</p>` : ""}
          </div>
          <div class="cm-ed-rodape"><button type="button" data-action="add" data-lista="eras"><i class="fa-solid fa-plus"></i> Era</button>
            <span class="cm-dica">Ex.: "Era do Fogo", sufixo "E.F.", de 1 a 999, e "Era dos Elementos", "E.E.", de 1000 sem fim. Na contagem "desde o início", o ano 1003 da era que começa em 1000 aparece como "4 E.E.".</span></div>

          ${game.user.isGM ? (() => {
            const cfgEd = normalizar(c);
            const hoje = comConfig(cfgEd, this.calId, () => { const a = agora(); return { dia: a.dia, mes: a.mes, ano: a.ano + N.CFG.anoInicial, texto: textoData(a), hora: textoRelogio(segundoDoDia(a.wt)).slice(0, 5) }; });
            return `<h4 class="cm-ed-sub"><i class="fa-solid fa-calendar-check"></i> Data atual do jogo</h4>
            <p class="cm-dica" style="margin-top:0">Hoje neste calendário: <b>${esc(hoje.texto)}</b>, ${hoje.hora}.</p>
            <div class="cm-ed-rodape cm-ir">
              Dia <input type="number" class="cm-ir-dia cm-curto" min="1" value="${hoje.dia + 1}">
              de <select class="cm-ir-mes">${cfgEd.meses.map((m, k) => `<option value="${k}" ${k === hoje.mes ? "selected" : ""}>${esc(m.nome)}</option>`).join("")}</select>
              de <input type="number" class="cm-ir-ano cm-medio" value="${hoje.ano}">
              às <input type="text" class="cm-ir-hora cm-curto" value="${hoje.hora}" placeholder="HH:MM">
              <button type="button" data-action="irData"><i class="fa-solid fa-calendar-check"></i> Ir para esta data</button>
            </div>
            <p class="cm-dica">Muda o tempo do mundo para todos (as luas, a luz e os eventos acompanham). Usa os meses e anos que estão nesta tela, mesmo antes de salvar.</p>`;
          })() : ""}
        </fieldset>

        <fieldset><legend>Dias da semana</legend>
          <div class="cm-ed-lista">
            <div class="cm-ed-cab cm-c-sem"><span>Nome</span><span>Abrev.</span><span></span></div>
            ${c.semana.map((d, i) => `<div class="cm-ed-item cm-c-sem">${campo(`semana.${i}.nome`, d.nome)}${campo(`semana.${i}.abrev`, d.abrev)}${linhaBtns("semana", i)}</div>`).join("")}
          </div>
          <div class="cm-ed-rodape">
            <button type="button" data-action="add" data-lista="semana"><i class="fa-solid fa-plus"></i> Dia</button>
            <label class="cm-inline">O tempo 0 cai em
              <select data-caminho="primeiroDiaSemana" data-n="1">${c.semana.map((d, i) => `<option value="${i}" ${i === c.primeiroDiaSemana ? "selected" : ""}>${esc(d.nome)}</option>`).join("")}</select>
            </label>
          </div>
        </fieldset>

        <fieldset><legend>Meses <small>(${c.meses.length} meses · ${diasAno} dias no ano${bis ? ` · ${diasBis} no bissexto` : ""})</small></legend>
          <div class="cm-ed-lista">
            <div class="cm-ed-cab ${bis ? "cm-c-mes" : "cm-c-mes1"}"><span>Nome</span><span>Abrev.</span><span>Dias</span>${bis ? "<span>Dias no bissexto</span>" : ""}<span></span></div>
            ${c.meses.map((m, i) => `<div class="cm-ed-lua">
              <div class="cm-ed-item ${bis ? "cm-c-mes" : "cm-c-mes1"}">${campo(`meses.${i}.nome`, m.nome)}${campo(`meses.${i}.abrev`, m.abrev)}${campo(`meses.${i}.dias`, m.dias, "number", `min="1"`)}${bis ? campo(`meses.${i}.diasBissexto`, m.diasBissexto ?? m.dias, "number", `min="1"`) : ""}${linhaBtns("meses", i)}</div>
              <div class="cm-ed-ap">
                <i class="fa-solid fa-eye"></i> Aparece a cada ${campo(`meses.${i}.aparicao.cada`, m.aparicao.cada, "number", `min="0"`)} anos
                e fica ${campo(`meses.${i}.aparicao.duracao`, m.aparicao.duracao, "number", `min="1"`)} anos, a partir de ${campo(`meses.${i}.aparicao.inicio`, m.aparicao.inicio, "number")}
                <a data-action="mesHoje" data-i="${i}" data-tooltip="Começar o ciclo neste ano (o mês existe agora)"><i class="fa-solid fa-location-crosshairs"></i></a>
                <span class="cm-ap-estado">${(() => {
                  const a = m.aparicao ?? {};
                  if (!(a.cada > 0) || a.duracao >= a.cada) return "existe todo ano";
                  const ano = agora().ano + num(c.anoInicial, 0);
                  const pos = mod(ano - a.inicio, a.cada);
                  return pos < a.duracao ? `existe em ${ano}${a.duracao - pos > 1 ? ` (até ${ano + a.duracao - pos - 1})` : ""}` : `volta em ${ano + a.cada - pos}`;
                })()}</span>
              </div>
            </div>`).join("")}
          </div>
          <div class="cm-ed-rodape">
            <button type="button" data-action="add" data-lista="meses"><i class="fa-solid fa-plus"></i> Mês</button>
            <span class="cm-dica">Meses: "Aparece a cada" 0 = existe todo ano. Ex.: a cada 7 anos, fica 1 ano, a partir de 1021 → o mês só existe em 1021, 1028, 1035... O início é o ano exibido.</span>
          </div>
        </fieldset>

        <fieldset><legend>Estações <small>(nascer e pôr do sol em horas, ex.: 6.5 = 6:30)</small></legend>
          <div class="cm-ed-lista">
            <div class="cm-ed-cab cm-c-est"><span>Nome</span><span>Começa no dia</span><span>do mês</span><span>Termina</span><span>Nascer</span><span>Pôr</span><span>Ícone</span><span></span></div>
            ${c.estacoes.map((e, i) => `<div class="cm-ed-item cm-c-est">${campo(`estacoes.${i}.nome`, e.nome)}
              ${campo(`estacoes.${i}.diaInicio`, e.diaInicio ?? 1, "number", `min="1" max="${c.meses[(num(e.mesInicio, 1) || 1) - 1]?.dias ?? 31}"`)}
              <select data-caminho="estacoes.${i}.mesInicio" data-n="1">${c.meses.map((m, k) => `<option value="${k + 1}" ${k + 1 === num(e.mesInicio) ? "selected" : ""}>${esc(m.nome)}</option>`).join("")}</select>
              <span class="cm-est-fim" data-tooltip="O dia antes de a próxima estação começar">${(() => { const f = fimDaEstacao(cn, i); return f && cn.estacoes.length > 1 ? `${f.dia} de ${esc(cn.meses[f.mes - 1]?.nome ?? "")}` : "o ano todo"; })()}</span>
              ${campo(`estacoes.${i}.nascer`, e.nascer, "number", `step="0.25" min="0"`)}${campo(`estacoes.${i}.por`, e.por, "number", `step="0.25" min="0"`)}
              <select data-caminho="estacoes.${i}.icone">${Object.entries(icones).map(([k, v]) => `<option value="${k}" ${k === e.icone ? "selected" : ""}>${v}</option>`).join("")}</select>
              ${linhaBtns("estacoes", i)}</div>`).join("") || `<p class="cm-vazio">Sem estações.</p>`}
          </div>
          <div class="cm-ed-rodape"><button type="button" data-action="add" data-lista="estacoes"><i class="fa-solid fa-plus"></i> Estação</button>
            <span class="cm-dica">Cada estação vai do dia em que começa até o dia antes da próxima. Ex.: inverno em 5 de Geada e primavera em 21 de Renascer → o inverno termina em 20 de Renascer. Pode virar o ano.</span></div>
        </fieldset>

        <fieldset><legend>Luas</legend>
          <div class="cm-ed-lista">
            <div class="cm-ed-cab cm-c-lua"><span>Nome</span><span>Ciclo (dias)</span><span>Deslocamento</span><span>Cor</span><span></span></div>
            ${c.luas.map((l, i) => `<div class="cm-ed-lua">
              <div class="cm-ed-item cm-c-lua">${campo(`luas.${i}.nome`, l.nome)}${campo(`luas.${i}.ciclo`, l.ciclo, "number", `step="0.01" min="1"`)}${campo(`luas.${i}.deslocamento`, l.deslocamento, "number", `step="0.5"`)}${campo(`luas.${i}.cor`, l.cor, "color")}${linhaBtns("luas", i)}</div>
              <div class="cm-ed-ap">
                <i class="fa-solid fa-eye"></i> Aparece a cada ${campo(`luas.${i}.aparicao.cada`, l.aparicao.cada, "number", `min="0"`)}
                <select data-caminho="luas.${i}.aparicao.unidade">${Object.keys(UNIDADES).map((u) => `<option value="${u}" ${u === l.aparicao.unidade ? "selected" : ""}>${u}</option>`).join("")}</select>
                e fica ${campo(`luas.${i}.aparicao.duracao`, l.aparicao.duracao, "number", `min="1"`)}
                <select data-caminho="luas.${i}.aparicao.unidadeDuracao">${Object.keys(UNIDADES).map((u) => `<option value="${u}" ${u === l.aparicao.unidadeDuracao ? "selected" : ""}>${u}</option>`).join("")}</select>
                no céu, a partir de ${campo(`luas.${i}.aparicao.inicio`, l.aparicao.inicio, "number")}
                <a data-action="apHoje" data-i="${i}" data-tooltip="Começar o ciclo hoje (a lua aparece agora)"><i class="fa-solid fa-location-crosshairs"></i></a>
                ${l.aparicao.cada > 0 ? `<span class="cm-ap-estado">${(() => { const v = visibilidadeLua(l, agora().td); return v.visivel ? `no céu agora, some em ${textoFalta(v)}` : `volta em ${textoFalta(v)}`; })()}</span>` : `<span class="cm-ap-estado">sempre visível</span>`}
              </div>
              <details class="cm-ed-fases" data-lua="${i}" ${this.fasesAbertas.has(i) ? "open" : ""}>
                <summary><i class="fa-solid fa-moon"></i> Fases (${l.fases.length}): ${esc(l.fases.map((f) => f.nome).join(" · "))}</summary>
                <div class="cm-ed-cab cm-c-fase"><span></span><span>Nome da fase</span><span>Duração relativa</span><span>No céu</span><span></span></div>
                ${l.fases.map((f, k) => {
                  const tot = l.fases.reduce((s, x) => s + x.peso, 0);
                  const centro = (l.fases.slice(0, k).reduce((s, x) => s + x.peso, 0) + f.peso / 2) / tot - l.fases[0].peso / tot / 2;
                  const dias = (l.ciclo * f.peso) / tot;
                  return `<div class="cm-ed-item cm-c-fase">${luaSVG(mod(centro, 1), l.cor, 18)}${campo(`luas.${i}.fases.${k}.nome`, f.nome)}${campo(`luas.${i}.fases.${k}.peso`, f.peso, "number", `step="0.5" min="0.1"`)}
                    <span class="cm-fase-dias" data-tooltip="Quanto tempo esta fase fica no céu a cada ciclo de ${l.ciclo} dias">≈ ${dias.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${Math.abs(dias - 1) < 0.05 ? "dia" : "dias"}</span>
                    <span class="cm-linha-btns"><a data-action="remFase" data-i="${i}" data-k="${k}" data-tooltip="Remover fase"><i class="fa-solid fa-trash"></i></a></span></div>`;
                }).join("")}
                <div class="cm-ed-rodape">
                  <button type="button" data-action="addFase" data-i="${i}"><i class="fa-solid fa-plus"></i> Fase</button>
                  <button type="button" data-action="fasesPadrao" data-i="${i}"><i class="fa-solid fa-rotate-left"></i> 8 fases padrão</button>
                  <span class="cm-dica">A 1ª fase é a lua nova. As fases dividem o ciclo na proporção da duração relativa (ex.: cheia com 2 dura o dobro).</span>
                </div>
              </details>
            </div>`).join("") || `<p class="cm-vazio">Sem luas.</p>`}
          </div>
          <div class="cm-ed-rodape"><button type="button" data-action="add" data-lista="luas"><i class="fa-solid fa-plus"></i> Lua</button>
            <span class="cm-dica">Deslocamento = em que dia do mundo a lua estava nova. "Aparece a cada" 0 = sempre no céu. O início é contado em anos exibidos (ex.: 1023), em meses desde o ano 0 ou em dias do mundo — o botão ⌖ começa o ciclo hoje.</span></div>
        </fieldset>

        <footer class="cm-ed-fim">
          <p class="cm-dica"><i class="fa-solid fa-circle-info"></i> O tempo do mundo é guardado em segundos. Mudar meses, semana ou horas muda a data mostrada para o mesmo momento; as notas ficam no mesmo dia absoluto.</p>
          <button type="button" class="cm-salvar" data-action="salvar"><i class="fa-solid fa-floppy-disk"></i> Salvar calendário</button>
        </footer>
      </div>`;
  }

  _replaceHTML(html, content) {
    const rolagem = content.querySelector(".cm-editor")?.scrollTop ?? 0;
    const foco = lerFoco(content);
    content.innerHTML = html;
    const ed = content.querySelector(".cm-editor");
    if (ed) ed.scrollTop = rolagem;
    voltarFoco(content, foco);
    content.addEventListener("toggle", this._aoAbrir ??= (ev) => {
      const d = ev.target;
      if (!d.classList?.contains("cm-ed-fases")) return;
      const i = num(d.dataset.lua);
      if (d.open) this.fasesAbertas.add(i); else this.fasesAbertas.delete(i);
    }, true);
    content.addEventListener("change", this._aoMudar ??= (ev) => {
      const el = ev.target;
      if (el.classList.contains("cm-arquivo")) return this.importarArquivo(el.files?.[0]);
      if (el.classList.contains("cm-ed-qual")) {
        const v = el.value;
        this.fasesAbertas.clear();
        if (v.startsWith("modelo:")) {
          this.calId = foundry.utils.randomID();
          this.dados = normalizar(v === "modelo:gregoriano" ? presetGregoriano() : PRESET_ELEMENTOS);
          return this.render();
        }
        if (v.startsWith("mundo:")) {
          const f = this._fontes?.[num(v.slice(6), -1)];
          if (!f) return this.render();
          this.calId = foundry.utils.randomID();
          return this.carregar(foundry.utils.deepClone(f.dados));
        }
        const { lista } = listaCalendarios();
        if (!lista[v]) return;
        this.calId = v; this.dados = normalizar(lista[v]);
        return this.render();
      }
      const caminho = el.dataset.caminho;
      if (!caminho) return;
      foundry.utils.setProperty(this.dados, caminho, valorDoCampo(el, this.dados));
      const redesenhar = /^(meses|semana|estacoes|eras)\./.test(caminho) || /\.(aparicao|fases)\./.test(caminho) || /^luas\.\d+\.(cor|ciclo)$/.test(caminho)
        || ["primeiroDiaSemana", "anoInicial", "era", "bissexto.ativo", "bissexto.cada", "bissexto.inicio"].includes(caminho);
      // espera o Tab terminar de mudar o foco antes de redesenhar, para o cursor ir para o próximo campo
      if (redesenhar) setTimeout(() => this.render(), 0);
    });
  }

  async importarArquivo(arq) {
    if (!arq) return;
    let obj;
    try { obj = JSON.parse(await arq.text()); }
    catch { return ui.notifications.error("Esse arquivo não é um JSON válido."); }
    this.calId = foundry.utils.randomID();
    this.carregar(obj);
  }

  carregar(obj) {
    try {
      const r = converterCalendario(obj);
      this.dados = r.dados;
      this.render();
      const extra = r.avisos.length ? `<ul>${r.avisos.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>` : "";
      Dialogo().prompt({
        window: { title: "Calendário importado", icon: "fa-solid fa-file-import" },
        content: `<p>Formato: <b>${esc(FORMATOS[r.formato])}</b></p><p><b>${esc(r.dados.nome)}</b>: ${r.dados.meses.length} meses, semana de ${r.dados.semana.length} dias, ${r.dados.estacoes.length} estações, ${r.dados.luas.length} luas.</p>${extra}<p class="cm-dica">Nada foi salvo ainda. Revise no editor e clique em Salvar calendário.</p>`,
        rejectClose: false
      });
    } catch (err) {
      console.error(`${MOD} | importação`, err);
      ui.notifications.error(`Não consegui importar: ${err.message}`);
    }
  }

  async importarDoMundo() {
    const fontes = fontesDoMundo();
    if (!fontes.length) return ui.notifications.warn("Não achei outro calendário neste mundo. Exporte o JSON no outro módulo e use Importar arquivo.");
    const escolha = await Dialogo().wait({
      window: { title: "Importar do mundo", icon: "fa-solid fa-globe" },
      content: `<div class="cm-form"><label>Calendário<select name="fonte">${fontes.map((f, i) => `<option value="${i}">${esc(f.rotulo)}</option>`).join("")}</select></label></div>`,
      buttons: [{ action: "ok", label: "Importar", default: true, callback: (ev, btn) => btn.form.elements.fonte.value }, { action: "cancelar", label: "Cancelar" }],
      rejectClose: false
    });
    const f = fontes[num(escolha, -1)];
    if (f) this.carregar(foundry.utils.deepClone(f.dados));
  }

  async salvar() {
    // pega o que ainda estiver digitado sem "change"
    this.element.querySelectorAll("[data-caminho]").forEach((el) => foundry.utils.setProperty(this.dados, el.dataset.caminho, valorDoCampo(el, this.dados)));
    const novo = normalizar(this.dados);
    const { principal, lista } = listaCalendarios();
    const velho = lista[this.calId];
    const qtdNotas = velho ? game.journal.filter((j) => { const r = j.getFlag(MOD, "nota"); return r && calDaNota(r) === this.calId; }).length : 0;
    const r = await Dialogo().wait({
      window: { title: "Salvar calendário", icon: "fa-solid fa-floppy-disk" },
      content: `<div class="cm-form"><p>Salvar <b>${esc(novo.nome)}</b> para todos?</p>
        <p class="cm-dica">${novo.meses.length} meses, ${novo.meses.reduce((s, m) => s + m.dias, 0)} dias no ano, semana de ${novo.semana.length} dias, ${novo.horasDia} horas por dia.</p>
        ${qtdNotas ? `<label class="cm-chip"><input type="checkbox" name="manter" checked> As ${qtdNotas} notas deste calendário continuam na mesma data (ex.: "5 de Brasa" continua "5 de Brasa")</label>` : ""}</div>`,
      buttons: [{ action: "ok", label: "Salvar", default: true, callback: (ev, btn) => ({ manter: !!btn.form.elements.manter?.checked }) }, { action: "cancelar", label: "Cancelar" }],
      rejectClose: false
    });
    if (!r || typeof r !== "object") return;
    const notasAntes = qtdNotas && r.manter ? datasDasNotas(this.calId, velho) : null;
    await game.settings.set(MOD, "calendarios", { principal: lista[principal] ? principal : this.calId, lista: { ...lista, [this.calId]: novo } });
    if (this.calId === (lista[principal] ? principal : this.calId)) await game.settings.set(MOD, "config", novo);
    CACHE_CAL.clear();
    aplicarCalendario();
    if (notasAntes) {
      const n = await reposicionarNotas(notasAntes, this.calId, novo);
      if (n) ui.notifications.info(`${n} nota(s) ajustada(s) para continuar na mesma data.`);
    }
    ui.notifications.info("Calendário salvo.");
    rerenderJanelas();
    // continua no editor, já com o que foi salvo
    this.dados = normalizar(novo);
    this.render();
  }
}


/* ---------------- janela: luz por hora ---------------- */

class JanelaLuz extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "cm-luz",
    classes: ["cm-janela"],
    tag: "div",
    window: { title: "Luz do mapa por hora", icon: "fa-solid fa-sun", resizable: true },
    position: { width: 620, height: 720 },
    actions: {
      padrao() { this.L.horas = luzPadrao(); this.render(); },
      tudo(ev, t) { const v = num(t.dataset.v); this.L.horas = this.L.horas.map(() => v); this.render(); },
      async salvar() {
        await game.settings.set(MOD, "luz", this.L);
        ui.notifications.info("Luz salva. As cenas com dia/noite ligado já foram atualizadas.");
        this.close();
      }
    }
  };

  constructor(opts = {}) { super(opts); this.L = luzCfg(); }

  async _renderHTML() {
    const L = this.L, H = N.CFG.horasDia;
    const faixa = L.horas.map((v, h) => `<span style="--l:${v}" data-tooltip="${textoHora(h, 0)} · ${v}%"></span>`).join("");
    const linhas = L.horas.map((v, h) => `
      <div class="cm-luz-linha">
        <span class="cm-luz-hora">${textoHora(h, 0)}</span>
        <input type="range" min="0" max="100" step="5" value="${v}" data-h="${h}">
        <span class="cm-luz-val" data-v="${h}">${v}%</span>
      </div>`).join("");
    const cenas = cenasDiaNoite().map((s) => esc(s.name)).join(", ");
    return `
      <div class="cm-raiz cm-editor cm-tema-${tema()}">
        <p class="cm-dica" style="margin-top:0">Usa a escuridão nativa da cena (0% de luz = escuridão máxima). Entre uma hora e a seguinte a luz muda aos poucos.
          Vale para as cenas com o dia/noite ligado (botão <i class="fa-solid fa-circle-half-stroke"></i> no HUD)${cenas ? `: <b>${cenas}</b>` : " — nenhuma ainda"}.</p>
        <div class="cm-luz-faixa">${faixa}</div>

        <fieldset><legend>Luz de cada hora (${H} horas)</legend>
          <div class="cm-luz-grade">${linhas}</div>
          <div class="cm-ed-rodape">
            <button type="button" data-action="padrao"><i class="fa-solid fa-rotate-left"></i> Curva padrão</button>
            <button type="button" data-action="tudo" data-v="100"><i class="fa-solid fa-sun"></i> Tudo claro</button>
            <button type="button" data-action="tudo" data-v="0"><i class="fa-solid fa-moon"></i> Tudo escuro</button>
          </div>
        </fieldset>

        <fieldset><legend>Noite e luas</legend>
          <div class="cm-ed-grade cm-g3">
            <label>Luz da lua cheia<small>quanto a lua mais clara no céu ilumina (lua nova ou sem lua = nada)</small>
              <span class="cm-luz-par"><input type="range" min="0" max="100" step="5" value="${L.luaMax}" data-campo="luaMax"><span class="cm-luz-val" data-v="luaMax">${L.luaMax}%</span></span></label>
            <label>Cor da noite<small>sem lua colorida no céu (padrão branco-azulado)</small>
              <input type="color" value="${L.corNoite}" data-campo="corNoite"></label>
            <label>Força da cor<small>quanto a noite fica tingida</small>
              <span class="cm-luz-par"><input type="range" min="0" max="1" step="0.05" value="${L.corIntensidade}" data-campo="corIntensidade"><span class="cm-luz-val" data-v="corIntensidade">${Math.round(L.corIntensidade * 100)}%</span></span></label>
          </div>
          <p class="cm-dica">Uma lua com cor forte (ex.: Lua Rubra) tinge a noite com a cor dela enquanto for a mais clara no céu. Luas brancas ou cinzas usam a cor da noite.</p>
        </fieldset>

        <fieldset><legend>Saltos de tempo</legend>
          <div class="cm-ed-grade cm-g3">
            <label class="cm-check"><input type="checkbox" data-campo="gradual" ${L.gradual ? "checked" : ""}> Passar aos poucos ao pular horas<small>a luz passa por cada hora até chegar no horário (no máximo um dia)</small></label>
            <label>Duração da passagem<small>segundos no total</small><input type="number" min="1" max="30" value="${L.transicao}" data-campo="transicao" data-n="1"></label>
          </div>
        </fieldset>

        <footer class="cm-ed-fim">
          <span class="cm-esp"></span>
          <button type="button" class="cm-salvar" data-action="salvar"><i class="fa-solid fa-floppy-disk"></i> Salvar</button>
        </footer>
      </div>`;
  }

  _replaceHTML(html, content) {
    const rolagem = content.querySelector(".cm-editor")?.scrollTop ?? 0;
    content.innerHTML = html;
    const ed = content.querySelector(".cm-editor");
    if (ed) ed.scrollTop = rolagem;
    content.addEventListener("input", this._aoMexer ??= (ev) => {
      const el = ev.target;
      if (el.dataset.h !== undefined) {
        const h = num(el.dataset.h), v = num(el.value);
        this.L.horas[h] = v;
        content.querySelector(`[data-v="${h}"]`).textContent = `${v}%`;
        content.querySelectorAll(".cm-luz-faixa span")[h]?.style.setProperty("--l", v);
        return;
      }
      const c = el.dataset.campo;
      if (!c) return;
      this.L[c] = el.type === "checkbox" ? el.checked : (el.type === "range" || el.dataset.n) ? num(el.value) : el.value;
      const rot = content.querySelector(`[data-v="${c}"]`);
      if (rot) rot.textContent = c === "corIntensidade" ? `${Math.round(num(el.value) * 100)}%` : `${el.value}%`;
    });
  }
}



class JanelaHistorico extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "cm-historico",
    classes: ["cm-janela"],
    tag: "div",
    window: { title: "Histórico da campanha", icon: "fa-solid fa-scroll", resizable: true },
    position: { width: 560, height: 640 },
    actions: {
      async novo() {
        const texto = await pedirTexto("Registrar no histórico", "O que aconteceu hoje?");
        if (texto) { await registrarManual(texto); this.render(); }
      },
      async apagar(ev, t) {
        if (!game.user.isGM) return;
        await alterarHistorico((itens) => itens.filter((i) => i.id !== t.dataset.id));
        this.render();
      },
      filtro(ev, t) { this.filtro = t.dataset.f; this.render(); },
      async exportar() { await exportarHistorico(); }
    }
  };

  filtro = "tudo";

  async _renderHTML() {
    const gm = game.user.isGM;
    let itens = historico();
    if (this.filtro === "manual") itens = itens.filter((i) => i.icone === "fa-feather");
    if (this.filtro === "eventos") itens = itens.filter((i) => ["fa-star", "fa-hands-praying", "fa-hourglass-end", "fa-route"].includes(i.icone) || i.icone === "fa-feather");
    const porDia = new Map();
    for (const i of [...itens].sort((a, b) => b.wt - a.wt)) {
      if (!porDia.has(i.td)) porDia.set(i.td, []);
      porDia.get(i.td).push(i);
    }
    const blocos = [...porDia.entries()].map(([td, lista]) => `
      <div class="cm-hist-dia">
        <h4>${esc(textoData(infoDia(td)))}</h4>
        <ul>${lista.map((i) => `<li><i class="fa-solid ${esc(i.icone)}"></i> <span>${esc(i.texto)}</span>
          ${gm ? `<a class="cm-hist-x" data-action="apagar" data-id="${i.id}" data-tooltip="Apagar"><i class="fa-solid fa-xmark"></i></a>` : ""}</li>`).join("")}</ul>
      </div>`).join("");
    const f = (k, r) => `<button type="button" data-action="filtro" data-f="${k}" class="${this.filtro === k ? "cm-on" : ""}">${r}</button>`;
    return `<div class="cm-raiz cm-editor cm-tema-${tema()}">
      <div class="cm-ed-cals-linha">
        ${f("tudo", "Tudo")}${f("eventos", "Eventos e viagens")}${f("manual", "Anotações")}
        <span class="cm-esp"></span>
        ${gm ? `<button type="button" data-action="novo"><i class="fa-solid fa-feather"></i> Anotar hoje</button>
        <button type="button" data-action="exportar" data-tooltip="Cria ou atualiza o Diário 'Histórico da campanha'"><i class="fa-solid fa-book"></i> Criar Diário</button>` : ""}
      </div>
      ${game.journal.find((j) => j.getFlag(MOD, "historico"))?.pages?.find((p) => p.getFlag(MOD, "arquivo")) ? `<p class="cm-dica"><i class="fa-solid fa-box-archive"></i> Aqui ficam os ${HIST_MAX} registros mais recentes; os mais antigos estão no Diário "Histórico da campanha", página Arquivo.</p>` : ""}
      ${blocos || `<p class="cm-vazio">Nada registrado ainda. O histórico se preenche sozinho com o passar dos dias, eventos, viagens, clima e sessões.</p>`}
    </div>`;
  }

  _replaceHTML(html, content) { content.innerHTML = html; }
}

async function pedirTexto(titulo, rotulo, valor = "") {
  const r = await Dialogo().wait({
    window: { title: titulo, icon: "fa-solid fa-feather" },
    content: `<div class="cm-form"><label>${esc(rotulo)}<textarea name="t" rows="3">${esc(valor)}</textarea></label></div>`,
    buttons: [{ action: "ok", label: "Salvar", default: true, callback: (ev, btn) => btn.form.elements.t.value }, { action: "cancelar", label: "Cancelar" }],
    rejectClose: false
  });
  return typeof r === "string" && r !== "ok" && r !== "cancelar" ? r.trim() : "";
}

async function registrarManual(texto) {
  if (!game.user.isGM) return;
  const item = { id: foundry.utils.randomID(), wt: game.time.worldTime, td: agora().td, cal: N.CAL_ID, icone: "fa-feather", texto };
  await alterarHistorico((itens) => { itens.push(item); });
}

async function exportarHistorico() {
  // a página "Recentes" é refeita; a página "Arquivo" guarda os registros antigos e nunca é apagada
  const e = await diarioHistorico();
  const html = historicoHTML(historico()) || "<p>Nada registrado.</p>";
  const pag = e.pages.find((p) => p.getFlag(MOD, "recentes"));
  if (pag) await pag.update({ "text.content": html });
  else await e.createEmbeddedDocuments("JournalEntryPage", [{ name: "Recentes", type: "text", sort: 100000, text: { content: html }, flags: { [MOD]: { recentes: true } } }]);
  ui.notifications.info("Diário \"Histórico da campanha\" atualizado.");
  e.sheet?.render(true);
}


/* ---------------- janela do clima ----------------
 * Janela própria (não um diálogo do Foundry): tamanho fixo e redimensionável, só a lista de tempos rola,
 * o topo mostra o tempo de hoje ou o escolhido, e a barra de baixo (temperatura e Aplicar) fica sempre à vista. */

const NOMES_ESTACAO = { primavera: "primavera", verao: "verão", outono: "outono", inverno: "inverno" };

async function dialogoClima() {
  if (!game.user.isGM) return;
  const aberta = foundry.applications.instances.get("cm-clima");
  if (aberta) { aberta.bringToFront?.(); return aberta; }
  return new JanelaClima().render({ force: true });
}

const ICONES_CLIMA = {
  "fa-sun": "Sol", "fa-cloud-sun": "Sol e nuvem", "fa-cloud": "Nuvem", "fa-cloud-moon": "Lua e nuvem", "fa-moon": "Lua", "fa-smog": "Névoa",
  "fa-cloud-rain": "Chuva", "fa-cloud-showers-heavy": "Chuva forte", "fa-cloud-showers-water": "Chuva e água", "fa-cloud-bolt": "Raio e nuvem",
  "fa-bolt": "Raio", "fa-cloud-meatball": "Granizo", "fa-snowflake": "Floco de neve", "fa-icicles": "Pingentes de gelo",
  "fa-temperature-low": "Termômetro frio", "fa-temperature-high": "Termômetro quente", "fa-wind": "Vento", "fa-tornado": "Tornado",
  "fa-hurricane": "Furacão", "fa-volcano": "Vulcão", "fa-fire": "Fogo", "fa-fire-flame-simple": "Chama", "fa-droplet": "Gota",
  "fa-droplet-slash": "Sem água", "fa-water": "Água", "fa-mountain": "Montanha", "fa-sun-plant-wilt": "Seca", "fa-rainbow": "Arco-íris",
  "fa-meteor": "Meteoro", "fa-star": "Estrela", "fa-skull": "Caveira", "fa-ghost": "Espíritos", "fa-eye": "Olho",
  "fa-hand-sparkles": "Magia", "fa-biohazard": "Praga", "fa-hourglass-half": "Tempo", "fa-wand-magic-sparkles": "Aurora / brilho", "fa-circle-half-stroke": "Eclipse"
};
const opcoesIcone = (atual) => `${atual && !ICONES_CLIMA[atual] ? `<option value="${esc(atual)}" selected>${esc(atual)}</option>` : ""}${Object.entries(ICONES_CLIMA).map(([k, r]) => `<option value="${k}" ${atual === k ? "selected" : ""}>${esc(r)}</option>`).join("")}`;
/** <select> de tempos agrupados. vazio = rótulo da opção "" (ou nada). */
const opcoesTempo = (atual, vazio = null) => `${vazio != null ? `<option value="" ${!atual ? "selected" : ""}>${esc(vazio)}</option>` : ""}` +
  Object.entries(GRUPOS_CLIMA).map(([g, rot]) => `<optgroup label="${esc(rot)}">${Object.entries(CLIMAS).filter(([, c]) => c.grupo === g).map(([k, c]) => `<option value="${k}" ${atual === k ? "selected" : ""}>${esc(c.nome)}</option>`).join("")}</optgroup>`).join("");
const MAPA_TIPOS = { climas: () => CLIMAS, zonas: () => ZONAS, anomalias: () => ANOMALIAS, efeitos: () => game.settings.get(MOD, "climaTipos")?.efeitos ?? {} };


class JanelaClima extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "cm-clima",
    classes: ["cm-janela", "cm-clima-app"],
    tag: "div",
    window: { title: "Clima", icon: "fa-solid fa-cloud-sun", resizable: true },
    position: { width: 820, height: 680 },
    actions: {
      aba(ev, t) { this.aba = t.dataset.aba; this.render(); },
      escolher(ev, t) { this.sel = this.sel === t.dataset.tipo ? null : t.dataset.tipo; this.faixa = null; this.sugerirTemp(); this.render(); },
      rolar() { this.sel = this.sel === "__rolar" ? null : "__rolar"; this.render(); },
      rolarTemp() { this.rolarTemp(); },
      filtro(ev, t) { this.filtro = t.dataset.grupo; this.render(); },
      estacao() { this.soEstacao = !this.soEstacao; this.render(); },
      async aplicar() { await this.aplicar(); },
      cancelar() { this.close(); },
      // editores
      editar(ev, t) { this.ed[t.dataset.grupo] = t.dataset.id; this.render(); },
      maisTroca() { this.guardarRascunho("anomalias"); const r = this.rascunhos[`anomalias:${this.ed.anomalias}`]; this.element.querySelector(".cm-ce-trocas tbody")?.insertAdjacentHTML("beforeend", this.linhaTroca("", "", r)); },
      tirarLinha(ev, t) { (t.closest(".cm-ce-local") ?? t.closest("tr"))?.remove(); },
      maisLocal() {
        this.guardarRascunho("anomalias");
        const id = this.ed.anomalias, r = this.rascunhos[`anomalias:${id}`];
        if (!r) return;
        (r.climas ??= {})[N.idClimaAnomalia(id, foundry.utils.randomID(6))] = { nome: "Novo clima", grupo: "chuva", icone: "fa-cloud", efeito: "", temp: 0, desc: "" };
        this.render();
      },
      copiarClimaDe() {
        this.guardarRascunho("anomalias");
        const r = this.rascunhos[`anomalias:${this.ed.anomalias}`];
        const m = ZONAS[this.element.querySelector('[name="copiarDe"]')?.value];
        if (!r || !m) return;
        r.zona = { temp: { ...m.temp }, variacao: m.variacao ?? 10, pesos: foundry.utils.deepClone(m.pesos) };
        this.render();
      },
      descartar(ev, t) { delete this.rascunhos[`${t.dataset.grupo}:${this.ed[t.dataset.grupo]}`]; this.render(); },
      subClimas(ev, t) { this.subClimas = t.dataset.sub; this.render(); },
      async prevGerar() { await N.gerarPrevisao(); },
      async prevRefazer() {
        const ok = await Dialogo().confirm({ window: { title: T("Refazer a previsão") }, content: `<p>${T("Rolar de novo todos os dias da previsão, de todas as regiões? O que você ajustou à mão será trocado.")}</p>` });
        if (ok) await N.gerarPrevisao(undefined, undefined, { refazer: true });
      },
      async prevRolar(ev, t) { const td = num(t.dataset.td); await N.definirPrevisao(td, this.zonaPrev, rolarClima(this.zonaPrev, td)); },
      async prevLimpar(ev, t) { await N.definirPrevisao(num(t.dataset.td), this.zonaPrev, null); },
      async prevMostrar() { await this.mostrarPrevisao(); },
      testarEfeito() { this.testarEfeito(); },
      pararTeste() { this.pararTeste(); },
      novo(ev, t) { this.criar(t.dataset.grupo); },
      duplicar(ev, t) { this.criar(t.dataset.grupo, true); },
      async salvarTipo(ev, t) { await this.salvarTipo(t.dataset.grupo); },
      async restaurar(ev, t) { await this.restaurar(t.dataset.grupo); },
      async apagarTipo(ev, t) { await this.apagarTipo(t.dataset.grupo); },
      async tornarPadrao() { await game.settings.set(MOD, "zonaPadrao", this.ed.zonas); ui.notifications.info(`"${ZONAS[this.ed.zonas]?.nome}" é a região padrão do mundo.`); this.render(); }
    }
  };

  aba = "tempo";
  sel = null;          // tipo escolhido, "__rolar" ou null (manter)
  filtro = "todos";
  soEstacao = false;
  temp = null;         // °C escolhidos (null = não mexeu)
  faixa = null;        // { min, max, onda } vindos do dado da temperatura
  mexeu = false;
  ed = { climas: null, zonas: null, anomalias: null, efeitos: null };   // tipo aberto em cada editor
  subClimas = "climas";  // aba Climas: lista de climas ou de efeitos
  rascunhos = {};      // tipos novos ainda não salvos: { "zonas:id": dados }

  /** Região, estação e tabela de chances da cena atual. */
  contexto() {
    const zona = zonaDaCena();
    const est = tipoEstacao(estacaoDe(agora().mes, agora().dia));
    const pesos = ZONAS[zona]?.pesos?.[est] ?? {};
    const soma = Object.values(pesos).reduce((x, y) => x + y, 0) || 1;
    return { zona, est, pesos, soma, atual: climaDe(zona), base: ZONAS[zona]?.temp?.[est] ?? 15 };
  }

  sugerirTemp() {
    if (this.mexeu || !CLIMAS[this.sel]) return;
    const { base } = this.contexto();
    this.temp = Math.round(base + (CLIMAS[this.sel].temp ?? 0));
  }

  rolarTemp() {
    if (this.sel === "__rolar") return;
    const { zona, atual } = this.contexto();
    const tipo = CLIMAS[this.sel] ? this.sel : (atual?.tipo ?? "limpo");
    const r = N.rolarTemperatura(zona, tipo);
    this.temp = r.temp; this.faixa = { min: r.min, max: r.max, onda: r.onda ?? null }; this.mexeu = true;
    this.render();
  }

  get emF() { return game.settings.get(MOD, "climaUnidade") === "F"; }
  get un() { return this.emF ? "°F" : "°C"; }
  paraTela(c) { return this.emF ? Math.round(c * 9 / 5 + 32) : Math.round(c); }
  deTela(v) { return this.emF ? Math.round((v - 32) * 5 / 9) : Math.round(v); }
  /** Variação (diferença) de temperatura: em °F só escala, sem somar 32. */
  difTela(c) { return this.emF ? Math.round(c * 9 / 5) : Math.round(c); }
  difDeTela(v) { return this.emF ? Math.round(v * 5 / 9) : Math.round(v); }

  async _renderHTML() {
    const anOk = N.anomaliasLigadas();
    if (this.aba === "anomalias" && !anOk) this.aba = "tempo";
    const abas = [["tempo", T("Tempo de hoje"), "fa-cloud-sun"], ["previsao", T("Previsão"), "fa-calendar-week"], ["climas", T("Climas"), "fa-cloud-bolt"], ["zonas", T("Regiões"), "fa-earth-americas"], ...(anOk ? [["anomalias", T("Anomalias"), "fa-skull"]] : [])]
      .map(([k, r, ic]) => `<button type="button" class="${this.aba === k ? "ativo" : ""}" data-action="aba" data-aba="${k}"><i class="fa-solid ${ic}"></i> ${r}</button>`).join("");
    const corpo = this.aba === "zonas" ? this.htmlZonas() : this.aba === "anomalias" ? this.htmlAnomalias() : this.aba === "climas" ? this.htmlClimas() : this.aba === "previsao" ? this.htmlPrevisao() : this.htmlTempo();
    return `<div class="cm-raiz cm-clima-raiz cm-tema-${tema()}">
      <nav class="cm-clima-topo">${abas}</nav>
      ${corpo}
    </div>`;
  }

  /* ---------- aba: previsão ---------- */
  htmlPrevisao() {
    const emUso = zonasEmUso();
    if (!ZONAS[this.zonaPrev]) this.zonaPrev = zonaDaCena();
    const zona = this.zonaPrev;
    const dias = num(game.settings.get(MOD, "previsaoDias"), 5);
    const hoje = agora().td;
    const p = N.previsao();
    const climasZona = Object.entries(CLIMAS).filter(([, c]) => !c.daAnomalia || c.daAnomalia === ZONAS[zona]?.anomaliaFixa);
    const opTipo = (atual) => Object.entries(GRUPOS_CLIMA).map(([g, rot]) => `<optgroup label="${esc(T(rot))}">${climasZona.filter(([, c]) => c.grupo === g).map(([k, c]) => `<option value="${k}" ${atual === k ? "selected" : ""}>${esc(T(c.nome))}</option>`).join("")}</optgroup>`).join("");
    const linhas = [];
    let faltam = 0;
    for (let td = hoje + 1; td <= hoje + dias; td++) {
      const c = p.dias?.[td]?.[zona];
      const info = c ? CLIMAS[c.tipo] : null;
      const ev = N.eventosLuasDoDia(td);
      if (!c) faltam++;
      linhas.push(`<div class="cm-prev-dia ${c ? `g-${info?.grupo ?? "ceu"}` : "vazio"}" data-td="${td}">
        <div class="cm-prev-data"><b>${td === hoje + 1 ? T("Amanhã") : esc(textoData(infoDia(td), { ano: false, semana: true }))}</b><small>${T("em {n} dias", { n: td - hoje })}${ev.length ? ` · ${ev.map((e) => `<i class="fa-solid ${e.icone}" style="color:${e.cor}" data-tooltip="${esc(N.textoEventoLua(e))}"></i>`).join(" ")}` : ""}</small></div>
        ${c ? `<span class="cm-prev-ico"><i class="fa-solid ${info?.icone ?? "fa-cloud"}"></i></span>
          <select name="prevTipo" data-td="${td}">${opTipo(c.tipo)}</select>
          <label class="cm-prev-temp"><input type="number" name="prevTemp" data-td="${td}" value="${this.paraTela(c.temp)}"><span>${this.un}</span></label>
          <small class="cm-prev-faixa">${c.min != null ? T("mín. {min} · máx. {max}", { min: this.paraTela(c.min), max: this.paraTela(c.max) }) : ""}${c.onda ? ` · ${T("onda de {tipo}", { tipo: T(c.onda) })}` : ""}</small>
          <button type="button" class="cm-ce-x" data-action="prevRolar" data-td="${td}" data-tooltip="${esc(T("Rolar este dia de novo"))}"><i class="fa-solid fa-dice"></i></button>
          <button type="button" class="cm-ce-x" data-action="prevLimpar" data-td="${td}" data-tooltip="${esc(T("Tirar da previsão (o dia será rolado quando chegar)"))}"><i class="fa-solid fa-xmark"></i></button>`
        : `<span class="cm-prev-nada">${T("Sem previsão: será rolado quando o dia chegar.")}</span>
          <button type="button" class="cm-ce-x" data-action="prevRolar" data-td="${td}" data-tooltip="${esc(T("Rolar este dia"))}"><i class="fa-solid fa-dice"></i></button>`}
      </div>`);
    }
    return `<div class="cm-prev">
      <div class="cm-prev-topo">
        <label>${T("Região")}<select name="prevZona">${emUso.map((z) => `<option value="${z}" ${z === zona ? "selected" : ""}>${esc(T(ZONAS[z].nome))}</option>`).join("")}</select></label>
        <p class="cm-dica">${T("Só o mestre vê. Quando o dia chega, o clima sai daqui em vez de ser rolado. Mude o tempo ou a temperatura de um dia e a mudança fica salva na hora.")}</p>
      </div>
      <div class="cm-prev-lista">${linhas.join("")}</div>
      <footer class="cm-clima-rodape">
        <button type="button" data-action="prevGerar"><i class="fa-solid fa-wand-magic-sparkles"></i> ${faltam ? T("Preencher a previsão ({n} dias)", { n: faltam }) : T("Previsão completa")}</button>
        <button type="button" data-action="prevRefazer"><i class="fa-solid fa-rotate"></i> ${T("Refazer tudo")}</button>
        <span class="cm-esp"></span>
        <button type="button" class="cm-clima-aplicar" data-action="prevMostrar"><i class="fa-solid fa-bullhorn"></i> ${T("Mostrar aos jogadores")}</button>
      </footer>
    </div>`;
  }

  async mostrarPrevisao() {
    const zona = this.zonaPrev ?? zonaDaCena();
    const p = N.previsao();
    const hoje = agora().td;
    const dias = num(game.settings.get(MOD, "previsaoDias"), 5);
    const linhas = [];
    for (let td = hoje + 1; td <= hoje + dias; td++) {
      const c = p.dias?.[td]?.[zona];
      if (c) linhas.push(`<li><b>${esc(textoData(infoDia(td), { ano: false }))}</b>: <i class="fa-solid ${CLIMAS[c.tipo]?.icone ?? "fa-cloud"}"></i> ${esc(T(CLIMAS[c.tipo]?.nome ?? c.tipo))}, ${temperaturaTexto(c.temp)}</li>`);
    }
    if (!linhas.length) return ui.notifications.warn(T("Não há previsão para mostrar. Preencha a previsão primeiro."));
    await chat(`<i class="fa-solid fa-calendar-week"></i> <b>${T("Previsão do tempo · {regiao}", { regiao: esc(T(ZONAS[zona].nome)) })}</b><ul>${linhas.join("")}</ul>`);
  }

  /* ---------- aba: tempo de hoje ---------- */
  htmlTempo() {
    const cena = canvas?.scene;
    const { zona, est, pesos, soma, atual, base } = this.contexto();
    const zonaCena = cena?.getFlag(MOD, "zona") ?? "";
    const anOk = N.anomaliasLigadas();
    const an = climaCfg().zonas?.[zona]?.anomalia ?? { tipo: "nenhuma", texto: "" };
    const maxPeso = Math.max(1, ...Object.values(pesos));
    const rolando = this.sel === "__rolar";
    const tipoTopo = CLIMAS[this.sel] ? this.sel : atual?.tipo;
    const info = CLIMAS[tipoTopo];
    const tempTopo = this.temp ?? atual?.temp ?? base;
    const faixaTopo = this.faixa ?? (!CLIMAS[this.sel] && !this.mexeu ? atual : null);
    const anDe = N.anomaliaDe(zona);
    const anAtiva = anDe ? ANOMALIAS[anDe.tipo] : null;
    const rotuloTopo = rolando ? "Rolar de novo" : CLIMAS[this.sel] ? "Novo tempo" : `Hoje em ${ZONAS[zona].nome}`;
    const heroi = `<section class="cm-clima-heroi g-${rolando ? "rolar" : info?.grupo ?? "ceu"}">
        <div class="cm-clima-heroi-ico"><i class="fa-solid ${rolando ? "fa-dice" : info?.icone ?? "fa-cloud-sun"}"></i></div>
        <div class="cm-clima-heroi-txt">
          <small>${esc(rotuloTopo)} · ${esc(NOMES_ESTACAO[est])}</small>
          <h2>${rolando ? "Surpresa" : esc(info?.nome ?? "Ainda não rolado")}</h2>
          <p>${rolando ? `O clima de hoje será sorteado de novo pela tabela de ${esc(ZONAS[zona].nome)}.` : esc(info?.desc ?? "Escolha um tempo abaixo ou role pela tabela da região.")}</p>
          ${anAtiva ? `<span class="cm-clima-anom"><i class="fa-solid ${anAtiva.icone ?? "fa-skull"}"></i> ${esc(anAtiva.nome)}</span>` : ""}
        </div>
        <div class="cm-clima-heroi-temp">
          <b data-temp-topo>${rolando ? "?" : `${this.paraTela(tempTopo)}${this.un}`}</b>
          ${!rolando && faixaTopo?.min != null ? `<small>mín. ${this.paraTela(faixaTopo.min)} · máx. ${this.paraTela(faixaTopo.max)}</small>` : ""}
          ${!rolando && faixaTopo?.onda ? `<small class="cm-clima-onda"><i class="fa-solid fa-temperature-arrow-${faixaTopo.onda === "calor" ? "up" : "down"}"></i> onda de ${esc(faixaTopo.onda)}</small>` : ""}
        </div>
      </section>`;
    const filtros = [["todos", "Todos", "fa-layer-group"], ...Object.entries(GRUPOS_CLIMA).map(([k, r]) => [k, r, { ceu: "fa-cloud-sun", nevoa: "fa-smog", chuva: "fa-cloud-rain", frio: "fa-snowflake", vento: "fa-wind" }[k]])]
      .map(([k, r, ic]) => `<button type="button" class="${this.filtro === k ? "ativo" : ""}" data-action="filtro" data-grupo="${k}"><i class="fa-solid ${ic}"></i> ${esc(r)}</button>`).join("");
    const cartoes = Object.entries(CLIMAS)
      .filter(([k, c]) => (!c.daAnomalia || c.daAnomalia === ZONAS[zona]?.anomaliaFixa) && (this.filtro === "todos" || c.grupo === this.filtro) && (!this.soEstacao || pesos[k]))
      .map(([k, c]) => {
        const pct = pesos[k] ? Math.max(1, Math.round((pesos[k] / soma) * 100)) : 0;
        return `<button type="button" class="cm-clima-cartao g-${c.grupo} ${this.sel === k ? "escolhido" : ""} ${atual?.tipo === k ? "hoje" : ""} ${pct ? "" : "raro"}"
            data-action="escolher" data-tipo="${k}" data-tooltip="${esc(c.desc ?? "")}">
          <span class="cm-clima-selos">${atual?.tipo === k ? `<span class="cm-clima-hoje-selo">hoje</span>` : ""}${N.efeitoCena(k).weather || N.efeitoCena(k).preset ? `<i class="fa-solid fa-film" data-tooltip="Tem efeito na cena${N.efeitoCena(k).preset ? " (FXMaster)" : ""}"></i>` : ""}</span>
          <span class="cm-clima-cartao-ico"><i class="fa-solid ${c.icone}"></i></span>
          <span class="cm-clima-cartao-nome">${esc(c.nome)}</span>
          <span class="cm-clima-chance"><span style="width:${Math.round((pesos[k] ?? 0) / maxPeso * 100)}%"></span></span>
          <small>${pct ? `${pct}% nesta estação` : "raro aqui"}</small>
        </button>`;
      }).join("") || `<p class="cm-vazio">Nenhum tempo deste grupo acontece nesta estação.</p>`;
    const avancado = `<details class="cm-clima-avancado" ${this.avancadoAberto ? "open" : ""}>
        <summary><i class="fa-solid fa-sliders"></i> ${anOk && N.anomaliaRegiaoInteira() ? "Região da cena e anomalia ativa" : "Região da cena"}</summary>
        ${cena ? `<label>Região desta cena (${esc(cena.name)})<select name="zonaCena">
          <option value="" ${!zonaCena ? "selected" : ""}>Padrão do mundo (${esc(ZONAS[N.zonaPadraoValida()]?.nome)})</option>
          ${opcoes(ZONAS, zonaCena, (v) => v.nome)}</select></label>` : ""}
        ${cena ? (() => {
          const decisao = cena.getFlag(MOD, "climaNaCena");
          const marcado = decisao ?? (!!ZONAS[zonaCena] || !!N.planoClimaCena(cena).incluir);
          return `<label class="cm-check cm-clima-na-cena"><input type="checkbox" name="climaNaCena" ${marcado ? "checked" : ""}> ${T("Mostrar o efeito do clima nesta cena")}</label>
            <p class="cm-dica">${esc(N.planoClimaCena(cena).incluir ? T("Esta cena recebe o efeito do clima.") : N.planoClimaCena(cena).motivo)}</p>`;
        })() : ""}
        ${cena?.getFlag(MOD, "zonaAtiva") ? `<p class="cm-dica"><i class="fa-solid fa-map-location-dot"></i> O grupo está numa Região de clima do mapa; ela vale mais que a região da cena.</p>` : ""}
        ${anOk && ZONAS[zona]?.virtual ? `<p class="cm-dica"><i class="fa-solid ${anAtiva?.icone ?? "fa-skull"}"></i> Esta é a região da anomalia <b>${esc(anAtiva?.nome ?? "")}</b>: ela está sempre ativa aqui.</p>` : ""}
        ${anOk && N.anomaliaRegiaoInteira() && !ZONAS[zona]?.virtual ? `<label>Anomalia cobrindo ${esc(ZONAS[zona].nome)} inteira<select name="anomalia">${opcoes(ANOMALIAS, an.tipo, (v) => v.nome)}</select></label>` : ""}
        ${anOk && (ZONAS[zona]?.virtual || N.anomaliaRegiaoInteira()) ? `<label>Descrição da anomalia para os jogadores<textarea name="anTexto" rows="2" placeholder="Deixe vazio para usar o texto da anomalia">${esc(an.texto ?? "")}</textarea></label>` : ""}
        <p class="cm-dica">Os tempos, as regiões${anOk ? " e as anomalias" : ""} são criados e editados nas outras abas.</p>
      </details>`;
    const t = this.paraTela(tempTopo);
    return `${heroi}
      <nav class="cm-clima-abas">${filtros}
        <button type="button" class="cm-clima-estacao ${this.soEstacao ? "ativo" : ""}" data-action="estacao" data-tooltip="Mostrar só os tempos que acontecem nesta estação"><i class="fa-solid fa-filter"></i></button>
      </nav>
      <div class="cm-clima-lista">
        <div class="cm-clima-grade">${cartoes}</div>
        ${avancado}
      </div>
      <footer class="cm-clima-rodape">
        <button type="button" class="cm-clima-rolar ${rolando ? "ativo" : ""}" data-action="rolar" data-tooltip="Sortear o tempo e a temperatura de novo pela tabela da região"><i class="fa-solid fa-dice"></i> Rolar tempo</button>
        <div class="cm-clima-termo" data-tooltip="Temperatura do dia (${this.un})">
          <i class="fa-solid fa-temperature-half"></i>
          <input type="range" name="tempFaixa" min="${this.paraTela(-40)}" max="${this.paraTela(55)}" step="1" value="${t}" ${rolando ? "disabled" : ""}>
          <input type="number" name="temp" value="${t}" ${rolando ? "disabled" : ""}><span>${this.un}</span>
          <button type="button" class="cm-clima-dado" data-action="rolarTemp" ${rolando ? "disabled" : ""} data-tooltip="Rolar só a temperatura (com mínima e máxima) para este tempo"><i class="fa-solid fa-dice-d20"></i></button>
        </div>
        <span class="cm-esp"></span>
        <button type="button" data-action="cancelar">Cancelar</button>
        <button type="button" class="cm-clima-aplicar" data-action="aplicar"><i class="fa-solid fa-check"></i> Aplicar</button>
      </footer>`;
  }

  /* ---------- editores ---------- */
  /** Quantas cenas e Regiões do mapa usam esta região de clima. */
  usoDaZona(id) {
    let cenas = 0, regioes = 0;
    for (const sc of game.scenes) {
      if (sc.getFlag(MOD, "zona") === id) cenas++;
      for (const r of sc.regions ?? []) for (const b of r.behaviors ?? []) if (b.type === TIPO_CLIMA && b.system?.zona === id) regioes++;
    }
    return { cenas, regioes, padrao: N.zonaPadraoValida() === id };
  }

  /** Onde um clima é usado: regiões com chance dele e anomalias que forçam ou trocam para ele. */
  usoDoClima(id) {
    const zonas = Object.values(ZONAS).filter((z) => !z.virtual && Object.values(z.pesos ?? {}).some((p) => p[id] > 0)).map((z) => z.nome);
    const anoms = Object.entries(ANOMALIAS).filter(([k, a]) => k !== "nenhuma" && (a.clima === id || Object.entries(a.trocas ?? {}).some(([de, para]) => de === id || para === id) || Object.values(a.zona?.pesos ?? {}).some((p) => p[id] > 0))).map(([, a]) => a.nome);
    return { zonas, anoms };
  }

  /** Climas usados por um clima de cena (efeito) feito pelo mestre. */
  usoDoEfeito(id) {
    const chave = `${N.PREFIXO_EFEITO}${id}`;
    return Object.values(CLIMAS).filter((c) => c.efeito === chave || c.fx === chave).map((c) => c.nome);
  }

  /** Tipo aberto no editor (ou rascunho ainda não salvo). */
  tipoAberto(grupo) {
    const id = this.ed[grupo];
    return this.rascunhos[`${grupo}:${id}`] ?? MAPA_TIPOS[grupo]()[id];
  }

  /** Guarda o que está no formulário como rascunho (para redesenhar sem perder o que foi digitado). */
  guardarRascunho(grupo) {
    const id = this.ed[grupo];
    if (!id || !this.element?.querySelector(`.cm-ce-form[data-grupo="${grupo}"]`)) return;
    const antes = this.tipoAberto(grupo) ?? {};
    const d = this.lerEditor(grupo);
    if (grupo === "anomalias" && !d.zona && antes.zona) d.zona = antes.zona;
    if (antes.criada || !N.ehDeFabrica(grupo, id)) d.criada = true;
    this.rascunhos[`${grupo}:${id}`] = d;
  }

  listaEditor(grupo, atualId) {
    const mapa = MAPA_TIPOS[grupo]();
    const salvos = game.settings.get(MOD, "climaTipos")?.[grupo] ?? {};
    const rascunhos = Object.entries(this.rascunhos).filter(([k]) => k.startsWith(`${grupo}:`)).map(([k, d]) => [k.slice(grupo.length + 1), d]);
    const itens = [...Object.entries(mapa).filter(([k, d]) => k !== "nenhuma" && !d.virtual && !d.daAnomalia), ...rascunhos.filter(([id]) => !mapa[id])];
    const novo = { climas: "Novo clima", zonas: "Nova região", anomalias: "Nova anomalia", efeitos: "Novo efeito" }[grupo];
    const item = ([id, d]) => {
      const rasc = this.rascunhos[`${grupo}:${id}`];
      const marca = rasc ? (mapa[id] ? "alterações não salvas" : "não salvo") : N.ehDeFabrica(grupo, id) ? (salvos[id] ? "de fábrica · editado" : "de fábrica") : grupo === "anomalias" && d.regiao ? "criada · é uma região" : "criado por você";
      const v = rasc ?? d;
      const ic = grupo === "zonas" ? (v.elemento ? "fa-gem" : "fa-earth-americas") : grupo === "efeitos" ? "fa-wand-magic-sparkles" : (v.icone ?? "fa-skull");
      return `<button type="button" class="cm-ce-item ${grupo === "climas" ? `g-${v.grupo}` : ""} ${id === atualId ? "ativo" : ""}" data-action="editar" data-grupo="${grupo}" data-id="${id}">
        ${grupo === "climas" ? `<span class="cm-ce-bola"><i class="fa-solid ${ic}"></i></span>` : `<i class="fa-solid ${ic}"></i>`}<span><b>${esc(v.nome)}</b><small>${marca}</small></span></button>`;
    };
    const corpo = grupo === "climas"
      ? Object.entries(GRUPOS_CLIMA).map(([g, rot]) => { const doGrupo = itens.filter(([, d]) => d.grupo === g); return doGrupo.length ? `<h5>${esc(rot)}</h5>${doGrupo.map(item).join("")}` : ""; }).join("")
      : itens.map(item).join("") || (grupo === "efeitos" ? `<p class="cm-dica">Nenhum efeito criado ainda.</p>` : "");
    const troca = grupo === "climas" || grupo === "efeitos"
      ? `<div class="cm-ce-sub"><button type="button" class="${grupo === "climas" ? "ativo" : ""}" data-action="subClimas" data-sub="climas"><i class="fa-solid fa-cloud-sun"></i> Climas</button><button type="button" class="${grupo === "efeitos" ? "ativo" : ""}" data-action="subClimas" data-sub="efeitos"><i class="fa-solid fa-wand-magic-sparkles"></i> Efeitos</button></div>` : "";
    return `<aside class="cm-ce-lista">
      ${troca}
      <button type="button" class="cm-ce-novo" data-action="novo" data-grupo="${grupo}"><i class="fa-solid fa-plus"></i> ${novo}</button>
      ${corpo}
    </aside>`;
  }

  criar(grupo, duplicar = false) {
    const atual = this.tipoAberto(grupo);
    const id = `${grupo[0]}${foundry.utils.randomID(8)}`;
    const vazio = {
      climas: { nome: "", icone: "fa-cloud", grupo: "ceu", efeito: "", temp: 0, desc: "", fx: "", fxOpcoes: {} },
      zonas: foundry.utils.deepClone(ZONAS.temperada ?? Object.values(ZONAS).find((z) => !z.virtual)),
      anomalias: { nome: "", clima: "", base: "temperada", trocas: {}, climas: {}, regiao: false, temp: 0, icone: "fa-skull", texto: "" },
      efeitos: { nome: "", base: "rain", cor: "", forca: 1, velocidade: 1, tamanho: 1, direcao: null, base2: "", cor2: "", forca2: 1 }
    }[grupo];
    const base = duplicar && atual ? foundry.utils.deepClone(atual) : vazio;
    base.nome = duplicar ? `${base.nome} (cópia)` : { climas: "Novo clima", zonas: "Nova região", anomalias: "Nova anomalia", efeitos: "Novo efeito" }[grupo];
    base.criada = true;
    delete base.elemento; delete base.reserva; delete base.virtual; delete base.anomaliaFixa;
    if (grupo === "anomalias" && duplicar) {
      // os climas próprios ganham ids da cópia
      const climas = {}, mapa = {};
      for (const [gid, c] of Object.entries(base.climas ?? {})) { const novo = N.idClimaAnomalia(id, foundry.utils.randomID(6)); mapa[gid] = novo; climas[novo] = c; }
      const troca = (k) => mapa[k] ?? k;
      base.climas = climas;
      base.clima = troca(base.clima);
      base.trocas = Object.fromEntries(Object.entries(base.trocas ?? {}).map(([de, para]) => [troca(de), troca(para)]));
      if (base.zona) for (const e of N.ESTACOES_CLIMA) base.zona.pesos[e] = Object.fromEntries(Object.entries(base.zona.pesos?.[e] ?? {}).map(([k, v]) => [troca(k), v]));
    }
    this.rascunhos[`${grupo}:${id}`] = base;
    this.ed[grupo] = id;
    this.render();
  }

  rodapeEditor(grupo, { fabrica, editada, novo, alterado, extra = "" }) {
    const nome = { climas: "clima", zonas: "região", anomalias: "anomalia", efeitos: "efeito" }[grupo];
    return `<footer class="cm-ce-acoes">
      ${extra}
      <button type="button" data-action="duplicar" data-grupo="${grupo}"><i class="fa-solid fa-copy"></i> Duplicar</button>
      ${alterado ? `<button type="button" data-action="descartar" data-grupo="${grupo}"><i class="fa-solid fa-xmark"></i> Descartar alterações</button>` : ""}
      ${editada && !alterado ? `<button type="button" data-action="restaurar" data-grupo="${grupo}"><i class="fa-solid fa-rotate-left"></i> Restaurar de fábrica</button>` : ""}
      ${!fabrica && !alterado ? `<button type="button" class="cm-ce-perigo" data-action="apagarTipo" data-grupo="${grupo}"><i class="fa-solid fa-trash"></i> ${novo ? "Descartar" : "Apagar"}</button>` : ""}
      <span class="cm-esp"></span>
      <button type="button" class="cm-clima-aplicar" data-action="salvarTipo" data-grupo="${grupo}"><i class="fa-solid fa-floppy-disk"></i> Salvar ${nome}</button>
    </footer>`;
  }

  estado(grupo) {
    const id = this.ed[grupo];
    const fabrica = N.ehDeFabrica(grupo, id);
    const rasc = !!this.rascunhos[`${grupo}:${id}`];
    const existe = !!MAPA_TIPOS[grupo]()[id];
    return { id, fabrica, editada: fabrica && !!game.settings.get(MOD, "climaTipos")?.[grupo]?.[id], novo: rasc && !existe, alterado: rasc && existe };
  }

  /** <select> de efeito na cena: Foundry, Calendário, seus efeitos e partículas do FXMaster. */
  opcoesEfeito(atual, vazio, { semPersonalizados = false } = {}) {
    const W = CONFIG.weatherEffects ?? {};
    const rot = (k) => { const l = W[k]?.label ?? k; try { return game.i18n?.localize?.(l) ?? l; } catch { return l; } };
    const grupos = [
      ["Foundry", Object.keys(W).filter((k) => !k.startsWith("cm-") && !k.startsWith(N.PREFIXO_EFEITO) && !k.startsWith("fxmaster."))],
      ["Calendário da Mesa", Object.keys(W).filter((k) => k.startsWith("cm-"))],
      ...(semPersonalizados ? [] : [["Seus efeitos", Object.keys(W).filter((k) => k.startsWith(N.PREFIXO_EFEITO) && k !== `${N.PREFIXO_EFEITO}teste`)]]),
      ["FXMaster (partículas)", Object.keys(W).filter((k) => k.startsWith("fxmaster."))]
    ];
    return `<option value="" ${!atual ? "selected" : ""}>${esc(vazio)}</option>` +
      grupos.filter(([, ks]) => ks.length).map(([g, ks]) => `<optgroup label="${esc(g)}">${ks.map((k) => `<option value="${esc(k)}" ${atual === k ? "selected" : ""}>${esc(rot(k))}</option>`).join("")}</optgroup>`).join("") +
      (atual && !W[atual] ? `<option value="${esc(atual)}" selected>${esc(atual)} (não encontrado neste mundo)</option>` : "");
  }

  /** Tabela de chances (pesos por estação). climas = [[id, clima]]. */
  tabelaPesos(pesos, climas) {
    const somas = Object.fromEntries(N.ESTACOES_CLIMA.map((e) => [e, Object.values(pesos?.[e] ?? {}).reduce((x, y) => x + y, 0)]));
    const linhas = Object.entries(GRUPOS_CLIMA).map(([g, rot]) => {
      const doGrupo = climas.filter(([, c]) => c.grupo === g);
      if (!doGrupo.length) return "";
      return `<tr class="cm-ce-grupo"><th colspan="5">${esc(rot)}</th></tr>` + doGrupo.map(([k, c]) => `<tr>
        <td class="cm-ce-tipo g-${c.grupo}"><span class="cm-ce-bola"><i class="fa-solid ${c.icone}"></i></span> ${esc(c.nome)}${c.daAnomalia ? ` <small class="cm-ce-novo-selo">desta anomalia</small>` : N.ehDeFabrica("climas", k) ? "" : ` <small class="cm-ce-novo-selo">novo</small>`}</td>
        ${N.ESTACOES_CLIMA.map((e) => `<td><input type="number" min="0" max="1000" step="1" name="peso.${e}.${k}" value="${pesos?.[e]?.[k] ?? 0}" data-estacao="${e}"></td>`).join("")}
      </tr>`).join("");
    }).join("");
    return `<div class="cm-ce-tabela-caixa"><table class="cm-ce-tabela">
      <thead><tr><th>Clima</th>${N.ESTACOES_CLIMA.map((e) => `<th>${esc(NOMES_ESTACAO[e])}<small data-soma="${e}" class="${somas[e] ? "" : "zero"}">soma ${somas[e]}</small></th>`).join("")}</tr></thead>
      <tbody>${linhas}</tbody>
    </table></div>`;
  }

  /** Temperatura média por estação + variação. */
  camposTemperatura(z) {
    return `<div class="cm-ce-temps cinco">${N.ESTACOES_CLIMA.map((e) => `<label>Média · ${esc(NOMES_ESTACAO[e])}<input type="number" name="temp.${e}" value="${this.paraTela(z?.temp?.[e] ?? 15)}"></label>`).join("")}
      <label data-tooltip="Quanto um dia comum pode fugir da média, para cima ou para baixo. Os extremos (raros) chegam a 1,5× isso, mais as ondas de calor e frio.">Variação ± <input type="number" name="variacao" min="1" max="40" value="${this.difTela(z?.variacao ?? 10)}"></label></div>`;
  }

  lerTemperaturaEPesos(f, climasValidos) {
    const v = (n) => f?.querySelector(`[name="${n}"]`);
    const temp = {}, pesos = {};
    for (const e of N.ESTACOES_CLIMA) {
      temp[e] = this.deTela(num(v(`temp.${e}`)?.value, 15));
      pesos[e] = {};
      f.querySelectorAll(`[name^="peso.${e}."]`).forEach((el) => { const k = el.name.slice(`peso.${e}.`.length); const n = num(el.value, 0); if (n > 0 && (!climasValidos || climasValidos(k))) pesos[e][k] = n; });
    }
    return { temp, variacao: Math.max(1, this.difDeTela(num(v("variacao")?.value, 10))), pesos };
  }

  /* ---------- aba: climas ---------- */
  htmlClimas() {
    if (this.subClimas === "efeitos") return this.htmlEfeitos();
    if (!this.tipoAberto("climas") || this.tipoAberto("climas").daAnomalia) this.ed.climas = Object.keys(CLIMAS).find((k) => !CLIMAS[k].daAnomalia);
    const st = this.estado("climas");
    const c = this.tipoAberto("climas");
    const uso = this.usoDoClima(st.id);
    const api = N.apiFx(), ligado = game.settings.get(MOD, "usarFXMaster") !== false;
    const presets = api ? N.presetsFx() : N.PRESETS_FX_CONHECIDOS;
    const particulas = Object.keys(CONFIG.weatherEffects ?? {}).filter((k) => k.startsWith("fxmaster."));
    const fxAtual = c.fx ?? "";
    const fxOp = `<option value="" ${!fxAtual ? "selected" : ""}>— nenhum: usa o efeito do Foundry —</option>
      <optgroup label="Presets do FXMaster">${presets.map((p) => `<option value="fxp:${esc(p)}" ${fxAtual === `fxp:${p}` ? "selected" : ""}>${esc(p)}</option>`).join("")}</optgroup>
      ${particulas.length ? `<optgroup label="Partículas do FXMaster">${particulas.map((k) => `<option value="${esc(k)}" ${fxAtual === k ? "selected" : ""}>${esc(k.slice(9))}</option>`).join("")}</optgroup>` : ""}
      ${fxAtual && !presets.includes(fxAtual.slice(4)) && !particulas.includes(fxAtual) ? `<option value="${esc(fxAtual)}" selected>${esc(fxAtual.replace(/^fxp:/, ""))} (não encontrado)</option>` : ""}`;
    const niveis = (atual) => [["", "padrão"], ["very-low", "muito baixa"], ["low", "baixa"], ["medium", "média"], ["high", "alta"], ["very-high", "muito alta"]].map(([k, r]) => `<option value="${k}" ${(atual ?? "") === k ? "selected" : ""}>${r}</option>`).join("");
    const o = c.fxOpcoes ?? {};
    const situacaoFx = !api ? "O FXMaster não está ativo neste mundo: o clima usa o efeito do Foundry. A escolha abaixo fica guardada para quando ele estiver." : !ligado ? "A opção \"Usar o FXMaster nos climas\" está desligada nas configurações." : fxAtual ? "Com o FXMaster ativo, este clima usa o efeito dele no lugar do efeito do Foundry." : "Sem efeito do FXMaster: usa o efeito do Foundry.";
    const efeitoInfo = c.efeito ? (CONFIG.weatherEffects?.[c.efeito] ? "com efeito na cena" : "efeito não encontrado") : "sem efeito na cena";
    return `<div class="cm-ce">
      ${this.listaEditor("climas", st.id)}
      <section class="cm-ce-form" data-grupo="climas">
        <div class="cm-ce-corpo">
          <div class="cm-ce-previa g-${c.grupo}"><span class="cm-ce-bola grande"><i class="fa-solid ${c.icone ?? "fa-cloud"}"></i></span>
            <div><b>${esc(c.nome || "Sem nome")}</b><small>${esc(GRUPOS_CLIMA[c.grupo] ?? "")} · ${c.temp > 0 ? "+" : ""}${this.difTela(c.temp ?? 0)}${this.un} · ${efeitoInfo}${fxAtual ? ` · FXMaster: ${esc(fxAtual.replace(/^fxp:|^fxmaster\./, ""))}` : ""}</small>
            <small>${st.novo ? "Ainda não salvo." : uso.zonas.length || uso.anoms.length ? `Usado em: ${esc([...uso.zonas, ...uso.anoms].join(", "))}` : "Nenhuma região dá chance a este clima ainda (aba Regiões)."}</small></div></div>
          <div class="cm-ce-campos">
            <label>Nome<input type="text" name="nome" value="${esc(c.nome)}" maxlength="60" placeholder="Ex.: Chuva seca"></label>
            <label>Grupo<select name="grupo">${Object.entries(GRUPOS_CLIMA).map(([k, r]) => `<option value="${k}" ${c.grupo === k ? "selected" : ""}>${esc(r)}</option>`).join("")}</select></label>
            <label>Ícone<select name="icone">${opcoesIcone(c.icone)}</select></label>
            <label>Efeito na cena (Foundry)<select name="efeito">${this.opcoesEfeito(c.efeito, "— nenhum (sem efeito na cena) —")}</select></label>
            <label>Muda a temperatura do dia em (${this.un})<input type="number" name="temp" value="${this.difTela(c.temp ?? 0)}"></label>
            <label class="cm-ce-largo">Descrição (vai para o chat)<textarea name="desc" rows="2" placeholder="O que os personagens veem e sentem.">${esc(c.desc ?? "")}</textarea></label>
          </div>
          <h4><i class="fa-solid fa-wand-sparkles"></i> FXMaster <small>${esc(situacaoFx)}</small></h4>
          <div class="cm-ce-campos cm-ce-fx">
            <label class="cm-ce-largo">Efeito do FXMaster<select name="fx">${fxOp}</select></label>
            <label>Densidade<select name="fxDensidade">${niveis(o.densidade)}</select></label>
            <label>Velocidade<select name="fxVelocidade">${niveis(o.velocidade)}</select></label>
            <label class="cm-ce-cor"><span><input type="checkbox" name="fxUsarCor" ${o.cor ? "checked" : ""}> Mudar a cor (só presets)</span><input type="color" name="fxCor" value="${esc(o.cor || "#88ccff")}"></label>
          </div>
          <p class="cm-dica">Para um visual só seu (chuva vermelha, neblina roxa...), crie um efeito em <b>Efeitos</b> (botão no alto da lista) e escolha-o em "Efeito na cena".</p>
        </div>
        ${this.rodapeEditor("climas", st)}
      </section>
    </div>`;
  }

  /* ---------- climas › efeitos (variações dos efeitos de clima) ---------- */
  htmlEfeitos() {
    const mapa = MAPA_TIPOS.efeitos();
    if (!this.tipoAberto("efeitos")) this.ed.efeitos = Object.keys(mapa)[0] ?? null;
    const st = this.estado("efeitos");
    const e = this.tipoAberto("efeitos");
    if (!e) {
      return `<div class="cm-ce">${this.listaEditor("efeitos", null)}
        <section class="cm-ce-form" data-grupo="efeitos"><div class="cm-ce-corpo"><div class="cm-ce-vazio-grande">
          <i class="fa-solid fa-wand-magic-sparkles"></i>
          <h3>Seus efeitos de clima</h3>
          <p>Faça versões dos efeitos do Foundry, do Calendário ou do FXMaster: mude a cor, a força, a velocidade, o tamanho e a direção, e junte dois efeitos num só. Exemplos: chuva vermelha, neblina roxa, neve dourada, chuva com neve, tempestade com névoa baixa.</p>
          <button type="button" class="cm-clima-aplicar" data-action="novo" data-grupo="efeitos"><i class="fa-solid fa-plus"></i> Novo efeito</button>
        </div></div></section></div>`;
    }
    const aj = N.ajustesDoEfeito(e.base);
    const aj2 = e.base2 ? N.ajustesDoEfeito(e.base2) : null;
    const uso = st.novo ? [] : this.usoDoEfeito(st.id);
    const desl = (ok) => (ok ? "" : "disabled");
    const dica = (ok) => (ok ? "" : ` data-tooltip="Esta base não tem esse ajuste"`);
    const faixa = (nome, rot, min, max, passo, valor, ok, sufixo = "×") => `<label class="cm-ce-faixa ${ok ? "" : "off"}"${dica(ok)}>${rot}
      <span><input type="range" name="${nome}" min="${min}" max="${max}" step="${passo}" value="${valor}" ${desl(ok)}><output data-saida="${nome}">${valor}${sufixo}</output></span></label>`;
    const testando = this.testando ? `<button type="button" data-action="pararTeste"><i class="fa-solid fa-stop"></i> Parar de ver</button>` : `<button type="button" data-action="testarEfeito" ${canvas?.scene ? "" : "disabled"} data-tooltip="Mostra este efeito só para você, na cena aberta, sem salvar"><i class="fa-solid fa-eye"></i> Ver nesta cena</button>`;
    return `<div class="cm-ce">
      ${this.listaEditor("efeitos", st.id)}
      <section class="cm-ce-form" data-grupo="efeitos">
        <div class="cm-ce-corpo">
          <div class="cm-ce-previa"><span class="cm-ce-bola grande efeito" style="${e.cor ? `--cor-ef:${esc(e.cor)}` : ""}"><i class="fa-solid fa-wand-magic-sparkles"></i></span>
            <div><b>${esc(e.nome || "Sem nome")}</b><small>Base: ${esc(CONFIG.weatherEffects?.[e.base]?.label ?? e.base)}${e.base2 ? ` + ${esc(CONFIG.weatherEffects?.[e.base2]?.label ?? e.base2)}` : ""}</small>
            <small>${st.novo ? "Ainda não salvo." : uso.length ? `Usado nos climas: ${esc(uso.join(", "))}` : `Nenhum clima usa este efeito ainda (aba Climas → "Efeito na cena").`}</small></div></div>
          <div class="cm-ce-campos">
            <label>Nome<input type="text" name="nome" value="${esc(e.nome)}" maxlength="60" placeholder="Ex.: Chuva de sangue"></label>
            <label>Efeito base<select name="base">${this.opcoesEfeito(e.base, "— escolha —", { semPersonalizados: true })}</select></label>
          </div>
          <h4>Ajustes</h4>
          <div class="cm-ce-campos">
            <label class="cm-ce-cor ${aj.cor ? "" : "off"}"${dica(aj.cor)}><span><input type="checkbox" name="usarCor" ${e.cor ? "checked" : ""} ${desl(aj.cor)}> Mudar a cor</span><input type="color" name="cor" value="${esc(e.cor || "#c0392b")}" ${desl(aj.cor)}></label>
            ${faixa("forca", "Força", 0.1, 3, 0.05, e.forca, aj.forca)}
            ${faixa("velocidade", "Velocidade", 0, 3, 0.05, e.velocidade, aj.velocidade)}
            ${faixa("tamanho", "Tamanho", 0.3, 3, 0.05, e.tamanho, aj.tamanho)}
            <label class="cm-ce-faixa ${aj.direcao ? "" : "off"}"${dica(aj.direcao)}><span><input type="checkbox" name="usarDirecao" ${e.direcao != null ? "checked" : ""} ${desl(aj.direcao)}> Direção</span>
              <span><input type="range" name="direcao" min="0" max="360" step="5" value="${e.direcao ?? 15}" ${desl(aj.direcao)}><output data-saida="direcao">${e.direcao ?? 15}°</output></span></label>
          </div>
          <h4>Juntar com outro efeito <small>(opcional)</small></h4>
          <div class="cm-ce-campos">
            <label>Segundo efeito<select name="base2">${this.opcoesEfeito(e.base2, "— nenhum —", { semPersonalizados: true })}</select></label>
            <label class="cm-ce-cor ${aj2?.cor ? "" : "off"}"><span><input type="checkbox" name="usarCor2" ${e.cor2 ? "checked" : ""} ${desl(aj2?.cor)}> Cor do segundo</span><input type="color" name="cor2" value="${esc(e.cor2 || "#9b59b6")}" ${desl(aj2?.cor)}></label>
            ${faixa("forca2", "Força do segundo", 0.1, 3, 0.05, e.forca2, !!aj2?.forca)}
          </div>
          <p class="cm-dica">Os ajustes que a base não tem ficam apagados. Velocidade, tamanho e direção valem para o primeiro efeito. Depois de salvo, o efeito aparece em "Efeito na cena", no grupo "Seus efeitos".</p>
        </div>
        ${this.rodapeEditor("efeitos", { ...st, extra: testando })}
      </section>
    </div>`;
  }

  /* ---------- aba: regiões ---------- */
  htmlZonas() {
    if (!this.tipoAberto("zonas") || this.tipoAberto("zonas").virtual) this.ed.zonas = ZONAS[N.zonaPadraoValida()]?.virtual ? "temperada" : N.zonaPadraoValida();
    const st = this.estado("zonas");
    const id = st.id;
    const z = this.tipoAberto("zonas");
    const uso = this.usoDaZona(id);
    const extra = !st.novo && !uso.padrao ? `<button type="button" data-action="tornarPadrao"><i class="fa-solid fa-star"></i> Tornar padrão do mundo</button>` : "";
    return `<div class="cm-ce">
      ${this.listaEditor("zonas", id)}
      <section class="cm-ce-form" data-grupo="zonas">
        <div class="cm-ce-cab">
          <label class="cm-ce-nome">Nome<input type="text" name="nome" value="${esc(z.nome)}" maxlength="80"></label>
          <label class="cm-check"><input type="checkbox" name="elemento" ${z.elemento ? "checked" : ""}> Reino de elemento</label>
        </div>
        <p class="cm-dica">${st.novo ? "Ainda não salva." : uso.cenas || uso.regioes || uso.padrao ? `Em uso: ${[uso.padrao ? "região padrão do mundo" : "", uso.cenas ? `${uso.cenas} cena(s)` : "", uso.regioes ? `${uso.regioes} Região(ões) do mapa` : ""].filter(Boolean).join(", ")}.` : "Nenhuma cena usa esta região ainda."}</p>
        <h4>Temperatura (${this.un})</h4>
        ${this.camposTemperatura(z)}
        <h4>Chance de cada clima <small>(peso; 0 = nunca. A % é calculada sobre a soma da estação.)</small></h4>
        ${this.tabelaPesos(z.pesos, Object.entries(CLIMAS).filter(([, c]) => !c.daAnomalia))}
        ${this.rodapeEditor("zonas", { ...st, extra })}
      </section>
    </div>`;
  }

  /* ---------- aba: anomalias ---------- */
  /** Climas que valem dentro desta anomalia: os comuns + os dela (do rascunho, se houver). */
  climasDaAnomalia(a) {
    return [...Object.entries(CLIMAS).filter(([, c]) => !c.daAnomalia), ...Object.entries(a?.climas ?? {}).map(([gid, c]) => [gid, { ...c, daAnomalia: this.ed.anomalias }])];
  }

  opcoesTempoAnomalia(a, atual, vazio) {
    const lista = this.climasDaAnomalia(a);
    return `${vazio != null ? `<option value="" ${!atual ? "selected" : ""}>${esc(vazio)}</option>` : ""}` +
      Object.entries(GRUPOS_CLIMA).map(([g, rot]) => `<optgroup label="${esc(rot)}">${lista.filter(([, c]) => c.grupo === g).map(([k, c]) => `<option value="${k}" ${atual === k ? "selected" : ""}>${esc(c.nome)}${c.daAnomalia ? " ★" : ""}</option>`).join("")}</optgroup>`).join("");
  }

  linhaTroca(de, para, a = this.tipoAberto("anomalias")) {
    return `<tr><td><select name="trocaDe">${this.opcoesTempoAnomalia(a, de, "— escolha —")}</select></td><td class="cm-ce-seta"><i class="fa-solid fa-arrow-right"></i></td>
      <td><select name="trocaPara">${this.opcoesTempoAnomalia(a, para, "— escolha —")}</select></td>
      <td><button type="button" class="cm-ce-x" data-action="tirarLinha" data-tooltip="Tirar"><i class="fa-solid fa-xmark"></i></button></td></tr>`;
  }

  linhaClimaLocal(gid, c) {
    return `<div class="cm-ce-local g-${c.grupo}" data-gid="${esc(gid)}">
      <span class="cm-ce-bola"><i class="fa-solid ${c.icone ?? "fa-cloud"}"></i></span>
      <input type="text" name="lcNome" value="${esc(c.nome)}" maxlength="60" placeholder="Nome (ex.: Chuva seca)">
      <select name="lcGrupo">${Object.entries(GRUPOS_CLIMA).map(([k, r]) => `<option value="${k}" ${c.grupo === k ? "selected" : ""}>${esc(r)}</option>`).join("")}</select>
      <select name="lcIcone">${opcoesIcone(c.icone)}</select>
      <select name="lcEfeito">${this.opcoesEfeito(c.efeito, "— sem efeito —")}</select>
      <input type="number" name="lcTemp" value="${this.difTela(c.temp ?? 0)}" data-tooltip="Muda a temperatura do dia (${this.un})">
      <button type="button" class="cm-ce-x" data-action="tirarLinha" data-tooltip="Tirar este clima"><i class="fa-solid fa-xmark"></i></button>
      <input type="text" name="lcDesc" class="cm-ce-local-desc" value="${esc(c.desc ?? "")}" maxlength="300" placeholder="Descrição para o chat">
    </div>`;
  }

  htmlAnomalias() {
    const ids = Object.keys(ANOMALIAS).filter((k) => k !== "nenhuma");
    if (!this.tipoAberto("anomalias") || this.ed.anomalias === "nenhuma") this.ed.anomalias = ids[0];
    const st = this.estado("anomalias");
    const id = st.id;
    const a = this.tipoAberto("anomalias");
    if (!a) return `<div class="cm-ce">${this.listaEditor("anomalias", null)}<section class="cm-ce-form"><p class="cm-vazio">Nenhuma anomalia. Crie uma com "Nova anomalia".</p></section></div>`;
    const regiaoId = `${N.PREFIXO_ANOM}${id}`;
    const usoRegiao = ZONAS[regiaoId] ? this.usoDaZona(regiaoId) : { cenas: 0, regioes: 0 };
    const inteira = N.anomaliaRegiaoInteira();
    const ativas = inteira ? Object.entries(climaCfg().zonas ?? {}).filter(([, v]) => v?.anomalia?.tipo === id).map(([z]) => ZONAS[z]?.nome ?? z) : [];
    const trocas = Object.entries(a.trocas ?? {});
    const locais = Object.entries(a.climas ?? {});
    const nomeClima = (k) => CLIMAS[k]?.nome ?? a.climas?.[k]?.nome ?? k;
    const resumoTrocas = trocas.length ? trocas.map(([de, para]) => `${nomeClima(de)} → ${nomeClima(para)}`).join(", ") : "";
    const zona = a.zona ?? ZONAS[a.base] ?? ZONAS.temperada;
    const situacao = [
      a.regiao ? (st.novo || st.alterado ? `Ao salvar, vira a região "${a.nome}"` : `É a região "${a.nome}"${usoRegiao.cenas || usoRegiao.regioes ? `, usada em ${[usoRegiao.cenas ? `${usoRegiao.cenas} cena(s)` : "", usoRegiao.regioes ? `${usoRegiao.regioes} Região(ões) do mapa` : ""].filter(Boolean).join(" e ")}` : ""}`) : "Não é uma região",
      ativas.length ? `cobre: ${ativas.join(", ")}` : ""
    ].filter(Boolean).join(" · ");
    const regioesModelo = Object.entries(ZONAS).filter(([, z]) => !z.virtual).map(([k, z]) => `<option value="${k}" ${(a.base ?? "temperada") === k ? "selected" : ""}>${esc(z.nome)}</option>`).join("");
    return `<div class="cm-ce">
      ${this.listaEditor("anomalias", id)}
      <section class="cm-ce-form" data-grupo="anomalias">
        <div class="cm-ce-corpo">
        <div class="cm-ce-previa"><span class="cm-ce-bola grande anom"><i class="fa-solid ${a.icone ?? "fa-skull"}"></i></span>
          <div><b>${esc(a.nome || "Sem nome")}</b><small>${a.clima ? `Força: ${esc(nomeClima(a.clima))}` : resumoTrocas ? `Troca: ${esc(resumoTrocas)}` : "Não mexe no tempo"} · ${a.temp > 0 ? "+" : ""}${this.difTela(a.temp ?? 0)}${this.un}${locais.length ? ` · ${locais.length} clima(s) próprio(s)` : ""}</small>
          <small>${esc(situacao)}</small></div></div>
        <div class="cm-ce-campos">
          <label>Nome<input type="text" name="nome" value="${esc(a.nome)}" maxlength="80" placeholder="Ex.: Eclipse eterno"></label>
          <label>Ícone<select name="icone">${opcoesIcone(a.icone)}</select></label>
          <label>Tempo forçado<select name="clima">${this.opcoesTempoAnomalia(a, a.clima, "— não força: usa as chances e trocas —")}</select></label>
          <label>Muda a temperatura em (${this.un})<input type="number" name="temp" value="${this.difTela(a.temp ?? 0)}"></label>
          <label class="cm-ce-largo">Texto para os jogadores<textarea name="texto" rows="2" placeholder="O que os personagens percebem enquanto a anomalia está ativa.">${esc(a.texto ?? "")}</textarea></label>
        </div>

        <h4><i class="fa-solid fa-cloud-sun"></i> Climas desta anomalia <small>(só existem aqui; não mudam os climas da aba Climas)</small></h4>
        <div class="cm-ce-locais">
          ${locais.map(([gid, c]) => this.linhaClimaLocal(gid, c)).join("") || `<p class="cm-dica">Nenhum. Ex.: uma "Chuva seca" com nuvens carregadas e sem efeito de chuva, para trocar com a Chuva.</p>`}
          <button type="button" class="cm-ce-mais" data-action="maisLocal"><i class="fa-solid fa-plus"></i> Novo clima desta anomalia</button>
        </div>

        <h4><i class="fa-solid fa-right-left"></i> Trocar climas <small>(enquanto ativa; não vale se ela forçar um tempo)</small></h4>
        <div class="cm-ce-trocas">
          <table><tbody>${trocas.map(([de, para]) => this.linhaTroca(de, para, a)).join("")}${trocas.length ? "" : this.linhaTroca("", "", a)}</tbody></table>
          <button type="button" class="cm-ce-mais" data-action="maisTroca"><i class="fa-solid fa-plus"></i> Adicionar troca</button>
        </div>

        <h4><i class="fa-solid fa-map-location-dot"></i> Usar como região</h4>
        <label class="cm-ce-chave"><input type="checkbox" name="regiao" ${a.regiao ? "checked" : ""}>
          <span><b>Gerar a região "${esc(a.nome || "…")}"</b><small>Ligado: aparece na lista de regiões das Regiões do mapa e das cenas, com o clima configurado aqui e a anomalia sempre ativa. Desligado: a região some (os lugares que a usavam voltam para a região padrão).</small></span></label>
        ${a.regiao ? `<div class="cm-ce-regiao">
          <div class="cm-ce-copiar"><label>Copiar o clima de<select name="copiarDe">${regioesModelo}</select></label>
            <button type="button" data-action="copiarClimaDe"><i class="fa-solid fa-copy"></i> Copiar</button>
            <span class="cm-dica">Copia temperaturas e chances de uma região como ponto de partida. O que for salvo aqui fica só na anomalia.</span></div>
          <h4>Temperatura (${this.un})</h4>
          ${this.camposTemperatura(zona)}
          <h4>Chance de cada clima <small>(peso; 0 = nunca)</small></h4>
          ${this.tabelaPesos(zona.pesos, this.climasDaAnomalia(a))}
        </div>` : ""}
        </div>
        ${this.rodapeEditor("anomalias", st)}
      </section>
    </div>`;
  }

  /** Lê o formulário do editor aberto. */
  lerEditor(grupo) {
    const f = this.element.querySelector(`.cm-ce-form[data-grupo="${grupo}"]`);
    const v = (n) => f?.querySelector(`[name="${n}"]`);
    if (grupo === "zonas") {
      return { nome: v("nome")?.value.trim() || "Região sem nome", elemento: !!v("elemento")?.checked, ...this.lerTemperaturaEPesos(f) };
    }
    if (grupo === "climas") {
      return {
        nome: v("nome")?.value.trim() || "Clima sem nome", grupo: v("grupo")?.value, icone: v("icone")?.value, efeito: v("efeito")?.value ?? "",
        temp: this.difDeTela(num(v("temp")?.value, 0)), desc: v("desc")?.value ?? "",
        fx: v("fx")?.value ?? "", fxOpcoes: { densidade: v("fxDensidade")?.value ?? "", velocidade: v("fxVelocidade")?.value ?? "", cor: v("fxUsarCor")?.checked ? v("fxCor")?.value : "" }
      };
    }
    if (grupo === "efeitos") {
      return {
        nome: v("nome")?.value.trim() || "Efeito sem nome", base: v("base")?.value || "rain",
        cor: v("usarCor")?.checked ? v("cor")?.value : "", forca: num(v("forca")?.value, 1), velocidade: num(v("velocidade")?.value, 1), tamanho: num(v("tamanho")?.value, 1),
        direcao: v("usarDirecao")?.checked ? num(v("direcao")?.value, 0) : null,
        base2: v("base2")?.value ?? "", cor2: v("usarCor2")?.checked ? v("cor2")?.value : "", forca2: num(v("forca2")?.value, 1)
      };
    }
    // anomalias
    const climas = {};
    f.querySelectorAll(".cm-ce-local").forEach((el) => {
      const q = (n) => el.querySelector(`[name="${n}"]`)?.value;
      climas[el.dataset.gid] = { nome: q("lcNome")?.trim() || "Clima sem nome", grupo: q("lcGrupo"), icone: q("lcIcone"), efeito: q("lcEfeito") ?? "", temp: this.difDeTela(num(q("lcTemp"), 0)), desc: q("lcDesc") ?? "" };
    });
    const trocas = {};
    f.querySelectorAll(".cm-ce-trocas tbody tr").forEach((tr) => {
      const de = tr.querySelector('[name="trocaDe"]')?.value, para = tr.querySelector('[name="trocaPara"]')?.value;
      if (de && para && de !== para) trocas[de] = para;
    });
    const regiaoBox = f.querySelector(".cm-ce-regiao");
    const valido = (k) => (CLIMAS[k] && !CLIMAS[k].daAnomalia) || !!climas[k];
    return {
      nome: v("nome")?.value.trim() || "Anomalia sem nome", icone: v("icone")?.value, clima: v("clima")?.value ?? "", trocas, climas,
      temp: this.difDeTela(num(v("temp")?.value, 0)), texto: v("texto")?.value ?? "",
      base: v("copiarDe")?.value || this.tipoAberto("anomalias")?.base || "temperada",
      regiao: !!v("regiao")?.checked,
      ...(regiaoBox ? { zona: this.lerTemperaturaEPesos(regiaoBox, valido) } : {})
    };
  }

  async salvarTipo(grupo) {
    const id = this.ed[grupo];
    if (!id) return;
    const dados = this.lerEditor(grupo);
    const antes = this.tipoAberto(grupo);
    if (grupo === "anomalias" && !dados.zona && antes?.zona) dados.zona = antes.zona;
    const pesos = grupo === "zonas" ? dados.pesos : grupo === "anomalias" && dados.regiao && dados.zona ? dados.zona.pesos : null;
    if (pesos) {
      const vazias = N.ESTACOES_CLIMA.filter((e) => !Object.keys(pesos[e] ?? {}).length);
      if (vazias.length) return ui.notifications.warn(`Dê chance a pelo menos um clima em: ${vazias.map((e) => NOMES_ESTACAO[e]).join(", ")}.`);
    }
    if (grupo === "anomalias" && dados.regiao && !dados.zona) {
      const m = ZONAS[dados.base] ?? ZONAS.temperada;
      dados.zona = { temp: { ...m.temp }, variacao: m.variacao ?? 10, pesos: foundry.utils.deepClone(m.pesos) };
    }
    if (!N.ehDeFabrica(grupo, id)) dados.criada = true;
    if (grupo === "efeitos") N.pararPreviaEfeito();
    await N.salvarTipoDeClima(grupo, id, dados);
    delete this.rascunhos[`${grupo}:${id}`];
    ui.notifications.info(`"${dados.nome}" salvo.`);
    this.render();
  }

  async restaurar(grupo) {
    const id = this.ed[grupo];
    const ok = await Dialogo().confirm({ window: { title: "Restaurar de fábrica" }, content: `<p>Voltar <b>${esc(MAPA_TIPOS[grupo]()[id]?.nome)}</b> para os valores originais do módulo?</p>` });
    if (!ok) return;
    await N.salvarTipoDeClima(grupo, id, null);
    this.render();
  }

  async apagarTipo(grupo) {
    const id = this.ed[grupo];
    if (!id || N.ehDeFabrica(grupo, id)) return;
    if (this.rascunhos[`${grupo}:${id}`] && !MAPA_TIPOS[grupo]()[id]) { delete this.rascunhos[`${grupo}:${id}`]; this.ed[grupo] = null; return this.render(); }
    let aviso = "";
    if (grupo === "zonas") {
      const u = this.usoDaZona(id);
      if (u.cenas || u.regioes || u.padrao) aviso = `<p class="cm-dica">Ela está em uso (${[u.padrao ? "padrão do mundo" : "", u.cenas ? `${u.cenas} cena(s)` : "", u.regioes ? `${u.regioes} Região(ões)` : ""].filter(Boolean).join(", ")}). Esses lugares passam a usar a região padrão (ou a Temperada).</p>`;
    } else if (grupo === "climas") {
      const u = this.usoDoClima(id);
      if (u.zonas.length || u.anoms.length) aviso = `<p class="cm-dica">Usado em: ${esc([...u.zonas, ...u.anoms].join(", "))}. Ele sai das tabelas dessas regiões e das trocas dessas anomalias.</p>`;
    } else if (grupo === "efeitos") {
      const u = this.usoDoEfeito(id);
      if (u.length) aviso = `<p class="cm-dica">Usado nos climas: ${esc(u.join(", "))}. Eles ficam sem efeito na cena até você escolher outro.</p>`;
    } else {
      const u = this.usoDaZona(`${N.PREFIXO_ANOM}${id}`);
      if (u.cenas || u.regioes) aviso = `<p class="cm-dica">Os lugares que a usam como região voltam para a região padrão.</p>`;
    }
    const nome = MAPA_TIPOS[grupo]()[id]?.nome ?? id;
    const ok = await Dialogo().confirm({ window: { title: "Apagar" }, content: `<p>Apagar <b>${esc(nome)}</b>?</p>${aviso}` });
    if (!ok) return;
    if (grupo === "efeitos") N.pararPreviaEfeito();
    await N.salvarTipoDeClima(grupo, id, null);
    this.ed[grupo] = null;
    this.render();
  }

  /** Mostra o efeito em edição só para este usuário, na cena aberta, sem salvar nada. */
  /** Mostra o efeito em edição só para este usuário, na cena aberta, sem gravar nada na cena. */
  testarEfeito() {
    if (!canvas?.scene) return;
    if (!N.iniciarPreviaEfeito(this.lerEditor("efeitos"))) return ui.notifications.warn(T("Não deu para montar este efeito com a base escolhida."));
    this.guardarRascunho("efeitos");
    this.render();
  }

  pararTeste(redesenhar = true) {
    N.pararPreviaEfeito();
    if (redesenhar) this.render();
  }

  get testando() { return N.previaAtiva(); }

  _onClose(options) {
    this.pararTeste(false);
    return super._onClose?.(options);
  }

  _replaceHTML(html, content) {
    const rolagem = { lista: content.querySelector(".cm-clima-lista")?.scrollTop ?? 0, tabela: content.querySelector(".cm-ce-tabela-caixa")?.scrollTop ?? 0, corpo: content.querySelector(".cm-ce-corpo")?.scrollTop ?? 0, aba: this._abaAntes };
    this._abaAntes = this.aba;
    // o que foi digitado na parte avançada continua lá depois de redesenhar
    const valores = Object.fromEntries([...content.querySelectorAll(".cm-clima-avancado [name]")].map((el) => [el.name, el.type === "checkbox" ? el.checked : el.value]));
    content.innerHTML = html;
    const lista = content.querySelector(".cm-clima-lista");
    if (lista) lista.scrollTop = rolagem.lista;
    const caixa = content.querySelector(".cm-ce-tabela-caixa");
    if (caixa) caixa.scrollTop = rolagem.tabela;
    const corpo = content.querySelector(".cm-ce-corpo");
    if (corpo && rolagem.aba === this.aba) corpo.scrollTop = rolagem.corpo;
    for (const [k, v] of Object.entries(valores)) { const el = content.querySelector(`.cm-clima-avancado [name="${k}"]`); if (el) { if (el.type === "checkbox") el.checked = v; else el.value = v; } }
    content.querySelector(".cm-clima-avancado")?.addEventListener("toggle", (ev) => { this.avancadoAberto = ev.target.open; });
    const faixa = content.querySelector('[name="tempFaixa"]'), campo = content.querySelector('.cm-clima-termo [name="temp"]');
    const topo = content.querySelector("[data-temp-topo]");
    const mudou = (v) => {
      if (!Number.isFinite(Number(v)) || v === "") return;
      this.mexeu = true; this.faixa = null;
      this.temp = this.deTela(Number(v));
      if (topo) topo.textContent = `${v}${this.un}`;
    };
    faixa?.addEventListener("input", () => { campo.value = faixa.value; mudou(faixa.value); });
    campo?.addEventListener("input", () => { faixa.value = campo.value; mudou(campo.value); });
    // saídas dos controles deslizantes do editor de efeitos
    content.querySelectorAll(".cm-ce-faixa input[type=range]").forEach((el) => el.addEventListener("input", () => {
      const o = content.querySelector(`[data-saida="${el.name}"]`);
      if (o) o.textContent = `${el.value}${el.name === "direcao" ? "°" : "×"}`;
    }));
    // trocar a base de um efeito ou ligar/desligar "Usar como região" redesenha (os campos mudam)
    content.querySelectorAll('.cm-ce-form[data-grupo="efeitos"] [name="base"], .cm-ce-form[data-grupo="efeitos"] [name="base2"]').forEach((el) => el.addEventListener("change", () => { this.guardarRascunho("efeitos"); this.render(); }));
    content.querySelector('.cm-ce-form[data-grupo="anomalias"] [name="regiao"]')?.addEventListener("change", () => { this.guardarRascunho("anomalias"); this.render(); });
    // previsão: região, tempo e temperatura de cada dia
    content.querySelector('[name="prevZona"]')?.addEventListener("change", (ev) => { this.zonaPrev = ev.target.value; this.render(); });
    content.querySelectorAll('[name="prevTipo"]').forEach((el) => el.addEventListener("change", async () => {
      const td = num(el.dataset.td), z = this.zonaPrev;
      const r = N.rolarTemperatura(z, el.value, td);
      await N.definirPrevisao(td, z, { tipo: el.value, ...r });
    }));
    content.querySelectorAll('[name="prevTemp"]').forEach((el) => el.addEventListener("change", async () => {
      const td = num(el.dataset.td), z = this.zonaPrev;
      const atual = N.previsao().dias?.[td]?.[z];
      if (!atual || el.value === "") return;
      const t = this.deTela(num(el.value, 0)), d = t - atual.temp;
      await N.definirPrevisao(td, z, { ...atual, temp: t, min: (atual.min ?? atual.temp - 4) + d, max: (atual.max ?? atual.temp + 4) + d });
    }));
    // soma de cada estação na tabela de chances, ao vivo
    content.querySelectorAll(".cm-ce-tabela input[data-estacao]").forEach((el) => el.addEventListener("input", () => {
      const e = el.dataset.estacao;
      const soma = [...content.querySelectorAll(`.cm-ce-tabela input[data-estacao="${e}"]`)].reduce((x, i) => x + Math.max(0, num(i.value, 0)), 0);
      const alvo = content.querySelector(`[data-soma="${e}"]`);
      if (alvo) { alvo.textContent = `soma ${soma}`; alvo.classList.toggle("zero", !soma); }
    }));
  }

  async aplicar() {
    const el = this.element;
    const cena = canvas?.scene;
    const val = (n) => el.querySelector(`.cm-clima-avancado [name="${n}"]`)?.value;
    const { zona: zonaAntes, est } = this.contexto();
    const anAntes = climaCfg().zonas?.[zonaAntes]?.anomalia?.tipo ?? "nenhuma";
    const zonaCenaAntes = cena?.getFlag(MOD, "zona") ?? "";
    const novaZonaCena = val("zonaCena");
    if (cena && novaZonaCena != null && novaZonaCena !== zonaCenaAntes) {
      if (novaZonaCena) await cena.setFlag(MOD, "zona", novaZonaCena); else await cena.unsetFlag(MOD, "zona");
    }
    // "Mostrar o efeito do clima nesta cena": só grava quando o mestre muda a escolha
    const caixa = el.querySelector('.cm-clima-avancado [name="climaNaCena"]');
    if (cena && caixa) {
      const antes = cena.getFlag(MOD, "climaNaCena");
      const efetivo = antes ?? N.planoClimaCena(cena).incluir;
      if (caixa.checked !== efetivo || (antes !== undefined && antes !== caixa.checked)) await cena.setFlag(MOD, "climaNaCena", caixa.checked);
    }
    const zonaAlvo = zonaDaCena();
    const anomalia = N.anomaliasLigadas() && N.anomaliaRegiaoInteira() && ANOMALIAS[val("anomalia")] ? val("anomalia") : anAntes;
    const cfg = climaCfg();
    cfg.zonas[zonaAlvo] = { ...(cfg.zonas[zonaAlvo] ?? {}), anomalia: { tipo: anomalia, texto: String(val("anTexto") ?? cfg.zonas[zonaAlvo]?.anomalia?.texto ?? "").trim() } };
    await game.settings.set(MOD, "climaZonas", cfg);

    const hoje = foundry.utils.deepClone(climaHoje());
    const c = hoje.zonas[zonaAlvo];
    const faixa = this.faixa;
    if (this.sel === "__rolar" || (!this.sel && !c)) hoje.zonas[zonaAlvo] = rolarClima(zonaAlvo);
    else if (CLIMAS[this.sel]) {
      const temp = this.temp ?? Math.round((ZONAS[zonaAlvo]?.temp?.[est] ?? 15) + (CLIMAS[this.sel].temp ?? 0));
      hoje.zonas[zonaAlvo] = { tipo: this.sel, temp, min: faixa?.min ?? temp - 4, max: faixa?.max ?? temp + 4, ...(faixa?.onda ? { onda: faixa.onda } : {}) };
    } else if (c && anomalia !== anAntes && anomalia !== "nenhuma") {
      // anomalia ligada agora: o tempo de hoje já passa a seguir ela (tempo forçado ou troca)
      hoje.zonas[zonaAlvo] = { ...c, tipo: N.tempoComAnomalia(zonaAlvo, c.tipo), temp: c.temp + (ANOMALIAS[anomalia].temp ?? 0), min: (c.min ?? c.temp - 4) + (ANOMALIAS[anomalia].temp ?? 0), max: (c.max ?? c.temp + 4) + (ANOMALIAS[anomalia].temp ?? 0) };
      if (this.mexeu && this.temp != null) Object.assign(hoje.zonas[zonaAlvo], { temp: this.temp, min: this.faixa?.min ?? this.temp - 4, max: this.faixa?.max ?? this.temp + 4 });
    } else if (this.mexeu && this.temp != null && c) {
      const d = this.temp - c.temp;   // mantém a amplitude do dia (ou usa a do dado)
      const { onda: _o, ...semOnda } = c;
      hoje.zonas[zonaAlvo] = { ...semOnda, temp: this.temp, min: faixa?.min ?? (c.min ?? c.temp - 4) + d, max: faixa?.max ?? (c.max ?? c.temp + 4) + d, ...(faixa?.onda ? { onda: faixa.onda } : {}) };
    }
    await game.settings.set(MOD, "climaAtual", hoje);
    if (anomalia !== anAntes && anomalia !== "nenhuma") await registrar(`${ANOMALIAS[anomalia].nome} em ${ZONAS[zonaAlvo].nome}`, { icone: ANOMALIAS[anomalia].icone ?? "fa-skull" });
    await aplicarClimaNasCenas();
    HUD.render();
    ui.notifications.info(`Clima de ${ZONAS[zonaAlvo].nome}: ${CLIMAS[hoje.zonas[zonaAlvo]?.tipo]?.nome ?? "?"}, ${temperaturaTexto(hoje.zonas[zonaAlvo]?.temp)}.`);
    this.close();
  }
}


/* Primeira janela migrada para Handlebars (PARTS): o HTML está em templates/contadores.hbs e aqui fica só
 * a preparação dos dados. Mesmo id, classes, data-action e seletores de CSS da versão anterior. */
class JanelaContadores extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "cm-contadores",
    classes: ["cm-janela"],
    tag: "div",
    window: { title: "Contadores e prazos", icon: "fa-solid fa-hourglass-half", resizable: true },
    position: { width: 460, height: 480 },
    actions: {
      async novo() { await novoContador(); this.render(); },
      async apagar(ev, t) {
        if (!game.user.isGM) return;
        await alterarContadores((lista) => lista.filter((c) => c.id !== t.dataset.id));
        this.render();
      },
      async limpar() {
        if (!game.user.isGM) return;
        await alterarContadores((lista) => lista.filter((c) => !c.feito));
        this.render();
      },
      async somar(ev, t) {
        if (!game.user.isGM) return;
        const id = t.dataset.id, s = num(t.dataset.s);
        await alterarContadores((lista) => {
          const c = lista.find((x) => x.id === id);
          if (!c) return false;
          c.fim += s;
          c.feito = game.time.worldTime >= c.fim;
        });
        this.render();
      }
    }
  };

  static PARTS = {
    corpo: { template: `modules/${MOD}/templates/contadores.hbs` }
  };

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const gm = game.user.isGM, wt = game.time.worldTime;
    const fimTexto = (fim) => `${textoData(infoDia(diaTotalDe(fim)), { semana: false })} às ${textoHora(Math.floor(segundoDoDia(fim) / segHora()), Math.floor((segundoDoDia(fim) % segHora()) / segMinuto()))}`;
    const itens = contadores().filter((c) => gm || c.visivel).sort((a, b) => a.feito - b.feito || a.fim - b.fim).map((c) => {
      const total = Math.max(1, c.fim - c.inicio);
      return {
        id: c.id, nome: c.nome, visivel: !!c.visivel, feito: !!c.feito,
        estado: c.feito ? "terminou" : `falta ${duracaoTexto(c.fim - wt)}`,
        pct: Math.min(100, Math.max(0, ((wt - c.inicio) / total) * 100)).toFixed(1),
        termina: fimTexto(c.fim)
      };
    });
    return Object.assign(ctx, { gm, tema: tema(), itens, segHora: segHora(), segDia: segDia() });
  }
}

async function novoContador() {
  if (!game.user.isGM) return;
  const r = await Dialogo().wait({
    window: { title: "Novo contador", icon: "fa-solid fa-hourglass-start" },
    content: `<div class="cm-form">
      <label>Nome<input type="text" name="nome" placeholder="O ritual se completa" autofocus></label>
      <div class="cm-form-2">
        <label>Daqui a<input type="number" name="q" min="0" step="0.5" value="1"></label>
        <label>Unidade<select name="un"><option value="m">minutos</option><option value="h" selected>horas</option><option value="d">dias</option><option value="s">semanas</option></select></label>
      </div>
      <div class="cm-form-2">
        <label>Quem vê<select name="vis"><option value="1">Todos</option><option value="">Só o mestre</option></select></label>
        <label>Quando terminar<select name="aviso"><option value="mestre">Avisar só o mestre</option><option value="todos">Avisar todos</option></select></label>
      </div></div>`,
    buttons: [{ action: "ok", label: "Criar", default: true, callback: (ev, btn) => Object.fromEntries(new FormData(btn.form)) }, { action: "cancelar", label: "Cancelar" }],
    rejectClose: false
  });
  if (!r || typeof r !== "object") return;
  const un = { m: segMinuto(), h: segHora(), d: segDia(), s: segDia() * N.CFG.semana.length }[r.un] ?? segHora();
  const wt = game.time.worldTime;
  const novo = { id: foundry.utils.randomID(), nome: String(r.nome || "Contador").trim(), inicio: wt, fim: wt + Math.round(num(r.q, 1) * un), visivel: !!r.vis, aviso: r.aviso === "todos" ? "todos" : "mestre", feito: false };
  await alterarContadores((lista) => { lista.push(novo); });
}

/* ---------------- ações das notas ---------------- */

async function dialogoAcoesNota(j) {
  if (!game.user.isGM || !j) return;
  const a = j.getFlag(MOD, "acoes") ?? {};
  const macros = [...(game.macros ?? [])].sort((x, y) => x.name.localeCompare(y.name));
  const cenas = [...(game.scenes ?? [])].sort((x, y) => x.name.localeCompare(y.name));
  const n = dadosNota(j);
  const quando = n ? `${textoData(infoDia(n.td))}${n.hora ? ` · ${n.hora}` : ` · ${T("à meia-noite (sem hora marcada)")}`}` : "";
  const content = `<div class="cm-form cm-acoes-nota">
    <p class="cm-form-data"><i class="fa-solid fa-bolt"></i> ${T("Quando <b>{nome}</b> chegar ({quando}), o calendário faz:", { nome: esc(j.name), quando: esc(quando) })}</p>
    <label>${T("Rodar a macro")}<select name="macro"><option value="">${T("— nenhuma —")}</option>${macros.map((m) => `<option value="${m.id}" ${a.macro === m.id || a.macro === m.uuid ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select></label>
    <div class="cm-form-2">
      <label>${T("Tocar o som (arquivo)")}<span class="cm-com-botao"><input type="text" name="som" value="${esc(a.som ?? "")}" placeholder="sounds/sino.ogg"><button type="button" data-escolher-som data-tooltip="${esc(T("Escolher arquivo"))}"><i class="fa-solid fa-file-audio"></i></button></span></label>
      <label>${T("Volume")}<input type="range" name="volume" min="0" max="1" step="0.05" value="${num(a.volume, 0.8)}"></label>
    </div>
    <div class="cm-form-2">
      <label>${T("Trocar para a cena")}<select name="cena"><option value="">${T("— nenhuma —")}</option>${cenas.map((c) => `<option value="${c.id}" ${a.cena === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>
      <label>${T("Como")}<select name="cenaModo">${Object.entries(N.MODOS_CENA).map(([k, r]) => `<option value="${k}" ${a.cenaModo === k ? "selected" : ""}>${esc(T(r))}</option>`).join("")}</select></label>
    </div>
    <label>${T("Mensagem no chat")}<textarea name="chat" rows="2" placeholder="${esc(T("Ex.: O sino da torre badala doze vezes."))}">${esc(a.chat ?? "")}</textarea></label>
    <label>${T("Mensagem para")}<select name="chatPara"><option value="todos" ${a.chatPara !== "mestre" ? "selected" : ""}>${T("Todos")}</option><option value="mestre" ${a.chatPara === "mestre" ? "selected" : ""}>${T("Só o mestre")}</option></select></label>
    <p class="cm-dica">${T("As ações rodam quando o tempo passa pela hora da nota (também nas repetições). Num pulo de mais de 60 dias, nada é disparado. A macro recebe nota, td e data.")}</p>
  </div>`;
  const r = await Dialogo().wait({
    window: { title: T("Ações da nota"), icon: "fa-solid fa-bolt" },
    position: { width: 520 },
    content,
    render: (ev, dlg) => {
      const el = dlg.element ?? dlg;
      el.querySelector("[data-escolher-som]")?.addEventListener("click", () => {
        const FP = foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
        new FP({ type: "audio", current: el.querySelector('[name="som"]').value, callback: (path) => { el.querySelector('[name="som"]').value = path; } }).render(true);
      });
    },
    buttons: [
      { action: "ok", label: T("Salvar"), icon: "fa-solid fa-check", default: true, callback: (ev, btn) => ({ acao: "ok", ...Object.fromEntries(new FormData(btn.form)) }) },
      { action: "testar", label: T("Salvar e testar agora"), icon: "fa-solid fa-play", callback: (ev, btn) => ({ acao: "testar", ...Object.fromEntries(new FormData(btn.form)) }) },
      { action: "limpar", label: T("Tirar as ações"), icon: "fa-solid fa-eraser", callback: () => ({ acao: "limpar" }) },
      { action: "cancelar", label: T("Cancelar"), icon: "fa-solid fa-xmark" }
    ],
    rejectClose: false
  });
  if (!r || typeof r !== "object") return;
  if (r.acao === "limpar") { await j.unsetFlag(MOD, "acoes"); ui.notifications.info(T("Ações tiradas da nota.")); return rerenderTudo(); }
  const dados = { macro: r.macro || "", som: String(r.som ?? "").trim(), volume: num(r.volume, 0.8), cena: r.cena || "", cenaModo: r.cenaModo, chat: String(r.chat ?? "").trim(), chatPara: r.chatPara };
  await j.setFlag(MOD, "acoes", dados);
  if (r.acao === "testar") { const a2 = N.acoesDaNota(j); if (a2) await N.executarAcoes(j, a2, n?.td ?? agora().td); else ui.notifications.warn(T("Nenhuma ação escolhida.")); }
  rerenderTudo();
}
const rerenderTudo = () => { for (const app of foundry.applications.instances.values()) if (app instanceof JanelaCalendario) app.render(); };

/* ---------------- viagem ---------------- */

/** Tabelas que aparecem na viagem: as escolhidas nas configurações (todas, se nenhuma foi escolhida). */
function tabelasDeEncontro() {
  const todas = game.tables?.contents ?? [];
  const ids = game.settings.get(MOD, "tabelasEncontro")?.ids ?? [];
  const escolhidas = todas.filter((t) => ids.includes(t.id));
  return (escolhidas.length ? escolhidas : todas).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/** Configurações → Tabelas de encontro: marcar quais tabelas aparecem na janela de viagem. */
class JanelaTabelas extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "cm-tabelas",
    classes: ["cm-janela"],
    tag: "div",
    window: { title: "Tabelas de encontro da viagem", icon: "fa-solid fa-table-list", resizable: true },
    position: { width: 460, height: 560 },
    actions: {
      todas() { this.element.querySelectorAll(".cm-tab-item input").forEach((el) => { if (!el.closest(".cm-tab-item").hidden) el.checked = true; }); this.contar(); },
      nenhuma() { this.element.querySelectorAll(".cm-tab-item input").forEach((el) => { el.checked = false; }); this.contar(); },
      async salvar() {
        const ids = [...this.element.querySelectorAll(".cm-tab-item input:checked")].map((el) => el.value);
        await game.settings.set(MOD, "tabelasEncontro", { ids });
        ui.notifications.info(ids.length ? `${ids.length} tabela(s) na janela de viagem.` : "Todas as tabelas aparecem na janela de viagem.");
        this.close();
      },
      cancelar() { this.close(); }
    }
  };

  async _renderHTML() {
    const ids = new Set(game.settings.get(MOD, "tabelasEncontro")?.ids ?? []);
    const tabelas = [...(game.tables?.contents ?? [])].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    const porPasta = new Map();
    for (const t of tabelas) { const k = t.folder?.name ?? "Sem pasta"; if (!porPasta.has(k)) porPasta.set(k, []); porPasta.get(k).push(t); }
    const grupos = [...porPasta.entries()].sort(([a], [b]) => (a === "Sem pasta") - (b === "Sem pasta") || a.localeCompare(b, "pt-BR")).map(([pasta, ts]) => `
      <div class="cm-tab-grupo"><h4><i class="fa-solid fa-folder"></i> ${esc(pasta)}</h4>
        ${ts.map((t) => `<label class="cm-tab-item"><input type="checkbox" value="${t.id}" ${ids.has(t.id) ? "checked" : ""}> <img src="${esc(t.img || "icons/svg/d20-black.svg")}" alt=""> <span>${esc(t.name)}</span><small>${t.results?.size ?? 0} resultados</small></label>`).join("")}
      </div>`).join("");
    return `<div class="cm-raiz cm-tabelas-raiz cm-tema-${tema()}">
      <p class="cm-dica">Marque as tabelas que devem aparecer em "Tabela de encontros" na janela de viagem. Sem nenhuma marcada, aparecem todas.</p>
      <div class="cm-tab-busca"><input type="search" name="busca" placeholder="Procurar tabela..."><span data-contagem></span></div>
      <div class="cm-tab-lista">${grupos || `<p class="cm-vazio">Nenhuma tabela no mundo. Crie em Tabelas (aba de tabelas aleatórias).</p>`}</div>
      <footer class="cm-tab-rodape">
        <button type="button" data-action="todas">Marcar todas</button>
        <button type="button" data-action="nenhuma">Desmarcar</button>
        <span class="cm-esp"></span>
        <button type="button" data-action="cancelar">Cancelar</button>
        <button type="button" class="cm-clima-aplicar" data-action="salvar"><i class="fa-solid fa-floppy-disk"></i> Salvar</button>
      </footer>
    </div>`;
  }

  contar() {
    const el = this.element.querySelector("[data-contagem]");
    const n = this.element.querySelectorAll(".cm-tab-item input:checked").length;
    if (el) el.textContent = n ? `${n} marcada(s)` : "nenhuma marcada: todas aparecem";
  }

  _replaceHTML(html, content) {
    content.innerHTML = html;
    const busca = content.querySelector('[name="busca"]');
    busca?.addEventListener("input", () => {
      const q = busca.value.trim().toLowerCase();
      content.querySelectorAll(".cm-tab-item").forEach((it) => { it.hidden = !!q && !it.textContent.toLowerCase().includes(q); });
      content.querySelectorAll(".cm-tab-grupo").forEach((g) => { g.hidden = ![...g.querySelectorAll(".cm-tab-item")].some((it) => !it.hidden); });
    });
    content.querySelectorAll(".cm-tab-item input").forEach((el) => el.addEventListener("change", () => this.contar()));
    this.contar();
  }
}

const RITMOS = { lento: { nome: "Lento (furtivo)", km: 3.2, mi: 2 }, normal: { nome: "Normal", km: 4.8, mi: 3 }, rapido: { nome: "Rápido (−5 em Percepção passiva)", km: 6.4, mi: 4 } };

async function dialogoViagem() {
  if (!game.user.isGM) return;
  if (viagemAtual()) return new JanelaViagem().render({ force: true });
  const tabelas = tabelasDeEncontro();
  const r = await Dialogo().wait({
    window: { title: "Viajar", icon: "fa-solid fa-route" },
    position: { width: 480 },
    content: `<div class="cm-form">
      <label>Destino (opcional)<input type="text" name="destino" placeholder="Porto de Tir'Wara"></label>
      <div class="cm-form-2">
        <label>Distância<input type="number" name="dist" min="0" step="0.5" value="30"></label>
        <label>Unidade<select name="un"><option value="km">km</option><option value="mi">milhas</option><option value="lg">léguas (3 mi)</option></select></label>
      </div>
      <div class="cm-form-2">
        <label>Ritmo<select name="ritmo">${opcoes(RITMOS, "normal", (v) => v.nome)}</select></label>
        <label>Horas de viagem por dia<input type="number" name="hd" min="1" max="${N.CFG.horasDia}" value="8"></label>
      </div>
      <div class="cm-form-2">
        <label>Chance de encontro por dia (%)<input type="number" name="chance" min="0" max="100" value="0"></label>
        <label>Tabela de encontros<select name="tabela"><option value="">— nenhuma —</option>${tabelas.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select>
          <small class="cm-dica-campo">Quais aparecem aqui: Configurações → Calendário da Mesa → Tabelas de encontro.</small></label>
      </div>
      <fieldset class="cm-rep"><legend><i class="fa-solid fa-campground"></i> Dia a dia</legend>
        <label class="cm-chip"><input type="checkbox" name="separado"> Passar os dias separadamente (narração de cada momento e vigias à noite)</label>
        <div class="cm-form-2">
          <label>Partida de cada dia (HH:MM)<input type="text" name="saida" value="08:00" placeholder="08:00"></label>
          <label>Vigias liberadas a partir de (HH:MM)<input type="text" name="acamp" value="20:00" placeholder="20:00"></label>
        </div>
        <p class="cm-dica">Cada dia é avançado pelo mestre. Quando o relógio chega no horário das vigias, libera o botão de montar as vigias (2 horas cada).</p>
      </fieldset>
      <p class="cm-dica">Sem o dia a dia: o tempo avança direto as horas de viagem e as paradas para dormir. O resumo vai para o chat e para o histórico.</p>
    </div>`,
    buttons: [{ action: "ok", label: "Partir", icon: "fa-solid fa-person-hiking", default: true, callback: (ev, btn) => Object.fromEntries(new FormData(btn.form)) }, { action: "cancelar", label: "Cancelar" }],
    rejectClose: false
  });
  if (!r || typeof r !== "object") return;
  const ritmo = RITMOS[r.ritmo] ?? RITMOS.normal;
  const vel = r.un === "km" ? ritmo.km : r.un === "lg" ? ritmo.mi / 3 : ritmo.mi;
  const horas = Math.max(0, num(r.dist, 0)) / vel;
  const hd = Math.min(Math.max(1, num(r.hd, 8)), N.CFG.horasDia);
  const un = { km: "km", mi: "milhas", lg: "léguas" }[r.un] ?? "km";
  const destino = String(r.destino ?? "").trim();
  const chance = Math.min(100, Math.max(0, num(r.chance, 0)));
  if (r.separado) {
    return iniciarViagemSeparada({
      destino, dist: num(r.dist), un, ritmo: ritmo.nome.split(" ")[0], vel, horas, hd, chance, tabela: r.tabela || "",
      saida: horaParaDec(r.saida, 8), acampamento: horaParaDec(r.acamp, 20)
    });
  }
  const dias = Math.floor(horas / hd);
  let resto = horas - dias * hd;
  if (resto < 1e-6 && dias > 0) resto = 0;
  const seg = Math.round(dias * segDia() + resto * segHora());
  const tempo = `${dias ? `${dias} dia${dias > 1 ? "s" : ""}` : ""}${dias && resto ? " e " : ""}${resto ? `${Math.floor(resto)}h${Math.round((resto % 1) * N.CFG.minutosHora) ? pad(Math.round((resto % 1) * N.CFG.minutosHora)) : ""}` : ""}` || "nada";
  // encontros: um teste por dia (ou fração) de viagem
  const encontros = [];
  if (chance > 0) for (let d = 1; d <= Math.ceil(horas / hd); d++) if (Math.random() * 100 < chance) encontros.push(d);
  await chat(`<i class="fa-solid fa-route"></i> <b>Viagem${destino ? ` até ${esc(destino)}` : ""}</b>: ${num(r.dist)} ${un} em ritmo ${esc(ritmo.nome.split(" ")[0].toLowerCase())} — ${tempo}.`);
  if (chance > 0) await chat(`<i class="fa-solid fa-dragon"></i> Encontros na viagem: ${encontros.length ? encontros.map((d) => `dia ${d}`).join(", ") : "nenhum"}.`, idsGM());
  const tabela = r.tabela ? game.tables.get(r.tabela) : null;
  if (tabela) for (const _ of encontros) await tabela.draw({ rollMode: "gmroll" });
  await registrar(`Viagem${destino ? ` até ${destino}` : ""}: ${num(r.dist)} ${un}, ${tempo}${encontros.length ? `, ${encontros.length} encontro(s)` : ""}`, { icone: "fa-route" });
  if (seg > 0) await game.time.advance(seg);
}

/* ---------- viagem dia a dia ---------- */

/** "20:30" → 20.5 (no calendário em uso); vazio ou inválido → padrão. */
function horaParaDec(texto, padrao) {
  const m = String(texto ?? "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return Math.min(padrao, N.CFG.horasDia - 1);
  return Math.min(num(m[1]), N.CFG.horasDia - 1) + Math.min(num(m[2]), N.CFG.minutosHora - 1) / N.CFG.minutosHora;
}

/** Próximo instante depois de `desde` em que o relógio marca a hora pedida. */
function proximoHorario(desde, horaDec) {
  const alvo = Math.round(horaDec * segHora());
  let t = diaTotalDe(desde) * segDia() + alvo;
  if (t <= desde) t += segDia();
  return t;
}

const hhmm = (t) => textoRelogio(segundoDoDia(t)).slice(0, 5);

async function iniciarViagemSeparada(p) {
  if (viagemAtual()) return ui.notifications.warn("Já há uma viagem em andamento.");
  const wt = game.time.worldTime;
  const diasTotal = Math.max(1, Math.ceil(p.horas / p.hd - 1e-9));
  const estado = {
    ativa: true, id: foundry.utils.randomID(), destino: p.destino, dist: p.dist, un: p.un, ritmo: p.ritmo,
    vel: p.vel, hd: p.hd, diasTotal, dia: 1, saida: p.saida, acampamento: p.acampamento,
    chance: p.chance, tabela: p.tabela, encontros: [], inicioWt: wt,
    alvoAcampamento: proximoHorario(wt, p.acampamento), fase: "viajando", vigias: null, historicoVigias: []
  };
  await alterarViagem(() => estado);
  await chat(`<i class="fa-solid fa-route"></i> <b>O grupo parte${p.destino ? ` rumo a ${esc(p.destino)}` : ""}</b>: ${p.dist} ${esc(p.un)} em ritmo ${esc(p.ritmo.toLowerCase())}, cerca de ${diasTotal} dia${diasTotal > 1 ? "s" : ""} de estrada.`);
  await registrar(`Partida${p.destino ? ` para ${p.destino}` : ""}: ${p.dist} ${p.un}, cerca de ${diasTotal} dia(s)`, { icone: "fa-route" });
  await rolarEncontroDoDia();
  return new JanelaViagem().render({ force: true });
}

/** Teste de encontro do dia atual da viagem (aviso só para o mestre). */
async function rolarEncontroDoDia() {
  const v = viagemAtual();
  if (!v || !(v.chance > 0)) return;
  if (Math.random() * 100 >= v.chance) return;
  await alterarViagem((x) => { (x.encontros ??= []).push(x.dia); });
  await chat(`<i class="fa-solid fa-dragon"></i> <b>Encontro hoje</b> (dia ${v.dia} da viagem${v.destino ? ` para ${esc(v.destino)}` : ""}).`, idsGM());
  const tabela = v.tabela ? game.tables.get(v.tabela) : null;
  if (tabela) await tabela.draw({ rollMode: "gmroll" });
}

async function avancarPara(alvo) {
  const d = Math.round(alvo - game.time.worldTime);
  if (d > 0) await game.time.advance(d);
}

/** Janela do mestre: montar as vigias da noite. */
async function dialogoVigias() {
  const v = viagemAtual();
  if (!v || !game.user.isGM) return;
  const jogadores = game.users.filter((u) => !u.isGM);
  if (!jogadores.length) return ui.notifications.warn("Não há jogadores cadastrados no mundo.");
  const r = await Dialogo().wait({
    window: { title: "Vigias da noite", icon: "fa-solid fa-campground" },
    position: { width: 440 },
    content: `<div class="cm-form">
      <label>Quantas vigias (${DURACAO_VIGIA_H} horas cada)<input type="number" name="n" min="1" max="12" value="4"></label>
      <p class="cm-dica">A partir de agora (${esc(hhmm(game.time.worldTime))}). Quem participa escolhe na tela em qual vigia fica.</p>
      <div class="cm-vg-escolher">${jogadores.map((u) => `<label class="cm-chip"><input type="checkbox" name="u-${u.id}" ${u.active || u.character ? "checked" : ""}> ${esc(nomeDoJogador(u.id))}${u.active ? "" : " <small>(offline)</small>"}</label>`).join("")}</div>
    </div>`,
    buttons: [{ action: "ok", label: "Mostrar aos jogadores", icon: "fa-solid fa-eye", default: true, callback: (ev, btn) => Object.fromEntries(new FormData(btn.form)) }, { action: "cancelar", label: "Cancelar" }],
    rejectClose: false
  });
  if (!r || typeof r !== "object") return;
  const participantes = jogadores.filter((u) => r[`u-${u.id}`]).map((u) => u.id);
  if (!participantes.length) return ui.notifications.warn("Escolha pelo menos um jogador para as vigias.");
  const n = Math.min(12, Math.max(1, Math.trunc(num(r.n, 4))));
  await alterarViagem((x) => {
    if (!x.ativa) return false;
    x.fase = "escolha";
    x.vigias = { n, participantes, escolhas: {}, atual: -1, inicio: game.time.worldTime };
  });
  await chat(`<i class="fa-solid fa-campground"></i> <b>O grupo monta acampamento.</b> ${n} vigia${n > 1 ? "s" : ""} de ${DURACAO_VIGIA_H} horas: ${participantes.map((id) => esc(nomeDoJogador(id))).join(", ")}, escolham onde ficam.`);
}

/** Ações do mestre na viagem (janela e painel das vigias). */
async function acaoViagem(acao, dado = null) {
  if (!game.user.isGM) return;
  const v = viagemAtual();
  if (!v) return;
  const agoraT = game.time.worldTime;
  switch (acao) {
    case "hora": return avancar(segHora());
    case "meiaHora": return avancar(segHora() / 2);
    case "acampamento": return v.alvoAcampamento > agoraT ? avancarPara(v.alvoAcampamento) : null;
    case "vigias":
      if (agoraT < v.alvoAcampamento) return ui.notifications.warn(`As vigias liberam às ${hhmm(v.alvoAcampamento)}.`);
      return dialogoVigias();
    case "atribuir": return N.escolherVigia(dado?.userId, dado?.vigia);
    case "cancelarVigias": return alterarViagem((x) => { x.fase = "viajando"; x.vigias = null; });
    case "comecarVigias": {
      if (v.fase !== "escolha") return;
      await alterarViagem((x) => { x.fase = "vigias"; x.vigias.atual = 0; x.vigias.inicio = game.time.worldTime; });
      const g = gruposDaVigia(viagemAtual().vigias);
      return chat(`<i class="fa-solid fa-moon"></i> <b>Vigias da noite</b><ol>${g.map((ids, i) => `<li>${esc(horarioVigia(viagemAtual().vigias, i))}: ${ids.map((id) => esc(nomeDoJogador(id))).join(", ") || "ninguém"}</li>`).join("")}</ol>`);
    }
    case "proximaVigia": {
      if (v.fase !== "vigias") return;
      const ultima = v.vigias.atual >= v.vigias.n - 1;
      if (!ultima) {
        await alterarViagem((x) => { x.vigias.atual += 1; });
        return avancar(segVigia());
      }
      const g = gruposDaVigia(v.vigias);
      const resumo = g.map((ids, i) => `${i + 1}ª ${ids.map(nomeDoJogador).join(", ") || "ninguém"}`).join("; ");
      await alterarViagem((x) => { x.fase = "noite"; (x.historicoVigias ??= []).push({ dia: x.dia, grupos: g }); x.vigias = null; });
      await registrar(`Vigias (dia ${v.dia} da viagem): ${resumo}`, { icone: "fa-campground" });
      return avancar(segVigia());
    }
    case "amanhecer": {
      if (!["viajando", "noite"].includes(v.fase)) return;
      if (v.dia >= v.diasTotal) return acaoViagem("chegar");
      const alvo = proximoHorario(agoraT, v.saida);
      await alterarViagem((x) => { x.dia += 1; x.fase = "viajando"; x.vigias = null; x.alvoAcampamento = proximoHorario(alvo, x.acampamento); });
      await avancarPara(alvo);
      const nv = viagemAtual();
      await chat(`<i class="fa-solid fa-sun"></i> <b>Dia ${nv.dia} de viagem</b>${nv.destino ? ` rumo a ${esc(nv.destino)}` : ""}. O grupo levanta acampamento.`);
      return rolarEncontroDoDia();
    }
    case "chegar": {
      await alterarViagem(() => ({ ativa: false }));
      await chat(`<i class="fa-solid fa-flag-checkered"></i> <b>O grupo chega${v.destino ? ` a ${esc(v.destino)}` : " ao destino"}</b> depois de ${v.dia} dia${v.dia > 1 ? "s" : ""} de viagem.`);
      await registrar(`Chegada${v.destino ? ` a ${v.destino}` : ""} (${v.dia} dia(s) de viagem${v.encontros?.length ? `, ${v.encontros.length} encontro(s)` : ""})`, { icone: "fa-route" });
      foundry.applications.instances.get("cm-viagem")?.close();
      return;
    }
    case "cancelar": {
      const ok = await Dialogo().confirm({ window: { title: "Encerrar viagem" }, content: "<p>Encerrar a viagem agora? O tempo não muda.</p>" });
      if (!ok) return;
      await alterarViagem(() => ({ ativa: false }));
      await registrar(`Viagem interrompida no dia ${v.dia}${v.destino ? ` (destino: ${v.destino})` : ""}`, { icone: "fa-route" });
      foundry.applications.instances.get("cm-viagem")?.close();
      return;
    }
    case "narrar": {
      const texto = String(dado ?? "").trim();
      if (!texto) return;
      await chat(`<div class="cm-narracao"><i class="fa-solid fa-feather"></i> ${esc(texto).replace(/\n/g, "<br>")}</div>`);
      return registrar(`Viagem, dia ${v.dia} (${hhmm(agoraT)}): ${texto}`, { icone: "fa-feather" });
    }
  }
}

class JanelaViagem extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "cm-viagem",
    classes: ["cm-janela"],
    tag: "div",
    window: { title: "Viagem", icon: "fa-solid fa-route", resizable: true },
    position: { width: 520, height: "auto" },
    actions: {
      acao(ev, t) { acaoViagem(t.dataset.acao).catch((err) => relatarErro("viagem", err)); },
      narrar() {
        const ta = this.element.querySelector("textarea.cm-vg-narracao");
        const texto = ta?.value ?? "";
        if (ta) ta.value = "";
        acaoViagem("narrar", texto).catch((err) => relatarErro("viagem", err));
      }
    }
  };

  async _renderHTML() {
    const v = viagemAtual();
    if (!v) return `<div class="cm-raiz cm-editor cm-tema-${tema()}"><p class="cm-vazio">Nenhuma viagem em andamento.</p></div>`;
    const wt = game.time.worldTime, a = agora();
    const per = periodoDe(a.horaDec, a.mes, a.dia);
    const btn = (acao, icone, rotulo, extra = "") => `<button type="button" data-action="acao" data-acao="${acao}" ${extra}><i class="fa-solid ${icone}"></i> ${rotulo}</button>`;
    const liberado = wt >= v.alvoAcampamento;
    const falta = v.alvoAcampamento - wt;
    const ultimoDia = v.dia >= v.diasTotal;
    const kmDia = Math.round(v.vel * v.hd * 10) / 10;
    const pct = Math.min(100, Math.round(((v.dia - 1) / v.diasTotal) * 100));
    let fase = "";
    if (v.fase === "viajando") {
      fase = `<div class="cm-ed-cals-linha">
          ${btn("meiaHora", "fa-forward-step", "+30 min")}${btn("hora", "fa-forward", "+1 hora")}
          ${btn("acampamento", "fa-campground", `Até as ${hhmm(v.alvoAcampamento)}`, liberado ? "disabled" : "")}
        </div>
        <div class="cm-ed-cals-linha">
          ${btn("vigias", "fa-moon", "Montar as vigias", liberado ? "" : `disabled data-tooltip="Libera às ${hhmm(v.alvoAcampamento)}"`)}
          ${liberado ? "" : `<span class="cm-dica">libera às ${esc(hhmm(v.alvoAcampamento))} (falta ${esc(duracaoTexto(falta))})</span>`}
          ${btn("amanhecer", ultimoDia ? "fa-flag-checkered" : "fa-sun", ultimoDia ? "Chegar ao destino" : `Pular a noite (sem vigias)`)}
        </div>`;
    } else if (v.fase === "escolha") {
      const vg = v.vigias;
      fase = `<p class="cm-dica">Os jogadores estão escolhendo as vigias na tela deles. Você pode escolher por quem estiver offline.</p>
        <div class="cm-vg-atribuir">${vg.participantes.map((id) => `<label>${esc(nomeDoJogador(id))}
          <select data-vg-atribuir="${id}"><option value="">— ainda não escolheu —</option>${Array.from({ length: vg.n }, (_, i) => `<option value="${i}" ${vg.escolhas?.[id] === i ? "selected" : ""}>${i + 1}ª vigia (${esc(horarioVigia(vg, i))})</option>`).join("")}</select></label>`).join("")}</div>
        <div class="cm-ed-cals-linha">${btn("comecarVigias", "fa-play", "Começar as vigias")}${btn("cancelarVigias", "fa-xmark", "Desfazer")}</div>`;
    } else if (v.fase === "vigias") {
      const vg = v.vigias, i = vg.atual;
      const g = gruposDaVigia(vg);
      fase = `<p><b>${i + 1}ª vigia de ${vg.n}</b> · ${esc(horarioVigia(vg, i))} · ${(g[i] ?? []).map((id) => esc(nomeDoJogador(id))).join(", ") || "ninguém"}</p>
        <div class="cm-ed-cals-linha">${btn("proximaVigia", "fa-forward", i >= vg.n - 1 ? "Terminar a última vigia" : "Próxima vigia (+2 h)")}</div>`;
    } else if (v.fase === "noite") {
      fase = `<p class="cm-dica">Vigias encerradas. ${ultimoDia ? "Último dia: o grupo pode chegar ao destino." : `Amanhece às ${esc(textoHoraDec(v.saida))}.`}</p>
        <div class="cm-ed-cals-linha">${btn("hora", "fa-forward", "+1 hora")}${btn("amanhecer", ultimoDia ? "fa-flag-checkered" : "fa-sun", ultimoDia ? "Chegar ao destino" : "Seguir viagem")}</div>`;
    }
    return `<div class="cm-raiz cm-editor cm-viagem cm-tema-${tema()}">
      <h3><i class="fa-solid fa-route"></i> ${v.destino ? esc(v.destino) : "Viagem"} <small>· dia ${v.dia} de ${v.diasTotal}</small></h3>
      <div class="cm-barra"><span style="width:${pct}%"></span></div>
      <p class="cm-dica">${esc(textoData(a))} · ${esc(hhmm(wt))} · ${esc(per.nome)} · ritmo ${esc(String(v.ritmo).toLowerCase())}, cerca de ${kmDia} ${esc(v.un)} por dia (${v.hd} h)
        ${(v.encontros ?? []).includes(v.dia) ? ` · <b class="cm-aviso"><i class="fa-solid fa-dragon"></i> encontro hoje</b>` : ""}</p>
      ${fase}
      <fieldset><legend><i class="fa-solid fa-feather"></i> Narração deste momento</legend>
        <textarea class="cm-vg-narracao" rows="3" placeholder="O que o grupo vê, ouve e sente agora... (vai para o chat de todos e para o histórico)"></textarea>
        <div class="cm-ed-rodape"><button type="button" data-action="narrar"><i class="fa-solid fa-comment"></i> Enviar narração</button></div>
      </fieldset>
      <footer class="cm-ed-fim"><span class="cm-esp"></span>${btn("cancelar", "fa-ban", "Encerrar a viagem")}</footer>
    </div>`;
  }

  _replaceHTML(html, content) {
    const antigo = content.querySelector("textarea.cm-vg-narracao");
    const rascunho = antigo?.value ?? "";
    const comFoco = !!antigo && document.activeElement === antigo;
    const cursor = comFoco ? antigo.selectionStart : null;
    content.innerHTML = html;
    // o relógio redesenha a janela a cada passo: o texto em digitação e o cursor continuam onde estavam
    const ta = content.querySelector("textarea.cm-vg-narracao");
    if (ta && rascunho) ta.value = rascunho;
    if (ta && comFoco) { ta.focus({ preventScroll: true }); try { ta.setSelectionRange(cursor, cursor); } catch { /* sem seleção */ } }
    content.querySelectorAll("[data-vg-atribuir]").forEach((sel) => sel.addEventListener("change", () => {
      acaoViagem("atribuir", { userId: sel.dataset.vgAtribuir, vigia: sel.value === "" ? null : Number(sel.value) }).catch((err) => relatarErro("viagem", err));
    }));
  }
}


/* ---------------- dias sagrados das divindades ---------------- */

/** Divindades do Journal (páginas do tipo "Divindade"). */
function divindades() {
  return game.journal.filter((e) => e.pages?.contents?.some((p) => p.flags?.[JOURNAL]?.tipo === "deus")).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

async function dialogoDiaSagrado() {
  if (!game.user.isGM) return;
  const deuses = divindades();
  const a = agora();
  const r = await Dialogo().wait({
    window: { title: "Dia sagrado", icon: "fa-solid fa-hands-praying" },
    position: { width: 460 },
    content: `<div class="cm-form">
      <label>Divindade<select name="deus">
        ${deuses.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join("")}
        <option value="">Outra (escrever o nome)</option></select></label>
      ${deuses.length ? "" : `<p class="cm-dica">Nenhuma divindade do Journal da Mesa encontrada; escreva o nome abaixo.</p>`}
      <label>Nome da divindade (se for "Outra")<input type="text" name="outra"></label>
      <label>Nome do dia sagrado<input type="text" name="nome" placeholder="Festival das Marés"></label>
      <div class="cm-form-2">
        <label>Dia<input type="number" name="dia" min="1" value="${a.dia + 1}"></label>
        <label>Mês<select name="mes">${N.CFG.meses.map((m, i) => `<option value="${i}" ${i === a.mes ? "selected" : ""}>${esc(m.nome)}</option>`).join("")}</select></label>
      </div>
      <div class="cm-form-2">
        <label>Dura quantos dias<input type="number" name="duracao" min="1" value="1"></label>
        <label>Cor<input type="color" name="cor" value="#c9a227"></label>
      </div>
      <label>Quando chegar<select name="aviso">${opcoes(AVISOS, "todos")}</select></label>
      <p class="cm-dica">Vira uma nota que se repete todo ano, ligada à página da divindade. Ela aparece no calendário e no Journal da Mesa.</p>
    </div>`,
    buttons: [{ action: "ok", label: "Criar", default: true, callback: (ev, btn) => Object.fromEntries(new FormData(btn.form)) }, { action: "cancelar", label: "Cancelar" }],
    rejectClose: false
  });
  if (!r || typeof r !== "object") return;
  const deus = r.deus ? game.journal.get(r.deus) : null;
  const nomeDeus = deus?.name ?? (String(r.outra ?? "").trim() || "divindade");
  const nome = String(r.nome ?? "").trim() || `Dia sagrado de ${nomeDeus}`;
  const mes = Math.min(Math.max(0, num(r.mes)), N.CFG.meses.length - 1);
  const ano = mesExiste(a.ano, mes) ? a.ano : a.ano + 1;
  const td = tdDe(ano, mes, Math.min(Math.max(1, num(r.dia, 1)), Math.max(1, diasNoMes(ano, mes))) - 1);
  const pasta = await pastaParaNota(game.settings.get(MOD, "pastaNotas"), "", td);
  const link = deus ? `@UUID[${deus.uuid}]{${deus.name}}` : esc(nomeDeus);
  const e = await JournalEntry.create({
    name: nome,
    folder: pasta?.id ?? null,
    ownership: { default: 2 },
    flags: { [MOD]: { nota: notaNova(td, { repetir: "anual", cada: 1, icone: "fa-hands-praying", cor: r.cor || "#c9a227", aviso: AVISOS[r.aviso] ? r.aviso : "todos", duracao: Math.max(1, num(r.duracao, 1)), divindade: deus?.uuid ?? nomeDeus }) } },
    pages: [paginaDeEvento(nome, `<p>Dia sagrado de ${link}.</p>`)]
  });
  if (e) ui.notifications.info(`"${nome}" marcado todo ano em ${num(r.dia)} de ${N.CFG.meses[mes].nome}.`);
  return e;
}

export {
  dialogoAcoesNota,
  JanelaTabelas,
  tabelasDeEncontro,
  EditorCalendario,
  JanelaClima,
  JanelaViagem,
  acaoViagem,
  dialogoVigias,
  horaParaDec,
  iniciarViagemSeparada,
  proximoHorario,
  FORMATOS,
  JanelaContadores,
  JanelaHistorico,
  JanelaLuz,
  RITMOS,
  TRAD,
  abrevDe,
  converterCalendario,
  datasDasNotas,
  deslocamentoDe,
  detectarFormato,
  diaAbsoluto,
  dialogoClima,
  dialogoDiaSagrado,
  dialogoNota,
  dialogoViagem,
  divindades,
  estacoesPorInicio,
  exportarHistorico,
  fontesDoMundo,
  iconeEstacao,
  lista,
  loc,
  nomeDe,
  novoContador,
  pedirTexto,
  presetGregoriano,
  registrarManual,
  reposicionarNotas,
  traduzir,
  ultimoNumero
};
