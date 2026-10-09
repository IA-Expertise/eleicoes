import { ARQUIVOS } from "./map.js";

export const AGENTE = "LouveiraNews-Apuracao/1.0 (+https://louveira.com.br)";

export function urlFoto(eleicao, sqcand) {
  return `https://resultados.tse.jus.br/oficial/ele2026/${eleicao}/fotos/br/${sqcand}.jpeg`;
}

export async function baixarJson(url, etag) {
  const headers = {
    Accept: "application/json",
    "User-Agent": AGENTE,
  };
  if (etag) headers["If-None-Match"] = etag;

  const resposta = await fetch(url, {
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });

  const novoEtag = resposta.headers.get("etag") || etag || null;

  if (resposta.status === 304) {
    return { status: 304, etag: novoEtag };
  }

  if (resposta.status === 404) {
    await drenar(resposta);
    return { status: 404, etag: null };
  }

  if (!resposta.ok) {
    await drenar(resposta);
    return { status: resposta.status, etag };
  }

  const texto = await resposta.text();
  try {
    return { status: 200, json: JSON.parse(texto), etag: novoEtag };
  } catch {
    return { status: 502, etag, erro: "json" };
  }
}

export async function baixarFoto(eleicao, sqcand) {
  const resposta = await fetch(urlFoto(eleicao, sqcand), {
    headers: {
      Accept: "image/jpeg",
      "User-Agent": AGENTE,
    },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });

  if (!resposta.ok) {
    await drenar(resposta);
    return { status: resposta.status };
  }

  const tipo = resposta.headers.get("content-type") || "";
  if (!tipo.includes("image/")) {
    await drenar(resposta);
    return { status: 415 };
  }

  const body = Buffer.from(await resposta.arrayBuffer());
  return { status: 200, body, tipo: tipo.split(";")[0] };
}

export function urlDoCodigo(codigo) {
  return ARQUIVOS[codigo];
}

async function drenar(resposta) {
  try {
    await resposta.arrayBuffer();
  } catch {
    /* corpo ilegível não muda o status */
  }
}
