import React, { useState, useEffect, useMemo } from 'react';
import { StorageService, DailyAdjustmentMap } from '../services/storageService';
import { BillingService, DailyCompanyBill, EmployeeBill } from '../services/billingService';
import { Consumption, Employee } from '../types';
import { FileText, Calendar, Sparkles, Coffee, Cookie, Plus, Minus, ChevronDown, ChevronRight, Info, Loader2, Save, X } from 'lucide-react';
import { generateWeeklyInsight } from '../services/geminiService';
import { TallyAutomation } from './TallyAutomation';

// Helper: Convert ISO string (possibly UTC) to Local YYYY-MM-DD
const getLocalYMD = (isoStr: string) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const offset = d.getTimezoneOffset() * 60000;
    const local = new Date(d.getTime() - offset);
    return local.toISOString().split('T')[0];
};

export const WeeklyReport: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [savingEmpId, setSavingEmpId] = useState<string | null>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [consumptions, setConsumptions] = useState<Consumption[]>([]);
  const [activeEmployeeCount, setActiveEmployeeCount] = useState<number>(10);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  
  const [companyBillRows, setCompanyBillRows] = useState<DailyCompanyBill[]>([]);
  const [employeeBills, setEmployeeBills] = useState<EmployeeBill[]>([]);
  const [dailyGroupedLogs, setDailyGroupedLogs] = useState<Record<string, Consumption[]>>({});
  
  const [totalManualTransfer, setTotalManualTransfer] = useState(0);
  const [grandTotalCompany, setGrandTotalCompany] = useState(0);

  const [storedDailyAdjustments, setStoredDailyAdjustments] = useState<DailyAdjustmentMap>({});
  const [draftAdjustments, setDraftAdjustments] = useState<Record<string, Record<string, number>>>({});
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  useEffect(() => {
    const curr = new Date(); 
    const day = curr.getDay() || 7; 
    if (day !== 1) curr.setHours(-24 * (day - 1));
    
    const firstDate = new Date(curr);
    const lastDate = new Date(curr);
    lastDate.setDate(lastDate.getDate() + 6); 

    setStartDate(getLocalYMD(firstDate.toISOString()));
    setEndDate(getLocalYMD(lastDate.toISOString()));

    initData();
  }, []);

  const initData = async () => {
    setLoading(true);
    await StorageService.init(); 
    loadData();
    setLoading(false);
  };

  const loadData = () => {
    setEmployees(StorageService.getEmployees());
    setConsumptions(StorageService.getConsumptions());
    setActiveEmployeeCount(StorageService.getActiveEmployeesCount());
    
    const stored = StorageService.getDailyAdjustments();
    setStoredDailyAdjustments(stored);
    
    // Sync drafts with stored values so visual state is correct on load
    const todayLocal = getLocalYMD(new Date().toISOString());
    if (stored[todayLocal]) {
        setDraftAdjustments(prev => ({
            ...prev,
            ...JSON.parse(JSON.stringify(stored[todayLocal]))
        }));
    }
  };

  const isDirty = (empId: string) => {
      const todayLocal = getLocalYMD(new Date().toISOString());
      const currentDraft = draftAdjustments[empId] || {};
      const currentStored = storedDailyAdjustments[todayLocal]?.[empId] || {};

      const allKeys = new Set([...Object.keys(currentDraft), ...Object.keys(currentStored)]);
      for (let key of allKeys) {
          const draftVal = currentDraft[key] || 0;
          const storedVal = currentStored[key] || 0;
          if (draftVal !== storedVal) return true;
      }
      return false;
  };

  const effectiveDailyAdjustments = useMemo(() => {
      const todayLocal = getLocalYMD(new Date().toISOString());
      const merged: DailyAdjustmentMap = JSON.parse(JSON.stringify(storedDailyAdjustments));
      
      if (!merged[todayLocal]) merged[todayLocal] = {};

      Object.keys(draftAdjustments).forEach(empId => {
          const empDrafts = draftAdjustments[empId];
          merged[todayLocal][empId] = { ...merged[todayLocal][empId], ...empDrafts };
      });

      return merged;
  }, [storedDailyAdjustments, draftAdjustments]);

  useEffect(() => {
      calculateReport(effectiveDailyAdjustments);
  }, [startDate, endDate, consumptions, employees, effectiveDailyAdjustments]);

  const calculateReport = (adjustmentsMap: DailyAdjustmentMap) => {
    if (!startDate || !endDate) return;
    
    const filteredConsumptions = consumptions.filter(c => {
        const cDate = getLocalYMD(c.date);
        return cDate >= startDate && cDate <= endDate;
    });

    const grouped: Record<string, Consumption[]> = {};
    filteredConsumptions.forEach(c => {
        const dateKey = getLocalYMD(c.date);
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(c);
    });
    setDailyGroupedLogs(grouped);

    const result = BillingService.calculateBilling(
        filteredConsumptions,
        employees,
        activeEmployeeCount,
        adjustmentsMap
    );

    setCompanyBillRows(result.companyBillRows);
    setEmployeeBills(result.employeeBills);
    setTotalManualTransfer(result.totalManualTransferAmount);
    setGrandTotalCompany(result.grandTotalCompanyAmount);
  };

  const handleGenerateInsight = async () => {
      setIsGeneratingAi(true);
      try {
          const items = StorageService.getItems();
          const insight = await generateWeeklyInsight(consumptions, employees, items, []); 
          setAiInsight(insight);
      } catch (e) {
          alert("Failed to generate insight.");
      } finally {
          setIsGeneratingAi(false);
      }
  };

  const handleDraftChange = (empId: string, itemId: string, delta: number, maxQty: number) => {
      setDraftAdjustments(prev => {
          const empDrafts = { ...(prev[empId] || {}) };
          
          // Get correct current state from draft or stored
          const currentDraftVal = empDrafts[itemId];
          const todayLocal = getLocalYMD(new Date().toISOString());
          const currentStoredVal = storedDailyAdjustments[todayLocal]?.[empId]?.[itemId] || 0;
          
          const baseVal = currentDraftVal !== undefined ? currentDraftVal : currentStoredVal;

          let newVal = baseVal + delta;
          if (newVal < 0) newVal = 0;
          if (newVal > maxQty) newVal = maxQty;

          return {
              ...prev,
              [empId]: {
                  ...empDrafts,
                  [itemId]: newVal
              }
          };
      });
  };

  const handleSaveAdjustment = async (empId: string) => {
      if (savingEmpId) return;
      const todayLocal = getLocalYMD(new Date().toISOString());
      
      const empDrafts = draftAdjustments[empId];
      if (!empDrafts) return;

      setSavingEmpId(empId);
      try {
          const allAdjustments = StorageService.getDailyAdjustments();
          if (!allAdjustments[todayLocal]) allAdjustments[todayLocal] = {};
          if (!allAdjustments[todayLocal][empId]) allAdjustments[todayLocal][empId] = {};

          Object.keys(empDrafts).forEach(itemId => {
              allAdjustments[todayLocal][empId][itemId] = empDrafts[itemId];
          });

          await StorageService.saveDailyAdjustments(allAdjustments);
          setStoredDailyAdjustments(allAdjustments);
          
          // DO NOT CLEAR DRAFT HERE - keeps UI in sync with the new values
          // The isDirty check will naturally return false now since stored == draft

      } catch (error) {
          console.error("Failed to save", error);
          alert("Failed to save adjustment.");
      } finally {
          setSavingEmpId(null);
      }
  };

  const handleCancelAdjustment = (empId: string) => {
      // Revert draft to stored value by removing draft entry for this employee
      setDraftAdjustments(prev => {
          const next = { ...prev };
          delete next[empId];
          return next;
      });
  };

  const toggleRow = (date: string) => {
      if (expandedDate === date) setExpandedDate(null);
      else setExpandedDate(date);
  };

  const getAggregatedItemString = (items: Consumption[]) => {
      const counts: Record<string, {count: number, total: number}> = {};
      items.forEach(i => {
          const qty = i.quantity || 1;
          if (!counts[i.itemName]) counts[i.itemName] = { count: 0, total: 0 };
          counts[i.itemName].count += qty;
          counts[i.itemName].total += (i.price * qty);
      });
      return Object.entries(counts)
        .map(([name, data]) => `${name}${data.count > 1 ? ` x${data.count}` : ''}`)
        .join(', ');
  };

  const getDetailedDrinks = (date: string) => {
      const logs = dailyGroupedLogs[date] || [];
      const drinks = logs.filter(l => l.itemType === 'drink');
      const counts: Record<string, {count: number, price: number}> = {};
      
      drinks.forEach(d => {
          const qty = d.quantity || 1;
          if (!counts[d.itemName]) counts[d.itemName] = { count: 0, price: d.price };
          counts[d.itemName].count += qty;
      });

      return Object.entries(counts).map(([name, data]) => ({
          name,
          count: data.count,
          total: data.count * data.price
      }));
  };

  const getTodaySnackItems = (empId: string) => {
      const todayLocal = getLocalYMD(new Date().toISOString());
      const logs = dailyGroupedLogs[todayLocal] || [];
      const mySnacks = logs.filter(l => l.itemType === 'snack' && l.employeeId === empId);
      
      const aggregated: Record<string, { name: string, totalQty: number }> = {};
      mySnacks.forEach(s => {
          if (!aggregated[s.itemId]) aggregated[s.itemId] = { name: s.itemName, totalQty: 0 };
          aggregated[s.itemId].totalQty += (s.quantity || 1);
      });
      return Object.entries(aggregated).map(([itemId, data]) => ({ itemId, ...data }));
  };

  if (loading) {
      return <div className="flex h-64 justify-center items-center"><Loader2 className="w-8 h-8 animate-spin text-tea-600"/></div>;
  }

  return (
    <div className="space-y-8">
      {/* Header & Filter */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <FileText className="w-6 h-6 text-tea-600" />
                    Weekly Reports
                </h2>
                <p className="text-sm text-gray-500 mt-1">Review Company & Employee expenses</p>
            </div>
            
            <div className="flex gap-4 items-center bg-gray-50 p-2 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <input 
                        type="date" 
                        value={startDate} 
                        onChange={e => setStartDate(e.target.value)}
                        className="bg-transparent border-none text-sm outline-none text-gray-700 font-medium"
                    />
                </div>
                <span className="text-gray-400">-</span>
                <div className="flex items-center gap-2">
                    <input 
                        type="date" 
                        value={endDate} 
                        onChange={e => setEndDate(e.target.value)}
                        className="bg-transparent border-none text-sm outline-none text-gray-700 font-medium"
                    />
                </div>
            </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
          
          {/* Company Drinks Bill */}
          <div className="space-y-6">
              <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                  <div className="w-8 h-8 rounded-full bg-tea-100 flex items-center justify-center text-tea-600">
                      <Coffee className="w-4 h-4" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800">Company Drinks Bill</h3>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-tea-50 text-tea-800 text-xs uppercase tracking-wider border-b border-tea-100">
                            <th className="p-4 font-semibold w-8"></th>
                            <th className="p-4 font-semibold">Date</th>
                            <th className="p-4 font-semibold text-center">Total Staff</th>
                            <th className="p-4 font-semibold text-center">Drinks</th>
                            <th className="p-4 font-semibold text-center">Manual Added</th>
                            <th className="p-4 font-semibold text-right">Daily Total (₹)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {companyBillRows.length === 0 ? (
                             <tr><td colSpan={6} className="p-8 text-center text-gray-400">No data available.</td></tr>
                        ) : (
                            companyBillRows.map((row) => (
                                <React.Fragment key={row.date}>
                                    <tr 
                                        className="hover:bg-gray-50 transition-colors cursor-pointer group"
                                        onClick={() => toggleRow(row.date)}
                                    >
                                        <td className="p-4 text-center text-gray-400 group-hover:text-tea-600">
                                            {expandedDate === row.date ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                        </td>
                                        <td className="p-4 font-medium text-gray-700">
                                            {new Date(row.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' })}
                                        </td>
                                        <td className="p-4 text-center text-gray-600">{row.totalStaff}</td>
                                        <td className="p-4 text-center text-blue-600 font-medium">{row.actualDrinkCount}</td>
                                        <td className="p-4 text-center">
                                            {row.manualAddedCount > 0 ? (
                                                <span className="bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded-full font-bold">
                                                    +{row.manualAddedCount} Items
                                                </span>
                                            ) : <span className="text-gray-300">-</span>}
                                        </td>
                                        <td className="p-4 text-right font-bold text-gray-800">
                                            ₹{row.totalDailyCost}
                                        </td>
                                    </tr>
                                    {expandedDate === row.date && (
                                        <tr className="bg-gray-50 animate-fade-in">
                                            <td colSpan={6} className="p-4 pl-12">
                                                <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm max-w-md">
                                                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Detailed Breakdown</h4>
                                                    <div className="space-y-1">
                                                        {getDetailedDrinks(row.date).map((d, i) => (
                                                            <div key={i} className="flex justify-between text-sm">
                                                                <span className="text-gray-700">{d.name} <span className="text-gray-400">x{d.count}</span></span>
                                                                <span className="font-mono text-gray-600">₹{d.total}</span>
                                                            </div>
                                                        ))}
                                                        {getDetailedDrinks(row.date).length === 0 && <span className="text-sm text-gray-400 italic">No drinks consumed.</span>}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))
                        )}
                    </tbody>
                    {companyBillRows.length > 0 && (
                        <tfoot className="bg-gray-50 font-bold text-gray-800">
                            {totalManualTransfer !== 0 && (
                                <tr className="bg-orange-50 text-orange-800">
                                    <td className="p-4" colSpan={5}>
                                        <span className="flex items-center gap-2 text-sm font-semibold justify-end">
                                            <Cookie className="w-4 h-4" />
                                            Manual Adjustments from Employee Snacks:
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        {totalManualTransfer > 0 ? `+₹${totalManualTransfer}` : `-₹${Math.abs(totalManualTransfer)}`}
                                    </td>
                                </tr>
                            )}
                            <tr className="border-t-2 border-tea-200 bg-tea-50">
                                <td className="p-4" colSpan={3}>Total</td>
                                <td colSpan={2} className="p-4 text-right pr-8 text-gray-500 text-xs uppercase tracking-wide">Grand Total</td>
                                <td className="p-4 text-right text-xl text-tea-700 font-extrabold">
                                    ₹{grandTotalCompany}
                                </td>
                            </tr>
                        </tfoot>
                    )}
                </table>
              </div>
          </div>

          {/* Consolidated Daily Tally Breakdown */}
          <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                        <Info className="w-4 h-4" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800">Daily Tally Breakdown</h3>
                  </div>
                  <span className="text-xs text-gray-400">Auto-filling disabled</span>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <table className="w-full text-left text-sm">
                      <thead>
                          <tr className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                              <th className="p-3">Date</th>
                              <th className="p-3 text-center">Total Staff</th>
                              <th className="p-3 text-center">Actual Drinks</th>
                              <th className="p-3 text-center">Snack-Only (Avail)</th>
                              <th className="p-3 text-center">Extra Snacks (Avail)</th>
                              <th className="p-3 text-center">Manual Moves</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                          {companyBillRows.length === 0 ? (
                              <tr><td colSpan={6} className="p-6 text-center text-gray-400">No activity logged.</td></tr>
                          ) : (
                              companyBillRows.slice().reverse().map(row => {
                                  const date = row.date;
                                  const logs = dailyGroupedLogs[date] || [];
                                  const drinkConsumers = new Set(logs.filter(l => l.itemType === 'drink').map(l => l.employeeId));
                                  const snackCounts: Record<string, number> = {};
                                  logs.filter(l => l.itemType === 'snack').forEach(l => {
                                      const qty = l.quantity || 1;
                                      snackCounts[l.employeeId] = (snackCounts[l.employeeId] || 0) + qty;
                                  });
                                  
                                  const snackOnly = Object.keys(snackCounts).filter(id => !drinkConsumers.has(id)).length;
                                  const extraSnacks = Object.values(snackCounts).filter(count => count > 1).length;
                                  
                                  return (
                                      <tr key={date} className="hover:bg-gray-50">
                                          <td className="p-3 font-medium text-gray-700">
                                              {new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' })}
                                          </td>
                                          <td className="p-3 text-center">{activeEmployeeCount}</td>
                                          <td className="p-3 text-center text-blue-600 font-bold">{drinkConsumers.size}</td>
                                          <td className="p-3 text-center text-orange-600">{snackOnly}</td>
                                          <td className="p-3 text-center text-purple-600">{extraSnacks}</td>
                                          <td className="p-3 text-center text-gray-700 font-bold bg-gray-50">
                                              {row.manualAddedCount > 0 ? `+${row.manualAddedCount}` : '-'}
                                          </td>
                                      </tr>
                                  );
                              })
                          )}
                      </tbody>
                  </table>
              </div>
          </div>

          {/* Employee Snack Bill */}
          <div className="space-y-6">
               <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                  <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                      <Cookie className="w-4 h-4" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800">Employee Snack Bill</h3>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                            <th className="p-4 font-semibold">Employee</th>
                            <th className="p-4 font-semibold">Items</th>
                            <th className="p-4 font-semibold text-center w-64">Adjust (Today)</th>
                            <th className="p-4 font-semibold text-center">Net Count</th>
                            <th className="p-4 font-semibold text-right">Amount</th>
                            <th className="p-4 font-semibold text-right">Revised Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {employeeBills.length === 0 ? (
                            <tr><td colSpan={6} className="p-8 text-center text-gray-400">No personal snack expenses.</td></tr>
                        ) : (
                            employeeBills.map((bill) => {
                                const hasChanges = isDirty(bill.employee.id);
                                const isSaving = savingEmpId === bill.employee.id;
                                const todaySnacks = getTodaySnackItems(bill.employee.id);
                                
                                return (
                                <tr key={bill.employee.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-4">
                                        <div className="font-bold text-gray-800">{bill.employee.name}</div>
                                    </td>
                                    <td className="p-4">
                                        <div className="text-xs text-gray-500 max-w-xs break-words">
                                            {getAggregatedItemString(bill.items)}
                                        </div>
                                    </td>
                                    
                                    {/* Manual Adjustment Column (Item Specific) */}
                                    <td className="p-4 text-center">
                                        {isSaving ? (
                                            <div className="flex justify-center p-2">
                                                <Loader2 className="w-5 h-5 animate-spin text-tea-600" />
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-2">
                                                {todaySnacks.length === 0 ? (
                                                    <span className="text-xs text-gray-300">-</span>
                                                ) : (
                                                    todaySnacks.map(item => {
                                                        const currentDraft = draftAdjustments[bill.employee.id]?.[item.itemId];
                                                        const currentStored = bill.todayAdjustmentMap[item.itemId] || 0;
                                                        const displayVal = currentDraft !== undefined ? currentDraft : currentStored;
                                                        const isModified = currentDraft !== undefined && currentDraft !== currentStored;
                                                        const isAdjusted = displayVal > 0;

                                                        return (
                                                            <div key={item.itemId} className={`flex items-center justify-between w-full rounded p-1 text-xs ${isAdjusted ? 'bg-green-50 ring-1 ring-green-100' : 'bg-gray-50'}`}>
                                                                <div className="flex flex-col items-start mr-2">
                                                                    <span className="text-gray-600 truncate max-w-[60px]" title={item.name}>{item.name}</span>
                                                                    {isAdjusted && <span className="text-[9px] text-green-600 font-bold">{displayVal} to Co.</span>}
                                                                </div>
                                                                <div className={`flex items-center gap-1 ${isModified ? 'bg-blue-50 ring-1 ring-blue-100 rounded' : ''}`}>
                                                                    <button 
                                                                        onClick={() => handleDraftChange(bill.employee.id, item.itemId, -1, item.totalQty)}
                                                                        className="w-5 h-5 flex items-center justify-center bg-white border border-gray-200 rounded hover:bg-gray-100 text-gray-600"
                                                                        disabled={displayVal <= 0}
                                                                    >
                                                                        <Minus className="w-3 h-3" />
                                                                    </button>
                                                                    <span className={`w-4 text-center font-bold ${isModified ? 'text-blue-600' : (isAdjusted ? 'text-green-700' : 'text-gray-700')}`}>{displayVal}</span>
                                                                    <button 
                                                                        onClick={() => handleDraftChange(bill.employee.id, item.itemId, 1, item.totalQty)}
                                                                        className="w-5 h-5 flex items-center justify-center bg-white border border-gray-200 rounded hover:bg-gray-100 text-gray-600"
                                                                        disabled={displayVal >= item.totalQty}
                                                                    >
                                                                        <Plus className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                                
                                                {/* Action Buttons: Only show if ANY change exists for this user */}
                                                {hasChanges && (
                                                    <div className="flex gap-2 animate-fade-in mt-1 w-full justify-center">
                                                        <button 
                                                            onClick={() => handleSaveAdjustment(bill.employee.id)}
                                                            className="flex-1 bg-blue-600 text-white p-1 rounded hover:bg-blue-700 shadow-sm flex justify-center items-center text-xs gap-1"
                                                            title="Save All"
                                                        >
                                                            <Save className="w-3 h-3" /> Save
                                                        </button>
                                                        <button 
                                                            onClick={() => handleCancelAdjustment(bill.employee.id)}
                                                            className="bg-gray-200 text-gray-600 p-1 rounded hover:bg-gray-300 shadow-sm"
                                                            title="Cancel"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                    
                                    <td className="p-4 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="text-xs font-semibold text-gray-500 mb-1">Total: {bill.originalItemCount}</span>
                                            {bill.finalDeductedCount > 0 && (
                                                <span className="inline-block bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-bold">
                                                    -{bill.finalDeductedCount}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <span className="text-sm font-medium text-gray-600">₹{bill.originalAmount}</span>
                                        {bill.finalDeductedAmount > 0 && (
                                            <div className="text-xs text-green-600">-₹{bill.finalDeductedAmount}</div>
                                        )}
                                    </td>
                                    <td className="p-4 text-right">
                                        <span className="text-lg font-bold text-tea-600">₹{bill.finalPayableAmount}</span>
                                    </td>
                                </tr>
                            )})
                        )}
                    </tbody>
                    {employeeBills.length > 0 && (
                        <tfoot className="bg-gray-50">
                            <tr>
                                <td className="p-4 font-bold text-gray-700">Total</td>
                                <td colSpan={4} className="p-4 text-right font-bold text-gray-500">
                                    ₹{employeeBills.reduce((a,b) => a + (Number(b.originalAmount) || 0), 0)}
                                </td>
                                <td className="p-4 text-right font-bold text-tea-700">
                                    ₹{employeeBills.reduce((sum, bill) => sum + (Number(bill.finalPayableAmount) || 0), 0)}
                                </td>
                            </tr>
                        </tfoot>
                    )}
                </table>
              </div>
          </div>
      </div>

      {/* AI Insight Section */}
      <div className="mt-8 bg-gradient-to-r from-tea-50 to-white p-6 rounded-xl border border-tea-100 hidden">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-tea-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    AI Analysis
                </h3>
                {!aiInsight && (
                    <button 
                        onClick={handleGenerateInsight}
                        disabled={isGeneratingAi}
                        className="text-xs bg-white border border-tea-200 hover:bg-tea-50 text-tea-700 px-3 py-1.5 rounded-full transition-colors font-medium"
                    >
                        {isGeneratingAi ? 'Analyzing...' : 'Generate Insights with Gemini'}
                    </button>
                )}
            </div>
            {aiInsight ? (
                <div className="text-gray-700 text-sm leading-relaxed animate-fade-in">
                    {aiInsight}
                </div>
            ) : (
                <p className="text-gray-400 text-sm italic">
                    Generate a smart summary of consumption trends and anomalies using Google Gemini.
                </p>
            )}
        </div>
    </div>
  );
};