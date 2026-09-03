import { CanadianProvince, CraCategoryCode, TaxTreatment, BusinessExpense, CompanyProfile } from '../types';
import { PROVINCES, CRA_CATEGORIES } from '../constants/canadianTax';

export function formatCad(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateString: string): string {
  if (!dateString) return '';
  try {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

/**
 * Calculates net amount, GST/HST (ITC claimable), and PST/QST from total gross CAD
 */
export function calculateTaxBreakdown(
  grossAmount: number,
  province: CanadianProvince,
  taxTreatment: TaxTreatment,
  customGstHst = 0,
  customPstQst = 0
) {
  if (taxTreatment === 'zero_rated' || taxTreatment === 'exempt' || province === 'OTHER') {
    return {
      netAmount: grossAmount,
      gstHstAmount: 0,
      pstQstAmount: 0,
    };
  }

  if (taxTreatment === 'custom') {
    const net = Math.max(0, grossAmount - customGstHst - customPstQst);
    return {
      netAmount: Number(net.toFixed(2)),
      gstHstAmount: Number(customGstHst.toFixed(2)),
      pstQstAmount: Number(customPstQst.toFixed(2)),
    };
  }

  const provInfo = PROVINCES[province] || PROVINCES.ON;
  const totalRate = provInfo.totalRate;

  if (totalRate === 0) {
    return {
      netAmount: grossAmount,
      gstHstAmount: 0,
      pstQstAmount: 0,
    };
  }

  // Calculate net before tax: Net = Gross / (1 + totalRate)
  const netAmount = Number((grossAmount / (1 + totalRate)).toFixed(2));
  const gstHstAmount = Number((netAmount * provInfo.gstHstRate).toFixed(2));
  const pstQstAmount = Number((grossAmount - netAmount - gstHstAmount).toFixed(2));

  return {
    netAmount,
    gstHstAmount,
    pstQstAmount: Math.max(0, pstQstAmount),
  };
}

/**
 * CRA rule: Line 8523 (Meals & Entertainment) is only 50% deductible
 */
export function calculateDeductibleAmount(netAmount: number, category: CraCategoryCode): {
  deductibleAmount: number;
  percentage: number;
} {
  const info = CRA_CATEGORIES[category];
  const percentage = info ? info.deductiblePercentage : 100;
  const deductibleAmount = Number(((netAmount * percentage) / 100).toFixed(2));
  return {
    deductibleAmount,
    percentage,
  };
}

/**
 * Intelligent vendor match to guess category and notes
 */
export function suggestCategoryForVendor(vendorName: string): CraCategoryCode | null {
  const normalized = vendorName.toLowerCase().trim();
  if (!normalized) return null;

  for (const [code, info] of Object.entries(CRA_CATEGORIES)) {
    for (const keyword of info.suggestedKeywords) {
      if (normalized.includes(keyword)) {
        return code as CraCategoryCode;
      }
    }
  }

  return null;
}

/**
 * Generates an official CSV file for Canadian accountants
 */
export function exportToCraCsv(expenses: BusinessExpense[], company: CompanyProfile, year: number | 'all') {
  const headers = [
    'Date',
    'Fiscal Year',
    'Company / Payee Name',
    'CRA Category',
    'CRA Line / GIFI',
    'Gross CAD Paid',
    'Net Before Tax CAD',
    'GST/HST Paid (Claimable ITC)',
    'PST/QST Amount CAD',
    'Tax Treatment',
    'Province',
    'CRA Deductible %',
    'Deductible Amount CAD',
    'Payment Method',
    'Receipt On File',
    'Director / Shareholder Reimbursement',
    'Invoice / Reference #',
    'Business Purpose / CRA Audit Notes',
  ];

  const rows = expenses.map((exp) => {
    const cat = CRA_CATEGORIES[exp.craCategory];
    return [
      `"${exp.date}"`,
      exp.fiscalYear,
      `"${(exp.companyPaid || '').replace(/"/g, '""')}"`,
      `"${cat?.name || exp.craCategory}"`,
      `"${cat?.line || ''}"`,
      exp.amountCad.toFixed(2),
      exp.netAmount.toFixed(2),
      exp.gstHstAmount.toFixed(2),
      exp.pstQstAmount.toFixed(2),
      `"${exp.taxTreatment}"`,
      `"${exp.province}"`,
      `${exp.deductiblePercentage}%`,
      exp.deductibleAmountCad.toFixed(2),
      `"${exp.paymentMethod.replace(/_/g, ' ')}"`,
      exp.hasReceipt ? 'Yes' : 'No',
      exp.isDirectorLoan ? 'Yes (Due to Shareholder)' : 'No',
      `"${(exp.invoiceNumber || '').replace(/"/g, '""')}"`,
      `"${(exp.notes || '').replace(/"/g, '""')}"`,
    ].join(',');
  });

  // Calculate totals
  const totalGross = expenses.reduce((s, e) => s + e.amountCad, 0);
  const totalNet = expenses.reduce((s, e) => s + e.netAmount, 0);
  const totalGstHst = expenses.reduce((s, e) => s + e.gstHstAmount, 0);
  const totalDeductible = expenses.reduce((s, e) => s + e.deductibleAmountCad, 0);

  const summaryRows = [
    '',
    `"--- TOTALS SUMMARY ---",,,,,${totalGross.toFixed(2)},${totalNet.toFixed(2)},${totalGstHst.toFixed(2)},,,,,${totalDeductible.toFixed(2)}`,
    `"Company: ${company.legalName}"`,
    `"CRA Business Number: ${company.businessNumber || 'N/A'}"`,
    `"Tax Year: ${year === 'all' ? 'All Years' : year}"`,
    `"Generated On: ${new Date().toISOString().split('T')[0]}"`,
  ];

  const csvContent = '\uFEFF' + [headers.join(','), ...rows, ...summaryRows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const sanitizedCompany = company.legalName.replace(/[^a-zA-Z0-9]/g, '_');
  link.setAttribute('href', url);
  link.setAttribute('download', `${sanitizedCompany}_Expenses_CRA_${year}_Tax_Package.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format email draft to send to accountant
 */
export function generateAccountantEmail(
  expenses: BusinessExpense[],
  company: CompanyProfile,
  year: number | 'all'
): { subject: string; body: string; mailtoUrl: string } {
  const totalGross = expenses.reduce((s, e) => s + e.amountCad, 0);
  const totalNet = expenses.reduce((s, e) => s + e.netAmount, 0);
  const totalGstHst = expenses.reduce((s, e) => s + e.gstHstAmount, 0);
  const totalDeductible = expenses.reduce((s, e) => s + e.deductibleAmountCad, 0);
  const directorLoans = expenses.filter((e) => e.isDirectorLoan).reduce((s, e) => s + e.amountCad, 0);

  // Category breakdown
  const categoryTotals: Record<string, { count: number; total: number; deductible: number; line: string }> = {};
  for (const exp of expenses) {
    const cat = CRA_CATEGORIES[exp.craCategory];
    const key = cat ? cat.name : exp.craCategory;
    const line = cat ? cat.line : '';
    if (!categoryTotals[key]) {
      categoryTotals[key] = { count: 0, total: 0, deductible: 0, line };
    }
    categoryTotals[key].count += 1;
    categoryTotals[key].total += exp.amountCad;
    categoryTotals[key].deductible += exp.deductibleAmountCad;
  }

  const categoryLines = Object.entries(categoryTotals)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([catName, stats]) => `• ${catName} (${stats.line}): ${formatCad(stats.total)} [Deductible: ${formatCad(stats.deductible)}] (${stats.count} transactions)`)
    .join('\n');

  const subject = `${company.legalName} - FY ${year === 'all' ? 'Annual' : year} Business Expenses & Tax Package`;

  const recipientName = company.accountantName || 'Accountant';

  const body = `Hi ${recipientName},

Here is the business expense ledger and Canadian tax summary for ${company.legalName} for the tax year ${year === 'all' ? 'to date' : year}.

COMPANY TAX DETAILS:
- Legal Entity: ${company.legalName}
- CRA Business Number (BN): ${company.businessNumber || 'Not provided'}
- GST/HST Registration #: ${company.gstHstNumber || 'Not registered / exempt'}
- Registered Province: ${company.province}

EXPENSE & TAX SUMMARY (CAD):
- Total Gross Business Expenses: ${formatCad(totalGross)}
- Total Net Before Tax: ${formatCad(totalNet)}
- Claimable GST/HST (Input Tax Credits - ITCs): ${formatCad(totalGstHst)}
- Net Corporate Tax Deductible (incl. 50% Meals rule): ${formatCad(totalDeductible)}
- Shareholder / Director Out-of-Pocket (Reimbursements): ${formatCad(directorLoans)}
- Total Expense Records: ${expenses.length}

BREAKDOWN BY CRA CATEGORY:
${categoryLines}

*NOTE FOR T2 / T2125 FILING:
Meals and Entertainment (Line 8523) has been calculated at the CRA 50% limitation rule.
Full itemized transaction breakdown is attached in CSV spreadsheet format.

Please let me know if you require original digital receipt copies or further documentation for any specific line item.

Best regards,
${company.legalName}`;

  const mailtoUrl = `mailto:${encodeURIComponent(company.accountantEmail || '')}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;

  return { subject, body, mailtoUrl };
}
