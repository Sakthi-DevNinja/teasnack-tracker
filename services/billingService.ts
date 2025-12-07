import { Consumption, Employee } from '../types';
import { DailyAdjustmentMap } from './storageService';

export interface DailyCompanyBill {
  date: string;
  totalStaff: number;
  actualDrinkCount: number; 
  
  // Manual/Tally Adjustments
  manualAddedCount: number; 
  manualAddedCost: number;
  
  // Costs
  baseDrinkCost: number;
  totalDailyCost: number; // base + manualAdded
  
  // Detailed Items (Drinks + Moved Snacks)
  items: Consumption[];
}

export interface EmployeeBill {
  employee: Employee;
  items: Consumption[]; // All items originally consumed
  originalItemCount: number;
  originalAmount: number;
  
  // Payable Items (After deductions)
  payableItems: Consumption[];
  
  // Total Deductions
  totalDeductedCount: number;
  totalDeductedAmount: number;
  finalPayableAmount: number;
  
  // UI Helpers
  todayAdjustmentMap: Record<string, number>; // ItemId -> Count
  
  finalDeductedCount: number;
  finalDeductedAmount: number;
}

export interface BillingResult {
  companyBillRows: DailyCompanyBill[];
  employeeBills: EmployeeBill[];
  totalCompanyBaseAmount: number;
  totalManualTransferAmount: number;
  grandTotalCompanyAmount: number;
}

const expandConsumptions = (logs: Consumption[]): Consumption[] => {
    const expanded: Consumption[] = [];
    logs.forEach(log => {
        const qty = log.quantity || 1;
        for (let i = 0; i < qty; i++) {
            expanded.push({ ...log });
        }
    });
    return expanded;
};

