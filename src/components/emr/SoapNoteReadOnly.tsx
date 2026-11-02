/**
 * Read-only SOAP Note view for completed (LOCKED) examinations
 */

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Check, Lock, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { verifyExaminationIntegrity, type IntegrityResult } from '@/lib/emr-api';
import ExamComprehensiveLogControl from '@/components/emr/ExamComprehensiveLogControl';
import ExamAddendumForm from '@/components/emr/ExamAddendumForm';
import type { MedicalExamination } from '@/types/emr';

type SoapNoteReadOnlyProps = {
  exam: MedicalExamination;
  showTimestamp?: boolean;
  onAddendumCreated?: () => void;
};

export default function SoapNoteReadOnly({
  exam, showTimestamp = true, onAddendumCreated,
}: SoapNoteReadOnlyProps) {
  const confirmedIcds = exam.icd_codes.filter((c) => c.confirm_status === 'CONFIRMED');
  const [integrity, setIntegrity] = useState<IntegrityResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const result = await verifyExaminationIntegrity(exam.id);
      setIntegrity(result);
    } catch (e) {
      setIntegrity({ valid: false, message: (e as Error).message });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge className="bg-green-100 text-green-700 gap-1 text-xs">
            <Lock className="h-3 w-3" /> Đã ký duyệt
          </Badge>
          {exam.is_addendum && (
            <Badge variant="outline" className="text-xs">Phụ lục (Addendum)</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showTimestamp && exam.updated_at && (
            <span className="text-xs text-muted-foreground">
              {format(parseISO(exam.updated_at), "dd/MM/yyyy 'lúc' HH:mm", { locale: vi })}
            </span>
          )}
          <ExamComprehensiveLogControl exam={exam} />
          <Button variant="outline" size="sm" onClick={() => void handleVerify()} disabled={verifying}>
            {verifying ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <ShieldCheck className="h-3 w-3 mr-1" />}
            Xác minh tính toàn vẹn
          </Button>
        </div>
      </div>

      {integrity && (
        <Alert variant={integrity.valid ? 'default' : 'destructive'}>
          <AlertDescription className="text-xs">{integrity.message}</AlertDescription>
        </Alert>
      )}

      {!exam.is_addendum && (
        <ExamAddendumForm examId={exam.id} onCreated={onAddendumCreated} />
      )}

      {confirmedIcds.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Chẩn đoán (ICD-10)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {confirmedIcds.map((icd) => (
              <span
                key={icd.id}
                className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 text-xs font-medium text-green-800"
              >
                <Check className="h-2.5 w-2.5" />
                <span className="font-mono font-bold">{icd.icd_code}</span>
                <span>{icd.icd_name}</span>
                {icd.is_ai_suggested && (
                  <Sparkles className="h-2.5 w-2.5 text-amber-500" title="AI gợi ý" />
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {exam.s_text && <SoapBlock label="S — Subjective" description="Triệu chứng chủ quan" content={exam.s_text} />}
      {exam.o_text && <SoapBlock label="O — Objective" description="Khám lâm sàng" content={exam.o_text} />}
      {(exam.a_text || confirmedIcds.length > 0) && (
        <SoapBlock label="A — Assessment" description="Chẩn đoán" content={exam.a_text ?? ''} />
      )}
      {exam.p_text && <SoapBlock label="P — Plan" description="Kế hoạch điều trị" content={exam.p_text} />}
    </div>
  );
}

function SoapBlock({ label, description, content }: {
  label: string; description: string; content: string;
}) {
  if (!content) return null;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-bold text-primary">{label}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
      <Card className="border-border/50">
        <CardContent className="py-2.5 px-3">
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{content}</p>
        </CardContent>
      </Card>
    </div>
  );
}
