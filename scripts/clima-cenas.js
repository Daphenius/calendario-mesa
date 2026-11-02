/* =========================================================
 * Calendário da Mesa — Clima nas cenas
 * Qual clima cada cena mostra, aplicação nas cenas, diagnóstico (F12) e o comportamento de Região
 * "Clima (Calendário da Mesa)".
 * ========================================================= */

import { apiFx, aplicarEfeitoNaCena, aplicarFxNaCena, efeitoCena, PREVIA, usarFx } from "./clima-efeitos.js";
import { anomaliaDe, ANOMALIAS, anomaliasLigadas, atualizarClima, climaDe, CLIMAS, mensagemClima, zonaDaCena, zonaPadraoValida, ZONAS } from "./clima.js";
import { HUD } from "./janela.js";
import { atualizarCenas } from "./luz.js";
import { chat, esc, idsGM, MOD, naFila, relatarErro, souGMPrincipal, T } from "./nucleo.js";

/* ---------------- clima nas cenas ----------------
 * Qual cena recebe o efeito do clima:
 *  · região por token (Região do mapa onde o grupo está) — sempre, a não ser que a Região diga "não mostrar";
 *  · região própria da cena (escolhida na janela do clima) — sim;
 *  · mapa com Regiões de clima, com o grupo fora de todas — segue a região da cena ou a padrão;
 *  · região padrão do mundo (cena sem região própria e sem Region desenhada) — conforme a opção
 *    "Clima nas cenas sem região própria": "todas" (padrão) ou só as marcadas com "Mostrar o clima nesta cena".
 *    Nessas cenas, um efeito escolhido à mão pelo mestre não é trocado (só o que o próprio Calendário pôs);
 *  · o mestre pode desligar o clima visual de qualquer cena (flag climaNaCena = false).
 * O efeito que o Calendário põe numa cena fica anotado (flag climaAplicado) na mesma gravação; assim ele só
 * tira de uma cena o efeito que ele mesmo colocou, nunca um escolhido à mão. */
function planoClimaCena(s) {
  const decisao = s.getFlag(MOD, "climaNaCena");
  const ativa = s.getFlag(MOD, "zonaAtiva");
  const porToken = ZONAS[ativa?.zona] ? ativa.zona : null;
  const propria = ZONAS[s.getFlag(MOD, "zona")] ? s.getFlag(MOD, "zona") : null;
  const temRegioes = !!s.regions?.some?.((r) => r.behaviors?.some?.((b) => b.type === TIPO_CLIMA && !b.disabled));
  const origem = porToken ? "token" : propria ? "propria" : temRegioes ? "mapa" : "padrao";
  const zona = zonaDaCena(s);
  const base = { origem, zona, anomalia: ZONAS[zona]?.anomaliaFixa ?? anomaliaDe(zona)?.tipo ?? null };
  if (!game.settings.get(MOD, "climaVisual")) return { ...base, incluir: false, motivo: T("Clima.efeito_de_clima_nas_cenas_esta") };
  if (decisao === false) return { ...base, incluir: false, motivo: T("Clima.o_mestre_desligou_o_clima_visual") };
  if (porToken && ativa.efeito === false) return { ...base, incluir: false, motivo: T("Clima.a_regiao_do_mapa_onde_o") };
  if (origem === "padrao" && decisao !== true) {
    let modo = "todas";
    try { modo = game.settings.get(MOD, "climaCenasSemRegiao") ?? "todas"; } catch { /* opção ainda não registrada */ }
    if (modo !== "todas") return { ...base, incluir: false, motivo: T("Clima.usa_a_regiao_padrao_do_mundo") };
    // efeito escolhido à mão: fica (o Calendário só troca o que ele mesmo pôs)
    const aplicado = s.getFlag(MOD, "climaAplicado");
    const naCena = s.weather ?? "";
    const manual = naCena !== "" && (aplicado == null ? !s.getFlag(MOD, "fxPreset") : naCena !== aplicado);
    if (manual) return { ...base, incluir: false, manual: true, motivo: T("Clima.tem_um_efeito_escolhido_a_mao", { efeito: naCena }) };
  }
  const clima = climaDe(zona);
  if (!clima) return { ...base, incluir: false, motivo: T("Clima.o_clima_de_hoje_ainda_nao") };
  return { ...base, incluir: true, clima, ef: efeitoCena(clima.tipo), motivo: "" };
}

