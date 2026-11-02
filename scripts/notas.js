/* =========================================================
 * Calendário da Mesa — Notas e eventos
 * Dados e repetição das notas, pastas, criar e editar pelo calendário ou pelo Journal da Mesa, avisos
 * do dia, dia das lojas do Journal e as ações das notas (macro, som, cena).
 * ========================================================= */

import { diasNoMes, infoDia, tdDe, textoData } from "./datas.js";
import { CAL_ID, calDaNota, CFG, chat, comCal, Dialogo, diaTotalDe, esc, idsGM, JOURNAL, listaCalendarios, MOD, num, registrarCache, relatarErro, segDia, segHora, segMinuto, souGMPrincipal, T } from "./nucleo.js";
import { ferr } from "./sob-demanda.js";

/* ---------------- notas e eventos ---------------- */

const REPETIR = { nao: "Notas.nao_repete", dias: "Comum.dias_2", semanas: "Notas.semanas", meses: "Comum.meses_2", anos: "Notas.anos" };
const ANTIGOS = { anual: ["anos", 1], mensal: ["meses", 1], semanal: ["semanas", 1], ndias: ["dias", null] };
const MODOS_MES = { dia: "dia", semana: "semana", ultima: "ultima" };
const FIM = { nunca: "Notas.nunca", data: "Notas.numa_data", vezes: "Notas.depois_de_n_vezes" };
const ICONES = {
  "fa-star": "Comum.estrela", "fa-flag": "Notas.bandeira", "fa-crown": "Notas.coroa", "fa-skull": "Comum.caveira", "fa-gift": "Notas.festa",
  "fa-hands-praying": "Notas.religioso", "fa-scroll": "Notas.missao", "fa-coins": "Notas.comercio", "fa-moon": "Comum.lua", "fa-fire": "Comum.fogo",
  "fa-droplet": "Comum.agua", "fa-mountain": "Notas.terra", "fa-wind": "Comum.ar", "fa-bell": "Notas.lembrete", "fa-cake-candles": "Notas.aniversario"
};
const AVISOS = { nenhum: "Notas.sem_aviso", mestre: "Comum.avisar_so_o_mestre", todos: "Notas.avisar_todos_no_chat" };

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
const CACHE_FIM = registrarCache(new Map());
const LIMITE_SERIE = 200000;   // dias à frente em que uma série "depois de N vezes" ainda é procurada
function ultimoInicio(n) {
  if (n.repetir === "nao") return n.td;
  if (n.fim.tipo === "data") return n.fim.td;
  if (n.fim.tipo !== "vezes") return Infinity;
  const chave = JSON.stringify([CAL_ID, n.td, n.repetir, n.cada, n.diasSemana, n.modoMes, n.fim.vezes, CFG.nome, CFG.meses.length]);
  if (CACHE_FIM.has(chave)) return CACHE_FIM.get(chave);
  const ult = ultimaDasVezes(n);
  if (CACHE_FIM.size > 500) CACHE_FIM.clear();
  CACHE_FIM.set(chave, ult);
  return ult;
}

/** Dia em que cai a última das N vezes. Em vez de olhar dia por dia, olha só onde a regra pode bater: a conta
 *  direta em "a cada N dias", as semanas da série em "semanas" e os meses da série em "meses" e "anos" (no máximo
 *  uma vez por mês). Cada candidato passa pela mesma bateRegra, então o resultado é o de olhar dia por dia. */
