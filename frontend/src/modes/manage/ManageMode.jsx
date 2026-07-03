import { useStore } from '../../state/store';
import ManageHome from './ManageHome';
import LedgerView from './LedgerView';
import HabitsView from './HabitsView';

export default function ManageMode() {
  const manageView = useStore((s) => s.manageView);

  if (manageView === 'ledger') return <LedgerView />;
  if (manageView === 'habits') return <HabitsView />;
  return <ManageHome />;
}
