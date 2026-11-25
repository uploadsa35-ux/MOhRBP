import React, { useState } from 'react';
import { FormSchema, BatchRecord } from '../types/form';
import { 
  Database, 
  Download, 
  Plus, 
  Trash2, 
  Sparkles, 
  FileSpreadsheet, 
  Upload, 
  Check, 
  AlertCircle 
} from 'lucide-react';
import { defaultBatchRecords } from '../utils/defaultForm';

interface BatchDataEditorProps {
  schema: FormSchema;
  records: BatchRecord[];
  setRecords: React.Dispatch<React.SetStateAction<BatchRecord[]>>;
}

export const BatchDataEditor: React.FC<BatchDataEditorProps> = ({
  schema,
  records,
  setRecords
}) => {
  const [copied, setCopied] = useState(false);

  // Combine all questions across both pages in sequential order
  const allQuestions = [...schema.page1.questions, ...schema.page2.questions];

  const handleCellChange = (recordId: string, questionId: string, value: string) => {
    setRecords(prev =>
      prev.map(rec => {
        if (rec.id === recordId) {
          return {
            ...rec,
            data: {
              ...rec.data,
              [questionId]: value
            }
          };
        }
        return rec;
      })
    );
  };

  const addRecord = () => {
    const newRecord: BatchRecord = {
      id: `rec_${Date.now()}`,
      data: {}
    };
    allQuestions.forEach(q => {
      newRecord.data[q.id] = Array.isArray(q.defaultValue) 
        ? q.defaultValue.join(';') 
        : String(q.defaultValue || '');
    });
    setRecords(prev => [...prev, newRecord]);
  };

  const removeRecord = (recordId: string) => {
    setRecords(prev => prev.filter(r => r.id !== recordId));
  };

  const generateSyntheticRecords = () => {
    const firstNames = ['Sophia', 'Liam', 'Zoe', 'Noah', 'Amara', 'Carlos', 'Mei-Ling', 'David'];
    const lastNames = ['Vance', 'O\'Connor', 'Patel', 'Zhang', 'Nakamura', 'Kim', 'Larsson', 'Santos'];
    const depts = ['Engineering', 'Product & Design', 'Sales & Marketing', 'Operations & IT'];
    const workstations = ['ThinkPad X1 Carbon 32GB', 'MacBook Pro 16" (M-Series)', 'Precision 7780 Mobile Workstation'];
    const accessories = [
      'Dual 4K USB-C Monitors;Noise-Cancelling Headset',
      'Ergonomic Mechanical Keyboard;CalDigit TS4 Thunderbolt Dock',
      'Dual 4K USB-C Monitors;Ergonomic Mechanical Keyboard'
    ];

    const newBatch: BatchRecord[] = Array.from({ length: 4 }).map((_, i) => {
      const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
      const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
      const email = `${fn.toLowerCase()}.${ln.toLowerCase().replace(/[^a-z]/g, '')}@company.org`;
      const dept = depts[i % depts.length];
      const ws = workstations[i % workstations.length];
      const acc = accessories[i % accessories.length];

      return {
        id: `synth_${Date.now()}_${i}`,
        data: {
          q1_name: `${fn} ${ln}`,
          q2_email: email,
          q3_dept: dept,
          q4_date: `2026-10-${10 + i * 3}`,
          q5_hardware: ws,
          q6_peripherals: acc,
          q7_notes: `Automated test provision for batch onboarding cohort #${i + 1}.`,
          q8_urgency: String((i % 3) + 3)
        }
      };
    });

    setRecords(newBatch);
  };

  const generateCsvString = (): string => {
    const headers = allQuestions.map(q => q.id);
    const headerRow = headers.join(',');
    const rows = records.map(rec => {
      return headers
        .map(h => {
          const val = rec.data[h] || '';
          // Escape quotes and commas
          if (val.includes(',') || val.includes('"') || val.includes('\n')) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        })
        .join(',');
    });
    return [headerRow, ...rows].join('\n');
  };

  const downloadCsv = () => {
    const csvContent = generateCsvString();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'form_data.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyCsv = () => {
    navigator.clipboard.writeText(generateCsvString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-teal-600" />
              <span>Batch Submission Dataset</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Feed multiple rows into your Playwright / Selenium scripts or Power Automate Excel loops.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={generateSyntheticRecords}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors border border-slate-200"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              <span>Generate Sample Data</span>
            </button>

            <button
              onClick={handleCopyCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors border border-slate-200"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied CSV' : 'Copy CSV Text'}</span>
            </button>

            <button
              onClick={downloadCsv}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download form_data.csv</span>
            </button>
          </div>
        </div>

        {/* Notice on Column Mapping */}
        <div className="mt-4 p-3 bg-teal-50/60 rounded-lg border border-teal-100 text-xs text-teal-950 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-teal-900">How Column Mapping Works:</span>
            <p className="text-teal-900/90 leading-relaxed">
              The generated scripts read the CSV header row and map columns directly to question IDs. Notice how columns 1-{schema.page1.questions.length} are filled on <strong>Page 1</strong>, then the script automatically clicks <strong>Next</strong> and populates the remaining columns on <strong>Page 2</strong> before submitting!
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">Records Queue</span>
            <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
              {records.length}
            </span>
          </div>

          <button
            onClick={addRecord}
            className="flex items-center gap-1 px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded border border-slate-300 shadow-2xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-teal-600" />
            <span>Add Row</span>
          </button>
        </div>

        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 z-10 border-b border-slate-200">
              <tr>
                <th className="p-3 border-r border-slate-200 w-12 text-center">#</th>
                {allQuestions.map((q) => {
                  const isPage1 = schema.page1.questions.some(p1 => p1.id === q.id);
                  return (
                    <th key={q.id} className="p-3 border-r border-slate-200 min-w-[180px]">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-bold text-slate-900 truncate">{q.title}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                          isPage1 ? 'bg-teal-100 text-teal-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {isPage1 ? 'P1' : 'P2'}
                        </span>
                      </div>
                      <div className="font-mono text-[10px] text-slate-500 font-normal">
                        Column: {q.id}
                      </div>
                    </th>
                  );
                })}
                <th className="p-3 w-16 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={allQuestions.length + 2} className="p-8 text-center text-slate-500">
                    No records in queue. Click "Add Row" or "Generate Sample Data" above.
                  </td>
                </tr>
              ) : (
                records.map((rec, rowIndex) => (
                  <tr key={rec.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3 border-r border-slate-200 text-center font-mono text-slate-500 bg-slate-50/40">
                      {rowIndex + 1}
                    </td>
                    {allQuestions.map((q) => {
                      const val = rec.data[q.id] || '';
                      return (
                        <td key={q.id} className="p-2 border-r border-slate-200">
                          <input
                            type="text"
                            value={val}
                            onChange={(e) => handleCellChange(rec.id, q.id, e.target.value)}
                            className="w-full px-2 py-1 bg-white border border-slate-200 rounded focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none text-xs"
                            placeholder="empty"
                          />
                        </td>
                      );
                    })}
                    <td className="p-2 text-center">
                      <button
                        onClick={() => removeRecord(rec.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                        title="Delete row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
