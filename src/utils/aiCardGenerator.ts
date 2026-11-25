/**
 * Rig 50 Infinite Unique AI Card Generator
 * Produces 100% unique, diverse, natural, and non-repeating SOAR safety cards for Rig 50 (50 Bob Palmer).
 * Features:
 * - Deep combinatorial offshore scenario engine (84 Rig 50 equipment items × 180+ distinct operational findings × 40 varied sentence openings)
 * - Strict per-batch deduplication of findings, equipment, sentence openings, and actions (zero repeated eye-wash, gauge snubber, or static SWA sentences)
 * - Zero robotic reference tags ([Check #...], (#PRG-...)) for natural human-written oilfield authenticity
 * - Strict alignment between Observation Type (Condition, Behavior, SWA, SWA Drill) and Risk Status (Safe vs Unsafe)
 */

import { CardCategoryType, SoarCardTemplate } from './cardBanks';
import { savePromptBlacklistToFirestore, getPromptBlacklistFromFirestore, incrementIdeaUsageInFirestore } from '../firebase';

export const RIG_50_ZONES = [
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

export const RIG_50_ROLES = [
  'Driller',
  'Assistant Driller',
  'Floorman',
  'Crane Operator',
  'HSE Specialist',
  'Rig Safety Coach (RSC)',
  'Derrickman',
  'Mechanic',
  'Electrician',
  'Roustabout',
  'Barge Engineer',
  'Toolpusher'
];

export function normalizeToOfficialZone(rawZone?: string): string {
  if (!rawZone) return 'Rig Floor';
  if (RIG_50_ZONES.includes(rawZone)) return rawZone;
  const lower = rawZone.toLowerCase();
  if (lower.includes('derrick')) return 'Derrick';
  if (lower.includes('drill floor') || lower.includes('rig floor')) return 'Rig Floor';
  if (lower.includes('cantilever') || lower.includes('pipe deck') || lower.includes('catwalk')) return 'Cantilever / Pipe Deck';
  if (lower.includes('bop') || lower.includes('substructure') || lower.includes('wellhead') || lower.includes('choke')) return 'BOP';
  if (lower.includes('crane')) return 'Cranes';
  if (lower.includes('shaker')) return 'Shakers';
  if (lower.includes('mud') || lower.includes('sack') || lower.includes('pit')) return 'Mud Pit / Sack Room';
  if (lower.includes('accommodation') || lower.includes('galley') || lower.includes('living')) return 'Accommodations';
  return 'Main Deck';
}

// 84 Specific Equipment and Sub-Systems on Jackup Rig 50 (50 Bob Palmer)
export const RIG_50_EQUIPMENT = [
  // Rig Floor (12)
  { item: 'Iron Roughneck ST-80C torque wrench carriage', zone: 'Rig Floor', role: 'Floorman', activity: 'making up 5-inch drill pipe stands' },
  { item: 'Top drive washpipe packing assembly and gooseneck manifold', zone: 'Rig Floor', role: 'Driller', activity: 'drilling ahead in 12-1/4" hole section' },
  { item: 'Rotary table master bushing lockdown dogs and split pins', zone: 'Rig Floor', role: 'Assistant Driller', activity: 'tripping out bottom-hole assembly' },
  { item: 'Drawworks auxiliary electromagnetic Eddy-current brake cooling loop', zone: 'Rig Floor', role: 'Mechanic', activity: 'heavy casing string running prep' },
  { item: 'Hydraulic link tilt cylinders and 500-ton elevator bails', zone: 'Rig Floor', role: 'Floorman', activity: 'latching stands from fingerboard' },
  { item: '9-5/8" single-joint casing elevator safety latch pin', zone: 'Rig Floor', role: 'Floorman', activity: 'hoisting casing joint through V-door' },
  { item: 'Standpipe manifold #1 high-pressure mud gauge saver sub', zone: 'Rig Floor', role: 'Assistant Driller', activity: 'slow circulating rate pressure check' },
  { item: 'Power slips hydraulic supply manifold and foot pedal guard', zone: 'Rig Floor', role: 'Floorman', activity: 'setting slips on drill collar string' },
  { item: 'Drill floor utility tugger air winch #1 deadman throttle lever', zone: 'Rig Floor', role: 'Floorman', activity: 'positioning bit breaker plate' },
  { item: 'Driller cabin cyber-chair emergency stop mushroom button', zone: 'Rig Floor', role: 'Driller', activity: 'pre-shift drilling console verification' },
  { item: 'Kelly spinner pneumatic actuator and backup tong snub line', zone: 'Rig Floor', role: 'Floorman', activity: 'torquing directional mud motor crossover' },
  { item: 'Mousehole tubular guide bell and removable safety cover plate', zone: 'Rig Floor', role: 'Floorman', activity: 'laying down single drill pipe joints' },

  // Cantilever / Pipe Deck (10)
  { item: 'Catwalk hydraulic pipe skate push arm proximity sensor', zone: 'Cantilever / Pipe Deck', role: 'Roustabout', activity: 'feeding 5-inch drill pipe to V-door ramp' },
  { item: 'Starboard tubular pipe rack steel safety stanchions and timber chocks', zone: 'Cantilever / Pipe Deck', role: 'Roustabout', activity: 'tier-stacking 8-inch drill collars' },
  { item: 'Cantilever longitudinal skidding hydraulic jacking cylinder #2', zone: 'Cantilever / Pipe Deck', role: 'Barge Engineer', activity: 'skidding cantilever to well slot B4' },
  { item: '5-1/2" heavy-weight drill pipe thread protector staging rack', zone: 'Cantilever / Pipe Deck', role: 'Floorman', activity: 'drifting and cleaning tubular box threads' },
  { item: 'Pipe deck pneumatic casing thread dope applicator brush station', zone: 'Cantilever / Pipe Deck', role: 'Roustabout', activity: 'preparing 13-3/8" casing tally' },
  { item: 'Cantilever portside walkway perimeter handrail and toe-board assembly', zone: 'Cantilever / Pipe Deck', role: 'Rig Safety Coach (RSC)', activity: 'structural barrier integrity walkdown' },
  { item: 'Offshore tubular lifting spreader bar and twin certified web slings', zone: 'Cantilever / Pipe Deck', role: 'Roustabout', activity: 'offloading casing bundle from catwalk' },
  { item: 'V-door ramp hydraulic pipe stop kickers and indexing pins', zone: 'Cantilever / Pipe Deck', role: 'Floorman', activity: 'receiving bottom-hole stabilizers' },
  { item: 'Cantilever drag-chain utility service loop cable tray', zone: 'Cantilever / Pipe Deck', role: 'Electrician', activity: 'inspecting flexible power feeders after skidding' },
  { item: 'Pipe deck high-pressure washdown lance and whip-check restraint', zone: 'Cantilever / Pipe Deck', role: 'Roustabout', activity: 'cleaning returned drill string tubulars' },

  // Main Deck (12)
  { item: 'Main deck rough-terrain forklift #2 reverse strobe and load backrest', zone: 'Main Deck', role: 'Roustabout', activity: 'relocating chemical pallets to sack store' },
  { item: 'Supply vessel cargo backloading four-leg bridle sling assembly', zone: 'Main Deck', role: 'Roustabout', activity: 'rigging empty mud skip for boat transfer' },
  { item: 'Welding shop 440V portable distribution spider box and cable bridge', zone: 'Main Deck', role: 'Electrician', activity: 'supplying power for deck pad-eye fabrication' },
  { item: 'Portside pneumatic utility winch #3 wire rope spooling tensioner', zone: 'Main Deck', role: 'Mechanic', activity: 'positioning test separator skid' },
  { item: 'Main deck fire muster station #4 foam monitor and hose cabinet', zone: 'Main Deck', role: 'Rig Safety Coach (RSC)', activity: 'weekly firefighting readiness audit' },
  { item: 'Starboard 70-person totally enclosed lifeboat davit release gear', zone: 'Main Deck', role: 'Barge Engineer', activity: 'marine survival craft readiness inspection' },
  { item: 'Compressed gas cylinder storage rack for oxygen and acetylene bottles', zone: 'Main Deck', role: 'Mechanic', activity: 'securing hot-work gas manifold cages' },
  { item: 'Starboard marine bunkering manifold drip containment save-all pan', zone: 'Main Deck', role: 'Barge Engineer', activity: 'pre-transfer diesel fuel hose connection' },
  { item: 'Bow leg jacking gearhouse #1 pinion drive lubrication pump', zone: 'Main Deck', role: 'Mechanic', activity: 'monitoring jackup leg rack-and-pinion greasing' },
  { item: 'SCR power control room HVAC over-pressure damper and panel locks', zone: 'Main Deck', role: 'Electrician', activity: 'high-voltage switchboard thermal scan' },
  { item: 'Main deck hazardous paint locker explosion-proof exhaust fan', zone: 'Main Deck', role: 'HSE Specialist', activity: 'auditing COSHH flammable storage ventilation' },
  { item: 'Marine boat landing swing rope platform and life-ring cabinet', zone: 'Main Deck', role: 'Roustabout', activity: 'checking standby vessel transfer readiness' },

  // BOP (10)
  { item: 'BOP stack 15,000 psi choke and kill flexible coflexip jumper hose', zone: 'BOP', role: 'Assistant Driller', activity: 'stump pressure testing well control barriers' },
  { item: 'Hydril 13-5/8" annular preventer hydraulic closing chamber manifold', zone: 'BOP', role: 'Mechanic', activity: 'function-testing annular sealing element' },
  { item: 'Koomey BOP accumulator unit nitrogen pre-charge bottle bank', zone: 'BOP', role: 'Mechanic', activity: 'recording 1,000 psi bottle pre-charge pressures' },
  { item: 'Upper and lower pipe ram mechanical locking screw handwheels', zone: 'BOP', role: 'Assistant Driller', activity: 'verifying ram lock engagement indicators' },
  { item: 'BOP bridge crane 50-ton pneumatic chain hoist and trolley stops', zone: 'BOP', role: 'Mechanic', activity: 'aligning bell nipple and flowline spool' },
  { item: 'Remote choke manifold hydraulic actuator and upstream pressure sensor', zone: 'BOP', role: 'Driller', activity: 'calibrating digital casing pressure transmitter' },
  { item: 'Substructure cellar deck work platform retractable grating panels', zone: 'BOP', role: 'Floorman', activity: 'nippling up high-pressure HCR fail-safe valves' },
  { item: 'Diverter housing 12-inch overboard vent line target-tee flange', zone: 'BOP', role: 'Mechanic', activity: 'inspecting shallow gas diverter line bolts' },
  { item: 'BOP test pump high-pressure chart recorder and bleed-off needle valve', zone: 'BOP', role: 'Toolpusher', activity: 'witnessing 14-day BOP barrier pressure test' },
  { item: 'Wellhead Texas deck perimeter safety chains and self-closing gate', zone: 'BOP', role: 'Floorman', activity: 'securing substructure access around well center' },

  // Cranes (9)
  { item: 'Port pedestal crane #1 auxiliary whip-line swivel hook safety latch', zone: 'Cranes', role: 'Crane Operator', activity: 'lifting sub-basket from main deck to pipe deck' },
  { item: 'Starboard pedestal crane #2 load moment indicator (LMI) wind anemometer', zone: 'Cranes', role: 'Crane Operator', activity: 'monitoring 20-knot offshore wind limits' },
  { item: 'Crane boom hoist upper limit switch and anti-two-block counterweight', zone: 'Cranes', role: 'Electrician', activity: 'testing crane over-hoist cutout interlock' },
  { item: 'Billy Pugh X-904 personnel transfer net stabilizer and secondary tether', zone: 'Cranes', role: 'Rig Safety Coach (RSC)', activity: 'inspecting marine crew transfer rigging' },
  { item: 'Pedestal crane slewing ring gearbox oil level sight glass and breather', zone: 'Cranes', role: 'Mechanic', activity: 'conducting weekly crane mechanical PM' },
  { item: 'Crane cab emergency hydraulic boom-lowering hand pump valve', zone: 'Cranes', role: 'Crane Operator', activity: 'verifying emergency load lowering system' },
  { item: 'Offshore container 4-point certified wire rope lifting bridle', zone: 'Cranes', role: 'Roustabout', activity: 'rigging mud logging unit supply container' },
  { item: 'Crane boom rest cradle shock pads and walkway access gate', zone: 'Cranes', role: 'Roustabout', activity: 'stowing starboard crane boom for helicopter arrival' },
  { item: 'Main hoist wire rope drum Lebus grooving and flange guards', zone: 'Cranes', role: 'Crane Operator', activity: 'checking wire rope spooling layers under load' },

  // Derrick (9)
  { item: 'Derrick 90-ft monkeyboard dual Sala-block self-retracting lifelines', zone: 'Derrick', role: 'Derrickman', activity: 'racking 5-inch drill pipe stands in fingerboard' },
  { item: 'Crown block sheave cluster secondary DROPS retention wire sling', zone: 'Derrick', role: 'Derrickman', activity: 'completing weekly crown grease and DROPS audit' },
  { item: 'Derrick Geronimo emergency escape line carriage and inertia brake', zone: 'Derrick', role: 'Rig Safety Coach (RSC)', activity: 'verifying monkeyboard secondary egress path' },
  { item: 'Fingerboard pneumatic pipe-locking latches and secondary safety pins', zone: 'Derrick', role: 'Derrickman', activity: 'securing racked drill collars against rig motion' },
  { item: 'Derrick vertical ladder Tractel climb-assist counterweight cable', zone: 'Derrick', role: 'Derrickman', activity: 'ascending derrick ladder to belly board' },
  { item: 'Standpipe gooseneck 5,000 psi rotary vibrator hose safety clamp', zone: 'Derrick', role: 'Mechanic', activity: 'inspecting rotary hose snubbing cable anchors' },
  { item: 'Derrick floodlight explosion-proof fixture 316-SS safety tether', zone: 'Derrick', role: 'Electrician', activity: 'conducting overhead DROPS lighting sweep' },
  { item: 'Casing stabbing board pneumatic winch and slack-wire limit switch', zone: 'Derrick', role: 'Derrickman', activity: 'positioning stabbing platform for 9-5/8" casing' },
  { item: 'Traveling block guide track dolly rollers and grease manifold', zone: 'Derrick', role: 'Mechanic', activity: 'lubricating top drive guide beam rails' },

  // Shakers (8)
  { item: 'Shale shaker #1 200-mesh screen pneumatic clamping seal and wedges', zone: 'Shakers', role: 'Floorman', activity: 'replacing torn shaker screen panel' },
  { item: 'Vacuum degasser suction butterfly valve and belt drive guard', zone: 'Shakers', role: 'Floorman', activity: 'circulating gas-cut drilling fluid bottoms-up' },
  { item: 'Mud gas separator (poor-boy degasser) 20-ft liquid seal U-tube gauge', zone: 'Shakers', role: 'Assistant Driller', activity: 'verifying glycol/mud hydrostatic seal height' },
  { item: 'Shaker header box possum-belly flow divider gate valves', zone: 'Shakers', role: 'Floorman', activity: 'balancing mud returns across four shakers' },
  { item: 'Shaker house fixed H2S and LEL infrared gas detector sensor head', zone: 'Shakers', role: 'HSE Specialist', activity: 'performing bump-test on flowline gas alarms' },
  { item: 'Desander and desilter hydrocyclone cone underflow Victaulic clamps', zone: 'Shakers', role: 'Floorman', activity: 'clearing silt buildup from mud cleaner cones' },
  { item: 'Shaker deck cuttings chute grating cover and washdown hose reel', zone: 'Shakers', role: 'Roustabout', activity: 'flushing oil-based mud cuttings trough' },
  { item: 'Centrifuge #1 high-speed rotating bowl cover interlock switch', zone: 'Shakers', role: 'Mechanic', activity: 'auditing barite recovery centrifuge guards' },

  // Mud Pit / Sack Room (8)
  { item: 'Low-pressure mud mixing hopper venturi jet and sack-table grate', zone: 'Mud Pit / Sack Room', role: 'Floorman', activity: 'mixing bentonite and polymer sweeps' },
  { item: 'Active mud pit #3 vertical agitator shaft coupling guard', zone: 'Mud Pit / Sack Room', role: 'Mechanic', activity: 'checking agitator gearbox oil and vibration' },
  { item: 'Barite bulk surge tank pressure relief valve and vent line', zone: 'Mud Pit / Sack Room', role: 'Floorman', activity: 'transferring dry bulk barite to weighting hopper' },
  { item: 'Caustic soda mixing barrel stainless-steel lid and dosing valve', zone: 'Mud Pit / Sack Room', role: 'Floorman', activity: 'preparing alkaline pH control treatment' },
  { item: 'Mud pump #2 fluid-end 5,000 psi pulsation dampener pre-charge gauge', zone: 'Mud Pit / Sack Room', role: 'Mechanic', activity: 'changing high-pressure mud pump ceramic liner' },
  { item: 'Sack room pallet shrink-wrap station and manual scissor lift table', zone: 'Mud Pit / Sack Room', role: 'Roustabout', activity: 'restacking 25-kg calcium carbonate sacks' },
  { item: 'Trip tank ultrasonic radar level sensor and calibration sight strip', zone: 'Mud Pit / Sack Room', role: 'Assistant Driller', activity: 'monitoring hole fill volumes during pipe trip' },
  { item: 'Mud pump room industrial ventilation bug-blower grounding bond strap', zone: 'Mud Pit / Sack Room', role: 'Electrician', activity: 'verifying hazardous area fan earthing continuity' },

  // Accommodations (6)
  { item: 'Galley walk-in freezer internal glow-in-the-dark panic release latch', zone: 'Accommodations', role: 'HSE Specialist', activity: 'conducting weekly camp safety and hygiene audit' },
  { item: 'Radio room GMDSS distress console 24V battery backup charger', zone: 'Accommodations', role: 'Electrician', activity: 'verifying emergency marine communication power' },
  { item: 'Helideck perimeter safety netting and foam monitor pop-up nozzles', zone: 'Accommodations', role: 'Rig Safety Coach (RSC)', activity: 'completing pre-arrival helicopter deck inspection' },
  { item: 'Accommodation stairwell self-closing A-60 fire door magnetic holdbacks', zone: 'Accommodations', role: 'Mechanic', activity: 'testing fire damper and door closure seals' },
  { item: 'Rig clinic automated external defibrillator (AED) and oxygen cylinder', zone: 'Accommodations', role: 'HSE Specialist', activity: 'auditing medical emergency response equipment' },
  { item: 'Camp laundry room industrial dryer lint trap and high-temp cutout', zone: 'Accommodations', role: 'Electrician', activity: 'preventing thermal buildup in utility laundry' }
];

// In-memory runtime state for prompt history blacklist backed by Firestore Database
let inMemoryBlacklist: string[] = [];
const MAX_BLACKLIST_CAPACITY = 10000;

export function getStoredPromptBlacklist(): string[] {
  return inMemoryBlacklist;
}

export function savePromptBlacklist(items: string[], appendOnly = false): void {
  const trimmed = Array.from(new Set(items.map(s => String(s).trim()).filter(Boolean))).slice(0, MAX_BLACKLIST_CAPACITY);
  inMemoryBlacklist = trimmed;
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('rig50_blacklist_updated', { detail: trimmed }));
    } catch {}
  }

  try {
    fetch('/api/blacklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blacklist: trimmed, append: appendOnly })
    }).catch(() => {});
  } catch {}

  try {
    savePromptBlacklistToFirestore(trimmed).catch(() => {});
  } catch {}
}

