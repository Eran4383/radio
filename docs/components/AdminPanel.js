
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

const AdminPanel = ({ isOpen, onClose, currentStations, onStationsUpdate, currentUserEmail }) => {
    const [stations, setStations] = useState(currentStations);
    const [editingStation, setEditingStation] = useState(null);
    const [activeTab, setActiveTab] = useState('stations');
    const [admins, setAdmins] = useState([]);
    const [newAdminEmail, setNewAdminEmail] = useState('');
    const [statusMsg, setStatusMsg] = useState('');
    const [isLoading, setIsLoading] = useState(false);

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
    };
    
    const moveStation = (index, direction) => {
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
            
            /* Header */
            React.createElement("div", { className: "flex items-center justify-between p-4 bg-bg-secondary shadow-md shrink-0" },
                React.createElement("h2", { className: "text-xl font-bold text-accent" }, "פאנל ניהול"),
                React.createElement("button", { onClick: onClose, className: "p-2" }, React.createElement(ChevronDownIcon, { className: "w-6 h-6 rotate-180" }))
            ),

            /* Tabs */
            React.createElement("div", { className: "flex bg-bg-secondary/50 p-2 gap-2 shrink-0" },
                React.createElement("button", { 
                    onClick: () => setActiveTab('stations'),
                    className: `flex-1 py-2 rounded ${activeTab === 'stations' ? 'bg-accent text-white' : 'hover:bg-gray-700'}`
                },
                    `ניהול תחנות (${stations.length})`
                ),
                React.createElement("button", { 
                    onClick: () => setActiveTab('admins'),
                    className: `flex-1 py-2 rounded ${activeTab === 'admins' ? 'bg-accent text-white' : 'hover:bg-gray-700'}`
                },
                    "ניהול מנהלים"
                )
            ),

            /* Content */
            React.createElement("div", { className: "flex-grow overflow-y-auto p-4" },
                activeTab === 'stations' ? (
                    React.createElement(React.Fragment, null,
                        React.createElement("div", { className: "flex flex-wrap gap-2 mb-4 sticky top-0 bg-bg-primary py-2 z-10 border-b border-gray-800" },
                             React.createElement("button", { onClick: handleSaveToCloud, disabled: isLoading, className: "bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded font-bold shadow-lg" },
                                isLoading ? 'שומר...' : 'שמור שינויים לענן'
                            ),
                            React.createElement("button", { onClick: handleAddStation, className: "bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded shadow-lg" },
                                "+ הוסף תחנה"
                            ),
                            React.createElement("button", { onClick: handleResetToDefaults, disabled: isLoading, className: "bg-red-600/80 hover:bg-red-600 text-white px-4 py-2 rounded text-xs ml-auto" },
                                "שחזר לברירת מחדל"
                            )
                        ),
                        statusMsg && React.createElement("div", { className: "p-2 mb-2 bg-blue-600 text-white text-center rounded animate-pulse" }, statusMsg),
                        
                        React.createElement("div", { className: "space-y-2" },
                            stations.map((s, idx) => (
                                React.createElement("div", { key: s.stationuuid, className: "flex items-center gap-3 bg-bg-secondary p-2 rounded border border-gray-800 hover:border-accent/50 transition-colors" },
                                    React.createElement("div", { className: "flex flex-col gap-1" },
                                        React.createElement("button", { onClick: () => moveStation(idx, -1), disabled: idx === 0, className: "text-gray-500 hover:text-white disabled:opacity-20" }, "▲"),
                                        React.createElement("button", { onClick: () => moveStation(idx, 1), disabled: idx === stations.length - 1, className: "text-gray-500 hover:text-white disabled:opacity-20" }, "▼")
                                    ),
                                    React.createElement("img", { src: s.favicon, className: "w-10 h-10 bg-black object-contain rounded", onError: e => (e.target).src='' }),
                                    React.createElement("div", { className: "flex-grow min-w-0" },
                                        React.createElement("div", { className: "font-bold truncate" }, s.name),
                                        React.createElement("div", { className: "text-xs text-text-secondary truncate text-left", dir: "ltr" }, s.url_resolved)
                                    ),
                                    React.createElement("button", { onClick: () => setEditingStation(s), className: "p-2 text-blue-400 hover:bg-blue-400/20 rounded" }, "ערוך"),
                                    React.createElement("button", { onClick: () => handleDelete(s.stationuuid), className: "p-2 text-red-400 hover:bg-red-400/20 rounded" }, "מחק")
                                )
                            ))
                        )
                    )
                ) : (
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
                )
            )
        )
    );
};

export default AdminPanel;