export const BillingService = {
  calculateBilling: (
    consumptions: Consumption[], 
    employees: Employee[], 
    activeEmployeeCount: number,
    dailyAdjustments: DailyAdjustmentMap = {}
  ): BillingResult => {
    
    const groupedByDate: Record<string, Consumption[]> = {};
    consumptions.forEach(c => {
      const dateKey = c.date.split('T')[0];
      if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
      groupedByDate[dateKey].push(c);
    });

    const companyBillRows: DailyCompanyBill[] = [];
    
    const empAggregates: Record<string, {
      items: Consumption[], 
      expandedCount: number, 
      originalAmount: number,
      deductedCount: number,
      deductedAmount: number,
      payableItems: Consumption[]
    }> = {};

    employees.forEach(e => {
        empAggregates[e.id] = { items: [], expandedCount: 0, originalAmount: 0, deductedCount: 0, deductedAmount: 0, payableItems: [] };
    });

    const sortedDates = Object.keys(groupedByDate).sort();
    let totalManualTransferAmount = 0;

    sortedDates.forEach(date => {
      const dailyLogs = groupedByDate[date];
      const expandedLogs = expandConsumptions(dailyLogs);

      // --- Company Bill Base ---
      const drinkItems = expandedLogs.filter(c => c.itemType === 'drink');
      const drinkConsumers = new Set(drinkItems.map(c => c.employeeId));
      const actualDrinkCount = drinkConsumers.size;
      const dailyDrinkCost = drinkItems.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
      
      // Initialize Company Items with Drinks
      const companyDailyItems: Consumption[] = [...drinkItems];
      let dailyManualAddedCount = 0;
      let dailyManualAddedCost = 0;

      // --- Employee Deduction Logic ---
      const snackItemsExpanded = expandedLogs.filter(c => c.itemType === 'snack');
      const dailySnacksByEmp: Record<string, Consumption[]> = {};
      snackItemsExpanded.forEach(s => {
          if (!dailySnacksByEmp[s.employeeId]) dailySnacksByEmp[s.employeeId] = [];
          dailySnacksByEmp[s.employeeId].push(s);
      });

      const todaysAdjustments = dailyAdjustments[date] || {};

      Object.keys(dailySnacksByEmp).forEach(empId => {
          const snacks = dailySnacksByEmp[empId];
          const empAdjustments = todaysAdjustments[empId] || {}; // ItemId -> Count
          
          const snacksToDeduct: Consumption[] = [];
          const snacksToPay: Consumption[] = [];
          
          // Group snacks by ItemId to apply adjustments
          const snacksByItem: Record<string, Consumption[]> = {};
          snacks.forEach(s => {
              if (!snacksByItem[s.itemId]) snacksByItem[s.itemId] = [];
              snacksByItem[s.itemId].push(s);
          });

          Object.keys(snacksByItem).forEach(itemId => {
             const items = snacksByItem[itemId];
             // Adjustment is count of items comp pays for
             const adjustCount = empAdjustments[itemId] || 0;
             
             for (let i = 0; i < items.length; i++) {
                 if (i < adjustCount) {
                     snacksToDeduct.push(items[i]);
                 } else {
                     snacksToPay.push(items[i]);
                 }
             }
          });

          const deductedAmount = snacksToDeduct.reduce((sum, s) => sum + (Number(s.price)||0), 0);
          
          // Update Company Stats
          dailyManualAddedCount += snacksToDeduct.length;
          dailyManualAddedCost += deductedAmount;
          companyDailyItems.push(...snacksToDeduct); 

          // Update Global Stats
          totalManualTransferAmount += deductedAmount;

          // Update Employee Stats
          if (empAggregates[empId]) {
              const originalDailySnacks = dailyLogs.filter(l => l.itemType === 'snack' && l.employeeId === empId);
              empAggregates[empId].items.push(...originalDailySnacks); 
              empAggregates[empId].expandedCount += snacks.length;
              empAggregates[empId].originalAmount += snacks.reduce((sum, s) => sum + (Number(s.price)||0), 0);
              empAggregates[empId].deductedCount += snacksToDeduct.length;
              empAggregates[empId].deductedAmount += deductedAmount;
              empAggregates[empId].payableItems.push(...snacksToPay);
          }
      });

      companyBillRows.push({
          date,
          totalStaff: activeEmployeeCount,
          actualDrinkCount: actualDrinkCount,
          manualAddedCount: dailyManualAddedCount,
          manualAddedCost: dailyManualAddedCost,
          baseDrinkCost: dailyDrinkCost,
          totalDailyCost: dailyDrinkCost + dailyManualAddedCost,
          items: companyDailyItems
      });
    });

    // 3. Construct Final Employee Bill Objects
    const todayStr = new Date().toISOString().split('T')[0];

    const employeeBills: EmployeeBill[] = employees.map(emp => {
        const agg = empAggregates[emp.id];
        
        return {
            employee: emp,
            items: agg.items, 
            originalItemCount: agg.expandedCount, 
            originalAmount: agg.originalAmount,
            payableItems: agg.payableItems, 
            
            totalDeductedCount: agg.deductedCount,
            totalDeductedAmount: agg.deductedAmount,
            finalPayableAmount: Math.max(0, agg.originalAmount - agg.deductedAmount),
            
            // UI Helpers
            todayAdjustmentMap: dailyAdjustments[todayStr]?.[emp.id] || {},
            
            finalDeductedCount: agg.deductedCount, 
            finalDeductedAmount: agg.deductedAmount
        };
    }).filter(bill => bill.originalItemCount > 0);

    const totalCompanyBaseAmount = companyBillRows.reduce((sum, row) => sum + row.baseDrinkCost, 0);
    const grandTotalCompanyAmount = companyBillRows.reduce((sum, row) => sum + row.totalDailyCost, 0);

    return { 
        companyBillRows, 
        employeeBills,
        totalCompanyBaseAmount: isNaN(totalCompanyBaseAmount) ? 0 : totalCompanyBaseAmount,
        totalManualTransferAmount: isNaN(totalManualTransferAmount) ? 0 : totalManualTransferAmount,
        grandTotalCompanyAmount: isNaN(grandTotalCompanyAmount) ? 0 : grandTotalCompanyAmount
    };
  }
};