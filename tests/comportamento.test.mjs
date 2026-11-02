/* Comportamento num Foundry simulado (foundry-falso.mjs): na raiz do repositório, node --test
 * Cada teste monta a situação, faz o tempo passar como o Foundry faria e confere o resultado gravado:
 * - "ver como" um calendário de dia mais curto não muda a contagem de dias do mundo (dia do Journal, clima);
 * - "Desfazer" depois de dois avanços rápidos restaura o estado certo;
 * - ações de notas de um calendário secundário disparam na hora dele, e a macro recebe a data nesse calendário;
 * - contador com aviso "nenhum" não manda mensagem (mas entra no histórico);
 * - as mensagens saem com o nome do remetente traduzido;
 * - efeitos vencidos expiram num avanço de segundos (fora do relógio em tempo real);
 * - o socket só atende pedidos válidos, e o jogador só pede por si mesmo. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { montar } from "./foundry-falso.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const url = (p) => pathToFileURL(join(RAIZ, p)).href;
const MOD = "calendario-mesa";
const F = montar(RAIZ);
await import(url("scripts/calendario.js"));
await F.rodar("init"); await F.rodar("i18nInit"); await F.rodar("setup");
game.ready = true; await F.rodar("ready");
const { aoMudarTempo, desfazerUltimoPulo, expirarEfeitos } = await import(url("scripts/relogio.js"));
const api = game.modules.get(MOD).api;
const chat = () => (globalThis.__chat ??= []);
const set = (k, v) => game.settings.set(MOD, k, v);
const principal = () => structuredClone(game.settings.get(MOD, "config"));

/** Faz o tempo do mundo ir para "depois" e espera o módulo processar (como o hook updateWorldTime). */
async function irPara(depois) {
  const antes = game.time.worldTime;
  game.time.worldTime = depois;
  await aoMudarTempo(depois, depois - antes);
}
/** Volta tudo ao normal entre os testes. */
async function limpar() {
  await set("calendarios", {}); await set("calendarioVisto", "");
  await set("contadores", { lista: [] }); await set("historico", { itens: [] });
  await set("climaAtual", {}); await set("climaPrevisao", { dias: {} }); await set("efeitosVencidos", "nao");
  game.journal.length = 0; game.actors.length = 0;
  F.diasJournal.length = 0; F.macrosRodadas.length = 0; chat().length = 0;
}
/** Mundo com o calendário de exemplo (24 h) como principal e uma cópia de 12 h como "b". */
async function doisCalendarios() {
  const p = principal();
  await set("calendarios", { principal: "a", lista: { a: p, b: { ...structuredClone(p), nome: "Dia curto", horasDia: 12 } } });
}

test("ver como um dia mais curto não conta dia novo no mundo", async () => {
  await limpar(); await doisCalendarios(); await set("calendarioVisto", "b");
  const dia = 500 * 86400;
  game.time.worldTime = dia + 11 * 3600;
  await irPara(dia + 13 * 3600);                       // 11h → 13h do mundo: mesmo dia
  assert.deepEqual(F.diasJournal, [], "o dia do Journal não pode andar");
  const climaAntes = game.settings.get(MOD, "climaAtual")?.td;
  await irPara(dia + 86400 + 1 * 3600);                // passou da meia-noite do mundo
  assert.deepEqual(F.diasJournal, [1], "um dia do mundo = um dia no Journal");
  assert.equal(game.settings.get(MOD, "climaAtual").td, 501, "o clima do dia é do dia do mundo");
  assert.notEqual(climaAntes, 501);
  assert.ok(api.clima("temperada"), "o clima de hoje aparece para quem vê outro calendário");
  await limpar();
});

test("desfazer depois de dois avanços rápidos restaura o estado certo", async () => {
  await limpar();
  game.time.worldTime = 0;
  await set("contadores", { lista: [{ id: "c1", nome: "Ritual", inicio: 0, fim: 10, visivel: true, aviso: "mestre", feito: false }] });
  // 0 → 20 → 30 sem esperar o primeiro terminar
  game.time.worldTime = 20; const a = aoMudarTempo(20, 20);
  game.time.worldTime = 30; const b = aoMudarTempo(30, 10);
  await Promise.all([a, b]);
  assert.equal(game.settings.get(MOD, "contadores").lista[0].feito, true);
  assert.ok(await desfazerUltimoPulo(), "desfaz o segundo avanço");
  await aoMudarTempo(game.time.worldTime, -10);       // o Foundry avisa a volta do tempo
  assert.equal(game.time.worldTime, 20);
  assert.equal(game.settings.get(MOD, "contadores").lista[0].feito, true, "no segundo 20 o contador já tinha terminado");
  assert.ok(game.settings.get(MOD, "historico").itens.some((h) => /Ritual/.test(h.texto)), "o registro do contador continua no histórico");
  await limpar();
});

