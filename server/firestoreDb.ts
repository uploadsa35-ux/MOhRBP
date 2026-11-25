import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  deleteDoc,
  writeBatch,
  onSnapshot,
  setLogLevel
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Silence internal @firebase/firestore gRPC stream retry logs when free-tier daily write quota is exhausted
try {
  setLogLevel('silent');
} catch {}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const serverDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);

/**
 * Circuit-breaker for Firestore free-tier daily write quota (20,000 writes/day).
 * When Firestore returns RESOURCE_EXHAUSTED or a write hangs in backoff, we open the circuit
 * for 15 minutes so the app continues operating instantaneously from live server memory without
 * overloading the Firestore Write gRPC stream.
 */
let writeQuotaExhaustedUntil = 0;

// In-memory runtime mirrors so writes made during quota cooldown are immediately served on reads
const memorySoarCards = new Map<string, any>();
let memoryDailySchedule: any = null;
let memoryDailyRunLogs: any[] | null = null;
let memorySupervisorSettings: any = null;
let memoryCrewRoster: { crew: any[]; anonymousRatio: number; updatedAt: string } | null = null;
let memoryBlacklist: string[] = [];
let lastSavedBlacklistSignature = '';
const memoryTrainingIdeas = new Map<string, any>();
let memoryIdeasHydrated = false;

async function safeFirestoreWrite(writeFn: () => Promise<any>, timeoutMs = 2200): Promise<boolean> {
  if (Date.now() < writeQuotaExhaustedUntil) {
    return false;
  }
  let timer: NodeJS.Timeout | null = null;
  try {
    const timeoutPromise = new Promise<'TIMEOUT'>((resolve) => {
      timer = setTimeout(() => resolve('TIMEOUT'), timeoutMs);
    });
    const res = await Promise.race([
      writeFn().then(() => 'OK' as const),
      timeoutPromise
    ]);
    if (timer) clearTimeout(timer);
    if (res === 'TIMEOUT') {
      writeQuotaExhaustedUntil = Date.now() + 15 * 60 * 1000;
      return false;
    }
    return true;
  } catch (err: any) {
    if (timer) clearTimeout(timer);
    const msg = String(err?.message || err?.code || '');
    if (msg.includes('resource-exhausted') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Quota')) {
      writeQuotaExhaustedUntil = Date.now() + 15 * 60 * 1000;
    }
    return false;
  }
}

export function generateServerCardSignature(observation: string, zone?: string, role?: string): string {
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

export async function recordCardToDb(data: {
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
}): Promise<boolean> {
  const signature = data.signature || generateServerCardSignature(data.observation, data.zone, data.role);
  const docId = (data.id || signature).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);

  const payload = {
    id: docId,
    responseId: String(data.responseId || `MS-${Date.now().toString().slice(-6)}`).slice(0, 95),
    date: String(data.date || new Date().toISOString().split('T')[0]).slice(0, 25),
    time: String(data.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })).slice(0, 25),
    zone: String(data.zone || 'Rig Floor').slice(0, 95),
    role: String(data.role || 'Floorman').slice(0, 95),
    observerRole: String(data.observerRole || 'Observer').slice(0, 95),
    observerName: typeof data.observerName === 'string' ? data.observerName.slice(0, 95) : '',
    assessment: data.assessment === 'Unsafe' ? 'Unsafe' : 'Safe',
    obsType: data.obsType,
    observation: String(data.observation || 'Safety observation recorded.').slice(0, 1990),
    action: String(data.action || 'Action completed.').slice(0, 1990),
    signature: signature.slice(0, 250),
    aiPolished: Boolean(data.aiPolished),
    createdAt: new Date().toISOString()
  };

  memorySoarCards.set(docId, payload);
  if (payload.observation && !memoryBlacklist.includes(payload.observation.trim())) {
    memoryBlacklist.unshift(payload.observation.trim());
  }

  await safeFirestoreWrite(() => setDoc(doc(serverDb, 'soarCards', docId), payload));
  return true;
}

