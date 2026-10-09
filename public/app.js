import { larguraDoPercentual, milhar } from "./percentual.js";

const app = document.querySelector("#app");
const INTERVALO_MS = 60_000;
let ultimoCorpo = "";
let ultimaBusca = 0;

function elemento(tag, atributos = {}, filhos = []) {
  const no = document.createElement(tag);
  for (const [chave, valor] of Object.entries(atributos)) {
    if (valor === undefined || valor === false || valor === null) continue;
    if (chave === "class") no.className = valor;
    else no.setAttribute(chave, String(valor));
  }
  for (const filho of filhos) {
    if (filho) no.append(filho);
  }
  return no;
}

function texto(tag, conteudo, atributos) {
  const no = elemento(tag, atributos);
  no.textContent = conteudo;
  return no;
}

function fonte(dados) {
  const bloco = elemento("footer", { class: "rodape" });
  bloco.append(
    texto("p", dados.fonte?.texto || "Dados oficiais do TSE, sem alteração."),
    elemento("p", {}, [
      elemento("a", {
        href: dados.fonte?.url || "https://resultados.tse.jus.br/oficial/app/index.html",
        target: "_blank",
        rel: "noopener noreferrer",
      }),
    ]),
  );
  bloco.querySelector("a").textContent = "Divulgação oficial do TSE";
  return bloco;
}

function foto(cand) {
  if (!cand.foto) return monograma(cand);
  const img = elemento("img", {
    class: "foto",
    src: cand.foto,
    alt: `Foto oficial de ${cand.nmu}`,
    width: "76",
    height: "76",
  });
  img.addEventListener("error", () => {
    img.replaceWith(monograma(cand));
  });
  return img;
}

function monograma(cand) {
  const letra = (cand.nmu || "?").trim().charAt(0);
  return texto("span", letra, { class: "monograma", "aria-hidden": "true" });
}

function cartao(cand, posicao) {
  const classe = posicao === 0 ? "cartao lider" : posicao === 1 ? "cartao segundo" : "cartao";
  const artigo = elemento("article", { class: classe });
  const barra = elemento("div", {
    class: "barra",
    role: "img",
    "aria-label": `${cand.pvap}% dos votos válidos`,
  });
  const preenchimento = document.createElement("span");
  preenchimento.style.width = `${larguraDoPercentual(cand.pvap)}%`;
  barra.append(preenchimento);

  artigo.append(
    elemento("div", { class: "cabeca" }, [
      foto(cand),
      elemento("div", {}, [
        texto("p", `${cand.n} · ${cand.partido}`, { class: "numero" }),
        texto("h2", cand.nmu, { class: "nome" }),
      ]),
    ]),
    elemento("div", { class: "votos" }, [
      elemento("div", {}, [
        texto("strong", milhar(cand.vap)),
        texto("p", "votos", { class: "meta" }),
      ]),
      texto("p", `${cand.pvap}%`, { class: "percentual" }),
    ]),
    barra,
  );

  if (cand.st) artigo.append(texto("p", cand.st, { class: "situacao" }));
  return artigo;
}

function totais(apuracao) {
  const itens = [
    ["Válidos", apuracao.votos.vvc, apuracao.votos.pvvc],
    ["Brancos", apuracao.votos.vb, apuracao.votos.pvb],
    ["Nulos", apuracao.votos.vn, apuracao.votos.pvn],
    ["Abstenção", apuracao.eleitorado.a, apuracao.eleitorado.pa],
  ];
  return elemento(
    "section",
    { class: "totais", "aria-label": "Totais oficiais" },
    itens.map(([rotulo, valor, percentual]) =>
      elemento("div", { class: "total" }, [
        texto("span", rotulo),
        texto("strong", milhar(valor)),
        percentual ? texto("small", `${percentual}%`) : null,
      ]),
    ),
  );
}

function demais(candidatos) {
  const detalhes = elemento("details", { class: "demais" });
  detalhes.append(texto("summary", "Demais candidatos"));
  for (const cand of candidatos) {
    detalhes.append(
      elemento("div", { class: "linha" }, [
        texto("p", cand.n, { class: "num" }),
        elemento("p", { class: "quem" }, [
          texto("b", cand.nmu),
          texto("span", ` · ${cand.partido}`),
        ]),
        texto("p", `${milhar(cand.vap)} · ${cand.pvap}%${cand.st ? ` · ${cand.st}` : ""}`, { class: "placar" }),
      ]),
    );
  }
  return detalhes;
}

