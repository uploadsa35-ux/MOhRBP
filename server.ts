import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import fs from 'fs';
import { 
  draftSoarCardWithAI, 
  updateDraftCardWithAI, 
  generateBatchAiCards, 
  generateSingleAiCardWithSeedAndContext, 
  improveAndConvertRawCardsToTrainingIdeas,
  repolishSingleTrainingIdeaWithAI,
  remakeOperationCardWithAI,
  generateOperationsCardsBatchWithAI,
  getActiveGeminiModel,
  DraftCard 
} from './server/aiCoach.js';
import { DailySchedulerManager } from './server/dailyScheduler.js';
import {
  getSupervisorSettingsFromDb,
  saveSupervisorSettingsToDb,
  getCrewRosterFromDb,
  saveCrewRosterToDb,
  getPromptBlacklistFromDb,
  savePromptBlacklistToDb,
  reconcilePromptBlacklistWithSoarCardsDb,
  getTrainingIdeasFromDb,
  saveTrainingIdeasBatchToDb,
  deleteTrainingIdeaFromDb,
  deleteTrainingIdeasBatchFromDb,
  clearAllTrainingIdeasFromDb,
  recordCardToDb,
  getRecordedCardsFromDb,
  getOperationsSubmissionLogsFromDb,
  appendOperationsSubmissionLogEntryToDb,
  deleteOperationsSubmissionLogEntryFromDb,
  clearOperationsSubmissionLogsInDb
} from './server/firestoreDb.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = fs.existsSync(path.join(__dirname, 'package.json')) ? __dirname : path.resolve(__dirname, '..');

// Server state backed by Firestore Database
let serverSettings = {
  supervisorNumber: '5050',
  portalLockedDown: false,
  tabPermissions: {
    online: true,
    whatsapp: true,
    crew: true,
    emailPdf: false,
    simulator: true,
    mass: false,
    operations: false,
    scripts: false
  },
  updatedAt: new Date().toISOString()
};

let serverCrewData: { crew: any[]; anonymousRatio: number; updatedAt: string } = {
  crew: [],
  anonymousRatio: 30,
  updatedAt: new Date().toISOString()
};

let serverTrainingIdeas: any[] = [];
let serverPromptBlacklist: string[] = [];
let serverSoarCardsCount = 0;

// Hydrate initial state from Firestore Database & reconcile promptBlacklist after server is listening
setTimeout(async () => {
  try {
    serverSettings = await getSupervisorSettingsFromDb(serverSettings);
    serverCrewData = await getCrewRosterFromDb(serverCrewData);
    const dbIdeas = await getTrainingIdeasFromDb();
    if (Array.isArray(dbIdeas) && dbIdeas.length > 0) {
      serverTrainingIdeas = dbIdeas;
    }
    const reconciled = await reconcilePromptBlacklistWithSoarCardsDb();
    if (Array.isArray(reconciled.blacklist) && reconciled.blacklist.length > 0) {
      serverPromptBlacklist = reconciled.blacklist;
    }
    if (reconciled.soarCardsCount > 0) {
      serverSoarCardsCount = reconciled.soarCardsCount;
    }
  } catch (e) {
    console.warn('Firestore initial server hydration notice:', e);
  }
}, 1500);

const RIG_50_NAME = "50 Bob Palmer (RBP-50A)";
const TENANT_ID = "3edb09c5-cf5e-41d3-8f81-c58064ce5985";
const OWNER_ID = "10ed268e-6545-4a82-be17-2d0d7ab2e0a3";
const FORM_ID = "xQnbPl7P00GPgcWAZM5ZhY4m7RBFZYJKvhctDXqy4KNUMjJRVFBGVDlVMzFEMUJOVUhMSjk1WU0wMy4u";

