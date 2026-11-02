/* =========================================================
 * Calendário da Mesa — Histórico, contadores e dias sagrados
 * Janelas do histórico e dos contadores e o diálogo de dia sagrado.
 * ========================================================= */

import { alterarContadores, contadores } from "../contadores.js";
import { agora, diasNoMes, duracaoTexto, infoDia, mesExiste, tdDe, textoData, textoHora } from "../datas.js";
import { alterarHistorico, diarioHistorico, HIST_MAX, historico, historicoHTML } from "../historico.js";
import { AVISOS, notaNova, paginaDeEvento, pastaParaNota } from "../notas.js";
import { CAL_ID, CFG, Dialogo, diaTotalDe, esc, JOURNAL, MOD, num, opcoes, segDia, segHora, segMinuto, segundoDoDia, T, tema } from "../nucleo.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class JanelaHistorico extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "cm-historico",
    classes: ["cm-janela"],
    tag: "div",
    window: { title: "CALMESA.Comum.historico_da_campanha", icon: "fa-solid fa-scroll", resizable: true },
    position: { width: 560, height: 640 },
    actions: {
      async novo() {
        const texto = await pedirTexto(T("Historico.registrar_no_historico"), T("Historico.o_que_aconteceu_hoje"));
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
          ${gm ? `<a class="cm-hist-x" data-action="apagar" data-id="${i.id}" data-tooltip="${T("Comum.apagar")}"><i class="fa-solid fa-xmark"></i></a>` : ""}</li>`).join("")}</ul>
      </div>`).join("");
    const f = (k, r) => `<button type="button" data-action="filtro" data-f="${k}" class="${this.filtro === k ? "cm-on" : ""}">${r}</button>`;
    return `<div class="cm-raiz cm-editor cm-tema-${tema()}">
      <div class="cm-ed-cals-linha">
        ${f("tudo", T("Historico.tudo"))}${f("eventos", T("Historico.eventos_e_viagens"))}${f("manual", T("Historico.anotacoes"))}
        <span class="cm-esp"></span>
        ${gm ? `<button type="button" data-action="novo"><i class="fa-solid fa-feather"></i> ${T("Historico.anotar_hoje")}</button>
        <button type="button" data-action="exportar" data-tooltip="${T("Historico.cria_ou_atualiza_o_diario_historico")}"><i class="fa-solid fa-book"></i> ${T("Historico.criar_diario")}</button>` : ""}
      </div>
      ${game.journal.find((j) => j.getFlag(MOD, "historico"))?.pages?.find((p) => p.getFlag(MOD, "arquivo")) ? `<p class="cm-dica"><i class="fa-solid fa-box-archive"></i> ${T("Historico.aqui_ficam_os_0_registros_mais", [HIST_MAX])}</p>` : ""}
      ${blocos || `<p class="cm-vazio">${T("Historico.nada_registrado_ainda_o_historico_se")}</p>`}
    </div>`;
  }

  _replaceHTML(html, content) { content.innerHTML = html; }
}

async function pedirTexto(titulo, rotulo, valor = "") {
  const r = await Dialogo().wait({
    window: { title: titulo, icon: "fa-solid fa-feather" },
    content: `<div class="cm-form"><label>${esc(rotulo)}<textarea name="t" rows="3">${esc(valor)}</textarea></label></div>`,
    buttons: [{ action: "ok", label: T("Comum.salvar"), default: true, callback: (ev, btn) => btn.form.elements.t.value }, { action: "cancelar", label: T("Comum.cancelar") }],
    rejectClose: false
  });
  return typeof r === "string" && r !== "ok" && r !== "cancelar" ? r.trim() : "";
}

async function registrarManual(texto) {
  if (!game.user.isGM) return;
  const item = { id: foundry.utils.randomID(), wt: game.time.worldTime, td: agora().td, cal: CAL_ID, icone: "fa-feather", texto };
  await alterarHistorico((itens) => { itens.push(item); });
}

