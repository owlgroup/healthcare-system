/**
 * OCR Profile Page - Patient Profile with AI OCR Document Extraction
 * Features: View/Edit modes, OTP verification, Document upload with OCR
 */

import { useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';
import {
  Camera,
  Check,
  CheckCircle,
  CloudUpload,
  CreditCard,
  Eye,
  EyeOff,
  IdCard,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Pen,
  QrCode,
  ScanLine,
  Shield,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import TopNav from '@/components/TopNav';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/hooks/use-auth';
import { useMyPatientProfile, hasPatientRecord } from '@/hooks/useMyPatientProfile';
import type { PatientPortalDetail } from '@/types/patient-portal';
import {
  fetchOcrSingle,
  type CccdOcrResponse,
  type BhytOcrResponse,
} from '@/lib/cccd-ocr';
import { sanitizeSensitiveDisplay } from '@/lib/crypto';
import { sendProfileOtp, verifyProfileOtp, ProfileOtpError } from '@/lib/profile-otp-api';
import { supabase } from '@/lib/supabase';

type ViewMode = 'view' | 'edit';

type ProfileData = {
  cccdNumber: string;
  cccdExpiry: string;
  address: string;
  issueDate: string;
  issuePlace: string;
  fullName: string;
  dob: string;
  phone: string;
  email: string;
  pronoun: string;
  bhytProvider: string;
  bhytNumber: string;
  bhytGroup: string;
  bhytName: string;
  bhytDob: string;
  bhytGender: string;
  bhytKcbCode: string;
  bhytHospital: string;
  bhytValidFrom: string;
  bhyt5Year: string;
};

const EMPTY_PROFILE: ProfileData = {
  cccdNumber: '',
  cccdExpiry: '',
  address: '',
  issueDate: '',
  issuePlace: '',
  fullName: '',
  dob: '',
  phone: '',
  email: '',
  pronoun: '',
  bhytProvider: '',
  bhytNumber: '',
  bhytGroup: '',
  bhytName: '',
  bhytDob: '',
  bhytGender: '',
  bhytKcbCode: '',
  bhytHospital: '',
  bhytValidFrom: '',
  bhyt5Year: '',
};

function mapPatientToProfileData(p: PatientPortalDetail | null | undefined): ProfileData {
  if (!p) return EMPTY_PROFILE;
  return {
    cccdNumber: p.id_number ?? '',
    cccdExpiry: p.id_expiration_date ?? '',
    address: p.residential_address ?? '',
    issueDate: p.id_issued_date ?? '',
    issuePlace: p.id_issuer ?? '',
    fullName: p.full_name ?? '',
    dob: p.date_of_birth ?? '',
    phone: p.phone_number ?? '',
    email: p.email_address ?? '',
    pronoun: p.preferred_pronouns ?? '',
    bhytProvider: p.insurance_provider ?? '',
    bhytNumber: p.member_id ?? '',
    bhytGroup: p.group_number ?? '',
    bhytName: p.bhyt_name ?? '',
    bhytDob: p.bhyt_dob ?? '',
    bhytGender: p.bhyt_gender ?? '',
    bhytKcbCode: p.bhyt_kcb_code ?? '',
    bhytHospital: p.bhyt_kcb ?? '',
    bhytValidFrom: p.bhyt_valid_from ?? '',
    bhyt5Year: p.bhyt_five_year ?? '',
  };
}

function maskString(str: string, showFirst = 3, showLast = 3): string {
  if (!str || str.length <= showFirst + showLast) return str;
  const first = str.slice(0, showFirst);
  const last = str.slice(-showLast);
  const middle = '•'.repeat(Math.min(str.length - showFirst - showLast, 6));
  return `${first} ${middle} ${last}`;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const masked = local[0] + '•'.repeat(Math.min(local.length - 2, 6)) + local.slice(-1);
  return `${masked}@${domain}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('vi-VN');
}

function maskDate(dateStr: string): string {
  if (!dateStr) return '••/••/••••';
  const d = new Date(dateStr);
  const year = d.getFullYear();
  return `••/••/${year}`;
}

export default function OcrProfile() {
  const { session } = useAuth();
  const { data: patientProfile, isLoading, refetch } = useMyPatientProfile();
  const profileExists = hasPatientRecord(patientProfile);

  const [mode, setMode] = useState<ViewMode>('view');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpPurpose, setOtpPurpose] = useState<'view' | 'edit'>('view');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [otpTimer, setOtpTimer] = useState(180);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [editProfile, setEditProfile] = useState<ProfileData>(EMPTY_PROFILE);

  // Document image URLs (only loaded when unlocked)
  const [docUrls, setDocUrls] = useState<{
    cccdFront: string | null;
    cccdBack: string | null;
    bhyt: string | null;
  }>({ cccdFront: null, cccdBack: null, bhyt: null });
  const [loadingDocs, setLoadingDocs] = useState(false);

  // Map patient profile to display format
  const profile = mapPatientToProfileData(patientProfile);

  // Initialize edit form when entering edit mode
  useEffect(() => {
    if (mode === 'edit' || isEditing) {
      setEditProfile(profile);
    }
  }, [mode, isEditing]);

  // Edit mode state
  const [cccdFrontFile, setCccdFrontFile] = useState<File | null>(null);
  const [cccdBackFile, setCccdBackFile] = useState<File | null>(null);
  const [bhytFile, setBhytFile] = useState<File | null>(null);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrLoadingStates, setOcrLoadingStates] = useState({
    cccdFront: false,
    cccdBack: false,
    bhyt: false,
  });

  // Image preview modal state
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // OTP validity timer
  useEffect(() => {
    if (!showOtpModal || otpTimer <= 0) return;
    const timer = setInterval(() => {
      setOtpTimer((t) => t - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [showOtpModal, otpTimer]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((t) => t - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Load document images when unlocked
  async function loadDocumentUrls() {
    if (!patientProfile) return;

    setLoadingDocs(true);
    try {
      const urls: typeof docUrls = { cccdFront: null, cccdBack: null, bhyt: null };

      if (patientProfile.id_document_storage_path) {
        const { data } = await supabase.storage
          .from('identity-documents')
          .createSignedUrl(patientProfile.id_document_storage_path, 3600);
        if (data?.signedUrl) urls.cccdFront = data.signedUrl;
      }

      if (patientProfile.id_document_back_storage_path) {
        const { data } = await supabase.storage
          .from('identity-documents')
          .createSignedUrl(patientProfile.id_document_back_storage_path, 3600);
        if (data?.signedUrl) urls.cccdBack = data.signedUrl;
      }

      if (patientProfile.card_front_storage_path) {
        const { data } = await supabase.storage
          .from('insurance-cards')
          .createSignedUrl(patientProfile.card_front_storage_path, 3600);
        if (data?.signedUrl) urls.bhyt = data.signedUrl;
      }

      setDocUrls(urls);
    } catch (e) {
      console.error('Failed to load document URLs:', e);
    } finally {
      setLoadingDocs(false);
    }
  }

  function formatTimer(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  async function handleUnlockForView() {
    setOtpPurpose('view');
    await handleSendOtp();
  }

  async function handleUnlockForEdit() {
    if (isUnlocked) {
      setIsEditing(true);
      setEditProfile(profile);
      return;
    }
    setOtpPurpose('edit');
    await handleSendOtp();
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setEditProfile(profile);
  }

  async function handleSaveEdit() {
    if (!patientProfile?.id) {
      toast.error('Không tìm thấy hồ sơ');
      return;
    }

    try {
      // Split fullName into legal_last_name and legal_first_name (Vietnamese format: Họ + Tên)
      const nameParts = editProfile.fullName.trim().split(/\s+/);
      const legalLastName = nameParts[0] || '';
      const legalFirstName = nameParts.slice(1).join(' ') || '';

      const { error } = await supabase
        .from('patient')
        .update({
          legal_last_name: legalLastName,
          legal_first_name: legalFirstName,
          phone_number: editProfile.phone,
          email_address: editProfile.email,
          date_of_birth: editProfile.dob || null,
          preferred_pronouns: editProfile.pronoun,
          id_number: editProfile.cccdNumber,
          id_expiration_date: editProfile.cccdExpiry || null,
          residential_address: editProfile.address,
          id_issued_date: editProfile.issueDate || null,
          id_issuer: editProfile.issuePlace,
          insurance_provider: editProfile.bhytProvider,
          member_id: editProfile.bhytNumber,
          group_number: editProfile.bhytGroup,
          bhyt_name: editProfile.bhytName,
          bhyt_dob: editProfile.bhytDob || null,
          bhyt_gender: editProfile.bhytGender,
          bhyt_kcb_code: editProfile.bhytKcbCode,
          bhyt_kcb: editProfile.bhytHospital,
          bhyt_valid_from: editProfile.bhytValidFrom || null,
          bhyt_five_year: editProfile.bhyt5Year || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', patientProfile.id);

      if (error) throw error;

      toast.success('Đã lưu hồ sơ thành công!');
      setIsEditing(false);
      refetch();
    } catch (e) {
      console.error('Save error:', e);
      toast.error('Không thể lưu hồ sơ');
    }
  }

  async function handleSendOtp() {
    const email = session?.user?.email;
    if (!email) {
      toast.error('Không tìm thấy email tài khoản');
      return;
    }

    setSendingOtp(true);
    try {
      const result = await sendProfileOtp(email);
      setOtpTimer(result.expiresIn || 180);
      setResendCooldown(60);
      setOtpCode(['', '', '', '', '', '']);
      if (!showOtpModal) {
        setShowOtpModal(true);
      }
      toast.success('Đã gửi mã OTP tới email của bạn');
    } catch (e) {
      if (e instanceof ProfileOtpError) {
        if (e.code === 'OTP_LOCKED' && e.retryAfterSeconds) {
          toast.error(`Vui lòng chờ ${e.retryAfterSeconds} giây trước khi gửi lại`);
        } else {
          toast.error(e.message);
        }
      } else {
        toast.error('Không thể gửi OTP');
      }
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleVerifyOtp() {
    const email = session?.user?.email;
    if (!email) {
      toast.error('Không tìm thấy email tài khoản');
      return;
    }

    const otp = otpCode.join('');
    if (otp.length !== 6) {
      toast.error('Vui lòng nhập đủ 6 chữ số');
      return;
    }

    setVerifyingOtp(true);
    try {
      await verifyProfileOtp(email, otp);
      setShowOtpModal(false);
      setIsUnlocked(true);

      if (otpPurpose === 'edit') {
        setIsEditing(true);
        setEditProfile(profile);
        toast.success('Xác thực thành công! Đã mở chế độ chỉnh sửa.');
      } else {
        toast.success('Xác thực thành công! Đã mở khóa xem đầy đủ.');
      }
      loadDocumentUrls();
    } catch (e) {
      if (e instanceof ProfileOtpError) {
        if (e.code === 'OTP_EXPIRED') {
          toast.error('OTP đã hết hạn. Vui lòng gửi lại mã mới.');
        } else if (e.code === 'OTP_LOCKED' && e.retryAfterSeconds) {
          toast.error(`Tài khoản tạm khóa. Vui lòng thử lại sau ${Math.ceil(e.retryAfterSeconds / 60)} phút.`);
          setShowOtpModal(false);
        } else if (e.attemptsLeft !== undefined) {
          toast.error(`OTP không đúng. Còn ${e.attemptsLeft} lần thử.`);
        } else {
          toast.error(e.message);
        }
      } else {
        toast.error('Không thể xác thực OTP');
      }
    } finally {
      setVerifyingOtp(false);
    }
  }

  function handleOtpChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...otpCode];
    newCode[index] = value.slice(-1);
    setOtpCode(newCode);

    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  }

  async function fetchImageAsFile(url: string, filename: string): Promise<File | null> {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new File([blob], filename, { type: blob.type });
    } catch {
      return null;
    }
  }

  async function handleOcrAll() {
    const hasCccdFront = cccdFrontFile || docUrls.cccdFront;
    const hasCccdBack = cccdBackFile || docUrls.cccdBack;
    const hasBhyt = bhytFile || docUrls.bhyt;

    if (!hasCccdFront && !hasCccdBack && !hasBhyt) {
      toast.error('Vui lòng tải lên ít nhất một ảnh để OCR');
      return;
    }

    setOcrRunning(true);
    setOcrLoadingStates({
      cccdFront: !!hasCccdFront,
      cccdBack: !!hasCccdBack,
      bhyt: !!hasBhyt,
    });

    const updates: Partial<ProfileData> = {};
    let errorCount = 0;

    const ocrTasks: Promise<void>[] = [];

    if (hasCccdFront) {
      ocrTasks.push(
        (async () => {
          try {
            let fileToOcr = cccdFrontFile;
            if (!fileToOcr && docUrls.cccdFront) {
              fileToOcr = await fetchImageAsFile(docUrls.cccdFront, 'cccd-front.jpg');
            }
            if (!fileToOcr) {
              errorCount++;
              return;
            }
            const result = await fetchOcrSingle(fileToOcr, 'cccd', 'front');
            if (result.parsed) {
              if (result.parsed.id) updates.cccdNumber = result.parsed.id;
              if (result.parsed.name) updates.fullName = result.parsed.name;
              if (result.parsed.dob) updates.dob = result.parsed.dob;
              if (result.parsed.address) updates.address = result.parsed.address;
              if (result.parsed.expiry) updates.cccdExpiry = result.parsed.expiry;
            }
          } catch {
            errorCount++;
          } finally {
            setOcrLoadingStates((s) => ({ ...s, cccdFront: false }));
          }
        })()
      );
    }

    if (hasCccdBack) {
      ocrTasks.push(
        (async () => {
          try {
            let fileToOcr = cccdBackFile;
            if (!fileToOcr && docUrls.cccdBack) {
              fileToOcr = await fetchImageAsFile(docUrls.cccdBack, 'cccd-back.jpg');
            }
            if (!fileToOcr) {
              errorCount++;
              return;
            }
            const result = await fetchOcrSingle(fileToOcr, 'cccd', 'front');
            if (result.parsed) {
              if (result.parsed.issued) {
                const parts = result.parsed.issued.split('\n');
                if (parts[0]) updates.issueDate = parts[0];
                if (parts[1]) updates.issuePlace = parts[1];
              }
            }
          } catch {
            errorCount++;
          } finally {
            setOcrLoadingStates((s) => ({ ...s, cccdBack: false }));
          }
        })()
      );
    }

    if (hasBhyt) {
      ocrTasks.push(
        (async () => {
          try {
            let fileToOcr = bhytFile;
            if (!fileToOcr && docUrls.bhyt) {
              fileToOcr = await fetchImageAsFile(docUrls.bhyt, 'bhyt.jpg');
            }
            if (!fileToOcr) {
              errorCount++;
              return;
            }
            const result = await fetchOcrSingle(fileToOcr, 'bhyt', 'front');
            if (result.parsed) {
              if (result.parsed.id) updates.bhytNumber = result.parsed.id;
              if (result.parsed.name) updates.bhytName = result.parsed.name;
              if (result.parsed.dob) updates.bhytDob = result.parsed.dob;
              if (result.parsed.gender) updates.bhytGender = result.parsed.gender;
              if (result.parsed.kcb) updates.bhytHospital = result.parsed.kcb;
              if (result.parsed.kcb_code) updates.bhytKcbCode = result.parsed.kcb_code;
              if (result.parsed.valid_from) updates.bhytValidFrom = result.parsed.valid_from;
              if (result.parsed.five_year) updates.bhyt5Year = result.parsed.five_year;
            }
          } catch {
            errorCount++;
          } finally {
            setOcrLoadingStates((s) => ({ ...s, bhyt: false }));
          }
        })()
      );
    }

    await Promise.all(ocrTasks);

    setEditProfile((p) => ({ ...p, ...updates }));
    setOcrRunning(false);

    if (errorCount > 0) {
      toast.error(`Có ${errorCount} ảnh không thể OCR`);
    } else {
      toast.success('Trích xuất OCR thành công!');
    }
  }

  async function handleOcrCccdFront() {
    const hasImage = cccdFrontFile || docUrls.cccdFront;
    if (!hasImage) return;
    setOcrLoadingStates((s) => ({ ...s, cccdFront: true }));
    try {
      let fileToOcr = cccdFrontFile;
      if (!fileToOcr && docUrls.cccdFront) {
        fileToOcr = await fetchImageAsFile(docUrls.cccdFront, 'cccd-front.jpg');
      }
      if (!fileToOcr) {
        toast.error('Không thể tải ảnh để OCR');
        return;
      }
      const result = await fetchOcrSingle(fileToOcr, 'cccd', 'front');
      if (result.parsed) {
        const updates: Partial<ProfileData> = {};
        if (result.parsed.id) updates.cccdNumber = result.parsed.id;
        if (result.parsed.name) updates.fullName = result.parsed.name;
        if (result.parsed.dob) updates.dob = result.parsed.dob;
        if (result.parsed.address) updates.address = result.parsed.address;
        if (result.parsed.expiry) updates.cccdExpiry = result.parsed.expiry;
        setEditProfile((p) => ({ ...p, ...updates }));
        toast.success('OCR CCCD mặt trước thành công!');
      }
    } catch {
      toast.error('Lỗi OCR CCCD mặt trước');
    } finally {
      setOcrLoadingStates((s) => ({ ...s, cccdFront: false }));
    }
  }

  async function handleOcrCccdBack() {
    const hasImage = cccdBackFile || docUrls.cccdBack;
    if (!hasImage) return;
    setOcrLoadingStates((s) => ({ ...s, cccdBack: true }));
    try {
      let fileToOcr = cccdBackFile;
      if (!fileToOcr && docUrls.cccdBack) {
        fileToOcr = await fetchImageAsFile(docUrls.cccdBack, 'cccd-back.jpg');
      }
      if (!fileToOcr) {
        toast.error('Không thể tải ảnh để OCR');
        return;
      }
      const result = await fetchOcrSingle(fileToOcr, 'cccd', 'front');
      if (result.parsed) {
        const updates: Partial<ProfileData> = {};
        if (result.parsed.issued) {
          const parts = result.parsed.issued.split('\n');
          if (parts[0]) updates.issueDate = parts[0];
          if (parts[1]) updates.issuePlace = parts[1];
        }
        setEditProfile((p) => ({ ...p, ...updates }));
        toast.success('OCR CCCD mặt sau thành công!');
      }
    } catch {
      toast.error('Lỗi OCR CCCD mặt sau');
    } finally {
      setOcrLoadingStates((s) => ({ ...s, cccdBack: false }));
    }
  }

  async function handleOcrBhyt() {
    const hasImage = bhytFile || docUrls.bhyt;
    if (!hasImage) return;
    setOcrLoadingStates((s) => ({ ...s, bhyt: true }));
    try {
      let fileToOcr = bhytFile;
      if (!fileToOcr && docUrls.bhyt) {
        fileToOcr = await fetchImageAsFile(docUrls.bhyt, 'bhyt.jpg');
      }
      if (!fileToOcr) {
        toast.error('Không thể tải ảnh để OCR');
        return;
      }
      const result = await fetchOcrSingle(fileToOcr, 'bhyt', 'front');
      if (result.parsed) {
        const updates: Partial<ProfileData> = {};
        if (result.parsed.id) updates.bhytNumber = result.parsed.id;
        if (result.parsed.name) updates.bhytName = result.parsed.name;
        if (result.parsed.dob) updates.bhytDob = result.parsed.dob;
        if (result.parsed.gender) updates.bhytGender = result.parsed.gender;
        if (result.parsed.kcb) updates.bhytHospital = result.parsed.kcb;
        if (result.parsed.kcb_code) updates.bhytKcbCode = result.parsed.kcb_code;
        if (result.parsed.valid_from) updates.bhytValidFrom = result.parsed.valid_from;
        if (result.parsed.five_year) updates.bhyt5Year = result.parsed.five_year;
        setEditProfile((p) => ({ ...p, ...updates }));
        toast.success('OCR BHYT thành công!');
      }
    } catch {
      toast.error('Lỗi OCR BHYT');
    } finally {
      setOcrLoadingStates((s) => ({ ...s, bhyt: false }));
    }
  }

  async function handleSaveProfile() {
    if (!patientProfile?.id) {
      toast.error('Không tìm thấy hồ sơ');
      return;
    }

    try {
      // Split fullName into legal_last_name and legal_first_name (Vietnamese format: Họ + Tên)
      const nameParts = editProfile.fullName.trim().split(/\s+/);
      const legalLastName = nameParts[0] || '';
      const legalFirstName = nameParts.slice(1).join(' ') || '';

      const { error } = await supabase
        .from('patient')
        .update({
          legal_last_name: legalLastName,
          legal_first_name: legalFirstName,
          phone_number: editProfile.phone,
          email_address: editProfile.email,
          date_of_birth: editProfile.dob || null,
          preferred_pronouns: editProfile.pronoun,
          id_number: editProfile.cccdNumber,
          id_expiration_date: editProfile.cccdExpiry || null,
          residential_address: editProfile.address,
          id_issued_date: editProfile.issueDate || null,
          id_issuer: editProfile.issuePlace,
          insurance_provider: editProfile.bhytProvider,
          member_id: editProfile.bhytNumber,
          group_number: editProfile.bhytGroup,
          bhyt_name: editProfile.bhytName,
          bhyt_dob: editProfile.bhytDob || null,
          bhyt_gender: editProfile.bhytGender,
          bhyt_kcb_code: editProfile.bhytKcbCode,
          bhyt_kcb: editProfile.bhytHospital,
          bhyt_valid_from: editProfile.bhytValidFrom || null,
          bhyt_five_year: editProfile.bhyt5Year || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', patientProfile.id);

      if (error) throw error;

      toast.success('Đã lưu hồ sơ thành công!');
      setMode('view');
      refetch();
    } catch (e) {
      console.error('Save error:', e);
      toast.error('Không thể lưu hồ sơ');
    }
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex-1 lg:ml-[280px] flex flex-col min-h-screen">
        <TopNav />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-[920px] mx-auto">
            {/* Breadcrumb */}
            <div className="text-[14px] font-semibold text-slate-500 mb-5">
              Hồ sơ bệnh nhân AI OCR
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
              </div>
            ) : mode === 'view' ? (
              <ViewMode
                profile={profile}
                profileExists={profileExists}
                isUnlocked={isUnlocked}
                isEditing={isEditing}
                editProfile={editProfile}
                setEditProfile={setEditProfile}
                onUnlock={handleUnlockForView}
                onEdit={handleUnlockForEdit}
                onCancelEdit={handleCancelEdit}
                onSaveEdit={handleSaveEdit}
                sendingOtp={sendingOtp}
                otpPurpose={otpPurpose}
                docUrls={docUrls}
                loadingDocs={loadingDocs}
                cccdFrontFile={cccdFrontFile}
                setCccdFrontFile={setCccdFrontFile}
                cccdBackFile={cccdBackFile}
                setCccdBackFile={setCccdBackFile}
                bhytFile={bhytFile}
                setBhytFile={setBhytFile}
                ocrLoadingStates={ocrLoadingStates}
                onOcrAll={handleOcrAll}
                onOcrCccdFront={handleOcrCccdFront}
                onOcrCccdBack={handleOcrCccdBack}
                onOcrBhyt={handleOcrBhyt}
                ocrRunning={ocrRunning}
                onViewImage={(url, title) => setPreviewImage({ url, title })}
              />
            ) : (
              <EditMode
                profile={editProfile}
                setProfile={setEditProfile}
                cccdFrontFile={cccdFrontFile}
                setCccdFrontFile={setCccdFrontFile}
                cccdBackFile={cccdBackFile}
                setCccdBackFile={setCccdBackFile}
                bhytFile={bhytFile}
                setBhytFile={setBhytFile}
                existingDocUrls={docUrls}
                ocrLoadingStates={ocrLoadingStates}
                onOcrAll={handleOcrAll}
                onOcrCccdFront={handleOcrCccdFront}
                onOcrCccdBack={handleOcrCccdBack}
                onOcrBhyt={handleOcrBhyt}
                ocrRunning={ocrRunning}
                onCancel={() => setMode('view')}
                onSave={handleSaveProfile}
                onViewImage={(url, title) => setPreviewImage({ url, title })}
              />
            )}
          </div>
        </main>
      </div>

      {/* OTP Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-[18px] p-8 max-w-[440px] w-full mx-4 shadow-xl">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-teal-600" />
                </div>
                <div>
                  <h3 className="text-[18px] font-bold text-slate-800">Xác thực bảo mật OTP</h3>
                  <p className="text-[13px] text-slate-500">
                    {otpPurpose === 'edit' ? 'Xác thực để chỉnh sửa hồ sơ' : 'Bảo vệ dữ liệu Căn Cước Công Dân'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowOtpModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Mail className="h-7 w-7 text-slate-600" />
              </div>
              <p className="text-[15px] text-slate-700 mb-1">Nhập mã OTP xác thực email</p>
              <p className="text-[13px] text-slate-500">
                Mã xác thực gồm 6 chữ số đã được gửi tự động đến hộp thư:
              </p>
              <p className="text-[14px] font-bold text-slate-800 mt-1">{session?.user?.email}</p>
            </div>

            <div className="mb-4">
              <div className="text-[12px] font-bold text-slate-500 text-center mb-3 uppercase tracking-wide">
                Mã xác thực 6 chữ số
              </div>
              <div className="flex justify-center gap-2">
                {otpCode.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (otpInputRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className="w-12 h-14 text-center text-[24px] font-bold border-2 border-slate-200 rounded-lg focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between mb-6">
              <div className="text-[14px] text-slate-600">
                Hiệu lực trong:{' '}
                <span className={`font-bold ${otpTimer < 60 ? 'text-red-500' : 'text-teal-600'}`}>
                  {formatTimer(otpTimer)}
                </span>
              </div>
              <button
                onClick={handleSendOtp}
                disabled={resendCooldown > 0 || sendingOtp}
                className="text-[14px] font-semibold text-teal-600 hover:text-teal-700 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer"
              >
                {resendCooldown > 0 ? `Gửi lại (${resendCooldown}s)` : 'Gửi lại mã'}
              </button>
            </div>

            <div className="flex gap-4 pt-2">
              <button
                onClick={() => setShowOtpModal(false)}
                className="flex-1 h-[56px] px-6 border-2 border-slate-200 rounded-xl text-[15px] font-semibold text-slate-600 bg-white hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] transition-all cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={handleVerifyOtp}
                disabled={verifyingOtp || otpCode.some((d) => !d)}
                className="flex-[1.4] h-[56px] inline-flex items-center justify-center gap-3 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 disabled:from-slate-300 disabled:to-slate-300 text-white px-6 rounded-xl font-bold shadow-lg shadow-teal-600/25 hover:shadow-teal-600/40 disabled:shadow-none active:scale-[0.98] transition-all cursor-pointer"
              >
                {verifyingOtp ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ShieldCheck className="h-5 w-5" />
                )}
                <span className="flex flex-col items-start leading-tight">
                  <span className="text-[14px]">Xác nhận &</span>
                  <span className="text-[15px]">Mở khóa</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative bg-white rounded-[18px] p-4 max-w-[90vw] max-h-[90vh] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-[16px] font-bold text-slate-800">{previewImage.title}</h3>
              <button
                onClick={() => setPreviewImage(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <img
              src={previewImage.url}
              alt={previewImage.title}
              className="max-w-full max-h-[75vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// View Mode Component
function ViewMode({
  profile,
  profileExists,
  isUnlocked,
  isEditing,
  editProfile,
  setEditProfile,
  onUnlock,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  sendingOtp,
  otpPurpose,
  docUrls,
  loadingDocs,
  cccdFrontFile,
  setCccdFrontFile,
  cccdBackFile,
  setCccdBackFile,
  bhytFile,
  setBhytFile,
  ocrLoadingStates,
  onOcrAll,
  onOcrCccdFront,
  onOcrCccdBack,
  onOcrBhyt,
  ocrRunning,
  onViewImage,
}: {
  profile: ProfileData;
  profileExists: boolean;
  isUnlocked: boolean;
  isEditing: boolean;
  editProfile: ProfileData;
  setEditProfile: React.Dispatch<React.SetStateAction<ProfileData>>;
  onUnlock: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  sendingOtp: boolean;
  otpPurpose: 'view' | 'edit';
  docUrls: { cccdFront: string | null; cccdBack: string | null; bhyt: string | null };
  loadingDocs: boolean;
  cccdFrontFile: File | null;
  setCccdFrontFile: (f: File | null) => void;
  cccdBackFile: File | null;
  setCccdBackFile: (f: File | null) => void;
  bhytFile: File | null;
  setBhytFile: (f: File | null) => void;
  ocrLoadingStates: { cccdFront: boolean; cccdBack: boolean; bhyt: boolean };
  onOcrAll: () => void;
  onOcrCccdFront: () => void;
  onOcrCccdBack: () => void;
  onOcrBhyt: () => void;
  ocrRunning: boolean;
  onViewImage: (url: string, title: string) => void;
}) {
  const hasOcrData = Boolean(profile.cccdNumber || profile.bhytNumber);
  const isViewLoading = sendingOtp && otpPurpose === 'view';
  const isEditLoading = sendingOtp && otpPurpose === 'edit';
  const displayProfile = isEditing ? editProfile : profile;

  return (
    <>
      {/* Header */}
      <div className="flex flex-wrap justify-between items-start gap-4 mb-6 pb-5 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-[26px] font-extrabold text-slate-800">Hồ sơ bệnh nhân</h1>
            {hasOcrData && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                <CheckCircle className="h-3.5 w-3.5" />
                Đã trích xuất AI OCR
              </span>
            )}
          </div>
          <p className="text-[14.5px] text-slate-500">
            {hasOcrData
              ? 'Thông tin định danh và bảo hiểm y tế đã được đồng bộ an toàn trên hệ thống EMR.'
              : 'Tải lên giấy tờ định danh để hệ thống tự động trích xuất thông tin.'}
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          {isEditing ? (
            <>
              <button
                onClick={onCancelEdit}
                className="inline-flex items-center gap-2 px-5 py-2.5 border border-slate-200 rounded-[10px] text-[14px] font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
                Hủy
              </button>
              <button
                onClick={onSaveEdit}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-[10px] text-[14px] font-bold shadow-sm transition-colors cursor-pointer"
              >
                <Check className="h-4 w-4" />
                Lưu hồ sơ
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onUnlock}
                disabled={sendingOtp || isUnlocked}
                className="inline-flex items-center gap-2 px-5 py-2.5 border border-slate-200 rounded-[10px] text-[14px] font-bold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isViewLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
                ) : isUnlocked ? (
                  <Eye className="h-4 w-4 text-emerald-600" />
                ) : (
                  <EyeOff className="h-4 w-4 text-sky-600" />
                )}
                {isUnlocked ? 'Đã mở khóa' : 'Mở khóa xem đầy đủ (Gửi OTP Email)'}
              </button>
              <button
                onClick={onEdit}
                disabled={isEditLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white rounded-[10px] text-[14px] font-bold shadow-sm transition-colors cursor-pointer"
              >
                {isEditLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Pen className="h-4 w-4" />
                )}
                Chỉnh sửa hồ sơ
              </button>
            </>
          )}
        </div>
      </div>

      {/* Document Cards */}
      <div className="bg-white border border-slate-200 rounded-[14px] p-6 mb-5">
        <div className="mb-4">
          <div className="text-[16px] font-extrabold text-slate-800">Giấy tờ định danh đã tải lên</div>
          <div className="text-[13px] text-slate-500">
            {isEditing
              ? 'Tải ảnh mới hoặc OCR lại các ảnh hiện có'
              : 'Hình ảnh CCCD 2 mặt & Thẻ BHYT gốc được mã hóa lưu trữ'}
          </div>
        </div>

        {isEditing ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <UploadZone
                label="CCCD — mặt trước"
                file={cccdFrontFile}
                existingImageUrl={docUrls.cccdFront}
                isLoading={ocrLoadingStates.cccdFront}
                onFileChange={setCccdFrontFile}
                onOcr={(cccdFrontFile || docUrls.cccdFront) ? onOcrCccdFront : undefined}
                onView={(cccdFrontFile || docUrls.cccdFront) ? () => {
                  const url = cccdFrontFile ? URL.createObjectURL(cccdFrontFile) : docUrls.cccdFront;
                  if (url) onViewImage(url, 'CCCD — Mặt trước');
                } : undefined}
              />
              <UploadZone
                label="CCCD — mặt sau"
                file={cccdBackFile}
                existingImageUrl={docUrls.cccdBack}
                isLoading={ocrLoadingStates.cccdBack}
                onFileChange={setCccdBackFile}
                onOcr={(cccdBackFile || docUrls.cccdBack) ? onOcrCccdBack : undefined}
                onView={(cccdBackFile || docUrls.cccdBack) ? () => {
                  const url = cccdBackFile ? URL.createObjectURL(cccdBackFile) : docUrls.cccdBack;
                  if (url) onViewImage(url, 'CCCD — Mặt sau');
                } : undefined}
              />
              <UploadZone
                label="Bảo hiểm y tế (BHYT)"
                file={bhytFile}
                existingImageUrl={docUrls.bhyt}
                isLoading={ocrLoadingStates.bhyt}
                onFileChange={setBhytFile}
                onOcr={(bhytFile || docUrls.bhyt) ? onOcrBhyt : undefined}
                onView={(bhytFile || docUrls.bhyt) ? () => {
                  const url = bhytFile ? URL.createObjectURL(bhytFile) : docUrls.bhyt;
                  if (url) onViewImage(url, 'Bảo hiểm y tế (BHYT)');
                } : undefined}
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={onOcrAll}
                disabled={ocrRunning || (!cccdFrontFile && !cccdBackFile && !bhytFile && !docUrls.cccdFront && !docUrls.cccdBack && !docUrls.bhyt)}
                className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white px-6 py-2.5 rounded-lg text-[14px] font-bold transition-colors cursor-pointer"
              >
                {ocrRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
                OCR tất cả
              </button>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <DocumentCard
              title="CCCD — Mặt trước"
              icon={<IdCard className="h-8 w-8 text-sky-600" />}
              mainText={isUnlocked ? profile.cccdNumber : maskString(profile.cccdNumber)}
              subText={isUnlocked ? profile.fullName : '••••••••••'}
              imageUrl={isUnlocked ? docUrls.cccdFront : null}
              loading={loadingDocs}
            />
            <DocumentCard
              title="CCCD — Mặt sau"
              icon={<QrCode className="h-8 w-8 text-slate-700" />}
              mainText="Mã vạch MRZ (Đã ẩn)"
              subText={isUnlocked ? `Cấp: ${formatDate(profile.issueDate)}` : 'Cấp: ••/••/••••'}
              imageUrl={isUnlocked ? docUrls.cccdBack : null}
              loading={loadingDocs}
            />
            <DocumentCard
              title="Thẻ Bảo hiểm y tế"
              icon={<ShieldCheck className="h-8 w-8 text-emerald-600" />}
              mainText={isUnlocked ? profile.bhytNumber : maskString(profile.bhytNumber, 4, 2)}
              subText={isUnlocked ? profile.bhytHospital : '••••••••••••••••••••'}
              imageUrl={isUnlocked ? docUrls.bhyt : null}
              loading={loadingDocs}
            />
          </div>
        )}
      </div>

      {/* CCCD Info */}
      <div className="bg-white border border-slate-200 rounded-[14px] p-6 mb-5">
        <div className="flex items-center gap-2 text-[14px] font-extrabold text-slate-800 uppercase tracking-wide mb-5">
          <IdCard className="h-4 w-4 text-sky-600" />
          Thông tin tự động từ CCCD
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          {isEditing ? (
            <>
              <EditableField label="Số CCCD" value={editProfile.cccdNumber} onChange={(v) => setEditProfile((p) => ({ ...p, cccdNumber: v }))} />
              <EditableField label="Ngày hết hạn" type="date" value={editProfile.cccdExpiry} onChange={(v) => setEditProfile((p) => ({ ...p, cccdExpiry: v }))} />
            </>
          ) : (
            <>
              <InfoField label="Số CCCD" value={isUnlocked ? profile.cccdNumber : maskString(profile.cccdNumber)} />
              <InfoField label="Ngày hết hạn" value={formatDate(profile.cccdExpiry)} />
            </>
          )}
        </div>
        {isEditing ? (
          <EditableField label="Địa chỉ thường trú" value={editProfile.address} onChange={(v) => setEditProfile((p) => ({ ...p, address: v }))} className="mb-4" />
        ) : (
          <InfoField label="Địa chỉ thường trú" value={isUnlocked ? profile.address : sanitizeSensitiveDisplay(profile.address)} className="mb-4" />
        )}
        <div className="grid grid-cols-2 gap-4">
          {isEditing ? (
            <>
              <EditableField label="Ngày cấp" type="date" value={editProfile.issueDate} onChange={(v) => setEditProfile((p) => ({ ...p, issueDate: v }))} />
              <EditableField label="Nơi cấp" value={editProfile.issuePlace} onChange={(v) => setEditProfile((p) => ({ ...p, issuePlace: v }))} />
            </>
          ) : (
            <>
              <InfoField label="Ngày cấp" value={formatDate(profile.issueDate)} />
              <InfoField label="Nơi cấp" value={profile.issuePlace} />
            </>
          )}
        </div>
      </div>

      {/* Personal Info */}
      <div className="bg-white border border-slate-200 rounded-[14px] p-6 mb-5">
        <div className="flex items-center gap-2 text-[15px] font-extrabold text-slate-800 mb-5">
          <User className="h-4 w-4 text-teal-600" />
          Thông tin cá nhân
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          {isEditing ? (
            <>
              <EditableField label="Họ và tên đầy đủ" value={editProfile.fullName} onChange={(v) => setEditProfile((p) => ({ ...p, fullName: v }))} />
              <EditableField label="Ngày sinh" type="date" value={editProfile.dob} onChange={(v) => setEditProfile((p) => ({ ...p, dob: v }))} />
            </>
          ) : (
            <>
              <InfoField label="Họ và tên đầy đủ" value={profile.fullName} />
              <InfoField label="Ngày sinh" value={isUnlocked ? formatDate(profile.dob) : maskDate(profile.dob)} />
            </>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          {isEditing ? (
            <>
              <EditableField label="Số điện thoại" value={editProfile.phone} onChange={(v) => setEditProfile((p) => ({ ...p, phone: v }))} />
              <EditableField label="Địa chỉ Email" value={editProfile.email} onChange={(v) => setEditProfile((p) => ({ ...p, email: v }))} />
            </>
          ) : (
            <>
              <InfoField label="Số điện thoại" value={isUnlocked ? profile.phone : sanitizeSensitiveDisplay(profile.phone)} />
              <InfoField label="Địa chỉ Email" value={isUnlocked ? profile.email : maskEmail(profile.email)} />
            </>
          )}
        </div>
        {isEditing ? (
          <EditableField label="Đại từ xưng hô" value={editProfile.pronoun} onChange={(v) => setEditProfile((p) => ({ ...p, pronoun: v }))} />
        ) : (
          <InfoField label="Đại từ xưng hô" value={profile.pronoun} />
        )}
      </div>

      {/* BHYT Info */}
      <div className="bg-white border border-slate-200 rounded-[14px] p-6 mb-6">
        <div className="flex items-center gap-2 text-[15px] font-extrabold text-slate-800 mb-5">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          Thông tin Bảo hiểm y tế
        </div>
        {isEditing ? (
          <EditableField label="Đơn vị bảo hiểm" value={editProfile.bhytProvider} onChange={(v) => setEditProfile((p) => ({ ...p, bhytProvider: v }))} className="mb-4" />
        ) : (
          <InfoField label="Đơn vị bảo hiểm" value={profile.bhytProvider} className="mb-4" />
        )}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {isEditing ? (
            <>
              <EditableField label="Số thẻ BHYT" value={editProfile.bhytNumber} onChange={(v) => setEditProfile((p) => ({ ...p, bhytNumber: v }))} />
              <EditableField label="Mã nhóm" value={editProfile.bhytGroup} onChange={(v) => setEditProfile((p) => ({ ...p, bhytGroup: v }))} />
            </>
          ) : (
            <>
              <InfoField label="Số thẻ BHYT" value={profile.bhytNumber} highlight />
              <InfoField label="Mã nhóm" value={profile.bhytGroup} />
            </>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          {isEditing ? (
            <>
              <EditableField label="Họ tên (BHYT)" value={editProfile.bhytName} onChange={(v) => setEditProfile((p) => ({ ...p, bhytName: v }))} />
              <EditableField label="Ngày sinh (BHYT)" type="date" value={editProfile.bhytDob} onChange={(v) => setEditProfile((p) => ({ ...p, bhytDob: v }))} />
            </>
          ) : (
            <>
              <InfoField label="Họ tên (BHYT)" value={profile.bhytName} />
              <InfoField label="Ngày sinh (BHYT)" value={formatDate(profile.bhytDob)} />
            </>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          {isEditing ? (
            <>
              <EditableField label="Giới tính (BHYT)" value={editProfile.bhytGender} onChange={(v) => setEditProfile((p) => ({ ...p, bhytGender: v }))} />
              <EditableField label="Mã KCB ban đầu" value={editProfile.bhytKcbCode} onChange={(v) => setEditProfile((p) => ({ ...p, bhytKcbCode: v }))} />
            </>
          ) : (
            <>
              <InfoField label="Giới tính (BHYT)" value={profile.bhytGender} />
              <InfoField label="Mã KCB ban đầu" value={profile.bhytKcbCode} />
            </>
          )}
        </div>
        {isEditing ? (
          <EditableField label="Nơi đăng ký KCB ban đầu" value={editProfile.bhytHospital} onChange={(v) => setEditProfile((p) => ({ ...p, bhytHospital: v }))} className="mb-4" />
        ) : (
          <InfoField label="Nơi đăng ký KCB ban đầu" value={profile.bhytHospital} className="mb-4" />
        )}
        <div className="grid grid-cols-2 gap-4">
          {isEditing ? (
            <>
              <EditableField label="Có giá trị từ ngày" type="date" value={editProfile.bhytValidFrom} onChange={(v) => setEditProfile((p) => ({ ...p, bhytValidFrom: v }))} />
              <EditableField label="Ngày đủ 5 năm liên tục" type="date" value={editProfile.bhyt5Year} onChange={(v) => setEditProfile((p) => ({ ...p, bhyt5Year: v }))} />
            </>
          ) : (
            <>
              <InfoField label="Có giá trị từ ngày" value={formatDate(profile.bhytValidFrom)} />
              <InfoField label="Ngày đủ 5 năm liên tục" value={formatDate(profile.bhyt5Year)} />
            </>
          )}
        </div>
      </div>
    </>
  );
}

// Edit Mode Component
function EditMode({
  profile,
  setProfile,
  cccdFrontFile,
  setCccdFrontFile,
  cccdBackFile,
  setCccdBackFile,
  bhytFile,
  setBhytFile,
  existingDocUrls,
  ocrLoadingStates,
  onOcrAll,
  onOcrCccdFront,
  onOcrCccdBack,
  onOcrBhyt,
  ocrRunning,
  onCancel,
  onSave,
  onViewImage,
}: {
  profile: ProfileData;
  setProfile: React.Dispatch<React.SetStateAction<ProfileData>>;
  cccdFrontFile: File | null;
  setCccdFrontFile: (f: File | null) => void;
  cccdBackFile: File | null;
  setCccdBackFile: (f: File | null) => void;
  bhytFile: File | null;
  setBhytFile: (f: File | null) => void;
  existingDocUrls: { cccdFront: string | null; cccdBack: string | null; bhyt: string | null };
  ocrLoadingStates: { cccdFront: boolean; cccdBack: boolean; bhyt: boolean };
  onViewImage: (url: string, title: string) => void;
  onOcrAll: () => void;
  onOcrCccdFront: () => void;
  onOcrCccdBack: () => void;
  onOcrBhyt: () => void;
  ocrRunning: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <>
      {/* Header */}
      <div className="flex flex-wrap justify-between items-start gap-4 mb-6 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-[26px] font-extrabold text-slate-800 mb-1">
            Tạo & Hoàn thiện hồ sơ cá nhân
          </h1>
          <p className="text-[14.5px] text-slate-500">
            Tải ảnh CCCD gắn chip 2 mặt & Thẻ BHYT để AI OCR tự động quét trích xuất thông tin, hoặc
            kiểm tra chỉnh sửa trực tiếp các trường bên dưới.
          </p>
        </div>
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-2 px-5 py-2.5 border border-slate-200 rounded-[10px] text-[14px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
          Hủy & Xem chi tiết
        </button>
      </div>

      {/* Upload Section */}
      <div className="bg-white border border-slate-200 rounded-[14px] p-6 mb-5">
        <div className="text-[16px] font-bold text-slate-800 mb-1">
          Tải ảnh giấy tờ để AI OCR tự động điền (tùy chọn)
        </div>
        <div className="text-[13.5px] text-slate-500 mb-5">
          Không bắt buộc. Có thể bỏ trống và nhập thông tin thủ công. Nếu tải ảnh, hệ thống sẽ tự
          động trích xuất thông tin chính xác.
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          <UploadZone
            label="CCCD — mặt trước (tùy chọn)"
            file={cccdFrontFile}
            existingImageUrl={existingDocUrls.cccdFront}
            isLoading={ocrLoadingStates.cccdFront}
            onFileChange={setCccdFrontFile}
            onOcr={(cccdFrontFile || existingDocUrls.cccdFront) ? onOcrCccdFront : undefined}
            onView={(cccdFrontFile || existingDocUrls.cccdFront) ? () => {
              const url = cccdFrontFile ? URL.createObjectURL(cccdFrontFile) : existingDocUrls.cccdFront;
              if (url) onViewImage(url, 'CCCD — Mặt trước');
            } : undefined}
          />
          <UploadZone
            label="CCCD — mặt sau (tùy chọn)"
            file={cccdBackFile}
            existingImageUrl={existingDocUrls.cccdBack}
            isLoading={ocrLoadingStates.cccdBack}
            onFileChange={setCccdBackFile}
            onOcr={(cccdBackFile || existingDocUrls.cccdBack) ? onOcrCccdBack : undefined}
            onView={(cccdBackFile || existingDocUrls.cccdBack) ? () => {
              const url = cccdBackFile ? URL.createObjectURL(cccdBackFile) : existingDocUrls.cccdBack;
              if (url) onViewImage(url, 'CCCD — Mặt sau');
            } : undefined}
          />
          <UploadZone
            label="Bảo hiểm y tế (BHYT) (tùy chọn)"
            file={bhytFile}
            existingImageUrl={existingDocUrls.bhyt}
            isLoading={ocrLoadingStates.bhyt}
            onFileChange={setBhytFile}
            onOcr={(bhytFile || existingDocUrls.bhyt) ? onOcrBhyt : undefined}
            onView={(bhytFile || existingDocUrls.bhyt) ? () => {
              const url = bhytFile ? URL.createObjectURL(bhytFile) : existingDocUrls.bhyt;
              if (url) onViewImage(url, 'Bảo hiểm y tế (BHYT)');
            } : undefined}
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={onOcrAll}
            disabled={ocrRunning || (!cccdFrontFile && !cccdBackFile && !bhytFile && !existingDocUrls.cccdFront && !existingDocUrls.cccdBack && !existingDocUrls.bhyt)}
            className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white px-6 py-2.5 rounded-lg text-[14px] font-bold transition-colors cursor-pointer"
          >
            {ocrRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
            OCR tất cả
          </button>
        </div>
      </div>

      {/* Form Fields */}
      <div className="bg-white border border-slate-200 rounded-[14px] p-6 mb-5">
        <div className="text-[13.5px] font-extrabold text-slate-800 uppercase tracking-wide mb-5">
          Thông tin tự động từ CCCD
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <FormField
            label="Số CCCD"
            required
            value={profile.cccdNumber}
            onChange={(v) => setProfile((p) => ({ ...p, cccdNumber: v }))}
          />
          <FormField
            label="Ngày hết hạn"
            required
            type="date"
            value={profile.cccdExpiry}
            onChange={(v) => setProfile((p) => ({ ...p, cccdExpiry: v }))}
          />
        </div>
        <FormField
          label="Địa chỉ thường trú"
          required
          value={profile.address}
          onChange={(v) => setProfile((p) => ({ ...p, address: v }))}
          className="mb-4"
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Ngày cấp"
            required
            type="date"
            value={profile.issueDate}
            onChange={(v) => setProfile((p) => ({ ...p, issueDate: v }))}
          />
          <FormField
            label="Nơi cấp"
            required
            value={profile.issuePlace}
            onChange={(v) => setProfile((p) => ({ ...p, issuePlace: v }))}
          />
        </div>
      </div>

      {/* Personal Info Form */}
      <div className="bg-white border border-slate-200 rounded-[14px] p-6 mb-5">
        <div className="text-[13.5px] font-extrabold text-slate-800 uppercase tracking-wide mb-5">
          Thông tin cá nhân
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <FormField
            label="Họ và tên"
            required
            value={profile.fullName}
            onChange={(v) => setProfile((p) => ({ ...p, fullName: v }))}
          />
          <FormField
            label="Ngày sinh"
            required
            type="date"
            value={profile.dob}
            onChange={(v) => setProfile((p) => ({ ...p, dob: v }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <FormField
            label="Số điện thoại"
            value={profile.phone}
            onChange={(v) => setProfile((p) => ({ ...p, phone: v }))}
          />
          <FormField
            label="Đại từ xưng hô"
            value={profile.pronoun}
            onChange={(v) => setProfile((p) => ({ ...p, pronoun: v }))}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-8 py-3 border border-slate-200 rounded-full text-[15px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          Hủy
        </button>
        <button
          onClick={onSave}
          className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-8 py-3 rounded-full text-[16px] font-bold transition-colors cursor-pointer"
        >
          <Check className="h-5 w-5" />
          Lưu hồ sơ
        </button>
      </div>
    </>
  );
}

// Helper Components
function DocumentCard({
  title,
  icon,
  mainText,
  subText,
  imageUrl,
  loading,
}: {
  title: string;
  icon: React.ReactNode;
  mainText: string;
  subText: string;
  imageUrl?: string | null;
  loading?: boolean;
}) {
  return (
    <div className="border border-slate-200 rounded-[12px] p-4 bg-slate-50 text-center">
      <div className="text-[12px] font-bold text-slate-500 uppercase mb-3">{title}</div>
      <div className="bg-white border border-slate-200 rounded-lg p-2 mb-3 min-h-[120px] flex flex-col items-center justify-center">
        {loading ? (
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="max-h-[100px] w-auto object-contain rounded"
          />
        ) : (
          <>
            <div className="mb-2">{icon}</div>
            <div className="text-[13px] font-bold text-slate-800 tracking-wider">{mainText}</div>
            <div className="text-[11.5px] text-slate-500">{subText}</div>
          </>
        )}
      </div>
      <span className={`inline-flex items-center gap-1 text-[11.5px] font-semibold ${imageUrl ? 'text-emerald-600' : 'text-slate-500'}`}>
        {imageUrl ? (
          <>
            <Eye className="h-3 w-3" />
            Đã mở khóa xem ảnh
          </>
        ) : (
          <>
            <Lock className="h-3 w-3" />
            Đã bảo mật ảnh
          </>
        )}
      </span>
    </div>
  );
}

function InfoField({
  label,
  value,
  highlight,
  className = '',
}: {
  label: string;
  value: string;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <div className={`bg-slate-50 p-3 px-4 rounded-[10px] border border-slate-100 ${className}`}>
      <div className="text-[12px] font-bold text-slate-500 uppercase">{label}</div>
      <div
        className={`text-[15px] font-semibold mt-0.5 ${
          highlight ? 'text-teal-600' : 'text-slate-800'
        }`}
      >
        {value || '—'}
      </div>
    </div>
  );
}

function EditableField({
  label,
  value,
  onChange,
  type = 'text',
  className = '',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
}) {
  return (
    <div className={`bg-white p-3 px-4 rounded-[10px] border-2 border-teal-200 ${className}`}>
      <div className="text-[12px] font-bold text-slate-500 uppercase mb-1">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-[15px] font-semibold text-slate-800 bg-transparent border-none outline-none focus:ring-0 p-0"
      />
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  type = 'text',
  required,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-[12.5px] font-bold text-slate-600 uppercase mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 text-[15px] bg-slate-50 border border-slate-200 rounded-[10px] focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
      />
    </div>
  );
}

function UploadZone({
  label,
  file,
  existingImageUrl,
  isLoading,
  onFileChange,
  onOcr,
  onView,
}: {
  label: string;
  file: File | null;
  existingImageUrl?: string | null;
  isLoading?: boolean;
  onView?: () => void;
  onFileChange: (f: File | null) => void;
  onOcr?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasImage = file || existingImageUrl;

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (isLoading) return;
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) {
      onFileChange(f);
    }
  }

  function handleOcrClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (onOcr && !isLoading) onOcr();
  }

  function handleViewClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (onView) onView();
  }

  return (
    <div
      onClick={() => !isLoading && inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className={`relative border-2 border-dashed rounded-[12px] p-4 text-center transition-all ${
        isLoading
          ? 'border-teal-400 bg-teal-50 cursor-wait'
          : hasImage
            ? 'border-emerald-400 bg-emerald-50 cursor-pointer'
            : 'border-slate-300 bg-white hover:border-rose-400 hover:bg-rose-50 cursor-pointer'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={isLoading}
        onChange={(e) => onFileChange(e.target.files?.[0] || null)}
      />

      {isLoading && (
        <div className="absolute inset-0 bg-white/70 rounded-[10px] flex flex-col items-center justify-center z-10">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600 mb-2" />
          <span className="text-[12px] font-semibold text-teal-700">Đang OCR...</span>
        </div>
      )}

      {file ? (
        <>
          <img
            src={URL.createObjectURL(file)}
            alt={label}
            className="max-h-[80px] w-auto object-contain mx-auto rounded mb-2"
          />
          <div className="text-[12px] font-semibold text-emerald-600 mb-1 truncate px-2 max-w-full">{file.name}</div>
          <div className="text-[11px] text-slate-500">{label}</div>
          <div className="mt-2 flex items-center justify-center gap-2">
            {onView && (
              <button
                type="button"
                onClick={handleViewClick}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-600 hover:bg-slate-700 text-white text-[11px] font-semibold rounded-md transition-colors cursor-pointer"
              >
                <Eye className="h-3 w-3" />
                Xem
              </button>
            )}
            {onOcr && (
              <button
                type="button"
                onClick={handleOcrClick}
                disabled={isLoading}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-semibold rounded-md transition-colors cursor-pointer disabled:opacity-50"
              >
                <ScanLine className="h-3 w-3" />
                OCR
              </button>
            )}
          </div>
        </>
      ) : existingImageUrl ? (
        <>
          <img
            src={existingImageUrl}
            alt={label}
            className="max-h-[80px] w-auto object-contain mx-auto rounded mb-2"
          />
          <div className="text-[12px] font-semibold text-emerald-600 mb-1">Ảnh hiện tại</div>
          <div className="text-[11px] text-slate-500">{label}</div>
          <div className="text-[10px] text-teal-600 mt-1">Nhấn để thay ảnh mới</div>
          <div className="mt-2 flex items-center justify-center gap-2">
            {onView && (
              <button
                type="button"
                onClick={handleViewClick}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-600 hover:bg-slate-700 text-white text-[11px] font-semibold rounded-md transition-colors cursor-pointer"
              >
                <Eye className="h-3 w-3" />
                Xem
              </button>
            )}
            {onOcr && (
              <button
                type="button"
                onClick={handleOcrClick}
                disabled={isLoading}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-semibold rounded-md transition-colors cursor-pointer disabled:opacity-50"
              >
                <ScanLine className="h-3 w-3" />
                OCR
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="w-11 h-11 rounded-full flex items-center justify-center mx-auto mb-3 bg-rose-100 text-rose-600">
            <CloudUpload className="h-5 w-5" />
          </div>
          <div className="text-[14px] font-bold text-slate-800 mb-1">Nhấn để tải lên hoặc kéo thả</div>
          <div className="text-[12.5px] text-slate-500 mb-1">{label}</div>
          <div className="text-[11px] text-slate-400">Chỉ chấp nhận file ảnh (JPG, PNG) — tối đa 10MB</div>
        </>
      )}
    </div>
  );
}
