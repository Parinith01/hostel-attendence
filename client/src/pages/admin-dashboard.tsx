import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Users, LogOut, CheckCircle, XCircle, AlertTriangle, CalendarDays, Clock, Download, Settings as SettingsIcon, Save, Eye, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Student = {
    id: string;
    userId: string;
    fullName: string;
    phoneNumber: string;
    roomNumber: string;
    hostelBlock: string;
};

type Attendance = {
    id: string;
    userId: string;
    date: string;
    mealType: string;
    timestamp: string;
    verifiedByAdmin: boolean;
    status: 'present' | 'absent';
    absentReason: string | null;
};

type DashboardData = {
    date: string;
    students: Student[];
    attendances: Attendance[];
};

type SettingsData = {
    breakfastStart: string;
    breakfastEnd: string;
    dinnerStart: string;
    dinnerEnd: string;
};

export default function AdminDashboard() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [settings, setSettings] = useState<SettingsData>({ breakfastStart: '06:00', breakfastEnd: '09:00', dinnerStart: '18:00', dinnerEnd: '22:00' });
    const [loading, setLoading] = useState(true);
    const [savingSettings, setSavingSettings] = useState(false);
    const [showStudentsModal, setShowStudentsModal] = useState(false);
    const { toast } = useToast();

    const fetchDashboard = async () => {
        try {
            const [dashRes, setRes] = await Promise.all([
                fetch("/api/admin/dashboard"),
                fetch("/api/settings")
            ]);

            const dashJson = await dashRes.json();
            const setJson = await setRes.json();

            setData(dashJson);
            setSettings(setJson);
        } catch (e: any) {
            console.error("Dashboard fetch error:", e);
            toast({
                title: "Error fetching data",
                description: `Failed to load: ${e.message}`,
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboard();
    }, []);

    const handleSaveSettings = async () => {
        setSavingSettings(true);
        try {
            const res = await fetch("/api/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings)
            });
            if (res.ok) {
                toast({
                    title: "Settings Saved",
                    description: "Time slots successfully updated.",
                    className: "bg-green-500 text-white border-green-400 glow-cyan",
                });
            } else {
                throw new Error("Failed");
            }
        } catch (e) {
            toast({
                title: "Error",
                description: "Failed to save settings.",
                variant: "destructive"
            });
        } finally {
            setSavingSettings(false);
        }
    };

    const handleVerifyParams = async (id: string, currentlyVerified: boolean) => {
        try {
            const res = await fetch("/api/admin/verify-attendance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, verifiedByAdmin: !currentlyVerified })
            });
            if (res.ok) {
                setData(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        attendances: prev.attendances.map(a => a.id === id ? { ...a, verifiedByAdmin: !currentlyVerified } : a)
                    };
                });
                toast({
                    title: !currentlyVerified ? "Attendance Verified" : "Verification Removed",
                    className: "bg-primary text-primary-foreground border-primary glow-magenta",
                });
            }
        } catch (e) {
            console.error(e);
        }
    };

    const downloadMealPDF = (mealType: 'breakfast' | 'dinner') => {
        if (!data) return;
        const doc = new jsPDF();
        const mealName = mealType === 'breakfast' ? 'Breakfast' : 'Dinner';
        doc.text(`Hostel ${mealName} Attendance Report - ${data.date}`, 14, 15);

        const rowData = data.students.map((student, index) => {
            const mark = data.attendances.find(a => a.userId === student.userId && a.mealType === mealType);
            let text = "Not Voted";
            let style = { fillColor: [239, 68, 68] as [number, number, number], textColor: [255, 255, 255] as [number, number, number] };

            if (mark) {
                if (mark.status === "absent") {
                    text = `Absent - Reason: ${mark.absentReason}`;
                    style = { fillColor: [234, 179, 8] as [number, number, number], textColor: [0, 0, 0] as [number, number, number] };
                } else {
                    text = mark.verifiedByAdmin ? 'Present (Verified)' : 'Present (Pending)';
                    style = { fillColor: [34, 197, 94] as [number, number, number], textColor: [255, 255, 255] as [number, number, number] };
                }
            }

            return [
                index + 1,
                student.fullName,
                student.roomNumber,
                { content: text, styles: style }
            ];
        });

        autoTable(doc, {
            head: [['S.No', 'Student Name', 'Room No', 'Status']],
            body: rowData,
            startY: 25,
            theme: 'grid',
            headStyles: { fillColor: mealType === 'breakfast' ? [6, 182, 212] : [236, 72, 153] }
        });

        doc.save(`${mealName}_Attendance_${data.date}.pdf`);
    };

    const sendWarning = (student: Student) => {
        toast({
            title: "Warning Sent",
            description: `Disciplinary warning has been sent to ${student.fullName} (${student.userId}).`,
            variant: "destructive",
        });
    };

    const renderMarkBadge = (mark: Attendance | undefined) => {
        if (!mark) {
            return (
                <div className="flex flex-col items-center">
                    <XCircle className="w-5 h-5 text-red-500/50 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                    <span className="text-[10px] mt-1 text-red-400 font-bold uppercase tracking-wider">Not Voted</span>
                </div>
            );
        }

        if (mark.status === 'absent') {
            return (
                <div className="inline-flex flex-col items-center gap-1 p-2 rounded-xl bg-yellow-500/20 border border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.2)]">
                    <AlertTriangle className="w-5 h-5 text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]" />
                    <span className="text-[10px] text-yellow-400 font-bold uppercase tracking-widest">ABSENT</span>
                    <span className="text-[10px] text-yellow-200/70 max-w-[100px] truncate" title={mark.absentReason || ""}>
                        {mark.absentReason}
                    </span>
                </div>
            );
        }

        return (
            <button
                onClick={() => handleVerifyParams(mark.id, !!mark.verifiedByAdmin)}
                className={`inline-flex flex-col items-center gap-1 p-2 rounded-xl border transition-all cursor-pointer ${mark.verifiedByAdmin ? 'bg-green-500/20 border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'bg-white/5 border-white/10 hover:border-cyan-400/50'}`}
            >
                <CheckCircle className={`w-5 h-5 ${mark.verifiedByAdmin ? 'text-green-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]'}`} />
                <span className={`text-[10px] flex items-center gap-1 tracking-widest ${mark.verifiedByAdmin ? 'text-green-400 font-bold' : 'text-muted-foreground'}`}>
                    {mark.verifiedByAdmin ? 'VERIFIED' : 'PENDING'}
                </span>
                <span className="text-[10px] text-muted-foreground/50">
                    {new Date(mark.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            </button>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="w-10 h-10 border-4 border-magenta-500/30 border-t-magenta-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!data) return null;

    const { students, attendances, date } = data;

    const totalStudents = students.length;
    const breakfastPresent = attendances.filter(a => a.mealType === "breakfast" && a.status === "present").length;
    const dinnerPresent = attendances.filter(a => a.mealType === "dinner" && a.status === "present").length;

    return (
        <div className="min-h-screen p-3 sm:p-6 lg:p-8 relative">
            {/* Background Orbs */}
            <div className="bg-orb orb-1 fixed"></div>
            <div className="bg-orb orb-2 fixed"></div>
            <div className="bg-orb orb-3 fixed"></div>

            {/* Students Modal */}
            {showStudentsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="glass-card w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-white/20 overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <div>
                                <h2 className="font-display tracking-widest text-xl font-bold text-white uppercase">Registered Students List</h2>
                                <p className="text-sm text-muted-foreground mt-1">Total Active Directory: {totalStudents} Students</p>
                            </div>
                            <button onClick={() => setShowStudentsModal(false)} className="p-2 rounded-full hover:bg-white/10 text-muted-foreground hover:text-white transition">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="overflow-auto p-0 flex-1">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-white/5 sticky top-0 backdrop-blur-md">
                                    <tr className="border-b border-white/10 text-muted-foreground/80 text-sm font-display tracking-wider">
                                        <th className="p-4 font-normal w-12 text-center">#</th>
                                        <th className="p-4 font-normal">Full Name</th>
                                        <th className="p-4 font-normal">User ID</th>
                                        <th className="p-4 font-normal">Phone Number</th>
                                        <th className="p-4 font-normal">Room Number</th>
                                        <th className="p-4 font-normal">Hostel Block</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {students.map((s, index) => (
                                        <tr key={s.id} className="hover:bg-white/5 transition-colors">
                                            <td className="p-4 text-muted-foreground font-mono text-center">{index + 1}</td>
                                            <td className="p-4 text-white font-medium">{s.fullName}</td>
                                            <td className="p-4 text-cyan-400">{s.userId}</td>
                                            <td className="p-4 text-white/80">{s.phoneNumber}</td>
                                            <td className="p-4 text-magenta-300 font-medium">{s.roomNumber}</td>
                                            <td className="p-4 text-white/80">{s.hostelBlock}</td>
                                        </tr>
                                    ))}
                                    {students.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-muted-foreground">No students registered yet.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-6xl mx-auto relative z-10 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">

                {/* Header */}
                <div className="glass-card p-4 sm:p-6 rounded-2xl flex flex-col gap-4 border border-magenta-500/20 shadow-[0_0_30px_rgba(236,72,153,0.1)]">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-magenta-500/10 text-magenta-500 flex items-center justify-center shadow-[0_0_15px_rgba(236,72,153,0.4)] border border-magenta-500/20">
                                <Users className="w-5 h-5 sm:w-6 sm:h-6" />
                            </div>
                            <div>
                                <h1 className="font-display text-xl sm:text-2xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-magenta-400 to-purple-500 drop-shadow-[0_0_8px_rgba(236,72,153,0.5)]">
                                    Admin Dashboard
                                </h1>
                                <p className="font-display text-magenta-400/80 uppercase tracking-widest text-xs font-semibold mt-0.5 flex gap-2 items-center">
                                    <CalendarDays className="w-3 h-3" /> {date}
                                </p>
                            </div>
                        </div>
                        <Link href="/">
                            <span onClick={() => localStorage.removeItem('user')} className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-colors cursor-pointer text-red-400 hover:text-red-300 flex items-center justify-center group shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                                <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                            </span>
                        </Link>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => setShowStudentsModal(true)} className="flex-1 min-w-[120px] px-3 py-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 hover:text-white flex items-center justify-center transition-colors shadow-[0_0_10px_rgba(6,182,212,0.2)] hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] group text-xs font-display tracking-widest">
                            <Eye className="w-4 h-4 mr-1.5" /> VIEW STUDENTS
                        </button>
                        <button onClick={() => downloadMealPDF('breakfast')} className="flex-1 min-w-[120px] px-3 py-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 hover:text-white flex items-center justify-center transition-colors shadow-[0_0_10px_rgba(6,182,212,0.2)] hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] group text-xs font-display tracking-widest">
                            <Download className="w-4 h-4 mr-1.5 group-hover:-translate-y-1 transition-transform" /> BREAKFAST PDF
                        </button>
                        <button onClick={() => downloadMealPDF('dinner')} className="flex-1 min-w-[120px] px-3 py-2.5 rounded-xl bg-magenta-500/10 hover:bg-magenta-500/20 border border-magenta-500/30 text-magenta-400 hover:text-white flex items-center justify-center transition-colors shadow-[0_0_10px_rgba(236,72,153,0.2)] hover:shadow-[0_0_20px_rgba(236,72,153,0.4)] group text-xs font-display tracking-widest">
                            <Download className="w-4 h-4 mr-1.5 group-hover:-translate-y-1 transition-transform" /> DINNER PDF
                        </button>
                    </div>
                </div>

                {/* Settings Editor */}
                <div className="glass-card p-6 rounded-2xl border border-white/10 gap-2">
                    <h2 className="font-display tracking-widest text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <SettingsIcon className="w-5 h-5 text-cyan-400" /> TIME SLOT CONFIGURATION
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label className="text-xs text-muted-foreground font-display tracking-widest mb-1 block">BREAKFAST START</label>
                            <input type="time" value={settings.breakfastStart} onChange={(e) => setSettings({ ...settings, breakfastStart: e.target.value })} className="glass-input w-full p-3 rounded-xl text-white outline-none focus:glow-cyan border border-white/10" />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground font-display tracking-widest mb-1 block">BREAKFAST END</label>
                            <input type="time" value={settings.breakfastEnd} onChange={(e) => setSettings({ ...settings, breakfastEnd: e.target.value })} className="glass-input w-full p-3 rounded-xl text-white outline-none focus:glow-cyan border border-white/10" />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground font-display tracking-widest mb-1 block">DINNER START</label>
                            <input type="time" value={settings.dinnerStart} onChange={(e) => setSettings({ ...settings, dinnerStart: e.target.value })} className="glass-input w-full p-3 rounded-xl text-white outline-none focus:glow-cyan border border-white/10" />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground font-display tracking-widest mb-1 block">DINNER END</label>
                            <input type="time" value={settings.dinnerEnd} onChange={(e) => setSettings({ ...settings, dinnerEnd: e.target.value })} className="glass-input w-full p-3 rounded-xl text-white outline-none focus:glow-cyan border border-white/10" />
                        </div>
                    </div>

                    <div className="mt-4 flex justify-end">
                        <button onClick={handleSaveSettings} disabled={savingSettings} className="px-6 py-3 rounded-xl bg-cyan-500 text-white font-bold tracking-wider hover:bg-cyan-400 transition-colors flex items-center gap-2 text-sm shadow-[0_0_15px_rgba(6,182,212,0.4)]">
                            {savingSettings ? "SAVING..." : <><Save className="w-4 h-4" /> SAVE TIME SLOTS</>}
                        </button>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="glass-card p-6 rounded-2xl border border-white/10 flex flex-col gap-2 relative overflow-hidden group">
                        <span className="text-muted-foreground font-display tracking-widest text-sm relative z-10">BREAKFAST PRESENT</span>
                        <span className="text-4xl font-bold text-white flex items-baseline gap-2 mb-1 relative z-10">
                            {breakfastPresent} <span className="text-base text-muted-foreground font-normal">/ {totalStudents}</span>
                        </span>
                        <div className="absolute top-0 right-0 -mr-6 -mt-6 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Users className="w-32 h-32" />
                        </div>
                    </div>

                    <div className="glass-card p-6 rounded-2xl border border-white/10 flex flex-col gap-2 relative overflow-hidden group">
                        <span className="text-muted-foreground font-display tracking-widest text-sm relative z-10">DINNER PRESENT</span>
                        <span className="text-4xl font-bold text-white flex items-baseline gap-2 mb-1 relative z-10">
                            {dinnerPresent} <span className="text-base text-muted-foreground font-normal">/ {totalStudents}</span>
                        </span>
                        <div className="absolute top-0 right-0 -mr-6 -mt-6 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Users className="w-32 h-32" />
                        </div>
                    </div>
                </div>

                {/* Student List */}
                <div className="glass-card rounded-2xl border border-white/10 overflow-hidden backdrop-blur-md">
                    <div className="p-6 border-b border-white/5 bg-white/5 flex justify-between items-center">
                        <h2 className="font-display tracking-widest text-lg font-semibold text-white">LIVE VERIFICATION ROSTER</h2>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/5 text-muted-foreground/80 text-sm font-display tracking-wider">
                                    <th className="p-4 font-normal w-12 text-center">#</th>
                                    <th className="p-4 font-normal">Student Info</th>
                                    <th className="p-4 font-normal">Room/Block</th>
                                    <th className="p-4 font-normal text-center">Breakfast Status</th>
                                    <th className="p-4 font-normal text-center">Dinner Status</th>
                                    <th className="p-4 font-normal text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {students.map((student, index) => {
                                    const breakfastMark = attendances.find(a => a.userId === student.userId && a.mealType === 'breakfast');
                                    const dinnerMark = attendances.find(a => a.userId === student.userId && a.mealType === 'dinner');

                                    return (
                                        <tr key={student.id} className="hover:bg-white/5 transition-colors">
                                            <td className="p-4 text-muted-foreground font-mono text-center">{index + 1}</td>
                                            <td className="p-4 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-white text-base">{student.fullName}</span>
                                                    <span className="text-xs text-muted-foreground tracking-wider mt-0.5">{student.userId} | {student.phoneNumber}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 whitespace-nowrap text-muted-foreground">
                                                {student.roomNumber} - {student.hostelBlock}
                                            </td>
                                            <td className="p-4 text-center">
                                                {renderMarkBadge(breakfastMark)}
                                            </td>
                                            <td className="p-4 text-center">
                                                {renderMarkBadge(dinnerMark)}
                                            </td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => sendWarning(student)}
                                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40 transition-colors text-xs font-display tracking-widest font-semibold cursor-pointer"
                                                >
                                                    <AlertTriangle className="w-3 h-3" />
                                                    WARN
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}

                                {students.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-muted-foreground" style={{ height: '200px' }}>
                                            No students found in the roster.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
