import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, Plus, Copy, AlertTriangle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
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

const fieldCls =
  "w-full rounded-lg border border-[#E1DDDA] bg-[#FAF9F8] px-3 text-sm text-[#1A1614] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] disabled:cursor-not-allowed disabled:opacity-60";

const ghostBtn =
  "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#D9D5D1] bg-white px-3.5 text-sm font-semibold text-[#1A1614] transition-colors duration-200 hover:bg-[#FAF9F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] disabled:cursor-not-allowed disabled:opacity-50";

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
  const crumb = name.trim() || (isNew ? "Bộ câu hỏi mới" : "Chỉnh sửa");

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
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9A928D]">
            Thư viện › <span className="text-[#C41740]">{crumb}</span>
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[#1A1614]">
            {isNew ? "Tạo bộ câu hỏi mới" : "Chỉnh sửa bộ câu hỏi"}
          </h1>
          {currentId && (
            <p className="mt-1 text-xs text-[#7A726D]">{STATUS_LABELS[status]}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={ghostBtn} onClick={() => navigate("/admin/question-library")}>
            <ArrowLeft className="h-4 w-4" /> Quay lại
          </button>
          <button type="button" className={ghostBtn} onClick={() => setPreviewOpen(true)}>
            Xem trước
          </button>
          <button type="button" className={ghostBtn} onClick={() => void handleSave()} disabled={saving || disabled}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Lưu nháp
          </button>
          <button
            type="button"
            onClick={() => void handlePublish()}
            disabled={publishing || disabled || status === "ACTIVE"}
            className="inline-flex h-9 cursor-pointer items-center rounded-lg bg-[#C41740] px-3.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#A8123A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {publishing && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
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

      <div className="flex flex-wrap items-start gap-4">
        <div className="grid min-w-0 flex-[999] basis-[560px] gap-3.5">
          <div className="flex flex-col gap-3 rounded-xl border border-[#E8E5E2] bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#7A726D]">Thông tin bộ câu hỏi</p>
            <input
              value={name}
              disabled={disabled}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tên bộ câu hỏi (VD: PHQ-8)"
              className={`${fieldCls} h-10 text-[15px] font-semibold`}
            />
            <input
              value={description}
              disabled={disabled}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả ngắn"
              className={`${fieldCls} h-[38px]`}
            />
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs text-[#7A726D]">Phân loại</span>
              {categories.map((category) => {
                const selected = categoryId === category.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => setCategoryId(category.id)}
                    className={`h-[30px] cursor-pointer rounded-full border px-3 text-[12.5px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] disabled:cursor-not-allowed disabled:opacity-50 ${
                      selected
                        ? "border-[#C41740] bg-[#FFF8F9] font-semibold text-[#C41740]"
                        : "border-[#E1DDDA] bg-white font-medium text-[#4A4440] hover:border-[#C41740]"
                    }`}
                  >
                    {category.name}
                  </button>
                );
              })}
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
            className="h-[52px] cursor-pointer rounded-xl border-[1.5px] border-dashed border-[#D9D5D1] text-sm font-semibold text-[#57524E] transition-colors duration-200 hover:border-[#C41740] hover:text-[#C41740] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="mr-1 inline h-4 w-4" />
            Thêm phần
          </button>
        </div>

        <div className="grid min-w-0 flex-1 basis-[300px] content-start gap-3.5 xl:sticky xl:top-20">
          <ScoringPanel
            scoring={scoring}
            onChange={setScoring}
            disabled={disabled}
            scoredQuestionCount={sections.flatMap((s) => s.questions).filter((q) => q.type === "SINGLE_CHOICE" || q.type === "MULTIPLE_CHOICE" || q.type === "SCALE").length}
          />
          <InterventionMatrixPanel rules={interventionMatrix} onChange={setInterventionMatrix} disabled={disabled} />
          <TreeCoveragePanel sections={sections} />
        </div>
      </div>

      <PreviewDialog open={previewOpen} onClose={() => setPreviewOpen(false)} name={name} sections={sections} />
    </div>
  );
}
