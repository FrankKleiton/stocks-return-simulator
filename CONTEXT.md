# Domain Context

## Historical simulator

A portfolio simulation capability for simple educational approximation, not broker-grade accounting. It estimates how a portfolio would have behaved using historical prices, monthly contributions, dividends, and optional dividend handling.

## Portfolio timeline

The central model for the Historical simulator. A portfolio timeline is the dated sequence of external contributions, price observations, dividend eligibility events, dividend payment events, reinvestment/cash decisions, holdings, cash balance, and portfolio value snapshots used to produce simulation results.

## Annualized return

The simulator should expose both money-weighted annualized return (sensitive to dated contributions) and time-weighted annualized return (closer to stock/portfolio performance independent of contribution timing) when the UI is ready to display both.

## Dividend eligibility

StatusInvest dividend `date` is treated as the eligibility/ex-date. StatusInvest `paymentDate` is treated as the date cash becomes available.

## Dividend reinvestment approximation

For simple educational approximation, reinvested dividends accumulate as cash rather than immediately buying the paying ticker. Cash can be deployed at contribution events or another explicit portfolio purchase event.

## Price selection

Simulation purchases use the first available market price on or after the requested contribution date. Dividend cash valuation and reinvestment decisions use the last available price on or before the relevant event date when a price is needed.
