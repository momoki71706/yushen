import { useStore } from '../../state/store';
import PlayHome from './PlayHome';
import ReadingView from './ReadingView';
import MusicView from './MusicView';
import EnglishView from './EnglishView';
import GamesView from './GamesView';

export default function PlayMode() {
  const playView = useStore((s) => s.playView);

  if (playView === 'reading') return <ReadingView />;
  if (playView === 'music') return <MusicView />;
  if (playView === 'english') return <EnglishView />;
  if (playView === 'games') return <GamesView />;
  return <PlayHome />;
}
