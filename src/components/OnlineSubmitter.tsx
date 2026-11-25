import React, { useState } from 'react';
import { FormSchema, BatchRecord } from '../types/form';
import { 
  CloudLightning, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Play, 
  Pause, 
  RotateCcw, 
  FileSpreadsheet, 
  Layers, 
  ExternalLink,
  ShieldCheck,
  Clock,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { USER_TENANT_ID, USER_OWNER_ID, USER_FORM_ID } from '../utils/defaultForm';

interface OnlineSubmitterProps {
  schema: FormSchema;
  records: BatchRecord[];
}

interface SubmissionLog {
  id: string;
  time: string;
  recordName: string;
  status: 'pending' | 'success' | 'failed';
  httpStatus?: number;
  message: string;
  responseId?: string;
}

export const OnlineSubmitter: React.FC<OnlineSubmitterProps> = ({ schema, records }) => {
  const [selectedRecordIndex, setSelectedRecordIndex] = useState<number>(0);
  const [isSubmittingSingle, setIsSubmittingSingle] = useState<boolean>(false);
  const [isSubmittingBatch, setIsSubmittingBatch] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [logs, setLogs] = useState<SubmissionLog[]>([]);
  const [onlineDelaySec, setOnlineDelaySec] = useState<number>(2.5);

  const activeRecord = records[selectedRecordIndex] || records[0];

  const formatAnswersPayload = (recordData: Record<string, string>) => {
    // Collect answers from both Page 1 and Page 2 questions
    const allQuestions = [...schema.page1.questions, ...schema.page2.questions];
    return allQuestions.map(q => {
      const val = recordData[q.id] !== undefined ? recordData[q.id] : q.defaultValue;
      return {
        questionId: q.id,
        answer1: Array.isArray(val) ? val.join(';') : String(val || '')
      };
    });
  };

  const handleSingleSubmit = async () => {
    setIsSubmittingSingle(true);
    const logId = `log_${Date.now()}`;
    const recordLabel = activeRecord?.data[schema.page1.questions[0]?.id || ''] || `Record #${selectedRecordIndex + 1}`;
    
    const newLog: SubmissionLog = {
      id: logId,
      time: new Date().toLocaleTimeString(),
      recordName: recordLabel,
      status: 'pending',
      message: 'Sending payload to Microsoft Forms cloud responses API...'
    };

    setLogs(prev => [newLog, ...prev]);

    try {
      const answers = formatAnswersPayload(activeRecord?.data || {});
      const response = await fetch('/api/submit-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: USER_TENANT_ID,
          userId: USER_OWNER_ID,
          formId: USER_FORM_ID,
          answers
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setLogs(prev => prev.map(l => l.id === logId ? {
          ...l,
          status: 'success',
          httpStatus: response.status,
          message: '✓ Response accepted by Microsoft Forms server! Stored in form responses.',
          responseId: data.data?.id || `ms_resp_${Date.now().toString().slice(-6)}`
        } : l));
      } else {
        setLogs(prev => prev.map(l => l.id === logId ? {
          ...l,
          status: 'failed',
          httpStatus: response.status,
          message: `Submission error: ${JSON.stringify(data.error || data)}`
        } : l));
      }
    } catch (err: any) {
      setLogs(prev => prev.map(l => l.id === logId ? {
        ...l,
        status: 'failed',
        message: `Network error: ${err.message}`
      } : l));
    } finally {
      setIsSubmittingSingle(false);
    }
  };

  const handleBatchSubmit = async () => {
    if (records.length === 0) return;
    setIsSubmittingBatch(true);
    setBatchProgress({ current: 0, total: records.length });

    for (let i = 0; i < records.length; i++) {
      setBatchProgress({ current: i + 1, total: records.length });
      const record = records[i];
      const logId = `batch_log_${Date.now()}_${i}`;
      const recordLabel = record.data[schema.page1.questions[0]?.id || ''] || `Record #${i + 1}`;

      const newLog: SubmissionLog = {
        id: logId,
        time: new Date().toLocaleTimeString(),
        recordName: recordLabel,
        status: 'pending',
        message: `[Batch ${i + 1}/${records.length}] Submitting to Microsoft Forms...`
      };

      setLogs(prev => [newLog, ...prev]);

      try {
        const answers = formatAnswersPayload(record.data);
        const response = await fetch('/api/submit-response', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId: USER_TENANT_ID,
            userId: USER_OWNER_ID,
            formId: USER_FORM_ID,
            answers
          })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setLogs(prev => prev.map(l => l.id === logId ? {
            ...l,
            status: 'success',
            httpStatus: response.status,
            message: '✓ Success! Response logged in Microsoft Forms.',
            responseId: data.data?.id || `ms_${Date.now().toString().slice(-6)}`
          } : l));
        } else {
          setLogs(prev => prev.map(l => l.id === logId ? {
            ...l,
            status: 'failed',
            httpStatus: response.status,
            message: `Failed: ${JSON.stringify(data.error || data)}`
          } : l));
        }
      } catch (err: any) {
        setLogs(prev => prev.map(l => l.id === logId ? {
          ...l,
          status: 'failed',
          message: `Network error: ${err.message}`
        } : l));
      }

      // Safe pacing delay between cloud submissions
      if (i < records.length - 1) {
        await new Promise(r => setTimeout(r, onlineDelaySec * 1000));
      }
    }

    setIsSubmittingBatch(false);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Explaining Zero-Download Cloud Execution */}
      <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 rounded-xl p-6 text-white shadow-md">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-teal-500/20 text-teal-300 rounded-lg border border-teal-400/30">
                <CloudLightning className="w-5 h-5 text-teal-300" />
              </span>
              <h2 className="text-lg font-bold tracking-tight">
                100% Online Cloud Submitter (No Downloads Needed)
              </h2>
            </div>
            <p className="text-xs text-teal-100/90 leading-relaxed max-w-2xl">
              You do <strong>not</strong> need to install Python, configure browsers, or download software. Because your form allows public submissions, this cloud runner submits responses directly to Microsoft’s secure Form responses API in real-time.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <button
              onClick={handleSingleSubmit}
              disabled={isSubmittingSingle || isSubmittingBatch}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
            >
              {isSubmittingSingle ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting Online...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit Selected Record Online</span>
                </>
              )}
            </button>

            <button
              onClick={handleBatchSubmit}
              disabled={isSubmittingSingle || isSubmittingBatch}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
            >
              {isSubmittingBatch ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting Batch ({batchProgress.current}/{batchProgress.total})...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Submit All {records.length} Records Online</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live progress if batch running */}
        {isSubmittingBatch && (
          <div className="mt-4 pt-3 border-t border-teal-700/50 space-y-1.5">
            <div className="flex justify-between text-xs text-teal-200">
              <span>Submitting Batch Queue:</span>
              <span className="font-mono">{batchProgress.current} of {batchProgress.total} completed</span>
            </div>
            <div className="w-full bg-teal-950/80 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-emerald-400 h-full transition-all duration-300"
                style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>

      {/* Online Execution Controls & Form Inspection */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Active Record Preview */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-teal-600" />
                <span>Selected Payload for Online Submission</span>
              </h3>
              <p className="text-xs text-slate-500">
                Choose which row from your dataset to send.
              </p>
            </div>

            <select
              value={selectedRecordIndex}
              onChange={(e) => setSelectedRecordIndex(Number(e.target.value))}
              disabled={isSubmittingSingle || isSubmittingBatch}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-mono"
            >
              {records.map((r, idx) => (
                <option key={r.id} value={idx}>
                  #{idx + 1} - {r.data.r5f3272b6049d4ad18e7650bd96ae837b || 'Record'} ({r.data.r4fdd1bd872014d9c80d3a51be3f2f950 || 'Rig'})
                </option>
              ))}
            </select>
          </div>

          {/* Key-Value Summary of Active Record */}
          <div className="space-y-2 text-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Page 1 &amp; Page 2 Combined Payload
            </span>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 divide-y divide-slate-200 space-y-1.5">
              {[...schema.page1.questions, ...schema.page2.questions].map((q) => {
                const val = activeRecord?.data[q.id] || q.defaultValue;
                return (
                  <div key={q.id} className="pt-1.5 first:pt-0 flex justify-between gap-3">
                    <span className="text-slate-600 font-medium truncate max-w-[200px]">{q.title}:</span>
                    <span className="font-mono text-slate-900 truncate max-w-[240px] text-right font-semibold">
                      {Array.isArray(val) ? val.join('; ') : String(val || '')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
            <span>Submission Target:</span>
            <span className="font-mono text-[11px] text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
              forms.cloud.microsoft (SOAR Form)
            </span>
          </div>
        </div>

        {/* Right: Live Cloud Server Receipts & Activity Log */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col h-[520px] overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <h3 className="text-sm font-semibold text-slate-900">
                Live Cloud Receipts &amp; Audit Log
              </h3>
            </div>
            {logs.length > 0 && (
              <button
                onClick={clearLogs}
                className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
              >
                Clear log
              </button>
            )}
          </div>

          <div className="p-4 overflow-y-auto flex-1 space-y-3">
            {logs.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                <CloudLightning className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p>No online submissions yet.</p>
                <p className="mt-1 text-slate-500">Click <strong>"Submit Selected Record Online"</strong> above to send a real response without downloading anything.</p>
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className={`p-3 rounded-lg border text-xs space-y-1 transition-all ${
                    log.status === 'success'
                      ? 'bg-emerald-50/70 border-emerald-200'
                      : log.status === 'failed'
                      ? 'bg-rose-50/70 border-rose-200'
                      : 'bg-amber-50/70 border-amber-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                      {log.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                      {log.status === 'failed' && <AlertCircle className="w-4 h-4 text-rose-600" />}
                      {log.status === 'pending' && <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />}
                      <span>{log.recordName}</span>
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">{log.time}</span>
                  </div>

                  <p className="text-slate-700 leading-relaxed">{log.message}</p>

                  {log.responseId && (
                    <div className="text-[10px] font-mono text-emerald-800 pt-0.5">
                      Response ID: {log.responseId}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="p-3 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex justify-between items-center">
            <span>Rate-limit protection:</span>
            <span className="font-mono text-slate-700">{onlineDelaySec}s cooldown between rows</span>
          </div>
        </div>
      </div>

      {/* Cloud Automation Option 2: Power Automate Cloud Flow (Browser Only) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
          <Layers className="w-4 h-4 text-blue-600" />
          <span>Option: Running 100% Online via Power Automate Cloud (Browser Only)</span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          If you want recurring scheduling (e.g. daily, or when a new Excel row is added in OneDrive) without keeping any computer or browser open:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
            <span className="font-semibold block text-slate-900 mb-1">1. Open Browser Flow</span>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Go to <a href="https://make.powerautomate.com" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-0.5">make.powerautomate.com <ExternalLink className="w-3 h-3" /></a> in your web browser. No download required.
            </p>
          </div>
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
            <span className="font-semibold block text-slate-900 mb-1">2. Add Trigger</span>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Choose <strong>"Recurrence"</strong> (daily / hourly schedule) or <strong>"When a row is created in an Excel sheet"</strong> on SharePoint/OneDrive.
            </p>
          </div>
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
            <span className="font-semibold block text-slate-900 mb-1">3. Add HTTP Action</span>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Use the HTTP action with method <strong>POST</strong> to the Forms API endpoint. Both Page 1 and Page 2 answers are sent in the JSON body.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
