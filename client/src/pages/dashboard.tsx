import { useState, useEffect } from "react";
import { UtensilsCrossed, ArrowRight, LogOut, CheckCircle, Sunrise, Sunset, AlertTriangle, X, Lock, User as UserIcon, ClipboardList, Send, Clock, CheckCheck, XCircle, CalendarClock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import QRCode from "react-qr-code";

const MONTHLY_ABSENCE_LIMIT = 8;

type SettingsData = {
    breakfastStart: string;
    breakfastEnd: string;
    dinnerStart: string;
    dinnerEnd: string;
};

type LeaveRequest = {
    id: string;
    userId: string;
    reason: string;
    startDate: string;
    endDate: string;
    returnMealType: string;
    status: string;
    adminNote: string | null;
    timestamp: string;
    monthYear: string;
};

export default function Dashboard() {
    const [isLoading, setIsLoading] = useState(false);
    const [settings, setSettings] = useState<SettingsData | null>(null);
    const [absentMode, setAbsentMode] = useState(false);
    const [absentReason, setAbsentReason] = useState("");
    const [returnDate, setReturnDate] = useState("");
    const [returnMealType, setReturnMealType] = useState<"breakfast" | "dinner" | "">("");
    const [selectedAbsentMeal, setSelectedAbsentMeal] = useState<"breakfast" | "dinner" | null>(null);
    const [messages, setMessages] = useState<{ breakfast?: string, dinner?: string }>({});
    const [sundayToken, setSundayToken] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"attendance" | "password" | "leave">("attendance");
    const [passwordData, setPasswordData] = useState({ current: "", new: "", confirm: "" });

    // Monthly absence tracking
    const [monthlyAbsentCount, setMonthlyAbsentCount] = useState(0);
    const [limitReached, setLimitReached] = useState(false);

    // Leave request states
    const [showLeaveRequestForm, setShowLeaveRequestForm] = useState(false);
    const [leaveReason, setLeaveReason] = useState("");
    const [leaveStartDate, setLeaveStartDate] = useState("");
    const [leaveEndDate, setLeaveEndDate] = useState("");
    const [leaveReturnMeal, setLeaveReturnMeal] = useState<"breakfast" | "dinner" | "">("");
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
    const [loadingLeave, setLoadingLeave] = useState(false);

    const { toast } = useToast();

    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const monthYear = nowIST.getFullYear() + '-' + String(nowIST.getMonth() + 1).padStart(2, '0');

    const fetchMonthlyAbsentCount = async (userId: string) => {
        try {
            const res = await fetch(`/api/attendance/monthly-absent-count?userId=${userId}&monthYear=${monthYear}`);
            const data = await res.json();
            const count = data.count || 0;
            setMonthlyAbsentCount(count);
            setLimitReached(count >= MONTHLY_ABSENCE_LIMIT);
        } catch (err) { console.error(err); }
    };

    const fetchLeaveRequests = async (userId: string) => {
        try {
            const res = await fetch(`/api/leave-request?userId=${userId}`);
            const data = await res.json();
            setLeaveRequests(data);
        } catch (err) { console.error(err); }
    };

    useEffect(() => {
        fetch("/api/settings").then(res => res.json()).then(data => setSettings(data)).catch(err => console.error(err));

        const storedUser = localStorage.getItem("user");
        if (storedUser) {
            const user = JSON.parse(storedUser);
            fetch(`/api/attendance/today?userId=${user.userId}`)
                .then(res => res.json())
                .then((records: { mealType: string; status: string }[]) => {
                    const newMessages: { breakfast?: string; dinner?: string } = {};
                    records.forEach(r => {
                        if (r.mealType === "breakfast") newMessages.breakfast = `Breakfast marked as ${r.status}.`;
                        if (r.mealType === "dinner") newMessages.dinner = `Dinner marked as ${r.status}.`;
                    });
                    if (Object.keys(newMessages).length > 0) setMessages(newMessages);
                })
                .catch(err => console.error(err));

            fetch(`/api/attendance/sunday-token?userId=${user.userId}`)
                .then(res => res.json())
                .then(data => { if (data.token) setSundayToken(data.token); })
                .catch(err => console.error("Error fetching token:", err));

            fetchMonthlyAbsentCount(user.userId);
            fetchLeaveRequests(user.userId);
        }
    }, []);

    // Always compute current time in IST to match server-side window logic
    const currentMinutes = nowIST.getHours() * 60 + nowIST.getMinutes();

    const toMinutes = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    };

    const isInWindow = (start: string, end: string) => {
        const s = toMinutes(start);
        const e = toMinutes(end);
        if (e < s) return currentMinutes >= s || currentMinutes <= e;
        return currentMinutes >= s && currentMinutes <= e;
    };

    let isBreakfastOpen = false;
    let isDinnerOpen = false;

    if (settings) {
        isBreakfastOpen = isInWindow(settings.breakfastStart, settings.breakfastEnd);
        isDinnerOpen = isInWindow(settings.dinnerStart, settings.dinnerEnd);
    }

    const handleAttendance = async (mealType: "breakfast" | "dinner", status: "present" | "absent" = "present") => {
        const storedUser = localStorage.getItem("user");
        if (!storedUser) {
            toast({ title: "Error", description: "You are not logged in.", variant: "destructive" });
            return;
        }

        // If limit reached, show the leave approval option instead
        if (status === "absent" && limitReached) {
            setActiveTab("leave");
            setShowLeaveRequestForm(true);
            toast({
                title: "Monthly Limit Reached",
                description: `You've used all ${MONTHLY_ABSENCE_LIMIT} absences this month. Please request admin approval for additional leave.`,
                className: "bg-orange-500/20 text-orange-300 border-orange-500",
            });
            return;
        }

        if (status === "absent" && !absentMode) {
            setAbsentMode(true);
            setSelectedAbsentMeal(mealType);
            return;
        }

        if (status === "absent" && absentMode) {
            if (!absentReason.trim()) {
                toast({ title: "Reason Required", description: "Please provide a reason for your absence.", variant: "destructive" });
                return;
            }
            if (!returnDate) {
                toast({ title: "Return Date Required", description: "Please provide your return date.", variant: "destructive" });
                return;
            }
            if (!returnMealType) {
                toast({ title: "Return Meal Required", description: "Please select the meal for your return.", variant: "destructive" });
                return;
            }
        }

        const user = JSON.parse(storedUser);
        setIsLoading(true);

        try {
            const res = await fetch("/api/attendance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: user.userId,
                    status,
                    absentReason: status === "absent" ? absentReason : undefined,
                    returnDate: status === "absent" ? returnDate : undefined,
                    returnMealType: status === "absent" ? returnMealType : undefined,
                    selectedMealType: mealType
                })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || "Failed to mark attendance.");
            }

            const data = await res.json();
            setMessages(prev => ({ ...prev, [mealType]: data.message }));

            if (status === "absent") {
                setAbsentMode(false);
                setAbsentReason("");
                setReturnDate("");
                setReturnMealType("");
                setSelectedAbsentMeal(null);
                // Refresh absent count
                await fetchMonthlyAbsentCount(user.userId);
            }

            toast({
                title: status === "present" ? "Attendance Confirmed" : "Absence Logged",
                description: data.message,
                className: status === "present" ? "bg-primary text-primary-foreground border-primary glow-cyan" : "bg-yellow-500/20 text-yellow-400 border-yellow-500 glow-yellow",
            });
        } catch (err: any) {
            toast({
                title: "Action Failed",
                description: err.message,
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordData.new !== passwordData.confirm) {
            toast({ title: "Error", description: "New passwords do not match.", variant: "destructive" });
            return;
        }
        if (passwordData.new.length < 6) {
            toast({ title: "Error", description: "Password must be at least 6 characters.", variant: "destructive" });
            return;
        }

        const storedUser = localStorage.getItem("user");
        if (!storedUser) return;
        const user = JSON.parse(storedUser);

        setIsLoading(true);
        try {
            const res = await fetch("/api/change-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: user.userId,
                    currentPassword: passwordData.current,
                    newPassword: passwordData.new
                })
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to change password.");
            }

            toast({ title: "Success", description: "Password changed successfully.", className: "bg-green-500 text-white" });
            setPasswordData({ current: "", new: "", confirm: "" });
            setActiveTab("attendance");
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmitLeaveRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        const storedUser = localStorage.getItem("user");
        if (!storedUser) return;
        const user = JSON.parse(storedUser);

        if (!leaveReason.trim()) {
            toast({ title: "Error", description: "Please provide a reason.", variant: "destructive" });
            return;
        }
        if (!leaveStartDate || !leaveEndDate) {
            toast({ title: "Error", description: "Please provide start and end dates.", variant: "destructive" });
            return;
        }
        if (!leaveReturnMeal) {
            toast({ title: "Error", description: "Please select the return meal.", variant: "destructive" });
            return;
        }
        if (leaveEndDate < leaveStartDate) {
            toast({ title: "Error", description: "End date must be after start date.", variant: "destructive" });
            return;
        }

        setLoadingLeave(true);
        try {
            const res = await fetch("/api/leave-request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: user.userId,
                    reason: leaveReason,
                    startDate: leaveStartDate,
                    endDate: leaveEndDate,
                    returnMealType: leaveReturnMeal,
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Failed to submit leave request.");
            }

            toast({ title: "Leave Request Submitted", description: "Your request has been sent to the admin for approval.", className: "bg-green-600/20 text-green-300 border-green-500" });
            setLeaveReason(""); setLeaveStartDate(""); setLeaveEndDate(""); setLeaveReturnMeal("");
            setShowLeaveRequestForm(false);
            await fetchLeaveRequests(user.userId);
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setLoadingLeave(false);
        }
    };

    const absencesLeft = Math.max(0, MONTHLY_ABSENCE_LIMIT - monthlyAbsentCount);
    const absencePct = Math.min(100, (monthlyAbsentCount / MONTHLY_ABSENCE_LIMIT) * 100);

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            {/* Background Orbs */}
            <div className="bg-orb orb-1 fixed"></div>
            <div className="bg-orb orb-2 fixed"></div>
            <div className="bg-orb orb-3 fixed"></div>

            <div className="glass-card w-full max-w-md p-8 sm:p-10 z-10 animate-in fade-in zoom-in duration-700 relative overflow-hidden">
                {/* Neon Edge Highlight */}
                <div className="absolute inset-0 border border-secondary/30 rounded-2xl pointer-events-none" style={{
                    background: "linear-gradient(135deg, hsl(var(--secondary) / 0.1) 0%, transparent 50%, hsl(var(--primary) / 0.1) 100%)"
                }}></div>

                <div className="absolute top-6 right-6 z-20">
                    <Link href="/">
                        <span className="p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer text-muted-foreground hover:text-white flex items-center justify-center" onClick={() => localStorage.removeItem("user")}>
                            <LogOut className="w-5 h-5" />
                        </span>
                    </Link>
                </div>

                <div className="relative z-10 flex flex-col gap-6">
                    {/* Header */}
                    <div className="text-center space-y-2">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary/10 text-secondary glow-cyan mb-4">
                            <UtensilsCrossed className="w-8 h-8" />
                        </div>
                        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">
                            JSS Hostel Hub
                        </h1>
                        <p className="font-display text-primary uppercase tracking-[0.2em] text-sm font-semibold text-glow">
                            Student Portal
                        </p>
                    </div>

                    {/* Monthly Absence Tracker Bar */}
                    <div className={`p-3 rounded-xl border ${limitReached ? 'bg-red-500/10 border-red-500/40' : absencesLeft <= 2 ? 'bg-orange-500/10 border-orange-500/30' : 'bg-white/5 border-white/10'}`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-display font-bold tracking-widest uppercase text-white/60">Monthly Absences</span>
                            <span className={`text-xs font-bold font-mono ${limitReached ? 'text-red-400' : absencesLeft <= 2 ? 'text-orange-400' : 'text-cyan-400'}`}>
                                {monthlyAbsentCount} / {MONTHLY_ABSENCE_LIMIT}
                            </span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-700 ${limitReached ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : absencesLeft <= 2 ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]' : 'bg-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.5)]'}`}
                                style={{ width: `${absencePct}%` }}
                            />
                        </div>
                        {limitReached && (
                            <p className="text-[10px] text-red-400 mt-1.5 font-display tracking-wider">
                                ⚠ Limit reached — use the Leave Requests tab for additional leaves
                            </p>
                        )}
                        {!limitReached && absencesLeft <= 2 && (
                            <p className="text-[10px] text-orange-400 mt-1.5 font-display tracking-wider">
                                ⚠ Only {absencesLeft} absence{absencesLeft !== 1 ? 's' : ''} remaining this month
                            </p>
                        )}
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                        <button
                            onClick={() => setActiveTab("attendance")}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-display font-bold tracking-widest uppercase transition-all ${activeTab === "attendance" ? "bg-cyan-500 text-white shadow-[0_0_10px_rgba(34,211,238,0.3)]" : "text-muted-foreground hover:text-white"}`}
                        >
                            <UtensilsCrossed className="w-3.5 h-3.5" /> Attendance
                        </button>
                        <button
                            onClick={() => { setActiveTab("leave"); fetchLeaveRequests(JSON.parse(localStorage.getItem("user") || "{}").userId); }}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-display font-bold tracking-widest uppercase transition-all relative ${activeTab === "leave" ? "bg-orange-500 text-white shadow-[0_0_10px_rgba(249,115,22,0.3)]" : "text-muted-foreground hover:text-white"}`}
                        >
                            <ClipboardList className="w-3.5 h-3.5" /> Leave
                            {leaveRequests.some(lr => lr.status === 'pending') && (
                                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-orange-400 shadow-[0_0_6px_rgba(249,115,22,0.8)]" />
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab("password")}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-display font-bold tracking-widest uppercase transition-all ${activeTab === "password" ? "bg-magenta-500 text-white shadow-[0_0_10px_rgba(236,72,153,0.3)]" : "text-muted-foreground hover:text-white"}`}
                        >
                            <Lock className="w-3.5 h-3.5" /> Password
                        </button>
                    </div>

                    {activeTab === "attendance" ? (
                        <>
                            {sundayToken && (
                                <div className="mb-2 mt-0 p-4 rounded-[20px] bg-gradient-to-br from-cyan-500/10 to-blue-500/5 border border-cyan-500/20 flex flex-col items-center justify-center gap-3 backdrop-blur-md relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/0 via-cyan-400/10 to-cyan-400/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                                    <div className="flex items-center gap-2 text-cyan-400 font-display tracking-widest text-xs font-bold uppercase drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">
                                        <CheckCircle className="w-4 h-4" />
                                        Sunday Breakfast Token
                                    </div>
                                    <div className="p-2 bg-white rounded-xl shadow-[0_0_20px_rgba(34,211,238,0.3)]">
                                        <QRCode value={sundayToken} size={120} />
                                    </div>
                                    <div className="font-mono text-lg font-bold text-white tracking-widest drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]">
                                        {sundayToken.split(':')[0]}
                                    </div>
                                    <p className="text-[10px] text-cyan-200/50 text-center max-w-[200px]">Show this verified token to the staff to claim your Sunday breakfast.</p>
                                </div>
                            )}

                            {/* Action Cards */}
                            <div className="space-y-4">
                                {/* Breakfast Card */}
                                <div className={`p-4 rounded-2xl border transition-all duration-300 ${isBreakfastOpen ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-white/5 border-white/5 opacity-70'}`}>
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <Sunrise className={`w-5 h-5 ${isBreakfastOpen ? 'text-cyan-400 glow-cyan' : 'text-muted-foreground'}`} />
                                            <span className="font-display font-bold tracking-widest uppercase text-white">Breakfast</span>
                                        </div>
                                        <span className="text-xs text-muted-foreground tracking-wider font-semibold">
                                            {settings ? `${settings.breakfastStart} - ${settings.breakfastEnd}` : 'LOADING...'}
                                        </span>
                                    </div>

                                    {messages.breakfast ? (
                                        <div className="bg-white/5 rounded-xl p-3 flex items-center justify-center gap-2 text-sm text-green-400">
                                            <CheckCircle className="w-4 h-4" /> SESSION LOCKED
                                        </div>
                                    ) : (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleAttendance("breakfast", "present")}
                                                disabled={isLoading || !isBreakfastOpen}
                                                className={`flex-1 overflow-hidden relative group rounded-xl font-display font-bold text-xs tracking-wide uppercase py-3 transition-colors ${isBreakfastOpen ? 'bg-cyan-500 hover:bg-cyan-400 text-white shadow-[0_0_15px_rgba(34,211,238,0.4)]' : 'bg-white/5 text-muted-foreground cursor-not-allowed'}`}
                                            >
                                                I AM PRESENT
                                            </button>
                                            <button
                                                onClick={() => handleAttendance("breakfast", "absent")}
                                                disabled={isLoading}
                                                className={`flex-1 overflow-hidden relative group rounded-xl font-display font-bold text-xs tracking-wide uppercase py-3 transition-colors ${limitReached
                                                    ? 'bg-orange-500/20 border border-orange-500/40 text-orange-400 hover:bg-orange-500/30'
                                                    : absentMode && selectedAbsentMeal === "breakfast"
                                                        ? 'bg-yellow-500/30 text-yellow-100 border border-yellow-500/50'
                                                        : 'bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                                                    }`}
                                            >
                                                {limitReached ? 'REQ. LEAVE' : 'I AM ABSENT'}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Dinner Card */}
                                <div className={`p-4 rounded-2xl border transition-all duration-300 ${isDinnerOpen ? 'bg-magenta-500/10 border-magenta-500/30' : 'bg-white/5 border-white/5 opacity-70'}`}>
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <Sunset className={`w-5 h-5 ${isDinnerOpen ? 'text-magenta-400 shadow-[0_0_8px_rgba(236,72,153,0.8)]' : 'text-muted-foreground'}`} />
                                            <span className="font-display font-bold tracking-widest uppercase text-white">Dinner</span>
                                        </div>
                                        <span className="text-xs text-muted-foreground tracking-wider font-semibold">
                                            {settings ? `${settings.dinnerStart} - ${settings.dinnerEnd}` : 'LOADING...'}
                                        </span>
                                    </div>

                                    {messages.dinner ? (
                                        <div className="bg-white/5 rounded-xl p-3 flex items-center justify-center gap-2 text-sm text-green-400">
                                            <CheckCircle className="w-4 h-4" /> REASON LOGGED
                                        </div>
                                    ) : (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleAttendance("dinner", "present")}
                                                disabled={isLoading || !isDinnerOpen}
                                                className={`flex-1 overflow-hidden relative group rounded-xl font-display font-bold text-xs tracking-wide uppercase py-3 transition-colors ${isDinnerOpen ? 'bg-magenta-500 hover:bg-magenta-400 text-white shadow-[0_0_15px_rgba(236,72,153,0.4)]' : 'bg-white/5 text-muted-foreground cursor-not-allowed'}`}
                                            >
                                                I AM PRESENT
                                            </button>
                                            <button
                                                onClick={() => handleAttendance("dinner", "absent")}
                                                disabled={isLoading}
                                                className={`flex-1 overflow-hidden relative group rounded-xl font-display font-bold text-xs tracking-wide uppercase py-3 transition-colors ${limitReached
                                                    ? 'bg-orange-500/20 border border-orange-500/40 text-orange-400 hover:bg-orange-500/30'
                                                    : absentMode && selectedAbsentMeal === "dinner"
                                                        ? 'bg-yellow-500/30 text-yellow-100 border border-yellow-500/50'
                                                        : 'bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                                                    }`}
                                            >
                                                {limitReached ? 'REQ. LEAVE' : 'I AM ABSENT'}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Absent Reason Form */}
                                {absentMode && !limitReached && (
                                    <div className="p-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/5 animate-in fade-in zoom-in-95 duration-300 flex flex-col gap-3 relative mt-4">
                                        <button onClick={() => setAbsentMode(false)} className="absolute top-3 right-3 text-muted-foreground hover:text-white transition">
                                            <X className="w-4 h-4" />
                                        </button>

                                        <div className="flex items-center gap-2 text-yellow-400">
                                            <AlertTriangle className="w-4 h-4" />
                                            <label className="text-sm font-display tracking-widest font-bold">REASON FOR ABSENCE ({selectedAbsentMeal?.toUpperCase()})</label>
                                        </div>
                                        <div className="space-y-4">
                                            <textarea
                                                value={absentReason}
                                                onChange={(e) => setAbsentReason(e.target.value)}
                                                placeholder={`Please provide a valid reason for missing ${selectedAbsentMeal}...`}
                                                className="w-full p-3 rounded-xl bg-white/5 border border-yellow-500/30 text-white placeholder:text-muted-foreground focus:outline-none focus:border-yellow-500 focus:shadow-[0_0_15px_rgba(234,179,8,0.3)] resize-none"
                                                rows={2}
                                            />

                                            <div>
                                                <label className="text-xs font-display tracking-widest text-yellow-400 mb-1 block">Expected Return Date</label>
                                                <input
                                                    type="date"
                                                    value={returnDate}
                                                    min={new Date().toISOString().split("T")[0]}
                                                    onChange={(e) => setReturnDate(e.target.value)}
                                                    className="w-full p-3 rounded-xl bg-white/5 border border-yellow-500/30 text-white placeholder:text-muted-foreground focus:outline-none focus:border-yellow-500 focus:shadow-[0_0_15px_rgba(234,179,8,0.3)]"
                                                />
                                            </div>

                                            <div>
                                                <label className="text-xs font-display tracking-widest text-yellow-400 mb-1 block">First Meal on Return</label>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => setReturnMealType("breakfast")}
                                                        className={`flex-1 py-2 rounded-lg text-sm font-display tracking-wider transition border ${returnMealType === "breakfast" ? "bg-yellow-500/30 text-yellow-100 border-yellow-500" : "bg-white/5 text-muted-foreground border-yellow-500/20 hover:border-yellow-500/40"}`}
                                                    >
                                                        BREAKFAST
                                                    </button>
                                                    <button
                                                        onClick={() => setReturnMealType("dinner")}
                                                        className={`flex-1 py-2 rounded-lg text-sm font-display tracking-wider transition border ${returnMealType === "dinner" ? "bg-yellow-500/30 text-yellow-100 border-yellow-500" : "bg-white/5 text-muted-foreground border-yellow-500/20 hover:border-yellow-500/40"}`}
                                                    >
                                                        DINNER
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => selectedAbsentMeal && handleAttendance(selectedAbsentMeal, "absent")}
                                            disabled={isLoading || !absentReason.trim() || !returnDate || !returnMealType}
                                            className="w-full py-3 rounded-xl bg-yellow-500 text-black font-display font-bold uppercase tracking-wider text-sm hover:bg-yellow-400 hover:shadow-[0_0_15px_rgba(234,179,8,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isLoading ? "Submitting..." : "Confirm Absence"}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : activeTab === "leave" ? (
                        /* Leave Requests Tab */
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            {/* Header info */}
                            <div className={`p-3 rounded-xl border text-center ${limitReached ? 'bg-red-500/10 border-red-500/30' : 'bg-orange-500/5 border-orange-500/20'}`}>
                                <p className="text-xs text-white/70 leading-relaxed">
                                    {limitReached
                                        ? <span>You've used <span className="text-red-400 font-bold">{monthlyAbsentCount}/{MONTHLY_ABSENCE_LIMIT}</span> absences this month — submit a leave request for admin approval.</span>
                                        : <span>You have <span className="text-orange-400 font-bold">{absencesLeft}</span> absences remaining this month. For extended leave, request admin approval.</span>
                                    }
                                </p>
                            </div>

                            {/* Submit new request button */}
                            {!showLeaveRequestForm ? (
                                <button
                                    onClick={() => setShowLeaveRequestForm(true)}
                                    className="w-full py-3 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 text-orange-300 font-display font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_10px_rgba(249,115,22,0.2)]"
                                >
                                    <Send className="w-4 h-4" /> Request Admin Approval for Leave
                                </button>
                            ) : (
                                <form onSubmit={handleSubmitLeaveRequest} className="p-4 rounded-2xl border border-orange-500/30 bg-orange-500/5 space-y-4 animate-in fade-in zoom-in-95 duration-300 relative">
                                    <button type="button" onClick={() => setShowLeaveRequestForm(false)} className="absolute top-3 right-3 text-muted-foreground hover:text-white transition">
                                        <X className="w-4 h-4" />
                                    </button>
                                    <div className="flex items-center gap-2 text-orange-400 mb-1">
                                        <CalendarClock className="w-4 h-4" />
                                        <span className="text-xs font-display tracking-widest font-bold uppercase">Leave Approval Request</span>
                                    </div>

                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-[10px] font-display tracking-widest text-orange-400 uppercase mb-1 block">Reason for Extended Leave</label>
                                            <textarea
                                                value={leaveReason}
                                                onChange={e => setLeaveReason(e.target.value)}
                                                placeholder="Explain why you need additional leave this month..."
                                                className="w-full p-3 rounded-xl bg-white/5 border border-orange-500/30 text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-orange-500 resize-none text-sm"
                                                rows={3}
                                                required
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] font-display tracking-widest text-orange-400 uppercase mb-1 block">Leave Start Date</label>
                                                <input
                                                    type="date"
                                                    value={leaveStartDate}
                                                    min={new Date().toISOString().split("T")[0]}
                                                    onChange={e => setLeaveStartDate(e.target.value)}
                                                    className="w-full p-2.5 rounded-xl bg-white/5 border border-orange-500/30 text-white text-sm focus:outline-none focus:border-orange-500"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-display tracking-widest text-orange-400 uppercase mb-1 block">Return Date</label>
                                                <input
                                                    type="date"
                                                    value={leaveEndDate}
                                                    min={leaveStartDate || new Date().toISOString().split("T")[0]}
                                                    onChange={e => setLeaveEndDate(e.target.value)}
                                                    className="w-full p-2.5 rounded-xl bg-white/5 border border-orange-500/30 text-white text-sm focus:outline-none focus:border-orange-500"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-display tracking-widest text-orange-400 uppercase mb-1 block">First Meal on Return</label>
                                            <div className="flex gap-2">
                                                <button type="button" onClick={() => setLeaveReturnMeal("breakfast")}
                                                    className={`flex-1 py-2 rounded-lg text-xs font-display tracking-wider transition border ${leaveReturnMeal === "breakfast" ? "bg-orange-500/30 text-orange-100 border-orange-500" : "bg-white/5 text-muted-foreground border-orange-500/20 hover:border-orange-500/40"}`}>
                                                    BREAKFAST
                                                </button>
                                                <button type="button" onClick={() => setLeaveReturnMeal("dinner")}
                                                    className={`flex-1 py-2 rounded-lg text-xs font-display tracking-wider transition border ${leaveReturnMeal === "dinner" ? "bg-orange-500/30 text-orange-100 border-orange-500" : "bg-white/5 text-muted-foreground border-orange-500/20 hover:border-orange-500/40"}`}>
                                                    DINNER
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={loadingLeave}
                                        className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-display font-bold uppercase tracking-wider text-xs transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(249,115,22,0.4)]"
                                    >
                                        {loadingLeave ? "Submitting..." : <><Send className="w-4 h-4" /> Submit Leave Request</>}
                                    </button>
                                </form>
                            )}

                            {/* Past requests */}
                            <div className="space-y-3">
                                <h3 className="text-[10px] font-display tracking-widest text-white/40 uppercase">Your Requests This Month</h3>
                                {leaveRequests.length === 0 ? (
                                    <div className="text-center py-6 text-muted-foreground text-sm">No leave requests submitted yet.</div>
                                ) : (
                                    leaveRequests.map(lr => (
                                        <div key={lr.id} className={`p-3 rounded-xl border text-sm space-y-1.5 ${lr.status === 'approved' ? 'bg-green-500/10 border-green-500/30' : lr.status === 'rejected' ? 'bg-red-500/10 border-red-500/30' : 'bg-white/5 border-white/10'}`}>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-white/40 font-mono">{lr.startDate} → {lr.endDate}</span>
                                                <span className={`text-[10px] font-display font-bold tracking-widest uppercase px-2 py-0.5 rounded-full border flex items-center gap-1 ${lr.status === 'approved' ? 'bg-green-500/20 border-green-500/40 text-green-400' : lr.status === 'rejected' ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'bg-orange-500/20 border-orange-500/40 text-orange-400'}`}>
                                                    {lr.status === 'approved' ? <CheckCheck className="w-3 h-3" /> : lr.status === 'rejected' ? <XCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                                    {lr.status}
                                                </span>
                                            </div>
                                            <p className="text-xs text-white/70 italic">"{lr.reason}"</p>
                                            {lr.adminNote && (
                                                <p className="text-xs text-cyan-300/80 bg-cyan-500/10 rounded-lg p-2">Admin: {lr.adminNote}</p>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    ) : (
                        /* Password Tab */
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <form onSubmit={handleChangePassword} className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-display font-bold tracking-[0.2em] text-magenta-400 uppercase">Current Password</label>
                                    <input
                                        type="password"
                                        required
                                        value={passwordData.current}
                                        onChange={e => setPasswordData({ ...passwordData, current: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-magenta-500 focus:outline-none transition-all"
                                        placeholder="••••••••"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-display font-bold tracking-[0.2em] text-magenta-400 uppercase">New Password</label>
                                    <input
                                        type="password"
                                        required
                                        value={passwordData.new}
                                        onChange={e => setPasswordData({ ...passwordData, new: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-magenta-500 focus:outline-none transition-all"
                                        placeholder="••••••••"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-display font-bold tracking-[0.2em] text-magenta-400 uppercase">Confirm New Password</label>
                                    <input
                                        type="password"
                                        required
                                        value={passwordData.confirm}
                                        onChange={e => setPasswordData({ ...passwordData, confirm: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-magenta-500 focus:outline-none transition-all"
                                        placeholder="••••••••"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-3 rounded-xl bg-magenta-500 hover:bg-magenta-400 text-white font-display font-bold uppercase tracking-wider text-xs shadow-[0_0_15px_rgba(236,72,153,0.4)] transition-all disabled:opacity-50"
                                >
                                    {isLoading ? "Updating..." : "Update Password"}
                                </button>
                            </form>
                            <p className="text-[10px] text-center text-muted-foreground px-4">
                                If you have completely forgotten your password, please log out and use the "Forgot Password" option on the login screen to reset it using your registered phone number.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
