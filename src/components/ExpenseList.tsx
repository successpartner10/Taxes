import React, { useState, useMemo } from 'react';
import { Search, Filter, Trash2, Edit3, Copy, FileText, CheckCircle2, AlertTriangle, ArrowUpDown, ChevronDown, ChevronUp, Camera, Download, Eye } from 'lucide-react';
import { BusinessExpense, CraCategoryCode, PaymentMethod } from '../types';
import { CRA_CATEGORIES } from '../constants/canadianTax';
import { formatCad, formatDate } from '../utils/taxCalculators';

interface ExpenseListProps {
  expenses: BusinessExpense[];
  onEdit: (expense: BusinessExpense) => void;
  onDelete: (id: string) => void;
  onDuplicate: (expense: BusinessExpense) => void;
  onAddClick: () => void;
  onSnapReceipt?: (expense: BusinessExpense) => void;
}

type SortField = 'date' | 'amountCad' | 'companyPaid' | 'deductibleAmountCad';
type SortOrder = 'asc' | 'desc';

export const ExpenseList: React.FC<ExpenseListProps> = ({
  expenses,
  onEdit,
  onDelete,
  onDuplicate,
  onAddClick,
  onSnapReceipt,
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CraCategoryCode | 'all'>('all');
  const [paymentFilter, setPaymentFilter] = useState<PaymentMethod | 'all'>('all');
  const [receiptFilter, setReceiptFilter] = useState<'all' | 'with_receipt' | 'missing_receipt'>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedExpenseForLightbox, setSelectedExpenseForLightbox] = useState<BusinessExpense | null>(null);

  // Filter expenses
  const filtered = useMemo(() => {
    return expenses.filter((exp) => {
      // Search text
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesCompany = exp.companyPaid.toLowerCase().includes(query);
        const matchesNotes = (exp.notes || '').toLowerCase().includes(query);
        const matchesInvoice = (exp.invoiceNumber || '').toLowerCase().includes(query);
        if (!matchesCompany && !matchesNotes && !matchesInvoice) return false;
      }

      // Category filter
      if (categoryFilter !== 'all' && exp.craCategory !== categoryFilter) {
        return false;
      }

      // Payment filter
      if (paymentFilter !== 'all' && exp.paymentMethod !== paymentFilter) {
        return false;
      }

      // Receipt filter
      if (receiptFilter === 'with_receipt' && !exp.hasReceipt) return false;
      if (receiptFilter === 'missing_receipt' && exp.hasReceipt) return false;

      return true;
    });
  }, [expenses, search, categoryFilter, paymentFilter, receiptFilter]);

  // Sort expenses
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'date') {
        comparison = a.date.localeCompare(b.date);
      } else if (sortField === 'amountCad') {
        comparison = a.amountCad - b.amountCad;
      } else if (sortField === 'deductibleAmountCad') {
        comparison = a.deductibleAmountCad - b.deductibleAmountCad;
      } else if (sortField === 'companyPaid') {
        comparison = a.companyPaid.localeCompare(b.companyPaid);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filtered, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const formatPaymentMethod = (method: PaymentMethod) => {
    switch (method) {
      case 'corporate_credit_card':
        return 'Corp Card';
      case 'business_bank_account':
        return 'Bank Acct';
      case 'interac_etransfer':
        return 'e-Transfer';
      case 'director_paid':
        return 'Director Loan';
      case 'cheque':
        return 'Cheque';
      case 'cash':
        return 'Cash';
      default:
        return method;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden">
      
      {/* Search & Filter Toolbar */}
      <div className="p-4 border-b border-neutral-200 bg-neutral-50/50 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by company paid, description, or invoice #..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-neutral-300 rounded-xl text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 shadow-2xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Category Dropdown */}
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as CraCategoryCode | 'all')}
                className="px-3 py-2 bg-white border border-neutral-300 rounded-xl text-xs font-medium text-neutral-700 focus:outline-none focus:ring-2 focus:ring-red-500 shadow-2xs pr-7"
              >
                <option value="all">All CRA Categories</option>
                {Object.values(CRA_CATEGORIES).map((cat) => (
                  <option key={cat.code} value={cat.code}>
                    {cat.line} - {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Method Filter */}
            <div className="relative">
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value as PaymentMethod | 'all')}
                className="px-3 py-2 bg-white border border-neutral-300 rounded-xl text-xs font-medium text-neutral-700 focus:outline-none focus:ring-2 focus:ring-red-500 shadow-2xs pr-7"
              >
                <option value="all">All Payment Types</option>
                <option value="corporate_credit_card">Corporate Credit Card</option>
                <option value="business_bank_account">Business Bank Account</option>
                <option value="interac_etransfer">Interac e-Transfer</option>
                <option value="director_paid">Director Paid (Reimbursements)</option>
                <option value="cheque">Cheque</option>
                <option value="cash">Cash</option>
              </select>
            </div>

            {/* Receipt Filter */}
            <div className="relative">
              <select
                value={receiptFilter}
                onChange={(e) => setReceiptFilter(e.target.value as 'all' | 'with_receipt' | 'missing_receipt')}
                className="px-3 py-2 bg-white border border-neutral-300 rounded-xl text-xs font-medium text-neutral-700 focus:outline-none focus:ring-2 focus:ring-red-500 shadow-2xs"
              >
                <option value="all">All Receipts</option>
                <option value="with_receipt">With Receipt</option>
                <option value="missing_receipt">Missing Receipt</option>
              </select>
            </div>

          </div>
        </div>

        {/* Active Filter summary and count */}
        <div className="flex items-center justify-between text-xs text-neutral-500 pt-1">
          <span>
            Showing <strong className="text-neutral-800">{sorted.length}</strong> of {expenses.length} expenses
          </span>
          {(search || categoryFilter !== 'all' || paymentFilter !== 'all' || receiptFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setCategoryFilter('all');
                setPaymentFilter('all');
                setReceiptFilter('all');
              }}
              className="text-red-600 hover:text-red-800 font-semibold underline underline-offset-2"
            >
              Reset all filters
            </button>
          )}
        </div>
      </div>

      {/* Table & List View */}
      {sorted.length === 0 ? (
        <div className="py-14 text-center px-4">
          <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto text-neutral-400 mb-3">
            <Filter className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-neutral-800">No matching business expenses found</h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto mt-1 mb-4">
            {expenses.length === 0
              ? 'Start by adding the company you paid and the amount to build your Canadian tax expense ledger.'
              : 'Try changing your search keywords or clearing active filters.'}
          </p>
          {expenses.length === 0 && (
            <button
              type="button"
              onClick={onAddClick}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
            >
              Log First Business Expense
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-neutral-50/80 border-b border-neutral-200 text-neutral-500 font-semibold select-none">
                <th
                  onClick={() => handleSort('date')}
                  className="py-3 px-4 cursor-pointer hover:text-neutral-900 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Date</span>
                    {sortField === 'date' ? (
                      sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-neutral-300" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('companyPaid')}
                  className="py-3 px-4 cursor-pointer hover:text-neutral-900 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Company Paid (Vendor)</span>
                    {sortField === 'companyPaid' ? (
                      sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-neutral-300" />
                    )}
                  </div>
                </th>
                <th className="py-3 px-4">CRA Category & Line</th>
                <th
                  onClick={() => handleSort('amountCad')}
                  className="py-3 px-4 text-right cursor-pointer hover:text-neutral-900 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Gross Paid</span>
                    {sortField === 'amountCad' ? (
                      sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-neutral-300" />
                    )}
                  </div>
                </th>
                <th className="py-3 px-4 text-right">GST/HST (ITC)</th>
                <th
                  onClick={() => handleSort('deductibleAmountCad')}
                  className="py-3 px-4 text-right cursor-pointer hover:text-neutral-900 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>CRA Deductible</span>
                    {sortField === 'deductibleAmountCad' ? (
                      sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-neutral-300" />
                    )}
                  </div>
                </th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4 text-center">Receipt</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 font-normal text-neutral-800">
              {sorted.map((exp) => {
                const cat = CRA_CATEGORIES[exp.craCategory];
                const isMeals = exp.craCategory === '8523';

                return (
                  <tr
                    key={exp.id}
                    className="hover:bg-neutral-50/70 transition-colors group"
                  >
                    {/* Date */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-neutral-600 font-mono text-[11px]">
                      {formatDate(exp.date)}
                    </td>

                    {/* Company Paid & Notes */}
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="font-semibold text-neutral-900 flex items-center gap-1.5">
                        <span>{exp.companyPaid}</span>
                        {exp.isDirectorLoan && (
                          <span
                            className="text-[10px] bg-purple-100 text-purple-700 font-medium px-1.5 py-0.5 rounded"
                            title="Paid out-of-pocket by Shareholder/Director (Reimbursable from corporation)"
                          >
                            Director Loan
                          </span>
                        )}
                      </div>
                      {exp.notes && (
                        <div className="text-[11px] text-neutral-500 truncate max-w-sm mt-0.5">
                          {exp.notes}
                        </div>
                      )}
                      {exp.invoiceNumber && (
                        <div className="text-[10px] text-neutral-400 mt-0.5 font-mono">
                          Ref: {exp.invoiceNumber}
                        </div>
                      )}
                    </td>

                    {/* CRA Category */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-100 border border-neutral-200 text-neutral-800 font-medium text-[11px]">
                        <span className="font-mono text-neutral-500">{cat?.line || exp.craCategory}</span>
                        <span>•</span>
                        <span>{cat?.name || 'Expense'}</span>
                      </div>
                    </td>

                    {/* Gross Paid */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap font-semibold text-neutral-900">
                      {formatCad(exp.amountCad)}
                    </td>

                    {/* GST/HST (ITC) */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap text-blue-700 font-medium">
                      {exp.gstHstAmount > 0 ? (
                        <span>{formatCad(exp.gstHstAmount)}</span>
                      ) : (
                        <span className="text-neutral-400">$0.00</span>
                      )}
                    </td>

                    {/* CRA Deductible */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="font-bold text-emerald-950">
                        {formatCad(exp.deductibleAmountCad)}
                      </div>
                      {isMeals && (
                        <div className="text-[10px] text-amber-700 font-semibold">
                          50% CRA Limit
                        </div>
                      )}
                    </td>

                    {/* Payment Method */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                        exp.isDirectorLoan
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : 'bg-neutral-100 text-neutral-700'
                      }`}>
                        {formatPaymentMethod(exp.paymentMethod)}
                      </span>
                    </td>

                    {/* Receipt Indicator & Snap Camera Action */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {exp.hasReceipt ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedExpenseForLightbox(exp)}
                            className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-800 font-medium"
                            title={exp.receiptFileName || 'Receipt verified'}
                          >
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            {exp.receiptDataUrl ? (
                              <Eye className="w-3.5 h-3.5 text-neutral-400 hover:text-neutral-700" />
                            ) : (
                              <FileText className="w-3.5 h-3.5 text-neutral-400" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5">
                          <span
                            className="inline-flex items-center text-amber-500"
                            title="No receipt on file - CRA audit flag"
                          >
                            <AlertTriangle className="w-4 h-4" />
                          </span>
                          {onSnapReceipt && (
                            <button
                              type="button"
                              onClick={() => onSnapReceipt(exp)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 hover:bg-red-100 text-red-700 font-semibold rounded-md border border-red-200 text-[10px] transition-colors"
                              title="Capture photo of receipt using camera"
                            >
                              <Camera className="w-3 h-3" />
                              <span>Snap</span>
                            </button>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onDuplicate(exp)}
                          className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-md transition-colors"
                          title="Duplicate Expense"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onEdit(exp)}
                          className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-md transition-colors"
                          title="Edit Expense"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(exp.id)}
                          className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Delete Expense"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Receipt Preview Lightbox Modal */}
      {selectedExpenseForLightbox && (
        <div className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-4 sm:p-5 shadow-2xl flex flex-col items-center">
            
            <div className="w-full flex justify-between items-center pb-3 border-b border-neutral-200">
              <div>
                <div className="text-xs font-bold text-neutral-900 flex items-center gap-2">
                  <span>{selectedExpenseForLightbox.companyPaid}</span>
                  <span className="font-mono text-neutral-500 font-normal">
                    {formatCad(selectedExpenseForLightbox.amountCad)} CAD
                  </span>
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5">
                  {selectedExpenseForLightbox.date} • {selectedExpenseForLightbox.receiptFileName || 'Digital voucher'}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {selectedExpenseForLightbox.receiptDataUrl && (
                  <a
                    href={selectedExpenseForLightbox.receiptDataUrl}
                    download={selectedExpenseForLightbox.receiptFileName || 'receipt.jpg'}
                    className="p-1.5 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors text-xs flex items-center gap-1 font-medium"
                    title="Download receipt image"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedExpenseForLightbox(null)}
                  className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="mt-4 max-h-[68vh] overflow-auto w-full flex items-center justify-center bg-neutral-50 rounded-xl p-2 border border-neutral-100">
              {selectedExpenseForLightbox.receiptDataUrl ? (
                <img
                  src={selectedExpenseForLightbox.receiptDataUrl}
                  alt={`Receipt for ${selectedExpenseForLightbox.companyPaid}`}
                  className="max-w-full h-auto rounded-lg border border-neutral-200 shadow-xs"
                />
              ) : (
                <div className="py-12 text-center text-neutral-400 space-y-2">
                  <FileText className="w-8 h-8 mx-auto" />
                  <p className="text-xs">Receipt file was marked verified on paper or external drive.</p>
                </div>
              )}
            </div>

            <div className="w-full mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs">
              <span className="text-neutral-500 text-[11px]">
                Valid for Canada Revenue Agency (CRA) corporate tax audit inspection
              </span>
              {onSnapReceipt && (
                <button
                  type="button"
                  onClick={() => {
                    const exp = selectedExpenseForLightbox;
                    setSelectedExpenseForLightbox(null);
                    onSnapReceipt(exp);
                  }}
                  className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Retake Photo</span>
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
