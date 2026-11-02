/* =========================================================
 * Calendário da Mesa — Janela da viagem
 * Começar viagem, encontros do dia, vigias da noite e a janela da viagem.
 * ========================================================= */

import { agora, duracaoTexto, periodoDe, textoData, textoHoraDec, textoRelogio } from "../datas.js";
import { tabelasDeEncontro } from "./configuracoes.js";
import { registrar } from "../historico.js";
import { CFG, chat, Dialogo, diaTotalDe, esc, idsGM, num, opcoes, pad, relatarErro, segDia, segHora, segundoDoDia, T, tema } from "../nucleo.js";
import { avancar } from "../relogio.js";
import { alterarViagem, DURACAO_VIGIA_H, escolherVigia, gruposDaVigia, horarioVigia, nomeDoJogador, segVigia, viagemAtual } from "../viagem.js";

const { ApplicationV2 } = foundry.applications.api;

const RITMOS = { lento: { nome: T("Tabelas.lento_furtivo"), km: 3.2, mi: 2 }, normal: { nome: T("Comum.normal"), km: 4.8, mi: 3 }, rapido: { nome: T("Tabelas.rapido_5_em_percepcao_passiva"), km: 6.4, mi: 4 } };

async function dialogoViagem() {
  if (!game.user.isGM) return;
  if (viagemAtual()) return new JanelaViagem().render({ force: true });
  const tabelas = tabelasDeEncontro();
  const r = await Dialogo().wait({
    window: { title: "CALMESA.Comum.viajar", icon: "fa-solid fa-route" },
    position: { width: 480 },
    content: `<div class="cm-form">
      <label>${T("Tabelas.destino_opcional")}<input type="text" name="destino" placeholder="${T("Tabelas.porto_de_tir_wara")}"></label>
      <div class="cm-form-2">
        <label>${T("Tabelas.distancia")}<input type="number" name="dist" min="0" step="0.5" value="30"></label>
        <label>${T("Comum.unidade")}<select name="un"><option value="km">${T("Tabelas.km")}</option><option value="mi">${T("Tabelas.milhas")}</option><option value="lg">${T("Tabelas.leguas_3_mi")}</option></select></label>
      </div>
      <div class="cm-form-2">
        <label>${T("Tabelas.ritmo")}<select name="ritmo">${opcoes(RITMOS, "normal", (v) => v.nome)}</select></label>
        <label>${T("Tabelas.horas_de_viagem_por_dia")}<input type="number" name="hd" min="1" max="${CFG.horasDia}" value="8"></label>
      </div>
      <div class="cm-form-2">
        <label>${T("Tabelas.chance_de_encontro_por_dia")}<input type="number" name="chance" min="0" max="100" value="0"></label>
        <label>${T("Tabelas.tabela_de_encontros")}<select name="tabela"><option value="">${T("Comum.nenhuma")}</option>${tabelas.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select>
          <small class="cm-dica-campo">${T("Tabelas.quais_aparecem_aqui_configuracoes_calendario_da")}</small></label>
      </div>
      <fieldset class="cm-rep"><legend><i class="fa-solid fa-campground"></i> ${T("Tabelas.dia_a_dia")}</legend>
        <label class="cm-chip"><input type="checkbox" name="separado"> ${T("Tabelas.passar_os_dias_separadamente_narracao_de")}</label>
        <div class="cm-form-2">
          <label>${T("Tabelas.partida_de_cada_dia_hh_mm")}<input type="text" name="saida" value="08:00" placeholder="08:00"></label>
          <label>${T("Tabelas.vigias_liberadas_a_partir_de_hh")}<input type="text" name="acamp" value="20:00" placeholder="20:00"></label>
        </div>
        <p class="cm-dica">${T("Tabelas.cada_dia_e_avancado_pelo_mestre")}</p>
      </fieldset>
      <p class="cm-dica">${T("Tabelas.sem_o_dia_a_dia_o")}</p>
    </div>`,
    buttons: [{ action: "ok", label: T("Tabelas.partir"), icon: "fa-solid fa-person-hiking", default: true, callback: (ev, btn) => Object.fromEntries(new FormData(btn.form)) }, { action: "cancelar", label: T("Comum.cancelar") }],
    rejectClose: false
  });
  if (!r || typeof r !== "object") return;
  const ritmo = RITMOS[r.ritmo] ?? RITMOS.normal;
  const vel = r.un === "km" ? ritmo.km : r.un === "lg" ? ritmo.mi / 3 : ritmo.mi;
  const horas = Math.max(0, num(r.dist, 0)) / vel;
  const hd = Math.min(Math.max(1, num(r.hd, 8)), CFG.horasDia);
  const un = { km: "km", mi: T("Tabelas.milhas"), lg: T("Tabelas.leguas") }[r.un] ?? "km";
  const destino = String(r.destino ?? "").trim();
  const chance = Math.min(100, Math.max(0, num(r.chance, 0)));
  if (r.separado) {
    return iniciarViagemSeparada({
      destino, dist: num(r.dist), un, ritmo: ritmo.nome.split(" ")[0], vel, horas, hd, chance, tabela: r.tabela || "",
      saida: horaParaDec(r.saida, 8), acampamento: horaParaDec(r.acamp, 20)
    });
  }
  const dias = Math.floor(horas / hd);
  let resto = horas - dias * hd;
  if (resto < 1e-6 && dias > 0) resto = 0;
  const seg = Math.round(dias * segDia() + resto * segHora());
  const tempo = `${dias ? (dias > 1 ? T("Comum.0_dias", [dias]) : T("Comum.1_dia")) : ""}${dias && resto ? T("Comum.e") : ""}${resto ? `${Math.floor(resto)}h${Math.round((resto % 1) * CFG.minutosHora) ? pad(Math.round((resto % 1) * CFG.minutosHora)) : ""}` : ""}` || T("Tabelas.nada");
  // encontros: um teste por dia (ou fração) de viagem
  const encontros = [];
  if (chance > 0) for (let d = 1; d <= Math.ceil(horas / hd); d++) if (Math.random() * 100 < chance) encontros.push(d);
  await chat(`<i class="fa-solid fa-route"></i> <b>${T("Tabelas.viagem_0", [destino ? ` ${T("Tabelas.ate_0", [esc(destino)])}` : ""])}</b>${T("Tabelas.0_1_em_ritmo_2_3", [num(r.dist), un, esc(ritmo.nome.split(" ")[0].toLowerCase()), tempo])}`);
  if (chance > 0) await chat(`<i class="fa-solid fa-dragon"></i> ${T("Tabelas.encontros_na_viagem_0", [encontros.length ? encontros.map((d) => T("Tabelas.dia_0", [d])).join(", ") : T("Tabelas.nenhum")])}`, idsGM());
  const tabela = r.tabela ? game.tables.get(r.tabela) : null;
  if (tabela) for (const _ of encontros) await tabela.draw({ rollMode: "gmroll" });
  await registrar(`${T("Tabelas.viagem_0_1_2_3_4", [destino ? ` ${T("Tabelas.ate_0", [destino])}` : "", num(r.dist), un, tempo, encontros.length ? T("Comum.0_encontro_s", [encontros.length]) : ""])}`, { icone: "fa-route" });
  if (seg > 0) await game.time.advance(seg);
}