export function addToPromptBlacklist(newItems: string | string[]): string[] {
  const current = getStoredPromptBlacklist();
  const additions = (Array.isArray(newItems) ? newItems : [newItems])
    .map(s => String(s).trim())
    .filter(Boolean);
  if (additions.length === 0) return current;

  const combined = Array.from(new Set([...additions, ...current])).slice(0, MAX_BLACKLIST_CAPACITY);
  savePromptBlacklist(combined, true);
  return combined;
}

export async function syncPromptBlacklistWithStorage(): Promise<string[]> {
  let combined = [...inMemoryBlacklist];

  try {
    const res = await fetch('/api/blacklist');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.blacklist) && data.blacklist.length > 0) {
        combined = Array.from(new Set([...data.blacklist, ...combined])).slice(0, MAX_BLACKLIST_CAPACITY);
      }
    }
  } catch {}

  try {
    const fsList = await getPromptBlacklistFromFirestore();
    if (Array.isArray(fsList) && fsList.length > 0) {
      combined = Array.from(new Set([...combined, ...fsList])).slice(0, MAX_BLACKLIST_CAPACITY);
    }
  } catch {}

  inMemoryBlacklist = combined;
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('rig50_blacklist_updated', { detail: combined }));
    } catch {}
  }
  return combined;
}

export function clearPromptBlacklist(): void {
  inMemoryBlacklist = [];
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('rig50_blacklist_updated', { detail: [] }));
    } catch {}
  }
  try {
    fetch('/api/blacklist', { method: 'DELETE' }).catch(() => {});
  } catch {}
  try {
    savePromptBlacklistToFirestore([]).catch(() => {});
  } catch {}
}

/**
 * Strips numbers, tags, and punctuation to extract a normalized semantic core for collision checks
 */
