import React, { useState, useEffect, useRef } from "react";
import { Path, Line, Station, Associate, formatLocalDate } from "../types";

interface FloorMapProps {
  dept: string;
  staffDate: Date | string;
  shiftType: string;
  mockAssocs: Associate[];
  floorPaths: Path[];
  floorLines: Line[];
  floorStations: Station[];
  setFloorLines: React.Dispatch<React.SetStateAction<Line[]>>;
  setFloorStations: React.Dispatch<React.SetStateAction<Station[]>>;
  setFloorPaths: React.Dispatch<React.SetStateAction<Path[]>>;
  refreshAssociates: () => void;
  getStationAssignment: (ctx: string, sid: number, half: string) => any;
  setStationAssignment: (ctx: string, sid: number, half: string, assignment: any) => void;
  setBadgeAssignment: (ctx: string, badge: string, half: string, sid: number) => void;
  getBadgeAssignment: (ctx: string, badge: string, half: string) => any;
  clearStationAssignment: (ctx: string, sid: number, half: string) => void;
  SA: (sid: number, half: string) => boolean;
  LA: (lid: number, half: string) => boolean;
  onPlaceAudit: (action: string, badge: string, name: string, station: string, path: string, dept: string, shift: string, date: string) => void;
  laborShareEnabled: boolean;
  laborShareCount: number;
  getCrossDeptUsed: (key: string) => number;
  incrementCrossDept: (key: string) => void;
  preStaffMode?: boolean;
  onUpdateLineOverride?: (lid: number, half: "half1" | "half2", newValue: boolean) => void;
  onUpdateStationOverride?: (sid: number, newValue: boolean) => void;
  dateLineOverrides?: any;
  dateStationOverrides?: any;
  isSystemAdmin?: boolean;
}

