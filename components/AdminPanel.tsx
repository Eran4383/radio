
import React, { useState, useEffect } from 'react';
import { Station, NetworkConfig } from '../types';
import { fetchDefaultIsraeliStations } from '../services/radioService';
import { saveCustomStations, resetStationsInFirestore, fetchAdmins, addAdmin, removeAdmin, saveNetworkConfig } from '../services/firebase';
import { ChevronDownIcon } from './Icons';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentStations: Station[];
  onStationsUpdate: (stations: Station[]) => void;
  currentUserEmail: string | null;
  favorites: string[];
}

type AdminSortType = 'default' | 'name_asc' | 'name_desc' | 'favorites';

interface DiagnosticResult {
    uuid: string;
    name: string;
    streamUrl: string;
    isSecure: boolean;
    directStream: boolean;
    streamType: string;
    metadataStatus: string;
}

const EditStationModal: React.FC<{
    station: Station;
    onSave: (updated: Station) => void;
    onCancel: () => void;
}> = ({ station, onSave, onCancel }) => {
    const [formData, setFormData] = useState<Station>({ ...station });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'bitrate' ? parseInt(value) || 0 : value
        }));
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
            <div className="bg-bg-secondary p-6 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
                <h3 className="text-xl font-bold mb-4">עריכת תחנה</h3>
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs text-text-secondary mb-1">שם התחנה</label>
                        <input name="name" value={formData.name} onChange={handleChange} className="w-full p-2 rounded bg-bg-primary border border-gray-700" />
                    </div>
                    <div>
                        <label className="block text-xs text-text-secondary mb-1">URL לשידור (Stream)</label>
                        <input name="url_resolved" value={formData.url_resolved} onChange={handleChange} className="w-full p-2 rounded bg-bg-primary border border-gray-700 text-left text-xs" dir="ltr" />
                    </div>
                    <div>
                        <label className="block text-xs text-text-secondary mb-1">לוגו (URL)</label>
                        <div className="flex gap-2">
                             <input name="favicon" value={formData.favicon} onChange={handleChange} className="w-full p-2 rounded bg-bg-primary border border-gray-700 text-left text-xs" dir="ltr" />
                             <img src={formData.favicon} alt="preview" className="w-8 h-8 rounded bg-gray-700 object-cover" onError={e => (e.target as HTMLImageElement).src=''} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs text-text-secondary mb-1">תגיות</label>
                        <input name="tags" value={formData.tags} onChange={handleChange} className="w-full p-2 rounded bg-bg-primary border border-gray-700" />
                    </div>
                     <div>
                        <label className="block text-xs text-text-secondary mb-1">UUID (מזהה ייחודי)</label>
                        <input name="stationuuid" value={formData.stationuuid} disabled className="w-full p-2 rounded bg-bg-primary border border-gray-700 opacity-50 cursor-not-allowed text-xs" />
                    </div>
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={onCancel} className="flex-1 py-2 bg-gray-600 rounded hover:bg-gray-500">ביטול</button>
                    <button onClick={() => onSave(formData)} className="flex-1 py-2 bg-accent text-white rounded hover:bg-accent-hover">שמור</button>
                </div>
            </div>
        </div>
    );
};