let CLIMA_CENAS = { pendente: false, promessa: Promise.resolve() };
/** Põe o clima nas cenas. Uma de cada vez (fila "climaCenas"); vários pedidos seguidos viram uma só passada,
 *  que lê o estado mais recente quando começa. */
function aplicarClimaNasCenas() {
  if (!souGMPrincipal()) return Promise.resolve();
  if (CLIMA_CENAS.pendente) return CLIMA_CENAS.promessa;
  CLIMA_CENAS.pendente = true;
  CLIMA_CENAS.promessa = naFila("climaCenas", async () => {
    CLIMA_CENAS.pendente = false;
    await aplicarClimaNasCenasAgora();
  }).catch((err) => relatarErro(T("Clima.clima_das_cenas"), err));
  return CLIMA_CENAS.promessa;
}

async function aplicarClimaNasCenasAgora() {
  const updates = [];
  for (const s of game.scenes) {
    const plano = planoClimaCena(s);
    const aplicado = s.getFlag(MOD, "climaAplicado") ?? null;
    if (!plano.incluir) {
      // tira só o que o próprio Calendário pôs (preset do FXMaster e efeito do Foundry)
      if (s.getFlag(MOD, "fxPreset")) await aplicarFxNaCena(s, null);
      if (aplicado != null && (s.weather ?? "") === aplicado && aplicado !== "") updates.push({ _id: s.id, weather: "", [`flags.${MOD}.-=climaAplicado`]: null });
      else if (aplicado != null && (s.weather ?? "") !== aplicado) updates.push({ _id: s.id, [`flags.${MOD}.-=climaAplicado`]: null });
      continue;
    }
    // primeiro o FXMaster (se escolhido); se ele não ligar o preset, a cena recebe o efeito do Foundry
    const weather = await aplicarEfeitoNaCena(s, plano.clima.tipo);
    if ((s.weather ?? "") !== weather || aplicado !== weather) updates.push({ _id: s.id, weather, [`flags.${MOD}.climaAplicado`]: weather });
  }
  await atualizarCenas(updates, {}, "Erros.clima_das_cenas");
}

/** Para conferir no console: todas as cenas, o que cada uma deveria mostrar, o que mostra e por quê. */
function diagnosticoClima({ silencioso = false } = {}) {
  const W = CONFIG.weatherEffects ?? {};
  const ORIGEM = { token: T("Clima.regiao_do_mapa_token"), propria: T("Clima.propria_da_cena"), mapa: T("Clima.mapa_com_regioes_grupo_fora_delas"), padrao: T("Clima.padrao_do_mundo") };
  const linhas = [...game.scenes].map((s) => {
    const p = planoClimaCena(s);
    const esperado = p.incluir ? (p.ef.preset ? "" : p.ef.weather) : null;
    let ativos = "";
    try { ativos = apiFx()?.presets?.listActive?.({ scene: s })?.join(", ") ?? ""; } catch { ativos = "?"; }
    const naCena = s.weather ?? "";
    let situacao;
    if (!p.incluir) situacao = p.motivo;
    else if (p.ef.preset && !ativos.split(", ").includes(p.ef.preset)) situacao = T("Clima.preset_do_fxmaster_esperado_nao_esta");
    else if (naCena !== (esperado ?? naCena) && !p.ef.preset) situacao = T("Clima.diferente_do_esperado_sera_corrigido_na");
    else if (naCena && !W[naCena]) situacao = T("Clima.o_efeito_salvo_na_cena_nao");
    else situacao = T("Clima.ok");
    return {
      cena: s.name, id: s.id, ativa: !!s.active, vistaAqui: s.id === canvas?.scene?.id,
      regiao: `${T(ZONAS[p.zona]?.nome ?? p.zona ?? "")} (${ORIGEM[p.origem]})`,
      regiaoPropria: ZONAS[s.getFlag(MOD, "zona")] ? T(ZONAS[s.getFlag(MOD, "zona")].nome) : "", regiaoPadrao: T(ZONAS[zonaPadraoValida()]?.nome ?? ""),
      elegivel: p.incluir, anomalia: p.anomalia ? T(ANOMALIAS[p.anomalia]?.nome ?? p.anomalia) : "",
      clima: p.clima ? T(CLIMAS[p.clima.tipo]?.nome ?? p.clima.tipo) : "", efeitoEsperado: esperado ?? "", presetEsperado: p.ef?.preset ?? "",
      presetsAtivos: ativos, naCena: naCena || "(nenhum)", existeNoFoundry: naCena ? !!W[naCena] : "", situacao
    };
  });
  if (!silencioso) {
    console.table(linhas);
    let semRegiao = "todas";
    try { semRegiao = game.settings.get(MOD, "climaCenasSemRegiao"); } catch { /* sem a opção */ }
    console.log(`${MOD} | FXMaster ativo: ${!!apiFx()} · usar FXMaster: ${usarFx()} · efeito de clima nas cenas: ${game.settings.get(MOD, "climaVisual")} · cenas sem região própria: ${semRegiao} · região padrão: ${ZONAS[zonaPadraoValida()]?.nome} · efeitos registrados: ${Object.keys(W).length} · prévia: ${PREVIA.cenaId ?? "não"}`);
  }
  return linhas;
}

