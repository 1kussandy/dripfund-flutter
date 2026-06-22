import { useState, useEffect, useRef } from "react";
import { Associate, StationAssignment, Path, Line, Station, formatLocalDate } from "./types";

import { AdminGate } from "./components/AdminGate";
import { Kiosk } from "./components/Kiosk";
import { Dashboard } from "./components/Dashboard";
import { FloorMap } from "./components/FloorMap";
import { Permissions } from "./components/Permissions";
import { Associates } from "./components/Associates";
import { AssignHistory } from "./components/History";
import { SearchLookup } from "./components/Lookup";
import { Report } from "./components/Report";
import { Performance } from "./components/Performance";
import { Alerts } from "./components/Alerts";
import { Leaderboard } from "./components/Leaderboard";
import { Settings } from "./components/Settings";
import { LaborShare } from "./components/LaborShare";
import { SavedPrestaffFloor } from "./components/SavedPrestaffFloor";
import { SPPRTab } from "./components/SPPRTab";
import { StationAudit } from "./components/StationAudit";
import { ScanStationLanding } from "./components/ScanStationLanding";

const API = "/api";

// Shared common helper layout configurations
const INIT_PATHS: Path[] = [
  { id: 1, name: "CRETS Processing Low Side", role_type: "DIRECT", department: "INBOUND", rotation_hours: 10 },
  { id: 2, name: "CRETS Processing High Side", role_type: "DIRECT", department: "INBOUND", rotation_hours: 5 },
  { id: 3, name: "WHD Processing", role_type: "DIRECT", department: "INBOUND" },
  { id: 4, name: "Refurb Processing", role_type: "DIRECT", department: "INBOUND" },
  { id: 5, name: "Tech Grading", role_type: "DIRECT", department: "INBOUND" },
  { id: 6, name: "IB Problem Solve", role_type: "DIRECT", department: "INBOUND" },
  { id: 7, name: "IB Super Solver", role_type: "DIRECT", department: "INBOUND" },
  { id: 8, name: "IB Waterspider", role_type: "INDIRECT", department: "INBOUND" },
  { id: 9, name: "Downstacker", role_type: "INDIRECT", department: "INBOUND" },
  { id: 10, name: "IB Unloader", role_type: "INDIRECT", department: "INBOUND" },
  { id: 11, name: "Upstacker", role_type: "INDIRECT", department: "INBOUND" },
  { id: 12, name: "IB Cage Builder", role_type: "INDIRECT", department: "INBOUND" },
  { id: 13, name: "Pick Driver", role_type: "DIRECT", department: "OUTBOUND" },
  { id: 14, name: "Stow Driver", role_type: "DIRECT", department: "OUTBOUND" },
  { id: 15, name: "Rebin Processing", role_type: "DIRECT", department: "OUTBOUND" },
  { id: 16, name: "Pack Processing", role_type: "DIRECT", department: "OUTBOUND" },
  { id: 17, name: "OB Problem Solve", role_type: "DIRECT", department: "OUTBOUND" },
  { id: 18, name: "OB Super Solver", role_type: "DIRECT", department: "OUTBOUND" },
  { id: 19, name: "OB Waterspider", role_type: "INDIRECT", department: "OUTBOUND" },
  { id: 20, name: "OB Unloader", role_type: "INDIRECT", department: "OUTBOUND" },
  { id: 21, name: "OB Cage Builder", role_type: "INDIRECT", department: "OUTBOUND" }
];

const INIT_LINES: Line[] = [
  { id: 1, path_id: 1, name: "Line 1", active: true, active_half1: true, active_half2: true },
  { id: 2, path_id: 1, name: "Line 2", active: true, active_half1: true, active_half2: true },
  { id: 3, path_id: 1, name: "Line 3", active: true, active_half1: true, active_half2: true },
  { id: 4, path_id: 1, name: "Line 4", active: true, active_half1: true, active_half2: true },
  { id: 5, path_id: 1, name: "Line 5", active: true, active_half1: true, active_half2: true },
  { id: 6, path_id: 1, name: "Line 6", active: true, active_half1: true, active_half2: true },
  { id: 7, path_id: 1, name: "Line 7", active: true, active_half1: true, active_half2: true },
  { id: 8, path_id: 1, name: "Line 8", active: true, active_half1: true, active_half2: true },
  { id: 9, path_id: 2, name: "High Side Line 1", active: true, active_half1: true, active_half2: true },
  { id: 10, path_id: 2, name: "High Side Line 2", active: true, active_half1: true, active_half2: true }
];

const INIT_STATIONS: Station[] = [];
// Generate Stations
for (let line = 1; line <= 8; line++) {
  for (let s = 1; s <= 8; s++) {
    INIT_STATIONS.push({
      id: (line * 100) + s,
      line_id: line,
      path_id: 1,
      name: `${line}-${s * 2 - 1}`,
      side: "ODD",
      station_number: s * 2 - 1,
      active: true,
      active_half1: true,
      active_half2: true,
      status: "OPERATIONAL"
    });
    INIT_STATIONS.push({
      id: (line * 100) + s + 20,
      line_id: line,
      path_id: 1,
      name: `${line}-${s * 2}`,
      side: "EVEN",
      station_number: s * 2,
      active: true,
      active_half1: true,
      active_half2: true,
      status: "OPERATIONAL"
    });
  }
}
for (let hs = 1; hs <= 2; hs++) {
  const lineId = hs + 8;
  for (let s = 1; s <= 10; s++) {
    INIT_STATIONS.push({
      id: (lineId * 100) + s,
      line_id: lineId,
      path_id: 2,
      name: `HS${hs}-${s}`,
      side: s % 2 === 0 ? "EVEN" : "ODD",
      station_number: s,
      active: true,
      active_half1: true,
      active_half2: true,
      status: "OPERATIONAL"
    });
  }
}

// Client Replicated Persistence
let contextStations: any = {};
let contextBadges: any   = {};
let shiftAssignments: any = {};
let weekHistory: any      = {};

let globalShiftType: string = "DAY";
let globalStaffDate: string = formatLocalDate(new Date());
let globalLaborShareEnabled: boolean = false;
let globalLaborShareCount: number = 0;
let globalPreStaffMode: boolean = false;
let globalDateLineOverrides: any = {};
let globalDateStationOverrides: any = {};
let globalSavedPrestaffedLayouts: any[] = [];

function getDisplayRoleName(pathName: string, dept: string, pathsList?: any[]) {
  return pathName || "–";
}

const isInd = (p: string | null | undefined, pathsList?: any[]) => {
  if (!p) return false;
  if (pathsList && Array.isArray(pathsList)) {
    const found = pathsList.find((x: any) => x.name === p);
    if (found) {
      const hours = found.rotation_hours !== undefined ? found.rotation_hours : 10;
      if (hours <= 5) return true;
    }
  }
  const u = String(p).toUpperCase();
  return u.includes("WATERSPIDER") || u.includes("DOWNSTACKER") || u.includes("UNLOADER") || u.includes("UPSTACKER") || u.includes("CAGE");
};

function getAssociateHistory(badge: string) {
  const list: any[] = [];
  const sortedKeys = Object.keys(shiftAssignments).sort((a, b) => {
    const dateA = a.split("|")[1] || "";
    const dateB = b.split("|")[1] || "";
    return new Date(dateA).getTime() - new Date(dateB).getTime();
  });

  sortedKeys.forEach(sKey => {
    const parts = sKey.split("|");
    if (parts.length < 3) return;
    const entryDept = parts[0];
    const entryDateStr = parts[1];
    const entryShiftType = parts[2];

    const placement = shiftAssignments[sKey]?.[badge];
    if (placement) {
      if (placement.half1) {
        list.push({
          date: entryDateStr,
          dept: entryDept,
          shiftType: entryShiftType,
          roleType: placement.half1.roleType,
          path: placement.half1.path,
          half: "half1"
        });
      }
      if (placement.half2) {
        list.push({
          date: entryDateStr,
          dept: entryDept,
          shiftType: entryShiftType,
          roleType: placement.half2.roleType,
          path: placement.half2.path,
          half: "half2"
        });
      }
    }
  });

  return list;
}

function consec3Indirect(badge: string, dept: string) {
  const h = getAssociateHistory(badge).filter((x: any) => !dept || x.dept === dept);
  return h.length >= 3 && h.slice(-3).every((x: any) => x.roleType === "INDIRECT");
}

