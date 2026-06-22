import React from "react";
import { formatLocalDate } from "../types";

function getShiftInfoText(dateVal: Date | string) {
  const dateObj = dateVal instanceof Date ? dateVal : new Date(dateVal + "T00:00:00");
  const day = dateObj.getDay(); // 0 is Sunday, 3 is Wednesday, 6 is Saturday
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = days[day];

  if (day >= 0 && day <= 2) {
    return {
      dayName,
      dayShift: "FHD (Front Half Days)",
      nightShift: "FHN (Front Half Nights)"
    };
  }
  if (day === 3) {
    return {
      dayName,
      dayShift: "FHD & BHD Overlap",
      nightShift: "FHN & BHN Overlap"
    };
  }
  return {
    dayName,
    dayShift: "BHD (Back Half Days)",
    nightShift: "BHN (Back Half Nights)"
  };
}

interface DashboardProps {
  shiftType: string;
  staffDate: Date | string;
  dept: string;
  floorPaths: any[];
  floorLines: any[];
  floorStations: any[];
  getStationAssignment: (ctx: string, sid: number, half: string) => any;
  getBadgeAssignment: (ctx: string, badge: string, half: string) => any;
  SA: (sid: number, half: string) => boolean;
  shiftAssignments: any;
  mockAssocs: any[];
}

