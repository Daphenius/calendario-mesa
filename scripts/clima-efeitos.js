/* =========================================================
 * Calendário da Mesa — Efeitos do clima
 * Variantes dos efeitos nativos, efeitos de tela (aurora, calor, relâmpagos, eclipse), efeitos criados
 * pelo mestre, prévia e o FXMaster.
 * ========================================================= */

import { avisoUmaVezCal, CLIMAS } from "./clima.js";
import { MOD, num, relatarErro, T } from "./nucleo.js";

/** Efeito que vale de fato nesta sessão: a variação do módulo, a reserva nativa ou nenhum. */
function efeitoDoClima(tipo) {
  const c = CLIMAS[tipo];
  if (!c?.efeito) return "";
  if (CONFIG.weatherEffects?.[c.efeito]) return c.efeito;
  return c.reserva && CONFIG.weatherEffects?.[c.reserva] ? c.reserva : "";
}

/* Variações dos efeitos nativos: copiam um efeito do Foundry e mudam só números que ele já tem
 * (opacidade, intensidade, velocidade...). Se o Foundry mudar esses efeitos, a variação só fica parecida
 * com o original — nunca quebra. Registradas em todos os clientes (cada um desenha a cena). */
function registrarEfeitosDeClima() {
  const W = CONFIG.weatherEffects;
  if (!W) return;
  const copia = (k) => (W[k] ? foundry.utils.deepClone(W[k]) : null);
  const ajustar = (ef, ajustes) => {
    if (!ef?.config) return;
    for (const [k, v] of Object.entries(ajustes)) {
      if (!(k in ef.config)) continue;
      if (Array.isArray(v) && Array.isArray(ef.config[k])) ef.config[k] = v;
      else if (typeof v === "number" && typeof ef.config[k] === "number") ef.config[k] *= v;
    }
  };
  const variante = (id, rotulo, de, ajustes = {}, junto = []) => {
    try {
      const b = copia(de);
      if (!b || !Array.isArray(b.effects)) return;
      b.effects.forEach((ef) => { ajustar(ef, ajustes); ef.id = `${id}-${ef.id}`; });
      for (const [outro, aj] of junto) {
        for (const ef of copia(outro)?.effects ?? []) { ajustar(ef, aj); ef.id = `${id}-${outro}-${ef.id}`; b.effects.push(ef); }
      }
      b.id = id; b.label = rotulo;
      W[id] = b;
    } catch (err) { console.warn(`${MOD} | efeito de clima ${id}`, err); }
  };
  variante("cm-encoberto", "Clima.ceu_encoberto_calendario", "fog", { intensity: 0.35, speed: 0.6 });
  variante("cm-neblinaDensa", "Clima.nevoeiro_denso_calendario", "fog", { intensity: 1.9, slope: 1.3 });
  variante("cm-garoa", "Clima.garoa_calendario", "rain", { opacity: 0.55, intensity: 0.4, strength: 0.6, speed: 0.75 });
  variante("cm-aguaceiro", "Clima.aguaceiro_calendario", "rain", { opacity: 1.5, intensity: 1.8, strength: 1.4, speed: 1.3 });
  variante("cm-chuvaNeblina", "Clima.chuva_com_neblina_calendario", "rain", { opacity: 0.8, intensity: 0.7 }, [["fog", { intensity: 0.7 }]]);
  variante("cm-granizo", "Clima.granizo_calendario", "rainStorm", { speed: 1.5, strength: 1.3, tint: [0.95, 0.97, 1] });
  variante("cm-neveLeve", "Clima.neve_fraca_calendario", "snow", { speed: 0.6 });
  variante("cm-areia", "Clima.tempestade_de_areia_calendario", "fog", { intensity: 1.5, speed: 2, tint: [0.85, 0.68, 0.42] }, [["leaves", {}]]);
  variante("cm-cinzas", "Clima.chuva_de_cinzas_calendario", "snow", { speed: 0.45, tint: [0.38, 0.35, 0.33] });
  // efeitos de tela desenhados por este módulo (ver EfeitoTela abaixo)
  let Classe = null;
  try { Classe = classeEfeitoTela(); } catch (err) { console.warn(`${MOD} | efeitos de tela indisponíveis`, err); }
  if (Classe) try {
    const tela = (id, rotulo, modo, config = {}) => { W[id] = { id, label: rotulo, effects: [{ id: `${id}-tela`, effectClass: Classe, config: { modo, ...config } }] }; };
    tela("cm-aurora", "Clima.aurora_calendario", "aurora", { tint: [0.35, 1, 0.6], tint2: [0.75, 0.4, 1], intensity: 1, speed: 1, scale: 1 });
    tela("cm-calor", "Clima.calor_tremulando_calendario", "calor", { tint: [1, 0.72, 0.4], intensity: 1, speed: 1, scale: 1 });
    tela("cm-relampago", "Clima.relampagos_calendario", "relampago", { tint: [0.85, 0.9, 1], intensity: 1, speed: 1, scale: 1 });
    tela("cm-eclipse", "Clima.ceu_de_eclipse_calendario", "eclipse", { tint: [0.9, 0.35, 0.2], intensity: 1, speed: 1, scale: 1 });
    // tempestade = a nativa + relâmpagos
    try {
      if (W.rainStorm) {
        const b = copia("rainStorm");
        b.effects.forEach((ef) => { ef.id = `cm-tempestade-${ef.id}`; });
        b.effects.push({ id: "cm-tempestade-raios", effectClass: Classe, config: { modo: "relampago", tint: [0.85, 0.9, 1], intensity: 0.8, speed: 1, scale: 1 } });
        b.id = "cm-tempestade"; b.label = "Clima.tempestade_com_relampagos_calendario";
        W["cm-tempestade"] = b;
      }
    } catch (err) { console.warn(`${MOD} | efeito cm-tempestade`, err); }
  } catch (err) { console.warn(`${MOD} | efeitos de tela`, err); }
}

