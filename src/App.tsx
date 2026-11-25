/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { FormSchema, AutomationSettings, BatchRecord } from './types/form';
import { defaultFormSchema, defaultBatchRecords } from './utils/defaultForm';
import { Header, AppTab } from './components/Header';
import { SimplifiedRig50Submitter } from './components/SimplifiedRig50Submitter';
import { MassCardSubmitter } from './components/MassCardSubmitter';
import { OperationsPdfReader } from './components/OperationsPdfReader';
import { CrewManager } from './components/CrewManager';
import { WhatsAppSOARBot } from './components/WhatsAppSOARBot';
import { EmailAndPdfManager } from './components/EmailAndPdfManager';
import { LiveSimulator } from './components/LiveSimulator';
import { ScriptGenerator } from './components/ScriptGenerator';
import { TroubleshootingGuide } from './components/TroubleshootingGuide';
import { SupervisorAuthProvider, useSupervisor } from './context/SupervisorAuthContext';
import { SupervisorLoginModal } from './components/SupervisorLoginModal';
import { SupervisorPortalSettingsModal } from './components/SupervisorPortalSettingsModal';
import { PortalLockdownScreen } from './components/PortalLockdownScreen';
import { Footer } from './components/Footer';
import { CheckCircle2, Lock, Shield, Database, Brain, Sparkles } from 'lucide-react';
import { testFirestoreConnection, subscribeToAiTrainingIdeas } from './firebase';
import { AiTrainingModal } from './components/AiTrainingModal';

