const FUSO = "America/Sao_Paulo";

/** 17h de 25/10/2026 em Brasília. O país não usa horário de verão. */
export const INICIO_DIVULGACAO_MS = Date.parse("2026-10-25T17:00:00-03:00");

/** Dez minutos antes, para achar o arquivo do 2º turno sem esperar o relógio bater 17h. */
export const INICIO_JANELA_MS = Date.parse("2026-10-25T16:50:00-03:00");

/** Depois disso, se o 2º turno ainda não começou, volta ao ritmo lento. */
export const FIM_JANELA_MS = Date.parse("2026-10-26T06:00:00-03:00");

export function partesBrasilia(data = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const partes = {};
  for (const parte of fmt.formatToParts(data)) {
    if (parte.type !== "literal") partes[parte.type] = parte.value;
  }
  if (partes.hour === "24") partes.hour = "00";
  return partes;
}

export function carimboBrasilia(data = new Date()) {
  const p = partesBrasilia(data);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}

export function antesDaDivulgacao(data = new Date()) {
  return data.getTime() < INICIO_DIVULGACAO_MS;
}

/** Manhã de 25/10/2026, antes das 17h de Brasília. */
export function manhaDoSegundoTurno(data = new Date()) {
  if (!antesDaDivulgacao(data)) return false;
  const p = partesBrasilia(data);
  return p.year === "2026" && p.month === "10" && p.day === "25";
}

export function janelaCritica(data = new Date()) {
  const t = data.getTime();
  return t >= INICIO_JANELA_MS && t < FIM_JANELA_MS;
}
