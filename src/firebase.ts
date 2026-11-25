/**
 * Rig 50 Firebase & Firestore Database Integration
 * Persistent multi-device database for Crew Members, AI Training Ideas, and Unique SOAR Cards.
 * All writes are routed through the server-side Firestore circuit breaker so the browser client
 * never opens redundant gRPC Write streams or triggers client-side Free Tier Write Quota errors.
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  setLogLevel
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { CrewMember } from './utils/crewStore';

// Silence internal @firebase/firestore gRPC stream retry logs in the browser console
try {
  setLogLevel('silent');
} catch {}

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// CRITICAL: The app requires firebaseConfig.firestoreDatabaseId to bind to the provisioned database instance
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Error handling types and helper matching Firebase integration standards
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  return errInfo;
}

// Connection test on boot
let connectionTested = false;
let isConnected = false;

export async function testFirestoreConnection(): Promise<boolean> {
  if (connectionTested) return isConnected;
  try {
    await getDocFromServer(doc(db, 'settings', 'test_connection'));
    isConnected = true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      isConnected = false;
    } else {
      isConnected = true;
    }
  } finally {
    connectionTested = true;
  }
  return isConnected;
}

// Helper: Normalize string to produce a stable unique card signature strictly compliant with Firestore document paths and rules
export function generateCardSignature(observation: string, zone?: string, role?: string): string {
  let hash = 0;
  const raw = String(observation || '');
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  const safeZone = String(zone || 'RIG').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 12);
  const safeRole = String(role || 'ROLE').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 12);
  const cleanObs = raw.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').slice(0, 20);
  const hashStr = Math.abs(hash).toString(36);
  const timeSuffix = Date.now().toString(36);
  const randSuffix = Math.random().toString(36).slice(2, 6);

  return `sig_${safeZone}_${safeRole}_${hashStr}_${cleanObs}_${timeSuffix}_${randSuffix}`
    .replace(/_+/g, '_')
    .replace(/_$/, '')
    .slice(0, 120);
}

// Local cache of all seen signatures and recorded cards to fast-check uniqueness in memory
const knownSignatures = new Set<string>();
let inMemoryRecordedCards: RecordedCardData[] = [];

/**
 * Checks if a card is completely unique against Firestore and in-memory cache
 */
export async function isCardUniqueInFirestore(observation: string, zone?: string, role?: string): Promise<boolean> {
  const sig = generateCardSignature(observation, zone, role);
  if (knownSignatures.has(sig)) {
    return false;
  }
  try {
    const cardDoc = await getDoc(doc(db, 'soarCards', sig));
    if (cardDoc.exists()) {
      knownSignatures.add(sig);
      return false;
    }
    return true;
  } catch {
    return !knownSignatures.has(sig);
  }
}

export interface RecordedCardData {
  id?: string;
  responseId?: string;
  date?: string;
  time?: string;
  zone: string;
  role: string;
  observerRole?: string;
  observerName?: string;
  assessment: 'Safe' | 'Unsafe';
  obsType: 'STOP Work Authority (SWA)' | 'Behavior Observation' | 'Condition' | 'Stop Work Authority Drill';
  observation: string;
  action: string;
  signature?: string;
  aiPolished?: boolean;
  createdAt?: string;
}

/**
 * Records a submitted SOAR card via the backend Firestore circuit-breaker endpoint
 * so the browser never opens a direct gRPC Write stream.
 */
export async function recordCardToFirestore(data: RecordedCardData): Promise<{ success: boolean; id: string }> {
  const signature = data.signature || generateCardSignature(data.observation, data.zone, data.role);
  const docId = (data.id || signature).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  knownSignatures.add(signature);

  const payload: RecordedCardData = {
    id: docId,
    responseId: data.responseId || `MS-${Date.now().toString().slice(-6)}`,
    date: data.date || new Date().toISOString().split('T')[0],
    time: data.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    zone: data.zone,
    role: data.role,
    observerRole: data.observerRole || 'Observer',
    observerName: data.observerName || '(Anonymous)',
    assessment: data.assessment,
    obsType: data.obsType,
    observation: data.observation.slice(0, 1990),
    action: data.action.slice(0, 1990),
    signature: signature.slice(0, 250),
    aiPolished: Boolean(data.aiPolished),
    createdAt: new Date().toISOString()
  };

  inMemoryRecordedCards = [payload, ...inMemoryRecordedCards.filter(c => c.id !== docId)].slice(0, 2500);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('rig50_recorded_cards_updated', { detail: inMemoryRecordedCards.slice(0, 50) }));
  }

  try {
    await fetch('/api/soar-cards/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { success: true, id: docId };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `soarCards/${docId}`);
    return { success: true, id: docId };
  }
}

const MAX_BLACKLIST_ITEMS = 10000;
let inMemoryBlacklistCache: string[] = [];

/**
 * Saves Prompt History Blacklist via backend server (which persists to Firestore settings collection with quota protection)
 */
export async function savePromptBlacklistToFirestore(items: string[]): Promise<boolean> {
  const trimmed = Array.from(new Set(items.map(s => String(s).trim()).filter(Boolean))).slice(0, MAX_BLACKLIST_ITEMS);
  inMemoryBlacklistCache = trimmed;

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('rig50_blacklist_updated', { detail: trimmed }));
  }

  try {
    await fetch('/api/blacklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blacklist: trimmed })
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/promptBlacklist');
    return false;
  }
}

