import { FormSchema, AutomationSettings } from '../../types/form';

export interface PADStep {
  step: number;
  category: string;
  actionName: string;
  description: string;
  selectorOrDetail: string;
  codeSnippet: string;
}

export function generatePowerAutomateDesktopGuide(schema: FormSchema, settings: AutomationSettings): {
  steps: PADStep[];
  robinScript: string;
  selectorCheatSheet: Record<string, string>;
} {
  const isBatch = settings.executionMode === 'batch_csv';
  const csvFile = settings.csvFileName || 'C:\\Data\\form_data.csv';

  const steps: PADStep[] = [
    {
      step: 1,
      category: 'Data Source',
      actionName: isBatch ? 'Read from CSV file' : 'Set variable',
      description: isBatch
        ? `Read batch records from '${csvFile}' into data table variable %CSVTable%`
        : 'Initialize test variables for single submission',
      selectorOrDetail: isBatch ? `File: ${csvFile}` : `%FormData%`,
      codeSnippet: isBatch
        ? `File.ReadFromCSVFile.ReadCSV CSVFile: $'''${csvFile}''' Encoding: File.CSVEncoding.UTF8 TrimFields: True FirstLineContainsColumnNames: True CSVTable=> CSVTable`
        : `Variables.CreateNewDatatable Columns: [$'''Name''', $'''Email'''] Datatable=> CSVTable`
    },
    {
      step: 2,
      category: 'Browser Initialization',
      actionName: 'Launch new Microsoft Edge',
      description: `Open the Microsoft Form URL '${schema.formUrl}' in an automation browser window`,
      selectorOrDetail: `URL: ${schema.formUrl}`,
      codeSnippet: `WebAutomation.LaunchEdge.LaunchEdge URL: $'''${schema.formUrl}''' WindowState: WebAutomation.BrowserWindowState.Normal ClearCache: False ClearCookies: False WaitForPageToLoadTimeout: 60 BrowserInstance=> Browser`
    },
    {
      step: 3,
      category: 'Page 1 Automation',
      actionName: 'Populate text fields & radio options on web page',
      description: `Fill out Page 1: ${schema.page1.questions.map(q => q.title).join(', ')}`,
      selectorOrDetail: `CSS: div[data-automation-id="questionItem"]`,
      codeSnippet: `# Populate Page 1 Inputs
WebAutomation.PopulateTextField.PopulateTextField BrowserInstance: Browser Control: appmask['div[data-automation-id="questionItem"]:eq(0) input'] Text: CurrentItem['${schema.page1.questions[0]?.id || 'q1'}'] Mode: WebAutomation.PopulateTextMode.Replace
WebAutomation.Click.Click BrowserInstance: Browser Control: appmask['button[data-automation-id="nextButton"]'] ClickType: WebAutomation.ClickType.LeftClick`
    },
    {
      step: 4,
      category: 'CRITICAL PAGINATION HANDLER',
      actionName: 'Wait for web page content',
      description: 'WAIT for Page 2 to hydrate before attempting to fill Page 2 inputs. Do NOT skip this step or the flow will fail with element not found!',
      selectorOrDetail: `Condition: Element 'button[data-automation-id="backButton"]' or 'button[data-automation-id="submitButton"]' is visible`,
      codeSnippet: `# Wait for Page 2 to load (Back or Submit button presence)
WebAutomation.WaitForPageContent.WaitForElement BrowserInstance: Browser Control: appmask['button[data-automation-id="backButton"]'] State: WebAutomation.ElementState.Visible Timeout: 15
# Brief safety pause for DOM rendering
System.Wait Duration: 0.8`
    },
    {
      step: 5,
      category: 'Page 2 Automation',
      actionName: 'Populate Page 2 inputs',
      description: `Fill out Page 2: ${schema.page2.questions.map(q => q.title).join(', ')}`,
      selectorOrDetail: `CSS: div[data-automation-id="questionItem"]`,
      codeSnippet: `# Populate Page 2 Inputs
WebAutomation.PopulateTextField.PopulateTextField BrowserInstance: Browser Control: appmask['div[data-automation-id="questionItem"]:eq(0) textarea'] Text: CurrentItem['${schema.page2.questions[0]?.id || 'q5'}'] Mode: WebAutomation.PopulateTextMode.Replace`
    },
    {
      step: 6,
      category: 'Submission & Verification',
      actionName: 'Click Submit & Wait for confirmation',
      description: 'Click Submit button and wait for "Your response was submitted" screen',
      selectorOrDetail: `CSS: button[data-automation-id="submitButton"]`,
      codeSnippet: `WebAutomation.Click.Click BrowserInstance: Browser Control: appmask['button[data-automation-id="submitButton"]'] ClickType: WebAutomation.ClickType.LeftClick
WebAutomation.WaitForPageContent.WaitForElement BrowserInstance: Browser Control: appmask['div[data-automation-id="thankYouMessage"]'] State: WebAutomation.ElementState.Visible Timeout: 20`
    },
    {
      step: 7,
      category: 'Loop & Cleanup',
      actionName: 'Close web browser / Next loop iteration',
      description: 'Close browser or navigate back to form URL for next record',
      selectorOrDetail: 'Action: Close Browser or Click "Submit another response"',
      codeSnippet: `WebAutomation.CloseWebBrowser BrowserInstance: Browser`
    }
  ];

  // Complete copy-pasteable PAD Robin Script
  const robinScript = `# ==============================================================
# Power Automate Desktop (PAD) Flow: Microsoft Forms 2-Page Submitter
# Form: ${schema.title}
# Form URL: ${schema.formUrl}
# ==============================================================

${isBatch ? `# Step 1: Read Batch Data from CSV
File.ReadFromCSVFile.ReadCSV CSVFile: $'''${csvFile}''' Encoding: File.CSVEncoding.UTF8 TrimFields: True FirstLineContainsColumnNames: True CSVTable=> CSVTable

LOOP FOREACH CurrentItem IN CSVTable` : `# Single Submission Setup
Variables.CreateNewDatatable Columns: [$'''q1'''] Datatable=> CSVTable`}

    # Step 2: Launch Browser
    WebAutomation.LaunchEdge.LaunchEdge URL: $'''${schema.formUrl}''' WindowState: WebAutomation.BrowserWindowState.Normal ClearCache: False ClearCookies: False WaitForPageToLoadTimeout: 60 BrowserInstance=> Browser
    
    # Step 3: Wait for Page 1 Hydration
    WebAutomation.WaitForPageContent.WaitForElement BrowserInstance: Browser Control: appmask['div[data-automation-id="questionItem"]'] State: WebAutomation.ElementState.Visible Timeout: 15
    System.Wait Duration: 0.5
    
    # --- FILL PAGE 1 ---
${schema.page1.questions.map((q, idx) => {
  if (q.type === 'text' || q.type === 'textarea') {
    return `    # Question ${q.number}: ${q.title}
    WebAutomation.PopulateTextField.PopulateTextField BrowserInstance: Browser Control: appmask['div[data-automation-id="questionItem"]:eq(${idx}) input[data-automation-id="textInput"], div[data-automation-id="questionItem"]:eq(${idx}) textarea'] Text: CurrentItem['${q.id}'] Mode: WebAutomation.PopulateTextMode.Replace
    System.Wait Duration: 0.3`;
  } else if (q.type === 'radio') {
    return `    # Question ${q.number}: ${q.title} (Radio)
    WebAutomation.Click.Click BrowserInstance: Browser Control: appmask['div[data-automation-id="questionItem"]:eq(${idx}) label:has-text("' + CurrentItem['${q.id}'] + '")'] ClickType: WebAutomation.ClickType.LeftClick
    System.Wait Duration: 0.3`;
  } else {
    return `    # Question ${q.number}: ${q.title}
    WebAutomation.PopulateTextField.PopulateTextField BrowserInstance: Browser Control: appmask['div[data-automation-id="questionItem"]:eq(${idx}) input'] Text: CurrentItem['${q.id}'] Mode: WebAutomation.PopulateTextMode.Replace`;
  }
}).join('\n')}

    # --- CRITICAL PAGINATION: CLICK NEXT & WAIT FOR PAGE 2 ---
    WebAutomation.Click.Click BrowserInstance: Browser Control: appmask['button[data-automation-id="nextButton"]'] ClickType: WebAutomation.ClickType.LeftClick
    
    # Wait for Page 2 Back button or Submit button to appear
    WebAutomation.WaitForPageContent.WaitForElement BrowserInstance: Browser Control: appmask['button[data-automation-id="backButton"]'] State: WebAutomation.ElementState.Visible Timeout: 15
    System.Wait Duration: 0.6

    # --- FILL PAGE 2 ---
${schema.page2.questions.map((q, idx) => {
  if (q.type === 'text' || q.type === 'textarea') {
    return `    # Question ${q.number}: ${q.title}
    WebAutomation.PopulateTextField.PopulateTextField BrowserInstance: Browser Control: appmask['div[data-automation-id="questionItem"]:eq(${idx}) textarea, div[data-automation-id="questionItem"]:eq(${idx}) input'] Text: CurrentItem['${q.id}'] Mode: WebAutomation.PopulateTextMode.Replace
    System.Wait Duration: 0.3`;
  } else if (q.type === 'radio') {
    return `    # Question ${q.number}: ${q.title} (Radio)
    WebAutomation.Click.Click BrowserInstance: Browser Control: appmask['div[data-automation-id="questionItem"]:eq(${idx}) label:has-text("' + CurrentItem['${q.id}'] + '")'] ClickType: WebAutomation.ClickType.LeftClick
    System.Wait Duration: 0.3`;
  } else {
    return `    # Question ${q.number}: ${q.title}
    WebAutomation.PopulateTextField.PopulateTextField BrowserInstance: Browser Control: appmask['div[data-automation-id="questionItem"]:eq(${idx}) input'] Text: CurrentItem['${q.id}'] Mode: WebAutomation.PopulateTextMode.Replace`;
  }
}).join('\n')}

    # --- SUBMISSION & CONFIRMATION ---
    WebAutomation.Click.Click BrowserInstance: Browser Control: appmask['button[data-automation-id="submitButton"]'] ClickType: WebAutomation.ClickType.LeftClick
    
    # Wait for Thank You screen
    WebAutomation.WaitForPageContent.WaitForElement BrowserInstance: Browser Control: appmask['div[data-automation-id="thankYouMessage"]'] State: WebAutomation.ElementState.Visible Timeout: 20
    System.Wait Duration: 1.0

    # Close Browser for next run
    WebAutomation.CloseWebBrowser BrowserInstance: Browser
    System.Wait Duration: 2.0

${isBatch ? `END` : ''}
`;

  const selectorCheatSheet: Record<string, string> = {
    'Page 1 Question Container': 'div[data-automation-id="questionItem"]',
    'Page 1 Text Input': 'input[data-automation-id="textInput"]',
    'Page 1 Radio Choice': 'div[data-automation-id="choiceItem"] label',
    'Page 1 Next Button': 'button[data-automation-id="nextButton"]',
    'Page 2 Back Button (Verification marker)': 'button[data-automation-id="backButton"]',
    'Page 2 Submit Button': 'button[data-automation-id="submitButton"]',
    'Submission Confirmation Screen': 'div[data-automation-id="thankYouMessage"]',
    'Submit Another Response Link': 'a[data-automation-id="submitAnother"]'
  };

  return { steps, robinScript, selectorCheatSheet };
}
