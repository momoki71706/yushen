import { useState } from 'react';
import { useStore } from '../../state/store';
import { BackChevronIcon } from '../../components/Icons';

function WatchGlyphBig() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="7" y="7" width="10" height="10" rx="3" stroke="#fff" strokeWidth="1.6" fill="none" />
      <path d="M9 4h6M9 20h6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 10v3l2 1.5" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BarChart({ week, valueKey, unit, formatValue, barColor }) {
  const [activeIdx, setActiveIdx] = useState(null);
  const max = Math.max(...week.map((d) => d[valueKey]), 1);
  return (
    <div className="watch-bar-row">
      {week.map((d, i) => (
        <div
          key={d.iso}
          className="watch-bar-col"
          onMouseDown={() => setActiveIdx(i)}
          onMouseUp={() => setActiveIdx(null)}
          onMouseLeave={() => setActiveIdx(null)}
          onTouchStart={() => setActiveIdx(i)}
          onTouchEnd={() => setActiveIdx(null)}
        >
          {activeIdx === i && <div className="watch-bar-tooltip">{formatValue(d[valueKey])}{unit}</div>}
          <div className="watch-bar-fill" style={{ height: `${Math.max(6, (d[valueKey] / max) * 100)}%`, background: barColor }} />
          <div className="watch-bar-label">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

const WEEKDAYS_SHORT = ['日', '一', '二', '三', '四', '五', '六'];

export default function WatchView() {
  const healthLogs = useStore((s) => s.healthLogs);
  const closeManageSubview = useStore((s) => s.closeManageSubview);
  const openHealthDataPanel = useStore((s) => s.openHealthDataPanel);
  const todayISOLocal = useStore((s) => s.todayISOLocal);

  const today = todayISOLocal();
  // healthLogs comes back newest-first from the backend; chart wants oldest-first.
  const week = [...healthLogs].slice(0, 7).reverse().map((r) => ({
    ...r,
    label: WEEKDAYS_SHORT[new Date(r.dateISO).getDay()],
  }));
  const todayData = healthLogs.find((r) => r.dateISO === today) || healthLogs[0] || null;

  const metricRows = todayData
    ? [
        { label: '睡眠', value: `${todayData.sleepHours.toFixed(1)} 小时`, ratio: todayData.sleepHours / 9, color: '#CBB9C0' },
        { label: '步数', value: `${todayData.steps.toLocaleString()} 步`, ratio: todayData.steps / 12000, color: '#D9CBD3' },
        { label: '心率', value: `${todayData.heartRateAvg} bpm`, ratio: todayData.heartRateAvg / 100, color: '#EDD9E1' },
      ]
    : [];

  return (
    <div className="manage-sub">
      <div className="manage-sub__head">
        <div className="manage-sub__back-pill">
          <button className="manage-sub__back-btn" onClick={closeManageSubview}>
            <BackChevronIcon />
          </button>
          <div className="manage-sub__title">手表监测</div>
        </div>
      </div>

      <div className="manage-sub__body" style={{ paddingTop: 12 }}>
        {healthLogs.length > 0 ? (
          <>
            <div className="watch-card">
              <div className="watch-card-title">
                {todayData?.dateISO === today ? '今日概览' : `${todayData?.dateISO} 概览`}
                {todayData?.isPeriod && <span className="book-status-tag" style={{ marginLeft: 8 }}>经期</span>}
              </div>
              {metricRows.map((m) => (
                <div key={m.label} className="watch-metric-row">
                  <div className="watch-metric-dot" style={{ background: m.color }} />
                  <div className="watch-metric-body">
                    <div className="watch-metric-head">
                      <span className="watch-metric-label">{m.label}</span>
                      <span className="watch-metric-value">{m.value}</span>
                    </div>
                    <div className="watch-metric-track">
                      <div className="watch-metric-fill" style={{ width: `${Math.min(100, m.ratio * 100)}%`, background: m.color }} />
                    </div>
                  </div>
                </div>
              ))}
              {todayData?.note && <div className="watch-card-sub" style={{ marginTop: 8 }}>备注：{todayData.note}</div>}
            </div>

            {week.length > 1 && (
              <>
                <div className="watch-card">
                  <div className="watch-card-title">睡眠时长</div>
                  <div className="watch-card-sub">最近一晚睡了 {todayData.sleepHours.toFixed(1)} 小时</div>
                  <BarChart week={week} valueKey="sleepHours" unit="h" formatValue={(v) => v.toFixed(1)} barColor="#CBB9C0" />
                </div>

                <div className="watch-card">
                  <div className="watch-card-title">步数</div>
                  <div className="watch-card-sub">最近一天 {todayData.steps.toLocaleString()} 步</div>
                  <BarChart week={week} valueKey="steps" unit=" 步" formatValue={(v) => Math.round(v).toLocaleString()} barColor="#D9CBD3" />
                </div>
              </>
            )}
          </>
        ) : (
          <div className="watch-connect-card">
            <div className="watch-connect-icon">
              <WatchGlyphBig />
            </div>
            <div className="watch-connect-title">连接 Apple Watch 数据</div>
            <div className="watch-connect-desc">配置一个 iOS 快捷指令，自动把睡眠、步数、心率同步过来，让我更懂你的作息。</div>
            <button className="watch-connect-btn" onClick={openHealthDataPanel}>去配置</button>
          </div>
        )}
      </div>
    </div>
  );
}
