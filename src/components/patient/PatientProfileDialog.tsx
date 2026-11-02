import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { hasPatientRecord, useMyPatientProfile } from "@/hooks/useMyPatientProfile";
import {
  AlertTriangle,
  Eye,
  FileText,
  FileUser,
  Loader2,
  Pencil,
  ScanSearch,
  UploadCloud,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useDuplicateCheck } from "@/hooks/useDuplicateCheck";
import {
  fetchOcrSingle,
  mapBhytParsedToInsuranceUpdates,
  mapCccdParsedToFormUpdates,
  type BhytParsed,
  type CccdParsed,
} from "@/lib/cccd-ocr";
import { validateCccdRequired } from "@/lib/cccd-required";
import { encryptRow, sanitizeSensitiveInput } from "@/lib/crypto";
import { supabase } from "@/lib/supabase";
import { type PatientPortalDetail } from "@/types/patient-portal";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import DocImageLightbox from "@/components/onboarding/DocImageLightbox";

type PatientProfileDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type EditData = {
  legalFirstName: string;
  legalLastName: string;
  dateOfBirth: string;
  phoneNumber: string;
  email: string;
  pronouns: string;
  idNumber: string;
  idIssuer: string;
  idIssuedDate: string;
  idExpirationDate: string;
  residentialAddress: string;
  insuranceProvider: string;
  memberId: string;
  groupNumber: string;
};

type EditFiles = {
  idFile: File | null;
  idBackFile: File | null;
  cardFile: File | null;
};

const emptyEditFiles: EditFiles = { idFile: null, idBackFile: null, cardFile: null };

type OcrSlot = "all" | "front" | "back" | "bhyt";

async function fileFromUrl(url: string, name: string): Promise<File> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Không tải được ảnh để OCR");
  const blob = await res.blob();
  return new File([blob], name, { type: blob.type || "image/jpeg" });
}

async function resolveOcrFile(
  newFile: File | null,
  url: string | null,
  fallbackName: string,
): Promise<File> {
  if (newFile) return newFile;
  if (!url) throw new Error("Chưa có ảnh để OCR");
  return fileFromUrl(url, fallbackName);
}

function overwriteIfPresent(current: string, incoming: string | undefined): string {
  const trimmed = incoming?.trim();
  return trimmed ? trimmed : current;
}

function applyCccdOcrOverwrite(edit: EditData, parsed: CccdParsed): EditData {
  const { identity, personal, gender } = mapCccdParsedToFormUpdates(parsed);
  return {
    ...edit,
    legalFirstName: overwriteIfPresent(edit.legalFirstName, personal.legalFirstName),
    legalLastName: overwriteIfPresent(edit.legalLastName, personal.legalLastName),
    dateOfBirth: overwriteIfPresent(edit.dateOfBirth, personal.dateOfBirth),
    idNumber: overwriteIfPresent(edit.idNumber, identity.idNumber),
    idIssuer: overwriteIfPresent(edit.idIssuer, identity.issuer),
    idIssuedDate: overwriteIfPresent(edit.idIssuedDate, identity.issuedDate),
    idExpirationDate: overwriteIfPresent(edit.idExpirationDate, identity.expirationDate),
    residentialAddress: overwriteIfPresent(edit.residentialAddress, identity.residentialAddress),
    pronouns: overwriteIfPresent(edit.pronouns, gender),
  };
}

function applyBhytOcrOverwrite(edit: EditData, parsed: BhytParsed): EditData {
  const updates = mapBhytParsedToInsuranceUpdates(parsed);
  return {
    ...edit,
    insuranceProvider: overwriteIfPresent(edit.insuranceProvider, updates.provider),
    memberId: overwriteIfPresent(edit.memberId, updates.memberId),
  };
}

function sanitizeStorageSegment(fileName: string): string {
  const ascii = fileName.trim().replace(/[^\w.\-]+/g, "_");
  return ascii.slice(0, 120) || "file";
}

function forEdit(value: string | null | undefined): string {
  return sanitizeSensitiveInput(value);
}

function profileToEditData(p: PatientPortalDetail): EditData {
  return {
    legalFirstName: p.legal_first_name ?? "",
    legalLastName: p.legal_last_name ?? "",
    dateOfBirth: p.date_of_birth ?? "",
    phoneNumber: forEdit(p.phone_number),
    email: p.email_address ?? "",
    pronouns: p.preferred_pronouns ?? "",
    idNumber: forEdit(p.id_number),
    idIssuer: p.id_issuer ?? "",
    idIssuedDate: p.id_issued_date ?? "",
    idExpirationDate: p.id_expiration_date ?? "",
    residentialAddress: forEdit(p.residential_address),
    insuranceProvider: p.insurance_provider ?? "",
    memberId: forEdit(p.member_id),
    groupNumber: p.group_number ?? "",
  };
}

