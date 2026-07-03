import { useStore } from '../../state/store';
import ManageHome from './ManageHome';
import LedgerView from './LedgerView';
import HabitsView from './HabitsView';
import WatchView from './WatchView';
import ScreentimeView from './ScreentimeView';

export default function ManageMode() {
  const manageView = useStore((s) => s.manageView);

  if (manageView === 'ledger') return <LedgerView />;
  if (manageView === 'habits') return <HabitsView />;
  if (manageView === 'watch') return <WatchView />;
  if (manageView === 'screentime') return <ScreentimeView />;
  return <ManageHome />;
}
