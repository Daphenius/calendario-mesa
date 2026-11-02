/* =========================================================
 * Calendário da Mesa — Editor do calendário
 * Janela de edição de meses, semana, anos, eras, estações e luas, com importação e vários calendários.
 * ========================================================= */

import { agora, diasNoMes, infoDia, tdDe, textoData, textoRelogio } from "../datas.js";
import { converterCalendario, datasDasNotas, fontesDoMundo, FORMATOS, presetGregoriano, reposicionarNotas } from "./importar.js";
import { rerenderJanelas } from "../janela.js";
import { FASES_PADRAO, luaSVG, textoFalta, UNIDADES, visibilidadeLua } from "../luas.js";
import { segundosDaHora } from "../notas.js";
import { aplicarCalendario, CACHE_CAL, CAL_ID, calDaNota, CFG, comConfig, Dialogo, esc, fimDaEstacao, listaCalendarios, mod, MOD, normalizar, num, PRESET_ELEMENTOS, segDia, segMinuto, segundoDoDia, T, tema } from "../nucleo.js";

const { ApplicationV2 } = foundry.applications.api;

/* ---------------- editor do calendário ---------------- */

/** Valor de um campo do editor já no tipo certo. */
function valorDoCampo(el, dados) {
  if (el.type === "checkbox") return el.checked;
  if (el.dataset.desloca) return num(el.value) - num(dados.anoInicial);   // ano exibido → ano interno
  if (el.dataset.n) return num(el.value);
  return el.value;
}

/** Lembra qual campo estava com o cursor (e a seleção) antes de redesenhar uma janela. */
function lerFoco(raiz) {
  const el = document.activeElement;
  if (!el || !raiz.contains(el)) return null;
  let sel = null;
  if (el.dataset?.caminho) sel = `[data-caminho="${CSS.escape(el.dataset.caminho)}"]`;
  else if (el.dataset?.action) sel = `[data-action="${CSS.escape(el.dataset.action)}"]${el.dataset.i != null ? `[data-i="${CSS.escape(el.dataset.i)}"]` : ""}${el.dataset.lista ? `[data-lista="${CSS.escape(el.dataset.lista)}"]` : ""}`;
  else if (el.classList.length) sel = `.${[...el.classList].map((c) => CSS.escape(c)).join(".")}`;
  if (!sel) return null;
  let ini = null, fim = null;
  try { ini = el.selectionStart; fim = el.selectionEnd; } catch { /* selects e números não têm seleção */ }
  return { sel, ini, fim };
}

function voltarFoco(raiz, foco) {
  if (!foco) return;
  const el = raiz.querySelector(foco.sel);
  if (!el) return;
  el.focus({ preventScroll: true });
  try { if (foco.ini != null && el.setSelectionRange) el.setSelectionRange(foco.ini, foco.fim); } catch { /* sem seleção */ }
}

