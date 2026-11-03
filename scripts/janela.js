/* =========================================================
 * Calendário da Mesa — Interface
 * HUD (relógio no topo da tela), escolha do calendário da cena e a janela do calendário.
 * ========================================================= */

import { anomaliaDe, ANOMALIAS, climaDe, CLIMAS, temperaturaTexto, zonaDaCena, ZONAS } from "./clima.js";
import { contadores } from "./contadores.js";
import { agora, diasNoMes, eraDoAno, estacaoDe, infoDia, periodoDe, solDe, tdDe, textoAno, textoData, textoHoraDec, textoRelogio } from "./datas.js";
import { lojasHTML } from "./lojas.js";
import { eventosLuasDoDia, faseDe, luasNoCeu, luaSVG, proximosEventosLuas, textoEventoLua, textoFalta, visibilidadeLua } from "./luas.js";
import { aplicarLuz, estadoLuz, luzDoSol } from "./luz.js";
import { abrirNota, acoesDaNota, apagarNota, comecaEm, criarNota, descreverRepeticao, editarNota, inicioQueCobre, linhaDoJournal, notaNova, notas, notasDoDia, notasNoJournal, podeCriarNota } from "./notas.js";
import { CFG, Dialogo, diaTotalDe, esc, JOURNAL, limparCache, listaCalendarios, mod, MOD, normalizar, num, relatarErro, segDia, segHora, segMinuto, segundoDoDia, T, tema } from "./nucleo.js";
import { avancar, avancarAte, definirHoraDialogo, DESFAZER, desfazerUltimoPulo, irPara, ULT_TEMPO } from "./relogio.js";
import { abrirFerramenta, ferr } from "./sob-demanda.js";
import { viagemAtual } from "./viagem.js";

const { ApplicationV2 } = foundry.applications.api;

/* ---------------- HUD ---------------- */

class HUD {
  static el = null;

