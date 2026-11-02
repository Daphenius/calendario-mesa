/* =========================================================
 * Calendário da Mesa — Tempo
 * O que acontece quando o tempo passa, efeitos com duração vencidos, desfazer o último pulo, avançar e
 * ir para uma data, relógio em tempo real e pulo cinematográfico.
 * ========================================================= */

import { aplicarClimaNasCenas } from "./clima-cenas.js";
import { atualizarClima } from "./clima.js";
import { verificarContadores } from "./contadores.js";
import { agora, duracaoTexto, infoDia, textoData, textoRelogio } from "./datas.js";
import { alterarHistorico, historico, registrarVarios } from "./historico.js";
import { HUD, JanelaCalendario } from "./janela.js";
import { avisarEventosLuas } from "./luas.js";
import { atualizarLuz } from "./luz.js";
import { avisarNotas, comecaEm, dispararAcoesDasNotas, integrarJournal, notas, segundosDaHora } from "./notas.js";
import { chat, Dialogo, diaTotalDe, esc, idsGM, JOURNAL, MOD, naFila, num, relatarErro, segDia, segHora, segMinuto, segundoDoDia, souGMPrincipal, T } from "./nucleo.js";
let ULT_TEMPO = 0;   // quando o tempo do mundo mudou pela última vez (para o relógio contar os segundos entre um passo e outro)
/** Marca o instante (relógio real) em que o tempo do mundo mudou. */
function marcarTempo() { ULT_TEMPO = performance.now(); }

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
  atualizarLuz(antes, wt).catch((err) => relatarErro("Erros.luz_das_cenas", err));
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
    if (Math.abs(d1 - d0) > 1) reg.push({ texto: d1 > d0 ? T("Luz.passaram_0_dias", [Math.abs(d1 - d0)]) : T("Luz.voltaram_0_dias", [Math.abs(d1 - d0)]), icone: "fa-forward" });
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
    } catch (err) { relatarErro(T("Efeitos.efeitos_vencidos_de_nome", { nome: ator.name }), err, { avisar: false }); }
  }
  if (relatorio.length && game.settings.get(MOD, "efeitosAviso")) {
    const linhas = relatorio.map((r) => `<li><b>${esc(r.ator)}</b>: ${r.efeitos.map(esc).join(", ")}</li>`).join("");
    await chat(`<i class="fa-solid fa-hourglass-end"></i> <b>${modo === "desativar" ? T("Efeitos.efeitos_que_acabaram_desativados") : T("Efeitos.efeitos_que_acabaram")}</b><ul>${linhas}</ul>`, idsGM());
  }
  return relatorio;
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
  if (!ult) { ui.notifications.info(T("Tempo.nao_ha_pulo_de_tempo_para")); return false; }
  if (game.time.worldTime !== ult.depois) {
    const ok = await Dialogo().confirm({ window: { title: "CALMESA.Comum.desfazer" }, content: `<p>${T("Tempo.o_tempo_mudou_depois_desse_pulo", { quando: esc(textoData(infoDia(diaTotalDe(ult.antes)))) })}</p>` });
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
    try { await jm.api.dia.somar(-u.dias); } catch (err) { relatarErro(T("Tempo.dia_do_journal_da_mesa"), err, { avisar: false }); }
  }
  await aplicarClimaNasCenas();
  HUD.render();
  ui.notifications.info(T("Tempo.pulo_desfeito_voltou_para_quando", { quando: `${textoData(infoDia(diaTotalDe(u.antes)), { semana: false })} ${textoRelogio(segundoDoDia(u.antes))}` }));
}

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
    window: { title: "CALMESA.Tempo.definir_hora", icon: "fa-solid fa-clock" },
    position: { width: 300 },
    content: `<div class="cm-form"><label>${T("Tempo.hora_do_dia")}<input type="text" name="hora" value="${textoRelogio(segundoDoDia(a.wt))}" placeholder="${T("Tempo.hh_mm_ou_hh_mm_ss")}" autofocus></label></div>`,
    buttons: [{ action: "ok", label: T("Tempo.definir"), default: true, callback: (ev, btn) => btn.form.elements.hora.value }, { action: "cancelar", label: T("Comum.cancelar") }],
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
    game.time.advance(seg).catch((err) => relatarErro(T("Tempo.relogio_em_tempo_real"), err));
  }, PASSO * 1000);
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
    <div class="cm-cin-sub">${dias >= 0 ? T("Tempo.o_tempo_passa") : T("Tempo.o_tempo_volta")}</div>
    <div class="cm-cin-data">${esc(textoData(infoDia(d0)))}</div>
    <div class="cm-cin-conta">${dias ? (Math.abs(dias) > 1 ? T("Comum.0_dias", [Math.abs(dias)]) : T("Comum.1_dia")) : duracaoTexto(Math.abs(depois - antes))}</div>
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

export {
  aoMudarTempo,
  avancar,
  avancarAte,
  definirHoraDialogo,
  DESFAZER,
  desfazerUltimoPulo,
  expirarEfeitos,
  iniciarRelogio,
  irPara,
  marcarTempo,
  ULT_TEMPO
};
