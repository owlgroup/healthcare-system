import {
  Users, Shield, ClipboardList, Trash2, Database, Radio, UserPlus,
  FlaskConical, Link2, MessageSquare,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const statsCards = [
  { icon: Users,         value: "1,402",   label: "Phiên hoạt động",    badge: "+12%",         badgeColor: "text-primary bg-accent" },
  { icon: Database,      value: "Tốt",     label: "Trạng thái máy chủ", badge: "99.9%",        badgeColor: "text-primary bg-accent" },
  { icon: ClipboardList, value: "42",      label: "Chờ xác nhận",       badge: "Ưu tiên cao",  badgeColor: "text-warning bg-warning/10" },
  { icon: Shield,        value: "0",       label: "Cảnh báo hệ thống",  badge: "3 đang hoạt động",  badgeColor: "text-destructive bg-destructive/10" },
];

const chartData = [
  { name: "T2", traffic: 300, capacity: 200 },
  { name: "T3", traffic: 450, capacity: 280 },
  { name: "T4", traffic: 680, capacity: 350 },
  { name: "T5", traffic: 520, capacity: 400 },
  { name: "T6", traffic: 430, capacity: 350 },
  { name: "T7", traffic: 580, capacity: 420 },
  { name: "CN", traffic: 490, capacity: 380 },
];

const quickActions = [
  { icon: Trash2,    label: "Xóa bộ nhớ đệm" },
  { icon: Database,  label: "Sao lưu cơ sở dữ liệu" },
  { icon: Radio,     label: "Thông báo hệ thống" },
];

const activityLog = [
  { icon: UserPlus,     label: "Người dùng mới đăng ký",    desc: "Mã #99023 hoàn tất quy trình đăng ký lâm sàng",        time: "2 phút trước",  color: "bg-success/20 text-success" },
  { icon: FlaskConical, label: "Kết quả xét nghiệm đã tải", desc: "Nhập tự động từ phòng xét nghiệm Quest Diagnostics thành công", time: "14 phút trước", color: "bg-primary/10 text-primary" },
  { icon: Link2,        label: "Kết nối API được khôi phục", desc: "Dịch vụ xác thực Auth-Gateway-01 kết nối lại sau khi quá hạn", time: "45 phút trước", color: "bg-accent text-accent-foreground" },
  { icon: Shield,       label: "Thông tin xác thực quản trị đã cập nhật", desc: "Xoay vòng khóa bảo mật bởi quản trị viên Nguyễn Văn Minh", time: "1 giờ trước", color: "bg-warning/20 text-warning" },
];

const AdminOverview = () => (
  <div className="max-w-6xl mx-auto">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Tổng quan hệ thống</h1>
        <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
          <span className="h-2 w-2 rounded-full bg-success" />
          Tất cả hệ thống hoạt động bình thường. Đồng bộ lần cuối: 2 phút trước.
        </p>
      </div>
      <div className="flex gap-3">
        <button type="button" className="rounded-lg border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors">
          Xuất báo cáo
        </button>
        <button type="button" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity">
          Triển khai mới
        </button>
      </div>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {statsCards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div key={idx} className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${card.badgeColor}`}>
                {card.badge}
              </span>
            </div>
            <p className="text-2xl font-bold text-foreground">{card.value}</p>
            <p className="text-xs text-muted-foreground">{card.label}</p>
          </div>
        );
      })}
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      <div className="lg:col-span-2 rounded-xl border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-foreground">Sức khỏe hệ thống</h3>
            <p className="text-xs text-muted-foreground">Thông lượng API và xu hướng lưu lượng (24 giờ)</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip />
            <Bar dataKey="traffic" name="Lưu lượng" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="capacity" name="Công suất" fill="hsl(var(--primary) / 0.25)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl bg-primary p-6 text-primary-foreground">
        <h3 className="text-lg font-bold mb-4">Thao tác nhanh</h3>
        <div className="space-y-3">
          {quickActions.map((action, idx) => {
            const Icon = action.icon;
            return (
              <button
                key={idx}
                type="button"
                className="flex items-center gap-3 w-full rounded-lg bg-primary-foreground/15 px-4 py-3 text-sm font-medium hover:bg-primary-foreground/25 transition-colors"
              >
                <Icon className="h-5 w-5" />
                {action.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 rounded-xl border bg-card p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-foreground">Nhật ký hoạt động gần đây</h3>
          <button type="button" className="text-sm font-semibold text-primary hover:underline">Xem tất cả</button>
        </div>
        <div className="space-y-3">
          {activityLog.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="flex items-center gap-4 rounded-lg bg-muted/50 p-4">
                <div className={`h-10 w-10 rounded-full ${item.color} flex items-center justify-center flex-shrink-0`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.desc}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{item.time}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-xl border bg-card p-6">
          <h3 className="text-lg font-bold text-foreground mb-4">Tài nguyên máy chủ</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-1">
                <span className="text-muted-foreground">CPU</span>
                <span className="text-primary">42%</span>
              </div>
              <Progress value={42} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-1">
                <span className="text-muted-foreground">BỘ NHỚ</span>
                <span className="text-primary">68%</span>
              </div>
              <Progress value={68} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-1">
                <span className="text-muted-foreground">LƯU TRỮ</span>
                <span className="text-foreground">1.2 TB / 2.0 TB</span>
              </div>
              <Progress value={60} className="h-2" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-success/10 p-3">
            <div className="h-8 w-8 rounded-full bg-success/20 flex items-center justify-center">
              <Shield className="h-4 w-4 text-success" />
            </div>
            <div>
              <p className="text-sm font-semibold text-success">Tự động mở rộng đã bật</p>
              <p className="text-xs text-muted-foreground">Đang quản lý 12 máy chủ hoạt động</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-foreground p-6 text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-muted/20 flex items-center justify-center mb-3">
            <MessageSquare className="h-7 w-7 text-background" />
          </div>
          <h3 className="text-lg font-bold text-primary mb-1">Cần hỗ trợ hệ thống?</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Đội ngũ kỹ thuật sẵn sàng 24/7 cho các sự cố vận hành khẩn cấp.
          </p>
          <button type="button" className="w-full rounded-lg bg-foreground/80 border border-muted-foreground/30 py-2.5 text-sm font-semibold text-background hover:opacity-90 transition-opacity">
            Bắt đầu trò chuyện
          </button>
        </div>
      </div>
    </div>
  </div>
);

export default AdminOverview;
