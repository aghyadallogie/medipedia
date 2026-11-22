/**
 * Sample content for local development. Everything is short, clearly labelled as a sample,
 * and written for this project. It is not clinical guidance and must never reach production.
 */

export const SAMPLE_NOTE = 'Sample content for development. Not clinical guidance.'

export const domains = [
  { name: 'Cardiology', description: 'Heart and vascular disease.', order: 1 },
  { name: 'Pharmacology', description: 'Drug mechanisms, effects and adverse effects.', order: 2 },
  { name: 'Pathology', description: 'Mechanisms and morphology of disease.', order: 3 },
] as const

/** Sub-domains nest one level deep (AGENTS.md §4). */
export const subDomains = [
  { name: 'Arrhythmias', parent: 'Cardiology', description: 'Rhythm disorders.', order: 1 },
] as const

export const topics = [
  { name: 'Ischemic heart disease', domain: 'Cardiology', order: 1 },
  { name: 'Cardiac emergencies', domain: 'Cardiology', order: 2 },
  { name: 'Antihypertensives', domain: 'Pharmacology', order: 1 },
  { name: 'Endocrine drugs', domain: 'Pharmacology', order: 2 },
  { name: 'Hemodynamics and thrombosis', domain: 'Pathology', order: 1 },
  { name: 'Hematopathology', domain: 'Pathology', order: 2 },
] as const

export const flashcards = [
  {
    topic: 'Cardiac emergencies',
    front: "What is Beck's triad in cardiac tamponade?",
    back: ['Hypotension, jugular venous distension, and muffled (distant) heart sounds.'],
    tags: ['tamponade', 'emergency'],
  },
  {
    topic: 'Antihypertensives',
    front: 'Why do ACE inhibitors cause a dry cough?',
    back: [
      'ACE also breaks down bradykinin (it is kininase II). Blocking it lets bradykinin accumulate.',
    ],
    tags: ['ace-inhibitors', 'adverse-effects'],
  },
  {
    topic: 'Endocrine drugs',
    front: 'What is the main mechanism of metformin?',
    back: [
      'It lowers hepatic gluconeogenesis (via AMPK activation) and improves peripheral insulin sensitivity. On its own it rarely causes hypoglycemia.',
    ],
    tags: ['diabetes'],
  },
  {
    topic: 'Hemodynamics and thrombosis',
    front: "What are the components of Virchow's triad?",
    back: ['Stasis, endothelial injury, and hypercoagulability.'],
    tags: ['thrombosis'],
  },
  {
    topic: 'Ischemic heart disease',
    front:
      'Which ECG leads show ST elevation in an inferior myocardial infarction, and which artery is usually responsible?',
    back: ['Leads II, III and aVF. The right coronary artery is usually occluded.'],
    tags: ['ecg', 'mi'],
  },
] as const

type SampleQuestion = {
  topic: string
  difficulty: 'easy' | 'medium' | 'hard'
  vignette: string[]
  stem: string
  /** Exactly one `correct: true`. */
  choices: { text: string; correct: boolean; explanation: string }[]
  overall: string[]
}

export const questions: SampleQuestion[] = [
  {
    topic: 'Ischemic heart disease',
    difficulty: 'medium',
    vignette: [
      'A 58-year-old man with hypertension and a 30-pack-year smoking history presents with 45 minutes of crushing substernal chest pain that radiates to his left arm, with sweating. Blood pressure is 118/76 mm Hg and heart rate is 62/min. An ECG shows ST-segment elevation in leads II, III and aVF.',
    ],
    stem: 'Occlusion of which of the following arteries is most likely responsible?',
    choices: [
      {
        text: 'Left anterior descending artery',
        correct: false,
        explanation:
          'Occlusion causes anterior ST elevation in leads V1 to V4, not an inferior pattern.',
      },
      {
        text: 'Left circumflex artery',
        correct: false,
        explanation:
          'It supplies the lateral wall, so ST elevation appears in I, aVL, V5 and V6. It can supply the inferior wall in left-dominant hearts, but that is less common.',
      },
      {
        text: 'Right coronary artery',
        correct: true,
        explanation:
          'Inferior ST elevation (II, III, aVF) points to the right coronary artery, which usually gives rise to the posterior descending artery. It also supplies the sinoatrial and atrioventricular nodes in most people, which explains the relative bradycardia.',
      },
      {
        text: 'Left main coronary artery',
        correct: false,
        explanation:
          'A left main occlusion causes extensive anterior and lateral ischemia and usually severe hemodynamic collapse.',
      },
    ],
    overall: [
      'Match the ST-elevation pattern to the territory: inferior leads (II, III, aVF) point to the right coronary artery in most patients, anterior leads (V1 to V4) to the left anterior descending artery, and lateral leads to the left circumflex artery.',
    ],
  },
  {
    topic: 'Antihypertensives',
    difficulty: 'easy',
    vignette: [
      'A 62-year-old woman with hypertension starts a new antihypertensive medication. Two weeks later she reports a persistent dry cough. Her lung examination is normal and a chest radiograph is unremarkable.',
    ],
    stem: 'Which of the following medications most likely caused her symptoms?',
    choices: [
      {
        text: 'Lisinopril',
        correct: true,
        explanation:
          'ACE inhibitors reduce bradykinin breakdown. Accumulated bradykinin causes a dry cough in a meaningful minority of patients.',
      },
      {
        text: 'Losartan',
        correct: false,
        explanation:
          'Angiotensin receptor blockers do not affect bradykinin metabolism, so cough is uncommon. They are the usual substitute for ACE-inhibitor cough.',
      },
      {
        text: 'Amlodipine',
        correct: false,
        explanation:
          'Dihydropyridine calcium channel blockers typically cause peripheral edema and flushing.',
      },
      {
        text: 'Hydrochlorothiazide',
        correct: false,
        explanation:
          'Thiazides cause hypokalemia, hyponatremia, hyperuricemia and hypercalcemia, not cough.',
      },
    ],
    overall: [
      'ACE inhibitor cough comes from bradykinin accumulation. Switching to an angiotensin receptor blocker resolves it.',
    ],
  },
  {
    topic: 'Hematopathology',
    difficulty: 'medium',
    vignette: [
      'A 24-year-old man presents with painless cervical lymphadenopathy, fever, night sweats and weight loss. An excisional lymph node biopsy shows large binucleate cells with prominent eosinophilic nucleoli, surrounded by lymphocytes and eosinophils.',
    ],
    stem: 'Which of the following is the most likely diagnosis?',
    choices: [
      {
        text: 'Burkitt lymphoma',
        correct: false,
        explanation:
          'It shows a "starry sky" pattern of macrophages among monotonous medium-sized lymphoid cells.',
      },
      {
        text: 'Classic Hodgkin lymphoma',
        correct: true,
        explanation:
          'Reed-Sternberg cells (large, binucleate, "owl-eye" nucleoli) in a mixed inflammatory background are characteristic. They are CD15 and CD30 positive.',
      },
      {
        text: 'Diffuse large B-cell lymphoma',
        correct: false,
        explanation:
          'It consists of sheets of large B cells without Reed-Sternberg cells or a mixed inflammatory background.',
      },
      {
        text: 'Follicular lymphoma',
        correct: false,
        explanation:
          'It is associated with t(14;18) and shows neoplastic follicles of small cleaved cells.',
      },
    ],
    overall: [
      'Reed-Sternberg cells in a mixed inflammatory infiltrate define classic Hodgkin lymphoma.',
    ],
  },
]

