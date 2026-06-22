import React, { useState } from "react";
import { Associate, formatLocalDate } from "../types";

interface HistoryProps {
  dept: string;
  mockAssocs: Associate[];
  auditEvents?: any[];
}

export function AssignHistory({ dept, mockAssocs, auditEvents = [] }: HistoryProps) {
  const [search, setSearch] = useState("");
  const [roleF, setRoleF] = useState("ALL");
  const [deptF, setDeptF] = useState("ALL");

  const getDisplayRoleName = (pathName: string) => {
    return pathName || "–";
  };

  const isInd = (pathName: string) => {
    if (!pathName) return false;
    const u = pathName.toUpperCase();
    return u.includes("WATERSPIDER") || u.includes("DOWNSTACKER") || u.includes("UNLOADER") || u.includes("UPSTACKER") || u.includes("CAGE");
  };

  // Compile historical records
  const seedH: any[] = [];
  
  // 1. Add current dynamic live audit events
  auditEvents.forEach(e => {
    // AuditEvents format: { who, badge, name, station, path, action, dept, shiftType, date, ts }
    seedH.push({
      badge: e.badge,
      login: e.badge ? mockAssocs.find(ma => ma.badge === e.badge)?.login || "user" : "user",
      name: e.name,
      path: e.path || e.station,
      roleType: isInd(e.path) ? "INDIRECT" : "DIRECT",
      method: "MANUAL",
      assignedAt: e.ts || Date.now(),
      staffDate: e.date,
      shiftType: e.shiftType,
      dept: e.dept || "INBOUND",
      half: "half1"
    });
  });

  // 2. Compile mock historical records spanning up to 30 rolling days
  mockAssocs.forEach((a, idx) => {
    const date = new Date();
    // Rotate through full 30 rolling days context
    date.setDate(date.getDate() - (idx % 30));
    const ds = formatLocalDate(date);
    
    const assignedPaths = (a.permissions && a.permissions.length) ? a.permissions.map(p => p.path_name) : ["CRETS Processing Low Side"];
    assignedPaths.forEach((pathName, pIdx) => {
      seedH.push({
        badge: a.badge,
        login: a.login,
        name: a.name,
        path: pathName,
        roleType: isInd(pathName) ? "INDIRECT" : "DIRECT",
        method: "SCAN",
        assignedAt: Date.now() - (idx * 600000),
        staffDate: ds,
        shiftType: "DAY",
        dept: pIdx % 2 === 0 ? "INBOUND" : "OUTBOUND",
        half: pIdx % 2 === 0 ? "half1" : "half2"
      });
    });
  });

  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

  const filtered = seedH.filter(e => {
    // 30 days rolling limit enforcement
    const eventTime = e.assignedAt || new Date(e.staffDate + "T00:00:00").getTime();
    if (eventTime < thirtyDaysAgo) return false;

    const q = search.toLowerCase();
    const matchesQuery = !search || e.name?.toLowerCase().includes(q) || e.login?.toLowerCase().includes(q) || e.badge?.includes(search) || e.path?.toLowerCase().includes(q);
    const matchesRole = roleF === "ALL" || e.roleType === roleF;
    const matchesDept = deptF === "ALL" || e.dept === deptF;
    return matchesQuery && matchesRole && matchesDept;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 border border-gray-200 rounded-2xl shadow-3xs flex flex-wrap justify-between items-center gap-4">
        <div>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono block">Historical Placements</span>
          <p className="text-xs text-gray-500 mt-0.5 font-semibold text-indigo-600">Rolling 30-day history audit registry.</p>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200 overflow-hidden flex-wrap gap-1">
          {["ALL", "DIRECT", "INDIRECT"].map(r => (
            <button 
              key={r} 
              onClick={() => setRoleF(r)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border-none cursor-pointer ${
                roleF === r ? "bg-indigo-600 text-white" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <input 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          placeholder="Filter history records by login, name or path..." 
          className="flex-1 min-w-[200px] px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:border-indigo-600 shadow-3xs"
        />
        <select value={deptF} onChange={e => setDeptF(e.target.value)} className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium">
          <option value="ALL">All Departments</option>
          <option value="INBOUND">Inbound Log</option>
          <option value="OUTBOUND">Outbound Log</option>
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-3xs">
        <div className="grid grid-cols-6 gap-2 px-6 py-4 bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono border-b border-gray-200">
          <div className="col-span-2">Associate Info</div>
          <div>Assigned Path</div>
          <div>Role Stream</div>
          <div>Dept Mode</div>
          <div className="text-right">Staff Date</div>
        </div>

        <div className="divide-y divide-gray-100 font-sans">
          {filtered.slice(0, 40).map((r, idx) => (
            <div key={idx} className="grid grid-cols-6 gap-2 px-6 py-4 items-center text-xs">
              <div className="col-span-2">
                <div className="font-bold text-gray-900">{r.name}</div>
                <div className="text-[10px] text-gray-400 font-mono mt-0.5">@{r.login} · ID {r.badge}</div>
              </div>
              <div className="font-semibold text-indigo-700">{getDisplayRoleName(r.path)}</div>
              <div>
                <span className={`text-[8px] font-mono font-bold border px-2 py-0.5 rounded-full ${r.roleType === "INDIRECT" ? "bg-purple-50 text-purple-700 border-purple-100" : "bg-blue-50 text-indigo-700 border-indigo-100"}`}>
                  {r.roleType}
                </span>
              </div>
              <div>
                <span className={`text-[8px] font-mono font-bold border px-2 py-0.5 rounded-full ${r.dept === "OUTBOUND" ? "bg-orange-50 text-orange-700 border-orange-100" : "bg-blue-50 text-indigo-700 border-indigo-100"}`}>
                  {r.dept}
                </span>
              </div>
              <div className="text-right font-mono text-gray-500 font-medium">{r.staffDate}</div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-10 text-xs text-gray-400 font-mono italic">
              No history found for current lookup filters.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
