import React, { useState } from 'react';
import { FormSchema, Question } from '../types/form';
import { 
  Check, 
  ChevronRight, 
  ArrowLeft, 
  Calendar, 
  Star, 
  Eye, 
  CheckCircle2, 
  RotateCcw,
  Sparkles,
  Info
} from 'lucide-react';

interface FormPreviewProps {
  schema: FormSchema;
  inspectMode: boolean;
  setInspectMode: (val: boolean) => void;
  // External control for simulator
  simulatedValues?: Record<string, any>;
  currentPageOverride?: 1 | 2 | 3; // 3 for submitted
  highlightSelector?: string | null;
}

export const FormPreview: React.FC<FormPreviewProps> = ({
  schema,
  inspectMode,
  setInspectMode,
  simulatedValues,
  currentPageOverride,
  highlightSelector
}) => {
  const [internalPage, setInternalPage] = useState<1 | 2 | 3>(1);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const activePage = currentPageOverride !== undefined ? currentPageOverride : internalPage;
  const currentValues = simulatedValues || formValues;

  const handleValueChange = (questionId: string, value: any) => {
    setFormValues(prev => ({ ...prev, [questionId]: value }));
    if (errors[questionId]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    }
  };

  const handleNext = () => {
    // Validate Page 1 required questions
    const pageErrors: Record<string, string> = {};
    schema.page1.questions.forEach(q => {
      if (q.required) {
        const val = currentValues[q.id] !== undefined ? currentValues[q.id] : q.defaultValue;
        if (!val || (Array.isArray(val) && val.length === 0) || (typeof val === 'string' && val.trim() === '')) {
          pageErrors[q.id] = 'This question is required.';
        }
      }
    });

    if (Object.keys(pageErrors).length > 0) {
      setErrors(pageErrors);
      return;
    }

    setErrors({});
    setInternalPage(2);
  };

  const handleBack = () => {
    setErrors({});
    setInternalPage(1);
  };

  const handleSubmit = () => {
    // Validate Page 2 required questions
    const pageErrors: Record<string, string> = {};
    schema.page2.questions.forEach(q => {
      if (q.required) {
        const val = currentValues[q.id] !== undefined ? currentValues[q.id] : q.defaultValue;
        if (!val || (Array.isArray(val) && val.length === 0) || (typeof val === 'string' && val.trim() === '')) {
          pageErrors[q.id] = 'This question is required.';
        }
      }
    });

    if (Object.keys(pageErrors).length > 0) {
      setErrors(pageErrors);
      return;
    }

    setErrors({});
    setInternalPage(3);
  };

  const handleReset = () => {
    setInternalPage(1);
    setFormValues({});
    setErrors({});
  };

  const isHighlighted = (selectorName: string) => {
    if (!highlightSelector) return false;
    return highlightSelector.toLowerCase().includes(selectorName.toLowerCase());
  };

  return (
    <div className="bg-slate-100 rounded-xl border border-slate-300 overflow-hidden shadow-inner flex flex-col h-full">
      {/* Top Browser Chrome Bar */}
      <div className="bg-slate-200 px-4 py-2 border-b border-slate-300 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-400"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-slate-400"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-slate-400"></div>
          </div>
          <div className="bg-white px-3 py-1 rounded text-[11px] text-slate-600 font-mono flex items-center gap-1.5 shadow-2xs border border-slate-300 truncate max-w-[280px] sm:max-w-md">
            <span className="text-emerald-700 font-semibold">https://</span>
            <span className="truncate">{schema.formUrl.replace(/^https?:\/\//, '')}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setInspectMode(!inspectMode)}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              inspectMode 
                ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300'
            }`}
            title="Inspect Automation DOM Selectors"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Inspect Selectors</span>
          </button>

          {activePage === 3 && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-white text-slate-700 hover:bg-slate-50 border border-slate-300"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Forms Virtual Viewport */}
      <div className="overflow-y-auto p-3 sm:p-6 flex-1 flex justify-center bg-[#f3f2f1]">
        <div className="w-full max-w-2xl bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          {/* MS Forms Brand Header */}
          <div className="h-4 bg-[#008272] w-full relative">
            {inspectMode && (
              <span className="absolute top-0 right-2 text-[9px] bg-amber-500 text-white font-mono px-1 rounded-b">
                forms.office.com root
              </span>
            )}
          </div>

          {activePage === 3 ? (
            /* Thank You / Submission Confirmation Screen */
            <div 
              data-automation-id="thankYouMessage"
              className={`p-8 sm:p-12 text-center flex-1 flex flex-col items-center justify-center ${
                isHighlighted('thankYouMessage') ? 'ring-4 ring-teal-500 ring-offset-2' : ''
              }`}
            >
              <div className="w-16 h-16 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center mb-4 border border-teal-200">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Thanks!</h2>
              <p className="text-base text-slate-700 mb-6 font-medium">
                Your response was submitted.
              </p>
              
              <div className="p-3 bg-slate-50 rounded-md border border-slate-200 text-xs text-slate-600 max-w-md text-left mb-6 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Submitted at:</span>
                  <span className="font-mono text-slate-700">{new Date().toLocaleTimeString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Pagination status:</span>
                  <span className="text-emerald-700 font-medium">Page 1 &amp; Page 2 completed</span>
                </div>
              </div>

              <button
                onClick={handleReset}
                data-automation-id="submitAnother"
                className="text-teal-700 hover:text-teal-900 text-sm font-semibold hover:underline"
              >
                Submit another response
              </button>

              {inspectMode && (
                <div className="mt-6 p-2 bg-amber-50 border border-amber-200 rounded text-[11px] font-mono text-amber-900 text-left">
                  Verification Selector: <br />
                  <code className="bg-amber-100 px-1 py-0.5 rounded">
                    div[data-automation-id="thankYouMessage"]
                  </code>
                </div>
              )}
            </div>
          ) : (
            /* Active Form Page */
            <div className="p-5 sm:p-8 flex-1 flex flex-col">
              {/* Form Title & Description */}
              <div className="border-b border-slate-200 pb-5 mb-6">
                <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight mb-2">
                  {schema.title}
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {schema.description}
                </p>

                {/* Microsoft Account notice */}
                <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 p-2 rounded border border-slate-100">
                  <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>
                    {schema.isAnonymous 
                      ? 'The owner of this form has not provided a privacy statement as to how they will use your response data.'
                      : 'Hi Alex. When you submit this form, the owner will see your name and email address.'}
                  </span>
                </div>

                {/* Page Indicator */}
                <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">
                    Page {activePage} of 2
                  </span>
                  <span className="text-xs text-rose-500 font-medium">* Required</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
                  <div 
                    className="bg-[#008272] h-full transition-all duration-300"
                    style={{ width: activePage === 1 ? '50%' : '100%' }}
                  ></div>
                </div>
              </div>

              {/* Questions Container */}
              <div className="space-y-6 flex-1">
                {(activePage === 1 ? schema.page1.questions : schema.page2.questions).map((q, idx) => {
                  const currentValue = currentValues[q.id] !== undefined ? currentValues[q.id] : q.defaultValue;
                  const hasError = !!errors[q.id];
                  const questionHighlight = isHighlighted(q.id) || isHighlighted(`questionItem`);

                  return (
                    <div
                      key={q.id}
                      data-automation-id="questionItem"
                      className={`relative p-3.5 sm:p-4 rounded-lg transition-all ${
                        hasError 
                          ? 'bg-rose-50/70 border border-rose-300' 
                          : questionHighlight
                          ? 'bg-teal-50/60 ring-2 ring-teal-500'
                          : 'hover:bg-slate-50/80 border border-transparent'
                      }`}
                    >
                      {/* Automation Selector Badge in Inspect Mode */}
                      {inspectMode && (
                        <div className="mb-2 flex flex-wrap gap-1 items-center">
                          <span className="text-[10px] bg-slate-900 text-teal-300 font-mono px-1.5 py-0.5 rounded">
                            div[data-automation-id="questionItem"]:nth({idx})
                          </span>
                          <span className="text-[10px] bg-slate-100 text-slate-600 font-mono px-1.5 py-0.5 rounded border border-slate-300">
                            id: {q.id}
                          </span>
                        </div>
                      )}

                      {/* Question Title */}
                      <label className="block text-sm font-medium text-slate-900 mb-2">
                        <span className="font-semibold mr-1.5">{q.number}.</span>
                        <span>{q.title}</span>
                        {q.required && <span className="text-rose-600 ml-1 font-bold">*</span>}
                      </label>

                      {/* Field Controls based on Question Type */}
                      {q.type === 'text' && (
                        <div className="relative">
                          <input
                            type="text"
                            data-automation-id="textInput"
                            value={currentValue || ''}
                            onChange={(e) => handleValueChange(q.id, e.target.value)}
                            placeholder="Enter your answer"
                            className="w-full px-3 py-2 text-sm border-b-2 border-slate-300 focus:border-[#008272] focus:outline-none bg-slate-50/50 hover:bg-white transition-colors"
                          />
                          {inspectMode && (
                            <span className="absolute right-2 top-2 text-[9px] font-mono text-slate-400">
                              input[data-automation-id="textInput"]
                            </span>
                          )}
                        </div>
                      )}

                      {q.type === 'textarea' && (
                        <div className="relative">
                          <textarea
                            rows={3}
                            data-automation-id="textInput"
                            value={currentValue || ''}
                            onChange={(e) => handleValueChange(q.id, e.target.value)}
                            placeholder="Enter your detailed answer..."
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:border-[#008272] focus:outline-none bg-slate-50/50 hover:bg-white transition-colors resize-none"
                          />
                          {inspectMode && (
                            <span className="absolute right-2 top-2 text-[9px] font-mono text-slate-400">
                              textarea[data-automation-id="textInput"]
                            </span>
                          )}
                        </div>
                      )}

                      {q.type === 'dropdown' && q.options && (
                        <div className="relative mt-1">
                          <select
                            data-automation-id="selectQuestionDropdown"
                            value={currentValue || ''}
                            onChange={(e) => handleValueChange(q.id, e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:border-[#008272] focus:outline-none bg-white text-slate-800"
                          >
                            <option value="">-- Select an option --</option>
                            {q.options.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                          {inspectMode && (
                            <span className="absolute right-8 top-2.5 text-[9px] font-mono text-slate-400 pointer-events-none">
                              div[data-automation-id="selectQuestionDropdown"]
                            </span>
                          )}
                        </div>
                      )}

                      {q.type === 'radio' && q.options && (
                        <div className="space-y-2 mt-1">
                          {q.options.map((opt) => {
                            const isSelected = currentValue === opt;
                            return (
                              <label
                                key={opt}
                                data-automation-id="choiceItem"
                                onClick={() => handleValueChange(q.id, opt)}
                                className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors text-sm ${
                                  isSelected 
                                    ? 'bg-teal-50/50 text-[#008272] font-medium' 
                                    : 'text-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                                  isSelected ? 'border-[#008272] bg-[#008272]' : 'border-slate-400 bg-white'
                                }`}>
                                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                                </div>
                                <span>{opt}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}

                      {q.type === 'checkbox' && q.options && (
                        <div className="space-y-2 mt-1">
                          {q.options.map((opt) => {
                            const selectedArray: string[] = Array.isArray(currentValue) 
                              ? currentValue 
                              : (typeof currentValue === 'string' ? currentValue.split(';').map(s => s.trim()) : []);
                            const isChecked = selectedArray.includes(opt);

                            const toggleCheck = () => {
                              const next = isChecked 
                                ? selectedArray.filter(item => item !== opt)
                                : [...selectedArray, opt];
                              handleValueChange(q.id, next);
                            };

                            return (
                              <label
                                key={opt}
                                data-automation-id="choiceItem"
                                onClick={toggleCheck}
                                className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors text-sm ${
                                  isChecked 
                                    ? 'bg-teal-50/50 text-[#008272] font-medium' 
                                    : 'text-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                  isChecked ? 'border-[#008272] bg-[#008272] text-white' : 'border-slate-400 bg-white'
                                }`}>
                                  {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                                <span>{opt}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}

                      {q.type === 'date' && (
                        <div className="relative max-w-xs">
                          <input
                            type="date"
                            data-automation-id="dateInput"
                            value={currentValue || ''}
                            onChange={(e) => handleValueChange(q.id, e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:border-[#008272] focus:outline-none bg-white"
                          />
                        </div>
                      )}

                      {q.type === 'rating' && (
                        <div className="flex items-center gap-2 mt-2">
                          {[1, 2, 3, 4, 5].map((starNum) => {
                            const currentRating = Number(currentValue) || 0;
                            const isStarActive = starNum <= currentRating;
                            return (
                              <button
                                key={starNum}
                                type="button"
                                data-automation-id="ratingItem"
                                aria-label={`Rate ${starNum} stars`}
                                onClick={() => handleValueChange(q.id, starNum)}
                                className={`p-1.5 rounded transition-transform hover:scale-110 ${
                                  isStarActive ? 'text-amber-400' : 'text-slate-300 hover:text-amber-200'
                                }`}
                              >
                                <Star className={`w-6 h-6 ${isStarActive ? 'fill-amber-400' : ''}`} />
                              </button>
                            );
                          })}
                          <span className="text-xs text-slate-500 ml-2 font-mono">
                            {currentValue ? `${currentValue} / 5 stars` : 'Not rated'}
                          </span>
                        </div>
                      )}

                      {/* Error text */}
                      {hasError && (
                        <p className="mt-1 text-xs text-rose-600 font-medium">
                          {errors[q.id]}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Form Navigation Footer */}
              <div className="mt-8 pt-4 border-t border-slate-200 flex items-center justify-between">
                {activePage === 2 ? (
                  <button
                    type="button"
                    onClick={handleBack}
                    data-automation-id="backButton"
                    className={`flex items-center gap-1.5 px-5 py-2 text-sm font-medium rounded text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-2xs ${
                      isHighlighted('backButton') ? 'ring-4 ring-amber-400' : ''
                    }`}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                ) : (
                  <div></div>
                )}

                {activePage === 1 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    data-automation-id="nextButton"
                    className={`flex items-center gap-2 px-7 py-2.5 text-sm font-semibold rounded text-white bg-[#008272] hover:bg-[#006e60] transition-colors shadow-xs ${
                      isHighlighted('nextButton') ? 'ring-4 ring-amber-400 animate-pulse' : ''
                    }`}
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    data-automation-id="submitButton"
                    className={`flex items-center gap-2 px-8 py-2.5 text-sm font-semibold rounded text-white bg-[#008272] hover:bg-[#006e60] transition-colors shadow-xs ${
                      isHighlighted('submitButton') ? 'ring-4 ring-amber-400 animate-pulse' : ''
                    }`}
                  >
                    <span>Submit</span>
                  </button>
                )}
              </div>

              {/* Inspector Banner when enabled */}
              {inspectMode && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 space-y-1">
                  <div className="font-semibold flex items-center gap-1 text-amber-800">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Pagination Selector Inspector Active:</span>
                  </div>
                  <div>
                    {activePage === 1 ? (
                      <span>Next button selector: <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">button[data-automation-id="nextButton"]</code></span>
                    ) : (
                      <span>Submit button selector: <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">button[data-automation-id="submitButton"]</code> | Back: <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">button[data-automation-id="backButton"]</code></span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
