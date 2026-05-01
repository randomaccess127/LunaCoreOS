import { useAudio } from '../../context/AudioContext';
import { Disc, Settings, Play, Pause, SkipForward } from 'lucide-react';

const TABS = [
    { id: 'dashboard', icon: '🌸', label: 'Dashboard' },
    { id: 'journal', icon: '📖', label: 'Journal' },
    { id: 'todos', icon: '🎯', label: 'Todos' },
    { id: 'insights', icon: '✨', label: 'Insights' },
    { id: 'habits', icon: '💕', label: 'Habits' },
    { id: 'videos', icon: '🎬', label: 'Videos' },
    { id: 'media', icon: '🎨', label: 'Media Library' },
    { id: 'musicplayer', icon: '🎵', label: 'Music Player' },
    { id: 'vault', icon: '💎', label: 'Vault' },
    { id: 'lifemap', icon: '🧭', label: 'Life Map' },
    { id: 'timecapsule', icon: '📦', label: 'Time Capsule' },
    { id: 'whoami', icon: '🌙', label: 'Who Am I' },
    { id: 'thoughtdump', icon: '🌊', label: 'Thought Dump' },
    { id: 'streaks', icon: '🌟', label: 'Streaks' },
    { id: 'readinglist', icon: '📚', label: 'Reading List' },
    { id: 'watchlist', icon: '🎞️', label: 'Watchlist' },
    { id: 'finance', icon: '💳', label: 'Finance' },
    { id: 'bookmarks', icon: '❤️', label: 'Bookmarks' },
    { id: 'writing', icon: '✍️', label: 'Writing' },
    { id: 'studynotes', icon: '📝', label: 'Study Notes' },
    { id: 'yearlyreview', icon: '🎆', label: 'Yearly Review' },
    { id: 'twitch', icon: '🎮', label: 'Twitch' },
    { id: 'delegation', icon: '🤝', label: 'Delegation' },
    { id: 'information', icon: '📰', label: 'Information' },
    { id: 'notifications', icon: '🔔', label: 'Notifications' },
];

export default function Sidebar({ active, onNavigate, userName, isOffline, onPreload, preload, isOpen, onClose, onMusicClick }) {
    const { playing, currentTrack, playTrack, playNext } = useAudio();

    return (
        <>
            {/* Mobile Drawer Overlay */}
            {isOpen && <div className="sidebar-overlay" onClick={onClose} />}

            <aside className={`sidebar ${isOpen ? 'open' : ''}`}>

            <div className="sidebar-logo">
                <div className="logo-flex" onClick={() => onNavigate('dashboard')} style={{ cursor: 'pointer' }}>
                    <img src="/profile.jpg" alt="Logo" className="app-logo-img" />
                    <div className="logo-text">
                        <h1>Luna's Notes</h1>
                        <p>Your private sanctuary</p>
                    </div>
                </div>
            </div>

            <nav className="sidebar-nav">
                {TABS.map(tab => (
                    <div
                        key={tab.id}
                        className={`nav-item ${active === tab.id ? 'active' : ''}`}
                        onClick={() => onNavigate(tab.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => e.key === 'Enter' && onNavigate(tab.id)}
                    >
                        <span className="nav-icon">{tab.icon}</span>
                        <span className="nav-label">{tab.label}</span>
                    </div>
                ))}
                <div style={{ height: '2rem', flexShrink: 0 }} />
            </nav>

            {currentTrack && (
                <div className="sidebar-mini-player">
                    <div className="mini-player-info" onClick={() => onNavigate('musicplayer')}>
                        <div className={`mini-disc ${playing ? 'spinning' : ''}`}>
                            <Disc size={14} />
                        </div>
                        <div className="mini-details">
                            <span className="mini-title">{currentTrack.title}</span>
                            <span className="mini-artist">{currentTrack.artist}</span>
                        </div>
                    </div>
                    <div className="mini-controls">
                        <button onClick={() => playTrack(currentTrack)}>
                            {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                        </button>
                        <button onClick={playNext}>
                            <SkipForward size={14} fill="currentColor" />
                        </button>
                    </div>
                </div>
            )}

            <div className="sidebar-footer">
                <div className="user-profile-stack">
                    <img src="/profile.jpg" alt="Profile" className="profile-avatar-xs" />
                    <span className="user-name">{userName || 'You'}</span>
                </div>
                <div className="sidebar-footer-actions">
                    <button 
                        className={`sidebar-music-btn ${playing ? 'is-playing' : ''}`} 
                        onClick={onMusicClick}
                        title="Music Player"
                    >
                        <Disc size={22} />
                    </button>
                    <button className="settings-btn" title="Settings">
                        <Settings size={18} />
                    </button>
                </div>
            </div>
        </aside>
        </>
    );
}
