import React, { useState, useEffect, useRef } from "react";
import { Associate, StationAssignment } from "../types";

function getCurrentRealShiftAndDate() {
  const now = new Date();
  const hour = now.getHours();
  let shiftType = "DAY";
  let adjustedDate = new Date(now);

  if (hour >= 18) {
    shiftType = "NIGHT";
  } else if (hour < 7) {
    shiftType = "NIGHT";
    adjustedDate.setDate(adjustedDate.getDate() - 1);
  } else {
    shiftType = "DAY";
  }

  const year = adjustedDate.getFullYear();
  const month = String(adjustedDate.getMonth() + 1).padStart(2, '0');
  const day = String(adjustedDate.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  return { shiftType, dateStr };
}

function getShiftInfoText(dateVal: Date | string) {
  const dateObj = dateVal instanceof Date ? dateVal : new Date(dateVal + "T00:00:00");
  const day = dateObj.getDay(); // 0 is Sunday, 3 is Wednesday, 6 is Saturday
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = days[day];

  if (day >= 0 && day <= 2) {
    return {
      dayName,
      dayShift: "FHD",
      nightShift: "FHN",
      overlapping: false
    };
  }
  if (day === 3) {
    return {
      dayName,
      dayShift: "FHD/BHD Overlap",
      nightShift: "FHN/BHN Overlap",
      overlapping: true
    };
  }
  return {
    dayName,
    dayShift: "BHD",
    nightShift: "BHN",
    overlapping: false
  };
}

interface KioskProps {
  onAssign: (assignment: any) => void;
  shiftType: string;
  staffDate: Date | string;
  laborShareEnabled: boolean;
  laborShareCount: number;
  crossDeptUsage: any;
  incrementCrossDept: (key: string) => void;
  getCrossDeptUsed: (key: string) => number;
  mockAssocs: Associate[];
  floorPaths: any[];
  floorLines: any[];
  floorStations: any[];
  getStationAssignment: (ctx: string, sid: number, half: string) => any;
  setStationAssignment: (ctx: string, sid: number, half: string, assignment: any) => void;
  setBadgeAssignment: (ctx: string, badge: string, half: string, sid: number) => void;
  consec3Indirect: (badge: string, dept: string) => boolean;
  runScanWithLaborShare: (badge: string, staffDate: any, shiftType: string, laborShareEnabled: boolean, laborShareCount: number, crossDeptUsage: any, getCrossDeptUsed: any, incrementCrossDept: any, contextKey: string) => any;
}

export function Kiosk({
  onAssign,
  shiftType,
  staffDate,
  laborShareEnabled,
  laborShareCount,
  crossDeptUsage,
  incrementCrossDept,
  getCrossDeptUsed,
  mockAssocs,
  floorPaths,
  floorLines,
  floorStations,
  getStationAssignment,
  setStationAssignment,
  setBadgeAssignment,
  consec3Indirect,
  runScanWithLaborShare
}: KioskProps) {
  const [cur, setCur] = useState<any>(null);
  const [inputVal, setInputVal] = useState("");
  const [cd, setCd] = useState(30);
  const inputRef = useRef<HTMLInputElement>(null);
  const resetT = useRef<any>(null);
  const cdT = useRef<any>(null);
  const cdRef = useRef(30);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(resetT.current);
      clearInterval(cdT.current);
    };
  }, []);



  function showResult(res: any) {
    clearTimeout(resetT.current);
    clearInterval(cdT.current);
    cdRef.current = 30;
    setCd(30);
    setCur({ result: res, id: Date.now() });

    cdT.current = setInterval(() => {
      cdRef.current--;
      setCd(cdRef.current);
      if (cdRef.current <= 0) clearInterval(cdT.current);
    }, 1000);

    resetT.current = setTimeout(() => {
      setCur(null);
      setCd(30);
      inputRef.current?.focus();
    }, 30000);
  }

  const handleScan = async (badge: string) => {
    if (!badge.trim()) return;
    setInputVal("");
    setTimeout(() => inputRef.current?.focus(), 20);
    
    // Always use the real-time active shift and date for kiosk scans 
    const { shiftType: realShift, dateStr: realDate } = getCurrentRealShiftAndDate();
    const contextKey = `live|${realDate}|${realShift}`;

    let res = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ badge: badge.trim(), shiftType: realShift, staffDate: realDate, laborShareEnabled, laborShareCount })
    }).then(r => r.ok ? r.json() : null).catch(() => null);

    if (!res) {
      res = runScanWithLaborShare(
        badge.trim(),
        realDate,
        realShift,
        laborShareEnabled,
        laborShareCount,
        crossDeptUsage,
        getCrossDeptUsed,
        incrementCrossDept,
        contextKey
      );
    }

    if (!res || res.error) {
      showResult({ notFound: true, badge });
      return;
    }

    onAssign({ ...res, timestamp: new Date() });
    showResult(res);
  };

  const r = cur?.result;
  const gm = r && (!r.station && r.path === "SEE ADMIN");

  const isIndLoc = (p: string | null | undefined) => {
    if (!p) return false;
    const found = floorPaths.find((x: any) => x.name === p);
    if (found) {
      const hours = found.rotation_hours !== undefined ? found.rotation_hours : 10;
      if (hours <= 5) return true;
    }
    const u = String(p).toUpperCase();
    return u.includes("WATERSPIDER") || u.includes("DOWNSTACKER") || u.includes("UNLOADER") || u.includes("UPSTACKER") || u.includes("CAGE");
  };

  const getDisplayRoleName = (pathName: string, dept: string) => {
    return pathName || "–";
  };

  return (
    <div className="flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-[480px]">
        {/* Header telemetry text */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-extrabold tracking-tight text-gray-900 font-sans">Optimus Staffing Hub Scanner</h2>
          <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider font-mono">TEN1 Sandip Auto-placement screen</p>
          <div className="flex gap-2 justify-center mt-3 font-mono">
            {(() => {
              const { shiftType: realShift, dateStr: realDate } = getCurrentRealShiftAndDate();
              const info = getShiftInfoText(realDate);
              const activeLabel = realShift === "DAY" ? info.dayShift : info.nightShift;
              
              let dateFormatted = String(realDate);
              try {
                const parts = realDate.split("-");
                if (parts.length === 3) {
                  const dObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                  dateFormatted = dObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                }
              } catch {}

              return (
                <>
                  <span className={`border rounded-lg px-2 py-0.5 text-[9px] font-bold ${
                    info.overlapping ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-emerald-50 border-emerald-100 text-emerald-700"
                  }`}>
                    {realShift === "DAY" ? "☀" : "🌙"} {info.dayName}: {activeLabel}
                  </span>
                  <span className="bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-0.5 text-[9px] font-bold text-emerald-700 font-mono">
                    {dateFormatted}
                  </span>
                </>
              );
            })()}
          </div>
        </div>

        {/* Scan Bar Input */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-3xs">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 text-center">
            Scan physical badge or enter login username below
          </div>
          <input
            ref={inputRef}
            value={inputVal}
            onChange={e => setInputVal(e.target.value.replace(/\s/g, ""))}
            onKeyDown={e => e.key === "Enter" && handleScan(inputVal)}
            placeholder="Awaiting RFID scan / login input..."
            className="w-full py-4 px-6 bg-[#F9FAFB] border-2 border-gray-100 rounded-xl text-xl font-bold font-mono text-center tracking-wider text-gray-900 focus:bg-white focus:border-emerald-600 outline-none transition-all placeholder:text-gray-300 placeholder:text-sm placeholder:font-sans placeholder:font-normal"
          />
          <div className="flex flex-col items-center gap-1.5 text-[10px] text-gray-400 font-mono mt-3 text-center">
            <span className="text-[9px] text-gray-500 font-sans font-medium text-emerald-600">Please scan your physical RFID badge directly using the hand scanner, or type your login credential.</span>
          </div>
        </div>

        {/* Scan successful result */}
        {r && !r.notFound && (() => {
          const isSpanish = cd <= 15;
          return (
            <div key={cur.id} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm animate-fadeIn">
              {/* Language switcher indicator */}
              <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-100">
                <span className={`text-[9px] font-extrabold font-mono px-1.5 py-0.5 rounded-md transition-all ${!isSpanish ? "bg-emerald-100 text-emerald-700 shadow-3xs" : "bg-gray-50 text-gray-400"}`}>
                  🇺🇸 EN
                </span>
                <span className="text-[8px] font-semibold text-gray-400 font-sans tracking-wide">
                  {isSpanish ? "Cambio automático cada 15s" : "Auto-cycling languages every 15s"}
                </span>
                <span className={`text-[9px] font-extrabold font-mono px-1.5 py-0.5 rounded-md transition-all ${isSpanish ? "bg-emerald-100 text-emerald-700 shadow-3xs" : "bg-gray-50 text-gray-400"}`}>
                  🇪🇸 ES
                </span>
              </div>

              {/* Countdown timer */}
              <div className="flex items-center gap-2 mb-4">
                <div className="flex-1 bg-gray-100 rounded-full h-1 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000 bg-emerald-500"
                    style={{ width: `${(cd / 30) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-gray-400 font-bold">{cd}s</span>
              </div>

              {/* Associate details */}
              <div className="flex items-center gap-3.5 pb-4 border-b border-gray-100 mb-4">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-emerald-50 border border-emerald-100 flex items-center justify-center font-bold text-emerald-700 text-sm font-sans uppercase shadow-3xs shrink-0">
                  {(() => {
                    const assoc = mockAssocs.find(a => a.badge === r.associate.badge || a.login.toLowerCase() === r.associate.login.toLowerCase());
                    if (assoc?.photo) {
                      return <img src={assoc.photo} alt={r.associate.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />;
                    }
                    return <span className="text-emerald-800 font-semibold">{r.associate.name.charAt(0)}</span>;
                  })()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 leading-tight">
                    {isSpanish ? `¡Bienvenido(a), ${r.associate.name.split(" ")[0]}!` : `Welcome, ${r.associate.name.split(" ")[0]}!`}
                  </h3>
                  <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                    @{r.associate.login} · {isSpanish ? "Turno" : "Shift"} {r.associate.shift_code} · {r.associate.operation_mode}
                  </p>
                </div>
              </div>

              {/* Assignments display */}
              {(!r.half1 || r.half1.path === "SEE ADMIN") && (!r.half2 || r.half2.path === "SEE ADMIN") ? (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-center">
                  <div className="text-lg mb-1">⚠️</div>
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-red-800">
                    {isSpanish ? "VER PA / PERSONAL ADMINISTRATIVO" : "SEE PA / ADMIN"}
                  </div>
                  <div className="text-xs font-semibold mt-1">
                    {r.reason ? (
                      isSpanish ? "No hay estaciones abiertas en sus funciones autorizadas. Solicite ayuda." : r.reason
                    ) : (
                      isSpanish ? "No hay estaciones abiertas en sus funciones autorizadas. Solicite ayuda." : "No stations are open on your qualified paths. Seek guidance."
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* 1st Half Assignment */}
                  <div className="bg-emerald-50/50 border border-emerald-100/50 rounded-xl p-4">
                    <div className="text-[9px] font-bold text-emerald-800 uppercase tracking-widest mb-1.5 font-mono">
                      {isSpanish ? "ASIGNACIÓN DE LA 1RA MITAD:" : "1ST HALF STATION PLACEMENT:"}
                    </div>
                    {r.half1?.path === "SEE ADMIN" ? (
                      <div>
                        <div className="text-sm font-bold text-amber-700 flex items-center gap-1 font-mono">
                          ⚠️ {isSpanish ? "VER COMPAÑERO / ADMIN" : "SEE ADMIN"}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 font-medium leading-relaxed">
                          {r.half1.seeAdminReason === "No first half stations open."
                            ? (isSpanish ? "No hay estaciones abiertas para la primera mitad." : r.half1.seeAdminReason)
                            : (r.half1.seeAdminReason === "All structures full."
                                ? (isSpanish ? "Todas las líneas/estructuras están llenas." : r.half1.seeAdminReason)
                                : (isSpanish ? "No hay estaciones disponibles." : r.half1.seeAdminReason || "No first half stations open.")
                              )
                          }
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="text-lg font-bold text-gray-900 leading-tight">
                          {getDisplayRoleName(r.half1?.path || r.path, r.assignedDept || r.dept)}
                        </div>
                        <div className="text-sm font-bold text-emerald-700 mt-1 uppercase font-mono">
                          {r.half1?.station?.name || r.station?.name || (isSpanish ? "VER ADMIN" : "SEE ADMIN")}
                        </div>
                        <div className="flex gap-1.5 mt-2.5">
                          <span className="bg-white border border-emerald-100 px-2 py-0.5 rounded-md text-[8px] font-bold text-emerald-800 font-mono">
                            LC {r.half1?.lc || r.lc || 5}/5
                          </span>
                          <span className="bg-white border border-emerald-100 px-2 py-0.5 rounded-md text-[8px] font-bold text-emerald-800 font-mono">
                            CAP {(() => { const p = r.half1?.path || r.path; const found = floorPaths.find((x: any) => x.name === p); return found ? (found.rotation_hours !== undefined ? found.rotation_hours : 10) : (r.half1?.rotationHours || r.rotationHours || 10); })()} HR
                          </span>
                          <span className="bg-white border border-emerald-100 px-2 py-0.5 rounded-md text-[8px] font-bold text-emerald-800 font-mono uppercase">
                            {isIndLoc(r.half1?.path || r.path) ? (isSpanish ? "INDIRECTO" : "INDIRECT") : (isSpanish ? "DIRECTO" : "DIRECT")}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* 2nd Half Assignment */}
                  {r.half2 && (
                    <div className="bg-emerald-50/30 border border-emerald-100 rounded-xl p-4">
                      <div className="text-[9px] font-bold text-emerald-800 uppercase tracking-widest mb-1.5 font-mono">
                        {isSpanish ? "ASIGNACIÓN DE LA 2DA MITAD (POST-RECREO):" : "2ND HALF (POST-BREAK) PLACEMENT:"}
                      </div>
                      {r.half2.path === "SEE ADMIN" ? (
                        <div>
                          <div className="text-sm font-bold text-amber-700 flex items-center gap-1 font-mono">
                            ⚠️ {isSpanish ? "VER COMPAÑERO / ADMIN" : "SEE ADMIN"}
                          </div>
                          <div className="text-xs text-gray-500 mt-1 font-medium leading-relaxed">
                            {r.half2.seeAdminReason === "No second half stations open."
                              ? (isSpanish ? "No hay estaciones abiertas para la segunda mitad." : r.half2.seeAdminReason)
                              : (r.half2.seeAdminReason === "All structures full."
                                  ? (isSpanish ? "Todas las líneas/estructuras están llenas." : r.half2.seeAdminReason)
                                  : (isSpanish ? "No hay estaciones disponibles." : r.half2.seeAdminReason || "No second half stations open.")
                                )
                            }
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="text-lg font-bold text-gray-950 leading-tight">
                            {getDisplayRoleName(r.half2.path, r.assignedDept || r.dept)}
                          </div>
                          <div className="text-sm font-bold text-emerald-700 mt-1 uppercase font-mono">
                            {r.half2.station?.name || (isSpanish ? "MISMA ESTACIÓN" : "SAME STATION")}
                          </div>
                          <div className="flex gap-1.5 mt-2.5">
                            <span className="bg-white border border-emerald-100 px-2 py-0.5 rounded-md text-[8px] font-bold text-emerald-800 font-mono">
                              LC {r.half2.lc || r.lc || 5}/5
                            </span>
                            <span className="bg-white border border-emerald-100 px-2 py-0.5 rounded-md text-[8px] font-bold text-emerald-800 font-mono">
                              CAP {(() => { const p = r.half2?.path; const found = floorPaths.find((x: any) => x.name === p); return found ? (found.rotation_hours !== undefined ? found.rotation_hours : 10) : (r.half2?.rotationHours || r.rotationHours || 10); })()} HR
                            </span>
                            <span className="bg-white border border-emerald-100 px-2 py-0.5 rounded-md text-[8px] font-bold text-emerald-800 font-mono uppercase">
                              {isIndLoc(r.half2?.path) ? (isSpanish ? "INDIRECTO" : "INDIRECT") : (isSpanish ? "DIRECTO" : "DIRECT")}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  )}


                </div>
              )}
            </div>
          );
        })()}

        {/* Not Register alert popup */}
        {r?.notFound && (
          <div key={cur.id} className="bg-white rounded-2xl border border-red-200 p-8 text-center shadow-3xs">
            <div className="text-4xl mb-2">⚠️</div>
            <h3 className="text-base font-bold text-red-700 leading-tight font-sans">Badge Code Not Found</h3>
            <p className="text-xs text-gray-400 mt-1.5 font-mono">User barcode "{r.badge}" is currently unregistered.</p>
          </div>
        )}
      </div>
    </div>
  );
}
