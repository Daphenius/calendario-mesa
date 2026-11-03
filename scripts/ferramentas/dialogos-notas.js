/* =========================================================
 * Calendário da Mesa — Diálogos das notas
 * Criar e editar nota pelo calendário e as ações da nota.
 * ========================================================= */

import { agora, infoDia, textoData } from "../datas.js";
import { JanelaCalendario } from "../janela.js";
import { acoesDaNota, AVISOS, caminhoPasta, dadosNota, descreverRepeticao, executarAcoes, ICONES, ICONES_GRUPOS, iconeValido, MODOS_CENA, normalizarNota, notaNova, paginaDeEvento, pastaParaNota } from "../notas.js";
import { Dialogo, esc, MOD, num, T } from "../nucleo.js";

async function dialogoNota(td, j = null) {
  const n = j ? dadosNota(j) : normalizarNota({ td, hora: "", repetir: "nao", cada: 1, cor: "#c9a227", icone: "fa-star", aviso: "nenhum" });
  const gm = game.user.isGM;
  const verAtual = j ? (j.ownership.default >= 2 ? "todos" : j.ownership.default >= 1 ? "titulo" : "mestre") : (gm ? "mestre" : "todos");
  /* ícones em grupos, os mesmos do Journal da Mesa; um ícone fora da lista (gravado por outro módulo) continua escolhido */
  const opcoesIcone = (sel) => (sel && !ICONES[sel] ? `<option value="${esc(sel)}" selected>${esc(sel)}</option>` : "")
    + ICONES_GRUPOS.map(([g, l]) => `<optgroup label="${esc(T(g))}">${l.map(([k]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${esc(ICONES[k])}</option>`).join("")}</optgroup>`).join("");
  const opts = (obj, sel) => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${esc(v)}</option>`).join("");
  const ver = gm
    ? { mestre: T("Comum.so_o_mestre"), titulo: T("Importar.jogadores_veem_so_o_titulo"), todos: T("Importar.jogadores_veem_tudo") }
    : { mestre: T("Importar.so_eu_e_o_mestre"), todos: T("Importar.todos_os_jogadores") };

  const padrao = j ? (j.folder?.id ?? "") : game.settings.get(MOD, "pastaNotas");
  const pastas = game.folders.filter((f) => f.type === "JournalEntry" && !f.getFlag(MOD, "pasta"))
    .map((f) => ({ id: f.id, nome: caminhoPasta(f) })).sort((a, b) => a.nome.localeCompare(b.nome, game.i18n.lang));
  const seletorPasta = gm ? `
      <div class="cm-form-2">
        <label>${T("Importar.pasta_no_diario_journal")}<select name="pasta">
          <option value="" ${!padrao || !game.folders.get(padrao) ? "selected" : ""}>${T("Importar.calendario_padrao")}</option>
          ${pastas.map((f) => `<option value="${f.id}" ${f.id === padrao ? "selected" : ""}>${esc(f.nome)}</option>`).join("")}
          <option value="__nova">${T("Importar.nova_pasta")}</option>
        </select></label>
        <label>${T("Importar.nome_da_nova_pasta")}<input type="text" name="novaPasta" placeholder="${T("Importar.so_se_escolher_nova_pasta")}"></label>
      </div>` : "";

  const content = `
    <div class="cm-form">
      <p class="cm-form-data"><i class="fa-solid fa-calendar-day"></i> ${esc(textoData(infoDia(j ? n.td : td)))}</p>
      <label>${T("Importar.titulo")}<input type="text" name="nome" value="${esc(j?.name ?? "")}" placeholder="${T("Importar.festival_da_mare_prazo_da_missao")}" autofocus></label>
      <div class="cm-form-2">
        <label>${T("Importar.hora_opcional")}<input type="text" name="hora" value="${esc(n.hora)}" placeholder="${T("Comum.hh_mm")}"></label>
        <label>${T("Comum.dura_quantos_dias")}<input type="number" name="duracao" min="1" value="${n.duracao}"></label>
      </div>
      <div class="cm-form-2">
        <label>${T("Comum.icone")}<span class="cm-icone-escolha"><i class="fa-solid ${esc(n.icone)}" style="color:${n.cor}"></i><select name="icone">${opcoesIcone(n.icone)}</select></span></label>
      </div>
      <div class="cm-form-2">
        <label>${T("Comum.quem_ve")}<select name="ver">${opts(ver, verAtual)}</select></label>
        <label>${T("Comum.cor")}<input type="color" name="cor" value="${n.cor}"></label>
      </div>
      ${gm ? `<label>${T("Importar.quando_chegar_o_dia")}<select name="aviso">${opts(AVISOS, n.aviso)}</select></label>` : ""}
      ${seletorPasta}
      ${n.repetir !== "nao" ? `<p class="cm-dica"><i class="fa-solid fa-repeat"></i> ${T("Importar.0_a_repeticao_e_editada_no", [esc(descreverRepeticao(n))])}</p>` : ""}
      ${j ? `<p class="cm-dica">${T("Importar.para_editar_o_texto_abra_a")}</p>`
          : `<label>${T("Importar.texto")}<textarea name="texto" rows="4" placeholder="${T("Importar.detalhes_do_evento_opcional")}"></textarea></label>`}
    </div>`;

  const dados = await Dialogo().wait({
    window: { title: j ? T("Importar.editar_nota") : T("Comum.nova_nota"), icon: "fa-solid fa-calendar-plus" },
    position: { width: 500 },
    content,
    /* prévia do ícone ao lado da escolha (troca junto com o ícone e a cor) */
    render: (ev, dlg) => {
      const el = dlg?.element ?? dlg;
      const sel = el?.querySelector?.('select[name="icone"]'), cor = el?.querySelector?.('input[name="cor"]');
      const ico = el?.querySelector?.(".cm-icone-escolha i");
      if (!sel || !ico) return;
      sel.addEventListener("change", () => { ico.className = `fa-solid ${iconeValido(sel.value) ? sel.value : "fa-star"}`; });
      cor?.addEventListener("input", () => { ico.style.color = cor.value; });
    },
    buttons: [
      { action: "ok", label: T("Comum.salvar"), icon: "fa-solid fa-check", default: true, callback: (ev, btn) => Object.fromEntries(new FormData(btn.form)) },
      { action: "cancelar", label: T("Comum.cancelar"), icon: "fa-solid fa-xmark" }
    ],
    rejectClose: false
  });
  if (!dados || typeof dados !== "object") return;

  const nome = String(dados.nome ?? "").trim() || T("Importar.evento");
  const inicio = j ? n.td : td;
  // só os campos que o calendário edita; a repetição (repetir, cada...) é do Journal e nunca é regravada aqui
  const campos = {
    hora: /^\d{1,2}:\d{2}$/.test(String(dados.hora ?? "").trim()) ? String(dados.hora).trim() : "",
    duracao: Math.max(1, Math.trunc(num(dados.duracao, 1))),
    cor: dados.cor || "#c9a227",
    icone: iconeValido(dados.icone) ? dados.icone : "fa-star",
    aviso: gm ? (AVISOS[dados.aviso] ? dados.aviso : "nenhum") : (n.aviso ?? "nenhum")
  };
  const nivel = { mestre: 0, titulo: 1, todos: 2 }[dados.ver] ?? 0;

  if (j) {
    const upd = { name: nome, "ownership.default": nivel };
    for (const [k, v] of Object.entries(campos)) upd[`flags.${MOD}.nota.${k}`] = v;
    if (gm && (dados.pasta ?? "") !== (j.folder?.id ?? "") && !(dados.pasta === "" && j.folder?.getFlag(MOD, "pasta"))) {
      upd.folder = (await pastaParaNota(dados.pasta ?? "", String(dados.novaPasta ?? "").trim(), n.td))?.id ?? null;
    }
    await j.update(upd);
    return j;
  }
  const pasta = await pastaParaNota(dados.pasta ?? "", String(dados.novaPasta ?? "").trim(), td);
  const texto = String(dados.texto ?? "").trim();
  const ownership = { default: nivel };
  if (!gm) ownership[game.user.id] = 3;
  return JournalEntry.create({
    name: nome,
    folder: pasta?.id ?? null,
    ownership,
    flags: { [MOD]: { nota: notaNova(inicio, campos) } },
    pages: [paginaDeEvento(nome, texto ? texto.split(/\n+/).map((l) => `<p>${esc(l)}</p>`).join("") : "")]
  });
}

