import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { listServicesAdmin, upsertService, deleteService } from '@/lib/master-data-api';
import type { Service } from '@/types/master-data';
import { useRegisterAddAction } from './MasterDataActionsContext';
import {
  EntityTable, ActiveBadge, RowActions, useToggleActive, ActiveStatusField, DeleteConfirmDialog,
  Field, FormActions, inputCls, catalogDialogCls, catalogOverlayCls, useEntityDialog, useEntityTableData, cellPrimaryCls, cellMutedCls, cellCls,
} from './shared';

export default function ServicesTab() {
  const {
    rows, total, loading, exporting, statusCounts, query, onQueryChange, reload, fetchExportRows,
  } = useEntityTableData(listServicesAdmin, 6, 'services');
  const { togglingId, toggle } = useToggleActive(upsertService, reload);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { open, editing, openAdd, openEdit, close } = useEntityDialog<Service>();

  useRegisterAddAction('services', 'Thêm Dịch vụ', openAdd);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteService(deleteTarget.id);
      toast.success('Đã xóa dịch vụ.');
      setDeleteTarget(null);
      reload();
    } catch (e) { toast.error((e as Error).message); }
    finally { setDeleting(false); }
  }

  return (
    <>
      <EntityTable
        statusCounts={statusCounts}
        entityLabel="dịch vụ"
        title="Dịch vụ"
        loading={loading}
        exporting={exporting}
        headers={['Tên dịch vụ', 'Mô tả', 'Trạng thái', 'Thao tác']}
        rows={rows}
        total={total}
        query={query}
        onQueryChange={onQueryChange}
        onExportFetch={fetchExportRows}
        getRowKey={(r) => r.id}
        hasActiveField
        getIsActive={(r) => r.is_active}
        exportColumns={[
          { key: 'name', label: 'Tên dịch vụ' },
          { key: 'description', label: 'Mô tả' },
          { key: 'status', label: 'Trạng thái' },
        ]}
        getExportRow={(r) => ({
          name: r.name,
          description: r.description ?? '',
          status: r.is_active ? 'Hoạt động' : 'Vô hiệu',
        })}
        renderRow={(r) => (
          <>
            <td className={cellPrimaryCls}>{r.name}</td>
            <td className={cellMutedCls}>{r.description || '—'}</td>
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

      <ServiceDialog open={open} initial={editing} onClose={close} onSaved={reload} />

      <DeleteConfirmDialog
        open={!!deleteTarget}
        name={deleteTarget?.name}
        entityLabel="dịch vụ"
        deleting={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </>
  );
}

function ServiceDialog({ open, initial, onClose, onSaved }: {
  open: boolean;
  initial: Service | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const blank: Partial<Service> = { name: '', description: '', specialty_id: '', price_vnd: null, duration_minutes: 30, is_active: true };
  const [form, setForm] = useState<Partial<Service>>(initial ?? blank);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(initial ?? blank); }, [initial]);

  const setText = (k: keyof Service) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name?.trim()) { toast.error('Tên không được để trống.'); return; }
    setSaving(true);
    try {
      await upsertService({ ...form, specialty_id: form.specialty_id || null } as Service & { name: string });
      toast.success(form.id ? 'Đã cập nhật.' : 'Đã thêm dịch vụ.');
      onSaved(); onClose();
    } catch (err) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={catalogDialogCls} overlayClassName={catalogOverlayCls}>
        <DialogHeader><DialogTitle>{form.id ? 'Sửa dịch vụ' : 'Thêm dịch vụ'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <Field label="Tên *">
            <input value={form.name ?? ''} onChange={setText('name')} className={inputCls} placeholder="VD: Tên dịch vụ" />
          </Field>
          <Field label="Mô tả">
            <input value={form.description ?? ''} onChange={setText('description')} className={inputCls} placeholder="Mô tả ngắn" />
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
