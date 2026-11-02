/* =========================================================
 * Calendário da Mesa — Luas
 * Fases, luas que aparecem e somem em ciclos, eventos das luas (eclipses, luas cheias juntas, noite
 * sem luas) e os avisos no chat.
 * ========================================================= */

import { diasNoMes, infoDia, tdDe, textoData } from "./datas.js";
import { registrarVarios } from "./historico.js";
import { CAL_ID, CFG, chat, esc, idsGM, mod, MOD, num, registrarCache, segDia, T } from "./nucleo.js";

const FASES_PADRAO = ["Luas.lua_nova", "Luas.crescente", "Luas.quarto_crescente", "Luas.gibosa_crescente", "Luas.lua_cheia", "Luas.gibosa_minguante", "Luas.quarto_minguante", "Luas.minguante"]
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

const UNIDADES = { dias: "Comum.dias", meses: "Comum.meses", anos: "Comum.anos" };
const UNIDADE_SING = { dias: "Comum.dia", meses: "Luas.mes", anos: "Luas.ano" };

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
const textoFalta = (v) => `${v.faltaDias === 1 ? T("Comum.1_dia") : T("Comum.0_dias", [v.faltaDias])} (${textoData(infoDia(v.alvoTd), { semana: false })})`;

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
const CACHE_LUAS = registrarCache(new Map());
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
  const nomes = e.luas.join(T("Comum.e"));
  switch (e.tipo) {
    case "eclipseSolar": return T("Luas.eclipse_solar_lua_cobre_o_sol", { lua: nomes });
    case "eclipseLunar": return T("Luas.eclipse_lunar_em_lua", { lua: nomes });
    case "cheiasJuntas": return T("Luas.luas_cheias_juntas_luas", { luas: nomes });
    case "semLuas": return T("Luas.noite_sem_luas_todas_somem_do");
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
    await chat(`<i class="fa-solid fa-moon"></i> <b>${T("Comum.no_ceu")}</b> · <small>${esc(textoData(infoDia(td), { semana: false }))}</small><ul>${ev.map((e) => `<li><i class="fa-solid ${e.icone}" style="color:${e.cor}"></i> ${esc(textoEventoLua(e))}</li>`).join("")}</ul>`, quem === "mestre" ? idsGM() : []);
    await registrarVarios(ev.map((e) => ({ texto: textoEventoLua(e), icone: e.icone, wt: td * segDia() })));
  }
}

export {
  avisarEventosLuas,
  eventosLuasDoDia,
  faseDe,
  FASES_PADRAO,
  luasNoCeu,
  luaSVG,
  proximosEventosLuas,
  textoEventoLua,
  textoFalta,
  UNIDADE_SING,
  UNIDADES,
  visibilidadeLua
};
