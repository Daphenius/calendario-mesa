/* Carga do módulo num Foundry simulado (foundry-falso.mjs): na raiz do repositório, node --test
 * - os arquivos carregam e os hooks init, i18nInit, setup e ready rodam sem erro;
 * - os menus das configurações apontam para janelas de verdade;
 * - a API tem tudo o que o Journal da Mesa usa, e as datas fazem a volta td → data → td;
 * - o socket ignora pedidos desconhecidos ou de outro jogador;
 * - "ver como" outro calendário não muda o game.time, e a luz segue o calendário do mundo;
 * - D&D 5e: o sistema não carrega o calendário dele, o HUD dele some e a contagem de meias-noites é corrigida;
 * - as ferramentas sob demanda carregam. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { montar } from "./foundry-falso.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const url = (p) => pathToFileURL(join(RAIZ, p)).href;
const F = montar(RAIZ);

test("carrega e roda init, i18nInit, setup e ready", async () => {
  await import(url("scripts/calendario.js"));
  await F.rodar("init"); await F.rodar("i18nInit"); await F.rodar("setup");
  game.ready = true; await F.rodar("ready");
  assert.ok(game.modules.get("calendario-mesa").api, "API montada");
  assert.deepEqual(F.erros, [], "avisos de erro na tela");
});

test("menus das configurações abrem janelas de verdade", () => {
  for (const [chave, menu] of F.menus) {
    assert.equal(typeof menu.type, "function", chave);
    assert.ok(menu.type.DEFAULT_OPTIONS?.id, `${chave}: ${menu.type.name} não é uma janela`);
  }
  assert.equal(F.menus.size, 3);
});

test("API: tudo o que o Journal da Mesa usa", () => {
  const api = game.modules.get("calendario-mesa").api;
  const usos = ["abrir", "agora", "anomalia", "anomaliaRegiao", "anomalias", "calendarioAtual", "clima", "contadores", "historico", "historicoVisivel",
    "horarioLoja", "lojaFechadaPor", "modoAnomalias", "notasDoDia", "proximosEventosLuas", "registrar", "zonas",
    "notas.calendario", "notas.descrever", "notas.proximas", "datas.tdDe", "datas.hoje", "datas.partes", "datas.meses", "datas.semana"];
  assert.deepEqual(usos.filter((u) => typeof u.split(".").reduce((o, k) => o?.[k], api) !== "function"), []);
});

test("datas: td → partes → td volta ao mesmo dia", () => {
  const { datas } = game.modules.get("calendario-mesa").api;
  for (const td of [-800, -1, 0, 1, 359, 360, 4000, 40000]) {
    const p = datas.partes(td);
    assert.equal(datas.tdDe(p.ano, p.mes, p.dia), td, `td ${td}`);
  }
  assert.equal(datas.tdDe(1000, 0, 99), null, "dia que não existe");
});

test("socket: pedido desconhecido, malformado ou de outro jogador é ignorado", () => {
  const ouvir = F.socketOuvintes["module.calendario-mesa"]?.[0];
  assert.equal(typeof ouvir, "function");
  for (const [msg, de] of [[{ acao: "apagarTudo" }, "u1"], [{ acao: "vigiaEscolher", userId: "u1", vigia: "x" }, "u1"], [{ acao: "vigiaEscolher", userId: "u1", vigia: 0 }, "outro"], [null, "u1"]]) {
    assert.doesNotThrow(() => ouvir(msg, de));
  }
});

test("\"ver como\" não mexe no game.time; a luz segue o calendário do mundo", async () => {
  const MOD = "calendario-mesa";
  const { estadoLuz } = await import(url("scripts/luz.js"));
  const principal = game.settings.get(MOD, "config");
  const outro = { ...structuredClone(principal), nome: "Dia longo", horasDia: 30 };
  await game.settings.set(MOD, "calendarios", { principal: "a", lista: { a: principal, b: outro } });
  const horas = () => game.time.calendar.days.hoursPerDay;
  const wt = game.time.worldTime;
  const luzAntes = estadoLuz(wt);
  assert.equal(horas(), 24);
  await game.settings.set(MOD, "calendarioVisto", "b");
  const api = game.modules.get(MOD).api;
  assert.equal(api.calendarioAtual().id, "b", "o módulo mostra o calendário escolhido");
  assert.equal(api.config().horasDia, 30);
  assert.equal(horas(), 24, "o Foundry continua no calendário do mundo");
  assert.deepEqual(estadoLuz(wt), luzAntes, "a luz não muda com o ver como");
  await game.settings.set(MOD, "calendarioVisto", "");
  await game.settings.set(MOD, "calendarios", {});
  assert.equal(api.calendarioAtual().id, "padrao");
});

test("D&D 5e: calendário do módulo, HUD do sistema escondido e contagem de tempo corrigida", async () => {
  assert.equal(Hooks.call("dnd5e.setupCalendar"), false, "o sistema não carrega o calendário dele");
  assert.equal(CONFIG.DND5E.calendar.application, null, "HUD do sistema escondido");
  // 3 dias e 2 horas: o sistema mandaria uma conta qualquer; o módulo refaz pelo calendário
  const delta = 3 * 86400 + 2 * 3600, wt = game.time.worldTime + delta;
  const options = { dnd5e: { deltas: { midnights: 99, middays: 99, sunrises: 99, sunsets: 99 } } };
  for (const f of F.hooks.updateWorldTime) f(wt, delta, options);
  const d = options.dnd5e.deltas;
  assert.ok(d.midnights === 3 || d.midnights === 4, `meias-noites: ${d.midnights}`);
  assert.ok([d.middays, d.sunrises, d.sunsets].every((n) => n >= 2 && n <= 4), JSON.stringify(d));
});

test("ferramentas sob demanda carregam", async () => {
  const { ferramentas } = await import(url("scripts/sob-demanda.js"));
  const F2 = await ferramentas();
  for (const n of ["EditorCalendario", "JanelaClima", "JanelaContadores", "JanelaHistorico", "JanelaLuz", "JanelaTabelas", "JanelaViagem", "dialogoNota", "converterCalendario"]) assert.ok(F2[n], n);
});
