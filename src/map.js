export const FONTE_URL = "https://resultados.tse.jus.br/oficial/app/index.html";

export const ARQUIVOS = {
  6257: "https://resultados.tse.jus.br/oficial/ele2026/6257/dados/br/br-c0001-e006257-u.json",
  6258: "https://resultados.tse.jus.br/oficial/ele2026/6258/dados/br/br-c0001-e006258-u.json",
};

export const FONTE_TEXTO = "Dados oficiais do TSE, sem alteração.";

export function inteiroTse(valor) {
  const digitos = String(valor ?? "").replace(/\D/g, "");
  if (!digitos) return 0;
  const n = Number(digitos);
  return Number.isSafeInteger(n) ? n : 0;
}

/** Urna apurada ou voto totalizado. Arquivo zerado não é resultado. */
export function apuracaoComecou(json) {
  if (!json?.s || !json?.v) return false;
  return inteiroTse(json.s.st) > 0 || inteiroTse(json.v.tv) > 0;
}

export function listarCandidatos(json) {
  const lista = [];
  for (const grupo of json?.carg?.[0]?.agr ?? []) {
    for (const partido of grupo.par ?? []) {
      for (const cand of partido.cand ?? []) {
        lista.push({
          n: texto(cand.n),
          nmu: texto(cand.nmu),
          partido: texto(partido.sg),
          vap: texto(cand.vap),
          pvap: texto(cand.pvap),
          st: texto(cand.st),
          sqcand: texto(cand.sqcand),
          seq: texto(cand.seq),
        });
      }
    }
  }
  lista.sort((a, b) => {
    const porVotos = inteiroTse(b.vap) - inteiroTse(a.vap);
    if (porVotos !== 0) return porVotos;
    return (inteiroTse(a.seq) || 9999) - (inteiroTse(b.seq) || 9999);
  });
  return lista;
}

export function mapearApuracao(json) {
  const eleicao = texto(json.ele);
  const candidatos = listarCandidatos(json).map((cand) => ({
    n: cand.n,
    nmu: cand.nmu,
    partido: cand.partido,
    vap: cand.vap,
    pvap: cand.pvap,
    st: cand.st,
    sqcand: cand.sqcand,
    foto: /^\d+$/.test(cand.sqcand) ? `/fotos/${eleicao}/${cand.sqcand}.jpeg` : "",
  }));

  return {
    turno: json.t === "2" || json.t === 2 ? 2 : 1,
    eleicao,
    encerrada: json.and === "f",
    dg: texto(json.dg),
    hg: texto(json.hg),
    urnas: {
      pst: texto(json.s?.pst),
      st: texto(json.s?.st),
      ts: texto(json.s?.ts),
    },
    votos: {
      tv: texto(json.v?.tv),
      vvc: texto(json.v?.vvc),
      pvvc: texto(json.v?.pvvc),
      vb: texto(json.v?.vb),
      pvb: texto(json.v?.pvb),
      vn: texto(json.v?.vn),
      pvn: texto(json.v?.pvn),
    },
    eleitorado: {
      c: texto(json.e?.c),
      a: texto(json.e?.a),
      pc: texto(json.e?.pc),
      pa: texto(json.e?.pa),
    },
    candidatos,
    fonte: {
      texto: FONTE_TEXTO,
      url: FONTE_URL,
      arquivo: ARQUIVOS[eleicao] ?? "",
    },
  };
}

function texto(valor) {
  if (valor === undefined || valor === null) return "";
  return String(valor);
}
