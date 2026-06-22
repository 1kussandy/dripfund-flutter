import React, { useState } from "react";
import { PerformanceRate } from "../types";

export function Performance() {
  const [rates, setRates] = useState<PerformanceRate[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [msg, setMsg] = useState("");

  const uploadRates = (csvText: string) => {
    try {
      const lines = csvText.trim().split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) throw new Error("No data");
      
      const mocked: PerformanceRate[] = lines.slice(1).map((l, id) => {
        const parts = l.split(",");
        const login = parts[0]?.trim() || "jsmith";
        const rate = parseFloat(parts[1]?.trim() || "85");
        const stName = parts[2]?.trim() || "1-1";
        
        return {
          id: id + 1,
          login,
          rate,
          station_id: id + 100,
          station_name: stName,
          line_name: "Line 1",
          target_rate: 100
        };
      });

      setRates(mocked);
      setMsg("✅ Real-Time Rates successfully loaded.");
    } catch {
      setMsg("❌ Error parsing Performance Rates CSV file.");
    }
  };

  const uploadTargets = (csvText: string) => {
    try {
      const lines = csvText.trim().split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) throw new Error("No data");
      
      setRates(curr => curr.map((r, id) => {
        const parts = lines[1 + (id % (lines.length - 1))].split(",");
        return {
          ...r,
          target_rate: parseFloat(parts[1]?.trim() || "100")
        };
      }));
      setMsg("✅ Operational targets updated across active configurations.");
    } catch {
      setMsg("❌ Error parsing Targets CSV.");
    }
  };

  const finalRates = rates.length ? rates : [
    { id: 1, login: "moberete", station_id: 1, line_name: "Line 1", station_name: "1-1", rate: 94, target_rate: 100 },
    { id: 2, login: "mroblero", station_id: 2, line_name: "Line 1", station_name: "1-2", rate: 112, target_rate: 110 },
    { id: 3, login: "pblakeld", station_id: 3, line_name: "Line 2", station_name: "2-1", rate: 75, target_rate: 100 },
    { id: 4, login: "nickomil", station_id: 4, line_name: "Line 2", station_name: "2-2", rate: 84, target_rate: 90 }
  ];

  const linesList = [...new Set(finalRates.map(r => r.line_name))].sort();

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex justify-between items-center bg-white p-4 border border-gray-200 rounded-2xl shadow-3xs flex-wrap gap-4">
        <div>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono block">Throughput Metrics Console</span>
          <p className="text-xs text-gray-500 mt-0.5 font-semibold text-indigo-600">Dynamic scanner target evaluation rates per active hour.</p>
        </div>

        <button onClick={() => setShowUpload(!showUpload)} className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-3xs border-none font-mono uppercase">
          {showUpload ? "Hide CSV Uplink" : "Upload Throughput"}
        </button>
      </div>

      {msg && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-3 rounded-xl text-xs font-mono font-medium">
          {msg}
        </div>
      )}

      {showUpload && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-3xs grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-indigo-600 transition-colors cursor-pointer bg-gray-50/20">
            <input type="file" onChange={e => {
              const file = e.target.files?.[0];
              if (file) {
                const r = new FileReader();
                r.onload = ev => uploadRates(ev.target?.result as string);
                r.readAsText(file);
              }
            }} className="hidden" id="rates_file" />
            <label htmlFor="rates_file" className="cursor-pointer space-y-1 block">
              <span className="text-lg block">📋</span>
              <span className="text-xs font-bold text-gray-700 block">Performance Rates CSV</span>
              <span className="text-[10px] text-gray-400 font-mono block">Formats: Login, Rate, Station</span>
            </label>
          </div>

          <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-indigo-600 transition-colors cursor-pointer bg-gray-50/20">
            <input type="file" onChange={e => {
              const file = e.target.files?.[0];
              if (file) {
                const r = new FileReader();
                r.onload = ev => uploadTargets(ev.target?.result as string);
                r.readAsText(file);
              }
            }} className="hidden" id="targets_file" />
            <label htmlFor="targets_file" className="cursor-pointer space-y-1 block">
              <span className="text-lg block">🎯</span>
              <span className="text-xs font-bold text-gray-700 block">Targets / Thresholds CSV</span>
              <span className="text-[10px] text-gray-400 font-mono block">Formats: Station, TargetRate</span>
            </label>
          </div>
        </div>
      )}

      {linesList.map(lineName => {
        const lineRates = finalRates.filter(r => r.line_name === lineName);
        return (
          <div key={lineName} className="space-y-3">
            <h4 className="text-sm font-extrabold text-gray-900 tracking-tight">{lineName} Rates Summary</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {lineRates.map((r, i) => {
                const pct = Math.min(150, Math.round((r.rate / r.target_rate) * 100)) || 100;
                const isUnder = pct < 90;
                
                return (
                  <div key={i} className={`bg-white border rounded-2xl p-4.5 shadow-3xs flex flex-col justify-between space-y-3 ${
                    isUnder ? 'border-red-200 bg-red-50/10' : 'border-gray-200'
                  }`}>
                    <div>
                      <div className="font-bold text-gray-900 text-xs">@{r.login}</div>
                      <div className="font-mono text-[10px] text-gray-400 mt-0.5">Station {r.station_name}</div>
                    </div>

                    <div>
                      <div className="flex justify-between items-end">
                        <span className={`text-lg font-extrabold ${isUnder ? "text-red-650" : "text-emerald-700"}`}>
                          {r.rate} <span className="text-xs font-normal text-gray-400">/hr</span>
                        </span>
                        <span className={`text-[10px] font-mono font-bold ${isUnder ? "text-red-700" : "text-emerald-800"}`}>
                          {pct}% output
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden mt-2">
                        <div className={`h-full rounded-full ${isUnder ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
