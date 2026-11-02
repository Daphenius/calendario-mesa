/* =========================================================
 * Calendário da Mesa — Viagem
 * Estado da viagem dia a dia, escolha das vigias e o painel das vigias na tela.
 * ========================================================= */

import { textoRelogio } from "./datas.js";
import { CFG, esc, MOD, naFila, num, segHora, segundoDoDia, souGMPrincipal, T, tema } from "./nucleo.js";
import { ferr } from "./sob-demanda.js";
import { enviarSocket } from "./socket.js";

/* ---------------- viagem dia a dia e vigias ----------------
 * O estado da viagem fica no setting "viagem" (mundo). Quem muda é o mestre principal, sempre pela fila.
 *   fase: "viajando" (andando no dia) · "escolha" (jogadores escolhem a vigia) · "vigias" (vigias correndo)
 *         · "noite" (vigias terminadas, esperando o amanhecer)
 *   vigias: { n, participantes: [userIds], escolhas: { userId: índice }, atual, inicio (wt) }
 * Cada vigia dura 2 horas do calendário. O painel abaixo aparece na tela de todos. */

const DURACAO_VIGIA_H = 2;
const segVigia = () => DURACAO_VIGIA_H * segHora();
const viagemAtual = () => { const v = game.settings.get(MOD, "viagem"); return v?.ativa ? v : null; };

function alterarViagem(fn) {
  return naFila("viagem", async () => {
    const v = foundry.utils.deepClone(game.settings.get(MOD, "viagem") ?? {});
    const r = await fn(v);
    if (r === false) return v;
    const final = r && typeof r === "object" ? r : v;
    await game.settings.set(MOD, "viagem", final);
    return final;
  });
}

/** Nome para mostrar de um jogador: "Personagem (Jogador)". */
function nomeDoJogador(userId) {
  const u = game.users.get(userId);
  if (!u) return "?";
  return u.character ? `${u.character.name} (${u.name})` : u.name;
}

/** Horário (HH:MM) do início e do fim da vigia i. */
function horarioVigia(vigias, i) {
  const ini = num(vigias.inicio, game.time.worldTime) + i * segVigia();
  const hhmm = (t) => textoRelogio(segundoDoDia(t)).slice(0, 5);
  return `${hhmm(ini)}–${hhmm(ini + segVigia())}`;
}

/** Quem ficou em cada vigia: [[userIds da 1ª], [da 2ª], ...]. */
function gruposDaVigia(vigias) {
  const g = Array.from({ length: num(vigias?.n, 0) }, () => []);
  for (const [uid, i] of Object.entries(vigias?.escolhas ?? {})) if (g[i] && (vigias.participantes ?? []).includes(uid)) g[i].push(uid);
  return g;
}

/** Mestre: grava a vigia escolhida por um jogador (pedido do próprio jogador ou do mestre). */
function escolherVigia(userId, indice) {
  if (!souGMPrincipal()) return;
  return alterarViagem((v) => {
    const vg = v?.vigias;
    if (!v?.ativa || v.fase !== "escolha" || !vg) return false;
    if (!game.users.get(userId) || !(vg.participantes ?? []).includes(userId)) return false;
    vg.escolhas ??= {};
    if (indice == null || indice === "") delete vg.escolhas[userId];
    else {
      const i = Math.trunc(Number(indice));
      if (!(i >= 0 && i < vg.n)) return false;
      vg.escolhas[userId] = i;
    }
    return v;
  });
}

/** Jogador (ou mestre) clicou numa vigia no painel. */
function pedirVigia(indice) {
  if (game.user.isGM && souGMPrincipal()) return escolherVigia(game.user.id, indice);
  if (!game.users.activeGM) return ui.notifications.warn(T("Viagem.o_mestre_precisa_estar_online_para"));
  enviarSocket("vigiaEscolher", { userId: game.user.id, vigia: indice });
}

