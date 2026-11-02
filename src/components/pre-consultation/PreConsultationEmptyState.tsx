/**
 * Empty state for pre-consultation tab — centered CTA to create declaration
 */

import { FileQuestion, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  onCreate: () => void;
  canCreate?: boolean;
  title?: string;
  description?: string;
  buttonLabel?: string;
};

export default function PreConsultationEmptyState({
  onCreate,
  canCreate = true,
  title = 'Chưa có khai báo',
  description = 'Bệnh nhân chưa điền phiếu khai báo trước khám.',
  buttonLabel = 'Tạo khai báo',
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <FileQuestion className="h-14 w-14 text-primary mb-4" strokeWidth={1.5} />
      <p className="font-semibold text-foreground text-base">{title}</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs">{description}</p>
      {canCreate && (
        <Button className="mt-6 px-6" onClick={onCreate}>
          <Plus className="h-4 w-4 mr-1.5" />
          {buttonLabel}
        </Button>
      )}
    </div>
  );
}
