/* =========================================================
 * Calendário da Mesa — API pública
 *
 * game.modules.get("calendario-mesa").api, montada no "ready" (calendario.js).
 * O Journal da Mesa e as macros dos mestres usam estes nomes: nenhum pode ser renomeado
 * ou removido sem versão nova e aviso no CHANGELOG.
 *
 * Convenções:
 *  - td: número do dia desde o tempo zero do mundo (o mesmo que as notas gravam).
 *  - Ano "exibido" = com o ano inicial do calendário (ex.: 1023); ano "interno" = contado de 0.
 *  - Em datas.* o mês conta de 0 e o dia de 1; em irPara, mês e dia contam de 1.
 *  - Funções que gravam (avancar, anomalia, contador…) só fazem efeito para o mestre.
 * ========================================================= */

import { abrirCentral } from "./central.js";
import { diagnosticoClima } from "./clima-cenas.js";
import { anomaliaDe, anomaliaRegiaoInteira, ANOMALIAS, anomaliasLigadas, avisoUmaVezCal, climaCfg, climaDe, CLIMAS, gerarPrevisao, ligarRegiaoDaAnomalia, previsao, zonaDaCena, ZONAS } from "./clima.js";
import { alterarContadores, contadores } from "./contadores.js";
import { agora, diasNoMes, eraDoAno, estacaoDe, infoDia, mesExiste, tdDe, textoAno, textoData } from "./datas.js";
import { historico, registrar } from "./historico.js";
import { JanelaCalendario } from "./janela.js";
import { horarioLoja, lojaAberta, lojaFechadaPor } from "./lojas.js";
import { eventosLuasDoDia, faseDe, proximosEventosLuas, textoEventoLua, visibilidadeLua } from "./luas.js";
import { criarNota, dadosNota, descreverRepeticao, editarNota, inicioQueCobre, normalizarNota, notasDoDia, proximasVezes } from "./notas.js";
import { CAL_ID, calDaNota, CFG, diaTotalDe, listaCalendarios, MOD, normalizar, num, T } from "./nucleo.js";
import { avancar, avancarAte, desfazerUltimoPulo, expirarEfeitos, irPara } from "./relogio.js";
import { abrirFerramenta, ferr } from "./sob-demanda.js";
import { viagemAtual } from "./viagem.js";

