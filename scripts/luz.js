/* =========================================================
 * Calendário da Mesa — Luz do mapa
 * Curva de luz por hora, escuridão e cor da noite nas cenas e a névoa de guerra com o dia e a noite.
 * ========================================================= */

import { faseDe, luasNoCeu } from "./luas.js";
import { CFG, diaTotalDe, mod, MOD, noMundo, num, relatarErro, segHora, segundoDoDia, souGMPrincipal, T } from "./nucleo.js";

/* ---------------- luz do mapa (escuridão nativa da cena) ----------------
 * A luz vale para o mundo todo: as contas usam sempre o calendário principal (noMundo), mesmo que o mestre esteja
 * vendo outro calendário em "ver como" ou numa cena de outra civilização (outro tamanho de dia mudaria a curva). */

/** Curva padrão de luz (0 a 100) para cada hora do dia, adaptada a quantas horas o dia tiver. */
function luzPadrao(H = CFG.horasDia) {
  const base = { 5: 10, 6: 35, 7: 70, 8: 90, 17: 90, 18: 65, 19: 30 };
  return Array.from({ length: H }, (_, h) => {
    const t = Math.round((h / H) * 24);
    if (t < 5 || t >= 20) return 0;
    return base[t] ?? 100;
  });
}

function luzCfg() { return noMundo(luzCfgAqui); }
function luzCfgAqui() {
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
function luzDoSol(wt, L = luzCfg()) { return noMundo(() => luzDoSolAqui(wt, L)); }
function luzDoSolAqui(wt, L) {
  const H = CFG.horasDia, v = L.horas;
  const hd = segundoDoDia(wt) / segHora();
  const i = Math.floor(hd) % H, f = hd - Math.floor(hd);
  const p0 = v[mod(i - 1, H)], p1 = v[i], p2 = v[(i + 1) % H], p3 = v[(i + 2) % H];
  const c = 0.5 * (2 * p1 + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f);
  return Math.min(100, Math.max(0, Math.min(Math.max(c, Math.min(p1, p2)), Math.max(p1, p2)))) / 100;
}

/** O que a cena deve mostrar neste momento: escuridão e a cor da noite (pelo calendário principal do mundo). */
function estadoLuz(wt, L = luzCfg()) { return noMundo(() => estadoLuzAqui(wt, L)); }
function estadoLuzAqui(wt, L) {
  const sol = luzDoSolAqui(wt, L);
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
async function atualizarCenas(updates, opcoes = {}, onde = "Erros.atualizar_cenas") {
  if (!updates.length) return;
  const Cena = CONFIG.Scene.documentClass;
  try {
    await Cena.updateDocuments(updates, opcoes);
  } catch (err) {
    console.warn(`${MOD} | ${T(onde)}: lote recusado, tentando uma cena por vez`, err);
    const r = await Promise.allSettled(updates.map(({ _id, ...upd }) => game.scenes.get(_id)?.update(upd, opcoes)));
    const falhas = r.map((x, i) => (x.status === "rejected" ? game.scenes.get(updates[i]._id)?.name ?? updates[i]._id : null)).filter(Boolean);
    if (falhas.length) relatarErro(`${T(onde)} (${falhas.join(", ")})`, r.find((x) => x.status === "rejected").reason);
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
  await atualizarCenas(updates, { animateDarkness: ms }, "Erros.luz_das_cenas");
  return updates.length;
}

let SEQ_LUZ = 0;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/* Como a luz acompanha o tempo (cada gravação é uma ida ao servidor para todas as cenas de dia/noite):
 *  - passos de até 1 hora (relógio andando, +10 min): só as cenas que alguém está vendo, e só quando a escuridão
 *    muda o bastante. Com o relógio em tempo real ligado, que avança a cada 5 s, no máximo uma gravação a cada
 *    30 s reais, a não ser que a luz mude muito de uma vez (nada se perde: o próximo passo leva a cena ao ponto certo);
 *  - pulos de até 6 horas com "passar aos poucos": uma etapa por hora (no máximo 6 gravações);
 *  - pulos maiores: só a luz final, gravada uma vez, com a escuridão animada até ela. */
const LUZ_PULO_ANIMADO_H = 6;
const LUZ_RELOGIO_MS = 30000;
let ULT_LUZ_RELOGIO = 0;

/** Leva a luz das cenas de "antes" até "depois". */
async function atualizarLuz(antes, depois) {
  if (!souGMPrincipal() || !cenasDiaNoite().length) return;
  const id = ++SEQ_LUZ;
  const L = luzCfg();
  const dt = depois - antes, sh = noMundo(segHora);
  const relogio = !!game.settings.get(MOD, "relogioAtivo");
  // passos pequenos: uma animação longa que emenda com a próxima
  const continuo = relogio ? 5500 : 2000;
  if (Math.abs(dt) <= sh && Number.isFinite(antes)) {
    const limiar = !relogio ? 0.01 : performance.now() - ULT_LUZ_RELOGIO < LUZ_RELOGIO_MS ? 0.05 : 0.02;
    const n = await aplicarLuz(estadoLuz(depois, L), continuo, cenasDiaNoite().filter(cenaEmUso), limiar);
    if (relogio && n) ULT_LUZ_RELOGIO = performance.now();
    return;
  }
  if (!L.gradual || !Number.isFinite(antes)) return aplicarLuz(estadoLuz(depois, L), continuo);
  if (Math.abs(dt) > LUZ_PULO_ANIMADO_H * sh) return aplicarLuz(estadoLuz(depois, L), L.transicao * 1000);
  const sentido = Math.sign(dt);
  const passos = [];
  for (let t = antes + sentido * sh; sentido > 0 ? t < depois : t > depois; t += sentido * sh) passos.push(t);
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

export {
  aplicarLuz,
  atualizarCenas,
  atualizarLuz,
  cenasDiaNoite,
  estadoLuz,
  luzCfg,
  luzDoSol,
  luzPadrao,
  visaoDiaNoite
};