function scoreOnePath(assoc: any, pathName: string, dept: string, targetDateStr?: string, floorPaths: any[] = []) {
  const canon = pathName;
  const perm = assoc.permissions?.find((p: any) => p.path_name === canon);
  if (!perm) return null;
  if (isInd(pathName, floorPaths) && consec3Indirect(assoc.badge, dept)) return null;

  let yd = 0; // Hours in this path yesterday
  let wk = 0; // Hours in this path in the last 21 days
  let tot = 0; // Total hours worked in any path in the last 21 days
  let todayHoursInPath = 0; // Hours in this path today so far (e.g. from H1 evaluating H2)

  if (targetDateStr) {
    const targetDate = new Date(targetDateStr);
    const targetTime = targetDate.getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;

    const yesterdayDateObj = new Date(targetTime - oneDayMs);
    const yesterdayDateStr = formatLocalDate(yesterdayDateObj);

    Object.entries(shiftAssignments).forEach(([sKey, badgeMap]: [string, any]) => {
      const parts = sKey.split("|");
      if (parts.length < 3) return;
      const entryDateStr = parts[1];

      const entryTime = new Date(entryDateStr).getTime();
      const diffMs = targetTime - entryTime;
      const diffDays = diffMs / oneDayMs;

      const placement = badgeMap[assoc.badge];
      if (!placement) return;

      const h1Path = placement.half1?.path;
      const h2Path = placement.half2?.path;

      if (entryDateStr === yesterdayDateStr) {
        if (h1Path === pathName) yd += 5;
        if (h2Path === pathName) yd += 5;
      }

      // Roll up last 21 days (non-inclusive of targetDate itself)
      if (diffDays > 0 && diffDays <= 21) {
        if (h1Path) {
          tot += 5;
          if (h1Path === pathName) wk += 5;
        }
        if (h2Path) {
          tot += 5;
          if (h2Path === pathName) wk += 5;
        }
      }

      if (entryDateStr === targetDateStr) {
        if (h1Path === pathName) todayHoursInPath += 5;
      }
    });
  }

  // 1. Yesterday Penalty: -40 to +20 (biggest factor — drives rotation)
  let ydPts = 20; // Incentive bonus if they didn't work same path yesterday
  if (yd >= 10) ydPts = -40;
  else if (yd === 5) ydPts = -20;

  // 2. Week Share Bonus: 0 to +30 (fairness across the week)
  const share = wk / (tot || 1);
  const wkPts = Math.round((1 - share) * 30);

  // 3. LC level: +8 to +40 (qualification fit)
  const lcPts = (perm.lc_level || 1) * 8;

  // 4. Path priority: +15 to +150 (business need / high priority path gets much higher weight)
  const fpObj = floorPaths.find(p => p.name === pathName);
  const pathPriority = fpObj ? (fpObj.priority || 5) : 5;
  const prPts = pathPriority * 15;

  // 5. Breadth bonus: +2 to +30 (flexibility value)
  const numPerms = (assoc.permissions || []).length;
  const bPts = Math.max(2, Math.min(30, 2 + (numPerms - 1) * 4));

  // 6. Today penalty: 0 to -15 (approaching rotation cap)
  let todayPenalty = 0;
  const cap = fpObj?.rotation_hours || 10;
  if (todayHoursInPath > 0) {
    if (todayHoursInPath >= cap) {
      todayPenalty = -15;
    } else if (todayHoursInPath >= cap * 0.5) {
      todayPenalty = -5;
    }
  }

  // 7. Active 3-Week Rotation Booster: whether they have 3 permissions or 5, rotate them all within 3 weeks
  let rotBoosterPts = 0;
  let rotBoosterDetail = "";
  const perms = assoc.permissions || [];
  if (perms.length > 1 && targetDateStr) {
    const targetDate = new Date(targetDateStr);
    const targetTime = targetDate.getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    const permHours: Record<string, number> = {};
    perms.forEach((p: any) => { permHours[p.path_name] = 0; });
    
    Object.entries(shiftAssignments).forEach(([sKey, badgeMap]: [string, any]) => {
      const parts = sKey.split("|");
      if (parts.length < 3) return;
      const entryDateStr = parts[1];
      const entryTime = new Date(entryDateStr).getTime();
      const diffMs = targetTime - entryTime;
      const diffDays = diffMs / oneDayMs;
      
      if (diffDays > 0 && diffDays <= 21) {
        const placement = badgeMap[assoc.badge];
        if (placement) {
          const h1P = placement.half1?.path;
          const h2P = placement.half2?.path;
          if (h1P && permHours[h1P] !== undefined) permHours[h1P] += 5;
          if (h2P && permHours[h2P] !== undefined) permHours[h2P] += 5;
        }
      }
    });

    const hoursValues = Object.values(permHours);
    const minHours = Math.min(...hoursValues);
    
    if (wk === minHours) {
      rotBoosterPts = 60;
      rotBoosterDetail = `Path has the lowest active runtime (${wk}h) in the last 21d among all ${perms.length} permissions (Guaranteed 3-week rotation active: +60 pts)`;
    } else {
      rotBoosterDetail = `Not the lowest runtime (min is ${minHours}h, this is ${wk}h) among ${perms.length} permissions (0 pts)`;
    }
  } else {
    rotBoosterDetail = perms.length <= 1 ? "Only 1 certified permission (rotation not applicable: 0 pts)" : "Target date missing: 0 pts";
  }

  const total = Math.max(0, ydPts + wkPts + lcPts + prPts + bPts + todayPenalty + rotBoosterPts);
  let rotationHours = fpObj ? (fpObj.rotation_hours || 10) : 10;

  return {
    score: +total.toFixed(1),
    lc: perm.lc_level,
    roleType: isInd(pathName, floorPaths) ? "INDIRECT" : "DIRECT",
    rotationHours: rotationHours,
    breakdown: [
      { factor: "Yesterday Penalty/Bonus", pts: ydPts, detail: yd > 0 ? `Penalty for doing ${yd}h of same path yesterday: ${ydPts} pts` : "No same path yesterday (Rotation incentive: +20 pts)" },
      { factor: "Week Work Share", pts: wkPts, detail: `${wk}h worked in path out of ${tot}h total last 21d (${Math.round(share * 100)}% share: +${wkPts} pts)` },
      { factor: "Learning Curve Fit", pts: lcPts, detail: `L${perm.lc_level}/5 proficiency (+${lcPts} pts)` },
      { factor: "Path Priority", pts: prPts, detail: `Priority ${pathPriority} (+${prPts} pts)` },
      { factor: "Breadth/Flexibility", pts: bPts, detail: `${numPerms} qualified paths (+${bPts} pts)` },
      { factor: "3-Week Rotation Booster", pts: rotBoosterPts, detail: rotBoosterDetail },
      { factor: "Today Rotation Cap", pts: todayPenalty, detail: todayHoursInPath > 0 ? `${todayHoursInPath}h already worked in path today (${todayPenalty} pts)` : "No same path workload today (0 pts)" }
    ]
  };
}

export function getCurrentRealShiftAndDate() {
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
  const month = adjustedDate.getMonth();
  const dateNum = adjustedDate.getDate();
  const localDateObj = new Date(year, month, dateNum, 0, 0, 0);

  return { shiftType, adjustedDate: localDateObj };
}

function getShiftInfoText(dateVal: Date | string) {
  const dateObj = dateVal instanceof Date ? dateVal : new Date(dateVal + "T00:00:00");
  const day = dateObj.getDay(); // 0 is Sunday, 3 is Wednesday, 6 is Saturday
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = days[day];

  if (day >= 0 && day <= 2) {
    return {
      dayName,
      dayShift: "FHD (Front Half Days)",
      nightShift: "FHN (Front Half Nights)",
      overlapping: false
    };
  }
  if (day === 3) {
    return {
      dayName,
      dayShift: "FHD & BHD (Overlapping Days)",
      nightShift: "FHN & BHN (Overlapping Nights)",
      overlapping: true
    };
  }
  return {
    dayName,
    dayShift: "BHD (Back Half Days)",
    nightShift: "BHN (Back Half Nights)",
    overlapping: false
  };
}

