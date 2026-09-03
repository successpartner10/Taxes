import firebaseConfig from '../../firebase-applet-config.json';
import { BusinessExpense, CompanyProfile } from '../types';
import { CRA_CATEGORIES } from '../constants/canadianTax';
import { formatCad } from '../utils/taxCalculators';

// Declare Google Identity Services global
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: {
              access_token?: string;
              error?: string;
              error_description?: string;
              error_uri?: string;
            }) => void;
            error_callback?: (err: unknown) => void;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
          };
        };
        id?: {
          initialize: (config: any) => void;
          renderButton: (parent: HTMLElement, options: any) => void;
          prompt: (notification?: any) => void;
        };
      };
    };
  }
}

export const GOOGLE_CLIENT_ID =
  (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
  firebaseConfig?.oAuthClientId ||
  '341742751070-ov47a1o42o010f10h0q2grtidm1uj7pv.apps.googleusercontent.com';

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

export interface DriveUploadItemResult {
  id: string;
  name: string;
  webViewLink?: string;
  type: 'folder' | 'csv' | 'json' | 'receipt';
}

export interface DriveSyncProgress {
  step: 'idle' | 'authorizing' | 'locating_folder' | 'uploading_csv' | 'uploading_summary' | 'uploading_receipts' | 'complete' | 'error';
  message: string;
  folderLink?: string;
  folderId?: string;
  uploadedFiles: DriveUploadItemResult[];
  error?: string;
}

let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Requests an access token from Google Identity Services
 */
export async function getGoogleDriveAccessToken(forcePrompt = false): Promise<string> {
  // Return cached token if valid for at least 2 more minutes
  if (!forcePrompt && cachedAccessToken && Date.now() < tokenExpiresAt - 120000) {
    return cachedAccessToken;
  }

  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(
        new Error(
          'Google Identity Services library is still loading. Please check your internet connection or try again in a few seconds.'
        )
      );
      return;
    }

    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: DRIVE_SCOPE,
        callback: (response) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error || 'Failed to authenticate with Google'));
            return;
          }
          if (response.access_token) {
            cachedAccessToken = response.access_token;
            // Token typically valid for 3600 seconds
            tokenExpiresAt = Date.now() + 3500 * 1000;
            resolve(response.access_token);
          } else {
            reject(new Error('No access token received from Google Identity Services'));
          }
        },
        error_callback: (err) => {
          reject(new Error(typeof err === 'string' ? err : 'Google OAuth encountered an error'));
        },
      });

      client.requestAccessToken({ prompt: forcePrompt ? 'consent' : '' });
    } catch (e: any) {
      reject(new Error(e.message || 'Failed to initialize Google OAuth client'));
    }
  });
}

/**
 * Finds or creates the "taxes" folder in the user's Google Drive
 */
export async function findOrCreateTaxesFolder(
  accessToken: string,
  folderName = 'taxes'
): Promise<{ id: string; name: string; webViewLink: string }> {
  // 1. Search for existing un-trashed folder named folderName
  const query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    query
  )}&fields=files(id,name,webViewLink)&pageSize=5`;

  const searchRes = await fetch(searchUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!searchRes.ok) {
    const errText = await searchRes.text();
    throw new Error(`Failed to search Google Drive: ${searchRes.status} ${errText}`);
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    const existing = searchData.files[0];
    return {
      id: existing.id,
      name: existing.name,
      webViewLink: existing.webViewLink || `https://drive.google.com/drive/folders/${existing.id}`,
    };
  }

  // 2. Folder does not exist, create it
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Canadian Business Tax Returns, CRA GIFI expense schedules, and receipt records',
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to create '${folderName}' folder in Google Drive: ${createRes.status} ${errText}`);
  }

  const newFolder = await createRes.json();
  return {
    id: newFolder.id,
    name: newFolder.name,
    webViewLink: newFolder.webViewLink || `https://drive.google.com/drive/folders/${newFolder.id}`,
  };
}

/**
 * Uploads a file (text, JSON, CSV, or binary) to a Google Drive folder via multipart upload
 */
