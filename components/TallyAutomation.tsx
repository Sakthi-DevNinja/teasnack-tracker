import React from 'react';
import { DailyCompanyBill } from '../services/billingService';
import { Employee } from '../types';
import { Info, Users, Coffee, PlusCircle, CheckCircle } from 'lucide-react';

interface Props {
  billRow: DailyCompanyBill;
  employees: Employee[];
}

export const TallyAutomation: React.FC<Props> = ({ billRow }) => {
  // If no activity, don't show
  if (billRow.totalDailyCost === 0 && billRow.totalStaff === 0) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mb-6">
      <div className="bg-tea-50 px-4 py-3 border-b border-tea-100 flex justify-between items-center">
        <div className="flex items-center gap-2">
            <Coffee className="w-5 h-5 text-tea-700" />
            <span className="font-bold text-tea-900">
                {new Date(billRow.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
        </div>
        <span className="text-xs font-semibold bg-white text-tea-700 px-2 py-1 rounded border border-tea-200">
            Bill Breakdown
        </span>
      </div>
      
      <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4 text-center">
             
              {/* 1. Total Staff */}
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 flex flex-col justify-center items-center">
                  <div className="text-xs text-gray-500 mb-1 flex justify-center items-center gap-1">
                      <Users className="w-3 h-3" /> Total Emp
                  </div>
                  <div className="text-xl font-bold text-gray-800">{billRow.totalStaff}</div>
              </div>

              {/* 2. Actual Drinks */}
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100 flex flex-col justify-center items-center">
                  <div className="text-xs text-blue-600 mb-1">Actual Drinks</div>
                  <div className="text-xl font-bold text-blue-700">{billRow.actualDrinkCount}</div>
                  <div className="text-[10px] text-blue-400">₹{billRow.baseDrinkCost}</div>
              </div>

              {/* 3. Manual Moves */}
              <div className="bg-orange-50 rounded-lg p-3 border border-orange-100 flex flex-col justify-center items-center relative">
                   <div className="text-xs text-orange-600 mb-1">Manual Added</div>
                   <div className="text-xl font-bold text-orange-700">
                       {billRow.manualAddedCount}
                   </div>
                   <div className="text-[10px] text-orange-400">₹{billRow.manualAddedCost}</div>
                   {billRow.manualAddedCount > 0 && <PlusCircle className="absolute top-1 right-1 w-3 h-3 text-orange-400" />}
              </div>

              {/* 4. Total Billed Items */}
              <div className="bg-purple-50 rounded-lg p-3 border border-purple-100 flex flex-col justify-center items-center">
                  <div className="text-xs text-purple-600 mb-1">Total Items</div>
                  <div className="text-xl font-bold text-purple-700">{billRow.actualDrinkCount + billRow.manualAddedCount}</div>
                  <div className="text-[10px] text-purple-400">Drinks + Snacks</div>
              </div>

              {/* 5. Final Bill Amount */}
              <div className="bg-tea-100 rounded-lg p-3 border border-tea-200 flex flex-col justify-center items-center">
                  <div className="text-xs text-tea-800 mb-1 font-semibold">Bill Amount</div>
                  <div className="text-xl font-bold text-tea-900">₹{billRow.totalDailyCost}</div>
                  <div className="text-[10px] text-tea-700"><CheckCircle className="w-3 h-3 inline mr-1"/>Final</div>
              </div>

          </div>

          {/* Logic Explanation / Justification */}
          <div className="bg-gray-50 rounded-md p-3 text-xs text-gray-600 border border-gray-100">
              <div className="font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <Info className="w-3 h-3" /> Calculation Logic
              </div>
              <div className="flex flex-col gap-1">
                  <div className="flex justify-between border-b border-gray-200 pb-1">
                      <span>Base Drinks Cost:</span>
                      <span className="font-mono">₹{billRow.baseDrinkCost}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-200 pb-1">
                      <span>+ Snacks moved to Company:</span>
                      <span className="font-mono text-orange-600">+₹{billRow.manualAddedCost}</span>
                  </div>
                  <div className="flex justify-between font-bold pt-1 text-tea-800">
                      <span>Total Company Liability:</span>
                      <span className="font-mono">₹{billRow.totalDailyCost}</span>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};