  static montar() {
    if (this.el) return;
    const el = document.createElement("div");
    el.id = "cm-hud";
    document.body.append(el);
    this.el = el;

    el.addEventListener("click", (ev) => {
      const a = ev.target.closest("[data-acao]");
      if (!a) return;
      ev.preventDefault();
      this.acao(a.dataset.acao, a.dataset);
    });

    // arrastar: no modo completo pela alça; no mini (data e hora) e no oculto (bolinha), por qualquer ponto.
    // Só começa a mover depois de 4 px, para o clique duplo (trocar de modo) continuar funcionando.
    el.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      const pelaAlca = !!ev.target.closest(".cm-arrasta");
      const pequeno = el.classList.contains("cm-mini") || el.classList.contains("cm-oculto");
      if (!pelaAlca && !(pequeno && !ev.target.closest("[data-acao], a, button, select, input"))) return;
      if (pelaAlca) ev.preventDefault();
      const r = el.getBoundingClientRect();
      const dx = ev.clientX - r.left, dy = ev.clientY - r.top;
      const x0 = ev.clientX, y0 = ev.clientY;
      let movendo = pelaAlca;
      const mover = (e) => {
        if (!movendo) {
          if (Math.hypot(e.clientX - x0, e.clientY - y0) < 4) return;
          movendo = true;
          el.classList.add("cm-movendo");
        }
        const larg = el.offsetWidth || 60, alt = el.offsetHeight || 30;
        el.style.left = `${Math.max(0, Math.min(window.innerWidth - Math.min(larg, 60), e.clientX - dx))}px`;
        el.style.top = `${Math.max(0, Math.min(window.innerHeight - Math.min(alt, 30), e.clientY - dy))}px`;
        el.style.transform = "none";
      };
      const soltar = () => {
        window.removeEventListener("pointermove", mover);
        window.removeEventListener("pointerup", soltar);
        el.classList.remove("cm-movendo");
        if (!movendo) return;
        game.settings.set(MOD, "posHud", { left: el.style.left, top: el.style.top }).catch((err) => relatarErro(T("Tempo.posicao_do_hud"), err, { avisar: false }));
      };
      window.addEventListener("pointermove", mover);
      window.addEventListener("pointerup", soltar);
    });

    // clique duplo: completo → mini (só data e hora) → oculto (bolinha) → completo
    el.addEventListener("dblclick", async (ev) => {
      if (ev.target.closest("[data-acao], .cm-ceu, .cm-arrasta, a, button, select, input")) return;
      ev.preventDefault();
      const prox = { completo: "mini", mini: "oculto", oculto: "completo" }[game.settings.get(MOD, "hudModo")] ?? "completo";
      await game.settings.set(MOD, "hudModo", prox);
      this.render();
    });

    // arrastar o sol/lua na faixa do céu muda a hora do dia (mestre)
    el.addEventListener("pointerdown", (ev) => {
      const ceu = ev.target.closest(".cm-ceu");
      if (!ceu || !game.user.isGM) return;
      ev.preventDefault();
      const r = ceu.getBoundingClientRect();
      const sd = segDia(), base = diaTotalDe(game.time.worldTime) * sd;
      const frac = (x) => Math.min(0.99999, Math.max(0, (x - r.left) / r.width));
      const mostrar = (e) => {
        const f = frac(e.clientX);
        ceu.style.setProperty("--agora", `${(f * 100).toFixed(2)}%`);
        const t = el.querySelector(".cm-hora-txt");
        if (t) t.textContent = textoRelogio(f * sd);
      };
      this.arrastando = true;
      ceu.classList.add("cm-movendo");
      mostrar(ev);
      const soltar = async (e) => {
        window.removeEventListener("pointermove", mostrar);
        window.removeEventListener("pointerup", soltar);
        this.arrastando = false;
        ceu.classList.remove("cm-movendo");
        const alvo = base + Math.round(frac(e.clientX) * sd);
        if (alvo !== game.time.worldTime) await game.time.set(alvo);
        else this.render();
      };
      window.addEventListener("pointermove", mostrar);
      window.addEventListener("pointerup", soltar);
    });

    // segundos andando entre um passo e outro do relógio em tempo real
    setInterval(() => this.tique(), 1000);

    const pos = game.settings.get(MOD, "posHud");
    if (pos?.left) { el.style.left = pos.left; el.style.top = pos.top; el.style.transform = "none"; }
  }

  /** Atualiza só a hora, o sol/lua e o período (sem refazer o HUD inteiro). */
  static atualizarHora() {
    if (!this.el || this.arrastando || !CFG) return;
    const modo = game.settings.get(MOD, "hudModo");
    if (modo === "oculto") return;
    if (modo === "mini") {
      const a = agora(), t = this.el.querySelector(".cm-hora-txt");
      if (t) t.textContent = textoRelogio(segundoDoDia(a.wt));
      return;
    }
    if (!this.el.querySelector(".cm-ceu")) return this.render();
    const a = agora();
    const ceu = this.el.querySelector(".cm-ceu");
    ceu.style.setProperty("--agora", `${((a.horaDec / CFG.horasDia) * 100).toFixed(2)}%`);
    const astro = ceu.querySelector(".cm-astro");
    if (astro) astro.className = `cm-astro ${luzDoSol(a.wt) > 0.4 ? "sol" : "lua"}`;
    const t = this.el.querySelector(".cm-hora-txt");
    if (t) t.textContent = textoRelogio(segundoDoDia(a.wt));
    else {
      const h = this.el.querySelector(".cm-hora");
      const p = periodoDe(a.horaDec, a.mes, a.dia);
      if (h) h.innerHTML = `<i class="fa-solid ${p.icone}"></i> ${p.nome}`;
    }
  }

  static tique() {
    if (!this.el || this.arrastando || !CFG) return;
    if (!game.settings.get(MOD, "relogioAtivo")) return;
    if (game.paused && game.settings.get(MOD, "pausaJogo")) return;
    if (game.combat?.started && game.settings.get(MOD, "pausaCombate")) return;
    const taxa = Math.max(0, num(game.settings.get(MOD, "relogioTaxa"), 1));
    const extra = Math.min((performance.now() - ULT_TEMPO) / 1000, 6) * taxa;
    const wt = game.time.worldTime + extra;
    if (diaTotalDe(wt) !== diaTotalDe(game.time.worldTime)) return;   // a virada do dia espera o próximo passo real
    const t = this.el.querySelector(".cm-hora-txt");
    if (t) t.textContent = textoRelogio(segundoDoDia(wt));
    this.el.querySelector(".cm-ceu")?.style.setProperty("--agora", `${((segundoDoDia(wt) / segDia()) * 100).toFixed(2)}%`);
  }

  static async acao(acao, d) {
    const sh = segHora(), sd = segDia();
    switch (acao) {
      case "abrir": return JanelaCalendario.abrir();
      case "compactar": await game.settings.set(MOD, "hudCompacto", !game.settings.get(MOD, "hudCompacto")); return this.render();
      case "avancar": return avancar(num(d.q) * ({ d: sd, h: sh, m: segMinuto() }[d.un] ?? 0));
      case "amanhecer": { const a = agora(); return avancarAte(solDe(a.mes, a.dia).nascer); }
      case "meiodia": return avancarAte(CFG.horasDia / 2);
      case "anoitecer": { const a = agora(); return avancarAte(solDe(a.mes, a.dia).por); }
      case "meianoite": return avancarAte(0);
      case "descanso": return avancar(8 * sh);
      case "hora": return game.user.isGM ? definirHoraDialogo() : null;
      case "relogio": await game.settings.set(MOD, "relogioAtivo", !game.settings.get(MOD, "relogioAtivo")); return;
      case "cena": {
        const s = canvas?.scene;
        if (!s) return ui.notifications.warn(T("Tempo.nenhuma_cena_aberta"));
        const ligado = !s.getFlag(MOD, "diaNoite");
        await s.setFlag(MOD, "diaNoite", ligado);
        ui.notifications.info(ligado ? `${T("Tempo.0_agora_segue_o_dia_e", [s.name])}` : `${T("Tempo.0_nao_segue_mais_o_dia", [s.name])}`);
        if (ligado) await aplicarLuz(estadoLuz(game.time.worldTime), 2000, [s]);
        return this.render();
      }
      case "editor": return abrirFerramenta("EditorCalendario");
      case "calCena": return escolherCalendarioDaCena();
      case "clima": return ferr("dialogoClima");
      case "viagem": return viagemAtual() ? abrirFerramenta("JanelaViagem") : ferr("dialogoViagem");
      case "contadores": return abrirFerramenta("JanelaContadores");
      case "historico": return abrirFerramenta("JanelaHistorico");
      case "desfazer": return desfazerUltimoPulo();
    }
  }

  static render() {
    if (!this.el || !CFG || this.arrastando) return;
    if (!game.settings.get(MOD, "mostrarHud")) { this.el.style.display = "none"; return; }
    this.el.style.display = "";
    const gm = game.user.isGM;
    const a = agora();
    const compacto = game.settings.get(MOD, "hudCompacto");
    const modo = game.settings.get(MOD, "hudModo");
    const mostrarHoraMini = gm || game.settings.get(MOD, "jogadoresVeemHora");
    if (modo === "oculto") {
      this.el.className = `cm-tema-${tema()} cm-oculto`;
      this.el.innerHTML = `<div class="cm-bolinha" data-tooltip="${T("Tempo.0_clique_duas_vezes_para_mostrar", [esc(textoData(a))])}"><i class="fa-solid fa-calendar-days"></i></div>`;
      return;
    }
    if (modo === "mini") {
      const p = periodoDe(a.horaDec, a.mes, a.dia);
      this.el.className = `cm-tema-${tema()} cm-mini`;
      this.el.innerHTML = `<div class="cm-linha" data-tooltip="${T("Tempo.clique_duas_vezes_para_ocultar_arraste")}">
        <span class="cm-mini-data">${esc(textoData(a, { semana: false }))}</span>
        <span class="cm-hora">${mostrarHoraMini ? `<span class="cm-hora-txt">${textoRelogio(segundoDoDia(a.wt))}</span>` : `<i class="fa-solid ${p.icone}"></i> ${p.nome}`}</span>
      </div>`;
      return;
    }
    const est = estacaoDe(a.mes, a.dia);
    const { nascer, por } = solDe(a.mes, a.dia);
    const H = CFG.horasDia;
    const pct = (h) => ((h / H) * 100).toFixed(1);
    const mostrarHora = gm || game.settings.get(MOD, "jogadoresVeemHora");
    const periodo = periodoDe(a.horaDec, a.mes, a.dia);
    const luas = luasNoCeu(a.td).map((l) => { const f = faseDe(l, a.td); return `<span class="cm-lua-wrap" data-tooltip="${esc(l.nome)}: ${esc(f.nome)}">${luaSVG(f.p, l.cor, 16)}</span>`; }).join("");
    const relogioOn = game.settings.get(MOD, "relogioAtivo");
    const cenaOn = !!canvas?.scene?.getFlag(MOD, "diaNoite");
    const btn = (acao, icone, dica, extra = "", cls = "") => `<a class="cm-btn ${cls}" data-acao="${acao}" ${extra} data-tooltip="${esc(dica)}"><i class="fa-solid ${icone}"></i></a>`;

    this.el.className = `cm-tema-${tema()} ${compacto ? "cm-compacto" : ""}`;
    this.el.innerHTML = `
      <div class="cm-ceu ${gm ? "cm-ceu-gm" : ""}" style="--n:${pct(nascer)}%;--p:${pct(por)}%;--agora:${pct(a.horaDec)}%" ${gm ? `data-tooltip="${esc(T("Tempo.arraste_o_sol_lua_para_mudar"))}"` : ""}>
        <span class="cm-astro ${luzDoSol(a.wt) > 0.4 ? "sol" : "lua"}"></span>
      </div>
      <div class="cm-linha">
        <a class="cm-arrasta" data-tooltip="${T("Tempo.arrastar")}"><i class="fa-solid fa-grip-vertical"></i></a>
        <div class="cm-data">
          <div class="cm-data-sem">${esc(CFG.semana[a.sem]?.nome ?? "")}${Object.keys(listaCalendarios().lista).length > 1 ? ` · <span class="cm-cal-nome">${esc(CFG.nome)}</span>` : ""}</div>
          <div class="cm-data-txt">${esc(textoData(a, { semana: false }))}</div>
        </div>
        <div class="cm-hora ${gm ? "cm-clicavel" : ""}" ${gm ? `data-acao="hora" data-tooltip="${esc(T("Tempo.definir_a_hora"))}"` : ""}>
          ${mostrarHora ? `<span class="cm-hora-txt">${textoRelogio(segundoDoDia(a.wt))}</span>` : `<i class="fa-solid ${periodo.icone}"></i> ${periodo.nome}`}
        </div>
        <div class="cm-extras">
          ${est ? `<span class="cm-estacao" data-tooltip="${esc(est.nome)}"><i class="fa-solid ${esc(est.icone)}"></i></span>` : ""}
          ${(() => {
            const zona = zonaDaCena(), c = climaDe(zona);
            if (!c) return gm ? `<a class="cm-clima" data-acao="clima" data-tooltip="${T("Tempo.clima_ainda_nao_rolado_hoje")}"><i class="fa-solid fa-cloud-sun"></i></a>` : "";
            const an = anomaliaDe(zona);
            const dica = `${ZONAS[zona].nome}: ${CLIMAS[c.tipo]?.nome}, ${temperaturaTexto(c.temp)}${an ? ` — ${an.texto || ANOMALIAS[an.tipo].texto}` : ""}`;
            return `<span class="cm-clima ${an ? "cm-anomalia" : ""}" ${gm ? `data-acao="clima"` : ""} data-tooltip="${esc(dica)}"><i class="fa-solid ${CLIMAS[c.tipo]?.icone ?? "fa-cloud"}"></i> ${temperaturaTexto(c.temp)}</span>`;
          })()}
          ${luas}
        </div>
        ${(() => { const n = contadores().filter((c) => !c.feito && (gm || c.visivel)).length; return n && !gm ? `<a class="cm-btn cm-badge" data-acao="contadores" data-tooltip="${T("Tempo.contadores")}"><i class="fa-solid fa-hourglass-half"></i><b>${n}</b></a>` : ""; })()}
        ${!gm && game.settings.get(MOD, "historicoJogadores") ? btn("historico", "fa-scroll", T("Comum.historico_da_campanha")) : ""}
        ${btn("abrir", "fa-calendar-days", T("Tempo.abrir_o_calendario"))}
        ${gm ? btn("compactar", compacto ? "fa-chevron-down" : "fa-chevron-up", compacto ? T("Tempo.mostrar_controles") : T("Tempo.esconder_controles")) : ""}
      </div>
      ${gm && !compacto ? `
      <div class="cm-controles">
        <div class="cm-grupo">
          ${btn("avancar", "fa-backward-fast", T("Tempo.voltar_1_dia"), `data-un="d" data-q="-1"`)}
          ${btn("avancar", "fa-backward", T("Tempo.voltar_1_hora"), `data-un="h" data-q="-1"`)}
          ${btn("avancar", "fa-forward-step", T("Tempo.avancar_10_minutos"), `data-un="m" data-q="10"`)}
          ${btn("avancar", "fa-forward", T("Tempo.avancar_1_hora"), `data-un="h" data-q="1"`)}
          ${btn("avancar", "fa-forward-fast", T("Tempo.avancar_1_dia"), `data-un="d" data-q="1"`)}
          ${DESFAZER.pilha.length ? btn("desfazer", "fa-rotate-left", T("Tempo.desfazer_o_ultimo_pulo_volta_para", { quando: textoData(infoDia(diaTotalDe(DESFAZER.pilha.at(-1).antes)), { semana: false }) + " " + textoRelogio(segundoDoDia(DESFAZER.pilha.at(-1).antes)) })) : ""}
        </div>
        <div class="cm-grupo">
          ${btn("amanhecer", "fa-cloud-sun", T("Tempo.ate_o_proximo_amanhecer"))}
          ${btn("meiodia", "fa-sun", T("Tempo.ate_o_meio_dia"))}
          ${btn("anoitecer", "fa-cloud-moon", T("Tempo.ate_o_anoitecer"))}
          ${btn("meianoite", "fa-moon", T("Tempo.ate_a_meia_noite"))}
          ${btn("descanso", "fa-campground", T("Tempo.descanso_longo_8_horas"))}
        </div>
        <div class="cm-grupo">
          ${btn("relogio", relogioOn ? "fa-pause" : "fa-play", relogioOn ? T("Tempo.pausar_o_relogio_em_tempo_real") : T("Tempo.ligar_o_relogio_em_tempo_real"), "", relogioOn ? "ativo" : "")}
          ${Object.keys(listaCalendarios().lista).length > 1 ? btn("calCena", "fa-landmark", `${T("Tempo.calendario_desta_cena_0", [CFG.nome])}`) : ""}
          ${btn("cena", "fa-circle-half-stroke", cenaOn ? T("Tempo.esta_cena_segue_o_dia_noite") : T("Tempo.fazer_esta_cena_seguir_o_dia"), "", cenaOn ? "ativo" : "")}
          ${btn("editor", "fa-gear", T("Tempo.editar_o_calendario"))}
        </div>
        <div class="cm-grupo">
          ${btn("clima", "fa-cloud-sun-rain", T("Tempo.clima_da_regiao"))}
          ${btn("viagem", "fa-route", viagemAtual() ? T("Tempo.viagem_em_andamento") : T("Comum.viajar"), "", viagemAtual() ? "ativo" : "")}
          ${(() => { const n = contadores().filter((c) => !c.feito).length; return `<a class="cm-btn cm-badge" data-acao="contadores" data-tooltip="${T("Comum.contadores_e_prazos")}"><i class="fa-solid fa-hourglass-half"></i>${n ? `<b>${n}</b>` : ""}</a>`; })()}
          ${btn("historico", "fa-scroll", T("Comum.historico_da_campanha"))}
        </div>
      </div>` : ""}`;
  }
}