export async function uploadFileToDriveFolder(
  accessToken: string,
  folderId: string,
  fileName: string,
  mimeType: string,
  fileContent: string | Blob
): Promise<{ id: string; name: string; webViewLink?: string }> {
  const boundary = '-------CRA_TAX_DRIVE_BOUNDARY_9847291';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const metadata = {
    name: fileName,
    parents: [folderId],
    description: 'Generated by Canadian Business Expense Tracker for CRA compliance',
  };

  const metadataBlob = new Blob(
    [`${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`],
    { type: 'text/plain' }
  );

  const filePartHeader = new Blob([`${delimiter}Content-Type: ${mimeType}\r\n\r\n`], { type: 'text/plain' });

  const contentBlob =
    typeof fileContent === 'string'
      ? new Blob([fileContent], { type: mimeType })
      : fileContent;

  const closeBlob = new Blob([closeDelim], { type: 'text/plain' });

  const multipartBody = new Blob([metadataBlob, filePartHeader, contentBlob, closeBlob], {
    type: `multipart/related; boundary=${boundary}`,
  });

  const uploadUrl =
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink';

  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: multipartBody,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to upload ${fileName} to Google Drive: ${res.status} ${errText}`);
  }

  return await res.json();
}

/**
 * Converts a base64 Data URI to a Blob
 */
export function dataUriToBlob(dataUri: string): { blob: Blob; mimeType: string } {
  const [header, base64Data] = dataUri.split(',');
  const mimeMatch = header.match(/:(.*?);/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const binary = atob(base64Data);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return { blob: new Blob([array], { type: mimeType }), mimeType };
}

/**
 * Generates the CSV string for expenses
 */
export function generateCraExpensesCsvString(
  expenses: BusinessExpense[],
  company: CompanyProfile,
  selectedYear: number | 'all'
): string {
  const headers = [
    'Date',
    'Company Paid (Vendor)',
    'Invoice / Receipt Ref',
    'Province',
    'CRA GIFI Code',
    'CRA Category Name',
    'CRA T2125 Part 4 Line',
    'Payment Method',
    'Gross Amount (CAD)',
    'GST/HST Amount (ITC)',
    'PST/QST Amount',
    'Net Amount (Pre-Tax)',
    'Deductible %',
    'CRA Deductible Amount (CAD)',
    'Director / Shareholder Loan',
    'Receipt Verified On File',
    'Receipt File Attached',
    'Business Purpose / Notes',
  ];

  const escapeCsv = (str: string | undefined | null) => {
    if (!str) return '""';
    const escaped = str.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const rows = expenses.map((e) => {
    const cat = CRA_CATEGORIES[e.craCategory];
    return [
      escapeCsv(e.date),
      escapeCsv(e.companyPaid),
      escapeCsv(e.invoiceNumber || ''),
      escapeCsv(e.province),
      escapeCsv(e.craCategory),
      escapeCsv(cat?.name || 'Other'),
      escapeCsv(cat?.line || 'Other'),
      escapeCsv(e.paymentMethod.replace(/_/g, ' ')),
      e.amountCad.toFixed(2),
      e.gstHstAmount.toFixed(2),
      e.pstQstAmount.toFixed(2),
      e.netAmount.toFixed(2),
      `${e.deductiblePercentage}%`,
      e.deductibleAmountCad.toFixed(2),
      e.isDirectorLoan ? 'YES' : 'NO',
      e.hasReceipt ? 'YES' : 'NO',
      escapeCsv(e.receiptFileName || (e.receiptDataUrl ? 'Yes (Image Attached)' : 'None')),
      escapeCsv(e.notes || ''),
    ].join(',');
  });

  // Calculate totals
  const totalGross = expenses.reduce((s, e) => s + e.amountCad, 0);
  const totalGst = expenses.reduce((s, e) => s + e.gstHstAmount, 0);
  const totalPst = expenses.reduce((s, e) => s + e.pstQstAmount, 0);
  const totalNet = expenses.reduce((s, e) => s + e.netAmount, 0);
  const totalDeductible = expenses.reduce((s, e) => s + e.deductibleAmountCad, 0);

  const totalsRow = [
    '"TOTALS"',
    '""',
    '""',
    '""',
    '""',
    '""',
    '""',
    '""',
    totalGross.toFixed(2),
    totalGst.toFixed(2),
    totalPst.toFixed(2),
    totalNet.toFixed(2),
    '""',
    totalDeductible.toFixed(2),
    '""',
    '""',
    '""',
    '""',
  ].join(',');

  const metadataRows = [
    `# Canadian Business Corporate Expense Schedule`,
    `# Corporation Legal Name: ${company.legalName}`,
    `# Operating Name: ${company.operatingName || 'N/A'}`,
    `# CRA Business Number (BN): ${company.businessNumber || 'N/A'}`,
    `# Corporate Province: ${company.province}`,
    `# Tax Year: ${selectedYear === 'all' ? 'All Fiscal Periods' : selectedYear}`,
    `# Export Date: ${new Date().toISOString()}`,
    `# Total Claimable GST/HST Input Tax Credits (Line 108): CAD $${totalGst.toFixed(2)}`,
    `# Total CRA Allowable Tax Deduction: CAD $${totalDeductible.toFixed(2)}`,
    ``,
  ].join('\n');

  return `${metadataRows}${headers.join(',')}\n${rows.join('\n')}\n${totalsRow}\n`;
}

