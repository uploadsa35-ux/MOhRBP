import React, { useState, useEffect } from 'react';
import { 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Lock, 
  UserX, 
  UserCheck, 
  Sparkles, 
  Clock, 
  Calendar,
  Shield,
  FileText,
  Download,
  Smartphone,
  Eye,
  Check,
  ChevronDown,
  RotateCcw,
  Sliders,
  Brain,
  X,
  ChevronRight
} from 'lucide-react';
import { 
  USER_TENANT_ID, 
  USER_OWNER_ID, 
  USER_FORM_ID, 
  RIG_50_NAME, 
  RIG_50_SCENARIOS 
} from '../utils/defaultForm';
import { 
  CrewMember, 
  getStoredCrewMembers, 
  syncCrewWithServer 
} from '../utils/crewStore';
import { downloadSoarPdf } from '../utils/pdfGenerator';
import { safePostJson } from '../utils/apiClient';
import { submitRig50Card } from '../utils/cardSubmitter';
import { addToPromptBlacklist } from '../utils/aiCardGenerator';
import { 
  recordCardToFirestore, 
  testFirestoreConnection, 
  getLocalTrainingIdeas, 
  AiTrainingIdea, 
  saveAiTrainingIdeaToFirestore 
} from '../firebase';
import { useSupervisor } from '../context/SupervisorAuthContext';

export interface SubmissionReceipt {
  id: string;
  responseId: number | string;
  date: string;
  time: string;
  observerName: string;
  observerRole: string;
  observedRole: string;
  zone: string;
  assessment: 'Safe' | 'Unsafe';
  obsType: string;
  observationSummary: string;
  observation?: string;
  action?: string;
  addedToAiTraining?: boolean;
}

const STORAGE_KEYS = {
  ZONE: 'rig50_last_zone',
  OBSERVER_ROLE: 'rig50_last_observer_role',
  OBSERVER_NAME: 'rig50_last_observer_name',
  IS_ANONYMOUS: 'rig50_last_is_anonymous',
  OBSERVED_ROLE: 'rig50_last_observed_role',
  OBS_TYPE: 'rig50_last_obs_type',
  SUBMIT_VIEW: 'rig50_submit_view_mode' // 'simple' | 'detailed'
};

