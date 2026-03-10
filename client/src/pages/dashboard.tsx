import { useState } from "react";
import { UtensilsCrossed, ArrowRight, LogOut, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

export default function Dashboard() {
    const [isLoading, setIsLoading] = useState(false);
    const [marked, setMarked] = useState(false);
    const [message, setMessage] = useState("");
    const [absentMode, setAbsentMode] = useState(false);
    const [absentReason, setAbsentReason] = useState("");
    const { toast } = useToast();

    const hour = new Date().getHours();
    let windowText = "CURRENTLY OUTSIDE OF ATTENDANCE WINDOW";
    let buttonText = "MARK ATTENDANCE";
    let isWindowOpen = false;

    if (hour >= 6 && hour < 9) {
        windowText = "BREAKFAST WINDOW: 6:00 AM - 9:00 AM";
        buttonText = "MARK BREAKFAST ATTENDANCE";
        isWindowOpen = true;
    } else if (hour >= 18 && hour < 22) {
        windowText = "DINNER WINDOW: 6:00 PM - 10:00 PM";
        buttonText = "MARK DINNER ATTENDANCE";
        isWindowOpen = true;
    }

    const handleAttendance = async (e: React.FormEvent, status: "present" | "absent" = "present") => {
        e.preventDefault();
        if (marked || !isWindowOpen) return;

        if (status === "absent" && !absentMode) {
            setAbsentMode(true);
            return;
        }

        if (status === "absent" && absentMode && !absentReason.trim()) {
            toast({ title: "Reason Required", description: "Please provide a reason for your absence.", variant: "destructive" });
            return;
        }

        const storedUser = localStorage.getItem("user");
        if (!storedUser) {
            toast({ title: "Error", description: "You are not logged in.", variant: "destructive" });
            return;
        }

        const user = JSON.parse(storedUser);
        setIsLoading(true);

        try {
            const res = await fetch("/api/attendance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: user.userId, status, absentReason: status === "absent" ? absentReason : undefined })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || "Failed to mark attendance.");
            }

            const data = await res.json();
            setMarked(true);
            setMessage(data.message);
            toast({
                title: "Attendance Confirmed",
                description: data.message,
                className: "bg-primary text-primary-foreground border-primary glow-cyan",
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
            <div className="bg-orb orb-1"></div>
            <div className="bg-orb orb-2"></div>
            <div className="bg-orb orb-3"></div>

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
                            Daily Check-in
                        </p>
                    </div>

                    {/* Action */}
                    <div className="space-y-4">
                        {!absentMode ? (
                            <>
                                <button
                                    onClick={(e) => handleAttendance(e, "present")}
                                    disabled={isLoading || marked || !isWindowOpen}
                                    className={`w-full relative overflow-hidden group rounded-xl font-display font-bold text-lg tracking-wide uppercase transition-all duration-300 transform active:scale-[0.98] ${marked ? 'disabled:opacity-100 disabled:cursor-default' : (!isWindowOpen ? 'disabled:opacity-50 disabled:cursor-not-allowed hidden' : 'disabled:opacity-70 disabled:cursor-not-allowed')}`}
                                >
                                    {/* Button Background & Glow */}
                                    <div className={`absolute inset-0 transition-colors ${marked ? 'bg-green-500/80 glow-green' : 'bg-cyan-500/80 glow-cyan group-hover:bg-cyan-500'}`}></div>

                                    {/* Content */}
                                    <div className="relative py-4 px-6 flex items-center justify-center gap-3 text-white">
                                        {isLoading ? (
                                            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        ) : marked ? (
                                            <>
                                                <CheckCircle className="w-5 h-5" />
                                                <span>{message || "Attendance Recorded"}</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>{buttonText}</span>
                                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                            </>
                                        )}
                                    </div>
                                </button>

                                {!marked && isWindowOpen && (
                                    <button
                                        onClick={(e) => handleAttendance(e, "absent")}
                                        disabled={isLoading}
                                        className="w-full relative overflow-hidden group rounded-xl font-display font-bold text-sm tracking-wide uppercase transition-all duration-300 transform active:scale-[0.98] bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 hover:border-red-500 text-red-100 py-3 flex items-center justify-center"
                                    >
                                        Mark Absent
                                    </button>
                                )}
                            </>
                        ) : (
                            <div className="animate-in fade-in zoom-in-95 duration-300 flex flex-col gap-3">
                                <label className="text-sm font-display tracking-widest text-red-200">REASON FOR ABSENCE</label>
                                <textarea
                                    value={absentReason}
                                    onChange={(e) => setAbsentReason(e.target.value)}
                                    placeholder="Please provide a valid reason..."
                                    className="w-full p-3 rounded-xl bg-white/5 border border-red-500/30 text-white placeholder:text-muted-foreground focus:outline-none focus:border-red-500 focus:glow-red resize-none min-h-[100px]"
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setAbsentMode(false)}
                                        className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-display uppercase tracking-wider text-sm transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={(e) => handleAttendance(e, "absent")}
                                        disabled={isLoading}
                                        className="flex-[2] py-3 rounded-xl bg-red-500 text-white font-display uppercase tracking-wider text-sm hover:bg-red-600 transition-colors glow-red"
                                    >
                                        {isLoading ? "Submitting..." : "Confirm Absence"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Time Display */}
                    <div className="pt-4 border-t border-white/10 flex items-center justify-center gap-3 text-muted-foreground">
                        <UtensilsCrossed className="w-4 h-4 text-secondary/70" />
                        <span className="font-display tracking-widest text-sm">
                            {windowText}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
