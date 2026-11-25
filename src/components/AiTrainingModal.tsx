import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Brain, 
  Sparkles, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Database, 
  Lightbulb, 
  X, 
  Tag, 
  Check, 
  Play, 
  Loader2, 
  BookOpen,
  Paperclip,
  FileSpreadsheet,
  Upload,
  AlertTriangle,
  RefreshCw,
  BarChart2,
  ShieldCheck,
  CheckCheck,
  Pause,
  Wand2,
  Edit3,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Search,
  StopCircle,
  Send,
  Layers,
  FolderKanban,
  Rocket
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  AiTrainingIdea, 
  AI_IDEA_CATEGORIES,
  getIdeaCategory,
  setIdeaCategoryInKeywords,
  getCleanIdeaKeywords,
  saveAiTrainingIdeaToFirestore, 
  saveBatchAiTrainingIdeasToFirestore,
  deleteAiTrainingIdeaFromFirestore,
  deleteBatchAiTrainingIdeasFromFirestore,
  clearAllAiTrainingIdeasFromFirestore,
  incrementIdeaUsageInFirestore,
  subscribeToAiTrainingIdeas
} from '../firebase';
import { RIG_50_ZONES, RIG_50_ROLES } from '../utils/aiCardGenerator';
import { RIG_50_NAME, USER_TENANT_ID, USER_OWNER_ID, USER_FORM_ID } from '../utils/defaultForm';
import {
  GeneratedSoarCard,
  convertAiTrainingIdeaToSoarCard,
  remakeCardWithAI
} from '../utils/operationsParser';
import { useSupervisor } from '../context/SupervisorAuthContext';

const QUICK_PRESETS = [
  {
    label: 'Hands-Free Tubulars',
    topic: 'Hands-Free Tubular Guiding',
    zone: 'Rig Floor',
    role: 'Floorman',
    assessment: 'Safe' as const,
    obsType: 'Behavior Observation',
    observation: 'Observed Floorman consistently using non-conductive push-pull sticks to guide drill pipe during tripping, keeping hands completely out of pinch points.',
    action: 'Recognized Floorman on-the-spot for 100% adherence to Hands-Free Policy; highlighted in shift debrief.',
    keywords: 'hands-free, push-pull stick, tubulars, pinch point'
  },
  {
    label: 'Secondary DROPS Pin',
    topic: 'Derrick Secondary DROPS Pins',
    zone: 'Derrick',
    role: 'Derrickman',
    assessment: 'Safe' as const,
    obsType: 'Condition',
    observation: 'Verified all overhead secondary retention safety pins, steel cable lanyards, and lock wire on the monkeyboard latch were 100% secured.',
    action: 'Confirmed condition integrity with Driller; logged positive DROPS inspection tag in daily shift log.',
    keywords: 'DROPS, secondary retention, safety pin, lanyard, monkeyboard'
  },
  {
    label: 'SWA Weather Limit',
    topic: 'SWA Weather Threshold & Gusts',
    zone: 'Cranes',
    role: 'Crane Operator',
    assessment: 'Safe' as const,
    obsType: 'STOP Work Authority (SWA)',
    observation: 'Noticed sea swell exceeding 2.5m and wind gusts reaching 28 knots during supply vessel cargo discharge; invoked Stop Work Authority (SWA) and halted crane lift.',
    action: 'Landed cargo basket safely on deck under SWA, secured slings, and briefed vessel captain to stand by until weather calmed.',
    keywords: 'SWA, Stop Work Authority, crane, supply vessel, wind limit, swell'
  },
  {
    label: 'Heat Stress Hydration',
    topic: 'Heat Stress & Shaded Breaks',
    zone: 'Mud Pit / Sack Room',
    role: 'Roustabout',
    assessment: 'Safe' as const,
    obsType: 'Behavior Observation',
    observation: 'Observed area supervisor enforcing mandatory shaded hydration breaks every 20 minutes and providing chilled electrolyte hydration packs during bulk barite mixing.',
    action: 'Ensured shaded rest station water cooler was stocked with fresh ice and electrolyte sachets; zero heat fatigue reported across shift.',
    keywords: 'heat stress, hydration, electrolyte, barite mixing, shaded break'
  },
  {
    label: 'Hydraulic Leak / SWA',
    topic: 'Hydraulic Flange Leak Intervention',
    zone: 'BOP',
    role: 'Assistant Driller',
    assessment: 'Unsafe' as const,
    obsType: 'Condition',
    observation: 'Noticed slight hydraulic fluid weeping from the 3,000 psi closing line flange connector on the annular preventer during pre-shift barrier integrity checks.',
    action: 'Exercised Stop Work Authority (SWA); depressurized line via Koomey unit, replaced O-ring seal, and verified pressure test before resuming.',
    keywords: 'BOP, hydraulic leak, flange, annular, Koomey unit, SWA'
  },
  {
    label: 'SWA Emergency Drill',
    topic: 'SWA Emergency Reaction Readiness Drill',
    zone: 'Rig Floor',
    role: 'Driller',
    assessment: 'Safe' as const,
    obsType: 'Stop Work Authority Drill',
    observation: 'Conducted an unannounced SWA emergency reaction drill while running drill collars to test crew alertness and emergency stop response time.',
    action: 'Drill crew halted all hoist movement within 3 seconds and acknowledged red hand signals flawlessly; commended crew for emergency alertness.',
    keywords: 'SWA drill, reaction time, emergency stop, drill collars, readiness'
  }
];

interface ParsedRawRow {
  rawObservation: string;
  rawAction: string;
  rawZone?: string;
  rawRole?: string;
  rawCategory?: string;
  rawObsType?: string;
  rawRigName?: string;
}

interface StagedImportIdea {
  tempId: string;
  selected: boolean;
  editing: boolean;
  before: ParsedRawRow;
  topic: string;
  zone: string;
  role: string;
  assessment: 'Safe' | 'Unsafe';
  obsType: string;
  observation: string;
  action: string;
  keywords: string;
  similarityScore: number;
  matchedTopic?: string;
  repolishing?: boolean;
}

/**
 * Tokenizes text into normalized meaningful words and bigrams for similarity comparison
 */
