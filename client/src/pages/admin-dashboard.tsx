import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Users, LogOut, CheckCircle, XCircle, AlertTriangle, CalendarDays, Download, Settings as SettingsIcon, Save, Eye, X, Trash2, XOctagon, UserCheck, Lock, ClipboardList, CheckCheck, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Student = {
    id: string;
    userId: string;
    fullName: string;
    phoneNumber: string;
    roomNumber: string;
    hostelBlock: string;
};

type Attendance = {
    id: string;
    userId: string;
    date: string;
    mealType: string;
    timestamp: string;
    verifiedByAdmin: boolean;
    status: 'present' | 'absent';
    absentReason: string | null;
    returnDate: string | null;
    returnMealType: string | null;
};

type LeaveRequest = {
    id: string;
    userId: string;
    reason: string;
    startDate: string;
    endDate: string;
    returnMealType: string;
    status: 'pending' | 'approved' | 'rejected';
    adminNote: string | null;
    timestamp: string;
    monthYear: string;
};

type DashboardData = {
    date: string;
    students: Student[];
    attendances: Attendance[];
    sundayTokens: Record<string, string>;
};

type SettingsData = {
    breakfastStart: string;
    breakfastEnd: string;
    dinnerStart: string;
    dinnerEnd: string;
};

export default function AdminDashboard() {
    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const todayIST = nowIST.getFullYear() + '-' + String(nowIST.getMonth() + 1).padStart(2, '0') + '-' + String(nowIST.getDate()).padStart(2, '0');
    const tomorrowIST = (() => { const d = new Date(nowIST); d.setDate(d.getDate() + 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();
    const yesterdayIST = (() => { const d = new Date(nowIST); d.setDate(d.getDate() - 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();

    const [data, setData] = useState<DashboardData | null>(null);
    const [settings, setSettings] = useState<SettingsData>({ breakfastStart: '06:00', breakfastEnd: '09:00', dinnerStart: '18:00', dinnerEnd: '22:00' });
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(todayIST);
    const [savingSettings, setSavingSettings] = useState(false);
    const [showStudentsModal, setShowStudentsModal] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [cancellingAbsence, setCancellingAbsence] = useState<Attendance | null>(null);
    const [cancelReason, setCancelReason] = useState("");
    const [markingPresent, setMarkingPresent] = useState(false);
    const [activeTab, setActiveTab] = useState<"dashboard" | "leave" | "password">("dashboard");
    const [passwordData, setPasswordData] = useState({ current: "", new: "", confirm: "" });
    
    // For approving/rejecting leave
    const [processingLeaveId, setProcessingLeaveId] = useState<string | null>(null);
    const [adminNote, setAdminNote] = useState("");
    const [showLeaveModal, setShowLeaveModal] = useState<LeaveRequest | null>(null);

    const { toast } = useToast();

    const fetchDashboard = async (dateStr?: string) => {
        setLoading(true);
        try {
            const dateParam = dateStr || selectedDate;
            const [dashRes, setRes, leaveRes] = await Promise.all([
                fetch(`/api/admin/dashboard?date=${dateParam}`),
                fetch("/api/settings"),
                fetch("/api/admin/leave-requests")
            ]);

            const dashJson = await dashRes.json();
            const setJson = await setRes.json();
            const leaveJson = await leaveRes.json();

            setData(dashJson);
            setSettings(setJson);
            setLeaveRequests(leaveJson);
        } catch (e: any) {
            console.error("Dashboard fetch error:", e);
            toast({
                title: "Error fetching data",
                description: `Failed to load: ${e.message}`,
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteStudent = async (student: Student) => {
        if (!confirm(`Remove "${student.fullName}" (${student.userId}) from the system? This cannot be undone.`)) return;
        setDeletingId(student.id);
        try {
            const res = await fetch(`/api/admin/students/${student.id}`, { method: 'DELETE' });
            if (res.ok) {
                setData(prev => prev ? { ...prev, students: prev.students.filter(s => s.id !== student.id) } : prev);
                toast({ title: 'Student Removed', description: `${student.fullName} has been removed.`, className: 'bg-red-900/80 text-red-100 border-red-700' });
            } else {
                throw new Error('Failed to delete');
            }
        } catch {
            toast({ title: 'Error', description: 'Could not remove student.', variant: 'destructive' });
        } finally {
            setDeletingId(null);
        }
    };

    const handleLeaveAction = async (id: string, status: 'approved' | 'rejected') => {
        setProcessingLeaveId(id);
        try {
            const res = await fetch(`/api/admin/leave-request/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status, adminNote })
            });

            if (!res.ok) throw new Error("Failed to update leave request.");

            const updatedLr = await res.json();
            setLeaveRequests(prev => prev.map(lr => lr.id === id ? updatedLr : lr));
            setShowLeaveModal(null);
            setAdminNote("");
            
            toast({
                title: status === 'approved' ? 'Leave Approved' : 'Leave Rejected',
                description: `Request has been marked as ${status}.`,
                className: status === 'approved' ? "bg-green-600/20 text-green-300 border-green-500" : "bg-red-600/20 text-red-300 border-red-500",
            });
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setProcessingLeaveId(null);
        }
    };

    useEffect(() => {
        fetchDashboard(selectedDate);
    }, [selectedDate]);

    const handleCancelAbsence = async (markPresent: boolean) => {
        if (!cancellingAbsence) return;
        setMarkingPresent(true);
        try {
            // Step 1: Delete the absence record
            const delRes = await fetch(`/api/admin/attendance/${cancellingAbsence.id}`, { method: 'DELETE' });
            if (!delRes.ok) throw new Error('Failed to remove absence record.');

            // Step 2: Optionally mark them as present directly
            let newRecord: Attendance | null = null;
            if (markPresent) {
                const presRes = await fetch('/api/admin/mark-present', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: cancellingAbsence.userId,
                        mealType: cancellingAbsence.mealType,
                        date: cancellingAbsence.date,
                    })
                });
                if (presRes.ok) {
                    newRecord = await presRes.json();
                }
            }

            // Update local state: remove absence, add new present record if applicable
            setData(prev => {
                if (!prev) return prev;
                const filtered = prev.attendances.filter(a => a.id !== cancellingAbsence.id);
                const updated = newRecord ? [...filtered, newRecord] : filtered;
                return { ...prev, attendances: updated };
            });

            toast({
                title: markPresent ? '✅ Marked Present' : '🗑️ Absence Removed',
                description: markPresent
                    ? `Student has been marked present for ${cancellingAbsence.mealType}.`
                    : `Absence removed. Student can now re-vote.`,
                className: 'bg-green-900/80 text-green-100 border-green-700'
            });
            setCancellingAbsence(null);
            setCancelReason("");
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        } finally {
            setMarkingPresent(false);
        }
    };

    const handleSaveSettings = async () => {
        setSavingSettings(true);
        try {
            const res = await fetch("/api/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings)
            });
            if (res.ok) {
                toast({
                    title: "Settings Saved",
                    description: "Time slots successfully updated.",
                    className: "bg-green-500 text-white border-green-400 glow-cyan",
                });
            } else {
                throw new Error("Failed");
            }
        } catch (e) {
            toast({
                title: "Error",
                description: "Failed to save settings.",
                variant: "destructive"
            });
        } finally {
            setSavingSettings(false);
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

        setLoading(true);
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
            setActiveTab("dashboard");
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyParams = async (id: string, currentlyVerified: boolean) => {
        try {
            const res = await fetch("/api/admin/verify-attendance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, verifiedByAdmin: !currentlyVerified })
            });
            if (res.ok) {
                setData(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        attendances: prev.attendances.map(a => a.id === id ? { ...a, verifiedByAdmin: !currentlyVerified } : a)
                    };
                });
                toast({
                    title: !currentlyVerified ? "Attendance Verified" : "Verification Removed",
                    className: "bg-primary text-primary-foreground border-primary glow-magenta",
                });
            }
        } catch (e) {
            console.error(e);
        }
    };

    const downloadMealPDF = (mealType: 'breakfast' | 'dinner') => {
        if (!data) return;
        const doc = new jsPDF();
        const mealName = mealType === 'breakfast' ? 'Breakfast' : 'Dinner';
        doc.text(`Hostel ${mealName} Attendance Report - ${data.date}`, 14, 15);

        const rowData = data.students.map((student, index) => {
            const mark = data.attendances.find(a => a.userId === student.userId && a.mealType === mealType);
            let text = "Not Voted";
            let style = { fillColor: [239, 68, 68] as [number, number, number], textColor: [255, 255, 255] as [number, number, number] };

            if (mark) {
                if (mark.status === "absent") {
                    let textParts = [`Reason: ${mark.absentReason}`];
                    if (mark.returnDate) textParts.push(`Returning: ${mark.returnDate} (${mark.returnMealType})`);
                    text = `Absent - ${textParts.join(' | ')}`;
                    style = { fillColor: [234, 179, 8] as [number, number, number], textColor: [0, 0, 0] as [number, number, number] };
                } else {
                    text = mark.verifiedByAdmin ? 'Present (Verified)' : 'Present (Pending)';
                    style = { fillColor: [34, 197, 94] as [number, number, number], textColor: [255, 255, 255] as [number, number, number] };
                }
            }

            return [
                index + 1,
                student.fullName,
                student.roomNumber,
                { content: text, styles: style }
            ];
        });

        autoTable(doc, {
            head: [['S.No', 'Student Name', 'Room No', 'Status']],
            body: rowData,
            startY: 25,
            theme: 'grid',
            headStyles: { fillColor: mealType === 'breakfast' ? [6, 182, 212] : [236, 72, 153] }
        });

        doc.save(`${mealName}_Attendance_${data.date}.pdf`);
    };

    const sendWarning = (student: Student) => {
        toast({
            title: "Warning Sent",
            description: `Disciplinary warning has been sent to ${student.fullName} (${student.userId}).`,
            variant: "destructive",
        });
    };

    const renderMarkBadge = (mark: Attendance | undefined) => {
        if (!mark) {
            return (
                <div className="flex flex-col items-center">
                    <XCircle className="w-5 h-5 text-red-500/50 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                    <span className="text-[10px] mt-1 text-red-400 font-bold uppercase tracking-wider">Not Voted</span>
                </div>
            );
        }

        if (mark.status === 'absent') {
            return (
                <div className="inline-flex flex-col items-center gap-1 p-2 rounded-xl bg-yellow-500/20 border border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.2)]">
                    <AlertTriangle className="w-5 h-5 text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]" />
                    <span className="text-[10px] text-yellow-400 font-bold uppercase tracking-widest">ABSENT</span>
                    <span className="text-[10px] text-yellow-200/70 max-w-[100px] truncate" title={mark.absentReason || ""}>
                        {mark.absentReason}
                    </span>
                    {mark.returnDate && (
                        <span className="text-[9px] text-yellow-300 font-medium px-1.5 py-0.5 bg-yellow-500/20 rounded mt-0.5">
                            Returns: {mark.returnDate} ({mark.returnMealType})
                        </span>
                    )}
                    <button
                        onClick={() => setCancellingAbsence(mark)}
                        className="mt-1 flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/25 border border-red-500/30 text-red-400 hover:text-red-300 text-[9px] font-display tracking-widest transition-all"
                    >
                        <XOctagon className="w-3 h-3" /> CANCEL
                    </button>
                </div>
            );
        }

        return (
            <button
                onClick={() => handleVerifyParams(mark.id, !!mark.verifiedByAdmin)}
                className={`inline-flex flex-col items-center gap-1 p-2 rounded-xl border transition-all cursor-pointer ${mark.verifiedByAdmin ? 'bg-green-500/20 border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'bg-white/5 border-white/10 hover:border-cyan-400/50'}`}
            >
                <CheckCircle className={`w-5 h-5 ${mark.verifiedByAdmin ? 'text-green-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]'}`} />
                <span className={`text-[10px] flex items-center gap-1 tracking-widest ${mark.verifiedByAdmin ? 'text-green-400 font-bold' : 'text-muted-foreground'}`}>
                    {mark.verifiedByAdmin ? 'VERIFIED' : 'PENDING'}
                </span>
                <span className="text-[10px] text-muted-foreground/50">
                    {new Date(mark.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            </button>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="w-10 h-10 border-4 border-magenta-500/30 border-t-magenta-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!data) return null;

    const { students, attendances, date, sundayTokens } = data;

    const totalStudents = students.length;
    const breakfastPresent = attendances.filter(a => a.mealType === "breakfast" && a.status === "present").length;
    const dinnerPresent = attendances.filter(a => a.mealType === "dinner" && a.status === "present").length;

    return (
        <div className="min-h-screen p-3 sm:p-6 lg:p-8 relative">
            {/* Background Orbs */}
            <div className="bg-orb orb-1 fixed"></div>
            <div className="bg-orb orb-2 fixed"></div>
            <div className="bg-orb orb-3 fixed"></div>

            {/* Cancel Absence Modal */}
            {cancellingAbsence && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="glass-card w-full max-w-md p-6 rounded-2xl border border-yellow-500/30 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-4">
                            <XOctagon className="w-6 h-6 text-yellow-400" />
                            <h2 className="font-display text-lg font-bold tracking-widest text-yellow-400 uppercase">Cancel Absence</h2>
                        </div>
                        <p className="text-sm text-white/80 mb-2">
                            You are removing the <span className="text-yellow-300 font-bold">{cancellingAbsence.mealType}</span> absence record for student <span className="text-cyan-300 font-bold">{cancellingAbsence.userId}</span>.
                        </p>
                        <p className="text-xs text-yellow-200/60 mb-1">Original reason: <span className="italic">{cancellingAbsence.absentReason}</span></p>
                        <p className="text-xs text-white/50 mb-5">After removal, the student can re-vote, or you can mark them present directly below.</p>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => handleCancelAbsence(true)}
                                disabled={markingPresent}
                                className="w-full py-3 rounded-xl bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 text-green-300 font-display tracking-widest text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                            >
                                <UserCheck className="w-4 h-4" />
                                {markingPresent ? 'Processing...' : 'REMOVE & MARK PRESENT NOW'}
                            </button>
                            <button
                                onClick={() => handleCancelAbsence(false)}
                                disabled={markingPresent}
                                className="w-full py-3 rounded-xl bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 font-display tracking-widest text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                            >
                                <XOctagon className="w-4 h-4" />
                                {markingPresent ? 'Processing...' : 'REMOVE ONLY (LET STUDENT RE-VOTE)'}
                            </button>
                            <button
                                onClick={() => { setCancellingAbsence(null); setCancelReason(""); }}
                                disabled={markingPresent}
                                className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-muted-foreground font-display tracking-widest text-xs transition-all"
                            >
                                KEEP ABSENCE (NO CHANGE)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Leave Approval Modal */}
            {showLeaveModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="glass-card w-full max-w-md p-6 rounded-2xl border border-orange-500/30 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-4">
                            <ClipboardList className="w-6 h-6 text-orange-400" />
                            <h2 className="font-display text-lg font-bold tracking-widest text-orange-400 uppercase">Manage Leave Request</h2>
                        </div>
                        <div className="space-y-4 mb-6">
                            <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                                <p className="text-xs text-white/50 uppercase tracking-widest">Student Info</p>
                                <p className="text-sm font-bold text-white">UserID: {showLeaveModal.userId}</p>
                                <p className="text-xs text-white/80">Requested Dates: <span className="text-orange-300">{showLeaveModal.startDate}</span> to <span className="text-orange-300">{showLeaveModal.endDate}</span></p>
                                <p className="text-xs text-white/80 italic mt-2">"{showLeaveModal.reason}"</p>
                            </div>
                            
                            <div>
                                <label className="text-[10px] font-display tracking-widest text-white/50 uppercase mb-1 block">Admin Note (optional)</label>
                                <textarea
                                    value={adminNote}
                                    onChange={e => setAdminNote(e.target.value)}
                                    placeholder="Add any feedback for the student..."
                                    className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-muted-foreground resize-none text-sm focus:border-orange-500 outline-none"
                                    rows={2}
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <div className="flex gap-3">
                                <button
                                    onClick={() => handleLeaveAction(showLeaveModal.id, 'approved')}
                                    disabled={!!processingLeaveId}
                                    className="flex-1 py-3 rounded-xl bg-green-500 hover:bg-green-400 text-black font-display tracking-widest font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                                >
                                    <CheckCheck className="w-4 h-4" /> {processingLeaveId === showLeaveModal.id ? '...' : 'APPROVE'}
                                </button>
                                <button
                                    onClick={() => handleLeaveAction(showLeaveModal.id, 'rejected')}
                                    disabled={!!processingLeaveId}
                                    className="flex-1 py-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 font-display tracking-widest font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                                >
                                    <XCircle className="w-4 h-4" /> {processingLeaveId === showLeaveModal.id ? '...' : 'REJECT'}
                                </button>
                            </div>
                            <button
                                onClick={() => { setShowLeaveModal(null); setAdminNote(""); }}
                                className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground font-display tracking-widest text-[10px] uppercase transition-all"
                            >
                                CLOSE
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Students Modal */}
            {showStudentsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="glass-card w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-white/20 overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <div>
                                <h2 className="font-display tracking-widest text-xl font-bold text-white uppercase">Registered Students List</h2>
                                <p className="text-sm text-muted-foreground mt-1">Total Active Directory: {totalStudents} Students</p>
                            </div>
                            <button onClick={() => setShowStudentsModal(false)} className="p-2 rounded-full hover:bg-white/10 text-muted-foreground hover:text-white transition">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="overflow-auto p-0 flex-1">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-white/5 sticky top-0 backdrop-blur-md">
                                    <tr className="border-b border-white/10 text-muted-foreground/80 text-sm font-display tracking-wider">
                                        <th className="p-4 font-normal w-12 text-center">#</th>
                                        <th className="p-4 font-normal">Full Name</th>
                                        <th className="p-4 font-normal">User ID</th>
                                        <th className="p-4 font-normal">Phone Number</th>
                                        <th className="p-4 font-normal">Room</th>
                                        <th className="p-4 font-normal">Block</th>
                                        <th className="p-4 font-normal text-center">Remove</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {students.map((s, index) => (
                                        <tr key={s.id} className="hover:bg-white/5 transition-colors">
                                            <td className="p-4 text-muted-foreground font-mono text-center">{index + 1}</td>
                                            <td className="p-4 text-white font-medium whitespace-nowrap">{s.fullName}</td>
                                            <td className="p-4 text-cyan-400 whitespace-nowrap">{s.userId}</td>
                                            <td className="p-4 text-white/80 whitespace-nowrap">{s.phoneNumber}</td>
                                            <td className="p-4 text-magenta-300 font-medium">{s.roomNumber}</td>
                                            <td className="p-4 text-white/80">{s.hostelBlock}</td>
                                            <td className="p-4 text-center">
                                                <button
                                                    onClick={() => handleDeleteStudent(s)}
                                                    disabled={deletingId === s.id}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/25 text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/60 transition-all text-xs font-display tracking-widest font-semibold disabled:opacity-50"
                                                >
                                                    {deletingId === s.id ? '...' : <><Trash2 className="w-3 h-3" /> REMOVE</>}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {students.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-muted-foreground">No students registered yet.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-6xl mx-auto relative z-10 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                {/* Tab Navigation */}
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 w-full max-w-lg mx-auto">
                    <button
                        onClick={() => setActiveTab("dashboard")}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-display font-bold tracking-widest uppercase transition-all ${activeTab === "dashboard" ? "bg-magenta-500 text-white shadow-[0_0_10px_rgba(236,72,153,0.3)]" : "text-muted-foreground hover:text-white"}`}
                    >
                        <Users className="w-4 h-4" /> Dashboard
                    </button>
                    <button
                        onClick={() => setActiveTab("leave")}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-display font-bold tracking-widest uppercase transition-all relative ${activeTab === "leave" ? "bg-orange-500 text-white shadow-[0_0_10px_rgba(249,115,22,0.3)]" : "text-muted-foreground hover:text-white"}`}
                    >
                        <ClipboardList className="w-4 h-4" /> Leave
                        {leaveRequests.some(lr => lr.status === 'pending') && (
                            <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] animate-pulse" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab("password")}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-display font-bold tracking-widest uppercase transition-all ${activeTab === "password" ? "bg-cyan-500 text-white shadow-[0_0_10px_rgba(34,211,238,0.3)]" : "text-muted-foreground hover:text-white"}`}
                    >
                        <Lock className="w-4 h-4" /> Password
                    </button>
                </div>

                {activeTab === "dashboard" ? (
                    <>
                        {/* Header */}
                        <div className="glass-card p-4 sm:p-6 rounded-2xl flex flex-col gap-4 border border-magenta-500/20 shadow-[0_0_30px_rgba(236,72,153,0.1)]">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-magenta-500/10 text-magenta-500 flex items-center justify-center shadow-[0_0_15px_rgba(236,72,153,0.4)] border border-magenta-500/20">
                                        <Users className="w-5 h-5 sm:w-6 sm:h-6" />
                                    </div>
                                    <div>
                                        <h1 className="font-display text-xl sm:text-2xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-magenta-400 to-purple-500 drop-shadow-[0_0_8px_rgba(236,72,153,0.5)]">
                                            Admin Dashboard
                                        </h1>
                                        <p className="font-display text-magenta-400/80 uppercase tracking-widest text-xs font-semibold mt-0.5 flex gap-2 items-center">
                                            <CalendarDays className="w-3 h-3" /> {date}
                                        </p>
                                    </div>
                                </div>
                                <Link href="/">
                                    <span onClick={() => localStorage.removeItem('user')} className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-colors cursor-pointer text-red-400 hover:text-red-300 flex items-center justify-center group shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                                        <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                                    </span>
                                </Link>
                            </div>

                            {/* Date Picker Row */}
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                <span className="text-xs text-white/40 font-display tracking-widest uppercase">Roster Date:</span>
                                <div className="flex gap-1.5">
                                    <button
                                        onClick={() => setSelectedDate(yesterdayIST)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-display tracking-widest border transition-all ${selectedDate === yesterdayIST ? 'bg-purple-500/30 border-purple-400/60 text-purple-300' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white'}`}
                                    >YESTERDAY</button>
                                    <button
                                        onClick={() => setSelectedDate(todayIST)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-display tracking-widest border transition-all ${selectedDate === todayIST ? 'bg-cyan-500/30 border-cyan-400/60 text-cyan-300' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white'}`}
                                    >TODAY</button>
                                    <button
                                        onClick={() => setSelectedDate(tomorrowIST)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-display tracking-widest border transition-all ${selectedDate === tomorrowIST ? 'bg-green-500/30 border-green-400/60 text-green-300' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white'}`}
                                    >TOMORROW</button>
                                </div>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={e => setSelectedDate(e.target.value)}
                                    className="ml-auto px-3 py-1.5 rounded-lg text-xs font-mono bg-white/5 border border-white/15 text-white/80 focus:outline-none focus:border-cyan-400/50 transition-colors"
                                />
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <button onClick={() => setShowStudentsModal(true)} className="flex-1 min-w-[120px] px-3 py-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 hover:text-white flex items-center justify-center transition-colors shadow-[0_0_10px_rgba(6,182,212,0.2)] hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] group text-xs font-display tracking-widest">
                                    <Eye className="w-4 h-4 mr-1.5" /> VIEW STUDENTS
                                </button>
                                <button onClick={() => downloadMealPDF('breakfast')} className="flex-1 min-w-[120px] px-3 py-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 hover:text-white flex items-center justify-center transition-colors shadow-[0_0_10px_rgba(6,182,212,0.2)] hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] group text-xs font-display tracking-widest">
                                    <Download className="w-4 h-4 mr-1.5 group-hover:-translate-y-1 transition-transform" /> BREAKFAST PDF
                                </button>
                                <button onClick={() => downloadMealPDF('dinner')} className="flex-1 min-w-[120px] px-3 py-2.5 rounded-xl bg-magenta-500/10 hover:bg-magenta-500/20 border border-magenta-500/30 text-magenta-400 hover:text-white flex items-center justify-center transition-colors shadow-[0_0_10px_rgba(236,72,153,0.2)] hover:shadow-[0_0_20px_rgba(236,72,153,0.4)] group text-xs font-display tracking-widest">
                                    <Download className="w-4 h-4 mr-1.5 group-hover:-translate-y-1 transition-transform" /> DINNER PDF
                                </button>
                            </div>
                        </div>

                        {/* Settings Editor */}
                        <div className="glass-card p-6 rounded-2xl border border-white/10 gap-2">
                            <h2 className="font-display tracking-widest text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <SettingsIcon className="w-5 h-5 text-cyan-400" /> TIME SLOT CONFIGURATION
                            </h2>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="text-xs text-muted-foreground font-display tracking-widest mb-1 block">BREAKFAST START</label>
                                    <input type="time" value={settings.breakfastStart} onChange={(e) => setSettings({ ...settings, breakfastStart: e.target.value })} className="glass-input w-full p-3 rounded-xl text-white outline-none focus:glow-cyan border border-white/10" />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground font-display tracking-widest mb-1 block">BREAKFAST END</label>
                                    <input type="time" value={settings.breakfastEnd} onChange={(e) => setSettings({ ...settings, breakfastEnd: e.target.value })} className="glass-input w-full p-3 rounded-xl text-white outline-none focus:glow-cyan border border-white/10" />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground font-display tracking-widest mb-1 block">DINNER START</label>
                                    <input type="time" value={settings.dinnerStart} onChange={(e) => setSettings({ ...settings, dinnerStart: e.target.value })} className="glass-input w-full p-3 rounded-xl text-white outline-none focus:glow-cyan border border-white/10" />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground font-display tracking-widest mb-1 block">DINNER END</label>
                                    <input type="time" value={settings.dinnerEnd} onChange={(e) => setSettings({ ...settings, dinnerEnd: e.target.value })} className="glass-input w-full p-3 rounded-xl text-white outline-none focus:glow-cyan border border-white/10" />
                                </div>
                            </div>

                            <div className="mt-4 flex justify-end">
                                <button onClick={handleSaveSettings} disabled={savingSettings} className="px-6 py-3 rounded-xl bg-cyan-500 text-white font-bold tracking-wider hover:bg-cyan-400 transition-colors flex items-center gap-2 text-sm shadow-[0_0_15px_rgba(6,182,212,0.4)]">
                                    {savingSettings ? "SAVING..." : <><Save className="w-4 h-4" /> SAVE TIME SLOTS</>}
                                </button>
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="glass-card p-6 rounded-2xl border border-white/10 flex flex-col gap-2 relative overflow-hidden group">
                                <span className="text-muted-foreground font-display tracking-widest text-sm relative z-10">BREAKFAST PRESENT</span>
                                <span className="text-4xl font-bold text-white flex items-baseline gap-2 mb-1 relative z-10">
                                    {breakfastPresent} <span className="text-base text-muted-foreground font-normal">/ {totalStudents}</span>
                                </span>
                                <div className="absolute top-0 right-0 -mr-6 -mt-6 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Users className="w-32 h-32" />
                                </div>
                            </div>

                            <div className="glass-card p-6 rounded-2xl border border-white/10 flex flex-col gap-2 relative overflow-hidden group">
                                <span className="text-muted-foreground font-display tracking-widest text-sm relative z-10">DINNER PRESENT</span>
                                <span className="text-4xl font-bold text-white flex items-baseline gap-2 mb-1 relative z-10">
                                    {dinnerPresent} <span className="text-base text-muted-foreground font-normal">/ {totalStudents}</span>
                                </span>
                                <div className="absolute top-0 right-0 -mr-6 -mt-6 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Users className="w-32 h-32" />
                                </div>
                            </div>
                        </div>

                        {/* Student List */}
                        <div className="glass-card rounded-2xl border border-white/10 overflow-hidden backdrop-blur-md">
                            <div className="p-6 border-b border-white/5 bg-white/5 flex justify-between items-center">
                                <h2 className="font-display tracking-widest text-lg font-semibold text-white">LIVE VERIFICATION ROSTER</h2>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-white/5 text-muted-foreground/80 text-sm font-display tracking-wider">
                                            <th className="p-4 font-normal w-12 text-center">#</th>
                                            <th className="p-4 font-normal">Student Info</th>
                                            <th className="p-4 font-normal">Room/Block</th>
                                            <th className="p-4 font-normal text-center">Breakfast Status</th>
                                            <th className="p-4 font-normal text-center">Dinner Status</th>
                                            <th className="p-4 font-normal text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {students.map((student, index) => {
                                            const breakfastMark = attendances.find(a => a.userId === student.userId && a.mealType === 'breakfast');
                                            const dinnerMark = attendances.find(a => a.userId === student.userId && a.mealType === 'dinner');

                                            return (
                                                <tr key={student.id} className="hover:bg-white/5 transition-colors">
                                                    <td className="p-4 text-muted-foreground font-mono text-center">{index + 1}</td>
                                                    <td className="p-4 whitespace-nowrap">
                                                        <div className="flex flex-col">
                                                            <span className="font-semibold text-white text-base">{student.fullName}</span>
                                                            <span className="text-xs text-muted-foreground tracking-wider mt-0.5">{student.userId} | {student.phoneNumber}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 whitespace-nowrap text-muted-foreground">
                                                        {student.roomNumber} - {student.hostelBlock}
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <div className="flex flex-col items-center gap-2">
                                                            {renderMarkBadge(breakfastMark)}
                                                            {sundayTokens && sundayTokens[student.userId] && breakfastMark && breakfastMark.status === 'present' && (
                                                                <div className="inline-flex items-center gap-1 p-1 px-2 rounded bg-cyan-500/10 border border-cyan-500/30 w-max" title="Sunday Breakfast Token">
                                                                    <span className="text-[9px] text-cyan-400 font-mono font-bold">{sundayTokens[student.userId].split(':')[0]}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <div className="flex flex-col items-center gap-2">
                                                            {renderMarkBadge(dinnerMark)}
                                                            {sundayTokens && sundayTokens[student.userId] && dinnerMark && dinnerMark.status === 'present' && (
                                                                <div className="inline-flex items-center gap-1 p-1 px-2 rounded bg-cyan-500/10 border border-cyan-500/30 w-max" title="Sunday Breakfast Token">
                                                                    <span className="text-[9px] text-cyan-400 font-mono font-bold">{sundayTokens[student.userId].split(':')[0]}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <button
                                                            onClick={() => sendWarning(student)}
                                                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40 transition-colors text-xs font-display tracking-widest font-semibold cursor-pointer"
                                                        >
                                                            <AlertTriangle className="w-3 h-3" />
                                                            WARN
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                        {students.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="p-8 text-center text-muted-foreground" style={{ height: '200px' }}>
                                                    No students found in the roster.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                ) : activeTab === "leave" ? (
                    /* Leave Requests List */
                    <div className="glass-card rounded-2xl border border-white/10 overflow-hidden backdrop-blur-md animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="p-6 border-b border-white/5 bg-white/5 flex justify-between items-center">
                            <div>
                                <h2 className="font-display tracking-widest text-lg font-semibold text-white">LEAVE APPROVAL QUEUE</h2>
                                <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest">Manage extended leave requests</p>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/5 text-muted-foreground/80 text-sm font-display tracking-wider">
                                        <th className="p-4 font-normal">Student ID</th>
                                        <th className="p-4 font-normal">Reason</th>
                                        <th className="p-4 font-normal">Duration</th>
                                        <th className="p-4 font-normal text-center">Status</th>
                                        <th className="p-4 font-normal text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {leaveRequests.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="p-12 text-center text-muted-foreground">No leave requests found.</td>
                                        </tr>
                                    ) : (
                                        leaveRequests.map(lr => (
                                            <tr key={lr.id} className="hover:bg-white/5 transition-colors">
                                                <td className="p-4 whitespace-nowrap text-white font-medium">{lr.userId}</td>
                                                <td className="p-4">
                                                    <p className="text-xs text-white/70 italic max-w-xs truncate" title={lr.reason}>"{lr.reason}"</p>
                                                </td>
                                                <td className="p-4 whitespace-nowrap text-xs text-white/50">
                                                    <span className="text-orange-400">{lr.startDate}</span> → <span className="text-orange-400">{lr.endDate}</span>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className={`text-[10px] font-display font-bold tracking-widest uppercase px-2 py-0.5 rounded-full border flex items-center justify-center gap-1 w-max mx-auto ${lr.status === 'approved' ? 'bg-green-500/20 border-green-500/40 text-green-400' : lr.status === 'rejected' ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'bg-orange-500/20 border-orange-500/40 text-orange-400'}`}>
                                                        {lr.status === 'approved' ? <CheckCheck className="w-3 h-3" /> : lr.status === 'rejected' ? <XCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                                        {lr.status}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    {lr.status === 'pending' ? (
                                                        <button
                                                            onClick={() => setShowLeaveModal(lr)}
                                                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 hover:border-orange-500/40 transition-colors text-xs font-display tracking-widest font-semibold"
                                                        >
                                                            <Send className="w-3 h-3" /> REVIEW
                                                        </button>
                                                    ) : (
                                                        <span className="text-[10px] text-muted-foreground font-display uppercase tracking-widest">PROCESSED</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    /* Admin Security Settings */
                    <div className="glass-card max-w-md mx-auto p-8 rounded-2xl border border-white/10 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="text-center space-y-2">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-cyan-500/10 text-cyan-400 glow-cyan mb-2">
                                <Lock className="w-6 h-6" />
                            </div>
                            <h2 className="font-display text-xl font-bold tracking-widest text-white uppercase">Security Settings</h2>
                            <p className="text-xs text-muted-foreground uppercase tracking-widest">Update your admin credentials</p>
                        </div>

                        <form onSubmit={handleChangePassword} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-display font-bold tracking-[0.2em] text-cyan-400 uppercase">Current Password</label>
                                <input
                                    type="password"
                                    required
                                    value={passwordData.current}
                                    onChange={e => setPasswordData({ ...passwordData, current: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-cyan-400 focus:outline-none transition-all"
                                    placeholder="••••••••"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-display font-bold tracking-[0.2em] text-cyan-400 uppercase">New Password</label>
                                <input
                                    type="password"
                                    required
                                    value={passwordData.new}
                                    onChange={e => setPasswordData({ ...passwordData, new: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-cyan-400 focus:outline-none transition-all"
                                    placeholder="••••••••"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-display font-bold tracking-[0.2em] text-cyan-400 uppercase">Confirm New Password</label>
                                <input
                                    type="password"
                                    required
                                    value={passwordData.confirm}
                                    onChange={e => setPasswordData({ ...passwordData, confirm: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-cyan-400 focus:outline-none transition-all"
                                    placeholder="••••••••"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-display font-bold uppercase tracking-wider text-xs shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-all disabled:opacity-50"
                            >
                                {loading ? "Updating..." : "Update Admin Password"}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}

// Re-using some icons from Lucide
function Clock(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}
