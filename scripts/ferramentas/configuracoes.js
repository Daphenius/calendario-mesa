/* =========================================================
 * Calendário da Mesa — Janelas dos menus
 * Luz por hora e tabelas de encontro da viagem. Carregadas junto com o módulo porque o menu das
 * configurações do Foundry abre a janela pela classe.
 * ========================================================= */

import { textoHora } from "../datas.js";
import { cenasDiaNoite, luzCfg, luzPadrao } from "../luz.js";
import { esc, MOD, num, T, tema } from "../nucleo.js";

const { ApplicationV2 } = foundry.applications.api;

/* ---------------- janela: luz por hora ---------------- */

class JanelaLuz extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "cm-luz",
    classes: ["cm-janela"],
    tag: "div",
    window: { title: "CALMESA.Luz.luz_do_mapa_por_hora", icon: "fa-solid fa-sun", resizable: true },
    position: { width: 620, height: 720 },
    actions: {
      padrao() { this.L.horas = luzPadrao(this.L.horas.length); this.render(); },
      tudo(ev, t) { const v = num(t.dataset.v); this.L.horas = this.L.horas.map(() => v); this.render(); },
      async salvar() {
        await game.settings.set(MOD, "luz", this.L);
        ui.notifications.info(T("Luz.luz_salva_as_cenas_com_dia"));
        this.close();
      }
    }
  };

  constructor(opts = {}) { super(opts); this.L = luzCfg(); }

  async _renderHTML() {
    const L = this.L, H = L.horas.length;   // horas do dia do calendário principal (a luz é do mundo)
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
        <p class="cm-dica" style="margin-top:0">${T("Luz.usa_a_escuridao_nativa_da_cena")} <i class="fa-solid fa-circle-half-stroke"></i> ${T("Luz.no_hud_0", [cenas ? `: <b>${cenas}</b>` : T("Luz.nenhuma_ainda")])}</p>
        <div class="cm-luz-faixa">${faixa}</div>

        <fieldset><legend>${T("Luz.luz_de_cada_hora_0_horas", [H])}</legend>
          <div class="cm-luz-grade">${linhas}</div>
          <div class="cm-ed-rodape">
            <button type="button" data-action="padrao"><i class="fa-solid fa-rotate-left"></i> ${T("Luz.curva_padrao")}</button>
            <button type="button" data-action="tudo" data-v="100"><i class="fa-solid fa-sun"></i> ${T("Luz.tudo_claro")}</button>
            <button type="button" data-action="tudo" data-v="0"><i class="fa-solid fa-moon"></i> ${T("Luz.tudo_escuro")}</button>
          </div>
        </fieldset>

        <fieldset><legend>${T("Luz.noite_e_luas")}</legend>
          <div class="cm-ed-grade cm-g3">
            <label>${T("Luz.luz_da_lua_cheia")}<small>${T("Luz.quanto_a_lua_mais_clara_no")}</small>
              <span class="cm-luz-par"><input type="range" min="0" max="100" step="5" value="${L.luaMax}" data-campo="luaMax"><span class="cm-luz-val" data-v="luaMax">${L.luaMax}%</span></span></label>
            <label>${T("Luz.cor_da_noite")}<small>${T("Luz.sem_lua_colorida_no_ceu_padrao")}</small>
              <input type="color" value="${L.corNoite}" data-campo="corNoite"></label>
            <label>${T("Luz.forca_da_cor")}<small>${T("Luz.quanto_a_noite_fica_tingida")}</small>
              <span class="cm-luz-par"><input type="range" min="0" max="1" step="0.05" value="${L.corIntensidade}" data-campo="corIntensidade"><span class="cm-luz-val" data-v="corIntensidade">${Math.round(L.corIntensidade * 100)}%</span></span></label>
          </div>
          <p class="cm-dica">${T("Luz.uma_lua_com_cor_forte_ex")}</p>
        </fieldset>

        <fieldset><legend>${T("Luz.saltos_de_tempo")}</legend>
          <div class="cm-ed-grade cm-g3">
            <label class="cm-check"><input type="checkbox" data-campo="gradual" ${L.gradual ? "checked" : ""}> ${T("Luz.passar_aos_poucos_ao_pular_horas")}<small>${T("Luz.a_luz_passa_por_cada_hora")}</small></label>
            <label>${T("Luz.duracao_da_passagem")}<small>${T("Luz.segundos_no_total")}</small><input type="number" min="1" max="30" value="${L.transicao}" data-campo="transicao" data-n="1"></label>
          </div>
        </fieldset>

        <footer class="cm-ed-fim">
          <span class="cm-esp"></span>
          <button type="button" class="cm-salvar" data-action="salvar"><i class="fa-solid fa-floppy-disk"></i> ${T("Comum.salvar")}</button>
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

/* ---------------- viagem ---------------- */

/** Tabelas que aparecem na viagem: as escolhidas nas configurações (todas, se nenhuma foi escolhida). */
function tabelasDeEncontro() {
  const todas = game.tables?.contents ?? [];
  const ids = game.settings.get(MOD, "tabelasEncontro")?.ids ?? [];
  const escolhidas = todas.filter((t) => ids.includes(t.id));
  return (escolhidas.length ? escolhidas : todas).sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));
}

