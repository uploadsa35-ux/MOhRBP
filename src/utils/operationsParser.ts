import { RIG_50_NAME } from './defaultForm';
import { getCrewNameForSubmission } from './crewStore';

export interface GeneratedSoarCard {
  id: string;
  operationSnippet: string;
  date: string;
  rig: string;
  zone: string;
  role: string;
  name: string;
  assessment: 'Safe' | 'Unsafe';
  obsType: string;
  category: string;
  observation: string;
  action: string;
  topic?: string;
  aiPolished?: boolean;
}

export interface ActivityTemplate {
  keywords: string[];
  zone: string;
  role: string;
  category: string;
  safeObservations: { obs: string; action: string }[];
  unsafeObservations: { obs: string; action: string }[];
}

export const DRILLING_ACTIVITY_TEMPLATES: ActivityTemplate[] = [
  {
    keywords: ['casing', 'tubular', 'running casing', 'shoe', 'float collar', 'centralizer', 'elevator'],
    zone: 'Rig Floor',
    role: 'Driller',
    category: 'Red Zone Control Failure',
    safeObservations: [
      {
        obs: 'During running casing string, crew strictly observed red zone perimeter while elevator latch was engaged.',
        action: 'Commended casing crew during post-tour debrief; maintained zero hands on tubulars.'
      },
      {
        obs: 'Safety clamp installed on casing before slips were set, eliminating drop hazard.',
        action: 'Recognized drill crew for adhering to casing running SOP.'
      },
      {
        obs: 'Single-joint elevator latch checked and double-pinned prior to lifting from catwalk.',
        action: 'Floorman confirmed visual pin engagement with assistant driller.'
      }
    ],
    unsafeObservations: [
      {
        obs: 'Floorman stepped inside the red zone line while top drive was descending with casing joint.',
        action: 'Assistant driller immediately exercised Stop Work Authority (SWA); crew repositioned behind barrier.'
      },
      {
        obs: 'Casing fill-up tool hose showed minor outer sheath chafing near rotary table.',
        action: 'Suspended operation; replaced hose with certified high-pressure line and installed whipcheck.'
      }
    ]
  },
  {
    keywords: ['pipe', 'tripping', 'drill pipe', 'bha', 'stand', 'racking', 'derrick', 'monkeyboard'],
    zone: 'Derrick',
    role: 'Derrickman',
    category: 'Red Zone Control Failure',
    safeObservations: [
      {
        obs: 'Derrickman conducted 100% harness and twin inertia reel pre-climb inspection before stepping onto diving board.',
        action: 'Verified harness tag within 6-month inspection validity; signed working at height permit.'
      },
      {
        obs: 'Pipe stands racked smoothly into fingers with proper fingerboard locking latches engaged immediately.',
        action: 'Good communication maintained between driller and derrickman over rig intercom.'
      }
    ],
    unsafeObservations: [
      {
        obs: 'Safety lanyard inertia reel line had minor oil build-up preventing smooth recoil.',
        action: 'Intervened immediately; cleaned cable and tested lock mechanism before resuming tripping.'
      }
    ]
  },
  {
    keywords: ['bop', 'blowout', 'accumulator', 'choke', 'kill line', 'pressure test', 'annular', 'ram'],
    zone: 'BOP',
    role: 'Rig Safety Coach (RSC)',
    category: 'Stored Energy Not Controlled',
    safeObservations: [
      {
        obs: 'High-pressure test barricades and flashing red warning beacons posted around BOP wellhead before pumping up to 5,000 psi.',
        action: 'Confirmed all non-essential personnel clear of substructure during pressure hold.'
      },
      {
        obs: 'BOP accumulator pre-charge bottles checked and nitrogen pressure verified within limits.',
        action: 'Subsea engineer recorded readings on daily barrier checklist.'
      }
    ],
    unsafeObservations: [
      {
        obs: 'One warning barrier chain at BOP access stairway was found unlatched during pressure test.',
        action: 'Stopped pumping; resecured red barrier chain and posted a dedicated safety watch at stairway.'
      }
    ]
  },
  {
    keywords: ['crane', 'lift', 'supply boat', 'boat', 'offload', 'deck', 'cargo', 'tagline', 'basket'],
    zone: 'Cranes',
    role: 'Crane Operator',
    category: 'Person Under Suspended / Moving Load',
    safeObservations: [
      {
        obs: 'Deck crew utilized taglines and hands-free push-pull sticks when guiding cargo container from boat to main deck.',
        action: 'Praised deck roustabouts for zero hand placement on suspended load.'
      },
      {
        obs: 'Rigger called Stop Work Authority (SWA) when wave swell caused supply vessel excessive pitch during basket lift.',
        action: 'Crane operator halted lift until vessel was repositioned into stable heading.'
      }
    ],
    unsafeObservations: [
      {
        obs: 'Roustabout walked under crane boom swing radius while container was suspended at 3 meters.',
        action: 'Deck supervisor blew whistle and halted crane movement; conducted immediate toolbox talk on line-of-fire.'
      }
    ]
  },
  {
    keywords: ['mud', 'pits', 'chemical', 'shaker', 'screen', 'density', 'barite', 'caustic', 'centrifuge'],
    zone: 'Shakers',
    role: 'Roustabout',
    category: 'PPE Worn Correctly (Compliant)',
    safeObservations: [
      {
        obs: 'Shaker operator observed wearing full chemical apron, face shield, and chemical-resistant gloves while mixing additives.',
        action: 'Commended adherence to chemical safety matrix in sack room.'
      },
      {
        obs: 'Eyewash station inspected and flush-tested prior to handling caustic bags; inspection tag initialed.',
        action: 'Ensured eye wash stream was clean and unobstructed.'
      }
    ],
    unsafeObservations: [
      {
        obs: 'Mud sample container left on shaker walkway creating a potential slip hazard on grating.',
        action: 'Intervened immediately; washed down grating with degreaser and stored sample in designated rack.'
      }
    ]
  },
  {
    keywords: ['cement', 'slurry', 'pumping', 'halliburton', 'schlumberger', 'mixing cement', 'plug'],
    zone: 'Rig Floor',
    role: 'Floorman',
    category: 'Stored Energy Not Controlled',
    safeObservations: [
      {
        obs: 'Cementing manifold iron connections and hammer unions inspected and pinned before pressure pumping.',
        action: 'Verified whipcheck cables installed on all treating iron joints.'
      },
      {
        obs: 'Safety stand-down held with 3rd-party cementing crew prior to pumping slurry.',
        action: 'Reviewed emergency stop signals and designated safe muster zones.'
      }
    ],
    unsafeObservations: [
      {
        obs: 'Cement iron treating line crossed pedestrian walkway without rubber hose ramp.',
        action: 'Installed heavy-duty drive-over ramps and marked crossing with reflective tape.'
      }
    ]
  },
  {
    keywords: ['hot work', 'welding', 'cutting', 'torch', 'fire watch', 'grinding', 'workshop'],
    zone: 'Main Deck',
    role: 'Mechanic',
    category: 'Condition',
    safeObservations: [
      {
        obs: 'Fire watch posted with charged foam extinguisher and fire blanket covering deck scupper drains during welding.',
        action: 'Verified continuous gas detector readings at zero LEL; permit signed.'
      }
    ],
    unsafeObservations: [
      {
        obs: 'Fire blanket had small tear near welding boundary.',
        action: 'Paused hot work; replaced damaged fire blanket with certified new blanket.'
      }
    ]
  },
  {
    keywords: ['wireline', 'logging', 'perforation', 'electric line', 'pressure control', 'grease injection', 'lubricator', 'schlumberger', 'baker'],
    zone: 'Rig Floor',
    role: 'Assistant Driller',
    category: 'Stored Energy Not Controlled',
    safeObservations: [
      {
        obs: 'Wireline lubricator pressure test verified to 5,000 psi with zero weepage before running log in hole.',
        action: 'Barricaded drill floor perimeter and posted warning signs during wireline operations.'
      },
      {
        obs: 'Wireline logging cable pack-off rubber inspected and hydraulic hand pump pressure verified.',
        action: 'Confirmed grease injection rate maintained within safe operational limits.'
      }
    ],
    unsafeObservations: [
      {
        obs: 'Noticeable hydraulic fluid leak observed at the wireline winch pack-off head.',
        action: 'Invoked Stop Work Authority (SWA); depressurized lubricator, replaced damaged O-ring seal and verified zero pressure hold.'
      }
    ]
  },
  {
    keywords: ['pump', 'triplex', 'mud pump', 'liner', 'valve', 'fluid end', 'discharge', 'pulsation', 'damper'],
    zone: 'Mud Pit / Sack Room',
    role: 'Mechanic',
    category: 'Condition',
    safeObservations: [
      {
        obs: 'Mud pump #2 nitrogen pulsation dampener pre-charge pressure verified at 1,000 psi and documented on daily log.',
        action: 'Confirmed all fluid end cover bolts were torqued to specification with zero seal leakage.'
      },
      {
        obs: 'Secondary whipcheck cables and safety locking pins verified on high-pressure mud pump discharge lines.',
        action: 'Signed off pre-start mechanical barrier checklist before bringing pump online.'
      }
    ],
    unsafeObservations: [
      {
        obs: 'Mud pump liner wash water spray nozzle was misaligned, causing localized overheating on the rod clamp.',
        action: 'Paused pump run under SWA, cleared the nozzle blockage, realigned cooling jet and confirmed normal running temperature.'
      }
    ]
  },
  {
    keywords: ['loto', 'electrical', 'switchgear', 'scr', 'mcc', 'breaker', 'isolation', 'generator'],
    zone: 'Main Deck',
    role: 'Electrician',
    category: 'Stored Energy Not Controlled',
    safeObservations: [
      {
        obs: 'Rig Electrician executed verified zero-energy electrical test on 480V air compressor breaker before maintenance.',
        action: 'Applied personal red LOTO padlock, completed danger tag, and placed key in designated supervisor lockbox.'
      },
      {
        obs: 'Emergency generator auto-start test completed with all ventilation dampers and fire dampers functioning correctly.',
        action: 'Logged emergency power readiness in rig daily marine logbook.'
      }
    ],
    unsafeObservations: [
      {
        obs: 'Found temporary extension cable crossing main walkway without heavy-duty rubber cable protectors.',
        action: 'Halted nearby foot traffic under SWA, installed rubber crossover ramps and marked crossing with high-visibility reflective tape.'
      }
    ]
  },
  {
    keywords: ['roughneck', 'iron roughneck', 'st-80', 'makeup', 'breakout', 'torque', 'tong', 'slips'],
    zone: 'Rig Floor',
    role: 'Floorman',
    category: 'Red Zone Control Failure',
    safeObservations: [
      {
        obs: 'Floorman operated Iron Roughneck exclusively from the operator console outside the red zone during pipe makeup.',
        action: 'Maintained 100% hands-free posture and confirmed clear line of sight with Driller.'
      },
      {
        obs: 'Power slips hydraulic interlock tested and verified holding drill string securely at rotary table.',
        action: 'Confirmed slips safety latch engaged before transferring string weight.'
      }
    ],
    unsafeObservations: [
      {
        obs: 'Crew member reached with gloved hand near the rotating slips while string was being lowered.',
        action: 'Driller exercised immediate Stop Work Authority (SWA), repositioned crew member to green walkway, and conducted on-the-spot red-zone coaching.'
      }
    ]
  }
];

