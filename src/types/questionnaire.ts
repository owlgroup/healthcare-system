export type QuestionnaireStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type SectionRole = 'PATIENT' | 'NURSE' | 'DOCTOR';
export type QuestionType =
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'TEXT'
  | 'NUMBER'
  | 'SCALE'
  | 'GRID_MATRIX';

export type QuestionOption = {
  id: string;
  label: string;
  score: number | null;
};

export type SkipLogicRule = {
  if_option_id: string;
  action: 'GOTO_QUESTION' | 'SKIP_SECTION';
  target_id: string;
};

export type QuestionnaireQuestion = {
  id: string;
  section_id: string;
  type: QuestionType;
  text: string;
  sort_order: number;
  options: QuestionOption[];
  config: Record<string, unknown>;
  skip_logic: SkipLogicRule[];
};

export type QuestionnaireSection = {
  id: string;
  questionnaire_id: string;
  key: string;
  role: SectionRole;
  title: string;
  sort_order: number;
  questions: QuestionnaireQuestion[];
};

export type InterventionRule = {
  condition: string;
  label: string;
  action: string;
};

export type ScoringConfig = {
  formula: string;
  result_type?: string;
  min?: number;
  max?: number;
};

export type Questionnaire = {
  id: string;
  name: string;
  category_id: string | null;
  category_name?: string;
  description: string | null;
  status: QuestionnaireStatus;
  version: number;
  parent_id: string | null;
  intervention_matrix: InterventionRule[];
  scoring_config: ScoringConfig;
  created_at: string;
  updated_at: string;
};

export type QuestionnaireWithSections = Questionnaire & {
  sections: QuestionnaireSection[];
};

export const STATUS_LABELS: Record<QuestionnaireStatus, string> = {
  DRAFT: 'Bản nháp',
  ACTIVE: 'Đã xuất bản',
  ARCHIVED: 'Lưu trữ',
};

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  SINGLE_CHOICE: 'Một lựa chọn',
  MULTIPLE_CHOICE: 'Nhiều lựa chọn',
  TEXT: 'Văn bản',
  NUMBER: 'Số',
  SCALE: 'Thang đo',
  GRID_MATRIX: 'Bảng ma trận',
};

export const SECTION_ROLE_LABELS: Record<SectionRole, string> = {
  PATIENT: 'Bệnh nhân',
  NURSE: 'Điều dưỡng',
  DOCTOR: 'Bác sĩ',
};
