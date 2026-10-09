import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { escolherAlvo, esperaMs } from "./agenda.js";
import { ApuracaoCache } from "./cache.js";
import { montarCsp, origensPermitidas } from "./csp.js";
import { baixarFoto, baixarJson, urlDoCodigo } from "./tse.js";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const publico = join(raiz, "public");

const tipos = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

const arquivos = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/estilo.css", "estilo.css"],
  ["/app.js", "app.js"],
  ["/percentual.js", "percentual.js"],
]);

export function criarAplicacao({ cache = new ApuracaoCache(), consultar = consultarTse, agora = () => new Date() } = {}) {
  const csp = montarCsp(origensPermitidas(process.env.FRAME_ANCESTORS));
  const fotos = new Map();
  const fila = [];
  let drenando = false;

  function conhecer(eleicao, sqcand) {
    return cache.sqcandsConhecidos().has(`${eleicao}/${sqcand}`);
  }

  function enfileirar(lista) {
    for (const item of lista) {
      const chave = `${item.eleicao}/${item.sqcand}`;
      if (fotos.has(chave)) continue;
      if (fila.some((f) => `${f.eleicao}/${f.sqcand}` === chave)) continue;
      fila.push(item);
    }
    drenar();
  }

  async function drenar() {
    if (drenando) return;
    drenando = true;
    try {
      while (fila.length > 0) {
        const item = fila.shift();
        const chave = `${item.eleicao}/${item.sqcand}`;
        if (fotos.has(chave)) continue;
        try {
          const foto = await baixarFoto(item.eleicao, item.sqcand);
          fotos.set(chave, foto.status === 200 ? foto : { status: foto.status, expira: Date.now() + 30 * 60_000 });
        } catch (erro) {
          console.error(`[tse] foto ${chave} falhou: ${erro.message}`);
          fotos.set(chave, { status: 502, expira: Date.now() + 5 * 60_000 });
        }
        await esperar(150);
      }
    } finally {
      drenando = false;
      if (fila.length > 0) drenar();
    }
  }

  async function consultarCodigo(codigo) {
    if (cache.bloqueadoAte && agora() < cache.bloqueadoAte) return;
    const url = urlDoCodigo(codigo);
    let resultado;
    try {
      resultado = await consultar(url, cache.etag[codigo]);
    } catch (erro) {
      console.error(`[tse] ${codigo} rede: ${erro.message}`);
      cache.aplicar(codigo, { status: 599 });
      return;
    }
    console.log(`[tse] ${codigo} HTTP ${resultado.status}`);
    const efeito = cache.aplicar(codigo, resultado, agora());
    if (efeito.fotos.length > 0) enfileirar(efeito.fotos);
  }

  const servidor = createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://localhost");
    cabecalhos(res, csp);

    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405);
      res.end();
      return;
    }

    if (url.pathname === "/health") {
      enviarJson(res, 200, { ok: true });
      return;
    }

    if (url.pathname === "/api/apuracao") {
      enviarJson(res, 200, cache.tela(agora()));
      return;
    }

    const foto = url.pathname.match(/^\/fotos\/(6257|6258)\/(\d+)\.jpeg$/);
    if (foto) {
      await enviarFoto(res, req, foto[1], foto[2]);
      return;
    }

    const nome = arquivos.get(url.pathname);
    if (!nome) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Não encontrado");
      return;
    }

    const corpo = await readFile(join(publico, nome));
    res.writeHead(200, {
      "Content-Type": tipos[extname(nome)] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    res.end(corpo);
  });

  async function enviarFoto(res, req, eleicao, sqcand) {
    if (!conhecer(eleicao, sqcand)) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Foto indisponível");
      return;
    }

    const chave = `${eleicao}/${sqcand}`;
    let guardada = fotos.get(chave);
    if (guardada?.expira && guardada.expira < Date.now()) {
      fotos.delete(chave);
      guardada = undefined;
    }
    if (!guardada) {
      try {
        const baixada = await baixarFoto(eleicao, sqcand);
        guardada = baixada.status === 200 ? baixada : { status: baixada.status, expira: Date.now() + 30 * 60_000 };
        fotos.set(chave, guardada);
      } catch (erro) {
        console.error(`[tse] foto ${chave} falhou: ${erro.message}`);
        res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Foto indisponível");
        return;
      }
    }

    if (guardada.status !== 200) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Foto indisponível");
      return;
    }

    res.writeHead(200, {
      "Content-Type": guardada.tipo || "image/jpeg",
      "Cache-Control": "public, max-age=86400",
      "Content-Length": guardada.body.length,
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    res.end(guardada.body);
  }

  return { servidor, consultarCodigo, cache };
}

function cabecalhos(res, csp) {
  res.setHeader("Content-Security-Policy", csp);
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");
}

function enviarJson(res, status, corpo) {
  const json = JSON.stringify(corpo);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(json);
}

async function consultarTse(url, etag) {
  return baixarJson(url, etag);
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function iniciar() {
  const { servidor, consultarCodigo, cache } = criarAplicacao();
  const porta = Number(process.env.PORT || 3000);
  await new Promise((resolve) => servidor.listen(porta, "0.0.0.0", resolve));
  console.log(`Apuração de presidente ouvindo na porta ${porta}`);

  let timer = null;
  let cicloAtivo = false;
  let encerrar = false;

  async function ciclo() {
    if (encerrar || cicloAtivo) return;
    cicloAtivo = true;
    try {
      const momento = new Date();
      if (cache.bloqueadoAte && momento < cache.bloqueadoAte) {
        return;
      }
      const tela = cache.tela(momento);
      const encerrada = tela.modo === "segundo" && tela.apuracao?.encerrada === true;
      const alvo = escolherAlvo({
        agora: momento,
        modo: tela.modo,
        encerrada,
        ultimoAlvo: cache.ultimoAlvo,
      });
      cache.ultimoAlvo = alvo;
      await consultarCodigo(alvo);
    } finally {
      cicloAtivo = false;
      if (!encerrar) agendar();
    }
  }

  function agendar() {
    const tela = cache.tela(new Date());
    const encerrada = tela.modo === "segundo" && tela.apuracao?.encerrada === true;
    const espera = esperaMs({
      agora: new Date(),
      modo: tela.modo,
      encerrada,
      bloqueadoAte: cache.bloqueadoAte,
    });
    timer = setTimeout(ciclo, espera);
  }

  await consultarCodigo("6257");
  await esperar(1500);
  await consultarCodigo("6258");
  cache.ultimoAlvo = "6258";
  agendar();

  function parar() {
    encerrar = true;
    clearTimeout(timer);
    servidor.close(() => process.exit(0));
  }

  process.on("SIGTERM", parar);
  process.on("SIGINT", parar);
  return servidor;
}

const executadoDireto = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (executadoDireto) {
  iniciar().catch((erro) => {
    console.error(erro);
    process.exit(1);
  });
}