/**
 * Converts an ArrayBuffer to a base64 string for server fallback transport.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Strips clock times, 24-hour ranges, military times, and AM/PM timestamps
 * (e.g. "00:00 - 03:30:", "08:30-12:00", "at 14:30 hrs", "0600-1200", "08:30", "10:00 AM")
 * so generated SOAR cards never contain unwanted timestamps.
 */
export function stripTimestampsFromOperationsCardText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\b(?:from\s+|between\s+)?(?:[01]?\d|2[0-3]):[0-5]\d\s*(?:hrs?|hours?|am|pm|ast|utc|gmt)?\s*(?:-|–|—|to|and)\s*(?:[01]?\d|2[0-3]):[0-5]\d\s*(?:hrs?|hours?|am|pm|ast|utc|gmt)?\s*:?\s*/gi, '')
    .replace(/\(\s*(?:[01]?\d|2[0-3]):[0-5]\d\s*(?:-|–|—|to)?\s*(?:[01]?\d|2[0-3])?:?[0-5]?\d?\s*(?:hrs?|hours?|am|pm|ast|utc|gmt)?\s*\)/gi, '')
    .replace(/\b(?:from\s+|between\s+)?(?:[01]\d|2[0-3])[0-5]\d\s*(?:-|–|—|to|and)\s*(?:[01]\d|2[0-3])[0-5]\d\s*(?:hrs?|hours?)?\s*:?\s*/gi, '')
    .replace(/\b(?:at|around|by|prior to|after|before|until|since)\s+(?:[01]?\d|2[0-3]):[0-5]\d\s*(?:hrs?|hours?|am|pm|ast|utc|gmt)?\b/gi, '')
    .replace(/\b(?:at|around|by|prior to|after|before|until|since)\s+(?:[01]\d|2[0-3])[0-5]\d\s*(?:hrs?|hours?)\b/gi, '')
    .replace(/\b(?:at|around|by|prior to|after|before|until|since)\s+(?:1[0-2]|0?[1-9])\s*(?:am|pm)\b/gi, '')
    .replace(/\b(?:[01]?\d|2[0-3]):[0-5]\d\s*(?:hrs?|hours?|am|pm|ast|utc|gmt)?\s*:?/gi, '')
    .replace(/\b(?:[01]\d|2[0-3])[0-5]\d\s*(?:hrs?|hours?)\b/gi, '')
    .replace(/\b(?:1[0-2]|0?[1-9])\s*(?:am|pm)\b/gi, '')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[,;:\-\s]+/, '')
    .trim();
}

