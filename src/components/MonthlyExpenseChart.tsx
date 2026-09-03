import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from 'recharts';
import { BusinessExpense } from '../types';
import { formatCad } from '../utils/taxCalculators';
import { CRA_CATEGORIES } from '../constants/canadianTax';
import { BarChart3, TrendingUp, DollarSign, Calendar, Layers, ChevronDown, ChevronUp } from 'lucide-react';

interface MonthlyExpenseChartProps {
  expenses: BusinessExpense[];
  selectedYear: number | 'all';
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

type ChartViewType = 'comparison' | 'gst_itc' | 'categories';

export const MonthlyExpenseChart: React.FC<MonthlyExpenseChartProps> = ({
  expenses,
  selectedYear,
}) => {
  const [viewType, setChartViewType] = useState<ChartViewType>('comparison');
  const [isExpanded, setIsExpanded] = useState(true);

  // Group expenses by month (0-11)
  const monthlyData = useMemo(() => {
    // Initialize 12 months
    const months = MONTH_NAMES.map((name, index) => ({
      monthIndex: index,
      month: name,
      gross: 0,
      deductible: 0,
      gstHst: 0,
      count: 0,
      // Categories breakdown
      software: 0,
      office: 0,
      meals: 0,
      professional: 0,
      telecom: 0,
      travel: 0,
      rent: 0,
      other: 0,
    }));

    expenses.forEach((exp) => {
      const expDate = new Date(exp.date);
      if (isNaN(expDate.getTime())) return;
      
      const monthIdx = expDate.getMonth();
      if (monthIdx >= 0 && monthIdx < 12) {
        months[monthIdx].gross += exp.amountCad;
        months[monthIdx].deductible += exp.deductibleAmountCad;
        months[monthIdx].gstHst += exp.gstHstAmount;
        months[monthIdx].count += 1;

        // Categorize for stacked view
        const cat = exp.craCategory;
        if (cat === '8811') {
          months[monthIdx].software += exp.amountCad;
        } else if (cat === '8810') {
          months[monthIdx].office += exp.amountCad;
        } else if (cat === '8523') {
          months[monthIdx].meals += exp.amountCad;
        } else if (cat === '8862' || cat === '8871') {
          months[monthIdx].professional += exp.amountCad;
        } else if (cat === '9220') {
          months[monthIdx].telecom += exp.amountCad;
        } else if (cat === '9200' || cat === '9281') {
          months[monthIdx].travel += exp.amountCad;
        } else if (cat === '8910') {
          months[monthIdx].rent += exp.amountCad;
        } else {
          months[monthIdx].other += exp.amountCad;
        }
      }
    });

    return months;
  }, [expenses]);

  // Key monthly statistics
  const stats = useMemo(() => {
    const activeMonths = monthlyData.filter((m) => m.count > 0);
    const totalGross = monthlyData.reduce((acc, m) => acc + m.gross, 0);
    const totalGstHst = monthlyData.reduce((acc, m) => acc + m.gstHst, 0);
    const totalDeductible = monthlyData.reduce((acc, m) => acc + m.deductible, 0);

    let peakMonth = monthlyData[0];
    monthlyData.forEach((m) => {
      if (m.gross > peakMonth.gross) peakMonth = m;
    });

    const averageMonthly = activeMonths.length > 0 ? totalGross / activeMonths.length : 0;
    const deductibilityRatio = totalGross > 0 ? (totalDeductible / totalGross) * 100 : 100;

    return {
      peakMonthName: peakMonth.gross > 0 ? peakMonth.month : 'N/A',
      peakMonthAmount: peakMonth.gross,
      averageMonthly,
      totalGstHst,
      deductibilityRatio,
      activeMonthsCount: activeMonths.length,
    };
  }, [monthlyData]);

  // Custom chart tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div className="bg-white/95 backdrop-blur-md p-3 rounded-xl border border-neutral-200 shadow-xl text-xs space-y-1.5 min-w-44">
          <div className="font-bold text-neutral-900 border-b border-neutral-100 pb-1 flex justify-between items-center">
            <span>{label} {selectedYear !== 'all' ? selectedYear : ''}</span>
            <span className="text-[10px] font-normal text-neutral-500">{dataPoint.count} expense{dataPoint.count === 1 ? '' : 's'}</span>
          </div>

          {viewType === 'comparison' && (
            <>
              <div className="flex justify-between items-center gap-3">
                <span className="text-neutral-600 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-neutral-900 inline-block" />
                  Gross Paid:
                </span>
                <span className="font-bold text-neutral-900">{formatCad(dataPoint.gross)}</span>
              </div>
              <div className="flex justify-between items-center gap-3">
                <span className="text-neutral-600 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600 inline-block" />
                  CRA Deductible:
                </span>
                <span className="font-bold text-emerald-700">{formatCad(dataPoint.deductible)}</span>
              </div>
              <div className="flex justify-between items-center gap-3">
                <span className="text-neutral-600 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" />
                  GST/HST Claimable:
                </span>
                <span className="font-bold text-blue-700">{formatCad(dataPoint.gstHst)}</span>
              </div>
            </>
          )}

          {viewType === 'gst_itc' && (
            <>
              <div className="flex justify-between items-center gap-3">
                <span className="text-neutral-600">Claimable ITC (Line 108):</span>
                <span className="font-bold text-blue-700">{formatCad(dataPoint.gstHst)}</span>
              </div>
              <div className="flex justify-between items-center gap-3 text-[11px]">
                <span className="text-neutral-500">Gross Spend:</span>
                <span className="text-neutral-700">{formatCad(dataPoint.gross)}</span>
              </div>
            </>
          )}

          {viewType === 'categories' && (
            <div className="space-y-1 pt-0.5">
              {dataPoint.software > 0 && (
                <div className="flex justify-between items-center gap-2">
                  <span className="text-indigo-700 font-medium">Software / Cloud:</span>
                  <span className="font-semibold">{formatCad(dataPoint.software)}</span>
                </div>
              )}
              {dataPoint.office > 0 && (
                <div className="flex justify-between items-center gap-2">
                  <span className="text-emerald-700 font-medium">Office Supplies:</span>
                  <span className="font-semibold">{formatCad(dataPoint.office)}</span>
                </div>
              )}
              {dataPoint.meals > 0 && (
                <div className="flex justify-between items-center gap-2">
                  <span className="text-amber-700 font-medium">Meals & Ent:</span>
                  <span className="font-semibold">{formatCad(dataPoint.meals)}</span>
                </div>
              )}
              {dataPoint.professional > 0 && (
                <div className="flex justify-between items-center gap-2">
                  <span className="text-purple-700 font-medium">Legal & Accounting:</span>
                  <span className="font-semibold">{formatCad(dataPoint.professional)}</span>
                </div>
              )}
              {dataPoint.telecom > 0 && (
                <div className="flex justify-between items-center gap-2">
                  <span className="text-cyan-700 font-medium">Utilities / Telecom:</span>
                  <span className="font-semibold">{formatCad(dataPoint.telecom)}</span>
                </div>
              )}
              {dataPoint.other > 0 && (
                <div className="flex justify-between items-center gap-2">
                  <span className="text-neutral-600 font-medium">Other:</span>
                  <span className="font-semibold">{formatCad(dataPoint.other)}</span>
                </div>
              )}
              <div className="border-t border-neutral-100 pt-1 flex justify-between items-center font-bold">
                <span>Month Total:</span>
                <span>{formatCad(dataPoint.gross)}</span>
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs mb-6 overflow-hidden">
      
      {/* Header bar with controls */}
      <div className="p-4 sm:p-5 border-b border-neutral-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <span>Monthly Business Expense & Tax Overview</span>
                <span className="text-[11px] font-semibold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">
                  {selectedYear === 'all' ? 'All Fiscal Years' : `FY ${selectedYear}`}
                </span>
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Monthly trajectory of operating cash outflows, CRA tax deductions, and claimable ITCs
              </p>
            </div>
          </div>
        </div>

        {/* View toggles & collapse button */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap self-end md:self-auto">
          <div className="inline-flex rounded-xl bg-neutral-100 p-1 text-xs">
            <button
              type="button"
              onClick={() => setChartViewType('comparison')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                viewType === 'comparison'
                  ? 'bg-white text-neutral-900 shadow-xs font-semibold'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Gross vs Deductible
            </button>
            <button
              type="button"
              onClick={() => setChartViewType('gst_itc')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                viewType === 'gst_itc'
                  ? 'bg-white text-neutral-900 shadow-xs font-semibold'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              GST/HST Credits
            </button>
            <button
              type="button"
              onClick={() => setChartViewType('categories')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                viewType === 'categories'
                  ? 'bg-white text-neutral-900 shadow-xs font-semibold'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              By CRA Category
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-xl transition-colors"
            title={isExpanded ? 'Collapse Monthly Chart' : 'Expand Monthly Chart'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 sm:p-5">
          {/* Key Quick Monthly Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200">
              <span className="text-[11px] font-semibold text-neutral-500 uppercase">Peak Month</span>
              <div className="text-sm font-bold text-neutral-900 mt-0.5">
                {stats.peakMonthName}
                {stats.peakMonthAmount > 0 && (
                  <span className="text-xs font-medium text-neutral-600 ml-1.5">
                    ({formatCad(stats.peakMonthAmount)})
                  </span>
                )}
              </div>
            </div>

            <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200">
              <span className="text-[11px] font-semibold text-neutral-500 uppercase">Active Monthly Avg</span>
              <div className="text-sm font-bold text-neutral-900 mt-0.5">
                {formatCad(stats.averageMonthly)}
              </div>
            </div>

            <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-200">
              <span className="text-[11px] font-semibold text-blue-700 uppercase">Yearly GST/HST ITCs</span>
              <div className="text-sm font-bold text-blue-900 mt-0.5">
                {formatCad(stats.totalGstHst)}
              </div>
            </div>

            <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200">
              <span className="text-[11px] font-semibold text-emerald-700 uppercase">CRA Deductibility</span>
              <div className="text-sm font-bold text-emerald-900 mt-0.5">
                {stats.deductibilityRatio.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Recharts Canvas */}
          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {viewType === 'comparison' ? (
                <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" />
                  <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: '#E5E5E5' }} tick={{ fill: '#737373', fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={{ stroke: '#E5E5E5' }} tick={{ fill: '#737373', fontSize: 11 }} tickFormatter={(val) => `$${val}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="gross" name="Gross Expense (CAD)" fill="#171717" radius={[4, 4, 0, 0]} maxBarSize={34} />
                  <Bar dataKey="deductible" name="CRA Deductible (CAD)" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={34} />
                </BarChart>
              ) : viewType === 'gst_itc' ? (
                <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" />
                  <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: '#E5E5E5' }} tick={{ fill: '#737373', fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={{ stroke: '#E5E5E5' }} tick={{ fill: '#737373', fontSize: 11 }} tickFormatter={(val) => `$${val}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="gstHst" name="Claimable GST/HST (Line 108)" fill="#2563EB" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              ) : (
                <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" />
                  <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: '#E5E5E5' }} tick={{ fill: '#737373', fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={{ stroke: '#E5E5E5' }} tick={{ fill: '#737373', fontSize: 11 }} tickFormatter={(val) => `$${val}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="software" stackId="a" name="Software/Cloud" fill="#4F46E5" />
                  <Bar dataKey="office" stackId="a" name="Office Supplies" fill="#059669" />
                  <Bar dataKey="meals" stackId="a" name="Meals (50%)" fill="#D97706" />
                  <Bar dataKey="professional" stackId="a" name="Legal & CPA" fill="#9333EA" />
                  <Bar dataKey="telecom" stackId="a" name="Utilities/Phone" fill="#0891B2" />
                  <Bar dataKey="other" stackId="a" name="Other" fill="#737373" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      )}

    </div>
  );
};
