import React, { useState } from "react";
import { Station, formatLocalDate } from "../types";

interface ReportProps {
  dept: string;
  staffDate: Date | string;
  shiftType: string;
  floorStations: Station[];
  floorLines: any[];
  floorPaths: any[];
  getStationAssignment: (ctx: string, sid: number, half: string) => any;
  auditEvents: any[];
}

export function Report({
  dept,
  staffDate,
  shiftType,
  floorStations,
  floorLines,
  floorPaths,
  getStationAssignment,
  auditEvents
}: ReportProps) {
  const [reportView, setReportView] = useState("assignments");
  const dateStr = formatLocalDate(staffDate);
  const ctx = `${dateStr}|${shiftType}|${dept}`;

  const deptStations = floorStations.filter(s => {
    const parentLine = floorLines.find(l => l.id === s.line_id);
    const parentPath = parentLine ? floorPaths.find(p => p.id === parentLine.path_id) : null;
    return parentPath?.department === dept;
  });

  const rows: any[] = [];
  deptStations.forEach(s => {
    const h1 = getStationAssignment(ctx, s.id, "half1");
    if (h1) {
      rows.push({
        badge: h1.badge,
        name: h1.name,
        login: h1.login,
        path: h1.path,
        station: s.name,
        half: "1st Half",
        method: h1.method,
        changer: "PA Console",
        time: new Date(h1.assignedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      });
    }

    const h2 = getStationAssignment(ctx, s.id, "half2");
    if (h2) {
      rows.push({
        badge: h2.badge,
        name: h2.name,
        login: h2.login,
        path: h2.path,
        station: s.name,
        half: "2nd Half",
        method: h2.method,
        changer: "PA Console",
        time: new Date(h2.assignedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      });
    }
  });

  const downloadCSV = () => {
    const headers = ["Date", "Shift", "Dept", "Badge", "Name", "Login", "Path", "Station", "Half Window", "Method", "Assigned By", "Assigned At"];
    const csvRows = [
      headers.join(","),
      ...rows.map(r => [
        dateStr,
        shiftType,
        dept,
        r.badge,
        `"${r.name}"`,
        r.login,
        `"${r.path}"`,
        r.station,
        r.half,
        r.method,
        `"${r.changer}"`,
        r.time
      ].join(","))
    ];

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ct-report-${dept}-${dateStr}-${shiftType}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 border border-gray-200 rounded-2xl shadow-3xs flex-wrap gap-4">
        <div>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono block">Data Exports Console</span>
          <p className="text-xs text-gray-500 mt-0.5 font-semibold text-indigo-600">{rows.length} placements reported for {dept} on {dateStr}.</p>
        </div>

        <button onClick={downloadCSV} className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-3xs border-none uppercase font-mono">
          Download PDF / CSV
        </button>
      </div>

      <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200 overflow-hidden w-fit">
        {[
          { v: "assignments", l: "📋 Placed Associates Report" },
          { v: "audit", l: "🔍 Administrator Action Logs" }
        ].map(t => (
          <button 
            key={t.v} 
            onClick={() => setReportView(t.v)}
            className={`px-4 py-2 text-xs font-semibold rounded-lg border-none cursor-pointer transition-colors ${
              reportView === t.v ? "bg-white text-indigo-700 shadow-xs" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            {t.l}
          </button>
        ))}
      </div>

      {reportView === "assignments" ? (
        rows.length === 0 ? (
          <div className="text-center py-10 bg-white border border-gray-200 rounded-2xl text-xs text-gray-400 font-mono italic">
            Currently no placements compiled for this shift block.
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-3xs">
            <div className="grid grid-cols-6 gap-2 px-6 py-4 bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono border-b border-gray-200">
              <div>Badge</div>
              <div className="col-span-2">Associate Profile</div>
              <div>Path Placement</div>
              <div>Station / Half</div>
              <div className="text-right">Scanned Time</div>
            </div>

            <div className="divide-y divide-gray-100">
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-6 gap-2 px-6 py-4 items-center text-xs">
                  <span className="font-mono text-gray-500">{r.badge}</span>
                  <div className="col-span-2">
                    <div className="font-bold text-gray-900">{r.name}</div>
                    <div className="text-[10px] text-gray-400 font-mono mt-0.5">@{r.login}</div>
                  </div>
                  <div className="font-semibold text-indigo-600">{r.path}</div>
                  <div>
                    <span className="font-bold text-gray-800">Station {r.station}</span>
                    <span className="block text-[9px] font-mono text-gray-400 font-bold uppercase">{r.half}</span>
                  </div>
                  <div className="text-right font-mono text-gray-500 font-medium">{r.time}</div>
                </div>
              ))}
            </div>
          </div>
        )
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-3xs">
          <div className="grid grid-cols-5 gap-2 px-6 py-4 bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono border-b border-gray-200">
            <div>Timestamp</div>
            <div>Action</div>
            <div className="col-span-2">Description / Log details</div>
            <div className="text-right">Authorized User</div>
          </div>

          <div className="divide-y divide-gray-100">
            {auditEvents.length === 0 ? (
              <div className="text-center py-10 text-xs text-gray-400 font-mono italic col-span-5">
                No logs recorded yet in current browser workspace.
              </div>
            ) : (
              auditEvents.map((e: any, i: number) => (
                <div key={i} className="grid grid-cols-5 gap-2 px-6 py-4 items-center text-xs">
                  <span className="font-mono text-gray-400">{new Date(e.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <div>
                    <span className={`text-[8px] font-mono font-bold border px-2 py-0.5 rounded-full ${
                      e.action === "CLEAR" ? "bg-red-50 text-red-700 border-red-150" : "bg-emerald-50 text-emerald-800 border-emerald-150"
                    }`}>{e.action}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="font-bold text-gray-800">{e.name}</span> placed on <span className="font-semibold text-indigo-700">{e.path}</span> at Station <span className="font-bold text-gray-700">{e.station}</span>
                  </div>
                  <span className="text-right font-mono text-[9px] text-[#2563eb] font-bold">{e.who}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
