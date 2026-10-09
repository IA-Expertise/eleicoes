import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { escolherAlvo, esperaMs, INTERVALO_AO_VIVO_MS, INTERVALO_FORA_MS } from "../src/agenda.js";
import { ApuracaoCache } from "../src/cache.js";
import { antesDaDivulgacao, janelaCritica, manhaDoSegundoTurno } from "../src/clock.js";
import { montarCsp, origensPermitidas } from "../src/csp.js";
import { apuracaoComecou, mapearApuracao } from "../src/map.js";
import { criarAplicacao } from "../src/server.js";
import { decidirTela } from "../src/view.js";
import { larguraDoPercentual, milhar } from "../public/percentual.js";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const turno1 = JSON.parse(readFileSync(join(fixtures, "turno1.json"), "utf8"));
const turno2 = JSON.parse(readFileSync(join(fixtures, "turno2.json"), "utf8"));

const manha = new Date("2026-10-25T15:00:00Z");
const vespera = new Date("2026-10-09T18:00:00Z");
const depois = new Date("2026-10-25T21:00:00Z");

test("relógio de Brasília marca 17h de 25/10/2026", () => {
  assert.equal(antesDaDivulgacao(new Date("2026-10-25T19:59:59Z")), true);
  assert.equal(antesDaDivulgacao(new Date("2026-10-25T20:00:00Z")), false);
  assert.equal(manhaDoSegundoTurno(manha), true);
  assert.equal(manhaDoSegundoTurno(vespera), false);
  assert.equal(manhaDoSegundoTurno(new Date("2026-10-24T23:30:00Z")), false);
  assert.equal(janelaCritica(new Date("2026-10-25T19:50:00Z")), true);
  assert.equal(janelaCritica(new Date("2026-10-25T19:49:00Z")), false);
});

test("o 1º turno conserva os percentuais publicados", () => {
  const apuracao = mapearApuracao(turno1);
  assert.equal(apuracao.encerrada, true);
  assert.equal(apuracao.turno, 1);
  assert.equal(apuracao.dg, "05/10/2026");
  assert.equal(apuracao.hg, "12:51:47");
  assert.equal(apuracao.urnas.pst, "100,00");
  assert.equal(apuracao.urnas.st, turno1.s.st);
  assert.equal(apuracao.urnas.ts, turno1.s.ts);
  assert.equal(apuracao.votos.vvc, turno1.v.vvc);
  assert.equal(apuracao.votos.vb, turno1.v.vb);
  assert.equal(apuracao.votos.vn, turno1.v.vn);
  assert.equal(apuracao.eleitorado.a, turno1.e.a);
  assert.equal(apuracao.eleitorado.pa, turno1.e.pa);
  assert.equal(apuracao.candidatos[0].nmu, "FLAVIO BOLSONARO");
  assert.equal(apuracao.candidatos[0].pvap, "47,03");
  assert.equal(apuracao.candidatos[0].vap, "56104503");
  assert.equal(apuracao.candidatos[0].partido, "PL");
  assert.equal(apuracao.candidatos[0].st, "2º turno");
  assert.equal(apuracao.candidatos[1].nmu, "LULA");
  assert.equal(apuracao.candidatos[1].pvap, "45,16");
  assert.equal(apuracao.candidatos.length, 12);
  assert.equal(JSON.stringify(apuracao).includes('"e":'), false);
});

test("arquivo zerado do 2º turno não é apuração", () => {
  assert.equal(apuracaoComecou(turno2), false);
  assert.equal(apuracaoComecou(turno1), true);
});

test("antes do dia 25 mostra o 1º turno, sem os zeros do 2º", () => {
  const tela = decidirTela({ agora: vespera, turno1, turno2, statusTurno2: 200 });
  assert.equal(tela.modo, "primeiro");
  assert.equal(tela.apuracao.candidatos[0].pvap, "47,03");
  assert.equal(tela.nota.includes("17h"), true);
});

test("na manhã de 25/10 a tela avisa que a divulgação não começou", () => {
  const tela = decidirTela({ agora: manha, turno1, turno2, statusTurno2: 200 });
  assert.equal(tela.modo, "aguardando");
  assert.equal(tela.mensagem, "A divulgação do 2º turno ainda não começou.");
  assert.equal(tela.apuracao, undefined);
});

test("depois das 17h, zero continua fora da tela", () => {
  const tela = decidirTela({ agora: depois, turno1, turno2, statusTurno2: 200 });
  assert.equal(tela.modo, "aguardando");
  assert.equal(tela.apuracao, undefined);
});

test("404 do 2º turno mantém o 1º turno", () => {
  const tela = decidirTela({ agora: depois, turno1, turno2: null, statusTurno2: 404 });
  assert.equal(tela.modo, "primeiro");
  assert.match(tela.aviso, /ainda não foi publicado/);
});

