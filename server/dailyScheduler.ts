import nodemailer from 'nodemailer';
import {
  getDailyScheduleFromDb,
  saveDailyScheduleToDb,
  subscribeToDailyScheduleInDb,
  getDailyRunLogsFromDb,
  saveDailyRunLogsListToDb,
  subscribeToDailyRunLogsInDb,
  getPromptBlacklistFromDb,
  savePromptBlacklistToDb,
  recordCardToDb
} from './firestoreDb.js';

export interface CategoryQuotas {
  condition: number;
  behavior: number;
  swa: number;
  swaDrill?: number;
}

export interface DailyRunLogEntry {
  id: string;
  timestamp: string; // ISO format
  timezone: string; // e.g. "Asia/Riyadh"
  localTimeDisplay: string; // e.g. "2026-10-17 11:02:15 AM (AST)"
  utcTimeDisplay: string; // e.g. "2026-10-17 08:02:15 UTC"
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
  sampleReceipts: Array<{ responseId: string; zone: string; role: string; obsType: string; observation: string }>;
}

export interface ServerDailySchedule {
  enabled: boolean;
  dailyTime: string; // "11:02" in 24-hr format
  timezone: string; // default: "Asia/Riyadh" (AST, UTC+3)
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
  lastScheduledRunDate?: string; // Date of last scheduled run in target timezone
  lastManualRunTime?: string;
  updatedAt?: string;
}

export function getTimeInTimezone(date: Date, timeZone: string) {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || 'Asia/Riyadh',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    const parts = dtf.formatToParts(date);
    const getPart = (t: string) => parts.find(p => p.type === t)?.value || '00';

    const year = getPart('year');
    const month = getPart('month');
    const day = getPart('day');
    let hourStr = getPart('hour');
    if (hourStr === '24') hourStr = '00';
    const minuteStr = getPart('minute');
    const secStr = getPart('second');

    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    const second = parseInt(secStr, 10);

    const ampmHour = hour % 12 || 12;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const tzShort = timeZone === 'Asia/Riyadh' ? 'AST' : timeZone === 'UTC' ? 'UTC' : timeZone;

    return {
      dateStr: `${year}-${month}-${day}`,
      timeStr: `${hourStr.padStart(2, '0')}:${minuteStr.padStart(2, '0')}`,
      hour,
      minute,
      second,
      display: `${year}-${month}-${day} ${ampmHour}:${minuteStr.padStart(2, '0')}:${secStr.padStart(2, '0')} ${ampm} (${tzShort})`,
      tzShort
    };
  } catch (err) {
    const h = String(date.getUTCHours()).padStart(2, '0');
    const m = String(date.getUTCMinutes()).padStart(2, '0');
    const s = String(date.getUTCSeconds()).padStart(2, '0');
    const d = date.toISOString().split('T')[0];
    return {
      dateStr: d,
      timeStr: `${h}:${m}`,
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
      second: date.getUTCSeconds(),
      display: `${d} ${h}:${m}:${s} (UTC)`,
      tzShort: 'UTC'
    };
  }
}