function ultimaDasVezes(n) {
  const fimBusca = n.td + LIMITE_SERIE;     // primeiro dia que já não entra
  if (n.repetir === "dias") return n.td + Math.min(n.fim.vezes - 1, Math.floor((LIMITE_SERIE - 1) / n.cada)) * n.cada;
  let cont = 0, ult = n.td;
  const confere = (td) => { if (td >= n.td && td < fimBusca && bateRegra(n, td)) { cont++; ult = td; } return cont >= n.fim.vezes; };
  if (n.repetir === "semanas") {
    const W = CFG.semana.length;
    for (let inicio = n.td - infoDia(n.td).sem; inicio < fimBusca; inicio += W * n.cada) {
      for (let d = 0; d < W; d++) if (confere(inicio + d)) return ult;
    }
    return ult;
  }
  // meses e anos
  const base = infoDia(n.td), nM = CFG.meses.length, anoMax = infoDia(fimBusca).ano;
  const passo = n.repetir === "anos" ? nM * n.cada : n.cada;
  for (let k = base.ano * nM + base.mes; ; k += passo) {
    const ano = Math.floor(k / nM), mes = k - ano * nM;
    if (ano > anoMax) break;
    const dias = diasNoMes(ano, mes);
    if (!dias) continue;                    // mês que não existe naquele ano
    const ini = tdDe(ano, mes, 0);
    const i = infoDia(ini);
    if (i.ano !== ano || i.mes !== mes || i.dia !== 0) return ultimaDasVezesDiaADia(n);   // calendário que a conta não entende
    if (ini >= fimBusca) break;
    for (let d = 0; d < dias; d++) if (confere(ini + d)) return ult;
  }
  return ult;
}

/** O jeito antigo (dia por dia), só para calendários em que a conta por mês não fecha. */
function ultimaDasVezesDiaADia(n) {
  let cont = 0, ult = n.td;
  for (let td = n.td; td < n.td + LIMITE_SERIE && cont < n.fim.vezes; td++) if (bateRegra(n, td)) { cont++; ult = td; }
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
  if (n.repetir === "nao") return n.duracao > 1 ? T("Comum.0_dias", [n.duracao]) : T("Notas.nao_repete");
  const base = infoDia(n.td);
  const un = { dias: T("Comum.dias"), semanas: T("Comum.semanas"), meses: T("Comum.meses"), anos: T("Comum.anos") }[n.repetir];
  let t = n.cada === 1 ? { dias: T("Notas.todo_dia"), semanas: T("Notas.toda_semana"), meses: T("Notas.todo_mes"), anos: T("Notas.todo_ano") }[n.repetir] : T("Notas.a_cada_0_1", [n.cada, un]);
  const sem = (i) => CFG.semana[i]?.nome ?? "?";
  const ordinal = (k) => [T("Notas.1"), T("Notas.2"), T("Notas.3"), T("Notas.4"), T("Notas.5"), T("Notas.6")][k] ?? `${k + 1}º`;
  if (n.repetir === "semanas") t += `: ${n.diasSemana.map(sem).join(", ").replace(/, ([^,]*)$/, ` ${T("Notas.e")} $1`)}`;
  if (n.repetir === "meses" || n.repetir === "anos") {
    const mes = n.repetir === "anos" ? T("Notas.de_0", [CFG.meses[base.mes]?.nome]) : "";
    t += n.modoMes === "dia" ? T("Notas.no_dia_0_1", [base.dia + 1, mes])
      : n.modoMes === "ultima" ? T("Notas.no_ultimo_0_1", [sem(base.sem), mes])
      : T("Notas.no_0_1_2", [ordinal(posNoMes(base).nth), sem(base.sem), mes]);
  }
  if (n.duracao > 1) t += T("Notas.durando_0_dias", [n.duracao]);
  if (n.fim.tipo === "data") t += T("Notas.ate_0", [textoData(infoDia(n.fim.td), { semana: false })]);
  if (n.fim.tipo === "vezes") t += n.fim.vezes === 1 ? T("Notas.1_vez") : T("Notas.0_vezes", [n.fim.vezes]);
  if (n.excecoes.length) t += n.excecoes.length === 1 ? T("Notas.1_pulada") : T("Notas.0_puladas", [n.excecoes.length]);
  return t;
}

