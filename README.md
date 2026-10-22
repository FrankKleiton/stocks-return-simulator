# stocks-return-simulator

Simulador histórico de carteiras de ações brasileiras com dados do [Investidor10](https://investidor10.com.br).

## Configuração

1. Copie `.env.example` para `.env.local` (opcional: nenhuma variável é obrigatória).
2. `npm install && npm run dev`.

O Investidor10 não exige token: o app lê os mesmos endpoints JSON que a página de cada ação usa e faz parsing do
HTML renderizado no servidor para o que não tem JSON (proventos, dados da empresa e o ranking de ações).

## Dados usados e endpoints do Investidor10

| Uso no app | Endpoint | Observação |
|---|---|---|
| Ids, setor, liquidez, valor de mercado e proventos | `GET /acoes/{ticker}/` (HTML, ~2 MB) | Página da ação; cada ticker é lido uma vez a cada 12h e fica em cache em memória |
| Universo de ações (screener) | `GET /acoes/rankings/maiores-valor-de-mercado/?page=N` (HTML) | ~230 empresas em 3 páginas com P/L, P/VP, DY, ROE, CAGRs, dívida bruta/PL e setor |
| EV/EBIT e ROIC atuais do screener | `GET /api/historico-indicadores/{tickerId}/1/?v=2` | Uma requisição pequena por empresa, limitada por `INVESTIDOR10_SCREENER_SIZE` |
| Indicadores anuais (P/VP, ROE, ROIC, liquidez corrente, dívida bruta/PL) | `GET /api/historico-indicadores/{tickerId}/10/?v=2` | A coluna "Atual" é ignorada no histórico |
| DRE anual (receita e lucro líquido) | `GET /api/balancos/balancoresultados/chart/{companyId}/10/yearly/` | Também alimenta o valuation por lucros (`/api/earnings-valuation`); não há valuation por FCL porque o site não publica DFC |
| Preços históricos diários | `GET /api/cotacoes/acao/chart/{ticker}/36500/false/real/` | `false` = ajustado por desdobramentos, não por dividendos; fins de semana são descartados |

## Limites que afetam o app

- O site fica atrás da Cloudflare e responde **429 com `Retry-After`** quando entra em manutenção ou limita um IP.
  O app respeita esse prazo localmente (não repete requisições até ele vencer) e devolve a mensagem ao usuário.
- As requisições são espaçadas (150 ms) e feitas no máximo 4 em paralelo. Montar o screener custa 3 páginas de
  ranking mais uma requisição por empresa enriquecida (200 por padrão), renovadas a cada 12h pelo cache em memória.
- Mudanças no HTML do site quebram o parsing: nesse caso a API responde 502 com "formato inesperado" e os testes de
  `lib/investidor10.test.ts` (fixtures copiadas do site) indicam qual parser precisa de ajuste.
