/* Testes da divisão em arquivos (sem Foundry): na raiz do repositório, node --test
 * - todo nome importado existe no export do arquivo de origem;
 * - todo nome exportado é importado por algum arquivo (exceto o que o Foundry ou o núcleo usam pelo nome);
 * - nenhum arquivo passa de ~900 linhas;
 * - ninguém mais importa o núcleo por endereço (o antigo globalThis.__calendarioMesaURL);
 * - toda classe do CSS é usada em algum script ou template. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS = join(RAIZ, "scripts");
const listarHbs = (d) => readdirSync(d).flatMap((n) => statSync(join(d, n)).isDirectory() ? listarHbs(join(d, n)) : n.endsWith(".hbs") ? [join(d, n)] : []);
const listar = (d) => readdirSync(d).flatMap((n) => statSync(join(d, n)).isDirectory() ? listar(join(d, n)) : n.endsWith(".js") ? [join(d, n)] : []);
const arquivos = listar(SCRIPTS);
const nome = (p) => relative(SCRIPTS, p);
const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

/** { imports: [{ de, nomes }], exports: Set, reexports: [{ de, nomes }] } de cada arquivo */
const info = new Map();
for (const p of arquivos) {
  const s = semComentarios(readFileSync(p, "utf8"));
  const lista = (t) => t.split(",").map((x) => x.trim()).filter(Boolean).map((x) => x.split(/\s+as\s+/).pop());
  const imports = [...s.matchAll(/^import \{([^}]*)\} from "([^"]+)";/gm)].map((m) => ({ de: resolve(dirname(p), m[2]), nomes: lista(m[1]) }));
  const reexports = [...s.matchAll(/^export \{([^}]*)\} from "([^"]+)";/gm)].map((m) => ({ de: resolve(dirname(p), m[2]), nomes: lista(m[1]) }));
  const exports = new Set([
    ...[...s.matchAll(/^export \{([^}]*)\};/gm)].flatMap((m) => lista(m[1])),
    ...[...s.matchAll(/^export (?:async )?(?:function|class|const|let) (\w+)/gm)].map((m) => m[1]),
    ...reexports.flatMap((r) => r.nomes)
  ]);
  info.set(p, { imports, exports, reexports, linhas: s.split("\n").length, texto: s });
}

// Usados por fora da rede de imports: o arquivo de entrada (module.json), a API (montada no ready) e o
// ferramentas.js, cujos nomes o núcleo abre por texto: ferr("dialogoNota"), abrirFerramenta("JanelaLuz").
const ENTRADA = join(SCRIPTS, "calendario.js");
const PELO_NOME = new Set(info.get(join(SCRIPTS, "ferramentas.js")).exports);

test("todo import aponta para um arquivo que exporta o nome", () => {
  const faltam = [];
  for (const [p, i] of info) for (const imp of [...i.imports, ...i.reexports]) {
    if (!existsSync(imp.de)) { faltam.push(`${nome(p)}: arquivo ${relative(SCRIPTS, imp.de)} não existe`); continue; }
    const alvo = info.get(imp.de);
    for (const n of imp.nomes) if (!alvo.exports.has(n)) faltam.push(`${nome(p)}: ${n} não é exportado por ${nome(imp.de)}`);
  }
  assert.deepEqual(faltam, []);
});

test("todo export é usado por outro arquivo", () => {
  const usados = new Set();
  for (const [, i] of info) for (const imp of [...i.imports, ...i.reexports]) for (const n of imp.nomes) usados.add(`${imp.de}#${n}`);
  const sobrando = [];
  for (const [p, i] of info) {
    if (p === ENTRADA) continue;
    for (const n of i.exports) {
      if (usados.has(`${p}#${n}`)) continue;
      if (nome(p) === "ferramentas.js" && PELO_NOME.has(n)) continue;
      sobrando.push(`${nome(p)}: ${n}`);
    }
  }
  assert.deepEqual(sobrando, []);
});

test("os nomes abertos por texto existem no ferramentas.js", () => {
  const pedidos = new Set();
  for (const [, i] of info) for (const m of i.texto.matchAll(/(?:\bferr|\babrirFerramenta)\("(\w+)"/g)) pedidos.add(m[1]);
  assert.deepEqual([...pedidos].filter((n) => !PELO_NOME.has(n)), []);
});

test("nenhum arquivo passa de ~900 linhas", () => {
  const grandes = [...info].filter(([, i]) => i.linhas > 950).map(([p, i]) => `${nome(p)}: ${i.linhas}`);
  assert.deepEqual(grandes, []);
});

test("ninguém importa o núcleo por endereço", () => {
  for (const [p, i] of info) {
    assert.doesNotMatch(i.texto, /__calendarioMesaURL/, nome(p));
    assert.doesNotMatch(i.texto, /await import\(/, `${nome(p)}: import dinâmico no topo`);
  }
});

test("toda classe do CSS é usada", () => {
  const fontes = [...arquivos, ...listarHbs(join(RAIZ, "templates"))].map((p) => readFileSync(p, "utf8")).join("\n");
  // classes montadas por partes: cm-tema-${tema}, g-${grupo}, cm-cc-{{chave}}…
  const prefixos = new Set([...fontes.matchAll(/([\w-]+-)(?:\$\{|\{\{)/g)].map((m) => m[1]));
  const DO_FOUNDRY = new Set(["window-content", "window-header", "window-title", "application", "active"]);
  const sobrando = [];
  for (const css of readdirSync(join(RAIZ, "styles")).filter((n) => n.endsWith(".css"))) {
    const texto = readFileSync(join(RAIZ, "styles", css), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const seletores = [...texto.matchAll(/([^{}]+)\{/g)].map((m) => m[1]).join(" ");
    for (const c of new Set([...seletores.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]))) {
      if (DO_FOUNDRY.has(c) || new RegExp(`(?<![\\w-])${c}(?![\\w-])`).test(fontes)) continue;
      if ([...prefixos].some((p) => c.startsWith(p))) continue;
      sobrando.push(`${css}: .${c}`);
    }
  }
  assert.deepEqual(sobrando, []);
});
