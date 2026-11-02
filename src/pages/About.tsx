import { Link } from "react-router-dom";
import { Heart, BadgeCheck, Shield, Globe, Users } from "lucide-react";
import LandingHeader from "@/components/landing/LandingHeader";

const missionValues = [
  {
    icon: Heart,
    title: "Đồng cảm là trên hết",
    description:
      "Chúng tôi lắng nghe trước khi điều trị. Câu chuyện của mỗi bệnh nhân là nền tảng cho kế hoạch chăm sóc.",
    color: "text-primary",
  },
  {
    icon: BadgeCheck,
    title: "Xuất sắc lâm sàng",
    description:
      "Y học dựa trên bằng chứng, do các chuyên gia hiểu rõ nhu cầu sức khỏe của cộng đồng LGBTQ+ thực hiện.",
    color: "text-blue-600",
  },
];

const advisors = [
  { name: "Dr. Elena Rodriguez", role: "GIÁM ĐỐC Y KHOA", color: "from-primary/80 to-primary/40" },
  { name: "Dr. Marcus Chen", role: "BỆNH TRUYỀN NHIỄM", color: "from-blue-600/80 to-blue-400/40" },
  { name: "Jordan Smith, NP", role: "TRƯỞNG NHÓM CHĂM SÓC GIỚI", color: "from-primary/80 to-primary/40" },
  { name: "Dr. David Miller", role: "CHUYÊN GIA PHÒNG HIV", color: "from-blue-600/80 to-blue-400/40" },
];

