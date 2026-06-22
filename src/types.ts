export interface Permission {
  path_name: string;
  lc_level: number;
}

export interface Associate {
  badge: string;
  login: string;
  name: string;
  home_dept: string;
  manager: string;
  shift_code: string;
  operation_mode: "INBOUND" | "OUTBOUND" | "BOTH";
  default_dept?: string;
  active?: boolean;
  permissions?: Permission[];
  weekHours?: { path_name: string; hours: number; mode: string }[];
  yesterdayRoles?: { path_name: string; hours: number }[];
  photo?: string;
}

export interface StationAssignment {
  login: string;
  name: string;
  badge: string;
  path: string;
  roleType: string;
  assignedAt: number;
  method: "SCAN" | "MANUAL" | "PRE-STAFF";
  dept: string;
  half: "half1" | "half2";
}

export interface Path {
  id: number;
  name: string;
  role_type: "DIRECT" | "INDIRECT";
  department: string;
  active?: boolean;
  rotation_hours?: number;
}

export interface Line {
  id: number;
  path_id: number;
  name: string;
  active?: boolean;
  active_half1?: boolean;
  active_half2?: boolean;
}

export interface Station {
  id: number;
  line_id: number;
  path_id: number;
  name: string;
  side: "ODD" | "EVEN";
  station_number: number;
  active?: boolean;
  active_half1?: boolean;
  active_half2?: boolean;
  status: "OPERATIONAL" | "ANDON" | "MAINTENANCE" | "QUALITY_HOLD" | "DISABLED";
}

export interface PerformanceRate {
  id?: number;
  badge?: string;
  login: string;
  station_id: number;
  line_name: string;
  station_name: string;
  rate: number;
  target_rate: number;
}

export interface SystemAlert {
  id: number;
  category: string;
  station_id?: number;
  station_name: string;
  line_name: string;
  plan_rate: number;
  actual_rate: number;
  deviation: number;
  acknowledged: boolean;
  resolved: boolean;
}

export function formatLocalDate(dateVal: Date | string): string {
  if (typeof dateVal === "string") {
    if (dateVal.includes("T")) {
      return dateVal.split("T")[0];
    }
    return dateVal;
  }
  if (dateVal instanceof Date) {
    if (isNaN(dateVal.getTime())) return "";
    const year = dateVal.getFullYear();
    const month = String(dateVal.getMonth() + 1).padStart(2, '0');
    const day = String(dateVal.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return "";
}

