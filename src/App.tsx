import React, { useState, useEffect, useMemo } from 'react';
import { BusinessExpense, CompanyProfile, AppUser, ExtractedReceiptData, CanadianProvince, CraCategoryCode } from './types';
import { DEFAULT_COMPANY_PROFILE, INITIAL_EXPENSES } from './constants/canadianTax';
import { Header } from './components/Header';
import { QuickAddExpenseBar } from './components/QuickAddExpenseBar';
import { TaxSummaryCards } from './components/TaxSummaryCards';
import { ExpenseList } from './components/ExpenseList';
import { ExpenseFormModal } from './components/ExpenseFormModal';
import { AccountantExportModal } from './components/AccountantExportModal';
import { CompanyProfileModal } from './components/CompanyProfileModal';
import { MonthlyExpenseChart } from './components/MonthlyExpenseChart';
import { ReceiptCameraCaptureModal } from './components/ReceiptCameraCaptureModal';
import { GoogleDriveSyncModal } from './components/GoogleDriveSyncModal';
import { PrintableReport } from './components/PrintableReport';
import { LoginScreen } from './components/LoginScreen';
import { TeamAccessModal } from './components/TeamAccessModal';
import { getActiveUser, setActiveUser, quickSignIn } from './services/authService';
import { exportToCraCsv, calculateTaxBreakdown, calculateDeductibleAmount } from './utils/taxCalculators';
import { ShieldCheck } from 'lucide-react';

const EXPENSES_STORAGE_KEY = 'canadian_company_expenses_v1';
const PROFILE_STORAGE_KEY = 'canadian_company_profile_v1';
const DUMMY_CLEARED_FLAG = 'cra_dummy_cleared_user_requested_v1';

