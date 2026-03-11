import { useState } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { User, Lock, ArrowRight, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
export default function Login() {
    const [userId, setUserId] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const search = useSearch();
    const [, setLocation] = useLocation();

    const isParamsAdmin = search.includes("role=admin");
    const portalName = isParamsAdmin ? "Admin Portal" : "Student Portal";
    const glowClass = isParamsAdmin ? "glow-magenta text-magenta-500" : "glow-cyan text-cyan-400";
    const focusClass = isParamsAdmin ? "focus:glow-magenta group-focus-within:text-magenta-400" : "focus:glow-cyan group-focus-within:text-cyan-400";
    const buttonBgClass = isParamsAdmin ? "bg-magenta-500/80 glow-magenta group-hover:bg-magenta-500" : "bg-cyan-500/80 glow-cyan group-hover:bg-cyan-500";

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!userId || password.length < 8) {
            toast({
                title: "Access Denied",
                description: "Please enter valid credentials.",
                variant: "destructive",
            });
            return;
        }

        setIsLoading(true);

        try {
            const res = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, password, role: isParamsAdmin ? "admin" : "student" })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || "Invalid credentials");
            }

            const userData = await res.json();
            localStorage.setItem("user", JSON.stringify(userData));

            toast({
                title: "Login Successful",
                description: `Welcome to the ${portalName}.`,
                className: isParamsAdmin ? "bg-primary text-primary-foreground border-primary glow-magenta" : "bg-primary text-primary-foreground border-primary glow-cyan",
            });

            if (userData.role === "admin") {
                setLocation("/admin-dashboard");
            } else {
                setLocation("/dashboard");
            }
        } catch (err: any) {
            toast({
                title: "Login Failed",
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

            <div className="glass-card w-full max-w-md p-8 sm:p-10 z-10 animate-in fade-in zoom-in duration-700 relative overflow-hidden">
                {/* Neon Edge Highlight */}
                <div className="absolute inset-0 border border-secondary/30 rounded-2xl pointer-events-none" style={{
                    background: `linear-gradient(135deg, ${isParamsAdmin ? 'hsl(330, 81%, 60%, 0.1)' : 'hsl(188, 86%, 53%, 0.1)'} 0%, transparent 50%, hsl(var(--primary) / 0.1) 100%)`
                }}></div>

                <div className="relative z-10 flex flex-col gap-8">
                    <div className="flex items-center gap-4">
                        <Link href="/">
                            <span className="p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer text-muted-foreground hover:text-white">
                                <ArrowLeft className="w-5 h-5" />
                            </span>
                        </Link>
                        <div className="flex-1 text-center pr-9">
                            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                                Log In
                            </h1>
                            <p className={`font-display uppercase tracking-[0.2em] text-sm font-semibold ${isParamsAdmin ? 'text-magenta-400' : 'text-cyan-400'} mt-1`}>
                                {portalName}
                            </p>
                        </div>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-4">
                            <div className="relative group">
                                <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-secondary/70 transition-colors ${focusClass}`}>
                                    <User className="w-5 h-5" />
                                </div>
                                <input
                                    type="text"
                                    value={userId}
                                    onChange={(e) => setUserId(e.target.value)}
                                    className={`glass-input w-full pl-12 pr-4 py-3 sm:py-4 rounded-xl font-medium text-lg placeholder:text-muted-foreground/50 transition-all ${isParamsAdmin ? 'focus:glow-magenta' : 'focus:glow-cyan'}`}
                                    placeholder="Enter User ID"
                                    required
                                />
                            </div>

                            <div className="relative group">
                                <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-secondary/70 transition-colors ${focusClass}`}>
                                    <Lock className="w-5 h-5" />
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className={`glass-input w-full pl-12 pr-12 py-3 sm:py-4 rounded-xl font-medium text-lg placeholder:text-muted-foreground/50 transition-all ${isParamsAdmin ? 'focus:glow-magenta' : 'focus:glow-cyan'}`}
                                    placeholder="Min 8 characters"
                                    required
                                    minLength={8}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-muted-foreground hover:text-white transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full relative overflow-hidden group rounded-xl font-display font-bold text-lg tracking-wide uppercase transition-all duration-300 transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {/* Button Background & Glow */}
                            <div className={`absolute inset-0 transition-colors ${buttonBgClass}`}></div>

                            {/* Content */}
                            <div className="relative py-4 px-6 flex items-center justify-center gap-3 text-white">
                                {isLoading ? (
                                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <span>Authenticate</span>
                                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </div>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