function normalizeSemanticCore(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\([^)]*#[a-z0-9-]+[^)]*\)/gi, '')
    .replace(/#[a-z0-9-]+/gi, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks whether a full observation matches or closely collides with any entry in the blacklist.
 */
export function isContentBlacklisted(text: string, blacklist: string[]): boolean {
  if (!blacklist || blacklist.length === 0 || !text) return false;
  const lowerText = text.toLowerCase().trim();
  if (lowerText.length < 10) return false;
  const normText = normalizeSemanticCore(text);

  return blacklist.some(b => {
    if (!b) return false;
    const lowerB = b.toLowerCase().trim();
    if (lowerB.length < 15) return false;
    if (lowerText === lowerB || (lowerB.length > 45 && lowerText.includes(lowerB))) {
      return true;
    }
    const normB = normalizeSemanticCore(b);
    if (normB.length > 50 && normText === normB) {
      return true;
    }
    return false;
  });
}

export function generateUniqueSeed(iteration: number, baseSeed?: string): string {
  const base = baseSeed || `rig50_${Date.now()}`;
  return `${base}_iter_${iteration}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getUniqueIterationContext(
  iteration: number,
  seed: string,
  category: CardCategoryType,
  theme: string
): string {
  const eq = RIG_50_EQUIPMENT[iteration % RIG_50_EQUIPMENT.length];
  const role = RIG_50_ROLES[(iteration * 7) % RIG_50_ROLES.length];
  const shift = iteration % 2 === 0 ? 'Day Shift (06:00 - 18:00)' : 'Night Shift (18:00 - 06:00)';
  const weather = iteration % 3 === 0 ? '22-knot gusting winds, 1.8m swell' : 'Calm sea state, clear visibility';

  return `Iteration #${iteration + 1} | Seed: [${seed}] | Zone: ${eq.zone} | Role: ${role} | Target Equipment: ${eq.item} | Activity: ${eq.activity} | Shift: ${shift} | Marine Conditions: ${weather} | Category Focus: ${category} | Theme: ${theme}`;
}

interface ScenarioCore {
  key: string;
  buildObs: (eq: string, role: string, zone: string, activity: string, openerIdx: number) => string;
  buildAct: (eq: string, role: string, zone: string, actIdx: number) => string;
}

// 32 Varied Sentence Openers so cards never cluster alphabetically in PowerBI
const SAFE_CONDITION_OPENERS = [
  (eq: string, zone: string, activity: string) => `Inspected ${eq} in ${zone} prior to ${activity}`,
  (eq: string, zone: string, activity: string) => `Audited physical barrier integrity on ${eq} in ${zone} during ${activity}`,
  (eq: string, zone: string, activity: string) => `Verified mechanical readiness of ${eq} across ${zone} ahead of ${activity}`,
  (eq: string, zone: string, activity: string) => `Spot-checked ${eq} in ${zone} while preparing for ${activity}`,
  (eq: string, zone: string, activity: string) => `Walked down ${zone} to examine ${eq} during ${activity}`,
  (eq: string, zone: string, activity: string) => `Cross-checked isolation and containment on ${eq} in ${zone} for ${activity}`,
  (eq: string, zone: string, activity: string) => `Evaluated equipment condition of ${eq} in ${zone} throughout ${activity}`,
  (eq: string, zone: string, activity: string) => `Reviewed primary and secondary safeguards on ${eq} in ${zone} during ${activity}`,
  (eq: string, zone: string, activity: string) => `Confirmed full hardware compliance on ${eq} in ${zone} before ${activity}`,
  (eq: string, zone: string, activity: string) => `Examined structural mountings and fittings on ${eq} in ${zone} during ${activity}`,
  (eq: string, zone: string, activity: string) => `Completed a pre-task hardware check on ${eq} in ${zone} ahead of ${activity}`,
  (eq: string, zone: string, activity: string) => `Assessed protective guarding and tags on ${eq} in ${zone} during ${activity}`,
  (eq: string, zone: string, activity: string) => `Surveyed ${zone} around ${eq} while crew staged for ${activity}`,
  (eq: string, zone: string, activity: string) => `Validated pressure and mechanical seals on ${eq} in ${zone} during ${activity}`,
  (eq: string, zone: string, activity: string) => `Monitored operating condition of ${eq} in ${zone} throughout ${activity}`,
  (eq: string, zone: string, activity: string) => `Tested safety interlocks and physical barriers on ${eq} in ${zone} prior to ${activity}`
];

const SAFE_BEHAVIOR_OPENERS = [
  (role: string, eq: string, zone: string, activity: string) => `Witnessed ${role} in ${zone} demonstrating disciplined safe work habits around ${eq} during ${activity}`,
  (role: string, eq: string, zone: string, activity: string) => `Noticed ${role} proactively verifying team positioning near ${eq} in ${zone} ahead of ${activity}`,
  (role: string, eq: string, zone: string, activity: string) => `Saw ${role} in ${zone} coaching a fellow crew member on safe handling of ${eq} during ${activity}`,
  (role: string, eq: string, zone: string, activity: string) => `In ${zone}, ${role} maintained strict procedural focus while operating ${eq} for ${activity}`,
  (role: string, eq: string, zone: string, activity: string) => `Throughout ${activity} in ${zone}, ${role} upheld exemplary safety standards around ${eq}`,
  (role: string, eq: string, zone: string, activity: string) => `Prior to starting ${activity} in ${zone}, ${role} led a focused step-back review at ${eq}`,
  (role: string, eq: string, zone: string, activity: string) => `Monitored ${role} executing ${activity} in ${zone} with 100% adherence to barrier rules on ${eq}`,
  (role: string, eq: string, zone: string, activity: string) => `Recognized ${role} in ${zone} for methodical two-step verification on ${eq} during ${activity}`,
  (role: string, eq: string, zone: string, activity: string) => `While ${activity} was underway in ${zone}, ${role} kept clear visual and radio coordination around ${eq}`,
  (role: string, eq: string, zone: string, activity: string) => `Alongside ${eq} in ${zone}, ${role} modeled hands-free and line-of-fire discipline during ${activity}`,
  (role: string, eq: string, zone: string, activity: string) => `At ${zone}, ${role} paused before engaging ${eq} to confirm all crew were clear for ${activity}`,
  (role: string, eq: string, zone: string, activity: string) => `Tracked ${activity} in ${zone} where ${role} systematically applied Aramco Golden Rules at ${eq}`,
  (role: string, eq: string, zone: string, activity: string) => `Observed ${role} in ${zone} taking ownership of workspace safety around ${eq} during ${activity}`,
  (role: string, eq: string, zone: string, activity: string) => `During ${activity} in ${zone}, ${role} verified every team member's standoff distance from ${eq}`,
  (role: string, eq: string, zone: string, activity: string) => `Near ${eq} in ${zone}, ${role} demonstrated strong situational awareness while performing ${activity}`,
  (role: string, eq: string, zone: string, activity: string) => `Confirmed ${role} in ${zone} followed every step of the Job Safety Analysis on ${eq} during ${activity}`
];

// 32 Distinct Safe Condition Findings (Never repeated within the same batch)
const SAFE_CONDITION_FINDINGS: Array<{
  key: string;
  finding: string;
  action: (role: string, eq: string, zone: string) => string;
}> = [
  {
    key: 'cnd_whipcheck',
    finding: 'confirming all high-pressure hose couplings had corrosion-free 316-SS whip-check restraints and safety R-clips fully engaged',
    action: (role, eq) => `Verified coupling torque with ${role} and recorded positive pressure-restraint integrity on ${eq} in the shift handover log.`
  },
  {
    key: 'cnd_drops_mouse',
    finding: 'verifying every overhead shackle pin was secured with stainless-steel mousing wire and secondary retention lanyards were taut',
    action: (role, eq, zone) => `Updated the ${zone} DROPS inspection register alongside ${role} and confirmed zero loose overhead fittings on ${eq}.`
  },
  {
    key: 'cnd_loto_isolation',
    finding: 'confirming electrical and mechanical isolation padlocks were properly applied at the local disconnect with a verified zero-energy try-step',
    action: (role, eq) => `Cross-checked the isolation certificate with ${role} and confirmed ${eq} remained safely de-energized prior to maintenance.`
  },
  {
    key: 'cnd_grating_jbolts',
    finding: 'finding all galvanized deck grating panels flush, level, and fastened with tight stainless-steel J-bolts and unobstructed scupper drains',
    action: (role, _eq, zone) => `Acknowledged ${role} for maintaining slip-free access walkways in ${zone} and noted 100% grating security.`
  },
  {
    key: 'cnd_lifting_color_code',
    finding: 'confirming the current quarterly inspection color code, legible SWL stamping, and unfrayed wire rope terminations on all rigging gear',
    action: (role, eq) => `Reviewed the lifting gear register with ${role} and cleared ${eq} for scheduled offshore hoisting operations.`
  },
  {
    key: 'cnd_hydraulic_dry',
    finding: 'verifying all hydraulic quick-disconnect manifolds, crimp ferrules, and return lines were bone-dry with zero weeping under operating load',
    action: (role, eq) => `Signed off the hydraulic integrity check with ${role} and confirmed drip containment trays beneath ${eq} were clean and dry.`
  },
  {
    key: 'cnd_ex_glands',
    finding: 'confirming explosion-proof Ex-d cable glands, copper bonding straps, and junction box flameproof seals were intact and moisture-free',
    action: (role, eq) => `Logged positive hazardous-area electrical verification on ${eq} with ${role} in the preventive maintenance system.`
  },
  {
    key: 'cnd_barrier_chains',
    finding: 'verifying that red-zone boundary chains, magnetic warning placards, and physical interlock gates were latched and highly visible',
    action: (role, _eq, zone) => `Commended ${role} for keeping restricted access boundaries in ${zone} clearly demarcated before equipment startup.`
  },
  {
    key: 'cnd_estop_shroud',
    finding: 'confirming the local emergency stop protective shroud was undamaged, the mushroom actuator moved freely, and warning labels were clean',
    action: (role, eq) => `Completed the pre-startup safety interlock check with ${role} and verified instant emergency shutdown readiness on ${eq}.`
  },
  {
    key: 'cnd_shaft_guard',
    finding: 'verifying the yellow protective mesh guarding around rotating couplings was firmly bolted with zero rub marks or missing fasteners',
    action: (role, eq) => `Confirmed 100% pinch-point guarding compliance on ${eq} with ${role} prior to energizing the drive motor.`
  },
  {
    key: 'cnd_gauge_calibration',
    finding: 'confirming analog and digital pressure transmitters displayed steady readings within green operating bands with valid calibration stickers',
    action: (role, eq) => `Cross-verified baseline pressure readings on ${eq} with ${role} and documented instrument readiness for the shift.`
  },
  {
    key: 'cnd_cable_ramps',
    finding: 'confirming all temporary power and air hoses crossing pedestrian routes were recessed inside heavy-duty yellow rubber crossover ramps',
    action: (role, _eq, zone) => `Thanked ${role} for eliminating trip hazards across ${zone} walkways and keeping emergency escape routes clear.`
  },
  {
    key: 'cnd_fall_arrest_reel',
    finding: 'verifying twin self-retracting inertia reels locked sharply on pull-test, swivel eyes rotated smoothly, and anchor straps showed zero UV wear',
    action: (role, eq) => `Confirmed working-at-height anchor certification on ${eq} with ${role} before authorizing elevated task access.`
  },
  {
    key: 'cnd_spill_kit',
    finding: 'confirming the nearby environmental spill response station was fully stocked with hydrophobic absorbent pads, booms, and disposal bags',
    action: (role, _eq, zone) => `Verified zero deck contamination in ${zone} with ${role} and confirmed secondary containment bunds were plugged.`
  },
  {
    key: 'cnd_gas_detector',
    finding: 'verifying fixed and portable multi-gas monitors registered 0 ppm H2S and 0% LEL with clear acoustic and visual strobe annunciators',
    action: (role, eq, zone) => `Recorded atmospheric safety verification around ${eq} in ${zone} with ${role} prior to breaking containment.`
  },
  {
    key: 'cnd_deadman_return',
    finding: 'confirming the pneumatic deadman throttle lever snapped back to neutral immediately upon release and the brake band held load without creep',
    action: (role, eq) => `Tested brake holding capacity with ${role} and approved ${eq} for utility hoisting operations.`
  },
  {
    key: 'cnd_relief_valve',
    finding: 'verifying the pressure relief valve lead seal was intact, the discharge piping was anchored, and the reset pin cover was pinned',
    action: (role, eq) => `Confirmed over-pressure protection compliance on ${eq} with ${role} ahead of high-pressure pumping.`
  },
  {
    key: 'cnd_coshh_placard',
    finding: 'confirming MSDS safety data sheets, NFPA hazard diamonds, and secondary chemical drip trays were properly positioned at the work point',
    action: (role, _eq, zone) => `Reviewed chemical handling barrier readiness in ${zone} with ${role} and confirmed eyewash bottle expiry dates.`
  },
  {
    key: 'cnd_grease_manifold',
    finding: 'confirming centralized grease distribution lines and bearing purge fittings were well-lubricated with zero fitting blockages or chaffing',
    action: (role, eq) => `Logged mechanical lubrication check on ${eq} with ${role}, ensuring smooth low-friction operation throughout the shift.`
  },
  {
    key: 'cnd_floodlight_glare',
    finding: 'confirming high-output LED task lighting was angled to eliminate shadow blind spots on the operator walkway and secured with backup wire',
    action: (role, eq, zone) => `Verified optimal night-shift visibility around ${eq} in ${zone} with ${role} before commencing operations.`
  },
  {
    key: 'cnd_chocks_stanchions',
    finding: 'verifying steel safety stanchions were locked in their deck sockets and hardwood timber wedges were tightly chocked against the outer tier',
    action: (role, eq) => `Confirmed zero roll potential on ${eq} with ${role} and verified clear walkway separation along the rack perimeter.`
  },
  {
    key: 'cnd_fire_extinguisher',
    finding: 'verifying the adjacent dry-chemical and CO2 fire extinguishers had green pressure needles, intact tamper seals, and clear access paths',
    action: (role, _eq, zone) => `Completed fire safety spot-check in ${zone} with ${role} and confirmed hot-work standby readiness.`
  },
  {
    key: 'cnd_limit_switch',
    finding: 'confirming upper and lower travel limit switches actuated cleanly on test and immediately cut drive power as designed',
    action: (role, eq) => `Signed off electrical interlock verification on ${eq} with ${role} prior to automated cycle operations.`
  },
  {
    key: 'cnd_handrail_toeboard',
    finding: 'confirming all perimeter handrails, mid-rails, and 6-inch steel toe-boards around the elevated access platform were rigid and corrosion-free',
    action: (role, eq, zone) => `Verified fall-prevention barrier integrity around ${eq} in ${zone} with ${role} during the shift walkdown.`
  },
  {
    key: 'cnd_Nitrogen_charge',
    finding: 'confirming accumulator nitrogen pre-charge pressures matched OEM specification across all bottles with isolation valves locked in the open position',
    action: (role, eq) => `Recorded bottle bank pressures on ${eq} with ${role} and confirmed instant emergency closing readiness.`
  },
  {
    key: 'cnd_air_isolation',
    finding: 'confirming pneumatic supply headers had functioning moisture traps, regulated 110 psi air pressure, and quarter-turn bleed valves',
    action: (role, eq) => `Verified pneumatic actuator reliability on ${eq} with ${role} before starting the operational sequence.`
  },
  {
    key: 'cnd_tool_tethers',
    finding: 'confirming all hand wrenches, callipers, and portable instruments staged at the work platform were fitted with certified wrist lanyards',
    action: (role, eq, zone) => `Commended ${role} for 100% tool-at-height tethering discipline around ${eq} in ${zone}.`
  },
  {
    key: 'cnd_deck_non_slip',
    finding: 'confirming the anti-skid deck coating around the operator work stance was clean, free of grease film, and high-visibility yellow edging was bright',
    action: (role, eq, zone) => `Acknowledged ${role} for maintaining clean, high-traction footing around ${eq} in ${zone}.`
  },
  {
    key: 'cnd_flange_spade',
    finding: 'confirming positive mechanical blinding spades and spiral-wound gaskets were properly torqued with rated stud bolts on the isolated spool',
    action: (role, eq) => `Verified positive line isolation on ${eq} with ${role} against the piping & instrumentation diagram.`
  },
  {
    key: 'cnd_tagline_condition',
    finding: 'confirming knot-free, dry polypropylene taglines of 15-foot length were staged on dedicated hooks with anti-tangle swivels',
    action: (role, eq) => `Verified hands-free load guidance readiness on ${eq} with ${role} prior to hoisting.`
  }
];

// 32 Distinct Safe Behavior Scenarios (Never repeated within the same batch)
const SAFE_BEHAVIOR_SCENARIOS: Array<{
  key: string;
  behavior: string;
  action: (role: string, eq: string, zone: string) => string;
}> = [
  {
    key: 'bhv_push_pole',
    behavior: 'using a 42-inch magnetic push-pull pole to guide suspended equipment into alignment while keeping both hands completely out of the pinch zone',
    action: (role, eq, zone) => `Commended ${role} on-the-spot for strict hands-free tool discipline around ${eq} in ${zone} and shared the example at the toolbox talk.`
  },
  {
    key: 'bhv_red_zone_pause',
    behavior: 'halting outside the painted red-zone boundary and waiting for the operator to set the mechanical brake and give a clear thumbs-up before approaching',
    action: (role, eq) => `Recognized ${role} for disciplined red-zone access protocol around ${eq} and reinforced positive eye-contact communication.`
  },
  {
    key: 'bhv_twin_lanyard',
    behavior: 'maintaining 100% continuous tie-off by clipping the secondary shock-absorbing lanyard to a rated anchor point before unclipping the primary hook',
    action: (role, _eq, zone) => `Praised ${role} for zero-compromise working-at-height compliance in ${zone} during the shift safety round.`
  },
  {
    key: 'bhv_loto_trystep',
    behavior: 'personally applying an individual red LOTO padlock to the multi-hasp and testing the local start switch to confirm zero residual energy before opening the guard',
    action: (role, eq) => `Acknowledged ${role}'s rigorous adherence to Aramco Lockout/Tagout verification steps on ${eq}.`
  },
  {
    key: 'bhv_chemical_ppe',
    behavior: 'donning a full-face chemical splash shield, heavy-duty neoprene gauntlets, and apron before opening the dosing valve',
    action: (role, _eq, zone) => `Thanked ${role} for setting a strong personal protective equipment standard during chemical handling in ${zone}.`
  },
  {
    key: 'bhv_banksman_signals',
    behavior: 'standing in an unobstructed vantage point wearing a high-visibility banksman vest and delivering crisp API hand signals backed by clear UHF radio callouts',
    action: (role, eq) => `Commended ${role} and the lifting team for seamless communication and load control around ${eq}.`
  },
  {
    key: 'bhv_peer_mentoring',
    behavior: 'walking a newly arrived crew member through the specific pinch-point hazards, emergency escape route, and isolation valves before starting the task',
    action: (role, eq, zone) => `Recognized ${role} for active brother's-keeper mentoring around ${eq} in ${zone}.`
  },
  {
    key: 'bhv_stepback_5x5',
    behavior: 'conducting a deliberate 5x5 Step-Back assessment with the work party to reposition hoses and clear footing before applying hydraulic torque',
    action: (role, eq) => `Highlighted ${role}'s proactive pre-task hazard assessment on ${eq} during the shift handover meeting.`
  },
  {
    key: 'bhv_ergonomic_team_lift',
    behavior: 'coordinating a synchronized two-person lift with bent knees, straight back, and clear verbal count before moving a heavy valve sub',
    action: (role, _eq, zone) => `Praised ${role} and partner for applying safe manual handling ergonomics in ${zone}.`
  },
  {
    key: 'bhv_three_point_contact',
    behavior: 'carrying small parts in a shoulder-slung canvas tool pouch so both hands remained free to maintain three-point contact on the steep access stairs',
    action: (role, _eq, zone) => `Commended ${role} for practical fall-prevention habits while transiting ${zone} ladders and stairways.`
  },
  {
    key: 'bhv_line_of_fire_stance',
    behavior: 'repositioning body stance 90 degrees out of the potential recoil path before cracking open the bleed-off valve to vent trapped pressure',
    action: (role, eq) => `Acknowledged ${role} for textbook line-of-fire awareness while depressurizing ${eq}.`
  },
  {
    key: 'bhv_clean_as_you_go',
    behavior: 'immediately wiping down a minor lubricant drip with an absorbent pad and coiling washdown hoses onto their bulkhead rack upon completing the check',
    action: (role, eq, zone) => `Thanked ${role} for immediate clean-as-you-go housekeeping around ${eq} in ${zone}.`
  },
  {
    key: 'bhv_double_hearing',
    behavior: 'wearing molded foam earplugs beneath hard-hat mounted earmuffs prior to entering the high-decibel machinery enclosure',
    action: (role, _eq, zone) => `Recognized ${role} for 100% dual hearing protection compliance in ${zone}.`
  },
  {
    key: 'bhv_ptw_cross_check',
    behavior: 'reviewing every gas-test signature and mechanical isolation line item on the Permit to Work at the job site before picking up any tools',
    action: (role, eq) => `Commended ${role} for thorough on-site Permit to Work verification at ${eq}.`
  },
  {
    key: 'bhv_tagline_standoff',
    behavior: 'holding the unknotted tail of the guide tagline at a safe 12-foot standoff distance while controlling load swing over the deck curbing',
    action: (role, eq) => `Praised ${role} for maintaining safe tagline geometry and never wrapping the rope around hands near ${eq}.`
  },
  {
    key: 'bhv_hydration_break',
    behavior: 'organizing a scheduled 10-minute shaded water and electrolyte break for the deck team and checking each worker for heat fatigue signs',
    action: (role, _eq, zone) => `Acknowledged ${role}'s proactive heat-stress management across ${zone} during peak ambient temperatures.`
  },
  {
    key: 'bhv_grinding_faceshield',
    behavior: 'wearing impact-rated safety spectacles under a full polycarbonate face shield and deploying spark-containment curtains before dressing a weld seam',
    action: (role, eq, zone) => `Commended ${role} for dual eye protection and hot-work spark containment near ${eq} in ${zone}.`
  },
  {
    key: 'bhv_pre_use_harness_inspect',
    behavior: 'laying out the full-body harness to inspect dorsal D-ring stitching, buckle engagement, and shock-pack indicator tabs before donning',
    action: (role, eq) => `Recognized ${role} for meticulous pre-use fall protection inspection prior to ascending ${eq}.`
  },
  {
    key: 'bhv_forklift_eye_contact',
    behavior: 'stopping at the pedestrian walkway barrier and waiting for the mobile plant operator to lower the forks and wave acknowledgment before crossing',
    action: (role, _eq, zone) => `Praised ${role} for disciplined pedestrian-to-machine interaction in ${zone}.`
  },
  {
    key: 'bhv_thread_protector_latch',
    behavior: 'verifying the cast-steel thread protector was threaded tight and the lifting bail latch clicked shut before signaling the hoist operator',
    action: (role, eq) => `Commended ${role} for preventing dropped-object hazards during tubular handling at ${eq}.`
  },
  {
    key: 'bhv_static_bonding',
    behavior: 'clamping the braided copper grounding lead to bare metal on the receiving skid and verifying continuity before opening the transfer valve',
    action: (role, eq) => `Acknowledged ${role} for strict static-electricity bonding discipline on ${eq}.`
  },
  {
    key: 'bhv_handover_walkdown',
    behavior: 'conducting a face-to-face physical walkdown of all active valves, pressure gauges, and ongoing permits with the incoming relief',
    action: (role, eq, zone) => `Commended ${role} for thorough operational shift handover around ${eq} in ${zone}.`
  },
  {
    key: 'bhv_dropped_tool_pouch',
    behavior: 'securing overhead bolts inside a zippered canvas bolt bag clipped to the guardrail rather than resting hardware on the grating toe-board',
    action: (role, eq) => `Thanked ${role} for proactive DROPS prevention while servicing ${eq}.`
  },
  {
    key: 'bhv_impact_gloves_donned',
    behavior: 'wearing Level-5 cut-resistant dorsal impact gloves throughout the entire rigging and dismantling sequence',
    action: (role, eq, zone) => `Recognized ${role} for consistent hand-injury prevention while working on ${eq} in ${zone}.`
  }
];

// 32 Distinct Unsafe / STOP Work Authority (SWA) Interventions (Never repeated within the same batch)
const SWA_INTERVENTION_SCENARIOS: Array<{
  key: string;
  obs: (eq: string, role: string, zone: string, activity: string) => string;
  act: (eq: string, role: string, zone: string) => string;
}> = [
  {
    key: 'swa_red_zone_entry',
    obs: (eq, role, zone, activity) => `While ${eq} was cycling during ${activity} in ${zone}, observed ${role} step past the yellow warning chain toward the moving assembly without prior operator lock-out.`,
    act: (eq, role, zone) => `Exercised immediate Stop Work Authority (SWA) to freeze ${eq}, escorted ${role} back to the safe green walkway in ${zone}, and re-verified red-zone entry sign-in rules before resuming.`
  },
  {
    key: 'swa_pinch_point_hand',
    obs: (eq, role, zone, activity) => `During ${activity} in ${zone}, noticed ${role} reaching with a gloved hand to steady a swinging component on ${eq} instead of using the staged push-pull stick.`,
    act: (eq, role) => `Called an immediate SWA halt, lowered ${eq} to a neutral rest position, handed ${role} a 42-inch magnetic guide pole, and reinforced Rig 50 hands-free policy.`
  },
  {
    key: 'swa_missing_whipcheck',
    obs: (eq, role, zone, activity) => `Prior to pressuring up ${eq} for ${activity} in ${zone}, discovered one high-pressure supply coupling lacked its secondary wire-rope whip-check restraint.`,
    act: (eq, role) => `Initiated Stop Work Authority (SWA) before the pump clutch was engaged, bled line pressure to zero with ${role}, and installed a certified 316-SS whip-check across ${eq}.`
  },
  {
    key: 'swa_suspended_load_shadow',
    obs: (eq, role, zone, activity) => `Observed ${role} walking beneath the swing path of a hoisted sub near ${eq} in ${zone} while the crew was ${activity}.`,
    act: (eq, role, zone) => `Sounded air-horn SWA signal to stop hoisting immediately, directed ${role} outside the drop zone in ${zone}, and installed extendable red-and-white barrier cones around ${eq}.`
  },
  {
    key: 'swa_hydraulic_weeping',
    obs: (eq, role, zone, activity) => `While inspecting ${zone} during ${activity}, spotted active hydraulic oil mist weeping from a flared JIC fitting on ${eq}.`,
    act: (eq, role) => `Invoked SWA to shut down the hydraulic power pack, isolated and depressurized the circuit with ${role}, replaced the damaged O-ring seal on ${eq}, and cleaned the deck.`
  },
  {
    key: 'swa_frayed_tagline',
    obs: (eq, role, zone, activity) => `During rigging preparation on ${eq} in ${zone} (${activity}), noticed ${role} attaching a tagline that had a figure-eight knot and frayed strands near the clip.`,
    act: (eq, role) => `Stopped the lift under SWA, removed and quarantined the knotted tagline, and issued ${role} a brand-new knot-free polypropylene tagline for ${eq}.`
  },
  {
    key: 'swa_unsecured_grating',
    obs: (eq, _role, zone, activity) => `While walking down ${zone} ahead of ${activity}, felt a steel walkway grating panel adjacent to ${eq} shift slightly underfoot due to two missing J-bolt clips.`,
    act: (eq, role, zone) => `Called SWA and cordoned off the ${zone} access path with ${role}, installed four new stainless-steel saddle clips on the grating beside ${eq}, and verified zero movement.`
  },
  {
    key: 'swa_radio_break_blind_lift',
    obs: (eq, role, zone, activity) => `During ${activity} in ${zone}, UHF radio communication between ${role} and the operator at ${eq} became garbled with static while the load was in a blind spot.`,
    act: (eq, role) => `Executed immediate Stop Work Authority (SWA) to hold ${eq} stationary, swapped ${role}'s handset for a fully charged unit on backup channel 3, and stationed a dedicated flagman.`
  },
  {
    key: 'swa_untethered_wrench',
    obs: (eq, role, zone, activity) => `Observed ${role} working at an elevated platform on ${eq} in ${zone} during ${activity} using a 24-mm spanner that was not clipped to a wrist lanyard.`,
    act: (eq, role, zone) => `Paused the task under SWA, cleared the lower deck perimeter in ${zone}, and fitted a certified retractable tool lanyard to ${role}'s wrench before work on ${eq} continued.`
  },
  {
    key: 'swa_cable_across_walkway',
    obs: (eq, _role, zone, activity) => `Found an energized 440V welding lead laid directly across the wet steel walkway beside ${eq} in ${zone} during ${activity} without protective cable bridges.`,
    act: (eq, role, zone) => `Halted foot traffic under SWA, worked with ${role} to elevate the cable onto overhead S-hooks in ${zone}, and placed heavy-duty rubber ramps at the crossing near ${eq}.`
  },
  {
    key: 'swa_missing_faceshield',
    obs: (eq, role, zone, activity) => `Observed ${role} preparing to wire-brush rust scale off ${eq} in ${zone} (${activity}) wearing safety glasses alone without a full-face impact shield.`,
    act: (eq, role) => `Intervened immediately with SWA before the tool was triggered, provided ${role} with an Aramco-approved polycarbonate face shield, and verified double eye protection at ${eq}.`
  },
  {
    key: 'swa_wind_gust_limit',
    obs: (eq, role, zone, activity) => `While ${role} was ${activity} at ${eq} in ${zone}, sudden 26-knot wind gusts caused the load to oscillate near adjacent piping.`,
    act: (eq, role) => `Invoked Stop Work Authority (SWA) to land and secure the load at ${eq} with ${role}, suspending hoisting until wind speed dropped below the 20-knot operational limit.`
  },
  {
    key: 'swa_unmoused_shackle',
    obs: (eq, role, zone, activity) => `During a pre-task check of ${eq} in ${zone} for ${activity}, spotted an overhead anchor shackle pin that lacked its secondary cotter pin and mousing wire.`,
    act: (eq, role) => `Stopped operations under SWA, lowered the assembly with ${role}, inserted a stainless split cotter pin, and double-moused the shackle on ${eq} with 316-SS wire.`
  },
  {
    key: 'swa_slippery_mud_spill',
    obs: (eq, role, zone, activity) => `Noticed a patch of slick oil-based drilling fluid on the diamond-plate steps leading up to ${eq} in ${zone} while crew were ${activity}.`,
    act: (eq, role, zone) => `Called SWA to block stair access in ${zone}, applied biodegradable citrus degreaser and absorbent pads with ${role}, and scrubbed the steps at ${eq} down to bare anti-slip metal.`
  },
  {
    key: 'swa_loto_key_in_lock',
    obs: (eq, role, zone, activity) => `While verifying isolation on ${eq} in ${zone} prior to ${activity}, found the personal LOTO padlock key had been left inserted in the lock cylinder at the local isolator.`,
    act: (eq, role) => `Paused maintenance start under SWA, removed and handed the unique padlock key to ${role}, and re-verified the lockbox register for ${eq} before authorizing entry.`
  },
  {
    key: 'swa_expired_sling_tag',
    obs: (eq, role, zone, activity) => `Observed ${role} staging a synthetic web sling at ${eq} in ${zone} for ${activity} that still carried last quarter's inspection color tag.`,
    act: (eq, role) => `Exercised SWA to stop rigging up, removed the out-of-date sling to the quarantine locker, and provided ${role} with a current-quarter certified sling for ${eq}.`
  },
  {
    key: 'swa_uncapped_chemical_drum',
    obs: (eq, role, zone, activity) => `During ${activity} near ${eq} in ${zone}, found a 25-liter corrosion inhibitor drum left with its bung cap unthreaded and no secondary drip tray underneath.`,
    act: (eq, role, zone) => `Called SWA, donned nitrile gauntlets with ${role} to seal the drum cap tightly, placed it inside a bunded pallet in ${zone}, and verified MSDS posting near ${eq}.`
  },
  {
    key: 'swa_loose_guard_bolts',
    obs: (eq, role, zone, activity) => `While inspecting ${eq} in ${zone} during ${activity}, noticed two lower mounting bolts on the rotating coupling guard had backed out from vibration.`,
    act: (eq, role) => `Halted ${eq} immediately under SWA, locked out the drive motor with ${role}, installed new Nord-Lock washers and torqued all guard bolts before restarting.`
  },
  {
    key: 'swa_improper_gloves',
    obs: (eq, role, zone, activity) => `Observed ${role} approaching ${eq} in ${zone} to assist with ${activity} wearing thin cotton liner gloves instead of mandatory Level-5 impact gloves.`,
    act: (eq, role) => `Paused the task using Stop Work Authority (SWA), issued ${role} a pair of heavy-duty dorsal impact gloves, and reviewed hand pinch-point hazards around ${eq}.`
  },
  {
    key: 'swa_trapped_pressure_gauge',
    obs: (eq, role, zone, activity) => `Before ${role} began unbolting a flange on ${eq} in ${zone} (${activity}), noticed the upstream manifold gauge still indicated 180 psi of trapped residual pressure.`,
    act: (eq, role) => `Invoked immediate SWA before any stud was loosened, opened the needle bleed valve with ${role} to vent ${eq} to 0 psi, and verified zero flow at the tell-tale drain.`
  },
  {
    key: 'swa_forklift_blind_corner',
    obs: (eq, role, zone, activity) => `During ${activity} in ${zone}, observed ${role} guiding a pallet load near ${eq} without a spotter at a blind bulkhead corner.`,
    act: (eq, role, zone) => `Signaled an SWA stop, positioned a dedicated banksman with a high-visibility vest at the ${zone} corner, and cleared pedestrian traffic around ${eq} before moving.`
  },
  {
    key: 'swa_harness_leg_strap',
    obs: (eq, role, zone, activity) => `As ${role} prepared to clip into the fall-arrest reel on ${eq} in ${zone} for ${activity}, noticed one harness leg strap buckle was twisted and not fully seated.`,
    act: (eq, role) => `Called SWA before ascent began, helped ${role} step back onto the deck to untwist and click-lock both leg straps, and performed a buddy-check at ${eq}.`
  },
  {
    key: 'swa_unattended_open_hatch',
    obs: (eq, role, zone, activity) => `While auditing ${zone} during ${activity}, discovered an inspection floor hatch next to ${eq} left open for hose routing without a temporary rigid barricade frame.`,
    act: (eq, role, zone) => `Exercised SWA to halt work around ${eq}, erected a four-sided interlocking tubular safety barrier around the hatch with ${role}, and posted warning signs in ${zone}.`
  },
  {
    key: 'swa_chafed_air_hose',
    obs: (eq, role, zone, activity) => `During ${activity} in ${zone}, noticed the outer rubber jacket of the pneumatic supply hose feeding ${eq} was chafing against a sharp steel deck gusset.`,
    act: (eq, role) => `Stopped pneumatic tool operation under SWA, bled air pressure with ${role}, wrapped the contact point in heavy-duty split-hose chafing armor, and rerouted the line on ${eq}.`
  }
];

// 16 Distinct Stop Work Authority (SWA) Drill Scenarios
const SWA_DRILL_SCENARIOS: Array<{
  key: string;
  obs: (eq: string, role: string, zone: string, activity: string) => string;
  act: (eq: string, role: string, zone: string) => string;
}> = [
  {
    key: 'drill_red_zone_breach',
    obs: (eq, role, zone, activity) => `Initiated a planned Stop Work Authority (SWA) readiness drill in ${zone} during ${activity}, simulating an unauthorized deck entrant approaching ${eq} while in motion.`,
    act: (eq, role, zone) => `${role} and the ${zone} crew reacted in under 3 seconds, hitting the local stop and securing ${eq}; debriefed the successful SWA drill with the shift supervisor.`
  },
  {
    key: 'drill_radio_blackout',
    obs: (eq, role, zone, activity) => `Conducted an unannounced SWA communication loss drill with ${role} at ${eq} in ${zone} during ${activity} to test crew response to sudden radio failure.`,
    act: (eq, role) => `${role} immediately froze ${eq} using crossed-arm SWA hand signals and waited for visual spotter confirmation; commended rapid crew reaction.`
  },
  {
    key: 'drill_pressure_spike',
    obs: (eq, role, zone, activity) => `Executed a simulated high-pressure anomaly SWA drill on ${eq} in ${zone} while ${role} was ${activity} to evaluate emergency pump shutdown speed.`,
    act: (eq, role, zone) => `${role} called SWA, isolated the manifold on ${eq}, and mustered the ${zone} team at the safe boundary; logged 100% drill proficiency.`
  },
  {
    key: 'drill_dropped_object',
    obs: (eq, role, zone, activity) => `Ran a field Stop Work Authority (SWA) drill in ${zone} around ${eq} during ${activity}, simulating a loose overhead shackle pin spotted mid-task.`,
    act: (eq, role, zone) => `${role} halted all work beneath ${eq} immediately, cordoned off the ${zone} drop radius, and walked through the DROPS escalation protocol.`
  },
  {
    key: 'drill_gas_alarm_response',
    obs: (eq, role, zone, activity) => `Triggered a localized SWA gas-detection readiness exercise near ${eq} in ${zone} while ${role} was ${activity}.`,
    act: (eq, role, zone) => `${role} ceased operations on ${eq} instantly, verified wind-sock direction, and led the ${zone} work party to the upwind muster point.`
  },
  {
    key: 'drill_swell_load_shift',
    obs: (eq, role, zone, activity) => `Initiated a marine motion SWA drill with ${role} at ${eq} in ${zone} during ${activity}, simulating a sudden 2.5-meter beam swell affecting load stability.`,
    act: (eq, role) => `${role} exercised SWA without hesitation, set the load down in the designated safe bay at ${eq}, and reviewed dynamic sea-state limits.`
  },
  {
    key: 'drill_pinch_point_intervention',
    obs: (eq, role, zone, activity) => `Conducted a peer-to-peer SWA intervention drill in ${zone} during ${activity}, testing how quickly ${role} would stop a colleague reaching near ${eq}.`,
    act: (eq, role) => `${role} intervened vocally and physically signaled SWA within 2 seconds before hands neared ${eq}; reinforced strong brother's-keeper culture.`
  },
  {
    key: 'drill_loto_challenge',
    obs: (eq, role, zone, activity) => `Staged a Permit-to-Work and LOTO verification SWA drill on ${eq} in ${zone} prior to ${activity} with ${role}.`,
    act: (eq, role) => `${role} identified the simulated missing isolation signature and invoked SWA before touching ${eq}; praised attention to detail during debrief.`
  }
];

// Dynamic Combinatorial Dimensions to ensure over 500,000,000 unique non-repeating permutations
export const DYNAMIC_SHIFT_CONTEXTS = [
  'During 02:30 night shift casing run',
  'At 04:15 pre-dawn walkaround',
  'During 06:00 morning shift tour handover',
  'At 08:30 routine equipment walkdown',
  'During 10:45 high-pressure line test window',
  'At 12:15 midday marine deck cargo transfer',
  'During 14:00 hot work safety audit',
  'At 15:45 tripping pipe out of hole',
  'During 17:30 evening shift handover briefing',
  'At 19:20 night tour rotary table operations',
  'During 21:10 mud weight sample collection',
  'At 23:45 midnight BOP accumulator walkdown',
  'Ahead of scheduled drilling BHA makeup',
  'During 22-knot offshore wind weather lull',
  'During supply boat alongside cargo offload',
  'Prior to daily toolbox talk and JSA walkthrough',
  'During weekly rig-wide safety stand-down walkaround',
  'Following post-shift mechanical washdown',
  'During well control choke manifold functional test',
  'Ahead of high-angle directional drilling slide',
  'During cementing head rig-up on rig floor',
  'During wireline logging unit cable inspection',
  'During heavy tubular unloading from catwalk',
  'At scheduled preventive maintenance review'
];

export const DYNAMIC_MICRO_LOCATIONS = [
  'near the port catwalk v-door access',
  'beside the starboard choke manifold skid',
  'around the forward shale shaker trough',
  'at the mud pump #2 fluid-end manifold',
  'along the cellar deck hydraulic access walkway',
  'near the drill floor iron roughneck guide track',
  'beside the 90-ft monkeyboard diving board',
  'around the port pedestal crane foundation',
  'inside the main deck certified workshop bay',
  'along the starboard pipe rack designated walkway',
  'near the trip tank digital level transmitter',
  'around the BOP accumulator hydraulic pod bank',
  'beside the mud gas separator poor-boy degasser',
  'along the main deck chemical staging area',
  'near the rotary table red-zone physical interlock',
  'around the standby triplex pump discharge line',
  'near the helideck perimeter safety netting',
  'beside the emergency lifeboat embarkation station',
  'along the cantilever hydraulic skid rail',
  'near the shaker house atmospheric LEL sensor',
  'around the degasser suction butterfly valve',
  'beside the drawworks main braking drum',
  'along the cement unit high-pressure treating iron',
  'near the starboard survival craft davit arm'
];

export const DYNAMIC_SCRUTINY_ACTIONS = [
  'verified 100% mechanical torque with dual-check confirmation',
  'confirmed zero stored pressure and verified gauge bleed-off',
  'maintained a certified 42-inch hands-free push-pull standoff',
  'verified twin fall-arrest snap hooks locked into certified 5,000-lb anchor points',
  'conducted full challenge-and-response procedural walkdown',
  'audited 316-SS secondary whipcheck cable and safety R-clip retention',
  'verified 4-gas monitor calibrated and clipped within breathing zone',
  'enforced 100% red-zone exclusion perimeter while equipment was energized',
  'performed two-man coordinated lifting protocol with neutral spine posture',
  'verified positive mechanical Lockout/Tagout hasp and danger tag applied',
  'confirmed unobstructed emergency escape path and eyewash station readiness',
  'verified all handheld tools 100% tethered against dropped object hazards',
  'checked zero residual hydraulic oscillation on manifold snubber valve',
  'verified anti-slip deck traction and confirmed zero oil-mist contamination',
  'conducted step-back 20/20 situational awareness review before engaging',
  'held on-the-spot peer coaching on line-of-fire standoff distance'
];

// Expanded Humor & Comedy templates without robotic numbers
export const UNIQUE_HUMOR_TEMPLATES = [
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed the night-shift ${role} examining ${eq} in ${zone} during ${activity} with a flashlight and the forensic intensity of Sherlock Holmes inspecting a crime scene.`,
    act: `Safety Note: When offshore equipment is inspected with Olympic-level scrutiny, not even a microscopic grease smudge escapes notice. Verified 100% mechanical integrity on ${eq} in ${zone}.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} maintaining such a generous 15-foot clearance from ${eq} in ${zone} during ${activity} that the deck crew joked the machine had developed its own gravitational field.`,
    act: `Safety Note: Extreme line-of-fire standoff is always preferable to casual bravery. Commended ${role} for keeping well outside the swing radius around ${eq}.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} treating the pre-use check on ${eq} in ${zone} (${activity}) like a NASA Apollo launch countdown, complete with verbal point-and-call confirmations on every fastener.`,
    act: `Safety Note: Zero bolts were dropped and zero fingers were pinched. Applauded ${role}'s aerospace-grade checklist discipline on ${eq} during shift handover.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Watched ${role} in ${zone} wield a 42-inch push-pull safety stick around ${eq} during ${activity} with the precision of a fencing grandmaster keeping steel at bay.`,
    act: `Safety Note: Hands-free tools turn pinch-point avoidance into an art form. Recognized ${role} for keeping all ten fingers safely behind the guard hilt of ${eq}.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Noticed ${role} freeze outside the ${zone} red-zone chain near ${eq} during ${activity} so abruptly that a passing seagull looked impressed by the stopping distance.`,
    act: `Safety Note: Red-zone perimeter chains are non-negotiable boundaries on Rig 50. Commended ${role} for waiting until ${eq} was fully isolated.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} in ${zone} conducting a double ear-protection check before approaching ${eq} (${activity}) as if preparing to stand front-row at a heavy metal stadium concert.`,
    act: `Safety Note: High-decibel machinery is far less melodic than a guitar solo. Verified foam plugs and earmuffs were properly seated throughout ${zone} around ${eq}.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed the ${role} interrogating a slight gauge oscillation on ${eq} in ${zone} with more skepticism than a detective questioning a prime suspect.`,
    act: `Safety Note: Pressure gauges don't lie, but they occasionally gossip. Bled snubber valve on ${eq} and confirmed steady hydraulic baseline with ${role}.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} guard the LOTO padlock keys for ${eq} in ${zone} during ${activity} with greater security protocol than a Swiss bank vault.`,
    act: `Safety Note: When positive mechanical isolation is locked out, not even Harry Houdini gets into the circuit. Zero stored energy verified on ${eq}.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed the Shaker Hand suited up in full chemical apron, face shield, rubber gauntlets, and respirator just to open a fresh box of offshore tea bags in the doghouse near ${eq}.`,
    act: `Safety Note: Level 4 PPE compliance verified. Treating industrial rig tea with the same respect as 16.5 ppg drilling fluid prevents severe scalds around ${zone}.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} inspecting anti-slip boot tread in ${zone} near ${eq} with the seriousness of an F1 tire technician checking wet weather compounds.`,
    act: `Safety Note: Slippery deck grating meets its match when deep rubber lugs are clean. Washed and degreased walkway near ${eq}.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} holding the Stop Work Authority 'X' gesture in ${zone} during ${activity} near ${eq} with the majestic authority of an Olympic referee.`,
    act: `Safety Note: The crossed-arms SWA gesture commands instant silence across 50 Bob Palmer. Lift paused safely and taglines adjusted on ${eq}.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} in ${zone} double-checking twin fall-arrest snap hooks onto ${eq} with the focus of a mountain climber summiting Mount Everest.`,
    act: `Safety Note: Gravity is an undefeated champion, which is why 100% tie-off into certified 5,000-lb anchor points is mandatory on ${eq}.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Watched ${role} clean and wipe safety glasses in ${zone} near ${eq} five times in ten minutes to achieve 4K high-definition situational awareness.`,
    act: `Safety Note: Crystal-clear polycarbonate lenses prevent unexpected line-of-fire surprises. Anti-fog station refilled near ${eq}.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} walking down ${zone} checking for dropped objects around ${eq} with eyes sweeping the grating like a metal detector on a treasure hunt.`,
    act: `Safety Note: Zero loose bolts, zero dropped tools. Swept ${zone} clean and tethered all handheld wrenches on ${eq}.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} politely decline an extra pair of hands on ${eq} during ${activity}, insisting on hands-free push-pull sticks to preserve all 10 fingers.`,
    act: `Safety Note: Hands are irreplaceable precision instruments, not positioning bumpers. Commended ${role} for 100% hands-free tool discipline on ${eq}.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} in ${zone} reciting the JSA steps on ${eq} (${activity}) like an actor running lines for opening night on Broadway.`,
    act: `Safety Note: Rehearsing critical job steps ensures the entire crew plays the same safety score. Commended clear communication around ${eq}.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} testing the secondary whip-check on ${eq} in ${zone} by giving it the classic 'dad-checking-luggage' double tug.`,
    act: `Safety Note: 'That ain't going nowhere' — verified 316-SS cable clamped securely with safety pin locked on ${eq}.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} in ${zone} approaching shift handover at ${eq} with a clipboard checklist so comprehensive it resembled an international treaty.`,
    act: `Safety Note: Thorough debriefs eliminate operational blind spots. Handover executed smoothly on ${eq} with ${role}.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Watched ${role} stage fire extinguishers and fire blankets around ${eq} in ${zone} prior to hot work with the defensive perimeter of a medieval fortress.`,
    act: `Safety Note: 360-degree spark containment verified. Fire watch posted with continuous 0% LEL gas monitoring on ${eq}.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} monitor the wind anemometer near ${eq} during ${activity} with the meteorological dedication of a tornado chaser.`,
    act: `Safety Note: 20-knot marine limit respected to the decimal point. Operation paused until gusts settled around ${zone}.`
  })
];

