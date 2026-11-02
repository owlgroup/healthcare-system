import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PatientPreConsultationPanel from '@/components/pre-consultation/PatientPreConsultationPanel';
import PreConsultationSectionCards from '@/components/pre-consultation/PreConsultationSectionCards';
import type { PreConsultation } from '@/types/pre-consultation';

function samplePatientRecord(overrides: Partial<PreConsultation> = {}): PreConsultation {
  return {
    id: 'pc-1',
    appointment_id: 'appt-1',
    patient_id: 'p1',
    status: 'SUBMITTED',
    chief_complaint: 'Đau bụng',
    symptom_duration: 2,
    symptom_duration_unit: 'weeks',
    pain_scale: 4,
    symptom_tags: ['fever', 'headache'],
    medical_history: [{ condition: 'diabetes', details: '2 năm' }],
    surgical_history: 'Nội soi dạ dày 2020',
    family_history: [{ condition: 'Cao huyết áp', relation: 'Bố' }],
    current_medications: [{ name: 'Metformin', dose: '500mg', frequency: '2v/ngày' }],
    otc_supplements: 'Vitamin D',
    drug_allergies: [{ drug: 'Penicillin', reaction: 'Phát ban' }],
    food_allergies: [{ food: 'Hải sản', reaction: 'Ngứa' }],
    smoking: 'never',
    smoking_frequency: null,
    alcohol: 'occasionally',
    alcohol_frequency: 'Cuối tuần',
    exercise: 'regularly',
    exercise_frequency: '3 buổi/tuần',
    flags: { drug_allergy: true, severe_pain: false },
    submitted_at: '2026-07-02T21:44:00Z',
    submitted_by_user_id: 'p1',
    created_at: '2026-07-02T21:30:00Z',
    updated_at: '2026-07-02T21:44:00Z',
    ...overrides,
  };
}

describe('PreConsultationSectionCards', () => {
  it('renders all major clinical sections from a submitted patient record', () => {
    render(<PreConsultationSectionCards record={samplePatientRecord()} />);

    expect(screen.getByText('Triệu chứng lâm sàng')).toBeInTheDocument();
    expect(screen.getByText('Đau bụng')).toBeInTheDocument();
    expect(screen.getByText('Mức độ đau: 4/10')).toBeInTheDocument();
    expect(screen.getByText('Sốt')).toBeInTheDocument();
    expect(screen.getByText('Đau đầu')).toBeInTheDocument();

    expect(screen.getByText('Bệnh sử')).toBeInTheDocument();
    expect(screen.getByText(/Tiểu đường \(2 năm\)/)).toBeInTheDocument();
    expect(screen.getByText(/Phẫu thuật:/)).toBeInTheDocument();
    expect(screen.getByText(/Cao huyết áp \(Bố\)/)).toBeInTheDocument();

    expect(screen.getByText('Lối sống')).toBeInTheDocument();
    expect(screen.getByText(/KHÔNG BAO GIỜ/)).toBeInTheDocument();

    expect(screen.getByText('Thuốc / Đơn thuốc')).toBeInTheDocument();
    expect(screen.getByText(/Metformin 500mg — 2v\/ngày/)).toBeInTheDocument();
    expect(screen.getByText(/TPCN: Vitamin D/)).toBeInTheDocument();

    expect(screen.getByText('Dị ứng')).toBeInTheDocument();
    expect(screen.getByText('Penicillin')).toBeInTheDocument();
    expect(screen.getByText('Hải sản')).toBeInTheDocument();
    expect(screen.getByText('CẢNH BÁO DỊ ỨNG')).toBeInTheDocument();
  });

  it('shows severe pain alert when pain scale is high', () => {
    render(
      <PreConsultationSectionCards
        record={samplePatientRecord({ pain_scale: 8, flags: { drug_allergy: false, severe_pain: true } })}
      />,
    );

    expect(screen.getByText('Mức độ đau: 8/10')).toBeInTheDocument();
    expect(screen.getByText('MỨC ĐỘ ĐAU')).toBeInTheDocument();
  });
});

describe('PatientPreConsultationPanel', () => {
  it('renders full section cards with creator metadata for submitted records', () => {
    render(
      <PatientPreConsultationPanel
        record={samplePatientRecord()}
        creatorName="Phạm Đức Hậu"
        submittedAt="2026-07-02T21:44:00Z"
      />,
    );

    expect(screen.getByText('Khai báo của bệnh nhân')).toBeInTheDocument();
    expect(screen.getByText(/Người tạo: Phạm Đức Hậu/)).toBeInTheDocument();
    expect(screen.getByText('Triệu chứng lâm sàng')).toBeInTheDocument();
    expect(screen.getByText('Thuốc / Đơn thuốc')).toBeInTheDocument();
  });

  it('shows draft message without clinical sections when patient has not submitted', () => {
    render(
      <PatientPreConsultationPanel
        record={samplePatientRecord({ status: 'DRAFT' })}
        isDraft
      />,
    );

    expect(screen.getByText('Bệnh nhân đang khai báo (chưa gửi).')).toBeInTheDocument();
    expect(screen.queryByText('Triệu chứng lâm sàng')).not.toBeInTheDocument();
  });
});