/* ---------------- ações das notas ---------------- */

async function dialogoAcoesNota(j) {
  if (!game.user.isGM || !j) return;
  const a = j.getFlag(MOD, "acoes") ?? {};
  const macros = [...(game.macros ?? [])].sort((x, y) => x.name.localeCompare(y.name));
  const cenas = [...(game.scenes ?? [])].sort((x, y) => x.name.localeCompare(y.name));
  const n = dadosNota(j);
  const quando = n ? `${textoData(infoDia(n.td))}${n.hora ? ` · ${n.hora}` : ` · ${T("Notas.a_meia_noite_sem_hora_marcada")}`}` : "";
  const content = `<div class="cm-form cm-acoes-nota">
    <p class="cm-form-data"><i class="fa-solid fa-bolt"></i> ${T("Notas.quando_b_nome_b_chegar_quando", { nome: esc(j.name), quando: esc(quando) })}</p>
    <label>${T("Notas.rodar_a_macro")}<select name="macro"><option value="">${T("Comum.nenhuma")}</option>${macros.map((m) => `<option value="${m.id}" ${a.macro === m.id || a.macro === m.uuid ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select></label>
    <div class="cm-form-2">
      <label>${T("Notas.tocar_o_som_arquivo")}<span class="cm-com-botao"><input type="text" name="som" value="${esc(a.som ?? "")}" placeholder="sounds/sino.ogg"><button type="button" data-escolher-som data-tooltip="${esc(T("Notas.escolher_arquivo"))}"><i class="fa-solid fa-file-audio"></i></button></span></label>
      <label>${T("Notas.volume")}<input type="range" name="volume" min="0" max="1" step="0.05" value="${num(a.volume, 0.8)}"></label>
    </div>
    <div class="cm-form-2">
      <label>${T("Notas.trocar_para_a_cena")}<select name="cena"><option value="">${T("Comum.nenhuma")}</option>${cenas.map((c) => `<option value="${c.id}" ${a.cena === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>
      <label>${T("Notas.como")}<select name="cenaModo">${Object.entries(MODOS_CENA).map(([k, r]) => `<option value="${k}" ${a.cenaModo === k ? "selected" : ""}>${esc(T(r))}</option>`).join("")}</select></label>
    </div>
    <label>${T("Notas.mensagem_no_chat")}<textarea name="chat" rows="2" placeholder="${esc(T("Notas.ex_o_sino_da_torre_badala"))}">${esc(a.chat ?? "")}</textarea></label>
    <label>${T("Notas.mensagem_para")}<select name="chatPara"><option value="todos" ${a.chatPara !== "mestre" ? "selected" : ""}>${T("Comum.todos")}</option><option value="mestre" ${a.chatPara === "mestre" ? "selected" : ""}>${T("Comum.so_o_mestre")}</option></select></label>
    <p class="cm-dica">${T("Notas.as_acoes_rodam_quando_o_tempo")}</p>
  </div>`;
  const r = await Dialogo().wait({
    window: { title: "CALMESA.Notas.acoes_da_nota", icon: "fa-solid fa-bolt" },
    position: { width: 520 },
    content,
    render: (ev, dlg) => {
      const el = dlg.element ?? dlg;
      el.querySelector("[data-escolher-som]")?.addEventListener("click", () => {
        new foundry.applications.apps.FilePicker.implementation({ type: "audio", current: el.querySelector('[name="som"]').value, callback: (path) => { el.querySelector('[name="som"]').value = path; } }).render(true);
      });
    },
    buttons: [
      { action: "ok", label: T("Comum.salvar"), icon: "fa-solid fa-check", default: true, callback: (ev, btn) => ({ acao: "ok", ...Object.fromEntries(new FormData(btn.form)) }) },
      { action: "testar", label: T("Notas.salvar_e_testar_agora"), icon: "fa-solid fa-play", callback: (ev, btn) => ({ acao: "testar", ...Object.fromEntries(new FormData(btn.form)) }) },
      { action: "limpar", label: T("Notas.tirar_as_acoes"), icon: "fa-solid fa-eraser", callback: () => ({ acao: "limpar" }) },
      { action: "cancelar", label: T("Comum.cancelar"), icon: "fa-solid fa-xmark" }
    ],
    rejectClose: false
  });
  if (!r || typeof r !== "object") return;
  if (r.acao === "limpar") { await j.unsetFlag(MOD, "acoes"); ui.notifications.info(T("Notas.acoes_tiradas_da_nota")); return rerenderTudo(); }
  const dados = { macro: r.macro || "", som: String(r.som ?? "").trim(), volume: num(r.volume, 0.8), cena: r.cena || "", cenaModo: r.cenaModo, chat: String(r.chat ?? "").trim(), chatPara: r.chatPara };
  await j.setFlag(MOD, "acoes", dados);
  if (r.acao === "testar") { const a2 = acoesDaNota(j); if (a2) await executarAcoes(j, a2, n?.td ?? agora().td); else ui.notifications.warn(T("Notas.nenhuma_acao_escolhida")); }
  rerenderTudo();
}
const rerenderTudo = () => { for (const app of foundry.applications.instances.values()) if (app instanceof JanelaCalendario) app.render(); };

export {
  dialogoAcoesNota,
  dialogoNota
};
