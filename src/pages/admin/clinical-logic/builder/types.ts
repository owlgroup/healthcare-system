import type { QuestionnaireQuestion, QuestionnaireSection } from "@/types/questionnaire";

export function newId(): string {
  return crypto.randomUUID();
}

export function blankQuestion(sectionId: string): QuestionnaireQuestion {
  return {
    id: newId(),
    section_id: sectionId,
    type: "SINGLE_CHOICE",
    text: "",
    sort_order: 0,
    options: [
      { id: newId(), label: "", score: 0 },
      { id: newId(), label: "", score: 1 },
    ],
    config: {},
    skip_logic: [],
  };
}

export function blankSection(questionnaireId: string): QuestionnaireSection {
  return {
    id: newId(),
    questionnaire_id: questionnaireId,
    key: "",
    role: "PATIENT",
    title: "",
    sort_order: 0,
    questions: [],
  };
}
