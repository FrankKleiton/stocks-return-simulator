# Yale-inspired B3 interface 001
# Yale-inspired B3 interface 002
# Yale-inspired B3 interface 003
Feature: Yale-inspired B3 interface
  The portfolio comparison interface lets an investor request and inspect each
  Yale-inspired risk profile without replacing the existing strategies.

  Background:
    Given B3 recommendations are available in the portfolio comparison interface

  Scenario Outline: Yale-inspired B3 interface 001
    When the investor selects the <profile> Yale-inspired profile
    Then the interface previews its recommended holdings
    And the preview identifies the profile as <profile>
    And the preview shows its stock count, represented sector count, and largest sector allocation

    Examples:
      | profile      |
      | conservative |
      | moderate     |
      | aggressive   |

  Scenario: Yale-inspired B3 interface 002
    Given the investor has selected existing comparison strategies
    When the investor adds a Yale-inspired profile
    Then the existing comparison strategies remain selected
    And the Yale-inspired portfolio can be included in the same historical simulation

  Scenario: Yale-inspired B3 interface 003
    Given a Yale-inspired portfolio cannot reach its target diversification
    When the interface previews its recommended holdings
    Then the diversification warning is shown with the partial portfolio
    And the historical simulation remains available for the partial portfolio
