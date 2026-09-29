import Link from "next/link";

export default function RoleSelection() {
  return (
    <main className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6 selection:bg-[#0A2540] selection:text-white">
      <div className="w-full max-w-[800px]">
        {/* Header Section */}
        <div className="text-center mb-16 flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0A2540] text-2xl font-bold text-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] mb-8">
            P
          </div>
          <h1 className="text-[32px] font-bold tracking-tight text-[#111827] mb-3">
            PHC Pulse
          </h1>
          <p className="text-[#6B7280] text-[17px] font-medium max-w-[400px]">
            Staffing & Service-Availability Monitoring
          </p>
          <div className="h-[1px] w-12 bg-[#E5E7EB] mt-8 mb-6" />
          <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-[0.2em]">
            Select Workspace
          </p>
        </div>

        {/* Roles Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          
          {/* Admin Role Card */}
          <Link 
            href="/admin"
            className="group relative flex flex-col justify-between rounded-2xl border border-[#EAEAEA] bg-white p-8 shadow-[0_2px_10px_rgb(0,0,0,0.02)] transition-all duration-300 hover:border-[#D1D5DB] hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-full overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#0A2540] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F3F4F6] text-[#111827] group-hover:bg-[#111827] group-hover:text-white transition-colors duration-300">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#111827] tracking-tight">Admin</h2>
                  <p className="text-[13px] font-medium text-[#6B7280]">District / Facility Officer</p>
                </div>
              </div>
              
              <ul className="space-y-3.5 mb-10 mt-8">
                {["Monitor PHCs", "Review staffing readiness", "Manage operational alerts"].map((item, i) => (
                  <li key={i} className="flex items-center text-[14px] text-[#4B5563] font-medium">
                    <svg className="w-4 h-4 mr-3 text-[#10B981]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="flex items-center text-[14px] font-semibold text-[#111827] group-hover:text-[#0A2540]">
              Open Dashboard
              <svg className="w-4 h-4 ml-2 transform group-hover:translate-x-1 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </div>
          </Link>

          {/* Staff Role Card */}
          <Link 
            href="/staff"
            className="group relative flex flex-col justify-between rounded-2xl border border-[#EAEAEA] bg-white p-8 shadow-[0_2px_10px_rgb(0,0,0,0.02)] transition-all duration-300 hover:border-[#D1D5DB] hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-full overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#10B981] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F3F4F6] text-[#111827] group-hover:bg-[#10B981] group-hover:text-white transition-colors duration-300">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#111827] tracking-tight">Staff</h2>
                  <p className="text-[13px] font-medium text-[#6B7280]">PHC Staff Member</p>
                </div>
              </div>
              
              <ul className="space-y-3.5 mb-10 mt-8">
                {["Check attendance", "View shift", "Request leave", "Monitor synchronization"].map((item, i) => (
                  <li key={i} className="flex items-center text-[14px] text-[#4B5563] font-medium">
                    <svg className="w-4 h-4 mr-3 text-[#10B981]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="flex items-center text-[14px] font-semibold text-[#111827] group-hover:text-[#10B981]">
              Open Dashboard
              <svg className="w-4 h-4 ml-2 transform group-hover:translate-x-1 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </div>
          </Link>

        </div>
      </div>
    </main>
  );
}