export function Dashboard({
  shiftType,
  staffDate,
  dept,
  floorPaths,
  floorLines,
  floorStations,
  getStationAssignment,
  getBadgeAssignment,
  SA,
  shiftAssignments,
  mockAssocs
}: DashboardProps) {
  const [activeList, setActiveList] = React.useState<"assigned" | "see_admin" | "manual" | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");

  const dateObj = staffDate instanceof Date ? staffDate : new Date(staffDate);
  const dateStr = formatLocalDate(dateObj);
  const ctx = `${dateStr}|${shiftType}|${dept}`;

  // Format date like: "Sat, 6/13/2026"
  const formattedDate = dateObj.toLocaleDateString("en-US", {
    weekday: "short",
    month: "numeric",
    day: "numeric",
    year: "numeric"
  });

  const deptPaths = floorPaths.filter(p => p.department === dept);
  const deptPathIds = deptPaths.map(p => p.id);
  const deptLines = floorLines.filter(l => deptPathIds.includes(l.path_id));
  const deptLineIds = deptLines.map(l => l.id);
  const deptStations = floorStations.filter(s => deptLineIds.includes(s.line_id));

  const totalStations = deptStations.length || 1;

  // Track distinct placed associate badges
  const placedAssociates = new Set<string>();
  let directCount = 0;
  let indirectCount = 0;
  let manualCount = 0;
  let autoCount = 0;
  let filledCount = 0;

  const isInd = (p: string | null | undefined) => {
    if (!p) return false;
    const u = String(p).toUpperCase();
    return u.includes("WATERSPIDER") || u.includes("DOWNSTACKER") || u.includes("UNLOADER") || u.includes("UPSTACKER") || u.includes("CAGE");
  };

  // Scan all stations in deptStations for active placements in any half
  deptStations.forEach(s => {
    const h1 = getStationAssignment(ctx, s.id, "half1");
    const h2 = getStationAssignment(ctx, s.id, "half2");

    if (h1) {
      filledCount++;
      placedAssociates.add(h1.badge);

      const rt = isInd(h1.path) ? "INDIRECT" : "DIRECT";
      if (rt === "INDIRECT") indirectCount++;
      else directCount++;

      if (h1.roleType === "MANUAL" || h1.method === "MANUAL") {
        manualCount++;
      } else {
        autoCount++;
      }
    }

    if (h2 && (!h1 || h1.badge !== h2.badge)) {
      placedAssociates.add(h2.badge);

      const rt = isInd(h2.path) ? "INDIRECT" : "DIRECT";
      if (rt === "INDIRECT") indirectCount++;
      else directCount++;

      if (h2.roleType === "MANUAL" || h2.method === "MANUAL") {
        manualCount++;
      } else {
        autoCount++;
      }
    }
  });

  const assignedCount = placedAssociates.size;

  // Calculate See Admin from shiftAssignments
  const sKey = `${dept}|${dateStr}|${shiftType}`;
  const currentAssignments = shiftAssignments[sKey] || {};
  let seeAdminCount = 0;

  Object.entries(currentAssignments).forEach(([badge, data]: [string, any]) => {
    const h1 = data.half1;
    const h2 = data.half2;
    const isH1See = h1 && h1.path === "SEE ADMIN";
    const isH2See = h2 && h2.path === "SEE ADMIN";

    const liveH1St = getBadgeAssignment(ctx, badge, "half1");
    const liveH2St = getBadgeAssignment(ctx, badge, "half2");
    const hasStationPlacement = liveH1St !== null || liveH2St !== null;

    if (!hasStationPlacement && (isH1See || isH2See)) {
      seeAdminCount++;
    }
  });

  const openStations = totalStations - filledCount;
  const utilization = Math.round((filledCount / totalStations) * 100);

  // Path utilization counters
  const pathUsage: Record<string, number> = {};
  deptStations.forEach(s => {
    const h1 = getStationAssignment(ctx, s.id, "half1");
    const h2 = getStationAssignment(ctx, s.id, "half2");
    if (h1 && h1.path) {
      pathUsage[h1.path] = (pathUsage[h1.path] || 0) + 1;
    }
    if (h2 && h2.path && h2.path !== h1?.path) {
      pathUsage[h2.path] = (pathUsage[h2.path] || 0) + 1;
    }
  });
  const topPaths = Object.entries(pathUsage).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Lists Computation
  const seeAdminList: any[] = [];
  Object.entries(currentAssignments).forEach(([badge, data]: [string, any]) => {
    const assoc = mockAssocs.find(a => a.badge === badge);
    if (!assoc) return;
    const h1 = data.half1;
    const h2 = data.half2;
    const isH1See = h1 && h1.path === "SEE ADMIN";
    const isH2See = h2 && h2.path === "SEE ADMIN";

    const liveH1St = getBadgeAssignment(ctx, badge, "half1");
    const liveH2St = getBadgeAssignment(ctx, badge, "half2");
    const hasStationPlacement = liveH1St !== null || liveH2St !== null;

    if (!hasStationPlacement && (isH1See || isH2See)) {
      seeAdminList.push({
        badge,
        name: assoc.name,
        login: assoc.login,
        h1Reason: isH1See ? (h1.seeAdminReason || "No first half stations open.") : null,
        h2Reason: isH2See ? (h2.seeAdminReason || "No second half stations open.") : null,
      });
    }
  });

  const manualList: any[] = [];
  const manualSeen = new Set<string>();
  deptStations.forEach(s => {
    const h1 = getStationAssignment(ctx, s.id, "half1");
    const h2 = getStationAssignment(ctx, s.id, "half2");

    if (h1 && (h1.roleType === "MANUAL" || h1.method === "MANUAL")) {
      if (!manualSeen.has(h1.badge)) {
        manualSeen.add(h1.badge);
        manualList.push({
          badge: h1.badge,
          name: h1.name,
          login: h1.login,
          station: s.name,
          path: h1.path,
          half: "H1"
        });
      }
    }
    if (h2 && (h2.roleType === "MANUAL" || h2.method === "MANUAL")) {
      if (!manualSeen.has(h2.badge)) {
        manualSeen.add(h2.badge);
        manualList.push({
          badge: h2.badge,
          name: h2.name,
          login: h2.login,
          station: s.name,
          path: h2.path,
          half: h1?.badge === h2.badge ? "H1 & H2" : "H2"
        });
      }
    }
  });

  const assignedList: any[] = [];
  const assignedSeen = new Set<string>();
  deptStations.forEach(s => {
    const h1 = getStationAssignment(ctx, s.id, "half1");
    const h2 = getStationAssignment(ctx, s.id, "half2");

    if (h1) {
      if (!assignedSeen.has(h1.badge)) {
        assignedSeen.add(h1.badge);
        assignedList.push({
          badge: h1.badge,
          name: h1.name,
          login: h1.login,
          station: s.name,
          path: h1.path,
          method: h1.method || "AUTO",
          half: "H1"
        });
      }
    }
    if (h2) {
      if (!assignedSeen.has(h2.badge)) {
        assignedSeen.add(h2.badge);
        assignedList.push({
          badge: h2.badge,
          name: h2.name,
          login: h2.login,
          station: s.name,
          path: h2.path,
          method: h2.method || "AUTO",
          half: h1?.badge === h2.badge ? "H1 & H2" : "H2"
        });
      }
    }
  });

  return (
    <div className="space-y-6">
      {/* Dashboard Top Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-gray-150 pb-5 mb-2 border-gray-205">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse"></div>
          <h2 className="text-sm font-extrabold text-gray-900 font-mono tracking-widest uppercase">
            DASHBOARD · TEN1 Sandip · {(() => {
              const info = getShiftInfoText(staffDate);
              const label = shiftType === "DAY" ? info.dayShift : info.nightShift;
              return `${info.dayName}: ${label}`;
            })().toUpperCase()} · {formattedDate} · {dept.toUpperCase()}
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Column 1: Placements Status */}
        <div className="bg-[#FAFBFD]/40 border border-gray-200 rounded-3xl p-6 shadow-3xs flex flex-col justify-between min-h-[225px]">
          {/* ASSIGNED CLICK */}
          <div 
            onClick={() => { setActiveList(activeList === "assigned" ? null : "assigned"); setSearchQuery(""); }}
            className={`cursor-pointer group p-4 rounded-xl transition-all duration-200 border ${
              activeList === "assigned" ? "bg-emerald-50/75 border-emerald-200 ring-2 ring-emerald-500/5 shadow-xs" : "bg-transparent border-transparent hover:bg-gray-50/75 hover:border-gray-100"
            }`}
          >
            <div className="text-4xl sm:text-5xl font-extrabold text-gray-950 tracking-tight font-sans">
              {assignedCount}
            </div>
            <div className="text-[10px] font-extrabold text-gray-400 group-hover:text-emerald-600 transition-colors uppercase tracking-widest font-mono mt-1 flex flex-wrap items-center gap-1">
              ASSIGNED <span className="opacity-0 group-hover:opacity-100 transition-all duration-200 font-sans text-[9px] lowercase font-medium text-gray-400"> (click list)</span>
            </div>
          </div>
          
          {/* SEE ADMIN CLICK */}
          <div 
            onClick={() => { setActiveList(activeList === "see_admin" ? null : "see_admin"); setSearchQuery(""); }}
            className={`cursor-pointer group p-4 rounded-xl transition-all duration-200 border border-t-gray-100 mt-2 ${
              activeList === "see_admin" ? "bg-amber-50/75 border-amber-250 ring-2 ring-amber-500/5 shadow-xs" : "border-transparent hover:bg-gray-50/75 hover:border-gray-100"
            }`}
          >
            <div className="text-4xl sm:text-5xl font-extrabold text-amber-600 tracking-tight font-sans">
              {seeAdminCount}
            </div>
            <div className="text-[10px] font-extrabold text-gray-400 group-hover:text-amber-700 transition-colors uppercase tracking-widest font-mono mt-1 flex flex-wrap items-center gap-1">
              SEE ADMIN <span className="font-mono text-amber-500">↗</span> <span className="opacity-0 group-hover:opacity-100 transition-all duration-200 font-sans text-[9px] lowercase font-medium text-gray-400"> (click list)</span>
            </div>
          </div>
        </div>

        {/* Column 2: Floor Map Stations */}
        <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-3xs flex flex-col justify-between min-h-[225px]">
          <div>
            <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-widest font-mono block">
              FLOOR MAP STATIONS · {dept.toUpperCase()}
            </span>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 mt-6 justify-between">
              <div className="min-w-[65px] flex-1">
                <div className="text-2xl sm:text-3xl font-extrabold text-gray-950 font-sans leading-none">{totalStations}</div>
                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider font-mono mt-1">TOTAL</div>
              </div>
              <div className="min-w-[65px] flex-1">
                <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 font-sans leading-none">{filledCount}</div>
                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider font-mono mt-1">FILLED</div>
              </div>
              <div className="min-w-[65px] flex-1">
                <div className="text-2xl sm:text-3xl font-extrabold text-gray-500 font-sans leading-none">{openStations}</div>
                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider font-mono mt-1">OPEN</div>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-100 pt-4 mt-5 flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-semibold text-gray-500 font-sans">Utilization</span>
            <span className="bg-emerald-50 text-emerald-700 text-xs px-2.5 py-0.5 rounded-full font-mono font-bold border border-emerald-200 whitespace-nowrap">
              {utilization}% utilization
            </span>
          </div>
        </div>

        {/* Column 3: Role Breakdown */}
        <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-3xs flex flex-col justify-between min-h-[225px]">
          <div>
            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest font-mono block">
              ROLE BREAKDOWN
            </span>
            <div className="flex flex-wrap gap-2 mt-4 justify-between">
              <div className="p-2 border border-transparent rounded-xl min-w-[70px] flex-1">
                <div className="text-xl sm:text-2xl font-extrabold text-gray-950 font-sans leading-none">{directCount}</div>
                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider font-mono mt-1">DIRECT</div>
              </div>
              <div className="p-2 border border-transparent rounded-xl min-w-[70px] flex-1">
                <div className="text-xl sm:text-2xl font-extrabold text-gray-950 font-sans leading-none">{indirectCount}</div>
                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider font-mono mt-1">INDIRECT</div>
              </div>
              
              {/* MANUAL PLACEMENT LIST TRIGGER */}
              <div 
                onClick={() => { setActiveList(activeList === "manual" ? null : "manual"); setSearchQuery(""); }}
                className={`cursor-pointer group p-2 border rounded-xl transition-all duration-200 min-w-[70px] flex-1 ${
                  activeList === "manual" ? "bg-emerald-50 border-emerald-200 shadow-3xs" : "bg-transparent border-transparent hover:bg-gray-50 hover:border-gray-100"
                }`}
              >
                <div className="text-xl sm:text-2xl font-extrabold text-gray-950 font-sans leading-none">{manualCount}</div>
                <div className="text-[9px] font-extrabold text-emerald-600 transition-colors uppercase tracking-wider font-mono mt-1 flex items-center gap-0.5 whitespace-nowrap">
                  MANUAL <span className="text-emerald-400 group-hover:translate-x-0.5 transition-transform">↗</span>
                </div>
              </div>
              
              <div className="p-2 border border-transparent rounded-xl min-w-[70px] flex-1">
                <div className="text-xl sm:text-2xl font-extrabold text-gray-950 font-sans leading-none">{autoCount}</div>
                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider font-mono mt-1">AUTO</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded List Details Viewer */}
      {activeList && (
        <div className="bg-white border border-emerald-200 rounded-3xl p-6 shadow-md animate-fadeIn space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-gray-900 uppercase font-mono tracking-wider flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  activeList === "assigned" ? "bg-emerald-600" :
                  activeList === "see_admin" ? "bg-amber-550" : "bg-pink-600"
                }`}></span>
                {activeList === "assigned" && `Assigned Associates List (${assignedList.length})`}
                {activeList === "see_admin" && `See Admin Associates List (${seeAdminList.length})`}
                {activeList === "manual" && `Manual Placement List (${manualList.length})`}
              </h3>
              <p className="text-[9px] text-gray-400 font-mono mt-0.5 uppercase tracking-widest leading-none">
                ACTIVE OPERATIONAL RECORDS · CLICK CARD AGAIN OR CLOSE TO HIDE
              </p>
            </div>
            <button 
              onClick={() => setActiveList(null)}
              className="p-1 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-bold font-mono transition-colors border border-gray-200 flex items-center gap-1 shadow-3xs"
            >
              ✕ CLOSE
            </button>
          </div>

          <div className="flex gap-4">
            <input 
              type="text"
              placeholder="Search by login, name, badge, path..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 text-xs border border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/5 focus:outline-none font-sans"
            />
          </div>

          <div className="overflow-x-auto max-h-[300px] border border-gray-100 rounded-xl">
            <table className="w-full text-left text-xs font-sans">
              <thead>
                <tr className="bg-[#FAFBFD]/60 border-b border-gray-100 text-[9px] font-extrabold text-gray-400 uppercase tracking-widest font-mono">
                  <th className="py-3 px-4">Name / Login</th>
                  <th className="py-3 px-4">Badge ID</th>
                  <th className="py-3 px-4">Process Path</th>
                  {activeList !== "see_admin" && <th className="py-3 px-4">Station Slot</th>}
                  {activeList !== "see_admin" && <th className="py-3 px-4">Work Half</th>}
                  {activeList === "assigned" && <th className="py-3 px-4">Method</th>}
                  {activeList === "see_admin" && <th className="py-3 px-4">Reason to Seek Admin</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(() => {
                  const rawList = 
                    activeList === "assigned" ? assignedList :
                    activeList === "see_admin" ? seeAdminList :
                    manualList;

                  const filtered = rawList.filter(item => {
                    const q = searchQuery.toLowerCase();
                    return (
                      (item.name || "").toLowerCase().includes(q) ||
                      (item.login || "").toLowerCase().includes(q) ||
                      (item.badge || "").toLowerCase().includes(q) ||
                      (item.path || "").toLowerCase().includes(q) ||
                      (item.station || "").toLowerCase().includes(q) ||
                      (item.h1Reason || "").toLowerCase().includes(q) ||
                      (item.h2Reason || "").toLowerCase().includes(q)
                    );
                  });

                  if (!filtered.length) {
                    return (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-gray-400 italic font-mono text-[11px]">
                          No records found match the criteria.
                        </td>
                      </tr>
                    );
                  }

                  return filtered.map((item, idx) => (
                    <tr key={item.badge + "-" + idx} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-gray-900">
                        <div>{item.name}</div>
                        <div className="text-[10px] text-gray-400 font-mono font-medium mt-0.5">@{item.login}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-500 font-medium">{item.badge}</td>
                      <td className="py-3 px-4">
                        <span className="bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md text-[10px] text-slate-650 font-bold font-mono">
                          {item.path || "SEE ADMIN"}
                        </span>
                      </td>
                      {activeList !== "see_admin" && (
                        <td className="py-3 px-4">
                          <span className="text-emerald-700 font-bold font-mono uppercase bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 text-[10px]">
                            {item.station}
                          </span>
                        </td>
                      )}
                      {activeList !== "see_admin" && (
                        <td className="py-3 px-4">
                          <span className="text-emerald-700 font-bold font-mono uppercase bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 text-[10px]">
                            {item.half}
                          </span>
                        </td>
                      )}
                      {activeList === "assigned" && (
                        <td className="py-3 px-4 font-semibold text-[10px] font-mono text-gray-400">
                          {item.method === "MANUAL" ? (
                            <span className="text-pink-600 bg-pink-50 border border-pink-100 px-1.5 py-0.5 rounded font-bold">MANUAL</span>
                          ) : (
                            <span className="text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded font-bold">AUTO</span>
                          )}
                        </td>
                      )}
                      {activeList === "see_admin" && (
                        <td className="py-3 px-4 text-amber-700 font-semibold font-mono text-[10px] leading-relaxed">
                          {item.h1Reason && <div className="text-amber-800">1st Half: {item.h1Reason}</div>}
                          {item.h2Reason && <div className="text-amber-800 mt-1">2nd Half: {item.h2Reason}</div>}
                        </td>
                      )}
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top Paths Row */}
      <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-3xs">
        <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest font-mono block mb-5">
          TOP PATHS — {dept.toUpperCase()}
        </span>
        {topPaths.length > 0 ? (
          <div className="space-y-4">
            {topPaths.map(([pathName, cnt]) => {
              const max = topPaths[0][1] || 1;
              const pct = (cnt / max) * 100;
              return (
                <div key={pathName} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-gray-750 font-sans">{pathName}</span>
                    <span className="text-emerald-700 font-mono font-bold">{cnt} Placed</span>
                  </div>
                  <div className="w-full bg-gray-50 h-2 rounded-full overflow-hidden border border-gray-100 p-0.5">
                    <div className="h-full rounded-full bg-emerald-600 transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic font-medium font-sans">No placements registered in the active structures yet.</p>
        )}
      </div>
    </div>
  );
}