const About = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingHeader />

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-24">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <span className="inline-block rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-primary uppercase tracking-wider mb-6">
              Bản sắc của chúng tôi
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              Định nghĩa lại chăm sóc cho{" "}
              <span className="text-primary">cộng đồng.</span>
            </h1>
            <p className="text-muted-foreground text-base md:text-lg max-w-md">
              Tại Rcare Plus, chúng tôi tin rằng chăm sóc sức khỏe không chỉ là y học — mà còn là cảm giác
              thuộc về. Chúng tôi kiến tạo trải nghiệm lâm sàng toàn diện, nơi sự đồng cảm kết hợp với chất
              lượng xuất sắc.
            </p>
          </div>
          <div className="relative">
            <div className="rounded-2xl bg-gradient-to-br from-accent to-muted aspect-[4/3] flex items-center justify-center overflow-hidden">
              <div className="text-center p-8">
                <Users className="h-20 w-20 text-primary/30 mx-auto mb-4" />
                <p className="text-muted-foreground text-sm">Đội ngũ chăm sóc</p>
              </div>
              <div className="absolute bottom-4 left-4 rounded-xl bg-primary p-3 text-primary-foreground">
                <p className="text-xs font-bold">100% do cộng đồng LGBTQ+ sở hữu</p>
                <p className="text-[10px] opacity-80">
                  Được xây dựng bởi cộng đồng, vì cộng đồng, không phán xét.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-20">
        <div className="grid md:grid-cols-2 gap-8 items-start mb-10">
          <h2 className="text-2xl md:text-3xl font-bold">Sứ mệnh của chúng tôi</h2>
          <p className="text-muted-foreground text-base md:text-lg">
            Thu hẹp khoảng cách bình đẳng trong chăm sóc sức khỏe bằng cách cung cấp dịch vụ chuyên biệt{" "}
            <strong className="text-foreground">toàn diện và hòa nhập</strong>, tôn trọng hành trình và bản
            sắc riêng của từng cá nhân.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {missionValues.map((v, idx) => {
            const Icon = v.icon;
            return (
              <div key={idx} className="rounded-xl border bg-card p-6">
                <Icon className={`h-8 w-8 ${v.color} mb-4`} />
                <h3 className="text-base font-bold mb-2">{v.title}</h3>
                <p className="text-sm text-muted-foreground">{v.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Core Values */}
      <section className="bg-card py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">Giá trị cốt lõi</h2>
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="rounded-2xl bg-gradient-to-br from-primary/80 to-primary/40 p-8 flex flex-col justify-end min-h-[240px]">
              <h3 className="text-xl font-bold text-primary-foreground mb-2">Hòa nhập</h3>
              <p className="text-sm text-primary-foreground/80">
                Vượt xa sự chấp nhận. Chúng tôi tôn vinh sự đa dạng trong mọi hình thái.
              </p>
            </div>
            <div className="rounded-xl border bg-background p-8">
              <Shield className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-base font-bold mb-2">Riêng tư</h3>
              <p className="text-sm text-muted-foreground">
                Dữ liệu sức khỏe của bạn là thiêng liêng. Chúng tôi áp dụng bảo mật cấp cao để hành trình của
                bạn luôn thuộc về bạn.
              </p>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-xl border bg-background p-8">
              <Globe className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-base font-bold mb-2">Tiếp cận</h3>
              <p className="text-sm text-muted-foreground">
                Gỡ bỏ mọi rào cản — tài chính, địa lý hay kỹ thuật số — để chăm sóc sức khỏe là quyền, không
                phải đặc quyền.
              </p>
            </div>
            <div className="flex items-center p-8">
              <div>
                <span className="text-6xl font-bold text-muted/60">03</span>
                <p className="text-base italic text-muted-foreground mt-2">
                  "Chúng tôi không chỉ xây dựng một nền tảng; chúng tôi kiến tạo một không gian an toàn, nơi
                  dữ liệu lâm sàng gặp gỡ phẩm giá con người."
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Clinical Advisory Board */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-24">
        <div className="mb-10">
          <h2 className="text-2xl md:text-3xl font-bold mb-2">Hội đồng cố vấn lâm sàng</h2>
          <p className="text-sm text-muted-foreground max-w-xl">
            Dẫn dắt bởi các bác sĩ lâm sàng hàng đầu, tiên phong trong chăm sóc LGBTQ+, phòng ngừa HIV và chăm
            sóc khẳng định giới.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {advisors.map((a, idx) => (
            <div key={idx}>
              <div
                className={`rounded-2xl bg-gradient-to-b ${a.color} aspect-[3/4] flex items-end justify-center overflow-hidden mb-3`}
              >
                <div className="p-3 w-full">
                  <div className="rounded-lg bg-foreground/60 backdrop-blur-sm px-3 py-1.5 inline-block">
                    <span className="text-[10px] font-bold text-card uppercase tracking-wider">Lâm sàng</span>
                  </div>
                </div>
              </div>
              <p className="text-sm font-bold">{a.name}</p>
              <p className="text-xs text-primary font-semibold uppercase tracking-wider">{a.role}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 py-12">
        <div className="rounded-2xl bg-gradient-to-r from-primary to-primary/80 p-10 md:p-16 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-primary-foreground mb-4">
            Cùng chúng tôi hướng tới bình đẳng trong chăm sóc sức khỏe.
          </h2>
          <p className="text-primary-foreground/80 text-sm md:text-base max-w-md mx-auto mb-8">
            Dù bạn đang tìm kiếm dịch vụ chăm sóc hay muốn đồng hành cùng chúng tôi thay đổi thế giới, luôn có
            một chỗ dành cho bạn.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/signup"
              className="rounded-lg bg-card px-6 py-3 text-sm font-semibold text-primary hover:opacity-90 transition-opacity"
            >
              Nhận chăm sóc ngay
            </Link>
            <a
              href="#"
              className="rounded-lg border border-primary-foreground/30 px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-foreground/10 transition-colors"
            >
              Xem cơ hội nghề nghiệp
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 mt-8">
        <div className="max-w-7xl mx-auto px-4 md:px-8 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <span className="text-base font-bold text-foreground">Rcare Plus</span>
            <p className="text-xs text-muted-foreground mt-1">
              © 2024 Rcare Plus. Chăm sóc sức khỏe cho thế giới hiện đại.
            </p>
          </div>
          <div>
            <p className="text-xs font-bold mb-2">Công ty</p>
            <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">
                Sứ mệnh
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                Đội ngũ lâm sàng
              </a>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold mb-2">Pháp lý</p>
            <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">
                Chính sách bảo mật
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                Điều khoản dịch vụ
              </a>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold mb-2">Liên hệ</p>
            <p className="text-xs text-muted-foreground">support@rcareplus.com</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default About;