// Expanded Music & Lyrics templates with iconic artists
export const UNIQUE_MUSIC_TEMPLATES = [
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} carefully verifying bleed-off pressure on ${eq} in ${zone} during ${activity} while humming Queen & David Bowie's 'Under Pressure'.`,
    act: `Safety Note: "Pressure pushing down on me / Pressing down on you" — Confirmed ${eq} manifold gauge bled down smoothly to 0 psi before unbolting.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} reminding the ${zone} team to use push-pull sticks instead of bare hands on ${eq} during ${activity} with a classic MC Hammer cue.`,
    act: `Safety Note: "U can't touch this! Stop, Hammer time!" — Crew maintained a full 36-inch hands-free standoff from ${eq} pinch points.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} refusing to conclude shift handover at ${eq} in ${zone} (${activity}) until every valve alignment and LOTO tag was walked down face-to-face.`,
    act: `Safety Note: Wham! said it best: "Wake me up before you go-go / Don't leave me hanging on like a yo-yo". Seamless shift handover completed in ${zone} on ${eq}.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} in ${zone} double-checking twin fall-arrest inertia reels and anchor shackles on ${eq} prior to ${activity}.`,
    act: `Safety Note: Bon Jovi sang "Whoa, we're half way there / Livin' on a prayer", but on Rig 50 we rely on 5,000-lb certified anchor points and 100% tie-off around ${eq}.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} bump-testing portable multi-gas detectors around ${eq} in ${zone} before ${activity}.`,
    act: `Safety Note: Phil Collins knew the drill: "I can feel it coming in the air tonight" — Verified 0 ppm H2S and 0% LEL around ${eq} in ${zone}.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} pause ${activity} at ${eq} in ${zone} when sea swells picked up, weighing operational limits with Kenny Rogers wisdom.`,
    act: `Safety Note: "You've got to know when to hold 'em / Know when to fold 'em / Know when to walk away" — SWA pause held until deck conditions around ${eq} stabilized.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} in ${zone} maintain laser focus on ${eq} console and parameters during critical ${activity}.`,
    act: `Safety Note: Survivor set the offshore tempo: "It's the eye of the tiger, it's the thrill of the fight / Risin' up to the challenge" — 100% situational vigilance verified on ${eq}.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed Chief Electrician verify zero electrical energy on ${eq} in ${zone} with a certified proximity probe prior to ${activity}.`,
    act: `Safety Note: AC/DC rocked high voltage: "You've been thunderstruck!" — 600V main breaker racked out and locked; arc-flash face shield verified before opening ${eq}.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed deck crew squeegeeing oil-based mud mist off the walkway around ${eq} in ${zone} and laying down anti-slip traction mats.`,
    act: `Safety Note: Michael Jackson moonwalked with style, but on Rig 50 decks: "You've been hit by, you've been struck by a smooth criminal" — Slick spots eliminated near ${eq}.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed deck rigger stop the supply vessel basket lift at ${eq} in ${zone} when stern line tension jerked in rough swell.`,
    act: `Safety Note: The Clash asked the big question: "Should I stay or should I go now? / If I go there will be trouble" — Rigger invoked SWA and safely lowered load to deck.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} repeatedly auditing secondary barriers and whipchecks on ${eq} in ${zone} throughout ${activity}.`,
    act: `Safety Note: Journey sang "Don't stop believin' / Hold on to that feelin'" — Relentless proactive barrier checks verified zero defects on ${eq}.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} conducting continuous atmospheric gas testing around ${eq} in ${zone} during ${activity}.`,
    act: `Safety Note: The Police warned "Every breath you take / Every move you make / I'll be watching you" — Calibrated 4-gas monitor clipped within 10 inches of breathing zone.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} remain calm and composed during unexpected equipment alarm on ${eq} in ${zone}, walking the crew through standard procedure.`,
    act: `Safety Note: Bob Marley shared timeless calm: "Don't worry about a thing / 'Cause every little thing gonna be alright" — Systematic diagnostics cleared alarm on ${eq}.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed mechanical crew servicing valves and cylinder liners on ${eq} in ${zone} with micrometer precision.`,
    act: `Safety Note: Daft Punk provided the engineering motto: "Harder, better, faster, stronger" — Precision torque values recorded in PM log for ${eq}.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} counting down the final inspection checklist on ${eq} in ${zone} before pressure testing.`,
    act: `Safety Note: Europe hit the crescendo: "It's the final countdown!" — All 8 isolation valves confirmed closed and barricades posted around ${eq}.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} inspecting the automated external defibrillator (AED) and emergency eyewash near ${eq} in ${zone}.`,
    act: `Safety Note: The Bee Gees sang "Ah, ha, ha, ha, stayin' alive, stayin' alive" — Emergency rescue kit verified 100% operational near ${eq}.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} inspecting heavy master links and wire rope slings on ${eq} in ${zone} for broken strands or stretching.`,
    act: `Safety Note: Fleetwood Mac knew the rule: "And if you don't love me now / You will never love me again / I can still hear you saying you would never break the chain" — Rigging integrity verified.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} posting fire blankets and testing foam fire extinguishers prior to torch cutting near ${eq} in ${zone}.`,
    act: `Safety Note: Deep Purple sang "Smoke on the water, a fire in the sky" — Zero smoke and zero sparks on Rig 50; hot work containment certified around ${eq}.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} calling over a colleague for a coordinated two-man lift on heavy spool piece near ${eq} in ${zone}.`,
    act: `Safety Note: The Beatles sang "I get by with a little help from my friends" — Shared 45-kg lift safely, protecting lumbar spine and posture.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} verify physical interlock safety gates around ${eq} in ${zone} to prevent unauthorized entry during rotation.`,
    act: `Safety Note: Pink Floyd sang "All in all it's just another brick in the wall" — Solid red-zone physical barriers keep personnel safe around ${eq}.`
  })
];

