import React from 'react';
import { 
  FileText, 
  Layers, 
  PlayCircle, 
  Sparkles, 
  Lock, 
  MessageSquare,
  Rocket,
  Users,
  FileCheck,
  Shield,
  Sliders,
  LogOut,
  KeyRound,
  Code2,
  Brain
} from 'lucide-react';
import { useSupervisor } from '../context/SupervisorAuthContext';

export type AppTab = 'online' | 'mass' | 'operations' | 'crew' | 'whatsapp' | 'emailPdf' | 'simulator' | 'scripts';

interface HeaderProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  formTitle: string;
  onOpenAiTraining?: () => void;
  activeIdeasCount?: number;
}

export const Header: React.FC<HeaderProps> = ({ 
  activeTab, 
  setActiveTab, 
  onOpenAiTraining,
  activeIdeasCount = 0
}) => {
  const { 
    isSupervisor, 
    openLoginModal, 
    openSettingsModal, 
    logoutSupervisor, 
    tabPermissions,
    supervisorNumber 
  } = useSupervisor();

  // All available tabs configuration
  const allTabs: {
    id: AppTab;
    label: string;
    icon: React.ReactNode;
    supervisorOnly?: boolean;
    activeClass: string;
    inactiveClass: string;
    badge?: string;
  }[] = [
    {
      id: 'online',
      label: 'Quick Submitter',
      icon: <Sparkles className="w-4 h-4" />,
      activeClass: 'bg-teal-700 text-white shadow-2xs',
      inactiveClass: 'text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200'
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp Bot',
      icon: <MessageSquare className="w-4 h-4" />,
      activeClass: 'bg-[#25D366] text-white shadow-2xs',
      inactiveClass: 'text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
    },
    {
      id: 'crew',
      label: 'Crew Roster & Names',
      icon: <Users className="w-4 h-4 text-teal-600" />,
      activeClass: 'bg-slate-900 text-white shadow-2xs',
      inactiveClass: 'text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
    },
    {
      id: 'mass',
      label: 'Mass Submitter (1,000s Engine)',
      icon: <Rocket className="w-4 h-4 text-indigo-500" />,
      supervisorOnly: true,
      activeClass: 'bg-indigo-700 text-white shadow-2xs',
      inactiveClass: 'text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200',
      badge: 'Super'
    },
    {
      id: 'operations',
      label: 'Operations PDF &rarr; SOAR',
      icon: <FileCheck className="w-4 h-4 text-emerald-500" />,
      supervisorOnly: true,
      activeClass: 'bg-emerald-700 text-white shadow-2xs',
      inactiveClass: 'text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200',
      badge: 'Super'
    },
    {
      id: 'emailPdf',
      label: 'PDF & Email',
      icon: <FileText className="w-4 h-4" />,
      activeClass: 'bg-rose-700 text-white shadow-2xs',
      inactiveClass: 'text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200'
    },
    {
      id: 'simulator',
      label: 'Live Inspector',
      icon: <PlayCircle className="w-4 h-4" />,
      activeClass: 'bg-slate-900 text-white shadow-2xs',
      inactiveClass: 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
    },
    {
      id: 'scripts',
      label: 'Automation Scripts',
      icon: <Code2 className="w-4 h-4" />,
      supervisorOnly: true,
      activeClass: 'bg-slate-800 text-white shadow-2xs',
      inactiveClass: 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
    }
  ];

  // Filter tabs: Supervisors see everything. Crew ONLY sees tabs permitted in settings!
  const visibleTabs = allTabs.filter(tab => {
    if (isSupervisor) return true; // Supervisor sees all options
    return tabPermissions[tab.id as keyof typeof tabPermissions] === true;
  });

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-600 flex items-center justify-center text-white shadow-2xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-900 tracking-tight text-base sm:text-lg">
                  Rig 50 SOAR Cloud System
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold text-teal-800 bg-teal-50 border border-teal-200 rounded">
                  <Lock className="w-3 h-3 text-teal-700" />
                  Locked: 50 Bob Palmer (RBP-50A)
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate max-w-xs sm:max-w-md hidden sm:block">
                Stop Observe Act Report · Arabian Drilling / Aramco Operations
              </p>
            </div>
          </div>

          {/* Supervisor / Login Header Actions */}
          <div className="flex items-center gap-2">
            {/* Global Train AI Button (Supervisor Only) */}
            {isSupervisor && (
              <button
                type="button"
                onClick={onOpenAiTraining || (() => window.dispatchEvent(new CustomEvent('open_rig50_ai_training')))}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-900 text-xs font-bold rounded-lg border border-purple-200 transition-colors shadow-2xs"
                title="Supervisor Only: Train Gemini AI with your own ideas, cards, and specific rig scenarios"
              >
                <Brain className="w-3.5 h-3.5 text-purple-600" />
                <span className="hidden sm:inline">Train AI</span>
                <span className="px-1.5 py-0.2 bg-purple-600 text-white text-[9px] rounded-full font-bold">
                  {activeIdeasCount || 0}
                </span>
              </button>
            )}

            {isSupervisor ? (
              <div className="flex items-center gap-2">
                {/* Supervisor Status Badge */}
                <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-bold rounded-lg">
                  <Shield className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Supervisor:</span>
                  <span className="font-mono text-indigo-700">{supervisorNumber}</span>
                </div>

                {/* Portal Access Controls */}
                <button
                  type="button"
                  onClick={openSettingsModal}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg border border-slate-300 transition-colors shadow-2xs"
                  title="Configure portal visibility, lockdown, and your number"
                >
                  <Sliders className="w-3.5 h-3.5 text-slate-600" />
                  <span>Portal Controls</span>
                </button>

                {/* Logout / Lock Button */}
                <button
                  type="button"
                  onClick={logoutSupervisor}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg border border-rose-200 transition-colors"
                  title="Lock back to Crew View"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Lock Crew View</span>
                </button>
              </div>
            ) : (
              /* Public / Crew Login Button */
              <button
                type="button"
                onClick={() => openLoginModal()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
                title="Login with your phone number or PIN to show supervisor options"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Login (Show All Options)</span>
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Navigation Tabs (Only shows permitted options) */}
        <div className="flex space-x-1 sm:space-x-2 border-t border-slate-100 overflow-x-auto py-1 scrollbar-none">
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-bold rounded-md whitespace-nowrap transition-colors ${
                  isActive ? tab.activeClass : tab.inactiveClass
                }`}
              >
                {tab.icon}
                <span dangerouslySetInnerHTML={{ __html: tab.label }}></span>
                {tab.badge && isSupervisor && (
                  <span className="px-1.5 py-0.2 bg-indigo-600 text-white text-[9px] rounded font-bold ml-1">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
