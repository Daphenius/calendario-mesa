/* =========================================================
 * Calendário da Mesa — Datas
 * Informações de um dia, hoje, meses e anos, textos de data, hora e duração, estações, eras e as datas
 * nos textos (@Data[...] e @Hoje).
 * ========================================================= */

import { bisCada, CACHE, cal, CFG, diaTotalDe, eraDoAnoCfg, esc, idxEstacaoCfg, mesExisteCfg, mod, MOD, num, pad, segDia, segHora, segMinuto, segundoDoDia, solDeCfg, T, textoAnoCfg } from "./nucleo.js";

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
  const partes = ano ? T("Tempo.0_de_1_de_2", [inf.dia + 1, mes, textoAno(inf.ano)]) : T("Comum.0_de_1", [inf.dia + 1, mes]);
  return semana ? `${CFG.semana[inf.sem]?.nome ?? ""}, ${partes}` : partes;
}

const textoHora = (h, m) => `${pad(h)}:${pad(m)}`;
/** Relógio com segundos a partir dos segundos do dia. */
function textoRelogio(seg) {
  seg = Math.max(0, Math.floor(seg));
  const h = Math.floor(seg / segHora()), m = Math.floor((seg % segHora()) / segMinuto()), sg = seg % segMinuto();
  return `${pad(h)}:${pad(m)}:${pad(sg)}`;
}
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
  if (hd < nascer) return { nome: T("Luas.madrugada"), icone: "fa-moon" };
  if (hd < meio) return { nome: T("Luas.manha"), icone: "fa-sun" };
  if (hd < por) return { nome: T("Luas.tarde"), icone: "fa-sun" };
  return { nome: T("Comum.noite"), icone: "fa-moon" };
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
      if (td == null) { a.classList.add("cm-link-ruim"); a.dataset.tooltip = T("Datas.data_nao_encontrada_no_calendario"); }
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
      catch { a.textContent = T("Comum.hoje"); }
      return a;
    }
  });
}

export {
  agora,
  diasNoMes,
  duracaoTexto,
  eraDoAno,
  estacaoDe,
  infoDia,
  mesExiste,
  mesProximoQueExiste,
  periodoDe,
  registrarEnrichers,
  solDe,
  tdDe,
  textoAno,
  textoData,
  textoHora,
  textoHoraDec,
  textoRelogio
};