test("ação de nota de um calendário secundário dispara na hora dele", async () => {
  await limpar(); await doisCalendarios();
  // nota do calendário "b" (dias de 12 h) no dia 2, à 01:00 → segundo 2 × 43200 + 3600 = 90000 do mundo
  const nota = { td: 2, hora: "01:00", repetir: "nao", cal: "b", aviso: "todos" };
  game.journal.push(F.diario({ id: "n1", name: "Sino", nota, acoes: { macro: "m1" } }));
  game.time.worldTime = 24 * 3600;
  await irPara(26 * 3600);
  assert.ok(chat().some((c) => /Sino/.test(c)), "o aviso sai");
  assert.deepEqual(F.macrosRodadas.map((m) => m.id), ["m1"], "a macro roda");
  await limpar();
});

test("a macro de uma nota recebe a data no calendário da nota", async () => {
  await limpar();
  // "b": mesmas horas, mas o primeiro mês tem só 2 dias → o dia 2 é o 1º dia do 2º mês (no principal, o 3º do 1º)
  const p = principal();
  const b = structuredClone(p); b.nome = "Meses curtos"; b.meses[0].dias = 2; b.meses[0].diasBissexto = 2;
  await set("calendarios", { principal: "a", lista: { a: p, b } });
  game.journal.push(F.diario({ id: "n2", name: "Festa", nota: { td: 2, hora: "01:00", repetir: "nao", cal: "b" }, acoes: { macro: "m2" } }));
  game.time.worldTime = 2 * 86400;
  await irPara(2 * 86400 + 2 * 3600);
  assert.equal(F.macrosRodadas.length, 1, "a macro roda");
  const { td, data } = F.macrosRodadas[0];
  assert.equal(td, 2);
  assert.deepEqual({ mes: data.mes, dia: data.dia }, { mes: 1, dia: 0 }, "1º dia do 2º mês do calendário da nota");
  await limpar();
});

test("contador com aviso \"nenhum\" não manda mensagem, mas entra no histórico", async () => {
  await limpar();
  game.time.worldTime = 0;
  await api.contador("Silencioso", 60, { aviso: "nenhum" });
  await irPara(120);
  assert.equal(game.settings.get(MOD, "contadores").lista[0].feito, true);
  assert.ok(!chat().some((c) => /Silencioso/.test(c)), "nenhuma mensagem");
  assert.ok(game.settings.get(MOD, "historico").itens.some((h) => /Silencioso/.test(h.texto)));
  await limpar();
});

test("mensagens saem com o nome do remetente traduzido", async () => {
  await limpar();
  const antes = ChatMessage.create;
  const falas = [];
  ChatMessage.create = async (d) => { falas.push(d.speaker?.alias); return d; };
  game.time.worldTime = 0;
  await api.contador("Aviso", 60, { aviso: "todos" });
  await irPara(120);
  ChatMessage.create = antes;
  assert.ok(falas.length, "mandou mensagem");
  assert.deepEqual([...new Set(falas)], ["Calendar"]);
  await limpar();
});

test("efeito de 6 s expira num avanço de 12 s", async () => {
  await limpar(); await set("efeitosVencidos", "remover");
  const apagados = [];
  const efeito = { id: "e1", name: "Bênção", disabled: false, duration: { startTime: 100, seconds: 6 } };
  game.actors.push({ uuid: "Actor.a1", name: "Heroína", effects: [efeito], deleteEmbeddedDocuments: async (t, ids) => { apagados.push(...ids); } });
  game.time.worldTime = 100;
  await irPara(112);                                   // mesmo minuto do jogo
  assert.deepEqual(apagados, ["e1"]);
  assert.ok(typeof expirarEfeitos === "function");
  await limpar();
});

test("socket: só pedidos válidos, e o jogador só pede por si mesmo", async () => {
  await limpar();
  const viagem = { ativa: true, fase: "escolha", vigias: { n: 2, participantes: ["u1", "u2"], escolhas: {}, atual: 0, inicio: 0 } };
  await set("viagem", viagem);
  const ouvir = F.socketOuvintes[`module.${MOD}`][0];
  const escolhas = () => game.settings.get(MOD, "viagem").vigias.escolhas;
  const espera = () => new Promise((r) => setTimeout(r, 20));
  ouvir({ acao: "apagarTudo" }, "u2"); await espera();
  ouvir({ acao: "vigiaEscolher", userId: "u2", vigia: "x" }, "u2"); await espera();
  ouvir({ acao: "vigiaEscolher", userId: "u1", vigia: 0 }, "u2"); await espera();   // jogadora pedindo pelo mestre
  ouvir({ acao: "vigiaEscolher", userId: "u9", vigia: 0 }, "u9"); await espera();   // usuário que não existe
  assert.deepEqual(escolhas(), {}, "nada muda com pedidos inválidos");
  ouvir({ acao: "vigiaEscolher", userId: "u2", vigia: 1 }, "u2"); await espera();
  assert.deepEqual(escolhas(), { u2: 1 }, "o pedido da própria jogadora vale");
  ouvir({ acao: "vigiaEscolher", userId: "u2", vigia: 0 }, "u1"); await espera();   // o mestre pode pedir por ela
  assert.deepEqual(escolhas(), { u2: 0 });
  await set("viagem", {});
});
