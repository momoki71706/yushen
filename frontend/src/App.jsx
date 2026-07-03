import { useEffect } from 'react';
import './App.css';
import { useStore } from './state/store';
import { useVisualViewportHeight } from './useVisualViewportHeight';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import Sidebar from './components/Sidebar';
import LetterReminder from './components/LetterReminder';
import AiSettingsPanel from './components/AiSettingsPanel';
import McpPanel from './components/McpPanel';
import PresetPanel from './components/PresetPanel';
import ModePill from './components/ModePill';
import PlaceholderTab from './components/PlaceholderTab';
import ChatMode from './modes/ChatMode';
import DiaryMode from './modes/DiaryMode';
import LetterMode from './modes/LetterMode';

function App() {
  const init = useStore((s) => s.init);
  const activeTab = useStore((s) => s.activeTab);
  const homeMode = useStore((s) => s.homeMode);
  const diaryView = useStore((s) => s.diaryView);
  const letterView = useStore((s) => s.letterView);

  useVisualViewportHeight();

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isHome = activeTab === 'home';
  const showModePill = isHome && !(homeMode === 'diary' && diaryView === 'detail') && !(homeMode === 'letter' && letterView === 'mailbox');

  return (
    <div className="app-outer">
      <div className="phone">
        <div className="phone__bg" style={{ backgroundImage: 'url(/background.jpg)' }} />
        <div className="phone__noise" />
        <div className="phone__safe-top" />

        <Header />

        <div className="phone__content">
          {showModePill && <ModePill />}

          {isHome && homeMode === 'chat' && <ChatMode />}
          {isHome && homeMode === 'diary' && <DiaryMode />}
          {isHome && homeMode === 'letter' && <LetterMode />}
          {activeTab === 'manage' && <PlaceholderTab tab="manage" />}
          {activeTab === 'calendar' && <PlaceholderTab tab="calendar" />}
          {activeTab === 'play' && <PlaceholderTab tab="play" />}
        </div>

        <BottomNav />

        <Sidebar />
        <LetterReminder />
        <AiSettingsPanel />
        <McpPanel />
        <PresetPanel />
      </div>
    </div>
  );
}

export default App;
