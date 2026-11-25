import { FormSchema, BatchRecord } from '../types/form';

export const USER_LIVE_FORM_URL = "https://forms.cloud.microsoft/pages/responsepage.aspx?id=xQnbPl7P00GPgcWAZM5ZhY4m7RBFZYJKvhctDXqy4KNUMjJRVFBGVDlVMzFEMUJOVUhMSjk1WU0wMy4u&origin=QRCode&qrcodeorigin=presentation&route=shorturl";
export const USER_TENANT_ID = "3edb09c5-cf5e-41d3-8f81-c58064ce5985";
export const USER_OWNER_ID = "10ed268e-6545-4a82-be17-2d0d7ab2e0a3";
export const USER_FORM_ID = "xQnbPl7P00GPgcWAZM5ZhY4m7RBFZYJKvhctDXqy4KNUMjJRVFBGVDlVMzFEMUJOVUhMSjk1WU0wMy4u";
export const RIG_50_NAME = "50 Bob Palmer (RBP-50A)";

export const RIG_50_CREW_NAMES = [
  "Mohammed Al-Otaibi",
  "Ahmed Al-Ghamdi",
  "Khalid Al-Zahrani",
  "Fahad Al-Dosari",
  "Sultan Al-Shammari",
  "Abdulaziz Al-Mutairi",
  "John Miller",
  "Mark Wilson",
  "Robert Davis",
  "David Clark"
];

export interface Rig50Scenario {
  id: string;
  title: string;
  zone: string;
  role: string;
  assessment: 'Safe' | 'Unsafe';
  obsType: string;
  category: string;
  observation: string;
  action: string;
}

export const RIG_50_SCENARIOS: Rig50Scenario[] = [
  {
    id: 'scen_redzone',
    title: 'Red Zone Compliance during Casing Run',
    zone: 'Rig Floor',
    role: 'Driller',
    assessment: 'Safe',
    obsType: 'Behavior Observation',
    category: 'Red Zone Control Failure',
    observation: 'During tubular running on rig floor, all crew members stayed completely outside the marked red zone perimeter while the elevators were moving.',
    action: 'Acknowledged the drill crew at the post-activity briefing; recorded as a positive intervention in SOAR system.'
  },
  {
    id: 'scen_handsfree',
    title: 'Hands-Free Tooling on Pipe Deck',
    zone: 'Cantilever / Pipe Deck',
    role: 'Floorman',
    assessment: 'Safe',
    obsType: 'Behavior Observation',
    category: 'Hands-Free Tools Not Used',
    observation: 'Deck crew utilized push-pull safety sticks and tagline while offloading heavy casing joints, avoiding manual touch on suspended load.',
    action: 'Commended deck team for strictly following hands-free tool policy.'
  },
  {
    id: 'scen_swa_crane',
    title: 'Stop Work Authority (SWA) during Heavy Lift',
    zone: 'Cranes',
    role: 'Crane Operator',
    assessment: 'Safe',
    obsType: 'STOP Work Authority (SWA)',
    category: 'Person Under Suspended / Moving Load',
    observation: 'Rigger exercised Stop Work Authority when sudden wind gusts exceeded lift plan limits while transferring a basket to the supply boat.',
    action: 'Crane operator brought load down to safe deck position. Lift suspended until wind speed returned to safe operating threshold.'
  },
  {
    id: 'scen_housekeeping',
    title: 'Trip Hazard Remediation on Main Deck',
    zone: 'Main Deck',
    role: 'HSE Specialist',
    assessment: 'Unsafe',
    obsType: 'Condition',
    category: 'Poor Housekeeping',
    observation: 'Temporary welding power cables were left crossing the main transit walkway near the mud pump room without cable protection ramps.',
    action: 'Intervened immediately; rerouted cables over safety hangers and installed heavy-duty walkway bridge ramps.'
  },
  {
    id: 'scen_ppe_shakers',
    title: 'Proper Chemical PPE Compliance at Shakers',
    zone: 'Shakers',
    role: 'Roustabout',
    assessment: 'Safe',
    obsType: 'Behavior Observation',
    category: 'PPE Worn Correctly (Compliant)',
    observation: 'Shaker hand was observed wearing complete chemical goggles, nitrile gloves, and face shield while taking drilling mud density samples.',
    action: 'Praised shaker hand for exemplary PPE adherence during routine mud monitoring.'
  },
  {
    id: 'scen_working_height',
    title: '100% Tie-Off Verification on Monkeyboard',
    zone: 'Derrick',
    role: 'Derrickman',
    assessment: 'Safe',
    obsType: 'Behavior Observation',
    category: 'Red Zone Control Failure',
    observation: 'Derrickman conducted pre-use inspection of safety harness and verified dual inertia reel lanyards before stepping out onto diving board.',
    action: 'Verified current harness inspection tag and recorded pre-climb checklist.'
  },
  {
    id: 'scen_bop_barrier',
    title: 'BOP Area Red Zone Barrier Integrity',
    zone: 'BOP',
    role: 'Maintenance Supervisor',
    assessment: 'Safe',
    obsType: 'Condition',
    category: 'Red Zone Control Failure',
    observation: 'Physical red chain barrier and warning signage were properly posted and locked at BOP access stairs during pressure test.',
    action: 'Confirmed barrier maintained by test supervisor until line bleed-off complete.'
  }
];

