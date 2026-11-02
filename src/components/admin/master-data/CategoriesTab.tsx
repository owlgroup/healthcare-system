import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { listQuestionCategoriesAdmin, upsertQuestionCategory, deleteQuestionCategory } from '@/lib/master-data-api';
import type { QuestionCategory } from '@/types/master-data';
import { useRegisterAddAction } from './MasterDataActionsContext';
import {
  EntityTable, ActiveBadge, RowActions, useToggleActive, ActiveStatusField, DeleteConfirmDialog,
  Field, FormActions, inputCls, useEntityDialog, useEntityTableData, cellPrimaryCls, cellMutedCls, cellCls,
} from './shared';

export default function CategoriesTab() {
  const {
    rows, total, loading, exporting, statusCounts, query, onQueryChange, reload, fetchExportRows,
  } = useEntityTableData(listQuestionCategoriesAdmin, 6, 'categories');
  const { togglingId, toggle } = useToggleActive(upsertQuestionCategory, reload);
  const [deleteTarget, setDeleteTarget] = useState<QuestionCategory | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { open, editing, openAdd, openEdit, close } = useEntityDialog<QuestionCategory>();

  useRegisterAddAction('categories', 'Thêm Danh mục câu hỏi', openAdd);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteQuestionCategory(deleteTarget.id);
      toast.success('Đã xóa danh mục.');
      setDeleteTarget(null);
      reload();
    } catch (e) { toast.error((e as Error).message); }
    finally { setDeleting(false); }
  }

  return (
    <>
      <EntityTable
        statusCounts={statusCounts}
        entityLabel="danh mục câu hỏi"
        title="Danh mục câu hỏi"
        loading={loading}
        exporting={exporting}
        headers={['Tên', 'Mô tả', 'Thứ tự', 'Trạng thái', 'Thao tác']}
        rows={rows}
        total={total}
        query={query}
        onQueryChange={onQueryChange}
        onExportFetch={fetchExportRows}
        getRowKey={(r) => r.id}
        hasActiveField
        getIsActive={(r) => r.is_active}
        exportColumns={[
          { key: 'name', label: 'Tên' },
          { key: 'description', label: 'Mô tả' },
          { key: 'sort_order', label: 'Thứ tự' },
          { key: 'status', label: 'Trạng thái' },
        ]}
        getExportRow={(r) => ({
          name: r.name,
          description: r.description ?? '',
          sort_order: String(r.sort_order),
          status: r.is_active ? 'Hoạt động' : 'Vô hiệu',
        })}
        renderRow={(r) => (
          <>
            <td className={cellPrimaryCls}>{r.name}</td>
            <td className={cellMutedCls}>{r.description ?? '—'}</td>
            <td className={`${cellCls} text-sm`}>{r.sort_order}</td>
            <td className={cellCls}><ActiveBadge active={r.is_active} /></td>
            <td className={`${cellCls} text-right`}>
              <RowActions
                active={r.is_active}
                toggling={togglingId === r.id}
                onToggle={() => toggle(r)}
                onEdit={() => openEdit(r)}
                onDelete={() => setDeleteTarget(r)}
              />
            </td>
          </>
        )}
      />

      <CategoryDialog open={open} initial={editing} onClose={close} onSaved={reload} />

      <DeleteConfirmDialog
        open={!!deleteTarget}
        name={deleteTarget?.name}
        entityLabel="danh mục"
        deleting={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </>
  );
}

function CategoryDialog({ open, initial, onClose, onSaved }: {
  open: boolean; initial: QuestionCategory | null; onClose: () => void; onSaved: () => void;
}) {
  const blank: Partial<QuestionCategory> = { name: '', description: '', sort_order: 0, is_active: true };
  const [form, setForm] = useState<Partial<QuestionCategory>>(initial ?? blank);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(initial ?? blank); }, [initial]);

  const setStr = (k: keyof QuestionCategory) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name?.trim()) { toast.error('Tên không được để trống.'); return; }
    setSaving(true);
    try {
      await upsertQuestionCategory(form as QuestionCategory & { name: string });
      toast.success(form.id ? 'Đã cập nhật.' : 'Đã thêm danh mục.');
      onSaved(); onClose();
    } catch (err) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{form.id ? 'Sửa danh mục' : 'Thêm danh mục'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <Field label="Tên *">
            <input value={form.name ?? ''} onChange={setStr('name')} className={inputCls} placeholder="Tim mạch" />
          </Field>
          <Field label="Mô tả">
            <textarea value={form.description ?? ''} onChange={setStr('description')} className={`${inputCls} resize-none`} rows={2} />
          </Field>
          <Field label="Thứ tự hiển thị">
            <input type="number" min={0} value={form.sort_order ?? 0}
              onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
              className={inputCls} />
          </Field>
          <ActiveStatusField
            value={form.is_active ?? true}
            onChange={(is_active) => setForm((f) => ({ ...f, is_active }))}
          />
          <FormActions saving={saving} onCancel={onClose} editMode={!!form.id} />
        </form>
      </DialogContent>
    </Dialog>
  );
}
