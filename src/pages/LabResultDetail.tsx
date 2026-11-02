import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TopNav from "@/components/TopNav";
import Sidebar from "@/components/Sidebar";
import { Badge } from "@/components/ui/badge";

const labResultData = {
  labCode: "#LAB-2025-8839",
  provider: "Quest Diagnostics (ISO 15189:2022)",
  providerFull: "QUEST DIAGNOSTICS VIETNAM",
  patient: {
    name: "LÂM MINH TRÍ",
    pid: "#BN-079094",
    birthYear: "1994",
    gender: "Nam",
    doctor: "BS. CKII Nguyễn Hữu Tâm",
    sampleTime: "22/12/2025 - 08:30",
    resultTime: "22/12/2025 - 16:45",
  },
  results: [
    { name: "HIV 1/2 Ag/Ab Combo", fullName: "HIV 1/2 Ag/Ab Combo (Xét nghiệm HIV)", value: "Âm tính (Negative)", reference: "< 1.0", unit: "S/CO", method: "ECLIA Roche", status: "negative" },
    { name: "Creatinine Huyết thanh", fullName: "Creatinine Huyết thanh (Chức năng thận)", value: "0.92", reference: "0.70 - 1.20", unit: "mg/dL", method: "ECLIA Roche", status: "normal" },
    { name: "eGFR", fullName: "eGFR (Mức lọc cầu thận ước tính)", value: "108", reference: "≥ 90.0", unit: "mL/min/1.73m²", method: "ECLIA Roche", status: "info" },
    { name: "ALT / SGPT", fullName: "ALT / SGPT (Men gan)", value: "24", reference: "< 41.0", unit: "U/L", method: "ECLIA Roche", status: "normal" },
    { name: "AST / SGOT", fullName: "AST / SGOT (Men gan)", value: "22", reference: "< 40.0", unit: "U/L", method: "ECLIA Roche", status: "normal" },
    { name: "Syphilis TP", fullName: "Syphilis TP (Tầm soát Giang mai)", value: "Âm tính (Negative)", reference: "< 1.0", unit: "S/CO", method: "ECLIA Roche", status: "negative" },
  ],
};