/* ---------------- efeitos de tela próprios ----------------
 * Um efeito de clima do Foundry é um objeto { effects: [{ effectClass, config }] }: a camada de clima cria
 * new effectClass(config), põe na tela e chama play()/stop()/destroy(). Esta classe desenha uma malha do
 * tamanho da cena com um shader (GLSL) escrito aqui; o modo escolhe o desenho. Não depende de nenhuma
 * classe interna de shader do Foundry, só do PIXI. */
const VERT_TELA = `
attribute vec2 aVertexPosition;
attribute vec2 aUvs;
uniform mat3 projectionMatrix;
uniform mat3 translationMatrix;
varying vec2 vUvs;
varying vec2 vPos;
void main() {
  vUvs = aUvs;
  vPos = aVertexPosition;
  gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
}`;
const FRAG_COMUM = `
precision mediump float;
varying vec2 vUvs;
varying vec2 vPos;
uniform float time;
uniform float intensity;
uniform float scale;
uniform float grade;
uniform float alpha;
uniform vec3 tint;
uniform vec3 tint2;
uniform vec2 dims;
float hash(float n) { return fract(sin(n) * 43758.5453123); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float ruido(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), u.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * ruido(p); p = p * 2.03 + vec2(17.0, 9.0); a *= 0.5; }
  return v;
}`;
const FRAG_TELA = {
  // faixas de luz verde/violeta que ondulam devagar
  aurora: `${FRAG_COMUM}
void main() {
  vec2 p = vPos / (max(grade, 1.0) * 10.0 * scale);
  float t = time * 0.06;
  float curva = fbm(vec2(p.x * 0.35 + t, t * 0.4)) * 2.2;
  float faixa = abs(fract(p.y * 0.35 + curva) - 0.5) * 2.0;
  float cortina = smoothstep(0.75, 0.15, faixa);
  float fios = 0.55 + 0.45 * sin(p.x * 26.0 + fbm(p * 3.0 + vec2(t * 3.0, 0.0)) * 9.0);
  float brilho = cortina * fios * (0.6 + 0.4 * fbm(p * 1.3 - vec2(0.0, t * 2.0)));
  vec3 cor = mix(tint, tint2, smoothstep(0.3, 0.8, fbm(p * 0.5 + vec2(t, 2.0))));
  float a = clamp(brilho * 0.42 * intensity, 0.0, 1.0) * alpha;
  gl_FragColor = vec4(cor * a, a);
}`,
  // ar quente tremulando: linhas de luz morna que sobem ondulando
  calor: `${FRAG_COMUM}
void main() {
  vec2 p = vPos / (max(grade, 1.0) * 4.0 * scale);
  float t = time * 0.8;
  float deriva = fbm(p * 0.9 + vec2(0.0, -t * 0.35)) * 2.6;
  float onda = 0.5 + 0.5 * sin(p.y * 3.2 + deriva + t * 1.6);
  float quebra = smoothstep(0.35, 0.85, fbm(p * 1.8 + vec2(t * 0.25, -t * 0.9)));
  float faixas = smoothstep(0.45, 1.0, onda) * quebra;
  float bafo = 0.05 + 0.05 * fbm(p * 0.3 + vec2(0.0, -t * 0.12));
  float a = clamp((faixas * 0.13 + bafo) * intensity, 0.0, 1.0) * alpha;
  gl_FragColor = vec4(tint * a, a);
}`,
  // clarões de relâmpago em momentos sorteados, mais fortes perto de um ponto do mapa
  relampago: `${FRAG_COMUM}
void main() {
  float t = time * 0.55;
  float n = floor(t);
  float lt = fract(t);
  float vem = step(hash(n * 7.13), 0.38 * clamp(intensity, 0.2, 2.0));
  float flash = exp(-lt * 22.0) + 0.7 * step(0.13, lt) * exp(-(lt - 0.13) * 28.0) + 0.35 * step(0.27, lt) * exp(-(lt - 0.27) * 30.0);
  vec2 centro = vec2(hash(n * 3.7), hash(n * 9.1));
  float perto = 1.0 - smoothstep(0.0, 1.1, distance(vUvs, centro));
  float luz = vem * flash * (0.45 + 0.55 * perto);
  float a = clamp(luz * 0.8 * intensity, 0.0, 1.0) * alpha;
  gl_FragColor = vec4(tint * a, a);
}`,
  // a cena escurece com bordas avermelhadas que pulsam devagar
  eclipse: `${FRAG_COMUM}
void main() {
  float d = length((vUvs - 0.5) * vec2(dims.x / max(dims.y, 1.0), 1.0));
  float borda = smoothstep(0.15, 0.95, d);
  float pulso = 0.5 + 0.5 * sin(time * 0.35);
  vec3 cor = mix(vec3(0.03, 0.02, 0.06), tint * 0.35, borda * (0.35 + 0.25 * pulso) + 0.08 * fbm(vPos / max(grade * 6.0, 1.0) + time * 0.02));
  float a = clamp((0.42 + 0.22 * borda) * intensity, 0.0, 0.92) * alpha;
  gl_FragColor = vec4(cor * a, a);
}`
};
const MISTURA_TELA = { aurora: "ADD", calor: "ADD", relampago: "ADD", eclipse: "NORMAL" };
let CLASSE_TELA = null;
function classeEfeitoTela() {
  if (CLASSE_TELA) return CLASSE_TELA;
  const P = globalThis.PIXI;
  if (!P?.Container || !P?.Mesh || !P?.Geometry || !P?.Shader) return null;
  const Mix = foundry.canvas.containers.FullCanvasObjectMixin;
  CLASSE_TELA = class EfeitoTela extends Mix(P.Container) {
    constructor(config = {}) {
      super();
      this.config = config ?? {};
      this.eventMode = "none";
      try { this.#montar(this.config); } catch (err) {
        // se o shader não puder ser criado nesta máquina, o efeito fica vazio em vez de quebrar a camada de clima
        avisoUmaVezCal("efeito-tela", `${T("Clima.calendario_o_efeito_de_tela_0", [this.config.modo, err?.message ?? err])}`);
        this.malha = null;
      }
      this.play();
    }
    #montar(config) {
      const modo = FRAG_TELA[config.modo] ? config.modo : "aurora";
      const r = canvas?.dimensions?.rect ?? { x: 0, y: 0, width: 4000, height: 3000 };
      const { x, y, width: w, height: h } = r;
      const geo = new P.Geometry()
        .addAttribute("aVertexPosition", [x, y, x + w, y, x + w, y + h, x, y + h], 2)
        .addAttribute("aUvs", [0, 0, 1, 0, 1, 1, 0, 1], 2)
        .addIndex([0, 1, 2, 0, 2, 3]);
      this.uniforms = {
        time: Math.random() * 100, intensity: num(config.intensity, 1), scale: Math.max(0.05, num(config.scale, 1)),
        grade: canvas?.dimensions?.size ?? 100, alpha: 1, dims: [w, h],
        tint: config.tint ?? [1, 1, 1], tint2: config.tint2 ?? config.tint ?? [1, 1, 1]
      };
      this.velocidade = Math.max(0, num(config.speed, 1));
      this.malha = new P.Mesh(geo, P.Shader.from(VERT_TELA, FRAG_TELA[modo], this.uniforms));
      this.malha.blendMode = P.BLEND_MODES?.[MISTURA_TELA[modo]] ?? 0;
      this.addChild(this.malha);
    }
    get shader() { return this.malha?.shader ?? null; }
    _tique = () => { if (this.uniforms) this.uniforms.time += ((P.Ticker?.shared?.deltaMS ?? 16) / 1000) * (this.velocidade ?? 1); };
    play() { if (!this._tocando) { P.Ticker?.shared?.add(this._tique); this._tocando = true; } this.visible = true; }
    stop() { if (this._tocando) { P.Ticker?.shared?.remove(this._tique); this._tocando = false; } }
    destroy(...args) { this.stop(); return super.destroy(...args); }
  };
  return CLASSE_TELA;
}

