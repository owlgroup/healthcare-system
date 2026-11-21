import { useMemo } from "react";
import { addDays, format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { fetchDoctorAppointments } from "@/lib/doctor-appointment-api";
import { getMyDoctorProfile } from "@/lib/doctor-profile-api";
import { fetchRecentPatientRecords, searchPatientRecords } from "@/lib/patient-records";
import {
  deriveTodaySchedule,
  deriveTodayStats,
  deriveUpcomingSchedule,
  deriveWeeklyChart,
  formatDoctorDisplayName,
  getWeekRange,
  mapPatientRecordToDashboard,
  type DashboardMonitoringStats,
  type DashboardRecentPatient,
  type DashboardScheduleItem,
  type DashboardTodayStats,
  type DashboardWeekChartPoint,
} from "@/lib/provider-dashboard-utils";
import { supabase } from "@/lib/supabase";
import type { AdminAppointment } from "@/types/admin-appointment";

export type DashboardPortal = "doctor" | "customer";

export type ProviderDashboardData = {
  viewerName: string;
  todayStats: DashboardTodayStats;
  monitoringStats: DashboardMonitoringStats;
  todaySchedule: DashboardScheduleItem[];
  upcomingSchedule: DashboardScheduleItem[];
  weeklyChart: DashboardWeekChartPoint[];
};

const UPCOMING_WINDOW_DAYS = 60;

const EMPTY_MONITORING: DashboardMonitoringStats = { total: 0, newThisWeek: 0 };

function settled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

/** 5 bệnh nhân cập nhật gần nhất — query độc lập, không phụ thuộc lịch hẹn / clinical tasks. */
export function useProviderDashboardRecentPatients() {
  return useQuery({
    queryKey: ["provider-dashboard-recent-patients"],
    queryFn: async (): Promise<{
      recentPatients: DashboardRecentPatient[];
      monitoringStats: DashboardMonitoringStats;
    }> => {
      const { dateFrom, dateTo } = getWeekRange(new Date());

      const recentResult = await fetchRecentPatientRecords(supabase, 5);

      if (recentResult.error) {
        throw recentResult.error;
      }

      let monitoringStats: DashboardMonitoringStats = {
        total: recentResult.total,
        newThisWeek: 0,
      };

      const [activeResult, unverifiedResult, weekActiveResult, weekUnverifiedResult] =
        await Promise.all([
          searchPatientRecords(supabase, {
            page: 1,
            limit: 1,
            status: "active",
          }),
          searchPatientRecords(supabase, {
            page: 1,
            limit: 1,
            status: "unverified",
          }),
          searchPatientRecords(supabase, {
            page: 1,
            limit: 1,
            status: "active",
            dateFrom,
            dateTo,
          }),
          searchPatientRecords(supabase, {
            page: 1,
            limit: 1,
            status: "unverified",
            dateFrom,
            dateTo,
          }),
        ]);

      if (!activeResult.error && !unverifiedResult.error) {
        monitoringStats = {
          ...monitoringStats,
          total: activeResult.total + unverifiedResult.total,
        };
      }
      if (!weekActiveResult.error && !weekUnverifiedResult.error) {
        monitoringStats = {
          ...monitoringStats,
          newThisWeek: weekActiveResult.total + weekUnverifiedResult.total,
        };
      }

      return {
        recentPatients: recentResult.rows.map(mapPatientRecordToDashboard),
        monitoringStats,
      };
    },
  });
}

async function loadViewerName(portal: DashboardPortal): Promise<string> {
  if (portal === "doctor") {
    const profile = await getMyDoctorProfile();
    return formatDoctorDisplayName(profile?.full_name);
  }
  const { data: auth } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("user_profiles")
    .select("full_name, email")
    .eq("user_id", auth.user?.id ?? "")
    .maybeSingle();
  return data?.full_name?.trim() || data?.email || "bạn";
}

async function loadProviderDashboard(
  anchor: Date,
  portal: DashboardPortal,
): Promise<ProviderDashboardData> {
  const { today, dateFrom, dateTo } = getWeekRange(anchor);

  const upcomingFrom = format(addDays(anchor, 1), "yyyy-MM-dd");
  const upcomingTo = format(addDays(anchor, UPCOMING_WINDOW_DAYS), "yyyy-MM-dd");

  const [nameResult, todayApptsResult, weekApptsResult, upcomingApptsResult] =
    await Promise.allSettled([
      loadViewerName(portal),
      fetchDoctorAppointments({ date: today }),
      fetchDoctorAppointments({ dateFrom, dateTo }),
      fetchDoctorAppointments({ dateFrom: upcomingFrom, dateTo: upcomingTo }),
    ]);

  const todayAppts = settled(todayApptsResult, [] as AdminAppointment[]);
  const weekAppts = settled(weekApptsResult, [] as AdminAppointment[]);
  const upcomingAppts = settled(upcomingApptsResult, [] as AdminAppointment[]);

  return {
    viewerName: settled(nameResult, portal === "doctor" ? "Bác sĩ" : "bạn"),
    todayStats: deriveTodayStats(todayAppts),
    monitoringStats: EMPTY_MONITORING,
    todaySchedule: deriveTodaySchedule(todayAppts),
    upcomingSchedule: deriveUpcomingSchedule(upcomingAppts, today, 3),
    weeklyChart: deriveWeeklyChart(weekAppts, anchor),
  };
}

export function useProviderDashboardData(
  anchor: Date = new Date(),
  portal: DashboardPortal = "doctor",
) {
  const { dateFrom, dateTo, today } = useMemo(() => getWeekRange(anchor), [anchor]);

  return useQuery({
    queryKey: ["provider-dashboard", portal, today, dateFrom, dateTo],
    queryFn: () => loadProviderDashboard(anchor, portal),
  });
}
