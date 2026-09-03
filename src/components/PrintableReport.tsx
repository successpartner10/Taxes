import React from 'react';
import { BusinessExpense, CompanyProfile } from '../types';
import { CRA_CATEGORIES, PROVINCES } from '../constants/canadianTax';
import { formatCad, formatDate } from '../utils/taxCalculators';

interface PrintableReportProps {
  expenses: BusinessExpense[];
  company: CompanyProfile;
  selectedYear: number | 'all';
}

export const PrintableReport: React.FC<PrintableReportProps> = ({
  expenses,
  company,
  selectedYear,
}) => {
  const totalGross = expenses.reduce((s, e) => s + e.amountCad, 0);
  const totalNet = expenses.reduce((s, e) => s + e.netAmount, 0);
  const totalGstHst = expenses.reduce((s, e) => s + e.gstHstAmount, 0);
  const totalDeductible = expenses.reduce((s, e) => s + e.deductibleAmountCad, 0);
  const directorLoans = expenses.filter((e) => e.isDirectorLoan).reduce((s, e) => s + e.amountCad, 0);

  // Group by CRA line
  const categoryTotals: Record<string, { code: string; line: string; name: string; gross: number; deductible: number; count: number }> = {};
  for (const exp of expenses) {
    const cat = CRA_CATEGORIES[exp.craCategory];
    const key = exp.craCategory;
    if (!categoryTotals[key]) {
      categoryTotals[key] = {
        code: key,
        line: cat?.line || key,
        name: cat?.name || 'Other',
        gross: 0,
        deductible: 0,
        count: 0,
      };
    }
    categoryTotals[key].gross += exp.amountCad;
    categoryTotals[key].deductible += exp.deductibleAmountCad;
    categoryTotals[key].count += 1;
  }

  const prov = PROVINCES[company.province] || PROVINCES.ON;

  return (
    <div id="cra-printable-report" className="hidden print:block p-8 bg-white text-neutral-900 font-sans text-xs">
      
      {/* Formal Canadian Corporate Header */}
      <div className="border-b-2 border-neutral-900 pb-4 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-[10px] font-bold text-red-700 tracking-widest uppercase">
              CANADA REVENUE AGENCY (CRA) • CORPORATE TAX & ITC SCHEDULE
            </div>
            <h1 className="text-xl font-bold text-neutral-900 mt-1">
              {company.legalName}
            </h1>
            {company.operatingName && (
              <p className="text-xs text-neutral-600">Operating as: {company.operatingName}</p>
            )}
            <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs">
              <div>
                <span className="font-semibold text-neutral-600">CRA Business Number: </span>
                <span className="font-mono font-bold">{company.businessNumber || 'Pending'}</span>
              </div>
              <div>
                <span className="font-semibold text-neutral-600">GST/HST Account #: </span>
                <span className="font-mono font-bold">{company.gstHstNumber || 'Exempt / Unregistered'}</span>
              </div>
              <div>
                <span className="font-semibold text-neutral-600">Jurisdiction: </span>
                <span>{prov.name} ({company.province})</span>
              </div>
              <div>
                <span className="font-semibold text-neutral-600">Tax Year / Period: </span>
                <span className="font-bold">{selectedYear === 'all' ? 'All Fiscal Years' : `FY ${selectedYear}`}</span>
              </div>
            </div>
          </div>
          
          <div className="text-right">
            <div className="inline-block border border-neutral-300 rounded px-3 py-1.5 text-right bg-neutral-50">
              <span className="block text-[10px] uppercase font-bold text-neutral-500">Report Date</span>
              <span className="font-mono font-semibold">{new Date().toISOString().split('T')[0]}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary KPI Block */}
      <div className="mb-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2 border-b border-neutral-200 pb-1">
          1. Tax Expense & ITC Summary (CAD)
        </h2>
        <table className="w-full text-xs border border-neutral-300">
          <thead className="bg-neutral-100 text-neutral-700 font-semibold border-b border-neutral-300">
            <tr>
              <th className="p-2 text-left">Total Gross Paid</th>
              <th className="p-2 text-left">Net Before Tax</th>
              <th className="p-2 text-left">GST/HST Paid (Line 108 ITC)</th>
              <th className="p-2 text-left">CRA Tax Deductible (T2 / T2125)</th>
              <th className="p-2 text-left">Director Reimbursements</th>
            </tr>
          </thead>
          <tbody>
            <tr className="font-bold text-sm">
              <td className="p-2 border-r border-neutral-200">{formatCad(totalGross)}</td>
              <td className="p-2 border-r border-neutral-200">{formatCad(totalNet)}</td>
              <td className="p-2 border-r border-neutral-200 text-blue-900">{formatCad(totalGstHst)}</td>
              <td className="p-2 border-r border-neutral-200 text-emerald-900">{formatCad(totalDeductible)}</td>
              <td className="p-2 text-purple-950">{formatCad(directorLoans)}</td>
            </tr>
          </tbody>
        </table>
        <p className="text-[10px] text-neutral-500 mt-1.5 italic">
          *Note: Meals & entertainment expenses (Line 8523) are automatically calculated at the statutory 50% limit pursuant to ITA subsection 67.1(1).
        </p>
      </div>

      {/* CRA Category GIFI Schedule */}
      <div className="mb-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2 border-b border-neutral-200 pb-1">
          2. GIFI / T2 Schedule 125 Expense Breakdown
        </h2>
        <table className="w-full text-xs border border-neutral-300">
          <thead className="bg-neutral-100 text-neutral-700 font-semibold border-b border-neutral-300">
            <tr>
              <th className="p-2 text-left">CRA Code</th>
              <th className="p-2 text-left">GIFI Description</th>
              <th className="p-2 text-center">Items</th>
              <th className="p-2 text-right">Gross Paid (CAD)</th>
              <th className="p-2 text-right">Tax Deductible (CAD)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {Object.entries(categoryTotals)
              .sort((a, b) => b[1].gross - a[1].gross)
              .map(([code, item]) => (
                <tr key={code}>
                  <td className="p-2 font-mono font-semibold">{item.line}</td>
                  <td className="p-2">
                    {item.name}
                    {code === '8523' && <span className="ml-1 text-[10px] text-amber-700 font-semibold">(50% limitation applied)</span>}
                  </td>
                  <td className="p-2 text-center">{item.count}</td>
                  <td className="p-2 text-right font-semibold">{formatCad(item.gross)}</td>
                  <td className="p-2 text-right font-bold">{formatCad(item.deductible)}</td>
                </tr>
              ))}
          </tbody>
          <tfoot className="bg-neutral-100 font-bold border-t-2 border-neutral-900">
            <tr>
              <td colSpan={2} className="p-2">TOTAL</td>
              <td className="p-2 text-center">{expenses.length}</td>
              <td className="p-2 text-right">{formatCad(totalGross)}</td>
              <td className="p-2 text-right">{formatCad(totalDeductible)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Itemized Ledger */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2 border-b border-neutral-200 pb-1">
          3. Complete Itemized Transaction Ledger
        </h2>
        <table className="w-full text-[11px] border border-neutral-300">
          <thead className="bg-neutral-100 text-neutral-700 font-semibold border-b border-neutral-300">
            <tr>
              <th className="p-1.5 text-left">Date</th>
              <th className="p-1.5 text-left">Company Paid (Vendor)</th>
              <th className="p-1.5 text-left">CRA Line</th>
              <th className="p-1.5 text-right">Gross CAD</th>
              <th className="p-1.5 text-right">GST/HST (ITC)</th>
              <th className="p-1.5 text-right">Deductible</th>
              <th className="p-1.5 text-left">Method</th>
              <th className="p-1.5 text-left">Business Purpose / Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {expenses.map((exp) => (
              <tr key={exp.id}>
                <td className="p-1.5 font-mono whitespace-nowrap">{formatDate(exp.date)}</td>
                <td className="p-1.5 font-semibold">
                  {exp.companyPaid}
                  {exp.isDirectorLoan && <span className="ml-1 text-[9px] text-purple-700 font-normal">[Director Loan]</span>}
                </td>
                <td className="p-1.5 font-mono">{CRA_CATEGORIES[exp.craCategory]?.line || exp.craCategory}</td>
                <td className="p-1.5 text-right font-semibold">{formatCad(exp.amountCad)}</td>
                <td className="p-1.5 text-right">{formatCad(exp.gstHstAmount)}</td>
                <td className="p-1.5 text-right font-bold">{formatCad(exp.deductibleAmountCad)}</td>
                <td className="p-1.5 capitalize">{exp.paymentMethod.replace(/_/g, ' ')}</td>
                <td className="p-1.5 text-neutral-600 max-w-xs">{exp.notes || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sign-off footer */}
      <div className="mt-8 pt-6 border-t border-neutral-300 flex justify-between items-end text-[10px] text-neutral-600">
        <div>
          <p>Prepared for Canadian Corporate Tax Filing (T2) / Sole Proprietorship (T2125).</p>
          <p>Retain supporting original invoices/receipts for six (6) years per CRA audit regulations.</p>
        </div>
        <div className="text-right space-y-4">
          <div className="w-48 border-b border-neutral-400 pb-1 text-center font-mono">
            Authorized Signature
          </div>
          <p>Date: ________________________</p>
        </div>
      </div>

    </div>
  );
};
