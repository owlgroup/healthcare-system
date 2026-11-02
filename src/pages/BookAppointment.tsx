import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, Stethoscope, User, CalendarCheck, ClipboardList } from 'lucide-react';
import TopNav from '@/components/TopNav';
import Sidebar from '@/components/Sidebar';
import BookingStep1 from '@/components/patient/booking/BookingStep1';
import BookingStep2 from '@/components/patient/booking/BookingStep2';
import BookingStep3 from '@/components/patient/booking/BookingStep3';
import type { Specialty, AppointmentSlot } from '@/types/appointment';
import { useAuth } from '@/hooks/use-auth';
import {
  bookingBlockedMessage,
  canPatientSelfBook,
  fetchPatientProfile,
} from '@/lib/appointment-api';

type Doctor = {
  id: string;
  name: string;
  title: string;
  specialties: string;
  location: string;
  nextAvailable: string;
  avatarColor: string;
  initials: string;
};

type BookingState = {
  specialty: Specialty | null;
  date: Date | null;
  slot: AppointmentSlot | null;
  doctor: Doctor | null;
};

const STEPS = [
  { num: 1, label: 'Nhu cầu\nkhám', icon: Stethoscope },
  { num: 2, label: 'Bác sĩ &\nthời gian', icon: User },
  { num: 3, label: 'Xác nhận\nđặt lịch', icon: CalendarCheck },
  { num: 4, label: 'Khai báo\ny tế (Bắt buộc)', icon: ClipboardList },
];

const BookAppointment = () => {
  const navigate = useNavigate();
  const { session, isLoading: authLoading } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [booking, setBooking] = useState<BookingState>({
    specialty: null,
    date: null,
    slot: null,
    doctor: null,
  });
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!session?.user.id) {
      setProfileStatus(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    fetchPatientProfile(session.user.id)
      .then((profile) => setProfileStatus(profile?.status ?? null))
      .finally(() => setProfileLoading(false));
  }, [session?.user.id, authLoading]);

  const canBook = canPatientSelfBook(profileStatus);

  function handleSpecialtySelected(specialty: Specialty) {
    setBooking((b) => ({ ...b, specialty }));
    setStep(2);
  }

  function handleDateSlotSelected(date: Date, slot: AppointmentSlot, doctor: Doctor | null) {
    setBooking((b) => ({ ...b, date, slot, doctor }));
    setStep(3);
  }

  function handleBack() {
    if (step === 1) navigate('/appointments');
    else setStep((s) => (s - 1) as 1 | 2 | 3);
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex-1 lg:ml-[280px] flex flex-col min-h-screen">
        <TopNav />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className={`mx-auto ${step === 1 ? 'max-w-[720px]' : 'max-w-[1100px]'}`}>
            {/* Breadcrumb */}
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-[15px] font-semibold text-slate-500 hover:text-slate-800 mb-5 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Đặt lịch khám bệnh
            </button>

            {/* Stepper */}
            <div className="flex items-center justify-center gap-0 mb-8">
              {STEPS.map((s, idx) => {
                const isActive = s.num === step;
                const isDone = s.num < step;
                const Icon = s.icon;
                return (
                  <div key={s.num} className="flex items-center flex-1 max-w-[160px]">
                    <div className="flex flex-col items-center gap-2 w-full relative">
                      {/* Connector line */}
                      {idx < STEPS.length - 1 && (
                        <div
                          className={`absolute top-[18px] left-[calc(50%+20px)] w-[calc(100%-40px)] h-0.5 ${
                            isDone ? 'bg-teal-600' : 'bg-slate-200'
                          }`}
                        />
                      )}
                      {/* Circle */}
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold z-10 transition-all ${
                          isActive
                            ? 'bg-teal-600 text-white border-2 border-teal-600'
                            : isDone
                            ? 'bg-teal-600 text-white border-2 border-teal-600'
                            : 'bg-white text-slate-400 border-2 border-slate-200'
                        }`}
                      >
                        {isDone ? (
                          <Check className="h-4 w-4" />
                        ) : isActive ? (
                          <Icon className="h-4 w-4" />
                        ) : (
                          s.num
                        )}
                      </div>
                      {/* Label */}
                      <span
                        className={`text-[11.5px] font-semibold text-center leading-tight whitespace-pre-line ${
                          isActive || isDone ? 'text-teal-600' : 'text-slate-400'
                        }`}
                      >
                        {s.num}. {s.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Content */}
            <div>
              {profileLoading || authLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
                </div>
              ) : !canBook ? (
                <div className="rounded-[18px] border border-amber-200 bg-amber-50 p-6 text-center">
                  <p className="text-sm font-medium text-slate-800">
                    {bookingBlockedMessage()}
                  </p>
                </div>
              ) : (
                <>
                  {step === 1 && (
                    <BookingStep1 onSelect={handleSpecialtySelected} />
                  )}
                  {step === 2 && booking.specialty && (
                    <BookingStep2
                      specialty={booking.specialty}
                      onSelect={handleDateSlotSelected}
                      onBack={() => setStep(1)}
                    />
                  )}
                  {step === 3 &&
                    booking.specialty &&
                    booking.date &&
                    booking.slot && (
                      <BookingStep3
                        specialty={booking.specialty}
                        date={booking.date}
                        slot={booking.slot}
                        doctor={booking.doctor}
                        onBack={() => setStep(2)}
                        onEditSpecialty={() => setStep(1)}
                        onEditDateTime={() => setStep(2)}
                      />
                    )}
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default BookAppointment;