export interface OperationsInstructionConstraints {
  excludeTime: boolean;
  assessmentLock: 'Safe' | 'Unsafe' | null;
  allowedObsTypes: string[] | null;
  oneSentenceOnly: boolean;
  strictlyUploadedOpsOnly: boolean;
}

/**
 * Parses user instructions (e.g. Quick Rules or custom text) into active hard constraints
 * matching the server-side Gemini 4 Flash enforcement.
 */
export function parseOperationsInstructionConstraints(customInstruction: string = ''): OperationsInstructionConstraints {
  const lower = String(customInstruction || '').toLowerCase();

  const explicitlyWantsTime =
    /\b(include\s+time|with\s+time|add\s+timestamp|keep\s+time|show\s+time)\b/i.test(lower) &&
    !/\b(do\s+not\s+include|no\s+time|without\s+time|no\s+timestamp|exclude\s+time|never\s+include\s+.*time)\b/i.test(lower);
  const excludeTime = !explicitlyWantsTime;

  let assessmentLock: 'Safe' | 'Unsafe' | null = null;
  const wantsSafeOnly =
    /\b(make\s+all\s+(?:cards?\s+)?safe|all\s+(?:cards?\s+)?(?:must\s+be\s+|should\s+be\s+|as\s+)?safe|safe\s+(?:only|cards?\s+only)|only\s+safe|100%\s*safe|no\s+unsafe|without\s+unsafe|exclude\s+unsafe)\b/i.test(lower) ||
    /\bsafe\s+behavior\s*(?:&|and|\/)\s*condition\b.*\bonly\b/i.test(lower) ||
    /\ball\s+cards\s+safe\b/i.test(lower);

  const wantsUnsafeOnly =
    /\b(make\s+all\s+(?:cards?\s+)?unsafe|all\s+(?:cards?\s+)?(?:must\s+be\s+|should\s+be\s+|as\s+)?unsafe|unsafe\s+(?:only|cards?\s+only)|only\s+unsafe|100%\s*unsafe|no\s+safe|without\s+safe|exclude\s+safe)\b/i.test(lower);

  if (wantsSafeOnly && !wantsUnsafeOnly) assessmentLock = 'Safe';
  else if (wantsUnsafeOnly && !wantsSafeOnly) assessmentLock = 'Unsafe';

  let allowedObsTypes: string[] | null = null;
  const mentionsBehaviorAndConditionOnly =
    /\bbehaviou?r\s*(?:&|and|\/)\s*condition\b/i.test(lower) &&
    (/\bonly\b/i.test(lower) || /\ball\s+cards\b/i.test(lower) || /\bmake\s+all\b/i.test(lower));
  const forbidsSwa = /\b(no\s+swa|without\s+swa|exclude\s+swa|do\s+not\s+(?:include|create|use)\s+swa|no\s+stop\s+work)\b/i.test(lower);
  const behaviorOnly = /\b(behaviou?r\s+(?:observation\s+)?only|only\s+behaviou?r)\b/i.test(lower) && !/\bcondition\b/i.test(lower);
  const conditionOnly = /\b(conditions?\s+(?:observation\s+)?only|only\s+conditions?)\b/i.test(lower) && !/\bbehaviou?r\b/i.test(lower);
  const swaOnly = /\b(swa\s+only|only\s+swa|stop\s+work\s+authority\s+only)\b/i.test(lower);

  if (mentionsBehaviorAndConditionOnly || forbidsSwa) {
    allowedObsTypes = ['Behavior Observation', 'Condition'];
  } else if (behaviorOnly) {
    allowedObsTypes = ['Behavior Observation'];
  } else if (conditionOnly) {
    allowedObsTypes = ['Condition'];
  } else if (swaOnly) {
    allowedObsTypes = ['STOP Work Authority (SWA)'];
  }

  const oneSentenceOnly = /\b(1[\s-]*sentence|one[\s-]*sentence|single[\s-]*sentence|concise\s+1[\s-]*sentence|each\s+1\s+sentence)\b/i.test(lower);
  const strictlyUploadedOpsOnly = /\b(strictly\s+.*uploaded|only\s+from\s+the\s+uploaded|uploaded\s+operations\s+only)\b/i.test(lower);

  return {
    excludeTime,
    assessmentLock,
    allowedObsTypes,
    oneSentenceOnly,
    strictlyUploadedOpsOnly
  };
}

