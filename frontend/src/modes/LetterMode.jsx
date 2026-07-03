import { useStore } from '../state/store';
import { EnvelopeOutlineIcon, EnvelopeIcon, BackChevronIcon } from '../components/Icons';

const RECIPIENTS = ['屿深', '小晴'];

export default function LetterMode() {
  const letterView = useStore((s) => s.letterView);
  return letterView === 'mailbox' ? <Mailbox /> : <Compose />;
}

function Compose() {
  const nickname = useStore((s) => s.nickname);
  const letters = useStore((s) => s.letters);
  const openMailbox = useStore((s) => s.openMailbox);
  const letterDearText = useStore((s) => s.letterDearText);
  const onLetterDearChange = useStore((s) => s.onLetterDearChange);
  const letterRecipient = useStore((s) => s.letterRecipient);
  const setLetterRecipient = useStore((s) => s.setLetterRecipient);
  const showRecipientPicker = useStore((s) => s.showRecipientPicker);
  const toggleRecipientPicker = useStore((s) => s.toggleRecipientPicker);
  const letterText = useStore((s) => s.letterText);
  const onLetterTextChange = useStore((s) => s.onLetterTextChange);
  const letterSignature = useStore((s) => s.letterSignature);
  const onLetterSignatureChange = useStore((s) => s.onLetterSignatureChange);
  const letterUnlockDate = useStore((s) => s.letterUnlockDate);
  const onUnlockDateChange = useStore((s) => s.onUnlockDateChange);
  const sealLetterAnimated = useStore((s) => s.sealLetterAnimated);
  const sealPulse = useStore((s) => s.sealPulse);

  return (
    <div className="letter-scroll">
      <div className="letter-mailbox-link">
        <button onClick={openMailbox}>
          <EnvelopeOutlineIcon color="#6B6268" />
          <span>我的信箱 {letters.length}</span>
        </button>
      </div>

      <div className="letter-card">
        <div className="letter-dear-row">
          <div className="letter-dear-label-group">
            <span className="letter-dear-static">Dear</span>
            <input
              className="letter-dear-input"
              value={letterDearText || ''}
              onChange={(e) => onLetterDearChange(e.target.value)}
              placeholder={letterRecipient}
            />
          </div>
          <div className="letter-heart-wrap">
            <button className="letter-heart-btn" onClick={toggleRecipientPicker} />
            {showRecipientPicker && (
              <div className="letter-recipient-menu">
                <div className="letter-recipient-menu-label">寄给</div>
                {RECIPIENTS.map((r) => (
                  <button
                    key={r}
                    className="letter-recipient-option"
                    style={{
                      background: letterRecipient === r ? 'rgba(200,137,158,0.18)' : 'transparent',
                      color: letterRecipient === r ? '#7A5C4E' : '#8A7A6E',
                    }}
                    onClick={() => setLetterRecipient(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <textarea
          className="letter-textarea"
          value={letterText}
          onChange={(e) => onLetterTextChange(e.target.value)}
          placeholder="提笔写下想说的话…"
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <input
            type="date"
            className="diary-date-input"
            style={{ height: 34, fontSize: '16px', width: 140 }}
            value={letterUnlockDate}
            onChange={(e) => onUnlockDateChange(e.target.value)}
          />
          <div className="letter-signature-row" style={{ marginTop: 0 }}>
            <input
              className="letter-signature-input"
              value={letterSignature || ''}
              onChange={(e) => onLetterSignatureChange(e.target.value)}
              placeholder={nickname}
            />
          </div>
        </div>
      </div>

      <div className="letter-send-row">
        <button
          className="letter-send-btn"
          style={{ animation: sealPulse ? 'sealStamp 0.42s ease' : 'none' }}
          onClick={sealLetterAnimated}
        >
          发送
        </button>
      </div>
    </div>
  );
}

function Mailbox() {
  const letters = useStore((s) => s.letters);
  const letterMailboxTab = useStore((s) => s.letterMailboxTab);
  const setMailboxTab = useStore((s) => s.setMailboxTab);
  const closeMailbox = useStore((s) => s.closeMailbox);
  const toggleLetterItem = useStore((s) => s.toggleLetterItem);
  const expandedLetterIds = useStore((s) => s.expandedLetterIds);
  const isDateDue = useStore((s) => s.isDateDue);
  const parseLocalDate = useStore((s) => s.parseLocalDate);

  const todayMid = new Date();
  todayMid.setHours(0, 0, 0, 0);

  const filtered = letters
    .filter((l) => (letterMailboxTab === 'sent' ? l.sender === '小晴' : l.sender === '屿深'))
    .slice()
    .sort((a, b) => parseLocalDate(b.unlockDate) - parseLocalDate(a.unlockDate));

  return (
    <div className="letter-scroll">
      <div className="mailbox__head">
        <button className="circle-back-btn" style={{ background: 'rgba(255,255,255,0.55)', border: 'none' }} onClick={closeMailbox}>
          <BackChevronIcon />
        </button>
        <div className="mailbox__head-title">我的信箱</div>
      </div>

      <div className="mailbox__tabs">
        {[
          { key: 'sent', label: '寄出的信' },
          { key: 'received', label: '收到的信' },
        ].map((tb) => {
          const active = letterMailboxTab === tb.key;
          return (
            <button
              key={tb.key}
              className="mailbox__tab"
              style={{ background: active ? '#fff' : 'transparent', color: active ? '#5C4A54' : '#6B6268' }}
              onClick={() => setMailboxTab(tb.key)}
            >
              {tb.label}
            </button>
          );
        })}
      </div>

      {filtered.map((l) => {
        const unlockD = parseLocalDate(l.unlockDate);
        unlockD.setHours(0, 0, 0, 0);
        const isDue = unlockD <= todayMid;
        const daysLeft = Math.ceil((unlockD - todayMid) / 86400000);
        const label = l.sender === '小晴' ? (l.recipient === '小晴' ? '写给未来的自己' : '写给屿深') : '屿深写给你';
        const statusText = !isDue ? `还有 ${daysLeft} 天解锁` : l.opened ? `已拆开` : '可以拆开了';
        const expanded = expandedLetterIds.includes(l.id);
        const showHint = expanded && !isDue;
        const showBody = expanded && isDue;

        return (
          <div key={l.id} className="mailbox__letter" onClick={() => toggleLetterItem(l.id)}>
            <div className="mailbox__letter-row">
              <EnvelopeIcon fill={l.opened ? '#F6E2E8' : '#E7E1E4'} stroke={l.opened ? '#C08BA0' : '#A79DA3'} />
              <div className="mailbox__letter-info">
                <div className="mailbox__letter-label">{label}</div>
                <div className="mailbox__letter-meta">{statusText}</div>
              </div>
            </div>
            <div className="mailbox__letter-expand" style={{ maxHeight: expanded ? 600 : 0 }}>
              {showHint && (
                <div className="mailbox__letter-hint">还有 {daysLeft} 天解锁 · 还不能打开哦</div>
              )}
              {showBody && (
                <div className="mailbox__letter-full">
                  <div className="mailbox__letter-heart" />
                  <div className="mailbox__letter-dear">Dear {l.dearText || l.recipient}</div>
                  <div className="mailbox__letter-body">{l.body}</div>
                  <div className="mailbox__letter-signature">{l.signature || l.sender}</div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
