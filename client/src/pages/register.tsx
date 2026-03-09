import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { User, Phone, Home, Building, Lock, Eye, EyeOff, Key, UserPlus, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Register() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        fullName: "",
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

    useEffect(() => {
        const namePart = formData.fullName.replace(/[^a-zA-Z]/g, '').substring(0, 3).toLowerCase();
        const phonePart = formData.phoneNumber.replace(/\D/g, '').slice(-4);

        let generatedId = "";
        if (namePart.length > 0 && formData.phoneNumber.replace(/\D/g, '').length >= 4) {
            generatedId = `${namePart}${phonePart}`;
        }

        if (generatedId !== formData.userId) {
            setFormData(prev => ({ ...prev, userId: generatedId }));
        }
    }, [formData.fullName, formData.phoneNumber]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

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
                    fullName: formData.fullName,
                    userId: formData.userId,
                    phoneNumber: formData.phoneNumber,
                    roomNumber: formData.roomNumber,
                    hostelBlock: formData.hostelBlock,
                    password: formData.password,
                    role: "student"
                })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || "Failed to register.");
            }

            toast({
                title: "Registration Successful",
                description: "You can now log in using your auto-generated ID and password.",
                className: "bg-primary text-primary-foreground border-primary glow-cyan",
            });
            setLocation("/login");
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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 py-10">
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

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full mt-4 relative overflow-hidden group rounded-xl font-display font-bold text-base tracking-wide uppercase transition-all duration-300 transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {/* Button Background & Glow */}
                            <div className="absolute inset-0 bg-cyan-500/80 glow-cyan group-hover:bg-cyan-500 transition-colors"></div>

                            {/* Content */}
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
