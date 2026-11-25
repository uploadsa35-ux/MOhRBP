export type QuestionType = 'text' | 'textarea' | 'radio' | 'checkbox' | 'rating' | 'date' | 'dropdown';

export interface Question {
  id: string;
  number: number;
  title: string;
  subtitle?: string;
  type: QuestionType;
  required: boolean;
  options?: string[]; // For radio, checkbox, dropdown
  ratingMax?: number; // 5 or 10 for ratings
  defaultValue?: string | string[] | number;
  // Specific selector hints used in automation
  customSelector?: string;
}

export interface FormPage {
  id: string;
  pageNumber: number;
  title: string;
  description?: string;
  questions: Question[];
}

export interface FormSchema {
  id: string;
  title: string;
  description: string;
  formUrl: string;
  isAnonymous: boolean; // Public or requires Microsoft 365 login
  page1: FormPage;
  page2: FormPage;
}

export interface AutomationSettings {
  language: 'playwright' | 'selenium' | 'power_automate_desktop' | 'power_automate_cloud';
  executionMode: 'single' | 'batch_csv';
  headless: boolean;
  humanTypingDelay: boolean; // Random delays between typing
  retryAttempts: number;
  timeoutSeconds: number;
  csvFileName: string;
  takeScreenshots: boolean;
}

export interface BatchRecord {
  id: string;
  data: Record<string, string>;
}