/** Configurações → Tabelas de encontro: marcar quais tabelas aparecem na janela de viagem. */
class JanelaTabelas extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "cm-tabelas",
    classes: ["cm-janela"],
    tag: "div",
    window: { title: "CALMESA.Comum.tabelas_de_encontro_da_viagem", icon: "fa-solid fa-table-list", resizable: true },
    position: { width: 460, height: 560 },
    actions: {
      todas() { this.element.querySelectorAll(".cm-tab-item input").forEach((el) => { if (!el.closest(".cm-tab-item").hidden) el.checked = true; }); this.contar(); },
      nenhuma() { this.element.querySelectorAll(".cm-tab-item input").forEach((el) => { el.checked = false; }); this.contar(); },
      async salvar() {
        const ids = [...this.element.querySelectorAll(".cm-tab-item input:checked")].map((el) => el.value);
        await game.settings.set(MOD, "tabelasEncontro", { ids });
        ui.notifications.info(ids.length ? T("Tabelas.0_tabela_s_na_janela_de", [ids.length]) : T("Tabelas.todas_as_tabelas_aparecem_na_janela"));
        this.close();
      },
      cancelar() { this.close(); }
    }
  };

  async _renderHTML() {
    const ids = new Set(game.settings.get(MOD, "tabelasEncontro")?.ids ?? []);
    const tabelas = [...(game.tables?.contents ?? [])].sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));
    const porPasta = new Map();
    for (const t of tabelas) { const k = t.folder?.name ?? T("Tabelas.sem_pasta"); if (!porPasta.has(k)) porPasta.set(k, []); porPasta.get(k).push(t); }
    const grupos = [...porPasta.entries()].sort(([a], [b]) => (a === T("Tabelas.sem_pasta")) - (b === T("Tabelas.sem_pasta")) || a.localeCompare(b, game.i18n.lang)).map(([pasta, ts]) => `
      <div class="cm-tab-grupo"><h4><i class="fa-solid fa-folder"></i> ${esc(pasta)}</h4>
        ${ts.map((t) => `<label class="cm-tab-item"><input type="checkbox" value="${t.id}" ${ids.has(t.id) ? "checked" : ""}> <img src="${esc(t.img || "icons/svg/d20-black.svg")}" alt=""> <span>${esc(t.name)}</span><small>${T("Tabelas.0_resultados", [t.results?.size ?? 0])}</small></label>`).join("")}
      </div>`).join("");
    return `<div class="cm-raiz cm-tabelas-raiz cm-tema-${tema()}">
      <p class="cm-dica">${T("Tabelas.marque_as_tabelas_que_devem_aparecer")}</p>
      <div class="cm-tab-busca"><input type="search" name="busca" placeholder="${T("Tabelas.procurar_tabela")}"><span data-contagem></span></div>
      <div class="cm-tab-lista">${grupos || `<p class="cm-vazio">${T("Tabelas.nenhuma_tabela_no_mundo_crie_em")}</p>`}</div>
      <footer class="cm-tab-rodape">
        <button type="button" data-action="todas">${T("Tabelas.marcar_todas")}</button>
        <button type="button" data-action="nenhuma">${T("Tabelas.desmarcar")}</button>
        <span class="cm-esp"></span>
        <button type="button" data-action="cancelar">${T("Comum.cancelar")}</button>
        <button type="button" class="cm-clima-aplicar" data-action="salvar"><i class="fa-solid fa-floppy-disk"></i> ${T("Comum.salvar")}</button>
      </footer>
    </div>`;
  }

  contar() {
    const el = this.element.querySelector("[data-contagem]");
    const n = this.element.querySelectorAll(".cm-tab-item input:checked").length;
    if (el) el.textContent = n ? T("Tabelas.0_marcada_s", [n]) : T("Tabelas.nenhuma_marcada_todas_aparecem");
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

export {
  JanelaLuz,
  JanelaTabelas,
  tabelasDeEncontro
};