test("o primeiro boletim com votos passa a ser o 2º turno", () => {
  const iniciado = structuredClone(turno2);
  iniciado.v.tv = "1000";
  iniciado.v.vvc = "900";
  iniciado.s.st = "10";
  iniciado.s.pst = "0,02";
  iniciado.carg[0].agr[0].par[0].cand[0].vap = "600";
  iniciado.carg[0].agr[0].par[0].cand[0].pvap = "66,67";
  iniciado.carg[0].agr[1].par[0].cand[0].vap = "300";
  iniciado.carg[0].agr[1].par[0].cand[0].pvap = "33,33";
  const tela = decidirTela({ agora: depois, turno1, turno2: iniciado, statusTurno2: 200 });
  assert.equal(tela.modo, "segundo");
  assert.equal(tela.apuracao.candidatos.length, 2);
  assert.equal(tela.apuracao.candidatos[0].pvap, "66,67");
  assert.equal(tela.apuracao.candidatos[1].pvap, "33,33");
  assert.equal(tela.apuracao.urnas.pst, "0,02");
});

test("fora da janela a consulta fica em alguns minutos; na apuração, um minuto", () => {
  assert.equal(esperaMs({ agora: vespera, modo: "primeiro", encerrada: true }), INTERVALO_FORA_MS);
  assert.equal(esperaMs({ agora: depois, modo: "aguardando", encerrada: false }), INTERVALO_AO_VIVO_MS);
  assert.equal(esperaMs({ agora: depois, modo: "segundo", encerrada: false }), INTERVALO_AO_VIVO_MS);
  assert.equal(esperaMs({ agora: new Date("2026-10-26T12:00:00Z"), modo: "segundo", encerrada: true }), INTERVALO_FORA_MS);
  assert.equal(escolherAlvo({ agora: vespera, modo: "primeiro", encerrada: true, ultimoAlvo: "6258" }), "6257");
  assert.equal(escolherAlvo({ agora: depois, modo: "aguardando", encerrada: false, ultimoAlvo: "6257" }), "6258");
});

test("304 preserva o JSON e 429 segura dez minutos", () => {
  const cache = new ApuracaoCache();
  cache.aplicar("6257", { status: 200, json: turno1, etag: '"abc"' });
  cache.aplicar("6257", { status: 304, etag: '"abc"' });
  assert.equal(cache.turno1.v.vvc, turno1.v.vvc);
  const antes = new Date("2026-10-25T21:00:00Z");
  cache.aplicar("6258", { status: 429 }, antes);
  assert.equal(cache.bloqueadoAte.getTime() - antes.getTime(), 10 * 60 * 1000);
});

test("frame-ancestors sai da variável de ambiente", () => {
  assert.equal(
    origensPermitidas("https://louveira.com.br, https://www.louveira.com.br"),
    "https://louveira.com.br https://www.louveira.com.br",
  );
  assert.match(montarCsp(origensPermitidas("")), /frame-ancestors https:\/\/louveiranews\.com\.br/);
  assert.throws(() => origensPermitidas("http://inseguro.example"), /inválida/);
});

test("milhar e barra não recalculam o percentual publicado", () => {
  assert.equal(milhar("56104503"), "56.104.503");
  assert.equal(larguraDoPercentual("47,03"), 47.03);
  assert.equal(larguraDoPercentual("100,00"), 100);
});

test("a página e o endpoint respondem no mesmo processo", async () => {
  const cache = new ApuracaoCache();
  cache.aplicar("6257", { status: 200, json: turno1, etag: '"t1"' });
  cache.aplicar("6258", { status: 200, json: turno2, etag: '"t2"' });
  const { servidor } = criarAplicacao({
    cache,
    consultar: async () => {
      throw new Error("o teste não consulta o TSE");
    },
    agora: () => vespera,
  });
  await new Promise((resolve) => servidor.listen(0, "127.0.0.1", resolve));
  const porta = servidor.address().port;
  try {
    const api = await fetch(`http://127.0.0.1:${porta}/api/apuracao`);
    const corpo = await api.json();
    assert.equal(api.status, 200);
    assert.equal(corpo.modo, "primeiro");
    assert.equal(corpo.apuracao.candidatos[0].pvap, "47,03");
    assert.match(api.headers.get("content-security-policy"), /frame-ancestors https:\/\/louveiranews\.com\.br/);
    assert.equal(api.headers.get("x-frame-options"), null);

    const pagina = await fetch(`http://127.0.0.1:${porta}/`);
    const html = await pagina.text();
    assert.match(html, /Apuração de presidente/);
    assert.equal(pagina.headers.get("content-security-policy").includes("frame-ancestors"), true);

    const foto = await fetch(`http://127.0.0.1:${porta}/fotos/6257/999.jpeg`);
    assert.equal(foto.status, 404);
  } finally {
    await new Promise((resolve) => servidor.close(resolve));
  }
});
