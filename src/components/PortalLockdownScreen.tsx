import React from 'react';
import { useSupervisor } from '../context/SupervisorAuthContext';
import { Shield, Lock, KeyRound, AlertTriangle } from 'lucide-react';

export const PortalLockdownScreen: React.FC = () => {
  const { openLoginModal } = useSupervisor();

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 select-none">
      <div className="max-w-md w-full text-center space-y-6 animate-in fade-in">
        {/* Shield Icon */}
        <div className="w-20 h-20 rounded-3xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-400 shadow-2xl">
          <Lock className="w-10 h-10 text-indigo-400" />
        </div>

        {/* Text */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-bold">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>PORTAL LOCKED BY SUPERVISOR</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Rig 50 SOAR Cloud System
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
            This safety observation platform is currently restricted. All options are temporarily locked by the Rig Safety Officer / Supervisor.
          </p>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => openLoginModal()}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <KeyRound className="w-4 h-4" />
            <span>Login with Number / Passcode</span>
          </button>
        </div>

        <p className="text-[11px] text-slate-500">
          50 Bob Palmer (RBP-50A) · Arabian Drilling / Aramco Operations
        </p>
      </div>
    </div>
  );
};
