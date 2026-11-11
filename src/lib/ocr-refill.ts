export type OcrSlot = "front" | "back" | "bhyt";

/** Which upload slot's OCR filled each form field. */
export type OcrFills = Partial<Record<string, { slot: OcrSlot }>>;

type StringForm = Record<string, string>;

/**
 * Clear every field a slot's previous OCR filled — including ones the user
 * edited afterwards — so a re-scan (e.g. after the image was replaced) can fill
 * them again. Re-running OCR is an explicit request to take the scan's values.
 */
function clearSlotFills<T extends StringForm>(form: T, fills: OcrFills, slot: OcrSlot) {
  const nextForm: StringForm = { ...form };
  const nextFills: OcrFills = {};
  for (const [field, fill] of Object.entries(fills)) {
    if (!fill) continue;
    if (fill.slot === slot) {
      nextForm[field] = "";
    } else {
      nextFills[field] = fill;
    }
  }
  return { form: nextForm as T, fills: nextFills };
}

function recordSlotFills<T extends StringForm>(before: T, after: T, fills: OcrFills, slot: OcrSlot) {
  const nextFills: OcrFills = { ...fills };
  for (const field of Object.keys(after)) {
    if (after[field] !== before[field]) nextFills[field] = { slot };
  }
  return nextFills;
}

/**
 * Apply a slot's OCR result. Fields the slot's earlier OCR filled are replaced
 * (even if edited since), while values typed into never-OCR'd fields and other
 * slots' values stay (fill-empty merge still
 * guards front fields from back-side misreads).
 */
export function applyOcrForSlot<T extends StringForm>(
  form: T,
  fills: OcrFills,
  slot: OcrSlot,
  applyParsed: (form: T) => T,
): { form: T; fills: OcrFills } {
  const cleared = clearSlotFills(form, fills, slot);
  const next = applyParsed(cleared.form);
  return { form: next, fills: recordSlotFills(cleared.form, next, cleared.fills, slot) };
}
