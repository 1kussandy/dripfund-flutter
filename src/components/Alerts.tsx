import React, { useState } from "react";
import { SystemAlert } from "../types";

export function Alerts() {
  const [alerts, setAlerts] = useState<SystemAlert[]>([
    { id: 1, category: "Small", station_name: "1-3", line_name: "Line 1", plan_rate: 100, actual_rate: 76, deviation: 24, acknowledged: false, resolved: false },
    { id: 2, category: "C-Returns", station_name: "2-4", line_name: "Line 2", plan_rate: 110, actual_rate: 82, deviation: 25.4, acknowledged: true, resolved: false },
    { id: 3, category: "Large", station_name: "4-1", line_name: "Line 4", plan_rate: 90, actual_rate: 61, deviation: 32.2, acknowledged: false, resolved: false }
  ]);
  const [filter, setFilter] = useState("ALL");
  const [showConfig, setShowConfig] = useState(false);
  const [thresholds, setThresholds] = useState([
    { category: "Small", limit: 10 },
    { category: "Medium", limit: 15 },
    { category: "Large", limit: 20 },
    { category: "C-Returns", limit: 15 }
  ]);
  const [newLimit, setNewLimit] = useState("");
  const [editCategory, setEditCategory] = useState("Small");

  const acknowledge = (id: number) => {
    setAlerts(curr => curr.map(a => a.id === id ? { ...a, acknowledged: true } : a));
  };

  const resolve = (id: number) => {
    setAlerts(curr => curr.map(a => a.id === id ? { ...a, resolved: true } : a));
  };

  const saveThreshold = () => {
    const val = parseFloat(newLimit);
    if (isNaN(val) || val <= 0) return;
    setThresholds(curr => curr.map(t => t.category === editCategory ? { ...t, limit: val } : t));
    setNewLimit("");
  };

  const displayedAlerts = alerts.filter(a => filter === "ALL" || a.category === filter);

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex justify-between items-center bg-white p-4 border border-gray-200 rounded-2xl shadow-3xs flex-wrap gap-4">
        <div>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono block">Andon & Deficit Log</span>
          <p className="text-xs text-gray-500 mt-0.5 font-semibold text-indigo-600">Active line throughput drop notifications.</p>
        </div>

        <button onClick={() => setShowConfig(!showConfig)} className="px-3.5 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer border-none shadow-3xs uppercase font-mono">
          ⚙ Configure Thresholds
        </button>
      </div>

      {showConfig && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-3xs space-y-4">
          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-widest font-mono">Deviation Alarm Limits</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {thresholds.map(t => (
              <div key={t.category} className="bg-gray-50 border border-gray-150 p-4 rounded-xl">
                <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider block">{t.category} Alarm</span>
                <span className="text-lg font-extrabold text-gray-900 mt-1 block">&gt; {t.limit}% deficit</span>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-gray-100 flex gap-3 flex-wrap items-end">
            <div>
              <label className="block text-[9px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-1.5">Stream Category</label>
              <select value={editCategory} onChange={e => setEditCategory(e.target.value)} className="p-2 border border-gray-250 rounded-lg text-xs bg-white text-gray-700 font-medium">
                {thresholds.map(t => <option key={t.category} value={t.category}>{t.category}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-1.5">Alarm threshold limit %</label>
              <input type="number" value={newLimit} onChange={e => setNewLimit(e.target.value)} placeholder="e.g. 15" className="p-2 border border-gray-200 rounded-lg text-xs w-28 outline-none focus:border-indigo-600" />
            </div>
            <button onClick={saveThreshold} className="py-2.5 px-4 bg-indigo-600 text-white rounded-lg text-xs font-semibold cursor-pointer border-none shadow-3xs">
              Confirm Limits
            </button>
          </div>
        </div>
      )}

      {/* Category filter pills */}
      <div className="flex gap-2 flex-wrap font-mono text-[10px] uppercase font-bold">
        {["ALL", "Small", "Medium", "Large", "C-Returns"].map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
              filter === cat ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white hover:bg-gray-50 text-gray-500 border-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Alerts list */}
      <div className="space-y-3.5">
        {displayedAlerts.map(alert => {
          const isCrit = alert.deviation >= 30;
          return (
            <div key={alert.id} className={`bg-white border rounded-2xl p-5 shadow-3xs flex justify-between items-center transition-all ${
              alert.resolved ? 'opacity-55 border-gray-150 bg-[#FAFBFD]/30' : isCrit ? 'border-red-200 bg-red-50/10' : 'border-amber-200 bg-amber-50/10'
            }`}>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded ${
                    isCrit ? "bg-red-500 text-white" : "bg-amber-500 text-white"
                  }`}>{alert.category} Alarm</span>
                  <span className="text-xs font-mono font-bold text-gray-800">Station {alert.station_name}</span>
                </div>
                <div className="text-[11px] text-gray-500 font-sans">
                  Active rate of <span className="font-bold text-gray-900">{alert.actual_rate}/hr</span> falls <span className="font-bold text-red-650">{alert.deviation}%</span> behind targeted pace of <span className="font-bold text-gray-700">{alert.plan_rate}/hr</span>.
                </div>
              </div>

              <div className="flex gap-2.5">
                {!alert.acknowledged && !alert.resolved && (
                  <button onClick={() => acknowledge(alert.id)} className="px-3 py-1.5 bg-white border border-gray-250 text-gray-700 hover:bg-gray-50 rounded-lg text-[10px] font-bold tracking-wider uppercase font-mono transition-colors shadow-3xs cursor-pointer">
                    Acknowledge
                  </button>
                )}
                {!alert.resolved ? (
                  <button onClick={() => resolve(alert.id)} className="px-3 py-1.5 bg-red-650 hover:bg-red-700 text-white border border-red-650 rounded-lg text-[10px] font-bold tracking-wider uppercase font-mono transition-colors shadow-3xs cursor-pointer">
                    Resolve Alarm
                  </button>
                ) : (
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                    RESOLVED
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {displayedAlerts.length === 0 && (
          <div className="text-center py-10 bg-white border border-gray-200 rounded-2xl text-xs text-gray-400 font-mono italic">
            No system alarms registered in this category.
          </div>
        )}
      </div>
    </div>
  );
}
