/**
 * Rig 50 Comprehensive Card Banks & Themes
 * Supports Official Aramco Operations, Offshore Comedy, Music Lyrics, Cinema Quotes,
 * Ancient Wisdom, Military Precision, Sports Champions, and Custom Cards.
 * Supports multi-theme selection and automatic content generation logic.
 */

export type CardCategoryType = 'Safe' | 'General';

export type ThemeId = 
  | 'humor' 
  | 'music' 
  | 'cinema' 
  | 'food'
  | 'gaming'
  | 'travel'
  | 'crew_life'
  | 'wisdom' 
  | 'military' 
  | 'sports' 
  | 'operations' 
  | 'custom';

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  emoji: string;
  shortDesc: string;
  tagline: string;
  bgColor: string;
  borderColor: string;
  activeRing: string;
  badgeColor: string;
  isNonSafetyFavorite?: boolean;
}

export const THEME_DEFINITIONS: ThemeMeta[] = [
  {
    id: 'humor',
    label: 'Stand-Up & Comedy',
    emoji: '🎭',
    shortDesc: 'Everyday jokes, coffee addiction, alarm clocks, witty stories',
    tagline: 'Hilarious everyday humor and relatable comedy observations',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-500',
    activeRing: 'ring-amber-500/30',
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
    isNonSafetyFavorite: true
  },
  {
    id: 'music',
    label: 'Music & Concerts',
    emoji: '🎵',
    shortDesc: 'Queen, Wham!, Bon Jovi, Michael Jackson, Daft Punk, playlists',
    tagline: 'Iconic rock & pop anthems, studio trivia, and concert vibes',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-500',
    activeRing: 'ring-rose-500/30',
    badgeColor: 'bg-rose-100 text-rose-900 border-rose-300',
    isNonSafetyFavorite: true
  },
  {
    id: 'cinema',
    label: 'Movies & Cinema',
    emoji: '🎬',
    shortDesc: 'Terminator, Top Gun, Star Wars, Matrix, Gladiator, Inception',
    tagline: 'Blockbuster movie quotes, plot twists, and Hollywood legends',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-500',
    activeRing: 'ring-cyan-500/30',
    badgeColor: 'bg-cyan-100 text-cyan-900 border-cyan-300',
    isNonSafetyFavorite: true
  },
  {
    id: 'food',
    label: 'Food, Coffee & Cravings',
    emoji: '🍔',
    shortDesc: 'Specialty espresso, shawarma vs burger, BBQ steak, late snacks',
    tagline: '100% non-safety culinary debates, coffee culture, and foodie reviews',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-500',
    activeRing: 'ring-orange-500/30',
    badgeColor: 'bg-orange-100 text-orange-900 border-orange-300',
    isNonSafetyFavorite: true
  },
  {
    id: 'gaming',
    label: 'Gaming, Tech & Sci-Fi',
    emoji: '🎮',
    shortDesc: 'PS5 FIFA/EA FC 90th-min winners, GTA, PC rigs, space & gadgets',
    tagline: '100% non-safety gaming clutches, tech setups, and sci-fi trivia',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-500',
    activeRing: 'ring-violet-500/30',
    badgeColor: 'bg-violet-100 text-violet-900 border-violet-300',
    isNonSafetyFavorite: true
  },
  {
    id: 'travel',
    label: 'Cars, Travel & Lifestyle',
    emoji: '🏎️',
    shortDesc: 'V8 supercars, coastal road trips, first-class lounges, watches',
    tagline: '100% non-safety automotive passion, bucket-list destinations & gear',
    bgColor: 'bg-sky-50',
    borderColor: 'border-sky-500',
    activeRing: 'ring-sky-500/30',
    badgeColor: 'bg-sky-100 text-sky-900 border-sky-300',
    isNonSafetyFavorite: true
  },
  {
    id: 'crew_life',
    label: 'Camp Life & Stories',
    emoji: '☕',
    shortDesc: 'Galley steak night, arctic cabin AC, dominoes finals, leave countdown',
    tagline: '100% non-safety social life, lounge stories, and camp camaraderie',
    bgColor: 'bg-lime-50',
    borderColor: 'border-lime-600',
    activeRing: 'ring-lime-500/30',
    badgeColor: 'bg-lime-100 text-lime-900 border-lime-300',
    isNonSafetyFavorite: true
  },
  {
    id: 'sports',
    label: 'Football & World Sports',
    emoji: '🏆',
    shortDesc: 'Champions League nights, World Cup drama, Formula 1, boxing',
    tagline: 'Legendary goals, buzzer-beaters, F1 overtakes, and sports history',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-500',
    activeRing: 'ring-yellow-500/30',
    badgeColor: 'bg-yellow-100 text-yellow-900 border-yellow-300',
    isNonSafetyFavorite: true
  },
  {
    id: 'wisdom',
    label: 'Philosophy & Mind Facts',
    emoji: '🧠',
    shortDesc: 'Sun Tzu, Aristotle, Marcus Aurelius, psychology, cosmic facts',
    tagline: 'Timeless philosophical truths, stoic mindset, and mind-blowing trivia',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-500',
    activeRing: 'ring-emerald-500/30',
    badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    isNonSafetyFavorite: true
  },
  {
    id: 'military',
    label: 'Aviation & Precision',
    emoji: '🎖️',
    shortDesc: 'Supersonic jets, carrier deck lore, Apollo missions, navigation',
    tagline: 'Aerospace marvels, aviation history, and tactical precision',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-500',
    activeRing: 'ring-blue-500/30',
    badgeColor: 'bg-blue-100 text-blue-900 border-blue-300'
  },
  {
    id: 'operations',
    label: 'Aramco Operations',
    emoji: '🏗️',
    shortDesc: 'Casing, BOP test, High Pressure line, Iron Roughneck, LOTO',
    tagline: '100% realistic technical drilling engineering cards for Rig 50',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-500',
    activeRing: 'ring-teal-500/30',
    badgeColor: 'bg-teal-100 text-teal-900 border-teal-300'
  },
  {
    id: 'custom',
    label: 'Custom Bank',
    emoji: '✍️',
    shortDesc: 'Personal saved cards and supervisor custom submissions',
    tagline: 'Hand-crafted cards stored in your Rig 50 custom collection',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-500',
    activeRing: 'ring-purple-500/30',
    badgeColor: 'bg-purple-100 text-purple-900 border-purple-300'
  }
];

