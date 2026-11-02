/* =========================================================
 * Calendário da Mesa — Ferramentas sob demanda
 * Carrega ferramentas.js só quando alguém abre uma das janelas dele.
 * ========================================================= */

import { MOD, relatarErro, T } from "./nucleo.js";

/* ---------------- ferramentas carregadas só quando usadas ---------------- */
/* Editor, importador, luz por hora, histórico, contadores, viagem, clima e dias sagrados ficam em
 * ferramentas.js. O arquivo só é baixado na primeira vez que alguém abre uma dessas janelas,
 * então o jogo carrega mais rápido (principalmente para os jogadores, que quase nunca usam). */
let _ferramentas = null;
/** Carrega o ferramentas.js. A versão no endereço evita que o navegador (ou o Cloudflare) use um arquivo velho
 *  depois de uma atualização. Se falhar, avisa e tenta de novo na próxima vez, sem afetar o resto do módulo. */
const ferramentas = () => (_ferramentas ??= import(new URL(`./ferramentas.js?v=${game.modules.get(MOD)?.version ?? "0"}`, import.meta.url).href)
  .catch((err) => {
    _ferramentas = null;
    console.error(`${MOD} | não consegui carregar ferramentas.js`, err);
    ui.notifications.error(T("Geral.calendario_nao_consegui_abrir_esta_ferramenta"));
    throw err;
  }));
/* A falha ao carregar o arquivo já é avisada em ferramentas(); aqui só se relata erro de dentro da ferramenta. */
const ferr = async (nome, ...args) => {
  let F;
  try { F = await ferramentas(); } catch { return null; }
  try { return await F[nome](...args); } catch (err) { relatarErro(nome, err); return null; }
};
async function abrirFerramenta(nome) {
  let F;
  try { F = await ferramentas(); } catch { return null; }
  try { return await new F[nome]().render({ force: true }); } catch (err) { relatarErro(nome, err); return null; }
}

export {
  abrirFerramenta,
  ferr,
  ferramentas
};