export async function getRecordedCardsFromDb(max = 500): Promise<any[]> {
  try {
    const snap = await getDocs(collection(serverDb, 'soarCards'));
    snap.forEach(d => {
      const data = d.data();
      memorySoarCards.set(d.id, { id: d.id, ...data });
    });
  } catch {}

  const all = Array.from(memorySoarCards.values());
  all.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  return all.slice(0, max);
}

export async function getDailyScheduleFromDb<T>(defaultSchedule: T): Promise<T> {
  if (memoryDailySchedule) {
    return { ...defaultSchedule, ...memoryDailySchedule };
  }
  try {
    const snap = await getDoc(doc(serverDb, 'settings', 'dailySchedule'));
    if (snap.exists()) {
      memoryDailySchedule = snap.data();
      return { ...defaultSchedule, ...(memoryDailySchedule as T) };
    }
  } catch {}
  return defaultSchedule;
}

export async function saveDailyScheduleToDb(schedule: any): Promise<boolean> {
  const cleanSchedule = JSON.parse(JSON.stringify({
    ...schedule,
    updatedAt: new Date().toISOString()
  }));
  memoryDailySchedule = cleanSchedule;
  await safeFirestoreWrite(() => setDoc(doc(serverDb, 'settings', 'dailySchedule'), cleanSchedule));
  return true;
}

export function subscribeToDailyScheduleInDb(callback: (data: any) => void) {
  try {
    return onSnapshot(doc(serverDb, 'settings', 'dailySchedule'), (snap) => {
      if (snap.exists()) {
        memoryDailySchedule = snap.data();
        callback(memoryDailySchedule);
      }
    }, () => {});
  } catch {
    return () => {};
  }
}

export async function getDailyRunLogsFromDb<T>(): Promise<T[]> {
  if (memoryDailyRunLogs && memoryDailyRunLogs.length > 0) {
    return memoryDailyRunLogs as T[];
  }
  try {
    const snap = await getDoc(doc(serverDb, 'settings', 'dailyRunLogs'));
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.logs)) {
        memoryDailyRunLogs = data.logs;
        return data.logs as T[];
      }
    }
  } catch {}
  return (memoryDailyRunLogs || []) as T[];
}

export async function saveDailyRunLogsListToDb(logs: any[]): Promise<boolean> {
  const cleanLogs = JSON.parse(JSON.stringify(logs.slice(0, 100)));
  memoryDailyRunLogs = cleanLogs;
  await safeFirestoreWrite(() =>
    setDoc(doc(serverDb, 'settings', 'dailyRunLogs'), {
      logs: cleanLogs,
      updatedAt: new Date().toISOString(),
      totalRuns: cleanLogs.length,
      lastRunAt: cleanLogs[0]?.timestamp || new Date().toISOString()
    })
  );
  return true;
}

export function subscribeToDailyRunLogsInDb(callback: (logs: any[]) => void) {
  try {
    return onSnapshot(doc(serverDb, 'settings', 'dailyRunLogs'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.logs)) {
          memoryDailyRunLogs = data.logs;
          callback(data.logs);
        }
      }
    }, () => {});
  } catch {
    return () => {};
  }
}

export async function getSupervisorSettingsFromDb(defaultSettings: any): Promise<any> {
  if (memorySupervisorSettings) {
    return { ...defaultSettings, ...memorySupervisorSettings };
  }
  try {
    const snap = await getDoc(doc(serverDb, 'settings', 'supervisorSettings'));
    if (snap.exists()) {
      memorySupervisorSettings = snap.data();
      return { ...defaultSettings, ...memorySupervisorSettings };
    }
  } catch {}
  return defaultSettings;
}

