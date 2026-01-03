
import { Debt, MonthResult, SimulationResults, LumpSum, PaymentBreakdown, BudgetChange } from '../types';

const round = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

const calculateMonthOffset = (baseDate: Date, targetDateStr: string) => {
  const target = new Date(targetDateStr);
  const diff = (target.getFullYear() - baseDate.getFullYear()) * 12 + (target.getMonth() - baseDate.getMonth());
  return Math.max(0, diff);
};

export const runSimulation = (
  initialDebts: Debt[],
  injections: LumpSum[],
  initialBudget: number,
  budgetChanges: BudgetChange[],
  startDateStr: string,
  isMinimumOnly: boolean = false
): SimulationResults => {
  const baseDate = new Date(startDateStr);
  let activeDebts = initialDebts.map(d => ({ ...d }));

  const initialTotal = activeDebts.reduce((sum, d) => sum + d.balance, 0);
  const ledger: MonthResult[] = [];
  let totalInterestPaid = 0;
  let months = 0;

  const injectionMap = isMinimumOnly ? {} : injections.reduce((acc, inj) => {
    const offset = calculateMonthOffset(baseDate, inj.date);
    acc[offset] = (acc[offset] || 0) + inj.amount;
    return acc;
  }, {} as Record<number, number>);

  const budgetChangeMap = budgetChanges.reduce((acc, change) => {
    const offset = calculateMonthOffset(baseDate, change.date);
    // If multiple changes in one month, last one wins or we could sort by date. 
    // For simplicity, we assume one per month is standard.
    acc[offset] = change.amount;
    return acc;
  }, {} as Record<number, number>);

  // Step 0: Handle Month 0 Lump Sums
  const initialEntry: MonthResult = {
    month: 0,
    totalInterest: 0,
    totalPrincipal: 0,
    remainingTotalBalance: initialTotal,
    payments: [],
    balances: activeDebts.reduce((acc, d) => ({ ...acc, [d.name]: d.balance }), {}),
  };

  if (injectionMap[0] > 0) {
    let remainingLump = injectionMap[0];
    const injectionPayments: PaymentBreakdown[] = [];

    const specialTargets = ['DCU1', 'DCU2'];
    for (const targetName of specialTargets) {
      const debt = activeDebts.find(d => d.name === targetName);
      if (debt && debt.balance > 0 && remainingLump > 0) {
        const payAmount = round(Math.min(debt.balance, remainingLump, 5000));
        debt.balance = round(debt.balance - payAmount);
        remainingLump = round(remainingLump - payAmount);
        if (payAmount > 0) {
          injectionPayments.push({ debtName: debt.name, principal: payAmount, interest: 0, total: payAmount });
        }
      }
    }

    const sortedForM0 = [...activeDebts].sort((a, b) => {
      const getStartApr = (d: Debt) => {
        if (!d.promoExpiry) return d.apr;
        const [expYear, expMonth] = d.promoExpiry.split('-').map(Number);
        const expiryDate = new Date(expYear, expMonth - 1, 1);
        return baseDate <= expiryDate ? (d.promoApr ?? 0) : d.apr;
      };
      return getStartApr(b) - getStartApr(a);
    });

    for (const debt of sortedForM0) {
      if (remainingLump <= 0) break;
      const targetDebt = activeDebts.find(d => d.id === debt.id)!;
      if (targetDebt.balance <= 0) continue;
      
      const payAmount = round(Math.min(targetDebt.balance, remainingLump));
      targetDebt.balance = round(targetDebt.balance - payAmount);
      remainingLump = round(remainingLump - payAmount);
      
      if (payAmount > 0) {
        const existing = injectionPayments.find(p => p.debtName === targetDebt.name);
        if (existing) {
          existing.principal = round(existing.principal + payAmount);
          existing.total = round(existing.total + payAmount);
        } else {
          injectionPayments.push({ debtName: targetDebt.name, principal: payAmount, interest: 0, total: payAmount });
        }
      }
    }
    initialEntry.totalPrincipal = injectionPayments.reduce((s, p) => s + p.principal, 0);
    initialEntry.payments = injectionPayments;
    initialEntry.remainingTotalBalance = activeDebts.reduce((s, d) => s + d.balance, 0);
    initialEntry.balances = activeDebts.reduce((acc, d) => ({ ...acc, [d.name]: d.balance }), {});
  }
  ledger.push(initialEntry);

  let currentBudget = initialBudget;

  while (activeDebts.some(d => d.balance > 0) && months < 600) {
    months++;
    
    // Update budget if a change is scheduled for this month
    if (budgetChangeMap[months] !== undefined) {
      currentBudget = budgetChangeMap[months];
    }

    const debtsWithCurrentApr = activeDebts.map(debt => {
      let currentApr = debt.apr;
      if (debt.promoExpiry) {
        const simDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + months - 1, 1);
        const [expYear, expMonth] = debt.promoExpiry.split('-').map(Number);
        const expiryDate = new Date(expYear, expMonth - 1, 1);
        if (simDate <= expiryDate) currentApr = debt.promoApr ?? 0;
      }
      return { ...debt, currentApr };
    });

    const sortedDebts = [...debtsWithCurrentApr].sort((a, b) => b.currentApr - a.currentApr);

    let monthlyInterestTotal = 0;
    let budgetRemaining = currentBudget;
    const monthlyPaymentsMap: Record<string, PaymentBreakdown> = {};

    sortedDebts.forEach(debt => {
      const targetDebt = activeDebts.find(d => d.id === debt.id)!;
      if (targetDebt.balance > 0) {
        const interest = round(targetDebt.balance * (debt.currentApr / 100 / 12));
        monthlyInterestTotal = round(monthlyInterestTotal + interest);
        
        const minDue = Math.max(targetDebt.minPaymentFlat, targetDebt.balance * (targetDebt.minPaymentPercent / 100));
        targetDebt.balance = round(targetDebt.balance + interest);

        const totalToPayAsMin = round(Math.min(targetDebt.balance, minDue));
        const interestPaidAsMin = round(Math.min(totalToPayAsMin, interest));
        const principalPaidAsMin = round(totalToPayAsMin - interestPaidAsMin);
        
        targetDebt.balance = round(targetDebt.balance - totalToPayAsMin);
        budgetRemaining = round(budgetRemaining - totalToPayAsMin);

        monthlyPaymentsMap[targetDebt.name] = {
          debtName: targetDebt.name,
          interest: interestPaidAsMin,
          principal: principalPaidAsMin,
          total: totalToPayAsMin
        };
      }
    });
    totalInterestPaid = round(totalInterestPaid + monthlyInterestTotal);

    if (!isMinimumOnly && injectionMap[months] > 0) {
      let remainingLump = injectionMap[months];
      for (const debt of sortedDebts) {
        const targetDebt = activeDebts.find(d => d.id === debt.id)!;
        if (remainingLump <= 0 || targetDebt.balance <= 0) continue;
        const payAmount = round(Math.min(targetDebt.balance, remainingLump));
        targetDebt.balance = round(targetDebt.balance - payAmount);
        remainingLump = round(remainingLump - payAmount);
        
        if (!monthlyPaymentsMap[targetDebt.name]) {
          monthlyPaymentsMap[targetDebt.name] = { debtName: targetDebt.name, interest: 0, principal: 0, total: 0 };
        }
        monthlyPaymentsMap[targetDebt.name].principal = round(monthlyPaymentsMap[targetDebt.name].principal + payAmount);
        monthlyPaymentsMap[targetDebt.name].total = round(monthlyPaymentsMap[targetDebt.name].total + payAmount);
      }
    }

    if (!isMinimumOnly && budgetRemaining > 0) {
      for (const debt of sortedDebts) {
        const targetDebt = activeDebts.find(d => d.id === debt.id)!;
        if (targetDebt.balance <= 0 || budgetRemaining <= 0) continue;
        const payAmount = round(Math.min(targetDebt.balance, budgetRemaining));
        targetDebt.balance = round(targetDebt.balance - payAmount);
        budgetRemaining = round(budgetRemaining - payAmount);
        
        const pObj = monthlyPaymentsMap[targetDebt.name];
        pObj.principal = round(pObj.principal + payAmount);
        pObj.total = round(pObj.total + payAmount);
      }
    }

    const currentTotal = round(activeDebts.reduce((sum, d) => sum + d.balance, 0));
    const finalPayments = Object.values(monthlyPaymentsMap).filter(p => p.total > 0);

    ledger.push({
      month: months,
      totalInterest: monthlyInterestTotal,
      totalPrincipal: round(finalPayments.reduce((s, p) => s + p.principal, 0)),
      remainingTotalBalance: currentTotal,
      payments: finalPayments,
      balances: activeDebts.reduce((acc, d) => ({ ...acc, [d.name]: d.balance }), {}),
    });

    if (currentTotal <= 0) break;
  }

  return {
    monthsToDebtFree: months,
    totalInterestPaid: round(totalInterestPaid),
    ledger,
    initialBalance: initialTotal
  };
};
