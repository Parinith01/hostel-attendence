import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Users, LogOut, CheckCircle, XCircle, AlertTriangle, CalendarDays, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
};

type DashboardData = {
    date: string;
    students: Student[];
    attendances: Attendance[];
};

export default function AdminDashboard() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    const fetchDashboard = async () => {
        try {
            const res = await fetch("/api/admin/dashboard");
            const json = await res.json();
            setData(json);
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

    const sendWarning = (student: Student) => {
        toast({
            title: "Warning Sent",
            description: `Disciplinary warning has been sent to ${student.fullName} (${student.userId}).`,
            className: "bg-primary text-primary-foreground border-primary glow-magenta",
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

                    <Link href="/">
                        <span className="p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer text-muted-foreground hover:text-white flex items-center justify-center border border-white/5 group">
                            <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                            <span className="ml-2 font-display text-sm tracking-widest">EXIT</span>
                        </span>
                    </Link>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="glass-card p-6 rounded-2xl border border-white/10 flex flex-col gap-2">
                        <span className="text-muted-foreground font-display tracking-widest text-sm">TOTAL STUDENTS</span>
                        <span className="text-4xl font-bold text-white mb-1">{totalStudents}</span>
                        <div className="h-1 w-full bg-secondary/20 rounded-full overflow-hidden">
                            <div className="h-full bg-secondary/80 w-full glow-cyan"></div>
                        </div>
                    </div>

                    <div className="glass-card p-6 rounded-2xl border border-white/10 flex flex-col gap-2">
                        <span className="text-muted-foreground font-display tracking-widest text-sm">BREAKFAST ATTENDANCE</span>
                        <span className="text-4xl font-bold text-white flex items-baseline gap-2 mb-1">
                            {breakfastPresent} <span className="text-base text-muted-foreground font-normal">/ {totalStudents}</span>
                        </span>
                        <div className="flex justify-between text-xs text-muted-foreground pb-1">
                            <span className="text-green-400">{breakfastPresent} Present</span>
                            <span className="text-red-400">{totalStudents - breakfastPresent} Absent</span>
                        </div>
                    </div>

                    <div className="glass-card p-6 rounded-2xl border border-white/10 flex flex-col gap-2">
                        <span className="text-muted-foreground font-display tracking-widest text-sm">DINNER ATTENDANCE</span>
                        <span className="text-4xl font-bold text-white flex items-baseline gap-2 mb-1">
                            {dinnerPresent} <span className="text-base text-muted-foreground font-normal">/ {totalStudents}</span>
                        </span>
                        <div className="flex justify-between text-xs text-muted-foreground pb-1">
                            <span className="text-green-400">{dinnerPresent} Present</span>
                            <span className="text-red-400">{totalStudents - dinnerPresent} Absent</span>
                        </div>
                    </div>
                </div>

                {/* Student List */}
                <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
                    <div className="p-6 border-b border-white/5 bg-white/5">
                        <h2 className="font-display tracking-widest text-lg font-semibold text-white">STUDENT ROSTER</h2>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/5 text-muted-foreground/80 text-sm font-display tracking-wider">
                                    <th className="p-4 font-normal">Student Info</th>
                                    <th className="p-4 font-normal">Room/Block</th>
                                    <th className="p-4 font-normal text-center">Breakfast Status</th>
                                    <th className="p-4 font-normal text-center">Dinner Status</th>
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
                                                    <div className="inline-flex flex-col items-center gap-1">
                                                        <CheckCircle className="w-5 h-5 text-green-500 drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                            <Clock className="w-3 h-3" /> {new Date(breakfastMark.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <XCircle className="w-5 h-5 text-red-500/50 mx-auto" />
                                                )}
                                            </td>
                                            <td className="p-4 text-center">
                                                {dinnerMark ? (
                                                    <div className="inline-flex flex-col items-center gap-1">
                                                        <CheckCircle className="w-5 h-5 text-green-500 drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                            <Clock className="w-3 h-3" /> {new Date(dinnerMark.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
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
