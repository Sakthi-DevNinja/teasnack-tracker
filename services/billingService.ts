import { Consumption, Employee } from '../types';

export interface DailyCompanyBill {
  date: string;
  totalStaff: number;
  actualDrinkCount: number; 
  fillers: number;
  adjustedCount: number;
  amount: number;
}

export interface EmployeeBill {
  employee: Employee;
  items: Consumption[];
  originalItemCount: number;
  originalAmount: number;
  
  // Total Deductions across the period
  totalDeductedCount: number;
  totalDeductedAmount: number;
  finalPayableAmount: number;
  
  // Helper for TODAY'S state (for UI toggles)
  todayAdjustmentCount: number;
  todayMaxDeductible: number;

  // UI Helpers & Stats
  finalDeductedCount: number;
  finalDeductedAmount: number;
  canIncreaseAdjustment: boolean;
  canDecreaseAdjustment: boolean;
}

export interface BillingResult {
  companyBillRows: DailyCompanyBill[];
  employeeBills: EmployeeBill[];
  totalCompanyBaseAmount: number;
  totalManualTransferAmount: number;
  grandTotalCompanyAmount: number;
}

// Helper to expand quantity-based logs into single units for calculation parity
const expandConsumptions = (logs: Consumption[]): Consumption[] => {
    const expanded: Consumption[] = [];
    logs.forEach(log => {
        const qty = log.quantity || 1;
        // Push N copies of the log (conceptually) so existing logic sees 1 item = 1 unit
        for (let i = 0; i < qty; i++) {
            // Create a virtual copy. ID doesn't matter for calc, just price/empId/type
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
    dailyAdjustments: Record<string, Record<string, number>> = {}
  ): BillingResult => {
    
    // 1. Group Consumptions by Date
    const groupedByDate: Record<string, Consumption[]> = {};
    consumptions.forEach(c => {
      const dateKey = c.date.split('T')[0];
      if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
      groupedByDate[dateKey].push(c);
    });

    const companyBillRows: DailyCompanyBill[] = [];
    
    // We need to aggregate employee stats across the entire date range
    const empAggregates: Record<string, {
      items: Consumption[], // Raw logs (compact with quantity)
      expandedCount: number, // Total units count
      originalAmount: number,
      deductedCount: number,
      deductedAmount: number
    }> = {};

    // Initialize aggregates
    employees.forEach(e => {
        empAggregates[e.id] = { items: [], expandedCount: 0, originalAmount: 0, deductedCount: 0, deductedAmount: 0 };
    });

    const sortedDates = Object.keys(groupedByDate).sort();
    let totalManualTransferAmount = 0;

    // 2. Iterate Day by Day
    sortedDates.forEach(date => {
      const dailyLogs = groupedByDate[date];
      
      // EXPAND LOGS FOR CALCULATION (Handles Quantity > 1)
      const expandedLogs = expandConsumptions(dailyLogs);

      // --- Company Bill Calculation ---
      const drinkItems = expandedLogs.filter(c => c.itemType === 'drink');
      const drinkConsumers = new Set(drinkItems.map(c => c.employeeId));
      const actualDrinkCount = drinkConsumers.size;
      const dailyDrinkCost = drinkItems.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
      
      const companyRow: DailyCompanyBill = {
          date,
          totalStaff: activeEmployeeCount,
          actualDrinkCount: actualDrinkCount,
          fillers: 0,
          adjustedCount: actualDrinkCount,
          amount: dailyDrinkCost
      };

      // --- Employee Snack Deduction Calculation ---
      const snackItemsExpanded = expandedLogs.filter(c => c.itemType === 'snack');
      
      // Group expanded snacks by employee for this day
      const dailySnacksByEmp: Record<string, Consumption[]> = {};
      snackItemsExpanded.forEach(s => {
          if (!dailySnacksByEmp[s.employeeId]) dailySnacksByEmp[s.employeeId] = [];
          dailySnacksByEmp[s.employeeId].push(s);
      });

      // Apply Daily Manual Adjustments
      const todaysAdjustments = dailyAdjustments[date] || {};

      Object.keys(dailySnacksByEmp).forEach(empId => {
          const snacks = dailySnacksByEmp[empId];
          const manualCount = todaysAdjustments[empId] || 0; 
          
          // Sort descending price to deduct expensive ones first
          const sortedSnacks = [...snacks].sort((a,b) => (Number(b.price)||0) - (Number(a.price)||0));
          const totalSnacksCount = sortedSnacks.length;

          // Clamp deduction
          let deductCount = manualCount;
          if (deductCount < 0) deductCount = 0;
          if (deductCount > totalSnacksCount) deductCount = totalSnacksCount;

          // Calculate amounts
          const snacksToDeduct = sortedSnacks.slice(0, deductCount);
          const deductedAmount = snacksToDeduct.reduce((sum, s) => sum + (Number(s.price)||0), 0);
          
          totalManualTransferAmount += deductedAmount;

          if (empAggregates[empId]) {
              // Note: We push raw logs for display, but calc based on expanded
              // Need to find original logs for this day to push to 'items' list
              const originalDailySnacks = dailyLogs.filter(l => l.itemType === 'snack' && l.employeeId === empId);
              empAggregates[empId].items.push(...originalDailySnacks); 
              
              empAggregates[empId].expandedCount += totalSnacksCount;
              empAggregates[empId].originalAmount += snacks.reduce((sum, s) => sum + (Number(s.price)||0), 0);
              empAggregates[empId].deductedCount += deductCount;
              empAggregates[empId].deductedAmount += deductedAmount;
          }
      });

      companyBillRows.push(companyRow);
    });

    // 3. Construct Final Employee Bill Objects
    const todayStr = new Date().toISOString().split('T')[0];

    const employeeBills: EmployeeBill[] = employees.map(emp => {
        const agg = empAggregates[emp.id];
        
        // Stats specifically for Today
        const todayLogs = groupedByDate[todayStr] || [];
        // Important: Calculate today's max deductible based on expanded quantity
        const todaySnacksExpanded = expandConsumptions(todayLogs.filter(c => c.itemType === 'snack' && c.employeeId === emp.id));
        
        const todayAdjustment = (dailyAdjustments[todayStr] && dailyAdjustments[todayStr][emp.id]) || 0;

        return {
            employee: emp,
            items: agg.items, // List of raw logs (with qty)
            originalItemCount: agg.expandedCount, // Sum of all quantities
            originalAmount: agg.originalAmount,
            
            totalDeductedCount: agg.deductedCount,
            totalDeductedAmount: agg.deductedAmount,
            finalPayableAmount: Math.max(0, agg.originalAmount - agg.deductedAmount),
            
            automatedDeductedCount: 0,
            manualAdjustmentCount: agg.deductedCount, 
            
            // UI Helpers
            todayAdjustmentCount: todayAdjustment,
            todayMaxDeductible: todaySnacksExpanded.length, // Max is total units
            
            finalDeductedCount: agg.deductedCount, 
            finalDeductedAmount: agg.deductedAmount,
            
            canIncreaseAdjustment: todayAdjustment < todaySnacksExpanded.length,
            canDecreaseAdjustment: todayAdjustment > 0
        };
    }).filter(bill => bill.originalItemCount > 0);

    const totalCompanyBaseAmount = companyBillRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    const grandTotalCompanyAmount = totalCompanyBaseAmount + totalManualTransferAmount;

    return { 
        companyBillRows, 
        employeeBills,
        totalCompanyBaseAmount: isNaN(totalCompanyBaseAmount) ? 0 : totalCompanyBaseAmount,
        totalManualTransferAmount: isNaN(totalManualTransferAmount) ? 0 : totalManualTransferAmount,
        grandTotalCompanyAmount: isNaN(grandTotalCompanyAmount) ? 0 : grandTotalCompanyAmount
    };
  }
};