import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Upload, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Download, 
  Trash2, 
  Shield, 
  Send,
  FileCheck,
  Sliders,
  Check,
  Lock,
  KeyRound,
  CheckSquare,
  Square,
  MinusSquare,
  Edit3,
  X,
  StopCircle,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Brain,
  BookmarkPlus,
  Eye,
  EyeOff,
  Clock,
  Plus,
  FolderKanban,
  Layers,
  BookOpen,
  Calendar,
  Search,
  RefreshCw
} from 'lucide-react';
import { 
  extractTextFromOperationsFile,
  generateCardsFromOperations, 
  remakeCardWithAI,
  generateAiCardsFromOperations,
  convertAiTrainingIdeaToSoarCard,
  parseOperationsInstructionConstraints,
  GeneratedSoarCard,
  DRILLING_ACTIVITY_TEMPLATES 
} from '../utils/operationsParser';
import { RIG_50_NAME, USER_TENANT_ID, USER_OWNER_ID, USER_FORM_ID } from '../utils/defaultForm';
import { useSupervisor } from '../context/SupervisorAuthContext';
import {
  AiTrainingIdea,
  AI_IDEA_CATEGORIES,
  getIdeaCategory,
  setIdeaCategoryInKeywords,
  getCleanIdeaKeywords,
  saveAiTrainingIdeaToFirestore,
  saveBatchAiTrainingIdeasToFirestore,
  subscribeToAiTrainingIdeas,
  incrementIdeaUsageInFirestore,
  recordCardToFirestore,
  OperationsSubmissionLogEntry,
  OperationsSubmissionCardReceipt,
  saveOperationsSubmissionLogToFirestore,
  deleteOperationsSubmissionLogFromFirestore,
  clearOperationsSubmissionLogsInFirestore,
  subscribeToOperationsSubmissionLogs
} from '../firebase';

interface OperationsPdfReaderProps {
  onSendToMassSubmitter?: (cards: GeneratedSoarCard[]) => void;
}

export interface UploadedOperationsDoc {
  id: string;
  name: string;
  fileType: 'pdf' | 'word' | 'excel' | 'text';
  summaryLabel: string;
  extractedText: string;
  charCount: number;
}

