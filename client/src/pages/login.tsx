import { useState } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { User, Lock, ArrowRight, ArrowLeft, Eye, EyeOff, KeyRound, Phone, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
    const [userId, setUserId] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<"login" | "forgot">("login");

    // Student self-reset fields
    const [studentResetId, setStudentResetId] = useState("");
    const [studentPhone, setStudentPhone] = useState("");
    const [studentNewPass, setStudentNewPass] = useState("");
    const [studentConfirmPass, setStudentConfirmPass] = useState("");

    const { toast } = useToast();
    const search = useSearch();
    const [, setLocation] = useLocation();

    const isParamsAdmin = search.includes("role=admin");
    const portalName = isParamsAdmin ? "Admin Portal" : "Student Portal";
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

    const handleStudentSelfReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!studentResetId || !studentPhone || !studentNewPass) {
            toast({ title: "Error", description: "All fields are required.", variant: "destructive" });
            return;
        }
        if (studentNewPass !== studentConfirmPass) {
            toast({ title: "Error", description: "Passwords do not match.", variant: "destructive" });
            return;
        }
        if (studentNewPass.length < 8) {
            toast({ title: "Error", description: "Password must be at least 8 characters.", variant: "destructive" });
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch("/api/student/self-reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: studentResetId,
                    phoneNumber: studentPhone,
                    newPassword: studentNewPass
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Failed to reset password.");
            }

            toast({ title: "Success", description: "Password reset successful. You can now log in.", className: "bg-green-600 text-white" });
            setStudentResetId(""); setStudentPhone(""); setStudentNewPass(""); setStudentConfirmPass("");
            setActiveTab("login");
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
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

                <div className="relative z-10 flex flex-col gap-6">
                    {/* Back button + Title */}
                    <div className="flex items-center gap-4">
                        <Link href="/">
                            <span className="p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer text-muted-foreground hover:text-white">
                                <ArrowLeft className="w-5 h-5" />
                            </span>
                        </Link>
                        <div className="flex-1 text-center pr-9">
                            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                                {activeTab === "login" ? "Log In" : "Forgot Password"}
                            </h1>
                            <p className={`font-display uppercase tracking-[0.2em] text-sm font-semibold ${isParamsAdmin ? 'text-magenta-400' : 'text-cyan-400'} mt-1`}>
                                {portalName}
                            </p>
                        </div>
                    </div>

                    {activeTab === "login" ? (
                        /* Login Form */
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
                                {!isParamsAdmin && (
                                    <div className="flex justify-end">
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab("forgot")}
                                            className="text-[11px] font-display font-bold tracking-widest uppercase text-muted-foreground hover:text-white transition-all flex items-center gap-1.5 group/forgot"
                                        >
                                            Forgot Password?
                                            <div className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px] group-hover/forgot:border-cyan-400 group-hover/forgot:text-cyan-400 transition-colors">?</div>
                                        </button>
                                    </div>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full relative overflow-hidden group rounded-xl font-display font-bold text-lg tracking-wide uppercase transition-all duration-300 transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                <div className={`absolute inset-0 transition-colors ${buttonBgClass}`}></div>
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
                    ) : (
                        /* Forgot Password Panel */
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            {/* Student: Self-Reset Form (Admins don't have forgot password option) */}
                            <form onSubmit={handleStudentSelfReset} className="space-y-4">
                                <div className="flex items-center gap-2 p-3 rounded-xl bg-cyan-400/10 border border-cyan-400/30 mb-2">
                                    <KeyRound className="w-4 h-4 text-cyan-400 shrink-0" />
                                    <p className="text-[10px] text-cyan-200/80 leading-relaxed">Verification: Enter your User ID and the <span className="text-cyan-400 font-bold">registered Phone Number</span> to reset your password.</p>
                                </div>

                                <div className="space-y-3">
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <input
                                            type="text"
                                            value={studentResetId}
                                            onChange={e => setStudentResetId(e.target.value)}
                                            placeholder="Your User ID"
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-3 text-sm text-white focus:border-cyan-400 outline-none transition-all placeholder:text-muted-foreground/50"
                                            required
                                        />
                                    </div>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <input
                                            type="text"
                                            value={studentPhone}
                                            onChange={e => setStudentPhone(e.target.value)}
                                            placeholder="Registered Phone Number"
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-3 text-sm text-white focus:border-cyan-400 outline-none transition-all placeholder:text-muted-foreground/50"
                                            required
                                        />
                                    </div>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={studentNewPass}
                                            onChange={e => setStudentNewPass(e.target.value)}
                                            placeholder="New Password (min 8 chars)"
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-12 text-sm text-white focus:border-cyan-400 outline-none transition-all placeholder:text-muted-foreground/50"
                                            required
                                            minLength={8}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-muted-foreground hover:text-white transition-colors"
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <CheckCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={studentConfirmPass}
                                            onChange={e => setStudentConfirmPass(e.target.value)}
                                            placeholder="Confirm New Password"
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-12 text-sm text-white focus:border-cyan-400 outline-none transition-all placeholder:text-muted-foreground/50"
                                            required
                                            minLength={8}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-muted-foreground hover:text-white transition-colors"
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-display font-bold uppercase tracking-wider text-xs shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-all disabled:opacity-50 mt-4"
                                >
                                    {isLoading ? "Resetting..." : "Reset Password"}
                                </button>
                                
                                <button
                                    type="button"
                                    onClick={() => setActiveTab("login")}
                                    className="w-full py-2 text-xs text-muted-foreground hover:text-white transition-colors font-display uppercase tracking-widest mt-2"
                                >
                                    Back to Login
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
