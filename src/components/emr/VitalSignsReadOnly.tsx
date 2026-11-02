/**
 * Vital signs read-only display in EMR context
 * Shows the latest vital signs for the appointment as tiles, flagging abnormal values
 */

import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Activity, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getLatestVitalSigns } from '@/lib/vital-signs-api';
import type { VitalSignsRow } from '@/types/vital-signs';

export type VitalSignsSummary = {
  abnormalCount: number;
  measuredAt: string | null;
  /** One-line text suitable for inserting into the Objective section */
  text: string | null;
};

type VitalSignsReadOnlyProps = {
  appointmentId: string;
  /** Must be referentially stable (e.g. a state setter) */
  onLoaded?: (summary: VitalSignsSummary) => void;
};

type Flag = 'hi' | 'lo' | '';

type VitalTile = {
  key: string;
  label: string;
  value: string;
  unit: string;
  flag: Flag;
};

function buildTiles(v: VitalSignsRow): VitalTile[] {
  const tiles: VitalTile[] = [];
  if (v.bp_systolic != null || v.bp_diastolic != null) {
    const sys = v.bp_systolic;
    const dia = v.bp_diastolic;
    tiles.push({
      key: 'bp',
      label: 'Huyết áp',
      value: `${sys ?? '—'}/${dia ?? '—'}`,
      unit: 'mmHg',
      flag: (sys != null && sys >= 140) || (dia != null && dia >= 90) ? 'hi' : sys != null && sys < 90 ? 'lo' : '',
    });
  }
  if (v.heart_rate != null) {
    tiles.push({ key: 'hr', label: 'Nhịp tim', value: String(v.heart_rate), unit: 'bpm', flag: v.heart_rate > 100 ? 'hi' : v.heart_rate < 60 ? 'lo' : '' });
  }
  if (v.temperature_c != null) {
    tiles.push({ key: 'temp', label: 'Nhiệt độ', value: String(v.temperature_c), unit: '°C', flag: v.temperature_c > 37.2 ? 'hi' : v.temperature_c < 36.1 ? 'lo' : '' });
  }
  if (v.spo2 != null) {
    tiles.push({ key: 'spo2', label: 'SpO₂', value: String(v.spo2), unit: '%', flag: v.spo2 < 95 ? 'lo' : '' });
  }
  if (v.respiratory_rate != null) {
    tiles.push({ key: 'rr', label: 'Nhịp thở', value: String(v.respiratory_rate), unit: 'l/ph', flag: v.respiratory_rate > 20 ? 'hi' : v.respiratory_rate < 12 ? 'lo' : '' });
  }
  if (v.weight_kg != null) {
    tiles.push({ key: 'weight', label: 'Cân nặng', value: String(v.weight_kg), unit: 'kg', flag: '' });
  }
  if (v.height_cm != null) {
    tiles.push({ key: 'height', label: 'Chiều cao', value: String(v.height_cm), unit: 'cm', flag: '' });
  }
  if (v.bmi != null) {
    tiles.push({ key: 'bmi', label: 'BMI', value: Number(v.bmi).toFixed(1), unit: '', flag: '' });
  }
  return tiles;
}

function buildText(v: VitalSignsRow): string | null {
  const parts = [
    v.bp_systolic != null && v.bp_diastolic != null ? `HA ${v.bp_systolic}/${v.bp_diastolic} mmHg` : null,
    v.heart_rate != null ? `M ${v.heart_rate} l/ph` : null,
    v.temperature_c != null ? `T ${v.temperature_c} °C` : null,
    v.spo2 != null ? `SpO₂ ${v.spo2}%` : null,
    v.respiratory_rate != null ? `NT ${v.respiratory_rate} l/ph` : null,
  ].filter(Boolean);
  return parts.length ? `${parts.join(' · ')}.` : null;
}

export default function VitalSignsReadOnly({ appointmentId, onLoaded }: VitalSignsReadOnlyProps) {
  const [vitals, setVitals] = useState<VitalSignsRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { vitals: v } = await getLatestVitalSigns(supabase, appointmentId);
        setVitals(v);
      } catch {
        setVitals(null);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [appointmentId]);

  useEffect(() => {
    if (loading || !onLoaded) return;
    if (!vitals) {
      onLoaded({ abnormalCount: 0, measuredAt: null, text: null });
      return;
    }
    onLoaded({
      abnormalCount: buildTiles(vitals).filter((t) => t.flag).length,
      measuredAt: vitals.recorded_at ? format(parseISO(vitals.recorded_at), 'HH:mm · dd/MM/yy') : null,
      text: buildText(vitals),
    });
  }, [loading, vitals, onLoaded]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Đang tải sinh hiệu...
      </div>
    );
  }

  const tiles = vitals ? buildTiles(vitals) : [];
  if (!vitals || tiles.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-1">
        Chưa có dữ liệu sinh hiệu cho lịch hẹn này.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {vitals.is_critical && (
        <div className="flex items-center gap-1.5 rounded-lg bg-primary/5 border border-primary/20 px-2.5 py-1.5 text-xs font-semibold text-primary">
          <Activity className="h-3.5 w-3.5" />
          Chỉ số CRITICAL: {vitals.critical_flags.join(', ')}
        </div>
      )}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2">
        {tiles.map((t) => (
          <div
            key={t.key}
            className={`flex flex-col gap-0.5 rounded-lg border px-3 py-2 ${
              t.flag ? 'border-primary/25 bg-primary/[0.03]' : 'border-border bg-card'
            }`}
          >
            <span className="text-[11.5px] text-muted-foreground">{t.label}</span>
            <span className="flex items-baseline gap-1 whitespace-nowrap">
              <span className={`text-lg font-bold tabular-nums ${t.flag ? 'text-primary' : 'text-foreground'}`}>
                {t.flag === 'hi' ? '▲ ' : t.flag === 'lo' ? '▼ ' : ''}
                {t.value}
              </span>
              {t.unit && <span className="text-[11px] text-muted-foreground">{t.unit}</span>}
            </span>
          </div>
        ))}
      </div>
      {vitals.clinical_note && (
        <p className="text-xs text-muted-foreground italic">
          Ghi chú: {vitals.clinical_note}
        </p>
      )}
    </div>
  );
}