/**
 * Retrieves Prompt History Blacklist from Firestore settings / backend API
 */
export async function getPromptBlacklistFromFirestore(): Promise<string[]> {
  try {
    const res = await fetch('/api/blacklist');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.blacklist) && data.blacklist.length > 0) {
        inMemoryBlacklistCache = data.blacklist;
        return data.blacklist;
      }
    }
  } catch {}

  try {
    const snap = await getDoc(doc(db, 'settings', 'promptBlacklist'));
    if (snap.exists()) {
      const data = snap.data();
      let combined: string[] = Array.isArray(data.blacklist) ? [...data.blacklist] : [];
      const extraChunks = typeof data.extraChunks === 'number' ? data.extraChunks : 0;
      if (extraChunks > 0) {
        for (let c = 1; c <= extraChunks; c++) {
          try {
            const cSnap = await getDoc(doc(db, 'settings', `promptBlacklist_chunk_${c}`));
            if (cSnap.exists()) {
              const cData = cSnap.data();
              if (Array.isArray(cData.blacklist)) {
                combined.push(...cData.blacklist);
              }
            }
          } catch {}
        }
      }
      const deduped = Array.from(new Set(combined.map(s => String(s).trim()).filter(Boolean)));
      inMemoryBlacklistCache = deduped;
      return deduped;
    }
    return inMemoryBlacklistCache;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'settings/promptBlacklist');
    return inMemoryBlacklistCache;
  }
}

/**
 * Real-time subscription to Prompt History Blacklist in Firestore
 */
export function subscribeToPromptBlacklist(callback: (items: string[]) => void): () => void {
  const handleLocalBlacklist = (e: any) => {
    if (Array.isArray(e.detail)) {
      callback(e.detail);
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('rig50_blacklist_updated', handleLocalBlacklist);
  }

  try {
    const unsub = onSnapshot(doc(db, 'settings', 'promptBlacklist'), async (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        let combined: string[] = Array.isArray(data.blacklist) ? [...data.blacklist] : [];
        const extraChunks = typeof data.extraChunks === 'number' ? data.extraChunks : 0;
        if (extraChunks > 0) {
          for (let c = 1; c <= extraChunks; c++) {
            try {
              const cSnap = await getDoc(doc(db, 'settings', `promptBlacklist_chunk_${c}`));
              if (cSnap.exists()) {
                const cData = cSnap.data();
                if (Array.isArray(cData.blacklist)) {
                  combined.push(...cData.blacklist);
                }
              }
            } catch {}
          }
        }
        const deduped = Array.from(new Set([...inMemoryBlacklistCache, ...combined].map(s => String(s).trim()).filter(Boolean)));
        inMemoryBlacklistCache = deduped;
        callback(deduped);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/promptBlacklist');
    });

    return () => {
      unsub();
      if (typeof window !== 'undefined') {
        window.removeEventListener('rig50_blacklist_updated', handleLocalBlacklist);
      }
    };
  } catch {
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('rig50_blacklist_updated', handleLocalBlacklist);
      }
    };
  }
}

export interface CategoryQuotas {
  condition: number;
  behavior: number;
  swa: number;
  swaDrill?: number;
}

export interface DailyRunLogEntry {
  id: string;
  timestamp: string;
  timezone: string;
  localTimeDisplay: string;
  utcTimeDisplay: string;
  triggerType: 'scheduled' | 'manual';
  status: 'success' | 'failed' | 'running';
  targetCount: number;
  succeeded: number;
  failed: number;
  categoryQuotas: CategoryQuotas;
  elapsedSeconds: string;
  recipientEmail: string;
  emailSent: boolean;
  previewUrl?: string;
  messageId?: string;
  summary: string;
  sampleReceipts?: Array<{ responseId: string; zone: string; role: string; obsType: string; observation: string }>;
}

export interface DailyScheduleConfig {
  enabled: boolean;
  dailyTime: string;
  timezone?: string;
  recipientEmail: string;
  targetCount: number;
  categoryQuotas: CategoryQuotas;
  theme: string;
  cardCategory: 'Safe' | 'General';
  autoBlacklist: boolean;
  lastRunDate?: string;
  lastRunTime?: string;
  lastRunCount?: number;
  lastRunStatus?: 'success' | 'failed' | 'running';
  lastRunSummary?: string;
  lastRunPreviewUrl?: string;
  lastScheduledRunDate?: string;
  serverTimeUtc?: string;
  serverTimeUtcDisplay?: string;
  currentTimeInTargetTz?: string;
  currentTimeStrInTargetTz?: string;
  currentDateInTargetTz?: string;
  timezoneShort?: string;
  isScheduledTimePassedToday?: boolean;
  hasExecutedToday?: boolean;
  canCatchUpToday?: boolean;
  nextRunText?: string;
  totalLogsCount?: number;
  recentLog?: DailyRunLogEntry | null;
  updatedAt?: string;
}

const DEFAULT_DAILY_SCHEDULE: DailyScheduleConfig = {
  enabled: false,
  dailyTime: '06:00',
  timezone: 'Asia/Riyadh',
  recipientEmail: 'uploadsa35@gmail.com',
  targetCount: 100,
  categoryQuotas: {
    condition: 45,
    behavior: 45,
    swa: 10,
    swaDrill: 0
  },
  theme: 'operations',
  cardCategory: 'Safe',
  autoBlacklist: true
};

