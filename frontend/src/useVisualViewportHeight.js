import { useEffect } from 'react';

const FIELD_SELECTOR = 'input, textarea, select, [contenteditable="true"]';

// iOS Safari never resizes the CSS layout viewport when the on-screen
// keyboard opens, so a fixed height:100dvh + overflow:hidden shell traps
// the keyboard's rendered height at zero (only its accessory toolbar
// shows). window.visualViewport DOES report the real visible area, so we
// mirror it into a --vvh CSS variable while a field is focused.
//
// visualViewport's resize event is also known to fire unreliably (or with
// a stale value) when the keyboard closes, which would leave the layout
// stuck at the smaller height. Rather than trust that event for the
// "closed" case, we track focus on form fields ourselves and explicitly
// drop back to the natural 100dvh the moment nothing is focused.
export function useVisualViewportHeight() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    let restoreTimer = null;
    let focused = false;

    const applyKeyboardHeight = () => {
      if (!focused) return;
      document.documentElement.style.setProperty('--vvh', `${vv.height}px`);
      // iOS's own "scroll focused input into view" runs against the old
      // layout and our resize runs against the new one — the two races
      // can leave the field scrolled out of view entirely. Re-center it
      // ourselves once the real keyboard-aware height is in place.
      const active = document.activeElement;
      if (active?.matches?.(FIELD_SELECTOR)) {
        active.scrollIntoView({ block: 'center', behavior: 'instant' });
      }
    };

    const restoreFullHeight = () => {
      // Setting an explicit px value (rather than just removing the
      // property and falling back to 100dvh) plus forcing a synchronous
      // reflow works around a WebKit repaint bug where the layout stays
      // visually stuck at the old, smaller height until something
      // unrelated forces a re-render.
      document.documentElement.style.setProperty('--vvh', `${window.innerHeight}px`);
      void document.documentElement.offsetHeight;
      requestAnimationFrame(() => {
        document.documentElement.style.removeProperty('--vvh');
        void document.documentElement.offsetHeight;
      });
    };

    const onFocusIn = (e) => {
      if (!e.target.matches?.(FIELD_SELECTOR)) return;
      focused = true;
      if (restoreTimer) {
        clearTimeout(restoreTimer);
        restoreTimer = null;
      }
      // Give the keyboard a beat to finish animating in before reading height.
      setTimeout(applyKeyboardHeight, 50);
    };

    const onFocusOut = (e) => {
      if (!e.target.matches?.(FIELD_SELECTOR)) return;
      focused = false;
      // Focus may be jumping straight to another field — don't restore yet.
      restoreTimer = setTimeout(() => {
        if (!focused) restoreFullHeight();
      }, 100);
    };

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    vv.addEventListener('resize', applyKeyboardHeight);
    vv.addEventListener('scroll', applyKeyboardHeight);

    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      vv.removeEventListener('resize', applyKeyboardHeight);
      vv.removeEventListener('scroll', applyKeyboardHeight);
      if (restoreTimer) clearTimeout(restoreTimer);
    };
  }, []);
}
