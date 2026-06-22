import React, { useState } from "react";
import { Associate } from "../types";

interface AssociatesProps {
  dept: string;
  mockAssocs: Associate[];
  refreshAssociates: () => void;
}

export function Associates({ dept, mockAssocs, refreshAssociates }: AssociatesProps) {
  const [search, setSearch] = useState("");
  const [opF, setOpF] = useState("ALL");
  const [shF, setShF] = useState("ALL");
  const [addModal, setAddModal] = useState(false);
  const [newAssoc, setNewAssoc] = useState({
    badge: "", login: "", name: "", shift_code: "FHD", operation_mode: dept, default_dept: dept, manager: ""
  });
  const [addErr, setAddErr] = useState("");

  const filtered = mockAssocs.filter(a => {
    const s = search.toLowerCase();
    return (!search || a.name.toLowerCase().includes(s) || a.login.toLowerCase().includes(s) || a.badge.includes(search)) &&
      (opF === "ALL" || a.operation_mode === opF) &&
      (shF === "ALL" || a.shift_code === shF);
  });

  const handleAdd = async () => {
    setAddErr("");
    if (!newAssoc.badge.trim()) { setAddErr("Badge ID is required"); return; }
    if (!newAssoc.login.trim()) { setAddErr("Login identifier is required"); return; }
    if (!newAssoc.name.trim()) { setAddErr("Full associate name is required"); return; }

    const res = await fetch("/api/associates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        badge: newAssoc.badge.trim(),
        login: newAssoc.login.trim(),
        name: newAssoc.name.trim(),
        shift_code: newAssoc.shift_code,
        operation_mode: newAssoc.operation_mode,
        default_dept: newAssoc.default_dept,
        manager: newAssoc.manager.trim(),
        home_dept: "CRETS Processing Low Side"
      })
    }).then(r => r.ok ? r.json() : null).catch(() => null);

    if (res && !res.error) {
      setAddModal(false);
      setNewAssoc({ badge: "", login: "", name: "", shift_code: "FHD", operation_mode: dept, default_dept: dept, manager: "" });
      refreshAssociates();
    } else {
      setAddErr(res?.error || "Error adding associate (ID or login might exist).");
    }
  };

  const handleDelete = async (badge: string) => {
    if (!window.confirm("Are you sure you want to remove this employee from registration?")) return;
    await fetch(`/api/associates/${badge}`, { method: "DELETE" });
    refreshAssociates();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 border border-gray-200 rounded-2xl shadow-3xs flex-wrap gap-4">
        <div>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono block">Employee Registry</span>
          <p className="text-xs text-gray-500 mt-0.5 font-semibold text-indigo-600">{mockAssocs.length} registered personnel inside Optimus Staffing Hub databases.</p>
        </div>

        <button onClick={() => setAddModal(true)} className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-3xs border-none">
          + Add Associate
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <input 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          placeholder="Filter associates by names/badges..." 
          className="flex-1 min-w-[200px] px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/10 shadow-3xs"
        />
        <select value={opF} onChange={e => setOpF(e.target.value)} className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-700 font-medium">
          <option value="ALL">All Modes</option>
          <option value="INBOUND">Inbound Only</option>
          <option value="OUTBOUND">Outbound Only</option>
          <option value="BOTH">Both / Flex</option>
        </select>
        <select value={shF} onChange={e => setShF(e.target.value)} className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-700 font-medium">
          <option value="ALL">All Shifts</option>
          {["FHD", "BHD", "FHN", "BHN"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* High-density, professional registry table list */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-3xs animate-fadeIn">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/75 border-b border-gray-200 text-[9px] font-bold text-gray-400 uppercase tracking-widest font-mono">
                <th className="py-3 px-4 w-12">Init</th>
                <th className="py-3 px-4">Full Name</th>
                <th className="py-3 px-4">Login @</th>
                <th className="py-3 px-4">Badge ID</th>
                <th className="py-3 px-4">Shift Code</th>
                <th className="py-3 px-4">Operations Mode</th>
                <th className="py-3 px-4">Supervisor / Manager</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {filtered.map(a => (
                <tr key={a.badge} className="hover:bg-gray-50/50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="w-7 h-7 rounded-full bg-indigo-50 flex items-center justify-center font-bold text-indigo-700 text-xs">
                      {a.name.charAt(0)}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-900 font-bold font-sans">
                    {a.name}
                  </td>
                  <td className="py-3 px-4 font-mono text-gray-500 font-medium font-mono text-[11px]">
                    @{a.login}
                  </td>
                  <td className="py-3 px-4 font-mono text-gray-600 font-bold text-[11px]">
                    {a.badge}
                  </td>
                  <td className="py-3 px-4">
                    <span className="bg-gray-100 border border-gray-200/60 px-2 py-0.5 rounded text-[10px] font-bold font-mono text-gray-600 uppercase tracking-wide">
                      {a.shift_code}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="bg-indigo-50 text-indigo-700 border border-indigo-150 px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase tracking-wide">
                      {a.operation_mode}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-500 font-medium">
                    {a.manager || <span className="text-gray-300 font-light italic">—</span>}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button 
                      onClick={() => handleDelete(a.badge)} 
                      className="text-[10px] font-bold text-red-500 hover:text-red-700 bg-red-50/50 hover:bg-red-50 border border-red-100 rounded-md py-1 px-2 cursor-pointer transition-all"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-xs text-gray-400 font-medium">
                    No active registrations match criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal Props details */}
      {addModal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs z-[1000] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 max-w-[420px] w-full p-6 shadow-sm">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 mb-4">
              <h3 className="text-xs font-bold uppercase tracking-widest font-mono">Create Employee Registration</h3>
              <button onClick={() => setAddModal(false)} className="text-gray-400 hover:text-gray-600 text-xl font-light">×</button>
            </div>

            {addErr && (
              <div className="bg-red-50 border border-red-100 text-red-700 rounded-lg p-3 text-xs mb-4">
                {addErr}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-1">Badge ID</label>
                <input type="text" value={newAssoc.badge} onChange={e => setNewAssoc({ ...newAssoc, badge: e.target.value })} placeholder="e.g. 500302" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-1">Login username</label>
                <input type="text" value={newAssoc.login} onChange={e => setNewAssoc({ ...newAssoc, login: e.target.value })} placeholder="e.g. jsmith" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-1">Full Name</label>
                <input type="text" value={newAssoc.name} onChange={e => setNewAssoc({ ...newAssoc, name: e.target.value })} placeholder="John Smith" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-1 font-mono">Shift Pattern</label>
                <select value={newAssoc.shift_code} onChange={e => setNewAssoc({ ...newAssoc, shift_code: e.target.value })} className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs cursor-pointer">
                  <option value="FHD">FHD (Front Half Day)</option>
                  <option value="BHD">BHD (Back Half Day)</option>
                  <option value="FHN">FHN (Front Half Night)</option>
                  <option value="BHN">BHN (Back Half Night)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-1 font-mono">Operations Mode</label>
                <select value={newAssoc.operation_mode} onChange={e => setNewAssoc({ ...newAssoc, operation_mode: e.target.value as any, default_dept: e.target.value === "BOTH" ? newAssoc.default_dept : e.target.value })} className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs cursor-pointer">
                  <option value="INBOUND">Inbound Only</option>
                  <option value="OUTBOUND">Outbound Only</option>
                  <option value="BOTH">Both / Flex Shift</option>
                </select>
              </div>
              {newAssoc.operation_mode === "BOTH" && (
                <div>
                  <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-1 font-mono">Default Half Shift Allocation</label>
                  <select value={newAssoc.default_dept} onChange={e => setNewAssoc({ ...newAssoc, default_dept: e.target.value })} className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs cursor-pointer">
                    <option value="INBOUND">INBOUND</option>
                    <option value="OUTBOUND">OUTBOUND</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-1">Supervisor Manager</label>
                <input type="text" value={newAssoc.manager} onChange={e => setNewAssoc({ ...newAssoc, manager: e.target.value })} placeholder="Lastname, Firstname" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs" />
              </div>
              
              <div className="flex gap-2 pt-2">
                <button onClick={handleAdd} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold cursor-pointer">Create Account</button>
                <button onClick={() => setAddModal(false)} className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-semibold cursor-pointer">Discard</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
