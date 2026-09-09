import React, { useState } from "react";
import { BarChart3, TrendingUp, Filter, PieChart as PieIcon, Layers, Users, CheckCircle2, ChevronDown } from "lucide-react";

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 1. Column Chart: إجمالي المستفيدين حسب فئات الاستحقاق
 * ══════════════════════════════════════════════════════════════════════════════
 */
export function ColumnChart({ data, title }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const items = Array.isArray(data) ? data : [];
  const maxVal = Math.max(...items.map((d) => d.count || 0), 1);

  if (items.length === 0) {
    return (
      <div className="bg-white border border-[#E5E2D9] rounded-2xl p-5 shadow-xs flex flex-col justify-center items-center h-80 text-slate-400 text-xs">
        <BarChart3 className="w-8 h-8 text-slate-300 mb-2" />
        لا تتوفر بيانات للفئات خلال الفترة المحددة.
      </div>
    );
  }

  const chartHeight = 180;
  const colors = ["#2E5A27", "#3F6B3A", "#8C6C26", "#C9A24A", "#0284C7", "#10B981"];

  return (
    <div className="bg-white border border-[#E5E2D9] rounded-2xl p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-[#E5E2D9]">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-[#3F6B3A]/10 text-[#3F6B3A] rounded-lg">
            <BarChart3 className="w-4 h-4" />
          </span>
          <h4 className="font-bold text-slate-800 text-sm">{title || "إجمالي المستفيدين حسب فئات الاستحقاق"}</h4>
        </div>
        <span className="text-[11px] text-slate-400 font-mono">
          إجمالي: {items.reduce((acc, i) => acc + (i.count || 0), 0)} مستفيد
        </span>
      </div>

      {/* Chart Visual */}
      <div className="relative pt-6">
        <div className="flex items-end justify-around gap-2 h-44 border-b border-slate-200 px-2">
          {items.map((item, idx) => {
            const hPct = Math.max(8, Math.round(((item.count || 0) / maxVal) * 100));
            const color = colors[idx % colors.length];
            const isHovered = hoveredIdx === idx;

            return (
              <div
                key={idx}
                className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Tooltip */}
                {isHovered && (
                  <div className="absolute -top-10 z-10 bg-slate-900 text-white text-[11px] font-bold py-1 px-2.5 rounded-lg shadow-lg whitespace-nowrap animate-in fade-in zoom-in duration-150 pointer-events-none">
                    {item.label}: {item.count} مستفيد ({Math.round(((item.count || 0) / maxVal) * 100)}%)
                  </div>
                )}

                {/* Count Badge on Top of Bar */}
                <span className={`text-[11px] font-bold font-mono mb-1.5 transition-colors ${isHovered ? "text-[#3F6B3A] scale-110" : "text-slate-600"}`}>
                  {item.count}
                </span>

                {/* Vertical Bar */}
                <div
                  className="w-full max-w-[48px] rounded-t-lg transition-all duration-300 group-hover:brightness-110 shadow-xs"
                  style={{
                    height: `${hPct}%`,
                    backgroundColor: color,
                    opacity: hoveredIdx === null || isHovered ? 1 : 0.6,
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* X-Axis Labels */}
        <div className="flex items-start justify-around gap-2 pt-2 px-2 text-center">
          {items.map((item, idx) => (
            <div key={idx} className="flex-1 text-[11px] text-slate-600 font-medium truncate px-0.5" title={item.label}>
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 2. Line Chart: تطور تسجيل المستفيدين وتقديم المساعدات عبر الأشهر
 * ══════════════════════════════════════════════════════════════════════════════
 */
export function LineChart({ data, title }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const items = Array.isArray(data) ? data : [];

  if (items.length === 0) {
    return (
      <div className="bg-white border border-[#E5E2D9] rounded-2xl p-5 shadow-xs flex flex-col justify-center items-center h-80 text-slate-400 text-xs">
        <TrendingUp className="w-8 h-8 text-slate-300 mb-2" />
        لا تتوفر سلاسل زمنية لهذه الفترة.
      </div>
    );
  }

  const maxVal = Math.max(
    ...items.map((d) => Math.max(d.registrations || 0, d.distributions || 0)),
    1
  );

  const width = 500;
  const height = 160;
  const paddingX = 40;
  const paddingY = 25;
  const usableW = width - paddingX * 2;
  const usableH = height - paddingY * 2;

  const pointsReg = items.map((item, i) => {
    const x = paddingX + (i / Math.max(1, items.length - 1)) * usableW;
    const y = height - paddingY - ((item.registrations || 0) / maxVal) * usableH;
    return { x, y, val: item.registrations || 0, period: item.period };
  });

  const pointsDist = items.map((item, i) => {
    const x = paddingX + (i / Math.max(1, items.length - 1)) * usableW;
    const y = height - paddingY - ((item.distributions || 0) / maxVal) * usableH;
    return { x, y, val: item.distributions || 0, period: item.period };
  });

  const pathReg = pointsReg.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), "");
  const pathDist = pointsDist.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), "");

  return (
    <div className="bg-white border border-[#E5E2D9] rounded-2xl p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-[#E5E2D9]">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
            <TrendingUp className="w-4 h-4" />
          </span>
          <h4 className="font-bold text-slate-800 text-sm">{title || "تطور تسجيل المستفيدين وتقديم المساعدات عبر الأشهر"}</h4>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-[#3F6B3A] font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-[#3F6B3A] inline-block" />
            المسجلون
          </span>
          <span className="flex items-center gap-1 text-blue-600 font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
            المساعدات
          </span>
        </div>
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48 overflow-visible">
          {/* Horizontal Grid lines */}
          {[0, 0.5, 1].map((ratio, idx) => {
            const y = height - paddingY - ratio * usableH;
            return (
              <g key={idx}>
                <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="#F1F5F9" strokeWidth="1" strokeDasharray="4 4" />
                <text x={paddingX - 8} y={y + 3} textAnchor="end" fontSize="9" fill="#94A3B8" fontFamily="monospace">
                  {Math.round(ratio * maxVal)}
                </text>
              </g>
            );
          })}

          {/* Line 1: Registrations (Green) */}
          <path d={pathReg} fill="none" stroke="#3F6B3A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

          {/* Line 2: Distributions (Blue) */}
          <path d={pathDist} fill="none" stroke="#0284C7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

          {/* Interactive Data Points */}
          {pointsReg.map((p, idx) => (
            <g key={`reg-${idx}`} className="cursor-pointer" onMouseEnter={() => setHoveredIdx(idx)} onMouseLeave={() => setHoveredIdx(null)}>
              <circle
                cx={p.x}
                cy={p.y}
                r={hoveredIdx === idx ? 6 : 4}
                fill="#3F6B3A"
                stroke="#FFFFFF"
                strokeWidth="2"
                className="transition-all"
              />
            </g>
          ))}

          {pointsDist.map((p, idx) => (
            <g key={`dist-${idx}`} className="cursor-pointer" onMouseEnter={() => setHoveredIdx(idx)} onMouseLeave={() => setHoveredIdx(null)}>
              <circle
                cx={p.x}
                cy={p.y}
                r={hoveredIdx === idx ? 6 : 4}
                fill="#0284C7"
                stroke="#FFFFFF"
                strokeWidth="2"
                className="transition-all"
              />
            </g>
          ))}
        </svg>

        {/* Hover Floating Details */}
        {hoveredIdx !== null && items[hoveredIdx] && (
          <div className="absolute top-1 right-4 bg-slate-900 text-white text-xs p-2.5 rounded-xl shadow-lg flex items-center gap-3">
            <span className="font-bold border-l border-slate-700 pl-2">{items[hoveredIdx].period}</span>
            <span className="text-emerald-400 font-mono">تسجيل: +{items[hoveredIdx].registrations || 0}</span>
            <span className="text-sky-300 font-mono">مساعدات: {items[hoveredIdx].distributions || 0}</span>
          </div>
        )}

        {/* Periods along X-axis */}
        <div className="flex justify-between items-center text-[10.5px] text-slate-500 font-medium px-4 mt-1">
          {items.map((item, idx) => (
            <span key={idx} className="truncate max-w-[60px] text-center">
              {item.period}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 3. Funnel Chart: مسار المستفيدين حسب مراحل الاستحقاق والدعم
 * ══════════════════════════════════════════════════════════════════════════════
 */
export function FunnelChart({ stages, title }) {
  const stageList = Array.isArray(stages) ? stages : [];

  if (stageList.length === 0) {
    return (
      <div className="bg-white border border-[#E5E2D9] rounded-2xl p-5 shadow-xs flex flex-col justify-center items-center h-80 text-slate-400 text-xs">
        <Filter className="w-8 h-8 text-slate-300 mb-2" />
        لا تتوفر بيانات مسار استحقاق.
      </div>
    );
  }

  const colors = [
    { bg: "bg-[#2E5A27]", text: "text-emerald-800", border: "border-emerald-200", bar: "#2E5A27" },
    { bg: "bg-[#3F6B3A]", text: "text-green-800", border: "border-green-200", bar: "#3F6B3A" },
    { bg: "bg-[#8C6C26]", text: "text-amber-800", border: "border-amber-200", bar: "#8C6C26" },
    { bg: "bg-[#C9A24A]", text: "text-amber-900", border: "border-amber-300", bar: "#C9A24A" },
  ];

  return (
    <div className="bg-white border border-[#E5E2D9] rounded-2xl p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-[#E5E2D9]">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
            <Filter className="w-4 h-4" />
          </span>
          <h4 className="font-bold text-slate-800 text-sm">{title || "مسار المستفيدين حسب مراحل الاستحقاق والدعم"}</h4>
        </div>
        <span className="text-xs text-slate-400">تحليل تسلسلي لمراحل الخدمة</span>
      </div>

      <div className="space-y-3 py-1">
        {stageList.map((st, idx) => {
          const c = colors[idx % colors.length];
          const pct = Math.max(10, Math.min(100, Number(st.percentage) || 0));

          return (
            <div key={idx} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-mono flex items-center justify-center font-bold">
                    {idx + 1}
                  </span>
                  {st.stage}
                </span>
                <span className="font-mono text-slate-600 font-bold">
                  {st.count} مستفيد <span className="text-[#3F6B3A]">({st.percentage}%)</span>
                </span>
              </div>

              {/* Progress Bar styled as Funnel Tier */}
              <div className="w-full bg-slate-100 h-6 rounded-xl overflow-hidden p-0.5 border border-slate-200/80">
                <div
                  className="h-full rounded-lg transition-all duration-500 flex items-center justify-end pr-2 text-white font-mono text-[10px] font-bold shadow-xs"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: c.bar,
                  }}
                >
                  {pct > 15 && `${pct}%`}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-400 text-center pt-1">
        يوضح هذا المسار انتقال المستفيدين من مرحلة التسجيل الأولي وحتى استلام السلال والمساعدات فعلياً.
      </p>
    </div>
  );
}

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 4. Pie Chart: التوزيع النسبي (مواطن مقابل مقيم / أسر مقابل أفراد)
 * ══════════════════════════════════════════════════════════════════════════════
 */
export function PieChart({ data, secondaryData, title }) {
  const [viewMode, setViewMode] = useState("citizenship"); // 'citizenship' | 'family'
  const currentData = viewMode === "citizenship" ? data || [] : secondaryData || [];
  const total = currentData.reduce((acc, cur) => acc + (cur.count || 0), 0);

  if (currentData.length === 0 || total === 0) {
    return (
      <div className="bg-white border border-[#E5E2D9] rounded-2xl p-5 shadow-xs flex flex-col justify-center items-center h-80 text-slate-400 text-xs">
        <PieIcon className="w-8 h-8 text-slate-300 mb-2" />
        لا تتوفر نسب توزيع لهذه الفترة.
      </div>
    );
  }

  // Calculate SVG Donut stroke dashes
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let cumulativePercent = 0;

  return (
    <div className="bg-white border border-[#E5E2D9] rounded-2xl p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-[#E5E2D9]">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <PieIcon className="w-4 h-4" />
          </span>
          <h4 className="font-bold text-slate-800 text-sm">
            {viewMode === "citizenship" ? "توزيع المستفيدين حسب صفة الإقامة" : "توزيع المستفيدين حسب بنية الأسرة"}
          </h4>
        </div>

        {/* Toggle between Citizenship and Family Type */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-bold">
          <button
            type="button"
            onClick={() => setViewMode("citizenship")}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              viewMode === "citizenship" ? "bg-white text-[#3F6B3A] shadow-xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            مواطن / مقيم
          </button>
          <button
            type="button"
            onClick={() => setViewMode("family")}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              viewMode === "family" ? "bg-white text-blue-600 shadow-xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            أسر / أفراد
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-around gap-6 pt-2">
        {/* SVG Donut Chart */}
        <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            {currentData.map((slice, idx) => {
              const slicePct = (slice.count || 0) / total;
              const strokeDasharray = `${slicePct * circumference} ${circumference}`;
              const strokeDashoffset = -cumulativePercent * circumference;
              cumulativePercent += slicePct;

              return (
                <circle
                  key={idx}
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="transparent"
                  stroke={slice.color || "#3F6B3A"}
                  strokeWidth="14"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-500 hover:opacity-90"
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="text-xl font-bold font-mono text-slate-800">{total}</span>
            <span className="text-[10px] text-slate-400 font-medium">مستفيد</span>
          </div>
        </div>

        {/* Legend Breakdown */}
        <div className="flex-1 w-full space-y-2.5">
          {currentData.map((item, idx) => {
            const pct = Math.round(((item.count || 0) / total) * 100);
            return (
              <div key={idx} className="p-2.5 rounded-xl border border-slate-100 bg-[#FAF8F5] space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="font-bold text-slate-800">{item.label}</span>
                  </div>
                  <div className="font-mono text-xs font-bold text-slate-700">
                    {item.count} <span className="text-slate-400 font-normal">({pct}%)</span>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-slate-200/70 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: item.color }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
