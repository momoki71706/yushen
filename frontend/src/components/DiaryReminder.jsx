import { useStore } from '../state/store';
import { CloseIcon, DiaryBigIcon } from './Icons';

export default function DiaryReminder() {
  const showDiaryReminder = useStore((s) => s.showDiaryReminder);
  const dismissDiaryReminder = useStore((s) => s.dismissDiaryReminder);
  const viewDiaryReminder = useStore((s) => s.viewDiaryReminder);
  const diaryUnreadEntries = useStore((s) => s.diaryUnreadEntries);
  const diaryUnreadComments = useStore((s) => s.diaryUnreadComments);

  if (!showDiaryReminder) return null;

  const parts = [];
  if (diaryUnreadEntries > 0) parts.push(`${diaryUnreadEntries} 篇新日记`);
  if (diaryUnreadComments > 0) parts.push(`${diaryUnreadComments} 条新留言`);

  return (
    <div className="reminder-overlay">
      <div className="reminder-card">
        <button className="reminder-close" onClick={dismissDiaryReminder}>
          <CloseIcon />
        </button>
        <div className="reminder-icon-circle">
          <DiaryBigIcon />
        </div>
        <div className="reminder-title">你有{parts.join('、')}</div>
        <div className="reminder-desc">日记里有还没看过的内容</div>
        <button className="reminder-btn" onClick={viewDiaryReminder}>立即查看</button>
      </div>
    </div>
  );
}