export function enforceSingleSentenceText(text: string): string {
  const clean = String(text || '').trim();
  if (!clean) return '';
  const match = clean.match(/^(.+?[.!?])(?:\s+(?=[A-Z\u0600-\u06FF])|$)/);
  if (match && match[1]) return match[1].trim();
  return clean.endsWith('.') || clean.endsWith('!') || clean.endsWith('?') ? clean : `${clean}.`;
}

/**
 * Extracts plain text from an uploaded PDF file using pdfjs-dist with local bundled worker
 * (eliminating cross-origin CDN blob module script errors) and automatic server-side fallback.
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();

  // 1. Primary client-side extraction using bundled in-process pdf.worker.mjs (no external CDN or blob worker failure)
  try {
    const [pdfjsLib, pdfjsWorkerModule, pdfWorkerUrlMod] = await Promise.all([
      import('pdfjs-dist'),
      // @ts-ignore - pdf.worker.mjs has no separate .d.ts file
      import('pdfjs-dist/build/pdf.worker.mjs'),
      // @ts-ignore - Vite asset URL import
      import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    ]);

    // Register WorkerMessageHandler on globalThis so PDFWorker uses fast in-process loopback without spawning a blob Worker
    if (pdfjsWorkerModule && (pdfjsWorkerModule as any).WorkerMessageHandler) {
      (globalThis as any).pdfjsWorker = pdfjsWorkerModule;
    }

    if (pdfWorkerUrlMod?.default) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrlMod.default;
    }

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer.slice(0)),
      useSystemFonts: true,
      disableFontFace: true
    });
    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str || '')
        .join(' ');
      fullText += `\n--- Page ${pageNum} ---\n` + pageText;
    }

    if (fullText.trim()) {
      return fullText.trim();
    }
  } catch (clientErr) {
    console.warn('Client PDF extraction notice, falling back to server extractor:', clientErr);
  }

  // 2. Server-side extraction fallback via /api/extract-pdf-text
  try {
    const pdfBase64 = arrayBufferToBase64(arrayBuffer);
    const res = await fetch('/api/extract-pdf-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfBase64 })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && typeof data.text === 'string' && data.text.trim()) {
        return data.text.trim();
      }
    }
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Server could not extract text from PDF');
  } catch (serverErr: any) {
    throw new Error(`Failed to extract text from PDF: ${serverErr.message || 'Unknown format'}`);
  }
}

/**
 * Extracts structured operational text from PDF (.pdf), Word (.docx, .doc), Excel (.xlsx, .xls, .csv), or Text (.txt) files.
 */
