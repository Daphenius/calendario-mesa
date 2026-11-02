/* =========================================================
 * Calendário da Mesa — Janela do clima
 * Abas Hoje, Previsão, Regiões, Climas, Efeitos, Anomalias e Cenas.
 * ========================================================= */

import { aplicarClimaNasCenas, planoClimaCena, TIPO_CLIMA } from "../clima-cenas.js";
import { ajustesDoEfeito, apiFx, efeitoCena, iniciarPreviaEfeito, pararPreviaEfeito, PREFIXO_EFEITO, PRESETS_FX_CONHECIDOS, presetsFx, previaAtiva } from "../clima-efeitos.js";
import { anomaliaDe, anomaliaRegiaoInteira, ANOMALIAS, anomaliasLigadas, climaCfg, climaDe, climaHoje, CLIMAS, dataNoMundo, definirPrevisao, ehDeFabrica, estacaoNoMundo, ESTACOES_CLIMA, gerarPrevisao, GRUPOS_CLIMA, hojeNoMundo, idClimaAnomalia, PREFIXO_ANOM, previsao, rolarClima, rolarTemperatura, salvarTipoDeClima, temperaturaTexto, tempoComAnomalia, zonaDaCena, zonaPadraoValida, ZONAS, zonasEmUso } from "../clima.js";
import { registrar } from "../historico.js";
import { HUD } from "../janela.js";
import { eventosLuasDoDia, textoEventoLua } from "../luas.js";
import { chat, Dialogo, esc, MOD, noMundo, num, opcoes, T, tema } from "../nucleo.js";

const { ApplicationV2 } = foundry.applications.api;

/* ---------------- janela do clima ----------------
 * Janela própria (não um diálogo do Foundry): tamanho fixo e redimensionável, só a lista de tempos rola,
 * o topo mostra o tempo de hoje ou o escolhido, e a barra de baixo (temperatura e Aplicar) fica sempre à vista. */

const NOMES_ESTACAO = { primavera: T("Clima.primavera"), verao: T("Clima.verao"), outono: T("Clima.outono"), inverno: T("Clima.inverno") };

async function dialogoClima() {
  if (!game.user.isGM) return;
  const aberta = foundry.applications.instances.get("cm-clima");
  if (aberta) { aberta.bringToFront?.(); return aberta; }
  return new JanelaClima().render({ force: true });
}

const ICONES_CLIMA = {
  "fa-sun": T("Comum.sol"), "fa-cloud-sun": T("Clima.sol_e_nuvem"), "fa-cloud": T("Clima.nuvem"), "fa-cloud-moon": T("Clima.lua_e_nuvem"), "fa-moon": T("Comum.lua"), "fa-smog": T("Comum.nevoa"),
  "fa-cloud-rain": T("Comum.chuva"), "fa-cloud-showers-heavy": T("Clima.chuva_forte"), "fa-cloud-showers-water": T("Clima.chuva_e_agua"), "fa-cloud-bolt": T("Clima.raio_e_nuvem"),
  "fa-bolt": T("Clima.raio"), "fa-cloud-meatball": T("Clima.granizo"), "fa-snowflake": T("Clima.floco_de_neve"), "fa-icicles": T("Clima.pingentes_de_gelo"),
  "fa-temperature-low": T("Clima.termometro_frio"), "fa-temperature-high": T("Clima.termometro_quente"), "fa-wind": T("Comum.vento"), "fa-tornado": T("Clima.tornado"),
  "fa-hurricane": T("Clima.furacao"), "fa-volcano": T("Clima.vulcao"), "fa-fire": T("Comum.fogo"), "fa-fire-flame-simple": T("Clima.chama"), "fa-droplet": T("Clima.gota"),
  "fa-droplet-slash": T("Clima.sem_agua"), "fa-water": T("Comum.agua"), "fa-mountain": T("Comum.montanha"), "fa-sun-plant-wilt": T("Clima.seca"), "fa-rainbow": T("Clima.arco_iris"),
  "fa-meteor": T("Clima.meteoro"), "fa-star": T("Comum.estrela"), "fa-skull": T("Comum.caveira"), "fa-ghost": T("Clima.espiritos"), "fa-eye": T("Clima.olho"),
  "fa-hand-sparkles": T("Clima.magia"), "fa-biohazard": T("Clima.praga"), "fa-hourglass-half": T("Comum.tempo"), "fa-wand-magic-sparkles": T("Clima.aurora_brilho"), "fa-circle-half-stroke": T("Clima.eclipse")
};
const opcoesIcone = (atual) => `${atual && !ICONES_CLIMA[atual] ? `<option value="${esc(atual)}" selected>${esc(atual)}</option>` : ""}${Object.entries(ICONES_CLIMA).map(([k, r]) => `<option value="${k}" ${atual === k ? "selected" : ""}>${esc(r)}</option>`).join("")}`;
const MAPA_TIPOS = { climas: () => CLIMAS, zonas: () => ZONAS, anomalias: () => ANOMALIAS, efeitos: () => game.settings.get(MOD, "climaTipos")?.efeitos ?? {} };

