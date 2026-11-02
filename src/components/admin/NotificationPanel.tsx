import { useEffect, useRef, useState } from "react";
import { Bell, CalendarPlus, CheckCheck, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { AppointmentNotification } from "@/hooks/useAdminNotifications";
import { UI_WALK_IN } from "@/config/ui-labels";

type Props = {
  notifications: AppointmentNotification[];
  unreadCount: number;
  onMarkAllAsRead: () => void;
  onMarkAsRead: (id: string) => void;
  onClearAll: () => void;
  appointmentsPath?: string;
};

function formatTime(n: AppointmentNotification): string {
  if (n.walkIn) return UI_WALK_IN;
  if (n.slotDate && n.startTime) {
    const [y, m, d] = n.slotDate.split("-");
    return `${n.startTime.slice(0, 5)} · ${d}/${m}/${y}`;
  }
  return new Date(n.createdAt).toLocaleString("vi-VN", {
    hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit",
  });
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "vừa xong";
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  return `${Math.floor(diff / 86400)} ngày trước`;
}

export default function NotificationPanel({
  notifications,
  unreadCount,
  onMarkAllAsRead,
  onMarkAsRead,
  onClearAll,
  appointmentsPath = "/admin/appointments",
}: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = () => {
    setOpen((v) => !v);
  };

  const handleClickNotification = (n: AppointmentNotification) => {
    onMarkAsRead(n.id);
    setOpen(false);
    navigate(appointmentsPath);
  };

  return (
    <div ref={panelRef} className="relative">
      {/* Bell button */}
      <button
        type="button"
        onClick={handleOpen}
        className="relative p-2 rounded-lg hover:bg-muted transition-colors"
        aria-label={`${unreadCount} thông báo mới`}
      >
        <Bell className="h-5 w-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border bg-card shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">
              Thông báo
              {unreadCount > 0 && (
                <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  {unreadCount} mới
                </span>
              )}
            </h3>
            <div className="flex gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllAsRead}
                  title="Đánh dấu tất cả đã đọc"
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <CheckCheck className="h-4 w-4" />
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={onClearAll}
                  title="Xóa tất cả"
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
                <Bell className="h-8 w-8 opacity-30" />
                <p className="text-sm">Chưa có thông báo mới</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleClickNotification(n)}
                  className={`w-full text-left px-4 py-3 flex gap-3 items-start border-b last:border-0 transition-colors hover:bg-muted/60 ${
                    !n.read ? "bg-primary/5" : ""
                  }`}
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <CalendarPlus className="h-4 w-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {n.patientName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {n.specialtyName} · {formatTime(n)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>
                  {!n.read && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t px-4 py-2">
              <button
                type="button"
                onClick={() => { setOpen(false); navigate(appointmentsPath); }}
                className="w-full text-center text-xs font-medium text-primary hover:underline py-1"
              >
                Xem tất cả lịch hẹn →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
