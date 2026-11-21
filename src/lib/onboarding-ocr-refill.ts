import { mergeOcrFillEmpty } from "@/lib/cccd-ocr";
import { applyOcrForSlot, type OcrFills, type OcrSlot } from "@/lib/ocr-refill";
import type { OnboardingFormData } from "@/hooks/useOnboardingForm";

const OCR_SECTIONS = ["personal", "identity", "insurance"] as const;
type OcrSection = (typeof OCR_SECTIONS)[number];

export type OnboardingOcrUpdates = {
  [S in OcrSection]?: Partial<OnboardingFormData[S]>;
};

type FlatForm = Record<string, string>;

const SEPARATOR = ".";

function flattenSections(sections: OnboardingOcrUpdates): FlatForm {
  return OCR_SECTIONS.reduce<FlatForm>((flat, section) => {
    for (const [field, value] of Object.entries(sections[section] ?? {})) {
      if (typeof value === "string") flat[`${section}${SEPARATOR}${field}`] = value;
    }
    return flat;
  }, {});
}

function unflattenInto(data: OnboardingFormData, flat: FlatForm): OnboardingFormData {
  const next: OnboardingFormData = {
    ...data,
    personal: { ...data.personal },
    identity: { ...data.identity },
    insurance: { ...data.insurance },
  };
  for (const [key, value] of Object.entries(flat)) {
    const [section, field] = key.split(SEPARATOR) as [OcrSection, string];
    (next[section] as Record<string, string>)[field] = value;
  }
  return next;
}

/**
 * Apply one upload slot's OCR result to the onboarding form. Same semantics as
 * the doctor's "add patient" dialog: re-running OCR on a slot overwrites what
 * that slot filled before (even if edited since), while values typed into
 * never-OCR'd fields and fields filled by other slots stay.
 */
export function applyOnboardingOcr(
  data: OnboardingFormData,
  fills: OcrFills,
  slot: OcrSlot,
  updates: OnboardingOcrUpdates,
): { data: OnboardingFormData; fills: OcrFills } {
  const flatUpdates = flattenSections(updates);
  const result = applyOcrForSlot(flattenSections(data), fills, slot, (form) =>
    mergeOcrFillEmpty(form, flatUpdates),
  );
  return { data: unflattenInto(data, result.form), fills: result.fills };
}
