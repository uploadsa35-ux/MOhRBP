import React, { useState } from 'react';
import { 
  FileText, 
  Mail, 
  Download, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Printer, 
  ExternalLink, 
  Sparkles, 
  Shield, 
  Layers, 
  Copy, 
  Check,
  Eye
} from 'lucide-react';
import { 
  RIG_50_NAME, 
  RIG_50_CREW_NAMES, 
  RIG_50_SCENARIOS, 
  Rig50Scenario 
} from '../utils/defaultForm';
import { 
  generateSoarPdf, 
  downloadSoarPdf, 
  getSoarPdfBase64, 
  SoarPdfData 
} from '../utils/pdfGenerator';

interface EmailAndPdfManagerProps {
  initialReport?: SoarPdfData;
}

export const EmailAndPdfManager: React.FC<EmailAndPdfManagerProps> = ({ initialReport }) => {
  // Report Data State
  const defaultData: SoarPdfData = initialReport || {
    responseId: 146608,
    date: new Date().toISOString().split('T')[0],
    rig: RIG_50_NAME,
    zone: 'Rig Floor',
    role: 'Driller',
    name: '', // Empty by default (Anonymous)
    assessment: 'Safe',
    obsType: 'Behavior Observation',
    category: 'Red Zone Control Failure',
    observation: 'During tubular running on rig floor, all crew members stayed completely outside the marked red zone perimeter while the elevators were moving.',
    action: 'Acknowledged the drill crew at the post-activity briefing; recorded as a positive intervention in SOAR system.'
  };

  const [report, setReport] = useState<SoarPdfData>(defaultData);
  const [recipientEmail, setRecipientEmail] = useState<string>('uploadsa35@gmail.com');
  const [emailSubject, setEmailSubject] = useState<string>(
    `[SOAR Report] Rig 50 (50 Bob Palmer) - ${report.assessment} - #${report.responseId || '146608'}`
  );
  
  // Status states
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);
  const [sendSuccess, setSendSuccess] = useState<boolean>(false);
  const [emailPreviewUrl, setEmailPreviewUrl] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  // Quick Preset Scenarios
  const handleLoadScenario = (s: Rig50Scenario) => {
    setReport(prev => ({
      ...prev,
      zone: s.zone,
      role: s.role,
      assessment: s.assessment,
      obsType: s.obsType,
      category: s.category,
      observation: s.observation,
      action: s.action
    }));
    setEmailSubject(`[SOAR Report] Rig 50 (50 Bob Palmer) - ${s.assessment} - #${report.responseId || '146608'}`);
  };

  // Actions
  const handleDownload = () => {
    downloadSoarPdf(report);
  };

  const handlePrint = () => {
    const doc = generateSoarPdf(report);
    const pdfBlob = doc.output('blob');
    const blobUrl = URL.createObjectURL(pdfBlob);
    window.open(blobUrl, '_blank');
  };

  const handleSendEmail = async () => {
    setIsSendingEmail(true);
    setSendSuccess(false);
    setEmailPreviewUrl(null);
    setSendError(null);

    try {
      // Generate PDF as base64
      const pdfBase64 = getSoarPdfBase64(report);

      const response = await fetch('/api/send-email-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: recipientEmail,
          subject: emailSubject,
          reportData: report,
          pdfBase64
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSendSuccess(true);
        if (data.previewUrl) {
          setEmailPreviewUrl(data.previewUrl);
        }
      } else {
        setSendError(data.error || 'Failed to send email.');
      }
    } catch (err: any) {
      setSendError(err.message || 'Network connection failed.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Mailto fallback link
  const mailtoLink = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(
    `Hello,\n\nPlease find attached the official SOAR Safety Observation Report for Rig 50 (50 Bob Palmer RBP-50A).\n\nReceipt Reference: #${report.responseId}\nZone: ${report.zone}\nAssessment: ${report.assessment}\nObserver: ${report.name || 'Anonymous (Confidential)'}\n\nObservation:\n${report.observation}\n\nAction Taken:\n${report.action}\n\n(Please attach the downloaded PDF to this email)\n\nBest regards,\nRig 50 Safety Management`
  )}`;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 rounded-xl p-5 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-400/30">
              <FileText className="w-5 h-5 text-teal-300" />
            </span>
            <h2 className="text-base sm:text-lg font-bold">
              PDF Generation &amp; Email Dispatch
            </h2>
          </div>
          <p className="text-xs text-teal-100/90 max-w-xl leading-relaxed">
            Generate formal HSE SOAR Safety Observation PDF cards for <strong>Rig 50 (50 Bob Palmer)</strong> and email them with the PDF attached directly to recipients or management.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 bg-teal-800 hover:bg-teal-700 text-white text-xs font-bold rounded-lg border border-teal-600 transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Print / View</span>
          </button>
        </div>
      </div>

      {/* Main Grid: PDF Preview on Left, Email Sender on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Visual SOAR PDF Document Card */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Document Header in Teal */}
          <div className="bg-[#03787C] text-white p-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-teal-200 block">
                  Official Safety Card · Rev-02
                </span>
                <h3 className="text-sm font-bold tracking-tight">
                  STOP OBSERVE ACT REPORT (SOAR)
                </h3>
                <p className="text-[11px] text-teal-100/80 mt-0.5">
                  50 Bob Palmer (RBP-50A)
                </p>
              </div>

              <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase shadow-xs ${
                report.assessment === 'Safe' ? 'bg-emerald-500 text-white' : 'bg-rose-600 text-white'
              }`}>
                {report.assessment}
              </span>
            </div>
          </div>

          {/* Document Body */}
          <div className="p-4 space-y-3.5 text-xs">
            {/* Metadata bar */}
            <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200 text-[11px]">
              <div>
                <span className="text-slate-500">Receipt Ref:</span>{' '}
                <strong className="text-teal-800 font-mono">#{report.responseId || '146608'}</strong>
              </div>
              <div>
                <span className="text-slate-500">Date:</span>{' '}
                <strong>{report.date}</strong>
              </div>
            </div>

            {/* Incident & Location Table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-200">
              <div className="grid grid-cols-3 p-2 bg-slate-50/70">
                <span className="text-slate-500 font-medium">Target Rig:</span>
                <span className="col-span-2 font-bold text-slate-900">50 Bob Palmer (RBP-50A)</span>
              </div>
              <div className="grid grid-cols-3 p-2">
                <span className="text-slate-500 font-medium">Zone / Area:</span>
                <span className="col-span-2 font-semibold text-slate-800">{report.zone}</span>
              </div>
              <div className="grid grid-cols-3 p-2 bg-slate-50/70">
                <span className="text-slate-500 font-medium">Observer Role:</span>
                <span className="col-span-2 text-slate-800">{report.role}</span>
              </div>
              <div className="grid grid-cols-3 p-2">
                <span className="text-slate-500 font-medium">Observer Name:</span>
                <span className="col-span-2 text-slate-800 font-mono text-[11px]">
                  {report.name ? report.name : <em className="text-slate-400">Anonymous / Empty (Confidential)</em>}
                </span>
              </div>
            </div>

            {/* Observation Section */}
            <div>
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">
                Description of Observation:
              </span>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 leading-relaxed text-[11px]">
                {report.observation}
              </div>
            </div>

            {/* Action Taken Section */}
            <div>
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide block mb-1">
                Corrective Action Taken / Intervention:
              </span>
              <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-emerald-950 leading-relaxed text-[11px]">
                {report.action}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-between border-t border-slate-200">
              <span className="text-[10px] text-slate-400">
                Official PDF Document format (A4)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded text-xs transition-colors border border-slate-200"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .pdf</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Email Sender with PDF Attachment */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
              <Mail className="w-4 h-4 text-teal-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Email Report with PDF Attached
                </h3>
                <p className="text-xs text-slate-500">
                  Sends the SOAR report email with the generated PDF attached.
                </p>
              </div>
            </div>

            {/* Recipient Input */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Recipient Email Address:
              </label>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="uploadsa35@gmail.com"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none font-mono"
              />
            </div>

            {/* Subject Line Input */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Email Subject:
              </label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>

            {/* Attachment Indicator */}
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-rose-500" />
                <div>
                  <span className="font-semibold text-slate-800 block">
                    SOAR_Rig50_Receipt_{report.responseId || '146608'}.pdf
                  </span>
                  <span className="text-[10px] text-slate-500">Official HSE Observation Document</span>
                </div>
              </div>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                Attached
              </span>
            </div>

            {/* Error Message */}
            {sendError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{sendError}</span>
              </div>
            )}

            {/* Success Message & Web Preview Link */}
            {sendSuccess && (
              <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 space-y-2 text-xs text-emerald-900">
                <div className="flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Email Dispatched Successfully!</span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  The email has been sent to <strong>{recipientEmail}</strong> with the official SOAR PDF attached.
                </p>

                {emailPreviewUrl && (
                  <div className="pt-1">
                    <a
                      href={emailPreviewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Sent Email &amp; Attachment Online</span>
                      <ExternalLink className="w-3 h-3 ml-0.5" />
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Send Buttons */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleSendEmail}
                disabled={isSendingEmail || !recipientEmail}
                className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all"
              >
                {isSendingEmail ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending Email with PDF Attachment...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Email with Attached PDF</span>
                  </>
                )}
              </button>

              <a
                href={mailtoLink}
                className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Open in Outlook / Gmail (Pre-filled Mailto)</span>
              </a>
            </div>
          </div>

          {/* Quick Scenario Selector to preview different reports */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-2">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
              Load Sample Rig 50 Safety Scenarios into PDF:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {RIG_50_SCENARIOS.slice(0, 4).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleLoadScenario(s)}
                  className="p-2 rounded border border-slate-200 bg-slate-50/60 hover:bg-slate-100 text-left transition-colors truncate"
                >
                  <span className="font-semibold text-slate-900 block truncate">{s.title}</span>
                  <span className="text-[10px] text-slate-500">{s.zone} · {s.assessment}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Cloud Automation Option: Power Automate Cloud Flow Email Automation */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
          <Layers className="w-4 h-4 text-blue-600" />
          <span>Automate Emails for All Submissions in Microsoft 365 (Power Automate)</span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          If you want every response submitted (via web or WhatsApp) to <strong>automatically generate a PDF and email it</strong> to safety managers or your inbox without any manual clicking:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1">
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
            <strong className="block text-slate-900 mb-1">Step 1: Automated Trigger</strong>
            <p className="text-slate-600 text-[11px]">
              In <a href="https://make.powerautomate.com" target="_blank" rel="noreferrer" className="text-blue-600 underline">make.powerautomate.com</a>, choose trigger: <strong>"When a new response is submitted"</strong> (Form: Stop Observe Act Report-(SOAR)).
            </p>
          </div>
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
            <strong className="block text-slate-900 mb-1">Step 2: Generate PDF</strong>
            <p className="text-slate-600 text-[11px]">
              Add action <strong>"Create file"</strong> (HTML content) &rarr; <strong>"Convert file"</strong> to PDF using the OneDrive connector.
            </p>
          </div>
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
            <strong className="block text-slate-900 mb-1">Step 3: Send Email (V2)</strong>
            <p className="text-slate-600 text-[11px]">
              Add Office 365 action <strong>"Send an email (V2)"</strong> to <code className="bg-slate-200 px-1 rounded font-mono">uploadsa35@gmail.com</code> with the converted PDF attached!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
