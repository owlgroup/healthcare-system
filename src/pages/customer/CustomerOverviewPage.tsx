import { LayoutGrid, CalendarDays, FileUser, Users } from "lucide-react";

const CustomerOverviewPage = () => (
  <div className="max-w-3xl">
    <h1 className="text-2xl font-bold text-foreground">Bảng tổng quan</h1>
    <p className="text-sm text-muted-foreground mt-2">
      Chào mừng đến Portal Nhân viên. Menu bên trái chỉ hiển thị các mục theo quyền được gán cho vai trò của bạn.
    </p>
    <div className="grid gap-4 mt-8 sm:grid-cols-2 lg:grid-cols-3">
      {[
        { icon: FileUser, label: "Hồ sơ bệnh nhân (Admin)", perm: "VIEW_PATIENT" },
        { icon: Users, label: "Bệnh nhân (module BS)", perm: "VIEW_PROVIDER_PATIENTS" },
        { icon: CalendarDays, label: "Lịch hẹn", perm: "VIEW_APPOINTMENT" },
        { icon: LayoutGrid, label: "Tổng quan", perm: "Luôn hiển thị" },
      ].map(({ icon: Icon, label, perm }) => (
        <div key={label} className="rounded-xl border bg-card p-4">
          <Icon className="h-5 w-5 text-primary mb-2" />
          <p className="font-semibold text-sm">{label}</p>
          <p className="text-xs text-muted-foreground mt-1">{perm}</p>
        </div>
      ))}
    </div>
  </div>
);

export default CustomerOverviewPage;
