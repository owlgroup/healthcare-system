import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { SoapNoteSnapshot, SoapChangedField } from '@/lib/exam-activity-log';
import type { ExamVersionHistoryEntry } from '@/lib/emr-api';
import type { SoapIcdCode } from '@/types/emr';
import IcdCodeHeaderBadge from './IcdCodeHeaderBadge';

const SOAP_SECTIONS: { field: SoapChangedField; label: string; description: string }[] = [
  { field: 's_text', label: 'S — Subjective', description: 'Lời khai bệnh nhân' },
  { field: 'o_text', label: 'O — Objective', description: 'Kết quả khám thực thể' },
  { field: 'a_text', label: 'A — Assessment', description: 'Chẩn đoán lâm sàng' },
  { field: 'p_text', label: 'P — Plan', description: 'Kế hoạch điều trị' },
];

function displayText(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed || 'Chưa ghi nhận trong transcript';
}

function isFieldChanged(
  field: SoapChangedField,
  before: SoapNoteSnapshot | null,
  after: SoapNoteSnapshot | null
): boolean {
  const beforeVal = (before?.[field] ?? '').trim();
  const afterVal = (after?.[field] ?? '').trim();
  return beforeVal !== afterVal;
}

type Props = {
  currentVersion: ExamVersionHistoryEntry;
  previousVersion: ExamVersionHistoryEntry | null;
  icdCodes?: SoapIcdCode[];
  showOnlyChanges?: boolean;
  onToggleShowOnlyChanges?: (value: boolean) => void;
  currentSoapFallback?: SoapNoteSnapshot | null;
};

