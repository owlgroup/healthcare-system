import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

function playDing() {
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    [523.25, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.connect(gain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 1.2 - i * 0.1);
    });
  } catch {
    // No user gesture yet — skip
  }
}

export type DoctorNotification = {
  id: string;
  appointmentId: string | null;
  patientName: string;
  specialtyName: string;
  slotDate: string | null;
  slotTime: string | null;
  walkIn: boolean;
  read: boolean;
  createdAt: string;
};

type DbRow = {
  id: string;
  appointment_id: string | null;
  patient_name: string | null;
  specialty_name: string | null;
  slot_date: string | null;
  slot_time: string | null;
  walk_in: boolean;
  read: boolean;
  created_at: string;
};

function toNotification(row: DbRow): DoctorNotification {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    patientName: row.patient_name ?? "Bệnh nhân",
    specialtyName: row.specialty_name ?? "—",
    slotDate: row.slot_date,
    slotTime: row.slot_time,
    walkIn: row.walk_in,
    read: row.read,
    createdAt: row.created_at,
  };
}

export function useDoctorNotifications() {
  const [notifications, setNotifications] = useState<DoctorNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Initial load: last 50 unread + recent read notifications
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      setNotifications((data ?? []).map(toNotification));
      setLoading(false);
    };
    void load();
  }, []);

  // Realtime: new notifications for this doctor
  useEffect(() => {
    const channel = supabase
      .channel("doctor-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const row = payload.new as DbRow;
          const n = toNotification(row);
          playDing();
          setNotifications((prev) => [n, ...prev]);
        },
      )
      .subscribe();

    channelRef.current = channel;
    return () => { void supabase.removeChannel(channel); };
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    await supabase.from("notifications").update({ read: true }).eq("id", id);
  }, []);

  const markAllAsRead = useCallback(async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase.from("notifications").update({ read: true }).in("id", unreadIds);
  }, [notifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, loading, unreadCount, markAsRead, markAllAsRead };
}
