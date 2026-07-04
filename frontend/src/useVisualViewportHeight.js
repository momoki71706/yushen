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
// restore the full window height the moment nothing is focused.
export function useVisualViewportHeight() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    let restoreTimer = null;
    let focused = false;

    // Always keep --vvh/--vvt set to a concrete resolved px value rather
    // than ever removing them and falling back to the CSS default
    // (100dvh / 0px). WebKit has repeatedly proven unreliable about
    // repainting when a custom property is removed and a var() fallback
    // kicks in — the layout visually stays stuck at the old value until
    // something unrelated (like opening the sidebar) forces a re-render.
    // Setting a real value every time sidesteps that fallback-repaint
    // path entirely instead of trying to out-time it.
    document.documentElement.style.setProperty('--vvh', `${window.innerHeight}px`);
    document.documentElement.style.setProperty('--vvt', '0px');

    const applyKeyboardHeight = () => {
      if (!focused) return;
      document.documentElement.style.setProperty('--vvh', `${vv.height}px`);
      // position:fixed elements are anchored to the layout viewport, not
      // the visual one. When iOS shifts the visual viewport down (e.g. to
      // keep the focused field clear of the keyboard), offsetTop becomes
      // non-zero — if we don't shift our fixed shell by the same amount,
      // its top:0 no longer lines up with what's actually visible, and the
      // uncovered strip at the bottom reads as a solid-colour gap even
      // though the height itself is correct.
      document.documentElement.style.setProperty('--vvt', `${vv.offsetTop}px`);
      // iOS's own "scroll focused input into view" runs against the old
      // layout and our resize runs against the new one — the two races
      // can leave the field scrolled out of view entirely. Re-center it
      // ourselves once the real keyboard-aware height is in place. Some
      // fields (like the diary comment box, sitting right below a card
      // worth keeping visible) opt into 'end' via data-scroll-block so
      // centering doesn't shove everything above them off-screen.
      const active = document.activeElement;
      if (active?.matches?.(FIELD_SELECTOR)) {
        const block = active.dataset.scrollBlock || 'center';
        active.scrollIntoView({ block, behavior: 'instant' });
      }
    };

    const restoreFullHeight = () => {
      document.documentElement.style.setProperty('--vvh', `${window.innerHeight}px`);
      document.documentElement.style.setProperty('--vvt', '0px');
      // Forcing a synchronous reflow still helps WebKit pick up the new
      // value promptly instead of visually lagging a frame behind.
      void document.documentElement.offsetHeight;
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
