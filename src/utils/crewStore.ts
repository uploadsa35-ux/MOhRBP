import { saveCrewToFirestore, getCrewFromFirestore } from '../firebase';

export interface CrewMember {
  id: string;
  name: string;
  role: string;
  shift: 'Day' | 'Night' | 'Rotation';
  department: 'Drilling' | 'Deck & Crane' | 'Maintenance' | 'HSE' | 'Marine';
  isActive: boolean;
}

const STORAGE_KEY = 'rig50_crew_roster_v2';
const ANONYMOUS_RATIO_KEY = 'rig50_anonymous_ratio_v2';

export const INITIAL_RIG50_CREW: CrewMember[] = [
  { id: 'c1', name: 'Mohammed Al-Otaibi', role: 'Driller', shift: 'Day', department: 'Drilling', isActive: true },
  { id: 'c2', name: 'Ahmed Al-Ghamdi', role: 'Rig Safety Coach (RSC)', shift: 'Day', department: 'HSE', isActive: true },
  { id: 'c3', name: 'Khalid Al-Zahrani', role: 'Assistant Driller', shift: 'Day', department: 'Drilling', isActive: true },
  { id: 'c4', name: 'Fahad Al-Dosari', role: 'Crane Operator', shift: 'Day', department: 'Deck & Crane', isActive: true },
  { id: 'c5', name: 'Sultan Al-Shammari', role: 'Floorman', shift: 'Day', department: 'Drilling', isActive: true },
  { id: 'c6', name: 'Abdulaziz Al-Mutairi', role: 'Derrickman', shift: 'Day', department: 'Drilling', isActive: true },
  { id: 'c7', name: 'John Miller', role: 'Toolpusher', shift: 'Day', department: 'Drilling', isActive: true },
  { id: 'c8', name: 'Mark Wilson', role: 'Mechanic', shift: 'Day', department: 'Maintenance', isActive: true },
  { id: 'c9', name: 'Robert Davis', role: 'Electrician', shift: 'Day', department: 'Maintenance', isActive: true },
  { id: 'c10', name: 'David Clark', role: 'Roustabout', shift: 'Day', department: 'Deck & Crane', isActive: true },
  { id: 'c11', name: 'Tariq Mansoor', role: 'Floorman', shift: 'Night', department: 'Drilling', isActive: true },
  { id: 'c12', name: 'Nawaf Al-Harbi', role: 'Driller', shift: 'Night', department: 'Drilling', isActive: true },
  { id: 'c13', name: 'Saud Al-Anazi', role: 'Assistant Driller', shift: 'Night', department: 'Drilling', isActive: true },
  { id: 'c14', name: 'Bader Al-Qahtani', role: 'Derrickman', shift: 'Night', department: 'Drilling', isActive: true },
  { id: 'c15', name: 'Hassan Al-Shahri', role: 'Floorman', shift: 'Night', department: 'Drilling', isActive: true },
  { id: 'c16', name: 'Omar Al-Ghamdi', role: 'Roustabout', shift: 'Night', department: 'Deck & Crane', isActive: true },
  { id: 'c17', name: 'Salem Al-Subaie', role: 'Crane Operator', shift: 'Night', department: 'Deck & Crane', isActive: true },
  { id: 'c18', name: 'Faisal Al-Otaibi', role: 'HSE Specialist', shift: 'Night', department: 'HSE', isActive: true },
  { id: 'c19', name: 'Michael Jenkins', role: 'Rig Manager', shift: 'Day', department: 'Drilling', isActive: true },
  { id: 'c20', name: 'Yousef Al-Rashidi', role: 'Mud Engineer', shift: 'Day', department: 'Drilling', isActive: true }
];

let inMemoryCrewRoster: CrewMember[] = [...INITIAL_RIG50_CREW];
let inMemoryAnonymousRatio = 30;

export function getStoredCrewMembers(): CrewMember[] {
  return inMemoryCrewRoster;
}

/**
 * Saves crew members to Firestore Database and server (/api/crew)
 * and notifies all UI components across the app.
 */
