import React, { useState, useEffect } from 'react';
import { X, Sparkles, AlertCircle, Upload, Check, Info, Camera, Trash2, Eye, Bot, Loader2 } from 'lucide-react';
import { BusinessExpense, CanadianProvince, CraCategoryCode, PaymentMethod, TaxTreatment, CompanyProfile, ExtractedReceiptData } from '../types';
import { PROVINCES, CRA_CATEGORIES, COMMON_CANADIAN_VENDORS } from '../constants/canadianTax';
import { calculateTaxBreakdown, calculateDeductibleAmount, suggestCategoryForVendor, formatCad } from '../utils/taxCalculators';
import { ReceiptCameraCaptureModal } from './ReceiptCameraCaptureModal';
import { scanReceiptWithGemini } from '../services/geminiReceiptService';

interface ExpenseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expense: Omit<BusinessExpense, 'id' | 'createdAt'>, idToUpdate?: string) => void;
  expenseToEdit?: BusinessExpense | null;
  companyProfile: CompanyProfile;
}

export const ExpenseFormModal: React.FC<ExpenseFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  expenseToEdit,
  companyProfile,
}) => {
  const [companyPaid, setCompanyPaid] = useState('');
  const [amountCadStr, setAmountCadStr] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [craCategory, setCraCategory] = useState<CraCategoryCode>('8810');
  const [province, setProvince] = useState<CanadianProvince>(companyProfile.province || 'ON');
  const [taxTreatment, setTaxTreatment] = useState<TaxTreatment>('standard');
  const [customGstHst, setCustomGstHst] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('corporate_credit_card');
  const [hasReceipt, setHasReceipt] = useState(true);
  const [receiptFileName, setReceiptFileName] = useState<string | undefined>();
  const [receiptDataUrl, setReceiptDataUrl] = useState<string | undefined>();
  const [notes, setNotes] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [isDirectorLoan, setIsDirectorLoan] = useState(false);
  const [filteredVendors, setFilteredVendors] = useState<typeof COMMON_CANADIAN_VENDORS>([]);
  const [showVendorSuggestions, setShowVendorSuggestions] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [previewFullReceipt, setPreviewFullReceipt] = useState(false);
  const [isAiScanningInForm, setIsAiScanningInForm] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  // Apply AI extracted receipt data into form fields
  const applyExtractedData = (extracted: ExtractedReceiptData) => {
    if (extracted.vendor) setCompanyPaid(extracted.vendor);
    if (extracted.totalAmountCad !== undefined && extracted.totalAmountCad > 0) {
      setAmountCadStr(extracted.totalAmountCad.toString());
    }
    if (extracted.date) setDate(extracted.date);
    if (extracted.craCategory && CRA_CATEGORIES[extracted.craCategory]) {
      setCraCategory(extracted.craCategory);
    }
    if (extracted.gstHstAmount !== undefined && extracted.gstHstAmount > 0) {
      setCustomGstHst(extracted.gstHstAmount.toString());
      setTaxTreatment('custom');
    }
    if (extracted.invoiceNumber) setInvoiceNumber(extracted.invoiceNumber);
    if (extracted.rawSummary && !notes) setNotes(extracted.rawSummary);
    if (extracted.province && PROVINCES[extracted.province as CanadianProvince]) {
      setProvince(extracted.province as CanadianProvince);
    }

    setAiNotice(
      `Extracted with Gemini: ${extracted.vendor || 'Vendor'} • $${extracted.totalAmountCad || 0} CAD • CRA ${extracted.craCategory || ''}`
    );
    setTimeout(() => setAiNotice(null), 6000);
  };

  // Handle camera capture confirmation
  const handleCameraCapture = (dataUri: string, fileName: string, extractedData?: ExtractedReceiptData) => {
    setReceiptDataUrl(dataUri);
    setReceiptFileName(fileName);
    setHasReceipt(true);
    if (extractedData) {
      applyExtractedData(extractedData);
    }
  };

  // On-demand Gemini AI scan for any attached receipt
  const handleScanAttachedWithGemini = async () => {
    if (!receiptDataUrl) return;
    setIsAiScanningInForm(true);
    setAiNotice(null);

    const result = await scanReceiptWithGemini(receiptDataUrl);
    if (result.success && result.data) {
      applyExtractedData(result.data);
    } else {
      setAiNotice(result.error || 'Could not auto-extract receipt data.');
      setTimeout(() => setAiNotice(null), 5000);
    }
    setIsAiScanningInForm(false);
  };

  // Reset or populate fields when modal opens or expenseToEdit changes
  useEffect(() => {
    if (expenseToEdit) {
      setCompanyPaid(expenseToEdit.companyPaid);
      setAmountCadStr(expenseToEdit.amountCad.toString());
      setDate(expenseToEdit.date);
      setCraCategory(expenseToEdit.craCategory);
      setProvince(expenseToEdit.province);
      setTaxTreatment(expenseToEdit.taxTreatment);
      setCustomGstHst(expenseToEdit.gstHstAmount.toString());
      setPaymentMethod(expenseToEdit.paymentMethod);
      setHasReceipt(expenseToEdit.hasReceipt);
      setReceiptFileName(expenseToEdit.receiptFileName);
      setReceiptDataUrl(expenseToEdit.receiptDataUrl);
      setNotes(expenseToEdit.notes || '');
      setInvoiceNumber(expenseToEdit.invoiceNumber || '');
      setIsDirectorLoan(expenseToEdit.isDirectorLoan);
    } else {
      setCompanyPaid('');
      setAmountCadStr('');
      setDate(new Date().toISOString().split('T')[0]);
      setCraCategory('8810');
      setProvince(companyProfile.province || 'ON');
      setTaxTreatment('standard');
      setCustomGstHst('');
      setPaymentMethod('corporate_credit_card');
      setHasReceipt(true);
      setReceiptFileName(undefined);
      setReceiptDataUrl(undefined);
      setNotes('');
      setInvoiceNumber('');
      setIsDirectorLoan(false);
    }
  }, [expenseToEdit, isOpen, companyProfile.province]);

  if (!isOpen) return null;

  // Handle vendor typing and suggestions
  const handleCompanyChange = (val: string) => {
    setCompanyPaid(val);
    if (val.trim().length > 1) {
      const matches = COMMON_CANADIAN_VENDORS.filter((v) =>
        v.name.toLowerCase().includes(val.toLowerCase())
      );
      setFilteredVendors(matches);
      setShowVendorSuggestions(matches.length > 0);

      // Try auto-suggesting category
      const suggested = suggestCategoryForVendor(val);
      if (suggested && !expenseToEdit) {
        setCraCategory(suggested);
      }
    } else {
      setShowVendorSuggestions(false);
    }
  };

  const selectVendorSuggestion = (vendor: (typeof COMMON_CANADIAN_VENDORS)[0]) => {
    setCompanyPaid(vendor.name);
    setCraCategory(vendor.category);
    if (!notes) {
      setNotes(vendor.notes);
    }
    setShowVendorSuggestions(false);
  };

  const parsedAmount = parseFloat(amountCadStr) || 0;
  const parsedCustomGst = parseFloat(customGstHst) || 0;

  // Compute live breakdown
  const { netAmount, gstHstAmount, pstQstAmount } = calculateTaxBreakdown(
    parsedAmount,
    province,
    taxTreatment,
    parsedCustomGst,
    0
  );

  const { deductibleAmount, percentage } = calculateDeductibleAmount(netAmount, craCategory);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptFileName(file.name);
      setHasReceipt(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptDataUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyPaid.trim()) {
      alert('Please enter the name of the company you paid.');
      return;
    }
    if (parsedAmount <= 0) {
      alert('Please enter a valid amount in CAD.');
      return;
    }

    const fiscalYear = parseInt(date.split('-')[0], 10) || new Date().getFullYear();

    const expensePayload = {
      companyPaid: companyPaid.trim(),
      amountCad: parsedAmount,
      date,
      craCategory,
      province,
      taxTreatment,
      gstHstAmount,
      pstQstAmount,
      netAmount,
      deductiblePercentage: percentage,
      deductibleAmountCad: deductibleAmount,
      paymentMethod,
      hasReceipt,
      receiptFileName,
      receiptDataUrl,
      notes: notes.trim(),
      invoiceNumber: invoiceNumber.trim(),
      fiscalYear,
      isDirectorLoan: paymentMethod === 'director_paid' || isDirectorLoan,
    };

    onSave(expensePayload, expenseToEdit?.id);
    onClose();
  };

  const categoryInfo = CRA_CATEGORIES[craCategory];
  const provinceInfo = PROVINCES[province] || PROVINCES.ON;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/70">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">
              {expenseToEdit ? 'Edit Business Expense' : 'Log Business Expense'}
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Record payment to vendor for Canadian corporate tax & GST/HST credit
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          
          {/* PRIMARY FIELDS: Company Name Paid & Amount Paid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Company / Payee Input */}
            <div className="relative">
              <label htmlFor="input-company-paid" className="block text-xs font-semibold text-neutral-700 mb-1">
                Company Paid (Vendor / Payee) <span className="text-red-500">*</span>
              </label>
              <input
                id="input-company-paid"
                type="text"
                required
                autoFocus
                value={companyPaid}
                onChange={(e) => handleCompanyChange(e.target.value)}
                onFocus={() => {
                  if (filteredVendors.length > 0) setShowVendorSuggestions(true);
                }}
                placeholder="e.g. Rogers, AWS, Tim Hortons, Staples"
                className="w-full px-3.5 py-2.5 bg-white border border-neutral-300 rounded-xl text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 placeholder:text-neutral-400 shadow-2xs"
              />

              {/* Vendor Auto-suggestions */}
              {showVendorSuggestions && filteredVendors.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-xl shadow-lg max-h-48 overflow-y-auto py-1 text-xs">
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    Canadian Business Match
                  </div>
                  {filteredVendors.map((vendor) => (
                    <button
                      type="button"
                      key={vendor.name}
                      onClick={() => selectVendorSuggestion(vendor)}
                      className="w-full text-left px-3 py-2 hover:bg-neutral-50 flex items-center justify-between transition-colors"
                    >
                      <span className="font-semibold text-neutral-800">{vendor.name}</span>
                      <span className="text-[11px] text-neutral-500">
                        {CRA_CATEGORIES[vendor.category]?.name.split(' ')[0]}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Amount Paid in CAD */}
            <div>
              <label htmlFor="input-amount-cad" className="block text-xs font-semibold text-neutral-700 mb-1">
                Amount Paid (CAD) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500 font-semibold text-sm">
                  $
                </span>
                <input
                  id="input-amount-cad"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amountCadStr}
                  onChange={(e) => setAmountCadStr(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3.5 py-2.5 bg-white border border-neutral-300 rounded-xl text-sm font-semibold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 placeholder:text-neutral-400 shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* Date & CRA Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Expense Date */}
            <div>
              <label htmlFor="input-date" className="block text-xs font-semibold text-neutral-700 mb-1">
                Date of Expense <span className="text-red-500">*</span>
              </label>
              <input
                id="input-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-neutral-300 rounded-xl text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 shadow-2xs"
              />
            </div>

            {/* CRA Tax Category */}
            <div>
              <label htmlFor="select-cra-category" className="block text-xs font-semibold text-neutral-700 mb-1">
                CRA Tax Category (Form T2 / T2125)
              </label>
              <select
                id="select-cra-category"
                value={craCategory}
                onChange={(e) => setCraCategory(e.target.value as CraCategoryCode)}
                className="w-full px-3.5 py-2 bg-white border border-neutral-300 rounded-xl text-xs font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 shadow-2xs"
              >
                {Object.values(CRA_CATEGORIES).map((cat) => (
                  <option key={cat.code} value={cat.code}>
                    {cat.line} - {cat.name} {cat.deductiblePercentage === 50 ? '(50% Rule)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Category description & 50% CRA rule alert */}
          {categoryInfo && (
            <div className={`p-3 rounded-xl text-xs border ${
              categoryInfo.deductiblePercentage === 50
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-neutral-50 border-neutral-200 text-neutral-600'
            }`}>
              <div className="flex items-start gap-2">
                {categoryInfo.deductiblePercentage === 50 ? (
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                ) : (
                  <Info className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <span className="font-semibold">{categoryInfo.name}: </span>
                  {categoryInfo.description}
                  {categoryInfo.deductiblePercentage === 50 && (
                    <div className="mt-1 font-semibold text-amber-800">
                      ⚖️ CRA Rule: Only 50% of this expense is deductible on your corporate tax return.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Canadian Sales Tax (GST/HST/PST/QST) Section */}
          <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-800 uppercase tracking-wide">
                Sales Tax & Input Tax Credit (ITC)
              </span>
              <span className="text-[11px] text-neutral-500">
                Claimable on Line 108 of CRA GST/HST Return
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Province */}
              <div>
                <label htmlFor="select-province" className="block text-[11px] font-semibold text-neutral-600 mb-1">
                  Province of Purchase / Registration
                </label>
                <select
                  id="select-province"
                  value={province}
                  onChange={(e) => setProvince(e.target.value as CanadianProvince)}
                  className="w-full px-3 py-1.5 bg-white border border-neutral-300 rounded-lg text-xs font-medium text-neutral-800 focus:outline-none focus:ring-1 focus:ring-red-500"
                >
                  {Object.values(PROVINCES).map((prov) => (
                    <option key={prov.code} value={prov.code}>
                      {prov.name} ({prov.code}) - {(prov.totalRate * 100).toFixed(prov.code === 'QC' ? 3 : 0)}% {prov.type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tax Treatment */}
              <div>
                <label htmlFor="select-tax-treatment" className="block text-[11px] font-semibold text-neutral-600 mb-1">
                  Tax Treatment
                </label>
                <select
                  id="select-tax-treatment"
                  value={taxTreatment}
                  onChange={(e) => setTaxTreatment(e.target.value as TaxTreatment)}
                  className="w-full px-3 py-1.5 bg-white border border-neutral-300 rounded-lg text-xs font-medium text-neutral-800 focus:outline-none focus:ring-1 focus:ring-red-500"
                >
                  <option value="standard">Standard Included ({provinceInfo.type} {(provinceInfo.totalRate * 100).toFixed(0)}%)</option>
                  <option value="zero_rated">Zero-Rated / Foreign Vendor (0% tax)</option>
                  <option value="exempt">CRA Tax-Exempt (Bank fees, insurance)</option>
                  <option value="custom">Custom Tax Amount</option>
                </select>
              </div>
            </div>

            {taxTreatment === 'custom' && (
              <div>
                <label htmlFor="input-custom-gst" className="block text-[11px] font-semibold text-neutral-600 mb-1">
                  Exact GST/HST Paid on Receipt (CAD)
                </label>
                <input
                  id="input-custom-gst"
                  type="number"
                  step="0.01"
                  value={customGstHst}
                  onChange={(e) => setCustomGstHst(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-1.5 bg-white border border-neutral-300 rounded-lg text-xs text-neutral-800"
                />
              </div>
            )}

            {/* Computed Breakdown Pill */}
            {parsedAmount > 0 && (
              <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                <div className="bg-white p-2 rounded-lg border border-neutral-200">
                  <div className="text-[10px] text-neutral-500 uppercase">Net Before Tax</div>
                  <div className="text-xs font-bold text-neutral-900">{formatCad(netAmount)}</div>
                </div>
                <div className="bg-blue-50/70 p-2 rounded-lg border border-blue-200">
                  <div className="text-[10px] text-blue-700 font-semibold uppercase">GST/HST (Claimable ITC)</div>
                  <div className="text-xs font-bold text-blue-900">{formatCad(gstHstAmount)}</div>
                </div>
                <div className="bg-emerald-50/70 p-2 rounded-lg border border-emerald-200">
                  <div className="text-[10px] text-emerald-700 font-semibold uppercase">Tax Deductible</div>
                  <div className="text-xs font-bold text-emerald-900">{formatCad(deductibleAmount)}</div>
                </div>
              </div>
            )}
          </div>

          {/* Payment Method & Director Loan Toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="select-payment-method" className="block text-xs font-semibold text-neutral-700 mb-1">
                Payment Method
              </label>
              <select
                id="select-payment-method"
                value={paymentMethod}
                onChange={(e) => {
                  const val = e.target.value as PaymentMethod;
                  setPaymentMethod(val);
                  if (val === 'director_paid') {
                    setIsDirectorLoan(true);
                  }
                }}
                className="w-full px-3.5 py-2 bg-white border border-neutral-300 rounded-xl text-xs font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-500 shadow-2xs"
              >
                <option value="corporate_credit_card">Corporate Credit Card</option>
                <option value="business_bank_account">Business Operating Bank Account</option>
                <option value="interac_etransfer">Interac e-Transfer</option>
                <option value="director_paid">Director Paid / Shareholder Out-of-Pocket</option>
                <option value="cheque">Company Cheque</option>
                <option value="cash">Cash / Petty Cash</option>
              </select>
            </div>

            <div>
              <label htmlFor="input-invoice-number" className="block text-xs font-semibold text-neutral-700 mb-1">
                Invoice / Reference # (Optional)
              </label>
              <input
                id="input-invoice-number"
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="e.g. INV-2026-091"
                className="w-full px-3.5 py-2 bg-white border border-neutral-300 rounded-xl text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-500 shadow-2xs"
              />
            </div>
          </div>

          {/* Business Purpose / Notes (Essential for CRA Audit Protection) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="input-notes" className="block text-xs font-semibold text-neutral-700">
                Business Purpose / CRA Audit Notes
              </label>
              <span className="text-[11px] text-neutral-400">Recommended by CRA</span>
            </div>
            <textarea
              id="input-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Monthly server fees for client portal; or Breakfast meeting with prospective contractor"
              className="w-full px-3.5 py-2 bg-white border border-neutral-300 rounded-xl text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-500 placeholder:text-neutral-400 shadow-2xs"
            />
          </div>

          {/* Receipt Status & File Attachment */}
          <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hasReceipt}
                  onChange={(e) => setHasReceipt(e.target.checked)}
                  className="w-4 h-4 rounded text-red-600 focus:ring-red-500 border-neutral-300"
                />
                <div>
                  <span className="text-xs font-semibold text-neutral-800 block">
                    Original Receipt / Invoice on file
                  </span>
                  <span className="text-[10px] text-neutral-500">CRA 6-year retention compliance</span>
                </div>
              </label>

              <div className="flex items-center gap-2">
                {/* Camera Capture Button */}
                <button
                  type="button"
                  id="btn-open-camera-capture"
                  onClick={() => setIsCameraModalOpen(true)}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                  title="Capture receipt photo using browser camera"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Snap Photo</span>
                </button>

                {/* File Upload Button */}
                <label
                  htmlFor="file-upload-receipt"
                  className="px-3 py-1.5 bg-white border border-neutral-300 hover:bg-neutral-100 rounded-lg text-xs font-medium text-neutral-700 cursor-pointer flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <Upload className="w-3.5 h-3.5 text-neutral-500" />
                  <span>{receiptFileName ? 'Upload File' : 'Upload File'}</span>
                </label>
                <input
                  id="file-upload-receipt"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>

            {receiptFileName && (
              <div className="mt-3 flex items-center justify-between gap-2 text-xs text-emerald-800 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
                <div className="flex items-center gap-2 min-w-0">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="truncate font-semibold">{receiptFileName}</span>
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                  {receiptDataUrl && (
                    <>
                      <button
                        type="button"
                        id="btn-scan-receipt-with-gemini"
                        onClick={handleScanAttachedWithGemini}
                        disabled={isAiScanningInForm}
                        className="px-2.5 py-1 bg-gradient-to-r from-amber-50 to-red-50 hover:from-amber-100 hover:to-red-100 border border-amber-300 text-amber-900 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                        title="Scan with Gemini to auto-extract vendor, date, total, and taxes"
                      >
                        {isAiScanningInForm ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                            <span>Scanning...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3 text-amber-600" />
                            <span>AI Scan</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setPreviewFullReceipt(true)}
                        className="px-2 py-1 bg-white hover:bg-emerald-100/70 border border-emerald-300 text-emerald-800 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Inspect full resolution receipt"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Preview</span>
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setReceiptFileName(undefined);
                      setReceiptDataUrl(undefined);
                    }}
                    className="p-1 text-neutral-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                    title="Remove attached receipt"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  {receiptDataUrl && receiptDataUrl.startsWith('data:image') && (
                    <img
                      src={receiptDataUrl}
                      alt="Receipt preview"
                      onClick={() => setPreviewFullReceipt(true)}
                      className="w-7 h-7 object-cover rounded-md border border-neutral-300 cursor-pointer hover:opacity-85 transition-opacity"
                    />
                  )}
                </div>
              </div>
            )}

            {/* AI Extraction Notice Toast */}
            {aiNotice && (
              <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-amber-900 bg-amber-50 px-3 py-2 rounded-xl border border-amber-300">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{aiNotice}</span>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-neutral-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="btn-save-expense"
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>{expenseToEdit ? 'Update Expense' : 'Save Business Expense'}</span>
            </button>
          </div>
        </form>

      </div>

      {/* Camera Capture Modal */}
      <ReceiptCameraCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={handleCameraCapture}
        companyName={companyPaid}
      />

      {/* Full Receipt Preview Modal inside Form */}
      {previewFullReceipt && receiptDataUrl && (
        <div className="fixed inset-0 z-60 bg-neutral-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-4 shadow-2xl flex flex-col items-center">
            <div className="w-full flex justify-between items-center pb-2 border-b border-neutral-200">
              <span className="text-xs font-bold text-neutral-800">Attached Receipt Voucher</span>
              <button
                type="button"
                onClick={() => setPreviewFullReceipt(false)}
                className="text-neutral-400 hover:text-neutral-700 text-xs font-bold px-2 py-1"
              >
                Close ✕
              </button>
            </div>
            <div className="mt-3 max-h-[70vh] overflow-auto">
              <img
                src={receiptDataUrl}
                alt="Receipt Voucher"
                className="max-w-full h-auto rounded-xl border border-neutral-200 shadow-xs"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
