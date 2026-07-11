import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { CloseIcon, TrashIcon, PencilIcon } from '../components/Icons';

export default function SmultronMode() {
  const windows = useStore((s) => s.smultronWindows);
  const activeId = useStore((s) => s.smultronActiveId);
  const entries = useStore((s) => s.smultronEntries);
  const generating = useStore((s) => s.smultronGenerating);
  const input = useStore((s) => s.smultronInput);
  const setInput = useStore((s) => s.setSmultronInput);
  const generate = useStore((s) => s.smultronGenerate);
  const regenerate = useStore((s) => s.smultronRegenerate);
  const error = useStore((s) => s.smultronError);
  const syncMessage = useStore((s) => s.smultronSyncMessage);
  const loadSmultron = useStore((s) => s.loadSmultron);
  const openWindowSheet = useStore((s) => s.openSmultronWindowSheet);
  const openInstructionSheet = useStore((s) => s.openSmultronInstructionSheet);
  const windowSheetOpen = useStore((s) => s.smultronWindowSheetOpen);
  const instructionSheetOpen = useStore((s) => s.smultronInstructionSheetOpen);

  const scrollRef = useRef(null);
  const activeWindow = windows.find((w) => w.id === activeId);

  useEffect(() => {
    loadSmultron();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries, generating]);

  return (
    <div className="smultron">
      <div className="smultron__topbar">
        <div>
          <div className="smultron__title">Smultronställe</div>
          <div className="smultron__windowname">{activeWindow?.name || '野草莓之地'}</div>
        </div>
        <div className="smultron__topbtns">
          <button className="smultron__topbtn" onClick={openInstructionSheet}>设定</button>
          <button className="smultron__topbtn" onClick={openWindowSheet}>窗口</button>
        </div>
      </div>

      <div className="smultron__scroll" ref={scrollRef}>
        {entries.length === 0 && !generating && (
          <div className="smultron__empty">
            在下面输入一句指令，开始书写这片野草莓之地的故事。
            <br />
            先点「设定」给这个窗口写好开场设定会更好。
          </div>
        )}
        {entries.map((e) =>
          e.role === 'instruction' ? (
            <div key={e.id} className="smultron__instruction">▸ {e.text}</div>
          ) : (
            <div key={e.id} className="smultron__story">{e.text}</div>
          )
        )}
        {generating && <div className="smultron__generating">屿深正在书写…</div>}
      </div>

      {error && <div className="smultron__error">{error}</div>}
      {syncMessage && <div className="smultron__sync-msg">{syncMessage}</div>}

      <div className="smultron__footer">
        <div className="smultron__actions">
          <button className="smultron__actionbtn" onClick={() => generate('')} disabled={generating}>继续</button>
          <button className="smultron__actionbtn" onClick={regenerate} disabled={generating || entries.length === 0}>重新生成</button>
        </div>
        <div className="smultron__inputrow">
          <textarea
            className="smultron__input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入指令，推进剧情…"
            rows={2}
          />
          <button className="smultron__send" onClick={() => generate()} disabled={generating}>
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path d="M1 8L15 1L10 15L7 9L1 8Z" fill="#fff" />
            </svg>
          </button>
        </div>
      </div>

      {windowSheetOpen && <WindowSheet />}
      {instructionSheetOpen && <InstructionSheet activeWindow={activeWindow} />}
    </div>
  );
}

