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
      return "bg-emerald-50 text-emerald-700";
    case "APPROVED_ABSENCE":
      return "bg-blue-50 text-blue-700";
    case "REPORTING_DELAY":
      return "bg-amber-50 text-amber-700";
    case "POSSIBLE_STAFFING_GAP":
      return "bg-red-50 text-red-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function severityClasses(value: string) {
  switch (value) {
    case "HIGH":
      return "bg-red-50 text-red-700 border-red-100";
    case "MEDIUM":
      return "bg-amber-50 text-amber-700 border-amber-100";
    default:
      return "bg-blue-50 text-blue-700 border-blue-100";
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

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [overview, setOverview] = useState<DistrictOverview | null>(null);
  const [readiness, setReadiness] = useState<Readiness[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
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
    <main className="min-h-screen bg-[#f6f8fb] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between px-6 py-5 lg:px-10">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-xl font-bold text-white shadow-sm">
              P
            </div>

            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-950">
                PHC Pulse
              </h1>
              <p className="text-sm text-slate-500">
                Staffing &amp; Service-Availability Monitoring
              </p>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <div className="hidden text-right sm:block">
              <p className="text-xs text-slate-500">System status</p>
              <div className="mt-0.5 flex items-center justify-end gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    systemOperational ? "bg-emerald-500" : "bg-red-500"
                  }`}
                />
                <span className="text-sm font-semibold text-slate-900">
                  {loading
                    ? "Checking..."
                    : systemOperational
                      ? "Operational"
                      : "Attention needed"}
                </span>
              </div>
            </div>

            <button
              onClick={handleRefresh}
              disabled={loading || refreshing}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1320px] px-6 py-8 lg:px-10">
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span className="font-semibold">Dashboard error:</span> {error}
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
                District monitoring
              </p>
              <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
                {overview?.district || "PHC Karveer"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {facility
                  ? `Facility ID: ${facility.facility_id} · Live readiness monitoring`
                  : "Live readiness monitoring"}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 px-5 py-3 text-right">
              <p className="text-xs text-slate-500">Last updated</p>
              <p className="mt-1 text-sm font-bold text-slate-900">
                {formatTime(new Date().toISOString())}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="PHCs Monitored"
            value={overview?.total_phcs ?? 0}
            subtitle={`${overview?.operational ?? 0} operational`}
            icon="⌂"
            tone="blue"
          />

          <StatCard
            title="Staff Monitored"
            value={stats.monitored}
            subtitle="Active records"
            icon="••"
            tone="slate"
          />

          <StatCard
            title="Present"
            value={stats.present}
            subtitle="Recorded check-ins"
            icon="✓"
            tone="green"
          />

          <StatCard
            title="Attention Needed"
            value={
              (overview?.staffing_gaps ?? 0) +
              (overview?.reporting_delays ?? 0)
            }
            subtitle={`${overview?.staffing_gaps ?? 0} staffing gap · ${
              overview?.reporting_delays ?? 0
            } reporting delay`}
            icon="!"
            tone="red"
          />
        </section>

        <section className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,0.75fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h3 className="text-lg font-bold text-slate-950">
                  Staff Readiness
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Current staffing signals from the facility
                </p>
              </div>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {readiness.length || overview?.total_staff_monitored || 0}{" "}
                monitored
              </span>
            </div>

            <div>
              {loading && readiness.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-slate-500">
                  Loading staff readiness...
                </div>
              ) : readiness.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-slate-500">
                  No staff readiness records available.
                </div>
              ) : (
                readiness.map((staff, index) => (
                  <div
                    key={`${staff.staff_id}-${staff.shift_id}`}
                    className={`flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between ${
                      index !== readiness.length - 1
                        ? "border-b border-slate-100"
                        : ""
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
                        {initials(staff.staff)}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">
                          {staff.staff}
                        </p>
                        <p className="mt-0.5 text-sm text-slate-500">
                          {staff.role} · Shift #{staff.shift_id}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-5 sm:justify-end">
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Confidence</p>
                        <p className="text-sm font-bold text-slate-900">
                          {Math.round(staff.confidence * 100)}%
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ${classificationClasses(
                          staff.classification
                        )}`}
                      >
                        {classificationLabel(staff.classification)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h3 className="text-lg font-bold text-slate-950">
                Facility Signals
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Signals used by the readiness engine
              </p>
            </div>

            <div className="mt-5 space-y-3">
              <SignalRow
                label="Backend API"
                value={
                  health?.status === "healthy" ? "Connected" : "Unavailable"
                }
                ok={health?.status === "healthy"}
              />

              <SignalRow
                label="Database"
                value={
                  health?.database === "connected"
                    ? "Connected"
                    : "Disconnected"
                }
                ok={health?.database === "connected"}
              />

              <SignalRow
                label="Facility heartbeat"
                value={
                  facility
                    ? facility.reporting_delays > 0
                      ? "Stale"
                      : "Recent"
                    : "Unknown"
                }
                ok={facility ? facility.reporting_delays === 0 : false}
              />

              <SignalRow
                label="Check-in records"
                value={`${facility?.present ?? stats.present} present`}
                ok={(facility?.present ?? stats.present) > 0}
              />

              <SignalRow
                label="Approved leave"
                value={`${facility?.approved_absences ?? 0} verified`}
                ok={true}
              />
            </div>
          </div>
        </section>

        <section className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h3 className="text-lg font-bold text-slate-950">Alerts</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Open operational alerts requiring district attention
                </p>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  alerts.length > 0
                    ? "bg-red-50 text-red-700"
                    : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {alerts.length} open
              </span>
            </div>

            <div>
              {alerts.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-xl text-emerald-600">
                    ✓
                  </div>
                  <p className="mt-4 font-semibold text-slate-900">
                    No open alerts
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    All currently recorded alerts have been resolved.
                  </p>
                </div>
              ) : (
                alerts.map((alert, index) => (
                  <div
                    key={alert.id}
                    className={`px-6 py-5 ${
                      index !== alerts.length - 1
                        ? "border-b border-slate-100"
                        : ""
                    }`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex gap-4">
                        <div
                          className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-bold ${severityClasses(
                            alert.severity
                          )}`}
                        >
                          !
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-semibold text-slate-900">
                              {alert.title}
                            </h4>

                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${severityClasses(
                                alert.severity
                              )}`}
                            >
                              {alert.severity}
                            </span>
                          </div>

                          <p className="mt-1 text-sm leading-6 text-slate-600">
                            {alert.message}
                          </p>

                          <p className="mt-2 text-xs text-slate-400">
                            Alert #{alert.id} · Created{" "}
                            {formatTime(alert.created_at)}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => void handleResolve(alert.id)}
                        disabled={resolvingId === alert.id}
                        className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {resolvingId === alert.id
                          ? "Resolving..."
                          : "Resolve"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-950">
              District Overview
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Current facility-level operational picture
            </p>

            <div className="mt-5 space-y-3">
              <OverviewRow
                label="Total PHCs"
                value={overview?.total_phcs ?? 0}
              />
              <OverviewRow
                label="Operational"
                value={overview?.operational ?? 0}
                positive
              />
              <OverviewRow
                label="Staffing gaps"
                value={overview?.staffing_gaps ?? 0}
                warning={(overview?.staffing_gaps ?? 0) > 0}
              />
              <OverviewRow
                label="Reporting delays"
                value={overview?.reporting_delays ?? 0}
                warning={(overview?.reporting_delays ?? 0) > 0}
              />
              <OverviewRow
                label="Approved absences"
                value={overview?.approved_absences ?? 0}
              />
            </div>

            {facility && (
              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Facility
                    </p>
                    <p className="mt-1 font-bold text-slate-900">
                      {facility.facility}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      facility.operational
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {facility.operational ? "Operational" : "Attention"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>

        <footer className="py-8 text-center text-xs text-slate-400">
          PHC Pulse · Live staffing and service-availability monitoring
        </footer>
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  tone,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: string;
  tone: "blue" | "green" | "red" | "slate";
}) {
  const iconClasses = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-700",
    slate: "bg-slate-100 text-slate-700",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold ${iconClasses[tone]}`}
        >
          {icon}
        </div>
      </div>

      <p className="mt-5 text-3xl font-bold tracking-tight text-slate-950">
        {value}
      </p>

      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
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
    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3.5">
      <div className="flex items-center gap-3">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            ok ? "bg-emerald-500" : "bg-amber-500"
          }`}
        />
        <span className="text-sm font-medium text-slate-700">{label}</span>
      </div>

      <span
        className={`text-xs font-semibold ${
          ok ? "text-slate-600" : "text-amber-700"
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
    <div className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
      <span className="text-sm text-slate-600">{label}</span>

      <span
        className={`text-sm font-bold ${
          warning
            ? "text-amber-700"
            : positive
              ? "text-emerald-700"
              : "text-slate-900"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
