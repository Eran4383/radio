
import React, { useState, useEffect } from 'react';
import { fetchDefaultIsraeliStations } from '../services/radioService.js';
import { saveCustomStations, resetStationsInFirestore, fetchAdmins, addAdmin, removeAdmin } from '../services/firebase.js';
import { ChevronDownIcon } from './Icons.js';

const EditStationModal = ({ station, onSave, onCancel }) => {
    const [formData, setFormData] = useState({ ...station });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'bitrate' ? parseInt(value) || 0 : value
        }));
    };

    return (
        React.createElement("div", { className: "fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4" },
            React.createElement("div", { className: "bg-bg-secondary p-6 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto" },
                React.createElement("h3", { className: "text-xl font-bold mb-4" }, "עריכת תחנה"),
                React.createElement("div", { className: "space-y-3" },
                    React.createElement("div", null,
                        React.createElement("label", { className: "block text-xs text-text-secondary mb-1" }, "שם התחנה"),
                        React.createElement("input", { name: "name", value: formData.name, onChange: handleChange, className: "w-full p-2 rounded bg-bg-primary border border-gray-700" })
                    ),
                    React.createElement("div", null,
                        React.createElement("label", { className: "block text-xs text-text-secondary mb-1" }, "URL לשידור (Stream)"),
                        React.createElement("input", { name: "url_resolved", value: formData.url_resolved, onChange: handleChange, className: "w-full p-2 rounded bg-bg-primary border border-gray-700 text-left text-xs", dir: "ltr" })
                    ),
                    React.createElement("div", null,
                        React.createElement("label", { className: "block text-xs text-text-secondary mb-1" }, "לוגו (URL)"),
                        React.createElement("div", { className: "flex gap-2" },
                             React.createElement("input", { name: "favicon", value: formData.favicon, onChange: handleChange, className: "w-full p-2 rounded bg-bg-primary border border-gray-700 text-left text-xs", dir: "ltr" }),
                             React.createElement("img", { src: formData.favicon, alt: "preview", className: "w-8 h-8 rounded bg-gray-700 object-cover", onError: e => (e.target).src='' })
                        )
                    ),
                    React.createElement("div", null,
                        React.createElement("label", { className: "block text-xs text-text-secondary mb-1" }, "תגיות"),
                        React.createElement("input", { name: "tags", value: formData.tags, onChange: handleChange, className: "w-full p-2 rounded bg-bg-primary border border-gray-700" })
                    ),
                     React.createElement("div", null,
                        React.createElement("label", { className: "block text-xs text-text-secondary mb-1" }, "UUID (מזהה ייחודי)"),
                        React.createElement("input", { name: "stationuuid", value: formData.stationuuid, disabled: true, className: "w-full p-2 rounded bg-bg-primary border border-gray-700 opacity-50 cursor-not-allowed text-xs" })
                    )
                ),
                React.createElement("div", { className: "flex gap-3 mt-6" },
                    React.createElement("button", { onClick: onCancel, className: "flex-1 py-2 bg-gray-600 rounded hover:bg-gray-500" }, "ביטול"),
                    React.createElement("button", { onClick: () => onSave(formData), className: "flex-1 py-2 bg-accent text-white rounded hover:bg-accent-hover" }, "שמור")
                )
            )
        )
    );
};