function AppContent() {
  const { isSupervisor, portalLockedDown, tabPermissions } = useSupervisor();
  const [activeTab, setActiveTab] = useState<AppTab>('online');
  const [schema] = useState<FormSchema>(defaultFormSchema);
  const [records] = useState<BatchRecord[]>(defaultBatchRecords);
  const [dbConnected, setDbConnected] = useState<boolean>(true);
  const [isAiTrainingOpen, setIsAiTrainingOpen] = useState<boolean>(false);
  const [activeIdeasCount, setActiveIdeasCount] = useState<number>(0);

  // Initialize and test connection to Firestore database on startup & subscribe to AI training ideas
  useEffect(() => {
    testFirestoreConnection().then(connected => {
      setDbConnected(connected);
    });

    const unsub = subscribeToAiTrainingIdeas((ideas) => {
      setActiveIdeasCount(ideas.filter(i => i && i.isActive !== false).length);
    });

    const handleOpen = () => {
      if (isSupervisor) {
        setIsAiTrainingOpen(true);
      }
    };
    const handleNavigateMass = () => {
      if (isSupervisor) {
        setIsAiTrainingOpen(false);
        setActiveTab('mass');
      }
    };
    window.addEventListener('open_rig50_ai_training', handleOpen);
    window.addEventListener('rig50_navigate_to_mass', handleNavigateMass);

    return () => {
      unsub();
      window.removeEventListener('open_rig50_ai_training', handleOpen);
      window.removeEventListener('rig50_navigate_to_mass', handleNavigateMass);
    };
  }, [isSupervisor]);

  const [settings, setSettings] = useState<AutomationSettings>({
    language: 'playwright',
    executionMode: 'batch_csv',
    headless: false,
    humanTypingDelay: true,
    retryAttempts: 2,
    timeoutSeconds: 30,
    csvFileName: 'form_data.csv',
    takeScreenshots: true
  });

  // Ensure non-supervisor cannot stay on a hidden tab if switched out
  useEffect(() => {
    if (!isSupervisor) {
      const isAllowed = tabPermissions[activeTab as keyof typeof tabPermissions];
      if (!isAllowed) {
        setActiveTab('online');
      }
    }
  }, [isSupervisor, tabPermissions, activeTab]);

  // If supervisor has locked down the entire website and visitor is not authenticated
  if (portalLockedDown && !isSupervisor) {
    return (
      <>
        <SupervisorLoginModal onSuccessNavigate={(tabName) => setActiveTab(tabName as AppTab)} />
        <PortalLockdownScreen />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans">
      {/* Supervisor Login Modal */}
      <SupervisorLoginModal onSuccessNavigate={(tabName) => setActiveTab(tabName as AppTab)} />

      {/* Supervisor Portal & Visibility Settings Modal */}
      <SupervisorPortalSettingsModal />

      {/* AI Training & Custom Ideas Modal (Supervisor Only) */}
      {isSupervisor && (
        <AiTrainingModal isOpen={isAiTrainingOpen} onClose={() => setIsAiTrainingOpen(false)} />
      )}

      {/* Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        formTitle={schema.title}
        onOpenAiTraining={isSupervisor ? () => setIsAiTrainingOpen(true) : undefined}
        activeIdeasCount={activeIdeasCount}
      />

      {/* Verified Rig 50 Status Banner */}
      <div className="bg-emerald-950 text-emerald-100 border-b border-emerald-900 text-xs py-2 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-900 text-emerald-200 font-bold text-[11px] border border-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              LIVE CONNECTED
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-teal-900/80 text-teal-200 font-bold text-[11px] border border-teal-700">
              <Database className="w-3.5 h-3.5 text-teal-300" />
              {dbConnected ? 'DATABASE ACTIVE' : 'LOCAL CACHE'}
            </span>
            <span className="font-semibold text-white">
              Stop Observe Act Report-(SOAR)
            </span>
            <span className="text-emerald-300">· Target: 50 Bob Palmer (RBP-50A)</span>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-300">
            {isSupervisor && (
              <button
                type="button"
                onClick={() => setIsAiTrainingOpen(true)}
                className="bg-purple-900/90 hover:bg-purple-800 text-purple-200 px-2.5 py-0.5 rounded border border-purple-700 flex items-center gap-1.5 font-sans cursor-pointer transition-colors shadow-2xs"
                title="Supervisor Only: Teach Gemini AI with your own ideas, scenarios, and exemplar cards"
              >
                <Brain className="w-3.5 h-3.5 text-purple-300" />
                <span className="font-bold">Train AI with Cards ({activeIdeasCount} Ideas)</span>
              </button>
            )}
            <span className="bg-emerald-900/80 px-2 py-0.5 rounded border border-emerald-800 hidden md:inline">
              Firestore Database Active
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* TAB 1: QUICK SUBMITTER (DEFAULT FOR CREW) */}
        {activeTab === 'online' && (
          <SimplifiedRig50Submitter />
        )}

        {/* TAB 2: WHATSAPP BOT CHAT & WEBHOOK */}
        {activeTab === 'whatsapp' && (
          <WhatsAppSOARBot />
        )}

        {/* TAB 3: CREW MEMBERS ROSTER & NAMES */}
        {activeTab === 'crew' && (
          <CrewManager />
        )}

        {/* TAB 4: MASS SUBMITTER (1000s CARDS RUNNER - SUPERVISOR PROTECTED) */}
        {activeTab === 'mass' && (
          <MassCardSubmitter />
        )}

        {/* TAB 5: OPERATIONS PDF READER & SOAR SYNTHESIZER (SUPERVISOR PROTECTED) */}
        {activeTab === 'operations' && (
          <OperationsPdfReader />
        )}

        {/* TAB 6: PDF GENERATION & EMAIL DISPATCH */}
        {activeTab === 'emailPdf' && (
          <EmailAndPdfManager />
        )}

        {/* TAB 7: LIVE SIMULATOR & PAGINATION INSPECTOR */}
        {activeTab === 'simulator' && (
          <LiveSimulator schema={schema} records={records} />
        )}

        {/* TAB 8: SCRIPTS & POWER AUTOMATE */}
        {activeTab === 'scripts' && (
          <div className="space-y-6">
            <ScriptGenerator
              schema={schema}
              settings={settings}
              setSettings={setSettings}
            />
            <TroubleshootingGuide />
          </div>
        )}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <SupervisorAuthProvider>
      <AppContent />
    </SupervisorAuthProvider>
  );
}
