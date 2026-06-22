import React, { useState } from "react";
import { Associate } from "../types";

interface PermissionsProps {
  dept: string;
  mockAssocs: Associate[];
  floorPaths: any[];
  refreshAssociates?: () => void;
}

export function Permissions({ dept, mockAssocs, floorPaths, refreshAssociates }: PermissionsProps) {
  const [view, setView] = useState("byAssoc");
  const [search, setSearch] = useState("");
  const [, fu] = useState(0);

  // Editing Permissions Modal States
  const [editingAssoc, setEditingAssoc] = useState<Associate | null>(null);
  const [editedPerms, setEditedPerms] = useState<Record<number, number>>({});
  const [isSaving, setIsSaving] = useState(false);

  const deptAssocs = mockAssocs.filter(a => a.operation_mode === dept || a.operation_mode === "BOTH");
  const displayAssocs = deptAssocs.filter(a => {
    const s = search.toLowerCase();
    return !search || a.name.toLowerCase().includes(s) || a.login.toLowerCase().includes(s) || a.badge.includes(search);
  });

  // Structural matrix calculations
  const matrix: Record<string, any> = {};
  const allPathsList = floorPaths.filter(p => p.department === dept);

  React.useEffect(() => {
    if (editingAssoc) {
      const initial: Record<number, number> = {};
      allPathsList.forEach(path => {
        const p = (editingAssoc.permissions || []).find((x: any) => x.path_name === path.name);
        initial[path.id] = p ? p.lc_level : -1;
      });
      setEditedPerms(initial);
    } else {
      setEditedPerms({});
    }
  }, [editingAssoc]);

  const handlePermChange = (pathId: number, level: number) => {
    setEditedPerms(prev => ({ ...prev, [pathId]: level }));
  };

  const savePermissions = async () => {
    if (!editingAssoc) return;
    setIsSaving(true);
    
    try {
      for (const path of allPathsList) {
        const initialPerm = (editingAssoc.permissions || []).find((p: any) => p.path_name === path.name);
        const initialLevel = initialPerm ? initialPerm.lc_level : -1;
        const newLevel = editedPerms[path.id] !== undefined ? editedPerms[path.id] : initialLevel;
        
        if (newLevel !== initialLevel) {
          await fetch("/api/permissions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              badge: editingAssoc.badge,
              path_id: path.id,
              lc_level: newLevel
            })
          });
          
          if (!editingAssoc.permissions) editingAssoc.permissions = [];
          const existing = editingAssoc.permissions.find((p: any) => p.path_name === path.name);
          if (newLevel === -1) {
            editingAssoc.permissions = editingAssoc.permissions.filter((p: any) => p.path_name !== path.name);
          } else {
            if (existing) {
              existing.lc_level = newLevel;
            } else {
              editingAssoc.permissions.push({ path_name: path.name, lc_level: newLevel });
            }
          }
        }
      }
      
      if (refreshAssociates) {
        await refreshAssociates();
      }
      
      setEditingAssoc(null);
    } catch (err) {
      console.error("Error saving permissions:", err);
    } finally {
      setIsSaving(false);
    }
  };

  allPathsList.forEach(p => {
    const isPathIndirect = (p.rotation_hours !== undefined ? p.rotation_hours : 10) <= 5 || p.role_type === "INDIRECT";
    matrix[p.name] = {
      path: p.name,
      lc0: 0,
      lc1: 0,
      lc2: 0,
      lc3: 0,
      lc4: 0,
      lc5: 0,
      total: 0,
      type: isPathIndirect ? "INDIRECT" : "DIRECT"
    };
  });

  deptAssocs.forEach(a => {
    (a.permissions || []).forEach(p => {
      if (matrix[p.path_name]) {
        matrix[p.path_name][`lc${p.lc_level}`]++;
        matrix[p.path_name].total++;
      }
    });
  });

  const matRows = Object.values(matrix).sort((a: any, b: any) => b.total - a.total);

  const LC_BG = (l: number) => {
    if (l >= 4) return "bg-emerald-50 text-emerald-700 border-emerald-100";
    if (l >= 3) return "bg-amber-50 text-amber-700 border-amber-100";
    if (l >= 1) return "bg-red-50 text-red-700 border-red-100";
    return "bg-gray-100 text-gray-500 border-gray-200 shadow-3xs";
  };

  const LC_LABEL = (l: number) => ["No Level L0", "Beginner", "Learning", "Developing", "Proficient", "Expert"][l] || "No Level L0";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 border border-gray-200 rounded-2xl shadow-3xs flex-wrap gap-4">
        <div>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono block">Learning Curve Console</span>
          <p className="text-xs text-gray-500 mt-0.5 font-semibold text-indigo-600">Audit current personnel certifications & LC curves.</p>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200 overflow-hidden">
          {[
            { v: "byAssoc", l: "By Associate" },
            { v: "matrix", l: "Matrix Overview" }
          ].map(h => (
            <button 
              key={h.v} 
              onClick={() => setView(h.v)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 border-none cursor-pointer ${
                view === h.v 
                  ? "bg-emerald-600 text-white shadow-xs" 
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {h.l}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <input 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          placeholder="Search associates profile to view qualifications..." 
          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all shadow-3xs placeholder:text-gray-400"
        />
      </div>

      {view === "matrix" ? (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-3xs">
          <div className="grid grid-cols-8 gap-2 px-6 py-4 bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono border-b border-gray-200">
            <div className="col-span-2">Path Designation</div>
            <div className="text-center">Type</div>
            <div className="text-center">L1</div>
            <div className="text-center">L2</div>
            <div className="text-center font-bold text-amber-600">L3</div>
            <div className="text-center font-bold text-emerald-600">L4</div>
            <div className="text-center font-bold text-emerald-800">L5</div>
          </div>

          <div className="divide-y divide-gray-100">
            {matRows.map((row: any) => (
              <div key={row.path} className="grid grid-cols-8 gap-2 px-6 py-4 items-center">
                <div className="col-span-2 text-xs font-bold text-gray-900">{row.path}</div>
                <div className="text-center">
                  <span className={`text-[8px] font-mono font-bold border px-2 py-0.5 rounded-full ${row.type === "INDIRECT" ? "bg-purple-50 text-purple-700 border-purple-100" : "bg-emerald-50 text-emerald-700 border-emerald-105"}`}>
                    {row.type}
                  </span>
                </div>
                {[1, 2, 3, 4, 5].map((l: number) => (
                  <div key={l} className="text-center text-xs font-mono">
                    {row[`lc${l}`] > 0 ? (
                      <span className="font-bold text-gray-900">{row[`lc${l}`]}</span>
                    ) : (
                      <span className="text-gray-300 font-light">–</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayAssocs.map(a => (
            <div key={a.badge} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-3xs flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center font-bold text-emerald-700 text-sm font-sans uppercase">
                    {a.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 leading-tight">{a.name}</h4>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">@{a.login} · Badge {a.badge}</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingAssoc(a)}
                  className="px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 text-emerald-600 rounded-lg text-[10px] font-bold font-mono border border-gray-200 uppercase tracking-wider cursor-pointer transition-colors"
                >
                  ✏️ Edit
                </button>
              </div>

              {/* Skills list */}
              <div className="flex flex-wrap gap-2.5">
                {(a.permissions || []).length === 0 ? (
                  <span className="text-[10px] text-gray-400 font-mono italic">No current certifications</span>
                ) : (
                  (a.permissions || []).map(p => (
                    <span key={p.path_name} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-mono font-bold border ${LC_BG(p.lc_level)}`}>
                      <span>{p.path_name}</span>
                      <span className="opacity-50">·</span>
                      <span>L{p.lc_level} ({LC_LABEL(p.lc_level)})</span>
                    </span>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editing Modal Overlay */}
      {editingAssoc && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs z-[1000] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-gray-200 max-w-[480px] w-full p-6 shadow-sm max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 mb-4 shrink-0">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest font-mono">Edit Certifications</h3>
                <p className="text-[10px] text-gray-400 mt-1">{editingAssoc.name} (@{editingAssoc.login})</p>
              </div>
              <button onClick={() => setEditingAssoc(null)} className="text-gray-400 hover:text-gray-600 text-xl font-light">×</button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1.5 py-1.5">
              {allPathsList.map(path => {
                const currentPerm = (editingAssoc.permissions || []).find((p: any) => p.path_name === path.name);
                const currentLevel = currentPerm ? currentPerm.lc_level : -1;
                const isPathIndirect = (path.rotation_hours !== undefined ? path.rotation_hours : 10) <= 5 || path.role_type === "INDIRECT";
                
                return (
                  <div key={path.id} className="flex justify-between items-center bg-[#FAFBFD]/40 p-3 rounded-xl border border-gray-100">
                    <div className="flex-1 min-w-0 pr-3">
                      <span className="text-xs font-bold text-gray-900 block truncate">{path.name}</span>
                      <span className={`text-[8px] font-mono font-bold uppercase inline-block border px-1.5 py-0.5 rounded-full mt-1 ${isPathIndirect ? "bg-purple-50 text-purple-700 border-purple-100" : "bg-emerald-50 text-emerald-700 border-emerald-105"}`}>
                        {isPathIndirect ? "INDIRECT" : "DIRECT"}
                      </span>
                    </div>
                    
                    <select
                      value={editedPerms[path.id] !== undefined ? editedPerms[path.id] : currentLevel}
                      onChange={e => handlePermChange(path.id, parseInt(e.target.value))}
                      className="bg-white border border-gray-200 rounded-lg text-xs font-semibold p-2 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/10"
                    >
                      <option value="-1">None / Remove</option>
                      <option value="0">L0 - No Level L0</option>
                      <option value="1">L1 - Beginner</option>
                      <option value="2">L2 - Learning</option>
                      <option value="3">L3 - Developing</option>
                      <option value="4">L4 - Proficient</option>
                      <option value="5">L5 - Expert</option>
                    </select>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 pt-4 border-t border-gray-100 mt-4 shrink-0">
              <button
                onClick={savePermissions}
                disabled={isSaving}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold cursor-pointer text-center"
              >
                {isSaving ? "Saving..." : "Save changes"}
              </button>
              <button
                onClick={() => setEditingAssoc(null)}
                className="px-5 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
