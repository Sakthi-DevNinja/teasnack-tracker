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
    // Structure: { empId: { items: [], originalCost: 0, deductedCount: 0, deductedCost: 0 } }
    const empAggregates: Record<string, {
      items: Consumption[],
      originalAmount: number,
      deductedCount: number,
      deductedAmount: number
    }> = {};

    // Initialize aggregates
    employees.forEach(e => {
        empAggregates[e.id] = { items: [], originalAmount: 0, deductedCount: 0, deductedAmount: 0 };
    });

    const sortedDates = Object.keys(groupedByDate).sort();
    let totalManualTransferAmount = 0;

    // 2. Iterate Day by Day
    sortedDates.forEach(date => {
      const dailyLogs = groupedByDate[date];
      
      // --- Company Bill Calculation ---
      const drinkItems = dailyLogs.filter(c => c.itemType === 'drink');
      const drinkConsumers = new Set(drinkItems.map(c => c.employeeId));
      const actualDrinkCount = drinkConsumers.size;
      const dailyDrinkCost = drinkItems.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
      
      // Initial Company Row (Before Transfer)
      const companyRow: DailyCompanyBill = {
          date,
          totalStaff: activeEmployeeCount,
          actualDrinkCount: actualDrinkCount,
          fillers: 0,
          adjustedCount: actualDrinkCount,
          amount: dailyDrinkCost
      };

      // --- Employee Snack Deduction Calculation ---
      const snackLogs = dailyLogs.filter(c => c.itemType === 'snack');
      
      // Group snacks by employee for this day
      const dailySnacksByEmp: Record<string, Consumption[]> = {};
      snackLogs.forEach(s => {
          if (!dailySnacksByEmp[s.employeeId]) dailySnacksByEmp[s.employeeId] = [];
          dailySnacksByEmp[s.employeeId].push(s);
      });

      // Apply Daily Manual Adjustments
      const todaysAdjustments = dailyAdjustments[date] || {};

      Object.keys(dailySnacksByEmp).forEach(empId => {
          const snacks = dailySnacksByEmp[empId];
          const manualCount = todaysAdjustments[empId] || 0; // The count saved for this specific date
          
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
          
          // Add to Global Manual Transfer Total
          totalManualTransferAmount += deductedAmount;

          // Update Employee Aggregate
          if (empAggregates[empId]) {
              empAggregates[empId].items.push(...snacks); // Add all snacks to list
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
        
        // Stats specifically for Today (for UI controls)
        // We need to know how many snacks this person had TODAY to know the max limit for the +/- buttons
        const todayLogs = groupedByDate[todayStr] || [];
        const todaySnacks = todayLogs.filter(c => c.itemType === 'snack' && c.employeeId === emp.id);
        const todayAdjustment = (dailyAdjustments[todayStr] && dailyAdjustments[todayStr][emp.id]) || 0;

        return {
            employee: emp,
            items: agg.items,
            originalItemCount: agg.items.length,
            originalAmount: agg.originalAmount,
            
            // Aggregated Deductions (Historical + Today)
            totalDeductedCount: agg.deductedCount,
            totalDeductedAmount: agg.deductedAmount,
            finalPayableAmount: Math.max(0, agg.originalAmount - agg.deductedAmount),
            
            automatedDeductedCount: 0,
            manualAdjustmentCount: agg.deductedCount, // Total across period
            
            // UI Helpers for Today's specific controls
            todayAdjustmentCount: todayAdjustment,
            todayMaxDeductible: todaySnacks.length,
            
            // Dummy fields to satisfy interface if reused, but we use logic below
            finalDeductedCount: agg.deductedCount, 
            finalDeductedAmount: agg.deductedAmount,
            
            // UI Button Logic (Strictly for Today)
            canIncreaseAdjustment: todayAdjustment < todaySnacks.length,
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