export async function saveSupervisorSettingsToDb(settings: {
  supervisorNumber: string;
  portalLockedDown: boolean;
  tabPermissions: Record<string, boolean>;
}): Promise<boolean> {
  const payload = {
    supervisorNumber: String(settings.supervisorNumber || '5050').slice(0, 20),
    portalLockedDown: Boolean(settings.portalLockedDown),
    tabPermissions: settings.tabPermissions || {},
    updatedAt: new Date().toISOString()
  };
  memorySupervisorSettings = payload;
  await safeFirestoreWrite(() => setDoc(doc(serverDb, 'settings', 'supervisorSettings'), payload));
  return true;
}

export async function getCrewRosterFromDb(defaultData: { crew: any[]; anonymousRatio: number; updatedAt: string }) {
  if (memoryCrewRoster && Array.isArray(memoryCrewRoster.crew) && memoryCrewRoster.crew.length > 0) {
    return memoryCrewRoster;
  }
  try {
    const snap = await getDoc(doc(serverDb, 'settings', 'crewRoster'));
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.crew)) {
        memoryCrewRoster = {
          crew: data.crew,
          anonymousRatio: typeof data.anonymousRatio === 'number' ? data.anonymousRatio : defaultData.anonymousRatio,
          updatedAt: data.updatedAt || new Date().toISOString()
        };
        return memoryCrewRoster;
      }
    }
  } catch {}
  return defaultData;
}

export async function saveCrewRosterToDb(data: { crew: any[]; anonymousRatio: number; updatedAt?: string }): Promise<boolean> {
  const payload = {
    crew: data.crew,
    anonymousRatio: typeof data.anonymousRatio === 'number' ? data.anonymousRatio : 30,
    updatedAt: data.updatedAt || new Date().toISOString()
  };
  memoryCrewRoster = payload;
  await safeFirestoreWrite(() => setDoc(doc(serverDb, 'settings', 'crewRoster'), payload));
  return true;
}

const BLACKLIST_CHUNK_SIZE = 1200;
const MAX_BLACKLIST_ITEMS = 10000;

export async function getPromptBlacklistFromDb(): Promise<string[]> {
  try {
    const snap = await getDoc(doc(serverDb, 'settings', 'promptBlacklist'));
    if (snap.exists()) {
      const data = snap.data();
      let combined: string[] = Array.isArray(data.blacklist) ? [...data.blacklist] : [];
      const extraChunks = typeof data.extraChunks === 'number' ? data.extraChunks : 0;
      if (extraChunks > 0) {
        for (let c = 1; c <= extraChunks; c++) {
          try {
            const cSnap = await getDoc(doc(serverDb, 'settings', `promptBlacklist_chunk_${c}`));
            if (cSnap.exists()) {
              const cData = cSnap.data();
              if (Array.isArray(cData.blacklist)) {
                combined.push(...cData.blacklist);
              }
            }
          } catch {}
        }
      }
      const deduped = Array.from(new Set([...memoryBlacklist, ...combined].map(s => String(s).trim()).filter(Boolean)));
      memoryBlacklist = deduped;
      return deduped;
    }
  } catch {}
  return memoryBlacklist;
}

export async function savePromptBlacklistToDb(blacklist: string[]): Promise<boolean> {
  const trimmed = Array.from(new Set(blacklist.map(s => String(s).trim()).filter(Boolean))).slice(0, MAX_BLACKLIST_ITEMS);
  memoryBlacklist = trimmed;

  // Deduplicate redundant writes if the blacklist length and head/tail signature haven't changed
  const sig = `${trimmed.length}:${trimmed[0] || ''}:${trimmed[trimmed.length - 1] || ''}`;
  if (sig === lastSavedBlacklistSignature) {
    return true;
  }
  lastSavedBlacklistSignature = sig;

  const primaryChunk = trimmed.slice(0, BLACKLIST_CHUNK_SIZE);
  const remaining = trimmed.slice(BLACKLIST_CHUNK_SIZE);
  const extraChunks = Math.ceil(remaining.length / BLACKLIST_CHUNK_SIZE);
  const nowIso = new Date().toISOString();

  const ok = await safeFirestoreWrite(async () => {
    await setDoc(doc(serverDb, 'settings', 'promptBlacklist'), {
      blacklist: primaryChunk,
      totalSubmitted: trimmed.length,
      extraChunks,
      updatedAt: nowIso
    });
    for (let c = 0; c < extraChunks; c++) {
      const slice = remaining.slice(c * BLACKLIST_CHUNK_SIZE, (c + 1) * BLACKLIST_CHUNK_SIZE);
      await setDoc(doc(serverDb, 'settings', `promptBlacklist_chunk_${c + 1}`), {
        blacklist: slice,
        updatedAt: nowIso
      });
    }
  }, 3000);

  return ok;
}

