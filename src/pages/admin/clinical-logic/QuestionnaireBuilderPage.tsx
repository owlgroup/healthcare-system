import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, Eye, Upload, Plus, Copy, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { fetchQuestionCategories } from "@/lib/master-data-api";
import type { QuestionCategory } from "@/types/master-data";
import {
  fetchQuestionnaireById, createQuestionnaire, updateQuestionnaireMeta,
  saveQuestionnaireStructure, publishQuestionnaire, cloneQuestionnaire,
  hasResponses, mapQuestionnaireError,
} from "@/lib/questionnaire-api";
import type { InterventionRule, QuestionnaireSection, QuestionnaireStatus, ScoringConfig } from "@/types/questionnaire";
import { STATUS_LABELS } from "@/types/questionnaire";
import SectionEditor from "./builder/SectionEditor";
import ScoringPanel from "./builder/ScoringPanel";
import InterventionMatrixPanel from "./builder/InterventionMatrixPanel";
import TreeCoveragePanel from "./builder/TreeCoveragePanel";
import PreviewDialog from "./builder/PreviewDialog";
import { blankSection } from "./builder/types";

const inputCls =
  "w-full rounded-xl border border-border/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60";

export default function QuestionnaireBuilderPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [categories, setCategories] = useState<QuestionCategory[]>([]);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<QuestionnaireStatus>("DRAFT");
  const [version, setVersion] = useState(1);
  const [sections, setSections] = useState<QuestionnaireSection[]>([]);
  const [scoring, setScoring] = useState<ScoringConfig>({ formula: "" });
  const [interventionMatrix, setInterventionMatrix] = useState<InterventionRule[]>([]);
  const [blockedByResponses, setBlockedByResponses] = useState(false);

  const [currentId, setCurrentId] = useState<string | undefined>(id);

  useEffect(() => {
    fetchQuestionCategories().then(setCategories).catch((e: Error) => toast.error(e.message));
  }, []);

  useEffect(() => {
    if (!currentId) return;
    setLoading(true);
    Promise.all([fetchQuestionnaireById(currentId), hasResponses(currentId)])
      .then(([q, blocked]) => {
        setName(q.name);
        setCategoryId(q.category_id);
        setDescription(q.description ?? "");
        setStatus(q.status);
        setVersion(q.version);
        setSections(q.sections);
        setScoring(q.scoring_config.formula !== undefined ? q.scoring_config : { formula: "" });
        setInterventionMatrix(q.intervention_matrix);
        setBlockedByResponses(blocked);
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [currentId]);

  const disabled = blockedByResponses;
  const breadcrumbSlug = name.trim()
    ? `${name.toUpperCase()}${description ? " — THANG ĐO" : ""}`
    : "BỘ CÂU HỎI MỚI";

  function addSection() {
    setSections([...sections, blankSection(currentId ?? "")]);
  }

  async function handleSave(): Promise<string | null> {
    if (!name.trim()) { toast.error("Tên bộ câu hỏi không được để trống."); return null; }
    if (!categoryId) { toast.error("Vui lòng chọn phân loại."); return null; }
    setSaving(true);
    try {
      let qid = currentId;
      if (!qid) {
        qid = await createQuestionnaire({ name, category_id: categoryId, description: description || null });
        setCurrentId(qid);
      } else {
        await updateQuestionnaireMeta(qid, {
          name, category_id: categoryId, description: description || null,
          intervention_matrix: interventionMatrix, scoring_config: scoring,
        });
      }
      await saveQuestionnaireStructure(qid, sections);
      toast.success("Đã lưu.");
      if (isNew) navigate(`/admin/question-library/${qid}`, { replace: true });
      return qid;
    } catch (e) {
      toast.error(mapQuestionnaireError((e as Error).message));
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    const qid = await handleSave();
    if (!qid) return;
    setPublishing(true);
    try {
      await publishQuestionnaire(qid);
      setStatus("ACTIVE");
      toast.success("Đã kích hoạt bộ câu hỏi.");
    } catch (e) {
      toast.error(mapQuestionnaireError((e as Error).message));
    } finally {
      setPublishing(false);
    }
  }

  async function handleClone() {
    if (!currentId) return;
    setCloning(true);
    try {
      const newQid = await cloneQuestionnaire(currentId);
      toast.success("Đã tạo phiên bản mới (Bản nháp).");
      navigate(`/admin/question-library/${newQid}`);
    } catch (e) {
      toast.error(mapQuestionnaireError((e as Error).message));
    } finally {
      setCloning(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary">
            Thư viện / {breadcrumbSlug}
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mt-2">
            {name ? `Tạo bộ câu hỏi: ${name}` : "Tạo bộ câu hỏi mới"}
          </h1>
          {currentId && (
            <p className="text-xs text-muted-foreground mt-1.5">
              {STATUS_LABELS[status]}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="flex items-center gap-2 rounded-xl border-2 border-teal-500 bg-white px-5 py-2.5 text-sm font-semibold text-teal-600 hover:bg-teal-50"
          >
            <Eye className="h-4 w-4" /> Xem trước
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || disabled}
            className="hidden sm:flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Lưu
          </button>
          <button
            type="button"
            onClick={() => void handlePublish()}
            disabled={publishing || disabled || status === "ACTIVE"}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-50"
          >
            {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Xuất bản
          </button>
        </div>
      </div>

      {blockedByResponses && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Bộ câu hỏi đã có phản hồi — không thể chỉnh sửa cấu trúc.
          </div>
          <button
            type="button"
            onClick={() => void handleClone()}
            disabled={cloning}
            className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
          >
            {cloning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
            Tạo bản sao mới
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        {/* Left — builder */}
        <div className="space-y-5 min-w-0">
          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Thông tin bộ câu hỏi</p>
            <input
              value={name}
              disabled={disabled}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tên (VD: PHQ-8)"
              className={`${inputCls} text-base font-semibold`}
            />
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={categoryId ?? ""} disabled={disabled} onValueChange={(v) => setCategoryId(v)}>
                <SelectTrigger className="sm:w-56 rounded-xl"><SelectValue placeholder="Chọn phân loại *" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <input
                value={description}
                disabled={disabled}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả ngắn"
                className={`${inputCls} flex-1`}
              />
            </div>
          </div>

          {sections.map((s, si) => (
            <SectionEditor
              key={s.id}
              section={s}
              sectionIndex={si}
              allSections={sections}
              disabled={disabled}
              onChange={(updated) => setSections(sections.map((ss) => ss.id === updated.id ? updated : ss))}
              onRemove={() => setSections(sections.filter((ss) => ss.id !== s.id))}
            />
          ))}

          <button
            type="button"
            onClick={addSection}
            disabled={disabled}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/80 py-5 text-sm font-semibold text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 disabled:opacity-40 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Thêm phần
          </button>
        </div>

        {/* Right — modules */}
        <div className="space-y-4 xl:sticky xl:top-20 self-start">
          <ScoringPanel scoring={scoring} onChange={setScoring} disabled={disabled} />
          <InterventionMatrixPanel rules={interventionMatrix} onChange={setInterventionMatrix} disabled={disabled} />
          <TreeCoveragePanel sections={sections} />
        </div>
      </div>

      <PreviewDialog open={previewOpen} onClose={() => setPreviewOpen(false)} name={name} sections={sections} />
    </div>
  );
}