export function FloorMap({
  dept,
  staffDate,
  shiftType,
  mockAssocs,
  floorPaths,
  floorLines,
  floorStations,
  setFloorLines,
  setFloorStations,
  setFloorPaths,
  refreshAssociates,
  getStationAssignment,
  setStationAssignment,
  setBadgeAssignment,
  getBadgeAssignment,
  clearStationAssignment,
  SA,
  LA,
  onPlaceAudit,
  laborShareEnabled,
  laborShareCount,
  getCrossDeptUsed,
  incrementCrossDept,
  preStaffMode = false,
  onUpdateLineOverride,
  onUpdateStationOverride,
  dateLineOverrides = {},
  dateStationOverrides = {},
  isSystemAdmin = false
}: FloorMapProps) {
  const [, fu] = useState(0);
  const tick = () => fu(n => n + 1);

  const [selectedHalf, setSelectedHalf] = useState<"half1" | "half2">("half1");

  const [expPaths, setExpPaths] = useState<Set<number>>(new Set());
  const [expLines, setExpLines] = useState<Set<number>>(new Set());

  // Auto-expand all paths and lines of the selected department on load
  const prevDeptRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevDeptRef.current === dept) {
      return;
    }
    prevDeptRef.current = dept;

    const deptPaths = floorPaths.filter(p => p.department === dept);
    const pathIds = deptPaths.map(p => p.id);
    const deptLines = floorLines.filter(l => pathIds.includes(l.path_id));
    
    setExpPaths(new Set());
    setExpLines(new Set());
  }, [floorPaths, floorLines, dept]);

  // Add items modal states
  const [addPathM, setAddPathM] = useState(false);
  const [addLineM, setAddLineM] = useState(false);
  const [addStM, setAddStM] = useState(false);

  // Manual assign states
  const [manModal, setManModal] = useState<any>(null); // { sid, stName, pathName, half }
  const [manBadge, setManBadge] = useState("");
  const [manMsg, setManMsg] = useState("");

  const [nPath, setNPath] = useState({ name: "", role_type: "DIRECT" as "DIRECT" | "INDIRECT" });
  const [nLine, setNLine] = useState({ name: "", path_id: "" });
  const [nSt, setNSt] = useState({ name: "", side: "ODD" as "ODD" | "EVEN", line_id: "" });

  const dateStr = formatLocalDate(staffDate);
  const ctx = `${dateStr}|${shiftType}|${dept}`;

  const GA = (sid: number, half: string) => {
    return getStationAssignment(ctx, sid, half) || null;
  };

  const [mapSearchInputValue, setMapSearchInputValue] = useState("");
  const [mapSearchTerm, setMapSearchTerm] = useState("");
  const [highlightedStationId, setHighlightedStationId] = useState<number | null>(null);

  const triggerMapSearch = (termToSearch: string) => {
    const term = termToSearch.trim();
    setMapSearchTerm(term);
    executeSearchHighlight(term);
  };

  const executeSearchHighlight = (term: string) => {
    if (!term) {
      setHighlightedStationId(null);
      return;
    }
    
    let foundStId: number | null = null;
    let foundPathId: number | null = null;
    let foundLineId: number | null = null;

    for (const st of floorStations) {
      const activeAsn = GA(st.id, selectedHalf);
      if (activeAsn) {
        const matches = 
          activeAsn.login.toLowerCase().includes(term.toLowerCase()) || 
          activeAsn.badge.includes(term) ||
          activeAsn.name.toLowerCase().includes(term.toLowerCase());
        
        if (matches) {
          foundStId = st.id;
          foundLineId = st.line_id;
          foundPathId = st.path_id;
          break;
        }
      }
    }

    if (foundStId !== null && foundLineId !== null && foundPathId !== null) {
      setHighlightedStationId(foundStId);
      
      setExpPaths(prev => {
        const n = new Set(prev);
        n.add(foundPathId!);
        return n;
      });

      setExpLines(prev => {
        const n = new Set(prev);
        n.add(foundLineId!);
        return n;
      });

      setTimeout(() => {
        const el = document.getElementById(`station-card-${foundStId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
    } else {
      setHighlightedStationId(null);
    }
  };

  const clearMapSearch = () => {
    setMapSearchInputValue("");
    setMapSearchTerm("");
    setHighlightedStationId(null);
  };

  useEffect(() => {
    executeSearchHighlight(mapSearchTerm);
  }, [selectedHalf, mockAssocs, mapSearchTerm]);

  const isStationServiceActive = (sid: number) => {
    const s = floorStations.find(x => x.id === sid);
    if (!s) return false;
    let h1 = s.active_half1;
    let h2 = s.active_half2;
    if (preStaffMode && dateStationOverrides?.[dateStr]?.[sid] !== undefined) {
      const ov = dateStationOverrides[dateStr][sid];
      if (ov.active_half1 !== undefined) h1 = ov.active_half1;
      if (ov.active_half2 !== undefined) h2 = ov.active_half2;
    }
    return h1 !== false || h2 !== false;
  };

  const clrSt = (sid: number, half: string) => {
    const asn = GA(sid, half);
    if (asn) {
      onPlaceAudit("CLEAR", asn.badge, asn.name, floorStations.find(s => s.id === sid)?.name || "", asn.path, dept, shiftType, dateStr);
      clearStationAssignment(ctx, sid, half);
      
      // Remove badge reference from tracking
      const sessionFile = localStorage.getItem(`ct_badge_${ctx}`);
      if (sessionFile) {
        try {
          const parsed = JSON.parse(sessionFile);
          if (parsed[asn.badge]) delete parsed[asn.badge][half];
          localStorage.setItem(`ct_badge_${ctx}`, JSON.stringify(parsed));
        } catch {}
      }
    }
    tick();
  };

  const doAssign = () => {
    if (!manBadge.trim()) return;
    const assoc = mockAssocs.find(a => a.badge === manBadge.trim() || a.login === manBadge.trim().toLowerCase() || a.name.toLowerCase().includes(manBadge.trim().toLowerCase()));
    if (!assoc) {
      setManMsg("Associate not found in database.");
      return;
    }

    const stationObj = floorStations.find(s => s.id === manModal.sid);
    const lineObj = floorLines.find(l => l.id === stationObj?.line_id);
    const pathObj = floorPaths.find(p => p.id === lineObj?.path_id);
    
    // Cross dept checks
    const isCrossDept = pathObj?.department && assoc.operation_mode !== "BOTH" && assoc.operation_mode !== pathObj.department;
    if (isCrossDept && !laborShareEnabled) {
      setManMsg(`Labor Share disabled. Cannot assign ${assoc.name} to ${pathObj?.department} station.`);
      return;
    }

    const usageKey = `live|${dept}|${dateStr}|${shiftType}`;
    const used = getCrossDeptUsed(usageKey);
    if (isCrossDept && laborShareCount > 0 && used >= laborShareCount) {
      setManMsg(`Labor share limit reached (${used}/${laborShareCount}).`);
      return;
    }

    // Set placement inside specific half
    setStationAssignment(ctx, manModal.sid, manModal.half, {
      login: assoc.login,
      name: assoc.name,
      badge: assoc.badge,
      path: manModal.pathName,
      roleType: "MANUAL",
      assignedAt: Date.now(),
      method: "MANUAL",
      dept,
      half: manModal.half
    });
    setBadgeAssignment(ctx, assoc.badge, manModal.half, manModal.sid);

    if (isCrossDept) incrementCrossDept(usageKey);

    onPlaceAudit("ASSIGN", assoc.badge, assoc.name, manModal.stName, manModal.pathName, dept, shiftType, dateStr);
    setManMsg(`${assoc.name} successfully placed for ${manModal.half === "half1" ? "1ST" : "2ND"} half!`);
    
    tick();
    setTimeout(() => {
      setManModal(null);
      setManBadge("");
      setManMsg("");
    }, 1200);
  };

  const togPath = (pid: number) => {
    const p = floorPaths.find(x => x.id === pid);
    if (p) p.active = !p.active;
    tick();
  };

  const togLineHalf = async (lid: number, half: "half1" | "half2") => {
    const l = floorLines.find(x => x.id === lid);
    if (!l) return;

    let currentValue = half === "half1" ? l.active_half1 : l.active_half2;
    if (preStaffMode && dateLineOverrides?.[dateStr]?.[lid] !== undefined) {
      const ov = dateLineOverrides[dateStr][lid];
      if (ov[half] !== undefined) currentValue = ov[half];
    }
    const newValue = currentValue === false ? true : false;

    if (preStaffMode && onUpdateLineOverride) {
      onUpdateLineOverride(lid, half, newValue);
      if (newValue === false) {
        floorStations.forEach(st => {
          if (st.line_id === lid) {
            clearStationAssignment(ctx, st.id, half);
          }
        });
      }
      tick();
      return;
    }

    // 1. Update line and child stations in local React state
    setFloorLines(prev => prev.map(item => {
      if (item.id === lid) {
        return {
          ...item,
          [half === "half1" ? "active_half1" : "active_half2"]: newValue
        };
      }
      return item;
    }));

    setFloorStations(prev => prev.map(item => {
      if (item.line_id === lid) {
        return {
          ...item,
          [half === "half1" ? "active_half1" : "active_half2"]: newValue
        };
      }
      return item;
    }));

    // If turned off, clear all active assignments for this half on this line
    if (newValue === false) {
      floorStations.forEach(st => {
        if (st.line_id === lid) {
          clearStationAssignment(ctx, st.id, half);
        }
      });
      tick();
    }

    // 2. Persist to API
    const body: any = {};
    if (half === "half1") {
      body.active_half1 = newValue;
    } else {
      body.active_half2 = newValue;
    }

    try {
      await fetch(`/api/lines/${lid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
    } catch (err) {
      console.error("Failed to patch line:", err);
    }
  };

  const togStActive = async (sid: number) => {
    const s = floorStations.find(x => x.id === sid);
    if (!s) return;

    let currentValue_H1 = s.active_half1;
    let currentValue_H2 = s.active_half2;
    if (preStaffMode && dateStationOverrides?.[dateStr]?.[sid] !== undefined) {
      const ov = dateStationOverrides[dateStr][sid];
      if (ov.active_half1 !== undefined) currentValue_H1 = ov.active_half1;
      if (ov.active_half2 !== undefined) currentValue_H2 = ov.active_half2;
    }

    const isCurrentlyActive = currentValue_H1 !== false || currentValue_H2 !== false;
    const newValue = !isCurrentlyActive;

    if (preStaffMode && onUpdateStationOverride) {
      onUpdateStationOverride(sid, newValue);
      if (newValue === false) {
        clearStationAssignment(ctx, sid, "half1");
        clearStationAssignment(ctx, sid, "half2");
      }
      tick();
      return;
    }

    // 1. Update local React state for both halves
    setFloorStations(prev => prev.map(item => {
      if (item.id === sid) {
        return {
          ...item,
          active_half1: newValue,
          active_half2: newValue,
          status: newValue ? "OPERATIONAL" : "DISABLED"
        };
      }
      return item;
    }));

    // If station turned off, clear assignments for both halves
    if (newValue === false) {
      clearStationAssignment(ctx, sid, "half1");
      clearStationAssignment(ctx, sid, "half2");
      tick();
    }

    // 2. Persist to API
    try {
      await fetch(`/api/stations/${sid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          active_half1: newValue,
          active_half2: newValue
        })
      });
    } catch (err) {
      console.error("Failed to patch station:", err);
    }
  };

  const [editingPathId, setEditingPathId] = useState<number | null>(null);
  const [editingPathName, setEditingPathName] = useState<string>("");

  const [editingLineId, setEditingLineId] = useState<number | null>(null);
  const [editingLineName, setEditingLineName] = useState<string>("");

  const renameLine = async (lineId: number, newName: string) => {
    if (!isSystemAdmin) {
      alert("Access Denied: Only a System Admin can rename lines.");
      return;
    }
    if (!newName.trim()) return;
    setFloorLines(prev => prev.map(l => l.id === lineId ? { ...l, name: newName.trim() } : l));
    setEditingLineId(null);
    setEditingLineName("");
    try {
      await fetch(`/api/lines/${lineId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() })
      });
      tick();
    } catch (err) {
      console.error("Failed to rename line:", err);
    }
  };

  const renamePath = async (pathId: number, newName: string) => {
    if (!isSystemAdmin) {
      alert("Access Denied: Only a System Admin can rename paths.");
      return;
    }
    if (!newName.trim()) return;
    setFloorPaths(prev => prev.map(p => p.id === pathId ? { ...p, name: newName.trim() } : p));
    setEditingPathId(null);
    setEditingPathName("");
    try {
      await fetch(`/api/paths/${pathId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() })
      });
      tick();
    } catch (err) {
      console.error("Failed to rename path:", err);
    }
  };

  const deletePath = async (pathId: number) => {
    if (!isSystemAdmin) {
      alert("Access Denied: Only a System Admin can delete paths.");
      return;
    }
    if (!confirm("Are you sure you want to delete this path? All associated lines and stations will also be removed.")) return;
    setFloorPaths(prev => prev.filter(p => p.id !== pathId));
    setFloorLines(prev => prev.filter(l => l.path_id !== pathId));
    setFloorStations(prev => prev.filter(s => s.path_id !== pathId));
    try {
      await fetch(`/api/paths/${pathId}`, {
        method: "DELETE"
      });
      tick();
    } catch (err) {
      console.error("Failed to delete path:", err);
    }
  };

  const deleteLine = async (lineId: number) => {
    if (!isSystemAdmin) {
      alert("Access Denied: Only a System Admin can delete lines.");
      return;
    }
    if (!confirm("Are you sure you want to delete this line? All associated stations will also be removed.")) return;
    setFloorLines(prev => prev.filter(l => l.id !== lineId));
    setFloorStations(prev => prev.filter(s => s.line_id !== lineId));
    try {
      await fetch(`/api/lines/${lineId}`, {
        method: "DELETE"
      });
      tick();
    } catch (err) {
      console.error("Failed to delete line:", err);
    }
  };

  const deleteStation = async (sid: number) => {
    if (!isSystemAdmin) {
      alert("Access Denied: Only a System Admin can delete stations.");
      return;
    }
    if (!confirm("Are you sure you want to delete this station?")) return;
    setFloorStations(prev => prev.filter(s => s.id !== sid));
    try {
      await fetch(`/api/stations/${sid}`, {
        method: "DELETE"
      });
      tick();
    } catch (err) {
      console.error("Failed to delete station:", err);
    }
  };

  const renameStation = async (sid: number, newName: string) => {
    if (!isSystemAdmin) {
      alert("Access Denied: Only a System Admin can rename stations.");
      return;
    }
    if (!newName.trim()) return;
    setFloorStations(prev => prev.map(s => s.id === sid ? { ...s, name: newName.trim() } : s));
    try {
      await fetch(`/api/stations/${sid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() })
      });
      tick();
    } catch (err) {
      console.error("Failed to rename station:", err);
    }
  };

  const addPath = async () => {
    if (!nPath.name.trim()) return;
    const newId = Math.max(10, ...floorPaths.map(p => p.id)) + 1;
    const newPathVal: Path = {
      id: newId,
      name: nPath.name.trim(),
      role_type: nPath.role_type,
      department: dept,
      active: true
    };
    setFloorPaths(prev => [...prev, newPathVal]);
    setAddPathM(false);
    setNPath({ name: "", role_type: "DIRECT" });
    try {
      await fetch("/api/paths", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPathVal)
      });
      tick();
    } catch (err) {
      console.error("Failed to add path:", err);
    }
  };

  const addLine = async () => {
    if (!nLine.name.trim() || !nLine.path_id) return;
    const newId = Math.max(10, ...floorLines.map(l => l.id)) + 1;
    const newLineVal: Line = {
      id: newId,
      path_id: parseInt(nLine.path_id),
      name: nLine.name.trim(),
      active: true,
      active_half1: true,
      active_half2: true
    };
    setFloorLines(prev => [...prev, newLineVal]);
    setAddLineM(false);
    setNLine({ name: "", path_id: "" });
    try {
      await fetch("/api/lines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newLineVal)
      });
      tick();
    } catch (err) {
      console.error("Failed to add line:", err);
    }
  };

  const addStation = async () => {
    if (!nSt.name.trim() || !nSt.line_id) return;
    const newId = Math.max(10, ...floorStations.map(s => s.id)) + 1;
    const newStationVal: Station = {
      id: newId,
      line_id: parseInt(nSt.line_id),
      path_id: floorLines.find(l => l.id === parseInt(nSt.line_id))?.path_id || 0,
      name: nSt.name.trim(),
      side: nSt.side,
      station_number: newId,
      active: true,
      active_half1: true,
      active_half2: true,
      status: "OPERATIONAL"
    };
    setFloorStations(prev => [...prev, newStationVal]);
    setAddStM(false);
    setNSt({ name: "", side: "ODD", line_id: "" });
    try {
      await fetch("/api/stations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newStationVal)
      });
      tick();
    } catch (err) {
      console.error("Failed to add station:", err);
    }
  };

  const deptPaths = floorPaths.filter(p => p.department === dept);

  const getDisplayRoleName = (pathName: string, deptName: string) => {
    return pathName || "–";
  };

  return (
    <div className="space-y-6 bg-gray-100/40 p-6 rounded-2xl border border-gray-200">
      {/* Controls Bar */}
      <div className="flex justify-between items-center bg-white p-4 border border-gray-200 rounded-2xl shadow-3xs flex-wrap gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest font-mono block">Station Setup Panel</span>
            <p className="text-xs text-gray-500 mt-0.5 font-sans font-medium text-emerald-600">
              Showing placements and structure for the selected half shift below.
            </p>
          </div>

          {/* Half Selector Pills */}
          <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-150 font-mono text-[10px] font-bold">
            <button
              onClick={() => setSelectedHalf("half1")}
              className={`px-3 py-1.5 rounded-lg border-none cursor-pointer transition-colors uppercase tracking-wider ${
                selectedHalf === "half1" ? "bg-white text-emerald-700 shadow-3xs font-bold" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              1st Half (H1)
            </button>
            <button
              onClick={() => setSelectedHalf("half2")}
              className={`px-3 py-1.5 rounded-lg border-none cursor-pointer transition-colors uppercase tracking-wider ${
                selectedHalf === "half2" ? "bg-white text-emerald-700 shadow-3xs font-bold" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              2nd Half (H2)
            </button>
          </div>

          {/* Associate Search Input */}
          <div className="flex items-center gap-1.5">
            <div className="relative min-w-[280px]">
              <input
                type="text"
                placeholder="Search associate on map by login or badge..."
                value={mapSearchInputValue}
                onChange={e => setMapSearchInputValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    triggerMapSearch(mapSearchInputValue);
                  }
                }}
                className="px-3.5 py-1.5 pl-8 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-indigo-650 focus:ring-2 focus:ring-indigo-500/10 w-full font-medium"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">🔍</span>
              {mapSearchInputValue && (
                <button 
                  onClick={clearMapSearch} 
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 border-none bg-transparent cursor-pointer font-bold text-[10px]"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              onClick={() => triggerMapSearch(mapSearchInputValue)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-3xs"
            >
              Search
            </button>
          </div>
        </div>

        <div className="flex gap-2.5">
          <button onClick={() => setAddPathM(true)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-3xs">
            + Path
          </button>
          <button onClick={() => setAddLineM(true)} className="px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-3xs">
            + Line
          </button>
          <button onClick={() => setAddStM(true)} className="px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-3xs">
            + Station
          </button>
        </div>
      </div>

      {/* Accordion Layout */}
      <div className="space-y-4 animate-fadeIn">
        {deptPaths.map(path => {
          const pathLines = floorLines.filter(l => l.path_id === path.id);
          const isExp = expPaths.has(path.id);

          return (
            <div key={path.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-3xs">
              <div 
                className="flex flex-wrap items-center justify-between px-6 py-4 cursor-pointer hover:bg-gray-50/50 gap-4"
                onClick={() => setExpPaths(curr => { const n = new Set(curr); n.has(path.id) ? n.delete(path.id) : n.add(path.id); return n; })}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-mono font-bold flex items-center justify-center">
                    {path.id}
                  </div>
                  {editingPathId === path.id ? (
                    <input
                      type="text"
                      value={editingPathName}
                      onChange={e => setEditingPathName(e.target.value)}
                      onClick={e => e.stopPropagation()}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          e.stopPropagation();
                          renamePath(path.id, editingPathName);
                        } else if (e.key === "Escape") {
                          e.stopPropagation();
                          setEditingPathId(null);
                        }
                      }}
                      className="px-2.5 py-1 bg-white border border-emerald-500 rounded-lg text-xs font-semibold font-sans outline-none focus:ring-2 focus:ring-emerald-500/10"
                      autoFocus
                    />
                  ) : (
                    <span className="text-sm font-semibold text-gray-900">{getDisplayRoleName(path.name, dept)}</span>
                  )}
                  <span className={`text-[9px] px-2 py-0.5 rounded font-mono font-bold uppercase ${
                    ((path.rotation_hours !== undefined ? path.rotation_hours : 10) <= 5 || path.role_type === "INDIRECT")
                      ? "bg-purple-50 text-purple-700 border border-purple-100"
                      : "bg-emerald-50 text-emerald-800 border border-emerald-100"
                  }`}>
                    {((path.rotation_hours !== undefined ? path.rotation_hours : 10) <= 5 || path.role_type === "INDIRECT") ? "INDIRECT" : "DIRECT"}
                  </span>
                </div>                <div className="flex items-center gap-2.5" onClick={e => e.stopPropagation()}>
                  {isSystemAdmin && (
                    editingPathId === path.id ? (
                      <>
                        <button
                          onClick={() => renamePath(path.id, editingPathName)}
                          className="px-2.5 py-1.5 border border-emerald-200 bg-emerald-50 text-emerald-855 hover:bg-emerald-100 rounded-lg text-[10px] font-bold font-mono transition-colors uppercase cursor-pointer"
                          title="Save name"
                        >
                          ✓ Save
                        </button>
                        <button
                          onClick={() => setEditingPathId(null)}
                          className="px-2.5 py-1.5 border border-gray-200 bg-white text-gray-500 hover:bg-gray-100 rounded-lg text-[10px] font-bold font-mono transition-colors uppercase cursor-pointer"
                          title="Cancel"
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setEditingPathId(path.id);
                            setEditingPathName(path.name);
                          }}
                          className="px-2.5 py-1.5 border border-gray-150 bg-gray-50/80 text-gray-600 hover:text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50 hover:shadow-3xs rounded-lg text-[10px] font-bold font-mono transition-colors cursor-pointer"
                          title="Rename Path"
                        >
                          ✏️ Rename
                        </button>
                        <button
                          onClick={() => deletePath(path.id)}
                          className="px-2.5 py-1.5 border border-red-100 bg-red-50 text-red-505 hover:bg-red-100 hover:text-red-700 hover:shadow-3xs rounded-lg text-[10px] font-bold font-mono transition-all cursor-pointer"
                          title="Delete Path"
                        >
                          🗑️ Delete
                        </button>
                      </>
                    )
                  )}
                  {isSystemAdmin && <span className="text-gray-300">|</span>}
                  <span 
                    onClick={() => setExpPaths(curr => { const n = new Set(curr); n.has(path.id) ? n.delete(path.id) : n.add(path.id); return n; })}
                    className="text-gray-400 text-xs font-mono lowercase cursor-pointer hover:text-gray-600 select-none px-1"
                  >
                    {isExp ? "Collapse" : "Expand"}
                  </span>
                </div>
              </div>

              {isExp && (
                <div className="px-6 pb-6 border-t border-gray-100 bg-[#FAFBFD]/30 space-y-4 pt-4">
                  {pathLines.map(line => {
                    const lineStations = floorStations.filter(s => s.line_id === line.id);
                    const isLineExp = expLines.has(line.id);

                    return (
                      <div key={line.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-3xs">
                        {/* Line Trigger sub-row */}
                        <div 
                          className="flex items-center justify-between px-4 py-3 bg-[#FAFBFD]/50 hover:bg-[#FAFBFD]/80 border-b border-gray-100 cursor-pointer"
                          onClick={() => setExpLines(curr => { const n = new Set(curr); n.has(line.id) ? n.delete(line.id) : n.add(line.id); return n; })}
                        >
                          {(() => {
                            const totalSt = lineStations.length;
                            const filledSt = lineStations.filter(st => {
                              const activeAsn = GA(st.id, selectedHalf);
                              return !!activeAsn;
                            }).length;
                            return (
                              <span className="text-xs font-bold text-gray-800 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                {editingLineId === line.id ? (
                                  <input
                                    type="text"
                                    value={editingLineName}
                                    onChange={e => setEditingLineName(e.target.value)}
                                    onClick={e => e.stopPropagation()}
                                    onKeyDown={e => {
                                      if (e.key === "Enter") {
                                        e.stopPropagation();
                                        renameLine(line.id, editingLineName);
                                      } else if (e.key === "Escape") {
                                        e.stopPropagation();
                                        setEditingLineId(null);
                                      }
                                    }}
                                    className="px-2 py-0.5 bg-white border border-emerald-500 rounded text-xs font-semibold font-sans outline-none focus:ring-2 focus:ring-emerald-500/10"
                                    autoFocus
                                  />
                                ) : (
                                  <span className="cursor-pointer" onClick={() => setExpLines(curr => { const n = new Set(curr); n.has(line.id) ? n.delete(line.id) : n.add(line.id); return n; })}>{line.name}</span>
                                )}
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                                  filledSt > 0 
                                    ? 'bg-rose-50 text-rose-700 border border-rose-100' 
                                    : 'bg-gray-100 text-gray-500 border border-gray-200'
                                }`} onClick={() => setExpLines(curr => { const n = new Set(curr); n.has(line.id) ? n.delete(line.id) : n.add(line.id); return n; })}>
                                  {filledSt} / {totalSt} Filled
                                </span>
                              </span>
                            );
                          })()}
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => togLineHalf(line.id, selectedHalf)}
                              className={`px-2.5 py-1 rounded-lg text-[9px] font-mono font-bold border transition-colors cursor-pointer ${
                                LA(line.id, selectedHalf)
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                                  : "bg-red-50 text-red-700 border-red-100"
                              }`}
                            >
                              Line {selectedHalf === "half1" ? "H1" : "H2"}: {LA(line.id, selectedHalf) ? "ACTIVE" : "OFF"}
                            </button>
                            {isSystemAdmin && (
                              editingLineId === line.id ? (
                                <>
                                  <button
                                    onClick={() => renameLine(line.id, editingLineName)}
                                    className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg text-[9px] font-mono font-bold transition-colors cursor-pointer"
                                  >
                                    ✓ Save
                                  </button>
                                  <button
                                    onClick={() => setEditingLineId(null)}
                                    className="px-2 py-1 bg-white hover:bg-gray-100 border border-gray-200 text-gray-500 rounded-lg text-[9px] font-mono font-bold transition-colors cursor-pointer"
                                  >
                                    ✕
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingLineId(line.id);
                                      setEditingLineName(line.name);
                                    }}
                                    className="px-2 py-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 hover:text-emerald-700 hover:border-emerald-200 rounded-lg text-[9px] font-mono font-bold transition-all cursor-pointer"
                                    title="Rename Line"
                                  >
                                    ✏️ Rename
                                  </button>
                                  <button
                                    onClick={() => deleteLine(line.id)}
                                    className="px-2.5 py-1 bg-[#FEF2F2] hover:bg-[#FEE2E2] border border-[#FEE2E2] text-[#DC2626] rounded-lg text-[9px] font-mono font-bold transition-colors cursor-pointer"
                                    title="Delete Line"
                                  >
                                    🗑️ Delete
                                  </button>
                                </>
                              )
                            )}
                          </div>
                        </div>

                        {/* Station placements in columns */}
                        {isLineExp && (
                          <div className="p-4 bg-gray-50/50">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {lineStations.map(st => {
                                const activeAsn = GA(st.id, selectedHalf);
                                const isHalfAct = SA(st.id, selectedHalf);
                                const isHighlighted = highlightedStationId === st.id;

                                return (
                                  <div 
                                    id={`station-card-${st.id}`}
                                    key={st.id} 
                                    className={`rounded-xl p-4 flex flex-col justify-between space-y-3.5 transition-all duration-300 ${
                                      isHighlighted 
                                        ? "bg-amber-50/15 border-2 border-amber-400 shadow-sm ring-2 ring-amber-400/20 scale-[1.02]" 
                                        : activeAsn 
                                          ? "bg-red-50/70 border border-red-300/80 shadow-none" 
                                          : "bg-white border border-gray-150 shadow-none"
                                    }`}
                                  >
                                    {/* Header Name */}
                                    <div className="flex justify-between items-center pb-2.5 border-b border-gray-100">
                                      <div className="flex items-center gap-2.5 flex-1 min-w-0" onClick={e => e.stopPropagation()}>
                                        {activeAsn && (
                                          <div className="w-8 h-8 rounded-full overflow-hidden border border-red-200 shadow-xs shrink-0 bg-red-100 flex items-center justify-center">
                                            {(() => {
                                              const assoc = mockAssocs.find(a => a.badge === activeAsn.badge || a.login.toLowerCase() === activeAsn.login.toLowerCase());
                                              if (assoc?.photo) {
                                                return <img src={assoc.photo} alt={activeAsn.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />;
                                              }
                                              return <span className="text-[10px] font-extrabold text-red-800">{activeAsn.name.charAt(0).toUpperCase()}</span>;
                                            })()}
                                          </div>
                                        )}
                                        <div className="min-w-0">
                                          {isSystemAdmin ? (
                                            <div className="flex items-center gap-1 w-full min-w-0">
                                              <input
                                                type="text"
                                                defaultValue={st.name}
                                                onBlur={e => {
                                                  if (e.target.value !== st.name) {
                                                    renameStation(st.id, e.target.value);
                                                  }
                                                }}
                                                onKeyDown={e => {
                                                  if (e.key === "Enter") {
                                                    renameStation(st.id, e.currentTarget.value);
                                                    e.currentTarget.blur();
                                                  }
                                                }}
                                                className="text-xs font-bold text-gray-950 font-sans border-b border-dashed border-gray-300 focus:border-indigo-500 bg-transparent outline-none w-full min-w-0"
                                                title="Click to rename"
                                              />
                                              <button
                                                onClick={() => deleteStation(st.id)}
                                                className="text-[#DC2626] hover:text-red-700 text-xs bg-none border-none cursor-pointer p-0.5 ml-1 transition-all shrink-0"
                                                title="Delete Station"
                                              >
                                                🗑️
                                              </button>
                                            </div>
                                          ) : (
                                            <span className="text-xs font-bold text-gray-950 font-sans block truncate" title={st.name}>{st.name}</span>
                                          )}
                                          {activeAsn && (
                                            <span className="text-[10.5px] text-red-900 font-semibold block truncate">
                                              {activeAsn.name}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        {isHighlighted && (
                                          <span className="animate-pulse bg-amber-500 text-white font-mono text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider select-none shrink-0">
                                            Match
                                          </span>
                                        )}
                                        <span className={`text-[8px] font-mono font-bold uppercase border px-2 py-0.5 rounded-full shrink-0 ${
                                          st.status === "OPERATIONAL" ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-amber-50 text-amber-700 border-amber-100"
                                        }`}>{st.status}</span>
                                      </div>
                                    </div>

                                    {/* Placement detail row */}
                                    <div className={`p-2.5 rounded-xl border transition-colors ${activeAsn ? 'bg-white/80 border-red-200/80 shadow-3xs' : 'bg-gray-50/45 border-gray-150'}`}>
                                      <div className="flex justify-between items-center text-[9px] font-bold text-red-800 uppercase tracking-widest mb-1.5 font-mono">
                                        <span className={activeAsn ? "text-red-800 font-extrabold" : "text-gray-400"}>Placement ({selectedHalf === "half1" ? "H1" : "H2"})</span>
                                        {activeAsn && (
                                          <button onClick={() => clrSt(st.id, selectedHalf)} className="text-[10px] text-red-500 hover:text-red-700 font-bold p-0.5 cursor-pointer">✕</button>
                                        )}
                                      </div>
                                      
                                      {activeAsn ? (
                                        <div className="text-xs flex items-center gap-3">
                                          {/* Photo Avatar */}
                                          <div className="w-10 h-10 rounded-full bg-red-100 border border-red-200 overflow-hidden flex items-center justify-center shrink-0 shadow-3xs">
                                            {(() => {
                                              const assoc = mockAssocs.find(a => a.badge === activeAsn.badge || a.login.toLowerCase() === activeAsn.login.toLowerCase());
                                              if (assoc?.photo) {
                                                return <img src={assoc.photo} alt={activeAsn.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />;
                                              }
                                              return (
                                                <span className="font-extrabold text-red-800 text-xs">
                                                  {activeAsn.name ? activeAsn.name.charAt(0).toUpperCase() : "?"}
                                                </span>
                                              );
                                            })()}
                                          </div>
                                          <div className="min-w-0">
                                            <div className="font-bold text-red-950 truncate">{activeAsn.name}</div>
                                            <div className="text-[10px] text-red-805 font-mono mt-0.5 truncate">@{activeAsn.login}</div>
                                            <div className="text-[9px] text-rose-700 font-bold font-mono mt-0.5 truncate">{activeAsn.path}</div>
                                          </div>
                                        </div>
                                      ) : isHalfAct ? (
                                        <button onClick={() => setManModal({ sid: st.id, stName: st.name, pathName: path.name, half: selectedHalf })} className="text-left w-full text-emerald-600 hover:underline text-[10px] font-mono font-semibold cursor-pointer">
                                          + Place Associate
                                        </button>
                                      ) : (
                                        <span className="text-[10px] text-gray-400 font-mono italic">Offline (Check state)</span>
                                      )}
                                    </div>

                                    {/* Action controls footer */}
                                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 flex-wrap">
                                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest font-mono">Service:</span>
                                      <button 
                                        onClick={() => togStActive(st.id)}
                                        className={`px-2.5 py-0.5 rounded text-[9px] font-bold border transition-colors cursor-pointer ${
                                          isStationServiceActive(st.id) 
                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-bold hover:bg-emerald-100' 
                                            : 'bg-red-50 border-red-200 text-red-700 font-bold hover:bg-red-100'
                                        }`}
                                      >
                                        {isStationServiceActive(st.id) ? 'ACTIVE' : 'DISABLED'}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Manual Assignment pop modal */}
      {manModal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs z-[1000] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 max-w-[400px] w-full p-6 shadow-sm">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 mb-4">
              <h3 className="text-xs font-bold uppercase tracking-widest font-mono">Place Staff: Stn {manModal.stName}</h3>
              <button onClick={() => { setManModal(null); setManBadge(""); setManMsg(""); }} className="text-gray-400 hover:text-gray-600 text-xl font-light">×</button>
            </div>

            {manMsg && (
              <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-3 rounded-lg text-xs mb-4">
                {manMsg}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-1.5">Scan Login or Badge</label>
                <input
                  type="text"
                  value={manBadge}
                  onChange={e => setManBadge(e.target.value)}
                  placeholder="e.g. 101181 or jsmith"
                  className="w-full text-xs font-sans p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-indigo-600 transition-all font-semibold"
                />
              </div>

              <div className="flex gap-2">
                <button onClick={doAssign} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold cursor-pointer">
                  Confirm placement
                </button>
                <button onClick={() => { setManModal(null); setManBadge(""); setManMsg(""); }} className="px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-semibold cursor-pointer">
                  Discard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Path Creation Modal */}
      {addPathM && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs z-[1000] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 max-w-[400px] w-full p-6 shadow-sm">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 mb-4">
              <h3 className="text-xs font-bold uppercase tracking-widest font-mono">Create Path — {dept}</h3>
              <button onClick={() => setAddPathM(false)} className="text-gray-400 hover:text-gray-600 text-xl font-light">×</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-1.5">Name</label>
                <input type="text" value={nPath.name} onChange={e => setNPath({...nPath, name: e.target.value})} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs" placeholder="e.g. High Side CRETS" />
              </div>
              <div>
                <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-1.5">Type</label>
                <select value={nPath.role_type} onChange={e => setNPath({...nPath, role_type: e.target.value as any})} className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs">
                  <option value="DIRECT">DIRECT (10hr limit)</option>
                  <option value="INDIRECT">INDIRECT (5hr limit)</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={addPath} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold cursor-pointer">Save Path</button>
                <button onClick={() => setAddPathM(false)} className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-semibold cursor-pointer">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Line Creation Modal */}
      {addLineM && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs z-[1000] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 max-w-[400px] w-full p-6 shadow-sm">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 mb-4">
              <h3 className="text-xs font-bold uppercase tracking-widest font-mono">Create Line</h3>
              <button onClick={() => setAddLineM(false)} className="text-gray-400 hover:text-gray-600 text-xl font-light">×</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-1.5">Line Name</label>
                <input type="text" value={nLine.name} onChange={e => setNLine({...nLine, name: e.target.value})} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs" placeholder="e.g. Line 9" />
              </div>
              <div>
                <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-1.5">Select parent path</label>
                <select value={nLine.path_id} onChange={e => setNLine({...nLine, path_id: e.target.value})} className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs">
                  <option value="">— Choose Path —</option>
                  {deptPaths.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={addLine} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold cursor-pointer">Save Line</button>
                <button onClick={() => setAddLineM(false)} className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-semibold cursor-pointer">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Station Creation Modal */}
      {addStM && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs z-[1000] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 max-w-[400px] w-full p-6 shadow-sm">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 mb-4">
              <h3 className="text-xs font-bold uppercase tracking-widest font-mono">Create Station</h3>
              <button onClick={() => setAddStM(false)} className="text-gray-400 hover:text-gray-600 text-xl font-light">×</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-1.5">Station Label</label>
                <input type="text" value={nSt.name} onChange={e => setNSt({...nSt, name: e.target.value})} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs" placeholder="e.g. 1-1" />
              </div>
              <div>
                <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-1.5">Aisle Side</label>
                <select value={nSt.side} onChange={e => setNSt({...nSt, side: e.target.value as any})} className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs">
                  <option value="ODD">ODD</option>
                  <option value="EVEN">EVEN</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-1.5">Select parent Line</label>
                <select value={nSt.line_id} onChange={e => setNSt({...nSt, line_id: e.target.value})} className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-xs">
                  <option value="">— Choose Line —</option>
                  {floorLines.filter(l => deptPaths.some(p => p.id === l.path_id)).map(l => (
                    <option key={l.id} value={l.id}>
                      {floorPaths.find(p => p.id === l.path_id)?.name} / {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={addStation} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold cursor-pointer">Save Station</button>
                <button onClick={() => setAddStM(false)} className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-semibold cursor-pointer">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