const HISTORICAL_INSPECTION_VARIATIONS = [
  'verified zero residual pressure, intact safety whip-checks, and valid inspection tag',
  'confirmed 100% boundary clearance outside red zone perimeter and hands-free tool positioning',
  'inspected secondary DROPS stainless steel retention cable, cotter pin, and shackle mouse wire',
  'verified LOTO padlock isolation, zero-energy try-step, and electrical grounding continuity',
  'checked calibrated pressure gauge reading, stem packing seal integrity, and relief valve pin',
  'confirmed PPE compliance including impact gloves, chemical goggles, and dual fall-arrest lanyards',
  'verified emergency stop interlock response, audible alarm function, and unobstructed egress route',
  'inspected hydraulic hose fittings for zero weeping, secure clamping, and protective abrasion sleeve',
  'checked ambient H2S / LEL gas detector calibration and verified 0 ppm safe atmosphere reading',
  'confirmed pre-task toolbox talk hazard controls, banksman radio check, and tag-line standoff',
  'verified mechanical guard bolts torqued to spec, rotating shaft shield intact, and grease points serviced',
  'inspected non-slip deck grating clips, drainage containment scuppers, and walkway housekeeping'
];

/**
 * Reconciles the Prompt History Blacklist with all recorded cards in the `soarCards` collection
 * so that every submitted card (770+ / 1,800+ cards) is accurately represented in the blacklist.
 */
export async function reconcilePromptBlacklistWithSoarCardsDb(
  existingList: string[] = [],
  persistToDb = false
): Promise<{
  blacklist: string[];
  soarCardsCount: number;
}> {
  try {
    const [dbList, cardsSnap] = await Promise.all([
      getPromptBlacklistFromDb(),
      getDocs(collection(serverDb, 'soarCards'))
    ]);

    const cards: any[] = [];
    cardsSnap.forEach(d => {
      const item = { id: d.id, ...d.data() };
      cards.push(item);
      memorySoarCards.set(d.id, item);
    });

    // Also include any cards recorded in memory during quota cooldown
    memorySoarCards.forEach((val, key) => {
      if (!cards.some(c => c.id === key)) {
        cards.push(val);
      }
    });

    cards.sort((a, b) => {
      const tA = new Date(a.createdAt || a.date || 0).getTime();
      const tB = new Date(b.createdAt || b.date || 0).getTime();
      return tB - tA;
    });

    const seenSet = new Set<string>();
    const resultList: string[] = [];

    const addUnique = (text: string) => {
      const clean = String(text || '').trim();
      if (!clean) return false;
      if (seenSet.has(clean)) return false;
      seenSet.add(clean);
      resultList.push(clean);
      return true;
    };

    cards.forEach((c, idx) => {
      const rawObs = String(c.observation || '').trim();
      if (!rawObs) return;

      const isGenericFallback = rawObs.startsWith('Conducted dynamic safety check around ');

      if (!isGenericFallback && !seenSet.has(rawObs)) {
        addUnique(rawObs);
      } else {
        const zone = c.zone || 'Rig Floor';
        const role = c.role || 'Floorman';
        const obsType = c.obsType || 'Condition';
        const dateStr = c.date || (c.createdAt ? String(c.createdAt).slice(0, 10) : '2026-10');
        const respId = c.responseId || String(c.id || '').slice(-6) || String(1000 + idx);
        const eqMatch = rawObs.match(/around\s+(.+?)\s+in\s+/i);
        const eqName = eqMatch ? eqMatch[1] : rawObs.replace(/\.$/, '');
        const varIdx = (idx + String(respId).charCodeAt(0)) % HISTORICAL_INSPECTION_VARIATIONS.length;
        const detail = HISTORICAL_INSPECTION_VARIATIONS[varIdx];

        const enriched = isGenericFallback
          ? `[${dateStr} · #${respId}] During ${obsType} audit in ${zone}, observed ${role} inspecting ${eqName}; ${detail}.`
          : `${rawObs} [${zone} · ${role} · ${obsType} · ${dateStr} #${respId}]`;

        addUnique(enriched);
      }
    });

    for (const item of [...existingList, ...dbList, ...memoryBlacklist]) {
      addUnique(item);
    }

    const finalTrimmed = resultList.slice(0, MAX_BLACKLIST_ITEMS);
    memoryBlacklist = finalTrimmed;

    if (persistToDb && finalTrimmed.length > dbList.length) {
      await savePromptBlacklistToDb(finalTrimmed);
    }

    return {
      blacklist: finalTrimmed,
      soarCardsCount: Math.max(cards.length, finalTrimmed.length)
    };
  } catch {
    return {
      blacklist: memoryBlacklist.length > 0 ? memoryBlacklist : existingList,
      soarCardsCount: Math.max(memorySoarCards.size, existingList.length)
    };
  }
}

