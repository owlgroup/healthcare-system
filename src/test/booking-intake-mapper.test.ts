import { describe, expect, it } from 'vitest';
import { mapBookingIntakeToInput } from '@/lib/booking-intake-mapper';

const base = {
  chief_complaint: ' Đau bụng ',
  symptom_duration: 'Dưới 3 ngày',
  pain_level: '4-6/10 — Vừa phải',
  current_medications: 'không',
  allergies: 'Penicillin',
};

describe('mapBookingIntakeToInput', () => {
  it('should map intake answers to fields that pass submit validation', () => {
    const input = mapBookingIntakeToInput(base);
    expect(input.chief_complaint).toBe('Đau bụng');
    expect(input.symptom_duration).toBe(3);
    expect(input.symptom_duration_unit).toBe('days');
    expect(input.pain_scale).toBe(5);
    expect(input.current_medications).toEqual([]);
    expect(input.drug_allergies).toEqual([{ drug: 'Penicillin', reaction: '' }]);
  });

  it('should keep free-text medications when patient lists them', () => {
    const input = mapBookingIntakeToInput({ ...base, current_medications: 'Omeprazole 20mg' });
    expect(input.current_medications).toEqual([{ name: 'Omeprazole 20mg', dose: '', frequency: '' }]);
  });

  it('should default to a positive duration when option is unknown', () => {
    const input = mapBookingIntakeToInput({ ...base, symptom_duration: 'x' });
    expect(input.symptom_duration).toBeGreaterThan(0);
  });
});