async function exportarHistorico() {
  // a página "Recentes" é refeita; a página "Arquivo" guarda os registros antigos e nunca é apagada
  const e = await diarioHistorico();
  const html = historicoHTML(historico()) || `<p>${T("Historico.nada_registrado")}</p>`;
  const pag = e.pages.find((p) => p.getFlag(MOD, "recentes"));
  if (pag) await pag.update({ "text.content": html });
  else await e.createEmbeddedDocuments("JournalEntryPage", [{ name: T("Historico.recentes"), type: "text", sort: 100000, text: { content: html }, flags: { [MOD]: { recentes: true } } }]);
  ui.notifications.info(T("Historico.diario_historico_da_campanha_atualizado"));
  e.sheet?.render(true);
}

/* Primeira janela migrada para Handlebars (PARTS): o HTML está em templates/contadores.hbs e aqui fica só
 * a preparação dos dados. Mesmo id, classes, data-action e seletores de CSS da versão anterior. */
class JanelaContadores extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "cm-contadores",
    classes: ["cm-janela"],
    tag: "div",
    window: { title: "CALMESA.Comum.contadores_e_prazos", icon: "fa-solid fa-hourglass-half", resizable: true },
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
    const fimTexto = (fim) => `${T("Contadores.0_as_1", [textoData(infoDia(diaTotalDe(fim)), { semana: false }), textoHora(Math.floor(segundoDoDia(fim) / segHora()), Math.floor((segundoDoDia(fim) % segHora()) / segMinuto()))])}`;
    const itens = contadores().filter((c) => gm || c.visivel).sort((a, b) => a.feito - b.feito || a.fim - b.fim).map((c) => {
      const total = Math.max(1, c.fim - c.inicio);
      return {
        id: c.id, nome: c.nome, visivel: !!c.visivel, feito: !!c.feito,
        estado: c.feito ? T("Contadores.terminou_2") : T("Contadores.falta_0", [duracaoTexto(c.fim - wt)]),
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
    window: { title: "CALMESA.Contadores.novo_contador", icon: "fa-solid fa-hourglass-start" },
    content: `<div class="cm-form">
      <label>${T("Comum.nome")}<input type="text" name="nome" placeholder="${T("Contadores.o_ritual_se_completa")}" autofocus></label>
      <div class="cm-form-2">
        <label>${T("Contadores.daqui_a")}<input type="number" name="q" min="0" step="0.5" value="1"></label>
        <label>${T("Comum.unidade")}<select name="un"><option value="m">${T("Contadores.minutos")}</option><option value="h" selected>${T("Contadores.horas")}</option><option value="d">${T("Comum.dias")}</option><option value="s">${T("Comum.semanas")}</option></select></label>
      </div>
      <div class="cm-form-2">
        <label>${T("Comum.quem_ve")}<select name="vis"><option value="1">${T("Comum.todos")}</option><option value="">${T("Comum.so_o_mestre")}</option></select></label>
        <label>${T("Contadores.quando_terminar")}<select name="aviso"><option value="mestre">${T("Comum.avisar_so_o_mestre")}</option><option value="todos">${T("Contadores.avisar_todos")}</option></select></label>
      </div></div>`,
    buttons: [{ action: "ok", label: T("Comum.criar"), default: true, callback: (ev, btn) => Object.fromEntries(new FormData(btn.form)) }, { action: "cancelar", label: T("Comum.cancelar") }],
    rejectClose: false
  });
  if (!r || typeof r !== "object") return;
  const un = { m: segMinuto(), h: segHora(), d: segDia(), s: segDia() * CFG.semana.length }[r.un] ?? segHora();
  const wt = game.time.worldTime;
  const novo = { id: foundry.utils.randomID(), nome: String(r.nome || T("Contadores.contador")).trim(), inicio: wt, fim: wt + Math.round(num(r.q, 1) * un), visivel: !!r.vis, aviso: r.aviso === "todos" ? "todos" : "mestre", feito: false };
  await alterarContadores((lista) => { lista.push(novo); });
}

/* ---------------- dias sagrados das divindades ---------------- */

