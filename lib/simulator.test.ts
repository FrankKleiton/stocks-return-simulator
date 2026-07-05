import { describe, expect, test } from 'vitest';
import { runSimulation } from './simulator';
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

describe('portfolio simulator dividends', () => {
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
});
