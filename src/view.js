import { antesDaDivulgacao, manhaDoSegundoTurno } from "./clock.js";
import { apuracaoComecou, FONTE_TEXTO, FONTE_URL, mapearApuracao } from "./map.js";

export const MENSAGEM_AGUARDANDO = "A divulgação do 2º turno ainda não começou.";

export const COMPLEMENTO_ANTES = "Os números oficiais aparecem a partir das 17h de 25/10/2026, horário de Brasília.";

export const COMPLEMENTO_ZERADO =
  "O arquivo oficial do 2º turno ainda está com urnas e votos zerados. A apuração entra nesta página no primeiro boletim com números.";

export const AVISO_ARQUIVO_AUSENTE =
  "O arquivo do 2º turno ainda não foi publicado pelo TSE. Abaixo está o 1º turno, já encerrado.";

export const NOTA_PRIMEIRO =
  "O 1º turno está encerrado. A divulgação do 2º turno começa às 17h de 25/10/2026, horário de Brasília.";

const fonteVazia = {
  texto: FONTE_TEXTO,
  url: FONTE_URL,
  arquivo: "",
};

export function decidirTela({ agora = new Date(), turno1 = null, turno2 = null, statusTurno2 = null }) {
  if (manhaDoSegundoTurno(agora)) {
    return {
      modo: "aguardando",
      mensagem: MENSAGEM_AGUARDANDO,
      complemento: COMPLEMENTO_ANTES,
      fonte: fonteVazia,
    };
  }

  if (statusTurno2 === 200 && apuracaoComecou(turno2)) {
    const apuracao = mapearApuracao(turno2);
    return {
      modo: "segundo",
      apuracao,
      fonte: apuracao.fonte,
    };
  }

  if (!antesDaDivulgacao(agora) && statusTurno2 === 200 && turno2 && !apuracaoComecou(turno2)) {
    return {
      modo: "aguardando",
      mensagem: MENSAGEM_AGUARDANDO,
      complemento: COMPLEMENTO_ZERADO,
      fonte: fonteVazia,
    };
  }

  if (!turno1) {
    return {
      modo: "carregando",
      mensagem: "Carregando os dados oficiais do TSE.",
      fonte: fonteVazia,
    };
  }

  const apuracao = mapearApuracao(turno1);
  const tela = {
    modo: "primeiro",
    apuracao,
    fonte: apuracao.fonte,
  };

  if (antesDaDivulgacao(agora)) {
    tela.nota = NOTA_PRIMEIRO;
  }
  if (!antesDaDivulgacao(agora) && statusTurno2 === 404) {
    tela.aviso = AVISO_ARQUIVO_AUSENTE;
  }
  return tela;
}
