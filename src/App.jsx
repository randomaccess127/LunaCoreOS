import { useState, useEffect } from 'react';
import AppShell from './components/Layout/AppShell';
import Dashboard from './components/Dashboard/Dashboard';
import JournalPage from './components/Journal/JournalPage';
import TodosPage from './components/Todos/TodosPage';
import InsightsPage from './components/Insights/InsightsPage';
import HabitsPage from './components/Habits/HabitsPage';
import MediaLibraryPage from './components/MediaLibrary/MediaLibraryPage';
import Videos from './components/Videos/Videos';
import VaultPage from './components/Vault/VaultPage';
import LifeMapPage from './components/LifeMap/LifeMapPage';
import TimeCapsulePage from './components/TimeCapsule/TimeCapsulePage';
import WhoAmIPage from './components/WhoAmI/WhoAmIPage';
import ThoughtDumpPage from './components/ThoughtDump/ThoughtDumpPage';
import StreaksPage from './components/Streaks/StreaksPage';
import ReadingListPage from './components/ReadingList/ReadingListPage';
import WatchlistPage from './components/Watchlist/WatchlistPage';
import FinancePage from './components/Finance/FinancePage';
import BookmarksPage from './components/Bookmarks/BookmarksPage';
import WritingPage from './components/Writing/WritingPage';
import YearlyReviewPage from './components/YearlyReview/YearlyReviewPage';
import StudyNotesPage from './components/StudyNotes/StudyNotesPage';
import TwitchPage from './components/Twitch/TwitchPage';
import DelegationPage from './components/Delegation/DelegationPage';
import NotificationsPage from './components/Notifications/NotificationsPage';
import InformationPage from './components/Information/InformationPage';
import MusicPlayerPage from './components/MusicPlayer/MusicPlayerPage';
import * as api from './services/api';
import { Preloader } from './services/preloader';
import { OfflineCache } from './services/offlineCache';
import OfflineCacheBadge from './components/OfflineCacheBadge';
import { supabase } from './services/supabaseClient';
import { loginWithSupabase } from './services/googleAuth';

export default function App() {
    const [tab, setTab] = useState(() => localStorage.getItem('luna_active_tab') || 'journal');
    const [userName, setUserName] = useState('');
    const [theme, setTheme] = useState('dark');
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [preload, setPreload] = useState({ active: false, current: 0, total: 0, status: '' });
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);

    const triggerPreload = () => {
        if (preload.active) return;
        setPreload({ active: true, current: 0, total: 0 });
        Preloader.start((current, total, status) => {
            setPreload({ active: current < total, current, total, status });
        });
    };

    useEffect(() => {
        // Handle Supabase Auth Session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setAuthLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            setAuthLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        const handleOnline = () => {
            setIsOffline(false);
            // Trigger background cache sync when coming online
            OfflineCache.triggerSync();
        };

        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        // Initialize offline cache monitoring
        const cleanupCache = OfflineCache.init();
        
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            cleanupCache?.();
        };
    }, []);

    useEffect(() => {
        // Load config on mount
        api.getDashboardStats()
            .then(data => {
                if (data?.config?.user_name) setUserName(data.config.user_name);
                if (data?.config?.theme) {
                    setTheme(data.config.theme);
                    document.documentElement.setAttribute('data-theme', data.config.theme);
                }
            })
            .catch(() => { });
    }, []);

    const navigate = (tabId) => {
        setTab(tabId);
        localStorage.setItem('luna_active_tab', tabId);
    };

    const renderTab = () => {
        switch (tab) {
            case 'dashboard': return <Dashboard onNavigate={navigate} />;
            case 'journal': return <JournalPage />;
            case 'todos': return <TodosPage />;
            case 'insights': return <InsightsPage />;
            case 'habits': return <HabitsPage />;
            case 'videos': return <Videos />;
            case 'media': return <MediaLibraryPage />;
            case 'vault': return <VaultPage />;
            case 'lifemap': return <LifeMapPage />;
            case 'timecapsule': return <TimeCapsulePage />;
            case 'whoami': return <WhoAmIPage />;
            case 'thoughtdump': return <ThoughtDumpPage />;
            case 'streaks': return <StreaksPage />;
            case 'readinglist': return <ReadingListPage />;
            case 'watchlist': return <WatchlistPage />;
            case 'finance': return <FinancePage />;
            case 'bookmarks': return <BookmarksPage />;
            case 'writing': return <WritingPage />;
            case 'studynotes': return <StudyNotesPage />;
            case 'yearlyreview': return <YearlyReviewPage />;
            case 'twitch': return <TwitchPage />;
            case 'delegation': return <DelegationPage />;
            case 'notifications': return <NotificationsPage />;
            case 'information': return <InformationPage />;
            case 'musicplayer': return <MusicPlayerPage />;
            default: return <Dashboard onNavigate={navigate} />;
        }
    };

    if (authLoading) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
                <div className="loader" style={{ border: '3px solid #1a1a1a', borderTop: '3px solid #f97316', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite' }}></div>
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (!user) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', backgroundImage: 'radial-gradient(circle at top right, #331100, transparent), radial-gradient(circle at bottom left, #110033, transparent)' }}>
                <div style={{ background: 'rgba(20, 20, 20, 0.8)', padding: '3rem', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)', textAlign: 'center', maxWidth: '400px', width: '90%', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🌘</div>
                    <h1 style={{ color: 'white', marginBottom: '0.5rem', fontSize: '2rem', fontWeight: '700' }}>Luna Diary</h1>
                    <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '2.5rem' }}>Welcome back. Sign in to your private workspace to continue.</p>
                    
                    <button 
                        onClick={loginWithSupabase}
                        style={{ background: '#f97316', color: 'white', border: 'none', padding: '1rem 2rem', borderRadius: '12px', fontSize: '1.1rem', fontWeight: '600', cursor: 'pointer', width: '100%', transition: 'all 0.3s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', boxShadow: '0 10px 20px rgba(249, 115, 22, 0.2)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 15px 30px rgba(249, 115, 22, 0.3)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 20px rgba(249, 115, 22, 0.2)'; }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.908 3.152-1.928 4.176-1.288 1.288-3.312 2.696-6.892 2.696-5.572 0-10.04-4.508-10.04-10.12s4.468-10.12 10.04-10.12c3.036 0 5.256 1.196 6.872 2.736l2.308-2.308c-1.956-1.872-4.596-3.328-9.18-3.328-8.204 0-14.92 6.64-14.92 14.84s6.716 14.84 14.92 14.84c4.416 0 7.744-1.452 10.32-4.148 2.656-2.656 3.5-6.388 3.5-9.288 0-.88-.072-1.712-.204-2.48h-13.616z"/></svg>
                        Sign in with Google
                    </button>
                    
                    <div style={{ marginTop: '2rem', fontSize: '0.9rem', color: 'rgba(255,255,255,0.3)' }}>
                        Encrypted & Private
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <AppShell 
                activeTab={tab} 
                onNavigate={navigate} 
                userName={userName} 
                isOffline={isOffline} 
                preload={preload}
                onPreload={triggerPreload}
            >
                {renderTab()}
            </AppShell>
            <OfflineCacheBadge />
        </>
    );
}
