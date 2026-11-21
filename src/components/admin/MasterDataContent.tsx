import { useEffect, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  listDoctorSchedulesAdmin,
  listFacilitiesAdmin,
  listQuestionCategoriesAdmin,
  listRoomsAdmin,
  listServicesAdmin,
  listSpecialtiesAdmin,
} from '@/lib/master-data-api';
import type { MasterDataListParams, MasterDataListResult } from '@/types/master-data';
import SpecialtiesTab   from './master-data/SpecialtiesTab';
import ServicesTab      from './master-data/ServicesTab';
import FacilitiesTab    from './master-data/FacilitiesTab';
import RoomsTab         from './master-data/RoomsTab';
import DoctorSchedulesTab from './master-data/DoctorSchedulesTab';
import CategoriesTab    from './master-data/CategoriesTab';
import {
  MasterDataActionsProvider,
  useMasterDataActions,
} from './master-data/MasterDataActionsContext';

type ListFn = (params: MasterDataListParams) => Promise<MasterDataListResult<unknown>>;

const TABS: { value: string; label: string; list: ListFn; content: ReactNode }[] = [
  { value: 'specialties', label: 'Chuyên khoa',      list: listSpecialtiesAdmin,        content: <SpecialtiesTab /> },
  { value: 'services',    label: 'Dịch vụ',          list: listServicesAdmin,           content: <ServicesTab /> },
  { value: 'facilities',  label: 'Cơ sở',            list: listFacilitiesAdmin,         content: <FacilitiesTab /> },
  { value: 'rooms',       label: 'Phòng khám',       list: listRoomsAdmin,              content: <RoomsTab /> },
  { value: 'schedules',   label: 'Lịch BS',          list: listDoctorSchedulesAdmin,    content: <DoctorSchedulesTab /> },
  { value: 'categories',  label: 'Danh mục câu hỏi', list: listQuestionCategoriesAdmin, content: <CategoriesTab /> },
];

function MasterDataInner() {
  const { activeTab, currentAddAction, setActiveTab, tabCounts, setTabCount } = useMasterDataActions();

  // Prefetch totals so every tab shows its count, even before it is opened.
  useEffect(() => {
    let cancelled = false;
    TABS.forEach((t) => {
      t.list({ page: 1, limit: 1, status: 'all' })
        .then(({ total }) => { if (!cancelled) setTabCount(t.value, total); })
        .catch(() => { /* count badge is optional */ });
    });
    return () => { cancelled = true; };
  }, [setTabCount]);

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-3.5 text-[#1A1614]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-1 basis-[360px] flex-col gap-1">
          <nav aria-label="Breadcrumb" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9A928D]">
            Quản trị › <span className="text-[#C41740]">Danh mục</span>
          </nav>
          <h1 className="text-2xl font-bold tracking-[-0.01em] text-[#1A1614]">Danh mục hệ thống</h1>
          <p className="text-pretty text-sm text-[#7A726D]">
            Quản lý chuyên khoa, dịch vụ, cơ sở, phòng khám, lịch bác sĩ và danh mục câu hỏi.
          </p>
        </div>
        {currentAddAction && (
          <button
            type="button"
            onClick={currentAddAction.onAdd}
            className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#C41740] px-3.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#A8123A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740]/40 focus-visible:ring-offset-2 motion-reduce:transition-none"
          >
            <Plus className="h-4 w-4" aria-hidden />
            {currentAddAction.label}
          </button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3.5">
        <div className="overflow-x-auto rounded-[9px] bg-[#EDEAE7] p-[3px]">
          <TabsList className="flex h-auto w-full min-w-max gap-0.5 bg-transparent p-0">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="h-8 flex-1 cursor-pointer gap-1.5 rounded-[7px] px-3.5 text-[12.5px] font-semibold text-[#57524E] shadow-none transition-colors duration-200 hover:text-[#1A1614] focus-visible:ring-[#C41740] focus-visible:ring-offset-0 data-[state=active]:bg-white data-[state=active]:text-[#C41740] data-[state=active]:shadow-[0_1px_2px_rgba(0,0,0,0.08)] motion-reduce:transition-none"
              >
                {t.label}
                {tabCounts[t.value] !== undefined && (
                  <span className="text-[11px] font-medium text-[#9A928D]">{tabCounts[t.value]}</span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {TABS.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-0">{t.content}</TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

export default function MasterDataContent() {
  return (
    <MasterDataActionsProvider defaultTab="specialties">
      <MasterDataInner />
    </MasterDataActionsProvider>
  );
}