export interface SoarCardTemplate {
  id: string;
  categoryTheme: ThemeId | string;
  cardCategory?: CardCategoryType; // 'Safe' or 'General'
  zone: string;
  role: string;
  assessment: 'Safe' | 'Unsafe';
  obsType: string;
  category: string;
  ppe?: string;
  topic?: string;
  observation: string;
  action: string;
  tags?: string[];
}

export const HUMOR_SOAR_CARDS: SoarCardTemplate[] = [
  {
    id: 'humor_1',
    categoryTheme: 'humor',
    cardCategory: 'General',
    zone: 'Accommodations',
    role: 'Rig Safety Coach (RSC)',
    assessment: 'Unsafe',
    obsType: 'Condition',
    category: 'Housekeeping & Storage',
    observation: 'Observed an elite squad of suspects seated around the office desk, refusing eye contact while the evidence—an entire fleet of black Motorola radios lined up neatly in two tactical rows—sat displayed on the timber desk like a major DEA drug bust.',
    action: 'Safety Note: Hoarding UHF handsets inside private lockers creates an offshore black market where a charged battery trades at higher value than gold bullion. If every shift hoards three radios "just in case my relief forgets to charge one," the deck crew ends up resorting to hand signals, shouting into the wind, and interpretive dance to stop the drawworks. Radios redistributed to charging rack.'
  },
  {
    id: 'humor_2',
    categoryTheme: 'humor',
    cardCategory: 'General',
    zone: 'Accommodations',
    role: 'Barge Engineer',
    assessment: 'Unsafe',
    obsType: 'Behavior Observation',
    category: 'Human Factors & Focus',
    observation: 'Observed the Barge Engineer recalculating the rig\'s center of gravity on a scratchpad, only to find the margin notes covered in heart doodles and the name "Venecia" written in neat, architectural lettering inside a stability triangle.',
    action: 'Safety Note: Severe offshore infatuation poses a structural hazard to marine operations. When an engineer\'s heart is listing 45 degrees to starboard over a girl from the beach, his ability to detect actual hull pitch and roll drops to near zero. A compromised mental state leads to confusing trim angles with romantic chemistry, threatening the overall metacentric height of both the rig and his dignity. Provided strong black coffee and peer reality check.'
  },
  {
    id: 'humor_3',
    categoryTheme: 'humor',
    cardCategory: 'Safe',
    zone: 'Cantilever / Pipe Deck',
    role: 'OIM',
    assessment: 'Safe',
    obsType: 'Behavior Observation',
    category: 'Supervisory Oversight',
    observation: 'Observed the OIM step quietly out onto the cantilever walkway at exactly 14:02, unannounced, hands folded behind his back, staring down at a pipe-handling operation with the quiet intensity of an eagle watching fish from a cliff edge.',
    action: 'Safety Note: Marine radar scans the water, but the OIM operates on an internal bio-radar that detects non-standard body language through three bulkheads and two flights of stairs. The moment someone on deck considers bypassing a tagline, picking up a tool without gloves, or taking a shortcut across the piperack, the OIM spontaneously materializes at the nearest handrail without making a single footstep. Deck crew maintained 100% compliance under the apex predator gaze.'
  },
  {
    id: 'humor_4',
    categoryTheme: 'humor',
    cardCategory: 'Safe',
    zone: 'Main Deck',
    role: 'OIM',
    assessment: 'Safe',
    obsType: 'Behavior Observation',
    category: 'Supervisory Oversight',
    observation: 'Observed the OIM materialize out of thin air on the main deck exactly four seconds after a forklift touched a line-of-fire barricade, hands tucked calmly behind his back, surveying the scene with the posture of an ancient emperor inspecting his borders.',
    action: 'Safety Note: Offshore Installation Managers possess an unmapped biological sixth sense that bypasses normal physics. While normal humans require radios or alarms, an OIM\'s peripheral vision is hardwired directly to every dropped pin, unlatched gate, and missing permit across all three decks simultaneously. Attempting to hide a near-miss under a rag is scientifically impossible within his 300-meter detection bubble. Driver commended for immediately acknowledging barricade contact.'
  },
  {
    id: 'humor_5',
    categoryTheme: 'humor',
    cardCategory: 'General',
    zone: 'Main Deck',
    role: 'Barge Engineer',
    assessment: 'Safe',
    obsType: 'Behavior Observation',
    category: 'Marine & Stability',
    observation: 'Observed a deck crew approaching the Barge Engineer’s office to ask for permission to move a single empty basket across the main deck, only to be met with a 20-minute interrogation regarding variable deck load (VDL), wind heel moments, center of gravity shift, and the current lunar tide cycle.',
    action: 'Safety Note: Managing rig stability and weight distribution is vital to keeping three legs firmly planted in the seabed. However, treating a standard 500-kg equipment basket like an unscheduled drydock operation causes chronic deck traffic jams, roustabout confusion, and excessive head-scratching under hard hats. Permitted shift after rigorous engineering debate.'
  },
  {
    id: 'humor_6',
    categoryTheme: 'humor',
    cardCategory: 'Safe',
    zone: 'Rig Floor',
    role: 'Driller',
    assessment: 'Safe',
    obsType: 'Behavior Observation',
    category: 'Red Zone Control',
    observation: 'Observed the Assistant Driller freeze in mid-step like a statue playing musical chairs the exact millisecond the rotary table began to rotate, refusing to blink until both feet were planted outside the red zone line.',
    action: 'Safety Note: Total situational awareness turns grown men into synchronized dancers. Adherence to zero-entry red zone perimeter was textbook, saving both boots and dignity from the iron roughneck orbit.'
  },
  {
    id: 'humor_7',
    categoryTheme: 'humor',
    cardCategory: 'Safe',
    zone: 'Mud Pit / Sack Room',
    role: 'Floorman',
    assessment: 'Safe',
    obsType: 'Behavior Observation',
    category: 'PPE & Chemical Safety',
    observation: 'Observed the Shaker Hand suited up in full chemical apron, face shield, rubber gauntlets, and respirator just to open a fresh box of offshore tea bags in the galley doghouse.',
    action: 'Safety Note: While some call it over-caution, treating industrial-strength rig Earl Grey with the same respect as 16.5 ppg synthetic oil-based mud prevents critical burns and tongue incidents. Level 4 PPE compliance verified.'
  },
  {
    id: 'humor_8',
    categoryTheme: 'humor',
    cardCategory: 'General',
    zone: 'Cranes',
    role: 'Crane Operator',
    assessment: 'Unsafe',
    obsType: 'STOP Work Authority (SWA)',
    category: 'Lifting & Rigging / SWA',
    observation: 'Observed a deckhand attempting to signal Crane #1 using vigorous body language that resembled a frantic mating dance of an offshore seagull rather than standard Aramco hand signals.',
    action: 'Safety Note: Standard API/Aramco crane signals exist so the crane cab doesn\'t mistake an itch on your collarbone for "lower boom 50 feet into the sea". Crane operator executed immediate Stop Work Authority (SWA) and held on-the-spot refresher on standard hand signals.'
  },
  {
    id: 'humor_9',
    categoryTheme: 'humor',
    cardCategory: 'Safe',
    zone: 'Cantilever / Pipe Deck',
    role: 'Roustabout',
    assessment: 'Safe',
    obsType: 'STOP Work Authority (SWA)',
    category: 'Stop Work Authority (SWA)',
    observation: 'Observed roustabout immediately cross both forearms overhead in standard SWA signal when a sudden sea swell caused a supply basket to tilt during marine offloading.',
    action: 'Safety Note: The universal SWA "X" gesture commands more immediate respect offshore than a red traffic light on highway 95. Operation suspended safely; cargo re-rigged with two 12-ft taglines.'
  },
  {
    id: 'humor_10',
    categoryTheme: 'humor',
    cardCategory: 'Safe',
    zone: 'Rig Floor',
    role: 'Floorman',
    assessment: 'Safe',
    obsType: 'Condition',
    category: 'Physical Barrier & Condition',
    observation: 'Observed rotary red-zone physical interlock gate latch lubricated, secondary chain pin verified, and warning strobe functioning with zero mechanical play.',
    action: 'Safety Note: Red zone physical barriers do not negotiate with rotating iron. Mechanical latch condition confirmed in pre-shift equipment checklist.'
  },
  {
    id: 'humor_11',
    categoryTheme: 'humor',
    cardCategory: 'Safe',
    zone: 'Shakers',
    role: 'Derrickman',
    assessment: 'Safe',
    obsType: 'Behavior Observation',
    category: 'Chemical Handling & PPE',
    observation: 'Observed Derrickman examining a mud sample flask under shaker lighting with the delicate swirl and sniff of a five-star sommelier evaluating vintage grape juice.',
    action: 'Safety Note: Respecting 14.2 ppg high-density brine requires sophisticated etiquette. Proper splash goggles and chemical nitrile gloves maintained throughout fluid inspection.'
  },
  {
    id: 'humor_12',
    categoryTheme: 'humor',
    cardCategory: 'Safe',
    zone: 'Main Deck',
    role: 'Mechanic',
    assessment: 'Safe',
    obsType: 'Behavior Observation',
    category: 'Lockout / Tagout (LOTO)',
    observation: 'Observed rig mechanic attaching four heavy padlocks, two lockout hasps, and a bright red danger tag to a fuel transfer valve with the ceremony of guarding Fort Knox.',
    action: 'Safety Note: When a mechanic locks out high-pressure machinery, even Houdini would fail to energize the breaker. Zero stored energy confirmed by pressure gauge bleed-off.'
  }
];