function segundosDaHora(hora) {
  if (!hora) return 0;
  const [h, m] = hora.split(":").map(Number);
  return Math.min(h, CFG.horasDia - 1) * segHora() + Math.min(m, CFG.minutosHora - 1) * segMinuto();
}

async function pastaCalendario() {
  let f = game.folders.find((f) => f.type === "JournalEntry" && f.getFlag(MOD, "pasta"));
  if (!f && game.user.isGM) f = await Folder.create({ name: T("Comum.calendario"), type: "JournalEntry", color: "#3a5f8a", flags: { [MOD]: { pasta: true } } });
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
    name: T("Notas.novo_evento"),
    folder: pasta?.id ?? null,
    ownership,
    flags: { [MOD]: { nota: notaNova(td) } },
    pages: [paginaDeEvento(T("Notas.novo_evento"))]
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
    window: { title: "CALMESA.Notas.apagar_nota", icon: "fa-solid fa-trash" },
    content: `<p>${T("Comum.apagar")} <b>${esc(j.name)}</b> ${T("Notas.do_calendario")}</p><p class="cm-dica">${T("Notas.isso_apaga_o_diario_0_para", [esc(j.name)])}</p>`,
    yes: { label: T("Notas.apagar_o_diario") }, no: { label: T("Comum.cancelar") }
  });
  if (ok) return j.delete();
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
      try { renovou = !!(await jm.api.renovarEstoques()); } catch (err) { relatarErro(T("Avisos.renovar_estoques_do_journal_da_mesa"), err); }
    }
    if (!renovou && game.settings.get(MOD, "avisoSemana")) {
      await chat(`<i class="fa-solid fa-store"></i> ${T("Avisos.comecou_uma_nova_semana_hora_de")} <b>${T("Avisos.estoque_das_lojas")}</b> ${T("Avisos.no_journal_da_mesa")}`, idsGM());
    }
  }
}

/* ---------------- ações das notas ----------------
 * Uma nota pode, quando a hora dela chega: rodar uma macro, tocar um som, trocar de cena e mandar um texto
 * no chat. Fica em flags[MOD].acoes = { macro, som, volume, cena, cenaModo: "ativar"|"ver", chat, chatPara }. */
const MODOS_CENA = { ativar: "Notas.ativar_para_todos", ver: "Notas.so_o_mestre_vai_para_a" };
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
    } catch (err) { relatarErro(T("Notas.som_da_nota_nome", { nome }), err); }
  }
  if (a.cena) {
    const cena = game.scenes.get(a.cena) ?? (await fromUuid(a.cena).catch(() => null));
    if (cena) { try { await (a.cenaModo === "ver" ? cena.view() : cena.activate()); } catch (err) { relatarErro(T("Notas.cena_da_nota_nome", { nome }), err); } }
  }
  if (a.macro) {
    const m = game.macros?.get(a.macro) ?? (await fromUuid(a.macro).catch(() => null));
    if (m) { try { await m.execute({ nota: j, td, data: infoDia(td) }); } catch (err) { relatarErro(T("Notas.macro_da_nota_nome", { nome }), err); } }
    else relatarErro(T("Notas.macro_da_nota_nome", { nome }), new Error(T("Notas.macro_nao_encontrada")));
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

export {
  abrirNota,
  acoesDaNota,
  apagarNota,
  avisarNotas,
  AVISOS,
  caminhoPasta,
  comecaEm,
  criarNota,
  dadosNota,
  descreverRepeticao,
  dispararAcoesDasNotas,
  editarNota,
  executarAcoes,
  FIM,
  ICONES,
  inicioQueCobre,
  integrarJournal,
  linhaDoJournal,
  MODOS_CENA,
  normalizarNota,
  notaNova,
  notas,
  notasDoDia,
  notasNoJournal,
  paginaDeEvento,
  pastaCalendario,
  pastaParaNota,
  podeCriarNota,
  proximasVezes,
  REPETIR,
  segundosDaHora
};
