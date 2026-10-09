import { BLOQUEIO_MS } from "./agenda.js";
import { apuracaoComecou } from "./map.js";
import { decidirTela } from "./view.js";

export class ApuracaoCache {
  constructor() {
    this.turno1 = null;
    this.turno2 = null;
    this.statusTurno2 = null;
    this.etag = { 6257: null, 6258: null };
    this.bloqueadoAte = null;
    this.ultimoErro = null;
    this.ultimoAlvo = null;
  }

  tela(agora = new Date()) {
    const tela = decidirTela({
      agora,
      turno1: this.turno1,
      turno2: this.turno2,
      statusTurno2: this.statusTurno2,
    });
    if (this.ultimoErro) {
      tela.avisoAtualizacao = this.ultimoErro;
    }
    return tela;
  }

  sqcandsConhecidos() {
    const ids = new Set();
    for (const json of [this.turno1, this.turno2]) {
      if (!json) continue;
      const eleicao = String(json.ele ?? "");
      for (const grupo of json.carg?.[0]?.agr ?? []) {
        for (const partido of grupo.par ?? []) {
          for (const cand of partido.cand ?? []) {
            if (cand.sqcand) ids.add(`${eleicao}/${cand.sqcand}`);
          }
        }
      }
    }
    return ids;
  }

  aplicar(codigo, resultado, agora = new Date()) {
    if (resultado.status === 429 || resultado.status === 403) {
      this.bloqueadoAte = new Date(agora.getTime() + BLOQUEIO_MS);
      this.ultimoErro = "O TSE limitou as consultas deste IP. Nova tentativa em 10 minutos. Os números exibidos são da última leitura válida.";
      return { fotos: [] };
    }

    if (resultado.status === 304) {
      this.ultimoErro = null;
      this.bloqueadoAte = null;
      if (resultado.etag) this.etag[codigo] = resultado.etag;
      return { fotos: [] };
    }

    if (resultado.status === 200 && resultado.json) {
      this.etag[codigo] = resultado.etag;
      this.ultimoErro = null;
      this.bloqueadoAte = null;
      if (codigo === "6257") this.turno1 = resultado.json;
      if (codigo === "6258") {
        this.turno2 = resultado.json;
        this.statusTurno2 = 200;
      }
      return { fotos: fotosDoJson(resultado.json) };
    }

    if (resultado.status === 404 && codigo === "6258") {
      if (this.turno2 && apuracaoComecou(this.turno2)) {
        this.ultimoErro = "A consulta ao 2º turno voltou 404. A última apuração recebida continua na tela.";
        return { fotos: [] };
      }
      this.statusTurno2 = 404;
      this.turno2 = null;
      this.etag[codigo] = null;
      this.ultimoErro = null;
      return { fotos: [] };
    }

    this.ultimoErro = "Não foi possível atualizar agora. Os números exibidos são da última leitura válida.";
    return { fotos: [] };
  }
}

function fotosDoJson(json) {
  const eleicao = String(json.ele ?? "");
  const fotos = [];
  for (const grupo of json.carg?.[0]?.agr ?? []) {
    for (const partido of grupo.par ?? []) {
      for (const cand of partido.cand ?? []) {
        if (/^\d+$/.test(String(cand.sqcand ?? ""))) {
          fotos.push({ eleicao, sqcand: String(cand.sqcand) });
        }
      }
    }
  }
  return fotos;
}