export const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Enable CORS for external hosting (e.g. Hostinger, mobile web, custom domains)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Helper to submit to Microsoft Forms with robust timeout, retry & Hostinger resilience
async function submitToMsForms(answers: Array<{ questionId: string; answer1: string }>, startDate?: string, maxRetries = 2) {
    const endpoint = `https://forms.cloud.microsoft/formapi/api/${TENANT_ID}/users/${OWNER_ID}/forms('${FORM_ID}')/responses`;
    const now = new Date();
    const start = startDate ? new Date(startDate) : new Date(now.getTime() - 45000);

    const payload = {
      startDate: start.toISOString(),
      submitDate: now.toISOString(),
      answers: JSON.stringify(answers),
      submitLanguage: 'en-US',
      emailReceiptConsent: false
    };

    let lastError: any = null;
    let lastStatus = 500;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 18000); // 18s timeout

      try {
        const msResponse = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': 'https://forms.cloud.microsoft',
            'Referer': `https://forms.cloud.microsoft/pages/responsepage.aspx?id=${FORM_ID}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*'
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        const responseText = await msResponse.text();
        let responseData: any = {};
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = { raw: responseText };
        }

        if (msResponse.ok || (msResponse.status >= 200 && msResponse.status < 300)) {
          return {
            ok: true,
            status: msResponse.status,
            data: responseData
          };
        }

        lastStatus = msResponse.status;
        lastError = responseData;
        if (attempt <= maxRetries && (msResponse.status === 429 || msResponse.status >= 500)) {
          await new Promise(r => setTimeout(r, 1000 * attempt));
          continue;
        }

        return {
          ok: false,
          status: msResponse.status,
          data: responseData
        };
      } catch (err: any) {
        clearTimeout(timeoutId);
        lastError = err;
        if (attempt <= maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * attempt));
          continue;
        }
        return {
          ok: false,
          status: 502,
          data: { error: err.name === 'AbortError' ? 'MS Forms submission timed out' : err.message }
        };
      }
    }

    return {
      ok: false,
      status: lastStatus,
      data: lastError
    };
  }

  // Initialize and start persistent daily schedule automation manager
  const dailySchedulerManager = new DailySchedulerManager(PROJECT_ROOT, submitToMsForms);
  dailySchedulerManager.start();

  // API Endpoints: Daily Automated Run Schedule & Email Confirmation
  app.get('/api/daily-schedule', (req: Request, res: Response) => {
    return res.json({
      success: true,
      schedule: dailySchedulerManager.getScheduleStatus()
    });
  });

  app.post('/api/daily-schedule', (req: Request, res: Response) => {
    try {
      const updated = dailySchedulerManager.updateSchedule(req.body);
      return res.json({
        success: true,
        schedule: dailySchedulerManager.getScheduleStatus()
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/daily-schedule/logs', (req: Request, res: Response) => {
    try {
      const logs = dailySchedulerManager.getLogs();
      return res.json({
        success: true,
        logs
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/daily-schedule/logs/clear', (req: Request, res: Response) => {
    try {
      dailySchedulerManager.clearLogs();
      return res.json({
        success: true,
        message: 'Daily run logs cleared'
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/daily-schedule/record-run', (req: Request, res: Response) => {
    try {
      const entry = req.body;
      if (entry && entry.id) {
        dailySchedulerManager.addLogEntry(entry);
      }
      return res.json({
        success: true,
        logs: dailySchedulerManager.getLogs()
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/daily-schedule/reset-today', (req: Request, res: Response) => {
    try {
      dailySchedulerManager.resetTodayRunStatus();
      return res.json({
        success: true,
        schedule: dailySchedulerManager.getScheduleStatus(),
        message: "Today's scheduled run date cleared. The timer can trigger again today."
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/daily-schedule/run-now', async (req: Request, res: Response) => {
    try {
      const isSimulatedScheduled = req.query.simulateScheduled === 'true' || req.body?.simulateScheduled === true;
      const result = await dailySchedulerManager.executeMassSubmissionRun(!isSimulatedScheduled);
      return res.json({
        ...result,
        schedule: dailySchedulerManager.getScheduleStatus()
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/daily-schedule/test-email', async (req: Request, res: Response) => {
    try {
      const { recipientEmail } = req.body || {};
      const result = await dailySchedulerManager.sendTestEmail(recipientEmail);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Endpoint: Version and Deployment Information (Verifies Hostinger sync)
  app.get('/api/version', (req: Request, res: Response) => {
    return res.json({
      success: true,
      version: '2.4.0',
      buildDate: '2026-10-03',
      releaseTag: 'v2.4.0-hostinger-sync',
      nodeEnv: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      platform: 'Hostinger / Cloud',
      uptime: Math.floor(process.uptime()),
      rig: RIG_50_NAME,
      formId: FORM_ID,
      timestamp: new Date().toISOString()
    });
  });

  // API Endpoint: Test Form Connection (Hostinger to Microsoft Forms health check)
  app.get('/api/test-form-connection', async (req: Request, res: Response) => {
    try {
      const formUrl = `https://forms.cloud.microsoft/pages/responsepage.aspx?id=${FORM_ID}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const msCheck = await fetch(formUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      return res.json({
        success: true,
        reachable: msCheck.ok,
        status: msCheck.status,
        formId: FORM_ID,
        rig: RIG_50_NAME,
        hostingerReady: true,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      return res.status(502).json({
        success: false,
        reachable: false,
        error: err.name === 'AbortError' ? 'Connection timed out' : err.message,
        hostingerReady: true
      });
    }
  });

  // API Endpoint: Standard Direct Submission
  app.post('/api/submit-response', async (req: Request, res: Response) => {
    try {
      const { answers, startDate } = req.body;
      if (!answers || !Array.isArray(answers)) {
        return res.status(400).json({ error: 'answers must be an array of { questionId, answer1 }' });
      }

      const result = await submitToMsForms(answers, startDate);
      if (!result.ok) {
        return res.status(result.status).json({ success: false, status: result.status, error: result.data });
      }

      return res.json({
        success: true,
        status: result.status,
        timestamp: new Date().toISOString(),
        data: result.data
      });
    } catch (error: any) {
      console.error('Submission proxy error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // API Endpoint: High-Throughput Batch Chunk Runner (for 1000s of cards)
  app.post('/api/submit-chunk', async (req: Request, res: Response) => {
    try {
      const { items } = req.body;
      if (!items || !Array.isArray(items)) {
        return res.status(400).json({ error: 'items must be an array of { answers }' });
      }

      // Process items concurrently
      const results = await Promise.all(
        items.map(async (item: any) => {
          try {
            const res = await submitToMsForms(item.answers);
            return {
              id: item.id || null,
              success: res.ok,
              responseId: res.data?.id || `MS-${Date.now().toString().slice(-5)}`,
              status: res.status
            };
          } catch (e: any) {
            return {
              id: item.id || null,
              success: false,
              error: e.message
            };
          }
        })
      );

      const successCount = results.filter(r => r.success).length;

      return res.json({
        success: true,
        total: items.length,
        succeeded: successCount,
        failed: items.length - successCount,
        results
      });
    } catch (error: any) {
      console.error('Chunk submit error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // API Endpoint: Send Email with Attached SOAR PDF
  app.post('/api/send-email-report', async (req: Request, res: Response) => {
    try {
      const {
        recipient = 'uploadsa35@gmail.com',
        subject = `[SOAR Report] Rig 50 (50 Bob Palmer) Safety Observation`,
        reportData = {},
        pdfBase64
      } = req.body;

      if (!recipient) {
        return res.status(400).json({ error: 'recipient email is required' });
      }

      // Check if SMTP is configured in environment
      const hasCustomSmtp = process.env.SMTP_HOST && process.env.SMTP_USER;
      let transporter: any;

      if (hasCustomSmtp) {
        transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });
      } else {
        // Create an Ethereal cloud test account for instant sandbox email testing
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass
          }
        });
      }

      const attachments: any[] = [];
      if (pdfBase64) {
        // Strip data:application/pdf;base64, prefix if present
        const base64Data = pdfBase64.replace(/^data:application\/pdf;filename=.*?;base64,/, '').replace(/^data:application\/pdf;base64,/, '');
        attachments.push({
          filename: `SOAR_Rig50_Receipt_${reportData.responseId || Date.now()}.pdf`,
          content: Buffer.from(base64Data, 'base64'),
          contentType: 'application/pdf'
        });
      }

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 650px; margin: auto; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #03787c; color: white; padding: 18px 24px;">
            <h2 style="margin: 0; font-size: 20px;">STOP OBSERVE ACT REPORT (SOAR)</h2>
            <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">Rig 50 - 50 Bob Palmer (RBP-50A) · Official HSE Report</p>
          </div>
          
          <div style="padding: 24px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 15px;">
              <div>
                <span style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold;">Receipt Reference:</span><br/>
                <strong style="font-size: 16px; color: #03787c;">#${reportData.responseId || '146605'}</strong>
              </div>
              <div>
                <span style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold;">Assessment:</span><br/>
                <strong style="color: ${reportData.assessment === 'Safe' ? '#059669' : '#e11d48'};">${reportData.assessment || 'Safe'}</strong>
              </div>
              <div>
                <span style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold;">Date:</span><br/>
                <strong>${reportData.date || new Date().toISOString().split('T')[0]}</strong>
              </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
              <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px 12px; font-weight: bold; width: 35%;">Rig Location:</td>
                <td style="padding: 8px 12px;">50 Bob Palmer (RBP-50A)</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px 12px; font-weight: bold;">Zone / Area:</td>
                <td style="padding: 8px 12px;">${reportData.zone || 'Rig Floor'}</td>
              </tr>
              <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px 12px; font-weight: bold;">Observer Role:</td>
                <td style="padding: 8px 12px;">${reportData.role || 'Floorman'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px 12px; font-weight: bold;">Observer Name:</td>
                <td style="padding: 8px 12px;">${reportData.name ? reportData.name : 'Anonymous / Empty (Confidential)'}</td>
              </tr>
            </table>

            <div style="margin-bottom: 20px;">
              <h4 style="margin: 0 0 6px; font-size: 13px; color: #334155; text-transform: uppercase;">Observation Description:</h4>
              <div style="background-color: #f1f5f9; padding: 12px; border-radius: 6px; font-size: 13px; line-height: 1.5;">
                ${reportData.observation || 'Observation recorded.'}
              </div>
            </div>

            <div style="margin-bottom: 20px;">
              <h4 style="margin: 0 0 6px; font-size: 13px; color: #047857; text-transform: uppercase;">Corrective Action Taken:</h4>
              <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px; border-radius: 6px; font-size: 13px; line-height: 1.5; color: #166534;">
                ${reportData.action || 'Action logged and completed.'}
              </div>
            </div>

            <p style="font-size: 12px; color: #64748b; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 14px;">
              📎 <em>The complete official SOAR Observation PDF is attached to this email.</em>
            </p>
          </div>
        </div>
      `;

      const mailOptions = {
        from: '"Rig 50 SOAR Safety System" <safety@rig50.hse-reports.com>',
        to: recipient,
        subject,
        text: `SOAR Report - Rig 50 (50 Bob Palmer) - Receipt #${reportData.responseId || '146605'} - Assessment: ${reportData.assessment || 'Safe'}`,
        html: htmlContent,
        attachments
      };

      const info = await transporter.sendMail(mailOptions);
      const previewUrl = nodemailer.getTestMessageUrl(info);

      return res.json({
        success: true,
        messageId: info.messageId,
        recipient,
        previewUrl: previewUrl || null,
        hasCustomSmtp: Boolean(hasCustomSmtp)
      });
    } catch (err: any) {
      console.error('Email sending error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Server-side PDF text extraction fallback endpoint (using pdfjs-dist legacy build in Node.js)
  app.post('/api/extract-pdf-text', async (req: Request, res: Response) => {
    try {
      const { pdfBase64 } = req.body || {};
      if (!pdfBase64 || typeof pdfBase64 !== 'string') {
        return res.status(400).json({ success: false, error: 'Missing pdfBase64 payload' });
      }
      const cleanBase64 = pdfBase64.replace(/^data:[^,]+,/, '').trim();
      const uint8 = new Uint8Array(Buffer.from(cleanBase64, 'base64'));
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const loadingTask = pdfjsLib.getDocument({
        data: uint8,
        useSystemFonts: true,
        disableFontFace: true
      });
      const pdf = await loadingTask.promise;
      let fullText = '';
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str || '').join(' ');
        fullText += `\n--- Page ${pageNum} ---\n` + pageText;
      }
      return res.json({ success: true, text: fullText.trim(), numPages: pdf.numPages });
    } catch (err: any) {
      console.error('Server PDF text extraction error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Server PDF parsing failed' });
    }
  });

  // Server-side multi-format document extraction endpoint (Word .docx/.doc, Excel .xlsx/.xls/.csv, PDF .pdf)
  app.post('/api/extract-document-text', async (req: Request, res: Response) => {
    try {
      const { fileBase64, fileName = '' } = req.body || {};
      if (!fileBase64 || typeof fileBase64 !== 'string') {
        return res.status(400).json({ success: false, error: 'Missing fileBase64 payload' });
      }
      const cleanBase64 = fileBase64.replace(/^data:[^,]+,/, '').trim();
      const buffer = Buffer.from(cleanBase64, 'base64');
      const lowerName = String(fileName).toLowerCase();

      if (lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) {
        try {
          const mammothMod: any = await import('mammoth');
          const mammothLib = mammothMod.default || mammothMod;
          const result = await mammothLib.extractRawText({ buffer });
          if (result && typeof result.value === 'string' && result.value.trim()) {
            return res.json({ success: true, text: result.value.trim() });
          }
        } catch (docErr) {
          console.warn('Mammoth server extraction notice, falling back to raw text extraction:', docErr);
        }
        // Fallback for legacy .doc binary or custom XML: extract readable ASCII/UTF-8 runs
        const rawText = buffer
          .toString('utf8')
          .replace(/<[^>]+>/g, ' ')
          .replace(/[^\x20-\x7E\r\n\u0600-\u06FF]+/g, ' ')
          .replace(/\s{2,}/g, ' ')
          .trim();
        return res.json({ success: true, text: rawText });
      }

      if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv')) {
        const xlsxMod: any = await import('xlsx');
        const XLSX = xlsxMod.default || xlsxMod;
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const lines: string[] = [];
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          if (!sheet) continue;
          const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
          if (rows.length > 0) {
            lines.push(`--- Sheet: ${sheetName} ---`);
            for (const row of rows) {
              const nonEmpty = row.map(cell => String(cell ?? '').trim()).filter(Boolean);
              if (nonEmpty.length > 0) {
                lines.push(nonEmpty.join(' | '));
              }
            }
          }
        }
        return res.json({ success: true, text: lines.join('\n').trim() });
      }

      // Default to UTF-8 text
      return res.json({ success: true, text: buffer.toString('utf8').trim() });
    } catch (err: any) {
      console.error('Server document extraction error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Server document parsing failed' });
    }
  });

  // In-memory session tracking for multi-turn WhatsApp approval flow
  interface PendingWhatsAppSession {
    draft: DraftCard;
    step: 'awaiting_confirmation';
    updatedAt: number;
  }

  const pendingSessions = new Map<string, PendingWhatsAppSession>();

  function cleanExpiredSessions() {
    const now = Date.now();
    for (const [k, v] of pendingSessions.entries()) {
      if (now - v.updatedAt > 3 * 3600 * 1000) {
        pendingSessions.delete(k);
      }
    }
  }

  // API Endpoint: WhatsApp Webhook & AI Safety Coach Multi-turn Conversation
  app.all('/api/whatsapp-webhook', async (req: Request, res: Response) => {
    try {
      let text = (req.body?.Body || req.body?.text || req.body?.message || '').trim();
      const senderKey = String(req.body?.From || req.body?.senderId || req.body?.phone || 'simulator_user');
      const senderName = req.body?.ProfileName || req.body?.name || '';
      const isInstant = Boolean(req.body?.instant === true);

      if (!text) {
        return res.status(200).send('OK');
      }

      cleanExpiredSessions();
      const session = pendingSessions.get(senderKey);
      const lower = text.toLowerCase();

      // Check if client expects JSON or if it is an actual Twilio URL-encoded webhook request
      const acceptsJson = Boolean(
        req.headers['accept']?.includes('application/json') || 
        req.headers['content-type']?.includes('application/json') || 
        req.body?.client === 'web'
      );
      const isTwilio = !acceptsJson && Boolean(req.headers['x-twilio-signature'] || (req.body?.AccountSid && req.body?.From));

      // Helper to send either Twilio TwiML or JSON
      const sendReply = (replyText: string, extraData: any = {}) => {
        if (isTwilio && typeof req.body?.Body !== 'undefined') {
          res.set('Content-Type', 'text/xml');
          const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${replyText.replace(/\\n/g, '&#10;')}</Message></Response>`;
          return res.send(twiml);
        }
        return res.json({
          success: true,
          replyMessage: replyText,
          ...extraData
        });
      };

      const formatDraftPreview = (d: DraftCard) => {
        if (d.language === 'ar') {
          return `🤖 *مدرب السلامة لمنصة ريج 50 (مسودة كرت SOAR)*\\n\\n` +
            `قمت بصياغة كرت السلامة باللغة العربية:\\n\\n` +
            `📍 *المنطقة:* ${d.zoneArabic || d.zone}\\n` +
            `👷 *الصفة:* ${d.roleArabic || d.role}\\n` +
            `⚡ *الحالة:* ${d.assessmentArabic || (d.assessment === 'Safe' ? 'آمن (Safe)' : 'غير آمن (Unsafe)')}\\n` +
            `👤 *المراقب:* ${d.name || 'مجهول (Anonymous)'}\\n\\n` +
            `📝 *الملاحظة:*\\n${d.observation}\\n\\n` +
            `🛡️ *الإجراء المتخذ:*\\n${d.action}\\n\\n` +
            `━━━━━━━━━━━━━━━\\n` +
            `💬 *هل توافق على إرسال هذا الكرت إلى ريج 50؟*\\n` +
            `👉 أرسل *نعم* أو *YES* للإرسال المباشر.\\n` +
            `👉 أو اذكر أي تعديل (مثال: "غيّر المنطقة إلى الهزازات" أو "المراقب أحمد").`;
        }

        return `🤖 *Rig 50 Safety Coach (Draft Preview)*\\n\\n` +
          `I rewrote your note into a structured SOAR card:\\n\\n` +
          `📍 *Zone:* ${d.zone}\\n` +
          `👷 *Role:* ${d.role}\\n` +
          `⚡ *Status:* ${d.assessment}\\n` +
          `👤 *Observer:* ${d.name || 'Anonymous (Empty)'}\\n\\n` +
          `📝 *Observation:*\\n${d.observation}\\n\\n` +
          `🛡️ *Action Taken:*\\n${d.action}\\n\\n` +
          `━━━━━━━━━━━━━━━\\n` +
          `💬 *Do you agree with this card?*\\n` +
          `👉 Reply *YES* to submit directly to Rig 50.\\n` +
          `👉 Or reply with changes (e.g. *"Change zone to Shakers"* or *"Observer is Khalid"*).`;
      };

      const formatUpdatedPreview = (d: DraftCard) => {
        if (d.language === 'ar') {
          return `🔄 *تم تحديث الكرت!*\\n\\n` +
            `إليك كرت السلامة بعد التعديل:\\n\\n` +
            `📍 *المنطقة:* ${d.zoneArabic || d.zone}\\n` +
            `👷 *الصفة:* ${d.roleArabic || d.role}\\n` +
            `⚡ *الحالة:* ${d.assessmentArabic || (d.assessment === 'Safe' ? 'آمن (Safe)' : 'غير آمن (Unsafe)')}\\n` +
            `👤 *المراقب:* ${d.name || 'مجهول (Anonymous)'}\\n\\n` +
            `📝 *الملاحظة:*\\n${d.observation}\\n\\n` +
            `🛡️ *الإجراء المتخذ:*\\n${d.action}\\n\\n` +
            `━━━━━━━━━━━━━━━\\n` +
            `💬 *هل توافق على هذا الكرت الآن؟*\\n` +
            `👉 أرسل *نعم* أو *YES* للإرسال إلى ريج 50.\\n` +
            `👉 أو اذكر أي تعديل إضافي (أو *إلغاء* للتراجع).`;
        }

        return `🔄 *Card Updated!*\\n\\n` +
          `Here is your revised SOAR card:\\n\\n` +
          `📍 *Zone:* ${d.zone}\\n` +
          `👷 *Role:* ${d.role}\\n` +
          `⚡ *Status:* ${d.assessment}\\n` +
          `👤 *Observer:* ${d.name || 'Anonymous (Empty)'}\\n\\n` +
          `📝 *Observation:*\\n${d.observation}\\n\\n` +
          `🛡️ *Action Taken:*\\n${d.action}\\n\\n` +
          `━━━━━━━━━━━━━━━\\n` +
          `💬 *Do you agree with this card now?*\\n` +
          `👉 Reply *YES* to submit to Rig 50.\\n` +
          `👉 Or tell me what else you want to change (or *CANCEL* to discard).`;
      };

      const formatSubmittedReceipt = (d: DraftCard, responseId: string) => {
        if (d.language === 'ar') {
          return `✅ *تم إرسال كرت SOAR بنجاح إلى ريج 50!*\\n\\n` +
            `📋 *رقم الإيصال:* #${responseId}\\n` +
            `🚢 *المنصة:* 50 Bob Palmer (RBP-50A)\\n` +
            `📍 *المنطقة:* ${d.zoneArabic || d.zone}\\n` +
            `👷 *الصفة:* ${d.roleArabic || d.role}\\n` +
            `⚡ *الحالة:* ${d.assessmentArabic || d.assessment}\\n` +
            `👤 *المراقب:* ${d.name || 'مجهول (Anonymous)'}\\n\\n` +
            `📝 *الملاحظة:* ${d.observation}\\n` +
            `🛡️ *الإجراء:* ${d.action}\\n\\n` +
            `_شكراً لمساهمتك في الحفاظ على سلامة منصة ريج 50!_`;
        }

        return `✅ *SOAR Officially Submitted to Rig 50!*\\n\\n` +
          `📋 *Receipt ID:* #${responseId}\\n` +
          `🚢 *Rig:* 50 Bob Palmer (RBP-50A)\\n` +
          `📍 *Zone:* ${d.zone}\\n` +
          `👷 *Role:* ${d.role}\\n` +
          `⚡ *Status:* ${d.assessment}\\n` +
          `👤 *Observer:* ${d.name || 'Anonymous (Empty)'}\\n\\n` +
          `📝 *Observation:* ${d.observation}\\n` +
          `🛡️ *Action:* ${d.action}\\n\\n` +
          `_Thank you for keeping Rig 50 safe!_`;
      };

      // Case 1: Active session waiting for user confirmation
      if (!isInstant && session && session.step === 'awaiting_confirmation') {
        const isApproval = /^(yes|y|send|ok|confirm|agree|submit|proceed|approved|sure|yes send|send it|done|نعم|ارسل|أرسل|تمام|موافق|اوكي|أوكي|اعتمد|ارسلها|أرسلها|صحيح)$/i.test(lower);
        const isCancel = /^(cancel|stop|discard|reset|no|quit|exit|nevermind|delete|الغاء|إلغاء|لا|تراجع|كنسل)$/i.test(lower);

        if (isApproval) {
          // APPROVED: Submit the drafted card to Microsoft Forms
          const draft = session.draft;
          pendingSessions.delete(senderKey);

          const todayStr = new Date().toISOString().split('T')[0];
          const answers = [
            { questionId: 'r5f3272b6049d4ad18e7650bd96ae837b', answer1: todayStr },
            { questionId: 'r4fdd1bd872014d9c80d3a51be3f2f950', answer1: RIG_50_NAME },
            { questionId: 'r409eb59dd0f244e4b52573ce50037896', answer1: draft.zone },
            { questionId: 'rfe47535c542e4ce8886c2741c4c69b78', answer1: draft.role },
            { questionId: 'r26c88746635b40a39ef3f873e00e78a8', answer1: draft.assessment },
            { questionId: 'ra8f38f21840f490a87ac70d61da452f8', answer1: draft.obsType || (draft.assessment === 'Safe' ? 'Behavior Observation' : 'Condition') },
            { questionId: 'r2d178592d7f94a6aad56238bc1005d5f', answer1: 'Red Zone Control Failure' },
            { questionId: 'r22c97581ebf74a8498da93d022d8afcf', answer1: 'PPE Worn Correctly (Compliant)' },
            { questionId: 're36e820370e2436798ea97f34930b753', answer1: draft.observation },
            { questionId: 'rda2692cb0c9841fdb71f4b2ec5415728', answer1: draft.action },
            { questionId: 'r698ffb98e604476b92020bb6c34790e9', answer1: draft.name }
          ];

          const result = await submitToMsForms(answers);
          const responseId = result.data?.id || `MS-${Date.now().toString().slice(-5)}`;

          const reply = formatSubmittedReceipt(draft, responseId);

          return sendReply(reply, {
            responseId,
            status: 'submitted',
            draft,
            isPendingApproval: false
          });
        }

        if (isCancel) {
          const draftLang = session.draft.language;
          pendingSessions.delete(senderKey);
          const reply = draftLang === 'ar'
            ? `❌ *تم إلغاء المسودة.*\\n\\nتم التراجع عن كرت السلامة المعلق. يمكنك إرسال ملاحظة جديدة في أي وقت.`
            : `❌ *Draft Cancelled.*\\n\\nYour pending observation has been discarded. You can send a fresh note anytime.`;
          return sendReply(reply, {
            status: 'cancelled',
            isPendingApproval: false
          });
        }

        // USER IS ASKING FOR CHANGES: Update draft with AI
        const updatedDraft = await updateDraftCardWithAI(session.draft, text);
        session.draft = updatedDraft;
        session.updatedAt = Date.now();

        const reply = formatUpdatedPreview(updatedDraft);

        return sendReply(reply, {
          status: 'awaiting_confirmation',
          draft: updatedDraft,
          isPendingApproval: true
        });
      }

      // Case 2: User asked for instant 1-click submit
      if (isInstant) {
        const draft = await draftSoarCardWithAI(text, senderName);
        const todayStr = new Date().toISOString().split('T')[0];
        const answers = [
          { questionId: 'r5f3272b6049d4ad18e7650bd96ae837b', answer1: todayStr },
          { questionId: 'r4fdd1bd872014d9c80d3a51be3f2f950', answer1: RIG_50_NAME },
          { questionId: 'r409eb59dd0f244e4b52573ce50037896', answer1: draft.zone },
          { questionId: 'rfe47535c542e4ce8886c2741c4c69b78', answer1: draft.role },
          { questionId: 'r26c88746635b40a39ef3f873e00e78a8', answer1: draft.assessment },
          { questionId: 'ra8f38f21840f490a87ac70d61da452f8', answer1: draft.obsType || (draft.assessment === 'Safe' ? 'Behavior Observation' : 'Condition') },
          { questionId: 'r2d178592d7f94a6aad56238bc1005d5f', answer1: 'Red Zone Control Failure' },
          { questionId: 'r22c97581ebf74a8498da93d022d8afcf', answer1: 'PPE Worn Correctly (Compliant)' },
          { questionId: 're36e820370e2436798ea97f34930b753', answer1: draft.observation },
          { questionId: 'rda2692cb0c9841fdb71f4b2ec5415728', answer1: draft.action },
          { questionId: 'r698ffb98e604476b92020bb6c34790e9', answer1: draft.name }
        ];

        const result = await submitToMsForms(answers);
        const responseId = result.data?.id || `MS-${Date.now().toString().slice(-5)}`;

        const reply = formatSubmittedReceipt(draft, responseId);

        return sendReply(reply, {
          responseId,
          status: 'submitted',
          draft,
          isPendingApproval: false
        });
      }

      // Case 3: Brand new observation -> Use AI to draft & prompt for agreement
      const activeIdeas = serverTrainingIdeas.filter((i: any) => i && i.isActive !== false);
      const draft = await draftSoarCardWithAI(text, {
        observerName: senderName,
        trainingIdeas: activeIdeas
      });
      pendingSessions.set(senderKey, {
        draft,
        step: 'awaiting_confirmation',
        updatedAt: Date.now()
      });

      const reply = formatDraftPreview(draft);

      return sendReply(reply, {
        status: 'awaiting_confirmation',
        draft,
        isPendingApproval: true
      });
    } catch (err: any) {
      console.error('WhatsApp webhook error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Endpoint: AI Rewrite & Structure SOAR Card from Rough Notes (or Create From Scratch)
  // Also aliased at /api/polish-card for direct component test compatibility
  const handleAiRewriteRequest = async (req: Request, res: Response) => {
    try {
      const { 
        roughNote, 
        note, 
        observerName, 
        observerRole, 
        observedRole, 
        zone, 
        assessment, 
        obsType, 
        trainingIdeas 
      } = req.body || {};
      const noteToProcess = (typeof roughNote === 'string' ? roughNote : (typeof note === 'string' ? note : '')).trim();

      const activeIdeas = (Array.isArray(trainingIdeas) && trainingIdeas.length > 0)
        ? trainingIdeas
        : serverTrainingIdeas.filter((i: any) => i && i.isActive !== false);

      const card = await draftSoarCardWithAI(noteToProcess, {
        observerName,
        observerRole,
        observedRole,
        zone,
        assessment,
        obsType,
        trainingIdeas: activeIdeas
      });
      return res.json({
        success: true,
        card,
        // Also provide top-level fields for direct consumer compatibility
        observation: card.observation,
        action: card.action,
        zone: card.zone,
        role: card.role,
        assessment: card.assessment,
        obsType: card.obsType
      });
    } catch (err: any) {
      console.error('AI Rewrite error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  };

  app.post('/api/ai-rewrite-card', handleAiRewriteRequest);
  app.post('/api/polish-card', handleAiRewriteRequest);

  // API Endpoint: Generate unique AI SOAR cards batch on-demand
  app.post('/api/generate-ai-cards', async (req: Request, res: Response) => {
    try {
      const { count = 10, category = 'Safe', theme = 'all', assessmentFilter = 'safe_only', blacklist = [], trainingIdeas = [] } = req.body || {};
      const activeIdeas = (Array.isArray(trainingIdeas) && trainingIdeas.length > 0)
        ? trainingIdeas
        : serverTrainingIdeas.filter((i: any) => i && i.isActive !== false);

      const cards = await generateBatchAiCards({
        count: Number(count) || 10,
        category,
        theme,
        assessmentFilter,
        blacklist: Array.isArray(blacklist) ? blacklist : [],
        trainingIdeas: activeIdeas
      });
      return res.json({
        success: true,
        cards
      });
    } catch (err: any) {
      console.error('AI Card Generation error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Endpoint: Generate a single unique AI card with seed and context
  app.post('/api/generate-single-ai-card', async (req: Request, res: Response) => {
    try {
      const { iteration = 1, seed = '', context = '', category = 'Safe', theme = 'all', assessmentFilter = 'safe_only', blacklist = [], trainingIdeas = [] } = req.body || {};
      const activeIdeas = (Array.isArray(trainingIdeas) && trainingIdeas.length > 0)
        ? trainingIdeas
        : serverTrainingIdeas.filter((i: any) => i && i.isActive !== false);

      const card = await generateSingleAiCardWithSeedAndContext({
        iteration: Number(iteration) || 1,
        seed: String(seed || Date.now()),
        context: String(context || 'Rig 50 routine drill operation'),
        category,
        theme,
        assessmentFilter,
        blacklist: Array.isArray(blacklist) ? blacklist : [],
        trainingIdeas: activeIdeas
      });
      return res.json({
        success: Boolean(card),
        card
      });
    } catch (err: any) {
      console.error('Single AI Card Generation error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Endpoint: Get persistent AI training ideas
  app.get('/api/training-ideas', async (req: Request, res: Response) => {
    try {
      const dbIdeas = await getTrainingIdeasFromDb();
      if (Array.isArray(dbIdeas) && dbIdeas.length > 0) {
        serverTrainingIdeas = dbIdeas;
      }
    } catch {}
    return res.json({
      success: true,
      ideas: serverTrainingIdeas,
      count: serverTrainingIdeas.length
    });
  });

  // API Endpoint: Sync/Save AI training ideas to Firestore
  app.post('/api/training-ideas', async (req: Request, res: Response) => {
    try {
      const { ideas } = req.body || {};
      if (Array.isArray(ideas)) {
        serverTrainingIdeas = ideas;
        await saveTrainingIdeasBatchToDb(ideas);
      }
      return res.json({ success: true, count: serverTrainingIdeas.length });
    } catch (err: any) {
      console.warn('Failed to save training ideas to Firestore:', err);
      return res.json({ success: true, count: serverTrainingIdeas.length });
    }
  });

  // API Endpoint: Delete single AI training idea by ID
  app.delete('/api/training-ideas/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      serverTrainingIdeas = serverTrainingIdeas.filter((item: any) => item.id !== id);
      await deleteTrainingIdeaFromDb(id);
      return res.json({ success: true, count: serverTrainingIdeas.length });
    } catch (err: any) {
      console.warn('Failed to delete idea from Firestore:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Endpoint: Bulk delete AI training ideas
  app.post('/api/training-ideas/bulk-delete', async (req: Request, res: Response) => {
    try {
      const { ids } = req.body || {};
      if (Array.isArray(ids)) {
        const idSet = new Set(ids);
        serverTrainingIdeas = serverTrainingIdeas.filter((item: any) => !idSet.has(item.id));
        await deleteTrainingIdeasBatchFromDb(ids);
      }
      return res.json({ success: true, count: serverTrainingIdeas.length });
    } catch (err: any) {
      console.warn('Failed to bulk delete ideas from Firestore:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Endpoint: Clear all AI training ideas
  app.delete('/api/training-ideas', async (req: Request, res: Response) => {
    try {
      serverTrainingIdeas = [];
      await clearAllTrainingIdeasFromDb();
      return res.json({ success: true, count: 0 });
    } catch (err: any) {
      console.warn('Failed to clear ideas in Firestore:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Endpoint: Increment AI training idea usage counts
  app.post('/api/training-ideas/increment-usage', async (req: Request, res: Response) => {
    try {
      const { ids } = req.body || {};
      if (Array.isArray(ids) && ids.length > 0) {
        const idSet = new Set(ids);
        const nowIso = new Date().toISOString();
        const updated: any[] = [];
        serverTrainingIdeas = serverTrainingIdeas.map((idea: any) => {
          if (idea && idSet.has(idea.id)) {
            const next = {
              ...idea,
              usageCount: (idea.usageCount || 0) + 1,
              lastUsedAt: nowIso
            };
            updated.push(next);
            return next;
          }
          return idea;
        });
        if (updated.length > 0) {
          await saveTrainingIdeasBatchToDb(updated);
        }
      }
      return res.json({ success: true });
    } catch {
      return res.json({ success: true });
    }
  });

  // API Endpoint: Record submitted SOAR card via server circuit-breaker
  app.post('/api/soar-cards/record', async (req: Request, res: Response) => {
    try {
      const data = req.body || {};
      if (data.observation) {
        await recordCardToDb(data);
        const cleanObs = String(data.observation).trim();
        if (cleanObs && !serverPromptBlacklist.includes(cleanObs)) {
          serverPromptBlacklist.unshift(cleanObs);
        }
        serverSoarCardsCount++;
      }
      return res.json({ success: true });
    } catch {
      return res.json({ success: true });
    }
  });

  // API Endpoint: Fetch recorded SOAR cards
  app.get('/api/soar-cards', async (req: Request, res: Response) => {
    try {
      const max = Number(req.query.limit) || 500;
      const cards = await getRecordedCardsFromDb(max);
      return res.json({ success: true, cards, count: cards.length });
    } catch {
      return res.json({ success: true, cards: [], count: 0 });
    }
  });

  // API Endpoint: Get persistent prompt history blacklist
  app.get('/api/blacklist', async (req: Request, res: Response) => {
    try {
      const dbBlacklist = await getPromptBlacklistFromDb();
      if (Array.isArray(dbBlacklist) && dbBlacklist.length > serverPromptBlacklist.length) {
        serverPromptBlacklist = dbBlacklist;
      }
      if (serverPromptBlacklist.length < 100) {
        const reconciled = await reconcilePromptBlacklistWithSoarCardsDb(serverPromptBlacklist);
        serverPromptBlacklist = reconciled.blacklist;
        serverSoarCardsCount = Math.max(serverSoarCardsCount, reconciled.soarCardsCount);
      }
    } catch {}
    return res.json({
      success: true,
      blacklist: serverPromptBlacklist,
      count: serverPromptBlacklist.length,
      soarCardsCount: Math.max(serverSoarCardsCount, serverPromptBlacklist.length)
    });
  });

  // API Endpoint: Reconcile blacklist with all recorded soarCards in Firestore
  app.post('/api/blacklist/reconcile', async (req: Request, res: Response) => {
    try {
      const reconciled = await reconcilePromptBlacklistWithSoarCardsDb(serverPromptBlacklist);
      serverPromptBlacklist = reconciled.blacklist;
      serverSoarCardsCount = Math.max(serverSoarCardsCount, reconciled.soarCardsCount);
      return res.json({
        success: true,
        blacklist: serverPromptBlacklist,
        count: serverPromptBlacklist.length,
        soarCardsCount: serverSoarCardsCount
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Endpoint: Save / update prompt history blacklist
  app.post('/api/blacklist', async (req: Request, res: Response) => {
    try {
      const { blacklist, append } = req.body || {};
      if (Array.isArray(blacklist)) {
        const incoming = blacklist.map((s: any) => String(s).trim()).filter(Boolean);
        if (append) {
          serverPromptBlacklist = Array.from(new Set([...incoming, ...serverPromptBlacklist])).slice(0, 10000);
        } else {
          serverPromptBlacklist = Array.from(new Set(incoming)).slice(0, 10000);
        }
        await savePromptBlacklistToDb(serverPromptBlacklist);
      }
      return res.json({
        success: true,
        count: serverPromptBlacklist.length,
        blacklist: serverPromptBlacklist
      });
    } catch (err: any) {
      console.warn('Failed to save blacklist to Firestore:', err);
      return res.json({ success: true, count: serverPromptBlacklist.length });
    }
  });

  // API Endpoint: Clear prompt history blacklist
  app.delete('/api/blacklist', async (req: Request, res: Response) => {
    try {
      serverPromptBlacklist = [];
      await savePromptBlacklistToDb([]);
      return res.json({ success: true, count: 0 });
    } catch (err: any) {
      console.warn('Failed to clear blacklist in Firestore:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Endpoint: Elevate and convert raw sheet rows from other rigs into high-standard SOAR training ideas
  app.post('/api/improve-and-import-training-ideas', async (req: Request, res: Response) => {
    try {
      const { items } = req.body || {};
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, error: 'No raw card items provided' });
      }

      const improvedIdeas = await improveAndConvertRawCardsToTrainingIdeas(items);
      return res.json({
        success: true,
        ideas: improvedIdeas,
        count: improvedIdeas.length
      });
    } catch (err: any) {
      console.error('Error improving training ideas from sheet:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Endpoint: One-Click AI Re-Polish for a single existing Training Idea
  app.post('/api/repolish-training-idea', async (req: Request, res: Response) => {
    try {
      const { idea } = req.body || {};
      if (!idea || (!idea.observation && !idea.topic)) {
        return res.status(400).json({ success: false, error: 'Idea object with observation or topic is required' });
      }

      const polished = await repolishSingleTrainingIdeaWithAI(idea);
      const updatedIdea = {
        ...idea,
        topic: polished.topic,
        zone: polished.zone,
        role: polished.role,
        assessment: polished.assessment,
        obsType: polished.obsType,
        observation: polished.observation,
        action: polished.action,
        keywords: polished.keywords
      };

      if (updatedIdea.id) {
        serverTrainingIdeas = serverTrainingIdeas.map((item: any) =>
          item.id === updatedIdea.id ? updatedIdea : item
        );
        await saveTrainingIdeasBatchToDb([updatedIdea]);
      }

      return res.json({
        success: true,
        idea: updatedIdea
      });
    } catch (err: any) {
      console.error('Error re-polishing training idea:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Endpoint: AI Remake a Single Card on PDF / Operations or Mass Submitter Page
  app.post('/api/operations/ai-remake-card', async (req: Request, res: Response) => {
    try {
      const {
        currentCard = {},
        operationsText = '',
        existingObservations = [],
        preferredAssessment,
        preferredObsType,
        remakeMode = 'operations_ai',
        customInstruction = ''
      } = req.body || {};

      const activeIdeas = serverTrainingIdeas.filter((i: any) => i && i.isActive !== false);
      const combinedAvoid = [
        ...(Array.isArray(existingObservations) ? existingObservations : []),
        ...serverPromptBlacklist.slice(0, 25)
      ];

      const remade = await remakeOperationCardWithAI({
        currentCard,
        operationsText,
        existingObservations: combinedAvoid,
        preferredAssessment,
        preferredObsType,
        remakeMode,
        customInstruction,
        trainingIdeas: activeIdeas
      });

      return res.json({
        success: true,
        card: remade,
        modelUsed: getActiveGeminiModel()
      });
    } catch (err: any) {
      console.error('Error in /api/operations/ai-remake-card:', err);
      const status = String(err?.message || '').includes('503') ? 503 : 500;
      return res.status(status).json({ success: false, error: err.message });
    }
  });

  // API Endpoint: AI Synthesize Batch of Cards directly from Uploaded Operations Documents (PDF / Word / Excel)
  app.post('/api/operations/ai-generate-cards', async (req: Request, res: Response) => {
    try {
      const {
        operationsText = '',
        count = 20,
        reportDate,
        existingObservations = [],
        customInstruction = '',
        batchIndex = 0
      } = req.body || {};

      const combinedAvoid = [
        ...(Array.isArray(existingObservations) ? existingObservations : []),
        ...serverPromptBlacklist.slice(0, 20)
      ];

      const cards = await generateOperationsCardsBatchWithAI({
        operationsText,
        count: Number(count) || 20,
        reportDate,
        existingObservations: combinedAvoid,
        customInstruction,
        batchIndex: Number(batchIndex) || 0
      });

      return res.json({
        success: true,
        cards,
        modelUsed: getActiveGeminiModel()
      });
    } catch (err: any) {
      console.error('Error in /api/operations/ai-generate-cards:', err);
      const status = String(err?.message || '').includes('503') ? 503 : 500;
      return res.status(status).json({ success: false, error: err.message });
    }
  });

  // API Endpoint: Get Operations PDF -> SOAR Submission Book Log from Firestore
  app.get('/api/operations/submission-logs', async (_req: Request, res: Response) => {
    try {
      const logs = await getOperationsSubmissionLogsFromDb();
      const totalCardsSubmitted = logs.reduce((acc: number, l: any) => acc + (Number(l?.submittedCount) || 0), 0);
      return res.json({
        success: true,
        logs,
        totalCardsSubmitted,
        totalBatches: logs.length
      });
    } catch (err: any) {
      return res.json({ success: true, logs: [], totalCardsSubmitted: 0, totalBatches: 0 });
    }
  });

  // API Endpoint: Append a new Operations PDF -> SOAR Submission Book Log entry to Firestore
  app.post('/api/operations/submission-logs', async (req: Request, res: Response) => {
    try {
      const entry = req.body || {};
      const logs = await appendOperationsSubmissionLogEntryToDb(entry);
      const totalCardsSubmitted = logs.reduce((acc: number, l: any) => acc + (Number(l?.submittedCount) || 0), 0);
      return res.json({
        success: true,
        logs,
        totalCardsSubmitted,
        totalBatches: logs.length
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Endpoint: Delete a single Operations Submission Book Log entry by ID
  app.delete('/api/operations/submission-logs/:id', async (req: Request, res: Response) => {
    try {
      const logId = String(req.params.id || '');
      const logs = await deleteOperationsSubmissionLogEntryFromDb(logId);
      const totalCardsSubmitted = logs.reduce((acc: number, l: any) => acc + (Number(l?.submittedCount) || 0), 0);
      return res.json({
        success: true,
        logs,
        totalCardsSubmitted,
        totalBatches: logs.length
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Endpoint: Clear all Operations Submission Book Log entries
  app.delete('/api/operations/submission-logs', async (_req: Request, res: Response) => {
    try {
      await clearOperationsSubmissionLogsInDb();
      return res.json({
        success: true,
        logs: [],
        totalCardsSubmitted: 0,
        totalBatches: 0
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Health check endpoint for cloud hosting platforms (Cloud Run, Railway, Render, etc.)
  app.get('/api/health', (req: Request, res: Response) => {
    return res.json({
      status: 'healthy',
      rig: RIG_50_NAME,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // API Endpoint: Get persistent crew members from Firestore
  app.get('/api/crew', async (req: Request, res: Response) => {
    try {
      const dbCrew = await getCrewRosterFromDb(serverCrewData);
      if (dbCrew && Array.isArray(dbCrew.crew) && dbCrew.crew.length > 0) {
        serverCrewData = dbCrew;
      }
      return res.json(serverCrewData);
    } catch (err: any) {
      return res.json(serverCrewData);
    }
  });

  // API Endpoint: Save persistent crew members to Firestore
  app.post('/api/crew', async (req: Request, res: Response) => {
    try {
      const { crew, anonymousRatio } = req.body;
      if (!Array.isArray(crew)) {
        return res.status(400).json({ error: 'crew must be an array' });
      }

      const dataToSave = {
        crew,
        anonymousRatio: typeof anonymousRatio === 'number' ? anonymousRatio : 30,
        updatedAt: new Date().toISOString()
      };

      serverCrewData = dataToSave;
      await saveCrewRosterToDb(dataToSave);

      return res.json({ success: true, count: crew.length, updatedAt: dataToSave.updatedAt });
    } catch (err: any) {
      console.error('Error in crew endpoint:', err);
      return res.status(500).json({ error: 'Failed to save crew' });
    }
  });

  // API Endpoint: Get supervisor portal settings (PIN, lockdown, permissions) from Firestore
  app.get('/api/supervisor/settings', async (req: Request, res: Response) => {
    try {
      serverSettings = await getSupervisorSettingsFromDb(serverSettings);
      return res.json(serverSettings);
    } catch (err: any) {
      return res.json(serverSettings);
    }
  });

  // API Endpoint: Save supervisor settings (updates PIN, password, tab permissions) to Firestore
  app.post('/api/supervisor/settings', async (req: Request, res: Response) => {
    try {
      const { supervisorNumber, portalLockedDown, tabPermissions } = req.body;
      
      if (typeof supervisorNumber === 'string' && supervisorNumber.trim()) {
        serverSettings.supervisorNumber = supervisorNumber.trim();
      }
      if (typeof portalLockedDown === 'boolean') {
        serverSettings.portalLockedDown = portalLockedDown;
      }
      if (tabPermissions && typeof tabPermissions === 'object') {
        serverSettings.tabPermissions = { ...serverSettings.tabPermissions, ...tabPermissions };
      }
      serverSettings.updatedAt = new Date().toISOString();

      await saveSupervisorSettingsToDb(serverSettings);

      return res.json({ success: true, settings: serverSettings });
    } catch (err: any) {
      console.error('Error saving supervisor settings:', err);
      return res.status(500).json({ error: 'Failed to save settings' });
    }
  });

  // API Endpoint: Verify supervisor login PIN
  app.post('/api/supervisor/login', (req: Request, res: Response) => {
    try {
      const { input } = req.body;
      if (!input || typeof input !== 'string') {
        return res.status(400).json({ success: false, error: 'Password or PIN required' });
      }

      const cleanInput = input.trim().replace(/\s+/g, '');
      const cleanSaved = (serverSettings.supervisorNumber || '5050').trim().replace(/\s+/g, '');

      // STRICT VERIFICATION: ONLY the exact configured supervisor PIN or password is valid!
      const isMatch = cleanInput === cleanSaved;

      if (isMatch) {
        return res.json({ success: true, message: 'Authenticated successfully' });
      } else {
        return res.status(401).json({ success: false, error: 'Incorrect supervisor password or PIN' });
      }
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'Login verification failed' });
    }
  });

  // Bind port 3000 immediately so control-plane health checks never time out while Vite initializes
  function initServer() {
    if (process.env.VERCEL) return;

    const distPath = path.join(PROJECT_ROOT, 'dist');
    const hasDist = fs.existsSync(path.join(distPath, 'index.html'));
    const isBundled = __filename.includes('dist') || (!fs.existsSync(path.join(PROJECT_ROOT, 'src', 'main.tsx')));
    const isProduction = process.env.NODE_ENV === 'production' || process.argv.includes('--production') || isBundled;

    if (isProduction && hasDist) {
      console.log(`Serving production static build from: ${distPath}`);
      app.use(express.static(distPath));
      app.get('*', (req: Request, res: Response) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      let viteServer: any = null;
      const viteReadyPromise = (async () => {
        try {
          console.log(`Mounting Vite middleware in DEVELOPMENT mode...`);
          const { createServer: createViteServer } = await import('vite');
          viteServer = await createViteServer({
            server: { middlewareMode: true, hmr: false, ws: false, watch: null },
            appType: 'spa',
            root: PROJECT_ROOT
          });
          console.log(`Vite middleware ready.`);
        } catch (viteErr) {
          console.warn('Vite middleware could not be loaded, falling back to static dist if available:', viteErr);
        }
      })();

      app.use(async (req: Request, res: Response, next) => {
        if (req.path.startsWith('/api/')) return next();
        await viteReadyPromise;
        if (viteServer) {
          return viteServer.middlewares(req, res, async (err?: any) => {
            if (err) return next(err);
            const url = req.originalUrl;
            try {
              const indexPath = path.resolve(PROJECT_ROOT, 'index.html');
              if (fs.existsSync(indexPath)) {
                let template = fs.readFileSync(indexPath, 'utf-8');
                template = await viteServer.transformIndexHtml(url, template);
                return res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
              }
              next();
            } catch (e: any) {
              viteServer.ssrFixStacktrace(e);
              next(e);
            }
          });
        }
        if (fs.existsSync(path.join(distPath, 'index.html'))) {
          return express.static(distPath)(req, res, () => {
            res.sendFile(path.join(distPath, 'index.html'));
          });
        }
        next();
      });
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server listening on http://0.0.0.0:${PORT} [${isProduction && hasDist ? 'PRODUCTION-STATIC' : 'DEVELOPMENT-VITE'}]`);
      console.log(`  ➜  Local:   http://localhost:${PORT}/`);
    });
  }

  initServer();

  export default app;

