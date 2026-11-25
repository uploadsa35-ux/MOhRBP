import React, { useState, useEffect, useRef } from 'react';
import { FormSchema, BatchRecord } from '../types/form';
import { FormPreview } from './FormPreview';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  StepForward, 
  Terminal, 
  CheckCircle, 
  AlertTriangle, 
  Activity, 
  Zap, 
  Maximize2 
} from 'lucide-react';

interface LiveSimulatorProps {
  schema: FormSchema;
  records: BatchRecord[];
}

type SimulationStep = 
  | 'idle'
  | 'init_browser'
  | 'navigating'
  | 'filling_page_1'
  | 'clicking_next'
  | 'waiting_page_2'
  | 'filling_page_2'
  | 'submitting'
  | 'verifying'
  | 'completed';

interface LogEntry {
  id: string;
  time: string;
  level: 'info' | 'success' | 'warn' | 'dom';
  message: string;
}

export const LiveSimulator: React.FC<LiveSimulatorProps> = ({ schema, records }) => {
  const [currentStep, setCurrentStep] = useState<SimulationStep>('idle');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [speed, setSpeed] = useState<'normal' | 'fast'>('normal');
  const [selectedRecordIndex, setSelectedRecordIndex] = useState<number>(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [simulatedValues, setSimulatedValues] = useState<Record<string, any>>({});
  const [currentPage, setCurrentPage] = useState<1 | 2 | 3>(1);
  const [highlightSelector, setHighlightSelector] = useState<string | null>(null);

  const logEndRef = useRef<HTMLDivElement>(null);
  const activeRecord = records[selectedRecordIndex] || records[0];

  const addLog = (level: LogEntry['level'], message: string) => {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
    setLogs(prev => [...prev, {
      id: `log_${Date.now()}_${Math.random()}`,
      time: timeStr,
      level,
      message
    }]);
  };

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const stepDelay = speed === 'fast' ? 400 : 900;

  // State machine runner
  useEffect(() => {
    if (!isRunning) return;

    let timeoutId: any;

    const runNextState = () => {
      if (currentStep === 'idle') {
        setCurrentStep('init_browser');
        addLog('info', 'playwright.chromium.launch(headless=False, args=["--disable-blink-features=AutomationControlled"])');
        addLog('info', 'Created browser context: 1280x850 viewport, User-Agent: Chrome/126.0.0.0');
      } else if (currentStep === 'init_browser') {
        setCurrentStep('navigating');
        addLog('info', `page.goto("${schema.formUrl}", wait_until="networkidle")`);
      } else if (currentStep === 'navigating') {
        setCurrentStep('filling_page_1');
        setCurrentPage(1);
        addLog('dom', 'Detected Page 1: Waiting for div[data-automation-id="questionItem"] (count: ' + schema.page1.questions.length + ')');
        
        // Prepare page 1 values
        const p1Vals: Record<string, any> = {};
        schema.page1.questions.forEach((q, i) => {
          const val = activeRecord?.data[q.id] || q.defaultValue;
          p1Vals[q.id] = val;
          setTimeout(() => {
            setHighlightSelector(q.id);
            addLog('info', `[Page 1] Q${q.number} "${q.title}" -> Typed: "${Array.isArray(val) ? val.join(';') : val}"`);
          }, (i + 1) * (stepDelay * 0.4));
        });

        setTimeout(() => {
          setSimulatedValues(prev => ({ ...prev, ...p1Vals }));
          setHighlightSelector(null);
        }, schema.page1.questions.length * (stepDelay * 0.4));

      } else if (currentStep === 'filling_page_1') {
        setCurrentStep('clicking_next');
        setHighlightSelector('nextButton');
        addLog('dom', 'Locating Next button: button[data-automation-id="nextButton"]');
        addLog('info', 'page.locator("button[data-automation-id=\'nextButton\']").click()');
      } else if (currentStep === 'clicking_next') {
        setCurrentStep('waiting_page_2');
        setHighlightSelector(null);
        addLog('warn', '--> [CRITICAL PAGINATION WAIT] Waiting for Page 2 hydration: button[data-automation-id="backButton"]');
      } else if (currentStep === 'waiting_page_2') {
        setCurrentPage(2);
        setCurrentStep('filling_page_2');
        addLog('success', '✓ Page 2 mounted into DOM! Verified presence of Back button and question items.');
        
        // Prepare page 2 values
        const p2Vals: Record<string, any> = {};
        schema.page2.questions.forEach((q, i) => {
          const val = activeRecord?.data[q.id] || q.defaultValue;
          p2Vals[q.id] = val;
          setTimeout(() => {
            setHighlightSelector(q.id);
            addLog('info', `[Page 2] Q${q.number} "${q.title}" -> Selected/Typed: "${Array.isArray(val) ? val.join(';') : val}"`);
          }, (i + 1) * (stepDelay * 0.4));
        });

        setTimeout(() => {
          setSimulatedValues(prev => ({ ...prev, ...p2Vals }));
          setHighlightSelector(null);
        }, schema.page2.questions.length * (stepDelay * 0.4));

      } else if (currentStep === 'filling_page_2') {
        setCurrentStep('submitting');
        setHighlightSelector('submitButton');
        addLog('dom', 'Locating Submit button: button[data-automation-id="submitButton"]');
        addLog('info', 'page.locator("button[data-automation-id=\'submitButton\']").click()');
      } else if (currentStep === 'submitting') {
        setCurrentStep('verifying');
        setHighlightSelector(null);
        setCurrentPage(3);
        addLog('info', 'Waiting for confirmation: div[data-automation-id="thankYouMessage"]');
      } else if (currentStep === 'verifying') {
        setCurrentStep('completed');
        setIsRunning(false);
        setHighlightSelector('thankYouMessage');
        addLog('success', '🎉 SUBMISSION VERIFIED: "Your response was submitted" received successfully!');
        addLog('info', 'Response receipt recorded. Browser context safely closed.');
      }
    };

    timeoutId = setTimeout(runNextState, stepDelay);
    return () => clearTimeout(timeoutId);
  }, [isRunning, currentStep, stepDelay, schema, activeRecord]);

  const handleStart = () => {
    if (currentStep === 'completed') {
      handleReset();
    }
    setIsRunning(true);
    if (logs.length === 0) {
      addLog('info', `Initializing virtual test for record #${selectedRecordIndex + 1}...`);
    }
  };

  const handlePause = () => {
    setIsRunning(false);
    addLog('warn', 'Simulation paused by user.');
  };

  const handleReset = () => {
    setIsRunning(false);
    setCurrentStep('idle');
    setCurrentPage(1);
    setSimulatedValues({});
    setHighlightSelector(null);
    setLogs([]);
    addLog('info', 'Simulation reset. Ready for new automated run.');
  };

  const getStepProgress = () => {
    switch (currentStep) {
      case 'idle': return 0;
      case 'init_browser': return 10;
      case 'navigating': return 25;
      case 'filling_page_1': return 40;
      case 'clicking_next': return 55;
      case 'waiting_page_2': return 70;
      case 'filling_page_2': return 82;
      case 'submitting': return 92;
      case 'verifying': return 97;
      case 'completed': return 100;
    }
  };

  return (
    <div className="space-y-6">
      {/* Simulation Controls Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-teal-600" />
                <span>Live Browser Automation Test Runner</span>
              </h2>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                isRunning ? 'bg-emerald-100 text-emerald-800 animate-pulse' : 'bg-slate-100 text-slate-700'
              }`}>
                {isRunning ? 'RUNNING AUTOMATION' : currentStep === 'completed' ? 'SUCCESS' : 'READY'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Watch the exact step-by-step browser interaction, pagination transition, and DOM element hydration in real-time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Record selector */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="font-semibold">Test Record:</span>
              <select
                value={selectedRecordIndex}
                onChange={(e) => {
                  setSelectedRecordIndex(Number(e.target.value));
                  handleReset();
                }}
                disabled={isRunning}
                className="px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-mono"
              >
                {records.map((r, i) => (
                  <option key={r.id} value={i}>
                    #{i + 1} - {r.data.q1_name || `Record ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Speed toggle */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs">
              <button
                onClick={() => setSpeed('normal')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  speed === 'normal' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                Normal (0.9s)
              </button>
              <button
                onClick={() => setSpeed('fast')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  speed === 'fast' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                Fast (0.4s)
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {!isRunning ? (
                <button
                  onClick={handleStart}
                  className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{currentStep === 'completed' ? 'Rerun Automation' : 'Run Automation'}</span>
                </button>
              ) : (
                <button
                  onClick={handlePause}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors"
                >
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Pause</span>
                </button>
              )}

              <button
                onClick={handleReset}
                className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200"
                title="Reset Runner"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Progress Bar & Current Phase */}
        <div className="mt-4 space-y-1.5">
          <div className="flex justify-between text-xs font-medium text-slate-700">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-teal-500"></span>
              <span>Current Phase: </span>
              <strong className="text-teal-900 uppercase font-mono tracking-wider">
                {currentStep.replace(/_/g, ' ')}
              </strong>
            </span>
            <span className="font-mono text-slate-500">{getStepProgress()}%</span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
            <div
              className="bg-teal-600 h-full transition-all duration-300"
              style={{ width: `${getStepProgress()}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Grid: Virtual Browser on Left, Terminal Logs on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Virtual Form Viewport */}
        <div className="lg:col-span-7 h-[680px]">
          <FormPreview
            schema={schema}
            inspectMode={true}
            setInspectMode={() => {}}
            simulatedValues={simulatedValues}
            currentPageOverride={currentPage}
            highlightSelector={highlightSelector}
          />
        </div>

        {/* Terminal Logs & Automation State Output */}
        <div className="lg:col-span-5 flex flex-col h-[680px] bg-slate-950 rounded-xl border border-slate-800 shadow-md overflow-hidden">
          {/* Terminal Title Bar */}
          <div className="bg-slate-900 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-teal-400" />
              <span className="text-xs font-mono font-semibold text-slate-300">
                STDOUT / Automation Engine Log
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              {logs.length} entries
            </span>
          </div>

          {/* Terminal Console Output */}
          <div className="p-4 font-mono text-xs overflow-y-auto flex-1 space-y-2 select-text">
            {logs.length === 0 ? (
              <div className="text-slate-500 italic p-4 text-center">
                Click "Run Automation" to start the virtual browser session and inspect real-time pagination logs.
              </div>
            ) : (
              logs.map((log) => {
                let badgeClass = 'text-slate-400';
                if (log.level === 'success') badgeClass = 'text-emerald-400 font-bold';
                if (log.level === 'warn') badgeClass = 'text-amber-400 font-bold';
                if (log.level === 'dom') badgeClass = 'text-teal-400 font-bold';

                return (
                  <div key={log.id} className="leading-relaxed break-words text-slate-300">
                    <span className="text-slate-600 mr-2 text-[11px] select-none">
                      [{log.time}]
                    </span>
                    <span className={`mr-2 uppercase text-[10px] ${badgeClass}`}>
                      [{log.level}]
                    </span>
                    <span>{log.message}</span>
                  </div>
                );
              })
            )}
            <div ref={logEndRef} />
          </div>

          {/* Terminal Footer with Pagination Diagnostic Status */}
          <div className="bg-slate-900/90 p-3 border-t border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>Next Button: <span className="text-slate-200">button[data-automation-id="nextButton"]</span></span>
            </div>
            <div>
              <span>Back Button: <span className="text-slate-200">button[data-automation-id="backButton"]</span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
