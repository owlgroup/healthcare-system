import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { QuestionnaireSection } from "@/types/questionnaire";
import { getScaleBounds } from "@/lib/questionnaire-scoring";
import { QUESTION_TYPE_LABELS, SECTION_ROLE_LABELS } from "@/types/questionnaire";

type Props = {
  open: boolean;
  onClose: () => void;
  name: string;
  sections: QuestionnaireSection[];
};

export default function PreviewDialog({ open, onClose, name, sections }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{name || "Bộ câu hỏi"} — Xem trước</DialogTitle></DialogHeader>
        <div className="space-y-6 pt-2">
          {sections.length === 0 && (
            <p className="text-sm text-muted-foreground">Chưa có phần nào.</p>
          )}
          {sections.map((s, si) => (
            <div key={s.id}>
              <p className="text-sm font-bold">
                {si + 1}. {s.title || "(phần chưa đặt tên)"}
                <span className="ml-2 text-xs font-normal text-muted-foreground">[{SECTION_ROLE_LABELS[s.role]}]</span>
              </p>
              <div className="mt-2 space-y-3 pl-4 border-l">
                {s.questions.map((q, qi) => (
                  <div key={q.id}>
                    <p className="text-sm font-medium">
                      {si + 1}.{qi + 1} {q.text || "(câu hỏi chưa đặt tên)"}
                      <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">{QUESTION_TYPE_LABELS[q.type]}</span>
                    </p>
                    {q.type === "SCALE" && (() => {
                      const { min, max } = getScaleBounds(q.config);
                      return (
                        <p className="mt-1 text-xs text-muted-foreground">Thang {min}–{max}</p>
                      );
                    })()}
                    {q.type !== "SCALE" && q.options.length > 0 && (
                      <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                        {q.options.map((o) => (
                          <li key={o.id}>· {o.label || "(lựa chọn)"} {o.score != null && `(${o.score} điểm)`}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
                {s.questions.length === 0 && <p className="text-xs text-muted-foreground">Chưa có câu hỏi.</p>}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
