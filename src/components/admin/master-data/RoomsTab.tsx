import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { listRoomsAdmin, upsertRoom, deleteRoom, fetchFacilities } from '@/lib/master-data-api';
import type { Room, Facility } from '@/types/master-data';
import { useRegisterAddAction } from './MasterDataActionsContext';
import {
  EntityTable, ActiveBadge, RowActions, useToggleActive, ActiveStatusField, DeleteConfirmDialog,
  Field, FormActions, inputCls, useEntityDialog, useEntityTableData, cellPrimaryCls, cellMutedCls, cellCls,
} from './shared';

export default function RoomsTab() {
  const {
    rows, total, loading, exporting, statusCounts, query, onQueryChange, reload, fetchExportRows,
  } = useEntityTableData(listRoomsAdmin, 6, 'rooms');
  const { togglingId, toggle } = useToggleActive(upsertRoom, reload);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { open, editing, openAdd, openEdit, close } = useEntityDialog<Room>();

  useRegisterAddAction('rooms', 'Thêm Phòng khám', openAdd);

  useEffect(() => {
    fetchFacilities()
      .then(setFacilities)
      .catch((e: Error) => toast.error(e.message));
  }, []);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteRoom(deleteTarget.id);
      toast.success('Đã xóa phòng.');
      setDeleteTarget(null);
      reload();
    } catch (e) { toast.error((e as Error).message); }
    finally { setDeleting(false); }
  }

  return (
    <>
      <EntityTable
        statusCounts={statusCounts}
        entityLabel="phòng khám"
        title="Phòng khám"
        loading={loading}
        exporting={exporting}
        headers={['Phòng', 'Số phòng', 'Cơ sở', 'Sức chứa', 'Thiết bị', 'Trạng thái', 'Thao tác']}
        rows={rows}
        total={total}
        query={query}
        onQueryChange={onQueryChange}
        onExportFetch={fetchExportRows}
        getRowKey={(r) => r.id}
        hasActiveField
        getIsActive={(r) => r.is_active}
        exportColumns={[
          { key: 'name', label: 'Phòng' },
          { key: 'room_number', label: 'Số phòng' },
          { key: 'facility', label: 'Cơ sở' },
          { key: 'capacity', label: 'Sức chứa' },
          { key: 'equipment', label: 'Thiết bị' },
          { key: 'status', label: 'Trạng thái' },
        ]}
        getExportRow={(r) => ({
          name: r.name,
          room_number: r.room_number ?? '',
          facility: r.facility_name ?? '',
          capacity: String(r.capacity),
          equipment: r.equipment ?? '',
          status: r.is_active ? 'Hoạt động' : 'Vô hiệu',
        })}
        renderRow={(r) => (
          <>
            <td className={cellPrimaryCls}>{r.name}</td>
            <td className={cellMutedCls}>{r.room_number ?? '—'}</td>
            <td className={cellMutedCls}>{r.facility_name}</td>
            <td className={`${cellCls} text-sm`}>{r.capacity}</td>
            <td className={`${cellCls} text-xs text-muted-foreground max-w-[180px] truncate`}>{r.equipment ?? '—'}</td>
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

      <RoomDialog open={open} initial={editing} facilities={facilities} onClose={close} onSaved={reload} />

      <DeleteConfirmDialog
        open={!!deleteTarget}
        name={deleteTarget?.name}
        entityLabel="phòng khám"
        deleting={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </>
  );
}

function RoomDialog({ open, initial, facilities, onClose, onSaved }: {
  open: boolean; initial: Room | null; facilities: Facility[]; onClose: () => void; onSaved: () => void;
}) {
  const blank: Partial<Room> = { name: '', room_number: '', facility_id: '', capacity: 1, equipment: '', is_active: true };
  const [form, setForm] = useState<Partial<Room>>(initial ?? blank);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(initial ?? blank); }, [initial]);

  const setStr = (k: keyof Room) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const setNum = (k: keyof Room) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: Number(e.target.value) }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name?.trim()) { toast.error('Tên phòng không được để trống.'); return; }
    if (!form.facility_id) { toast.error('Vui lòng chọn cơ sở.'); return; }
    setSaving(true);
    try {
      await upsertRoom(form as Room & { name: string; facility_id: string });
      toast.success(form.id ? 'Đã cập nhật phòng.' : 'Đã thêm phòng.');
      onSaved(); onClose();
    } catch (err) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{form.id ? 'Sửa phòng khám' : 'Thêm phòng khám'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <Field label="Cơ sở *">
            <select value={form.facility_id ?? ''} onChange={setStr('facility_id')} className={inputCls}>
              <option value="">-- Chọn cơ sở --</option>
              {facilities.filter((f) => f.is_active).map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Tên phòng *">
            <input value={form.name ?? ''} onChange={setStr('name')} className={inputCls} placeholder="Phòng khám Tim mạch 1" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Số phòng">
              <input value={form.room_number ?? ''} onChange={setStr('room_number')} className={inputCls} placeholder="101" />
            </Field>
            <Field label="Sức chứa">
              <input type="number" min={1} value={form.capacity ?? 1} onChange={setNum('capacity')} className={inputCls} />
            </Field>
          </div>
          <Field label="Thiết bị">
            <input value={form.equipment ?? ''} onChange={setStr('equipment')} className={inputCls} placeholder="ECG, máy đo huyết áp" />
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
