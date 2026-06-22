import React, { useState } from "react";
import { CheckCircle, QrCode, ArrowRight, UserCheck, ShieldAlert, Cpu } from "lucide-react";

interface ScanStationLandingProps {
  apiUrl: string;
  pathName: string;
  stationName: string;
}

export function ScanStationLanding({ apiUrl, pathName, stationName }: ScanStationLandingProps) {
  const [badge, setBadge] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successData, setSuccessData] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!badge.trim()) {
      setErrorMsg("Please enter your badge number or username.");
      return;
    }
    setErrorMsg("");
    setSubmitting(true);

    try {
      const res = await fetch(`${apiUrl}/station-audits/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path_name: pathName,
          station_name: stationName,
          badge: badge.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit attendance audit.");
      }

      const data = await res.json();
      setSuccessData(data);
    } catch (err: any) {
      setErrorMsg(err.message || "Network error. Please try again or notify your manager.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      
      {/* Background visual graphics */}
      <div className="absolute right-0 top-0 w-80 h-80 bg-indigo-500 rounded-full filter blur-3xl opacity-10 -mr-20 -mt-20"></div>
      <div className="absolute left-0 bottom-0 w-80 h-80 bg-emerald-500 rounded-full filter blur-3xl opacity-5 -ml-20 -mb-20"></div>

      <div className="w-full max-w-md bg-white border border-gray-200 shadow-2xl rounded-3xl overflow-hidden relative">
        
        {/* Modern decorative banner */}
        <div className="bg-indigo-950 px-6 py-8 text-center text-white relative">
          <div className="absolute right-4 top-4 text-indigo-500 animate-pulse">
            <Cpu className="w-5 h-5" />
          </div>
          
          <h1 className="text-sm font-mono tracking-widest text-indigo-400 font-bold uppercase mb-1">
            OPTIMUS STAFFING HUB
          </h1>
          <h2 className="text-xl font-black text-white tracking-tight">
            Station Audit Check-In
          </h2>
        </div>

        {/* Success State */}
        {successData ? (
          <div className="p-8 text-center space-y-6 animate-fade-in">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm border border-emerald-100">
              <CheckCircle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-mono font-bold text-emerald-600 uppercase tracking-widest">
                Check-In Registered!
              </p>
              <h3 className="text-lg font-bold text-gray-900 leading-tight">
                Welcome, {successData.associate_name}
              </h3>
              <p className="text-xs text-gray-400 font-mono">
                Badge Number: {successData.badge}
              </p>
            </div>

            <div className="bg-slate-50 border border-gray-200 p-4 rounded-2xl space-y-1.5 text-left">
              <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                <span>Assigned Station Details</span>
                <span className="text-indigo-600 font-mono">LIVE OK</span>
              </div>
              <p className="text-xs text-gray-500 font-mono font-medium">
                Path: <span className="text-gray-800 font-bold font-sans">{successData.path_name}</span>
              </p>
              <p className="text-xs text-gray-500 font-mono font-medium">
                Station: <span className="text-gray-800 font-bold font-sans">{successData.station_name}</span>
              </p>
            </div>

            <div className="pt-2 text-center">
              <p className="text-[11px] text-gray-400 font-sans leading-normal">
                Your presence was collected instantly. You may now close this screen and begin processing. Good luck with your shift!
              </p>
            </div>

            <button
              onClick={() => {
                setSuccessData(null);
                setBadge("");
              }}
              className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl cursor-pointer transition-all"
            >
              Do another Audit Check-In
            </button>
          </div>
        ) : (
          /* Input Form State */
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
            
            {/* Scanned Station Highlight Card */}
            <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-2xl space-y-1">
              <span className="text-[9px] font-mono font-bold text-indigo-600 uppercase tracking-widest block">
                SCANNED PHYSICAL STATION
              </span>
              <p className="text-xs font-bold text-indigo-950 font-mono">
                {pathName}
              </p>
              <h3 className="text-lg font-black text-indigo-950 font-sans tracking-tight">
                {stationName}
              </h3>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                  Verify Your Identity
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    disabled={submitting}
                    value={badge}
                    onChange={(e) => setBadge(e.target.value)}
                    placeholder="Enter your Badge Number or Login"
                    className="w-full pl-4 pr-4 py-3 text-sm bg-white border border-gray-200 rounded-xl font-sans focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 text-gray-800 placeholder-gray-400 shadow-3xs"
                  />
                </div>
                <p className="text-[10px] text-gray-400 font-sans leading-normal">
                  Enter your assigned employee ID badge number or SSO login username to check in.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3.5 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl flex items-start gap-2 animate-pulse">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span className="font-sans font-medium">{errorMsg}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Verifying and Checking In...</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />
                  <span>Confirm Check-In Audit</span>
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <span className="text-[9px] text-gray-300 font-mono tracking-widest uppercase block">
                Secured Audit Interface
              </span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
