# Yale-inspired B3 risk report 001
# Yale-inspired B3 risk report 002
# Yale-inspired B3 risk report 003
# Yale-inspired B3 risk report 004
Feature: Yale-inspired B3 risk report
  Each generated portfolio explains its risks in terms investors can connect to
  its holdings rather than presenting a recommendation score as certainty.

  Background:
    Given an investor has generated a Yale-inspired B3 portfolio

  Scenario Outline: Yale-inspired B3 risk report 001
    Given the portfolio allocates <allocation> percent to <sector>
    When the portfolio risk report is produced
    Then the sector concentration risk is <risk_level>

    Examples:
      | allocation | sector            | risk_level |
      | 9.99       | Financials        | low        |
      | 10.00      | Basic Materials   | medium     |
      | 24.99      | Utilities         | medium     |
      | 25.00      | Consumer Cyclical | high       |

  Scenario Outline: Yale-inspired B3 risk report 002
    Given the portfolio contains a stock in <sector>
    When the portfolio risk report is produced
    Then the sector risk driver is <risk_driver>

    Examples:
      | sector                 | risk_driver                                      |
      | Financials             | credit, interest-rate, and regulatory changes    |
      | Basic Materials        | commodity prices, currency, and economic cycles  |
      | Energy                 | commodity prices, regulation, and environmental liabilities |
      | Utilities              | interest rates, regulation, and capital intensity |
      | Consumer Cyclical      | demand, consumer credit, and economic cycles     |
      | Consumer Defensive     | input costs, inflation, and margin pressure      |
      | Industrials            | economic cycles, orders, and capital spending    |
      | Real Estate            | interest rates, occupancy, and market liquidity  |
      | Healthcare             | regulation, reimbursement, and product execution |
      | Technology             | valuation, disruption, and execution             |
      | Communication Services | regulation, competition, and customer retention  |
      | Unclassified           | sector-specific risk is unavailable              |

  Scenario Outline: Yale-inspired B3 risk report 003
    Given a recommended stock has debt-to-equity <debt_to_equity>
    When the portfolio risk report is produced
    Then its leverage risk is <risk_level>

    Examples:
      | debt_to_equity | risk_level |
      | 0.49           | low        |
      | 0.50           | medium     |
      | 1.50           | medium     |
      | 1.51           | high       |

  Scenario: Yale-inspired B3 risk report 004
    When the portfolio risk report is produced
    Then every holding shows its ticker, company name, sector, allocation, profile ranking values, and selection explanation
    And the report shows represented sectors and allocation by sector
    And the report states that the portfolio is educational analysis rather than personalized financial advice
    And the report states that a stock-only portfolio does not reproduce Yale's multi-asset institutional strategy
