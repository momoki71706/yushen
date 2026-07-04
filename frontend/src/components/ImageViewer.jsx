import { useStore } from '../state/store';

// Mounted once at the App root (see App.jsx) — imageViewerUrl is set from
// chat/diary/letter alike, so this has to live somewhere that's always
// rendered, not inside any one mode. It used to only be rendered inside
// ChatMode, so opening a photo from diary silently did nothing until you
// later switched to chat, where the still-set imageViewerUrl would suddenly
// pop the overlay open there instead.
export default function ImageViewer() {
  const imageViewerUrl = useStore((s) => s.imageViewerUrl);
  const closeImageViewer = useStore((s) => s.closeImageViewer);

  if (!imageViewerUrl) return null;

  return (
    <div className="image-viewer-overlay" onClick={closeImageViewer}>
      <img src={imageViewerUrl} alt="" className="image-viewer-img" />
    </div>
  );
}
