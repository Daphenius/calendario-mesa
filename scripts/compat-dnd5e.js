/* =========================================================
 * Calendário da Mesa — D&D 5e
 * Tudo o que depende do sistema D&D 5e fica aqui, e só pelos caminhos que o próprio sistema documenta
 * (https://github.com/foundryvtt/dnd5e/wiki/Calendar):
 *  - dnd5e.dataModels.calendar.CalendarData5e: a base do nosso calendário. O HUD de calendário do sistema
 *    acha nele os formatadores dele, e a recuperação "ao amanhecer / ao anoitecer" usa o nascer e o pôr do
 *    sol das nossas estações;
 *  - hook dnd5e.setupCalendar devolvendo false: o calendário vem do módulo, então o sistema não carrega o
 *    dele (o escolhido nas configurações do D&D fica guardado para "Importar do mundo");
 *  - CONFIG.DND5E.calendar.application = null: esconde o HUD do sistema (opção "HUD de calendário do D&D 5e");
 *  - options.dnd5e.deltas no updateWorldTime: o sistema deixa os módulos corrigirem a contagem de
 *    meias-noites, meios-dias, amanheceres e anoiteceres antes de recuperar os usos "por dia".
 * Feito para o D&D 5e 6.x. Se uma dessas peças sumir numa versão nova do sistema, o módulo avisa no console
 * (F12) e segue funcionando sem aquela integração.
 * ========================================================= */

import { infoDia, solDe } from "./datas.js";
import { CFG, diaTotalDe, noMundo, segDia, segHora } from "./nucleo.js";

const ID = "calendario-mesa";            // (o nucleo.js ainda não carregou quando este arquivo começa)
const VERSAO_FEITA = "6";                // versão do D&D 5e para a qual a integração foi feita e testada
const ehDnd5e = () => globalThis.game?.system?.id === "dnd5e";

const AVISADOS = new Set();
/** Avisa no console (uma vez) que uma peça do D&D 5e não está onde o módulo espera. */
function avisar(peca) {
  if (AVISADOS.has(peca)) return;
  AVISADOS.add(peca);
  console.warn(`${ID} | D&D 5e ${globalThis.game?.system?.version ?? "?"}: ${peca} não está onde o Calendário da Mesa espera `
    + `(integração feita para o D&D 5e ${VERSAO_FEITA}.x). O calendário continua funcionando; só essa parte da integração com o sistema fica desligada.`);
}

/* ---------- base do calendário ---------- */
function baseDoCalendario() {
  const base5e = globalThis.dnd5e?.dataModels?.calendar?.CalendarData5e;
  if (base5e) return base5e;
  if (ehDnd5e()) avisar("dnd5e.dataModels.calendar.CalendarData5e");
  return foundry.data.CalendarData;
}
/** Base do calendário do módulo: CalendarData5e com o D&D 5e; CalendarData do Foundry nos outros sistemas. */
const CalendarioBase = baseDoCalendario();

/* ---------- o calendário do mundo vem do módulo ---------- */
let CAL_DO_SISTEMA = null;
Hooks.on("dnd5e.setupCalendar", () => {
  try {
    const escolhido = game.settings.get("dnd5e", "calendar");
    CAL_DO_SISTEMA = CONFIG.DND5E?.calendar?.calendars?.find?.((c) => c.value === escolhido)?.config ?? null;
  } catch { avisar("a configuração \"calendar\" do sistema"); }
  return false;
});
/** Calendário que o D&D 5e teria carregado (para "Importar do mundo"), ou null fora do D&D 5e. */
const calendarioDoSistema = () => CAL_DO_SISTEMA;

/* ---------- HUD do sistema ---------- */
/** No "setup": esconde o HUD de calendário do D&D 5e (ele é criado no "ready"), para não haver dois relógios na tela. */
function prepararHudDoSistema(esconder) {
  if (!ehDnd5e()) return;
  const cal = CONFIG.DND5E?.calendar;
  if (!cal || !("application" in cal)) return avisar("CONFIG.DND5E.calendar.application");
  if (esconder) cal.application = null;
}

/* ---------- contagem de tempo para a recuperação de usos ---------- */
/** O D&D 5e conta quantas meias-noites, meios-dias, amanheceres e anoiteceres passaram (para recuperar usos
 *  "por dia", "ao amanhecer" e "ao anoitecer"). A conta dele erra com meses que somem e com o nascer do sol
 *  mudando por estação; aqui ela é refeita dia a dia, pelo calendário principal do mundo (o mesmo do game.time),
 *  antes de o sistema usar (ele lê depois, num hook registrado no "ready" para isso). */
function corrigirDeltasDnd5e(wt, delta, options) {
  if (!ehDnd5e() || !(delta > 0) || !CFG) return;
  const d = options?.dnd5e?.deltas;
  if (!d) return avisar("options.dnd5e.deltas (updateWorldTime)");
  try {
    noMundo(() => {
      const antes = wt - delta, sd = segDia(), sh = segHora();
      const d0 = diaTotalDe(antes), d1 = diaTotalDe(wt);
      const conta = (hora) => {
        let n = 0;
        for (let td = d0; td <= d1 && td <= d0 + 4000; td++) { const t = td * sd + hora(td) * sh; if (t > antes && t <= wt) n++; }
        return d1 - d0 > 4000 ? n + (d1 - d0 - 4000) : n;
      };
      const solDoDia = (td) => { const i = infoDia(td); return solDe(i.mes, i.dia); };
      d.midnights = d1 - d0;
      d.middays = conta(() => CFG.horasDia / 2);
      if (d.sunrises != null) d.sunrises = conta((td) => solDoDia(td).nascer);
      if (d.sunsets != null) d.sunsets = conta((td) => solDoDia(td).por);
    });
  } catch (err) { console.warn(`${ID} | não consegui ajustar a contagem de tempo do D&D 5e`, err); }
}

export { CalendarioBase, calendarioDoSistema, corrigirDeltasDnd5e, prepararHudDoSistema };
