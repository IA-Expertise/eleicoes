# Apuração de presidente — Eleições 2026

Página única para o iframe do [Louveira News](https://louveiranews.com.br). Mostra só o cargo de presidente, no Brasil. Os números vêm dos JSON oficiais do TSE, sem recálculo. Não há banco: a página e o endpoint rodam no mesmo processo.

## Iframe

Depois do `railway up`, troque `URL-DO-RAILWAY` pelo domínio que o Railway mostrar.

```html
<iframe
  src="https://URL-DO-RAILWAY/"
  title="Apuração de presidente — dados oficiais do TSE"
  style="width:100%;border:0;height:100vh"
  loading="lazy"
></iframe>
```

O navegador do leitor só fala com este serviço. Quem busca o JSON do TSE é o processo no Railway.

## Variáveis de ambiente

| Variável | Obrigatória | Função |
| --- | --- | --- |
| `FRAME_ANCESTORS` | não | Origens que podem embutir a página, separadas por espaço ou vírgula. Entram em `Content-Security-Policy: frame-ancestors`. Padrão: `https://louveiranews.com.br https://www.louveiranews.com.br https://louveira.com.br https://www.louveira.com.br` |
| `PORT` | não | Porta HTTP. O Railway define sozinho. Localmente o padrão é `3000`. |

Exemplo:

```bash
railway variable set FRAME_ANCESTORS="https://louveiranews.com.br https://www.louveiranews.com.br"
```

Se o blog for servido de outra origem, inclua essa origem também. Só `https://`.

## Subir no Railway

O repositório tem `Dockerfile` e `railway.toml`. O Railway sobe um serviço web e mantém o processo ligado: `sleepApplication = false` desliga o modo Serverless. No painel, em **Settings → Deploy**, Serverless precisa ficar desligado. Se estiver ligado, desligue e faça um novo deploy — a opção vale para o container que nasce no deploy.

```bash
railway login
railway init
railway up
railway domain
```

`railway domain` mostra a URL que entra no `src` do iframe.

Fora da apuração o processo consulta o TSE a cada 3 minutos. Isso também impede o sono do Serverless, que só dorme depois de vários minutos sem tráfego de saída. Na janela do 2º turno a consulta passa a ser de 1 minuto.

## O que a tela mostra

- **Até 25/10/2026, 17h (Brasília):** o 1º turno, eleição `6257`, que já está encerrado. Os dois primeiros levam foto, número, partido, votos e barra. Os demais ficam recolhidos.
- **25/10/2026, antes das 17h:** a mensagem de que a divulgação do 2º turno ainda não começou. Zero não aparece como resultado.
- **A partir das 17h, enquanto o arquivo do 2º turno responder 404:** continua o 1º turno, com o aviso de que o TSE ainda não publicou o 2º.
- **HTTP 200 com urnas e votos zerados:** a mesma mensagem de espera. O TSE já publica um arquivo vazio antes do boletim; ele não é tratado como apuração.
- **Primeiro HTTP 200 com urna apurada ou voto totalizado:** passa para o 2º turno, eleição `6258`, só com quem está nesse arquivo.

A faixa usa o percentual de urnas `s.pst` e o horário oficial `dg` `hg`. Válidos, brancos, nulos e abstenção saem de `v.vvc`, `v.vb`, `v.vn`, `e.a` e dos percentuais publicados ao lado. Quem avançou ou foi eleito vem do campo `st` do candidato. O campo `e` é ignorado.

A barra usa o `pvap` publicado (texto com vírgula, como `47,03`). Os totais na tela ganham ponto de milhar; o valor é o mesmo do arquivo. A API em `/api/apuracao` devolve as strings originais.

Fonte, com link: [divulgação oficial do TSE](https://resultados.tse.jus.br/oficial/app/index.html).

Fotos oficiais passam pelo serviço (`/fotos/{eleição}/{sqcand}.jpeg`), a partir de `https://resultados.tse.jus.br/oficial/ele2026/{eleição}/fotos/br/{sqcand}.jpeg`.

## Consultas ao TSE

Limite publicado pelo TSE: no máximo 100 requisições por segundo por IP, com bloqueio de cerca de 10 minutos se estourar. Vários 404 seguidos também podem bloquear.

Este serviço faz no máximo uma consulta por minuto a cada arquivo, com `If-None-Match`. Resposta 304 reaproveita o cache. Fora da apuração, a cada 3 minutos, alternando os dois arquivos. Das 16h50 até o 2º turno terminar, só o arquivo do 2º turno, uma vez por minuto. HTTP 429 ou 403 seguram a fila por 10 minutos.

Arquivos:

- 1º turno: `https://resultados.tse.jus.br/oficial/ele2026/6257/dados/br/br-c0001-e006257-u.json`
- 2º turno: `https://resultados.tse.jus.br/oficial/ele2026/6258/dados/br/br-c0001-e006258-u.json`

Códigos conferidos no catálogo `https://resultados.tse.jus.br/oficial/comum/config/ele-c.json` (eleição `6257`, segundo turno `6258`, cargo presidente). O catálogo não é consultado em produção.

A página do iframe chama só `/api/apuracao`, também uma vez por minuto.

## Local

```bash
npm test
npm start
```

Abra `http://localhost:3000`.
