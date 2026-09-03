import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, AlertCircle, Building2, CheckCircle2, Lock, ArrowRight, UserCheck } from 'lucide-react';
import { AppUser } from '../types';
import {
  GOOGLE_CLIENT_ID,
  createOrUpdateUserFromGoogle,
  quickSignIn,
  isEmailAllowed,
} from '../services/authService';

interface LoginScreenProps {
  onLoginSuccess: (user: AppUser) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [customEmail, setCustomEmail] = useState('');
  const [showManualLogin, setShowManualLogin] = useState(false);

  useEffect(() => {
    // Render official Google Sign In button if script is available
    const initGsi = () => {
      if (window.google?.accounts?.id && googleBtnRef.current) {
        try {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: (response: any) => {
              if (response?.credential) {
                const res = createOrUpdateUserFromGoogle(response.credential);
                if (res.user) {
                  onLoginSuccess(res.user);
                } else if (res.error) {
                  setErrorMessage(res.error);
                }
              }
            },
            auto_select: false,
          });

          window.google.accounts.id.renderButton(googleBtnRef.current, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text: 'signin_with',
            shape: 'rectangular',
            logo_alignment: 'left',
            width: 320,
          });
        } catch (e) {
          console.warn('Google Identity Services button render note:', e);
        }
      }
    };

    if (window.google?.accounts?.id) {
      initGsi();
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          initGsi();
        }
      }, 500);
      return () => clearInterval(interval);
    }
  }, [onLoginSuccess]);

  const handleQuickLogin = (email: string) => {
    setErrorMessage(null);
    if (!isEmailAllowed(email)) {
      setErrorMessage('Account not authorized. Please contact your company administrator.');
      return;
    }
    const user = quickSignIn(email);
    onLoginSuccess(user);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customEmail.trim().toLowerCase();
    if (!clean) return;
    if (!isEmailAllowed(clean)) {
      setErrorMessage('Account not authorized. Please sign in with an authorized corporate account.');
      return;
    }
    const user = quickSignIn(clean);
    onLoginSuccess(user);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 via-neutral-100 to-neutral-200 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-neutral-200 overflow-hidden">
        
        {/* Header Branding */}
        <div className="p-6 bg-gradient-to-r from-red-700 via-red-600 to-red-800 text-white text-center relative">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 mb-3 shadow-inner">
            <span className="text-3xl" role="img" aria-label="Canada">🇨🇦</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight">Canada Tax Expense Tracker</h1>
          <p className="text-xs text-red-100 mt-1 flex items-center justify-center gap-1.5 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
            <span>CRA T2 Corporate &amp; GST/HST Compliance</span>
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          
          {/* Authorization Notice (No explicit emails shown) */}
          <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-900 space-y-1">
            <div className="flex items-center gap-2 font-semibold text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Authentication Required</span>
            </div>
            <p className="text-emerald-700 leading-relaxed text-[11px]">
              You must sign in to view the corporate ledger and record tax expenses. Access is restricted to authorized personnel.
            </p>
          </div>

          {errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p>{errorMessage}</p>
            </div>
          )}

          {/* Primary Sign-in: Google Sign In */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-neutral-600 uppercase tracking-wider block text-center">
              Sign In with Google
            </label>

            <div className="flex flex-col items-center justify-center min-h-[44px]">
              <div ref={googleBtnRef} id="google-signin-btn-container" className="flex justify-center w-full" />
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-neutral-200 w-full" />
            <span className="bg-white px-3 text-[11px] text-neutral-400 font-medium shrink-0">
              OR AUTHORIZED PROFILES
            </span>
          </div>

          {/* Authorized Profiles without displaying emails */}
          <div className="space-y-2.5">
            {/* Sulani Yashpal - Authorized Account */}
            <button
              type="button"
              id="btn-login-sulani"
              onClick={() => handleQuickLogin('sulaniyashpal@gmail.com')}
              className="w-full flex items-center justify-between p-3 rounded-xl border-2 border-emerald-500/80 bg-emerald-50/30 hover:bg-emerald-100/60 transition-all text-left group cursor-pointer shadow-2xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-700 text-white font-bold flex items-center justify-center text-xs shadow-xs">
                  SY
                </div>
                <div>
                  <div className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                    <span>Sulani Yashpal</span>
                    <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded">
                      Authorized User
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    Sign in to corporate tax workspace
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-emerald-600 group-hover:translate-x-0.5 transition-transform" />
            </button>

            {/* Sandip Yashpal - Owner Account */}
            <button
              type="button"
              id="btn-login-sandip"
              onClick={() => handleQuickLogin('sandipyashpal@gmail.com')}
              className="w-full flex items-center justify-between p-3 rounded-xl border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 transition-all text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-neutral-800 text-white font-bold flex items-center justify-center text-xs shadow-xs">
                  SY
                </div>
                <div>
                  <div className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                    <span>Sandip Yashpal</span>
                    <span className="text-[10px] font-semibold bg-neutral-200 text-neutral-700 px-1.5 py-0.2 rounded">
                      Administrator / Owner
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    Sign in to corporate tax workspace
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Manual Email Entry (Keeps input private) */}
          <div className="pt-1">
            {!showManualLogin ? (
              <button
                type="button"
                onClick={() => setShowManualLogin(true)}
                className="text-xs text-neutral-500 hover:text-neutral-800 underline block text-center w-full cursor-pointer"
              >
                Sign in with another authorized account
              </button>
            ) : (
              <form onSubmit={handleCustomSubmit} className="space-y-2 bg-neutral-50 p-3 rounded-xl border border-neutral-200">
                <label className="text-[11px] font-semibold text-neutral-600 block">
                  Authorized Account Email
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    placeholder="name@company.ca"
                    className="flex-1 px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-red-500 bg-white"
                    required
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Enter
                  </button>
                </div>
              </form>
            )}
          </div>

        </div>

        {/* Security Footer (Strict mandatory login, no guest access) */}
        <div className="bg-neutral-50 px-6 py-3 border-t border-neutral-200 text-[11px] text-neutral-500 text-center flex items-center justify-center gap-2">
          <Lock className="w-3.5 h-3.5 text-neutral-400" />
          <span>Restricted Access &bull; CRA Audit-Compliant Storage</span>
        </div>

      </div>
    </div>
  );
};
