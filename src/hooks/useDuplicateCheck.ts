import { useCallback, useState } from "react";
import { supabase } from "@/lib/supabase";
import { checkPatientDuplicate, logDedupAudit } from "@/lib/duplicate-check";

export type DupState = {
  cccdMatchId: string | null;
  phoneMatchId: string | null;
  nameDobMatchId: string | null;
};

export type BypassState = { phone: boolean; nameDob: boolean };

const emptyDup: DupState = { cccdMatchId: null, phoneMatchId: null, nameDobMatchId: null };
const emptyBypass: BypassState = { phone: false, nameDob: false };

export function useDuplicateCheck(
  userId: string | undefined,
  context: "onboarding" | "edit",
) {
  const [dupState, setDupState] = useState<DupState>(emptyDup);
  const [bypassed, setBypassed] = useState<BypassState>(emptyBypass);
  const [checking, setChecking] = useState(false);

  /** Check a single CCCD field (hard block). */
  const checkCccd = useCallback(
    async (value: string) => {
      if (!value.trim() || !userId) return;
      setChecking(true);
      try {
        const res = await checkPatientDuplicate(supabase, { cccd: value, excludeUserId: userId });
        setDupState((prev) => ({ ...prev, cccdMatchId: res.cccdMatchId }));
        void logDedupAudit(supabase, {
          checkerUserId: userId,
          checkType: "cccd",
          normalizedValue: value.trim(),
          matchedPatientId: res.cccdMatchId,
          result: res.cccdMatchId ? "blocked" : "no_match",
          context,
        });
      } catch {
        // non-fatal: don't block the form on network error
      } finally {
        setChecking(false);
      }
    },
    [userId, context],
  );

  /** Check a single phone field (warning). */
  const checkPhone = useCallback(
    async (value: string) => {
      if (!value.trim() || !userId) return;
      setChecking(true);
      try {
        const res = await checkPatientDuplicate(supabase, { phone: value, excludeUserId: userId });
        setDupState((prev) => ({ ...prev, phoneMatchId: res.phoneMatchId }));
        if (res.phoneMatchId) setBypassed((prev) => ({ ...prev, phone: false }));
        void logDedupAudit(supabase, {
          checkerUserId: userId,
          checkType: "phone",
          normalizedValue: value.trim(),
          matchedPatientId: res.phoneMatchId,
          result: res.phoneMatchId ? "warned" : "no_match",
          context,
        });
      } catch {
        // non-fatal
      } finally {
        setChecking(false);
      }
    },
    [userId, context],
  );

  /** Check name + DOB (warning). Pass full name and ISO date string. */
  const checkNameDob = useCallback(
    async (name: string, dob: string) => {
      if (!name.trim() || !dob || !userId) return;
      setChecking(true);
      try {
        const res = await checkPatientDuplicate(supabase, { name, dob, excludeUserId: userId });
        setDupState((prev) => ({ ...prev, nameDobMatchId: res.nameDobMatchId }));
        if (res.nameDobMatchId) setBypassed((prev) => ({ ...prev, nameDob: false }));
        void logDedupAudit(supabase, {
          checkerUserId: userId,
          checkType: "name_dob",
          normalizedValue: `${name.trim()}|${dob}`,
          matchedPatientId: res.nameDobMatchId,
          result: res.nameDobMatchId ? "warned" : "no_match",
          context,
        });
      } catch {
        // non-fatal
      } finally {
        setChecking(false);
      }
    },
    [userId, context],
  );

  /** Run all three checks at once (final pre-submit validation). */
  const checkAll = useCallback(
    async (params: { cccd?: string; phone?: string; name?: string; dob?: string }) => {
      if (!userId) return emptyDup;
      setChecking(true);
      try {
        const res = await checkPatientDuplicate(supabase, { ...params, excludeUserId: userId });
        setDupState(res);
        if (res.cccdMatchId)
          void logDedupAudit(supabase, { checkerUserId: userId, checkType: "cccd", normalizedValue: params.cccd ?? "", matchedPatientId: res.cccdMatchId, result: "blocked", context });
        if (res.phoneMatchId)
          void logDedupAudit(supabase, { checkerUserId: userId, checkType: "phone", normalizedValue: params.phone ?? "", matchedPatientId: res.phoneMatchId, result: "warned", context });
        if (res.nameDobMatchId)
          void logDedupAudit(supabase, { checkerUserId: userId, checkType: "name_dob", normalizedValue: `${params.name ?? ""}|${params.dob ?? ""}`, matchedPatientId: res.nameDobMatchId, result: "warned", context });
        return res;
      } catch {
        return emptyDup;
      } finally {
        setChecking(false);
      }
    },
    [userId, context],
  );

  const bypassPhone = useCallback(() => {
    setBypassed((prev) => ({ ...prev, phone: true }));
    if (userId && dupState.phoneMatchId) {
      void logDedupAudit(supabase, { checkerUserId: userId, checkType: "phone", normalizedValue: "bypass", matchedPatientId: dupState.phoneMatchId, result: "bypassed", context });
    }
  }, [userId, dupState.phoneMatchId, context]);

  const bypassNameDob = useCallback(() => {
    setBypassed((prev) => ({ ...prev, nameDob: true }));
    if (userId && dupState.nameDobMatchId) {
      void logDedupAudit(supabase, { checkerUserId: userId, checkType: "name_dob", normalizedValue: "bypass", matchedPatientId: dupState.nameDobMatchId, result: "bypassed", context });
    }
  }, [userId, dupState.nameDobMatchId, context]);

  const reset = useCallback(() => {
    setDupState(emptyDup);
    setBypassed(emptyBypass);
  }, []);

  const isBlocked = Boolean(dupState.cccdMatchId);
  const hasUnbypassedWarning =
    (Boolean(dupState.phoneMatchId) && !bypassed.phone) ||
    (Boolean(dupState.nameDobMatchId) && !bypassed.nameDob);

  return {
    dupState,
    bypassed,
    checking,
    isBlocked,
    hasUnbypassedWarning,
    checkCccd,
    checkPhone,
    checkNameDob,
    checkAll,
    bypassPhone,
    bypassNameDob,
    reset,
  };
}
