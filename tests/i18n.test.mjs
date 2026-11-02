/* Testes das traduções (sem Foundry): na raiz do repositório, node --test
 * - pt-BR.json e en.json têm exatamente as mesmas chaves;
 * - toda chave usada nos fontes existe nos JSON, e toda chave dos JSON é usada;
 * - os {parâmetros} de cada texto são os mesmos nos dois idiomas;
 * - não sobrou nenhuma chave antiga por código ("CALMESA.t…"). */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const PREFIXO = "CALMESA";

const achatar = (obj, base = "") => Object.entries(obj).flatMap(([k, v]) =>
  typeof v === "object" && v !== null ? achatar(v, `${base}${k}.`) : [[`${base}${k}`, v]]);
const carregar = (nome) => Object.fromEntries(achatar(JSON.parse(readFileSync(join(RAIZ, "lang", nome), "utf8"))[PREFIXO]));
const pt = carregar("pt-BR.json");
const en = carregar("en.json");

const listar = (dir, ext) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? listar(p, ext) : ext.some((e) => n.endsWith(e)) ? [p] : [];
});
const fontes = [...listar(join(RAIZ, "scripts"), [".js"]), ...listar(join(RAIZ, "templates"), [".hbs"])]
  .map((p) => [p.slice(RAIZ.length + 1), readFileSync(p, "utf8")]);

const areas = new Set(Object.keys(pt).map((k) => k.split(".")[0]));
/** Chaves escritas nos fontes: "Area.slug" (em T(), cmT, constantes) ou "CALMESA.Area.slug" (o Foundry traduz). */
const usadas = new Map();
for (const [arquivo, codigo] of fontes) {
  for (const m of codigo.matchAll(/["'](?:CALMESA\.)?([A-Z][A-Za-z]*\.[a-z0-9_]+)["']/g)) {
    if (!areas.has(m[1].split(".")[0])) continue;
    if (!usadas.has(m[1])) usadas.set(m[1], new Set());
    usadas.get(m[1]).add(arquivo);
  }
}
/** Chaves montadas em tempo de execução (não aparecem inteiras no código). */
const DINAMICAS = new Set(["Clima.calor", "Clima.frio"]);

test("pt-BR e en têm as mesmas chaves", () => {
  const soPt = Object.keys(pt).filter((k) => !(k in en));
  const soEn = Object.keys(en).filter((k) => !(k in pt));
  assert.deepEqual(soPt, [], "chaves só no pt-BR");
  assert.deepEqual(soEn, [], "chaves só no en");
});

test("nenhum texto vazio", () => {
  for (const [idioma, mapa] of [["pt-BR", pt], ["en", en]]) for (const [k, v] of Object.entries(mapa)) assert.ok(typeof v === "string" && v.length, `${idioma}: ${k} vazio`);
});

test("toda chave usada nos fontes existe no pt-BR", () => {
  const faltam = [...usadas.keys()].filter((k) => !(k in pt)).map((k) => `${k} (${[...usadas.get(k)].join(", ")})`);
  assert.deepEqual(faltam, []);
});

test("toda chave do JSON é usada em algum fonte", () => {
  const sobrando = Object.keys(pt).filter((k) => !usadas.has(k) && !DINAMICAS.has(k));
  assert.deepEqual(sobrando, []);
});

test("os {parâmetros} são os mesmos nos dois idiomas", () => {
  const params = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
  const diferentes = Object.keys(pt).filter((k) => k in en && params(pt[k]) !== params(en[k])).map((k) => `${k}: pt {${params(pt[k])}} ≠ en {${params(en[k])}}`);
  assert.deepEqual(diferentes, []);
});

test("não sobrou chave antiga por código (CALMESA.t…)", () => {
  for (const [arquivo, codigo] of fontes) assert.doesNotMatch(codigo, /CALMESA\.t[0-9a-z]{5,}/, arquivo);
  for (const k of Object.keys(pt)) assert.doesNotMatch(k, /^t[0-9a-z]{5,}$/, k);
  for (const [arquivo, codigo] of fontes) assert.doesNotMatch(codigo, /\bchaveI18n\(|\bK\("/, `${arquivo}: função antiga de tradução`);
});