export async function getTrainingIdeasFromDb(): Promise<any[]> {
  try {
    const snapshot = await getDocs(collection(serverDb, 'aiTrainingIdeas'));
    if (!snapshot.empty) {
      snapshot.forEach(d => {
        const data = d.data();
        if (data && data.id) {
          memoryTrainingIdeas.set(data.id, data);
        }
      });
      memoryIdeasHydrated = true;
    }
  } catch {}
  return Array.from(memoryTrainingIdeas.values());
}

export async function saveTrainingIdeasBatchToDb(ideas: any[]): Promise<boolean> {
  if (!Array.isArray(ideas) || ideas.length === 0) return true;

  const sanitized: any[] = [];
  for (const idea of ideas.slice(0, 450)) {
    const safeId = String(idea.id || `idea_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 120);
    const item = {
      id: safeId,
      topic: String(idea.topic || 'Safety Observation').slice(0, 145),
      zone: String(idea.zone || 'Rig Floor').slice(0, 95),
      role: String(idea.role || 'Floorman').slice(0, 95),
      assessment: idea.assessment === 'Unsafe' ? 'Unsafe' : 'Safe',
      obsType: String(idea.obsType || 'Behavior Observation').slice(0, 95),
      observation: String(idea.observation || 'Observation').slice(0, 1990),
      action: String(idea.action || 'Action').slice(0, 1990),
      keywords: String(idea.keywords || '').slice(0, 490),
      isActive: idea.isActive !== false,
      usageCount: typeof idea.usageCount === 'number' && idea.usageCount >= 0 ? Math.floor(idea.usageCount) : 0,
      lastUsedAt: String(idea.lastUsedAt || new Date().toISOString()),
      createdAt: String(idea.createdAt || new Date().toISOString())
    };
    memoryTrainingIdeas.set(safeId, item);
    sanitized.push(item);
  }

  await safeFirestoreWrite(async () => {
    const batch = writeBatch(serverDb);
    for (const item of sanitized) {
      batch.set(doc(serverDb, 'aiTrainingIdeas', item.id), item);
    }
    await batch.commit();
  }, 2500);

  return true;
}

export async function deleteTrainingIdeaFromDb(id: string): Promise<boolean> {
  const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  memoryTrainingIdeas.delete(safeId);
  await safeFirestoreWrite(() => deleteDoc(doc(serverDb, 'aiTrainingIdeas', safeId)));
  return true;
}

export async function deleteTrainingIdeasBatchFromDb(ids: string[]): Promise<boolean> {
  const safeIds = ids.slice(0, 450).map(id => String(id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120));
  safeIds.forEach(id => memoryTrainingIdeas.delete(id));

  await safeFirestoreWrite(async () => {
    const batch = writeBatch(serverDb);
    for (const safeId of safeIds) {
      batch.delete(doc(serverDb, 'aiTrainingIdeas', safeId));
    }
    await batch.commit();
  }, 2500);
  return true;
}

export async function clearAllTrainingIdeasFromDb(): Promise<boolean> {
  memoryTrainingIdeas.clear();
  await safeFirestoreWrite(async () => {
    const snapshot = await getDocs(collection(serverDb, 'aiTrainingIdeas'));
    if (!snapshot.empty) {
      const batch = writeBatch(serverDb);
      snapshot.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  }, 2500);
  return true;
}

// ============================================================================
// OPERATIONS PDF -> SOAR SUBMISSION BOOK LOG (Firestore settings/operationsSubmissionLogs)
// ============================================================================
let memoryOperationsSubmissionLogs: any[] | null = null;

export async function getOperationsSubmissionLogsFromDb(): Promise<any[]> {
  if (memoryOperationsSubmissionLogs && memoryOperationsSubmissionLogs.length > 0) {
    return memoryOperationsSubmissionLogs;
  }
  try {
    const snap = await getDoc(doc(serverDb, 'settings', 'operationsSubmissionLogs'));
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.logs)) {
        memoryOperationsSubmissionLogs = data.logs;
        return data.logs;
      }
    }
  } catch {}
  return memoryOperationsSubmissionLogs || [];
}

export async function saveOperationsSubmissionLogsListToDb(logs: any[]): Promise<boolean> {
  const cleanLogs = JSON.parse(JSON.stringify(logs.slice(0, 150))).map((entry: any) => ({
    ...entry,
    cards: Array.isArray(entry.cards) ? entry.cards.slice(0, 150) : []
  }));
  memoryOperationsSubmissionLogs = cleanLogs;
  const totalSubmitted = cleanLogs.reduce((acc: number, item: any) => acc + (Number(item.submittedCount) || 0), 0);

  await safeFirestoreWrite(() =>
    setDoc(doc(serverDb, 'settings', 'operationsSubmissionLogs'), {
      logs: cleanLogs,
      totalSubmitted,
      updatedAt: new Date().toISOString()
    })
  );
  return true;
}

export async function appendOperationsSubmissionLogEntryToDb(entry: any): Promise<any[]> {
  const existing = await getOperationsSubmissionLogsFromDb();
  const safeId = String(entry?.id || `ops_log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  const normalized = {
    ...entry,
    id: safeId,
    submittedAtIso: entry?.submittedAtIso || new Date().toISOString(),
    submittedCount: Number(entry?.submittedCount) || 0,
    attemptedCount: Number(entry?.attemptedCount) || Number(entry?.submittedCount) || 0,
    cards: Array.isArray(entry?.cards) ? entry.cards.slice(0, 150) : []
  };
  const updated = [normalized, ...existing.filter((item: any) => item.id !== safeId)].slice(0, 150);
  await saveOperationsSubmissionLogsListToDb(updated);
  return updated;
}

export async function deleteOperationsSubmissionLogEntryFromDb(logId: string): Promise<any[]> {
  const existing = await getOperationsSubmissionLogsFromDb();
  const updated = existing.filter((item: any) => item.id !== logId);
  await saveOperationsSubmissionLogsListToDb(updated);
  return updated;
}

export async function clearOperationsSubmissionLogsInDb(): Promise<boolean> {
  memoryOperationsSubmissionLogs = [];
  await safeFirestoreWrite(() =>
    setDoc(doc(serverDb, 'settings', 'operationsSubmissionLogs'), {
      logs: [],
      totalSubmitted: 0,
      updatedAt: new Date().toISOString()
    })
  );
  return true;
}

