import React, { useState } from 'react';
import { X, Building2, Check, ShieldCheck } from 'lucide-react';
import { CompanyProfile, CanadianProvince } from '../types';
import { PROVINCES } from '../constants/canadianTax';

interface CompanyProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: CompanyProfile;
  onSave: (updated: CompanyProfile) => void;
}

export const CompanyProfileModal: React.FC<CompanyProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSave,
}) => {
  const [legalName, setLegalName] = useState(profile.legalName);
  const [operatingName, setOperatingName] = useState(profile.operatingName || '');
  const [businessNumber, setBusinessNumber] = useState(profile.businessNumber);
  const [gstHstNumber, setGstHstNumber] = useState(profile.gstHstNumber || '');
  const [province, setProvince] = useState<CanadianProvince>(profile.province);
  const [isGstRegistered, setIsGstRegistered] = useState(profile.isGstRegistered);
  const [accountantName, setAccountantName] = useState(profile.accountantName || '');
  const [accountantEmail, setAccountantEmail] = useState(profile.accountantEmail || '');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      legalName: legalName.trim() || 'My Canadian Company Inc.',
      operatingName: operatingName.trim(),
      businessNumber: businessNumber.trim(),
      gstHstNumber: gstHstNumber.trim(),
      province,
      isGstRegistered,
      fiscalYearEndMonth: 12,
      accountantName: accountantName.trim(),
      accountantEmail: accountantEmail.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-neutral-200 overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900">
                Canadian Business & Tax Profile
              </h2>
              <p className="text-xs text-neutral-500">
                Configures CRA corporate tax schedules and accountant communications
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Company Legal Name */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              Legal Business / Corporate Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="e.g. Northern Maple Solutions Inc."
              className="w-full px-3.5 py-2 bg-white border border-neutral-300 rounded-xl text-xs font-semibold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-500 shadow-2xs"
            />
          </div>

          {/* Operating Name (DBA) */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              Operating / Trade Name (Optional)
            </label>
            <input
              type="text"
              value={operatingName}
              onChange={(e) => setOperatingName(e.target.value)}
              placeholder="e.g. Northern Maple Tech"
              className="w-full px-3.5 py-2 bg-white border border-neutral-300 rounded-xl text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-500 shadow-2xs"
            />
          </div>

          {/* Province & CRA Business Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Registered Province
              </label>
              <select
                value={province}
                onChange={(e) => setProvince(e.target.value as CanadianProvince)}
                className="w-full px-3.5 py-2 bg-white border border-neutral-300 rounded-xl text-xs font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-500 shadow-2xs"
              >
                {Object.values(PROVINCES).map((prov) => (
                  <option key={prov.code} value={prov.code}>
                    {prov.name} ({prov.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                CRA Business Number (BN)
              </label>
              <input
                type="text"
                value={businessNumber}
                onChange={(e) => setBusinessNumber(e.target.value)}
                placeholder="123456789 RC0001"
                className="w-full px-3.5 py-2 bg-white border border-neutral-300 rounded-xl text-xs font-mono text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-500 shadow-2xs"
              />
            </div>
          </div>

          {/* GST/HST Registration */}
          <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isGstRegistered}
                onChange={(e) => setIsGstRegistered(e.target.checked)}
                className="w-4 h-4 rounded text-red-600 focus:ring-red-500 border-neutral-300"
              />
              <span className="text-xs font-semibold text-neutral-800">
                Registered for GST / HST (Input Tax Credits Enabled)
              </span>
            </label>

            {isGstRegistered && (
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                  GST/HST Account Number (CRA RT Account)
                </label>
                <input
                  type="text"
                  value={gstHstNumber}
                  onChange={(e) => setGstHstNumber(e.target.value)}
                  placeholder="123456789 RT0001"
                  className="w-full px-3 py-1.5 bg-white border border-neutral-300 rounded-lg text-xs font-mono text-neutral-800"
                />
              </div>
            )}
          </div>

          {/* Accountant's Details for Send to Accountant feature */}
          <div className="pt-2 border-t border-neutral-200 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-800">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>Your Accountant / CPA Information</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                  Accountant / CPA Name
                </label>
                <input
                  type="text"
                  value={accountantName}
                  onChange={(e) => setAccountantName(e.target.value)}
                  placeholder="e.g. Sarah Jenkins, CPA"
                  className="w-full px-3.5 py-2 bg-white border border-neutral-300 rounded-xl text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                  Accountant Email Address
                </label>
                <input
                  type="email"
                  value={accountantEmail}
                  onChange={(e) => setAccountantEmail(e.target.value)}
                  placeholder="accountant@cpafirm.ca"
                  className="w-full px-3.5 py-2 bg-white border border-neutral-300 rounded-xl text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-red-500 shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-neutral-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Save Profile</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
