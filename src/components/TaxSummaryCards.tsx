import React from 'react';
import { DollarSign, Percent, Receipt, Wallet, AlertCircle } from 'lucide-react';
import { BusinessExpense } from '../types';
import { formatCad } from '../utils/taxCalculators';

interface TaxSummaryCardsProps {
  expenses: BusinessExpense[];
  selectedYear: number | 'all';
}

export const TaxSummaryCards: React.FC<TaxSummaryCardsProps> = ({ expenses, selectedYear }) => {
  const totalGross = expenses.reduce((sum, e) => sum + e.amountCad, 0);
  const totalDeductible = expenses.reduce((sum, e) => sum + e.deductibleAmountCad, 0);
  const totalGstHst = expenses.reduce((sum, e) => sum + e.gstHstAmount, 0);
  const directorLoans = expenses.filter((e) => e.isDirectorLoan).reduce((sum, e) => sum + e.amountCad, 0);

  const mealExpenses = expenses.filter((e) => e.craCategory === '8523');
  const mealDeductionLost = mealExpenses.reduce((sum, e) => sum + (e.netAmount - e.deductibleAmountCad), 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      
      {/* 1. Total CAD Paid Out */}
      <div className="bg-white rounded-xl p-4 border border-neutral-200 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
            Total Paid (CAD)
          </span>
          <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-700">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-neutral-900 tracking-tight">
            {formatCad(totalGross)}
          </span>
        </div>
        <p className="mt-1.5 text-xs text-neutral-500">
          {expenses.length} transaction{expenses.length === 1 ? '' : 's'} recorded {selectedYear === 'all' ? 'total' : `in ${selectedYear}`}
        </p>
      </div>

      {/* 2. CRA Tax Deductible (Factoring in 50% Meals Limit) */}
      <div className="bg-white rounded-xl p-4 border border-neutral-200 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
              CRA Deductible
            </span>
            <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200">
              T2 / T2125
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700">
            <Percent className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-emerald-950 tracking-tight">
            {formatCad(totalDeductible)}
          </span>
        </div>
        <p className="mt-1.5 text-xs text-neutral-500 flex items-center gap-1">
          {mealDeductionLost > 0 ? (
            <span className="text-amber-700 flex items-center gap-0.5" title="CRA restricts meals & entertainment to 50%">
              <AlertCircle className="w-3 h-3 inline shrink-0" />
              -${formatCad(mealDeductionLost).replace('$', '')} 50% meal limit
            </span>
          ) : (
            '100% tax deduction on eligible lines'
          )}
        </p>
      </div>

      {/* 3. GST/HST Input Tax Credits (ITCs) */}
      <div className="bg-white rounded-xl p-4 border border-neutral-200 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
              GST/HST Claimable
            </span>
            <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">
              Line 108 ITC
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-700">
            <Receipt className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-blue-950 tracking-tight">
            {formatCad(totalGstHst)}
          </span>
        </div>
        <p className="mt-1.5 text-xs text-neutral-500">
          Recoverable on your CRA GST/HST return
        </p>
      </div>

      {/* 4. Director / Shareholder Reimbursements */}
      <div className="bg-white rounded-xl p-4 border border-neutral-200 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
              Director Paid
            </span>
            <span className="text-[10px] font-semibold bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200">
              Shareholder Loan
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-700">
            <Wallet className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-purple-950 tracking-tight">
            {formatCad(directorLoans)}
          </span>
        </div>
        <p className="mt-1.5 text-xs text-neutral-500">
          Personal funds used; tax-free corporate reimbursement
        </p>
      </div>

    </div>
  );
};