export const lectures = [
  {
    title: '[Sample] Approach to acute chest pain',
    domains: ['Cardiology'],
    summary: 'A short sample lecture showing how content is authored and displayed.',
    body: [
      SAMPLE_NOTE,
      'Acute chest pain has a broad differential. Start by excluding the life-threatening causes: acute coronary syndrome, pulmonary embolism, aortic dissection, tension pneumothorax, esophageal rupture and cardiac tamponade.',
      'Obtain an ECG within minutes of arrival. ST-segment elevation in contiguous leads suggests a ST-elevation myocardial infarction and calls for immediate reperfusion.',
      'Then use the history, examination, serial ECGs and cardiac troponin to separate cardiac from non-cardiac causes.',
    ],
  },
  {
    title: '[Sample] Mechanisms of common antihypertensive classes',
    domains: ['Pharmacology', 'Cardiology'],
    summary: 'A short sample lecture on how the main antihypertensive classes work.',
    body: [
      SAMPLE_NOTE,
      'ACE inhibitors block conversion of angiotensin I to angiotensin II and reduce bradykinin breakdown, which explains cough and rarely angioedema. Angiotensin receptor blockers act at the AT1 receptor and spare bradykinin.',
      'Dihydropyridine calcium channel blockers relax arteriolar smooth muscle and can cause peripheral edema. Thiazide diuretics inhibit the sodium-chloride cotransporter in the distal convoluted tubule.',
    ],
  },
] as const

export const papers = [
  {
    title:
      'Randomised trial of cholesterol lowering in 4444 patients with coronary heart disease: the Scandinavian Simvastatin Survival Study (4S)',
    authors: ['Scandinavian Simvastatin Survival Study Group'],
    journal: 'The Lancet',
    year: 1994,
    domain: 'Cardiology',
    clinicalRelevance: 5,
    abstract: [
      'A randomized, placebo-controlled trial of simvastatin in patients with coronary heart disease and raised serum cholesterol.',
    ],
    sparkNotes: [
      SAMPLE_NOTE,
      'First large trial to show that lowering cholesterol with a statin reduces total mortality, not only coronary events, in patients with established coronary disease.',
    ],
  },
  {
    title:
      'Randomised trial of intravenous streptokinase, oral aspirin, both, or neither among 17,187 cases of suspected acute myocardial infarction: ISIS-2',
    authors: ['ISIS-2 (Second International Study of Infarct Survival) Collaborative Group'],
    journal: 'The Lancet',
    year: 1988,
    domain: 'Cardiology',
    clinicalRelevance: 5,
    abstract: [
      'A factorial randomized trial of streptokinase and aspirin, alone and together, in suspected acute myocardial infarction.',
    ],
    sparkNotes: [
      SAMPLE_NOTE,
      'Each of streptokinase and aspirin reduced vascular mortality, and the combination reduced it further. A foundation for early reperfusion and antiplatelet therapy.',
    ],
  },
] as const

/** Real, stable video IDs used only as embed placeholders. */
export const videos = [
  {
    title: '[Sample] Placeholder video (YouTube)',
    embedUrl: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    domain: 'Cardiology',
    durationSeconds: 19,
    description: [SAMPLE_NOTE, 'Replace with a vetted teaching video.'],
  },
  {
    title: '[Sample] Placeholder video (Vimeo)',
    embedUrl: 'https://vimeo.com/76979871',
    domain: 'Pharmacology',
    durationSeconds: 60,
    description: [SAMPLE_NOTE, 'Replace with a vetted teaching video.'],
  },
] as const
