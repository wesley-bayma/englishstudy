export type ContentType = 
  | 'vocabulary' 
  | 'survival_phrase' 
  | 'phrasal_verb' 
  | 'personal_phrase' 
  | 'personal_vocabulary';

export type ContentSource = 
  | 'base' 
  | 'youtube' 
  | 'podcast' 
  | 'audio' 
  | 'book' 
  | 'movie' 
  | 'series' 
  | 'conversation' 
  | 'other';

export type AnkiStatus = 'not_created' | 'created';

export interface ContentItem {
  id: string;
  content: string;
  normalized_content: string;
  type: ContentType;
  source: ContentSource;
  source_detail: string | null;
  source_url: string | null;
  timestamp_marker: string | null;
  original_order: number | null;
  anki_status: AnkiStatus;
  anki_created_at: string | null;
  date_added: string;
  times_encountered: number;
  last_encountered: string | null;
  meaning_pt: string | null;
  example: string | null;
  base_form: string | null;
  notes: string | null;
}

export interface Encounter {
  id: string;
  content_id: string;
  source: ContentSource;
  source_detail: string | null;
  source_url: string | null;
  timestamp_marker: string | null;
  context_sentence: string | null;
  notes: string | null;
  created_at: string;
}

export interface DailyQueueItem {
  content_id: string;
  type: ContentType;
  status: 'pending' | 'created' | 'skipped';
}

export interface DailyQueue {
  id: string;
  date: string; // YYYY-MM-DD
  items: DailyQueueItem[];
  completed_count: number;
  target_count: number;
}

export interface GeminiAnalysisResult {
  classification: ContentType;
  base_form: string | null;
  has_possible_match: boolean;
  matched_existing_content: string | null;
  similarity_type: 'exact' | 'inflection' | 'semantic_similarity' | 'synonym' | 'none';
  confidence: number;
  meaning_pt: string;
  explanation: string;
  suggested_example: string;
}

export interface CardReviewResult {
  status: 'good' | 'improvable' | 'bad';
  status_label: '✅ Bom' | '⚠️ Pode melhorar' | '❌ Problema importante';
  score: number;
  observations: string[]; // max 3 bullet points
  summary: string;
}

export interface AppSettings {
  gemini_api_key: string;
  daily_vocab_goal: number;
  daily_phrase_goal: number;
  daily_phrasal_goal: number;
}

export interface VerificationResult {
  exact_match: ContentItem | null;
  heuristic_match: ContentItem | null;
  ai_match: GeminiAnalysisResult | null;
  is_duplicate: boolean;
  match_type: 'exact' | 'inflection' | 'semantic' | 'none';
  message: string;
}