export default function App() {
  // Load expenses from localStorage or default (ensuring dummy data is cleared)
  const [expenses, setExpenses] = useState<BusinessExpense[]>(() => {
    try {
      // Auto-clear dummy data on user request
      const alreadyCleared = localStorage.getItem(DUMMY_CLEARED_FLAG);
      if (!alreadyCleared) {
        localStorage.setItem(DUMMY_CLEARED_FLAG, 'true');
        localStorage.removeItem(EXPENSES_STORAGE_KEY);
        return [];
      }

      const saved = localStorage.getItem(EXPENSES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // If the stored data is only dummy items (exp-1 to exp-10), wipe it clean
        if (
          Array.isArray(parsed) &&
          parsed.length > 0 &&
          parsed.every((item: any) => typeof item.id === 'string' && item.id.match(/^exp-[1-9]$|^exp-10$/))
        ) {
          localStorage.removeItem(EXPENSES_STORAGE_KEY);
          return [];
        }
        return parsed;
      }
    } catch (err) {
      console.error('Failed to load expenses from localStorage', err);
    }
    return INITIAL_EXPENSES;
  });

  // Load company profile from localStorage or default
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(() => {
    try {
      const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (err) {
      console.error('Failed to load profile from localStorage', err);
    }
    return DEFAULT_COMPANY_PROFILE;
  });

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(expenses));
    } catch (err) {
      console.error('Failed to save expenses to localStorage', err);
    }
  }, [expenses]);

  useEffect(() => {
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(companyProfile));
    } catch (err) {
      console.error('Failed to save company profile to localStorage', err);
    }
  }, [companyProfile]);

  // Tax year filter
  const [selectedYear, setSelectedYear] = useState<number | 'all'>(2026);

  // Authentication & Access Control
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => getActiveUser());
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<BusinessExpense | null>(null);
  const [isAccountantModalOpen, setIsAccountantModalOpen] = useState(false);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isDriveSyncOpen, setIsDriveSyncOpen] = useState(false);

  // Camera capture states
  const [snapCameraTargetExpense, setSnapCameraTargetExpense] = useState<BusinessExpense | null>(null);
  const [isQuickCameraModalOpen, setIsQuickCameraModalOpen] = useState(false);

  const handleLogout = () => {
    setActiveUser(null);
    setCurrentUser(null);
  };

  const handleSwitchUser = (email: string) => {
    const user = quickSignIn(email);
    setCurrentUser(user);
  };

  // Handlers for Camera Receipt Capture
  const handleOpenSnapForExpense = (expense: BusinessExpense) => {
    setSnapCameraTargetExpense(expense);
  };

  const handleCaptureForExistingExpense = (
    dataUri: string,
    fileName: string,
    extractedData?: ExtractedReceiptData
  ) => {
    if (snapCameraTargetExpense) {
      setExpenses((prev) =>
        prev.map((item) =>
          item.id === snapCameraTargetExpense.id
            ? {
                ...item,
                hasReceipt: true,
                receiptDataUrl: dataUri,
                receiptFileName: fileName,
                ...(extractedData?.vendor && (!item.companyPaid || item.companyPaid.trim() === '')
                  ? { companyPaid: extractedData.vendor }
                  : {}),
                ...(extractedData?.invoiceNumber && !item.invoiceNumber
                  ? { invoiceNumber: extractedData.invoiceNumber }
                  : {}),
              }
            : item
        )
      );
      setSnapCameraTargetExpense(null);
    }
  };

  const handleCaptureForNewExpense = (
    dataUri: string,
    fileName: string,
    extractedData?: ExtractedReceiptData
  ) => {
    const rawTotal = extractedData?.totalAmountCad || 0;
    const expenseDate = extractedData?.date || new Date().toISOString().split('T')[0];
    const category: CraCategoryCode = (extractedData?.craCategory as CraCategoryCode) || '8810';
    const expenseProvince: CanadianProvince =
      (extractedData?.province as CanadianProvince) || companyProfile.province || 'ON';

    const customGst = extractedData?.gstHstAmount ?? 0;
    const customPst = extractedData?.pstQstAmount ?? 0;
    const taxTreatment = customGst > 0 ? 'custom' : 'standard';

    const { netAmount, gstHstAmount, pstQstAmount } = calculateTaxBreakdown(
      rawTotal,
      expenseProvince,
      taxTreatment,
      customGst,
      customPst
    );

    const { deductibleAmount, percentage } = calculateDeductibleAmount(
      netAmount,
      category
    );

    setExpenseToEdit({
      id: '',
      companyPaid: extractedData?.vendor || '',
      amountCad: rawTotal,
      date: expenseDate,
      craCategory: category,
      province: expenseProvince,
      taxTreatment,
      gstHstAmount,
      pstQstAmount,
      netAmount,
      deductiblePercentage: percentage,
      deductibleAmountCad: deductibleAmount,
      paymentMethod: 'corporate_credit_card',
      hasReceipt: true,
      receiptFileName: fileName,
      receiptDataUrl: dataUri,
      invoiceNumber: extractedData?.invoiceNumber || '',
      notes: extractedData?.rawSummary || '',
      fiscalYear: parseInt(expenseDate.split('-')[0], 10) || new Date().getFullYear(),
      createdAt: new Date().toISOString(),
    });
    setIsQuickCameraModalOpen(false);
    setIsFormModalOpen(true);
  };

  // Compute available years
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    yearsSet.add(new Date().getFullYear());
    expenses.forEach((e) => {
      if (e.fiscalYear) yearsSet.add(e.fiscalYear);
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [expenses]);

  // Filtered expenses by year
  const activeYearExpenses = useMemo(() => {
    if (selectedYear === 'all') return expenses;
    return expenses.filter((e) => e.fiscalYear === selectedYear);
  }, [expenses, selectedYear]);

  // Handlers
  const handleSaveExpense = (
    expenseData: Omit<BusinessExpense, 'id' | 'createdAt'>,
    idToUpdate?: string
  ) => {
    if (idToUpdate) {
      setExpenses((prev) =>
        prev.map((item) =>
          item.id === idToUpdate
            ? { ...expenseData, id: idToUpdate, createdAt: item.createdAt }
            : item
        )
      );
    } else {
      const newExpense: BusinessExpense = {
        ...expenseData,
        id: `exp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        createdAt: new Date().toISOString(),
      };
      setExpenses((prev) => [newExpense, ...prev]);
    }
  };

  const handleQuickAddExpense = (expenseData: Omit<BusinessExpense, 'id' | 'createdAt'>) => {
    const newExpense: BusinessExpense = {
      ...expenseData,
      id: `exp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    setExpenses((prev) => [newExpense, ...prev]);
  };

  const handleDeleteExpense = (id: string) => {
    if (window.confirm('Are you sure you want to delete this business expense?')) {
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    }
  };

  const handleDuplicateExpense = (expense: BusinessExpense) => {
    const duplicated: BusinessExpense = {
      ...expense,
      id: `exp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      notes: expense.notes ? `${expense.notes} (Copy)` : 'Copy',
    };
    setExpenses((prev) => [duplicated, ...prev]);
  };

  const handleEditExpense = (expense: BusinessExpense) => {
    setExpenseToEdit(expense);
    setIsFormModalOpen(true);
  };

  const handleAddClick = () => {
    setExpenseToEdit(null);
    setIsFormModalOpen(true);
  };

  const handleExportCsv = () => {
    exportToCraCsv(activeYearExpenses, companyProfile, selectedYear);
  };

  const handlePrintReport = () => {
    window.print();
  };

  const handleClearAllExpenses = () => {
    if (window.confirm('Clear all expense records from your ledger? You will have a completely clean slate.')) {
      setExpenses([]);
      localStorage.removeItem(EXPENSES_STORAGE_KEY);
    }
  };

  // Strict login gate: User must log in to view or add expenses
  if (!currentUser) {
    return (
      <LoginScreen
        onLoginSuccess={(user) => {
          setCurrentUser(user);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 flex flex-col font-sans">
      
      {/* Header with CRA context, Company details, Year switcher, & CTAs */}
      <Header
        company={companyProfile}
        selectedYear={selectedYear}
        availableYears={availableYears}
        hasExpenses={expenses.length > 0}
        currentUser={currentUser}
        onYearChange={setSelectedYear}
        onAddExpense={handleAddClick}
        onOpenAccountantModal={() => setIsAccountantModalOpen(true)}
        onOpenCompanyModal={() => setIsCompanyModalOpen(true)}
        onExportCsv={handleExportCsv}
        onPrintReport={handlePrintReport}
        onSaveToGoogleDrive={() => setIsDriveSyncOpen(true)}
        onClearAllExpenses={handleClearAllExpenses}
        onOpenTeamModal={() => setIsTeamModalOpen(true)}
        onOpenLogin={() => setIsLoginModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 print:hidden">
        
        {/* Quick Input Bar: Vendor Name & Amount Paid */}
        <QuickAddExpenseBar
          companyProfile={companyProfile}
          onAddQuickExpense={handleQuickAddExpense}
          onOpenDetailedModal={handleAddClick}
          onSnapReceiptPhoto={() => setIsQuickCameraModalOpen(true)}
        />

        {/* Canadian Tax Summary Metric Cards */}
        <TaxSummaryCards
          expenses={activeYearExpenses}
          selectedYear={selectedYear}
        />

        {/* Monthly Expense & Tax Credit Chart */}
        <MonthlyExpenseChart
          expenses={activeYearExpenses}
          selectedYear={selectedYear}
        />

        {/* Expense List, Search, Filters & Actions */}
        <ExpenseList
          expenses={activeYearExpenses}
          onEdit={handleEditExpense}
          onDelete={handleDeleteExpense}
          onDuplicate={handleDuplicateExpense}
          onAddClick={handleAddClick}
          onSnapReceipt={handleOpenSnapForExpense}
        />

        {/* CRA Guidance & Accountant Tips Box */}
        <div className="mt-8 bg-white rounded-2xl border border-neutral-200 p-5 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-red-50 text-red-700 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="flex-1 text-xs">
              <h3 className="font-bold text-neutral-900 text-sm">
                Canadian Tax & CRA Compliance Guidance
              </h3>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-4 text-neutral-600">
                <div className="space-y-1">
                  <span className="font-semibold text-neutral-800 block">
                    1. CRA 50% Meals Limitation
                  </span>
                  <p>
                    Line 8523 expenses for client dining and coffee are capped at 50% deductibility by the CRA. This tracker automatically calculates the adjustment for your accountant.
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="font-semibold text-neutral-800 block">
                    2. GST/HST Input Tax Credits (ITCs)
                  </span>
                  <p>
                    The sales tax paid on business expenses reduces your net GST/HST remittance on Line 108. All provincial rates (ON 13%, BC 5%, QC 5%, etc.) are tracked.
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="font-semibold text-neutral-800 block">
                    3. Ready for Taxprep, Xero & QuickBooks
                  </span>
                  <p>
                    Export your GIFI-coded CSV or send the email summary directly to your CPA with pre-calculated T2 corporate schedules.
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-2 text-neutral-500 text-[11px]">
                <span>
                  Retain digital copies of receipts for 6 years in accordance with CRA audit requirements.
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsDriveSyncOpen(true)}
                    className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 underline"
                  >
                    Save records to Google Drive /taxes
                  </button>
                  {expenses.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllExpenses}
                      className="text-neutral-400 hover:text-red-600 underline"
                    >
                      Clear All Expenses
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-neutral-200 py-4 text-center text-xs text-neutral-500 print:hidden">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-medium">
            <span>🇨🇦 Designed for Canadian Corporations (T2) & Sole Proprietorships (T2125)</span>
          </div>
          <div className="flex items-center gap-4 text-neutral-500">
            <span>Auto-saves locally</span>
            <span>•</span>
            <button
              type="button"
              onClick={() => setIsAccountantModalOpen(true)}
              className="text-indigo-600 hover:underline font-medium"
            >
              Accountant Tax Export
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <ExpenseFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setExpenseToEdit(null);
        }}
        onSave={handleSaveExpense}
        expenseToEdit={expenseToEdit}
        companyProfile={companyProfile}
      />

      <AccountantExportModal
        isOpen={isAccountantModalOpen}
        onClose={() => setIsAccountantModalOpen(false)}
        expenses={activeYearExpenses}
        company={companyProfile}
        selectedYear={selectedYear}
        onPrint={handlePrintReport}
        onSaveToDrive={() => {
          setIsAccountantModalOpen(false);
          setIsDriveSyncOpen(true);
        }}
      />

      <CompanyProfileModal
        isOpen={isCompanyModalOpen}
        onClose={() => setIsCompanyModalOpen(false)}
        profile={companyProfile}
        onSave={(updated) => setCompanyProfile(updated)}
      />

      {/* Google Drive Save & Cloud Sync Modal */}
      <GoogleDriveSyncModal
        isOpen={isDriveSyncOpen}
        onClose={() => setIsDriveSyncOpen(false)}
        expenses={activeYearExpenses}
        allExpenses={expenses}
        company={companyProfile}
        selectedYear={selectedYear}
      />

      {/* Team Access & Allowed Users Modal */}
      <TeamAccessModal
        isOpen={isTeamModalOpen}
        onClose={() => setIsTeamModalOpen(false)}
        currentUser={currentUser}
        onLogout={handleLogout}
        onSwitchUser={handleSwitchUser}
      />

      {/* Standalone Login Modal when triggered from Header */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="relative max-w-md w-full">
            <button
              type="button"
              onClick={() => setIsLoginModalOpen(false)}
              className="absolute top-4 right-4 z-10 p-1.5 bg-white/80 hover:bg-white text-neutral-600 rounded-full shadow-md cursor-pointer"
            >
              ✕
            </button>
            <LoginScreen
              onLoginSuccess={(user) => {
                setCurrentUser(user);
                setIsLoginModalOpen(false);
              }}
            />
          </div>
        </div>
      )}

      {/* CRA Printable Report Component (hidden in web view, rendered for window.print()) */}
      <PrintableReport
        expenses={activeYearExpenses}
        company={companyProfile}
        selectedYear={selectedYear}
      />

      {/* Camera Capture Modal for existing expense in list */}
      <ReceiptCameraCaptureModal
        isOpen={!!snapCameraTargetExpense}
        onClose={() => setSnapCameraTargetExpense(null)}
        onCapture={handleCaptureForExistingExpense}
        companyName={snapCameraTargetExpense?.companyPaid}
      />

      {/* Camera Capture Modal for new receipt snapshot */}
      <ReceiptCameraCaptureModal
        isOpen={isQuickCameraModalOpen}
        onClose={() => setIsQuickCameraModalOpen(false)}
        onCapture={handleCaptureForNewExpense}
        companyName=""
      />

    </div>
  );
}
