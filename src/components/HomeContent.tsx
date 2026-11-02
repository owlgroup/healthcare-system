import {
  Calendar,
  CalendarPlus,
  ClipboardList,
  FlaskConical,
  Heart,
  Hospital,
  MessageCircle,
  Pill,
  User,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useMyPatientProfile } from "@/hooks/useMyPatientProfile";
import { greetingForHour } from "@/lib/greeting";

type QuickActionCard = {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  path: string;
  bgColor: string;
  iconBgColor: string;
};

const QUICK_ACTIONS: QuickActionCard[] = [
  {
    icon: User,
    title: "Tài khoản",
    subtitle: "Hồ sơ cá nhân & CCCD",
    path: "/account/personal",
    bgColor: "bg-slate-100",
    iconBgColor: "bg-blue-900",
  },
  {
    icon: Calendar,
    title: "Lịch hẹn",
    subtitle: "Lịch khám tại phòng khám",
    path: "/appointments",
    bgColor: "bg-purple-100",
    iconBgColor: "bg-purple-700",
  },
  {
    icon: ClipboardList,
    title: "Khai báo y tế",
    subtitle: "Phiếu y tế ban đầu",
    path: "/health-declaration",
    bgColor: "bg-slate-50",
    iconBgColor: "bg-emerald-600",
  },
  {
    icon: FlaskConical,
    title: "Xét nghiệm",
    subtitle: "Tra cứu kết quả & tải PDF",
    path: "/labs",
    bgColor: "bg-sky-100",
    iconBgColor: "bg-sky-600",
  },
  {
    icon: Pill,
    title: "Đơn thuốc",
    subtitle: "Theo dõi & yêu cầu tái cấp",
    path: "/prescriptions",
    bgColor: "bg-pink-100",
    iconBgColor: "bg-pink-700",
  },
  {
    icon: MessageCircle,
    title: "Tin nhắn",
    subtitle: "Tư vấn bảo mật với Bác sĩ",
    path: "/messages",
    bgColor: "bg-amber-100",
    iconBgColor: "bg-amber-600",
  },
];

function displayNameFromSources(
  profileName: string | null | undefined,
  metadataName: string | null | undefined,
  email: string | null | undefined,
): string {
  const fromProfile = profileName?.trim();
  if (fromProfile) return fromProfile;

  const fromMeta = metadataName?.trim();
  if (fromMeta) return fromMeta;

  const fromEmail = email?.split("@")[0]?.trim();
  if (fromEmail) return fromEmail;

  return "bạn";
}

