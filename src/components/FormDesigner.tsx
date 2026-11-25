import React, { useState } from 'react';
import { FormSchema, Question, QuestionType } from '../types/form';
import { 
  Plus, 
  Trash2, 
  Settings2, 
  Layers, 
  HelpCircle, 
  Globe, 
  Lock, 
  ArrowRight,
  ListPlus,
  RefreshCw,
  FileSpreadsheet
} from 'lucide-react';
import { defaultFormSchema } from '../utils/defaultForm';

interface FormDesignerProps {
  schema: FormSchema;
  setSchema: React.Dispatch<React.SetStateAction<FormSchema>>;
}

export const FormDesigner: React.FC<FormDesignerProps> = ({ schema, setSchema }) => {
  const [activePageTab, setActivePageTab] = useState<1 | 2>(1);

  const updateSchemaMeta = (key: keyof FormSchema, value: any) => {
    setSchema(prev => ({ ...prev, [key]: value }));
  };

  const currentQuestions = activePageTab === 1 ? schema.page1.questions : schema.page2.questions;

  const updateQuestion = (qId: string, field: keyof Question, value: any) => {
    setSchema(prev => {
      const pageKey = activePageTab === 1 ? 'page1' : 'page2';
      const updatedQuestions = prev[pageKey].questions.map(q => {
        if (q.id === qId) {
          return { ...q, [field]: value };
        }
        return q;
      });
      return {
        ...prev,
        [pageKey]: {
          ...prev[pageKey],
          questions: updatedQuestions
        }
      };
    });
  };

  const addQuestion = () => {
    setSchema(prev => {
      const pageKey = activePageTab === 1 ? 'page1' : 'page2';
      const totalCount = prev.page1.questions.length + prev.page2.questions.length + 1;
      const newQ: Question = {
        id: `q_${Date.now()}`,
        number: totalCount,
        title: `New Question ${totalCount}`,
        type: 'text',
        required: true,
        defaultValue: 'Sample text'
      };
      return {
        ...prev,
        [pageKey]: {
          ...prev[pageKey],
          questions: [...prev[pageKey].questions, newQ]
        }
      };
    });
  };

  const removeQuestion = (qId: string) => {
    setSchema(prev => {
      const pageKey = activePageTab === 1 ? 'page1' : 'page2';
      const filtered = prev[pageKey].questions.filter(q => q.id !== qId);
      // Renumber
      let currentNumber = 1;
      const renumberedPage1 = (pageKey === 'page1' ? filtered : prev.page1.questions).map(q => ({
        ...q,
        number: currentNumber++
      }));
      const renumberedPage2 = (pageKey === 'page2' ? filtered : prev.page2.questions).map(q => ({
        ...q,
        number: currentNumber++
      }));

      return {
        ...prev,
        page1: { ...prev.page1, questions: renumberedPage1 },
        page2: { ...prev.page2, questions: renumberedPage2 }
      };
    });
  };

  const handleOptionsChange = (qId: string, optionsText: string) => {
    const options = optionsText.split('\n').map(s => s.trim()).filter(Boolean);
    updateQuestion(qId, 'options', options);
  };

  const loadPreset = (presetName: string) => {
    if (presetName === 'it_request') {
      setSchema(defaultFormSchema);
    } else if (presetName === 'customer_feedback') {
      setSchema({
        id: 'ms-feedback',
        title: 'Customer Experience & NPS Survey',
        description: 'Thank you for your business. Please complete this brief 2-page survey to help us improve.',
        formUrl: 'https://forms.office.com/r/FeedbackSurvey2026',
        isAnonymous: true,
        page1: {
          id: 'page_1',
          pageNumber: 1,
          title: 'Page 1: General Satisfaction',
          questions: [
            {
              id: 'q1_nps',
              number: 1,
              title: 'How satisfied were you with our service today?',
              type: 'rating',
              ratingMax: 5,
              required: true,
              defaultValue: 5
            },
            {
              id: 'q2_channel',
              number: 2,
              title: 'Which channel did you use to reach us?',
              type: 'radio',
              required: true,
              options: ['Web Chat', 'Phone Support', 'Email / Ticket', 'In-Person'],
              defaultValue: 'Web Chat'
            }
          ]
        },
        page2: {
          id: 'page_2',
          pageNumber: 2,
          title: 'Page 2: Contact & Follow-up',
          questions: [
            {
              id: 'q3_feedback',
              number: 3,
              title: 'What can we do to improve your experience?',
              type: 'textarea',
              required: false,
              defaultValue: 'Everything was smooth and fast. Great customer service!'
            },
            {
              id: 'q4_email',
              number: 4,
              title: 'Your Email (Optional for raffle entry)',
              type: 'text',
              required: false,
              defaultValue: 'customer@example.com'
            }
          ]
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Configuration Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-teal-600" />
              <span>Microsoft Form Target Setup</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Specify your real Microsoft Forms URL and configure form parameters.
            </p>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Load Preset:</span>
            <button
              onClick={() => loadPreset('it_request')}
              className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 transition-colors"
            >
              IT Equipment Request
            </button>
            <button
              onClick={() => loadPreset('customer_feedback')}
              className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 transition-colors"
            >
              Customer NPS Survey
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4">
          <div className="md:col-span-8 space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Microsoft Forms Public / Response URL
            </label>
            <div className="relative">
              <input
                type="text"
                value={schema.formUrl}
                onChange={(e) => updateSchemaMeta('formUrl', e.target.value)}
                placeholder="https://forms.office.com/r/xxxxxx or https://forms.office.com/pages/responsepage.aspx?id=..."
                className="w-full px-3 py-2 text-xs sm:text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Paste the exact sharing link of your 2-page Microsoft Form.
            </p>
          </div>

          <div className="md:col-span-4 space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Form Access Policy
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => updateSchemaMeta('isAnonymous', true)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                  schema.isAnonymous 
                    ? 'bg-teal-50 text-teal-800 border-teal-300' 
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Anyone with link</span>
              </button>
              <button
                type="button"
                onClick={() => updateSchemaMeta('isAnonymous', false)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                  !schema.isAnonymous 
                    ? 'bg-amber-50 text-amber-800 border-amber-300' 
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Requires M365 Login</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              {!schema.isAnonymous ? 'Requires persistent profile / SSO cookie' : 'Direct automated submission without login'}
            </p>
          </div>

          <div className="md:col-span-7 space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Form Title
            </label>
            <input
              type="text"
              value={schema.title}
              onChange={(e) => updateSchemaMeta('title', e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          <div className="md:col-span-5 space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Description / Instructions
            </label>
            <input
              type="text"
              value={schema.description}
              onChange={(e) => updateSchemaMeta('description', e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
        </div>
      </div>

      {/* 2-Page Pagination Switcher & Question Builder */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        {/* Page Switcher Header */}
        <div className="border-b border-slate-200 bg-slate-50 p-2 sm:px-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActivePageTab(1)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                activePageTab === 1
                  ? 'bg-white text-teal-800 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs">
                1
              </span>
              <span>Page 1 Questions</span>
              <span className="text-slate-600 font-normal">
                ({schema.page1.questions.length})
              </span>
            </button>

            <ArrowRight className="w-4 h-4 text-slate-400" />

            <button
              onClick={() => setActivePageTab(2)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                activePageTab === 2
                  ? 'bg-white text-teal-800 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs">
                2
              </span>
              <span>Page 2 Questions</span>
              <span className="text-slate-600 font-normal">
                ({schema.page2.questions.length})
              </span>
            </button>
          </div>

          <button
            onClick={addQuestion}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Question to Page {activePageTab}</span>
          </button>
        </div>

        {/* Page Explanation Banner */}
        <div className="bg-teal-50/50 px-5 py-3 border-b border-teal-100 flex items-center justify-between text-xs text-teal-900">
          <div className="flex items-center gap-2">
            <span className="font-semibold">
              {activePageTab === 1 ? 'Page 1 Logic:' : 'Page 2 Logic:'}
            </span>
            <span>
              {activePageTab === 1 
                ? 'These fields are filled first. Then the automation clicks "Next" and waits for Page 2 hydration.'
                : 'These fields are filled after the transition. Then the automation clicks "Submit" and verifies confirmation.'}
            </span>
          </div>
          <span className="font-mono text-[11px] text-teal-700 hidden md:inline">
            {activePageTab === 1 ? 'Selector: button[data-automation-id="nextButton"]' : 'Selector: button[data-automation-id="submitButton"]'}
          </span>
        </div>

        {/* Question Cards List */}
        <div className="p-4 sm:p-5 space-y-4">
          {currentQuestions.map((q, idx) => (
            <div
              key={q.id}
              className="bg-slate-50/60 rounded-xl border border-slate-200 p-4 transition-all hover:border-slate-300"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center">
                    {q.number}
                  </span>
                  <span className="text-xs font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                    ID: {q.id}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={q.required}
                      onChange={(e) => updateQuestion(q.id, 'required', e.target.checked)}
                      className="rounded text-teal-600 focus:ring-teal-500"
                    />
                    <span className="font-medium">Required field</span>
                  </label>

                  <button
                    onClick={() => removeQuestion(q.id)}
                    className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors"
                    title="Delete question"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                {/* Question Title */}
                <div className="md:col-span-6 space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 uppercase">
                    Question Label / Prompt
                  </label>
                  <input
                    type="text"
                    value={q.title}
                    onChange={(e) => updateQuestion(q.id, 'title', e.target.value)}
                    className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>

                {/* Question Type */}
                <div className="md:col-span-3 space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 uppercase">
                    Field Type
                  </label>
                  <select
                    value={q.type}
                    onChange={(e) => updateQuestion(q.id, 'type', e.target.value as QuestionType)}
                    className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                  >
                    <option value="text">Single Line Text</option>
                    <option value="textarea">Multi-Line Text Area</option>
                    <option value="radio">Single Choice (Radio)</option>
                    <option value="checkbox">Multiple Choice (Checkbox)</option>
                    <option value="rating">Rating (1 to 5 Stars)</option>
                    <option value="date">Date Picker</option>
                  </select>
                </div>

                {/* Default Value */}
                <div className="md:col-span-3 space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 uppercase">
                    Default / Test Value
                  </label>
                  <input
                    type="text"
                    value={Array.isArray(q.defaultValue) ? q.defaultValue.join('; ') : (q.defaultValue || '')}
                    onChange={(e) => {
                      const val = q.type === 'checkbox' ? e.target.value.split(';').map(s => s.trim()) : e.target.value;
                      updateQuestion(q.id, 'defaultValue', val);
                    }}
                    placeholder="Sample input value"
                    className="w-full px-3 py-1.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-500 focus:border-teal-500 font-mono"
                  />
                </div>

                {/* Choice Options for Radio or Checkbox */}
                {(q.type === 'radio' || q.type === 'checkbox') && (
                  <div className="md:col-span-12 space-y-1 bg-white p-3 rounded-lg border border-slate-200">
                    <label className="text-[11px] font-semibold text-slate-600 uppercase flex items-center justify-between">
                      <span>Options (One per line)</span>
                      <span className="text-slate-500 font-normal lowercase">matching text clicked by automator</span>
                    </label>
                    <textarea
                      rows={3}
                      value={(q.options || []).join('\n')}
                      onChange={(e) => handleOptionsChange(q.id, e.target.value)}
                      placeholder="Option 1&#10;Option 2&#10;Option 3"
                      className="w-full px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
