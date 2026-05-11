import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { User, Phone, Home, Building, Lock, Eye, EyeOff, Key, UserPlus, ArrowLeft, Mail, ShieldCheck, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import FingerprintJS from '@fingerprintjs/fingerprintjs';

export default function Register() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        userId: "",
        phoneNumber: "",
        roomNumber: "",
        hostelBlock: "",
        password: "",
        confirmPassword: "",
    });

    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [deviceFingerprint, setDeviceFingerprint] = useState("");
    const [captchaToken, setCaptchaToken] = useState("");
    
    const [step, setStep] = useState<"register" | "otp">("register");
    const [otp, setOtp] = useState("");
    const [resendTimer, setResendTimer] = useState(0);

    useEffect(() => {
        const loadFingerprint = async () => {
            try {
                const fp = await FingerprintJS.load();
                const result = await fp.get();
                setDeviceFingerprint(result.visitorId);
            } catch (e) {
                console.error("Fingerprint collection failed", e);
            }
        };
        loadFingerprint();
    }, []);

    useEffect(() => {
        if (resendTimer > 0) {
            const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendTimer]);

    useEffect(() => {
        const namePart = formData.fullName.trim().split(" ")[0].substring(0, 3).toUpperCase();
        const phonePart = formData.phoneNumber.replace(/\D/g, '').slice(-3);

        let generatedId = "";
        if (namePart.length > 0 && formData.phoneNumber.replace(/\D/g, '').length >= 3) {
            generatedId = `${namePart}${phonePart}`;
        }

        if (generatedId !== formData.userId) {
            setFormData(prev => ({ ...prev, userId: generatedId }));
        }
    }, [formData.fullName, formData.phoneNumber]);

    // Turnstile Callback
    useEffect(() => {
        (window as any).onTurnstileSuccess = (token: string) => {
            setCaptchaToken(token);
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!captchaToken) {
            toast({
                title: "Security Check Required",
                description: "Please complete the CAPTCHA.",
                variant: "destructive",
            });
            return;
        }

        if (formData.password.length < 8) {
            toast({
                title: "Invalid Password",
                description: "Password must be at least 8 characters.",
                variant: "destructive",
            });
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            toast({
                title: "Password Mismatch",
                description: "Passwords do not match.",
                variant: "destructive",
            });
            return;
        }

        setIsLoading(true);

        try {
            const res = await fetch("/api/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    deviceFingerprint,
                    captchaToken,
                    role: "student"
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Failed to register.");

            toast({
                title: "OTP Sent",
                description: "Please check your email for the verification code.",
                className: "bg-primary text-primary-foreground border-primary glow-cyan",
            });
            setStep("otp");
        } catch (err: any) {
            toast({
                title: "Registration Failed",
                description: err.message,
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const res = await fetch("/api/verify-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: formData.userId, otp })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Invalid OTP.");

            toast({
                title: "Email Verified",
                description: "Your account is now pending admin approval. You can log in once approved.",
                className: "bg-primary text-primary-foreground border-primary glow-cyan",
            });
            setLocation("/login");
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

    const handleResendOtp = async () => {
        if (resendTimer > 0) return;
        
        try {
            const res = await fetch("/api/resend-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: formData.userId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            
            toast({ title: "OTP Resent", description: "A new code has been sent to your email." });
            setResendTimer(60);
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    if (step === "otp") {
        return (
            <div className="min-h-[100dvh] flex items-center justify-center p-4">
                <div className="bg-orb orb-1"></div>
                <div className="glass-card w-full max-w-md p-8 z-10 text-center flex flex-col gap-6 animate-in fade-in zoom-in duration-300">
                    <div className="mx-auto w-16 h-16 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                        <Mail className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-2">Verify Your Email</h1>
                        <p className="text-muted-foreground text-sm">We've sent a 6-digit code to <br /><span className="text-white font-medium">{formData.email}</span></p>
                    </div>

                    <form onSubmit={handleVerifyOtp} className="space-y-6">
                        <input
                            type="text"
                            maxLength={6}
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                            className="glass-input w-full text-center text-3xl tracking-[0.5rem] py-4 rounded-xl font-bold text-white transition-all focus:glow-cyan"
                            placeholder="000000"
                            required
                        />

                        <div className="flex flex-col gap-4">
                            <button
                                type="submit"
                                disabled={isLoading || otp.length !== 6}
                                className="w-full relative overflow-hidden group rounded-xl font-bold py-3.5 text-white disabled:opacity-50 transition-all hover:scale-[1.02]"
                            >
                                <div className="absolute inset-0 bg-cyan-500/80 glow-cyan"></div>
                                <span className="relative flex items-center justify-center gap-2">
                                    {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                                    Verify Code
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={handleResendOtp}
                                disabled={resendTimer > 0}
                                className="text-sm text-cyan-400 hover:text-cyan-300 disabled:text-muted-foreground transition-colors"
                            >
                                {resendTimer > 0 ? `Resend code in ${resendTimer}s` : "Didn't receive code? Resend"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[100dvh] flex items-center justify-center p-4 py-10">
            {/* Background Orbs */}
            <div className="bg-orb orb-1"></div>
            <div className="bg-orb orb-2"></div>
            <div className="bg-orb orb-3"></div>

            <div className="glass-card w-full max-w-xl p-6 sm:p-10 z-10 animate-in fade-in slide-in-from-bottom-8 duration-700 relative overflow-hidden">
                {/* Neon Edge Highlight */}
                <div className="absolute inset-0 border border-secondary/30 rounded-2xl pointer-events-none" style={{
                    background: "linear-gradient(135deg, hsl(var(--primary) / 0.1) 0%, transparent 50%, hsl(var(--secondary) / 0.1) 100%)"
                }}></div>

                <div className="relative z-10 flex flex-col gap-6">
                    <div className="flex items-center gap-4">
                        <Link href="/">
                            <span className="p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer text-muted-foreground hover:text-white">
                                <ArrowLeft className="w-5 h-5" />
                            </span>
                        </Link>
                        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                            Create Account
                        </h1>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="relative group col-span-1 sm:col-span-2">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-secondary/70 group-focus-within:text-cyan-400 transition-colors">
                                    <User className="w-5 h-5" />
                                </div>
                                <input
                                    type="text"
                                    name="fullName"
                                    value={formData.fullName}
                                    onChange={handleChange}
                                    className="glass-input w-full pl-12 pr-4 py-3 sm:py-3.5 rounded-xl font-medium text-[15px] placeholder:text-muted-foreground/50 transition-all focus:glow-cyan"
                                    placeholder="Full Name"
                                    required
                                />
                            </div>

                            <div className="relative group col-span-1 sm:col-span-2">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-secondary/70 group-focus-within:text-cyan-400 transition-colors">
                                    <Mail className="w-5 h-5" />
                                </div>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="glass-input w-full pl-12 pr-4 py-3 sm:py-3.5 rounded-xl font-medium text-[15px] placeholder:text-muted-foreground/50 transition-all focus:glow-cyan"
                                    placeholder="Hostel Email Address"
                                    required
                                />
                            </div>

                            <div className="relative group col-span-1 sm:col-span-2">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-secondary/70 group-focus-within:text-cyan-400 transition-colors">
                                    <Key className="w-5 h-5" />
                                </div>
                                <input
                                    type="text"
                                    name="userId"
                                    value={formData.userId}
                                    onChange={handleChange}
                                    className="glass-input w-full pl-12 pr-4 py-3 sm:py-3.5 rounded-xl font-medium text-[15px] placeholder:text-muted-foreground/50 transition-all focus:glow-cyan bg-secondary/5 cursor-not-allowed"
                                    placeholder="Auto-generated User ID"
                                    readOnly
                                    required
                                />
                            </div>

                            <div className="relative group col-span-1 sm:col-span-2">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-secondary/70 group-focus-within:text-cyan-400 transition-colors">
                                    <Phone className="w-5 h-5" />
                                </div>
                                <input
                                    type="tel"
                                    name="phoneNumber"
                                    value={formData.phoneNumber}
                                    onChange={handleChange}
                                    className="glass-input w-full pl-12 pr-4 py-3 sm:py-3.5 rounded-xl font-medium text-[15px] placeholder:text-muted-foreground/50 transition-all focus:glow-cyan"
                                    placeholder="Phone Number"
                                    required
                                />
                            </div>

                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-secondary/70 group-focus-within:text-cyan-400 transition-colors">
                                    <Home className="w-5 h-5" />
                                </div>
                                <input
                                    type="text"
                                    name="roomNumber"
                                    value={formData.roomNumber}
                                    onChange={handleChange}
                                    className="glass-input w-full pl-12 pr-4 py-3 sm:py-3.5 rounded-xl font-medium text-[15px] placeholder:text-muted-foreground/50 transition-all focus:glow-cyan"
                                    placeholder="Room Number"
                                    required
                                />
                            </div>

                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-secondary/70 group-focus-within:text-cyan-400 transition-colors">
                                    <Building className="w-5 h-5" />
                                </div>
                                <input
                                    type="text"
                                    name="hostelBlock"
                                    value={formData.hostelBlock}
                                    onChange={handleChange}
                                    className="glass-input w-full pl-12 pr-4 py-3 sm:py-3.5 rounded-xl font-medium text-[15px] placeholder:text-muted-foreground/50 transition-all focus:glow-cyan"
                                    placeholder="Hostel Block/Building"
                                    required
                                />
                            </div>

                            <div className="relative group col-span-1 sm:col-span-2">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-secondary/70 group-focus-within:text-cyan-400 transition-colors">
                                    <Lock className="w-5 h-5" />
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="glass-input w-full pl-12 pr-12 py-3 sm:py-3.5 rounded-xl font-medium text-[15px] placeholder:text-muted-foreground/50 transition-all focus:glow-cyan"
                                    placeholder="Min 8 Characters"
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

                            <div className="relative group col-span-1 sm:col-span-2">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-secondary/70 group-focus-within:text-cyan-400 transition-colors">
                                    <Lock className="w-5 h-5" />
                                </div>
                                <input
                                    type={showConfirmPassword ? "text" : "password"}
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    className="glass-input w-full pl-12 pr-12 py-3 sm:py-3.5 rounded-xl font-medium text-[15px] placeholder:text-muted-foreground/50 transition-all focus:glow-cyan"
                                    placeholder="Confirm Password"
                                    required
                                    minLength={8}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-muted-foreground hover:text-white transition-colors"
                                >
                                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                        
                        {/* CAPTCHA Widget */}
                        <div className="flex justify-center my-4 overflow-hidden rounded-xl">
                            <div 
                                className="cf-turnstile" 
                                data-sitekey="1x00000000000000000000AA" 
                                data-callback="onTurnstileSuccess"
                                data-theme="dark"
                            ></div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full mt-4 relative overflow-hidden group rounded-xl font-display font-bold text-base tracking-wide uppercase transition-all duration-300 transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            <div className="absolute inset-0 bg-cyan-500/80 glow-cyan group-hover:bg-cyan-500 transition-colors"></div>
                            <div className="relative py-3.5 px-6 flex items-center justify-center gap-3 text-white">
                                {isLoading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <UserPlus className="w-5 h-5" />
                                        <span>Complete Registration</span>
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