const HomeContent = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { data: profile } = useMyPatientProfile();

  const patientName = displayNameFromSources(
    profile?.full_name,
    typeof session?.user?.user_metadata?.full_name === "string"
      ? session.user.user_metadata.full_name
      : null,
    session?.user?.email,
  );

  const initials = patientName
    .split(" ")
    .map((w: string) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const greeting = greetingForHour(new Date().getHours());

  return (
    <main className="flex-1 overflow-y-auto p-8 lg:p-9 bg-[#F8FAFC]">
      <div className="max-w-[1240px] mx-auto">
        {/* Greeting */}
        <div className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-[28px] font-bold text-slate-800 tracking-tight">
              {greeting}, {patientName}! 👋
            </h1>
            <p className="text-slate-500 text-base mt-0.5">
              Chào mừng bạn trở lại với Cổng thông tin chăm sóc sức khỏe phòng khám RCARE.
            </p>
          </div>
          <div className="w-[50px] h-[50px] rounded-full bg-sky-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[17px] font-bold">{initials}</span>
          </div>
        </div>

        {/* Quick Action Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.path}
                to={action.path}
                className={`${action.bgColor} rounded-[18px] p-6 flex flex-col items-center text-center cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg border border-transparent select-none`}
              >
                <div
                  className={`w-14 h-14 rounded-full ${action.iconBgColor} flex items-center justify-center mb-3.5 shadow-md transition-transform hover:scale-[1.08]`}
                >
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div className="text-[17px] font-bold text-slate-800 mb-1">{action.title}</div>
                <div className="text-sm text-slate-500">{action.subtitle}</div>
              </Link>
            );
          })}
        </div>

        {/* Split Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-7">
          {/* Left: Hero All Done Card */}
          <div className="bg-white border border-slate-200 rounded-[18px] p-9 text-center flex flex-col items-center justify-center shadow-sm">
            {/* Heart Bubble Graphic */}
            <div className="relative w-[100px] h-[100px] flex items-center justify-center mb-5">
              <div className="absolute w-[82px] h-[82px] bg-pink-100 rounded-full top-0 left-2.5" />
              <div className="absolute w-12 h-12 bg-sky-100 rounded-full -bottom-1 -left-2" />
              <Heart className="relative z-10 h-[38px] w-[38px] text-slate-800" />
            </div>

            <h2 className="text-[22px] font-bold text-slate-800 mb-1.5">
              Mọi thứ đã hoàn tất!
            </h2>
            <p className="text-base text-slate-500 mb-6 max-w-[440px]">
              Hiện tại bạn không có nhiệm vụ khẩn cấp nào. Hãy đặt lịch khám định kỳ trực tiếp tại phòng khám khi cần.
            </p>

            <div className="flex gap-3 flex-wrap justify-center">
              <button
                onClick={() => navigate("/appointments/book")}
                className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-6 py-3 rounded-full text-base font-semibold transition-all hover:-translate-y-0.5"
              >
                <CalendarPlus className="h-4 w-4" />
                Đặt lịch hẹn khám
              </button>
              <button
                onClick={() => navigate("/health-declaration")}
                className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-6 py-3 rounded-full text-base font-semibold transition-colors"
              >
                <ClipboardList className="h-4 w-4" />
                Khai báo y tế
              </button>
            </div>
          </div>

          {/* Right Column Widgets */}
          <div className="flex flex-col gap-5">
            {/* Vitals Widget */}
            <div className="bg-white border border-slate-200 rounded-[18px] p-[22px] shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-slate-800">Chỉ số sinh hiệu gần nhất</h3>
                <Link
                  to="/account/vitals"
                  className="text-sm text-sky-600 font-semibold hover:underline"
                >
                  Xem tất cả
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-[10px] p-3">
                  <div className="text-[13px] text-slate-500 font-semibold">Huyết áp</div>
                  <div className="text-lg font-extrabold text-slate-800">
                    118/78 <span className="text-xs text-slate-500 font-normal">mmHg</span>
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-[10px] p-3">
                  <div className="text-[13px] text-slate-500 font-semibold">Nhịp tim</div>
                  <div className="text-lg font-extrabold text-slate-800">
                    72 <span className="text-xs text-slate-500 font-normal">bpm</span>
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-[10px] p-3">
                  <div className="text-[13px] text-slate-500 font-semibold">Cân nặng</div>
                  <div className="text-lg font-extrabold text-slate-800">
                    68.5 <span className="text-xs text-slate-500 font-normal">kg</span>
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-[10px] p-3">
                  <div className="text-[13px] text-slate-500 font-semibold">Chỉ số BMI</div>
                  <div className="text-lg font-extrabold text-emerald-600">
                    23.15 <span className="text-xs">(Chuẩn)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Upcoming Appointment Widget */}
            <div className="bg-white border border-slate-200 border-l-[5px] border-l-teal-600 rounded-[18px] p-[22px] shadow-sm">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-teal-600 uppercase mb-1.5">
                <Hospital className="h-3.5 w-3.5" />
                KHÁM TRỰC TIẾP TẠI PHÒNG KHÁM
              </div>
              <h3 className="text-[16.5px] font-bold text-slate-800 mb-1">
                Tái khám PrEP 3 tháng & Xét nghiệm máu
              </h3>
              <p className="text-sm text-slate-500 mb-3">
                BS. CKII Nguyễn Hữu Tâm · Phòng khám RCARE Quận 3
              </p>
              <div className="text-[15px] font-bold text-slate-800 mb-4 flex items-center gap-1.5">
                <span className="text-teal-600">🕐</span>
                14:30 - Thứ Năm, 15/09/2026
              </div>
              <button
                onClick={() => navigate("/appointments")}
                className="w-full py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-full text-sm font-semibold transition-colors"
              >
                Xem chi tiết lịch hẹn
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default HomeContent;
