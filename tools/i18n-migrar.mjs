#!/usr/bin/env node
/* =========================================================
 * i18n-migrar.mjs — migração única (4.3.1 → 4.4.0) das chaves de tradução.
 *
 * Até a 4.3.1 cada texto era identificado por um código opaco calculado do
 * texto em português ("CALMESA.t9e4djx"). Este script:
 *   1. lê lang/pt-BR.json e lang/en.json no formato antigo (hash → texto);
 *   2. procura cada texto PT nos fontes (scripts/**\/*.js, templates/**\/*.hbs)
 *      em contexto de tradução: T("…"), K("…"), {{cmT "…"}} e valores de
 *      constantes (nome:, desc:, texto:, rotulo:, dica:, listas…);
 *   3. gera uma chave legível CALMESA.<Area>.<slug> por texto (a área vem da
 *      seção do arquivo em que o texto aparece; texto usado em várias áreas
 *      vai para "Comum");
 *   4. reescreve os fontes trocando o texto pela chave, e os dois JSON
 *      aninhados por área (PT = texto, EN = tradução que já existia).
 *
 * Uso (na raiz do repositório):  node tools/i18n-migrar.mjs [--dry]
 * Com --dry só imprime o relatório, sem gravar nada.
 *
 * O que o script não alcança foi feito à mão na 4.4.0 (fica aqui como registro):
 *   - T() reescrito para receber a chave; chaveI18n(), K() e traduzirConfiguracoes() removidos;
 *   - títulos de janela (window.title) e nome/dica/opções das configurações recebem a chave completa
 *     "CALMESA.…", porque o próprio Foundry os traduz;
 *   - textos montados em tempo de execução ganharam chaves próprias: "Erros.*" (relatarErro) e
 *     "Clima.calor"/"Clima.frio" (ondas de calor e frio);
 *   - "Calendário da Mesa" (nome do módulo, também usado como identificador) não é traduzido.
 * Fica no repositório como registro; não vai no zip da release.
 * ========================================================= */

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RAIZ = process.cwd();
const DRY = process.argv.includes("--dry");
const PREFIXO = "CALMESA";

/* ---------- áreas por seção ----------
 * Cada arquivo é dividido em seções pelos comentários "/* ------ nome ------" e pelas classes;
 * a primeira regra cuja expressão bate com o nome da seção dá a área. */
const AREA_POR_SECAO = [
  [/tradução|utilidades|fila serial|ferramentas carregadas/i, "Geral"],
  [/calendários prontos|^configuração$|estações por dia|anos e eras|tamanho variável|vários calendários/i, "Calendario"],
  [/^tempo$|controle de tempo|pulo de tempo|desfazer/i, "Tempo"],
  [/estações, sol e luas|eventos das luas/i, "Luas"],
  [/notas e eventos|ações das notas|notas acompanham/i, "Notas"],
  [/avisos, journal/i, "Avisos"],
  [/luz do mapa|luz por hora|JanelaLuz/i, "Luz"],
  [/efeitos com duração/i, "Efeitos"],
  [/previsão do tempo|fxmaster|tipos de região|clima|JanelaClima/i, "Clima"],
  [/recarregar ao mudar|^registro$/i, "Config"],
  [/contadores|JanelaContadores/i, "Contadores"],
  [/lojas/i, "Lojas"],
  [/datas nos textos/i, "Datas"],
  [/viagem|JanelaViagem/i, "Viagem"],
  [/importação/i, "Importar"],
  [/editor do calendário|EditorCalendario/i, "Editor"],
  [/JanelaHistorico/i, "Historico"],
  [/JanelaTabelas/i, "Tabelas"],
  [/dias sagrados/i, "Divindades"]
];
const AREA_POR_ARQUIVO = { "scripts/central.js": "Central", "scripts/central-mapa.js": "Central", "templates/contadores.hbs": "Contadores" };
/* Área do começo do arquivo, antes da primeira seção (ferramentas.js abre com os nomes do calendário gregoriano). */
const AREA_INICIAL = { "scripts/ferramentas.js": "Gregoriano" };

