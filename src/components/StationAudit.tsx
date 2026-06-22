import React, { useState, useEffect, useRef } from "react";
import { QrCode, Trash2, RefreshCw, Layers, CheckCircle, Clock, ShieldAlert, Monitor, Download, ArrowRight, UserCheck } from "lucide-react";

interface StationAuditProps {
  apiUrl: string;
}

interface AuditRecord {
  id: number;
  path_name: string;
  station_name: string;
  badge: string;
  associate_name: string;
  scanned_at: number;
}

interface DBPath {
  id: number;
  name: string;
  active: boolean;
}

interface DBStation {
  id: number;
  line_id: number;
  name: string;
  active: boolean;
  occupied?: boolean;
  occupied_by?: string | null;
}

interface DBLine {
  id: number;
  path_id: number;
  name: string;
  active: boolean;
}

export function StationAudit({ apiUrl }: StationAuditProps) {
  const [audits, setAudits] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [paths, setPaths] = useState<DBPath[]>([]);
  const [lines, setLines] = useState<DBLine[]>([]);
  const [stations, setStations] = useState<DBStation[]>([]);

  // Selection state for QR generator
  const [selectedPathName, setSelectedPathName] = useState("");
  const [selectedStationName, setSelectedStationName] = useState("");
  const [isClearing, setIsClearing] = useState(false);

  // Scanner Terminal Receiver State
  const [scanTermInput, setScanTermInput] = useState("");
  const [scanStep, setScanStep] = useState<"AWAITING_QR" | "AWAITING_BADGE">("AWAITING_QR");
  const [pendingPath, setPendingPath] = useState("");
  const [pendingStation, setPendingStation] = useState("");
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Simulation State for Manual Tests
  const [testBadgeInput, setTestBadgeInput] = useState("");

  const scanInputRef = useRef<HTMLInputElement>(null);
  const [keepFocus, setKeepFocus] = useState(true);

  // Auto-focus physical reader
  useEffect(() => {
    if (keepFocus && scanInputRef.current) {
      scanInputRef.current.focus();
    }
    const interval = setInterval(() => {
      if (keepFocus && scanInputRef.current && document.activeElement !== scanInputRef.current) {
        scanInputRef.current.focus();
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [keepFocus, scanStep]);

  // Load audit records and live configuration
  const loadAudits = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/station-audits`);
      const data = await res.json();
      setAudits(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error loading station audits:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadConfigData = async () => {
    try {
      const rPaths = await fetch(`${apiUrl}/paths`);
      const dPaths = await rPaths.json();
      setPaths(Array.isArray(dPaths) ? dPaths.filter((p: any) => p.active !== false) : []);

      const rLines = await fetch(`${apiUrl}/lines`);
      const dLines = await rLines.json();
      setLines(Array.isArray(dLines) ? dLines.filter((l: any) => l.active !== false) : []);

      const rStations = await fetch(`${apiUrl}/stations`);
      const dStations = await rStations.json();
      setStations(Array.isArray(dStations) ? dStations.filter((s: any) => s.active !== false) : []);
    } catch (err) {
      console.error("Error loading config metadata:", err);
    }
  };

  useEffect(() => {
    loadAudits();
    loadConfigData();
    const interval = setInterval(loadAudits, 5000);
    return () => clearInterval(interval);
  }, []);

  // Set default selection when paths/stations are loaded
  useEffect(() => {
    if (paths.length > 0 && !selectedPathName) {
      setSelectedPathName(paths[0].name);
    }
  }, [paths]);

  // Find all stations related to the selected path name
  const filteredLines = lines.filter(l => {
    const parentPath = paths.find(p => p.name === selectedPathName);
    return parentPath ? l.path_id === parentPath.id : false;
  });

  const availableStations = stations.filter(s => {
    return filteredLines.some(l => l.id === s.line_id);
  });

  useEffect(() => {
    if (availableStations.length > 0) {
      setSelectedStationName(availableStations[0].name);
    } else {
      setSelectedStationName("");
    }
  }, [selectedPathName, lines, stations]);

  // QR URLs Generator
  const origin = window.location.origin;
  
  // Clean QR definitions
  const checkinQrValue = `${selectedPathName} : station ${selectedStationName}`;
  const checkoutQrValue = `LEAVE : ${selectedPathName} : station ${selectedStationName}`;

  // We can generate clean visual QR images using Google Charts API
  const checkinQrImage = `https://chart.googleapis.com/chart?chs=320x320&cht=qr&chl=${encodeURIComponent(checkinQrValue)}&choe=UTF-8`;
  const checkoutQrImage = `https://chart.googleapis.com/chart?chs=320x320&cht=qr&chl=${encodeURIComponent(checkoutQrValue)}&choe=UTF-8`;

  // Submit scan to backend APIs
  const handleCheckInAndOccupancy = async (pPath: string, pStation: string, assocBadge: string) => {
    try {
      const res = await fetch(`${apiUrl}/station-audits/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path_name: pPath,
          station_name: pStation,
          badge: assocBadge.trim()
        })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to register scan check-in");
      }
      const data = await res.json();
      setStatusMsg({
        type: "success",
        text: `Successfully Checked In! ${data.associate_name} (${data.badge}) is now active on ${pStation}.`
      });
      loadAudits();
      loadConfigData();
    } catch (e: any) {
      setStatusMsg({
        type: "error",
        text: e.message || "Error during scan confirmation."
      });
    }
  };

  const handleCheckOutStation = async (pPath: string, pStation: string) => {
    try {
      const res = await fetch(`${apiUrl}/station-audits/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path_name: pPath,
          station_name: pStation
        })
      });
      if (!res.ok) {
        throw new Error("Failed to register checkout.");
      }
      setStatusMsg({
        type: "success",
        text: `Checked Out: ${pPath} : ${pStation} has been cleared and is now marked as empty!`
      });
      loadAudits();
      loadConfigData();
    } catch (e: any) {
      setStatusMsg({
        type: "error",
        text: e.message || "Error during scan check-out."
      });
    }
  };

  // Process any handheld scan trigger (input + enter)
  const handleTerminalScan = (val: string) => {
    const rawVal = val.trim();
    if (!rawVal) return;
    setScanTermInput("");

    if (scanStep === "AWAITING_QR") {
      // Check if it's LEAVE or standard check in
      const lower = rawVal.toLowerCase();
      if (lower.startsWith("leave ")) {
        // Parse leave format: LEAVE : path_name : station station_name
        const cleanedStr = rawVal.replace(/^leave\s*:\s*/i, "").trim();
        const parts = cleanedStr.split(/\s*:\s*station\s*/i);
        if (parts.length >= 2) {
          const path = parts[0].trim();
          const station = parts[1].trim();
          handleCheckOutStation(path, station);
        } else {
          // Fallback split
          const parts2 = cleanedStr.split(/\s*:\s*/);
          if (parts2.length >= 2) {
            handleCheckOutStation(parts2[0].trim(), parts2[1].replace(/station/gi, "").trim());
          } else {
            setStatusMsg({ type: "error", text: "Unrecognized Leave QR structure." });
          }
        }
      } else {
        // Parse check-in format: path_name : station station_name
        const parts = rawVal.split(/\s*:\s*station\s*/i);
        if (parts.length >= 2) {
          const path = parts[0].trim();
          const station = parts[1].trim();
          setPendingPath(path);
          setPendingStation(station);
          setScanStep("AWAITING_BADGE");
          setStatusMsg({
            type: "info",
            text: `Station [${station}] Detected! Now scan Associate Badge/RFID or SSO login to complete check-in.`
          });
        } else {
          // Alternate generic split
          const parts2 = rawVal.split(/\s*:\s*/);
          if (parts2.length >= 2) {
            const path = parts2[0].trim();
            const station = parts2[1].replace(/station/gi, "").trim();
            setPendingPath(path);
            setPendingStation(station);
            setScanStep("AWAITING_BADGE");
            setStatusMsg({
              type: "info",
              text: `Station [${station}] Detected! Now scan Associate Badge/RFID or SSO login to complete check-in.`
            });
          } else {
            setStatusMsg({
              type: "error",
              text: `Scan received, but doesn't look like a station QR code. Received: "${rawVal}"`
            });
          }
        }
      }
    } else {
      // Step 2: Badge scan
      const assocBadge = rawVal;
      setScanStep("AWAITING_QR");
      handleCheckInAndOccupancy(pendingPath, pendingStation, assocBadge);
    }
  };

  const handleClearAudits = async () => {
    if (!window.confirm("Are you sure you want to clear the entire Realtime Station Audit log?")) return;
    setIsClearing(true);
    try {
      await fetch(`${apiUrl}/station-audits/clear`, { method: "DELETE" });
      setAudits([]);
      setStatusMsg({ type: "success", text: "Station audits log database cleared." });
    } catch (err) {
      console.error("Error clearing logs:", err);
    } finally {
      setIsClearing(false);
    }
  };

  const emulateLeaveSimulation = () => {
    if (!selectedPathName || !selectedStationName) return;
    handleCheckOutStation(selectedPathName, selectedStationName);
  };

  const emulateCheckInSimulation = () => {
    if (!selectedPathName || !selectedStationName) return;
    if (!testBadgeInput.trim()) {
      alert("Please enter a badge number or username in the test box to simulate!");
      return;
    }
    handleCheckInAndOccupancy(selectedPathName, selectedStationName, testBadgeInput);
    setTestBadgeInput("");
  };

  const getRelativeTime = (epochMs: number) => {
    const s = Math.floor((Date.now() - epochMs) / 1000);
    if (s < 5) return "Just now";
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return new Date(epochMs).toLocaleDateString();
  };

  return (
    <div className="space-y-6" id="station-audit-tab">
      
      {/* Header and Telemetry Stats Grid */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-gray-250 p-5 rounded-2xl shadow-3xs">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 font-sans tracking-tight uppercase flex items-center gap-2">
            Realtime Station Audit Log
          </h1>
          <p className="text-xs text-gray-500 font-sans mt-1">
            Physical hand-scanner integration console. Scan station QR labels to assign and occupy floor lines dynamically.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => { loadAudits(); loadConfigData(); }}
            className="p-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-gray-600 transition-colors cursor-pointer flex items-center justify-center"
            title="Refresh logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-600" : ""}`} />
          </button>
          <button
            onClick={handleClearAudits}
            disabled={isClearing || audits.length === 0}
            className="px-4 py-2.5 bg-red-50 hover:bg-red-100 disabled:opacity-40 border border-red-150 text-red-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border-none"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Log</span>
          </button>
        </div>
      </div>

      {/* Hand Scanner Gateway Receiver Console Panel */}
      <div className="bg-slate-900 text-slate-100 border border-slate-950 rounded-2xl p-6 shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 w-48 h-48 bg-emerald-500 rounded-full filter blur-3xl opacity-5 -mr-16 -mt-16"></div>
        
        <div className="relative space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${keepFocus ? "bg-emerald-500 animate-pulse" : "bg-gray-500"} shrink-0`}></span>
              <h2 className="text-sm font-extrabold font-mono tracking-wider uppercase text-emerald-400">
                ⚡ PHYSICAL HAND-SCANNER RECEIVER GATE
              </h2>
            </div>
            <label className="flex items-center gap-2 text-[11px] font-mono select-none text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={keepFocus}
                onChange={(e) => setKeepFocus(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-0 bg-slate-800 border-slate-700 cursor-pointer"
              />
              <span>Locked focus for hardware scanner</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
            <div className="md:col-span-8 space-y-2">
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                Keep this window active on your laptop or desk computer. Place your cursor inside the text box or let the automatic lock focus it. You can instantly check associates into a station, or leave a station.
              </p>
              
              {/* Scan Stage Progress visual */}
              <div className="flex items-center gap-3 bg-slate-950/60 rounded-xl p-3 border border-slate-800 text-xs font-mono">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${scanStep === "AWAITING_QR" ? "bg-amber-400 animate-ping" : "bg-gray-600"}`}></span>
                  <span className={scanStep === "AWAITING_QR" ? "text-amber-300 font-bold" : "text-slate-500"}>1. Scan Station QR</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${scanStep === "AWAITING_BADGE" ? "bg-emerald-400 animate-ping" : "bg-gray-600"}`}></span>
                  <span className={scanStep === "AWAITING_BADGE" ? "text-emerald-300 font-bold" : "text-slate-500"}>2. Scan Associate Badge</span>
                </div>
              </div>
            </div>

            <div className="md:col-span-4 justify-center flex">
              <div className="w-full relative">
                <input
                  ref={scanInputRef}
                  type="text"
                  value={scanTermInput}
                  onChange={(e) => setScanTermInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleTerminalScan(scanTermInput)}
                  className="w-full bg-slate-950 border border-slate-800 px-4 py-3 rounded-xl font-mono text-xs text-emerald-400 font-bold placeholder-slate-700 outline-none focus:border-emerald-500 text-center tracking-wider focus:ring-1 focus:ring-emerald-500/30 shadow-inner"
                  placeholder={scanStep === "AWAITING_QR" ? "[ SCAN STATION LABEL QR ]" : "[ SCAN EMPLOYEE BADGE RFID ]"}
                />
                <span className="absolute right-3.5 top-3.5 font-mono text-[9px] text-slate-500 uppercase select-none">
                  Hardware Port
                </span>
              </div>
            </div>
          </div>

          {/* Status Message Display */}
          {statusMsg && (
            <div className={`p-3.5 rounded-xl border text-xs font-mono flex items-start gap-2.5 ${
              statusMsg.type === "success" ? "bg-emerald-900/20 border-emerald-800/50 text-emerald-300" :
              statusMsg.type === "error" ? "bg-red-900/20 border-red-800/50 text-red-300" :
              "bg-indigo-900/20 border-indigo-800/50 text-indigo-300"
            }`}>
              <span className="font-bold uppercase tracking-wider">[{statusMsg.type}]</span>
              <p className="font-sans font-medium">{statusMsg.text}</p>
            </div>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200 p-5 rounded-2xl flex items-center gap-4 shadow-3xs">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 font-mono">Today's Audits</p>
            <p className="text-2xl font-bold text-gray-800 font-sans mt-0.5">{audits.length}</p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-5 rounded-2xl flex items-center gap-4 shadow-3xs">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 font-mono">Active Stations</p>
            <p className="text-2xl font-bold text-gray-800 font-sans mt-0.5">
              {new Set(audits.filter(a => a.badge !== "UNOCCUPIED").map(a => `${a.path_name}|${a.station_name}`)).size}
            </p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-5 rounded-2xl flex items-center gap-4 shadow-3xs">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 font-mono">Latest Activity</p>
            <p className="text-xs font-bold text-gray-800 truncate font-sans max-w-[160px] leading-tight pt-1">
              {audits.length > 0 ? `${audits[0].station_name} (${getRelativeTime(audits[0].scanned_at)})` : "No scans registered"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Audit Log stream */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-white border border-gray-250 rounded-2xl overflow-hidden shadow-3xs">
            <div className="p-4 border-b border-gray-150 bg-gray-50/50 flex justify-between items-center">
              <span className="text-xs font-mono font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                Live Audit Stream
              </span>
              <span className="text-[10px] text-gray-400 font-mono">Automated refresh active</span>
            </div>

            {audits.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center space-y-3 bg-white">
                <div className="w-14 h-14 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center">
                  <Monitor className="w-7 h-7" />
                </div>
                <div className="max-w-xs">
                  <p className="text-sm font-bold text-gray-700">No Audits Collected Yet</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Print the physical station labels below or emulate a scan to test the setup.
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                {audits.map((a) => {
                  const isCheckout = a.badge === "UNOCCUPIED";
                  return (
                    <div key={a.id} className="p-4 hover:bg-gray-50/75 transition-all flex items-center justify-between gap-4">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded font-semibold font-mono text-[9px]">
                            {a.path_name}
                          </span>
                          <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-150 text-indigo-700 rounded font-bold font-mono text-[9px]">
                            Station {a.station_name}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-xs text-gray-700">
                          <span className={`w-1.5 h-1.5 rounded-full ${isCheckout ? "bg-red-500" : "bg-emerald-500"}`}></span>
                          <p className="font-sans truncate">
                            Status: <span className={`font-bold ${isCheckout ? "text-red-600" : "text-gray-900"}`}>{a.associate_name}</span> 
                            {!isCheckout && <span className="text-gray-400 ml-1.5 font-mono text-[10px]">({a.badge})</span>}
                          </p>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-semibold text-gray-800 font-sans">
                          {getRelativeTime(a.scanned_at)}
                        </p>
                        <p className="text-[9px] text-gray-400 font-mono">
                          {new Date(a.scanned_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: QR Code Generator & Emulation Testing */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white border border-gray-250 rounded-2xl p-5 shadow-3xs space-y-5">
            <div className="flex items-center gap-2 border-b border-gray-150 pb-3">
              <QrCode className="w-5 h-5 text-emerald-600" />
              <h2 className="text-sm font-bold text-gray-800 font-sans uppercase tracking-wider">
                Print QR Station Labels
              </h2>
            </div>

            {/* Select Path & Station Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider block">
                  1. Process Path
                </label>
                <select
                  value={selectedPathName}
                  onChange={(e) => setSelectedPathName(e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded-xl px-3.5 py-2.5 bg-white text-gray-800 cursor-pointer shadow-3xs font-medium focus:ring-1 focus:ring-emerald-500 outline-none"
                >
                  {paths.map(p => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider block">
                  2. Station Number
                </label>
                {availableStations.length === 0 ? (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2 border border-amber-200 font-medium">
                    No active stations.
                  </p>
                ) : (
                  <select
                    value={selectedStationName}
                    onChange={(e) => setSelectedStationName(e.target.value)}
                    className="w-full text-xs border border-gray-200 rounded-xl px-3.5 py-2.5 bg-white text-gray-800 cursor-pointer shadow-3xs font-medium focus:ring-1 focus:ring-emerald-500 outline-none"
                  >
                    {availableStations.map((s, idx) => (
                      <option key={`${s.id}-${idx}`} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Printable QR Split Layout */}
            {selectedPathName && selectedStationName && (
              <div className="space-y-5 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* CHECK-IN CARD */}
                  <div className="bg-slate-50 border border-gray-200 rounded-2xl p-4 flex flex-col items-center justify-between text-center space-y-3 relative">
                    <span className="px-2 py-0.5 bg-emerald-600 text-[8px] font-extrabold tracking-wider text-white rounded font-mono uppercase">
                      Check-In QR
                    </span>

                    <div className="space-y-1">
                      <h4 className="text-[10px] font-mono font-bold text-gray-400 uppercase leading-none">{selectedPathName}</h4>
                      <h3 className="text-md font-extrabold text-gray-950 font-sans uppercase">Station {selectedStationName}</h3>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-gray-150 shadow-3xs">
                      <img
                        src={checkinQrImage}
                        alt="Check-In QR Code"
                        className="w-32 h-32 block mx-auto"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    
                    <p className="text-[8px] text-gray-400 font-mono leading-none break-all">{checkinQrValue}</p>

                    <a
                      href={checkinQrImage}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-gray-700 font-bold rounded-lg text-[10px] uppercase font-mono tracking-wider flex items-center justify-center gap-1 cursor-pointer border-none"
                    >
                      <Download className="w-3 h-3" />
                      <span>Print Check-In</span>
                    </a>
                  </div>

                  {/* CHECK-OUT CARD */}
                  <div className="bg-slate-50 border border-gray-200 rounded-2xl p-4 flex flex-col items-center justify-between text-center space-y-3 relative">
                    <span className="px-2 py-0.5 bg-red-600 text-[8px] font-extrabold tracking-wider text-white rounded font-mono uppercase">
                      Check-Out QR
                    </span>

                    <div className="space-y-1">
                      <h4 className="text-[10px] font-mono font-bold text-gray-400 uppercase leading-none">{selectedPathName}</h4>
                      <h3 className="text-md font-extrabold text-gray-950 font-sans uppercase">Station {selectedStationName}</h3>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-gray-150 shadow-3xs">
                      <img
                        src={checkoutQrImage}
                        alt="Check-Out QR Code"
                        className="w-32 h-32 block mx-auto"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    
                    <p className="text-[8px] text-gray-400 font-mono leading-none break-all">{checkoutQrValue}</p>

                    <a
                      href={checkoutQrImage}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-gray-700 font-bold rounded-lg text-[10px] uppercase font-mono tracking-wider flex items-center justify-center gap-1 cursor-pointer border-none"
                    >
                      <Download className="w-3 h-3" />
                      <span>Print Leave</span>
                    </a>
                  </div>

                </div>

                {/* EMULATION SIMULATOR PANEL */}
                <div className="bg-[#F8FAFC] border-t border-gray-150 p-4 rounded-xl space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="font-bold text-gray-700 uppercase">Interactive Hardware Emulator (Test Without a Scanner)</span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                    <div className="space-y-1">
                      <label className="text-[9px] font-mono font-bold text-gray-400 uppercase tracking-widest block">
                        Assigned Employee Badge or SSO Login
                      </label>
                      <input
                        type="text"
                        value={testBadgeInput}
                        onChange={(e) => setTestBadgeInput(e.target.value)}
                        placeholder="e.g. employee login username"
                        className="w-full p-2 text-xs border border-gray-250 bg-white rounded-lg font-mono focus:outline-emerald-500 focus:outline"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={emulateCheckInSimulation}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 font-bold text-white text-[10px] uppercase font-mono tracking-wider rounded-lg shadow-sm cursor-pointer border-none"
                      >
                        Simulate Check-In
                      </button>
                      
                      <button
                        onClick={emulateLeaveSimulation}
                        className="flex-1 py-2 bg-red-650 hover:bg-red-700 bg-red-600 text-white font-bold text-[10px] uppercase font-mono tracking-wider rounded-lg shadow-sm cursor-pointer border-none"
                      >
                        Simulate Check-Out
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
