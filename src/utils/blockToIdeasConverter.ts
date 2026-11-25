import { AiTrainingIdea } from '../firebase';

/**
 * Rig 50 Standard Zones for automatic detection
 */
const RIG_50_ZONES = [
  { name: 'Drill Floor / Derrick', keywords: ['drill floor', 'derrick', 'rotary', 'table', 'slips', 'tongs', 'top drive', 'monkeyboard', 'drawworks', 'iron roughneck', 'mousehole', 'kelly', 'stand'] },
  { name: 'Cantilever / Pipe Deck', keywords: ['cantilever', 'pipe deck', 'deck', 'tubular', 'pipe rack', 'crane', 'rigger', 'sling', 'catwalk', 'forklift', 'stanchion', 'v-door'] },
  { name: 'Mud Pit / Sack Room', keywords: ['mud pit', 'sack room', 'shaker', 'shale shaker', 'hopper', 'sack', 'barite', 'bentonite', 'centrifuge', 'degasser', 'agitator', 'mud transfer', 'chemical'] },
  { name: 'Substructure / BOP', keywords: ['bop', 'substructure', 'accumulator', 'koomey', 'choke', 'kill manifold', 'ram', 'annular', 'wellhead', 'diverter'] },
  { name: 'Main Deck', keywords: ['main deck', 'supply boat', 'lifeboat', 'davit', 'gangway', 'anchor', 'muster', 'helideck', 'barge', 'winch'] },
  { name: 'Camp / Galley', keywords: ['galley', 'mess', 'camp', 'radio room', 'office', 'clinic', 'medic', 'accommodation', 'living quarters', 'freezer', 'laundry'] }
];

/**
 * Standard Rig 50 Roles for automatic detection
 */
const RIG_50_ROLES = [
  { role: 'Driller', keywords: ['driller', 'driller console', 'driller cabin'] },
  { role: 'Assistant Driller', keywords: ['assistant driller', 'ad', 'assistant'] },
  { role: 'Derrickman', keywords: ['derrickman', 'monkeyboard', 'racking finger', 'mud pumps'] },
  { role: 'Floorman', keywords: ['floorman', 'roughneck', 'iron roughneck', 'tongs', 'spinning wrench'] },
  { role: 'Roustabout', keywords: ['roustabout', 'push-pull', 'pipe rack', 'tag line', 'offloading'] },
  { role: 'Crane Operator', keywords: ['crane operator', 'crane', 'boom', 'hoist', 'pedestal'] },
  { role: 'Mechanic (Rig)', keywords: ['mechanic', 'engine', 'generator', 'compressor', 'pump', 'lube'] },
  { role: 'Chief Electrician', keywords: ['electrician', 'switchboard', 'mcc', 'transformer', 'cable', 'loto'] },
  { role: 'Barge Engineer', keywords: ['barge engineer', 'ballast', 'bilge', 'draft', 'tank soundings'] },
  { role: 'Safety Officer / RSC', keywords: ['safety officer', 'rsc', 'hse', 'safety coach'] },
  { role: 'Medic', keywords: ['medic', 'clinic', 'first aid', 'hygiene', 'heat stress'] },
  { role: 'Radio Operator', keywords: ['radio operator', 'vhf', 'distress', 'communications'] }
];

/**
 * Automatically detects the best fitting zone from observation text
 */
export function detectZoneFromText(text: string): string {
  const lower = (text || '').toLowerCase();
  for (const item of RIG_50_ZONES) {
    if (item.keywords.some(k => lower.includes(k))) {
      return item.name;
    }
  }
  return 'Drill Floor / Derrick';
}

/**
 * Automatically detects the best fitting role from observation text
 */
export function detectRoleFromText(text: string, zone?: string): string {
  const lower = (text || '').toLowerCase();
  for (const item of RIG_50_ROLES) {
    if (item.keywords.some(k => lower.includes(k))) {
      return item.role;
    }
  }
  if (zone === 'Cantilever / Pipe Deck' || zone === 'Main Deck') return 'Roustabout';
  if (zone === 'Mud Pit / Sack Room') return 'Floorman';
  if (zone === 'Camp / Galley') return 'Medic';
  return 'Floorman';
}

/**
 * Automatically detects if the scenario is Safe or Unsafe
 */
