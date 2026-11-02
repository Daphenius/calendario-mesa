/* =========================================================
 * Calendário da Mesa — Contadores e prazos
 * Lista de contadores e o aviso quando um termina.
 * ========================================================= */

import { registrar } from "./historico.js";
import { chat, esc, idsGM, MOD, naFila, souGMPrincipal, T } from "./nucleo.js";

/* ---------------- contadores e prazos ---------------- */

const contadores = () => { const c = game.settings.get(MOD, "contadores"); return Array.isArray(c?.lista) ? c.lista : []; };

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
    await chat(`<i class="fa-solid fa-hourglass-end"></i> <b>${esc(c.nome)}</b> ${T("Contadores.terminou")}`, c.aviso === "todos" ? [] : idsGM());
    await registrar(`${T("Contadores.prazo_terminou_0", [c.nome])}`, { icone: "fa-hourglass-end", wt: c.fim });
  }
}

export {
  alterarContadores,
  contadores,
  verificarContadores
};