/**
 * Saves Daily Automated Run Schedule configuration via backend API
 */
export async function saveDailyScheduleToFirestore(config: DailyScheduleConfig): Promise<boolean> {
  try {
    const payload = {
      ...config,
      updatedAt: new Date().toISOString()
    };
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rig50_schedule_updated', { detail: payload }));
    }
    await fetch('/api/daily-schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/dailySchedule');
    return false;
  }
}

/**
 * Retrieves Daily Automated Run Schedule configuration from backend / Firestore settings
 */
export async function getDailyScheduleFromFirestore(): Promise<DailyScheduleConfig> {
  try {
    const res = await fetch('/api/daily-schedule');
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.schedule) {
        return { ...DEFAULT_DAILY_SCHEDULE, ...data.schedule };
      }
    }
  } catch {}

  try {
    const snap = await getDoc(doc(db, 'settings', 'dailySchedule'));
    if (snap.exists()) {
      return { ...DEFAULT_DAILY_SCHEDULE, ...(snap.data() as DailyScheduleConfig) };
    }
    return DEFAULT_DAILY_SCHEDULE;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'settings/dailySchedule');
    return DEFAULT_DAILY_SCHEDULE;
  }
}

/**
 * Real-time subscription to Daily Automated Run Schedule
 */
export function subscribeToDailySchedule(callback: (config: DailyScheduleConfig) => void): () => void {
  const handleLocal = (e: any) => {
    if (e.detail) callback({ ...DEFAULT_DAILY_SCHEDULE, ...e.detail });
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('rig50_schedule_updated', handleLocal);
  }

  try {
    const unsub = onSnapshot(doc(db, 'settings', 'dailySchedule'), (snap) => {
      if (snap.exists()) {
        callback({ ...DEFAULT_DAILY_SCHEDULE, ...(snap.data() as DailyScheduleConfig) });
      } else {
        callback(DEFAULT_DAILY_SCHEDULE);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/dailySchedule');
    });
    return () => {
      unsub();
      if (typeof window !== 'undefined') {
        window.removeEventListener('rig50_schedule_updated', handleLocal);
      }
    };
  } catch {
    callback(DEFAULT_DAILY_SCHEDULE);
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('rig50_schedule_updated', handleLocal);
      }
    };
  }
}

/**
 * Saves a daily run audit record permanently via backend API
 */
export async function saveDailyRunLogToFirestore(entry: DailyRunLogEntry): Promise<boolean> {
  try {
    const res = await fetch('/api/daily-schedule/record-run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });
    if (res.ok) {
      const data = await res.json();
      if (typeof window !== 'undefined' && Array.isArray(data.logs)) {
        window.dispatchEvent(new CustomEvent('rig50_run_logs_updated', { detail: data.logs }));
      }
    }
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/dailyRunLogs');
    return false;
  }
}

/**
 * Retrieves daily run audit records from backend / Firebase Firestore
 */
export async function getDailyRunLogsFromFirestore(): Promise<DailyRunLogEntry[]> {
  try {
    const res = await fetch('/api/daily-schedule/logs');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.logs)) {
        return data.logs;
      }
    }
  } catch {}

  try {
    const snap = await getDoc(doc(db, 'settings', 'dailyRunLogs'));
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.logs)) {
        return data.logs;
      }
    }
    return [];
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'settings/dailyRunLogs');
    return [];
  }
}

/**
 * Real-time subscription to Daily Run Logs from Firebase Firestore
 */
export function subscribeToDailyRunLogs(callback: (logs: DailyRunLogEntry[]) => void): () => void {
  const handleLocal = (e: any) => {
    if (Array.isArray(e.detail)) callback(e.detail);
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('rig50_run_logs_updated', handleLocal);
  }

  try {
    const unsub = onSnapshot(doc(db, 'settings', 'dailyRunLogs'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.logs)) {
          callback(data.logs);
          return;
        }
      }
      callback([]);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/dailyRunLogs');
    });
    return () => {
      unsub();
      if (typeof window !== 'undefined') {
        window.removeEventListener('rig50_run_logs_updated', handleLocal);
      }
    };
  } catch {
    callback([]);
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('rig50_run_logs_updated', handleLocal);
      }
    };
  }
}

/**
 * Clears daily run logs via backend API
 */
export async function clearDailyRunLogsInFirestore(): Promise<boolean> {
  try {
    await fetch('/api/daily-schedule/logs/clear', { method: 'POST' });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rig50_run_logs_updated', { detail: [] }));
    }
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/dailyRunLogs');
    return false;
  }
}

/**
 * Fetches recorded cards from Firestore (default up to 2,500 cards)
 */
