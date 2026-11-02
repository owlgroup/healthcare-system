import { useState } from "react";
import { Search, Send, Plus, Image, Paperclip, Video, Phone, MoreVertical, Lock, Clock, HelpCircle, Bot, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const conversations = [
  {
    id: 1,
    name: "BS. Nguyễn Thị Lan",
    role: "Bác sĩ điều trị",
    preview: "Tôi đã xem kết quả xét nghiệm mới nhất của bạn. Mọi thứ...",
    time: "Vừa xong",
    online: true,
    initials: "NL",
    initialsColor: "bg-primary/10 text-primary",
  },
  {
    id: 2,
    name: "Trần Minh Cường",
    role: "Trợ lý y tế",
    preview: "Đơn thuốc đã được gửi đến nhà thuốc gần bạn...",
    time: "2 giờ trước",
    online: false,
    initials: "TC",
    initialsColor: "bg-muted text-muted-foreground",
  },
  {
    id: 3,
    name: "Bộ phận hỗ trợ",
    role: "Chăm sóc khách hàng",
    preview: "Xác minh bảo hiểm cho lần khám sắp tới của bạn...",
    time: "Hôm qua",
    online: false,
    initials: "HT",
    initialsColor: "bg-accent text-primary",
  },
];

const filterTabs = [
  { label: "Hỗ trợ", icon: HelpCircle },
  { label: "Trợ lý", icon: Bot },
  { label: "Bác sĩ", icon: User },
];

const messages = [
  {
    id: 1,
    sender: "provider",
    text: "Chào bạn, tôi đã xem kết quả xét nghiệm máu hôm thứ Hai. Mức vitamin D của bạn hơi thấp, các chỉ số khác đều trong ngưỡng tốt.",
    time: "16:32",
    day: "Hôm qua",
  },
  {
    id: 2,
    sender: "user",
    text: "Cảm ơn bác sĩ! Tôi nên uống bổ sung hay điều chỉnh chế độ ăn trước?",
    time: "16:45",
  },
  {
    id: 3,
    sender: "provider",
    text: "Tôi khuyên bạn uống bổ sung 2000 IU mỗi ngày trong 3 tháng tới. Tôi đã gửi gợi ý thương hiệu vào mục \"Tệp tin\" trên cổng bệnh nhân. Bạn thấy ổn không?",
    time: "09:15",
    day: "Hôm nay",
  },
];

const MessagesContent = () => {
  const [activeConversation, setActiveConversation] = useState(1);
  const activeContact = conversations.find((c) => c.id === activeConversation)!;

  return (
    <main className="flex-1 flex overflow-hidden">
      <div className="w-full max-w-xs border-r bg-card flex flex-col hidden md:flex">
        <div className="p-4 border-b">
          <h2 className="text-lg font-bold text-foreground mb-3">Tin nhắn</h2>
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm cuộc trò chuyện..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>
          <div className="flex items-center gap-2 mt-3">
            {filterTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.label}
                  className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <Icon className="h-3 w-3" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.map((convo) => (
            <button
              key={convo.id}
              onClick={() => setActiveConversation(convo.id)}
              className={`w-full flex items-start gap-3 p-4 text-left transition-colors ${
                activeConversation === convo.id
                  ? "bg-accent border-l-2 border-primary"
                  : "hover:bg-muted/50"
              }`}
            >
              <div className="relative flex-shrink-0">
                <div className={`h-10 w-10 rounded-full ${convo.initialsColor} flex items-center justify-center text-xs font-bold`}>
                  {convo.initials}
                </div>
                {convo.online && (
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-success border-2 border-card" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground truncate">{convo.name}</p>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground flex-shrink-0 ml-2">{convo.time}</span>
                </div>
                <p className="text-xs text-muted-foreground">{convo.role}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{convo.preview}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className={`h-10 w-10 rounded-full ${activeContact.initialsColor} flex items-center justify-center text-xs font-bold`}>
                {activeContact.initials}
              </div>
              {activeContact.online && (
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-success border-2 border-card" />
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{activeContact.name}</p>
              <div className="flex items-center gap-2">
                {activeContact.online && <span className="text-xs font-medium text-success">Đang trực tuyến</span>}
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  T2–T6 8:00–18:00
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg hover:bg-muted transition-colors">
              <Video className="h-4 w-4 text-muted-foreground" />
            </button>
            <button className="p-2 rounded-lg hover:bg-muted transition-colors">
              <Phone className="h-4 w-4 text-muted-foreground" />
            </button>
            <button className="p-2 rounded-lg hover:bg-muted transition-colors">
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id}>
              {msg.day && (
                <div className="flex justify-center mb-4">
                  <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-card">
                    {msg.day}
                  </Badge>
                </div>
              )}
              <div className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"} mb-1`}>
                <div className={`max-w-md ${msg.sender === "user" ? "order-1" : ""}`}>
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.sender === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "border bg-card text-foreground rounded-bl-sm"
                    }`}
                  >
                    {msg.text}
                  </div>
                  <div className={`flex items-center gap-2 mt-1 ${msg.sender === "user" ? "justify-end" : ""}`}>
                    {msg.sender === "provider" && (
                      <div className={`h-6 w-6 rounded-full ${activeContact.initialsColor} flex items-center justify-center text-[8px] font-bold`}>
                        {activeContact.initials}
                      </div>
                    )}
                    <span className="text-[10px] text-muted-foreground">{msg.time}</span>
                    {msg.sender === "user" && (
                      <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-[8px] font-bold text-primary-foreground">
                        BN
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className="flex justify-center pt-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" />
              Cuộc trò chuyện được mã hóa và bảo mật theo quy định y tế.
            </span>
          </div>
        </div>

        <div className="border-t px-5 py-3">
          <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2">
            <button className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <Plus className="h-4 w-4 text-muted-foreground" />
            </button>
            <button className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <Image className="h-4 w-4 text-muted-foreground" />
            </button>
            <button className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <Paperclip className="h-4 w-4 text-muted-foreground" />
            </button>
            <input
              type="text"
              placeholder="Nhập tin nhắn..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
            <button className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center hover:opacity-90 transition-opacity">
              <Send className="h-4 w-4 text-primary-foreground" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Chỉ dùng tin nhắn cho vấn đề y tế không khẩn cấp. Trong trường hợp khẩn cấp, gọi 115.
          </p>
        </div>
      </div>
    </main>
  );
};

export default MessagesContent;
