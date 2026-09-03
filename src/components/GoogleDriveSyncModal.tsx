import React, { useState } from 'react';
import {
  X,
  Cloud,
  FolderCheck,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileSpreadsheet,
  FileCode2,
  Image as ImageIcon,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { BusinessExpense, CompanyProfile } from '../types';
import {
  syncTaxesToGoogleDrive,
  DriveSyncProgress,
  DriveUploadItemResult,
} from '../services/googleDriveService';
import { formatCad } from '../utils/taxCalculators';

interface GoogleDriveSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  expenses: BusinessExpense[];
  allExpenses?: BusinessExpense[];
  company: CompanyProfile;
  selectedYear: number | 'all';
}

export const GoogleDriveSyncModal: React.FC<GoogleDriveSyncModalProps> = ({
  isOpen,
  onClose,
  expenses,
  allExpenses = [],
  company,
  selectedYear,
}) => {
  const [syncScope, setSyncScope] = useState<'all' | 'filtered'>('all');
  const [syncState, setSyncState] = useState<DriveSyncProgress>({
    step: 'idle',
    message: '',
    uploadedFiles: [],
  });
  const [isSyncing, setIsSyncing] = useState(false);

  if (!isOpen) return null;

  const targetExpenses = syncScope === 'all' && allExpenses.length > 0 ? allExpenses : expenses;
  const targetYearLabel = syncScope === 'all' ? 'all' : selectedYear;

  const handleStartSync = async () => {
    setIsSyncing(true);
    setSyncState({
      step: 'authorizing',
      message: 'Connecting to your Google Drive account...',
      uploadedFiles: [],
    });

    try {
      const result = await syncTaxesToGoogleDrive(
        targetExpenses,
        company,
        targetYearLabel,
        (progress) => {
          setSyncState({ ...progress });
        }
      );
      setSyncState(result);
    } catch (err: any) {
      setSyncState({
        step: 'error',
        message: err.message || 'Error communicating with Google Drive',
        error: err.message || 'Error communicating with Google Drive',
        uploadedFiles: [],
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const totalGross = targetExpenses.reduce((s, e) => s + e.amountCad, 0);
  const totalGstHst = targetExpenses.reduce((s, e) => s + e.gstHstAmount, 0);
  const receiptsCount = targetExpenses.filter((e) => e.receiptDataUrl).length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-emerald-500 to-amber-500 p-0.5 shadow-xs shrink-0 flex items-center justify-center">
              <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
                <Cloud className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                <span>Save to Google Drive</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Folder: /taxes
                </span>
              </h2>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                CRA-compliant tax export for {selectedYear === 'all' ? 'all fiscal years' : `Tax Year ${selectedYear}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSyncing}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs">
          
          {/* Target Folder & Scope Card */}
          <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200/80 flex items-start gap-3">
            <FolderCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <div className="font-semibold text-blue-900 flex items-center justify-between">
                <span>Destination: My Drive / taxes</span>
                <span className="text-[10px] px-2 py-0.5 bg-blue-100/80 text-blue-800 rounded font-mono">
                  drive.file
                </span>
              </div>
              <p className="text-[11px] text-blue-800/80 leading-relaxed">
                The application will automatically check for a folder named <strong className="font-semibold text-blue-950">taxes</strong> in your Google Drive (or create one if not yet present) and save your CRA expense schedule, T2 tax summary, and attached receipt vouchers.
              </p>
            </div>
          </div>

          {/* Scope Selector: All of them vs Filtered */}
          {allExpenses && allExpenses.length > 0 && (
            <div className="flex items-center justify-between p-2.5 bg-neutral-100 rounded-xl border border-neutral-200">
              <span className="text-xs font-semibold text-neutral-700">Sync Scope:</span>
              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-neutral-200 text-xs">
                <button
                  type="button"
                  id="btn-sync-all-records"
                  onClick={() => setSyncScope('all')}
                  className={`px-3 py-1 rounded-md font-semibold transition-all ${
                    syncScope === 'all'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  All Records ({allExpenses.length} - All of them)
                </button>
                <button
                  type="button"
                  id="btn-sync-filtered-records"
                  onClick={() => setSyncScope('filtered')}
                  className={`px-3 py-1 rounded-md font-semibold transition-all ${
                    syncScope === 'filtered'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  {selectedYear === 'all' ? 'All Fiscal Years' : `FY ${selectedYear}`} ({expenses.length})
                </button>
              </div>
            </div>
          )}

          {/* Current Package Overview */}
          <div className="grid grid-cols-3 gap-2.5 bg-neutral-50 p-3 rounded-xl border border-neutral-200">
            <div>
              <span className="text-[10px] text-neutral-500 block uppercase tracking-wider font-semibold">
                Transactions
              </span>
              <span className="text-sm font-bold text-neutral-900 font-mono">
                {targetExpenses.length}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-neutral-500 block uppercase tracking-wider font-semibold">
                Total Expenses
              </span>
              <span className="text-sm font-bold text-neutral-900 font-mono">
                {formatCad(totalGross)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-neutral-500 block uppercase tracking-wider font-semibold">
                GST/HST (Line 108)
              </span>
              <span className="text-sm font-bold text-emerald-700 font-mono">
                {formatCad(totalGstHst)}
              </span>
            </div>
          </div>

          {/* Files to be Saved */}
          <div className="space-y-1.5 border border-neutral-200 rounded-xl p-3 bg-white">
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
              Export Package Contents
            </span>
            <div className="flex items-center gap-2 text-neutral-700 py-1 border-b border-neutral-100">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-neutral-800 truncate">
                  CRA_Tax_Expenses_{targetYearLabel === 'all' ? 'All' : targetYearLabel}.csv
                </div>
                <div className="text-[10px] text-neutral-500">
                  Full CRA GIFI codes, Line 108 ITCs, 50% meal limitation, vendor details
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-neutral-700 py-1 border-b border-neutral-100">
              <FileCode2 className="w-4 h-4 text-indigo-600 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-neutral-800 truncate">
                  CRA_T2_Tax_Summary_{targetYearLabel === 'all' ? 'All' : targetYearLabel}.json
                </div>
                <div className="text-[10px] text-neutral-500">
                  Corporation details, CRA category schedules, compliance audit rate
                </div>
              </div>
            </div>
            {receiptsCount > 0 && (
              <div className="flex items-center gap-2 text-neutral-700 py-1">
                <ImageIcon className="w-4 h-4 text-amber-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-neutral-800">
                    {receiptsCount} Attached Receipt Photo{receiptsCount > 1 ? 's' : ''} (.jpg)
                  </div>
                  <div className="text-[10px] text-neutral-500">
                    Vouchers saved directly into the /taxes folder for 6-year retention
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Progress / Status Box */}
          {syncState.step !== 'idle' && (
            <div
              className={`p-3.5 rounded-xl border transition-all ${
                syncState.step === 'complete'
                  ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900'
                  : syncState.step === 'error'
                  ? 'bg-red-50/80 border-red-300 text-red-900'
                  : 'bg-blue-50/80 border-blue-300 text-blue-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {isSyncing ? (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
                ) : syncState.step === 'complete' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : syncState.step === 'error' ? (
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                ) : null}
                <div className="font-semibold text-xs flex-1">{syncState.message}</div>
              </div>

              {syncState.error && (
                <div className="mt-2 text-[11px] text-red-700 bg-white/80 p-2 rounded-lg border border-red-200">
                  {syncState.error}
                </div>
              )}

              {/* Uploaded Files List */}
              {syncState.uploadedFiles.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-emerald-200/80 space-y-1.5">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                    Uploaded To /taxes:
                  </span>
                  {syncState.uploadedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between gap-2 bg-white/90 p-2 rounded-lg border border-emerald-200 text-[11px]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {file.type === 'csv' && <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                        {file.type === 'json' && <FileCode2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                        {file.type === 'receipt' && <ImageIcon className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                        <span className="truncate font-medium text-neutral-800">{file.name}</span>
                      </div>
                      {file.webViewLink && (
                        <a
                          href={file.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 shrink-0"
                        >
                          <span>View</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Direct Link to Taxes Folder */}
              {syncState.folderLink && (
                <div className="mt-3">
                  <a
                    href={syncState.folderLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                  >
                    <FolderCheck className="w-3.5 h-3.5" />
                    <span>Open 'taxes' Folder in Google Drive</span>
                    <ExternalLink className="w-3 h-3 ml-0.5" />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* CRA Legal Retention Notice */}
          <div className="flex items-start gap-2 text-[11px] text-neutral-500 bg-neutral-50 p-2.5 rounded-lg border border-neutral-200">
            <ShieldCheck className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
            <span>
              CRA Income Tax Act § 230(4): Books, records, and original source documents must be maintained for 6 years from the end of the tax year. Saving to Google Drive provides a permanent off-site digital audit trail.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={isSyncing}
            className="px-3.5 py-2 text-neutral-600 hover:text-neutral-800 text-xs font-semibold rounded-lg hover:bg-neutral-200/60 transition-colors"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            {syncState.step === 'complete' && (
              <button
                type="button"
                onClick={handleStartSync}
                className="px-3 py-2 text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-100 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sync Again</span>
              </button>
            )}

            <button
              type="button"
              id="btn-confirm-save-drive"
              onClick={handleStartSync}
              disabled={isSyncing}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving to 'taxes'...</span>
                </>
              ) : (
                <>
                  <Cloud className="w-3.5 h-3.5" />
                  <span>
                    {syncState.step === 'complete'
                      ? 'Re-upload to Google Drive'
                      : "Save to Google Drive ('taxes')"}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
