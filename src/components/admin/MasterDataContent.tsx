import { useEffect, type ReactNode } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
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
    <div className="max-w-6xl mx-auto w-full">
      {/* Page header */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-1 basis-80 space-y-1">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <span>Quản trị</span>
            <ChevronRight className="h-3 w-3" aria-hidden />
            <span className="text-primary">Danh mục</span>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Danh mục hệ thống</h1>
          <p className="text-sm text-muted-foreground text-pretty">
            Quản lý chuyên khoa, dịch vụ, cơ sở, phòng khám, lịch bác sĩ và danh mục câu hỏi.
          </p>
        </div>
        {currentAddAction && (
          <button
            type="button"
            onClick={currentAddAction.onAdd}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors cursor-pointer hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
          >
            <Plus className="h-4 w-4" />
            {currentAddAction.label}
          </button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-0">
        {/* Segmented tab navigation */}
        <div className="mb-4 overflow-x-auto rounded-xl bg-muted p-1">
          <TabsList className="flex h-auto w-full min-w-max gap-0.5 bg-transparent p-0">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="flex-1 gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold text-muted-foreground transition-colors cursor-pointer hover:text-foreground data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"
              >
                {t.label}
                {tabCounts[t.value] !== undefined && (
                  <span className="text-[11px] font-medium text-muted-foreground">{tabCounts[t.value]}</span>
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
