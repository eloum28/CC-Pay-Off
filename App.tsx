
import React, { useState, useMemo } from 'react';
import { 
  TrendingDown, 
  Calendar, 
  DollarSign, 
  ChevronDown, 
  ChevronRight, 
  Settings2,
  MoveUpRight,
  Plus,
  Trash2,
  ListFilter,
  ShieldCheck,
  CreditCard,
  Wallet,
  Download,
  Upload
} from 'lucide-react';
import { Debt, LumpSum, BudgetChange } from './types';
import { INITIAL_DEBTS, DEFAULT_LUMP_SUM, DEFAULT_MONTHLY_BUDGET } from './constants';
import { runSimulation } from './services/calculationEngine';

export default function App() {
  const [debts, setDebts] = useState<Debt[]>(INITIAL_DEBTS);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [injections, setInjections] = useState<LumpSum[]>([
    { id: 'initial-1', amount: DEFAULT_LUMP_SUM, date: new Date().toISOString().split('T')[0] }
  ]);
  const [monthlyBudget, setMonthlyBudget] = useState(DEFAULT_MONTHLY_BUDGET);
  const [budgetChanges, setBudgetChanges] = useState<BudgetChange[]>([]);
  const [expandedMonths, setExpandedMonths] = useState<Set<number>>(new Set());

  const results = useMemo(() => {
    const standard = runSimulation(debts, injections, monthlyBudget, budgetChanges, startDate, false);
    const minimum = runSimulation(debts, [], monthlyBudget, budgetChanges, startDate, true);
    return { standard, minimum };
  }, [debts, injections, monthlyBudget, budgetChanges, startDate]);

  const totalMinimums = useMemo(() => {
    return debts.reduce((sum, d) => sum + Math.max(d.minPaymentFlat, d.balance * (d.minPaymentPercent / 100)), 0);
  }, [debts]);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(val);

  const formatMonthLabel = (monthIndex: number) => {
    const date = new Date(startDate);
    date.setMonth(date.getMonth() + monthIndex);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const toggleMonth = (m: number) => {
    const next = new Set(expandedMonths);
    if (next.has(m)) next.delete(m);
    else next.add(m);
    setExpandedMonths(next);
  };

  const handleDebtChange = (id: string, field: keyof Debt, value: any) => {
    setDebts(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const addInjection = () => {
    setInjections(prev => [...prev, { 
      id: Math.random().toString(36).substr(2, 9), 
      amount: 1000, 
      date: new Date().toISOString().split('T')[0] 
    }]);
  };

  const updateInjection = (id: string, field: keyof LumpSum, value: any) => {
    setInjections(prev => prev.map(inj => inj.id === id ? { ...inj, [field]: value } : inj));
  };

  const removeInjection = (id: string) => {
    setInjections(prev => prev.filter(inj => inj.id !== id));
  };

  const addBudgetChange = () => {
    setBudgetChanges(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      amount: monthlyBudget + 500,
      date: new Date().toISOString().split('T')[0]
    }]);
  };

  const updateBudgetChange = (id: string, field: keyof BudgetChange, value: any) => {
    setBudgetChanges(prev => prev.map(bc => bc.id === id ? { ...bc, [field]: value } : bc));
  };

  const removeBudgetChange = (id: string) => {
    setBudgetChanges(prev => prev.filter(bc => bc.id !== id));
  };

  const getMonthOffset = (dateStr: string) => {
    const now = new Date(startDate);
    const target = new Date(dateStr);
    return (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
  };

  const handleSave = () => {
    const config = { debts, startDate, injections, monthlyBudget, budgetChanges };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `waterfall-config-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target?.result as string);
        if (data.debts) setDebts(data.debts);
        if (data.startDate) setStartDate(data.startDate);
        if (data.injections) setInjections(data.injections);
        if (data.monthlyBudget) setMonthlyBudget(data.monthlyBudget);
        if (data.budgetChanges) setBudgetChanges(data.budgetChanges);
      } catch (err) {
        alert("Failed to load JSON file. Please ensure it is a valid simulation export.");
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 p-4 md:p-8 font-sans selection:bg-emerald-500/30">
      <header className="max-w-7xl mx-auto mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent">
            DEBT WATERFALL SIMULATOR
          </h1>
          <p className="text-slate-400 mt-2 font-medium tracking-wide">CREDIT-FIRST AVALANCHE PROTECTION SYSTEM</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <button 
              onClick={handleSave}
              className="flex items-center gap-2 bg-slate-900 border border-slate-700 hover:border-cyan-500/50 hover:bg-slate-800 text-slate-100 px-6 py-3 rounded-2xl transition-all font-black text-sm shadow-xl group"
            >
              <Download className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" /> SAVE DATA
            </button>
            <label className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 px-6 py-3 rounded-2xl transition-all font-black text-sm shadow-xl cursor-pointer group">
              <Upload className="w-4 h-4 group-hover:scale-110 transition-transform" /> LOAD DATA
              <input type="file" accept=".json" onChange={handleLoad} className="hidden" />
            </label>
          </div>

          <div className="flex items-center gap-3 bg-slate-900/80 border border-slate-800 px-5 py-3 rounded-2xl shadow-lg">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold text-slate-300">
              Strategy: <span className="text-emerald-400 uppercase tracking-widest">Mandatory Min Protected</span>
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Panel: Inputs */}
        <div className="lg:col-span-4 space-y-6">
          <section className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center gap-3">
                <Settings2 className="w-5 h-5 text-emerald-500" />
                Global Controls
              </h2>
            </div>
            
            <div className="space-y-6">
              <div className="group">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 transition-colors group-focus-within:text-emerald-400">Simulation Start Date</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                  <input 
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all [color-scheme:dark]"
                  />
                </div>
              </div>

              <div className="group">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 transition-colors group-focus-within:text-emerald-400">Initial Monthly Budget</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                  <input 
                    type="number"
                    value={monthlyBudget}
                    onChange={(e) => setMonthlyBudget(Number(e.target.value))}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl py-4 pl-10 pr-4 text-2xl font-black focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <div className="flex justify-between items-center mb-4">
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Budget Schedule</label>
                   <button onClick={addBudgetChange} className="p-1.5 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500 hover:text-white rounded-xl transition-all border border-cyan-500/20"><Plus className="w-4 h-4" /></button>
                </div>
                <div className="space-y-3">
                  {budgetChanges.map((bc) => (
                    <div key={bc.id} className="bg-slate-800/30 border border-slate-700/50 p-4 rounded-2xl group relative">
                      <button onClick={() => removeBudgetChange(bc.id)} className="absolute -top-2 -right-2 p-1.5 bg-slate-900 border border-slate-700 rounded-full text-slate-600 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100 shadow-xl"><Trash2 className="w-3.5 h-3.5" /></button>
                      <div className="flex items-center gap-3 mb-2">
                        <Calendar className="w-4 h-4 text-slate-500" />
                        <input type="date" value={bc.date} onChange={(e) => updateBudgetChange(bc.id, 'date', e.target.value)} className="bg-transparent text-xs font-bold text-slate-200 outline-none [color-scheme:dark]" />
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">$</span>
                        <input type="number" value={bc.amount} onChange={(e) => updateBudgetChange(bc.id, 'amount', Number(e.target.value))} className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-2 pl-7 pr-3 text-lg font-black focus:border-cyan-500 outline-none transition-all" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <div className="flex justify-between items-center mb-4">
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Injection Schedule</label>
                   <button onClick={addInjection} className="p-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-xl transition-all border border-emerald-500/20"><Plus className="w-4 h-4" /></button>
                </div>
                <div className="space-y-3">
                  {injections.map((inj) => (
                    <div key={inj.id} className="bg-slate-800/30 border border-slate-700/50 p-4 rounded-2xl group relative">
                      <button onClick={() => removeInjection(inj.id)} className="absolute -top-2 -right-2 p-1.5 bg-slate-900 border border-slate-700 rounded-full text-slate-600 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100 shadow-xl"><Trash2 className="w-3.5 h-3.5" /></button>
                      <div className="flex items-center gap-3 mb-2">
                        <Calendar className="w-4 h-4 text-slate-500" />
                        <input type="date" value={inj.date} onChange={(e) => updateInjection(inj.id, 'date', e.target.value)} className="bg-transparent text-xs font-bold text-slate-200 outline-none [color-scheme:dark]" />
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">$</span>
                        <input type="number" value={inj.amount} onChange={(e) => updateInjection(inj.id, 'amount', Number(e.target.value))} className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-2 pl-7 pr-3 text-lg font-black focus:border-emerald-500 outline-none transition-all" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-sm">
            <div className="p-6 bg-slate-900/80 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-500" /> Card Inventory
              </h2>
            </div>
            <div className="p-4 max-h-[600px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[9px] text-slate-500 uppercase tracking-widest border-b border-slate-800">
                    <th className="pb-4 font-black">Name</th>
                    <th className="pb-4 font-black text-right">Balance</th>
                    <th className="pb-4 font-black text-right">APR</th>
                    <th className="pb-4 font-black text-right">Min%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {debts.map(debt => (
                    <tr key={debt.id} className="group hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 text-[11px] font-bold text-slate-400">{debt.name}</td>
                      <td className="py-3 text-right">
                        <input 
                          type="number"
                          value={debt.balance}
                          onChange={(e) => handleDebtChange(debt.id, 'balance', Number(e.target.value))}
                          className="bg-transparent text-right w-16 text-[11px] font-black outline-none focus:text-emerald-400"
                        />
                      </td>
                      <td className="py-3 text-right">
                        <input 
                          type="number"
                          value={debt.apr}
                          onChange={(e) => handleDebtChange(debt.id, 'apr', Number(e.target.value))}
                          className="bg-transparent text-right w-10 text-[11px] font-black text-cyan-400 outline-none focus:text-cyan-300"
                        />
                      </td>
                      <td className="py-3 text-right">
                        <input 
                          type="number"
                          value={debt.minPaymentPercent}
                          onChange={(e) => handleDebtChange(debt.id, 'minPaymentPercent', Number(e.target.value))}
                          className="bg-transparent text-right w-8 text-[11px] font-black text-emerald-500 outline-none"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Right Panel: Dashboard & Ledger */}
        <div className="lg:col-span-8 space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl relative overflow-hidden">
              <TrendingDown className="absolute -top-4 -right-4 w-16 h-16 text-rose-500 opacity-[0.03] rotate-12" />
              <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Total Interest</p>
              <h3 className="text-2xl font-black text-rose-500 mt-1">{formatCurrency(results.standard.totalInterestPaid)}</h3>
            </div>
            
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl relative overflow-hidden">
              <Calendar className="absolute -top-4 -right-4 w-16 h-16 text-cyan-500 opacity-[0.03] rotate-12" />
              <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Months to Zero</p>
              <h3 className="text-2xl font-black text-cyan-400 mt-1">{results.standard.monthsToDebtFree}m</h3>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl relative overflow-hidden">
              <ShieldCheck className="absolute -top-4 -right-4 w-16 h-16 text-emerald-500 opacity-[0.03] rotate-12" />
              <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Initial Monthly Min</p>
              <h3 className="text-2xl font-black text-emerald-400 mt-1">{formatCurrency(totalMinimums)}</h3>
            </div>
          </div>

          <section className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-md">
            <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/80">
              <h2 className="text-2xl font-black flex items-center gap-3">
                <ListFilter className="w-6 h-6 text-emerald-400" />
                Monthly Payoff Ledger
              </h2>
            </div>

            <div className="divide-y divide-slate-800/50 max-h-[850px] overflow-y-auto custom-scrollbar">
              {results.standard.ledger.map((entry) => {
                const hasInj = injections.some(inj => getMonthOffset(inj.date) === entry.month);
                return (
                  <div key={entry.month} className="group">
                    <button onClick={() => toggleMonth(entry.month)} className="w-full text-left p-6 hover:bg-slate-800/40 transition-all flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div className={`w-16 h-12 rounded-2xl flex flex-col items-center justify-center font-black text-[9px] transition-all uppercase tracking-tighter text-center ${hasInj ? 'bg-emerald-500 text-emerald-950 ring-4 ring-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-slate-800/40 text-slate-500'}`}>
                          <span>{formatMonthLabel(entry.month).split(' ')[0]}</span>
                          <span className="opacity-70 text-[7px] leading-tight">{formatMonthLabel(entry.month).split(' ')[1]}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-3">
                             <span className="text-2xl font-black">{formatCurrency(entry.remainingTotalBalance)}</span>
                             {hasInj && <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[8px] font-black uppercase tracking-widest border border-emerald-500/30">Lump Sum Applied</span>}
                          </div>
                          <div className="text-[10px] flex gap-4 mt-1 font-bold">
                            <span className="text-emerald-400/80 flex items-center gap-1.5 uppercase tracking-wide"><MoveUpRight className="w-3 h-3" /> Principal: {formatCurrency(entry.totalPrincipal)}</span>
                            <span className="text-rose-400/80 flex items-center gap-1.5 uppercase tracking-wide"><TrendingDown className="w-3 h-3" /> Interest: {formatCurrency(entry.totalInterest)}</span>
                          </div>
                        </div>
                      </div>
                      {expandedMonths.has(entry.month) ? <ChevronDown className="w-5 h-5 text-slate-700" /> : <ChevronRight className="w-5 h-5 text-slate-700" />}
                    </button>

                    {expandedMonths.has(entry.month) && (
                      <div className="px-12 pb-8 pt-2 animate-in slide-in-from-top-4 duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-950/50 p-6 rounded-[2rem] border border-slate-800">
                          <div className="space-y-4">
                            <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Monthly Transactions</p>
                            <div className="space-y-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                              <table className="w-full text-left text-[11px]">
                                <thead>
                                  <tr className="text-slate-600 border-b border-slate-900">
                                    <th className="pb-2">Card</th>
                                    <th className="pb-2 text-right">Int</th>
                                    <th className="pb-2 text-right">Prin</th>
                                    <th className="pb-2 text-right">Paid</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {entry.payments.map((p, idx) => (
                                    <tr key={idx} className="border-b border-slate-900/50">
                                      <td className="py-2 font-bold text-slate-400">{p.debtName}</td>
                                      <td className="py-2 text-right text-rose-500/70 font-mono">{formatCurrency(p.interest)}</td>
                                      <td className="py-2 text-right text-emerald-500/70 font-mono">{formatCurrency(p.principal)}</td>
                                      <td className="py-2 text-right text-emerald-400 font-black font-mono">{formatCurrency(p.total)}</td>
                                    </tr>
                                  ))}
                                  <tr className="font-black">
                                     <td className="py-3 text-slate-300">TOTAL</td>
                                     <td className="py-3 text-right text-rose-500">{formatCurrency(entry.totalInterest)}</td>
                                     <td className="py-3 text-right text-emerald-500">{formatCurrency(entry.totalPrincipal)}</td>
                                     <td className="py-3 text-right text-emerald-400 underline decoration-2 underline-offset-4">{formatCurrency(entry.totalInterest + entry.totalPrincipal)}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>

                          <div className="space-y-4">
                             <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Closing Balances</p>
                             <div className="space-y-2">
                               {Object.entries(entry.balances).map(([name, bal], idx) => {
                                 const balanceValue = bal as number;
                                 return (
                                   <div key={idx} className="flex justify-between items-center text-xs">
                                     <span className="font-semibold text-slate-400">{name}</span>
                                     <span className={`font-mono font-black ${balanceValue <= 0 ? 'text-emerald-500 text-[10px] uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded' : 'text-slate-300'}`}>
                                        {balanceValue <= 0 ? 'PAID OFF' : formatCurrency(balanceValue)}
                                     </span>
                                   </div>
                                 );
                               })}
                             </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </main>
      
      <footer className="max-w-7xl mx-auto mt-20 pt-10 border-t border-slate-900 text-center text-slate-600 text-[9px] font-black uppercase tracking-[0.5em]">
        High-Fidelity Amortization Engine • Credit-Safe Protocol
      </footer>
    </div>
  );
}