export const defaultFormSchema: FormSchema = {
  id: USER_FORM_ID,
  title: 'Stop Observe Act Report-(SOAR)',
  description: 'Rev-02 | Rig 50 Bob Palmer (RBP-50A)',
  formUrl: USER_LIVE_FORM_URL,
  isAnonymous: true,
  page1: {
    id: 'page_1_general',
    pageNumber: 1,
    title: 'Page 1: General Details & Observation Overview',
    description: 'Initial reporting details including rig location, zone, observer role, and observation type.',
    questions: [
      {
        id: 'r5f3272b6049d4ad18e7650bd96ae837b',
        number: 1,
        title: 'Date',
        type: 'date',
        required: true,
        defaultValue: '2026-09-30'
      },
      {
        id: 'r4fdd1bd872014d9c80d3a51be3f2f950',
        number: 2,
        title: 'Rig / Location',
        type: 'dropdown',
        required: true,
        options: [
          '50 Bob Palmer (RBP-50A)'
        ],
        defaultValue: '50 Bob Palmer (RBP-50A)'
      },
      {
        id: 'r409eb59dd0f244e4b52573ce50037896',
        number: 3,
        title: 'Zones',
        type: 'dropdown',
        required: true,
        options: [
          'Accommodations',
          'BOP',
          'Cantilever / Pipe Deck',
          'Control Room',
          'Cranes',
          'Derrick',
          'ECR / Engine Room',
          'Helideck',
          'Main Deck',
          'Moonpool / Substructure',
          'Rig Floor',
          'Shakers',
          'Other Area'
        ],
        defaultValue: 'Rig Floor'
      },
      {
        id: 'rfe47535c542e4ce8886c2741c4c69b78',
        number: 4,
        title: 'Observer Role',
        type: 'dropdown',
        required: true,
        options: [
          'Driller',
          'Assistant Driller',
          'Floorman',
          'Crane Operator',
          'Derrickman',
          'Electrician',
          'HSE Specialist',
          'Mechanic',
          'Rig Manager',
          'Rig Safety Coach (RSC)',
          'Roustabout',
          'Toolpusher',
          'Other'
        ],
        defaultValue: 'Rig Safety Coach (RSC)'
      },
      {
        id: 'r26c88746635b40a39ef3f873e00e78a8',
        number: 5,
        title: 'Assessment',
        type: 'radio',
        required: true,
        options: ['Safe', 'Unsafe'],
        defaultValue: 'Safe'
      },
      {
        id: 'ra8f38f21840f490a87ac70d61da452f8',
        number: 6,
        title: 'Observation Type',
        type: 'radio',
        required: true,
        options: [
          'STOP Work Authority (SWA)',
          'Behavior Observation',
          'Condition',
          'Stop Work Authority Drill'
        ],
        defaultValue: 'Behavior Observation'
      }
    ]
  },
  page2: {
    id: 'page_2_categories',
    pageNumber: 2,
    title: 'Page 2: Observation Categories & Action Taken',
    description: 'Specific hazard categories, observation description, and actions taken to mitigate.',
    questions: [
      {
        id: 'r2d178592d7f94a6aad56238bc1005d5f',
        number: 7,
        title: 'Line of Fire / Hazard Focus',
        type: 'dropdown',
        required: false,
        options: [
          'Red Zone Control Failure',
          'Hands-Free Tools Not Used',
          'Person Under Suspended / Moving Load',
          'Unsecured Tools & Materials at Height',
          'Stored Energy Not Controlled'
        ],
        defaultValue: 'Red Zone Control Failure'
      },
      {
        id: 'r22c97581ebf74a8498da93d022d8afcf',
        number: 8,
        title: 'PPE Status',
        type: 'dropdown',
        required: false,
        options: [
          'PPE Worn Correctly (Compliant)',
          'PPE Not Worn',
          'PPE Worn Incorrectly',
          'Damaged / Expired PPE',
          'PPE Unavailable'
        ],
        defaultValue: 'PPE Worn Correctly (Compliant)'
      },
      {
        id: 're36e820370e2436798ea97f34930b753',
        number: 9,
        title: 'Describe your observation',
        type: 'textarea',
        required: true,
        defaultValue: 'During tubular running on rig floor, all crew members stayed completely outside the marked red zone perimeter while the elevators were moving.'
      },
      {
        id: 'rda2692cb0c9841fdb71f4b2ec5415728',
        number: 10,
        title: 'Describe your action taken',
        type: 'textarea',
        required: true,
        defaultValue: 'Acknowledged the drill crew at the post-activity briefing; recorded as a positive intervention in SOAR system.'
      },
      {
        id: 'r698ffb98e604476b92020bb6c34790e9',
        number: 11,
        title: 'Observer Name (Optional)',
        type: 'text',
        required: false,
        defaultValue: ''
      }
    ]
  }
};