function getHalf(staffDate: Date | string, shiftCode: string, dept: string) {
  const now = new Date();
  const ds = formatLocalDate(staffDate);
  const todayStr = formatLocalDate(now);
  
  if (ds !== todayStr) return "half1";

  const hr = now.getHours();
  const min = now.getMinutes();
  const totalMins = hr * 60 + min;

  const isNight = shiftCode === "NIGHT" || shiftCode === "FHN" || shiftCode === "BHN" || shiftCode.endsWith("N");
  const isOutbound = String(dept).toUpperCase() === "OUTBOUND";

  if (!isNight) {
    if (isOutbound) {
      // OUTBOUND Day (FHD/BHD): 7:15 AM to 5:45 PM. Half split: 12:30 PM (750 minutes)
      return totalMins < 750 ? "half1" : "half2";
    } else {
      // INBOUND Day (FHD/BHD): 7:00 AM to 5:30 PM. Half split: 12:15 PM (735 minutes)
      return totalMins < 735 ? "half1" : "half2";
    }
  } else {
    if (isOutbound) {
      // OUTBOUND Night (FHN/BHN): 6:45 PM (1125 mins) to 5:15 AM (315 mins next day). Half split: 12:00 AM (midnight / 0 mins)
      if (totalMins >= 1125 || totalMins < 0) {
        return "half1";
      } else {
        return "half2";
      }
    } else {
      // INBOUND Night (FHN/BHN): 6:30 PM (1110 mins) to 5:00 AM (300 mins next day). Half split: 11:45 PM (1425 mins)
      if (totalMins >= 1110 && totalMins < 1425) {
        return "half1";
      } else {
        return "half2";
      }
    }
  }
}

function shiftKey(dept: string, dateStr: string, shiftType: string) {
  return `${dept}|${dateStr}|${shiftType}`;
}

function cleanupOldHistory() {
  const today = new Date();
  const limitTime = 21 * 24 * 60 * 60 * 1000; // 21 days in ms

  // Clean shiftAssignments
  Object.keys(shiftAssignments).forEach(key => {
    const parts = key.split("|");
    if (parts.length >= 2) {
      const datePart = parts[1]; // e.g. "2026-06-13"
      const entryTime = new Date(datePart).getTime();
      if (!isNaN(entryTime) && (today.getTime() - entryTime) > limitTime) {
        delete shiftAssignments[key];
      }
    }
  });

  // Clean contextStations
  Object.keys(contextStations).forEach(key => {
    const parts = key.split("|");
    if (parts.length >= 1) {
      const datePart = parts[0]; // e.g. "2026-06-13"
      const entryTime = new Date(datePart).getTime();
      if (!isNaN(entryTime) && (today.getTime() - entryTime) > limitTime) {
        delete contextStations[key];
      }
    }
  });

  // Clean contextBadges
  Object.keys(contextBadges).forEach(key => {
    const parts = key.split("|");
    if (parts.length >= 1) {
      const datePart = parts[0]; // e.g. "2026-06-13"
      const entryTime = new Date(datePart).getTime();
      if (!isNaN(entryTime) && (today.getTime() - entryTime) > limitTime) {
        delete contextBadges[key];
      }
    }
  });
}

function savePlacementsRaw() {
  cleanupOldHistory();
  fetch("/api/placements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contextStations,
      contextBadges,
      shiftAssignments,
      shiftType: globalShiftType,
      staffDate: globalStaffDate,
      laborShareEnabled: globalLaborShareEnabled,
      laborShareCount: globalLaborShareCount,
      preStaffMode: globalPreStaffMode,
      dateLineOverrides: globalDateLineOverrides,
      dateStationOverrides: globalDateStationOverrides,
      savedPrestaffedLayouts: globalSavedPrestaffedLayouts
    })
  }).catch(() => {});
}

function getStationAssignment(contextKey: string, stationId: number, half: string) {
  return contextStations[contextKey]?.[stationId]?.[half] || null;
}

function setStationAssignment(contextKey: string, stationId: number, half: string, assignment: any) {
  if (!contextStations[contextKey]) contextStations[contextKey] = {};

  if (assignment && assignment.badge) {
    const badgeVal = assignment.badge;
    Object.keys(contextStations[contextKey]).forEach(sIdStr => {
      const sId = parseInt(sIdStr);
      if (sId !== stationId) {
        if (contextStations[contextKey]?.[sId]?.[half]?.badge === badgeVal) {
          delete contextStations[contextKey][sId][half];
        }
        if (contextStations[contextKey][sId] && Object.keys(contextStations[contextKey][sId]).length === 0) {
          delete contextStations[contextKey][sId];
        }
      }
    });

    // Keep contextBadges updated too
    if (!contextBadges[contextKey]) contextBadges[contextKey] = {};
    if (!contextBadges[contextKey][badgeVal]) contextBadges[contextKey][badgeVal] = {};
    contextBadges[contextKey][badgeVal][half] = stationId;
  }

  if (!contextStations[contextKey][stationId]) contextStations[contextKey][stationId] = {};
  contextStations[contextKey][stationId][half] = assignment;
  savePlacementsRaw();
}

function clearStationAssignment(contextKey: string, stationId: number, half: string) {
  const currentAss = contextStations[contextKey]?.[stationId]?.[half];
  if (currentAss && currentAss.badge) {
    if (contextBadges[contextKey]?.[currentAss.badge]) {
      delete contextBadges[contextKey][currentAss.badge][half];
    }
    const parts = contextKey.split("|");
    if (parts.length >= 3) {
      const dateStr = parts[0];
      const shiftType = parts[1];
      const dept = parts[2];
      const sKey = `${dept}|${dateStr}|${shiftType}`;
      if (shiftAssignments[sKey]?.[currentAss.badge]) {
        if (half === "half1") {
          shiftAssignments[sKey][currentAss.badge].half1 = null;
        } else {
          shiftAssignments[sKey][currentAss.badge].half2 = null;
        }
        if (!shiftAssignments[sKey][currentAss.badge].half1 && !shiftAssignments[sKey][currentAss.badge].half2) {
          delete shiftAssignments[sKey][currentAss.badge];
        }
      }
    }
  }
  if (contextStations[contextKey]?.[stationId]) {
    delete contextStations[contextKey][stationId][half];
  }
  savePlacementsRaw();
}

function getBadgeAssignment(contextKey: string, badge: string, half: string) {
  return contextBadges[contextKey]?.[badge]?.[half] || null;
}

function setBadgeAssignment(contextKey: string, badge: string, half: string, stationId: number) {
  if (!contextBadges[contextKey]) contextBadges[contextKey] = {};
  if (!contextBadges[contextKey][badge]) contextBadges[contextKey][badge] = {};
  contextBadges[contextKey][badge][half] = stationId;
  savePlacementsRaw();
}

function clearContextAssignments(contextKey: string) {
  delete contextStations[contextKey];
  delete contextBadges[contextKey];
  savePlacementsRaw();
}





