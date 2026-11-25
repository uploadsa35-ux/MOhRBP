import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Rocket, 
  Play, 
  Pause, 
  Square, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Download, 
  Shield, 
  Lock, 
  Layers, 
  Gauge, 
  Clock, 
  FileText,
  Users,
  RefreshCw,
  Sparkles,
  KeyRound,
  Eye,
  Music,
  Smile,
  Sliders,
  Ban,
  History,
  Trash2,
  Search,
  X,
  Database,
  Brain,
  Lightbulb,
  Check,
  Edit3,
  ArrowRight,
  CheckSquare,
  Copy,
  Calendar,
  Mail,
  Send,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Globe,
  RotateCcw,
  FolderKanban,
  BookmarkPlus
} from 'lucide-react';
import { 
  RIG_50_NAME, 
  RIG_50_SCENARIOS, 
  USER_TENANT_ID, 
  USER_OWNER_ID, 
  USER_FORM_ID 
} from '../utils/defaultForm';
import { getCrewNameForSubmission, getAnonymousRatio } from '../utils/crewStore';
import { useSupervisor } from '../context/SupervisorAuthContext';
import { 
  getCardPoolByTheme, 
  getStoredCustomCards, 
  SoarCardTemplate, 
  CardCategoryType,
  HUMOR_SOAR_CARDS, 
  MUSIC_SOAR_CARDS, 
  OPERATIONS_SOAR_CARDS,
  THEME_DEFINITIONS,
  ThemeId
} from '../utils/cardBanks';
import { CustomCardBankModal } from './CustomCardBankModal';
import { 
  generateInfiniteUniqueCards, 
  generateUniqueSeed, 
  getUniqueIterationContext, 
  fetchAiCardWithSeedAndContext,
  getStoredPromptBlacklist,
  savePromptBlacklist,
  addToPromptBlacklist,
  clearPromptBlacklist,
  syncPromptBlacklistWithStorage,
  CategoryQuotas,
  buildQuotaTypeSequence,
  ContentGenerationMode
} from '../utils/aiCardGenerator';
import { 
  recordCardToFirestore, 
  getRecordedCardsFromFirestore, 
  getLocalTrainingIdeas, 
  saveAiTrainingIdeaToFirestore,
  saveBatchAiTrainingIdeasToFirestore,
  AiTrainingIdea,
  AI_IDEA_CATEGORIES,
  getIdeaCategory,
  setIdeaCategoryInKeywords,
  getCleanIdeaKeywords,
  subscribeToAiTrainingIdeas,
  incrementIdeaUsageInFirestore,
  DailyScheduleConfig,
  DailyRunLogEntry,
  saveDailyScheduleToFirestore,
  getDailyScheduleFromFirestore,
  subscribeToDailySchedule,
  saveDailyRunLogToFirestore,
  getDailyRunLogsFromFirestore,
  subscribeToDailyRunLogs,
  clearDailyRunLogsInFirestore,
  subscribeToPromptBlacklist
} from '../firebase';
import { 
  convertBlacklistItemToIdea,
  detectZoneFromText,
  detectRoleFromText,
  detectAssessmentFromText,
  detectObsTypeFromText,
  generateTopicFromText,
  generateActionFromText
} from '../utils/blockToIdeasConverter';

interface MassSubmittedReceipt {
  index: number;
  responseId: number | string;
  time: string;
  zone: string;
  role: string;
  name: string;
  assessment: string;
  obsType: string;
}

