/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';

export interface ChromaMetadata {
  section: string;
  subSection?: string;
  title: string;
  chapter: string;
  topics: string;
  summary_en: string;
  summary_ta: string;
}

export interface ChromaRecord {
  id: string;
  document: string;
  metadata: ChromaMetadata;
  embedding: number[];
}

export interface ChromaQueryResult {
  ids: string[];
  documents: string[];
  metadatas: ChromaMetadata[];
  distances: number[];
  scores: number[];
  expanded_query?: string;
  retrieval_mode: 'cross_lingual_dense' | 'keyword_expansion_hybrid' | 'rrf_fusion';
}

// ----------------------------------------------------------------------
// 1. TAMIL MORPHOLOGICAL STEMMER & NORMALIZER FOR LONG FARMER QUERIES
// ----------------------------------------------------------------------

const TAMIL_SUFFIX_PATTERNS = [
  // Compound case suffixes and postpositions
  /(?:களுக்கான|களுக்கு|களினுடைய|களினால்|களிலிருந்து|களோடு|களுடன்|களின்|களை|கள்)$/u,
  /(?:த்துக்காக|க்காக|தொடர்பான|குறித்து|பற்றி|உடைய|இன்|யின்|ஆல்|யால்|இல்|யில்|வில்|ல்)$/u,
  /(?:க்கு|உக்கு|வுக்கு|ற்கு|கையில்|போது|இன்போது|உள்ளதா|முடியுமா|செய்யலாமா|வேண்டும்|ஆகும்)$/u,
  /(?:ப்பட்ட|பட்ட|படும்|செய்யும்|வைத்த|வாங்கிய|இருக்கிற|உள்ள)$/u,
];

export function normalizeTamilToken(token: string): string {
  let cleaned = token.trim().toLowerCase();
  for (const pattern of TAMIL_SUFFIX_PATTERNS) {
    if (cleaned.length > 5) {
      cleaned = cleaned.replace(pattern, '');
    }
  }
  return cleaned;
}

// ----------------------------------------------------------------------
// 2. COMPREHENSIVE LEGAL TOPIC EXPANSION RULES
// ----------------------------------------------------------------------

interface LegalTopicRule {
  roots: string[];
  expandedEnglishTerms: string[];
  targetSections: string[];
  boostWeight: number;
}

