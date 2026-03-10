import { useState, useEffect } from "react";
import { UtensilsCrossed, ArrowRight, LogOut, CheckCircle, Sunrise, Sunset, AlertTriangle, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

type SettingsData = {
    breakfastStart: string;
    breakfastEnd: string;
    dinnerStart: string;
    dinnerEnd: string;
};

export default function Dashboard() {
    const [isLoading, setIsLoading] = useState(false);
    const [settings, setSettings] = useState<SettingsData | null>(null);
    const [absentMode, setAbsentMode] = useState(false);
    const [absentReason, setAbsentReason] = useState("");
    const [selectedAbsentMeal, setSelectedAbsentMeal] = useState<"breakfast" | "dinner" | null>(null);
    const [messages, setMessages] = useState<{ breakfast?: string, dinner?: string }>({});
    const { toast } = useToast();

    useEffect(() => {
        fetch("/api/settings").then(res => res.json()).then(data => setSettings(data)).catch(err => console.error(err));
    }, []);

    const hourStr = new Date().getHours().toString().padStart(2, '0') + ':' + new Date().getMinutes().toString().padStart(2, '0');

    let isBreakfastOpen = false;
    let isDinnerOpen = false;

    if (settings) {
        if (hourStr >= settings.breakfastStart && hourStr <= settings.breakfastEnd) isBreakfastOpen = true;
        if (hourStr >= settings.dinnerStart && hourStr <= settings.dinnerEnd) isDinnerOpen = true;
    }

    const handleAttendance = async (mealType: "breakfast" | "dinner", status: "present" | "absent" = "present") => {
        const storedUser = localStorage.getItem("user");
        if (!storedUser) {
            toast({ title: "Error", description: "You are not logged in.", variant: "destructive" });
            return;
        }

        if (status === "absent" && !absentMode) {
            setAbsentMode(true);
            setSelectedAbsentMeal(mealType);
            return;
        }

        if (status === "absent" && absentMode && !absentReason.trim()) {
            toast({ title: "Reason Required", description: "Please provide a reason for your absence.", variant: "destructive" });
            return;
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
                setSelectedAbsentMeal(null);
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

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            {/* Background Orbs */}
            <div className="bg-orb orb-1 fixed"></div>
            <div className="bg-orb orb-2 fixed"></div>
            <div className="bg-orb orb-3 fixed"></div>

            {/* Main Login Container */}
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

                <div className="relative z-10 flex flex-col gap-8">
                    {/* Header */}
                    <div className="text-center space-y-2">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary/10 text-secondary glow-cyan mb-4">
                            <UtensilsCrossed className="w-8 h-8" />
                        </div>
                        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">
                            Hostel Hub
                        </h1>
                        <p className="font-display text-primary uppercase tracking-[0.2em] text-sm font-semibold text-glow">
                            Student Portal
                        </p>
                    </div>

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
                                    <CheckCircle className="w-4 h-4" /> REASON LOGGED
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleAttendance("breakfast", "present")}
                                        disabled={isLoading || !isBreakfastOpen}
                                        className={`flex-1 overflow-hidden relative group rounded-xl font-display font-bold text-xs tracking-wide uppercase py-3 transition-colors ${isBreakfastOpen ? 'bg-cyan-500 hover:bg-cyan-400 text-white shadow-[0_0_15px_rgba(34,211,238,0.4)]' : 'bg-white/5 text-muted-foreground cursor-not-allowed'
                                            }`}
                                    >
                                        I AM PRESENT
                                    </button>
                                    <button
                                        onClick={() => handleAttendance("breakfast", "absent")}
                                        disabled={isLoading}
                                        className={`flex-1 overflow-hidden relative group rounded-xl font-display font-bold text-xs tracking-wide uppercase py-3 transition-colors ${absentMode && selectedAbsentMeal === "breakfast" ? 'bg-yellow-500/30 text-yellow-100 border border-yellow-500/50' : 'bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                                            }`}
                                    >
                                        I AM ABSENT
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
                                        className={`flex-1 overflow-hidden relative group rounded-xl font-display font-bold text-xs tracking-wide uppercase py-3 transition-colors ${isDinnerOpen ? 'bg-magenta-500 hover:bg-magenta-400 text-white shadow-[0_0_15px_rgba(236,72,153,0.4)]' : 'bg-white/5 text-muted-foreground cursor-not-allowed'
                                            }`}
                                    >
                                        I AM PRESENT
                                    </button>
                                    <button
                                        onClick={() => handleAttendance("dinner", "absent")}
                                        disabled={isLoading}
                                        className={`flex-1 overflow-hidden relative group rounded-xl font-display font-bold text-xs tracking-wide uppercase py-3 transition-colors ${absentMode && selectedAbsentMeal === "dinner" ? 'bg-yellow-500/30 text-yellow-100 border border-yellow-500/50' : 'bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                                            }`}
                                    >
                                        I AM ABSENT
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Absent Reason Form */}
                        {absentMode && (
                            <div className="p-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/5 animate-in fade-in zoom-in-95 duration-300 flex flex-col gap-3 relative mt-4">
                                <button onClick={() => setAbsentMode(false)} className="absolute top-3 right-3 text-muted-foreground hover:text-white transition">
                                    <X className="w-4 h-4" />
                                </button>

                                <div className="flex items-center gap-2 text-yellow-400">
                                    <AlertTriangle className="w-4 h-4" />
                                    <label className="text-sm font-display tracking-widest font-bold">REASON FOR ABSENCE ({selectedAbsentMeal?.toUpperCase()})</label>
                                </div>
                                <textarea
                                    value={absentReason}
                                    onChange={(e) => setAbsentReason(e.target.value)}
                                    placeholder={`Please provide a valid reason for missing ${selectedAbsentMeal}...`}
                                    className="w-full p-3 rounded-xl bg-white/5 border border-yellow-500/30 text-white placeholder:text-muted-foreground focus:outline-none focus:border-yellow-500 focus:shadow-[0_0_15px_rgba(234,179,8,0.3)] resize-none min-h-[100px]"
                                />
                                <button
                                    onClick={() => selectedAbsentMeal && handleAttendance(selectedAbsentMeal, "absent")}
                                    disabled={isLoading || !absentReason.trim()}
                                    className="w-full py-3 rounded-xl bg-yellow-500 text-black font-display font-bold uppercase tracking-wider text-sm hover:bg-yellow-400 hover:shadow-[0_0_15px_rgba(234,179,8,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? "Submitting..." : "Confirm Absence"}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
