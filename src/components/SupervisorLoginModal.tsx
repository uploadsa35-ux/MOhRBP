import React, { useState } from 'react';
import { useSupervisor } from '../context/SupervisorAuthContext';
import { Shield, KeyRound, AlertCircle, X, Check, Eye, EyeOff, Smartphone, Lock } from 'lucide-react';

interface SupervisorLoginModalProps {
  onSuccessNavigate?: (tabName: string) => void;
}

export const SupervisorLoginModal: React.FC<SupervisorLoginModalProps> = ({ onSuccessNavigate }) => {
  const { 
    loginModalOpen, 
    closeLoginModal, 
    loginWithNumberOrPin, 
    portalLockedDown,
    supervisorNumber 
  } = useSupervisor();

  const [inputVal, setInputVal] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showSecret, setShowSecret] = useState<boolean>(false);

  if (!loginModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) {
      setErrorMessage('Please enter your phone number or supervisor PIN.');
      return;
    }

    const success = loginWithNumberOrPin(inputVal);
    if (success) {
      setErrorMessage('');
      setInputVal('');
      if (onSuccessNavigate) {
        onSuccessNavigate('mass');
      }
    } else {
      setErrorMessage('Incorrect supervisor password or PIN. Access denied.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base flex items-center gap-1.5">
                <span>Supervisor / Admin Login</span>
                <span className="text-[10px] bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded border border-indigo-400/40">
                  Rig 50
                </span>
              </h3>
              <p className="text-[11px] text-slate-300">
                Unlock Mass Submitter &amp; Operations PDF Engine
              </p>
            </div>
          </div>
          {!portalLockedDown && (
            <button
              type="button"
              onClick={closeLoginModal}
              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-slate-900">
          <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-200/80 text-indigo-950 text-xs flex items-start gap-2.5">
            <Smartphone className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block">Enter Your Number or Passcode</span>
              <p className="text-[11px] text-indigo-900/80 leading-relaxed">
                Type your phone number or supervisor PIN to reveal the <strong>Mass Submitter</strong>, <strong>Operations DDR Extractor</strong>, and <strong>Portal Lockdown Controls</strong>.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>Your Phone Number or PIN:</span>
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1"
                >
                  {showSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showSecret ? 'Hide' : 'Show'}</span>
                </button>
              </label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  autoFocus
                  value={inputVal}
                  onChange={(e) => {
                    setInputVal(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="e.g. 5050 or your phone number"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                />
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            {errorMessage && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Login &amp; Show All Options</span>
              </button>
              {!portalLockedDown && (
                <button
                  type="button"
                  onClick={closeLoginModal}
                  className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Default PIN: <strong className="font-mono text-slate-700 font-bold">5050</strong></span>
            <span>RBP-50A · Offshore</span>
          </div>
        </div>
      </div>
    </div>
  );
};