/** Divindades do Journal (páginas do tipo "Divindade"). */
function divindades() {
  return game.journal.filter((e) => e.pages?.contents?.some((p) => p.flags?.[JOURNAL]?.tipo === "deus")).sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));
}

async function dialogoDiaSagrado() {
  if (!game.user.isGM) return;
  const deuses = divindades();
  const a = agora();
  const r = await Dialogo().wait({
    window: { title: "CALMESA.Comum.dia_sagrado", icon: "fa-solid fa-hands-praying" },
    position: { width: 460 },
    content: `<div class="cm-form">
      <label>${T("Divindades.divindade")}<select name="deus">
        ${deuses.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join("")}
        <option value="">${T("Divindades.outra_escrever_o_nome")}</option></select></label>
      ${deuses.length ? "" : `<p class="cm-dica">${T("Divindades.nenhuma_divindade_do_journal_da_mesa")}</p>`}
      <label>${T("Divindades.nome_da_divindade_se_for_outra")}<input type="text" name="outra"></label>
      <label>${T("Divindades.nome_do_dia_sagrado")}<input type="text" name="nome" placeholder="${T("Divindades.festival_das_mares")}"></label>
      <div class="cm-form-2">
        <label>${T("Comum.dia_2")}<input type="number" name="dia" min="1" value="${a.dia + 1}"></label>
        <label>${T("Comum.mes")}<select name="mes">${CFG.meses.map((m, i) => `<option value="${i}" ${i === a.mes ? "selected" : ""}>${esc(m.nome)}</option>`).join("")}</select></label>
      </div>
      <div class="cm-form-2">
        <label>${T("Comum.dura_quantos_dias")}<input type="number" name="duracao" min="1" value="1"></label>
        <label>${T("Comum.cor")}<input type="color" name="cor" value="#c9a227"></label>
      </div>
      <label>${T("Divindades.quando_chegar")}<select name="aviso">${opcoes(AVISOS, "todos")}</select></label>
      <p class="cm-dica">${T("Divindades.vira_uma_nota_que_se_repete")}</p>
    </div>`,
    buttons: [{ action: "ok", label: T("Comum.criar"), default: true, callback: (ev, btn) => Object.fromEntries(new FormData(btn.form)) }, { action: "cancelar", label: T("Comum.cancelar") }],
    rejectClose: false
  });
  if (!r || typeof r !== "object") return;
  const deus = r.deus ? game.journal.get(r.deus) : null;
  const nomeDeus = deus?.name ?? (String(r.outra ?? "").trim() || T("Divindades.divindade_2"));
  const nome = String(r.nome ?? "").trim() || `${T("Divindades.dia_sagrado_de_0", [nomeDeus])}`;
  const mes = Math.min(Math.max(0, num(r.mes)), CFG.meses.length - 1);
  const ano = mesExiste(a.ano, mes) ? a.ano : a.ano + 1;
  const td = tdDe(ano, mes, Math.min(Math.max(1, num(r.dia, 1)), Math.max(1, diasNoMes(ano, mes))) - 1);
  const pasta = await pastaParaNota(game.settings.get(MOD, "pastaNotas"), "", td);
  const link = deus ? `@UUID[${deus.uuid}]{${deus.name}}` : esc(nomeDeus);
  const e = await JournalEntry.create({
    name: nome,
    folder: pasta?.id ?? null,
    ownership: { default: 2 },
    flags: { [MOD]: { nota: notaNova(td, { repetir: "anual", cada: 1, icone: "fa-hands-praying", cor: r.cor || "#c9a227", aviso: AVISOS[r.aviso] ? r.aviso : "todos", duracao: Math.max(1, num(r.duracao, 1)), divindade: deus?.uuid ?? nomeDeus }) } },
    pages: [paginaDeEvento(nome, `<p>${T("Divindades.dia_sagrado_de_0_2", [link])}</p>`)]
  });
  if (e) ui.notifications.info(T("Divindades.0_marcado_todo_ano_em_1", [nome, num(r.dia), CFG.meses[mes].nome]));
  return e;
}

export {
  dialogoDiaSagrado,
  JanelaContadores,
  JanelaHistorico
};
