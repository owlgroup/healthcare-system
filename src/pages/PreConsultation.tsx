/**
 * FR-022: Pre-Consultation Page
 * Patient-facing page for filling health declaration form
 */

import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, CalendarCheck, Check, ClipboardList, Stethoscope, User } from 'lucide-react';
import TopNav from '@/components/TopNav';
import Sidebar from '@/components/Sidebar';
import PreConsultationForm from '@/components/pre-consultation/PreConsultationForm';

const STEPS = [
  { num: 1, label: 'Nhu cầu\nkhám', icon: Stethoscope },
  { num: 2, label: 'Bác sĩ &\nthời gian', icon: User },
  { num: 3, label: 'Đã đặt\nlịch', icon: CalendarCheck },
  { num: 4, label: 'Khai báo\ny tế (Bắt buộc)', icon: ClipboardList },
];

export default function PreConsultation() {
  const [searchParams] = useSearchParams();
  const fromBooking = searchParams.get('from') === 'booking';

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex-1 lg:ml-[280px] flex flex-col min-h-screen">
        <TopNav />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="mx-auto max-w-[1100px]">
            {/* Show stepper when coming from booking */}
            {fromBooking && (
              <>
                {/* Breadcrumb */}
                <button
                  onClick={() => window.history.back()}
                  className="flex items-center gap-2 text-[15px] font-semibold text-slate-500 hover:text-slate-800 mb-5 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Đặt lịch khám bệnh
                </button>

                {/* Stepper */}
                <div className="flex items-center justify-center gap-0 mb-8">
                  {STEPS.map((s, idx) => {
                    const isActive = s.num === 4;
                    const isDone = s.num < 4;
                    const Icon = s.icon;
                    return (
                      <div key={s.num} className="flex items-center flex-1 max-w-[160px]">
                        <div className="flex flex-col items-center gap-2 w-full relative">
                          {idx < STEPS.length - 1 && (
                            <div
                              className={`absolute top-[18px] left-[calc(50%+20px)] w-[calc(100%-40px)] h-0.5 ${
                                isDone ? 'bg-teal-600' : 'bg-slate-200'
                              }`}
                            />
                          )}
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
              </>
            )}

            <PreConsultationForm />
          </div>
        </main>
      </div>
    </div>
  );
}
