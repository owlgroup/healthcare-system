import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { listSpecialtiesAdmin, upsertSpecialty, deleteSpecialty } from '@/lib/master-data-api';
import type { Specialty } from '@/types/master-data';
import { useRegisterAddAction } from './MasterDataActionsContext';
import {
  EntityTable, ActiveBadge, RowActions, useToggleActive, ActiveStatusField, DeleteConfirmDialog,
  Field, inputCls, useEntityDialog, useEntityTableData, cellPrimaryCls, cellMutedCls, cellCls,
} from './shared';

const EMPTY: Omit<Specialty, 'id' | 'created_at'> = {
  name: '', description: '', icon: '', is_active: true,
};

const EXPORT_COLUMNS = [
  { key: 'name', label: 'Tên chuyên khoa' },
  { key: 'description', label: 'Mô tả' },
  { key: 'status', label: 'Trạng thái' },
];

export default function SpecialtiesTab() {
  const {
    rows, total, loading, exporting, statusCounts, query, onQueryChange, reload, fetchExportRows,
  } = useEntityTableData(listSpecialtiesAdmin, 6, 'specialties');
  const { togglingId, toggle } = useToggleActive(upsertSpecialty, reload);
  const [deleteTarget, setDeleteTarget] = useState<Specialty | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { open, editing, openAdd, openEdit, close } = useEntityDialog<Specialty>();

  useRegisterAddAction('specialties', 'Thêm Chuyên khoa', openAdd);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSpecialty(deleteTarget.id);
      toast.success('Đã xóa chuyên khoa.');
      setDeleteTarget(null);
      reload();
    } catch (e) { toast.error((e as Error).message); }
    finally { setDeleting(false); }
  }

  return (
    <>
      <EntityTable
        statusCounts={statusCounts}
        entityLabel="chuyên khoa"
        title="Chuyên khoa"
        loading={loading}
        exporting={exporting}
        headers={['Tên chuyên khoa', 'Mô tả', 'Trạng thái', 'Thao tác']}
        rows={rows}
        total={total}
        query={query}
        onQueryChange={onQueryChange}
        onExportFetch={fetchExportRows}
        getRowKey={(r) => r.id}
        hasActiveField
        getIsActive={(r) => r.is_active}
        exportColumns={EXPORT_COLUMNS}
        getExportRow={(r) => ({
          name: r.name,
          description: r.description ?? '',
          status: r.is_active ? 'Hoạt động' : 'Vô hiệu',
        })}
        renderRow={(r) => (
          <>
            <td className={cellPrimaryCls}>{r.name}</td>
            <td className={cellMutedCls}>{r.description ?? '—'}</td>
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

      <SpecialtyDialog
        open={open}
        initial={editing ?? EMPTY}
        onClose={close}
        onSaved={reload}
      />

      <DeleteConfirmDialog
        open={!!deleteTarget}
        name={deleteTarget?.name}
        entityLabel="chuyên khoa"
        deleting={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </>
  );
}

function SpecialtyDialog({
  open, initial, onClose, onSaved,
}: {
  open: boolean;
  initial: Partial<Specialty>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Specialty>>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(initial); }, [initial]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name?.trim()) { toast.error('Tên không được để trống.'); return; }
    setSaving(true);
    try {
      await upsertSpecialty(form as Specialty & { name: string });
      toast.success(form.id ? 'Đã cập nhật chuyên khoa.' : 'Đã thêm chuyên khoa.');
      onSaved();
      onClose();
    } catch (err) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{form.id ? 'Sửa chuyên khoa' : 'Thêm chuyên khoa'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <Field label="Tên *">
            <input value={form.name ?? ''} onChange={set('name')} className={inputCls} placeholder="Tim mạch" />
          </Field>
          <Field label="Mô tả">
            <textarea value={form.description ?? ''} onChange={set('description')} className={`${inputCls} resize-none`} rows={2} />
          </Field>
          <Field label="Icon slug">
            <input value={form.icon ?? ''} onChange={set('icon')} className={inputCls} placeholder="heart-pulse" />
          </Field>
          <ActiveStatusField
            value={form.is_active ?? true}
            onChange={(is_active) => setForm((f) => ({ ...f, is_active }))}
          />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted">Hủy</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {form.id ? 'Lưu' : 'Thêm'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