// Cinema & Hollywood Blockbuster movie templates
export const UNIQUE_CINEMA_TEMPLATES = [
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} invoke Stop Work Authority on ${eq} in ${zone} during ${activity} when an uncertified shackle was spotted in the rigging basket.`,
    act: `Safety Note: Arnold Schwarzenegger in The Terminator (1984) gave the ultimate promise: "I'll be back!" — Operation paused safely; certified rigging procured before restarting.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} cautioning the crew to slow down and verify torques on ${eq} in ${zone} during ${activity}.`,
    act: `Safety Note: Maverick in Top Gun (1986) craved speed: "I feel the need... the need for speed!" — But on Rig 50, precision and deliberate control always beat rushing.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} clipping twin fall-arrest lanyards to overhead anchor beam on ${eq} in ${zone} before stepping out onto the catwalk.`,
    act: `Safety Note: Master Yoda in Star Wars: The Empire Strikes Back (1980) taught the absolute rule: "Do. Or do not. There is no try." — 100% tie-off is non-negotiable.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} notice a slight pressure drop on ${eq} in ${zone} during ${activity} and immediately notify the control room.`,
    act: `Safety Note: Apollo 13 (1995) handled offshore anomalies with calm discipline: "Houston, we have a problem." — Early notification prevented escalation on ${eq}.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} standing guard at the red-zone barrier chain of ${eq} in ${zone}, barring entry while rotary table was active.`,
    act: `Safety Note: Gandalf in Lord of the Rings (2001) held the perimeter: "YOU SHALL NOT PASS!" — Zero personnel permitted inside the rotation radius of ${eq}.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} reviewing mandatory Aramco Golden Rules at ${eq} in ${zone} with newly arrived contractor personnel.`,
    act: `Safety Note: The Godfather (1972) made non-negotiable offers: "I'm gonna make him an offer he can't refuse." — 100% safety compliance is non-negotiable on Rig 50.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} lead the morning safety briefing around ${eq} in ${zone} with inspirational energy.`,
    act: `Safety Note: Maximus in Gladiator (2000) inspired greatness: "What we do in life echoes in eternity." — Daily safety leadership protects every brother on deck.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} rejecting a shortcut during Lockout/Tagout verification on ${eq} in ${zone}.`,
    act: `Safety Note: The Matrix (1999) taught reality: "There is no spoon." — And on Rig 50, there are no shortcuts in LOTO. Zero stored energy verified.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} inspecting high-pressure flange gaskets on ${eq} in ${zone} prior to 5,000-psi test.`,
    act: `Safety Note: Jurassic Park (1993) warned: "Life finds a way." — And high pressure finds every microscopic leak path unless seals are pristine.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} strictly checking Permit-to-Work signatures and gas test stamps for ${eq} in ${zone}.`,
    act: `Safety Note: Mission: Impossible: "Your mission, should you choose to accept it." — Full PTW authorization verified before turning a single wrench.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} walking the crew through step-by-step JSA for ${activity} on ${eq} in ${zone}.`,
    act: `Safety Note: Forrest Gump (1994) said: "Life was like a box of chocolates, you never know what you're gonna get." — But a good JSA leaves zero surprises.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} insist on push-pull sticks around ${eq} in ${zone} during heavy tubular movement.`,
    act: `Safety Note: Braveheart (1995) rallied the clan: "They may take our lives, but they'll never take our freedom!" — Nor our fingers! Hands-free tools verified.`
  })
];

// Ancient Wisdom & Philosophy templates
export const UNIQUE_WISDOM_TEMPLATES = [
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} conduct a thorough pre-job risk assessment at ${eq} in ${zone} before beginning ${activity}.`,
    act: `Safety Note: Sun Tzu in The Art of War stated: "Strategy without tactics is the slowest route to victory. Tactics without strategy is the noise before defeat." — Comprehensive planning verified.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} routinely return tools to shadow boards and clean walkways around ${eq} in ${zone} without being asked.`,
    act: `Safety Note: Aristotle observed: "We are what we repeatedly do. Excellence, then, is not an act, but a habit." — Proactive housekeeping keeps Rig 50 safe.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} verify secondary whipchecks and R-clips on high-pressure connections for ${eq} in ${zone}.`,
    act: `Safety Note: Murphy's Law warns: "Anything that can go wrong will go wrong — unless dual safety restraints are pinned." — Redundant safeguards confirmed.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} step forward to coach a junior roustabout on proper body positioning near ${eq} in ${zone}.`,
    act: `Safety Note: Marcus Aurelius wrote: "Waste no more time arguing about what a good man should be. Be one." — Exemplary safety brotherhood demonstrated.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} clearing small loose nuts and cable ties off the grating near ${eq} in ${zone}.`,
    act: `Safety Note: Confucius noted: "The man who moves a mountain begins by carrying away small stones." — Eliminating small hazards prevents catastrophic incidents.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} double-checking well control lines and choke manifold alignment at ${eq} in ${zone}.`,
    act: `Safety Note: Seneca taught: "Luck is what happens when preparation meets opportunity." — Rig 50 well control readiness verified 100%.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} perform preventative lubrication and wear checks on ${eq} in ${zone} ahead of heavy drilling.`,
    act: `Safety Note: Benjamin Franklin stated: "An ounce of prevention is worth a pound of cure." — Preventative maintenance scheduled and logged.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} pause during ${activity} on ${eq} in ${zone} to assess a subtle change in equipment vibration.`,
    act: `Safety Note: Lao Tzu wrote: "Do the difficult things while they are easy and do the great things while they are small." — Early detection prevented breakdown.`
  })
];

// Military & Aviation Precision templates
export const UNIQUE_MILITARY_TEMPLATES = [
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} enforce a strict "Sterile Cockpit" on drill floor near ${eq} in ${zone} during critical casing landing.`,
    act: `Safety Note: Aviation Flight Safety Protocol: "During critical phases of flight, all non-essential communication is ceased." — 100% focused silence maintained.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed deck crew conduct an arm-in-arm Foreign Object Debris (FOD) walkdown across ${zone} near ${eq}.`,
    act: `Safety Note: Aircraft Carrier Flight Deck Standard: "FOD sweeps eliminate microscopic hazards before turbine intake." — All loose items cleared.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} execute verbal challenge-and-response verification before actuating main valve on ${eq} in ${zone}.`,
    act: `Safety Note: Cockpit Two-Challenge Rule: "Point and call confirmations eliminate muscle-memory mistakes." — Exact valve alignment confirmed.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} in ${zone} establish an exclusion zone around ${eq} during crane offload with high-vis red cones.`,
    act: `Safety Note: Naval Flight Deck Red-Zone Protocol: "Keep clear of the catapult launch track." — 100% line-of-fire standoff maintained.`
  })
];

// Sports & Championship Mentality templates
export const UNIQUE_SPORTS_TEMPLATES = [
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed drill crew execute tubular connection on ${eq} in ${zone} with the rhythm of a Formula 1 pit crew.`,
    act: `Safety Note: Scuderia F1 Pit Crew Motto: "Speed is the byproduct of precision, zero unnecessary motion, and total trust." — Slips torqued hands-free in 18 seconds clean.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed banksman raise two crossed hands and blow safety whistle when forklift neared blind spot near ${eq} in ${zone}.`,
    act: `Safety Note: FIFA World Cup Refereeing Principle: "The referee blows the whistle before a foul becomes an injury." — SWA whistle averted conflict.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} reminding the team around ${eq} in ${zone} to keep chin tucked and safety guard up during chipping operations.`,
    act: `Safety Note: Championship Boxing Rule: "Always keep your guard up." — Double eye and face protection verified 100%.`
  }),
  (eq: string, role: string, zone: string, activity: string) => ({
    obs: `Observed ${role} communicate loud callouts on ${eq} in ${zone} like a championship central defender organizing the backline.`,
    act: `Safety Note: Team Championship Defense: "Vocal communication wins titles." — Every team member acknowledged movement before iron moved.`
  })
];

// Pure Non-Safety Combinatorial Dimensions (Zero Safety Jargon - 100% Entertainment, Lifestyle, Humor, Food, Gaming, Sports, Music & Movies)
export const NON_SAFETY_OPENINGS = [
  'During the evening lounge gathering',
  'Over a fresh pot of specialty espresso',
  'At the Thursday night dinner table',
  'During the midday coffee break debate',
  'In the recreation lounge after hours',
  'While waiting for the late-night snack tray',
  'During the weekend trivia showdown',
  'Around the big-screen TV in the lounge',
  'At the morning breakfast counter',
  'During a lively group-chat discussion',
  'While queuing up the evening playlist',
  'During the championship watch party',
  'Over freshly baked pastries at 15:00',
  'During the nightly dominoes & card tournament',
  'While comparing top weekend plans',
  'In the coffee corner at sunset',
  'During the Friday night movie marathon',
  'At the outdoor sunset seating deck',
  'While rating the week’s best meals',
  'During an impromptu stand-up comedy moment'
];

export const NON_SAFETY_VIBES = [
  'with 10/10 enthusiasm',
  'sparking unanimous applause across the room',
  'turning an ordinary Tuesday into a comedy special',
  'setting a new gold standard for good vibes',
  'leaving everyone at the table laughing for ten minutes straight',
  'proving once again that great taste is undefeated',
  'earning an instant standing ovation from the entire room',
  'making everyone immediately pull out their phones to take notes',
  'creating the most memorable highlight of the week',
  'bringing stadium-level energy to the lounge',
  'raising the bar for after-hours entertainment',
  'delivering peak weekend energy ahead of schedule',
  'settling a three-week friendly debate once and for all',
  'turning the coffee break into a five-star talk show',
  'winning unanimous approval from every single person present',
  'reminding everyone why small daily moments matter most'
];

export const NON_SAFETY_CLOSERS = [
  'Voted 10/10 highlight of the day by everyone in the room.',
  'Officially inducted into the hall of fame of great daily moments.',
  'Mood across the entire lounge instantly upgraded to 100%.',
  'Unanimously agreed this deserves its own Netflix mini-series.',
  'Certified legendary status for the rest of the month.',
  'Zero complaints, 100% pure entertainment from start to finish.',
  'Locked in as the undisputed topic of the week.',
  'Everyone left the table in a noticeably better mood.',
  'Five-star rating confirmed with zero hesitation.',
  'Proof that good company and great stories beat everything else.',
  'Instant classic that will be retold for months to come.',
  'Top-tier morale booster across the entire crew.'
];

export const NON_SAFETY_ITEMS = [
  'a double-shot iced Spanish latte with caramel drizzle',
  'an extra-garlic chicken shawarma on toasted saj bread',
  'a charcoal-grilled wagyu double cheeseburger',
  'a freshly brewed pot of cardamom Arabic coffee with Medjool dates',
  'a 90th-minute UEFA Champions League free-kick screamer',
  'a PlayStation 5 wireless DualSense controller',
  'a pair of studio-grade noise-canceling headphones',
  'a classic 1980s rock and synth-pop vinyl playlist',
  'a naturally aspirated V10 supercar exhaust note',
  'a crispy plate of golden kunafa with pistachio',
  'an IMAX 70mm director’s cut movie night',
  'a vintage mechanical chronograph wristwatch',
  'a last-second buzzer-beater three-pointer',
  'a medium-rare ribeye steak with rosemary butter',
  'a custom high-refresh-rate OLED gaming monitor',
  'a scenic coastal road trip playlist',
  'a championship dominoes final match',
  'a freshly baked chocolate hazelnut croissant',
  'a legendary 90s arcade fighting game cabinet',
  'a bucket-list Northern Lights travel itinerary'
];

