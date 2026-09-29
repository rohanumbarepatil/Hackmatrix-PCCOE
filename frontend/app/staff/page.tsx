"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type Staff = {
  id: number;
  name: string;
  role: string;
  facility_id: number;
};

type Shift = {
  id: number;
  shift_date: string;
  start_time: string;
  end_time: string;
  status: string;
};

type AttendanceRecord = {
  id: number;
  event_type: string;
  timestamp: string;
};

type LeaveRecord = {
  id: number;
  status: string;
  start: string;
  end: string;
};

export default function StaffDashboard() {
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const [staffInfo, setStaffInfo] = useState<{staff: Staff, shift: Shift | null} | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [lastSync, setLastSync] = useState<string>("");
  const [loading, setLoading] = useState(true);
  
  // Leave form state
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [leaveReason, setLeaveReason] = useState("");

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString([], { day: 'numeric', month: 'short' });
  };

  useEffect(() => {
    setLastSync(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const fetchAllStaff = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/staff/all`);
      if (res.ok) {
        const data = await res.json();
        setAllStaff(data.staff);
      }
    } catch (err) {
      console.error("Failed to load staff list", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllStaff();
  }, [fetchAllStaff]);

  const loadStaffData = useCallback(async (staffId: number) => {
    try {
      setLoading(true);
      const shiftRes = await fetch(`${API_URL}/staff/${staffId}/shift`);
      if (shiftRes.ok) {
        const shiftData = await shiftRes.json();
        setStaffInfo(shiftData);
      }
      
      const attRes = await fetch(`${API_URL}/staff/${staffId}/attendance`);
      if (attRes.ok) {
        const attData = await attRes.json();
        setAttendance(attData.attendance);
        setLeaves(attData.leaves);
      }
      
      setLastSync(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.error("Failed to load staff data", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedStaffId) {
      loadStaffData(selectedStaffId);
    }
  }, [selectedStaffId, loadStaffData]);

  const handleCheckIn = async () => {
    if (!staffInfo || !isOnline) return;
    
    try {
      await fetch(`${API_URL}/attendance/check-in/${staffInfo.staff.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facility_id: staffInfo.staff.facility_id,
          shift_assignment_id: staffInfo.shift?.id || null,
          client_timestamp: new Date().toISOString()
        })
      });
      loadStaffData(staffInfo.staff.id);
    } catch (err) {
      console.error("Check-in failed", err);
    }
  };

  const handleCheckOut = async () => {
    if (!staffInfo || !isOnline) return;
    
    try {
      await fetch(`${API_URL}/attendance/check-out/${staffInfo.staff.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facility_id: staffInfo.staff.facility_id,
          shift_assignment_id: staffInfo.shift?.id || null,
          client_timestamp: new Date().toISOString()
        })
      });
      loadStaffData(staffInfo.staff.id);
    } catch (err) {
      console.error("Check-out failed", err);
    }
  };

  const handleLeaveRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffInfo || !isOnline || !leaveStart || !leaveEnd || !leaveReason) return;
    
    try {
      await fetch(`${API_URL}/leave/request/${staffInfo.staff.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facility_id: staffInfo.staff.facility_id,
          start_datetime: new Date(leaveStart).toISOString(),
          end_datetime: new Date(leaveEnd).toISOString(),
          reason: leaveReason
        })
      });
      setShowLeaveForm(false);
      setLeaveStart("");
      setLeaveEnd("");
      setLeaveReason("");
      loadStaffData(staffInfo.staff.id);
    } catch (err) {
      console.error("Leave request failed", err);
    }
  };

  const getLatestStatus = () => {
    if (attendance.length === 0) return "NOT CHECKED IN";
    if (attendance[0].event_type === "CHECK_IN") return "CHECKED IN";
    if (attendance[0].event_type === "CHECK_OUT") return "CHECKED OUT";
    return "NOT CHECKED IN";
  };

  const latestStatus = getLatestStatus();
  
  if (loading && allStaff.length === 0) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <svg className="w-8 h-8 animate-spin text-[#D1D5DB]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  if (!selectedStaffId) {
    return (
      <main className="min-h-screen bg-[#FAFAFA] text-[#111827] flex items-center justify-center p-6 selection:bg-[#10B981] selection:text-white">
        <div className="w-full max-w-[480px]">
          <div className="text-center mb-10">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#10B981] shadow-[0_8px_30px_rgb(16,185,129,0.24)] mb-6">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-[28px] font-bold tracking-tight text-[#111827]">Select Staff Member</h2>
            <p className="mt-2 text-[#6B7280] text-[15px]">Simulate a login by selecting a registered staff account</p>
          </div>

          <div className="bg-white rounded-2xl border border-[#EAEAEA] shadow-[0_2px_8px_rgb(0,0,0,0.04)] overflow-hidden">
            <div className="divide-y divide-[#EAEAEA]">
              {allStaff.map(s => (
                <button 
                  key={s.id} 
                  onClick={() => setSelectedStaffId(s.id)}
                  className="w-full text-left px-6 py-5 hover:bg-[#F9FAFB] transition-colors flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ECFDF5] text-[#059669] font-bold text-[14px]">
                      {s.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-semibold text-[#111827] text-[15px]">{s.name}</div>
                      <div className="text-[13px] text-[#6B7280] mt-0.5">{s.role} · ID: {s.id}</div>
                    </div>
                  </div>
                  <div className="text-[#9CA3AF] group-hover:text-[#10B981] group-hover:translate-x-1 transition-all">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          </div>
          
          <Link href="/" className="mt-8 flex items-center justify-center gap-2 text-[14px] font-medium text-[#6B7280] hover:text-[#111827] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Workspace Selection
          </Link>
        </div>
      </main>
    );
  }

  if (!staffInfo) return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
      <svg className="w-8 h-8 animate-spin text-[#D1D5DB]" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>
  );

  return (
    <main className="min-h-screen bg-[#FAFAFA] text-[#111827] pb-20 selection:bg-[#10B981] selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#EAEAEA] bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1000px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSelectedStaffId(null)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#EAEAEA] bg-white text-[#6B7280] hover:text-[#111827] hover:border-[#D1D5DB] transition"
              title="Switch User"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-[17px] font-bold tracking-tight text-[#111827]">
                {staffInfo.staff.name}
              </h1>
              <p className="text-[13px] text-[#6B7280] flex items-center gap-1.5 mt-0.5">
                {staffInfo.staff.role} 
                <span className="w-1 h-1 rounded-full bg-[#D1D5DB]" /> 
                Facility #{staffInfo.staff.facility_id}
              </p>
            </div>
          </div>
          
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F9FAFB] border border-[#EAEAEA]">
            <div className="relative flex h-2 w-2">
              {isOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isOnline ? "bg-[#10B981]" : "bg-[#EF4444]"}`}></span>
            </div>
            <span className="text-[12px] font-semibold text-[#4B5563] uppercase tracking-wider">
              {isOnline ? "Online Sync Active" : "Offline Mode"}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1000px] px-6 py-8">
        
        {/* Main Action Area */}
        <section className="grid gap-6 md:grid-cols-[1fr_320px] mb-6">
          
          {/* Shift & Check In Card */}
          <div className="rounded-2xl border border-[#EAEAEA] bg-white p-8 shadow-[0_2px_8px_rgb(0,0,0,0.02)] flex flex-col justify-between">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-6">Current Shift Assignment</p>
              
              {staffInfo.shift ? (
                <div className="mb-8">
                  <h2 className="text-[32px] font-bold text-[#111827] tracking-tight leading-tight">Shift #{staffInfo.shift.id}</h2>
                  <p className="text-[#6B7280] mt-2 text-[16px] flex items-center gap-2">
                    <svg className="w-5 h-5 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {formatDate(staffInfo.shift.shift_date)} <span className="text-[#D1D5DB]">|</span> {formatTime(staffInfo.shift.start_time)} - {formatTime(staffInfo.shift.end_time)}
                  </p>
                </div>
              ) : (
                <div className="mb-8">
                  <h2 className="text-[24px] font-bold text-[#111827]">No Active Shift</h2>
                  <p className="text-[#6B7280] mt-2">You are not currently scheduled for a shift.</p>
                </div>
              )}
            </div>

            <div className={`rounded-xl p-5 border flex items-center justify-between transition-colors ${
              latestStatus === "CHECKED IN" 
                ? "bg-[#ECFDF5] border-[#A7F3D0]" 
                : "bg-[#F9FAFB] border-[#EAEAEA]"
            }`}>
              <div>
                <p className={`text-[12px] font-semibold uppercase tracking-wider mb-1 ${
                  latestStatus === "CHECKED IN" ? "text-[#059669]" : "text-[#6B7280]"
                }`}>
                  Current Status
                </p>
                <p className={`text-[18px] font-bold ${
                  latestStatus === "CHECKED IN" ? "text-[#065F46]" : "text-[#111827]"
                }`}>
                  {latestStatus}
                </p>
              </div>
              
              {latestStatus === "CHECKED IN" ? (
                <button 
                  onClick={handleCheckOut}
                  disabled={!isOnline}
                  className="bg-white border border-[#FECACA] text-[#DC2626] px-8 py-3 rounded-lg font-bold text-[14px] shadow-sm hover:bg-[#FEF2F2] disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  CHECK OUT
                </button>
              ) : (
                <button 
                  onClick={handleCheckIn}
                  disabled={!isOnline}
                  className="bg-[#10B981] text-white px-8 py-3 rounded-lg font-bold text-[14px] shadow-[0_4px_14px_rgb(16,185,129,0.4)] hover:bg-[#059669] hover:shadow-[0_6px_20px_rgb(16,185,129,0.5)] disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  CHECK IN
                </button>
              )}
            </div>
          </div>

          {/* Sync & Connectivity Widget */}
          <div className="rounded-2xl border border-[#EAEAEA] bg-white p-6 shadow-[0_2px_8px_rgb(0,0,0,0.02)] flex flex-col">
            <p className="text-[12px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-5">Connectivity</p>
            
            <div className="space-y-4 flex-1">
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#F9FAFB] border border-[#EAEAEA]">
                <span className="text-[14px] font-semibold text-[#4B5563]">Network</span>
                <span className={`text-[13px] font-bold ${isOnline ? "text-[#059669]" : "text-[#DC2626]"}`}>
                  {isOnline ? "Online" : "Offline"}
                </span>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#F9FAFB] border border-[#EAEAEA]">
                <span className="text-[14px] font-semibold text-[#4B5563]">Last Sync</span>
                <span className="text-[13px] font-bold text-[#111827]">{lastSync}</span>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#F9FAFB] border border-[#EAEAEA]">
                <span className="text-[14px] font-semibold text-[#4B5563]">Gateway</span>
                <span className="text-[13px] font-bold text-[#059669]">Connected</span>
              </div>
            </div>
            
            {!isOnline && (
              <div className="mt-4 p-3 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] flex items-start gap-2">
                <svg className="w-5 h-5 text-[#D97706] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-[12px] font-medium text-[#B45309] leading-snug">
                  Events will queue locally and sync automatically when connectivity returns.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Records Section */}
        <section className="rounded-2xl border border-[#EAEAEA] bg-white shadow-[0_2px_8px_rgb(0,0,0,0.02)] overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#EAEAEA] px-7 py-5 bg-white">
            <h3 className="text-[17px] font-bold text-[#111827]">Records & Leave Management</h3>
            <button 
              onClick={() => setShowLeaveForm(!showLeaveForm)}
              className="mt-3 sm:mt-0 text-[13px] font-bold text-[#111827] bg-white border border-[#EAEAEA] px-4 py-2 rounded-lg hover:bg-[#F9FAFB] hover:border-[#D1D5DB] transition-all shadow-[0_1px_2px_rgb(0,0,0,0.02)] flex items-center justify-center gap-2"
            >
              {showLeaveForm ? (
                <>Cancel Request</>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Request Leave
                </>
              )}
            </button>
          </div>
          
          <div className="p-7">
            {showLeaveForm && (
              <form onSubmit={handleLeaveRequest} className="mb-8 bg-[#F9FAFB] p-6 rounded-xl border border-[#EAEAEA]">
                <h4 className="text-[15px] font-bold text-[#111827] mb-5">Submit Leave Request</h4>
                <div className="grid md:grid-cols-2 gap-5 mb-5">
                  <div>
                    <label className="block text-[13px] font-semibold text-[#4B5563] mb-2">Start Date</label>
                    <input type="date" required value={leaveStart} onChange={e => setLeaveStart(e.target.value)} className="w-full text-[14px] px-3 py-2.5 rounded-lg border border-[#D1D5DB] focus:ring-2 focus:ring-[#10B981] focus:border-[#10B981] outline-none transition-all shadow-sm" />
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-[#4B5563] mb-2">End Date</label>
                    <input type="date" required value={leaveEnd} onChange={e => setLeaveEnd(e.target.value)} className="w-full text-[14px] px-3 py-2.5 rounded-lg border border-[#D1D5DB] focus:ring-2 focus:ring-[#10B981] focus:border-[#10B981] outline-none transition-all shadow-sm" />
                  </div>
                </div>
                <div className="mb-6">
                  <label className="block text-[13px] font-semibold text-[#4B5563] mb-2">Reason</label>
                  <input type="text" required value={leaveReason} onChange={e => setLeaveReason(e.target.value)} placeholder="E.g., Medical emergency, Family event" className="w-full text-[14px] px-3 py-2.5 rounded-lg border border-[#D1D5DB] focus:ring-2 focus:ring-[#10B981] focus:border-[#10B981] outline-none transition-all shadow-sm" />
                </div>
                <button type="submit" disabled={!isOnline} className="w-full sm:w-auto bg-[#111827] text-white font-semibold py-2.5 px-6 rounded-lg hover:bg-[#374151] shadow-sm disabled:opacity-50 transition-colors">
                  Submit Request
                </button>
              </form>
            )}

            <div className="grid md:grid-cols-2 gap-x-12 gap-y-8">
              <div>
                <h3 className="text-[14px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-4">Recent Attendance</h3>
                {attendance.length === 0 ? (
                  <div className="text-[14px] text-[#6B7280] py-4 bg-[#F9FAFB] rounded-xl border border-dashed border-[#D1D5DB] text-center">No recent records.</div>
                ) : (
                  <div className="space-y-3">
                    {attendance.map(a => (
                      <div key={a.id} className="flex justify-between items-center py-3 border-b border-[#F3F4F6] last:border-0">
                        <div>
                          <span className="text-[#111827] font-semibold text-[14px]">{formatDate(a.timestamp)}</span>
                          <span className="text-[#6B7280] ml-2 text-[13px]">{formatTime(a.timestamp)}</span>
                        </div>
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider ${a.event_type === "CHECK_IN" ? "bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]" : "bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB]"}`}>
                          {a.event_type.replace('_', ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div>
                <h3 className="text-[14px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-4">Leave History</h3>
                {leaves.length === 0 ? (
                  <div className="text-[14px] text-[#6B7280] py-4 bg-[#F9FAFB] rounded-xl border border-dashed border-[#D1D5DB] text-center">No leave records.</div>
                ) : (
                  <div className="space-y-3">
                    {leaves.map(l => (
                      <div key={l.id} className="flex justify-between items-center py-3 border-b border-[#F3F4F6] last:border-0">
                        <div className="text-[#111827] font-semibold text-[14px]">
                          {formatDate(l.start)} <span className="text-[#9CA3AF] mx-1">→</span> {formatDate(l.end)}
                        </div>
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider ${l.status === "APPROVED" ? "bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]" : "bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]"}`}>
                          {l.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