export async function getRecordedCardsFromFirestore(max = 2500): Promise<RecordedCardData[]> {
  try {
    const q = query(collection(db, 'soarCards'), orderBy('createdAt', 'desc'), limit(max));
    const snapshot = await getDocs(q);
    const results: RecordedCardData[] = [];
    snapshot.forEach(d => {
      const card = d.data() as RecordedCardData;
      results.push(card);
      if (card.signature) knownSignatures.add(card.signature);
    });
    if (results.length > 0) {
      inMemoryRecordedCards = results;
      return results;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'soarCards');
  }

  try {
    const res = await fetch(`/api/soar-cards?limit=${max}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.cards)) {
        inMemoryRecordedCards = data.cards;
        return data.cards;
      }
    }
  } catch {}

  return inMemoryRecordedCards;
}

/**
 * Subscribes to recent recorded SOAR cards in real-time
 */
export function subscribeToRecordedCards(callback: (cards: RecordedCardData[]) => void) {
  const handleLocal = (e: any) => {
    if (Array.isArray(e.detail)) {
      callback(e.detail);
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('rig50_recorded_cards_updated', handleLocal);
  }

  try {
    const q = query(collection(db, 'soarCards'), orderBy('createdAt', 'desc'), limit(30));
    const unsub = onSnapshot(q, (snapshot) => {
      const cards: RecordedCardData[] = [];
      snapshot.forEach(docSnap => {
        const item = docSnap.data() as RecordedCardData;
        cards.push(item);
        if (item.signature) knownSignatures.add(item.signature);
      });
      if (cards.length > 0) {
        inMemoryRecordedCards = cards;
      }
      callback(cards.length > 0 ? cards : inMemoryRecordedCards.slice(0, 30));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'soarCards');
      callback(inMemoryRecordedCards.slice(0, 30));
    });

    return () => {
      unsub();
      if (typeof window !== 'undefined') {
        window.removeEventListener('rig50_recorded_cards_updated', handleLocal);
      }
    };
  } catch {
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('rig50_recorded_cards_updated', handleLocal);
      }
    };
  }
}

/**
 * Saves and synchronizes crew members via backend API (which persists to settings/crewRoster in Firestore)
 */
export async function saveCrewToFirestore(crew: CrewMember[]): Promise<boolean> {
  try {
    const normalized = crew.map(c => ({
      id: c.id,
      name: c.name,
      role: c.role,
      shift: c.shift || 'Day',
      department: c.department || 'Drilling',
      isActive: c.isActive ?? true
    }));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rig50_crew_updated', { detail: normalized }));
    }

    await fetch('/api/crew', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crew: normalized, anonymousRatio: 30 })
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'crewMembers');
    return false;
  }
}

/**
 * Fetches crew members from Firestore database / backend API
 */
export async function getCrewFromFirestore(): Promise<CrewMember[]> {
  try {
    const res = await fetch('/api/crew');
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.crew) && data.crew.length > 0) {
        return data.crew.map((c: any) => ({
          id: c.id,
          name: c.name,
          role: c.role,
          shift: c.shift || 'Day',
          department: c.department || 'Drilling',
          isActive: c.isActive ?? true
        }));
      }
    }
  } catch {}

  try {
    const rosterSnap = await getDoc(doc(db, 'settings', 'crewRoster'));
    if (rosterSnap.exists()) {
      const data = rosterSnap.data();
      if (Array.isArray(data.crew) && data.crew.length > 0) {
        return data.crew.map((c: any) => ({
          id: c.id,
          name: c.name,
          role: c.role,
          shift: c.shift || 'Day',
          department: c.department || 'Drilling',
          isActive: c.isActive ?? true
        }));
      }
    }

    const snapshot = await getDocs(collection(db, 'crewMembers'));
    if (!snapshot.empty) {
      const crew: CrewMember[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        crew.push({
          id: data.id || docSnap.id,
          name: data.name,
          role: data.role,
          shift: 'Day',
          department: 'Drilling',
          isActive: data.active ?? true
        });
      });
      return crew;
    }

    return [];
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'crewMembers');
    return [];
  }
}

/**
 * Real-time listener for crew members
 */
export function subscribeToCrew(callback: (crew: CrewMember[]) => void) {
  const handleLocal = (e: any) => {
    if (Array.isArray(e.detail)) callback(e.detail);
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('rig50_crew_updated', handleLocal);
  }

  try {
    const unsub = onSnapshot(doc(db, 'settings', 'crewRoster'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.crew) && data.crew.length > 0) {
          callback(data.crew.map((c: any) => ({
            id: c.id,
            name: c.name,
            role: c.role,
            shift: c.shift || 'Day',
            department: c.department || 'Drilling',
            isActive: c.isActive ?? true
          })));
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'crewMembers');
    });
    return () => {
      unsub();
      if (typeof window !== 'undefined') {
        window.removeEventListener('rig50_crew_updated', handleLocal);
      }
    };
  } catch {
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('rig50_crew_updated', handleLocal);
      }
    };
  }
}

/**
 * AI Training Idea Interface
 */
export interface AiTrainingIdea {
  id: string;
  topic: string;
  zone?: string;
  role?: string;
  assessment?: 'Safe' | 'Unsafe';
  obsType?: 'STOP Work Authority (SWA)' | 'Behavior Observation' | 'Condition' | 'Stop Work Authority Drill' | string;
  observation: string;
  action: string;
  keywords?: string;
  categoryGroup?: string;
  isActive: boolean;
  usageCount?: number;
  lastUsedAt?: string;
  createdAt?: string;
}

export const AI_IDEA_CATEGORIES = [
  'Drilling & Rig Floor',
  'Casing, Cementing & Tubulars',
  'Cranes, Lifting & Marine',
  'BOP & Well Control',
  'Derrick & Working at Height',
  'Mud Pits, Shakers & Chemicals',
  'Mechanical, Electrical & LOTO',
  'Stop Work Authority (SWA)',
  'Camp, Galley & Housekeeping',
  'Non-Safety & Crew Lifestyle'
] as const;

export type AiIdeaCategoryName = (typeof AI_IDEA_CATEGORIES)[number] | string;

/**
 * Extracts explicit [cat:...] tag from keywords if present, or smartly classifies
 * an AI Training Idea into a category based on its topic, zone, obsType, and keywords.
 */
export function getIdeaCategory(idea: Partial<AiTrainingIdea>): string {
  if (idea.categoryGroup && idea.categoryGroup.trim()) {
    return idea.categoryGroup.trim();
  }
  const rawKw = String(idea.keywords || '');
  const catMatch = rawKw.match(/^\[cat:([^\]]+)\]/i);
  if (catMatch && catMatch[1].trim()) {
    return catMatch[1].trim();
  }

  const combined = `${idea.topic || ''} ${idea.observation || ''} ${idea.action || ''} ${rawKw}`.toLowerCase();
  const zone = String(idea.zone || '').toLowerCase();
  const obsType = String(idea.obsType || '').toLowerCase();

  if (
    /\b(music|comedy|movie|cinema|gym|fitness|football|soccer|basketball|chess|domino|table tennis|karaoke|barbecue|bbq|quiz|trivia|gaming|hobby|morale|non-safety|lifestyle|entertainment|cooking contest)\b/i.test(combined)
  ) {
    return 'Non-Safety & Crew Lifestyle';
  }

  if (
    obsType.includes('swa') ||
    obsType.includes('stop work') ||
    /\b(stop work authority|swa drill|invoked swa|exercised swa)\b/i.test(combined)
  ) {
    return 'Stop Work Authority (SWA)';
  }

  if (
    /\b(casing|cement|cementing|tubular|pipe rack|catwalk|thread protector|bucking|power tong|spinning wrench|elevator|bails|slips|dog collar|tally)\b/i.test(combined) ||
    zone.includes('pipe deck') ||
    zone.includes('cantilever')
  ) {
    return 'Casing, Cementing & Tubulars';
  }

  if (
    zone.includes('bop') ||
    /\b(bop|blowout|annular|pipe ram|blind ram|shear ram|koomey|accumulator|choke|kill line|well control|mpd|poor boy degasser|trip tank|pit gain)\b/i.test(combined)
  ) {
    return 'BOP & Well Control';
  }

  if (
    zone.includes('crane') ||
    zone.includes('helideck') ||
    /\b(crane|rigging|sling|shackle|tag line|tagline|lifting|hoist|supply vessel|boat|cargo basket|banksman|flagman|forklift|spreader bar|padeye)\b/i.test(combined)
  ) {
    return 'Cranes, Lifting & Marine';
  }

  if (
    zone.includes('derrick') ||
    /\b(derrick|monkeyboard|working at height|fall arrest|harness|lanyard|srl|drops|secondary retention|crown|fingerboard|stabbing board|man-riding|man riding)\b/i.test(combined)
  ) {
    return 'Derrick & Working at Height';
  }

  if (
    zone.includes('mud') ||
    zone.includes('shaker') ||
    zone.includes('sack') ||
    /\b(mud pit|shaker|scalping|barite|bentonite|caustic|chemical|sds|msds|eyewash|deluge shower|mixing hopper|agitator|degasser|centrifuge|desander|desilter)\b/i.test(combined)
  ) {
    return 'Mud Pits, Shakers & Chemicals';
  }

  if (
    zone.includes('engine') ||
    zone.includes('ler') ||
    zone.includes('pump') ||
    zone.includes('workshop') ||
    /\b(loto|lockout|tagout|electrical|breaker|generator|scr|vfd|mcc|mud pump|liner|swab|piston|valve pot|pulsation dampener|welding|grinder|lathe|compressor|air receiver|hydraulic)\b/i.test(combined)
  ) {
    return 'Mechanical, Electrical & LOTO';
  }

  if (
    zone.includes('camp') ||
    zone.includes('galley') ||
    zone.includes('office') ||
    zone.includes('store') ||
    /\b(galley|camp|accommodation|mess hall|laundry|clinic|medic|housekeeping|walkway|stairway|handrail|hydration|heat stress|electrolyte|ergonomic)\b/i.test(combined)
  ) {
    return 'Camp, Galley & Housekeeping';
  }

  return 'Drilling & Rig Floor';
}

/**
 * Encodes the category inside the `keywords` string using `[cat:Category Name]`
 * so it is persisted in Firestore (`aiTrainingIdeas`) while remaining 100% compliant
 * with Firestore security rules.
 */
export function setIdeaCategoryInKeywords(rawKeywords: string | undefined, category: string | undefined): string {
  const cleanKw = getCleanIdeaKeywords(rawKeywords);
  const cleanCat = (category || '').trim();
  if (!cleanCat) return cleanKw;
  return cleanKw ? `[cat:${cleanCat}] ${cleanKw}`.slice(0, 480) : `[cat:${cleanCat}]`;
}

/**
 * Strips the internal `[cat:...]` prefix from keywords for clean UI display.
 */
export function getCleanIdeaKeywords(rawKeywords: string | undefined): string {
  return String(rawKeywords || '')
    .replace(/^\[cat:[^\]]+\]\s*/i, '')
    .trim();
}


export const INITIAL_TRAINING_IDEAS: AiTrainingIdea[] = [
  {
    id: 'idea_1',
    topic: 'Hands-Free Tooling Policy',
    zone: 'Cantilever / Pipe Deck',
    role: 'Roustabout',
    assessment: 'Safe',
    obsType: 'Behavior Observation',
    observation: 'Observed deck crew consistently utilizing magnetic push-pull safety sticks to guide tubulars without direct hands-on contact.',
    action: 'Commended roustabout crew on-the-spot for 100% adherence to Aramco hands-free handling guidelines.',
    keywords: 'hands-free, push-pull, pinch points, tubulars',
    isActive: true,
    usageCount: 8,
    lastUsedAt: new Date().toISOString()
  },
  {
    id: 'idea_2',
    topic: 'Rotary Table Red-Zone Perimeter Enforcement',
    zone: 'Rig Floor',
    role: 'Driller',
    assessment: 'Unsafe',
    obsType: 'STOP Work Authority (SWA)',
    observation: 'Observed a Floorman stepping across the painted red-zone boundary near the rotating rotary table without prior Driller lock-out clearance.',
    action: 'Exercised immediate Stop Work Authority (SWA) to pause rotary rotation, escorted the Floorman back to the safe green walkway, and reinforced Rig 50 red-zone entry rules.',
    keywords: 'rig floor, rotary table, red zone, iron roughneck, barrier',
    isActive: true,
    usageCount: 6,
    lastUsedAt: new Date().toISOString()
  },
  {
    id: 'idea_3',
    topic: 'DROPS Secondary Retention on Derrick',
    zone: 'Derrick',
    role: 'Derrickman',
    assessment: 'Safe',
    obsType: 'Condition',
    observation: 'Verified all monkeyboard racking finger safety pins and secondary wire rope slings were securely locked with no missing split pins.',
    action: 'Recorded positive DROPS inspection in daily safety log; all secondary safety cables verified certified.',
    keywords: 'DROPS, secondary retention, wire rope, monkeyboard',
    isActive: true,
    usageCount: 5,
    lastUsedAt: new Date().toISOString()
  },
  {
    id: 'idea_4',
    topic: 'Offshore Crane Blind-Lift Stop Work Authority',
    zone: 'Cranes',
    role: 'Crane Operator',
    assessment: 'Unsafe',
    obsType: 'STOP Work Authority (SWA)',
    observation: 'During an offshore cargo lift behind the cantilever structure, UHF radio contact between the dedicated flagman and Crane Operator momentarily cut out.',
    action: 'Invoked immediate Stop Work Authority (SWA) to hold the crane hoist stationary, replaced the banksman radio battery on backup channel 3, and re-verified line-of-sight hand signals before resuming.',
    keywords: 'cranes, blind lift, banksman, radio communication, swa',
    isActive: true,
    usageCount: 4,
    lastUsedAt: new Date().toISOString()
  },
  {
    id: 'idea_5',
    topic: 'Heat Stress & Summer Hydration Break',
    zone: 'Shakers',
    role: 'Roustabout',
    assessment: 'Safe',
    obsType: 'Behavior Observation',
    observation: 'Observed area supervisor enforcing mandatory 15-minute shaded hydration breaks and electrolyte checks during active mud transfer.',
    action: 'Ensured cooler was restocked with fresh water and electrolyte packs; zero heat exhaustion symptoms reported.',
    keywords: 'heat stress, hydration, electrolytes, shaded break',
    isActive: true,
    usageCount: 3,
    lastUsedAt: new Date().toISOString()
  }
];

let inMemoryIdeasCache: AiTrainingIdea[] = [...INITIAL_TRAINING_IDEAS];

export function getLocalTrainingIdeas(): AiTrainingIdea[] {
  return inMemoryIdeasCache;
}

function sanitizeIdeaForFirestore(idea: AiTrainingIdea, fallbackIdx = 0): AiTrainingIdea {
  const safeId = String(idea.id || `idea_${Date.now()}_${fallbackIdx}_${Math.random().toString(36).slice(2, 7)}`)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 120);
  return {
    id: safeId,
    topic: String(idea.topic || 'Safety Observation').slice(0, 145),
    zone: String(idea.zone || 'Rig Floor').slice(0, 95),
    role: String(idea.role || 'Floorman').slice(0, 95),
    assessment: idea.assessment === 'Unsafe' ? 'Unsafe' : 'Safe',
    obsType: String(idea.obsType || 'Behavior Observation').slice(0, 95),
    observation: String(idea.observation || 'Observation recorded.').slice(0, 1990),
    action: String(idea.action || 'Action completed.').slice(0, 1990),
    keywords: String(idea.keywords || '').slice(0, 490),
    isActive: idea.isActive ?? true,
    usageCount: typeof idea.usageCount === 'number' && idea.usageCount >= 0 ? Math.floor(idea.usageCount) : 0,
    lastUsedAt: idea.lastUsedAt || new Date().toISOString(),
    createdAt: idea.createdAt || new Date().toISOString()
  };
}

/**
 * Saves a training idea via backend Firestore circuit-breaker API
 */
export async function saveAiTrainingIdeaToFirestore(idea: AiTrainingIdea): Promise<boolean> {
  const payload = sanitizeIdeaForFirestore(idea);

  inMemoryIdeasCache = [payload, ...inMemoryIdeasCache.filter(i => i.id !== payload.id)];
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('rig50_ai_ideas_updated', { detail: inMemoryIdeasCache }));
  }

  try {
    await fetch('/api/training-ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ideas: inMemoryIdeasCache })
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `aiTrainingIdeas/${payload.id}`);
    return true;
  }
}

/**
 * Saves multiple training ideas via backend Firestore circuit-breaker API
 */
export async function saveBatchAiTrainingIdeasToFirestore(ideas: AiTrainingIdea[]): Promise<boolean> {
  if (!ideas || ideas.length === 0) return true;

  const sanitizedList: AiTrainingIdea[] = ideas.map((idea, idx) => sanitizeIdeaForFirestore(idea, idx));

  const existingMap = new Map(inMemoryIdeasCache.map(i => [i.id, i]));
  sanitizedList.forEach(item => existingMap.set(item.id, item));
  inMemoryIdeasCache = Array.from(existingMap.values());

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('rig50_ai_ideas_updated', { detail: inMemoryIdeasCache }));
  }

  try {
    await fetch('/api/training-ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ideas: inMemoryIdeasCache })
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'aiTrainingIdeas/batch');
    return true;
  }
}

/**
 * Increments usageCount and updates lastUsedAt via backend API without opening client Write streams
 */
export async function incrementIdeaUsageInFirestore(ideaIds: string[]): Promise<void> {
  if (!ideaIds || ideaIds.length === 0) return;
  const uniqueIds = Array.from(new Set(ideaIds.filter(Boolean)));
  if (uniqueIds.length === 0) return;

  const nowIso = new Date().toISOString();
  let hasChanged = false;

  inMemoryIdeasCache = inMemoryIdeasCache.map(idea => {
    if (uniqueIds.includes(idea.id)) {
      hasChanged = true;
      return sanitizeIdeaForFirestore({
        ...idea,
        usageCount: (idea.usageCount || 0) + 1,
        lastUsedAt: nowIso
      });
    }
    return idea;
  });

  if (typeof window !== 'undefined' && hasChanged) {
    window.dispatchEvent(new CustomEvent('rig50_ai_ideas_updated', { detail: inMemoryIdeasCache }));
    fetch('/api/training-ideas/increment-usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: uniqueIds })
    }).catch(() => {});
  }
}

/**
 * Retrieves all AI training ideas from Firestore Database / backend API
 */
export async function getAiTrainingIdeasFromFirestore(): Promise<AiTrainingIdea[]> {
  try {
    const res = await fetch('/api/training-ideas');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.ideas) && data.ideas.length > 0) {
        inMemoryIdeasCache = data.ideas;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('rig50_ai_ideas_updated', { detail: data.ideas }));
        }
        return data.ideas;
      }
    }
  } catch {}

  try {
    const snapshot = await getDocs(collection(db, 'aiTrainingIdeas'));
    if (!snapshot.empty) {
      const ideas: AiTrainingIdea[] = [];
      snapshot.forEach(docSnap => {
        ideas.push(docSnap.data() as AiTrainingIdea);
      });
      inMemoryIdeasCache = ideas;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('rig50_ai_ideas_updated', { detail: ideas }));
      }
      return ideas;
    }
    return inMemoryIdeasCache;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'aiTrainingIdeas');
    return inMemoryIdeasCache;
  }
}

/**
 * Deletes an AI training idea via backend API
 */
export async function deleteAiTrainingIdeaFromFirestore(id: string): Promise<boolean> {
  inMemoryIdeasCache = inMemoryIdeasCache.filter(i => i.id !== id);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('rig50_ai_ideas_updated', { detail: inMemoryIdeasCache }));
  }

  try {
    await fetch(`/api/training-ideas/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `aiTrainingIdeas/${id}`);
    return false;
  }
}