export const MUSIC_SOAR_CARDS: SoarCardTemplate[] = [
  {
    id: 'music_1',
    categoryTheme: 'music',
    cardCategory: 'Safe',
    zone: 'Main Deck',
    role: 'Mechanic',
    assessment: 'Safe',
    obsType: 'Behavior Observation',
    category: 'Shift Handover & Communication',
    observation: 'Observed the night-shift mechanic tracking down the day-shift mechanic at shift exchange to demand a full verbal debrief on a newly rebuilt mud pump liner before the day guy headed to bed.',
    action: 'Safety Note: George Michael and Andrew Ridgeley outlined the golden rule of operational handovers:\n\n"Wake me up before you go-go\nDon\'t leave me hanging on like a yo-yo\nWake me up before you go-go\n\'Cause I\'m not planning on going solo"\n— Wham!, "Wake Me Up Before You Go-Go"\n\nBoth mechanics verified liner torque and seal packing together.'
  },
  {
    id: 'music_2',
    categoryTheme: 'music',
    cardCategory: 'Safe',
    zone: 'Rig Floor',
    role: 'Driller',
    assessment: 'Safe',
    obsType: 'Behavior Observation',
    category: 'Well Control & Pressure',
    observation: 'Observed the Driller monitor standpipe pressure with surgical focus while circulating gas out through the choke manifold during a 15-barrel influx.',
    action: 'Safety Note: Freddie Mercury and David Bowie understood offshore well control fundamentals:\n\n"Pressure pushing down on me\nPressing down on you, no man ask for\nUnder pressure that burns a building down\nSplits a family in two, puts people on streets"\n— Queen & David Bowie, "Under Pressure"\n\nChoke adjusted in increments of 50 psi; bottom-hole balance maintained flawlessly.'
  },
  {
    id: 'music_3',
    categoryTheme: 'music',
    cardCategory: 'General',
    zone: 'Shakers',
    role: 'HSE Specialist',
    assessment: 'Safe',
    obsType: 'Condition',
    category: 'Gas Monitoring & H2S',
    observation: 'Observed the mud logger check sensor calibration and cross-verify ambient LEL / H2S detectors before high-gas sand was penetrated.',
    action: 'Safety Note: Phil Collins wrote the anthem for gas detector verification:\n\n"I can feel it coming in the air tonight, oh Lord\nAnd I\'ve been waiting for this moment for all my life, oh Lord"\n— Phil Collins, "In the Air Tonight"\n\nFixed gas sensors verified at 0 ppm H2S and 0% LEL.'
  },
  {
    id: 'music_4',
    categoryTheme: 'music',
    cardCategory: 'General',
    zone: 'Cantilever / Pipe Deck',
    role: 'Toolpusher',
    assessment: 'Unsafe',
    obsType: 'STOP Work Authority (SWA)',
    category: 'Stop Work Authority (SWA)',
    observation: 'Observed an unstable casing bundle shifting on the catwalk under gusting 28-knot winds while roustabouts prepared to attach slings.',
    action: 'Safety Note: Kenny Rogers summarized the core philosophy of Stop Work Authority:\n\n"You\'ve got to know when to hold \'em\nKnow when to fold \'em\nKnow when to walk away\nAnd know when to run"\n— Kenny Rogers, "The Gambler"\n\nSWA invoked immediately. Lift suspended until wind subsided below the 20-knot pipe handling limit.'
  },
  {
    id: 'music_5',
    categoryTheme: 'music',
    cardCategory: 'Safe',
    zone: 'Derrick',
    role: 'Derrickman',
    assessment: 'Safe',
    obsType: 'Condition',
    category: 'Working at Heights & Fall Protection',
    observation: 'Observed the Derrickman inspecting twin inertia reels, full-body harness stitching, and double-action snap hooks before stepping out onto the monkeyboard.',
    action: 'Safety Note: Jon Bon Jovi captured the essential discipline of offshore fall protection:\n\n"Whoa, we\'re half way there\nWhoa, livin\' on a prayer\nTake my hand, we\'ll make it I swear"\n— Bon Jovi, "Livin\' on a Prayer"\n\n100% tie-off verified at 90 ft monkey board level; zero prayer required when 5,000 lb anchor points are clipped.'
  },
  {
    id: 'music_6',
    categoryTheme: 'music',
    cardCategory: 'Safe',
    zone: 'Rig Floor',
    role: 'Floorman',
    assessment: 'Safe',
    obsType: 'Behavior Observation',
    category: 'Pinch Points & Hand Safety',
    observation: 'Observed the casing tongs operator refusing to grab the backup line with bare palms, insisting on hands-free push-pull handles during joint torquing.',
    action: 'Safety Note: MC Hammer provided the definitive pinch-point instruction:\n\n"U can\'t touch this\nStop, Hammer time!"\n— MC Hammer, "U Can\'t Touch This"\n\nCrew kept fingers 18 inches away from the iron roughneck bite zone.'
  },
  {
    id: 'music_7',
    categoryTheme: 'music',
    cardCategory: 'Safe',
    zone: 'Cranes',
    role: 'Crane Operator',
    assessment: 'Safe',
    obsType: 'STOP Work Authority (SWA)',
    category: 'Stop Work Authority (SWA)',
    observation: 'Observed deck rigger stop the supply vessel heavy container lift midway when the stern line tension shifted abruptly in rough seas.',
    action: 'Safety Note: The Clash asked the million-dollar question:\n\n"Should I stay or should I go now?\nIf I go there will be trouble\nAnd if I stay it will be double"\n— The Clash, "Should I Stay or Should I Go"\n\nRigger made the clear call under SWA: lower load back to deck immediately.'
  },
  {
    id: 'music_8',
    categoryTheme: 'music',
    cardCategory: 'Safe',
    zone: 'Rig Floor',
    role: 'Driller',
    assessment: 'Safe',
    obsType: 'Behavior Observation',
    category: 'Vigilance & Situational Awareness',
    observation: 'Observed the Driller maintain laser focus on the drill floor console and weight indicator during high-risk drilling through reactive shale.',
    action: 'Safety Note: Survivor set the tempo for offshore focus:\n\n"It\'s the eye of the tiger, it\'s the thrill of the fight\nRisin\' up to the challenge of our rival"\n— Survivor, "Eye of the Tiger"\n\nMaintained continuous 360-degree situational awareness across the rotary table.'
  },
  {
    id: 'music_9',
    categoryTheme: 'music',
    cardCategory: 'Safe',
    zone: 'Engine Room',
    role: 'Electrician',
    assessment: 'Safe',
    obsType: 'Behavior Observation',
    category: 'High Voltage Safety & LOTO',
    observation: 'Observed Chief Electrician testing SCR main bus bars with a calibrated proximity meter prior to breaker maintenance.',
    action: 'Safety Note: AC/DC rocked the high voltage truth:\n\n"You\'ve been thunderstruck!"\n— AC/DC, "Thunderstruck"\n\nProved zero energy state before anyone touched 600V switchgear; certified arc flash suit verified.'
  },
  {
    id: 'music_10',
    categoryTheme: 'music',
    cardCategory: 'Safe',
    zone: 'Main Deck',
    role: 'Roustabout',
    assessment: 'Safe',
    obsType: 'Condition',
    category: 'Slip & Trip Prevention',
    observation: 'Observed deck crew squeegeeing oil-based mud spray off the walkway grating outside the shaker house and laying down anti-slip traction mats.',
    action: 'Safety Note: Michael Jackson moonwalked with style, but on Rig 50 decks:\n\n"You\'ve been hit by, you\'ve been struck by a smooth criminal"\n— Michael Jackson, "Smooth Criminal"\n\nEliminated slippery mud slick before anyone lost traction in steel-toe boots.'
  }
];