/** Monta o objeto da API. Cada chamada lê o calendário em uso na hora (nada fica guardado aqui). */
function montarApi() {
  return {
    /* ---------- janelas ---------- */
    /** Abre a janela do calendário. */
    abrir: () => JanelaCalendario.abrir(),
    /** Abre o editor do calendário (mestre). */
    editor: () => abrirFerramenta("EditorCalendario"),
    /** Abre a Central de Configurações. */
    central: () => abrirCentral(),
    /** Abre a janela da viagem (ou o diálogo para começar uma, se não houver viagem). */
    viajar: () => (viagemAtual() ? abrirFerramenta("JanelaViagem") : ferr("dialogoViagem")),
    /** Abre o diálogo "Dia sagrado" (cria a nota de festa de uma divindade do Journal). */
    diaSagrado: () => ferr("dialogoDiaSagrado"),

    /* ---------- tempo ---------- */
    /** Agora: { td, ano (interno), mes, dia (de 0), sem, doy, wt, hora, minuto, horaDec, texto, anoExibido }. */
    agora: () => ({ ...agora(), texto: textoData(agora()), anoExibido: agora().ano + CFG.anoInicial }),
    /** Avança o tempo do mundo em segundos (mestre). @param {number} seg */
    avancar,
    /** Avança até a próxima vez que o relógio marcar a hora pedida (decimal: 6.5 = 06:30) (mestre). @param {number} horaDec */
    avancarAte,
    /** Vai para a data (ano exibido, mês e dia contando de 1), mantendo a hora (mestre). */
    irPara: (ano, mes, dia) => irPara(tdDe(ano - CFG.anoInicial, mes - 1, dia - 1)),
    /** Desfaz o último pulo de tempo, se ainda der (mestre). */
    desfazer: () => desfazerUltimoPulo(),
    /** Estação de hoje ({ nome, mesInicio, diaInicio, nascer, por, icone }) ou null. */
    estacao: () => estacaoDe(agora().mes, agora().dia),
    /** Era do ano atual (como está no editor do calendário) ou null. */
    era: () => eraDoAno(agora().ano),
    /** Texto do ano com a era (ex.: "1023 E.E."). @param {number} [anoInterno] padrão: o ano atual */
    textoAno: (anoInterno = agora().ano) => textoAno(anoInterno),
    /** Texto da data de um dia (ex.: "Dia da Água, 3 de Brasa de 1023 E.E."). @param {number} td */
    textoDia: (td) => textoData(infoDia(Math.trunc(Number(td)))),
    /** Cópia da configuração do calendário em uso (meses, semana, luas, estações, eras…). */
    config: () => foundry.utils.deepClone(CFG),
    /** Calendário em uso aqui: { id, nome }. */
    calendarioAtual: () => ({ id: CAL_ID, nome: CFG.nome }),
    /** Todos os calendários do mundo: [{ id, nome, principal }]. */
    calendarios: () => { const { principal, lista } = listaCalendarios(); return Object.keys(lista).map((id) => ({ id, nome: normalizar(lista[id]).nome, principal: id === principal })); },
    /** Converte o JSON de outro módulo de calendário (Simple Calendar, Seasons & Stars, Calendaria, Fantasy-Calendar,
     *  Foundry) para o formato deste. Devolve uma Promise com { cfg, formato, … } ou null. */
    converter: (json) => ferr("converterCalendario", json),

    /** Datas para o Journal e macros (ano exibido, mês contando de 0, dia contando de 1). */
    datas: {
      /** td de hoje. */
      hoje: () => agora().td,
      /** Partes de um dia: { td, ano, anoInterno, mes, dia, sem, nomeMes, nomeSemana, texto, textoCurto, textoAno, era }. */
      partes: (td) => {
        const inf = infoDia(Math.trunc(Number(td)));
        return { td: inf.td, ano: inf.ano + CFG.anoInicial, anoInterno: inf.ano, mes: inf.mes, dia: inf.dia + 1, sem: inf.sem,
          nomeMes: CFG.meses[inf.mes]?.nome ?? "?", nomeSemana: CFG.semana[inf.sem]?.nome ?? "", texto: textoData(inf), textoCurto: textoData(inf, { semana: false }),
          textoAno: textoAno(inf.ano), era: eraDoAno(inf.ano)?.nome ?? "" };
      },
      /** Meses de um ano exibido: [{ i, nome, dias, existe }] (meses que somem naquele ano têm existe: false e 0 dias). */
      meses: (anoExibido = agora().ano + CFG.anoInicial) => {
        const ano = Math.trunc(Number(anoExibido)) - CFG.anoInicial;
        return CFG.meses.map((m, i) => ({ i, nome: m.nome, dias: diasNoMes(ano, i), existe: mesExiste(ano, i) }));
      },
      /** Nomes dos dias da semana. */
      semana: () => CFG.semana.map((d) => d.nome),
      /** td de uma data (ano exibido, mês de 0, dia de 1), ou null se a data não existe neste calendário. */
      tdDe: (anoExibido, mes, dia) => {
        const ano = Math.trunc(Number(anoExibido)) - CFG.anoInicial;
        mes = Math.trunc(Number(mes)); dia = Math.trunc(Number(dia));
        if (!(mes >= 0 && mes < CFG.meses.length) || !mesExiste(ano, mes) || dia < 1 || dia > diasNoMes(ano, mes)) return null;
        const td = tdDe(ano, mes, dia - 1);
        const inf = infoDia(td);
        return inf.ano === ano && inf.mes === mes && inf.dia === dia - 1 ? td : null;
      }
    },

    /* ---------- notas (Diários com flags["calendario-mesa"].nota) ---------- */
    /** Diários das notas que acontecem num dia (inclusive as que repetem). @param {number} [td] padrão: hoje */
    notasDoDia: (td = agora().td) => notasDoDia(td).map(({ j }) => j),
    notas: {
      /** Dados da nota de um Diário (já corrigidos), ou null se não for nota. */
      ler: (j) => dadosNota(j),
      /** Corrige/completa dados de nota crus (aceita também o formato antigo: anual, mensal…). */
      normalizar: (dados) => normalizarNota(dados),
      /** Frase da repetição (ex.: "A cada 2 semanas: Dia da Água, até 3 de Brasa de 1024"); "" se não for nota. */
      descrever: (j) => { const n = dadosNota(j); return n ? descreverRepeticao(n) : ""; },
      /** Próximas vezes a partir de hoje: [{ td, texto }]. */
      proximas: (j, qtd = 5) => { const n = dadosNota(j); return n ? proximasVezes(n, agora().td, qtd).map((td) => ({ td, texto: textoData(infoDia(td)) })) : []; },
      /** A nota acontece (ou está em andamento, se dura vários dias) neste dia? */
      acontece: (j, td = agora().td) => { const n = dadosNota(j); return !!n && inicioQueCobre(n, td) !== null; },
      /** Nova nota neste dia, pelo editor escolhido nas configurações (Journal da Mesa ou calendário). */
      nova: (td = agora().td) => criarNota(td),
      /** Edita a nota pelo editor escolhido nas configurações. */
      editar: (j) => editarNota(j),
      /** Sempre o diálogo do próprio calendário (o Journal usa para "editar pelo calendário"). */
      dialogo: (td = agora().td, j = null) => ferr("dialogoNota", j ? null : td, j),
      /** Texto da data de um dia (igual a textoDia). */
      dataDe: (td) => textoData(infoDia(td)),
      /** id do calendário da nota (notas sem calendário são do principal); null se não for nota. */
      calendario: (j) => { const r = j?.getFlag?.(MOD, "nota"); return r ? calDaNota(r) : null; }
    },

    /* ---------- lojas (Journal da Mesa) ---------- */
    /** A loja está aberta agora? @param {JournalEntry} e */
    lojaAberta: (e) => lojaAberta(e),
    /** Por que a loja está fechada: "folga", "horario" ou null (aberta). */
    lojaFechadaPor: (e) => lojaFechadaPor(e),
    /** Horário da loja: { ativo, abre, fecha (minutos do dia), folga: [dias da semana] }, ou null se não for loja. */
    horarioLoja: (e) => horarioLoja(e),

    /* ---------- luas ---------- */
    /** Luas com a fase e a visibilidade de hoje: [{ …config da lua (nome, ciclo, cor…), fase (nome da fase), p (posição
     *  no ciclo, 0 a 1), idx, nova, cheia, iluminacao, visivel, sempre | alvoTd + faltaDias }]. */
    luas: () => CFG.luas.map((l) => {
      const f = faseDe(l, agora().td);
      return { ...l, ...f, ...visibilidadeLua(l, agora().td), nome: l.nome, fase: f.nome };
    }),
    /** Eventos das luas num dia (eclipses, luas cheias juntas, noite sem luas), com texto. */
    eventosLuas: (td = agora().td) => eventosLuasDoDia(td).map((e) => ({ ...e, texto: textoEventoLua(e) })),
    /** Próximos eventos das luas (até 20), procurando até "dias" à frente. */
    proximosEventosLuas: (dias = 120) => proximosEventosLuas(agora().td, dias, 20).map((e) => ({ ...e, texto: textoEventoLua(e) })),

    /* ---------- clima ---------- */
    /** Regiões do clima: [{ id, nome }]. */
    zonas: () => Object.entries(ZONAS).filter(([, z]) => !z.virtual).map(([k, z]) => ({ id: k, nome: z.nome })),
    /** Clima de hoje numa região (padrão: a da cena): { zona, tipo, nome, temp, min, max, onda?, anomalia }, ou null. */
    clima: (zona = zonaDaCena()) => { const c = climaDe(zona); return c ? { zona, ...c, nome: CLIMAS[c.tipo]?.nome, anomalia: anomaliaDe(zona) } : null; },
    /** Cópia da previsão: { dias: { td: { zona: { tipo, temp, min, max, onda? } } } }. */
    previsao: () => foundry.utils.deepClone(previsao()),
    /** Rola a previsão dos próximos dias que ainda faltam (mestre). opcoes: { refazer } refaz todos. */
    gerarPrevisao: (opcoes) => gerarPrevisao(undefined, undefined, opcoes),
    /** Mostra no console (F12) como o clima está sendo decidido em cada cena. */
    diagnosticoClima,
    /** Anomalias (vazio com a barra de Anomalias desligada): [{ id, nome, icone, regiao }]; regiao = "Usar como região" ligado. */
    anomalias: () => anomaliasLigadas() ? Object.entries(ANOMALIAS).filter(([k]) => k !== "nenhuma").map(([k, a]) => ({ id: k, nome: a.nome, icone: a.icone, regiao: !!a.regiao })) : [],
    /** Como as anomalias valem agora: { ligadas (barra de Anomalias), regiaoInteira (opção "cobrindo uma região inteira") }. */
    modoAnomalias: () => ({ ligadas: anomaliasLigadas(), regiaoInteira: anomaliaRegiaoInteira() }),
    /** Liga ou desliga a anomalia de uma região inteira (mestre; exige a opção "cobrindo uma região inteira").
     *  tipo: id da anomalia ou null para desligar. Devolve true se gravou. */
    anomalia: async (zona, tipo = null, texto = "") => {
      if (!game.user.isGM || !ZONAS[zona]) return false;
      if (!anomaliaRegiaoInteira()) { avisoUmaVezCal("anomalia-inteira", T("Config.calendario_um_nexus_tentou_ligar_uma")); return false; }
      const cfg = climaCfg();
      cfg.zonas[zona] = { ...(cfg.zonas[zona] ?? {}), anomalia: { tipo: tipo && ANOMALIAS[tipo] ? tipo : "nenhuma", texto: String(texto ?? "").trim() } };
      await game.settings.set(MOD, "climaZonas", cfg);
      return true;
    },
    /** Liga ou desliga o "Usar como região" de uma anomalia (o jeito do Nexus sem a opção de região inteira). */
    anomaliaRegiao: (id, ligar = true) => ligarRegiaoDaAnomalia(id, ligar),

    /* ---------- contadores, histórico, efeitos e viagem ---------- */
    /** Contadores e prazos (o jogador vê só os visíveis): [{ id, nome, fim, tdFim, feito, visivel }]. */
    contadores: () => contadores().filter((c) => game.user.isGM || c.visivel).map((c) => ({ id: c.id, nome: c.nome, fim: c.fim, tdFim: diaTotalDe(num(c.fim, 0)), feito: !!c.feito, visivel: !!c.visivel })),
    /** Cria um contador que termina daqui a "segundos" (mestre). opções: { visivel, aviso: "nenhum" | "mestre" | "todos" }. */
    contador: async (nome, segundos, { visivel = true, aviso = "mestre" } = {}) => {
      if (!game.user.isGM) return false;
      const wt = game.time.worldTime;
      await alterarContadores((lista) => { lista.push({ id: foundry.utils.randomID(), nome, inicio: wt, fim: wt + segundos, visivel, aviso, feito: false }); });
      return true;
    },
    /** Acrescenta uma linha ao histórico da campanha (mestre principal). icone: classe Font Awesome (ex.: "fa-dragon"). */
    registrar: (texto, icone) => registrar(texto, { icone }),
    /** Cópia do histórico da campanha. */
    historico: () => foundry.utils.deepClone(historico()),
    /** O usuário atual pode ver o histórico? (mestre, ou opção "Jogadores veem o histórico" ligada) */
    historicoVisivel: () => game.user.isGM || !!game.settings.get(MOD, "historicoJogadores"),
    /** Aplica agora a regra "Efeitos com duração vencidos" (mestre). */
    expirarEfeitos: () => expirarEfeitos(game.time.worldTime),
    /** Cópia da viagem em andamento, ou null. */
    viagem: () => foundry.utils.deepClone(viagemAtual())
  };
}

export { montarApi };
