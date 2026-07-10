import { useState, useEffect, useRef } from 'react';
import { useStore } from '../state/store';
import { CloseIcon } from './Icons';
import { API_BASE_URL } from '../api/client';

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  };
  return (
    <div className="health-field">
      <div className="health-field-label">{label}</div>
      <div className="health-field-row">
        <div className="health-field-value">{value || '—'}</div>
        <button className="health-field-copy" onClick={copy}>{copied ? '已复制' : '复制'}</button>
      </div>
    </div>
  );
}

// The home-facing URL a bridge on the user's PC should hit — same origin as
// the API, minus the trailing /api.
const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

export default function DevicePanel() {
  const open = useStore((s) => s.devicePanelOpen);
  const close = useStore((s) => s.closeDevicePanel);
  const enabled = useStore((s) => s.deviceEnabled);
  const maxIntensity = useStore((s) => s.deviceMaxIntensity);
  const intensity = useStore((s) => s.deviceIntensity);
  const bridgeOnline = useStore((s) => s.deviceBridgeOnline);
  const bridgeToken = useStore((s) => s.deviceBridgeToken);
  const manualIntensity = useStore((s) => s.deviceManualIntensity);
  const toggleEnabled = useStore((s) => s.toggleDeviceEnabled);
  const setMaxIntensity = useStore((s) => s.setDeviceMaxIntensity);
  const setManualIntensity = useStore((s) => s.setDeviceManualIntensity);
  const stopManual = useStore((s) => s.stopDeviceManual);

  const [showSetup, setShowSetup] = useState(false);
  const manualRef = useRef(manualIntensity);
  manualRef.current = manualIntensity;

  // Keep the manual command alive while the slider is held above 0 — each
  // command auto-expires server-side (a safety net), so without a periodic
  // re-send the device would stop a few seconds after the last drag.
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => {
      if (manualRef.current > 0) setManualIntensity(manualRef.current);
    }, 2000);
    return () => clearInterval(t);
  }, [open, setManualIntensity]);

  // Leaving the panel (or turning the feature off) always stops the device.
  useEffect(() => {
    if (!open && manualRef.current > 0) stopManual();
  }, [open, stopManual]);

  if (!open) return null;

  return (
    <div className="sheet-overlay" onClick={close}>
      <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-panel__head">
          <div className="sheet-panel__title">亲密控制</div>
          <button className="sheet-panel__close" onClick={close}>
            <CloseIcon />
          </button>
        </div>

        <div className="watch-card" style={{ margin: '0 0 14px' }}>
          <div className="screen-threshold-head">
            <div className="watch-card-title" style={{ marginBottom: 0 }}>开启设备控制</div>
            <button
              className="toggle-switch"
              style={{ background: enabled ? '#C8899E' : '#DCD4D8' }}
              onClick={toggleEnabled}
            >
              <div className="toggle-switch__knob" style={{ left: enabled ? 20 : 2 }} />
            </button>
          </div>
          <div className="screen-threshold-sub">
            开启后屿深可以在聊天里控制设备，你也能用下面的滑条手动控制。关闭即立刻停止，聊天里也不再有这个能力。
          </div>
          <div className="screen-threshold-sub" style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: bridgeOnline ? '#7BB47A' : '#C99', display: 'inline-block' }} />
            电脑桥接程序：{bridgeOnline ? '在线' : '未连接'}
          </div>
        </div>

        {enabled && (
          <>
            <div className="watch-card" style={{ margin: '0 0 14px' }}>
              <div className="watch-card-title">强度上限：{maxIntensity}</div>
              <div className="screen-threshold-sub">屿深和手动滑条都不会超过这个上限。</div>
              <input
                type="range" min="0" max="100" value={maxIntensity}
                onChange={(e) => setMaxIntensity(Number(e.target.value))}
                style={{ width: '100%', marginTop: 8 }}
              />
            </div>

            <div className="watch-card" style={{ margin: '0 0 14px' }}>
              <div className="watch-card-title">手动控制：{manualIntensity}</div>
              <div className="screen-threshold-sub">滑动即时生效，松开归零可停止。当前设备强度：{intensity}</div>
              <input
                type="range" min="0" max="100" value={manualIntensity}
                onChange={(e) => setManualIntensity(Number(e.target.value))}
                style={{ width: '100%', marginTop: 8 }}
              />
              <button className="letter-editing-cancel" style={{ marginTop: 8 }} onClick={stopManual}>停止</button>
            </div>
          </>
        )}

        <button className="letter-editing-cancel" onClick={() => setShowSetup((v) => !v)}>
          {showSetup ? '收起电脑端设置说明' : '电脑端桥接设置（首次使用看这里）'}
        </button>

        {showSetup && (
          <div className="watch-card" style={{ margin: '12px 0 0' }}>
            <div className="screen-threshold-sub" style={{ marginBottom: 10 }}>
              设备是蓝牙连电脑的，需要在电脑上运行一个小程序当“中间人”。把下面两个值填进
              <code>svakom_bridge.py</code> 顶部，然后运行它即可。使用时电脑要开着、程序要运行、设备在蓝牙范围内。
            </div>
            <CopyField label="BACKEND_URL（后端地址）" value={BACKEND_ORIGIN} />
            <CopyField label="TOKEN（访问令牌）" value={bridgeToken} />
          </div>
        )}
      </div>
    </div>
  );
}