export const CINEMA_SOAR_CARDS: SoarCardTemplate[] = [
  {
    id: 'cinema_1',
    categoryTheme: 'cinema',
    cardCategory: 'Safe',
    zone: 'Rig Floor',
    role: 'Driller',
    assessment: 'Safe',
    obsType: 'STOP Work Authority (SWA)',
    category: 'Stop Work Authority (SWA)',
    observation: 'Observed Driller halt top-drive travel when hydraulic torque feedback fluctuated unexpectedly during stand makeup.',
    action: 'Safety Note: Arnold Schwarzenegger in Terminator gave the ultimate SWA promise:\n\n"I\'ll be back!"\n— The Terminator (1984)\n\nOperation paused safely; hydraulic circuit checked and cleared before resuming operation.'
  },
  {
    id: 'cinema_2',
    categoryTheme: 'cinema',
    cardCategory: 'Safe',
    zone: 'Cantilever / Pipe Deck',
    role: 'Assistant Driller',
    assessment: 'Safe',
    obsType: 'Behavior Observation',
    category: 'Pace & Precision Over Rush',
    observation: 'Observed Assistant Driller remind the pipe handling crew to maintain steady, deliberate speed while racking 8-inch drill collars.',
    action: 'Safety Note: Maverick and Goose in Top Gun loved speed, but on an offshore rig:\n\n"I feel the need... the need for speed!"\n— Top Gun (1986)\n\n...is strictly rejected. Precision and controlled movement always trump rushing tubular makeup.'
  },
  {
    id: 'cinema_3',
    categoryTheme: 'cinema',
    cardCategory: 'Safe',
    zone: 'Derrick',
    role: 'Derrickman',
    assessment: 'Safe',
    obsType: 'Behavior Observation',
    category: 'Fall Arrest & Heights',
    observation: 'Observed Derrickman hook twin self-retracting lifelines to overhead certified D-rings before stepping out over the well center.',
    action: 'Safety Note: Master Yoda taught Luke Skywalker the core safety truth:\n\n"Do. Or do not. There is no try."\n— Star Wars: The Empire Strikes Back (1980)\n\nAt 90 feet in the air, 100% tie-off is absolute. No half-measures allowed.'
  },
  {
    id: 'cinema_4',
    categoryTheme: 'cinema',
    cardCategory: 'Safe',
    zone: 'BOP Area',
    role: 'Subsea Engineer',
    assessment: 'Safe',
    obsType: 'Condition',
    category: 'Well Control & Barrier Integrity',
    observation: 'Observed Subsea Engineer identify a minor pressure weeping on the accumulator pod pilot line during routine pressure walkdown.',
    action: 'Safety Note: Jim Lovell and Gene Kranz in Apollo 13 handled offshore emergencies with calm rigor:\n\n"Houston, we have a problem."\n— Apollo 13 (1995)\n\nIsolated pilot valve immediately, bled trapped hydraulic oil, and replaced the O-ring seal without delay.'
  },
  {
    id: 'cinema_5',
    categoryTheme: 'cinema',
    cardCategory: 'Safe',
    zone: 'Main Deck',
    role: 'Crane Operator',
    assessment: 'Safe',
    obsType: 'Behavior Observation',
    category: 'Line of Fire & Exclusion Zones',
    observation: 'Observed deck supervisor hold up hands and prevent roustabouts from crossing under a suspended container lift.',
    action: 'Safety Note: Gandalf in Lord of the Rings enforced the ultimate exclusion perimeter:\n\n"YOU SHALL NOT PASS!"\n— The Lord of the Rings: The Fellowship of the Ring (2001)\n\nZero tolerance for standing or walking beneath suspended loads on Rig 50 decks.'
  }
];

