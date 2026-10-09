/** Largura da barra a partir do pvap publicado, por exemplo "47,03". */
export function larguraDoPercentual(pvap) {
  const n = Number(String(pvap ?? "").trim().replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

/** Agrupa milhares para leitura. O valor do TSE permanece o mesmo. */
export function milhar(valor) {
  const digitos = String(valor ?? "").replace(/\D/g, "");
  if (!digitos) return "0";
  return digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