/* ---------------- escolher calendário ---------------- */

/** Barra para trocar o calendário mostrado (só aparece com mais de um calendário). */
function seletorCalendarios() {
  const { principal, lista } = listaCalendarios();
  const ids = Object.keys(lista);
  if (ids.length < 2) return "";
  let visto = "";
  try { visto = game.settings.get(MOD, "calendarioVisto"); } catch (err) { console.warn(`${MOD} | "ver como" (configuração ainda não registrada?)`, err); }
  const cena = canvas?.scene;
  const daCena = cena?.getFlag(MOD, "calendario");
  const nome = (id) => esc(normalizar(lista[id]).nome);
  const auto = daCena && lista[daCena] ? `${T("Tempo.automatico_cena_0", [nome(daCena)])}` : `${T("Tempo.automatico_0", [nome(principal)])}`;
  return `<div class="cm-cals">
    <i class="fa-solid fa-landmark"></i>
    <select class="cm-ver-como" data-tooltip="${T("Tempo.qual_calendario_ver_automatico_segue_a")}">
      <option value="" ${!visto ? "selected" : ""}>${auto}</option>
      ${ids.map((id) => `<option value="${id}" ${visto === id ? "selected" : ""}>${nome(id)}${id === principal ? " ★" : ""}</option>`).join("")}
    </select>
    ${game.user.isGM && cena ? `<button type="button" data-action="usarNaCena" data-tooltip="${T("Tempo.escolher_o_calendario_desta_cena_vale")}"><i class="fa-solid fa-map"></i> ${T("Tempo.calendario_da_cena")}</button>` : ""}
  </div>`;
}