/* ---------------- clima pelas Regiões nativas do Foundry ---------------- */
/* No mapa-múndi, desenhe Regiões nativas (ferramenta de Regiões) e adicione o comportamento
 * "Clima (Calendário da Mesa)". Quando um token de jogador entra, aquela região passa a ditar o
 * clima do mapa; ao sair de todas, volta para a região da cena ou a padrão. Tudo fica nos dados
 * nativos da Região: nenhum processamento contínuo, só reage a entrar e sair. */

const TIPO_CLIMA = `${MOD}.clima`;
const BaseComportamento = foundry.data?.regionBehaviors?.RegionBehaviorType;

class ClimaRegiao extends (BaseComportamento ?? class {}) {
  static defineSchema() {
    const f = foundry.data.fields;
    return {
      zona: new f.StringField({
        required: true, initial: "temperada", label: "CALMESA.Clima.regiao_do_clima",
        hint: "CALMESA.Clima.clima_que_o_grupo_encontra_enquanto",
        choices: () => Object.fromEntries(Object.entries(ZONAS).filter(([, v]) => !v.virtual || anomaliasLigadas()).map(([k, v]) => [k, v.nome]))
      }),
      efeito: new f.BooleanField({ initial: true, label: "CALMESA.Clima.mostrar_o_clima_no_mapa", hint: "CALMESA.Clima.chuva_neve_neblina_nativos_do_foundry" }),
      aviso: new f.BooleanField({ initial: true, label: "CALMESA.Clima.avisar_no_chat_ao_entrar_e", hint: "CALMESA.Clima.mostra_o_clima_do_dia_quando" })
    };
  }

  /* Entrar e sair rodam na fila "regiao": quatro tokens do grupo cruzando a borda juntos geram um aviso só. */
  static _entrar(evento) {
    if (!souGMPrincipal()) return;
    const token = evento.data?.token;
    if (!token?.actor?.hasPlayerOwner) return;
    return naFila("regiao", () => ClimaRegiao._entrarAgora.call(this, token)).catch((err) => relatarErro(T("Clima.regiao_de_clima_entrada"), err));
  }

  static async _entrarAgora(token) {
    const cena = this.region?.parent ?? this.parent?.parent?.parent;
    if (!cena || !ZONAS[this.zona]) return;
    const atual = cena.getFlag(MOD, "zonaAtiva");
    if (atual?.zona === this.zona && atual?.regiao === this.region.id) return;
    await cena.setFlag(MOD, "zonaAtiva", { zona: this.zona, regiao: this.region.id, efeito: this.efeito });
    if (!climaDe(this.zona)) await atualizarClima({ avisar: false });
    // o efeito da região aparece na tela já na entrada (ex.: Reino da Água chovendo → chuva na cena)
    await aplicarClimaNasCenas();
    if (this.aviso) {
      const quem = game.settings.get(MOD, "climaChat");
      const nome = this.region.name || ZONAS[this.zona].nome;
      await chat(`<i class="fa-solid fa-map-location-dot"></i> ${T("Clima.o_grupo_entrou_em")} <b>${esc(nome)}</b>${nome !== ZONAS[this.zona].nome ? ` (${esc(ZONAS[this.zona].nome)})` : ""}.<br>${mensagemClima(this.zona)}`, quem === "mestre" ? idsGM() : []);
    }
    HUD.render();
  }

