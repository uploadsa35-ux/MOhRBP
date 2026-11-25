import { FormSchema } from '../../types/form';

export function generateCloudFlowGuide(schema: FormSchema): {
  overview: string;
  httpEndpointExample: string;
  samplePayloadJson: string;
  stepGuide: Array<{ step: string; detail: string; tip?: string }>;
} {
  const sampleAnswers = [
    ...schema.page1.questions.map((q, i) => ({
      questionId: `r${i + 1}`,
      questionTitle: q.title,
      answer1: q.defaultValue || 'Sample answer'
    })),
    ...schema.page2.questions.map((q, i) => ({
      questionId: `r${schema.page1.questions.length + i + 1}`,
      questionTitle: q.title,
      answer1: Array.isArray(q.defaultValue) ? q.defaultValue.join(';') : (q.defaultValue || 'Sample answer')
    }))
  ];

  const payload = {
    startDate: new Date(Date.now() - 60000).toISOString(),
    submitDate: new Date().toISOString(),
    answers: JSON.stringify(
      sampleAnswers.map(a => ({
        questionId: a.questionId,
        answer1: a.answer1
      }))
    )
  };

  const overview = `
### Microsoft Forms Cloud Flow & API Architecture
A key architectural advantage of Microsoft Forms: **Multi-page pagination is purely a client-side frontend UX mechanism**.
When a user clicks "Next" in the browser, no server request is created; instead, React simply unhides the second page. When the user finally clicks "Submit", the browser packages answers from BOTH Page 1 and Page 2 into a single unified JSON payload and sends it via an HTTP POST request to the Forms API.

This means with Power Automate Cloud Flow or a direct Python \`requests\` script, you can submit multi-page forms in 50 milliseconds without having to open any browser, emulate clicks, or handle UI pagination!
  `.trim();

  const httpEndpointExample = `POST https://forms.office.com/formapi/api/{tenantId}/users/{userId}/forms('{formId}')/responses
Content-Type: application/json
Origin: https://forms.office.com
Referer: ${schema.formUrl}`;

  const stepGuide = [
    {
      step: '1. Inspect Question IDs (One-time setup)',
      detail: 'Open your form in Google Chrome / Edge, press F12 (DevTools) -> Network tab -> submit one test response. Filter for "responses" to see your exact Tenant ID, Form ID, and questionId strings (e.g. "r4f46...", "r3b2...").',
      tip: 'Each question in MS Forms has an internal ID starting with "r" or GUID.'
    },
    {
      step: '2. Create Cloud Flow Trigger',
      detail: 'In Power Automate Cloud (make.powerautomate.com), create an Automated Cloud Flow (e.g., "When an item is created in SharePoint" or "When an Excel row is added" or "Recurrence schedule").'
    },
    {
      step: '3. Add Compose / Parse Action for Answers',
      detail: 'Format the combined answers for Page 1 and Page 2 into a JSON string containing the questionId and answer1 fields.'
    },
    {
      step: '4. Add HTTP Action (or HTTP with Entra ID)',
      detail: 'Set Method: POST, URI: Forms Responses endpoint, Body: { startDate, submitDate, answers: stringified_json }.',
      tip: 'For internal company forms, use "HTTP with Azure AD" or Power Automate Desktop if SSO MFA is enforced.'
    },
    {
      step: '5. Error Handling & Run History',
      detail: 'Add a "Configure run after" branch to catch 429 (Rate Limit) or 400 (Validation) errors with exponential backoff retry.'
    }
  ];

  return {
    overview,
    httpEndpointExample,
    samplePayloadJson: JSON.stringify(payload, null, 2),
    stepGuide
  };
}
