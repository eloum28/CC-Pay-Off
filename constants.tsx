
import { Debt } from './types';

export const INITIAL_DEBTS: Debt[] = [
  { id: '1', name: 'BOA1', balance: 6500, apr: 20, minPaymentPercent: 2, minPaymentFlat: 25 },
  { id: '2', name: 'P LOAN', balance: 9743, apr: 16, minPaymentPercent: 2, minPaymentFlat: 25 },
  { id: '3', name: 'A. EXP', balance: 3000, apr: 28, minPaymentPercent: 2, minPaymentFlat: 25 },
  { id: '4', name: 'DCU2', balance: 23000, apr: 12.5, minPaymentPercent: 2, minPaymentFlat: 25 },
  { id: '5', name: 'US B', balance: 4800, apr: 24.9, minPaymentPercent: 2, minPaymentFlat: 25, promoApr: 0, promoExpiry: '2026-06' },
  { id: '6', name: 'Sap1', balance: 8500, apr: 26, minPaymentPercent: 2, minPaymentFlat: 25 },
  { id: '7', name: 'CITI', balance: 1500, apr: 21.24, minPaymentPercent: 2, minPaymentFlat: 25 },
  { id: '8', name: 'Sap2', balance: 1500, apr: 26, minPaymentPercent: 2, minPaymentFlat: 25 },
  { id: '9', name: 'W FARGO', balance: 5500, apr: 24.9, minPaymentPercent: 2, minPaymentFlat: 25, promoApr: 0, promoExpiry: '2027-07' },
  { id: '10', name: 'Disco', balance: 28300, apr: 14.74, minPaymentPercent: 2, minPaymentFlat: 25 },
  { id: '11', name: 'BOA2', balance: 10100, apr: 20, minPaymentPercent: 2, minPaymentFlat: 25 },
  { id: '12', name: 'Fidel', balance: 12200, apr: 18, minPaymentPercent: 2, minPaymentFlat: 25, promoApr: 0, promoExpiry: '2026-07' },
  { id: '13', name: 'DCU1', balance: 19000, apr: 12.5, minPaymentPercent: 2, minPaymentFlat: 25 },
  { id: '14', name: 'RED', balance: 2000, apr: 12.5, minPaymentPercent: 2, minPaymentFlat: 25 },
  { id: '15', name: 'New Disco', balance: 7700, apr: 24.9, minPaymentPercent: 2, minPaymentFlat: 25, promoApr: 0, promoExpiry: '2026-12' },
];

export const DEFAULT_LUMP_SUM = 30000;
export const DEFAULT_MONTHLY_BUDGET = 3500;
