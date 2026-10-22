# Domain Context

## Historical simulator

A portfolio simulation capability for simple educational approximation, not broker-grade accounting. It estimates how a portfolio would have behaved using historical prices, monthly contributions, dividends, and optional dividend handling.

## Portfolio timeline

The central model for the Historical simulator. A portfolio timeline is the dated sequence of external contributions, price observations, dividend eligibility events, dividend payment events, reinvestment/cash decisions, holdings, cash balance, and portfolio value snapshots used to produce simulation results.

## Annualized return

The simulator should expose both money-weighted annualized return (sensitive to dated contributions) and time-weighted annualized return (closer to stock/portfolio performance independent of contribution timing) when the UI is ready to display both.

## Dividend eligibility

Investidor10's "data com" column (the last day a buyer is still entitled to the payout) is used as the dividend `date`, so shares bought on that day are eligible. Its "pagamento" column is treated as the date cash becomes available; rows without a payment date (announced but unpaid) are ignored. Dividends, JCP and taxable yields are all included; stock dividends and subscriptions are not listed by the source.

## Dividend reinvestment approximation

For simple educational approximation, reinvested dividends buy more shares of the same ticker that paid the dividend on the payment date. The simulator uses the last available market price on or before the payment date.

## Price selection

Simulation purchases use the first available market price on or after the requested contribution date. Dividend cash valuation and reinvestment decisions use the last available price on or before the relevant event date when a price is needed.

## Data source

Market and fundamental data come from Investidor10 (https://investidor10.com.br), which has no public API and no token. The app calls the JSON endpoints its stock pages use (prices, indicator history, DRE) and parses server-rendered HTML for dividends, company ids and the stock universe (market-cap ranking). The site sits behind Cloudflare and answers 429 with `Retry-After` during maintenance or rate limiting; the app honours that window locally. Investidor10 publishes no cash-flow statement, which is why the app has no free-cash-flow valuation (only the earnings-based one).

## Price series

Simulations use Investidor10's price chart with `usePayments=false`, which is adjusted for splits but not for dividends, because dividends are modelled explicitly. The dividend-adjusted series (`true`) would double count them. Weekend rows (which repeat Friday's quote) are dropped.

## Derived fundamentals

ROE, ROIC, EV/EBIT, P/VP and the 5-year CAGRs are taken as Investidor10 computes them. `debtEquity` carries Investidor10's gross debt / equity (it publishes no net-debt ratio); banks have no such figure and keep 0. `liquidity` in the screener holds market cap, because the ranking has no traded volume and the field is only used to order the universe; the per-ticker page does expose "Liquidez Média Diária" (`CompanyPage.liquidity`).
