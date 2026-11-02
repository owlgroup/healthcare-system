import { useEffect, useState } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  listDoctorSchedulesAdmin, upsertDoctorSchedule, deleteDoctorSchedule,
  fetchDoctors, fetchSpecialtiesAdmin, fetchFacilities, fetchRooms,
  triggerSlotGeneration,
} from '@/lib/master-data-api';
import type { DoctorSchedule, Doctor, Facility, Room } from '@/types/master-data';
import type { Specialty } from '@/types/master-data';
import { formatWorkDays, formatTime, DOW_LABELS } from '@/types/master-data';
import { useRegisterAddAction } from './MasterDataActionsContext';
import { EntityTable, ActiveBadge, RowActions, useToggleActive, ActiveStatusField, DeleteConfirmDialog, Field, FormActions, inputCls, useEntityDialog, useEntityTableData, cellPrimaryCls, cellMutedCls, cellCls } from './shared';

export default function DoctorSchedulesTab() {
  const {
    rows, total, loading, exporting, statusCounts, query, onQueryChange, reload, fetchExportRows,
  } = useEntityTableData(listDoctorSchedulesAdmin, 6, 'schedules');
  const { togglingId, toggle } = useToggleActive(upsertDoctorSchedule, reload);
  const [doctors, setDoctors]   = useState<Doctor[]>([]);
  const [specialties, setSpec]  = useState<Specialty[]>([]);
  const [facilities, setFac]    = useState<Facility[]>([]);
  const [rooms, setRooms]       = useState<Room[]>([]);
  const [generating, setGen]    = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DoctorSchedule | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { open, editing, openAdd, openEdit, close } = useEntityDialog<DoctorSchedule>();

  useRegisterAddAction('schedules', 'Thêm Lịch BS', openAdd);

  useEffect(() => {
    Promise.all([
      fetchDoctors(),
      fetchSpecialtiesAdmin(),
      fetchFacilities(),
      fetchRooms(),
    ])
      .then(([d, s, f, rm]) => { setDoctors(d); setSpec(s); setFac(f); setRooms(rm); })
      .catch((e: Error) => toast.error(e.message));
  }, []);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDoctorSchedule(deleteTarget.id);
      toast.success('Đã xóa lịch làm việc.');
      setDeleteTarget(null);
      reload();
    } catch (e) { toast.error((e as Error).message); }
    finally { setDeleting(false); }
  }

  async function handleGenerateSlots() {
    setGen(true);
    try {
      const result = await triggerSlotGeneration();
      toast.success(`Đã tạo ${result.slots_created} khung giờ cho 30 ngày tới.`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setGen(false); }
  }

  return (
    <>
      <EntityTable
        statusCounts={statusCounts}
        entityLabel="lịch làm việc"
        title="Lịch BS"
        loading={loading}
        exporting={exporting}
        headers={['Bác sĩ', 'Chuyên khoa', 'Cơ sở / Phòng', 'Ngày làm việc', 'Giờ', '(phút)', 'Trạng thái', 'Thao tác']}
        rows={rows}
        total={total}
        query={query}
        onQueryChange={onQueryChange}
        onExportFetch={fetchExportRows}
        getRowKey={(r) => r.id}
        hasActiveField
        getIsActive={(r) => r.is_active}
        exportColumns={[
          { key: 'doctor', label: 'Bác sĩ' },
          { key: 'specialty', label: 'Chuyên khoa' },
          { key: 'facility', label: 'Cơ sở / Phòng' },
          { key: 'work_days', label: 'Ngày làm việc' },
          { key: 'hours', label: 'Giờ' },
          { key: 'duration', label: 'Phút/slot' },
          { key: 'status', label: 'Trạng thái' },
        ]}
        getExportRow={(r) => ({
          doctor: r.doctor_name ?? '',
          specialty: r.specialty_name ?? '',
          facility: [r.facility_name, r.room_name].filter(Boolean).join(' / '),
          work_days: formatWorkDays(r.work_days),
          hours: `${formatTime(r.work_start_time)} – ${formatTime(r.work_end_time)}`,
          duration: String(r.slot_duration_minutes),
          status: r.is_active ? 'Hoạt động' : 'Vô hiệu',
        })}
        // toolbarExtra={
        //   <button
        //     type="button"
        //     onClick={handleGenerateSlots}
        //     disabled={generating}
        //     className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50"
        //     title="Khung giờ được sinh tự động hàng đêm lúc 00:00"
        //   >
        //     {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        //     Sinh slot
        //   </button>
        // }
        renderRow={(r) => (
          <>
            <td className={cellPrimaryCls}>{r.doctor_name}</td>
            <td className={cellMutedCls}>{r.specialty_name}</td>
            <td className={cellMutedCls}>
              <p>{r.facility_name}</p>
              {r.room_name && <p className="text-xs">{r.room_name}</p>}
            </td>
            <td className={`${cellCls} text-sm`}>{formatWorkDays(r.work_days)}</td>
            <td className={`${cellCls} text-sm`}>{formatTime(r.work_start_time)} – {formatTime(r.work_end_time)}</td>
            <td className={`${cellCls} text-sm`}>{r.slot_duration_minutes}'</td>
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

      <ScheduleDialog
        open={open}
        initial={editing}
        doctors={doctors}
        specialties={specialties}
        facilities={facilities}
        rooms={rooms}
        onClose={close}
        onSaved={reload}
      />

      <DeleteConfirmDialog
        open={!!deleteTarget}
        name={deleteTarget?.doctor_name}
        entityLabel="lịch làm việc"
        deleting={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </>
  );
}

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 0] as const;

function ScheduleDialog({
  open, initial, doctors, specialties, facilities, rooms, onClose, onSaved,
}: {
  open: boolean;
  initial: DoctorSchedule | null;
  doctors: Doctor[];
  specialties: Specialty[];
  facilities: Facility[];
  rooms: Room[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const blank = {
    doctor_id: '', specialty_id: '', facility_id: '', room_id: null,
    work_days: [1, 2, 3, 4, 5] as number[],
    work_start_time: '08:00', work_end_time: '17:00',
    slot_duration_minutes: 30,
    exceptions: [] as string[],
    valid_from: format(new Date(), 'yyyy-MM-dd'),
    valid_until: null as string | null,
    is_active: true,
  };
  const [form, setForm] = useState(initial ? toForm(initial) : blank);
  const [saving, setSaving] = useState(false);
  const [exceptionInput, setExceptionInput] = useState('');

  useEffect(() => { setForm(initial ? toForm(initial) : blank); setExceptionInput(''); }, [initial]);

  function toForm(s: DoctorSchedule) {
    return {
      id:                   s.id,
      doctor_id:            s.doctor_id,
      specialty_id:         s.specialty_id,
      facility_id:          s.facility_id,
      room_id:              s.room_id,
      work_days:            [...s.work_days],
      work_start_time:      s.work_start_time.slice(0, 5),
      work_end_time:        s.work_end_time.slice(0, 5),
      slot_duration_minutes: s.slot_duration_minutes,
      exceptions:           [...s.exceptions],
      valid_from:           s.valid_from,
      valid_until:          s.valid_until,
      is_active:            s.is_active,
    };
  }

  function toggleDay(d: number) {
    setForm((f) => ({
      ...f,
      work_days: f.work_days.includes(d) ? f.work_days.filter((x) => x !== d) : [...f.work_days, d],
    }));
  }

  function addException() {
    const v = exceptionInput.trim();
    if (!v) return;
    if (!form.exceptions.includes(v)) setForm((f) => ({ ...f, exceptions: [...f.exceptions, v] }));
    setExceptionInput('');
  }

  function removeException(ex: string) {
    setForm((f) => ({ ...f, exceptions: f.exceptions.filter((e) => e !== ex) }));
  }

  const filteredRooms = rooms.filter((r) => r.facility_id === form.facility_id && r.is_active);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.doctor_id)    { toast.error('Chọn bác sĩ.'); return; }
    if (!form.specialty_id) { toast.error('Chọn chuyên khoa.'); return; }
    if (!form.facility_id)  { toast.error('Chọn cơ sở.'); return; }
    if (form.work_days.length === 0) { toast.error('Chọn ít nhất 1 ngày làm việc.'); return; }
    setSaving(true);
    try {
      await upsertDoctorSchedule(form as Parameters<typeof upsertDoctorSchedule>[0]);
      toast.success(form.id ? 'Đã cập nhật lịch.' : 'Đã thêm lịch làm việc.');
      onSaved(); onClose();
    } catch (err) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{form.id ? 'Sửa lịch làm việc' : 'Thêm lịch làm việc'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <Field label="Bác sĩ *">
            <select value={form.doctor_id} onChange={(e) => setForm((f) => ({ ...f, doctor_id: e.target.value }))} className={inputCls}>
              <option value="">-- Chọn bác sĩ --</option>
              {doctors.map((d) => <option key={d.user_id} value={d.user_id}>{d.full_name ?? d.email}</option>)}
            </select>
          </Field>
          <Field label="Chuyên khoa *">
            <select value={form.specialty_id} onChange={(e) => setForm((f) => ({ ...f, specialty_id: e.target.value }))} className={inputCls}>
              <option value="">-- Chọn chuyên khoa --</option>
              {specialties.filter((s) => s.is_active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Cơ sở *">
            <select value={form.facility_id} onChange={(e) => setForm((f) => ({ ...f, facility_id: e.target.value, room_id: null }))} className={inputCls}>
              <option value="">-- Chọn cơ sở --</option>
              {facilities.filter((f) => f.is_active).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </Field>
          {filteredRooms.length > 0 && (
            <Field label="Phòng khám">
              <select value={form.room_id ?? ''} onChange={(e) => setForm((f) => ({ ...f, room_id: e.target.value || null }))} className={inputCls}>
                <option value="">-- Không chỉ định --</option>
                {filteredRooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </Field>
          )}

          {/* Days of week */}
          <Field label="Ngày làm việc *">
            <div className="flex gap-2 flex-wrap">
              {ALL_DAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold border transition-colors ${
                    form.work_days.includes(d)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-foreground border-muted-foreground/30 hover:border-primary'
                  }`}
                >
                  {DOW_LABELS[d]}
                </button>
              ))}
            </div>
          </Field>

          {/* Hours + slot duration */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Giờ bắt đầu">
              <input type="time" value={form.work_start_time} onChange={(e) => setForm((f) => ({ ...f, work_start_time: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="Giờ kết thúc">
              <input type="time" value={form.work_end_time} onChange={(e) => setForm((f) => ({ ...f, work_end_time: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="(phút)">
              <input type="number" min={5} max={120} step={5} value={form.slot_duration_minutes} onChange={(e) => setForm((f) => ({ ...f, slot_duration_minutes: Number(e.target.value) }))} className={inputCls} />
            </Field>
          </div>

          {/* Valid range */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Hiệu lực từ">
              <input type="date" value={form.valid_from} onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="Hết hạn (để trống = vô thời hạn)">
              <input type="date" value={form.valid_until ?? ''} onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value || null }))} className={inputCls} />
            </Field>
          </div>

          {/* Exception dates */}
          <Field label="Ngày nghỉ">
            <div className="flex gap-2 mb-2">
              <input
                type="date"
                value={exceptionInput}
                onChange={(e) => setExceptionInput(e.target.value)}
                className={`${inputCls} flex-1`}
              />
              <button type="button" onClick={addException} className="rounded-lg border px-3 text-xs font-bold hover:bg-muted whitespace-nowrap">
                + Thêm
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {form.exceptions.map((ex) => (
                <span key={ex} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
                  {ex}
                  <button type="button" onClick={() => removeException(ex)} className="text-muted-foreground hover:text-destructive">✕</button>
                </span>
              ))}
              {form.exceptions.length === 0 && <span className="text-xs text-muted-foreground">Không có ngày nghỉ.</span>}
            </div>
          </Field>

          <ActiveStatusField
            value={form.is_active}
            onChange={(is_active) => setForm((f) => ({ ...f, is_active }))}
          />

          <FormActions saving={saving} onCancel={onClose} editMode={!!form.id} />
        </form>
      </DialogContent>
    </Dialog>
  );
}
