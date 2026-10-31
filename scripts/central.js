/* =========================================================
 * Calendário da Mesa — Central de Configurações
 *
 * Janela própria (ApplicationV2 + HandlebarsApplicationMixin) que mostra as configurações do módulo
 * organizadas em abas. Ela só lê e grava pelas APIs oficiais (game.settings.get/set): nome, descrição,
 * tipo, escopo, opções e onChange vêm do registro original de cada configuração.
 *
 * Fluxo: ao abrir, guarda os valores atuais (originais). O que o usuário muda fica em "pendentes" e só é
 * gravado em "Salvar alterações" — uma configuração por vez, apenas as que mudaram, depois de validar.
 * Se outra pessoa (ou outra janela) mudou a mesma configuração enquanto a Central estava aberta, pergunta
 * antes de sobrescrever.
 * ========================================================= */

const N = await import(globalThis.__calendarioMesaURL ?? "./calendario.js");
const { ABAS_CENTRAL, CHAVES_CENTRAL } = await import(new URL("./central-mapa.js", import.meta.url).href);
const { MOD, T, tema } = N;
const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

const RAIZ = `modules/${MOD}/templates/central`;
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const localizar = (s) => { const t = String(s ?? ""); try { return game.i18n?.localize?.(t) ?? t; } catch { return t; } };

/** Registro original de uma configuração do módulo. */
const registro = (chave) => game.settings.settings.get(`${MOD}.${chave}`);
/** Pode editar? Configurações do mundo: só o mestre (ou quem tem permissão de mudar configurações). */
const podeEditar = (def) => def?.scope !== "world" || game.user.isGM || !!game.user.can?.("SETTINGS_MODIFY");

const INTEGRACOES = {
  fxmaster: () => ({ ok: !!game.modules.get("fxmaster")?.active, rotulo: "FXMaster" }),
  journal: () => ({ ok: !!game.modules.get("journal-mesa")?.active, rotulo: "Journal da Mesa" }),
  dnd5e: () => ({ ok: game.system?.id === "dnd5e", rotulo: "D&D 5e" })
};