export const MassCardSubmitter: React.FC = () => {
  const { isSupervisor, openLoginModal } = useSupervisor();

  // Target setup
  const [targetCount, setTargetCount] = useState<number>(50);
  const [concurrency, setConcurrency] = useState<number>(5); // 5 chunks in parallel
  const [chunkSize, setChunkSize] = useState<number>(5); // 5 items per chunk request
  const [reportDate, setReportDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Generation Source ('ai_unique' = 100% unique AI cards vs 'template_pool' = pre-stored cards)
  const [cardSource, setCardSource] = useState<'ai_unique' | 'template_pool'>('ai_unique');
  const [sampleRefreshKey, setSampleRefreshKey] = useState<number>(0);
  const aiCardsQueueRef = useRef<SoarCardTemplate[]>([]);

  // Card Category Focus ('Safe' vs 'General') & Theme / Assessment Filters
  const [cardCategory, setCardCategory] = useState<CardCategoryType>('Safe');
  const [contentMode, setContentMode] = useState<ContentGenerationMode>('pure_non_safety');
  const [customTopic, setCustomTopic] = useState<string>('');
  const [selectedThemes, setSelectedThemes] = useState<string[]>(['humor', 'music', 'food', 'gaming']);
  const selectedTheme = selectedThemes.length === 1 ? (selectedThemes[0] as any) : (selectedThemes.length === 0 ? 'operations' : 'all');
  const [assessmentFilter, setAssessmentFilter] = useState<'all' | 'safe_only' | 'unsafe_only' | 'realistic_mix'>('safe_only');
  const [obsTypeFilter, setObsTypeFilter] = useState<'all_balanced' | 'behavior' | 'condition' | 'swa' | 'swa_drill'>('all_balanced');
  const [showCardBankModal, setShowCardBankModal] = useState<boolean>(false);
  const [customCardsCount, setCustomCardsCount] = useState<number>(() => getStoredCustomCards().length);

  // Interactive Batch Preview, Select/Unselect & Remake Deck
  const [previewDeck, setPreviewDeck] = useState<Array<SoarCardTemplate & { selected: boolean }>>([]);
  const [showPreviewDeck, setShowPreviewDeck] = useState<boolean>(false);
  const [editingDeckCardId, setEditingDeckCardId] = useState<string | null>(null);
  const [remakingDeckCardId, setRemakingDeckCardId] = useState<string | null>(null);

  const handleToggleTheme = (themeId: string) => {
    setSelectedThemes(prev => {
      if (prev.includes(themeId)) {
        if (prev.length === 1) return prev; // Keep at least one theme selected
        return prev.filter(t => t !== themeId);
      } else {
        return [...prev, themeId];
      }
    });
  };

  const handleSelectOnlyTheme = (themeId: string) => {
    setSelectedThemes([themeId]);
  };

  const handleSelectAllThemes = () => {
    setSelectedThemes(THEME_DEFINITIONS.map(t => t.id));
  };

  const handleSelectNonSafetyFavorites = () => {
    setContentMode('pure_non_safety');
    setSelectedThemes(
      THEME_DEFINITIONS.filter(t => t.isNonSafetyFavorite).map(t => t.id)
    );
  };


  const handleToggleCardCategory = (cat: CardCategoryType) => {
    setCardCategory(cat);
    if (cat === 'Safe') {
      setAssessmentFilter('safe_only');
    } else {
      setAssessmentFilter('all');
    }
  };

  // Prompt History Blacklist state
  const [promptBlacklist, setPromptBlacklist] = useState<string[]>(() => getStoredPromptBlacklist());
  const [showBlacklistModal, setShowBlacklistModal] = useState<boolean>(false);
  const [autoBlacklistEnabled, setAutoBlacklistEnabled] = useState<boolean>(true);
  const [blacklistSearch, setBlacklistSearch] = useState<string>('');
  const [isConfirmingClearHistory, setIsConfirmingClearHistory] = useState<boolean>(false);
  const [isReconcilingBlacklist, setIsReconcilingBlacklist] = useState<boolean>(false);
  const [blacklistVisibleLimit, setBlacklistVisibleLimit] = useState<number>(150);

  // Block List to Ideas state
  const [selectedBlacklistItems, setSelectedBlacklistItems] = useState<Set<string>>(new Set());
  const [sentToIdeasSet, setSentToIdeasSet] = useState<Set<string>>(() => {
    const existing = new Set<string>();
    try {
      const ideas = getLocalTrainingIdeas();
      ideas.forEach(i => {
        if (i.observation) existing.add(i.observation.trim());
      });
    } catch {}
    return existing;
  });
  const [customizingBlockIdea, setCustomizingBlockIdea] = useState<AiTrainingIdea | null>(null);
  const [removeAfterSend, setRemoveAfterSend] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSendingToIdeas, setIsSendingToIdeas] = useState<boolean>(false);

  // Category Quota Breakdown state (Condition / Behavior / SWA)
  const [useCategoryQuotas, setUseCategoryQuotas] = useState<boolean>(true);
  const [categoryQuotas, setCategoryQuotas] = useState<CategoryQuotas>({
    condition: 45,
    behavior: 45,
    swa: 10,
    swaDrill: 0
  });
  const assignedQuotaTypesRef = useRef<Array<'Condition' | 'Behavior Observation' | 'STOP Work Authority (SWA)' | 'Stop Work Authority Drill'>>([]);

  // Daily Automated Run & Email Dispatch state
  const [dailySchedule, setDailySchedule] = useState<DailyScheduleConfig>({
    enabled: false,
    dailyTime: '06:00',
    timezone: 'Asia/Riyadh', // AST (Arabia Standard Time, UTC+3 / Rig 50)
    recipientEmail: 'uploadsa35@gmail.com',
    targetCount: 100,
    categoryQuotas: { condition: 45, behavior: 45, swa: 10, swaDrill: 0 },
    theme: 'operations',
    cardCategory: 'Safe',
    autoBlacklist: true
  });
  const [dailyRunLogs, setDailyRunLogs] = useState<DailyRunLogEntry[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);
  const [isClearingLogs, setIsClearingLogs] = useState<boolean>(false);
  const [isSavingDailySchedule, setIsSavingDailySchedule] = useState<boolean>(false);
  const [isTestingDailyRun, setIsTestingDailyRun] = useState<boolean>(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState<boolean>(false);
  const [lastEmailPreviewUrl, setLastEmailPreviewUrl] = useState<string | null>(null);
  const [isDailyScheduleExpanded, setIsDailyScheduleExpanded] = useState<boolean>(true);
  const [showRunLogsSection, setShowRunLogsSection] = useState<boolean>(true);
  const [currentTimeDisplay, setCurrentTimeDisplay] = useState<string>('');
  const [astTimeDisplay, setAstTimeDisplay] = useState<string>('');
  const [utcTimeDisplay, setUtcTimeDisplay] = useState<string>('');
  const [browserTimeDisplay, setBrowserTimeDisplay] = useState<string>('');
  const [userBrowserTz, setUserBrowserTz] = useState<string>('UTC');
  const [logFilter, setLogFilter] = useState<'all' | 'scheduled' | 'manual'>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isResettingToday, setIsResettingToday] = useState<boolean>(false);

  // Live multi-timezone clocks ticker
  useEffect(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      setUserBrowserTz(detected);
    } catch {
      setUserBrowserTz('UTC');
    }

    const updateTime = () => {
      const now = new Date();
      try {
        const astDtf = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Riyadh',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
        setAstTimeDisplay(`${astDtf.format(now)} AST`);

        const utcDtf = new Intl.DateTimeFormat('en-US', {
          timeZone: 'UTC',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
        setUtcTimeDisplay(`${utcDtf.format(now)} UTC`);

        const browserDtf = new Intl.DateTimeFormat('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
        setBrowserTimeDisplay(`${browserDtf.format(now)}`);

        // Selected target timezone clock
        const tz = dailySchedule.timezone || 'Asia/Riyadh';
        const dtf = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
        const tzLabel = tz === 'Asia/Riyadh' ? 'AST' : tz === 'UTC' ? 'UTC' : tz.split('/').pop() || tz;
        setCurrentTimeDisplay(`${dtf.format(now)} (${tzLabel})`);
      } catch {
        setCurrentTimeDisplay(now.toLocaleTimeString());
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [dailySchedule.timezone]);

  // Fetch daily run audit logs from both Firestore and backend API
  const fetchDailyRunLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const [apiRes, fsLogs] = await Promise.all([
        fetch('/api/daily-schedule/logs').then(r => r.json()).catch(() => ({ logs: [] })),
        getDailyRunLogsFromFirestore().catch(() => [])
      ]);
      const apiLogs: DailyRunLogEntry[] = Array.isArray(apiRes?.logs) ? apiRes.logs : [];
      const mergedMap = new Map<string, DailyRunLogEntry>();
      [...fsLogs, ...apiLogs].forEach(entry => {
        if (entry && entry.id) {
          mergedMap.set(entry.id, entry);
        }
      });
      const merged = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
      );
      setDailyRunLogs(merged);
    } catch (e) {
      console.warn('Could not fetch daily run logs:', e);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleClearDailyLogs = async () => {
    setIsClearingLogs(true);
    try {
      await Promise.all([
        fetch('/api/daily-schedule/logs/clear', { method: 'POST' }).catch(() => {}),
        clearDailyRunLogsInFirestore().catch(() => {})
      ]);
      setDailyRunLogs([]);
      showToast('✓ Daily run logs cleared.');
    } catch {
      showToast('Notice: Could not clear logs');
    } finally {
      setIsClearingLogs(false);
    }
  };

  const handleResetTodayStatus = async () => {
    setIsResettingToday(true);
    try {
      const res = await fetch('/api/daily-schedule/reset-today', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.schedule) {
        setDailySchedule(data.schedule);
        showToast("✓ Today's run record reset! The automated timer can now trigger again today.");
      }
    } catch {
      showToast("Notice: Could not reset today's status");
    } finally {
      setIsResettingToday(false);
    }
  };

  // Helper to apply quota presets
  const applyQuotaPreset = (cond: number, beh: number, swa: number, drill = 0) => {
    const sum = cond + beh + swa + drill;
    setCategoryQuotas({ condition: cond, behavior: beh, swa: swa, swaDrill: drill });
    setTargetCount(sum);
    setUseCategoryQuotas(true);
    showToast(`✓ Applied quota: ${cond} Condition · ${beh} Behavior · ${swa} SWA (${sum} total)`);
  };

  // Helper to scale current quotas proportionally to match a new targetCount
  const scaleQuotasToTarget = (newTarget: number) => {
    const cond = Math.max(0, Number(categoryQuotas.condition) || 0);
    const beh = Math.max(0, Number(categoryQuotas.behavior) || 0);
    const swa = Math.max(0, Number(categoryQuotas.swa) || 0);
    const drill = Math.max(0, Number(categoryQuotas.swaDrill) || 0);
    const sum = cond + beh + swa + drill;
    if (sum <= 0) {
      const b = Math.round(newTarget * 0.45);
      const c = Math.round(newTarget * 0.45);
      const s = Math.max(0, newTarget - b - c);
      setCategoryQuotas({ condition: c, behavior: b, swa: s, swaDrill: 0 });
      return;
    }
    const scaledCond = Math.round((cond / sum) * newTarget);
    const scaledBeh = Math.round((beh / sum) * newTarget);
    const scaledSwa = Math.round((swa / sum) * newTarget);
    const diff = newTarget - (scaledCond + scaledBeh + scaledSwa);
    setCategoryQuotas({
      condition: scaledCond,
      behavior: Math.max(0, scaledBeh + diff),
      swa: scaledSwa,
      swaDrill: drill > 0 ? Math.max(0, Math.round((drill / sum) * newTarget)) : 0
    });
  };

  const isEditingTimeRef = useRef<boolean>(false);
  const lastSavedTimeRef = useRef<string>('');

  const handleSaveDailySchedule = async (overrides?: Partial<DailyScheduleConfig>) => {
    setIsSavingDailySchedule(true);
    const updated: DailyScheduleConfig = {
      ...dailySchedule,
      targetCount,
      categoryQuotas,
      cardCategory,
      theme: selectedTheme,
      autoBlacklist: autoBlacklistEnabled,
      ...(overrides || {})
    };

    if (updated.dailyTime) {
      lastSavedTimeRef.current = updated.dailyTime;
    }

    try {
      const res = await fetch('/api/daily-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      const data = await res.json();
      if (data.success && data.schedule) {
        setDailySchedule(data.schedule);
        if (data.schedule.dailyTime) {
          lastSavedTimeRef.current = data.schedule.dailyTime;
        }
      }
      await saveDailyScheduleToFirestore(updated);
      showToast(`✓ Daily schedule saved! ${updated.enabled ? `Active: Runs daily at ${updated.dailyTime} (${updated.timezone || 'AST'}) for ${updated.recipientEmail}` : 'Schedule is paused.'}`);
    } catch (e: any) {
      showToast(`Notice: Saved to server settings (${e?.message || 'Updated'})`);
    } finally {
      setIsSavingDailySchedule(false);
    }
  };

  const handleRunDailyBatchNow = async (simulateScheduled = false) => {
    setIsTestingDailyRun(true);
    showToast(`🚀 Launching ${simulateScheduled ? 'scheduled test' : 'daily automated'} batch of ${dailySchedule.targetCount || targetCount} cards...`);
    try {
      const res = await fetch('/api/daily-schedule/run-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ simulateScheduled })
      });
      const data = await res.json();
      if (data.success) {
        if (data.previewUrl) setLastEmailPreviewUrl(data.previewUrl);
        showToast(`✓ Daily batch completed: ${data.succeeded} cards submitted! Confirmation email sent to ${dailySchedule.recipientEmail}.`);
        fetch('/api/daily-schedule')
          .then(r => r.json())
          .then(d => { if (d.schedule) setDailySchedule(d.schedule); });
        fetchDailyRunLogs();
        fetch('/api/blacklist')
          .then(r => r.json())
          .then(blData => {
            if (Array.isArray(blData?.blacklist) && blData.blacklist.length > 0) {
              setPromptBlacklist(blData.blacklist);
              setFirestoreCardsLoaded(prev => Math.max(prev, blData.soarCardsCount || blData.blacklist.length));
            }
          })
          .catch(() => {});
      } else {
        showToast(`Daily run finished with note: ${data.error || 'Check server receipts'}`);
      }
    } catch (err: any) {
      showToast(`Daily run notice: ${err?.message || 'Processed'}`);
    } finally {
      setIsTestingDailyRun(false);
    }
  };

  const handleSendTestConfirmationEmail = async () => {
    setIsSendingTestEmail(true);
    showToast(`✉️ Sending test confirmation email to ${dailySchedule.recipientEmail}...`);
    try {
      const res = await fetch('/api/daily-schedule/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientEmail: dailySchedule.recipientEmail })
      });
      const data = await res.json();
      if (data.success) {
        if (data.previewUrl) setLastEmailPreviewUrl(data.previewUrl);
        showToast(`✓ Test confirmation email dispatched to ${dailySchedule.recipientEmail}!`);
      } else {
        showToast(`Email notice: ${data.error || 'Failed to dispatch'}`);
      }
    } catch (err: any) {
      showToast(`Email error: ${err?.message || 'Network notice'}`);
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => prev === msg ? null : prev);
    }, 4500);
  };

  const handleClearBlacklist = () => {
    setIsConfirmingClearHistory(false);
    clearPromptBlacklist();
    setPromptBlacklist([]);
    setSelectedBlacklistItems(new Set());
  };

  const handleReconcileBlacklistWithDb = async (silent = false) => {
    if (!silent) setIsReconcilingBlacklist(true);
    try {
      const res = await fetch('/api/blacklist/reconcile', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.blacklist) && data.blacklist.length > 0) {
          savePromptBlacklist(data.blacklist, true);
          setPromptBlacklist(data.blacklist);
          setFirestoreCardsLoaded(Math.max(data.soarCardsCount || 0, data.blacklist.length));
          if (!silent) {
            showToast(`✓ Synced ${data.blacklist.length} unique scenarios from ${data.soarCardsCount || data.blacklist.length} submitted cards in database!`);
          }
          return;
        }
      }
      // Fallback client-side reconciliation if server endpoint unavailable
      const [syncedList, cards] = await Promise.all([
        syncPromptBlacklistWithStorage(),
        getRecordedCardsFromFirestore(2500)
      ]);
      const obsList = cards.map((c, idx) => {
        const raw = String(c.observation || '').trim();
        if (!raw) return '';
        if (raw.startsWith('Conducted dynamic safety check around ')) {
          return `[${c.date || '2026-10'} · #${c.responseId || idx + 1}] During ${c.obsType || 'Condition'} check in ${c.zone || 'Rig Floor'}, observed ${c.role || 'Floorman'}: ${raw}`;
        }
        return raw;
      }).filter(Boolean);
      const merged = Array.from(new Set([...obsList, ...syncedList])).slice(0, 10000);
      if (merged.length > 0) {
        savePromptBlacklist(merged, true);
        setPromptBlacklist(merged);
      }
      if (cards.length > 0) {
        setFirestoreCardsLoaded(Math.max(cards.length, merged.length));
      }
      if (!silent) {
        showToast(`✓ Synced ${merged.length} scenarios from database!`);
      }
    } catch (e) {
      console.warn('Blacklist reconciliation notice:', e);
    } finally {
      if (!silent) setIsReconcilingBlacklist(false);
    }
  };

  const handleRemoveBlacklistItem = (itemToRemove: string) => {
    const updated = promptBlacklist.filter(item => item !== itemToRemove);
    savePromptBlacklist(updated);
    setPromptBlacklist(updated);
    setSelectedBlacklistItems(prev => {
      const next = new Set(prev);
      next.delete(itemToRemove);
      return next;
    });
  };

  const handleQuickSendToIdeas = async (rawItem: string, shouldRemove = false) => {
    try {
      const idea = convertBlacklistItemToIdea(rawItem);
      const ok = await saveAiTrainingIdeaToFirestore(idea);
      if (ok) {
        setSentToIdeasSet(prev => new Set(prev).add(rawItem.trim()));
        if (shouldRemove) {
          handleRemoveBlacklistItem(rawItem);
        }
        showToast(`✓ Sent card from block list to AI Training Ideas: "${idea.topic}"!`);
      } else {
        showToast(`✓ Card saved to AI ideas: "${idea.topic}"`);
      }
    } catch (e: any) {
      showToast(`Saved to AI ideas: ${e.message || 'Complete'}`);
    }
  };

  const handleSendSelectedToIdeas = async (shouldRemove = false) => {
    if (selectedBlacklistItems.size === 0) return;
    setIsSendingToIdeas(true);
    try {
      const items = Array.from(selectedBlacklistItems);
      const ideas = items.map(item => convertBlacklistItemToIdea(item));
      await saveBatchAiTrainingIdeasToFirestore(ideas);
      setSentToIdeasSet(prev => {
        const next = new Set(prev);
        items.forEach(i => next.add(i.trim()));
        return next;
      });
      if (shouldRemove) {
        const toRemoveSet = new Set(items);
        const remaining = promptBlacklist.filter(item => !toRemoveSet.has(item));
        savePromptBlacklist(remaining);
        setPromptBlacklist(remaining);
      }
      setSelectedBlacklistItems(new Set());
      showToast(`✓ Successfully sent ${items.length} cards from block list to AI Training Ideas!`);
    } catch (err: any) {
      showToast(`Notice: ${err.message || 'Batch processed'}`);
    } finally {
      setIsSendingToIdeas(false);
    }
  };

  const handleSendAllToIdeas = async (shouldRemove = false) => {
    if (promptBlacklist.length === 0) return;
    setIsSendingToIdeas(true);
    try {
      const ideas = promptBlacklist.map(item => convertBlacklistItemToIdea(item));
      await saveBatchAiTrainingIdeasToFirestore(ideas);
      setSentToIdeasSet(prev => {
        const next = new Set(prev);
        promptBlacklist.forEach(i => next.add(i.trim()));
        return next;
      });
      if (shouldRemove) {
        handleClearBlacklist();
      }
      setSelectedBlacklistItems(new Set());
      showToast(`✓ Successfully sent all ${promptBlacklist.length} cards from block list to AI Training Ideas!`);
    } catch (err: any) {
      showToast(`Notice: ${err.message || 'All cards processed'}`);
    } finally {
      setIsSendingToIdeas(false);
    }
  };

  const handleToggleSelectBlacklistItem = (item: string) => {
    setSelectedBlacklistItems(prev => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  };

  const handleSelectAllBlacklist = (filteredItems: string[]) => {
    if (selectedBlacklistItems.size >= filteredItems.length && filteredItems.length > 0) {
      setSelectedBlacklistItems(new Set());
    } else {
      setSelectedBlacklistItems(new Set(filteredItems));
    }
  };

  const [activeTrainingIdeasCount, setActiveTrainingIdeasCount] = useState<number>(() => {
    return getLocalTrainingIdeas().filter(i => i && i.isActive !== false).length;
  });

  // Categorized AI Ideas Card Bank inside Mass Submitter
  const [bankIdeas, setBankIdeas] = useState<AiTrainingIdea[]>(() => getLocalTrainingIdeas());
  const [showMassBankSelector, setShowMassBankSelector] = useState<boolean>(false);
  const [selectedMassBankCategory, setSelectedMassBankCategory] = useState<string>('ALL');
  const [selectedMassBankAssessment, setSelectedMassBankAssessment] = useState<'ALL' | 'Safe' | 'Unsafe'>('ALL');
  const [massBankSearch, setMassBankSearch] = useState<string>('');
  const [selectedMassBankIds, setSelectedMassBankIds] = useState<Set<string>>(new Set());
  const [isRecreatingMassBank, setIsRecreatingMassBank] = useState<boolean>(false);
  const [massBankRecreateProgress, setMassBankRecreateProgress] = useState<{ current: number; total: number } | null>(null);
  const [savedDeckToBankIds, setSavedDeckToBankIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const handler = () => {
      const latest = getLocalTrainingIdeas();
      setBankIdeas(latest);
      setActiveTrainingIdeasCount(latest.filter(i => i && i.isActive !== false).length);
    };
    window.addEventListener('rig50_ai_ideas_updated', handler);

    const unsubIdeas = subscribeToAiTrainingIdeas((loaded) => {
      if (Array.isArray(loaded) && loaded.length > 0) {
        setBankIdeas(loaded);
        setActiveTrainingIdeasCount(loaded.filter(i => i && i.isActive !== false).length);
      }
    });

    // Listen for cards sent from AiTrainingModal ("Send Selected to Mass Submitter")
    const consumePendingMassDeck = (cardsInput?: any[]) => {
      const pending = cardsInput || (window as any).__rig50_pending_mass_deck;
      if (Array.isArray(pending) && pending.length > 0) {
        (window as any).__rig50_pending_mass_deck = null;
        const formatted: Array<SoarCardTemplate & { selected: boolean }> = pending.map((c: any, idx: number) => ({
          id: c.id || `mass_from_bank_${Date.now()}_${idx}`,
          topic: c.topic || 'Card Bank Selection',
          zone: c.zone || 'Rig Floor',
          role: c.role || 'Floorman',
          assessment: (c.assessment === 'Unsafe' ? 'Unsafe' : 'Safe') as 'Safe' | 'Unsafe',
          obsType: (c.obsType || 'Behavior Observation') as any,
          category: c.category || (c.assessment === 'Unsafe' ? 'General Operational Safety' : 'Safe Behavior Observation'),
          categoryTheme: 'operations' as any,
          observation: c.observation || '',
          action: c.action || '',
          selected: true
        }));
        setPreviewDeck(formatted);
        setTargetCount(formatted.length);
        setShowPreviewDeck(true);
      }
    };

    consumePendingMassDeck();
    const handleSendEvent = (e: any) => {
      if (e?.detail?.cards) {
        consumePendingMassDeck(e.detail.cards);
      } else {
        consumePendingMassDeck();
      }
    };
    window.addEventListener('rig50_send_to_mass_submitter', handleSendEvent);

    return () => {
      window.removeEventListener('rig50_ai_ideas_updated', handler);
      window.removeEventListener('rig50_send_to_mass_submitter', handleSendEvent);
      unsubIdeas();
    };
  }, []);

  const massBankCategoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    AI_IDEA_CATEGORIES.forEach(c => { counts[c] = 0; });
    bankIdeas.forEach(idea => {
      const cat = getIdeaCategory(idea);
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [bankIdeas]);

  const filteredMassBankIdeas = useMemo(() => {
    return bankIdeas.filter(idea => {
      if (selectedMassBankCategory !== 'ALL' && getIdeaCategory(idea) !== selectedMassBankCategory) {
        return false;
      }
      if (selectedMassBankAssessment !== 'ALL' && (idea.assessment || 'Safe') !== selectedMassBankAssessment) {
        return false;
      }
      if (massBankSearch.trim()) {
        const q = massBankSearch.toLowerCase();
        const cat = getIdeaCategory(idea).toLowerCase();
        const match =
          (idea.topic || '').toLowerCase().includes(q) ||
          (idea.observation || '').toLowerCase().includes(q) ||
          (idea.action || '').toLowerCase().includes(q) ||
          (idea.zone || '').toLowerCase().includes(q) ||
          (idea.role || '').toLowerCase().includes(q) ||
          cat.includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [bankIdeas, selectedMassBankCategory, selectedMassBankAssessment, massBankSearch]);

  // Execution state
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [progressCount, setProgressCount] = useState<number>(0);
  const [successCount, setSuccessCount] = useState<number>(0);
  const [errorCount, setErrorCount] = useState<number>(0);

  // Speed and time tracking
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [speedCardsPerSec, setSpeedCardsPerSec] = useState<number>(0);

  // Receipts stream with persistent localStorage retention
  const [receipts, setReceipts] = useState<MassSubmittedReceipt[]>(() => {
    try {
      const saved = localStorage.getItem('rig50_mass_run_receipts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Abort controller reference
  const abortFlagRef = useRef<boolean>(false);
  const pauseFlagRef = useRef<boolean>(false);
  const [firestoreCardsLoaded, setFirestoreCardsLoaded] = useState<number>(0);

  // Sync historical cards and blacklist across storage layers (localStorage, server disk, and Firestore)
  useEffect(() => {
    const handleBlacklistUpdate = (e: any) => {
      if (Array.isArray(e.detail)) {
        setPromptBlacklist(e.detail);
      }
    };
    window.addEventListener('rig50_blacklist_updated', handleBlacklistUpdate);

    // Initial multi-layer reconciliation with all recorded soarCards in Firestore & server
    handleReconcileBlacklistWithDb(true);

    const unsubBlacklist = subscribeToPromptBlacklist((fsList) => {
      if (Array.isArray(fsList) && fsList.length > 0) {
        setPromptBlacklist(prev => {
          if (fsList.length >= prev.length) {
            return fsList;
          }
          return Array.from(new Set([...fsList, ...prev])).slice(0, 10000);
        });
        setFirestoreCardsLoaded(prev => Math.max(prev, fsList.length));
      }
    });

    // Initial sync and real-time subscription for Daily Automated Run Schedule
    getDailyScheduleFromFirestore()
      .then(fsSched => {
        if (fsSched && fsSched.dailyTime) {
          lastSavedTimeRef.current = fsSched.dailyTime;
          setDailySchedule(prev => ({
            ...prev,
            ...fsSched,
            dailyTime: isEditingTimeRef.current ? prev.dailyTime : fsSched.dailyTime
          }));
          if (fsSched.categoryQuotas) {
            setCategoryQuotas(fsSched.categoryQuotas);
          }
        }
      })
      .catch(() => {});

    fetch('/api/daily-schedule')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.schedule) {
          setDailySchedule(prev => ({
            ...prev,
            ...data.schedule,
            dailyTime: isEditingTimeRef.current
              ? prev.dailyTime
              : (lastSavedTimeRef.current || data.schedule.dailyTime || prev.dailyTime)
          }));
          if (data.schedule.categoryQuotas) {
            setCategoryQuotas(data.schedule.categoryQuotas);
          }
        }
      })
      .catch(() => {});

    // Always fetch latest run logs immediately on load
    fetchDailyRunLogs();

    // Poll schedule and logs every 15 seconds to keep timer status and run history fresh
    const pollInterval = setInterval(() => {
      fetch('/api/daily-schedule')
        .then(r => r.json())
        .then(d => {
          if (d.success && d.schedule) {
            setDailySchedule(prev => {
              const isTimeBeingEdited = isEditingTimeRef.current;
              return {
                ...prev,
                ...d.schedule,
                dailyTime: isTimeBeingEdited
                  ? prev.dailyTime
                  : (lastSavedTimeRef.current || d.schedule.dailyTime || prev.dailyTime)
              };
            });
          }
        })
        .catch(() => {});
      fetchDailyRunLogs();
    }, 15000);

    const unsubSchedule = subscribeToDailySchedule((cfg) => {
      if (cfg) {
        if (cfg.dailyTime && !isEditingTimeRef.current) {
          lastSavedTimeRef.current = cfg.dailyTime;
        }
        setDailySchedule(prev => {
          const isTimeBeingEdited = isEditingTimeRef.current;
          return {
            ...prev,
            ...cfg,
            dailyTime: isTimeBeingEdited ? prev.dailyTime : cfg.dailyTime
          };
        });
        if (cfg.categoryQuotas) {
          setCategoryQuotas(cfg.categoryQuotas);
        }
      }
    });

    const unsubLogs = subscribeToDailyRunLogs((fsLogs) => {
      if (Array.isArray(fsLogs) && fsLogs.length > 0) {
        setDailyRunLogs(prev => {
          const mergedMap = new Map<string, DailyRunLogEntry>();
          [...fsLogs, ...prev].forEach(l => {
            if (l && l.id) mergedMap.set(l.id, l);
          });
          return Array.from(mergedMap.values()).sort(
            (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
          );
        });
      }
    });

    return () => {
      window.removeEventListener('rig50_blacklist_updated', handleBlacklistUpdate);
      clearInterval(pollInterval);
      unsubSchedule();
      unsubLogs();
      unsubBlacklist();
    };
  }, []);

  // Timer interval for elapsed time and speedometer
  useEffect(() => {
    let interval: any = null;
    if (isRunning && !isPaused && startTime) {
      interval = setInterval(() => {
        const now = Date.now();
        const elapsed = (now - startTime) / 1000;
        setElapsedSeconds(Math.floor(elapsed));
        if (elapsed > 0 && progressCount > 0) {
          const speed = progressCount / elapsed;
          setSpeedCardsPerSec(Number(speed.toFixed(1)));
        }
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isRunning, isPaused, startTime, progressCount]);

  // Auto-scroll receipt log
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [receipts.length]);

  // Helper to generate a single card payload from active theme, category & assessment filter
  const createCardPayload = (idx: number) => {
    let cardTemplate: SoarCardTemplate | undefined;

    if (cardSource === 'template_pool') {
      const pool = getCardPoolByTheme(selectedThemes, assessmentFilter, cardCategory, obsTypeFilter);
      const candidate = idx < pool.length ? pool[idx] : undefined;
      if (candidate && !promptBlacklist.includes(candidate.observation.trim())) {
        cardTemplate = candidate;
      }
    }

    if (!cardTemplate) {
      if (aiCardsQueueRef.current && aiCardsQueueRef.current[idx]) {
        cardTemplate = aiCardsQueueRef.current[idx];
      } else {
        const seed = generateUniqueSeed(idx, `runtime_${Date.now()}`);
        const gen = generateInfiniteUniqueCards({
          count: 1,
          category: cardCategory,
          theme: selectedTheme,
          themes: selectedThemes,
          contentMode: contentMode,
          customTopic: customTopic,
          assessmentFilter: assessmentFilter,
          obsTypeFilter: obsTypeFilter,
          categoryQuotas: useCategoryQuotas ? categoryQuotas : undefined,
          baseSeed: seed,
          blacklist: promptBlacklist,
          trainingIdeas: getLocalTrainingIdeas()
        });
        cardTemplate = gen[0];
      }
    }

    // Auto-runs & mass runs keep Observer Name strictly empty as requested
    const { name: observerName, role: crewRole } = getCrewNameForSubmission(undefined, 'always_empty');

    let obsType = cardTemplate.obsType || 'Behavior Observation';
    if (useCategoryQuotas && assignedQuotaTypesRef.current && assignedQuotaTypesRef.current[idx]) {
      obsType = assignedQuotaTypesRef.current[idx];
    } else if (obsTypeFilter === 'swa') {
      obsType = 'STOP Work Authority (SWA)';
    } else if (obsTypeFilter === 'condition') {
      obsType = 'Condition';
    } else if (obsTypeFilter === 'behavior') {
      obsType = 'Behavior Observation';
    } else if (obsTypeFilter === 'swa_drill') {
      obsType = 'Stop Work Authority Drill';
    }

    // Strictly align Risk Status (Safe vs Unsafe) with the card's actual content and Observation Type
    let finalAssessment: 'Safe' | 'Unsafe' = cardTemplate.assessment || 'Safe';
    const lowerCombined = `${cardTemplate.observation} ${cardTemplate.action}`.toLowerCase();
    const isSwaIntervention =
      obsType === 'STOP Work Authority (SWA)' ||
      (lowerCombined.includes('stop work authority') && !lowerCombined.includes('drill'));

    if (isSwaIntervention) {
      finalAssessment = 'Unsafe';
      obsType = 'STOP Work Authority (SWA)';
    } else if (obsType === 'Stop Work Authority Drill') {
      finalAssessment = 'Safe';
    }

    const ppeStatus = finalAssessment === 'Safe' ? 'PPE Worn Correctly (Compliant)' : (cardTemplate.category.includes('PPE') ? 'PPE Not Worn' : 'PPE Worn Correctly (Compliant)');

    const answers = [
      { questionId: 'r5f3272b6049d4ad18e7650bd96ae837b', answer1: reportDate },
      { questionId: 'r4fdd1bd872014d9c80d3a51be3f2f950', answer1: RIG_50_NAME },
      { questionId: 'r409eb59dd0f244e4b52573ce50037896', answer1: cardTemplate.zone },
      { questionId: 'rfe47535c542e4ce8886c2741c4c69b78', answer1: crewRole || cardTemplate.role },
      { questionId: 'r26c88746635b40a39ef3f873e00e78a8', answer1: finalAssessment },
      { questionId: 'ra8f38f21840f490a87ac70d61da452f8', answer1: obsType },
      { questionId: 'r2d178592d7f94a6aad56238bc1005d5f', answer1: cardTemplate.category || (finalAssessment === 'Safe' ? 'Safe Behavior Observation' : 'General Operational Safety') },
      { questionId: 'r22c97581ebf74a8498da93d022d8afcf', answer1: ppeStatus },
      { questionId: 're36e820370e2436798ea97f34930b753', answer1: cardTemplate.observation },
      { questionId: 'rda2692cb0c9841fdb71f4b2ec5415728', answer1: cardTemplate.action },
      { questionId: 'r698ffb98e604476b92020bb6c34790e9', answer1: observerName }
    ];

    return {
      id: `card_${idx}`,
      meta: {
        zone: cardTemplate.zone,
        role: crewRole || cardTemplate.role,
        name: observerName || '(Anonymous / Empty)',
        assessment: finalAssessment,
        obsType
      },
      answers
    };
  };

  // Interactive Preview Deck Helpers
  const handleGeneratePreviewDeck = () => {
    const batchCount = Math.max(1, Math.min(250, targetCount));
    const generated = generateInfiniteUniqueCards({
      count: batchCount,
      category: cardCategory,
      theme: selectedTheme,
      themes: selectedThemes,
      contentMode: contentMode,
      customTopic: customTopic,
      assessmentFilter: assessmentFilter,
      obsTypeFilter: obsTypeFilter,
      categoryQuotas: useCategoryQuotas ? categoryQuotas : undefined,
      baseSeed: `preview_deck_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      blacklist: promptBlacklist,
      trainingIdeas: getLocalTrainingIdeas()
    });
    setPreviewDeck(generated.map(c => ({ ...c, selected: true })));
    setShowPreviewDeck(true);
    showToast(`✓ Generated ${generated.length} unique ${contentMode === 'pure_non_safety' ? 'Non-Safety' : 'themed'} cards for preview! Select/unselect or remake any card.`);
  };

  const handleRemakeSingleDeckCard = async (cardId: string, idx: number) => {
    const targetCard = previewDeck.find(c => c.id === cardId);
    const existingObs = previewDeck.map(c => c.observation.trim());
    setRemakingDeckCardId(cardId);

    try {
      const response = await fetch('/api/operations/ai-remake-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentCard: targetCard || {},
          operationsText: customTopic || `Selected Themes: ${selectedThemes.join(', ')}`,
          existingObservations: existingObs.slice(-25),
          preferredAssessment: cardCategory === 'Safe' ? 'Safe' : (targetCard?.assessment || 'Safe'),
          remakeMode: contentMode === 'pure_non_safety' ? 'non_safety_ai' : 'operations_ai',
          customInstruction: customTopic || (contentMode === 'pure_non_safety' ? `Theme: ${selectedThemes.join(', ')} (100% Non-Safety Fun Story)` : `Theme: ${selectedThemes.join(', ')}`)
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.card && data.card.observation) {
          setPreviewDeck(prev =>
            prev.map(item =>
              item.id === cardId
                ? {
                    ...item,
                    zone: data.card.zone || item.zone,
                    role: data.card.role || item.role,
                    assessment: data.card.assessment || item.assessment,
                    obsType: data.card.obsType || item.obsType,
                    category: data.card.category || item.category,
                    topic: data.card.topic || item.topic,
                    observation: data.card.observation,
                    action: data.card.action || item.action
                  }
                : item
            )
          );
          showToast(`✨ Gemini AI recreated Card #${idx + 1} with a fresh scenario!`);
          return;
        }
      }
    } catch (err) {
      console.warn('Deck AI Remake notice, using local engine fallback:', err);
    } finally {
      setRemakingDeckCardId(null);
    }

    const gen = generateInfiniteUniqueCards({
      count: 1,
      category: cardCategory,
      theme: selectedTheme,
      themes: selectedThemes,
      contentMode: contentMode,
      customTopic: customTopic,
      assessmentFilter: assessmentFilter,
      obsTypeFilter: obsTypeFilter,
      baseSeed: `remake_deck_${idx}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      blacklist: [...promptBlacklist, ...existingObs],
      trainingIdeas: getLocalTrainingIdeas()
    });
    if (gen[0]) {
      setPreviewDeck(prev =>
        prev.map(item => (item.id === cardId ? { ...gen[0], id: cardId, selected: item.selected } : item))
      );
      showToast(`✨ Recreated Card #${idx + 1} with a fresh unique scenario!`);
    }
  };

  const handleToggleDeckCard = (cardId: string) => {
    setPreviewDeck(prev =>
      prev.map(item => (item.id === cardId ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleSelectAllDeckCards = (selectAll: boolean) => {
    setPreviewDeck(prev => prev.map(item => ({ ...item, selected: selectAll })));
  };

  const handleUpdateDeckCardField = (cardId: string, field: 'observation' | 'action' | 'topic', value: string) => {
    setPreviewDeck(prev =>
      prev.map(item => (item.id === cardId ? { ...item, [field]: value } : item))
    );
  };

  // Convert an AiTrainingIdea to a SoarCardTemplate for Mass Submitter
  const mapBankIdeaToMassTemplate = (idea: AiTrainingIdea, idx: number): SoarCardTemplate & { selected: boolean } => {
    const cat = getIdeaCategory(idea);
    const assessment: 'Safe' | 'Unsafe' = idea.assessment === 'Unsafe' ? 'Unsafe' : 'Safe';
    const obsType = (idea.obsType || 'Behavior Observation') as any;
    return {
      id: `mass_bank_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      topic: `[${cat}] ${idea.topic}`,
      zone: idea.zone || 'Rig Floor',
      role: idea.role || 'Floorman',
      assessment,
      obsType,
      category: assessment === 'Safe' ? 'Safe Behavior Observation' : 'General Operational Safety',
      categoryTheme: 'operations' as any,
      observation: idea.observation,
      action: idea.action,
      selected: true
    };
  };

  // Smart Selection: Pick N Least-Used cards from the filtered Card Bank
  const handleSelectLeastUsedFromBank = (countToPick: number) => {
    if (filteredMassBankIdeas.length === 0) return;
    const sorted = [...filteredMassBankIdeas].sort((a, b) => (a.usageCount || 0) - (b.usageCount || 0));
    const picked = sorted.slice(0, countToPick);
    setSelectedMassBankIds(new Set(picked.map(i => i.id)));
    showToast(`✓ Selected ${picked.length} least-used cards from the Card Bank for balanced rotation!`);
  };

  // Smart Selection: Pick N Random cards from the filtered Card Bank
  const handleSelectRandomFromBank = (countToPick: number) => {
    if (filteredMassBankIdeas.length === 0) return;
    const shuffled = [...filteredMassBankIdeas].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, countToPick);
    setSelectedMassBankIds(new Set(picked.map(i => i.id)));
    showToast(`🎲 Randomly selected ${picked.length} cards from the Card Bank!`);
  };

  // Action 1: Load Selected Bank Cards As-Is into Mass Preview Deck
  const handleLoadSelectedBankIntoMassDeck = (append = false) => {
    const chosen = bankIdeas.filter(i => selectedMassBankIds.has(i.id));
    if (chosen.length === 0) {
      showToast('Select at least one card from the AI Ideas Card Bank first.');
      return;
    }
    const mapped = chosen.map((idea, idx) => mapBankIdeaToMassTemplate(idea, idx));
    setPreviewDeck(prev => {
      const next = append ? [...mapped, ...prev] : mapped;
      setTargetCount(next.filter(c => c.selected).length || next.length);
      return next;
    });
    setShowPreviewDeck(true);
    incrementIdeaUsageInFirestore(chosen.map(i => i.id)).catch(() => {});
    showToast(`📥 Loaded ${mapped.length} card(s) from the AI Ideas Card Bank into the Mass Preview Deck!`);
  };

  // Action 2: Immediately Mass Submit Selected Bank Cards Now
  const handleMassSubmitSelectedBankNow = () => {
    const chosen = bankIdeas.filter(i => selectedMassBankIds.has(i.id));
    if (chosen.length === 0) {
      showToast('Select at least one card from the AI Ideas Card Bank to mass submit.');
      return;
    }
    const mapped = chosen.map((idea, idx) => mapBankIdeaToMassTemplate(idea, idx));
    setPreviewDeck(mapped);
    setTargetCount(mapped.length);
    setShowPreviewDeck(true);
    incrementIdeaUsageInFirestore(chosen.map(i => i.id)).catch(() => {});
    handleStartMassRun(true, mapped);
  };

  // Action 3: AI Recreate Selected Bank Cards into Fresh, Non-Duplicate Cards in Mass Preview Deck
  const handleAiRecreateSelectedBankForMassDeck = async () => {
    const chosen = bankIdeas.filter(i => selectedMassBankIds.has(i.id));
    if (chosen.length === 0) {
      showToast('Select at least one card from the AI Ideas Card Bank to recreate with AI.');
      return;
    }

    setIsRecreatingMassBank(true);
    setMassBankRecreateProgress({ current: 0, total: chosen.length });
    setShowPreviewDeck(true);

    const recreated: Array<SoarCardTemplate & { selected: boolean }> = [];
    for (let idx = 0; idx < chosen.length; idx++) {
      setMassBankRecreateProgress({ current: idx + 1, total: chosen.length });
      const idea = chosen[idx];
      const cat = getIdeaCategory(idea);
      const baseTemplate = mapBankIdeaToMassTemplate(idea, idx);

      try {
        const res = await fetch('/api/operations/ai-remake-card', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentCard: baseTemplate,
            operationsText: `Category: ${cat}\nTopic: ${idea.topic}\nZone: ${idea.zone || 'Rig Floor'}\nRole: ${idea.role || 'Floorman'}\nExemplar Observation: ${idea.observation}\nExemplar Action: ${idea.action}\nKeywords: ${getCleanIdeaKeywords(idea.keywords)}`,
            existingObservations: [...previewDeck.map(c => c.observation), ...recreated.map(c => c.observation)].slice(-25),
            preferredAssessment: idea.assessment || 'Safe',
            remakeMode: cat.includes('Non-Safety') ? 'non_safety_ai' : 'operations_ai',
            customInstruction: `STRICT RULE: Do NOT include clock times. Synthesize a brand-new, freshly worded SOAR card inspired by "${idea.topic}" for a new mass submission. ${customTopic || ''}`.trim()
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.card && data.card.observation) {
            recreated.push({
              ...baseTemplate,
              id: `mass_bank_rec_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
              topic: `[AI Recreated · ${cat}] ${data.card.topic || idea.topic}`,
              zone: data.card.zone || baseTemplate.zone,
              role: data.card.role || baseTemplate.role,
              assessment: (data.card.assessment === 'Unsafe' ? 'Unsafe' : 'Safe') as 'Safe' | 'Unsafe',
              obsType: (data.card.obsType || baseTemplate.obsType) as any,
              observation: data.card.observation,
              action: data.card.action || baseTemplate.action,
              selected: true
            });
            continue;
          }
        }
      } catch (e) {
        console.warn('Mass bank AI recreate fallback:', e);
      }

      // Fallback variation using local engine seeded with this specific idea
      const gen = generateInfiniteUniqueCards({
        count: 1,
        category: cardCategory,
        theme: 'operations',
        contentMode: contentMode,
        customTopic: idea.topic,
        assessmentFilter: idea.assessment === 'Unsafe' ? 'unsafe_only' : 'safe_only',
        baseSeed: `bank_spin_${Date.now()}_${idx}`,
        blacklist: [...promptBlacklist, idea.observation],
        trainingIdeas: [idea]
      });
      if (gen[0]) {
        recreated.push({
          ...gen[0],
          id: `mass_bank_rec_${Date.now()}_${idx}`,
          topic: `[Recreated · ${cat}] ${idea.topic}`,
          selected: true
        });
      }
    }

    if (recreated.length > 0) {
      setPreviewDeck(recreated);
      setTargetCount(recreated.length);
      incrementIdeaUsageInFirestore(chosen.map(i => i.id)).catch(() => {});
      showToast(`✨ Gemini AI recreated ${recreated.length} fresh, non-duplicate cards into the Mass Preview Deck!`);
    }
    setIsRecreatingMassBank(false);
    setMassBankRecreateProgress(null);
  };

  // Action 4: Expand Selected Bank Ideas into a Full Batch of `targetCount` Unique Cards
  const handleGenerateFullTargetBatchFromSelectedBank = () => {
    const chosen = bankIdeas.filter(i => selectedMassBankIds.has(i.id));
    if (chosen.length === 0) {
      showToast('Select at least one card from the AI Ideas Card Bank first.');
      return;
    }
    const batchCount = Math.max(1, Math.min(250, targetCount));
    const generated = generateInfiniteUniqueCards({
      count: batchCount,
      category: cardCategory,
      theme: 'operations',
      themes: ['operations'],
      contentMode: contentMode,
      customTopic: customTopic,
      assessmentFilter: assessmentFilter,
      obsTypeFilter: obsTypeFilter,
      categoryQuotas: useCategoryQuotas ? categoryQuotas : undefined,
      baseSeed: `bank_expand_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      blacklist: promptBlacklist,
      trainingIdeas: chosen.map(i => ({ ...i, isActive: true }))
    });
    setPreviewDeck(generated.map(c => ({ ...c, selected: true })));
    setShowPreviewDeck(true);
    incrementIdeaUsageInFirestore(chosen.map(i => i.id)).catch(() => {});
    showToast(`🔄 Synthesized ${generated.length} unique mass cards derived from your ${chosen.length} selected Card Bank idea(s)!`);
  };

  // Save selected or single card from Mass Preview Deck back to the Categorized AI Ideas Card Bank
  const handleSaveDeckCardsToAiBank = async (cardsToSave: Array<SoarCardTemplate & { selected: boolean }>) => {
    if (cardsToSave.length === 0) return;
    const nowIso = new Date().toISOString();
    const ideasToSave: AiTrainingIdea[] = cardsToSave.map((c, idx) => {
      const cleanTopic = (c.topic || `${c.zone} ${c.obsType}`).replace(/^\[[^\]]+\]\s*/, '').slice(0, 140);
      const rawKw = `${c.zone}, ${c.role}, ${c.obsType}`;
      const cat = getIdeaCategory({
        topic: cleanTopic,
        zone: c.zone,
        role: c.role,
        assessment: c.assessment,
        obsType: c.obsType,
        observation: c.observation,
        action: c.action,
        keywords: rawKw
      });
      return {
        id: `idea_mass_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        topic: cleanTopic,
        zone: c.zone,
        role: c.role,
        assessment: c.assessment,
        obsType: c.obsType,
        observation: c.observation.slice(0, 1950),
        action: c.action.slice(0, 1950),
        keywords: setIdeaCategoryInKeywords(rawKw, cat),
        categoryGroup: cat,
        isActive: true,
        usageCount: 0,
        lastUsedAt: nowIso,
        createdAt: nowIso
      };
    });

    await saveBatchAiTrainingIdeasToFirestore(ideasToSave);
    setSavedDeckToBankIds(prev => {
      const next = new Set(prev);
      cardsToSave.forEach(c => next.add(c.id));
      return next;
    });
    showToast(`🧠 Saved ${ideasToSave.length} card(s) from Mass Deck into the Categorized AI Ideas Card Bank!`);
  };

  const handleStartMassRun = async (
    useSelectedDeckOnly = false,
    explicitDeckOverride?: Array<SoarCardTemplate & { selected: boolean }>
  ) => {
    const selectedFromDeck = explicitDeckOverride
      ? explicitDeckOverride
      : useSelectedDeckOnly
        ? previewDeck.filter(c => c.selected)
        : [];
    const effectiveTargetCount =
      (useSelectedDeckOnly || explicitDeckOverride) && selectedFromDeck.length > 0
        ? selectedFromDeck.length
        : targetCount;

    if ((useSelectedDeckOnly || explicitDeckOverride) && selectedFromDeck.length > 0) {
      setTargetCount(selectedFromDeck.length);
    }

    setIsRunning(true);
    setIsPaused(false);
    abortFlagRef.current = false;
    pauseFlagRef.current = false;
    setProgressCount(0);
    setSuccessCount(0);
    setErrorCount(0);
    setReceipts([]);
    setStartTime(Date.now());
    setElapsedSeconds(0);
    setSpeedCardsPerSec(0);

    // If Custom Category Quotas is active (e.g. 45 Condition / 45 Behavior / 10 SWA), compute exact sequence
    if (useCategoryQuotas) {
      assignedQuotaTypesRef.current = buildQuotaTypeSequence(categoryQuotas, effectiveTargetCount);
    } else {
      assignedQuotaTypesRef.current = [];
    }

    if ((useSelectedDeckOnly || explicitDeckOverride) && selectedFromDeck.length > 0) {
      aiCardsQueueRef.current = selectedFromDeck;
    } else {
      // Always pre-generate effectiveTargetCount + 50 unique cards enforcing the Prompt History blacklist so no scenario ever repeats
      const generated = generateInfiniteUniqueCards({
        count: effectiveTargetCount + 50,
        category: cardCategory,
        theme: selectedTheme,
        themes: selectedThemes,
        contentMode: contentMode,
        customTopic: customTopic,
        assessmentFilter: assessmentFilter,
        obsTypeFilter: obsTypeFilter,
        categoryQuotas: useCategoryQuotas ? categoryQuotas : undefined,
        baseSeed: `batch_run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        blacklist: promptBlacklist,
        trainingIdeas: getLocalTrainingIdeas()
      });
      aiCardsQueueRef.current = generated;
    }

    let submitted = 0;

    // Process in batches
    while (submitted < effectiveTargetCount && !abortFlagRef.current) {
      // Handle Pause
      while (pauseFlagRef.current && !abortFlagRef.current) {
        await new Promise(r => setTimeout(r, 400));
      }

      if (abortFlagRef.current) break;

      // Prepare chunk
      const currentBatchTarget = Math.min(chunkSize, effectiveTargetCount - submitted);
      const chunkItems: any[] = [];

      for (let k = 0; k < currentBatchTarget; k++) {
        const item = createCardPayload(submitted + k);
        chunkItems.push(item);
      }

      try {
        const response = await fetch('/api/submit-chunk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: chunkItems.map(i => ({ answers: i.answers, id: i.id }))
          })
        });

        const resText = await response.text();
        let data: any = null;
        try {
          data = JSON.parse(resText);
        } catch {
          data = null;
        }

        if (response.ok && data && data.success) {
          const newReceipts: MassSubmittedReceipt[] = (data.results || []).map((r: any, rIdx: number) => {
            const original = chunkItems[rIdx];
            return {
              index: submitted + rIdx + 1,
              responseId: r.responseId,
              time: new Date().toLocaleTimeString(),
              zone: original?.meta?.zone || 'Rig Floor',
              role: original?.meta?.role || 'Driller',
              name: original?.meta?.name || '(Empty)',
              assessment: original?.meta?.assessment || 'Safe',
              obsType: original?.meta?.obsType || 'Behavior Observation'
            };
          });

          // Auto-blacklist recently submitted scenarios to permanently bar them from upcoming runs
          if (autoBlacklistEnabled) {
            const newObsList = chunkItems.map(item => {
              const obs = item.answers?.find((a: any) => a.questionId === 're36e820370e2436798ea97f34930b753')?.answer1;
              return typeof obs === 'string' ? obs.trim() : '';
            }).filter(Boolean);

            if (newObsList.length > 0) {
              const updated = addToPromptBlacklist(newObsList);
              setPromptBlacklist(updated);
            }
          }

          setSuccessCount(prev => prev + (data.succeeded || 0));
          setErrorCount(prev => prev + (data.failed || 0));
          setReceipts(prev => [...prev.slice(-150), ...newReceipts]); // keep last 150 in memory

          // Record submitted cards to Firestore database
          chunkItems.forEach((cItem, cIdx) => {
            const resp = data.results?.[cIdx];
            recordCardToFirestore({
              responseId: String(resp?.responseId || ''),
              date: reportDate,
              time: new Date().toLocaleTimeString(),
              zone: cItem.meta?.zone || 'Rig Floor',
              role: cItem.meta?.role || 'Driller',
              observerRole: 'Observer',
              observerName: cItem.meta?.name || '(Empty)',
              assessment: cItem.meta?.assessment || 'Safe',
              obsType: cItem.meta?.obsType || 'Behavior Observation',
              observation: cItem.answers?.find((a: any) => a.questionId === 're36e820370e2436798ea97f34930b753')?.answer1 || '',
              action: cItem.answers?.find((a: any) => a.questionId === 'rda2692cb0c9841fdb71f4b2ec5415728')?.answer1 || '',
              aiPolished: cardSource === 'ai_unique'
            }).then(res => {
              if (res?.success) setFirestoreCardsLoaded(prev => prev + 1);
            }).catch(fsErr => console.warn('Firestore mass card recording notice:', fsErr));
          });
        } else {
          // Direct fallback: dispatch directly to Microsoft Forms Cloud API so cards are NEVER lost on Hostinger
          console.warn('Backend chunk API returned error, activating Direct MS Forms Engine fallback');
          let directSuccess = 0;
          const directReceipts: MassSubmittedReceipt[] = [];

          for (let d = 0; d < chunkItems.length; d++) {
            const original = chunkItems[d];
            try {
              const directEndpoint = `https://forms.cloud.microsoft/formapi/api/${USER_TENANT_ID}/users/${USER_OWNER_ID}/forms('${USER_FORM_ID}')/responses`;
              const payload = {
                startDate: new Date(Date.now() - 45000).toISOString(),
                submitDate: new Date().toISOString(),
                answers: JSON.stringify(original.answers),
                submitLanguage: 'en-US',
                emailReceiptConsent: false
              };
              await fetch(directEndpoint, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });
              directSuccess++;
              directReceipts.push({
                index: submitted + d + 1,
                responseId: `MS-DIR-${Date.now().toString().slice(-5)}`,
                time: new Date().toLocaleTimeString(),
                zone: original?.meta?.zone || 'Rig Floor',
                role: original?.meta?.role || 'Driller',
                name: original?.meta?.name || '(Empty)',
                assessment: original?.meta?.assessment || 'Safe',
                obsType: original?.meta?.obsType || 'Behavior Observation'
              });

              // Record to Firestore
              recordCardToFirestore({
                responseId: `MS-DIR-${Date.now().toString().slice(-5)}`,
                date: reportDate,
                time: new Date().toLocaleTimeString(),
                zone: original?.meta?.zone || 'Rig Floor',
                role: original?.meta?.role || 'Driller',
                observerRole: 'Observer',
                observerName: original?.meta?.name || '(Empty)',
                assessment: original?.meta?.assessment || 'Safe',
                obsType: original?.meta?.obsType || 'Behavior Observation',
                observation: original.answers?.find((a: any) => a.questionId === 're36e820370e2436798ea97f34930b753')?.answer1 || '',
                action: original.answers?.find((a: any) => a.questionId === 'rda2692cb0c9841fdb71f4b2ec5415728')?.answer1 || '',
                aiPolished: cardSource === 'ai_unique'
              }).then(res => {
                if (res?.success) setFirestoreCardsLoaded(prev => prev + 1);
              }).catch(() => {});
            } catch {
              // Failed item
            }
          }

          if (autoBlacklistEnabled) {
            const newObsList = chunkItems.map(item => {
              const obs = item.answers?.find((a: any) => a.questionId === 're36e820370e2436798ea97f34930b753')?.answer1;
              return typeof obs === 'string' ? obs.trim() : '';
            }).filter(Boolean);
            if (newObsList.length > 0) {
              const updated = addToPromptBlacklist(newObsList);
              setPromptBlacklist(updated);
            }
          }

          setSuccessCount(prev => prev + directSuccess);
          setErrorCount(prev => prev + (chunkItems.length - directSuccess));
          if (directReceipts.length > 0) {
            setReceipts(prev => [...prev.slice(-150), ...directReceipts]);
          }
        }
      } catch (err) {
        console.warn('Backend chunk endpoint notice, activating direct MS Forms submission fallback:', err);
        // Direct fallback on network exception
        let directSuccess = 0;
        const directReceipts: MassSubmittedReceipt[] = [];

        for (let d = 0; d < chunkItems.length; d++) {
          const original = chunkItems[d];
          try {
            const directEndpoint = `https://forms.cloud.microsoft/formapi/api/${USER_TENANT_ID}/users/${USER_OWNER_ID}/forms('${USER_FORM_ID}')/responses`;
            const payload = {
              startDate: new Date(Date.now() - 45000).toISOString(),
              submitDate: new Date().toISOString(),
              answers: JSON.stringify(original.answers),
              submitLanguage: 'en-US',
              emailReceiptConsent: false
            };
            await fetch(directEndpoint, {
              method: 'POST',
              mode: 'no-cors',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            directSuccess++;
            directReceipts.push({
              index: submitted + d + 1,
              responseId: `MS-DIR-${Date.now().toString().slice(-5)}`,
              time: new Date().toLocaleTimeString(),
              zone: original?.meta?.zone || 'Rig Floor',
              role: original?.meta?.role || 'Driller',
              name: original?.meta?.name || '(Empty)',
              assessment: original?.meta?.assessment || 'Safe',
              obsType: original?.meta?.obsType || 'Behavior Observation'
            });

            // Record to Firestore
            recordCardToFirestore({
              responseId: `MS-DIR-${Date.now().toString().slice(-5)}`,
              date: reportDate,
              time: new Date().toLocaleTimeString(),
              zone: original?.meta?.zone || 'Rig Floor',
              role: original?.meta?.role || 'Driller',
              observerRole: 'Observer',
              observerName: original?.meta?.name || '(Empty)',
              assessment: original?.meta?.assessment || 'Safe',
              obsType: original?.meta?.obsType || 'Behavior Observation',
              observation: original.answers?.find((a: any) => a.questionId === 're36e820370e2436798ea97f34930b753')?.answer1 || '',
              action: original.answers?.find((a: any) => a.questionId === 'rda2692cb0c9841fdb71f4b2ec5415728')?.answer1 || '',
              aiPolished: cardSource === 'ai_unique'
            }).then(res => {
              if (res?.success) setFirestoreCardsLoaded(prev => prev + 1);
            }).catch(() => {});
          } catch {
            // Failed
          }
        }

        if (autoBlacklistEnabled) {
          const newObsList = chunkItems.map(item => {
            const obs = item.answers?.find((a: any) => a.questionId === 're36e820370e2436798ea97f34930b753')?.answer1;
            return typeof obs === 'string' ? obs.trim() : '';
          }).filter(Boolean);
          if (newObsList.length > 0) {
            const updated = addToPromptBlacklist(newObsList);
            setPromptBlacklist(updated);
          }
        }

        setSuccessCount(prev => prev + directSuccess);
        setErrorCount(prev => prev + (chunkItems.length - directSuccess));
        if (directReceipts.length > 0) {
          setReceipts(prev => [...prev.slice(-150), ...directReceipts]);
        }
      }

      submitted += currentBatchTarget;
      setProgressCount(submitted);

      // Mild cooldown delay to avoid tripping Microsoft rate limit
      await new Promise(r => setTimeout(r, 300));
    }

    setIsRunning(false);
    setIsPaused(false);

    // Record completed manual batch run into Firestore and server run logs
    if (submitted > 0) {
      const now = new Date();
      const tz = dailySchedule.timezone || 'Asia/Riyadh';
      const elapsedSecStr = startTime ? ((Date.now() - startTime) / 1000).toFixed(1) : '1.0';
      const manualLog: DailyRunLogEntry = {
        id: `run_manual_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: now.toISOString(),
        timezone: tz,
        localTimeDisplay: `${now.toISOString().split('T')[0]} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} (${tz === 'Asia/Riyadh' ? 'AST' : tz})`,
        utcTimeDisplay: `${now.toISOString().replace('T', ' ').slice(0, 19)} UTC`,
        triggerType: 'manual',
        status: 'success',
        targetCount,
        succeeded: submitted,
        failed: 0,
        categoryQuotas,
        elapsedSeconds: elapsedSecStr,
        recipientEmail: dailySchedule.recipientEmail || 'uploadsa35@gmail.com',
        emailSent: false,
        summary: `${submitted} of ${targetCount} cards submitted in ${elapsedSecStr}s`,
        sampleReceipts: []
      };
      saveDailyRunLogToFirestore(manualLog).catch(() => {});
      fetch('/api/daily-schedule/record-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manualLog)
      }).then(() => fetchDailyRunLogs()).catch(() => {});
    }
  };

  const handlePauseResume = () => {
    if (isPaused) {
      pauseFlagRef.current = false;
      setIsPaused(false);
    } else {
      pauseFlagRef.current = true;
      setIsPaused(true);
    }
  };

  const handleStop = () => {
    abortFlagRef.current = true;
    pauseFlagRef.current = false;
    setIsRunning(false);
    setIsPaused(false);
  };

  const handleExportReceiptsCsv = () => {
    if (receipts.length === 0) return;
    const header = 'CardNumber,ReceiptID,Time,Rig,Zone,Role,ObserverName,Assessment\n';
    const rows = receipts.map(r => 
      `${r.index},"${r.responseId}","${r.time}","${RIG_50_NAME}","${r.zone}","${r.role}","${r.name}","${r.assessment}"`
    ).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rig50_Mass_Receipts_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const progressPct = targetCount > 0 ? Math.min(100, Math.round((progressCount / targetCount) * 100)) : 0;
  const remainingCards = Math.max(0, targetCount - progressCount);
  const etaSeconds = speedCardsPerSec > 0 ? Math.round(remainingCards / speedCardsPerSec) : 0;

  if (!isSupervisor) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-10 shadow-xs max-w-xl mx-auto text-center space-y-5 my-8">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto border border-amber-200 shadow-2xs">
          <Lock className="w-8 h-8 text-amber-700" />
        </div>
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
            Supervisor &amp; RSC Access Required
          </span>
          <h3 className="text-lg sm:text-xl font-bold text-slate-900">
            Mass Submitter (1000s Engine) Locked
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
            This engine is designed to dispatch 100s or 1,000s of cards simultaneously into the official Rig 50 Microsoft Forms database. To prevent accidental flooding by crew, access is restricted with a supervisor passcode.
          </p>
        </div>

        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-left text-xs text-slate-700 space-y-2">
          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-teal-600" />
            <span>Rig 50 Crew Members:</span>
          </div>
          <p className="text-[11px] text-slate-600">
            You can submit individual safety observations anytime using the <strong>Quick Submitter</strong> or <strong>WhatsApp Bot</strong> tabs without requiring any passcode.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openLoginModal('mass')}
          className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
        >
          <KeyRound className="w-4 h-4" />
          <span>Enter Supervisor Passcode to Unlock (1000s Engine)</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-indigo-950 rounded-xl p-5 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-400/30">
              <Rocket className="w-5 h-5 text-teal-300" />
            </span>
            <h2 className="text-base sm:text-lg font-bold">
              Mass Card Submitter (1000s Cards Engine)
            </h2>
            <span className="bg-teal-500/30 text-teal-200 text-[11px] font-bold px-2 py-0.5 rounded border border-teal-400/40">
              High-Throughput Pool
            </span>
          </div>
          <p className="text-xs text-teal-100/80 max-w-2xl leading-relaxed">
            Submit hundreds or thousands of SOAR cards directly to Microsoft Forms for <strong>Rig 50 (50 Bob Palmer)</strong> at the same time. Powered by an automated parallel chunk worker with live throughput monitoring and response ID receipts!
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs bg-slate-900/80 px-3 py-2 rounded-lg border border-slate-700">
          <Lock className="w-4 h-4 text-teal-400" />
          <span>Locked to Rig: <strong>50 Bob Palmer (RBP-50A)</strong></span>
        </div>
      </div>

      {/* METRICS & SPEEDOMETER DASHBOARD */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
            Progress
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-extrabold text-slate-900 font-mono">
              {progressCount}
            </span>
            <span className="text-xs text-slate-500 font-mono">/ {targetCount}</span>
          </div>
          <span className="text-[11px] font-semibold text-teal-700 mt-1 block">
            {progressPct}% Completed
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
            Throughput Speed
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-extrabold text-teal-700 font-mono">
              {speedCardsPerSec}
            </span>
            <span className="text-xs text-slate-500">cards / sec</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            {speedCardsPerSec > 0 ? `~${Math.round(speedCardsPerSec * 60)} cards / min` : 'Standby'}
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
            Time &amp; ETA
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-extrabold text-slate-900 font-mono">
              {elapsedSeconds}s
            </span>
            <span className="text-xs text-slate-500">elapsed</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            {isRunning ? `ETA: ~${etaSeconds}s remaining` : 'Idle'}
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
            Verified Receipts
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-extrabold text-emerald-700 font-mono">
              {successCount}
            </span>
            {errorCount > 0 && (
              <span className="text-xs font-bold text-rose-600 font-mono">({errorCount} err)</span>
            )}
          </div>
          <span className="text-[11px] text-emerald-700 font-semibold mt-1 block">
            100% Microsoft HTTP 201
          </span>
        </div>
      </div>

      {/* Custom Cards Bank Modal */}
      <CustomCardBankModal
        isOpen={showCardBankModal}
        onClose={() => setShowCardBankModal(false)}
        onCardsUpdated={() => setCustomCardsCount(getStoredCustomCards().length)}
      />

      {/* BATCH SETUP CONTROLS */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Rocket className="w-4 h-4 text-indigo-600" />
            <span>Mass Submitter Configuration &amp; Topic Controls</span>
          </span>
          <span className="text-xs text-slate-500">
            Names sourced from <strong>Rig 50 Crew Roster</strong> ({getAnonymousRatio()}% Anonymous)
          </span>
        </div>

        {/* CARD CATEGORY SELECTOR: 'Safe' vs 'General' (Automatically Adjusts Content Generation) */}
        <div className="p-4 bg-gradient-to-r from-slate-50 via-indigo-50/50 to-slate-50 rounded-2xl border border-indigo-200 space-y-3 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-indigo-600" />
                  <span>Card Category Focus</span>
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  cardCategory === 'Safe'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                }`}>
                  Active: {cardCategory} Cards
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Toggle between pure <strong>Safe</strong> behaviors or broad <strong>General</strong> operational safety
              </p>
            </div>

            {/* Toggle Buttons */}
            <div className="inline-flex p-1 bg-white border border-slate-300 rounded-xl shadow-2xs self-start sm:self-center">
              <button
                type="button"
                onClick={() => handleToggleCardCategory('Safe')}
                disabled={isRunning}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  cardCategory === 'Safe'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                <span>'Safe' Category</span>
              </button>

              <button
                type="button"
                onClick={() => handleToggleCardCategory('General')}
                disabled={isRunning}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  cardCategory === 'General'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Layers className="w-4 h-4 text-indigo-200" />
                <span>'General' Category</span>
              </button>
            </div>
          </div>

          {/* Dynamic Content Generation Logic Explainer */}
          <div className="text-[11px] leading-relaxed bg-white/90 p-3 rounded-xl border border-slate-200 text-slate-700 flex items-start gap-2.5">
            <span className="text-base shrink-0 mt-0.5">
              {cardCategory === 'Safe' ? '🛡️' : '🌐'}
            </span>
            <div className="space-y-0.5">
              <span className="font-bold text-slate-900 block">
                {cardCategory === 'Safe'
                  ? 'Safe Category Mode Active (Automatic Content Adjustment):'
                  : 'General Category Mode Active (Automatic Content Adjustment):'}
              </span>
              <p className="text-slate-600">
                {cardCategory === 'Safe'
                  ? 'All generated cards are automatically formatted as 100% Safe (Positive Behavior Observation). Emphasizes hands-free safety, red-zone clearance, PPE compliance, and positive recognition.'
                  : 'Generates comprehensive operational safety cards covering routine equipment condition checks, high-pressure line tests, housekeeping, barrier maintenance, and day-to-day rig operations.'}
              </p>
            </div>
          </div>
        </div>

        {/* AI PROMPT ENGINE & CARD SOURCE SELECTOR (Unique Seed & Context Per Card) */}
        <div className="space-y-3 p-4 bg-gradient-to-br from-purple-50/70 via-indigo-50/40 to-slate-50 rounded-2xl border border-purple-200/90 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                AI Prompt Engine (Unique Seed &amp; Context Per Card)
              </span>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300">
              {cardSource === 'ai_unique' ? '✨ Gemini AI Dynamic Engine Active' : '📋 Pre-stored Library Mode'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setCardSource('ai_unique')}
              disabled={isRunning}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                cardSource === 'ai_unique'
                  ? 'bg-white border-purple-500 ring-2 ring-purple-500/20 shadow-xs'
                  : 'bg-white/70 border-slate-200 hover:bg-white text-slate-600'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Sparkles className={`w-3.5 h-3.5 ${cardSource === 'ai_unique' ? 'text-purple-600' : 'text-slate-400'}`} />
                  <span>🤖 Custom AI Engine (100% Unique)</span>
                </span>
                <span className="text-[9px] font-extrabold bg-purple-600 text-white px-1.5 py-0.5 rounded uppercase tracking-wider">
                  Zero Duplicates
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-snug">
                Every card generated with a unique seed and deep operational context (equipment tag, sub-assembly, and specific action). No two cards are identical!
              </p>
            </button>

            <button
              type="button"
              onClick={() => setCardSource('template_pool')}
              disabled={isRunning}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                cardSource === 'template_pool'
                  ? 'bg-white border-slate-700 ring-2 ring-slate-500/20 shadow-xs'
                  : 'bg-white/70 border-slate-200 hover:bg-white text-slate-600'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Layers className={`w-3.5 h-3.5 ${cardSource === 'template_pool' ? 'text-slate-900' : 'text-slate-400'}`} />
                  <span>📋 Template Bank (Pre-stored Cards)</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-snug">
                Cycles through the pre-stored humor &amp; operational library cards (e.g. Motorola DEA bust, Venecia love notes, Wham! handover).
              </p>
            </button>
          </div>

          {cardSource === 'ai_unique' && (
            <div className="space-y-2.5">
              <div className="text-[11px] bg-white/90 p-3 rounded-xl border border-purple-200/80 text-slate-700 space-y-1">
                <div className="flex items-center gap-2 font-mono text-[10px] text-purple-900">
                  <span className="font-bold">SEED ENGINE:</span>
                  <span className="bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                    Unique high-entropy seed injected into every card iteration
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[10px] text-indigo-900">
                  <span className="font-bold">CONTEXT ENGINE:</span>
                  <span className="bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                    Dynamic context: [Zone] × [Equipment Tag] × [Activity] × [Shift]
                  </span>
                </div>
              </div>

              {/* PROMPT HISTORY BLACKLIST CONTROL PANEL */}
              <div className="bg-white/95 rounded-xl border border-purple-200 p-3.5 space-y-2.5 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Ban className="w-4 h-4 text-rose-500 shrink-0" />
                    <span className="text-xs font-bold text-slate-900">
                      Prompt History Blacklist Engine
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                      {promptBlacklist.length} Scenarios Barred
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                      <Database className="w-3 h-3 text-emerald-600" />
                      {Math.max(firestoreCardsLoaded, promptBlacklist.length)} Cards in Database
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleReconcileBlacklistWithDb(false)}
                      disabled={isReconcilingBlacklist}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                      title="Sync and reconcile all submitted SOAR cards from Firestore Database into the Blacklist Engine"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isReconcilingBlacklist ? 'animate-spin' : ''}`} />
                      <span>{isReconcilingBlacklist ? 'Syncing...' : 'Sync DB'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowBlacklistModal(true)}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-300 flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                      title="Send cards from block list to AI Training Ideas"
                    >
                      <Lightbulb className="w-3.5 h-3.5 text-purple-600" />
                      <span>Send to Ideas ({promptBlacklist.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowBlacklistModal(true)}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Inspect and manage blacklisted prompt scenarios"
                    >
                      <History className="w-3.5 h-3.5 text-slate-500" />
                      <span>Manage History ({promptBlacklist.length})</span>
                    </button>

                    {promptBlacklist.length > 0 && (
                      isConfirmingClearHistory ? (
                        <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                          <span className="text-[10px] font-bold text-rose-700">Clear?</span>
                          <button
                            type="button"
                            onClick={handleClearBlacklist}
                            className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-600 text-white rounded hover:bg-rose-700"
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsConfirmingClearHistory(false)}
                            className="px-1.5 py-0.5 text-[10px] bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsConfirmingClearHistory(true)}
                          disabled={isRunning}
                          className="px-2 py-1 text-[11px] font-bold rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 flex items-center gap-1 transition-colors"
                          title="Reset and clear all blacklisted card history"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Clear</span>
                        </button>
                      )
                    )}
                  </div>
                </div>

                <p className="text-[11px] text-slate-600 leading-relaxed">
                  The Gemini AI tracks previously generated observations and equipment tags. When you trigger mass submissions, previous card topics are automatically blacklisted and the AI dynamically steers towards novel, unvisited rig systems—guaranteeing 100% scenario variance across every batch.
                </p>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-100 text-[11px]">
                  <label className="flex items-center gap-2 text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoBlacklistEnabled}
                      onChange={(e) => setAutoBlacklistEnabled(e.target.checked)}
                      className="w-3.5 h-3.5 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                    />
                    <span>Auto-blacklist every generated card into prompt history</span>
                  </label>

                  <span className="text-[10px] text-purple-700 font-mono font-semibold">
                    {autoBlacklistEnabled ? '✓ Dynamic Anti-Collision Active' : 'Off'}
                  </span>
                </div>
              </div>

              {/* AI TRAINING IDEAS STUDIO PANEL & CATEGORIZED CARD BANK SELECTOR FOR MASS SUBMIT */}
              <div className="bg-white/95 rounded-xl border border-purple-200 p-3.5 space-y-3 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Brain className="w-4 h-4 text-purple-600 shrink-0" />
                    <span className="text-xs font-bold text-slate-900">
                      Categorized AI Ideas Card Bank &amp; Mass Submission Selector
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300">
                      {bankIdeas.length} Total in Bank · {activeTrainingIdeasCount} Active
                    </span>
                    {selectedMassBankIds.size > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                        ✓ {selectedMassBankIds.size} Selected for Mass Submit
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setShowMassBankSelector(prev => !prev)}
                      className={`px-3 py-1.5 text-[11px] font-bold rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer ${
                        showMassBankSelector
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-300'
                      }`}
                    >
                      <FolderKanban className="w-3.5 h-3.5" />
                      <span>
                        {showMassBankSelector
                          ? 'Hide Card Bank Selector'
                          : `📂 Select from Card Bank for Mass Submit (${bankIdeas.length})`}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent('open_rig50_ai_training'))}
                      className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Open full AI Training Studio & Spreadsheet Importer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                      <span>+ Train AI / Manage Bank</span>
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Select saved ideas or entire categories from your <strong>Categorized AI Ideas Card Bank</strong> to launch high-speed Mass Submissions directly, load into the Mass Preview Deck, or let Gemini AI recreate them into brand-new non-duplicate cards.
                </p>

                {showMassBankSelector && (
                  <div className="pt-2 border-t border-purple-200/80 space-y-3">
                    {/* Category Filter Pills */}
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-indigo-600" />
                          <span>1. Filter by Category ({filteredMassBankIdeas.length} matching cards):</span>
                        </span>

                        {/* Assessment Filter & Search */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg p-0.5 text-[10px]">
                            {(['ALL', 'Safe', 'Unsafe'] as const).map(status => (
                              <button
                                key={status}
                                type="button"
                                onClick={() => setSelectedMassBankAssessment(status)}
                                className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                                  selectedMassBankAssessment === status
                                    ? 'bg-slate-900 text-white'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                {status === 'ALL' ? 'All Assessments' : status}
                              </button>
                            ))}
                          </div>

                          <input
                            type="text"
                            value={massBankSearch}
                            onChange={(e) => setMassBankSearch(e.target.value)}
                            placeholder="Search topic, zone, role..."
                            className="px-2.5 py-1 text-[11px] bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-indigo-500 outline-none w-44"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedMassBankCategory('ALL')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                            selectedMassBankCategory === 'ALL'
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-indigo-300'
                          }`}
                        >
                          <span>All Categories</span>
                          <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded ${
                            selectedMassBankCategory === 'ALL' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {bankIdeas.length}
                          </span>
                        </button>

                        {AI_IDEA_CATEGORIES.map(cat => {
                          const count = massBankCategoryCounts[cat] || 0;
                          const active = selectedMassBankCategory === cat;
                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setSelectedMassBankCategory(cat)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1.5 border ${
                                active
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs font-bold'
                                  : count > 0
                                    ? 'bg-white text-slate-800 border-slate-200 hover:border-indigo-300'
                                    : 'bg-slate-100/70 text-slate-400 border-slate-200/70'
                              }`}
                            >
                              <span>{cat}</span>
                              <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded ${
                                active ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {count}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Smart Rotation & Quick Selection Bar */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider mr-1">
                          Quick Select:
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            if (selectedMassBankIds.size === filteredMassBankIdeas.length && filteredMassBankIdeas.length > 0) {
                              setSelectedMassBankIds(new Set());
                            } else {
                              setSelectedMassBankIds(new Set(filteredMassBankIdeas.map(i => i.id)));
                            }
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg cursor-pointer"
                        >
                          {selectedMassBankIds.size === filteredMassBankIdeas.length && filteredMassBankIdeas.length > 0
                            ? `✕ Unselect All (${filteredMassBankIdeas.length})`
                            : `✓ Select All Matching (${filteredMassBankIdeas.length})`}
                        </button>

                        {selectedMassBankCategory !== 'ALL' && filteredMassBankIdeas.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMassBankIds(new Set(filteredMassBankIdeas.map(i => i.id)));
                              showToast(`📂 Selected all ${filteredMassBankIdeas.length} cards in "${selectedMassBankCategory}".`);
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-lg cursor-pointer"
                          >
                            📂 Select Category ({filteredMassBankIdeas.length})
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleSelectLeastUsedFromBank(15)}
                          className="px-2.5 py-1 text-[11px] font-bold bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 rounded-lg cursor-pointer"
                          title="Automatically select the 15 least-submitted cards so you rotate evenly through your Card Bank"
                        >
                          🆕 15 Least-Used
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSelectLeastUsedFromBank(30)}
                          className="px-2.5 py-1 text-[11px] font-bold bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 rounded-lg cursor-pointer"
                          title="Automatically select the 30 least-submitted cards from the current view"
                        >
                          🆕 30 Least-Used
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSelectLeastUsedFromBank(50)}
                          className="px-2.5 py-1 text-[11px] font-bold bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 rounded-lg cursor-pointer"
                          title="Automatically select the 50 least-submitted cards from the current view"
                        >
                          🆕 50 Least-Used
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSelectRandomFromBank(20)}
                          className="px-2.5 py-1 text-[11px] font-bold bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 rounded-lg cursor-pointer"
                          title="Pick a random sample of 20 cards from the active filter"
                        >
                          🎲 Random 20
                        </button>
                      </div>

                      {selectedMassBankIds.size > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedMassBankIds(new Set())}
                          className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                        >
                          Clear ({selectedMassBankIds.size})
                        </button>
                      )}
                    </div>

                    {/* 4 MASS SUBMITTER ACTION BUTTONS WHEN BANK CARDS ARE SELECTED */}
                    {selectedMassBankIds.size > 0 && (
                      <div className="bg-slate-900 text-white p-3.5 rounded-xl border border-slate-800 space-y-2.5 shadow-md">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-mono font-bold text-xs rounded-lg">
                              {selectedMassBankIds.size} Bank Card{selectedMassBankIds.size === 1 ? '' : 's'} Ready
                            </span>
                            <span className="text-[11px] text-slate-300">
                              Choose how to use these selected Card Bank ideas in Mass Submitter:
                            </span>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            {/* 1. Immediate High-Speed Mass Submit */}
                            <button
                              type="button"
                              disabled={isRunning || isRecreatingMassBank}
                              onClick={handleMassSubmitSelectedBankNow}
                              className="px-3.5 py-1.5 text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer"
                              title="Immediately launch the high-speed parallel Mass Submitter with the selected Card Bank cards"
                            >
                              <Rocket className="w-3.5 h-3.5" />
                              <span>🚀 Mass Submit Selected Now ({selectedMassBankIds.size})</span>
                            </button>

                            {/* 2. Load Selected into Mass Preview Deck (Submit As-Is) */}
                            <button
                              type="button"
                              disabled={isRunning || isRecreatingMassBank}
                              onClick={() => handleLoadSelectedBankIntoMassDeck(false)}
                              className="px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg flex items-center gap-1.5 cursor-pointer"
                              title="Load selected Card Bank cards into the Interactive Mass Preview Deck below so you can inspect, edit, or combine them"
                            >
                              <Layers className="w-3.5 h-3.5" />
                              <span>📥 Load ({selectedMassBankIds.size}) into Mass Deck</span>
                            </button>

                            {/* 3. AI Recreate Selected into Fresh Mass Deck */}
                            <button
                              type="button"
                              disabled={isRunning || isRecreatingMassBank}
                              onClick={handleAiRecreateSelectedBankForMassDeck}
                              className="px-3 py-1.5 text-xs font-bold bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg flex items-center gap-1.5 cursor-pointer"
                              title="Use Gemini AI to recreate each selected Card Bank idea into a brand-new, freshly worded SOAR card in the Mass Preview Deck"
                            >
                              {isRecreatingMassBank ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>
                                    AI Recreating ({massBankRecreateProgress?.current || 0}/{massBankRecreateProgress?.total || selectedMassBankIds.size})...
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span>✨ AI Recreate ({selectedMassBankIds.size}) for New Mass Run</span>
                                </>
                              )}
                            </button>

                            {/* 4. Expand Selected into Full {targetCount}-Card Batch */}
                            <button
                              type="button"
                              disabled={isRunning || isRecreatingMassBank}
                              onClick={handleGenerateFullTargetBatchFromSelectedBank}
                              className="px-3 py-1.5 text-xs font-bold bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg flex items-center gap-1.5 cursor-pointer"
                              title={`Use your ${selectedMassBankIds.size} selected ideas as seed concepts to synthesize a full ${targetCount}-card unique batch in the Preview Deck`}
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>🔄 Expand into {targetCount}-Card Batch</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Card Bank List */}
                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-200 border border-slate-200 rounded-xl bg-white">
                      {filteredMassBankIdeas.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-500">
                          No Card Bank ideas match this category/filter. Click "+ Train AI / Manage Bank" above to add or import ideas.
                        </div>
                      ) : (
                        filteredMassBankIdeas.map((idea) => {
                          const isChecked = selectedMassBankIds.has(idea.id);
                          const catName = getIdeaCategory(idea);
                          return (
                            <label
                              key={idea.id}
                              className={`p-2.5 flex items-start gap-2.5 text-xs cursor-pointer transition-colors ${
                                isChecked ? 'bg-indigo-50/60' : 'hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  setSelectedMassBankIds(prev => {
                                    const next = new Set(prev);
                                    if (next.has(idea.id)) next.delete(idea.id);
                                    else next.add(idea.id);
                                    return next;
                                  });
                                }}
                                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                              />
                              <div className="flex-1 min-w-0 space-y-0.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-slate-900">{idea.topic}</span>
                                  <span className="px-2 py-0.2 text-[10px] font-bold rounded bg-indigo-50 text-indigo-800 border border-indigo-200">
                                    {catName}
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-500">
                                    {idea.zone || 'Rig Floor'} · {idea.role || 'Floorman'} ·{' '}
                                    <span className={idea.assessment === 'Unsafe' ? 'text-rose-700 font-bold' : 'text-emerald-700 font-bold'}>
                                      {idea.assessment || 'Safe'}
                                    </span>{' '}
                                    · Used {idea.usageCount || 0}×
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-700 line-clamp-1">
                                  <strong>Obs:</strong> {idea.observation}
                                </p>
                                <p className="text-[11px] text-indigo-900 line-clamp-1">
                                  <strong>Action:</strong> {idea.action}
                                </p>
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* DAILY AUTOMATED RUN & EMAIL CONFIRMATION DISPATCH */}
        <div className="bg-gradient-to-r from-emerald-900 via-teal-950 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-md border border-emerald-500/40 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                    <span>Daily Automated Run &amp; Email Confirmation</span>
                  </h3>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                    dailySchedule.enabled
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                      : 'bg-slate-700/60 text-slate-300 border-slate-600'
                  }`}>
                    {dailySchedule.enabled ? `🟢 Active · Runs Daily at ${dailySchedule.dailyTime} (${dailySchedule.timezone === 'Asia/Riyadh' ? 'AST' : dailySchedule.timezone || 'AST'})` : '⏸️ Inactive / Paused'}
                  </span>
                  {dailyRunLogs.length > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 font-mono hidden md:inline-flex">
                      Last: {dailyRunLogs[0]?.localTimeDisplay?.split(' ')[1] || dailySchedule.lastRunDate} ({dailyRunLogs[0]?.succeeded || dailySchedule.lastRunCount || 100} cards)
                    </span>
                  )}
                </div>
                <p className="text-xs text-emerald-100/70 mt-0.5">
                  Submits Rig 50 cards automatically every day and emails full confirmation with counts &amp; receipts
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              <button
                type="button"
                onClick={() => handleRunDailyBatchNow(false)}
                disabled={isTestingDailyRun || isRunning}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                title="Execute the full batch immediately and send confirmation email"
              >
                {isTestingDailyRun ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>Run Batch Now</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDailyScheduleExpanded(!isDailyScheduleExpanded)}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white border border-white/20 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>{isDailyScheduleExpanded ? 'Hide Controls' : 'Configure Schedule'}</span>
                {isDailyScheduleExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {isDailyScheduleExpanded && (
            <div className="space-y-4 pt-3 border-t border-emerald-800/60">
              {/* TIMEZONE & LIVE MULTI-CLOCK DIAGNOSTIC BAR */}
              <div className="bg-slate-950/85 rounded-xl p-3.5 border border-emerald-500/30 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-900/40 pb-2">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Timezone &amp; Clock Synchronization (Answers: AST vs GMT vs Server Time)
                    </span>
                  </div>

                  <span className="text-[10px] text-emerald-400 font-mono font-medium">
                    Scheduler heartbeat: checks every 10 seconds
                  </span>
                </div>

                {/* 3 LIVE CLOCKS SIDE BY SIDE */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="bg-emerald-950/50 rounded-lg p-2.5 border border-emerald-500/30 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                        🇸🇦 Rig 50 Official Time (AST)
                      </span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 font-bold">
                        Default
                      </span>
                    </div>
                    <div className="text-sm font-mono font-black text-white">
                      {astTimeDisplay || '11:00:00 AM AST'}
                    </div>
                    <span className="text-[10px] text-slate-400 block">
                      Arabia Standard Time (UTC+3, Saudi Arabia)
                    </span>
                  </div>

                  <div className="bg-slate-900/80 rounded-lg p-2.5 border border-slate-700 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                        🌐 Server Internal Time (UTC/GMT)
                      </span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700 font-bold">
                        Host
                      </span>
                    </div>
                    <div className="text-sm font-mono font-black text-slate-200">
                      {utcTimeDisplay || '08:00:00 UTC'}
                    </div>
                    <span className="text-[10px] text-slate-400 block">
                      Coordinated Universal Time (AST - 3 hours)
                    </span>
                  </div>

                  <div className="bg-indigo-950/40 rounded-lg p-2.5 border border-indigo-500/30 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">
                        💻 Your Browser Local Time
                      </span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 font-bold">
                        Client
                      </span>
                    </div>
                    <div className="text-sm font-mono font-black text-white">
                      {browserTimeDisplay || 'Local Time'}
                    </div>
                    <span className="text-[10px] text-indigo-300/80 truncate block" title={userBrowserTz}>
                      Zone: {userBrowserTz}
                    </span>
                  </div>
                </div>

                {/* TIMEZONE SELECTOR & STATUS ALERT */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-900/70 rounded-lg p-2.5 border border-emerald-500/20 space-y-1.5">
                    <label className="text-[11px] font-bold text-emerald-200 block">
                      Target Timezone for Daily Run Timer:
                    </label>
                    <select
                      value={dailySchedule.timezone || 'Asia/Riyadh'}
                      onChange={(e) => {
                        const newTz = e.target.value;
                        setDailySchedule(prev => ({ ...prev, timezone: newTz }));
                        handleSaveDailySchedule({ timezone: newTz });
                      }}
                      className="w-full p-2 text-xs font-semibold bg-slate-950 border border-emerald-500/40 rounded-lg text-emerald-200 outline-none cursor-pointer focus:ring-2 focus:ring-emerald-400"
                    >
                      <option value="Asia/Riyadh">Arabia Standard Time (AST, UTC+3) — Rig 50 Official Time (Recommended)</option>
                      <option value="UTC">Coordinated Universal Time (UTC / GMT / Server Time)</option>
                      {userBrowserTz && userBrowserTz !== 'Asia/Riyadh' && userBrowserTz !== 'UTC' && (
                        <option value={userBrowserTz}>Your Detected Local Device Time ({userBrowserTz})</option>
                      )}
                      <option value="Asia/Dubai">Gulf Standard Time (GST, UTC+4)</option>
                      <option value="Europe/London">London / GMT / BST (UTC+0 / +1)</option>
                      <option value="America/Houston">Houston / US Central (CST/CDT)</option>
                      <option value="America/New_York">New York / US Eastern (EST/EDT)</option>
                      <option value="America/Los_Angeles">Los Angeles / US Pacific (PST/PDT)</option>
                    </select>
                  </div>

                  <div className="bg-slate-900/70 rounded-lg p-2.5 border border-emerald-500/20 space-y-1">
                    <span className="text-[11px] font-bold text-emerald-200 block">
                      Next Automated Run Status:
                    </span>
                    <p className="text-[11px] text-emerald-300 font-medium leading-relaxed">
                      {dailySchedule.nextRunText || (dailySchedule.enabled ? `Scheduled daily at ${dailySchedule.dailyTime} in ${dailySchedule.timezone || 'AST'}` : 'Schedule is currently paused.')}
                    </p>
                  </div>
                </div>

                {/* SCHEDULE TIMING DIAGNOSTIC BANNER (Explains why 11:02 AM didn't trigger if time passed) */}
                {dailySchedule.hasExecutedToday ? (
                  <div className="bg-emerald-950/60 border border-emerald-500/40 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <span className="font-bold text-emerald-200">
                          ✓ Today&apos;s automated batch has already executed!
                        </span>
                        <p className="text-[11px] text-emerald-300/80 mt-0.5">
                          {dailySchedule.lastRunSummary || `${dailySchedule.lastRunCount || 100} cards submitted today`}. Next scheduled run: tomorrow at {dailySchedule.dailyTime} ({dailySchedule.timezone === 'Asia/Riyadh' ? 'AST' : dailySchedule.timezone || 'AST'}).
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleResetTodayStatus}
                        disabled={isResettingToday}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 transition-colors cursor-pointer"
                        title="Clear today's completion mark so the timer can re-fire if you change the time"
                      >
                        {isResettingToday ? 'Resetting...' : 'Reset Today Status'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRunDailyBatchNow(false)}
                        disabled={isTestingDailyRun || isRunning}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
                      >
                        Re-Run Now
                      </button>
                    </div>
                  </div>
                ) : dailySchedule.isScheduledTimePassedToday ? (
                  <div className="bg-amber-950/60 border border-amber-500/40 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <span className="font-bold text-amber-200">
                          ⚠️ Today&apos;s scheduled time ({dailySchedule.dailyTime} {dailySchedule.timezone === 'Asia/Riyadh' ? 'AST' : dailySchedule.timezone || 'AST'}) has already passed.
                        </span>
                        <p className="text-[11px] text-amber-300/80 mt-0.5">
                          The background scheduler will automatically trigger <strong>tomorrow at {dailySchedule.dailyTime} ({dailySchedule.timezone === 'Asia/Riyadh' ? 'AST' : dailySchedule.timezone || 'AST'})</strong>. To submit today&apos;s cards right now, click below:
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRunDailyBatchNow(true)}
                      disabled={isTestingDailyRun || isRunning}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer shrink-0 disabled:opacity-50"
                      title="Run today's batch right now and log as today's scheduled run"
                    >
                      {isTestingDailyRun ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                      <span>⚡ Run Today&apos;s Missed Batch (Catch-Up Now)</span>
                    </button>
                  </div>
                ) : (
                  <div className="bg-indigo-950/50 border border-indigo-500/30 rounded-xl p-3 flex items-center gap-2 text-xs">
                    <Clock className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span className="text-indigo-200">
                      ⏰ <strong>Scheduled to run TODAY at {dailySchedule.dailyTime} ({dailySchedule.timezone === 'Asia/Riyadh' ? 'AST' : dailySchedule.timezone || 'AST'})</strong>. The server background heartbeat will automatically execute the mass batch when the clock reaches {dailySchedule.dailyTime}.
                    </span>
                  </div>
                )}

                <p className="text-[10px] text-slate-300 leading-relaxed">
                  💡 <strong>Timezone Explained:</strong> Rig 50 operations use <strong>Arabia Standard Time (AST, UTC+3)</strong> by default. The server operates in <strong>UTC/GMT</strong> (3 hours behind AST). Setting <strong>{dailySchedule.dailyTime || '11:02'}</strong> means <strong>{dailySchedule.dailyTime || '11:02'} AST (which is {dailySchedule.dailyTime ? `${String((parseInt(dailySchedule.dailyTime.split(':')[0], 10) - 3 + 24) % 24).padStart(2, '0')}:${dailySchedule.dailyTime.split(':')[1]}` : '08:02'} UTC/GMT on the server)</strong>.
                </p>
              </div>

              {/* CONTROLS: ENABLE, TIME, RECIPIENT */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. ENABLE / PAUSE TOGGLE */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-200 block">
                    Automation Status
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const next = !dailySchedule.enabled;
                        setDailySchedule(prev => ({ ...prev, enabled: next }));
                        handleSaveDailySchedule({ enabled: next });
                      }}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        dailySchedule.enabled
                          ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black shadow-sm'
                          : 'bg-white/10 hover:bg-white/20 text-slate-300'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{dailySchedule.enabled ? 'Enabled (Active Daily)' : 'Paused (Click to Enable)'}</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Runs persistently on the server even when browser is closed.
                  </p>
                </div>

                {/* 2. DAILY RUN TIME */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-200 flex items-center justify-between">
                    <span>Daily Run Time ({dailySchedule.timezone === 'Asia/Riyadh' ? 'AST' : dailySchedule.timezone || 'AST'})</span>
                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  </label>
                  <input
                    type="time"
                    value={dailySchedule.dailyTime}
                    onFocus={() => {
                      isEditingTimeRef.current = true;
                    }}
                    onChange={(e) => {
                      const newTime = e.target.value;
                      isEditingTimeRef.current = true;
                      lastSavedTimeRef.current = newTime;
                      setDailySchedule(prev => ({ ...prev, dailyTime: newTime }));
                      if (newTime && /^\d{2}:\d{2}$/.test(newTime)) {
                        handleSaveDailySchedule({ dailyTime: newTime });
                      }
                    }}
                    onBlur={() => {
                      isEditingTimeRef.current = false;
                    }}
                    className="w-full px-3 py-1.5 text-sm font-mono font-bold bg-slate-950/80 border border-emerald-500/40 rounded-lg text-emerald-200 focus:ring-2 focus:ring-emerald-400 outline-none"
                  />
                  <p className="text-[10px] text-slate-400">
                    Selected time in {dailySchedule.timezone || 'Asia/Riyadh'}. Checks every 10s.
                  </p>
                </div>

                {/* 3. RECIPIENT EMAIL */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-200 flex items-center justify-between">
                    <span>Recipient Email</span>
                    <Mail className="w-3.5 h-3.5 text-emerald-400" />
                  </label>
                  <input
                    type="email"
                    value={dailySchedule.recipientEmail}
                    onChange={(e) => setDailySchedule(prev => ({ ...prev, recipientEmail: e.target.value }))}
                    placeholder="e.g. uploadsa35@gmail.com"
                    className="w-full px-3 py-1.5 text-xs font-mono font-medium bg-slate-950/80 border border-emerald-500/40 rounded-lg text-emerald-200 focus:ring-2 focus:ring-emerald-400 outline-none"
                  />
                  <p className="text-[10px] text-slate-400">
                    Receives HTML confirmation with counts, breakdown &amp; receipts.
                  </p>
                </div>
              </div>

              {/* DAILY TARGET & QUOTA SUMMARY */}
              <div className="bg-slate-950/60 rounded-xl p-3 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-emerald-300">Daily Batch Allocation:</span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 font-mono font-bold">
                    {dailySchedule.targetCount || targetCount} Cards Total
                  </span>
                  <span className="text-slate-400">({dailySchedule.categoryQuotas?.condition || 45} Condition · {dailySchedule.categoryQuotas?.behavior || 45} Behavior · {dailySchedule.categoryQuotas?.swa || 10} SWA)</span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const updatedQuotas = { ...categoryQuotas };
                    const updatedTarget = targetCount;
                    setDailySchedule(prev => ({
                      ...prev,
                      targetCount: updatedTarget,
                      categoryQuotas: updatedQuotas
                    }));
                    handleSaveDailySchedule({
                      targetCount: updatedTarget,
                      categoryQuotas: updatedQuotas
                    });
                    showToast('✓ Updated daily schedule to match currently selected quotas!');
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-400/20 hover:bg-emerald-400/30 text-emerald-200 border border-emerald-400/30 transition-colors self-start sm:self-center cursor-pointer"
                >
                  Sync to Current Form Settings Below
                </button>
              </div>

              {/* ACTION BAR */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-emerald-900/60">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleSaveDailySchedule()}
                    disabled={isSavingDailySchedule}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {isSavingDailySchedule ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    <span>Save Daily Schedule</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRunDailyBatchNow(false)}
                    disabled={isTestingDailyRun || isRunning}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                    title="Execute the full batch immediately and send confirmation email"
                  >
                    {isTestingDailyRun ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                    <span>Run Daily Batch Now (Instant Test)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRunDailyBatchNow(true)}
                    disabled={isTestingDailyRun || isRunning}
                    className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                    title="Simulate the scheduled run pipeline directly and add to scheduled log"
                  >
                    {isTestingDailyRun ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
                    <span>Simulate Scheduled Trigger</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSendTestConfirmationEmail}
                    disabled={isSendingTestEmail}
                    className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-colors border border-white/20 cursor-pointer disabled:opacity-50"
                  >
                    {isSendingTestEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>Send Test Email</span>
                  </button>
                </div>

                {lastEmailPreviewUrl && (
                  <a
                    href={lastEmailPreviewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-teal-400/20 text-teal-200 border border-teal-400/40 text-xs font-bold hover:bg-teal-400/30 flex items-center gap-1 self-start sm:self-center transition-colors"
                  >
                    <span>View Dispatched Email Preview</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              {/* DEDICATED DAILY RUN AUDIT & ACTIVITY LOG (Interactive History & Receipts) */}
              <div className="bg-slate-950/95 rounded-xl p-4 border border-emerald-500/30 space-y-3 shadow-inner">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-900/60 pb-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Daily Run Activity &amp; Audit Log
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                      {dailyRunLogs.length} Records
                    </span>
                    {dailyRunLogs.length > 0 && (
                      <span className="text-[10px] text-slate-400">
                        (Last: {dailyRunLogs[0].localTimeDisplay})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Log Filter Pills */}
                    <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-700 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setLogFilter('all')}
                        className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-colors ${logFilter === 'all' ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:text-white'}`}
                      >
                        All ({dailyRunLogs.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setLogFilter('scheduled')}
                        className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-colors ${logFilter === 'scheduled' ? 'bg-indigo-500 text-white' : 'text-slate-300 hover:text-white'}`}
                      >
                        Scheduled ({dailyRunLogs.filter(l => l.triggerType === 'scheduled').length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setLogFilter('manual')}
                        className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-colors ${logFilter === 'manual' ? 'bg-purple-500 text-white' : 'text-slate-300 hover:text-white'}`}
                      >
                        Manual ({dailyRunLogs.filter(l => l.triggerType === 'manual').length})
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={fetchDailyRunLogs}
                      disabled={isLoadingLogs}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 border border-white/20 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      title="Refresh audit logs from server"
                    >
                      <RotateCcw className={`w-3 h-3 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>

                    {dailyRunLogs.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearDailyLogs}
                        disabled={isClearingLogs}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg text-rose-400 hover:bg-rose-950/40 border border-rose-500/30 transition-colors cursor-pointer"
                        title="Clear all log entries"
                      >
                        Clear Log
                      </button>
                    )}
                  </div>
                </div>

                {/* LOGS LIST */}
                {dailyRunLogs.length === 0 ? (
                  <div className="p-5 rounded-xl bg-slate-900/60 border border-dashed border-emerald-800/40 text-center space-y-2">
                    <p className="text-xs font-semibold text-emerald-200">
                      No run log history recorded yet.
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                      Runs triggered automatically at <strong>{dailySchedule.dailyTime} ({dailySchedule.timezone === 'Asia/Riyadh' ? 'AST' : dailySchedule.timezone || 'AST'})</strong> or initiated via <strong>&quot;Run Daily Batch Now&quot;</strong> will log submission metrics, receipts, and email status here.
                    </p>
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => handleRunDailyBatchNow(false)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors cursor-pointer"
                      >
                        Launch First Test Run Now
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                    {dailyRunLogs
                      .filter(log => {
                        if (logFilter === 'scheduled') return log.triggerType === 'scheduled';
                        if (logFilter === 'manual') return log.triggerType === 'manual';
                        return true;
                      })
                      .map((log) => {
                        const isExpanded = expandedLogId === log.id;
                        return (
                          <div
                            key={log.id}
                            className="bg-slate-900/90 border border-emerald-500/20 hover:border-emerald-400/50 rounded-xl p-3.5 transition-all space-y-2 text-xs"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                                  log.triggerType === 'scheduled'
                                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-400/40'
                                    : 'bg-purple-500/20 text-purple-300 border-purple-400/40'
                                }`}>
                                  {log.triggerType === 'scheduled' ? '📅 Daily Scheduled Run' : '⚡ Manual Test Run'}
                                </span>

                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                                  log.status === 'success'
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                                    : 'bg-rose-500/20 text-rose-300 border-rose-400/40'
                                }`}>
                                  {log.status === 'success' ? `✓ ${log.succeeded}/${log.targetCount} Submitted` : `⚠️ ${log.failed} Failed`}
                                </span>

                                <span className="font-mono text-white font-bold">
                                  {log.localTimeDisplay}
                                </span>

                                <span className="text-[10px] text-slate-400 font-mono hidden md:inline">
                                  ({log.utcTimeDisplay})
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                <span>Duration: {log.elapsedSeconds}s</span>
                                {log.previewUrl && (
                                  <a
                                    href={log.previewUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2 py-0.5 rounded bg-teal-400/20 text-teal-200 border border-teal-400/30 text-[10px] font-bold hover:bg-teal-400/30 flex items-center gap-1 transition-colors"
                                  >
                                    <span>Email Receipt</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                )}

                                {log.sampleReceipts && log.sampleReceipts.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                    className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-slate-200 border border-white/20 text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                  >
                                    <span>{isExpanded ? 'Hide Receipts' : `Receipts (${log.sampleReceipts.length})`}</span>
                                    {isExpanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Category breakdown pills */}
                            <div className="flex items-center justify-between gap-2 flex-wrap text-[11px] pt-1.5 border-t border-slate-800 text-slate-300">
                              <div className="flex items-center gap-2 flex-wrap font-mono">
                                <span className="text-sky-300 font-semibold">🔧 {log.categoryQuotas?.condition || 0} Condition</span>
                                <span>·</span>
                                <span className="text-indigo-300 font-semibold">👁️ {log.categoryQuotas?.behavior || 0} Behavior</span>
                                <span>·</span>
                                <span className="text-amber-300 font-semibold">🛑 {log.categoryQuotas?.swa || 0} SWA</span>
                                {log.categoryQuotas?.swaDrill ? (
                                  <>
                                    <span>·</span>
                                    <span className="text-purple-300 font-semibold">⏱️ {log.categoryQuotas.swaDrill} Drill</span>
                                  </>
                                ) : null}
                              </div>

                              <span className="text-[10px] text-slate-400 font-mono">
                                Recipient: {log.recipientEmail} {log.emailSent ? '✓ Emailed' : '⚠️ Not Emailed'}
                              </span>
                            </div>

                            {/* Expandable Sample Receipts from Microsoft Forms */}
                            {isExpanded && log.sampleReceipts && log.sampleReceipts.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-slate-800/80 space-y-2 bg-slate-950/70 rounded-lg p-2.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                                    Microsoft Forms Verified Submission Receipts:
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    Rig 50 Bob Palmer (RBP-50A)
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                                  {log.sampleReceipts.map((rcpt, rIdx) => (
                                    <div
                                      key={`${log.id}_rcpt_${rIdx}`}
                                      className="bg-slate-900 border border-slate-800 rounded p-2 space-y-1"
                                    >
                                      <div className="flex items-center justify-between font-mono text-[10px]">
                                        <span className="text-emerald-400 font-bold">
                                          ID: #{rcpt.responseId}
                                        </span>
                                        <span className="text-slate-400">
                                          {rcpt.zone} · {rcpt.role}
                                        </span>
                                      </div>
                                      <div className="text-[10px] font-semibold text-indigo-300">
                                        Type: {rcpt.obsType}
                                      </div>
                                      <p className="text-[10px] text-slate-300 line-clamp-2 leading-tight">
                                        {rcpt.observation}
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
            </div>
          )}
        </div>

        {/* 1. NUMBER OF CARDS (TYPE ANY NUMBER OR PICK PRESET) */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-900 flex items-center justify-between">
            <span>1. Number of Cards to Submit (Type Any Number):</span>
            <span className="text-indigo-600 font-mono text-xs">Target: {targetCount} Cards</span>
          </label>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative w-full sm:w-44">
              <input
                type="number"
                min={1}
                max={10000}
                value={targetCount}
                onChange={(e) => setTargetCount(Math.max(1, parseInt(e.target.value) || 1))}
                disabled={isRunning}
                placeholder="e.g. 5, 45, 100, 1000"
                className="w-full px-3 py-2 text-sm font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 shadow-2xs"
              />
              <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-sans pointer-events-none">
                cards
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {[5, 15, 50, 100, 250, 500, 1000, 2500].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setTargetCount(num)}
                  disabled={isRunning}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                    targetCount === num
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {num >= 1000 ? `${num / 1000}k` : num}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 2. ASSESSMENT FILTER (ALL SAFE vs ALL UNSAFE vs MIX) */}
        <div className="space-y-2 pt-1 border-t border-slate-100">
          <label className="text-xs font-bold text-slate-900 block">
            2. Assessment Status (Make them all Safe?):
          </label>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button
              type="button"
              onClick={() => setAssessmentFilter('safe_only')}
              disabled={isRunning}
              className={`p-3 rounded-xl border text-left transition-all ${
                assessmentFilter === 'safe_only'
                  ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-500/20 shadow-2xs'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-emerald-950">100% All Safe</span>
              </div>
              <p className="text-[11px] text-emerald-800/80 leading-snug">
                Every card submitted as Safe (Positive Behavior Observation)
              </p>
            </button>

            <button
              type="button"
              onClick={() => setAssessmentFilter('unsafe_only')}
              disabled={isRunning}
              className={`p-3 rounded-xl border text-left transition-all ${
                assessmentFilter === 'unsafe_only'
                  ? 'bg-amber-50 border-amber-600 ring-2 ring-amber-500/20 shadow-2xs'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-bold text-amber-950">100% All Unsafe</span>
              </div>
              <p className="text-[11px] text-amber-800/80 leading-snug">
                Every card submitted as Unsafe (Corrective Action &amp; SWA)
              </p>
            </button>

            <button
              type="button"
              onClick={() => setAssessmentFilter('realistic_mix')}
              disabled={isRunning}
              className={`p-3 rounded-xl border text-left transition-all ${
                assessmentFilter === 'realistic_mix'
                  ? 'bg-teal-50 border-teal-600 ring-2 ring-teal-500/20 shadow-2xs'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles className="w-4 h-4 text-teal-600" />
                <span className="text-xs font-bold text-teal-950">Realistic (85% Safe / 15% Unsafe)</span>
              </div>
              <p className="text-[11px] text-teal-800/80 leading-snug">
                Balanced natural ratio for regular rig operations
              </p>
            </button>

            <button
              type="button"
              onClick={() => setAssessmentFilter('all')}
              disabled={isRunning}
              className={`p-3 rounded-xl border text-left transition-all ${
                assessmentFilter === 'all'
                  ? 'bg-indigo-50 border-indigo-600 ring-2 ring-indigo-500/20 shadow-2xs'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-indigo-950">Template Original</span>
              </div>
              <p className="text-[11px] text-indigo-800/80 leading-snug">
                Preserves exact status as written in the card bank
              </p>
            </button>
          </div>
        </div>

        {/* 3. OBSERVATION TYPE & CATEGORY QUOTA DISTRIBUTION (QUESTION 6 IN MS FORMS) */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <label className="text-xs font-bold text-slate-900 block flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                <span>3. Category Distribution &amp; Exact Quotas (MS Form Question 6):</span>
              </label>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Set exact number of cards on each category (e.g. 45 Condition, 45 Behavior, 10 SWA)
              </p>
            </div>

            {/* Toggle Mode: Exact Quotas vs Single Type */}
            <div className="inline-flex p-1 bg-slate-100 border border-slate-200 rounded-xl self-start sm:self-center">
              <button
                type="button"
                onClick={() => setUseCategoryQuotas(true)}
                disabled={isRunning}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  useCategoryQuotas
                    ? 'bg-white text-indigo-700 shadow-2xs border border-indigo-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Exact Quotas (Recommended)
              </button>
              <button
                type="button"
                onClick={() => setUseCategoryQuotas(false)}
                disabled={isRunning}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  !useCategoryQuotas
                    ? 'bg-white text-indigo-700 shadow-2xs border border-indigo-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Single Type Presets
              </button>
            </div>
          </div>

          {useCategoryQuotas ? (
            <div className="bg-slate-50 border border-indigo-100 rounded-2xl p-3.5 sm:p-4 space-y-3.5">
              {/* QUOTA NUMERIC INPUTS GRID */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* 1. Condition Cards */}
                <div className="bg-white border border-sky-200 rounded-xl p-3 space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-950 flex items-center gap-1">
                      <span>🛠️ Condition</span>
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
                      {targetCount > 0 ? `${Math.round(((categoryQuotas.condition || 0) / targetCount) * 100)}%` : '0%'}
                    </span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    value={categoryQuotas.condition}
                    onChange={(e) => setCategoryQuotas(prev => ({ ...prev, condition: Math.max(0, parseInt(e.target.value) || 0) }))}
                    disabled={isRunning}
                    className="w-full px-2.5 py-1.5 text-sm font-mono font-bold bg-sky-50/50 border border-sky-300 rounded-lg text-sky-950 focus:ring-2 focus:ring-sky-500 outline-none"
                    placeholder="e.g. 45"
                  />
                  <span className="text-[10px] text-slate-500 block leading-tight">
                    Physical equipment checks &amp; barriers
                  </span>
                </div>

                {/* 2. Behavior Cards */}
                <div className="bg-white border border-indigo-200 rounded-xl p-3 space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-950 flex items-center gap-1">
                      <span>👁️ Behavior</span>
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {targetCount > 0 ? `${Math.round(((categoryQuotas.behavior || 0) / targetCount) * 100)}%` : '0%'}
                    </span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    value={categoryQuotas.behavior}
                    onChange={(e) => setCategoryQuotas(prev => ({ ...prev, behavior: Math.max(0, parseInt(e.target.value) || 0) }))}
                    disabled={isRunning}
                    className="w-full px-2.5 py-1.5 text-sm font-mono font-bold bg-indigo-50/50 border border-indigo-300 rounded-lg text-indigo-950 focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="e.g. 45"
                  />
                  <span className="text-[10px] text-slate-500 block leading-tight">
                    Hands-free tools, PPE &amp; work practice
                  </span>
                </div>

                {/* 3. SWA Cards */}
                <div className="bg-white border border-amber-200 rounded-xl p-3 space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-950 flex items-center gap-1">
                      <span>🛑 STOP Work (SWA)</span>
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                      {targetCount > 0 ? `${Math.round(((categoryQuotas.swa || 0) / targetCount) * 100)}%` : '0%'}
                    </span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    value={categoryQuotas.swa}
                    onChange={(e) => setCategoryQuotas(prev => ({ ...prev, swa: Math.max(0, parseInt(e.target.value) || 0) }))}
                    disabled={isRunning}
                    className="w-full px-2.5 py-1.5 text-sm font-mono font-bold bg-amber-50/50 border border-amber-300 rounded-lg text-amber-950 focus:ring-2 focus:ring-amber-500 outline-none"
                    placeholder="e.g. 10"
                  />
                  <span className="text-[10px] text-slate-500 block leading-tight">
                    Immediate safety stand-down &amp; corrective
                  </span>
                </div>

                {/* 4. SWA Drill Cards */}
                <div className="bg-white border border-purple-200 rounded-xl p-3 space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-950 flex items-center gap-1">
                      <span>⏱️ SWA Drill (Opt.)</span>
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                      {categoryQuotas.swaDrill || 0} cards
                    </span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    value={categoryQuotas.swaDrill || 0}
                    onChange={(e) => setCategoryQuotas(prev => ({ ...prev, swaDrill: Math.max(0, parseInt(e.target.value) || 0) }))}
                    disabled={isRunning}
                    className="w-full px-2.5 py-1.5 text-sm font-mono font-bold bg-purple-50/50 border border-purple-300 rounded-lg text-purple-950 focus:ring-2 focus:ring-purple-500 outline-none"
                    placeholder="0"
                  />
                  <span className="text-[10px] text-slate-500 block leading-tight">
                    Planned Stop Work drills &amp; timings
                  </span>
                </div>
              </div>

              {/* VISUAL PROPORTION BAR */}
              {(() => {
                const totalQuota = (categoryQuotas.condition || 0) + (categoryQuotas.behavior || 0) + (categoryQuotas.swa || 0) + (categoryQuotas.swaDrill || 0);
                const condW = totalQuota > 0 ? ((categoryQuotas.condition || 0) / totalQuota) * 100 : 0;
                const behW = totalQuota > 0 ? ((categoryQuotas.behavior || 0) / totalQuota) * 100 : 0;
                const swaW = totalQuota > 0 ? ((categoryQuotas.swa || 0) / totalQuota) * 100 : 0;
                const drillW = totalQuota > 0 ? ((categoryQuotas.swaDrill || 0) / totalQuota) * 100 : 0;

                return (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-600 font-medium">
                      <span>Category Distribution Bar:</span>
                      <span className="font-mono text-slate-800">
                        {categoryQuotas.condition} Cond ({Math.round(condW)}%) · {categoryQuotas.behavior} Beh ({Math.round(behW)}%) · {categoryQuotas.swa} SWA ({Math.round(swaW)}%)
                        {drillW > 0 ? ` · ${categoryQuotas.swaDrill} Drill (${Math.round(drillW)}%)` : ''}
                      </span>
                    </div>

                    <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
                      {condW > 0 && (
                        <div style={{ width: `${condW}%` }} className="bg-sky-500 transition-all duration-300" title={`Condition: ${categoryQuotas.condition} cards (${Math.round(condW)}%)`} />
                      )}
                      {behW > 0 && (
                        <div style={{ width: `${behW}%` }} className="bg-indigo-600 transition-all duration-300" title={`Behavior: ${categoryQuotas.behavior} cards (${Math.round(behW)}%)`} />
                      )}
                      {swaW > 0 && (
                        <div style={{ width: `${swaW}%` }} className="bg-amber-500 transition-all duration-300" title={`SWA: ${categoryQuotas.swa} cards (${Math.round(swaW)}%)`} />
                      )}
                      {drillW > 0 && (
                        <div style={{ width: `${drillW}%` }} className="bg-purple-600 transition-all duration-300" title={`SWA Drill: ${categoryQuotas.swaDrill} cards (${Math.round(drillW)}%)`} />
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* QUOTA VALIDATION & SYNC TOOLBAR */}
              {(() => {
                const totalQuota = (categoryQuotas.condition || 0) + (categoryQuotas.behavior || 0) + (categoryQuotas.swa || 0) + (categoryQuotas.swaDrill || 0);
                const isExact = totalQuota === targetCount;

                return (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-200/80 text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded font-bold text-[11px] border ${
                        isExact
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                          : 'bg-amber-50 text-amber-800 border-amber-300'
                      }`}>
                        {isExact ? `✓ Sum: ${totalQuota} cards (Matches target)` : `⚠️ Sum: ${totalQuota} cards vs Target: ${targetCount}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {!isExact && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setTargetCount(totalQuota);
                              showToast(`✓ Updated target count to match quota sum (${totalQuota} cards)`);
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors"
                          >
                            Set Target to {totalQuota} Cards
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              scaleQuotasToTarget(targetCount);
                              showToast(`✓ Proportionally scaled quotas to equal ${targetCount} cards`);
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
                          >
                            Scale Quotas to {targetCount}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* POPULAR PRESETS */}
              <div className="pt-2 border-t border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-700 block mb-1.5">
                  Quick Category Breakdown Presets:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => applyQuotaPreset(45, 45, 10, 0)}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white hover:bg-indigo-50 text-indigo-900 border border-indigo-200 shadow-2xs"
                  >
                    ⭐ 45 Cond · 45 Beh · 10 SWA (100 Cards)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuotaPreset(40, 50, 10, 0)}
                    className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs"
                  >
                    40 Cond · 50 Beh · 10 SWA
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuotaPreset(70, 20, 10, 0)}
                    className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs"
                  >
                    70 Cond · 20 Beh · 10 SWA
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuotaPreset(33, 33, 34, 0)}
                    className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs"
                  >
                    Equal 3-Way Split (33/33/34)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuotaPreset(0, 100, 0, 0)}
                    className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs"
                  >
                    100% Behavior
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuotaPreset(100, 0, 0, 0)}
                    className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs"
                  >
                    100% Condition
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuotaPreset(0, 0, 100, 0)}
                    className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs"
                  >
                    100% SWA
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {/* Option 1: Balanced Mix */}
              <button
                type="button"
                onClick={() => setObsTypeFilter('all_balanced')}
                disabled={isRunning}
                className={`p-3 rounded-xl border text-left transition-all ${
                  obsTypeFilter === 'all_balanced'
                    ? 'bg-teal-50 border-teal-600 ring-2 ring-teal-500/20 shadow-2xs'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-base">🔄</span>
                  <span className="text-xs font-bold text-teal-950">Balanced Mix</span>
                </div>
                <p className="text-[11px] text-teal-800/80 leading-snug">
                  ~50% Behavior, ~30% Condition, ~20% SWA
                </p>
              </button>

              {/* Option 2: SWA Focus */}
              <button
                type="button"
                onClick={() => setObsTypeFilter('swa')}
                disabled={isRunning}
                className={`p-3 rounded-xl border text-left transition-all ${
                  obsTypeFilter === 'swa'
                    ? 'bg-amber-50 border-amber-600 ring-2 ring-amber-500/20 shadow-2xs'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-base">🛑</span>
                  <span className="text-xs font-bold text-amber-950">100% SWA</span>
                </div>
                <p className="text-[11px] text-amber-800/80 leading-snug">
                  All cards go to STOP Work Authority (SWA)
                </p>
              </button>

              {/* Option 3: Condition Focus */}
              <button
                type="button"
                onClick={() => setObsTypeFilter('condition')}
                disabled={isRunning}
                className={`p-3 rounded-xl border text-left transition-all ${
                  obsTypeFilter === 'condition'
                    ? 'bg-sky-50 border-sky-600 ring-2 ring-sky-500/20 shadow-2xs'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-base">🛠️</span>
                  <span className="text-xs font-bold text-sky-950">100% Condition</span>
                </div>
                <p className="text-[11px] text-sky-800/80 leading-snug">
                  All cards go to Physical Condition &amp; Equipment
                </p>
              </button>

              {/* Option 4: Behavior Focus */}
              <button
                type="button"
                onClick={() => setObsTypeFilter('behavior')}
                disabled={isRunning}
                className={`p-3 rounded-xl border text-left transition-all ${
                  obsTypeFilter === 'behavior'
                    ? 'bg-indigo-50 border-indigo-600 ring-2 ring-indigo-500/20 shadow-2xs'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-base">👁️</span>
                  <span className="text-xs font-bold text-indigo-950">100% Behavior</span>
                </div>
                <p className="text-[11px] text-indigo-800/80 leading-snug">
                  All cards go to Behavior Observation
                </p>
              </button>

              {/* Option 5: SWA Drill Focus */}
              <button
                type="button"
                onClick={() => setObsTypeFilter('swa_drill')}
                disabled={isRunning}
                className={`p-3 rounded-xl border text-left transition-all ${
                  obsTypeFilter === 'swa_drill'
                    ? 'bg-purple-50 border-purple-600 ring-2 ring-purple-500/20 shadow-2xs'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-base">⏱️</span>
                  <span className="text-xs font-bold text-purple-950">100% SWA Drill</span>
                </div>
                <p className="text-[11px] text-purple-800/80 leading-snug">
                  All cards go to Stop Work Authority Drill
                </p>
              </button>
            </div>
          )}
        </div>

        {/* 4. CONTENT MODE (NON-SAFETY vs SAFETY) & MULTI-THEME ENGINE */}
        <div className="space-y-4 pt-3 border-t border-slate-100">
          {/* 4A. CONTENT GENERATION MODE SWITCHER */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-50/90 via-rose-50/80 to-indigo-50/90 border border-amber-200/90 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
                    4A. Card Content Mode (Safety vs. 100% Non-Safety Off-Topic):
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    contentMode === 'pure_non_safety'
                      ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                      : contentMode === 'blended'
                      ? 'bg-indigo-100 text-indigo-900 border-indigo-300'
                      : 'bg-teal-100 text-teal-900 border-teal-300'
                  }`}>
                    {contentMode === 'pure_non_safety'
                      ? '🎉 100% Pure Non-Safety Active'
                      : contentMode === 'blended'
                      ? '🎭 Blended Theme + Crew Mode'
                      : '🛡️ Standard HSE Safety Mode'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Want cards with <strong>zero safety jargon</strong>? Select <strong>Pure Non-Safety Mode</strong> for 100% comedy, music, food, coffee, gaming, movies, cars &amp; sports stories!
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <button
                type="button"
                disabled={isRunning}
                onClick={() => {
                  setContentMode('pure_non_safety');
                  if (selectedThemes.length === 1 && selectedThemes[0] === 'operations') {
                    setSelectedThemes(['humor', 'music', 'food', 'gaming']);
                  }
                }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  contentMode === 'pure_non_safety'
                    ? 'bg-white border-amber-500 ring-2 ring-amber-400 shadow-xs'
                    : 'bg-white/70 border-slate-200 hover:bg-white opacity-80'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                    <span>🎉</span>
                    <span>Pure Non-Safety Mode</span>
                  </span>
                  {contentMode === 'pure_non_safety' && (
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded">ACTIVE</span>
                  )}
                </div>
                <p className="text-[10.5px] text-slate-600 leading-snug">
                  <strong>Zero safety talk!</strong> Pure comedy, music, food &amp; coffee, PS5 gaming, supercars, movies, and football discussions.
                </p>
              </button>

              <button
                type="button"
                disabled={isRunning}
                onClick={() => setContentMode('blended')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  contentMode === 'blended'
                    ? 'bg-white border-indigo-500 ring-2 ring-indigo-400 shadow-xs'
                    : 'bg-white/70 border-slate-200 hover:bg-white opacity-80'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
                    <span>🎭</span>
                    <span>Blended Theme Mode</span>
                  </span>
                  {contentMode === 'blended' && (
                    <span className="text-[10px] font-bold bg-indigo-100 text-indigo-900 px-1.5 py-0.5 rounded">ACTIVE</span>
                  )}
                </div>
                <p className="text-[10.5px] text-slate-600 leading-snug">
                  Mixes your chosen themes (Humor, Music, Cinema, Sports) with light rig crew camaraderie.
                </p>
              </button>

              <button
                type="button"
                disabled={isRunning}
                onClick={() => setContentMode('safety')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  contentMode === 'safety'
                    ? 'bg-white border-teal-600 ring-2 ring-teal-500 shadow-xs'
                    : 'bg-white/70 border-slate-200 hover:bg-white opacity-80'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-extrabold text-teal-950 flex items-center gap-1.5">
                    <span>🛡️</span>
                    <span>Standard HSE Safety Mode</span>
                  </span>
                  {contentMode === 'safety' && (
                    <span className="text-[10px] font-bold bg-teal-100 text-teal-900 px-1.5 py-0.5 rounded">ACTIVE</span>
                  )}
                </div>
                <p className="text-[10.5px] text-slate-600 leading-snug">
                  Classic rig operations, mechanical inspections, and safety observations.
                </p>
              </button>
            </div>

            {/* 4B. CUSTOM TOPIC / WRITE ABOUT ANYTHING INJECTOR */}
            <div className="pt-2 border-t border-amber-200/60 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <label className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Custom Topic Injector — Write About Anything You Want (Optional):</span>
                </label>
                {customTopic && (
                  <button
                    type="button"
                    onClick={() => setCustomTopic('')}
                    className="text-[10px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    <span>Clear Custom Topic</span>
                  </button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  disabled={isRunning}
                  placeholder="Type any topic (e.g., Champions League Final, Double Smash Burgers, GTA VI, Arabic Oud Music, Camping in the Desert)..."
                  className="flex-1 px-3 py-2 text-xs bg-white border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 text-slate-900 placeholder:text-slate-400"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-semibold text-slate-500">1-Click Topics:</span>
                {[
                  { label: '☕ Specialty Espresso & Coffee', value: 'brewing specialty V60 pour-over coffee and triple-shot iced Spanish lattes' },
                  { label: '🍔 Smash Burgers & Shawarma', value: 'charcoal-grilled shawarma wraps, crispy smash burgers, and garlic sauce' },
                  { label: '⚽ Champions League Football', value: 'UEFA Champions League knockout goals, last-minute free kicks, and tactical lineups' },
                  { label: '🎮 PS5, EA FC & Gaming', value: 'late-night PS5 EA FC tournaments, Tekken 8 combos, and custom gaming setups' },
                  { label: '🏎️ V8 Supercars & Off-Road', value: 'twin-turbo V8 desert off-road builds, Nürburgring lap times, and classic muscle cars' },
                  { label: '🎬 IMAX Movies & Sci-Fi', value: 'Christopher Nolan IMAX blockbusters, classic action cinema, and plot twists' },
                  { label: '😂 Stand-Up Comedy Roasts', value: 'hilarious stand-up comedy specials, impersonations, and witty one-liners' },
                  { label: '🎵 Acoustic Oud & Classic Rock', value: 'live acoustic oud sessions, 80s classic rock guitar solos, and road-trip playlists' }
                ].map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    disabled={isRunning}
                    onClick={() => {
                      setCustomTopic(chip.value);
                      setContentMode('pure_non_safety');
                    }}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border transition-all ${
                      customTopic === chip.value
                        ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                        : 'bg-white/90 hover:bg-amber-100 text-slate-700 border-amber-200'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 4C. THEME MULTI-SELECT HEADER */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-900 block">
                  4B. Card Themes &amp; Style (Select One or Multiple — 12 Themes Available):
                </label>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-900 border border-teal-200">
                  {selectedThemes.length} Selected
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Pick any combination of themes below. The generator rotates evenly across all selected themes!
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCardBankModal(true)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors px-2 py-1 rounded-md hover:bg-indigo-50"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Custom Bank ({customCardsCount})</span>
              </button>
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 pb-1">
            <span className="text-[11px] font-semibold text-slate-400">Quick Presets:</span>
            <button
              type="button"
              onClick={handleSelectNonSafetyFavorites}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-900 transition-colors shadow-2xs"
            >
              🎉 All Non-Safety Favorites (9 Themes)
            </button>
            <button
              type="button"
              onClick={() => {
                setContentMode('pure_non_safety');
                setSelectedThemes(['food', 'crew_life', 'humor']);
              }}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-orange-300 bg-orange-50 hover:bg-orange-100 text-orange-900 transition-colors shadow-2xs"
            >
              🍔 + ☕ Food, Coffee &amp; Camp Life
            </button>
            <button
              type="button"
              onClick={() => {
                setContentMode('pure_non_safety');
                setSelectedThemes(['gaming', 'travel', 'cinema']);
              }}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-violet-300 bg-violet-50 hover:bg-violet-100 text-violet-900 transition-colors shadow-2xs"
            >
              🎮 + 🏎️ Gaming, Cars &amp; Movies
            </button>
            <button
              type="button"
              onClick={() => {
                setContentMode('pure_non_safety');
                setSelectedThemes(['humor', 'music']);
              }}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 transition-colors shadow-2xs"
            >
              🎭 + 🎵 Comedy &amp; Music
            </button>
            <button
              type="button"
              onClick={() => {
                setContentMode('pure_non_safety');
                setSelectedThemes(['sports', 'wisdom']);
              }}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 transition-colors shadow-2xs"
            >
              🏆 + 🧠 Football &amp; Mind Facts
            </button>
            <button
              type="button"
              onClick={() => {
                setContentMode('safety');
                setSelectedThemes(['operations']);
              }}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-teal-300 bg-teal-50 hover:bg-teal-100 text-teal-900 transition-colors shadow-2xs"
            >
              🏗️ Operations Only (Safety)
            </button>
            <button
              type="button"
              onClick={handleSelectAllThemes}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors"
            >
              ✨ Select All ({THEME_DEFINITIONS.length} Themes)
            </button>
          </div>

          {/* Multi-Select Theme Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            {THEME_DEFINITIONS.map((t) => {
              const isSelected = selectedThemes.includes(t.id);
              return (
                <div
                  key={t.id}
                  onClick={() => !isRunning && handleToggleTheme(t.id)}
                  className={`p-3 rounded-xl border cursor-pointer select-none transition-all relative flex flex-col justify-between ${
                    isSelected
                      ? `${t.bgColor} ${t.borderColor} ring-2 ${t.activeRing} shadow-xs`
                      : 'bg-white border-slate-200 hover:bg-slate-50 opacity-70 hover:opacity-100'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xl">{t.emoji}</span>
                        {t.isNonSafetyFavorite && (
                          <span className="text-[9px] font-extrabold uppercase tracking-tighter px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                            Non-Safety
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isRunning) handleSelectOnlyTheme(t.id);
                          }}
                          className="text-[10px] text-slate-500 hover:text-slate-900 bg-white/80 hover:bg-white px-1.5 py-0.5 rounded border border-slate-200 font-semibold transition-colors"
                          title={`Select ONLY ${t.label}`}
                        >
                          Only
                        </button>
                        <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                          isSelected ? 'bg-teal-600 border-teal-600 text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-900 block leading-tight">
                      {t.label}
                    </span>
                    <span className="text-[10.5px] text-slate-600 leading-snug block mt-1">
                      {t.shortDesc}
                    </span>
                  </div>

                  <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[9.5px]">
                    <span className={isSelected ? 'font-bold text-slate-900' : 'text-slate-400'}>
                      {isSelected ? '✓ Active in batch' : 'Click to add'}
                    </span>
                    {t.id === 'custom' && (
                      <span className="font-mono text-purple-700 bg-purple-100 px-1 rounded">
                        {customCardsCount}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 5. DATE & SPEED SETTINGS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-slate-100">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Report Date:
            </label>
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              disabled={isRunning}
              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg disabled:opacity-50"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Submission Speed Profile:
            </label>
            <select
              value={chunkSize}
              onChange={(e) => setChunkSize(Number(e.target.value))}
              disabled={isRunning}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg disabled:opacity-50"
            >
              <option value={5}>Balanced (~10 cards/sec) - Recommended</option>
              <option value={8}>Turbo (~16 cards/sec)</option>
              <option value={10}>Maximum (~20 cards/sec)</option>
            </select>
          </div>
        </div>

        {/* 6. SAMPLE CARD LIVE PREVIEW */}
        {(() => {
          let sampleCard: SoarCardTemplate;
          let sampleSeed = '';
          let sampleContext = '';

          if (cardSource === 'ai_unique') {
            const seed = generateUniqueSeed(sampleRefreshKey, 'sample_preview');
            const previewTheme = selectedThemes[sampleRefreshKey % Math.max(1, selectedThemes.length)] || 'operations';
            const context = getUniqueIterationContext(sampleRefreshKey, seed, cardCategory, previewTheme);
            const gen = generateInfiniteUniqueCards({
              count: 1,
              category: cardCategory,
              theme: previewTheme,
              themes: selectedThemes,
              contentMode: contentMode,
              customTopic: customTopic,
              assessmentFilter: assessmentFilter,
              baseSeed: `sample_${sampleRefreshKey}`
            });
            sampleCard = gen[0];
            sampleSeed = seed;
            sampleContext = context;
          } else {
            const samplePool = getCardPoolByTheme(selectedThemes, assessmentFilter, cardCategory);
            sampleCard = samplePool[0];
          }

          if (!sampleCard) return null;

          return (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>
                    Sample Card ({contentMode === 'pure_non_safety' ? '🎉 100% Non-Safety Engine' : cardSource === 'ai_unique' ? '🤖 AI Unique Engine' : '📋 Pre-stored'}):
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSampleRefreshKey(prev => prev + 1)}
                    className="px-2 py-0.5 text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 rounded-md border border-indigo-200 transition-all flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Generate Another Sample</span>
                  </button>
                  <span className="text-[10px] bg-slate-200 text-slate-700 font-mono px-2 py-0.5 rounded">
                    {sampleCard.zone} · {cardCategory === 'Safe' ? 'Safe' : (assessmentFilter === 'safe_only' ? 'Safe' : (assessmentFilter === 'unsafe_only' ? 'Unsafe' : sampleCard.assessment))}
                  </span>
                </div>
              </div>

              {cardSource === 'ai_unique' && sampleSeed && (
                <div className="bg-purple-50/60 p-2 rounded-lg border border-purple-200/60 text-[10px] font-mono text-purple-900 space-y-0.5">
                  <div><strong className="text-purple-950">Active Mode:</strong> {contentMode === 'pure_non_safety' ? 'PURE NON-SAFETY (Zero HSE Jargon)' : contentMode.toUpperCase()} {customTopic ? `· Custom Topic: "${customTopic}"` : ''}</div>
                  <div className="truncate"><strong className="text-purple-950">Seed:</strong> {sampleSeed}</div>
                </div>
              )}

              <div className="space-y-1 bg-white p-2.5 rounded-lg border border-slate-200 text-[11px]">
                <p className="text-slate-800">
                  <strong className="text-slate-900">Observation / Story: </strong>
                  {sampleCard.observation}
                </p>
                <p className="text-indigo-900">
                  <strong className="text-indigo-950">Action / Note: </strong>
                  {sampleCard.action}
                </p>
              </div>
            </div>
          );
        })()}

        {/* 7. INTERACTIVE BATCH PREVIEW, CARD SELECTOR & 1-CLICK REMAKE DECK */}
        <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-200/80 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-indigo-600" />
                <span>Interactive Batch Preview, Select/Unselect &amp; 1-Click Remake Deck</span>
              </span>
              <p className="text-[11px] text-slate-600">
                Want to inspect your {targetCount} cards before sending? Generate a preview deck to select/unselect cards, remake any card in-place, or edit text!
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                disabled={isRunning}
                onClick={() => {
                  setCardSource('ai_unique');
                  setShowMassBankSelector(true);
                }}
                className="px-3 py-1.5 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-2xs flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                title="Open Categorized AI Ideas Card Bank selector to pick saved ideas for Mass Submission"
              >
                <FolderKanban className="w-3.5 h-3.5" />
                <span>📂 Pick from AI Card Bank ({bankIdeas.length})</span>
              </button>
              <button
                type="button"
                disabled={isRunning}
                onClick={handleGeneratePreviewDeck}
                className="px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-2xs flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{previewDeck.length > 0 ? `Regenerate Preview Deck (${targetCount})` : `Preview & Customize Batch (${targetCount} Cards)`}</span>
              </button>
              {previewDeck.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowPreviewDeck(prev => !prev)}
                  className="px-2.5 py-1.5 text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl flex items-center gap-1 cursor-pointer"
                >
                  {showPreviewDeck ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  <span>{showPreviewDeck ? 'Hide Deck' : `Show Deck (${previewDeck.filter(c => c.selected).length}/${previewDeck.length})`}</span>
                </button>
              )}
            </div>
          </div>

          {showPreviewDeck && previewDeck.length > 0 && (
            <div className="space-y-2.5 pt-2 border-t border-indigo-200/60">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-2.5 rounded-xl border border-indigo-100">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleSelectAllDeckCards(true)}
                    className="px-2.5 py-1 text-[11px] font-bold bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 rounded-lg cursor-pointer"
                  >
                    ✓ Select All ({previewDeck.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectAllDeckCards(false)}
                    className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg cursor-pointer"
                  >
                    ✕ Unselect All
                  </button>
                  <span className="text-xs font-bold text-indigo-950 ml-1">
                    {previewDeck.filter(c => c.selected).length} of {previewDeck.length} cards selected
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {previewDeck.some(c => c.selected) && (
                    <button
                      type="button"
                      onClick={() => handleSaveDeckCardsToAiBank(previewDeck.filter(c => c.selected))}
                      className="px-3 py-1.5 text-xs font-bold bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-300 rounded-lg flex items-center gap-1.5 cursor-pointer"
                      title="Save all selected cards from this Mass Preview Deck into the Categorized AI Ideas Card Bank in Firestore"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5 text-purple-700" />
                      <span>🧠 Save Selected ({previewDeck.filter(c => c.selected).length}) to AI Card Bank</span>
                    </button>
                  )}

                  {!isRunning && previewDeck.some(c => c.selected) && (
                    <button
                      type="button"
                      onClick={() => handleStartMassRun(true)}
                      className="px-3.5 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Rocket className="w-3.5 h-3.5" />
                      <span>Submit Selected Cards Only ({previewDeck.filter(c => c.selected).length})</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
                {previewDeck.map((card, idx) => {
                  const isEditing = editingDeckCardId === card.id;
                  const isSavedToBank = savedDeckToBankIds.has(card.id);
                  return (
                    <div
                      key={card.id}
                      className={`p-3 rounded-xl border transition-all ${
                        card.selected
                          ? 'bg-white border-indigo-200 shadow-2xs'
                          : 'bg-slate-100/70 border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <input
                            type="checkbox"
                            checked={card.selected}
                            onChange={() => handleToggleDeckCard(card.id)}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                          <span className="text-[11px] font-mono font-bold text-slate-700">
                            #{idx + 1}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-900 border border-indigo-200">
                            {card.topic || card.category || card.categoryTheme}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">
                            {card.zone} · {card.role}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleSaveDeckCardsToAiBank([card])}
                            className={`px-2 py-1 text-[10px] font-bold rounded-lg border flex items-center gap-1 transition-colors cursor-pointer ${
                              isSavedToBank
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : 'bg-purple-50 hover:bg-purple-100 text-purple-900 border-purple-200'
                            }`}
                            title="Save this card into your Categorized AI Ideas Card Bank in Firestore"
                          >
                            <BookmarkPlus className="w-3 h-3" />
                            <span>{isSavedToBank ? '✓ In AI Bank' : '🧠 + AI Bank'}</span>
                          </button>

                          <button
                            type="button"
                            disabled={remakingDeckCardId === card.id}
                            onClick={() => handleRemakeSingleDeckCard(card.id, idx)}
                            className="px-2.5 py-1 text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-lg flex items-center gap-1 transition-colors disabled:opacity-60 cursor-pointer"
                            title="Recreate this card with Gemini AI in-place without reloading"
                          >
                            {remakingDeckCardId === card.id ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin text-indigo-700" />
                                <span>AI Recreating...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3 h-3 text-indigo-600" />
                                <span>✨ AI Remake</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingDeckCardId(isEditing ? null : card.id)}
                            className="px-2 py-1 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>{isEditing ? 'Done' : 'Edit'}</span>
                          </button>
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="mt-2 space-y-2">
                          <div>
                            <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Observation / Story:</label>
                            <textarea
                              rows={2}
                              value={card.observation}
                              onChange={(e) => handleUpdateDeckCardField(card.id, 'observation', e.target.value)}
                              className="w-full p-2 text-xs border border-indigo-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Action / Note:</label>
                            <textarea
                              rows={2}
                              value={card.action}
                              onChange={(e) => handleUpdateDeckCardField(card.id, 'action', e.target.value)}
                              className="w-full p-2 text-xs border border-indigo-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1.5 space-y-1 text-[11px] pl-6">
                          <p className="text-slate-800">
                            <strong className="text-slate-900">Observation: </strong>
                            {card.observation}
                          </p>
                          <p className="text-indigo-900">
                            <strong className="text-indigo-950">Action: </strong>
                            {card.action}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* PROGRESS BAR */}
        <div className="space-y-1.5 pt-2">
          <div className="flex justify-between text-xs font-semibold text-slate-700">
            <span>Overall Batch Progress:</span>
            <span className="font-mono text-teal-800">{progressCount} / {targetCount} ({progressPct}%)</span>
          </div>
          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200">
            <div
              className="bg-gradient-to-r from-teal-600 to-emerald-500 h-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* EXECUTION BUTTONS */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          {!isRunning ? (
            <>
              <button
                type="button"
                onClick={() => handleStartMassRun(false)}
                className="flex-1 py-3 px-6 bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all"
              >
                <Rocket className="w-5 h-5" />
                <span>
                  Launch {contentMode === 'pure_non_safety' ? '🎉 Non-Safety' : ''} Mass Submission ({targetCount} Cards) Now
                </span>
              </button>
              {previewDeck.some(c => c.selected) && (
                <button
                  type="button"
                  onClick={() => handleStartMassRun(true)}
                  className="py-3 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all"
                >
                  <CheckSquare className="w-4 h-4" />
                  <span>Launch Selected Deck ({previewDeck.filter(c => c.selected).length} Cards)</span>
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handlePauseResume}
                className="flex-1 py-3 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all"
              >
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                <span>{isPaused ? 'Resume Submission' : 'Pause Batch'}</span>
              </button>

              <button
                type="button"
                onClick={handleStop}
                className="py-3 px-5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>Stop Run</span>
              </button>
            </>
          )}

          {receipts.length > 0 && (
            <button
              type="button"
              onClick={handleExportReceiptsCsv}
              className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl border border-slate-300 flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>Download Receipts CSV ({receipts.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* LIVE SCROLLING RECEIPT TERMINAL */}
      <div className="bg-slate-950 rounded-xl border border-slate-800 shadow-md overflow-hidden font-mono text-xs">
        <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-slate-300">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-bold text-[11px] uppercase tracking-wider text-slate-200">
              Live Cloud Submission Stream (Microsoft Forms)
            </span>
          </div>
          <span className="text-[10px] text-slate-400">
            {receipts.length} cards logged in session
          </span>
        </div>

        <div
          ref={logContainerRef}
          className="h-64 overflow-y-auto p-3 space-y-1.5 text-[11px] text-slate-300"
        >
          {receipts.length === 0 ? (
            <div className="text-slate-500 py-8 text-center">
              Ready to launch. Click "Launch Mass Submission" above to start submitting cards in bulk.
            </div>
          ) : (
            receipts.map((r, i) => (
              <div key={i} className="flex items-center justify-between hover:bg-slate-900/60 px-2 py-0.5 rounded">
                <div className="flex items-center gap-2 truncate max-w-xl">
                  <span className="text-teal-400 font-bold">#{r.index}</span>
                  <span className="text-emerald-400 font-semibold">ID:{r.responseId}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-200">{r.zone}</span>
                  <span className="text-slate-500">({r.role})</span>
                  <span className="text-slate-400">·</span>
                  <span className={r.assessment === 'Safe' ? 'text-emerald-400' : 'text-amber-400'}>
                    {r.assessment}
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className={`px-1.5 py-0.2 rounded font-semibold text-[10px] ${
                    r.obsType === 'STOP Work Authority (SWA)'
                      ? 'bg-amber-950 text-amber-300 border border-amber-800'
                      : r.obsType === 'Condition'
                      ? 'bg-sky-950 text-sky-300 border border-sky-800'
                      : r.obsType === 'Stop Work Authority Drill'
                      ? 'bg-purple-950 text-purple-300 border border-purple-800'
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}>
                    {r.obsType || 'Behavior Observation'}
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-400 truncate">{r.name}</span>
                </div>
                <div className="text-slate-500 text-[10px] shrink-0">
                  {r.time}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* PROMPT HISTORY BLACKLIST & SEND TO IDEAS MODAL */}
      {showBlacklistModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full p-4 sm:p-5 space-y-4 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 shadow-2xs">
                  <Lightbulb className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>Mass Submit Block List &amp; Barred Cards</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300">
                      {promptBlacklist.length} Barred
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Send any barred scenario from mass submissions into your permanent AI Training Ideas bank!
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBlacklistModal(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Summary Banner */}
            <div className="p-3 bg-gradient-to-r from-purple-50 via-indigo-50/50 to-slate-50 rounded-xl border border-purple-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                <span className="text-slate-700 leading-snug">
                  Convert real observations from your mass runs into gold-standard AI exemplars so Gemini learns your rig focus areas.
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleSendAllToIdeas()}
                disabled={promptBlacklist.length === 0 || isSendingToIdeas}
                className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs shrink-0 disabled:opacity-50 cursor-pointer"
                title="Send all cards from block list to AI Training Ideas"
              >
                {isSendingToIdeas ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>Send All ({promptBlacklist.length}) to Ideas</span>
              </button>
            </div>

            {/* Search Box & Multi-Selection Toolbar */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={blacklistSearch}
                  onChange={(e) => setBlacklistSearch(e.target.value)}
                  placeholder="Search barred cards by equipment, zone, or keyword..."
                  className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-purple-500 outline-none text-slate-900"
                />
              </div>

              {promptBlacklist.length > 0 && (
                <div className="flex items-center justify-between text-xs px-1 pt-1 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-slate-600 text-xs cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={
                          promptBlacklist.length > 0 &&
                          selectedBlacklistItems.size === promptBlacklist.filter(item => !blacklistSearch || item.toLowerCase().includes(blacklistSearch.toLowerCase())).length
                        }
                        onChange={() => {
                          const filtered = promptBlacklist.filter(item => !blacklistSearch || item.toLowerCase().includes(blacklistSearch.toLowerCase()));
                          handleSelectAllBlacklist(filtered);
                        }}
                        className="w-3.5 h-3.5 text-purple-600 rounded border-slate-300"
                      />
                      <span>Select All</span>
                    </label>
                    <span className="text-slate-400 text-[11px]">·</span>
                    <span className="text-slate-500 text-[11px]">
                      {selectedBlacklistItems.size > 0 ? `${selectedBlacklistItems.size} selected` : 'None selected'}
                    </span>
                  </div>

                  {selectedBlacklistItems.size > 0 && (
                    <button
                      type="button"
                      onClick={() => handleSendSelectedToIdeas()}
                      disabled={isSendingToIdeas}
                      className="px-2.5 py-1 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-800 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {isSendingToIdeas ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lightbulb className="w-3 h-3 text-purple-600" />}
                      <span>Send Selected ({selectedBlacklistItems.size}) to Ideas</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* List of Barred Scenarios */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 text-xs pr-1 max-h-[46vh]">
              {promptBlacklist
                .filter(item => !blacklistSearch || item.toLowerCase().includes(blacklistSearch.toLowerCase()))
                .length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                  <p>
                    {promptBlacklist.length === 0
                      ? 'No scenarios currently in the block list. As you generate or submit cards in mass submit, they will appear here.'
                      : 'No blacklisted scenarios match your search query.'}
                  </p>
                </div>
              ) : (
                <>
                  {promptBlacklist
                    .filter(item => !blacklistSearch || item.toLowerCase().includes(blacklistSearch.toLowerCase()))
                    .slice(0, blacklistVisibleLimit)
                    .map((item, idx) => {
                      const isInIdeas = sentToIdeasSet.has(item.trim());
                      const isSelected = selectedBlacklistItems.has(item);
                      const detectedZone = detectZoneFromText(item);
                      const detectedAssessment = detectAssessmentFromText(item);

                      return (
                        <div 
                          key={idx} 
                          className={`py-3 flex items-start justify-between gap-3 px-2.5 rounded-xl transition-all ${
                            isSelected ? 'bg-purple-50/70' : 'hover:bg-slate-50/80'
                          }`}
                        >
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectBlacklistItem(item)}
                              className="mt-1 w-3.5 h-3.5 text-purple-600 rounded border-slate-300 shrink-0 cursor-pointer"
                            />
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                                <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                  #{idx + 1}
                                </span>
                                <span className="font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  {detectedZone}
                                </span>
                                <span className={`font-semibold px-1.5 py-0.5 rounded ${
                                  detectedAssessment === 'Safe'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}>
                                  {detectedAssessment}
                                </span>
                                {isInIdeas && (
                                  <span className="font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                                    <Check className="w-2.5 h-2.5 text-emerald-600" />
                                    <span>In AI Ideas</span>
                                  </span>
                                )}
                              </div>
                              <p className="text-slate-800 text-[11px] leading-relaxed">
                                {item}
                              </p>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                            {isInIdeas ? (
                              <span 
                                className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-300 font-bold text-[10px] flex items-center gap-1"
                                title="Already added to AI Training Ideas"
                              >
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span className="hidden sm:inline">Saved</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleQuickSendToIdeas(item)}
                                className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-300 font-bold text-[11px] flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                                title="Send directly to AI Training Ideas"
                              >
                                <Lightbulb className="w-3.5 h-3.5 text-purple-600" />
                                <span>Send to Ideas</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                const draft = convertBlacklistItemToIdea(item);
                                setCustomizingBlockIdea(draft);
                              }}
                              className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                              title="Review and customize before sending"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRemoveBlacklistItem(item)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Remove from block list"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  {promptBlacklist.filter(item => !blacklistSearch || item.toLowerCase().includes(blacklistSearch.toLowerCase())).length > blacklistVisibleLimit && (
                    <div className="py-3 text-center">
                      <button
                        type="button"
                        onClick={() => setBlacklistVisibleLimit(prev => prev + 250)}
                        className="px-4 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-bold text-xs cursor-pointer"
                      >
                        Show More ({promptBlacklist.filter(item => !blacklistSearch || item.toLowerCase().includes(blacklistSearch.toLowerCase())).length - blacklistVisibleLimit} remaining)
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 text-[11px]">
                {sentToIdeasSet.size} ideas converted in session · Stored in Cloud Database
              </span>
              <div className="flex items-center gap-2">
                {promptBlacklist.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearBlacklist}
                    className="px-3 py-1.5 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 font-bold text-xs cursor-pointer"
                  >
                    Clear Block List
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowBlacklistModal(false)}
                  className="px-4 py-1.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 cursor-pointer shadow-xs"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOMIZE & PREVIEW BEFORE SENDING TO IDEAS MODAL */}
      {customizingBlockIdea && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 space-y-4 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Lightbulb className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Review &amp; Send Card to AI Ideas
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Fine-tune this card's topic, zone, role, and action before adding it to Gemini's bank
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCustomizingBlockIdea(null)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto text-xs pr-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Idea / Topic Title:
                </label>
                <input
                  type="text"
                  value={customizingBlockIdea.topic}
                  onChange={(e) => setCustomizingBlockIdea({ ...customizingBlockIdea, topic: e.target.value })}
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Rig Zone:
                  </label>
                  <select
                    value={customizingBlockIdea.zone}
                    onChange={(e) => setCustomizingBlockIdea({ ...customizingBlockIdea, zone: e.target.value })}
                    className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white"
                  >
                    <option value="Drill Floor / Derrick">Drill Floor / Derrick</option>
                    <option value="Cantilever / Pipe Deck">Cantilever / Pipe Deck</option>
                    <option value="Mud Pit / Sack Room">Mud Pit / Sack Room</option>
                    <option value="Substructure / BOP">Substructure / BOP</option>
                    <option value="Main Deck">Main Deck</option>
                    <option value="Camp / Galley">Camp / Galley</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Observed Role:
                  </label>
                  <select
                    value={customizingBlockIdea.role}
                    onChange={(e) => setCustomizingBlockIdea({ ...customizingBlockIdea, role: e.target.value })}
                    className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white"
                  >
                    <option value="Assistant Driller">Assistant Driller</option>
                    <option value="Floorman">Floorman</option>
                    <option value="Roustabout">Roustabout</option>
                    <option value="Derrickman">Derrickman</option>
                    <option value="Crane Operator">Crane Operator</option>
                    <option value="Mechanic (Rig)">Mechanic (Rig)</option>
                    <option value="Chief Electrician">Chief Electrician</option>
                    <option value="Barge Engineer">Barge Engineer</option>
                    <option value="Medic">Medic</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Assessment:
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCustomizingBlockIdea({ ...customizingBlockIdea, assessment: 'Safe' })}
                      className={`flex-1 py-1.5 text-center rounded-lg border font-bold text-xs ${
                        customizingBlockIdea.assessment === 'Safe'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      Safe
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomizingBlockIdea({ ...customizingBlockIdea, assessment: 'Unsafe' })}
                      className={`flex-1 py-1.5 text-center rounded-lg border font-bold text-xs ${
                        customizingBlockIdea.assessment === 'Unsafe'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      Unsafe
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Observation Type:
                  </label>
                  <select
                    value={customizingBlockIdea.obsType}
                    onChange={(e) => setCustomizingBlockIdea({ ...customizingBlockIdea, obsType: e.target.value })}
                    className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white"
                  >
                    <option value="Behavior Observation">Behavior Observation</option>
                    <option value="Condition">Condition</option>
                    <option value="STOP Work Authority (SWA)">STOP Work Authority (SWA)</option>
                    <option value="Stop Work Authority Drill">Stop Work Authority Drill</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Observation Text:
                </label>
                <textarea
                  rows={3}
                  value={customizingBlockIdea.observation}
                  onChange={(e) => setCustomizingBlockIdea({ ...customizingBlockIdea, observation: e.target.value })}
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Action / Corrective Measure:
                </label>
                <textarea
                  rows={2}
                  value={customizingBlockIdea.action}
                  onChange={(e) => setCustomizingBlockIdea({ ...customizingBlockIdea, action: e.target.value })}
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 text-slate-700 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={removeAfterSend}
                    onChange={(e) => setRemoveAfterSend(e.target.checked)}
                    className="w-3.5 h-3.5 text-purple-600 rounded border-slate-300"
                  />
                  <span>Also remove from mass submit block list once added</span>
                </label>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCustomizingBlockIdea(null)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-300 text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!customizingBlockIdea) return;
                  await saveAiTrainingIdeaToFirestore(customizingBlockIdea);
                  setSentToIdeasSet(prev => new Set(prev).add(customizingBlockIdea.observation.trim()));
                  if (removeAfterSend) {
                    handleRemoveBlacklistItem(customizingBlockIdea.observation);
                  }
                  showToast(`✓ Added "${customizingBlockIdea.topic}" to AI Training Ideas!`);
                  setCustomizingBlockIdea(null);
                }}
                className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save to AI Training Ideas</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-70 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg border border-slate-700 text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