/* ---------- viagem dia a dia ---------- */

/** "20:30" → 20.5 (no calendário em uso); vazio ou inválido → padrão. */
function horaParaDec(texto, padrao) {
  const m = String(texto ?? "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return Math.min(padrao, CFG.horasDia - 1);
  return Math.min(num(m[1]), CFG.horasDia - 1) + Math.min(num(m[2]), CFG.minutosHora - 1) / CFG.minutosHora;
}

/** Próximo instante depois de `desde` em que o relógio marca a hora pedida. */
function proximoHorario(desde, horaDec) {
  const alvo = Math.round(horaDec * segHora());
  let t = diaTotalDe(desde) * segDia() + alvo;
  if (t <= desde) t += segDia();
  return t;
}

const hhmm = (t) => textoRelogio(segundoDoDia(t)).slice(0, 5);

async function iniciarViagemSeparada(p) {
  if (viagemAtual()) return ui.notifications.warn(T("Viagem.ja_ha_uma_viagem_em_andamento"));
  const wt = game.time.worldTime;
  const diasTotal = Math.max(1, Math.ceil(p.horas / p.hd - 1e-9));
  const estado = {
    ativa: true, id: foundry.utils.randomID(), destino: p.destino, dist: p.dist, un: p.un, ritmo: p.ritmo,
    vel: p.vel, hd: p.hd, diasTotal, dia: 1, saida: p.saida, acampamento: p.acampamento,
    chance: p.chance, tabela: p.tabela, encontros: [], inicioWt: wt,
    alvoAcampamento: proximoHorario(wt, p.acampamento), fase: "viajando", vigias: null, historicoVigias: []
  };
  await alterarViagem(() => estado);
  await chat(`<i class="fa-solid fa-route"></i> <b>${T("Viagem.o_grupo_parte_0", [p.destino ? T("Viagem.rumo_a_0", [esc(p.destino)]) : ""])}</b>${T("Viagem.0_1_em_ritmo_2_cerca", [p.dist, esc(p.un), esc(p.ritmo.toLowerCase()), diasTotal, diasTotal > 1 ? "s" : ""])}`);
  await registrar(`${T("Viagem.partida_0_1_2_cerca_de", [p.destino ? T("Viagem.para_0", [p.destino]) : "", p.dist, p.un, diasTotal])}`, { icone: "fa-route" });
  await rolarEncontroDoDia();
  return new JanelaViagem().render({ force: true });
}

/** Teste de encontro do dia atual da viagem (aviso só para o mestre). */
async function rolarEncontroDoDia() {
  const v = viagemAtual();
  if (!v || !(v.chance > 0)) return;
  if (Math.random() * 100 >= v.chance) return;
  await alterarViagem((x) => { (x.encontros ??= []).push(x.dia); });
  await chat(`<i class="fa-solid fa-dragon"></i> <b>${T("Viagem.encontro_hoje")}</b> ${T("Viagem.dia_0_da_viagem_1", [v.dia, v.destino ? T("Viagem.para_0", [esc(v.destino)]) : ""])}`, idsGM());
  const tabela = v.tabela ? game.tables.get(v.tabela) : null;
  if (tabela) await tabela.draw({ rollMode: "gmroll" });
}

async function avancarPara(alvo) {
  const d = Math.round(alvo - game.time.worldTime);
  if (d > 0) await game.time.advance(d);
}

/** Janela do mestre: montar as vigias da noite. */
async function dialogoVigias() {
  const v = viagemAtual();
  if (!v || !game.user.isGM) return;
  const jogadores = game.users.filter((u) => !u.isGM);
  if (!jogadores.length) return ui.notifications.warn(T("Viagem.nao_ha_jogadores_cadastrados_no_mundo"));
  const r = await Dialogo().wait({
    window: { title: "CALMESA.Viagem.vigias_da_noite", icon: "fa-solid fa-campground" },
    position: { width: 440 },
    content: `<div class="cm-form">
      <label>${T("Viagem.quantas_vigias_0_horas_cada", [DURACAO_VIGIA_H])}<input type="number" name="n" min="1" max="12" value="4"></label>
      <p class="cm-dica">${T("Viagem.a_partir_de_agora_0_quem", [esc(hhmm(game.time.worldTime))])}</p>
      <div class="cm-vg-escolher">${jogadores.map((u) => `<label class="cm-chip"><input type="checkbox" name="u-${u.id}" ${u.active || u.character ? "checked" : ""}> ${esc(nomeDoJogador(u.id))}${u.active ? "" : ` <small>${T("Viagem.offline")}</small>`}</label>`).join("")}</div>
    </div>`,
    buttons: [{ action: "ok", label: T("Comum.mostrar_aos_jogadores"), icon: "fa-solid fa-eye", default: true, callback: (ev, btn) => Object.fromEntries(new FormData(btn.form)) }, { action: "cancelar", label: T("Comum.cancelar") }],
    rejectClose: false
  });
  if (!r || typeof r !== "object") return;
  const participantes = jogadores.filter((u) => r[`u-${u.id}`]).map((u) => u.id);
  if (!participantes.length) return ui.notifications.warn(T("Viagem.escolha_pelo_menos_um_jogador_para"));
  const n = Math.min(12, Math.max(1, Math.trunc(num(r.n, 4))));
  await alterarViagem((x) => {
    if (!x.ativa) return false;
    x.fase = "escolha";
    x.vigias = { n, participantes, escolhas: {}, atual: -1, inicio: game.time.worldTime };
  });
  await chat(`<i class="fa-solid fa-campground"></i> <b>${T("Viagem.o_grupo_monta_acampamento")}</b> ${T("Viagem.0_vigia_1_de_2_horas", [n, n > 1 ? "s" : "", DURACAO_VIGIA_H, participantes.map((id) => esc(nomeDoJogador(id))).join(", ")])}`);
}

/** Ações do mestre na viagem (janela e painel das vigias). */
async function acaoViagem(acao, dado = null) {
  if (!game.user.isGM) return;
  const v = viagemAtual();
  if (!v) return;
  const agoraT = game.time.worldTime;
  switch (acao) {
    case "hora": return avancar(segHora());
    case "meiaHora": return avancar(segHora() / 2);
    case "acampamento": return v.alvoAcampamento > agoraT ? avancarPara(v.alvoAcampamento) : null;
    case "vigias":
      if (agoraT < v.alvoAcampamento) return ui.notifications.warn(T("Viagem.as_vigias_liberam_as_0", [hhmm(v.alvoAcampamento)]));
      return dialogoVigias();
    case "atribuir": return escolherVigia(dado?.userId, dado?.vigia);
    case "cancelarVigias": return alterarViagem((x) => { x.fase = "viajando"; x.vigias = null; });
    case "comecarVigias": {
      if (v.fase !== "escolha") return;
      await alterarViagem((x) => { x.fase = "vigias"; x.vigias.atual = 0; x.vigias.inicio = game.time.worldTime; });
      const g = gruposDaVigia(viagemAtual().vigias);
      return chat(`<i class="fa-solid fa-moon"></i> <b>${T("Viagem.vigias_da_noite")}</b><ol>${g.map((ids, i) => `<li>${esc(horarioVigia(viagemAtual().vigias, i))}: ${ids.map((id) => esc(nomeDoJogador(id))).join(", ") || T("Viagem.ninguem")}</li>`).join("")}</ol>`);
    }
    case "proximaVigia": {
      if (v.fase !== "vigias") return;
      const ultima = v.vigias.atual >= v.vigias.n - 1;
      if (!ultima) {
        await alterarViagem((x) => { x.vigias.atual += 1; });
        return avancar(segVigia());
      }
      const g = gruposDaVigia(v.vigias);
      const resumo = g.map((ids, i) => `${i + 1}ª ${ids.map(nomeDoJogador).join(", ") || T("Viagem.ninguem")}`).join("; ");
      await alterarViagem((x) => { x.fase = "noite"; (x.historicoVigias ??= []).push({ dia: x.dia, grupos: g }); x.vigias = null; });
      await registrar(`${T("Viagem.vigias_dia_0_da_viagem_1", [v.dia, resumo])}`, { icone: "fa-campground" });
      return avancar(segVigia());
    }
    case "amanhecer": {
      if (!["viajando", "noite"].includes(v.fase)) return;
      if (v.dia >= v.diasTotal) return acaoViagem("chegar");
      const alvo = proximoHorario(agoraT, v.saida);
      await alterarViagem((x) => { x.dia += 1; x.fase = "viajando"; x.vigias = null; x.alvoAcampamento = proximoHorario(alvo, x.acampamento); });
      await avancarPara(alvo);
      const nv = viagemAtual();
      await chat(`<i class="fa-solid fa-sun"></i> <b>${T("Viagem.dia_0_de_viagem", [nv.dia])}</b>${T("Viagem.0_o_grupo_levanta_acampamento", [nv.destino ? T("Viagem.rumo_a_0", [esc(nv.destino)]) : ""])}`);
      return rolarEncontroDoDia();
    }
    case "chegar": {
      await alterarViagem(() => ({ ativa: false }));
      await chat(`<i class="fa-solid fa-flag-checkered"></i> <b>${T("Viagem.o_grupo_chega_0", [v.destino ? T("Viagem.a_0", [esc(v.destino)]) : T("Viagem.ao_destino")])}</b> ${T("Viagem.depois_de_0_dia_1_de", [v.dia, v.dia > 1 ? "s" : ""])}`);
      await registrar(`${T("Viagem.chegada_0_1_dia_s_de", [v.destino ? T("Viagem.a_0", [v.destino]) : "", v.dia, v.encontros?.length ? T("Comum.0_encontro_s", [v.encontros.length]) : ""])}`, { icone: "fa-route" });
      foundry.applications.instances.get("cm-viagem")?.close();
      return;
    }
    case "cancelar": {
      const ok = await Dialogo().confirm({ window: { title: "CALMESA.Viagem.encerrar_viagem" }, content: `<p>${T("Viagem.encerrar_a_viagem_agora_o_tempo")}</p>` });
      if (!ok) return;
      await alterarViagem(() => ({ ativa: false }));
      await registrar(`${T("Viagem.viagem_interrompida_no_dia_0_1", [v.dia, v.destino ? T("Viagem.destino_0", [v.destino]) : ""])}`, { icone: "fa-route" });
      foundry.applications.instances.get("cm-viagem")?.close();
      return;
    }
    case "narrar": {
      const texto = String(dado ?? "").trim();
      if (!texto) return;
      await chat(`<div class="cm-narracao"><i class="fa-solid fa-feather"></i> ${esc(texto).replace(/\n/g, "<br>")}</div>`);
      return registrar(`${T("Viagem.viagem_dia_0_1_2", [v.dia, hhmm(agoraT), texto])}`, { icone: "fa-feather" });
    }
  }
}

class JanelaViagem extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "cm-viagem",
    classes: ["cm-janela"],
    tag: "div",
    window: { title: "CALMESA.Viagem.viagem", icon: "fa-solid fa-route", resizable: true },
    position: { width: 520, height: "auto" },
    actions: {
      acao(ev, t) { acaoViagem(t.dataset.acao).catch((err) => relatarErro("Erros.viagem", err)); },
      narrar() {
        const ta = this.element.querySelector("textarea.cm-vg-narracao");
        const texto = ta?.value ?? "";
        if (ta) ta.value = "";
        acaoViagem("narrar", texto).catch((err) => relatarErro("Erros.viagem", err));
      }
    }
  };

  async _renderHTML() {
    const v = viagemAtual();
    if (!v) return `<div class="cm-raiz cm-editor cm-tema-${tema()}"><p class="cm-vazio">${T("Viagem.nenhuma_viagem_em_andamento")}</p></div>`;
    const wt = game.time.worldTime, a = agora();
    const per = periodoDe(a.horaDec, a.mes, a.dia);
    const btn = (acao, icone, rotulo, extra = "") => `<button type="button" data-action="acao" data-acao="${acao}" ${extra}><i class="fa-solid ${icone}"></i> ${rotulo}</button>`;
    const liberado = wt >= v.alvoAcampamento;
    const falta = v.alvoAcampamento - wt;
    const ultimoDia = v.dia >= v.diasTotal;
    const kmDia = Math.round(v.vel * v.hd * 10) / 10;
    const pct = Math.min(100, Math.round(((v.dia - 1) / v.diasTotal) * 100));
    let fase = "";
    if (v.fase === "viajando") {
      fase = `<div class="cm-ed-cals-linha">
          ${btn("meiaHora", "fa-forward-step", T("Viagem.30_min"))}${btn("hora", "fa-forward", T("Comum.1_hora"))}
          ${btn("acampamento", "fa-campground", `${T("Viagem.ate_as_0", [hhmm(v.alvoAcampamento)])}`, liberado ? "disabled" : "")}
        </div>
        <div class="cm-ed-cals-linha">
          ${btn("vigias", "fa-moon", T("Viagem.montar_as_vigias"), liberado ? "" : `disabled data-tooltip="${T("Viagem.libera_as_0", [hhmm(v.alvoAcampamento)])}"`)}
          ${liberado ? "" : `<span class="cm-dica">${T("Viagem.libera_as_0_falta_1", [esc(hhmm(v.alvoAcampamento)), esc(duracaoTexto(falta))])}</span>`}
          ${btn("amanhecer", ultimoDia ? "fa-flag-checkered" : "fa-sun", ultimoDia ? T("Viagem.chegar_ao_destino") : `${T("Viagem.pular_a_noite_sem_vigias")}`)}
        </div>`;
    } else if (v.fase === "escolha") {
      const vg = v.vigias;
      fase = `<p class="cm-dica">${T("Viagem.os_jogadores_estao_escolhendo_as_vigias_2")}</p>
        <div class="cm-vg-atribuir">${vg.participantes.map((id) => `<label>${esc(nomeDoJogador(id))}
          <select data-vg-atribuir="${id}"><option value="">${T("Viagem.ainda_nao_escolheu")}</option>${Array.from({ length: vg.n }, (_, i) => `<option value="${i}" ${vg.escolhas?.[id] === i ? "selected" : ""}>${T("Viagem.0_vigia_1", [i + 1, esc(horarioVigia(vg, i))])}</option>`).join("")}</select></label>`).join("")}</div>
        <div class="cm-ed-cals-linha">${btn("comecarVigias", "fa-play", T("Viagem.comecar_as_vigias"))}${btn("cancelarVigias", "fa-xmark", T("Comum.desfazer"))}</div>`;
    } else if (v.fase === "vigias") {
      const vg = v.vigias, i = vg.atual;
      const g = gruposDaVigia(vg);
      fase = `<p><b>${T("Viagem.0_vigia_de_1", [i + 1, vg.n])}</b> · ${esc(horarioVigia(vg, i))} · ${(g[i] ?? []).map((id) => esc(nomeDoJogador(id))).join(", ") || T("Viagem.ninguem")}</p>
        <div class="cm-ed-cals-linha">${btn("proximaVigia", "fa-forward", i >= vg.n - 1 ? T("Viagem.terminar_a_ultima_vigia") : T("Viagem.proxima_vigia_2_h"))}</div>`;
    } else if (v.fase === "noite") {
      fase = `<p class="cm-dica">${T("Viagem.vigias_encerradas_0", [ultimoDia ? T("Viagem.ultimo_dia_o_grupo_pode_chegar") : `${T("Viagem.amanhece_as_0", [esc(textoHoraDec(v.saida))])}`])}</p>
        <div class="cm-ed-cals-linha">${btn("hora", "fa-forward", T("Comum.1_hora"))}${btn("amanhecer", ultimoDia ? "fa-flag-checkered" : "fa-sun", ultimoDia ? T("Viagem.chegar_ao_destino") : T("Viagem.seguir_viagem"))}</div>`;
    }
    return `<div class="cm-raiz cm-editor cm-viagem cm-tema-${tema()}">
      <h3><i class="fa-solid fa-route"></i> ${v.destino ? esc(v.destino) : T("Viagem.viagem")} <small>${T("Viagem.dia_0_de_1", [v.dia, v.diasTotal])}</small></h3>
      <div class="cm-barra"><span style="width:${pct}%"></span></div>
      <p class="cm-dica">${T("Viagem.0_1_2_ritmo_3_cerca", [esc(textoData(a)), esc(hhmm(wt)), esc(per.nome), esc(String(v.ritmo).toLowerCase()), kmDia, esc(v.un), v.hd, (v.encontros ?? []).includes(v.dia) ? ` · <b class="cm-aviso"><i class="fa-solid fa-dragon"></i> ${T("Viagem.encontro_hoje_2")}</b>` : ""])}</p>
      ${fase}
      <fieldset><legend><i class="fa-solid fa-feather"></i> ${T("Viagem.narracao_deste_momento")}</legend>
        <textarea class="cm-vg-narracao" rows="3" placeholder="${T("Viagem.o_que_o_grupo_ve_ouve")}"></textarea>
        <div class="cm-ed-rodape"><button type="button" data-action="narrar"><i class="fa-solid fa-comment"></i> ${T("Viagem.enviar_narracao")}</button></div>
      </fieldset>
      <footer class="cm-ed-fim"><span class="cm-esp"></span>${btn("cancelar", "fa-ban", T("Viagem.encerrar_a_viagem"))}</footer>
    </div>`;
  }

  _replaceHTML(html, content) {
    const antigo = content.querySelector("textarea.cm-vg-narracao");
    const rascunho = antigo?.value ?? "";
    const comFoco = !!antigo && document.activeElement === antigo;
    const cursor = comFoco ? antigo.selectionStart : null;
    content.innerHTML = html;
    // o relógio redesenha a janela a cada passo: o texto em digitação e o cursor continuam onde estavam
    const ta = content.querySelector("textarea.cm-vg-narracao");
    if (ta && rascunho) ta.value = rascunho;
    if (ta && comFoco) { ta.focus({ preventScroll: true }); try { ta.setSelectionRange(cursor, cursor); } catch { /* sem seleção */ } }
    content.querySelectorAll("[data-vg-atribuir]").forEach((sel) => sel.addEventListener("change", () => {
      acaoViagem("atribuir", { userId: sel.dataset.vgAtribuir, vigia: sel.value === "" ? null : Number(sel.value) }).catch((err) => relatarErro("Erros.viagem", err));
    }));
  }
}

export {
  acaoViagem,
  dialogoViagem,
  JanelaViagem
};
