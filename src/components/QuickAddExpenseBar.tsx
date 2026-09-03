import React, { useState } from 'react';
import { Plus, Sparkles, Check, ChevronRight, Camera } from 'lucide-react';
import { CompanyProfile, BusinessExpense } from '../types';
import { suggestCategoryForVendor, calculateTaxBreakdown, calculateDeductibleAmount, formatCad } from '../utils/taxCalculators';
import { CRA_CATEGORIES, COMMON_CANADIAN_VENDORS } from '../constants/canadianTax';

interface QuickAddExpenseBarProps {
  companyProfile: CompanyProfile;
  onAddQuickExpense: (expense: Omit<BusinessExpense, 'id' | 'createdAt'>) => void;
  onOpenDetailedModal: () => void;
  onSnapReceiptPhoto?: () => void;
}

export const QuickAddExpenseBar: React.FC<QuickAddExpenseBarProps> = ({
  companyProfile,
  onAddQuickExpense,
  onOpenDetailedModal,
  onSnapReceiptPhoto,
}) => {
  const [companyPaid, setCompanyPaid] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [lastAddedName, setLastAddedName] = useState('');
  const [suggestedCategoryName, setSuggestedCategoryName] = useState<string | null>(null);

  const handleCompanyChange = (val: string) => {
    setCompanyPaid(val);
    if (val.trim().length > 1) {
      const suggested = suggestCategoryForVendor(val);
      if (suggested) {
        setSuggestedCategoryName(CRA_CATEGORIES[suggested]?.name || null);
      } else {
        setSuggestedCategoryName(null);
      }
    } else {
      setSuggestedCategoryName(null);
    }
  };

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCompany = companyPaid.trim();
    const amount = parseFloat(amountStr);

    if (!cleanCompany) {
      alert('Please enter the company name you paid.');
      return;
    }
    if (!amount || amount <= 0) {
      alert('Please enter a valid amount in CAD.');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const fiscalYear = new Date().getFullYear();

    // Smart category lookup
    const detectedCategory = suggestCategoryForVendor(cleanCompany) || '8810';

    // Auto tax breakdown based on company province
    const { netAmount, gstHstAmount, pstQstAmount } = calculateTaxBreakdown(
      amount,
      companyProfile.province || 'ON',
      'standard'
    );

    const { deductibleAmount, percentage } = calculateDeductibleAmount(netAmount, detectedCategory);

    // Look for default note from common vendors
    const vendorMatch = COMMON_CANADIAN_VENDORS.find(
      (v) => v.name.toLowerCase() === cleanCompany.toLowerCase()
    );

    onAddQuickExpense({
      companyPaid: cleanCompany,
      amountCad: amount,
      date: todayStr,
      craCategory: detectedCategory,
      province: companyProfile.province || 'ON',
      taxTreatment: 'standard',
      gstHstAmount,
      pstQstAmount,
      netAmount,
      deductiblePercentage: percentage,
      deductibleAmountCad: deductibleAmount,
      paymentMethod: 'corporate_credit_card',
      hasReceipt: true,
      notes: vendorMatch?.notes || '',
      fiscalYear,
      isDirectorLoan: false,
    });

    setLastAddedName(cleanCompany);
    setCompanyPaid('');
    setAmountStr('');
    setSuggestedCategoryName(null);
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3000);
  };

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs p-4 sm:p-5 mb-6 print:hidden">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
            <span>Quick Log Expense</span>
            <span className="text-[11px] font-medium text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">
              Instant CRA Category & Tax Auto-calc
            </span>
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Enter the vendor name and amount paid — automatically categorized for Canadian taxes ({companyProfile.province} {companyProfile.province === 'ON' ? '13% HST' : 'taxes'} applied).
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {onSnapReceiptPhoto && (
            <button
              type="button"
              id="btn-quick-snap-receipt"
              onClick={onSnapReceiptPhoto}
              className="text-xs text-red-700 hover:text-red-900 bg-gradient-to-r from-red-50 via-amber-50 to-red-50 hover:from-red-100 hover:to-amber-100 font-bold px-3 py-1 rounded-lg border border-red-200 flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
              title="Open camera to scan receipt with Gemini AI"
            >
              <Camera className="w-3.5 h-3.5 text-red-600" />
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>AI Scan Receipt</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenDetailedModal}
            className="text-xs text-neutral-600 hover:text-red-700 font-semibold flex items-center gap-1 transition-colors"
          >
            <span>More fields / upload</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <form onSubmit={handleQuickSubmit} className="flex flex-col md:flex-row items-stretch gap-3">
        
        {/* Company Name Input */}
        <div className="relative flex-1">
          <input
            type="text"
            id="quick-input-company"
            value={companyPaid}
            onChange={(e) => handleCompanyChange(e.target.value)}
            placeholder="Company Paid (e.g. AWS, Rogers, Tim Hortons, Staples, Deloitte)"
            className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-sm font-medium text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 placeholder:text-neutral-400 transition-all shadow-2xs"
          />
          {suggestedCategoryName && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 pointer-events-none">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              <span>{suggestedCategoryName}</span>
            </div>
          )}
        </div>

        {/* Amount Input */}
        <div className="relative w-full md:w-48">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500 font-semibold text-sm">
            $
          </span>
          <input
            type="number"
            step="0.01"
            min="0.01"
            id="quick-input-amount"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            placeholder="0.00 CAD"
            className="w-full pl-8 pr-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-sm font-semibold text-neutral-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 placeholder:text-neutral-400 transition-all shadow-2xs"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          id="btn-quick-add-submit"
          className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Expense</span>
        </button>
      </form>

      {/* Instant Feedback Toast */}
      {showSuccessToast && (
        <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Logged payment to <strong>{lastAddedName}</strong> into your Canada tax expense ledger!
          </span>
        </div>
      )}

    </div>
  );
};
