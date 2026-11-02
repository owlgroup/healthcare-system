/**
 * FR-010: Examination Page — SOAP Note Editor
 * Route: /provider-portal/examination/:appointmentId (nested in ProviderLayout)
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { fetchDoctorAppointments } from '@/lib/doctor-appointment-api';
import { fetchAdminAppointments } from '@/lib/admin-appointment-api';
import {
  getAppointmentReadiness,
  getAppointmentReadinessMessage,
  isAppointmentReadyForExam,
} from '@/lib/appointment-readiness';
import type { AdminAppointment } from '@/types/admin-appointment';
import SoapNoteEditor from '@/components/emr/SoapNoteEditor';
import { format, parseISO } from 'date-fns';
import { UI_WALK_IN } from "@/config/ui-labels";
import { vi } from 'date-fns/locale';
import { ADMIN_STATUS_LABEL } from '@/types/admin-appointment';

export default function ExaminationPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminPortal = location.pathname.startsWith('/admin');
  const appointmentsPath = isAdminPortal ? '/admin/appointments' : '/provider-portal/appointments';
  const [appointment, setAppointment] = useState<AdminAppointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!appointmentId) return;
    void (async () => {
      setLoading(true);
      try {
        const fetchAppointments = isAdminPortal ? fetchAdminAppointments : fetchDoctorAppointments;
        const all = await fetchAppointments({});
        const appt = all.find((a) => a.id === appointmentId);
        if (!appt) {
          setError('Không tìm thấy lịch hẹn.');
        } else if (!['CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'].includes(appt.status)) {
          setError(
            `Lịch hẹn có trạng thái "${ADMIN_STATUS_LABEL[appt.status]}" — cần tiếp nhận trước khi khám.`
          );
        } else if (appt.status !== 'COMPLETED' && !isAppointmentReadyForExam(appt)) {
          setError(getAppointmentReadinessMessage(getAppointmentReadiness(appt)));
        } else {
          setAppointment(appt);
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [appointmentId, isAdminPortal]);

  const slotLabel = appointment?.slot_date
    ? format(parseISO(appointment.slot_date), 'dd/MM/yyyy', { locale: vi })
    : UI_WALK_IN;
  const timeLabel = appointment?.start_time ? appointment.start_time.slice(0, 5) : '';

  const patientInfo = appointment
    ? {
        name: appointment.patient_name ?? 'Bệnh nhân',
        phone: appointment.patient_phone ?? undefined,
        age: appointment.patient_dob
          ? String(new Date().getFullYear() - new Date(appointment.patient_dob).getFullYear())
          : undefined,
      }
    : undefined;

  const scheduleLabel = timeLabel ? `${timeLabel} · ${slotLabel}` : slotLabel;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      {/* ── Content ── */}
      <div className="flex-1 overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {!loading && (error || !appointmentId) && (
          <div className="max-w-2xl mx-auto p-6 space-y-4 pt-10">
            <Alert variant="destructive">
              <AlertDescription>{error || 'Không tìm thấy lịch hẹn.'}</AlertDescription>
            </Alert>
            <Button variant="outline" onClick={() => navigate(appointmentsPath)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Quay lại lịch hẹn
            </Button>
          </div>
        )}

        {!loading && !error && appointment && appointmentId && (
          <SoapNoteEditor
            appointmentId={appointmentId}
            patient={patientInfo}
            scheduleLabel={scheduleLabel}
            specialty={appointment.specialty_name ?? undefined}
            statusLabel={appointment.status === 'COMPLETED' ? ADMIN_STATUS_LABEL.COMPLETED : 'Đang khám'}
            onBack={() => navigate(appointmentsPath)}
          />
        )}
      </div>
    </div>
  );
}
