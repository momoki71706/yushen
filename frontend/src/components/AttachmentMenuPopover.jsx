import { Fragment } from 'react';
import { useStore } from '../state/store';
import { PhotoIcon, FileIcon } from './Icons';

export default function AttachmentMenuPopover({ onPickImage, onPickFile }) {
  const closeAttachmentMenu = useStore((s) => s.closeAttachmentMenu);

  return (
    <Fragment>
      <div className="model-switcher-overlay" onClick={closeAttachmentMenu} />
      <div className="attachment-menu-popover" onClick={(e) => e.stopPropagation()}>
        <button className="attachment-menu-item" onClick={onPickImage}>
          <PhotoIcon />
          <span>图片</span>
        </button>
        <button className="attachment-menu-item" onClick={onPickFile}>
          <FileIcon width={22} height={22} />
          <span>文件</span>
        </button>
      </div>
    </Fragment>
  );
}
