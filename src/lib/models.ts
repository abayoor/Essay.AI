export type Locale = 'ru' | 'kz' | 'en';

export type EssayStatus = 'draft' | 'in_review' | 'final' | 'submitted';

export type EssayType = 'personal_statement' | 'supplemental' | 'scholarship' | 'grant';

export type EssaySummary = {
  id: string;
  title: string;
  target_school: string | null;
  essay_type: EssayType;
  status: EssayStatus;
  updated_at: string;
};

export type EssayVersion = {
  id: string;
  content: string;
  word_count: number;
  created_at: string;
  embedding?: string | null;
};

export type EssayDetail = EssaySummary & {
  prompt_id: string | null;
  current_version_id: string | null;
  versions: EssayVersion[];
};

export type CoachComment = {
  quote: string;
  note: string;
};

export type CoachingFeedback = {
  hook_feedback: string;
  structure_feedback: string;
  cliche_flags: string[];
  show_dont_tell_ratio: string;
  voice_notes: string;
  word_count_status: 'under' | 'within' | 'over';
  ghostwriting_request?: boolean;
  margin_comments?: CoachComment[];
};

export type PersonaFeedback = {
  strict_formalist: string;
  empathetic_reader: string;
  pragmatic_reviewer: string;
};

export type OverlapCheckResult = {
  essayId: string;
  title: string;
  similarity: number;
  verdict: 'warning' | 'okay';
  explanation: string;
  recommendation: string;
};

export type InterviewAnswer = {
  question: string;
  answer: string;
};

export type InterviewQuestion = {
  question: string;
  category: string;
};

export type InterviewFeedback = {
  question: string;
  consistency_note: string;
};

export type InterviewSession = {
  id: string;
  questions: InterviewQuestion[];
};
