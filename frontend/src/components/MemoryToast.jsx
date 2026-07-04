import { useStore } from '../state/store';
import { TrashIcon } from './Icons';

// Self-dismisses after 8s (see pollMemoryLog in store.js) — a lightweight
// in-app panel for when one or more memories just got auto-saved to the
// registered memory MCP server, since that otherwise happens completely
// silently in the background. Scrolls internally when several saves land
// in the same poll instead of only ever surfacing the latest one.
export default function MemoryToast() {
  const memoryToastItems = useStore((s) => s.memoryToastItems);
  const dismissMemoryToast = useStore((s) => s.dismissMemoryToast);
  if (!memoryToastItems.length) return null;

  return (
    <div className="memory-toast">
      <div className="memory-toast__title">已经记下了</div>
      <div className="memory-toast__list">
        {memoryToastItems.map((item) => (
          <div key={item.id} className="memory-toast__row">{item.summary}</div>
        ))}
      </div>
      <button className="memory-toast__dismiss" onClick={dismissMemoryToast}>
        <TrashIcon color="#fff" width={13} height={13} />
      </button>
    </div>
  );
}
