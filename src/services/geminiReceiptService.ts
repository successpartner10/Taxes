import { ExtractedReceiptData } from '../types';

export interface ScanReceiptResult {
  success: boolean;
  data?: ExtractedReceiptData;
  error?: string;
}

export async function scanReceiptWithGemini(
  imageBase64: string,
  mimeType = 'image/jpeg'
): Promise<ScanReceiptResult> {
  try {
    const response = await fetch('/api/gemini/scan-receipt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64,
        mimeType,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errData.error || `Server responded with status ${response.status}`,
      };
    }

    const result = await response.json();
    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to extract data from receipt image.',
      };
    }

    return {
      success: true,
      data: result.data,
    };
  } catch (error: any) {
    console.error('Failed to call Gemini receipt scan API:', error);
    return {
      success: false,
      error: error?.message || 'Network error while contacting Gemini receipt analysis service.',
    };
  }
}