export const PURE_NON_SAFETY_TEMPLATES: Record<string, Array<(item: string, role: string, zone: string, customTopic?: string) => { obs: string; act: string }>> = {
  humor: [
    (item, role, _zone, topic) => ({
      obs: `${role} argued that ${topic || item} is the single greatest invention in human history, defending the claim with a 10-minute presentation worthy of a courtroom drama.`,
      act: `Comedy Takeaway: The jury reached a unanimous verdict in under thirty seconds—${topic || item} officially takes the crown.`
    }),
    (item, role, _zone, topic) => ({
      obs: `Watched ${role} set seven consecutive phone alarms spaced two minutes apart, only to wake up three seconds before the first one rang just to enjoy ${topic || item}.`,
      act: `Comedy Takeaway: Internal biological clocks are mysteriously 100% accurate whenever ${topic || item} is on the schedule.`
    }),
    (item, role, _zone, topic) => ({
      obs: `${role} tried to explain a complicated movie plot while holding ${topic || item}, using hand gestures so dramatic that passersby thought a symphony orchestra was being conducted.`,
      act: `Comedy Takeaway: Storytelling charisma rated 11/10;charades championship trophy practically guaranteed.`
    }),
    (item, role, _zone, topic) => ({
      obs: `When the Wi-Fi router blinked for four seconds, ${role} looked up from ${topic || item} with the cinematic shock of someone discovering they had time-traveled to 1895.`,
      act: `Comedy Takeaway: Connection restored within five seconds and civilization was narrowly saved.`
    }),
    (item, role, _zone, topic) => ({
      obs: `${role} guarded the last serving of ${topic || item} in the dining hall with the tactical awareness of a Secret Service agent escorting a head of state.`,
      act: `Comedy Takeaway: High-value culinary assets require elite protection; mission accomplished with zero crumbs lost.`
    }),
    (item, role, _zone, topic) => ({
      obs: `${role} announced a 'strict healthy diet starting Monday' before immediately ordering ${topic || item} and explaining that time zones make it technically still Sunday somewhere.`,
      act: `Comedy Takeaway: Creative geography remains undefeated when cravings strike.`
    })
  ],
  music: [
    (item, role, _zone, topic) => ({
      obs: `${role} queued up Queen’s 'Bohemian Rhapsody' while enjoying ${topic || item}, and within thirty seconds six people were hitting the operatic high notes in full harmony.`,
      act: `Music Highlight: "Galileo! Figaro!" — Impromptu vocal performance earned a 10/10 rating for pure rock-and-roll spirit.`
    }),
    (item, role, _zone, topic) => ({
      obs: `A heated debate led by ${role} over ${topic || item} compared Michael Jackson’s 'Billie Jean' bassline against Daft Punk’s 'Get Lucky' groove for the title of greatest rhythm track ever recorded.`,
      act: `Music Highlight: Both tracks were added back-to-back to the master lounge playlist to keep the peace.`
    }),
    (item, role, _zone, topic) => ({
      obs: `${role} played the opening guitar riff of AC/DC’s 'Back in Black' and Dire Straits’ 'Sultans of Swing' while discussing ${topic || item}, turning the room into an instant air-guitar arena.`,
      act: `Music Highlight: Classic rock guitar solos remain timeless energy boosters at any hour of the day.`
    }),
    (item, role, _zone, topic) => ({
      obs: `${role} shared behind-the-scenes studio trivia about how Fleetwood Mac’s 'Rumours' and Pink Floyd’s 'Dark Side of the Moon' were mixed while relaxing with ${topic || item}.`,
      act: `Music Highlight: Analog studio craftsmanship and warm vinyl acoustics never go out of style.`
    }),
    (item, role, _zone, topic) => ({
      obs: `When Bon Jovi’s 'Livin’ on a Prayer' came on the speakers near ${role} and ${topic || item}, not a single person in the room resisted singing the key-change chorus.`,
      act: `Music Highlight: 1980s stadium anthems possess a 100% participation rate across all generations.`
    })
  ],
  cinema: [
    (item, role, _zone, topic) => ({
      obs: `${role} broke down the docking scene from Christopher Nolan’s 'Interstellar' (2014) over ${topic || item}, complete with Hans Zimmer organ soundtrack impressions.`,
      act: `Cinema Highlight: "It's not possible — No, it's necessary!" Rated as one of the most intense 10 minutes in modern cinema history.`
    }),
    (item, role, _zone, topic) => ({
      obs: `While enjoying ${topic || item}, ${role} sparked a lively ranking of the greatest action sequels ever made: 'Terminator 2: Judgment Day', 'The Dark Knight', 'Top Gun: Maverick', and 'Aliens'.`,
      act: `Cinema Highlight: Practical stunts and iconic one-liners cemented all four films in the all-time blockbuster pantheon.`
    }),
    (item, role, _zone, topic) => ({
      obs: `${role} quoted Al Pacino and Robert De Niro’s diner scene from 'Heat' (1995) and 'The Godfather' while discussing ${topic || item} with the evening movie club.`,
      act: `Cinema Highlight: Masterclass screenwriting and timeless dialogue still captivate audiences decades later.`
    }),
    (item, role, _zone, topic) => ({
      obs: `${role} defended the plot twist of 'The Usual Suspects' and 'Shutter Island' over ${topic || item}, challenging anyone at the table to name a better surprise ending.`,
      act: `Cinema Highlight: First-time viewing plot twists are a cinematic experience everyone wishes they could relive from scratch.`
    })
  ],
  food: [
    (item, role, _zone, topic) => ({
      obs: `${role} conducted a blind taste-test comparison featuring ${topic || item}, evaluating crust caramelization, spice balance, and aroma like a guest judge on MasterChef.`,
      act: `Culinary Verdict: Awarded an undisputed 5-star Michelin lounge rating with zero crumbs left on the plate.`
    }),
    (item, role, _zone, topic) => ({
      obs: `The aroma of freshly prepared ${topic || item} drifted down the corridor, drawing ${role} and half the floor to the dining counter three minutes before the bell even rang.`,
      act: `Culinary Verdict: Fresh ingredients and perfected seasoning are the fastest way to bring everyone together.`
    }),
    (item, role, _zone, topic) => ({
      obs: `${role} paired ${topic || item} with a custom dipping sauce recipe and declared that late-night snacks taste scientifically 40% better after 21:00.`,
      act: `Culinary Verdict: Recipe immediately requested by four colleagues at the next table.`
    }),
    (item, role, _zone, topic) => ({
      obs: `${role} demonstrated the exact water-temperature and grind-size secret behind brewing ${topic || item}, turning the coffee bar into an artisan café.`,
      act: `Culinary Verdict: Barista-grade extraction achieved; morning morale boosted across the board.`
    })
  ],
  gaming: [
    (item, role, _zone, topic) => ({
      obs: `${role} pulled off a 90+3rd minute comeback victory in EA FC / FIFA while powered by ${topic || item}, sending the lounge spectators into full stadium celebration mode.`,
      act: `Gaming Highlight: Clutch composure under pressure—instant replay saved to the console highlight reel.`
    }),
    (item, role, _zone, topic) => ({
      obs: `A nostalgia debate led by ${role} over ${topic || item} pitted the PlayStation 2 era ('GTA San Andreas', 'Tekken 5') against modern 4K 120fps ray-traced blockbusters.`,
      act: `Gaming Highlight: Graphics evolve every year, but couch-multiplayer rivalries are timeless.`
    }),
    (item, role, _zone, topic) => ({
      obs: `${role} showcased a custom ultra-low-latency setup alongside ${topic || item}, explaining frame-timing and OLED response rates with infectious enthusiasm.`,
      act: `Gaming Highlight: Smooth 120Hz gameplay and crisp audio make every evening session feel like an esports arena.`
    }),
    (item, role, _zone, topic) => ({
      obs: `${role} completed a no-hit boss run in Elden Ring while ${topic || item} sat untouched on the side table, holding the entire room in suspense for six straight minutes.`,
      act: `Gaming Highlight: Frame-perfect dodge timing earned a round of applause from the sofa gallery.`
    })
  ],
  travel: [
    (item, role, _zone, topic) => ({
      obs: `${role} mapped out the ultimate 10-day coastal road trip over ${topic || item}, comparing Amalfi Coast hairpins, Swiss mountain passes, and desert highway sunsets.`,
      act: `Lifestyle Highlight: Nothing beats an open highway, a full tank, and a curated driving playlist.`
    }),
    (item, role, _zone, topic) => ({
      obs: `Discussion around ${role} and ${topic || item} turned to automotive icons—debating whether a twin-turbo Porsche 911 Turbo S, a Nissan GT-R Nismo, or a classic V8 muscle car has the best presence.`,
      act: `Lifestyle Highlight: Mechanical craftsmanship and exhaust acoustics unite car enthusiasts everywhere.`
    }),
    (item, role, _zone, topic) => ({
      obs: `${role} shared travel tips on finding hidden local street-food gems and boutique coffee roasters in Tokyo, Istanbul, and Dubai while enjoying ${topic || item}.`,
      act: `Lifestyle Highlight: Exploring authentic local neighborhoods always beats standard tourist guidebooks.`
    })
  ],
  crew_life: [
    (item, role, _zone, topic) => ({
      obs: `${role} celebrated the mid-hitch milestone with ${topic || item}, kicking off the evening dominoes championship with undefeated confidence.`,
      act: `Camp Life Highlight: Great camaraderie and laughter around the rec room table make the days fly by.`
    }),
    (item, role, _zone, topic) => ({
      obs: `After discovering the cabin AC had transformed the room into an arctic glacier, ${role} wrapped up in a heavy hoodie and headed to the lounge for ${topic || item}.`,
      act: `Camp Life Highlight: Thermostat adjusted by two degrees and warm coffee deployed for optimal comfort.`
    }),
    (item, role, _zone, topic) => ({
      obs: `${role} organized a Thursday evening trivia and feast table featuring ${topic || item}, bringing together stories from five different countries in one room.`,
      act: `Camp Life Highlight: Shared stories and good food turn a workplace into a second family.`
    })
  ],
  sports: [
    (item, role, _zone, topic) => ({
      obs: `Over ${topic || item}, ${role} relived the greatest UEFA Champions League knockout comebacks of all time, analyzing tactical substitutions like a prime-time pundit.`,
      act: `Sports Highlight: European football nights under the floodlights deliver drama that no scripted movie can match.`
    }),
    (item, role, _zone, topic) => ({
      obs: `${role} timed a Formula 1 1.82-second pit stop replay while holding ${topic || item}, marveling at how twenty mechanics synchronize wheel guns in the blink of an eye.`,
      act: `Sports Highlight: Millisecond teamwork at 300 km/h is the pinnacle of motorsport engineering.`
    }),
    (item, role, _zone, topic) => ({
      obs: `${role} sparked a GOAT debate across the lounge over ${topic || item}—comparing World Cup finals, NBA Game 7 buzzer-beaters, and heavyweight title bouts.`,
      act: `Sports Highlight: Championship mentality and clutch moments inspire fans across every sport.`
    })
  ],
  wisdom: [
    (item, role, _zone, topic) => ({
      obs: `While reflecting over ${topic || item}, ${role} shared Marcus Aurelius’s stoic insight: "The happiness of your life depends upon the quality of your thoughts."`,
      act: `Philosophy Highlight: Maintaining a calm, grateful perspective transforms ordinary days into meaningful ones.`
    }),
    (item, role, _zone, topic) => ({
      obs: `${role} brought up a mind-blowing astrophysics fact over ${topic || item}: there are more stars in the observable universe than grains of sand on all the beaches on Earth.`,
      act: `Mind Fact Highlight: Cosmic perspective always sparks the deepest late-evening conversations.`
    }),
    (item, role, _zone, topic) => ({
      obs: `${role} quoted Aristotle’s timeless principle while discussing ${topic || item}: "Excellence is never an accident; it is always the result of high intention and sincere effort."`,
      act: `Philosophy Highlight: Small daily habits compound into extraordinary long-term results.`
    })
  ],
  military: [
    (item, role, _zone, topic) => ({
      obs: `${role} shared fascinating aviation history over ${topic || item} about how the SR-71 Blackbird cruised at Mach 3.2 at 85,000 feet where the sky turns deep violet.`,
      act: `Aviation Highlight: Titanium engineering and supersonic aerodynamics remain breathtaking achievements.`
    }),
    (item, role, _zone, topic) => ({
      obs: `While discussing ${topic || item}, ${role} explained how Apollo 11’s guidance computer navigated to the Moon with less memory than a modern digital watch.`,
      act: `Aviation Highlight: Human ingenuity and precision navigation achieved the impossible.`
    })
  ]
};

export type ObsTypeSelectionFilter = 'all_balanced' | 'behavior' | 'condition' | 'swa' | 'swa_drill';
export type ContentGenerationMode = 'pure_non_safety' | 'blended' | 'safety';

export interface CategoryQuotas {
  condition: number;
  behavior: number;
  swa: number;
  swaDrill?: number;
}

export function buildQuotaTypeSequence(
  quotas: CategoryQuotas,
  totalCount: number
): Array<'Condition' | 'Behavior Observation' | 'STOP Work Authority (SWA)' | 'Stop Work Authority Drill'> {
  const cond = Math.max(0, Number(quotas?.condition) || 0);
  const beh = Math.max(0, Number(quotas?.behavior) || 0);
  const swa = Math.max(0, Number(quotas?.swa) || 0);
  const drill = Math.max(0, Number(quotas?.swaDrill) || 0);
  const quotaSum = cond + beh + swa + drill;

  if (quotaSum <= 0) {
    return Array.from({ length: totalCount }, (_, i) => {
      const mod = i % 10;
      if (mod < 5) return 'Behavior Observation';
      if (mod < 8) return 'Condition';
      return 'STOP Work Authority (SWA)';
    });
  }

  let targetCond: number;
  let targetBeh: number;
  let targetSwa: number;
  let targetDrill: number;

  if (quotaSum === totalCount) {
    targetCond = cond;
    targetBeh = beh;
    targetSwa = swa;
    targetDrill = drill;
  } else {
    targetCond = Math.round((cond / quotaSum) * totalCount);
    targetBeh = Math.round((beh / quotaSum) * totalCount);
    targetSwa = Math.round((swa / quotaSum) * totalCount);
    const assigned = targetCond + targetBeh + targetSwa;
    targetDrill = Math.max(0, totalCount - assigned);
    if (targetCond + targetBeh + targetSwa + targetDrill < totalCount) {
      targetBeh += (totalCount - (targetCond + targetBeh + targetSwa + targetDrill));
    }
  }

  type QuotaCategoryType = 'Condition' | 'Behavior Observation' | 'STOP Work Authority (SWA)' | 'Stop Work Authority Drill';

  const rawBuckets: Array<{ type: QuotaCategoryType; count: number }> = [
    { type: 'Condition' as const, count: targetCond },
    { type: 'Behavior Observation' as const, count: targetBeh },
    { type: 'STOP Work Authority (SWA)' as const, count: targetSwa },
    { type: 'Stop Work Authority Drill' as const, count: targetDrill }
  ];
  const buckets = rawBuckets.filter(b => b.count > 0);

  if (buckets.length === 0) {
    return Array.from({ length: totalCount }, () => 'Behavior Observation');
  }

  const result: Array<'Condition' | 'Behavior Observation' | 'STOP Work Authority (SWA)' | 'Stop Work Authority Drill'> = [];
  const remaining = buckets.map(b => b.count);
  const total = remaining.reduce((a, b) => a + b, 0);

  for (let i = 0; i < total; i++) {
    let bestIdx = 0;
    let maxVal = -1;
    for (let j = 0; j < buckets.length; j++) {
      if (remaining[j] > 0) {
        const score = remaining[j] / buckets[j].count;
        if (score > maxVal) {
          maxVal = score;
          bestIdx = j;
        }
      }
    }
    result.push(buckets[bestIdx].type);
    remaining[bestIdx]--;
  }

  return result;
}

export interface GenerateInfiniteCardsOptions {
  count: number;
  category: CardCategoryType;
  theme?: string;
  themes?: string[]; // Multi-theme support!
  contentMode?: ContentGenerationMode; // 'pure_non_safety' | 'blended' | 'safety'
  customTopic?: string; // Optional user free-text topic injected into cards
  assessmentFilter: string;
  obsTypeFilter?: ObsTypeSelectionFilter;
  categoryQuotas?: CategoryQuotas;
  baseSeed?: string;
  blacklist?: string[];
  trainingIdeas?: Array<{
    id?: string;
    topic: string;
    observation: string;
    action: string;
    zone?: string;
    role?: string;
    assessment?: 'Safe' | 'Unsafe';
    obsType?: string;
    keywords?: string;
    isActive?: boolean;
  }>;
}


/**
 * Checks if a Training Idea has clean, usable text (not broken fragments like "some baricate area befor" or "toady was good work")
 */
function isCleanTrainingIdea(idea: { topic?: string; observation?: string; action?: string }): boolean {
  const combined = `${idea.topic || ''} ${idea.observation || ''} ${idea.action || ''}`.toLowerCase();
  const brokenPatterns = [
    'some baricate',
    'befor ',
    'toady was',
    'they gaus',
    'lif vest',
    'put ot correctly',
    'chife cook',
    'mass boy',
    'room boy',
    'doesn’t hold the safeguards',
    'doesnt hold the safeguards',
    'holding them by his hands',
    'someone come very close'
  ];
  return !brokenPatterns.some(pat => combined.includes(pat));
}

/**
 * Adapts a clean supervisor Training Idea into a natural, non-repetitive observation and action
 * without robotic boilerplate wrappers or "[Check #...]" tags.
 */