  static _sair(evento) {
    if (!souGMPrincipal()) return;
    const token = evento.data?.token;
    if (!token?.actor?.hasPlayerOwner) return;
    return naFila("regiao", () => ClimaRegiao._sairAgora.call(this, token)).catch((err) => relatarErro(T("Clima.regiao_de_clima_saida"), err));
  }

  static async _sairAgora(token) {
    const cena = this.region?.parent;
    if (!cena || cena.getFlag(MOD, "zonaAtiva")?.regiao !== this.region.id) return;
    // ainda há personagem de jogador dentro desta região? então o grupo não saiu
    const restam = [...(this.region.tokens ?? [])].filter((t) => t.id !== token.id && t.actor?.hasPlayerOwner);
    if (restam.length) return;
    // ainda dentro de outra região de clima? passa a valer ela
    const outra = [...(token.regions ?? [])].find((r) => r.id !== this.region.id && r.behaviors?.some((b) => b.type === TIPO_CLIMA && !b.disabled));
    const b = outra?.behaviors.find((x) => x.type === TIPO_CLIMA && !x.disabled);
    if (b && ZONAS[b.system.zona]) await cena.setFlag(MOD, "zonaAtiva", { zona: b.system.zona, regiao: outra.id, efeito: b.system.efeito });
    else await cena.unsetFlag(MOD, "zonaAtiva");
    const zonaNova = zonaDaCena(cena);
    if (!climaDe(zonaNova)) await atualizarClima({ avisar: false });
    // a cena tem Regiões de clima: fora delas ela segue a região padrão (planoClimaCena cuida disso)
    await aplicarClimaNasCenas();
    if (this.aviso) {
      const quem = game.settings.get(MOD, "climaChat");
      const nome = this.region.name || ZONAS[this.zona]?.nome || T("Clima.a_regiao");
      const destino = b ? `${T("Clima.agora_em")} <b>${esc(outra.name || ZONAS[b.system.zona].nome)}</b>` : `${T("Clima.de_volta_ao_clima_de")} <b>${esc(ZONAS[zonaNova]?.nome ?? zonaNova)}</b>`;
      await chat(`<i class="fa-solid fa-person-walking-arrow-right"></i> ${T("Clima.o_grupo_saiu_de")} <b>${esc(nome)}</b>. ${destino}.<br>${mensagemClima(zonaNova)}`, quem === "mestre" ? idsGM() : []);
    }
    HUD.render();
  }
}
if (BaseComportamento) {
  const E = CONST.REGION_EVENTS ?? {};
  ClimaRegiao.events = {
    [E.TOKEN_ENTER ?? "tokenEnter"]: ClimaRegiao._entrar,
    [E.TOKEN_EXIT ?? "tokenExit"]: ClimaRegiao._sair
  };
}

function registrarRegiaoDeClima() {
  if (!BaseComportamento || !CONFIG.RegionBehavior) return;
  CONFIG.RegionBehavior.dataModels[TIPO_CLIMA] = ClimaRegiao;
  if (CONFIG.RegionBehavior.typeIcons) CONFIG.RegionBehavior.typeIcons[TIPO_CLIMA] = "fa-solid fa-cloud-sun";
  if (CONFIG.RegionBehavior.typeLabels) CONFIG.RegionBehavior.typeLabels[TIPO_CLIMA] = "CALMESA.Clima.clima_calendario_da_mesa";
}

export {
  aplicarClimaNasCenas,
  diagnosticoClima,
  planoClimaCena,
  registrarRegiaoDeClima,
  TIPO_CLIMA
};
