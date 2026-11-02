/* =========================================================
 * Calendário da Mesa — Histórico da campanha
 * Registros, o Diário do histórico (páginas Recentes e Arquivo) e a "Sessão de jogo".
 * ========================================================= */

import { infoDia, textoData } from "./datas.js";
import { pastaCalendario } from "./notas.js";
import { CAL_ID, diaTotalDe, esc, MOD, naFila, num, souGMPrincipal, T } from "./nucleo.js";

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
    e = await JournalEntry.create({ name: T("Comum.historico_da_campanha"), folder: pasta?.id ?? null, flags: { [MOD]: { historico: true } }, pages: [] });
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
    else await e.createEmbeddedDocuments("JournalEntryPage", [{ name: T("Tempo.arquivo"), type: "text", sort: 0, text: { content: html }, flags: { [MOD]: { arquivo: true } } }]);
  } catch (err) { console.warn(`${MOD} | não consegui arquivar o histórico`, err); }
}

/** "Sessão de jogo" no histórico: só quando a última registrada tem mais de 6 h de tempo real ou é de outro dia
 *  real — recarregar a página (F5) no meio da sessão não registra outra. */
async function registrarSessao() {
  const agoraMs = Date.now();
  const ultima = num(game.settings.get(MOD, "ultimaSessao"), 0);
  const outroDia = new Date(ultima).toDateString() !== new Date(agoraMs).toDateString();
  if (ultima > 0 && agoraMs - ultima < 6 * 3600 * 1000 && !outroDia) return;
  await game.settings.set(MOD, "ultimaSessao", agoraMs);
  await registrar(`${T("Config.sessao_de_jogo_0", [new Date(agoraMs).toLocaleDateString(game.i18n.lang)])}`, { icone: "fa-dice-d20" });
}

export {
  alterarHistorico,
  diarioHistorico,
  HIST_MAX,
  historico,
  historicoHTML,
  registrar,
  registrarSessao,
  registrarVarios
};