function adaptTrainingIdeaNaturally(
  idea: {
    topic: string;
    observation: string;
    action: string;
    zone?: string;
    role?: string;
    assessment?: 'Safe' | 'Unsafe';
    obsType?: string;
  },
  eqObj: { item: string; zone: string; role: string; activity: string },
  variantSeed: number
): { zone: string; role: string; obs: string; act: string; assessment: 'Safe' | 'Unsafe'; obsType: 'STOP Work Authority (SWA)' | 'Behavior Observation' | 'Condition' | 'Stop Work Authority Drill' } {
  const zone = normalizeToOfficialZone(idea.zone || eqObj.zone);
  const role = RIG_50_ROLES.includes(idea.role || '') ? (idea.role as string) : eqObj.role;
  const assessment: 'Safe' | 'Unsafe' = idea.assessment === 'Unsafe' ? 'Unsafe' : 'Safe';
  const validObsTypes = ['STOP Work Authority (SWA)', 'Behavior Observation', 'Condition', 'Stop Work Authority Drill'] as const;
  const obsType = validObsTypes.includes(idea.obsType as any)
    ? (idea.obsType as typeof validObsTypes[number])
    : (assessment === 'Unsafe' ? 'STOP Work Authority (SWA)' : 'Behavior Observation');

  // Clean any old boilerplate prefix from the stored idea observation
  let coreObs = String(idea.observation || '')
    .replace(/^During\s+(?:active\s+)?shift\s+operations\s+in\s+[^,]+,\s*observed\s+[^,]+?\s+maintaining\s+proactive\s+safety\s+compliance\s+and\s+procedural\s+discipline\s+while\s+/i, '')
    .replace(/^During\s+operational\s+safety\s+walkthrough\s+in\s+[^,]+,\s*identified\s+an\s+unsafe\s+condition\s+involving\s+/i, '')
    .replace(/,\s*requiring\s+immediate\s+corrective\s+intervention\.?$/i, '')
    .replace(/\s*\[[^\]]*\]\.?$/g, '')
    .trim();

  let coreAct = String(idea.action || '')
    .replace(/\s*\[[^\]]*\]\.?$/g, '')
    .trim();

  if (coreObs.length > 25 && isCleanTrainingIdea({ topic: idea.topic, observation: coreObs, action: coreAct })) {
    const firstCharLower = coreObs.charAt(0).toLowerCase() + coreObs.slice(1).replace(/\.$/, '');
    const contextualLeadIns = [
      `${coreObs.replace(/\.$/, '')} near ${eqObj.item}.`,
      `While ${eqObj.activity} in ${zone}, ${firstCharLower}.`,
      `Around ${eqObj.item} in ${zone}, ${firstCharLower}.`,
      `Ahead of ${eqObj.activity} in ${zone}, ${firstCharLower}.`,
      `Spot-check in ${zone} during ${eqObj.activity}: ${firstCharLower}.`,
      `In ${zone} (${eqObj.activity}), ${firstCharLower}.`
    ];
    const chosenObs = contextualLeadIns[variantSeed % contextualLeadIns.length];
    const chosenAct = coreAct.length > 20
      ? coreAct
      : (assessment === 'Unsafe'
        ? `Exercised Stop Work Authority (SWA) with ${role} in ${zone}, corrected the barrier deficiency around ${eqObj.item}, and verified safe conditions before resuming.`
        : `Commended ${role} for maintaining high operational safety standards around ${eqObj.item} in ${zone}.`);

    return { zone, role, obs: chosenObs, act: chosenAct, assessment, obsType };
  }

  // Fallback to natural equipment-based scenario if idea text was too short or corrupted
  const safeFinding = SAFE_CONDITION_FINDINGS[variantSeed % SAFE_CONDITION_FINDINGS.length];
  const opener = SAFE_CONDITION_OPENERS[variantSeed % SAFE_CONDITION_OPENERS.length];
  return {
    zone,
    role,
    obs: `${opener(eqObj.item, zone, eqObj.activity)}, ${safeFinding.finding}.`,
    act: safeFinding.action(role, eqObj.item, zone),
    assessment: 'Safe',
    obsType: 'Condition'
  };
}

/**
 * Generates an array of completely unique, natural, non-repeating SOAR cards.
 * Guaranteed:
 * - Supports 'pure_non_safety' mode (100% off-topic entertainment, food, gaming, comedy, music, movies, sports with ZERO safety jargon)
 * - Supports 'blended' mode (themes woven with rig life) and 'safety' mode (technical HSE)
 * - Supports customTopic injection so users can generate cards about any subject they type
 * - Zero duplicate observations or actions within a batch
 */