/**
 * Generates the full JSON package for tax audit & record retention
 */
export function generateCraTaxJsonString(
  expenses: BusinessExpense[],
  company: CompanyProfile,
  selectedYear: number | 'all'
): string {
  const totalGross = expenses.reduce((s, e) => s + e.amountCad, 0);
  const totalGstHst = expenses.reduce((s, e) => s + e.gstHstAmount, 0);
  const totalPstQst = expenses.reduce((s, e) => s + e.pstQstAmount, 0);
  const totalNet = expenses.reduce((s, e) => s + e.netAmount, 0);
  const totalDeductible = expenses.reduce((s, e) => s + e.deductibleAmountCad, 0);

  // Group by CRA category
  const categoryBreakdown: Record<string, any> = {};
  for (const exp of expenses) {
    const cat = CRA_CATEGORIES[exp.craCategory];
    const key = exp.craCategory;
    if (!categoryBreakdown[key]) {
      categoryBreakdown[key] = {
        craGifiCode: key,
        craLine: cat?.line || 'Other',
        categoryName: cat?.name || 'Other',
        itemCount: 0,
        totalGrossCad: 0,
        totalGstHstCad: 0,
        totalDeductibleCad: 0,
      };
    }
    categoryBreakdown[key].itemCount += 1;
    categoryBreakdown[key].totalGrossCad = +(categoryBreakdown[key].totalGrossCad + exp.amountCad).toFixed(2);
    categoryBreakdown[key].totalGstHstCad = +(categoryBreakdown[key].totalGstHstCad + exp.gstHstAmount).toFixed(2);
    categoryBreakdown[key].totalDeductibleCad = +(categoryBreakdown[key].totalDeductibleCad + exp.deductibleAmountCad).toFixed(2);
  }

  const taxPackage = {
    metadata: {
      generatedAt: new Date().toISOString(),
      generator: 'Canadian Business Expense Tracker (CRA T2 & T2125 Compliant)',
      craAuditRetentionNotice: 'Under subsection 230(4) of the Income Tax Act, business records and receipts must be retained for at least 6 years from the end of the last tax year to which they relate.',
      taxYear: selectedYear,
    },
    companyProfile: company,
    financialSummary: {
      totalTransactionCount: expenses.length,
      totalGrossExpensesCad: +totalGross.toFixed(2),
      totalGstHstItcClaimableCad: +totalGstHst.toFixed(2),
      totalPstQstCad: +totalPstQst.toFixed(2),
      totalPreTaxNetCad: +totalNet.toFixed(2),
      totalAllowableDeductionCad: +totalDeductible.toFixed(2),
      directorLoanReimbursementsDueCad: +expenses
        .filter((e) => e.isDirectorLoan)
        .reduce((s, e) => s + e.amountCad, 0)
        .toFixed(2),
      receiptComplianceRatePercent: expenses.length > 0
        ? +((expenses.filter((e) => e.hasReceipt).length / expenses.length) * 100).toFixed(1)
        : 100,
    },
    craCategorySchedule: Object.values(categoryBreakdown),
    expenses: expenses.map((e) => {
      // Omit huge data uri from the main summary json to keep it clean, but mark presence
      const { receiptDataUrl, ...rest } = e;
      return {
        ...rest,
        hasAttachedReceiptPhoto: !!receiptDataUrl,
      };
    }),
  };

  return JSON.stringify(taxPackage, null, 2);
}

