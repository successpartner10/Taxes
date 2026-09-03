import React, { useState } from 'react';
import { X, Send, Copy, Check, FileSpreadsheet, Printer, Mail, ShieldAlert, Sparkles, Building, ExternalLink, Cloud } from 'lucide-react';
import { BusinessExpense, CompanyProfile } from '../types';
import { CRA_CATEGORIES } from '../constants/canadianTax';
import { formatCad, generateAccountantEmail, exportToCraCsv } from '../utils/taxCalculators';

interface AccountantExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  expenses: BusinessExpense[];
  company: CompanyProfile;
  selectedYear: number | 'all';
  onPrint: () => void;
  onSaveToDrive?: () => void;
}

export const AccountantExportModal: React.FC<AccountantExportModalProps> = ({
  isOpen,
  onClose,
  expenses,
  company,
  selectedYear,
  onPrint,
  onSaveToDrive,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'email' | 'summary'>('email');

  if (!isOpen) return null;

  const { subject, body, mailtoUrl } = generateAccountantEmail(expenses, company, selectedYear);

  const handleCopy = () => {
    navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadCsv = () => {
    exportToCraCsv(expenses, company, selectedYear);
  };

  // Group by CRA category for summary tab
  const categorySummary: Record<string, { line: string; name: string; count: number; gross: number; deductible: number }> = {};
  for (const exp of expenses) {
    const cat = CRA_CATEGORIES[exp.craCategory];
    const key = exp.craCategory;
    if (!categorySummary[key]) {
      categorySummary[key] = {
        line: cat?.line || exp.craCategory,
        name: cat?.name || 'Other',
        count: 0,
        gross: 0,
        deductible: 0,
      };
    }
    categorySummary[key].count += 1;
    categorySummary[key].gross += exp.amountCad;
    categorySummary[key].deductible += exp.deductibleAmountCad;
  }

  const totalGross = expenses.reduce((s, e) => s + e.amountCad, 0);
  const totalGstHst = expenses.reduce((s, e) => s + e.gstHstAmount, 0);
  const totalDeductible = expenses.reduce((s, e) => s + e.deductibleAmountCad, 0);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900">
                Send Tax Expenses to Accountant
              </h2>
              <p className="text-xs text-neutral-500">
                Canada CRA T2 Corporate Tax & T2125 Schedule Package ({selectedYear === 'all' ? 'All Years' : `Tax Year ${selectedYear}`})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Action Ribbon */}
        <div className="bg-indigo-950 text-white px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-neutral-300 block text-[10px] uppercase font-semibold">Total Expenses</span>
              <span className="font-bold text-sm text-white">{formatCad(totalGross)}</span>
            </div>
            <div className="h-6 w-px bg-indigo-800" />
            <div>
              <span className="text-neutral-300 block text-[10px] uppercase font-semibold">Tax Deductible</span>
              <span className="font-bold text-sm text-emerald-400">{formatCad(totalDeductible)}</span>
            </div>
            <div className="h-6 w-px bg-indigo-800" />
            <div>
              <span className="text-neutral-300 block text-[10px] uppercase font-semibold">GST/HST Claimable (ITC)</span>
              <span className="font-bold text-sm text-blue-300">{formatCad(totalGstHst)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onSaveToDrive && (
              <button
                type="button"
                id="btn-modal-save-drive"
                onClick={onSaveToDrive}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                title="Save this entire tax package directly to your Google Drive 'taxes' folder"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>Save to Drive (/taxes)</span>
              </button>
            )}
            <button
              type="button"
              id="btn-download-csv-modal"
              onClick={handleDownloadCsv}
              className="px-3 py-1.5 bg-indigo-800 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Download CSV</span>
            </button>
            <button
              type="button"
              onClick={onPrint}
              className="px-3 py-1.5 bg-indigo-800 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-neutral-200 px-6 bg-neutral-50/50">
          <button
            type="button"
            onClick={() => setActiveTab('email')}
            className={`py-2.5 px-4 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'email'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email Draft to Accountant</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('summary')}
            className={`py-2.5 px-4 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'summary'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>CRA Line Breakdown (T2 / GIFI)</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          
          {activeTab === 'email' ? (
            <div className="space-y-4">
              
              {/* Recipient & Subject Header */}
              <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-500 font-medium">To (Accountant):</span>
                  <span className="font-semibold text-neutral-900">
                    {company.accountantName ? `${company.accountantName} (${company.accountantEmail || 'No email set'})` : 'Your Canadian Accountant'}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-neutral-200">
                  <span className="text-neutral-500 font-medium">Subject:</span>
                  <span className="font-semibold text-neutral-900 truncate max-w-md">{subject}</span>
                </div>
              </div>

              {/* Email Body Preview */}
              <div className="relative">
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Ready-to-Send Email Draft
                </label>
                <textarea
                  readOnly
                  rows={12}
                  value={body}
                  className="w-full p-4 bg-neutral-900 text-neutral-100 font-mono text-xs rounded-xl border border-neutral-700 focus:outline-none leading-relaxed select-all"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Includes CRA 50% Meals rule & ITC calculation</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="px-4 py-2 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-neutral-500" />}
                    <span>{copied ? 'Copied to Clipboard!' : 'Copy Email Text'}</span>
                  </button>

                  <a
                    href={mailtoUrl}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Open in Email App (Mail / Outlook)</span>
                    <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
                  </a>
                </div>
              </div>

            </div>
          ) : (
            /* Summary by CRA Category */
            <div className="space-y-4">
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Accountant Taxprep & T2 GIFI Codes:</span> Each line corresponds directly to the General Index of Financial Information (GIFI) or CRA Schedule 125 for Canadian corporate tax filing.
                </div>
              </div>

              <div className="border border-neutral-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-neutral-50 text-neutral-600 font-semibold border-b border-neutral-200">
                    <tr>
                      <th className="py-2.5 px-3">CRA Line Code</th>
                      <th className="py-2.5 px-3">Category Name</th>
                      <th className="py-2.5 px-3 text-center">Items</th>
                      <th className="py-2.5 px-3 text-right">Gross CAD</th>
                      <th className="py-2.5 px-3 text-right">Tax Deductible</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {Object.entries(categorySummary)
                      .sort((a, b) => b[1].gross - a[1].gross)
                      .map(([code, item]) => (
                        <tr key={code} className="hover:bg-neutral-50">
                          <td className="py-2.5 px-3 font-mono font-semibold text-neutral-800">
                            {item.line}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-neutral-900">
                            {item.name}
                            {code === '8523' && (
                              <span className="ml-1.5 text-[10px] bg-amber-100 text-amber-800 font-semibold px-1.5 py-0.5 rounded">
                                50% Limit Applied
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center text-neutral-600 font-medium">
                            {item.count}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-neutral-900">
                            {formatCad(item.gross)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-950">
                            {formatCad(item.deductible)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                  <tfoot className="bg-neutral-50 font-bold border-t border-neutral-200">
                    <tr>
                      <td colSpan={2} className="py-2.5 px-3 text-neutral-900">
                        TOTALS
                      </td>
                      <td className="py-2.5 px-3 text-center text-neutral-700">
                        {expenses.length}
                      </td>
                      <td className="py-2.5 px-3 text-right text-neutral-900">
                        {formatCad(totalGross)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-emerald-950">
                        {formatCad(totalDeductible)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
