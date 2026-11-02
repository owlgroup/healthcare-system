import { useState } from "react";
import { Trash2, Plus, FileText, MoreVertical } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { QuestionnaireSection, SectionRole } from "@/types/questionnaire";
import { SECTION_ROLE_LABELS } from "@/types/questionnaire";
import QuestionEditor from "./QuestionEditor";
import { blankQuestion, newId } from "./types";

type Props = {
  section: QuestionnaireSection;
  sectionIndex: number;
  allSections: QuestionnaireSection[];
  onChange: (s: QuestionnaireSection) => void;
  onRemove: () => void;
  disabled: boolean;
};

export default function SectionEditor({
  section, sectionIndex, allSections, onChange, onRemove, disabled,
}: Props) {
  const [metaOpen, setMetaOpen] = useState(false);
  const sectionLabel = String.fromCharCode(65 + sectionIndex);

  function patch(fields: Partial<QuestionnaireSection>) {
    onChange({ ...section, ...fields });
  }

  function addQuestion() {
    patch({ questions: [...section.questions, blankQuestion(section.id)] });
  }

  function duplicateQuestion(qid: string) {
    const src = section.questions.find((q) => q.id === qid);
    if (!src) return;
    const newQid = newId();
    patch({
      questions: [
        ...section.questions,
        {
          ...src,
          id: newQid,
          options: src.options.map((o) => ({ ...o, id: newId() })),
          skip_logic: src.skip_logic.map((r) => ({ ...r })),
        },
      ],
    });
  }

  const nextQIndex = section.questions.length + 1;

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-5">
      {/* Section header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pink-100">
            <FileText className="h-5 w-5 text-primary" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 space-y-1">
            <input
              value={section.title}
              disabled={disabled}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder={`Phần ${sectionLabel}: Bệnh nhân tự khai báo`}
              className="w-full bg-transparent text-base font-bold text-foreground focus:outline-none disabled:opacity-60"
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-md bg-teal-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-700">
                Vai trò: {SECTION_ROLE_LABELS[section.role]}
              </span>
              {section.key ? (
                <span className="text-[10px] font-mono text-muted-foreground">
                  Mã nội bộ: {section.key}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
              aria-label="Tùy chọn phần"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setMetaOpen((v) => !v)}>
              Cấu hình phần
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={disabled}
              className="text-destructive focus:text-destructive"
              onClick={onRemove}
            >
              Xóa phần
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {metaOpen && (
        <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={section.key}
              disabled={disabled}
              onChange={(e) => patch({ key: e.target.value })}
              placeholder="Mã nội bộ (VD: PHQ8_PHAN_A)"
              className="flex-1 rounded-xl border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            />
            <Select value={section.role} disabled={disabled} onValueChange={(v) => patch({ role: v as SectionRole })}>
              <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(SECTION_ROLE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Questions */}
      <div className="space-y-4">
        {section.questions.map((q, qi) => (
          <QuestionEditor
            key={q.id}
            question={q}
            questionIndex={qi + 1}
            allSections={allSections}
            disabled={disabled}
            onChange={(updated) => patch({
              questions: section.questions.map((qq) => qq.id === updated.id ? updated : qq),
            })}
            onRemove={() => patch({ questions: section.questions.filter((qq) => qq.id !== q.id) })}
            onDuplicate={() => duplicateQuestion(q.id)}
          />
        ))}
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={addQuestion}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/80 py-4 text-sm font-semibold text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 disabled:opacity-40 transition-colors"
      >
        <Plus className="h-4 w-4" />
        Thêm câu hỏi tiếp theo (Q{nextQIndex})
      </button>
    </div>
  );
}
