import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, KeyRound, Phone } from "lucide-react";

export default function VerifyOtp() {
    const [otp, setOtp] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    
    // We get the user info from localStorage to know who is verifying
    const userStr = localStorage.getItem("user");
    const user = userStr ? JSON.parse(userStr) : null;

    useEffect(() => {
        if (!user) {
            setLocation("/login");
        } else if (user.isVerified) {
            if (user.role === "admin") setLocation("/admin-dashboard");
            else setLocation("/dashboard");
        } else {
            sendOtp();
        }
    }, []);

    const sendOtp = async () => {
        if (!user) return;
        setIsSending(true);
        try {
            const res = await fetch("/api/send-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: user.userId })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || "Failed to send OTP");
            }

            toast({
                title: "OTP Sent",
                description: `A 6-digit OTP has been sent to your registered mobile number (${user.phoneNumber}).`,
                className: "bg-primary text-primary-foreground border-primary glow-cyan",
            });
        } catch (err: any) {
            toast({
                title: "Error",
                description: err.message,
                variant: "destructive"
            });
        } finally {
            setIsSending(false);
        }
    };

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!otp || otp.length !== 6) {
            toast({
                title: "Invalid OTP",
                description: "Please enter the 6-digit OTP.",
                variant: "destructive",
            });
            return;
        }

        setIsLoading(true);

        try {
            const res = await fetch("/api/verify-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: user.userId, otp })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || "Invalid OTP");
            }

            const data = await res.json();
            
            // Update local storage with verified user
            localStorage.setItem("user", JSON.stringify(data.user));

            toast({
                title: "Verification Successful",
                description: "Your account is now verified.",
                className: "bg-primary text-primary-foreground border-primary glow-cyan",
            });

            setLocation("/dashboard");
        } catch (err: any) {
            toast({
                title: "Verification Failed",
                description: err.message,
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    if (!user) return null;

    return (
        <div className="min-h-[100dvh] flex items-center justify-center p-4">
            <div className="bg-orb orb-1"></div>
            <div className="bg-orb orb-2"></div>
            <div className="bg-orb orb-3"></div>

            <div className="glass-card w-full max-w-md p-8 sm:p-10 z-10 animate-in fade-in zoom-in duration-700 relative overflow-hidden">
                <div className="absolute inset-0 border border-secondary/30 rounded-2xl pointer-events-none" style={{
                    background: `linear-gradient(135deg, hsl(188, 86%, 53%, 0.1) 0%, transparent 50%, hsl(var(--primary) / 0.1) 100%)`
                }}></div>

                <div className="relative z-10 flex flex-col gap-6">
                    <div className="text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-cyan-500/20 text-cyan-400 mb-4 ring-1 ring-cyan-500/50">
                            <Phone className="w-8 h-8" />
                        </div>
                        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                            Verify OTP
                        </h1>
                        <p className="text-muted-foreground mt-2 text-sm">
                            We have sent a verification code to your registered mobile number <span className="font-bold text-white">{user.phoneNumber}</span>.
                        </p>
                    </div>

                    <form onSubmit={handleVerify} className="space-y-6">
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-secondary/70 transition-colors focus:glow-cyan group-focus-within:text-cyan-400">
                                <KeyRound className="w-5 h-5" />
                            </div>
                            <input
                                type="text"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                className="glass-input w-full pl-12 pr-4 py-3 sm:py-4 rounded-xl font-medium text-lg placeholder:text-muted-foreground/50 transition-all focus:glow-cyan text-center tracking-[0.5em]"
                                placeholder="------"
                                maxLength={6}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full relative overflow-hidden group rounded-xl font-display font-bold text-lg tracking-wide uppercase transition-all duration-300 transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            <div className="absolute inset-0 transition-colors bg-cyan-500/80 glow-cyan group-hover:bg-cyan-500"></div>
                            <div className="relative py-4 px-6 flex items-center justify-center gap-3 text-white">
                                {isLoading ? (
                                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <span>Verify</span>
                                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </div>
                        </button>

                        <div className="text-center mt-4">
                            <button
                                type="button"
                                onClick={sendOtp}
                                disabled={isSending}
                                className="text-sm font-display text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50"
                            >
                                {isSending ? "Sending..." : "Didn't receive the OTP? Resend"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
