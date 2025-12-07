import React, { useState, useEffect } from 'react';
import { StorageService, DailyAdjustmentMap } from '../services/storageService';
import { BillingService, DailyCompanyBill, EmployeeBill } from '../services/billingService';
import { Consumption, Employee } from '../types';
import { Receipt, Calendar, Printer, Cookie, Loader2, ChevronDown, ChevronRight, Send, Settings, Smartphone, Share2 } from 'lucide-react';

const getLocalYMD = (isoStr: string) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const offset = d.getTimezoneOffset() * 60000;
    const local = new Date(d.getTime() - offset);
    return local.toISOString().split('T')[0];
};

export const BillGenerator: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [consumptions, setConsumptions] = useState<Consumption[]>([]);
  const [activeEmployeeCount, setActiveEmployeeCount] = useState<number>(10);
  
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  const [companyBill, setCompanyBill] = useState<DailyCompanyBill[]>([]);
  const [employeeBills, setEmployeeBills] = useState<EmployeeBill[]>([]);
  const [grandTotalCompany, setGrandTotalCompany] = useState(0);

  const [dailyAdjustments, setDailyAdjustments] = useState<DailyAdjustmentMap>({});
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Payment Configuration
  const [upiId, setUpiId] = useState<string>('');
  const [showUpiInput, setShowUpiInput] = useState(false);

  useEffect(() => {
    const curr = new Date(); 
    const day = curr.getDay() || 7; 
    if (day !== 1) curr.setHours(-24 * (day - 1)); 
    const firstDate = new Date(curr);
    const lastDate = new Date(curr);
    lastDate.setDate(lastDate.getDate() + 6); 

    setStartDate(getLocalYMD(firstDate.toISOString()));
    setEndDate(getLocalYMD(lastDate.toISOString()));

    // Load UPI ID from local storage
    const savedUpi = localStorage.getItem('ts_upi_id');
    if (savedUpi) setUpiId(savedUpi);

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
    setDailyAdjustments(StorageService.getDailyAdjustments());
  };

  useEffect(() => {
      generateBill();
  }, [startDate, endDate, consumptions, employees, dailyAdjustments]);

  const generateBill = () => {
      if (!startDate || !endDate) return;
      const filteredConsumptions = consumptions.filter(c => {
          const cDate = getLocalYMD(c.date);
          return cDate >= startDate && cDate <= endDate;
      });

      const result = BillingService.calculateBilling(
          filteredConsumptions,
          employees,
          activeEmployeeCount,
          dailyAdjustments
      );

      setCompanyBill(result.companyBillRows);
      setEmployeeBills(result.employeeBills);
      setGrandTotalCompany(result.grandTotalCompanyAmount);
  };

  const handlePrint = () => {
      window.print();
  };

  const toggleRow = (id: string) => {
      if (expandedRow === id) setExpandedRow(null);
      else setExpandedRow(id);
  };

  const saveUpiId = (val: string) => {
      setUpiId(val);
      localStorage.setItem('ts_upi_id', val);
  };

  // Helper to aggregate item list for display
  const getAggregatedItems = (items: Consumption[]) => {
      const counts: Record<string, {count: number, total: number}> = {};
      items.forEach(i => {
          if (!counts[i.itemName]) counts[i.itemName] = { count: 0, total: 0 };
          counts[i.itemName].count = (counts[i.itemName].count || 0) + 1;
          counts[i.itemName].total = (counts[i.itemName].total || 0) + i.price;
      });
      return Object.entries(counts).map(([name, data]) => ({ name, ...data }));
  };

  // Helper for Company Bill - Normalize Names based on Price
  const getCompanyAggregatedItems = (items: Consumption[]) => {
      const counts: Record<string, {count: number, total: number}> = {};
      items.forEach(i => {
          let displayName = i.itemName;
          if (i.price === 10 && i.itemId != "i1") displayName = "FN-Tea";
          else if (i.price === 8) displayName = "AN-Tea";

          if (!counts[displayName]) counts[displayName] = { count: 0, total: 0 };
          counts[displayName].count = (counts[displayName].count || 0) + 1;
          counts[displayName].total = (counts[displayName].total || 0) + i.price;
      });
      return Object.entries(counts).map(([name, data]) => ({ name, ...data }));
  };

  const handleSendTelegram = (bill: EmployeeBill) => {
      if (!upiId) {
          alert("Payment configuration missing! Please enter your UPI ID in the settings to generate payment requests.");
          setShowUpiInput(true);
          return;
      }

      const itemsList = getAggregatedItems(bill.payableItems)
          .map(i => `${i.name} x${i.count} = ₹${i.total}`)
          .join('%0A'); 

      // Using the hosted app URL as context for the share action so Telegram treats it as a shareable link
      const shareUrl = "Bill Generated via Teadesk App";

      // Message text DOES NOT contain the URL, only the UPI ID
      const messageText = `%0A%0AHello ${bill.employee.name},%0A%0AHere is your snack bill for ${startDate} to ${endDate}:%0A%0A${itemsList}%0A%0A**Total: ₹${bill.finalPayableAmount}**%0A%0APlease pay to UPI ID:%0A\`${upiId}\``;

      window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${messageText}`, '_blank');
  };

  const handleSendGroupSummary = () => {
      if (!upiId) {
          alert("Payment configuration missing! Please enter your UPI ID in the settings to generate payment requests.");
          setShowUpiInput(true);
          return;
      }

      const activeBills = employeeBills.filter(b => b.finalPayableAmount > 0);
      if (activeBills.length === 0) {
          alert("No pending bills to send.");
          return;
      }

      const summaryLines = activeBills.map(b => {
          return `${b.employee.name}: ₹${b.finalPayableAmount}`;
      }).join('%0A');

      const totalAmount = activeBills.reduce((sum, b) => sum + b.finalPayableAmount, 0);
      const shareUrl = "Bill Generated via Teadesk App";

      const messageText = `%0A%0A📢 **Snack Bill Summary** (${startDate} to ${endDate})%0A%0A${summaryLines}%0A%0A**Total Collected: ₹${totalAmount}**%0A%0APlease pay to UPI ID:%0A\`${upiId}\``;

      window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${messageText}`, '_blank');
  };

  const totalEmployeeAmount = employeeBills.reduce((sum, row) => sum + (row.finalPayableAmount || 0), 0);
  
  // Use actualDrinkCount 
  const totalDrinksCount = companyBill.reduce((a,b) => a + (b.actualDrinkCount || 0) + (b.manualAddedCount || 0), 0);

  if (loading) {
      return <div className="flex h-64 justify-center items-center"><Loader2 className="w-8 h-8 animate-spin text-tea-600"/></div>;
  }

  return (
    <div className="space-y-8 print:p-0 max-w-4xl mx-auto">
      {/* Header (No Print) */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 print:hidden">
            <div>
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <Receipt className="w-6 h-6 text-tea-600" />
                    Generate Bill
                </h2>
                <p className="text-sm text-gray-500 mt-1">Final calculated bills</p>
            </div>
            
            <div className="flex flex-col items-end gap-3">
                <div className="flex gap-4 items-center">
                    <div className="flex gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-200">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <input 
                            type="date" 
                            value={startDate} 
                            onChange={e => setStartDate(e.target.value)}
                            className="bg-transparent border-none text-sm outline-none text-gray-700 font-medium"
                        />
                        <span className="text-gray-400">-</span>
                        <input 
                            type="date" 
                            value={endDate} 
                            onChange={e => setEndDate(e.target.value)}
                            className="bg-transparent border-none text-sm outline-none text-gray-700 font-medium"
                        />
                    </div>
                    <button 
                        onClick={handlePrint}
                        className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
                    >
                        <Printer className="w-4 h-4" /> Print
                    </button>
                </div>

                {/* UPI Settings Toggle */}
                <div className="flex items-center gap-2 text-sm">
                    <button 
                        onClick={() => setShowUpiInput(!showUpiInput)}
                        className="text-tea-600 hover:text-tea-800 flex items-center gap-1 font-medium"
                    >
                        <Settings className="w-3 h-3" /> {showUpiInput ? 'Hide Payment Settings' : 'Configure Payment'}
                    </button>
                </div>
                
                {/* UPI Input Field */}
                {showUpiInput && (
                    <div className="flex items-center gap-2 bg-blue-50 p-2 rounded border border-blue-100 animate-fade-in">
                        <Smartphone className="w-4 h-4 text-blue-600" />
                        <input 
                            type="text" 
                            placeholder="Enter UPI ID (e.g. name@oksbi)"
                            value={upiId}
                            onChange={(e) => saveUpiId(e.target.value)}
                            className="bg-transparent border-b border-blue-300 outline-none text-sm w-48 text-blue-900 placeholder-blue-300"
                        />
                    </div>
                )}
            </div>
      </div>

      <div className="flex flex-col gap-12 print:gap-12">
          
          {/* Company Bill Section */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden print:border-black break-inside-avoid">
              <div className="bg-tea-600 text-white p-4 flex justify-between items-center print:bg-gray-100 print:text-black print:border-b print:border-black">
                  <div>
                    <h3 className="font-bold text-lg">Company Drinks Bill</h3>
                    <p className="text-xs opacity-80 font-normal mt-0.5 print:text-black">
                        Period: {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-sm opacity-90 font-medium border border-white/30 px-2 py-1 rounded print:border-black/30">Official Expense</span>
              </div>
              
              <table className="w-full text-left border-collapse text-sm">
                  <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
                          <th className="p-3 w-8"></th>
                          <th className="p-3 font-semibold">Date</th>
                          <th className="p-3 font-semibold text-center">Items (Drinks + Extras)</th>
                          <th className="p-3 font-semibold text-right">Amount (₹)</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                      {companyBill.length === 0 ? (
                          <tr><td colSpan={4} className="p-6 text-center text-gray-400">No data available.</td></tr>
                      ) : (
                          companyBill.map((row) => (
                              <React.Fragment key={row.date}>
                                <tr 
                                    className="hover:bg-gray-50 transition-colors cursor-pointer group"
                                    onClick={() => toggleRow(row.date)}
                                >
                                    <td className="p-3 text-center text-gray-400 group-hover:text-tea-600">
                                        {expandedRow === row.date ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                    </td>
                                    <td className="p-3 text-gray-800 font-medium">
                                        {new Date(row.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' })}
                                    </td>
                                    <td className="p-3 text-center text-gray-600">
                                        {row.items.length} 
                                    </td>
                                    <td className="p-3 text-right font-mono font-medium text-gray-700">
                                        {row.totalDailyCost}
                                    </td>
                                </tr>
                                {expandedRow === row.date && (
                                    <tr className="bg-gray-50 animate-fade-in print:bg-white">
                                        <td colSpan={4} className="p-3 pl-12">
                                            <div className="text-xs text-gray-500 mb-1 font-semibold uppercase">Item Breakdown</div>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                {getCompanyAggregatedItems(row.items).map((item, i) => (
                                                    <div key={i} className="flex justify-between bg-white border border-gray-200 p-2 rounded shadow-sm">
                                                        <span>{item.name} <span className="text-gray-400">x{item.count}</span></span>
                                                        <span className="font-mono text-gray-700">₹{item.total}</span>
                                                    </div>
                                                ))}
                                                {row.items.length === 0 && <span className="text-gray-400 italic">No items.</span>}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                              </React.Fragment>
                          ))
                      )}
                  </tbody>
                  <tfoot>
                      <tr className="bg-gray-100 font-bold border-t border-gray-300">
                          <td className="p-3" colSpan={2}>Total</td>
                          <td className="p-3 text-center text-gray-800">
                              {totalDrinksCount}
                          </td>
                          <td className="p-3 text-right text-lg text-tea-700">₹{grandTotalCompany}</td>
                      </tr>
                  </tfoot>
              </table>
          </section>

          {/* Employee Snack Bill Section */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden print:border-black break-inside-avoid">
              <div className="bg-orange-600 text-white p-4 flex justify-between items-center print:bg-gray-100 print:text-black print:border-b print:border-black">
                  <h3 className="font-bold text-lg">Employee Snack Bill</h3>
                  <div className="flex items-center gap-2">
                      <button 
                          onClick={handleSendGroupSummary}
                          className="flex items-center gap-1 text-xs bg-white/20 hover:bg-white/30 text-white px-2 py-1 rounded transition-colors print:hidden"
                          title="Share summary to Telegram Group"
                      >
                          <Share2 className="w-3 h-3" /> Group Summary
                      </button>
                      <span className="text-sm opacity-90 font-medium border border-white/30 px-2 py-1 rounded print:border-black/30">Personal Expense</span>
                  </div>
              </div>

              <table className="w-full text-left border-collapse text-sm">
                  <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
                          <th className="p-3 w-8"></th>
                          <th className="p-3 font-semibold">Employee</th>
                          <th className="p-3 font-semibold text-center">Snack Count</th>
                          <th className="p-3 font-semibold text-right">Amount (₹)</th>
                          <th className="p-3 font-semibold text-center w-16 print:hidden">Request</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                      {employeeBills.length === 0 ? (
                           <tr><td colSpan={5} className="p-6 text-center text-gray-400">No data available.</td></tr>
                      ) : (
                          employeeBills.map((bill) => (
                              <React.Fragment key={bill.employee.id}>
                                <tr 
                                    className="hover:bg-gray-50 transition-colors cursor-pointer group"
                                    onClick={() => toggleRow(bill.employee.id)}
                                >
                                    <td className="p-3 text-center text-gray-400 group-hover:text-orange-600">
                                        {expandedRow === bill.employee.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                    </td>
                                    <td className="p-3 text-gray-800 font-medium">
                                        {bill.employee.name}
                                    </td>
                                    <td className="p-3 text-center text-gray-600">
                                        {bill.payableItems.length}
                                        {bill.finalDeductedCount > 0 && (
                                            <span className="ml-1 text-[10px] text-gray-400 print:hidden" title={`${bill.finalDeductedCount} items covered by company`}>
                                                (-{bill.finalDeductedCount})
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-3 text-right font-mono font-medium text-gray-700">
                                        {bill.finalPayableAmount}
                                    </td>
                                    <td className="p-3 text-center print:hidden">
                                        {bill.finalPayableAmount > 0 && (
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSendTelegram(bill);
                                                }}
                                                className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-1.5 rounded-full transition-colors"
                                                title="Request Payment via Telegram"
                                            >
                                                <Send className="w-4 h-4" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                                {expandedRow === bill.employee.id && (
                                    <tr className="bg-gray-50 animate-fade-in print:bg-white">
                                        <td colSpan={5} className="p-3 pl-12">
                                            <div className="text-xs text-gray-500 mb-1 font-semibold uppercase">Payable Items</div>
                                            <div className="flex flex-wrap gap-2">
                                                {getAggregatedItems(bill.payableItems).map((item, i) => (
                                                    <div key={i} className="flex gap-2 items-center bg-white border border-gray-200 px-2 py-1 rounded shadow-sm text-xs">
                                                        <span className="text-gray-800 font-medium">{item.name} <span className="text-gray-400">x{item.count}</span></span>
                                                        <span className="font-mono text-orange-600">₹{item.total}</span>
                                                    </div>
                                                ))}
                                                {bill.payableItems.length === 0 && <span className="text-xs text-gray-400 italic">All items covered or none consumed.</span>}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                              </React.Fragment>
                          ))
                      )}
                  </tbody>
                  <tfoot>
                      <tr className="bg-gray-50 font-bold border-t border-gray-200">
                          <td className="p-3" colSpan={2}>Total</td>
                          <td className="p-3 text-center text-gray-800">{employeeBills.reduce((a,b) => a + b.payableItems.length, 0)}</td>
                          <td className="p-3 text-right text-lg text-tea-700">₹{totalEmployeeAmount}</td>
                          <td className="print:hidden"></td>
                      </tr>
                  </tfoot>
              </table>
          </section>
      </div>
      
      <div className="text-center text-xs text-gray-400 mt-12 print:block hidden">
          <p>Generated on {new Date().toLocaleString()} | TeaSnack Tracker App</p>
      </div>
    </div>
  );
};