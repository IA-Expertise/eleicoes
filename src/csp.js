const PADRAO = "https://louveira.com.br https://www.louveira.com.br";

export function origensPermitidas(bruto) {
  const texto = (bruto ?? "").trim() || PADRAO;
  const origens = texto.split(/[\s,]+/).filter(Boolean);
  for (const origem of origens) {
    if (origem === "'self'") continue;
    if (!/^https:\/\/(\*\.)?[A-Za-z0-9.-]+(?::\d+)?$/.test(origem)) {
      throw new Error(`Origem inválida em FRAME_ANCESTORS: ${origem}`);
    }
  }
  if (origens.length === 0) {
    throw new Error("FRAME_ANCESTORS não pode ficar vazio.");
  }
  return origens.join(" ");
}

export function montarCsp(frameAncestors) {
  return [
    "default-src 'self'",
    "img-src 'self'",
    "style-src 'self'",
    "style-src-attr 'unsafe-inline'",
    "script-src 'self'",
    "connect-src 'self'",
    "base-uri 'self'",
    "form-action 'none'",
    "object-src 'none'",
    `frame-ancestors ${frameAncestors}`,
  ].join("; ");
}
