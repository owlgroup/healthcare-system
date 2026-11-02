import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { listServicesAdmin, upsertService, deleteService, fetchSpecialtiesAdmin } from '@/lib/master-data-api';
import type { Service, Specialty } from '@/types/master-data';
import { formatVND } from '@/types/master-data';
import { useRegisterAddAction } from './MasterDataActionsContext';
import {
  EntityTable, ActiveBadge, RowActions, useToggleActive, ActiveStatusField, DeleteConfirmDialog,
  Field, FormActions, inputCls, useEntityDialog, useEntityTableData, cellPrimaryCls, cellMutedCls, cellCls,
} from './shared';

export default function ServicesTab() {
  const {
    rows, total, loading, exporting, statusCounts, query, onQueryChange, reload, fetchExportRows,
  } = useEntityTableData(listServicesAdmin, 6, 'services');
  const { togglingId, toggle } = useToggleActive(upsertService, reload);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { open, editing, openAdd, openEdit, close } = useEntityDialog<Service>();

  useRegisterAddAction('services', 'Thêm Dịch vụ', openAdd);

  useEffect(() => {
    fetchSpecialtiesAdmin()
      .then(setSpecialties)
      .catch((e: Error) => toast.error(e.message));
  }, []);

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
        headers={['Tên dịch vụ', 'Chuyên khoa', 'Giá (VND)', 'Thời gian', 'Trạng thái', 'Thao tác']}
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
          { key: 'specialty', label: 'Chuyên khoa' },
          { key: 'price', label: 'Giá (VND)' },
          { key: 'duration', label: 'Thời gian' },
          { key: 'status', label: 'Trạng thái' },
        ]}
        getExportRow={(r) => ({
          name: r.name,
          specialty: r.specialty_name ?? '',
          price: r.price_vnd != null ? String(r.price_vnd) : '',
          duration: `${r.duration_minutes} phút`,
          status: r.is_active ? 'Hoạt động' : 'Vô hiệu',
        })}
        renderRow={(r) => (
          <>
            <td className={cellPrimaryCls}>
              <p className="font-semibold text-sm">{r.name}</p>
              {r.description && <p className="text-xs text-muted-foreground font-normal">{r.description}</p>}
            </td>
            <td className={cellMutedCls}>{r.specialty_name}</td>
            <td className={`${cellCls} text-sm`}>{formatVND(r.price_vnd)}</td>
            <td className={cellMutedCls}>{r.duration_minutes} phút</td>
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

      <ServiceDialog open={open} initial={editing} specialties={specialties} onClose={close} onSaved={reload} />

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

function ServiceDialog({ open, initial, specialties, onClose, onSaved }: {
  open: boolean;
  initial: Service | null;
  specialties: Specialty[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const blank: Partial<Service> = { name: '', description: '', specialty_id: '', price_vnd: null, duration_minutes: 30, is_active: true };
  const [form, setForm] = useState<Partial<Service>>(initial ?? blank);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(initial ?? blank); }, [initial]);

  const setText  = (k: keyof Service) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const setNum   = (k: keyof Service) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value === '' ? null : Number(e.target.value) }));

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
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{form.id ? 'Sửa dịch vụ' : 'Thêm dịch vụ'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <Field label="Tên *">
            <input value={form.name ?? ''} onChange={setText('name')} className={inputCls} placeholder="Khám tổng quát" />
          </Field>
          <Field label="Mô tả">
            <textarea value={form.description ?? ''} onChange={setText('description')} className={`${inputCls} resize-none`} rows={2} />
          </Field>
          <Field label="Chuyên khoa">
            <select value={form.specialty_id ?? ''} onChange={setText('specialty_id')} className={inputCls}>
              <option value="">-- Không thuộc chuyên khoa --</option>
              {specialties.filter((s) => s.is_active).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Giá (VND)">
              <input type="number" min={0} value={form.price_vnd ?? ''} onChange={setNum('price_vnd')} className={inputCls} placeholder="150000" />
            </Field>
            <Field label="Thời gian (phút)">
              <input type="number" min={5} max={480} value={form.duration_minutes ?? 30} onChange={setNum('duration_minutes')} className={inputCls} />
            </Field>
          </div>
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
