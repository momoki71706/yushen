import { useStore } from '../state/store';
import { CloseIcon, EnvelopeBigIcon } from './Icons';

export default function LetterReminder() {
  const showLetterReminder = useStore((s) => s.showLetterReminder);
  const dismissReminder = useStore((s) => s.dismissReminder);
  const viewReminderLetter = useStore((s) => s.viewReminderLetter);
  const letters = useStore((s) => s.letters);
  const isDateDue = useStore((s) => s.isDateDue);

  if (!showLetterReminder) return null;

  const dueCount = letters.filter((l) => isDateDue(l.unlockDate) && !l.opened).length;
  const title = dueCount > 1 ? `你有 ${dueCount} 封信可以打开了` : '你有一封信可以打开了';

  return (
    <div className="reminder-overlay">
      <div className="reminder-card">
        <button className="reminder-close" onClick={dismissReminder}>
          <CloseIcon />
        </button>
        <div className="reminder-icon-circle">
          <EnvelopeBigIcon />
        </div>
        <div className="reminder-title">{title}</div>
        <div className="reminder-desc">时间信箱里有一封信到日子了</div>
        <button className="reminder-btn" onClick={viewReminderLetter}>立即查看</button>
      </div>
    </div>
  );
}
