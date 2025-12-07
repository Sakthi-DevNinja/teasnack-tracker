import React, { useMemo } from 'react';
import { Consumption, Employee, TallyResult } from '../types';
import { Info, Users, Coffee } from 'lucide-react';

interface Props {
  date: string;
  consumptions: Consumption[];
  activeEmployeeCount: number;
  employees: Employee[];
}

export const TallyAutomation: React.FC<Props> = ({ date, consumptions, activeEmployeeCount, employees }) => {
  
  const calculationResult = useMemo((): TallyResult => {
    // 1. Identify Drink Consumers (Company Expense: Tea/Coffee/Milk)
    const drinkConsumers = new Set<string>();
    consumptions.forEach(c => {
        if (c.itemType === 'drink') drinkConsumers.add(c.employeeId);
    });
    const actualTeaCount = drinkConsumers.size;

    // 2. Identify Snack Consumers & Counts
    // UPDATED: Sum quantities, not just rows
    const snackCounts: Record<string, number> = {};
    consumptions.filter(c => c.itemType === 'snack').forEach(c => {
        const qty = c.quantity || 1;
        snackCounts[c.employeeId] = (snackCounts[c.employeeId] || 0) + qty;
    });

    // 3. Identify Filler Candidates
    const snackOnlyList: string[] = [];
    const extraSnackList: string[] = [];

    Object.entries(snackCounts).forEach(([empId, count]) => {
        // Condition A: Snack Only (No Drink)
        if (!drinkConsumers.has(empId)) {
            snackOnlyList.push(empId);
        }
        
        // Condition B: Extra Snack (More than 1 snack unit)
        if (count > 1) {
            extraSnackList.push(empId);
        }
    });

    // 4. Calculate Gap & Adjustment
    const targetCount = activeEmployeeCount;
    const initialGap = Math.max(0, targetCount - actualTeaCount);
    
    const totalFillersAvailable = snackOnlyList.length + extraSnackList.length;
    const filledAmount = Math.min(initialGap, totalFillersAvailable);
    const adjustedTeaCount = actualTeaCount + filledAmount;
    
    // 5. Final Calculation
    const TEA_RATE = 10;
    const finalCompanyCost = adjustedTeaCount * TEA_RATE;

    const getNames = (ids: string[]) => ids.map(id => employees.find(e => e.id === id)?.name || 'Unknown');

    return {
        date,
        actualTeaCount,
        totalEmployees: activeEmployeeCount,
        adjustedTeaCount,
        snackOnlyConsumers: getNames(snackOnlyList),
        extraSnackConsumers: getNames(extraSnackList),
        finalCompanyCost,
        gapFilled: filledAmount
    };

  }, [consumptions, activeEmployeeCount, employees, date]);

  if (consumptions.length === 0) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mb-6">
      <div className="bg-tea-50 px-4 py-3 border-b border-tea-100 flex justify-between items-center">
        <div className="flex items-center gap-2">
            <Coffee className="w-5 h-5 text-tea-700" />
            <span className="font-bold text-tea-900">
                {new Date(date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
        </div>
        <span className="text-xs font-semibold bg-white text-tea-700 px-2 py-1 rounded border border-tea-200">
            Tally Logic
        </span>
      </div>
      
      <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4 text-center">
             
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <div className="text-xs text-gray-500 mb-1 flex justify-center items-center gap-1">
                      <Users className="w-3 h-3" /> Total Emp
                  </div>
                  <div className="text-xl font-bold text-gray-800">{calculationResult.totalEmployees}</div>
              </div>

              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                  <div className="text-xs text-blue-600 mb-1">Actual Drinks</div>
                  <div className="text-xl font-bold text-blue-700">{calculationResult.actualTeaCount}</div>
              </div>

              <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
                   <div className="text-xs text-orange-600 mb-1">Fillers Avail</div>
                   <div className="text-xl font-bold text-orange-700">
                       {calculationResult.snackOnlyConsumers.length + calculationResult.extraSnackConsumers.length}
                   </div>
              </div>

              <div className="bg-green-50 rounded-lg p-3 border border-green-100 relative">
                  <div className="text-xs text-green-600 mb-1">Adj. Head Count</div>
                  <div className="text-xl font-bold text-green-700">{calculationResult.adjustedTeaCount}</div>
                  {calculationResult.gapFilled > 0 && (
                      <div className="absolute -top-2 -right-2 bg-green-600 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full">
                          +{calculationResult.gapFilled}
                      </div>
                  )}
              </div>

              <div className="bg-tea-100 rounded-lg p-3 border border-tea-200">
                  <div className="text-xs text-tea-800 mb-1 font-semibold">Bill Amount</div>
                  <div className="text-xl font-bold text-tea-900">₹{calculationResult.finalCompanyCost}</div>
                  <div className="text-[10px] text-tea-700">(Head Count × 10)</div>
              </div>

          </div>

          {/* Justification Section */}
          {(calculationResult.snackOnlyConsumers.length > 0 || calculationResult.extraSnackConsumers.length > 0) && (
              <div className="bg-gray-50 rounded-md p-3 text-xs text-gray-600 border border-gray-100">
                  <div className="font-semibold text-gray-700 mb-2 flex items-center gap-1">
                      <Info className="w-3 h-3" /> Tally Justification (Fillers)
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {calculationResult.snackOnlyConsumers.length > 0 && (
                          <div className="flex gap-2 items-start">
                              <span className="text-orange-600 font-medium whitespace-nowrap">Snack Only:</span>
                              <span className="text-gray-700">{calculationResult.snackOnlyConsumers.join(', ')}</span>
                          </div>
                      )}
                      {calculationResult.extraSnackConsumers.length > 0 && (
                           <div className="flex gap-2 items-start">
                              <span className="text-purple-600 font-medium whitespace-nowrap">Extra Snacks:</span>
                              <span className="text-gray-700">{calculationResult.extraSnackConsumers.join(', ')}</span>
                          </div>
                      )}
                  </div>
                  {calculationResult.gapFilled > 0 && (
                       <div className="mt-2 text-green-700 italic border-t border-gray-200 pt-1">
                           * {calculationResult.gapFilled} filler(s) used to match employee count (Gap of {calculationResult.totalEmployees - calculationResult.actualTeaCount}).
                       </div>
                  )}
              </div>
          )}
      </div>
    </div>
  );
};