export function generateInfiniteUniqueCards(options: GenerateInfiniteCardsOptions): SoarCardTemplate[] {

  const {
    count,
    category,
    theme,
    themes,
    contentMode = 'blended',
    customTopic = '',
    assessmentFilter,
    obsTypeFilter = 'all_balanced',
    categoryQuotas,
    baseSeed,
    blacklist = [],
    trainingIdeas = []
  } = options;

  const cleanCustomTopic = String(customTopic || '').trim();
  const PURE_NON_SAFETY_THEME_IDS = new Set(['food', 'gaming', 'travel', 'crew_life']);

  const cards: SoarCardTemplate[] = [];
  const cleanUserIdeas = (trainingIdeas || []).filter(i => i && i.isActive !== false && (i.observation || i.topic) && isCleanTrainingIdea(i));
  const usedIdeaIds: string[] = [];
  const usedIdeaIdsInBatch = new Set<string>();

  // Resolve active themes array for multi-theme generation
  const rawThemes: string[] = (themes && themes.length > 0)
    ? themes
    : (theme ? (theme === 'all' ? ['humor', 'music', 'cinema', 'food', 'gaming', 'travel', 'crew_life', 'wisdom', 'military', 'sports', 'operations'] : [theme]) : ['operations']);
  const activeThemes = rawThemes.filter(Boolean);

  // Track used observations, actions, and core scenario keys so nothing repeats
  const seenObsSet = new Set<string>(blacklist.map(b => String(b || '').toLowerCase().trim()).filter(Boolean));
  const seenNormSet = new Set<string>(blacklist.map(b => normalizeSemanticCore(b)).filter(s => s.length > 40));
  const seenActSet = new Set<string>();

  const quotaSequence = categoryQuotas ? buildQuotaTypeSequence(categoryQuotas, count) : null;

  // Prime offsets using random entropy so consecutive batches explore completely different combinations
  const eqPrimeOffset = Math.floor(Math.random() * RIG_50_EQUIPMENT.length);
  const cndOffset = Math.floor(Math.random() * SAFE_CONDITION_FINDINGS.length);
  const bhvOffset = Math.floor(Math.random() * SAFE_BEHAVIOR_SCENARIOS.length);
  const swaOffset = Math.floor(Math.random() * SWA_INTERVENTION_SCENARIOS.length);
  const drillOffset = Math.floor(Math.random() * SWA_DRILL_SCENARIOS.length);
  const openerOffset = Math.floor(Math.random() * SAFE_CONDITION_OPENERS.length);
  const nonSafetyOffset = Math.floor(Math.random() * NON_SAFETY_ITEMS.length);

  let cndCounter = 0;
  let bhvCounter = 0;
  let swaCounter = 0;
  let drillCounter = 0;

  for (let i = 0; i < count; i++) {
    const chosenSeed = generateUniqueSeed(i, baseSeed);
    // Evenly distribute cards across all user-selected themes
    const cardTheme = activeThemes[i % activeThemes.length] || 'operations';
    const isThisCardPureNonSafety = contentMode === 'pure_non_safety' || PURE_NON_SAFETY_THEME_IDS.has(cardTheme);

    // 1. Determine the target Observation Type for this card first so the scenario matches 100%
    let targetObsType: 'STOP Work Authority (SWA)' | 'Behavior Observation' | 'Condition' | 'Stop Work Authority Drill';
    if (quotaSequence && quotaSequence[i]) {
      targetObsType = quotaSequence[i];
    } else if (obsTypeFilter === 'swa') {
      targetObsType = 'STOP Work Authority (SWA)';
    } else if (obsTypeFilter === 'condition') {
      targetObsType = 'Condition';
    } else if (obsTypeFilter === 'behavior') {
      targetObsType = 'Behavior Observation';
    } else if (obsTypeFilter === 'swa_drill') {
      targetObsType = 'Stop Work Authority Drill';
    } else {
      const mod = i % 10;
      if (mod < 4) targetObsType = 'Condition';
      else if (mod < 8) targetObsType = 'Behavior Observation';
      else if (mod === 8) targetObsType = 'STOP Work Authority (SWA)';
      else targetObsType = 'Stop Work Authority Drill';
    }

    // 2. Determine target Assessment (Safe vs Unsafe) consistent with targetObsType
    let targetAssessment: 'Safe' | 'Unsafe';
    if (targetObsType === 'STOP Work Authority (SWA)') {
      targetAssessment = 'Unsafe';
    } else if (targetObsType === 'Stop Work Authority Drill') {
      targetAssessment = 'Safe';
    } else if (assessmentFilter === 'unsafe_only') {
      targetAssessment = 'Unsafe';
      targetObsType = 'STOP Work Authority (SWA)';
    } else if (assessmentFilter === 'safe_only' || category === 'Safe') {
      targetAssessment = 'Safe';
    } else if (assessmentFilter === 'realistic_mix') {
      targetAssessment = (i % 7 === 0) ? 'Unsafe' : 'Safe';
      if (targetAssessment === 'Unsafe') targetObsType = 'STOP Work Authority (SWA)';
    } else {
      targetAssessment = 'Safe';
    }

    let finalObs = '';
    let finalAct = '';
    let finalZone = isThisCardPureNonSafety ? 'Living Quarters' : 'Rig Floor';
    let finalRole = 'Floorman';

    // 3. Optionally weave in a clean supervisor Training Idea ONLY for standard safety operations cards
    const candidateIdea = (!isThisCardPureNonSafety && !cleanCustomTopic && cleanUserIdeas.length > 0 && i % 6 === 0 && cardTheme === 'operations')
      ? cleanUserIdeas.find(idea => {
          const idKey = idea.id || idea.topic;
          if (usedIdeaIdsInBatch.has(idKey)) return false;
          const ideaAss = idea.assessment === 'Unsafe' ? 'Unsafe' : 'Safe';
          return ideaAss === targetAssessment;
        })
      : undefined;

    if (candidateIdea) {
      const idKey = candidateIdea.id || candidateIdea.topic;
      usedIdeaIdsInBatch.add(idKey);
      if (candidateIdea.id) usedIdeaIds.push(candidateIdea.id);

      const eqObj = RIG_50_EQUIPMENT[(eqPrimeOffset + i * 5) % RIG_50_EQUIPMENT.length];
      const adapted = adaptTrainingIdeaNaturally(candidateIdea, eqObj, i + openerOffset);
      if (!seenObsSet.has(adapted.obs.toLowerCase().trim()) && !isContentBlacklisted(adapted.obs, blacklist)) {
        finalObs = adapted.obs;
        finalAct = adapted.act;
        finalZone = adapted.zone;
        finalRole = adapted.role;
        targetAssessment = adapted.assessment;
        targetObsType = adapted.obsType;
      }
    }

    // 4A. PURE NON-SAFETY COMBINATORIAL GENERATOR (Zero Safety Jargon - 2.5B+ Permutations)
    if (!finalObs && isThisCardPureNonSafety) {
      for (let attempt = 0; attempt < 50; attempt++) {
        const nsItem = NON_SAFETY_ITEMS[(nonSafetyOffset + i * 7 + attempt * 13) % NON_SAFETY_ITEMS.length];
        const opening = NON_SAFETY_OPENINGS[(i * 5 + attempt * 11) % NON_SAFETY_OPENINGS.length];
        const vibe = NON_SAFETY_VIBES[(i * 9 + attempt * 17) % NON_SAFETY_VIBES.length];
        const closer = NON_SAFETY_CLOSERS[(i * 11 + attempt * 19) % NON_SAFETY_CLOSERS.length];
        const role = RIG_50_ROLES[(i * 3 + attempt * 5) % RIG_50_ROLES.length];
        const zone = RIG_50_ZONES[(i + attempt) % RIG_50_ZONES.length];

        const tplKey = PURE_NON_SAFETY_TEMPLATES[cardTheme] ? cardTheme : 'humor';
        const tplList = PURE_NON_SAFETY_TEMPLATES[tplKey];
        const tpl = tplList[(i * 3 + attempt * 7) % tplList.length];
        const res = tpl(nsItem, role, zone, cleanCustomTopic || undefined);

        const candidateObs = `${opening} ${vibe}, ${res.obs.charAt(0).toLowerCase() + res.obs.slice(1)}`;
        const candidateAct = `${res.act} (${closer})`;

        const lowerObs = candidateObs.toLowerCase().trim();
        const normObs = normalizeSemanticCore(candidateObs);
        const lowerAct = candidateAct.toLowerCase().trim();

        if (!seenObsSet.has(lowerObs) && !seenNormSet.has(normObs) && !seenActSet.has(lowerAct) && !isContentBlacklisted(candidateObs, blacklist)) {
          finalObs = candidateObs;
          finalAct = candidateAct;
          finalZone = zone;
          finalRole = role;
          break;
        }
      }

      if (!finalObs) {
        const nsItem = NON_SAFETY_ITEMS[(nonSafetyOffset + i * 13) % NON_SAFETY_ITEMS.length];
        const opening = NON_SAFETY_OPENINGS[(i * 17) % NON_SAFETY_OPENINGS.length];
        const vibe = NON_SAFETY_VIBES[(i * 23) % NON_SAFETY_VIBES.length];
        const closer = NON_SAFETY_CLOSERS[(i * 29) % NON_SAFETY_CLOSERS.length];
        finalRole = RIG_50_ROLES[(i * 7) % RIG_50_ROLES.length];
        finalZone = RIG_50_ZONES[i % RIG_50_ZONES.length];
        const tplKey = PURE_NON_SAFETY_TEMPLATES[cardTheme] ? cardTheme : 'humor';
        const tplList = PURE_NON_SAFETY_TEMPLATES[tplKey];
        const tpl = tplList[(i + 13) % tplList.length];
        const res = tpl(nsItem, finalRole, finalZone, cleanCustomTopic || undefined);
        const episodeTag = `Ep-${((i * 137 + 101) % 8999) + 1000}`;
        finalObs = `${opening} ${vibe}, ${res.obs.charAt(0).toLowerCase() + res.obs.slice(1)}`;
        finalAct = `${res.act} (${closer} · #${episodeTag})`;
      }
    }

    // 4B. Main Combinatorial Scenario Generator (Blended & Standard Safety - Inexhaustible 500M+ Permutations)
    if (!finalObs) {
      for (let attempt = 0; attempt < 50; attempt++) {
        const eqIdx = (eqPrimeOffset + i * 11 + attempt * 17) % RIG_50_EQUIPMENT.length;
        const eqObj = RIG_50_EQUIPMENT[eqIdx];
        const zone = normalizeToOfficialZone(eqObj.zone);
        const role = attempt === 0
          ? (RIG_50_ROLES.includes(eqObj.role) ? eqObj.role : RIG_50_ROLES[(i + attempt) % RIG_50_ROLES.length])
          : RIG_50_ROLES[(i * 3 + attempt * 5) % RIG_50_ROLES.length];

        const shiftCtx = DYNAMIC_SHIFT_CONTEXTS[(i * 7 + attempt * 13) % DYNAMIC_SHIFT_CONTEXTS.length];
        const microLoc = DYNAMIC_MICRO_LOCATIONS[(i * 11 + attempt * 17) % DYNAMIC_MICRO_LOCATIONS.length];
        const scrutinyAct = DYNAMIC_SCRUTINY_ACTIONS[(i * 13 + attempt * 19) % DYNAMIC_SCRUTINY_ACTIONS.length];
        const effectiveItem = cleanCustomTopic ? `${cleanCustomTopic} near ${eqObj.item}` : eqObj.item;

        let candidateObs = '';
        let candidateAct = '';

        if (cardTheme === 'humor') {
          const tpl = UNIQUE_HUMOR_TEMPLATES[(i * 3 + attempt * 7) % UNIQUE_HUMOR_TEMPLATES.length];
          const res = tpl(effectiveItem, role, zone, eqObj.activity);
          candidateObs = `${shiftCtx} ${microLoc}, ${res.obs.charAt(0).toLowerCase() + res.obs.slice(1)}`;
          candidateAct = `${res.act} (${scrutinyAct})`;
        } else if (cardTheme === 'music') {
          const tpl = UNIQUE_MUSIC_TEMPLATES[(i * 3 + attempt * 7) % UNIQUE_MUSIC_TEMPLATES.length];
          const res = tpl(effectiveItem, role, zone, eqObj.activity);
          candidateObs = `${shiftCtx} ${microLoc}, ${res.obs.charAt(0).toLowerCase() + res.obs.slice(1)}`;
          candidateAct = `${res.act} (${scrutinyAct})`;
        } else if (cardTheme === 'cinema') {
          const tpl = UNIQUE_CINEMA_TEMPLATES[(i * 3 + attempt * 7) % UNIQUE_CINEMA_TEMPLATES.length];
          const res = tpl(effectiveItem, role, zone, eqObj.activity);
          candidateObs = `${shiftCtx} ${microLoc}, ${res.obs.charAt(0).toLowerCase() + res.obs.slice(1)}`;
          candidateAct = `${res.act} (${scrutinyAct})`;
        } else if (cardTheme === 'wisdom') {
          const tpl = UNIQUE_WISDOM_TEMPLATES[(i * 3 + attempt * 7) % UNIQUE_WISDOM_TEMPLATES.length];
          const res = tpl(effectiveItem, role, zone, eqObj.activity);
          candidateObs = `${shiftCtx} ${microLoc}, ${res.obs.charAt(0).toLowerCase() + res.obs.slice(1)}`;
          candidateAct = `${res.act} (${scrutinyAct})`;
        } else if (cardTheme === 'military') {
          const tpl = UNIQUE_MILITARY_TEMPLATES[(i * 3 + attempt * 7) % UNIQUE_MILITARY_TEMPLATES.length];
          const res = tpl(effectiveItem, role, zone, eqObj.activity);
          candidateObs = `${shiftCtx} ${microLoc}, ${res.obs.charAt(0).toLowerCase() + res.obs.slice(1)}`;
          candidateAct = `${res.act} (${scrutinyAct})`;
        } else if (cardTheme === 'sports') {
          const tpl = UNIQUE_SPORTS_TEMPLATES[(i * 3 + attempt * 7) % UNIQUE_SPORTS_TEMPLATES.length];
          const res = tpl(effectiveItem, role, zone, eqObj.activity);
          candidateObs = `${shiftCtx} ${microLoc}, ${res.obs.charAt(0).toLowerCase() + res.obs.slice(1)}`;
          candidateAct = `${res.act} (${scrutinyAct})`;
        } else if (targetObsType === 'STOP Work Authority (SWA)' || targetAssessment === 'Unsafe') {
          const swaIdx = (swaOffset + swaCounter + attempt * 7) % SWA_INTERVENTION_SCENARIOS.length;
          const swaScenario = SWA_INTERVENTION_SCENARIOS[swaIdx];
          const baseObs = swaScenario.obs(effectiveItem, role, zone, eqObj.activity);
          candidateObs = `${shiftCtx} ${microLoc}, ${baseObs.charAt(0).toLowerCase() + baseObs.slice(1)}`;
          candidateAct = `${swaScenario.act(effectiveItem, role, zone)} (${scrutinyAct})`;
          if (attempt === 0) swaCounter++;
        } else if (targetObsType === 'Stop Work Authority Drill') {
          const drillIdx = (drillOffset + drillCounter + attempt * 3) % SWA_DRILL_SCENARIOS.length;
          const drillScenario = SWA_DRILL_SCENARIOS[drillIdx];
          const baseObs = drillScenario.obs(effectiveItem, role, zone, eqObj.activity);
          candidateObs = `${shiftCtx} ${microLoc}, ${baseObs.charAt(0).toLowerCase() + baseObs.slice(1)}`;
          candidateAct = `${drillScenario.act(effectiveItem, role, zone)} (${scrutinyAct})`;
          if (attempt === 0) drillCounter++;
        } else if (targetObsType === 'Condition') {
          const cndIdx = (cndOffset + cndCounter + attempt * 5) % SAFE_CONDITION_FINDINGS.length;
          const openerIdx = (openerOffset + i * 3 + attempt) % SAFE_CONDITION_OPENERS.length;
          const cndScenario = SAFE_CONDITION_FINDINGS[cndIdx];
          const opener = SAFE_CONDITION_OPENERS[openerIdx];
          candidateObs = `${shiftCtx} ${microLoc}, ${opener(effectiveItem, zone, eqObj.activity).toLowerCase()}, ${cndScenario.finding}.`;
          candidateAct = `${cndScenario.action(role, effectiveItem, zone)} (${scrutinyAct})`;
          if (attempt === 0) cndCounter++;
        } else {
          // Behavior Observation (Safe)
          const bhvIdx = (bhvOffset + bhvCounter + attempt * 5) % SAFE_BEHAVIOR_SCENARIOS.length;
          const openerIdx = (openerOffset + i * 5 + attempt) % SAFE_BEHAVIOR_OPENERS.length;
          const bhvScenario = SAFE_BEHAVIOR_SCENARIOS[bhvIdx];
          const opener = SAFE_BEHAVIOR_OPENERS[openerIdx];
          candidateObs = `${shiftCtx} ${microLoc}, ${opener(role, effectiveItem, zone, eqObj.activity).toLowerCase()}, ${bhvScenario.behavior}.`;
          candidateAct = `${bhvScenario.action(role, effectiveItem, zone)} (${scrutinyAct})`;
          if (attempt === 0) bhvCounter++;
        }

        const lowerObs = candidateObs.toLowerCase().trim();
        const normObs = normalizeSemanticCore(candidateObs);
        const lowerAct = candidateAct.toLowerCase().trim();

        if (!seenObsSet.has(lowerObs) && !seenNormSet.has(normObs) && !seenActSet.has(lowerAct) && !isContentBlacklisted(candidateObs, blacklist)) {
          finalObs = candidateObs;
          finalAct = candidateAct;
          finalZone = zone;
          finalRole = role;
          break;
        }
      }
    }

    // 5. Theme-Aware Autonomous Fallback: Guaranteed unique card matching the requested theme
    if (!finalObs) {
      for (let fbAttempt = 0; fbAttempt < 25; fbAttempt++) {
        const eqObj = RIG_50_EQUIPMENT[(eqPrimeOffset + i * 13 + fbAttempt * 19) % RIG_50_EQUIPMENT.length];
        const testZone = normalizeToOfficialZone(eqObj.zone);
        const testRole = RIG_50_ROLES[(i * 7 + fbAttempt * 11) % RIG_50_ROLES.length];
        const shiftCtx = DYNAMIC_SHIFT_CONTEXTS[(i * 17 + fbAttempt * 23) % DYNAMIC_SHIFT_CONTEXTS.length];
        const microLoc = DYNAMIC_MICRO_LOCATIONS[(i * 23 + fbAttempt * 29) % DYNAMIC_MICRO_LOCATIONS.length];
        const scrutinyAct = DYNAMIC_SCRUTINY_ACTIONS[(i * 29 + fbAttempt * 31) % DYNAMIC_SCRUTINY_ACTIONS.length];

        let candObs = '';
        let candAct = '';

        if (cardTheme === 'humor') {
          const tpl = UNIQUE_HUMOR_TEMPLATES[(i + fbAttempt * 3 + 13) % UNIQUE_HUMOR_TEMPLATES.length];
          const res = tpl(eqObj.item, testRole, testZone, eqObj.activity);
          candObs = `${shiftCtx} ${microLoc}, ${res.obs.charAt(0).toLowerCase() + res.obs.slice(1)}`;
          candAct = `${res.act} (${scrutinyAct})`;
        } else if (cardTheme === 'music') {
          const tpl = UNIQUE_MUSIC_TEMPLATES[(i + fbAttempt * 3 + 13) % UNIQUE_MUSIC_TEMPLATES.length];
          const res = tpl(eqObj.item, testRole, testZone, eqObj.activity);
          candObs = `${shiftCtx} ${microLoc}, ${res.obs.charAt(0).toLowerCase() + res.obs.slice(1)}`;
          candAct = `${res.act} (${scrutinyAct})`;
        } else if (cardTheme === 'cinema') {
          const tpl = UNIQUE_CINEMA_TEMPLATES[(i + fbAttempt * 3 + 13) % UNIQUE_CINEMA_TEMPLATES.length];
          const res = tpl(eqObj.item, testRole, testZone, eqObj.activity);
          candObs = `${shiftCtx} ${microLoc}, ${res.obs.charAt(0).toLowerCase() + res.obs.slice(1)}`;
          candAct = `${res.act} (${scrutinyAct})`;
        } else if (cardTheme === 'wisdom') {
          const tpl = UNIQUE_WISDOM_TEMPLATES[(i + fbAttempt * 3 + 13) % UNIQUE_WISDOM_TEMPLATES.length];
          const res = tpl(eqObj.item, testRole, testZone, eqObj.activity);
          candObs = `${shiftCtx} ${microLoc}, ${res.obs.charAt(0).toLowerCase() + res.obs.slice(1)}`;
          candAct = `${res.act} (${scrutinyAct})`;
        } else if (cardTheme === 'military') {
          const tpl = UNIQUE_MILITARY_TEMPLATES[(i + fbAttempt * 3 + 13) % UNIQUE_MILITARY_TEMPLATES.length];
          const res = tpl(eqObj.item, testRole, testZone, eqObj.activity);
          candObs = `${shiftCtx} ${microLoc}, ${res.obs.charAt(0).toLowerCase() + res.obs.slice(1)}`;
          candAct = `${res.act} (${scrutinyAct})`;
        } else if (cardTheme === 'sports') {
          const tpl = UNIQUE_SPORTS_TEMPLATES[(i + fbAttempt * 3 + 13) % UNIQUE_SPORTS_TEMPLATES.length];
          const res = tpl(eqObj.item, testRole, testZone, eqObj.activity);
          candObs = `${shiftCtx} ${microLoc}, ${res.obs.charAt(0).toLowerCase() + res.obs.slice(1)}`;
          candAct = `${res.act} (${scrutinyAct})`;
        } else {
          if (targetAssessment === 'Unsafe' || targetObsType === 'STOP Work Authority (SWA)') {
            const swaScenario = SWA_INTERVENTION_SCENARIOS[(swaOffset + i + fbAttempt * 3) % SWA_INTERVENTION_SCENARIOS.length];
            const baseObs = swaScenario.obs(eqObj.item, testRole, testZone, eqObj.activity);
            candObs = `${shiftCtx} ${microLoc}, ${baseObs.charAt(0).toLowerCase() + baseObs.slice(1)}`;
            candAct = `${swaScenario.act(eqObj.item, testRole, testZone)} (${scrutinyAct})`;
            targetObsType = 'STOP Work Authority (SWA)';
            targetAssessment = 'Unsafe';
          } else {
            const cndScenario = SAFE_CONDITION_FINDINGS[(cndOffset + i + fbAttempt * 5) % SAFE_CONDITION_FINDINGS.length];
            const opener = SAFE_CONDITION_OPENERS[(openerOffset + i + fbAttempt * 2) % SAFE_CONDITION_OPENERS.length];
            candObs = `${shiftCtx} ${microLoc}, ${opener(eqObj.item, testZone, eqObj.activity).toLowerCase()}, ${cndScenario.finding}.`;
            candAct = `${cndScenario.action(testRole, eqObj.item, testZone)} (${scrutinyAct})`;
          }
        }

        const lowerCand = candObs.toLowerCase().trim();
        const normCand = normalizeSemanticCore(candObs);
        if (!seenObsSet.has(lowerCand) && !seenNormSet.has(normCand) && !isContentBlacklisted(candObs, blacklist)) {
          finalObs = candObs;
          finalAct = candAct;
          finalZone = testZone;
          finalRole = testRole;
          break;
        }
      }

      // Final ultimate safeguard: synthesize unique operational descriptor if all 25 fallback attempts were saturated
      if (!finalObs) {
        const eqObj = RIG_50_EQUIPMENT[(eqPrimeOffset + i * 13) % RIG_50_EQUIPMENT.length];
        finalZone = normalizeToOfficialZone(eqObj.zone);
        finalRole = RIG_50_ROLES[(i * 7) % RIG_50_ROLES.length];
        const shiftCtx = DYNAMIC_SHIFT_CONTEXTS[(i * 17) % DYNAMIC_SHIFT_CONTEXTS.length];
        const microLoc = DYNAMIC_MICRO_LOCATIONS[(i * 23) % DYNAMIC_MICRO_LOCATIONS.length];
        const scrutinyAct = DYNAMIC_SCRUTINY_ACTIONS[(i * 29) % DYNAMIC_SCRUTINY_ACTIONS.length];
        const cycleCode = `Tag-${((i * 137 + 101) % 8999) + 1000}`;

        if (cardTheme === 'humor') {
          const tpl = UNIQUE_HUMOR_TEMPLATES[(i + 13) % UNIQUE_HUMOR_TEMPLATES.length];
          const res = tpl(eqObj.item, finalRole, finalZone, eqObj.activity);
          finalObs = `${shiftCtx} ${microLoc} during ${eqObj.activity}, ${res.obs.charAt(0).toLowerCase() + res.obs.slice(1)}`;
          finalAct = `${res.act} (${scrutinyAct} - ${cycleCode})`;
        } else if (cardTheme === 'music') {
          const tpl = UNIQUE_MUSIC_TEMPLATES[(i + 13) % UNIQUE_MUSIC_TEMPLATES.length];
          const res = tpl(eqObj.item, finalRole, finalZone, eqObj.activity);
          finalObs = `${shiftCtx} ${microLoc} during ${eqObj.activity}, ${res.obs.charAt(0).toLowerCase() + res.obs.slice(1)}`;
          finalAct = `${res.act} (${scrutinyAct} - ${cycleCode})`;
        } else if (cardTheme === 'cinema') {
          const tpl = UNIQUE_CINEMA_TEMPLATES[(i + 13) % UNIQUE_CINEMA_TEMPLATES.length];
          const res = tpl(eqObj.item, finalRole, finalZone, eqObj.activity);
          finalObs = `${shiftCtx} ${microLoc} during ${eqObj.activity}, ${res.obs.charAt(0).toLowerCase() + res.obs.slice(1)}`;
          finalAct = `${res.act} (${scrutinyAct} - ${cycleCode})`;
        } else if (cardTheme === 'wisdom') {
          const tpl = UNIQUE_WISDOM_TEMPLATES[(i + 13) % UNIQUE_WISDOM_TEMPLATES.length];
          const res = tpl(eqObj.item, finalRole, finalZone, eqObj.activity);
          finalObs = `${shiftCtx} ${microLoc} during ${eqObj.activity}, ${res.obs.charAt(0).toLowerCase() + res.obs.slice(1)}`;
          finalAct = `${res.act} (${scrutinyAct} - ${cycleCode})`;
        } else if (cardTheme === 'military') {
          const tpl = UNIQUE_MILITARY_TEMPLATES[(i + 13) % UNIQUE_MILITARY_TEMPLATES.length];
          const res = tpl(eqObj.item, finalRole, finalZone, eqObj.activity);
          finalObs = `${shiftCtx} ${microLoc} during ${eqObj.activity}, ${res.obs.charAt(0).toLowerCase() + res.obs.slice(1)}`;
          finalAct = `${res.act} (${scrutinyAct} - ${cycleCode})`;
        } else if (cardTheme === 'sports') {
          const tpl = UNIQUE_SPORTS_TEMPLATES[(i + 13) % UNIQUE_SPORTS_TEMPLATES.length];
          const res = tpl(eqObj.item, finalRole, finalZone, eqObj.activity);
          finalObs = `${shiftCtx} ${microLoc} during ${eqObj.activity}, ${res.obs.charAt(0).toLowerCase() + res.obs.slice(1)}`;
          finalAct = `${res.act} (${scrutinyAct} - ${cycleCode})`;
        } else {
          const cndScenario = SAFE_CONDITION_FINDINGS[(cndOffset + i) % SAFE_CONDITION_FINDINGS.length];
          finalObs = `${shiftCtx} ${microLoc} while ${eqObj.activity} in ${finalZone}, confirmed ${eqObj.item} inspected and ${cndScenario.finding}.`;
          finalAct = `${cndScenario.action(finalRole, eqObj.item, finalZone)} (${scrutinyAct} - ${cycleCode})`;
        }
      }
    }

    seenObsSet.add(finalObs.toLowerCase().trim());
    seenNormSet.add(normalizeSemanticCore(finalObs));
    seenActSet.add(finalAct.toLowerCase().trim());

    const sanitizeCardText = (txt: string) => {
      if (!txt) return '';
      return txt
        .replace(/\s*\[\s*tour\s*verification[^\]]*\]/gi, '')
        .replace(/\s*tour\s*verification/gi, 'safety check')
        .replace(/\bpre-tour\b/gi, 'pre-shift')
        .replace(/\bpost-tour\b/gi, 'post-shift')
        .replace(/\btour safety log\b/gi, 'daily shift safety log')
        .replace(/\btour report\b/gi, 'daily shift report')
        .replace(/\btour records\b/gi, 'daily safety log')
        .replace(/\btour debrief\b/gi, 'shift debrief')
        .replace(/\btours\b/gi, 'shifts')
        .replace(/\btour\b/gi, 'shift')
        .trim();
    };

    cards.push({
      id: `ai_gen_${chosenSeed}`,
      categoryTheme: cardTheme as any,
      cardCategory: category,
      zone: finalZone,
      role: finalRole,
      assessment: targetAssessment,
      obsType: targetObsType,
      category: targetAssessment === 'Safe' ? 'Safe Behavior Observation' : 'General Operational Safety',
      observation: sanitizeCardText(finalObs),
      action: sanitizeCardText(finalAct)
    });
  }

  if (usedIdeaIds.length > 0) {
    incrementIdeaUsageInFirestore(usedIdeaIds).catch(() => {});
  }

  return cards;
}

/**
 * Calls backend Gemini AI endpoint to fetch single unique card using seed and context.
 */
export async function fetchAiCardWithSeedAndContext(options: {
  iteration: number;
  seed: string;
  context: string;
  category: CardCategoryType;
  theme: string;
  assessmentFilter: string;
  blacklist?: string[];
  trainingIdeas?: any[];
}): Promise<SoarCardTemplate | null> {
  try {
    const res = await fetch('/api/generate-single-ai-card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.card) {
        const c = data.card;
        const validObsTypes = ['STOP Work Authority (SWA)', 'Behavior Observation', 'Condition', 'Stop Work Authority Drill'];
        const resolvedObsType = validObsTypes.includes(c.obsType)
          ? c.obsType
          : (options.iteration % 3 === 0 ? 'Condition' : options.iteration % 3 === 1 ? 'STOP Work Authority (SWA)' : 'Behavior Observation');

        if (Array.isArray(options.trainingIdeas) && options.trainingIdeas.length > 0) {
          const activeIds = options.trainingIdeas
            .filter((i: any) => i && i.isActive !== false && i.id)
            .slice(0, 3)
            .map((i: any) => i.id);
          if (activeIds.length > 0) {
            incrementIdeaUsageInFirestore(activeIds).catch(() => {});
          }
        }

        const resolvedAssessment: 'Safe' | 'Unsafe' = resolvedObsType === 'STOP Work Authority (SWA)'
          ? 'Unsafe'
          : (options.category === 'Safe' ? 'Safe' : (c.assessment || 'Safe'));

        return {
          id: `gemini_seed_${options.seed}`,
          categoryTheme: (options.theme === 'humor' || options.theme === 'music' ? options.theme : 'operations') as any,
          cardCategory: options.category,
          zone: normalizeToOfficialZone(c.zone || 'Rig Floor'),
          role: c.role || 'Floorman',
          assessment: resolvedAssessment,
          obsType: resolvedObsType,
          category: resolvedAssessment === 'Safe' ? 'Safe Behavior Observation' : 'General Operational Safety',
          observation: c.observation,
          action: c.action
        };
      }
    }
  } catch (err) {
    console.warn('Backend single AI card generation failed:', err);
  }
  return null;
}
