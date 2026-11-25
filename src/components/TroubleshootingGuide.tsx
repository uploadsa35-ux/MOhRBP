import React from 'react';
import { 
  ShieldAlert, 
  Key, 
  HelpCircle, 
  CheckCircle2, 
  Code2, 
  ExternalLink, 
  Zap, 
  Terminal,
  Cpu,
  Layers
} from 'lucide-react';

export const TroubleshootingGuide: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-teal-600" />
          <span>Microsoft Forms 2-Page Pagination &amp; Automation Playbook</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Everything you need to know about pagination traps, SSO/MFA logins, selector resilience, and Power Automate vs Python trade-offs.
        </p>
      </div>

      {/* Grid of Key Topics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Topic 1: The Pagination Trap */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-teal-900 font-semibold text-sm">
            <Layers className="w-4 h-4 text-teal-600" />
            <span>1. Why 2-Page Forms Break Generic Scripts</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Microsoft Forms is a modern React Single-Page Application (SPA). When you click the <strong>Next</strong> button:
          </p>
          <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4">
            <li>Page 1 questions are unmounted or set to <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px]">display: none</code>.</li>
            <li>Page 2 questions are dynamically rendered with a 200–500ms slide animation.</li>
            <li>If your script tries to find Page 2 questions immediately after clicking Next, it throws a <code className="bg-rose-50 text-rose-700 px-1 py-0.5 rounded font-mono text-[11px]">NoSuchElementException</code> or <code className="bg-rose-50 text-rose-700 px-1 py-0.5 rounded font-mono text-[11px]">TimeoutError</code>.</li>
          </ul>
          <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-lg text-xs space-y-1">
            <span className="font-semibold text-teal-950">The Solution:</span>
            <p className="text-teal-900 leading-relaxed">
              Always wait for the <strong>Back button</strong> to become visible before locating Page 2 inputs:
            </p>
            <pre className="p-2 bg-slate-900 text-teal-300 font-mono text-[11px] rounded overflow-x-auto mt-1">
{`# Playwright
page.wait_for_selector('button[data-automation-id="backButton"]', state="visible")

# Selenium
WebDriverWait(driver, 10).until(EC.visibility_of_element_located((By.CSS_SELECTOR, "button[data-automation-id='backButton']")))`}
            </pre>
          </div>
        </div>

        {/* Topic 2: Handling Work/School SSO & MFA */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-teal-900 font-semibold text-sm">
            <Key className="w-4 h-4 text-amber-600" />
            <span>2. Handling Microsoft 365 Work/School Login (SSO/MFA)</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            If your Microsoft Form requires company credentials (not public/anonymous), do <strong>not</strong> hardcode passwords in the script. Instead, use a <strong>reusable browser session</strong>:
          </p>
          <div className="p-3 bg-slate-900 text-slate-200 rounded-lg text-xs space-y-2 font-mono">
            <span className="text-teal-400 block font-bold"># Step 1: Save session once interactively</span>
            <div className="text-[11px] text-slate-300">
{`with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    context = browser.new_context()
    page = context.new_page()
    page.goto("https://forms.office.com")
    # Log in manually with 2FA / Authenticator app
    input("Press Enter in terminal after logging in...")
    context.storage_state(path="ms_auth.json")`}
            </div>
            <span className="text-teal-400 block font-bold mt-2"># Step 2: Reuse session in automated runs</span>
            <div className="text-[11px] text-slate-300">
{`context = browser.new_context(storage_state="ms_auth.json")
# Opens form directly logged in without password prompt!`}
            </div>
          </div>
        </div>

        {/* Topic 3: Power Automate vs Python comparison */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-teal-900 font-semibold text-sm">
            <Cpu className="w-4 h-4 text-blue-600" />
            <span>3. Power Automate Desktop vs Python Comparison</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                  <th className="p-2">Criteria</th>
                  <th className="p-2">Python Playwright</th>
                  <th className="p-2">Power Automate Desktop</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="p-2 font-semibold">Environment</td>
                  <td className="p-2 text-slate-600">Cross-platform (Linux, Windows, Mac, Docker)</td>
                  <td className="p-2 text-slate-600">Windows 10/11 only</td>
                </tr>
                <tr>
                  <td className="p-2 font-semibold">Speed &amp; Reliability</td>
                  <td className="p-2 text-slate-600">Extremely fast, automated wait engine</td>
                  <td className="p-2 text-slate-600">Visual RPA, slower execution</td>
                </tr>
                <tr>
                  <td className="p-2 font-semibold">Corporate IT Approval</td>
                  <td className="p-2 text-slate-600">Requires Python installed</td>
                  <td className="p-2 text-slate-600">Pre-installed with Windows / Office 365</td>
                </tr>
                <tr>
                  <td className="p-2 font-semibold">SSO Login Ease</td>
                  <td className="p-2 text-slate-600">Requires storage_state export</td>
                  <td className="p-2 text-slate-600">Attaches to logged-in Edge browser easily</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Topic 4: Selector Reference */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-teal-900 font-semibold text-sm">
            <Code2 className="w-4 h-4 text-purple-600" />
            <span>4. Microsoft Forms DOM Selectors Cheat Sheet</span>
          </div>
          <p className="text-xs text-slate-600">
            Microsoft Forms relies heavily on <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px]">data-automation-id</code> tags which do not change across languages:
          </p>
          <div className="space-y-1.5 text-xs font-mono">
            <div className="flex justify-between p-2 bg-slate-50 rounded border border-slate-200">
              <span className="text-slate-600">Question Item:</span>
              <span className="text-teal-700">div[data-automation-id="questionItem"]</span>
            </div>
            <div className="flex justify-between p-2 bg-slate-50 rounded border border-slate-200">
              <span className="text-slate-600">Next Button:</span>
              <span className="text-teal-700">button[data-automation-id="nextButton"]</span>
            </div>
            <div className="flex justify-between p-2 bg-slate-50 rounded border border-slate-200">
              <span className="text-slate-600">Back Button (P2):</span>
              <span className="text-teal-700">button[data-automation-id="backButton"]</span>
            </div>
            <div className="flex justify-between p-2 bg-slate-50 rounded border border-slate-200">
              <span className="text-slate-600">Submit Button:</span>
              <span className="text-teal-700">button[data-automation-id="submitButton"]</span>
            </div>
            <div className="flex justify-between p-2 bg-slate-50 rounded border border-slate-200">
              <span className="text-slate-600">Thank You Screen:</span>
              <span className="text-teal-700">div[data-automation-id="thankYouMessage"]</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
