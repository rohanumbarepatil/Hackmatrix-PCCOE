"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type HealthResponse = {
  status: string;
  database: string;
  error?: string;
};

type DistrictFacility = {
  facility_id: number;
  facility: string;
  operational: boolean;
  staff_monitored: number;
  present: number;
  approved_absences: number;
  reporting_delays: number;
  staffing_gaps: number;
};

type DistrictOverview = {
  district: string;
  total_phcs: number;
  operational: number;
  staffing_gaps: number;
  reporting_delays: number;
  approved_absences: number;
  total_staff_monitored: number;
  facilities: DistrictFacility[];
};

type Readiness = {
  facility_id: number;
  facility: string;
  staff_id: number;
  staff: string;
  role: string;
  shift_id: number;
  classification:
    | "PRESENT"
    | "APPROVED_ABSENCE"
    | "REPORTING_DELAY"
    | "POSSIBLE_STAFFING_GAP"
    | string;
  confidence: number;
  heartbeat_recent: boolean;
  has_check_in: boolean;
  has_approved_leave: boolean;
  reason: string;
  evaluated_at: string;
};

type Alert = {
  id: number;
  facility_id: number;
  staff_id: number | null;
  alert_type: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | string;
  title: string;
  message: string;
  status: string;
  created_at: string;
};

type AlertsResponse = {
  count: number;
  alerts: Alert[];
};

const STAFF_IDS = [1, 2, 3, 4];

function formatTime(value?: string) {
  if (!value) return "--:--";
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function classificationLabel(value: string) {
  switch (value) {
    case "PRESENT":
      return "Present";
    case "OFF_SHIFT":
      return "Off Shift";
    case "APPROVED_ABSENCE":
      return "Approved Leave";
    case "REPORTING_DELAY":
      return "Reporting Delay";
    case "POSSIBLE_STAFFING_GAP":
      return "Possible Staffing Gap";
    default:
      return value.replaceAll("_", " ");
  }
}

function classificationClasses(value: string) {
  switch (value) {
    case "PRESENT":
      return "bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]";
    case "OFF_SHIFT":
      return "bg-[#F3F4F6] text-[#6B7280] border-[#E5E7EB]";
    case "APPROVED_ABSENCE":
      return "bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]";
    case "REPORTING_DELAY":
      return "bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]";
    case "POSSIBLE_STAFFING_GAP":
      return "bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]";
    default:
      return "bg-[#F3F4F6] text-[#4B5563] border-[#E5E7EB]";
  }
}

function severityClasses(value: string) {
  switch (value) {
    case "HIGH":
      return "bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]";
    case "MEDIUM":
      return "bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]";
    default:
      return "bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]";
  }
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(options?.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `${response.status} ${response.statusText}${body ? `: ${body}` : ""}`
    );
  }

  return response.json() as Promise<T>;
}

