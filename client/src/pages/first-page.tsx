import { Link } from "wouter";
import { User, ShieldUser, UserPlus } from "lucide-react";

export default function FirstPage() {
    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            {/* Background Orbs */}
            <div className="bg-orb orb-1"></div>
            <div className="bg-orb orb-2"></div>
            <div className="bg-orb orb-3"></div>

            <div className="glass-card w-full max-w-lg p-8 sm:p-10 z-10 animate-in fade-in zoom-in duration-700 relative overflow-hidden">
                {/* Neon Edge Highlight */}
                <div className="absolute inset-0 border border-secondary/30 rounded-2xl pointer-events-none" style={{
                    background: "linear-gradient(135deg, hsl(var(--secondary) / 0.1) 0%, transparent 50%, hsl(var(--primary) / 0.1) 100%)"
                }}></div>

                <div className="relative z-10 flex flex-col gap-8 text-center">
                    <div className="space-y-3">
                        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">
                            Welcome to Hostel Hub
                        </h1>
                        <p className="text-muted-foreground font-medium uppercase tracking-widest text-sm">
                            Please select your portal
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Link href="/login?role=student">
                            <span className="glass-panel p-6 rounded-xl flex flex-col items-center justify-center gap-4 hover:border-cyan-500/50 hover:bg-white/5 transition-all group cursor-pointer focus:glow-cyan border border-white/5">
                                <div className="p-4 rounded-full bg-cyan-500/10 text-cyan-400 group-hover:scale-110 transition-transform">
                                    <User className="w-8 h-8" />
                                </div>
                                <span className="font-display font-semibold text-lg tracking-wide text-white">Student Portal</span>
                            </span>
                        </Link>

                        <Link href="/login?role=admin">
                            <span className="glass-panel p-6 rounded-xl flex flex-col items-center justify-center gap-4 hover:border-magenta-500/50 hover:bg-white/5 transition-all group cursor-pointer focus:glow-magenta border border-white/5">
                                <div className="p-4 rounded-full bg-magenta-500/10 text-magenta-400 group-hover:scale-110 transition-transform">
                                    <ShieldUser className="w-8 h-8" />
                                </div>
                                <span className="font-display font-semibold text-lg tracking-wide text-white">Admin Portal</span>
                            </span>
                        </Link>
                    </div>

                    <div className="pt-6 border-t border-white/10">
                        <p className="text-muted-foreground text-sm mb-4">Don't have an account?</p>
                        <Link href="/register">
                            <span className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all font-display font-semibold tracking-wide text-white cursor-pointer w-full sm:w-auto">
                                <UserPlus className="w-5 h-5" />
                                <span>Register Now</span>
                            </span>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