export function detectAssessmentFromText(text: string): 'Safe' | 'Unsafe' {
  const lower = (text || '').toLowerCase();
  const unsafeTriggers = [
    'unsafe', 'hazard', 'stop work', 'swa', 'violation', 'missing', 'damaged',
    'defect', 'leak', 'spill', 'dropped', 'corroded', 'broken', 'failure',
    'failed', 'trip hazard', 'slip hazard', 'line of fire', 'pinch point',
    'bypass', 'disabled', 'inadequate', 'unsecured', 'unlatched', 'overheated'
  ];
  if (unsafeTriggers.some(t => lower.includes(t))) {
    return 'Unsafe';
  }
  return 'Safe';
}

/**
 * Automatically detects observation type
 */
export function detectObsTypeFromText(text: string, assessment: 'Safe' | 'Unsafe'): string {
  const lower = (text || '').toLowerCase();
  if (lower.includes('swa') || lower.includes('stop work')) {
    return 'STOP Work Authority (SWA)';
  }
  if (lower.includes('condition') || lower.includes('leak') || lower.includes('gauge') || lower.includes('pin') || lower.includes('corrosion') || lower.includes('guard')) {
    return 'Condition';
  }
  return 'Behavior Observation';
}

/**
 * Generates an intelligent, clean topic title from observation text
 */
export function generateTopicFromText(text: string, zone: string): string {
  if (!text) return 'Operational Safety Observation';

  let clean = text
    .replace(/^observed\s+(that\s+)?(the\s+)?/i, '')
    .replace(/^during\s+operations\s+in\s+[^,]+,\s*/i, '')
    .replace(/^verified\s+(that\s+)?/i, '')
    .replace(/^noticed\s+(that\s+)?/i, '')
    .replace(/^conducted\s+(a\s+)?/i, '')
    .trim();

  // If equipment or scenario is specified in quotes or specific syntax
  const matchParen = clean.match(/\(([^)]+)\)/);
  const contextHint = matchParen ? matchParen[1].trim() : '';

  // Extract first clause or first 6-8 words
  const firstSentence = clean.split(/[.;:]/)[0].trim();
  const words = firstSentence.split(/\s+/).slice(0, 8).join(' ');

  let title = words;
  if (contextHint && contextHint.length > 3 && contextHint.length < 40) {
    title = `${contextHint.charAt(0).toUpperCase() + contextHint.slice(1)} - ${words}`;
  }

  // Capitalize neatly
  title = title.replace(/\b\w/g, c => c.toUpperCase());
  if (title.length > 70) {
    title = title.slice(0, 67) + '...';
  }
  return title || `${zone} Safety Check`;
}

/**
 * Generates an actionable, professional corrective or reinforcement action
 */
export function generateActionFromText(text: string, assessment: 'Safe' | 'Unsafe', obsType: string): string {
  // If text already has an explicit action clause, extract it
  const matchAction = text.match(/(?:action taken|immediate action|action|result):\s*([^.]+)/i);
  if (matchAction && matchAction[1].trim().length > 10) {
    return matchAction[1].trim() + '.';
  }

  if (assessment === 'Unsafe' || obsType === 'STOP Work Authority (SWA)') {
    return 'Immediately exercised Stop Work Authority (SWA), isolated condition with area supervisor, corrected hazard, and reviewed safe work guidelines in pre-job safety meeting.';
  }

  return 'Commended crew on-the-spot for 100% adherence to Rig 50 safe work practices and logged as positive safety recognition in the daily tour log.';
}

/**
 * Converts a raw blacklist scenario string into a complete, pristine AiTrainingIdea
 */
export function convertBlacklistItemToIdea(
  rawText: string,
  overrides?: Partial<AiTrainingIdea>
): AiTrainingIdea {
  const cleanObs = (rawText || '').trim();
  const zone = overrides?.zone || detectZoneFromText(cleanObs);
  const role = overrides?.role || detectRoleFromText(cleanObs, zone);
  const assessment = overrides?.assessment || detectAssessmentFromText(cleanObs);
  const obsType = overrides?.obsType || detectObsTypeFromText(cleanObs, assessment);
  const topic = overrides?.topic || generateTopicFromText(cleanObs, zone);
  const action = overrides?.action || generateActionFromText(cleanObs, assessment, obsType);

  const safeId = `idea_blk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  return {
    id: overrides?.id || safeId,
    topic: topic.slice(0, 140),
    zone,
    role,
    assessment,
    obsType,
    observation: cleanObs.slice(0, 1990),
    action: action.slice(0, 1990),
    keywords: overrides?.keywords || `block list, mass submit, exemplar, ${zone.toLowerCase().split('/')[0].trim()}`,
    isActive: overrides?.isActive ?? true,
    createdAt: overrides?.createdAt || new Date().toISOString()
  };
}
