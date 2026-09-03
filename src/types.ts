export type CanadianProvince =
  | 'ON' // Ontario (13% HST)
  | 'BC' // British Columbia (5% GST + 7% PST)
  | 'AB' // Alberta (5% GST)
  | 'QC' // Quebec (5% GST + 9.975% QST)
  | 'NS' // Nova Scotia (15% HST)
  | 'NB' // New Brunswick (15% HST)
  | 'MB' // Manitoba (5% GST + 7% RST)
  | 'SK' // Saskatchewan (5% GST + 6% PST)
  | 'PE' // Prince Edward Island (15% HST)
  | 'NL' // Newfoundland and Labrador (15% HST)
  | 'YT' // Yukon (5% GST)
  | 'NT' // Northwest Territories (5% GST)
  | 'NU' // Nunavut (5% GST)
  | 'OTHER'; // Foreign / Zero-Rated / Exempt

export interface ProvinceTaxInfo {
  code: CanadianProvince;
  name: string;
  type: 'HST' | 'GST+PST' | 'GST+QST' | 'GST' | 'EXEMPT';
  gstHstRate: number; // For Input Tax Credit (ITC) claiming
  pstQstRate: number; // Provincial tax (usually not an ITC, part of gross expense)
  totalRate: number;
}

export type CraCategoryCode =
  | '8521' // Advertising
  | '8523' // Meals and entertainment (50% deductible)
  | '8590' // Bad debts
  | '8690' // Insurance
  | '8710' // Interest and bank charges
  | '8760' // Business taxes, licences and memberships
  | '8810' // Office expenses & supplies
  | '8811' // Software, IT & Cloud Subscriptions
  | '8862' // Professional fees (legal and accounting)
  | '8871' // Management and admin fees
  | '8910' // Rent
  | '8960' // Repairs and maintenance
  | '9060' // Salaries, wages and subcontracts
  | '9180' // Property taxes
  | '9200' // Travel expenses
  | '9220' // Telephone and utilities
  | '9281' // Motor vehicle expenses
  | '9270'; // Other expenses

export interface CraCategoryInfo {
  code: CraCategoryCode;
  line: string;
  name: string;
  description: string;
  deductiblePercentage: number; // e.g. 50 for meals, 100 for standard
  suggestedKeywords: string[];
}

export type PaymentMethod =
  | 'corporate_credit_card'
  | 'business_bank_account'
  | 'interac_etransfer'
  | 'director_paid' // Shareholder / Director loan out-of-pocket
  | 'cash'
  | 'cheque';

export type TaxTreatment =
  | 'standard' // Auto-calculated GST/HST based on province
  | 'zero_rated' // 0% GST/HST (foreign vendors like US SaaS, Stripe, export)
  | 'exempt' // Financial services, interest, etc.
  | 'custom'; // Custom tax input

export interface BusinessExpense {
  id: string;
  companyPaid: string; // The vendor / company paid (e.g. "Rogers Communications", "Amazon", "Tim Hortons")
  amountCad: number; // Total gross amount paid in CAD
  date: string; // YYYY-MM-DD
  craCategory: CraCategoryCode;
  province: CanadianProvince;
  taxTreatment: TaxTreatment;
  gstHstAmount: number; // Input Tax Credit (ITC) claimable from CRA
  pstQstAmount: number; // Provincial sales tax if applicable
  netAmount: number; // Amount before taxes
  deductiblePercentage: number; // 100 or 50 (meals)
  deductibleAmountCad: number; // Amount deductible for corporate tax after 50% meal limit
  paymentMethod: PaymentMethod;
  hasReceipt: boolean;
  receiptFileName?: string;
  receiptDataUrl?: string; // base64 preview if uploaded
  notes?: string; // Business purpose (required/encouraged by CRA during audit)
  invoiceNumber?: string;
  fiscalYear: number;
  isDirectorLoan: boolean; // Flag to track personal funds used for company
  createdAt: string;
}

export interface CompanyProfile {
  legalName: string;
  operatingName?: string;
  businessNumber: string; // CRA 9-digit BN + RC0001 e.g. 123456789 RC0001
  gstHstNumber?: string; // e.g. 123456789 RT0001
  province: CanadianProvince;
  isGstRegistered: boolean;
  fiscalYearEndMonth: number; // 12 for December, etc.
  accountantName?: string;
  accountantEmail?: string;
}

export interface ExpenseFilters {
  search: string;
  year: number | 'all';
  category: CraCategoryCode | 'all';
  paymentMethod: PaymentMethod | 'all';
  receiptStatus: 'all' | 'with_receipt' | 'missing_receipt';
}

export interface AppUser {
  email: string;
  name: string;
  picture?: string;
  role: 'owner' | 'authorized_user' | 'team_member' | 'guest';
  lastLogin?: string;
}

export interface AccessControlSettings {
  allowedEmails: string[];
  allowAllAuthenticatedUsers: boolean;
}

export interface ExtractedReceiptData {
  vendor?: string;
  date?: string; // YYYY-MM-DD
  totalAmountCad?: number;
  gstHstAmount?: number;
  pstQstAmount?: number;
  netAmount?: number;
  craCategory?: CraCategoryCode;
  invoiceNumber?: string | null;
  province?: CanadianProvince | null;
  confidence?: 'high' | 'medium' | 'low';
  rawSummary?: string;
}