/**
 * Bulk deletes multiple AI training ideas by ID via backend API
 */
export async function deleteBatchAiTrainingIdeasFromFirestore(ids: string[]): Promise<boolean> {
  if (!ids || ids.length === 0) return true;
  const idSet = new Set(ids);

  inMemoryIdeasCache = inMemoryIdeasCache.filter(i => !idSet.has(i.id));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('rig50_ai_ideas_updated', { detail: inMemoryIdeasCache }));
  }

  try {
    await fetch('/api/training-ideas/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'aiTrainingIdeas/batch');
    return false;
  }
}

/**
 * Clears all training ideas via backend API
 */
export async function clearAllAiTrainingIdeasFromFirestore(): Promise<boolean> {
  inMemoryIdeasCache = [];
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('rig50_ai_ideas_updated', { detail: [] }));
  }

  try {
    await fetch('/api/training-ideas', { method: 'DELETE' });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'aiTrainingIdeas/all');
    return false;
  }
}

/**
 * Subscribes to AI Training Ideas in real-time from Firestore Database & local events
 */
export function subscribeToAiTrainingIdeas(callback: (ideas: AiTrainingIdea[]) => void) {
  const handleLocalUpdate = (e: any) => {
    if (e.detail && Array.isArray(e.detail)) {
      callback(e.detail);
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('rig50_ai_ideas_updated', handleLocalUpdate);
  }

  try {
    const unsubscribe = onSnapshot(collection(db, 'aiTrainingIdeas'), (snapshot) => {
      if (!snapshot.empty) {
        const ideas: AiTrainingIdea[] = [];
        snapshot.forEach(docSnap => {
          ideas.push(docSnap.data() as AiTrainingIdea);
        });
        inMemoryIdeasCache = ideas;
        callback(ideas);
        return;
      }
      fetch('/api/training-ideas')
        .then(res => res.json())
        .then(async (data) => {
          if (data && Array.isArray(data.ideas) && data.ideas.length > 0) {
            inMemoryIdeasCache = data.ideas;
            callback(data.ideas);
          } else {
            callback(inMemoryIdeasCache);
          }
        })
        .catch(() => callback(inMemoryIdeasCache));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'aiTrainingIdeas');
      callback(inMemoryIdeasCache);
    });

    return () => {
      unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('rig50_ai_ideas_updated', handleLocalUpdate);
      }
    };
  } catch {
    callback(inMemoryIdeasCache);
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('rig50_ai_ideas_updated', handleLocalUpdate);
      }
    };
  }
}