function getCurrentTime() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [overview, setOverview] = useState<DistrictOverview | null>(null);
  const [readiness, setReadiness] = useState<Readiness[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [lastUpdated, setLastUpdated] = useState("--:--:--");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setError("");

    try {
      const healthData = await apiFetch<HealthResponse>("/health");

      setHealth(healthData);

      const overviewData = await apiFetch<DistrictOverview>(
        "/district/overview"
      );

      setOverview(overviewData);

      const readinessResults = await Promise.all(
        STAFF_IDS.map(async (staffId) => {
          try {
            return await apiFetch<Readiness>(
              `/readiness/evaluate/${overviewData.facilities[0]?.facility_id ?? 1}/${staffId}`
            );
          } catch {
            return null;
          }
        })
      );

      setReadiness(
        readinessResults.filter(
          (item): item is Readiness => item !== null
        )
      );

      const alertsData = await apiFetch<AlertsResponse>("/alerts");

      setAlerts(alertsData.alerts);
      setLastUpdated(getCurrentTime());
    } catch (err) {
      console.error("Dashboard loading failed:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load the PHC Pulse dashboard."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
  };

  const handleResolve = async (alertId: number) => {
    setResolvingId(alertId);

    try {
      await apiFetch(`/alerts/${alertId}/resolve?resolution_note=${encodeURIComponent(
        "Reviewed and resolved by district officer"
      )}`, {
        method: "POST",
      });

      setAlerts((current) =>
        current.filter((alert) => alert.id !== alertId)
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to resolve alert."
      );
    } finally {
      setResolvingId(null);
    }
  };

  const stats = useMemo(() => {
    const present = readiness.filter(
      (item) => item.classification === "PRESENT"
    ).length;

    const approved = readiness.filter(
      (item) => item.classification === "APPROVED_ABSENCE"
    ).length;

    const attention = readiness.filter(
      (item) =>
        item.classification === "REPORTING_DELAY" ||
        item.classification === "POSSIBLE_STAFFING_GAP"
    ).length;

    return {
      monitored: overview?.total_staff_monitored ?? readiness.length,
      present: present || overview?.facilities[0]?.present || 0,
      approved:
        approved || overview?.facilities[0]?.approved_absences || 0,
      attention,
    };
  }, [overview, readiness]);

  const facility = overview?.facilities[0];

  const systemOperational =
    health?.status === "healthy" && health?.database === "connected";

  return (
    <main className="min-h-screen bg-[#FAFAFA] text-[#111827] selection:bg-[#0A2540] selection:text-white pb-20">
      {/* Top Header */}
      <header className="sticky top-0 z-50 border-b border-[#EAEAEA] bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0A2540] text-[18px] font-bold text-white shadow-[0_2px_10px_rgb(0,0,0,0.1)]">
              P
            </div>

            <div>
              <h1 className="text-[17px] font-bold tracking-tight text-[#111827]">
                PHC Pulse <span className="font-medium text-[#6B7280] ml-2 tracking-normal border-l border-[#E5E7EB] pl-2 hidden sm:inline">District Admin</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden sm:flex items-center gap-2">
              <div className="relative flex h-2.5 w-2.5">
                {systemOperational && !loading && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>
                )}
                <span
                  className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    systemOperational ? "bg-[#10B981]" : "bg-[#EF4444]"
                  }`}
                />
              </div>
              <span className="text-[13px] font-medium text-[#4B5563]">
                {loading
                  ? "Checking system..."
                  : systemOperational
                    ? "System Operational"
                    : "System Degradation"}
              </span>
            </div>

            <button
              onClick={handleRefresh}
              disabled={loading || refreshing}
              className="flex items-center gap-2 rounded-lg border border-[#EAEAEA] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#111827] shadow-[0_1px_2px_rgb(0,0,0,0.02)] transition-all hover:bg-[#F9FAFB] hover:border-[#D1D5DB] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {refreshing ? "Refreshing" : "Refresh"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-6 py-10 lg:px-10">
        {error && (
          <div className="mb-8 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-5 py-4 flex items-start gap-3 shadow-sm">
            <svg className="w-5 h-5 text-[#DC2626] mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-[14px] font-semibold text-[#991B1B]">System Error</p>
              <p className="text-[13px] text-[#B91C1C] mt-1">{error}</p>
            </div>
          </div>
        )}

        <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-8">
          <div>
            <h2 className="text-[32px] font-bold tracking-tight text-[#111827] leading-tight">
              {overview?.district || "PHC Karveer"}
            </h2>
            <p className="mt-2 text-[15px] text-[#6B7280]">
              {facility
                ? `Facility ID: ${facility.facility_id} · Real-time command center`
                : "Real-time command center"}
            </p>
          </div>
          <div className="flex items-center gap-2 text-[13px] text-[#6B7280] bg-white border border-[#EAEAEA] px-3 py-1.5 rounded-full shadow-sm">
            <svg className="w-4 h-4 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Last synced: <span className="font-semibold text-[#111827]">{lastUpdated}</span>
          </div>
        </section>

        {/* Top Metric Cards */}
        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4 mb-10">
          <StatCard
            title="Monitored Facilities"
            value={overview?.total_phcs ?? 0}
            subtitle={`${overview?.operational ?? 0} perfectly operational`}
            svgIcon={<path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />}
            tone="blue"
          />

          <StatCard
            title="Total Staff Monitored"
            value={stats.monitored}
            subtitle="Registered active records"
            svgIcon={<path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />}
            tone="slate"
          />

          <StatCard
            title="Confirmed Present"
            value={stats.present}
            subtitle="Verified via check-in"
            svgIcon={<path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />}
            tone="green"
          />

          <StatCard
            title="Attention Required"
            value={(overview?.staffing_gaps ?? 0) + (overview?.reporting_delays ?? 0)}
            subtitle={`${overview?.staffing_gaps ?? 0} gap · ${overview?.reporting_delays ?? 0} delay`}
            svgIcon={<path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />}
            tone={(overview?.staffing_gaps ?? 0) + (overview?.reporting_delays ?? 0) > 0 ? "red" : "slate"}
          />
        </section>

        {/* Main Dashboard Grid */}
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(360px,0.8fr)] items-start">
          
          {/* Left Column */}
          <div className="flex flex-col gap-6">
            
            {/* Staff Readiness Engine Results */}
            <div className="rounded-2xl border border-[#EAEAEA] bg-white shadow-[0_2px_8px_rgb(0,0,0,0.02)] overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#EAEAEA] px-7 py-6 bg-white">
                <div>
                  <h3 className="text-[17px] font-bold text-[#111827] flex items-center gap-2">
                    Decision Engine Output
                    <div className="px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB] text-[10px] font-bold uppercase tracking-wider">Live</div>
                  </h3>
                  <p className="mt-1 text-[14px] text-[#6B7280]">
                    Algorithmic staffing classification based on live signals
                  </p>
                </div>
                <div className="mt-4 sm:mt-0 px-3 py-1 bg-[#F9FAFB] border border-[#EAEAEA] rounded-full text-[12px] font-semibold text-[#4B5563]">
                  {readiness.length || overview?.total_staff_monitored || 0} Entities Monitored
                </div>
              </div>

              <div className="bg-white">
                {loading && readiness.length === 0 ? (
                  <div className="px-7 py-16 flex flex-col items-center justify-center text-[#6B7280]">
                    <svg className="w-8 h-8 animate-spin text-[#D1D5DB] mb-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-[14px] font-medium">Evaluating readiness signals...</p>
                  </div>
                ) : readiness.length === 0 ? (
                  <div className="px-7 py-16 text-center text-[14px] text-[#6B7280]">
                    No readiness records available for this facility.
                  </div>
                ) : (
                  <div className="divide-y divide-[#EAEAEA]">
                    {readiness.map((staff) => (
                      <div
                        key={`${staff.staff_id}-${staff.shift_id}`}
                        className="group flex flex-col gap-4 px-7 py-5 sm:flex-row sm:items-center sm:justify-between hover:bg-[#F9FAFB] transition-colors"
                      >
                        <div className="flex min-w-0 items-center gap-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#F3F4F6] to-[#E5E7EB] text-[13px] font-bold text-[#4B5563] shadow-sm ring-1 ring-[#D1D5DB]/50">
                            {initials(staff.staff)}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[#111827] text-[15px]">
                              {staff.staff}
                            </p>
                            <p className="mt-0.5 text-[13px] text-[#6B7280] flex items-center gap-1.5">
                              {staff.role} 
                              <span className="w-1 h-1 rounded-full bg-[#D1D5DB]"></span> 
                              Shift #{staff.shift_id}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-row-reverse sm:flex-row items-center justify-end gap-6">
                          <div className="text-right flex flex-col items-end">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-1">Engine Confidence</p>
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${staff.confidence > 0.8 ? 'bg-[#10B981]' : staff.confidence > 0.5 ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'}`}
                                  style={{ width: `${Math.round(staff.confidence * 100)}%` }}
                                />
                              </div>
                              <p className="text-[14px] font-bold text-[#111827]">
                                {Math.round(staff.confidence * 100)}%
                              </p>
                            </div>
                          </div>

                          <span
                            className={`rounded-full border px-3 py-1.5 text-[12px] font-bold tracking-wide shadow-sm ${classificationClasses(
                              staff.classification
                            )}`}
                          >
                            {classificationLabel(staff.classification)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Active Alerts List */}
            <div className="rounded-2xl border border-[#EAEAEA] bg-white shadow-[0_2px_8px_rgb(0,0,0,0.02)] overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#EAEAEA] px-7 py-6 bg-white">
                <div>
                  <h3 className="text-[17px] font-bold text-[#111827]">Active Alerts</h3>
                  <p className="mt-1 text-[14px] text-[#6B7280]">
                    System-generated operational alerts requiring resolution
                  </p>
                </div>

                <div
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold ${
                    alerts.length > 0
                      ? "bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]"
                      : "bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]"
                  }`}
                >
                  {alerts.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626] animate-pulse" />}
                  {alerts.length} OPEN
                </div>
              </div>

              <div className="bg-white">
                {alerts.length === 0 ? (
                  <div className="px-7 py-16 flex flex-col items-center text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] text-[#16A34A] shadow-sm mb-4">
                      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="font-semibold text-[#111827] text-[16px]">
                      Zero Active Alerts
                    </p>
                    <p className="mt-1.5 text-[14px] text-[#6B7280] max-w-sm">
                      The readiness engine has not detected any operational anomalies requiring attention.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#EAEAEA]">
                    {alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="px-7 py-6 hover:bg-[#F9FAFB] transition-colors group"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="flex gap-4">
                            <div
                              className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border font-bold shadow-sm ${severityClasses(
                                alert.severity
                              )}`}
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                            </div>

                            <div>
                              <div className="flex flex-wrap items-center gap-2.5">
                                <h4 className="font-bold text-[#111827] text-[15px]">
                                  {alert.title}
                                </h4>

                                <span
                                  className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${severityClasses(
                                    alert.severity
                                  )}`}
                                >
                                  {alert.severity} SEVERITY
                                </span>
                              </div>

                              <p className="mt-1.5 text-[14px] leading-relaxed text-[#4B5563] max-w-2xl">
                                {alert.message}
                              </p>

                              <p className="mt-3 text-[12px] font-medium text-[#9CA3AF] flex items-center gap-2">
                                <span>ID: #{alert.id}</span>
                                <span className="w-1 h-1 rounded-full bg-[#D1D5DB]" />
                                <span>Generated {formatTime(alert.created_at)}</span>
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={() => void handleResolve(alert.id)}
                            disabled={resolvingId === alert.id}
                            className="shrink-0 rounded-lg bg-[#0A2540] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_2px_6px_rgb(10,37,64,0.2)] transition-all hover:bg-[#111827] hover:shadow-[0_4px_12px_rgb(10,37,64,0.3)] disabled:cursor-not-allowed disabled:opacity-60 flex items-center gap-2"
                          >
                            {resolvingId === alert.id ? (
                              <>
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Resolving...
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                                Mark Resolved
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Right Column (Sidebar) */}
          <div className="flex flex-col gap-6 sticky top-[100px]">
            
            {/* Facility Context Map / Signals */}
            <div className="rounded-2xl border border-[#EAEAEA] bg-white shadow-[0_2px_8px_rgb(0,0,0,0.02)] p-7">
              <div>
                <h3 className="text-[17px] font-bold text-[#111827]">Diagnostic Signals</h3>
                <p className="mt-1 text-[13px] text-[#6B7280]">
                  Raw telemetry evaluated by the engine
                </p>
              </div>

              <div className="mt-6 space-y-3">
                <SignalRow
                  label="Backend Gateway"
                  value={health?.status === "healthy" ? "Online" : "Offline"}
                  ok={health?.status === "healthy"}
                />

                <SignalRow
                  label="Database Cluster"
                  value={health?.database === "connected" ? "Connected" : "Disconnected"}
                  ok={health?.database === "connected"}
                />

                <SignalRow
                  label="Facility Heartbeat"
                  value={facility ? facility.reporting_delays > 0 ? "Stale" : "Synchronized" : "Unknown"}
                  ok={facility ? facility.reporting_delays === 0 : false}
                />

                <SignalRow
                  label="Check-in Stream"
                  value={`${facility?.present ?? stats.present} registered`}
                  ok={(facility?.present ?? stats.present) > 0}
                />

                <SignalRow
                  label="Verified Leave"
                  value={`${facility?.approved_absences ?? 0} on record`}
                  ok={true}
                />
              </div>
            </div>

            {/* Overview Summary */}
            <div className="rounded-2xl border border-[#EAEAEA] bg-white shadow-[0_2px_8px_rgb(0,0,0,0.02)] p-7">
              <h3 className="text-[17px] font-bold text-[#111827]">Network Overview</h3>
              <p className="mt-1 text-[13px] text-[#6B7280]">
                High-level operational metrics
              </p>

              <div className="mt-6 space-y-2">
                <OverviewRow label="Total PHCs Monitored" value={overview?.total_phcs ?? 0} />
                <OverviewRow label="Fully Operational" value={overview?.operational ?? 0} positive />
                <OverviewRow label="Detected Staffing Gaps" value={overview?.staffing_gaps ?? 0} warning={(overview?.staffing_gaps ?? 0) > 0} />
                <OverviewRow label="Reporting Delays" value={overview?.reporting_delays ?? 0} warning={(overview?.reporting_delays ?? 0) > 0} />
                <OverviewRow label="Approved Absences" value={overview?.approved_absences ?? 0} />
              </div>

              {facility && (
                <div className="mt-8 rounded-xl border border-[#EAEAEA] bg-[#F9FAFB] p-5 shadow-inner">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-[#6B7280] mb-1">
                        Primary Facility
                      </p>
                      <p className="font-bold text-[#111827] text-[15px]">
                        {facility.facility}
                      </p>
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider shadow-sm ${
                        facility.operational
                          ? "bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]"
                          : "bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]"
                      }`}
                    >
                      {facility.operational ? "Operational" : "Attention"}
                    </span>
                  </div>
                </div>
              )}
            </div>

          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  svgIcon,
  tone,
}: {
  title: string;
  value: number;
  subtitle: string;
  svgIcon: React.ReactNode;
  tone: "blue" | "green" | "red" | "slate";
}) {
  const iconClasses = {
    blue: "bg-[#EFF6FF] text-[#2563EB] ring-[#BFDBFE]",
    green: "bg-[#ECFDF5] text-[#059669] ring-[#A7F3D0]",
    red: "bg-[#FEF2F2] text-[#DC2626] ring-[#FECACA]",
    slate: "bg-[#F3F4F6] text-[#4B5563] ring-[#E5E7EB]",
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white p-6 shadow-[0_2px_8px_rgb(0,0,0,0.02)] transition-shadow hover:shadow-[0_8px_24px_rgb(0,0,0,0.04)]">
      <div className="flex items-start justify-between">
        <p className="text-[14px] font-semibold text-[#4B5563]">{title}</p>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-inset ${iconClasses[tone]}`}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {svgIcon}
          </svg>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[36px] font-bold tracking-tight text-[#111827] leading-none">
          {value}
        </p>
        <p className="mt-2.5 text-[13px] font-medium text-[#6B7280]">{subtitle}</p>
      </div>
    </div>
  );
}

function SignalRow({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[#EAEAEA] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgb(0,0,0,0.02)]">
      <div className="flex items-center gap-3">
        <span
          className={`h-2.5 w-2.5 rounded-full ring-2 ring-white shadow-sm ${
            ok ? "bg-[#10B981]" : "bg-[#F59E0B]"
          }`}
        />
        <span className="text-[13px] font-semibold text-[#4B5563]">{label}</span>
      </div>

      <span
        className={`text-[12px] font-bold tracking-wide uppercase ${
          ok ? "text-[#059669]" : "text-[#D97706]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function OverviewRow({
  label,
  value,
  positive = false,
  warning = false,
}: {
  label: string;
  value: number;
  positive?: boolean;
  warning?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#F3F4F6] last:border-0">
      <span className="text-[14px] font-medium text-[#4B5563]">{label}</span>

      <span
        className={`text-[15px] font-bold ${
          warning
            ? "text-[#DC2626]"
            : positive
              ? "text-[#059669]"
              : "text-[#111827]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
