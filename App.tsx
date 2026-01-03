import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  TrendingDown, 
  Calendar, 
  ChevronDown, 
  ChevronRight, 
  Settings2, 
  MoveUpRight, 
  Plus, 
  Trash2, 
  ListFilter, 
  ShieldCheck, 
  CreditCard, 
  Download, 
  Upload, 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  LogIn, 
  LogOut, 
  UserPlus, 
  Mail, 
  Lock, 
  Loader2,
  CheckCircle2
} from 'lucide-react';

// Firebase Modular SDK (v10+)
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  User, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  Auth
} from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, getDoc, Firestore } from 'firebase/firestore';

import { Debt, LumpSum, BudgetChange } from './types';
import { INITIAL_DEBTS, DEFAULT_LUMP_SUM, DEFAULT_MONTHLY_BUDGET } from './constants';
import { runSimulation } from './services/calculationEngine';

// Safe environment variable access
const getEnv = (key: string): string | undefined => {
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key];
    if (typeof window !== 'undefined' && (window as any)[key]) return (window as any)[key];
  } catch (e) {}
  return undefined;
};

// Firebase Configuration
const firebaseConfig = {
  apiKey: getEnv('FIREBASE_API_KEY'),
  authDomain: getEnv('FIREBASE_AUTH_DOMAIN'),
  projectId: getEnv('FIREBASE_PROJECT_ID'),
  storageBucket: getEnv('FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnv('FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnv('FIREBASE_APP_ID'),
  measurementId: getEnv('FIREBASE_MEASUREMENT_ID')
};

// Global state for Firebase instances
let db: Firestore | null = null;
let auth: Auth | null = null;

// Initialization logic with graceful mock fallback
const initFirebase = () => {
  if (auth && db) return { auth, db, isMock: false };
  if (!firebaseConfig.apiKey) return { auth: null, db: null, isMock: true };

  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    return { auth, db, isMock: false };
  } catch (err) {
    return { auth: null, db: null, isMock: true };
  }
};