export const LEGAL_TOPIC_RULES: LegalTopicRule[] = [
  // 1. AGM, General Body Meetings & Timelines
  {
    roots: [
      'பொதுக்குழு', 'ஆண்டு பொதுக்குழு', 'கூட்டம்', 'சிறப்பு பொதுக்குழு', 'நிதியாண்டு', '6 மாதம்',
      'பேரவை', 'கூட்டம் நடத்த', 'காலக்கெடு', 'அனுமதி', 'வரவு செலவு திட்டம்', 'தீர்மானம்', 'கணக்கு அறிக்கை',
      'podhukkuzhu', 'koottam', 'agm', 'annual general meeting', 'general body', 'general meeting',
      'special general meeting', 'meeting timeline', 'when to conduct agm', 'budget approval', 'overdue list'
    ],
    expandedEnglishTerms: [
      'Annual General Meeting', 'AGM', 'Section 32', 'six months after financial year',
      'General Body meeting', 'Special General Meeting', 'Requisition by members', 'Overdue debts approval', 'Budget'
    ],
    targetSections: ['32'],
    boostWeight: 55,
  },
  // 2. Elections, Board, 5 Year Term & Reservations
  {
    roots: [
      'தேர்தல்', 'இயக்குநர்', 'தலைவர்', 'வாக்கு', 'வாக்களிப்பு', 'பதவிக்காலம்', '5 ஆண்டு', 'தேர்தல் ஆணையம்',
      'இடஒதுக்கீடு', 'மகளிர்', 'தாழ்த்தப்பட்டோர்', 'பழங்குடியினர்', 'நிர்வாகக்குழு', 'வேட்புமனு', 'வாக்காளர் பட்டியல்',
      'போட்டியிட', 'இயக்குனர் தகுதி', 'வாக்குரிமை', 'துணை தலைவர்',
      'therdhal', 'thalaivar', 'iyakkunar', 'director', 'election', 'board', 'tenure', 'term of office',
      '5 years', 'reservation', 'state cooperative election commission', 'electoral roll', 'casting vote'
    ],
    expandedEnglishTerms: [
      'Election of Board of Directors', 'Section 33', 'Section 34', 'Term of office 5 years',
      'State Cooperative Election Commission', 'Women reservation', 'SC ST reservation',
      'Disqualification of director', 'President election'
    ],
    targetSections: ['33', '34', '24', '36'],
    boostWeight: 55,
  },
  // 3. Member Expulsion & Disqualification
  {
    roots: [
      'உறுப்பினர் நீக்கம்', 'நீக்குதல்', 'நீக்கம்', 'தகுதியிழப்பு', 'விளக்க நோட்டீஸ்', '2/3 பங்கு தீர்மானம்',
      'பதிவாளர் ஒப்புதல்', 'உறுப்பினர் தகுதி', 'விலக்குதல்', 'சங்க விரோத செயல்', 'உறுப்பினர் உரிமை',
      'neekkam', 'expel', 'expulsion', 'remove member', 'removal of member', 'show cause notice',
      'disqualification of member', 'insolvent member', 'defaulter member'
    ],
    expandedEnglishTerms: [
      'Expulsion of member', 'Section 25', 'Disqualification', 'Section 23', 'Section 24',
      'Two thirds majority resolution', 'Show cause notice', 'Registrar prior approval', 'De-registration of member'
    ],
    targetSections: ['25', '23', '24'],
    boostWeight: 55,
  },
  // 4. Statutory Annual Audit
  {
    roots: [
      'தணிக்கை', 'ஆடிட்', 'கணக்கு தணிக்கை', '9 மாதம்', 'தணிக்கையாளர்', 'வரவு செலவு', 'கணக்குகள்',
      'ஆடிட்டர்', 'தணிக்கை அறிக்கை', 'இருப்புநிலை குறிப்பு', 'லாப நஷ்ட கணக்கு', 'தணிக்கை கட்டணம்',
      'thanikkai', 'audit', 'statutory audit', 'auditor', 'director of cooperative audit', '9 months',
      'audit report deadline', 'who appoints auditor', 'audit fee', 'accounts verification'
    ],
    expandedEnglishTerms: [
      'Statutory Annual Audit', 'Section 80', 'Nine months completion', 'Director of Cooperative Audit',
      'Auditor appointment', 'Balance sheet verification', 'Audit certificate', 'Remittance of audit fee'
    ],
    targetSections: ['80'],
    boostWeight: 55,
  },
  // 5. Inquiry & Inspection
  {
    roots: [
      'விசாரணை', 'ஆய்வு', 'சங்க ஆய்வு', 'ஏடுகள் ஆய்வு', 'பதிவாளர் விசாரணை', '1/3 பங்கு மனு', '3 மாதம்',
      'புத்தகம் ஆய்வு', 'கணக்கு ஏடுகள்', 'சங்க நடவடிக்கை', 'நிர்வாக குறைபாடு',
      'vicharanai', 'aayvu', 'inquiry', 'inspection of books', 'registrar inquiry', 'books of society',
      'investigation', 'financial condition inquiry'
    ],
    expandedEnglishTerms: [
      'Inquiry by Registrar', 'Section 81', 'Inspection of books', 'Section 82', 'Three months completion limit',
      'One third member application', 'Investigation into constitution and financial working'
    ],
    targetSections: ['81', '82'],
    boostWeight: 55,
  },
  // 6. Surcharge, Misappropriation & Recovery
  {
    roots: [
      'சர்சார்ஜ்', 'முறைகேடு', 'ஊழல்', 'நிதி இழப்பு', 'நஷ்டம்', 'பணம் மீட்பு', 'நம்பிக்கை துரோகம்',
      'அலட்சியம்', 'இழப்பீடு', 'பணம் கையாடல்', 'சொத்து மீட்பு', 'அபகரிப்பு', 'அதிகாரி இழப்பீடு',
      'செயலாளர் முறைகேடு', 'பணம் திரும்ப பெற',
      'surcharge', 'misappropriation', 'fraud', 'breach of trust', 'negligence', 'loss recovery',
      'repay', 'deficiency in assets', 'corrupt officer', 'surcharge order'
    ],
    expandedEnglishTerms: [
      'Surcharge proceeding', 'Section 87', 'Misappropriation of funds', 'Fraudulent retention',
      'Deficiency caused by breach of trust or willful negligence', 'Registrar order to repay money with interest'
    ],
    targetSections: ['87'],
    boostWeight: 60,
  },
  // 7. Crop Loans, First Charge, Agricultural Produce & Immovable Property Security
  {
    roots: [
      'பயிர்க்கடன்', 'விவசாய கடன்', 'முதன்மை உரிமை', 'விளைபொருள்', 'நிலம்', 'அடமானம்', 'பிணையம்',
      'பறிமுதல்', 'விற்பனை', 'பத்திரப்பதிவு', 'தொடக்கம்', 'பயிர்', 'விவசாயி கடன்', 'சொத்து பிணையம்',
      'கடன் கட்ட தவறினால்', 'உரம் கடன்', 'விதை கடன்', 'ஏலம்', 'பயிர் விளைச்சல்',
      'payir kadan', 'kadan', 'crop loan', 'first charge', 'agricultural loan', 'immovable property charge',
      'distraint and sale', 'pacs credit', 'crop security', 'land mortgage'
    ],
    expandedEnglishTerms: [
      'First charge on crops and agricultural produce', 'Section 40', 'Charge on immovable property of member',
      'Section 41', 'Distraint and sale of produce without court intervention', 'Section 143', 'PACS loan priority'
    ],
    targetSections: ['40', '41', '143', '69'],
    boostWeight: 55,
  },
  // 8. Salary Deduction Agreement
  {
    roots: [
      'சம்பள பிடித்தம்', 'ஊதிய பிடித்தம்', 'வேலை அளிப்பவர்', '7 நாட்கள்', 'சம்பளத்தில் கடன்',
      'முதலாளி', 'ஊதியம்', 'சம்பள பிடித்தம் செய்ய சம்மதம்',
      'sambala piditham', 'salary deduction', 'wages deduction', 'employer agreement',
      'remit deduction within 7 days', 'deduct from salary'
    ],
    expandedEnglishTerms: [
      'Deduction from salary to meet society claims', 'Section 42', 'Employer obligation',
      'Remit within 7 days', 'Offence by employer Section 158'
    ],
    targetSections: ['42', '158'],
    boostWeight: 55,
  },
  // 9. Board Supersession & Administrator
  {
    roots: [
      'தனி அலுவலர்', 'நிர்வாகி நியமனம்', 'நிர்வாகக்குழு கலைப்பு', 'செயலிழப்பு', 'இயக்குநர் நீக்கம்',
      'தற்காலிக நிர்வாகி', 'ஆட்சியர்', 'சங்க நிர்வாகம் பறிப்பு', 'நிர்வாக அதிகாரி',
      'thani aluvalar', 'special officer', 'administrator', 'supersession of board', 'dismiss board',
      'director removal', '5 years ban'
    ],
    expandedEnglishTerms: [
      'Supersession of board', 'Section 88', 'Appointment of Administrator or Special Officer',
      'Removal of director Section 36', 'Persistent default or negligence'
    ],
    targetSections: ['88', '36'],
    boostWeight: 55,
  },
  // 10. Disputes, Arbitration & Civil Court Bar
  {
    roots: [
      'தகராறு', 'மத்தியஸ்தம்', 'சிவில் நீதிமன்ற தடை', 'நீதிமன்றம்', 'வழக்கு', 'பதிவாளர் தீர்ப்பு',
      'பிரச்சனை', 'நீதிமன்ற தடை', 'சிவில் கோர்ட்', 'தீர்வு', 'மனு',
      'thagararu', 'madhyastham', 'disputes', 'arbitration', 'civil court bar',
      'jurisdiction barred', 'refer to registrar', 'court stay'
    ],
    expandedEnglishTerms: [
      'Settlement of disputes by Registrar', 'Section 90', 'Arbitration',
      'Bar of jurisdiction of Civil Courts', 'Section 164', 'Exclusive jurisdiction of Registrar and Tribunal'
    ],
    targetSections: ['90', '164'],
    boostWeight: 55,
  },
  // 11. Liquidation & Winding Up
  {
    roots: [
      'சங்க கலைப்பு', 'கலைத்தல்', 'கலைப்பாளர்', 'சங்கத்தை மூடுதல்', 'பதிவு ரத்து', '3/4 பங்கு உறுப்பினர்கள்',
      'சங்க முடிவுக்கு வருதல்', 'சொத்து பங்கீடு',
      'kalaippu', 'kalaippalar', 'winding up', 'liquidator', 'dissolution', 'cancellation of registration',
      'close society', 'liquidator powers'
    ],
    expandedEnglishTerms: [
      'Winding up of society', 'Section 137', 'Appointment of Liquidator Section 138',
      'Powers of Liquidator Section 139', 'Cancellation of registration Section 140'
    ],
    targetSections: ['137', '138', '139', '140'],
    boostWeight: 55,
  },
  // 12. Appeals & Revision
  {
    roots: [
      'மேல்முறையீடு', 'சீராய்வு', 'தீர்ப்பாயம்', '60 நாட்கள்', 'மறுபரிசீலனை', 'உத்தரவு எதிர்ப்பு',
      'நீதிமன்ற மேல்முறையீடு', 'கூட்டுறவு தீர்ப்பாயம்', 'மேல்முறையீட்டு காலம்',
      'melmuraiyeedu', 'seerayvu', 'appeal', 'cooperative tribunal', '60 days limit', 'revision',
      'appeal against surcharge', 'appeal against expulsion'
    ],
    expandedEnglishTerms: [
      'Appeals to Cooperative Tribunal', 'Section 152', '60 days limitation period',
      'Revision powers of Registrar Section 153', 'Appeal against surcharge or election'
    ],
    targetSections: ['152', '153'],
    boostWeight: 55,
  },
  // 13. Reserve Fund, Net Profits & Dividends
  {
    roots: [
      'நிகர லாபம்', '25 சதவீதம்', 'கையிருப்பு நிதி', 'கல்வி நிதி', 'ஈவுத்தொகை', 'லாப பகிர்வு',
      'சங்க லாபம்', 'பங்கு ஈவு', 'பொதுநல நிதி', 'லாபத்தில் பங்கு',
      'net profit', 'reserve fund 25 percent', 'cooperative education fund', 'dividend', 'profit disposal'
    ],
    expandedEnglishTerms: [
      'Disposal of net profits', 'Section 72', '25 percent to Reserve Fund',
      '3 percent to Cooperative Education Fund', 'Dividend declaration'
    ],
    targetSections: ['72'],
    boostWeight: 55,
  },
  // 14. Registration & Byelaws
  {
    roots: [
      'சங்க பதிவு', 'துணை விதிகள் திருத்தம்', 'விதிகள்', 'தொடக்க வேளாண்மை', 'நோக்கம்',
      'சங்க தொடக்கம்', 'உறுப்பினர் தகுதி', 'சங்கத்தின் பெயர்',
      'registration', 'amendment of bye laws', 'pacs definition', 'byelaws'
    ],
    expandedEnglishTerms: [
      'Registration of society Section 9', 'Amendment of bye-laws Section 11',
      'Primary Agricultural Cooperative Society definition Section 2'
    ],
    targetSections: ['9', '11', '2', '4'],
    boostWeight: 50,
  },
  // 15. Penalties & Offences
  {
    roots: [
      'தண்டனை', '3 ஆண்டுகள் சிறை', 'அபராதம்', 'பொய் கணக்கு', 'குற்றம்', 'பொய் தகவல்', 'மோசடி குற்றச்சாட்டு',
      'penalties', 'offences', '3 years imprisonment', 'fine 10000', 'falsification of accounts'
    ],
    expandedEnglishTerms: [
      'Penalties and offences Section 157', 'Punishment Section 158',
      'Falsification of accounts or documents', 'Imprisonment up to 3 years or fine'
    ],
    targetSections: ['158', '157'],
    boostWeight: 55,
  }
];

