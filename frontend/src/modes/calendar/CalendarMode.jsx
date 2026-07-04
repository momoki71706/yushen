import { useStore } from '../../state/store';
import CalendarHome from './CalendarHome';
import PeriodView from './PeriodView';
import IntimacyView from './IntimacyView';
import ExerciseView from './ExerciseView';
import CountdownView from './CountdownView';
import MilestoneView from './MilestoneView';

export default function CalendarMode() {
  const calendarView = useStore((s) => s.calendarView);

  if (calendarView === 'period') return <PeriodView />;
  if (calendarView === 'intimacy') return <IntimacyView />;
  if (calendarView === 'exercise') return <ExerciseView />;
  if (calendarView === 'countdown') return <CountdownView />;
  if (calendarView === 'milestone') return <MilestoneView />;
  return <CalendarHome />;
}