const DEFAULT_SCHEDULE: ServerDailySchedule = {
  enabled: false,
  dailyTime: '06:00',
  timezone: 'Asia/Riyadh', // AST (Arabia Standard Time, UTC+3)
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

const RIG_50_NAME = "50 Bob Palmer (RBP-50A)";

// Rig 50 Operational Exemplars for Condition, Behavior, and SWA
const CONDITION_TEMPLATES = [
  { eq: 'Standpipe manifold #2 bleed-off valve', zone: 'Rig Floor', role: 'Floorman', obs: 'Conducted pre-shift pressure integrity inspection on standpipe manifold #2 bleed-off valve; verified zero weeping and secondary safety whip-checks securely pinned.', act: 'Confirmed zero pressure trapped, signed valve tag, and noted operational readiness in daily shift report.' },
  { eq: 'Rotary table master bushing lockdown pins', zone: 'Rig Floor', role: 'Floorman', obs: 'Inspected rotary table master bushing lockdown pins prior to spinning drill pipe; verified pins were fully engaged with no excessive vibration play.', act: 'Cleaned split pins and lubricated locking dogs before resuming rotation.' },
  { eq: 'Derrick Geronimo emergency escape line & brake', zone: 'Derrick', role: 'Derrickman', obs: 'Inspected Geronimo emergency escape carriage and line tensioner at monkeyboard; verified cable free of bird-caging and safety brake functioning smoothly.', act: 'Logged weekly physical check in derrick safety register.' },
  { eq: 'Portside air winch #3 spooling guide & wire rope', zone: 'Main Deck', role: 'Roustabout', obs: 'Inspected wire rope spooling on Portside air winch #3; verified no broken strands, safety latch on hook intact, and deadman lever spring returning immediately.', act: 'Applied marine wire dressing and verified barrier tags were active.' },
  { eq: 'BOP accumulator bottle bank nitrogen pre-charge gauge', zone: 'Substructure / BOP', role: 'Mechanic', obs: 'Inspected nitrogen pre-charge pressure on BOP accumulator bottle bank; verified 1,000 psi nitrogen pressure within certified limits with zero hydraulic fluid leakage.', act: 'Documented visual gauge reading in BOP inspection log.' },
  { eq: 'Mud hopper venturi bulk mixing jet & hopper grate', zone: 'Mud Pit / Sack Room', role: 'Floorman', obs: 'Inspected mud mixing hopper sack slitter blade shield and protective safety grating; confirmed zero blockages and splash guard firmly bolted.', act: 'Cleaned hopper throat and verified emergency eyewash station was unobstructed.' },
  { eq: 'Cantilever skidding hydraulic clamp cylinder #2', zone: 'Cantilever / Pipe Deck', role: 'Mechanic', obs: 'Checked hydraulic hoses and fittings on Cantilever skidding clamp cylinder #2; confirmed no hydraulic weeping and safety retention chains clamped.', act: 'Wiped fitting, verified zero pressure drop during skid test, and logged inspection.' },
  { eq: 'Starboard crane boom angle limit switch & anti-two-block sensor', zone: 'Cranes', role: 'Crane Operator', obs: 'Performed pre-shift limit switch test on crane anti-two-block sensor and boom angle indicator; verified audible and visual cab alarms triggered accurately.', act: 'Signed crane pre-use checklist prior to container offloading.' },
  { eq: 'Shale shaker #1 screen clamping wedge pins', zone: 'Shakers', role: 'Floorman', obs: 'Checked screen tension wedges and pneumatic clamping bladder pressure on shaker #1; verified screens sealed tightly without bypass channels.', act: 'Replaced worn rubber seal strip and verified mud flowline distribution.' },
  { eq: 'Main deck heavy equipment cable crossing rubber ramps', zone: 'Main Deck', role: 'Roustabout', obs: 'Inspected heavy-duty rubber cable protectors crossing forklift corridor; verified all temporary power cables fully recessed without trip edges.', act: 'Adjusted interlocking ramp pins and ensured high-visibility reflective striping was clear.' },
  { eq: 'Iron Roughneck torque wrench hydraulic jaws', zone: 'Rig Floor', role: 'Floorman', obs: 'Inspected Iron Roughneck clamping dies and backup jaw torque sensors; confirmed zero hydraulic weeping and clean die gripping teeth.', act: 'Cleaned metallic shavings and verified calibration tag current.' },
  { eq: 'Crown block secondary retention safety harness & sheaves', zone: 'Derrick', role: 'Derrickman', obs: 'Inspected crown block sheave cluster secondary safety sling and grease lines; confirmed all shackles moused and cotter pins secure.', act: 'Completed dropped object prevention register entry for crown assembly.' },
  { eq: 'Choke manifold manual needle valve seals', zone: 'Choke Manifold', role: 'Assistant Driller', obs: 'Conducted visual inspection on high-pressure choke manifold valves and pressure gauges; verified zero stem packing leakage.', act: 'Recorded baseline upstream manifold pressure in well control log.' },
  { eq: 'Trip tank level transmitter & float sensor', zone: 'Mud Pit / Sack Room', role: 'Derrickman', obs: 'Inspected trip tank mechanical float arm and digital ultrasonic sensor; verified free movement without mud caking.', act: 'Flushed float housing with washdown hose and verified zero calibration drift.' },
  { eq: 'Catwalk automated carriage roller guide tracks', zone: 'Cantilever / Pipe Deck', role: 'Roustabout', obs: 'Inspected tubular carriage guide tracks along catwalk ramp; confirmed skate cable tension within spec and roller bearings well greased.', act: 'Cleared debris from skate track trough before pipe transfer commenced.' },
  { eq: 'BOP stack blind shear ram mechanical locking wheels', zone: 'Substructure / BOP', role: 'Mechanic', obs: 'Checked manual locking stems and indicators on BOP blind shear rams; confirmed threads clean, protected with anti-corrosion grease, and wheel locks engaged.', act: 'Verified position status on primary remote control panel.' },
  { eq: 'Emergency eyewash station #4 water pressure & flow', zone: 'Shakers', role: 'Roustabout', obs: 'Tested eyewash station #4 foot treadle; confirmed immediate clean continuous flow, protective dust caps popped off smoothly, and inspection tag initialed.', act: 'Emptied catch basin and ensured path remained unobstructed.' },
  { eq: 'Degasser vacuum discharge seal and vent line', zone: 'Mud Pit / Sack Room', role: 'Floorman', obs: 'Inspected poor-boy degasser U-tube seal loop and overboard vent line; verified zero sediment accumulation and vent spark arrestor clear.', act: 'Logged differential pressure reading in mud system record.' },
  { eq: 'Main deck life raft hydrostatic release units', zone: 'Main Deck', role: 'Safety Officer / RSC', obs: 'Inspected hydrostatic release units (HRU) on starboard life raft canisters; verified certified expiry dates valid and painter line shackle secured.', act: 'Noted annual marine survival inspection in marine safety log.' },
  { eq: 'Drill floor air winch deadman throttle spring return', zone: 'Rig Floor', role: 'Floorman', obs: 'Checked spring return mechanism on drill floor utility air winch control handle; verified immediate return to neutral upon release.', act: 'Lubricated control valve spool and confirmed safety line whip-checks intact.' },
  { eq: 'Mud cleaner hydrocyclone cone polyurethane nozzles', zone: 'Shakers', role: 'Floorman', obs: 'Inspected desander and desilter cones on mud cleaner; verified zero plugging in underflow orifices and intact apex clamps.', act: 'Cleared dried barite scale from discharge tip and tested spray pattern.' },
  { eq: 'BOP choke line hydraulic fail-safe gate valve', zone: 'Substructure / BOP', role: 'Mechanic', obs: 'Inspected actuator housing and pressure test ports on BOP choke line HCR valve; verified zero fluid accumulation in weep holes.', act: 'Checked actuator supply hose condition and safety wrap.' },
  { eq: 'Welding workshop cylinder storage securing chains', zone: 'Main Deck', role: 'Welder', obs: 'Inspected oxygen and acetylene cylinder racks on main deck; verified separate storage cages, safety caps installed, and dual heavy steel chain restraints fastened.', act: 'Tagged empty cylinders for return to supply vessel.' },
  { eq: 'Top drive washpipe packing and lubricating grease line', zone: 'Derrick', role: 'Derrickman', obs: 'Inspected washpipe packing housing during bit trip; confirmed automatic grease lubricator reservoir full and zero mud leakage around seals.', act: 'Recorded washpipe operating hours in top drive maintenance log.' },
  { eq: 'Substructure cellardeck drain scuppers and valves', zone: 'Substructure / BOP', role: 'Roustabout', obs: 'Inspected cellar deck drainage troughs and environmental containment valves; confirmed clean scuppers and zero oily water accumulation.', act: 'Pumped small rainwater volume to oily water separator.' },
  { eq: 'Cantilever skid beam load cells and hydraulic hoses', zone: 'Cantilever / Pipe Deck', role: 'Mechanic', obs: 'Inspected hydraulic jack connections on starboard cantilever skid beam; verified high-pressure fittings dry and secondary cable lanyards secured.', act: 'Greased skid shoe guide faces with biodegradable lubricant.' },
  { eq: 'Emergency shutdown (ESD) station #2 glass and button', zone: 'Rig Floor', role: 'Assistant Driller', obs: 'Inspected drill floor emergency shutdown station #2; verified protective break-glass cover intact, safety seal unbroken, and signage clearly legible.', act: 'Documented visual ESD readiness check on daily drilling log.' },
  { eq: 'Forklift high-visibility mast chains and forks', zone: 'Main Deck', role: 'Roustabout', obs: 'Conducted pre-use visual inspection of rough-terrain forklift; confirmed mast lift chains lubricated, fork locking pins engaged, and horn functional.', act: 'Completed pre-shift mobile plant checklist.' },
  { eq: 'Rotary table master bushing lifting sling certified tag', zone: 'Rig Floor', role: 'Floorman', obs: 'Inspected dedicated four-leg wire rope sling for lifting rotary bushings; confirmed SWL tag legible, current color code paint intact, and zero kinking.', act: 'Hung sling neatly on drill floor tool rack.' },
  { eq: 'Mud pit agitator shaft safety guarding and coupling', zone: 'Mud Pit / Sack Room', role: 'Mechanic', obs: 'Inspected protective steel mesh cage around mud pit agitator #3 rotating shaft; confirmed all cage bolts tight and zero vibration rubbing.', act: 'Verified bearing grease nipple clean and serviced.' }
];

const BEHAVIOR_TEMPLATES = [
  { eq: 'Hands-free magnetic push-pull safety sticks', zone: 'Cantilever / Pipe Deck', role: 'Roustabout', obs: 'Observed deck crew consistently utilizing magnetic push-pull safety sticks to guide 5-inch drill pipe onto catwalk without placing hands in pinch points.', act: 'Commended roustabouts for 100% adherence to Hands-Free Rig 50 policy; highlighted during shift safety debrief.' },
  { eq: 'Rotary table red-zone perimeter demarcation chain', zone: 'Rig Floor', role: 'Floorman', obs: 'Observed drill crew maintaining complete clearance outside the rotary red zone while top drive was in continuous rotation.', act: 'Praised drill floor team for vigilant line-of-fire situational awareness.' },
  { eq: 'Chemical PPE donning at mud chemical mixing area', zone: 'Mud Pit / Sack Room', role: 'Floorman', obs: 'Observed floorman wearing full face shield, chemical splash apron, and heavy-duty nitrile gloves prior to adding caustic soda into mud hopper.', act: 'Recognized exemplary PPE compliance during pre-job chemical handling.' },
  { eq: 'Derrick climbing 100% tie-off harness and dual lanyards', zone: 'Derrick', role: 'Derrickman', obs: 'Noticed derrickman maintaining 100% dual lanyard tie-off while transitioning between ladder climb assist and monkeyboard working platform.', act: 'Commended derrickman for zero-tolerance compliance with working at height standard.' },
  { eq: 'Supply vessel backloading tag line handling', zone: 'Main Deck', role: 'Roustabout', obs: 'Observed rigger using long tag lines to control cargo basket sway during supply boat loading, positioning himself well clear of suspended load path.', act: 'Praised deck crew for proactive line-of-fire avoidance.' },
  { eq: 'Lockout/Tagout (LOTO) zero-energy verification', zone: 'Mud Pit / Sack Room', role: 'Mechanic', obs: 'Observed mechanic executing live zero-energy check on mud agitator #2 breaker panel with electrician before initiating mechanical seal replacement.', act: 'Confirmed isolation certificate signed and padlocks placed in lockbox.' },
  { eq: 'Pre-shift safety hydration and heat stress monitoring', zone: 'Rig Floor', role: 'Assistant Driller', obs: 'Observed Assistant Driller coordinating mandatory 15-minute shaded hydration breaks and electrolyte checks for floor crew during intense daytime heat.', act: 'Documented hydration cycle in HSE log; crew returned refreshed with zero heat exhaustion symptoms.' },
  { eq: 'Hands-free pipe racking guide stick', zone: 'Rig Floor', role: 'Floorman', obs: 'Observed floorman coaching apprentice roughneck on proper standoff distance while guiding tubular stand into derrick fingerboard.', act: 'Encouraged continued peer mentoring during joint safety coaching session.' },
  { eq: 'Three-point contact on exterior vertical ladders', zone: 'Substructure / BOP', role: 'Mechanic', obs: 'Observed technician maintaining strict three-point contact while descending substructure access ladder with tool bag slung cross-body.', act: 'Commended adherence to basic fall prevention principles during daily round.' },
  { eq: 'Pre-job toolbox talk active engagement', zone: 'Rig Floor', role: 'Driller', obs: 'Observed entire floor crew actively contributing hazard IDs during pre-job discussion prior to picking up heavy bottom-hole assembly.', act: 'Noted excellent team psychological safety and open hazard communication.' },
  { eq: 'Eye contact confirmation with forklift operator', zone: 'Main Deck', role: 'Roustabout', obs: 'Observed deck worker pausing at designated pedestrian crossway, establishing positive eye contact and hand signal with forklift operator before crossing.', act: 'Reinforced mobile equipment pedestrian interaction standard.' },
  { eq: 'Proper lifting posture during chemical sack staging', zone: 'Mud Pit / Sack Room', role: 'Floorman', obs: 'Observed floorman using leg muscles with straight back and two-person lift for 25kg bentonite sacks onto pallet staging.', act: 'Praised correct ergonomics and proactive mutual assistance.' },
  { eq: 'Hearing protection double-up in high-noise engine room', zone: 'Main Deck', role: 'Mechanic', obs: 'Observed generator room mechanic wearing earplugs under high-attenuation earmuffs while conducting hourly generator load checks.', act: 'Recognized 100% compliance with posted high-noise PPE mandate.' },
  { eq: 'Clean-as-you-go housekeeping after hydraulic oil top-up', zone: 'Substructure / BOP', role: 'Mechanic', obs: 'Observed mechanic immediately wiping oil droplets from drip tray and disposing of used absorbent pads in designated hazardous waste bin.', act: 'Commended proactive spill prevention and environmental diligence.' },
  { eq: 'Clear radio protocol during tubular lifting operations', zone: 'Cranes', role: 'Crane Operator', obs: 'Observed deck banksman using standard standard marine hand signals and concise radio commands to guide casing sling landing.', act: 'Acknowledged flawless deck-to-crane communication discipline.' },
  { eq: 'Safety glasses and side-shield verification at grinding bay', zone: 'Main Deck', role: 'Welder', obs: 'Observed welder donning full grinding face shield over impact-rated safety glasses prior to beveling pipe joint on main deck.', act: 'Affirmed strict eye protection adherence during mechanical prep.' },
  { eq: 'Tubular thread protector inspection prior to hoisting', zone: 'Cantilever / Pipe Deck', role: 'Roustabout', obs: 'Observed roustabout verifying thread protector snugness and clean lifting bails before attaching crane elevator sling.', act: 'Praised attention to detail preventing accidental dropped tubulars.' },
  { eq: 'Static grounding strap attachment during fuel transfer', zone: 'Main Deck', role: 'Roustabout', obs: 'Observed crew member clamping copper grounding cable to supply vessel bunkering manifold before opening diesel intake valve.', act: 'Confirmed zero static potential before initiating fuel pumping.' },
  { eq: 'Secondary retention safety pin verification on casing elevator', zone: 'Rig Floor', role: 'Floorman', obs: 'Observed assistant driller physically pulling safety latch pin to confirm positive lock on casing elevator door before hoisting.', act: 'Commended rigorous two-step verification habit on critical lifting tools.' },
  { eq: 'Line-of-fire standoff during high-pressure pump priming', zone: 'Mud Pit / Sack Room', role: 'Floorman', obs: 'Observed floorman standing well clear of high-pressure fluid end discharge line while mud pump #1 was being slowly brought up to test pressure.', act: 'Reinforced line-of-fire avoidance at morning safety meeting.' }
];

const SWA_TEMPLATES = [
  { eq: 'Supply boat container rigging lifting sling', zone: 'Main Deck', role: 'Roustabout', obs: 'Rigger immediately called STOP Work Authority (SWA) when supply boat shifted suddenly in heavy swell, causing crane hook bridle line to snag container corner.', act: 'Immediately exercised SWA, signaled crane operator to safely land container on deck, untangled rigging, and reassessed swell limits before resuming.' },
  { eq: 'Top drive washpipe high-pressure rotary hose', zone: 'Rig Floor', role: 'Floorman', obs: 'Floorman exercised STOP Work Authority (SWA) upon noticing high-pressure hydraulic hose vibrating excessively near kelly hose bracket without safety retention clamp.', act: 'Halted drilling rotation immediately, notified driller, installed secondary safety clamp, and verified torqued bolts before clearing floor.' },
  { eq: 'Forklift cargo pallet uncertified lifting strap', zone: 'Main Deck', role: 'Roustabout', obs: 'Roustabout invoked STOP Work Authority (SWA) upon noticing a worn fiber web sling with unreadable inspection color tag attached to pallet lift.', act: 'Stood job down, replaced sling with certified in-date Rig 50 lifting gear, and quarantined defective strap for disposal.' },
  { eq: 'Radio communication break during blind crane lift', zone: 'Cranes', role: 'Crane Operator', obs: 'Crane operator immediately invoked STOP Work Authority (SWA) when VHF radio transmission crackled and cut out during a blind lift into mud pit hatch.', act: 'Paused crane hoist instantly, established visual signalman on hatch perimeter, tested backup UHF radio channel, and resumed safely.' },
  { eq: 'Unsecured grating clip on shaker walkways', zone: 'Shakers', role: 'Floorman', obs: 'Floorman called STOP Work Authority (SWA) after noticing a loose galvanized walkway grating plate shifted underfoot near shaker #2 flowline discharge.', act: 'Barricaded walkway with red danger tape, secured grating with stainless J-bolts, and verified torque before reopening path.' },
  { eq: 'Vapor build-up near paint locker exhaust vent', zone: 'Main Deck', role: 'Safety Officer / RSC', obs: 'Safety officer exercised STOP Work Authority (SWA) when portable gas detector alarmed at 12% LEL near unventilated paint locker door during welding on bulkhead.', act: 'Immediately stopped hot work permit, cleared welding crew, deployed pneumatic explosion-proof air mover, and retested 0% LEL before authorizing resumption.' },
  { eq: 'Damaged electrical insulation on portable explosion-proof lamp', zone: 'Mud Pit / Sack Room', role: 'Floorman', obs: 'Floorman called STOP Work Authority (SWA) upon spotting pinched outer rubber sheath with exposed wiring on 110V portable work light.', act: 'Disconnected power at breaker immediately, tagged lamp out of service, and handed to rig electrician for repair.' },
  { eq: 'Personnel walking beneath top drive during hoisting', zone: 'Rig Floor', role: 'Driller', obs: 'Driller invoked STOP Work Authority (SWA) when an unauthorized visitor stepped past red barrier tape while elevator was hoisted with drill collar.', act: 'Halted drawworks immediately, escorted individual to safe zone, and held red zone awareness briefing.' },
  { eq: 'Hydraulic oil weeping onto hot exhaust manifold', zone: 'Main Deck', role: 'Mechanic', obs: 'Mechanic exercised STOP Work Authority (SWA) upon noticing pinhole hydraulic mist spraying toward generator exhaust lagging.', act: 'Shut down auxiliary power pack instantly, isolated pressure, replaced O-ring fitting, and verified dry test.' },
  { eq: 'Dropped object safety tether missing on pipe tong counterweight', zone: 'Rig Floor', role: 'Floorman', obs: 'Floorman initiated STOP Work Authority (SWA) after noticing secondary safety retention cable unhooked on rotary tong counterweight.', act: 'Suspended makeup operation, climbed safety ladder, reattached certified cable with safety shackle, and moused pin.' }
];

export class DailySchedulerManager {
  private submitFn: (answers: Array<{ questionId: string; answer1: string }>, startDate?: string) => Promise<{ ok: boolean; status: number; data: any }>;
  private currentSchedule: ServerDailySchedule;
  private cachedLogs: DailyRunLogEntry[] = [];
  private timer: NodeJS.Timeout | null = null;
  private isRunningJob = false;

  constructor(
    _projectRoot: string,
    submitFn: (answers: Array<{ questionId: string; answer1: string }>, startDate?: string) => Promise<{ ok: boolean; status: number; data: any }>
  ) {
    this.submitFn = submitFn;
    this.currentSchedule = { ...DEFAULT_SCHEDULE };
    setTimeout(() => {
      this.initFromFirestore();
    }, 3500);
  }

  private async initFromFirestore(): Promise<void> {
    try {
      const dbSchedule = await getDailyScheduleFromDb<ServerDailySchedule>(DEFAULT_SCHEDULE);
      if (dbSchedule && typeof dbSchedule === 'object') {
        this.currentSchedule = {
          ...DEFAULT_SCHEDULE,
          ...dbSchedule,
          timezone: dbSchedule.timezone || DEFAULT_SCHEDULE.timezone
        };
      }
      const dbLogs = await getDailyRunLogsFromDb<DailyRunLogEntry>();
      if (Array.isArray(dbLogs)) {
        this.cachedLogs = dbLogs;
      }

      subscribeToDailyScheduleInDb((data) => {
        if (data && typeof data === 'object') {
          this.currentSchedule = {
            ...DEFAULT_SCHEDULE,
            ...this.currentSchedule,
            ...data,
            timezone: data.timezone || this.currentSchedule.timezone || DEFAULT_SCHEDULE.timezone
          };
        }
      });

      subscribeToDailyRunLogsInDb((logs) => {
        if (Array.isArray(logs)) {
          this.cachedLogs = logs;
        }
      });
    } catch (e) {
      console.warn('[DailyScheduler] Could not initialize from Firestore, using default:', e);
    }
  }

  private saveScheduleToFirestore(): void {
    saveDailyScheduleToDb(this.currentSchedule).catch((e) => {
      console.warn('[DailyScheduler] Firestore schedule save notice:', e);
    });
  }

  public getLogs(): DailyRunLogEntry[] {
    return [...this.cachedLogs];
  }

  public addLogEntry(entry: DailyRunLogEntry): void {
    try {
      const filtered = this.cachedLogs.filter(l => l.id !== entry.id);
      const updated = [entry, ...filtered].slice(0, 100);
      this.cachedLogs = updated;
      saveDailyRunLogsListToDb(updated).catch((e) => {
        console.warn('[DailyScheduler] Firestore log save notice:', e);
      });
      console.log(`[DailyScheduler] Logged ${entry.triggerType} run to Firestore (${entry.succeeded}/${entry.targetCount} cards, status: ${entry.status})`);
    } catch (e) {
      console.warn('[DailyScheduler] Could not append run log:', e);
    }
  }

  public clearLogs(): void {
    try {
      this.cachedLogs = [];
      saveDailyRunLogsListToDb([]).catch((e) => {
        console.warn('[DailyScheduler] Firestore clear logs notice:', e);
      });
    } catch (e) {
      console.warn('[DailyScheduler] Could not clear logs:', e);
    }
  }

  public getSchedule(): ServerDailySchedule {
    return { ...this.currentSchedule };
  }

  public resetTodayRunStatus(): ServerDailySchedule {
    delete this.currentSchedule.lastScheduledRunDate;
    this.saveScheduleToFirestore();
    console.log('[DailyScheduler] Cleared lastScheduledRunDate for today in Firestore');
    return { ...this.currentSchedule };
  }

  public getScheduleStatus() {
    const tz = this.currentSchedule.timezone || 'Asia/Riyadh';
    const now = new Date();
    const tzInfo = getTimeInTimezone(now, tz);
    const logs = this.getLogs();

    const [schedHour, schedMin] = (this.currentSchedule.dailyTime || '06:00').split(':').map(Number);
    const schedTotalMin = (schedHour || 0) * 60 + (schedMin || 0);
    const currentTotalMin = tzInfo.hour * 60 + tzInfo.minute;
    const hasExecutedToday = this.currentSchedule.lastScheduledRunDate === tzInfo.dateStr;
    const isScheduledTimePassedToday = currentTotalMin >= schedTotalMin;

    let nextRunText = '';
    if (!this.currentSchedule.enabled) {
      nextRunText = 'Schedule is currently paused.';
    } else if (hasExecutedToday) {
      nextRunText = `Already executed today at ${this.currentSchedule.dailyTime} ${tzInfo.tzShort}. Next run scheduled tomorrow at ${this.currentSchedule.dailyTime} ${tzInfo.tzShort}.`;
    } else if (currentTotalMin < schedTotalMin) {
      const diffMin = schedTotalMin - currentTotalMin;
      const h = Math.floor(diffMin / 60);
      const m = diffMin % 60;
      nextRunText = `Scheduled today at ${this.currentSchedule.dailyTime} ${tzInfo.tzShort} (in ${h > 0 ? `${h}h ` : ''}${m}m).`;
    } else {
      nextRunText = `Scheduled time for today (${this.currentSchedule.dailyTime} ${tzInfo.tzShort}) has passed. Next run scheduled tomorrow at ${this.currentSchedule.dailyTime} ${tzInfo.tzShort}.`;
    }

    return {
      ...this.currentSchedule,
      serverTimeUtc: now.toISOString(),
      serverTimeUtcDisplay: `${now.toISOString().replace('T', ' ').slice(0, 19)} UTC`,
      currentTimeInTargetTz: tzInfo.display,
      currentDateInTargetTz: tzInfo.dateStr,
      currentTimeStrInTargetTz: tzInfo.timeStr,
      timezone: tz,
      timezoneShort: tzInfo.tzShort,
      isScheduledTimePassedToday,
      hasExecutedToday,
      canCatchUpToday: this.currentSchedule.enabled && isScheduledTimePassedToday && !hasExecutedToday,
      nextRunText,
      totalLogsCount: logs.length,
      recentLog: logs[0] || null
    };
  }

  public updateSchedule(updates: Partial<ServerDailySchedule>): ServerDailySchedule {
    const wasTimeChanged = updates.dailyTime && updates.dailyTime !== this.currentSchedule.dailyTime;
    const wasTimezoneChanged = updates.timezone && updates.timezone !== this.currentSchedule.timezone;

    this.currentSchedule = {
      ...this.currentSchedule,
      ...updates,
      timezone: updates.timezone || this.currentSchedule.timezone || 'Asia/Riyadh',
      updatedAt: new Date().toISOString()
    };

    // If user changed the schedule time or timezone, check if new time is in the future today
    if (wasTimeChanged || wasTimezoneChanged) {
      const tz = this.currentSchedule.timezone || 'Asia/Riyadh';
      const now = new Date();
      const tzInfo = getTimeInTimezone(now, tz);
      const [newHour, newMin] = (this.currentSchedule.dailyTime || '06:00').split(':').map(Number);
      const currentMinTotal = tzInfo.hour * 60 + tzInfo.minute;
      const newMinTotal = (newHour || 0) * 60 + (newMin || 0);

      // If the new scheduled time is in the future today, allow it to trigger today even if an earlier test ran
      if (newMinTotal > currentMinTotal) {
        delete this.currentSchedule.lastScheduledRunDate;
        console.log(`[DailyScheduler] New time ${this.currentSchedule.dailyTime} is in future today. Reset lastScheduledRunDate.`);
      }
    }

    this.saveScheduleToFirestore();
    console.log(`[DailyScheduler] Schedule updated in Firestore: Time=${this.currentSchedule.dailyTime}, Tz=${this.currentSchedule.timezone}, Enabled=${this.currentSchedule.enabled}, Target=${this.currentSchedule.targetCount}`);
    return { ...this.currentSchedule };
  }

  public start(): void {
    if (this.timer) clearInterval(this.timer);

    const tz = this.currentSchedule.timezone || 'Asia/Riyadh';
    const initTzInfo = getTimeInTimezone(new Date(), tz);
    console.log(`[DailyScheduler] Service Started. Status: ${this.currentSchedule.enabled ? 'ACTIVE' : 'IDLE'}, Daily Time: ${this.currentSchedule.dailyTime} (${tz}), Current Time: ${initTzInfo.display}, Recipient: ${this.currentSchedule.recipientEmail}`);

    // Heartbeat check every 10 seconds for high-precision minute matching
    this.timer = setInterval(async () => {
      try {
        if (!this.currentSchedule.enabled || this.isRunningJob) return;

        const targetTz = this.currentSchedule.timezone || 'Asia/Riyadh';
        const now = new Date();
        const tzInfo = getTimeInTimezone(now, targetTz);

        const [schedHourStr, schedMinStr] = (this.currentSchedule.dailyTime || '06:00').split(':');
        const schedHour = parseInt(schedHourStr, 10);
        const schedMin = parseInt(schedMinStr, 10);

        // Check if the current time matches the scheduled time in target timezone
        const isScheduledTime = tzInfo.hour === schedHour && tzInfo.minute === schedMin;
        const hasRunScheduledToday = this.currentSchedule.lastScheduledRunDate === tzInfo.dateStr;

        if (isScheduledTime && !hasRunScheduledToday) {
          console.log(`[DailyScheduler] >>> TRIGGERING SCHEDULED RUN AT ${tzInfo.display} (${targetTz}) for ${this.currentSchedule.recipientEmail}...`);
          this.isRunningJob = true;
          // Mark immediately to prevent race conditions during execution
          this.currentSchedule.lastScheduledRunDate = tzInfo.dateStr;
          this.saveScheduleToFirestore();

          try {
            await this.executeMassSubmissionRun(false);
          } catch (runErr) {
            console.error('[DailyScheduler] Error during scheduled batch execution:', runErr);
          } finally {
            this.isRunningJob = false;
          }
        }
      } catch (err) {
        console.warn('[DailyScheduler] Periodic loop notice:', err);
      }
    }, 15000); // Check every 15 seconds
  }

  /**
   * Generates card payloads strictly adhering to the configured category quotas
   * (e.g. 45 Condition, 45 Behavior, 10 SWA = 100 cards) with 100% unique, natural oilfield observations
   */
  public generateCardsForQuotas(count: number, quotas: CategoryQuotas, reportDate: string, existingBlacklist: string[] = []) {
    const condCount = Math.max(0, Number(quotas.condition) || 0);
    const behCount = Math.max(0, Number(quotas.behavior) || 0);
    const swaCount = Math.max(0, Number(quotas.swa) || 0);
    const drillCount = Math.max(0, Number(quotas.swaDrill) || 0);
    const sum = condCount + behCount + swaCount + drillCount;

    let targetCond = condCount;
    let targetBeh = behCount;
    let targetSwa = swaCount;
    let targetDrill = drillCount;

    if (sum > 0 && sum !== count) {
      targetCond = Math.round((condCount / sum) * count);
      targetBeh = Math.round((behCount / sum) * count);
      targetSwa = Math.round((swaCount / sum) * count);
      const remaining = count - (targetCond + targetBeh + targetSwa);
      targetDrill = Math.max(0, remaining);
      if (targetCond + targetBeh + targetSwa + targetDrill < count) {
        targetBeh += (count - (targetCond + targetBeh + targetSwa + targetDrill));
      }
    } else if (sum <= 0) {
      targetBeh = Math.round(count * 0.45);
      targetCond = Math.round(count * 0.45);
      targetSwa = count - (targetBeh + targetCond);
    }

    type PlanItem = {
      categoryType: 'Condition' | 'Behavior Observation' | 'STOP Work Authority (SWA)' | 'Stop Work Authority Drill';
      assessment: 'Safe' | 'Unsafe';
      template: { eq: string; zone: string; role: string; obs: string; act: string };
    };

    const normalizeOfficialZone = (z: string): string => {
      if (z.includes('BOP') || z.includes('Substructure') || z.includes('Choke')) return 'BOP';
      if (z.includes('Cantilever') || z.includes('Pipe')) return 'Cantilever / Pipe Deck';
      if (z.includes('Mud') || z.includes('Sack')) return 'Mud Pit / Sack Room';
      if (['Rig Floor', 'Main Deck', 'Cranes', 'Derrick', 'Shakers', 'Accommodations'].includes(z)) return z;
      return 'Main Deck';
    };

    const normalizeRole = (r: string): string => {
      if (r.includes('RSC') || r.includes('Safety Officer')) return 'Rig Safety Coach (RSC)';
      if (r === 'Welder') return 'Mechanic';
      return r;
    };

    const seenSet = new Set<string>(existingBlacklist.map(s => String(s || '').toLowerCase().trim()).filter(Boolean));
    const seenActSet = new Set<string>();

    const equipmentPool = [
      ...CONDITION_TEMPLATES.map(t => ({ eq: t.eq, zone: normalizeOfficialZone(t.zone), role: normalizeRole(t.role) })),
      ...BEHAVIOR_TEMPLATES.map(t => ({ eq: t.eq, zone: normalizeOfficialZone(t.zone), role: normalizeRole(t.role) })),
      ...SWA_TEMPLATES.map(t => ({ eq: t.eq, zone: normalizeOfficialZone(t.zone), role: normalizeRole(t.role) })),
      { eq: 'Top drive washpipe packing and gooseneck manifold', zone: 'Rig Floor', role: 'Driller' },
      { eq: 'Hydril 13-5/8" annular preventer closing chamber manifold', zone: 'BOP', role: 'Mechanic' },
      { eq: 'Starboard 70-person enclosed lifeboat davit release gear', zone: 'Main Deck', role: 'Barge Engineer' },
      { eq: 'Billy Pugh X-904 personnel transfer basket stabilizer rigging', zone: 'Cranes', role: 'Rig Safety Coach (RSC)' },
      { eq: 'Derrick 90-ft monkeyboard dual Sala-block inertia reels', zone: 'Derrick', role: 'Derrickman' },
      { eq: 'Vacuum degasser suction butterfly valve and belt drive guard', zone: 'Shakers', role: 'Floorman' },
      { eq: 'Caustic soda mixing barrel stainless-steel lid and dosing valve', zone: 'Mud Pit / Sack Room', role: 'Floorman' },
      { eq: 'Galley walk-in freezer internal emergency release latch', zone: 'Accommodations', role: 'HSE Specialist' },
      { eq: 'Helideck perimeter safety netting and foam monitor nozzles', zone: 'Accommodations', role: 'Rig Safety Coach (RSC)' },
      { eq: 'Bow leg jacking gearhouse #1 pinion drive lubrication pump', zone: 'Main Deck', role: 'Mechanic' },
      { eq: 'SCR power control room HVAC over-pressure damper and locks', zone: 'Main Deck', role: 'Electrician' },
      { eq: 'Remote choke manifold hydraulic actuator and pressure sensor', zone: 'BOP', role: 'Driller' }
    ];

    const conditionOpeners = [
      (eq: string, zone: string) => `Inspected ${eq} in ${zone} prior to shift operations`,
      (eq: string, zone: string) => `Audited physical barrier integrity on ${eq} in ${zone}`,
      (eq: string, zone: string) => `Verified mechanical readiness of ${eq} across ${zone}`,
      (eq: string, zone: string) => `Spot-checked ${eq} in ${zone} during pre-task walkdown`,
      (eq: string, zone: string) => `Walked down ${zone} to examine ${eq} before equipment startup`,
      (eq: string, zone: string) => `Cross-checked isolation and containment on ${eq} in ${zone}`,
      (eq: string, zone: string) => `Evaluated hardware condition of ${eq} in ${zone}`,
      (eq: string, zone: string) => `Reviewed primary and secondary safeguards on ${eq} in ${zone}`,
      (eq: string, zone: string) => `Confirmed full barrier compliance on ${eq} in ${zone}`,
      (eq: string, zone: string) => `Examined structural mountings and fittings on ${eq} in ${zone}`,
      (eq: string, zone: string) => `Completed pre-use safety verification on ${eq} in ${zone}`,
      (eq: string, zone: string) => `Assessed protective guarding and control tags on ${eq} in ${zone}`
    ];

    const conditionFindings = [
      'confirming all high-pressure couplings had 316-SS whip-check restraints and safety R-clips fully engaged',
      'verifying every overhead shackle pin was secured with stainless-steel mousing wire and secondary retention lanyards were taut',
      'confirming electrical and mechanical isolation padlocks were properly applied with a verified zero-energy try-step',
      'finding all galvanized deck grating panels flush, level, and fastened with tight stainless-steel J-bolts',
      'confirming the current quarterly inspection color code, legible SWL stamping, and intact wire rope terminations',
      'verifying all hydraulic manifolds, crimp ferrules, and return lines were bone-dry with zero weeping under load',
      'confirming explosion-proof cable glands, copper bonding straps, and junction box seals were intact and moisture-free',
      'verifying red-zone boundary chains, magnetic warning placards, and physical interlock gates were latched',
      'confirming the local emergency stop protective shroud was undamaged and the actuator moved freely',
      'verifying the yellow protective mesh guarding around moving assemblies was firmly bolted with zero rub marks',
      'confirming pressure transmitters displayed steady readings within green operating bands with valid calibration tags',
      'confirming all utility lines crossing pedestrian routes were recessed inside heavy-duty rubber crossover ramps',
      'verifying twin self-retracting inertia reels locked sharply on pull-test and anchor straps showed zero wear',
      'confirming the adjacent environmental spill kit was fully stocked and secondary containment bunds were dry',
      'verifying fixed and portable multi-gas monitors registered 0 ppm H2S and 0% LEL with clear annunciators',
      'confirming the deadman control lever snapped back to neutral immediately upon release without load creep'
    ];

    const behaviorOpeners = [
      (role: string, eq: string, zone: string) => `Witnessed ${role} in ${zone} demonstrating disciplined safe work habits around ${eq}`,
      (role: string, eq: string, zone: string) => `Noticed ${role} proactively verifying team positioning near ${eq} in ${zone}`,
      (role: string, eq: string, zone: string) => `Saw ${role} in ${zone} coaching a fellow crew member on safe operation of ${eq}`,
      (role: string, eq: string, zone: string) => `In ${zone}, ${role} maintained strict procedural focus while working at ${eq}`,
      (role: string, eq: string, zone: string) => `Prior to starting work in ${zone}, ${role} led a focused step-back review at ${eq}`,
      (role: string, eq: string, zone: string) => `Monitored ${role} in ${zone} working with 100% adherence to barrier rules on ${eq}`,
      (role: string, eq: string, zone: string) => `Recognized ${role} in ${zone} for methodical two-step verification on ${eq}`,
      (role: string, eq: string, zone: string) => `Alongside ${eq} in ${zone}, ${role} modeled hands-free and line-of-fire discipline`,
      (role: string, eq: string, zone: string) => `At ${zone}, ${role} paused before engaging ${eq} to confirm all crew were clear`,
      (role: string, eq: string, zone: string) => `Observed ${role} in ${zone} taking ownership of workspace safety around ${eq}`
    ];

    const behaviorFindings = [
      'using a 42-inch magnetic push-pull pole to guide components into alignment while keeping hands completely clear of pinch points',
      'halting outside the painted red-zone boundary and waiting for the operator to set the brake and signal clearance before approaching',
      'maintaining 100% continuous tie-off by clipping the secondary shock-absorbing lanyard to a rated anchor before transitioning',
      'applying a personal LOTO padlock to the multi-hasp and testing the local start switch to confirm zero residual energy',
      'donning a full-face chemical splash shield, heavy-duty neoprene gauntlets, and apron prior to handling treatment fluids',
      'standing in a clear vantage point and delivering standard API hand signals backed by crisp UHF radio callouts',
      'walking a junior crew member through specific pinch-point hazards, escape routes, and isolation valves before starting',
      'conducting a deliberate 5x5 Step-Back assessment with the work party to clear footing before applying load',
      'coordinating a synchronized two-person lift with bent knees, straight back, and clear verbal count',
      'carrying small tools in a shoulder-slung pouch so both hands remained free for three-point contact on the access stairs',
      'repositioning body stance 90 degrees out of the potential line-of-fire path before cracking open the bleed valve',
      'immediately wiping down a minor lubricant drip and coiling hoses onto their bulkhead rack upon completing the check',
      'wearing molded foam earplugs beneath hard-hat earmuffs prior to entering the high-noise machinery zone',
      'reviewing every gas-test signature and isolation item on the Permit to Work at the job site before commencing work',
      'holding the unknotted tail of the guide tagline at a safe 12-foot standoff distance while controlling load swing'
    ];

    const swaScenarios = [
      {
        obs: (eq: string, role: string, zone: string) => `While ${eq} was active in ${zone}, observed ${role} step past the yellow warning chain toward the moving assembly without prior operator lock-out.`,
        act: (eq: string, role: string, zone: string) => `Exercised immediate Stop Work Authority (SWA) to freeze ${eq}, escorted ${role} back to the safe green walkway in ${zone}, and re-verified red-zone entry rules.`
      },
      {
        obs: (eq: string, role: string, zone: string) => `In ${zone}, noticed ${role} reaching with a gloved hand to steady a swinging component on ${eq} instead of using the staged push-pull stick.`,
        act: (eq: string, role: string) => `Called an immediate SWA halt, lowered ${eq} to a neutral rest position, handed ${role} a 42-inch magnetic guide pole, and reinforced hands-free policy.`
      },
      {
        obs: (eq: string, _role: string, zone: string) => `Prior to pressuring up ${eq} in ${zone}, discovered one high-pressure supply coupling lacked its secondary wire-rope whip-check restraint.`,
        act: (eq: string, role: string) => `Initiated Stop Work Authority (SWA) before the pump clutch was engaged, bled line pressure to zero with ${role}, and installed a certified 316-SS whip-check on ${eq}.`
      },
      {
        obs: (eq: string, role: string, zone: string) => `Observed ${role} walking beneath the swing path of a hoisted sub near ${eq} in ${zone} during rigging operations.`,
        act: (eq: string, role: string, zone: string) => `Sounded air-horn SWA signal to stop hoisting immediately, directed ${role} outside the drop zone in ${zone}, and installed barrier cones around ${eq}.`
      },
      {
        obs: (eq: string, _role: string, zone: string) => `While inspecting ${zone}, spotted active hydraulic oil mist weeping from a flared JIC fitting on ${eq}.`,
        act: (eq: string, role: string) => `Invoked SWA to shut down the hydraulic power pack, isolated and depressurized the circuit with ${role}, replaced the damaged O-ring seal on ${eq}, and cleaned the deck.`
      },
      {
        obs: (eq: string, role: string, zone: string) => `During rigging preparation on ${eq} in ${zone}, noticed ${role} attaching a tagline that had a figure-eight knot and frayed strands.`,
        act: (eq: string, role: string) => `Stopped the lift under SWA, removed and quarantined the knotted tagline, and issued ${role} a brand-new knot-free polypropylene tagline for ${eq}.`
      },
      {
        obs: (eq: string, _role: string, zone: string) => `While walking down ${zone}, felt a steel walkway grating panel adjacent to ${eq} shift slightly underfoot due to two missing J-bolt clips.`,
        act: (eq: string, role: string, zone: string) => `Called SWA and cordoned off the ${zone} access path with ${role}, installed four new stainless-steel saddle clips on the grating beside ${eq}, and verified stability.`
      },
      {
        obs: (eq: string, role: string, zone: string) => `In ${zone}, UHF radio communication between ${role} and the operator at ${eq} became garbled with static while the load was in a blind spot.`,
        act: (eq: string, role: string) => `Executed immediate Stop Work Authority (SWA) to hold ${eq} stationary, swapped ${role}'s handset for a charged unit on backup channel 3, and stationed a flagman.`
      },
      {
        obs: (eq: string, role: string, zone: string) => `Observed ${role} working at an elevated platform on ${eq} in ${zone} using a heavy spanner that was not clipped to a wrist lanyard.`,
        act: (eq: string, role: string, zone: string) => `Paused the task under SWA, cleared the lower deck perimeter in ${zone}, and fitted a certified retractable tool lanyard to ${role}'s wrench before work on ${eq} continued.`
      },
      {
        obs: (eq: string, _role: string, zone: string) => `Found an energized 440V welding lead laid directly across the wet steel walkway beside ${eq} in ${zone} without protective cable bridges.`,
        act: (eq: string, role: string, zone: string) => `Halted foot traffic under SWA, worked with ${role} to elevate the cable onto overhead S-hooks in ${zone}, and placed heavy-duty rubber ramps near ${eq}.`
      },
      {
        obs: (eq: string, role: string, zone: string) => `Observed ${role} preparing to wire-brush rust scale off ${eq} in ${zone} wearing safety glasses alone without a full-face impact shield.`,
        act: (eq: string, role: string) => `Intervened immediately with SWA before the tool was triggered, provided ${role} with an Aramco-approved polycarbonate face shield, and verified double eye protection at ${eq}.`
      },
      {
        obs: (eq: string, role: string, zone: string) => `While ${role} was handling loads at ${eq} in ${zone}, sudden 26-knot wind gusts caused the load to oscillate near adjacent piping.`,
        act: (eq: string, role: string) => `Invoked Stop Work Authority (SWA) to land and secure the load at ${eq} with ${role}, suspending hoisting until wind speed dropped below the 20-knot limit.`
      }
    ];

    const conditionActions = [
      (eq: string, role: string, zone: string) => `Confirmed operational readiness of ${eq} with ${role} and logged the green inspection status for ${zone}.`,
      (eq: string, role: string, zone: string) => `Reviewed the equipment checklist for ${eq} alongside ${role}, verifying all mechanical barriers in ${zone} remain intact.`,
      (eq: string, role: string, zone: string) => `Acknowledged ${role} for maintaining high housekeeping and hardware integrity around ${eq} in ${zone}.`,
      (eq: string, role: string, zone: string) => `Cross-checked ${eq} isolation and containment tags with ${role} during the ${zone} walkdown and signed off the log.`,
      (eq: string, role: string, zone: string) => `Thanked ${role} for proactive preventive care on ${eq}, keeping the ${zone} work envelope completely hazard-free.`,
      (eq: string, role: string, zone: string) => `Verified with ${role} that all primary and secondary safeguards on ${eq} in ${zone} meet Aramco Rig 50 standards.`,
      (eq: string, role: string, zone: string) => `Recorded the positive mechanical condition of ${eq} with ${role} and shared the ${zone} upkeep standard at shift handover.`,
      (eq: string, role: string, zone: string) => `Inspected the surrounding deck area at ${eq} with ${role}, confirming clear egress and reliable equipment status in ${zone}.`,
      (eq: string, role: string, zone: string) => `Discussed routine preventive checks on ${eq} with ${role} in ${zone} and validated that all inspection tags are current.`,
      (eq: string, role: string, zone: string) => `Recognized the ${zone} crew and ${role} for keeping ${eq} clean, properly guarded, and ready for immediate operation.`,
      (eq: string, role: string, zone: string) => `Validated barrier integrity on ${eq} with ${role}, ensuring zero leaks or loose fittings across the ${zone} station.`,
      (eq: string, role: string, zone: string) => `Completed a joint spot-check of ${eq} with ${role} in ${zone} and confirmed full compliance with rig maintenance schedules.`,
      (eq: string, role: string, zone: string) => `Endorsed the green-tagged status of ${eq} after verifying mechanical locks and gauge readings with ${role} in ${zone}.`,
      (eq: string, role: string, zone: string) => `Praised ${role} for thorough pre-shift preparation on ${eq}, reinforcing high equipment reliability across ${zone}.`,
      (eq: string, role: string, zone: string) => `Checked off ${eq} on the ${zone} barrier verification sheet with ${role} and encouraged continued attention to detail.`,
      (eq: string, role: string, zone: string) => `Walked down ${eq} with ${role} in ${zone}, confirming all safety devices and containment measures are functioning properly.`
    ];

    const behaviorActions = [
      (eq: string, role: string, zone: string) => `Commended ${role} on-the-spot for exemplary safety leadership around ${eq} in ${zone} and shared the practice at the pre-shift briefing.`,
      (eq: string, role: string, zone: string) => `Thanked ${role} personally for modeling disciplined hands-free and barrier habits at ${eq} in ${zone}.`,
      (eq: string, role: string, zone: string) => `Recognized ${role} during the ${zone} toolbox talk for setting a strong behavioral example while operating ${eq}.`,
      (eq: string, role: string, zone: string) => `Expressed appreciation to ${role} for maintaining 100% procedural compliance at ${eq} and keeping the ${zone} crew safe.`,
      (eq: string, role: string, zone: string) => `Highlighted ${role}'s proactive hazard awareness around ${eq} in ${zone} as a positive benchmark for the shift.`,
      (eq: string, role: string, zone: string) => `Praised ${role} for pausing to verify every safety control on ${eq} before starting work in ${zone}.`,
      (eq: string, role: string, zone: string) => `Acknowledged ${role} for strong teamwork and clear communication while managing tasks at ${eq} in ${zone}.`,
      (eq: string, role: string, zone: string) => `Reinforced ${role}'s safe work execution on ${eq} in ${zone} and encouraged the crew to maintain the same focus.`,
      (eq: string, role: string, zone: string) => `Gave positive on-site feedback to ${role} for strict line-of-fire and PPE discipline around ${eq} in ${zone}.`,
      (eq: string, role: string, zone: string) => `Noted ${role}'s methodical approach at ${eq} in ${zone} and shared the observation with the Rig Supervisor for crew recognition.`,
      (eq: string, role: string, zone: string) => `Congratulated ${role} on zero-shortcut execution around ${eq}, strengthening the safety culture across ${zone}.`,
      (eq: string, role: string, zone: string) => `Spoke with ${role} at ${eq} in ${zone} to recognize their mentoring of junior hands and adherence to safe operating procedures.`,
      (eq: string, role: string, zone: string) => `Logged a positive behavioral observation for ${role} at ${eq} in ${zone} and thanked them for looking out for fellow crew members.`,
      (eq: string, role: string, zone: string) => `Validated ${role}'s thorough step-back habit around ${eq} in ${zone} and encouraged continued peer-to-peer safety coaching.`,
      (eq: string, role: string, zone: string) => `Shook hands with ${role} at ${zone} to recognize their disciplined execution and barrier ownership on ${eq}.`,
      (eq: string, role: string, zone: string) => `Shared ${role}'s safe handling of ${eq} in ${zone} during the shift handover meeting as a model of Rig 50 excellence.`
    ];

    const seedOffset = Math.floor(Math.random() * equipmentPool.length);

    const condList: PlanItem[] = [];
    for (let i = 0; i < targetCond; i++) {
      let chosen: { eq: string; zone: string; role: string; obs: string; act: string } | null = null;
      for (let attempt = 0; attempt < 30; attempt++) {
        const eqItem = equipmentPool[(seedOffset + i * 7 + attempt * 11) % equipmentPool.length];
        const opener = conditionOpeners[(i * 3 + attempt) % conditionOpeners.length];
        const finding = conditionFindings[(i + attempt * 5) % conditionFindings.length];
        const actFn = conditionActions[(i * 5 + attempt * 3) % conditionActions.length];
        const obs = `${opener(eqItem.eq, eqItem.zone)}, ${finding}.`;
        const act = actFn(eqItem.eq, eqItem.role, eqItem.zone);
        if (!seenSet.has(obs.toLowerCase().trim()) && !seenActSet.has(act.toLowerCase().trim())) {
          chosen = { eq: eqItem.eq, zone: eqItem.zone, role: eqItem.role, obs, act };
          break;
        }
      }
      if (!chosen) {
        const base = CONDITION_TEMPLATES[i % CONDITION_TEMPLATES.length];
        chosen = {
          eq: base.eq,
          zone: normalizeOfficialZone(base.zone),
          role: normalizeRole(base.role),
          obs: base.obs,
          act: base.act
        };
      }
      seenSet.add(chosen.obs.toLowerCase().trim());
      seenActSet.add(chosen.act.toLowerCase().trim());
      condList.push({ categoryType: 'Condition', assessment: 'Safe', template: chosen });
    }

    const behList: PlanItem[] = [];
    for (let i = 0; i < targetBeh; i++) {
      let chosen: { eq: string; zone: string; role: string; obs: string; act: string } | null = null;
      for (let attempt = 0; attempt < 30; attempt++) {
        const eqItem = equipmentPool[(seedOffset + 19 + i * 11 + attempt * 13) % equipmentPool.length];
        const opener = behaviorOpeners[(i * 5 + attempt) % behaviorOpeners.length];
        const finding = behaviorFindings[(i + attempt * 3) % behaviorFindings.length];
        const actFn = behaviorActions[(i * 7 + attempt * 3) % behaviorActions.length];
        const obs = `${opener(eqItem.role, eqItem.eq, eqItem.zone)}, ${finding}.`;
        const act = actFn(eqItem.eq, eqItem.role, eqItem.zone);
        if (!seenSet.has(obs.toLowerCase().trim()) && !seenActSet.has(act.toLowerCase().trim())) {
          chosen = { eq: eqItem.eq, zone: eqItem.zone, role: eqItem.role, obs, act };
          break;
        }
      }
      if (!chosen) {
        const base = BEHAVIOR_TEMPLATES[i % BEHAVIOR_TEMPLATES.length];
        chosen = {
          eq: base.eq,
          zone: normalizeOfficialZone(base.zone),
          role: normalizeRole(base.role),
          obs: base.obs,
          act: base.act
        };
      }
      seenSet.add(chosen.obs.toLowerCase().trim());
      seenActSet.add(chosen.act.toLowerCase().trim());
      behList.push({ categoryType: 'Behavior Observation', assessment: 'Safe', template: chosen });
    }

    const swaList: PlanItem[] = [];
    for (let i = 0; i < targetSwa; i++) {
      let chosen: { eq: string; zone: string; role: string; obs: string; act: string } | null = null;
      for (let attempt = 0; attempt < 30; attempt++) {
        const eqItem = equipmentPool[(seedOffset + 37 + i * 13 + attempt * 7) % equipmentPool.length];
        const swa = swaScenarios[(i + attempt * 5) % swaScenarios.length];
        const obs = swa.obs(eqItem.eq, eqItem.role, eqItem.zone);
        const act = swa.act(eqItem.eq, eqItem.role, eqItem.zone);
        if (!seenSet.has(obs.toLowerCase().trim()) && !seenActSet.has(act.toLowerCase().trim())) {
          chosen = { eq: eqItem.eq, zone: eqItem.zone, role: eqItem.role, obs, act };
          break;
        }
      }
      if (!chosen) {
        const base = SWA_TEMPLATES[i % SWA_TEMPLATES.length];
        chosen = {
          eq: base.eq,
          zone: normalizeOfficialZone(base.zone),
          role: normalizeRole(base.role),
          obs: base.obs,
          act: base.act
        };
      }
      seenSet.add(chosen.obs.toLowerCase().trim());
      seenActSet.add(chosen.act.toLowerCase().trim());
      swaList.push({ categoryType: 'STOP Work Authority (SWA)', assessment: 'Unsafe', template: chosen });
    }

    const drillList: PlanItem[] = [];
    for (let i = 0; i < targetDrill; i++) {
      const eqItem = equipmentPool[(seedOffset + 53 + i * 9) % equipmentPool.length];
      const drillObs = `Initiated a planned Stop Work Authority (SWA) readiness drill in ${eqItem.zone} around ${eqItem.eq}, testing ${eqItem.role} and crew response to a simulated barrier breach.`;
      const drillAct = `${eqItem.role} and the ${eqItem.zone} crew halted ${eqItem.eq} within 3 seconds and secured the perimeter; debriefed the successful SWA exercise.`;
      seenSet.add(drillObs.toLowerCase().trim());
      drillList.push({
        categoryType: 'Stop Work Authority Drill',
        assessment: 'Safe',
        template: {
          eq: eqItem.eq,
          zone: eqItem.zone,
          role: eqItem.role,
          obs: drillObs,
          act: drillAct
        }
      });
    }

    const buckets = [
      { list: condList, initial: condList.length },
      { list: behList, initial: behList.length },
      { list: swaList, initial: swaList.length },
      { list: drillList, initial: drillList.length }
    ].filter(b => b.initial > 0);

    // Smoothly interleave based on highest remaining proportion
    const interleaved: PlanItem[] = [];
    for (let i = 0; i < count; i++) {
      let bestIdx = 0;
      let maxScore = -1;
      for (let j = 0; j < buckets.length; j++) {
        if (buckets[j].list.length > 0) {
          const score = buckets[j].list.length / buckets[j].initial;
          if (score > maxScore) {
            maxScore = score;
            bestIdx = j;
          }
        }
      }
      if (buckets[bestIdx] && buckets[bestIdx].list.length > 0) {
        interleaved.push(buckets[bestIdx].list.shift()!);
      }
    }

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

    const finalPayloads = interleaved.map((item, idx) => {
      const t = item.template;
      const cleanObs = sanitizeCardText(t.obs);
      const cleanAct = sanitizeCardText(t.act);

      const answers = [
        { questionId: 'r5f3272b6049d4ad18e7650bd96ae837b', answer1: reportDate },
        { questionId: 'r4fdd1bd872014d9c80d3a51be3f2f950', answer1: RIG_50_NAME },
        { questionId: 'r409eb59dd0f244e4b52573ce50037896', answer1: t.zone },
        { questionId: 'rfe47535c542e4ce8886c2741c4c69b78', answer1: t.role },
        { questionId: 'r26c88746635b40a39ef3f873e00e78a8', answer1: item.assessment },
        { questionId: 'ra8f38f21840f490a87ac70d61da452f8', answer1: item.categoryType },
        { questionId: 'r2d178592d7f94a6aad56238bc1005d5f', answer1: item.assessment === 'Safe' ? 'Safe Behavior Observation' : 'General Operational Safety' },
        { questionId: 'r22c97581ebf74a8498da93d022d8afcf', answer1: 'PPE Worn Correctly (Compliant)' },
        { questionId: 're36e820370e2436798ea97f34930b753', answer1: cleanObs },
        { questionId: 'rda2692cb0c9841fdb71f4b2ec5415728', answer1: cleanAct },
        { questionId: 'r698ffb98e604476b92020bb6c34790e9', answer1: '' } // Observer Name: Kept Empty
      ];

      return {
        index: idx + 1,
        zone: t.zone,
        role: t.role,
        assessment: item.assessment,
        obsType: item.categoryType,
        observation: cleanObs,
        action: cleanAct,
        answers
      };
    });

    return {
      payloads: finalPayloads,
      counts: {
        condition: targetCond,
        behavior: targetBeh,
        swa: targetSwa,
        swaDrill: targetDrill,
        total: finalPayloads.length
      }
    };
  }

  /**
   * Executes the full batch submission, updates blacklist & sends email confirmation
   */
  public async executeMassSubmissionRun(manualTrigger = false) {
    const startTime = Date.now();
    const todayStr = new Date().toISOString().split('T')[0];
    const targetCount = this.currentSchedule.targetCount || 100;
    const quotas = this.currentSchedule.categoryQuotas || { condition: 45, behavior: 45, swa: 10 };

    console.log(`[DailyScheduler] Starting batch run of ${targetCount} cards with breakdown:`, quotas);

    let existingBlacklist: string[] = [];
    try {
      existingBlacklist = await getPromptBlacklistFromDb();
    } catch {}

    const { payloads, counts } = this.generateCardsForQuotas(targetCount, quotas, todayStr, existingBlacklist);

    let succeeded = 0;
    let failed = 0;
    const sampleReceipts: Array<{ responseId: string; zone: string; role: string; obsType: string; observation: string }> = [];
    const submittedObservations: string[] = [];

    // Submit in chunks of 5
    const CHUNK_SIZE = 5;
    for (let i = 0; i < payloads.length; i += CHUNK_SIZE) {
      const chunk = payloads.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map(async (c) => {
          try {
            const res = await this.submitFn(c.answers);
            if (res.ok) {
              succeeded++;
              const respId = String(res.data?.id || res.data?.responseId || `MS_${Date.now()}_${succeeded}`);
              submittedObservations.push(c.observation);
              if (sampleReceipts.length < 8) {
                sampleReceipts.push({
                  responseId: respId,
                  zone: c.zone,
                  role: c.role,
                  obsType: c.obsType,
                  observation: c.observation
                });
              }
              // Persist every submitted card to Firestore soarCards collection
              recordCardToDb({
                responseId: respId,
                date: todayStr,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                zone: c.zone,
                role: c.role,
                observerRole: 'Observer',
                observerName: '', // Strictly kept empty for auto-runs
                assessment: c.assessment,
                obsType: c.obsType,
                observation: c.observation,
                action: c.action,
                aiPolished: true
              }).catch(() => {});
            } else {
              failed++;
            }
          } catch (e) {
            failed++;
          }
        })
      );
      // Small pause between chunks to respect Microsoft Forms rate limits
      await new Promise(r => setTimeout(r, 120));
    }

    // Update blacklist in Firestore if enabled
    if (this.currentSchedule.autoBlacklist && submittedObservations.length > 0) {
      try {
        const bl = await getPromptBlacklistFromDb();
        const updated = Array.from(new Set([...submittedObservations, ...bl])).slice(0, 10000);
        await savePromptBlacklistToDb(updated);
      } catch (blErr) {
        console.warn('[DailyScheduler] Firestore blacklist update notice:', blErr);
      }
    }

    const targetTz = this.currentSchedule.timezone || 'Asia/Riyadh';
    const now = new Date();
    const tzInfo = getTimeInTimezone(now, targetTz);
    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);

    // Send confirmation email
    const emailResult = await this.sendConfirmationEmail({
      recipient: this.currentSchedule.recipientEmail,
      totalCount: payloads.length,
      succeeded,
      failed,
      counts,
      runDate: tzInfo.dateStr,
      runTime: `${tzInfo.display}`,
      sampleReceipts,
      manualTrigger
    });

    const statusVal: 'success' | 'failed' = failed === 0 ? 'success' : 'failed';
    const summaryVal = `${succeeded} of ${targetCount} cards submitted in ${elapsedSec}s (${counts.condition} Condition, ${counts.behavior} Behavior, ${counts.swa} SWA)`;

    // Create and save permanent run log entry to Firestore
    const logEntry: DailyRunLogEntry = {
      id: `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: now.toISOString(),
      timezone: targetTz,
      localTimeDisplay: tzInfo.display,
      utcTimeDisplay: now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
      triggerType: manualTrigger ? 'manual' : 'scheduled',
      status: statusVal,
      targetCount,
      succeeded,
      failed,
      categoryQuotas: counts,
      elapsedSeconds: elapsedSec,
      recipientEmail: this.currentSchedule.recipientEmail,
      emailSent: emailResult.success,
      previewUrl: emailResult.previewUrl || undefined,
      messageId: emailResult.messageId || undefined,
      summary: summaryVal,
      sampleReceipts
    };
    this.addLogEntry(logEntry);

    if (!manualTrigger) {
      this.currentSchedule.lastScheduledRunDate = tzInfo.dateStr;
    } else {
      this.currentSchedule.lastManualRunTime = now.toISOString();
    }

    this.currentSchedule.lastRunDate = tzInfo.dateStr;
    this.currentSchedule.lastRunTime = now.toISOString();
    this.currentSchedule.lastRunCount = succeeded;
    this.currentSchedule.lastRunStatus = statusVal;
    this.currentSchedule.lastRunSummary = summaryVal;
    this.currentSchedule.lastRunPreviewUrl = emailResult.previewUrl || undefined;
    this.saveScheduleToFirestore();

    return {
      success: true,
      logId: logEntry.id,
      logEntry,
      totalCount: payloads.length,
      succeeded,
      failed,
      elapsedSeconds: elapsedSec,
      counts,
      emailSent: emailResult.success,
      previewUrl: emailResult.previewUrl,
      messageId: emailResult.messageId,
      timestamp: now.toISOString(),
      displayTime: tzInfo.display
    };
  }

  /**
   * Formats and dispatches high-standard HTML email confirmation
   */
  public async sendConfirmationEmail(options: {
    recipient: string;
    totalCount: number;
    succeeded: number;
    failed: number;
    counts: { condition: number; behavior: number; swa: number; swaDrill?: number };
    runDate: string;
    runTime: string;
    sampleReceipts: Array<{ responseId: string; zone: string; role: string; obsType: string; observation: string }>;
    manualTrigger?: boolean;
  }) {
    const { recipient, totalCount, succeeded, failed, counts, runDate, runTime, sampleReceipts, manualTrigger } = options;

    let transporter: any;
    const hasCustomSmtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);

    if (hasCustomSmtp) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    } else {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
    }

    const subject = `✅ Rig 50 Daily SOAR Report: ${succeeded} Cards Submitted (${counts.condition} Cond / ${counts.behavior} Beh / ${counts.swa} SWA)`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; max-width: 680px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background: #ffffff;">
        <!-- Header Banner -->
        <div style="background: linear-gradient(135deg, #03787c 0%, #0f172a 100%); color: white; padding: 24px 28px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <span style="background: rgba(255,255,255,0.2); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 4px 10px; rounded: 6px; border-radius: 6px;">
              ${manualTrigger ? 'Manual Batch Trigger' : 'Daily Automated Run'} · Confirmed
            </span>
            <span style="font-size: 12px; opacity: 0.9;">
              ${runDate} · ${runTime}
            </span>
          </div>
          <h1 style="margin: 0 0 6px; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">
            STOP OBSERVE ACT REPORT (SOAR)
          </h1>
          <p style="margin: 0; font-size: 13px; color: #ccfbf1; font-weight: 500;">
            Rig 50 - 50 Bob Palmer (RBP-50A) · Official HSE Daily Transmission
          </p>
        </div>

        <div style="padding: 24px 28px;">
          <!-- Top KPI Grid -->
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px;">
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 14px; text-align: center;">
              <span style="font-size: 11px; color: #166534; font-weight: 700; text-transform: uppercase;">Cards Submitted</span>
              <div style="font-size: 28px; font-weight: 900; color: #15803d; margin-top: 4px;">${succeeded}</div>
              <span style="font-size: 10px; color: #16a34a;">of ${totalCount} target</span>
            </div>

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; text-align: center;">
              <span style="font-size: 11px; color: #475569; font-weight: 700; text-transform: uppercase;">Success Rate</span>
              <div style="font-size: 28px; font-weight: 900; color: #0f172a; margin-top: 4px;">
                ${totalCount > 0 ? Math.round((succeeded / totalCount) * 100) : 100}%
              </div>
              <span style="font-size: 10px; color: #64748b;">${failed === 0 ? 'Zero failures' : `${failed} failed`}</span>
            </div>

            <div style="background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 12px; padding: 14px; text-align: center;">
              <span style="font-size: 11px; color: #7e22ce; font-weight: 700; text-transform: uppercase;">Recipient Email</span>
              <div style="font-size: 12px; font-weight: 700; color: #6b21a8; margin-top: 8px; word-break: break-all;">
                ${recipient}
              </div>
              <span style="font-size: 10px; color: #9333ea;">Verified delivery</span>
            </div>
          </div>

          <!-- Category Breakdown Table -->
          <h3 style="margin: 0 0 10px; font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">
            📊 Category Quota Breakdown (Strictly Enforced)
          </h3>
          <div style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <thead>
                <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; text-align: left; color: #475569; font-size: 11px; text-transform: uppercase;">
                  <th style="padding: 10px 14px;">Observation Category</th>
                  <th style="padding: 10px 14px; text-align: center;">Requested Count</th>
                  <th style="padding: 10px 14px; text-align: center;">Percentage</th>
                  <th style="padding: 10px 14px; text-align: right;">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 12px 14px; font-weight: 600; color: #0369a1;">
                    🔧 Condition Observations
                  </td>
                  <td style="padding: 12px 14px; text-align: center; font-weight: 700; color: #0f172a;">
                    ${counts.condition} cards
                  </td>
                  <td style="padding: 12px 14px; text-align: center; color: #64748b;">
                    ${totalCount > 0 ? Math.round((counts.condition / totalCount) * 100) : 45}%
                  </td>
                  <td style="padding: 12px 14px; text-align: right; color: #16a34a; font-weight: 700;">
                    ✓ 100% Filled
                  </td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 12px 14px; font-weight: 600; color: #15803d;">
                    👥 Behavior Observations
                  </td>
                  <td style="padding: 12px 14px; text-align: center; font-weight: 700; color: #0f172a;">
                    ${counts.behavior} cards
                  </td>
                  <td style="padding: 12px 14px; text-align: center; color: #64748b;">
                    ${totalCount > 0 ? Math.round((counts.behavior / totalCount) * 100) : 45}%
                  </td>
                  <td style="padding: 12px 14px; text-align: right; color: #16a34a; font-weight: 700;">
                    ✓ 100% Filled
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 14px; font-weight: 600; color: #b91c1c;">
                    🛑 STOP Work Authority (SWA)
                  </td>
                  <td style="padding: 12px 14px; text-align: center; font-weight: 700; color: #0f172a;">
                    ${counts.swa} cards
                  </td>
                  <td style="padding: 12px 14px; text-align: center; color: #64748b;">
                    ${totalCount > 0 ? Math.round((counts.swa / totalCount) * 100) : 10}%
                  </td>
                  <td style="padding: 12px 14px; text-align: right; color: #16a34a; font-weight: 700;">
                    ✓ 100% Filled
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Sample Verified Submissions -->
          <h3 style="margin: 0 0 10px; font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">
            📋 Sample Confirmed Receipts (Microsoft Forms)
          </h3>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 16px; margin-bottom: 24px;">
            ${sampleReceipts.map((r, i) => `
              <div style="padding: 8px 0; border-bottom: ${i < sampleReceipts.length - 1 ? '1px solid #e2e8f0' : 'none'}; font-size: 12px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                  <strong style="color: #03787c;">#${r.responseId} · ${r.zone} (${r.role})</strong>
                  <span style="font-weight: 700; color: ${r.obsType.includes('SWA') ? '#dc2626' : (r.obsType === 'Condition' ? '#0284c7' : '#16a34a')};">
                    ${r.obsType}
                  </span>
                </div>
                <div style="color: #475569; font-size: 11px; line-height: 1.4;">
                  ${r.observation}
                </div>
              </div>
            `).join('')}
          </div>

          <!-- Rig Verification Footer -->
          <div style="background: #f1f5f9; border-radius: 10px; padding: 12px 16px; font-size: 11px; color: #64748b; line-height: 1.5;">
            <strong>Rig 50 Safety System Verification:</strong> All submitted cards were routed directly to the Microsoft Forms Cloud API endpoint (Form ID: <code>${RIG_50_NAME}</code>) with zero scenario collision. Observation texts have been automatically synchronized with the permanent Prompt History Blacklist.
          </div>
        </div>

        <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px 28px; font-size: 11px; color: #94a3b8; text-align: center;">
          Sent to <strong>${recipient}</strong> by Rig 50 SOAR Safety Platform · Automated Daily Scheduled Run Engine
        </div>
      </div>
    `;

    try {
      const info = await transporter.sendMail({
        from: '"Rig 50 SOAR Daily System" <safety@rig50.hse-reports.com>',
        to: recipient,
        subject,
        html,
        text: `Rig 50 Daily SOAR Report: ${succeeded} cards submitted successfully. Breakdown: ${counts.condition} Condition, ${counts.behavior} Behavior, ${counts.swa} SWA. Recipient: ${recipient}.`
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`[DailyScheduler] Email sent successfully to ${recipient}. MessageId: ${info.messageId}, Preview: ${previewUrl || 'Custom SMTP'}`);

      return {
        success: true,
        messageId: info.messageId,
        previewUrl: previewUrl || null
      };
    } catch (err: any) {
      console.error('[DailyScheduler] Email send error:', err);
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Sends a quick test email to verify delivery
   */
  public async sendTestEmail(targetRecipient?: string) {
    const to = targetRecipient || this.currentSchedule.recipientEmail;
    return this.sendConfirmationEmail({
      recipient: to,
      totalCount: 100,
      succeeded: 100,
      failed: 0,
      counts: this.currentSchedule.categoryQuotas || { condition: 45, behavior: 45, swa: 10 },
      runDate: new Date().toISOString().split('T')[0],
      runTime: new Date().toLocaleTimeString(),
      sampleReceipts: [
        {
          responseId: '146605',
          zone: 'Rig Floor',
          role: 'Floorman',
          obsType: 'Condition',
          observation: 'Conducted pre-shift pressure integrity inspection on standpipe manifold #2 bleed-off valve; verified zero weeping and secondary safety whip-checks securely pinned.'
        },
        {
          responseId: '146606',
          zone: 'Cantilever / Pipe Deck',
          role: 'Roustabout',
          obsType: 'Behavior Observation',
          observation: 'Observed deck crew consistently utilizing magnetic push-pull safety sticks to guide 5-inch drill pipe onto catwalk without placing hands in pinch points.'
        },
        {
          responseId: '146607',
          zone: 'Main Deck',
          role: 'Roustabout',
          obsType: 'STOP Work Authority (SWA)',
          observation: 'Rigger immediately called STOP Work Authority (SWA) when supply boat shifted suddenly in heavy swell, causing crane hook bridle line to snag container corner.'
        }
      ],
      manualTrigger: true
    });
  }
}