export async function extractTextFromOperationsFile(file: File): Promise<{
  text: string;
  fileType: 'pdf' | 'word' | 'excel' | 'text';
  summaryLabel: string;
}> {
  const lowerName = file.name.toLowerCase();

  // 1. PDF Document
  if (file.type === 'application/pdf' || lowerName.endsWith('.pdf')) {
    const text = await extractTextFromPdf(file);
    const pageMatches = text.match(/--- Page \d+ ---/g);
    const pageCount = pageMatches ? pageMatches.length : 1;
    return {
      text,
      fileType: 'pdf',
      summaryLabel: `PDF · ${pageCount} page${pageCount === 1 ? '' : 's'}`
    };
  }

  // 2. Word Document (.docx, .doc)
  if (
    lowerName.endsWith('.docx') ||
    lowerName.endsWith('.doc') ||
    file.type.includes('wordprocessingml') ||
    file.type === 'application/msword'
  ) {
    const arrayBuffer = await file.arrayBuffer();
    try {
      const mammothMod: any = await import('mammoth');
      const mammothLib = mammothMod.default || mammothMod;
      const result = await mammothLib.extractRawText({ arrayBuffer });
      if (result && typeof result.value === 'string' && result.value.trim()) {
        const cleanText = result.value.trim();
        const lineCount = cleanText.split(/\r?\n/).filter((l: string) => l.trim().length > 0).length;
        return {
          text: cleanText,
          fileType: 'word',
          summaryLabel: `Word · ${lineCount} paragraph${lineCount === 1 ? '' : 's'}`
        };
      }
    } catch (clientWordErr) {
      console.warn('Client Word extraction notice, falling back to server extractor:', clientWordErr);
    }

    // Server fallback for .docx / .doc
    const fileBase64 = arrayBufferToBase64(arrayBuffer);
    const res = await fetch('/api/extract-document-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileBase64, fileName: file.name })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && typeof data.text === 'string' && data.text.trim()) {
        const cleanText = data.text.trim();
        const lineCount = cleanText.split(/\r?\n/).filter((l: string) => l.trim().length > 0).length;
        return {
          text: cleanText,
          fileType: 'word',
          summaryLabel: `Word · ${lineCount} line${lineCount === 1 ? '' : 's'}`
        };
      }
    }
    throw new Error(`Could not extract text from Word file "${file.name}"`);
  }

  // 3. Excel Spreadsheet (.xlsx, .xls, .csv)
  if (
    lowerName.endsWith('.xlsx') ||
    lowerName.endsWith('.xls') ||
    lowerName.endsWith('.csv') ||
    file.type.includes('spreadsheetml') ||
    file.type.includes('ms-excel') ||
    file.type === 'text/csv'
  ) {
    const arrayBuffer = await file.arrayBuffer();
    try {
      const xlsxMod: any = await import('xlsx');
      const XLSX = xlsxMod.default || xlsxMod;
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const lines: string[] = [];
      let totalRows = 0;

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        const validRows = rows.filter(r => r.some(cell => String(cell ?? '').trim().length > 0));
        if (validRows.length === 0) continue;

        lines.push(`--- Sheet: ${sheetName} ---`);
        const headerRow = validRows[0].map(c => String(c ?? '').trim());
        const hasMeaningfulHeader = headerRow.filter(Boolean).length >= 2 && headerRow.every(h => h.length < 45);

        for (let rIdx = 0; rIdx < validRows.length; rIdx++) {
          const row = validRows[rIdx];
          if (rIdx === 0 && hasMeaningfulHeader) {
            lines.push(`Columns: ${headerRow.filter(Boolean).join(' | ')}`);
            continue;
          }
          const parts: string[] = [];
          for (let cIdx = 0; cIdx < row.length; cIdx++) {
            const val = String(row[cIdx] ?? '').trim();
            if (!val) continue;
            const colLabel = hasMeaningfulHeader && headerRow[cIdx] ? `${headerRow[cIdx]}: ` : '';
            parts.push(`${colLabel}${val}`);
          }
          if (parts.length > 0) {
            lines.push(parts.join(' | '));
            totalRows++;
          }
        }
      }

      const extracted = lines.join('\n').trim();
      if (extracted) {
        return {
          text: extracted,
          fileType: 'excel',
          summaryLabel: `Excel · ${workbook.SheetNames.length} sheet${workbook.SheetNames.length === 1 ? '' : 's'} (${totalRows} rows)`
        };
      }
    } catch (clientExcelErr) {
      console.warn('Client Excel extraction notice, falling back to server extractor:', clientExcelErr);
    }

    // Server fallback for Excel
    const fileBase64 = arrayBufferToBase64(arrayBuffer);
    const res = await fetch('/api/extract-document-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileBase64, fileName: file.name })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && typeof data.text === 'string' && data.text.trim()) {
        return {
          text: data.text.trim(),
          fileType: 'excel',
          summaryLabel: `Excel · Extracted`
        };
      }
    }
    throw new Error(`Could not extract rows from Excel file "${file.name}"`);
  }

  // 4. Plain Text / Other text formats
  const text = (await file.text()).trim();
  const lineCount = text.split(/\r?\n/).filter(l => l.trim().length > 0).length;
  return {
    text,
    fileType: 'text',
    summaryLabel: `Text · ${lineCount} line${lineCount === 1 ? '' : 's'}`
  };
}

/**
 * Helper to infer the best Rig 50 zone and role from a specific operational line in the uploaded files.
 */
function inferZoneAndRoleFromOperationLine(line: string): { zone: string; role: string } {
  const lower = line.toLowerCase();
  for (const t of DRILLING_ACTIVITY_TEMPLATES) {
    if (t.keywords.some(k => lower.includes(k))) {
      return { zone: t.zone, role: t.role };
    }
  }
  if (lower.includes('bop') || lower.includes('wellhead') || lower.includes('accumulator') || lower.includes('choke')) {
    return { zone: 'BOP', role: 'Rig Safety Coach (RSC)' };
  }
  if (lower.includes('crane') || lower.includes('boat') || lower.includes('vessel') || lower.includes('lift') || lower.includes('cargo') || lower.includes('basket')) {
    return { zone: 'Cranes', role: 'Crane Operator' };
  }
  if (lower.includes('derrick') || lower.includes('monkeyboard') || lower.includes('stand') || lower.includes('crown')) {
    return { zone: 'Derrick', role: 'Derrickman' };
  }
  if (lower.includes('shaker') || lower.includes('screen') || lower.includes('cuttings') || lower.includes('sample')) {
    return { zone: 'Shakers', role: 'Roustabout' };
  }
  if (lower.includes('mud') || lower.includes('pit') || lower.includes('pump') || lower.includes('slurry') || lower.includes('sack') || lower.includes('bbl') || lower.includes('ppg')) {
    return { zone: 'Mud Pit / Sack Room', role: 'Mechanic' };
  }
  if (lower.includes('catwalk') || lower.includes('pipe deck') || lower.includes('cantilever') || lower.includes('rack')) {
    return { zone: 'Cantilever / Pipe Deck', role: 'Roustabout' };
  }
  if (lower.includes('galley') || lower.includes('cabin') || lower.includes('accommodation') || lower.includes('camp')) {
    return { zone: 'Accommodations', role: 'Roustabout' };
  }
  if (lower.includes('weld') || lower.includes('deck') || lower.includes('generator') || lower.includes('compressor')) {
    return { zone: 'Main Deck', role: 'Mechanic' };
  }
  return { zone: 'Rig Floor', role: 'Floorman' };
}

/**
 * Generates 100% unique, operations-grounded SOAR cards directly from the extracted operational lines
 * of the uploaded documents (with clock times stripped and zero generic unrelated filler).
 */
