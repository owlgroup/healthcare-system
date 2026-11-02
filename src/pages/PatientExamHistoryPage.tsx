import TopNav from '@/components/TopNav';
import Sidebar from '@/components/Sidebar';
import PatientExamHistoryContent from '@/components/patient/PatientExamHistoryContent';

export default function PatientExamHistoryPage() {
  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      {/* Fixed Sidebar */}
      <Sidebar />

      {/* Main area - offset by sidebar width */}
      <div className="flex-1 lg:ml-[280px] flex flex-col min-h-screen">
        <TopNav />
        <main className="flex-1 p-4 md:p-8">
          <PatientExamHistoryContent />
        </main>
      </div>
    </div>
  );
}
