import { useStore } from '../state/store';

// Self-dismisses after 5s (see pollMemoryLog in store.js) — a lightweight
// in-app popup for when a memory just got auto-saved to the registered
// memory MCP server, since that otherwise happens completely silently in
// the background.
export default function MemoryToast() {
  const memoryToast = useStore((s) => s.memoryToast);
  if (!memoryToast) return null;

  return (
    <div className="memory-toast">
      <span className="memory-toast__label">已经记下了：</span>
      {memoryToast}
    </div>
  );
}
