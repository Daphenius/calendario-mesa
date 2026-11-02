/* =========================================================
 * Calendário da Mesa — Socket
 * Pedidos dos jogadores ao mestre principal, com validação.
 * ========================================================= */

import { MOD, relatarErro, souGMPrincipal } from "./nucleo.js";
import { escolherVigia } from "./viagem.js";

/* ---------------- socket ----------------
 * Canal do módulo: os jogadores pedem ao mestre principal o que só ele grava (hoje, a escolha de vigia).
 * Cada pedido tem uma validação; pedido desconhecido ou malformado é ignorado. */
const CANAL = `module.${MOD}`;
const PEDIDOS = {
  vigiaEscolher: (msg) => typeof msg.userId === "string" && !!game.users.get(msg.userId)
    && (msg.vigia == null || msg.vigia === "" || Number.isInteger(Number(msg.vigia)))
};
/** Manda um pedido ao mestre principal. */
function enviarSocket(acao, dados = {}) { game.socket.emit(CANAL, { ...dados, acao }); }
/** Mestre principal: atende os pedidos dos jogadores. */
function ouvirSocket() {
  game.socket.on(CANAL, (msg, remetente) => {
    if (!souGMPrincipal() || !msg || typeof msg !== "object" || !Object.hasOwn(PEDIDOS, msg.acao) || !PEDIDOS[msg.acao](msg)) return;
    // o Foundry informa quem mandou: um jogador só pede por si mesmo (o mestre pode pedir por qualquer um)
    if (typeof remetente === "string" && remetente !== msg.userId && !game.users.get(remetente)?.isGM) return;
    if (msg.acao === "vigiaEscolher") escolherVigia(msg.userId, msg.vigia)?.catch?.((err) => relatarErro("Erros.escolha_de_vigia", err));
  });
}

export {
  enviarSocket,
  ouvirSocket
};
