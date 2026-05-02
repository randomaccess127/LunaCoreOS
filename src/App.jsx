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
    const [showPassword, setShowPassword] = useState(false);

    const triggerPreload = () => {
        if (preload.active) return;
        setPreload({ active: true, current: 0, total: 0 });
        Preloader.start((current, total, status) => {
            setPreload({ active: current < total, current, total, status });
        });
    };

    useEffect(() => {
        // Handle Supabase Auth Session
        const initAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                setUser(session?.user ?? null);
            } catch (err) {
                console.error('Auth session fetch failed:', err);
            } finally {
                setAuthLoading(false);
            }
        };

        initAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            console.log(`[Auth Event] ${_event}`, session ? 'User present' : 'No user');
            setUser(session?.user ?? null);
            setAuthLoading(false);
        });

        // ── Session Heartbeat ──
        // Supabase auto-refresh sometimes fails in suspended tabs.
        // We explicitly pulse the session every 15 minutes to keep it alive.
        const heartbeat = setInterval(async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                console.log('[Auth] Pulsing session heartbeat...');
                const { error } = await supabase.auth.refreshSession();
                if (error) console.warn('[Auth] Heartbeat refresh failed:', error);
            }
        }, 15 * 60 * 1000);

        return () => {
            subscription.unsubscribe();
            clearInterval(heartbeat);
        };
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
            .then(res => {
                if (res?.data?.user_name) setUserName(res.data.user_name);
                if (res?.data?.theme) {
                    setTheme(res.data.theme);
                    document.documentElement.setAttribute('data-theme', res.data.theme);
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
            <div className="vault-theme">
                <div className="vault-container">
                    <div className="vault-icon">
                        <div className="pulse-ring"></div>
                        <div style={{ fontSize: '3rem', position: 'relative', zIndex: 2 }}>🌘</div>
                    </div>
                    <h1>Luna Sanctuary</h1>
                    <p>Enter your Master Key to unlock your private space.</p>
                    
                    <form onSubmit={async (e) => {
                        e.preventDefault();
                        const pwd = e.target.password.value;
                        const loginBtn = e.target.querySelector('.vault-button');
                        
                        try {
                            loginBtn.disabled = true;
                            loginBtn.innerText = 'Unlocking...';

                            const { error } = await supabase.auth.signInWithPassword({
                                email: 'randomaccess651@gmail.com',
                                password: pwd
                            });

                            if (error) {
                                alert('Invalid Master Key. Access Denied.');
                                loginBtn.disabled = false;
                                loginBtn.innerText = 'Unlock Sanctuary';
                            }
                        } catch (err) {
                            console.error('Vault login failed:', err);
                            loginBtn.disabled = false;
                            loginBtn.innerText = 'Unlock Sanctuary';
                        }
                    }} className="vault-form">
                        <div className="input-wrapper">
                            <input 
                                type={showPassword ? "text" : "password"} 
                                name="password" 
                                placeholder={showPassword ? "Master Key" : "••••••••"} 
                                autoFocus 
                                required 
                                style={{ letterSpacing: showPassword ? '0.1rem' : '0.5rem' }}
                            />
                            <button 
                                type="button" 
                                className="toggle-password"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? '🔒' : '👁️'}
                            </button>
                            <div className="input-glow"></div>
                        </div>
                        <button type="submit" className="vault-button">
                            Unlock Sanctuary
                        </button>
                    </form>
                    
                    <div className="vault-footer">
                        <span>Encrypted & Private</span>
                    </div>
                </div>

                <style dangerouslySetInnerHTML={{ __html: `
                    .vault-theme {
                        height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: radial-gradient(circle at center, #1a1a2e 0%, #0a0a0f 100%);
                        color: #fff;
                        font-family: 'Inter', sans-serif;
                    }
                    .vault-container {
                        text-align: center;
                        padding: 3rem;
                        background: rgba(20, 20, 30, 0.6);
                        backdrop-filter: blur(20px);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        border-radius: 2rem;
                        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                        width: 100%;
                        max-width: 400px;
                    }
                    .vault-icon {
                        position: relative;
                        width: 80px;
                        height: 80px;
                        margin: 0 auto 2rem;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .pulse-ring {
                        position: absolute;
                        top: 0; left: 0; right: 0; bottom: 0;
                        border-radius: 50%;
                        background: #f97316;
                        opacity: 0.2;
                        animation: pulse 2s infinite;
                    }
                    @keyframes pulse {
                        0% { transform: scale(1); opacity: 0.2; }
                        100% { transform: scale(1.5); opacity: 0; }
                    }
                    .vault-container h1 {
                        font-size: 2rem;
                        margin-bottom: 0.5rem;
                        background: linear-gradient(to right, #fff, #a5a5a5);
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                    }
                    .vault-container p {
                        color: #888;
                        font-size: 0.9rem;
                        margin-bottom: 2.5rem;
                    }
                    .input-wrapper {
                        position: relative;
                        margin-bottom: 1.5rem;
                    }
                    .vault-form input {
                        width: 100%;
                        padding: 1.2rem;
                        padding-right: 3.5rem;
                        background: rgba(0, 0, 0, 0.3);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        border-radius: 1rem;
                        color: #fff;
                        font-size: 1.2rem;
                        text-align: center;
                        transition: all 0.3s;
                        outline: none;
                    }
                    .vault-form input:focus {
                        border-color: #f97316;
                        box-shadow: 0 0 20px rgba(249, 115, 22, 0.2);
                    }
                    .toggle-password {
                        position: absolute;
                        right: 1rem;
                        top: 50%;
                        transform: translateY(-50%);
                        background: none;
                        border: none;
                        font-size: 1.2rem;
                        cursor: pointer;
                        opacity: 0.5;
                        transition: opacity 0.3s;
                        z-index: 3;
                    }
                    .toggle-password:hover {
                        opacity: 1;
                    }
                    .vault-button {
                        width: 100%;
                        padding: 1.2rem;
                        background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
                        border: none;
                        border-radius: 1rem;
                        color: #fff;
                        font-weight: 600;
                        font-size: 1rem;
                        cursor: pointer;
                        transition: all 0.3s;
                        box-shadow: 0 10px 15px -3px rgba(249, 115, 22, 0.3);
                    }
                    .vault-button:hover:not(:disabled) {
                        transform: translateY(-2px);
                        box-shadow: 0 20px 25px -5px rgba(249, 115, 22, 0.4);
                    }
                    .vault-button:disabled {
                        opacity: 0.6;
                        cursor: not-allowed;
                    }
                    .vault-footer {
                        margin-top: 2.5rem;
                        font-size: 0.75rem;
                        color: #444;
                        text-transform: uppercase;
                        letter-spacing: 0.1rem;
                    }
                ` }} />
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
