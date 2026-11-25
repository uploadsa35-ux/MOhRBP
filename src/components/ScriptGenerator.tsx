import React, { useState } from 'react';
import { FormSchema, AutomationSettings } from '../types/form';
import { generatePlaywrightScript } from '../utils/generators/pythonPlaywright';
import { generateSeleniumScript } from '../utils/generators/pythonSelenium';
import { generatePowerAutomateDesktopGuide } from '../utils/generators/powerAutomateDesktop';
import { generateCloudFlowGuide } from '../utils/generators/powerAutomateCloud';
import { 
  Copy, 
  Check, 
  Download, 
  Terminal, 
  ShieldCheck, 
  Clock, 
  Sliders, 
  AlertTriangle,
  FileCode,
  Workflow,
  CloudLightning,
  Sparkles,
  ChevronDown,
  Layers
} from 'lucide-react';

interface ScriptGeneratorProps {
  schema: FormSchema;
  settings: AutomationSettings;
  setSettings: React.Dispatch<React.SetStateAction<AutomationSettings>>;
}

export const ScriptGenerator: React.FC<ScriptGeneratorProps> = ({
  schema,
  settings,
  setSettings
}) => {
  const [copied, setCopied] = useState(false);
  const [padView, setPadView] = useState<'robin' | 'steps'>('robin');

  const updateSetting = <K extends keyof AutomationSettings>(key: K, value: AutomationSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  // Generate contents based on active selection
  const playwrightCode = generatePlaywrightScript(schema, settings);
  const seleniumCode = generateSeleniumScript(schema, settings);
  const padData = generatePowerAutomateDesktopGuide(schema, settings);
  const cloudData = generateCloudFlowGuide(schema);

  const getCurrentCode = () => {
    switch (settings.language) {
      case 'playwright':
        return playwrightCode;
      case 'selenium':
        return seleniumCode;
      case 'power_automate_desktop':
        return padData.robinScript;
      case 'power_automate_cloud':
        return cloudData.samplePayloadJson;
      default:
        return playwrightCode;
    }
  };

  const getFileName = () => {
    switch (settings.language) {
      case 'playwright':
        return 'submit_ms_forms_playwright.py';
      case 'selenium':
        return 'submit_ms_forms_selenium.py';
      case 'power_automate_desktop':
        return 'ms_forms_pad_flow.txt';
      case 'power_automate_cloud':
        return 'forms_api_payload.json';
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getCurrentCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const text = getCurrentCode();
    const filename = getFileName();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Selector: Choose Automation Stack */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs">
        <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <Workflow className="w-4 h-4 text-teal-600" />
          <span>Select Automation Engine &amp; Solution</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Playwright */}
          <button
            onClick={() => updateSetting('language', 'playwright')}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              settings.language === 'playwright'
                ? 'bg-teal-50/70 border-teal-500 ring-2 ring-teal-500/20 shadow-xs'
                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                <FileCode className="w-4 h-4 text-teal-600" />
                Python Playwright
              </span>
              <span className="text-[10px] font-bold text-teal-700 bg-teal-100 px-1.5 py-0.5 rounded">
                Recommended
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Auto-waiting, resists DOM shifts, built for modern Microsoft SPAs.
            </p>
          </button>

          {/* Selenium */}
          <button
            onClick={() => updateSetting('language', 'selenium')}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              settings.language === 'selenium'
                ? 'bg-teal-50/70 border-teal-500 ring-2 ring-teal-500/20 shadow-xs'
                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                <FileCode className="w-4 h-4 text-amber-600" />
                Python Selenium
              </span>
              <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                Classic
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Standard WebDriver using explicit WebDriverWait for pagination.
            </p>
          </button>

          {/* Power Automate Desktop */}
          <button
            onClick={() => updateSetting('language', 'power_automate_desktop')}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              settings.language === 'power_automate_desktop'
                ? 'bg-teal-50/70 border-teal-500 ring-2 ring-teal-500/20 shadow-xs'
                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                <Workflow className="w-4 h-4 text-blue-600" />
                Power Automate (PAD)
              </span>
              <span className="text-[10px] text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                Desktop
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Native Windows Edge/Chrome RPA script. No coding needed.
            </p>
          </button>

          {/* Power Automate Cloud */}
          <button
            onClick={() => updateSetting('language', 'power_automate_cloud')}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              settings.language === 'power_automate_cloud'
                ? 'bg-teal-50/70 border-teal-500 ring-2 ring-teal-500/20 shadow-xs'
                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                <CloudLightning className="w-4 h-4 text-purple-600" />
                Power Automate (Cloud)
              </span>
              <span className="text-[10px] text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">
                Direct API
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Bypasses UI pagination via direct HTTP POST responses endpoint.
            </p>
          </button>
        </div>
      </div>

      {/* Script Options Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="font-semibold text-slate-700 flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-slate-500" />
              Runtime Config:
            </span>

            {/* Execution mode: Single vs Batch */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => updateSetting('executionMode', 'single')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  settings.executionMode === 'single'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Single Test Run
              </button>
              <button
                onClick={() => updateSetting('executionMode', 'batch_csv')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  settings.executionMode === 'batch_csv'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Batch (from CSV)
              </button>
            </div>

            {/* Headless Toggle for Python */}
            {(settings.language === 'playwright' || settings.language === 'selenium') && (
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                <input
                  type="checkbox"
                  checked={settings.headless}
                  onChange={(e) => updateSetting('headless', e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span>Headless browser</span>
              </label>
            )}

            {/* Human Delays */}
            {(settings.language === 'playwright' || settings.language === 'selenium') && (
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                <input
                  type="checkbox"
                  checked={settings.humanTypingDelay}
                  onChange={(e) => updateSetting('humanTypingDelay', e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span>Anti-bot jitter delays</span>
              </label>
            )}

            {/* Take screenshots */}
            {(settings.language === 'playwright' || settings.language === 'selenium') && (
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                <input
                  type="checkbox"
                  checked={settings.takeScreenshots}
                  onChange={(e) => updateSetting('takeScreenshots', e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span>Screenshot confirmations</span>
              </label>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors border border-slate-300"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Code</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download {getFileName()}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Pagination Solution Explanation Banner */}
      <div className="bg-teal-50/80 border border-teal-200 rounded-xl p-4 text-xs text-teal-950 space-y-2">
        <div className="flex items-center gap-2 font-bold text-teal-900">
          <Sparkles className="w-4 h-4 text-teal-600" />
          <span>How this code specifically solves Microsoft Forms 2-Page Pagination:</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <div className="bg-white/80 p-2.5 rounded-lg border border-teal-100">
            <span className="font-semibold block text-slate-900 mb-0.5">1. Multi-fallback Click on Next</span>
            <span className="text-slate-600 text-[11px]">
              Finds Next via <code className="bg-slate-100 px-1 py-0.2 rounded font-mono">button[data-automation-id="nextButton"]</code>, scrolls it into view, and triggers click.
            </span>
          </div>

          <div className="bg-white/80 p-2.5 rounded-lg border border-teal-100">
            <span className="font-semibold block text-slate-900 mb-0.5">2. Page 2 DOM Hydration Wait</span>
            <span className="text-slate-600 text-[11px]">
              Waits for <code className="bg-slate-100 px-1 py-0.2 rounded font-mono">button[data-automation-id="backButton"]</code> and question items to appear before interacting. Prevents stale element errors.
            </span>
          </div>

          <div className="bg-white/80 p-2.5 rounded-lg border border-teal-100">
            <span className="font-semibold block text-slate-900 mb-0.5">3. Submission Confirmation</span>
            <span className="text-slate-600 text-[11px]">
              Clicks Submit, waits for <code className="bg-slate-100 px-1 py-0.2 rounded font-mono">div[data-automation-id="thankYouMessage"]</code>, and verifies receipt before continuing.
            </span>
          </div>
        </div>
      </div>

      {/* View Options for Power Automate Desktop */}
      {settings.language === 'power_automate_desktop' && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700">Display View:</span>
          <div className="flex bg-slate-200 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setPadView('robin')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                padView === 'robin' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Direct Robin Code (Copy-Paste into PAD)
            </button>
            <button
              onClick={() => setPadView('steps')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                padView === 'steps' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Visual Step-by-Step Actions Guide
            </button>
          </div>
        </div>
      )}

      {/* Step by step table for PAD if selected */}
      {settings.language === 'power_automate_desktop' && padView === 'steps' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-sm text-slate-900">
                Power Automate Desktop Visual Flow Actions
              </h3>
              <p className="text-xs text-slate-500">
                Follow these exact steps in the Power Automate Desktop flow designer.
              </p>
            </div>
            <button
              onClick={handleCopy}
              className="text-xs text-teal-700 hover:text-teal-900 font-semibold"
            >
              Copy Robin Script instead
            </button>
          </div>
          <div className="divide-y divide-slate-200">
            {padData.steps.map((st) => (
              <div key={st.step} className="p-4 hover:bg-slate-50/50 flex flex-col md:flex-row gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 font-bold flex items-center justify-center text-sm shrink-0 border border-blue-200">
                  {st.step}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">{st.actionName}</span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                      {st.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">{st.description}</p>
                  <div className="text-[11px] font-mono text-teal-800 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                    Selector: {st.selectorOrDetail}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cloud Flow Explanation & Endpoint */}
      {settings.language === 'power_automate_cloud' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-1">
              Power Automate Cloud Flow &amp; Forms REST API
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {cloudData.overview}
            </p>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-800">HTTP Submission Endpoint:</span>
            <div className="p-3 bg-slate-900 text-teal-300 font-mono text-xs rounded-lg overflow-x-auto whitespace-pre">
              {cloudData.httpEndpointExample}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-800">How to setup in Cloud Flow:</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {cloudData.stepGuide.map((g, idx) => (
                <div key={idx} className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 text-xs">
                  <div className="font-semibold text-slate-900 mb-1">{g.step}</div>
                  <div className="text-slate-600 leading-relaxed">{g.detail}</div>
                  {g.tip && <div className="mt-1 text-[11px] text-amber-700 italic">💡 {g.tip}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Code Editor & Viewer Box */}
      {!(settings.language === 'power_automate_desktop' && padView === 'steps') && (
        <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-md">
          {/* Editor Header Bar */}
          <div className="bg-slate-900 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-300 font-mono">
              <Terminal className="w-4 h-4 text-teal-400" />
              <span>{getFileName()}</span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">
                {settings.language === 'playwright' && 'Python 3.8+ · Playwright sync_api'}
                {settings.language === 'selenium' && 'Python 3.8+ · Selenium WebDriver'}
                {settings.language === 'power_automate_desktop' && 'PAD Robin Language · Copy directly into Flow Designer'}
                {settings.language === 'power_automate_cloud' && 'JSON Request Body · HTTP POST'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono rounded text-[11px] flex items-center gap-1 transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Quick installation reminder for Python */}
          {(settings.language === 'playwright' || settings.language === 'selenium') && (
            <div className="bg-slate-900/90 px-4 py-2 border-b border-slate-800/60 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <div className="flex items-center gap-2">
                <span className="text-teal-400 font-bold">$</span>
                <span>
                  {settings.language === 'playwright' 
                    ? 'pip install playwright pandas && playwright install chromium' 
                    : 'pip install selenium pandas webdriver-manager'}
                </span>
              </div>
              <span className="text-slate-400">Run in your terminal</span>
            </div>
          )}

          {/* Code Body */}
          <pre className="p-4 text-xs font-mono text-slate-200 overflow-x-auto max-h-[580px] leading-relaxed selection:bg-teal-800">
            <code>{getCurrentCode()}</code>
          </pre>
        </div>
      )}
    </div>
  );
};
