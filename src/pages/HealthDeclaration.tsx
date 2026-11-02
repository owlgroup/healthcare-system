/**
 * Health Declaration Page
 * Shows list of pre-consultation health declaration forms
 */

import TopNav from '@/components/TopNav';
import Sidebar from '@/components/Sidebar';
import HealthDeclarationContent from '@/components/health-declaration/HealthDeclarationContent';

export default function HealthDeclaration() {
  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex-1 lg:ml-[280px] flex flex-col min-h-screen">
        <TopNav />
        <HealthDeclarationContent />
      </div>
    </div>
  );
}
