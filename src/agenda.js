import { antesDaDivulgacao, janelaCritica } from "./clock.js";

export const INTERVALO_AO_VIVO_MS = 60_000;
export const INTERVALO_FORA_MS = 3 * 60_000;
export const BLOQUEIO_MS = 10 * 60_000;

export function emRitmoDeApuracao({ agora = new Date(), modo, encerrada }) {
  if (modo === "segundo" && !encerrada) return true;
  if (modo === "aguardando" && !antesDaDivulgacao(agora)) return true;
  if (janelaCritica(agora) && modo !== "segundo") return true;
  return false;
}

export function escolherAlvo({ agora = new Date(), modo, encerrada, ultimoAlvo }) {
  if (modo === "segundo" || modo === "aguardando") return "6258";
  if (emRitmoDeApuracao({ agora, modo, encerrada })) return "6258";
  return ultimoAlvo === "6258" ? "6257" : "6258";
}

export function esperaMs({ agora = new Date(), modo, encerrada, bloqueadoAte = null }) {
  if (bloqueadoAte && agora < bloqueadoAte) {
    return Math.max(1000, bloqueadoAte.getTime() - agora.getTime());
  }
  return emRitmoDeApuracao({ agora, modo, encerrada }) ? INTERVALO_AO_VIVO_MS : INTERVALO_FORA_MS;
}