export const WISDOM_SOAR_CARDS: SoarCardTemplate[] = [
  {
    id: 'wisdom_1',
    categoryTheme: 'wisdom',
    cardCategory: 'Safe',
    zone: 'Rig Floor',
    role: 'Toolpusher',
    assessment: 'Safe',
    obsType: 'Behavior Observation',
    category: 'Planning & JSA Preparation',
    observation: 'Observed Toolpusher conduct a comprehensive pre-job toolbox talk, walking every crew member through line-of-fire risks before running casing.',
    action: 'Safety Note: Sun Tzu in The Art of War stated centuries ago:\n\n"Strategy without tactics is the slowest route to victory. Tactics without strategy is the noise before defeat."\n— Sun Tzu\n\nThorough JSA risk assessment before turning iron eliminates offshore surprises.'
  },
  {
    id: 'wisdom_2',
    categoryTheme: 'wisdom',
    cardCategory: 'Safe',
    zone: 'Main Deck',
    role: 'Rig Safety Coach (RSC)',
    assessment: 'Safe',
    obsType: 'Behavior Observation',
    category: 'Safety Leadership & Habit',
    observation: 'Observed floorman independently pick up a stray hammer wrench from the walkway and return it to the shadow board without being prompted.',
    action: 'Safety Note: Aristotle observed:\n\n"We are what we repeatedly do. Excellence, then, is not an act, but a habit."\n— Aristotle\n\nDaily proactive housekeeping creates a culture where dropped objects have no room to exist.'
  },
  {
    id: 'wisdom_3',
    categoryTheme: 'wisdom',
    cardCategory: 'Safe',
    zone: 'Mud Pits',
    role: 'Mud Engineer',
    assessment: 'Safe',
    obsType: 'Condition',
    category: 'Barrier Redundancy',
    observation: 'Observed shaker hand verify dual whipchecks and secondary retention pins on high-pressure mud transfer hoses.',
    action: 'Safety Note: Edward A. Murphy Jr. coined the universal offshore law:\n\n"Anything that can go wrong will go wrong—unless secondary safety restraints are pinned."\n— Murphy\'s Law (Offshore Edition)\n\nDual containment verified on all 3,000-psi lines.'
  }
];

