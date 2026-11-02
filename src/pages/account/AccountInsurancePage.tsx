import { Link } from "react-router-dom";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { useMyPatientProfile } from "@/hooks/useMyPatientProfile";
import { Button } from "@/components/ui/button";
import { sanitizeSensitiveDisplay } from "@/lib/crypto";

const AccountInsurancePage = () => {
  const { data: profile, isLoading } = useMyPatientProfile();

  const hasInsurance = Boolean(
    profile
    && (
      profile.insurance_provider?.trim()
      || sanitizeSensitiveDisplay(profile.member_id) !== "—"
      || profile.bhyt_kcb?.trim()
      || profile.card_front_storage_path
    ),
  );

  // Provider name - prefer bhyt_kcb (Bảo hiểm Xã hội), fallback to insurance_provider
  const providerDisplay =
    profile?.bhyt_kcb?.trim()
    || profile?.insurance_provider?.trim()
    || "Chưa có thông tin";

  // KCB hospital
  const kcbHospital = profile?.bhyt_kcb?.trim() || "—";

  // Member ID (BHYT number)
  const memberIdDisplay = profile?.member_id?.trim() || "—";

  // Validity dates
  const validFrom = profile?.bhyt_valid_from?.trim() || "";
  const validTo = profile?.bhyt_five_year?.trim() || "";
  const validityDisplay = validFrom && validTo
    ? `${validFrom} — ${validTo}`
    : validFrom || validTo || "—";

  // Check if insurance is active (simple check - has data)
  const isActive = hasInsurance;

  return (
    <section className="space-y-6 mx-auto" style={{ maxWidth: 1168 }}>
      {/* Breadcrumb */}
      <div className="text-sm text-slate-500">Thông tin thẻ Bảo hiểm y tế</div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
        </div>
      ) : hasInsurance ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          {/* Header */}
          <div className="mb-6 border-b border-slate-200 pb-5">
            <h2 className="text-[22px] font-bold text-slate-800">
              Thông tin thẻ Bảo hiểm Y tế
            </h2>
            <p className="mt-1 text-[15px] text-slate-500">
              Thẻ bảo hiểm y tế đã liên kết và áp dụng mức miễn giảm khám chữa bệnh.
            </p>
          </div>

          {/* Insurance Card */}
          <div
            className="rounded-xl border-[1.5px] border-sky-200 p-5"
            style={{
              background: "linear-gradient(135deg, #F0F9FF, #FFFFFF)",
            }}
          >
            {/* Top row: Provider info + Status */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-6 w-6 text-emerald-500" />
                <div>
                  <div className="text-[16px] font-bold text-slate-800">
                    Bảo hiểm Xã hội {providerDisplay}
                  </div>
                  <div className="text-[13px] text-slate-500">
                    Nơi KCB ban đầu: <b className="text-slate-700">{kcbHospital}</b>
                  </div>
                </div>
              </div>

              {/* Status badge */}
              {isActive && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[12px] font-bold text-emerald-600">
                  <Check className="h-3.5 w-3.5" />
                  Đang hiệu lực
                </span>
              )}
            </div>

            {/* Bottom row: Member ID + Validity */}
            <div className="mt-4 grid grid-cols-1 gap-4 border-t border-sky-100 pt-4 sm:grid-cols-2">
              <div>
                <div className="text-[12px] font-bold uppercase tracking-wide text-slate-500">
                  Mã số thẻ BHYT
                </div>
                <div className="mt-1 text-[16px] font-extrabold text-teal-600">
                  {memberIdDisplay}
                </div>
              </div>
              <div>
                <div className="text-[12px] font-bold uppercase tracking-wide text-slate-500">
                  Thời hạn giá trị
                </div>
                <div className="mt-1 text-[15px] font-semibold text-slate-800">
                  {validityDisplay}
                </div>
              </div>
            </div>
          </div>

        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
            <ShieldCheck className="h-8 w-8 text-slate-400" strokeWidth={1.5} />
          </div>
          <p className="text-base font-semibold text-slate-800">Chưa có dữ liệu BHYT</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
            Bạn có thể khai báo bảo hiểm cùng với CCCD thông qua hệ thống AI OCR.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild className="min-w-[180px] bg-teal-600 hover:bg-teal-700">
              <Link to="/ocr-profile">Khai báo BHYT</Link>
            </Button>
          </div>
        </div>
      )}
    </section>
  );
};

export default AccountInsurancePage;
