/* Névoa de guerra com dia e noite (scripts/luz.js) num Foundry simulado: node --test tests/visao.test.mjs
 * - de dia: luz global ligada até o limite, visão dos tokens e névoa explorada ligadas;
 * - a visão dos tokens dos personagens de jogadores é ligada (sem ela o jogador vê tudo preto, de dia e de noite);
 * - "De dia, mapa aberto para todos": visão dos tokens desligada de dia e de volta à noite;
 * - escuridão travada (darknessLevelLock, o nome do Foundry 14): a luz não muda, a visão segue a escuridão da cena;
 * - com a opção desligada, nada disso é tocado. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { montar } from "./foundry-falso.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const url = (p) => pathToFileURL(join(RAIZ, p)).href;
const F = montar(RAIZ);
const MOD = "calendario-mesa";
const DIA = { escuridao: 0, hue: 0.6, intensidade: 0.4 }, NOITE = { escuridao: 1, hue: 0.6, intensidade: 0.4 };

function token(id, { jogador = false, visao = false } = {}) {
  return { id, _source: { sight: { enabled: visao } }, sight: { enabled: visao }, actor: { hasPlayerOwner: jogador } };
}
/** Cena falsa: aplica as chaves com ponto no próprio objeto, como o Foundry faz. */
function cena(id, extra = {}) {
  const s = {
    id, name: id, tokenVision: false, fog: { mode: 0 }, tokens: [],
    environment: { darknessLevel: 0.3, darknessLevelLock: false, cycle: true, dark: { hue: 0, intensity: 0 }, globalLight: { enabled: false, darkness: { min: 0, max: 1 } } },
    getFlag: (m, k) => (m === MOD && k === "diaNoite" ? true : undefined),
    async updateEmbeddedDocuments(tipo, ups) { for (const u of ups) { const t = s.tokens.find((x) => x.id === u._id); t._source.sight.enabled = t.sight.enabled = u["sight.enabled"]; } },
    ...extra
  };
  return s;
}
function aplicar(s, upd) {
  for (const [k, v] of Object.entries(upd)) { if (k === "_id") continue; const p = k.split("."); let o = s; while (p.length > 1) o = o[p.shift()] ??= {}; o[p[0]] = v; }
}
let luz;
async function preparar(cenas, opcoes = {}) {
  game.scenes.length = 0; game.scenes.push(...cenas);
  game.scenes.get = (id) => cenas.find((c) => c.id === id) ?? null;
  CONFIG.Scene = { documentClass: { updateDocuments: async (ups) => { for (const u of ups) aplicar(game.scenes.get(u._id), u); } } };
  CONST.FOG_EXPLORATION_MODES = { DISABLED: 0, INDIVIDUAL: 1, SHARED: 2 };
  for (const [k, v] of Object.entries({ visaoDiaNoite: true, visaoLimite: 0.6, visaoLigarTokens: true, visaoDiaAberto: false, ...opcoes })) F.valores.set(`${MOD}.${k}`, v);
}

test("carrega o módulo", async () => {
  await import(url("scripts/calendario.js"));
  await F.rodar("init"); await F.rodar("i18nInit"); await F.rodar("setup");
  luz = await import(url("scripts/luz.js"));
  for (const k of ["visaoDiaNoite", "visaoLimite", "visaoLigarTokens", "visaoDiaAberto"]) assert.ok(F.settings.has(`${MOD}.${k}`), k);
});

test("de dia: luz global até o limite, visão dos tokens e névoa explorada ligadas", async () => {
  const s = cena("a");
  await preparar([s]);
  await luz.aplicarLuz(DIA, 0);
  assert.equal(s.environment.darknessLevel, 0);
  assert.equal(s.environment.globalLight.enabled, true);
  assert.equal(s.environment.globalLight.darkness.max, 0.6);
  assert.equal(s.tokenVision, true);
  assert.equal(s.fog.mode, 1, "névoa explorada individual");
});

test("névoa explorada compartilhada escolhida pelo mestre não é trocada", async () => {
  const s = cena("a", { fog: { mode: 2 } });
  await preparar([s]);
  await luz.aplicarLuz(NOITE, 0);
  assert.equal(s.fog.mode, 2);
});

test("liga a visão só dos tokens de personagens de jogadores", async () => {
  const s = cena("a");
  s.tokens.push(token("pj", { jogador: true }), token("npc"), token("pjOk", { jogador: true, visao: true }));
  await preparar([s]);
  await luz.aplicarLuz(NOITE, 0);
  assert.equal(s.tokens[0].sight.enabled, true, "personagem de jogador");
  assert.equal(s.tokens[1].sight.enabled, false, "NPC fica como estava");
  // opção desligada: não mexe nos tokens
  const s2 = cena("b"); s2.tokens.push(token("pj", { jogador: true }));
  await preparar([s2], { visaoLigarTokens: false });
  await luz.aplicarLuz(NOITE, 0);
  assert.equal(s2.tokens[0].sight.enabled, false);
});

test("token novo de jogador numa cena de dia/noite entra com a visão ligada", async () => {
  const s = cena("a");
  await preparar([s]);
  const t = token("novo", { jogador: true }); t.parent = s; s.tokens.push(t);
  await F.rodar("createToken", t);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(t.sight.enabled, true);
});

test("\"De dia, mapa aberto para todos\": sem visão dos tokens de dia, com ela à noite", async () => {
  const s = cena("a", { tokenVision: true });
  await preparar([s], { visaoDiaAberto: true });
  await luz.aplicarLuz(DIA, 0);
  assert.equal(s.tokenVision, false, "de dia");
  await luz.aplicarLuz(NOITE, 0);
  assert.equal(s.tokenVision, true, "de noite");
});

test("escuridão travada (darknessLevelLock): a luz não muda e a visão segue a escuridão da cena", async () => {
  const s = cena("a");
  s.environment.darknessLevelLock = true; s.environment.darknessLevel = 0.9;
  await preparar([s], { visaoDiaAberto: true });
  await luz.aplicarLuz(DIA, 0);
  assert.equal(s.environment.darknessLevel, 0.9, "escuridão travada não muda");
  assert.equal(s.tokenVision, true, "a cena está escura: visão dos tokens");
});

test("com a opção desligada, luz global, visão e névoa não são tocadas", async () => {
  const s = cena("a"); s.tokens.push(token("pj", { jogador: true }));
  await preparar([s], { visaoDiaNoite: false });
  await luz.aplicarLuz(NOITE, 0);
  assert.equal(s.environment.darknessLevel, 1);
  assert.equal(s.environment.globalLight.enabled, false);
  assert.equal(s.tokenVision, false);
  assert.equal(s.fog.mode, 0);
  assert.equal(s.tokens[0].sight.enabled, false);
});
