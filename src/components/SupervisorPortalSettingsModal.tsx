import React, { useState } from 'react';
import { useSupervisor, TabPermissions } from '../context/SupervisorAuthContext';
import { 
  Shield, 
  Lock, 
  Eye, 
  EyeOff, 
  Smartphone, 
  Settings, 
  X, 
  Check, 
  AlertTriangle,
  RotateCcw,
  Sliders,
  LogOut
} from 'lucide-react';

export const SupervisorPortalSettingsModal: React.FC = () => {
  const { 
    settingsModalOpen, 
    closeSettingsModal, 
    portalLockedDown, 
    setPortalLockedDown, 
    tabPermissions, 
    toggleTabPermission, 
    resetPermissionsToDefault,
    supervisorNumber,
    updateSupervisorNumber,
    logoutSupervisor
  } = useSupervisor();

  const [numberInput, setNumberInput] = useState<string>(supervisorNumber);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  React.useEffect(() => {
    setNumberInput(supervisorNumber);
  }, [supervisorNumber, settingsModalOpen]);

  if (!settingsModalOpen) return null;

  const handleSaveNumber = (e: React.FormEvent) => {
    e.preventDefault();
    if (!numberInput.trim()) return;
    updateSupervisorNumber(numberInput.trim());
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const tabDescriptions: { key: keyof TabPermissions; label: string; desc: string; danger?: boolean }[] = [
    {
      key: 'online',
      label: 'Quick Submitter (1 Card)',
      desc: 'Standard form for crew members to report a single safety observation.'
    },
    {
      key: 'whatsapp',
      label: 'WhatsApp AI Coach Bot',
      desc: 'Conversational chat assistant with automated SOAR card drafting.'
    },
    {
      key: 'crew',
      label: 'Crew Roster & Names',
      desc: 'List of on-duty personnel for naming observers and recognized crew.'
    },
    {
      key: 'simulator',
      label: 'Live Verification Inspector',
      desc: 'Shows proof of submission and Microsoft Forms receipt checks.'
    },
    {
      key: 'emailPdf',
      label: 'PDF & Email Dispatcher',
      desc: 'Allows generating formatted PDF cards and emailing reports.'
    },
    {
      key: 'mass',
      label: 'Mass Submitter (1,000s Engine)',
      desc: 'High-throughput generator for submitting 10 to 1,000s of cards at once.',
      danger: true
    },
    {
      key: 'operations',
      label: 'Operations PDF Synthesizer',
      desc: 'Extracts Daily Drilling Reports (DDR) and creates dozens of cards.',
      danger: true
    },
    {
      key: 'scripts',
      label: 'Automation Scripts & Playwright',
      desc: 'Raw browser automation scripts and Power Automate payloads.',
      danger: true
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
                <span>Supervisor Portal &amp; Access Controls</span>
                <span className="text-[10px] bg-emerald-500/30 text-emerald-200 px-2 py-0.5 rounded border border-emerald-400/40">
                  Rig 50
                </span>
              </h3>
              <p className="text-[11px] text-slate-300">
                Control what the crew can see vs what remains secret and locked to you
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeSettingsModal}
            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-900">
          {/* 1. MASTER LOCKDOWN SWITCH */}
          <div className={`p-4 rounded-xl border transition-all ${
            portalLockedDown 
              ? 'bg-rose-50 border-rose-200 text-rose-900' 
              : 'bg-slate-50 border-slate-200 text-slate-800'
          }`}>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Lock className={`w-4 h-4 ${portalLockedDown ? 'text-rose-600' : 'text-slate-500'}`} />
                  <span className="font-bold text-xs sm:text-sm">
                    {portalLockedDown ? '🚨 Total Portal Lockdown ACTIVE' : 'Lock Entire Portal (Lock Everything)'}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed opacity-90">
                  {portalLockedDown 
                    ? 'The entire website is currently LOCKED. Crew members will only see a login screen requiring your number/PIN to access anything.' 
                    : 'When enabled, locks every single feature. Nobody can see or use anything until you unlock it.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPortalLockedDown(!portalLockedDown)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                  portalLockedDown
                    ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-xs'
                    : 'bg-slate-800 text-white hover:bg-slate-700'
                }`}
              >
                {portalLockedDown ? 'Unlock Portal' : 'Lock Everything Now'}
              </button>
            </div>
          </div>

          {/* 2. SUPERVISOR PHONE NUMBER / PIN SETTINGS */}
          <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-indigo-600" />
                <h4 className="font-bold text-xs text-indigo-950">Your Login Number / Passcode</h4>
              </div>
              <span className="text-[10px] text-indigo-700 font-mono bg-indigo-100 px-2 py-0.5 rounded">
                Active: {supervisorNumber}
              </span>
            </div>
            <p className="text-[11px] text-indigo-900/80 leading-relaxed">
              Type your personal phone number or PIN. When you enter this in the login box, all hidden options and mass engines will be unlocked for you.
            </p>

            <form onSubmit={handleSaveNumber} className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={numberInput}
                onChange={(e) => setNumberInput(e.target.value)}
                placeholder="e.g. +966501234567 or 5050"
                className="flex-1 px-3 py-2 bg-white border border-indigo-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-600"
              />
              <button
                type="submit"
                className="py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition-colors shrink-0"
              >
                Save Number
              </button>
            </form>

            {saveSuccess && (
              <div className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Updated! Use "{numberInput}" to log in next time.</span>
              </div>
            )}
          </div>

          {/* 3. INDIVIDUAL TAB VISIBILITY FOR CREW */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-teal-600" />
                  <span>Crew Menu Options (What Crew Sees When Logged Out)</span>
                </h4>
                <p className="text-[11px] text-slate-500">
                  Unchecked options are completely HIDDEN from the menu bar for regular crew.
                </p>
              </div>
              <button
                type="button"
                onClick={resetPermissionsToDefault}
                className="text-[10px] text-slate-500 hover:text-slate-800 flex items-center gap-1"
                title="Reset to recommended safe default"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Defaults</span>
              </button>
            </div>

            <div className="space-y-2 border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
              {tabDescriptions.map((item) => {
                const isVisible = tabPermissions[item.key];
                return (
                  <div 
                    key={item.key} 
                    className={`p-3 flex items-start justify-between gap-3 transition-colors ${
                      item.danger && isVisible ? 'bg-amber-50/50' : 'bg-white hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{item.label}</span>
                        {item.danger && (
                          <span className="text-[9px] bg-rose-100 text-rose-700 font-bold px-1.5 py-0.2 rounded border border-rose-200">
                            High-Risk
                          </span>
                        )}
                        {!isVisible && (
                          <span className="text-[9px] bg-slate-100 text-slate-600 font-semibold px-1.5 py-0.2 rounded">
                            Hidden from Crew
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-snug">{item.desc}</p>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                      <input
                        type="checkbox"
                        checked={isVisible}
                        onChange={(e) => toggleTabPermission(item.key, e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600"></div>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => {
              logoutSupervisor();
              closeSettingsModal();
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold text-xs rounded-xl transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Lock &amp; Exit Supervisor Mode</span>
          </button>

          <button
            type="button"
            onClick={closeSettingsModal}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
