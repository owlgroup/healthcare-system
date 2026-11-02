import { useCallback, useMemo, useState } from "react";
import {
  compareCccdBhytIdentity,
  type CccdBhytCompareInput,
} from "@/lib/cccd-bhyt-cross-validate";

function fingerprint(input: CccdBhytCompareInput): string {
  return `${input.cccdName}\0${input.cccdDob}\0${input.bhytName}\0${input.bhytDob}`;
}

/** Live CCCD↔BHYT compare; confirmation resets when compared values change. */
export function useCccdBhytMismatch(input: CccdBhytCompareInput) {
  const result = useMemo(
    () => compareCccdBhytIdentity(input),
    [input.cccdName, input.cccdDob, input.bhytName, input.bhytDob],
  );
  const key = fingerprint(input);
  const [confirmedFor, setConfirmedFor] = useState<string | null>(null);
  const confirmed = result.hasMismatch && confirmedFor === key;
  const blocksSubmit = result.hasMismatch && !confirmed;

  const confirm = useCallback(() => {
    if (result.hasMismatch) setConfirmedFor(key);
  }, [result.hasMismatch, key]);

  return { result, confirmed, blocksSubmit, confirm };
}
