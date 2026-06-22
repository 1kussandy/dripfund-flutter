import React, { useState } from "react";
import { Trash2, Check, Clock, Calendar, BookmarkPlus, FolderOpen, AlertCircle } from "lucide-react";
import { formatLocalDate } from "../types";

interface SavedLayout {
  id: string;
  title: string;
  date: string;
  shift: string;
  dept: string;
  lineOverrides: any;
  stationOverrides: any;
  savedAt: number;
}

interface SavedPrestaffFloorProps {
  staffDate: Date | string;
  shiftType: string;
  dept: string;
  dateLineOverrides: any;
  dateStationOverrides: any;
  savedPrestaffedLayouts: SavedLayout[];
  onUpdateLayouts: (newLayouts: SavedLayout[]) => void;
  onApplyOverrides: (lineOverrides: any, stationOverrides: any) => void;
  onSetPreStaffMode: (on: boolean) => void;
}

export function SavedPrestaffFloor({
  staffDate,
  shiftType,
  dept,
  dateLineOverrides,
  dateStationOverrides,
  savedPrestaffedLayouts = [],
  onUpdateLayouts,
  onApplyOverrides,
  onSetPreStaffMode,
}: SavedPrestaffFloorProps) {
  const [newTitle, setNewTitle] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [errMsg, setErrMsg] = useState("");

  const activeDateStr = formatLocalDate(staffDate);

  // Calculate disabled lines/stations count inside the current live state
  const getCurrentActiveOverridesCount = () => {
    let lineCount = 0;
    let stationCount = 0;

    const lineData = dateLineOverrides[activeDateStr] || {};
    const stationData = dateStationOverrides[activeDateStr] || {};

    Object.values(lineData).forEach((override: any) => {
      if (override.half1 === false || override.half2 === false) {
        lineCount++;
      }
    });

    Object.values(stationData).forEach((override: any) => {
      if (override.active_half1 === false || override.active_half2 === false) {
        stationCount++;
      }
    });

    return { linesDisabled: lineCount, stationsDisabled: stationCount };
  };

  const { linesDisabled, stationsDisabled } = getCurrentActiveOverridesCount();

  const handleSaveCurrent = (e: React.FormEvent) => {
    e.preventDefault();
    setErrMsg("");
    setStatusMsg("");

    if (!newTitle.trim()) {
      setErrMsg("Please provide a name/title for the preset layout.");
      return;
    }

    const currentLineOverrides = dateLineOverrides[activeDateStr] || {};
    const currentStationOverrides = dateStationOverrides[activeDateStr] || {};

    const hasAnyOverride =
      Object.keys(currentLineOverrides).length > 0 ||
      Object.keys(currentStationOverrides).length > 0;

    if (!hasAnyOverride) {
      setErrMsg("The current floor map has no offline/inactive overrides configured to capture. Configure them under Floor Map first!");
      return;
    }

    const nextLayout: SavedLayout = {
      id: Math.random().toString(36).substring(2, 11),
      title: newTitle.trim(),
      date: activeDateStr,
      shift: shiftType,
      dept: dept,
      lineOverrides: JSON.parse(JSON.stringify(currentLineOverrides)),
      stationOverrides: JSON.parse(JSON.stringify(currentStationOverrides)),
      savedAt: Date.now(),
    };

    const updated = [nextLayout, ...savedPrestaffedLayouts];
    onUpdateLayouts(updated);
    setNewTitle("");
    setStatusMsg(`Successfully captured layout preset "${nextLayout.title}"!`);
  };

  const handleDelete = (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete preset "${title}" permanently?`)) return;
    const updated = savedPrestaffedLayouts.filter(l => l.id !== id);
    onUpdateLayouts(updated);
  };

  const handleLoadLayout = (layout: SavedLayout) => {
    if (!window.confirm(`Load preset "${layout.title}" into the current active date (${activeDateStr}) and shift (${shiftType})? This will apply its saved overrides.`)) {
      return;
    }

    // Apply the overrides to current selection inside App.tsx state
    onApplyOverrides(layout.lineOverrides, layout.stationOverrides);

    // Turn pre-staff mode ON so the overrides take effect instantly
    onSetPreStaffMode(true);

    setStatusMsg(`Loaded layout preset "${layout.title}" successfully into current dashboard settings, activating Pre-Staff mode!`);
  };

  const countPresetOverrides = (layout: SavedLayout) => {
    let lines = 0;
    let stations = 0;

    Object.values(layout.lineOverrides || {}).forEach((ov: any) => {
      if (ov.half1 === false || ov.half2 === false) lines++;
    });

    Object.values(layout.stationOverrides || {}).forEach((ov: any) => {
      if (ov.active_half1 === false || ov.active_half2 === false) stations++;
    });

    return { lines, stations };
  };

  return (
    <div className="space-y-6" id="saved-prestaff-tab">
      {/* Informative Header / Guide Card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-3xs flex justify-between items-start flex-wrap gap-6">
        <div className="space-y-2 flex-1 min-w-[280px]">
          <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest font-mono block">Layout Templates Control</span>
          <h2 className="text-lg font-extrabold text-gray-900 tracking-tight">Saved Prestaffed Floor Preset Vault</h2>
          <p className="text-xs text-gray-500 leading-relaxed max-w-2xl">
            Pre-staffing allows managers to safely preset offline stations and lines before shifts start. Use this control panel to instantly save current map override structures, clear clutter, or load custom floor presets onto any future shift calendar.
          </p>
        </div>
        <div className="bg-indigo-50 border border-indigo-150 rounded-xl p-4 flex gap-3 max-w-sm items-start">
          <FolderOpen className="text-indigo-600 w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-indigo-950 font-sans">Active Configuration Info</h4>
            <p className="text-[10.5px] text-indigo-700 leading-normal mt-1 font-medium">
              Target Selection: <strong className="font-extrabold">{activeDateStr}</strong> | Shift: <strong className="font-extrabold">{shiftType}</strong>
            </p>
            <p className="text-[10px] text-indigo-500 leading-normal mt-0.5 font-semibold font-mono">
              Captured overrides pending: {linesDisabled} Line(s), {stationsDisabled} Station(s).
            </p>
          </div>
        </div>
      </div>

      {statusMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs font-bold flex items-center gap-2.5 shadow-3xs">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {errMsg && (
        <div className="bg-rose-50 border border-rose-250 text-rose-800 p-4 rounded-xl text-xs font-bold flex items-center gap-2.5 shadow-3xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errMsg}</span>
        </div>
      )}

      {/* Save Creator & Presets Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Creator panel */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-3xs h-fit space-y-4">
          <div className="border-b border-gray-100 pb-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-900 font-sans">Preset Creator</h3>
            <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">Capture current floor's disable overrides as a named template.</p>
          </div>

          <form onSubmit={handleSaveCurrent} className="space-y-4">
            <div className="space-y-1.5Packed">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Layout Preset Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder='e.g., "Monday FHD Preset"'
                className="w-full px-3 py-2 text-xs font-semibold bg-gray-50 border border-gray-250 rounded-xl outline-indigo-500 font-sans"
              />
            </div>

            <div className="bg-gray-50/50 p-3.5 border border-gray-250/70 rounded-xl space-y-2 text-[11px] text-gray-600 leading-normal">
              <div className="flex justify-between">
                <span>Active Target Date:</span>
                <strong className="font-bold text-gray-900">{activeDateStr}</strong>
              </div>
              <div className="flex justify-between">
                <span>Active Target Shift:</span>
                <strong className="font-bold text-gray-900">{shiftType}</strong>
              </div>
              <div className="flex justify-between">
                <span>Current Department:</span>
                <strong className="font-bold text-indigo-600">{dept}</strong>
              </div>
              <div className="border-t border-gray-150 pt-2 flex justify-between font-mono font-bold text-[10px]">
                <span>Lines Captured:</span>
                <span className="text-gray-900">{linesDisabled}</span>
              </div>
              <div className="flex justify-between font-mono font-bold text-[10px]">
                <span>Stations Captured:</span>
                <span className="text-gray-900">{stationsDisabled}</span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer font-sans transition-all shadow-3xs flex items-center justify-center gap-2 border-none"
            >
              <Trash2 className="w-3.5 h-3.5 hidden" /> {/* spacer mock override */}
              <BookmarkPlus className="w-4 h-4 shrink-0" />
              <span>Capture & Save Floor</span>
            </button>
          </form>
        </div>

        {/* Right Columns: Presets vault display */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center px-1">
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-900 font-sans">Available Templates ({savedPrestaffedLayouts.length})</h3>
              <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">Choose a previously saved configuration preset to instantly apply.</p>
            </div>
          </div>

          {savedPrestaffedLayouts.length === 0 ? (
            <div className="bg-white border border-gray-200 border-dashed rounded-2xl py-12 px-6 text-center space-y-3">
              <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-400">
                💾
              </div>
              <div>
                <h4 className="text-xs font-bold text-gray-700 font-sans">No Presets Saved Yet</h4>
                <p className="text-[11px] text-gray-400 max-w-sm mx-auto mt-1 leading-relaxed">
                  Go to the <strong>Floor Map</strong>, toggle on **Pre-Staff mode**, disable specific stations/lines for any day, and then save them here as templates!
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedPrestaffedLayouts.map(layout => {
                const { lines, stations } = countPresetOverrides(layout);
                return (
                  <div key={layout.id} className="bg-white border border-gray-250 hover:border-indigo-300 rounded-2xl p-4 shadow-3xs flex flex-col justify-between transition-all group">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start gap-3">
                        <div>
                          <h4 className="text-xs font-extrabold text-gray-900 font-sans group-hover:text-indigo-600 transition-colors leading-tight">{layout.title}</h4>
                          <span className="text-[9.5px] text-gray-400 font-mono mt-0.5 block">Preset ID: {layout.id}</span>
                        </div>
                        <button
                          onClick={() => handleDelete(layout.id, layout.title)}
                          className="p-1.5 text-gray-400 hover:text-red-650 hover:bg-red-50 rounded-lg cursor-pointer transition-colors border-none"
                          title="Delete preset"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="border-t border-b border-gray-100 py-2.5 grid grid-cols-3 gap-2 font-mono text-[10px] font-bold text-gray-500">
                        <div>
                          <span className="text-[8px] text-gray-400 uppercase tracking-wider block">Date</span>
                          <span className="text-gray-800 leading-normal mt-0.5 block">{layout.date}</span>
                        </div>
                        <div>
                          <span className="text-[8px] text-gray-400 uppercase tracking-wider block">Shift</span>
                          <span className="text-gray-850 leading-normal mt-0.5 block">{layout.shift || "DAY"}</span>
                        </div>
                        <div>
                          <span className="text-[8px] text-gray-400 uppercase tracking-wider block">Dept</span>
                          <span className="text-indigo-600 leading-normal mt-0.5 block">{layout.dept || "INBOUND"}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3.5 text-[11px] font-medium text-gray-650">
                        <span className="flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span><strong>{lines}</strong> lines inactive</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span><strong>{stations}</strong> stations offline</span>
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => handleLoadLayout(layout)}
                        className="w-full py-2 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-xl text-[11px] font-bold cursor-pointer font-sans transition-all flex items-center justify-center gap-1.5 border-none"
                      >
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>Load & Apply Override</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
