import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  RefreshCw,
  X,
  Check,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  Zap,
  Upload,
  Bot,
  Calendar,
  DollarSign,
  Receipt,
  FileText,
  Tag,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { ExtractedReceiptData, CraCategoryCode, CanadianProvince } from '../types';
import { scanReceiptWithGemini } from '../services/geminiReceiptService';
import { CRA_CATEGORIES } from '../constants/canadianTax';

interface ReceiptCameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (dataUri: string, fileName: string, extractedData?: ExtractedReceiptData) => void;
  companyName?: string;
}

export const ReceiptCameraCaptureModal: React.FC<ReceiptCameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  companyName,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Camera states
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isLoadingCamera, setIsLoadingCamera] = useState(true);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isFlashActive, setIsFlashActive] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);

  // Gemini AI scanning states
  const [isAiScanning, setIsAiScanning] = useState(false);
  const [aiScanError, setAiScanError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedReceiptData | null>(null);

  // Stop camera tracks cleanly
  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Enumerate available video devices
  const detectVideoDevices = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((d) => d.kind === 'videoinput');
      setVideoDevices(cameras);
    } catch {
      // ignore
    }
  };

  // Start camera stream
  const startCamera = useCallback(async (deviceId?: string) => {
    setIsLoadingCamera(true);
    setCameraError(null);
    stopCameraStream();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera API is not supported in this browser environment. Please use manual upload.');
      setIsLoadingCamera(false);
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
        audio: false,
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn('Video play interrupted:', playErr);
        }
      }

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = videoTrack.getCapabilities ? (videoTrack.getCapabilities() as any) : null;
        setHasTorch(Boolean(capabilities && capabilities.torch));
      }

      await detectVideoDevices();
      setIsLoadingCamera(false);
    } catch (err: any) {
      console.error('Camera access error:', err);
      let errorMsg = 'Could not access device camera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = 'Camera access was denied. Please allow camera permissions in your browser settings to scan receipts.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg = 'No camera device was detected on your device.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMsg = 'Camera is already in use by another application.';
      }
      setCameraError(errorMsg);
      setIsLoadingCamera(false);
    }
  }, [stopCameraStream]);

  // Run Gemini AI receipt scanner on captured or uploaded image
  const triggerAiScan = async (imageDataUrl: string) => {
    setIsAiScanning(true);
    setAiScanError(null);
    setExtractedData(null);

    const result = await scanReceiptWithGemini(imageDataUrl);

    if (result.success && result.data) {
      setExtractedData(result.data);
    } else {
      setAiScanError(result.error || 'Could not extract receipt data automatically.');
    }
    setIsAiScanning(false);
  };

  // Toggle torch / flash if supported
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track && hasTorch) {
      try {
        const nextState = !isFlashActive;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setIsFlashActive(nextState);
      } catch (err) {
        console.warn('Failed to toggle torch', err);
      }
    }
  };

  // Flip / switch camera
  const switchCamera = () => {
    if (videoDevices.length <= 1) return;
    const currentIndex = videoDevices.findIndex((d) => d.deviceId === selectedDeviceId);
    const nextIndex = (currentIndex + 1) % videoDevices.length;
    const nextDevice = videoDevices[nextIndex];
    setSelectedDeviceId(nextDevice.deviceId);
    startCamera(nextDevice.deviceId);
  };

  // Capture frame to canvas
  const handleSnapPhoto = () => {
    if (!videoRef.current) return;
    setIsSnapping(true);

    setTimeout(() => {
      try {
        const video = videoRef.current;
        if (!video) return;

        const canvas = document.createElement('canvas');
        const videoWidth = video.videoWidth || 1280;
        const videoHeight = video.videoHeight || 720;

        // Cap maximum dimension at 1600px for crisp receipt legibility without excessive base64 weight
        const maxDimension = 1600;
        let width = videoWidth;
        let height = videoHeight;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        setCapturedImageUri(dataUrl);

        // Stop camera stream while reviewing
        stopCameraStream();

        // Trigger AI receipt scanning automatically
        triggerAiScan(dataUrl);
      } catch (err) {
        console.error('Failed to capture frame', err);
      } finally {
        setIsSnapping(false);
      }
    }, 150);
  };

  // Retake photo
  const handleRetake = () => {
    setCapturedImageUri(null);
    setExtractedData(null);
    setAiScanError(null);
    startCamera(selectedDeviceId);
  };

  // Confirm and return data
  const handleConfirm = () => {
    if (!capturedImageUri) return;
    const cleanCompany = (extractedData?.vendor || companyName || 'receipt')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_');
    const dateStr = extractedData?.date || new Date().toISOString().split('T')[0];
    const fileName = `receipt_${cleanCompany}_${dateStr}_${Date.now().toString().slice(-4)}.jpg`;

    onCapture(capturedImageUri, fileName, extractedData || undefined);
    stopCameraStream();
    onClose();
  };

  // Fallback file upload if camera fails
  const handleFallbackUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setCapturedImageUri(dataUrl);
        stopCameraStream();
        triggerAiScan(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  // Lifecycle when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setCapturedImageUri(null);
      setExtractedData(null);
      setAiScanError(null);
      startCamera();
    } else {
      stopCameraStream();
    }
    return () => {
      stopCameraStream();
    };
  }, [isOpen, startCamera, stopCameraStream]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-neutral-900 text-white rounded-2xl max-w-2xl w-full shadow-2xl border border-neutral-800 overflow-hidden flex flex-col max-h-[94vh]">
        
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-600/20 text-red-400 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>AI Receipt Scanner &amp; Camera</span>
                <span className="text-[10px] bg-gradient-to-r from-red-600 to-amber-600 text-white font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                  <Sparkles className="w-3 h-3 text-amber-200" />
                  Gemini 3.8 Flash
                </span>
              </h3>
              <p className="text-[11px] text-neutral-400">
                Automatically extracts Vendor, Date, Total CAD, GST/HST, and CRA tax codes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCameraStream();
              onClose();
            }}
            className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder or Preview Area */}
        <div className="relative bg-black flex-1 min-h-[340px] sm:min-h-[400px] flex items-center justify-center overflow-hidden">
          
          {/* Shutter flash animation overlay */}
          {isSnapping && (
            <div className="absolute inset-0 bg-white z-40 animate-out fade-out duration-300 pointer-events-none" />
          )}

          {/* Captured Image Preview with AI Scanning Overlay */}
          {capturedImageUri ? (
            <div className="relative w-full h-full flex flex-col md:flex-row items-stretch p-3 sm:p-4 gap-4 overflow-y-auto max-h-[65vh]">
              
              {/* Receipt Image Side */}
              <div className="relative flex-1 flex items-center justify-center bg-neutral-950 rounded-xl overflow-hidden min-h-[220px] max-h-[380px] border border-neutral-800">
                <img
                  src={capturedImageUri}
                  alt="Captured Receipt"
                  className="max-h-[360px] max-w-full object-contain"
                />

                {/* AI Laser Scanning Beam Animation */}
                {isAiScanning && (
                  <div className="absolute inset-0 bg-cyan-950/20 pointer-events-none flex flex-col justify-between overflow-hidden">
                    <div className="w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_20px_#22d3ee] animate-bounce" />
                    <div className="text-center py-2 bg-neutral-950/80 backdrop-blur-xs text-xs font-semibold text-cyan-300 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                      <span>Gemini AI scanning receipt...</span>
                    </div>
                  </div>
                )}

                {/* Audit-ready tag when scan is done */}
                {!isAiScanning && (
                  <div className="absolute top-3 left-3 bg-neutral-900/90 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold flex items-center gap-1.5 shadow-lg">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Audit Ready</span>
                  </div>
                )}
              </div>

              {/* AI Extracted Fields Card */}
              <div className="w-full md:w-80 flex flex-col justify-between bg-neutral-800/80 rounded-xl p-3.5 border border-neutral-700/80">
                <div>
                  <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-neutral-700">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                      <Bot className="w-4 h-4 text-amber-400" />
                      <span>AI Extracted Tax Details</span>
                    </div>
                    {extractedData && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Extracted
                      </span>
                    )}
                  </div>

                  {isAiScanning ? (
                    <div className="py-8 text-center space-y-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto animate-pulse">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-white">Reading Canadian Tax Fields...</p>
                        <p className="text-[11px] text-neutral-400">
                          Extracting Vendor, Date, CAD Total, GST/HST, and CRA Category
                        </p>
                      </div>
                    </div>
                  ) : aiScanError ? (
                    <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-lg text-xs text-red-300 space-y-2">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-white">Notice</p>
                          <p className="text-[11px] text-red-200 mt-0.5">{aiScanError}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => triggerAiScan(capturedImageUri)}
                        className="w-full mt-2 py-1.5 bg-neutral-700 hover:bg-neutral-600 rounded text-xs font-semibold text-white flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Retry AI Scan</span>
                      </button>
                    </div>
                  ) : extractedData ? (
                    <div className="space-y-2.5 text-xs">
                      
                      {/* Vendor field */}
                      <div>
                        <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-0.5">
                          Company / Vendor Paid
                        </label>
                        <div className="flex items-center gap-1.5 bg-neutral-900 px-2.5 py-1.5 rounded-lg border border-neutral-700">
                          <Receipt className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <input
                            type="text"
                            value={extractedData.vendor || ''}
                            onChange={(e) =>
                              setExtractedData({ ...extractedData, vendor: e.target.value })
                            }
                            placeholder="Vendor Name"
                            className="bg-transparent text-white font-semibold text-xs focus:outline-hidden w-full"
                          />
                        </div>
                      </div>

                      {/* Date & Total row */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-0.5">
                            Date
                          </label>
                          <div className="flex items-center gap-1.5 bg-neutral-900 px-2.5 py-1.5 rounded-lg border border-neutral-700">
                            <Calendar className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                            <input
                              type="date"
                              value={extractedData.date || ''}
                              onChange={(e) =>
                                setExtractedData({ ...extractedData, date: e.target.value })
                              }
                              className="bg-transparent text-white text-xs focus:outline-hidden w-full"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-0.5">
                            Total CAD
                          </label>
                          <div className="flex items-center gap-1 bg-neutral-900 px-2.5 py-1.5 rounded-lg border border-neutral-700">
                            <DollarSign className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <input
                              type="number"
                              step="0.01"
                              value={extractedData.totalAmountCad ?? ''}
                              onChange={(e) =>
                                setExtractedData({
                                  ...extractedData,
                                  totalAmountCad: parseFloat(e.target.value) || 0,
                                })
                              }
                              placeholder="0.00"
                              className="bg-transparent text-emerald-300 font-bold text-xs focus:outline-hidden w-full"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Tax Breakdown row */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-0.5">
                            GST / HST Tax
                          </label>
                          <div className="bg-neutral-900 px-2.5 py-1.5 rounded-lg border border-neutral-700">
                            <input
                              type="number"
                              step="0.01"
                              value={extractedData.gstHstAmount ?? ''}
                              onChange={(e) =>
                                setExtractedData({
                                  ...extractedData,
                                  gstHstAmount: parseFloat(e.target.value) || 0,
                                })
                              }
                              placeholder="0.00"
                              className="bg-transparent text-neutral-200 text-xs focus:outline-hidden w-full"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-0.5">
                            PST / QST
                          </label>
                          <div className="bg-neutral-900 px-2.5 py-1.5 rounded-lg border border-neutral-700">
                            <input
                              type="number"
                              step="0.01"
                              value={extractedData.pstQstAmount ?? ''}
                              onChange={(e) =>
                                setExtractedData({
                                  ...extractedData,
                                  pstQstAmount: parseFloat(e.target.value) || 0,
                                })
                              }
                              placeholder="0.00"
                              className="bg-transparent text-neutral-200 text-xs focus:outline-hidden w-full"
                            />
                          </div>
                        </div>
                      </div>

                      {/* CRA GIFI Code */}
                      <div>
                        <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-0.5">
                          CRA Tax Category
                        </label>
                        <div className="flex items-center gap-1.5 bg-neutral-900 px-2.5 py-1.5 rounded-lg border border-neutral-700">
                          <Tag className="w-3.5 h-3.5 text-red-400 shrink-0" />
                          <select
                            value={extractedData.craCategory || '8810'}
                            onChange={(e) =>
                              setExtractedData({
                                ...extractedData,
                                craCategory: e.target.value as CraCategoryCode,
                              })
                            }
                            className="bg-transparent text-neutral-200 text-xs focus:outline-hidden w-full"
                          >
                            {Object.entries(CRA_CATEGORIES).map(([code, info]) => (
                              <option key={code} value={code} className="bg-neutral-900 text-white">
                                {code} - {info.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Invoice / Reference # */}
                      {extractedData.invoiceNumber && (
                        <div>
                          <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-0.5">
                            Invoice / Order #
                          </label>
                          <div className="flex items-center gap-1.5 bg-neutral-900 px-2.5 py-1.5 rounded-lg border border-neutral-700 text-neutral-300">
                            <FileText className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                            <input
                              type="text"
                              value={extractedData.invoiceNumber}
                              onChange={(e) =>
                                setExtractedData({ ...extractedData, invoiceNumber: e.target.value })
                              }
                              className="bg-transparent text-neutral-300 text-xs focus:outline-hidden w-full font-mono"
                            />
                          </div>
                        </div>
                      )}

                    </div>
                  ) : null}
                </div>

                {/* AI Re-scan Trigger */}
                {!isAiScanning && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => triggerAiScan(capturedImageUri)}
                      className="text-[11px] text-neutral-400 hover:text-white flex items-center justify-center gap-1 w-full py-1 hover:bg-neutral-700/50 rounded transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Re-analyze with Gemini</span>
                    </button>
                  </div>
                )}

              </div>

            </div>
          ) : cameraError ? (
            /* Error & Fallback State */
            <div className="p-8 text-center max-w-md mx-auto space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white mb-1">Camera Access Issue</h4>
                <p className="text-xs text-neutral-400 leading-relaxed">{cameraError}</p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="w-full sm:w-auto px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold rounded-xl text-white flex items-center justify-center gap-2 border border-neutral-700 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Camera</span>
                </button>

                <label
                  htmlFor="camera-fallback-upload"
                  className="w-full sm:w-auto px-4 py-2 bg-red-600 hover:bg-red-700 text-xs font-semibold rounded-xl text-white flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Image File</span>
                </label>
                <input
                  id="camera-fallback-upload"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFallbackUpload}
                  className="hidden"
                />
              </div>
            </div>
          ) : (
            /* Active Live Viewfinder */
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              {isLoadingCamera && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950 z-20 space-y-3">
                  <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-neutral-400 font-medium">Initializing camera sensor...</span>
                </div>
              )}

              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full max-h-[58vh] object-cover sm:object-contain"
              />

              {/* Receipt alignment guide box */}
              <div className="absolute inset-6 sm:inset-10 border-2 border-white/40 rounded-2xl pointer-events-none flex flex-col justify-between p-3">
                <div className="flex justify-between items-start">
                  <div className="w-5 h-5 border-t-2 border-l-2 border-red-500" />
                  <span className="text-[11px] font-semibold text-white/90 bg-neutral-900/70 backdrop-blur-xs px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    Align Receipt for AI Scan
                  </span>
                  <div className="w-5 h-5 border-t-2 border-r-2 border-red-500" />
                </div>
                
                <div className="text-center">
                  <p className="text-[10px] text-neutral-300/90 bg-neutral-950/80 px-3 py-1 rounded-md inline-block">
                    Ensure vendor name, date, and CAD total are in focus
                  </p>
                </div>

                <div className="flex justify-between items-end">
                  <div className="w-5 h-5 border-b-2 border-l-2 border-red-500" />
                  <div className="w-5 h-5 border-b-2 border-r-2 border-red-500" />
                </div>
              </div>

              {/* Quick camera controls overlay */}
              <div className="absolute top-4 right-4 flex items-center gap-2 z-30">
                {hasTorch && (
                  <button
                    type="button"
                    onClick={toggleTorch}
                    className={`p-2 rounded-xl backdrop-blur-md border transition-colors cursor-pointer ${
                      isFlashActive
                        ? 'bg-amber-400 text-neutral-900 border-amber-300'
                        : 'bg-neutral-900/80 text-white border-neutral-700 hover:bg-neutral-800'
                    }`}
                    title="Toggle Torch Light"
                  >
                    <Zap className="w-4 h-4" />
                  </button>
                )}

                {videoDevices.length > 1 && (
                  <button
                    type="button"
                    onClick={switchCamera}
                    className="p-2 rounded-xl bg-neutral-900/80 text-white backdrop-blur-md border border-neutral-700 hover:bg-neutral-800 transition-colors cursor-pointer"
                    title="Switch Camera (Front/Rear)"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Controls / Footer */}
        <div className="p-4 bg-neutral-900 border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          {capturedImageUri ? (
            /* Review Buttons */
            <>
              <button
                type="button"
                onClick={handleRetake}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retake Photo</span>
              </button>

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  id="btn-confirm-receipt-photo"
                  onClick={handleConfirm}
                  disabled={isAiScanning}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-xs font-bold text-white transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {extractedData ? 'Use Extracted Data & Fill Expense' : 'Attach Receipt'}
                  </span>
                </button>
              </div>
            </>
          ) : (
            /* Live Capture Controls */
            <>
              <div className="text-[11px] text-neutral-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Gemini will automatically extract vendor, date, total, &amp; taxes</span>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => {
                    stopCameraStream();
                    onClose();
                  }}
                  className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  id="btn-capture-shutter"
                  disabled={isLoadingCamera || Boolean(cameraError)}
                  onClick={handleSnapPhoto}
                  className="px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:pointer-events-none text-white text-xs font-bold rounded-xl shadow-lg shadow-red-600/30 transition-all flex items-center gap-2 group active:scale-95 cursor-pointer"
                >
                  <div className="w-3.5 h-3.5 rounded-full bg-white ring-2 ring-red-400 group-hover:scale-110 transition-transform" />
                  <span>Snap Receipt</span>
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
};