export const MILITARY_SOAR_CARDS: SoarCardTemplate[] = [
  {
    id: 'military_1',
    categoryTheme: 'military',
    cardCategory: 'Safe',
    zone: 'Rig Floor',
    role: 'Driller',
    assessment: 'Safe',
    obsType: 'Behavior Observation',
    category: 'Sterile Cockpit Rule',
    observation: 'Observed Driller enforce a strict "Sterile Cockpit" during casing landing, prohibiting any non-essential chatter or radio traffic.',
    action: 'Safety Note: Aviation Flight Safety Standard:\n\n"During critical flight phases, all non-essential crew communication is ceased."\n— FAA Sterile Cockpit Protocol\n\n100% focused silence maintained until casing hanger was locked in the wellhead.'
  },
  {
    id: 'military_2',
    categoryTheme: 'military',
    cardCategory: 'Safe',
    zone: 'Main Deck',
    role: 'RSC',
    assessment: 'Safe',
    obsType: 'Condition',
    category: 'FOD (Foreign Object Debris) Sweep',
    observation: 'Observed deck crew conduct an organized arm-in-arm FOD walkdown across the main deck prior to helicopter landing.',
    action: 'Safety Note: Aircraft Carrier Flight Deck Discipline:\n\n"Foreign Object Debris sweeps eliminate microscopic hazards before jet intake."\n— Naval Aviation Protocol\n\nHelideck and surrounding walkways cleared of all loose fasteners and debris.'
  }
];

export const SPORTS_SOAR_CARDS: SoarCardTemplate[] = [
  {
    id: 'sports_1',
    categoryTheme: 'sports',
    cardCategory: 'Safe',
    zone: 'Rig Floor',
    role: 'Floorman',
    assessment: 'Safe',
    obsType: 'Behavior Observation',
    category: 'Teamwork & Synchronization',
    observation: 'Observed drill crew execute tubular connection with the flawless rhythm and positioning of a Formula 1 pit crew.',
    action: 'Safety Note: Formula 1 Championship Principle:\n\n"Speed is a byproduct of precision, zero unnecessary motion, and 100% trust in your teammate."\n— Scuderia F1 Pit Crew Motto\n\nSlips set and iron roughneck torqued with hands-free safety handles in 18 seconds clean.'
  },
  {
    id: 'sports_2',
    categoryTheme: 'sports',
    cardCategory: 'Safe',
    zone: 'Main Deck',
    role: 'Crane Operator',
    assessment: 'Safe',
    obsType: 'STOP Work Authority (SWA)',
    category: 'Fair Play & Refereeing SWA',
    observation: 'Observed banksman raise two crossed hands and blow safety whistle when forklift neared a blind spot.',
    action: 'Safety Note: FIFA World Cup Refereeing Discipline:\n\n"The referee blows the whistle before a foul becomes an injury."\n— Elite Sports Officiating\n\nImmediate SWA intervention prevented pedestrian crossing conflict.'
  }
];

export const SAFE_CATEGORY_CARDS: SoarCardTemplate[] = [
  {
    id: 'safe_cat_1',
    categoryTheme: 'operations',
    cardCategory: 'Safe',
    zone: 'Rig Floor',
    role: 'Driller',
    assessment: 'Safe',
    obsType: 'Behavior Observation',
    category: 'Red Zone Control Compliance',
    observation: 'Observed floormen maintaining 100% boundary discipline outside the rotary red zone perimeter during high-torque casing makeup.',
    action: 'Commended the crew on-the-spot for positive barrier adherence and exemplary communication with the driller.'
  },
  {
    id: 'safe_cat_2',
    categoryTheme: 'operations',
    cardCategory: 'Safe',
    zone: 'Cantilever / Pipe Deck',
    role: 'Assistant Driller',
    assessment: 'Safe',
    obsType: 'Behavior Observation',
    category: 'Hands-Free Tooling Usage',
    observation: 'Observed roustabouts utilizing 48-inch push-pull sticks to guide 9-5/8" casing joints onto the catwalk with zero manual hand contact.',
    action: 'Positive recognition given during shift handover for eliminating pinch-point exposure through hands-free tools.'
  },
  {
    id: 'safe_cat_3',
    categoryTheme: 'operations',
    cardCategory: 'Safe',
    zone: 'Mud Pit / Sack Room',
    role: 'Floorman',
    assessment: 'Safe',
    obsType: 'Condition',
    category: 'Chemical Handling & Ventilation',
    observation: 'Observed eye-wash station inspection tag verified within 7-day validity, fluid flow tested clean, and chemical suit neatly staged.',
    action: 'Verified eyewash station pressure reading and confirmed unobstructed egress path.'
  },
  {
    id: 'safe_cat_4',
    categoryTheme: 'operations',
    cardCategory: 'Safe',
    zone: 'Cranes',
    role: 'Crane Operator',
    assessment: 'Safe',
    obsType: 'Condition',
    category: 'Lifting & Rigging Integrity',
    observation: 'Observed crane hook safety latch spring tension inspected and 4-part wire rope lubricated with zero broken strands or flattening.',
    action: 'Confirmed pre-use crane checklist signed off; secondary tagline verified on all suspended baskets.'
  },
  {
    id: 'safe_cat_5',
    categoryTheme: 'operations',
    cardCategory: 'Safe',
    zone: 'Main Deck',
    role: 'RSC',
    assessment: 'Safe',
    obsType: 'Condition',
    category: 'Housekeeping & Walking Working Surfaces',
    observation: 'Observed main deck walkway clear of tripping hazards; marine hoses bundled neatly in certified ramps with rubber scuff guards.',
    action: 'Maintained 100% clean walkways across deck; positive reinforcement provided to roustabout crew.'
  }
];

export const OPERATIONS_SOAR_CARDS = SAFE_CATEGORY_CARDS;

export const GENERAL_CATEGORY_CARDS: SoarCardTemplate[] = [
  ...SAFE_CATEGORY_CARDS,
  ...HUMOR_SOAR_CARDS,
  ...MUSIC_SOAR_CARDS,
  ...CINEMA_SOAR_CARDS,
  ...WISDOM_SOAR_CARDS,
  ...MILITARY_SOAR_CARDS,
  ...SPORTS_SOAR_CARDS
];

const CUSTOM_CARDS_STORAGE_KEY = 'rig50_custom_soar_cards';

