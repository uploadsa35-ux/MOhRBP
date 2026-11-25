import 'dotenv/config';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

export interface DraftCard {
  zone: string;
  zoneArabic?: string;
  role: string;
  roleArabic?: string;
  assessment: 'Safe' | 'Unsafe';
  assessmentArabic?: string;
  obsType: 'STOP Work Authority (SWA)' | 'Behavior Observation' | 'Condition' | 'Stop Work Authority Drill';
  obsTypeArabic?: string;
  name: string;
  observation: string;
  action: string;
  aiPolished: boolean;
  language: 'ar' | 'en';
}

export const VALID_ZONES = [
  'Rig Floor',
  'Cantilever / Pipe Deck',
  'Main Deck',
  'BOP',
  'Cranes',
  'Derrick',
  'Shakers',
  'Mud Pit / Sack Room',
  'Accommodations'
];

export const ZONE_ARABIC: Record<string, string> = {
  'Rig Floor': 'أرضية الحفر (Rig Floor)',
  'Cantilever / Pipe Deck': 'منطقة الأنابيب / الكانتليفر (Pipe Deck)',
  'Main Deck': 'السطح الرئيسي (Main Deck)',
  'BOP': 'مانع الانفجار (BOP)',
  'Cranes': 'الرافعات (Cranes)',
  'Derrick': 'برج الحفر (Derrick)',
  'Shakers': 'منطقة الهزازات (Shakers)',
  'Mud Pit / Sack Room': 'أحواض الطين ومستودع المواد (Mud Pits)',
  'Accommodations': 'سكن الطاقم والمكاتب (Accommodations)'
};

export const VALID_ROLES = [
  'Driller',
  'Assistant Driller',
  'Floorman',
  'Crane Operator',
  'HSE Specialist',
  'Rig Safety Coach (RSC)',
  'Derrickman',
  'Mechanic',
  'Electrician',
  'Roustabout'
];

export const ROLE_ARABIC: Record<string, string> = {
  'Driller': 'حفار (Driller)',
  'Assistant Driller': 'مساعد حفار (Assistant Driller)',
  'Floorman': 'عامل حفر (Floorman)',
  'Crane Operator': 'مشغل رافعة (Crane Operator)',
  'HSE Specialist': 'أخصائي سلامة (HSE Specialist)',
  'Rig Safety Coach (RSC)': 'مدرب سلامة (Rig Safety Coach)',
  'Derrickman': 'ديريكمان (Derrickman)',
  'Mechanic': 'ميكانيكي (Mechanic)',
  'Electrician': 'كهربائي (Electrician)',
  'Roustabout': 'عامل سطح (Roustabout)'
};

export const OBS_TYPE_ARABIC: Record<string, string> = {
  'STOP Work Authority (SWA)': 'سلطة إيقاف العمل (SWA)',
  'Behavior Observation': 'ملاحظة سلوكية (Behavior)',
  'Condition': 'حالة معدات / بيئة (Condition)',
  'Stop Work Authority Drill': 'تمرين إيقاف العمل (SWA Drill)'
};

export function isArabicText(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text) || /(?:arabic|عربي|بالعربي|باللغة العربية)/i.test(text);
}

/**
 * Heuristic fallback parser when AI is unavailable or offline
 */