/** Painel das vigias na tela de todos (escolha e vigia em andamento). */
const PainelVigia = {
  el: null,
  render() {
    let v = null;
    try { v = viagemAtual(); } catch { v = null; }
    const vg = v?.vigias;
    if (!CFG || !v || !vg || !["escolha", "vigias"].includes(v.fase)) { this.el?.remove(); this.el = null; return; }
    if (!this.el) {
      this.el = document.createElement("div");
      this.el.id = "cm-vigia";
      document.body.append(this.el);
      this.el.addEventListener("click", (ev) => {
        const b = ev.target.closest("[data-vigia-acao]");
        if (!b) return;
        ev.preventDefault();
        const acao = b.dataset.vigiaAcao;
        if (acao === "escolher") return pedirVigia(b.dataset.i);
        if (acao === "sair") return pedirVigia(null);
        if (acao === "minimizar") { this.min = !this.min; return this.render(); }
        if (game.user.isGM) ferr("acaoViagem", acao);
      });
    }
    const gm = game.user.isGM;
    const grupos = gruposDaVigia(vg);
    const souParticipante = (vg.participantes ?? []).includes(game.user.id);
    const minha = vg.escolhas?.[game.user.id];
    const nomes = (ids) => ids.length ? ids.map((id) => `<span class="cm-vg-nome">${esc(nomeDoJogador(id))}</span>`).join("") : `<span class="cm-vg-vazio">${T("Viagem.ninguem")}</span>`;
    let corpo = "";
    if (v.fase === "escolha") {
      const faltam = (vg.participantes ?? []).filter((id) => vg.escolhas?.[id] == null);
      corpo = `<div class="cm-vg-sub">${souParticipante ? T("Viagem.escolha_em_qual_vigia_voce_fica") : T("Viagem.os_jogadores_estao_escolhendo_as_vigias")}</div>
        <ol class="cm-vg-lista">${grupos.map((ids, i) => `<li class="${minha === i ? "cm-vg-minha" : ""}">
          <div class="cm-vg-cab"><b>${T("Viagem.0_vigia", [i + 1])}</b><small>${esc(horarioVigia(vg, i))}</small></div>
          <div class="cm-vg-nomes">${nomes(ids)}</div>
          ${souParticipante ? (minha === i
            ? `<button type="button" data-vigia-acao="sair" class="cm-vg-btn">${T("Viagem.sair")}</button>`
            : `<button type="button" data-vigia-acao="escolher" data-i="${i}" class="cm-vg-btn">${T("Viagem.ficar_nesta")}</button>`) : ""}
        </li>`).join("")}</ol>
        ${faltam.length ? `<div class="cm-vg-falta"><i class="fa-solid fa-hourglass-half"></i> ${T("Viagem.ainda_nao_escolheram_0", [faltam.map((id) => esc(nomeDoJogador(id))).join(", ")])}</div>` : `<div class="cm-vg-falta pronto"><i class="fa-solid fa-check"></i> ${T("Viagem.todos_escolheram")}</div>`}
        ${gm ? `<div class="cm-vg-gm"><button type="button" data-vigia-acao="comecarVigias"><i class="fa-solid fa-play"></i> ${T("Viagem.comecar_as_vigias")}</button></div>` : ""}`;
    } else {
      const i = num(vg.atual, 0);
      const ultima = i >= vg.n - 1;
      corpo = `<div class="cm-vg-agora">
          <div class="cm-vg-num">${T("Viagem.0_vigia", [i + 1])} <small>${T("Viagem.de_0", [vg.n])}</small></div>
          <div class="cm-vg-hora"><i class="fa-solid fa-moon"></i> ${esc(horarioVigia(vg, i))}</div>
          <div class="cm-vg-nomes grande">${nomes(grupos[i] ?? [])}</div>
        </div>
        ${!ultima ? `<div class="cm-vg-prox">${T("Viagem.depois_0_1", [(grupos[i + 1] ?? []).map((id) => esc(nomeDoJogador(id))).join(", ") || T("Viagem.ninguem"), esc(horarioVigia(vg, i + 1))])}</div>` : ""}
        ${gm ? `<div class="cm-vg-gm"><button type="button" data-vigia-acao="proximaVigia"><i class="fa-solid fa-forward"></i> ${ultima ? T("Viagem.terminar_a_ultima_vigia") : T("Viagem.proxima_vigia_2_h")}</button></div>` : ""}`;
    }
    this.el.className = `cm-tema-${tema()} ${this.min ? "cm-vg-min" : ""}`;
    this.el.innerHTML = `<header><i class="fa-solid fa-campground"></i><span>${T("Viagem.vigias_0_dia_1", [v.destino ? ` ${T("Viagem.a_caminho_de_0", [esc(v.destino)])}` : "", num(v.dia, 1)])}</span>
        <a data-vigia-acao="minimizar" data-tooltip="${this.min ? T("Viagem.mostrar") : T("Viagem.minimizar")}"><i class="fa-solid ${this.min ? "fa-chevron-down" : "fa-chevron-up"}"></i></a></header>
      ${this.min ? "" : corpo}`;
  }
};

export {
  alterarViagem,
  DURACAO_VIGIA_H,
  escolherVigia,
  gruposDaVigia,
  horarioVigia,
  nomeDoJogador,
  PainelVigia,
  segVigia,
  viagemAtual
};