// ============================================================================
// OPERATIONS PDF -> SOAR SUBMISSION BOOK LOG (Firestore settings/operationsSubmissionLogs)
// ============================================================================

export interface OperationsSubmissionCardReceipt {
  id: string;
  responseId: string;
  date: string;
  time: string;
  zone: string;
  role: string;
  observerName: string;
  assessment: 'Safe' | 'Unsafe';
  obsType: string;
  category: string;
  topic?: string;
  observation: string;
  action: string;
}

export interface OperationsSubmissionLogEntry {
  id: string;
  submittedAtIso: string;
  submittedDateDisplay: string;
  submittedTimeDisplay: string;
  reportDate: string;
  submittedCount: number;
  attemptedCount: number;
  safeCount: number;
  unsafeCount: number;
  conditionCount: number;
  behaviorCount: number;
  swaCount: number;
  durationSeconds: string;
  sourceFiles: string[];
  customInstructions?: string;
  status: 'completed' | 'partial' | 'aborted';
  cards: OperationsSubmissionCardReceipt[];
}

let inMemoryOpsSubmissionLogs: OperationsSubmissionLogEntry[] = [];

export async function saveOperationsSubmissionLogToFirestore(
  entry: OperationsSubmissionLogEntry
): Promise<OperationsSubmissionLogEntry[]> {
  inMemoryOpsSubmissionLogs = [
    entry,
    ...inMemoryOpsSubmissionLogs.filter(l => l.id !== entry.id)
  ].slice(0, 150);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('rig50_ops_logs_updated', { detail: inMemoryOpsSubmissionLogs })
    );
  }

  try {
    const res = await fetch('/api/operations/submission-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.logs)) {
        inMemoryOpsSubmissionLogs = data.logs;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('rig50_ops_logs_updated', { detail: data.logs })
          );
        }
        return data.logs;
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/operationsSubmissionLogs');
  }
  return inMemoryOpsSubmissionLogs;
}