const AdminPanel = ({ isOpen, onClose, currentStations, onStationsUpdate, currentUserEmail, favorites }) => {
    const [stations, setStations] = useState(currentStations);
    const [editingStation, setEditingStation] = useState(null);
    const [activeTab, setActiveTab] = useState('stations');
    const [admins, setAdmins] = useState([]);
    const [newAdminEmail, setNewAdminEmail] = useState('');
    const [statusMsg, setStatusMsg] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sortType, setSortType] = useState('default');
    
    // Diagnostics State
    const [diagnosticResults, setDiagnosticResults] = useState([]);
    const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);

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
            onStationsUpdate(stations); 
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

    const handleStationSave = (updated) => {
        const newStations = stations.map(s => s.stationuuid === updated.stationuuid ? updated : s);
        setStations(newStations);
        setEditingStation(null);
    };

    const handleDelete = (uuid) => {
        if (!confirm('למחוק את התחנה?')) return;
        setStations(prev => prev.filter(s => s.stationuuid !== uuid));
    };

    const handleAddStation = () => {
        const newStation = {
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
        setSortType('default');
    };
    
    const moveStation = (uuid, direction) => {
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

    const handleRemoveAdmin = async (email) => {
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
        
        const results = [];
        
        for (const station of stations) {
            const result = {
                uuid: station.stationuuid,
                name: station.name,
                streamStatus: 'בודק...',
                streamType: '?',
                metadataStatus: 'N/A',
                latency: 0
            };

            const start = Date.now();

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000); 
                
                let response = await fetch(station.url_resolved, { 
                    method: 'HEAD', 
                    mode: 'cors',
                    signal: controller.signal
                }).catch(async () => {
                     return await fetch(station.url_resolved, { 
                        method: 'GET', 
                        mode: 'cors',
                        signal: controller.signal,
                        headers: { 'Range': 'bytes=0-100' }
                    });
                });

                clearTimeout(timeoutId);
                result.latency = Date.now() - start;

                if (response.ok) {
                    result.streamStatus = '✅ תקין (ישיר)';
                    const type = response.headers.get('content-type');
                    if (type?.includes('mpegurl') || station.url_resolved.includes('.m3u8')) {
                        result.streamType = 'HLS (m3u8)';
                    } else if (type?.includes('mpeg') || type?.includes('audio')) {
                        result.streamType = 'MP3/AAC';
                    } else {
                        result.streamType = 'Unknown';
                    }
                } else {
                    result.streamStatus = `⚠️ שגיאה ${response.status}`;
                }
            } catch (e) {
                result.streamStatus = '❌ חסום (CORS)';
            }

            let metaUrl = '';
            if (station.stationuuid.startsWith('100fm-')) {
                 const slug = station.stationuuid.replace('100fm-', '');
                 metaUrl = `https://digital.100fm.co.il/api/nowplaying/${slug}/12`;
            } else if (station.name.includes('גלגלצ')) {
                 metaUrl = 'https://glz.co.il/umbraco/api/player/UpdatePlayer?stationid=glglz';
            } else if (station.name.includes('כאן')) {
                 metaUrl = 'https://www.kan.org.il/radio/live-info-v2.aspx?stationId=954';
            } else if (station.name.toLowerCase().includes('eco99')) {
                 metaUrl = 'https://firestore.googleapis.com/v1/projects/eco-99-production/databases/(default)/documents/streamed_content/program';
            }

            if (metaUrl) {
                try {
                    const controller = new AbortController();
                    setTimeout(() => controller.abort(), 3000);
                    const res = await fetch(metaUrl, { mode: 'cors', signal: controller.signal });
                    if (res.ok) result.metadataStatus = '✅ תקין (ישיר)';
                    else result.metadataStatus = `⚠️ שגיאה ${res.status}`;
                } catch (e) {
                    result.metadataStatus = '❌ חסום (CORS)';
                }
            }

            results.push(result);
            setDiagnosticResults([...results]); 
        }
        setIsRunningDiagnostics(false);
    };

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
                    return isBFav - isAFav; 
                });
            default:
                return list;
        }
    };

    const displayStations = getSortedStations();

    if (!isOpen) return null;

    return (
        React.createElement("div", { className: "fixed inset-0 bg-bg-primary z-50 flex flex-col animate-fade-in-up overflow-hidden" },
            editingStation && (
                React.createElement(EditStationModal, { 
                    station: editingStation, 
                    onSave: handleStationSave, 
                    onCancel: () => setEditingStation(null) 
                })
            ),
            
            React.createElement("div", { className: "flex items-center justify-between p-4 bg-bg-secondary shadow-md shrink-0" },
                React.createElement("h2", { className: "text-xl font-bold text-accent" }, "פאנל ניהול"),
                React.createElement("button", { onClick: onClose, className: "p-2" }, React.createElement(ChevronDownIcon, { className: "w-6 h-6 rotate-180" }))
            ),

            React.createElement("div", { className: "flex bg-bg-secondary/50 p-2 gap-2 shrink-0" },
                React.createElement("button", { 
                    onClick: () => setActiveTab('stations'),
                    className: `flex-1 py-2 rounded text-sm font-bold ${activeTab === 'stations' ? 'bg-accent text-white' : 'hover:bg-gray-700'}`
                },
                    `תחנות (${stations.length})`
                ),
                React.createElement("button", { 
                    onClick: () => setActiveTab('admins'),
                    className: `flex-1 py-2 rounded text-sm font-bold ${activeTab === 'admins' ? 'bg-accent text-white' : 'hover:bg-gray-700'}`
                },
                    "מנהלים"
                ),
                React.createElement("button", { 
                    onClick: () => setActiveTab('diagnostics'),
                    className: `flex-1 py-2 rounded text-sm font-bold ${activeTab === 'diagnostics' ? 'bg-accent text-white' : 'hover:bg-gray-700'}`
                },
                    "דיאגנוסטיקה"
                )
            ),

            React.createElement("div", { className: "flex-grow overflow-y-auto p-4" },
                activeTab === 'stations' && (
                    React.createElement(React.Fragment, null,
                        React.createElement("div", { className: "flex flex-wrap gap-2 mb-4 sticky top-0 bg-bg-primary py-2 z-10 border-b border-gray-800 items-center" },
                             React.createElement("button", { onClick: handleSaveToCloud, disabled: isLoading, className: "bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded font-bold shadow-lg text-sm flex-grow sm:flex-grow-0" },
                                isLoading ? 'שומר...' : 'שמור לענן'
                            ),
                            React.createElement("button", { onClick: handleAddStation, className: "bg-accent hover:bg-accent-hover text-white px-3 py-2 rounded shadow-lg text-sm flex-grow sm:flex-grow-0" },
                                "+ הוסף"
                            ),
                            
                            React.createElement("select", {
                                value: sortType,
                                onChange: (e) => setSortType(e.target.value),
                                className: "bg-gray-700 text-white text-xs p-2 rounded border border-gray-600 outline-none flex-grow sm:flex-grow-0"
                            },
                                React.createElement("option", { value: "default" }, "סדר שמור (ברירת מחדל)"),
                                React.createElement("option", { value: "name_asc" }, "שם (א-ת)"),
                                React.createElement("option", { value: "name_desc" }, "שם (ת-א)"),
                                React.createElement("option", { value: "favorites" }, "המועדפים שלי תחילה")
                            ),

                            React.createElement("button", { onClick: handleResetToDefaults, disabled: isLoading, className: "bg-red-600/80 hover:bg-red-600 text-white px-2 py-1 rounded text-[10px] ml-auto" },
                                "איפוס"
                            )
                        ),
                        statusMsg && React.createElement("div", { className: "p-2 mb-2 bg-blue-600 text-white text-center rounded animate-pulse" }, statusMsg),
                        
                        React.createElement("div", { className: "space-y-2" },
                            displayStations.map((s, idx) => (
                                React.createElement("div", { key: s.stationuuid, className: "flex items-center gap-3 bg-bg-secondary p-2 rounded border border-gray-800 hover:border-accent/50 transition-colors" },
                                    sortType === 'default' && (
                                        React.createElement("div", { className: "flex flex-col gap-1" },
                                            React.createElement("button", { onClick: () => moveStation(s.stationuuid, -1), disabled: stations.indexOf(s) === 0, className: "text-gray-500 hover:text-white disabled:opacity-20 text-xs" }, "▲"),
                                            React.createElement("button", { onClick: () => moveStation(s.stationuuid, 1), disabled: stations.indexOf(s) === stations.length - 1, className: "text-gray-500 hover:text-white disabled:opacity-20 text-xs" }, "▼")
                                        )
                                    ),
                                    React.createElement("img", { src: s.favicon, className: "w-10 h-10 bg-black object-contain rounded", onError: e => (e.target).src='' }),
                                    React.createElement("div", { className: "flex-grow min-w-0" },
                                        React.createElement("div", { className: "font-bold truncate text-sm" }, s.name),
                                        React.createElement("div", { className: "text-[10px] text-text-secondary truncate text-left", dir: "ltr" }, s.url_resolved)
                                    ),
                                    React.createElement("button", { onClick: () => setEditingStation(s), className: "p-2 text-blue-400 hover:bg-blue-400/20 rounded text-xs" }, "ערוך"),
                                    React.createElement("button", { onClick: () => handleDelete(s.stationuuid), className: "p-2 text-red-400 hover:bg-red-400/20 rounded text-xs" }, "מחק")
                                )
                            ))
                        )
                    )
                ),
                
                activeTab === 'admins' && (
                    React.createElement("div", { className: "space-y-6" },
                        React.createElement("div", { className: "bg-bg-secondary p-4 rounded-lg" },
                            React.createElement("h3", { className: "font-bold mb-3" }, "הוספת מנהל חדש"),
                            React.createElement("div", { className: "flex gap-2" },
                                React.createElement("input", { 
                                    type: "email", 
                                    placeholder: "email@example.com", 
                                    className: "flex-grow p-2 rounded bg-bg-primary border border-gray-700",
                                    value: newAdminEmail,
                                    onChange: e => setNewAdminEmail(e.target.value)
                                }),
                                React.createElement("button", { onClick: handleAddAdmin, className: "bg-accent px-4 rounded text-white font-bold" }, "הוסף")
                            ),
                            React.createElement("p", { className: "text-xs text-text-secondary mt-2" },
                                "שים לב: המייל חייב להיות תואם לחשבון גוגל שאיתו המשתמש מתחבר."
                            )
                        ),

                        React.createElement("div", null,
                            React.createElement("h3", { className: "font-bold mb-3" }, `רשימת מנהלים (${admins.length})`),
                            React.createElement("div", { className: "space-y-2" },
                                admins.map(email => (
                                    React.createElement("div", { key: email, className: "flex justify-between items-center bg-bg-secondary p-3 rounded" },
                                        React.createElement("span", null, email),
                                        email !== currentUserEmail && (
                                            React.createElement("button", { onClick: () => handleRemoveAdmin(email), className: "text-red-400 text-sm hover:underline" }, "הסר")
                                        ),
                                        email === currentUserEmail && React.createElement("span", { className: "text-xs text-accent" }, "(אתה)")
                                    )
                                ))
                            )
                        )
                    )
                ),

                activeTab === 'diagnostics' && (
                    React.createElement("div", { className: "space-y-4" },
                        React.createElement("div", { className: "bg-bg-secondary p-4 rounded-lg" },
                            React.createElement("h3", { className: "font-bold mb-2" }, "בדיקת תקינות מערכת (CORS & Streams)"),
                            React.createElement("p", { className: "text-xs text-text-secondary mb-4" },
                                "כלי זה בודק אילו תחנות ניתנות לגישה ישירה (Direct Access) ללא צורך בפרוקסי, ומזהה את סוג השידור לטיפול מתאים במחשב/מובייל."
                            ),
                            React.createElement("button", { 
                                onClick: runDiagnostics, 
                                disabled: isRunningDiagnostics,
                                className: `w-full py-3 rounded font-bold shadow-lg ${isRunningDiagnostics ? 'bg-gray-600' : 'bg-blue-600 hover:bg-blue-500'} text-white transition-all`
                            },
                                isRunningDiagnostics ? 'מבצע סריקה...' : '🚀 הרץ בדיקה מלאה'
                            )
                        ),

                        diagnosticResults.length > 0 && (
                            React.createElement("div", { className: "overflow-x-auto" },
                                React.createElement("table", { className: "w-full text-xs text-right bg-bg-secondary rounded-lg overflow-hidden" },
                                    React.createElement("thead", { className: "bg-gray-800 text-text-secondary" },
                                        React.createElement("tr", null,
                                            React.createElement("th", { className: "p-2" }, "תחנה"),
                                            React.createElement("th", { className: "p-2" }, "חיבור שידור (Direct)"),
                                            React.createElement("th", { className: "p-2" }, "סוג"),
                                            React.createElement("th", { className: "p-2" }, "Metadata API"),
                                            React.createElement("th", { className: "p-2" }, "תגובה (ms)")
                                        )
                                    ),
                                    React.createElement("tbody", { className: "divide-y divide-gray-700" },
                                        diagnosticResults.map((r) => (
                                            React.createElement("tr", { key: r.uuid, className: "hover:bg-gray-700/50" },
                                                React.createElement("td", { className: "p-2 font-bold" }, r.name),
                                                React.createElement("td", { className: `p-2 ${r.streamStatus.includes('✅') ? 'text-green-400' : 'text-red-400'}` },
                                                    r.streamStatus
                                                ),
                                                React.createElement("td", { className: "p-2" }, r.streamType),
                                                React.createElement("td", { className: `p-2 ${r.metadataStatus.includes('✅') ? 'text-green-400' : r.metadataStatus === 'N/A' ? 'text-gray-500' : 'text-red-400'}` },
                                                    r.metadataStatus
                                                ),
                                                React.createElement("td", { className: "p-2 text-text-secondary" }, `${r.latency}ms`)
                                            )
                                        ))
                                    )
                                )
                            )
                        )
                    )
                )
            )
        )
    );
};

export default AdminPanel;