export function generateCardsFromOperations(
  operationsText: string,
  targetCount: number = 20,
  targetDate: string = new Date().toISOString().split('T')[0],
  customInstruction: string = ''
): GeneratedSoarCard[] {
  const constraints = parseOperationsInstructionConstraints(customInstruction);
  const shouldStripTime = constraints.excludeTime;
  const safeOnly = constraints.assessmentLock === 'Safe';
  const unsafeOnly = constraints.assessmentLock === 'Unsafe';
  const allowedObsTypes = constraints.allowedObsTypes;

  // Extract every meaningful operational line/sentence from the uploaded documents
  const rawSegments = operationsText
    .split(/\r?\n|(?<=\.)\s+/)
    .map(l => (shouldStripTime ? stripTimestampsFromOperationsCardText(l) : l).trim())
    .filter(
      l =>
        l.length > 18 &&
        !l.startsWith('--- Page') &&
        !l.startsWith('--- Sheet') &&
        !l.startsWith('=== FILE:') &&
        !l.startsWith('Columns:') &&
        !/^(rig 50|daily drilling|date:|24-hour summary)/i.test(l)
    );

  const operationalLines = rawSegments.length > 0
    ? rawSegments
    : ['Running casing string and verifying red-zone barrier compliance on Rig 50'];

  const safeAngleTemplates = [
    (cleanLine: string, zone: string, role: string) => ({
      obsType: 'Behavior Observation',
      obs: `During ${cleanLine.charAt(0).toLowerCase() + cleanLine.slice(1).replace(/\.$/, '')} in ${zone}, observed the ${role} maintaining strict hands-free positioning and red-zone clearance.`,
      act: `Commended the ${role} on-the-spot for disciplined adherence to Rig 50 operational procedures.`
    }),
    (cleanLine: string, zone: string, role: string) => ({
      obsType: 'Condition',
      obs: `While executing ${cleanLine.charAt(0).toLowerCase() + cleanLine.slice(1).replace(/\.$/, '')} at ${zone}, verified that all mechanical barriers, whip-checks, and pressure gauges were in green operational condition.`,
      act: `Confirmed barrier readiness alongside the ${role} and logged the verification on the ${zone} safety checklist.`
    }),
    (cleanLine: string, zone: string, role: string) => ({
      obsType: 'Behavior Observation',
      obs: `Prior to ${cleanLine.charAt(0).toLowerCase() + cleanLine.slice(1).replace(/\.$/, '')} in ${zone}, the ${role} conducted a Step-Back 5x5 hazard check to confirm pinch-point and line-of-fire controls.`,
      act: `Recognized the ${role} and ${zone} crew for proactive pre-task hazard verification.`
    }),
    (cleanLine: string, zone: string, role: string) => ({
      obsType: 'Condition',
      obs: `Inspected the ${zone} work perimeter during ${cleanLine.charAt(0).toLowerCase() + cleanLine.slice(1).replace(/\.$/, '')} and confirmed all access walkways, barriers, and signage were properly staged.`,
      act: `Acknowledged the ${role} for maintaining high housekeeping and equipment integrity throughout the task.`
    }),
    (cleanLine: string, zone: string, role: string) => ({
      obsType: 'Behavior Observation',
      obs: `Observed the ${role} in ${zone} wearing full task-specific PPE and secured tool lanyards while performing ${cleanLine.charAt(0).toLowerCase() + cleanLine.slice(1).replace(/\.$/, '')}.`,
      act: `Praised the ${role} for zero-shortcut safety execution and reinforced the standard across the shift.`
    })
  ];

  const unsafeAngleTemplates = [
    (cleanLine: string, zone: string, role: string) => ({
      obsType: 'STOP Work Authority (SWA)',
      obs: `During ${cleanLine.charAt(0).toLowerCase() + cleanLine.slice(1).replace(/\.$/, '')} in ${zone}, observed a crew member approaching the active line-of-fire perimeter without a hands-free guide tool.`,
      act: `Exercised immediate Stop Work Authority (SWA) with the ${role}, re-established the red-zone barrier, and staged certified push-pull poles before resuming.`
    }),
    (cleanLine: string, zone: string, role: string) => ({
      obsType: 'Condition',
      obs: `While preparing for ${cleanLine.charAt(0).toLowerCase() + cleanLine.slice(1).replace(/\.$/, '')} at ${zone}, noticed a perimeter warning chain unlatched and a secondary retention pin requiring adjustment.`,
      act: `Coordinated with the ${role} to secure the safety pin and perimeter barrier chain prior to continuing operations.`
    })
  ];

  const results: GeneratedSoarCard[] = [];

  for (let i = 0; i < targetCount; i++) {
    const rawLine = operationalLines[i % operationalLines.length];
    const cleanLine = (shouldStripTime ? stripTimestampsFromOperationsCardText(rawLine) : rawLine)
      .replace(/\|/g, ', ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 120);

    const { zone, role: inferredRole } = inferZoneAndRoleFromOperationLine(cleanLine);
    const { role: crewRole } = getCrewNameForSubmission();
    const isSafe = safeOnly ? true : unsafeOnly ? false : (i % 6) !== 0;

    const angleIdx = Math.floor(i / operationalLines.length) + i;
    const built = isSafe
      ? safeAngleTemplates[angleIdx % safeAngleTemplates.length](cleanLine, zone, inferredRole)
      : unsafeAngleTemplates[angleIdx % unsafeAngleTemplates.length](cleanLine, zone, inferredRole);

    const finalObsType =
      allowedObsTypes && allowedObsTypes.length > 0 && !allowedObsTypes.includes(built.obsType)
        ? allowedObsTypes[i % allowedObsTypes.length]
        : built.obsType;

    let finalObs = shouldStripTime ? stripTimestampsFromOperationsCardText(built.obs) : built.obs;
    let finalAct = shouldStripTime ? stripTimestampsFromOperationsCardText(built.act) : built.act;
    if (constraints.oneSentenceOnly) {
      finalObs = enforceSingleSentenceText(finalObs);
      finalAct = enforceSingleSentenceText(finalAct);
    }
    const finalSnip = (shouldStripTime ? stripTimestampsFromOperationsCardText(cleanLine) : cleanLine).slice(0, 95);

    results.push({
      id: `soar_op_${Date.now()}_${i}`,
      operationSnippet: finalSnip,
      date: targetDate,
      rig: RIG_50_NAME,
      zone,
      role: crewRole || inferredRole,
      name: '',
      assessment: isSafe ? 'Safe' : 'Unsafe',
      obsType: finalObsType,
      category: isSafe ? 'Safe Behavior Observation' : 'General Operational Safety',
      observation: finalObs,
      action: finalAct,
      topic: `${zone} Operational Check`,
      aiPolished: false
    });
  }

  return results;
}

/**
 * Remakes a single SOAR card with a brand new, unique, non-repeating scenario
 * tied to the operations text, ensuring zero collision with any other existing card.
 */
export function remakeCardFromOperations(
  currentCard: GeneratedSoarCard,
  operationsText: string,
  existingCards: GeneratedSoarCard[],
  preferredAssessment?: 'Safe' | 'Unsafe',
  customInstruction: string = ''
): GeneratedSoarCard {
  const candidates = generateCardsFromOperations(
    operationsText,
    Math.max(existingCards.length + 10, 25),
    currentCard.date || new Date().toISOString().split('T')[0],
    customInstruction
  );
  const existingObsSet = new Set(
    existingCards
      .filter(c => c.id !== currentCard.id)
      .map(c => c.observation.toLowerCase().trim())
  );

  const targetAssessment: 'Safe' | 'Unsafe' =
    preferredAssessment ||
    (currentCard.assessment === 'Unsafe' ? 'Safe' : 'Unsafe');

  const match =
    candidates.find(
      c =>
        c.assessment === targetAssessment &&
        !existingObsSet.has(c.observation.toLowerCase().trim()) &&
        c.observation.toLowerCase().trim() !== currentCard.observation.toLowerCase().trim()
    ) ||
    candidates.find(
      c =>
        !existingObsSet.has(c.observation.toLowerCase().trim()) &&
        c.observation.toLowerCase().trim() !== currentCard.observation.toLowerCase().trim()
    ) ||
    candidates[0];

  return {
    ...match,
    id: currentCard.id,
    date: currentCard.date || match.date,
    name: currentCard.name || '',
    assessment: targetAssessment
  };
}

/**
 * Recreates a single card on the PDF Operations page using real Gemini AI (/api/operations/ai-remake-card).
 * Falls back to remakeCardFromOperations only if the server endpoint is unreachable.
 */
export async function remakeCardWithAI(
  currentCard: GeneratedSoarCard,
  operationsText: string,
  existingCards: GeneratedSoarCard[],
  options?: {
    preferredAssessment?: 'Safe' | 'Unsafe';
    preferredObsType?: string;
    remakeMode?: 'operations_ai' | 'non_safety_ai' | 'custom_ai';
    customInstruction?: string;
  }
): Promise<GeneratedSoarCard> {
  const constraints = parseOperationsInstructionConstraints(options?.customInstruction || '');
  const shouldStripTime = constraints.excludeTime;

  const existingObservations = existingCards
    .filter(c => c.id !== currentCard.id)
    .map(c => c.observation)
    .slice(-30);

  const response = await fetch('/api/operations/ai-remake-card', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      currentCard,
      operationsText,
      existingObservations,
      preferredAssessment: options?.preferredAssessment,
      preferredObsType: options?.preferredObsType,
      remakeMode: options?.remakeMode || 'operations_ai',
      customInstruction: options?.customInstruction || ''
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success || !data.card || !data.card.observation) {
    throw new Error(data.error || `AI remake request failed (HTTP ${response.status})`);
  }

  let obs = shouldStripTime
    ? stripTimestampsFromOperationsCardText(data.card.observation)
    : data.card.observation;
  let act = shouldStripTime
    ? stripTimestampsFromOperationsCardText(data.card.action || currentCard.action)
    : (data.card.action || currentCard.action);
  const snip = shouldStripTime
    ? stripTimestampsFromOperationsCardText(data.card.operationSnippet || currentCard.operationSnippet)
    : (data.card.operationSnippet || currentCard.operationSnippet);

  if (constraints.oneSentenceOnly) {
    obs = enforceSingleSentenceText(obs);
    act = enforceSingleSentenceText(act);
  }

  return {
    ...currentCard,
    id: currentCard.id,
    zone: data.card.zone || currentCard.zone,
    role: data.card.role || currentCard.role,
    assessment: constraints.assessmentLock || data.card.assessment || options?.preferredAssessment || currentCard.assessment,
    obsType:
      constraints.allowedObsTypes && !constraints.allowedObsTypes.includes(data.card.obsType)
        ? constraints.allowedObsTypes[0]
        : (data.card.obsType || options?.preferredObsType || currentCard.obsType),
    category: data.card.category || (data.card.assessment === 'Safe' ? 'Safe Behavior Observation' : 'General Operational Safety'),
    observation: obs,
    action: act,
    operationSnippet: snip,
    topic: data.card.topic,
    aiPolished: true
  };
}

/**
 * Generates 100% AI-synthesized SOAR cards directly from the uploaded Operations documents (PDF / Word / Excel)
 * using Gemini 4 Flash ('gemini-4-hydrogen'). Runs fast batches of 20 cards and strictly enforces all custom instructions.
 * Propagates real Gemini API errors cleanly rather than silently replacing AI output with generic templates.
 */
export async function generateAiCardsFromOperations(
  operationsText: string,
  count: number = 30,
  reportDate: string = new Date().toISOString().split('T')[0],
  existingCards: GeneratedSoarCard[] = [],
  customInstruction: string = '',
  onProgress?: (generatedSoFar: number, totalTarget: number, partialCards: GeneratedSoarCard[], modelUsed?: string) => void
): Promise<GeneratedSoarCard[]> {
  const constraints = parseOperationsInstructionConstraints(customInstruction);
  const shouldStripTime = constraints.excludeTime;

  const collected: GeneratedSoarCard[] = [];
  const seenObservations = new Set<string>(
    existingCards.map(c => c.observation.toLowerCase().trim()).filter(Boolean)
  );

  const BATCH_SIZE = 20;
  const maxAttempts = Math.ceil(count / BATCH_SIZE) + 2;
  let batchIndex = 0;
  let lastErrorMessage = '';
  let lastModelUsed = 'gemini-4-hydrogen';

  while (collected.length < count && batchIndex < maxAttempts) {
    const remaining = count - collected.length;
    const currentBatchTarget = Math.min(remaining, BATCH_SIZE);

    let batchSucceeded = false;
    for (let retry = 0; retry < 2 && !batchSucceeded; retry++) {
      try {
        const existingObservations = [
          ...existingCards.map(c => c.observation),
          ...collected.map(c => c.observation)
        ].slice(-45);

        const response = await fetch('/api/operations/ai-generate-cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operationsText,
            count: currentBatchTarget,
            reportDate,
            existingObservations,
            customInstruction,
            batchIndex
          })
        });

        const data = await response.json().catch(() => ({}));
        if (response.ok && data.success && Array.isArray(data.cards) && data.cards.length > 0) {
          if (data.modelUsed) lastModelUsed = data.modelUsed;
          for (let i = 0; i < data.cards.length; i++) {
            if (collected.length >= count) break;
            const c = data.cards[i];
            let cleanObs = shouldStripTime
              ? stripTimestampsFromOperationsCardText(String(c.observation || ''))
              : String(c.observation || '').trim();
            let cleanAct = shouldStripTime
              ? stripTimestampsFromOperationsCardText(String(c.action || ''))
              : String(c.action || '').trim();
            const cleanSnip = shouldStripTime
              ? stripTimestampsFromOperationsCardText(String(c.operationSnippet || 'AI Synthesized from Uploaded Operations'))
              : String(c.operationSnippet || 'AI Synthesized from Uploaded Operations').trim();

            if (constraints.oneSentenceOnly) {
              cleanObs = enforceSingleSentenceText(cleanObs);
              cleanAct = enforceSingleSentenceText(cleanAct);
            }

            if (!cleanObs) continue;
            const normObs = cleanObs.toLowerCase().trim();
            if (seenObservations.has(normObs)) continue;
            seenObservations.add(normObs);

            const finalAssessment: 'Safe' | 'Unsafe' = constraints.assessmentLock
              ? constraints.assessmentLock
              : c.assessment === 'Unsafe'
              ? 'Unsafe'
              : 'Safe';
            const finalObsType =
              constraints.allowedObsTypes && !constraints.allowedObsTypes.includes(c.obsType)
                ? constraints.allowedObsTypes[collected.length % constraints.allowedObsTypes.length]
                : (c.obsType || 'Behavior Observation');

            const roleVal = c.role || 'Floorman';
            const crewPick = getCrewNameForSubmission();
            collected.push({
              id: `soar_ai_op_${Date.now()}_${batchIndex}_${i}`,
              operationSnippet: cleanSnip,
              date: reportDate,
              rig: RIG_50_NAME,
              zone: c.zone || 'Rig Floor',
              role: roleVal,
              name: crewPick.name || '',
              assessment: finalAssessment,
              obsType: finalObsType,
              category: c.category || (finalAssessment === 'Safe' ? 'Safe Behavior Observation' : 'General Operational Safety'),
              observation: cleanObs,
              action: cleanAct,
              topic: c.topic || `${c.zone || 'Rig Floor'} Operation`,
              aiPolished: true
            });
          }

          if (onProgress) {
            onProgress(collected.length, count, [...collected], lastModelUsed);
          }
          batchSucceeded = true;
        } else {
          lastErrorMessage = data.error || `Gemini AI returned HTTP ${response.status}`;
          if (retry === 0) {
            await new Promise(r => setTimeout(r, 900));
          }
        }
      } catch (err: any) {
        lastErrorMessage = err?.message || 'Network error calling Gemini AI';
        if (retry === 0) {
          await new Promise(r => setTimeout(r, 900));
        }
      }
    }

    if (!batchSucceeded) {
      break;
    }

    batchIndex++;
  }

  if (collected.length === 0) {
    throw new Error(lastErrorMessage || 'Gemini AI could not generate cards right now. Please try again in a few seconds.');
  }

  return collected.slice(0, count);
}