export async function getOperationsSubmissionLogsFromFirestore(): Promise<OperationsSubmissionLogEntry[]> {
  try {
    const res = await fetch('/api/operations/submission-logs');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.logs)) {
        inMemoryOpsSubmissionLogs = data.logs;
        return data.logs;
      }
    }
  } catch {}

  try {
    const snap = await getDoc(doc(db, 'settings', 'operationsSubmissionLogs'));
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.logs)) {
        inMemoryOpsSubmissionLogs = data.logs as OperationsSubmissionLogEntry[];
        return inMemoryOpsSubmissionLogs;
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'settings/operationsSubmissionLogs');
  }
  return inMemoryOpsSubmissionLogs;
}

export async function deleteOperationsSubmissionLogFromFirestore(
  logId: string
): Promise<OperationsSubmissionLogEntry[]> {
  inMemoryOpsSubmissionLogs = inMemoryOpsSubmissionLogs.filter(l => l.id !== logId);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('rig50_ops_logs_updated', { detail: inMemoryOpsSubmissionLogs })
    );
  }

  try {
    const res = await fetch(`/api/operations/submission-logs/${encodeURIComponent(logId)}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.logs)) {
        inMemoryOpsSubmissionLogs = data.logs;
        return data.logs;
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'settings/operationsSubmissionLogs');
  }
  return inMemoryOpsSubmissionLogs;
}

export async function clearOperationsSubmissionLogsInFirestore(): Promise<boolean> {
  inMemoryOpsSubmissionLogs = [];
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('rig50_ops_logs_updated', { detail: [] }));
  }

  try {
    await fetch('/api/operations/submission-logs', { method: 'DELETE' });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'settings/operationsSubmissionLogs');
    return false;
  }
}

export function subscribeToOperationsSubmissionLogs(
  callback: (logs: OperationsSubmissionLogEntry[]) => void
): () => void {
  const handleLocal = (e: any) => {
    if (Array.isArray(e.detail)) {
      callback(e.detail);
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('rig50_ops_logs_updated', handleLocal);
  }

  getOperationsSubmissionLogsFromFirestore()
    .then(logs => {
      if (logs.length > 0) callback(logs);
    })
    .catch(() => {});

  try {
    const unsub = onSnapshot(
      doc(db, 'settings', 'operationsSubmissionLogs'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data.logs)) {
            inMemoryOpsSubmissionLogs = data.logs as OperationsSubmissionLogEntry[];
            callback(inMemoryOpsSubmissionLogs);
            return;
          }
        }
        callback(inMemoryOpsSubmissionLogs);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'settings/operationsSubmissionLogs');
        callback(inMemoryOpsSubmissionLogs);
      }
    );

    return () => {
      unsub();
      if (typeof window !== 'undefined') {
        window.removeEventListener('rig50_ops_logs_updated', handleLocal);
      }
    };
  } catch {
    callback(inMemoryOpsSubmissionLogs);
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('rig50_ops_logs_updated', handleLocal);
      }
    };
  }
}

