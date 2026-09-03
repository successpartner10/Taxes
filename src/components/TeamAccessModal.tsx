import React, { useState } from 'react';
import { X, ShieldCheck, UserPlus, Trash2, CheckCircle2, Users, Lock, LogOut, Globe } from 'lucide-react';
import { AppUser, AccessControlSettings } from '../types';
import {
  getStoredAccessSettings,
  saveAccessSettings,
  DEFAULT_ALLOWED_EMAILS,
  maskEmail,
} from '../services/authService';

interface TeamAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AppUser | null;
  onLogout: () => void;
  onSwitchUser: (email: string) => void;
}

export const TeamAccessModal: React.FC<TeamAccessModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLogout,
  onSwitchUser,
}) => {
  const [settings, setSettings] = useState<AccessControlSettings>(() => getStoredAccessSettings());
  const [newEmail, setNewEmail] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const triggerSaved = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleToggleAllowAll = () => {
    const updated: AccessControlSettings = {
      ...settings,
      allowAllAuthenticatedUsers: !settings.allowAllAuthenticatedUsers,
    };
    setSettings(updated);
    saveAccessSettings(updated);
    triggerSaved();
  };

  const handleAddEmail = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newEmail.trim().toLowerCase();
    if (!clean || !clean.includes('@')) return;

    if (settings.allowedEmails.includes(clean)) {
      setNewEmail('');
      return;
    }

    const updated: AccessControlSettings = {
      ...settings,
      allowedEmails: [...settings.allowedEmails, clean],
    };
    setSettings(updated);
    saveAccessSettings(updated);
    setNewEmail('');
    triggerSaved();
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    // Prevent removing primary designated admins
    if (DEFAULT_ALLOWED_EMAILS.includes(emailToRemove.toLowerCase())) {
      alert('Cannot remove primary designated corporate administrator.');
      return;
    }

    const updated: AccessControlSettings = {
      ...settings,
      allowedEmails: settings.allowedEmails.filter((e) => e !== emailToRemove),
    };
    setSettings(updated);
    saveAccessSettings(updated);
    triggerSaved();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-neutral-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <span>Team &amp; Access Permissions</span>
                {savedSuccess && (
                  <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-neutral-500">
                Manage who can log into and access the Canadian tax records
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5">
          
          {/* Active User Card */}
          {currentUser && (
            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-neutral-800 text-white font-bold flex items-center justify-center text-xs shadow-xs">
                  {currentUser.name
                    ? currentUser.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()
                    : 'AU'}
                </div>
                <div>
                  <div className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                    <span>{currentUser.name || 'Authorized User'}</span>
                    <span className="text-[10px] font-semibold bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded">
                      {currentUser.role === 'owner' ? 'Owner' : 'Authorized'}
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-500 flex items-center gap-1">
                    <span>Active Session</span>
                    <span>&bull;</span>
                    <span className="font-mono text-neutral-400">{maskEmail(currentUser.email)}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                id="btn-logout"
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                className="px-2.5 py-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 font-medium rounded-lg border border-red-200 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}

          {/* All of them / Access Mode Toggle */}
          <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-blue-600" />
                <span>Open Login Mode ("All of them")</span>
              </div>
              <p className="text-[11px] text-blue-800 leading-relaxed">
                When enabled, any verified Google account can sign in to view and collaborate on the tax ledger. When disabled, only explicitly approved team members can log in.
              </p>
            </div>

            <button
              type="button"
              id="btn-toggle-allow-all"
              onClick={handleToggleAllowAll}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                settings.allowAllAuthenticatedUsers ? 'bg-blue-600' : 'bg-neutral-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  settings.allowAllAuthenticatedUsers ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Authorized Accounts Whitelist */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                Authorized Team Members ({settings.allowedEmails.length})
              </label>
              <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Protected List
              </span>
            </div>

            <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
              {settings.allowedEmails.map((email) => {
                const isSulani = email.toLowerCase() === 'sulaniyashpal@gmail.com';
                const isSandip = email.toLowerCase() === 'sandipyashpal@gmail.com';
                const isCurrent = currentUser?.email.toLowerCase() === email.toLowerCase();
                const displayName = isSulani
                  ? 'Sulani Yashpal'
                  : isSandip
                  ? 'Sandip Yashpal'
                  : maskEmail(email);

                return (
                  <div
                    key={email}
                    className="p-2.5 flex items-center justify-between text-xs hover:bg-neutral-50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-neutral-200 text-neutral-700 font-semibold flex items-center justify-center text-[10px]">
                        {isSulani ? 'SY' : isSandip ? 'SY' : 'TM'}
                      </div>
                      <div>
                        <div className="font-semibold text-neutral-900 flex items-center gap-1.5">
                          <span>{displayName}</span>
                          {isSulani && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">
                              Permitted
                            </span>
                          )}
                          {isSandip && (
                            <span className="text-[10px] bg-neutral-200 text-neutral-800 font-bold px-1.5 py-0.2 rounded">
                              Owner
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-neutral-400 font-mono">
                          {maskEmail(email)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isCurrent && (
                        <button
                          type="button"
                          onClick={() => onSwitchUser(email)}
                          className="text-[11px] text-blue-600 hover:text-blue-800 font-medium hover:underline cursor-pointer"
                        >
                          Switch
                        </button>
                      )}
                      {!isSulani && !isSandip && (
                        <button
                          type="button"
                          onClick={() => handleRemoveEmail(email)}
                          className="text-neutral-400 hover:text-red-600 p-1 rounded cursor-pointer"
                          title="Remove user"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add New Email Form */}
          <form onSubmit={handleAddEmail} className="space-y-2 pt-1">
            <label className="text-[11px] font-semibold text-neutral-600 block">
              Authorize New Team Member / Accountant
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="accountant@company.ca"
                className="flex-1 px-3 py-1.5 text-xs border border-neutral-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-red-500"
              />
              <button
                type="submit"
                disabled={!newEmail.trim()}
                className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </form>

          {/* CRA Security Guarantee */}
          <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-[11px] text-neutral-600 flex items-start gap-2">
            <Lock className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
            <p>
              Corporate records remain protected. Users must sign in to view, edit, or sync CRA T2 corporate tax schedules and receipt attachments.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};
