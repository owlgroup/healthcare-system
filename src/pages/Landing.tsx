import { Link } from "react-router-dom";
import { Shield, Heart, Users, Video, FlaskConical, Pill, Award, ShieldCheck, BadgeCheck, Quote } from "lucide-react";
import LandingHeader from "@/components/landing/LandingHeader";

const steps = [
  {
    icon: Video,
    title: "Tư vấn trực tuyến",
    description: "Kết nối với đội ngũ chuyên gia chăm sóc LGBTQ+ qua cuộc gọi video an toàn, không phán xét.",
    iconBg: "bg-accent",
    iconColor: "text-primary",
  },
  {
    icon: FlaskConical,
    title: "Xét nghiệm tại nhà",
    description: "Chúng tôi gửi bộ dụng cụ xét nghiệm kín đáo đến tận nhà. Bạn tự thực hiện tại nhà và gửi trả miễn phí.",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
  },
  {
    icon: Pill,
    title: "Giao thuốc nhanh",
    description: "Sau khi được phê duyệt, PrEP được giao kín đáo tận nhà. Tái cấp thuốc được xử lý tự động.",
    iconBg: "bg-accent",
    iconColor: "text-primary",
  },
];

const features = [
  {
    icon: ShieldCheck,
    title: "100% an toàn & tuân thủ HIPAA",
    description: "Dữ liệu sức khỏe của bạn được mã hóa và bảo vệ theo tiêu chuẩn bảo mật hàng đầu.",
  },
  {
    icon: Users,
    title: "Chuyên gia chăm sóc LGBTQ+",
    description: "Được chăm sóc bởi bác sĩ hiểu rõ nhu cầu và lịch sử đặc thù của cộng đồng chúng ta.",
  },
  {
    icon: Heart,
    title: "Hỗ trợ toàn diện, không phán xét",
    description: "Một không gian an toàn nơi bạn được lắng nghe, thấu hiểu và tôn trọng vì chính con người bạn.",
  },
];

const testimonials = [
  {
    quote: "Rcare Plus đã thay đổi cách tôi nhìn nhận y tế. Cuối cùng tôi cũng cảm thấy bác sĩ thực sự hiểu cuộc sống của mình.",
    name: "Alex R.",
    since: "Bệnh nhân từ 2022",
  },
  {
    quote: "Xét nghiệm tại nhà thật dễ dàng. Không còn phải đến phòng lab khó xử hay giải thích với người lạ.",
    name: "Jordan M.",
    since: "Bệnh nhân từ 2023",
  },
  {
    quote: "Giao hàng nhanh và hỗ trợ khách hàng tuyệt vời. Họ thực sự quan tâm đến cộng đồng LGBTQ+.",
    name: "Sam T.",
    since: "Bệnh nhân từ 2021",
  },
];

const badges = [
  { icon: Award, title: "EQUALITY 100", subtitle: "DẪN ĐẦU VỀ BÌNH ĐẲNG LGBTQ+" },
  { icon: Shield, title: "TUÂN THỦ HIPAA", subtitle: "TIÊU CHUẨN BẢO MẬT DỮ LIỆU" },
  { icon: BadgeCheck, title: "CHỨNG NHẬN CLIA", subtitle: "XUẤT SẮC PHÒNG XÉT NGHIỆM" },
];