export const OperationsPdfReader: React.FC<OperationsPdfReaderProps> = () => {
  const { isSupervisor, openLoginModal } = useSupervisor();

  // Multi-file uploaded documents state (PDF, Word, Excel, Text)
  const [uploadedDocs, setUploadedDocs] = useState<UploadedOperationsDoc[]>([]);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractingFileNames, setExtractingFileNames] = useState<string[]>([]);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);

  // Dedicated Additional Instructions state (NEVER overwritten by extracted file text!)
  const [additionalInstructions, setAdditionalInstructions] = useState<string>('');
  const [excludeTimeInCards, setExcludeTimeInCards] = useState<boolean>(true);

  // Card generation parameters
  const [cardCount, setCardCount] = useState<number>(50);
  const [reportDate, setReportDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [generatedCards, setGeneratedCards] = useState<GeneratedSoarCard[]>([]);
  const [aiGenProgress, setAiGenProgress] = useState<{ current: number; total: number } | null>(null);

  // Selection state
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());

  // AI Training Ideas & Categorized Card Bank state
  const [savedToAiIdeasIds, setSavedToAiIdeasIds] = useState<Set<string>>(new Set());
  const [isSavingToAiIdeas, setIsSavingToAiIdeas] = useState<boolean>(false);
  const [autoSaveToAiIdeasOnSubmit, setAutoSaveToAiIdeasOnSubmit] = useState<boolean>(false);
  const [showCardBankDrawer, setShowCardBankDrawer] = useState<boolean>(false);
  const [bankIdeas, setBankIdeas] = useState<AiTrainingIdea[]>([]);
  const [selectedBankCategory, setSelectedBankCategory] = useState<string>('ALL');
  const [bankSearchQuery, setBankSearchQuery] = useState<string>('');
  const [selectedBankIdeaIds, setSelectedBankIdeaIds] = useState<Set<string>>(new Set());
  const [isRecreatingFromBank, setIsRecreatingFromBank] = useState<boolean>(false);
  const [bankRecreateProgress, setBankRecreateProgress] = useState<{ current: number; total: number } | null>(null);

  useEffect(() => {
    if (!isSupervisor) return;
    const unsub = subscribeToAiTrainingIdeas((loaded) => {
      if (loaded && loaded.length > 0) {
        setBankIdeas(loaded);
      } else {
        fetch('/api/training-ideas')
          .then(r => r.json())
          .then(d => {
            if (d.success && Array.isArray(d.ideas)) setBankIdeas(d.ideas);
          })
          .catch(() => {});
      }
    });
    return () => unsub();
  }, [isSupervisor]);

  const bankCategoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    AI_IDEA_CATEGORIES.forEach(c => { counts[c] = 0; });
    bankIdeas.forEach(idea => {
      const cat = getIdeaCategory(idea);
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [bankIdeas]);

  const filteredBankIdeas = useMemo(() => {
    return bankIdeas.filter(idea => {
      if (selectedBankCategory !== 'ALL' && getIdeaCategory(idea) !== selectedBankCategory) {
        return false;
      }
      if (bankSearchQuery.trim()) {
        const q = bankSearchQuery.toLowerCase();
        const cat = getIdeaCategory(idea).toLowerCase();
        const m =
          (idea.topic || '').toLowerCase().includes(q) ||
          (idea.observation || '').toLowerCase().includes(q) ||
          (idea.action || '').toLowerCase().includes(q) ||
          (idea.zone || '').toLowerCase().includes(q) ||
          (idea.role || '').toLowerCase().includes(q) ||
          cat.includes(q);
        if (!m) return false;
      }
      return true;
    });
  }, [bankIdeas, selectedBankCategory, bankSearchQuery]);

  // Remake / Edit state
  const [remakingCardId, setRemakingCardId] = useState<string | null>(null);
  const [remakingCardIds, setRemakingCardIds] = useState<Set<string>>(new Set());
  const [activeRemakeMenuId, setActiveRemakeMenuId] = useState<string | null>(null);
  const [customPromptCardId, setCustomPromptCardId] = useState<string | null>(null);
  const [customPromptText, setCustomPromptText] = useState<string>('');
  const [isGeneratingWithAi, setIsGeneratingWithAi] = useState<boolean>(false);
  const [isBulkRemakingAi, setIsBulkRemakingAi] = useState<boolean>(false);
  const [aiStatusNotice, setAiStatusNotice] = useState<string | null>(null);
  const [aiErrorNotice, setAiErrorNotice] = useState<string | null>(null);
  const [activeModelName, setActiveModelName] = useState<string>('gemini-4-hydrogen');
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<{
    observation: string;
    action: string;
    zone: string;
    assessment: 'Safe' | 'Unsafe';
    obsType: string;
    role: string;
  } | null>(null);

  // Submission state
  const [isSubmittingDirect, setIsSubmittingDirect] = useState<boolean>(false);
  const [submitProgress, setSubmitProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [submitSuccessCount, setSubmitSuccessCount] = useState<number>(0);
  const [submittedCardIds, setSubmittedCardIds] = useState<Set<string>>(new Set());
  const abortSubmitRef = useRef<boolean>(false);

  // Operations PDF -> SOAR Submission Book Log state (persisted in Firestore)
  const [submissionLogs, setSubmissionLogs] = useState<OperationsSubmissionLogEntry[]>([]);
  const [showSubmissionBookLog, setShowSubmissionBookLog] = useState<boolean>(true);
  const [bookLogViewMode, setBookLogViewMode] = useState<'runs' | 'daily'>('runs');
  const [bookLogSearch, setBookLogSearch] = useState<string>('');
  const [bookLogDateFilter, setBookLogDateFilter] = useState<string>('');
  const [expandedLogEntryId, setExpandedLogEntryId] = useState<string | null>(null);
  const [isConfirmingClearBookLog, setIsConfirmingClearBookLog] = useState<boolean>(false);

  useEffect(() => {
    if (!isSupervisor) return;
    const unsubLogs = subscribeToOperationsSubmissionLogs((loadedLogs) => {
      if (Array.isArray(loadedLogs)) {
        setSubmissionLogs(loadedLogs);
      }
    });
    return () => unsubLogs();
  }, [isSupervisor]);

  const bookLogStats = useMemo(() => {
    const todayIso = new Date().toISOString().split('T')[0];
    let totalCardsAllTime = 0;
    let totalSafeAllTime = 0;
    let totalUnsafeAllTime = 0;
    let todayCardsCount = 0;
    let todayRunsCount = 0;

    submissionLogs.forEach(entry => {
      const count = Number(entry.submittedCount) || 0;
      totalCardsAllTime += count;
      totalSafeAllTime += Number(entry.safeCount) || 0;
      totalUnsafeAllTime += Number(entry.unsafeCount) || 0;
      const entryDate = (entry.submittedDateDisplay || entry.submittedAtIso || '').slice(0, 10);
      if (entryDate === todayIso) {
        todayCardsCount += count;
        todayRunsCount += 1;
      }
    });

    return {
      totalCardsAllTime,
      totalSafeAllTime,
      totalUnsafeAllTime,
      todayCardsCount,
      todayRunsCount,
      totalRuns: submissionLogs.length,
      latestEntry: submissionLogs[0] || null
    };
  }, [submissionLogs]);

  const filteredSubmissionLogs = useMemo(() => {
    return submissionLogs.filter(entry => {
      if (bookLogDateFilter) {
        const entryDate = (entry.submittedDateDisplay || entry.submittedAtIso || '').slice(0, 10);
        if (entryDate !== bookLogDateFilter && entry.reportDate !== bookLogDateFilter) {
          return false;
        }
      }
      if (bookLogSearch.trim()) {
        const q = bookLogSearch.toLowerCase();
        const filesStr = (entry.sourceFiles || []).join(' ').toLowerCase();
        const dateStr = `${entry.submittedDateDisplay || ''} ${entry.submittedTimeDisplay || ''} ${entry.reportDate || ''}`.toLowerCase();
        const cardMatch = (entry.cards || []).some(
          c =>
            (c.zone || '').toLowerCase().includes(q) ||
            (c.role || '').toLowerCase().includes(q) ||
            (c.observation || '').toLowerCase().includes(q) ||
            (c.topic || '').toLowerCase().includes(q) ||
            (c.responseId || '').toLowerCase().includes(q)
        );
        if (!filesStr.includes(q) && !dateStr.includes(q) && !cardMatch) {
          return false;
        }
      }
      return true;
    });
  }, [submissionLogs, bookLogDateFilter, bookLogSearch]);

  const dailyAggregatedLogs = useMemo(() => {
    const map = new Map<
      string,
      {
        date: string;
        runsCount: number;
        totalCards: number;
        safeCount: number;
        unsafeCount: number;
        conditionCount: number;
        behaviorCount: number;
        swaCount: number;
        firstTime: string;
        lastTime: string;
        files: Set<string>;
      }
    >();

    filteredSubmissionLogs.forEach(entry => {
      const dateKey = (entry.submittedDateDisplay || entry.submittedAtIso || '').slice(0, 10) || 'Unknown Date';
      const existing = map.get(dateKey) || {
        date: dateKey,
        runsCount: 0,
        totalCards: 0,
        safeCount: 0,
        unsafeCount: 0,
        conditionCount: 0,
        behaviorCount: 0,
        swaCount: 0,
        firstTime: entry.submittedTimeDisplay || '',
        lastTime: entry.submittedTimeDisplay || '',
        files: new Set<string>()
      };
      existing.runsCount += 1;
      existing.totalCards += Number(entry.submittedCount) || 0;
      existing.safeCount += Number(entry.safeCount) || 0;
      existing.unsafeCount += Number(entry.unsafeCount) || 0;
      existing.conditionCount += Number(entry.conditionCount) || 0;
      existing.behaviorCount += Number(entry.behaviorCount) || 0;
      existing.swaCount += Number(entry.swaCount) || 0;
      if (entry.submittedTimeDisplay) {
        existing.firstTime = entry.submittedTimeDisplay;
      }
      (entry.sourceFiles || []).forEach(f => existing.files.add(f));
      map.set(dateKey, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredSubmissionLogs]);

  // Live parsed constraints preview so the user can see every enforced rule before clicking Generate
  const activeInstructionConstraints = useMemo(() => {
    const combined = [
      excludeTimeInCards ? 'Do not include any time or timestamps' : '',
      additionalInstructions
    ].filter(Boolean).join('\n');
    return parseOperationsInstructionConstraints(combined);
  }, [excludeTimeInCards, additionalInstructions]);

  // Sample Daily Operations Report (loaded as a virtual uploaded document so Additional Instructions stays empty!)
  const sampleOperationsReport = `RIG 50 (BOB PALMER - RBP-50A)
DAILY DRILLING & OPERATIONS REPORT (DDR)
DATE: 2026-09-30 | WELL: SAFANIYA-504 | WATER DEPTH: 165 FT

24-HOUR SUMMARY OF OPERATIONS:
Continued running 9-5/8" casing string from 6,200 ft to 8,450 ft. Circulated through casing fill-up tool every 10 joints. Set casing slips, installed casing safety clamp on rotary table. Casing crew observed 100% red zone clearance during elevators upward travel.
Rigged up cement head. Performed high-pressure line hammer union inspection and installed whipchecks on all treating iron. Pressure tested surface cementing lines to 4,500 psi for 10 minutes. Good test recorded on chart.
Pumped 50 bbls chemical wash spacer. Mixed and pumped 520 sacks Class G neat cement slurry at 15.8 ppg. Shaker hand wore full chemical goggles and face shield while taking cement fluid weight samples. Displaced slurry with 210 bbls brine. Bumped plug to 1,800 psi over final circulating pressure. Floats held.
Wait on cement (WOC). While WOC, conducted routine BOP accumulator function test and inspected closing bottles pressure gauges. All stations operational.
Supply vessel "Rawabi 32" alongside. Crane #1 discharged 12 casing baskets and chemical tote tanks to main deck. Rigger utilized hands-free push-pull poles and taglines on all suspended lifts. Crane operator paused lift when 22 kt wind gust exceeded boat cargo offload limit (SWA).
Welder conducted hot work in main deck workshop installing pipe ramp wear plates. Fire watch posted with charged foam extinguisher and fire blankets covering scupper drains. Continuous LEL monitoring 0%.
Picked up 8-1/2" directional BHA and mud motor from catwalk. Floorman and assistant driller made up bit and stabilizer with safety clamp secured on rig floor.`;

  // Combine extracted text from all uploaded documents
  const combinedDocumentsText = uploadedDocs
    .map(doc => `=== FILE: ${doc.name} (${doc.summaryLabel}) ===\n${doc.extractedText}`)
    .join('\n\n')
    .trim();

  // Build effective instructions combining the excludeTime toggle + user's Additional Instructions box
  const buildEffectiveInstructions = (extraPrompt?: string): string => {
    const parts: string[] = [];
    if (excludeTimeInCards) {
      parts.push('STRICT RULE: Do NOT include any clock times, hours, or time ranges (e.g. 00:00 - 03:30, 08:30 hrs, at 14:00) in any card observation, action, or snippet.');
    }
    if (additionalInstructions.trim()) {
      parts.push(additionalInstructions.trim());
    }
    if (extraPrompt && extraPrompt.trim()) {
      parts.push(extraPrompt.trim());
    }
    return parts.join('\n');
  };

  // Multi-file upload handler (PDF, Word .docx/.doc, Excel .xlsx/.xls/.csv, .txt)
  const handleMultipleFilesUpload = async (fileList: FileList | File[]) => {
    const filesArray = Array.from(fileList);
    if (filesArray.length === 0) return;

    setIsExtracting(true);
    setExtractingFileNames(filesArray.map(f => f.name));
    setExtractError(null);

    const newlyExtracted: UploadedOperationsDoc[] = [];
    const errors: string[] = [];

    for (const f of filesArray) {
      try {
        const result = await extractTextFromOperationsFile(f);
        newlyExtracted.push({
          id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: f.name,
          fileType: result.fileType,
          summaryLabel: result.summaryLabel,
          extractedText: result.text,
          charCount: result.text.length
        });
      } catch (err: any) {
        errors.push(`${f.name}: ${err.message || 'Could not extract file content'}`);
      }
    }

    if (newlyExtracted.length > 0) {
      setUploadedDocs(prev => {
        // Replace existing file if same name, otherwise append
        const incomingNames = new Set(newlyExtracted.map(d => d.name));
        const kept = prev.filter(d => !incomingNames.has(d.name));
        return [...kept, ...newlyExtracted];
      });
      showAiNotice(
        `📄 Extracted ${newlyExtracted.length} file${newlyExtracted.length === 1 ? '' : 's'} (${newlyExtracted.map(d => d.name).join(', ')}) into background memory.`
      );
    }

    if (errors.length > 0) {
      setExtractError(errors.join(' | '));
    }

    setIsExtracting(false);
    setExtractingFileNames([]);
  };

  const handleRemoveUploadedDoc = (docId: string) => {
    setUploadedDocs(prev => prev.filter(d => d.id !== docId));
    if (previewDocId === docId) {
      setPreviewDocId(null);
    }
  };

  const handleClearAllDocs = () => {
    setUploadedDocs([]);
    setPreviewDocId(null);
    setExtractError(null);
  };

  const handleLoadSample = () => {
    const sampleDoc: UploadedOperationsDoc = {
      id: `sample_rig50_ddr_${Date.now()}`,
      name: 'Rig50_Sample_Daily_Drilling_Report.pdf',
      fileType: 'pdf',
      summaryLabel: 'PDF · Sample Rig 50 DDR',
      extractedText: sampleOperationsReport,
      charCount: sampleOperationsReport.length
    };
    setUploadedDocs(prev => [
      ...prev.filter(d => !d.name.includes('Rig50_Sample_Daily_Drilling_Report')),
      sampleDoc
    ]);
    setExtractError(null);
    showAiNotice('✨ Loaded Sample Rig 50 Daily Drilling Report into Uploaded Files (Additional Instructions box kept clean!).');
  };

  const showAiNotice = (msg: string) => {
    setAiStatusNotice(msg);
    setTimeout(() => {
      setAiStatusNotice(prev => (prev === msg ? null : prev));
    }, 5500);
  };

  // Convert a GeneratedSoarCard into a categorized AiTrainingIdea for Firestore persistence
  const convertCardToAiTrainingIdea = (card: GeneratedSoarCard, idx = 0): AiTrainingIdea => {
    const cleanTopic = card.topic && card.topic.trim()
      ? card.topic.trim()
      : `${card.zone} · ${card.role} (${card.obsType})`;
    const snippetKeywords = (card.operationSnippet || '')
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3)
      .slice(0, 6)
      .join(', ');

    const rawKw = [card.zone, card.role, snippetKeywords].filter(Boolean).join(', ').slice(0, 400);
    const detectedCat = getIdeaCategory({
      topic: cleanTopic,
      zone: card.zone,
      role: card.role,
      assessment: card.assessment,
      obsType: card.obsType,
      observation: card.observation,
      action: card.action,
      keywords: rawKw
    });

    return {
      id: `idea_op_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      topic: cleanTopic.slice(0, 140),
      zone: card.zone,
      role: card.role,
      assessment: card.assessment,
      obsType: card.obsType,
      observation: card.observation,
      action: card.action,
      keywords: setIdeaCategoryInKeywords(rawKw, detectedCat),
      categoryGroup: detectedCat,
      isActive: true,
      usageCount: 0,
      lastUsedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
  };

  // Save a single card to AI Training Ideas
  const handleAddSingleCardToAiIdeas = async (card: GeneratedSoarCard) => {
    const idea = convertCardToAiTrainingIdea(card, 0);
    await saveAiTrainingIdeaToFirestore(idea);
    setSavedToAiIdeasIds(prev => new Set(prev).add(card.id));
    showAiNotice(`🧠 Added Card (${card.zone} · ${idea.categoryGroup}) to Categorized AI Ideas Card Bank!`);
  };

  // Save all currently selected cards to AI Training Ideas
  const handleAddSelectedCardsToAiIdeas = async () => {
    const selectedCards = generatedCards.filter(c => selectedCardIds.has(c.id));
    if (selectedCards.length === 0) return;

    setIsSavingToAiIdeas(true);
    try {
      const ideasToSave = selectedCards.map((c, idx) => convertCardToAiTrainingIdea(c, idx));
      await saveBatchAiTrainingIdeasToFirestore(ideasToSave);
      setSavedToAiIdeasIds(prev => {
        const next = new Set(prev);
        selectedCards.forEach(c => next.add(c.id));
        return next;
      });
      showAiNotice(`🧠 Saved ${selectedCards.length} selected card${selectedCards.length === 1 ? '' : 's'} into the Categorized AI Ideas Card Bank!`);
    } finally {
      setIsSavingToAiIdeas(false);
    }
  };

  // Load selected AI Training Ideas directly into the Operations cards deck to submit again
  const handleLoadSelectedFromBankAsIs = () => {
    const chosen = bankIdeas.filter(i => selectedBankIdeaIds.has(i.id));
    if (chosen.length === 0) return;

    const newCards = chosen.map((idea, idx) =>
      convertAiTrainingIdeaToSoarCard(idea, reportDate, getIdeaCategory(idea), idx)
    );
    setGeneratedCards(prev => [...newCards, ...prev]);
    setSelectedCardIds(prev => {
      const next = new Set(prev);
      newCards.forEach(c => next.add(c.id));
      return next;
    });
    incrementIdeaUsageInFirestore(chosen.map(i => i.id)).catch(() => {});
    showAiNotice(`📥 Loaded ${newCards.length} card(s) from the AI Ideas Card Bank into your deck ready to submit!`);
  };

  // Recreate selected AI Training Ideas with Gemini AI into brand-new SOAR cards for new submissions
  const handleRecreateSelectedFromBankWithAi = async () => {
    const chosen = bankIdeas.filter(i => selectedBankIdeaIds.has(i.id));
    if (chosen.length === 0) return;

    setIsRecreatingFromBank(true);
    setBankRecreateProgress({ current: 0, total: chosen.length });
    const effectiveInstr = buildEffectiveInstructions(
      'Synthesize a brand-new, freshly worded Rig 50 SOAR card inspired by this training concept so it reads as a completely new submission (never a duplicate).'
    );

    const recreatedList: GeneratedSoarCard[] = [];
    for (let idx = 0; idx < chosen.length; idx++) {
      setBankRecreateProgress({ current: idx + 1, total: chosen.length });
      const idea = chosen[idx];
      const cat = getIdeaCategory(idea);
      const baseCard = convertAiTrainingIdeaToSoarCard(idea, reportDate, cat, idx);
      const contextText = `Category: ${cat}\nConcept Topic: ${idea.topic}\nZone: ${idea.zone || 'Rig Floor'}\nRole: ${idea.role || 'Floorman'}\nExemplar Observation: ${idea.observation}\nExemplar Action: ${idea.action}\nKeywords: ${getCleanIdeaKeywords(idea.keywords)}`;

      try {
        const spun = await remakeCardWithAI(
          baseCard,
          contextText,
          [...generatedCards, ...recreatedList],
          {
            remakeMode: 'operations_ai',
            customInstruction: effectiveInstr
          }
        );
        recreatedList.push({
          ...spun,
          id: `bank_rec_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
          date: reportDate,
          operationSnippet: `[AI Recreated · ${cat}] ${idea.topic}`,
          aiPolished: true
        });
      } catch (e) {
        console.warn('Bank recreate notice:', e);
      }
    }

    if (recreatedList.length > 0) {
      setGeneratedCards(prev => [...recreatedList, ...prev]);
      setSelectedCardIds(prev => {
        const next = new Set(prev);
        recreatedList.forEach(c => next.add(c.id));
        return next;
      });
      incrementIdeaUsageInFirestore(chosen.map(i => i.id)).catch(() => {});
      showAiNotice(`✨ Gemini AI recreated ${recreatedList.length} fresh SOAR card(s) from your Card Bank for new submissions!`);
    }
    setIsRecreatingFromBank(false);
    setBankRecreateProgress(null);
  };

  // Primary Generator: Synthesizes 100% of requested cards using Gemini 4 Flash from all uploaded documents + instructions
  const handleGenerateCardsWithAi = async () => {
    const sourceText = combinedDocumentsText || additionalInstructions.trim();
    if (!sourceText) return;

    setIsGeneratingWithAi(true);
    setAiErrorNotice(null);
    setAiGenProgress({ current: 0, total: cardCount });
    const effectiveInstructions = buildEffectiveInstructions();

    showAiNotice(
      `⚡ Gemini 4 Flash (${activeModelName}) is reading ${uploadedDocs.length || 1} document(s) and synthesizing ${cardCount} operations SOAR cards strictly following your instructions...`
    );

    try {
      let usedModel = activeModelName;
      const allAiCards = await generateAiCardsFromOperations(
        sourceText,
        cardCount,
        reportDate,
        [],
        effectiveInstructions,
        (generatedSoFar, totalTarget, partialCards, modelUsed) => {
          if (modelUsed) {
            usedModel = modelUsed;
            setActiveModelName(modelUsed);
          }
          setAiGenProgress({ current: generatedSoFar, total: totalTarget });
          setGeneratedCards(partialCards);
          setSelectedCardIds(new Set(partialCards.map(c => c.id)));
        }
      );

      setGeneratedCards(allAiCards);
      setSelectedCardIds(new Set(allAiCards.map(c => c.id)));
      setSubmittedCardIds(new Set());
      setEditingCardId(null);
      setEditFormData(null);
      showAiNotice(
        `✨ ${usedModel} created ${allAiCards.length} unique operations cards (100% grounded in your uploaded files & instructions)!`
      );
    } catch (err: any) {
      const msg = err?.message || 'Gemini AI service error. Please try again.';
      setAiErrorNotice(msg);
      showAiNotice(`⚠️ ${msg}`);
    } finally {
      setIsGeneratingWithAi(false);
      setAiGenProgress(null);
    }
  };

  // Quick Line-by-Line Operations Extractor (still 100% grounded in uploaded files & obeying instructions)
  const handleGenerateCardsFromLines = () => {
    const sourceText = combinedDocumentsText || additionalInstructions.trim();
    if (!sourceText) return;
    const effectiveInstructions = buildEffectiveInstructions();
    const cards = generateCardsFromOperations(sourceText, cardCount, reportDate, effectiveInstructions);
    setGeneratedCards(cards);
    setSelectedCardIds(new Set(cards.map(c => c.id)));
    setSubmittedCardIds(new Set());
    setEditingCardId(null);
    setEditFormData(null);
    showAiNotice(`⚡ Extracted ${cards.length} operations cards directly from your uploaded document lines.`);
  };

  // Selection handlers
  const handleToggleCardSelection = (cardId: string) => {
    setSelectedCardIds(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedCardIds(new Set(generatedCards.map(c => c.id)));
  };

  const handleDeselectAll = () => {
    setSelectedCardIds(new Set());
  };

  const handleSelectSafeOnly = () => {
    setSelectedCardIds(new Set(generatedCards.filter(c => c.assessment === 'Safe').map(c => c.id)));
  };

  const handleSelectUnsafeOnly = () => {
    setSelectedCardIds(new Set(generatedCards.filter(c => c.assessment === 'Unsafe').map(c => c.id)));
  };

  // Remake single card handler using real Gemini AI without reloading page or losing list
  const handleRemakeCard = async (
    card: GeneratedSoarCard,
    preferredAssessment?: 'Safe' | 'Unsafe',
    options?: {
      preferredObsType?: string;
      remakeMode?: 'operations_ai' | 'non_safety_ai' | 'custom_ai';
      customInstruction?: string;
    }
  ) => {
    setRemakingCardId(card.id);
    setRemakingCardIds(prev => new Set(prev).add(card.id));
    setActiveRemakeMenuId(null);
    if (options?.customInstruction) {
      setCustomPromptCardId(null);
      setCustomPromptText('');
    }

    const sourceText = combinedDocumentsText || additionalInstructions.trim();
    const combinedCustomInstruction = buildEffectiveInstructions(options?.customInstruction);

    try {
      setAiErrorNotice(null);
      const remade = await remakeCardWithAI(card, sourceText, generatedCards, {
        preferredAssessment,
        preferredObsType: options?.preferredObsType,
        remakeMode: options?.remakeMode || 'operations_ai',
        customInstruction: combinedCustomInstruction
      });
      setGeneratedCards(prev => prev.map(c => (c.id === card.id ? remade : c)));
      showAiNotice(`✨ Gemini 4 Flash recreated Card (${remade.zone} · ${remade.assessment} · ${remade.obsType})!`);
    } catch (err: any) {
      const msg = err?.message || 'AI remake failed. Please try again.';
      setAiErrorNotice(msg);
      showAiNotice(`⚠️ ${msg}`);
    } finally {
      setRemakingCardId(prev => (prev === card.id ? null : prev));
      setRemakingCardIds(prev => {
        const next = new Set(prev);
        next.delete(card.id);
        return next;
      });
    }
  };

  // Bulk AI Remake for currently selected cards
  const handleBulkRemakeSelectedWithAi = async (mode: 'operations_ai' | 'non_safety_ai' = 'operations_ai') => {
    const selectedCards = generatedCards.filter(c => selectedCardIds.has(c.id));
    if (selectedCards.length === 0) return;

    const batchToRemake = selectedCards.slice(0, 15);
    setIsBulkRemakingAi(true);
    setAiErrorNotice(null);
    setRemakingCardIds(new Set(batchToRemake.map(c => c.id)));
    showAiNotice(`✨ Gemini 4 Flash is recreating ${batchToRemake.length} selected card(s)...`);

    const sourceText = combinedDocumentsText || additionalInstructions.trim();
    const combinedCustomInstruction = buildEffectiveInstructions();

    try {
      let succeeded = 0;
      for (const card of batchToRemake) {
        const remade = await remakeCardWithAI(card, sourceText, generatedCards, {
          remakeMode: mode,
          customInstruction: combinedCustomInstruction
        });
        setGeneratedCards(prev => prev.map(c => (c.id === card.id ? remade : c)));
        succeeded++;
        setRemakingCardIds(prev => {
          const next = new Set(prev);
          next.delete(card.id);
          return next;
        });
      }
      showAiNotice(`✨ Successfully recreated ${succeeded} card(s) with Gemini 4 Flash!`);
    } catch (err: any) {
      const msg = err?.message || 'Bulk AI remake interrupted. Please try again.';
      setAiErrorNotice(msg);
      showAiNotice(`⚠️ ${msg}`);
    } finally {
      setIsBulkRemakingAi(false);
      setRemakingCardIds(new Set());
    }
  };

  // Delete card handler
  const handleDeleteCard = (cardId: string) => {
    setGeneratedCards(prev => prev.filter(c => c.id !== cardId));
    setSelectedCardIds(prev => {
      const next = new Set(prev);
      next.delete(cardId);
      return next;
    });
    setSubmittedCardIds(prev => {
      const next = new Set(prev);
      next.delete(cardId);
      return next;
    });
    if (editingCardId === cardId) {
      setEditingCardId(null);
      setEditFormData(null);
    }
  };

  // Inline Edit handlers
  const handleStartEdit = (card: GeneratedSoarCard) => {
    setEditingCardId(card.id);
    setEditFormData({
      observation: card.observation,
      action: card.action,
      zone: card.zone,
      assessment: card.assessment,
      obsType: card.obsType,
      role: card.role
    });
  };

  const handleSaveEdit = (cardId: string) => {
    if (!editFormData) return;
    setGeneratedCards(prev => prev.map(c => {
      if (c.id === cardId) {
        return {
          ...c,
          observation: editFormData.observation.trim(),
          action: editFormData.action.trim(),
          zone: editFormData.zone,
          assessment: editFormData.assessment,
          obsType: editFormData.obsType,
          role: editFormData.role
        };
      }
      return c;
    }));
    setEditingCardId(null);
    setEditFormData(null);
  };

  const handleCancelEdit = () => {
    setEditingCardId(null);
    setEditFormData(null);
  };

  // Direct submit only selected cards to Rig 50 Microsoft Forms
  const handleDirectSubmitToRig50 = async () => {
    const cardsToSubmit = generatedCards.filter(c => selectedCardIds.has(c.id));
    if (cardsToSubmit.length === 0) return;

    // If user enabled "Also save selected cards to AI Training Ideas on submit", save them right away
    if (autoSaveToAiIdeasOnSubmit) {
      const ideasToSave = cardsToSubmit.map((c, idx) => convertCardToAiTrainingIdea(c, idx));
      saveBatchAiTrainingIdeasToFirestore(ideasToSave).catch(() => {});
      setSavedToAiIdeasIds(prev => {
        const next = new Set(prev);
        cardsToSubmit.forEach(c => next.add(c.id));
        return next;
      });
    }

    setIsSubmittingDirect(true);
    abortSubmitRef.current = false;
    setSubmitProgress({ current: 0, total: cardsToSubmit.length });
    setSubmitSuccessCount(0);

    const runStartTime = Date.now();
    const submittedReceipts: OperationsSubmissionCardReceipt[] = [];
    let actualSuccessCount = 0;

    for (let i = 0; i < cardsToSubmit.length; i++) {
      if (abortSubmitRef.current) {
        break;
      }

      setSubmitProgress({ current: i + 1, total: cardsToSubmit.length });
      const c = cardsToSubmit[i];

      const answers = [
        { questionId: 'r5f3272b6049d4ad18e7650bd96ae837b', answer1: c.date },
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
        const response = await fetch('/api/submit-response', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId: USER_TENANT_ID,
            userId: USER_OWNER_ID,
            formId: USER_FORM_ID,
            answers
          })
        });
        if (response.ok) {
          let respData: any = null;
          try {
            respData = await response.json();
          } catch {}
          const respId = String(respData?.responseId || `MS-OPS-${Date.now().toString().slice(-6)}-${i + 1}`);
          const cardTimeStr = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
          });

          actualSuccessCount += 1;
          setSubmitSuccessCount(actualSuccessCount);
          setSubmittedCardIds(prev => new Set(prev).add(c.id));

          // Record card to Firestore soarCards repository and anti-duplicate blacklist
          recordCardToFirestore({
            id: c.id,
            responseId: respId,
            date: c.date,
            time: cardTimeStr,
            zone: c.zone,
            role: c.role,
            observerRole: c.role,
            observerName: c.name || '(Anonymous)',
            assessment: c.assessment,
            obsType: (
              c.obsType === 'STOP Work Authority (SWA)' ||
              c.obsType === 'Condition' ||
              c.obsType === 'Stop Work Authority Drill'
                ? c.obsType
                : 'Behavior Observation'
            ),
            observation: c.observation,
            action: c.action,
            aiPolished: true
          }).catch(() => {});

          submittedReceipts.push({
            id: c.id,
            responseId: respId,
            date: c.date,
            time: cardTimeStr,
            zone: c.zone,
            role: c.role,
            observerName: c.name || '(Anonymous)',
            assessment: c.assessment,
            obsType: c.obsType,
            category: c.category,
            topic: c.topic || c.operationSnippet,
            observation: c.observation,
            action: c.action
          });
        }
      } catch (e) {
        console.error('Submit error:', e);
      }

      if (i < cardsToSubmit.length - 1 && !abortSubmitRef.current) {
        await new Promise(r => setTimeout(r, 600));
      }
    }

    // Record this submission run in the Operations PDF -> SOAR Submission Book Log in Firestore
    if (submittedReceipts.length > 0) {
      const now = new Date();
      let astTimeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      let dateStr = now.toISOString().split('T')[0];
      try {
        astTimeStr =
          new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Riyadh',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
          }).format(now) + ' AST';
        dateStr = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Riyadh',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).format(now);
      } catch {}

      const elapsedSec = ((Date.now() - runStartTime) / 1000).toFixed(1);
      const safeCount = submittedReceipts.filter(r => r.assessment === 'Safe').length;
      const unsafeCount = submittedReceipts.filter(r => r.assessment === 'Unsafe').length;
      const conditionCount = submittedReceipts.filter(r => r.obsType === 'Condition').length;
      const behaviorCount = submittedReceipts.filter(r => r.obsType === 'Behavior Observation').length;
      const swaCount = submittedReceipts.filter(r => r.obsType.includes('SWA') || r.obsType.includes('Stop Work')).length;

      const sourceFiles =
        uploadedDocs.length > 0
          ? uploadedDocs.map(d => d.name)
          : additionalInstructions.trim()
            ? ['Custom Operations Instructions']
            : ['Operations AI Deck / Card Bank'];

      const logEntry: OperationsSubmissionLogEntry = {
        id: `ops_log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        submittedAtIso: now.toISOString(),
        submittedDateDisplay: dateStr,
        submittedTimeDisplay: astTimeStr,
        reportDate: reportDate || cardsToSubmit[0]?.date || dateStr,
        submittedCount: submittedReceipts.length,
        attemptedCount: cardsToSubmit.length,
        safeCount,
        unsafeCount,
        conditionCount,
        behaviorCount,
        swaCount,
        durationSeconds: `${elapsedSec}s`,
        sourceFiles,
        customInstructions: additionalInstructions.trim() || undefined,
        status: abortSubmitRef.current
          ? 'aborted'
          : submittedReceipts.length === cardsToSubmit.length
            ? 'completed'
            : 'partial',
        cards: submittedReceipts
      };

      await saveOperationsSubmissionLogToFirestore(logEntry);
      setShowSubmissionBookLog(true);
      showAiNotice(
        `📖 Logged ${submittedReceipts.length} submitted card(s) at ${astTimeStr} (${dateStr}) in the Operations Submission Book Log!`
      );
    }

    setIsSubmittingDirect(false);
  };

  const handleExportBookLogCsv = () => {
    if (filteredSubmissionLogs.length === 0) return;
    const header =
      'LogID,SubmittedDate,SubmittedTime,ReportDate,CardsSubmitted,Attempted,SafeCount,UnsafeCount,ConditionCount,BehaviorCount,SWACount,Duration,SourceFiles,Status\n';
    const rows = filteredSubmissionLogs
      .map(
        l =>
          `"${l.id}","${l.submittedDateDisplay}","${l.submittedTimeDisplay}","${l.reportDate}",${l.submittedCount},${l.attemptedCount},${l.safeCount},${l.unsafeCount},${l.conditionCount},${l.behaviorCount},${l.swaCount},"${l.durationSeconds}","${(l.sourceFiles || []).join('; ').replace(/"/g, '""')}","${l.status}"`
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rig50_Operations_Submission_Book_Log_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const handleAbortSubmit = () => {
    abortSubmitRef.current = true;
  };

  const handleExportCsv = () => {
    const cardsToExport = generatedCards.filter(c => selectedCardIds.has(c.id));
    if (cardsToExport.length === 0) return;

    const header = 'Date,Rig,Zone,Role,ObserverName,Assessment,ObservationType,Category,Observation,Action\n';
    const rows = cardsToExport.map(c => 
      `"${c.date}","${c.rig}","${c.zone}","${c.role}","${c.name}","${c.assessment}","${c.obsType}","${c.category}","${c.observation.replace(/"/g, '""')}","${c.action.replace(/"/g, '""')}"`
    ).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rig50_Operations_SOAR_Cards_${reportDate}_(${cardsToExport.length}_selected).csv`;
    a.click();
  };

  // Append a quick rule instruction chip into the Additional Instructions box
  const handleAddQuickInstruction = (ruleText: string) => {
    setAdditionalInstructions(prev => {
      if (prev.toLowerCase().includes(ruleText.toLowerCase())) return prev;
      return prev.trim() ? `${prev.trim()}\n• ${ruleText}` : `• ${ruleText}`;
    });
  };

  // Detected activities across all uploaded files
  const lowerCombined = combinedDocumentsText.toLowerCase();
  const detectedTags = DRILLING_ACTIVITY_TEMPLATES.filter(t => 
    t.keywords.some(k => lowerCombined.includes(k))
  );

  const selectedCount = selectedCardIds.size;
  const totalCount = generatedCards.length;
  const isAllSelected = totalCount > 0 && selectedCount === totalCount;
  const isPartiallySelected = selectedCount > 0 && selectedCount < totalCount;
  const hasAnySource = uploadedDocs.length > 0 || additionalInstructions.trim().length > 0;

  if (!isSupervisor) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-10 shadow-xs max-w-xl mx-auto text-center space-y-5 my-8">
        <div className="w-16 h-16 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center mx-auto border border-teal-200 shadow-2xs">
          <Lock className="w-8 h-8 text-teal-700" />
        </div>
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
            Supervisor &amp; RSC Feature
          </span>
          <h3 className="text-lg sm:text-xl font-bold text-slate-900">
            Operations Document Synthesizer Locked
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
            Extracting Daily Drilling Reports (PDF, Word, Excel) and auto-generating official SOAR cards is restricted to Rig Safety Officers and Supervisors.
          </p>
        </div>

        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-left text-xs text-slate-700 space-y-2">
          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-teal-600" />
            <span>Rig 50 Crew Members:</span>
          </div>
          <p className="text-[11px] text-slate-600">
            Submit your individual cards anytime using the <strong>Quick Submitter</strong> or <strong>WhatsApp Bot</strong> tabs. No passcode required!
          </p>
        </div>

        <button
          type="button"
          onClick={() => openLoginModal('operations')}
          className="w-full py-3 px-4 bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
        >
          <KeyRound className="w-4 h-4" />
          <span>Enter Supervisor Passcode to Unlock</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-emerald-950 to-slate-900 rounded-xl p-5 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="p-1.5 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-400/30">
              <FileCheck className="w-5 h-5 text-teal-300" />
            </span>
            <h2 className="text-base sm:text-lg font-bold">
              Operations Multi-File (PDF / Word / Excel) &rarr; AI SOAR Synthesizer
            </h2>
            <span className="bg-emerald-500/30 text-emerald-200 text-[11px] font-bold px-2 py-0.5 rounded border border-emerald-400/40 font-mono">
              Gemini 4 Flash ({activeModelName})
            </span>
          </div>
          <p className="text-xs text-teal-100/80 max-w-2xl leading-relaxed">
            Upload multiple <strong>PDF</strong>, <strong>Word (.docx/.doc)</strong>, and <strong>Excel (.xlsx/.xls/.csv)</strong> operations files at once. Files are read in the background while the text box stays clean for your custom AI instructions!
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => setShowSubmissionBookLog(prev => !prev)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border transition-colors shadow-xs cursor-pointer ${
              showSubmissionBookLog
                ? 'bg-amber-500 text-slate-950 border-amber-300'
                : 'bg-slate-900/90 hover:bg-slate-800 text-amber-300 border-amber-500/40'
            }`}
            title="View the permanent Operations PDF -> SOAR Submission Book Log (How many cards submitted & when)"
          >
            <BookOpen className="w-4 h-4" />
            <span>
              📖 Submission Book Log ({bookLogStats.totalCardsAllTime} Cards · {bookLogStats.totalRuns} Runs)
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowCardBankDrawer(prev => !prev)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border transition-colors shadow-xs cursor-pointer ${
              showCardBankDrawer
                ? 'bg-indigo-600 text-white border-indigo-400'
                : 'bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 border-indigo-500/40'
            }`}
          >
            <FolderKanban className="w-4 h-4 text-indigo-300" />
            <span>
              {showCardBankDrawer ? 'Hide AI Ideas Card Bank' : `Categorized AI Ideas Card Bank (${bankIdeas.length})`}
            </span>
          </button>

          <button
            type="button"
            onClick={handleLoadSample}
            className="flex items-center gap-1.5 px-3 py-2 bg-teal-700/80 hover:bg-teal-600 text-white text-xs font-semibold rounded-lg border border-teal-500/40 transition-colors shadow-xs cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-teal-300" />
            <span>Load Sample Rig 50 Report</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          OPERATIONS PDF -> SOAR SUBMISSION BOOK LOG (HOW MANY CARDS SUBMITTED & WHEN)
      ===================================================================== */}
      {showSubmissionBookLog && (
        <div className="bg-white rounded-xl border-2 border-amber-300/90 shadow-sm overflow-hidden space-y-4 p-4 sm:p-5 animate-in fade-in">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 pb-3.5">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="p-1.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-300">
                  <BookOpen className="w-4 h-4 text-amber-800" />
                </span>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Operations PDF &rarr; SOAR Submission Book Log
                </h3>
                <span className="px-2.5 py-0.5 text-[11px] font-mono font-bold rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                  {bookLogStats.totalCardsAllTime} Total Cards Submitted
                </span>
                <span className="px-2.5 py-0.5 text-[11px] font-mono font-semibold rounded-full bg-slate-100 text-slate-800 border border-slate-300">
                  {bookLogStats.totalRuns} Logged Submission{bookLogStats.totalRuns === 1 ? '' : 's'}
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Permanent Firestore audit book log tracking <strong>how many cards were submitted</strong>, <strong>exact date &amp; clock time when submitted</strong>, source files, and individual card receipts.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* View Mode Switcher: By Submission Run vs Daily Totals */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setBookLogViewMode('runs')}
                  className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                    bookLogViewMode === 'runs'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📋 Submission Runs ({filteredSubmissionLogs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setBookLogViewMode('daily')}
                  className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                    bookLogViewMode === 'daily'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📅 Daily Totals ({dailyAggregatedLogs.length})
                </button>
              </div>

              {filteredSubmissionLogs.length > 0 && (
                <button
                  type="button"
                  onClick={handleExportBookLogCsv}
                  className="px-2.5 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg flex items-center gap-1.5 cursor-pointer"
                  title="Download the Operations Submission Book Log as a CSV spreadsheet"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Log CSV</span>
                </button>
              )}

              {submissionLogs.length > 0 && (
                isConfirmingClearBookLog ? (
                  <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-300 px-2.5 py-1 rounded-lg text-xs">
                    <span className="font-bold text-rose-800">Clear Book Log?</span>
                    <button
                      type="button"
                      onClick={async () => {
                        setIsConfirmingClearBookLog(false);
                        await clearOperationsSubmissionLogsInFirestore();
                        setSubmissionLogs([]);
                        showAiNotice('🗑️ Cleared Operations Submission Book Log in Firestore.');
                      }}
                      className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded cursor-pointer"
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsConfirmingClearBookLog(false)}
                      className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded cursor-pointer"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsConfirmingClearBookLog(true)}
                    className="px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Log</span>
                  </button>
                )
              )}

              <button
                type="button"
                onClick={() => setShowSubmissionBookLog(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                title="Hide Book Log"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 4 Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Total Cards Submitted
              </span>
              <div className="text-xl font-extrabold font-mono text-slate-900">
                {bookLogStats.totalCardsAllTime}
                <span className="text-xs font-normal text-slate-500 ml-1.5">cards</span>
              </div>
              <div className="text-[11px] text-slate-600 font-mono">
                {bookLogStats.totalSafeAllTime} Safe · {bookLogStats.totalUnsafeAllTime} Unsafe
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                Submitted Today
              </span>
              <div className="text-xl font-extrabold font-mono text-emerald-950">
                {bookLogStats.todayCardsCount}
                <span className="text-xs font-normal text-emerald-700 ml-1.5">cards today</span>
              </div>
              <div className="text-[11px] text-emerald-800 font-mono">
                Across {bookLogStats.todayRunsCount} batch{bookLogStats.todayRunsCount === 1 ? '' : 'es'} today
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-1">
              <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider block">
                Total Submission Batches
              </span>
              <div className="text-xl font-extrabold font-mono text-indigo-950">
                {bookLogStats.totalRuns}
                <span className="text-xs font-normal text-indigo-700 ml-1.5">runs logged</span>
              </div>
              <div className="text-[11px] text-indigo-800">
                Stored permanently in Firestore DB
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 space-y-1">
              <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider block">
                Last Submission (When &amp; Count)
              </span>
              {bookLogStats.latestEntry ? (
                <>
                  <div className="text-sm font-extrabold font-mono text-amber-950 truncate">
                    {bookLogStats.latestEntry.submittedCount} Cards · {bookLogStats.latestEntry.submittedTimeDisplay}
                  </div>
                  <div className="text-[11px] text-amber-800 font-mono truncate">
                    Date: {bookLogStats.latestEntry.submittedDateDisplay} (Report: {bookLogStats.latestEntry.reportDate})
                  </div>
                </>
              ) : (
                <div className="text-xs text-amber-800/80 pt-1">
                  No submissions recorded yet
                </div>
              )}
            </div>
          </div>

          {/* Search & Date Filter Bar */}
          {submissionLogs.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={bookLogSearch}
                  onChange={(e) => setBookLogSearch(e.target.value)}
                  placeholder="Search Book Log by file name, date, zone, role, response ID, or observation..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-300 text-xs">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-slate-600 font-medium">Filter Date:</span>
                  <input
                    type="date"
                    value={bookLogDateFilter}
                    onChange={(e) => setBookLogDateFilter(e.target.value)}
                    className="text-xs font-mono text-slate-800 outline-none bg-transparent"
                  />
                  {bookLogDateFilter && (
                    <button
                      type="button"
                      onClick={() => setBookLogDateFilter('')}
                      className="text-slate-400 hover:text-slate-700 cursor-pointer"
                      title="Clear date filter"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Book Log Entries Content */}
          {submissionLogs.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 space-y-2">
              <BookOpen className="w-7 h-7 text-slate-400 mx-auto" />
              <p className="text-xs sm:text-sm font-bold text-slate-700">
                Operations Submission Book Log is Empty
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Whenever you click <strong>"Submit Selected to Rig 50"</strong> below, this Book Log will automatically record the exact date &amp; time, how many cards were submitted, the uploaded files used, and every card receipt in Firestore.
              </p>
            </div>
          ) : bookLogViewMode === 'daily' ? (
            /* DAILY TOTALS SUMMARY TABLE */
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white font-semibold">
                    <th className="py-2.5 px-3">Submission Date (When)</th>
                    <th className="py-2.5 px-3">Time Window</th>
                    <th className="py-2.5 px-3">Submission Runs</th>
                    <th className="py-2.5 px-3">Total Cards Submitted</th>
                    <th className="py-2.5 px-3">Safe / Unsafe Split</th>
                    <th className="py-2.5 px-3">Observation Breakdown</th>
                    <th className="py-2.5 px-3">Operations Files Used</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {dailyAggregatedLogs.map(day => (
                    <tr key={day.date} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {day.date}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {day.firstTime === day.lastTime
                          ? day.lastTime
                          : `${day.firstTime} → ${day.lastTime}`}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-indigo-900">
                        {day.runsCount} batch{day.runsCount === 1 ? '' : 'es'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono font-extrabold">
                          {day.totalCards} Cards
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        <span className="text-emerald-700 font-bold">{day.safeCount} Safe</span>
                        <span className="mx-1 text-slate-400">·</span>
                        <span className="text-rose-700 font-bold">{day.unsafeCount} Unsafe</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                        {day.behaviorCount} Behavior · {day.conditionCount} Condition · {day.swaCount} SWA
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-slate-700 max-w-xs truncate">
                        {Array.from(day.files).join(', ') || 'Operations Deck'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* CHRONOLOGICAL SUBMISSION RUNS LIST (WITH EXPANDABLE CARD RECEIPTS) */
            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {filteredSubmissionLogs.map((entry, idx) => {
                const isExpanded = expandedLogEntryId === entry.id;
                return (
                  <div
                    key={entry.id}
                    className="rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all overflow-hidden shadow-2xs"
                  >
                    <div className="p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-slate-500">
                            #{filteredSubmissionLogs.length - idx}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono text-xs font-extrabold">
                            ✓ {entry.submittedCount} Card{entry.submittedCount === 1 ? '' : 's'} Submitted
                          </span>
                          <span className="px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-950 border border-amber-200 font-mono text-xs font-bold flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-700" />
                            <span>
                              {entry.submittedDateDisplay} at {entry.submittedTimeDisplay}
                            </span>
                          </span>
                          <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            Card Report Date: <strong>{entry.reportDate}</strong>
                          </span>
                          <span className="text-[11px] font-mono text-slate-500">
                            ({entry.durationSeconds})
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap text-xs text-slate-600 pl-1">
                          <span className="font-mono">
                            <strong className="text-emerald-700">{entry.safeCount} Safe</strong> ·{' '}
                            <strong className="text-rose-700">{entry.unsafeCount} Unsafe</strong>
                          </span>
                          <span>·</span>
                          <span className="font-mono text-[11px]">
                            {entry.behaviorCount} Behavior / {entry.conditionCount} Condition / {entry.swaCount} SWA
                          </span>
                          {entry.sourceFiles && entry.sourceFiles.length > 0 && (
                            <>
                              <span>·</span>
                              <span className="text-[11px] text-teal-900 font-semibold">
                                📄 Files: {entry.sourceFiles.join(', ')}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end lg:self-auto shrink-0">
                        {entry.cards && entry.cards.length > 0 && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                const reloaded: GeneratedSoarCard[] = entry.cards.map((c, cIdx) => ({
                                  id: `reloaded_${Date.now()}_${cIdx}_${Math.random().toString(36).slice(2, 6)}`,
                                  operationSnippet: c.topic || `Reloaded from Book Log (${entry.submittedDateDisplay})`,
                                  date: reportDate || c.date,
                                  rig: RIG_50_NAME,
                                  zone: c.zone,
                                  role: c.role,
                                  name: c.observerName === '(Anonymous)' ? '' : c.observerName,
                                  assessment: c.assessment,
                                  obsType: c.obsType,
                                  category: c.category,
                                  observation: c.observation,
                                  action: c.action,
                                  topic: c.topic,
                                  aiPolished: true
                                }));
                                setGeneratedCards(reloaded);
                                setSelectedCardIds(new Set(reloaded.map(r => r.id)));
                                showAiNotice(
                                  `🔄 Reloaded ${reloaded.length} card(s) from Book Log (${entry.submittedDateDisplay} ${entry.submittedTimeDisplay}) into the deck below!`
                                );
                              }}
                              className="px-2.5 py-1 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-lg flex items-center gap-1 cursor-pointer"
                              title="Load these submitted cards back into the Operations deck below to review, AI-recreate, or submit again"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>Load into Deck</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setExpandedLogEntryId(isExpanded ? null : entry.id)}
                              className="px-2.5 py-1 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg flex items-center gap-1 cursor-pointer"
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              <span>
                                {isExpanded ? 'Hide Cards' : `View Cards (${entry.cards.length})`}
                              </span>
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={async () => {
                            const updated = await deleteOperationsSubmissionLogFromFirestore(entry.id);
                            setSubmissionLogs(updated);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="Delete this log entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {isExpanded && entry.cards && entry.cards.length > 0 && (
                      <div className="border-t border-slate-200 bg-slate-50 p-3 space-y-2 max-h-72 overflow-y-auto">
                        <div className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                          <span>
                            Submitted Card Receipts ({entry.cards.length} Cards · {entry.submittedDateDisplay} at {entry.submittedTimeDisplay})
                          </span>
                          <span className="font-mono text-slate-500">Report Date: {entry.reportDate}</span>
                        </div>
                        <div className="space-y-1.5">
                          {entry.cards.map((c, cIdx) => (
                            <div
                              key={c.id || cIdx}
                              className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs space-y-1"
                            >
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono font-bold text-slate-500">#{cIdx + 1}</span>
                                  <span className="font-mono text-[11px] px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded border border-slate-200">
                                    {c.responseId}
                                  </span>
                                  <span className="font-bold text-slate-900">{c.zone}</span>
                                  <span className="text-slate-500">·</span>
                                  <span className="text-slate-700">{c.role} ({c.observerName})</span>
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                      c.assessment === 'Unsafe'
                                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    }`}
                                  >
                                    {c.assessment}
                                  </span>
                                  <span className="text-[11px] text-slate-500 font-mono">{c.obsType}</span>
                                </div>
                                <span className="font-mono text-[11px] text-slate-500">{c.time}</span>
                              </div>
                              <p className="text-slate-800 text-[11px]">
                                <strong>Obs:</strong> {c.observation}
                              </p>
                              <p className="text-teal-900 text-[11px]">
                                <strong>Action:</strong> {c.action}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* EXPANDABLE CATEGORIZED AI IDEAS CARD BANK DRAWER */}
      {showCardBankDrawer && (
        <div className="bg-white rounded-xl border-2 border-indigo-200 shadow-sm overflow-hidden space-y-4 p-4 sm:p-5 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-indigo-600" />
                <span>Categorized AI Training Ideas Card Bank ({bankIdeas.length} Saved Cards)</span>
              </h3>
              <p className="text-xs text-slate-600">
                Select cards by category from your AI Training Ideas bank to either <strong>Load As-Is to Submit Again</strong> or <strong>AI Recreate for New Submissions</strong> directly in your deck below.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {filteredBankIdeas.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (selectedBankIdeaIds.size === filteredBankIdeas.length) {
                      setSelectedBankIdeaIds(new Set());
                    } else {
                      setSelectedBankIdeaIds(new Set(filteredBankIdeas.map(i => i.id)));
                    }
                  }}
                  className="px-2.5 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg cursor-pointer"
                >
                  {selectedBankIdeaIds.size === filteredBankIdeas.length
                    ? `Deselect All (${filteredBankIdeas.length})`
                    : `Select All in View (${filteredBankIdeas.length})`}
                </button>
              )}

              <button
                type="button"
                disabled={selectedBankIdeaIds.size === 0 || isRecreatingFromBank}
                onClick={handleLoadSelectedFromBankAsIs}
                className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Load Selected to Submit Again ({selectedBankIdeaIds.size})</span>
              </button>

              <button
                type="button"
                disabled={selectedBankIdeaIds.size === 0 || isRecreatingFromBank}
                onClick={handleRecreateSelectedFromBankWithAi}
                className="px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                {isRecreatingFromBank ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Recreating ({bankRecreateProgress?.current}/{bankRecreateProgress?.total})...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>AI Recreate for New Submission ({selectedBankIdeaIds.size})</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedBankCategory('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer flex items-center gap-1.5 ${
                selectedBankCategory === 'ALL'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-indigo-300'
              }`}
            >
              <span>All Categories</span>
              <span className="font-mono text-[11px] opacity-80">({bankIdeas.length})</span>
            </button>
            {AI_IDEA_CATEGORIES.map(cat => {
              const cnt = bankCategoryCounts[cat] || 0;
              const active = selectedBankCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedBankCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border cursor-pointer flex items-center gap-1.5 ${
                    active
                      ? 'bg-indigo-600 text-white border-indigo-600 font-semibold'
                      : cnt > 0
                        ? 'bg-slate-50 text-slate-800 border-slate-200 hover:border-indigo-300'
                        : 'bg-slate-50/50 text-slate-400 border-slate-200/60'
                  }`}
                >
                  <span>{cat}</span>
                  <span className="font-mono text-[11px] opacity-80">({cnt})</span>
                </button>
              );
            })}
          </div>

          <input
            type="text"
            value={bankSearchQuery}
            onChange={(e) => setBankSearchQuery(e.target.value)}
            placeholder="Search Card Bank by topic, category, zone, role, or observation..."
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-indigo-500"
          />

          <div className="max-h-64 overflow-y-auto divide-y divide-slate-200 border border-slate-200 rounded-lg">
            {filteredBankIdeas.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No cards found in this category.
              </div>
            ) : (
              filteredBankIdeas.map(idea => {
                const checked = selectedBankIdeaIds.has(idea.id);
                const cat = getIdeaCategory(idea);
                return (
                  <label
                    key={idea.id}
                    className={`p-3 flex items-start gap-3 text-xs cursor-pointer transition-colors ${
                      checked ? 'bg-indigo-50/50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setSelectedBankIdeaIds(prev => {
                          const next = new Set(prev);
                          if (next.has(idea.id)) next.delete(idea.id);
                          else next.add(idea.id);
                          return next;
                        });
                      }}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600"
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-100 text-indigo-900">
                          {cat}
                        </span>
                        <span className="font-bold text-slate-900">{idea.topic}</span>
                        <span className="text-slate-500 font-mono">
                          {idea.zone || 'Rig Floor'} · {idea.role || 'Floorman'} ·{' '}
                          <span className={idea.assessment === 'Unsafe' ? 'text-rose-700 font-semibold' : 'text-emerald-700 font-semibold'}>
                            {idea.assessment || 'Safe'}
                          </span>
                        </span>
                      </div>
                      <p className="text-slate-700 line-clamp-2">{idea.observation}</p>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* DROPZONE & ADDITIONAL INSTRUCTIONS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Multi-File Upload Area & Dedicated Additional Instructions */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Upload className="w-4 h-4 text-teal-600" />
              <span>1. Upload Operations Files (PDF, Word, Excel)</span>
            </span>
            {uploadedDocs.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                  {uploadedDocs.length} File{uploadedDocs.length === 1 ? '' : 's'} Ready
                </span>
                <button
                  type="button"
                  onClick={handleClearAllDocs}
                  className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>

          {/* Multi-File Drag & Drop Area */}
          <label
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleMultipleFilesUpload(e.dataTransfer.files);
              }
            }}
            className="border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-teal-50/30"
          >
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleMultipleFilesUpload(e.target.files);
                  e.target.value = '';
                }
              }}
            />
            {isExtracting ? (
              <div className="flex flex-col items-center gap-2 text-xs font-semibold text-teal-700 py-3">
                <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
                <span>
                  Reading {extractingFileNames.length} file{extractingFileNames.length === 1 ? '' : 's'} ({extractingFileNames.join(', ')})...
                </span>
              </div>
            ) : (
              <div className="text-center py-2 space-y-1.5">
                <div className="flex items-center justify-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px] border border-rose-200">
                    PDF
                  </span>
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[10px] border border-blue-200">
                    WORD (.DOCX / .DOC)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px] border border-emerald-200">
                    EXCEL (.XLSX / .CSV)
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-800 flex items-center justify-center gap-1">
                  <Plus className="w-4 h-4 text-teal-600" />
                  <span>Click to Select or Drag &amp; Drop Multiple Operations Files</span>
                </p>
                <p className="text-[11px] text-slate-500">
                  Upload 1 or more PDF, Word, or Excel files at the same time — extracted automatically in the background
                </p>
              </div>
            )}
          </label>

          {extractError && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>{extractError}</span>
              </div>
              <button
                type="button"
                onClick={() => setExtractError(null)}
                className="text-amber-700 hover:text-amber-950"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Uploaded Files Queue List */}
          {uploadedDocs.length > 0 && (
            <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                <span>Loaded Operations Documents ({uploadedDocs.length}):</span>
                <span className="font-mono text-slate-500">
                  {uploadedDocs.reduce((acc, d) => acc + d.charCount, 0).toLocaleString()} total chars read
                </span>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {uploadedDocs.map((doc) => {
                  const isPreviewOpen = previewDocId === doc.id;
                  const badgeStyle =
                    doc.fileType === 'pdf'
                      ? 'bg-rose-100 text-rose-800 border-rose-200'
                      : doc.fileType === 'word'
                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                      : doc.fileType === 'excel'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : 'bg-slate-200 text-slate-800 border-slate-300';

                  return (
                    <div
                      key={doc.id}
                      className="bg-white rounded-lg border border-slate-200 p-2.5 text-xs space-y-2 shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {doc.fileType === 'excel' ? (
                            <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                          )}
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase border ${badgeStyle}`}>
                            {doc.fileType}
                          </span>
                          <span className="font-bold text-slate-800 truncate" title={doc.name}>
                            {doc.name}
                          </span>
                          <span className="text-[11px] text-slate-500 shrink-0 hidden sm:inline">
                            ({doc.summaryLabel})
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setPreviewDocId(isPreviewOpen ? null : doc.id)}
                            className="px-2 py-1 rounded text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1"
                            title="Peek at extracted file text without putting it in the instructions box"
                          >
                            {isPreviewOpen ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            <span>{isPreviewOpen ? 'Hide' : 'Peek'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveUploadedDoc(doc.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                            title="Remove file"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {isPreviewOpen && (
                        <div className="p-2 bg-slate-900 text-slate-100 rounded font-mono text-[10px] max-h-32 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                          {doc.extractedText.slice(0, 2000)}
                          {doc.extractedText.length > 2000 ? '\n... [Truncated in preview]' : ''}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Dedicated Additional Instructions & Custom Rules Box (Never polluted with extracted text!) */}
          <div className="space-y-2 pt-1 border-t border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Additional AI Instructions &amp; Custom Rules (Optional):</span>
              </label>

              {/* Built-in Exclude Time Toggle */}
              <button
                type="button"
                onClick={() => setExcludeTimeInCards(prev => !prev)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                  excludeTimeInCards
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
                title="When active, clock times (e.g. 00:00 - 03:30) from the report are never included in generated cards"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {excludeTimeInCards ? '✓ No Time / Timestamps in Cards' : 'Allow Timestamps in Cards'}
                </span>
              </button>
            </div>

            {/* Quick Instruction Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-semibold text-slate-500">Quick Rules:</span>
              {[
                'Do not include any time or timestamps in any of the cards',
                'Strictly create cards only from the uploaded operations activities',
                'Make all cards Safe Behavior & Condition observations only',
                'Focus heavily on casing, cementing, and BOP barrier checks',
                'Write concise 1-sentence observations and actions'
              ].map((rule, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAddQuickInstruction(rule)}
                  className="px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-[10px] font-semibold transition-colors"
                >
                  + {rule.slice(0, 38)}{rule.length > 38 ? '...' : ''}
                </button>
              ))}
              {additionalInstructions.trim() && (
                <button
                  type="button"
                  onClick={() => setAdditionalInstructions('')}
                  className="px-2 py-0.5 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-semibold"
                >
                  Clear Instructions
                </button>
              )}
            </div>

            <textarea
              rows={4}
              value={additionalInstructions}
              onChange={(e) => setAdditionalInstructions(e.target.value)}
              placeholder="Write any custom instructions for Gemini AI here (e.g., 'Do not include time in any of the cards', 'Focus on 9-5/8 casing and crane offloading', 'Make all cards Safe Behavior & Condition observations only'). Extracted file text stays in the background and will not clutter this box."
              className="w-full p-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none leading-relaxed bg-white"
            />

            {/* Active Hard-Enforced Rules Confirmation Bar */}
            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
              <span className="font-bold text-slate-500 uppercase tracking-wider">Enforced Locks:</span>
              {activeInstructionConstraints.excludeTime && (
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                  ✓ No Clock Times / Timestamps
                </span>
              )}
              {activeInstructionConstraints.assessmentLock && (
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                  ✓ 100% {activeInstructionConstraints.assessmentLock} Only
                </span>
              )}
              {activeInstructionConstraints.allowedObsTypes && (
                <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 font-semibold">
                  ✓ Types: {activeInstructionConstraints.allowedObsTypes.join(' & ')} Only
                </span>
              )}
              {activeInstructionConstraints.oneSentenceOnly && (
                <span className="px-2 py-0.5 rounded bg-violet-50 text-violet-800 border border-violet-200 font-semibold">
                  ✓ 1-Sentence Concise Mode
                </span>
              )}
              {!activeInstructionConstraints.assessmentLock &&
                !activeInstructionConstraints.allowedObsTypes &&
                !activeInstructionConstraints.oneSentenceOnly && (
                  <span className="text-slate-400">
                    All custom instructions above are sent as top-priority system rules to Gemini 4 Flash
                  </span>
                )}
            </div>
          </div>

          {/* Detected Drilling Activities Tags */}
          {detectedTags.length > 0 && (
            <div className="p-3 rounded-lg bg-teal-50/70 border border-teal-200 space-y-1.5">
              <span className="text-[11px] font-bold text-teal-900 uppercase tracking-wider block">
                Detected Rig 50 Operations in Uploaded Files:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {detectedTags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white text-teal-900 border border-teal-300 shadow-2xs"
                  >
                    ✓ {tag.zone} ({tag.keywords[0]})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Synthesis Controls & Card Counts */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="pb-2 border-b border-slate-200">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-teal-600" />
              <span>2. AI Operations Card Synthesis</span>
            </span>
          </div>

          {/* Target Date */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Observation Date:
            </label>
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
            />
          </div>

          {/* Number of cards to generate */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Number of Operations Cards to Create (100% AI):
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[15, 30, 50, 75, 100, 150].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setCardCount(num)}
                  className={`py-2 text-xs font-bold rounded-lg border transition-colors ${
                    cardCount === num
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {num} Cards
                </button>
              ))}
            </div>
          </div>

          {/* Primary 100% AI Generate Button + Direct Line Parser */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleGenerateCardsWithAi}
              disabled={!hasAnySource || isGeneratingWithAi}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 via-violet-600 to-teal-700 hover:from-indigo-700 hover:via-violet-700 hover:to-teal-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all"
            >
              {isGeneratingWithAi ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    {aiGenProgress
                      ? `Gemini AI Creating Cards (${aiGenProgress.current} / ${aiGenProgress.total})...`
                      : `Gemini AI Reading Uploaded Files...`}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>🤖 AI Create All {cardCount} Operations Cards with Gemini</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleGenerateCardsFromLines}
              disabled={!hasAnySource || isGeneratingWithAi}
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 font-semibold text-xs rounded-xl border border-slate-300 flex items-center justify-center gap-2 transition-all"
            >
              <FileCheck className="w-3.5 h-3.5 text-teal-700" />
              <span>Extract {cardCount} Cards Line-by-Line from Uploaded Files</span>
            </button>
          </div>

          {/* Quick Info Box */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600 space-y-1">
            <span className="font-bold text-slate-900 block">How It Works:</span>
            <p>
              • <strong>100% Operations-Grounded:</strong> Every single card of your {cardCount} cards is synthesized by Gemini AI directly from your uploaded PDF, Word, and Excel files — zero generic filler!
            </p>
            <p>
              • <strong>Custom Instructions Respected:</strong> Clock times and timestamps are automatically stripped, and your Additional Instructions are strictly enforced on every card.
            </p>
            <p>
              • <strong>Save to AI Training Ideas:</strong> Select any cards and click <strong>🧠 Add Selected to AI Ideas</strong> (or click the brain icon on any card) to train your AI!
            </p>
          </div>
        </div>
      </div>

      {aiErrorNotice && (
        <div className="p-3.5 rounded-xl bg-rose-50 text-rose-900 text-xs font-semibold flex items-center justify-between gap-3 shadow-xs border border-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              <strong>Gemini AI Notice:</strong> {aiErrorNotice}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setAiErrorNotice(null)}
            className="text-rose-500 hover:text-rose-800 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {aiStatusNotice && (
        <div className="p-3 rounded-xl bg-indigo-950 text-white text-xs font-semibold flex items-center justify-between shadow-sm border border-indigo-700">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
            <span>{aiStatusNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setAiStatusNotice(null)}
            className="text-indigo-300 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* GENERATED CARDS PREVIEW & MASS ACTION PANEL */}
      {generatedCards.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-0">
          {/* Header Summary & Selection Controls */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col gap-3">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                {/* Master Checkbox */}
                <button
                  type="button"
                  onClick={isAllSelected ? handleDeselectAll : handleSelectAll}
                  className="flex items-center gap-2 text-slate-800 hover:text-teal-700 font-bold text-xs transition-colors p-1 rounded hover:bg-slate-200/60"
                  title={isAllSelected ? 'Deselect All' : 'Select All'}
                >
                  {isAllSelected ? (
                    <CheckSquare className="w-5 h-5 text-emerald-600" />
                  ) : isPartiallySelected ? (
                    <MinusSquare className="w-5 h-5 text-teal-600" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-400" />
                  )}
                  <span className="uppercase tracking-wider">
                    {isAllSelected ? 'All Selected' : isPartiallySelected ? 'Partially Selected' : 'Select All'}
                  </span>
                </button>

                <div className="h-4 w-px bg-slate-300 mx-1 hidden sm:block"></div>

                {/* Counters */}
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full font-bold bg-teal-100 text-teal-900 border border-teal-200">
                    Selected: {selectedCount} / {totalCount}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    ({generatedCards.filter(c => selectedCardIds.has(c.id) && c.assessment === 'Safe').length} Safe, {generatedCards.filter(c => selectedCardIds.has(c.id) && c.assessment === 'Unsafe').length} Unsafe)
                  </span>
                  {savedToAiIdeasIds.size > 0 && (
                    <span className="px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-900 border border-amber-300 text-[11px] flex items-center gap-1">
                      <Brain className="w-3 h-3 text-amber-700" />
                      <span>{savedToAiIdeasIds.size} in AI Ideas</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons: Add to AI Ideas, AI Remake Selected, Export CSV, Submit */}
              <div className="flex flex-wrap items-center gap-2">
                {/* NEW: Add Selected Cards to AI Training Ideas */}
                <button
                  type="button"
                  onClick={handleAddSelectedCardsToAiIdeas}
                  disabled={selectedCount === 0 || isSavingToAiIdeas}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 disabled:opacity-40 text-amber-950 text-xs font-bold rounded-lg border border-amber-300 transition-colors shadow-2xs"
                  title="Save all currently selected cards into AI Training Ideas (Firestore database)"
                >
                  {isSavingToAiIdeas ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700" />
                  ) : (
                    <Brain className="w-3.5 h-3.5 text-amber-700" />
                  )}
                  <span>🧠 Add Selected ({selectedCount}) to AI Ideas</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleBulkRemakeSelectedWithAi('operations_ai')}
                  disabled={selectedCount === 0 || isBulkRemakingAi}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-40 text-indigo-900 text-xs font-bold rounded-lg border border-indigo-200 transition-colors"
                  title="Recreate selected cards using Gemini AI based on your uploaded files"
                >
                  {isBulkRemakingAi ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-700" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  )}
                  <span>✨ AI Remake Selected ({Math.min(selectedCount, 15)})</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={selectedCount === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition-colors"
                  title="Export currently selected cards as CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export ({selectedCount}) CSV</span>
                </button>

                {isSubmittingDirect ? (
                  <button
                    type="button"
                    onClick={handleAbortSubmit}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
                  >
                    <StopCircle className="w-3.5 h-3.5" />
                    <span>Stop Submission</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleDirectSubmitToRig50}
                    disabled={selectedCount === 0}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Selected ({selectedCount}) to Rig 50</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Filter Selection Buttons + Auto-Save to AI Ideas Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-500 text-[11px] font-semibold">Quick Select:</span>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium text-[11px] transition-colors"
                >
                  Select All ({totalCount})
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium text-[11px] transition-colors"
                >
                  Deselect All (0)
                </button>
                <button
                  type="button"
                  onClick={handleSelectSafeOnly}
                  className="px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-semibold text-[11px] transition-colors"
                >
                  Safe Only ({generatedCards.filter(c => c.assessment === 'Safe').length})
                </button>
                <button
                  type="button"
                  onClick={handleSelectUnsafeOnly}
                  className="px-2.5 py-1 rounded bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 font-semibold text-[11px] transition-colors"
                >
                  Unsafe Only ({generatedCards.filter(c => c.assessment === 'Unsafe').length})
                </button>
              </div>

              {/* Checkbox to automatically add selected cards to AI Training Ideas when submitting */}
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-900 bg-amber-50/80 px-2.5 py-1 rounded-lg border border-amber-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSaveToAiIdeasOnSubmit}
                  onChange={(e) => setAutoSaveToAiIdeasOnSubmit(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <Brain className="w-3.5 h-3.5 text-amber-700" />
                <span>Also save selected cards to AI Training Ideas when submitting</span>
              </label>
            </div>
          </div>

          {/* Submission Progress bar */}
          {isSubmittingDirect && (
            <div className="p-3 bg-teal-50 border-b border-teal-200 space-y-1">
              <div className="flex justify-between text-xs font-semibold text-teal-900">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-700" />
                  Submitting selected cards to Rig 50 ({submitProgress.current} of {submitProgress.total})...
                </span>
                <span>{Math.round((submitProgress.current / submitProgress.total) * 100)}%</span>
              </div>
              <div className="w-full bg-teal-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-teal-600 h-full transition-all duration-300"
                  style={{ width: `${(submitProgress.current / submitProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {submitSuccessCount > 0 && !isSubmittingDirect && (
            <div className="p-3 bg-emerald-50 border-b border-emerald-200 text-xs text-emerald-900 font-semibold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Successfully submitted {submitSuccessCount} operations cards to Rig 50!</span>
              </div>
              <span className="text-[11px] text-emerald-700 font-mono">
                {submitSuccessCount} records recorded in Microsoft Forms
              </span>
            </div>
          )}

          {/* Table / List of cards */}
          <div className="max-h-[620px] overflow-y-auto divide-y divide-slate-100 text-xs">
            {generatedCards.map((card, idx) => {
              const isSelected = selectedCardIds.has(card.id);
              const isSubmitted = submittedCardIds.has(card.id);
              const isSavedIdea = savedToAiIdeasIds.has(card.id);
              const isRemaking = remakingCardId === card.id || remakingCardIds.has(card.id);
              const isEditing = editingCardId === card.id;
              const isCustomPromptOpen = customPromptCardId === card.id;

              return (
                <div 
                  key={card.id} 
                  className={`p-3.5 transition-colors ${
                    isSelected ? 'bg-white hover:bg-slate-50/80' : 'bg-slate-50/60 opacity-60 hover:opacity-90'
                  }`}
                >
                  {isEditing ? (
                    /* Inline Editing Mode */
                    <div className="space-y-3 bg-teal-50/40 p-3 rounded-lg border border-teal-200">
                      <div className="flex items-center justify-between pb-1 border-b border-teal-200">
                        <span className="text-xs font-bold text-teal-900">
                          Edit Card #{idx + 1}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(card.id)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs shadow-2xs"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Save</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="flex items-center gap-1 px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded text-xs"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Cancel</span>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Assessment:</label>
                          <select
                            value={editFormData?.assessment}
                            onChange={(e) => setEditFormData(prev => prev ? { ...prev, assessment: e.target.value as 'Safe' | 'Unsafe' } : null)}
                            className="w-full p-1.5 border border-slate-300 rounded bg-white"
                          >
                            <option value="Safe">Safe</option>
                            <option value="Unsafe">Unsafe</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Observation Area / Zone:</label>
                          <select
                            value={editFormData?.zone}
                            onChange={(e) => setEditFormData(prev => prev ? { ...prev, zone: e.target.value } : null)}
                            className="w-full p-1.5 border border-slate-300 rounded bg-white"
                          >
                            <option value="Rig Floor">Rig Floor</option>
                            <option value="Derrick">Derrick</option>
                            <option value="Mud Pit / Sack Room">Mud Pit / Sack Room</option>
                            <option value="Shakers">Shakers</option>
                            <option value="BOP">BOP</option>
                            <option value="Main Deck">Main Deck</option>
                            <option value="Cranes">Cranes</option>
                            <option value="Cantilever / Pipe Deck">Cantilever / Pipe Deck</option>
                            <option value="Accommodations">Accommodations</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Observation Type:</label>
                          <select
                            value={editFormData?.obsType}
                            onChange={(e) => setEditFormData(prev => prev ? { ...prev, obsType: e.target.value } : null)}
                            className="w-full p-1.5 border border-slate-300 rounded bg-white"
                          >
                            <option value="Behavior Observation">Behavior Observation</option>
                            <option value="Condition">Condition</option>
                            <option value="STOP Work Authority (SWA)">STOP Work Authority (SWA)</option>
                            <option value="Stop Work Authority Drill">Stop Work Authority Drill</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Observation Description:</label>
                        <textarea
                          rows={2}
                          value={editFormData?.observation}
                          onChange={(e) => setEditFormData(prev => prev ? { ...prev, observation: e.target.value } : null)}
                          className="w-full p-2 border border-slate-300 rounded bg-white text-xs"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Action Taken:</label>
                        <textarea
                          rows={2}
                          value={editFormData?.action}
                          onChange={(e) => setEditFormData(prev => prev ? { ...prev, action: e.target.value } : null)}
                          className="w-full p-2 border border-slate-300 rounded bg-white text-xs"
                        />
                      </div>
                    </div>
                  ) : (
                    /* Normal Display Row */
                    <div className="space-y-2">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                        {/* Checkbox & Details */}
                        <div className="flex items-start gap-3 flex-1">
                          {/* Select / Deselect Checkbox Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleCardSelection(card.id)}
                            className="mt-0.5 text-slate-400 hover:text-teal-600 transition-colors shrink-0"
                            title={isSelected ? 'Unselect this card' : 'Select this card'}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300" />
                            )}
                          </button>

                          <div className="space-y-1.5 flex-1 min-w-0">
                            {/* Metadata row */}
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-slate-400 font-semibold">#{idx + 1}</span>
                              <span className="font-bold text-slate-900">{card.zone}</span>
                              <span className="text-slate-500">({card.role})</span>
                              <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                card.assessment === 'Safe' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {card.assessment}
                              </span>
                              <span className="text-slate-600 text-[11px] bg-slate-100 px-1.5 py-0.5 rounded">
                                {card.obsType}
                              </span>

                              {card.aiPolished && (
                                <span className="bg-indigo-100 text-indigo-900 border border-indigo-200 font-bold text-[10px] px-1.5 py-0.2 rounded flex items-center gap-1">
                                  <Sparkles className="w-2.5 h-2.5 text-indigo-600" />
                                  <span>AI Synthesized</span>
                                </span>
                              )}

                              {card.topic && (
                                <span className="text-[10px] font-semibold text-teal-800 bg-teal-50 border border-teal-200 px-1.5 py-0.2 rounded">
                                  {card.topic}
                                </span>
                              )}

                              {isSavedIdea && (
                                <span className="bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px] px-1.5 py-0.2 rounded flex items-center gap-1">
                                  <Brain className="w-2.5 h-2.5 text-amber-700" />
                                  <span>Saved to AI Ideas</span>
                                </span>
                              )}

                              {isSubmitted && (
                                <span className="bg-emerald-600 text-white font-bold text-[10px] px-1.5 py-0.2 rounded flex items-center gap-1 shadow-2xs">
                                  <Check className="w-3 h-3" /> Submitted
                                </span>
                              )}

                              {!isSelected && (
                                <span className="bg-slate-200 text-slate-600 text-[10px] font-semibold px-1.5 py-0.2 rounded">
                                  Excluded
                                </span>
                              )}
                            </div>

                            {/* Observation & Action */}
                            <p className="text-slate-800 text-[11px] leading-relaxed">
                              <strong className="text-slate-600">Obs:</strong> {card.observation}
                            </p>
                            <p className="text-emerald-900 text-[11px] leading-relaxed">
                              <strong className="text-emerald-700">Action:</strong> {card.action}
                            </p>
                          </div>
                        </div>

                        {/* Card Actions: Add to AI Ideas, AI Remake, Edit, Delete */}
                        <div className="flex items-center gap-1 shrink-0 self-end md:self-start pt-1 md:pt-0">
                          {/* Add Single Card to AI Training Ideas Button */}
                          <button
                            type="button"
                            onClick={() => handleAddSingleCardToAiIdeas(card)}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold border transition-colors ${
                              isSavedIdea
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-amber-50/70 hover:bg-amber-100 text-amber-900 border-amber-200'
                            }`}
                            title="Add this card to AI Training Ideas (Firestore database)"
                          >
                            {isSavedIdea ? (
                              <>
                                <Check className="w-3 h-3 text-amber-700" />
                                <span>In AI Ideas</span>
                              </>
                            ) : (
                              <>
                                <BookmarkPlus className="w-3.5 h-3.5 text-amber-700" />
                                <span>+ AI Idea</span>
                              </>
                            )}
                          </button>

                          {/* AI Remake button with options */}
                          <div className="relative flex items-center">
                            <button
                              type="button"
                              onClick={() => handleRemakeCard(card)}
                              disabled={isRemaking}
                              className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-l text-[11px] font-bold transition-colors disabled:opacity-60"
                              title="Recreate this card using Gemini AI based on your uploaded files"
                            >
                              {isRemaking ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 text-indigo-700 animate-spin" />
                                  <span>AI Recreating...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>AI Remake</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              disabled={isRemaking}
                              onClick={() => setActiveRemakeMenuId(activeRemakeMenuId === card.id ? null : card.id)}
                              className="px-1.5 py-1 text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-r border-y border-r border-indigo-200 text-[10px]"
                              title="AI Remake options"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>

                            {activeRemakeMenuId === card.id && (
                              <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-20 text-[11px]">
                                <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-indigo-900 border-b border-slate-100">
                                  🤖 Gemini AI Remake Modes
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemakeCard(card)}
                                  className="w-full text-left px-3 py-1.5 hover:bg-indigo-50 text-slate-800 font-semibold flex items-center justify-between"
                                >
                                  <span>✨ AI Recreate from Files</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemakeCard(card, 'Safe')}
                                  className="w-full text-left px-3 py-1.5 hover:bg-emerald-50 text-emerald-800 font-semibold"
                                >
                                  <span>🟢 AI Remake as Safe</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemakeCard(card, 'Unsafe')}
                                  className="w-full text-left px-3 py-1.5 hover:bg-rose-50 text-rose-800 font-semibold"
                                >
                                  <span>🔴 AI Remake as Unsafe (SWA)</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemakeCard(card, 'Safe', { preferredObsType: 'Condition' })}
                                  className="w-full text-left px-3 py-1.5 hover:bg-teal-50 text-teal-900 font-semibold"
                                >
                                  <span>🛠️ AI Remake as Condition</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemakeCard(card, 'Safe', { remakeMode: 'non_safety_ai' })}
                                  className="w-full text-left px-3 py-1.5 hover:bg-amber-50 text-amber-900 font-semibold"
                                >
                                  <span>🎉 AI Remake as Non-Safety (Fun)</span>
                                </button>
                                <div className="border-t border-slate-100 mt-1 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveRemakeMenuId(null);
                                      setCustomPromptCardId(card.id);
                                      setCustomPromptText('');
                                    }}
                                    className="w-full text-left px-3 py-1.5 hover:bg-violet-50 text-violet-900 font-bold"
                                  >
                                    <span>💬 Custom AI Instruction...</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Inline Edit button */}
                          <button
                            type="button"
                            onClick={() => handleStartEdit(card)}
                            className="p-1 text-slate-500 hover:text-teal-700 hover:bg-slate-100 rounded transition-colors"
                            title="Edit text manually"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteCard(card.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            title="Remove card"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Inline Custom AI Instruction Bar for this Card */}
                      {isCustomPromptOpen && (
                        <div className="mt-2 p-2.5 rounded-xl bg-indigo-50/80 border border-indigo-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-950 shrink-0">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Tell AI how to recreate Card #{idx + 1}:</span>
                          </div>
                          <input
                            type="text"
                            value={customPromptText}
                            onChange={(e) => setCustomPromptText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && customPromptText.trim()) {
                                handleRemakeCard(card, undefined, {
                                  remakeMode: 'custom_ai',
                                  customInstruction: customPromptText.trim()
                                });
                              }
                            }}
                            placeholder="e.g., Focus on 9-5/8 casing slips, or Crane offload in 22kt wind, or Do not mention time..."
                            className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              disabled={!customPromptText.trim() || isRemaking}
                              onClick={() =>
                                handleRemakeCard(card, undefined, {
                                  remakeMode: 'custom_ai',
                                  customInstruction: customPromptText.trim()
                                })
                              }
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-[11px] rounded-lg flex items-center gap-1"
                            >
                              <Sparkles className="w-3 h-3" />
                              <span>Recreate with AI</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCustomPromptCardId(null);
                                setCustomPromptText('');
                              }}
                              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200/60"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
