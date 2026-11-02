/* =========================================================
 * Calendário da Mesa — Ferramentas
 * Janelas e diálogos que o núcleo abre pelo nome (ferr("x") e abrirFerramenta("X")). Carregado só na
 * primeira vez que alguém abre uma delas (sob-demanda.js).
 * ========================================================= */

export { JanelaLuz, JanelaTabelas } from "./ferramentas/configuracoes.js";
export { dialogoAcoesNota, dialogoNota } from "./ferramentas/dialogos-notas.js";
export { EditorCalendario } from "./ferramentas/editor.js";
export { converterCalendario } from "./ferramentas/importar.js";
export { dialogoClima, JanelaClima } from "./ferramentas/janela-clima.js";
export { acaoViagem, dialogoViagem, JanelaViagem } from "./ferramentas/janela-viagem.js";
export { dialogoDiaSagrado, JanelaContadores, JanelaHistorico } from "./ferramentas/janelas.js";