const LabResultDetail = () => {
  const navigate = useNavigate();

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "negative":
        return "bg-emerald-50 text-emerald-600 border-emerald-200";
      case "info":
        return "bg-blue-50 text-blue-600 border-blue-200";
      default:
        return "bg-slate-50 text-slate-600 border-slate-200";
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <TopNav />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:ml-[280px]">
          <div className="max-w-7xl mx-auto">
            {/* Breadcrumb */}
            <p className="text-sm text-slate-500 mb-4">Kết quả xét nghiệm</p>

            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">🧪</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-800">Chi tiết Kết quả Xét nghiệm</h1>
                  <p className="text-sm text-slate-500 mt-1">
                    Mã xét nghiệm: <span className="font-semibold text-teal-600">{labResultData.labCode}</span>
                    {" · "}Đơn vị: <span className="font-semibold text-teal-600">{labResultData.provider}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge className="bg-emerald-50 text-emerald-600 border border-emerald-200 font-medium px-3 py-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  Đã có kết quả
                </Badge>
                <button
                  onClick={() => navigate("/labs")}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Quay lại
                </button>
              </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {/* Left: Original Document */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Bản gốc tải lên</h2>
                  <Badge className="bg-emerald-50 text-emerald-600 border border-emerald-200 font-medium text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Đã quét thành công
                  </Badge>
                </div>
                <div className="p-5">
                  <div className="bg-gradient-to-b from-slate-50 to-slate-100/50 rounded-lg p-5 border border-slate-200">
                    {/* Document Header */}
                    <div className="text-center pb-4 mb-4 border-b-2 border-teal-500">
                      <p className="text-sm font-bold text-teal-600 tracking-wide">{labResultData.providerFull}</p>
                      <p className="text-[10px] text-slate-500 mt-1">ISO 15189:2022 · Mã: #SMP-8839-QD</p>
                      <p className="text-[10px] text-slate-500">Khoa Xét nghiệm Huyết học & Sinh hóa Y khoa</p>
                    </div>

                    {/* Document Title */}
                    <h3 className="text-center text-sm font-bold text-teal-600 mb-1">PHIẾU KẾT QUẢ XÉT NGHIỆM Y KHOA</h3>
                    <p className="text-center text-[10px] text-slate-500 mb-4">PrEP Định kỳ - Bộ Xét Nghiệm 3 Tháng</p>

                    {/* Patient Info */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] mb-4">
                      <div className="flex gap-1.5">
                        <span className="text-slate-500">Họ và tên bệnh nhân:</span>
                        <span className="font-semibold text-teal-600">{labResultData.patient.name}</span>
                      </div>
                      <div className="flex gap-1.5">
                        <span className="text-slate-500">Mã bệnh nhân (PID):</span>
                        <span className="font-semibold text-teal-600">{labResultData.patient.pid}</span>
                      </div>
                      <div className="flex gap-1.5">
                        <span className="text-slate-500">Năm sinh:</span>
                        <span className="font-medium text-slate-700">{labResultData.patient.birthYear}</span>
                      </div>
                      <div className="flex gap-1.5">
                        <span className="text-slate-500">Giới tính:</span>
                        <span className="font-medium text-slate-700">{labResultData.patient.gender}</span>
                      </div>
                      <div className="flex gap-1.5 col-span-2">
                        <span className="text-slate-500">Bác sĩ chỉ định:</span>
                        <span className="font-medium text-slate-700">{labResultData.patient.doctor}</span>
                      </div>
                      <div className="flex gap-1.5">
                        <span className="text-slate-500">Thời gian lấy mẫu:</span>
                        <span className="font-medium text-slate-700">{labResultData.patient.sampleTime}</span>
                      </div>
                      <div className="flex gap-1.5">
                        <span className="text-slate-500">Thời gian trả KQ:</span>
                        <span className="font-medium text-slate-700">{labResultData.patient.resultTime}</span>
                      </div>
                    </div>

                    {/* Results Table */}
                    <div className="overflow-x-auto -mx-1">
                      <table className="w-full text-[10px] border-collapse">
                        <thead>
                          <tr className="bg-teal-600 text-white">
                            <th className="border border-teal-700 px-2 py-1.5 text-left font-semibold">STT</th>
                            <th className="border border-teal-700 px-2 py-1.5 text-left font-semibold">Tên xét nghiệm</th>
                            <th className="border border-teal-700 px-2 py-1.5 text-left font-semibold">Kết quả</th>
                            <th className="border border-teal-700 px-2 py-1.5 text-left font-semibold">Khoảng tham chiếu</th>
                            <th className="border border-teal-700 px-2 py-1.5 text-left font-semibold">Đơn vị</th>
                            <th className="border border-teal-700 px-2 py-1.5 text-left font-semibold">PP</th>
                          </tr>
                        </thead>
                        <tbody>
                          {labResultData.results.map((result, idx) => (
                            <tr key={idx} className="bg-white">
                              <td className="border border-slate-200 px-2 py-1.5">{idx + 1}</td>
                              <td className="border border-slate-200 px-2 py-1.5">{result.fullName}</td>
                              <td className={`border border-slate-200 px-2 py-1.5 font-semibold ${
                                result.status === "negative" ? "text-emerald-600" : "text-blue-600"
                              }`}>
                                {result.value}
                              </td>
                              <td className="border border-slate-200 px-2 py-1.5">{result.reference}</td>
                              <td className="border border-slate-200 px-2 py-1.5">{result.unit}</td>
                              <td className="border border-slate-200 px-2 py-1.5">{result.method}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Extracted Data */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Thông tin Hành chính</h2>
                </div>
                <div className="p-5">
                  {/* Form Fields */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="col-span-2">
                      <label className="text-[11px] text-slate-500 mb-1 block">Đơn vị xét nghiệm</label>
                      <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800">
                        {labResultData.providerFull}
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 mb-1 block">Họ và tên bệnh nhân</label>
                      <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800">
                        {labResultData.patient.name}
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 mb-1 block">Mã bệnh nhân (PID)</label>
                      <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800">
                        {labResultData.patient.pid}
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 mb-1 block">Năm sinh</label>
                      <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800">
                        {labResultData.patient.birthYear}
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 mb-1 block">Giới tính</label>
                      <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800">
                        {labResultData.patient.gender}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className="text-[11px] text-slate-500 mb-1 block">Bác sĩ chỉ định</label>
                      <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800">
                        {labResultData.patient.doctor}
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 mb-1 block">Thời gian lấy mẫu</label>
                      <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800">
                        {labResultData.patient.sampleTime}
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 mb-1 block">Thời gian trả KQ</label>
                      <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800">
                        {labResultData.patient.resultTime}
                      </div>
                    </div>
                  </div>

                  {/* Results Section */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 mb-3">Kết quả Xét nghiệm</h3>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left text-[11px] font-medium text-slate-500 pb-2">Tên xét nghiệm</th>
                          <th className="text-right text-[11px] font-medium text-slate-500 pb-2">Kết quả</th>
                        </tr>
                      </thead>
                      <tbody>
                        {labResultData.results.map((result, idx) => (
                          <tr key={idx} className="border-b border-slate-100 last:border-b-0">
                            <td className="py-3 text-sm font-medium text-slate-700">{result.name}</td>
                            <td className="py-3 text-right">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${getStatusBadgeClass(result.status)}`}>
                                {result.value}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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

export default LabResultDetail;