const fmtTime = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function App() {
  const [tab, setTab] = useState("kiosk");
  const [mockAssocs, setMockAssocs] = useState<Associate[]>([]);
  const lastPlacementsJsonRef = useRef<string>("");
  
  const queryParams = new URLSearchParams(window.location.search);
  const isScanPage = queryParams.get("scan_station") === "true";
  const scanPath = queryParams.get("path") || "";
  const scanStation = queryParams.get("station") || "";

  const isKioskOnly = 
    queryParams.get("kiosk") === "true" || 
    window.location.search.includes("kiosk=true") || 
    window.location.hash.includes("kiosk") ||
    window.location.pathname.includes("/kiosk");
  
  // Floor Map Reactive Network State
  const [floorPaths, setFloorPaths] = useState<Path[]>(() => [...INIT_PATHS]);
  const [floorLines, setFloorLines] = useState<Line[]>(() => [...INIT_LINES]);
  const [floorStations, setFloorStations] = useState<Station[]>(() => [...INIT_STATIONS]);

  const SA = (sid: number, half: string) => {
    const s = floorStations.find(x => x.id === sid);
    if (!s) return false;
    const l = floorLines.find(x => x.id === s.line_id);
    if (!l) return false;

    let line_H1 = l.active_half1;
    let line_H2 = l.active_half2;
    let st_H1 = s.active_half1;
    let st_H2 = s.active_half2;

    const dateStr = formatLocalDate(staffDate);
    if (preStaffMode && dateLineOverrides[dateStr]?.[l.id] !== undefined) {
      const ov = dateLineOverrides[dateStr][l.id];
      if (ov.active_half1 !== undefined) line_H1 = ov.active_half1;
      if (ov.active_half2 !== undefined) line_H2 = ov.active_half2;
    }
    if (preStaffMode && dateStationOverrides[dateStr]?.[s.id] !== undefined) {
      const ov = dateStationOverrides[dateStr][s.id];
      if (ov.active_half1 !== undefined) st_H1 = ov.active_half1;
      if (ov.active_half2 !== undefined) st_H2 = ov.active_half2;
    }

    const lineActive = half === "half1" ? line_H1 !== false : line_H2 !== false;
    if (!lineActive) return false;
    return half === "half1" ? st_H1 !== false : st_H2 !== false;
  };

  const LA = (lid: number, half: string) => {
    const l = floorLines.find(x => x.id === lid);
    if (!l) return false;

    let line_H1 = l.active_half1;
    let line_H2 = l.active_half2;

    const dateStr = formatLocalDate(staffDate);
    if (preStaffMode && dateLineOverrides[dateStr]?.[l.id] !== undefined) {
      const ov = dateLineOverrides[dateStr][l.id];
      if (ov.active_half1 !== undefined) line_H1 = ov.active_half1;
      if (ov.active_half2 !== undefined) line_H2 = ov.active_half2;
    }

    return half === "half1" ? line_H1 !== false : line_H2 !== false;
  };

  const isPathOpenForHalf = (pathId: number, half: string, dept: string, dateStr: string, shiftType: string) => {
    const lineIds = floorLines.filter(l => l.path_id === pathId && LA(l.id, half)).map(l => l.id);
    if (!lineIds.length) return false;
    const openSts = floorStations.filter(s => {
      if (!lineIds.includes(s.line_id)) return false;
      if (!SA(s.id, half)) return false;
      if (s.status !== "OPERATIONAL") return false;
      const occupied = getStationAssignment(`${dateStr}|${shiftType}|${dept}`, s.id, half);
      return !occupied;
    });
    return openSts.length > 0;
  };

  const openStForPath = (pathId: number, half: string, dept: string, dateStr: string, shiftType: string) => {
    const ctx = `${dateStr}|${shiftType}|${dept}`;
    const path = floorPaths.find(p => p.id === pathId && p.active !== false);
    if (!path) return null;
    const lineIds = floorLines.filter(l => l.path_id === pathId && LA(l.id, half)).map(l => l.id);
    if (!lineIds.length) return null;
    const cands = floorStations.filter(s => {
      if (!lineIds.includes(s.line_id)) return false;
      if (!SA(s.id, half)) return false;
      if (s.status !== "OPERATIONAL") return false;
      const occupied = getStationAssignment(ctx, s.id, half);
      return !occupied;
    });
    if (!cands.length) return null;
    const pick = cands[Math.floor(Math.random() * cands.length)];
    return { ...pick, line_name: floorLines.find(l => l.id === pick.line_id)?.name || "" };
  };

  const runScanWithLaborShare = (
    badge: string,
    staffDate: any,
    shiftType: string,
    laborShareEnabled: boolean,
    laborShareCount: number,
    crossDeptUsage: any,
    getCrossDeptUsed: any,
    incrementCrossDept: any,
    contextKey: string
  ) => {
    const assoc = mockAssocs.find(a => a.badge === badge || a.login === badge.toLowerCase());
    if (!assoc) return null;

    let targetDept = assoc.operation_mode === "BOTH" ? (assoc.default_dept || "INBOUND") : assoc.operation_mode;
    let isCrossDept = false;

    if (assoc.operation_mode === "BOTH" && laborShareEnabled) {
      const defaultDept = assoc.default_dept || "INBOUND";
      const otherDept = defaultDept === "INBOUND" ? "OUTBOUND" : "INBOUND";
      const used = getCrossDeptUsed(contextKey);
      if (laborShareCount === 0 || used < laborShareCount) {
        const hasOtherDeptPerm = (assoc.permissions || []).some((p: any) => {
          const path = floorPaths.find(fp => fp.name === p.path_name);
          return path && path.department === otherDept;
        });
        if (hasOtherDeptPerm) {
          targetDept = otherDept;
          isCrossDept = true;
        }
      }
    }

    const dateStr = staffDate instanceof Date ? staffDate.toISOString().split("T")[0] : staffDate;
    const half = getHalf(staffDate, shiftType, targetDept);
    const sKey = shiftKey(targetDept, dateStr, shiftType);
    const ctx = `${dateStr}|${shiftType}|${targetDept}`;

    // 1. Context Placement Synchronization
    const assignedStIdH1 = getBadgeAssignment(ctx, assoc.badge, "half1");
    const assignedStIdH2 = getBadgeAssignment(ctx, assoc.badge, "half2");

    const activeH1Asn = assignedStIdH1 ? getStationAssignment(ctx, assignedStIdH1, "half1") : null;
    const activeH2Asn = assignedStIdH2 ? getStationAssignment(ctx, assignedStIdH2, "half2") : null;

    let h1: any = null;
    let h2: any = null;

    if (activeH1Asn) {
      const stObj = floorStations.find(s => s.id === assignedStIdH1);
      h1 = {
        path: activeH1Asn.path,
        station: stObj ? { ...stObj, line_name: floorLines.find(l => l.id === stObj.line_id)?.name || "" } : null,
        score: 5,
        lc: 5,
        roleType: activeH1Asn.roleType || "MANUAL",
        rotationHours: 10,
        breakdown: [],
        allScores: []
      };
    }

    if (activeH2Asn) {
      const stObj = floorStations.find(s => s.id === assignedStIdH2);
      h2 = {
        path: activeH2Asn.path,
        station: stObj ? { ...stObj, line_name: floorLines.find(l => l.id === stObj.line_id)?.name || "" } : null,
        score: 5,
        lc: 5,
        roleType: activeH2Asn.roleType || "MANUAL",
        rotationHours: 10,
        breakdown: [],
        allScores: []
      };
    }

    if (activeH1Asn && activeH2Asn) {
      return {
        associate: assoc,
        path: h1?.path || "SEE ADMIN",
        station: h1?.station,
        score: h1?.score || 0,
        lc: h1?.lc || 0,
        roleType: h1?.roleType || "DIRECT",
        rotationHours: h1?.rotationHours || 10,
        breakdown: h1?.breakdown || [],
        allScores: [],
        method: "RECALL",
        isRecall: true,
        half,
        half1: h1,
        half2: h2,
        consec3: consec3Indirect(assoc.badge, targetDept),
        dept: targetDept,
        assignedDept: targetDept
      };
    }

    const scored = floorPaths
      .filter(fp => fp.department === targetDept)
      .map(fp => {
        const s = scoreOnePath(assoc, fp.name, targetDept, dateStr, floorPaths);
        if (!s) return null;
        return { path: fp.name, ...s, pathObj: fp };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    if (!scored.length) {
      return {
        associate: assoc,
        path: "SEE ADMIN",
        station: null,
        score: 0,
        lc: 0,
        breakdown: [],
        allScores: [],
        reason: "No qualified path permissions configured. Access Permissions tab.",
        method: "AUTO",
        isRecall: false,
        half,
        dept: targetDept,
        assignedDept: targetDept
      };
    }

    let chosen: any = null;
    let isOpenH1 = false;
    let isOpenH2 = false;

    // Evaluate required halves
    const needH1 = !activeH1Asn;
    const needH2 = !activeH2Asn;

    for (const item of scored) {
      const h1Available = needH1 ? isPathOpenForHalf(item.pathObj.id, "half1", targetDept, dateStr, shiftType) : true;
      const h2Available = needH2 ? isPathOpenForHalf(item.pathObj.id, "half2", targetDept, dateStr, shiftType) : true;
      if (h1Available && h2Available) {
        chosen = item;
        isOpenH1 = needH1 ? h1Available : false;
        isOpenH2 = needH2 ? h2Available : false;
        break;
      }
    }

    if (!chosen) {
      for (const item of scored) {
        const h1Available = needH1 && isPathOpenForHalf(item.pathObj.id, "half1", targetDept, dateStr, shiftType);
        const h2Available = needH2 && isPathOpenForHalf(item.pathObj.id, "half2", targetDept, dateStr, shiftType);
        if (h1Available || h2Available) {
          chosen = item;
          isOpenH1 = h1Available;
          isOpenH2 = h2Available;
          break;
        }
      }
    }

    if (chosen) {
      if (needH1) {
        if (isOpenH1) {
          const chosenSt = openStForPath(chosen.pathObj.id, "half1", targetDept, dateStr, shiftType);
          if (chosenSt) {
            setStationAssignment(ctx, chosenSt.id, "half1", { 
              login: assoc.login, 
              name: assoc.name, 
              badge: assoc.badge, 
              path: chosen.path, 
              roleType: chosen.roleType, 
              assignedAt: Date.now(), 
              method: "SCAN", 
              dept: targetDept, 
              half: "half1" 
            });
            setBadgeAssignment(ctx, assoc.badge, "half1", chosenSt.id);
            h1 = { 
              path: chosen.path, 
              station: chosenSt, 
              score: chosen.score, 
              lc: chosen.lc, 
              roleType: chosen.roleType, 
              rotationHours: chosen.rotationHours, 
              breakdown: chosen.breakdown, 
              allScores: [] 
            };
          } else {
            h1 = { path: "SEE ADMIN", station: null, score: 0, lc: 0, roleType: null, rotationHours: 0, breakdown: [], allScores: [], seeAdminReason: "No station available." };
          }
        } else {
          h1 = { path: "SEE ADMIN", station: null, score: 0, lc: 0, roleType: null, rotationHours: 0, breakdown: [], allScores: [], seeAdminReason: "No first half stations open." };
        }
      }

      if (needH2) {
        const isChosenIndirect = (chosen.rotationHours !== undefined ? chosen.rotationHours : 10) <= 5 || chosen.roleType === "INDIRECT";
        let actualH2Chosen = chosen;
        let actualH2Open = isOpenH2;
        let isForcedH2Admin = false;

        if (needH1 && isChosenIndirect) {
          // Both halves are being assigned dynamically, and 1st half is a capped <=5 HR indirect path.
          // Let's find an alternative path for the 2nd half!
          let altH2 = null;
          for (const item of scored) {
            if (item.path !== chosen.path) {
              const av = isPathOpenForHalf(item.pathObj.id, "half2", targetDept, dateStr, shiftType);
              if (av) {
                altH2 = item;
                break;
              }
            }
          }
          if (altH2) {
            actualH2Chosen = altH2;
            actualH2Open = true;
          } else {
            isForcedH2Admin = true;
          }
        }

        if (isForcedH2Admin) {
          h2 = { 
            path: "SEE ADMIN", 
            station: null, 
            score: 0, 
            lc: 0, 
            roleType: null, 
            rotationHours: 0, 
            breakdown: [], 
            allScores: [], 
            seeAdminReason: "Capped at 5 HR. No other qualified 2nd half path available." 
          };
        } else if (actualH2Open) {
          const h2St = openStForPath(actualH2Chosen.pathObj.id, "half2", targetDept, dateStr, shiftType);
          if (h2St) {
            setStationAssignment(ctx, h2St.id, "half2", { 
              login: assoc.login, 
              name: assoc.name, 
              badge: assoc.badge, 
              path: actualH2Chosen.path, 
              roleType: actualH2Chosen.roleType, 
              assignedAt: Date.now(), 
              method: "SCAN", 
              dept: targetDept, 
              half: "half2" 
            });
            setBadgeAssignment(ctx, assoc.badge, "half2", h2St.id);
            h2 = { 
              path: actualH2Chosen.path, 
              station: h2St, 
              score: actualH2Chosen.score, 
              lc: actualH2Chosen.lc, 
              roleType: actualH2Chosen.roleType, 
              rotationHours: actualH2Chosen.rotationHours, 
              breakdown: [], 
              allScores: [] 
            };
          } else {
            h2 = { path: "SEE ADMIN", station: null, score: 0, lc: 0, roleType: null, rotationHours: 0, breakdown: [], allScores: [], seeAdminReason: "No station available." };
          }
        } else {
          h2 = { path: "SEE ADMIN", station: null, score: 0, lc: 0, roleType: null, rotationHours: 0, breakdown: [], seeAdminReason: "No second half stations open." };
        }
      }
    } else {
      if (needH1) {
        h1 = { path: "SEE ADMIN", station: null, score: 0, lc: 0, roleType: null, rotationHours: 0, breakdown: [], allScores: [], seeAdminReason: "All structures full." };
      }
      if (needH2) {
        h2 = { path: "SEE ADMIN", station: null, score: 0, lc: 0, roleType: null, rotationHours: 0, breakdown: [], allScores: [], seeAdminReason: "All structures full." };
      }
    }

    if (!shiftAssignments[sKey]) shiftAssignments[sKey] = {};
    shiftAssignments[sKey][assoc.badge] = { date: dateStr, half1: h1, half2: h2, dept: targetDept, shiftType };
    savePlacementsRaw();

    if (isCrossDept) incrementCrossDept(contextKey);

    return {
      associate: assoc,
      path: h1?.path || "SEE ADMIN",
      station: h1?.station,
      score: h1?.score || 0,
      lc: h1?.lc || 0,
      roleType: h1?.roleType,
      rotationHours: h1?.rotationHours,
      breakdown: h1?.breakdown || [],
      allScores: [],
      method: (assignedStIdH1 || assignedStIdH2) ? "RECALL" : "AUTO",
      isRecall: !!(assignedStIdH1 || assignedStIdH2),
      half,
      half1: h1,
      half2: h2,
      consec3: consec3Indirect(assoc.badge, targetDept),
      dept: targetDept,
      assignedDept: targetDept
    };
  };

  const refreshFloorData = async () => {
    try {
      const pathsRes = await fetch(`${API}/paths`).then(r => r.json());
      const linesRes = await fetch(`${API}/lines`).then(r => r.json());
      const stationsRes = await fetch(`${API}/stations`).then(r => r.json());
      if (Array.isArray(pathsRes) && pathsRes.length) {
        setFloorPaths(prev => {
          if (JSON.stringify(prev) === JSON.stringify(pathsRes)) return prev;
          return pathsRes;
        });
      }
      if (Array.isArray(linesRes) && linesRes.length) {
        setFloorLines(prev => {
          if (JSON.stringify(prev) === JSON.stringify(linesRes)) return prev;
          return linesRes;
        });
      }
      if (Array.isArray(stationsRes) && stationsRes.length) {
        setFloorStations(prev => {
          if (JSON.stringify(prev) === JSON.stringify(stationsRes)) return prev;
          return stationsRes;
        });
      }
    } catch (err) {
      console.error("Failed to refresh floor data:", err);
    }
  };

  const loadPlacementsFromServer = async () => {
    try {
      const res = await fetch(`${API}/placements`).then(r => r.json());
      if (res) {
        const placementsStr = JSON.stringify({
          contextStations: res.contextStations,
          contextBadges: res.contextBadges,
          shiftAssignments: res.shiftAssignments,
          shiftType: res.shiftType,
          staffDate: res.staffDate,
          laborShareEnabled: res.laborShareEnabled,
          laborShareCount: res.laborShareCount,
          preStaffMode: res.preStaffMode,
          dateLineOverrides: res.dateLineOverrides,
          dateStationOverrides: res.dateStationOverrides,
          savedPrestaffedLayouts: res.savedPrestaffedLayouts
        });

        if (lastPlacementsJsonRef.current === placementsStr) {
          return;
        }
        lastPlacementsJsonRef.current = placementsStr;

        Object.keys(contextStations).forEach(k => delete contextStations[k]);
        Object.keys(contextBadges).forEach(k => delete contextBadges[k]);
        Object.keys(shiftAssignments).forEach(k => delete shiftAssignments[k]);

        Object.assign(contextStations, res.contextStations || {});
        Object.assign(contextBadges, res.contextBadges || {});
        Object.assign(shiftAssignments, res.shiftAssignments || {});
        
        if (res.shiftType) {
          globalShiftType = res.shiftType;
          _setShiftType(res.shiftType);
        }
        if (res.staffDate) {
          globalStaffDate = res.staffDate;
          const parsed = new Date(res.staffDate + "T00:00:00");
          if (!isNaN(parsed.getTime())) {
            _setStaffDate(parsed);
          }
        }
        if (res.laborShareEnabled !== undefined) {
          globalLaborShareEnabled = res.laborShareEnabled;
          _setLaborShareEnabled(res.laborShareEnabled);
        }
        if (res.laborShareCount !== undefined) {
          globalLaborShareCount = res.laborShareCount;
          _setLaborShareCount(res.laborShareCount);
        }
        if (res.preStaffMode !== undefined) {
          globalPreStaffMode = res.preStaffMode;
          _setPreStaffMode(res.preStaffMode);
        }
        if (res.dateLineOverrides) {
          globalDateLineOverrides = res.dateLineOverrides;
          _setDateLineOverrides(res.dateLineOverrides);
        }
        if (res.dateStationOverrides) {
          globalDateStationOverrides = res.dateStationOverrides;
          _setDateStationOverrides(res.dateStationOverrides);
        }
        if (res.savedPrestaffedLayouts) {
          globalSavedPrestaffedLayouts = res.savedPrestaffedLayouts;
          _setSavedPrestaffedLayouts(res.savedPrestaffedLayouts);
        }

        // Trigger state update
        setLog(p => [...p]);
      }
    } catch (e) {
      console.error("Failed to load placements:", e);
    }
  };

  useEffect(() => {
    refreshFloorData();
    loadPlacementsFromServer();

    // Auto-refresh every 5 seconds so 30+ managers see real-time updates and scan assignments instantly!
    const pollInterval = setInterval(() => {
      refreshFloorData();
      loadPlacementsFromServer();
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [tab]);
  const [clock, setClock] = useState(fmtTime());
  const [shiftType, _setShiftType] = useState(() => getCurrentRealShiftAndDate().shiftType);
  const [staffDate, _setStaffDate] = useState(() => getCurrentRealShiftAndDate().adjustedDate);
  const [dept, setDept] = useState("INBOUND");
  const [log, setLog] = useState<any[]>([]);
  const [auditEvents, setAuditEvents] = useState<any[]>([]);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [activeAdmin, setActiveAdmin] = useState<any>(null);

  const [laborShareEnabled, _setLaborShareEnabled] = useState(false);
  const [laborShareCount, _setLaborShareCount] = useState(0);
  const [crossDeptUsage, setCrossDeptUsage] = useState<any>({});

  const [preStaffMode, _setPreStaffMode] = useState(false);

  // Auto-synchronize to live real-time shift & date when preStaffMode is off
  useEffect(() => {
    if (!preStaffMode) {
      const runSync = () => {
        const { shiftType: nextShift, adjustedDate: nextDate } = getCurrentRealShiftAndDate();
        const curDateStr = formatLocalDate(staffDate);
        const nextDateStr = formatLocalDate(nextDate);

        if (shiftType !== nextShift) {
          _setShiftType(nextShift);
          globalShiftType = nextShift;
        }
        if (curDateStr !== nextDateStr) {
          _setStaffDate(nextDate);
          globalStaffDate = nextDateStr;
        }
      };
      runSync();
      const interval = setInterval(runSync, 30000); // sync every 30 seconds
      return () => clearInterval(interval);
    }
  }, [preStaffMode, shiftType, staffDate]);
  const [dateLineOverrides, _setDateLineOverrides] = useState<any>({});
  const [dateStationOverrides, _setDateStationOverrides] = useState<any>({});
  const [savedPrestaffedLayouts, _setSavedPrestaffedLayouts] = useState<any[]>([]);

  const onUpdateLayouts = (newLayouts: any[]) => {
    _setSavedPrestaffedLayouts(newLayouts);
    globalSavedPrestaffedLayouts = newLayouts;
    savePlacementsRaw();
  };

  const onApplyOverrides = (lineOverrides: any, stationOverrides: any) => {
    const dateStr = formatLocalDate(staffDate);
    
    _setDateLineOverrides((prev: any) => {
      const copy = { ...prev };
      copy[dateStr] = JSON.parse(JSON.stringify(lineOverrides));
      globalDateLineOverrides = copy;
      return copy;
    });

    _setDateStationOverrides((prev: any) => {
      const copy = { ...prev };
      copy[dateStr] = JSON.parse(JSON.stringify(stationOverrides));
      globalDateStationOverrides = copy;
      return copy;
    });

    setTimeout(() => savePlacementsRaw(), 50);
  };

  const setPreStaffMode = (val: boolean) => {
    _setPreStaffMode(val);
    globalPreStaffMode = val;
    savePlacementsRaw();
  };

  const onUpdateLineOverride = (lid: number, half: "half1" | "half2", newValue: boolean) => {
    const dateStr = formatLocalDate(staffDate);
    _setDateLineOverrides((prev: any) => {
      const copy = { ...prev };
      if (!copy[dateStr]) copy[dateStr] = {};
      if (!copy[dateStr][lid]) copy[dateStr][lid] = {};
      copy[dateStr][lid][half] = newValue;
      globalDateLineOverrides = copy;
      setTimeout(() => savePlacementsRaw(), 50);
      return copy;
    });
  };

  const onUpdateStationOverride = (sid: number, newValue: boolean) => {
    const dateStr = formatLocalDate(staffDate);
    _setDateStationOverrides((prev: any) => {
      const copy = { ...prev };
      if (!copy[dateStr]) copy[dateStr] = {};
      if (!copy[dateStr][sid]) copy[dateStr][sid] = {};
      copy[dateStr][sid].active_half1 = newValue;
      copy[dateStr][sid].active_half2 = newValue;
      globalDateStationOverrides = copy;
      setTimeout(() => savePlacementsRaw(), 50);
      return copy;
    });
  };

  const setShiftType = (val: string) => {
    _setShiftType(val);
    globalShiftType = val;
    savePlacementsRaw();
  };

  const setStaffDate = (val: Date) => {
    _setStaffDate(val);
    try {
      globalStaffDate = formatLocalDate(val);
    } catch {}
    savePlacementsRaw();
  };

  const setLaborShareEnabled = (val: boolean) => {
    _setLaborShareEnabled(val);
    globalLaborShareEnabled = val;
    savePlacementsRaw();
  };

  const setLaborShareCount = (val: number) => {
    _setLaborShareCount(val);
    globalLaborShareCount = val;
    savePlacementsRaw();
  };

  const incrementCrossDept = (key: string) => {
    setCrossDeptUsage((prev: any) => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
  };

  const getCrossDeptUsed = (key: string) => crossDeptUsage[key] || 0;

  useEffect(() => {
    const t = setInterval(() => setClock(fmtTime()), 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const session = localStorage.getItem("ct_admin_session");
    if (session) {
      try {
        const parsed = JSON.parse(session);
        if (parsed.expires && parsed.expires > Date.now()) {
          setIsAuthenticated(true);
          setActiveAdmin(parsed);
        } else {
          localStorage.removeItem("ct_admin_session");
          setIsAuthenticated(false);
        }
      } catch {
        setIsAuthenticated(false);
      }
    } else {
      setIsAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    const isSysAdmin = !!(
      activeAdmin && (
        activeAdmin.login?.toLowerCase() === "admin" ||
        activeAdmin.name?.toLowerCase() === "system admin" ||
        activeAdmin.role?.toLowerCase() === "system admin"
      )
    );
    if (!isSysAdmin && (tab === "sppr" || tab === "station_audit" || tab === "settings")) {
      setTab("kiosk");
    }
  }, [activeAdmin, tab]);

  const refreshAssociates = async () => {
    try {
      const data = await fetch(`${API}/associates`).then(r => r.json());
      if (Array.isArray(data)) {
        setMockAssocs(data);
      }
    } catch {}
  };

  useEffect(() => {
    refreshAssociates();
  }, [tab]);

  const resetShift = async () => {
    if (!window.confirm("do you want resett the floor of today.")) return;
    try {
      await fetch(`${API}/reset-shift`, { method: "POST" });
      const linesRes = await fetch(`${API}/lines`).then(r => r.json());
      const stationsRes = await fetch(`${API}/stations`).then(r => r.json());
      if (Array.isArray(linesRes) && linesRes.length) {
        setFloorLines(linesRes);
      }
      if (Array.isArray(stationsRes) && stationsRes.length) {
        setFloorStations(stationsRes);
      }
    } catch {}
    
    // Clear all client assignments
    Object.keys(contextStations).forEach(k => delete contextStations[k]);
    Object.keys(contextBadges).forEach(k => delete contextBadges[k]);
    Object.keys(shiftAssignments).forEach(k => delete shiftAssignments[k]);
    savePlacementsRaw();

    setLog([]);
    setAuditEvents([]);
    alert("Floor coordinates successfully reset.");
  };

  const handleAuthenticate = (admin: any) => {
    setIsAuthenticated(true);
    setActiveAdmin(admin);
  };

  const handleSignOut = () => {
    localStorage.removeItem("ct_admin_session");
    setIsAuthenticated(false);
    setActiveAdmin(null);
  };

  const onPlaceAudit = (action: string, badge: string, name: string, station: string, path: string, dept: string, shift: string, date: string) => {
    const who = activeAdmin ? `${activeAdmin.name} (${activeAdmin.role})` : "Automated Flow";
    const auditObj = { who, badge, name, station, path, action, dept, shiftType: shift, date, ts: Date.now() };
    setAuditEvents(curr => [auditObj, ...curr]);
  };

  if (isScanPage) {
    return (
      <ScanStationLanding
        apiUrl={API}
        pathName={scanPath}
        stationName={scanStation}
      />
    );
  }

  if (isKioskOnly) {
    return (
      <div className="min-h-screen w-full bg-[#F3F4F6] text-[#111827] font-sans flex flex-col justify-center items-center py-12 px-6">
        <div className="w-full max-w-[640px] bg-white rounded-3xl border border-gray-200 p-10 shadow-lg">
          <div className="flex justify-between items-center pb-6 mb-6 border-b border-gray-150 flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="min-w-10 px-2 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-extrabold text-sm tracking-wider shadow-sm">
                Optimus
              </div>
              <div>
                <h1 className="text-base font-extrabold text-[#111827] tracking-tight font-sans">Optimus Staffing Hub Terminal</h1>
                <p className="text-[10px] text-[#9CA3AF] font-mono tracking-wider mt-0.5 uppercase">STANDALONE SCAN KIOSK DISPLAY · TEN1 Sandip</p>
              </div>
            </div>
            {/* Link back to central tower */}
            <a 
              href="/" 
              className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#4B5563] bg-[#F9FAFB] border border-[#E5E7EB] hover:bg-gray-100 rounded-lg px-3 py-2 transition-all no-underline cursor-pointer"
            >
              Control Tower Dashboard
            </a>
          </div>
          
          <Kiosk
            onAssign={async e => {
              setLog(p => [...p, e]);
              await loadPlacementsFromServer();
            }}
            shiftType={shiftType}
            staffDate={staffDate}
            laborShareEnabled={laborShareEnabled}
            laborShareCount={laborShareCount}
            crossDeptUsage={crossDeptUsage}
            incrementCrossDept={incrementCrossDept}
            getCrossDeptUsed={getCrossDeptUsed}
            mockAssocs={mockAssocs}
            floorPaths={floorPaths}
            floorLines={floorLines}
            floorStations={floorStations}
            getStationAssignment={getStationAssignment}
            setStationAssignment={setStationAssignment}
            setBadgeAssignment={setBadgeAssignment}
            consec3Indirect={consec3Indirect}
            runScanWithLaborShare={runScanWithLaborShare}
          />
        </div>
      </div>
    );
  }

  if (isAuthenticated === false) {
    return <AdminGate onAuthenticate={handleAuthenticate} apiUrl={API} />;
  }

  if (isAuthenticated === null) {
    return (
      <div className="flex bg-[#F9FAFB] min-h-screen items-center justify-center">
        <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const isSystemAdmin = !!(
    activeAdmin && (
      activeAdmin.login?.toLowerCase() === "admin" ||
      activeAdmin.name?.toLowerCase() === "system admin" ||
      activeAdmin.role?.toLowerCase() === "system admin"
    )
  );

  const TABS = [
    { id: "kiosk", label: "KIOSK", icon: "🔖", subtitle: "Automated scan console" },
    { id: "dashboard", label: "DASHBOARD", icon: "📊", subtitle: "Operational overview feeds" },
    { id: "laborshare", label: "LABOR SHARE", icon: "🔄", subtitle: "Inbound ⇄ Outbound labor sharing" },
    { id: "map", label: "FLOOR MAP", icon: "🗺️", subtitle: "Manage lines stations halves" },
    { id: "prestaff_saved", label: "SAVED FLOORS", icon: "💾", subtitle: "Saved pre-staffed layouts" },
    ...(isSystemAdmin ? [
      { id: "sppr", label: "SPPR", icon: "⚡", subtitle: "Coming Soon & Adapt/Engage" },
      { id: "station_audit", label: "STATION AUDIT", icon: "📡", subtitle: "Real-time scanned station logger" }
    ] : []),
    { id: "perms", label: "PERMISSIONS", icon: "🔐", subtitle: "Learning Curve competencies" },
    { id: "assocs", label: "ASSOCIATES", icon: "👥", subtitle: "Registered personnel database" },
    { id: "history", label: "HISTORY", icon: "📋", subtitle: "History audit registry logs" },
    { id: "search", label: "SEARCH", icon: "🔍", subtitle: "Employee profile lookups" },
    { id: "report", label: "REPORT", icon: "📥", subtitle: "Placements report downloads" },
    { id: "perf", label: "PERFORMANCE", icon: "📈", subtitle: "Target scanning velocity" },
    { id: "alerts", label: "ALERTS", icon: "🚨", subtitle: "Andon alarm triggers" },
    { id: "leaderboard", label: "LEADERBOARD", icon: "🏆", subtitle: "Operator monthly high score" },
    ...(isSystemAdmin ? [{ id: "settings", label: "SETTINGS", icon: "⚙️", subtitle: "Priorities weights toggles" }] : [])
  ];

  const activeTabDetails = TABS.find(t => t.id === tab);

  return (
    <div className="flex h-screen w-full bg-[#F9FAFB] text-[#111827] font-sans overflow-hidden">
      {/* Dynamic Navigation Sidebar */}
      <div className="w-64 bg-white border-r border-gray-250 flex flex-col h-full shrink-0">
        <div className="p-6 border-b border-gray-200">
          <div className="rounded-full px-4 py-1 bg-[#009b62] text-white flex items-center justify-center font-extrabold text-[11px] tracking-wider mb-2.5 w-max shadow-3xs select-none">
            Optimus
          </div>
          <h1 className="text-sm font-extrabold tracking-tight text-gray-900 uppercase">OPTIMUS STAFFING HUB</h1>
          <p className="text-[10px] text-gray-400 font-mono tracking-widest mt-1">TEN1 Sandip console manager</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 bg-white overflow-y-auto w-full">
          {TABS.map(t => {
            const isSel = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl text-left border-none cursor-pointer transition-all ${
                  isSel ? "bg-emerald-50 text-emerald-800 font-extrabold shadow-sm" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50/50"
                }`}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </nav>

        {activeAdmin && (
          <div className="p-4 border-t border-gray-150 flex flex-col gap-2 bg-[#FAFBFD]/30">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center uppercase font-mono">
                {activeAdmin.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold text-gray-900 truncate">{activeAdmin.name}</div>
                <div className="text-[9px] text-gray-400 font-mono mt-0.5 uppercase tracking-wider">{activeAdmin.role}</div>
              </div>
            </div>
            <button onClick={handleSignOut} className="w-full py-1.5 bg-[#FEF2F2] hover:bg-[#FEE2E2] border border-[#FEE2E2] text-[#DC2626] rounded-xl text-[10px] font-bold font-mono uppercase tracking-widest cursor-pointer mt-1">
              🚪 Sign out
            </button>
          </div>
        )}
        <div className="p-3 bg-[#FAFBFD]/80 border-t border-gray-150 text-center select-none mt-auto">
          <p className="text-[10px] text-gray-400 font-mono tracking-widest font-bold">TEN1 Sandip</p>
        </div>
      </div>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* Clean minimal navbar header with zoom-in wrapping flexibility */}
        <header className="min-h-[5rem] py-4 bg-white border-b border-gray-200 flex items-center justify-between px-8 shrink-0 flex-wrap gap-4">
          <div>
            <h2 className="text-base font-extrabold tracking-tight text-gray-900 flex items-center gap-1.5">
              <span>{activeTabDetails?.icon}</span>
              <span>{activeTabDetails?.label}</span>
            </h2>
            <p className="text-xs text-gray-400 font-medium">
              {activeTabDetails?.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Dept mode selectors */}
            <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-250 overflow-hidden font-mono text-[9px] font-bold">
              {["INBOUND", "OUTBOUND"].map(d => (
                <button
                  key={d}
                  onClick={() => setDept(d)}
                  className={`px-3 py-1.5 rounded-lg border-none cursor-pointer transition-colors ${
                    dept === d ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>

            {/* Conditional display of Shift daytime pills and Calendar Date Picker */}
            {preStaffMode ? (
              <>
                {/* Shift daytime pills */}
                <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-250 overflow-hidden font-mono text-[9px] font-bold">
                  {[
                    { v: "DAY", l: "☀ Day" },
                    { v: "NIGHT", l: "🌙 Night" }
                  ].map(s => (
                    <button
                      key={s.v}
                      onClick={() => setShiftType(s.v)}
                      className={`px-3 py-1.5 rounded-lg border-none cursor-pointer transition-colors ${
                        shiftType === s.v ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500 hover:text-gray-900"
                      }`}
                    >
                      {s.l}
                    </button>
                  ))}
                </div>

                {/* Calendar Date Picker */}
                <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-250 items-center font-mono text-[9px] font-bold">
                  <span className="pl-1.5 pr-1.5 text-gray-400">📅</span>
                  <input
                    type="date"
                    value={formatLocalDate(staffDate)}
                    onChange={e => {
                      if (e.target.value) {
                        setStaffDate(new Date(e.target.value + "T00:00:00"));
                      }
                    }}
                    className="bg-transparent border-none text-[9px] font-extrabold font-mono text-gray-700 outline-none cursor-pointer pr-1"
                  />
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 py-1.5 px-3 rounded-xl font-mono text-[9.5px]">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="font-extrabold text-emerald-805 tracking-tight uppercase">
                  LIVE SHIFT: {shiftType === "DAY" ? "🌞 Day" : "🌙 Night"} (
                  {(() => {
                    try {
                      return staffDate instanceof Date 
                        ? staffDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) 
                        : String(staffDate);
                    } catch {
                      return String(staffDate);
                    }
                  })()}
                  )
                </span>
              </div>
            )}

            {/* Pre-staffing Mode Switch */}
            <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-250 items-center font-mono text-[9px] font-bold gap-1.5 shadow-3xs">
              <span className="pl-1.5 text-gray-500 font-extrabold text-[8px] uppercase">✨ Pre-Staff:</span>
              <button
                onClick={() => setPreStaffMode(!preStaffMode)}
                className={`px-2 py-0.5 text-[8.5px] font-black uppercase rounded-lg transition-all border cursor-pointer ${
                  preStaffMode
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700 font-extrabold"
                    : "bg-gray-50 border-gray-200 text-gray-400"
                }`}
              >
                {preStaffMode ? "ON" : "OFF"}
              </button>
            </div>

            {/* Dynamic Active Shift Schedule Badge */}
            {(() => {
              const info = getShiftInfoText(staffDate);
              const activeLabel = shiftType === "DAY" ? info.dayShift : info.nightShift;
              return (
                <div className={`px-3 py-1 rounded-xl border font-mono text-[9px] font-extrabold flex flex-col justify-center select-none shadow-3xs transition-all ${
                  info.overlapping ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-emerald-50 border-emerald-200 text-emerald-800"
                }`}>
                  <span className="text-[7.5px] text-gray-400 font-extrabold uppercase leading-tight">ACTIVE DAILY SHIFT:</span>
                  <span className="leading-normal">{activeLabel}</span>
                </div>
              );
            })()}

            {/* Dynamic clock indicator */}
            <div className="font-mono text-[10px] font-bold text-gray-400 bg-gray-50 border border-gray-150 py-1.5 px-3.5 rounded-xl shadow-3xs flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping"></span>
              <span>{clock}</span>
            </div>

            <a
              href="?kiosk=true"
              target="_blank"
              rel="noopener noreferrer"
              className="no-underline px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-[10px] font-bold font-mono border border-emerald-200 uppercase tracking-widest cursor-pointer shadow-3xs transition-colors"
            >
              🖥️ Standalone Kiosk
            </a>

            <button onClick={resetShift} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-650 rounded-xl text-[10px] font-bold font-mono border border-red-150 uppercase tracking-widest cursor-pointer shadow-3xs transition-colors">
              Reset Session
            </button>
          </div>
        </header>

        {/* Scrollable container frame */}
        <main className="p-8 flex-1 overflow-y-auto space-y-6">
          <div className="flex-1">
            {tab === "kiosk" && (
              <Kiosk
                onAssign={e => {
                  setLog(p => [...p, e]);
                  loadPlacementsFromServer();
                }}
                shiftType={shiftType}
                staffDate={staffDate}
                laborShareEnabled={laborShareEnabled}
                laborShareCount={laborShareCount}
                crossDeptUsage={crossDeptUsage}
                incrementCrossDept={incrementCrossDept}
                getCrossDeptUsed={getCrossDeptUsed}
                mockAssocs={mockAssocs}
                floorPaths={floorPaths}
                floorLines={floorLines}
                floorStations={floorStations}
                getStationAssignment={getStationAssignment}
                setStationAssignment={setStationAssignment}
                setBadgeAssignment={setBadgeAssignment}
                consec3Indirect={consec3Indirect}
                runScanWithLaborShare={runScanWithLaborShare}
              />
            )}
            {tab === "dashboard" && (
              <Dashboard
                shiftType={shiftType}
                staffDate={staffDate}
                dept={dept}
                floorPaths={floorPaths}
                floorLines={floorLines}
                floorStations={floorStations}
                getStationAssignment={getStationAssignment}
                getBadgeAssignment={getBadgeAssignment}
                SA={SA}
                shiftAssignments={shiftAssignments}
                mockAssocs={mockAssocs}
              />
            )}
            {tab === "laborshare" && (
              <LaborShare
                apiUrl={API}
                laborShareEnabled={laborShareEnabled}
                setLaborShareEnabled={setLaborShareEnabled}
                laborShareCount={laborShareCount}
                setLaborShareCount={setLaborShareCount}
                crossDeptUsage={crossDeptUsage}
                staffDate={staffDate}
                shiftType={shiftType}
                mockAssocs={mockAssocs}
                floorPaths={floorPaths}
                shiftAssignments={shiftAssignments}
              />
            )}
            {tab === "map" && (
              <FloorMap
                dept={dept}
                staffDate={staffDate}
                shiftType={shiftType}
                mockAssocs={mockAssocs}
                floorPaths={floorPaths}
                floorLines={floorLines}
                floorStations={floorStations}
                setFloorLines={setFloorLines}
                setFloorStations={setFloorStations}
                setFloorPaths={setFloorPaths}
                refreshAssociates={refreshAssociates}
                getStationAssignment={getStationAssignment}
                setStationAssignment={setStationAssignment}
                setBadgeAssignment={setBadgeAssignment}
                getBadgeAssignment={getBadgeAssignment}
                clearStationAssignment={clearStationAssignment}
                SA={SA}
                LA={LA}
                onPlaceAudit={onPlaceAudit}
                laborShareEnabled={laborShareEnabled}
                laborShareCount={laborShareCount}
                getCrossDeptUsed={getCrossDeptUsed}
                incrementCrossDept={incrementCrossDept}
                preStaffMode={preStaffMode}
                onUpdateLineOverride={onUpdateLineOverride}
                onUpdateStationOverride={onUpdateStationOverride}
                dateLineOverrides={dateLineOverrides}
                dateStationOverrides={dateStationOverrides}
                isSystemAdmin={isSystemAdmin}
              />
            )}
            {tab === "prestaff_saved" && (
              <SavedPrestaffFloor
                staffDate={staffDate}
                shiftType={shiftType}
                dept={dept}
                dateLineOverrides={dateLineOverrides}
                dateStationOverrides={dateStationOverrides}
                savedPrestaffedLayouts={savedPrestaffedLayouts}
                onUpdateLayouts={onUpdateLayouts}
                onApplyOverrides={onApplyOverrides}
                onSetPreStaffMode={setPreStaffMode}
              />
            )}
            {tab === "sppr" && (
              <SPPRTab />
            )}
            {tab === "station_audit" && (
              <StationAudit apiUrl={API} />
            )}
            {tab === "perms" && (
              <Permissions
                dept={dept}
                mockAssocs={mockAssocs}
                floorPaths={floorPaths}
                refreshAssociates={refreshAssociates}
              />
            )}
            {tab === "assocs" && (
              <Associates
                dept={dept}
                mockAssocs={mockAssocs}
                refreshAssociates={refreshAssociates}
              />
            )}
            {tab === "history" && (
              <AssignHistory
                dept={dept}
                mockAssocs={mockAssocs}
                auditEvents={auditEvents}
              />
            )}
            {tab === "search" && (
              <SearchLookup
                mockAssocs={mockAssocs}
              />
            )}
            {tab === "report" && (
              <Report
                dept={dept}
                staffDate={staffDate}
                shiftType={shiftType}
                floorStations={floorStations}
                floorLines={floorLines}
                floorPaths={floorPaths}
                getStationAssignment={getStationAssignment}
                auditEvents={auditEvents}
              />
            )}
            {tab === "perf" && <Performance />}
            {tab === "alerts" && <Alerts />}
            {tab === "leaderboard" && <Leaderboard />}
            {tab === "settings" && (
              <Settings
                apiUrl={API}
                userRole={activeAdmin?.role}
                onAdminChange={setActiveAdmin}
                mockAssocs={mockAssocs}
                floorPaths={floorPaths}
                refreshAssociates={refreshAssociates}
                isSystemAdmin={isSystemAdmin}
                refreshFloorData={refreshFloorData}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