function formatDob(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("vi-VN");
}

function readOnboardingDraft(): Partial<PatientPortalDetail> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("qcare_onboarding_draft");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      personal?: {
        legalFirstName?: string;
        legalLastName?: string;
        dateOfBirth?: string;
        phoneNumber?: string;
        email?: string;
        pronouns?: string;
      };
      identity?: {
        idNumber?: string;
        expirationDate?: string;
        residentialAddress?: string;
        issuedDate?: string;
        issuer?: string;
      };
      insurance?: {
        provider?: string;
        memberId?: string;
        groupNumber?: string;
      };
    };
    const p = parsed.personal;
    const i = parsed.identity;
    const ins = parsed.insurance;
    const first = p?.legalFirstName ?? "";
    const last = p?.legalLastName ?? "";
    return {
      id: "",
      user_id: "",
      legal_first_name: first || null,
      legal_last_name: last || null,
      full_name: [first, last].filter(Boolean).join(" ") || "Bệnh nhân",
      date_of_birth: p?.dateOfBirth ?? null,
      preferred_pronouns: p?.pronouns ?? null,
      email_address: p?.email ?? null,
      phone_number: p?.phoneNumber ?? null,
      id_number: i?.idNumber ?? null,
      residential_address: i?.residentialAddress ?? null,
      id_expiration_date: i?.expirationDate ?? null,
      id_issued_date: i?.issuedDate ?? null,
      id_issuer: i?.issuer ?? null,
      insurance_provider: ins?.provider ?? null,
      member_id: ins?.memberId ?? null,
      group_number: ins?.groupNumber ?? null,
      submitted_at: null,
      consent_accepted: false,
    };
  } catch {
    return null;
  }
}

function Field({ label, value }: { label: string; value: string }) {
  const displayValue = sanitizeSensitiveInput(value) || "—";
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{displayValue}</p>
    </div>
  );
}

