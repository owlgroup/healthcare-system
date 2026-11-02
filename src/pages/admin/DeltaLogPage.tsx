import { useState } from 'react';
import { ScrollText } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppointmentsAuditTab from '@/components/admin/delta-log/AppointmentsAuditTab';
import SystemAuditTab from '@/components/admin/delta-log/SystemAuditTab';
import MasterDataAuditTab from '@/components/admin/delta-log/MasterDataAuditTab';
import SignatureLogTab from '@/components/admin/delta-log/SignatureLogTab';
import DoctorExamActivityLogTab from '@/components/provider/medical-history/DoctorExamActivityLogTab';
import { listAdminExaminationActivityLog } from '@/lib/delta-log-api';
import { cn } from '@/lib/utils';

const TABS = [
  { value: 'appointments', label: 'Lịch sử khám bệnh' },
  { value: 'exam-activity', label: 'Nhật ký hồ sơ' },
  { value: 'system', label: 'Hệ thống' },
  { value: 'master-data', label: 'Danh mục' },
  { value: 'signatures', label: 'Chữ ký số' },
];

const tabTriggerClass = cn(
  'relative rounded-none border-0 border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-semibold text-muted-foreground shadow-none',
  'hover:text-foreground hover:bg-transparent',
  'data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none',
);

export default function DeltaLogPage() {
  const [activeTab, setActiveTab] = useState('appointments');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-0 space-y-6">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          Hệ thống <span className="text-muted-foreground/60 mx-1">›</span> Nhật ký
        </p>
        <div className="flex items-start gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-accent flex items-center justify-center text-primary shrink-0">
            <ScrollText className="h-5 w-5 md:h-6 md:w-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">Nhật ký hệ thống</h1>
            <p className="text-xs md:text-sm text-muted-foreground mt-1 max-w-2xl">
              Theo dõi các hoạt động và thay đổi trong hệ thống — Lịch hẹn, Người dùng, Danh mục, Chữ ký số
            </p>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border/30 shadow-sm overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-0">
          <div className="border-b border-border/30 overflow-x-auto">
            <TabsList className="flex h-auto min-w-max w-full justify-start gap-0 rounded-none bg-transparent p-0 px-2 md:px-4">
              {TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value} className={tabTriggerClass}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="appointments" className="mt-0">
            <AppointmentsAuditTab embedded />
          </TabsContent>
          <TabsContent value="exam-activity" className="mt-0">
            <DoctorExamActivityLogTab
              listLogs={listAdminExaminationActivityLog}
              showDoctorColumn
              portalToolbar
              embedded
            />
          </TabsContent>
          <TabsContent value="system" className="mt-0">
            <SystemAuditTab embedded />
          </TabsContent>
          <TabsContent value="master-data" className="mt-0">
            <MasterDataAuditTab embedded />
          </TabsContent>
          <TabsContent value="signatures" className="mt-0">
            <SignatureLogTab embedded />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
