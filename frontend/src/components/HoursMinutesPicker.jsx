import { useEffect, useRef } from 'react';

const ITEM_HEIGHT = 34;
const VISIBLE_PAD = ITEM_HEIGHT * 2;
const HOUR_OPTIONS = Array.from({ length: 49 }, (_, i) => i); // 0-48
const MINUTE_OPTIONS = [0, 15, 30, 45];

function WheelColumn({ options, value, onChange }) {
  const scrollRef = useRef(null);
  const skipNextScroll = useRef(false);
  const settleTimer = useRef(null);

  useEffect(() => {
    const idx = options.indexOf(value);
    if (scrollRef.current && idx >= 0) {
      skipNextScroll.current = true;
      scrollRef.current.scrollTop = idx * ITEM_HEIGHT;
    }
  }, [value, options]);

  const handleScroll = () => {
    if (skipNextScroll.current) {
      skipNextScroll.current = false;
      return;
    }
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const el = scrollRef.current;
      if (!el) return;
      const idx = Math.max(0, Math.min(options.length - 1, Math.round(el.scrollTop / ITEM_HEIGHT)));
      el.scrollTo({ top: idx * ITEM_HEIGHT, behavior: 'smooth' });
      if (options[idx] !== value) onChange(options[idx]);
    }, 130);
  };

  return (
    <div className="wheel-picker-col" ref={scrollRef} onScroll={handleScroll}>
      <div style={{ height: VISIBLE_PAD }} />
      {options.map((o) => (
        <div
          key={o}
          className={`wheel-picker-item${o === value ? ' wheel-picker-item--active' : ''}`}
          style={{ height: ITEM_HEIGHT }}
        >
          {o}
        </div>
      ))}
      <div style={{ height: VISIBLE_PAD }} />
    </div>
  );
}

// A native-feeling scroll wheel for picking a duration as 小时+分钟 (minutes
// snap to quarter-hours) rather than a single stepper — used by the two
// proactive-message timing settings in PushSettingsPanel.
export default function HoursMinutesPicker({ totalMinutes, onChange, min = 15, max = 2880 }) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const commit = (h, m) => {
    onChange(Math.max(min, Math.min(max, h * 60 + m)));
  };

  return (
    <div className="wheel-picker-row">
      <div className="wheel-picker-highlight" />
      <WheelColumn options={HOUR_OPTIONS} value={hours} onChange={(h) => commit(h, minutes)} />
      <div className="wheel-picker-unit">小时</div>
      <WheelColumn options={MINUTE_OPTIONS} value={minutes} onChange={(m) => commit(hours, m)} />
      <div className="wheel-picker-unit">分钟</div>
    </div>
  );
}