class EditorCalendario extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "cm-editor",
    classes: ["cm-janela"],
    tag: "div",
    window: { title: "CALMESA.Editor.editar_calendario", icon: "fa-solid fa-gear", resizable: true },
    position: { width: 760, height: 720 },
    actions: {
      add(ev, t) { (this.dados[t.dataset.lista] ??= []).push(this.novo(t.dataset.lista)); this.render(); },
      rem(ev, t) { const l = this.dados[t.dataset.lista]; if (l.length > 1 || ["estacoes", "luas", "eras"].includes(t.dataset.lista)) l.splice(num(t.dataset.i), 1); this.render(); },
      async irData() { await this.irParaData(); },
      hojeData() { this.render(); },
      subir(ev, t) { const l = this.dados[t.dataset.lista], i = num(t.dataset.i); if (i > 0) [l[i - 1], l[i]] = [l[i], l[i - 1]]; this.render(); },
      preset(ev, t) { this.dados = normalizar(t.dataset.p === "gregoriano" ? presetGregoriano() : PRESET_ELEMENTOS); this.render(); },
      exportar() {
        foundry.utils.saveDataToFile(JSON.stringify(this.dados, null, 2), "application/json", `calendario-${this.dados.nome.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`);
      },
      importar() { this.element.querySelector("input.cm-arquivo")?.click(); },
      salvar() { this.salvar(); },
      apHoje(ev, t) {
        const l = this.dados.luas[num(t.dataset.i)];
        if (!l) return;
        // usa a configuração em edição para contar meses/anos
        const anoInicial = num(this.dados.anoInicial, 0), nMeses = this.dados.meses.length;
        const i = infoDia(agora().td);
        l.aparicao.inicio = l.aparicao.unidade === "anos" ? i.ano + anoInicial : l.aparicao.unidade === "meses" ? (i.ano + anoInicial) * nMeses + i.mes : i.td;
        if (!l.aparicao.cada) l.aparicao.cada = 1;
        this.render();
      },
      importarMundo() { this.importarDoMundo(); },
      mesHoje(ev, t) {
        const m = this.dados.meses[num(t.dataset.i)];
        if (!m) return;
        m.aparicao.inicio = agora().ano + num(this.dados.anoInicial, 0);
        if (!m.aparicao.cada) m.aparicao.cada = 2;
        this.render();
      },
      addFase(ev, t) { const l = this.dados.luas[num(t.dataset.i)]; l.fases.push({ nome: T("Editor.nova_fase"), peso: 1 }); this.fasesAbertas.add(num(t.dataset.i)); this.render(); },
      remFase(ev, t) { const l = this.dados.luas[num(t.dataset.i)]; if (l.fases.length > 1) l.fases.splice(num(t.dataset.k), 1); this.render(); },
      fasesPadrao(ev, t) { this.dados.luas[num(t.dataset.i)].fases = foundry.utils.deepClone(FASES_PADRAO); this.render(); },
      novoCal() { this.calId = foundry.utils.randomID(); this.dados = normalizar({ ...PRESET_ELEMENTOS, nome: T("Editor.nova_civilizacao"), luas: PRESET_ELEMENTOS.luas.slice(0, 1) }); this.render(); },
      duplicarCal() { this.calId = foundry.utils.randomID(); this.dados = normalizar({ ...foundry.utils.deepClone(this.dados), nome: `${T("Comum.0_copia", [this.dados.nome])}` }); this.render(); },
      async apagarCal() {
        const { principal, lista } = listaCalendarios();
        if (!lista[this.calId]) { this.calId = principal; this.dados = normalizar(lista[principal]); return this.render(); }
        if (Object.keys(lista).length < 2) return ui.notifications.warn(T("Editor.o_mundo_precisa_de_pelo_menos"));
        const ok = await Dialogo().confirm({
          window: { title: "CALMESA.Editor.apagar_calendario", icon: "fa-solid fa-trash" },
          content: `<p>${T("Editor.apagar_o_calendario")} <b>${esc(this.dados.nome)}</b>?</p><p class="cm-dica">${T("Editor.as_notas_dele_nao_sao_apagadas")}</p>`
        });
        if (!ok) return;
        const nova = { ...lista }; delete nova[this.calId];
        const novoPrincipal = this.calId === principal ? Object.keys(nova)[0] : principal;
        await game.settings.set(MOD, "calendarios", { principal: novoPrincipal, lista: nova });
        if (this.calId === principal) await game.settings.set(MOD, "config", nova[novoPrincipal]);
        this.calId = novoPrincipal; this.dados = normalizar(nova[novoPrincipal]);
        this.render();
      },
      async principalCal() {
        const { lista } = listaCalendarios();
        if (!lista[this.calId]) return ui.notifications.warn(T("Editor.salve_o_calendario_antes_de_torna"));
        await game.settings.set(MOD, "calendarios", { principal: this.calId, lista });
        await game.settings.set(MOD, "config", lista[this.calId]);
        ui.notifications.info(`${T("Editor.0_agora_e_o_calendario_principal", [this.dados.nome])}`);
        this.render();
      }
    }
  };

  constructor(opts = {}) {
    super(opts);
    const { principal, lista } = listaCalendarios();
    this.calId = lista[CAL_ID] ? CAL_ID : principal;
    this.dados = normalizar(lista[this.calId]);
    this.fasesAbertas = new Set();
  }

  /** Item novo já completo (com todos os campos que a janela desenha). */
  novo(lista) {
    const base = normalizar({ ...this.dados, eras: [], estacoes: [], luas: [] });
    switch (lista) {
      case "semana": return normalizar({ semana: [{ nome: T("Editor.novo_dia"), abrev: T("Editor.nov") }] }).semana[0];
      case "meses": return normalizar({ meses: [{ nome: `${T("Comum.mes_0", [this.dados.meses.length + 1])}`, abrev: `M${this.dados.meses.length + 1}`, dias: 30 }] }).meses[0];
      case "estacoes": return normalizar({ ...base, estacoes: [{ nome: T("Editor.nova_estacao"), mesInicio: 1, diaInicio: 1, nascer: 6, por: 18, icone: "fa-cloud-sun" }] }).estacoes[0];
      case "luas": return normalizar({ luas: [{ nome: T("Editor.nova_lua"), ciclo: 28, deslocamento: 0, cor: "#e8e4d8" }] }).luas[0];
      case "eras": {
        const ult = this.dados.eras?.at(-1);
        const inicio = ult ? (ult.fim != null && ult.fim !== "" ? num(ult.fim) + 1 : agora().ano + num(this.dados.anoInicial, 0)) : num(this.dados.anoInicial, 0);
        return { nome: T("Editor.nova_era"), sufixo: "", inicio, fim: null, contagem: "absoluta" };
      }
    }
  }

  /** Muda a data do jogo usando este calendário (mesmo que ele não seja o que está em uso). */
  async irParaData() {
    if (!game.user.isGM) return;
    const el = this.element;
    const dia = num(el.querySelector(".cm-ir-dia")?.value, 1), mes = num(el.querySelector(".cm-ir-mes")?.value, 0);
    const anoExibido = num(el.querySelector(".cm-ir-ano")?.value, 0);
    const hora = String(el.querySelector(".cm-ir-hora")?.value ?? "").trim();
    const cfg = normalizar(this.dados);
    const r = comConfig(cfg, this.calId, () => {
      const ano = anoExibido - CFG.anoInicial;
      const max = diasNoMes(ano, mes);
      if (!max) return { erro: `${T("Editor.0_nao_existe_no_ano_1", [CFG.meses[mes]?.nome ?? T("Editor.esse_mes"), anoExibido])}` };
      const m = hora.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
      const seg = m ? segundosDaHora(`${m[1]}:${m[2]}`) + Math.min(num(m[3], 0), segMinuto() - 1) : segundoDoDia(game.time.worldTime);
      const td = tdDe(ano, mes, Math.min(Math.max(1, dia), max) - 1);
      return { t: td * segDia() + seg, texto: textoData(infoDia(td)) };
    });
    if (r.erro) return ui.notifications.warn(r.erro);
    await game.time.set(r.t);
    ui.notifications.info(`${T("Editor.data_do_jogo_0", [r.texto])}`);
    this.render();
  }

  async _renderHTML() {
    const c = this.dados;
    const campo = (caminho, valor, tipo = "text", extra = "") =>
      `<input type="${tipo}" data-caminho="${caminho}" ${tipo === "number" ? `data-n="1"` : ""} value="${esc(valor)}" ${extra}>`;
    const linhaBtns = (lista, i) => `
      <span class="cm-linha-btns">
        ${i > 0 ? `<a data-action="subir" data-lista="${lista}" data-i="${i}" data-tooltip="${T("Editor.subir")}"><i class="fa-solid fa-arrow-up"></i></a>` : `<span></span>`}
        <a data-action="rem" data-lista="${lista}" data-i="${i}" data-tooltip="${T("Editor.remover")}"><i class="fa-solid fa-trash"></i></a>
      </span>`;
    const icones = { "fa-seedling": T("Editor.broto"), "fa-sun": T("Comum.sol"), "fa-leaf": T("Editor.folha"), "fa-snowflake": T("Comum.neve"), "fa-cloud-sun": T("Editor.nuvem_e_sol"), "fa-cloud-rain": T("Comum.chuva"), "fa-fire": T("Comum.fogo"), "fa-droplet": T("Comum.agua"), "fa-wind": T("Comum.vento"), "fa-mountain": T("Comum.montanha"), "fa-star": T("Comum.estrela"), "fa-moon": T("Comum.lua") };
    const diasAno = c.meses.reduce((s, m) => s + num(m.dias), 0);
    const bis = !!c.bissexto?.ativo;
    const diasBis = c.meses.reduce((s, m) => s + num(m.diasBissexto ?? m.dias), 0);
    const cn = normalizar(c);   // cópia limpa para os cálculos (fim das estações, eras)
    const erasSobrepostas = cn.eras.some((e, i) => cn.eras.some((o, k) => k !== i && e.inicio <= (o.fim ?? Infinity) && o.inicio <= (e.fim ?? Infinity)));

    return `
      <div class="cm-raiz cm-editor cm-tema-${tema()}">
        ${(() => {
          const { principal, lista } = listaCalendarios();
          const ids = Object.keys(lista);
          const novo = !lista[this.calId];
          this._fontes = fontesDoMundo();
          return `<div class="cm-ed-cals">
            <div class="cm-ed-cals-linha">
              <i class="fa-solid fa-landmark"></i> ${T("Editor.calendario")}
              <select class="cm-ed-qual" data-tooltip="${T("Editor.escolha_um_calendario_seu_para_editar")}">
                <optgroup label="${T("Editor.seus_calendarios")}">
                  ${ids.map((id) => `<option value="${id}" ${id === this.calId ? "selected" : ""}>${esc(normalizar(lista[id]).nome)}${id === principal ? T("Editor.principal") : ""}</option>`).join("")}
                  ${novo ? `<option value="${this.calId}" selected>${T("Editor.0_novo_nao_salvo", [esc(c.nome)])}</option>` : ""}
                </optgroup>
                <optgroup label="${T("Editor.novo_a_partir_de_um_modelo")}">
                  <option value="modelo:elementos">${T("Editor.exemplo_dos_elementos")}</option>
                  <option value="modelo:gregoriano">${T("Comum.gregoriano")}</option>
                </optgroup>
                ${this._fontes.length ? `<optgroup label="${T("Editor.importar_do_mundo_foundry_sistema_e")}">
                  ${this._fontes.map((f, i) => `<option value="mundo:${i}">${esc(f.rotulo)}</option>`).join("")}
                </optgroup>` : ""}
              </select>
              <button type="button" data-action="novoCal" data-tooltip="${T("Editor.outra_civilizacao_com_meses_e_eventos")}"><i class="fa-solid fa-plus"></i> ${T("Editor.novo")}</button>
              <button type="button" data-action="duplicarCal"><i class="fa-solid fa-copy"></i> ${T("Comum.duplicar")}</button>
              ${!novo && this.calId !== principal ? `<button type="button" data-action="principalCal" data-tooltip="${T("Editor.calendario_usado_quando_a_cena_nao")}"><i class="fa-solid fa-star"></i> ${T("Editor.tornar_principal")}</button>` : ""}
              ${ids.length > 1 || novo ? `<button type="button" data-action="apagarCal"><i class="fa-solid fa-trash"></i> ${novo ? T("Comum.descartar") : T("Comum.apagar")}</button>` : ""}
            </div>
            <div class="cm-ed-cals-linha">
              <button type="button" data-action="importar" data-tooltip="${T("Editor.json_do_calendario_da_mesa_simple")}"><i class="fa-solid fa-file-import"></i> ${T("Editor.importar_arquivo")}</button>
              <button type="button" data-action="exportar" data-tooltip="${T("Editor.salvar_este_calendario_num_arquivo_json")}"><i class="fa-solid fa-file-export"></i> ${T("Editor.exportar")}</button>
              <span class="cm-dica">${T("Editor.modelos_e_importacoes_abrem_como_um")}</span>
              <input type="file" class="cm-arquivo" accept=".json,application/json" hidden>
            </div>
          </div>`;
        })()}

        <fieldset><legend>${T("Comum.geral")}</legend>
          <div class="cm-ed-grade cm-g4">
            <label>${T("Editor.nome_do_calendario_0", [campo("nome", c.nome)])}</label>
            <label>${T("Editor.horas_por_dia_0", [campo("horasDia", c.horasDia, "number", `min="1"`)])}</label>
            <label>${T("Editor.minutos_por_hora_0", [campo("minutosHora", c.minutosHora, "number", `min="1"`)])}</label>
            <label>${T("Editor.segundos_por_minuto_0", [campo("segundosMinuto", c.segundosMinuto, "number", `min="1"`)])}</label>
          </div>
        </fieldset>

        <fieldset><legend>${T("Editor.anos_e_eras")}</legend>
          <div class="cm-ed-grade cm-g3">
            <label>${T("Editor.primeiro_ano")}<small>${T("Editor.ano_mostrado_no_tempo_0_do")}</small>${campo("anoInicial", c.anoInicial, "number")}</label>
            <label>${T("Editor.sufixo_padrao")}<small>${T("Editor.anos_fora_de_qualquer_era_ex")}</small>${campo("era", c.era)}</label>
            <label class="cm-check"><input type="checkbox" data-caminho="bissexto.ativo" ${bis ? "checked" : ""}> ${T("Editor.ano_bissexto")}<small>${bis ? T("Editor.0_dias_no_ano_bissexto", [diasBis]) : T("Editor.desligado_todo_ano_tem_0_dias", [diasAno])}</small></label>
          </div>
          ${bis ? `<div class="cm-ed-rodape"><label class="cm-inline">${T("Editor.bissexto_a_cada_0_anos_comecando", [campo("bissexto.cada", c.bissexto.cada, "number", `min="1"`), campo("bissexto.inicio", num(c.bissexto.inicio) + num(c.anoInicial), "number", `data-desloca="1"`)])}</label>
            <span class="cm-dica">${T("Editor.os_dias_a_mais_de_cada")}</span></div>` : ""}

          <h4 class="cm-ed-sub"><i class="fa-solid fa-landmark"></i> ${T("Editor.eras")}</h4>
          <div class="cm-ed-lista">
            ${c.eras?.length ? `<div class="cm-ed-cab cm-c-era"><span>${T("Editor.nome_da_era")}</span><span>${T("Editor.sufixo")}</span><span>${T("Editor.ano_inicial")}</span><span>${T("Editor.ano_final")}</span><span>${T("Editor.contagem_dos_anos")}</span><span></span></div>` : ""}
            ${(c.eras ?? []).map((e, i) => `<div class="cm-ed-item cm-c-era">${campo(`eras.${i}.nome`, e.nome)}${campo(`eras.${i}.sufixo`, e.sufixo, "text", `placeholder="ex.: D.R."`)}
              ${campo(`eras.${i}.inicio`, e.inicio, "number")}
              <input type="number" data-caminho="eras.${i}.fim" value="${e.fim ?? ""}" placeholder="${T("Editor.sem_fim")}">
              <select data-caminho="eras.${i}.contagem"><option value="absoluta" ${e.contagem !== "relativa" ? "selected" : ""}>${T("Editor.ano_do_mundo_0", [num(e.inicio)])}</option><option value="relativa" ${e.contagem === "relativa" ? "selected" : ""}>${T("Editor.desde_o_inicio_da_era_ano")}</option></select>
              ${linhaBtns("eras", i)}</div>`).join("") || `<p class="cm-vazio">${T("Editor.sem_eras_todos_os_anos_usam")}</p>`}
            ${erasSobrepostas ? `<p class="cm-aviso"><i class="fa-solid fa-triangle-exclamation"></i> ${T("Editor.ha_eras_com_anos_em_comum")}</p>` : ""}
          </div>
          <div class="cm-ed-rodape"><button type="button" data-action="add" data-lista="eras"><i class="fa-solid fa-plus"></i> ${T("Editor.era")}</button>
            <span class="cm-dica">${T("Editor.ex_era_do_fogo_sufixo_e")}</span></div>

          ${game.user.isGM ? (() => {
            const cfgEd = normalizar(c);
            const hoje = comConfig(cfgEd, this.calId, () => { const a = agora(); return { dia: a.dia, mes: a.mes, ano: a.ano + CFG.anoInicial, texto: textoData(a), hora: textoRelogio(segundoDoDia(a.wt)).slice(0, 5) }; });
            return `<h4 class="cm-ed-sub"><i class="fa-solid fa-calendar-check"></i> ${T("Editor.data_atual_do_jogo")}</h4>
            <p class="cm-dica" style="margin-top:0">${T("Editor.hoje_neste_calendario")} <b>${esc(hoje.texto)}</b>, ${hoje.hora}.</p>
            <div class="cm-ed-rodape cm-ir">
              ${T("Comum.dia_2")} <input type="number" class="cm-ir-dia cm-curto" min="1" value="${hoje.dia + 1}">
              ${T("Editor.de")} <select class="cm-ir-mes">${cfgEd.meses.map((m, k) => `<option value="${k}" ${k === hoje.mes ? "selected" : ""}>${esc(m.nome)}</option>`).join("")}</select>
              ${T("Editor.de")} <input type="number" class="cm-ir-ano cm-medio" value="${hoje.ano}">
              ${T("Editor.as")} <input type="text" class="cm-ir-hora cm-curto" value="${hoje.hora}" placeholder="${T("Comum.hh_mm")}">
              <button type="button" data-action="irData"><i class="fa-solid fa-calendar-check"></i> ${T("Editor.ir_para_esta_data")}</button>
            </div>
            <p class="cm-dica">${T("Editor.muda_o_tempo_do_mundo_para")}</p>`;
          })() : ""}
        </fieldset>

        <fieldset><legend>${T("Editor.dias_da_semana")}</legend>
          <div class="cm-ed-lista">
            <div class="cm-ed-cab cm-c-sem"><span>${T("Comum.nome")}</span><span>${T("Editor.abrev")}</span><span></span></div>
            ${c.semana.map((d, i) => `<div class="cm-ed-item cm-c-sem">${campo(`semana.${i}.nome`, d.nome)}${campo(`semana.${i}.abrev`, d.abrev)}${linhaBtns("semana", i)}</div>`).join("")}
          </div>
          <div class="cm-ed-rodape">
            <button type="button" data-action="add" data-lista="semana"><i class="fa-solid fa-plus"></i> ${T("Comum.dia_2")}</button>
            <label class="cm-inline">${T("Editor.o_tempo_0_cai_em")}
              <select data-caminho="primeiroDiaSemana" data-n="1">${c.semana.map((d, i) => `<option value="${i}" ${i === c.primeiroDiaSemana ? "selected" : ""}>${esc(d.nome)}</option>`).join("")}</select>
            </label>
          </div>
        </fieldset>

        <fieldset><legend>${T("Comum.meses_2")} <small>${T("Editor.0_meses_1_dias_no_ano", [c.meses.length, diasAno, bis ? ` ${T("Editor.0_no_bissexto", [diasBis])}` : ""])}</small></legend>
          <div class="cm-ed-lista">
            <div class="cm-ed-cab ${bis ? "cm-c-mes" : "cm-c-mes1"}"><span>${T("Comum.nome")}</span><span>${T("Editor.abrev")}</span><span>${T("Comum.dias_2")}</span>${bis ? `<span>${T("Editor.dias_no_bissexto")}</span>` : ""}<span></span></div>
            ${c.meses.map((m, i) => `<div class="cm-ed-lua">
              <div class="cm-ed-item ${bis ? "cm-c-mes" : "cm-c-mes1"}">${campo(`meses.${i}.nome`, m.nome)}${campo(`meses.${i}.abrev`, m.abrev)}${campo(`meses.${i}.dias`, m.dias, "number", `min="1"`)}${bis ? campo(`meses.${i}.diasBissexto`, m.diasBissexto ?? m.dias, "number", `min="1"`) : ""}${linhaBtns("meses", i)}</div>
              <div class="cm-ed-ap">
                <i class="fa-solid fa-eye"></i> ${T("Editor.aparece_a_cada_0_anos_e", [campo(`meses.${i}.aparicao.cada`, m.aparicao.cada, "number", `min="0"`), campo(`meses.${i}.aparicao.duracao`, m.aparicao.duracao, "number", `min="1"`), campo(`meses.${i}.aparicao.inicio`, m.aparicao.inicio, "number")])}
                <a data-action="mesHoje" data-i="${i}" data-tooltip="${T("Editor.comecar_o_ciclo_neste_ano_o")}"><i class="fa-solid fa-location-crosshairs"></i></a>
                <span class="cm-ap-estado">${(() => {
                  const a = m.aparicao ?? {};
                  if (!(a.cada > 0) || a.duracao >= a.cada) return T("Editor.existe_todo_ano");
                  const ano = agora().ano + num(c.anoInicial, 0);
                  const pos = mod(ano - a.inicio, a.cada);
                  return pos < a.duracao ? `${T("Editor.existe_em_0", [ano])}${a.duracao - pos > 1 ? ` ${T("Editor.ate_0", [ano + a.duracao - pos - 1])}` : ""}` : T("Editor.volta_em_0", [ano + a.cada - pos]);
                })()}</span>
              </div>
            </div>`).join("")}
          </div>
          <div class="cm-ed-rodape">
            <button type="button" data-action="add" data-lista="meses"><i class="fa-solid fa-plus"></i> ${T("Comum.mes")}</button>
            <span class="cm-dica">${T("Editor.meses_aparece_a_cada_0_existe")}</span>
          </div>
        </fieldset>

        <fieldset><legend>${T("Editor.estacoes")} <small>${T("Editor.nascer_e_por_do_sol_em")}</small></legend>
          <div class="cm-ed-lista">
            <div class="cm-ed-cab cm-c-est"><span>${T("Comum.nome")}</span><span>${T("Editor.comeca_no_dia")}</span><span>${T("Editor.do_mes")}</span><span>${T("Editor.termina")}</span><span>${T("Editor.nascer")}</span><span>${T("Editor.por")}</span><span>${T("Comum.icone")}</span><span></span></div>
            ${c.estacoes.map((e, i) => `<div class="cm-ed-item cm-c-est">${campo(`estacoes.${i}.nome`, e.nome)}
              ${campo(`estacoes.${i}.diaInicio`, e.diaInicio ?? 1, "number", `min="1" max="${c.meses[(num(e.mesInicio, 1) || 1) - 1]?.dias ?? 31}"`)}
              <select data-caminho="estacoes.${i}.mesInicio" data-n="1">${c.meses.map((m, k) => `<option value="${k + 1}" ${k + 1 === num(e.mesInicio) ? "selected" : ""}>${esc(m.nome)}</option>`).join("")}</select>
              <span class="cm-est-fim" data-tooltip="${T("Editor.o_dia_antes_de_a_proxima")}">${(() => { const f = fimDaEstacao(cn, i); return f && cn.estacoes.length > 1 ? T("Comum.0_de_1", [f.dia, esc(cn.meses[f.mes - 1]?.nome ?? "")]) : T("Editor.o_ano_todo"); })()}</span>
              ${campo(`estacoes.${i}.nascer`, e.nascer, "number", `step="0.25" min="0"`)}${campo(`estacoes.${i}.por`, e.por, "number", `step="0.25" min="0"`)}
              <select data-caminho="estacoes.${i}.icone">${Object.entries(icones).map(([k, v]) => `<option value="${k}" ${k === e.icone ? "selected" : ""}>${v}</option>`).join("")}</select>
              ${linhaBtns("estacoes", i)}</div>`).join("") || `<p class="cm-vazio">${T("Editor.sem_estacoes")}</p>`}
          </div>
          <div class="cm-ed-rodape"><button type="button" data-action="add" data-lista="estacoes"><i class="fa-solid fa-plus"></i> ${T("Comum.estacao")}</button>
            <span class="cm-dica">${T("Editor.cada_estacao_vai_do_dia_em")}</span></div>
        </fieldset>

        <fieldset><legend>${T("Editor.luas")}</legend>
          <div class="cm-ed-lista">
            <div class="cm-ed-cab cm-c-lua"><span>${T("Comum.nome")}</span><span>${T("Editor.ciclo_dias")}</span><span>${T("Editor.deslocamento")}</span><span>${T("Comum.cor")}</span><span></span></div>
            ${c.luas.map((l, i) => `<div class="cm-ed-lua">
              <div class="cm-ed-item cm-c-lua">${campo(`luas.${i}.nome`, l.nome)}${campo(`luas.${i}.ciclo`, l.ciclo, "number", `step="0.01" min="1"`)}${campo(`luas.${i}.deslocamento`, l.deslocamento, "number", `step="0.5"`)}${campo(`luas.${i}.cor`, l.cor, "color")}${linhaBtns("luas", i)}</div>
              <div class="cm-ed-ap">
                <i class="fa-solid fa-eye"></i> ${T("Editor.aparece_a_cada_0", [campo(`luas.${i}.aparicao.cada`, l.aparicao.cada, "number", `min="0"`)])}
                <select data-caminho="luas.${i}.aparicao.unidade">${Object.keys(UNIDADES).map((u) => `<option value="${u}" ${u === l.aparicao.unidade ? "selected" : ""}>${u}</option>`).join("")}</select>
                ${T("Editor.e_fica_0", [campo(`luas.${i}.aparicao.duracao`, l.aparicao.duracao, "number", `min="1"`)])}
                <select data-caminho="luas.${i}.aparicao.unidadeDuracao">${Object.keys(UNIDADES).map((u) => `<option value="${u}" ${u === l.aparicao.unidadeDuracao ? "selected" : ""}>${u}</option>`).join("")}</select>
                ${T("Editor.no_ceu_a_partir_de_0", [campo(`luas.${i}.aparicao.inicio`, l.aparicao.inicio, "number")])}
                <a data-action="apHoje" data-i="${i}" data-tooltip="${T("Editor.comecar_o_ciclo_hoje_a_lua")}"><i class="fa-solid fa-location-crosshairs"></i></a>
                ${l.aparicao.cada > 0 ? `<span class="cm-ap-estado">${(() => { const v = visibilidadeLua(l, agora().td); return v.visivel ? `${T("Editor.no_ceu_agora_some_em_0", [textoFalta(v)])}` : T("Editor.volta_em_0", [textoFalta(v)]); })()}</span>` : `<span class="cm-ap-estado">${T("Editor.sempre_visivel")}</span>`}
              </div>
              <details class="cm-ed-fases" data-lua="${i}" ${this.fasesAbertas.has(i) ? "open" : ""}>
                <summary><i class="fa-solid fa-moon"></i> ${T("Editor.fases_0_1", [l.fases.length, esc(l.fases.map((f) => f.nome).join(" · "))])}</summary>
                <div class="cm-ed-cab cm-c-fase"><span></span><span>${T("Editor.nome_da_fase")}</span><span>${T("Editor.duracao_relativa")}</span><span>${T("Comum.no_ceu")}</span><span></span></div>
                ${l.fases.map((f, k) => {
                  const tot = l.fases.reduce((s, x) => s + x.peso, 0);
                  const centro = (l.fases.slice(0, k).reduce((s, x) => s + x.peso, 0) + f.peso / 2) / tot - l.fases[0].peso / tot / 2;
                  const dias = (l.ciclo * f.peso) / tot;
                  return `<div class="cm-ed-item cm-c-fase">${luaSVG(mod(centro, 1), l.cor, 18)}${campo(`luas.${i}.fases.${k}.nome`, f.nome)}${campo(`luas.${i}.fases.${k}.peso`, f.peso, "number", `step="0.5" min="0.1"`)}
                    <span class="cm-fase-dias" data-tooltip="${T("Editor.quanto_tempo_esta_fase_fica_no", [l.ciclo])}">≈ ${dias.toLocaleString(game.i18n.lang, { maximumFractionDigits: 1 })} ${Math.abs(dias - 1) < 0.05 ? T("Comum.dia") : T("Comum.dias")}</span>
                    <span class="cm-linha-btns"><a data-action="remFase" data-i="${i}" data-k="${k}" data-tooltip="${T("Editor.remover_fase")}"><i class="fa-solid fa-trash"></i></a></span></div>`;
                }).join("")}
                <div class="cm-ed-rodape">
                  <button type="button" data-action="addFase" data-i="${i}"><i class="fa-solid fa-plus"></i> ${T("Editor.fase")}</button>
                  <button type="button" data-action="fasesPadrao" data-i="${i}"><i class="fa-solid fa-rotate-left"></i> ${T("Editor.8_fases_padrao")}</button>
                  <span class="cm-dica">${T("Editor.a_1_fase_e_a_lua")}</span>
                </div>
              </details>
            </div>`).join("") || `<p class="cm-vazio">${T("Editor.sem_luas")}</p>`}
          </div>
          <div class="cm-ed-rodape"><button type="button" data-action="add" data-lista="luas"><i class="fa-solid fa-plus"></i> ${T("Comum.lua")}</button>
            <span class="cm-dica">${T("Editor.deslocamento_em_que_dia_do_mundo")}</span></div>
        </fieldset>

        <footer class="cm-ed-fim">
          <p class="cm-dica"><i class="fa-solid fa-circle-info"></i> ${T("Editor.o_tempo_do_mundo_e_guardado")}</p>
          <button type="button" class="cm-salvar" data-action="salvar"><i class="fa-solid fa-floppy-disk"></i> ${T("Editor.salvar_calendario")}</button>
        </footer>
      </div>`;
  }

  _replaceHTML(html, content) {
    const rolagem = content.querySelector(".cm-editor")?.scrollTop ?? 0;
    const foco = lerFoco(content);
    content.innerHTML = html;
    const ed = content.querySelector(".cm-editor");
    if (ed) ed.scrollTop = rolagem;
    voltarFoco(content, foco);
    content.addEventListener("toggle", this._aoAbrir ??= (ev) => {
      const d = ev.target;
      if (!d.classList?.contains("cm-ed-fases")) return;
      const i = num(d.dataset.lua);
      if (d.open) this.fasesAbertas.add(i); else this.fasesAbertas.delete(i);
    }, true);
    content.addEventListener("change", this._aoMudar ??= (ev) => {
      const el = ev.target;
      if (el.classList.contains("cm-arquivo")) return this.importarArquivo(el.files?.[0]);
      if (el.classList.contains("cm-ed-qual")) {
        const v = el.value;
        this.fasesAbertas.clear();
        if (v.startsWith("modelo:")) {
          this.calId = foundry.utils.randomID();
          this.dados = normalizar(v === "modelo:gregoriano" ? presetGregoriano() : PRESET_ELEMENTOS);
          return this.render();
        }
        if (v.startsWith("mundo:")) {
          const f = this._fontes?.[num(v.slice(6), -1)];
          if (!f) return this.render();
          this.calId = foundry.utils.randomID();
          return this.carregar(foundry.utils.deepClone(f.dados));
        }
        const { lista } = listaCalendarios();
        if (!lista[v]) return;
        this.calId = v; this.dados = normalizar(lista[v]);
        return this.render();
      }
      const caminho = el.dataset.caminho;
      if (!caminho) return;
      foundry.utils.setProperty(this.dados, caminho, valorDoCampo(el, this.dados));
      const redesenhar = /^(meses|semana|estacoes|eras)\./.test(caminho) || /\.(aparicao|fases)\./.test(caminho) || /^luas\.\d+\.(cor|ciclo)$/.test(caminho)
        || ["primeiroDiaSemana", "anoInicial", "era", "bissexto.ativo", "bissexto.cada", "bissexto.inicio"].includes(caminho);
      // espera o Tab terminar de mudar o foco antes de redesenhar, para o cursor ir para o próximo campo
      if (redesenhar) setTimeout(() => this.render(), 0);
    });
  }

  async importarArquivo(arq) {
    if (!arq) return;
    let obj;
    try { obj = JSON.parse(await arq.text()); }
    catch { return ui.notifications.error(T("Editor.esse_arquivo_nao_e_um_json")); }
    this.calId = foundry.utils.randomID();
    this.carregar(obj);
  }

  carregar(obj) {
    try {
      const r = converterCalendario(obj);
      this.dados = r.dados;
      this.render();
      const extra = r.avisos.length ? `<ul>${r.avisos.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>` : "";
      Dialogo().prompt({
        window: { title: "CALMESA.Comum.calendario_importado", icon: "fa-solid fa-file-import" },
        content: `<p>${T("Editor.formato")} <b>${esc(FORMATOS[r.formato])}</b></p><p><b>${esc(r.dados.nome)}</b>${T("Editor.0_meses_semana_de_1_dias", [r.dados.meses.length, r.dados.semana.length, r.dados.estacoes.length, r.dados.luas.length])}</p>${extra}<p class="cm-dica">${T("Editor.nada_foi_salvo_ainda_revise_no")}</p>`,
        rejectClose: false
      });
    } catch (err) {
      console.error(`${MOD} | importação`, err);
      ui.notifications.error(T("Editor.nao_consegui_importar_0", [err.message]));
    }
  }

  async importarDoMundo() {
    const fontes = fontesDoMundo();
    if (!fontes.length) return ui.notifications.warn(T("Editor.nao_achei_outro_calendario_neste_mundo"));
    const escolha = await Dialogo().wait({
      window: { title: "CALMESA.Editor.importar_do_mundo", icon: "fa-solid fa-globe" },
      content: `<div class="cm-form"><label>${T("Comum.calendario")}<select name="fonte">${fontes.map((f, i) => `<option value="${i}">${esc(f.rotulo)}</option>`).join("")}</select></label></div>`,
      buttons: [{ action: "ok", label: T("Editor.importar"), default: true, callback: (ev, btn) => btn.form.elements.fonte.value }, { action: "cancelar", label: T("Comum.cancelar") }],
      rejectClose: false
    });
    const f = fontes[num(escolha, -1)];
    if (f) this.carregar(foundry.utils.deepClone(f.dados));
  }

  async salvar() {
    // pega o que ainda estiver digitado sem "change"
    this.element.querySelectorAll("[data-caminho]").forEach((el) => foundry.utils.setProperty(this.dados, el.dataset.caminho, valorDoCampo(el, this.dados)));
    const novo = normalizar(this.dados);
    const { principal, lista } = listaCalendarios();
    const velho = lista[this.calId];
    const qtdNotas = velho ? game.journal.filter((j) => { const r = j.getFlag(MOD, "nota"); return r && calDaNota(r) === this.calId; }).length : 0;
    const r = await Dialogo().wait({
      window: { title: "CALMESA.Editor.salvar_calendario", icon: "fa-solid fa-floppy-disk" },
      content: `<div class="cm-form"><p>${T("Comum.salvar")} <b>${esc(novo.nome)}</b> ${T("Editor.para_todos")}</p>
        <p class="cm-dica">${T("Editor.0_meses_1_dias_no_ano_2", [novo.meses.length, novo.meses.reduce((s, m) => s + m.dias, 0), novo.semana.length, novo.horasDia])}</p>
        ${qtdNotas ? `<label class="cm-chip"><input type="checkbox" name="manter" checked> ${T("Editor.as_0_notas_deste_calendario_continuam", [qtdNotas])}</label>` : ""}</div>`,
      buttons: [{ action: "ok", label: T("Comum.salvar"), default: true, callback: (ev, btn) => ({ manter: !!btn.form.elements.manter?.checked }) }, { action: "cancelar", label: T("Comum.cancelar") }],
      rejectClose: false
    });
    if (!r || typeof r !== "object") return;
    const notasAntes = qtdNotas && r.manter ? datasDasNotas(this.calId, velho) : null;
    await game.settings.set(MOD, "calendarios", { principal: lista[principal] ? principal : this.calId, lista: { ...lista, [this.calId]: novo } });
    if (this.calId === (lista[principal] ? principal : this.calId)) await game.settings.set(MOD, "config", novo);
    CACHE_CAL.clear();
    aplicarCalendario();
    if (notasAntes) {
      const n = await reposicionarNotas(notasAntes, this.calId, novo);
      if (n) ui.notifications.info(T("Editor.0_nota_s_ajustada_s_para", [n]));
    }
    ui.notifications.info(T("Editor.calendario_salvo"));
    rerenderJanelas();
    // continua no editor, já com o que foi salvo
    this.dados = normalizar(novo);
    this.render();
  }
}

export {
  EditorCalendario
};
