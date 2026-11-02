import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { listFacilitiesAdmin, upsertFacility, deleteFacility } from '@/lib/master-data-api';
import type { Facility } from '@/types/master-data';
import { useRegisterAddAction } from './MasterDataActionsContext';
import {
  EntityTable, ActiveBadge, RowActions, useToggleActive, ActiveStatusField, DeleteConfirmDialog,
  Field, FormActions, inputCls, useEntityDialog, useEntityTableData, cellPrimaryCls, cellMutedCls, cellCls,
} from './shared';

export default function FacilitiesTab() {
  const {
    rows, total, loading, exporting, statusCounts, query, onQueryChange, reload, fetchExportRows,
  } = useEntityTableData(listFacilitiesAdmin, 6, 'facilities');
  const { togglingId, toggle } = useToggleActive(upsertFacility, reload);
  const [deleteTarget, setDeleteTarget] = useState<Facility | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { open, editing, openAdd, openEdit, close } = useEntityDialog<Facility>();

  useRegisterAddAction('facilities', 'Thêm Cơ sở', openAdd);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteFacility(deleteTarget.id);
      toast.success('Đã xóa cơ sở.');
      setDeleteTarget(null);
      reload();
    } catch (e) { toast.error((e as Error).message); }
    finally { setDeleting(false); }
  }

  return (
    <>
      <EntityTable
        statusCounts={statusCounts}
        entityLabel="cơ sở"
        title="Cơ sở"
        loading={loading}
        exporting={exporting}
        headers={['Tên cơ sở', 'Mã', 'Địa chỉ', 'SĐT', 'Trạng thái', 'Thao tác']}
        rows={rows}
        total={total}
        query={query}
        onQueryChange={onQueryChange}
        onExportFetch={fetchExportRows}
        getRowKey={(r) => r.id}
        hasActiveField
        getIsActive={(r) => r.is_active}
        exportColumns={[
          { key: 'name', label: 'Tên cơ sở' },
          { key: 'code', label: 'Mã' },
          { key: 'address', label: 'Địa chỉ' },
          { key: 'phone', label: 'SĐT' },
          { key: 'status', label: 'Trạng thái' },
        ]}
        getExportRow={(r) => ({
          name: r.name,
          code: r.code ?? '',
          address: r.address ?? '',
          phone: r.phone ?? '',
          status: r.is_active ? 'Hoạt động' : 'Vô hiệu',
        })}
        renderRow={(r) => (
          <>
            <td className={cellPrimaryCls}>{r.name}</td>
            <td className={`${cellCls} text-xs font-mono text-muted-foreground`}>{r.code ?? '—'}</td>
            <td className={cellMutedCls}>{r.address ?? '—'}</td>
            <td className={cellMutedCls}>{r.phone ?? '—'}</td>
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

      <FacilityDialog open={open} initial={editing} onClose={close} onSaved={reload} />

      <DeleteConfirmDialog
        open={!!deleteTarget}
        name={deleteTarget?.name}
        entityLabel="cơ sở"
        deleting={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </>
  );
}

function FacilityDialog({ open, initial, onClose, onSaved }: {
  open: boolean; initial: Facility | null; onClose: () => void; onSaved: () => void;
}) {
  const blank: Partial<Facility> = { name: '', code: '', address: '', phone: '', is_active: true };
  const [form, setForm] = useState<Partial<Facility>>(initial ?? blank);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(initial ?? blank); }, [initial]);

  const set = (k: keyof Facility) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name?.trim()) { toast.error('Tên không được để trống.'); return; }
    setSaving(true);
    try {
      await upsertFacility(form as Facility & { name: string });
      toast.success(form.id ? 'Đã cập nhật.' : 'Đã thêm cơ sở.');
      onSaved(); onClose();
    } catch (err) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{form.id ? 'Sửa cơ sở' : 'Thêm cơ sở'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <Field label="Tên cơ sở *">
            <input value={form.name ?? ''} onChange={set('name')} className={inputCls} placeholder="Phòng khám Đa khoa ABC" />
          </Field>
          <Field label="Mã cơ sở">
            <input value={form.code ?? ''} onChange={set('code')} className={inputCls} placeholder="RC-MAIN" />
          </Field>
          <Field label="Địa chỉ">
            <input value={form.address ?? ''} onChange={set('address')} className={inputCls} placeholder="123 Nguyễn Huệ, Q.1, TP.HCM" />
          </Field>
          <Field label="Số điện thoại">
            <input value={form.phone ?? ''} onChange={set('phone')} className={inputCls} placeholder="028 1234 5678" />
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