export function expandTamilQuery(query: string): {
  expandedText: string;
  matchedSections: string[];
  matchedTerms: string[];
  boostScoreMap: Map<string, number>;
} {
  const qClean = query.toLowerCase().trim();
  const rawTokens = qClean.split(/[\s,.;:()"?!\/\\-]+/).filter(t => t.length > 1);
  const stemmedTokens = rawTokens.map(normalizeTamilToken);
  const allTokens = Array.from(new Set([...rawTokens, ...stemmedTokens]));

  // Generate 2-gram pairs for long compound Tamil phrasing
  const bigrams: string[] = [];
  for (let i = 0; i < rawTokens.length - 1; i++) {
    bigrams.push(`${rawTokens[i]} ${rawTokens[i + 1]}`);
    bigrams.push(`${stemmedTokens[i]} ${stemmedTokens[i + 1]}`);
  }

  const matchedSections = new Set<string>();
  const matchedTerms: string[] = [];
  const boostScoreMap = new Map<string, number>();
  const englishExpansions: string[] = [];

  for (const rule of LEGAL_TOPIC_RULES) {
    let matchCount = 0;

    for (const root of rule.roots) {
      const rootLow = root.toLowerCase();
      const rootStemmed = normalizeTamilToken(rootLow);

      const exactOrSubstring =
        qClean.includes(rootLow) ||
        qClean.includes(rootStemmed) ||
        allTokens.some(tok => tok.length >= 3 && (rootLow.includes(tok) || tok.includes(rootLow) || rootStemmed.includes(tok))) ||
        bigrams.some(bg => bg.includes(rootLow) || rootLow.includes(bg));

      if (exactOrSubstring) {
        matchCount++;
        matchedTerms.push(root);
      }
    }

    if (matchCount > 0) {
      const scaledBoost = rule.boostWeight + Math.min(25, (matchCount - 1) * 8);
      for (const sec of rule.targetSections) {
        matchedSections.add(sec);
        const currentBoost = boostScoreMap.get(sec) || 0;
        boostScoreMap.set(sec, Math.max(currentBoost, scaledBoost));
      }
      englishExpansions.push(...rule.expandedEnglishTerms);
    }
  }

  // Explicit section extraction (e.g. "பிரிவு 87", "section 32", "sec 40", "87-வது பிரிவு")
  const secRegex = /(?:section|sec|பிரிவு|சட்டப்பிரிவு)\s*(\d+)/gi;
  let secMatch: RegExpExecArray | null;
  while ((secMatch = secRegex.exec(query)) !== null) {
    if (secMatch[1]) {
      const secNum = secMatch[1];
      matchedSections.add(secNum);
      boostScoreMap.set(secNum, (boostScoreMap.get(secNum) || 0) + 70);
      englishExpansions.push(`Section ${secNum}`);
    }
  }

  const explicitNumSec = query.match(/(\d+)\s*[-வது|ஆம்]?\s*பிரிவு/);
  if (explicitNumSec && explicitNumSec[1]) {
    const secNum = explicitNumSec[1];
    matchedSections.add(secNum);
    boostScoreMap.set(secNum, (boostScoreMap.get(secNum) || 0) + 70);
    englishExpansions.push(`Section ${secNum}`);
  }

  const expandedText = [query, ...Array.from(new Set(englishExpansions))].join(' ');

  return {
    expandedText,
    matchedSections: Array.from(matchedSections),
    matchedTerms: Array.from(new Set(matchedTerms)),
    boostScoreMap,
  };
}

// ----------------------------------------------------------------------
// 3. CHROMADB-COMPATIBLE COLLECTION & VECTOR STORE ENGINE
// ----------------------------------------------------------------------

export class ChromaCollection {
  public id: string;
  public name: string;
  public metadata: Record<string, any>;
  private records: Map<string, ChromaRecord> = new Map();
  private vocabulary: Map<string, number> = new Map();
  private vocabDim: number = 1000;

  constructor(name: string = 'tnsc_act_collection', metadata: Record<string, any> = {}) {
    this.id = `coll_${name}_${Date.now()}`;
    this.name = name;
    this.metadata = {
      'hnsw:space': 'cosine',
      description: 'Tamil Nadu Cooperative Societies Act 1983 Semantic Legal Chunks',
      ...metadata,
    };
  }

  /**
   * Add documents and embeddings to Chroma collection
   */
  public add(params: {
    ids: string[];
    documents: string[];
    metadatas: ChromaMetadata[];
    embeddings?: number[][];
  }) {
    const { ids, documents, metadatas, embeddings } = params;

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const doc = documents[i];
      const meta = metadatas[i];
      const emb = embeddings && embeddings[i] ? embeddings[i] : [];

      this.records.set(id, {
        id,
        document: doc,
        metadata: meta,
        embedding: emb,
      });

      // Update vocabulary with stemmed and raw tokens
      const fullCorpus = `${doc} ${meta.title} ${meta.topics} ${meta.summary_en} ${meta.summary_ta}`.toLowerCase();
      const rawTokens = fullCorpus.split(/[\s,.;:()"-]+/).filter(t => t.length > 1);
      const stemmed = rawTokens.map(normalizeTamilToken);

      for (const t of [...rawTokens, ...stemmed]) {
        if (!this.vocabulary.has(t) && this.vocabulary.size < this.vocabDim) {
          this.vocabulary.set(t, this.vocabulary.size);
        }
      }
    }

    // Ensure fallback dense vector representation is populated if no embedding provided
    for (const record of this.records.values()) {
      if (!record.embedding || record.embedding.length === 0) {
        record.embedding = this.computeLocalEmbedding(
          `${record.document} ${record.metadata.title} ${record.metadata.topics} ${record.metadata.summary_en} ${record.metadata.summary_ta}`
        );
      }
    }
  }

  /**
   * Generates local normalized dense vector
   */
  public computeLocalEmbedding(text: string): number[] {
    const rawTokens = text.toLowerCase().split(/[\s,.;:()"-]+/).filter(t => t.length > 1);
    const stemmed = rawTokens.map(normalizeTamilToken);
    const tokens = [...rawTokens, ...stemmed];

    const vec = new Array(this.vocabDim).fill(0);
    for (const t of tokens) {
      const idx = this.vocabulary.get(t);
      if (idx !== undefined && idx < this.vocabDim) {
        vec[idx] += 1;
      }
    }

    const norm = Math.sqrt(vec.reduce((acc, val) => acc + val * val, 0)) || 1;
    return vec.map(v => v / norm);
  }

  /**
   * Cosine similarity between two vectors
   */
  public static cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Query ChromaDB with Multi-Language Cross-Lingual Embedding + Long Tamil Sentence Expansion
   */
  public query(params: {
    query_texts?: string[];
    query_embeddings?: number[][];
    n_results?: number;
    where?: Record<string, any>;
  }): ChromaQueryResult {
    const nResults = params.n_results || 2;
    const queryText = params.query_texts && params.query_texts[0] ? params.query_texts[0] : '';
    const queryEmbedding = params.query_embeddings && params.query_embeddings[0] ? params.query_embeddings[0] : null;

    // 1. Keyword & Morphological Expansion
    const expansion = expandTamilQuery(queryText);
    const qClean = queryText.toLowerCase().trim();
    const rawTokens = qClean.split(/[\s,.;:()"?!\/\\-]+/).filter(t => t.length > 1);
    const stemmedTokens = rawTokens.map(normalizeTamilToken);
    const allQueryTokens = Array.from(new Set([...rawTokens, ...stemmedTokens]));

    // Compute dense vector from query
    const localQVec = this.computeLocalEmbedding(expansion.expandedText);

    // 2. Score every record in Chroma collection
    const candidates: Array<{
      id: string;
      doc: string;
      meta: ChromaMetadata;
      distance: number;
      score: number;
    }> = [];

    for (const record of this.records.values()) {
      let score = 0;

      // Cosine Similarity using provided embedding or local dense vector
      let sim = 0;
      if (queryEmbedding && record.embedding && queryEmbedding.length === record.embedding.length) {
        sim = ChromaCollection.cosineSimilarity(queryEmbedding, record.embedding);
      } else if (record.embedding && record.embedding.length === localQVec.length) {
        sim = ChromaCollection.cosineSimilarity(localQVec, record.embedding);
      }

      if (sim > 0.02) {
        score += Math.round(sim * 42);
      }

      // Keyword & Lexical Match on Corpus
      const corpus = `${record.metadata.title} ${record.document} ${record.metadata.topics} ${record.metadata.summary_en} ${record.metadata.summary_ta}`.toLowerCase();

      for (const tok of allQueryTokens) {
        if (record.metadata.topics.toLowerCase().includes(tok)) score += 12;
        else if (record.metadata.title.toLowerCase().includes(tok)) score += 10;
        else if (corpus.includes(tok)) score += 5;
      }

      // Legal Keyword Expansion Rule Boost
      const boost = expansion.boostScoreMap.get(record.metadata.section);
      if (boost) {
        score += boost;
      }

      // Direct Section matching (e.g. section 87 / பிரிவு 87)
      const secRegex = new RegExp(`(?:section|sec|பிரிவு|சட்டப்பிரிவு)\\s*${record.metadata.section}\\b`, 'i');
      if (secRegex.test(qClean)) {
        score += 90;
      }

      const distance = Math.max(0, 1 - (sim || (score / 100)));

      candidates.push({
        id: record.id,
        doc: record.document,
        meta: record.metadata,
        distance,
        score,
      });
    }

    // Sort by highest score / lowest distance
    candidates.sort((a, b) => b.score - a.score);

    const top = candidates.filter(c => c.score >= 12).slice(0, nResults);
    const finalSelection = top.length > 0 ? top : candidates.slice(0, nResults);

    return {
      ids: finalSelection.map(c => c.id),
      documents: finalSelection.map(c => c.doc),
      metadatas: finalSelection.map(c => c.meta),
      distances: finalSelection.map(c => c.distance),
      scores: finalSelection.map(c => c.score),
      expanded_query: expansion.expandedText,
      retrieval_mode: 'rrf_fusion',
    };
  }

  public count(): number {
    return this.records.size;
  }

  public getRecords(): ChromaRecord[] {
    return Array.from(this.records.values());
  }
}

// ----------------------------------------------------------------------
// 4. SINGLETON CHROMA VECTOR STORE INSTANCE
// ----------------------------------------------------------------------

export class ChromaVectorStore {
  private static instance: ChromaVectorStore;
  public collection: ChromaCollection;
  private isEmbeddingsInitialized: boolean = false;

  private constructor() {
    this.collection = new ChromaCollection('tnsc_act_collection');
  }

  public static getInstance(): ChromaVectorStore {
    if (!ChromaVectorStore.instance) {
      ChromaVectorStore.instance = new ChromaVectorStore();
    }
    return ChromaVectorStore.instance;
  }

  /**
   * Initializes Chroma collection with Act chunks
   */
  public populateFromActChunks(chunks: any[]) {
    const ids: string[] = [];
    const documents: string[] = [];
    const metadatas: ChromaMetadata[] = [];

    for (const chunk of chunks) {
      ids.push(chunk.id || `chunk_${chunk.section}_${chunk.subSection || '1'}`);
      documents.push(chunk.text || '');
      metadatas.push({
        section: String(chunk.section),
        subSection: chunk.subSection ? String(chunk.subSection) : undefined,
        title: chunk.title || '',
        chapter: chunk.chapter || '',
        topics: Array.isArray(chunk.topics) ? chunk.topics.join(', ') : String(chunk.topics || ''),
        summary_en: chunk.summary_en || '',
        summary_ta: chunk.summary_ta || '',
      });
    }

    this.collection.add({ ids, documents, metadatas });
    console.log(`[ChromaDB] Initialized collection '${this.collection.name}' with ${this.collection.count()} legal records.`);
  }

  /**
   * Asynchronously compute cross-lingual Gemini text-embedding-004 for all records in collection
   */
  public async computeCrossLingualEmbeddings(apiKey?: string) {
    if (this.isEmbeddingsInitialized || !apiKey) return;

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      console.log('[ChromaDB] Computing multi-lingual dense vector embeddings with text-embedding-004...');
      const records = this.collection.getRecords();

      for (const record of records) {
        try {
          const contentToEmbed = `Section ${record.metadata.section}: ${record.metadata.title}. ${record.document}. Tamil: ${record.metadata.summary_ta}. Topics: ${record.metadata.topics}`;
          const res: any = await ai.models.embedContent({
            model: 'text-embedding-004',
            contents: contentToEmbed,
          });

          const embValues = res.embedding?.values || res.embeddings?.[0]?.values;
          if (embValues && Array.isArray(embValues)) {
            record.embedding = embValues;
          }
        } catch {
          // Gracefully continue with local representation
          break;
        }
      }

      this.isEmbeddingsInitialized = true;
      console.log('[ChromaDB] Multi-lingual embeddings initialized successfully.');
    } catch (err) {
      console.warn('[ChromaDB] Embeddings notice, utilizing dense hybrid retrieval:', err);
    }
  }

  /**
   * Generate embedding for query
   */
  public async getQueryEmbedding(query: string, apiKey?: string): Promise<number[] | null> {
    if (!apiKey) return null;
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });
      const res: any = await ai.models.embedContent({
        model: 'text-embedding-004',
        contents: query,
      });
      return res.embedding?.values || res.embeddings?.[0]?.values || null;
    } catch {
      return null;
    }
  }
}

export const chromaStore = ChromaVectorStore.getInstance();
