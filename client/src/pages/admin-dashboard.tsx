import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Users, LogOut, CheckCircle, XCircle, AlertTriangle, CalendarDays, Download, Settings as SettingsIcon, Save, Eye, EyeOff, X, Trash2, XOctagon, UserCheck, Lock, ClipboardList, CheckCheck, Send, CheckCircle2 } from "lucide-react";
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
    warnings?: number;
    isApproved: boolean;
    status: 'Active' | 'Left Hostel' | 'Suspended' | 'Completed';
    joiningMonthYear: string | null;
    leavingMonthYear: string | null;
    createdAt: string;
    email: string;
    ipAddress?: string;
    deviceFingerprint?: string;
    suspiciousScore?: number;
    isSuspicious?: boolean;
    isBanned?: boolean;
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
    stats: {
        totalActive: number;
        totalLeft: number;
        availableSeats: number;
    };
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
    const [selectedMonth, setSelectedMonth] = useState(todayIST.substring(0, 7)); // YYYY-MM
    const [savingSettings, setSavingSettings] = useState(false);
    const [showStudentsModal, setShowStudentsModal] = useState(false);
    const [showApprovalsModal, setShowApprovalsModal] = useState(false);
    const [studentSearchQuery, setStudentSearchQuery] = useState("");
    const [approvalSearchQuery, setApprovalSearchQuery] = useState("");
    const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
    const [statusFilter, setStatusFilter] = useState<string>("Active");
    const [yearFilter, setYearFilter] = useState<string>("");
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
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
    const [showPassword, setShowPassword] = useState(false);
    const [showSuspiciousModal, setShowSuspiciousModal] = useState(false);
    const [suspiciousUsers, setSuspiciousUsers] = useState<Student[]>([]);

    const { toast } = useToast();

    const fetchDashboard = async () => {
        try {
            const res = await fetch(`/api/admin/dashboard?date=${selectedDate}`);
            if (!res.ok) throw new Error("Unauthorized or server error");
            const d = await res.json();
            setData(d);

            const sRes = await fetch("/api/admin/settings");
            if (sRes.ok) {
                const s = await sRes.json();
                setSettings(s);
            }

            const lRes = await fetch("/api/admin/leave-requests");
            if (lRes.ok) {
                const l = await lRes.json();
                setLeaveRequests(l);
            }

            const sAccRes = await fetch("/api/admin/suspicious-accounts");
            if (sAccRes.ok) {
                const su = await sAccRes.json();
                setSuspiciousUsers(su);
            }
        } catch (e) {
            console.error(e);
            toast({ title: "Session Expired", description: "Please login again.", variant: "destructive" });
            window.location.href = "/admin";
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboard();
        const interval = setInterval(fetchDashboard, 30000); // Auto-refresh every 30s
        return () => clearInterval(interval);
    }, [selectedDate]);

    const handleSaveSettings = async () => {
        setSavingSettings(true);
        try {
            const res = await fetch("/api/admin/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings)
            });
            if (res.ok) {
                toast({ title: "Settings Saved", description: "System times updated successfully.", className: "bg-green-500 text-white" });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSavingSettings(false);
        }
    };

    const handleApproveStudent = async (student: Student) => {
        try {
            const res = await fetch(`/api/admin/approve-student/${student.id}`, { method: "POST" });
            if (res.ok) {
                toast({ title: "Student Approved", description: `${student.fullName} has been granted access.`, className: "bg-green-500 text-white" });
                fetchDashboard();
            }
        } catch (e) { console.error(e); }
    };

    const handleBulkApprove = async () => {
        if (selectedStudents.length === 0) return;
        setIsBulkDeleting(true);
        try {
            for (const id of selectedStudents) {
                await fetch(`/api/admin/approve-student/${id}`, { method: "POST" });
            }
            toast({ title: "Bulk Approval Success", description: `Approved ${selectedStudents.length} students.`, className: "bg-green-500 text-white" });
            setSelectedStudents([]);
            fetchDashboard();
        } catch (e) { console.error(e); }
        finally { setIsBulkDeleting(false); }
    };

    const handleDeleteStudent = async (student: Student) => {
        if (!confirm(`Are you sure you want to remove ${student.fullName}? (Historical data will be kept if they are active)`)) return;
        setDeletingId(student.id);
        try {
            const res = await fetch(`/api/admin/delete-student/${student.id}`, { method: "DELETE" });
            if (res.ok) {
                toast({ title: "Success", description: "Student removed.", className: "bg-red-500 text-white" });
                fetchDashboard();
            }
        } catch (e) { console.error(e); }
        finally { setDeletingId(null); }
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Remove ${selectedStudents.length} selected students?`)) return;
        setIsBulkDeleting(true);
        try {
            for (const id of selectedStudents) {
                await fetch(`/api/admin/delete-student/${id}`, { method: "DELETE" });
            }
            toast({ title: "Success", description: "Selected students removed.", className: "bg-red-500 text-white" });
            setSelectedStudents([]);
            fetchDashboard();
        } catch (e) { console.error(e); }
        finally { setIsBulkDeleting(false); }
    };

    const handleBanUser = async (id: string, ban: boolean) => {
        try {
            const res = await fetch(`/api/admin/${ban ? 'ban' : 'unban'}-user/${id}`, { method: "POST" });
            if (res.ok) {
                toast({ title: ban ? "User Banned" : "User Unbanned", variant: ban ? "destructive" : "default" });
                fetchDashboard();
            }
        } catch (e) { console.error(e); }
    };

    const handleLeaveAction = async (requestId: string, status: 'approved' | 'rejected') => {
        setProcessingLeaveId(requestId);
        try {
            const res = await fetch(`/api/admin/process-leave/${requestId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status, adminNote })
            });
            if (res.ok) {
                toast({ title: `Leave ${status}`, className: status === 'approved' ? "bg-green-500 text-white" : "bg-red-500 text-white" });
                setShowLeaveModal(null);
                setAdminNote("");
                fetchDashboard();
            }
        } catch (e) { console.error(e); }
        finally { setProcessingLeaveId(null); }
    };

    const handleCancelAbsence = async (markPresent: boolean) => {
        if (!cancellingAbsence) return;
        setMarkingPresent(true);
        try {
            const res = await fetch("/api/admin/cancel-absence", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: cancellingAbsence.id, markPresent })
            });
            if (res.ok) {
                toast({ title: markPresent ? "Absence Cancelled & Marked Present" : "Absence Cancelled", className: "bg-green-500 text-white" });
                setCancellingAbsence(null);
                fetchDashboard();
            }
        } catch (e) { console.error(e); }
        finally { setMarkingPresent(false); }
    };

    const handleSelectAll = (checked: boolean, type: 'pending' | 'approved') => {
        if (!data) return;
        if (!checked) {
            setSelectedStudents([]);
            return;
        }

        const filtered = data.students.filter(s => {
            if (type === 'pending') return !s.isApproved;
            return s.isApproved;
        }).map(s => s.id);
        setSelectedStudents(filtered);
    };

    const toggleSelect = (id: string) => {
        setSelectedStudents(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordData.new !== passwordData.confirm) {
            toast({ title: "Error", description: "New passwords do not match.", variant: "destructive" });
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

        const rowData = data.students.filter(s => s.isApproved && s.status === 'Active').map((student, index) => {
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

    const downloadMonthlyPDF = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/monthly-data?monthYear=${selectedMonth}`);
            if (!res.ok) throw new Error("Failed to fetch monthly data");
            const { students, attendance, leaveRequests } = await res.json();

            const doc = new jsPDF('l', 'mm', 'a4');
            doc.setFontSize(18);
            doc.text(`Monthly Attendance Report: ${selectedMonth}`, 14, 20);
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Generated on ${new Date().toLocaleString()}`, 14, 28);

            const parts = selectedMonth.split('-');
            const year = parseInt(parts[0]);
            const month = parseInt(parts[1]);
            const daysInMonth = new Date(year, month, 0).getDate();

            const tableData = students.map((s: Student, idx: number) => {
                const sAtt = attendance.filter((a: Attendance) => a.userId === s.userId);
                
                let bPresent = 0, bAbsent = 0, bPermission = 0;
                let dPresent = 0, dAbsent = 0, dPermission = 0;

                for (let day = 1; day <= daysInMonth; day++) {
                    const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
                    
                    // Check Leave/Permission first
                    const onLeave = leaveRequests.find((lr: any) => dateStr >= lr.startDate && dateStr <= lr.endDate && lr.status === 'approved');
                    
                    // Breakfast
                    const bMark = sAtt.find((a: Attendance) => a.date === dateStr && a.mealType === 'breakfast');
                    if (onLeave) bPermission++;
                    else if (bMark?.status === 'present') bPresent++;
                    else if (bMark?.status === 'absent') bAbsent++;

                    // Dinner
                    const dMark = sAtt.find((a: Attendance) => a.date === dateStr && a.mealType === 'dinner');
                    if (onLeave) dPermission++;
                    else if (dMark?.status === 'present') dPresent++;
                    else if (dMark?.status === 'absent') dAbsent++;
                }

                return [
                    idx + 1,
                    s.fullName,
                    s.roomNumber,
                    bPresent, bAbsent, bPermission,
                    dPresent, dAbsent, dPermission
                ];
            });

            autoTable(doc, {
                head: [
                    [
                        { content: 'S.No', rowSpan: 2 },
                        { content: 'Student Name', rowSpan: 2 },
                        { content: 'Room', rowSpan: 2 },
                        { content: 'Breakfast', colSpan: 3, styles: { halign: 'center', fillColor: [6, 182, 212] } },
                        { content: 'Dinner', colSpan: 3, styles: { halign: 'center', fillColor: [236, 72, 153] } }
                    ],
                    ['Pres', 'Abs', 'Perm', 'Pres', 'Abs', 'Perm']
                ],
                body: tableData,
                startY: 35,
                theme: 'grid',
                headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' },
                columnStyles: {
                    0: { cellWidth: 12 },
                    1: { cellWidth: 'auto' },
                    2: { cellWidth: 20 },
                    3: { cellWidth: 15, halign: 'center' },
                    4: { cellWidth: 15, halign: 'center' },
                    5: { cellWidth: 15, halign: 'center' },
                    6: { cellWidth: 15, halign: 'center' },
                    7: { cellWidth: 15, halign: 'center' },
                    8: { cellWidth: 15, halign: 'center' }
                }
            });

            doc.save(`Monthly_Report_${selectedMonth}.pdf`);
            toast({ title: "Report Generated", description: `Attendance report for ${selectedMonth} is ready.` });
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const downloadExcel = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/monthly-data?monthYear=${selectedMonth}`);
            if (!res.ok) throw new Error("Failed to fetch monthly data");
            const { students, attendance, leaveRequests } = await res.json();
            
            const { utils, writeFile } = await import('xlsx');
            
            const rows = students.map((s: Student, idx: number) => {
                const sAtt = attendance.filter((a: Attendance) => a.userId === s.userId);
                let bPresent = 0, bAbsent = 0, bPermission = 0;
                let dPresent = 0, dAbsent = 0, dPermission = 0;

                const daysInMonth = new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]), 0).getDate();
                for (let day = 1; day <= daysInMonth; day++) {
                    const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
                    const onLeave = leaveRequests.find((lr: any) => dateStr >= lr.startDate && dateStr <= lr.endDate && lr.status === 'approved');
                    
                    const bMark = sAtt.find((a: Attendance) => a.date === dateStr && a.mealType === 'breakfast');
                    if (onLeave) bPermission++;
                    else if (bMark?.status === 'present') bPresent++;
                    else if (bMark?.status === 'absent') bAbsent++;

                    const dMark = sAtt.find((a: Attendance) => a.date === dateStr && a.mealType === 'dinner');
                    if (onLeave) dPermission++;
                    else if (dMark?.status === 'present') dPresent++;
                    else if (dMark?.status === 'absent') dAbsent++;
                }

                return {
                    "S.No": idx + 1,
                    "Name": s.fullName,
                    "Room": s.roomNumber,
                    "User ID": s.userId,
                    "Phone": s.phoneNumber,
                    "Breakfast Present": bPresent,
                    "Breakfast Absent": bAbsent,
                    "Breakfast Permission": bPermission,
                    "Dinner Present": dPresent,
                    "Dinner Absent": dAbsent,
                    "Dinner Permission": dPermission
                };
            });

            const worksheet = utils.json_to_sheet(rows);
            const workbook = utils.book_new();
            utils.book_append_sheet(workbook, worksheet, "Monthly Attendance");
            writeFile(workbook, `Monthly_Attendance_${selectedMonth}.xlsx`);
            
            toast({ title: "Excel Generated", description: `Excel file for ${selectedMonth} is ready.` });
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const updateStudentStatus = async (student: Student, newStatus: string) => {
        try {
            const res = await fetch(`/api/admin/update-student-status/${student.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) {
                toast({ title: "Status Updated", description: `${student.fullName} is now marked as ${newStatus}.` });
                fetchDashboard();
            } else {
                throw new Error("Failed to update status.");
            }
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        }
    };

    const sendWarning = async (student: Student) => {
        try {
            const res = await fetch("/api/admin/warn-student", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: student.userId })
            });
            const result = await res.json();
            if (res.ok) {
                toast({
                    title: "Warning Sent",
                    description: result.message,
                    variant: "destructive",
                });
                fetchDashboard();
            } else {
                throw new Error(result.message);
            }
        } catch (e: any) {
            toast({
                title: "Error",
                description: e.message || "Failed to issue warning.",
                variant: "destructive",
            });
        }
    };

    const removeWarning = async (student: Student) => {
        if (!confirm(`Remove a warning from ${student.fullName}?`)) return;
        try {
            const res = await fetch("/api/admin/remove-warning", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: student.userId })
            });
            const result = await res.json();
            if (res.ok) {
                toast({
                    title: "Warning Removed",
                    description: result.message,
                    className: "bg-green-600/20 text-green-300 border-green-500",
                });
                fetchDashboard();
            } else {
                throw new Error(result.message);
            }
        } catch (e: any) {
            toast({
                title: "Error",
                description: e.message || "Failed to remove warning.",
                variant: "destructive",
            });
        }
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
            <div className="min-h-[100dvh] flex items-center justify-center p-4">
                <div className="w-10 h-10 border-4 border-magenta-500/30 border-t-magenta-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!data) return null;

    const { students, attendances, date, sundayTokens, stats } = data;
    const breakfastPresent = attendances.filter(a => a.mealType === "breakfast" && a.status === "present").length;
    const dinnerPresent = attendances.filter(a => a.mealType === "dinner" && a.status === "present").length;
    const pendingCount = students.filter(s => !s.isApproved).length;

    return (
        <div className="min-h-[100dvh] p-3 sm:p-6 lg:p-8 relative">
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
                                className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground font-display tracking-widest text-xs transition-all"
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

            {/* Registered Students Modal (Approved Only) */}
            {showStudentsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="glass-card w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl border border-white/20 overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-white/10 flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center bg-white/5">
                            <div>
                                <h2 className="font-display tracking-widest text-xl font-bold text-white uppercase">Registered Student List</h2>
                                <p className="text-sm text-muted-foreground mt-1">Total Approved: {students.filter(s => s.isApproved).length}</p>
                            </div>
                            <div className="flex items-center flex-wrap gap-3">
                                {selectedStudents.length > 0 && (
                                    <button
                                        onClick={handleBulkDelete}
                                        disabled={isBulkDeleting}
                                        className="px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 transition-all text-xs font-display tracking-widest font-bold flex items-center gap-2"
                                    >
                                        <Trash2 className="w-4 h-4" /> {isBulkDeleting ? '...' : `REJECT SELECTED (${selectedStudents.length})`}
                                    </button>
                                )}
                                <select
                                    value={statusFilter}
                                    onChange={e => setStatusFilter(e.target.value)}
                                    className="glass-input px-3 py-2 rounded-xl text-[10px] border border-white/10 bg-black/40 text-white font-display tracking-widest"
                                >
                                    <option value="Active">Active</option>
                                    <option value="Left Hostel">Left Hostel</option>
                                    <option value="Suspended">Suspended</option>
                                    <option value="Completed">Completed</option>
                                    <option value="">All Status</option>
                                </select>
                                <input
                                    type="text"
                                    placeholder="Year (e.g. 2025)"
                                    value={yearFilter}
                                    onChange={e => setYearFilter(e.target.value)}
                                    className="glass-input px-3 py-2 rounded-xl text-xs w-24 border border-white/10 font-display tracking-widest"
                                />
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={studentSearchQuery}
                                    onChange={e => setStudentSearchQuery(e.target.value)}
                                    className="glass-input px-4 py-2 rounded-xl text-sm w-full sm:w-48 border border-white/10"
                                />
                                <button onClick={() => { setShowStudentsModal(false); setSelectedStudents([]); }} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                    <X className="w-6 h-6 text-white/50" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto p-4 sm:p-6 custom-scrollbar">
                            <div className="overflow-x-auto rounded-xl border border-white/10 shadow-inner">
                                <table className="w-full text-left border-collapse bg-white/5">
                                    <thead className="bg-white/5 border-b border-white/10 sticky top-0 z-10 backdrop-blur-md">
                                        <tr className="text-[10px] uppercase tracking-widest text-muted-foreground font-display">
                                            <th className="p-4 text-center">
                                                <input 
                                                    type="checkbox" 
                                                    className="accent-magenta-400 w-4 h-4"
                                                    onChange={(e) => handleSelectAll(e.target.checked, 'approved')}
                                                />
                                            </th>
                                            <th className="p-4 font-normal">Student Info</th>
                                            <th className="p-4 font-normal">ID / Room</th>
                                            <th className="p-4 font-normal">Joined / Left</th>
                                            <th className="p-4 font-normal">Status</th>
                                            <th className="p-4 font-normal text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {students.filter(s => s.isApproved && (
                                            (s.fullName.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
                                            s.userId.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
                                            s.email.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
                                            (s.ipAddress && s.ipAddress.includes(studentSearchQuery)) ||
                                            (s.roomNumber && s.roomNumber.toLowerCase().includes(studentSearchQuery.toLowerCase()))) &&
                                            (!statusFilter || s.status === statusFilter) &&
                                            (!yearFilter || (s.joiningMonthYear && s.joiningMonthYear.includes(yearFilter)))
                                        )).map((s) => (
                                            <tr key={s.id} className={`hover:bg-white/5 transition-colors ${selectedStudents.includes(s.id) ? 'bg-magenta-500/10' : ''}`}>
                                                <td className="p-4 text-center">
                                                    <input 
                                                        type="checkbox" 
                                                        className="accent-magenta-400 w-4 h-4"
                                                        checked={selectedStudents.includes(s.id)}
                                                        onChange={() => toggleSelect(s.id)}
                                                    />
                                                </td>
                                                <td className="p-4">
                                                    <div className="text-white font-medium whitespace-nowrap flex items-center gap-2">
                                                        {s.fullName}
                                                        {s.warnings && s.warnings > 0 && <span className="bg-red-500/20 text-red-400 text-[8px] px-1.5 py-0.5 rounded border border-red-500/30">{s.warnings}W</span>}
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground">{s.phoneNumber}</div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="text-cyan-400 font-mono text-xs">{s.userId}</div>
                                                    <div className="text-magenta-300 font-medium text-[10px]">ROOM: {s.roomNumber || 'N/A'}</div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="text-[10px] text-white/70">IN: {s.joiningMonthYear || '-'}</div>
                                                    {s.leavingMonthYear && <div className="text-[10px] text-red-400/70">OUT: {s.leavingMonthYear}</div>}
                                                </td>
                                                <td className="p-4">
                                                    <select
                                                        value={s.status}
                                                        onChange={(e) => updateStudentStatus(s, e.target.value)}
                                                        className={`px-2 py-1 rounded-lg text-[9px] font-bold border transition-all bg-black/40 ${
                                                            s.status === 'Active' ? 'bg-green-500/20 border-green-500/50 text-green-400' :
                                                            s.status === 'Left Hostel' ? 'bg-red-500/20 border-red-500/50 text-red-400' :
                                                            'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
                                                        }`}
                                                    >
                                                        <option value="Active">Active</option>
                                                        <option value="Left Hostel">Left Hostel</option>
                                                        <option value="Suspended">Suspended</option>
                                                        <option value="Completed">Completed</option>
                                                    </select>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <div className="flex justify-center gap-2">
                                                        <button onClick={() => sendWarning(s)} className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20" title="Issue Warning"><AlertTriangle className="w-3.5 h-3.5" /></button>
                                                        <button onClick={() => handleDeleteStudent(s)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-red-400 border border-white/10" title="Remove Student"><Trash2 className="w-3.5 h-3.5" /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Admin Approval Panel Modal (Pending Only) */}
            {showApprovalsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="glass-card w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-white/20 overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-white/10 flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center bg-white/5">
                            <div>
                                <h2 className="font-display tracking-widest text-xl font-bold text-white uppercase">Pending Approvals Panel</h2>
                                <p className="text-sm text-muted-foreground mt-1">Awaiting Decision: {pendingCount} Students</p>
                            </div>
                            <div className="flex items-center flex-wrap gap-4">
                                {selectedStudents.length > 0 && (
                                    <div className="flex gap-2">
                                        <button onClick={handleBulkApprove} className="px-4 py-2 rounded-xl bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 transition-all text-xs font-display tracking-widest font-bold flex items-center gap-2">
                                            <CheckCheck className="w-4 h-4" /> APPROVE ({selectedStudents.length})
                                        </button>
                                        <button onClick={handleBulkDelete} className="px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 transition-all text-xs font-display tracking-widest font-bold flex items-center gap-2">
                                            <Trash2 className="w-4 h-4" /> REJECT
                                        </button>
                                    </div>
                                )}
                                <input
                                    type="text"
                                    placeholder="Search pending..."
                                    value={approvalSearchQuery}
                                    onChange={e => setApprovalSearchQuery(e.target.value)}
                                    className="glass-input px-4 py-2 rounded-xl text-sm w-full sm:w-48 border border-white/10"
                                />
                                <button onClick={() => { setShowApprovalsModal(false); setSelectedStudents([]); }} className="p-2 rounded-full hover:bg-white/10 text-muted-foreground hover:text-white transition">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto p-4 sm:p-6 custom-scrollbar">
                            <div className="overflow-x-auto rounded-xl border border-white/10">
                                <table className="w-full text-left border-collapse bg-white/5">
                                    <thead className="bg-white/5 border-b border-white/10 sticky top-0 z-10 backdrop-blur-md">
                                        <tr className="text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground font-display">
                                            <th className="p-4 text-center">
                                                <input 
                                                    type="checkbox" 
                                                    className="accent-magenta-400 w-4 h-4"
                                                    onChange={(e) => handleSelectAll(e.target.checked, 'pending')}
                                                />
                                            </th>
                                            <th className="p-4 font-normal">Full Name</th>
                                            <th className="p-4 font-normal">User ID</th>
                                            <th className="p-4 font-normal">Room</th>
                                            <th className="p-4 font-normal text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {students.filter(s => !s.isApproved && (
                                            s.fullName.toLowerCase().includes(approvalSearchQuery.toLowerCase()) ||
                                            s.userId.toLowerCase().includes(approvalSearchQuery.toLowerCase())
                                        )).map((s) => (
                                            <tr key={s.id} className={`hover:bg-white/5 transition-colors ${selectedStudents.includes(s.id) ? 'bg-magenta-500/10' : ''}`}>
                                                <td className="p-4 text-center">
                                                    <input type="checkbox" className="accent-magenta-400 w-4 h-4" checked={selectedStudents.includes(s.id)} onChange={() => toggleSelect(s.id)} />
                                                </td>
                                                <td className="p-4 text-white font-medium whitespace-nowrap">{s.fullName}</td>
                                                <td className="p-4 text-cyan-400 font-mono text-sm">{s.userId}</td>
                                                <td className="p-4 text-magenta-300 font-medium">{s.roomNumber}</td>
                                                <td className="p-4 text-center">
                                                    <div className="flex justify-center gap-2">
                                                        <button onClick={() => handleApproveStudent(s)} className="p-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20" title="Approve"><CheckCircle2 className="w-4 h-4" /></button>
                                                        <button onClick={() => handleDeleteStudent(s)} className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20" title="Reject"><XCircle className="w-4 h-4" /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto relative z-10 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                {/* Header Section */}
                <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-2xl bg-magenta-500/20 border border-magenta-500/30 shadow-[0_0_20px_rgba(236,72,153,0.2)]">
                                <Users className="w-6 h-6 text-magenta-400" />
                            </div>
                            <h1 className="text-3xl font-display font-black tracking-tighter text-white uppercase sm:text-4xl">Admin <span className="text-transparent bg-clip-text bg-gradient-to-r from-magenta-400 to-cyan-400">Core</span></h1>
                        </div>
                        <p className="text-muted-foreground text-xs font-bold tracking-[0.2em] uppercase flex items-center gap-2">
                            <span className="flex h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                            Management Center • {date}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => { localStorage.removeItem('user'); window.location.href = '/'; }} className="px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-display tracking-widest text-[10px] font-bold flex items-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-lg">
                            <LogOut className="w-4 h-4 text-magenta-400" /> SIGN OUT
                        </button>
                    </div>
                </header>

                {/* Capacity Stats Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="glass-card p-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 group hover:bg-cyan-500/10 transition-all">
                        <p className="text-[9px] uppercase tracking-widest text-cyan-400 font-display font-bold mb-1">Active Students</p>
                        <h3 className="text-3xl font-display font-black text-white">{stats.totalActive} <span className="text-sm text-white/30 font-normal">/ 150</span></h3>
                        <div className="mt-3 w-full h-1 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]" style={{ width: `${(stats.totalActive/150)*100}%` }}></div>
                        </div>
                    </div>
                    <div className="glass-card p-5 rounded-2xl border border-magenta-500/20 bg-magenta-500/5 group hover:bg-magenta-500/10 transition-all">
                        <p className="text-[9px] uppercase tracking-widest text-magenta-400 font-display font-bold mb-1">Available Seats</p>
                        <h3 className="text-3xl font-display font-black text-white">{stats.availableSeats}</h3>
                        <p className="text-[10px] text-white/30 mt-2 uppercase tracking-widest font-display">Instantly Updated</p>
                    </div>
                    <div className="glass-card p-5 rounded-2xl border border-orange-500/20 bg-orange-500/5 group hover:bg-orange-500/10 transition-all">
                        <p className="text-[9px] uppercase tracking-widest text-orange-400 font-display font-bold mb-1">Left Hostel</p>
                        <h3 className="text-3xl font-display font-black text-white">{stats.totalLeft}</h3>
                        <p className="text-[10px] text-white/30 mt-2 uppercase tracking-widest font-display">Historical Data Preserved</p>
                    </div>
                    <div className="glass-card p-5 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 group hover:bg-yellow-500/10 transition-all">
                        <p className="text-[9px] uppercase tracking-widest text-yellow-400 font-display font-bold mb-1">Pending Request</p>
                        <h3 className="text-3xl font-display font-black text-white">{pendingCount}</h3>
                        <button onClick={() => setShowApprovalsModal(true)} className="mt-2 text-[9px] text-yellow-400 hover:text-white font-bold uppercase tracking-widest font-display flex items-center gap-1 transition-colors">
                            APPROVE QUEUE <Send className="w-3 h-3" />
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="space-y-6">
                    {/* Navigation Tabs */}
                    <div className="flex gap-2 bg-white/5 p-1 rounded-2xl border border-white/10 w-fit">
                        <button onClick={() => setActiveTab("dashboard")} className={`px-6 py-2.5 rounded-xl text-[10px] font-display tracking-widest font-bold transition-all ${activeTab === "dashboard" ? "bg-white/10 text-white shadow-lg border border-white/20" : "text-white/40 hover:text-white/70"}`}>DASHBOARD</button>
                        <button onClick={() => setActiveTab("leave")} className={`px-6 py-2.5 rounded-xl text-[10px] font-display tracking-widest font-bold transition-all flex items-center gap-2 ${activeTab === "leave" ? "bg-white/10 text-white shadow-lg border border-white/20" : "text-white/40 hover:text-white/70"}`}>LEAVE REQS {leaveRequests.filter(l => l.status === 'pending').length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse"></span>}</button>
                        <button onClick={() => setActiveTab("password")} className={`px-6 py-2.5 rounded-xl text-[10px] font-display tracking-widest font-bold transition-all ${activeTab === "password" ? "bg-white/10 text-white shadow-lg border border-white/20" : "text-white/40 hover:text-white/70"}`}>SECURITY</button>
                    </div>

                    {activeTab === "dashboard" ? (
                        <>
                            {/* Toolbar & Controls */}
                            <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
                                <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                                    <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="glass-input px-5 py-3 rounded-2xl w-full sm:w-64 text-xs font-display tracking-widest border border-white/10 focus:border-cyan-500 transition-all outline-none" />
                                    <div className="flex gap-2 w-full sm:w-auto">
                                        <button onClick={() => setSelectedDate(todayIST)} className={`flex-1 sm:flex-none px-4 py-3 rounded-2xl text-[9px] font-display font-bold tracking-widest transition-all border ${selectedDate === todayIST ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white'}`}>TODAY</button>
                                        <button onClick={() => setSelectedDate(tomorrowIST)} className={`flex-1 sm:flex-none px-4 py-3 rounded-2xl text-[9px] font-display font-bold tracking-widest transition-all border ${selectedDate === tomorrowIST ? 'bg-magenta-500/20 border-magenta-500/50 text-magenta-300' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white'}`}>TOMORROW</button>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                                    <button onClick={() => setShowStudentsModal(true)} className="flex-1 lg:flex-none px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-display tracking-widest text-[9px] font-bold flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95"><Users className="w-3.5 h-3.5 text-cyan-400" /> MANAGE DIRECTORY</button>
                                    <button onClick={() => setShowSuspiciousModal(true)} className="flex-1 lg:flex-none px-6 py-3 rounded-2xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-display tracking-widest text-[9px] font-bold flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 relative">
                                        <AlertTriangle className="w-3.5 h-3.5" /> 
                                        SECURITY CENTER
                                        {suspiciousUsers.length > 0 && <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] text-white shadow-lg animate-bounce">{suspiciousUsers.length}</span>}
                                    </button>
                                    <button onClick={() => setActiveTab("leave")} className="flex-1 lg:flex-none px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-display tracking-widest text-[9px] font-bold flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95"><ClipboardList className="w-3.5 h-3.5 text-orange-400" /> LEAVE REQS</button>
                                </div>
                            </div>

                            {/* Reports & Settings Card */}
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                <div className="glass-card p-6 rounded-3xl border border-white/10 bg-white/5 space-y-6">
                                    <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                                        <Download className="w-5 h-5 text-cyan-400" />
                                        <h3 className="font-display text-base font-bold tracking-widest text-white uppercase">Reporting Center</h3>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-4 items-end">
                                        <div className="flex-1 space-y-1.5 w-full">
                                            <label className="text-[9px] text-white/40 uppercase tracking-[0.2em] font-bold ml-1">Select Report Month</label>
                                            <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="glass-input px-5 py-3 rounded-2xl text-xs font-display tracking-widest border border-white/10 focus:border-cyan-500 outline-none w-full" />
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={downloadMonthlyPDF} className="p-3.5 rounded-2xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 transition-all" title="Monthly PDF"><Download className="w-5 h-5" /></button>
                                            <button onClick={downloadExcel} className="p-3.5 rounded-2xl bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 transition-all" title="Monthly Excel"><Download className="w-5 h-5" /></button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 pt-2">
                                        <button onClick={() => downloadMealPDF('breakfast')} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[9px] font-display font-bold tracking-widest transition-all hover:bg-cyan-500/20"><Download className="w-3.5 h-3.5" /> BREAKFAST PDF</button>
                                        <button onClick={() => downloadMealPDF('dinner')} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-magenta-500/10 border border-magenta-500/30 text-magenta-400 text-[9px] font-display font-bold tracking-widest transition-all hover:bg-magenta-500/20"><Download className="w-3.5 h-3.5" /> DINNER PDF</button>
                                    </div>
                                </div>

                                <div className="glass-card p-6 rounded-3xl border border-white/10 bg-white/5 space-y-6">
                                    <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                                        <SettingsIcon className="w-5 h-5 text-magenta-400" />
                                        <h3 className="font-display text-base font-bold tracking-widest text-white uppercase">Time Config</h3>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[8px] text-white/30 uppercase tracking-widest font-bold">B-Start</label>
                                            <input type="time" value={settings.breakfastStart} onChange={(e) => setSettings({ ...settings, breakfastStart: e.target.value })} className="glass-input p-2 rounded-xl text-xs w-full border border-white/10" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[8px] text-white/30 uppercase tracking-widest font-bold">B-End</label>
                                            <input type="time" value={settings.breakfastEnd} onChange={(e) => setSettings({ ...settings, breakfastEnd: e.target.value })} className="glass-input p-2 rounded-xl text-xs w-full border border-white/10" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[8px] text-white/30 uppercase tracking-widest font-bold">D-Start</label>
                                            <input type="time" value={settings.dinnerStart} onChange={(e) => setSettings({ ...settings, dinnerStart: e.target.value })} className="glass-input p-2 rounded-xl text-xs w-full border border-white/10" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[8px] text-white/30 uppercase tracking-widest font-bold">D-End</label>
                                            <input type="time" value={settings.dinnerEnd} onChange={(e) => setSettings({ ...settings, dinnerEnd: e.target.value })} className="glass-input p-2 rounded-xl text-xs w-full border border-white/10" />
                                        </div>
                                    </div>
                                    <button onClick={handleSaveSettings} disabled={savingSettings} className="w-full py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/20 text-white font-display font-bold tracking-[0.2em] text-[10px] uppercase transition-all shadow-lg active:scale-95">{savingSettings ? 'SAVING...' : 'UPDATE SYSTEM TIMES'}</button>
                                </div>
                            </div>

                            {/* Attendance Roster Table */}
                            <div className="glass-card rounded-3xl border border-white/10 bg-white/5 overflow-hidden">
                                <div className="p-6 border-b border-white/10 bg-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-1.5 h-8 bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.6)]"></div>
                                        <div>
                                            <h3 className="font-display text-lg font-black tracking-widest text-white uppercase">Live Attendance Roster</h3>
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">Monitoring {stats.totalActive} Active Students • {date}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="flex flex-col items-center px-4 py-2 rounded-2xl bg-cyan-500/5 border border-cyan-500/20">
                                            <span className="text-[9px] text-cyan-400 font-bold uppercase tracking-widest">Breakfast</span>
                                            <span className="text-xl font-display font-black text-white">{breakfastPresent} <span className="text-[10px] text-white/30 font-normal">/ {stats.totalActive}</span></span>
                                        </div>
                                        <div className="flex flex-col items-center px-4 py-2 rounded-2xl bg-magenta-500/5 border border-magenta-500/20">
                                            <span className="text-[9px] text-magenta-400 font-bold uppercase tracking-widest">Dinner</span>
                                            <span className="text-xl font-display font-black text-white">{dinnerPresent} <span className="text-[10px] text-white/30 font-normal">/ {stats.totalActive}</span></span>
                                        </div>
                                    </div>
                                </div>

                                <div className="overflow-x-auto p-4 sm:p-6 custom-scrollbar">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="text-[10px] uppercase tracking-widest text-muted-foreground font-display">
                                                <th className="p-4 font-normal">Student Profile</th>
                                                <th className="p-4 font-normal text-center">Breakfast Status</th>
                                                <th className="p-4 font-normal text-center">Dinner Status</th>
                                                <th className="p-4 font-normal text-center">Sunday Access</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {students.filter(s => s.isApproved && s.status === 'Active').map((student) => {
                                                const bMark = attendances.find(a => a.userId === student.userId && a.mealType === 'breakfast');
                                                const dMark = attendances.find(a => a.userId === student.userId && a.mealType === 'dinner');
                                                const token = sundayTokens[student.userId];

                                                return (
                                                    <tr key={student.id} className="hover:bg-white/5 transition-colors group">
                                                        <td className="p-4">
                                                            <div className="text-white font-bold tracking-tight text-sm flex items-center gap-2">
                                                                {student.fullName}
                                                                {student.warnings && student.warnings > 0 && <span className="text-[8px] bg-red-500/20 text-red-400 px-1 rounded-sm border border-red-500/30">{student.warnings}</span>}
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                                                <span className="text-cyan-400 font-mono text-[10px]">{student.userId}</span>
                                                                <span className="text-white/20 text-[10px]">|</span>
                                                                <span className="text-magenta-300 font-bold text-[10px] uppercase tracking-widest">Room {student.roomNumber}</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-4"><div className="flex justify-center scale-90 sm:scale-100">{renderMarkBadge(bMark)}</div></td>
                                                        <td className="p-4"><div className="flex justify-center scale-90 sm:scale-100">{renderMarkBadge(dMark)}</div></td>
                                                        <td className="p-4">
                                                            <div className="flex justify-center">
                                                                {token ? (
                                                                    <div className="flex flex-col items-center">
                                                                        <div className="px-3 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-mono text-xs font-bold shadow-inner">
                                                                            {token.split(':')[0]}
                                                                        </div>
                                                                        <span className="text-[8px] text-cyan-400/50 mt-1 uppercase tracking-widest font-bold">Token Valid</span>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-[9px] text-muted-foreground/30 uppercase tracking-widest font-display">No Token</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    ) : activeTab === "leave" ? (
                        /* Leave Requests Table */
                        <div className="glass-card rounded-3xl border border-white/10 bg-white/5 overflow-hidden animate-in fade-in slide-in-from-right-8 duration-500">
                            <div className="p-6 border-b border-white/10 bg-white/5 flex items-center gap-4">
                                <div className="w-1.5 h-8 bg-orange-500 rounded-full shadow-[0_0_10px_rgba(249,115,22,0.6)]"></div>
                                <h3 className="font-display text-lg font-black tracking-widest text-white uppercase">Leave Request Management</h3>
                            </div>
                            <div className="overflow-x-auto p-4 sm:p-6 custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="text-[10px] uppercase tracking-widest text-muted-foreground font-display">
                                            <th className="p-4 font-normal">Student</th>
                                            <th className="p-4 font-normal">Dates</th>
                                            <th className="p-4 font-normal">Reason</th>
                                            <th className="p-4 font-normal text-center">Status</th>
                                            <th className="p-4 font-normal text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {leaveRequests.length === 0 ? (
                                            <tr><td colSpan={5} className="p-12 text-center text-muted-foreground font-display tracking-widest uppercase text-xs">No records found</td></tr>
                                        ) : (
                                            leaveRequests.map(lr => {
                                                const student = students.find(s => s.userId === lr.userId);
                                                return (
                                                    <tr key={lr.id} className="hover:bg-white/5 transition-colors">
                                                        <td className="p-4">
                                                            <div className="text-white font-bold text-sm">{student?.fullName || 'User'}</div>
                                                            <div className="text-[10px] text-orange-400/70 font-mono">{lr.userId}</div>
                                                        </td>
                                                        <td className="p-4 whitespace-nowrap">
                                                            <div className="text-xs text-white/80"><span className="text-orange-400 font-bold">{lr.startDate}</span> to <span className="text-orange-400 font-bold">{lr.endDate}</span></div>
                                                        </td>
                                                        <td className="p-4"><p className="text-[10px] text-white/60 italic max-w-xs truncate">"{lr.reason}"</p></td>
                                                        <td className="p-4">
                                                            <div className="flex justify-center">
                                                                <span className={`text-[9px] font-bold tracking-widest uppercase px-3 py-1 rounded-full border ${lr.status === 'approved' ? 'bg-green-500/20 border-green-500/40 text-green-400' : lr.status === 'rejected' ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'bg-orange-500/20 border-orange-500/40 text-orange-400'}`}>
                                                                    {lr.status}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-right">
                                                            {lr.status === 'pending' ? (
                                                                <button onClick={() => setShowLeaveModal(lr)} className="px-4 py-2 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 text-[9px] font-display font-bold tracking-widest transition-all">MANAGE</button>
                                                            ) : <span className="text-[9px] text-white/20 uppercase font-bold tracking-widest">PROCESSED</span>}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        /* Security / Change Password */
                        <div className="glass-card max-w-md mx-auto p-8 rounded-3xl border border-white/10 space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
                            <div className="text-center space-y-2">
                                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-cyan-500/10 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)] mb-2"><Lock className="w-7 h-7" /></div>
                                <h2 className="font-display text-xl font-black tracking-widest text-white uppercase">Security Protocol</h2>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-bold">Update Admin Authentication</p>
                            </div>
                            <form onSubmit={handleChangePassword} className="space-y-5">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-display font-bold tracking-[0.2em] text-cyan-400 uppercase ml-1">Current Secret</label>
                                    <input type={showPassword ? "text" : "password"} required value={passwordData.current} onChange={e => setPasswordData({ ...passwordData, current: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white focus:border-cyan-400 outline-none transition-all" placeholder="Current Password" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-display font-bold tracking-[0.2em] text-cyan-400 uppercase ml-1">New Secret</label>
                                    <input type={showPassword ? "text" : "password"} required value={passwordData.new} onChange={e => setPasswordData({ ...passwordData, new: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white focus:border-cyan-400 outline-none transition-all" placeholder="New Password" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-display font-bold tracking-[0.2em] text-cyan-400 uppercase ml-1">Verify Secret</label>
                                    <input type={showPassword ? "text" : "password"} required value={passwordData.confirm} onChange={e => setPasswordData({ ...passwordData, confirm: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white focus:border-cyan-400 outline-none transition-all" placeholder="Confirm Password" />
                                </div>
                                <div className="flex items-center gap-2 ml-1 cursor-pointer" onClick={() => setShowPassword(!showPassword)}>
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${showPassword ? 'bg-cyan-500 border-cyan-500' : 'border-white/20'}`}>{showPassword && <CheckCircle className="w-3 h-3 text-black" />}</div>
                                    <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold">Show Characters</span>
                                </div>
                                <button type="submit" disabled={loading} className="w-full py-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-black font-display font-black uppercase tracking-[0.2em] text-xs shadow-[0_0_20px_rgba(6,182,212,0.5)] transition-all active:scale-95 disabled:opacity-50">{loading ? "PROCESSING..." : "COMMIT CHANGES"}</button>
                            </form>
                        </div>
                    )}
                </div>
                {/* Suspicious Accounts Modal */}
                {showSuspiciousModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="glass-card w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-red-500/30 overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200">
                            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-red-500/5">
                                <div>
                                    <h2 className="font-display tracking-widest text-xl font-bold text-red-400 uppercase flex items-center gap-2">
                                        <AlertTriangle className="w-6 h-6" /> Suspicious Accounts
                                    </h2>
                                    <p className="text-sm text-red-200/60 mt-1">Flagged for multiple accounts, common IP, or device fingerprinting.</p>
                                </div>
                                <button onClick={() => setShowSuspiciousModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                    <X className="w-6 h-6 text-white" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-auto p-4 sm:p-6 custom-scrollbar">
                                <div className="grid grid-cols-1 gap-4">
                                    {suspiciousUsers.length === 0 ? (
                                        <div className="text-center py-12 text-muted-foreground">No suspicious accounts flagged at this time.</div>
                                    ) : (
                                        suspiciousUsers.map(user => (
                                            <div key={user.id} className="p-4 rounded-xl border border-white/10 bg-white/5 hover:border-red-500/30 transition-all">
                                                <div className="flex flex-col sm:flex-row justify-between gap-4">
                                                    <div className="space-y-2">
                                                        <div className="flex items-center gap-3">
                                                            <span className="font-bold text-white text-lg">{user.fullName}</span>
                                                            <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold tracking-widest uppercase">Score: {user.suspiciousScore}</span>
                                                            {user.isBanned && <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold tracking-widest uppercase ml-auto">BANNED</span>}
                                                        </div>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-xs text-muted-foreground">
                                                            <p>User ID: <span className="text-white">{user.userId}</span></p>
                                                            <p>Email: <span className="text-white">{user.email}</span></p>
                                                            <p>IP Address: <span className="text-white">{user.ipAddress}</span></p>
                                                            <p>Device Fingerprint: <span className="text-white font-mono text-[10px]">{user.deviceFingerprint?.substring(0, 8)}...</span></p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {!user.isApproved && (
                                                            <button 
                                                                onClick={() => handleApproveStudent(user)}
                                                                className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 text-xs font-bold transition-all"
                                                            >
                                                                APPROVE
                                                            </button>
                                                        )}
                                                        <button 
                                                            onClick={() => handleBanUser(user.id, !user.isBanned)}
                                                            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg ${user.isBanned ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30' : 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30'} text-xs font-bold transition-all`}
                                                        >
                                                            {user.isBanned ? 'UNBAN' : 'BAN USER'}
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteStudent(user)}
                                                            className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-white hover:text-red-400 border border-white/10 transition-all"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function Clock(props: any) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
    )
}
