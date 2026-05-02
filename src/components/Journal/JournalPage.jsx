import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useJournal } from '../../hooks/useJournal';
import { SkeletonCard } from '../Shared/Skeleton';
import MediaRow from '../Shared/MediaRow';
import JournalCalendar from './JournalCalendar';
import JournalEditor from './JournalEditor';
import * as api from '../../services/api';
import { OfflineCache } from '../../services/offlineCache';

const MOODS = ['😊', '😌', '😐', '😰', '😔', '🤩', '😤', '🥱'];

export default function JournalPage() {
    const { entries, loading, create, update, remove } = useJournal();
    const [active, setActive] = useState(null);
    const [draft, setDraft] = useState({});
    const [saving, setSaving] = useState(false);
    const [savingMedia, setSavingMedia] = useState(false);
    const [mediaProgress, setMediaProgress] = useState(0);
    const [savedAt, setSavedAt] = useState('');
    const [mediaItems, setMediaItems] = useState({ audio: [], images: [], files: [] });
    const autoSaveTimer = useRef(null);

    // View management: 'list' or 'calendar'
    const [viewMode, setViewMode] = useState('calendar');
    const [mobileView, setMobileView] = useState('list'); // 'list' or 'editor'
    const [confirmDate, setConfirmDate] = useState(null);
    const isMobile = window.innerWidth <= 768;

    const [isMigrating, setIsMigrating] = useState(false);
    const [migrationStatus, setMigrationStatus] = useState('');

    const handleMigrateJournal = async () => {
        if (!window.confirm('This will move all your Journal entries from Google Sheets to Supabase. Continue?')) return;
        setIsMigrating(true);
        setMigrationStatus('Fetching entries from Sheets...');
        try {
            const oldEntries = await api.getEntriesLegacy();
            setMigrationStatus(`Migrating ${oldEntries.length} entries...`);
            
            const chunkSize = 20;
            for (let i = 0; i < oldEntries.length; i += chunkSize) {
                const chunk = oldEntries.slice(i, i + chunkSize).map(e => ({
                    entry_id: e.entry_id,
                    date: api.sanitizeDate(e.date),
                    day_of_week: e.day_of_week,
                    time_created: e.time_created || new Date().toISOString(),
                    time_modified: e.time_modified || new Date().toISOString(),
                    title: e.title || '',
                    text_content: e.text_content || '',
                    mood: e.mood || '',
                    energy_level: String(e.energy_level || ''),
                    weather: e.weather || '',
                    word_count: parseInt(e.word_count) || 0,
                    audio_refs: e.audio_refs || '',
                    image_refs: e.image_refs || '',
                    file_refs: e.file_refs || '',
                    tags: e.tags || '',
                    location: e.location || '',
                    is_private: e.is_private === 'true' || e.is_private === true,
                    actionable_insight_id: e.actionable_insight_id || '',
                    streak_day: parseInt(e.streak_day) || 0,
                    status: e.status || 'published'
                }));
                
                const { error } = await api.supabase.from('journal_entries').upsert(chunk);
                if (error) throw error;
                setMigrationStatus(`Migrated ${Math.min(i + chunkSize, oldEntries.length)} / ${oldEntries.length} notes...`);
            }

            setMigrationStatus('Migration Successful! Refreshing...');
            setTimeout(() => window.location.reload(), 2000);
        } catch (err) {
            console.error('Migration failed:', err);
            setMigrationStatus(`Error: ${err.message}`);
        } finally {
            setIsMigrating(false);
        }
    };

    // Open the most recent entry, or a blank new one
    useEffect(() => {
        if (entries.length > 0 && !active && !isMobile) openEntry(entries[0]);
    }, [entries]);

    // Auto-cleanup: remove empty draft entries created more than 5 minutes ago with no changes
    useEffect(() => {
        const cleanupInterval = setInterval(async () => {
            const now = Date.now();
            const fiveMinutesAgo = now - (5 * 60 * 1000);
            
            for (const entry of entries) {
                if (entry.status === 'draft' && !entry.text_content && !entry.title && 
                    new Date(entry.time_created || entry.created_at).getTime() < fiveMinutesAgo) {
                    // Remove old empty drafts
                    await remove(entry.entry_id);
                }
            }
        }, 60000); // Check every minute
        
        return () => clearInterval(cleanupInterval);
    }, [entries, remove]);

    const openEntry = (entry) => {
        // If entry is null, reset the draft
        if (!entry) {
            setActive(null);
            setDraft({});
            return;
        }

        setActive(entry);
        setDraft({
            entry_id: entry.entry_id,
            text_content: entry.text_content || '',
            mood: entry.mood || '',
            energy_level: entry.energy_level || 5,
            location: entry.location || '',
            tags: entry.tags ? entry.tags.split(',').filter(Boolean) : [],
            title: entry.title || '',
            date: api.sanitizeDate(entry.date),
            audio_refs: entry.audio_refs || '',
            image_refs: entry.image_refs || '',
            file_refs: entry.file_refs || '',
        });
        
        if (isMobile) setMobileView('editor');

        // Load media for this entry
        if (entry.entry_id) {
            api.getMediaBySource(entry.entry_id)
                .then(data => {
                    const items = data || [];
                    setMediaItems({
                        audio: items.filter(i => i.media_type === 'audio'),
                        images: items.filter(i => i.media_type === 'image'),
                        files: items.filter(i => i.media_type === 'file'),
                    });
                })
                .catch(() => { });
        }
    };

    const newEntry = async (dateOverride = null) => {
        const targetDate = dateOverride || api.getLocalDate();
        
        // Check if entry already exists for this date
        const existingEntry = entries.find(e => api.sanitizeDate(e.date) === targetDate);
        if (existingEntry) {
            openEntry(existingEntry);
            return;
        }
        
        // Create new entry if none exists for this date
        const entry = await create({ 
            status: 'draft',
            date: targetDate
        });
        openEntry(entry);
    };

    const onChange = (field, value) => {
        setDraft(d => ({ ...d, [field]: value }));
        clearTimeout(autoSaveTimer.current);
        setSavedAt('Saving...');
        autoSaveTimer.current = setTimeout(() => doSave({ ...draft, [field]: value }), 1500);
    };

    const doSave = useCallback(async (data) => {
        if (!active) return;
        setSaving(true);
        try {
            await update({
                entry_id: active.entry_id,
                text_content: data.text_content,
                mood: data.mood,
                energy_level: data.energy_level,
                location: data.location,
                tags: (data.tags || []).join(','),
                title: data.title,
                date: data.date,
                audio_refs: data.audio_refs,
                image_refs: data.image_refs,
                file_refs: data.file_refs,
                status: 'published',
            });
            setSavedAt('Saved just now');
        } finally { setSaving(false); }
    }, [active, update]);

    const addTag = (e) => {
        if (e.key === 'Enter' && e.target.value.trim()) {
            const t = e.target.value.trim();
            onChange('tags', [...(draft.tags || []), t]);
            e.target.value = '';
        }
    };

    const removeTag = (t) => onChange('tags', (draft.tags || []).filter(tag => tag !== t));
    
    const handleDelete = async () => {
        if (!active || !window.confirm('Are you sure you want to delete this entry?')) return;
        await remove(active.entry_id);
        setActive(null);
        setDraft({});
        if (isMobile) setMobileView('list');
        OfflineCache.invalidate('journal');
    };

    // Media upload helpers
    const uploadMedia = async (file, mediaType) => {
        if (!active || !file) return;

        const MAX_SIZE = 45 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            alert(`File too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Google Apps Script limit is ~50MB. Please use a smaller file.`);
            return;
        }

        // Safety fallback if mediaType is missing
        if (!mediaType) {
            if (file.type.includes('image')) mediaType = 'image';
            else if (file.type.includes('audio')) mediaType = 'audio';
            else mediaType = 'file';
        }

        setSavingMedia(true);
        setMediaProgress(10);
        setSavedAt('Uploading media...');
        let timer;
        try {
            const res = await api.uploadMedia({
                file, filename: file.name, mime_type: file.type,
                media_type: mediaType, uploaded_from: 'journal', source_id: active.entry_id,
            });
            
            clearInterval(timer);
            setMediaProgress(100);

            const newItem = { 
                media_id: res.media_id, 
                drive_link: res.drive_link, 
                thumbnail_link: res.thumbnail_link || res.drive_link, 
                filename: file.name, 
                display_name: file.name 
            };
            
            const refKey = mediaType === 'image' ? 'image_refs' : mediaType === 'audio' ? 'audio_refs' : 'file_refs';
            const currentRefs = draft[refKey] ? draft[refKey].split(',').filter(Boolean) : [];
            currentRefs.push(res.media_id);
            onChange(refKey, currentRefs.join(','));

            setMediaItems(m => ({
                ...m,
                [mediaType === 'image' ? 'images' : mediaType === 'audio' ? 'audio' : 'files']:
                    [...m[mediaType === 'image' ? 'images' : mediaType === 'audio' ? 'audio' : 'files'], newItem]
            }));
            setSavedAt('Media uploaded');
            
            setTimeout(() => {
                setSavingMedia(false);
                setMediaProgress(0);
            }, 800);
        } catch (e) {
            clearInterval(timer);
            setSavingMedia(false);
            setMediaProgress(0);
            console.error('Upload Error:', e);
            alert(`Media upload failed: ${e.message}. Did you re-deploy the Apps Script?`);
            setSavedAt('Upload failed');
        }
    };

    const handleRemoveMedia = async (mediaOrId) => {
        if (!active || !mediaOrId) return;
        
        // Robustly extract the ID if an object was passed instead of a string
        const mediaId = (typeof mediaOrId === 'object') ? (mediaOrId.media_id || mediaOrId.id) : mediaOrId;
        if (!mediaId) {
            console.error('[Media] Invalid mediaId:', mediaOrId);
            return;
        }

        const idStr = String(mediaId).trim();

        if (!window.confirm('Permanently delete this media file?')) return;

        console.log(`[Media] Deleting media ID: "${idStr}"`);
        
        // 1. Permanently delete from backend (Drive & Sheet)
        try {
            await api.deleteMedia({ media_id: idStr });
            
            // 2. Update local UI state
            setMediaItems(prev => ({
                audio: prev.audio.filter(m => String(m.media_id).trim() !== idStr),
                images: prev.images.filter(m => String(m.media_id).trim() !== idStr),
                files: prev.files.filter(m => String(m.media_id).trim() !== idStr)
            }));

            // 3. Update the local draft to remove the reference
            setDraft(currentDraft => {
                const newDraft = { ...currentDraft };
                const removeIdFromRef = (refStr) => (refStr || '').split(',').map(s => s.trim()).filter(id => id && id !== idStr).join(',');
                
                newDraft.image_refs = removeIdFromRef(currentDraft.image_refs);
                newDraft.audio_refs = removeIdFromRef(currentDraft.audio_refs);
                newDraft.file_refs = removeIdFromRef(currentDraft.file_refs);
                
                return newDraft;
            });

            setSavedAt('Media deleted');
        } catch (e) {
            console.error('[Media] Delete failed:', e);
            alert('Failed to delete media: ' + e.message);
        }
    };

    if (loading) return (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 0, height: 'calc(100vh - 56px - 64px)' }}>
            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[...Array(5)].map((_, i) => <SkeletonCard key={i} lines={2} />)}
            </div>
        </div>
    );

    const wc = draft.text_content ? draft.text_content.trim().split(/\s+/).filter(Boolean).length : 0;
    
    // Determine the active date string for the calendar
    const activeDateStr = draft.date || (active?.date ? api.sanitizeDate(active.date) : null);

    return (
        <div className={`journal-layout ${mobileView}-view`} style={{ height: 'calc(100vh - var(--player-h) - 0px)' }}>
            


            {/* Left Panel */}
            {(mobileView === 'list' || !isMobile) && (
                <div className="journal-list">
                    {/* View Switcher */}
                    <div className="vault-mobile-nav" style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)' }}>
                        <div className="vault-segments">
                            <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}>📝 List</button>
                            <button className={viewMode === 'calendar' ? 'active' : ''} onClick={() => setViewMode('calendar')}>📅 Calendar</button>
                        </div>
                    </div>

                    {/* New entry is handled via Calendar selection, button removed to declutter */}
                    
                    {entries.length === 0 && !loading && (
                        <div className="migration-card" style={{ margin: '1rem', padding: '1rem', background: 'rgba(255,165,0,0.1)', border: '1px solid #ffa500', borderRadius: '12px' }}>
                            <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: '#ffa500', fontWeight: 'bold' }}>
                                Found 0 entries. Migrate from Google Sheets?
                            </p>
                            <button 
                                className="btn btn-sm" 
                                onClick={handleMigrateJournal}
                                disabled={isMigrating}
                                style={{ background: '#ffa500', color: '#fff', width: '100%' }}
                            >
                                {isMigrating ? 'Migrating...' : '🚀 Migrate Now'}
                            </button>
                        </div>
                    )}

                    {isMigrating && (
                        <div className="migration-status-banner" style={{ margin: '0 1rem 1rem 1rem', fontSize: '0.8rem' }}>
                            <span>🔄 {migrationStatus}</span>
                        </div>
                    )}

                    <div className="journal-sidebar-content">
                        {viewMode === 'list' ? (
                            <div className="fade-in">
                                {entries.map(entry => (
                                    <div
                                        key={entry.entry_id}
                                        className={`entry-card ${active?.entry_id === entry.entry_id ? 'active' : ''}`}
                                        onClick={() => openEntry(entry)}
                                        style={{ position: 'relative' }}
                                    >
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (window.confirm('Are you sure you want to delete this entry?')) {
                                                    remove(entry.entry_id);
                                                }
                                            }}
                                            style={{
                                                position: 'absolute',
                                                top: '0.5rem',
                                                right: '0.5rem',
                                                background: 'rgba(239, 68, 68, 0.1)',
                                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                                color: '#ef4444',
                                                width: '28px',
                                                height: '28px',
                                                borderRadius: '50%',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '1rem',
                                                opacity: window.innerWidth <= 768 ? 0.7 : 0.3,
                                                transition: 'all 0.2s',
                                                zIndex: 5
                                            }}
                                            onMouseEnter={e => {
                                                if (window.innerWidth > 768) {
                                                    e.target.style.opacity = '1';
                                                    e.target.style.background = 'rgba(239, 68, 68, 0.2)';
                                                }
                                            }}
                                            onMouseLeave={e => {
                                                if (window.innerWidth > 768) {
                                                    e.target.style.opacity = '0.3';
                                                    e.target.style.background = 'rgba(239, 68, 68, 0.1)';
                                                }
                                            }}
                                            title="Delete entry"
                                        >✕</button>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: '1.5rem' }}>
                                            <span className="entry-card-date">{api.sanitizeDate(entry.date)}</span>
                                            <span className="entry-card-mood">{entry.mood === 'happy' ? '😊' : entry.mood === 'calm' ? '😌' : entry.mood === 'excited' ? '🤩' : entry.mood === 'sad' ? '😔' : entry.mood === 'anxious' ? '😰' : entry.mood || '😐'}</span>
                                        </div>
                                        {entry.title && <div className="entry-card-title">{entry.title}</div>}
                                        <div className="entry-card-preview">{entry.text_content || 'No content'}</div>
                                        <div className="entry-card-meta">
                                            <span className="entry-card-wc">{entry.word_count || 0} words</span>
                                            {entry.status === 'draft' && <span className="badge badge-draft">DRAFT</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="cal-sidebar-wrap fade-in">
                                <JournalCalendar 
                                    entries={entries} 
                                    activeDate={activeDateStr}
                                    onSelect={(date, entry) => {
                                        if (entry) openEntry(entry);
                                        else setConfirmDate(date);
                                    }}
                                />
                                <div className="cal-legend">
                                    <p style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '1.2rem' }}>💡</span>
                                        Select a day to write or review.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Right Panel — Editor */}
            {(mobileView === 'editor' || !isMobile) && (
                <div className="journal-editor">
                    {!active ? (
                        <div className="empty-state">
                            <div className="empty-emoji">📖</div>
                            <p>Select an entry to read or create a new one.</p>
                            <button className="btn btn-primary" onClick={() => newEntry()}>Start Writing ✏️</button>
                        </div>
                    ) : (
                        <div className="journal-editor-scroll">
                            {/* Top bar */}
                            <div className="editor-topbar">
                                <div className="editor-header-main">
                                    {isMobile && (
                                        <button className="btn btn-ghost btn-sm" onClick={() => setMobileView('list')}>
                                            ⬅️ Back
                                        </button>
                                    )}
                                    <input className="field-input editor-title-input" placeholder="Untitled Entry" 
                                        value={draft.title || ''} onChange={e => onChange('title', e.target.value)} />
                                </div>

                                <div className="editor-meta-row">
                                    <div className="field-group">
                                        <label className="field-label">Date</label>
                                        <input type="date" className="field-input" value={draft.date || ''} onChange={e => onChange('date', e.target.value)} />
                                    </div>
                                    <div className="field-group" style={{ flex: 1 }}>
                                        <label className="field-label">Location</label>
                                        <input className="field-input" placeholder="Where are you?" value={draft.location || ''} onChange={e => onChange('location', e.target.value)} />
                                    </div>
                                </div>

                                <div className="editor-mood-row">
                                    <div className="field-group" style={{ flex: 1 }}>
                                        <label className="field-label">Mood</label>
                                        <div className="mood-row">
                                            {MOODS.map(m => (
                                                <button key={m} className={`mood-btn ${draft.mood === m ? 'active' : ''}`} onClick={() => onChange('mood', m)}>{m}</button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="field-group energy-field">
                                        <label className="field-label">Energy {draft.energy_level}/10</label>
                                        <input type="range" min="1" max="10" className="volume-slider" style={{ width: '100%' }}
                                            value={draft.energy_level || 5} onChange={e => onChange('energy_level', e.target.value)} />
                                    </div>
                                </div>

                                <div className="editor-actions-bar">
                                    <span className={`autosave-label ${savingMedia ? 'pulse' : ''}`} style={{ color: savingMedia ? 'var(--primary)' : '', fontSize: '0.75rem' }}>
                                        {savedAt}
                                    </span>
                                    <button className="btn btn-ghost btn-sm" onClick={handleDelete} title="Delete Entry" style={{ color: '#ef4444', marginLeft: 'auto', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)', fontSize: '0.9rem' }}>
                                        🗑️ Delete Entry
                                    </button>
                                </div>
                            </div>

                            {/* Tags */}
                            <div className="tags-row">
                                {(draft.tags || []).map(t => (
                                    <span key={t} className="pill">{t}<span className="pill-remove" onClick={() => removeTag(t)}>✕</span></span>
                                ))}
                                <input className="field-input tag-input" placeholder="＋ tag" onKeyDown={addTag} />
                            </div>

                            {/* Tiptap Rich Editor */}
                            <div className="journal-editor-container">
                                <JournalEditor 
                                    content={draft.text_content || ''} 
                                    onChange={(val) => onChange('text_content', val)}
                                />
                                <div className="word-count">{wc} words</div>
                            </div>

                            {/* Media row */}
                            <MediaRow 
                                active={active} 
                                mediaItems={mediaItems} 
                                onUpload={uploadMedia}
                                onRecord={f => uploadMedia(f, 'audio')}
                                onRemove={handleRemoveMedia}
                            />

                            {savingMedia && (
                                <div className="progress-container" style={{ marginTop: '1.5rem' }}>
                                    <div className="progress-header">
                                        <div className="progress-label">
                                            <span className="spinner-mini" style={{ width: 14, height: 14, borderWidth: 2 }}></span>
                                            Uploading media...
                                        </div>
                                        <div className="progress-value">{Math.round(mediaProgress)}%</div>
                                    </div>
                                    <div className="progress-track">
                                        <div className="progress-fill" style={{ width: `${mediaProgress}%` }}></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* New Entry Confirmation Modal */}
            {confirmDate && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }} onClick={() => setConfirmDate(null)}>
                    <div className="candy-theme" style={{
                        background: 'var(--surface, #1a1a2e)', padding: '2rem', borderRadius: '16px',
                        border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center', maxWidth: '300px',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.5)', margin: '1rem'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📅</div>
                        <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text, #fff)' }}>Create New Entry?</h3>
                        <p style={{ margin: '0 0 1.5rem 0', color: 'rgba(255,255,255,0.7)', fontSize: '0.95rem' }}>
                            Start a new diary entry for {new Date(confirmDate + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}?
                        </p>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                            <button className="btn btn-ghost" onClick={() => setConfirmDate(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={() => {
                                newEntry(confirmDate);
                                setConfirmDate(null);
                            }}>Create Entry</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