export function heuristicDraft(
  text: string, 
  senderName?: string, 
  observedRoleContext?: string, 
  zoneContext?: string
): DraftCard {
  // Strip any accidental prompt artifacts
  let cleanObs = text
    .replace(/^The observer \([^)]+\) watched [^.]+\.\s*Note:\s*/i, '')
    .replace(/\s*Ensure the observation clearly describes [^.]+\./i, '')
    .replace(/^Note:\s*/i, '')
    .replace(/(?:by|name|from|بواسطة|المراقب|من)[\s:\-]+[a-zA-Z\u0600-\u06FF\s\-\'\.]+/i, '')
    .trim();

  if (!cleanObs) cleanObs = text.trim();
  const lower = cleanObs.toLowerCase();
  const isAr = isArabicText(cleanObs);

  const isCreateFromScratch = !cleanObs ||
    /^(make|create|generate|give|write|new|random)\s*(me\s*)?(a\s*)?(brand\s*new\s*)?(card|soar|report)?$/i.test(cleanObs) ||
    /^(سوي|اكتب|اعمل|انشئ|صمم|هات|كرت)\s*(لي\s*)?(كرت|تقرير|بطاقة|عشوائي)?$/i.test(cleanObs) ||
    lower.includes('make me a card') ||
    lower.includes('create a card') ||
    lower.includes('generate a card') ||
    cleanObs.includes('سوي لي كرت') ||
    cleanObs.includes('اكتب لي كرت');

  // If user requested to create a card from scratch or note is empty
  if (isCreateFromScratch) {
    const scenarios: Array<{
      zone: string;
      role: string;
      assessment: 'Safe' | 'Unsafe';
      obsType: 'STOP Work Authority (SWA)' | 'Behavior Observation' | 'Condition' | 'Stop Work Authority Drill';
      obsEn: string;
      actEn: string;
      obsAr: string;
      actAr: string;
    }> = [
      {
        zone: 'Rig Floor',
        role: 'Floorman',
        assessment: 'Safe',
        obsType: 'Behavior Observation',
        obsEn: 'During casing running operations on rig floor, Floorman was observed utilizing push-pull safety sticks to maneuver tubulars, keeping hands completely out of pinch points.',
        actEn: 'Commended Floorman on-the-spot for strict adherence to Hands-Free Policy; highlighted practice in shift debrief.',
        obsAr: 'أثناء إنزال أنابيب التبطين على أرضية الحفر، تمت ملاحظة عامل الحفر يستخدم عصي التوجيه بأمان لمناولة الأنابيب مع إبعاد يديه تماماً عن نقاط الانحصار.',
        actAr: 'تم تقديم الشكر والثناء لعامل الحفر لالتزامه التام بسياسة العمل بدون لمس ومشاركة الممارسة في اجتماع ما قبل الوردية.'
      },
      {
        zone: 'Cranes',
        role: 'Crane Operator',
        assessment: 'Safe',
        obsType: 'STOP Work Authority (SWA)',
        obsEn: 'Crane Operator exercised Stop Work Authority (SWA) when unexpected sea swell and wind gusts exceeded safe limits while lifting a cargo basket from the supply boat.',
        actEn: 'Safely returned load to vessel deck; operations paused until weather window stabilized. Commended for proactive safety initiative.',
        obsAr: 'قام مشغل الرافعة بتفعيل سلطة إيقاف العمل (SWA) عندما تجاوزت سرعة الرياح والأمواج الحدود الآمنة أثناء تفريغ حمولة من قارب الإمداد.',
        actAr: 'تمت إعادة الحمولة بأمان إلى سطح القارب وتعليق الرفع حتى استقرار الطقس، مع الإشادة بمشغل الرافعة لحرصه ووعيه الوقائي.'
      },
      {
        zone: 'Cantilever / Pipe Deck',
        role: 'Roustabout',
        assessment: 'Unsafe',
        obsType: 'STOP Work Authority (SWA)',
        obsEn: 'Observed Roustabout stepping inside designated pipe deck red zone while crane was maneuvering casing bundle overhead.',
        actEn: 'Exercised immediate SWA; guided crew member back to safe green walkway and re-briefed deck team on Line of Fire & Red Zone barriers.',
        obsAr: 'تمت ملاحظة عامل السطح يدخل ضمن المنطقة الحمراء للكانتليفر أثناء قيام الرافعة بمناولة حزمة أنابيب في مسار الرفع.',
        actAr: 'تم التدخل الفوري وتوجيه العامل إلى الممشى الآمن وإعادة شرح مخاطر خط النار والالتزام بالمناطق المحظورة.'
      },
      {
        zone: 'Shakers',
        role: 'Floorman',
        assessment: 'Safe',
        obsType: 'Behavior Observation',
        obsEn: 'Observed shaker hand wearing complete chemical goggles, face shield, and chemical-resistant gloves while taking drilling mud weight samples.',
        actEn: 'Acknowledged crew member on-the-spot for exemplary compliance with hazardous chemical PPE procedures.',
        obsAr: 'تمت ملاحظة عامل الحفر عند الهزازات يرتدي كامل نظارات الوقاية الكيميائية وواقي الوجه والقفازات الخاصة أثناء أخذ عينات كثافة الطين.',
        actAr: 'تم توجيه الثناء للعامل لالتزامه الدقيق بإجراءات السلامة في التعامل مع المواد الكيميائية.'
      },
      {
        zone: 'BOP',
        role: 'Assistant Driller',
        assessment: 'Safe',
        obsType: 'Condition',
        obsEn: 'Observed red safety chain barrier and warning signs properly locked across BOP access walkway during high-pressure accumulator test.',
        actEn: 'Verified physical barrier integrity and ensured area remained isolated until pressure bleed-off completed.',
        obsAr: 'تمت ملاحظة سلسلة الحماية الحمراء واللوحات التحذيرية مغلقة ومثبتة بإحكام عند مدخل مانع الانفجار أثناء اختبار الضغط العالي.',
        actAr: 'تم التأكد من استمرار عزل المنطقة حتى اكتمال تفريغ الضغط بالكامل وتوثيق ذلك في سجل السلامة.'
      },
      {
        zone: 'Main Deck',
        role: 'Roustabout',
        assessment: 'Unsafe',
        obsType: 'Condition',
        obsEn: 'Noticed heavy power welding cable crossing main transit pathway near mud pump room without heavy-duty rubber protection bridge.',
        actEn: 'Stopped transit; rerouted cable using overhead safety S-hooks and installed ramp bridge to eliminate tripping hazard.',
        obsAr: 'تمت ملاحظة كيبل كهربائي مؤقت يمر عبر الممشى الرئيسي بالقرب من غرفة مضخات الطين دون وجود جسر حماية مطاطي.',
        actAr: 'تم التدخل فوراً وتعليق الكيبل على حوامل السلامة وتركيب جسر الحماية المطاطي لإزالة خطر التعثر.'
      }
    ];

    const pick = scenarios[Math.floor(Math.random() * scenarios.length)];
    return {
      zone: pick.zone,
      zoneArabic: ZONE_ARABIC[pick.zone],
      role: pick.role,
      roleArabic: ROLE_ARABIC[pick.role],
      assessment: pick.assessment,
      assessmentArabic: pick.assessment === 'Safe' ? 'آمن (Safe)' : 'غير آمن (Unsafe)',
      obsType: pick.obsType,
      obsTypeArabic: OBS_TYPE_ARABIC[pick.obsType],
      name: senderName || '',
      observation: isAr ? pick.obsAr : pick.obsEn,
      action: isAr ? pick.actAr : pick.actEn,
      aiPolished: true,
      language: isAr ? 'ar' : 'en'
    };
  }

  // Common typo and phrase cleaner
  cleanObs = cleanObs
    .replace(/\bstoped\b/gi, 'stopped')
    .replace(/\bto to\b/gi, 'to')
    .replace(/\bin to\b/gi, 'into')
    .replace(/\bwihtout\b/gi, 'without')
    .replace(/\bfoloorman\b/gi, 'floorman')
    .replace(/\bdril\b/gi, 'drill')
    .replace(/\bredzone\b/gi, 'red zone')
    .replace(/\bcantiliver\b/gi, 'cantilever')
    .replace(/\bsafty\b/gi, 'safety')
    .replace(/\bprocdure\b/gi, 'procedure')
    .replace(/\binterven\b/gi, 'intervened')
    .replace(/\b(obsevred|observd)\b/gi, 'observed');

  // Update lowercase string after cleaning
  const lowerClean = cleanObs.toLowerCase();

  // 1. Assessment: Comprehensive hazard and unsafe condition detection
  let assessment: 'Safe' | 'Unsafe' = 'Safe';
  const hazardTerms = [
    'unsafe', 'hazard', 'danger', 'stop work', 'swa', 'defect', 'trip', 'tripping',
    'spill', 'leak', 'broken', 'missing', 'not wear', 'without ppe', 'no ppe',
    'red zone', 'pinch point', 'line of fire', 'stopped him', 'stopped', 'entering red zone',
    'inside red zone', 'into red zone', 'stepping inside', 'dropped', 'unsecured',
    'bypass', 'unauthorized', 'damaged', 'crack', 'loose', 'slip', 'fall', 'caught between',
    'غير آمن', 'خطر', 'تسرب', 'زيت', 'انزلاق', 'سقوط', 'كسر', 'ايقاف', 'إيقاف',
    'منطقة حمراء', 'بدون وقاية', 'نقطة انحصار', 'خط النار'
  ];

  const hasRedZone = lowerClean.includes('red zone') || cleanObs.includes('منطقة حمراء');
  const isSwa = lowerClean.includes('swa') || lowerClean.includes('stop work') || lowerClean.includes('stopped') || lowerClean.includes('stoped') || cleanObs.includes('إيقاف') || cleanObs.includes('ايقاف') || cleanObs.includes('سلطة إيقاف') || lowerClean.includes('halt') || lowerClean.includes('suspend') || hasRedZone;

  if (hazardTerms.some(term => lowerClean.includes(term) || cleanObs.includes(term)) || hasRedZone || isSwa) {
    assessment = 'Unsafe';
  }

  // 2. Zone
  let zone = zoneContext || 'Rig Floor';
  if (!zoneContext) {
    if (lowerClean.includes('pipe deck') || lowerClean.includes('cantilever') || cleanObs.includes('انابيب') || cleanObs.includes('أنابيب')) {
      zone = 'Cantilever / Pipe Deck';
    } else if (lowerClean.includes('main deck') || lowerClean.includes('walkway') || cleanObs.includes('السطح الرئيسي')) {
      zone = 'Main Deck';
    } else if (lowerClean.includes('bop') || cleanObs.includes('مانع الانفجار')) {
      zone = 'BOP';
    } else if (lowerClean.includes('crane') || cleanObs.includes('رافعة') || cleanObs.includes('كرين')) {
      zone = 'Cranes';
    } else if (lowerClean.includes('derrick') || lowerClean.includes('monkeyboard') || cleanObs.includes('ديريك')) {
      zone = 'Derrick';
    } else if (lowerClean.includes('shaker') || cleanObs.includes('هزاز')) {
      zone = 'Shakers';
    } else if (lowerClean.includes('mud pit') || lowerClean.includes('sack room') || cleanObs.includes('طين') || cleanObs.includes('حفرة')) {
      zone = 'Mud Pit / Sack Room';
    } else if (lowerClean.includes('accommodation') || cleanObs.includes('سكن')) {
      zone = 'Accommodations';
    }
  }

  // 3. Observed Role
  const observed = observedRoleContext || 'Floorman';
  let role = 'Floorman';
  if (lowerClean.includes('assistant driller') || cleanObs.includes('مساعد حفار')) role = 'Assistant Driller';
  else if (lowerClean.includes('driller') || cleanObs.includes('حفار')) role = 'Driller';
  else if (lowerClean.includes('crane operator') || cleanObs.includes('مشغل رافعة')) role = 'Crane Operator';
  else if (lowerClean.includes('safety') || cleanObs.includes('سلامة')) role = 'Rig Safety Coach (RSC)';
  else if (lowerClean.includes('roustabout') || cleanObs.includes('عامل سطح')) role = 'Roustabout';

  // 4. Name extraction
  let name = '';
  const nameMatch = text.match(/(?:by|name|from|بواسطة|المراقب|من)[\s:\-]+([a-zA-Z\u0600-\u06FF\s\-\'\.]+)/i);
  if (nameMatch && nameMatch[1]) {
    name = nameMatch[1].trim();
  } else if (senderName) {
    name = senderName;
  }

  // 5. Clean, professional third-person observation and action
  let observation = '';
  let action = '';

  const hasPpe = lowerClean.includes('ppe') || cleanObs.includes('وقاية') || cleanObs.includes('معدات');

  if (isAr) {
    if (hasRedZone) {
      observation = `أثناء العمليات في ${ZONE_ARABIC[zone] || zone}، تمت ملاحظة ${observed} يتواجد داخل المنطقة الحمراء المحظورة دون تصريح مسبق.`;
      action = `تم تفعيل سلطة إيقاف العمل (SWA) فوراً وتوجيه ${observed} إلى الممر الأخضر الآمن وإعادة التذكير بحدود المنطقة الحمراء ومخاطر خط النار.`;
    } else if (hasPpe) {
      if (assessment === 'Safe') {
        observation = `أثناء العمل في ${ZONE_ARABIC[zone] || zone}، تمت ملاحظة ${observed} يلتزم بارتداء جميع معدات الوقاية الشخصية المحددة للعملية بشكل كامل.`;
        action = `تم تقديم الشكر والثناء لـ ${observed} في الموقع لالتزامه بمعايير السلامة المهنية.`;
      } else {
        observation = `تمت ملاحظة ${observed} يعمل في ${ZONE_ARABIC[zone] || zone} دون استكمال معدات الوقاية الشخصية المطلوبة.`;
        action = `تم إيقاف العمل فوراً وتوفير معدات الوقاية المناسبة والتأكد من ارتدائها قبل استئناف النشاط.`;
      }
    } else {
      let strippedAr = cleanObs
        .replace(/^(?:أثناء\s+العمليات[\s،,]+)?(?:تمت\s+ملاحظة|لوحظ|رأيت)\s+(?:عامل\s+|الحفار\s+|مشغل\s+)?/i, '')
        .trim();
      if (!strippedAr) strippedAr = cleanObs;
      observation = `أثناء العمليات في ${ZONE_ARABIC[zone] || zone}: تمت ملاحظة ${observed} (${strippedAr}).`;
      action = assessment === 'Safe'
        ? `تم شكر وتقدير ${observed} على الممارسة الإيجابية والتأكيد على استمرارها في اجتماع السلامة.`
        : `تم التدخل الفوري وتصحيح الحالة غير الآمنة وتفعيل سلطة إيقاف العمل وإبلاغ المشرف لتأمين الموقع.`;
    }
  } else {
    if (hasRedZone) {
      observation = `While operations were underway in ${zone}, observed ${observed} entering designated red zone without authorization while tubulars and equipment were active.`;
      action = `Exercised immediate Stop Work Authority (SWA); stopped ${observed}, guided crew member out to safe green walkway, and conducted on-the-spot red zone safety coaching.`;
    } else if (hasPpe) {
      if (assessment === 'Safe') {
        observation = `While conducting operations in ${zone}, ${observed} was observed properly wearing and maintaining all designated PPE for the task.`;
        action = `Commended ${observed} on-the-spot for active PPE compliance; acknowledged as a positive practice at shift handover.`;
      } else {
        observation = `Observed ${observed} working in ${zone} without fully utilizing required PPE for the task.`;
        action = `Exercised Stop Work Authority (SWA) immediately; issued proper PPE and verified compliance before resuming.`;
      }
    } else {
      let strippedClean = cleanObs
        .replace(/^(?:while\s+operations\s+were\s+underway[\s,]+)?(?:in\s+[^,]+,?\s*)?(?:observed|noticed|saw|watched|found)\s+(?:a\s+|an\s+|the\s+)?(?:floorman|roustabout|driller|assistant driller|crane operator|mechanic|electrician|crew member|worker)?\s*[:,-]?\s*/i, '')
        .trim();
      if (!strippedClean) strippedClean = cleanObs;
      const sentenceClean = strippedClean.charAt(0).toUpperCase() + strippedClean.slice(1);
      observation = `While operations were underway in ${zone}, observed ${observed}: ${sentenceClean}.`;
      action = assessment === 'Safe'
        ? `Commended ${observed} on-the-spot for safe behavior, procedural adherence, and operational compliance.`
        : `Exercised immediate Stop Work Authority (SWA); stopped unsafe activity, guided ${observed} to green safe zone, and briefed supervisor.`;
    }
  }

  // Determine Observation Type
  let obsType: 'STOP Work Authority (SWA)' | 'Behavior Observation' | 'Condition' | 'Stop Work Authority Drill' = 'Behavior Observation';
  const isDrill = lowerClean.includes('drill') || lowerClean.includes('exercise') || cleanObs.includes('تمرين') || cleanObs.includes('تدريب');
  const isCondition = lowerClean.includes('leak') || lowerClean.includes('trip') || lowerClean.includes('cable') || lowerClean.includes('barrier') || lowerClean.includes('spill') || lowerClean.includes('gauge') || lowerClean.includes('housekeeping') || lowerClean.includes('grating') || lowerClean.includes('scaffold') || lowerClean.includes('chain') || lowerClean.includes('corrosion') || lowerClean.includes('guard') || cleanObs.includes('تسرب') || cleanObs.includes('كيبل') || cleanObs.includes('حاجز') || cleanObs.includes('سلسلة') || cleanObs.includes('نظافة') || cleanObs.includes('أرضية') || cleanObs.includes('صدأ');

  if (isDrill) {
    obsType = 'Stop Work Authority Drill';
  } else if (isSwa || hasRedZone) {
    obsType = 'STOP Work Authority (SWA)';
  } else if (isCondition) {
    obsType = 'Condition';
  } else {
    obsType = 'Behavior Observation';
  }

  return {
    zone,
    zoneArabic: ZONE_ARABIC[zone],
    role,
    roleArabic: ROLE_ARABIC[role],
    assessment,
    assessmentArabic: assessment === 'Safe' ? 'آمن (Safe)' : 'غير آمن (Unsafe)',
    obsType,
    obsTypeArabic: OBS_TYPE_ARABIC[obsType],
    name,
    observation,
    action,
    aiPolished: true,
    language: isAr ? 'ar' : 'en'
  };
}

// Track the most recently working model so subsequent requests prioritize the latest fastest Gemini 4 Flash model
let lastSuccessfulModel: string = 'gemini-4-hydrogen';

export function getActiveGeminiModel(): string {
  return lastSuccessfulModel;
}

export interface GeminiCallOptions {
  timeoutMs?: number;
  systemInstruction?: string;
  responseSchema?: any;
}

/**
 * Call Gemini using the latest Gemini 4 Flash ('gemini-4-hydrogen') with automatic
 * fallback to 'gemini-3.1-flash-lite' and exponential backoff retry on 503/429 spikes.
 */
async function callGeminiWithFallback(
  prompt: string,
  timeoutOrOptions: number | GeminiCallOptions = 65000
): Promise<string> {
  const opts: GeminiCallOptions =
    typeof timeoutOrOptions === 'number' ? { timeoutMs: timeoutOrOptions } : timeoutOrOptions;
  const timeoutMs = opts.timeoutMs ?? 65000;

  const baseModels = [
    'gemini-4-hydrogen',
    'gemini-3.1-flash-lite'
  ];
  const models = [
    ...baseModels
  ];
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  const modelErrors: string[] = [];

  for (const model of models) {
    const maxAttempts = model === 'gemini-4-hydrogen' ? 3 : 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let timerId: ReturnType<typeof setTimeout> | null = null;
      try {
        const config: Record<string, any> = {
          responseMimeType: 'application/json',
          thinkingConfig: {
            // ThinkingLevel.LOW minimizes latency on gemini-4-hydrogen (MINIMAL is not supported on Gemini 4)
            thinkingLevel: model === 'gemini-3.1-flash-lite' ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW
          }
        };

        if (opts.systemInstruction) {
          config.systemInstruction = opts.systemInstruction;
        }
        if (opts.responseSchema) {
          config.responseSchema = opts.responseSchema;
        }

        const generatePromise = ai.models.generateContent({
          model,
          contents: prompt,
          config
        });

        const timeoutPromise = new Promise<never>((_, reject) => {
          timerId = setTimeout(() => reject(new Error(`Timeout waiting for model ${model}`)), timeoutMs);
        });

        const response = await Promise.race([generatePromise, timeoutPromise]);
        if (timerId) clearTimeout(timerId);
        if (response && response.text) {
          lastSuccessfulModel = model;
          let text = response.text.trim();
          if (text.startsWith('```json')) {
            text = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
          } else if (text.startsWith('```')) {
            text = text.replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
          }
          return text;
        }
      } catch (err: any) {
        if (timerId) clearTimeout(timerId);
        const errMsg = String(err?.message || err || '');
        modelErrors.push(`${model}[try ${attempt}]: ${err?.status || ''} ${errMsg.slice(0, 220)}`);
        const isTransient =
          err?.status === 503 ||
          err?.status === 429 ||
          errMsg.includes('503') ||
          errMsg.includes('429') ||
          errMsg.includes('UNAVAILABLE') ||
          errMsg.includes('Timeout');
        console.warn(`Gemini model ${model} (attempt ${attempt}/${maxAttempts}) notice:`, err?.status || errMsg);
        if (attempt < maxAttempts && isTransient) {
          const delayMs = attempt === 1 ? 1000 : 2500;
          await new Promise(r => setTimeout(r, delayMs));
        } else {
          break;
        }
      }
    }
  }

  console.error('Gemini fallback chain exhausted:', modelErrors.join(' | '));
  const combined = modelErrors.join(' ');
  if (combined.includes('503') || combined.includes('UNAVAILABLE')) {
    throw new Error('Gemini 4 Flash is temporarily experiencing high demand (503). Please wait a few seconds and try again.');
  }
  if (combined.includes('429') || combined.includes('RESOURCE_EXHAUSTED')) {
    throw new Error('Gemini API rate limit reached (429). Please wait a moment and try again, or attach a billing-enabled API key in Settings > Secrets.');
  }
  throw new Error(`Gemini AI request failed: ${modelErrors[0] || 'Unknown error'}`);
}

export const VALID_OBS_TYPES = [
  'STOP Work Authority (SWA)',
  'Behavior Observation',
  'Condition',
  'Stop Work Authority Drill'
] as const;

export interface UserTrainingIdeaSummary {
  topic: string;
  observation: string;
  action: string;
  keywords?: string;
  zone?: string;
  role?: string;
}

export function formatTrainingIdeasPromptSection(ideas?: UserTrainingIdeaSummary[]): string {
  if (!ideas || !Array.isArray(ideas) || ideas.length === 0) return '';
  const filtered = ideas.filter(i => i && (i.observation || i.topic));
  if (filtered.length === 0) return '';
  return `
USER-TRAINED SUPERVISOR SAFETY IDEAS & FEW-SHOT EXEMPLARS:
The rig safety supervisor has trained the AI with these specific operational guidelines, equipment items, and preferred phrasing styles. When applicable, actively incorporate their terminology and prioritize these focal points:
${filtered.slice(0, 8).map((idea, idx) => `[Trained Idea #${idx + 1}: "${idea.topic || 'Safety Priority'}"]
- Exemplar Observation: "${idea.observation}"
- Exemplar Action: "${idea.action}"${idea.keywords ? `\n- Key Equipment / Concepts: ${idea.keywords}` : ''}`).join('\n\n')}
`;
}

/**
 * Uses Gemini AI to rewrite rough notes into a professional SOAR safety card (Supports Arabic & English).
 */
export async function draftSoarCardWithAI(
  rawText: string, 
  options?: string | {
    observerName?: string;
    observerRole?: string;
    observedRole?: string;
    zone?: string;
    assessment?: 'Safe' | 'Unsafe';
    obsType?: 'STOP Work Authority (SWA)' | 'Behavior Observation' | 'Condition' | 'Stop Work Authority Drill';
    trainingIdeas?: UserTrainingIdeaSummary[];
  }
): Promise<DraftCard> {
  const senderName = typeof options === 'string' ? options : options?.observerName;
  const observerRole = (typeof options === 'object' && options?.observerRole) ? options.observerRole : 'Observer';
  const observedRole = (typeof options === 'object' && options?.observedRole) ? options.observedRole : 'Floorman';
  const targetZone = (typeof options === 'object' && options?.zone) ? options.zone : 'Rig Floor';
  const prefAssessment = (typeof options === 'object' && options?.assessment) ? options.assessment : undefined;
  const prefObsType = (typeof options === 'object' && options?.obsType) ? options.obsType : undefined;
  const trainingIdeas = (typeof options === 'object' && options?.trainingIdeas) ? options.trainingIdeas : undefined;

  // Clean rawText from any accidental meta prompt prefixes
  let cleanNote = rawText
    .replace(/^The observer \([^)]+\) watched [^.]+\.\s*Note:\s*/i, '')
    .replace(/\s*Ensure the observation clearly describes [^.]+\./i, '')
    .replace(/^Note:\s*/i, '')
    .trim();

  if (!cleanNote) cleanNote = rawText.trim();
  const lowerNote = cleanNote.toLowerCase();
  const isAr = isArabicText(cleanNote);

  const isCreateFromScratch = !cleanNote ||
    /^(make|create|generate|give|write|new|random)\s*(me\s*)?(a\s*)?(brand\s*new\s*)?(card|soar|report)?$/i.test(cleanNote) ||
    /^(سوي|اكتب|اعمل|انشئ|صمم|هات|كرت)\s*(لي\s*)?(كرت|تقرير|بطاقة|عشوائي)?$/i.test(cleanNote) ||
    lowerNote.includes('make me a card') ||
    lowerNote.includes('create a card') ||
    lowerNote.includes('generate a card') ||
    cleanNote.includes('سوي لي كرت') ||
    cleanNote.includes('اكتب لي كرت');

  try {
    const trainingPrompt = formatTrainingIdeasPromptSection(trainingIdeas);
    const prompt = isCreateFromScratch
      ? `You are an expert Offshore Rig Safety Coach for Jackup Rig 50 (50 Bob Palmer) operating in the Arabian Gulf for Saudi Aramco.
${trainingPrompt}
TASK:
CREATE A COMPLETE, BRAND NEW SOAR (Safety Observation & Action Report) CARD FROM SCRATCH.
${cleanNote ? `USER REQUEST / HINT: "${cleanNote}"` : 'CREATE A REALISTIC RIG OPERATION OBSERVATION.'}

MANDATORY INSTRUCTIONS:
1. Autonomously SELECT the most realistic "zone" from: ${JSON.stringify(VALID_ZONES)}
2. Autonomously SELECT the most appropriate "role" (Person / Crew Observed) from: ${JSON.stringify(VALID_ROLES)}
3. Autonomously CHOOSE "assessment": "Safe" or "Unsafe".
4. Autonomously CHOOSE "obsType" from: ["STOP Work Authority (SWA)", "Behavior Observation", "Condition", "Stop Work Authority Drill"].
   - "STOP Work Authority (SWA)": When work is stopped or paused for safety, high wind, load shift, barrier breach, or unsafe practice.
   - "Condition": Physical state of rig, equipment, cables, trip hazards, barriers, leaks, gauges, weather conditions.
   - "Behavior Observation": Human action, hands-free stick usage, PPE wear, red zone positioning, procedure adherence.
   - "Stop Work Authority Drill": SWA training exercises.
5. "observation": Clear, professional third-person oilfield description of what the observed person did or condition in the area.
   - Describe SOMEONE ELSE's actions.
   - NEVER write in the first-person ("I did...").
   - NEVER include meta instructions, prompt commentary, or phrases like "The observer watched...", "Ensure the observation...", or "Note:".
6. "action": Specific professional action taken (praise/commendation if Safe, or SWA / correction if Unsafe).
7. LANGUAGE:
   - If the user prompt is in Arabic (e.g. "سوي لي كرت"), write BOTH observation and action in natural, professional Arabic used on Aramco rigs.
   - Otherwise, write in professional English.

Return ONLY a valid JSON object matching:
{
  "zone": string,
  "role": string,
  "assessment": "Safe" | "Unsafe",
  "obsType": "STOP Work Authority (SWA)" | "Behavior Observation" | "Condition" | "Stop Work Authority Drill",
  "name": string,
  "observation": string,
  "action": string,
  "isArabic": boolean
}`
      : `You are an expert Offshore Rig Safety Coach for Jackup Rig 50 (50 Bob Palmer) operating in the Arabian Gulf for Saudi Aramco operations.
${trainingPrompt}
TASK:
Convert this crew member's rough safety note into a professional SOAR (Safety Observation & Action Report) card.

CONTEXT:
- Work Location / Zone: ${targetZone}
- Person / Crew Observed: ${observedRole}
- Observer Role: ${observerRole}
${prefAssessment ? `- Desired Assessment: ${prefAssessment}` : ''}
${prefObsType ? `- Desired Observation Type: ${prefObsType}` : ''}

RAW CREW NOTE:
"""${cleanNote}"""

CRITICAL RIG SAFETY & INTERVENTION RULES:
1. AUTONOMOUS HAZARD & SAFETY CLASSIFICATION:
   - Carefully inspect the note for safety hazards, unsafe acts, red zone entry, pinch points, missing PPE, line-of-fire risks, spills, leaks, or Stop Work Authority (SWA) interventions.
   - If the note mentions or describes ANY of these risks (e.g. "entering red zone", "stoped him", "stepping into red zone", "no glasses", "oil leak"), you MUST set "assessment": "Unsafe".
   - You MUST set "obsType": "STOP Work Authority (SWA)" if work was halted or an intervention occurred, or "Condition" if a physical defect/hazard was reported.
   - UNDER NO CIRCUMSTANCES PRAISE OR COMMEND AN UNSAFE ACT. If someone entered a red zone or worked unsafely, NEVER say "Commended Floorman for safe behavior". Instead, the action must be a direct Stop Work Authority (SWA) intervention, moving them to safety, and reviewing boundary procedures.
   - Only set "assessment": "Safe" if the crew member was genuinely following safe procedures (e.g. using push-pull sticks, 100% tie-off, wearing full PPE).

2. RIGOROUS TYPO, GRAMMAR & PHRASING REPAIR:
   - Thoroughly repair all spelling mistakes, duplicated words, and awkward grammar in the crew's rough note (e.g., "stoped" -> "stopped", "to to" -> "to", "redzone" -> "red zone", "cantiliver" -> "cantilever", "casing bundel" -> "casing bundle").
   - Structure the observation as an articulate, professional offshore safety observation in third-person.

3. "zone": Choose the best matching zone from ${JSON.stringify(VALID_ZONES)} (keep "${targetZone}" unless the note clearly describes a different rig area).
4. "role": Choose the best matching observed role from ${JSON.stringify(VALID_ROLES)} (keep "${observedRole}" unless the note describes a different role).

5. "observation":
   - Clearly describe what the observed person was doing or the condition in the zone.
   - Describe SOMEONE ELSE's action or condition in third-person.
   - NEVER write in the first-person ("I cleaned...", "I wore...").
   - NEVER include meta commentary or "The observer watched...".

6. "action":
   - Write the specific, professional action taken by the observer.
   - For Unsafe/SWA: "Exercised immediate Stop Work Authority (SWA); stopped [Role], directed crew member to the safe green walkway, and conducted on-the-spot red zone safety coaching."
   - For Safe: "Commended [Role] on-the-spot for active adherence to safety standards; highlighted in shift briefing."

7. LANGUAGE:
   - If the note is in Arabic, write BOTH fields in natural, professional Arabic used on Aramco drilling rigs.
   - Otherwise, write in professional oilfield English.

Return ONLY a valid JSON object matching this schema:
{
  "zone": string,
  "role": string,
  "assessment": "Safe" | "Unsafe",
  "obsType": "STOP Work Authority (SWA)" | "Behavior Observation" | "Condition" | "Stop Work Authority Drill",
  "name": string,
  "observation": string,
  "action": string,
  "isArabic": boolean
}`;

    const jsonText = await callGeminiWithFallback(prompt);
    const parsed = JSON.parse(jsonText);

    const chosenZone = VALID_ZONES.includes(parsed.zone) ? parsed.zone : targetZone;
    const chosenRole = VALID_ROLES.includes(parsed.role) ? parsed.role : observedRole;
    const chosenAssessment: 'Safe' | 'Unsafe' = (parsed.assessment === 'Unsafe' || parsed.assessment === 'Safe')
      ? parsed.assessment
      : (prefAssessment || 'Safe');
    const chosenObsType: 'STOP Work Authority (SWA)' | 'Behavior Observation' | 'Condition' | 'Stop Work Authority Drill' =
      (VALID_OBS_TYPES.includes(parsed.obsType))
        ? parsed.obsType
        : (prefObsType || (cleanNote.toLowerCase().includes('swa') || cleanNote.includes('إيقاف') ? 'STOP Work Authority (SWA)' : (cleanNote.toLowerCase().includes('leak') || cleanNote.toLowerCase().includes('trip') || cleanNote.includes('تسرب') ? 'Condition' : 'Behavior Observation')));
    const finalIsAr = Boolean(parsed.isArabic || isAr || isArabicText(parsed.observation || ''));

    return {
      zone: chosenZone,
      zoneArabic: ZONE_ARABIC[chosenZone],
      role: chosenRole,
      roleArabic: ROLE_ARABIC[chosenRole],
      assessment: chosenAssessment,
      assessmentArabic: chosenAssessment === 'Safe' ? 'آمن (Safe)' : 'غير آمن (Unsafe)',
      obsType: chosenObsType,
      obsTypeArabic: OBS_TYPE_ARABIC[chosenObsType],
      name: parsed.name ? String(parsed.name).trim() : (senderName || ''),
      observation: parsed.observation ? String(parsed.observation).trim() : cleanNote,
      action: parsed.action ? String(parsed.action).trim() : (chosenAssessment === 'Safe' ? `Commended ${chosenRole} on safe practice.` : 'Intervened and corrected hazard.'),
      aiPolished: true,
      language: finalIsAr ? 'ar' : 'en'
    };
  } catch (err) {
    console.warn('Gemini draft generation failed, using bilingual heuristic fallback:', err);
    return heuristicDraft(cleanNote, senderName, observedRole, targetZone);
  }
}

/**
 * Updates an existing draft card based on user modification instructions (e.g. "Change zone to Cranes" or "اكتبه بالعربي")
 */
export async function updateDraftCardWithAI(currentDraft: DraftCard, modificationText: string): Promise<DraftCard> {
  const wantsArabic = isArabicText(modificationText) || modificationText.toLowerCase().includes('arabic') || modificationText.includes('عربي');

  try {
    const prompt = `You are an expert Offshore Rig Safety Coach for Rig 50 (50 Bob Palmer).
We have an existing draft SOAR card:
${JSON.stringify(currentDraft, null, 2)}

The user asked to make the following modification to the card:
"""${modificationText}"""

CRITICAL RULES:
1. Apply the user's requested modifications.
2. If the user asked to write/translate it to Arabic (e.g. "اكتب لي باللغة العربية" or "translate to Arabic" or "make it in Arabic"), translate and polish both "observation" and "action" into fluent, professional Arabic used in offshore oil rigs!
3. If the user asked to change zone, role, assessment, obsType, or name, update those fields.
4. "zone" MUST be one of: ${JSON.stringify(VALID_ZONES)}
5. "role" MUST be one of: ${JSON.stringify(VALID_ROLES)}
6. "assessment" MUST be "Safe" or "Unsafe".
7. "obsType" MUST be one of: ["STOP Work Authority (SWA)", "Behavior Observation", "Condition", "Stop Work Authority Drill"].

Return ONLY valid JSON matching this schema:
{
  "zone": string,
  "role": string,
  "assessment": "Safe" | "Unsafe",
  "obsType": "STOP Work Authority (SWA)" | "Behavior Observation" | "Condition" | "Stop Work Authority Drill",
  "name": string,
  "observation": string,
  "action": string,
  "isArabic": boolean
}`;

    const jsonText = await callGeminiWithFallback(prompt);
    const parsed = JSON.parse(jsonText);

    const chosenZone = VALID_ZONES.includes(parsed.zone) ? parsed.zone : currentDraft.zone;
    const chosenRole = VALID_ROLES.includes(parsed.role) ? parsed.role : currentDraft.role;
    const chosenAssessment: 'Safe' | 'Unsafe' = parsed.assessment === 'Unsafe' ? 'Unsafe' : 'Safe';
    const chosenObsType: 'STOP Work Authority (SWA)' | 'Behavior Observation' | 'Condition' | 'Stop Work Authority Drill' =
      VALID_OBS_TYPES.includes(parsed.obsType) ? parsed.obsType : (currentDraft.obsType || 'Behavior Observation');
    const finalIsAr = Boolean(parsed.isArabic || wantsArabic || isArabicText(parsed.observation || ''));

    return {
      zone: chosenZone,
      zoneArabic: ZONE_ARABIC[chosenZone],
      role: chosenRole,
      roleArabic: ROLE_ARABIC[chosenRole],
      assessment: chosenAssessment,
      assessmentArabic: chosenAssessment === 'Safe' ? 'آمن (Safe)' : 'غير آمن (Unsafe)',
      obsType: chosenObsType,
      obsTypeArabic: OBS_TYPE_ARABIC[chosenObsType],
      name: typeof parsed.name === 'string' ? parsed.name.trim() : currentDraft.name,
      observation: parsed.observation ? String(parsed.observation).trim() : currentDraft.observation,
      action: parsed.action ? String(parsed.action).trim() : currentDraft.action,
      aiPolished: true,
      language: finalIsAr ? 'ar' : 'en'
    };
  } catch (err) {
    console.warn('Gemini draft update failed, falling back to heuristic modifier:', err);
    return heuristicDraft(modificationText || currentDraft.observation, currentDraft.name);
  }
}

/**
 * Uses Gemini AI to generate a batch of unique, non-repeating SOAR safety cards for Rig 50.
 */
export async function generateBatchAiCards(options: {
  count: number;
  category?: 'Safe' | 'General';
  theme?: string;
  assessmentFilter?: string;
  blacklist?: string[];
  trainingIdeas?: UserTrainingIdeaSummary[];
}): Promise<DraftCard[]> {
  const { count = 10, category = 'Safe', theme = 'all', assessmentFilter = 'safe_only', blacklist = [], trainingIdeas = [] } = options;
  const numToGen = Math.min(Math.max(count, 1), 25); // Safe chunk size for Gemini

  const trainingPrompt = formatTrainingIdeasPromptSection(trainingIdeas);
  const blacklistSection = (blacklist && blacklist.length > 0)
    ? `
PROMPT HISTORY BLACKLIST (RECENTLY USED CARDS - DO NOT REPEAT ANY OF THESE SCENARIOS OR EQUIPMENT):
${blacklist.slice(-25).map((item, idx) => `[Blacklisted #${idx + 1}]: "${item.slice(0, 150)}"`).join('\n')}

MANDATORY BLACKLIST ENFORCEMENT:
- You are STRICTLY FORBIDDEN from repeating, rephrasing, or closely matching any observation, action, equipment piece, or incident in the blacklist above.
- Dynamically alter the context: select different equipment components, different operations, and fresh perspectives to guarantee 100% uniqueness in every batch.
`
    : '';

  try {
    const prompt = `You are the Lead Rig Safety Coach for Jackup Rig 50 (50 Bob Palmer) in the Arabian Gulf.
${trainingPrompt}
TASK: Generate ${numToGen} COMPLETELY UNIQUE, realistic, never-before-seen offshore SOAR (Stop Observe Act Report) cards.
${blacklistSection}
CRITICAL DIVERSITY RULES:
1. Every card MUST describe a completely DIFFERENT piece of equipment, different sub-location, and different circumstance. DO NOT repeat equipment or phrases.
2. ZONES must be drawn from: ${JSON.stringify(VALID_ZONES)}
3. ROLES must be drawn from: ${JSON.stringify(VALID_ROLES)}
4. OBSERVATION TYPE ("obsType") MUST be evenly distributed across:
   - "STOP Work Authority (SWA)": Stop Work Authority called, task paused, line-of-fire intervention, or weather delay (Can be Safe proactive hold or Unsafe intervention).
   - "Condition": Physical equipment integrity, tripping hazards, cable ramps, barrier chains, housekeeping, leaks, gauges, dropped object prevention (DROPS).
   - "Behavior Observation": Hands-free push pole compliance, red zone boundary adherence, 100% tie-off, PPE wear, active safety communication.
   - "Stop Work Authority Drill": Planned SWA readiness drill.
   DO NOT put all cards in Behavior Observation! Actively generate SWA and Condition cards!
5. CATEGORY MODE:
   - If category is "Safe": 100% of cards MUST be "assessment": "Safe". Focus on positive behaviors, proactive SWA drills, hands-free tool guidance, barrier maintenance, PPE compliance, mentoring, zero-incident culture, and praising crew.
   - If category is "General": Cards cover broad operational rig conditions, routine equipment checks, pressure testing, tripping hazards, chemical PPE, machinery guards, sling inspections, electrical cable ramps, and daily rig logs.
6. THEME:
   - If theme is "humor": Include witty, dry offshore banter (like hoarding UHF radios, OIM eagle eye, love equations, NASA-level coffee checks).
   - If theme is "music": Incorporate catchy song lyrics into the safety note/action!
   - If theme is "operations" or "all": Technical, realistic Aramco jackup drilling operations.
7. OUTPUT SCHEMA:
Return ONLY a valid JSON array of objects with schema:
[
  {
    "zone": string,
    "role": string,
    "assessment": "Safe" | "Unsafe",
    "obsType": "STOP Work Authority (SWA)" | "Behavior Observation" | "Condition" | "Stop Work Authority Drill",
    "observation": string,
    "action": string,
    "name": string
  }
]`;

    const jsonText = await callGeminiWithFallback(prompt);
    const parsed = JSON.parse(jsonText);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item: any, idx: number) => {
        const chosenZone = VALID_ZONES.includes(item.zone) ? item.zone : 'Rig Floor';
        const chosenRole = VALID_ROLES.includes(item.role) ? item.role : 'Floorman';
        let chosenAssessment: 'Safe' | 'Unsafe' = category === 'Safe' ? 'Safe' : (item.assessment === 'Unsafe' ? 'Unsafe' : 'Safe');
        if (assessmentFilter === 'safe_only') chosenAssessment = 'Safe';
        else if (assessmentFilter === 'unsafe_only') chosenAssessment = 'Unsafe';

        let chosenObsType: 'STOP Work Authority (SWA)' | 'Behavior Observation' | 'Condition' | 'Stop Work Authority Drill' =
          VALID_OBS_TYPES.includes(item.obsType) ? item.obsType : (idx % 3 === 0 ? 'Condition' : idx % 3 === 1 ? 'STOP Work Authority (SWA)' : 'Behavior Observation');

        return {
          zone: chosenZone,
          zoneArabic: ZONE_ARABIC[chosenZone],
          role: chosenRole,
          roleArabic: ROLE_ARABIC[chosenRole],
          assessment: chosenAssessment,
          assessmentArabic: chosenAssessment === 'Safe' ? 'آمن (Safe)' : 'غير آمن (Unsafe)',
          obsType: chosenObsType,
          obsTypeArabic: OBS_TYPE_ARABIC[chosenObsType],
          name: typeof item.name === 'string' ? item.name.trim() : '',
          observation: String(item.observation || '').trim(),
          action: String(item.action || '').trim(),
          aiPolished: true,
          language: 'en'
        };
      });
    }
  } catch (err) {
    console.warn('Gemini batch card generation failed:', err);
  }

  return [];
}

/**
 * Uses Gemini API to generate a single unique SOAR card for a specific iteration
 * using a unique 'seed', detailed 'context', and Prompt History blacklist to guarantee uniqueness.
 */
export async function generateSingleAiCardWithSeedAndContext(options: {
  iteration: number;
  seed: string;
  context: string;
  category?: 'Safe' | 'General';
  theme?: string;
  assessmentFilter?: string;
  blacklist?: string[];
  trainingIdeas?: UserTrainingIdeaSummary[];
}): Promise<DraftCard | null> {
  const { iteration, seed, context, category = 'Safe', theme = 'all', assessmentFilter = 'safe_only', blacklist = [], trainingIdeas = [] } = options;

  const trainingPrompt = formatTrainingIdeasPromptSection(trainingIdeas);
  const blacklistSection = (blacklist && blacklist.length > 0)
    ? `
PROMPT HISTORY BLACKLIST (RECENTLY USED CARDS - DO NOT REPEAT ANY OF THESE SCENARIOS OR EQUIPMENT):
${blacklist.slice(-25).map((item, idx) => `[Blacklisted #${idx + 1}]: "${item.slice(0, 150)}"`).join('\n')}

MANDATORY BLACKLIST ENFORCEMENT:
- You are STRICTLY FORBIDDEN from repeating or mimicking the blacklisted items above.
- Select alternative equipment, sub-locations, and specific operations.
`
    : '';

  try {
    const prompt = `You are an expert Offshore Rig Safety Coach for Jackup Rig 50 (50 Bob Palmer) in the Arabian Gulf.
${trainingPrompt}
TASK: Generate 1 completely UNIQUE, realistic, never-before-seen offshore SOAR (Stop Observe Act Report) card for iteration #${iteration}.
${blacklistSection}
CRITICAL UNIQUENESS PARAMETERS:
- Seed ID: "${seed}"
- Specific Operational Context: "${context}"
- Iteration: #${iteration}

MANDATORY RULES:
1. Every card MUST be unique in observation, specific equipment, sub-location, and action taken. Do NOT repeat generic phrases.
2. ZONES must be drawn from: ${JSON.stringify(VALID_ZONES)}
3. ROLES must be drawn from: ${JSON.stringify(VALID_ROLES)}
4. OBSERVATION TYPE ("obsType") MUST be chosen accurately from:
   - "STOP Work Authority (SWA)" (e.g. stopped work, suspended crane lift, weather threshold, proactive SWA)
   - "Condition" (e.g. equipment integrity, hydraulic leak, cable bridge, housekeeping, barrier chain, drops tether)
   - "Behavior Observation" (e.g. hands-free tool adherence, red zone body awareness, PPE compliance)
   - "Stop Work Authority Drill" (e.g. emergency SWA reaction drill)
5. CATEGORY MODE:
   - If category is "Safe": Must be "assessment": "Safe". Positive behavior observation, proactive SWA, hands-free tooling, flawless red zone clearance, full PPE compliance, mentoring, or positive recognition.
   - If category is "General": Broad operational spectrum: equipment inspections, line of fire, housekeeping, high-pressure line tests, procedural compliance, and daily rig logs.
6. THEME:
   - If theme is "humor": Include witty, dry offshore banter (Motorola radios, OIM bio-radar, stability love equations).
   - If theme is "music": Cleverly quote classic pop/rock song lyrics in the safety note/action!
   - If theme is "operations" or "all": Realistic technical Aramco drilling and marine jackup operations.

Return ONLY a valid JSON object matching:
{
  "zone": string,
  "role": string,
  "assessment": "Safe" | "Unsafe",
  "obsType": "STOP Work Authority (SWA)" | "Behavior Observation" | "Condition" | "Stop Work Authority Drill",
  "observation": string,
  "action": string,
  "name": string
}`;

    const jsonText = await callGeminiWithFallback(prompt);
    const parsed = JSON.parse(jsonText);
    const chosenZone = VALID_ZONES.includes(parsed.zone) ? parsed.zone : 'Rig Floor';
    const chosenRole = VALID_ROLES.includes(parsed.role) ? parsed.role : 'Floorman';
    let chosenAssessment: 'Safe' | 'Unsafe' = category === 'Safe' ? 'Safe' : (parsed.assessment === 'Unsafe' ? 'Unsafe' : 'Safe');
    if (assessmentFilter === 'safe_only') chosenAssessment = 'Safe';
    else if (assessmentFilter === 'unsafe_only') chosenAssessment = 'Unsafe';

    const chosenObsType: 'STOP Work Authority (SWA)' | 'Behavior Observation' | 'Condition' | 'Stop Work Authority Drill' =
      VALID_OBS_TYPES.includes(parsed.obsType)
        ? parsed.obsType
        : (iteration % 3 === 0 ? 'Condition' : iteration % 3 === 1 ? 'STOP Work Authority (SWA)' : 'Behavior Observation');

    return {
      zone: chosenZone,
      zoneArabic: ZONE_ARABIC[chosenZone],
      role: chosenRole,
      roleArabic: ROLE_ARABIC[chosenRole],
      assessment: chosenAssessment,
      assessmentArabic: chosenAssessment === 'Safe' ? 'آمن (Safe)' : 'غير آمن (Unsafe)',
      obsType: chosenObsType,
      obsTypeArabic: OBS_TYPE_ARABIC[chosenObsType],
      name: typeof parsed.name === 'string' ? parsed.name.trim() : '',
      observation: String(parsed.observation || '').trim(),
      action: String(parsed.action || '').trim(),
      aiPolished: true,
      language: 'en'
    };
  } catch (err) {
    console.warn(`Gemini generation for seed ${seed} failed:`, err);
    return null;
  }
}

/**
 * Takes rough, weak, or non-native safety observation rows from external rig Excel/CSV spreadsheets
 * and elevates them into professional, high-standard Saudi Aramco Jackup Rig 50 (50 Bob Palmer) SOAR training ideas.
 * Extracts the core safety concept and rewrites it completely—never copying or pasting raw text verbatim.
 */
export async function improveAndConvertRawCardsToTrainingIdeas(
  rawCards: Array<{
    rawText?: string;
    rawObservation?: string;
    rawAction?: string;
    rawZone?: string;
    rawRole?: string;
    rawCategory?: string;
    rawObsType?: string;
  }>
): Promise<Array<{
  topic: string;
  zone: string;
  role: string;
  assessment: 'Safe' | 'Unsafe';
  obsType: 'STOP Work Authority (SWA)' | 'Behavior Observation' | 'Condition' | 'Stop Work Authority Drill';
  observation: string;
  action: string;
  keywords: string;
}>> {
  if (!rawCards || rawCards.length === 0) return [];
  
  const itemsToProcess = rawCards.slice(0, 30);
  const CHUNK_SIZE = 5;
  const allResults: Array<{
    topic: string;
    zone: string;
    role: string;
    assessment: 'Safe' | 'Unsafe';
    obsType: 'STOP Work Authority (SWA)' | 'Behavior Observation' | 'Condition' | 'Stop Work Authority Drill';
    observation: string;
    action: string;
    keywords: string;
  }> = [];

  for (let i = 0; i < itemsToProcess.length; i += CHUNK_SIZE) {
    const chunk = itemsToProcess.slice(i, i + CHUNK_SIZE);
    const itemsFormatted = chunk.map((item, idx) => {
      const textDesc = item.rawObservation || item.rawText || '';
      const actDesc = item.rawAction || '';
      const zoneHint = item.rawZone || '';
      const roleHint = item.rawRole || '';
      const catHint = item.rawCategory || '';
      const obsTypeHint = item.rawObsType || '';
      return `[Raw Item #${i + idx + 1}]:
- Raw Observation Note: "${textDesc.slice(0, 400)}"
${actDesc ? `- Raw Action Taken: "${actDesc.slice(0, 400)}"` : ''}
${zoneHint ? `- Original Area/Zone: "${zoneHint}"` : ''}
${roleHint ? `- Original Role: "${roleHint}"` : ''}
${obsTypeHint ? `- Original Observation Type: "${obsTypeHint}"` : ''}
${catHint ? `- Risk Status / Assessment: "${catHint}"` : ''}`;
    }).join('\n\n');

    const prompt = `You are the Lead Rig Safety Coach & Technical HSE Superintendent for Jackup Rig 50 (50 Bob Palmer) operating in the Arabian Gulf for Saudi Aramco.

TASK:
Read each raw safety report row below, understand the underlying operational context and safety concept (what equipment was involved, what hazard or positive behavior occurred, and what control barrier was applied), and REWRITE it from scratch into an improved, original, high-standard Jackup Rig 50 Training Idea.

STRICT ANTI-COPY-PASTE DIRECTIVES:
1. NEVER copy and paste the raw text verbatim, and NEVER wrap the raw observation inside quotation marks.
2. If the raw note is vague, broken English, or first-person (e.g. "Today I observed...", "Toady was good work", "Make sure good inspection", "I observed the racked-back BOP was uncovered"), extract the core operational concept and write a brand-new, specific, third-person oilfield observation and action tailored to Jackup Rig 50.
3. Map locations to the closest official Rig 50 zone from: ${JSON.stringify(VALID_ZONES)}
   (e.g., map "Machinery Space" or "ECR / Engine Room" to "Main Deck" or "Mud Pit / Sack Room", map "Pipe Deck" to "Cantilever / Pipe Deck").
4. Map crew roles to the closest official Rig 50 role from: ${JSON.stringify(VALID_ROLES)}
5. "topic": Write a sharp, specific 4–7 word operational headline summarizing the core safety concept (e.g., "Billy Pugh Basket OEM Cover Integrity", "Mud Pump Bug Blower Grounding Verification", "Dry Bulk Hose Secondary Retention Whip-Check").
6. "assessment": "Safe" or "Unsafe" based on the operational context.
7. "obsType": Choose accurately from ["STOP Work Authority (SWA)", "Behavior Observation", "Condition", "Stop Work Authority Drill"].
8. "observation": 1–2 crisp, third-person sentences describing the specific equipment, location, and condition or behavior observed on Rig 50.
9. "action": 1–2 decisive sentences describing the exact corrective intervention, barrier restoration, PTW verification, or positive crew recognition taken.
10. "keywords": 4–6 comma-separated specific equipment and safety barrier keywords extracted from the concept.

RAW INPUT ROWS FROM SPREADSHEET:
${itemsFormatted}

Return ONLY a valid JSON array with exactly ${chunk.length} objects matching:
[
  {
    "topic": string,
    "zone": string,
    "role": string,
    "assessment": "Safe" | "Unsafe",
    "obsType": "STOP Work Authority (SWA)" | "Behavior Observation" | "Condition" | "Stop Work Authority Drill",
    "observation": string,
    "action": string,
    "keywords": string
  }
]`;

    try {
      const jsonText = await callGeminiWithFallback(prompt);
      const parsed = JSON.parse(jsonText);
      if (Array.isArray(parsed) && parsed.length > 0) {
        for (let idx = 0; idx < chunk.length; idx++) {
          const item = parsed[idx];
          if (item && item.observation) {
            const zone = VALID_ZONES.includes(item.zone) ? item.zone : mapExternalZoneToRig50(chunk[idx]?.rawZone, item.observation);
            const role = VALID_ROLES.includes(item.role) ? item.role : mapExternalRoleToRig50(chunk[idx]?.rawRole, item.observation);
            const assessment: 'Safe' | 'Unsafe' = item.assessment === 'Unsafe' ? 'Unsafe' : (item.assessment === 'Safe' ? 'Safe' : (chunk[idx]?.rawCategory?.toLowerCase().includes('unsafe') ? 'Unsafe' : 'Safe'));
            const obsType = VALID_OBS_TYPES.includes(item.obsType) ? item.obsType : 'Condition';

            allResults.push({
              topic: String(item.topic || 'Rig 50 Operational Safety Concept').slice(0, 145),
              zone,
              role,
              assessment,
              obsType,
              observation: String(item.observation || '').slice(0, 1900),
              action: String(item.action || '').slice(0, 1900),
              keywords: String(item.keywords || '').slice(0, 450)
            });
          } else {
            allResults.push(heuristicElevateRawCard(chunk[idx]));
          }
        }
      } else {
        for (const item of chunk) {
          allResults.push(heuristicElevateRawCard(item));
        }
      }
    } catch (err: any) {
      console.warn('Gemini chunk elevation fell back to conceptual synthesizer:', err?.message || err);
      for (const item of chunk) {
        allResults.push(heuristicElevateRawCard(item));
      }
    }
  }

  return allResults;
}

/**
 * Re-polishes and elevates a single existing Training Idea using Gemini AI
 */
export async function repolishSingleTrainingIdeaWithAI(idea: {
  topic: string;
  zone?: string;
  role?: string;
  assessment?: 'Safe' | 'Unsafe';
  obsType?: string;
  observation: string;
  action: string;
  keywords?: string;
}): Promise<{
  topic: string;
  zone: string;
  role: string;
  assessment: 'Safe' | 'Unsafe';
  obsType: 'STOP Work Authority (SWA)' | 'Behavior Observation' | 'Condition' | 'Stop Work Authority Drill';
  observation: string;
  action: string;
  keywords: string;
}> {
  const prompt = `You are the Lead Rig Safety Coach for Jackup Rig 50 (50 Bob Palmer) operating for Saudi Aramco.

TASK:
Take the following existing AI Training Idea and RE-POLISH, IMPROVE, and ELEVATE it.
Extract its core safety concept and rewrite the topic, observation, action, and equipment keywords so that it is sharper, more authentic to offshore Jackup Rig 50 operations, and written in crisp third-person oilfield English (never wrapping old text in quotes or repeating weak phrasing).

CURRENT TRAINING IDEA:
- Topic: "${idea.topic || ''}"
- Zone: "${idea.zone || 'Rig Floor'}"
- Role: "${idea.role || 'Floorman'}"
- Assessment: "${idea.assessment || 'Safe'}"
- Observation Type: "${idea.obsType || 'Behavior Observation'}"
- Current Observation: "${idea.observation || ''}"
- Current Action: "${idea.action || ''}"
- Current Keywords: "${idea.keywords || ''}"

STRICT RULES:
1. "zone" MUST be one of: ${JSON.stringify(VALID_ZONES)}
2. "role" MUST be one of: ${JSON.stringify(VALID_ROLES)}
3. "assessment" MUST be "Safe" or "Unsafe".
4. "obsType" MUST be one of: ${JSON.stringify(VALID_OBS_TYPES)}
5. "topic": Concise, authoritative 4–7 word operational safety title.
6. "observation": Upgraded, specific third-person observation referencing authentic Rig 50 equipment and barriers.
7. "action": Upgraded, decisive corrective action or positive safety recognition.
8. "keywords": 5–7 comma-separated technical equipment and safety barrier tags.

Return ONLY a valid JSON object matching:
{
  "topic": string,
  "zone": string,
  "role": string,
  "assessment": "Safe" | "Unsafe",
  "obsType": "STOP Work Authority (SWA)" | "Behavior Observation" | "Condition" | "Stop Work Authority Drill",
  "observation": string,
  "action": string,
  "keywords": string
}`;

  try {
    const jsonText = await callGeminiWithFallback(prompt);
    const parsed = JSON.parse(jsonText);
    const zone = VALID_ZONES.includes(parsed.zone) ? parsed.zone : mapExternalZoneToRig50(idea.zone, idea.observation);
    const role = VALID_ROLES.includes(parsed.role) ? parsed.role : mapExternalRoleToRig50(idea.role, idea.observation);
    const assessment: 'Safe' | 'Unsafe' = parsed.assessment === 'Unsafe' ? 'Unsafe' : (parsed.assessment === 'Safe' ? 'Safe' : (idea.assessment || 'Safe'));
    const obsType = VALID_OBS_TYPES.includes(parsed.obsType) ? parsed.obsType : (VALID_OBS_TYPES.includes(idea.obsType as any) ? (idea.obsType as any) : 'Behavior Observation');

    return {
      topic: String(parsed.topic || idea.topic || 'Rig 50 Safety Standard').slice(0, 145),
      zone,
      role,
      assessment,
      obsType,
      observation: String(parsed.observation || idea.observation).slice(0, 1900),
      action: String(parsed.action || idea.action).slice(0, 1900),
      keywords: String(parsed.keywords || idea.keywords || '').slice(0, 450)
    };
  } catch {
    return heuristicElevateRawCard({
      rawObservation: idea.observation,
      rawAction: idea.action,
      rawZone: idea.zone,
      rawRole: idea.role,
      rawCategory: idea.assessment,
      rawObsType: idea.obsType
    });
  }
}

export function mapExternalZoneToRig50(rawZone?: string, textHint?: string): string {
  const combined = `${rawZone || ''} ${textHint || ''}`.toLowerCase();
  if (combined.includes('pipe deck') || combined.includes('cantilever') || combined.includes('catwalk')) return 'Cantilever / Pipe Deck';
  if (combined.includes('bop') || combined.includes('wellhead') || combined.includes('accumulator') || combined.includes('substructure')) return 'BOP';
  if (combined.includes('crane') || combined.includes('lifting') || combined.includes('boat') || combined.includes('billy pugh')) return 'Cranes';
  if (combined.includes('derrick') || combined.includes('monkeyboard') || combined.includes('crown')) return 'Derrick';
  if (combined.includes('shaker') || combined.includes('flowline') || combined.includes('degasser')) return 'Shakers';
  if (combined.includes('mud pit') || combined.includes('sack') || combined.includes('pump room') || combined.includes('bug blower') || combined.includes('hopper')) return 'Mud Pit / Sack Room';
  if (combined.includes('accommodation') || combined.includes('galley') || combined.includes('camp') || combined.includes('top deck')) return 'Accommodations';
  if (combined.includes('main deck') || combined.includes('paint') || combined.includes('loading station') || combined.includes('bow leg') || combined.includes('engine') || combined.includes('scr') || combined.includes('machinery')) return 'Main Deck';
  if (combined.includes('rig floor') || combined.includes('rotary') || combined.includes('top drive') || combined.includes('roughneck')) return 'Rig Floor';
  return VALID_ZONES.includes(rawZone || '') ? (rawZone as string) : 'Main Deck';
}

export function mapExternalRoleToRig50(rawRole?: string, textHint?: string): string {
  const combined = `${rawRole || ''} ${textHint || ''}`.toLowerCase();
  if (combined.includes('rsc') || combined.includes('safety coach')) return 'Rig Safety Coach (RSC)';
  if (combined.includes('hse')) return 'HSE Specialist';
  if (combined.includes('crane')) return 'Crane Operator';
  if (combined.includes('assistant driller') || combined.includes(' ad ')) return 'Assistant Driller';
  if (combined.includes('driller')) return 'Driller';
  if (combined.includes('derrick')) return 'Derrickman';
  if (combined.includes('electrician') || combined.includes('scr') || combined.includes('grounding') || combined.includes('cable')) return 'Electrician';
  if (combined.includes('mechanic') || combined.includes('motor') || combined.includes('hydraulic')) return 'Mechanic';
  if (combined.includes('roustabout') || combined.includes('sling') || combined.includes('deck') || combined.includes('paint')) return 'Roustabout';
  if (combined.includes('floorman')) return 'Floorman';
  return VALID_ROLES.includes(rawRole || '') ? (rawRole as string) : 'Floorman';
}

/**
 * Conceptual synthesizer when Gemini is offline or rate-limited.
 * Extracts the core subject and hazard/behavior from raw text and writes a clean, original Rig 50 exemplar
 * without wrapping the raw text in quotes or repeating broken phrasing.
 */
export function heuristicElevateRawCard(raw: {
  rawText?: string;
  rawObservation?: string;
  rawAction?: string;
  rawZone?: string;
  rawRole?: string;
  rawCategory?: string;
  rawObsType?: string;
}): {
  topic: string;
  zone: string;
  role: string;
  assessment: 'Safe' | 'Unsafe';
  obsType: 'STOP Work Authority (SWA)' | 'Behavior Observation' | 'Condition' | 'Stop Work Authority Drill';
  observation: string;
  action: string;
  keywords: string;
} {
  const rawObs = (raw.rawObservation || raw.rawText || '').replace(/^[\u200B-\u200D\uFEFF]+/, '').trim();
  const rawAct = (raw.rawAction || '').replace(/^[\u200B-\u200D\uFEFF]+/, '').trim();
  const lower = `${rawObs} ${rawAct}`.toLowerCase();

  const zone = mapExternalZoneToRig50(raw.rawZone, lower);
  const role = mapExternalRoleToRig50(raw.rawRole, lower);

  const isUnsafe = raw.rawCategory?.toLowerCase().includes('unsafe') ||
    lower.includes('missing') || lower.includes('disconnected') || lower.includes('unattended') ||
    lower.includes('poor condition') || lower.includes('poor housekeeping') || lower.includes('uncovered') ||
    lower.includes('frayed') || lower.includes('unsafe') || lower.includes('leak') || lower.includes('hazard') ||
    lower.includes('no ptw') || lower.includes('damaged') || lower.includes('not wearing') ||
    lower.includes('without put') || lower.includes('without wearing') || lower.includes('very close to load') ||
    lower.includes('doesn’t hold') || lower.includes('doesnt hold') || lower.includes('not holding') ||
    lower.includes('stoped him') || lower.includes('stopped him') || lower.includes('stopped the crane');
  const assessment: 'Safe' | 'Unsafe' = isUnsafe ? 'Unsafe' : 'Safe';

  let obsType: 'STOP Work Authority (SWA)' | 'Behavior Observation' | 'Condition' | 'Stop Work Authority Drill' = 'Condition';
  if (raw.rawObsType && VALID_OBS_TYPES.includes(raw.rawObsType as any)) {
    obsType = raw.rawObsType as any;
  } else if (lower.includes('swa') || lower.includes('stop work') || lower.includes('no ptw') || lower.includes('stopped him') || lower.includes('stoped him') || lower.includes('stopped the crane')) {
    obsType = 'STOP Work Authority (SWA)';
  } else if (lower.includes('signal') || lower.includes('communication') || lower.includes('hand free') || lower.includes('hands-free') || lower.includes('red zone') || lower.includes('team work') || lower.includes('ppe') || lower.includes('glove') || lower.includes('handrail') || lower.includes('safeguard')) {
    obsType = 'Behavior Observation';
  }

  if (lower.includes('billy pugh') || (lower.includes('basket') && lower.includes('cover'))) {
    return {
      topic: 'Billy Pugh Personnel Basket Weather Cover Integrity',
      zone: 'Accommodations',
      role: 'Rig Safety Coach (RSC)',
      assessment: 'Unsafe',
      obsType: 'Condition',
      observation: 'During routine deck inspection on the top accommodation level, both Billy Pugh personnel transfer baskets were found stored without their required OEM protective weather covers.',
      action: 'Reported the finding immediately to the Barge Engineer, who installed and secured the OEM protective covers to shield the transfer rigging from UV and marine weather exposure.',
      keywords: 'Billy Pugh basket, OEM cover, personnel transfer, weather protection, Barge Engineer'
    };
  }

  if (lower.includes('bug blower') || lower.includes('grounding cable')) {
    return {
      topic: 'Mud Pump Room Bug Blower Grounding Continuity',
      zone: 'Mud Pit / Sack Room',
      role: 'Electrician',
      assessment: 'Unsafe',
      obsType: 'Condition',
      observation: 'While inspecting ventilation equipment in the mud pump room, identified two industrial bug blowers operating with their protective electrical grounding cables disconnected.',
      action: 'Notified the Rig Electrician immediately; reconnected and lug-tightened both grounding bonding cables to restore full electrical fault protection.',
      keywords: 'bug blower, grounding cable, electrical bonding, mud pump room, static protection'
    };
  }

  if (lower.includes('dry bulk') || (lower.includes('secondary retention') && lower.includes('hose'))) {
    return {
      topic: 'Dry Bulk Transfer Hose Secondary Retention Whip-Check',
      zone: 'Main Deck',
      role: 'Roustabout',
      assessment: 'Unsafe',
      obsType: 'Condition',
      observation: 'During pre-transfer checks at the starboard loading station, noticed the dry bulk pneumatic transfer hose lacked its mandatory secondary retention whip-check restraint.',
      action: 'Escalated immediately to the Barge Engineer and installed a certified wire rope whip-check restraint across the hose coupling to prevent uncontrolled hose whip under pressure.',
      keywords: 'dry bulk hose, secondary retention, whip-check, starboard loading station, pressurized hose'
    };
  }

  if (lower.includes('ferrule') || lower.includes('wire rope sling') || lower.includes('synthetic sling') || lower.includes('web sling')) {
    return {
      topic: 'Rigging Sling Certification & Quarantine Control',
      zone,
      role: 'Roustabout',
      assessment: 'Unsafe',
      obsType: 'Condition',
      observation: `During lifting gear audit in ${zone}, identified uncertified or unattended rigging slings showing compromised ferrules, frayed webbing, or missing SWL control tags.`,
      action: 'Immediately quarantined and removed the non-compliant slings from service, placed them in the rigging scrap isolation locker, and briefed the deck crew on pre-lift rigging inspection standards.',
      keywords: 'wire rope sling, synthetic web sling, aluminum ferrule, rigging quarantine, lifting gear'
    };
  }

  if (lower.includes('scr panel') || (lower.includes('no ptw') && lower.includes('pump'))) {
    return {
      topic: 'SCR Electrical Panel Isolation & PTW Enforcement',
      zone: 'Main Deck',
      role: 'Electrician',
      assessment: 'Unsafe',
      obsType: 'STOP Work Authority (SWA)',
      observation: 'Observed an open SCR electrical cabinet with a temporary power cable routed to an unattended portable pump on the deck floor without an active Permit to Work (PTW) or isolation tag.',
      action: 'Exercised Stop Work Authority (SWA), coordinated with the Maintenance Supervisor to de-energize and remove the unauthorized pump, secured the SCR panel door, and reinforced PTW electrical isolation rules.',
      keywords: 'SCR panel, Permit to Work, PTW, electrical isolation, unattended pump, SWA'
    };
  }

  if (lower.includes('paint') && (lower.includes('housekeeping') || lower.includes('open'))) {
    return {
      topic: 'Paint Locker Housekeeping & Hazmat Container Sealing',
      zone: 'Main Deck',
      role: 'Roustabout',
      assessment: 'Unsafe',
      obsType: 'Condition',
      observation: 'Inspection of the main deck paint storage locker revealed poor housekeeping with multiple solvent-based paint containers left unsealed, creating a flammable vapor and spill hazard.',
      action: 'Coordinated with the Crane Operator and deck crew to seal all chemical containers tightly, organized the flammable storage racks, and reviewed COSHH vapor control in the pre-shift safety meeting.',
      keywords: 'paint locker, flammable storage, COSHH, housekeeping, sealed containers'
    };
  }

  if (lower.includes('harness') || lower.includes('lanyard')) {
    return {
      topic: 'Fall Arrest Harness & Lanyard Inspection Quarantine',
      zone: 'BOP',
      role: 'Floorman',
      assessment: 'Unsafe',
      obsType: 'Condition',
      observation: `During safety walkthrough near ${zone}, found a full-body safety harness and shock-absorbing lanyard left unattended in degraded condition with weathered webbing.`,
      action: 'Removed the defective fall protection gear from service immediately to prevent accidental use and reinforced proper PPE storage and pre-use inspection protocols during the shift briefing.',
      keywords: 'safety harness, lanyard, fall protection, working at height, PPE quarantine'
    };
  }

  if (lower.includes('racked-back bop') || (lower.includes('bop') && lower.includes('uncovered'))) {
    return {
      topic: 'Racked-Back BOP Protective Weather Cover Tie-Down',
      zone: 'BOP',
      role: 'Floorman',
      assessment: 'Unsafe',
      obsType: 'Condition',
      observation: 'Observed that the protective tarpaulin cover on the racked-back BOP stack had come untied during high wind gusts, leaving critical well control elastomers and internals exposed to salt spray.',
      action: 'Reported the condition to the area supervisor immediately; reinstalled the heavy-duty BOP cover and secured all perimeter tie-down lashings to withstand offshore weather.',
      keywords: 'BOP stack, protective cover, weather lashing, well control equipment, salt spray protection'
    };
  }

  if (lower.includes('baricate') || lower.includes('barricade')) {
    return {
      topic: 'Crane Lift Zone Barricade & Red-Zone Exclusion',
      zone: 'Cranes',
      role: 'Crane Operator',
      assessment: 'Safe',
      obsType: 'Behavior Observation',
      observation: 'Prior to commencing crane hoisting operations, the deck crew and Crane Operator installed full perimeter barricades and warning signage around the landing zone to prevent unauthorized red-zone entry.',
      action: 'Commended the lifting team for proactive line-of-fire barrier setup and reinforced red-zone exclusion discipline during the pre-shift toolbox talk.',
      keywords: 'crane lift barricading, red zone exclusion, perimeter barrier, line of fire, lifting safety'
    };
  }

  if (lower.includes('close to load') || (lower.includes('crane') && lower.includes('stay back'))) {
    return {
      topic: 'Suspended Load Line-of-Fire Standoff Intervention',
      zone: 'Cantilever / Pipe Deck',
      role: 'Crane Operator',
      assessment: 'Unsafe',
      obsType: 'STOP Work Authority (SWA)',
      observation: 'Observed a deck crew member stepping inside the swing radius of a cargo load just as the crane began tensioning the hoist bridle on the pipe deck.',
      action: 'Exercised immediate Stop Work Authority (SWA) to halt crane hoisting, directed the crew member back to a safe standoff distance using hands-free taglines, and re-verified perimeter clearance before lifting.',
      keywords: 'suspended load standoff, line of fire, crane hoist SWA, tagline distance, pipe deck'
    };
  }

  if (lower.includes('lif vest') || lower.includes('life vest') || lower.includes('lifejacket')) {
    return {
      topic: 'Marine Work Vest Buckling & Chin-Strap Compliance',
      zone: 'Main Deck',
      role: 'Floorman',
      assessment: 'Unsafe',
      obsType: 'STOP Work Authority (SWA)',
      observation: 'Observed a crew member preparing to descend onto the lower marine landing platform while wearing an inflatable work vest with unbuckled chest and crotch retention straps.',
      action: 'Invoked Stop Work Authority (SWA) before the crew member stepped onto the exterior stairs, assisted in fastening and tightening all work vest straps properly, and reviewed over-water PPE requirements.',
      keywords: 'inflatable work vest, marine landing platform, over-water PPE, buckle fastening, SWA'
    };
  }

  if (lower.includes('safeguard') || lower.includes('handrail') || lower.includes('three-point')) {
    return {
      topic: 'Stairway Handrail & Three-Point Contact Intervention',
      zone: 'Accommodations',
      role: 'Floorman',
      assessment: 'Unsafe',
      obsType: 'Behavior Observation',
      observation: 'Observed a crew member descending the accommodation exterior stairway without holding the handrail to maintain three-point contact.',
      action: 'Intervened politely on the spot to remind the crew member of the mandatory three-point contact rule on all rig stairs and verified safe footing before proceeding.',
      keywords: 'stairway handrail, three-point contact, slip and trip prevention, accommodation stairs'
    };
  }

  if (lower.includes('not wearing his gloves') || lower.includes('holding them by his hands') || (lower.includes('glove') && lower.includes('walking'))) {
    return {
      topic: 'Mandatory Impact Glove Compliance in Operational Areas',
      zone: 'Rig Floor',
      role: 'Assistant Driller',
      assessment: 'Unsafe',
      obsType: 'STOP Work Authority (SWA)',
      observation: 'Observed a crew member walking across the active operational deck carrying his impact gloves in hand instead of wearing them inside a designated PPE zone.',
      action: 'Stopped the individual immediately, instructed him to don his cut-resistant impact gloves before entering work areas, and reinforced 100% hand protection rules at the shift briefing.',
      keywords: 'impact gloves, hand protection, mandatory PPE zone, pinch point prevention, SWA'
    };
  }

  if (lower.includes('meat cutting') || lower.includes('chife cook') || lower.includes('chain gloves') || lower.includes('galley')) {
    return {
      topic: 'Galley Stainless-Steel Mesh Cut-Resistant Glove Compliance',
      zone: 'Accommodations',
      role: 'Roustabout',
      assessment: 'Safe',
      obsType: 'Behavior Observation',
      observation: 'Observed the camp chief cook wearing certified stainless-steel chainmail cut-resistant gloves and a protective apron while portioning frozen provisions in the galley prep area.',
      action: 'Commended the galley team for strict adherence to blade safety and hand protection procedures during food preparation.',
      keywords: 'galley blade safety, stainless mesh glove, cut protection, catering HSE compliance'
    };
  }

  if (lower.includes('room boy') || lower.includes('mass boy') || (lower.includes('cabin') && lower.includes('clean'))) {
    return {
      topic: 'Accommodation Housekeeping & Sanitization PPE Standards',
      zone: 'Accommodations',
      role: 'Roustabout',
      assessment: 'Safe',
      obsType: 'Behavior Observation',
      observation: 'Observed camp catering stewards wearing nitrile gloves, eye protection, and non-slip footwear while sanitizing living quarters and wet rooms in accordance with COSHH hygiene protocols.',
      action: 'Recognized the accommodation steward team for maintaining high camp hygiene standards and consistent PPE discipline.',
      keywords: 'camp sanitation, COSHH chemical PPE, nitrile gloves, accommodation housekeeping'
    };
  }

  if (lower.includes('basket arrangement') || (lower.includes('basket') && lower.includes('cantilever'))) {
    return {
      topic: 'Cantilever Cargo Basket Staging & Walkway Clearance',
      zone: 'Cantilever / Pipe Deck',
      role: 'Roustabout',
      assessment: 'Safe',
      obsType: 'Condition',
      observation: 'Verified that offshore cargo baskets and tubular racks on the cantilever deck were neatly staged within marked load bays, leaving emergency escape walkways and taglines completely unobstructed.',
      action: 'Commended the pipe deck roustabout crew for maintaining orderly cargo staging and clear deck access routes.',
      keywords: 'cargo basket staging, cantilever deck, walkway clearance, rigging organization'
    };
  }

  if (lower.includes('aramco store') || (lower.includes('housekeeping') && lower.includes('store'))) {
    return {
      topic: 'Main Deck Equipment Store Housekeeping & Access Control',
      zone: 'Main Deck',
      role: 'Floorman',
      assessment: 'Safe',
      obsType: 'Condition',
      observation: 'Inspected the storage perimeter around the main deck materials store and verified that all pallets, spare subs, and hoses were neatly racked with zero tripping hazards along the walkway.',
      action: 'Acknowledged the deck crew for proactive housekeeping and shared the positive standard during the shift handover meeting.',
      keywords: 'materials store housekeeping, pallet racking, trip hazard elimination, main deck walkway'
    };
  }

  if (lower.includes('signal') || lower.includes('communication') || lower.includes('back load') || lower.includes('lifting')) {
    return {
      topic: 'Marine Crane Lifting Signals & Tagline Coordination',
      zone: zone === 'Main Deck' || zone === 'Cantilever / Pipe Deck' ? zone : 'Cranes',
      role: 'Crane Operator',
      assessment: 'Safe',
      obsType: 'Behavior Observation',
      observation: `Observed the Crane Operator, banksman, and roustabout crew executing an offshore supply vessel cargo basket transfer in ${zone} using clear hand signals, confirmed radio checks, and hands-free taglines.`,
      action: 'Commended the lifting team on-the-spot for disciplined banksman-to-crane communication and strict line-of-fire control throughout the marine lift.',
      keywords: 'crane lifting, banksman signals, radio communication, hands-free tagline, supply boat transfer'
    };
  }

  // Clean, grammatical fallback for any other general input without copying broken raw syntax
  const topic = `${zone} ${role} ${assessment === 'Unsafe' ? 'Barrier Intervention' : 'Operational Safety Verification'}`;
  const synthesizedObs = assessment === 'Unsafe'
    ? `During an operational safety walkdown in ${zone}, identified an unmitigated equipment barrier and line-of-fire hazard near the ${role}'s work station requiring immediate corrective intervention.`
    : `Observed the ${role} in ${zone} conducting a thorough pre-task barrier verification, confirming all protective guards, isolation tags, and safe access controls were in place before commencing operations.`;
  const synthesizedAct = assessment === 'Unsafe'
    ? `Exercised Stop Work Authority (SWA) immediately, isolated the hazard alongside the ${role} and area supervisor, and verified full barrier restoration before work resumed.`
    : `Commended the ${role} on-the-spot for proactive adherence to Rig 50 safety procedures and highlighted the positive practice during shift handover.`;

  return {
    topic,
    zone,
    role,
    assessment,
    obsType,
    observation: synthesizedObs,
    action: synthesizedAct,
    keywords: `${zone.toLowerCase()}, ${role.toLowerCase()}, barrier integrity, operational safety, rig 50`
  };
}

export interface OperationsCardRemakeRequest {
  currentCard: {
    id?: string;
    zone?: string;
    role?: string;
    assessment?: 'Safe' | 'Unsafe';
    obsType?: string;
    category?: string;
    observation?: string;
    action?: string;
    operationSnippet?: string;
  };
  operationsText?: string;
  existingObservations?: string[];
  preferredAssessment?: 'Safe' | 'Unsafe';
  preferredObsType?: string;
  remakeMode?: 'operations_ai' | 'non_safety_ai' | 'custom_ai';
  customInstruction?: string;
  trainingIdeas?: UserTrainingIdeaSummary[];
}

export interface OperationsCardRemakeResult {
  zone: string;
  role: string;
  assessment: 'Safe' | 'Unsafe';
  obsType: 'STOP Work Authority (SWA)' | 'Behavior Observation' | 'Condition' | 'Stop Work Authority Drill';
  category: string;
  observation: string;
  action: string;
  operationSnippet: string;
  topic: string;
  aiGenerated: boolean;
}

/**
 * Strips clock times, 24-hour ranges, military times, and AM/PM timestamps
 * (e.g. "00:00 - 03:30:", "08:30-12:00", "at 14:30 hrs", "0600-1200", "08:30", "10:00 AM", "0600 hrs")
 * so generated SOAR cards never contain unwanted timestamps.
 */
export function stripClockTimesFromCardText(text: string): string {
  if (!text) return '';
  return text
    // Remove leading or inline time ranges like "00:00 - 03:30: ", "(08:30 - 12:00)", "from 05:00 to 08:30"
    .replace(/\b(?:from\s+|between\s+)?(?:[01]?\d|2[0-3]):[0-5]\d\s*(?:hrs?|hours?|am|pm|ast|utc|gmt)?\s*(?:-|–|—|to|and)\s*(?:[01]?\d|2[0-3]):[0-5]\d\s*(?:hrs?|hours?|am|pm|ast|utc|gmt)?\s*:?\s*/gi, '')
    .replace(/\(\s*(?:[01]?\d|2[0-3]):[0-5]\d\s*(?:-|–|—|to)?\s*(?:[01]?\d|2[0-3])?:?[0-5]?\d?\s*(?:hrs?|hours?|am|pm|ast|utc|gmt)?\s*\)/gi, '')
    // Remove military 4-digit time ranges like "0000 - 0330:" or "0830-1200 hrs"
    .replace(/\b(?:from\s+|between\s+)?(?:[01]\d|2[0-3])[0-5]\d\s*(?:-|–|—|to|and)\s*(?:[01]\d|2[0-3])[0-5]\d\s*(?:hrs?|hours?)?\s*:?\s*/gi, '')
    // Remove preposition + clock time like "at 08:30 hrs", "at 14:00", "around 0600 hrs", "at 10 PM"
    .replace(/\b(?:at|around|by|prior to|after|before|until|since)\s+(?:[01]?\d|2[0-3]):[0-5]\d\s*(?:hrs?|hours?|am|pm|ast|utc|gmt)?\b/gi, '')
    .replace(/\b(?:at|around|by|prior to|after|before|until|since)\s+(?:[01]\d|2[0-3])[0-5]\d\s*(?:hrs?|hours?)\b/gi, '')
    .replace(/\b(?:at|around|by|prior to|after|before|until|since)\s+(?:1[0-2]|0?[1-9])\s*(?:am|pm)\b/gi, '')
    // Remove standalone HH:MM clock times (e.g. "08:30", "14:00 hrs", "6:15 AM")
    .replace(/\b(?:[01]?\d|2[0-3]):[0-5]\d\s*(?:hrs?|hours?|am|pm|ast|utc|gmt)?\s*:?/gi, '')
    // Remove standalone military times with hrs/hours (e.g. "0600 hrs", "1430 hours")
    .replace(/\b(?:[01]\d|2[0-3])[0-5]\d\s*(?:hrs?|hours?)\b/gi, '')
    // Remove standalone AM/PM times (e.g. "10 AM", "6 PM")
    .replace(/\b(?:1[0-2]|0?[1-9])\s*(?:am|pm)\b/gi, '')
    // Clean up orphaned spaces and punctuation
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[,;:\-\s]+/, '')
    .trim();
}

export type RigObsType =
  | 'STOP Work Authority (SWA)'
  | 'Behavior Observation'
  | 'Condition'
  | 'Stop Work Authority Drill';

export interface ParsedInstructionConstraints {
  excludeTime: boolean;
  assessmentLock: 'Safe' | 'Unsafe' | null;
  allowedObsTypes: RigObsType[] | null;
  oneSentenceOnly: boolean;
  strictlyUploadedOpsOnly: boolean;
}

/**
 * Parses natural-language user rules (including Quick Rule chips like
 * "Make all cards Safe Behavior & Condition observations only",
 * "Write concise 1-sentence observations and actions", and
 * "Do not include any time or timestamps in any of the cards")
 * into deterministic constraints enforced both in Gemini's systemInstruction/responseSchema and post-processing.
 */
export function parseCustomInstructionConstraints(customInstruction: string = ''): ParsedInstructionConstraints {
  const raw = String(customInstruction || '');
  const lower = raw.toLowerCase();

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

  if (wantsSafeOnly && !wantsUnsafeOnly) {
    assessmentLock = 'Safe';
  } else if (wantsUnsafeOnly && !wantsSafeOnly) {
    assessmentLock = 'Unsafe';
  }

  let allowedObsTypes: RigObsType[] | null = null;
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

/**
 * Guarantees a field is a single concise sentence when the user requested "1-sentence observations and actions".
 */
export function enforceSingleSentence(text: string): string {
  const clean = String(text || '').trim();
  if (!clean) return '';
  // Split on sentence-ending punctuation followed by whitespace and a new sentence start (preserves decimals like 15.8 ppg or 9-5/8")
  const match = clean.match(/^(.+?[.!?])(?:\s+(?=[A-Z\u0600-\u06FF])|$)/);
  if (match && match[1]) {
    return match[1].trim();
  }
  return clean.endsWith('.') || clean.endsWith('!') || clean.endsWith('?') ? clean : `${clean}.`;
}

/**
 * Builds a balanced multi-file excerpt up to maxChars (42,000 chars for Gemini 4 Flash)
 * so when multiple files (e.g. HOD 72 hour.docx + DailyReportDetailRpt.pdf) are uploaded together,
 * EVERY uploaded file is proportionally represented in EVERY batch!
 */
function buildBalancedOperationsExcerpt(fullText: string, batchIndex: number, maxChars = 42000): string {
  const trimmed = String(fullText || '').trim();
  if (trimmed.length <= maxChars) return trimmed;

  const fileSections = trimmed.split(/(?==== FILE: )/).filter(s => s.trim().length > 0);
  if (fileSections.length <= 1) {
    const offset = batchIndex > 0
      ? Math.min((batchIndex * 14000) % Math.max(1, trimmed.length - 16000), trimmed.length - 20000)
      : 0;
    if (offset === 0) return trimmed.slice(0, maxChars);
    return `${trimmed.slice(0, 5000)}\n...\n${trimmed.slice(offset, offset + (maxChars - 5000))}`;
  }

  // Allocate proportional budget to every uploaded file so none get truncated out
  const perFileBudget = Math.floor(maxChars / fileSections.length);
  return fileSections
    .map(sec => {
      if (sec.length <= perFileBudget) return sec.trim();
      const header = sec.slice(0, Math.min(2200, Math.floor(perFileBudget * 0.25)));
      const remainingBudget = perFileBudget - header.length - 10;
      const stride = Math.max(1, sec.length - header.length - remainingBudget);
      const startOffset = batchIndex > 0 ? header.length + ((batchIndex * 6000) % stride) : header.length;
      return `${header}\n...\n${sec.slice(startOffset, startOffset + remainingBudget).trim()}`;
    })
    .join('\n\n');
}

/**
 * Recreates a single card on the PDF Operations page (or Mass Submitter deck) using Gemini 4 Flash ('gemini-4-hydrogen').
 * Reads the actual Daily Drilling Report (DDR) / PDF / Word / Excel text, avoids the previous card and all existing cards in the batch,
 * and crafts a completely new, non-repeating card strictly obeying custom instructions and excluding clock times.
 */
export async function remakeOperationCardWithAI(
  req: OperationsCardRemakeRequest
): Promise<OperationsCardRemakeResult> {
  const {
    currentCard = {},
    operationsText = '',
    existingObservations = [],
    preferredAssessment,
    preferredObsType,
    remakeMode = 'operations_ai',
    customInstruction = '',
    trainingIdeas = []
  } = req;

  const constraints = parseCustomInstructionConstraints(customInstruction);
  const shouldStripTime = constraints.excludeTime;

  let targetAssessment: 'Safe' | 'Unsafe' =
    preferredAssessment ||
    constraints.assessmentLock ||
    (currentCard.assessment === 'Unsafe' ? 'Unsafe' : 'Safe');

  const allowedObsTypesForCard: RigObsType[] = preferredObsType && VALID_OBS_TYPES.includes(preferredObsType as any)
    ? [preferredObsType as RigObsType]
    : constraints.allowedObsTypes
    ? constraints.allowedObsTypes
    : targetAssessment === 'Unsafe'
    ? ['STOP Work Authority (SWA)', 'Condition', 'Behavior Observation']
    : ['Behavior Observation', 'Condition', 'STOP Work Authority (SWA)', 'Stop Work Authority Drill'];

  const avoidList = [
    currentCard.observation || '',
    ...existingObservations.slice(-35)
  ]
    .map(s => String(s || '').trim())
    .filter(Boolean);

  const reportExcerpt = buildBalancedOperationsExcerpt(operationsText, 0, 36000);
  const trainingPrompt = formatTrainingIdeasPromptSection(trainingIdeas);
  const isNonSafety = remakeMode === 'non_safety_ai';

  const systemInstruction = isNonSafety
    ? `You are a creative writer and storyteller for the crew on Jackup Rig 50 (50 Bob Palmer).
${customInstruction ? `NON-NEGOTIABLE USER INSTRUCTIONS (HIGHEST PRIORITY):\n${customInstruction}\n` : ''}
${shouldStripTime ? 'HARD RULE: NEVER include any clock times, hours, or timestamps anywhere in the output.' : ''}
${constraints.oneSentenceOnly ? 'HARD RULE: Write EXACTLY ONE (1) concise sentence for "observation" and EXACTLY ONE (1) concise sentence for "action".' : ''}`
    : `You are the Lead Rig Safety Coach & Drilling Operations Superintendent for Jackup Rig 50 (50 Bob Palmer) operating for Saudi Aramco.
${customInstruction ? `NON-NEGOTIABLE USER INSTRUCTIONS (HIGHEST PRIORITY — OVERRIDE ALL DEFAULTS):\n${customInstruction}\n` : ''}
HARD ENFORCED CONSTRAINTS:
- "assessment" MUST BE: "${targetAssessment}".
- "obsType" MUST BE one of: ${JSON.stringify(allowedObsTypesForCard)}.
- ${shouldStripTime ? 'ZERO TIMESTAMPS: NEVER include any clock times, hours, or time ranges (e.g. 00:00, 08:30 hrs, 1400, 6 PM) in observation, action, or operationSnippet.' : 'Follow user instruction regarding time.'}
- ${constraints.oneSentenceOnly ? 'EXACTLY ONE SENTENCE: Both "observation" and "action" MUST each be EXACTLY ONE (1) crisp, concise sentence (under 24 words, 1 single period). NEVER write 2 sentences.' : 'Write crisp, authentic, professional third-person oilfield English.'}
- Ground the card directly in real activities, equipment, depths, vessels, or tasks from the uploaded operations documents.`;

  const prompt = isNonSafety
    ? `TASK:
Recreate and replace an existing card with a BRAND-NEW, 100% NON-SAFETY card (ZERO safety jargon, no PPE, no LOTO, no valves, no SWA).
Write a fun, vivid, human-sounding observation about everyday life, specialty coffee & espresso, shawarma vs. smash burgers, PS5 EA FC / FIFA, football, V8 cars, movies, or stand-up comedy.

PREVIOUS CARD TO REPLACE (DO NOT REPEAT THIS):
"${currentCard.observation || ''}"

OTHER CARDS IN BATCH (DO NOT REPEAT):
${avoidList.slice(0, 15).map((s, i) => `${i + 1}. "${s.slice(0, 140)}"`).join('\n')}`
    : `${trainingPrompt}
TASK:
Recreate this SOAR card from scratch using a SPECIFIC, DIFFERENT operational activity, equipment, tubular task, mud/cement activity, marine lift, or mechanical check from the uploaded Operations Documents below.

${reportExcerpt ? `UPLOADED OPERATIONS DOCUMENTS CONTENT:\n"""\n${reportExcerpt}\n"""` : 'CONTEXT: Jackup Rig 50 (50 Bob Palmer) drilling, casing, cementing, BOP testing, crane offloading, and mud system operations.'}

PREVIOUS CARD TO REPLACE (DO NOT REPEAT):
- Old Zone: "${currentCard.zone || 'Rig Floor'}"
- Old Observation: "${currentCard.observation || ''}"
- Old Action: "${currentCard.action || ''}"

EXISTING CARDS IN CURRENT BATCH (FORBIDDEN TO REPEAT):
${avoidList.slice(0, 20).map((s, i) => `${i + 1}. "${s.slice(0, 140)}"`).join('\n')}

REQUIREMENTS:
- "zone": Pick from ${JSON.stringify(VALID_ZONES)}.
- "role": Pick from ${JSON.stringify(VALID_ROLES)}.
- "assessment": Must be "${targetAssessment}".
- "obsType": Must be one of ${JSON.stringify(allowedObsTypesForCard)}.
- "observation": ${constraints.oneSentenceOnly ? 'EXACTLY 1 concise third-person sentence (no timestamps).' : '1–2 specific third-person sentences referencing the uploaded files.'}
- "action": ${constraints.oneSentenceOnly ? 'EXACTLY 1 concise sentence describing the action taken (no timestamps).' : '1–2 specific sentences describing the action taken.'}
- "operationSnippet": Short 40–80 char operational activity from the uploaded document (no timestamps).
- "topic": Crisp 4–6 word title.`;

  const singleCardSchema = {
    type: Type.OBJECT,
    properties: {
      topic: { type: Type.STRING },
      zone: { type: Type.STRING, enum: VALID_ZONES },
      role: { type: Type.STRING, enum: VALID_ROLES },
      assessment: { type: Type.STRING, enum: [targetAssessment] },
      obsType: { type: Type.STRING, enum: allowedObsTypesForCard },
      category: { type: Type.STRING },
      observation: { type: Type.STRING },
      action: { type: Type.STRING },
      operationSnippet: { type: Type.STRING }
    },
    required: ['topic', 'zone', 'role', 'assessment', 'obsType', 'category', 'observation', 'action', 'operationSnippet']
  };

  try {
    const jsonText = await callGeminiWithFallback(prompt, {
      timeoutMs: 45000,
      systemInstruction,
      responseSchema: singleCardSchema
    });
    const parsed = JSON.parse(jsonText);

    const chosenZone = VALID_ZONES.includes(parsed.zone) ? parsed.zone : (currentCard.zone && VALID_ZONES.includes(currentCard.zone) ? currentCard.zone : 'Rig Floor');
    const chosenRole = VALID_ROLES.includes(parsed.role) ? parsed.role : (currentCard.role && VALID_ROLES.includes(currentCard.role) ? currentCard.role : 'Floorman');
    const chosenAssessment: 'Safe' | 'Unsafe' = targetAssessment;
    const chosenObsType: RigObsType = allowedObsTypesForCard.includes(parsed.obsType)
      ? parsed.obsType
      : allowedObsTypesForCard[0];

    let rawObs = String(parsed.observation || '').trim();
    let rawAct = String(parsed.action || '').trim();
    let rawSnip = String(parsed.operationSnippet || currentCard.operationSnippet || 'AI Synthesized from Operations Report').trim();

    if (shouldStripTime) {
      rawObs = stripClockTimesFromCardText(rawObs);
      rawAct = stripClockTimesFromCardText(rawAct);
      rawSnip = stripClockTimesFromCardText(rawSnip);
    }
    if (constraints.oneSentenceOnly) {
      rawObs = enforceSingleSentence(rawObs);
      rawAct = enforceSingleSentence(rawAct);
    }

    return {
      topic: String(parsed.topic || (isNonSafety ? 'Crew Lounge Highlight' : `${chosenZone} Operational Verification`)).trim(),
      zone: chosenZone,
      role: chosenRole,
      assessment: chosenAssessment,
      obsType: chosenObsType,
      category: String(parsed.category || (chosenAssessment === 'Safe' ? 'Safe Behavior Observation' : 'General Operational Safety')).trim(),
      observation: rawObs,
      action: rawAct,
      operationSnippet: rawSnip.slice(0, 110),
      aiGenerated: true
    };
  } catch (err: any) {
    console.warn('Gemini remakeOperationCardWithAI error:', err?.message || err);
    throw new Error(`Gemini AI remake failed: ${err?.message || 'Service temporarily unavailable'}`);
  }
}

/**
 * Synthesizes a batch of unique SOAR cards directly from the uploaded Operations documents (PDF / Word / Excel)
 * using Gemini 4 Flash ('gemini-4-hydrogen') with strict systemInstruction + responseSchema enum enforcement.
 */
export async function generateOperationsCardsBatchWithAI(options: {
  operationsText: string;
  count: number;
  reportDate?: string;
  existingObservations?: string[];
  customInstruction?: string;
  batchIndex?: number;
}): Promise<OperationsCardRemakeResult[]> {
  const {
    operationsText = '',
    count = 20,
    existingObservations = [],
    customInstruction = '',
    batchIndex = 0
  } = options;

  const numToGen = Math.min(Math.max(1, count), 30);
  const fullText = String(operationsText || '').trim();
  const constraints = parseCustomInstructionConstraints(customInstruction);
  const shouldStripTime = constraints.excludeTime;

  const allowedAssessments: Array<'Safe' | 'Unsafe'> = constraints.assessmentLock
    ? [constraints.assessmentLock]
    : ['Safe', 'Unsafe'];

  const allowedObsTypes: RigObsType[] = constraints.allowedObsTypes
    ? constraints.allowedObsTypes
    : constraints.assessmentLock === 'Safe'
    ? ['Behavior Observation', 'Condition', 'STOP Work Authority (SWA)', 'Stop Work Authority Drill']
    : ['STOP Work Authority (SWA)', 'Behavior Observation', 'Condition', 'Stop Work Authority Drill'];

  // Balanced multi-file excerpt up to 42,000 chars so Word + PDF + Excel files are ALL read together
  const reportExcerpt = buildBalancedOperationsExcerpt(fullText, batchIndex, 42000);

  const systemInstruction = `You are the Lead Rig Safety Coach & Drilling Operations Superintendent for Jackup Rig 50 (50 Bob Palmer) operating for Saudi Aramco.

${customInstruction ? `CRITICAL USER ADDITIONAL INSTRUCTIONS (HIGHEST PRIORITY — MUST BE OBEYED ON 100% OF CARDS WITHOUT EXCEPTION):\n"""\n${customInstruction}\n"""\n` : ''}
ENFORCED OUTPUT CONSTRAINTS:
1. OPERATIONS GROUNDING: Every single card MUST be directly tied to specific activities, equipment, tubulars, pressures, mud/cement work, vessels, or inspections found in the uploaded Operations Documents. NEVER invent generic filler cards unrelated to the uploaded files.
2. ASSESSMENT LOCK: ${constraints.assessmentLock ? `100% of cards MUST have "assessment": "${constraints.assessmentLock}". ZERO exceptions.` : 'Mix "assessment" realistically (~80% "Safe", ~20% "Unsafe") unless the user instructions above specify otherwise.'}
3. OBSERVATION TYPE LOCK: "obsType" MUST ONLY be chosen from ${JSON.stringify(allowedObsTypes)}.${allowedObsTypes.length > 1 ? ' Distribute cards cleanly across these allowed types.' : ''}
4. TIMESTAMPS RULE: ${shouldStripTime ? 'STRICTLY FORBIDDEN to include ANY clock times, hours, or time ranges (e.g., "00:00 - 03:30", "08:30", "14:00 hrs", "0600-1200", "6 AM") in "observation", "action", or "operationSnippet".' : 'Follow user instruction regarding timestamps.'}
5. SENTENCE LENGTH RULE: ${constraints.oneSentenceOnly ? 'EVERY "observation" MUST be EXACTLY ONE (1) concise third-person sentence (max 24 words, single period). EVERY "action" MUST be EXACTLY ONE (1) concise sentence (max 20 words, single period). NEVER write 2 sentences in either field.' : 'Write crisp, authentic third-person oilfield observations and decisive actions.'}
6. ZERO DUPLICATION: Every card must cover a distinct detail, sub-task, or equipment angle from the uploaded files.`;

  const prompt = `Synthesize EXACTLY ${numToGen} COMPLETELY UNIQUE, non-repeating SOAR (Stop Observe Act Report) cards from the uploaded Operations Documents below.

UPLOADED OPERATIONS FILES CONTENT:
"""
${reportExcerpt}
"""

${existingObservations.length > 0 ? `ALREADY-GENERATED OBSERVATIONS (DO NOT REPEAT OR CLOSELY PARAPHRASE ANY OF THESE — PICK FRESH ACTIVITIES/ANGLES FROM THE UPLOADED FILES):\n${existingObservations.slice(-45).map((s, i) => `${i + 1}. "${s.slice(0, 120)}"`).join('\n')}` : ''}

Return a JSON array of EXACTLY ${numToGen} cards strictly obeying all user instructions and constraints.`;

  const batchResponseSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        topic: { type: Type.STRING, description: 'Concise 4-6 word title' },
        zone: { type: Type.STRING, enum: VALID_ZONES },
        role: { type: Type.STRING, enum: VALID_ROLES },
        assessment: { type: Type.STRING, enum: allowedAssessments },
        obsType: { type: Type.STRING, enum: allowedObsTypes },
        category: { type: Type.STRING },
        observation: {
          type: Type.STRING,
          description: constraints.oneSentenceOnly
            ? 'Exactly ONE concise third-person sentence grounded in the uploaded operations, with zero clock times.'
            : 'Specific third-person observation grounded in the uploaded operations.'
        },
        action: {
          type: Type.STRING,
          description: constraints.oneSentenceOnly
            ? 'Exactly ONE concise action sentence, with zero clock times.'
            : 'Specific action taken.'
        },
        operationSnippet: {
          type: Type.STRING,
          description: 'Short 40-80 char operational activity reference from the uploaded files without clock times.'
        }
      },
      required: ['topic', 'zone', 'role', 'assessment', 'obsType', 'category', 'observation', 'action', 'operationSnippet']
    }
  };

  const jsonText = await callGeminiWithFallback(prompt, {
    timeoutMs: 65000,
    systemInstruction,
    responseSchema: batchResponseSchema
  });

  const parsed = JSON.parse(jsonText);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Gemini AI returned an empty card list. Please try again.');
  }

  return parsed.map((item: any, idx: number) => {
    const chosenZone = VALID_ZONES.includes(item.zone) ? item.zone : mapExternalZoneToRig50(item.zone, item.observation);
    const chosenRole = VALID_ROLES.includes(item.role) ? item.role : mapExternalRoleToRig50(item.role, item.observation);
    const chosenAssessment: 'Safe' | 'Unsafe' = constraints.assessmentLock
      ? constraints.assessmentLock
      : item.assessment === 'Unsafe'
      ? 'Unsafe'
      : 'Safe';
    const chosenObsType: RigObsType = allowedObsTypes.includes(item.obsType)
      ? item.obsType
      : allowedObsTypes[idx % allowedObsTypes.length];

    let rawObs = String(item.observation || '').trim();
    let rawAct = String(item.action || '').trim();
    let rawSnip = String(item.operationSnippet || 'Synthesized from Uploaded Operations').trim();

    if (shouldStripTime) {
      rawObs = stripClockTimesFromCardText(rawObs);
      rawAct = stripClockTimesFromCardText(rawAct);
      rawSnip = stripClockTimesFromCardText(rawSnip);
    }
    if (constraints.oneSentenceOnly) {
      rawObs = enforceSingleSentence(rawObs);
      rawAct = enforceSingleSentence(rawAct);
    }

    return {
      topic: String(item.topic || `${chosenZone} Operation`).trim(),
      zone: chosenZone,
      role: chosenRole,
      assessment: chosenAssessment,
      obsType: chosenObsType,
      category: String(item.category || (chosenAssessment === 'Safe' ? 'Safe Behavior Observation' : 'General Operational Safety')).trim(),
      observation: rawObs,
      action: rawAct,
      operationSnippet: rawSnip.slice(0, 110),
      aiGenerated: true
    };
  });
}