export class CentralConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "cm-central",
    classes: ["cm-janela", "cm-central-app"],
    tag: "div",
    window: { title: T("Calendário da Mesa — Central de Configurações"), icon: "fa-solid fa-star-and-crescent", resizable: true },
    position: { width: 880, height: 660 },
    actions: {
      aba: CentralConfig.#aba,
      salvar: CentralConfig.#salvar,
      cancelar: CentralConfig.#cancelar,
      ferramenta: CentralConfig.#ferramenta
    }
  };

  static PARTS = {
    abas: { template: `${RAIZ}/abas.hbs` },
    corpo: { template: `${RAIZ}/corpo.hbs`, scrollable: [".cm-cc-corpo"] },
    rodape: { template: `${RAIZ}/rodape.hbs` }
  };

  /** Aba aberta; valores ao abrir; mudanças ainda não salvas. */
  aba = "geral";
  originais = new Map();
  pendentes = new Map();
  #ganchos = [];
  #salvando = false;

  get title() { return T("Calendário da Mesa — Central de Configurações"); }

  /* ---------- dados ---------- */

  /** Lê os valores atuais de todas as configurações da Central (sem gravar nada). */
  #carregarOriginais() {
    this.originais.clear();
    for (const chave of CHAVES_CENTRAL) {
      if (!registro(chave)) continue;
      try { this.originais.set(chave, foundry.utils.deepClone(game.settings.get(MOD, chave))); } catch (err) { console.warn(`${MOD} | Central: não li ${chave}`, err); }
    }
  }

  /** Valor mostrado: o pendente (se houver) ou o original. */
  valor(chave) { return this.pendentes.has(chave) ? this.pendentes.get(chave) : this.originais.get(chave); }

  /** Campo pronto para o template. */
  #campo(item) {
    const def = registro(item.chave);
    if (!def) return null;
    const editavel = podeEditar(def);
    if (!editavel && def.scope === "world") return null;          // jogador: não vê preferências do mestre
    const valor = this.valor(item.chave);
    const choices = typeof def.choices === "function" ? def.choices() : def.choices;
    let tipo = "texto";
    if (def.type === Boolean) tipo = "booleano";
    else if (choices && Object.keys(choices).length) tipo = "lista";
    else if (def.type === Number) tipo = def.range ? "faixa" : "numero";
    const integ = item.integracao ? INTEGRACOES[item.integracao]?.() : null;
    const dep = item.depende ? { ok: !!item.depende.quando(this.valor(item.depende.chave)), texto: T(item.depende.texto ?? "") } : null;
    return {
      chave: item.chave,
      nome: localizar(def.name) || item.chave,
      dica: localizar(def.hint) || (item.dica ? T(item.dica) : ""),
      tipo, valor,
      booleano: tipo === "booleano", lista: tipo === "lista", faixa: tipo === "faixa", numero: tipo === "numero", texto: tipo === "texto",
      opcoes: tipo === "lista" ? Object.entries(choices).map(([k, r]) => ({ valor: k, rotulo: localizar(r), selecionado: String(valor) === k })) : [],
      min: def.range?.min ?? item.minimo, max: def.range?.max, passo: def.range?.step ?? "any",
      escopo: def.scope, escopoRotulo: def.scope === "world" ? T("Mundo") : T("Só você"),
      escopoDica: def.scope === "world" ? T("Vale para todos; só o mestre muda") : T("Preferência deste usuário, neste computador"),
      alterado: this.pendentes.has(item.chave),
      desligado: !editavel || (dep && !dep.ok),
      depende: dep && !dep.ok ? dep.texto : "",
      integracao: integ ? { ok: integ.ok, texto: integ.ok ? T("{nome} ativo", { nome: integ.rotulo }) : T("{nome} não está ativo neste mundo", { nome: integ.rotulo }) } : null,
      recarrega: !!def.requiresReload
    };
  }

  #secoes(aba) {
    return aba.secoes.map((s) => {
      const campos = s.campos.map((c) => this.#campo(c)).filter(Boolean);
      return campos.length ? { id: s.id, titulo: T(s.titulo), icone: s.icone, campos, pendentes: campos.filter((c) => c.alterado).length } : null;
    }).filter(Boolean);
  }

  #botoes(aba) {
    if (!game.user.isGM) return [];
    return (aba.botoes ?? []).map((b) => ({
      acao: b.acao, rotulo: T(b.rotulo), icone: b.icone, dica: b.dica ? T(b.dica) : "",
      desligado: b.depende ? !b.depende.quando(this.valor(b.depende.chave)) : false
    }));
  }

  /** Abas que este usuário vê (jogador: só as que têm preferências pessoais). */
  #abasVisiveis() {
    return ABAS_CENTRAL.filter((a) => this.#secoes(a).length || this.#botoes(a).length);
  }

  async _prepareContext(options) {
    garantirEstilo();
    if (!this.originais.size) this.#carregarOriginais();
    const abas = this.#abasVisiveis();
    if (!abas.some((a) => a.id === this.aba)) this.aba = abas[0]?.id ?? "geral";
    const aba = ABAS_CENTRAL.find((a) => a.id === this.aba);
    const chavesDaAba = (a) => new Set(a.secoes.flatMap((s) => s.campos.map((c) => c.chave)));
    return {
      tema: tema(),
      gm: game.user.isGM,
      abas: abas.map((a) => ({ id: a.id, rotulo: T(a.rotulo), icone: a.icone, ativa: a.id === this.aba, pendentes: [...this.pendentes.keys()].filter((k) => chavesDaAba(a).has(k)).length })),
      aba: aba ? { id: aba.id, rotulo: T(aba.rotulo), icone: aba.icone, lema: T(aba.lema) } : null,
      secoes: aba ? this.#secoes(aba) : [],
      botoes: aba ? this.#botoes(aba) : [],
      pendentes: this.pendentes.size,
      salvando: this.#salvando,
      textos: {
        salvar: T("Salvar alterações"), cancelar: T("Cancelar"), abrir: T("Abrir"),
        semMudancas: T("Nenhuma alteração"), mudancas: T("{n} alteração(ões) não salva(s)", { n: this.pendentes.size }),
        alterado: T("alterado"), recarrega: T("Pede recarregar a página"), ferramentas: T("Janelas e ferramentas"),
        jogador: T("Aqui ficam as suas preferências pessoais. As do mundo só o mestre muda.")
      }
    };
  }

  /* ---------- interação ---------- */

  _onRender(context, options) {
    super._onRender?.(context, options);
    const el = this.element;
    // as cores do tema valem na janela toda (fundo, bordas), não só dentro das partes
    el.classList.remove("cm-tema-noite", "cm-tema-claro", "cm-tema-vitoriano");
    el.classList.add(`cm-tema-${tema()}`);
    // um ouvinte por renderização, na própria janela (sai junto com ela)
    if (!this._ouvindo) {
      this._ouvindo = true;
      el.addEventListener("change", (ev) => this.#mudou(ev));
      el.addEventListener("input", (ev) => {
        const alvo = ev.target;
        if (alvo?.type === "range") { const o = el.querySelector(`output[data-saida="${alvo.name}"]`); if (o) o.textContent = alvo.value; }
      });
    }
  }

  /** Janela estreita (redimensionada): abas no alto e campos em uma coluna. */
  _onPosition(position) {
    super._onPosition?.(position);
    this.element?.classList.toggle("cm-cc-estreita", (position?.width ?? this.position.width) < 640);
  }

  _onFirstRender(context, options) {
    super._onFirstRender?.(context, options);
    // mudanças feitas por outra pessoa ou outra janela: atualiza o que não está pendente aqui
    const externo = (chave) => {
      const [ns, k] = String(chave ?? "").split(".");
      if (ns !== MOD || !CHAVES_CENTRAL.has(k) || this.#salvando) return;
      if (!this.pendentes.has(k)) { try { this.originais.set(k, foundry.utils.deepClone(game.settings.get(MOD, k))); } catch { /* ignora */ } this.render({ parts: ["corpo"] }); }
    };
    const a = Hooks.on("updateSetting", (doc) => externo(doc?.key));
    const b = Hooks.on("clientSettingChanged", (chave) => externo(chave));
    this.#ganchos.push(["updateSetting", a], ["clientSettingChanged", b]);
  }

  _onClose(options) {
    for (const [h, id] of this.#ganchos) Hooks.off(h, id);
    this.#ganchos = [];
    this._ouvindo = false;
    return super._onClose?.(options);
  }

  /** Lê o valor de um campo do formulário no tipo da configuração. */
  static lerCampo(alvo, def) {
    if (def.type === Boolean) return !!alvo.checked;
    if (def.type === Number) return alvo.value === "" ? NaN : Number(alvo.value);
    return String(alvo.value);
  }

  #mudou(ev) {
    const alvo = ev.target;
    const chave = alvo?.dataset?.chave;
    const def = chave && registro(chave);
    if (!def || !podeEditar(def)) return;
    const v = CentralConfig.lerCampo(alvo, def);
    if (igual(v, this.originais.get(chave))) this.pendentes.delete(chave);
    else this.pendentes.set(chave, v);
    // campos que dependem deste mudam de estado: redesenha o corpo; senão, só o rodapé e as abas
    const temDependentes = ABAS_CENTRAL.some((a) => a.secoes.some((s) => s.campos.some((c) => c.depende?.chave === chave)) || (a.botoes ?? []).some((b) => b.depende?.chave === chave));
    this.render({ parts: temDependentes ? ["abas", "corpo", "rodape"] : ["abas", "rodape"] });
    if (!temDependentes) alvo.closest(".cm-cc-campo")?.classList.toggle("alterado", this.pendentes.has(chave));
  }

  /** Confere o valor contra o registro (tipo, opções, faixa). Devolve a mensagem de erro ou "". */
  static validar(chave, valor, item) {
    const def = registro(chave);
    if (!def) return T("{chave}: configuração não encontrada", { chave });
    const nome = localizar(def.name) || chave;
    if (def.type === Boolean && typeof valor !== "boolean") return T("{nome}: valor inválido", { nome });
    if (def.type === Number) {
      if (!Number.isFinite(valor)) return T("{nome}: digite um número", { nome });
      const min = def.range?.min ?? item?.minimo, max = def.range?.max;
      if (min != null && valor < min) return T("{nome}: o mínimo é {min}", { nome, min });
      if (max != null && valor > max) return T("{nome}: o máximo é {max}", { nome, max });
    }
    const choices = typeof def.choices === "function" ? def.choices() : def.choices;
    if (choices && Object.keys(choices).length && !(String(valor) in choices)) return T("{nome}: opção inválida", { nome });
    return "";
  }

  static #item(chave) {
    for (const a of ABAS_CENTRAL) for (const s of a.secoes) for (const c of s.campos) if (c.chave === chave) return c;
    return null;
  }

  /* ---------- ações ---------- */

  static #aba(ev, alvo) { this.aba = alvo.dataset.aba; this.render({ parts: ["abas", "corpo"] }); }

  static async #cancelar() {
    this.pendentes.clear();
    await this.close({ force: true });
  }

  static async #salvar() {
    if (this.#salvando || !this.pendentes.size) return;
    // 1. validação de tudo antes de gravar qualquer coisa
    const erros = [...this.pendentes].map(([k, v]) => CentralConfig.validar(k, v, CentralConfig.#item(k))).filter(Boolean);
    if (erros.length) return ui.notifications.warn(erros.join(" · "));
    // 2. mudanças externas desde que a Central abriu
    const conflitos = [...this.pendentes.keys()].filter((k) => { try { return !igual(game.settings.get(MOD, k), this.originais.get(k)); } catch { return false; } });
    let pular = new Set();
    if (conflitos.length) {
      const nomes = conflitos.map((k) => localizar(registro(k)?.name) || k);
      const sobrescrever = await DialogV2.confirm({
        window: { title: T("Configurações mudaram enquanto a Central estava aberta") },
        content: `<p>${T("Estas configurações foram mudadas por outra pessoa ou outra janela:")}</p><ul>${nomes.map((n) => `<li>${foundry.utils.escapeHTML(n)}</li>`).join("")}</ul><p>${T("Gravar os seus valores por cima? (Não = manter os valores novos e salvar só o resto.)")}</p>`
      });
      if (!sobrescrever) pular = new Set(conflitos);
    }
    // 3. grava uma por vez (cada set dispara o onChange original daquela configuração)
    this.#salvando = true;
    this.render({ parts: ["rodape"] });
    const gravadas = [], falhas = [];
    for (const [k, v] of this.pendentes) {
      if (pular.has(k)) continue;
      try { await game.settings.set(MOD, k, v); gravadas.push(k); this.originais.set(k, foundry.utils.deepClone(v)); }
      catch (err) { falhas.push(localizar(registro(k)?.name) || k); console.error(`${MOD} | Central: não gravei ${k}`, err); }
    }
    for (const k of gravadas) this.pendentes.delete(k);
    for (const k of pular) { this.pendentes.delete(k); try { this.originais.set(k, foundry.utils.deepClone(game.settings.get(MOD, k))); } catch { /* ignora */ } }
    this.#salvando = false;
    if (falhas.length) ui.notifications.error(T("Não consegui gravar: {lista}. As outras foram salvas.", { lista: falhas.join(", ") }));
    else if (gravadas.length) ui.notifications.info(T("{n} configuração(ões) salva(s).", { n: gravadas.length }));
    this.render({ parts: ["abas", "corpo", "rodape"] });
    if (gravadas.length) await CentralConfig.recarregarSePreciso(gravadas);
  }

  /** Mesmo comportamento da janela de configurações do Foundry para estas opções:
   *  1. "Recarregar ao mudar configurações de módulos" (opção do próprio Calendário): recarrega como lá;
   *  2. senão, configuração marcada "requiresReload" pede para recarregar. */
  static async recarregarSePreciso(chaves) {
    let modo = "nao";
    try { modo = game.settings.get(MOD, "recarregarAoMudar"); } catch { /* sem a opção */ }
    const defs = chaves.map(registro).filter(Boolean);
    const mundo = defs.some((d) => d.scope === "world");
    if (modo !== "nao") {
      const todos = mundo && game.user.isGM;
      ui.notifications.info(todos ? T("{n} opção(ões) mudada(s): recarregando para todos...", { n: chaves.length }) : T("{n} opção(ões) mudada(s): recarregando...", { n: chaves.length }));
      setTimeout(() => {
        try { if (todos) game.socket.emit("reload"); } catch (err) { console.warn(`${MOD} | recarregar jogadores`, err); }
        (foundry.utils.debouncedReload ?? (() => window.location.reload()))();
      }, 900);
      return "recarregou";
    }
    if (defs.some((d) => d.requiresReload)) {
      const Config = foundry.applications?.settings?.SettingsConfig;
      if (typeof Config?.reloadConfirm === "function") await Config.reloadConfirm({ world: mundo });
      else if (await DialogV2.confirm({ window: { title: T("Recarregar") }, content: `<p>${T("Esta mudança só vale depois de recarregar a página. Recarregar agora?")}</p>` })) window.location.reload();
      return "perguntou";
    }
    return "";
  }

  static async #ferramenta(ev, alvo) {
    if (!game.user.isGM) return;
    const F = await N.ferramentas().catch(() => null);
    const abrirClima = (aba, sub) => {
      if (!F) return;
      const app = foundry.applications.instances.get("cm-clima") ?? new F.JanelaClima();
      app.aba = aba;
      if (sub) app.subClimas = sub;
      app.render({ force: true });
    };
    switch (alvo.dataset.ferramenta) {
      case "abrirClima": return abrirClima("tempo");
      case "abrirEfeitos": return abrirClima("climas", "efeitos");
      case "abrirAnomalias": return abrirClima("anomalias");
      case "diagnostico": N.diagnosticoClima(); return ui.notifications.info(T("Diagnóstico do clima no console (F12)."));
      case "abrirLuz": return N.abrirFerramenta("JanelaLuz");
      case "abrirEditor": return N.abrirFerramenta("EditorCalendario");
      case "abrirHistorico": return N.abrirFerramenta("JanelaHistorico");
      case "abrirContadores": return N.abrirFerramenta("JanelaContadores");
      case "abrirTabelas": return N.abrirFerramenta("JanelaTabelas");
      case "abrirCalendario": return N.JanelaCalendario.abrir();
    }
  }

  /** Fechar com alterações não salvas pergunta antes (Cancelar e "force" fecham direto). */
  async close(options = {}) {
    if (this.pendentes.size && !options.force && !this.#salvando) {
      const ok = await DialogV2.confirm({
        window: { title: T("Alterações não salvas") },
        content: `<p>${T("Há {n} alteração(ões) não salva(s) na Central. Fechar e descartar?", { n: this.pendentes.size })}</p>`
      });
      if (!ok) return this;
      this.pendentes.clear();
    }
    return super.close(options);
  }
}

/** Abre (ou traz para a frente) a Central. */
/** O Foundry só lê os "styles" do module.json ao iniciar o mundo; quem atualizou o módulo e só recarregou
 * a página fica sem central.css. Nesse caso, a própria Central acrescenta o arquivo (uma vez). */
function garantirEstilo() {
  try { garantirEstiloAgora(); } catch (e) { console.warn("calendario-mesa | não consegui carregar central.css", e); }
}
function garantirEstiloAgora() {
  const url = new URL("../styles/central.css", import.meta.url);
  const ja = [...document.querySelectorAll('link[rel="stylesheet"]')].some((l) => {
    try { return new URL(l.href, location.href).pathname.endsWith("/calendario-mesa/styles/central.css"); } catch { return false; }
  });
  if (ja) return;
  const link = document.createElement("link");
  link.rel = "stylesheet"; link.href = url.href; link.dataset.cmCentral = "1";
  document.head.appendChild(link);
}

export function abrirCentral() {
  garantirEstilo();
  const app = foundry.applications.instances.get("cm-central") ?? new CentralConfig();
  app.render({ force: true });
  return app;
}