export default function SoapVersionDiff({
  currentVersion,
  previousVersion,
  icdCodes = [],
  showOnlyChanges = false,
  onToggleShowOnlyChanges,
  currentSoapFallback,
}: Props) {
  const [localShowOnlyChanges, setLocalShowOnlyChanges] = useState(showOnlyChanges);
  const effectiveShowOnlyChanges = onToggleShowOnlyChanges ? showOnlyChanges : localShowOnlyChanges;

  const handleToggle = (value: boolean) => {
    if (onToggleShowOnlyChanges) {
      onToggleShowOnlyChanges(value);
    } else {
      setLocalShowOnlyChanges(value);
    }
  };

  const currentSoap = currentVersion.soap_snapshot
    ?? (currentVersion.is_current ? currentSoapFallback ?? null : null);
  const previousSoap = previousVersion?.soap_snapshot ?? null;
  const hasNoSnapshots = !currentSoap && !previousSoap;

  const changedCount = SOAP_SECTIONS.filter((s) =>
    isFieldChanged(s.field, previousSoap, currentSoap)
  ).length;
  const unchangedCount = SOAP_SECTIONS.length - changedCount;

  const sectionsToShow = effectiveShowOnlyChanges
    ? SOAP_SECTIONS.filter((s) => isFieldChanged(s.field, previousSoap, currentSoap))
    : SOAP_SECTIONS;

  const formattedTime = format(parseISO(currentVersion.created_at), 'dd/MM/yyyy HH:mm', { locale: vi });
  const actorLabel = currentVersion.action === 'AI_GENERATED'
    ? 'AI hệ thống'
    : currentVersion.actor_name
      ? `Bác sĩ ${currentVersion.actor_name}`
      : 'Bác sĩ';

  const isAddendum = currentVersion.action === 'ADDENDUM_CREATED';
  const hasAddendumDetails = isAddendum && (currentVersion.addendum_reason || currentVersion.addendum_soap_snapshot);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="pb-4 border-b border-border">
        <h3 className="text-base font-bold text-foreground">
          Chi tiết Phiên bản {currentVersion.version}
        </h3>
      </div>

      {/* Addendum Details Section */}
      {hasAddendumDetails && (
        <div className="bg-violet-50 border-2 border-violet-200 rounded-xl p-5 space-y-4">
          <h4 className="text-sm font-bold text-violet-800 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Thông tin phiếu bổ sung
          </h4>

          {currentVersion.addendum_reason && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-violet-700">Lý do tạo phiếu bổ sung:</p>
              <p className="text-sm text-violet-900 bg-white rounded-lg p-3 border border-violet-200">
                {currentVersion.addendum_reason}
              </p>
            </div>
          )}

          {currentVersion.addendum_soap_snapshot && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-violet-700">Nội dung phiếu bổ sung:</p>
              <div className="bg-white rounded-lg border border-violet-200 divide-y divide-violet-100">
                {SOAP_SECTIONS.map((section) => {
                  const value = currentVersion.addendum_soap_snapshot?.[section.field];
                  if (!value?.trim()) return null;
                  return (
                    <div key={section.field} className="p-3">
                      <p className="text-xs font-semibold text-violet-700 mb-1">{section.label}</p>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{value}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {hasNoSnapshots ? (
        <div className="bg-white rounded-xl p-8 text-center border border-border shadow-sm">
          <p className="text-sm text-muted-foreground">
            Phiên bản này được ghi nhận trước khi hệ thống lưu chi tiết nội dung.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Thay đổi: {currentVersion.changed_fields.length > 0
              ? currentVersion.changed_fields.map((f) => f.replace('_text', '').toUpperCase()).join(', ')
              : 'Không xác định'}
          </p>
        </div>
      ) : (
        <>
          {/* Legend & Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-5 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-md bg-red-100 border border-red-300" />
                Nội dung cũ
              </span>
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-md bg-green-100 border border-green-300" />
                Nội dung mới
              </span>
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-md bg-gray-100 border border-gray-300" />
                Không thay đổi
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleToggle(true)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all cursor-pointer ${
                  effectiveShowOnlyChanges
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-white border-border text-muted-foreground hover:bg-gray-50 hover:border-gray-300'
                }`}
              >
                Chỉ xem thay đổi
              </button>
              <button
                type="button"
                onClick={() => handleToggle(false)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all cursor-pointer ${
                  !effectiveShowOnlyChanges
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-white border-border text-muted-foreground hover:bg-gray-50 hover:border-gray-300'
                }`}
              >
                Xem tất cả
              </button>
            </div>
          </div>

          {/* ICD Codes */}
          {icdCodes.length > 0 && (
            <div className="flex items-center">
              <IcdCodeHeaderBadge icdCodes={icdCodes} />
            </div>
          )}

          {/* Comparison Table */}
          <div className="bg-white border-2 border-border rounded-xl overflow-hidden shadow-sm">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow className="bg-gray-50 border-b-2 border-border">
                  <TableHead className="w-[200px] py-4 px-5 text-xs font-bold uppercase tracking-wide text-gray-600">
                    Thông tin
                  </TableHead>
                  <TableHead className="w-[calc((100%-200px)/2)] py-4 px-5 text-xs font-bold uppercase tracking-wide text-gray-600">
                    Trước chỉnh sửa
                  </TableHead>
                  <TableHead className="w-[calc((100%-200px)/2)] py-4 px-5 text-xs font-bold uppercase tracking-wide text-gray-600">
                    Sau chỉnh sửa
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sectionsToShow.map((section, index) => {
                  const changed = isFieldChanged(section.field, previousSoap, currentSoap);
                  const beforeText = previousSoap?.[section.field] ?? null;
                  const afterText = currentSoap?.[section.field] ?? null;
                  const isLast = index === sectionsToShow.length - 1;

                  return (
                    <TableRow
                      key={section.field}
                      className={`${!isLast ? 'border-b border-border' : ''} hover:bg-gray-50/50 transition-colors`}
                    >
                      <TableCell className="align-top py-5 px-5">
                        <div className="space-y-2">
                          <p className="text-sm font-bold text-primary">{section.label}</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">{section.description}</p>
                          <Badge
                            variant="outline"
                            className={`text-xs font-medium px-2.5 py-1 ${
                              changed
                                ? 'bg-amber-50 text-amber-700 border-amber-300'
                                : 'bg-gray-100 text-gray-500 border-gray-300'
                            }`}
                          >
                            {changed ? 'Đã chỉnh sửa' : 'Không thay đổi'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="align-top py-5 px-5">
                        <div
                          className={`rounded-xl p-4 text-sm whitespace-pre-wrap leading-relaxed ${
                            changed
                              ? 'bg-red-50 border-2 border-red-200 text-red-900'
                              : 'bg-gray-50 border border-gray-200 text-gray-600'
                          }`}
                        >
                          {previousVersion ? displayText(beforeText) : '—'}
                        </div>
                      </TableCell>
                      <TableCell className="align-top py-5 px-5">
                        <div
                          className={`rounded-xl p-4 text-sm whitespace-pre-wrap leading-relaxed ${
                            changed
                              ? 'bg-green-50 border-2 border-green-200 text-green-900'
                              : 'bg-gray-50 border border-gray-200 text-gray-600'
                          }`}
                        >
                          {displayText(afterText)}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
