import { useEffect } from 'react';
import './App.css';
import { useStore } from './state/store';
import { useVisualViewportHeight } from './useVisualViewportHeight';
import { registerServiceWorker, listenForProactiveMessages } from './push';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import Sidebar from './components/Sidebar';
import LetterReminder from './components/LetterReminder';
import DiaryReminder from './components/DiaryReminder';
import AiSettingsPanel from './components/AiSettingsPanel';
import McpPanel from './components/McpPanel';
import PresetPanel from './components/PresetPanel';
import ContextPanel from './components/ContextPanel';
import PushSettingsPanel from './components/PushSettingsPanel';
import ClearChatConfirm from './components/ClearChatConfirm';
import ImageViewer from './components/ImageViewer';
import MemoryPanel from './components/MemoryPanel';
import MemoryToast from './components/MemoryToast';
import ModePill from './components/ModePill';
import PlaceholderTab from './components/PlaceholderTab';
import ChatMode from './modes/ChatMode';
import DiaryMode from './modes/DiaryMode';
import LetterMode from './modes/LetterMode';
import ManageMode from './modes/manage/ManageMode';

function App() {
  const init = useStore((s) => s.init);
  const activeTab = useStore((s) => s.activeTab);
  const homeMode = useStore((s) => s.homeMode);
  const diaryView = useStore((s) => s.diaryView);
  const letterView = useStore((s) => s.letterView);

  useVisualViewportHeight();

  useEffect(() => {
    init();
    registerServiceWorker();

    // A proactive/scheduled message is written to the DB the moment it's
    // generated, but this already-open tab has no way to know that on its
    // own — refetch when the service worker tells us a push just landed,
    // and again as a fallback whenever the app is reopened/refocused (e.g.
    // tapping the notification, or just switching back from the home
    // screen), so it shows up in the chat log instead of only existing
    // server-side until some unrelated reload happens to pull it in.
    listenForProactiveMessages(() => useStore.getState().loadMessages());
    const onVisible = () => {
      if (document.visibilityState === 'visible') useStore.getState().loadMessages();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    // The periodic memory-review pass runs entirely server-side with no
    // reply to surface — polling is the only way an already-open tab finds
    // out a save just happened, so it can show the in-app toast.
    const memoryPoll = setInterval(() => useStore.getState().pollMemoryLog(), 60 * 1000);
    useStore.getState().pollMemoryLog();

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      clearInterval(memoryPoll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isHome = activeTab === 'home';
  const showModePill = isHome && !(homeMode === 'diary' && diaryView === 'detail') && !(homeMode === 'letter' && letterView === 'mailbox');

  return (
    <div className="app-outer">
      <div className="phone">
        <div className="phone__bg" style={{ backgroundImage: 'url(/background.jpg)' }} />
        <div className="phone__noise" />

        <Header />

        <div className="phone__content">
          {showModePill && <ModePill />}

          {isHome && homeMode === 'chat' && <ChatMode />}
          {isHome && homeMode === 'diary' && <DiaryMode />}
          {isHome && homeMode === 'letter' && <LetterMode />}
          {activeTab === 'manage' && <ManageMode />}
          {activeTab === 'calendar' && <PlaceholderTab tab="calendar" />}
          {activeTab === 'play' && <PlaceholderTab tab="play" />}
        </div>

        <BottomNav />

        <Sidebar />
        <LetterReminder />
        <DiaryReminder />
        <AiSettingsPanel />
        <McpPanel />
        <PresetPanel />
        <ContextPanel />
        <PushSettingsPanel />
        <ClearChatConfirm />
        <ImageViewer />
        <MemoryPanel />
        <MemoryToast />
      </div>
    </div>
  );
}

export default App;