async function escolherCalendarioDaCena() {
  const cena = canvas?.scene;
  if (!cena || !game.user.isGM) return;
  const { principal, lista } = listaCalendarios();
  const atual = cena.getFlag(MOD, "calendario") ?? "";
  const escolha = await Dialogo().wait({
    window: { title: `${T("Tempo.calendario_de_0", [cena.name])}`, icon: "fa-solid fa-landmark" },
    content: `<div class="cm-form"><label>${T("Tempo.calendario_desta_cena")}<select name="cal">
      <option value="" ${!atual ? "selected" : ""}>${T("Tempo.principal_do_mundo_0", [esc(normalizar(lista[principal]).nome)])}</option>
      ${Object.keys(lista).map((id) => `<option value="${id}" ${atual === id ? "selected" : ""}>${esc(normalizar(lista[id]).nome)}</option>`).join("")}
    </select></label><p class="cm-dica">${T("Tempo.quem_estiver_nesta_cena_no_modo")}</p></div>`,
    buttons: [{ action: "ok", label: T("Comum.salvar"), default: true, callback: (ev, btn) => btn.form.elements.cal.value }, { action: "cancelar", label: T("Comum.cancelar") }],
    rejectClose: false
  });
  if (typeof escolha !== "string" || escolha === "cancelar") return;
  if (escolha) await cena.setFlag(MOD, "calendario", escolha);
  else await cena.unsetFlag(MOD, "calendario");
}