class JanelaClima extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "cm-clima",
    classes: ["cm-janela", "cm-clima-app"],
    tag: "div",
    window: { title: "CALMESA.Comum.clima", icon: "fa-solid fa-cloud-sun", resizable: true },
    position: { width: 820, height: 680 },
    actions: {
      aba(ev, t) { this.aba = t.dataset.aba; this.render(); },
      escolher(ev, t) { this.sel = this.sel === t.dataset.tipo ? null : t.dataset.tipo; this.faixa = null; this.sugerirTemp(); this.render(); },
      rolar() { this.sel = this.sel === "__rolar" ? null : "__rolar"; this.render(); },
      rolarTemp() { this.rolarTemp(); },
      filtro(ev, t) { this.filtro = t.dataset.grupo; this.render(); },
      estacao() { this.soEstacao = !this.soEstacao; this.render(); },
      async aplicar() { await this.aplicar(); },
      cancelar() { this.close(); },
      // editores
      editar(ev, t) { this.ed[t.dataset.grupo] = t.dataset.id; this.render(); },
      maisTroca() { this.guardarRascunho("anomalias"); const r = this.rascunhos[`anomalias:${this.ed.anomalias}`]; this.element.querySelector(".cm-ce-trocas tbody")?.insertAdjacentHTML("beforeend", this.linhaTroca("", "", r)); },
      tirarLinha(ev, t) { (t.closest(".cm-ce-local") ?? t.closest("tr"))?.remove(); },
      maisLocal() {
        this.guardarRascunho("anomalias");
        const id = this.ed.anomalias, r = this.rascunhos[`anomalias:${id}`];
        if (!r) return;
        (r.climas ??= {})[idClimaAnomalia(id, foundry.utils.randomID(6))] = { nome: T("Clima.novo_clima"), grupo: "chuva", icone: "fa-cloud", efeito: "", temp: 0, desc: "" };
        this.render();
      },
      copiarClimaDe() {
        this.guardarRascunho("anomalias");
        const r = this.rascunhos[`anomalias:${this.ed.anomalias}`];
        const m = ZONAS[this.element.querySelector('[name="copiarDe"]')?.value];
        if (!r || !m) return;
        r.zona = { temp: { ...m.temp }, variacao: m.variacao ?? 10, pesos: foundry.utils.deepClone(m.pesos) };
        this.render();
      },
      descartar(ev, t) { delete this.rascunhos[`${t.dataset.grupo}:${this.ed[t.dataset.grupo]}`]; this.render(); },
      subClimas(ev, t) { this.subClimas = t.dataset.sub; this.render(); },
      async prevGerar() { await gerarPrevisao(); },
      async prevRefazer() {
        const ok = await Dialogo().confirm({ window: { title: "CALMESA.Clima.refazer_a_previsao" }, content: `<p>${T("Clima.rolar_de_novo_todos_os_dias")}</p>` });
        if (ok) await gerarPrevisao(undefined, undefined, { refazer: true });
      },
      async prevRolar(ev, t) { const td = num(t.dataset.td); await definirPrevisao(td, this.zonaPrev, rolarClima(this.zonaPrev, td)); },
      async prevLimpar(ev, t) { await definirPrevisao(num(t.dataset.td), this.zonaPrev, null); },
      async prevMostrar() { await this.mostrarPrevisao(); },
      testarEfeito() { this.testarEfeito(); },
      pararTeste() { this.pararTeste(); },
      novo(ev, t) { this.criar(t.dataset.grupo); },
      duplicar(ev, t) { this.criar(t.dataset.grupo, true); },
      async salvarTipo(ev, t) { await this.salvarTipo(t.dataset.grupo); },
      async restaurar(ev, t) { await this.restaurar(t.dataset.grupo); },
      async apagarTipo(ev, t) { await this.apagarTipo(t.dataset.grupo); },
      async tornarPadrao() { await game.settings.set(MOD, "zonaPadrao", this.ed.zonas); ui.notifications.info(`${T("Clima.0_e_a_regiao_padrao_do", [ZONAS[this.ed.zonas]?.nome])}`); this.render(); }
    }
  };

  aba = "tempo";
  sel = null;          // tipo escolhido, "__rolar" ou null (manter)
  filtro = "todos";
  soEstacao = false;
  temp = null;         // °C escolhidos (null = não mexeu)
  faixa = null;        // { min, max, onda } vindos do dado da temperatura
  mexeu = false;
  ed = { climas: null, zonas: null, anomalias: null, efeitos: null };   // tipo aberto em cada editor
  subClimas = "climas";  // aba Climas: lista de climas ou de efeitos
  rascunhos = {};      // tipos novos ainda não salvos: { "zonas:id": dados }

  /** Região, estação e tabela de chances da cena atual. */
  contexto() {
    const zona = zonaDaCena();
    const est = estacaoNoMundo();
    const pesos = ZONAS[zona]?.pesos?.[est] ?? {};
    const soma = Object.values(pesos).reduce((x, y) => x + y, 0) || 1;
    return { zona, est, pesos, soma, atual: climaDe(zona), base: ZONAS[zona]?.temp?.[est] ?? 15 };
  }

  sugerirTemp() {
    if (this.mexeu || !CLIMAS[this.sel]) return;
    const { base } = this.contexto();
    this.temp = Math.round(base + (CLIMAS[this.sel].temp ?? 0));
  }

  rolarTemp() {
    if (this.sel === "__rolar") return;
    const { zona, atual } = this.contexto();
    const tipo = CLIMAS[this.sel] ? this.sel : (atual?.tipo ?? "limpo");
    const r = rolarTemperatura(zona, tipo);
    this.temp = r.temp; this.faixa = { min: r.min, max: r.max, onda: r.onda ?? null }; this.mexeu = true;
    this.render();
  }

  get emF() { return game.settings.get(MOD, "climaUnidade") === "F"; }
  get un() { return this.emF ? "°F" : "°C"; }
  paraTela(c) { return this.emF ? Math.round(c * 9 / 5 + 32) : Math.round(c); }
  deTela(v) { return this.emF ? Math.round((v - 32) * 5 / 9) : Math.round(v); }
  /** Variação (diferença) de temperatura: em °F só escala, sem somar 32. */
  difTela(c) { return this.emF ? Math.round(c * 9 / 5) : Math.round(c); }
  difDeTela(v) { return this.emF ? Math.round(v * 5 / 9) : Math.round(v); }

  async _renderHTML() {
    const anOk = anomaliasLigadas();
    if (this.aba === "anomalias" && !anOk) this.aba = "tempo";
    const abas = [["tempo", T("Clima.tempo_de_hoje"), "fa-cloud-sun"], ["previsao", T("Clima.previsao"), "fa-calendar-week"], ["climas", T("Clima.climas"), "fa-cloud-bolt"], ["zonas", T("Clima.regioes"), "fa-earth-americas"], ...(anOk ? [["anomalias", T("Comum.anomalias"), "fa-skull"]] : [])]
      .map(([k, r, ic]) => `<button type="button" class="${this.aba === k ? "ativo" : ""}" data-action="aba" data-aba="${k}"><i class="fa-solid ${ic}"></i> ${r}</button>`).join("");
    const corpo = this.aba === "zonas" ? this.htmlZonas() : this.aba === "anomalias" ? this.htmlAnomalias() : this.aba === "climas" ? this.htmlClimas() : this.aba === "previsao" ? this.htmlPrevisao() : this.htmlTempo();
    return `<div class="cm-raiz cm-clima-raiz cm-tema-${tema()}">
      <nav class="cm-clima-topo">${abas}</nav>
      ${corpo}
    </div>`;
  }

  /* ---------- aba: previsão ---------- */
  htmlPrevisao() {
    const emUso = zonasEmUso();
    if (!ZONAS[this.zonaPrev]) this.zonaPrev = zonaDaCena();
    const zona = this.zonaPrev;
    const dias = num(game.settings.get(MOD, "previsaoDias"), 5);
    const hoje = hojeNoMundo();   // a previsão é do mundo (calendário principal)
    const p = previsao();
    const climasZona = Object.entries(CLIMAS).filter(([, c]) => !c.daAnomalia || c.daAnomalia === ZONAS[zona]?.anomaliaFixa);
    const opTipo = (atual) => Object.entries(GRUPOS_CLIMA).map(([g, rot]) => `<optgroup label="${esc(T(rot))}">${climasZona.filter(([, c]) => c.grupo === g).map(([k, c]) => `<option value="${k}" ${atual === k ? "selected" : ""}>${esc(T(c.nome))}</option>`).join("")}</optgroup>`).join("");
    const linhas = [];
    let faltam = 0;
    for (let td = hoje + 1; td <= hoje + dias; td++) {
      const c = p.dias?.[td]?.[zona];
      const info = c ? CLIMAS[c.tipo] : null;
      const ev = noMundo(() => eventosLuasDoDia(td));
      if (!c) faltam++;
      linhas.push(`<div class="cm-prev-dia ${c ? `g-${info?.grupo ?? "ceu"}` : "vazio"}" data-td="${td}">
        <div class="cm-prev-data"><b>${td === hoje + 1 ? T("Clima.amanha") : esc(dataNoMundo(td, { ano: false, semana: true }))}</b><small>${T("Comum.em_n_dias", { n: td - hoje })}${ev.length ? ` · ${ev.map((e) => `<i class="fa-solid ${e.icone}" style="color:${e.cor}" data-tooltip="${esc(textoEventoLua(e))}"></i>`).join(" ")}` : ""}</small></div>
        ${c ? `<span class="cm-prev-ico"><i class="fa-solid ${info?.icone ?? "fa-cloud"}"></i></span>
          <select name="prevTipo" data-td="${td}">${opTipo(c.tipo)}</select>
          <label class="cm-prev-temp"><input type="number" name="prevTemp" data-td="${td}" value="${this.paraTela(c.temp)}"><span>${this.un}</span></label>
          <small class="cm-prev-faixa">${c.min != null ? T("Clima.min_min_max_max", { min: this.paraTela(c.min), max: this.paraTela(c.max) }) : ""}${c.onda ? ` · ${T("Clima.onda_de_tipo", { tipo: T(`Clima.${c.onda}`) })}` : ""}</small>
          <button type="button" class="cm-ce-x" data-action="prevRolar" data-td="${td}" data-tooltip="${esc(T("Clima.rolar_este_dia_de_novo"))}"><i class="fa-solid fa-dice"></i></button>
          <button type="button" class="cm-ce-x" data-action="prevLimpar" data-td="${td}" data-tooltip="${esc(T("Clima.tirar_da_previsao_o_dia_sera"))}"><i class="fa-solid fa-xmark"></i></button>`
        : `<span class="cm-prev-nada">${T("Clima.sem_previsao_sera_rolado_quando_o")}</span>
          <button type="button" class="cm-ce-x" data-action="prevRolar" data-td="${td}" data-tooltip="${esc(T("Clima.rolar_este_dia"))}"><i class="fa-solid fa-dice"></i></button>`}
      </div>`);
    }
    return `<div class="cm-prev">
      <div class="cm-prev-topo">
        <label>${T("Clima.regiao")}<select name="prevZona">${emUso.map((z) => `<option value="${z}" ${z === zona ? "selected" : ""}>${esc(T(ZONAS[z].nome))}</option>`).join("")}</select></label>
        <p class="cm-dica">${T("Clima.so_o_mestre_ve_quando_o")}</p>
      </div>
      <div class="cm-prev-lista">${linhas.join("")}</div>
      <footer class="cm-clima-rodape">
        <button type="button" data-action="prevGerar"><i class="fa-solid fa-wand-magic-sparkles"></i> ${faltam ? T("Clima.preencher_a_previsao_n_dias", { n: faltam }) : T("Clima.previsao_completa")}</button>
        <button type="button" data-action="prevRefazer"><i class="fa-solid fa-rotate"></i> ${T("Clima.refazer_tudo")}</button>
        <span class="cm-esp"></span>
        <button type="button" class="cm-clima-aplicar" data-action="prevMostrar"><i class="fa-solid fa-bullhorn"></i> ${T("Comum.mostrar_aos_jogadores")}</button>
      </footer>
    </div>`;
  }

  async mostrarPrevisao() {
    const zona = this.zonaPrev ?? zonaDaCena();
    const p = previsao();
    const hoje = hojeNoMundo();
    const dias = num(game.settings.get(MOD, "previsaoDias"), 5);
    const linhas = [];
    for (let td = hoje + 1; td <= hoje + dias; td++) {
      const c = p.dias?.[td]?.[zona];
      if (c) linhas.push(`<li><b>${esc(dataNoMundo(td, { ano: false }))}</b>: <i class="fa-solid ${CLIMAS[c.tipo]?.icone ?? "fa-cloud"}"></i> ${esc(T(CLIMAS[c.tipo]?.nome ?? c.tipo))}, ${temperaturaTexto(c.temp)}</li>`);
    }
    if (!linhas.length) return ui.notifications.warn(T("Clima.nao_ha_previsao_para_mostrar_preencha"));
    await chat(`<i class="fa-solid fa-calendar-week"></i> <b>${T("Clima.previsao_do_tempo_regiao", { regiao: esc(T(ZONAS[zona].nome)) })}</b><ul>${linhas.join("")}</ul>`);
  }

  /* ---------- aba: tempo de hoje ---------- */
  htmlTempo() {
    const cena = canvas?.scene;
    const { zona, est, pesos, soma, atual, base } = this.contexto();
    const zonaCena = cena?.getFlag(MOD, "zona") ?? "";
    const anOk = anomaliasLigadas();
    const an = climaCfg().zonas?.[zona]?.anomalia ?? { tipo: "nenhuma", texto: "" };
    const maxPeso = Math.max(1, ...Object.values(pesos));
    const rolando = this.sel === "__rolar";
    const tipoTopo = CLIMAS[this.sel] ? this.sel : atual?.tipo;
    const info = CLIMAS[tipoTopo];
    const tempTopo = this.temp ?? atual?.temp ?? base;
    const faixaTopo = this.faixa ?? (!CLIMAS[this.sel] && !this.mexeu ? atual : null);
    const anDe = anomaliaDe(zona);
    const anAtiva = anDe ? ANOMALIAS[anDe.tipo] : null;
    const rotuloTopo = rolando ? T("Clima.rolar_de_novo") : CLIMAS[this.sel] ? T("Clima.novo_tempo") : `${T("Clima.hoje_em_0", [ZONAS[zona].nome])}`;
    const heroi = `<section class="cm-clima-heroi g-${rolando ? "rolar" : info?.grupo ?? "ceu"}">
        <div class="cm-clima-heroi-ico"><i class="fa-solid ${rolando ? "fa-dice" : info?.icone ?? "fa-cloud-sun"}"></i></div>
        <div class="cm-clima-heroi-txt">
          <small>${esc(rotuloTopo)} · ${esc(NOMES_ESTACAO[est])}</small>
          <h2>${rolando ? T("Clima.surpresa") : esc(info?.nome ?? T("Clima.ainda_nao_rolado_2"))}</h2>
          <p>${rolando ? `${T("Clima.o_clima_de_hoje_sera_sorteado", [esc(ZONAS[zona].nome)])}` : esc(info?.desc ?? T("Clima.escolha_um_tempo_abaixo_ou_role"))}</p>
          ${anAtiva ? `<span class="cm-clima-anom"><i class="fa-solid ${anAtiva.icone ?? "fa-skull"}"></i> ${esc(anAtiva.nome)}</span>` : ""}
        </div>
        <div class="cm-clima-heroi-temp">
          <b data-temp-topo>${rolando ? "?" : `${this.paraTela(tempTopo)}${this.un}`}</b>
          ${!rolando && faixaTopo?.min != null ? `<small>${T("Clima.min_0_max_1_2", [this.paraTela(faixaTopo.min), this.paraTela(faixaTopo.max)])}</small>` : ""}
          ${!rolando && faixaTopo?.onda ? `<small class="cm-clima-onda"><i class="fa-solid fa-temperature-arrow-${faixaTopo.onda === "calor" ? "up" : "down"}"></i> ${T("Clima.onda_de_0_2", [esc(T(`Clima.${faixaTopo.onda}`))])}</small>` : ""}
        </div>
      </section>`;
    const filtros = [["todos", T("Comum.todos"), "fa-layer-group"], ...Object.entries(GRUPOS_CLIMA).map(([k, r]) => [k, r, { ceu: "fa-cloud-sun", nevoa: "fa-smog", chuva: "fa-cloud-rain", frio: "fa-snowflake", vento: "fa-wind" }[k]])]
      .map(([k, r, ic]) => `<button type="button" class="${this.filtro === k ? "ativo" : ""}" data-action="filtro" data-grupo="${k}"><i class="fa-solid ${ic}"></i> ${esc(r)}</button>`).join("");
    const cartoes = Object.entries(CLIMAS)
      .filter(([k, c]) => (!c.daAnomalia || c.daAnomalia === ZONAS[zona]?.anomaliaFixa) && (this.filtro === "todos" || c.grupo === this.filtro) && (!this.soEstacao || pesos[k]))
      .map(([k, c]) => {
        const pct = pesos[k] ? Math.max(1, Math.round((pesos[k] / soma) * 100)) : 0;
        return `<button type="button" class="cm-clima-cartao g-${c.grupo} ${this.sel === k ? "escolhido" : ""} ${atual?.tipo === k ? "hoje" : ""} ${pct ? "" : "raro"}"
            data-action="escolher" data-tipo="${k}" data-tooltip="${esc(c.desc ?? "")}">
          <span class="cm-clima-selos">${atual?.tipo === k ? `<span class="cm-clima-hoje-selo">${T("Comum.hoje")}</span>` : ""}${efeitoCena(k).weather || efeitoCena(k).preset ? `<i class="fa-solid fa-film" data-tooltip="${T("Clima.tem_efeito_na_cena_0", [efeitoCena(k).preset ? T("Clima.fxmaster") : ""])}"></i>` : ""}</span>
          <span class="cm-clima-cartao-ico"><i class="fa-solid ${c.icone}"></i></span>
          <span class="cm-clima-cartao-nome">${esc(c.nome)}</span>
          <span class="cm-clima-chance"><span style="width:${Math.round((pesos[k] ?? 0) / maxPeso * 100)}%"></span></span>
          <small>${pct ? `${T("Clima.0_nesta_estacao", [pct])}` : T("Clima.raro_aqui")}</small>
        </button>`;
      }).join("") || `<p class="cm-vazio">${T("Clima.nenhum_tempo_deste_grupo_acontece_nesta")}</p>`;
    const avancado = `<details class="cm-clima-avancado" ${this.avancadoAberto ? "open" : ""}>
        <summary><i class="fa-solid fa-sliders"></i> ${anOk && anomaliaRegiaoInteira() ? T("Clima.regiao_da_cena_e_anomalia_ativa") : T("Clima.regiao_da_cena")}</summary>
        ${cena ? `<label>${T("Clima.regiao_desta_cena_0", [esc(cena.name)])}<select name="zonaCena">
          <option value="" ${!zonaCena ? "selected" : ""}>${T("Clima.padrao_do_mundo_0", [esc(ZONAS[zonaPadraoValida()]?.nome)])}</option>
          ${opcoes(ZONAS, zonaCena, (v) => v.nome)}</select></label>` : ""}
        ${cena ? (() => {
          const decisao = cena.getFlag(MOD, "climaNaCena");
          const marcado = decisao ?? (!!ZONAS[zonaCena] || !!planoClimaCena(cena).incluir);
          return `<label class="cm-check cm-clima-na-cena"><input type="checkbox" name="climaNaCena" ${marcado ? "checked" : ""}> ${T("Clima.mostrar_o_efeito_do_clima_nesta")}</label>
            <p class="cm-dica">${esc(planoClimaCena(cena).incluir ? T("Clima.esta_cena_recebe_o_efeito_do") : planoClimaCena(cena).motivo)}</p>`;
        })() : ""}
        ${cena?.getFlag(MOD, "zonaAtiva") ? `<p class="cm-dica"><i class="fa-solid fa-map-location-dot"></i> ${T("Clima.o_grupo_esta_numa_regiao_de")}</p>` : ""}
        ${anOk && ZONAS[zona]?.virtual ? `<p class="cm-dica"><i class="fa-solid ${anAtiva?.icone ?? "fa-skull"}"></i> ${T("Clima.esta_e_a_regiao_da_anomalia")} <b>${esc(anAtiva?.nome ?? "")}</b>${T("Clima.ela_esta_sempre_ativa_aqui")}</p>` : ""}
        ${anOk && anomaliaRegiaoInteira() && !ZONAS[zona]?.virtual ? `<label>${T("Clima.anomalia_cobrindo_0_inteira", [esc(ZONAS[zona].nome)])}<select name="anomalia">${opcoes(ANOMALIAS, an.tipo, (v) => v.nome)}</select></label>` : ""}
        ${anOk && (ZONAS[zona]?.virtual || anomaliaRegiaoInteira()) ? `<label>${T("Clima.descricao_da_anomalia_para_os_jogadores")}<textarea name="anTexto" rows="2" placeholder="${T("Clima.deixe_vazio_para_usar_o_texto")}">${esc(an.texto ?? "")}</textarea></label>` : ""}
        <p class="cm-dica">${T("Clima.os_tempos_as_regioes_0_sao", [anOk ? T("Clima.e_as_anomalias") : ""])}</p>
      </details>`;
    const t = this.paraTela(tempTopo);
    return `${heroi}
      <nav class="cm-clima-abas">${filtros}
        <button type="button" class="cm-clima-estacao ${this.soEstacao ? "ativo" : ""}" data-action="estacao" data-tooltip="${T("Clima.mostrar_so_os_tempos_que_acontecem")}"><i class="fa-solid fa-filter"></i></button>
      </nav>
      <div class="cm-clima-lista">
        <div class="cm-clima-grade">${cartoes}</div>
        ${avancado}
      </div>
      <footer class="cm-clima-rodape">
        <button type="button" class="cm-clima-rolar ${rolando ? "ativo" : ""}" data-action="rolar" data-tooltip="${T("Clima.sortear_o_tempo_e_a_temperatura")}"><i class="fa-solid fa-dice"></i> ${T("Clima.rolar_tempo")}</button>
        <div class="cm-clima-termo" data-tooltip="${T("Clima.temperatura_do_dia_0", [this.un])}">
          <i class="fa-solid fa-temperature-half"></i>
          <input type="range" name="tempFaixa" min="${this.paraTela(-40)}" max="${this.paraTela(55)}" step="1" value="${t}" ${rolando ? "disabled" : ""}>
          <input type="number" name="temp" value="${t}" ${rolando ? "disabled" : ""}><span>${this.un}</span>
          <button type="button" class="cm-clima-dado" data-action="rolarTemp" ${rolando ? "disabled" : ""} data-tooltip="${T("Clima.rolar_so_a_temperatura_com_minima")}"><i class="fa-solid fa-dice-d20"></i></button>
        </div>
        <span class="cm-esp"></span>
        <button type="button" data-action="cancelar">${T("Comum.cancelar")}</button>
        <button type="button" class="cm-clima-aplicar" data-action="aplicar"><i class="fa-solid fa-check"></i> ${T("Clima.aplicar")}</button>
      </footer>`;
  }

  /* ---------- editores ---------- */
  /** Quantas cenas e Regiões do mapa usam esta região de clima. */
  usoDaZona(id) {
    let cenas = 0, regioes = 0;
    for (const sc of game.scenes) {
      if (sc.getFlag(MOD, "zona") === id) cenas++;
      for (const r of sc.regions ?? []) for (const b of r.behaviors ?? []) if (b.type === TIPO_CLIMA && b.system?.zona === id) regioes++;
    }
    return { cenas, regioes, padrao: zonaPadraoValida() === id };
  }

  /** Onde um clima é usado: regiões com chance dele e anomalias que forçam ou trocam para ele. */
  usoDoClima(id) {
    const zonas = Object.values(ZONAS).filter((z) => !z.virtual && Object.values(z.pesos ?? {}).some((p) => p[id] > 0)).map((z) => z.nome);
    const anoms = Object.entries(ANOMALIAS).filter(([k, a]) => k !== "nenhuma" && (a.clima === id || Object.entries(a.trocas ?? {}).some(([de, para]) => de === id || para === id) || Object.values(a.zona?.pesos ?? {}).some((p) => p[id] > 0))).map(([, a]) => a.nome);
    return { zonas, anoms };
  }

  /** Climas usados por um clima de cena (efeito) feito pelo mestre. */
  usoDoEfeito(id) {
    const chave = `${PREFIXO_EFEITO}${id}`;
    return Object.values(CLIMAS).filter((c) => c.efeito === chave || c.fx === chave).map((c) => c.nome);
  }

  /** Tipo aberto no editor (ou rascunho ainda não salvo). */
  tipoAberto(grupo) {
    const id = this.ed[grupo];
    return this.rascunhos[`${grupo}:${id}`] ?? MAPA_TIPOS[grupo]()[id];
  }

  /** Guarda o que está no formulário como rascunho (para redesenhar sem perder o que foi digitado). */
  guardarRascunho(grupo) {
    const id = this.ed[grupo];
    if (!id || !this.element?.querySelector(`.cm-ce-form[data-grupo="${grupo}"]`)) return;
    const antes = this.tipoAberto(grupo) ?? {};
    const d = this.lerEditor(grupo);
    if (grupo === "anomalias" && !d.zona && antes.zona) d.zona = antes.zona;
    if (antes.criada || !ehDeFabrica(grupo, id)) d.criada = true;
    this.rascunhos[`${grupo}:${id}`] = d;
  }

  listaEditor(grupo, atualId) {
    const mapa = MAPA_TIPOS[grupo]();
    const salvos = game.settings.get(MOD, "climaTipos")?.[grupo] ?? {};
    const rascunhos = Object.entries(this.rascunhos).filter(([k]) => k.startsWith(`${grupo}:`)).map(([k, d]) => [k.slice(grupo.length + 1), d]);
    const itens = [...Object.entries(mapa).filter(([k, d]) => k !== "nenhuma" && !d.virtual && !d.daAnomalia), ...rascunhos.filter(([id]) => !mapa[id])];
    const novo = { climas: T("Clima.novo_clima"), zonas: T("Clima.nova_regiao"), anomalias: T("Clima.nova_anomalia"), efeitos: T("Clima.novo_efeito") }[grupo];
    const item = ([id, d]) => {
      const rasc = this.rascunhos[`${grupo}:${id}`];
      const marca = rasc ? (mapa[id] ? T("Clima.alteracoes_nao_salvas") : T("Clima.nao_salvo")) : ehDeFabrica(grupo, id) ? (salvos[id] ? T("Clima.de_fabrica_editado") : T("Clima.de_fabrica")) : grupo === "anomalias" && d.regiao ? T("Clima.criada_e_uma_regiao") : T("Clima.criado_por_voce");
      const v = rasc ?? d;
      const ic = grupo === "zonas" ? (v.elemento ? "fa-gem" : "fa-earth-americas") : grupo === "efeitos" ? "fa-wand-magic-sparkles" : (v.icone ?? "fa-skull");
      return `<button type="button" class="cm-ce-item ${grupo === "climas" ? `g-${v.grupo}` : ""} ${id === atualId ? "ativo" : ""}" data-action="editar" data-grupo="${grupo}" data-id="${id}">
        ${grupo === "climas" ? `<span class="cm-ce-bola"><i class="fa-solid ${ic}"></i></span>` : `<i class="fa-solid ${ic}"></i>`}<span><b>${esc(v.nome)}</b><small>${marca}</small></span></button>`;
    };
    const corpo = grupo === "climas"
      ? Object.entries(GRUPOS_CLIMA).map(([g, rot]) => { const doGrupo = itens.filter(([, d]) => d.grupo === g); return doGrupo.length ? `<h5>${esc(rot)}</h5>${doGrupo.map(item).join("")}` : ""; }).join("")
      : itens.map(item).join("") || (grupo === "efeitos" ? `<p class="cm-dica">${T("Clima.nenhum_efeito_criado_ainda")}</p>` : "");
    const troca = grupo === "climas" || grupo === "efeitos"
      ? `<div class="cm-ce-sub"><button type="button" class="${grupo === "climas" ? "ativo" : ""}" data-action="subClimas" data-sub="climas"><i class="fa-solid fa-cloud-sun"></i> ${T("Clima.climas")}</button><button type="button" class="${grupo === "efeitos" ? "ativo" : ""}" data-action="subClimas" data-sub="efeitos"><i class="fa-solid fa-wand-magic-sparkles"></i> ${T("Clima.efeitos")}</button></div>` : "";
    return `<aside class="cm-ce-lista">
      ${troca}
      <button type="button" class="cm-ce-novo" data-action="novo" data-grupo="${grupo}"><i class="fa-solid fa-plus"></i> ${novo}</button>
      ${corpo}
    </aside>`;
  }

  criar(grupo, duplicar = false) {
    const atual = this.tipoAberto(grupo);
    const id = `${grupo[0]}${foundry.utils.randomID(8)}`;
    const vazio = {
      climas: { nome: "", icone: "fa-cloud", grupo: "ceu", efeito: "", temp: 0, desc: "", fx: "", fxOpcoes: {} },
      zonas: foundry.utils.deepClone(ZONAS.temperada ?? Object.values(ZONAS).find((z) => !z.virtual)),
      anomalias: { nome: "", clima: "", base: "temperada", trocas: {}, climas: {}, regiao: false, temp: 0, icone: "fa-skull", texto: "" },
      efeitos: { nome: "", base: "rain", cor: "", forca: 1, velocidade: 1, tamanho: 1, direcao: null, base2: "", cor2: "", forca2: 1 }
    }[grupo];
    const base = duplicar && atual ? foundry.utils.deepClone(atual) : vazio;
    base.nome = duplicar ? `${T("Comum.0_copia", [base.nome])}` : { climas: T("Clima.novo_clima"), zonas: T("Clima.nova_regiao"), anomalias: T("Clima.nova_anomalia"), efeitos: T("Clima.novo_efeito") }[grupo];
    base.criada = true;
    delete base.elemento; delete base.reserva; delete base.virtual; delete base.anomaliaFixa;
    if (grupo === "anomalias" && duplicar) {
      // os climas próprios ganham ids da cópia
      const climas = {}, mapa = {};
      for (const [gid, c] of Object.entries(base.climas ?? {})) { const novo = idClimaAnomalia(id, foundry.utils.randomID(6)); mapa[gid] = novo; climas[novo] = c; }
      const troca = (k) => mapa[k] ?? k;
      base.climas = climas;
      base.clima = troca(base.clima);
      base.trocas = Object.fromEntries(Object.entries(base.trocas ?? {}).map(([de, para]) => [troca(de), troca(para)]));
      if (base.zona) for (const e of ESTACOES_CLIMA) base.zona.pesos[e] = Object.fromEntries(Object.entries(base.zona.pesos?.[e] ?? {}).map(([k, v]) => [troca(k), v]));
    }
    this.rascunhos[`${grupo}:${id}`] = base;
    this.ed[grupo] = id;
    this.render();
  }

  rodapeEditor(grupo, { fabrica, editada, novo, alterado, extra = "" }) {
    const nome = { climas: T("Clima.clima"), zonas: T("Clima.regiao_2"), anomalias: T("Clima.anomalia"), efeitos: T("Clima.efeito") }[grupo];
    return `<footer class="cm-ce-acoes">
      ${extra}
      <button type="button" data-action="duplicar" data-grupo="${grupo}"><i class="fa-solid fa-copy"></i> ${T("Comum.duplicar")}</button>
      ${alterado ? `<button type="button" data-action="descartar" data-grupo="${grupo}"><i class="fa-solid fa-xmark"></i> ${T("Clima.descartar_alteracoes")}</button>` : ""}
      ${editada && !alterado ? `<button type="button" data-action="restaurar" data-grupo="${grupo}"><i class="fa-solid fa-rotate-left"></i> ${T("Clima.restaurar_de_fabrica")}</button>` : ""}
      ${!fabrica && !alterado ? `<button type="button" class="cm-ce-perigo" data-action="apagarTipo" data-grupo="${grupo}"><i class="fa-solid fa-trash"></i> ${novo ? T("Comum.descartar") : T("Comum.apagar")}</button>` : ""}
      <span class="cm-esp"></span>
      <button type="button" class="cm-clima-aplicar" data-action="salvarTipo" data-grupo="${grupo}"><i class="fa-solid fa-floppy-disk"></i> ${T("Clima.salvar_0", [nome])}</button>
    </footer>`;
  }

  estado(grupo) {
    const id = this.ed[grupo];
    const fabrica = ehDeFabrica(grupo, id);
    const rasc = !!this.rascunhos[`${grupo}:${id}`];
    const existe = !!MAPA_TIPOS[grupo]()[id];
    return { id, fabrica, editada: fabrica && !!game.settings.get(MOD, "climaTipos")?.[grupo]?.[id], novo: rasc && !existe, alterado: rasc && existe };
  }

  /** <select> de efeito na cena: Foundry, Calendário, seus efeitos e partículas do FXMaster. */
  opcoesEfeito(atual, vazio, { semPersonalizados = false } = {}) {
    const W = CONFIG.weatherEffects ?? {};
    const rot = (k) => { const l = W[k]?.label ?? k; try { return game.i18n?.localize?.(l) ?? l; } catch { return l; } };
    const grupos = [
      ["Foundry", Object.keys(W).filter((k) => !k.startsWith("cm-") && !k.startsWith(PREFIXO_EFEITO) && !k.startsWith("fxmaster."))],
      ["Calendário da Mesa", Object.keys(W).filter((k) => k.startsWith("cm-"))],
      ...(semPersonalizados ? [] : [[T("Clima.seus_efeitos"), Object.keys(W).filter((k) => k.startsWith(PREFIXO_EFEITO) && k !== `${PREFIXO_EFEITO}teste`)]]),
      [T("Clima.fxmaster_particulas"), Object.keys(W).filter((k) => k.startsWith("fxmaster."))]
    ];
    return `<option value="" ${!atual ? "selected" : ""}>${esc(vazio)}</option>` +
      grupos.filter(([, ks]) => ks.length).map(([g, ks]) => `<optgroup label="${esc(g)}">${ks.map((k) => `<option value="${esc(k)}" ${atual === k ? "selected" : ""}>${esc(rot(k))}</option>`).join("")}</optgroup>`).join("") +
      (atual && !W[atual] ? `<option value="${esc(atual)}" selected>${T("Clima.0_nao_encontrado_neste_mundo", [esc(atual)])}</option>` : "");
  }

  /** Tabela de chances (pesos por estação). climas = [[id, clima]]. */
  tabelaPesos(pesos, climas) {
    const somas = Object.fromEntries(ESTACOES_CLIMA.map((e) => [e, Object.values(pesos?.[e] ?? {}).reduce((x, y) => x + y, 0)]));
    const linhas = Object.entries(GRUPOS_CLIMA).map(([g, rot]) => {
      const doGrupo = climas.filter(([, c]) => c.grupo === g);
      if (!doGrupo.length) return "";
      return `<tr class="cm-ce-grupo"><th colspan="5">${esc(rot)}</th></tr>` + doGrupo.map(([k, c]) => `<tr>
        <td class="cm-ce-tipo g-${c.grupo}"><span class="cm-ce-bola"><i class="fa-solid ${c.icone}"></i></span> ${esc(c.nome)}${c.daAnomalia ? ` <small class="cm-ce-novo-selo">${T("Clima.desta_anomalia")}</small>` : ehDeFabrica("climas", k) ? "" : ` <small class="cm-ce-novo-selo">${T("Clima.novo")}</small>`}</td>
        ${ESTACOES_CLIMA.map((e) => `<td><input type="number" min="0" max="1000" step="1" name="peso.${e}.${k}" value="${pesos?.[e]?.[k] ?? 0}" data-estacao="${e}"></td>`).join("")}
      </tr>`).join("");
    }).join("");
    return `<div class="cm-ce-tabela-caixa"><table class="cm-ce-tabela">
      <thead><tr><th>${T("Comum.clima")}</th>${ESTACOES_CLIMA.map((e) => `<th>${esc(NOMES_ESTACAO[e])}<small data-soma="${e}" class="${somas[e] ? "" : "zero"}">${T("Clima.soma_0", [somas[e]])}</small></th>`).join("")}</tr></thead>
      <tbody>${linhas}</tbody>
    </table></div>`;
  }

  /** Temperatura média por estação + variação. */
  camposTemperatura(z) {
    return `<div class="cm-ce-temps cinco">${ESTACOES_CLIMA.map((e) => `<label>${T("Clima.media_0", [esc(NOMES_ESTACAO[e])])}<input type="number" name="temp.${e}" value="${this.paraTela(z?.temp?.[e] ?? 15)}"></label>`).join("")}
      <label data-tooltip="${T("Clima.quanto_um_dia_comum_pode_fugir")}">${T("Clima.variacao")} <input type="number" name="variacao" min="1" max="40" value="${this.difTela(z?.variacao ?? 10)}"></label></div>`;
  }

  lerTemperaturaEPesos(f, climasValidos) {
    const v = (n) => f?.querySelector(`[name="${n}"]`);
    const temp = {}, pesos = {};
    for (const e of ESTACOES_CLIMA) {
      temp[e] = this.deTela(num(v(`temp.${e}`)?.value, 15));
      pesos[e] = {};
      f.querySelectorAll(`[name^="peso.${e}."]`).forEach((el) => { const k = el.name.slice(`peso.${e}.`.length); const n = num(el.value, 0); if (n > 0 && (!climasValidos || climasValidos(k))) pesos[e][k] = n; });
    }
    return { temp, variacao: Math.max(1, this.difDeTela(num(v("variacao")?.value, 10))), pesos };
  }

  /* ---------- aba: climas ---------- */
  htmlClimas() {
    if (this.subClimas === "efeitos") return this.htmlEfeitos();
    if (!this.tipoAberto("climas") || this.tipoAberto("climas").daAnomalia) this.ed.climas = Object.keys(CLIMAS).find((k) => !CLIMAS[k].daAnomalia);
    const st = this.estado("climas");
    const c = this.tipoAberto("climas");
    const uso = this.usoDoClima(st.id);
    const api = apiFx(), ligado = game.settings.get(MOD, "usarFXMaster") !== false;
    const presets = api ? presetsFx() : PRESETS_FX_CONHECIDOS;
    const particulas = Object.keys(CONFIG.weatherEffects ?? {}).filter((k) => k.startsWith("fxmaster."));
    const fxAtual = c.fx ?? "";
    const fxOp = `<option value="" ${!fxAtual ? "selected" : ""}>${T("Clima.nenhum_usa_o_efeito_do_foundry")}</option>
      <optgroup label="${T("Clima.presets_do_fxmaster")}">${presets.map((p) => `<option value="fxp:${esc(p)}" ${fxAtual === `fxp:${p}` ? "selected" : ""}>${esc(p)}</option>`).join("")}</optgroup>
      ${particulas.length ? `<optgroup label="${T("Clima.particulas_do_fxmaster")}">${particulas.map((k) => `<option value="${esc(k)}" ${fxAtual === k ? "selected" : ""}>${esc(k.slice(9))}</option>`).join("")}</optgroup>` : ""}
      ${fxAtual && !presets.includes(fxAtual.slice(4)) && !particulas.includes(fxAtual) ? `<option value="${esc(fxAtual)}" selected>${T("Clima.0_nao_encontrado", [esc(fxAtual.replace(/^fxp:/, ""))])}</option>` : ""}`;
    const niveis = (atual) => [["", T("Clima.padrao")], ["very-low", T("Clima.muito_baixa")], ["low", T("Clima.baixa")], ["medium", T("Clima.media")], ["high", T("Clima.alta")], ["very-high", T("Clima.muito_alta")]].map(([k, r]) => `<option value="${k}" ${(atual ?? "") === k ? "selected" : ""}>${r}</option>`).join("");
    const o = c.fxOpcoes ?? {};
    const situacaoFx = !api ? T("Clima.o_fxmaster_nao_esta_ativo_neste") : !ligado ? T("Clima.a_opcao_usar_o_fxmaster_nos") : fxAtual ? T("Clima.com_o_fxmaster_ativo_este_clima") : T("Clima.sem_efeito_do_fxmaster_usa_o");
    const efeitoInfo = c.efeito ? (CONFIG.weatherEffects?.[c.efeito] ? T("Clima.com_efeito_na_cena") : T("Clima.efeito_nao_encontrado")) : T("Clima.sem_efeito_na_cena");
    return `<div class="cm-ce">
      ${this.listaEditor("climas", st.id)}
      <section class="cm-ce-form" data-grupo="climas">
        <div class="cm-ce-corpo">
          <div class="cm-ce-previa g-${c.grupo}"><span class="cm-ce-bola grande"><i class="fa-solid ${c.icone ?? "fa-cloud"}"></i></span>
            <div><b>${esc(c.nome || T("Clima.sem_nome"))}</b><small>${esc(GRUPOS_CLIMA[c.grupo] ?? "")} · ${c.temp > 0 ? "+" : ""}${this.difTela(c.temp ?? 0)}${this.un} · ${efeitoInfo}${fxAtual ? ` ${T("Clima.fxmaster_0", [esc(fxAtual.replace(/^fxp:|^fxmaster\./, ""))])}` : ""}</small>
            <small>${st.novo ? T("Clima.ainda_nao_salvo") : uso.zonas.length || uso.anoms.length ? `${T("Clima.usado_em_0", [esc([...uso.zonas, ...uso.anoms].join(", "))])}` : T("Clima.nenhuma_regiao_da_chance_a_este")}</small></div></div>
          <div class="cm-ce-campos">
            <label>${T("Comum.nome")}<input type="text" name="nome" value="${esc(c.nome)}" maxlength="60" placeholder="${T("Clima.ex_chuva_seca")}"></label>
            <label>${T("Clima.grupo")}<select name="grupo">${Object.entries(GRUPOS_CLIMA).map(([k, r]) => `<option value="${k}" ${c.grupo === k ? "selected" : ""}>${esc(r)}</option>`).join("")}</select></label>
            <label>${T("Comum.icone")}<select name="icone">${opcoesIcone(c.icone)}</select></label>
            <label>${T("Clima.efeito_na_cena_foundry")}<select name="efeito">${this.opcoesEfeito(c.efeito, T("Clima.nenhum_sem_efeito_na_cena"))}</select></label>
            <label>${T("Clima.muda_a_temperatura_do_dia_em", [this.un])}<input type="number" name="temp" value="${this.difTela(c.temp ?? 0)}"></label>
            <label class="cm-ce-largo">${T("Clima.descricao_vai_para_o_chat")}<textarea name="desc" rows="2" placeholder="${T("Clima.o_que_os_personagens_veem_e")}">${esc(c.desc ?? "")}</textarea></label>
          </div>
          <h4><i class="fa-solid fa-wand-sparkles"></i> FXMaster <small>${esc(situacaoFx)}</small></h4>
          <div class="cm-ce-campos cm-ce-fx">
            <label class="cm-ce-largo">${T("Clima.efeito_do_fxmaster_2")}<select name="fx">${fxOp}</select></label>
            <label>${T("Clima.densidade")}<select name="fxDensidade">${niveis(o.densidade)}</select></label>
            <label>${T("Clima.velocidade")}<select name="fxVelocidade">${niveis(o.velocidade)}</select></label>
            <label class="cm-ce-cor"><span><input type="checkbox" name="fxUsarCor" ${o.cor ? "checked" : ""}> ${T("Clima.mudar_a_cor_so_presets")}</span><input type="color" name="fxCor" value="${esc(o.cor || "#88ccff")}"></label>
          </div>
          <p class="cm-dica">${T("Clima.para_um_visual_so_seu_chuva")} <b>${T("Clima.efeitos")}</b> ${T("Clima.botao_no_alto_da_lista_e")}</p>
        </div>
        ${this.rodapeEditor("climas", st)}
      </section>
    </div>`;
  }

  /* ---------- climas › efeitos (variações dos efeitos de clima) ---------- */
  htmlEfeitos() {
    const mapa = MAPA_TIPOS.efeitos();
    if (!this.tipoAberto("efeitos")) this.ed.efeitos = Object.keys(mapa)[0] ?? null;
    const st = this.estado("efeitos");
    const e = this.tipoAberto("efeitos");
    if (!e) {
      return `<div class="cm-ce">${this.listaEditor("efeitos", null)}
        <section class="cm-ce-form" data-grupo="efeitos"><div class="cm-ce-corpo"><div class="cm-ce-vazio-grande">
          <i class="fa-solid fa-wand-magic-sparkles"></i>
          <h3>${T("Clima.seus_efeitos_de_clima")}</h3>
          <p>${T("Clima.faca_versoes_dos_efeitos_do_foundry")}</p>
          <button type="button" class="cm-clima-aplicar" data-action="novo" data-grupo="efeitos"><i class="fa-solid fa-plus"></i> ${T("Clima.novo_efeito")}</button>
        </div></div></section></div>`;
    }
    const aj = ajustesDoEfeito(e.base);
    const aj2 = e.base2 ? ajustesDoEfeito(e.base2) : null;
    const uso = st.novo ? [] : this.usoDoEfeito(st.id);
    const desl = (ok) => (ok ? "" : "disabled");
    const dica = (ok) => (ok ? "" : ` data-tooltip="${esc(T("Clima.esta_base_nao_tem_esse_ajuste"))}"`);
    const faixa = (nome, rot, min, max, passo, valor, ok, sufixo = "×") => `<label class="cm-ce-faixa ${ok ? "" : "off"}"${dica(ok)}>${rot}
      <span><input type="range" name="${nome}" min="${min}" max="${max}" step="${passo}" value="${valor}" ${desl(ok)}><output data-saida="${nome}">${valor}${sufixo}</output></span></label>`;
    const testando = this.testando ? `<button type="button" data-action="pararTeste"><i class="fa-solid fa-stop"></i> ${T("Clima.parar_de_ver")}</button>` : `<button type="button" data-action="testarEfeito" ${canvas?.scene ? "" : "disabled"} data-tooltip="${T("Clima.mostra_este_efeito_so_para_voce")}"><i class="fa-solid fa-eye"></i> ${T("Clima.ver_nesta_cena")}</button>`;
    return `<div class="cm-ce">
      ${this.listaEditor("efeitos", st.id)}
      <section class="cm-ce-form" data-grupo="efeitos">
        <div class="cm-ce-corpo">
          <div class="cm-ce-previa"><span class="cm-ce-bola grande efeito" style="${e.cor ? `--cor-ef:${esc(e.cor)}` : ""}"><i class="fa-solid fa-wand-magic-sparkles"></i></span>
            <div><b>${esc(e.nome || T("Clima.sem_nome"))}</b><small>${T("Clima.base_0_1", [esc(CONFIG.weatherEffects?.[e.base]?.label ?? e.base), e.base2 ? ` + ${esc(CONFIG.weatherEffects?.[e.base2]?.label ?? e.base2)}` : ""])}</small>
            <small>${st.novo ? T("Clima.ainda_nao_salvo") : uso.length ? `${T("Clima.usado_nos_climas_0", [esc(uso.join(", "))])}` : `${T("Clima.nenhum_clima_usa_este_efeito_ainda")}`}</small></div></div>
          <div class="cm-ce-campos">
            <label>${T("Comum.nome")}<input type="text" name="nome" value="${esc(e.nome)}" maxlength="60" placeholder="${T("Clima.ex_chuva_de_sangue")}"></label>
            <label>${T("Clima.efeito_base")}<select name="base">${this.opcoesEfeito(e.base, T("Clima.escolha"), { semPersonalizados: true })}</select></label>
          </div>
          <h4>${T("Clima.ajustes")}</h4>
          <div class="cm-ce-campos">
            <label class="cm-ce-cor ${aj.cor ? "" : "off"}"${dica(aj.cor)}><span><input type="checkbox" name="usarCor" ${e.cor ? "checked" : ""} ${desl(aj.cor)}> ${T("Clima.mudar_a_cor")}</span><input type="color" name="cor" value="${esc(e.cor || "#c0392b")}" ${desl(aj.cor)}></label>
            ${faixa("forca", T("Clima.forca"), 0.1, 3, 0.05, e.forca, aj.forca)}
            ${faixa("velocidade", T("Clima.velocidade"), 0, 3, 0.05, e.velocidade, aj.velocidade)}
            ${faixa("tamanho", T("Clima.tamanho"), 0.3, 3, 0.05, e.tamanho, aj.tamanho)}
            <label class="cm-ce-faixa ${aj.direcao ? "" : "off"}"${dica(aj.direcao)}><span><input type="checkbox" name="usarDirecao" ${e.direcao != null ? "checked" : ""} ${desl(aj.direcao)}> ${T("Clima.direcao")}</span>
              <span><input type="range" name="direcao" min="0" max="360" step="5" value="${e.direcao ?? 15}" ${desl(aj.direcao)}><output data-saida="direcao">${e.direcao ?? 15}°</output></span></label>
          </div>
          <h4>${T("Clima.juntar_com_outro_efeito")} <small>${T("Clima.opcional")}</small></h4>
          <div class="cm-ce-campos">
            <label>${T("Clima.segundo_efeito")}<select name="base2">${this.opcoesEfeito(e.base2, T("Clima.nenhum"), { semPersonalizados: true })}</select></label>
            <label class="cm-ce-cor ${aj2?.cor ? "" : "off"}"><span><input type="checkbox" name="usarCor2" ${e.cor2 ? "checked" : ""} ${desl(aj2?.cor)}> ${T("Clima.cor_do_segundo")}</span><input type="color" name="cor2" value="${esc(e.cor2 || "#9b59b6")}" ${desl(aj2?.cor)}></label>
            ${faixa("forca2", T("Clima.forca_do_segundo"), 0.1, 3, 0.05, e.forca2, !!aj2?.forca)}
          </div>
          <p class="cm-dica">${T("Clima.os_ajustes_que_a_base_nao")}</p>
        </div>
        ${this.rodapeEditor("efeitos", { ...st, extra: testando })}
      </section>
    </div>`;
  }

  /* ---------- aba: regiões ---------- */
  htmlZonas() {
    if (!this.tipoAberto("zonas") || this.tipoAberto("zonas").virtual) this.ed.zonas = ZONAS[zonaPadraoValida()]?.virtual ? "temperada" : zonaPadraoValida();
    const st = this.estado("zonas");
    const id = st.id;
    const z = this.tipoAberto("zonas");
    const uso = this.usoDaZona(id);
    const extra = !st.novo && !uso.padrao ? `<button type="button" data-action="tornarPadrao"><i class="fa-solid fa-star"></i> ${T("Clima.tornar_padrao_do_mundo")}</button>` : "";
    return `<div class="cm-ce">
      ${this.listaEditor("zonas", id)}
      <section class="cm-ce-form" data-grupo="zonas">
        <div class="cm-ce-cab">
          <label class="cm-ce-nome">${T("Comum.nome")}<input type="text" name="nome" value="${esc(z.nome)}" maxlength="80"></label>
          <label class="cm-check"><input type="checkbox" name="elemento" ${z.elemento ? "checked" : ""}> ${T("Clima.reino_de_elemento")}</label>
        </div>
        <p class="cm-dica">${st.novo ? T("Clima.ainda_nao_salva") : uso.cenas || uso.regioes || uso.padrao ? `${T("Clima.em_uso_0", [[uso.padrao ? T("Clima.regiao_padrao_do_mundo") : "", uso.cenas ? T("Clima.0_cena_s", [uso.cenas]) : "", uso.regioes ? `${T("Clima.0_regiao_oes_do_mapa", [uso.regioes])}` : ""].filter(Boolean).join(", ")])}` : T("Clima.nenhuma_cena_usa_esta_regiao_ainda")}</p>
        <h4>${T("Clima.temperatura_0", [this.un])}</h4>
        ${this.camposTemperatura(z)}
        <h4>${T("Clima.chance_de_cada_clima")} <small>${T("Clima.peso_0_nunca_a_e_calculada")}</small></h4>
        ${this.tabelaPesos(z.pesos, Object.entries(CLIMAS).filter(([, c]) => !c.daAnomalia))}
        ${this.rodapeEditor("zonas", { ...st, extra })}
      </section>
    </div>`;
  }

  /* ---------- aba: anomalias ---------- */
  /** Climas que valem dentro desta anomalia: os comuns + os dela (do rascunho, se houver). */
  climasDaAnomalia(a) {
    return [...Object.entries(CLIMAS).filter(([, c]) => !c.daAnomalia), ...Object.entries(a?.climas ?? {}).map(([gid, c]) => [gid, { ...c, daAnomalia: this.ed.anomalias }])];
  }

  opcoesTempoAnomalia(a, atual, vazio) {
    const lista = this.climasDaAnomalia(a);
    return `${vazio != null ? `<option value="" ${!atual ? "selected" : ""}>${esc(vazio)}</option>` : ""}` +
      Object.entries(GRUPOS_CLIMA).map(([g, rot]) => `<optgroup label="${esc(rot)}">${lista.filter(([, c]) => c.grupo === g).map(([k, c]) => `<option value="${k}" ${atual === k ? "selected" : ""}>${esc(c.nome)}${c.daAnomalia ? " ★" : ""}</option>`).join("")}</optgroup>`).join("");
  }

  linhaTroca(de, para, a = this.tipoAberto("anomalias")) {
    return `<tr><td><select name="trocaDe">${this.opcoesTempoAnomalia(a, de, T("Clima.escolha"))}</select></td><td class="cm-ce-seta"><i class="fa-solid fa-arrow-right"></i></td>
      <td><select name="trocaPara">${this.opcoesTempoAnomalia(a, para, T("Clima.escolha"))}</select></td>
      <td><button type="button" class="cm-ce-x" data-action="tirarLinha" data-tooltip="${T("Clima.tirar")}"><i class="fa-solid fa-xmark"></i></button></td></tr>`;
  }

  linhaClimaLocal(gid, c) {
    return `<div class="cm-ce-local g-${c.grupo}" data-gid="${esc(gid)}">
      <span class="cm-ce-bola"><i class="fa-solid ${c.icone ?? "fa-cloud"}"></i></span>
      <input type="text" name="lcNome" value="${esc(c.nome)}" maxlength="60" placeholder="${T("Clima.nome_ex_chuva_seca")}">
      <select name="lcGrupo">${Object.entries(GRUPOS_CLIMA).map(([k, r]) => `<option value="${k}" ${c.grupo === k ? "selected" : ""}>${esc(r)}</option>`).join("")}</select>
      <select name="lcIcone">${opcoesIcone(c.icone)}</select>
      <select name="lcEfeito">${this.opcoesEfeito(c.efeito, T("Clima.sem_efeito"))}</select>
      <input type="number" name="lcTemp" value="${this.difTela(c.temp ?? 0)}" data-tooltip="${T("Clima.muda_a_temperatura_do_dia_0", [this.un])}">
      <button type="button" class="cm-ce-x" data-action="tirarLinha" data-tooltip="${T("Clima.tirar_este_clima")}"><i class="fa-solid fa-xmark"></i></button>
      <input type="text" name="lcDesc" class="cm-ce-local-desc" value="${esc(c.desc ?? "")}" maxlength="300" placeholder="${T("Clima.descricao_para_o_chat")}">
    </div>`;
  }

  htmlAnomalias() {
    const ids = Object.keys(ANOMALIAS).filter((k) => k !== "nenhuma");
    if (!this.tipoAberto("anomalias") || this.ed.anomalias === "nenhuma") this.ed.anomalias = ids[0];
    const st = this.estado("anomalias");
    const id = st.id;
    const a = this.tipoAberto("anomalias");
    if (!a) return `<div class="cm-ce">${this.listaEditor("anomalias", null)}<section class="cm-ce-form"><p class="cm-vazio">${T("Clima.nenhuma_anomalia_crie_uma_com_nova")}</p></section></div>`;
    const regiaoId = `${PREFIXO_ANOM}${id}`;
    const usoRegiao = ZONAS[regiaoId] ? this.usoDaZona(regiaoId) : { cenas: 0, regioes: 0 };
    const inteira = anomaliaRegiaoInteira();
    const ativas = inteira ? Object.entries(climaCfg().zonas ?? {}).filter(([, v]) => v?.anomalia?.tipo === id).map(([z]) => ZONAS[z]?.nome ?? z) : [];
    const trocas = Object.entries(a.trocas ?? {});
    const locais = Object.entries(a.climas ?? {});
    const nomeClima = (k) => CLIMAS[k]?.nome ?? a.climas?.[k]?.nome ?? k;
    const resumoTrocas = trocas.length ? trocas.map(([de, para]) => `${nomeClima(de)} → ${nomeClima(para)}`).join(", ") : "";
    const zona = a.zona ?? ZONAS[a.base] ?? ZONAS.temperada;
    const situacao = [
      a.regiao ? (st.novo || st.alterado ? `${T("Clima.ao_salvar_vira_a_regiao_0", [a.nome])}` : `${T("Clima.e_a_regiao_0_1", [a.nome, usoRegiao.cenas || usoRegiao.regioes ? `${T("Clima.usada_em_0", [[usoRegiao.cenas ? T("Clima.0_cena_s", [usoRegiao.cenas]) : "", usoRegiao.regioes ? `${T("Clima.0_regiao_oes_do_mapa", [usoRegiao.regioes])}` : ""].filter(Boolean).join(T("Comum.e"))])}` : ""])}`) : T("Clima.nao_e_uma_regiao"),
      ativas.length ? T("Clima.cobre_0", [ativas.join(", ")]) : ""
    ].filter(Boolean).join(" · ");
    const regioesModelo = Object.entries(ZONAS).filter(([, z]) => !z.virtual).map(([k, z]) => `<option value="${k}" ${(a.base ?? "temperada") === k ? "selected" : ""}>${esc(z.nome)}</option>`).join("");
    return `<div class="cm-ce">
      ${this.listaEditor("anomalias", id)}
      <section class="cm-ce-form" data-grupo="anomalias">
        <div class="cm-ce-corpo">
        <div class="cm-ce-previa"><span class="cm-ce-bola grande anom"><i class="fa-solid ${a.icone ?? "fa-skull"}"></i></span>
          <div><b>${esc(a.nome || T("Clima.sem_nome"))}</b><small>${a.clima ? `${T("Clima.forca_0", [esc(nomeClima(a.clima))])}` : resumoTrocas ? `${T("Clima.troca_0", [esc(resumoTrocas)])}` : T("Clima.nao_mexe_no_tempo")} · ${a.temp > 0 ? "+" : ""}${this.difTela(a.temp ?? 0)}${this.un}${locais.length ? ` ${T("Clima.0_clima_s_proprio_s", [locais.length])}` : ""}</small>
          <small>${esc(situacao)}</small></div></div>
        <div class="cm-ce-campos">
          <label>${T("Comum.nome")}<input type="text" name="nome" value="${esc(a.nome)}" maxlength="80" placeholder="${T("Clima.ex_eclipse_eterno")}"></label>
          <label>${T("Comum.icone")}<select name="icone">${opcoesIcone(a.icone)}</select></label>
          <label>${T("Clima.tempo_forcado")}<select name="clima">${this.opcoesTempoAnomalia(a, a.clima, T("Clima.nao_forca_usa_as_chances_e"))}</select></label>
          <label>${T("Clima.muda_a_temperatura_em_0", [this.un])}<input type="number" name="temp" value="${this.difTela(a.temp ?? 0)}"></label>
          <label class="cm-ce-largo">${T("Clima.texto_para_os_jogadores")}<textarea name="texto" rows="2" placeholder="${T("Clima.o_que_os_personagens_percebem_enquanto")}">${esc(a.texto ?? "")}</textarea></label>
        </div>

        <h4><i class="fa-solid fa-cloud-sun"></i> ${T("Clima.climas_desta_anomalia")} <small>${T("Clima.so_existem_aqui_nao_mudam_os")}</small></h4>
        <div class="cm-ce-locais">
          ${locais.map(([gid, c]) => this.linhaClimaLocal(gid, c)).join("") || `<p class="cm-dica">${T("Clima.nenhum_ex_uma_chuva_seca_com")}</p>`}
          <button type="button" class="cm-ce-mais" data-action="maisLocal"><i class="fa-solid fa-plus"></i> ${T("Clima.novo_clima_desta_anomalia")}</button>
        </div>

        <h4><i class="fa-solid fa-right-left"></i> ${T("Clima.trocar_climas")} <small>${T("Clima.enquanto_ativa_nao_vale_se_ela")}</small></h4>
        <div class="cm-ce-trocas">
          <table><tbody>${trocas.map(([de, para]) => this.linhaTroca(de, para, a)).join("")}${trocas.length ? "" : this.linhaTroca("", "", a)}</tbody></table>
          <button type="button" class="cm-ce-mais" data-action="maisTroca"><i class="fa-solid fa-plus"></i> ${T("Clima.adicionar_troca")}</button>
        </div>

        <h4><i class="fa-solid fa-map-location-dot"></i> ${T("Clima.usar_como_regiao")}</h4>
        <label class="cm-ce-chave"><input type="checkbox" name="regiao" ${a.regiao ? "checked" : ""}>
          <span><b>${T("Clima.gerar_a_regiao_0", [esc(a.nome || "…")])}</b><small>${T("Clima.ligado_aparece_na_lista_de_regioes")}</small></span></label>
        ${a.regiao ? `<div class="cm-ce-regiao">
          <div class="cm-ce-copiar"><label>${T("Clima.copiar_o_clima_de")}<select name="copiarDe">${regioesModelo}</select></label>
            <button type="button" data-action="copiarClimaDe"><i class="fa-solid fa-copy"></i> ${T("Clima.copiar")}</button>
            <span class="cm-dica">${T("Clima.copia_temperaturas_e_chances_de_uma")}</span></div>
          <h4>${T("Clima.temperatura_0", [this.un])}</h4>
          ${this.camposTemperatura(zona)}
          <h4>${T("Clima.chance_de_cada_clima")} <small>${T("Clima.peso_0_nunca")}</small></h4>
          ${this.tabelaPesos(zona.pesos, this.climasDaAnomalia(a))}
        </div>` : ""}
        </div>
        ${this.rodapeEditor("anomalias", st)}
      </section>
    </div>`;
  }

  /** Lê o formulário do editor aberto. */
  lerEditor(grupo) {
    const f = this.element.querySelector(`.cm-ce-form[data-grupo="${grupo}"]`);
    const v = (n) => f?.querySelector(`[name="${n}"]`);
    if (grupo === "zonas") {
      return { nome: v("nome")?.value.trim() || T("Clima.regiao_sem_nome"), elemento: !!v("elemento")?.checked, ...this.lerTemperaturaEPesos(f) };
    }
    if (grupo === "climas") {
      return {
        nome: v("nome")?.value.trim() || T("Clima.clima_sem_nome"), grupo: v("grupo")?.value, icone: v("icone")?.value, efeito: v("efeito")?.value ?? "",
        temp: this.difDeTela(num(v("temp")?.value, 0)), desc: v("desc")?.value ?? "",
        fx: v("fx")?.value ?? "", fxOpcoes: { densidade: v("fxDensidade")?.value ?? "", velocidade: v("fxVelocidade")?.value ?? "", cor: v("fxUsarCor")?.checked ? v("fxCor")?.value : "" }
      };
    }
    if (grupo === "efeitos") {
      return {
        nome: v("nome")?.value.trim() || T("Clima.efeito_sem_nome"), base: v("base")?.value || "rain",
        cor: v("usarCor")?.checked ? v("cor")?.value : "", forca: num(v("forca")?.value, 1), velocidade: num(v("velocidade")?.value, 1), tamanho: num(v("tamanho")?.value, 1),
        direcao: v("usarDirecao")?.checked ? num(v("direcao")?.value, 0) : null,
        base2: v("base2")?.value ?? "", cor2: v("usarCor2")?.checked ? v("cor2")?.value : "", forca2: num(v("forca2")?.value, 1)
      };
    }
    // anomalias
    const climas = {};
    f.querySelectorAll(".cm-ce-local").forEach((el) => {
      const q = (n) => el.querySelector(`[name="${n}"]`)?.value;
      climas[el.dataset.gid] = { nome: q("lcNome")?.trim() || T("Clima.clima_sem_nome"), grupo: q("lcGrupo"), icone: q("lcIcone"), efeito: q("lcEfeito") ?? "", temp: this.difDeTela(num(q("lcTemp"), 0)), desc: q("lcDesc") ?? "" };
    });
    const trocas = {};
    f.querySelectorAll(".cm-ce-trocas tbody tr").forEach((tr) => {
      const de = tr.querySelector('[name="trocaDe"]')?.value, para = tr.querySelector('[name="trocaPara"]')?.value;
      if (de && para && de !== para) trocas[de] = para;
    });
    const regiaoBox = f.querySelector(".cm-ce-regiao");
    const valido = (k) => (CLIMAS[k] && !CLIMAS[k].daAnomalia) || !!climas[k];
    return {
      nome: v("nome")?.value.trim() || T("Clima.anomalia_sem_nome"), icone: v("icone")?.value, clima: v("clima")?.value ?? "", trocas, climas,
      temp: this.difDeTela(num(v("temp")?.value, 0)), texto: v("texto")?.value ?? "",
      base: v("copiarDe")?.value || this.tipoAberto("anomalias")?.base || "temperada",
      regiao: !!v("regiao")?.checked,
      ...(regiaoBox ? { zona: this.lerTemperaturaEPesos(regiaoBox, valido) } : {})
    };
  }

  async salvarTipo(grupo) {
    const id = this.ed[grupo];
    if (!id) return;
    const dados = this.lerEditor(grupo);
    const antes = this.tipoAberto(grupo);
    if (grupo === "anomalias" && !dados.zona && antes?.zona) dados.zona = antes.zona;
    const pesos = grupo === "zonas" ? dados.pesos : grupo === "anomalias" && dados.regiao && dados.zona ? dados.zona.pesos : null;
    if (pesos) {
      const vazias = ESTACOES_CLIMA.filter((e) => !Object.keys(pesos[e] ?? {}).length);
      if (vazias.length) return ui.notifications.warn(T("Clima.de_chance_a_pelo_menos_um", [vazias.map((e) => NOMES_ESTACAO[e]).join(", ")]));
    }
    if (grupo === "anomalias" && dados.regiao && !dados.zona) {
      const m = ZONAS[dados.base] ?? ZONAS.temperada;
      dados.zona = { temp: { ...m.temp }, variacao: m.variacao ?? 10, pesos: foundry.utils.deepClone(m.pesos) };
    }
    if (!ehDeFabrica(grupo, id)) dados.criada = true;
    if (grupo === "efeitos") pararPreviaEfeito();
    await salvarTipoDeClima(grupo, id, dados);
    delete this.rascunhos[`${grupo}:${id}`];
    ui.notifications.info(T("Clima.0_salvo", [dados.nome]));
    this.render();
  }

  async restaurar(grupo) {
    const id = this.ed[grupo];
    const ok = await Dialogo().confirm({ window: { title: "CALMESA.Clima.restaurar_de_fabrica" }, content: `<p>${T("Clima.voltar")} <b>${esc(MAPA_TIPOS[grupo]()[id]?.nome)}</b> ${T("Clima.para_os_valores_originais_do_modulo")}</p>` });
    if (!ok) return;
    await salvarTipoDeClima(grupo, id, null);
    this.render();
  }

  async apagarTipo(grupo) {
    const id = this.ed[grupo];
    if (!id || ehDeFabrica(grupo, id)) return;
    if (this.rascunhos[`${grupo}:${id}`] && !MAPA_TIPOS[grupo]()[id]) { delete this.rascunhos[`${grupo}:${id}`]; this.ed[grupo] = null; return this.render(); }
    let aviso = "";
    if (grupo === "zonas") {
      const u = this.usoDaZona(id);
      if (u.cenas || u.regioes || u.padrao) aviso = `<p class="cm-dica">${T("Clima.ela_esta_em_uso_0_esses", [[u.padrao ? T("Clima.padrao_do_mundo") : "", u.cenas ? T("Clima.0_cena_s", [u.cenas]) : "", u.regioes ? `${T("Clima.0_regiao_oes", [u.regioes])}` : ""].filter(Boolean).join(", ")])}</p>`;
    } else if (grupo === "climas") {
      const u = this.usoDoClima(id);
      if (u.zonas.length || u.anoms.length) aviso = `<p class="cm-dica">${T("Clima.usado_em_0_ele_sai_das", [esc([...u.zonas, ...u.anoms].join(", "))])}</p>`;
    } else if (grupo === "efeitos") {
      const u = this.usoDoEfeito(id);
      if (u.length) aviso = `<p class="cm-dica">${T("Clima.usado_nos_climas_0_eles_ficam", [esc(u.join(", "))])}</p>`;
    } else {
      const u = this.usoDaZona(`${PREFIXO_ANOM}${id}`);
      if (u.cenas || u.regioes) aviso = `<p class="cm-dica">${T("Clima.os_lugares_que_a_usam_como")}</p>`;
    }
    const nome = MAPA_TIPOS[grupo]()[id]?.nome ?? id;
    const ok = await Dialogo().confirm({ window: { title: "CALMESA.Comum.apagar" }, content: `<p>${T("Comum.apagar")} <b>${esc(nome)}</b>?</p>${aviso}` });
    if (!ok) return;
    if (grupo === "efeitos") pararPreviaEfeito();
    await salvarTipoDeClima(grupo, id, null);
    this.ed[grupo] = null;
    this.render();
  }

  /** Mostra o efeito em edição só para este usuário, na cena aberta, sem gravar nada na cena. */
  testarEfeito() {
    if (!canvas?.scene) return;
    if (!iniciarPreviaEfeito(this.lerEditor("efeitos"))) return ui.notifications.warn(T("Clima.nao_deu_para_montar_este_efeito"));
    this.guardarRascunho("efeitos");
    this.render();
  }

  pararTeste(redesenhar = true) {
    pararPreviaEfeito();
    if (redesenhar) this.render();
  }

  get testando() { return previaAtiva(); }

  _onClose(options) {
    this.pararTeste(false);
    return super._onClose?.(options);
  }

  _replaceHTML(html, content) {
    const rolagem = { lista: content.querySelector(".cm-clima-lista")?.scrollTop ?? 0, tabela: content.querySelector(".cm-ce-tabela-caixa")?.scrollTop ?? 0, corpo: content.querySelector(".cm-ce-corpo")?.scrollTop ?? 0, aba: this._abaAntes };
    this._abaAntes = this.aba;
    // o que foi digitado na parte avançada continua lá depois de redesenhar
    const valores = Object.fromEntries([...content.querySelectorAll(".cm-clima-avancado [name]")].map((el) => [el.name, el.type === "checkbox" ? el.checked : el.value]));
    content.innerHTML = html;
    const lista = content.querySelector(".cm-clima-lista");
    if (lista) lista.scrollTop = rolagem.lista;
    const caixa = content.querySelector(".cm-ce-tabela-caixa");
    if (caixa) caixa.scrollTop = rolagem.tabela;
    const corpo = content.querySelector(".cm-ce-corpo");
    if (corpo && rolagem.aba === this.aba) corpo.scrollTop = rolagem.corpo;
    for (const [k, v] of Object.entries(valores)) { const el = content.querySelector(`.cm-clima-avancado [name="${k}"]`); if (el) { if (el.type === "checkbox") el.checked = v; else el.value = v; } }
    content.querySelector(".cm-clima-avancado")?.addEventListener("toggle", (ev) => { this.avancadoAberto = ev.target.open; });
    const faixa = content.querySelector('[name="tempFaixa"]'), campo = content.querySelector('.cm-clima-termo [name="temp"]');
    const topo = content.querySelector("[data-temp-topo]");
    const mudou = (v) => {
      if (!Number.isFinite(Number(v)) || v === "") return;
      this.mexeu = true; this.faixa = null;
      this.temp = this.deTela(Number(v));
      if (topo) topo.textContent = `${v}${this.un}`;
    };
    faixa?.addEventListener("input", () => { campo.value = faixa.value; mudou(faixa.value); });
    campo?.addEventListener("input", () => { faixa.value = campo.value; mudou(campo.value); });
    // saídas dos controles deslizantes do editor de efeitos
    content.querySelectorAll(".cm-ce-faixa input[type=range]").forEach((el) => el.addEventListener("input", () => {
      const o = content.querySelector(`[data-saida="${el.name}"]`);
      if (o) o.textContent = `${el.value}${el.name === "direcao" ? "°" : "×"}`;
    }));
    // trocar a base de um efeito ou ligar/desligar "Usar como região" redesenha (os campos mudam)
    content.querySelectorAll('.cm-ce-form[data-grupo="efeitos"] [name="base"], .cm-ce-form[data-grupo="efeitos"] [name="base2"]').forEach((el) => el.addEventListener("change", () => { this.guardarRascunho("efeitos"); this.render(); }));
    content.querySelector('.cm-ce-form[data-grupo="anomalias"] [name="regiao"]')?.addEventListener("change", () => { this.guardarRascunho("anomalias"); this.render(); });
    // previsão: região, tempo e temperatura de cada dia
    content.querySelector('[name="prevZona"]')?.addEventListener("change", (ev) => { this.zonaPrev = ev.target.value; this.render(); });
    content.querySelectorAll('[name="prevTipo"]').forEach((el) => el.addEventListener("change", async () => {
      const td = num(el.dataset.td), z = this.zonaPrev;
      const r = rolarTemperatura(z, el.value, td);
      await definirPrevisao(td, z, { tipo: el.value, ...r });
    }));
    content.querySelectorAll('[name="prevTemp"]').forEach((el) => el.addEventListener("change", async () => {
      const td = num(el.dataset.td), z = this.zonaPrev;
      const atual = previsao().dias?.[td]?.[z];
      if (!atual || el.value === "") return;
      const t = this.deTela(num(el.value, 0)), d = t - atual.temp;
      await definirPrevisao(td, z, { ...atual, temp: t, min: (atual.min ?? atual.temp - 4) + d, max: (atual.max ?? atual.temp + 4) + d });
    }));
    // soma de cada estação na tabela de chances, ao vivo
    content.querySelectorAll(".cm-ce-tabela input[data-estacao]").forEach((el) => el.addEventListener("input", () => {
      const e = el.dataset.estacao;
      const soma = [...content.querySelectorAll(`.cm-ce-tabela input[data-estacao="${e}"]`)].reduce((x, i) => x + Math.max(0, num(i.value, 0)), 0);
      const alvo = content.querySelector(`[data-soma="${e}"]`);
      if (alvo) { alvo.textContent = T("Clima.soma_0", [soma]); alvo.classList.toggle("zero", !soma); }
    }));
  }

  async aplicar() {
    const el = this.element;
    const cena = canvas?.scene;
    const val = (n) => el.querySelector(`.cm-clima-avancado [name="${n}"]`)?.value;
    const { zona: zonaAntes, est } = this.contexto();
    const anAntes = climaCfg().zonas?.[zonaAntes]?.anomalia?.tipo ?? "nenhuma";
    const zonaCenaAntes = cena?.getFlag(MOD, "zona") ?? "";
    const novaZonaCena = val("zonaCena");
    if (cena && novaZonaCena != null && novaZonaCena !== zonaCenaAntes) {
      if (novaZonaCena) await cena.setFlag(MOD, "zona", novaZonaCena); else await cena.unsetFlag(MOD, "zona");
    }
    // "Mostrar o efeito do clima nesta cena": só grava quando o mestre muda a escolha
    const caixa = el.querySelector('.cm-clima-avancado [name="climaNaCena"]');
    if (cena && caixa) {
      const antes = cena.getFlag(MOD, "climaNaCena");
      const efetivo = antes ?? planoClimaCena(cena).incluir;
      if (caixa.checked !== efetivo || (antes !== undefined && antes !== caixa.checked)) await cena.setFlag(MOD, "climaNaCena", caixa.checked);
    }
    const zonaAlvo = zonaDaCena();
    const anomalia = anomaliasLigadas() && anomaliaRegiaoInteira() && ANOMALIAS[val("anomalia")] ? val("anomalia") : anAntes;
    const cfg = climaCfg();
    cfg.zonas[zonaAlvo] = { ...(cfg.zonas[zonaAlvo] ?? {}), anomalia: { tipo: anomalia, texto: String(val("anTexto") ?? cfg.zonas[zonaAlvo]?.anomalia?.texto ?? "").trim() } };
    await game.settings.set(MOD, "climaZonas", cfg);

    const hoje = foundry.utils.deepClone(climaHoje());
    const c = hoje.zonas[zonaAlvo];
    const faixa = this.faixa;
    if (this.sel === "__rolar" || (!this.sel && !c)) hoje.zonas[zonaAlvo] = rolarClima(zonaAlvo);
    else if (CLIMAS[this.sel]) {
      const temp = this.temp ?? Math.round((ZONAS[zonaAlvo]?.temp?.[est] ?? 15) + (CLIMAS[this.sel].temp ?? 0));
      hoje.zonas[zonaAlvo] = { tipo: this.sel, temp, min: faixa?.min ?? temp - 4, max: faixa?.max ?? temp + 4, ...(faixa?.onda ? { onda: faixa.onda } : {}) };
    } else if (c && anomalia !== anAntes && anomalia !== "nenhuma") {
      // anomalia ligada agora: o tempo de hoje já passa a seguir ela (tempo forçado ou troca)
      hoje.zonas[zonaAlvo] = { ...c, tipo: tempoComAnomalia(zonaAlvo, c.tipo), temp: c.temp + (ANOMALIAS[anomalia].temp ?? 0), min: (c.min ?? c.temp - 4) + (ANOMALIAS[anomalia].temp ?? 0), max: (c.max ?? c.temp + 4) + (ANOMALIAS[anomalia].temp ?? 0) };
      if (this.mexeu && this.temp != null) Object.assign(hoje.zonas[zonaAlvo], { temp: this.temp, min: this.faixa?.min ?? this.temp - 4, max: this.faixa?.max ?? this.temp + 4 });
    } else if (this.mexeu && this.temp != null && c) {
      const d = this.temp - c.temp;   // mantém a amplitude do dia (ou usa a do dado)
      const { onda: _o, ...semOnda } = c;
      hoje.zonas[zonaAlvo] = { ...semOnda, temp: this.temp, min: faixa?.min ?? (c.min ?? c.temp - 4) + d, max: faixa?.max ?? (c.max ?? c.temp + 4) + d, ...(faixa?.onda ? { onda: faixa.onda } : {}) };
    }
    await game.settings.set(MOD, "climaAtual", hoje);
    if (anomalia !== anAntes && anomalia !== "nenhuma") await registrar(T("Clima.0_em_1", [ANOMALIAS[anomalia].nome, ZONAS[zonaAlvo].nome]), { icone: ANOMALIAS[anomalia].icone ?? "fa-skull" });
    await aplicarClimaNasCenas();
    HUD.render();
    ui.notifications.info(`${T("Clima.clima_de_0_1_2", [ZONAS[zonaAlvo].nome, CLIMAS[hoje.zonas[zonaAlvo]?.tipo]?.nome ?? "?", temperaturaTexto(hoje.zonas[zonaAlvo]?.temp)])}`);
    this.close();
  }
}

export {
  dialogoClima,
  JanelaClima
};
