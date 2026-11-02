/**
 * FR-022: Pre-Consultation Form Component
 * Multi-step form for health declaration before appointment
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  Clock,
  Home,
  Hospital,
  MapPin,
  RotateCw,
  User,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Check,
  Save,
  AlertCircle,
  FileText,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { usePreConsultationForm } from '@/hooks/usePreConsultationForm';
import { fetchMyAppointments } from '@/lib/appointment-api';
import type { Appointment } from '@/types/appointment';
import { STEP_LABELS, STEP_NUMBERS } from '@/types/pre-consultation';

import SymptomsStep from './steps/SymptomsStep';
import MedicalHistoryStep from './steps/MedicalHistoryStep';
import MedicationsStep from './steps/MedicationsStep';
import AllergiesStep from './steps/AllergiesStep';
import LifestyleStep from './steps/LifestyleStep';
import BookingIntakeForm, { type IntakeFormData } from '@/components/patient/booking/BookingIntakeForm';

export default function PreConsultationForm() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromBooking = searchParams.get('from') === 'booking';
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loadingAppointment, setLoadingAppointment] = useState(true);

  // Load appointment info
  useEffect(() => {
    async function loadAppointment() {
      if (!appointmentId) return;

      try {
        const appointments = await fetchMyAppointments();
        const apt = appointments.find((a) => a.id === appointmentId);
        if (apt) {
          setAppointment(apt);
        } else {
          toast.error('Không tìm thấy lịch hẹn');
          navigate('/appointments');
        }
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setLoadingAppointment(false);
      }
    }

    loadAppointment();
  }, [appointmentId, navigate]);

  // Pre-consultation form hook
  const form = usePreConsultationForm(appointmentId ?? '');

  // Handle simplified booking intake form submission
  async function handleBookingIntakeSubmit(data: IntakeFormData) {
    form.updateField('chief_complaint', data.chief_complaint);
    form.updateField('symptom_duration', data.symptom_duration);
    form.updateField('pain_level', data.pain_level);
    form.updateField('current_medications', data.current_medications);
    form.updateField('allergies', data.allergies);
    await form.submit();
  }

  // Loading state
  if (loadingAppointment || form.loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Simplified booking intake form
  if (fromBooking && appointment && !form.isSubmitted) {
    return (
      <BookingIntakeForm
        appointment={appointment}
        onSubmit={handleBookingIntakeSubmit}
        onBack={() => navigate('/appointments')}
      />
    );
  }

  // Error state
  if (form.error) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{form.error}</AlertDescription>
        </Alert>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => navigate('/appointments')}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Quay lại lịch hẹn
        </Button>
      </div>
    );
  }

  // Already submitted state
  if (form.isSubmitted) {
    // Show full booking success screen if came from booking flow
    if (fromBooking && appointment) {
      return (
        <div className="max-w-[680px] mx-auto p-4">
          <div className="bg-white border border-slate-200 rounded-[18px] p-8 shadow-sm">
            <div className="text-center py-5">
              {/* Success icon */}
              <div
                className="w-[88px] h-[88px] rounded-full bg-emerald-50 border-[3px] border-emerald-300 flex items-center justify-center mx-auto mb-5"
                style={{ animation: 'successPop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' }}
              >
                <CalendarCheck className="h-[38px] w-[38px] text-emerald-600" />
              </div>

              <h1 className="text-[28px] font-bold text-slate-800 mb-1.5 tracking-[-0.5px]">
                Đặt lịch thành công! 🎉
              </h1>
              <p className="text-slate-500 text-base mb-7">
                Lịch hẹn khám đã được xác nhận. Mã lịch hẹn:{' '}
                <strong className="text-slate-800 text-[17px]">
                  #{appointment.id.slice(0, 8).toUpperCase()}
                </strong>
              </p>

              {/* Appointment card */}
              <div className="bg-teal-50 border-[1.5px] border-teal-200 rounded-[18px] p-[22px_24px] text-left mb-6">
                <div className="flex items-center gap-2 flex-wrap mb-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-bold bg-emerald-100 text-emerald-700">
                    <Check className="h-3.5 w-3.5" />
                    Đã xác nhận
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-bold bg-emerald-100 text-emerald-700">
                    <ClipboardList className="h-3.5 w-3.5" />
                    Đã gửi phiếu khai báo y tế
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-bold bg-slate-100 text-slate-600">
                    <Hospital className="h-3.5 w-3.5" />
                    Khám trực tiếp
                  </span>
                </div>

                <div className="space-y-0">
                  <div className="flex gap-[10px] py-[10px] border-b border-teal-200">
                    <div className="w-5 text-teal-600 flex-shrink-0 mt-0.5">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="text-[13px] text-slate-500">Dịch vụ khám</div>
                      <div className="font-bold text-[16px] text-slate-800">
                        {appointment.specialty_name}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-[10px] py-[10px] border-b border-teal-200">
                    <div className="w-5 text-teal-600 flex-shrink-0 mt-0.5">
                      <CalendarDays className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="text-[13px] text-slate-500">Ngày & Giờ khám</div>
                      <div className="font-bold text-[18px] text-teal-600">
                        {appointment.slot_date
                          ? format(parseISO(appointment.slot_date), 'EEEE, dd/MM/yyyy', { locale: vi })
                          : ''}{' '}
                        — {appointment.start_time?.slice(0, 5)}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-[10px] py-[10px]">
                    <div className="w-5 text-teal-600 flex-shrink-0 mt-0.5">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="text-[13px] text-slate-500">Địa điểm khám</div>
                      <div className="font-bold text-[16px] text-slate-800">
                        Phòng khám RCARE Quận 3
                      </div>
                      <div className="text-[13.5px] text-slate-500">
                        128 Nguyễn Đình Chiểu, P. Võ Thị Sáu, Q3
                      </div>
                    </div>
                  </div>
                </div>

                {/* Checklist */}
                <div className="bg-white rounded-lg p-[14px_16px] mt-3">
                  <div className="text-[14.5px] font-bold text-slate-800 mb-2.5 flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-teal-600" />
                    Bạn cần chuẩn bị gì?
                  </div>
                  <div className="text-[14px] text-slate-700 flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      Mang theo CCCD gốc hoặc bản sao
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      Kết quả xét nghiệm gần nhất (nếu có)
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-500 flex-shrink-0" />
                      Có mặt <strong>trước 15 phút</strong> để hoàn thành thủ tục
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons grid */}
              <div className="grid grid-cols-2 gap-[10px] mb-4">
                <button
                  onClick={() => navigate('/appointments')}
                  className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-3 rounded-[10px] text-[15px] font-semibold transition-colors min-h-[48px] cursor-pointer"
                >
                  <CalendarCheck className="h-4 w-4" />
                  Xem chi tiết lịch hẹn
                </button>
                <button
                  onClick={() => toast.info('Đã thêm vào Google Calendar / iCal')}
                  className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-3 rounded-[10px] text-[15px] font-semibold transition-colors min-h-[48px] cursor-pointer"
                >
                  <CalendarPlus className="h-4 w-4" />
                  Thêm vào lịch cá nhân
                </button>
                <button
                  onClick={() => toast.info('Mở giao diện đổi lịch...')}
                  className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-3 rounded-[10px] text-[15px] font-semibold transition-colors min-h-[48px] cursor-pointer"
                >
                  <RotateCw className="h-4 w-4" />
                  Đổi lịch khám
                </button>
                <button
                  onClick={() => toast.info('Mở giao diện hủy lịch...')}
                  className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-red-500 border border-slate-200 px-4 py-3 rounded-[10px] text-[15px] font-semibold transition-colors min-h-[48px] cursor-pointer"
                >
                  <X className="h-4 w-4" />
                  Hủy lịch này
                </button>
              </div>

              <button
                onClick={() => navigate('/')}
                className="inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-9 py-3.5 rounded-full text-[17px] font-semibold transition-all min-h-[52px] cursor-pointer"
              >
                <Home className="h-4 w-4" />
                Quay về Trang chủ
              </button>
            </div>
          </div>

          <style>{`
            @keyframes successPop {
              0% { transform: scale(0.6); opacity: 0; }
              100% { transform: scale(1); opacity: 1; }
            }
          `}</style>
        </div>
      );
    }

    // Simple submitted message for existing appointments
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Card className="text-center py-12">
          <CardContent>
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">
              Phiếu khai báo đã được gửi
            </h2>
            <p className="text-muted-foreground mb-6">
              Cảm ơn bạn đã hoàn thành khai báo y tế trước khám. Bác sĩ sẽ xem
              thông tin này trước khi tiến hành khám.
            </p>
            <Button onClick={() => navigate('/appointments')}>
              Quay lại lịch hẹn
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const dateLabel = appointment?.slot_date
    ? format(parseISO(appointment.slot_date), "EEEE, dd/MM/yyyy 'lúc' HH:mm", {
        locale: vi,
      })
    : '';

  // Render current step
  function renderStep() {
    switch (form.currentStep) {
      case 'symptoms':
        return (
          <SymptomsStep
            formData={form.formData}
            updateField={form.updateField}
            validationErrors={form.validationErrors}
          />
        );
      case 'medical_history':
        return (
          <MedicalHistoryStep
            formData={form.formData}
            updateField={form.updateField}
            updateFields={form.updateFields}
          />
        );
      case 'medications':
        return (
          <MedicationsStep
            formData={form.formData}
            updateField={form.updateField}
            updateFields={form.updateFields}
            validationErrors={form.validationErrors}
          />
        );
      case 'allergies':
        return (
          <AllergiesStep
            formData={form.formData}
            updateField={form.updateField}
            updateFields={form.updateFields}
            validationErrors={form.validationErrors}
          />
        );
      case 'lifestyle':
        return (
          <LifestyleStep
            formData={form.formData}
            updateField={form.updateField}
            validationErrors={form.validationErrors}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-4 pb-24">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary mb-2">
          KHAI BÁO Y TẾ TRƯỚC KHÁM
        </h1>

        {/* Appointment Info Card */}
        <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="py-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <CalendarDays className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-primary">
                    Lịch: {appointment?.slot_date
                      ? format(parseISO(appointment.slot_date), 'dd/MM/yyyy', { locale: vi })
                      : ''}{' '}
                    {appointment?.start_time?.slice(0, 5)} - {appointment?.specialty_name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Vui lòng hoàn thành tờ khai để bác sĩ nắm rõ tình trạng của bạn
                    trước khi bắt đầu buổi khám.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold text-primary">
                  Hồ sơ y tế
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold text-primary uppercase tracking-wider">
            Phần {STEP_NUMBERS[form.currentStep]}/5:{' '}
            {STEP_LABELS[form.currentStep]}
          </p>
          <p className="text-sm text-muted-foreground">
            {Math.round(form.progress)}% Hoàn thành
          </p>
        </div>
        <Progress value={form.progress} className="h-2" />
      </div>

      {/* Auto-save indicator */}
      <div className="flex items-center gap-2 text-xs mb-4 min-h-[1.25rem]">
        {form.draftSaveStatus === 'saving' && (
          <>
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Đang lưu...</span>
          </>
        )}
        {form.draftSaveStatus === 'saved' && form.lastSavedAt && (
          <>
            <Check className="h-3 w-3 text-green-600" />
            <span className="text-green-700 font-medium">Đã lưu thành công</span>
            <span className="text-muted-foreground">
              ({formatDistanceToNow(form.lastSavedAt, { locale: vi, addSuffix: true })})
            </span>
          </>
        )}
        {form.draftSaveStatus === 'error' && (
          <>
            <AlertCircle className="h-3 w-3 text-amber-600" />
            <span className="text-amber-700">Không thể lưu tự động. Vui lòng thử lại.</span>
          </>
        )}
      </div>

      {/* Step Content */}
      <Card className="mb-6">
        <CardContent className="pt-6">{renderStep()}</CardContent>
      </Card>

      {/* Navigation Buttons - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="flex flex-col gap-0.5 flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => void form.saveDraft()}
              disabled={form.saving || form.submitting}
            >
              {form.saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Lưu nháp
            </Button>
            {form.draftSaveStatus === 'saved' && form.lastSavedAt && !form.saving && (
              <span className="text-[10px] text-green-600 pl-1">Đã lưu tự động</span>
            )}
          </div>

          <div className="flex-1" />

          {form.canGoPrev && (
            <Button
              variant="outline"
              onClick={() => void form.goToPrevStep()}
              disabled={form.submitting || form.saving}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Quay lại
            </Button>
          )}

          {form.canGoNext ? (
            <Button
              onClick={() => void form.goToNextStep()}
              disabled={form.submitting || form.saving || !form.isCurrentStepValid}
            >
              Tiếp tục
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={async () => {
                const result = await form.submit();
                if (result) {
                  // Successfully submitted, will show success state
                }
              }}
              disabled={form.submitting || !form.isCurrentStepValid}
              className="bg-primary hover:bg-primary/90"
            >
              {form.submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Đang gửi...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Hoàn tất
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
