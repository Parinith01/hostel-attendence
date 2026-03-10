import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Users, LogOut, CheckCircle, XCircle, AlertTriangle, CalendarDays, Clock, Download, Settings as SettingsIcon, Save } from "lucide-react";
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
        } catch (e) {
            toast({
                title: "Error fetching data",
                description: "Failed to load dashboard data.",
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
                // Instantly update UI optimistically
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

    const downloadStudentsPDF = () => {
        const doc = new jsPDF();
        doc.text("Registered Students Roster", 14, 15);
        autoTable(doc, {
            head: [['Full Name', 'User ID', 'Phone Number', 'Room', 'Block']],
            body: data?.students.map(s => [s.fullName, s.userId, s.phoneNumber, s.roomNumber, s.hostelBlock]) || [],
            startY: 20,
            theme: 'grid',
            headStyles: { fillColor: [236, 72, 153] }
        });
        doc.save("Registered_Students.pdf");
    };

    const downloadAttendancePDF = () => {
        if (!data) return;
        const doc = new jsPDF();
        doc.text(`Hostel Attendance Report - ${data.date}`, 14, 15);
        autoTable(doc, {
            head: [['Student Name', 'Room No', 'Breakfast', 'Dinner']],
            body: data.students.map(student => {
                const b = data.attendances.find(a => a.userId === student.userId && a.mealType === 'breakfast');
                const d = data.attendances.find(a => a.userId === student.userId && a.mealType === 'dinner');
                return [
                    student.fullName,
                    student.roomNumber,
                    b ? (b.verifiedByAdmin ? 'Present (Verified)' : 'Present (Unverified)') : 'Absent',
                    d ? (d.verifiedByAdmin ? 'Present (Verified)' : 'Present (Unverified)') : 'Absent'
                ];
            }),
            startY: 20,
            theme: 'grid',
            headStyles: { fillColor: [6, 182, 212] }
        });
        doc.save(`Attendance_${data.date}.pdf`);
    };

    const sendWarning = (student: Student) => {
        toast({
            title: "Warning Sent",
            description: `Disciplinary warning has been sent to ${student.fullName} (${student.userId}).`,
            variant: "destructive",
        });
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
    const breakfastPresent = attendances.filter(a => a.mealType === "breakfast").length;
    const dinnerPresent = attendances.filter(a => a.mealType === "dinner").length;

    return (
        <div className="min-h-screen p-4 sm:p-8">
            {/* Background Orbs */}
            <div className="bg-orb orb-1 fixed"></div>
            <div className="bg-orb orb-2 fixed"></div>
            <div className="bg-orb orb-3 fixed"></div>

            <div className="max-w-6xl mx-auto relative z-10 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">

                {/* Header */}
                <div className="glass-card p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-magenta-500/20">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-magenta-500/10 text-magenta-500 flex items-center justify-center glow-magenta">
                            <Users className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="font-display text-2xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-magenta-400 to-purple-500 drop-shadow-[0_0_8px_rgba(236,72,153,0.5)]">
                                Admin Dashboard
                            </h1>
                            <p className="font-display text-magenta-400/80 uppercase tracking-widest text-xs font-semibold mt-1 flex gap-2 items-center">
                                <CalendarDays className="w-3 h-3" /> {date}
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button onClick={downloadStudentsPDF} className="p-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 hover:text-white flex items-center justify-center transition-colors group text-sm font-display tracking-widest">
                            <Download className="w-4 h-4 mr-2" /> STUDENTS PDF
                        </button>
                        <button onClick={downloadAttendancePDF} className="p-3 rounded-xl bg-magenta-500/10 hover:bg-magenta-500/20 border border-magenta-500/20 text-magenta-400 hover:text-white flex items-center justify-center transition-colors group text-sm font-display tracking-widest">
                            <Download className="w-4 h-4 mr-2" /> ATTENDANCE PDF
                        </button>
                        <Link href="/">
                            <span className="p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer text-muted-foreground hover:text-white flex items-center justify-center border border-white/5 group h-full">
                                <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                            </span>
                        </Link>
                    </div>
                </div>

                {/* Settings Editor */}
                <div className="glass-card p-6 rounded-2xl border border-white/10 gap-2">
                    <h2 className="font-display tracking-widest text-lg font-semibold text-white mb-4 flex items-center gap-2"><SettingsIcon className="w-5 h-5 text-cyan-400" /> TIME SLOT CONFIGURATION</h2>

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
                        <button onClick={handleSaveSettings} disabled={savingSettings} className="px-6 py-3 rounded-xl bg-cyan-500 text-white font-bold tracking-wider hover:bg-cyan-400 transition-colors flex items-center gap-2 text-sm">
                            {savingSettings ? "SAVING..." : <><Save className="w-4 h-4" /> SAVE TIME SLOTS</>}
                        </button>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="glass-card p-6 rounded-2xl border border-white/10 flex flex-col gap-2 relative overflow-hidden group">
                        <span className="text-muted-foreground font-display tracking-widest text-sm relative z-10">BREAKFAST ATTENDANCE</span>
                        <span className="text-4xl font-bold text-white flex items-baseline gap-2 mb-1 relative z-10">
                            {breakfastPresent} <span className="text-base text-muted-foreground font-normal">/ {totalStudents}</span>
                        </span>
                        <div className="absolute top-0 right-0 -mr-6 -mt-6 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Users className="w-32 h-32" />
                        </div>
                    </div>

                    <div className="glass-card p-6 rounded-2xl border border-white/10 flex flex-col gap-2 relative overflow-hidden group">
                        <span className="text-muted-foreground font-display tracking-widest text-sm relative z-10">DINNER ATTENDANCE</span>
                        <span className="text-4xl font-bold text-white flex items-baseline gap-2 mb-1 relative z-10">
                            {dinnerPresent} <span className="text-base text-muted-foreground font-normal">/ {totalStudents}</span>
                        </span>
                        <div className="absolute top-0 right-0 -mr-6 -mt-6 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Users className="w-32 h-32" />
                        </div>
                    </div>
                </div>

                {/* Student List */}
                <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
                    <div className="p-6 border-b border-white/5 bg-white/5 flex justify-between items-center">
                        <h2 className="font-display tracking-widest text-lg font-semibold text-white">STUDENT VERIFICATION ROSTER</h2>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/5 text-muted-foreground/80 text-sm font-display tracking-wider">
                                    <th className="p-4 font-normal">Student Info</th>
                                    <th className="p-4 font-normal">Room/Block</th>
                                    <th className="p-4 font-normal text-center">Breakfast Status (Click to Verify)</th>
                                    <th className="p-4 font-normal text-center">Dinner Status (Click to Verify)</th>
                                    <th className="p-4 font-normal text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {students.map((student) => {
                                    const breakfastMark = attendances.find(a => a.userId === student.userId && a.mealType === 'breakfast');
                                    const dinnerMark = attendances.find(a => a.userId === student.userId && a.mealType === 'dinner');

                                    return (
                                        <tr key={student.id} className="hover:bg-white/5 transition-colors">
                                            <td className="p-4 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-white">{student.fullName}</span>
                                                    <span className="text-xs text-muted-foreground tracking-wider">{student.userId} | {student.phoneNumber}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 whitespace-nowrap text-muted-foreground">
                                                {student.roomNumber} - {student.hostelBlock}
                                            </td>
                                            <td className="p-4 text-center">
                                                {breakfastMark ? (
                                                    <button onClick={() => handleVerifyParams(breakfastMark.id, !!breakfastMark.verifiedByAdmin)} className={`inline-flex flex-col items-center gap-1 p-2 rounded-xl border transition-all cursor-pointer ${breakfastMark.verifiedByAdmin ? 'bg-green-500/20 border-green-500/50 glow-cyan' : 'bg-white/5 border-white/10 hover:border-cyan-400/50'}`}>
                                                        <CheckCircle className={`w-5 h-5 ${breakfastMark.verifiedByAdmin ? 'text-green-400' : 'text-cyan-400 glow-cyan'}`} />
                                                        <span className={`text-[10px] flex items-center gap-1 ${breakfastMark.verifiedByAdmin ? 'text-green-400 font-bold' : 'text-muted-foreground'}`}>
                                                            {breakfastMark.verifiedByAdmin ? 'VERIFIED' : 'PENDING'}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground/50">{new Date(breakfastMark.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </button>
                                                ) : (
                                                    <XCircle className="w-5 h-5 text-red-500/50 mx-auto" />
                                                )}
                                            </td>
                                            <td className="p-4 text-center">
                                                {dinnerMark ? (
                                                    <button onClick={() => handleVerifyParams(dinnerMark.id, !!dinnerMark.verifiedByAdmin)} className={`inline-flex flex-col items-center gap-1 p-2 rounded-xl border transition-all cursor-pointer ${dinnerMark.verifiedByAdmin ? 'bg-green-500/20 border-green-500/50 glow-cyan' : 'bg-white/5 border-white/10 hover:border-cyan-400/50'}`}>
                                                        <CheckCircle className={`w-5 h-5 ${dinnerMark.verifiedByAdmin ? 'text-green-400' : 'text-cyan-400 glow-cyan'}`} />
                                                        <span className={`text-[10px] flex items-center gap-1 ${dinnerMark.verifiedByAdmin ? 'text-green-400 font-bold' : 'text-muted-foreground'}`}>
                                                            {dinnerMark.verifiedByAdmin ? 'VERIFIED' : 'PENDING'}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground/50">{new Date(dinnerMark.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </button>
                                                ) : (
                                                    <XCircle className="w-5 h-5 text-red-500/50 mx-auto" />
                                                )}
                                            </td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => sendWarning(student)}
                                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40 transition-colors text-xs font-display tracking-widest font-semibold"
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
                                        <td colSpan={5} className="p-8 text-center text-muted-foreground">
                                            No students are currently registered in the database.
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
