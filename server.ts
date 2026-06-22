import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import os from "os";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const pool = new pg.Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "control_tower",
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000,
});

let useDbFallback = false;
const WORKSPACE_FALLBACK_FILE = path.join(process.cwd(), "db_fallback.json");
const FALLBACK_FILE = path.join(os.tmpdir(), "db_fallback_ten1.json");

// Intelligently seed the OS temp fallback from the workspace copy if it exists and temp doesn't
try {
  if (!fs.existsSync(FALLBACK_FILE) && fs.existsSync(WORKSPACE_FALLBACK_FILE) && fs.statSync(WORKSPACE_FALLBACK_FILE).size > 0) {
    fs.copyFileSync(WORKSPACE_FALLBACK_FILE, FALLBACK_FILE);
  }
} catch (e) {
  console.error("Migration of local fallback schema to system temp folder failed:", e);
}

// In-Memory Fallback Cache
let dbCache: any = null;
let writeTimeout: NodeJS.Timeout | null = null;

function readFallback() {
  try {
    if (fs.existsSync(FALLBACK_FILE) && fs.statSync(FALLBACK_FILE).size > 0) {
      return JSON.parse(fs.readFileSync(FALLBACK_FILE, "utf8"));
    }
  } catch (e) {
    console.error("Error reading fallback file:", e);
  }
  return {
    settings: { active_mode: "INBOUND", active_shift: "FHD" },
    associates: [],
    permissions: [],
    lines: [],
    stations: [],
    paths: [],
    assignments: {},
    attendance: [],
    certifications: [],
    station_audits: []
  };
}

function getFallbackData() {
  if (!dbCache) {
    dbCache = readFallback();
  }
  return dbCache;
}

function saveFallbackData() {
  if (!dbCache) return;
  // Trigger non-blocking async file write with 100ms debounce
  if (writeTimeout) return;
  writeTimeout = setTimeout(() => {
    writeTimeout = null;
    try {
      fs.writeFile(FALLBACK_FILE, JSON.stringify(dbCache, null, 2), "utf8", (err) => {
        if (err) console.error("Error writing fallback file async:", err);
      });
    } catch (e) {
      console.error("Error triggerDiskWrite:", e);
    }
  }, 100);
}