/* ---------------- efeitos criados pelo mestre ("Novo efeito" na aba Climas) ----------------
 * Ficam em climaTipos.efeitos = { id: { nome, base, cor, forca, velocidade, tamanho, direcao, base2, cor2, forca2 } }
 * e viram CONFIG.weatherEffects["cmx-<id>"]: uma cópia da base com os números mudados (como os cm-*). */
const PREFIXO_EFEITO = "cmx-";
const corHex = (v) => (/^#[0-9a-f]{6}$/i.test(String(v ?? "")) ? String(v).toLowerCase() : "");
const corRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const faixaNum = (v, min, max, pad) => Math.max(min, Math.min(max, num(v, pad)));

function normalizarEfeito(e, id) {
  return {
    nome: String(e?.nome || id).slice(0, 60),
    base: /^[\w.-]{1,60}$/.test(String(e?.base ?? "")) && !String(e.base).startsWith(PREFIXO_EFEITO) ? e.base : "rain",
    cor: corHex(e?.cor),
    forca: faixaNum(e?.forca, 0.05, 4, 1),
    velocidade: faixaNum(e?.velocidade, 0, 5, 1),
    tamanho: faixaNum(e?.tamanho, 0.2, 5, 1),
    direcao: e?.direcao === "" || e?.direcao == null ? null : faixaNum(e.direcao, 0, 360, 0),
    base2: /^[\w.-]{1,60}$/.test(String(e?.base2 ?? "")) && !String(e.base2).startsWith(PREFIXO_EFEITO) ? e.base2 : "",
    cor2: corHex(e?.cor2),
    forca2: faixaNum(e?.forca2, 0.05, 4, 1)
  };
}

/** O que cada efeito-base aceita mudar (lendo a configuração dele): usado pelo editor e pelo registro. */
function ajustesDoEfeito(base) {
  const ef = CONFIG.weatherEffects?.[base];
  const r = { cor: false, forca: false, velocidade: false, tamanho: false, direcao: false };
  for (const e of ef?.effects ?? []) {
    const c = e.config ?? {};
    const fx = String(base).startsWith("fxmaster.");
    if ("tint" in c || fx) r.cor = true;
    if (["intensity", "opacity", "strength", "alpha", "density"].some((k) => k in c) || fx) r.forca = true;
    if ("speed" in c || fx) r.velocidade = true;
    if ("scale" in c || fx) r.tamanho = true;
    if ("rotation" in c || "direction" in c || fx) r.direcao = true;
  }
  return r;
}

function montarEfeito(id, def) {
  const W = CONFIG.weatherEffects;
  const copiar = (base, cor, forca, ehSegundo) => {
    const b = W[base] ? foundry.utils.deepClone(W[base]) : null;
    if (!b?.effects) return [];
    const fx = String(base).startsWith("fxmaster.");
    return b.effects.map((ef) => {
      ef.id = `${PREFIXO_EFEITO}${id}-${ehSegundo ? "b-" : ""}${ef.id}`;
      ef.config = { ...(ef.config ?? {}) };
      const c = ef.config;
      if (fx) {
        // opções das partículas do FXMaster (valores absolutos; os padrões vêm do próprio efeito)
        const pad = ef.effectClass?.default ?? {};
        const valor = (k, p) => { const v = pad[k]?.value ?? pad[k]; return typeof v === "number" ? v : p; };
        c.density = valor("density", 0.5) * forca;
        c.speed = valor("speed", 1) * (ehSegundo ? 1 : def.velocidade);
        c.scale = valor("scale", 1) * (ehSegundo ? 1 : def.tamanho);
        if (!ehSegundo && def.direcao != null) c.direction = def.direcao;
        if (cor) c.tint = { value: cor, apply: true };
        return ef;
      }
      if (cor && "tint" in c) c.tint = corRgb(cor);
      for (const k of ["intensity", "opacity", "strength", "alpha", "density"]) if (typeof c[k] === "number") c[k] *= forca;
      if (!ehSegundo) {
        if (typeof c.speed === "number") c.speed *= def.velocidade;
        if (typeof c.scale === "number") c.scale *= def.tamanho;
        if (def.direcao != null) {
          if ("rotation" in c) c.rotation = (def.direcao * Math.PI) / 180;
          if ("direction" in c) c.direction = (def.direcao * Math.PI) / 180;
        }
      }
      return ef;
    });
  };
  const effects = [...copiar(def.base, def.cor, def.forca, false), ...(def.base2 ? copiar(def.base2, def.cor2, def.forca2, true) : [])];
  if (!effects.length) return null;
  const base = W[def.base] ?? {};
  return { ...foundry.utils.deepClone({ ...base, effects: [] }), id: `${PREFIXO_EFEITO}${id}`, label: def.nome, effects };
}

/** Registra (de novo) os efeitos do mestre. Em todos os clientes: cada um desenha a própria tela. */
function registrarEfeitosPersonalizados() {
  const W = CONFIG.weatherEffects;
  if (!W) return;
  for (const k of Object.keys(W)) if (k.startsWith(PREFIXO_EFEITO)) delete W[k];
  let lista = {};
  try { lista = game.settings.get(MOD, "climaTipos")?.efeitos ?? {}; } catch { lista = {}; }
  for (const [id, e] of Object.entries(lista)) {
    try { const ef = montarEfeito(id, normalizarEfeito(e, id)); if (ef) W[`${PREFIXO_EFEITO}${id}`] = ef; } catch (err) { console.warn(`${MOD} | efeito ${id}`, err); }
  }
}

/* Prévia de um efeito em edição: só na tela deste usuário, só na cena em que começou, sem gravar nada
 * no documento da cena. Se a cena mudar, a prévia acaba sozinha (a cena nova desenha o próprio clima). */
const PREVIA = { cenaId: null, ef: null };
const previaAtiva = () => !!PREVIA.cenaId && PREVIA.cenaId === canvas?.scene?.id;
function iniciarPreviaEfeito(def) {
  if (!canvas?.ready || !canvas.scene || typeof canvas.weather?.initializeEffects !== "function") return false;
  const ef = montarEfeito("previa", normalizarEfeito(def, "previa"));
  if (!ef) return false;
  PREVIA.cenaId = canvas.scene.id;
  PREVIA.ef = ef;
  try { canvas.weather.initializeEffects(ef); } catch (err) { relatarErro(T("Clima.previa_do_efeito"), err); PREVIA.cenaId = null; PREVIA.ef = null; return false; }
  return true;
}
function pararPreviaEfeito() {
  if (!PREVIA.cenaId) return false;
  const mesma = PREVIA.cenaId === canvas?.scene?.id;
  PREVIA.cenaId = null; PREVIA.ef = null;
  if (mesma) redesenharClima();          // volta ao clima salvo da própria cena aberta
  return true;
}

/** Redesenha o clima da cena aberta com a configuração do efeito que ela usa (ou a prévia em andamento).
 *  initializeEffects(config): sem config, o Foundry LIMPA a camada de clima — por isso a config é sempre passada.
 *  so(weather): redesenha só se a cena aberta usa um efeito que passa no teste (ex.: só efeitos do mestre). */
function redesenharClima({ so = null } = {}) {
  if (!canvas?.ready || !canvas.scene || typeof canvas.weather?.initializeEffects !== "function") return false;
  if (previaAtiva()) { try { canvas.weather.initializeEffects(PREVIA.ef); } catch (err) { console.warn(`${MOD} | prévia`, err); } return true; }
  const atual = canvas.scene.weather ?? "";
  if (so && !so(atual)) return false;
  try { canvas.weather.initializeEffects(atual ? CONFIG.weatherEffects?.[atual] : undefined); } catch (err) { console.warn(`${MOD} | redesenhar clima`, err); }
  return true;
}

/* ---------------- FXMaster ----------------
 * Com o FXMaster ativo, cada clima pode usar um preset dele (FXMASTER.api.presets) ou uma partícula dele
 * (que o próprio FXMaster coloca na lista de efeitos de clima como "fxmaster.<tipo>"). O preset fica
 * marcado na cena (flag fxPreset) para ser desligado quando o clima mudar. */
const PRESETS_FX_CONHECIDOS = ["acid-rain", "aether-haze", "arcane-winds", "ashfall", "autumn-leaves", "black-sun", "blizzard", "blood-rain", "cloudy", "divine-light", "drizzle", "dust-devil", "fog", "gravewind", "hail", "heat-wave", "hurricane", "ice-storm", "ley-surge", "luminous-sky", "meteor-shower", "mist", "monsoon", "nullfront", "overcast", "partly-cloudy", "permafrost-surge", "plague-miasma", "rain", "rolling-fog", "sakura-bloom", "sandstorm", "sleet", "snow", "spore-cloud", "sunshower", "thunderstorm", "tornado", "twilight-sun", "veilfall", "wildfire-smoke", "windy"];
const apiFx = () => (game.modules?.get?.("fxmaster")?.active && globalThis.FXMASTER?.api?.presets ? globalThis.FXMASTER.api : null);
const usarFx = () => { try { return game.settings.get(MOD, "usarFXMaster") !== false; } catch { return true; } };
function presetsFx() {
  const api = apiFx();
  if (!api) return [];
  try { return api.presets.listValid?.() ?? api.presets.list?.() ?? []; } catch { return []; }
}

/** O que o clima mostra na cena: { weather, preset, opcoes }. */
function efeitoCena(tipo) {
  const c = CLIMAS[tipo];
  if (c?.fx && usarFx() && apiFx()) {
    if (c.fx.startsWith("fxp:")) {
      const nome = c.fx.slice(4);
      if (presetsFx().includes(nome)) return { weather: "", preset: nome, opcoes: c.fxOpcoes ?? {} };
    } else if (CONFIG.weatherEffects?.[c.fx]) return { weather: c.fx, preset: null };
  }
  return { weather: efeitoDoClima(tipo), preset: null };
}

/** Liga, troca ou desliga o preset do FXMaster que o Calendário pôs nesta cena.
 *  Devolve true se o preset pedido está valendo na cena (ou se nenhum foi pedido); false se o FXMaster
 *  não conseguiu ligar o preset (quem chamou volta para o efeito do Foundry). */
async function aplicarFxNaCena(cena, ef) {
  const api = apiFx();
  const antes = cena.getFlag(MOD, "fxPreset") ?? null;
  const novo = ef?.preset ? { nome: ef.preset, opcoes: ef.opcoes ?? {} } : null;
  if (JSON.stringify(antes) === JSON.stringify(novo)) {
    if (!novo || !api?.presets?.listActive) return true;
    // a flag diz que está ligado: confere com o FXMaster (alguém pode ter limpado os efeitos)
    try { if ((api.presets.listActive({ scene: cena }) ?? []).includes(novo.nome)) return true; } catch { return true; }
  }
  if (!api) { if (antes) await cena.unsetFlag(MOD, "fxPreset"); return !novo; }
  try {
    if (antes?.nome) await api.presets.stop(antes.nome, { scene: cena });
    if (!novo) { if (antes) await cena.unsetFlag(MOD, "fxPreset"); return true; }
    const o = novo.opcoes;
    const ok = await api.presets.play(novo.nome, { scene: cena, silent: true, ...(o.densidade ? { density: o.densidade } : {}), ...(o.velocidade ? { speed: o.velocidade } : {}), ...(corHex(o.cor) ? { color: o.cor } : {}) });
    let ativo = ok !== false;
    if (ativo && api.presets.listActive) { try { ativo = (api.presets.listActive({ scene: cena }) ?? []).includes(novo.nome); } catch { /* sem como conferir */ } }
    if (ativo) { await cena.setFlag(MOD, "fxPreset", novo); return true; }
    avisoUmaVezCal(`fx-${novo.nome}`, `${T("Clima.calendario_o_fxmaster_nao_ligou_o", [novo.nome])}`);
    if (antes) await cena.unsetFlag(MOD, "fxPreset");
    return false;
  } catch (err) {
    relatarErro(T("Clima.efeito_do_fxmaster"), err, { avisar: false });
    try { if (antes) await cena.unsetFlag(MOD, "fxPreset"); } catch { /* ignora */ }
    return false;
  }
}

/** Efeito final de uma cena para um clima: tenta o FXMaster; se não der, o do Foundry. */
async function aplicarEfeitoNaCena(cena, tipo) {
  const ef = tipo ? efeitoCena(tipo) : { weather: "", preset: null };
  const okFx = await aplicarFxNaCena(cena, ef);
  return okFx ? ef.weather : efeitoDoClima(tipo);
}

export {
  ajustesDoEfeito,
  apiFx,
  aplicarEfeitoNaCena,
  aplicarFxNaCena,
  corHex,
  efeitoCena,
  iniciarPreviaEfeito,
  normalizarEfeito,
  pararPreviaEfeito,
  PREFIXO_EFEITO,
  PRESETS_FX_CONHECIDOS,
  presetsFx,
  PREVIA,
  previaAtiva,
  redesenharClima,
  registrarEfeitosDeClima,
  registrarEfeitosPersonalizados,
  usarFx
};
