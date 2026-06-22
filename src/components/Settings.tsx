import React, { useState, useEffect, useRef } from "react";
import { Path, Associate } from "../types";

const splitCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

interface SettingsProps {
  apiUrl: string;
  userRole: string;
  onAdminChange: (profile: any) => void;
  mockAssocs: Associate[];
  floorPaths: Path[];
  refreshAssociates: () => void;
  isSystemAdmin?: boolean;
  refreshFloorData?: () => void;
}

export function Settings({
  apiUrl,
  userRole,
  onAdminChange,
  mockAssocs,
  floorPaths,
  refreshAssociates,
  isSystemAdmin = false,
  refreshFloorData
}: SettingsProps) {
  if (!isSystemAdmin) {
    return (
      <div className="bg-white rounded-2xl border border-gray-250 p-12 text-center max-w-xl mx-auto shadow-sm my-12 animate-fadeIn">
        <div className="w-16 h-16 bg-red-50 text-red-650 rounded-2xl flex items-center justify-center font-bold text-2xl mx-auto mb-4">
          🔒
        </div>
        <h3 className="text-sm font-bold text-gray-900 mb-2 font-sans tracking-tight uppercase">Access Restricted</h3>
        <p className="text-xs text-gray-400 font-sans leading-relaxed max-w-sm mx-auto">
          The Settings dashboard contains path priority weights, batch CSV uplinks, and terminal user profiles configured for the <strong>System Admin</strong> only.
        </p>
      </div>
    );
  }

  const isAdmin = userRole === "Admin" || isSystemAdmin;
  const [stab, setStab] = useState("priorities");
  const [profiles, setProfiles] = useState<any[]>([]);
  const [newAdmin, setNewAdmin] = useState({ name: "", role: "Manager", login: "", pin: "" });
  const [adminErr, setAdminErr] = useState("");
  
  const [pathPriorities, setPathPriorities] = useState<any[]>([]);
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploadErr, setUploadErr] = useState("");

  const [parsedEmps, setParsedEmps] = useState<any[]>([]);
  const [uploadedPhotos, setUploadedPhotos] = useState<{ [key: string]: string }>({});
  const photosInputRef = useRef<HTMLInputElement>(null);

  const empRef = useRef<HTMLInputElement>(null);
  const permRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${apiUrl}/admin/profiles`).then(r => r.json()).then(data => {
      if (Array.isArray(data)) setProfiles(data);
    }).catch(() => {});
    
    fetch(`${apiUrl}/path-priorities`).then(r => r.json()).then(data => {
      if (Array.isArray(data)) setPathPriorities(data);
    }).catch(() => {});
  }, [apiUrl]);

  const addAdmin = async () => {
    if (!newAdmin.name || !newAdmin.login || !newAdmin.pin) {
      setAdminErr("Fill out all profiles fields.");
      return;
    }
    const res = await fetch(`${apiUrl}/admin/profiles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newAdmin)
    });
    if (res.ok) {
      const updated = await fetch(`${apiUrl}/admin/profiles`).then(r => r.json());
      if (Array.isArray(updated)) setProfiles(updated);
      setNewAdmin({ name: "", role: "Manager", login: "", pin: "" });
      setAdminErr("");
    } else {
      setAdminErr("Error saving profiles username.");
    }
  };

  const removeAdmin = async (id: number) => {
    if (!window.confirm("Remove administrator?")) return;
    await fetch(`${apiUrl}/admin/profiles/${id}`, { method: "DELETE" });
    const updated = await fetch(`${apiUrl}/admin/profiles`).then(r => r.json());
    if (Array.isArray(updated)) setProfiles(updated);
  };

  const updatePathPriority = async (id: number, val: number) => {
    const p = floorPaths.find(f => f.id === id);
    if (p) {
      // Local updates representation immediately
      (p as any).priority = val;
    }
    setPathPriorities(curr => curr.map(item => item.id === id ? { ...item, priority: val } : item));
    await fetch(`${apiUrl}/path-priorities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority: val })
    });
  };

  const updatePathCap = async (id: number, val: number) => {
    const p = floorPaths.find(f => f.id === id);
    if (p) {
      (p as any).rotation_hours = val;
    }
    await fetch(`${apiUrl}/paths/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rotation_hours: val })
    });
    refreshFloorData?.();
  };

  // CSV uplinking and visual photo pairing
  const triggerEmployeeUpload = (csvText: string) => {
    try {
      const lines = csvText.trim().split(/\r?\n/).filter(Boolean);
      if (lines.length <= 1) {
        setUploadErr("CSV doesn't contain any rows or headers.");
        return;
      }
      
      const headers = splitCsvLine(lines[0]).map(h => h.trim().toLowerCase().replace(/['"]/g, ""));
      const badgeIdx = headers.indexOf("badge");
      const loginIdx = headers.indexOf("login");
      const nameIdx = headers.indexOf("name");
      const deptIdx = Math.max(headers.indexOf("department"), headers.indexOf("home_dept"), headers.indexOf("home dept"));
      const shiftIdx = Math.max(headers.indexOf("shiftpattern"), headers.indexOf("shift"), headers.indexOf("shift_code"));
      const mgrIdx = headers.indexOf("manager");

      const parsed: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const row = splitCsvLine(lines[i]).map(v => v.trim().replace(/^["']|["']$/g, ""));
        if (row.length === 0 || !row[0]) continue;
        
        const badge = row[badgeIdx !== -1 ? badgeIdx : 0] || "";
        const login = row[loginIdx !== -1 ? loginIdx : 1] || "";
        const name = row[nameIdx !== -1 ? nameIdx : 2] || "";
        const home_dept = row[deptIdx !== -1 ? deptIdx : 3] || "CRETS Processing Low Side";
        const shift_code = row[shiftIdx !== -1 ? shiftIdx : 4] || "FHD";
        const manager = row[mgrIdx !== -1 ? mgrIdx : 5] || "";

        if (!badge || !login || !name) continue;

        parsed.push({
          badge: badge.trim(),
          login: login.trim().toLowerCase(),
          name: name.trim(),
          home_dept: home_dept.trim(),
          shift_code: shift_code.trim(),
          operation_mode: (home_dept.toLowerCase().includes("outbound") || home_dept.toLowerCase().includes("pick") || home_dept.toLowerCase().includes("pack")) ? "OUTBOUND" : "BOTH",
          manager: manager.trim(),
          photo: null
        });
      }
      
      if (parsed.length === 0) {
        setUploadErr("Could not parse any valid employees. Ensure Badge, Login, and Name columns exist.");
        setParsedEmps([]);
      } else {
        setParsedEmps(parsed);
        setUploadMsg(`Parsed ${parsed.length} employees from CSV. Now you can select/drag photos below, verify them, and click 'Complete Import'.`);
        setUploadErr("");
      }
    } catch (err: any) {
      setUploadErr(`Error parsing Employee CSV: ${err.message}`);
      setParsedEmps([]);
    }
  };

  const handlePhotoFiles = (files: FileList) => {
    setUploadMsg("");
    setUploadErr("");
    const newPhotos = { ...uploadedPhotos };
    let loaded = 0;
    const targetFiles = Array.from(files).filter(f => f.type.startsWith("image/"));
    
    if (targetFiles.length === 0) {
      setUploadErr("No valid image files were selected.");
      return;
    }

    targetFiles.forEach(file => {
      const r = new FileReader();
      r.onload = (e) => {
        const base64 = e.target?.result as string;
        const baseName = file.name.substring(0, file.name.lastIndexOf(".")).toLowerCase().trim();
        newPhotos[baseName] = base64;
        loaded++;
        if (loaded === targetFiles.length) {
          setUploadedPhotos(newPhotos);
          setUploadMsg(`Processed ${Object.keys(newPhotos).length} photos for employee identity mapping.`);
        }
      };
      r.readAsDataURL(file);
    });
  };

  const handleCommitBulkImport = async () => {
    setUploadMsg("");
    setUploadErr("");
    
    if (parsedEmps.length === 0) {
      setUploadErr("Please upload an Employee CSV file first.");
      return;
    }

    const finalAssociates = parsedEmps.map(emp => {
      const keyLogin = emp.login.toLowerCase().trim();
      const keyBadge = emp.badge.trim();
      const matchedPhoto = uploadedPhotos[keyLogin] || uploadedPhotos[keyBadge] || null;
      return {
        ...emp,
        photo: matchedPhoto
      };
    });

    try {
      const res = await fetch(`${apiUrl}/associates/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ associates: finalAssociates })
      });

      if (!res.ok) {
        throw new Error("Bulk import failed on server.");
      }

      if (Object.keys(uploadedPhotos).length > 0) {
        await fetch(`${apiUrl}/associates/photos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photos: uploadedPhotos })
        });
      }

      setUploadMsg(`🎉 Successfully imported ${finalAssociates.length} employees and paired ${finalAssociates.filter(a => a.photo).length} photo files to registration database!`);
      setParsedEmps([]);
      setUploadedPhotos({});
      refreshAssociates();
    } catch (err: any) {
      setUploadErr(`Import Error: ${err.message}`);
    }
  };

  const triggerPermissionUpload = async (csvText: string) => {
    try {
      const lines = csvText.trim().split(/\r?\n/).filter(Boolean);
      if (lines.length <= 1) {
        setUploadErr("CSV doesn't contain any certification rows.");
        return;
      }

      const headers = splitCsvLine(lines[0]).map(h => h.trim().toLowerCase().replace(/['"]/g, ""));
      const badgeIdx = headers.indexOf("badge");
      const pathIdx = Math.max(headers.indexOf("path name"), headers.indexOf("path_name"), headers.indexOf("path"));
      const levelIdx = Math.max(headers.indexOf("lc level"), headers.indexOf("lc_level"), headers.indexOf("level"));

      const certifications: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const row = splitCsvLine(lines[i]).map(v => v.trim().replace(/^["']|["']$/g, ""));
        if (row.length === 0 || !row[0]) continue;

        const badge = row[badgeIdx !== -1 ? badgeIdx : 0] || "";
        const path_name = row[pathIdx !== -1 ? pathIdx : 1] || "";
        const lc_level = row[levelIdx !== -1 ? levelIdx : 2] || "1";

        if (!badge || !path_name) continue;
        certifications.push({
          badge: badge.trim(),
          path_name: path_name.trim(),
          lc_level: parseInt(lc_level) || 1
        });
      }

      if (certifications.length === 0) {
        setUploadErr("Could not parse any certifications. Ensure Badge, 'Path Name', and 'LC Level' exist.");
        return;
      }

      const res = await fetch(`${apiUrl}/permissions/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ certifications })
      });

      if (res.ok) {
        const rJson = await res.json();
        setUploadMsg(`✅ Successfully uploaded and mapped ${rJson.count || certifications.length} licenses / learning curves to registered workers.`);
        setUploadErr("");
        refreshAssociates();
      } else {
        throw new Error("Persist certifications failed.");
      }
    } catch (err: any) {
      setUploadErr(`Certifications Upload Error: ${err.message}`);
    }
  };

  const inPriorities = pathPriorities.filter(p => p.mode === "INBOUND" || p.mode === "BOTH").sort((a,b) => b.priority - a.priority);
  const outPriorities = pathPriorities.filter(p => p.mode === "OUTBOUND" || p.mode === "BOTH").sort((a,b) => b.priority - a.priority);

  return (
    <div className="space-y-6">
      <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200 overflow-hidden w-fit font-mono text-[10px] uppercase font-bold">
        {[
          { id: "priorities", l: "🎯 Path Weights" },
          { id: "caps", l: "⏱️ Path Cap" },
          { id: "csv", l: "📤 Batch CSV Uplink" },
          { id: "admins", l: "👤 Terminal Users" }
        ].map(t => (
          <button 
            key={t.id} 
            onClick={() => setStab(t.id)}
            className={`px-4 py-2 text-xs font-semibold rounded-lg border-none cursor-pointer transition-colors ${
              stab === t.id ? "bg-white text-indigo-700 shadow-xs" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            {t.l}
          </button>
        ))}
      </div>

      {stab === "priorities" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
          {/* Inbound weights */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-3xs overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-150 bg-[#EEF2FF] text-xs font-bold text-indigo-800 uppercase tracking-widest font-mono">
              Inbound Path Weights
            </div>
            
            <div className="p-4 space-y-3.5 divide-y divide-gray-100">
              {(inPriorities.length ? inPriorities : floorPaths.filter(p => p.department === "INBOUND")).map((p: any) => (
                <div key={p.id} className="flex justify-between items-center pt-3.5 first:pt-0">
                  <span className="text-xs font-semibold text-gray-800">{p.name}</span>
                  <div className="flex items-center gap-2">
                    <input 
                      type="range" 
                      min="1" 
                      max="10" 
                      value={p.priority || 5} 
                      onChange={e => updatePathPriority(p.id, parseInt(e.target.value))} 
                      className="accent-indigo-600 h-1 cursor-pointer bg-gray-150 rounded"
                    />
                    <span className="text-xs font-mono font-bold text-indigo-700 w-6 text-right">
                      {p.priority || 5}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Outbound weights */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-3xs overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-150 bg-[#FFF7ED] text-xs font-bold text-orange-800 uppercase tracking-widest font-mono">
              Outbound Path Weights
            </div>

            <div className="p-4 space-y-3.5 divide-y divide-gray-100">
              {(outPriorities.length ? outPriorities : floorPaths.filter(p => p.department === "OUTBOUND")).map((p: any) => (
                <div key={p.id} className="flex justify-between items-center pt-3.5 first:pt-0">
                  <span className="text-xs font-semibold text-gray-800">{p.name}</span>
                  <div className="flex items-center gap-2">
                    <input 
                      type="range" 
                      min="1" 
                      max="10" 
                      value={p.priority || 5} 
                      onChange={e => updatePathPriority(p.id, parseInt(e.target.value))} 
                      className="accent-indigo-600 h-1 cursor-pointer bg-gray-150 rounded"
                    />
                    <span className="text-xs font-mono font-bold text-indigo-700 w-6 text-right">
                      {p.priority || 5}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {stab === "csv" && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-3xs space-y-6 animate-fadeIn">
          {uploadMsg && <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl p-3 text-xs font-mono font-medium">{uploadMsg}</div>}
          {uploadErr && <div className="bg-red-50 border border-red-150 text-red-700 rounded-xl p-3 text-xs font-mono font-medium">{uploadErr}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Step 1: Upload CSV */}
            <div className="border border-gray-200 p-5 rounded-xl space-y-3 bg-gray-50/20">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono block">Step 1: Upload Employee Registry CSV</span>
              <h4 className="text-xs font-bold text-gray-800">Assign Workers List</h4>
              <p className="text-[10px] text-gray-400 font-mono leading-relaxed">
                Accepts standard column headers: <strong className="text-indigo-600">Badge, Login, Name, Department (Home Dept), Manager</strong>
              </p>
              
              <input ref={empRef} type="file" accept=".csv" className="hidden" onChange={e => {
                const file = e.target.files?.[0];
                if (file) {
                  const r = new FileReader();
                  r.onload = ev => triggerEmployeeUpload(ev.target?.result as string);
                  r.readAsText(file);
                }
              }} />
              
              <div className="flex gap-2">
                <button 
                  onClick={() => empRef.current?.click()} 
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs cursor-pointer border-none shadow-3xs uppercase font-mono transition-colors"
                >
                  {parsedEmps.length > 0 ? "Change CSV File" : "Choose CSV File"}
                </button>
                {parsedEmps.length > 0 && (
                  <span className="text-xs font-mono font-bold text-emerald-600 flex items-center">
                    ✓ {parsedEmps.length} workers loaded
                  </span>
                )}
              </div>
            </div>

            {/* Step 2: Upload Photos */}
            <div className={`border p-5 rounded-xl space-y-3 transition-colors ${parsedEmps.length > 0 ? 'border-indigo-150 bg-indigo-55/5' : 'border-gray-250 bg-gray-100/10 opacity-70'}`}>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono block">Step 2: Upload Worker Photos</span>
              <h4 className="text-xs font-bold text-gray-800">Visual Identification File Bin</h4>
              <p className="text-[10px] text-gray-400 font-mono leading-relaxed">
                Choose multiple JPG/PNG images. Filename must match <strong className="text-indigo-600">login</strong> or <strong className="text-indigo-600">badge</strong> (e.g., <code className="bg-gray-150 px-1 py-0.5 rounded text-gray-700">jsmith.jpg</code> or <code className="bg-gray-150 px-1 py-0.5 rounded text-gray-700">101181.png</code>).
              </p>
              
              <input 
                ref={photosInputRef} 
                type="file" 
                accept="image/*" 
                multiple 
                className="hidden" 
                onChange={e => {
                  if (e.target.files) {
                    handlePhotoFiles(e.target.files);
                  }
                }} 
              />
              
              <div className="flex gap-2">
                <button 
                  disabled={parsedEmps.length === 0}
                  onClick={() => photosInputRef.current?.click()} 
                  className={`px-3.5 py-2 font-semibold rounded-lg text-xs cursor-pointer border shadow-3xs uppercase font-mono transition-colors ${
                    parsedEmps.length > 0 
                      ? "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 shadow-3xs" 
                      : "bg-gray-55 border-gray-200 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  Choose Photo Files
                </button>
                {Object.keys(uploadedPhotos).length > 0 && (
                  <span className="text-xs font-mono font-bold text-indigo-600 flex items-center">
                    📷 {Object.keys(uploadedPhotos).length} file(s) loaded
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Parsed Employees and Photo Matching Preview */}
          {parsedEmps.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-gray-150 animate-fadeIn">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <div>
                  <h4 className="text-xs font-bold text-gray-900 uppercase tracking-tight font-sans">Bulk Import Pairing Sandbox</h4>
                  <p className="text-[10.5px] text-gray-400 font-medium font-sans">Verify employee records and matched visual photos before saving them permanently.</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={handleCommitBulkImport}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer border-none shadow-xs uppercase font-mono transition-all"
                  >
                    Confirm & Complete Import
                  </button>
                  <button 
                    onClick={() => {
                      setParsedEmps([]);
                      setUploadedPhotos({});
                      setUploadMsg("");
                    }}
                    className="px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                  >
                    Discard Batch
                  </button>
                </div>
              </div>

              <div className="max-h-[300px] overflow-y-auto border border-gray-200 rounded-xl bg-gray-50/50">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-gray-50">
                    <tr className="bg-gray-100/70 text-[8.5px] font-bold text-gray-500 uppercase tracking-widest font-mono border-b border-gray-200">
                      <th className="py-2 px-3 w-12">Photo</th>
                      <th className="py-2 px-3">Name</th>
                      <th className="py-2 px-3">Login</th>
                      <th className="py-2 px-3">Badge ID</th>
                      <th className="py-2 px-3">Home Department</th>
                      <th className="py-2 px-3">Shift</th>
                      <th className="py-2 px-3">Supervisor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parsedEmps.map((emp, idx) => {
                      const lowerLogin = emp.login.toLowerCase().trim();
                      const lowerBadge = emp.badge.trim();
                      const matchedBase64 = uploadedPhotos[lowerLogin] || uploadedPhotos[lowerBadge];
                      return (
                        <tr key={idx} className="hover:bg-white bg-white/50 transition-colors">
                          <td className="py-2 px-3">
                            <div className="w-8 h-8 rounded-full border border-gray-200 bg-white overflow-hidden flex items-center justify-center">
                              {matchedBase64 ? (
                                <img src={matchedBase64} alt={emp.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <span className="text-[10px] uppercase font-mono font-bold text-gray-400">?</span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3 font-bold text-gray-900">{emp.name}</td>
                          <td className="py-2 px-3 font-mono text-[11px] text-gray-500">@{emp.login}</td>
                          <td className="py-2 px-3 font-mono text-[11px] text-gray-600 font-bold">{emp.badge}</td>
                          <td className="py-2 px-3 text-gray-500 truncate max-w-[120px]">{emp.home_dept}</td>
                          <td className="py-2 px-3 font-mono text-[10px] font-bold uppercase text-indigo-700 bg-indigo-50/50 px-1.5 py-0.5 rounded w-fit">{emp.shift_code}</td>
                          <td className="py-2 px-3 text-gray-400 truncate max-w-[100px]">{emp.manager || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Certifications Box */}
          <div className="border border-gray-200 p-5 rounded-xl space-y-3 bg-gray-50/10">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono block">Certifications Matrix</span>
            <h4 className="text-xs font-bold text-gray-800">Employee Certifications Matrix</h4>
            <p className="text-[10px] text-gray-400 font-mono leading-relaxed">
              Accepts: <strong className="text-indigo-650">Badge, Path Name, LC Level</strong>
            </p>
            <input ref={permRef} type="file" accept=".csv" className="hidden" onChange={e => {
              const file = e.target.files?.[0];
              if (file) {
                const r = new FileReader();
                r.onload = ev => triggerPermissionUpload(ev.target?.result as string);
                r.readAsText(file);
              }
            }} />
            <button onClick={() => permRef.current?.click()} className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs cursor-pointer border-none shadow-3xs uppercase font-mono transition-colors">
              Upload Certification CSV
            </button>
          </div>
        </div>
      )}

      {stab === "caps" && (
        <div className="bg-white border border-gray-250 rounded-2xl shadow-3xs overflow-hidden animate-fadeIn">
          <div className="px-5 py-4 border-b border-gray-150 bg-[#F8FAFC] flex justify-between items-center bg-gray-50/50">
            <div>
              <h3 className="text-sm font-bold text-gray-900 font-sans tracking-tight uppercase">Daily Path Rotation Caps</h3>
              <p className="text-[11px] text-gray-400 font-sans mt-0.5">Define maximum hours an associate can work in each path before rotation triggers.</p>
            </div>
            <span className="text-[10px] bg-[#EEF2FF] border border-indigo-100 text-indigo-700 font-mono font-bold px-2.5 py-0.5 rounded-full uppercase">
              System Admin Control
            </span>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Inbound Paths */}
              <div className="space-y-4">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2">
                  📥 Inbound Paths
                </div>
                <div className="space-y-3">
                  {floorPaths.filter(p => p.department === "INBOUND").map((p: any) => {
                    const currentHours = p.rotation_hours !== undefined ? p.rotation_hours : 10;
                    return (
                      <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-gray-50/50 hover:bg-gray-50 border border-gray-100 rounded-xl transition-all gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-gray-800 truncate">{p.name}</div>
                          <div className="text-[9px] text-gray-400 font-semibold font-mono mt-0.5 flex items-center gap-1.5">
                            <span className={`px-1.5 py-0.5 border rounded uppercase text-[8px] font-bold ${
                              (currentHours <= 5 || p.role_type === "INDIRECT")
                                ? "bg-purple-100/40 border-purple-200 text-purple-700 font-sans font-bold"
                                : "bg-emerald-100/40 border-emerald-200 text-emerald-800 font-sans font-bold"
                            }`}>
                              {(currentHours <= 5 || p.role_type === "INDIRECT") ? "INDIRECT" : "DIRECT"}
                            </span>
                            <span>ID: {p.id}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => updatePathCap(p.id, 5)}
                            className={`px-3 py-1 text-[10px] font-bold font-mono rounded-lg border transition-all cursor-pointer ${
                              currentHours === 5
                                ? "bg-red-50 text-red-600 border-red-200 shadow-3xs"
                                : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                            }`}
                          >
                            5 Hours
                          </button>
                          <button
                            onClick={() => updatePathCap(p.id, 10)}
                            className={`px-3 py-1 text-[10px] font-bold font-mono rounded-lg border transition-all cursor-pointer ${
                              currentHours === 10
                                ? "bg-indigo-50 text-indigo-700 border-indigo-200 shadow-3xs"
                                : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                            }`}
                          >
                            10 Hours
                          </button>
                          
                          {/* Custom Option input */}
                          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white h-[26px]">
                            <input
                              type="number"
                              min="1"
                              max="24"
                              value={currentHours !== 5 && currentHours !== 10 ? currentHours : ""}
                              placeholder="Cut"
                              onChange={e => {
                                const val = parseInt(e.target.value);
                                if (val > 0 && val <= 24) {
                                  updatePathCap(p.id, val);
                                }
                              }}
                              className="w-10 text-[10px] text-center font-bold font-mono text-gray-700 h-full border-none focus:outline-none p-0 bg-transparent"
                            />
                            <span className="text-[9px] text-gray-400 font-mono pr-1.5 select-none h-full flex items-center bg-gray-50/50 leading-none">hr</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Outbound Paths */}
              <div className="space-y-4">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2">
                  📤 Outbound Paths
                </div>
                <div className="space-y-3">
                  {floorPaths.filter(p => p.department === "OUTBOUND").map((p: any) => {
                    const currentHours = p.rotation_hours !== undefined ? p.rotation_hours : 10;
                    return (
                      <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-gray-50/50 hover:bg-gray-50 border border-gray-100 rounded-xl transition-all gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-gray-800 truncate">{p.name}</div>
                          <div className="text-[9px] text-gray-400 font-semibold font-mono mt-0.5 flex items-center gap-1.5">
                            <span className={`px-1.5 py-0.5 border rounded uppercase text-[8px] font-bold ${
                              (currentHours <= 5 || p.role_type === "INDIRECT")
                                ? "bg-purple-100/40 border-purple-200 text-purple-700 font-sans font-bold"
                                : "bg-emerald-100/40 border-emerald-200 text-emerald-800 font-sans font-bold"
                            }`}>
                              {(currentHours <= 5 || p.role_type === "INDIRECT") ? "INDIRECT" : "DIRECT"}
                            </span>
                            <span>ID: {p.id}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => updatePathCap(p.id, 5)}
                            className={`px-3 py-1 text-[10px] font-bold font-mono rounded-lg border transition-all cursor-pointer ${
                              currentHours === 5
                                ? "bg-red-50 text-red-600 border-red-200 shadow-3xs"
                                : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                            }`}
                          >
                            5 Hours
                          </button>
                          <button
                            onClick={() => updatePathCap(p.id, 10)}
                            className={`px-3 py-1 text-[10px] font-bold font-mono rounded-lg border transition-all cursor-pointer ${
                              currentHours === 10
                                ? "bg-indigo-50 text-indigo-700 border-indigo-200 shadow-3xs"
                                : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                            }`}
                          >
                            10 Hours
                          </button>
                          
                          {/* Custom Option input */}
                          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white h-[26px]">
                            <input
                              type="number"
                              min="1"
                              max="24"
                              value={currentHours !== 5 && currentHours !== 10 ? currentHours : ""}
                              placeholder="Cut"
                              onChange={e => {
                                const val = parseInt(e.target.value);
                                if (val > 0 && val <= 24) {
                                  updatePathCap(p.id, val);
                                }
                              }}
                              className="w-10 text-[10px] text-center font-bold font-mono text-gray-700 h-full border-none focus:outline-none p-0 bg-transparent"
                            />
                            <span className="text-[9px] text-gray-400 font-mono pr-1.5 select-none h-full flex items-center bg-gray-50/50 leading-none">hr</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {stab === "admins" && (
        <div className="space-y-6">
          {isAdmin && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-3xs space-y-4">
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-widest font-mono">New Admin Account Detail</h4>
              {adminErr && <p className="text-xs text-red-500 font-mono">{adminErr}</p>}
              
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input type="text" placeholder="Full Name" value={newAdmin.name} onChange={e => setNewAdmin({...newAdmin, name: e.target.value})} className="p-2 border border-gray-200 rounded-lg text-xs bg-gray-55" />
                <input type="text" placeholder="Login Username" value={newAdmin.login} onChange={e => setNewAdmin({...newAdmin, login: e.target.value})} className="p-2 border border-gray-200 rounded-lg text-xs bg-gray-55" />
                <input type="password" placeholder="Numeric PIN (e.g. 1234)" value={newAdmin.pin} onChange={e => setNewAdmin({...newAdmin, pin: e.target.value})} className="p-2 border border-gray-200 rounded-lg text-xs bg-gray-55" />
                <select value={newAdmin.role} onChange={e => setNewAdmin({...newAdmin, role: e.target.value})} className="p-2 border border-gray-200 rounded-lg text-xs bg-white text-gray-700 font-medium">
                  <option value="Admin">Admin</option>
                  <option value="Manager">Manager</option>
                  <option value="Admin PA">Admin PA</option>
                  <option value="Area Manager">Area Manager</option>
                  <option value="Sr. Manager">Sr. Manager</option>
                </select>
              </div>

              <button onClick={addAdmin} className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer border-none shadow-3xs uppercase font-mono transition-colors">Add Profile</button>
            </div>
          )}

          <div className="space-y-3.5">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest font-mono block">Registered Console Administrators</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {profiles.map(p => (
                <div key={p.id} className="bg-white border border-gray-200 rounded-2xl p-4.5 shadow-3xs flex justify-between items-center text-xs">
                  <div>
                    <div className="font-bold text-gray-950">{p.name}</div>
                    <div className="text-[10px] text-gray-400 font-mono mt-0.5">@{p.login} · {p.role}</div>
                  </div>
                  {isAdmin && (
                    <button onClick={() => removeAdmin(p.id)} className="text-[10px] font-bold text-red-500 hover:text-red-700 cursor-pointer bg-none border-none">✕ Remove</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