function extractMeaningfulTokens(text: string): Set<string> {
  const stopWords = new Set([
    'the', 'and', 'for', 'with', 'that', 'this', 'from', 'were', 'was', 'observed',
    'during', 'while', 'routine', 'operations', 'shift', 'crew', 'member', 'area',
    'into', 'onto', 'upon', 'have', 'been', 'rig', 'bob', 'palmer', 'rbp', '50a',
    'immediately', 'reported', 'ensured', 'verified', 'safe', 'unsafe', 'work'
  ]);
  const words = (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  const tokens = new Set<string>(words);
  for (let i = 0; i < words.length - 1; i++) {
    tokens.add(`${words[i]}_${words[i + 1]}`);
  }
  return tokens;
}

/**
 * Computes similarity percentage (0 - 100) between a candidate idea and existing ideas
 */
function findHighestSimilarityMatch(
  candidate: { topic: string; observation: string; keywords?: string },
  existingList: Array<{ id?: string; topic: string; observation: string; keywords?: string }>,
  excludeId?: string
): { score: number; matchedTopic?: string } {
  const candText = `${candidate.topic || ''} ${candidate.observation || ''} ${candidate.keywords || ''}`.trim();
  if (candText.length < 10 || existingList.length === 0) return { score: 0 };

  const candTokens = extractMeaningfulTokens(candText);
  if (candTokens.size === 0) return { score: 0 };

  const candNormObs = (candidate.observation || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const candNormTopic = (candidate.topic || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  let maxScore = 0;
  let matchedTopic: string | undefined;

  for (const item of existingList) {
    if (excludeId && item.id === excludeId) continue;

    const exNormObs = (item.observation || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const exNormTopic = (item.topic || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    if (candNormObs.length > 20 && candNormObs === exNormObs) {
      return { score: 100, matchedTopic: item.topic };
    }
    if (candNormTopic.length > 10 && candNormTopic === exNormTopic && candNormObs.slice(0, 40) === exNormObs.slice(0, 40)) {
      return { score: 95, matchedTopic: item.topic };
    }

    const exTokens = extractMeaningfulTokens(`${item.topic || ''} ${item.observation || ''} ${item.keywords || ''}`);
    if (exTokens.size === 0) continue;

    let intersection = 0;
    candTokens.forEach(t => {
      if (exTokens.has(t)) intersection++;
    });

    const union = candTokens.size + exTokens.size - intersection;
    const jaccard = union > 0 ? intersection / union : 0;
    const containment = Math.min(candTokens.size, exTokens.size) > 0
      ? intersection / Math.min(candTokens.size, exTokens.size)
      : 0;

    const combinedRatio = (jaccard * 0.55) + (containment * 0.45);
    const pct = Math.min(99, Math.round(combinedRatio * 100));

    if (pct > maxScore) {
      maxScore = pct;
      matchedTopic = item.topic;
    }
  }

  return { score: maxScore, matchedTopic };
}

/**
 * Conceptual client-side synthesizer fallback if network drops.
 * Extracts the operational safety concept and writes a clean, original Rig 50 exemplar
 * without wrapping raw text in quotes or copying broken phrasing.
 */
function clientConceptualSynthesize(row: ParsedRawRow) {
  const rawObs = (row.rawObservation || '').replace(/^[\u200B-\u200D\uFEFF]+/, '').trim();
  const rawAct = (row.rawAction || '').replace(/^[\u200B-\u200D\uFEFF]+/, '').trim();
  const lower = `${rawObs} ${rawAct} ${row.rawZone || ''} ${row.rawRole || ''}`.toLowerCase();

  let zone = 'Main Deck';
  if (lower.includes('pipe deck') || lower.includes('cantilever') || lower.includes('catwalk')) zone = 'Cantilever / Pipe Deck';
  else if (lower.includes('bop') || lower.includes('wellhead') || lower.includes('substructure')) zone = 'BOP';
  else if (lower.includes('crane') || lower.includes('lifting') || lower.includes('boat')) zone = 'Cranes';
  else if (lower.includes('derrick') || lower.includes('monkeyboard')) zone = 'Derrick';
  else if (lower.includes('shaker') || lower.includes('flowline')) zone = 'Shakers';
  else if (lower.includes('mud pit') || lower.includes('sack') || lower.includes('pump room') || lower.includes('bug blower')) zone = 'Mud Pit / Sack Room';
  else if (lower.includes('accommodation') || lower.includes('top deck') || lower.includes('billy pugh')) zone = 'Accommodations';
  else if (lower.includes('rig floor') || lower.includes('rotary') || lower.includes('top drive') || lower.includes('roughneck')) zone = 'Rig Floor';
  else if (row.rawZone && RIG_50_ZONES.includes(row.rawZone)) zone = row.rawZone;

  let role = 'Floorman';
  if (lower.includes('rsc') || lower.includes('safety coach')) role = 'Rig Safety Coach (RSC)';
  else if (lower.includes('hse')) role = 'HSE Specialist';
  else if (lower.includes('crane')) role = 'Crane Operator';
  else if (lower.includes('assistant driller') || lower.includes(' ad ')) role = 'Assistant Driller';
  else if (lower.includes('driller')) role = 'Driller';
  else if (lower.includes('derrick')) role = 'Derrickman';
  else if (lower.includes('electrician') || lower.includes('scr') || lower.includes('grounding')) role = 'Electrician';
  else if (lower.includes('mechanic') || lower.includes('motor')) role = 'Mechanic';
  else if (lower.includes('roustabout') || lower.includes('sling') || lower.includes('paint')) role = 'Roustabout';
  else if (row.rawRole && RIG_50_ROLES.includes(row.rawRole)) role = row.rawRole;

  const isUnsafe = (row.rawCategory?.toLowerCase().includes('unsafe') ?? false) ||
    lower.includes('missing') || lower.includes('disconnected') || lower.includes('unattended') ||
    lower.includes('poor condition') || lower.includes('poor housekeeping') || lower.includes('uncovered') ||
    lower.includes('frayed') || lower.includes('unsafe') || lower.includes('leak') || lower.includes('hazard') ||
    lower.includes('no ptw');
  const assessment: 'Safe' | 'Unsafe' = isUnsafe ? 'Unsafe' : 'Safe';

  let obsType = 'Condition';
  if (row.rawObsType && ['STOP Work Authority (SWA)', 'Behavior Observation', 'Condition', 'Stop Work Authority Drill'].includes(row.rawObsType)) {
    obsType = row.rawObsType;
  } else if (lower.includes('swa') || lower.includes('stop work') || lower.includes('no ptw')) {
    obsType = 'STOP Work Authority (SWA)';
  } else if (lower.includes('signal') || lower.includes('communication') || lower.includes('hand free') || lower.includes('hands-free') || lower.includes('red zone')) {
    obsType = 'Behavior Observation';
  }

  if (lower.includes('billy pugh') || (lower.includes('basket') && lower.includes('cover'))) {
    return {
      topic: 'Billy Pugh Personnel Basket Weather Cover Integrity',
      zone: 'Accommodations',
      role: 'Rig Safety Coach (RSC)',
      assessment: 'Unsafe' as const,
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
      assessment: 'Unsafe' as const,
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
      assessment: 'Unsafe' as const,
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
      assessment: 'Unsafe' as const,
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
      assessment: 'Unsafe' as const,
      obsType: 'STOP Work Authority (SWA)',
      observation: 'Observed an open SCR electrical cabinet with a temporary power cable routed to an unattended portable pump on the deck floor without an active Permit to Work (PTW) or isolation tag.',
      action: 'Exercised Stop Work Authority (SWA), coordinated with the Maintenance Supervisor to de-energize and remove the unauthorized pump, secured the SCR panel door, and reinforced PTW electrical isolation rules.',
      keywords: 'SCR panel, Permit to Work, PTW, electrical isolation, unattended pump, SWA'
    };
  }

  const cleanedClause = rawObs
    .replace(/^(today\s+)?i\s+(observed|saw|found|noticed)\s+(that\s+)?/i, '')
    .replace(/^observe(d)?\s+/i, '')
    .replace(/["“”]/g, '')
    .replace(/\.\s*$/, '')
    .trim();

  const words = cleanedClause
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !['that', 'with', 'were', 'found', 'from', 'this', 'have', 'been', 'during', 'while', 'observed', 'work', 'good', 'safe', 'make', 'sure'].includes(w.toLowerCase()));

  const keyTerms = Array.from(new Set(words.slice(0, 5)));
  const topicWords = keyTerms.slice(0, 4).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  const topic = topicWords.length >= 6
    ? `${topicWords} ${assessment === 'Unsafe' ? 'Hazard Control' : 'Compliance'}`
    : `${zone} ${role} ${assessment === 'Unsafe' ? 'Barrier Intervention' : 'Safety Verification'}`;

  const cleanObs = assessment === 'Unsafe'
    ? `During operational safety walkthrough in ${zone}, identified an unsafe condition involving ${cleanedClause.length > 12 ? cleanedClause.charAt(0).toLowerCase() + cleanedClause.slice(1) : `${role} work area equipment barriers`}, requiring immediate corrective intervention.`
    : `During shift operations in ${zone}, observed ${role} maintaining proactive safety compliance and procedural discipline while ${cleanedClause.length > 12 ? cleanedClause.charAt(0).toLowerCase() + cleanedClause.slice(1) : 'executing critical rig tasks with full barrier controls'}.`;

  const cleanAct = rawAct.length > 25
    ? rawAct.replace(/^(today\s+)?i\s+(immediately\s+)?(reported|informed|told|did)\s+/i, 'Reported ').replace(/["“”]/g, '').trim()
    : (assessment === 'Unsafe'
      ? `Intervened immediately under Stop Work Authority (SWA), rectified the condition alongside the ${role} and area supervisor, and reviewed safe barrier controls during the shift safety briefing.`
      : `Commended the ${role} on-the-spot for exemplary adherence to Rig 50 safety standards and shared the positive practice during shift handover.`);

  return {
    topic: topic.slice(0, 140),
    zone,
    role,
    assessment,
    obsType,
    observation: cleanObs.slice(0, 1900),
    action: cleanAct.slice(0, 1900),
    keywords: [zone.toLowerCase(), role.toLowerCase(), ...keyTerms.map(k => k.toLowerCase()), 'rig 50'].slice(0, 6).join(', ')
  };
}

interface AiTrainingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AiTrainingModal: React.FC<AiTrainingModalProps> = ({ isOpen, onClose }) => {
  const { isSupervisor } = useSupervisor();
  const [ideas, setIdeas] = useState<AiTrainingIdea[]>([]);
  const [activeTab, setActiveTab] = useState<'library' | 'recreated' | 'importer' | 'analytics'>('library');
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [savingIdea, setSavingIdea] = useState<boolean>(false);
  const [isPolishingFormDraft, setIsPolishingFormDraft] = useState<boolean>(false);
  const [overrideDuplicateWarning, setOverrideDuplicateWarning] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Deletion & Multi-Select state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedIdeaIds, setSelectedIdeaIds] = useState<Set<string>>(new Set());
  const [isDeletingBatch, setIsDeletingBatch] = useState<boolean>(false);
  const [isConfirmingClearAll, setIsConfirmingClearAll] = useState<boolean>(false);

  // One-Click AI Re-Polish state on existing idea cards
  const [repolishingIdeaId, setRepolishingIdeaId] = useState<string | null>(null);

  // Search, Category & Status Filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'paused' | 'from_block'>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [filterAssessment, setFilterAssessment] = useState<'ALL' | 'Safe' | 'Unsafe'>('ALL');
  const [bulkCategoryValue, setBulkCategoryValue] = useState<string>(AI_IDEA_CATEGORIES[0]);

  // Card Bank Direct Re-Submission & AI Recreation state
  const [bankSubmitDate, setBankSubmitDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [bankRecreateInstruction, setBankRecreateInstruction] = useState<string>('');
  const [isSubmittingBank, setIsSubmittingBank] = useState<boolean>(false);
  const [bankSubmitProgress, setBankSubmitProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [submittedBankIdeaIds, setSubmittedBankIdeaIds] = useState<Set<string>>(new Set());
  const abortBankSubmitRef = useRef<boolean>(false);

  // Recreated New Submissions Deck state
  const [recreatedDeck, setRecreatedDeck] = useState<(GeneratedSoarCard & { sourceIdeaId?: string; categoryGroup?: string })[]>([]);
  const [selectedRecreatedIds, setSelectedRecreatedIds] = useState<Set<string>>(new Set());
  const [isRecreatingFromBank, setIsRecreatingFromBank] = useState<boolean>(false);
  const [recreateProgress, setRecreateProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [remakingRecreatedId, setRemakingRecreatedId] = useState<string | null>(null);
  const [editingRecreatedId, setEditingRecreatedId] = useState<string | null>(null);
  const [editRecreatedForm, setEditRecreatedForm] = useState<{
    observation: string;
    action: string;
    zone: string;
    role: string;
    assessment: 'Safe' | 'Unsafe';
    obsType: string;
  } | null>(null);
  const [submittedRecreatedIds, setSubmittedRecreatedIds] = useState<Set<string>>(new Set());

  // Form fields
  const [topic, setTopic] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>(AI_IDEA_CATEGORIES[0]);
  const [zone, setZone] = useState<string>('Rig Floor');
  const [role, setRole] = useState<string>('Floorman');
  const [assessment, setAssessment] = useState<'Safe' | 'Unsafe'>('Safe');
  const [obsType, setObsType] = useState<string>('Behavior Observation');
  const [observation, setObservation] = useState<string>('');
  const [action, setAction] = useState<string>('');
  const [keywords, setKeywords] = useState<string>('');

  // AI Test Preview state
  const [testingIdeaId, setTestingIdeaId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [isTestingAi, setIsTestingAi] = useState<boolean>(false);

  // Spreadsheet Importer & Pre-Import Review Table state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  const [detectedHeaderInfo, setDetectedHeaderInfo] = useState<string>('');
  const [parsedRawRows, setParsedRawRows] = useState<ParsedRawRow[]>([]);
  const [batchSizeToElevate, setBatchSizeToElevate] = useState<number>(50);
  const [isParsingFile, setIsParsingFile] = useState<boolean>(false);
  const [isElevatingWithGemini, setIsElevatingWithGemini] = useState<boolean>(false);
  const [elevationProgressText, setElevationProgressText] = useState<string>('');
  const [elevationProgressPercent, setElevationProgressPercent] = useState<number>(0);
  const cancelElevationRef = useRef<boolean>(false);
  const [stagedImportIdeas, setStagedImportIdeas] = useState<StagedImportIdea[]>([]);
  const [isSavingStagedBatch, setIsSavingStagedBatch] = useState<boolean>(false);
  const [stagedPage, setStagedPage] = useState<number>(1);
  const stagedPageSize = 20;
  const [stagedSearch, setStagedSearch] = useState<string>('');

  // Subscribe to ideas from Firestore Database
  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    const unsubscribe = subscribeToAiTrainingIdeas((loadedIdeas) => {
      if (loadedIdeas && loadedIdeas.length > 0) {
        setIdeas(loadedIdeas);
        setIsLoading(false);
      } else {
        fetch('/api/training-ideas')
          .then(res => res.json())
          .then(data => {
            if (data.success && Array.isArray(data.ideas) && data.ideas.length > 0) {
              setIdeas(data.ideas);
            } else {
              setIdeas(loadedIdeas || []);
            }
          })
          .catch(() => {
            setIdeas(loadedIdeas || []);
          })
          .finally(() => {
            setIsLoading(false);
          });
      }
    });
    return () => unsubscribe();
  }, [isOpen]);

  // Real-time Smart Duplicate & Similarity Check for the manual Add New Idea form
  const formSimilarityCheck = useMemo(() => {
    if (!isAddingNew || (!topic.trim() && !observation.trim())) {
      return { score: 0, matchedTopic: undefined };
    }
    return findHighestSimilarityMatch({ topic, observation, keywords }, ideas);
  }, [isAddingNew, topic, observation, keywords, ideas]);

  useEffect(() => {
    setOverrideDuplicateWarning(false);
  }, [topic, observation]);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const filteredStagedIdeas = useMemo(() => {
    if (!stagedSearch.trim()) return stagedImportIdeas;
    const q = stagedSearch.toLowerCase();
    return stagedImportIdeas.filter(s =>
      s.topic.toLowerCase().includes(q) ||
      s.observation.toLowerCase().includes(q) ||
      s.zone.toLowerCase().includes(q) ||
      s.role.toLowerCase().includes(q) ||
      s.keywords.toLowerCase().includes(q)
    );
  }, [stagedImportIdeas, stagedSearch]);

  const totalStagedPages = Math.max(1, Math.ceil(filteredStagedIdeas.length / stagedPageSize));
  const currentStagedSlice = useMemo(() => {
    const start = (stagedPage - 1) * stagedPageSize;
    return filteredStagedIdeas.slice(start, start + stagedPageSize);
  }, [filteredStagedIdeas, stagedPage, stagedPageSize]);

  // Category counts across all ideas in database (called unconditionally before early return)
  const categoryBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    AI_IDEA_CATEGORIES.forEach(c => {
      counts[c] = 0;
    });
    ideas.forEach(idea => {
      const cat = getIdeaCategory(idea);
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [ideas]);

  const allCategoryNames = useMemo(() => {
    const extra = Object.keys(categoryBreakdown).filter(
      k => !(AI_IDEA_CATEGORIES as readonly string[]).includes(k) && categoryBreakdown[k] > 0
    );
    return [...AI_IDEA_CATEGORIES, ...extra];
  }, [categoryBreakdown]);

  if (!isOpen || !isSupervisor) return null;

  const totalCount = ideas.length;
  const activeCount = ideas.filter(i => i.isActive !== false).length;
  const pausedCount = totalCount - activeCount;
  const completionPercent = totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0;
  const totalAiGenerationsInfluenced = ideas.reduce((acc, item) => acc + (item.usageCount || 0), 0);

  const handleBulkToggle = async (targetActive: boolean) => {
    const targets = ideas.filter(i => (i.isActive !== false) !== targetActive);
    if (targets.length === 0) return;

    const updatedAll = ideas.map(i => ({ ...i, isActive: targetActive }));
    setIdeas(updatedAll);
    await saveBatchAiTrainingIdeasToFirestore(updatedAll);
    showToast(`${targetActive ? 'Activated all' : 'Paused all'} ${targets.length} training ideas in Firestore.`);
  };

  /**
   * Multi-Row PowerBI & Excel Header Scanner
   * Scans the first 25 rows of a 2D sheet matrix to locate the true header row
   * (skipping PowerBI filter banners like "Applied filters: 'DIM_CALENDAR'[Date]...")
   */
  const parseSpreadsheetBuffer = (buffer: ArrayBuffer, sourceName: string) => {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];

    const matrix = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
    if (!matrix || matrix.length === 0) {
      showToast('Spreadsheet contains no data rows.');
      return;
    }

    // Score the first 25 rows to find the true column header row
    let bestHeaderRowIdx = 0;
    let bestScore = -1;

    const maxScanRows = Math.min(matrix.length, 25);
    for (let r = 0; r < maxScanRows; r++) {
      const rowCells = (matrix[r] || []).map(c => String(c || '').trim().toLowerCase());
      const nonEmptyCount = rowCells.filter(Boolean).length;
      if (nonEmptyCount < 2) continue;

      let score = 0;
      for (const cell of rowCells) {
        if (cell.includes('describe the unsafe') || cell.includes('unsafe condition observed')) score += 6;
        else if (cell.includes('describe the action') || cell.includes('action taken')) score += 6;
        else if (cell.includes('observation area') || cell.includes('observation type')) score += 4;
        else if (cell.includes('risk status') || cell.includes('your job role')) score += 4;
        else if (cell === 'observation' || cell === 'action' || cell === 'zone' || cell === 'role' || cell === 'assessment') score += 3;
        else if (cell.includes('observ') || cell.includes('finding') || cell.includes('hazard') || cell.includes('description')) score += 2;
        else if (cell.includes('action') || cell.includes('corrective')) score += 2;
      }

      if (score > bestScore) {
        bestScore = score;
        bestHeaderRowIdx = r;
      }
    }

    const headers = (matrix[bestHeaderRowIdx] || []).map((h, i) => String(h || `col_${i}`).trim());

    // Identify column indices from the detected header row
    let obsColIdx = -1;
    let actColIdx = -1;
    let zoneColIdx = -1;
    let roleColIdx = -1;
    let obsTypeColIdx = -1;
    let statusColIdx = -1;
    let rigColIdx = -1;

    headers.forEach((h, idx) => {
      const lower = h.toLowerCase();
      if (lower.includes('describe the unsafe') || lower.includes('unsafe condition') || lower === 'observation' || lower === 'observation description') {
        obsColIdx = idx;
      } else if (obsColIdx === -1 && (lower.includes('finding') || lower.includes('hazard') || lower.includes('what happened') || lower.includes('description'))) {
        obsColIdx = idx;
      }

      if (lower.includes('describe the action') || lower.includes('action taken') || lower === 'action' || lower.includes('corrective')) {
        actColIdx = idx;
      }

      if (lower.includes('observation area') || lower === 'zone' || lower.includes('location') || lower.includes('area')) {
        zoneColIdx = idx;
      }

      if (lower.includes('your job role') || lower === 'role' || lower.includes('position')) {
        roleColIdx = idx;
      }

      if (lower.includes('observation type') || lower === 'obstype') {
        obsTypeColIdx = idx;
      }

      if (lower.includes('risk status') || lower === 'assessment' || lower === 'status') {
        statusColIdx = idx;
      }

      if (lower === 'rig' || lower.includes('rig name') || lower.includes('vessel')) {
        rigColIdx = idx;
      }
    });

    const extracted: ParsedRawRow[] = [];
    const seenNormalizedObs = new Set<string>();

    for (let r = bestHeaderRowIdx + 1; r < matrix.length; r++) {
      const row = matrix[r];
      if (!row || !Array.isArray(row)) continue;

      let rawObservation = obsColIdx >= 0 ? String(row[obsColIdx] || '').trim() : '';
      let rawAction = actColIdx >= 0 ? String(row[actColIdx] || '').trim() : '';
      const rawZone = zoneColIdx >= 0 ? String(row[zoneColIdx] || '').trim() : '';
      const rawRole = roleColIdx >= 0 ? String(row[roleColIdx] || '').trim() : '';
      const rawObsType = obsTypeColIdx >= 0 ? String(row[obsTypeColIdx] || '').trim() : '';
      const rawCategory = statusColIdx >= 0 ? String(row[statusColIdx] || '').trim() : '';
      const rawRigName = rigColIdx >= 0 ? String(row[rigColIdx] || '').trim() : '';

      // If no explicit observation column matched, pick the longest narrative column that isn't the rig name
      if (!rawObservation) {
        for (let c = 0; c < row.length; c++) {
          if (c === rigColIdx || c === zoneColIdx || c === roleColIdx) continue;
          const cellVal = String(row[c] || '').trim();
          if (cellVal.length > 22 && !cellVal.includes('50 Bob Palmer') && !cellVal.includes('Applied filters')) {
            rawObservation = cellVal;
            break;
          }
        }
      }

      // Skip invalid, empty, or metadata rows
      if (
        !rawObservation ||
        rawObservation.length < 8 ||
        rawObservation.toLowerCase().includes('applied filters') ||
        rawObservation.toLowerCase() === '50 bob palmer (rbp-50a)'
      ) {
        continue;
      }

      // Deduplicate identical or near-identical observations in the spreadsheet
      const normKey = rawObservation.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 90);
      if (normKey.length < 6 || seenNormalizedObs.has(normKey)) {
        continue;
      }
      seenNormalizedObs.add(normKey);

      extracted.push({
        rawObservation,
        rawAction,
        rawZone,
        rawRole,
        rawObsType,
        rawCategory,
        rawRigName
      });
    }

    setAttachedFileName(sourceName);
    setDetectedHeaderInfo(
      `Detected Header at Row #${bestHeaderRowIdx + 1} (${headers.filter(Boolean).slice(0, 6).join(' · ')}) — ${extracted.length} unique safety observations extracted.`
    );
    setParsedRawRows(extracted);
    setStagedImportIdeas([]);

    if (extracted.length > 0) {
      showToast(`Parsed ${extracted.length} unique observations from "${sourceName}" (Header Row #${bestHeaderRowIdx + 1}).`);
    } else {
      showToast('No valid observation rows detected in sheet. Please check the file columns.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingFile(true);
    setParsedRawRows([]);
    setStagedImportIdeas([]);

    try {
      const buffer = await file.arrayBuffer();
      parseSpreadsheetBuffer(buffer, file.name);
    } catch (err: any) {
      console.error('Failed to parse file:', err);
      showToast('Error reading spreadsheet: ' + (err.message || 'Unknown format'));
    } finally {
      setIsParsingFile(false);
    }
  };

  // Load the user's attached PowerBI SOAR export directly from /assets/aistudio/data_84fd31ad
  const handleLoadAttachedPowerBiReport = async () => {
    setIsParsingFile(true);
    setParsedRawRows([]);
    setStagedImportIdeas([]);

    try {
      const res = await fetch('/assets/aistudio/data_84fd31ad');
      if (!res.ok) throw new Error('Attached report file could not be loaded');
      const buffer = await res.arrayBuffer();
      parseSpreadsheetBuffer(buffer, 'PowerBI_Rig50_SOAR_Export_2026.csv');
    } catch (err: any) {
      showToast('Could not load attached PowerBI export: ' + (err.message || 'Error'));
    } finally {
      setIsParsingFile(false);
    }
  };

  /**
   * Elevates raw rows with Gemini AI and stages them in the Pre-Import Review Table
   * (with automatic similarity & duplicate checking against Firestore)
   */
  const handleElevateToReviewTable = async () => {
    if (parsedRawRows.length === 0) return;

    setIsElevatingWithGemini(true);
    cancelElevationRef.current = false;
    setElevationProgressPercent(0);
    const targetRows = parsedRawRows.slice(0, batchSizeToElevate);
    setElevationProgressText(`Analyzing & elevating ${targetRows.length} unique concepts with Gemini AI...`);

    const staged: StagedImportIdea[] = [];
    const BATCH_SIZE = 10;
    const totalBatches = Math.ceil(targetRows.length / BATCH_SIZE);

    try {
      for (let b = 0; b < totalBatches; b++) {
        if (cancelElevationRef.current) {
          showToast(`Elevation stopped by user. Staged ${staged.length} processed concepts.`);
          break;
        }

        const batchItems = targetRows.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
        const percent = Math.round((b / totalBatches) * 100);
        setElevationProgressPercent(percent);
        setElevationProgressText(
          `Batch ${b + 1} of ${totalBatches} (${percent}%): Elevating concepts ${b * BATCH_SIZE + 1} to ${Math.min((b + 1) * BATCH_SIZE, targetRows.length)} of ${targetRows.length}...`
        );

        let batchImproved: any[] = [];
        try {
          const response = await fetch('/api/improve-and-import-training-ideas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: batchItems })
          });

          if (response.ok) {
            const parsedData = await response.json();
            if (parsedData && Array.isArray(parsedData.ideas) && parsedData.ideas.length > 0) {
              batchImproved = parsedData.ideas;
            }
          }
        } catch (netErr) {
          console.warn('Chunk elevation network notice, using conceptual synthesizer:', netErr);
        }

        if (batchImproved.length === 0) {
          batchImproved = batchItems.map(clientConceptualSynthesize);
        }

        for (let idx = 0; idx < batchItems.length; idx++) {
          const originalRaw = batchItems[idx];
          const improved = batchImproved[idx] || clientConceptualSynthesize(originalRaw);

          const candidate = {
            topic: String(improved.topic || 'Rig 50 Safety Concept').slice(0, 140),
            zone: improved.zone || 'Rig Floor',
            role: improved.role || 'Floorman',
            assessment: (improved.assessment === 'Unsafe' ? 'Unsafe' : 'Safe') as 'Safe' | 'Unsafe',
            obsType: improved.obsType || 'Condition',
            observation: String(improved.observation || '').slice(0, 1950),
            action: String(improved.action || '').slice(0, 1950),
            keywords: String(improved.keywords || 'rig 50, safety barrier').slice(0, 480)
          };

          // Compare against existing Firestore ideas + already staged rows in this batch
          const comparisonPool = [
            ...ideas,
            ...staged.map(s => ({ topic: s.topic, observation: s.observation, keywords: s.keywords }))
          ];
          const sim = findHighestSimilarityMatch(candidate, comparisonPool);
          const isDuplicateOrSimilar = sim.score >= 70;

          staged.push({
            tempId: `stage_${Date.now()}_${b}_${idx}`,
            selected: !isDuplicateOrSimilar, // Automatically uncheck duplicates
            editing: false,
            before: originalRaw,
            ...candidate,
            similarityScore: sim.score,
            matchedTopic: sim.matchedTopic
          });
        }
      }

      setStagedImportIdeas(staged);
      setStagedPage(1);
      setElevationProgressPercent(100);
      const approvedCount = staged.filter(s => s.selected).length;
      const blockedCount = staged.length - approvedCount;
      showToast(
        `AI elevated ${staged.length} ideas for review (${approvedCount} unique pre-selected, ${blockedCount} similar/duplicates flagged).`
      );
    } catch (err: any) {
      console.warn('Batch elevation notice:', err);
      if (staged.length > 0) {
        setStagedImportIdeas(staged);
        setStagedPage(1);
      }
    } finally {
      setIsElevatingWithGemini(false);
      setElevationProgressText('');
    }
  };

  // Re-polish a single staged row in the Pre-Import Review Table
  const handleRepolishStagedRow = async (tempId: string) => {
    const row = stagedImportIdeas.find(s => s.tempId === tempId);
    if (!row) return;

    setStagedImportIdeas(prev => prev.map(s => s.tempId === tempId ? { ...s, repolishing: true } : s));
    try {
      const res = await fetch('/api/repolish-training-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea: {
            topic: row.topic,
            zone: row.zone,
            role: row.role,
            assessment: row.assessment,
            obsType: row.obsType,
            observation: row.observation,
            action: row.action,
            keywords: row.keywords
          }
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.idea) {
          const updated = data.idea;
          const sim = findHighestSimilarityMatch(updated, ideas);
          setStagedImportIdeas(prev =>
            prev.map(s =>
              s.tempId === tempId
                ? {
                    ...s,
                    topic: updated.topic || s.topic,
                    zone: updated.zone || s.zone,
                    role: updated.role || s.role,
                    assessment: updated.assessment || s.assessment,
                    obsType: updated.obsType || s.obsType,
                    observation: updated.observation || s.observation,
                    action: updated.action || s.action,
                    keywords: updated.keywords || s.keywords,
                    similarityScore: sim.score,
                    matchedTopic: sim.matchedTopic,
                    repolishing: false
                  }
                : s
            )
          );
          showToast(`Re-polished staged idea "${updated.topic}" with Gemini AI.`);
          return;
        }
      }
    } catch (e) {
      console.warn('Staged re-polish error:', e);
    }
    setStagedImportIdeas(prev => prev.map(s => s.tempId === tempId ? { ...s, repolishing: false } : s));
  };

  // Save only the checked/approved rows from the Pre-Import Review Table to Firestore
  const handleSaveApprovedStagedIdeas = async () => {
    const approved = stagedImportIdeas.filter(s => s.selected);
    if (approved.length === 0) {
      showToast('Select at least one idea in the review table to save.');
      return;
    }

    setIsSavingStagedBatch(true);
    try {
      const nowIso = new Date().toISOString();
      const newDocs: AiTrainingIdea[] = approved.map((item, idx) => ({
        id: `idea_imp_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        topic: item.topic.trim().slice(0, 140),
        zone: item.zone,
        role: item.role,
        assessment: item.assessment,
        obsType: item.obsType,
        observation: item.observation.trim().slice(0, 1950),
        action: item.action.trim().slice(0, 1950),
        keywords: item.keywords.trim().slice(0, 480),
        isActive: true,
        usageCount: 0,
        lastUsedAt: nowIso,
        createdAt: nowIso
      }));

      const ok = await saveBatchAiTrainingIdeasToFirestore(newDocs);
      if (ok) {
        showToast(`Saved ${newDocs.length} approved AI Training Ideas to Firestore Database!`);
        setStagedImportIdeas([]);
        setActiveTab('library');
      }
    } finally {
      setIsSavingStagedBatch(false);
    }
  };

  // One-Click AI Re-Polish for any existing saved Training Idea in Firestore
  const handleRepolishExistingIdea = async (idea: AiTrainingIdea) => {
    setRepolishingIdeaId(idea.id);
    try {
      const res = await fetch('/api/repolish-training-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.idea) {
          const updatedIdea: AiTrainingIdea = {
            ...idea,
            topic: data.idea.topic || idea.topic,
            zone: data.idea.zone || idea.zone,
            role: data.idea.role || idea.role,
            assessment: data.idea.assessment || idea.assessment,
            obsType: data.idea.obsType || idea.obsType,
            observation: data.idea.observation || idea.observation,
            action: data.idea.action || idea.action,
            keywords: data.idea.keywords || idea.keywords
          };
          await saveAiTrainingIdeaToFirestore(updatedIdea);
          showToast(`AI Re-Polished "${updatedIdea.topic}" and updated in Firestore!`);
        }
      }
    } catch (err) {
      console.warn('Error re-polishing idea:', err);
      showToast('Could not re-polish idea right now.');
    } finally {
      setRepolishingIdeaId(null);
    }
  };

  // Polish draft inside the manual Add New Idea form before saving
  const handlePolishManualFormDraft = async () => {
    if (!observation.trim() && !topic.trim()) return;
    setIsPolishingFormDraft(true);
    try {
      const res = await fetch('/api/repolish-training-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea: {
            topic: topic || 'Rig 50 Safety Concept',
            zone,
            role,
            assessment,
            obsType,
            observation: observation || topic,
            action: action || 'Intervene and verify safety barriers.',
            keywords
          }
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.idea) {
          setTopic(data.idea.topic || topic);
          setZone(data.idea.zone || zone);
          setRole(data.idea.role || role);
          setAssessment(data.idea.assessment || assessment);
          setObsType(data.idea.obsType || obsType);
          setObservation(data.idea.observation || observation);
          setAction(data.idea.action || action);
          setKeywords(data.idea.keywords || keywords);
          showToast('Gemini AI elevated your draft into a Rig 50 exemplar!');
        }
      }
    } catch (e) {
      console.warn('Form draft polish notice:', e);
    } finally {
      setIsPolishingFormDraft(false);
    }
  };

  const handleSaveIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || !observation.trim() || !action.trim()) return;

    // Smart Duplicate & Similarity Blocker check
    if (formSimilarityCheck.score >= 70 && !overrideDuplicateWarning) {
      showToast(`Blocked duplicate (${formSimilarityCheck.score}% similar to "${formSimilarityCheck.matchedTopic}"). Edit or check override.`);
      return;
    }

    setSavingIdea(true);
    const nowIso = new Date().toISOString();
    const encodedKeywords = setIdeaCategoryInKeywords(keywords.trim(), formCategory);
    const newIdea: AiTrainingIdea = {
      id: `idea_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      topic: topic.trim(),
      zone,
      role,
      assessment,
      obsType,
      observation: observation.trim(),
      action: action.trim(),
      keywords: encodedKeywords,
      isActive: true,
      usageCount: 0,
      lastUsedAt: nowIso,
      createdAt: nowIso
    };

    const ok = await saveAiTrainingIdeaToFirestore(newIdea);
    setSavingIdea(false);
    if (ok) {
      showToast(`Training idea "${topic.trim()}" saved under category "${formCategory}"!`);
      setTopic('');
      setObservation('');
      setAction('');
      setKeywords('');
      setOverrideDuplicateWarning(false);
      setIsAddingNew(false);
    }
  };

  const handleToggleActive = async (idea: AiTrainingIdea) => {
    const updated = { ...idea, isActive: !idea.isActive };
    await saveAiTrainingIdeaToFirestore(updated);
    showToast(`Idea "${idea.topic}" ${updated.isActive ? 'activated' : 'paused'} in Firestore.`);
  };

  const executeDelete = async (id: string, ideaTopic: string) => {
    setConfirmDeleteId(null);
    setSelectedIdeaIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

    setIdeas(prev => prev.filter(idea => idea.id !== id));
    showToast(`Deleted training idea "${ideaTopic}" from Firestore.`);

    try {
      await deleteAiTrainingIdeaFromFirestore(id);
    } catch (err) {
      console.warn('Failed to delete idea from Firestore:', err);
    }
  };

  const handleToggleSelectIdea = (id: string) => {
    setSelectedIdeaIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    if (selectedIdeaIds.size === filteredIdeas.length) {
      setSelectedIdeaIds(new Set());
    } else {
      setSelectedIdeaIds(new Set(filteredIdeas.map(i => i.id)));
    }
  };

  const executeDeleteSelected = async () => {
    if (selectedIdeaIds.size === 0) return;
    const idsToDelete = Array.from(selectedIdeaIds);
    const count = idsToDelete.length;
    setIsDeletingBatch(true);

    const idSet = new Set(idsToDelete);
    setIdeas(prev => prev.filter(idea => !idSet.has(idea.id)));
    setSelectedIdeaIds(new Set());
    showToast(`Deleted ${count} training ideas from Firestore.`);

    try {
      await deleteBatchAiTrainingIdeasFromFirestore(idsToDelete);
    } catch (err) {
      console.warn('Failed batch delete:', err);
    } finally {
      setIsDeletingBatch(false);
    }
  };

  const executeClearAll = async () => {
    setIsConfirmingClearAll(false);
    const prevCount = ideas.length;
    setIdeas([]);
    setSelectedIdeaIds(new Set());
    showToast(`Cleared all ${prevCount} training ideas from Firestore.`);

    try {
      await clearAllAiTrainingIdeasFromFirestore();
    } catch (err) {
      console.warn('Failed to clear ideas:', err);
    }
  };

  // Test the idea directly with Gemini backend & increment its usageCount in Firestore
  const handleTestIdeaWithAi = async (idea: AiTrainingIdea) => {
    setTestingIdeaId(idea.id);
    setIsTestingAi(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/polish-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note: `Synthesize a brand new, original Rig 50 SOAR observation inspired by the safety concept "${idea.topic}" in ${idea.zone} (do not copy verbatim). Key equipment/barriers: ${idea.keywords || idea.topic}`,
          zone: idea.zone,
          observedRole: idea.role,
          assessment: idea.assessment,
          obsType: idea.obsType,
          trainingIdeas: [
            {
              id: idea.id,
              topic: idea.topic,
              observation: idea.observation,
              action: idea.action,
              keywords: idea.keywords,
              zone: idea.zone,
              role: idea.role
            }
          ]
        })
      });

      if (response.ok) {
        const data = await response.json();
        setTestResult({ ...data, sourceIdeaTopic: idea.topic });
        await incrementIdeaUsageInFirestore([idea.id]);
      }
    } catch (err: any) {
      console.warn('AI Test failed:', err);
    } finally {
      setIsTestingAi(false);
    }
  };

  const handleApplyPreset = (p: typeof QUICK_PRESETS[0]) => {
    setTopic(p.topic);
    setZone(p.zone);
    setRole(p.role);
    setAssessment(p.assessment);
    setObsType(p.obsType);
    setObservation(p.observation);
    setAction(p.action);
    setKeywords(p.keywords);
    setFormCategory(getIdeaCategory(p));
  };

  // Change category of a single idea and save to Firestore
  const handleAssignCategoryToIdea = async (idea: AiTrainingIdea, newCategory: string) => {
    const updatedKeywords = setIdeaCategoryInKeywords(idea.keywords, newCategory);
    const updatedIdea: AiTrainingIdea = {
      ...idea,
      keywords: updatedKeywords,
      categoryGroup: newCategory
    };
    setIdeas(prev => prev.map(i => (i.id === idea.id ? updatedIdea : i)));
    await saveAiTrainingIdeaToFirestore(updatedIdea);
    showToast(`Moved "${idea.topic}" to category "${newCategory}".`);
  };

  // Bulk assign category to all selected ideas
  const handleBulkAssignCategory = async () => {
    if (selectedIdeaIds.size === 0 || !bulkCategoryValue) return;
    const targets = ideas.filter(i => selectedIdeaIds.has(i.id));
    if (targets.length === 0) return;

    const updatedBatch = targets.map(idea => ({
      ...idea,
      keywords: setIdeaCategoryInKeywords(idea.keywords, bulkCategoryValue),
      categoryGroup: bulkCategoryValue
    }));

    const updatedMap = new Map(updatedBatch.map(u => [u.id, u]));
    setIdeas(prev => prev.map(i => updatedMap.get(i.id) || i));
    await saveBatchAiTrainingIdeasToFirestore(updatedBatch);
    showToast(`Assigned category "${bulkCategoryValue}" to ${updatedBatch.length} selected ideas in Firestore.`);
  };

  // Submit selected AI Training Ideas directly to Rig 50 Microsoft Forms (Submit Again from Card Bank)
  const handleDirectSubmitIdeasFromBank = async (ideasToSubmitInput?: AiTrainingIdea[]) => {
    const targets = ideasToSubmitInput || ideas.filter(i => selectedIdeaIds.has(i.id));
    if (targets.length === 0) {
      showToast('Select at least one card from the AI Ideas Card Bank to submit.');
      return;
    }

    setIsSubmittingBank(true);
    abortBankSubmitRef.current = false;
    setBankSubmitProgress({ current: 0, total: targets.length });
    let successCount = 0;
    const usedIds: string[] = [];

    for (let idx = 0; idx < targets.length; idx++) {
      if (abortBankSubmitRef.current) break;
      setBankSubmitProgress({ current: idx + 1, total: targets.length });

      const idea = targets[idx];
      const catName = getIdeaCategory(idea);
      const soarCard = convertAiTrainingIdeaToSoarCard(idea, bankSubmitDate, catName, idx);

      const answers = [
        { questionId: 'r5f3272b6049d4ad18e7650bd96ae837b', answer1: soarCard.date },
        { questionId: 'r4fdd1bd872014d9c80d3a51be3f2f950', answer1: RIG_50_NAME },
        { questionId: 'r409eb59dd0f244e4b52573ce50037896', answer1: soarCard.zone },
        { questionId: 'rfe47535c542e4ce8886c2741c4c69b78', answer1: soarCard.role },
        { questionId: 'r26c88746635b40a39ef3f873e00e78a8', answer1: soarCard.assessment },
        { questionId: 'ra8f38f21840f490a87ac70d61da452f8', answer1: soarCard.obsType },
        { questionId: 'r2d178592d7f94a6aad56238bc1005d5f', answer1: soarCard.category },
        { questionId: 'r22c97581ebf74a8498da93d022d8afcf', answer1: 'PPE Worn Correctly (Compliant)' },
        { questionId: 're36e820370e2436798ea97f34930b753', answer1: soarCard.observation },
        { questionId: 'rda2692cb0c9841fdb71f4b2ec5415728', answer1: soarCard.action },
        { questionId: 'r698ffb98e604476b92020bb6c34790e9', answer1: soarCard.name }
      ];

      try {
        const res = await fetch('/api/submit-response', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId: USER_TENANT_ID,
            userId: USER_OWNER_ID,
            formId: USER_FORM_ID,
            answers
          })
        });
        if (res.ok) {
          successCount++;
          usedIds.push(idea.id);
          setSubmittedBankIdeaIds(prev => new Set(prev).add(idea.id));
        }
      } catch (err) {
        console.warn('Card bank submit notice:', err);
      }

      if (idx < targets.length - 1 && !abortBankSubmitRef.current) {
        await new Promise(r => setTimeout(r, 550));
      }
    }

    if (usedIds.length > 0) {
      incrementIdeaUsageInFirestore(usedIds).catch(() => {});
    }
    setIsSubmittingBank(false);
    showToast(`Submitted ${successCount} of ${targets.length} selected Card Bank ideas directly to Rig 50!`);
  };

  // Send selected ideas from Card Bank directly into Mass Submitter Preview Deck
  const handleSendSelectedBankToMassSubmitter = () => {
    const selected = ideas.filter(i => selectedIdeaIds.has(i.id));
    if (selected.length === 0) {
      showToast('Select at least one idea from the Card Bank to send to Mass Submitter.');
      return;
    }
    const cardsPayload = selected.map((idea, idx) => {
      const cat = getIdeaCategory(idea);
      return {
        id: `mass_bank_${idea.id}_${Date.now()}_${idx}`,
        topic: `[${cat}] ${idea.topic || 'Rig 50 Concept'}`,
        zone: idea.zone || 'Rig Floor',
        role: idea.role || 'Floorman',
        assessment: idea.assessment === 'Unsafe' ? 'Unsafe' : 'Safe',
        obsType: idea.obsType || 'Behavior Observation',
        category: idea.assessment === 'Unsafe' ? 'General Operational Safety' : 'Safe Behavior Observation',
        observation: idea.observation,
        action: idea.action
      };
    });
    (window as any).__rig50_pending_mass_deck = cardsPayload;
    window.dispatchEvent(new CustomEvent('rig50_send_to_mass_submitter', { detail: { cards: cardsPayload } }));
    window.dispatchEvent(new CustomEvent('rig50_navigate_to_mass'));
    incrementIdeaUsageInFirestore(selected.map(i => i.id)).catch(() => {});
    onClose();
  };

  // Send selected recreated cards directly into Mass Submitter Preview Deck
  const handleSendRecreatedToMassSubmitter = () => {
    const selected = recreatedDeck.filter(c => selectedRecreatedIds.has(c.id));
    if (selected.length === 0) {
      showToast('Select at least one recreated card to send to Mass Submitter.');
      return;
    }
    const cardsPayload = selected.map((c, idx) => ({
      id: c.id || `mass_rec_${Date.now()}_${idx}`,
      topic: c.topic || c.operationSnippet || 'AI Recreated Card',
      zone: c.zone || 'Rig Floor',
      role: c.role || 'Floorman',
      assessment: c.assessment === 'Unsafe' ? 'Unsafe' : 'Safe',
      obsType: c.obsType || 'Behavior Observation',
      category: c.category || 'Safe Behavior Observation',
      observation: c.observation,
      action: c.action
    }));
    (window as any).__rig50_pending_mass_deck = cardsPayload;
    window.dispatchEvent(new CustomEvent('rig50_send_to_mass_submitter', { detail: { cards: cardsPayload } }));
    window.dispatchEvent(new CustomEvent('rig50_navigate_to_mass'));
    onClose();
  };

  // AI Recreate Selected Ideas from Card Bank for New Submissions
  const handleRecreateSelectedIdeasForNewSubmission = async (ideasToRecreateInput?: AiTrainingIdea[]) => {
    const targets = ideasToRecreateInput || ideas.filter(i => selectedIdeaIds.has(i.id));
    if (targets.length === 0) {
      showToast('Select at least one idea from the Card Bank to recreate with AI.');
      return;
    }

    setIsRecreatingFromBank(true);
    setRecreateProgress({ current: 0, total: targets.length });
    setActiveTab('recreated');

    const newRecreatedCards: (GeneratedSoarCard & { sourceIdeaId?: string; categoryGroup?: string })[] = [];
    const usedIds: string[] = [];
    const effectiveInstruction = [
      'STRICT RULE: Do NOT include any clock times or timestamps (e.g. 08:30, 14:00 hrs) in observation or action.',
      'Synthesize a brand-new, freshly worded Rig 50 SOAR card inspired by this training concept so it reads as a completely new submission (never a verbatim duplicate).',
      bankRecreateInstruction.trim()
    ]
      .filter(Boolean)
      .join(' ');

    for (let idx = 0; idx < targets.length; idx++) {
      setRecreateProgress({ current: idx + 1, total: targets.length });
      const idea = targets[idx];
      const catName = getIdeaCategory(idea);
      const baseCard = convertAiTrainingIdeaToSoarCard(idea, bankSubmitDate, catName, idx);
      const contextText = `Category: ${catName}\nConcept Topic: ${idea.topic}\nZone: ${idea.zone || 'Rig Floor'}\nRole: ${idea.role || 'Floorman'}\nExemplar Observation: ${idea.observation}\nExemplar Action: ${idea.action}\nKeywords: ${getCleanIdeaKeywords(idea.keywords)}`;

      try {
        const spunCard = await remakeCardWithAI(
          baseCard,
          contextText,
          [...recreatedDeck, ...newRecreatedCards],
          {
            remakeMode: 'operations_ai',
            customInstruction: effectiveInstruction
          }
        );
        const enriched = {
          ...spunCard,
          id: `recreated_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
          date: bankSubmitDate,
          operationSnippet: `[Recreated from "${idea.topic}"]`,
          sourceIdeaId: idea.id,
          categoryGroup: catName,
          aiPolished: true
        };
        newRecreatedCards.push(enriched);
        usedIds.push(idea.id);
      } catch (err) {
        console.warn('Error recreating card from idea:', err);
      }
    }

    if (newRecreatedCards.length > 0) {
      setRecreatedDeck(prev => [...newRecreatedCards, ...prev]);
      setSelectedRecreatedIds(prev => {
        const next = new Set(prev);
        newRecreatedCards.forEach(c => next.add(c.id));
        return next;
      });
      if (usedIds.length > 0) {
        incrementIdeaUsageInFirestore(usedIds).catch(() => {});
      }
      showToast(`Gemini AI recreated ${newRecreatedCards.length} fresh SOAR cards ready for new submission!`);
    }
    setIsRecreatingFromBank(false);
  };

  // Remake a single card inside the Recreated Submissions Deck
  const handleRemakeSingleRecreatedCard = async (cardId: string) => {
    const target = recreatedDeck.find(c => c.id === cardId);
    if (!target) return;
    setRemakingRecreatedId(cardId);
    try {
      const effectiveInstruction = [
        'STRICT RULE: Do NOT include any clock times or timestamps.',
        'Create a fresh, unique angle and wording for a new submission.',
        bankRecreateInstruction.trim()
      ]
        .filter(Boolean)
        .join(' ');
      const contextText = `Category: ${target.categoryGroup || 'Rig 50'}\nTopic: ${target.topic || target.operationSnippet}\nZone: ${target.zone}\nObservation: ${target.observation}\nAction: ${target.action}`;
      const respun = await remakeCardWithAI(target, contextText, recreatedDeck, {
        remakeMode: 'operations_ai',
        customInstruction: effectiveInstruction
      });
      setRecreatedDeck(prev =>
        prev.map(c =>
          c.id === cardId
            ? {
                ...respun,
                id: cardId,
                date: bankSubmitDate,
                sourceIdeaId: target.sourceIdeaId,
                categoryGroup: target.categoryGroup,
                aiPolished: true
              }
            : c
        )
      );
      showToast('Recreated card with a brand-new AI variation!');
    } finally {
      setRemakingRecreatedId(null);
    }
  };

  // Submit selected cards from the Recreated Deck to Rig 50 Microsoft Forms
  const handleDirectSubmitRecreatedDeck = async () => {
    const cardsToSubmit = recreatedDeck.filter(c => selectedRecreatedIds.has(c.id));
    if (cardsToSubmit.length === 0) {
      showToast('Select at least one recreated card to submit.');
      return;
    }

    setIsSubmittingBank(true);
    abortBankSubmitRef.current = false;
    setBankSubmitProgress({ current: 0, total: cardsToSubmit.length });
    let successCount = 0;

    for (let i = 0; i < cardsToSubmit.length; i++) {
      if (abortBankSubmitRef.current) break;
      setBankSubmitProgress({ current: i + 1, total: cardsToSubmit.length });
      const c = cardsToSubmit[i];

      const answers = [
        { questionId: 'r5f3272b6049d4ad18e7650bd96ae837b', answer1: bankSubmitDate || c.date },
        { questionId: 'r4fdd1bd872014d9c80d3a51be3f2f950', answer1: RIG_50_NAME },
        { questionId: 'r409eb59dd0f244e4b52573ce50037896', answer1: c.zone },
        { questionId: 'rfe47535c542e4ce8886c2741c4c69b78', answer1: c.role },
        { questionId: 'r26c88746635b40a39ef3f873e00e78a8', answer1: c.assessment },
        { questionId: 'ra8f38f21840f490a87ac70d61da452f8', answer1: c.obsType },
        { questionId: 'r2d178592d7f94a6aad56238bc1005d5f', answer1: c.category },
        { questionId: 'r22c97581ebf74a8498da93d022d8afcf', answer1: 'PPE Worn Correctly (Compliant)' },
        { questionId: 're36e820370e2436798ea97f34930b753', answer1: c.observation },
        { questionId: 'rda2692cb0c9841fdb71f4b2ec5415728', answer1: c.action },
        { questionId: 'r698ffb98e604476b92020bb6c34790e9', answer1: c.name }
      ];

      try {
        const res = await fetch('/api/submit-response', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId: USER_TENANT_ID,
            userId: USER_OWNER_ID,
            formId: USER_FORM_ID,
            answers
          })
        });
        if (res.ok) {
          successCount++;
          setSubmittedRecreatedIds(prev => new Set(prev).add(c.id));
        }
      } catch (err) {
        console.warn('Recreated submit error:', err);
      }

      if (i < cardsToSubmit.length - 1 && !abortBankSubmitRef.current) {
        await new Promise(r => setTimeout(r, 550));
      }
    }

    setIsSubmittingBank(false);
    showToast(`Submitted ${successCount} of ${cardsToSubmit.length} newly recreated SOAR cards to Rig 50!`);
  };

  // Save selected recreated cards back to the AI Ideas Card Bank as new ideas
  const handleSaveRecreatedAsNewIdeas = async () => {
    const selectedCards = recreatedDeck.filter(c => selectedRecreatedIds.has(c.id));
    if (selectedCards.length === 0) return;

    const nowIso = new Date().toISOString();
    const newIdeas: AiTrainingIdea[] = selectedCards.map((c, idx) => {
      const cat = c.categoryGroup || getIdeaCategory(c);
      return {
        id: `idea_rec_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        topic: (c.topic || `${c.zone} ${c.obsType}`).slice(0, 140),
        zone: c.zone,
        role: c.role,
        assessment: c.assessment,
        obsType: c.obsType,
        observation: c.observation.slice(0, 1950),
        action: c.action.slice(0, 1950),
        keywords: setIdeaCategoryInKeywords(`${c.zone.toLowerCase()}, ${c.role.toLowerCase()}, recreated variation`, cat),
        isActive: true,
        usageCount: 0,
        lastUsedAt: nowIso,
        createdAt: nowIso
      };
    });

    await saveBatchAiTrainingIdeasToFirestore(newIdeas);
    showToast(`Saved ${newIdeas.length} recreated cards as new exemplars in the AI Ideas Card Bank!`);
  };

  const filteredIdeas = ideas.filter(idea => {
    if (filterStatus === 'active' && !idea.isActive) return false;
    if (filterStatus === 'paused' && idea.isActive) return false;
    if (filterStatus === 'from_block') {
      const isFromBlock = (idea.keywords && idea.keywords.toLowerCase().includes('block list')) ||
        (idea.id && idea.id.startsWith('idea_blk_'));
      if (!isFromBlock) return false;
    }
    if (selectedCategoryFilter !== 'ALL') {
      const ideaCat = getIdeaCategory(idea);
      if (ideaCat !== selectedCategoryFilter) return false;
    }
    if (filterAssessment !== 'ALL' && idea.assessment !== filterAssessment) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const ideaCat = getIdeaCategory(idea).toLowerCase();
      const match = (idea.topic && idea.topic.toLowerCase().includes(q)) ||
        (idea.observation && idea.observation.toLowerCase().includes(q)) ||
        (idea.action && idea.action.toLowerCase().includes(q)) ||
        (idea.zone && idea.zone.toLowerCase().includes(q)) ||
        (idea.role && idea.role.toLowerCase().includes(q)) ||
        (idea.keywords && idea.keywords.toLowerCase().includes(q)) ||
        ideaCat.includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Ranked ideas & zone distribution for the Analytics Dashboard
  const rankedIdeasByUsage = [...ideas].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
  const maxIdeaUsage = Math.max(1, ...ideas.map(i => i.usageCount || 0));

  const zoneAnalytics = RIG_50_ZONES.map(z => {
    const matching = ideas.filter(i => i.zone === z);
    const activeInZone = matching.filter(i => i.isActive !== false).length;
    const usesInZone = matching.reduce((sum, i) => sum + (i.usageCount || 0), 0);
    return { zone: z, total: matching.length, active: activeInZone, uses: usesInZone };
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 p-4 sm:p-5 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Brain className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white">
                AI Training Ideas &amp; Context-Aware SOAR Studio
              </h3>
              <p className="text-xs text-slate-300 mt-0.5 font-mono tabular-nums">
                <span>Firestore Database</span>
                <span className="mx-1.5">·</span>
                <span>{activeCount} Active Exemplars</span>
                <span className="mx-1.5">·</span>
                <span>{totalAiGenerationsInfluenced} Total AI Card Generations Influenced</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-100 px-4 sm:px-6 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1 p-1 bg-slate-200/80 rounded-lg flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('library')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'library'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderKanban className="w-3.5 h-3.5 text-indigo-600" />
              <span>Categorized Card Bank ({ideas.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('recreated')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'recreated'
                  ? 'bg-white text-indigo-950 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              <span>Recreated for New Submissions ({recreatedDeck.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('importer')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'importer'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Spreadsheet Importer</span>
              {stagedImportIdeas.length > 0 && (
                <span className="font-mono tabular-nums text-[11px] text-indigo-700">
                  ({stagedImportIdeas.filter(s => s.selected).length})
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'analytics'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Usage Analytics</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('library');
                setIsAddingNew(prev => !prev);
              }}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {isAddingNew ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{isAddingNew ? 'Close Idea Form' : 'New Training Idea'}</span>
            </button>
          </div>
        </div>

        {/* Toast */}
        {successToast && (
          <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-900 px-4 py-2 text-xs font-semibold flex items-center gap-2 animate-in fade-in shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">

          {/* =====================================================================
              TAB 2: SPREADSHEET IMPORTER & PRE-IMPORT REVIEW TABLE
          ===================================================================== */}
          {activeTab === 'importer' && (
            <div className="space-y-5">
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                      <span>Context-Aware Spreadsheet &amp; PowerBI Importer</span>
                    </h4>
                    <p className="text-xs text-slate-600">
                      Automatically detects true header rows (skipping PowerBI filter banners), deduplicates raw rows, uses Gemini AI to extract and improve the safety concept, and lets you review and edit every idea before saving to Firestore.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleLoadAttachedPowerBiReport}
                      disabled={isParsingFile || isElevatingWithGemini}
                      className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-700" />
                      <span>Load Attached PowerBI SOAR Export</span>
                    </button>
                  </div>
                </div>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {/* Upload Dropzone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-white hover:bg-indigo-50/20 transition-all rounded-xl p-5 text-center cursor-pointer flex flex-col items-center justify-center gap-2"
                >
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      Click to upload Excel (.xlsx, .xls) or PowerBI CSV export
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Auto-detects multi-row headers (`Describe the Unsafe Work...`, `Describe the action taken`, `Observation Area`)
                    </span>
                  </div>
                  {attachedFileName && (
                    <div className="mt-1 text-xs font-medium text-indigo-800 font-mono tabular-nums">
                      {attachedFileName} · {parsedRawRows.length} unique observations ready
                    </div>
                  )}
                </div>

                {detectedHeaderInfo && (
                  <div className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 flex items-center justify-between gap-2">
                    <span>{detectedHeaderInfo}</span>
                  </div>
                )}

                {/* Batch Size Selector & Elevate Trigger */}
                {parsedRawRows.length > 0 && !isParsingFile && (
                  <div className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-slate-900 block">
                        Step 2: Elevate Raw Notes into Rig 50 Training Concepts
                      </span>
                      <p className="text-xs text-slate-600">
                        Gemini AI reads each raw report, extracts the operational hazard or behavior, and writes an improved third-person exemplar (never copy-pasting raw text).
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                        <span>Cards to process:</span>
                        <select
                          value={batchSizeToElevate}
                          onChange={(e) => setBatchSizeToElevate(Number(e.target.value))}
                          disabled={isElevatingWithGemini}
                          className="px-2.5 py-1.5 text-xs font-mono tabular-nums bg-slate-50 border border-slate-300 rounded-lg outline-none font-semibold text-slate-800"
                        >
                          <option value={50}>50 cards (Fast)</option>
                          <option value={100}>100 cards</option>
                          <option value={250}>250 cards</option>
                          <option value={500}>500 cards</option>
                          <option value={parsedRawRows.length || 1885}>
                            All ({parsedRawRows.length || 1885} cards)
                          </option>
                        </select>
                      </label>

                      <button
                        type="button"
                        onClick={handleElevateToReviewTable}
                        disabled={isElevatingWithGemini}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        {isElevatingWithGemini ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Elevating Concepts...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            <span>Elevate &amp; Open Pre-Import Review</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {isElevatingWithGemini && (
                  <div className="p-4 bg-slate-900 text-white rounded-xl space-y-2.5 shadow-md">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
                        <span>{elevationProgressText}</span>
                      </div>
                      <span className="font-bold text-indigo-300">{elevationProgressPercent}%</span>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-700">
                      <div
                        className="bg-gradient-to-r from-indigo-500 to-teal-400 h-full transition-all duration-300 rounded-full"
                        style={{ width: `${Math.max(elevationProgressPercent, 3)}%` }}
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => { cancelElevationRef.current = true; }}
                        className="text-xs px-2.5 py-1 bg-rose-900/80 hover:bg-rose-800 text-rose-200 border border-rose-700 rounded cursor-pointer transition-colors flex items-center gap-1.5"
                      >
                        <StopCircle className="w-3.5 h-3.5" />
                        <span>Stop Elevation &amp; Review Current</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* PRE-IMPORT REVIEW TABLE */}
              {stagedImportIdeas.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden space-y-0 shadow-sm">
                  <div className="bg-slate-900 text-white px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold">
                        Pre-Import Review Table ({stagedImportIdeas.filter(s => s.selected).length} of {stagedImportIdeas.length} Approved)
                      </h4>
                      <p className="text-[11px] text-slate-300">
                        Inspect, edit inline, or re-polish AI-elevated ideas before saving to Firestore. High-similarity duplicates are automatically unchecked.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          value={stagedSearch}
                          onChange={(e) => {
                            setStagedSearch(e.target.value);
                            setStagedPage(1);
                          }}
                          placeholder="Search staged cards..."
                          className="pl-8 pr-2.5 py-1.5 text-xs bg-slate-800 border border-slate-700 text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 w-36 sm:w-48 placeholder-slate-400"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const allSelected = stagedImportIdeas.every(s => s.selected);
                          setStagedImportIdeas(prev => prev.map(s => ({ ...s, selected: !allSelected })));
                        }}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                      >
                        {stagedImportIdeas.every(s => s.selected) ? 'Uncheck All' : 'Check All'}
                      </button>

                      <button
                        type="button"
                        onClick={handleSaveApprovedStagedIdeas}
                        disabled={isSavingStagedBatch || stagedImportIdeas.filter(s => s.selected).length === 0}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                      >
                        {isSavingStagedBatch ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        <span>
                          Approve &amp; Save ({stagedImportIdeas.filter(s => s.selected).length}) to Database
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Pagination Bar */}
                  {totalStagedPages > 1 && (
                    <div className="bg-slate-800 border-b border-slate-700 px-4 py-2 flex items-center justify-between text-xs text-slate-300 flex-wrap gap-2">
                      <span>
                        Showing {((stagedPage - 1) * stagedPageSize) + 1} - {Math.min(stagedPage * stagedPageSize, filteredStagedIdeas.length)} of {filteredStagedIdeas.length} concepts
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setStagedPage(p => Math.max(1, p - 1))}
                          disabled={stagedPage === 1}
                          className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 rounded flex items-center gap-1 cursor-pointer"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          <span>Prev</span>
                        </button>
                        <span className="font-mono px-2 py-0.5 bg-slate-900 rounded font-bold text-white text-[11px]">
                          Page {stagedPage} / {totalStagedPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setStagedPage(p => Math.min(totalStagedPages, p + 1))}
                          disabled={stagedPage === totalStagedPages}
                          className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 rounded flex items-center gap-1 cursor-pointer"
                        >
                          <span>Next</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="divide-y divide-slate-200 max-h-[52vh] overflow-y-auto">
                    {currentStagedSlice.map((item, idx) => {
                      const displayIdx = ((stagedPage - 1) * stagedPageSize) + idx + 1;
                      const isSimilar = item.similarityScore >= 70;
                      return (
                        <div
                          key={item.tempId}
                          className={`p-4 transition-colors space-y-3 ${
                            item.selected ? 'bg-white' : 'bg-slate-50/80 opacity-75'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <input
                                type="checkbox"
                                checked={item.selected}
                                onChange={() =>
                                  setStagedImportIdeas(prev =>
                                    prev.map(s => s.tempId === item.tempId ? { ...s, selected: !s.selected } : s)
                                  )
                                }
                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                              <span className="font-mono tabular-nums text-xs text-slate-500 font-semibold">
                                #{displayIdx}
                              </span>
                              <span className="font-bold text-slate-900 text-xs sm:text-sm">
                                {item.topic}
                              </span>
                              <span className="text-xs text-slate-500">
                                {item.zone} · {item.role} · {item.assessment} · {item.obsType}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-auto">
                              <span
                                className={`text-xs font-mono tabular-nums ${
                                  isSimilar ? 'text-amber-700 font-bold' : 'text-emerald-700 font-medium'
                                }`}
                              >
                                {isSimilar
                                  ? `Similarity Warning: ${item.similarityScore}% match (${item.matchedTopic?.slice(0, 28)})`
                                  : `Unique (${item.similarityScore}% overlap)`}
                              </span>

                              <button
                                type="button"
                                onClick={() =>
                                  setStagedImportIdeas(prev =>
                                    prev.map(s => s.tempId === item.tempId ? { ...s, editing: !s.editing } : s)
                                  )
                                }
                                className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md flex items-center gap-1 cursor-pointer"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>{item.editing ? 'Done' : 'Edit'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleRepolishStagedRow(item.tempId)}
                                disabled={item.repolishing}
                                className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                {item.repolishing ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Wand2 className="w-3 h-3" />
                                )}
                                <span>AI Re-Polish</span>
                              </button>
                            </div>
                          </div>

                          {/* Inline Editor or Side-by-Side Comparison */}
                          {item.editing ? (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                              <div>
                                <label className="font-semibold text-slate-700 block mb-1">Topic</label>
                                <input
                                  type="text"
                                  value={item.topic}
                                  onChange={(e) =>
                                    setStagedImportIdeas(prev =>
                                      prev.map(s => s.tempId === item.tempId ? { ...s, topic: e.target.value } : s)
                                    )
                                  }
                                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                                />
                              </div>
                              <div>
                                <label className="font-semibold text-slate-700 block mb-1">Zone</label>
                                <select
                                  value={item.zone}
                                  onChange={(e) =>
                                    setStagedImportIdeas(prev =>
                                      prev.map(s => s.tempId === item.tempId ? { ...s, zone: e.target.value } : s)
                                    )
                                  }
                                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                                >
                                  {RIG_50_ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="font-semibold text-slate-700 block mb-1">Role</label>
                                <select
                                  value={item.role}
                                  onChange={(e) =>
                                    setStagedImportIdeas(prev =>
                                      prev.map(s => s.tempId === item.tempId ? { ...s, role: e.target.value } : s)
                                    )
                                  }
                                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                                >
                                  {RIG_50_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                              </div>
                              <div className="sm:col-span-3">
                                <label className="font-semibold text-slate-700 block mb-1">AI-Improved Observation</label>
                                <textarea
                                  rows={2}
                                  value={item.observation}
                                  onChange={(e) =>
                                    setStagedImportIdeas(prev =>
                                      prev.map(s => s.tempId === item.tempId ? { ...s, observation: e.target.value } : s)
                                    )
                                  }
                                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <label className="font-semibold text-slate-700 block mb-1">AI-Improved Action</label>
                                <textarea
                                  rows={2}
                                  value={item.action}
                                  onChange={(e) =>
                                    setStagedImportIdeas(prev =>
                                      prev.map(s => s.tempId === item.tempId ? { ...s, action: e.target.value } : s)
                                    )
                                  }
                                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                                />
                              </div>
                              <div>
                                <label className="font-semibold text-slate-700 block mb-1">Keywords</label>
                                <input
                                  type="text"
                                  value={item.keywords}
                                  onChange={(e) =>
                                    setStagedImportIdeas(prev =>
                                      prev.map(s => s.tempId === item.tempId ? { ...s, keywords: e.target.value } : s)
                                    )
                                  }
                                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
                              <div className="sm:col-span-5 bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1">
                                <span className="text-[11px] font-semibold text-slate-500 block">
                                  Original Spreadsheet Row ({item.before.rawZone || 'Unspecified Area'}):
                                </span>
                                <p className="text-slate-600 italic leading-relaxed">
                                  "{item.before.rawObservation}"
                                </p>
                                {item.before.rawAction && (
                                  <p className="text-slate-500 text-[11px]">
                                    Action: "{item.before.rawAction}"
                                  </p>
                                )}
                              </div>

                              <div className="sm:col-span-7 bg-indigo-50/40 p-2.5 rounded-lg border border-indigo-200/80 space-y-1">
                                <span className="text-[11px] font-semibold text-indigo-900 block">
                                  AI-Elevated Rig 50 Concept (Synthesized, Non-Verbatim):
                                </span>
                                <p className="text-slate-900 font-medium leading-relaxed">
                                  {item.observation}
                                </p>
                                <p className="text-slate-700 leading-relaxed">
                                  <span className="font-semibold">Action:</span> {item.action}
                                </p>
                                <p className="text-[11px] text-slate-500 pt-0.5">
                                  Keywords: {item.keywords}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Bottom Pagination Bar */}
                  {totalStagedPages > 1 && (
                    <div className="bg-slate-900 border-t border-slate-800 px-4 py-2.5 flex items-center justify-between text-xs text-slate-300 flex-wrap gap-2">
                      <span>
                        Showing {((stagedPage - 1) * stagedPageSize) + 1} - {Math.min(stagedPage * stagedPageSize, filteredStagedIdeas.length)} of {filteredStagedIdeas.length} concepts
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setStagedPage(p => Math.max(1, p - 1))}
                          disabled={stagedPage === 1}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded flex items-center gap-1 cursor-pointer"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          <span>Prev</span>
                        </button>
                        <span className="font-mono px-2 py-0.5 bg-slate-950 rounded font-bold text-white text-[11px]">
                          Page {stagedPage} / {totalStagedPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setStagedPage(p => Math.min(totalStagedPages, p + 1))}
                          disabled={stagedPage === totalStagedPages}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded flex items-center gap-1 cursor-pointer"
                        >
                          <span>Next</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* =====================================================================
              TAB 3: USAGE ANALYTICS DASHBOARD
          ===================================================================== */}
          {activeTab === 'analytics' && (
            <div className="space-y-5">
              {/* KPI Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <span className="text-xs text-slate-500 font-medium block">Total Database Ideas</span>
                  <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1 block">
                    {totalCount}
                  </span>
                  <span className="text-[11px] text-slate-500">100% Firestore Persisted</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <span className="text-xs text-slate-500 font-medium block">Active in AI Prompts</span>
                  <span className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1 block">
                    {activeCount} ({completionPercent}%)
                  </span>
                  <span className="text-[11px] text-slate-500">{pausedCount} paused</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <span className="text-xs text-slate-500 font-medium block">Total AI Card Uses</span>
                  <span className="text-2xl font-bold text-indigo-700 font-mono tabular-nums mt-1 block">
                    {totalAiGenerationsInfluenced}
                  </span>
                  <span className="text-[11px] text-slate-500">Cards synthesized from ideas</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <span className="text-xs text-slate-500 font-medium block">Rig 50 Zones Covered</span>
                  <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1 block">
                    {zoneAnalytics.filter(z => z.total > 0).length} / {RIG_50_ZONES.length}
                  </span>
                  <span className="text-[11px] text-slate-500">Operational zone distribution</span>
                </div>
              </div>

              {/* Ranked Table of Most-Used Training Ideas */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-indigo-600" />
                      <span>Most-Used Training Ideas in AI Card Generation</span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Tracks how frequently each training concept is selected and synthesized into fresh SOAR cards.
                    </p>
                  </div>
                </div>

                {rankedIdeasByUsage.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    No training ideas recorded yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/60 text-slate-600">
                          <th className="py-2.5 px-3 font-semibold">Rank</th>
                          <th className="py-2.5 px-3 font-semibold">Training Idea Topic</th>
                          <th className="py-2.5 px-3 font-semibold">Zone · Role · Assessment</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Times Used</th>
                          <th className="py-2.5 px-3 font-semibold">Last Used</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {rankedIdeasByUsage.slice(0, 15).map((idea, index) => {
                          const count = idea.usageCount || 0;
                          const widthPct = Math.max(4, Math.round((count / maxIdeaUsage) * 100));
                          return (
                            <tr key={idea.id} className="hover:bg-slate-50/80">
                              <td className="py-2.5 px-3 font-mono tabular-nums text-slate-500">
                                #{index + 1}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-slate-900">
                                {idea.topic}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600">
                                {idea.zone || 'Rig Floor'} · {idea.role || 'Floorman'} · {idea.assessment || 'Safe'}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden hidden sm:block">
                                    <div
                                      className="bg-indigo-600 h-full rounded-full"
                                      style={{ width: `${widthPct}%` }}
                                    />
                                  </div>
                                  <span className="font-mono tabular-nums font-bold text-slate-900">
                                    {count}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 font-mono tabular-nums text-slate-500">
                                {idea.lastUsedAt ? idea.lastUsedAt.split('T')[0] : '—'}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleRepolishExistingIdea(idea)}
                                    disabled={repolishingIdeaId === idea.id}
                                    className="px-2 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-50 rounded border border-indigo-200 cursor-pointer"
                                  >
                                    {repolishingIdeaId === idea.id ? 'Polishing...' : 'AI Re-Polish'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleTestIdeaWithAi(idea)}
                                    className="px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 rounded border border-slate-200 cursor-pointer"
                                  >
                                    Test
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Zone Coverage Breakdown */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                  Rig 50 Operational Zone Coverage
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {zoneAnalytics.map(z => (
                    <div key={z.zone} className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-slate-900 block">{z.zone}</span>
                        <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                          {z.active} active · {z.uses} AI uses
                        </span>
                      </div>
                      <span className={`text-xs font-mono tabular-nums font-bold ${z.total === 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                        {z.total} ideas
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              TAB 4: RECREATED DECK FOR NEW SUBMISSIONS
          ===================================================================== */}
          {activeTab === 'recreated' && (
            <div className="space-y-4">
              <div className="bg-slate-900 text-white rounded-xl p-4 border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-teal-400" />
                      <span>AI-Recreated Cards for New Submissions ({recreatedDeck.length} in Deck)</span>
                    </h4>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Each card below was freshly synthesized by Gemini AI from your selected Card Bank ideas so it reads as a brand-new, non-duplicate SOAR observation. Review, edit, remake any card, and submit directly to Rig 50.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs">
                      <span className="text-slate-300">Date:</span>
                      <input
                        type="date"
                        value={bankSubmitDate}
                        onChange={(e) => setBankSubmitDate(e.target.value)}
                        className="bg-transparent text-white font-mono text-xs outline-none"
                      />
                    </div>

                    {recreatedDeck.length > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedRecreatedIds.size === recreatedDeck.length) {
                              setSelectedRecreatedIds(new Set());
                            } else {
                              setSelectedRecreatedIds(new Set(recreatedDeck.map(c => c.id)));
                            }
                          }}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 cursor-pointer"
                        >
                          {selectedRecreatedIds.size === recreatedDeck.length ? 'Deselect All' : 'Select All'}
                        </button>

                        <button
                          type="button"
                          onClick={handleSaveRecreatedAsNewIdeas}
                          disabled={selectedRecreatedIds.size === 0}
                          className="px-3 py-1.5 bg-indigo-600/90 hover:bg-indigo-600 disabled:opacity-40 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
                          title="Save selected recreated cards into the AI Ideas Card Bank as new exemplars"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Save ({selectedRecreatedIds.size}) as New Ideas</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleSendRecreatedToMassSubmitter}
                          disabled={selectedRecreatedIds.size === 0}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs"
                          title="Send selected recreated cards directly to the high-speed Mass Submitter deck"
                        >
                          <Rocket className="w-3.5 h-3.5" />
                          <span>Send ({selectedRecreatedIds.size}) to Mass Submitter</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleDirectSubmitRecreatedDeck}
                          disabled={isSubmittingBank || selectedRecreatedIds.size === 0}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          {isSubmittingBank ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          <span>Submit Selected ({selectedRecreatedIds.size}) to Rig 50</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {isRecreatingFromBank && (
                  <div className="bg-slate-800/90 border border-slate-700 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono text-teal-300">
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Gemini AI is recreating selected Card Bank ideas ({recreateProgress.current} / {recreateProgress.total})...</span>
                      </span>
                      <span>{Math.round((recreateProgress.current / Math.max(1, recreateProgress.total)) * 100)}%</span>
                    </div>
                    <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-teal-400 h-full transition-all duration-300"
                        style={{ width: `${Math.max(5, Math.round((recreateProgress.current / Math.max(1, recreateProgress.total)) * 100))}%` }}
                      />
                    </div>
                  </div>
                )}

                {isSubmittingBank && (
                  <div className="bg-emerald-950/80 border border-emerald-700 rounded-lg p-3 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-emerald-200 font-mono">
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                      <span>Submitting to Rig 50 Microsoft Forms ({bankSubmitProgress.current} / {bankSubmitProgress.total})...</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { abortBankSubmitRef.current = true; }}
                      className="px-2.5 py-1 bg-rose-700 hover:bg-rose-600 text-white rounded font-semibold cursor-pointer"
                    >
                      Stop
                    </button>
                  </div>
                )}
              </div>

              {recreatedDeck.length === 0 && !isRecreatingFromBank ? (
                <div className="p-10 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 space-y-3">
                  <Sparkles className="w-8 h-8 text-teal-600 mx-auto" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-800">No Recreated Cards Staged Yet</p>
                    <p className="text-xs text-slate-600 max-w-md mx-auto">
                      Go to the <strong>Categorized Card Bank</strong> tab, select any saved ideas (or an entire category), and click <strong>"AI Recreate Selected for New Submission"</strong> to spin fresh, non-duplicate SOAR cards here.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('library')}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Browse Categorized Card Bank
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {recreatedDeck.map((card, idx) => {
                    const isChecked = selectedRecreatedIds.has(card.id);
                    const isSubmitted = submittedRecreatedIds.has(card.id);
                    const isEditing = editingRecreatedId === card.id;
                    const isRemaking = remakingRecreatedId === card.id;

                    return (
                      <div
                        key={card.id}
                        className={`p-4 rounded-xl border transition-all space-y-2.5 ${
                          isChecked ? 'bg-white border-indigo-200 shadow-2xs' : 'bg-slate-50 border-slate-200 opacity-70'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setSelectedRecreatedIds(prev => {
                                  const next = new Set(prev);
                                  if (next.has(card.id)) next.delete(card.id);
                                  else next.add(card.id);
                                  return next;
                                });
                              }}
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600 cursor-pointer"
                            />
                            <span className="font-mono text-xs font-bold text-slate-500">#{idx + 1}</span>
                            <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-teal-50 text-teal-800 border border-teal-200">
                              {card.categoryGroup || getIdeaCategory(card)}
                            </span>
                            <span className="font-bold text-xs sm:text-sm text-slate-900">
                              {card.topic || card.operationSnippet}
                            </span>
                            <span className="text-xs text-slate-500 font-mono">
                              {card.zone} · {card.role} ({card.name}) ·{' '}
                              <span className={card.assessment === 'Unsafe' ? 'text-rose-700 font-bold' : 'text-emerald-700 font-bold'}>
                                {card.assessment}
                              </span>{' '}
                              · {card.obsType}
                            </span>
                            {isSubmitted && (
                              <span className="px-2 py-0.5 text-[11px] font-bold bg-emerald-100 text-emerald-800 rounded-md flex items-center gap-1">
                                <Check className="w-3 h-3" /> Submitted to Rig 50
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 self-end sm:self-auto">
                            <button
                              type="button"
                              onClick={() => handleRemakeSingleRecreatedCard(card.id)}
                              disabled={isRemaking}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              {isRemaking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                              <span>AI Spin Again</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (isEditing) {
                                  setEditingRecreatedId(null);
                                  setEditRecreatedForm(null);
                                } else {
                                  setEditingRecreatedId(card.id);
                                  setEditRecreatedForm({
                                    observation: card.observation,
                                    action: card.action,
                                    zone: card.zone,
                                    role: card.role,
                                    assessment: card.assessment,
                                    obsType: card.obsType
                                  });
                                }
                              }}
                              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>{isEditing ? 'Cancel' : 'Edit'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setRecreatedDeck(prev => prev.filter(c => c.id !== card.id));
                                setSelectedRecreatedIds(prev => {
                                  const next = new Set(prev);
                                  next.delete(card.id);
                                  return next;
                                });
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                              title="Remove from deck"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {isEditing && editRecreatedForm ? (
                          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2.5 text-xs">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div>
                                <label className="font-semibold text-slate-700 block mb-1">Zone</label>
                                <select
                                  value={editRecreatedForm.zone}
                                  onChange={(e) => setEditRecreatedForm({ ...editRecreatedForm, zone: e.target.value })}
                                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                                >
                                  {RIG_50_ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="font-semibold text-slate-700 block mb-1">Role</label>
                                <select
                                  value={editRecreatedForm.role}
                                  onChange={(e) => setEditRecreatedForm({ ...editRecreatedForm, role: e.target.value })}
                                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                                >
                                  {RIG_50_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="font-semibold text-slate-700 block mb-1">Assessment</label>
                                <select
                                  value={editRecreatedForm.assessment}
                                  onChange={(e) => setEditRecreatedForm({ ...editRecreatedForm, assessment: e.target.value as 'Safe' | 'Unsafe' })}
                                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                                >
                                  <option value="Safe">Safe</option>
                                  <option value="Unsafe">Unsafe</option>
                                </select>
                              </div>
                            </div>
                            <div>
                              <label className="font-semibold text-slate-700 block mb-1">Observation</label>
                              <textarea
                                rows={2}
                                value={editRecreatedForm.observation}
                                onChange={(e) => setEditRecreatedForm({ ...editRecreatedForm, observation: e.target.value })}
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                              />
                            </div>
                            <div>
                              <label className="font-semibold text-slate-700 block mb-1">Action</label>
                              <textarea
                                rows={2}
                                value={editRecreatedForm.action}
                                onChange={(e) => setEditRecreatedForm({ ...editRecreatedForm, action: e.target.value })}
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setRecreatedDeck(prev =>
                                    prev.map(c =>
                                      c.id === card.id
                                        ? {
                                            ...c,
                                            zone: editRecreatedForm.zone,
                                            role: editRecreatedForm.role,
                                            assessment: editRecreatedForm.assessment,
                                            observation: editRecreatedForm.observation,
                                            action: editRecreatedForm.action
                                          }
                                        : c
                                    )
                                  );
                                  setEditingRecreatedId(null);
                                  setEditRecreatedForm(null);
                                  showToast('Updated recreated card.');
                                }}
                                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md cursor-pointer"
                              >
                                Save Changes
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <p className="text-slate-900 leading-relaxed">
                              <span className="font-semibold">New Observation:</span> {card.observation}
                            </p>
                            <p className="text-slate-700 leading-relaxed">
                              <span className="font-semibold">New Action:</span> {card.action}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* =====================================================================
              TAB 1: CATEGORIZED CARD BANK, MANUAL FORM & DUPLICATE BLOCKER
          ===================================================================== */}
          {activeTab === 'library' && (
            <div className="space-y-5">
              {/* Saturation & Batch Activation Bar */}
              <div className="bg-slate-900 text-white rounded-xl p-4 border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-xs sm:text-sm font-bold text-white block">
                      Categorized AI Ideas Card Bank &amp; Active Exemplar Pool ({completionPercent}% Active)
                    </span>
                    <p className="text-[11px] text-slate-300">
                      Select any saved ideas or an entire category below to either <strong>Submit Again Directly to Rig 50</strong> or <strong>AI Recreate for New Submissions</strong>.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleBulkToggle(true)}
                      disabled={activeCount === totalCount || totalCount === 0}
                      className="px-2.5 py-1 text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/30 rounded-lg flex items-center gap-1 transition-all disabled:opacity-40 cursor-pointer"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Activate All</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkToggle(false)}
                      disabled={activeCount === 0 || totalCount === 0}
                      className="px-2.5 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg flex items-center gap-1 transition-all disabled:opacity-40 cursor-pointer"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pause All</span>
                    </button>
                  </div>
                </div>

                <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-500"
                    style={{ width: `${Math.max(completionPercent, totalCount > 0 ? 3 : 0)}%` }}
                  />
                </div>
              </div>

              {/* CATEGORIZED CARD BANK FILTER PILLS */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-900">
                      Filter Card Bank by Category
                    </span>
                    <span className="text-[11px] text-slate-500">
                      ({filteredIdeas.length} showing)
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 text-[11px]">
                      {(['ALL', 'Safe', 'Unsafe'] as const).map(status => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => setFilterAssessment(status)}
                          className={`px-2 py-0.5 rounded font-semibold cursor-pointer transition-colors ${
                            filterAssessment === status
                              ? 'bg-slate-900 text-white'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {status === 'ALL' ? 'All Assessments' : status}
                        </button>
                      ))}
                    </div>

                    {selectedCategoryFilter !== 'ALL' && filteredIdeas.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedIdeaIds(new Set(filteredIdeas.map(i => i.id)));
                          showToast(`Selected all ${filteredIdeas.length} cards in "${selectedCategoryFilter}".`);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer"
                      >
                        Select Entire Category ({filteredIdeas.length})
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryFilter('ALL')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 border ${
                      selectedCategoryFilter === 'ALL'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    <span>All Categories</span>
                    <span className={`font-mono text-[11px] px-1.5 py-0.2 rounded ${
                      selectedCategoryFilter === 'ALL' ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {ideas.length}
                    </span>
                  </button>

                  {allCategoryNames.map(cat => {
                    const count = categoryBreakdown[cat] || 0;
                    const active = selectedCategoryFilter === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategoryFilter(cat)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 border ${
                          active
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs font-semibold'
                            : count > 0
                              ? 'bg-white text-slate-800 border-slate-200 hover:border-indigo-300'
                              : 'bg-slate-100/70 text-slate-400 border-slate-200/70 hover:text-slate-600'
                        }`}
                      >
                        <span>{cat}</span>
                        <span className={`font-mono text-[11px] px-1.5 py-0.2 rounded ${
                          active ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ADD NEW IDEA FORM WITH SMART DUPLICATE & SIMILARITY BLOCKER */}
              {isAddingNew && (
                <form onSubmit={handleSaveIdea} className="bg-white rounded-xl border border-slate-300 p-4 sm:p-5 space-y-4 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                        Add New Categorized AI Training Idea (With Smart Duplicate Guard)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Write a rough concept and click "Polish Draft with AI", or use a 1-click starter preset below.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handlePolishManualFormDraft}
                      disabled={isPolishingFormDraft || (!observation.trim() && !topic.trim())}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer self-start sm:self-auto"
                    >
                      {isPolishingFormDraft ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                      <span>Polish Draft with AI</span>
                    </button>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-700 block">
                      1-Click Starter Concepts:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_PRESETS.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleApplyPreset(preset)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 text-xs font-medium rounded-md border border-slate-200 transition-colors cursor-pointer"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Smart Duplicate & Similarity Blocker Warning Banner */}
                  {formSimilarityCheck.score >= 70 && (
                    <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-950 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                          <span>
                            Smart Duplicate Blocker: <span className="font-mono tabular-nums">{formSimilarityCheck.score}%</span> similarity with existing idea "{formSimilarityCheck.matchedTopic}"
                          </span>
                        </span>
                      </div>
                      <label className="flex items-center gap-2 text-xs text-amber-900 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={overrideDuplicateWarning}
                          onChange={(e) => setOverrideDuplicateWarning(e.target.checked)}
                          className="rounded border-amber-400 text-amber-700"
                        />
                        <span>Override duplicate blocker and save this idea anyway</span>
                      </label>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Idea Topic / Operational Concept *
                      </label>
                      <input
                        type="text"
                        required
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="e.g. Mud Pump Liner Lockdown Verification"
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Card Bank Category *
                      </label>
                      <select
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none font-semibold text-indigo-950"
                      >
                        {AI_IDEA_CATEGORIES.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">Operational Zone</label>
                      <select
                        value={zone}
                        onChange={(e) => setZone(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                      >
                        {RIG_50_ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">Crew Role</label>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                      >
                        {RIG_50_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">Assessment</label>
                      <select
                        value={assessment}
                        onChange={(e) => setAssessment(e.target.value as 'Safe' | 'Unsafe')}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                      >
                        <option value="Safe">Safe (Positive Recognition)</option>
                        <option value="Unsafe">Unsafe (Corrective Action / Hazard)</option>
                      </select>
                    </div>

                    <div className="sm:col-span-3">
                      <label className="text-xs font-semibold text-slate-700 block mb-1">Observation Type (Q6)</label>
                      <select
                        value={obsType}
                        onChange={(e) => setObsType(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                      >
                        <option value="Behavior Observation">Behavior Observation</option>
                        <option value="Condition">Condition (Equipment &amp; Area)</option>
                        <option value="STOP Work Authority (SWA)">STOP Work Authority (SWA)</option>
                        <option value="Stop Work Authority Drill">Stop Work Authority Drill</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Observation Concept / Exemplar *
                    </label>
                    <textarea
                      required
                      rows={2}
                      value={observation}
                      onChange={(e) => setObservation(e.target.value)}
                      placeholder="Describe the safety concept or observation..."
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-indigo-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Corrective Action / Commendation Concept *
                    </label>
                    <textarea
                      required
                      rows={2}
                      value={action}
                      onChange={(e) => setAction(e.target.value)}
                      placeholder="Describe the corrective action or safety recognition..."
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-indigo-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Equipment Tags &amp; Barrier Keywords (Comma separated)
                    </label>
                    <input
                      type="text"
                      value={keywords}
                      onChange={(e) => setKeywords(e.target.value)}
                      placeholder="e.g. hands-free, push stick, tubulars, pinch point"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setIsAddingNew(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingIdea || (formSimilarityCheck.score >= 70 && !overrideDuplicateWarning)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer"
                    >
                      {savingIdea ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>Save Training Idea to Database</span>
                    </button>
                  </div>
                </form>
              )}

              {/* AI TEST OUTPUT PREVIEW */}
              {testResult && (
                <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-4 space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span>Fresh SOAR Card Synthesized from Concept "{testResult.sourceIdeaTopic}":</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setTestResult(null)}
                      className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      Close
                    </button>
                  </div>

                  <div className="bg-white p-3.5 rounded-lg border border-indigo-100 text-xs space-y-1.5">
                    <div className="text-slate-500 font-medium">
                      {testResult.zone || 'Rig Floor'} · {testResult.role || 'Floorman'} · {testResult.assessment || 'Safe'} · {testResult.obsType || 'Behavior Observation'}
                    </div>
                    <p className="text-slate-900 leading-relaxed">
                      <strong>Observation:</strong> {testResult.observation}
                    </p>
                    <p className="text-slate-700 leading-relaxed">
                      <strong>Action:</strong> {testResult.action}
                    </p>
                  </div>
                </div>
              )}

              {/* FILTER BAR, CARD BANK ACTION BAR & IDEA LIST */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
                    <button
                      type="button"
                      onClick={() => setFilterStatus('all')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        filterStatus === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All ({ideas.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterStatus('active')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        filterStatus === 'active' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Active ({activeCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterStatus('paused')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        filterStatus === 'paused' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Paused ({pausedCount})
                    </button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {filteredIdeas.length > 0 && (
                      <button
                        type="button"
                        onClick={handleSelectAllVisible}
                        className="text-xs text-slate-700 hover:text-slate-900 font-semibold px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                      >
                        {selectedIdeaIds.size === filteredIdeas.length && filteredIdeas.length > 0
                          ? `Deselect All (${filteredIdeas.length})`
                          : `Select All Visible (${filteredIdeas.length})`}
                      </button>
                    )}

                    {ideas.length > 0 && (
                      <div>
                        {isConfirmingClearAll ? (
                          <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-300 px-2.5 py-1 rounded-md">
                            <span className="text-xs font-bold text-rose-800">Clear all {ideas.length}?</span>
                            <button
                              type="button"
                              onClick={executeClearAll}
                              className="px-2 py-0.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded cursor-pointer"
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsConfirmingClearAll(false)}
                              className="px-2 py-0.5 text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 rounded cursor-pointer"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setIsConfirmingClearAll(true)}
                            className="px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-md border border-rose-200 flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Clear All</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* =================================================================
                    CARD BANK SELECTION ACTION BAR:
                    1. Submit Selected Again Directly to Rig 50
                    2. AI Recreate Selected for New Submissions
                    3. Bulk Assign Category
                    4. Delete Selected
                ================================================================= */}
                {selectedIdeaIds.size > 0 && (
                  <div className="bg-slate-900 text-white border border-slate-800 p-3.5 rounded-xl space-y-3 shadow-md">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="px-2.5 py-1 bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 font-mono font-bold text-xs rounded-lg">
                          {selectedIdeaIds.size} Card{selectedIdeaIds.size === 1 ? '' : 's'} Selected in Bank
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedIdeaIds(new Set())}
                          className="text-xs text-slate-300 hover:text-white underline cursor-pointer"
                        >
                          Clear Selection
                        </button>

                        <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 text-xs">
                          <span className="text-slate-300">Date:</span>
                          <input
                            type="date"
                            value={bankSubmitDate}
                            onChange={(e) => setBankSubmitDate(e.target.value)}
                            className="bg-transparent text-white font-mono text-xs outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Action 1: Submit Again Directly to Rig 50 */}
                        <button
                          type="button"
                          disabled={isSubmittingBank || isRecreatingFromBank}
                          onClick={() => handleDirectSubmitIdeasFromBank()}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-lg flex items-center gap-1.5 text-xs cursor-pointer shadow-2xs"
                          title="Submit the selected AI Training Ideas directly to Rig 50 Microsoft Forms right now"
                        >
                          {isSubmittingBank ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          <span>Submit Selected Again ({selectedIdeaIds.size})</span>
                        </button>

                        {/* Action 2: AI Recreate Selected for New Submissions */}
                        <button
                          type="button"
                          disabled={isRecreatingFromBank || isSubmittingBank}
                          onClick={() => handleRecreateSelectedIdeasForNewSubmission()}
                          className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold rounded-lg flex items-center gap-1.5 text-xs cursor-pointer shadow-2xs"
                          title="Use Gemini AI to recreate the selected ideas into freshly worded SOAR cards for new submissions"
                        >
                          {isRecreatingFromBank ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          <span>AI Recreate for New Submission ({selectedIdeaIds.size})</span>
                        </button>

                        {/* Action 3: Send Selected to Mass Submitter */}
                        <button
                          type="button"
                          onClick={handleSendSelectedBankToMassSubmitter}
                          className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg flex items-center gap-1.5 text-xs cursor-pointer shadow-2xs"
                          title="Switch to Mass Submitter and load these selected Card Bank ideas into the Mass Preview Deck"
                        >
                          <Rocket className="w-3.5 h-3.5" />
                          <span>Send to Mass Submitter ({selectedIdeaIds.size})</span>
                        </button>

                        {/* Delete Selected */}
                        <button
                          type="button"
                          disabled={isDeletingBatch}
                          onClick={executeDeleteSelected}
                          className="px-2.5 py-1.5 bg-rose-600/90 hover:bg-rose-600 text-white font-semibold rounded-lg flex items-center gap-1 text-xs cursor-pointer"
                        >
                          {isDeletingBatch ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>

                    {/* Optional AI Recreation Instruction & Bulk Category Assignment */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 pt-2 border-t border-slate-800 text-xs">
                      <div className="md:col-span-7 flex items-center gap-2">
                        <span className="text-slate-400 shrink-0">AI Recreate Rule:</span>
                        <input
                          type="text"
                          value={bankRecreateInstruction}
                          onChange={(e) => setBankRecreateInstruction(e.target.value)}
                          placeholder="Optional rule when recreating (e.g. 'No time stamps, focus on night shift rain conditions')"
                          className="w-full px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 outline-none focus:border-teal-400"
                        />
                      </div>

                      <div className="md:col-span-5 flex items-center justify-end gap-1.5">
                        <span className="text-slate-400 shrink-0">Move Selected to Category:</span>
                        <select
                          value={bulkCategoryValue}
                          onChange={(e) => setBulkCategoryValue(e.target.value)}
                          className="px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs outline-none"
                        >
                          {AI_IDEA_CATEGORIES.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={handleBulkAssignCategory}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg cursor-pointer shrink-0"
                        >
                          Apply
                        </button>
                      </div>
                    </div>

                    {isSubmittingBank && (
                      <div className="bg-emerald-950/90 border border-emerald-700 rounded-lg p-2.5 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-emerald-200 font-mono">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                          <span>Submitting selected Card Bank ideas to Rig 50 ({bankSubmitProgress.current} / {bankSubmitProgress.total})...</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => { abortBankSubmitRef.current = true; }}
                          className="px-2 py-0.5 bg-rose-700 hover:bg-rose-600 text-white rounded font-semibold cursor-pointer"
                        >
                          Stop
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {ideas.length > 0 && (
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Card Bank by category, topic, equipment, zone, role, or keywords..."
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 outline-none"
                  />
                )}

                {isLoading ? (
                  <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                    <span>Loading categorized Card Bank from Firestore database...</span>
                  </div>
                ) : filteredIdeas.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 space-y-2">
                    <Lightbulb className="w-7 h-7 text-slate-400 mx-auto" />
                    <p className="text-xs text-slate-700 font-semibold">
                      {ideas.length === 0 ? 'No training ideas saved in database yet.' : 'No matching ideas found in this category/filter.'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {selectedCategoryFilter !== 'ALL'
                        ? 'Click "All Categories" above to see all saved cards, or add new ideas to this category.'
                        : 'Switch to "Spreadsheet Importer" or save cards from the Operations page.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredIdeas.map((idea) => {
                      const ideaCategory = getIdeaCategory(idea);
                      const cleanKeywords = getCleanIdeaKeywords(idea.keywords);
                      const wasSubmittedInSession = submittedBankIdeaIds.has(idea.id);

                      return (
                        <div
                          key={idea.id}
                          className={`p-4 rounded-xl border transition-all space-y-2.5 ${
                            selectedIdeaIds.has(idea.id)
                              ? 'bg-indigo-50/30 border-indigo-300 shadow-2xs'
                              : idea.isActive
                                ? 'bg-white border-slate-200 hover:border-slate-300'
                                : 'bg-slate-50 border-slate-200 opacity-65'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <input
                                  type="checkbox"
                                  checked={selectedIdeaIds.has(idea.id)}
                                  onChange={() => handleToggleSelectIdea(idea.id)}
                                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />
                                <span className="font-bold text-slate-900 text-xs sm:text-sm">
                                  {idea.topic}
                                </span>

                                {/* Interactive Category Badge / Selector */}
                                <select
                                  value={ideaCategory}
                                  onChange={(e) => handleAssignCategoryToIdea(idea, e.target.value)}
                                  title="Click to change this card's category in the Card Bank"
                                  className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200 cursor-pointer outline-none hover:bg-indigo-100"
                                >
                                  {allCategoryNames.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                  ))}
                                </select>

                                {wasSubmittedInSession && (
                                  <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-md flex items-center gap-1">
                                    <Check className="w-3 h-3" /> Submitted to Rig 50
                                  </span>
                                )}
                              </div>

                              {/* Clean unboxed metadata with typographic separators */}
                              <div className="text-xs text-slate-500 pl-6 font-mono tabular-nums">
                                <span>{idea.zone || 'Rig Floor'}</span>
                                <span className="mx-1.5">·</span>
                                <span>{idea.role || 'Floorman'}</span>
                                <span className="mx-1.5">·</span>
                                <span className={idea.assessment === 'Unsafe' ? 'text-rose-700 font-semibold' : 'text-emerald-700 font-semibold'}>
                                  {idea.assessment || 'Safe'}
                                </span>
                                <span className="mx-1.5">·</span>
                                <span>{idea.obsType || 'Behavior Observation'}</span>
                                <span className="mx-1.5">·</span>
                                <span>Used {idea.usageCount || 0} times</span>
                              </div>
                            </div>

                            {/* Per-Card Action Buttons: Submit Again, Recreate for New Submission, AI Re-Polish, Active Toggle, Delete */}
                            <div className="flex items-center gap-1.5 self-end sm:self-auto flex-wrap">
                              <button
                                type="button"
                                onClick={() => handleDirectSubmitIdeasFromBank([idea])}
                                disabled={isSubmittingBank}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                                title="Submit this card directly to Rig 50 Microsoft Forms right now"
                              >
                                <Send className="w-3 h-3" />
                                <span>Submit Again</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleRecreateSelectedIdeasForNewSubmission([idea])}
                                disabled={isRecreatingFromBank}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                                title="Use Gemini AI to recreate this idea into a fresh SOAR card for a new submission"
                              >
                                <Sparkles className="w-3 h-3" />
                                <span>AI Recreate</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleRepolishExistingIdea(idea)}
                                disabled={repolishingIdeaId === idea.id}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                                title="Rewrite and improve this idea's observation, action, and keywords in-place using Gemini AI"
                              >
                                {repolishingIdeaId === idea.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Wand2 className="w-3.5 h-3.5" />
                                )}
                                <span>Re-Polish</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleActive(idea)}
                                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                                  idea.isActive
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-300'
                                }`}
                              >
                                {idea.isActive ? 'Active' : 'Paused'}
                              </button>

                              {confirmDeleteId === idea.id ? (
                                <div className="flex items-center gap-1 bg-rose-50 border border-rose-300 px-2 py-0.5 rounded-lg">
                                  <span className="text-[11px] font-bold text-rose-700">Delete?</span>
                                  <button
                                    type="button"
                                    onClick={() => executeDelete(idea.id, idea.topic)}
                                    className="px-2 py-0.5 text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white rounded cursor-pointer"
                                  >
                                    Yes
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="px-1.5 py-0.5 text-[11px] bg-slate-200 hover:bg-slate-300 text-slate-700 rounded cursor-pointer"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(idea.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Delete training idea"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="text-xs space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <p className="text-slate-800 leading-relaxed">
                              <span className="font-semibold text-slate-900">Observation Concept:</span> {idea.observation}
                            </p>
                            <p className="text-slate-600 leading-relaxed">
                              <span className="font-semibold text-slate-700">Action Concept:</span> {idea.action}
                            </p>
                          </div>

                          {cleanKeywords && (
                            <div className="text-[11px] text-slate-500 pl-1">
                              Keywords: {cleanKeywords}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-600 font-mono tabular-nums">
            {activeCount} of {ideas.length} ideas active ({completionPercent}%) · {totalAiGenerationsInfluenced} total AI generations · Firestore Database
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
