import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

function playDing() {
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

    // Two oscillators — fundamental + overtone for a "bell" timbre
    [523.25, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.connect(gain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 1.2 - i * 0.1);
    });
  } catch {
    // AudioContext blocked (e.g. no user gesture yet) — silently skip
  }
}

export type AppointmentNotification = {
  id: string;
  appointmentId: string;
  patientName: string;
  specialtyName: string;
  slotDate: string | null;
  startTime: string | null;
  walkIn: boolean;
  createdAt: string;
  read: boolean;
};

async function fetchNotificationDetail(appointmentId: string): Promise<AppointmentNotification | null> {
  const { data, error } = await supabase
    .from("appointments")
    .select(`
      id, created_at, walk_in,
      specialties ( name ),
      appointment_slots ( slot_date, start_time ),
      patient ( legal_first_name, legal_last_name )
    `)
    .eq("id", appointmentId)
    .single();

  if (error || !data) return null;

  const pt = (Array.isArray(data.patient) ? data.patient[0] : data.patient) as Record<string, string> | null;
  const sl = (Array.isArray(data.appointment_slots) ? data.appointment_slots[0] : data.appointment_slots) as Record<string, string> | null;
  const sp = (Array.isArray(data.specialties) ? data.specialties[0] : data.specialties) as Record<string, string> | null;

  return {
    id: crypto.randomUUID(),
    appointmentId: data.id,
    patientName: [pt?.legal_last_name, pt?.legal_first_name].filter(Boolean).join(" ") || "Bệnh nhân",
    specialtyName: sp?.name ?? "—",
    slotDate: sl?.slot_date ?? null,
    startTime: sl?.start_time ?? null,
    walkIn: Boolean(data.walk_in),
    createdAt: data.created_at,
    read: false,
  };
}

export function useAdminNotifications() {
  const [notifications, setNotifications] = useState<AppointmentNotification[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel("admin-new-appointments")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "appointments" },
        async (payload) => {
          console.log("[Realtime] new appointment:", payload.new);
          const id = (payload.new as { id: string }).id;
          const notification = await fetchNotificationDetail(id);
          if (!notification) return;
          playDing();
          setNotifications((prev) => [notification, ...prev]);
        },
      )
      .subscribe((status, err) => {
        console.log("[Realtime] status:", status, err ?? "");
      });

    channelRef.current = channel;

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllAsRead = () =>
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

  const markAsRead = (id: string) =>
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );

  const clearAll = () => setNotifications([]);

  return { notifications, unreadCount, markAllAsRead, markAsRead, clearAll };
}