export async function saveStoredCrewMembers(crew: CrewMember[]): Promise<boolean> {
  try {
    inMemoryCrewRoster = [...crew];

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rig50_crew_updated', { detail: inMemoryCrewRoster }));
    }

    const ratio = getAnonymousRatio();
    saveCrewToFirestore(crew).catch(err => console.warn('Firestore crew background sync note:', err));
    try {
      const res = await fetch('/api/crew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crew, anonymousRatio: ratio })
      });
      return res.ok;
    } catch (netErr) {
      console.warn('Notice: Server sync network error, saved to Firestore:', netErr);
      return true;
    }
  } catch (e) {
    console.error('Failed to save crew:', e);
    return false;
  }
}

export function getAnonymousRatio(): number {
  return inMemoryAnonymousRatio;
}

export async function saveAnonymousRatio(ratio: number): Promise<void> {
  try {
    inMemoryAnonymousRatio = ratio;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rig50_ratio_updated', { detail: ratio }));
    }

    const crew = getStoredCrewMembers();
    fetch('/api/crew', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crew, anonymousRatio: ratio })
    }).catch(err => console.warn('Could not sync ratio to server:', err));
  } catch (e) {
    console.error('Failed to save anonymous ratio:', e);
  }
}

/**
 * Syncs the client with Firestore cloud database.
 * Preserves user-saved names and never resets to default roster on app reloads.
 */
export async function syncCrewWithServer(): Promise<CrewMember[]> {
  if (typeof window === 'undefined') return INITIAL_RIG50_CREW;

  let serverCrew: CrewMember[] | null = null;
  try {
    const res = await fetch('/api/crew');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.crew) && data.crew.length > 0) {
        serverCrew = data.crew;
        if (typeof data.anonymousRatio === 'number') {
          inMemoryAnonymousRatio = data.anonymousRatio;
        }
      }
    }
  } catch (err) {
    console.warn('Server crew endpoint check notice:', err);
  }

  let firestoreCrew: CrewMember[] | null = null;
  try {
    const fsCrew = await getCrewFromFirestore();
    if (fsCrew && fsCrew.length > 0) {
      firestoreCrew = fsCrew;
    }
  } catch (fsErr) {
    console.warn('Firestore crew read notice:', fsErr);
  }

  const chosenCrew: CrewMember[] = firestoreCrew || serverCrew || inMemoryCrewRoster || INITIAL_RIG50_CREW;

  inMemoryCrewRoster = chosenCrew;
  window.dispatchEvent(new CustomEvent('rig50_crew_updated', { detail: chosenCrew }));

  if (!serverCrew && chosenCrew !== INITIAL_RIG50_CREW) {
    const ratio = getAnonymousRatio();
    fetch('/api/crew', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crew: chosenCrew, anonymousRatio: ratio })
    }).catch(() => {});
  }

  if (!firestoreCrew && chosenCrew !== INITIAL_RIG50_CREW) {
    saveCrewToFirestore(chosenCrew).catch(() => {});
  }

  return chosenCrew;
}

/**
 * Returns a crew name based on configured anonymous ratio.
 * If random < anonymousRatio, returns "" (empty string / anonymous).
 * Otherwise returns a random active crew member's name.
 */
export function getCrewNameForSubmission(crewList?: CrewMember[], forcedStrategy?: 'random_crew' | 'always_empty' | 'respect_ratio'): { name: string; role?: string } {
  const crew = (crewList && crewList.length > 0) ? crewList.filter(c => c.isActive) : getStoredCrewMembers().filter(c => c.isActive);
  
  if (forcedStrategy === 'always_empty') {
    return { name: '' };
  }

  if (forcedStrategy === 'random_crew' && crew.length > 0) {
    const pick = crew[Math.floor(Math.random() * crew.length)];
    return { name: pick.name, role: pick.role };
  }

  // Respect ratio
  const ratio = getAnonymousRatio();
  const roll = Math.random() * 100;
  
  if (roll < ratio || crew.length === 0) {
    return { name: '' };
  }

  const pick = crew[Math.floor(Math.random() * crew.length)];
  return { name: pick.name, role: pick.role };
}