/**
 * Main function to synchronize expenses and tax records to Google Drive "taxes" folder
 */
export async function syncTaxesToGoogleDrive(
  expenses: BusinessExpense[],
  company: CompanyProfile,
  selectedYear: number | 'all',
  onProgress?: (progress: DriveSyncProgress) => void
): Promise<DriveSyncProgress> {
  const state: DriveSyncProgress = {
    step: 'authorizing',
    message: 'Connecting to Google Identity Services...',
    uploadedFiles: [],
  };

  const update = (partial: Partial<DriveSyncProgress>) => {
    Object.assign(state, partial);
    onProgress?.({ ...state });
  };

  try {
    update({ step: 'authorizing', message: 'Authorizing with Google Drive (drive.file scope)...' });
    const accessToken = await getGoogleDriveAccessToken();

    update({ step: 'locating_folder', message: "Locating or creating 'taxes' folder in Google Drive..." });
    const folder = await findOrCreateTaxesFolder(accessToken, 'taxes');
    state.folderId = folder.id;
    state.folderLink = folder.webViewLink;

    const dateStamp = new Date().toISOString().split('T')[0];
    const yearLabel = selectedYear === 'all' ? 'AllYears' : `FY${selectedYear}`;

    // 1. Upload CRA CSV Expense Ledger
    update({ step: 'uploading_csv', message: `Uploading CRA Expense Ledger CSV to 'taxes' folder...` });
    const csvContent = generateCraExpensesCsvString(expenses, company, selectedYear);
    const csvFileName = `CRA_Tax_Expenses_${yearLabel}_${dateStamp}.csv`;
    const csvUpload = await uploadFileToDriveFolder(
      accessToken,
      folder.id,
      csvFileName,
      'text/csv',
      csvContent
    );
    state.uploadedFiles.push({
      id: csvUpload.id,
      name: csvUpload.name,
      webViewLink: csvUpload.webViewLink,
      type: 'csv',
    });

    // 2. Upload CRA T2 Tax Package JSON
    update({ step: 'uploading_summary', message: `Uploading CRA T2 Corporate Tax Summary to 'taxes' folder...` });
    const jsonContent = generateCraTaxJsonString(expenses, company, selectedYear);
    const jsonFileName = `CRA_T2_Tax_Summary_${yearLabel}_${dateStamp}.json`;
    const jsonUpload = await uploadFileToDriveFolder(
      accessToken,
      folder.id,
      jsonFileName,
      'application/json',
      jsonContent
    );
    state.uploadedFiles.push({
      id: jsonUpload.id,
      name: jsonUpload.name,
      webViewLink: jsonUpload.webViewLink,
      type: 'json',
    });

    // 3. Upload Attached Receipt Images if present
    const expensesWithReceipts = expenses.filter(
      (e) => e.receiptDataUrl && e.receiptDataUrl.startsWith('data:image')
    );

    if (expensesWithReceipts.length > 0) {
      update({
        step: 'uploading_receipts',
        message: `Uploading ${expensesWithReceipts.length} receipt vouchers to 'taxes' folder...`,
      });

      for (let i = 0; i < expensesWithReceipts.length; i++) {
        const exp = expensesWithReceipts[i];
        const { blob, mimeType } = dataUriToBlob(exp.receiptDataUrl!);
        const safeVendor = exp.companyPaid.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 20);
        const receiptFileName = `Receipt_${exp.date}_${safeVendor}_${exp.id.substring(exp.id.length - 4)}.jpg`;

        try {
          const receiptUpload = await uploadFileToDriveFolder(
            accessToken,
            folder.id,
            receiptFileName,
            mimeType,
            blob
          );
          state.uploadedFiles.push({
            id: receiptUpload.id,
            name: receiptUpload.name,
            webViewLink: receiptUpload.webViewLink,
            type: 'receipt',
          });
        } catch (uploadErr) {
          console.warn(`Failed to upload receipt ${receiptFileName}:`, uploadErr);
        }
      }
    }

    update({
      step: 'complete',
      message: `Successfully saved tax records to Google Drive 'taxes' folder!`,
    });

    return state;
  } catch (err: any) {
    console.error('Google Drive sync error:', err);
    update({
      step: 'error',
      message: err.message || 'Failed to save to Google Drive',
      error: err.message || 'Failed to save to Google Drive',
    });
    return state;
  }
}