/* ---------- utilidades ---------- */
const listar = (dir, ext) => {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) saida.push(...listar(p, ext));
    else if (ext.some((e) => nome.endsWith(e))) saida.push(p);
  }
  return saida;
};
const semAcento = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
function slug(texto) {
  let s = semAcento(texto).toLowerCase().replace(/\{(\w+)\}/g, " $1 ").replace(/[^a-z0-9]+/g, " ").trim();
  const palavras = s.split(" ").filter(Boolean).slice(0, 6);
  s = palavras.join("_");
  if (s.length > 48) s = s.slice(0, 48).replace(/_+$/, "");
  return s || "texto";
}
/** Decodifica os escapes de um literal JS "..." (\" \\ \n \t) */
const decodificar = (bruto) => bruto.replace(/\\(["'\\nt])/g, (m, c) => ({ '"': '"', "'": "'", "\\": "\\", n: "\n", t: "\t" }[c]));
const codificar = (texto) => texto.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");

/* ---------- 1. JSON antigos ---------- */
const ptAntigo = JSON.parse(readFileSync(join(RAIZ, "lang/pt-BR.json"), "utf8"))[PREFIXO];
const enAntigo = JSON.parse(readFileSync(join(RAIZ, "lang/en.json"), "utf8"))[PREFIXO];
const porTexto = new Map(); // texto PT → { hash, en }
for (const [hash, pt] of Object.entries(ptAntigo)) {
  if (!hash.startsWith("t")) continue;
  porTexto.set(pt, { hash, en: enAntigo[hash] ?? null });
}
console.log(`${porTexto.size} textos no pt-BR.json antigo`);

/* ---------- 2. ocorrências nos fontes ---------- */
const arquivos = [...listar(join(RAIZ, "scripts"), [".js"]), ...listar(join(RAIZ, "templates"), [".hbs"])].map((p) => relative(RAIZ, p));
const propriedades = new Set();
/* Nomes próprios que também servem de identificador no código (comparados com ===): ficam fora da tradução. */
const NAO_TRADUZIR = new Set(["Calendário da Mesa"]);
/* Textos que o código também usa como valor interno (=== "x", case "x", value="x", chave de objeto): nesses
 * contextos de dado (prop/lista/atribuição) ficam como estão; só saem de T()/K()/cmT. */
const IDENTIFICADORES = new Set();
for (const arquivo of arquivos) {
  const codigo = readFileSync(join(RAIZ, arquivo), "utf8");
  for (const m of codigo.matchAll(/(?:===?|!==?|case|value=|unidade:|repetir:|fim:|aviso:|modo\w*:|grupo:|tipo:|origem:|onda:|cenaModo:)\s*"([^"\\]*)"/g)) IDENTIFICADORES.add(m[1]);
  for (const m of codigo.matchAll(/[{,]\s*(\w+):/g)) IDENTIFICADORES.add(m[1]);
}
const usos = new Map(); // texto → [{ arquivo, linha, area, contexto }]
const naoTrocados = []; // literais iguais a um texto PT fora de contexto de tradução
const fontes = new Map(); // arquivo → linhas

for (const arquivo of arquivos) {
  const linhas = readFileSync(join(RAIZ, arquivo), "utf8").split("\n");
  fontes.set(arquivo, linhas);
  let area = AREA_POR_ARQUIVO[arquivo] ?? AREA_INICIAL[arquivo] ?? "Geral", secaoAtual = "";
  const hbs = arquivo.endsWith(".hbs");
  linhas.forEach((linha, i) => {
    if (!AREA_POR_ARQUIVO[arquivo]) {
      const secao = linha.match(/^\/\* -{4,} (.+?) -{4,}/)?.[1] ?? linha.match(/^(?:export )?class (\w+) /)?.[1];
      if (secao) { secaoAtual = secao.trim(); const regra = AREA_POR_SECAO.find(([re]) => re.test(secaoAtual)); if (regra) area = regra[1]; }
    }
    // Cada contexto de tradução tem a sua expressão; o literal fica no grupo "txt". Procurar por contexto (e não
    // por todo literal da linha) evita se perder nos `${T("…")}` dentro de template strings.
    const LIT = `"(?<txt>(?:[^"\\\\]|\\\\.)*)"`;
    const CONTEXTOS = [
      ["T", `\\bT\\(\\s*${LIT}`],
      ["K", `\\bK\\(\\s*${LIT}\\)`],
      ["chaveI18n", `\\bchaveI18n\\(\\s*${LIT}\\)`],
      ["cmT", `cmT\\s+(?:${LIT}|'(?<txt2>(?:[^'\\\\]|\\\\.)*)')`],
      ["prop", `(?<prop>[\\w"']+)\\s*:\\s*${LIT}`],
      ["atrib", `\\.\\w+\\s*=\\s*${LIT}`],
      ["efeito", `\\b(?:variante|tela)\\("[\\w-]+",\\s*${LIT}`],
      ["lista", `[\\[,]\\s*${LIT}`]
    ];
    // Listas de constantes cujos valores são todos texto traduzido (as chaves são os identificadores).
    const LINHA_LISTA = /^\s*(const \w+ = \[|\w+: \[|\{ nome: |\[|  \{ nome)/;
    const MAPA_TEXTOS = /^const (UNIDADES|UNIDADE_SING|REPETIR|FIM|AVISOS|MODOS_CENA|GRUPOS_CLIMA|ICONES|ORIGEM) =/;
    const ocupados = []; // trechos já reservados nesta linha [inicio, fim)
    for (const [contexto, fonte] of CONTEXTOS) {
      const re = new RegExp(fonte, "g");
      let m;
      while ((m = re.exec(linha))) {
        const bruto = m.groups.txt ?? m.groups.txt2;
        const texto = decodificar(bruto);
        const inicioLit = m.index + m[0].lastIndexOf(bruto) - 1, fimLit = inicioLit + bruto.length + 2;
        if (ocupados.some(([a, b]) => inicioLit < b && fimLit > a)) continue;
        if (!porTexto.has(texto)) continue;
        if (contexto === "lista" && !LINHA_LISTA.test(linha)) continue;
        const antes = linha.slice(0, inicioLit);
        // valores que também são identificadores no código ("anos", "frio"...) só saem de T()/K()/cmT, ou das listas de textos
        if (["prop", "atrib", "lista"].includes(contexto) && IDENTIFICADORES.has(texto) && !MAPA_TEXTOS.test(linha)) {
          naoTrocados.push({ arquivo, linha: i + 1, texto, trecho: linha.trim().slice(0, 120), motivo: "identificador" }); continue;
        }
        if (NAO_TRADUZIR.has(texto)) { naoTrocados.push({ arquivo, linha: i + 1, texto, trecho: linha.trim().slice(0, 120), motivo: "nome próprio" }); continue; }
        // K("x") e chaveI18n("x") somem: fica só a chave completa "CALMESA.x" (o Foundry traduz sozinho)
        let inicio = inicioLit, fim = fimLit, completa = false;
        if (contexto === "K" || contexto === "chaveI18n") { inicio = m.index; fim = m.index + m[0].length; completa = true; }
        // no registro das configurações, name/hint/choices também são traduzidos pelo Foundry: chave completa
        if (contexto === "prop" && secaoAtual === "registro") completa = true;
        if (contexto === "prop") propriedades.add(m.groups.prop);
        ocupados.push([inicio, fim]);
      if (!usos.has(texto)) usos.set(texto, []);
        usos.get(texto).push({ arquivo, linha: i, area, contexto, inicio, fim, completa });
      }
    }
  });
}

/* ---------- 3. chaves novas ---------- */
const chaves = new Map(); // texto → "Area.slug"
const ocupadas = new Set();
const ordem = []; // [area, chave, texto] na ordem de primeira aparição
for (const [texto, lista] of usos) {
  const areas = [...new Set(lista.map((u) => u.area))];
  const area = areas.length === 1 ? areas[0] : "Comum";
  let s = slug(texto), chave = `${area}.${s}`, n = 2;
  while (ocupadas.has(chave)) chave = `${area}.${s}_${n++}`;
  ocupadas.add(chave);
  chaves.set(texto, chave);
  ordem.push([area, chave.slice(area.length + 1), texto]);
}
const semUso = [...porTexto.keys()].filter((t) => !usos.has(t));

/* ---------- relatório ---------- */
console.log(`${usos.size} textos encontrados nos fontes → ${chaves.size} chaves novas`);
const porArea = {};
for (const [area] of ordem) porArea[area] = (porArea[area] ?? 0) + 1;
console.log("por área:", porArea);
console.log("propriedades com texto traduzido:", [...propriedades].sort().join(", "));
if (naoTrocados.length) {
  console.log(`\n${naoTrocados.length} literal(is) igual(is) a um texto traduzido mas FORA de contexto de tradução (não trocados):`);
  for (const n of naoTrocados) console.log(`  ${n.arquivo}:${n.linha}  [${n.motivo}] ${JSON.stringify(n.texto)}  ← ${n.trecho}`);
}
if (semUso.length) {
  console.log(`\n${semUso.length} texto(s) do JSON sem nenhuma ocorrência nos fontes (não entram nos JSON novos):`);
  for (const t of semUso) console.log(`  ${porTexto.get(t).hash}  ${JSON.stringify(t)}`);
}
const semEn = ordem.filter(([, , t]) => !porTexto.get(t).en);
if (semEn.length) { console.log(`\n${semEn.length} texto(s) sem tradução EN:`); for (const [, , t] of semEn) console.log("  " + JSON.stringify(t)); }

if (DRY) process.exit(0);

/* ---------- 4. gravar ---------- */
// fontes: trocas de trás para a frente em cada linha
const trocasPorLinha = new Map();
for (const [texto, lista] of usos) for (const u of lista) {
  const id = `${u.arquivo}\n${u.linha}`;
  if (!trocasPorLinha.has(id)) trocasPorLinha.set(id, []);
  trocasPorLinha.get(id).push({ ...u, texto });
}
for (const [id, lista] of trocasPorLinha) {
  const [arquivo, linhaStr] = id.split("\n");
  const linhas = fontes.get(arquivo);
  let linha = linhas[+linhaStr];
  for (const u of lista.sort((a, b) => b.inicio - a.inicio)) {
    const chave = chaves.get(u.texto);
    const novo = u.completa ? `"${PREFIXO}.${chave}"` : `"${chave}"`;
    linha = linha.slice(0, u.inicio) + novo + linha.slice(u.fim);
  }
  linhas[+linhaStr] = linha;
}
for (const [arquivo, linhas] of fontes) writeFileSync(join(RAIZ, arquivo), linhas.join("\n"));

// JSON aninhados por área, na ordem de aparição
const montar = (idioma) => {
  const raiz = {};
  for (const [area, sub, texto] of ordem) {
    raiz[area] ??= {};
    raiz[area][sub] = idioma === "pt" ? texto : (porTexto.get(texto).en ?? texto);
  }
  return { [PREFIXO]: raiz };
};
writeFileSync(join(RAIZ, "lang/pt-BR.json"), JSON.stringify(montar("pt"), null, 2) + "\n");
writeFileSync(join(RAIZ, "lang/en.json"), JSON.stringify(montar("en"), null, 2) + "\n");
console.log("\nFontes e lang/*.json reescritos.");