function EditField({
  id,
  label,
  value,
  onChange,
  onBlur,
  type = "text",
  highlight,
  multiline,
  required,
  error,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  type?: string;
  highlight?: "error" | "warn";
  multiline?: boolean;
  required?: boolean;
  error?: string;
}) {
  const borderClass =
    error || highlight === "error"
      ? "border-destructive/60 bg-destructive/5"
      : highlight === "warn"
        ? "border-warning/60 bg-warning/5"
        : "border-primary/40 bg-primary/5";
  const fieldClass = "mt-0.5 w-full bg-transparent text-sm font-medium text-foreground outline-none";
  return (
    <div className={`rounded-lg border px-3 py-2 ${borderClass}`}>
      <label htmlFor={id} className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}{required ? <span className="ml-0.5 text-destructive" aria-hidden="true">*</span> : null}
      </label>
      {multiline ? (
        <textarea
          id={id}
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className={`${fieldClass} py-1 overflow-y-auto resize-none`}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className={fieldClass}
        />
      )}
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function DocPreview({
  url, label, storagePath, onPreview,
}: {
  url: string; label: string; storagePath: string | null;
  onPreview?: (url: string, label: string) => void;
}) {
  const isPdf = (storagePath ?? "").toLowerCase().endsWith(".pdf");
  return (
    <div className="overflow-hidden rounded-lg border">
      <p className="bg-muted/30 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="relative">
        {isPdf ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-32 items-center justify-center gap-2 bg-muted/20 text-sm font-medium text-primary hover:underline"
          >
            <FileText className="h-5 w-5" />
            Xem PDF
          </a>
        ) : (
          <img src={url} alt={label} className="h-32 w-full object-cover" />
        )}
        {!isPdf ? (
          <button
            type="button"
            onClick={() => onPreview?.(url, label)}
            aria-label={`Xem ảnh ${label}`}
            className="absolute bottom-2 left-2 z-10 flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-foreground shadow hover:bg-white"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function EditableDocPreview({
  inputId,
  label,
  existingUrl,
  existingPath,
  newFile,
  onFileSelect,
  onOcr,
  ocrLoading,
  ocrDisabled,
  onPreview,
}: {
  inputId: string;
  label: string;
  existingUrl: string | null;
  existingPath: string | null;
  newFile: File | null;
  onFileSelect: (f: File | null) => void;
  onOcr?: () => void;
  ocrLoading?: boolean;
  ocrDisabled?: boolean;
  onPreview?: (url: string, label: string) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    if (!newFile || !newFile.type.startsWith("image/")) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(newFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [newFile]);

  const showExistingPdf =
    !newFile && existingUrl && (existingPath ?? "").toLowerCase().endsWith(".pdf");
  const showNewPdf = newFile && !newFile.type.startsWith("image/");
  const displayImageUrl = previewUrl || (!newFile ? existingUrl : null);
  const hasImage = Boolean(newFile || existingUrl);
  const canPreviewImage = Boolean(displayImageUrl) && !showExistingPdf && !showNewPdf;

  return (
    <div className="overflow-hidden rounded-lg border border-primary/30">
      <div className="flex items-center justify-between bg-primary/5 px-2 py-1.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {onOcr && hasImage ? (
          <button
            type="button"
            onClick={onOcr}
            disabled={ocrLoading || ocrDisabled}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
          >
            {ocrLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            ) : (
              <ScanSearch className="h-3 w-3" aria-hidden="true" />
            )}
            {ocrLoading ? "OCR…" : "OCR lại"}
          </button>
        ) : null}
      </div>

      <div className="relative">
        {showExistingPdf || showNewPdf ? (
          <div className="flex h-32 items-center justify-center gap-2 bg-muted/20 text-sm text-muted-foreground">
            <FileText className="h-6 w-6" />
            {newFile ? newFile.name : "PDF"}
          </div>
        ) : displayImageUrl ? (
          <img
            src={displayImageUrl}
            alt={label}
            className="h-32 w-full object-cover"
          />
        ) : (
          <div className="flex h-32 flex-col items-center justify-center gap-1 bg-muted/20 text-muted-foreground">
            <UploadCloud className="h-6 w-6" />
            <span className="text-xs">Chưa có ảnh</span>
          </div>
        )}

        {canPreviewImage ? (
          <button
            type="button"
            onClick={() => onPreview?.(displayImageUrl!, label)}
            aria-label={`Xem ảnh ${label}`}
            className="absolute bottom-2 left-2 z-10 flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-foreground shadow hover:bg-white"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}

        <label
          htmlFor={inputId}
          className="absolute bottom-2 right-2 z-10 flex cursor-pointer items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-[10px] font-semibold text-foreground shadow hover:bg-white"
        >
          <UploadCloud className="h-3 w-3" />
          Thay ảnh
        </label>
        <input
          id={inputId}
          type="file"
          accept=".png,.jpg,.jpeg,.pdf"
          className="sr-only"
          onChange={(e) => onFileSelect(e.target.files?.[0] ?? null)}
        />
      </div>

      {newFile ? (
        <p className="truncate bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">
          ✓ {newFile.name}
        </p>
      ) : null}
    </div>
  );
}

const PatientProfileDialog = ({ open, onOpenChange }: PatientProfileDialogProps) => {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const sessionEmail = session?.user?.email ?? "";
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editData, setEditData] = useState<EditData | null>(null);
  const [editFiles, setEditFiles] = useState<EditFiles>(emptyEditFiles);
  const [ocrSlot, setOcrSlot] = useState<OcrSlot | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  const {
    dupState, bypassed,
    isBlocked: dupIsBlocked, hasUnbypassedWarning,
    checkCccd, checkPhone, checkNameDob, checkAll,
    bypassPhone, bypassNameDob, reset: resetDup,
  } = useDuplicateCheck(userId, "edit");

  const { data, isLoading: profileLoading, isError: profileError } = useMyPatientProfile();

  const idPath = data?.id_document_storage_path ?? null;
  const idBackPath = data?.id_document_back_storage_path ?? null;
  const cardPath = data?.card_front_storage_path ?? null;

  const { data: imageUrls } = useQuery({
    queryKey: ["patient", "my-profile-images", userId, idPath, idBackPath, cardPath],
    queryFn: async () => {
      const [idResult, idBackResult, cardResult] = await Promise.all([
        idPath ? supabase.storage.from("identity-documents").createSignedUrl(idPath, 3600) : null,
        idBackPath ? supabase.storage.from("identity-documents").createSignedUrl(idBackPath, 3600) : null,
        cardPath ? supabase.storage.from("insurance-cards").createSignedUrl(cardPath, 3600) : null,
      ]);

      return {
        idImageUrl: idResult?.data?.signedUrl ?? null,
        idBackImageUrl: idBackResult?.data?.signedUrl ?? null,
        cardImageUrl: cardResult?.data?.signedUrl ?? null,
      };
    },
    enabled: open && Boolean(userId) && hasPatientRecord(data),
  });

  const idImageUrl = imageUrls?.idImageUrl ?? null;
  const idBackImageUrl = imageUrls?.idBackImageUrl ?? null;
  const cardImageUrl = imageUrls?.cardImageUrl ?? null;
  const isLoading = profileLoading && data === undefined;
  const isError = profileError;

  const draftFallback = useMemo(() => readOnboardingDraft(), [open]);

  const profile: PatientPortalDetail | null = useMemo(() => {
    if (data) return data;
    if (draftFallback) {
      return {
        ...draftFallback,
        email_address: draftFallback.email_address || sessionEmail,
      } as PatientPortalDetail;
    }
    if (sessionEmail) {
      return {
        id: "",
        user_id: userId ?? "",
        legal_first_name: null,
        legal_last_name: null,
        full_name: sessionEmail.split("@")[0] ?? "Bệnh nhân",
        date_of_birth: null,
        preferred_pronouns: null,
        email_address: sessionEmail,
        phone_number: null,
        id_number: null,
        residential_address: null,
        id_expiration_date: null,
        id_issued_date: null,
        id_issuer: null,
        insurance_provider: null,
        member_id: null,
        group_number: null,
        submitted_at: null,
        consent_accepted: false,
        status: "DRAFT",
      };
    }
    return null;
  }, [data, draftFallback, sessionEmail, userId]);

  const displayId =
    profile?.id_number?.trim() ||
    (profile?.id ? `QC-${profile.id.slice(0, 8).toUpperCase()}` : "—");

  const set = (field: keyof EditData) => (value: string) =>
    setEditData((prev) => (prev ? { ...prev, [field]: value } : prev));

  const handleStartEdit = () => {
    if (!data) return;
    setEditData(profileToEditData(data));
    setEditFiles(emptyEditFiles);
    setOcrSlot(null);
    setErrors({});
    setLightbox(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditData(null);
    setEditFiles(emptyEditFiles);
    setOcrSlot(null);
    setErrors({});
    setLightbox(null);
    resetDup();
  };

  const runSlotOcr = async (slot: "front" | "back" | "bhyt"): Promise<boolean> => {
    const file =
      slot === "front"
        ? await resolveOcrFile(editFiles.idFile, idImageUrl, "cccd-front.jpg")
        : slot === "back"
          ? await resolveOcrFile(editFiles.idBackFile, idBackImageUrl, "cccd-back.jpg")
          : await resolveOcrFile(editFiles.cardFile, cardImageUrl, "bhyt.jpg");

    if (slot === "bhyt") {
      const json = await fetchOcrSingle(file, "bhyt", "front");
      if (!json.parsed || typeof json.parsed !== "object") {
        throw new Error("OCR không trả về dữ liệu.");
      }
      setEditData((prev) => (prev ? applyBhytOcrOverwrite(prev, json.parsed as BhytParsed) : prev));
      return true;
    }

    const json = await fetchOcrSingle(file, "cccd", "front");
    if (!json.parsed || typeof json.parsed !== "object") {
      throw new Error("OCR không trả về dữ liệu.");
    }
    setEditData((prev) => (prev ? applyCccdOcrOverwrite(prev, json.parsed as CccdParsed) : prev));
    return true;
  };

  const handleOcrSlot = async (slot: "front" | "back" | "bhyt") => {
    if (!editData || ocrSlot) return;
    const hasSource =
      slot === "front"
        ? Boolean(editFiles.idFile || idImageUrl)
        : slot === "back"
          ? Boolean(editFiles.idBackFile || idBackImageUrl)
          : Boolean(editFiles.cardFile || cardImageUrl);
    if (!hasSource) {
      toast.info("Chưa có ảnh để OCR");
      return;
    }

    setOcrSlot(slot);
    try {
      await runSlotOcr(slot);
      const label =
        slot === "front" ? "CCCD mặt trước" : slot === "back" ? "CCCD mặt sau" : "BHYT";
      toast.success(`OCR lại ${label} hoàn tất`);
    } catch (e) {
      toast.error("OCR thất bại", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setOcrSlot(null);
    }
  };

  const handleOcrAll = async () => {
    if (!editData || ocrSlot) return;

    const slots = (
      [
        editFiles.idFile || idImageUrl ? "front" : null,
        editFiles.idBackFile || idBackImageUrl ? "back" : null,
        editFiles.cardFile || cardImageUrl ? "bhyt" : null,
      ] as const
    ).filter((s): s is "front" | "back" | "bhyt" => s != null);

    if (slots.length === 0) {
      toast.info("Chưa có ảnh giấy tờ để OCR");
      return;
    }

    setOcrSlot("all");
    let ok = 0;
    const errors: string[] = [];
    for (const slot of slots) {
      try {
        await runSlotOcr(slot);
        ok += 1;
      } catch (e) {
        const label =
          slot === "front" ? "mặt trước" : slot === "back" ? "mặt sau" : "BHYT";
        errors.push(`${label}: ${e instanceof Error ? e.message : "lỗi"}`);
      }
    }
    setOcrSlot(null);

    if (ok === slots.length) {
      toast.success(`OCR lại tất cả hoàn tất (${ok}/${slots.length})`);
    } else if (ok > 0) {
      toast.warning(`OCR một phần (${ok}/${slots.length})`, {
        description: errors.join("; "),
      });
    } else {
      toast.error("OCR lại tất cả thất bại", {
        description: errors.join("; "),
      });
    }
  };

  const handleSave = async () => {
    if (!userId || !editData) return;

    const cccdErrs = validateCccdRequired({
      idNumber: editData.idNumber,
      expirationDate: editData.idExpirationDate,
      residentialAddress: editData.residentialAddress,
      issuedDate: editData.idIssuedDate,
      issuer: editData.idIssuer,
    });
    if (Object.keys(cccdErrs).length > 0) {
      setErrors({
        idNumber: cccdErrs.idNumber,
        expirationDate: cccdErrs.expirationDate,
        residentialAddress: cccdErrs.residentialAddress,
        issuedDate: cccdErrs.issuedDate,
        issuer: cccdErrs.issuer,
      });
      toast.error("Vui lòng điền đầy đủ các trường bắt buộc");
      return;
    }
    setErrors({});

    // Final duplicate check before saving
    const fullName = [editData.legalFirstName, editData.legalLastName].filter(Boolean).join(" ");
    const finalDup = await checkAll({
      cccd: editData.idNumber,
      phone: editData.phoneNumber,
      name: fullName,
      dob: editData.dateOfBirth,
    });
    if (finalDup.cccdMatchId) {
      toast.error("Trùng CCCD", { description: "Số CCCD này đã có hồ sơ khác trong hệ thống." });
      return;
    }
    if (
      (finalDup.phoneMatchId && !bypassed.phone) ||
      (finalDup.nameDobMatchId && !bypassed.nameDob)
    ) {
      toast.warning("Vui lòng xác nhận các cảnh báo trùng trước khi lưu.");
      return;
    }

    setIsSaving(true);

    // Upload any new images first
    const ts = Date.now();
    const newPaths: {
      id_document_storage_path?: string;
      id_document_back_storage_path?: string;
      card_front_storage_path?: string;
    } = {};

    const fileUploads: { file: File; bucket: string; path: string; key: keyof typeof newPaths }[] = [];
    if (editFiles.idFile) {
      fileUploads.push({
        file: editFiles.idFile,
        bucket: "identity-documents",
        path: `${userId}/id_front_${ts}_${sanitizeStorageSegment(editFiles.idFile.name)}`,
        key: "id_document_storage_path",
      });
    }
    if (editFiles.idBackFile) {
      fileUploads.push({
        file: editFiles.idBackFile,
        bucket: "identity-documents",
        path: `${userId}/id_back_${ts}_${sanitizeStorageSegment(editFiles.idBackFile.name)}`,
        key: "id_document_back_storage_path",
      });
    }
    if (editFiles.cardFile) {
      fileUploads.push({
        file: editFiles.cardFile,
        bucket: "insurance-cards",
        path: `${userId}/card_front_${ts}_${sanitizeStorageSegment(editFiles.cardFile.name)}`,
        key: "card_front_storage_path",
      });
    }

    if (fileUploads.length > 0) {
      const results = await Promise.all(
        fileUploads.map(({ file, bucket, path }) =>
          supabase.storage.from(bucket).upload(path, file, { upsert: true, cacheControl: "3600" }),
        ),
      );
      const uploadErr = results.find((r) => r.error)?.error;
      if (uploadErr) {
        toast.error("Upload ảnh thất bại", { description: uploadErr.message });
        setIsSaving(false);
        return;
      }
      fileUploads.forEach(({ key, path }) => {
        newPaths[key] = path;
      });
    }

    let payload: Record<string, unknown>;
    try {
      payload = await encryptRow(
        {
          user_id: userId,
          legal_first_name: editData.legalFirstName || null,
          legal_last_name: editData.legalLastName || null,
          date_of_birth: editData.dateOfBirth || null,
          phone_number: editData.phoneNumber || null,
          email_address: editData.email || null,
          preferred_pronouns: editData.pronouns || null,
          id_number: editData.idNumber || null,
          id_issuer: editData.idIssuer || null,
          id_issued_date: editData.idIssuedDate || null,
          id_expiration_date: editData.idExpirationDate || null,
          residential_address: editData.residentialAddress || null,
          insurance_provider: editData.insuranceProvider || null,
          member_id: editData.memberId || null,
          group_number: editData.groupNumber || null,
          ...newPaths,
        },
        "patient",
      );
    } catch (e) {
      setIsSaving(false);
      toast.error("Lưu thất bại", {
        description: e instanceof Error ? e.message : "Không mã hóa được dữ liệu nhạy cảm",
      });
      return;
    }

    const { error } = await supabase.from("patient").upsert(payload, { onConflict: "user_id" });

    setIsSaving(false);
    if (error) {
      toast.error("Lưu thất bại", { description: error.message });
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ["patient", "my-profile", userId] });
    await queryClient.invalidateQueries({ queryKey: ["patient", "my-profile-images", userId] });
    await queryClient.invalidateQueries({ queryKey: ["patient", "has-profile", userId] });
    setIsEditing(false);
    setEditData(null);
    setEditFiles(emptyEditFiles);
    toast.success("Đã lưu hồ sơ");
  };

  return (
    <>
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!isSaving) {
          handleCancelEdit();
          onOpenChange(v);
        }
      }}
    >
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileUser className="h-5 w-5 text-primary" />
            Hồ sơ bệnh nhân
          </SheetTitle>
          <SheetDescription>
            Thông tin cá nhân, giấy tờ và bảo hiểm từ onboarding.
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Đang tải hồ sơ…
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive" role="alert">
            Không tải được hồ sơ. Hoàn tất onboarding hoặc thử lại sau.
          </p>
        ) : !profile ? (
          <p className="text-sm text-muted-foreground">
            Chưa có hồ sơ. Vui lòng hoàn tất{" "}
            <Link to="/onboarding" className="font-semibold text-primary hover:underline">
              onboarding
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-5">
            {/* Header banner */}
            <div className="flex items-center gap-4 rounded-xl bg-gradient-to-r from-primary to-primary/80 p-4 text-primary-foreground">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-foreground/20">
                <UserRound className="h-7 w-7" />
              </div>
              <div>
                <p className="text-xl font-bold">
                  {isEditing && editData
                    ? [editData.legalFirstName, editData.legalLastName].filter(Boolean).join(" ") ||
                      "Bệnh nhân"
                    : profile.full_name}
                </p>
                <p className="text-sm opacity-90">
                  ID: {displayId} · DOB:{" "}
                  {isEditing && editData
                    ? formatDob(editData.dateOfBirth)
                    : formatDob(profile.date_of_birth)}
                </p>
                {(isEditing ? editData?.pronouns : profile.preferred_pronouns) ? (
                  <p className="text-xs opacity-80">
                    {isEditing ? editData?.pronouns : profile.preferred_pronouns}
                  </p>
                ) : null}
              </div>
            </div>

            {!data && draftFallback ? (
              <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                Đang hiển thị bản nháp onboarding (chưa lưu lên hệ thống).
              </p>
            ) : null}

            {/* Thông tin cá nhân */}
            <section>
              <h3 className="mb-2 text-sm font-semibold text-foreground">Thông tin cá nhân</h3>
              {isEditing && editData ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <EditField
                    label="Họ" value={editData.legalLastName} onChange={set("legalLastName")}
                    onBlur={() => { const n = [editData.legalFirstName, editData.legalLastName].filter(Boolean).join(" "); void checkNameDob(n, editData.dateOfBirth); }}
                    highlight={dupState.nameDobMatchId && !bypassed.nameDob ? "warn" : undefined}
                  />
                  <EditField
                    label="Tên" value={editData.legalFirstName} onChange={set("legalFirstName")}
                    onBlur={() => { const n = [editData.legalFirstName, editData.legalLastName].filter(Boolean).join(" "); void checkNameDob(n, editData.dateOfBirth); }}
                    highlight={dupState.nameDobMatchId && !bypassed.nameDob ? "warn" : undefined}
                  />
                  <EditField
                    label="Ngày sinh" value={editData.dateOfBirth} onChange={set("dateOfBirth")} type="date"
                    onBlur={() => { const n = [editData.legalFirstName, editData.legalLastName].filter(Boolean).join(" "); void checkNameDob(n, editData.dateOfBirth); }}
                    highlight={dupState.nameDobMatchId && !bypassed.nameDob ? "warn" : undefined}
                  />
                  <EditField
                    label="Số điện thoại" value={editData.phoneNumber} onChange={set("phoneNumber")} type="tel"
                    onBlur={() => void checkPhone(editData.phoneNumber)}
                    highlight={dupState.phoneMatchId && !bypassed.phone ? "warn" : undefined}
                  />
                  <EditField label="Email" value={editData.email} onChange={set("email")} type="email" />
                  <EditField label="Đại từ" value={editData.pronouns} onChange={set("pronouns")} />
                  {dupState.phoneMatchId && !bypassed.phone ? (
                    <div className="sm:col-span-2 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span><strong>SĐT đã tồn tại.</strong>{" "}<button type="button" onClick={bypassPhone} className="font-semibold underline">Vẫn lưu</button></span>
                    </div>
                  ) : null}
                  {dupState.nameDobMatchId && !bypassed.nameDob ? (
                    <div className="sm:col-span-2 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span><strong>Họ tên + ngày sinh đã khớp hồ sơ khác.</strong>{" "}<button type="button" onClick={bypassNameDob} className="font-semibold underline">Vẫn lưu</button></span>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Họ tên" value={profile.full_name} />
                  <Field label="Ngày sinh" value={formatDob(profile.date_of_birth)} />
                  <Field label="Email" value={profile.email_address ?? ""} />
                  <Field label="Số điện thoại" value={profile.phone_number ?? ""} />
                  <Field label="Đại từ" value={profile.preferred_pronouns ?? ""} />
                  <Field label="Trạng thái hồ sơ" value={profile.submitted_at ? "Đã nộp" : "Bản nháp"} />
                </div>
              )}
            </section>

            {/* Giấy tờ tùy thân */}
            <section>
              <h3 className="mb-2 text-sm font-semibold text-foreground">Giấy tờ tùy thân</h3>
              {isEditing && editData ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <EditField
                    id="idNumber"
                    label="Số CCCD/ID" value={editData.idNumber} onChange={set("idNumber")}
                    onBlur={() => void checkCccd(editData.idNumber)}
                    highlight={dupState.cccdMatchId ? "error" : undefined}
                    required error={errors.idNumber}
                  />
                  {dupState.cccdMatchId ? (
                    <div className="sm:col-span-2 -mt-1 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span><strong>Trùng CCCD.</strong> Số CCCD này đã có hồ sơ khác trong hệ thống. Không thể lưu.</span>
                    </div>
                  ) : null}
                  <EditField id="issuer" label="Nơi cấp" value={editData.idIssuer} onChange={set("idIssuer")} multiline
                    required error={errors.issuer} />
                  <EditField id="issuedDate" label="Ngày cấp" value={editData.idIssuedDate} onChange={set("idIssuedDate")} type="date"
                    required error={errors.issuedDate} />
                  <EditField id="expirationDate" label="Ngày hết hạn" value={editData.idExpirationDate} onChange={set("idExpirationDate")} type="date"
                    required error={errors.expirationDate} />
                  <div className="sm:col-span-2">
                    <EditField id="residentialAddress" label="Địa chỉ" value={editData.residentialAddress} onChange={set("residentialAddress")}
                      required error={errors.residentialAddress} />
                  </div>
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Số CCCD/ID" value={profile.id_number ?? ""} />
                  <Field label="Nơi cấp" value={profile.id_issuer ?? ""} />
                  <Field label="Ngày cấp" value={formatDob(profile.id_issued_date)} />
                  <Field label="Ngày hết hạn" value={formatDob(profile.id_expiration_date)} />
                  <Field label="Địa chỉ" value={profile.residential_address ?? ""} />
                </div>
              )}
            </section>

            {/* Ảnh giấy tờ */}
            {isEditing ? (
              <section>
                <h3 className="mb-2 text-sm font-semibold text-foreground">Ảnh giấy tờ đã tải lên</h3>
                <p className="mb-3 text-xs text-muted-foreground">
                  Hover vào ảnh và nhấn <strong>Thay ảnh</strong> để cập nhật, hoặc <strong>OCR lại</strong> để nhận diện từ ảnh hiện có.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <EditableDocPreview
                    inputId="edit-id-front"
                    label="CCCD mặt trước"
                    existingUrl={idImageUrl}
                    existingPath={profile.id_document_storage_path}
                    newFile={editFiles.idFile}
                    onFileSelect={(f) => setEditFiles((prev) => ({ ...prev, idFile: f }))}
                    onOcr={() => void handleOcrSlot("front")}
                    ocrLoading={ocrSlot === "front" || ocrSlot === "all"}
                    ocrDisabled={Boolean(ocrSlot)}
                    onPreview={(url, label) => setLightbox({ url, label })}
                  />
                  <EditableDocPreview
                    inputId="edit-id-back"
                    label="CCCD mặt sau"
                    existingUrl={idBackImageUrl}
                    existingPath={profile.id_document_back_storage_path}
                    newFile={editFiles.idBackFile}
                    onFileSelect={(f) => setEditFiles((prev) => ({ ...prev, idBackFile: f }))}
                    onOcr={() => void handleOcrSlot("back")}
                    ocrLoading={ocrSlot === "back" || ocrSlot === "all"}
                    ocrDisabled={Boolean(ocrSlot)}
                    onPreview={(url, label) => setLightbox({ url, label })}
                  />
                  <EditableDocPreview
                    inputId="edit-card-front"
                    label="Thẻ BHYT"
                    existingUrl={cardImageUrl}
                    existingPath={profile.card_front_storage_path}
                    newFile={editFiles.cardFile}
                    onFileSelect={(f) => setEditFiles((prev) => ({ ...prev, cardFile: f }))}
                    onOcr={() => void handleOcrSlot("bhyt")}
                    ocrLoading={ocrSlot === "bhyt" || ocrSlot === "all"}
                    ocrDisabled={Boolean(ocrSlot)}
                    onPreview={(url, label) => setLightbox({ url, label })}
                  />
                </div>
                <div className="mt-3 flex justify-end">
                  <Button
                    type="button"
                    className="gap-1.5"
                    disabled={
                      Boolean(ocrSlot) ||
                      !(
                        editFiles.idFile ||
                        idImageUrl ||
                        editFiles.idBackFile ||
                        idBackImageUrl ||
                        editFiles.cardFile ||
                        cardImageUrl
                      )
                    }
                    onClick={() => void handleOcrAll()}
                  >
                    {ocrSlot === "all" ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <ScanSearch className="h-4 w-4" aria-hidden="true" />
                    )}
                    {ocrSlot === "all" ? "Đang OCR…" : "OCR lại tất cả"}
                  </Button>
                </div>
              </section>
            ) : (idImageUrl || idBackImageUrl || cardImageUrl) ? (
              <section>
                <h3 className="mb-2 text-sm font-semibold text-foreground">Ảnh giấy tờ đã tải lên</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  {idImageUrl ? (
                    <DocPreview url={idImageUrl} label="CCCD mặt trước" storagePath={profile.id_document_storage_path}
                      onPreview={(url, label) => setLightbox({ url, label })} />
                  ) : null}
                  {idBackImageUrl ? (
                    <DocPreview url={idBackImageUrl} label="CCCD mặt sau" storagePath={profile.id_document_back_storage_path}
                      onPreview={(url, label) => setLightbox({ url, label })} />
                  ) : null}
                  {cardImageUrl ? (
                    <DocPreview url={cardImageUrl} label="Thẻ BHYT" storagePath={profile.card_front_storage_path}
                      onPreview={(url, label) => setLightbox({ url, label })} />
                  ) : null}
                </div>
              </section>
            ) : null}

            {/* Bảo hiểm */}
            <section>
              <h3 className="mb-2 text-sm font-semibold text-foreground">Bảo hiểm (BHYT)</h3>
              {isEditing && editData ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <EditField label="Nhà cung cấp" value={editData.insuranceProvider} onChange={set("insuranceProvider")} />
                  </div>
                  <EditField label="Mã thành viên" value={editData.memberId} onChange={set("memberId")} />
                  <EditField label="Mã nhóm" value={editData.groupNumber} onChange={set("groupNumber")} />
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Nhà cung cấp" value={profile.insurance_provider ?? ""} />
                  <Field label="Mã thành viên" value={profile.member_id ?? ""} />
                  <Field label="Mã nhóm" value={profile.group_number ?? ""} />
                </div>
              )}
            </section>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              handleCancelEdit();
              onOpenChange(false);
            }}
            disabled={isSaving}
          >
            Đóng
          </Button>
          <div className="flex gap-2">
            {data && !isEditing ? (
              <Button type="button" onClick={handleStartEdit} className="gap-2">
                <Pencil className="h-4 w-4" />
                Chỉnh sửa
              </Button>
            ) : null}
            {isEditing ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="gap-2"
                >
                  <X className="h-4 w-4" />
                  Hủy
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={isSaving || dupIsBlocked || Boolean(ocrSlot)}
                  className="gap-2"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Lưu
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
    {lightbox ? (
      <DocImageLightbox
        url={lightbox.url}
        label={lightbox.label}
        onClose={() => setLightbox(null)}
      />
    ) : null}
    </>
  );
};

export const PatientProfileSheet = PatientProfileDialog;
export default PatientProfileDialog;
