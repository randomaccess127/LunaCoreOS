import { useState, useRef } from 'react';
import { useAudio } from '../../context/AudioContext';
import Dither from '../Shared/Dither';
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
    const [isHovered, setIsHovered] = useState(false);
    const hoverTimeout = useRef(null);

    const handleMouseEnter = () => {
        clearTimeout(hoverTimeout.current);
        hoverTimeout.current = setTimeout(() => {
            setIsHovered(true);
        }, 150); // Small delay to avoid accidental triggers
    };

    const handleMouseLeave = () => {
        clearTimeout(hoverTimeout.current);
        hoverTimeout.current = setTimeout(() => {
            setIsHovered(false);
        }, 200); // Slightly longer delay for exit to feel stable
    };

    return (
        <>
            {/* Mobile Drawer Overlay */}
            {isOpen && <div className="sidebar-overlay" onClick={onClose} />}

            <aside 
                className={`sidebar scifi-sidebar ${isOpen ? 'open' : ''} ${isHovered ? 'is-expanded' : ''}`}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {/* Sharp Internal Dither Background */}
                <div className="sidebar-internal-dither">
                    <Dither 
                        waveColor={[0.5, 0.5, 0.5]} 
                        waveSpeed={0.03}
                        waveAmplitude={0.2}
                        waveFrequency={2}
                        colorNum={4}
                        pixelSize={2}
                    />
                </div>

            <div className="sidebar-logo">
                <div className="logo-flex" onClick={() => onNavigate('dashboard')} style={{ cursor: 'pointer' }}>
                    <img src="/profile.jpg" alt="Logo" className="app-logo-img" />
                    <div className="logo-text">
                        <h1>LunaCoreOS</h1>
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
                <div className="sidebar-footer-actions">
                    <button 
                        className={`sidebar-music-btn ${playing ? 'is-playing' : ''}`} 
                        onClick={onMusicClick}
                        title="Music Player"
                    >
                        <Disc size={24} className={playing ? 'spinning' : ''} />
                        <div className="music-btn-glow"></div>
                    </button>
                </div>
            </div>
        </aside>
        </>
    );
}