const Landing = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingHeader />

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-24">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <span className="inline-block rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-primary uppercase tracking-wider mb-6">
              Trao quyền cho sức khỏe LGBTQ+
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              Chăm sóc thấu hiểu bạn.{" "}
              <span className="text-primary">PrEP trao quyền cho bạn.</span>
            </h1>
            <p className="text-muted-foreground text-base md:text-lg max-w-md mb-8">
              Bỏ qua phòng chờ. Tiếp cận dịch vụ chăm sóc sức khỏe chuyên biệt, toàn diện ngay tại nhà. An toàn, kín đáo và được thiết kế cho cộng đồng của chúng ta.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/signup" className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity">
                Bắt đầu ngay
              </Link>
              <a href="#how-it-works" className="rounded-lg border border-border px-6 py-3 text-sm font-semibold text-foreground hover:bg-muted transition-colors">
                Xem gói dịch vụ
              </a>
            </div>
          </div>
          <div className="relative">
            <div className="rounded-2xl bg-gradient-to-br from-accent to-muted aspect-[4/3] flex items-center justify-center overflow-hidden">
              <div className="text-center p-8">
                <Users className="h-20 w-20 text-primary/30 mx-auto mb-4" />
                <p className="text-muted-foreground text-sm">Đội ngũ chăm sóc chuyên nghiệp</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="bg-card py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-2">Cách thức hoạt động</h2>
            <div className="h-1 w-12 bg-primary rounded-full mx-auto" />
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div key={idx} className="rounded-xl border bg-background p-8 text-center hover:shadow-md transition-shadow">
                  <div className={`h-14 w-14 rounded-2xl ${step.iconBg} flex items-center justify-center mx-auto mb-5`}>
                    <Icon className={`h-7 w-7 ${step.iconColor}`} />
                  </div>
                  <h3 className="text-base font-bold mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Expert Care */}
      <section id="our-care" className="max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-24">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="relative">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-muted aspect-square flex items-center justify-center">
                <Users className="h-16 w-16 text-muted-foreground/30" />
              </div>
              <div className="space-y-4">
                <div className="rounded-xl bg-primary p-4 text-primary-foreground">
                  <p className="text-lg font-bold">LGBTQ+</p>
                  <p className="text-xs opacity-80">Chuyên môn đội ngũ</p>
                </div>
                <div className="rounded-2xl bg-muted aspect-[4/3] flex items-center justify-center">
                  <Users className="h-12 w-12 text-muted-foreground/30" />
                </div>
              </div>
              <div className="col-span-2">
                <div className="inline-block rounded-xl bg-primary p-4 text-primary-foreground">
                  <p className="text-2xl font-bold">100%</p>
                  <p className="text-xs opacity-80">An toàn & riêng tư</p>
                </div>
              </div>
            </div>
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-8">Chăm sóc chuyên nghiệp, không rào cản.</h2>
            <div className="space-y-6">
              {features.map((feat, idx) => {
                const Icon = feat.icon;
                return (
                  <div key={idx} className="flex gap-4">
                    <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold mb-1">{feat.title}</h3>
                      <p className="text-sm text-muted-foreground">{feat.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-card py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">Trải nghiệm bệnh nhân</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, idx) => (
              <div key={idx} className="rounded-xl border bg-background p-6">
                <Quote className="h-6 w-6 text-primary mb-4" />
                <p className="text-sm text-muted-foreground mb-6 italic">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">{t.name[0]}</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.since}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 py-12">
        <div className="flex flex-wrap justify-center gap-10">
          {badges.map((b, idx) => {
            const Icon = b.icon;
            return (
              <div key={idx} className="flex items-center gap-3">
                <Icon className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-xs font-bold">{b.title}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{b.subtitle}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section id="cta" className="max-w-7xl mx-auto px-4 md:px-8 py-12">
        <div className="rounded-2xl bg-gradient-to-r from-primary to-primary/80 p-10 md:p-16 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-primary-foreground mb-4">Sức khỏe của bạn, theo cách của bạn.</h2>
          <p className="text-primary-foreground/80 text-sm md:text-base max-w-md mx-auto mb-8">
            Hàng nghìn người đã chủ động chăm sóc sức khỏe cùng Rcare Plus. Bắt đầu hành trình của bạn ngay hôm nay.
          </p>
          <Link to="/signup" className="inline-block rounded-lg bg-card px-8 py-3 text-sm font-semibold text-primary hover:opacity-90 transition-opacity">
            Tham gia Rcare Plus
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <span className="text-base font-bold text-foreground">Rcare Plus</span>
            <p className="text-xs text-muted-foreground">Trao quyền cho cộng đồng LGBTQ+ với dịch vụ chăm sóc chuyên nghiệp.</p>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/support" className="hover:text-foreground transition-colors">Hỗ trợ</Link>
            <a href="#" className="hover:text-foreground transition-colors">Quyền riêng tư</a>
            <a href="#" className="hover:text-foreground transition-colors">Điều khoản</a>
          </div>
          <p className="text-xs text-muted-foreground">© 2024 Rcare Plus. Bảo lưu mọi quyền.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
