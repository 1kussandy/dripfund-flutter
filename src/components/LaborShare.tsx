import React from "react";
import { Associate, Path, formatLocalDate } from "../types";

interface LaborShareProps {
  apiUrl: string;
  laborShareEnabled: boolean;
  setLaborShareEnabled: (val: boolean) => void;
  laborShareCount: number;
  setLaborShareCount: (val: number) => void;
  crossDeptUsage: any;
  staffDate: Date | string;
  shiftType: string;
  mockAssocs: Associate[];
  floorPaths: Path[];
  shiftAssignments: any;
}

export function LaborShare({
  apiUrl,
  laborShareEnabled,
  setLaborShareEnabled,
  laborShareCount,
  setLaborShareCount,
  crossDeptUsage,
  staffDate,
  shiftType,
  mockAssocs,
  floorPaths,
  shiftAssignments
}: LaborShareProps) {
  const dateStr = formatLocalDate(staffDate);
  const contextKey = `live|${dateStr}|${shiftType}`;
  const used = crossDeptUsage[contextKey] || 0;

  // Retrieve current labor-shared associates in both directions based on active shift assignments
  const keyIB = `INBOUND|${dateStr}|${shiftType}`;
  const keyOB = `OUTBOUND|${dateStr}|${shiftType}`;

  const ibShared = Object.keys(shiftAssignments[keyIB] || {}).map(badge => {
    const assoc = mockAssocs.find(a => a.badge === badge);
    const assignment = shiftAssignments[keyIB][badge];
    return { assoc, assignment, targetDept: "INBOUND", homeDept: "OUTBOUND" };
  }).filter(x => x.assoc && (x.assoc.operation_mode === "BOTH" || x.assoc.home_dept?.toUpperCase().includes("OUTBOUND")) && (x.assoc.default_dept || "INBOUND") !== "INBOUND");

  const obShared = Object.keys(shiftAssignments[keyOB] || {}).map(badge => {
    const assoc = mockAssocs.find(a => a.badge === badge);
    const assignment = shiftAssignments[keyOB][badge];
    return { assoc, assignment, targetDept: "OUTBOUND", homeDept: "INBOUND" };
  }).filter(x => x.assoc && (x.assoc.operation_mode === "BOTH" || x.assoc.home_dept?.toUpperCase().includes("INBOUND")) && (x.assoc.default_dept || "INBOUND") === "INBOUND");

  const activeSharedList = [...ibShared, ...obShared];

  return (
    <div className="space-y-6">
      {/* Overview introduction */}
      <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-3xs flex flex-col md:flex-row gap-6 md:items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest font-mono">Department Labor Sharing Control</h3>
          <p className="text-xs text-gray-500 max-w-xl">
            Authorize automated cross-department re-allocation. When enabled, associates registered with "BOTH" operation modes scanning the Kiosk console will automatically get labor shared to process paths in under-staffed departments (Inbound ⇄ Outbound) up to your configured limit.
          </p>
        </div>
        <div className="flex items-center gap-3 self-start md:self-auto">
          <span className="text-xs font-bold text-gray-700 uppercase font-mono">Status:</span>
          <button
            onClick={() => setLaborShareEnabled(!laborShareEnabled)}
            className={`px-4 py-2 text-xs font-extrabold tracking-widest uppercase rounded-xl transition-all cursor-pointer border ${
              laborShareEnabled
                ? "bg-emerald-50 border-emerald-250 text-emerald-700 shadow-3xs"
                : "bg-gray-50 border-gray-250 text-gray-400"
            }`}
          >
            {laborShareEnabled ? "● ACTIVE" : "○ INACTIVE"}
          </button>
        </div>
      </div>

      {/* Main Controls grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Slider settings card */}
        <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-3xs md:col-span-2 space-y-5">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-bold uppercase tracking-widest font-mono text-gray-400">Target Scaling shares</h4>
            <span className="px-3 py-1 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-xs font-bold font-mono">
              Limit: {laborShareCount} AAs
            </span>
          </div>

          <div className="space-y-4">
            <p className="text-xs text-gray-400 leading-normal">
              Set the target number of associates to allow for cross-department labor sharing. Move the slider below to dynamically update the limit.
            </p>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="50"
                value={laborShareCount}
                onChange={e => setLaborShareCount(parseInt(e.target.value))}
                disabled={!laborShareEnabled}
                className="flex-1 accent-emerald-600 h-1.5 cursor-pointer bg-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span className="text-base font-extrabold font-mono text-emerald-700 w-10 text-center">
                {laborShareCount}
              </span>
            </div>
            {!laborShareEnabled && (
              <p className="text-[10px] text-amber-600 font-mono italic">
                * Turn on Labor Share Status above to manage the scaling slider.
              </p>
            )}
          </div>
        </div>

        {/* Real-time stats board */}
        <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-3xs flex flex-col justify-between">
          <h4 className="text-xs font-bold uppercase tracking-widest font-mono text-gray-400 mb-3">Live Feed metrics</h4>
          <div className="space-y-3.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500 font-medium">Currently Shared</span>
              <span className="font-bold text-gray-900 font-mono">{used} AAs</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500 font-medium font-sans">Configured Pool Limit</span>
              <span className="font-bold text-gray-900 font-mono">{laborShareCount} AAs</span>
            </div>
            <div className="flex justify-between items-center border-t border-gray-100 pt-3 text-xs">
              <span className="font-bold text-gray-800">Remaining Slots</span>
              <span className={`font-mono font-bold px-2 py-0.5 rounded-lg ${
                laborShareEnabled && laborShareCount > used
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-gray-50 text-gray-500"
              }`}>
                {laborShareEnabled ? Math.max(0, laborShareCount - used) : 0} open
              </span>
            </div>
          </div>
          <div className="mt-4 text-[10px] font-mono text-gray-400 bg-gray-50 p-2.5 rounded-xl border border-gray-150">
            Selected: <span className="font-semibold text-gray-600">{dateStr}</span> 
            <span className="mx-1.5">|</span> Shift: <span className="font-semibold text-gray-600">{shiftType}</span>
          </div>
        </div>
      </div>

      {/* Listing currently shared associate list */}
      <div className="bg-white border border-gray-200 rounded-3xl shadow-3xs overflow-hidden">
        <div className="px-6 py-4.5 border-b border-gray-150 bg-gray-50/50 flex justify-between items-center flex-wrap gap-2">
          <div>
            <h4 className="text-xs font-black uppercase tracking-widest font-mono text-gray-800">Active Labor Shared Associates Log</h4>
            <p className="text-[10px] text-gray-400 font-medium mt-0.5">List of deployed cross-department personnel for {dateStr}</p>
          </div>
          <div className="px-3 py-1 bg-emerald-50 border border-emerald-100 text-emerald-800 text-[10px] font-bold font-mono rounded-lg">
            {activeSharedList.length} deploy(s)
          </div>
        </div>

        {activeSharedList.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <span className="text-2xl block">🔄</span>
            <p className="text-xs font-semibold text-gray-500">No active labor shares logged for this shift yet.</p>
            <p className="text-[10px] text-gray-400 max-w-sm mx-auto">
              Any scanning personnel scheduled with multi-department competencies will populate here upon kiosk placement.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 font-mono text-[9px] font-bold text-gray-400 uppercase bg-[#FAFBFD]/30">
                  <th className="py-3 px-6">Associate</th>
                  <th className="py-3 px-6">Badge ID</th>
                  <th className="py-3 px-6">Home Dept</th>
                  <th className="py-3 px-6">Assigned Dept</th>
                  <th className="py-3 px-6 text-right">Primary Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {activeSharedList.map(({ assoc, assignment, targetDept, homeDept }) => {
                  if (!assoc) return null;
                  const firstHalfPath = assignment?.half1?.path || "–";
                  const secondHalfPath = assignment?.half2?.path || "–";
                  return (
                    <tr key={assoc.badge} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3.5 px-6 font-semibold text-gray-900">
                        {assoc.name}
                        <span className="text-[9px] text-gray-400 font-mono block">@{assoc.login}</span>
                      </td>
                      <td className="py-3.5 px-6 font-mono text-gray-500 font-semibold">{assoc.badge}</td>
                      <td className="py-3.5 px-6">
                        <span className="px-2.5 py-0.5 bg-gray-100 text-gray-600 rounded-lg text-[10px] font-mono font-bold uppercase">
                          {homeDept}
                        </span>
                      </td>
                      <td className="py-3.5 px-6">
                        <span className="px-2.5 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-lg text-[10px] font-mono font-bold uppercase flex items-center gap-1.5 w-fit">
                          <span>{targetDept}</span>
                          <span className="text-[9px] text-gray-400 font-normal">({firstHalfPath} / {secondHalfPath})</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-mono font-bold uppercase">
                          ✓ Deployed
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
