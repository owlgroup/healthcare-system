import { useCallback, useEffect, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Camera, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  getMyDoctorProfile,
  updateMyDoctorPin,
  type DoctorProfile,
} from '@/lib/doctor-profile-api';
import {
  uploadDoctorAvatar,
  validateAvatarFile,
  createAvatarSignedUrl,
} from '@/lib/doctor-avatar-api';

export default function DoctorProfilePage() {
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPin, setShowPin] = useState(false);
  const [changingPin, setChangingPin] = useState(false);
  const [editingPin, setEditingPin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyDoctorProfile();
      setProfile(data);
      if (data.avatar_storage_path) {
        const url = await createAvatarSignedUrl(data.avatar_storage_path);
        setAvatarUrl(url);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleChangePin = async () => {
    if (newPin !== confirmPin) {
      toast.error('Hai mã PIN không khớp');
      return;
    }
    if (!/^\d{6}$/.test(newPin)) {
      toast.error('Mã PIN phải gồm 6 chữ số');
      return;
    }
    setChangingPin(true);
    try {
      await updateMyDoctorPin(newPin);
      toast.success('Đã cập nhật mã PIN ký duyệt');
      setNewPin('');
      setConfirmPin('');
      setEditingPin(false);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setChangingPin(false);
    }
  };

  const handleCancelPinEdit = () => {
    setEditingPin(false);
    setNewPin('');
    setConfirmPin('');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = validateAvatarFile(file);
    if (validationError) {
      toast.error(validationError);
      e.target.value = '';
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleUploadAvatar = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !profile) return;

    setUploadingAvatar(true);
    try {
      const { storagePath } = await uploadDoctorAvatar(profile.user_id, file);
      const url = await createAvatarSignedUrl(storagePath);
      setAvatarUrl(url);
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.success('Đã cập nhật ảnh đại diện');
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCancelPreview = () => {
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'BS';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    // Vietnamese names: use the last two parts (e.g. "Lê Thị Hồng Xoan" → "HX")
    return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return <p className="text-sm text-muted-foreground">Không tải được hồ sơ bác sĩ.</p>;
  }

  const isPinLocked = profile.pin_locked_until
    && new Date(profile.pin_locked_until) > new Date();

  const isActive = profile.status === 'active';
  const pin = profile.sign_pin_plain;
  const pinText = pin
    ? (showPin ? `${pin.slice(0, 3)} ${pin.slice(3)}` : '••• •••')
    : '—';

  return (
    <div className="mx-auto flex w-full max-w-[1080px] flex-wrap overflow-hidden rounded-xl border bg-card text-sm">
      {/* Identity panel */}
      <aside className="flex min-w-0 flex-[1_1_260px] flex-col border-b border-r bg-muted/40 px-6 pb-5 pt-7">
        <div className="flex flex-col items-center gap-2.5 pb-5 text-center">
          <div className="group relative">
            <Avatar className="h-24 w-24">
              <AvatarImage src={previewUrl ?? avatarUrl ?? undefined} alt={profile.full_name ?? 'Ảnh đại diện'} />
              <AvatarFallback className="bg-primary text-[28px] font-bold tracking-wide text-primary-foreground">
                {getInitials(profile.full_name)}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity duration-200 focus-visible:opacity-100 group-hover:opacity-100"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Chọn ảnh đại diện"
            >
              <Camera className="h-6 w-6 text-white" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png, image/jpeg, image/webp"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-lg font-bold tracking-tight">{profile.full_name ?? '—'}</span>
            <span className="text-muted-foreground">
              {profile.specialty ? `Bác sĩ chuyên khoa ${profile.specialty}` : 'Bác sĩ'}
            </span>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
              isActive ? 'text-green-700' : 'text-muted-foreground'
            }`}
          >
            <span className={`h-[7px] w-[7px] rounded-full ${isActive ? 'bg-green-500' : 'bg-muted-foreground'}`} />
            {isActive ? 'Đang hoạt động' : profile.status}
          </span>
          {previewUrl ? (
            <div className="mt-1 flex items-center gap-2">
              <Button size="sm" className="h-8" onClick={() => void handleUploadAvatar()} disabled={uploadingAvatar}>
                {uploadingAvatar && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Lưu ảnh
              </Button>
              <Button size="sm" variant="outline" className="h-8" onClick={handleCancelPreview} disabled={uploadingAvatar}>
                Hủy
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="mt-1 h-[30px] bg-card px-3 text-xs font-medium"
              onClick={() => fileInputRef.current?.click()}
            >
              Đổi ảnh đại diện
            </Button>
          )}
        </div>

        <InfoRow label="Email" value={profile.email} />
        <InfoRow label="Điện thoại" value={profile.phone ?? '—'} mono />
        <InfoRow label="Chuyên khoa" value={profile.specialty ?? '—'} />

        <div className="flex-1" />
        <span className="pt-3.5 text-center text-[11px] text-muted-foreground">
          Ảnh PNG, JPEG, WebP · tối đa 5MB
        </span>
      </aside>

      {/* PIN panel */}
      <section className="flex min-w-0 flex-[999_1_380px] flex-col gap-[18px] px-[clamp(16px,3vw,32px)] py-7">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">Mã PIN ký duyệt</h2>
          <p className="max-w-[520px] leading-relaxed text-muted-foreground">
            Dùng khi Hoàn tất &amp; Ký duyệt hồ sơ SOAP. Mã được cấp tự động khi tạo tài khoản bác sĩ.
          </p>
        </div>

        {isPinLocked && (
          <Alert variant="destructive">
            <Lock className="h-4 w-4" />
            <AlertDescription className="text-xs">
              PIN bị khóa đến{' '}
              {format(parseISO(profile.pin_locked_until!), 'HH:mm dd/MM/yyyy', { locale: vi })}
              {' '}do nhập sai nhiều lần.
            </AlertDescription>
          </Alert>
        )}

        <div className="rounded-[10px] border">
          <div className="flex flex-wrap items-center gap-4 px-[18px] py-4">
            <div className="flex min-w-[140px] flex-1 flex-col gap-0.5">
              <span className="font-semibold">Mã PIN hiện tại</span>
              {profile.pin_set_at && (
                <span className="text-xs text-muted-foreground">
                  Cập nhật {format(parseISO(profile.pin_set_at), 'HH:mm · dd/MM/yyyy', { locale: vi })}
                </span>
              )}
            </div>
            <span className="whitespace-nowrap font-mono text-lg font-semibold tracking-[0.25em]">{pinText}</span>
            {pin && (
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="h-[30px] cursor-pointer whitespace-nowrap rounded-md px-2.5 font-semibold text-primary transition-colors duration-200 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {showPin ? 'Ẩn mã' : 'Hiện mã'}
              </button>
            )}
          </div>

          {!editingPin ? (
            <div className="flex flex-wrap items-center gap-4 border-t px-[18px] py-4">
              <div className="flex min-w-[140px] flex-1 flex-col gap-0.5">
                <span className="font-semibold">Đổi mã PIN</span>
                <span className="text-xs text-muted-foreground">Mã gồm 6 chữ số</span>
              </div>
              <Button variant="outline" size="sm" className="h-8 px-3.5 font-medium" onClick={() => setEditingPin(true)}>
                Đổi mã
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3.5 rounded-b-[10px] border-t bg-muted/40 px-[18px] py-4">
              <span className="font-semibold">Đổi mã PIN</span>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <Label htmlFor="new-pin" className="text-xs font-medium">PIN mới</Label>
                  <Input
                    id="new-pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="6 chữ số"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                    className="h-[38px] bg-card font-mono text-[15px] tracking-[0.3em] placeholder:font-sans placeholder:text-sm placeholder:tracking-normal"
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <Label htmlFor="confirm-pin" className="text-xs font-medium">Nhập lại PIN</Label>
                  <Input
                    id="confirm-pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="6 chữ số"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                    className="h-[38px] bg-card font-mono text-[15px] tracking-[0.3em] placeholder:font-sans placeholder:text-sm placeholder:tracking-normal"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-muted-foreground"
                  onClick={handleCancelPinEdit}
                  disabled={changingPin}
                >
                  Hủy
                </Button>
                <Button
                  size="sm"
                  className="h-8 px-3.5 font-semibold"
                  onClick={() => void handleChangePin()}
                  disabled={changingPin || newPin.length !== 6 || confirmPin.length !== 6}
                >
                  {changingPin && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Lưu PIN mới
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function InfoRow({
  label, value, mono = false,
}: {
  label: string; value: string; mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-t py-[11px]">
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{label}</span>
      <span className={`break-all font-medium ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}
