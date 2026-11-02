import { FlaskConical, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

const labOrders = [
  {
    vendor: "MedLab Việt Nam",
    name: "Xét nghiệm chuyển hóa toàn diện",
    date: "Đặt ngày 12/10/2023",
    status: "Sẵn sàng",
    statusKey: "ready" as const,
    action: "Xem kết quả",
    icon: FlaskConical,
    iconBg: "bg-red-50",
    iconColor: "text-red-500",
  },
];

const LabOrders = () => {
  const navigate = useNavigate();

  const handleViewResult = () => {
    navigate("/labs/detail");
  };

  return (
    <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:ml-[280px]">
      <div className="max-w-4xl mx-auto">
        {/* Hero Header */}
        <div className="rounded-2xl bg-gradient-to-r from-rose-50 to-rose-100/50 p-6 md:p-8 mb-8 border border-rose-100">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-2">
            Kết quả xét nghiệm & <span className="text-teal-600">theo dõi</span>
          </h1>
          <p className="text-slate-600 text-sm md:text-base max-w-xl leading-relaxed">
            Cập nhật hành trình sức khỏe của bạn. Theo dõi đơn hàng đang xử lý
            và tải lên hồ sơ từ cơ sở y tế khác một cách an toàn.
          </p>
        </div>

        {/* Lab Orders List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-800">Đơn xét nghiệm gần đây</h2>
            <Badge variant="outline" className="border-teal-200 bg-teal-50 text-teal-700 font-semibold text-xs px-3 py-1">
              {labOrders.length} hồ sơ đang hoạt động
            </Badge>
          </div>

          {labOrders.map((order, idx) => {
            const Icon = order.icon;
            return (
              <div
                key={idx}
                className="rounded-xl border border-slate-200 bg-white p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`h-12 w-12 rounded-xl ${order.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`h-5 w-5 ${order.iconColor}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Đơn vị thực hiện
                    </p>
                    <p className="text-sm font-semibold text-slate-700">{order.vendor}</p>
                    <p className="text-base font-bold text-slate-800 mt-0.5">{order.name}</p>
                    <p className="text-xs text-slate-500 mt-1">{order.date}</p>
                  </div>

                  {/* Status & Action */}
                  <div className="flex flex-col items-end gap-3 flex-shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-medium text-emerald-600">
                        {order.status}
                      </span>
                    </div>
                    <button
                      onClick={handleViewResult}
                      className="rounded-lg px-4 py-2.5 text-sm font-semibold transition-all flex items-center gap-2 bg-teal-600 text-white hover:bg-teal-700 shadow-sm"
                    >
                      <Eye className="h-4 w-4" />
                      {order.action}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
};

export default LabOrders;