const ANOS_POR_PAGINA = 12;   // anos no painel de escolher o ano (clique no ano do cabeçalho)

class JanelaCalendario extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "cm-calendario",
    classes: ["cm-janela"],
    tag: "div",
    window: { title: "CALMESA.Comum.calendario", icon: "fa-solid fa-calendar-days", resizable: true },
    position: { width: 820, height: 600 },
    actions: {
      mes(ev, t) { this.mudarMes(num(t.dataset.q)); },
      ano(ev, t) { this.mudarMes(num(t.dataset.q) * CFG.meses.length); },
      hoje() { this.irParaHoje(true); },
      // escolher o ano: clicar no ano abre (ou fecha) o painel com 12 anos
      anos() { this.anosInicio = this.anosInicio == null ? this.ano - 5 : null; this.render(); },
      paginaAnos(ev, t) { this.anosInicio += num(t.dataset.q) * ANOS_POR_PAGINA; this.render(); },
      escolherAno(ev, t) { this.irParaAno(num(t.dataset.ano)); },
      irAno() { this.irParaAnoDigitado(); },
      dia(ev, t) {
        this.sel = num(t.dataset.td);
        const i = infoDia(this.sel);
        this.ano = i.ano; this.mes = i.mes;
        this.render();
      },
      novaNota() { if (podeCriarNota()) criarNota(this.sel); },
      abrirNota(ev, t) { const j = game.journal.get(t.dataset.id); if (j) abrirNota(j); },
      editarNota(ev, t) { const j = game.journal.get(t.dataset.id); if (j?.isOwner) editarNota(j); },
      apagarNota(ev, t) { const j = game.journal.get(t.dataset.id); if (j?.isOwner) apagarNota(j); },
      acoesNota(ev, t) { const j = game.journal.get(t.dataset.id); if (j && game.user.isGM) ferr("dialogoAcoesNota", j); },
      tirarNota(ev, t) { const j = game.journal.get(t.dataset.id); if (j?.isOwner) j.unsetFlag(MOD, "nota"); },
      irDia() { irPara(this.sel); },
      async usarNaCena() { await escolherCalendarioDaCena(); },
      diaSagrado() { ferr("dialogoDiaSagrado"); },
      historico() { abrirFerramenta("JanelaHistorico"); },
      linhaDoTempo() { try { game.modules.get(JOURNAL).api.linhaDoTempo(this.sel); } catch (err) { relatarErro(T("Tempo.linha_do_tempo_do_journal_da"), err); } },
      contadores() { abrirFerramenta("JanelaContadores"); },
      editor() { abrirFerramenta("EditorCalendario"); }
    }
  };

  /** O título passa pela tradução na hora de abrir (as opções da classe são lidas antes de o Foundry carregar lang/). */
  get title() { return T("Comum.calendario"); }

  static abrir(td = null) {
    let app = foundry.applications.instances.get("cm-calendario");
    if (app) app.irParaHoje(td == null);
    else app = new JanelaCalendario();
    if (td != null && Number.isFinite(td)) { const i = infoDia(td); app.sel = td; app.ano = i.ano; app.mes = i.mes; }
    // Só traz para a frente se a janela já estava na tela; uma janela nova ainda não tem elemento
    // (o render é assíncrono) e já abre na frente sozinha.
    const jaAberta = app.rendered;
    app.render({ force: true });
    if (jaAberta) app.bringToFront?.();
    return app;
  }

  constructor(opts = {}) {
    super(opts);
    const a = agora();
    this.ano = a.ano; this.mes = a.mes; this.sel = a.td;
  }

  /** Mostra o ano (interno) pedido, no mesmo mês (ou no mais próximo que existir nele), e fecha o painel de anos. */
  irParaAno(ano) {
    if (!Number.isFinite(ano)) return;
    this.ano = Math.trunc(ano);
    this.anosInicio = null;
    this.mudarMes(0);
  }

  /** Ano digitado no painel: o número exibido do mundo (com o primeiro ano do calendário, ex.: 1023). */
  irParaAnoDigitado() {
    const v = String(this.element?.querySelector(".cm-anos-campo")?.value ?? "").trim();
    if (v === "" || !Number.isFinite(Number(v))) return ui.notifications.warn(T("Tempo.digite_um_ano"));
    this.irParaAno(Math.trunc(Number(v)) - CFG.anoInicial);
  }

  /** Painel para escolher o ano: 12 anos por página, setas para voltar e avançar 12 anos e um campo para digitar. */
  painelAnos(hojeAno) {
    if (this.anosInicio == null) return "";
    const ini = this.anosInicio, fim = ini + ANOS_POR_PAGINA - 1;
    const anos = Array.from({ length: ANOS_POR_PAGINA }, (_, i) => ini + i).map((y) => {
      const classes = [y === this.ano ? "cm-ano-visto" : "", y === hojeAno ? "cm-ano-hoje" : ""].join(" ").trim();
      return `<button type="button" class="${classes}" data-action="escolherAno" data-ano="${y}" data-tooltip="${y === hojeAno ? T("Tempo.ano_atual_do_jogo") : ""}">${esc(textoAno(y))}</button>`;
    }).join("");
    return `<div class="cm-anos">
            <div class="cm-anos-topo">
              <a data-action="paginaAnos" data-q="-1" data-tooltip="${T("Tempo.0_anos_antes", [ANOS_POR_PAGINA])}"><i class="fa-solid fa-angles-left"></i></a>
              <span>${esc(textoAno(ini))} – ${esc(textoAno(fim))}</span>
              <a data-action="paginaAnos" data-q="1" data-tooltip="${T("Tempo.0_anos_depois", [ANOS_POR_PAGINA])}"><i class="fa-solid fa-angles-right"></i></a>
            </div>
            <div class="cm-anos-grade">${anos}</div>
            <div class="cm-anos-ir">
              <label>${T("Tempo.ir_para_o_ano")} <input type="number" class="cm-anos-campo" step="1" value="${this.ano + CFG.anoInicial}"></label>
              <button type="button" data-action="irAno"><i class="fa-solid fa-arrow-right"></i> ${T("Tempo.ir")}</button>
            </div>
          </div>`;
  }

  irParaHoje(mover) {
    const a = agora();
    if (mover) { this.ano = a.ano; this.mes = a.mes; this.sel = a.td; }
    if (this.rendered) this.render();
  }

  mudarMes(q, renderizar = true) {
    const n = CFG.meses.length, passo = q === 0 ? 1 : Math.sign(q);
    let idx = this.ano * n + this.mes + q;
    for (let i = 0; i < 100000 && diasNoMes(Math.floor(idx / n), mod(idx, n)) === 0; i++) idx += passo;   // pula meses que não existem neste ano
    this.ano = Math.floor(idx / n);
    this.mes = mod(idx, n);
    this.sel = tdDe(this.ano, this.mes, Math.min(infoDia(this.sel).dia, diasNoMes(this.ano, this.mes) - 1));
    if (renderizar) this.render();
  }

  async _renderHTML() {
    if (this.mes >= CFG.meses.length) this.mes = 0;
    if (diasNoMes(this.ano, this.mes) === 0) this.mudarMes(0, false);
    const gm = game.user.isGM;
    const a = agora();
    const lista = notas();
    const total = diasNoMes(this.ano, this.mes);
    const td0 = tdDe(this.ano, this.mes, 0);
    const vazio = infoDia(td0).sem;
    const W = CFG.semana.length;

    // grade do mês
    let cel = "";
    for (let i = 0; i < vazio; i++) cel += `<div class="cm-cel cm-vazia"></div>`;
    for (let d = 0; d < total; d++) {
      const td = td0 + d;
      const doDia = notasDoDia(td, lista);
      const evLuas = eventosLuasDoDia(td);
      const marcas = luasNoCeu(td).map((l) => { const f = faseDe(l, td); return f.nova || f.cheia ? luaSVG(f.p, l.cor, 11) : ""; }).join("")
        + evLuas.map((e) => `<i class="fa-solid ${e.icone} cm-ev-lua cm-ev-${e.tipo}" style="color:${e.cor}" data-tooltip="${esc(textoEventoLua(e))}"></i>`).join("");
      const pontos = doDia.slice(0, 4).map(({ n }) => `<i class="fa-solid ${n.icone}" style="color:${n.cor}"></i>`).join("") + (doDia.length > 4 ? `<span>+${doDia.length - 4}</span>` : "");
      cel += `<div class="cm-cel ${td === a.td ? "cm-hoje" : ""} ${td === this.sel ? "cm-sel" : ""}" data-action="dia" data-td="${td}">
        <div class="cm-cel-topo"><span class="cm-num">${d + 1}</span><span class="cm-marcas">${marcas}</span></div>
        <div class="cm-pontos">${pontos}</div>
      </div>`;
    }
    const semanaHTML = CFG.semana.map((s) => `<div class="cm-dsem" title="${esc(s.nome)}">${esc(s.abrev)}</div>`).join("");

    // painel do dia selecionado
    const inf = infoDia(this.sel);
    const est = estacaoDe(inf.mes, inf.dia);
    const sol = solDe(inf.mes, inf.dia);
    const doSel = notasDoDia(this.sel, lista);
    const notaHTML = ({ j, n }) => `
      <li class="cm-nota" draggable="${j.isOwner}" data-id="${j.id}">
        <i class="fa-solid ${n.icone}" style="color:${n.cor}"></i>
        <a class="cm-nota-nome" data-action="abrirNota" data-id="${j.id}">${esc(j.name)}</a>
        <span class="cm-nota-info">${n.hora ? esc(n.hora) : ""}${n.repetir !== "nao" || n.duracao > 1 ? ` <i class="fa-solid fa-repeat" data-tooltip="${esc(descreverRepeticao(n))}"></i>` : ""}${n.duracao > 1 ? ` <span>${T("Tempo.dia_0_1", [this.sel - inicioQueCobre(n, this.sel) + 1, n.duracao])}</span>` : ""}${gm && j.ownership.default === 0 ? ` <i class="fa-solid fa-eye-slash" data-tooltip="${T("Comum.so_o_mestre_ve")}"></i>` : ""}</span>
        ${j.isOwner ? `<span class="cm-nota-acoes">
          <a data-action="editarNota" data-id="${j.id}" data-tooltip="${notasNoJournal() ? T("Tempo.editar_no_journal_da_mesa") : T("Tempo.editar")}"><i class="fa-solid fa-pen"></i></a>
          ${gm ? `<a data-action="acoesNota" data-id="${j.id}" class="${acoesDaNota(j) ? "cm-com-acao" : ""}" data-tooltip="${esc(T("Tempo.acoes_quando_chegar_a_hora_macro"))}"><i class="fa-solid fa-bolt"></i></a>` : ""}
          <a data-action="tirarNota" data-id="${j.id}" data-tooltip="${T("Tempo.tirar_do_calendario_mantem_o_diario")}"><i class="fa-solid fa-calendar-xmark"></i></a>
          <a data-action="apagarNota" data-id="${j.id}" data-tooltip="${T("Comum.apagar")}"><i class="fa-solid fa-trash"></i></a>
        </span>` : ""}
      </li>`;

    // próximos eventos
    const proximos = [];
    // todos os eventos dos próximos 30 dias (inclui os que já começaram e ainda estão acontecendo hoje)
    const JANELA = 30;
    for (let td = a.td; td <= a.td + JANELA; td++) {
      for (const x of lista) {
        if (comecaEm(x.n, td) || (td === a.td && inicioQueCobre(x.n, td) !== null)) proximos.push({ td, ...x });
      }
    }
    proximos.sort((p, q) => p.td - q.td || (p.n.hora || "99").localeCompare(q.n.hora || "99"));

    const luasHTML = CFG.luas.map((l) => {
      const v = visibilidadeLua(l, this.sel);
      if (!v.visivel) {
        if (!gm && !game.settings.get(MOD, "jogadoresVeemLuasOcultas")) return "";
        return `<div class="cm-lua-linha cm-lua-oculta"><i class="fa-regular fa-eye-slash"></i> <span><b>${esc(l.nome)}</b> ${T("Tempo.fora_do_ceu_volta_em_0", [textoFalta(v)])}</span></div>`;
      }
      const f = faseDe(l, this.sel);
      return `<div class="cm-lua-linha">${luaSVG(f.p, l.cor, 18)} <span><b>${esc(l.nome)}</b> · ${esc(f.nome)}${v.sempre ? "" : ` <small>${T("Tempo.some_em_0", [textoFalta(v)])}</small>`}</span></div>`;
    }).join("");

    return `
      <div class="cm-raiz cm-tema-${tema()}">
        <section class="cm-mes">
          <header class="cm-cab">
            <a data-action="ano" data-q="-1" data-tooltip="${T("Tempo.ano_anterior")}"><i class="fa-solid fa-angles-left"></i></a>
            <a data-action="mes" data-q="-1" data-tooltip="${T("Tempo.mes_anterior")}"><i class="fa-solid fa-angle-left"></i></a>
            <h2>${esc(CFG.meses[this.mes].nome)} <a class="cm-ano-link ${this.anosInicio != null ? "ativo" : ""}" data-action="anos" data-tooltip="${eraDoAno(this.ano) ? `${esc(eraDoAno(this.ano).nome)} · ` : ""}${T("Tempo.clique_para_escolher_o_ano")}">${esc(textoAno(this.ano))} <i class="fa-solid fa-caret-down"></i></a></h2>
            <a data-action="mes" data-q="1" data-tooltip="${T("Tempo.proximo_mes")}"><i class="fa-solid fa-angle-right"></i></a>
            <a data-action="ano" data-q="1" data-tooltip="${T("Tempo.proximo_ano")}"><i class="fa-solid fa-angles-right"></i></a>
            <button type="button" data-action="hoje"><i class="fa-solid fa-location-crosshairs"></i> ${T("Tempo.hoje")}</button>
            ${gm ? `<a data-action="editor" data-tooltip="${T("Tempo.editar_o_calendario")}"><i class="fa-solid fa-gear"></i></a>` : ""}
          </header>
          ${this.painelAnos(a.ano)}
          ${seletorCalendarios()}
          <div class="cm-grade" style="--w:${W}">${semanaHTML}${cel}</div>
          ${gm ? `<p class="cm-dica">${T("Tempo.arraste_um_diario_da_barra_lateral")}</p>` : ""}
        </section>
        <aside class="cm-lado">
          <div class="cm-bloco">
            <h3>${esc(textoData(inf))}</h3>
            <div class="cm-info">
              ${est ? `<span><i class="fa-solid ${esc(est.icone)}"></i> ${esc(est.nome)}</span>` : ""}
              <span><i class="fa-solid fa-sun"></i> ${textoHoraDec(sol.nascer)}</span>
              <span><i class="fa-solid fa-moon"></i> ${textoHoraDec(sol.por)}</span>
            </div>
            ${luasHTML}
            ${(() => {
              const ev = eventosLuasDoDia(this.sel);
              const prox = proximosEventosLuas(a.td, 180, 4).filter((e) => e.td !== this.sel || !ev.length);
              if (!ev.length && !prox.length) return "";
              return `<div class="cm-ev-luas">
                ${ev.map((e) => `<div class="cm-ev-linha cm-ev-${e.tipo}"><i class="fa-solid ${e.icone}" style="color:${e.cor}"></i> <b>${esc(textoEventoLua(e))}</b></div>`).join("")}
                ${prox.length ? `<small class="cm-ev-titulo">${T("Tempo.proximos_no_ceu")}</small>${prox.map((e) => `<a class="cm-ev-prox" data-action="dia" data-td="${e.td}"><i class="fa-solid ${e.icone}" style="color:${e.cor}"></i> ${esc(textoEventoLua(e))} <span>${e.td === a.td ? T("Comum.hoje") : T("Comum.em_n_dias", { n: e.td - a.td })}</span></a>`).join("")}` : ""}
              </div>`;
            })()}
          </div>
          <div class="cm-bloco">
            <div class="cm-bloco-cab"><h4>${T("Tempo.notas_do_dia")}</h4>
              ${podeCriarNota() ? `<button type="button" data-action="novaNota" data-tooltip="${notasNoJournal() ? T("Tempo.cria_a_nota_e_abre_no") : T("Tempo.criar_uma_nota_neste_dia")}"><i class="fa-solid fa-plus"></i> ${T("Comum.nova_nota")}</button>` : ""}
            </div>
            ${doSel.length ? `<ul class="cm-notas">${doSel.map(notaHTML).join("")}</ul>` : `<p class="cm-vazio">${T("Tempo.nada_marcado_neste_dia")}</p>`}
            ${gm && this.sel !== a.td ? `<button type="button" class="cm-largo" data-action="irDia"><i class="fa-solid fa-calendar-check"></i> ${T("Tempo.tornar_este_o_dia_atual")}</button>` : ""}
          </div>
          ${lojasHTML()}
          ${gm || game.settings.get(MOD, "historicoJogadores") ? `<div class="cm-bloco cm-ferramentas">
            ${gm ? `<button type="button" data-action="diaSagrado"><i class="fa-solid fa-hands-praying"></i> ${T("Comum.dia_sagrado")}</button>
            <button type="button" data-action="contadores"><i class="fa-solid fa-hourglass-half"></i> ${T("Tempo.contadores")}</button>` : ""}
            <button type="button" data-action="historico"><i class="fa-solid fa-scroll"></i> ${T("Comum.historico")}</button>
            ${linhaDoJournal() ? `<button type="button" data-action="linhaDoTempo" data-tooltip="${T("Tempo.abre_a_linha_do_tempo_do")}"><i class="fa-solid fa-timeline"></i> ${T("Tempo.linha_do_tempo")}</button>` : ""}
          </div>` : linhaDoJournal() ? `<div class="cm-bloco cm-ferramentas"><button type="button" data-action="linhaDoTempo" data-tooltip="${T("Tempo.abre_a_linha_do_tempo_do")}"><i class="fa-solid fa-timeline"></i> ${T("Tempo.linha_do_tempo")}</button></div>` : ""}
          <div class="cm-bloco">
            <h4>${T("Tempo.proximos_30_dias")} <small>(${proximos.length})</small></h4>
            ${proximos.length ? `<ul class="cm-proximos">${proximos.map((p) => `
              <li><i class="fa-solid ${p.n.icone}" style="color:${p.n.cor}"></i>
                <a data-action="abrirNota" data-id="${p.j.id}">${esc(p.j.name)}</a>
                <a class="cm-quando" data-action="dia" data-td="${p.td}">${p.td === a.td ? T("Comum.hoje") : p.td === a.td + 1 ? T("Tempo.amanha") : `${T("Tempo.em_0_dias_1", [p.td - a.td, esc(textoData(infoDia(p.td), { semana: false, ano: false }))])}`}${p.n.hora ? ` · ${esc(p.n.hora)}` : ""}</a></li>`).join("")}</ul>`
              : `<p class="cm-vazio">${T("Tempo.nenhum_evento_nos_proximos_30_dias")}</p>`}
          </div>
        </aside>
      </div>`;
  }

  _replaceHTML(html, content) {
    content.innerHTML = html;
    // painel de anos: Enter vai para o ano digitado, Esc fecha
    const campoAno = content.querySelector(".cm-anos-campo");
    campoAno?.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") { ev.preventDefault(); this.irParaAnoDigitado(); }
      else if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); this.anosInicio = null; this.render(); }
    });
    content.querySelector("select.cm-ver-como")?.addEventListener("change", async (ev) => {
      await game.settings.set(MOD, "calendarioVisto", ev.target.value);
      this.irParaHoje(true);
    });
    content.querySelectorAll(".cm-nota[draggable=true]").forEach((li) => li.addEventListener("dragstart", (ev) => {
      ev.dataTransfer.setData("text/plain", JSON.stringify({ type: "cm-nota", id: li.dataset.id }));
    }));
    content.querySelectorAll(".cm-cel[data-td]").forEach((c) => {
      c.addEventListener("dragover", (ev) => { ev.preventDefault(); c.classList.add("cm-alvo"); });
      c.addEventListener("dragleave", () => c.classList.remove("cm-alvo"));
      c.addEventListener("drop", (ev) => { ev.preventDefault(); c.classList.remove("cm-alvo"); this.soltar(ev, num(c.dataset.td)); });
    });
  }

  async soltar(ev, td) {
    let d;
    try { d = JSON.parse(ev.dataTransfer.getData("text/plain")); } catch { return; }
    let j = null;
    if (d?.type === "cm-nota") j = game.journal.get(d.id);
    else if (d?.type === "JournalEntry") j = await fromUuid(d.uuid);
    else if (d?.type === "JournalEntryPage") j = (await fromUuid(d.uuid))?.parent ?? null;
    if (!j || j.documentName !== "JournalEntry") return;
    if (!j.isOwner) return ui.notifications.warn(T("Tempo.voce_nao_pode_mudar_esse_diario"));
    if (j.getFlag(MOD, "nota")) await j.update({ [`flags.${MOD}.nota.td`]: td });
    else await j.update({ [`flags.${MOD}.nota`]: notaNova(td, { icone: "fa-scroll" }) });
    this.sel = td;
  }
}

/* ---------------- registro ---------------- */

function rerenderJanelas() {
  limparCache();
  HUD.render();
  foundry.applications.instances.get("cm-calendario")?.render();
}

export {
  HUD,
  JanelaCalendario,
  rerenderJanelas
};
