import { useEffect, useState } from "react";
import { FileUser, UserRoundPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import PatientRecordDetailPanel, { type PatientDocImageUrls } from "@/components/patient-records/PatientRecordDetailPanel";
import { useAuth } from "@/hooks/use-auth";
import { getPatientRecordById } from "@/lib/patient-records";
import { supabase } from "@/lib/supabase";
import type { PatientPortalDetail } from "@/types/patient-portal";

interface Props {
  profileId: string | null;
  open: boolean;
  onClose: () => void;
  onProfileResolved?: (hasProfile: boolean) => void;
  onCreateProfile?: () => void;
  nested?: boolean;
}

export default function PatientRecordDialog({ profileId, open, onClose, onProfileResolved, onCreateProfile, nested = false }: Props) {
  const { role } = useAuth();
  const canReview = role === "admin";
  const [record, setRecord] = useState<PatientPortalDetail | null>(null);
  const [imageUrls, setImageUrls] = useState<PatientDocImageUrls>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (!open || !profileId) return;
    setIsLoading(true);
    setIsError(false);
    setRecord(null);
    setImageUrls({});

    getPatientRecordById(supabase, profileId).then(async ({ record: r, error }) => {
      setIsLoading(false);
      if (error) { setIsError(true); onProfileResolved?.(false); return; }
      if (!r) { onProfileResolved?.(false); return; }

      setRecord(r);
      onProfileResolved?.(true);

      // Fetch signed URLs for document images in parallel
      const [idResult, idBackResult, cardResult] = await Promise.all([
        r.id_document_storage_path
          ? supabase.storage.from("identity-documents").createSignedUrl(r.id_document_storage_path, 3600)
          : null,
        r.id_document_back_storage_path
          ? supabase.storage.from("identity-documents").createSignedUrl(r.id_document_back_storage_path, 3600)
          : null,
        r.card_front_storage_path
          ? supabase.storage.from("insurance-cards").createSignedUrl(r.card_front_storage_path, 3600)
          : null,
      ]);

      setImageUrls({
        idFront: idResult?.data?.signedUrl ?? null,
        idBack: idBackResult?.data?.signedUrl ?? null,
        card: cardResult?.data?.signedUrl ?? null,
      });
    });
  }, [open, profileId]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" hideOverlay={nested}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUser className="h-5 w-5 text-primary" />
            Hồ sơ bệnh nhân
          </DialogTitle>
        </DialogHeader>

        {!isLoading && !isError && !record ? (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <UserRoundPlus className="h-12 w-12 text-muted-foreground/50" />
            <div>
              <p className="font-medium">Bệnh nhân chưa có hồ sơ</p>
              <p className="text-sm text-muted-foreground mt-1">
                Bệnh nhân này chưa hoàn tất hồ sơ trong hệ thống.
              </p>
            </div>
            {onCreateProfile && (
              <Button onClick={() => { onClose(); onCreateProfile(); }}>
                <UserRoundPlus className="mr-2 h-4 w-4" />
                Tạo hồ sơ bệnh nhân
              </Button>
            )}
          </div>
        ) : (
          <PatientRecordDetailPanel
            profile={record}
            isLoading={isLoading}
            isError={isError}
            imageUrls={imageUrls}
            canReview={canReview}
            onReviewed={() => {
              if (!profileId) return;
              setIsLoading(true);
              getPatientRecordById(supabase, profileId).then(({ record: r, error }) => {
                setIsLoading(false);
                if (error) { setIsError(true); return; }
                setRecord(r);
              });
            }}
          />
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>Đóng</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