export function getStoredCustomCards(): SoarCardTemplate[] {
  try {
    const raw = localStorage.getItem(CUSTOM_CARDS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load custom cards from storage:', e);
    return [];
  }
}

export function saveCustomCard(card: Omit<SoarCardTemplate, 'id'>): SoarCardTemplate {
  const customCards = getStoredCustomCards();
  const newCard: SoarCardTemplate = {
    ...card,
    id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    categoryTheme: 'custom'
  };
  customCards.unshift(newCard);
  try {
    localStorage.setItem(CUSTOM_CARDS_STORAGE_KEY, JSON.stringify(customCards));
  } catch (e) {
    console.error('Failed to save custom card:', e);
  }
  return newCard;
}

export function deleteCustomCard(id: string): void {
  const customCards = getStoredCustomCards().filter(c => c.id !== id);
  try {
    localStorage.setItem(CUSTOM_CARDS_STORAGE_KEY, JSON.stringify(customCards));
  } catch (e) {
    console.error('Failed to delete custom card:', e);
  }
}

export function saveAllCustomCards(cards: SoarCardTemplate[]): void {
  try {
    localStorage.setItem(CUSTOM_CARDS_STORAGE_KEY, JSON.stringify(cards));
  } catch (e) {
    console.error('Failed to save custom cards:', e);
  }
}

/**
 * Returns a pool of cards based on:
 * 1. cardCategory: 'Safe' vs 'General'
 * 2. themes: array of theme IDs (or single string for backward compatibility)
 * 3. assessmentFilter: 'all' | 'safe_only' | 'unsafe_only' | 'realistic_mix'
 */
export const FOOD_SOAR_CARDS: SoarCardTemplate[] = [
  {
    id: 'food_1',
    categoryTheme: 'food',
    cardCategory: 'Safe',
    zone: 'Living Quarters',
    role: 'Camp Boss',
    assessment: 'Safe',
    obsType: 'Behavior Observation',
    category: 'Culinary Appreciation',
    ppe: 'PPE Worn Correctly (Compliant)',
    observation: 'The eternal late-night debate in the recreation dining hall settled on whether an extra-garlic chicken shawarma on toasted saj bread beats a double-smashed wagyu cheeseburger after a 12-hour day.',
    action: 'Takeaway: Both contenders were declared co-champions of comfort food, especially when paired with crispy seasoned fries and ice-cold lemon mint.'
  },
  {
    id: 'food_2',
    categoryTheme: 'food',
    cardCategory: 'Safe',
    zone: 'Living Quarters',
    role: 'Medic',
    assessment: 'Safe',
    obsType: 'Behavior Observation',
    category: 'Coffee Culture',
    ppe: 'PPE Worn Correctly (Compliant)',
    observation: 'Morning espresso calibration reached artisan barista levels today as a freshly pulled Ethiopian double-shot espresso with velvety micro-foam turned Monday-morning energy into Friday-afternoon enthusiasm.',
    action: 'Takeaway: Good coffee doesn’t just wake you up—it upgrades the entire room’s mood before anyone even checks their first message.'
  },
  {
    id: 'food_3',
    categoryTheme: 'food',
    cardCategory: 'Safe',
    zone: 'Living Quarters',
    role: 'Toolpusher',
    assessment: 'Safe',
    obsType: 'Behavior Observation',
    category: 'Barbecue Night',
    ppe: 'PPE Worn Correctly (Compliant)',
    observation: 'Thursday evening ribeye steak night delivered a masterclass in caramelization, with medium-rare char-grilled perfection and smoked rosemary butter stealing the spotlight across every table.',
    action: 'Takeaway: Unanimous 5-star Michelin rating awarded to the kitchen team; zero leftovers survived past 19:30.'
  }
];

export const GAMING_SOAR_CARDS: SoarCardTemplate[] = [
  {
    id: 'game_1',
    categoryTheme: 'gaming',
    cardCategory: 'Safe',
    zone: 'Living Quarters',
    role: 'Electrician',
    assessment: 'Safe',
    obsType: 'Behavior Observation',
    category: 'Gaming Highlight',
    ppe: 'PPE Worn Correctly (Compliant)',
    observation: 'During the recreation room EA FC / FIFA tournament final, a 90+4th minute top-corner bicycle kick equalized the match and caused the entire lounge sofa section to erupt like a World Cup stadium.',
    action: 'Takeaway: Penalty shootout drama was won 5-4 with a panenka chip down the middle; controller discipline remained intact throughout the celebration.'
  },
  {
    id: 'game_2',
    categoryTheme: 'gaming',
    cardCategory: 'Safe',
    zone: 'Living Quarters',
    role: 'Barge Engineer',
    assessment: 'Safe',
    obsType: 'Behavior Observation',
    category: 'Tech & Sci-Fi',
    ppe: 'PPE Worn Correctly (Compliant)',
    observation: 'A lively discussion broke out over the greatest open-world video games of all time—comparing Red Dead Redemption 2 sunset vistas, GTA Vice City nostalgia, and Elden Ring boss fights.',
    action: 'Takeaway: Everyone agreed that nothing beats booting up a classic game with noise-canceling headphones and zero notifications.'
  }
];

export const TRAVEL_SOAR_CARDS: SoarCardTemplate[] = [
  {
    id: 'trv_1',
    categoryTheme: 'travel',
    cardCategory: 'Safe',
    zone: 'Main Deck',
    role: 'Driller',
    assessment: 'Safe',
    obsType: 'Behavior Observation',
    category: 'Automotive & Travel',
    ppe: 'PPE Worn Correctly (Compliant)',
    observation: 'Coffee break conversation turned to the unmistakable cold-start exhaust note of a naturally aspirated 5.2-liter V10 supercar echoing through an Alpine mountain tunnel.',
    action: 'Takeaway: Whether it is a classic Porsche 911 GT3, a Nissan GT-R, or a Land Cruiser conquering desert dunes, great engineering is pure art in motion.'
  },
  {
    id: 'trv_2',
    categoryTheme: 'travel',
    cardCategory: 'Safe',
    zone: 'Living Quarters',
    role: 'OIM',
    assessment: 'Safe',
    obsType: 'Behavior Observation',
    category: 'Travel & Adventure',
    ppe: 'PPE Worn Correctly (Compliant)',
    observation: 'Crew members traded top bucket-list vacation itineraries—from watching the Northern Lights in Tromsø and sipping Turkish tea overlooking the Bosphorus to beachside sunsets in the Maldives.',
    action: 'Takeaway: Planning the next time-off adventure is half the fun of the countdown calendar.'
  }
];

export const CREW_LIFE_SOAR_CARDS: SoarCardTemplate[] = [
  {
    id: 'life_1',
    categoryTheme: 'crew_life',
    cardCategory: 'Safe',
    zone: 'Living Quarters',
    role: 'Floorman',
    assessment: 'Safe',
    obsType: 'Behavior Observation',
    category: 'Camp Life',
    ppe: 'PPE Worn Correctly (Compliant)',
    observation: 'The cabin air-conditioning thermostat was set so ambitiously cold that walking in from the hallway felt like stepping into an expedition research base in Antarctica.',
    action: 'Takeaway: Extra fleece blanket deployed for optimal hibernate-grade sleep quality; penguins would feel right at home.'
  },
  {
    id: 'life_2',
    categoryTheme: 'crew_life',
    cardCategory: 'Safe',
    zone: 'Living Quarters',
    role: 'Derrickman',
    assessment: 'Safe',
    obsType: 'Behavior Observation',
    category: 'Lounge Championship',
    ppe: 'PPE Worn Correctly (Compliant)',
    observation: 'The nightly dominoes and card table championship in the rec room featured strategic bluffing, dramatic tile slams, and commentary worthy of a prime-time television broadcast.',
    action: 'Takeaway: Undefeated title defended for the third night in a row while fresh Arabic coffee and dates were shared around the table.'
  }
];

export function getCardPoolByTheme(
  themeInput: ThemeId | string | string[],
  assessmentFilter: 'all' | 'safe_only' | 'unsafe_only' | 'realistic_mix',
  cardCategory: CardCategoryType = 'Safe',
  obsTypeFilter?: 'all_balanced' | 'behavior' | 'condition' | 'swa' | 'swa_drill' | string
): SoarCardTemplate[] {
  const customCards = getStoredCustomCards();
  const themes: string[] = Array.isArray(themeInput) 
    ? (themeInput.length > 0 ? themeInput : ['operations'])
    : (themeInput === 'all' ? ['humor', 'music', 'cinema', 'food', 'gaming', 'travel', 'crew_life', 'wisdom', 'military', 'sports', 'operations', 'custom'] : [themeInput]);

  let pool: SoarCardTemplate[] = [];

  for (const t of themes) {
    if (t === 'humor') {
      pool.push(...HUMOR_SOAR_CARDS);
    } else if (t === 'music') {
      pool.push(...MUSIC_SOAR_CARDS);
    } else if (t === 'cinema') {
      pool.push(...CINEMA_SOAR_CARDS);
    } else if (t === 'food') {
      pool.push(...FOOD_SOAR_CARDS);
    } else if (t === 'gaming') {
      pool.push(...GAMING_SOAR_CARDS);
    } else if (t === 'travel') {
      pool.push(...TRAVEL_SOAR_CARDS);
    } else if (t === 'crew_life') {
      pool.push(...CREW_LIFE_SOAR_CARDS);
    } else if (t === 'wisdom') {
      pool.push(...WISDOM_SOAR_CARDS);
    } else if (t === 'military') {
      pool.push(...MILITARY_SOAR_CARDS);
    } else if (t === 'sports') {
      pool.push(...SPORTS_SOAR_CARDS);
    } else if (t === 'custom') {
      pool.push(...(customCards.length > 0 ? customCards : SAFE_CATEGORY_CARDS));
    } else if (t === 'operations') {
      pool.push(...(cardCategory === 'Safe' ? SAFE_CATEGORY_CARDS : GENERAL_CATEGORY_CARDS));
    }
  }

  if (pool.length === 0) {
    pool = cardCategory === 'Safe' ? [...SAFE_CATEGORY_CARDS] : [...GENERAL_CATEGORY_CARDS];
  }

  // 2. Automatically adjust content generation logic based on cardCategory ('Safe' vs 'General')
  if (cardCategory === 'Safe') {
    pool = pool.map(c => ({
      ...c,
      assessment: 'Safe' as const,
      obsType: c.obsType || 'Behavior Observation',
      category: c.category.includes('Failure') || c.category.includes('Defect') 
        ? 'Safe Behavior Observation' 
        : c.category
    }));
  }

  // 3. Apply Assessment Filter if specified
  if (assessmentFilter === 'safe_only') {
    pool = pool.map(c => ({
      ...c,
      assessment: 'Safe' as const
    }));
  } else if (assessmentFilter === 'unsafe_only') {
    pool = pool.map(c => ({
      ...c,
      assessment: 'Unsafe' as const
    }));
  }

  // 4. Apply Observation Type Filter if specified
  if (obsTypeFilter === 'swa') {
    return pool.map(c => ({ ...c, obsType: 'STOP Work Authority (SWA)' }));
  } else if (obsTypeFilter === 'condition') {
    return pool.map(c => ({ ...c, obsType: 'Condition' }));
  } else if (obsTypeFilter === 'behavior') {
    return pool.map(c => ({ ...c, obsType: 'Behavior Observation' }));
  } else if (obsTypeFilter === 'swa_drill') {
    return pool.map(c => ({ ...c, obsType: 'Stop Work Authority Drill' }));
  } else if (obsTypeFilter === 'all_balanced') {
    return pool.map((c, idx) => {
      if (c.obsType && ['STOP Work Authority (SWA)', 'Condition', 'Behavior Observation', 'Stop Work Authority Drill'].includes(c.obsType)) {
        return c;
      }
      const mod = idx % 10;
      const distributedType = mod < 5 ? 'Behavior Observation' : mod < 8 ? 'Condition' : 'STOP Work Authority (SWA)';
      return { ...c, obsType: distributedType };
    });
  }

  return pool;
}
