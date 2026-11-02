import { useState } from "react";
import { ArrowLeft, CheckCircle2, Pill, ImageIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TopNav from "@/components/TopNav";
import Sidebar from "@/components/Sidebar";
import { Badge } from "@/components/ui/badge";

const prescriptionData = {
  code: "#BN00000359",
  date: "24/09/2020",
  facility: "PHÒNG KHÁM NHI THẠC SĨ - Đức Hoà, LA",
  doctor: "ThS.BS. Phạm Thị Thanh Hằng",
  patient: {
    name: "NGUYỄN HOÀI THƯƠNG",
    birthDate: "6 tuổi 1 tháng (Nam)",
  },
  issueDate: "24/09/2020",
  diagnosis: "Chàm Da",
  imagePath: "/prescription-sample.png",
  medications: [
    {
      name: "Amox Ngọt",
      quantity: "09 Viên",
      instructions: "Sáng 1; Trưa 1; Chiều 1",
    },
    {
      name: "PRED 5mg (uống sau ăn)",
      quantity: "06 Viên",
      instructions: "Sáng 2",
    },
    {
      name: "Calcikid",
      quantity: "06 Ống",
      instructions: "Sáng 1; Chiều 1",
    },
    {
      name: "Forte",
      quantity: "06 Tuýp",
      instructions: "Thoa da 2 lần / ngày",
    },
    {
      name: "Peri",
      quantity: "03 Viên",
      instructions: "Sáng 1/2; Chiều 1/2",
    },
    {
      name: "LysinKid",
      quantity: "45 Chai",
      instructions: "Sáng 5ml; Trưa 5ml; Chiều 5ml",
    },
  ],
};

const PrescriptionDetail = () => {
  const navigate = useNavigate();
  const [imageError, setImageError] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <TopNav />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:ml-[280px]">
          <div className="max-w-7xl mx-auto">
            {/* Breadcrumb */}
            <p className="text-sm text-slate-500 mb-4">Danh sách đơn thuốc</p>

            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-pink-100 flex items-center justify-center flex-shrink-0">
                  <Pill className="h-5 w-5 text-pink-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-800">Chi tiết Đơn thuốc</h1>
                  <p className="text-sm text-slate-500 mt-1">
                    Mã đơn thuốc: <span className="font-semibold text-pink-600">{prescriptionData.code}</span>
                    {" · "}Ngày cấp: <span className="font-semibold text-slate-700">{prescriptionData.date}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge className="bg-emerald-50 text-emerald-600 border border-emerald-200 font-medium px-3 py-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  Đang sử dụng
                </Badge>
                <button
                  onClick={() => navigate("/prescriptions")}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Quay lại
                </button>
              </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {/* Left: Prescription Image */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Ảnh chụp tải lên</h2>
                  <Badge className="bg-emerald-50 text-emerald-600 border border-emerald-200 font-medium text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Đã quét thành công
                  </Badge>
                </div>
                <div className="p-5">
                  <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                    {!imageError ? (
                      <img
                        src={prescriptionData.imagePath}
                        alt="Ảnh đơn thuốc"
                        className="w-full h-auto object-contain"
                        onError={() => setImageError(true)}
                      />
                    ) : (
                      <div className="aspect-[3/4] flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 p-8">
                        <div className="w-16 h-16 mb-4 rounded-full bg-slate-200 flex items-center justify-center">
                          <ImageIcon className="h-8 w-8 text-slate-400" />
                        </div>
                        <p className="text-sm font-medium text-slate-500 mb-1">Chưa có ảnh đơn thuốc</p>
                        <p className="text-xs text-slate-400 text-center">
                          Upload ảnh vào <code className="bg-slate-200 px-1 rounded">public/prescription-sample.jpg</code>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Extracted Data */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Thông tin Đơn thuốc</h2>
                </div>
                <div className="p-5">
                  {/* Form Fields */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="col-span-2">
                      <label className="text-[11px] text-slate-500 mb-1 block">Cơ sở y tế</label>
                      <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800">
                        {prescriptionData.facility}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className="text-[11px] text-slate-500 mb-1 block">Bác sĩ kê đơn</label>
                      <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800">
                        {prescriptionData.doctor}
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 mb-1 block">Họ tên bệnh nhân</label>
                      <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800">
                        {prescriptionData.patient.name}
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 mb-1 block">Năm sinh</label>
                      <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800">
                        {prescriptionData.patient.birthDate}
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 mb-1 block">Ngày cấp</label>
                      <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800">
                        {prescriptionData.issueDate}
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 mb-1 block">Chẩn đoán</label>
                      <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800">
                        {prescriptionData.diagnosis}
                      </div>
                    </div>
                  </div>

                  {/* Medications Section */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 mb-3">Danh sách Thuốc</h3>
                    <div className="space-y-4">
                      {prescriptionData.medications.map((med, idx) => (
                        <div key={idx} className="border border-slate-200 rounded-lg p-4">
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div>
                              <label className="text-[11px] text-slate-500 mb-1 block">Tên thuốc & Hàm lượng</label>
                              <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-800">
                                {med.name}
                              </div>
                            </div>
                            <div>
                              <label className="text-[11px] text-slate-500 mb-1 block">Số lượng</label>
                              <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800">
                                {med.quantity}
                              </div>
                            </div>
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500 mb-1 block">Cách dùng</label>
                            <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800">
                              {med.instructions}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default PrescriptionDetail;
