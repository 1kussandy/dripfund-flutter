import React, { useState } from "react";

export function Leaderboard() {
  const [showUpload, setShowUpload] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [board, setBoard] = useState([
    { rank: 1, name: "Patricia Blake", login: "pblakeld", hours: 142.5, quality: 98.4 },
    { rank: 2, name: "Mory Berete", login: "moberete", hours: 135.2, quality: 99.1 },
    { rank: 3, name: "Ann Miller", login: "amiller", hours: 122.0, quality: 96.5 },
    { rank: 4, name: "Rohan Dhungana", login: "dhunroha", hours: 104.5, quality: 95.0 },
    { rank: 5, name: "Manuel Roblero", login: "mroblero", hours: 94.0, quality: 97.2 }
  ]);

  const handlePaste = () => {
    try {
      const lines = pasteText.trim().split(/\n/).filter(Boolean);
      const parsed = lines.map((l, id) => {
        const parts = l.split(",");
        const login = parts[0]?.trim() || "user";
        const name = parts[1]?.trim() || "Full name";
        const hours = parseFloat(parts[2]?.trim() || "80");
        const quality = parseFloat(parts[3]?.trim() || "95");
        return {
          rank: id + 1,
          name,
          login,
          hours,
          quality
        };
      });
      setBoard(parsed);
      setShowUpload(false);
    } catch {}
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex justify-between items-center bg-white p-4 border border-gray-200 rounded-2xl shadow-3xs flex-wrap gap-4">
        <div>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono block">Operator Merit League</span>
          <p className="text-xs text-gray-500 mt-0.5 font-semibold text-indigo-600">Top high-side operators ordered by monthly active hours (Quality Profile &gt; 80%).</p>
        </div>

        <button onClick={() => setShowUpload(!showUpload)} className="px-3.5 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer border-none shadow-3xs uppercase font-mono">
          {showUpload ? "Hide Score Paste" : "Paste Quality Scores"}
        </button>
      </div>

      {showUpload && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-3xs space-y-4">
          <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-1.5">Paste CSV payload line-by-line (Format: login,name,hours,quality_score)</label>
          <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} rows={4} placeholder="amiller,Ann Miller,122.0,96.5" className="w-full text-xs font-mono p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-indigo-650" />
          <button onClick={handlePaste} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold cursor-pointer border-none shadow-3xs">
            Generate Standings
          </button>
        </div>
      )}

      <div className="space-y-3.5">
        {board.map(item => (
          <div key={item.rank} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-3xs flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className={`text-2xl font-extrabold font-mono opacity-80 ${item.rank === 1 ? "text-amber-500" : item.rank === 2 ? "text-gray-550" : "text-gray-400"}`}>
                #{item.rank}
              </span>
              <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-indigo-700 text-sm">
                {item.name.charAt(0)}
              </div>
              <div>
                <h4 className="text-xs font-bold text-gray-900 leading-tight">{item.name}</h4>
                <p className="text-[10px] text-gray-400 font-mono mt-0.5">@{item.login}</p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-sm font-extrabold text-indigo-750 block">{item.hours.toFixed(1)}h</span>
              <span className="text-[10px] font-mono font-bold text-emerald-700 mt-0.5 block">Q-Score: {item.quality}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
