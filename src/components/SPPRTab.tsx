import React from "react";
import { Sparkles, ArrowUpRight, ShieldCheck, Zap } from "lucide-react";

export function SPPRTab() {
  return (
    <div className="space-y-6" id="sppr-tab">
      {/* Immersive hero display card */}
      <div className="bg-radial from-slate-900 to-indigo-950 text-white rounded-3xl p-8 shadow-md border border-indigo-950/40 relative overflow-hidden">
        {/* Subtle mesh visual layers */}
        <div className="absolute right-0 top-0 w-80 h-80 bg-indigo-500 rounded-full filter blur-3xl opacity-10 -mr-20 -mt-20"></div>
        <div className="absolute left-1/3 bottom-0 w-60 h-60 bg-emerald-500 rounded-full filter blur-3xl opacity-5 -mb-20"></div>

        <div className="relative space-y-6 max-w-xl">
          <div className="inline-flex gap-2.5 items-center px-3 py-1 bg-indigo-950/80 border border-indigo-800/80 rounded-full font-mono text-[9px] font-bold tracking-widest text-indigo-300">
            <Zap className="w-3 h-3 text-amber-400 animate-pulse" />
            <span>CORE MODULE PLATFORM</span>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-white leading-tight font-sans">
              SPPR
            </h1>
          </div>

          <div className="flex flex-wrap gap-4 items-center">
            <span className="px-3.5 py-1.5 bg-amber-500/10 border border-amber-400/30 text-amber-300 text-[10px] font-extrabold tracking-widest uppercase rounded-lg animate-pulse font-mono">
              Coming Soon
            </span>
            <span className="text-xs text-indigo-300 font-bold font-mono">Target Deployment: Q3 Release</span>
          </div>

          <div className="pt-2 border-t border-indigo-900/40">
            <p className="text-[11px] text-indigo-300 font-mono tracking-wide">
              Supported by Alonzo Paige and Shane Burrows.
            </p>
          </div>
        </div>
      </div>

      {/* Access card & detailed specs panel */}
      <div className="grid grid-cols-1 gap-6">
        
        {/* Adapt/Engage Gateway */}
        <div className="bg-white border border-gray-250 rounded-2xl p-6 shadow-3xs flex flex-col justify-between space-y-6">
          <div className="space-y-2">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
              <ShieldCheck className="text-indigo-600 w-5 h-5" />
            </div>
            <h3 className="text-sm font-extrabold text-gray-900 tracking-tight font-sans">Adapt & Engage Integration Gateway</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Once active, this interface connects directly to tenant Adapt/Engage servers allowing automated manager credentials checking, cross-site employee registries, and real-time leadership rosters.
            </p>
          </div>

          <button
            onClick={() => alert("The Adapt/Engage Access Gateway will be fully activated upon live release of the SPPR platform.")}
            className="w-full py-3 bg-gray-50 border border-gray-250 hover:bg-gray-100 hover:border-gray-300 rounded-xl text-xs font-bold text-gray-700 cursor-pointer font-sans transition-all flex items-center justify-center gap-2 shadow-3xs"
          >
            <span>Launch Adapt/Engage Access</span>
            <ArrowUpRight className="w-4 h-4 text-gray-400 shrink-0" />
          </button>
        </div>

      </div>
    </div>
  );
}