const RIG_ZONES = [
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

const CREW_ROLES = [
  'Floorman',
  'Driller',
  'Assistant Driller',
  'Derrickman',
  'Roustabout',
  'Crane Operator',
  'HSE Specialist',
  'Rig Safety Coach (RSC)',
  'Mechanic',
  'Electrician',
  'Welder',
  'Toolpusher'
];

export const SimplifiedRig50Submitter: React.FC = () => {
  const { isSupervisor } = useSupervisor();

  // Crew roster state
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>(() => getStoredCrewMembers());

  // View Mode: 'simple' (ultra-streamlined for phones) or 'detailed'
  const [viewMode, setViewMode] = useState<'simple' | 'detailed'>(() => {
    return (localStorage.getItem(STORAGE_KEYS.SUBMIT_VIEW) as any) || 'simple';
  });

  // Submitted Cards Side Drawer state & persistence
  const [isSideDrawerOpen, setIsSideDrawerOpen] = useState<boolean>(false);
  const [submittedCardsHistory, setSubmittedCardsHistory] = useState<SubmissionReceipt[]>(() => {
    try {
      const stored = localStorage.getItem('rig50_submitted_cards_history');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const saveSubmittedHistory = (updated: SubmissionReceipt[]) => {
    setSubmittedCardsHistory(updated);
    try {
      localStorage.setItem('rig50_submitted_cards_history', JSON.stringify(updated.slice(0, 50)));
    } catch {}
  };

  // Remembered form choices
  const [isAnonymous, setIsAnonymous] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEYS.IS_ANONYMOUS) === 'true';
  });

  const [observerName, setObserverName] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.OBSERVER_NAME) || '';
  });

  const [observerRole, setObserverRole] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.OBSERVER_ROLE) || 'Assistant Driller';
  });

  // Who is being observed (Safety principle: observer writes about someone else)
  const [observedRole, setObservedRole] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.OBSERVED_ROLE) || 'Floorman';
  });

  const [zone, setZone] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.ZONE) || 'Rig Floor';
  });

  const [assessment, setAssessment] = useState<'Safe' | 'Unsafe'>('Safe');
  const [obsType, setObsType] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.OBS_TYPE) || 'Behavior Observation';
  });
  const [reportDate, setReportDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Observation & Action content
  const [obsText, setObsText] = useState<string>('Observed Floorman safely utilizing hands-free push-pull sticks while guiding drill pipe, keeping hands completely out of pinch points.');
  const [actionText, setActionText] = useState<string>('Commended crew member on-the-spot during tool handling and shared good practice in safety briefing.');
  const [roughNote, setRoughNote] = useState<string>('');

  // UI state
  const [isAiRewriting, setIsAiRewriting] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [activeIdeasCount, setActiveIdeasCount] = useState<number>(() => {
    return getLocalTrainingIdeas().filter(i => i && i.isActive !== false).length;
  });

  useEffect(() => {
    const handler = () => {
      setActiveIdeasCount(getLocalTrainingIdeas().filter(i => i && i.isActive !== false).length);
    };
    window.addEventListener('rig50_ai_ideas_updated', handler);
    return () => window.removeEventListener('rig50_ai_ideas_updated', handler);
  }, []);
  const [latestError, setLatestError] = useState<string | null>(null);
  const [lastSubmissionSuccess, setLastSubmissionSuccess] = useState<SubmissionReceipt | null>(null);
  const [receipts, setReceipts] = useState<SubmissionReceipt[]>([]);
  const [savedBadgeVisible, setSavedBadgeVisible] = useState<boolean>(false);

  // Sync crew roster from server
  useEffect(() => {
    syncCrewWithServer().then(synced => {
      if (synced && synced.length > 0) setCrewMembers(synced);
    });
  }, []);

  // Save user preferences whenever changed
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ZONE, zone);
    localStorage.setItem(STORAGE_KEYS.OBSERVER_ROLE, observerRole);
    localStorage.setItem(STORAGE_KEYS.OBSERVED_ROLE, observedRole);
    localStorage.setItem(STORAGE_KEYS.IS_ANONYMOUS, String(isAnonymous));
    localStorage.setItem(STORAGE_KEYS.OBS_TYPE, obsType);
    localStorage.setItem(STORAGE_KEYS.SUBMIT_VIEW, viewMode);
    if (observerName) {
      localStorage.setItem(STORAGE_KEYS.OBSERVER_NAME, observerName);
    }
    setSavedBadgeVisible(true);
    const timer = setTimeout(() => setSavedBadgeVisible(false), 2000);
    return () => clearTimeout(timer);
  }, [zone, observerRole, observedRole, isAnonymous, observerName, viewMode, obsType]);

  // Quick 1-tap scenario chips designed to observe someone else across all 4 categories
  const quickChips = [
    {
      label: '🧤 Hands-Free Tooling',
      obs: `Observed ${observedRole} consistently utilizing hands-free safety push-pull sticks while moving drill collars, keeping hands free of pinch hazards.`,
      act: `Acknowledged ${observedRole} on the spot for 100% adherence to Hands-Free Policy.`,
      type: 'Safe' as const,
      obsType: 'Behavior Observation'
    },
    {
      label: '🛑 Red Zone Clearance',
      obs: `Observed ${observedRole} remaining outside the marked drill floor red zone perimeter while top drive and elevators were in motion.`,
      act: `Commended drill crew at the post-shift debrief for maintaining red zone discipline.`,
      type: 'Safe' as const,
      obsType: 'Behavior Observation'
    },
    {
      label: '⚠️ Trip Hazard / Cable Ramp',
      obs: `Noticed temporary welding/air cable crossing main transit pathway in ${zone} without heavy-duty rubber protection ramp.`,
      act: `Exercised intervention; rerouted cable using overhead safety S-hooks and installed walkway bridge ramp immediately.`,
      type: 'Unsafe' as const,
      obsType: 'Condition'
    },
    {
      label: '🛡️ Barrier & Guard Integrity',
      obs: `Verified physical red safety chain barrier, DROPS secondary retention pins, and warning signage were securely locked in ${zone}.`,
      act: `Confirmed physical condition integrity with area supervisor; recorded positive barrier check on daily safety checklist.`,
      type: 'Safe' as const,
      obsType: 'Condition'
    },
    {
      label: '🛑 Stop Work Authority (SWA)',
      obs: `Observed heavy swell and wind gusts exceeding lift plan limits; invoked Stop Work Authority (SWA) before lifting tubular basket.`,
      act: `Suspended operation immediately under SWA; secured load in safe landing zone until weather returned to safe operational parameters.`,
      type: 'Safe' as const,
      obsType: 'STOP Work Authority (SWA)'
    },
    {
      label: '🛢️ Oil Leak / SWA',
      obs: `Observed small hydraulic fluid seepage near the rotary table while ${observedRole} was preparing tubular connections.`,
      act: `Stopped work immediately under SWA (Stop Work Authority); barricaded area, absorbed fluid with pads, and tightened fitting before resuming.`,
      type: 'Unsafe' as const,
      obsType: 'STOP Work Authority (SWA)'
    },
    {
      label: '⏱️ SWA Readiness Drill',
      obs: `Conducted an unannounced Stop Work Authority (SWA) readiness drill during tubular handling to evaluate crew reaction time.`,
      act: `Crew halted all machinery movement within 3 seconds and acknowledged hand signals flawlessly; commended for emergency alertness.`,
      type: 'Safe' as const,
      obsType: 'Stop Work Authority Drill'
    },
    {
      label: '🇸🇦 سلطة إيقاف العمل SWA',
      obs: `تمت ملاحظة ريح شديدة أثناء عملية الرفع؛ قام الطاقم بتفعيل سلطة إيقاف العمل (SWA) وتعليق المناولة حتى استقرار الأحوال الجوية.`,
      act: `تم تثبيت الحمولة في منطقة آمنة والإشادة بالفريق لاتخاذ قرار إيقاف العمل الصحيح لضمان السلامة.`,
      type: 'Safe' as const,
      obsType: 'STOP Work Authority (SWA)'
    },
    {
      label: '🇸🇦 فحص حالة المعدات Condition',
      obs: `تم فحص حواجز السلامة وسلاسل الحماية ولوحات التحذير في منطقة العمل والتأكد من سلامتها التامة وتثبيتها بشكل سليم.`,
      act: `تم توثيق فحص حالة المنطقة الإيجابي والتأكد من استمرار صلاحية تصريح العمل.`,
      type: 'Safe' as const,
      obsType: 'Condition'
    }
  ];

  const handleApplyChip = (chip: typeof quickChips[0]) => {
    setAssessment(chip.type);
    if (chip.obsType) setObsType(chip.obsType);
    setObsText(chip.obs);
    setActionText(chip.act);
    setAiNotice(`✓ Applied template: ${chip.label} (${chip.obsType})`);
    setTimeout(() => setAiNotice(null), 3000);
  };

  // AI Polish & Generation: Can rewrite whole card or generate brand-new card from scratch
  const handleAiPolish = async (customNote?: string) => {
    const raw = (customNote !== undefined ? customNote : roughNote).trim();

    setIsAiRewriting(true);
    setAiNotice(null);

    // Hazard pre-check to prevent defaulting to 'Safe'
    const lowerRaw = raw.toLowerCase();
    const hazardTerms = [
      'unsafe', 'hazard', 'danger', 'stop work', 'swa', 'defect', 'trip', 'tripping',
      'spill', 'leak', 'broken', 'missing', 'not wear', 'without ppe', 'no ppe',
      'red zone', 'pinch point', 'line of fire', 'stopped him', 'stoped him', 'stopped', 'stoped',
      'entering red zone', 'inside red zone', 'into red zone', 'stepping inside', 'dropped',
      'unsecured', 'bypass', 'unauthorized', 'damaged', 'crack', 'loose', 'slip', 'fall',
      'غير آمن', 'خطر', 'تسرب', 'زيت', 'انزلاق', 'سقوط', 'كسر', 'ايقاف', 'إيقاف',
      'منطقة حمراء', 'بدون وقاية', 'نقطة انحصار', 'خط النار'
    ];
    const isDetectedHazard = hazardTerms.some(term => lowerRaw.includes(term));

    try {
      const activeIdeas = getLocalTrainingIdeas().filter(i => i && i.isActive !== false);
      const res = await safePostJson('/api/ai-rewrite-card', {
        roughNote: raw,
        observerRole,
        observedRole,
        zone,
        // Let AI autonomously determine Safe vs Unsafe if hazard detected or raw note present
        assessment: isDetectedHazard ? 'Unsafe' : (raw ? undefined : assessment),
        obsType: isDetectedHazard ? 'STOP Work Authority (SWA)' : (raw ? undefined : obsType),
        observerName: isAnonymous ? '' : observerName,
        trainingIdeas: activeIdeas
      });

      if (res.success && res.data?.card) {
        const c = res.data.card;
        // Autonomously update entire card
        if (c.zone && RIG_ZONES.includes(c.zone)) setZone(c.zone);
        if (c.role && CREW_ROLES.includes(c.role)) setObservedRole(c.role);
        if (c.assessment === 'Safe' || c.assessment === 'Unsafe') setAssessment(c.assessment);
        if (c.obsType) setObsType(c.obsType);
        if (c.observation) setObsText(c.observation);
        if (c.action) setActionText(c.action);
        
        setAiNotice(`✨ Full card created: ${c.zone} · ${c.role || observedRole} · ${c.assessment} (${c.obsType || obsType})!`);
      } else {
        fallbackPolish(raw);
      }
    } catch {
      fallbackPolish(raw);
    } finally {
      setIsAiRewriting(false);
      setTimeout(() => setAiNotice(null), 5000);
    }
  };

  const fallbackPolish = (raw: string) => {
    let cleaned = raw
      .replace(/\bstoped\b/gi, 'stopped')
      .replace(/\bto to\b/gi, 'to')
      .replace(/\bin to\b/gi, 'into')
      .replace(/\bwihtout\b/gi, 'without')
      .replace(/\bfoloorman\b/gi, 'floorman')
      .replace(/\bdril\b/gi, 'drill');

    const lower = cleaned.toLowerCase();
    const isAr = /[\u0600-\u06FF]/.test(cleaned) || lower.includes('عربي');
    const isScratch = !cleaned || 
      lower.includes('make me a card') || 
      lower.includes('create a card') || 
      lower.includes('generate') ||
      cleaned.includes('سوي لي كرت') ||
      cleaned.includes('اكتب لي كرت');

    if (isScratch) {
      // Extensive pool of unique Rig 50 scenarios spanning different zones, roles, and types
      const templates = [
        {
          zone: 'Rig Floor',
          role: 'Floorman',
          assessment: 'Safe' as const,
          obsType: 'Behavior Observation',
          obsEn: 'During drill pipe tripping on rig floor, Floorman was observed using hands-free push-pull sticks to guide tubulars, keeping hands completely out of pinch points.',
          actEn: 'Commended Floorman on-the-spot for 100% adherence to Hands-Free Policy; shared practice in safety meeting.',
          obsAr: 'أثناء إنزال أنابيب الحفر على أرضية الحفر، تمت ملاحظة عامل الحفر يستخدم عصي التوجيه بدون لمس باليدين لتوجيه الأنابيب مع إبعاد يديه عن نقاط الانحصار.',
          actAr: 'تم تقديم الشكر والثناء لعامل الحفر لالتزامه التام بسياسة العمل بدون لمس ومشاركة الممارسة في اجتماع الوردية.'
        },
        {
          zone: 'Cranes',
          role: 'Crane Operator',
          assessment: 'Safe' as const,
          obsType: 'STOP Work Authority (SWA)',
          obsEn: 'Crane Operator exercised Stop Work Authority (SWA) when sudden sea swell exceeded safe limits while lifting a cargo basket from supply vessel.',
          actEn: 'Safely returned load to vessel deck and suspended lift until wind and swell stabilized.',
          obsAr: 'قام مشغل الرافعة بتفعيل سلطة إيقاف العمل (SWA) عندما تجاوزت حركة البحر الحدود الآمنة أثناء تفريغ حمولة من قارب الإمداد.',
          actAr: 'تمت إعادة الحمولة بأمان إلى سطح القارب وتعليق الرفع حتى استقرار الطقس مع الإشادة بحرص المشغل.'
        },
        {
          zone: 'Cantilever / Pipe Deck',
          role: 'Roustabout',
          assessment: 'Unsafe' as const,
          obsType: 'STOP Work Authority (SWA)',
          obsEn: 'Observed Roustabout stepping inside marked pipe deck red zone while casing bundle was suspended from crane overhead.',
          actEn: 'Exercised immediate Stop Work Authority (SWA); stopped worker, guided crew member back to safe green walkway, and briefed deck crew on Red Zone boundaries.',
          obsAr: 'تمت ملاحظة عامل السطح يدخل ضمن المنطقة الحمراء للكانتليفر أثناء تحريك حزمة أنابيب بالرافعة.',
          actAr: 'تم التدخل الفوري وتفعيل سلطة إيقاف العمل وتوجيه العامل إلى الممشى الآمن وإعادة شرح مخاطر خط النار والالتزام بالمناطق المحظورة.'
        },
        {
          zone: 'Shakers',
          role: 'Floorman',
          assessment: 'Safe' as const,
          obsType: 'Behavior Observation',
          obsEn: 'Observed shaker hand wearing complete chemical splash goggles, face shield, and chemical-resistant gloves while taking drilling mud samples.',
          actEn: 'Commended Floorman for exemplary PPE compliance during routine mud monitoring.',
          obsAr: 'تمت ملاحظة عامل الحفر عند الهزازات يرتدي كامل نظارات الوقاية الكيميائية وواقي الوجه والقفازات الخاصة أثناء أخذ عينات الطين.',
          actAr: 'تم توجيه الثناء للعامل لالتزامه بإجراءات السلامة في التعامل مع المواد الكيميائية.'
        },
        {
          zone: 'Derrick',
          role: 'Derrickman',
          assessment: 'Safe' as const,
          obsType: 'Condition',
          obsEn: 'Verified that secondary retention safety pins and stainless steel safety lanyards on the monkeyboard latch were 100% engaged and locked.',
          actEn: 'Confirmed physical barrier integrity with Driller; recorded DROPS verification tag in shift tour sheet.',
          obsAr: 'تم التأكد من تثبيت قفل الأمان المزدوج وسلسلة الحماية من السقوط (DROPS) في منصة برج الحفر وتأمينها بالكامل.',
          actAr: 'تم توثيق فحص DROPS الإيجابي وإشعار الحفار باكتمال إجراءات التحقق من سلامة المعدات العلوية.'
        },
        {
          zone: 'Mud Pit / Sack Room',
          role: 'Roustabout',
          assessment: 'Safe' as const,
          obsType: 'Behavior Observation',
          obsEn: 'Observed area supervisor enforcing mandatory shaded hydration breaks every 20 minutes and providing chilled electrolyte packs during bulk barite mixing.',
          actEn: 'Verified shaded rest station was stocked with fresh water and electrolyte packs; zero heat fatigue reported across shift.',
          obsAr: 'تمت ملاحظة مشرف المنطقة يطبق فترات الراحة الإلزامية في الظل وشرب السوائل والأملاح المعدنية بانتظام أثناء خلط البارايت.',
          actAr: 'تم التأكد من توفر مياه الشرب الباردة ومحاليل الترطيب وتثمين الالتزام بإجراءات الوقاية من الإجهاد الحراري.'
        },
        {
          zone: 'BOP',
          role: 'Assistant Driller',
          assessment: 'Unsafe' as const,
          obsType: 'Condition',
          obsEn: 'Noticed slight hydraulic fluid weeping from the 3,000 psi closing line flange connector on the annular preventer during pre-shift barrier integrity checks.',
          actEn: 'Exercised Stop Work Authority (SWA); depressurized line via Koomey unit, replaced O-ring seal, and verified pressure test before resuming.',
          obsAr: 'تمت ملاحظة تسريب طفيف لزيت الهيدروليك من وصلة خط الإغلاق عالي الضغط عند مانع الانفجار أثناء الفحص الدوري.',
          actAr: 'تم تفعيل سلطة إيقاف العمل وتفريغ الضغط عبر وحدة الكومي واستبدال حلقة العزل والتأكد من نجاح اختبار الضغط قبل المتابعة.'
        }
      ];

      const pick = templates[Math.floor(Math.random() * templates.length)];
      setZone(pick.zone);
      setObservedRole(pick.role);
      setAssessment(pick.assessment);
      setObsType(pick.obsType);
      setObsText(isAr ? pick.obsAr : pick.obsEn);
      setActionText(isAr ? pick.actAr : pick.actEn);
      setAiNotice(`✨ Created fresh card: ${pick.zone} · ${pick.role} · ${pick.assessment}`);
      return;
    }

    // Hazard detection on specific note
    const hazardTerms = [
      'unsafe', 'hazard', 'danger', 'stop work', 'swa', 'defect', 'trip', 'tripping',
      'spill', 'leak', 'broken', 'missing', 'not wear', 'without ppe', 'no ppe',
      'red zone', 'pinch point', 'line of fire', 'stopped him', 'stoped him', 'stopped', 'stoped',
      'entering red zone', 'inside red zone', 'into red zone', 'stepping inside', 'dropped',
      'unsecured', 'bypass', 'unauthorized', 'damaged', 'crack', 'loose', 'slip', 'fall',
      'غير آمن', 'خطر', 'تسرب', 'زيت', 'انزلاق', 'سقوط', 'كسر', 'ايقاف', 'إيقاف',
      'منطقة حمراء', 'بدون وقاية', 'نقطة انحصار', 'خط النار'
    ];

    const isHazard = hazardTerms.some(term => lower.includes(term));
    const effectiveAssessment: 'Safe' | 'Unsafe' = isHazard ? 'Unsafe' : assessment;
    setAssessment(effectiveAssessment);

    const hasRedZone = lower.includes('red zone') || lower.includes('منطقة حمراء');
    const hasPpe = lower.includes('ppe') || cleaned.includes('وقاية') || cleaned.includes('معدات') || cleaned.includes('كمامة');

    if (hasRedZone) {
      setObsType('STOP Work Authority (SWA)');
      if (isAr) {
        setObsText(`أثناء العمليات في ${zone}، تمت ملاحظة ${observedRole} يدخل ضمن المنطقة الحمراء المحظورة.`);
        setActionText(`تم تفعيل سلطة إيقاف العمل (SWA) فوراً وتوجيه ${observedRole} خارج المنطقة الحمراء وإعادة التذكير بحدود خط النار.`);
      } else {
        setObsText(`While operations were underway in ${zone}, observed ${observedRole} entering designated red zone without authorization.`);
        setActionText(`Exercised immediate Stop Work Authority (SWA); stopped ${observedRole}, guided crew member to safe green walkway, and conducted on-the-spot red zone safety coaching.`);
      }
      setAiNotice('🛑 Detected Red Zone Entry: Classified as Unsafe & STOP Work Authority (SWA).');
      return;
    }

    if (isHazard) {
      setObsType('STOP Work Authority (SWA)');
      if (isAr) {
        setObsText(`أثناء العمليات في ${zone}: تمت ملاحظة حالة غير آمنة تشمل ${observedRole} (${cleaned}).`);
        setActionText(`تم التدخل الفوري وتفعيل سلطة إيقاف العمل (SWA) وتصحيح الحالة الخطرة وإبلاغ المشرف لتأمين الموقع.`);
      } else {
        const sentenceClean = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
        setObsText(`While operations were underway in ${zone}, observed unsafe condition involving ${observedRole}: ${sentenceClean}.`);
        setActionText(`Intervened immediately under Stop Work Authority (SWA); stopped unsafe behavior, guided crew member to safety, and briefed supervisor.`);
      }
      setAiNotice('⚠️ Detected Unsafe Condition: Classified as Unsafe & SWA.');
      return;
    }

    // Safe practice default
    if (isAr) {
      if (hasPpe) {
        setObsText(`أثناء العمل في ${zone}، تمت ملاحظة ${observedRole} يلتزم بارتداء كامل معدات الوقاية الشخصية المحددة للعملية.`);
        setActionText(`تم تقديم الشكر والثناء لـ ${observedRole} في الموقع لالتزامه بمعايير السلامة المهنية.`);
      } else {
        setObsText(`أثناء العمليات في ${zone}: تمت ملاحظة ${observedRole} (${cleaned}).`);
        setActionText(`تم شكر ${observedRole} على الالتزام بالسلامة وإبراز السلوك الإيجابي.`);
      }
    } else {
      if (hasPpe) {
        setObsText(`While conducting operations in ${zone}, observed ${observedRole} properly wearing and maintaining all designated PPE for the task.`);
        setActionText(`Commended ${observedRole} on-the-spot for exemplary PPE compliance; reinforced safe practice during shift handover.`);
      } else {
        setObsText(`While operations were underway in ${zone}, observed ${observedRole}: ${cleaned.charAt(0).toUpperCase() + cleaned.slice(1)}.`);
        setActionText(`Commended ${observedRole} on-the-spot for safe behavior and procedural compliance.`);
      }
    }
    setAiNotice('✓ Formatted observation & corrective action.');
  };

  // Promote a submitted card from side drawer to AI Training (Supervisor only)
  const handlePromoteCardToAiTraining = async (card: SubmissionReceipt) => {
    if (!isSupervisor) return;
    try {
      const cardObs = card.observation || card.observationSummary;
      const cardAct = card.action || 'Corrective safety action logged and verified.';
      const newIdea: AiTrainingIdea = {
        id: `idea_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        topic: `${card.zone} - ${card.observedRole} ${card.assessment === 'Unsafe' ? 'Intervention' : 'Compliance'}`,
        zone: card.zone,
        role: card.observedRole,
        assessment: card.assessment,
        obsType: card.obsType,
        observation: cardObs,
        action: cardAct,
        keywords: `${card.zone.toLowerCase()}, ${card.observedRole.toLowerCase()}, ${card.obsType.toLowerCase()}`,
        isActive: true,
        usageCount: 1,
        createdAt: new Date().toISOString()
      };

      const saved = await saveAiTrainingIdeaToFirestore(newIdea);
      if (saved) {
        const updated = submittedCardsHistory.map(c => c.id === card.id ? { ...c, addedToAiTraining: true } : c);
        saveSubmittedHistory(updated);
        setAiNotice(`✨ Promoted #${card.responseId} directly to Train AI database!`);
        setTimeout(() => setAiNotice(null), 4000);
      }
    } catch (err) {
      console.warn('Failed to promote card to AI training:', err);
    }
  };

  // Submit to official Microsoft Forms
  const handleSubmit = async () => {
    setIsSubmitting(true);
    setLatestError(null);

    const nameToSubmit = isAnonymous ? '' : observerName.trim();

    const finalDate = reportDate && reportDate.trim() ? reportDate : new Date().toISOString().split('T')[0];

    const answers = [
      { questionId: 'r5f3272b6049d4ad18e7650bd96ae837b', answer1: finalDate },
      { questionId: 'r4fdd1bd872014d9c80d3a51be3f2f950', answer1: RIG_50_NAME },
      { questionId: 'r409eb59dd0f244e4b52573ce50037896', answer1: zone },
      { questionId: 'rfe47535c542e4ce8886c2741c4c69b78', answer1: observerRole },
      { questionId: 'r26c88746635b40a39ef3f873e00e78a8', answer1: assessment },
      { questionId: 'ra8f38f21840f490a87ac70d61da452f8', answer1: obsType },
      { questionId: 'r2d178592d7f94a6aad56238bc1005d5f', answer1: 'Red Zone Control Failure' },
      { questionId: 'r22c97581ebf74a8498da93d022d8afcf', answer1: 'PPE Worn Correctly (Compliant)' },
      { questionId: 're36e820370e2436798ea97f34930b753', answer1: obsText },
      { questionId: 'rda2692cb0c9841fdb71f4b2ec5415728', answer1: actionText },
      { questionId: 'r698ffb98e604476b92020bb6c34790e9', answer1: nameToSubmit }
    ];

    try {
      const result = await submitRig50Card(answers, finalDate);

      if (result.success) {
        const newReceipt: SubmissionReceipt = {
          id: `rec_${Date.now()}`,
          responseId: result.responseId || `MS-${Date.now().toString().slice(-5)}`,
          date: finalDate,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          observerName: nameToSubmit || '(Anonymous)',
          observerRole,
          observedRole,
          zone,
          assessment,
          obsType,
          observationSummary: obsText.slice(0, 85) + '...',
          observation: obsText,
          action: actionText,
          addedToAiTraining: false
        };
        const updatedHistory = [newReceipt, ...submittedCardsHistory.filter(c => c.id !== newReceipt.id)];
        saveSubmittedHistory(updatedHistory);
        setReceipts(prev => [newReceipt, ...prev]);
        setLastSubmissionSuccess(newReceipt);
        setRoughNote('');
        setLatestError(null);

        // Record to Firestore database in background to preserve historical audit & guarantee uniqueness
        recordCardToFirestore({
          responseId: String(result.responseId || ''),
          date: finalDate,
          time: newReceipt.time,
          zone,
          role: observedRole,
          observerRole,
          observerName: nameToSubmit,
          assessment,
          obsType: obsType as any,
          observation: obsText,
          action: actionText,
          aiPolished: Boolean(aiNotice)
        }).catch(fsErr => console.warn('Firestore card background record notice:', fsErr));

        // Also register in Prompt History Blacklist Engine so mass runs never repeat this scenario
        try {
          addToPromptBlacklist(obsText);
        } catch {}

        try {
          if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate?.([60, 40, 80]);
          }
        } catch {
          // Ignore vibration error on unsupported platforms
        }
      } else {
        setLatestError(result.error || 'Submission failed. Please check network.');
      }
    } catch (err: any) {
      setLatestError(err.message || 'Network connection failed. Please check rig internet.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-xl mx-auto px-2 sm:px-0 pb-12 animate-in fade-in">
      {/* 1. TOP STATUS BAR: RIG INFO & PREFERENCES REMEMBERED BADGE */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300 shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-tight">Rig 50 Quick SOAR</h2>
              <span className="text-[10px] bg-teal-500/30 text-teal-200 border border-teal-400/30 px-2 py-0.5 rounded-full font-mono font-semibold">
                Mobile View
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              50 Bob Palmer (RBP-50A) · Instant Cloud Submitter
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Submitted Cards Review Queue Button */}
          <button
            type="button"
            onClick={() => setIsSideDrawerOpen(true)}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-teal-900/90 hover:bg-teal-800 text-teal-200 border border-teal-700 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            title="Open side review drawer for submitted cards and AI ideas"
          >
            <Brain className="w-3.5 h-3.5 text-purple-300" />
            <span>Review Queue</span>
            {submittedCardsHistory.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-teal-500 text-teal-950 font-mono text-[10px] font-bold">
                {submittedCardsHistory.length}
              </span>
            )}
          </button>

          {/* View Mode Toggle */}
          <button
            type="button"
            onClick={() => setViewMode(prev => prev === 'simple' ? 'detailed' : 'simple')}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Toggle between Simple and Detailed View"
          >
            <Sliders className="w-3.5 h-3.5 text-teal-400" />
            <span className="hidden xs:inline">{viewMode === 'simple' ? 'Simple' : 'Full Form'}</span>
          </button>
        </div>
      </div>

      {/* Auto-Saved Notification Pill */}
      {savedBadgeVisible && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] px-3 py-1.5 rounded-xl flex items-center justify-center gap-1.5 shadow-2xs animate-in fade-in">
          <Check className="w-3.5 h-3.5 text-emerald-600" />
          <span>Your name, role, and zone are remembered on this phone ✓</span>
        </div>
      )}

      {/* SUCCESS CONFIRMATION MODAL / CARD */}
      {lastSubmissionSuccess && (
        <div className="bg-gradient-to-br from-emerald-50 via-teal-50/50 to-white border-2 border-emerald-500/80 rounded-2xl p-4 sm:p-5 shadow-md space-y-3 animate-in zoom-in-95">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-emerald-950">Card Successfully Submitted!</h3>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full border border-emerald-300">
                    {lastSubmissionSuccess.obsType || 'Behavior'}
                  </span>
                </div>
                <p className="text-xs text-emerald-700 font-mono">
                  Receipt ID: #{lastSubmissionSuccess.responseId} · {lastSubmissionSuccess.time}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLastSubmissionSuccess(null)}
              className="text-xs text-slate-400 hover:text-slate-700 px-2 py-1 rounded"
            >
              ✕
            </button>
          </div>

          <p className="text-xs text-slate-700 bg-white/80 p-2.5 rounded-xl border border-emerald-200 leading-relaxed">
            "{lastSubmissionSuccess.observationSummary}"
          </p>

          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-emerald-800 font-medium flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Saved for next card</span>
            </span>

            <button
              type="button"
              onClick={() => downloadSoarPdf({
                responseId: lastSubmissionSuccess.responseId,
                date: lastSubmissionSuccess.date,
                zone: lastSubmissionSuccess.zone,
                role: lastSubmissionSuccess.observerRole,
                name: lastSubmissionSuccess.observerName.includes('Anonymous') ? '' : lastSubmissionSuccess.observerName,
                assessment: lastSubmissionSuccess.assessment,
                observation: obsText,
                action: actionText
              })}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. THE MAIN STREAMLINED CARD */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
        
        {/* STEP A: OBSERVER IDENTITY (REMEMBERED ON PHONE) */}
        <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-teal-600" />
              <span>1. Observer (You)</span>
            </span>

            {/* Anonymous Toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-xs text-slate-600 font-medium">Anonymous</span>
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500 cursor-pointer"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Observer Name Input */}
            <div>
              <label className="text-[11px] font-medium text-slate-600 block mb-1">
                Your Name {isAnonymous && <span className="text-slate-400">(Hidden)</span>}
              </label>
              <input
                type="text"
                disabled={isAnonymous}
                value={observerName}
                onChange={(e) => setObserverName(e.target.value)}
                placeholder={isAnonymous ? "Submitting Anonymously" : "e.g. Ahmed Al-Ghamdi"}
                className={`w-full px-3 py-2 text-xs sm:text-sm bg-white border rounded-xl outline-none transition-all ${
                  isAnonymous 
                    ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' 
                    : 'border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-slate-900 font-medium'
                }`}
              />
            </div>

            {/* Observer Role Selector */}
            <div>
              <label className="text-[11px] font-medium text-slate-600 block mb-1">
                Your Role on Rig 50
              </label>
              <select
                value={observerRole}
                onChange={(e) => setObserverRole(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none text-slate-900 font-medium"
              >
                {CREW_ROLES.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* STEP B: WHO ARE YOU OBSERVING & WHERE? (SAFETY PRINCIPLE) */}
        <div className="p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-indigo-600" />
              <span>2. Crew Member Observed &amp; Area</span>
            </span>
            <span className="text-[10px] text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded font-medium">
              Writes about someone else
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Person / Crew Observed */}
            <div>
              <label className="text-[11px] font-semibold text-indigo-900 block mb-1">
                Person / Crew Observed
              </label>
              <select
                value={observedRole}
                onChange={(e) => {
                  setObservedRole(e.target.value);
                  // Update current observation text if it referenced the old role
                  setObsText(prev => prev.replace(new RegExp(observedRole, 'gi'), e.target.value));
                }}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-indigo-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none text-slate-900 font-medium"
              >
                {CREW_ROLES.map(r => (
                  <option key={r} value={r}>
                    {r} {r === observerRole ? '(Another crew member in same role)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Rig Zone */}
            <div>
              <label className="text-[11px] font-semibold text-indigo-900 block mb-1">
                Rig 50 Zone / Area
              </label>
              <select
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-indigo-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none text-slate-900 font-medium"
              >
                {RIG_ZONES.map(z => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* STEP C: ASSESSMENT (SAFE vs UNSAFE - HUGE MOBILE TOUCH TARGETS) */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block mb-1.5">
            3. Safety Assessment
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                setAssessment('Safe');
                if (obsText.includes('hazard') || obsText.includes('leak') || obsText.includes('SWA')) {
                  setObsText(`Observed ${observedRole} strictly adhering to safe operating procedures and PPE requirements.`);
                  setActionText(`Commended ${observedRole} on the spot for excellent safety practice.`);
                }
              }}
              className={`py-3 px-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 active:scale-[0.98] ${
                assessment === 'Safe'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-500/30'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <span className="text-base">🟢</span>
              <span className="text-xs sm:text-sm font-bold">Safe Practice</span>
              <span className={`text-[10px] ${assessment === 'Safe' ? 'text-emerald-100' : 'text-slate-500'}`}>
                Positive Recognition
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAssessment('Unsafe');
                if (obsText.includes('Commended') || obsText.includes('strictly adhering')) {
                  setObsText(`Observed ${observedRole} working near line-of-fire without adequate spotter in ${zone}.`);
                  setActionText(`Intervened immediately under SWA; corrected position and briefed crew.`);
                }
              }}
              className={`py-3 px-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 active:scale-[0.98] ${
                assessment === 'Unsafe'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-500/30'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <span className="text-base">🔴</span>
              <span className="text-xs sm:text-sm font-bold">Unsafe / Hazard</span>
              <span className={`text-[10px] ${assessment === 'Unsafe' ? 'text-rose-100' : 'text-slate-500'}`}>
                Corrective Action / SWA
              </span>
            </button>
          </div>
        </div>

        {/* STEP D: OBSERVATION TYPE (DIRECTLY CONTROLS QUESTION 6 IN MS FORMS) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block">
              4. Observation Type (Question 6)
            </label>
            <span className="text-[10px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded font-mono font-medium border border-teal-200">
              Active: {obsType}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* 1. STOP Work Authority (SWA) */}
            <button
              type="button"
              onClick={() => setObsType('STOP Work Authority (SWA)')}
              className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-1 active:scale-[0.98] ${
                obsType === 'STOP Work Authority (SWA)'
                  ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/30 shadow-xs'
                  : 'bg-white hover:bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-base">🛑</span>
                <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded font-mono font-bold">Q6</span>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 leading-tight">SWA</div>
                <p className="text-[10px] text-slate-500 leading-tight mt-0.5">Stop Work Authority</p>
              </div>
            </button>

            {/* 2. Condition */}
            <button
              type="button"
              onClick={() => setObsType('Condition')}
              className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-1 active:scale-[0.98] ${
                obsType === 'Condition'
                  ? 'bg-sky-50 border-sky-500 ring-2 ring-sky-500/30 shadow-xs'
                  : 'bg-white hover:bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-base">🛠️</span>
                <span className="text-[9px] bg-sky-100 text-sky-800 px-1 py-0.2 rounded font-mono font-bold">Q6</span>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 leading-tight">Condition</div>
                <p className="text-[10px] text-slate-500 leading-tight mt-0.5">Equipment / Area</p>
              </div>
            </button>

            {/* 3. Behavior Observation */}
            <button
              type="button"
              onClick={() => setObsType('Behavior Observation')}
              className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-1 active:scale-[0.98] ${
                obsType === 'Behavior Observation'
                  ? 'bg-teal-50 border-teal-500 ring-2 ring-teal-500/30 shadow-xs'
                  : 'bg-white hover:bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-base">👁️</span>
                <span className="text-[9px] bg-teal-100 text-teal-800 px-1 py-0.2 rounded font-mono font-bold">Q6</span>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 leading-tight">Behavior</div>
                <p className="text-[10px] text-slate-500 leading-tight mt-0.5">Crew Practices</p>
              </div>
            </button>

            {/* 4. Stop Work Authority Drill */}
            <button
              type="button"
              onClick={() => setObsType('Stop Work Authority Drill')}
              className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-1 active:scale-[0.98] ${
                obsType === 'Stop Work Authority Drill'
                  ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-500/30 shadow-xs'
                  : 'bg-white hover:bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-base">⏱️</span>
                <span className="text-[9px] bg-purple-100 text-purple-800 px-1 py-0.2 rounded font-mono font-bold">Q6</span>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 leading-tight">SWA Drill</div>
                <p className="text-[10px] text-slate-500 leading-tight mt-0.5">Readiness Drill</p>
              </div>
            </button>
          </div>
        </div>

        {/* STEP E: WHAT DID YOU SEE? (ROUGH NOTES & 1-TAP CHIPS) */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              5. Observation &amp; Action
            </label>
            <span className="text-[10px] text-slate-500 font-mono">
              English or عربي
            </span>
          </div>

          {/* Quick Idea Chips */}
          <div className="flex flex-wrap gap-1.5">
            {quickChips.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyChip(chip)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-teal-50 active:bg-teal-100 text-slate-700 hover:text-teal-900 text-[11px] font-medium rounded-lg border border-slate-200 transition-colors"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Rough Note Input for Quick AI Polishing or Full Generation */}
          <div className="space-y-2">
            <div className="relative">
              <textarea
                rows={2}
                value={roughNote}
                onChange={(e) => setRoughNote(e.target.value)}
                placeholder='Type a note (e.g. "noticed oil leak") OR "Make me a card" to auto-select area, role, and generate from scratch...'
                className="w-full p-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none leading-relaxed text-slate-900 placeholder:text-slate-400"
              />
            </div>

            {/* Quick One-Tap Generation Prompts */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase">AI Commands:</span>
              <button
                type="button"
                onClick={() => handleAiPolish('Make me a card')}
                disabled={isAiRewriting}
                className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-semibold rounded-md border border-indigo-200 transition-colors"
              >
                ✨ Make me a card
              </button>
              <button
                type="button"
                onClick={() => handleAiPolish('Make an unsafe hazard card with SWA')}
                disabled={isAiRewriting}
                className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-semibold rounded-md border border-rose-200 transition-colors"
              >
                🔴 Create Unsafe Card
              </button>
              <button
                type="button"
                onClick={() => handleAiPolish('Make a safe positive behavior card')}
                disabled={isAiRewriting}
                className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-semibold rounded-md border border-emerald-200 transition-colors"
              >
                🟢 Create Safe Card
              </button>
              <button
                type="button"
                onClick={() => handleAiPolish('سوي لي كرت سلامة باللغة العربية')}
                disabled={isAiRewriting}
                className="px-2 py-0.5 bg-teal-50 hover:bg-teal-100 text-teal-800 text-[10px] font-semibold rounded-md border border-teal-200 transition-colors font-arabic"
              >
                🇸🇦 سوي لي كرت (عربي)
              </button>
            </div>

            {/* Prominent Action Button Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
              {/* Main AI Button */}
              <button
                type="button"
                onClick={() => handleAiPolish()}
                disabled={isAiRewriting}
                className="py-2.5 px-3 bg-gradient-to-r from-teal-700 via-teal-600 to-indigo-700 hover:from-teal-600 hover:to-indigo-600 active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all"
              >
                {isAiRewriting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-200" />
                    <span>AI Coach is creating card...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>
                      {roughNote.trim() ? '✨ Rewrite Whole Card with AI' : '✨ Create Card from Scratch with AI'}
                    </span>
                  </>
                )}
              </button>

              {/* Surprise Me / Random Generator Button */}
              <button
                type="button"
                onClick={() => handleAiPolish('generate random realistic Rig 50 card')}
                disabled={isAiRewriting}
                className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 flex items-center justify-center gap-1.5 transition-all"
              >
                <span>🎲 Surprise Me (Random Scenario)</span>
              </button>
            </div>

            {/* AI Training Ideas Quick Studio Banner */}
            <div className="bg-gradient-to-r from-purple-50 via-indigo-50/60 to-purple-50 rounded-xl p-3 border border-purple-200/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-700 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <Brain className="w-4 h-4 text-purple-200" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-purple-950">
                      Train AI with Custom Ideas &amp; Cards
                    </span>
                    <span className="text-[10px] bg-purple-200 text-purple-800 font-bold px-1.5 py-0.2 rounded font-mono">
                      {activeIdeasCount} Active Ideas
                    </span>
                  </div>
                  <p className="text-[11px] text-purple-900/80 leading-snug">
                    Teach Gemini custom rig scenarios, specific equipment, and style. Gemini references them every time you generate cards.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('open_rig50_ai_training'))}
                className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 active:scale-[0.98] text-white text-xs font-bold rounded-lg shadow-2xs flex items-center gap-1.5 shrink-0 self-end sm:self-auto transition-all"
                title="Add new ideas, custom cards, or toggle active safety training themes"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                <span>+ Add Ideas / Open Studio</span>
              </button>
            </div>
          </div>

          {aiNotice && (
            <div className="p-2 bg-teal-50 border border-teal-200 text-teal-900 text-xs rounded-xl flex items-center gap-1.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
              <span>{aiNotice}</span>
            </div>
          )}

          {/* Actual Formatted Fields */}
          <div className="space-y-2 pt-1">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                Observation Text (Observing {observedRole})
              </label>
              <textarea
                rows={2}
                value={obsText}
                onChange={(e) => setObsText(e.target.value)}
                className="w-full p-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none leading-relaxed text-slate-900"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                Action Taken (Your Intervention / Praise)
              </label>
              <textarea
                rows={2}
                value={actionText}
                onChange={(e) => setActionText(e.target.value)}
                className="w-full p-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none leading-relaxed text-slate-900"
              />
            </div>
          </div>
        </div>

        {/* ERROR NOTICE IF ANY */}
        {latestError && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 space-y-2.5 animate-in fade-in">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="font-medium leading-relaxed">{latestError}</span>
            </div>

            {/* Direct Fallback Actions so crew is NEVER blocked */}
            <div className="pt-1 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="py-2 px-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-colors"
              >
                <span>🔄 Retry Submission Directly</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const cardDetails = `SOAR Card - Rig 50\nZone: ${zone}\nObserved: ${observedRole}\nType: ${assessment}\nObservation: ${obsText}\nAction: ${actionText}`;
                  navigator.clipboard?.writeText(cardDetails);
                  setAiNotice('✓ Card text copied to clipboard!');
                  setTimeout(() => setAiNotice(null), 3000);
                }}
                className="py-2 px-3 bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>📋 Copy Card Details</span>
              </button>
            </div>
          </div>
        )}

        {/* 5. BIG THUMB-FRIENDLY SUBMIT BUTTON */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full py-3.5 px-4 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 disabled:opacity-50 text-white font-bold text-sm sm:text-base rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Submitting to Rig 50 Forms...</span>
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              <span>Submit SOAR Card to Rig 50</span>
            </>
          )}
        </button>

        <div className="text-center">
          <p className="text-[11px] text-slate-400">
            Recorded in official Rig 50 Microsoft Forms database
          </p>
        </div>
      </div>

      {/* RECENT CARDS SUBMITTED FROM THIS PHONE */}
      {receipts.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Cards Submitted from this Phone ({receipts.length})</span>
            </h3>
            <span className="text-[11px] text-emerald-700 font-medium">✓ Online</span>
          </div>

          <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
            {receipts.map((rec) => (
              <div key={rec.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                <div className="truncate">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900">{rec.zone}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                      rec.assessment === 'Safe' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {rec.assessment}
                    </span>
                    {rec.obsType && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {rec.obsType === 'STOP Work Authority (SWA)' ? '🛑 SWA' : rec.obsType === 'Condition' ? '🛠️ Condition' : rec.obsType === 'Stop Work Authority Drill' ? '⏱️ SWA Drill' : '👁️ Behavior'}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 font-mono">#{rec.responseId}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate max-w-xs sm:max-w-sm">
                    {rec.observationSummary}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => downloadSoarPdf({
                    responseId: rec.responseId,
                    date: rec.date,
                    zone: rec.zone,
                    role: rec.observerRole,
                    name: rec.observerName.includes('Anonymous') ? '' : rec.observerName,
                    assessment: rec.assessment,
                    observation: rec.observationSummary,
                    action: 'Recorded and acknowledged in SOAR safety log.'
                  })}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold flex items-center gap-1 shrink-0"
                >
                  <Download className="w-3 h-3" />
                  <span>PDF</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FLOATING ACTION BUTTON FOR REVIEW QUEUE */}
      {submittedCardsHistory.length > 0 && !isSideDrawerOpen && (
        <button
          type="button"
          onClick={() => setIsSideDrawerOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-gradient-to-r from-teal-800 to-indigo-800 hover:from-teal-700 hover:to-indigo-700 text-white font-bold text-xs py-2.5 px-4 rounded-full shadow-xl border border-teal-600 flex items-center gap-2 transition-all cursor-pointer hover:scale-105 active:scale-95"
          title="Open submitted cards review drawer"
        >
          <Brain className="w-4 h-4 text-purple-300" />
          <span>Review Cards ({submittedCardsHistory.length})</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </button>
      )}

      {/* COLLAPSIBLE RIGHT SIDE DRAWER FOR SUBMITTED CARDS */}
      {isSideDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setIsSideDrawerOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-md w-full bg-white shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200 z-50">
            {/* Drawer Header */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-300">
                  <Brain className="w-4 h-4 text-purple-300" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight">Submitted Cards Review Queue</h3>
                  <p className="text-[11px] text-slate-300">
                    {submittedCardsHistory.length} Cards in Session · {isSupervisor ? 'Supervisor Actions Active' : 'Read-only Crew View'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsSideDrawerOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50">
              {submittedCardsHistory.length === 0 ? (
                <div className="text-center py-12 px-4 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
                    <FileText className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">No Cards Submitted Yet</h4>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                    Submit a SOAR card using Quick Submitter. It will automatically save here so you can review it and promote it to Train AI.
                  </p>
                </div>
              ) : (
                submittedCardsHistory.map((card, idx) => (
                  <div
                    key={card.id || idx}
                    className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs space-y-2.5 transition-all hover:border-slate-300"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                          #{card.responseId}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            card.assessment === 'Safe'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}
                        >
                          {card.assessment === 'Safe' ? '🟢 Safe' : '🔴 Unsafe'}
                        </span>
                        <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium border border-slate-200">
                          {card.obsType || 'Behavior'}
                        </span>
                      </div>

                      <span className="text-[10px] font-mono text-slate-400 shrink-0">
                        {card.time || card.date}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 font-medium">
                      <span>{card.zone}</span> · <span className="text-slate-800">{card.observedRole}</span>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 space-y-1.5 text-xs">
                      <div>
                        <span className="font-bold text-slate-700 text-[11px] block">Observation:</span>
                        <p className="text-slate-800 leading-relaxed">
                          {card.observation || card.observationSummary}
                        </p>
                      </div>
                      {card.action && (
                        <div>
                          <span className="font-bold text-slate-700 text-[11px] block">Corrective Action:</span>
                          <p className="text-slate-600 leading-relaxed">{card.action}</p>
                        </div>
                      )}
                    </div>

                    {/* Bottom Action: One-Click Add to Train AI (Supervisor Only) */}
                    <div className="flex items-center justify-between pt-1">
                      {isSupervisor ? (
                        card.addedToAiTraining ? (
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>✓ In Train AI Ideas</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handlePromoteCardToAiTraining(card)}
                            className="text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg border border-purple-200 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                            title="Add this card into the Supervisor AI Training ideas database"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                            <span>Add to Train AI (Ideas)</span>
                          </button>
                        )
                      ) : (
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                          <Lock className="w-3 h-3 text-slate-400" />
                          <span>AI Training restricted to Supervisor</span>
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => downloadSoarPdf({
                          responseId: card.responseId,
                          date: card.date,
                          zone: card.zone,
                          role: card.observerRole || 'Observer',
                          name: card.observerName && !card.observerName.includes('Anonymous') ? card.observerName : '',
                          assessment: card.assessment,
                          observation: card.observation || card.observationSummary,
                          action: card.action || ''
                        })}
                        className="text-[11px] text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        <span>PDF</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>{submittedCardsHistory.length} cards recorded</span>
              <button
                type="button"
                onClick={() => saveSubmittedHistory([])}
                className="text-slate-400 hover:text-rose-600 text-[11px] cursor-pointer"
              >
                Clear History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
