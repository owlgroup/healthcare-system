import DoctorMedicalHistoryTab from '@/components/provider/medical-history/DoctorMedicalHistoryTab';

export default function DoctorMedicalHistoryPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-0 flex flex-col gap-3">
      <h1 className="text-lg font-semibold text-foreground">Lịch sử khám bệnh</h1>
      <DoctorMedicalHistoryTab />
    </div>
  );
}