export default function App() {
  const [debts, setDebts] = useState<Debt[]>(INITIAL_DEBTS);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [injections, setInjections] = useState<LumpSum[]>([
    { id: 'initial-1', amount: DEFAULT_LUMP_SUM, date: new Date().toISOString().split('T')[0] }
  ]);
  const [monthlyBudget, setMonthlyBudget] = useState(DEFAULT_MONTHLY_BUDGET);
  const [budgetChanges, setBudgetChanges] = useState<BudgetChange[]>([]);
  const [expandedMonths, setExpandedMonths] = useState<Set<number>>(new Set());
  
  // Auth & Sync State
  const [user, setUser] = useState<User | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSavedFeedback, setShowSavedFeedback] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isLoginView, setIsLoginView] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMockMode, setIsMockMode] = useState(false);

  // --- SAVE TO FIRESTORE FUNCTION ---
  const saveToFirestore = async () => {
    if (!user) return;
    setIsSyncing(true);
    
    const dataToSave = {
      debts, 
      startDate, 
      injections, 
      monthlyBudget, 
      budgetChanges,
      email: user.email,
      lastModified: new Date().toISOString()
    };

    try {
      if (isMockMode) {
        localStorage.setItem(`debt_sim_data_${user.uid}`, JSON.stringify(dataToSave));
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 600));
      } else if (db) {
        const docRef = doc(db, 'users', user.uid, 'data', 'currentSimulation');
        await setDoc(docRef, dataToSave, { merge: true });
      }
      
      // Success Feedback
      setShowSavedFeedback(true);
      setTimeout(() => setShowSavedFeedback(false), 3000);
    } catch (e) {
      console.error("Firestore Save Error:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  // --- PERSISTENCE: LOAD DATA ON LOGIN ---
  useEffect(() => {
    const { auth: currentAuth, db: currentDb, isMock } = initFirebase();
    setIsMockMode(isMock);
    
    if (isMock) {
      const savedUser = localStorage.getItem('debt_sim_mock_user');
      if (savedUser) {
        const u = JSON.parse(savedUser);
        setUser(u);
        const savedData = localStorage.getItem(`debt_sim_data_${u.uid}`);
        if (savedData) {
          const d = JSON.parse(savedData);
          setDebts(d.debts || INITIAL_DEBTS);
          setStartDate(d.startDate || startDate);
          setInjections(d.injections || injections);
          setMonthlyBudget(d.monthlyBudget || monthlyBudget);
          setBudgetChanges(d.budgetChanges || budgetChanges);
        }
      }
      setAuthLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(currentAuth!, async (u) => {
      setUser(u);
      setAuthLoading(false);
      if (u && currentDb) {
        try {
          // AUTO-LOAD ON LOGIN
          const docRef = doc(currentDb, 'users', u.uid, 'data', 'currentSimulation');
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.debts) setDebts(data.debts);
            if (data.startDate) setStartDate(data.startDate);
            if (data.injections) setInjections(data.injections);
            if (data.monthlyBudget) setMonthlyBudget(data.monthlyBudget);
            if (data.budgetChanges) setBudgetChanges(data.budgetChanges);
          }
        } catch (e) {
          console.error("Auto-load failed:", e);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // --- AUTO-SAVE (Optional Debounce) ---
  useEffect(() => {
    if (!user) return;
    const saveTimeout = setTimeout(saveToFirestore, 2000);
    return () => clearTimeout(saveTimeout);
  }, [debts, startDate, injections, monthlyBudget, budgetChanges, user, isMockMode]);

  // --- AUTH HANDLERS ---
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    setAuthError('');
    
    const { auth: currentAuth, isMock } = initFirebase();

    // Simulation delay for feel
    await new Promise(r => setTimeout(r, 800));

    if (isMock) {
      const mockUser = { uid: 'mock-' + email.split('@')[0], email } as User;
      setUser(mockUser);
      localStorage.setItem('debt_sim_mock_user', JSON.stringify(mockUser));
      setShowAuthModal(false);
      setIsSubmitting(false);
      return;
    }

    try {
      if (isLoginView) {
        await signInWithEmailAndPassword(currentAuth!, email, password);
      } else {
        await createUserWithEmailAndPassword(currentAuth!, email, password);
      }
      setShowAuthModal(false);
    } catch (err: any) {
      setAuthError((err.message || 'Error').replace('Firebase: ', '').toUpperCase());
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    if (isMockMode) {
      setUser(null);
      localStorage.removeItem('debt_sim_mock_user');
    } else if (auth) {
      signOut(auth);
    }
  };

  // --- ENGINE CALCULATIONS ---
  const results = useMemo(() => {
    const standard = runSimulation(debts, injections, monthlyBudget, budgetChanges, startDate, false);
    return { standard };
  }, [debts, injections, monthlyBudget, budgetChanges, startDate]);

  const totalMinimums = useMemo(() => {
    return debts.reduce((sum, d) => sum + Math.max(d.minPaymentFlat, d.balance * (d.minPaymentPercent / 100)), 0);
  }, [debts]);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  const formatMonthLabel = (monthIndex: number) => {
    const date = new Date(startDate);
    date.setMonth(date.getMonth() + monthIndex);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const toggleMonth = (m: number) => {
    const next = new Set(expandedMonths);
    if (next.has(m)) next.delete(m); else next.add(m);
    setExpandedMonths(next);
  };

  const handleDebtChange = (id: string, field: keyof Debt, value: any) => {
    setDebts(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const addInjection = () => {
    setInjections(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), amount: 1000, date: new Date().toISOString().split('T')[0] }]);
  };

  const removeInjection = (id: string) => setInjections(prev => prev.filter(inj => inj.id !== id));

  const addBudgetChange = () => {
    setBudgetChanges(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), amount: monthlyBudget + 500, date: new Date().toISOString().split('T')[0] }]);
  };

  const removeBudgetChange = (id: string) => setBudgetChanges(prev => prev.filter(bc => bc.id !== id));

  const getMonthOffset = (dateStr: string) => {
    const now = new Date(startDate);
    const target = new Date(dateStr);
    return (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 p-4 md:p-8 font-sans selection:bg-emerald-500/30">
      {/* AUTH MODAL */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-cyan-500" />
            <h2 className="text-3xl font-black mb-2 uppercase tracking-tight">
              {isLoginView ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="text-slate-400 text-sm mb-8">Securely sync your debt simulations across devices.</p>
            
            <form onSubmit={handleAuth} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl py-4 pl-12 pr-4 text-sm focus:border-emerald-500 outline-none transition-all"
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input 
                    type="password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl py-4 pl-12 pr-4 text-sm focus:border-emerald-500 outline-none transition-all"
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {authError && <p className="text-rose-500 text-[10px] font-bold uppercase text-center animate-pulse leading-relaxed px-4">{authError}</p>}

              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500 text-emerald-950 font-black py-4 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 uppercase tracking-widest flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  isLoginView ? 'Sign In' : 'Create Account'
                )}
              </button>
            </form>

            <button 
              onClick={() => setIsLoginView(!isLoginView)}
              disabled={isSubmitting}
              className="w-full mt-6 text-[10px] font-black uppercase text-slate-500 hover:text-emerald-400 tracking-widest transition-colors disabled:opacity-50"
            >
              {isLoginView ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
            </button>
            
            <button onClick={() => setShowAuthModal(false)} className="absolute top-6 right-6 text-slate-600 hover:text-slate-300 transition-colors">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <header className="max-w-7xl mx-auto mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent uppercase">
            Debt Waterfall Simulator
          </h1>
          <div className="flex items-center gap-4 mt-2">
            <p className="text-slate-400 font-medium tracking-wide uppercase text-xs">High-Fidelity Avalanche Engine</p>
            {user ? (
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black transition-all border ${
                showSavedFeedback 
                ? 'bg-emerald-500 text-emerald-950 border-emerald-400 scale-105' 
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}>
                {showSavedFeedback ? (
                  <><CheckCircle2 className="w-3 h-3" /> SAVED!</>
                ) : (
                  <><Cloud className={`w-3 h-3 ${isSyncing ? 'animate-pulse' : ''}`} /> {isSyncing ? 'SYNCING...' : isMockMode ? 'LOCAL CLOUD ACTIVE' : 'CLOUD ACTIVE'}</>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-3 py-1 rounded-full text-[10px] font-black text-slate-500">
                <CloudOff className="w-3 h-3" /> OFFLINE MODE
              </div>
            )}
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          {user ? (
            <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 pl-6 pr-2 py-2 rounded-2xl shadow-xl">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{user.email}</span>
              <button 
                onClick={handleLogout}
                className="p-3 bg-slate-800 hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 rounded-xl transition-all"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-3 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 px-8 py-3 rounded-2xl transition-all font-black text-sm shadow-xl shadow-emerald-500/10 uppercase tracking-widest"
            >
              <LogIn className="w-4 h-4" /> Connect Cloud
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-4 space-y-6">
          <section className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center gap-3">
                <Settings2 className="w-5 h-5 text-emerald-500" /> Global Controls
              </h2>
              {user && (
                <button 
                  onClick={saveToFirestore}
                  disabled={isSyncing}
                  className="text-[10px] font-black uppercase px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500 hover:text-emerald-950 transition-all border border-emerald-500/20 disabled:opacity-50"
                >
                  {isSyncing ? 'SAVING...' : 'SAVE NOW'}
                </button>
              )}
            </div>
            <div className="space-y-6">
              <div className="group">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 group-focus-within:text-emerald-400 transition-colors">Simulation Start</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all [color-scheme:dark]" />
                </div>
              </div>
              <div className="group">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 group-focus-within:text-emerald-400 transition-colors">Monthly Budget</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                  <input type="number" value={monthlyBudget} onChange={(e) => setMonthlyBudget(Number(e.target.value))} className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl py-4 pl-10 pr-4 text-2xl font-black focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all" />
                </div>
              </div>
              <div className="pt-4 border-t border-slate-800">
                <div className="flex justify-between items-center mb-4"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2">Lump Injections</label><button onClick={addInjection} className="p-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-xl transition-all border border-cyan-500/20"><Plus className="w-4 h-4" /></button></div>
                <div className="space-y-3">
                  {injections.map((inj) => (
                    <div key={inj.id} className="bg-slate-800/30 border border-slate-700/50 p-4 rounded-2xl group relative">
                      <button onClick={() => removeInjection(inj.id)} className="absolute -top-2 -right-2 p-1.5 bg-slate-900 border border-slate-700 rounded-full text-slate-600 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100 shadow-xl"><Trash2 className="w-3.5 h-3.5" /></button>
                      <div className="flex items-center gap-3 mb-2"><Calendar className="w-4 h-4 text-slate-500" /><input type="date" value={inj.date} onChange={(e) => setInjections(prev => prev.map(i => i.id === inj.id ? { ...i, date: e.target.value } : i))} className="bg-transparent text-xs font-bold text-slate-200 outline-none [color-scheme:dark]" /></div>
                      <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">$</span><input type="number" value={inj.amount} onChange={(e) => setInjections(prev => prev.map(i => i.id === inj.id ? { ...i, amount: Number(e.target.value) } : i))} className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-2 pl-7 pr-3 text-lg font-black focus:border-emerald-500 outline-none transition-all" /></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-sm">
            <div className="p-6 bg-slate-900/80 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2 uppercase tracking-tight">
                <CreditCard className="w-5 h-5 text-emerald-500" /> Debts
              </h2>
            </div>
            <div className="p-4 max-h-[600px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[9px] text-slate-500 uppercase tracking-widest border-b border-slate-800">
                    <th className="pb-4 font-black">Account</th>
                    <th className="pb-4 font-black text-right">Bal</th>
                    <th className="pb-4 font-black text-right">APR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {debts.map(debt => (
                    <tr key={debt.id} className="group hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 text-[11px] font-bold text-slate-400">{debt.name}</td>
                      <td className="py-3 text-right">
                        <input type="number" value={debt.balance} onChange={(e) => handleDebtChange(debt.id, 'balance', Number(e.target.value))} className="bg-transparent text-right w-20 text-[11px] font-black outline-none focus:text-emerald-400" />
                      </td>
                      <td className="py-3 text-right">
                        <input type="number" value={debt.apr} onChange={(e) => handleDebtChange(debt.id, 'apr', Number(e.target.value))} className="bg-transparent text-right w-12 text-[11px] font-black text-cyan-400 outline-none focus:text-cyan-300" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="lg:col-span-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl relative overflow-hidden group">
              <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Lifetime Interest</p>
              <h3 className="text-2xl font-black text-rose-500 mt-1">{formatCurrency(results.standard.totalInterestPaid)}</h3>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl relative overflow-hidden group">
              <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Time to Freedom</p>
              <h3 className="text-2xl font-black text-cyan-400 mt-1">{results.standard.monthsToDebtFree} Months</h3>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl relative overflow-hidden group">
              <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Monthly Minimums</p>
              <h3 className="text-2xl font-black text-emerald-400 mt-1">{formatCurrency(totalMinimums)}</h3>
            </div>
          </div>

          <section className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-md">
            <div className="p-8 border-b border-slate-800 bg-slate-900/80">
              <h2 className="text-2xl font-black flex items-center gap-3 uppercase tracking-tight">
                <ListFilter className="w-6 h-6 text-emerald-400" /> Payoff Ledger
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
                            {hasInj && <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[8px] font-black uppercase tracking-widest border border-emerald-500/30">Injection</span>}
                          </div>
                          <div className="text-[10px] flex gap-4 mt-1 font-bold text-slate-500">
                            <span className="text-emerald-400/80 flex items-center gap-1.5 uppercase tracking-wide"><MoveUpRight className="w-3 h-3" /> Principal: {formatCurrency(entry.totalPrincipal)}</span>
                            <span className="text-rose-400/80 flex items-center gap-1.5 uppercase tracking-wide"><TrendingDown className="w-3 h-3" /> Interest: {formatCurrency(entry.totalInterest)}</span>
                          </div>
                        </div>
                      </div>
                      {expandedMonths.has(entry.month) ? <ChevronDown className="w-5 h-5 text-slate-700" /> : <ChevronRight className="w-5 h-5 text-slate-700" />}
                    </button>
                    {expandedMonths.has(entry.month) && (
                      <div className="px-12 pb-8 pt-2 animate-in slide-in-from-top-4 duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-950/50 p-6 rounded-[2rem] border border-slate-800 text-xs">
                          <div className="space-y-4">
                            <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Payments</p>
                            {entry.payments.map((p, idx) => (
                              <div key={idx} className="flex justify-between items-center border-b border-slate-900 pb-2">
                                <span className="text-slate-400 font-bold">{p.debtName}</span>
                                <span className="text-emerald-400 font-black">{formatCurrency(p.principal)}</span>
                              </div>
                            ))}
                          </div>
                          <div className="space-y-4">
                            <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Balances</p>
                            {Object.entries(entry.balances).map(([name, bal], idx) => (
                              <div key={idx} className="flex justify-between items-center text-[11px]">
                                <span className="text-slate-400">{name}</span>
                                <span className={`font-black ${bal <= 0 ? 'text-emerald-500' : 'text-slate-300'}`}>{bal <= 0 ? 'PAID' : formatCurrency(bal)}</span>
                              </div>
                            ))}
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
        High-Fidelity Amortization Engine • Zero-Knowledge Architecture
      </footer>
    </div>
  );
}