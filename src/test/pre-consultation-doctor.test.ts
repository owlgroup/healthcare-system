import { describe, expect, it } from 'vitest';
import {
  appointmentHasPreConsult,
  getAppointmentReadiness,
} from '@/lib/appointment-readiness';
import { mapBundlePayload } from '@/lib/pre-consultation-api';
import type { AdminAppointment } from '@/types/admin-appointment';

function baseAppt(overrides: Partial<AdminAppointment> = {}): AdminAppointment {
  return {
    id: 'appt-1',
    patient_id: 'p1',
    profile_id: 'prof-1',
    specialty_id: 'sp-1',
    slot_id: null,
    status: 'CONFIRMED',
    note: null,
    walk_in: false,
    cancel_reason: null,
    cancelled_at: null,
    cancelled_by: null,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    specialty_name: null,
    specialty_icon: null,
    slot_date: null,
    start_time: null,
    end_time: null,
    doctor_id: null,
    patient_name: 'Test Patient',
    patient_phone: null,
    patient_dob: null,
    doctor_name: null,
    pre_consult_status: 'none',
    pre_consult_doctor_exists: false,
    pre_consult_drug_allergy: false,
    pre_consult_severe_pain: false,
    has_vital_signs: false,
    ...overrides,
  };
}

describe('appointmentHasPreConsult', () => {
  it('returns true when patient submitted', () => {
    expect(
      appointmentHasPreConsult(baseAppt({ pre_consult_status: 'submitted' })),
    ).toBe(true);
  });

  it('returns true when doctor pre-consult exists', () => {
    expect(
      appointmentHasPreConsult(baseAppt({ pre_consult_doctor_exists: true })),
    ).toBe(true);
  });

  it('returns false when neither exists', () => {
    expect(appointmentHasPreConsult(baseAppt())).toBe(false);
  });
});

describe('getAppointmentReadiness', () => {
  it('is ready when doctor pre-consult and vitals exist', () => {
    const readiness = getAppointmentReadiness(
      baseAppt({ pre_consult_doctor_exists: true, has_vital_signs: true }),
    );
    expect(readiness.hasPreConsult).toBe(true);
    expect(readiness.isReady).toBe(true);
  });
});

describe('mapBundlePayload', () => {
  it('maps patient and doctor records with creator names', () => {
    const bundle = mapBundlePayload({
      patient: {
        id: 'pc-1',
        appointment_id: 'appt-1',
        patient_id: 'p1',
        status: 'SUBMITTED',
        chief_complaint: 'Đau bụng',
        symptom_duration: 3,
        symptom_duration_unit: 'days',
        pain_scale: 4,
        symptom_tags: [],
        medical_history: [],
        surgical_history: null,
        family_history: [],
        current_medications: [],
        otc_supplements: null,
        drug_allergies: [],
        food_allergies: [],
        smoking: null,
        smoking_frequency: null,
        alcohol: null,
        alcohol_frequency: null,
        exercise: null,
        exercise_frequency: null,
        flags: { drug_allergy: false, severe_pain: false },
        submitted_at: '2026-07-19T02:40:00Z',
        submitted_by_user_id: 'p1',
        created_at: '2026-07-19T02:30:00Z',
        updated_at: '2026-07-19T02:40:00Z',
      },
      doctor: {
        id: 'dpc-1',
        appointment_id: 'appt-1',
        patient_id: 'p1',
        chief_complaint: 'Đau dạ dày cấp',
        symptom_duration: 3,
        symptom_duration_unit: 'days',
        pain_scale: 5,
        symptom_tags: [],
        medical_history: [{ condition: 'hypertension', details: '2023' }],
        surgical_history: null,
        family_history: [],
        current_medications: [{ name: 'Omeprazole', dose: '20mg', frequency: '1v/ngày' }],
        otc_supplements: null,
        drug_allergies: [],
        food_allergies: [],
        smoking: 'current',
        smoking_frequency: null,
        alcohol: null,
        alcohol_frequency: null,
        exercise: null,
        exercise_frequency: null,
        flags: { drug_allergy: false, severe_pain: false },
        created_by_user_id: 'doc-1',
        updated_by_user_id: 'doc-1',
        created_at: '2026-07-19T02:50:00Z',
        updated_at: '2026-07-19T02:50:00Z',
      },
      patient_creator_name: 'Phạm Đức Hậu',
      doctor_creator_name: 'Lê Thị Hồng Xoan',
      doctor_updater_name: 'Lê Thị Hồng Xoan',
    });

    expect(bundle.patient?.chief_complaint).toBe('Đau bụng');
    expect(bundle.doctor?.chief_complaint).toBe('Đau dạ dày cấp');
    expect(bundle.patientCreatorName).toBe('Phạm Đức Hậu');
    expect(bundle.doctorUpdaterName).toBe('Lê Thị Hồng Xoan');
  });
});
