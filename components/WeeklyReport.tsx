import React, { useState, useEffect, useMemo } from 'react';
import { StorageService, DailyAdjustmentMap } from '../services/storageService';
import { BillingService, DailyCompanyBill, EmployeeBill } from '../services/billingService';
import { Consumption, Employee } from '../types';
import { FileText, Calendar, Sparkles, Coffee, Cookie, Plus, Minus, ChevronDown, ChevronRight, Info, Loader2, Save, X, Edit3 } from 'lucide-react';
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
  
  // NEW: State to track which date we are currently adjusting
  const [adjustmentDate, setAdjustmentDate] = useState<string>('');

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

    const startStr = getLocalYMD(firstDate.toISOString());
    const endStr = getLocalYMD(lastDate.toISOString());
    const todayStr = getLocalYMD(new Date().toISOString());

    setStartDate(startStr);
    setEndDate(endStr);
    setAdjustmentDate(todayStr); // Default adjustment to today

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
    
    // Sync drafts: When loading, clear old drafts to avoid confusion across dates
    setDraftAdjustments({});
  };

  // Helper to check if adjustments are pending specifically for the SELECTED adjustment date
  const isDirty = (empId: string) => {
      if (!adjustmentDate) return false;
      
      const currentDraft = draftAdjustments[empId];
      // If no draft entry exists for this user, it means nothing has been touched/modified since last save
      if (!currentDraft) return false;

      const currentStored = storedDailyAdjustments[adjustmentDate]?.[empId] || {};

      // Only iterate keys present in the draft. 
      // If a key is missing from draft, it implies it hasn't been modified.
      for (const key of Object.keys(currentDraft)) {
          const draftVal = currentDraft[key];
          const storedVal = currentStored[key] || 0;
          if (draftVal !== storedVal) return true;
      }
      return false;
  };

  const effectiveDailyAdjustments = useMemo(() => {
      const merged: DailyAdjustmentMap = JSON.parse(JSON.stringify(storedDailyAdjustments));
      
      // Merge current drafts into the stored data for calculation preview
      // Note: We only merge drafts for the currently selected adjustmentDate
      if (adjustmentDate) {
          if (!merged[adjustmentDate]) merged[adjustmentDate] = {};
          Object.keys(draftAdjustments).forEach(empId => {
              const empDrafts = draftAdjustments[empId];
              merged[adjustmentDate][empId] = { ...merged[adjustmentDate][empId], ...empDrafts };
          });
      }

      return merged;
  }, [storedDailyAdjustments, draftAdjustments, adjustmentDate]);

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
      if (!adjustmentDate) return;

      setDraftAdjustments(prev => {
          const empDrafts = { ...(prev[empId] || {}) };
          
          // Get correct current state
          const currentDraftVal = empDrafts[itemId];
          const currentStoredVal = storedDailyAdjustments[adjustmentDate]?.[empId]?.[itemId] || 0;
          
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
      if (savingEmpId || !adjustmentDate) return;
      
      const empDrafts = draftAdjustments[empId];
      if (!empDrafts) return;

      setSavingEmpId(empId);
      try {
          const allAdjustments = StorageService.getDailyAdjustments();
          if (!allAdjustments[adjustmentDate]) allAdjustments[adjustmentDate] = {};
          if (!allAdjustments[adjustmentDate][empId]) allAdjustments[adjustmentDate][empId] = {};

          Object.keys(empDrafts).forEach(itemId => {
              allAdjustments[adjustmentDate][empId][itemId] = empDrafts[itemId];
          });

          await StorageService.saveDailyAdjustments(allAdjustments);
          setStoredDailyAdjustments(allAdjustments);
          
          // Clear draft for this user as it is now saved
          setDraftAdjustments(prev => {
              const next = { ...prev };
              delete next[empId];
              return next;
          });

      } catch (error) {
          console.error("Failed to save", error);
          alert("Failed to save adjustment.");
      } finally {
          setSavingEmpId(null);
      }
  };

  const handleCancelAdjustment = (empId: string) => {
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

  const getSnackItemsForAdjustmentDate = (empId: string) => {
      if (!adjustmentDate) return [];
      const logs = dailyGroupedLogs[adjustmentDate] || [];
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
                            <th className="p-4 font-semibold text-center text-tea-700">Tea Sessions<br/><span className="text-[10px] text-tea-400 normal-case">AM | PM (Headcount)</span></th>
                            <th className="p-4 font-semibold text-center bg-blue-50 text-blue-800 border-l border-blue-100">Total Cups</th>
                            <th className="p-4 font-semibold text-center">Manual Added</th>
                            <th className="p-4 font-semibold text-right">Daily Total (₹)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {companyBillRows.length === 0 ? (
                             <tr><td colSpan={7} className="p-8 text-center text-gray-400">No data available.</td></tr>
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
                                        <td className="p-4 text-center text-tea-600 font-medium">
                                             <span title="Morning">{row.amDrinkCount}</span>
                                             <span className="text-gray-300 mx-1">|</span>
                                             <span title="Afternoon">{row.pmDrinkCount}</span>
                                        </td>
                                        <td className="p-4 text-center bg-blue-50 border-l border-blue-100 font-bold text-blue-700">
                                            {row.totalDrinkCount}
                                            <span className="text-[10px] text-blue-400 block">Cups</span>
                                        </td>
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
                                            <td colSpan={7} className="p-4 pl-12">
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
                                    <td className="p-4" colSpan={6}>
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
                                <td colSpan={3} className="p-4 text-right pr-8 text-gray-500 text-xs uppercase tracking-wide">Grand Total</td>
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
                  <span className="text-xs text-gray-400">Ascending Date Order</span>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <table className="w-full text-left text-sm">
                      <thead>
                          <tr className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200 text-xs uppercase tracking-wider">
                              <th className="p-3">Date</th>
                              <th className="p-3 text-center">Total Staff<br/><span className="text-[10px] text-gray-400 normal-case">(Headcount)</span></th>
                              <th className="p-3 text-center text-tea-700">Tea Sessions<br/><span className="text-[10px] text-tea-400 normal-case">AM | PM (Headcount)</span></th>
                              <th className="p-3 text-center bg-blue-50 text-blue-700">Total Cups<br/><span className="text-[10px] text-blue-400 normal-case">(Item Count - drinks)</span></th>
                              <th className="p-3 text-center">Snack-Only<br/><span className="text-[10px] text-gray-400 normal-case">AM | PM (Sessions)</span></th>
                              <th className="p-3 text-center">Multi-Snack<br/><span className="text-[10px] text-gray-400 normal-case">AM | PM (Sessions)</span></th>
                              <th className="p-3 text-center">Manual Moves<br/><span className="text-[10px] text-gray-400 normal-case">(Item Count)</span></th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                          {companyBillRows.length === 0 ? (
                              <tr><td colSpan={7} className="p-6 text-center text-gray-400">No activity logged.</td></tr>
                          ) : (
                              // Sorted by date ascending
                              companyBillRows.map(row => {
                                  const date = row.date;
                                  const logs = dailyGroupedLogs[date] || [];
                                  
                                  // --- Apply Session Logic to visual breakdown (Mirroring BillingService) ---
                                  // This ensures the "Snack-Only" numbers visually align with the "Manual Moves"
                                  
                                  // 1. Split into AM (Before 1PM) and PM (After 1PM)
                                  const amLogs = logs.filter(l => {
                                      const d = new Date(l.date);
                                      if (isNaN(d.getTime())) return true; // Legacy
                                      return d.getHours() < 13;
                                  });
                                  const pmLogs = logs.filter(l => {
                                      const d = new Date(l.date);
                                      if (isNaN(d.getTime())) return false;
                                      return d.getHours() >= 13;
                                  });

                                  // 2. Calculate Stats per Session
                                  const getSessionStats = (sessionLogs: Consumption[]) => {
                                      const drinkConsumers = new Set(sessionLogs.filter(l => l.itemType === 'drink').map(l => l.employeeId));
                                      
                                      const snackCounts: Record<string, number> = {};
                                      sessionLogs.filter(l => l.itemType === 'snack').forEach(l => {
                                          const qty = l.quantity || 1;
                                          snackCounts[l.employeeId] = (snackCounts[l.employeeId] || 0) + qty;
                                      });

                                      // People who had snacks but NO drink in THIS session
                                      const snackOnly = Object.keys(snackCounts).filter(id => !drinkConsumers.has(id)).length;
                                      // People who had > 1 snack quantity in THIS session
                                      const multiSnack = Object.values(snackCounts).filter(count => count > 1).length;

                                      return { snackOnly, multiSnack };
                                  };

                                  const amStats = getSessionStats(amLogs);
                                  const pmStats = getSessionStats(pmLogs);
                                  
                                  return (
                                      <tr key={date} className="hover:bg-gray-50">
                                          <td className="p-3 font-medium text-gray-700">
                                              {new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' })}
                                          </td>
                                          <td className="p-3 text-center">{activeEmployeeCount}</td>
                                          <td className="p-3 text-center text-tea-600 font-bold">
                                              <span title="Morning">{row.amDrinkCount}</span>
                                              <span className="text-gray-300 mx-1">|</span>
                                              <span title="Afternoon">{row.pmDrinkCount}</span>
                                          </td>
                                          <td className="p-3 text-center bg-blue-50 text-blue-700 font-bold">{row.totalDrinkCount}</td>
                                          <td className="p-3 text-center text-orange-600">
                                              <span title="Morning Snack Only">{amStats.snackOnly}</span>
                                              <span className="text-gray-300 mx-1">|</span>
                                              <span title="Afternoon Snack Only">{pmStats.snackOnly}</span>
                                          </td>
                                          <td className="p-3 text-center text-purple-600">
                                              <span title="Morning Multi-Snack">{amStats.multiSnack}</span>
                                              <span className="text-gray-300 mx-1">|</span>
                                              <span title="Afternoon Multi-Snack">{pmStats.multiSnack}</span>
                                          </td>
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
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                        <Cookie className="w-4 h-4" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800">Employee Snack Bill</h3>
                  </div>

                  {/* Contextual Adjustment Date Picker */}
                  <div className="flex items-center gap-2 bg-orange-50 p-2 rounded-lg border border-orange-100 animate-fade-in">
                      <Edit3 className="w-4 h-4 text-orange-600" />
                      <span className="text-xs font-semibold text-orange-800">Manage Adjustments For:</span>
                      <input 
                          type="date"
                          value={adjustmentDate}
                          onChange={e => {
                              setAdjustmentDate(e.target.value);
                              // Clear drafts when switching dates to prevent confusion
                              setDraftAdjustments({});
                          }}
                          min={startDate}
                          max={endDate}
                          className="text-sm bg-white border border-orange-200 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-orange-300 text-gray-700 font-medium"
                      />
                  </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                            <th className="p-4 font-semibold">Employee</th>
                            <th className="p-4 font-semibold">Weekly Items</th>
                            <th className="p-4 font-semibold text-center w-64 bg-orange-50 border-x border-orange-100">
                                Adjust ({adjustmentDate ? new Date(adjustmentDate).toLocaleDateString(undefined, {month:'short', day:'numeric'}) : 'Select Date'})
                            </th>
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
                                // Changed: Fetch items for the SELECTED adjustment date, not necessarily today
                                const adjustmentDateSnacks = getSnackItemsForAdjustmentDate(bill.employee.id);
                                
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
                                    <td className="p-4 text-center bg-orange-50/30 border-x border-orange-50">
                                        {isSaving ? (
                                            <div className="flex justify-center p-2">
                                                <Loader2 className="w-5 h-5 animate-spin text-tea-600" />
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-2">
                                                {!adjustmentDate ? (
                                                    <span className="text-xs text-gray-400 italic">Select date above</span>
                                                ) : adjustmentDateSnacks.length === 0 ? (
                                                    <span className="text-xs text-gray-300 italic">No snacks on {new Date(adjustmentDate).toLocaleDateString(undefined, {weekday:'short'})}</span>
                                                ) : (
                                                    adjustmentDateSnacks.map(item => {
                                                        const currentDraft = draftAdjustments[bill.employee.id]?.[item.itemId];
                                                        const currentStored = storedDailyAdjustments[adjustmentDate]?.[bill.employee.id]?.[item.itemId] || 0;
                                                        
                                                        const displayVal = currentDraft !== undefined ? currentDraft : currentStored;
                                                        const isModified = currentDraft !== undefined && currentDraft !== currentStored;
                                                        const isAdjusted = displayVal > 0;
                                                        
                                                        const remainingQty = item.totalQty - displayVal;

                                                        return (
                                                            <div key={item.itemId} className={`flex items-center justify-between w-full rounded p-1 text-xs ${isAdjusted ? 'bg-green-50 ring-1 ring-green-100' : 'bg-white shadow-sm'}`}>
                                                                <div className="flex flex-col items-start mr-2">
                                                                    <div className="flex items-center">
                                                                        <span className="text-gray-600 truncate max-w-[60px]" title={item.name}>{item.name}</span>
                                                                        <span className={`ml-1 font-mono ${remainingQty === 0 ? 'text-gray-300' : 'text-gray-500 font-bold'}`}>x{remainingQty}</span>
                                                                    </div>
                                                                    {isAdjusted && <span className="text-[9px] text-green-600 font-bold">{displayVal} to Co.</span>}
                                                                </div>
                                                                <div className={`flex items-center gap-1 ${isModified ? 'bg-blue-50 ring-1 ring-blue-100 rounded' : ''}`}>
                                                                    <button 
                                                                        onClick={() => handleDraftChange(bill.employee.id, item.itemId, -1, item.totalQty)}
                                                                        className="w-5 h-5 flex items-center justify-center bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 text-gray-600"
                                                                        disabled={displayVal <= 0}
                                                                    >
                                                                        <Minus className="w-3 h-3" />
                                                                    </button>
                                                                    <span className={`w-4 text-center font-bold ${isModified ? 'text-blue-600' : (isAdjusted ? 'text-green-700' : 'text-gray-700')}`}>{displayVal}</span>
                                                                    <button 
                                                                        onClick={() => handleDraftChange(bill.employee.id, item.itemId, 1, item.totalQty)}
                                                                        className="w-5 h-5 flex items-center justify-center bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 text-gray-600"
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