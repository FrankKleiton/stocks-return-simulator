# Yale-inspired B3 portfolios 001
# Yale-inspired B3 portfolios 002
# Yale-inspired B3 portfolios 003
# Yale-inspired B3 portfolios 004
# Yale-inspired B3 portfolios 005
Feature: Yale-inspired B3 portfolios
  Brazilian equity investors receive long-term, equity-oriented portfolios that
  diversify company-specific and sector-specific risk without claiming to
  reproduce Yale's multi-asset institutional strategy.

  Background:
    Given the recommendation universe contains only B3-listed stocks with a positive price and positive ROIC

  Scenario Outline: Yale-inspired B3 portfolios 001
    Given the universe can satisfy the <profile> diversification policy
    When the investor requests the <profile> Yale-inspired portfolio
    Then the portfolio contains <stock_count> equal-weighted stocks
    And it contains at least <minimum_sectors> represented sectors
    And no sector contains more than <maximum_stocks_per_sector> stocks
    And its allocations total 100 percent

    Examples:
      | profile      | stock_count | minimum_sectors | maximum_stocks_per_sector |
      | conservative | 12          | 6               | 2                         |
      | moderate     | 10          | 5               | 2                         |
      | aggressive   | 8           | 4               | 2                         |

  Scenario Outline: Yale-inspired B3 portfolios 002
    Given a stock has quality score <quality_score>, debt-to-equity <debt_to_equity>, and <dividend_years> years of dividends
    When its eligibility for the <profile> portfolio is evaluated
    Then the stock is <eligibility>

    Examples:
      | profile      | quality_score | debt_to_equity | dividend_years | eligibility |
      | conservative | 60            | 1.00           | 5              | eligible    |
      | conservative | 59.9          | 0.50           | 8              | ineligible  |
      | conservative | 75            | 1.01           | 9              | ineligible  |
      | conservative | 80            | 0.40           | 4              | ineligible  |
      | moderate     | 50            | 2.00           | 0              | eligible    |
      | moderate     | 49.9          | 1.00           | 6              | ineligible  |
      | moderate     | 70            | 2.01           | 3              | ineligible  |
      | aggressive   | 20            | 3.00           | 0              | eligible    |

  Scenario Outline: Yale-inspired B3 portfolios 003
    Given eligible candidates in the same sector have the ranking values <first_values>, <second_values>, and <third_values>
    When the investor requests the <profile> Yale-inspired portfolio
    Then their selection priority is <expected_order>

    Examples:
      | profile      | first_values                     | second_values                    | third_values                   | expected_order       |
      | conservative | AAA3 quality 80 liquidity 300    | BBB3 quality 80 liquidity 200   | CCC3 quality 70 liquidity 500 | AAA3, BBB3, CCC3     |
      | moderate     | DDD3 quality 70 magic 50         | EEE3 quality 60 magic 70        | FFF3 quality 50 magic 40      | EEE3, DDD3, FFF3     |
      | aggressive   | GGG3 earnings growth 20 quality 40 | HHH3 earnings growth 15 quality 80 | III3 earnings growth 10 quality 90 | GGG3, HHH3, III3 |

  Scenario Outline: Yale-inspired B3 portfolios 004
    Given two eligible candidates have identical profile ranking values
    When the investor requests the <profile> Yale-inspired portfolio
    Then the candidate with the alphabetically earlier ticker has selection priority

    Examples:
      | profile      |
      | conservative |
      | moderate     |
      | aggressive   |

  Scenario Outline: Yale-inspired B3 portfolios 005
    Given only <stock_count> eligible stocks across <available_sectors> sectors can be selected without exceeding the sector limit
    When the investor requests the <profile> Yale-inspired portfolio
    Then the portfolio contains <stock_count> equal-weighted stocks
    And it reports that the target diversification could not be reached
    And it reports the target of <target_stocks> stocks across at least <target_sectors> sectors

    Examples:
      | profile      | stock_count | available_sectors | target_stocks | target_sectors |
      | conservative | 10          | 5                 | 12            | 6              |
      | moderate     | 8           | 4                 | 10            | 5              |
      | aggressive   | 6           | 3                 | 8             | 4              |
