import { useEffect } from 'react';

// iOS Safari never resizes the CSS layout viewport when the on-screen
// keyboard opens, so a fixed height:100dvh + overflow:hidden shell traps
// the keyboard's rendered height at zero (only its accessory toolbar
// shows). window.visualViewport DOES report the real visible area, so we
// mirror it into a CSS variable the layout can size against instead.
export function useVisualViewportHeight() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      document.documentElement.style.setProperty('--vvh', `${vv.height}px`);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
}