function WindowSheet() {
  const windows = useStore((s) => s.smultronWindows);
  const activeId = useStore((s) => s.smultronActiveId);
  const close = useStore((s) => s.closeSmultronWindowSheet);
  const switchWindow = useStore((s) => s.switchSmultronWindow);
  const addWindow = useStore((s) => s.addSmultronWindow);
  const renameWindow = useStore((s) => s.renameSmultronWindow);
  const deleteWindow = useStore((s) => s.deleteSmultronWindow);
  const syncMemory = useStore((s) => s.smultronSyncMemory);
  const exportWindow = useStore((s) => s.smultronExport);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  return (
    <div className="sheet-overlay" onClick={close}>
      <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-panel__head">
          <div className="sheet-panel__title">窗口</div>
          <button className="sheet-panel__close" onClick={close}><CloseIcon /></button>
        </div>

        {windows.map((w) => (
          <div key={w.id} className="watch-card" style={{ margin: '0 0 10px' }}>
            {editingId === w.id ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="nickname-input" style={{ flex: 1, textAlign: 'left' }} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
                <button className="smultron__topbtn" onClick={() => { renameWindow(w.id, draft.trim() || w.name); setEditingId(null); }}>保存</button>
              </div>
            ) : (
              <div className="screen-threshold-head">
                <button
                  className="watch-card-title"
                  style={{ marginBottom: 0, background: 'none', border: 'none', textAlign: 'left', color: w.id === activeId ? '#C4879E' : 'inherit', flex: 1 }}
                  onClick={() => switchWindow(w.id)}
                >
                  {w.id === activeId ? '● ' : ''}{w.name}
                </button>
                <button className="smultron__iconbtn" onClick={() => { setEditingId(w.id); setDraft(w.name); }}><PencilIcon /></button>
                <button className="smultron__iconbtn" onClick={() => setConfirmDelete(w.id)}><TrashIcon color="#8C6A72" width={14} height={14} /></button>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="letter-editing-cancel" style={{ flex: 1 }} onClick={() => syncMemory(w.id)}>同步到记忆库</button>
              <button className="letter-editing-cancel" style={{ flex: 1 }} onClick={() => exportWindow(w.id)}>导出</button>
            </div>
            {confirmDelete === w.id && (
              <div className="manage-card__message-confirm" style={{ marginTop: 8 }}>
                <span>删除这个窗口？内容会一起删掉</span>
                <button className="ledger-category-delete-cancel" onClick={() => setConfirmDelete(null)}>取消</button>
                <button className="ledger-category-delete-danger" onClick={() => { deleteWindow(w.id); setConfirmDelete(null); }}>删除</button>
              </div>
            )}
          </div>
        ))}

        <button className="smultron__addbtn" onClick={addWindow}>+ 新建窗口</button>
      </div>
    </div>
  );
}

function InstructionSheet({ activeWindow }) {
  const close = useStore((s) => s.closeSmultronInstructionSheet);
  const save = useStore((s) => s.saveSmultronInstruction);
  const presets = useStore((s) => s.smultronPresets);
  const addPreset = useStore((s) => s.addSmultronPreset);
  const updatePreset = useStore((s) => s.updateSmultronPreset);
  const deletePreset = useStore((s) => s.deleteSmultronPreset);
  const applyPreset = useStore((s) => s.applySmultronPreset);
  const [text, setText] = useState(activeWindow?.instruction || '');
  const [editingPreset, setEditingPreset] = useState(null);
  const [pName, setPName] = useState('');
  const [pContent, setPContent] = useState('');

  return (
    <div className="sheet-overlay" onClick={close}>
      <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-panel__head">
          <div className="sheet-panel__title">设定</div>
          <button className="sheet-panel__close" onClick={close}><CloseIcon /></button>
        </div>

        <div className="watch-card" style={{ margin: '0 0 14px' }}>
          <div className="watch-card-title">当前窗口设定</div>
          <div className="screen-threshold-sub">这段是当前窗口的开场设定（世界观 / 人物 / 风格 / 尺度），每次生成都会带上，优先级高于人设。</div>
          <textarea className="smultron__setting-input" value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder="写下这个窗口的设定…" />
          <button className="smultron__addbtn" style={{ marginTop: 8 }} onClick={() => save(text)}>保存设定</button>
        </div>

        <div className="watch-card" style={{ margin: 0 }}>
          <div className="watch-card-title">指令库</div>
          <div className="screen-threshold-sub">存好几套设定，随时套用到任何窗口。</div>
          {presets.map((p) =>
            editingPreset === p.id ? (
              <div key={p.id} className="smultron__preset" style={{ display: 'block' }}>
                <input className="nickname-input" style={{ width: '100%', textAlign: 'left', marginBottom: 6 }} value={pName} onChange={(e) => setPName(e.target.value)} placeholder="名字" />
                <textarea className="smultron__setting-input" value={pContent} onChange={(e) => setPContent(e.target.value)} rows={4} />
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <button className="letter-editing-cancel" style={{ flex: 1 }} onClick={() => setEditingPreset(null)}>取消</button>
                  <button className="smultron__addbtn" style={{ flex: 1 }} onClick={() => { updatePreset(p.id, { name: pName, content: pContent }); setEditingPreset(null); }}>保存</button>
                </div>
              </div>
            ) : (
              <div key={p.id} className="smultron__preset">
                <div className="smultron__preset-name">{p.name}</div>
                <button className="smultron__iconbtn" onClick={() => applyPreset(p.content)}>应用</button>
                <button className="smultron__iconbtn" onClick={() => { setEditingPreset(p.id); setPName(p.name); setPContent(p.content); }}><PencilIcon /></button>
                <button className="smultron__iconbtn" onClick={() => deletePreset(p.id)}><TrashIcon color="#8C6A72" width={14} height={14} /></button>
              </div>
            )
          )}
          <button className="smultron__addbtn" style={{ marginTop: 8 }} onClick={() => addPreset({ name: '新设定', content: text })}>
            + 把当前设定存为新指令
          </button>
        </div>
      </div>
    </div>
  );
}
