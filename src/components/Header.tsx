import React from 'react';
import { Plus, Send, FileSpreadsheet, Building2, Printer, Cloud, Trash2, Users, LogIn } from 'lucide-react';
import { CompanyProfile, AppUser } from '../types';

interface HeaderProps {
  company: CompanyProfile;
  selectedYear: number | 'all';
  availableYears: number[];
  hasExpenses: boolean;
  currentUser: AppUser | null;
  onYearChange: (year: number | 'all') => void;
  onAddExpense: () => void;
  onOpenAccountantModal: () => void;
  onOpenCompanyModal: () => void;
  onExportCsv: () => void;
  onPrintReport: () => void;
  onSaveToGoogleDrive: () => void;
  onClearAllExpenses: () => void;
  onOpenTeamModal: () => void;
  onOpenLogin: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  company,
  selectedYear,
  availableYears,
  hasExpenses,
  currentUser,
  onYearChange,
  onAddExpense,
  onOpenAccountantModal,
  onOpenCompanyModal,
  onExportCsv,
  onPrintReport,
  onSaveToGoogleDrive,
  onClearAllExpenses,
  onOpenTeamModal,
  onOpenLogin,
}) => {
  return (
    <header className="bg-white border-b border-neutral-200 sticky top-0 z-30 shadow-xs print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-3.5 gap-3">
          
          {/* Brand & Canadian Context */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0 relative overflow-hidden">
              <span className="text-xl" title="Canada">🇨🇦</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-neutral-900 tracking-tight">
                  Canada Tax Expense Tracker
                </h1>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                  CRA T2 / T2125
                </span>
              </div>
              <button
                type="button"
                onClick={onOpenCompanyModal}
                className="text-xs text-neutral-500 hover:text-neutral-800 flex items-center gap-1.5 transition-colors group mt-0.5"
                title="Edit Canadian Business Details"
              >
                <Building2 className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-600" />
                <span className="font-medium text-neutral-700 underline decoration-neutral-300 underline-offset-2">
                  {company.legalName}
                </span>
                <span className="text-neutral-400">•</span>
                <span>BN: {company.businessNumber || 'Set BN'}</span>
                <span className="text-neutral-400">•</span>
                <span className="font-semibold text-neutral-600">{company.province}</span>
              </button>
            </div>
          </div>

          {/* Controls: Year Selector & Action CTAs */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Tax Year Filter */}
            <div className="flex items-center bg-neutral-100 p-1 rounded-lg border border-neutral-200 text-xs font-medium">
              <span className="px-2 text-neutral-500 font-medium hidden sm:inline">Tax Year:</span>
              <button
                type="button"
                onClick={() => onYearChange('all')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  selectedYear === 'all'
                    ? 'bg-white text-neutral-900 font-semibold shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                All
              </button>
              {availableYears.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => onYearChange(year)}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    selectedYear === year
                      ? 'bg-white text-neutral-900 font-semibold shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>

            {/* Quick Export & Print Actions */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                id="btn-print-report"
                onClick={onPrintReport}
                className="p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition-colors"
                title="Print CRA Tax Schedule / Save as PDF"
              >
                <Printer className="w-4 h-4" />
              </button>
              <button
                type="button"
                id="btn-export-csv"
                onClick={onExportCsv}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-50 rounded-lg border border-neutral-300 transition-colors shadow-xs"
                title="Download CSV for Accountant"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export CSV</span>
              </button>

              {/* Clear All Expenses button */}
              {hasExpenses && (
                <button
                  type="button"
                  id="btn-clear-expenses"
                  onClick={onClearAllExpenses}
                  className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-neutral-200 transition-colors"
                  title="Clear all expense records (Start clean)"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Save to Google Drive CTA */}
            <button
              type="button"
              id="btn-header-save-google-drive"
              onClick={onSaveToGoogleDrive}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors shadow-xs cursor-pointer"
              title="Save expense report, CRA T2 summary, and receipts to Google Drive /taxes folder"
            >
              <Cloud className="w-3.5 h-3.5 text-blue-600" />
              <span>Save to Drive</span>
            </button>

            {/* Send to Accountant Modal CTA */}
            <button
              type="button"
              id="btn-send-accountant"
              onClick={onOpenAccountantModal}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Send to Accountant</span>
              <span className="sm:hidden">Accountant</span>
            </button>

            {/* User Profile / Team Access Pill */}
            {currentUser ? (
              <button
                type="button"
                id="btn-team-access-header"
                onClick={onOpenTeamModal}
                className="flex items-center gap-2 px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200/80 border border-neutral-200 rounded-lg transition-colors cursor-pointer text-left"
                title="Manage Team & Access Permissions"
              >
                <div className="w-6 h-6 rounded-full bg-neutral-800 text-white font-bold flex items-center justify-center text-[10px] shrink-0">
                  {currentUser.name
                    ? currentUser.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()
                    : 'AU'}
                </div>
                <div className="hidden lg:block text-left leading-tight">
                  <div className="text-[11px] font-bold text-neutral-800 truncate max-w-[140px]">
                    {currentUser.name || 'Authorized User'}
                  </div>
                  <div className="text-[9px] font-semibold text-emerald-700 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    <span>{currentUser.role === 'owner' ? 'Owner' : 'Authorized'}</span>
                  </div>
                </div>
                <Users className="w-3.5 h-3.5 text-neutral-500 shrink-0 hidden sm:block" />
              </button>
            ) : (
              <button
                type="button"
                id="btn-login-header"
                onClick={onOpenLogin}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg border border-neutral-300 transition-colors cursor-pointer"
                title="Log in with Google / Authorized Account"
              >
                <LogIn className="w-3.5 h-3.5 text-neutral-600" />
                <span>Log In</span>
              </button>
            )}

            {/* Add Expense Button */}
            <button
              type="button"
              id="btn-add-expense"
              onClick={onAddExpense}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Expense</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
