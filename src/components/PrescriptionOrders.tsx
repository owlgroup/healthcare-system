import { Pill, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

const prescriptionOrders = [
  {
    facility: "Phòng Khám Nhi Thạc Sĩ - Đức Hoà, LA",
    diagnosis: "Chàm Da",
    date: "Ngày cấp 24/09/2020",
    status: "Đang sử dụng",
    statusKey: "active" as const,
    action: "Xem đơn thuốc",
    icon: Pill,
    iconBg: "bg-pink-50",
    iconColor: "text-pink-500",
  },
];

const PrescriptionOrders = () => {
  const navigate = useNavigate();

  const handleViewPrescription = () => {
    navigate("/prescriptions/detail");
  };

  return (
    <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:ml-[280px]">
      <div className="max-w-4xl mx-auto">
        {/* Hero Header */}
        <div className="rounded-2xl bg-gradient-to-r from-pink-50 to-pink-100/50 p-6 md:p-8 mb-8 border border-pink-100">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-2">
            Đơn thuốc & <span className="text-pink-600">theo dõi</span>
          </h1>
          <p className="text-slate-600 text-sm md:text-base max-w-xl leading-relaxed">
            Quản lý đơn thuốc được kê. Theo dõi lịch uống thuốc và tải lên đơn thuốc từ cơ sở y tế khác.
          </p>
        </div>

        {/* Prescription Orders List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-800">Đơn thuốc gần đây</h2>
            <Badge variant="outline" className="border-pink-200 bg-pink-50 text-pink-700 font-semibold text-xs px-3 py-1">
              {prescriptionOrders.length} đơn thuốc
            </Badge>
          </div>

          {prescriptionOrders.map((order, idx) => {
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
                      Cơ sở y tế
                    </p>
                    <p className="text-sm font-semibold text-slate-700">{order.facility}</p>
                    <p className="text-base font-bold text-slate-800 mt-0.5">{order.diagnosis}</p>
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
                      onClick={handleViewPrescription}
                      className="rounded-lg px-4 py-2.5 text-sm font-semibold transition-all flex items-center gap-2 bg-pink-600 text-white hover:bg-pink-700 shadow-sm"
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

export default PrescriptionOrders;