function apuracao(dados, detalhesAbertos) {
  const a = dados.apuracao;
  const turno = a.turno === 2 ? "2º turno" : "1º turno";
  const destaque = dados.modo === "segundo" ? a.candidatos : a.candidatos.slice(0, 2);
  const resto = dados.modo === "segundo" ? [] : a.candidatos.slice(2);
  const selo = texto(
    "span",
    a.encerrada ? "Apuração encerrada" : "Apuração em andamento",
    { class: a.encerrada ? "selo" : "selo andamento" },
  );

  const faixa = elemento("section", { class: "faixa" }, [
    texto("strong", `${a.urnas.pst}% das urnas`),
    texto("p", `${milhar(a.urnas.st)} de ${milhar(a.urnas.ts)} urnas apuradas`),
    texto("p", `Horário oficial do arquivo: ${a.dg} ${a.hg}`),
  ]);

  const miolo = [
    elemento("header", {}, [
      texto("p", "Eleições 2026", { class: "kicker" }),
      texto("h1", "Presidente"),
      texto("p", `Brasil · ${turno}`, { class: "sub" }),
      elemento("div", { class: "selos" }, [selo]),
    ]),
  ];

  if (dados.aviso) miolo.push(texto("p", dados.aviso, { class: "aviso" }));
  if (dados.nota) miolo.push(texto("p", dados.nota, { class: "nota" }));
  if (dados.avisoAtualizacao) miolo.push(texto("p", dados.avisoAtualizacao, { class: "aviso" }));
  miolo.push(faixa);
  miolo.push(elemento("section", { class: "grade", "aria-label": "Candidatos mais votados" }, destaque.map((cand, i) => cartao(cand, i))));
  miolo.push(totais(a));
  if (resto.length > 0) {
    const lista = demais(resto);
    if (detalhesAbertos) lista.open = true;
    miolo.push(lista);
  }
  miolo.push(fonte(dados));
  return miolo;
}

function aguardando(dados) {
  return [
    elemento("header", {}, [
      texto("p", "Eleições 2026", { class: "kicker" }),
      texto("h1", "Presidente"),
      texto("p", "Brasil · 2º turno", { class: "sub" }),
    ]),
    elemento("section", { class: "espera" }, [
      texto("p", "17h", { class: "hora-grande" }),
      texto("p", dados.mensagem, { class: "mensagem" }),
      dados.complemento ? texto("p", dados.complemento, { class: "complemento" }) : null,
    ]),
    dados.avisoAtualizacao ? texto("p", dados.avisoAtualizacao, { class: "aviso" }) : null,
    fonte(dados),
  ];
}

function desenhar(dados, detalhesAbertos) {
  app.replaceChildren();
  const blocos =
    dados.modo === "aguardando"
      ? aguardando(dados)
      : dados.modo === "carregando"
        ? [
            texto("p", dados.mensagem || "Carregando os dados oficiais do TSE.", { class: "carregando" }),
            dados.avisoAtualizacao ? texto("p", dados.avisoAtualizacao, { class: "aviso" }) : null,
          ]
        : apuracao(dados, detalhesAbertos);
  app.append(...blocos.filter(Boolean));
}

function falha() {
  app.replaceChildren(
    texto("p", "Não foi possível carregar a apuração. Nova tentativa em um minuto.", { class: "falha" }),
  );
}

async function atualizar() {
  const agora = Date.now();
  if (ultimoCorpo && agora - ultimaBusca < 55_000) return;
  ultimaBusca = agora;
  try {
    const resposta = await fetch("/api/apuracao", { cache: "no-store" });
    if (!resposta.ok) throw new Error(String(resposta.status));
    const corpo = await resposta.text();
    if (corpo === ultimoCorpo) return;
    const aberto = app.querySelector("details")?.open ?? false;
    ultimoCorpo = corpo;
    desenhar(JSON.parse(corpo), aberto);
  } catch {
    if (!ultimoCorpo) falha();
  }
}

function agendar() {
  setTimeout(async () => {
    await atualizar();
    agendar();
  }, INTERVALO_MS);
}

atualizar();
agendar();
