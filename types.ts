
export interface Debt {
  id: string;
  name: string;
  balance: number;
  apr: number;
  minPaymentPercent: number;
  minPaymentFlat: number;
  promoApr?: number;
  promoExpiry?: string;
}

export interface LumpSum {
  id: string;
  amount: number;
  date: string;
}

export interface BudgetChange {
  id: string;
  amount: number;
  date: string;
}

export interface PaymentBreakdown {
  debtName: string;
  principal: number;
  interest: number;
  total: number;
}

export interface MonthResult {
  month: number;
  totalInterest: number;
  totalPrincipal: number;
  remainingTotalBalance: number;
  payments: PaymentBreakdown[];
  balances: Record<string, number>;
}

export interface SimulationResults {
  monthsToDebtFree: number;
  totalInterestPaid: number;
  ledger: MonthResult[];
  initialBalance: number;
}
