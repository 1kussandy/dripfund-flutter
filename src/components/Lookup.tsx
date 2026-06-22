import React, { useState } from "react";
import { Associate } from "../types";

interface LookupProps {
  mockAssocs: Associate[];
}

export function SearchLookup({ mockAssocs }: LookupProps) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<any | null>(null);
  const [searched, setSearched] = useState(false);

  const doSearch = () => {
    if (!query.trim()) {
      setResult(null);
      setSearched(false);
      return;
    }
    const q = query.trim().toLowerCase();
    const assoc = mockAssocs.find(a => a.badge === query.trim() || a.login === q || a.name.toLowerCase().includes(q));
    setSearched(true);
    
    if (!assoc) {
      setResult(null);
      return;
    }

    // Populate mock log entries
    const logs = [
      { id: 1, path: "IB Unloader", roleType: "INDIRECT", date: "2026-06-12", dept: "INBOUND", method: "SCAN" },
      { id: 2, path: "CRETS Processing Low Side", roleType: "DIRECT", date: "2026-06-11", dept: "INBOUND", method: "SCAN" },
      { id: 3, path: "IB Waterspider", roleType: "INDIRECT", date: "2026-06-10", dept: "INBOUND", method: "MANUAL" }
    ];
    setResult({ assoc, logs });
  };

  const clearSearch = () => {
    setQuery("");
    setResult(null);
    setSearched(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 border border-gray-200 rounded-2xl shadow-3xs">
        <div>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono block">Employee Deep-Search Tool</span>
          <p className="text-xs text-gray-500 mt-0.5 font-semibold text-indigo-600">Look up any associate using name, login credentials, or numeric barcode ID.</p>
        </div>
      </div>

      <div className="flex gap-3 relative">
        <input 
          value={query} 
          onChange={e => setQuery(e.target.value)} 
          placeholder="Enter badge ID (e.g. 101181) or supervisor name..." 
          onKeyDown={e => e.key === "Enter" && doSearch()}
          className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:border-indigo-600 shadow-3xs"
        />
        <button onClick={doSearch} className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-3xs border-none uppercase font-mono">
          Search
        </button>
        {query && (
          <button onClick={clearSearch} className="px-3.5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold cursor-pointer border-none font-mono">
            Clear
          </button>
        )}
      </div>

      {searched && !result && (
        <div className="bg-white border border-red-200 rounded-2xl p-8 text-center max-w-[400px] mx-auto animate-shake shadow-3xs">
          <div className="text-3xl mb-2">⚠️</div>
          <h4 className="text-xs font-bold text-red-700 font-sans uppercase">No Associate Matches</h4>
          <p className="text-[10px] text-gray-400 font-mono mt-1">"{query}" does not match active records.</p>
        </div>
      )}

      {result && (
        <div className="space-y-6 animate-fadeIn">
          {/* Profile Card */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-3xs flex flex-wrap items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-indigo-50 border border-indigo-100/50 flex items-center justify-center font-extrabold text-indigo-700 text-base font-sans">
              {result.assoc.name.charAt(0)}
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-gray-900 leading-tight">{result.assoc.name}</h3>
              <p className="text-[10px] text-gray-400 font-mono mt-0.5">@{result.assoc.login} · Badge ID: {result.assoc.badge}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-[9px] font-mono font-bold uppercase">
              <span className="bg-gray-50 border border-gray-150 px-2 py-0.5 rounded text-gray-500">
                Shift: {result.assoc.shift_code}
              </span>
              <span className="bg-emerald-50 border border-emerald-150 px-2 py-0.5 rounded text-emerald-800">
                OpMode: {result.assoc.operation_mode}
              </span>
            </div>
          </div>

          {/* Placed logs */}
          <div className="space-y-3">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest font-mono block">Placement Logs</span>
            <div className="space-y-2">
              {result.logs.map((log: any) => (
                <div key={log.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-3xs flex justify-between items-center text-xs">
                  <div>
                    <div className="font-bold text-gray-800">{log.path}</div>
                    <div className="text-[9px] text-gray-400 font-mono mt-0.5">Dept: {log.dept}</div>
                  </div>
                  <div className="flex gap-2.5 items-center font-mono text-[9px]">
                    <span className="bg-indigo-50 text-indigo-700 font-bold border border-indigo-100 rounded px-1.5 py-0.5">{log.roleType}</span>
                    <span className="text-gray-400 font-medium">{log.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
