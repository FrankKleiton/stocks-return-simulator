import { describe, expect, test } from 'vitest';
import { runSimulation, simulatePortfolioTimeline } from './simulator';
import type { SimulationInput } from './types';

const input = (startDate: string): SimulationInput => ({
  holdings: [{ ticker: 'TEST3', allocation: 100 }],
  startDate,
  endDate: '2024-03-01',
  initialInvestment: 1000,
  monthlyContribution: 0,
  dividendMode: 'cash'
});

const data = {
  TEST3: {
    prices: [
      { date: '2024-01-01', price: 10 },
      { date: '2024-02-01', price: 10 },
      { date: '2024-03-01', price: 10 }
    ],
    dividends: [{ ticker: 'TEST3', date: '2024-01-15', paymentDate: '2024-02-15', value: 1 }]
  }
};

describe('portfolio simulator returns', () => {
  test('reports annualized return from dated external cash flows', () => {
    const result = runSimulation({ ...input('2024-01-01'), endDate: '2025-01-01', dividendMode: 'ignore' }, {
      TEST3: {
        prices: [
          { date: '2024-01-01', price: 10 },
          { date: '2025-01-01', price: 11 }
        ],
        dividends: []
      }
    });

    expect(result.totalReturn).toBe(10);
    expect(result.moneyWeightedAnnualizedReturn).toBeCloseTo(10, 1);
    expect(result.timeWeightedAnnualizedReturn).toBeCloseTo(10, 1);
    expect(result.cagr).toBeCloseTo(result.moneyWeightedAnnualizedReturn, 8);
  });

  test('does not dilute annualized return by treating every monthly contribution as invested from the start date', () => {
    const monthlyRate = Math.pow(1.1, 1 / 12);
    const prices = Array.from({ length: 13 }, (_, month) => {
      const date = new Date(Date.UTC(2024, month, 1)).toISOString().slice(0, 10);
      return { date, price: 10 * monthlyRate ** month };
    });
    const result = runSimulation({ ...input('2024-01-01'), endDate: '2025-01-01', monthlyContribution: 1000, dividendMode: 'ignore' }, { TEST3: { prices, dividends: [] } });

    expect(result.moneyWeightedAnnualizedReturn).toBeCloseTo(10, 1);
    expect(result.timeWeightedAnnualizedReturn).toBeCloseTo(10, 1);
  });

  test('exposes simulatePortfolioTimeline as the portfolio timeline interface', () => {
    const result = simulatePortfolioTimeline(input('2024-01-01'), data);

    expect(result.finalValue).toBe(1100);
    expect(result.moneyWeightedAnnualizedReturn).toBe(result.cagr);
  });
});

describe('portfolio simulator dividends', () => {
  test('reinvests dividends into more shares of the paying ticker using the last available price', () => {
    const result = runSimulation({ ...input('2024-01-01'), dividendMode: 'reinvest' }, data);

    expect(result.totalDividends).toBe(100);
    expect(result.totalDividendsReinvested).toBe(100);
    expect(result.cashBalance).toBe(0);
    expect(result.finalValue).toBe(1100);
    expect(result.holdings[0].shares).toBe(110);
    expect(result.holdings[0].returnPct).toBe(10);
    expect(result.transactions).toContainEqual({ date: '2024-02-15', ticker: 'TEST3', type: 'REINVEST', shares: 10, price: 10, amount: 100 });
  });

  test('does not pay dividends for shares bought after the dividend eligibility date', () => {
    const result = runSimulation(input('2024-02-01'), data);

    expect(result.totalDividends).toBe(0);
    expect(result.cashBalance).toBe(0);
    expect(result.finalValue).toBe(1000);
  });

  test('pays dividends based on shares owned at the eligibility date', () => {
    const result = runSimulation(input('2024-01-01'), data);

    expect(result.totalDividends).toBe(100);
    expect(result.cashBalance).toBe(100);
    expect(result.finalValue).toBe(1100);
  });

  test('reports annual dividend income as the average over the simulated years', () => {
    const prices = [
      { date: '2024-01-01', price: 10 },
      { date: '2025-01-01', price: 10 },
      { date: '2026-01-01', price: 10 }
    ];
    const dividends = [
      { ticker: 'TEST3', date: '2024-01-15', paymentDate: '2024-02-15', value: 1 },
      { ticker: 'TEST3', date: '2025-01-15', paymentDate: '2025-02-15', value: 2 }
    ];
    const result = runSimulation({ ...input('2024-01-01'), endDate: '2026-01-01' }, { TEST3: { prices, dividends } });

    expect(result.totalDividends).toBe(300);
    expect(result.annualDividendIncome).toBeCloseTo(150, 0);
  });

  test('reports dividend income for the last full calendar year before the end date', () => {
    const prices = [
      { date: '2024-01-01', price: 10 },
      { date: '2025-01-01', price: 10 },
      { date: '2026-01-01', price: 10 }
    ];
    const dividends = [
      { ticker: 'TEST3', date: '2024-01-15', paymentDate: '2024-02-15', value: 1 },
      { ticker: 'TEST3', date: '2025-01-15', paymentDate: '2025-02-15', value: 2 }
    ];
    const result = runSimulation({ ...input('2024-01-01'), endDate: '2026-01-01' }, { TEST3: { prices, dividends } });

    expect(result.lastFullYear).toBe('2025');
    expect(result.lastFullYearDividendIncome).toBe(200);
  });

  test('does not annualise dividend income for back tests shorter than a year', () => {
    const result = runSimulation(input('2024-01-01'), data);

    expect(result.annualDividendIncome).toBe(100);
  });
});
