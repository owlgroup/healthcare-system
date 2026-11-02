import { Badge } from '@/components/ui/badge';
import type { SoapIcdCode } from '@/types/emr';

type Props = {
  icdCodes: SoapIcdCode[];
  className?: string;
};

export default function IcdCodeHeaderBadge({ icdCodes, className = '' }: Props) {
  const confirmedIcds = icdCodes.filter((c) => c.confirm_status === 'CONFIRMED');

  if (confirmedIcds.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap items-center justify-end gap-1.5 ${className}`}>
      {confirmedIcds.map((icd) => (
        <Badge
          key={icd.id || `${icd.icd_code}-${icd.display_order}`}
          variant="outline"
          className="rounded-md bg-blue-50 text-blue-700 border-blue-200 text-xs font-medium"
        >
          <span className="font-mono font-bold mr-1">{icd.icd_code}</span>
          {icd.icd_name}
        </Badge>
      ))}
    </div>
  );
}
