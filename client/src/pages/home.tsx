import { useState } from "react";
import { User, Lock, UtensilsCrossed, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleAttendance = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!studentId || password.length < 8) {
      toast({
        title: "Access Denied",
        description: "Please enter valid credentials.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      toast({
        title: "Attendance Confirmed",
        description: "Dinner attendance recorded successfully.",
        className: "bg-primary text-primary-foreground border-primary glow-magenta",
      });
      setStudentId("");
      setPassword("");
    }, 1500);
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

          {/* Form */}
          <form onSubmit={handleAttendance} className="space-y-5">
            <div className="space-y-4">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-secondary/70 group-focus-within:text-secondary transition-colors">
                  <User className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="glass-input w-full pl-12 pr-4 py-3 sm:py-4 rounded-xl font-medium text-lg placeholder:text-muted-foreground/50 transition-all focus:glow-cyan"
                  placeholder="Enter ID (e.g., rah3210)"
                  data-testid="input-student-id"
                  required
                />
              </div>

              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-secondary/70 group-focus-within:text-secondary transition-colors">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="glass-input w-full pl-12 pr-4 py-3 sm:py-4 rounded-xl font-medium text-lg placeholder:text-muted-foreground/50 transition-all focus:glow-cyan"
                  placeholder="Must be 8 characters"
                  data-testid="input-password"
                  required
                  minLength={8}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full relative overflow-hidden group rounded-xl font-display font-bold text-lg tracking-wide uppercase transition-all duration-300 transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
              data-testid="button-mark-attendance"
            >
              {/* Button Background & Glow */}
              <div className="absolute inset-0 bg-primary/80 glow-magenta group-hover:bg-primary transition-colors"></div>
              
              {/* Content */}
              <div className="relative py-4 px-6 flex items-center justify-center gap-3 text-white">
                {isLoading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>Mark Dinner Attendance</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </div>
            </button>
          </form>

          {/* Time Display */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-center gap-3 text-muted-foreground">
            <UtensilsCrossed className="w-4 h-4 text-secondary/70" />
            <span className="font-display tracking-widest text-sm">
              WINDOW: 6:00 PM - 10:00 PM
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