// Ensure database tables exist or fallback
async function initTables() {
  try {
    const client = await pool.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE IF NOT EXISTS shifts (code TEXT PRIMARY KEY, name TEXT, start_hour INTEGER, start_minute INTEGER, end_hour INTEGER, end_minute INTEGER, days TEXT);
      CREATE TABLE IF NOT EXISTS departments (id SERIAL PRIMARY KEY, name TEXT UNIQUE, mode TEXT, active BOOLEAN DEFAULT true);
      CREATE TABLE IF NOT EXISTS paths (id SERIAL PRIMARY KEY, name TEXT UNIQUE, dept_id INTEGER, role_type TEXT, mode TEXT, rotation_hours INTEGER, priority INTEGER DEFAULT 5, max_capacity INTEGER, sort_order INTEGER, active BOOLEAN DEFAULT true);
      CREATE TABLE IF NOT EXISTS lines (id SERIAL PRIMARY KEY, dept_id INTEGER, path_id INTEGER, name TEXT, side TEXT, sort_order INTEGER, active BOOLEAN DEFAULT true, active_half1 BOOLEAN DEFAULT true, active_half2 BOOLEAN DEFAULT true);
      CREATE TABLE IF NOT EXISTS stations (id SERIAL PRIMARY KEY, line_id INTEGER, name TEXT, side TEXT, station_number INTEGER, occupied BOOLEAN DEFAULT false, occupied_by TEXT, occupied_since BIGINT, active BOOLEAN DEFAULT true, active_half1 BOOLEAN DEFAULT true, active_half2 BOOLEAN DEFAULT true, status TEXT DEFAULT 'OPERATIONAL');
      CREATE TABLE IF NOT EXISTS associates (badge TEXT PRIMARY KEY, login TEXT UNIQUE, name TEXT, home_dept TEXT, manager TEXT, shift_code TEXT, operation_mode TEXT, default_dept TEXT DEFAULT 'INBOUND', current_path_id INTEGER, current_station_id INTEGER, current_path_start BIGINT, active BOOLEAN DEFAULT true, photo TEXT, created_at TIMESTAMP DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS permissions (badge TEXT, path_id INTEGER, lc_level INTEGER, PRIMARY KEY (badge, path_id));
      CREATE TABLE IF NOT EXISTS assignments (id SERIAL PRIMARY KEY, badge TEXT, path_id INTEGER, path_name TEXT, station_id INTEGER, station_name TEXT, line_name TEXT, assigned_at BIGINT, released_at BIGINT, half TEXT);
      CREATE TABLE IF NOT EXISTS admin_profiles (id SERIAL PRIMARY KEY, name TEXT, login TEXT UNIQUE, pin TEXT, role TEXT DEFAULT 'Manager', created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW())));
      CREATE TABLE IF NOT EXISTS station_audits (id SERIAL PRIMARY KEY, path_name TEXT, station_name TEXT, badge TEXT, associate_name TEXT, scanned_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW())));
    `);
    
    // Schema migration: Add photo column if missing on older DB instances
    try {
      await client.query("ALTER TABLE associates ADD COLUMN IF NOT EXISTS photo TEXT");
    } catch (e: any) {
      console.warn("Could not execute ALTER TABLE to add photo column:", e.message);
    }

    // Schema migration: Add rotation_hours column if missing on older DB instances
    try {
      await client.query("ALTER TABLE paths ADD COLUMN IF NOT EXISTS rotation_hours INTEGER DEFAULT 10");
    } catch (e: any) {
      console.warn("Could not execute ALTER TABLE to add rotation_hours column:", e.message);
    }

    client.release();
    console.log("PostgreSQL initialized successfully.");
    try {
      await pool.query("UPDATE paths SET name = 'CRETS Processing Low Side' WHERE name = 'CRETS Processing'");
      await pool.query("UPDATE paths SET name = 'CRETS Processing High Side' WHERE name = 'CRETS High Side'");
      await pool.query("UPDATE paths SET name = 'IB Problem Solve' WHERE name = 'Problem Solve' AND (dept_id = 1 OR mode = 'INBOUND')");
      await pool.query("UPDATE paths SET name = 'OB Problem Solve' WHERE name = 'Problem Solve Outbound'");
      await pool.query("UPDATE paths SET name = 'IB Super Solver' WHERE name = 'Super Solver' AND (dept_id = 1 OR mode = 'INBOUND')");
      await pool.query("UPDATE paths SET name = 'OB Super Solver' WHERE name = 'Super Solver' AND (dept_id = 2 OR mode = 'OUTBOUND')");
      await pool.query("UPDATE paths SET name = 'IB Waterspider' WHERE name = 'Waterspider'");
      await pool.query("UPDATE paths SET name = 'IB Cage Builder' WHERE name = 'Cage Builder' AND (dept_id = 1 OR mode = 'INBOUND')");
      
      await pool.query("DELETE FROM admin_profiles WHERE name ILIKE '%public%' OR login ILIKE '%public%'");
      const adminCheck = await pool.query("SELECT COUNT(*) FROM admin_profiles");
      if (adminCheck.rows[0].count === '0') {
        await pool.query("INSERT INTO admin_profiles (name, login, pin, role) VALUES ('System Admin', 'admin', '12345', 'Manager')");
        console.log("Seeded default admin profiles into PostgreSQL.");
      } else {
        await pool.query("UPDATE admin_profiles SET pin = '12345' WHERE login = 'admin'");
      }
    } catch {}
  } catch (e: any) {
    console.warn("⚠️ PostgreSQL unavailable. Running in robust fallback JSON mode.", e.message);
    useDbFallback = true;
    const fb = getFallbackData();
    // Rename migration for existing JSON fallback files
    if (fb.paths) {
      fb.paths.forEach((p: any) => {
        if (p.name === "CRETS Processing") p.name = "CRETS Processing Low Side";
        if (p.name === "CRETS High Side") p.name = "CRETS Processing High Side";
        if (p.name === "Problem Solve" && (p.department === "INBOUND" || p.dept_id === 1)) p.name = "IB Problem Solve";
        if (p.name === "Problem Solve Outbound") p.name = "OB Problem Solve";
        if (p.name === "Super Solver" && (p.department === "INBOUND" || p.dept_id === 1)) p.name = "IB Super Solver";
        if (p.name === "Super Solver" && (p.department === "OUTBOUND" || p.dept_id === 2)) p.name = "OB Super Solver";
        if (p.name === "Waterspider" && (p.department === "INBOUND" || p.dept_id === 1)) p.name = "IB Waterspider";
        if (p.name === "Cage Builder" && (p.department === "INBOUND" || p.dept_id === 1)) p.name = "IB Cage Builder";
      });
    }
    if (fb.associates) {
      fb.associates.forEach((a: any) => {
        if (a.home_dept === "CRETS Processing") a.home_dept = "CRETS Processing Low Side";
        if (a.permissions) {
          a.permissions.forEach((perm: any) => {
            if (perm.path_name === "CRETS Processing") perm.path_name = "CRETS Processing Low Side";
            if (perm.path_name === "CRETS High Side") perm.path_name = "CRETS Processing High Side";
            if (perm.path_name === "Problem Solve") perm.path_name = "IB Problem Solve";
            if (perm.path_name === "Problem Solve Outbound") perm.path_name = "OB Problem Solve";
            if (perm.path_name === "Super Solver" && a.operation_mode === "INBOUND") perm.path_name = "IB Super Solver";
            if (perm.path_name === "Super Solver" && a.operation_mode === "OUTBOUND") perm.path_name = "OB Super Solver";
            if (perm.path_name === "Waterspider") perm.path_name = "IB Waterspider";
            if (perm.path_name === "Cage Builder") perm.path_name = "IB Cage Builder";
          });
          // Deduplicate permissions
          const seen = new Set<string>();
          a.permissions = a.permissions.filter((p: any) => {
            if (!p.path_name) return false;
            const key = p.path_name.trim();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        }
      });
    }
    if (!fb.paths || fb.paths.length === 0) {
      // Seed default paths, lines, and stations
      const initLayout = buildDefaultFloor();
      fb.paths = initLayout.paths;
      fb.lines = initLayout.lines;
      fb.stations = initLayout.stations;
    } else {
      // If paths already exist, make sure we align names to avoid any legacy duplicate leftover names
      fb.paths.forEach((p: any) => {
        if (p.id === 6 && p.name === "Problem Solve") p.name = "IB Problem Solve";
        if (p.id === 7 && p.name === "Super Solver") p.name = "IB Super Solver";
        if (p.id === 8 && p.name === "Waterspider") p.name = "IB Waterspider";
        if (p.id === 12 && p.name === "Cage Builder") p.name = "IB Cage Builder";
        if (p.id === 14 && p.name === "Problem Solve Outbound") p.name = "OB Problem Solve";
        if (p.id === 17 && p.name === "Problem Solve Outbound") p.name = "OB Problem Solve";
        if (p.id === 18 && p.name === "Super Solver") p.name = "OB Super Solver";
      });
    }
    // Safe mock purge: remove any default mock employees while keeping user-added real employees
    if (!fb.associates) fb.associates = [];
    const mockBadgesToRemove = ["101181", "172099", "105011", "115361", "11873356", "500001", "600001", "600002", "600003", "600004"];
    fb.associates = fb.associates.filter((a: any) => !mockBadgesToRemove.includes(a.badge));
    if (!fb.admin_profiles || fb.admin_profiles.length === 0) {
      fb.admin_profiles = [
        { id: 1, name: "System Admin", login: "admin", pin: "12345", role: "Manager", created_at: Date.now() }
      ];
    } else {
      fb.admin_profiles = fb.admin_profiles.filter((p: any) => !(p.name && p.name.toLowerCase().includes("public")) && !(p.login && p.login.toLowerCase().includes("public")));
      const adminProf = fb.admin_profiles.find((p: any) => p.login === "admin");
      if (adminProf) {
        adminProf.pin = "12345";
      }
    }
    saveFallbackData();
  }
}

// Standard structural seeding for floor layout fallback
function buildDefaultFloor() {
  const paths: any[] = [];
  const lines: any[] = [];
  const stations: any[] = [];
  let lid = 1, sid = 1;

  function addPath(pid: number, name: string, rt: string, dept: string, nLines: number, stPerSide: number) {
    paths.push({ id: pid, name, role_type: rt, department: dept, active: true, display_order: pid * 100, priority: 5, rotation_hours: pid === 2 ? 5 : 10 });
    for (let li = 1; li <= nLines; li++) {
      const lId = lid++;
      lines.push({ id: lId, path_id: pid, name: `Line ${li}`, active: true, active_half1: true, active_half2: true });
      for (let s = 1; s <= stPerSide; s++) {
        stations.push({ id: sid++, line_id: lId, path_id: pid, name: `${li}-${s * 2 - 1}`, side: "ODD", station_number: s * 2 - 1, active: true, active_half1: true, active_half2: true, status: "OPERATIONAL" });
        stations.push({ id: sid++, line_id: lId, path_id: pid, name: `${li}-${s * 2}`, side: "EVEN", station_number: s * 2, active: true, active_half1: true, active_half2: true, status: "OPERATIONAL" });
      }
    }
  }

  // Inbound seed
  addPath(1, "CRETS Processing Low Side", "DIRECT", "INBOUND", 8, 8);
  addPath(2, "CRETS Processing High Side", "DIRECT", "INBOUND", 2, 10);
  addPath(3, "WHD Processing", "DIRECT", "INBOUND", 4, 8);
  addPath(4, "Refurb Processing", "DIRECT", "INBOUND", 3, 8);
  addPath(5, "Tech Grading", "DIRECT", "INBOUND", 2, 8);
  addPath(6, "IB Problem Solve", "DIRECT", "INBOUND", 1, 5);
  addPath(7, "IB Super Solver", "DIRECT", "INBOUND", 1, 5);
  addPath(8, "IB Waterspider", "INDIRECT", "INBOUND", 1, 6);
  addPath(9, "Downstacker", "INDIRECT", "INBOUND", 2, 4);
  addPath(10, "IB Unloader", "INDIRECT", "INBOUND", 2, 4);
  addPath(11, "Upstacker", "INDIRECT", "INBOUND", 2, 4);
  addPath(12, "IB Cage Builder", "INDIRECT", "INBOUND", 1, 3);

  // Outbound seed
  addPath(13, "Pick Driver", "DIRECT", "OUTBOUND", 2, 8);
  addPath(14, "Stow Driver", "DIRECT", "OUTBOUND", 2, 8);
  addPath(15, "Rebin Processing", "DIRECT", "OUTBOUND", 1, 6);
  addPath(16, "Pack Processing", "DIRECT", "OUTBOUND", 4, 8);
  addPath(17, "OB Problem Solve", "DIRECT", "OUTBOUND", 1, 4);
  addPath(18, "OB Super Solver", "DIRECT", "OUTBOUND", 1, 4);
  addPath(19, "OB Waterspider", "INDIRECT", "OUTBOUND", 1, 4);
  addPath(20, "OB Unloader", "INDIRECT", "OUTBOUND", 1, 4);
  addPath(21, "OB Cage Builder", "INDIRECT", "OUTBOUND", 1, 3);

  return { paths, lines, stations };
}

// ========== SCANS ENGINE HELPERS ==========
function getHalf(staffDate: string, shiftType: string, dept: string) {
  const now = new Date();
  const ds = staffDate;
  const todayStr = now.toISOString().split("T")[0];
  
  if (ds !== todayStr) return "half1";

  const hr = now.getHours();
  const min = now.getMinutes();
  const totalMins = hr * 60 + min;

  const isNight = shiftType === "NIGHT" || shiftType === "FHN" || shiftType === "BHN" || shiftType.endsWith("N");
  const isOutbound = String(dept).toUpperCase() === "OUTBOUND";

  if (!isNight) {
    if (isOutbound) {
      return totalMins < 750 ? "half1" : "half2";
    } else {
      return totalMins < 735 ? "half1" : "half2";
    }
  } else {
    if (isOutbound) {
      if (totalMins >= 1125 || totalMins < 0) {
        return "half1";
      } else {
        return "half2";
      }
    } else {
      if (totalMins >= 1110 && totalMins < 1425) {
        return "half1";
      } else {
        return "half2";
      }
    }
  }
}

function getAssociateHistory(badge: string, dept: string, shiftAssignments: any) {
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

function pruneOldShiftAssignments(shiftAssignments: any) {
  if (!shiftAssignments) return;
  const now = Date.now();
  const threeWeeksMs = 21 * 24 * 60 * 60 * 1000;
  Object.keys(shiftAssignments).forEach(key => {
    const parts = key.split("|");
    if (parts.length >= 2) {
      const dateStr = parts[1];
      const entryTime = new Date(dateStr).getTime();
      if (!isNaN(entryTime) && (now - entryTime) > threeWeeksMs) {
        delete shiftAssignments[key];
      }
    }
  });
}

function consec3Indirect(badge: string, dept: string, shiftAssignments: any) {
  const h = getAssociateHistory(badge, dept, shiftAssignments).filter((x: any) => !dept || x.dept === dept);
  const isInd = (p: string | null | undefined) => {
    if (!p) return false;
    const u = String(p).toUpperCase();
    return u.includes("WATERSPIDER") || u.includes("DOWNSTACKER") || u.includes("UNLOADER") || u.includes("UPSTACKER") || u.includes("CAGE");
  };
  return h.length >= 3 && h.slice(-3).every((x: any) => x.roleType === "INDIRECT");
}

function scoreOnePath(assoc: any, pathName: string, dept: string, targetDateStr: string, floorPaths: any[], shiftAssignments: any) {
  const canon = pathName;
  const perm = assoc.permissions?.find((p: any) => p.path_name === canon);
  if (!perm) return null;
  const isInd = (p: string | null | undefined) => {
    if (!p) return false;
    if (floorPaths && Array.isArray(floorPaths)) {
      const found = floorPaths.find((x: any) => x.name === p);
      if (found) {
        const hours = found.rotation_hours !== undefined ? found.rotation_hours : 10;
        if (hours <= 5) return true;
      }
    }
    const u = String(p).toUpperCase();
    return u.includes("WATERSPIDER") || u.includes("DOWNSTACKER") || u.includes("UNLOADER") || u.includes("UPSTACKER") || u.includes("CAGE");
  };
  if (isInd(pathName) && consec3Indirect(assoc.badge, dept, shiftAssignments)) return null;

  let yd = 0;
  let wk = 0;
  let tot = 0;
  let todayHoursInPath = 0;

  const targetDate = new Date(targetDateStr);
  const targetTime = targetDate.getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;

  const yesterdayDateObj = new Date(targetTime - oneDayMs);
  const yesterdayDateStr = yesterdayDateObj.toISOString().split("T")[0];

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

  let ydPts = 20;
  if (yd >= 10) ydPts = -40;
  else if (yd === 5) ydPts = -20;

  const share = wk / (tot || 1);
  const wkPts = Math.round((1 - share) * 30);

  const lcPts = (perm.lc_level || 1) * 8;

  const fpObj = floorPaths.find((p: any) => p.name === pathName);
  const pathPriority = fpObj ? (fpObj.priority || 5) : 5;
  const prPts = pathPriority * 15;

  const numPerms = (assoc.permissions || []).length;
  const bPts = Math.max(2, Math.min(30, 2 + (numPerms - 1) * 4));

  let todayPenalty = 0;
  const cap = fpObj?.rotation_hours || 10;
  if (todayHoursInPath > 0) {
    if (todayHoursInPath >= cap) {
      todayPenalty = -15;
    } else if (todayHoursInPath >= cap * 0.5) {
      todayPenalty = -5;
    }
  }

  // 7. Active 3-Week Rotation Booster: rotate them all within 3 weeks
  let rotBoosterPts = 0;
  let rotBoosterDetail = "";
  const perms = assoc.permissions || [];
  if (perms.length > 1 && targetDateStr) {
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
    roleType: isInd(pathName) ? "INDIRECT" : "DIRECT",
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

function saActive(sid: number, half: string, floorLines: any[], floorStations: any[]) {
  const s = floorStations.find((x: any) => x.id === sid);
  if (!s) return false;
  const l = floorLines.find((x: any) => x.id === s.line_id);
  if (!l) return false;
  const lineActive = half === "half1" ? l.active_half1 !== false : l.active_half2 !== false;
  if (!lineActive) return false;
  return half === "half1" ? s.active_half1 !== false : s.active_half2 !== false;
}

function laActive(lid: number, half: string, floorLines: any[]) {
  const l = floorLines.find((x: any) => x.id === lid);
  if (!l) return false;
  return half === "half1" ? l.active_half1 !== false : l.active_half2 !== false;
}

function isPathOpenForHalf(pathId: number, half: string, dept: string, dateStr: string, shiftType: string, floorLines: any[], floorStations: any[], contextStations: any) {
  const lineIds = floorLines.filter((l: any) => l.path_id === pathId && laActive(l.id, half, floorLines)).map((l: any) => l.id);
  if (!lineIds.length) return false;
  const openSts = floorStations.filter((s: any) => {
    if (!lineIds.includes(s.line_id)) return false;
    if (!saActive(s.id, half, floorLines, floorStations)) return false;
    if (s.status !== "OPERATIONAL") return false;
    const occupied = contextStations[`${dateStr}|${shiftType}|${dept}`]?.[s.id]?.[half];
    return !occupied;
  });
  return openSts.length > 0;
}

function openStForPath(pathId: number, half: string, dept: string, dateStr: string, shiftType: string, floorLines: any[], floorStations: any[], contextStations: any) {
  const ctx = `${dateStr}|${shiftType}|${dept}`;
  const lineIds = floorLines.filter((l: any) => l.path_id === pathId && laActive(l.id, half, floorLines)).map((l: any) => l.id);
  if (!lineIds.length) return null;
  const cands = floorStations.filter((s: any) => {
    if (!lineIds.includes(s.line_id)) return false;
    if (!saActive(s.id, half, floorLines, floorStations)) return false;
    if (s.status !== "OPERATIONAL") return false;
    const occupied = contextStations[ctx]?.[s.id]?.[half];
    return !occupied;
  });
  if (!cands.length) return null;
  const pick = cands[Math.floor(Math.random() * cands.length)];
  return { ...pick, line_name: floorLines.find((l: any) => l.id === pick.line_id)?.name || "" };
}

// ========== ENDPOINTS ==========

app.get("/api/system", async (req, res) => {
  if (useDbFallback) {
    const fb = getFallbackData();
    return res.json({
      mode: fb.settings.active_mode || "INBOUND",
      activeShift: fb.settings.active_shift || "FHD",
      shifts: [],
      totalAssoc: fb.associates.length,
      onFloor: Object.keys(fb.assignments || {}).length,
      openStations: fb.stations.filter((s: any) => s.active && !s.occupied && s.status === "OPERATIONAL").length,
      filledStations: fb.stations.filter((s: any) => s.occupied).length
    });
  } else {
    try {
      const modeRes = await pool.query("SELECT value FROM settings WHERE key = 'active_mode'");
      const shiftRes = await pool.query("SELECT value FROM settings WHERE key = 'active_shift'");
      const mode = modeRes.rows.length ? modeRes.rows[0].value : "INBOUND";
      const activeShift = shiftRes.rows.length ? shiftRes.rows[0].value : "FHD";

      const assocCountRes = await pool.query("SELECT COUNT(*) FROM associates");
      const totalAssoc = parseInt(assocCountRes.rows[0].count) || 0;

      let onFloor = 0;
      const plcRes = await pool.query("SELECT value FROM settings WHERE key = 'placements'");
      if (plcRes.rows.length) {
        const plc = JSON.parse(plcRes.rows[0].value);
        if (plc && plc.shiftAssignments) {
          onFloor = Object.keys(plc.shiftAssignments).length;
        }
      }

      const stationsRes = await pool.query("SELECT * FROM stations");
      const openStations = stationsRes.rows.filter((s: any) => s.active && !s.occupied && s.status === "OPERATIONAL").length;
      const filledStations = stationsRes.rows.filter((s: any) => s.occupied).length;

      res.json({
        mode,
        activeShift,
        shifts: [],
        totalAssoc,
        onFloor,
        openStations,
        filledStations
      });
    } catch (e: any) {
      console.error("GET /api/system database error:", e);
      res.json({ mode: "INBOUND", activeShift: "FHD", shifts: [], totalAssoc: 0, onFloor: 0, openStations: 0, filledStations: 0 });
    }
  }
});

app.post("/api/system/mode", async (req, res) => {
  const { mode } = req.body;
  if (useDbFallback) {
    const fb = getFallbackData();
    fb.settings.active_mode = mode;
    saveFallbackData();
  } else {
    try {
      await pool.query(
        "INSERT INTO settings (key, value) VALUES ('active_mode', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
        [mode]
      );
    } catch (e) {
      console.error(e);
    }
  }
  res.json({ success: true, mode });
});

app.post("/api/system/shift", async (req, res) => {
  const { shift } = req.body;
  if (useDbFallback) {
    const fb = getFallbackData();
    fb.settings.active_shift = shift;
    saveFallbackData();
  } else {
    try {
      await pool.query(
        "INSERT INTO settings (key, value) VALUES ('active_shift', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
        [shift]
      );
    } catch (e) {
      console.error(e);
    }
  }
  res.json({ success: true, shift });
});

// Paths endpoints
app.get("/api/paths", async (req, res) => {
  if (useDbFallback) {
    const fb = getFallbackData();
    const list = fb.paths || [];
    return res.json(list.map((p: any) => ({
      ...p,
      rotation_hours: p.rotation_hours !== undefined ? p.rotation_hours : 10
    })));
  } else {
    try {
      const dbRes = await pool.query("SELECT * FROM paths ORDER BY id ASC");
      const rows = dbRes.rows.map(r => ({
        id: r.id,
        name: r.name,
        role_type: r.role_type,
        department: r.mode || (r.dept_id === 1 ? "INBOUND" : "OUTBOUND"),
        active: r.active,
        rotation_hours: r.rotation_hours !== null && r.rotation_hours !== undefined ? r.rotation_hours : 10
      }));
      res.json(rows);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  }
});

app.post("/api/paths", async (req, res) => {
  const { id, name, role_type, department, rotation_hours } = req.body;
  if (useDbFallback) {
    const fb = getFallbackData();
    if (!fb.paths) fb.paths = [];
    const newPath = { id, name, role_type, department, active: true, rotation_hours: rotation_hours !== undefined ? rotation_hours : 10 };
    fb.paths.push(newPath);
    saveFallbackData();
    res.json(newPath);
  } else {
    try {
      const mode = department;
      const dept_id = department === "INBOUND" ? 1 : 2;
      const dbRes = await pool.query(
        "INSERT INTO paths (id, name, role_type, mode, dept_id, active, rotation_hours) VALUES ($1, $2, $3, $4, $5, true, $6) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role_type = EXCLUDED.role_type, mode = EXCLUDED.mode, dept_id = EXCLUDED.dept_id, rotation_hours = EXCLUDED.rotation_hours RETURNING *",
        [id, name, role_type, mode, dept_id, rotation_hours !== undefined ? rotation_hours : 10]
      );
      const row = dbRes.rows[0];
      res.json({
        id: row.id,
        name: row.name,
        role_type: row.role_type,
        department: row.mode,
        active: row.active,
        rotation_hours: row.rotation_hours !== null && row.rotation_hours !== undefined ? row.rotation_hours : 10
      });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  }
});

app.patch("/api/paths/:id", async (req, res) => {
  const { id } = req.params;
  const { name, role_type, department, active, rotation_hours } = req.body;
  const pathId = parseInt(id);
  if (useDbFallback) {
    const fb = getFallbackData();
    const p = fb.paths.find((x: any) => x.id === pathId);
    if (p) {
      if (name !== undefined) p.name = name;
      if (role_type !== undefined) p.role_type = role_type;
      if (department !== undefined) p.department = department;
      if (active !== undefined) p.active = active;
      if (rotation_hours !== undefined) p.rotation_hours = rotation_hours;
      saveFallbackData();
      return res.json(p);
    }
    return res.status(404).json({ error: "Path not found" });
  } else {
    try {
      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;
      if (name !== undefined) {
        updates.push(`name = $${idx++}`);
        values.push(name);
      }
      if (role_type !== undefined) {
        updates.push(`role_type = $${idx++}`);
        values.push(role_type);
      }
      if (department !== undefined) {
        updates.push(`mode = $${idx++}`);
        values.push(department);
        updates.push(`dept_id = $${idx++}`);
        values.push(department === "INBOUND" ? 1 : 2);
      }
      if (active !== undefined) {
        updates.push(`active = $${idx++}`);
        values.push(active);
      }
      if (rotation_hours !== undefined) {
        updates.push(`rotation_hours = $${idx++}`);
        values.push(rotation_hours !== null && rotation_hours !== undefined ? parseInt(rotation_hours) : 10);
      }
      if (updates.length === 0) {
        return res.json({ success: true });
      }
      values.push(pathId);
      const queryStr = `UPDATE paths SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`;
      const dbRes = await pool.query(queryStr, values);
      if (dbRes.rows.length) {
        const row = dbRes.rows[0];
        return res.json({
          id: row.id,
          name: row.name,
          role_type: row.role_type,
          department: row.mode,
          active: row.active,
          rotation_hours: row.rotation_hours !== null && row.rotation_hours !== undefined ? row.rotation_hours : 10
        });
      }
      res.status(404).json({ error: "Path not found" });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  }
});

app.delete("/api/paths/:id", async (req, res) => {
  const { id } = req.params;
  const pathId = parseInt(id);
  if (useDbFallback) {
    const fb = getFallbackData();
    fb.paths = fb.paths.filter((x: any) => x.id !== pathId);
    fb.lines = fb.lines.filter((x: any) => x.path_id !== pathId);
    fb.stations = fb.stations.filter((x: any) => x.path_id !== pathId);
    saveFallbackData();
    return res.json({ success: true });
  } else {
    try {
      await pool.query("DELETE FROM stations WHERE path_id = $1", [pathId]);
      await pool.query("DELETE FROM lines WHERE path_id = $1", [pathId]);
      await pool.query("DELETE FROM paths WHERE id = $1", [pathId]);
      res.json({ success: true });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  }
});

app.get("/api/lines", async (req, res) => {
  if (useDbFallback) {
    const fb = getFallbackData();
    return res.json(fb.lines);
  } else {
    try {
      const dbRes = await pool.query("SELECT * FROM lines ORDER BY id ASC");
      res.json(dbRes.rows);
    } catch (e: any) {
      console.error(e);
      res.json([]);
    }
  }
});

app.post("/api/lines", async (req, res) => {
  const { id, path_id, name, active_half1, active_half2 } = req.body;
  if (useDbFallback) {
    const fb = getFallbackData();
    if (!fb.lines) fb.lines = [];
    const newLine = { id, path_id, name, active_half1, active_half2 };
    fb.lines.push(newLine);
    saveFallbackData();
    res.json(newLine);
  } else {
    try {
      const dbRes = await pool.query(
        "INSERT INTO lines (id, path_id, name, active_half1, active_half2) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET path_id = EXCLUDED.path_id, name = EXCLUDED.name, active_half1 = EXCLUDED.active_half1, active_half2 = EXCLUDED.active_half2 RETURNING *",
        [id, path_id, name, active_half1, active_half2]
      );
      res.json(dbRes.rows[0]);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  }
});

app.get("/api/stations", async (req, res) => {
  if (useDbFallback) {
    const fb = getFallbackData();
    return res.json(fb.stations);
  } else {
    try {
      const dbRes = await pool.query("SELECT * FROM stations ORDER BY id ASC");
      res.json(dbRes.rows);
    } catch (e: any) {
      console.error(e);
      res.json([]);
    }
  }
});

app.post("/api/stations", async (req, res) => {
  const { id, line_id, path_id, name, side, station_number, active_half1, active_half2, status } = req.body;
  if (useDbFallback) {
    const fb = getFallbackData();
    if (!fb.stations) fb.stations = [];
    const newStation = { id, line_id, path_id, name, side, station_number, active_half1, active_half2, status };
    fb.stations.push(newStation);
    saveFallbackData();
    res.json(newStation);
  } else {
    try {
      const dbRes = await pool.query(
        "INSERT INTO stations (id, line_id, path_id, name, side, station_number, active_half1, active_half2, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO UPDATE SET line_id = EXCLUDED.line_id, path_id = EXCLUDED.path_id, name = EXCLUDED.name, side = EXCLUDED.side, station_number = EXCLUDED.station_number, active_half1 = EXCLUDED.active_half1, active_half2 = EXCLUDED.active_half2, status = EXCLUDED.status RETURNING *",
        [id, line_id, path_id, name, side, station_number, active_half1, active_half2, status]
      );
      res.json(dbRes.rows[0]);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  }
});

app.patch("/api/lines/:id", async (req, res) => {
  const { id } = req.params;
  const { active_half1, active_half2, name } = req.body;
  const lineId = parseInt(id);
  if (useDbFallback) {
    const fb = getFallbackData();
    const l = fb.lines.find((line: any) => line.id === lineId);
    if (l) {
      if (active_half1 !== undefined) {
        l.active_half1 = active_half1;
        fb.stations.filter((s: any) => s.line_id === l.id).forEach((s: any) => { s.active_half1 = active_half1; });
      }
      if (active_half2 !== undefined) {
        l.active_half2 = active_half2;
        fb.stations.filter((s: any) => s.line_id === l.id).forEach((s: any) => { s.active_half2 = active_half2; });
      }
      if (name !== undefined) {
        l.name = name;
      }
      saveFallbackData();
      return res.json({ success: true });
    }
  } else {
    try {
      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;
      if (active_half1 !== undefined) {
        updates.push(`active_half1 = $${idx++}`);
        values.push(active_half1);
      }
      if (active_half2 !== undefined) {
        updates.push(`active_half2 = $${idx++}`);
        values.push(active_half2);
      }
      if (name !== undefined) {
        updates.push(`name = $${idx++}`);
        values.push(name);
      }
      if (updates.length > 0) {
        values.push(lineId);
        await pool.query(`UPDATE lines SET ${updates.join(", ")} WHERE id = $${idx}`, values);
        if (active_half1 !== undefined) {
          await pool.query("UPDATE stations SET active_half1 = $1 WHERE line_id = $2", [active_half1, lineId]);
        }
        if (active_half2 !== undefined) {
          await pool.query("UPDATE stations SET active_half2 = $1 WHERE line_id = $2", [active_half2, lineId]);
        }
      }
      return res.json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }
  res.status(404).json({ error: "Line not found" });
});

app.patch("/api/stations/:id", async (req, res) => {
  const { id } = req.params;
  const { active_half1, active_half2, name } = req.body;
  const stationId = parseInt(id);
  if (useDbFallback) {
    const fb = getFallbackData();
    const s = fb.stations.find((st: any) => st.id === stationId);
    if (s) {
      if (active_half1 !== undefined) s.active_half1 = active_half1;
      if (active_half2 !== undefined) s.active_half2 = active_half2;
      if (name !== undefined) s.name = name;
      saveFallbackData();
      return res.json({ success: true });
    }
    return res.status(404).json({ error: "Station not found" });
  } else {
    try {
      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;
      if (active_half1 !== undefined) {
        updates.push(`active_half1 = $${idx++}`);
        values.push(active_half1);
      }
      if (active_half2 !== undefined) {
        updates.push(`active_half2 = $${idx++}`);
        values.push(active_half2);
      }
      if (name !== undefined) {
        updates.push(`name = $${idx++}`);
        values.push(name);
      }
      if (updates.length > 0) {
        values.push(stationId);
        await pool.query(`UPDATE stations SET ${updates.join(", ")} WHERE id = $${idx}`, values);
      }
      res.json({ success: true });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  }
});

app.delete("/api/lines/:id", async (req, res) => {
  const { id } = req.params;
  const lineId = parseInt(id);
  if (useDbFallback) {
    const fb = getFallbackData();
    fb.lines = fb.lines.filter((x: any) => x.id !== lineId);
    fb.stations = fb.stations.filter((x: any) => x.line_id !== lineId);
    saveFallbackData();
    return res.json({ success: true });
  } else {
    try {
      await pool.query("DELETE FROM stations WHERE line_id = $1", [lineId]);
      await pool.query("DELETE FROM lines WHERE id = $1", [lineId]);
      res.json({ success: true });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  }
});

app.delete("/api/stations/:id", async (req, res) => {
  const { id } = req.params;
  const stationId = parseInt(id);
  if (useDbFallback) {
    const fb = getFallbackData();
    fb.stations = fb.stations.filter((x: any) => x.id !== stationId);
    saveFallbackData();
    return res.json({ success: true });
  } else {
    try {
      await pool.query("DELETE FROM stations WHERE id = $1", [stationId]);
      res.json({ success: true });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  }
});

app.get("/api/associates", async (req, res) => {
  if (useDbFallback) {
    const fb = getFallbackData();
    return res.json(fb.associates);
  }
  try {
    const assocRes = await pool.query("SELECT * FROM associates ORDER BY name ASC");
    const permRes = await pool.query("SELECT p.*, pt.name as path_name FROM permissions p LEFT JOIN paths pt ON p.path_id = pt.id");
    
    // Group permissions by badge
    const permMap: Record<string, { path_id: number; lc_level: number; path_name: string }[]> = {};
    permRes.rows.forEach((p: any) => {
      if (!permMap[p.badge]) permMap[p.badge] = [];
      permMap[p.badge].push({ path_id: p.path_id, lc_level: p.lc_level, path_name: p.path_name || "" });
    });

    const list = assocRes.rows.map((row: any) => ({
      badge: row.badge,
      login: row.login,
      name: row.name,
      home_dept: row.home_dept,
      manager: row.manager,
      shift_code: row.shift_code,
      operation_mode: row.operation_mode,
      default_dept: row.default_dept,
      photo: row.photo,
      permissions: permMap[row.badge] || [],
      current_path_id: row.current_path_id,
      current_station_id: row.current_station_id,
      current_path_start: row.current_path_start ? Number(row.current_path_start) : null
    }));

    res.json(list);
  } catch (err: any) {
    console.error("GET /api/associates error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/associates", async (req, res) => {
  if (useDbFallback) {
    const fb = getFallbackData();
    const assoc = { ...req.body, permissions: req.body.permissions || [] };
    fb.associates.push(assoc);
    saveFallbackData();
    return res.json(assoc);
  }
  try {
    const { badge, login, name, home_dept, manager, shift_code, operation_mode, default_dept, photo } = req.body;
    const cleanBadge = String(badge).trim();
    const cleanLogin = String(login).trim().toLowerCase();
    
    await pool.query(
      `INSERT INTO associates (badge, login, name, home_dept, manager, shift_code, operation_mode, default_dept, photo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (badge) DO UPDATE SET
         login = EXCLUDED.login,
         name = EXCLUDED.name,
         home_dept = EXCLUDED.home_dept,
         manager = EXCLUDED.manager,
         shift_code = EXCLUDED.shift_code,
         operation_mode = EXCLUDED.operation_mode,
         default_dept = EXCLUDED.default_dept,
         photo = COALESCE(EXCLUDED.photo, associates.photo)`,
      [cleanBadge, cleanLogin, name, home_dept, manager, shift_code, operation_mode, default_dept || "INBOUND", photo]
    );

    // Save permissions if provided
    if (req.body.permissions && Array.isArray(req.body.permissions)) {
      await pool.query("DELETE FROM permissions WHERE badge = $1", [cleanBadge]);
      for (const p of req.body.permissions) {
        await pool.query(
          "INSERT INTO permissions (badge, path_id, lc_level) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
          [cleanBadge, p.path_id, p.lc_level]
        );
      }
    }

    res.json({ success: true, badge: cleanBadge });
  } catch (err: any) {
    console.error("POST /api/associates error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/associates/bulk", async (req, res) => {
  const { associates } = req.body;
  if (!associates || !Array.isArray(associates)) {
    return res.status(400).json({ error: "Invalid associates list" });
  }

  if (useDbFallback) {
    const fb = getFallbackData();
    if (!fb.associates) fb.associates = [];

    associates.forEach((item: any) => {
      // Find existing index by badge
      const idx = fb.associates.findIndex((a: any) => a.badge === String(item.badge).trim());
      
      let modeStr = (item.operation_mode || "").toUpperCase();
      if (modeStr !== "INBOUND" && modeStr !== "OUTBOUND" && modeStr !== "BOTH") {
        modeStr = "BOTH";
      }

      const cleaned = {
        badge: String(item.badge).trim(),
        login: String(item.login).trim().toLowerCase(),
        name: String(item.name).trim(),
        home_dept: String(item.home_dept || "CRETS Processing Low Side").trim(),
        manager: String(item.manager || "").trim(),
        shift_code: String(item.shift_code || "FHD").trim(),
        operation_mode: modeStr,
        default_dept: item.default_dept || "INBOUND",
        photo: item.photo || null,
        permissions: item.permissions || []
      };

      if (idx !== -1) {
        const existing = fb.associates[idx];
        cleaned.permissions = (item.permissions && item.permissions.length) ? item.permissions : (existing.permissions || []);
        cleaned.photo = item.photo || existing.photo || null;
        fb.associates[idx] = cleaned;
      } else {
        fb.associates.push(cleaned);
      }
    });

    saveFallbackData();
    return res.json({ success: true, count: associates.length });
  }

  try {
    for (const item of associates) {
      const cleanBadge = String(item.badge).trim();
      const cleanLogin = String(item.login).trim().toLowerCase();
      let modeStr = (item.operation_mode || "").toUpperCase();
      if (modeStr !== "INBOUND" && modeStr !== "OUTBOUND" && modeStr !== "BOTH") {
        modeStr = "BOTH";
      }

      await pool.query(
        `INSERT INTO associates (badge, login, name, home_dept, manager, shift_code, operation_mode, default_dept, photo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (badge) DO UPDATE SET
           login = EXCLUDED.login,
           name = EXCLUDED.name,
           home_dept = EXCLUDED.home_dept,
           manager = EXCLUDED.manager,
           shift_code = EXCLUDED.shift_code,
           operation_mode = EXCLUDED.operation_mode,
           default_dept = EXCLUDED.default_dept,
           photo = COALESCE(EXCLUDED.photo, associates.photo)`,
        [cleanBadge, cleanLogin, item.name, item.home_dept, item.manager, item.shift_code, modeStr, item.default_dept || "INBOUND", item.photo]
      );
    }
    res.json({ success: true, count: associates.length });
  } catch (err: any) {
    console.error("Bulk import error:", err);
    res.status(500).json({ error: "Bulk import failed: " + err.message });
  }
});

app.post("/api/associates/photos", async (req, res) => {
  const { photos } = req.body; // map of key (badge or login) -> base64 string
  if (!photos || typeof photos !== "object") {
    return res.status(400).json({ error: "Invalid photos object" });
  }

  if (useDbFallback) {
    const fb = getFallbackData();
    let count = 0;
    Object.entries(photos).forEach(([key, base64]: [string, any]) => {
      const lowerKey = key.toLowerCase().trim();
      const assoc = fb.associates.find((a: any) => a.badge === key || a.login.toLowerCase() === lowerKey);
      if (assoc) {
        assoc.photo = base64;
        count++;
      }
    });
    if (count > 0) {
      saveFallbackData();
    }
    return res.json({ success: true, count });
  }

  try {
    let count = 0;
    for (const [key, base64] of Object.entries(photos)) {
      const cleanKey = String(key).trim();
      const lowerKey = cleanKey.toLowerCase();
      
      const resDb = await pool.query(
        `UPDATE associates SET photo = $1 WHERE badge = $2 OR LOWER(login) = $3`,
        [base64, cleanKey, lowerKey]
      );
      if (resDb.rowCount && resDb.rowCount > 0) {
        count++;
      }
    }
    res.json({ success: true, count });
  } catch (err: any) {
    console.error("Update photos error:", err);
    res.status(500).json({ error: "Updating photos failed: " + err.message });
  }
});

app.delete("/api/associates/:badge", async (req, res) => {
  const { badge } = req.params;
  if (useDbFallback) {
    const fb = getFallbackData();
    fb.associates = fb.associates.filter((a: any) => a.badge !== badge);
    saveFallbackData();
    return res.json({ success: true });
  }
  try {
    await pool.query("DELETE FROM associates WHERE badge = $1", [badge]);
    await pool.query("DELETE FROM permissions WHERE badge = $1", [badge]);
    res.json({ success: true });
  } catch (err: any) {
    console.error("DELETE associate error:", err);
    res.status(500).json({ error: "Deleting associate failed: " + err.message });
  }
});

app.post("/api/permissions/bulk", async (req, res) => {
  const { certifications } = req.body; // Array of { badge, path_name, lc_level }
  if (!certifications || !Array.isArray(certifications)) {
    return res.status(400).json({ error: "Invalid certifications list" });
  }

  if (useDbFallback) {
    const fb = getFallbackData();
    let count = 0;
    certifications.forEach((item: any) => {
      const bStr = String(item.badge).trim();
      const pName = String(item.path_name).trim();
      const lv = parseInt(item.lc_level) || 1;

      const assoc = fb.associates.find((a: any) => a.badge === bStr);
      if (assoc) {
        if (!assoc.permissions) assoc.permissions = [];
        const existing = assoc.permissions.find((p: any) => p.path_name.toLowerCase() === pName.toLowerCase());
        if (existing) {
          existing.lc_level = lv;
        } else {
          // find active standard path name casing
          const canonicalPath = fb.paths.find((p: any) => p.name.toLowerCase() === pName.toLowerCase());
          assoc.permissions.push({ path_name: canonicalPath ? canonicalPath.name : pName, lc_level: lv });
        }
        count++;
      }
    });

    if (count > 0) {
      saveFallbackData();
    }
    return res.json({ success: true, count });
  }

  try {
    let count = 0;
    for (const item of certifications) {
      const bStr = String(item.badge).trim();
      const pName = String(item.path_name).trim();
      const lv = parseInt(item.lc_level) || 1;

      // Find path_id based on path_name
      const pathRes = await pool.query("SELECT id FROM paths WHERE LOWER(name) = LOWER($1) LIMIT 1", [pName]);
      if (pathRes.rows.length > 0) {
        const path_id = pathRes.rows[0].id;
        await pool.query(
          "INSERT INTO permissions (badge, path_id, lc_level) VALUES ($1, $2, $3) ON CONFLICT (badge, path_id) DO UPDATE SET lc_level = EXCLUDED.lc_level",
          [bStr, path_id, lv]
        );
        count++;
      }
    }
    return res.json({ success: true, count });
  } catch (err: any) {
    console.error("Bulk permissions import error:", err);
    res.status(500).json({ error: "Bulk permissions import failed: " + err.message });
  }
});

app.post("/api/permissions", async (req, res) => {
  const { badge, path_id, lc_level } = req.body;
  if (useDbFallback) {
    const fb = getFallbackData();
    const assoc = fb.associates.find((a: any) => a.badge === badge);
    if (assoc) {
      const pathObj = fb.paths.find((p: any) => p.id === path_id);
      if (pathObj) {
        if (!assoc.permissions) assoc.permissions = [];
        const existing = assoc.permissions.find((p: any) => p.path_name === pathObj.name);
        if (existing) {
          existing.lc_level = lc_level;
        } else {
          assoc.permissions.push({ path_name: pathObj.name, lc_level });
        }
        saveFallbackData();
        return res.json(assoc);
      }
    }
    return res.status(404).json({ error: "Not found" });
  }

  try {
    await pool.query(
      "INSERT INTO permissions (badge, path_id, lc_level) VALUES ($1, $2, $3) ON CONFLICT (badge, path_id) DO UPDATE SET lc_level = EXCLUDED.lc_level",
      [badge, path_id, lc_level]
    );
    
    // Return associate state
    const assocRes = await pool.query("SELECT * FROM associates WHERE badge = $1", [badge]);
    if (assocRes.rows.length > 0) {
      const row = assocRes.rows[0];
      const permRes = await pool.query("SELECT p.*, pt.name as path_name FROM permissions p LEFT JOIN paths pt ON p.path_id = pt.id WHERE p.badge = $1", [badge]);
      const permissions = permRes.rows.map((p: any) => ({ path_id: p.path_id, lc_level: p.lc_level, path_name: p.path_name || "" }));
      return res.json({
        ...row,
        permissions
      });
    }
    res.status(404).json({ error: "Associate not found" });
  } catch (err: any) {
    console.error("POST /api/permissions error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/reset-shift", async (req, res) => {
  if (useDbFallback) {
    const fb = getFallbackData();
    fb.assignments = {};
    fb.stations.forEach((s: any) => {
      s.occupied = false;
      s.occupied_by = null;
      s.active_half1 = true;
      s.active_half2 = true;
      s.status = "OPERATIONAL";
    });
    fb.lines.forEach((l: any) => {
      l.active_half1 = true;
      l.active_half2 = true;
    });
    saveFallbackData();
  } else {
    try {
      await pool.query("DELETE FROM assignments");
      await pool.query("DELETE FROM settings WHERE key = 'placements'");
      await pool.query("UPDATE stations SET occupied = false, occupied_by = NULL, active_half1 = true, active_half2 = true, status = 'OPERATIONAL'");
      await pool.query("UPDATE lines SET active_half1 = true, active_half2 = true");
    } catch (e) {
      console.error(e);
    }
  }
  res.json({ success: true });
});

app.get("/api/placements", async (req, res) => {
  if (useDbFallback) {
    const fb = getFallbackData();
    return res.json({
      contextStations: fb.assignments?.contextStations || {},
      contextBadges: fb.assignments?.contextBadges || {},
      shiftAssignments: fb.assignments?.shiftAssignments || {},
      shiftType: fb.assignments?.shiftType || "DAY",
      staffDate: fb.assignments?.staffDate || new Date().toISOString().split("T")[0],
      laborShareEnabled: fb.assignments?.laborShareEnabled || false,
      laborShareCount: fb.assignments?.laborShareCount || 0,
      preStaffMode: fb.assignments?.preStaffMode || false,
      dateLineOverrides: fb.assignments?.dateLineOverrides || {},
      dateStationOverrides: fb.assignments?.dateStationOverrides || {},
      savedPrestaffedLayouts: fb.assignments?.savedPrestaffedLayouts || []
    });
  } else {
    try {
      const dbRes = await pool.query("SELECT value FROM settings WHERE key = 'placements'");
      if (dbRes.rows.length) {
        return res.json(JSON.parse(dbRes.rows[0].value));
      }
    } catch (e) {
      console.error(e);
    }
    res.json({ 
      contextStations: {}, 
      contextBadges: {}, 
      shiftAssignments: {}, 
      shiftType: "DAY", 
      staffDate: new Date().toISOString().split("T")[0], 
      laborShareEnabled: false, 
      laborShareCount: 0,
      preStaffMode: false,
      dateLineOverrides: {},
      dateStationOverrides: {},
      savedPrestaffedLayouts: []
    });
  }
});

app.post("/api/placements", async (req, res) => {
  const { 
    contextStations, 
    contextBadges, 
    shiftAssignments, 
    shiftType, 
    staffDate, 
    laborShareEnabled, 
    laborShareCount,
    preStaffMode,
    dateLineOverrides,
    dateStationOverrides,
    savedPrestaffedLayouts
  } = req.body;
  if (shiftAssignments) {
    pruneOldShiftAssignments(shiftAssignments);
  }
  if (useDbFallback) {
    const fb = getFallbackData();
    fb.assignments = { 
      contextStations, 
      contextBadges, 
      shiftAssignments, 
      shiftType, 
      staffDate, 
      laborShareEnabled, 
      laborShareCount,
      preStaffMode,
      dateLineOverrides,
      dateStationOverrides,
      savedPrestaffedLayouts
    };
    saveFallbackData();
  } else {
    try {
      const val = JSON.stringify({ 
        contextStations, 
        contextBadges, 
        shiftAssignments, 
        shiftType, 
        staffDate, 
        laborShareEnabled, 
        laborShareCount,
        preStaffMode,
        dateLineOverrides,
        dateStationOverrides,
        savedPrestaffedLayouts
      });
      await pool.query(
        "INSERT INTO settings (key, value) VALUES ('placements', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
        [val]
      );
    } catch (e) {
      console.error(e);
    }
  }
  res.json({ success: true });
});

// High-performance scanning endpoint
app.post("/api/scan", async (req, res) => {
  const { badge, laborShareEnabled, laborShareCount } = req.body;
  if (!badge) return res.status(400).json({ error: "Badge is required" });

  // Enforce current real-time shift and date for live scanning
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
  const staffDate = `${year}-${month}-${day}`;

  try {
    let fb: any;
    if (useDbFallback) {
      fb = getFallbackData();
    } else {
      const pathsDb = await pool.query("SELECT * FROM paths");
      const linesDb = await pool.query("SELECT * FROM lines");
      const stationsDb = await pool.query("SELECT * FROM stations");
      const assocDb = await pool.query("SELECT * FROM associates");
      
      const permDb = await pool.query("SELECT p.*, pt.name as path_name FROM permissions p LEFT JOIN paths pt ON p.path_id = pt.id");
      const permMap: Record<string, any[]> = {};
      permDb.rows.forEach((p: any) => {
        if (!permMap[p.badge]) permMap[p.badge] = [];
        permMap[p.badge].push({ path_id: p.path_id, lc_level: p.lc_level, path_name: p.path_name || "" });
      });

      const associates = assocDb.rows.map((row: any) => ({
        badge: row.badge,
        login: row.login,
        name: row.name,
        home_dept: row.home_dept,
        manager: row.manager,
        shift_code: row.shift_code,
        operation_mode: row.operation_mode,
        default_dept: row.default_dept,
        photo: row.photo,
        permissions: permMap[row.badge] || [],
        current_path_id: row.current_path_id,
        current_station_id: row.current_station_id,
        current_path_start: row.current_path_start ? Number(row.current_path_start) : null
      }));

      let assignmentsObj: any = {};
      const dbRes = await pool.query("SELECT value FROM settings WHERE key = 'placements'");
      if (dbRes.rows.length) {
        assignmentsObj = JSON.parse(dbRes.rows[0].value);
      }

      let crossDeptUsageObj: any = {};
      const crossRes = await pool.query("SELECT value FROM settings WHERE key = 'crossDeptUsage'");
      if (crossRes.rows.length) {
        crossDeptUsageObj = JSON.parse(crossRes.rows[0].value);
      }

      fb = {
        paths: pathsDb.rows.map((row: any) => ({
          ...row,
          department: row.mode || (row.dept_id === 1 ? "INBOUND" : "OUTBOUND"),
          rotation_hours: row.rotation_hours !== null && row.rotation_hours !== undefined ? row.rotation_hours : 10
        })),
        lines: linesDb.rows,
        stations: stationsDb.rows,
        associates: associates,
        assignments: assignmentsObj,
        settings: {
          crossDeptUsage: crossDeptUsageObj
        }
      };
    }

    const assoc = fb.associates.find((a: any) => a.badge === badge || a.login === badge.toLowerCase());
    if (!assoc) {
      return res.status(404).json({ error: "Associate not found" });
    }

    let targetDept = assoc.operation_mode === "BOTH" ? (assoc.default_dept || "INBOUND") : assoc.operation_mode;
    let isCrossDept = false;

    const dateStr = staffDate;
    const contextKey = `live|${dateStr}|${shiftType}`;
    const ctx = `${dateStr}|${shiftType}|${targetDept}`;
    const sKey = `${targetDept}|${dateStr}|${shiftType}`;

    if (!fb.assignments) fb.assignments = {};
    if (!fb.assignments.contextStations) fb.assignments.contextStations = {};
    if (!fb.assignments.contextBadges) fb.assignments.contextBadges = {};
    if (!fb.assignments.shiftAssignments) fb.assignments.shiftAssignments = {};

    const contextStations = fb.assignments.contextStations;
    const contextBadges = fb.assignments.contextBadges;
    const shiftAssignments = fb.assignments.shiftAssignments;
    pruneOldShiftAssignments(shiftAssignments);

    const getCrossDeptUsed = (k: string) => {
      if (!fb.settings.crossDeptUsage) fb.settings.crossDeptUsage = {};
      return fb.settings.crossDeptUsage[k] || 0;
    };

    const incrementCrossDept = (k: string) => {
      if (!fb.settings.crossDeptUsage) fb.settings.crossDeptUsage = {};
      fb.settings.crossDeptUsage[k] = (fb.settings.crossDeptUsage[k] || 0) + 1;
    };

    if (assoc.operation_mode === "BOTH" && laborShareEnabled) {
      const defaultDept = assoc.default_dept || "INBOUND";
      const otherDept = defaultDept === "INBOUND" ? "OUTBOUND" : "INBOUND";
      const used = getCrossDeptUsed(contextKey);
      if (laborShareCount === 0 || used < laborShareCount) {
        const hasOtherDeptPerm = (assoc.permissions || []).some((p: any) => {
          const path = fb.paths.find((fp: any) => fp.name === p.path_name);
          return path && path.department === otherDept;
        });
        if (hasOtherDeptPerm) {
          targetDept = otherDept;
          isCrossDept = true;
        }
      }
    }

    const half = getHalf(staffDate, shiftType, targetDept);

    const getBadgeAssignment = (c: string, b: string, h: string) => {
      return contextBadges[c]?.[b]?.[h] || null;
    };

    const setBadgeAssignment = (c: string, b: string, h: string, sid: number) => {
      if (!contextBadges[c]) contextBadges[c] = {};
      if (!contextBadges[c][b]) contextBadges[c][b] = {};
      contextBadges[c][b][h] = sid;
    };

    const getStationAssignment = (c: string, sid: number, h: string) => {
      return contextStations[c]?.[sid]?.[h] || null;
    };

    const setStationAssignment = (c: string, sid: number, h: string, assignment: any) => {
      if (!contextStations[c]) contextStations[c] = {};
      if (!contextStations[c][sid]) contextStations[c][sid] = {};
      contextStations[c][sid][h] = assignment;
    };

    // Context Placement Synchronization
    const assignedStIdH1 = getBadgeAssignment(ctx, assoc.badge, "half1");
    const assignedStIdH2 = getBadgeAssignment(ctx, assoc.badge, "half2");

    const activeH1Asn = assignedStIdH1 ? getStationAssignment(ctx, assignedStIdH1, "half1") : null;
    const activeH2Asn = assignedStIdH2 ? getStationAssignment(ctx, assignedStIdH2, "half2") : null;

    let h1: any = null;
    let h2: any = null;

    if (activeH1Asn) {
      const stObj = fb.stations.find((s: any) => s.id === assignedStIdH1);
      const pathObj = fb.paths.find((p: any) => p.name === activeH1Asn.path);
      const rotHours = pathObj ? (pathObj.rotation_hours !== undefined ? pathObj.rotation_hours : 10) : 10;
      h1 = {
        path: activeH1Asn.path,
        station: stObj ? { ...stObj, line_name: fb.lines.find((l: any) => l.id === stObj.line_id)?.name || "" } : null,
        score: 5,
        lc: 5,
        roleType: pathObj ? ((rotHours <= 5 || pathObj.role_type === "INDIRECT") ? "INDIRECT" : "DIRECT") : activeH1Asn.roleType || "MANUAL",
        rotationHours: rotHours,
        breakdown: [],
        allScores: []
      };
    }

    if (activeH2Asn) {
      const stObj = fb.stations.find((s: any) => s.id === assignedStIdH2);
      const pathObj = fb.paths.find((p: any) => p.name === activeH2Asn.path);
      const rotHours = pathObj ? (pathObj.rotation_hours !== undefined ? pathObj.rotation_hours : 10) : 10;
      h2 = {
        path: activeH2Asn.path,
        station: stObj ? { ...stObj, line_name: fb.lines.find((l: any) => l.id === stObj.line_id)?.name || "" } : null,
        score: 5,
        lc: 5,
        roleType: pathObj ? ((rotHours <= 5 || pathObj.role_type === "INDIRECT") ? "INDIRECT" : "DIRECT") : activeH2Asn.roleType || "MANUAL",
        rotationHours: rotHours,
        breakdown: [],
        allScores: []
      };
    }

    if (activeH1Asn && activeH2Asn) {
      return res.json({
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
        consec3: consec3Indirect(assoc.badge, targetDept, shiftAssignments),
        dept: targetDept,
        assignedDept: targetDept
      });
    }

    const scored = fb.paths
      .filter((fp: any) => fp.department === targetDept)
      .map((fp: any) => {
        const s = scoreOnePath(assoc, fp.name, targetDept, dateStr, fb.paths, shiftAssignments);
        if (!s) return null;
        return { path: fp.name, ...s, pathObj: fp };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.score - a.score);

    if (!scored.length) {
      return res.json({
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
      });
    }

    let chosen: any = null;
    let isOpenH1 = false;
    let isOpenH2 = false;

    // Evaluate required halves
    const needH1 = !activeH1Asn;
    const needH2 = !activeH2Asn;

    for (const item of scored) {
      const h1Available = needH1 ? isPathOpenForHalf(item.pathObj.id, "half1", targetDept, dateStr, shiftType, fb.lines, fb.stations, contextStations) : true;
      const h2Available = needH2 ? isPathOpenForHalf(item.pathObj.id, "half2", targetDept, dateStr, shiftType, fb.lines, fb.stations, contextStations) : true;
      if (h1Available && h2Available) {
        chosen = item;
        isOpenH1 = needH1 ? h1Available : false;
        isOpenH2 = needH2 ? h2Available : false;
        break;
      }
    }

    if (!chosen) {
      for (const item of scored) {
        const h1Available = needH1 && isPathOpenForHalf(item.pathObj.id, "half1", targetDept, dateStr, shiftType, fb.lines, fb.stations, contextStations);
        const h2Available = needH2 && isPathOpenForHalf(item.pathObj.id, "half2", targetDept, dateStr, shiftType, fb.lines, fb.stations, contextStations);
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
          const chosenSt = openStForPath(chosen.pathObj.id, "half1", targetDept, dateStr, shiftType, fb.lines, fb.stations, contextStations);
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
        const isH1FiveHour = h1 ? ((h1.rotationHours !== undefined ? h1.rotationHours : 10) <= 5 || h1.roleType === "INDIRECT") : false;
        let actualH2Chosen = chosen;
        let actualH2Open = isOpenH2;
        let isForcedH2Admin = false;

        if (isH1FiveHour) {
          // If first half is a capped 5 HR indirect path, find an alternative 10-hour direct path for the 2nd half
          let altH2 = null;
          for (const item of scored) {
            const rotHours = item.rotationHours !== undefined ? item.rotationHours : 10;
            const isInd = rotHours <= 5 || item.roleType === "INDIRECT";
            if (!isInd) {
              const av = isPathOpenForHalf(item.pathObj.id, "half2", targetDept, dateStr, shiftType, fb.lines, fb.stations, contextStations);
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
          const h2St = openStForPath(actualH2Chosen.pathObj.id, "half2", targetDept, dateStr, shiftType, fb.lines, fb.stations, contextStations);
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

    if (isCrossDept) incrementCrossDept(contextKey);

    if (useDbFallback) {
      saveFallbackData();
    } else {
      await pool.query(
        "INSERT INTO settings (key, value) VALUES ('placements', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
        [JSON.stringify(fb.assignments)]
      );
      await pool.query(
        "INSERT INTO settings (key, value) VALUES ('crossDeptUsage', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
        [JSON.stringify(fb.settings?.crossDeptUsage || {})]
      );
    }

    return res.json({
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
      consec3: consec3Indirect(assoc.badge, targetDept, shiftAssignments),
      dept: targetDept,
      assignedDept: targetDept
    });
  } catch (err: any) {
    console.error("Scanning endpoint exception:", err);
    res.status(500).json({ error: "Active scanning processor error: " + err.message });
  }
});

// ========== REALTIME STATION AUDITS ENDPOINTS ==========
app.get("/api/station-audits", async (req, res) => {
  if (useDbFallback) {
    const fb = getFallbackData();
    if (!fb.station_audits) fb.station_audits = [];
    return res.json(fb.station_audits.slice().sort((a: any, b: any) => b.scanned_at - a.scanned_at));
  } else {
    try {
      const dbRes = await pool.query("SELECT * FROM station_audits ORDER BY scanned_at DESC");
      res.json(dbRes.rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
});

// Helper to synchronize scan check-in/out with live assignments and station occupied fields
async function updateScanAssignmentInPlacements(pathName: string, stationName: string, badge: string, isCheckout: boolean) {
  // 1. Load current placements
  let placements: any = {
    contextStations: {},
    contextBadges: {},
    shiftAssignments: {},
    shiftType: "DAY",
    staffDate: new Date().toISOString().split("T")[0],
    laborShareEnabled: false,
    laborShareCount: 0,
    preStaffMode: false,
    dateLineOverrides: {},
    dateStationOverrides: {},
    savedPrestaffedLayouts: []
  };

  if (useDbFallback) {
    const fb = getFallbackData();
    if (fb.assignments) {
      placements = { ...placements, ...fb.assignments };
    }
  } else {
    try {
      const dbRes = await pool.query("SELECT value FROM settings WHERE key = 'placements'");
      if (dbRes.rows.length) {
        placements = { ...placements, ...JSON.parse(dbRes.rows[0].value) };
      }
    } catch (e) {
      console.error("Error reading placements from DB settings:", e);
    }
  }

  // Ensure dictionaries exist
  if (!placements.contextStations) placements.contextStations = {};
  if (!placements.contextBadges) placements.contextBadges = {};

  const activeDate = placements.staffDate || new Date().toISOString().split("T")[0];
  const activeShift = placements.shiftType || "DAY";

  // 2. Find station & details
  let pathObj: any = null;
  let stationObj: any = null;
  let assocObj: any = null;

  if (useDbFallback) {
    const fb = getFallbackData();
    const normPath = pathName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const normSt = stationName.toLowerCase().replace(/[^a-z0-9]/g, "");

    pathObj = fb.paths.find((p: any) => p.name.toLowerCase().replace(/[^a-z0-9]/g, "") === normPath || p.name.toLowerCase().includes(normPath) || normPath.includes(p.name.toLowerCase()));
    if (pathObj) {
      const lineIds = fb.lines.filter((l: any) => l.path_id === pathObj.id).map((l: any) => l.id);
      stationObj = fb.stations.find((s: any) => s.name.toLowerCase().replace(/[^a-z0-9]/g, "") === normSt && lineIds.includes(s.line_id));
    }
    if (badge) {
      assocObj = fb.associates.find((a: any) => a.badge === badge || a.login?.toLowerCase() === badge.toLowerCase());
    }
  } else {
    try {
      let normPath = "%" + pathName.trim().replace(/Processing/gi, "").replace(/Path/gi, "").trim() + "%";
      const pathRes = await pool.query("SELECT * FROM paths WHERE name ILIKE $1 OR name ILIKE $2 LIMIT 1", [`%${pathName.trim()}%`, normPath]);
      if (pathRes.rows.length) {
        pathObj = pathRes.rows[0];
        const linesRes = await pool.query("SELECT id FROM lines WHERE path_id = $1", [pathObj.id]);
        const lineIds = linesRes.rows.map((row: any) => row.id);
        if (lineIds.length > 0) {
          const stRes = await pool.query("SELECT * FROM stations WHERE name = $1 AND line_id = ANY($2) LIMIT 1", [stationName.trim(), lineIds]);
          if (stRes.rows.length) {
            stationObj = stRes.rows[0];
          }
        }
      }
      if (badge) {
        const assocRes = await pool.query("SELECT * FROM associates WHERE badge = $1 OR LOWER(login) = LOWER($1) LIMIT 1", [badge]);
        if (assocRes.rows.length) {
          assocObj = assocRes.rows[0];
        }
      }
    } catch (e) {
      console.error("DB match error:", e);
    }
  }

  if (!stationObj || !pathObj) {
    console.warn("Could not find station/path to assign for scan audit:", pathName, stationName);
    return;
  }

  const dept = pathObj.department || pathObj.mode || "INBOUND";
  const ctxKey = `${activeDate}|${activeShift}|${dept}`;

  if (!placements.contextStations[ctxKey]) {
    placements.contextStations[ctxKey] = {};
  }
  if (!placements.contextBadges[ctxKey]) {
    placements.contextBadges[ctxKey] = {};
  }

  if (isCheckout) {
    // Check out of this station
    const currentAssignments = placements.contextStations[ctxKey]?.[stationObj.id] || {};
    ["half1", "half2"].forEach(half => {
      const ass = currentAssignments[half];
      if (ass && ass.badge) {
        if (placements.contextBadges[ctxKey]?.[ass.badge]) {
          delete placements.contextBadges[ctxKey][ass.badge][half];
          if (Object.keys(placements.contextBadges[ctxKey][ass.badge]).length === 0) {
            delete placements.contextBadges[ctxKey][ass.badge];
          }
        }
      }
    });

    if (placements.contextStations[ctxKey]?.[stationObj.id]) {
      delete placements.contextStations[ctxKey][stationObj.id];
    }

    // Also update stations table / local array state!
    if (useDbFallback) {
      const fb = getFallbackData();
      const st = fb.stations.find((s: any) => s.id === stationObj.id);
      if (st) {
        st.occupied = false;
        st.occupied_by = null;
        st.occupied_since = null;
      }
    } else {
      try {
        await pool.query("UPDATE stations SET occupied = false, occupied_by = NULL, occupied_since = NULL WHERE id = $1", [stationObj.id]);
      } catch (e) {
        console.error(e);
      }
    }

  } else if (assocObj) {
    // Clear any previous assignments of this badge in this shift to prevent duplicate placements!
    const badgeVal = assocObj.badge;
    Object.keys(placements.contextStations[ctxKey]).forEach(sIdStr => {
      const sId = parseInt(sIdStr);
      ["half1", "half2"].forEach(half => {
        if (placements.contextStations[ctxKey]?.[sId]?.[half]?.badge === badgeVal) {
          delete placements.contextStations[ctxKey][sId][half];
        }
      });
      if (placements.contextStations[ctxKey][sId] && Object.keys(placements.contextStations[ctxKey][sId]).length === 0) {
        delete placements.contextStations[ctxKey][sId];
      }
    });

    // Write new assignments
    if (!placements.contextStations[ctxKey][stationObj.id]) {
      placements.contextStations[ctxKey][stationObj.id] = {};
    }
    const asn = {
      login: assocObj.login,
      name: assocObj.name,
      badge: assocObj.badge,
      path: pathObj.name,
      roleType: "MANUAL",
      assignedAt: Date.now(),
      method: "SCAN",
      dept,
      half: "half1"
    };

    placements.contextStations[ctxKey][stationObj.id]["half1"] = { ...asn, half: "half1" };
    placements.contextStations[ctxKey][stationObj.id]["half2"] = { ...asn, half: "half2" };

    if (!placements.contextBadges[ctxKey][assocObj.badge]) {
      placements.contextBadges[ctxKey][assocObj.badge] = {};
    }
    placements.contextBadges[ctxKey][assocObj.badge]["half1"] = stationObj.id;
    placements.contextBadges[ctxKey][assocObj.badge]["half2"] = stationObj.id;

    // Also update stations table / local array state!
    if (useDbFallback) {
      const fb = getFallbackData();
      const st = fb.stations.find((s: any) => s.id === stationObj.id);
      if (st) {
        st.occupied = true;
        st.occupied_by = assocObj.name;
        st.occupied_since = Date.now();
      }
    } else {
      try {
        await pool.query("UPDATE stations SET occupied = true, occupied_by = $1, occupied_since = $2 WHERE id = $3", [assocObj.name, Date.now(), stationObj.id]);
      } catch (e) {
        console.error(e);
      }
    }
  }

  // 3. Save placements config
  if (useDbFallback) {
    const fb = getFallbackData();
    fb.assignments = placements;
    saveFallbackData();
  } else {
    try {
      await pool.query(
        "INSERT INTO settings (key, value) VALUES ('placements', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
        [JSON.stringify(placements)]
      );
    } catch (e) {
      console.error("Error saving placements back to DB settings:", e);
    }
  }
}

app.post("/api/station-audits/scan", async (req, res) => {
  const { path_name, station_name, badge } = req.body;
  if (!path_name || !station_name || !badge) {
    return res.status(400).json({ error: "Missing path_name, station_name, or badge" });
  }

  let associate_name = "Unknown Associate";
  if (useDbFallback) {
    const fb = getFallbackData();
    const assoc = fb.associates.find((a: any) => a.badge === badge || a.login?.toLowerCase() === badge.toLowerCase());
    if (assoc) {
      associate_name = assoc.name;
    }
    if (!fb.station_audits) fb.station_audits = [];
    const nextId = fb.station_audits.reduce((max: number, a: any) => Math.max(max, a.id || 0), 0) + 1;
    const newAudit = {
      id: nextId,
      path_name,
      station_name,
      badge,
      associate_name,
      scanned_at: Date.now()
    };
    fb.station_audits.push(newAudit);
    saveFallbackData();
    await updateScanAssignmentInPlacements(path_name, station_name, badge, false);
    return res.json(newAudit);
  } else {
    try {
      const assocRes = await pool.query(
        "SELECT name FROM associates WHERE badge = $1 OR LOWER(login) = LOWER($1)",
        [badge]
      );
      if (assocRes.rows.length > 0) {
        associate_name = assocRes.rows[0].name;
      }
      const dbRes = await pool.query(
        "INSERT INTO station_audits (path_name, station_name, badge, associate_name, scanned_at) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [path_name, station_name, badge, associate_name, Date.now()]
      );
      await updateScanAssignmentInPlacements(path_name, station_name, badge, false);
      res.json(dbRes.rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
});

app.post("/api/station-audits/leave", async (req, res) => {
  const { path_name, station_name } = req.body;
  if (!path_name || !station_name) {
    return res.status(400).json({ error: "Missing path_name or station_name" });
  }

  let associate_name = "Left Station / Checked Out";
  let badge = "UNOCCUPIED";

  if (useDbFallback) {
    const fb = getFallbackData();
    if (!fb.station_audits) fb.station_audits = [];
    const nextId = fb.station_audits.reduce((max: number, a: any) => Math.max(max, a.id || 0), 0) + 1;
    const newAudit = {
      id: nextId,
      path_name,
      station_name,
      badge,
      associate_name,
      scanned_at: Date.now()
    };
    fb.station_audits.push(newAudit);
    saveFallbackData();
    await updateScanAssignmentInPlacements(path_name, station_name, "", true);
    return res.json(newAudit);
  } else {
    try {
      const dbRes = await pool.query(
        "INSERT INTO station_audits (path_name, station_name, badge, associate_name, scanned_at) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [path_name, station_name, badge, associate_name, Date.now()]
      );
      await updateScanAssignmentInPlacements(path_name, station_name, "", true);
      res.json(dbRes.rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
});

app.delete("/api/station-audits/clear", async (req, res) => {
  if (useDbFallback) {
    const fb = getFallbackData();
    fb.station_audits = [];
    saveFallbackData();
    return res.json({ success: true });
  } else {
    try {
      await pool.query("DELETE FROM station_audits");
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
});

// ========== ADMIN PROFILES & PRIORITIES ENDPOINTS ==========
app.get("/api/admin/profiles", async (req, res) => {
  if (useDbFallback) {
    const fb = getFallbackData();
    if (!fb.admin_profiles) fb.admin_profiles = [];
    if (fb.admin_profiles.length === 0) {
      fb.admin_profiles.push({ id: 1, name: "System Admin", login: "admin", pin: "12345", role: "Manager", created_at: Date.now() });
      saveFallbackData();
    }
    return res.json(fb.admin_profiles);
  } else {
    try {
      const dbRes = await pool.query("SELECT * FROM admin_profiles ORDER BY id ASC");
      res.json(dbRes.rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
});

app.post("/api/admin/profiles", async (req, res) => {
  const { name, role, login, pin } = req.body;
  if (!name || !login || !pin) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  if (useDbFallback) {
    const fb = getFallbackData();
    if (!fb.admin_profiles) fb.admin_profiles = [];
    const loginExists = fb.admin_profiles.some((p: any) => p.login === login);
    if (loginExists) {
      return res.status(400).json({ error: "Username already exists" });
    }
    const nextId = fb.admin_profiles.reduce((max: number, p: any) => Math.max(max, p.id || 0), 0) + 1;
    const newProf = { id: nextId, name, role: role || "Manager", login, pin, created_at: Date.now() };
    fb.admin_profiles.push(newProf);
    saveFallbackData();
    return res.json(newProf);
  } else {
    try {
      const check = await pool.query("SELECT id FROM admin_profiles WHERE login = $1", [login]);
      if (check.rows.length > 0) {
        return res.status(400).json({ error: "Username already exists" });
      }
      const dbRes = await pool.query(
        "INSERT INTO admin_profiles (name, role, login, pin) VALUES ($1, $2, $3, $4) RETURNING *",
        [name, role || "Manager", login, pin]
      );
      res.json(dbRes.rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
});

app.delete("/api/admin/profiles/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid ID" });
  }
  if (useDbFallback) {
    const fb = getFallbackData();
    if (!fb.admin_profiles) fb.admin_profiles = [];
    fb.admin_profiles = fb.admin_profiles.filter((p: any) => p.id !== id);
    saveFallbackData();
    return res.json({ success: true });
  } else {
    try {
      await pool.query("DELETE FROM admin_profiles WHERE id = $1", [id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
});

app.post("/api/admin/login", async (req, res) => {
  const { login, pin } = req.body;
  if (!login || !pin) {
    return res.status(400).json({ error: "Missing login or pin" });
  }
  if (useDbFallback) {
    const fb = getFallbackData();
    if (!fb.admin_profiles) fb.admin_profiles = [];
    if (fb.admin_profiles.length === 0) {
      fb.admin_profiles.push({ id: 1, name: "System Admin", login: "admin", pin: "12345", role: "Manager", created_at: Date.now() });
      saveFallbackData();
    }
    const matched = fb.admin_profiles.find((p: any) => p.login === login && p.pin === pin);
    if (matched) {
      return res.json({ id: matched.id, name: matched.name, login: matched.login, role: matched.role });
    } else {
      return res.status(401).json({ error: "Invalid login credentials or PIN code" });
    }
  } else {
    try {
      const dbRes = await pool.query("SELECT * FROM admin_profiles WHERE login = $1 AND pin = $2", [login, pin]);
      if (dbRes.rows.length > 0) {
        const matched = dbRes.rows[0];
        return res.json({ id: matched.id, name: matched.name, login: matched.login, role: matched.role });
      } else {
        return res.status(401).json({ error: "Invalid login credentials or PIN code" });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
});

app.get("/api/path-priorities", async (req, res) => {
  if (useDbFallback) {
    const fb = getFallbackData();
    return res.json(fb.paths || []);
  } else {
    try {
      const dbRes = await pool.query("SELECT id, name, priority FROM paths ORDER BY id ASC");
      res.json(dbRes.rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
});

app.patch("/api/path-priorities/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { priority } = req.body;
  if (isNaN(id) || priority === undefined) {
    return res.status(400).json({ error: "Invalid ID or priority" });
  }
  if (useDbFallback) {
    const fb = getFallbackData();
    const p = fb.paths.find((item: any) => item.id === id);
    if (p) {
      p.priority = priority;
      saveFallbackData();
      return res.json({ success: true, path: p });
    } else {
      return res.status(404).json({ error: "Path not found" });
    }
  } else {
    try {
      await pool.query("UPDATE paths SET priority = $1 WHERE id = $2", [parseInt(priority), id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
});

app.get("/api/floor-custom", async (req, res) => {
  res.json({ paths: [], lines: [], stations: [] });
});

app.get("/api/floor-custom-renames", async (req, res) => {
  res.json({ renames: {} });
});

// ========== START SERVER ==========
async function startServer() {
  await initTables();

  if (process.env.NODE_ENV !== "production") {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

startServer();