export const defaultBatchRecords: BatchRecord[] = [
  {
    id: 'rig50_rec_1',
    data: {
      r5f3272b6049d4ad18e7650bd96ae837b: '2026-09-30',
      r4fdd1bd872014d9c80d3a51be3f2f950: RIG_50_NAME,
      r409eb59dd0f244e4b52573ce50037896: 'Rig Floor',
      rfe47535c542e4ce8886c2741c4c69b78: 'Driller',
      r26c88746635b40a39ef3f873e00e78a8: 'Safe',
      ra8f38f21840f490a87ac70d61da452f8: 'Behavior Observation',
      r2d178592d7f94a6aad56238bc1005d5f: 'Red Zone Control Failure',
      r22c97581ebf74a8498da93d022d8afcf: 'PPE Worn Correctly (Compliant)',
      re36e820370e2436798ea97f34930b753: 'During tubular running on rig floor, all crew members stayed completely outside the marked red zone perimeter while the elevators were moving.',
      rda2692cb0c9841fdb71f4b2ec5415728: 'Acknowledged the drill crew at the post-activity briefing; recorded as a positive intervention in SOAR system.',
      r698ffb98e604476b92020bb6c34790e9: ''
    }
  },
  {
    id: 'rig50_rec_2',
    data: {
      r5f3272b6049d4ad18e7650bd96ae837b: '2026-09-30',
      r4fdd1bd872014d9c80d3a51be3f2f950: RIG_50_NAME,
      r409eb59dd0f244e4b52573ce50037896: 'Cantilever / Pipe Deck',
      rfe47535c542e4ce8886c2741c4c69b78: 'Floorman',
      r26c88746635b40a39ef3f873e00e78a8: 'Safe',
      ra8f38f21840f490a87ac70d61da452f8: 'Behavior Observation',
      r2d178592d7f94a6aad56238bc1005d5f: 'Hands-Free Tools Not Used',
      r22c97581ebf74a8498da93d022d8afcf: 'PPE Worn Correctly (Compliant)',
      re36e820370e2436798ea97f34930b753: 'Deck crew utilized push-pull safety sticks and tagline while offloading heavy casing joints, avoiding manual touch on suspended load.',
      rda2692cb0c9841fdb71f4b2ec5415728: 'Commended deck team for strictly following hands-free tool policy.',
      r698ffb98e604476b92020bb6c34790e9: 'Mohammed Al-Otaibi'
    }
  },
  {
    id: 'rig50_rec_3',
    data: {
      r5f3272b6049d4ad18e7650bd96ae837b: '2026-09-30',
      r4fdd1bd872014d9c80d3a51be3f2f950: RIG_50_NAME,
      r409eb59dd0f244e4b52573ce50037896: 'Cranes',
      rfe47535c542e4ce8886c2741c4c69b78: 'Crane Operator',
      r26c88746635b40a39ef3f873e00e78a8: 'Safe',
      ra8f38f21840f490a87ac70d61da452f8: 'STOP Work Authority (SWA)',
      r2d178592d7f94a6aad56238bc1005d5f: 'Person Under Suspended / Moving Load',
      r22c97581ebf74a8498da93d022d8afcf: 'PPE Worn Correctly (Compliant)',
      re36e820370e2436798ea97f34930b753: 'Rigger exercised Stop Work Authority when sudden wind gusts exceeded lift plan limits while transferring a basket to the supply boat.',
      rda2692cb0c9841fdb71f4b2ec5415728: 'Crane operator brought load down to safe deck position. Lift suspended until wind speed returned to safe operating threshold.',
      r698ffb98e604476b92020bb6c34790e9: ''
    }
  }
];