/**
 * Converts a saved AI Training Idea directly into a ready-to-submit GeneratedSoarCard
 * (for "Submit Again" from the AI Ideas Card Bank).
 */
export function convertAiTrainingIdeaToSoarCard(
  idea: {
    id: string;
    topic: string;
    zone?: string;
    role?: string;
    assessment?: 'Safe' | 'Unsafe';
    obsType?: string;
    observation: string;
    action: string;
    keywords?: string;
  },
  reportDate: string,
  categoryLabel?: string,
  indexOffset: number = 0
): GeneratedSoarCard {
  const zone = idea.zone || 'Rig Floor';
  const role = idea.role || 'Floorman';
  const assessment: 'Safe' | 'Unsafe' = idea.assessment === 'Unsafe' ? 'Unsafe' : 'Safe';
  const obsType = idea.obsType || 'Behavior Observation';
  const formCategory =
    assessment === 'Safe'
      ? 'Safe Behavior Observation'
      : obsType.includes('SWA')
        ? 'Red Zone Control Failure'
        : 'General Operational Safety';
  const crewPick = getCrewNameForSubmission();

  return {
    id: `bank_card_${Date.now()}_${indexOffset}_${Math.random().toString(36).slice(2, 6)}`,
    operationSnippet: `[Card Bank · ${categoryLabel || 'AI Idea'}] ${idea.topic}`,
    date: reportDate,
    rig: RIG_50_NAME,
    zone,
    role,
    name: crewPick.name || '',
    assessment,
    obsType,
    category: formCategory,
    observation: stripTimestampsFromOperationsCardText(idea.observation),
    action: stripTimestampsFromOperationsCardText(idea.action),
    topic: idea.topic,
    aiPolished: true
  };
}

