import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storageService';
import { BillingService, DailyCompanyBill, EmployeeBill } from '../services/billingService';
import { Consumption, Employee } from '../types';
import { Receipt, Calendar, Printer, Cookie, Loader2 } from 'lucide-react';

// Helper: Convert ISO string to Local YYYY-MM-DD
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
  const [totalManualTransfer, setTotalManualTransfer] = useState(0);

  // Use Daily Adjustments now
  const [dailyAdjustments, setDailyAdjustments] = useState<Record<string, Record<string, number>>>({});

  useEffect(() => {
    // Correctly calculate start (Monday) and end (Sunday) of current week
    const curr = new Date(); 
    const day = curr.getDay() || 7; 
    if (day !== 1) {
        curr.setHours(-24 * (day - 1)); 
    }
    const firstDate = new Date(curr);
    const lastDate = new Date(curr);
    lastDate.setDate(lastDate.getDate() + 6); 

    // Use Local Date Strings
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
    setDailyAdjustments(StorageService.getDailyAdjustments());
  };

  useEffect(() => {
      generateBill();
  }, [startDate, endDate, consumptions, employees, dailyAdjustments]);

  const generateBill = () => {
      if (!startDate || !endDate) return;
      
      const filteredConsumptions = consumptions.filter(c => {
          const cDate = getLocalYMD(c.date); // Use local date check
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
      setTotalManualTransfer(result.totalManualTransferAmount);
  };

  const handlePrint = () => {
      window.print();
  };

  const totalEmployeeAmount = employeeBills.reduce((sum, row) => sum + (row.finalPayableAmount || 0), 0);

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
                <p className="text-sm text-gray-500 mt-1">Final calculated bills with tally adjustments applied</p>
            </div>
            
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
                          <th className="p-3 font-semibold">Date</th>
                          <th className="p-3 font-semibold text-center">Drinks</th>
                          <th className="p-3 font-semibold text-right">Amount (₹)</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                      {companyBill.length === 0 ? (
                          <tr><td colSpan={3} className="p-6 text-center text-gray-400">No data available.</td></tr>
                      ) : (
                          companyBill.map((row, idx) => (
                              <tr key={idx}>
                                  <td className="p-3 text-gray-800 font-medium">
                                      {new Date(row.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' })}
                                  </td>
                                  <td className="p-3 text-center text-gray-600">
                                      {row.adjustedCount}
                                  </td>
                                  <td className="p-3 text-right font-mono font-medium text-gray-700">
                                      {row.amount}
                                  </td>
                              </tr>
                          ))
                      )}
                  </tbody>
                  <tfoot>
                       {totalManualTransfer !== 0 && (
                            <tr className="bg-gray-50 text-gray-800 border-t border-gray-200">
                                <td className="p-3" colSpan={2}>
                                    <span className="flex items-center gap-1 text-xs font-semibold">
                                        <Cookie className="w-3 h-3" />
                                        Manual Adjustments
                                    </span>
                                </td>
                                <td className="p-3 text-right font-mono text-gray-700">
                                    {totalManualTransfer > 0 ? `+${totalManualTransfer}` : `-${Math.abs(totalManualTransfer)}`}
                                </td>
                            </tr>
                        )}
                      <tr className="bg-gray-100 font-bold border-t border-gray-300">
                          <td className="p-3 text-gray-800">Total</td>
                          <td className="p-3 text-center text-gray-800">
                              {/* Count is not perfectly additive if adjustments are value based, but we can try */}
                              {companyBill.reduce((a,b) => a + (b.adjustedCount || 0), 0)}
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
                  <span className="text-sm opacity-90 font-medium border border-white/30 px-2 py-1 rounded print:border-black/30">Personal Expense</span>
              </div>

              <table className="w-full text-left border-collapse text-sm">
                  <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
                          <th className="p-3 font-semibold">Employee</th>
                          <th className="p-3 font-semibold text-center">Snack Count</th>
                          <th className="p-3 font-semibold text-right">Amount (₹)</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                      {employeeBills.length === 0 ? (
                           <tr><td colSpan={3} className="p-6 text-center text-gray-400">No data available.</td></tr>
                      ) : (
                          employeeBills.map((bill, idx) => (
                              <tr key={idx}>
                                  <td className="p-3 text-gray-800 font-medium">
                                      {bill.employee.name}
                                  </td>
                                  <td className="p-3 text-center text-gray-600">
                                      {bill.originalItemCount}
                                      {bill.finalDeductedCount > 0 && (
                                          <span className="ml-1 text-[10px] text-gray-400 print:hidden">(-{bill.finalDeductedCount})</span>
                                      )}
                                  </td>
                                  <td className="p-3 text-right font-mono font-medium text-gray-700">
                                      {bill.finalPayableAmount}
                                  </td>
                              </tr>
                          ))
                      )}
                  </tbody>
                  <tfoot>
                      <tr className="bg-gray-50 font-bold border-t border-gray-200">
                          <td className="p-3 text-gray-800">Total</td>
                          <td className="p-3 text-center text-gray-800">{employeeBills.reduce((a,b) => a + b.originalItemCount, 0)}</td>
                          <td className="p-3 text-right text-lg text-tea-700">₹{totalEmployeeAmount}</td>
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