const AdminPanel: React.FC<AdminPanelProps> = ({ isOpen, onClose, currentStations, onStationsUpdate, currentUserEmail, favorites }) => {
    const [stations, setStations] = useState<Station[]>(currentStations);
    const [editingStation, setEditingStation] = useState<Station | null>(null);
    const [activeTab, setActiveTab] = useState<'stations' | 'admins' | 'diagnostics'>('stations');
    const [admins, setAdmins] = useState<string[]>([]);
    const [newAdminEmail, setNewAdminEmail] = useState('');
    const [statusMsg, setStatusMsg] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sortType, setSortType] = useState<AdminSortType>('default');
    
    // Diagnostics State
    const [diagnosticResults, setDiagnosticResults] = useState<DiagnosticResult[]>([]);
    const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
    const [configSaved, setConfigSaved] = useState(false);

    // Sync local state with prop when opening
    useEffect(() => {
        if (isOpen) {
            setStations(currentStations);
            fetchAdmins().then(setAdmins);
        }
    }, [isOpen, currentStations]);

    const handleSaveToCloud = async () => {
        setIsLoading(true);
        try {
            await saveCustomStations(stations);
            onStationsUpdate(stations); // Update App state
            setStatusMsg('נשמר בהצלחה בענן!');
            setTimeout(() => setStatusMsg(''), 3000);
        } catch (e) {
            console.error(e);
            setStatusMsg('שגיאה בשמירה.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetToDefaults = async () => {
        if (!confirm('פעולה זו תמחק את כל השינויים ותחזיר את רשימת התחנות לברירת המחדל של האפליקציה. להמשיך?')) return;
        setIsLoading(true);
        try {
            await resetStationsInFirestore();
            const defaults = await fetchDefaultIsraeliStations();
            setStations(defaults);
            onStationsUpdate(defaults);
            setStatusMsg('שוחזר לברירת מחדל.');
        } catch (e) {
             console.error(e);
             setStatusMsg('שגיאה בשחזור.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleStationSave = (updated: Station) => {
        const newStations = stations.map(s => s.stationuuid === updated.stationuuid ? updated : s);
        setStations(newStations);
        setEditingStation(null);
    };

    const handleDelete = (uuid: string) => {
        if (!confirm('למחוק את התחנה?')) return;
        setStations(prev => prev.filter(s => s.stationuuid !== uuid));
    };

    const handleAddStation = () => {
        const newStation: Station = {
            stationuuid: crypto.randomUUID(),
            name: 'תחנה חדשה',
            url_resolved: '',
            favicon: '',
            tags: '',
            countrycode: 'IL',
            codec: 'MP3',
            bitrate: 128
        };
        setStations([newStation, ...stations]);
        setEditingStation(newStation);
        setSortType('default'); // Reset sort so the new station is visible at top
    };
    
    const moveStation = (uuid: string, direction: -1 | 1) => {
        const index = stations.findIndex(s => s.stationuuid === uuid);
        if (index === -1) return;

        const newStations = [...stations];
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= newStations.length) return;
        
        [newStations[index], newStations[targetIndex]] = [newStations[targetIndex], newStations[index]];
        setStations(newStations);
    };

    const handleAddAdmin = async () => {
        if (!newAdminEmail) return;
        try {
            await addAdmin(newAdminEmail);
            setAdmins([...admins, newAdminEmail]);
            setNewAdminEmail('');
        } catch (e) {
            alert('שגיאה בהוספת מנהל');
        }
    };

    const handleRemoveAdmin = async (email: string) => {
        if (!confirm(`להסיר את ${email} מניהול?`)) return;
        try {
            await removeAdmin(email);
            setAdmins(admins.filter(a => a !== email));
        } catch (e) {
            alert('שגיאה בהסרת מנהל');
        }
    };

    const runDiagnostics = async () => {
        setIsRunningDiagnostics(true);
        setDiagnosticResults([]);
        setConfigSaved(false);
        
        const results: DiagnosticResult[] = [];
        
        for (const station of stations) {
            const result: DiagnosticResult = {
                uuid: station.stationuuid,
                name: station.name,
                streamUrl: station.url_resolved,
                isSecure: station.url_resolved.startsWith('https'),
                directStream: false,
                streamType: '?',
                metadataStatus: 'N/A'
            };

            // 1. Check Stream (Direct Connection)
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2500); 
                
                // Try HEAD first
                let response = await fetch(station.url_resolved, { 
                    method: 'HEAD', 
                    mode: 'cors',
                    signal: controller.signal
                }).catch(async () => {
                     // Retry with GET if HEAD fails
                     return await fetch(station.url_resolved, { 
                        method: 'GET', 
                        mode: 'cors',
                        signal: controller.signal,
                        headers: { 'Range': 'bytes=0-100' }
                    });
                });

                clearTimeout(timeoutId);

                if (response.ok) {
                    result.directStream = true;
                    const type = response.headers.get('content-type');
                    if (type?.includes('mpegurl') || station.url_resolved.includes('.m3u8')) {
                        result.streamType = 'HLS';
                    } else {
                        result.streamType = 'MP3';
                    }
                }
            } catch (e) {
                // Failed CORS direct
            }

            // 2. Check Metadata API
            let metaUrl = '';
            if (station.stationuuid.startsWith('100fm-')) {
                 const slug = station.stationuuid.replace('100fm-', '');
                 metaUrl = `https://digital.100fm.co.il/api/nowplaying/${slug}/12`;
            }

            if (metaUrl) {
                try {
                    const controller = new AbortController();
                    setTimeout(() => controller.abort(), 2500);
                    const res = await fetch(metaUrl, { mode: 'cors', signal: controller.signal });
                    if (res.ok) result.metadataStatus = 'OK';
                    else result.metadataStatus = `Err ${res.status}`;
                } catch (e) {
                    result.metadataStatus = 'CORS';
                }
            }

            results.push(result);
            setDiagnosticResults([...results]);
        }
        setIsRunningDiagnostics(false);
    };

    const generateAndSaveConfig = async () => {
        const config: NetworkConfig = {
            forceProxyStream: [],
            forceDirectStream: [],
            forceProxyMetadata: [],
            forceDirectMetadata: []
        };

        diagnosticResults.forEach(r => {
            // Stream Logic
            if (!r.isSecure) {
                // If stream is HTTP on HTTPS site, MUST use proxy
                config.forceProxyStream.push(r.uuid);
            } else if (r.directStream) {
                // If direct works and is secure, prefer direct
                config.forceDirectStream.push(r.uuid);
            }

            // Metadata Logic
            if (r.uuid.startsWith('100fm-')) {
                if (r.metadataStatus === 'OK') {
                    config.forceDirectMetadata.push(r.uuid);
                } else {
                    config.forceProxyMetadata.push('100fm-metadata'); // General flag
                }
            }
        });

        try {
            await saveNetworkConfig(config);
            setConfigSaved(true);
            alert('הגדרות הרשת נשמרו בהצלחה! משתמשים יקבלו את השיפורים בפתיחה הבאה.');
        } catch (e) {
            alert('שגיאה בשמירת הגדרות');
        }
    };

    // Sorting Logic for Display
    const getSortedStations = () => {
        const list = [...stations];
        switch (sortType) {
            case 'name_asc':
                return list.sort((a, b) => a.name.localeCompare(b.name, 'he'));
            case 'name_desc':
                return list.sort((a, b) => b.name.localeCompare(a.name, 'he'));
            case 'favorites':
                return list.sort((a, b) => {
                    const isAFav = favorites.includes(a.stationuuid) ? 1 : 0;
                    const isBFav = favorites.includes(b.stationuuid) ? 1 : 0;
                    return isBFav - isAFav; // Favorites first
                });
            default:
                return list;
        }
    };

    const displayStations = getSortedStations();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-bg-primary z-50 flex flex-col animate-fade-in-up overflow-hidden">
            {editingStation && (
                <EditStationModal 
                    station={editingStation} 
                    onSave={handleStationSave} 
                    onCancel={() => setEditingStation(null)} 
                />
            )}
            
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-bg-secondary shadow-md shrink-0">
                <h2 className="text-xl font-bold text-accent">פאנל ניהול</h2>
                <button onClick={onClose} className="p-2"><ChevronDownIcon className="w-6 h-6 rotate-180" /></button>
            </div>

            {/* Tabs */}
            <div className="flex bg-bg-secondary/50 p-2 gap-2 shrink-0">
                <button 
                    onClick={() => setActiveTab('stations')}
                    className={`flex-1 py-2 rounded text-sm font-bold ${activeTab === 'stations' ? 'bg-accent text-white' : 'hover:bg-gray-700'}`}
                >
                    תחנות ({stations.length})
                </button>
                <button 
                    onClick={() => setActiveTab('admins')}
                    className={`flex-1 py-2 rounded text-sm font-bold ${activeTab === 'admins' ? 'bg-accent text-white' : 'hover:bg-gray-700'}`}
                >
                    מנהלים
                </button>
                <button 
                    onClick={() => setActiveTab('diagnostics')}
                    className={`flex-1 py-2 rounded text-sm font-bold ${activeTab === 'diagnostics' ? 'bg-accent text-white' : 'hover:bg-gray-700'}`}
                >
                    🩺 דיאגנוסטיקה
                </button>
            </div>

            {/* Content */}
            <div className="flex-grow overflow-y-auto p-4">
                {activeTab === 'stations' && (
                    <>
                        <div className="flex flex-wrap gap-2 mb-4 sticky top-0 bg-bg-primary py-2 z-10 border-b border-gray-800 items-center">
                             <button onClick={handleSaveToCloud} disabled={isLoading} className="bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded font-bold shadow-lg text-sm flex-grow sm:flex-grow-0">
                                {isLoading ? 'שומר...' : 'שמור לענן'}
                            </button>
                            <button onClick={handleAddStation} className="bg-accent hover:bg-accent-hover text-white px-3 py-2 rounded shadow-lg text-sm flex-grow sm:flex-grow-0">
                                + הוסף
                            </button>
                            
                            <select 
                                value={sortType} 
                                onChange={(e) => setSortType(e.target.value as AdminSortType)}
                                className="bg-gray-700 text-white text-xs p-2 rounded border border-gray-600 outline-none flex-grow sm:flex-grow-0"
                            >
                                <option value="default">סדר שמור (ברירת מחדל)</option>
                                <option value="name_asc">שם (א-ת)</option>
                                <option value="name_desc">שם (ת-א)</option>
                                <option value="favorites">המועדפים שלי תחילה</option>
                            </select>

                            <button onClick={handleResetToDefaults} disabled={isLoading} className="bg-red-600/80 hover:bg-red-600 text-white px-2 py-1 rounded text-[10px] ml-auto">
                                איפוס
                            </button>
                        </div>
                        {statusMsg && <div className="p-2 mb-2 bg-blue-600 text-white text-center rounded animate-pulse">{statusMsg}</div>}
                        
                        <div className="space-y-2">
                            {displayStations.map((s, idx) => (
                                <div key={s.stationuuid} className="flex items-center gap-3 bg-bg-secondary p-2 rounded border border-gray-800 hover:border-accent/50 transition-colors">
                                    {sortType === 'default' && (
                                        <div className="flex flex-col gap-1">
                                            <button onClick={() => moveStation(s.stationuuid, -1)} disabled={stations.indexOf(s) === 0} className="text-gray-500 hover:text-white disabled:opacity-20 text-xs">▲</button>
                                            <button onClick={() => moveStation(s.stationuuid, 1)} disabled={stations.indexOf(s) === stations.length - 1} className="text-gray-500 hover:text-white disabled:opacity-20 text-xs">▼</button>
                                        </div>
                                    )}
                                    <img src={s.favicon} className="w-10 h-10 bg-black object-contain rounded" onError={e => (e.target as HTMLImageElement).src=''} />
                                    <div className="flex-grow min-w-0">
                                        <div className="font-bold truncate text-sm">{s.name}</div>
                                        <div className="text-[10px] text-text-secondary truncate text-left" dir="ltr">{s.url_resolved}</div>
                                    </div>
                                    <button onClick={() => setEditingStation(s)} className="p-2 text-blue-400 hover:bg-blue-400/20 rounded text-xs">ערוך</button>
                                    <button onClick={() => handleDelete(s.stationuuid)} className="p-2 text-red-400 hover:bg-red-400/20 rounded text-xs">מחק</button>
                                </div>
                            ))}
                        </div>
                    </>
                )}
                
                {activeTab === 'admins' && (
                    <div className="space-y-6">
                        <div className="bg-bg-secondary p-4 rounded-lg">
                            <h3 className="font-bold mb-3">הוספת מנהל חדש</h3>
                            <div className="flex gap-2">
                                <input 
                                    type="email" 
                                    placeholder="email@example.com" 
                                    className="flex-grow p-2 rounded bg-bg-primary border border-gray-700"
                                    value={newAdminEmail}
                                    onChange={e => setNewAdminEmail(e.target.value)}
                                />
                                <button onClick={handleAddAdmin} className="bg-accent px-4 rounded text-white font-bold">הוסף</button>
                            </div>
                            <p className="text-xs text-text-secondary mt-2">
                                שים לב: המייל חייב להיות תואם לחשבון גוגל שאיתו המשתמש מתחבר.
                            </p>
                        </div>

                        <div>
                            <h3 className="font-bold mb-3">רשימת מנהלים ({admins.length})</h3>
                            <div className="space-y-2">
                                {admins.map(email => (
                                    <div key={email} className="flex justify-between items-center bg-bg-secondary p-3 rounded">
                                        <span>{email}</span>
                                        {email !== currentUserEmail && (
                                            <button onClick={() => handleRemoveAdmin(email)} className="text-red-400 text-sm hover:underline">הסר</button>
                                        )}
                                        {email === currentUserEmail && <span className="text-xs text-accent">(אתה)</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'diagnostics' && (
                    <div className="space-y-4">
                        <div className="bg-bg-secondary p-4 rounded-lg">
                            <h3 className="font-bold mb-2">בדיקת תקינות מערכת (CORS & Streams)</h3>
                            <p className="text-xs text-text-secondary mb-4">
                                כלי זה סורק את כל התחנות ובודק חסימות CORS, HTTP/HTTPS וסוגי שידור.
                                בסיום הסריקה תוכל לשמור את ההגדרות האופטימליות לענן.
                            </p>
                            <div className="flex gap-2">
                                <button 
                                    onClick={runDiagnostics} 
                                    disabled={isRunningDiagnostics}
                                    className={`flex-1 py-3 rounded font-bold shadow-lg ${isRunningDiagnostics ? 'bg-gray-600' : 'bg-blue-600 hover:bg-blue-500'} text-white transition-all`}
                                >
                                    {isRunningDiagnostics ? 'מבצע סריקה...' : '🚀 הרץ בדיקה'}
                                </button>
                                {diagnosticResults.length > 0 && !isRunningDiagnostics && (
                                    <button 
                                        onClick={generateAndSaveConfig}
                                        className={`flex-1 py-3 rounded font-bold shadow-lg ${configSaved ? 'bg-green-600' : 'bg-accent hover:bg-accent-hover'} text-white transition-all`}
                                    >
                                        {configSaved ? '✅ נשמר!' : '💾 שמור הגדרות רשת לענן'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {diagnosticResults.length > 0 && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs text-right bg-bg-secondary rounded-lg overflow-hidden">
                                    <thead className="bg-gray-800 text-text-secondary">
                                        <tr>
                                            <th className="p-2">תחנה</th>
                                            <th className="p-2">HTTPS</th>
                                            <th className="p-2">גישה ישירה</th>
                                            <th className="p-2">סוג</th>
                                            <th className="p-2">Metadata</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700">
                                        {diagnosticResults.map((r) => (
                                            <tr key={r.uuid} className="hover:bg-gray-700/50">
                                                <td className="p-2 font-bold">{r.name}</td>
                                                <td className="p-2">{r.isSecure ? '✅' : '❌ HTTP'}</td>
                                                <td className={`p-2 ${r.directStream ? 'text-green-400' : 'text-red-400'}`}>
                                                    {r.directStream ? 'כן' : 'לא'}
                                                </td>
                                                <td className="p-2">{r.streamType}</td>
                                                <td className={`p-2 ${r.metadataStatus === 'OK' ? 'text-green-400' : r.metadataStatus === 'N/A' ? 'text-gray-500' : 'text-red-400'}`}>
                                                    {r.metadataStatus}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminPanel;
