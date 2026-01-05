import React, { useState, useEffect, useMemo } from 'react';
import { StorageService } from '../services/storageService';
import { Employee, Item, Consumption } from '../types';
import { Plus, Trash2, Coffee, User, Cookie, X, Loader2, Pencil, Save, Check, Sun, Moon, LayoutList, CalendarClock, History } from 'lucide-react';

interface SnackSlot {
  key: string; 
  itemId: string;
  price: number;
  quantity: number;
}

// Helper: Get Local Date String YYYY-MM-DD
const getLocalYMD = (val: string | Date) => {
    if (!val) return '';
    if (typeof val === 'string') return val.split('T')[0];
    return val.getFullYear() + '-' + String(val.getMonth() + 1).padStart(2, '0') + '-' + String(val.getDate()).padStart(2, '0');
};

// Helper: Get current datetime in local format for input value (YYYY-MM-DDTHH:mm)
const getLocalDateTimeString = (date = new Date()) => {
    const offset = date.getTimezoneOffset() * 60000;
    const local = new Date(date.getTime() - offset);
    return local.toISOString().slice(0, 16);
};

export const DailyEntry: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null); 
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [recentLog, setRecentLog] = useState<Consumption[]>([]);

  // Edit State
  const [editingLogIds, setEditingLogIds] = useState<string[] | null>(null);

  // Form State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [selectedDrinkId, setSelectedDrinkId] = useState<string>('');
  const [drinkPrice, setDrinkPrice] = useState<number>(0);
  const [snackSlots, setSnackSlots] = useState<SnackSlot[]>([
    { key: 'init', itemId: '', price: 0, quantity: 1 }
  ]);

  // Missed Entry State
  const [isManualTime, setIsManualTime] = useState(false);
  const [manualTimestamp, setManualTimestamp] = useState(getLocalDateTimeString());

  // Activity Feed Filter
  const [activityTab, setActivityTab] = useState<'all' | 'am' | 'pm'>('all');

  useEffect(() => {
    initData();
  }, []);

  const initData = async () => {
    setLoading(true);
    await StorageService.init(); 
    loadLocalData();
    setLoading(false);
  };

  const loadLocalData = () => {
    setEmployees(StorageService.getEmployees().filter(e => e.isActive));
    setItems(StorageService.getItems().filter(i => i.isActive));
    refreshLogs();
  };

  const refreshLogs = () => {
    const todayLocal = getLocalYMD(new Date());
    const allLogs = StorageService.getConsumptions();
    const todaysLogs = allLogs.filter(log => getLocalYMD(log.date) === todayLocal);
    setRecentLog(todaysLogs);
  };

  const groupedLogs = useMemo(() => {
      const groups: Record<string, Consumption[]> = {};
      recentLog.forEach(log => {
          const key = `${log.date}_${log.employeeId}`;
          if (!groups[key]) groups[key] = [];
          groups[key].push(log);
      });
      // Corrected: Use localeCompare for string comparison as strings do not have a .compare method
      return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [recentLog]);

  const displayedLogs = useMemo(() => {
      if (activityTab === 'all') return groupedLogs;
      
      return groupedLogs.filter(([, logs]) => {
          if (logs.length === 0) return false;
          const date = new Date(logs[0].date);
          const hour = date.getHours();
          if (activityTab === 'am') return hour < 13;
          if (activityTab === 'pm') return hour >= 13;
          return true;
      });
  }, [groupedLogs, activityTab]);

  const drinkItems = items.filter(i => i.type === 'drink');
  const snackItems = items.filter(i => i.type === 'snack');

  const handleDrinkChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedDrinkId(id);
    const item = items.find(i => i.id === id);
    setDrinkPrice(item ? item.price : 0);
  };

  const handleSnackChange = (index: number, e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    const newSlots = [...snackSlots];
    newSlots[index].itemId = id;
    const item = items.find(i => i.id === id);
    newSlots[index].price = item ? item.price : 0;
    setSnackSlots(newSlots);
  };

  const handleSnackPriceChange = (index: number, val: number) => {
    const newSlots = [...snackSlots];
    newSlots[index].price = val;
    setSnackSlots(newSlots);
  };

  const handleSnackQuantityChange = (index: number, val: number) => {
    const newSlots = [...snackSlots];
    newSlots[index].quantity = Math.max(1, val);
    setSnackSlots(newSlots);
  };

  const addSnackSlot = () => {
    setSnackSlots([...snackSlots, { key: crypto.randomUUID(), itemId: '', price: 0, quantity: 1 }]);
  };

  const removeSnackSlot = (index: number) => {
    const newSlots = [...snackSlots];
    newSlots.splice(index, 1);
    setSnackSlots(newSlots);
  };

  const resetForm = () => {
      setSelectedEmployeeId('');
      setSelectedDrinkId('');
      setDrinkPrice(0);
      setSnackSlots([{ key: crypto.randomUUID(), itemId: '', price: 0, quantity: 1 }]);
      setEditingLogIds(null);
      setIsManualTime(false);
      setManualTimestamp(getLocalDateTimeString());
  };

  const handleEditGroup = (logs: Consumption[]) => {
      if (logs.length === 0) return;
      const first = logs[0];
      setSelectedEmployeeId(first.employeeId);
      
      const drinkLog = logs.find(l => l.itemType === 'drink');
      if (drinkLog) {
          setSelectedDrinkId(drinkLog.itemId);
          setDrinkPrice(drinkLog.price);
      } else {
          setSelectedDrinkId('');
          setDrinkPrice(0);
      }

      const snackLogs = logs.filter(l => l.itemType === 'snack');
      if (snackLogs.length > 0) {
          const slots: SnackSlot[] = snackLogs.map(s => ({
              key: crypto.randomUUID(),
              itemId: s.itemId,
              price: s.price,
              quantity: s.quantity || 1
          }));
          setSnackSlots(slots);
      } else {
          setSnackSlots([{ key: crypto.randomUUID(), itemId: '', price: 0, quantity: 1 }]);
      }

      setEditingLogIds(logs.map(l => l.id));
      setIsManualTime(true);
      setManualTimestamp(getLocalDateTimeString(new Date(first.date)));
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId) { alert("Please select an employee."); return; }
    const employee = employees.find(e => e.id === selectedEmployeeId);
    if (!employee) return;

    if (submitting) return;
    setSubmitting(true);

    try {
        if (editingLogIds && editingLogIds.length > 0) {
            await StorageService.removeConsumptionBatch(editingLogIds);
        }

        const newEntries: Consumption[] = [];
        
        let finalTimestamp: string;
        if (isManualTime) {
            // Use the manually selected timestamp
            finalTimestamp = new Date(manualTimestamp).toISOString().slice(0, -1);
        } else {
            // Use current system time
            const now = new Date();
            const offset = now.getTimezoneOffset() * 60000;
            finalTimestamp = new Date(now.getTime() - offset).toISOString().slice(0, -1);
        }

        const allLogs = StorageService.getConsumptions();
        let currentMaxId = allLogs.reduce((max, log) => {
            if (log.id.startsWith('c')) {
                const num = parseInt(log.id.substring(1), 10);
                return !isNaN(num) && num > max ? num : max;
            }
            return max;
        }, 0);

        const createEntry = (itemId: string, price: number, qty: number, type: 'drink' | 'snack'): Consumption => {
            currentMaxId += 1;
            const item = items.find(i => i.id === itemId);
            return {
                id: `c${currentMaxId}`,
                employeeId: employee.id,
                itemId: itemId,
                itemName: item ? item.name : 'Unknown',
                itemType: type,
                price: price,
                date: finalTimestamp,
                quantity: qty 
            };
        };

        if (selectedDrinkId) {
            newEntries.push(createEntry(selectedDrinkId, drinkPrice, 1, 'drink'));
        }
        
        for (const slot of snackSlots) {
            if (slot.itemId && slot.quantity > 0) {
                newEntries.push(createEntry(slot.itemId, slot.price, slot.quantity, 'snack'));
            }
        }

        if (newEntries.length === 0 && !editingLogIds) { 
            alert("Please select at least one item."); 
            setSubmitting(false);
            return; 
        }

        if (newEntries.length > 0) {
            await StorageService.addConsumptionBatch(newEntries);
        }

        refreshLogs();
        resetForm();
    } finally {
        setSubmitting(false);
    }
  };

  const requestDelete = (groupKey: string) => {
      setPendingDeleteId(groupKey);
  };

  const cancelDelete = () => {
      setPendingDeleteId(null);
  };

  const confirmDelete = async (logs: Consumption[], groupKey: string) => {
    if (deletingId) return;
    setDeletingId(groupKey);
    setPendingDeleteId(null);
    try {
        const idsToDelete = logs.map(l => l.id);
        await StorageService.removeConsumptionBatch(idsToDelete);
        refreshLogs();
    } catch (error) {
        console.error("Delete failed", error);
    } finally {
        setDeletingId(null);
    }
  };

  const getAggregatedLogs = (logs: Consumption[]) => {
      const agg: Record<string, { count: number, name: string, type: string, totalCost: number }> = {};
      logs.forEach(log => {
          const qty = log.quantity || 1;
          if (!agg[log.itemId]) agg[log.itemId] = { count: 0, name: log.itemName, type: log.itemType, totalCost: 0 };
          agg[log.itemId].count += qty;
          agg[log.itemId].totalCost += (log.price * qty);
      });
      return Object.values(agg);
  };

  if (loading) {
      return <div className="flex h-64 justify-center items-center"><Loader2 className="w-8 h-8 animate-spin text-tea-600"/></div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Entry Form */}
      <div className={`lg:col-span-6 p-6 rounded-xl shadow-sm border transition-all duration-300 ${isManualTime ? 'bg-orange-50/30 border-orange-200 ring-1 ring-orange-100' : 'bg-white border-gray-100'}`}>
        <div className="flex justify-between items-start mb-6">
            <div>
                <h2 className="text-xl font-semibold flex items-center gap-2 text-tea-900">
                    <Coffee className="w-5 h-5" />
                    {editingLogIds ? 'Edit Entry' : 'New Daily Entry'}
                </h2>
                {isManualTime && !editingLogIds && (
                    <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider mt-1 inline-block">
                        Missed Entry Mode
                    </span>
                )}
            </div>
            {!editingLogIds && (
                <button
                    type="button"
                    onClick={() => setIsManualTime(!isManualTime)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isManualTime ? 'bg-orange-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                    {isManualTime ? <X className="w-3.5 h-3.5" /> : <History className="w-3.5 h-3.5" />}
                    {isManualTime ? 'Cancel Missed Entry' : 'Add Missed Entry'}
                </button>
            )}
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Missed Entry Time Picker */}
          {isManualTime && (
              <div className="bg-white p-4 rounded-lg border border-orange-200 shadow-sm animate-fade-in">
                  <label className="block text-sm font-bold text-orange-800 mb-2 flex items-center gap-2">
                      <CalendarClock className="w-4 h-4" /> Entry Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full p-3 bg-orange-50/50 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-400 outline-none font-medium text-gray-800"
                    value={manualTimestamp}
                    onChange={(e) => setManualTimestamp(e.target.value)}
                    required
                  />
                  <p className="text-[10px] text-orange-500 mt-2 font-medium">Selecting a past date will record items for that specific session.</p>
              </div>
          )}

          <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
            <label className="block text-sm font-bold text-gray-700 mb-2">Select Employee</label>
            <div className="relative">
              <select
                className="w-full p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-tea-500 outline-none appearance-none font-medium"
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                disabled={!!editingLogIds} 
              >
                <option value="">-- Choose Employee --</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
              <User className="absolute right-3 top-3.5 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-blue-800">
                    <Coffee className="w-4 h-4" /> Drink
                </label>
                <div className="flex gap-2">
                    <select
                        className="flex-1 p-2 bg-blue-50 border border-blue-100 rounded focus:ring-2 focus:ring-blue-200 outline-none text-sm"
                        value={selectedDrinkId}
                        onChange={handleDrinkChange}
                    >
                        <option value="">None</option>
                        {drinkItems.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                    <input
                        type="number"
                        className="w-24 p-2 bg-blue-50 border border-blue-100 rounded focus:ring-2 focus:ring-blue-200 outline-none text-sm text-center font-medium"
                        value={drinkPrice}
                        onChange={(e) => setDrinkPrice(Number(e.target.value))}
                        min="0"
                        placeholder="Price"
                    />
                </div>
            </div>

            <div className="space-y-3">
                <div className="flex justify-between items-center">
                    <label className="flex items-center gap-2 text-sm font-semibold text-orange-800">
                        <Cookie className="w-4 h-4" /> Snacks
                    </label>
                </div>
                {snackSlots.map((slot, index) => (
                    <div key={slot.key} className="flex gap-2 items-center animate-fade-in">
                        <select
                            className="flex-1 p-2 bg-orange-50 border border-orange-100 rounded focus:ring-2 focus:ring-orange-200 outline-none text-sm"
                            value={slot.itemId}
                            onChange={(e) => handleSnackChange(index, e)}
                        >
                            <option value="">{index === 0 ? "Select Snack" : "Additional Snack"}</option>
                            {snackItems.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                        </select>
                        <div className="flex items-center bg-orange-50 border border-orange-100 rounded px-2">
                            <span className="text-xs text-orange-400 font-bold mr-1">Qty</span>
                            <input
                                type="number"
                                className="w-10 p-2 bg-transparent outline-none text-sm text-center font-medium"
                                value={slot.quantity}
                                onChange={(e) => handleSnackQuantityChange(index, Number(e.target.value))}
                                min="1"
                            />
                        </div>
                        <input
                            type="number"
                            className="w-20 p-2 bg-orange-50 border border-orange-100 rounded focus:ring-2 focus:ring-orange-200 outline-none text-sm text-center font-medium"
                            value={slot.price}
                            onChange={(e) => handleSnackPriceChange(index, Number(e.target.value))}
                            min="0"
                            placeholder="Price"
                        />
                        {index > 0 && (
                            <button
                                type="button"
                                onClick={() => removeSnackSlot(index)}
                                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                ))}
                <button
                    type="button"
                    onClick={addSnackSlot}
                    className="text-xs flex items-center gap-1 text-tea-600 hover:text-tea-700 font-semibold mt-2 px-2 py-1 rounded hover:bg-tea-50 transition-colors w-fit"
                >
                    <Plus className="w-3 h-3" /> Add Another Snack
                </button>
            </div>
          </div>

          <div className="flex gap-3">
            {(editingLogIds || isManualTime) && (
                <button
                    type="button"
                    onClick={resetForm}
                    disabled={submitting}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-4 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                    <X className="w-5 h-5" /> Cancel
                </button>
            )}
            <button
                type="submit"
                disabled={submitting}
                className={`flex-1 font-bold py-4 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-md hover:shadow-lg transform active:scale-95 duration-150 text-white ${editingLogIds ? 'bg-blue-600 hover:bg-blue-700' : 'bg-tea-600 hover:bg-tea-500'}`}
            >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (editingLogIds ? <Save className="w-5 h-5" /> : (isManualTime ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />))}
                {editingLogIds ? 'Update Entry' : (isManualTime ? 'Add Missed Log' : 'Add to Log')}
            </button>
          </div>
        </form>
      </div>

      {/* Today's Activity Feed */}
      <div className="lg:col-span-6 bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-[600px]">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 border-b border-gray-100 pb-3 gap-3">
            <h2 className="text-xl font-semibold text-tea-900">Today's Activity</h2>
            
            <div className="flex bg-gray-100 p-1 rounded-lg">
                <button
                    onClick={() => setActivityTab('all')}
                    className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-bold transition-all ${activityTab === 'all' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    title="All Logs"
                >
                    <LayoutList className="w-3 h-3" /> All
                </button>
                <button
                    onClick={() => setActivityTab('am')}
                    className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-bold transition-all ${activityTab === 'am' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    title="Before 1 PM"
                >
                    <Sun className="w-3 h-3" /> AM
                </button>
                <button
                    onClick={() => setActivityTab('pm')}
                    className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-bold transition-all ${activityTab === 'pm' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    title="1 PM onwards"
                >
                    <Moon className="w-3 h-3" /> PM
                </button>
            </div>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
          {displayedLogs.length === 0 ? (
            <div className="text-center text-gray-400 mt-20 flex flex-col items-center gap-3">
                <Coffee className="w-10 h-10 opacity-20" />
                <p>No {activityTab !== 'all' ? `${activityTab.toUpperCase()} ` : ''}entries found for today.</p>
            </div>
          ) : (
            displayedLogs.map(([key, logs]) => {
                const firstLog = logs[0];
                const empName = employees.find(e => e.id === firstLog.employeeId)?.name || 'Unknown';
                const time = new Date(firstLog.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const totalCost = logs.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
                const aggregatedItems = getAggregatedLogs(logs);
                const isEditingThis = editingLogIds && editingLogIds.length === logs.length && editingLogIds[0] === logs[0].id;
                const isDeletingThis = deletingId === key;
                const isPendingDelete = pendingDeleteId === key;

                return (
                    <div key={key} className={`border rounded-lg p-4 transition-all ${isEditingThis ? 'border-blue-300 bg-blue-50 ring-1 ring-blue-300' : 'border-gray-100 hover:shadow-sm bg-gray-50/50'} ${isDeletingThis ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h3 className="font-bold text-gray-800">{empName}</h3>
                                <span className="text-xs text-gray-400 font-mono">{time}</span>
                            </div>
                            <div className="text-right">
                                <span className="block font-bold text-tea-700 text-lg">₹{totalCost}</span>
                            </div>
                        </div>
                        
                        <div className="space-y-1.5 mb-3">
                            {aggregatedItems.map((item, idx) => (
                                <div key={idx} className="flex justify-between text-sm items-center">
                                    <div className="flex items-center gap-2">
                                        <span className={`w-1.5 h-1.5 rounded-full ${item.type === 'drink' ? 'bg-blue-400' : 'bg-orange-400'}`}></span>
                                        <span className="text-gray-600">
                                            {item.name} {item.count > 1 ? <span className="text-xs font-bold text-gray-500">x{item.count}</span> : ''}
                                        </span>
                                    </div>
                                    <span className="text-gray-500 font-medium">₹{item.totalCost}</span>
                                </div>
                            ))}
                        </div>

                        <div className="pt-2 border-t border-gray-200 flex justify-end gap-2">
                            {isPendingDelete ? (
                                <div className="flex items-center gap-2 animate-fade-in">
                                    <span className="text-xs text-red-600 font-semibold mr-1">Confirm delete?</span>
                                    <button 
                                        onClick={() => confirmDelete(logs, key)}
                                        className="text-xs bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition-colors shadow-sm"
                                    >
                                        Yes
                                    </button>
                                    <button 
                                        onClick={cancelDelete}
                                        className="text-xs bg-white border border-gray-300 text-gray-600 px-3 py-1 rounded hover:bg-gray-50 transition-colors shadow-sm"
                                    >
                                        No
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <button 
                                        onClick={() => handleEditGroup(logs)}
                                        disabled={!!editingLogIds || !!deletingId}
                                        className={`text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors ${!!editingLogIds ? 'text-gray-300' : 'text-blue-500 hover:text-blue-700 hover:bg-blue-50'}`}
                                    >
                                        <Pencil className="w-3 h-3" /> Edit
                                    </button>
                                    <button 
                                        onClick={() => requestDelete(key)}
                                        disabled={!!editingLogIds || !!deletingId}
                                        className={`text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors min-w-[70px] justify-center ${!!editingLogIds ? 'text-gray-300' : 'text-red-500 hover:text-red-700 hover:bg-red-50'}`}
                                    >
                                        {isDeletingThis ? (
                                            <div className="flex items-center gap-1">
                                                <Loader2 className="w-3 h-3 animate-spin" /> Deleting
                                            </div>
                                        ) : (
                                            <><Trash2 className="w-3 h-3" /> Delete</>
                                        )}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                );
            })
          )}
        </div>
      </div>
    </div>
  );
};