import { Search, User, Calendar, FlaskConical, CreditCard, Lock, MessageSquare, ChevronRight, AlertTriangle, ExternalLink, FileText } from "lucide-react";

const categories = [
  {
    icon: User,
    title: "Tài khoản & đăng nhập",
    description: "Đặt lại mật khẩu, cài đặt tài khoản và quyền riêng tư dữ liệu.",
    iconBg: "bg-accent",
    iconColor: "text-primary",
  },
  {
    icon: Calendar,
    title: "Lịch hẹn",
    description: "Đặt lịch, đổi lịch và thiết lập khám trực tuyến.",
    iconBg: "bg-accent",
    iconColor: "text-primary",
  },
  {
    icon: FlaskConical,
    title: "Xét nghiệm & bộ kit",
    description: "Bộ kit tại nhà, đơn xét nghiệm và thời gian có kết quả.",
    iconBg: "bg-accent",
    iconColor: "text-primary",
  },
  {
    icon: CreditCard,
    title: "Bảo hiểm & thanh toán",
    description: "Câu hỏi về quyền lợi, yêu cầu bồi hoàn và phương thức thanh toán.",
    iconBg: "bg-accent",
    iconColor: "text-primary",
  },
];

const popularSearches = ["Kết quả xét nghiệm", "Giao PrEP", "Cập nhật bảo hiểm"];

const resources = [
  { label: "Chính sách bảo mật", icon: ExternalLink },
  { label: "Quyền lợi bệnh nhân", icon: ExternalLink },
  { label: "Hướng dẫn chuẩn bị xét nghiệm", icon: FileText },
];

const SupportContent = () => {
  return (
    <main className="flex-1 overflow-y-auto p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="rounded-2xl bg-gradient-to-r from-accent to-accent/40 p-6 md:p-10 mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">
            Chúng tôi có thể <span className="text-primary">hỗ trợ</span> gì cho bạn?
          </h1>
          <div className="mt-5 max-w-xl">
            <div className="flex items-center gap-3 rounded-xl bg-card px-4 py-3 shadow-sm">
              <Search className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <input
                type="text"
                placeholder="Tìm câu trả lời, hướng dẫn và tài liệu..."
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
            </div>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Phổ biến:</span>
              {popularSearches.map((term) => (
                <button key={term} className="text-xs font-medium text-primary hover:underline">
                  {term}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-10">
          <h2 className="text-lg font-bold text-foreground mb-1">Duyệt theo danh mục</h2>
          <p className="text-sm text-muted-foreground mb-5">Tìm câu trả lời nhanh cho các câu hỏi thường gặp.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {categories.map((cat, idx) => {
              const Icon = cat.icon;
              return (
                <div key={idx} className="rounded-xl border bg-card p-5 hover:shadow-md transition-shadow">
                  <div className={`h-10 w-10 rounded-xl ${cat.iconBg} flex items-center justify-center mb-4`}>
                    <Icon className={`h-5 w-5 ${cat.iconColor}`} />
                  </div>
                  <h3 className="text-sm font-bold text-foreground mb-1">{cat.title}</h3>
                  <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{cat.description}</p>
                  <button className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                    Xem chủ đề
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <h2 className="text-lg font-bold text-foreground mb-1">Vẫn cần hỗ trợ?</h2>
            <p className="text-sm text-muted-foreground mb-5">Đội chăm sóc sẵn sàng T2–T6, 9:00–18:00.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border bg-card p-5 flex flex-col">
                <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center mb-4">
                  <Lock className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-sm font-bold text-foreground mb-1">Tin nhắn bảo mật</h3>
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed flex-1">
                  Trao đổi trực tiếp và riêng tư với đội chăm sóc lâm sàng của bạn.
                </p>
                <button className="w-full rounded-lg border border-primary/20 py-2.5 text-sm font-semibold text-primary hover:bg-accent transition-colors">
                  Bắt đầu nhắn tin
                </button>
              </div>

              <div className="rounded-xl bg-muted/50 p-5 flex flex-col">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-sm font-bold text-foreground mb-1">Chat hỗ trợ khách hàng</h3>
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed flex-1">
                  Hỗ trợ nhanh về tài khoản, thanh toán hoặc vận chuyển từ nhân viên hỗ trợ.
                </p>
                <button className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity">
                  Trò chuyện ngay
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-xl border-2 border-destructive/20 bg-destructive/5 p-5">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-destructive">Liên hệ khẩn cấp</span>
              </div>
              <h3 className="text-sm font-bold text-foreground mb-2">Trong trường hợp khẩn cấp</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                Nếu bạn đang gặp tình huống y tế khẩn cấp, hãy gọi <span className="font-bold text-foreground">115</span> hoặc đến cơ sở cấp cứu gần nhất ngay lập tức.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Hỗ trợ khủng hoảng tâm lý: gọi <span className="font-bold text-foreground">1116</span>.
              </p>
            </div>

            <div className="rounded-xl border bg-card p-5">
              <h3 className="text-sm font-bold text-foreground mb-3">Tài liệu thường dùng</h3>
              <div className="space-y-2">
                {resources.map((res, idx) => {
                  const ResIcon = res.icon;
                  return (
                    <button key={idx} className="flex items-center justify-between w-full rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors">
                      {res.label}
                      <ResIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default SupportContent;
