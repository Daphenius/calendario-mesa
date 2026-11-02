/* =========================================================
 * Calendário da Mesa — Lojas
 * Horário e folga das lojas do Journal da Mesa (abertas e fechadas pela hora do mundo).
 * ========================================================= */

import { infoDia } from "./datas.js";
import { CFG, diaTotalDe, esc, JOURNAL, num, pad, segHora, segMinuto, segundoDoDia, T } from "./nucleo.js";

/* ---------------- lojas abertas e fechadas ---------------- */

const MEJ = "monks-enhanced-journal";
function paginaDeLoja(e) {
  return e?.pages?.contents?.find((p) => p.flags?.[MEJ]?.type === "shop") ?? null;
}

/** Horário da loja em minutos do dia (formato do Monk's/Journal: abre 480 = 08:00, fecha 1020 = 17:00).
 *  O Journal guarda em flags["journal-mesa"].horario se a loja usa horário ({ ativo, folga: [dias da semana] }).
 *  Loja do Journal sem horário ligado = sempre aberta. Loja só do Monk's = usa abertura/fechamento dele. */
function horarioLoja(e) {
  const p = paginaDeLoja(e);
  if (!p) return null;
  const hj = p.flags?.[JOURNAL]?.horario;
  const doJournal = !!p.flags?.[JOURNAL];
  const ativo = hj ? hj.ativo !== false : !doJournal;
  const abre = num(p.flags[MEJ].opening, 480), fecha = num(p.flags[MEJ].closing, 1020);
  const folga = Array.isArray(hj?.folga) ? hj.folga.map(Number).filter(Number.isFinite) : [];
  return { abre, fecha, ativo, folga };
}

/** Motivo de a loja estar fechada agora ("folga", "horario") ou null se aberta. */
function lojaFechadaPor(e, wt = game.time.worldTime) {
  const h = horarioLoja(e);
  if (!h || !h.ativo) return null;
  if (h.folga.length && h.folga.includes(infoDia(diaTotalDe(wt)).sem)) return "folga";
  if (h.abre === h.fecha) return null;
  const s = segundoDoDia(wt);
  const min = Math.floor(s / segHora()) * 60 + Math.floor((s % segHora()) / segMinuto()) * (60 / CFG.minutosHora);
  const dentro = h.abre < h.fecha ? min >= h.abre && min < h.fecha : min >= h.abre || min < h.fecha;
  return dentro ? null : "horario";
}

const lojaAberta = (e, wt = game.time.worldTime) => lojaFechadaPor(e, wt) === null;

const minutoParaHora = (m) => `${pad(Math.floor(m / 60))}:${pad(Math.round(m % 60))}`;

function lojasHTML() {
  const lojas = game.journal.filter((e) => paginaDeLoja(e) && (game.user.isGM || e.testUserPermission(game.user, "LIMITED")));
  if (!lojas.length) return "";
  const linhas = lojas.sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang)).map((e) => {
    const h = horarioLoja(e), motivo = lojaFechadaPor(e), aberta = !motivo;
    const texto = !h.ativo ? T("Lojas.sempre_aberta")
      : motivo === "folga" ? T("Lojas.folga_hoje")
      : aberta ? (h.abre === h.fecha ? T("Lojas.aberta") : `${T("Lojas.aberta_ate_0", [minutoParaHora(h.fecha)])}`) : `${T("Lojas.fechada_abre_0", [minutoParaHora(h.abre)])}`;
    return `<li class="${aberta ? "cm-aberta" : "cm-fechada"}"><i class="fa-solid fa-store"></i>
      <a data-action="abrirNota" data-id="${e.id}">${esc(e.name)}</a>
      <span>${texto}</span></li>`;
  }).join("");
  return `<div class="cm-bloco"><h4>${T("Lojas.lojas_agora")}</h4><ul class="cm-lojas">${linhas}</ul></div>`;
}

export {
  horarioLoja,
  lojaAberta,
  lojaFechadaPor,
  lojasHTML
};
