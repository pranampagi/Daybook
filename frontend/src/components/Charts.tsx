import { useId } from 'react';
import { ArrowUpRight, ChartNoAxesCombined } from 'lucide-react';
import type { Currency, DashboardData } from '../types';
import { money } from '../lib/format';
import { categories } from './categories';

export function SpendingChart({ data, currency }: { data: DashboardData; currency: Currency }) {
  const gradientId = useId().replaceAll(':', '');
  const width = 620;
  const height = 170;
  const max = Math.max(...data.daily.map((day) => Number(day.total)), 1);
  const points = data.daily.map((day, index) => ({
    x: index / Math.max(data.daily.length - 1, 1) * width,
    y: height - Number(day.total) / max * (height - 18),
    day,
  }));
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const area = `${line} L ${width} ${height} L 0 ${height} Z`;
  return (
    <section className="panel spending-panel">
      <div className="panel-heading"><div><h2>Spending activity</h2><p>Your daily expenses, at a glance</p></div><span className="chart-key"><span />Daily spend</span></div>
      <div className="activity-chart">
        <div className="chart-y-axis">{[max, max / 2, 0].map((value, index) => <span key={index}>{money(value, currency, true)}</span>)}</div>
        <div className="chart-plot">
          <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`Daily spending chart. Monthly total: ${money(data.month_total, currency)}. Exact daily totals are in the table below.`}>
            <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8173ed" stopOpacity="0.23" /><stop offset="100%" stopColor="#8173ed" stopOpacity="0.01" /></linearGradient></defs>
            {[18, height / 2, height].map((position) => <line key={position} x1="0" y1={position} x2={width} y2={position} stroke="#edf0f4" strokeDasharray="4 5" />)}
            <path d={area} fill={`url(#${gradientId})`} />
            <path d={line} fill="none" stroke="#8272ed" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            {points.map((point) => <circle key={point.day.date} cx={point.x} cy={point.y} r="5" fill="transparent"><title>{point.day.date}: {money(point.day.total, currency)}</title></circle>)}
          </svg>
          <div className="chart-x-axis">{[1, 7, 14, 21, data.daily.length].map((day) => <span key={day}>{String(day).padStart(2, '0')}</span>)}</div>
        </div>
      </div>
      <details className="chart-data"><summary>View daily totals</summary><div>{data.daily.map((day) => <p key={day.date}><span>{day.date}</span><span>{money(day.total, currency)}</span></p>)}</div></details>
    </section>
  );
}

export function CategoryChart({ data, currency }: { data: DashboardData; currency: Currency }) {
  const total = Number(data.month_total);
  let offset = 0;
  const stops = data.categories.map((item) => {
    const start = offset;
    offset += Number(item.total) / total * 100;
    return `${categories[item.category].color} ${start}% ${offset}%`;
  });
  return (
    <section className="panel categories-panel">
      <div className="panel-heading"><div><h2>By category</h2><p>Where your money goes</p></div><ArrowUpRight size={18} className="text-slate-400" /></div>
      {total > 0 ? <>
        <div className="donut" style={{ background: `conic-gradient(${stops.join(', ')})` }} role="img" aria-label="Spending distribution by category"><div className="donut-hole"><span>Total spent</span><strong>{money(total, currency, total >= 100000)}</strong></div></div>
        <div className="category-legend">{data.categories.map((item) => <div key={item.category}><span className="legend-dot" style={{ background: categories[item.category].color }} /><span>{categories[item.category].label}</span><strong>{money(item.total, currency)}</strong></div>)}</div>
      </> : <div className="category-empty"><ChartNoAxesCombined size={32} /><h3>A fresh start</h3><p>Add an expense to see your spending breakdown.</p></div>}
    </section>
  );
}
