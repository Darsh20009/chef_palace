import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useTranslate } from "@/lib/useTranslate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Coffee, ArrowRight, Calendar, Clock, User, MapPin, 
  Camera, CheckCircle2, XCircle, AlertTriangle, Search,
  Download, Filter, Users, FileText, Check, X, Trophy, TrendingDown, TrendingUp, Star,
  Navigation, Radio, AlertOctagon, ExternalLink
} from "lucide-react";
import * as XLSX from 'xlsx';
import type { Employee } from "@shared/schema";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { MapContainer, TileLayer, Marker, Popup, Circle, Tooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default marker icons in bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const branchIcon = L.divIcon({
  className: "",
  html: `<div style="background:#16a34a;color:white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:18px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);">🏪</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

function makeEmployeeIcon(inside: boolean) {
  const bg = inside ? "#16a34a" : "#dc2626";
  return L.divIcon({
    className: "",
    html: `<div style="background:${bg};color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:15px;border:2px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.4);">👤</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

interface LeaveRequest {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  numberOfDays: number;
  rejectionReason?: string;
  createdAt: string;
  employee?: {
    fullName: string;
    imageUrl?: string;
  };
}

interface AttendanceRecord {
  id: string;
  employeeId: string;
  branchId: string;
  checkInTime: string;
  checkOutTime?: string;
  checkInLocation: { lat: number; lng: number };
  checkOutLocation?: { lat: number; lng: number };
  checkInPhoto: string;
  checkOutPhoto?: string;
  status: 'checked_in' | 'checked_out' | 'late' | 'absent';
  shiftDate: string;
  isLate: number;
  lateMinutes?: number;
  isAtBranch?: number;
  distanceFromBranch?: number;
  checkOutIsAtBranch?: number;
  checkOutDistanceFromBranch?: number;
  employee?: {
    fullName: string;
    phone: string;
    jobTitle: string;
    shiftTime: string;
    imageUrl?: string;
    role?: string;
  };
  branch?: {
    name: string;
    nameAr?: string;
  };
}

interface Branch {
  id: string;
  name?: string;
  nameAr?: string;
  location?: { lat: number; lng: number };
  geofenceRadius?: number;
}

export default function ManagerAttendance() {
  const [, setLocation] = useLocation();
  const tc = useTranslate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly' | 'live-tracking'>('daily');

  // Live tracking state
  interface LiveEmployee {
    attendanceId: string;
    employeeId: string;
    employeeName: string;
    employeePhoto?: string;
    jobTitle?: string;
    branchId: string;
    checkInTime: string;
    lastLocation: { lat: number; lng: number };
    isInsideBranch: boolean;
    distanceFromBranch: number;
    lastSeen: string;
  }
  const [liveEmployees, setLiveEmployees] = useState<LiveEmployee[]>([]);
  const [liveAlerts, setLiveAlerts] = useState<{ id: string; employeeId: string; employeeName: string; distanceFromBranch: number; time: string }[]>([]);
  const [selectedTrailEmployeeId, setSelectedTrailEmployeeId] = useState<string | null>(null);
  const [locationTrail, setLocationTrail] = useState<{ lat: number; lng: number; isInsideBranch: boolean; timestamp: string }[]>([]);
  const trackingWsRef = useRef<WebSocket | null>(null);
  const [monthlyReport, setMonthlyReport] = useState<any>(null);
  const [monthlyReportLoading, setMonthlyReportLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    const storedEmployee = localStorage.getItem("currentEmployee");
    if (storedEmployee) {
      const emp = JSON.parse(storedEmployee);
      if (emp.role !== 'manager' && emp.role !== 'branch_manager' && emp.role !== 'admin' && emp.role !== 'owner') {
        setLocation("/employee/gateway");
        return;
      }
      setEmployee(emp);
    } else {
      setLocation("/employee/gateway");
    }
  }, [setLocation]);

  useEffect(() => {
    if (employee) {
      fetchBranches();
      fetchAttendance();
      fetchLeaveRequests();
    }
  }, [employee, selectedDate, selectedBranch]);

  // Live tracking WebSocket + initial fetch
  const connectTrackingWs = useCallback(() => {
    if (trackingWsRef.current?.readyState === WebSocket.OPEN) return;
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws/orders`);
    trackingWsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: "subscribe",
        clientType: "manager-tracking",
        branchId: employee?.branchId || "all",
        userId: (employee as any)?._id || (employee as any)?.id,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "employee_location") {
          setLiveEmployees(prev => {
            const idx = prev.findIndex(e => e.employeeId === msg.employeeId);
            const updated: LiveEmployee = {
              attendanceId: msg.attendanceId,
              employeeId: msg.employeeId,
              employeeName: msg.employeeName || "موظف",
              employeePhoto: msg.employeePhoto,
              branchId: msg.branchId,
              checkInTime: prev[idx]?.checkInTime || new Date().toISOString(),
              lastLocation: msg.location,
              isInsideBranch: msg.isInsideBranch,
              distanceFromBranch: msg.distanceFromBranch,
              lastSeen: new Date(msg.timestamp).toISOString(),
            };
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = updated;
              return next;
            }
            return [...prev, updated];
          });
        } else if (msg.type === "employee_left_branch") {
          setLiveAlerts(prev => [{
            id: `${msg.employeeId}-${msg.timestamp}`,
            employeeId: msg.employeeId,
            employeeName: msg.employeeName || "موظف",
            distanceFromBranch: msg.distanceFromBranch,
            time: new Date(msg.timestamp).toLocaleTimeString('ar-SA'),
          }, ...prev.slice(0, 9)]);
        }
      } catch (_) {}
    };

    ws.onclose = () => {
      // Reconnect after 5 seconds
      setTimeout(() => {
        if (activeTab === 'live-tracking') connectTrackingWs();
      }, 5000);
    };
  }, [employee, activeTab]);

  const fetchLiveEmployees = useCallback(async () => {
    try {
      const res = await fetch('/api/attendance/live-employees', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setLiveEmployees(data);
      }
    } catch (_) {}
  }, []);

  const fetchLocationTrail = async (attendanceId: string) => {
    try {
      const res = await fetch(`/api/attendance/location-history/${attendanceId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setLocationTrail(data.map((d: any) => ({
          lat: d.lat,
          lng: d.lng,
          isInsideBranch: d.isInsideBranch,
          timestamp: d.timestamp,
        })));
      }
    } catch (_) {}
  };

  useEffect(() => {
    if (activeTab === 'live-tracking' && employee) {
      fetchLiveEmployees();
      connectTrackingWs();
    } else {
      if (trackingWsRef.current) {
        try { trackingWsRef.current.close(); } catch (_) {}
        trackingWsRef.current = null;
      }
    }
  }, [activeTab, employee]);

  // Refresh live employees every 60 seconds
  useEffect(() => {
    if (activeTab !== 'live-tracking') return;
    const interval = setInterval(fetchLiveEmployees, 60000);
    return () => clearInterval(interval);
  }, [activeTab, fetchLiveEmployees]);

  const fetchLeaveRequests = async () => {
    try {
      const response = await fetch('/api/leave-requests/pending', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setLeaveRequests(data);
      }
    } catch (error) {
      console.error("Error fetching leave requests:", error);
    }
  };

  const approveLeaveRequest = async (requestId: string) => {
    setApprovingId(requestId);
    try {
      const response = await fetch(`/api/leave-requests/${requestId}/approve`, {
        method: 'PATCH',
        credentials: 'include'
      });
      if (response.ok) {
        setLeaveRequests(leaveRequests.filter((r: any) => r.id !== requestId && r._id !== requestId));
      }
    } catch (error) {
      console.error("Error approving leave request:", error);
    } finally {
      setApprovingId(null);
    }
  };

  const rejectLeaveRequest = async (requestId: string) => {
    setRejectingId(requestId);
    try {
      const response = await fetch(`/api/leave-requests/${requestId}/reject`, {
        method: 'PATCH',
        credentials: 'include'
      });
      if (response.ok) {
        setLeaveRequests(leaveRequests.filter((r: any) => r.id !== requestId && r._id !== requestId));
      }
    } catch (error) {
      console.error("Error rejecting leave request:", error);
    } finally {
      setRejectingId(null);
    }
  };

  const fetchBranches = async () => {
    try {
      const response = await fetch('/api/branches', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setBranches(data);
      }
    } catch (error) {
      console.error("Error fetching branches:", error);
    }
  };

  const fetchAttendance = async () => {
    setIsLoading(true);
    try {
      let url = `/api/attendance?date=${selectedDate}`;
      if (selectedBranch !== 'all') {
        url += `&branchId=${selectedBranch}`;
      }
      const response = await fetch(url, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setAttendanceRecords(data);
      }
    } catch (error) {
      console.error("Error fetching attendance:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMonthlyReport = async () => {
    setMonthlyReportLoading(true);
    try {
      const [yearStr, monthStr] = selectedMonth.split('-');
      let url = `/api/attendance/monthly-report?year=${yearStr}&month=${parseInt(monthStr)}`;
      if (selectedBranch !== 'all') url += `&branchId=${selectedBranch}`;
      const response = await fetch(url, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setMonthlyReport(data);
      }
    } catch (error) {
      console.error("Error fetching monthly report:", error);
    } finally {
      setMonthlyReportLoading(false);
    }
  };

  const filteredRecords = attendanceRecords.filter(record => {
    if (searchQuery && !record.employee?.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !record.employee?.phone?.includes(searchQuery)) return false;
    if (selectedRole !== 'all' && record.employee?.role !== selectedRole) return false;
    if (selectedStatus !== 'all' && record.status !== selectedStatus) return false;
    return true;
  });

  const stats = {
    total: filteredRecords.length,
    present: filteredRecords.filter(r => r.status === 'checked_in' || r.status === 'checked_out').length,
    late: filteredRecords.filter(r => r.isLate === 1).length,
    checkedOut: filteredRecords.filter(r => r.status === 'checked_out').length,
    absent: filteredRecords.filter(r => r.status === 'absent').length
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const downloadReport = () => {
    const reportData = filteredRecords.map(r => [
      r.employee?.fullName || '',
      r.employee?.jobTitle || '',
      r.branch?.nameAr || r.branch?.name || '',
      formatTime(r.checkInTime),
      formatTime(r.checkOutTime),
      r.status === 'checked_out' ? tc('انصرف', 'Checked Out') : r.status === 'checked_in' ? tc('حاضر', 'Present') : tc('غائب', 'Absent'),
      r.lateMinutes ? r.lateMinutes : '-',
      r.isAtBranch === 1 ? tc('في الفرع', 'At Branch') : tc('خارج الفرع', 'Off Branch'),
      r.distanceFromBranch ? Math.round(r.distanceFromBranch) : 0,
      r.checkOutIsAtBranch === 1 ? tc('في الفرع', 'At Branch') : r.checkOutTime ? tc('خارج الفرع', 'Off Branch') : '-',
      r.checkOutDistanceFromBranch ? Math.round(r.checkOutDistanceFromBranch) : 0
    ]);

    const headers = [
      tc('الاسم', 'Name'),
      tc('الدور', 'Role'),
      tc('الفرع', 'Branch'),
      tc('وقت الحضور', 'Check-in Time'),
      tc('وقت الانصراف', 'Check-out Time'),
      tc('الحالة', 'Status'),
      tc('تأخير (دقيقة)', 'Delay (min)'),
      tc('الموقع عند الحضور', 'Check-in Location'),
      tc('المسافة (متر)', 'Distance (m)'),
      tc('موقع الانصراف', 'Check-out Location'),
      tc('مسافة الانصراف (متر)', 'Check-out Distance (m)')
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...reportData]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, tc('سجل الحضور', 'Attendance Log'));
    
    const fileName = `AttendanceLog_${selectedDate}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  if (!employee) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background p-4 pb-20">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
              <Coffee className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-accent">{tc("سجل الحضور", "Attendance Log")}</h1>
              <p className="text-gray-400 text-xs">{tc("إدارة حضور جميع الموظفين والمديرين", "Manage attendance for all employees and managers")}</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => setLocation("/manager/dashboard")}
            className="border-primary/50 text-accent"
            data-testid="button-back"
          >
            <ArrowRight className="w-4 h-4 ml-2" />
            العودة
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                <div>
                  <p className="text-blue-400 text-2xl font-bold">{stats.total}</p>
                  <p className="text-gray-400 text-xs">{tc("إجمالي", "Total")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <div>
                  <p className="text-green-400 text-2xl font-bold">{stats.present}</p>
                  <p className="text-gray-400 text-xs">{tc("حاضرون", "Present")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-accent/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-accent" />
                <div>
                  <p className="text-accent text-2xl font-bold">{stats.late}</p>
                  <p className="text-gray-400 text-xs">{tc("متأخرون", "Late")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <ArrowRight className="w-5 h-5 text-purple-400" />
                <div>
                  <p className="text-purple-400 text-2xl font-bold">{stats.checkedOut}</p>
                  <p className="text-gray-400 text-xs">{tc("انصرفوا", "Checked Out")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-500/20 to-red-600/10 border-red-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-400" />
                <div>
                  <p className="text-red-400 text-2xl font-bold">{stats.absent}</p>
                  <p className="text-gray-400 text-xs">{tc("غياب", "Absent")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <Button
            size="sm"
            variant={activeTab === 'daily' ? 'default' : 'outline'}
            onClick={() => setActiveTab('daily')}
            className={activeTab === 'daily' ? 'bg-primary text-white' : 'border-primary/30 text-gray-400'}
            data-testid="button-daily-tab"
          >
            <Calendar className="w-4 h-4 ml-2" />
            التقرير اليومي
          </Button>
          <Button
            size="sm"
            variant={activeTab === 'monthly' ? 'default' : 'outline'}
            onClick={() => { setActiveTab('monthly'); fetchMonthlyReport(); }}
            className={activeTab === 'monthly' ? 'bg-accent text-white' : 'border-primary/30 text-gray-400'}
            data-testid="button-monthly-tab"
          >
            <Trophy className="w-4 h-4 ml-2" />
            التقرير الشهري
          </Button>
          <Button
            size="sm"
            variant={activeTab === 'live-tracking' ? 'default' : 'outline'}
            onClick={() => setActiveTab('live-tracking')}
            className={activeTab === 'live-tracking' ? 'bg-red-600 text-white' : 'border-red-500/30 text-red-400'}
            data-testid="button-live-tracking-tab"
          >
            <Radio className="w-4 h-4 ml-2" />
            التتبع المباشر
            {liveAlerts.length > 0 && (
              <span className="mr-1 bg-white text-red-600 text-xs rounded-full px-1.5 font-bold">
                {liveAlerts.length}
              </span>
            )}
          </Button>
        </div>

        {/* Monthly Report Section */}
        {activeTab === 'monthly' && (
          <div className="space-y-4">
            <Card className="bg-gradient-to-br from-background to-background border-primary/20">
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-3 items-center">
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">الشهر</label>
                    <Input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="bg-[#1a1410] border-primary/20 text-white w-44"
                      data-testid="input-monthly-month"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">{tc("الفرع","Branch")}</label>
                    <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                      <SelectTrigger className="w-40 bg-[#1a1410] border-primary/20 text-white" data-testid="select-monthly-branch">
                        <SelectValue placeholder={tc("كل الفروع","All Branches")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{tc("كل الفروع","All Branches")}</SelectItem>
                        {branches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.nameAr || b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="mt-4">
                    <Button onClick={fetchMonthlyReport} className="bg-primary text-white" data-testid="button-fetch-monthly">
                      <Download className="w-4 h-4 ml-2" />
                      عرض التقرير
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {monthlyReportLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                <p className="text-gray-400 mt-4">جاري تحميل التقرير...</p>
              </div>
            ) : monthlyReport ? (
              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="bg-gradient-to-br from-green-900/30 to-green-950/20 border-green-500/20">
                    <CardContent className="p-4 text-center">
                      <p className="text-green-400 text-2xl font-bold">{monthlyReport.workDaysInMonth || 0}</p>
                      <p className="text-gray-400 text-xs mt-1">أيام العمل في الشهر</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-blue-900/30 to-blue-950/20 border-blue-500/20">
                    <CardContent className="p-4 text-center">
                      <p className="text-blue-400 text-2xl font-bold">{monthlyReport.totalEmployees || 0}</p>
                      <p className="text-gray-400 text-xs mt-1">عدد الموظفين</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-red-900/30 to-red-950/20 border-red-500/20">
                    <CardContent className="p-4 text-center">
                      <p className="text-red-400 text-2xl font-bold">{(monthlyReport.report || []).reduce((s: number, r: any) => s + (r.absentDays || 0), 0)}</p>
                      <p className="text-gray-400 text-xs mt-1">إجمالي الغيابات</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-amber-900/30 to-amber-950/20 border-amber-500/20">
                    <CardContent className="p-4 text-center">
                      <p className="text-amber-400 text-2xl font-bold">{(monthlyReport.report || []).reduce((s: number, r: any) => s + (r.totalLateMinutes || 0), 0)}</p>
                      <p className="text-gray-400 text-xs mt-1">إجمالي دقائق التأخير</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Best Employee Banner */}
                {monthlyReport.bestEmployee && (
                  <Card className="bg-gradient-to-br from-yellow-900/30 to-yellow-950/20 border-yellow-500/30">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                        <Trophy className="w-6 h-6 text-yellow-400" />
                      </div>
                      <div>
                        <p className="text-yellow-400 font-bold text-lg">{monthlyReport.bestEmployee.employee?.fullName}</p>
                        <p className="text-gray-400 text-sm">الموظف المثالي لشهر {selectedMonth}</p>
                        <div className="flex gap-3 mt-1 flex-wrap">
                          <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />{monthlyReport.bestEmployee.presentDays} يوم حضور</span>
                          <span className="text-xs text-red-400 flex items-center gap-1"><XCircle className="w-3 h-3" />{monthlyReport.bestEmployee.absentDays} غياب</span>
                          <span className="text-xs text-amber-400 flex items-center gap-1"><Clock className="w-3 h-3" />{monthlyReport.bestEmployee.lateDays} تأخير</span>
                          <span className="text-xs text-blue-400 flex items-center gap-1"><Star className="w-3 h-3" />{monthlyReport.bestEmployee.attendanceRate?.toFixed(1)}% حضور</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Employee Ranking Table */}
                <Card className="bg-gradient-to-br from-background to-background border-primary/20">
                  <CardHeader>
                    <CardTitle className="text-accent text-base flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      ترتيب الموظفين حسب الالتزام
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-primary/20 bg-[#1a1410]">
                            <th className="text-right py-3 px-4 text-gray-400 font-medium">#</th>
                            <th className="text-right py-3 px-4 text-gray-400 font-medium">الموظف</th>
                            <th className="text-right py-3 px-4 text-gray-400 font-medium">أيام الحضور</th>
                            <th className="text-right py-3 px-4 text-gray-400 font-medium">أيام الغياب</th>
                            <th className="text-right py-3 px-4 text-gray-400 font-medium">أيام التأخير</th>
                            <th className="text-right py-3 px-4 text-gray-400 font-medium">ساعات التأخير</th>
                            <th className="text-right py-3 px-4 text-gray-400 font-medium">ساعات العمل</th>
                            <th className="text-right py-3 px-4 text-gray-400 font-medium">نسبة الحضور</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(monthlyReport.report || []).map((emp: any, idx: number) => (
                            <tr key={emp.employee?.id || idx} className={`border-b border-primary/10 ${idx === 0 ? 'bg-yellow-900/10' : idx === 1 ? 'bg-gray-800/30' : idx === 2 ? 'bg-amber-900/10' : ''}`}>
                              <td className="py-3 px-4">
                                {idx === 0 ? <Trophy className="w-4 h-4 text-yellow-400" /> :
                                 idx === 1 ? <span className="text-gray-400 font-bold">2</span> :
                                 idx === 2 ? <span className="text-amber-600 font-bold">3</span> :
                                 <span className="text-gray-500">{idx + 1}</span>}
                              </td>
                              <td className="py-3 px-4 text-white font-medium">{emp.employee?.fullName || '-'}</td>
                              <td className="py-3 px-4 text-green-400 font-bold">{emp.presentDays}</td>
                              <td className="py-3 px-4 text-red-400 font-bold">{emp.absentDays}</td>
                              <td className="py-3 px-4 text-amber-400 font-bold">{emp.lateDays}</td>
                              <td className="py-3 px-4 text-orange-400">{Math.round((emp.totalLateMinutes || 0) / 60 * 10) / 10}h</td>
                              <td className="py-3 px-4 text-blue-400">{emp.totalWorkHours || 0}h</td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${emp.attendanceRate || 0}%` }} />
                                  </div>
                                  <span className={`text-xs font-bold ${(emp.attendanceRate || 0) >= 80 ? 'text-green-400' : (emp.attendanceRate || 0) >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                                    {(emp.attendanceRate || 0).toFixed(1)}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>{tc("اختر الشهر واضغط \"عرض التقرير\"", "Select a month and click \"Show Report\"")}</p>
              </div>
            )}
          </div>
        )}

        {/* ─── Live Tracking Section ─── */}
        {activeTab === 'live-tracking' && (
          <div className="space-y-4">
            {/* Alerts banner */}
            {liveAlerts.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-500 font-semibold text-sm">
                  <AlertOctagon className="w-4 h-4" />
                  تنبيهات الخروج عن النطاق ({liveAlerts.length})
                </div>
                {liveAlerts.map(alert => (
                  <div key={alert.id} className="flex items-start gap-3 bg-red-950/40 border border-red-700/40 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                    <div className="flex-1 text-sm">
                      <span className="text-red-300 font-medium">{alert.employeeName}</span>
                      <span className="text-red-400/80"> — خرج عن نطاق الفرع بمسافة </span>
                      <span className="text-red-300 font-bold">{alert.distanceFromBranch}م</span>
                      <span className="text-red-400/60 text-xs mr-2">{alert.time}</span>
                    </div>
                    <button
                      className="text-red-500 hover:text-red-300 text-xs"
                      onClick={() => setLiveAlerts(prev => prev.filter(a => a.id !== alert.id))}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Live employees count header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-600" />
                </span>
                <span className="text-sm font-semibold">
                  {liveEmployees.length === 0 ? 'لا يوجد موظفون نشطون' : `${liveEmployees.length} موظف نشط حالياً`}
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="text-xs border-primary/30"
                onClick={fetchLiveEmployees}
                data-testid="button-refresh-live"
              >
                تحديث
              </Button>
            </div>

            {/* ── Leaflet Map ── */}
            {(() => {
              // Pick a branch to display: the selected one or the first with location
              const displayBranch = selectedBranch !== 'all'
                ? branches.find(b => b.id === selectedBranch)
                : branches.find(b => b.location?.lat && b.location?.lng);
              const hasEmployeesWithLoc = liveEmployees.some(e => e.lastLocation?.lat);
              const hasBranchLoc = displayBranch?.location?.lat && displayBranch?.location?.lng;

              // Compute map center: branch location, first employee, or Yanbu default
              const center: [number, number] = hasBranchLoc
                ? [displayBranch!.location!.lat, displayBranch!.location!.lng]
                : hasEmployeesWithLoc
                ? [liveEmployees[0].lastLocation.lat, liveEmployees[0].lastLocation.lng]
                : [24.0895, 38.0618]; // ينبع

              return (
                <Card className="bg-[#1a1410] border-primary/20 overflow-hidden">
                  <CardHeader className="py-2 px-4">
                    <CardTitle className="text-accent text-sm flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      خريطة الفرع والموظفين
                      {hasBranchLoc && (
                        <span className="text-xs text-gray-400 font-normal">
                          — {displayBranch?.nameAr || displayBranch?.name}
                          {' '}(نطاق {displayBranch?.geofenceRadius || 200}م)
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <div style={{ height: 340 }}>
                    <MapContainer
                      center={center}
                      zoom={hasBranchLoc || hasEmployeesWithLoc ? 16 : 13}
                      style={{ height: "100%", width: "100%" }}
                      key={`${center[0]}-${center[1]}`}
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />

                      {/* Branch markers & geofence circles */}
                      {branches.filter(b => b.location?.lat && b.location?.lng).map(branch => (
                        <>
                          <Marker
                            key={`branch-marker-${branch.id}`}
                            position={[branch.location!.lat, branch.location!.lng]}
                            icon={branchIcon}
                          >
                            <Popup>
                              <div dir="rtl" style={{ fontSize: 13 }}>
                                <strong>🏪 {branch.nameAr || branch.name}</strong><br />
                                نطاق الحضور: {branch.geofenceRadius || 200} متر
                              </div>
                            </Popup>
                            <Tooltip direction="top" offset={[0, -16]} permanent={false}>
                              {branch.nameAr || branch.name}
                            </Tooltip>
                          </Marker>
                          <Circle
                            key={`branch-circle-${branch.id}`}
                            center={[branch.location!.lat, branch.location!.lng]}
                            radius={branch.geofenceRadius || 200}
                            pathOptions={{ color: "#16a34a", fillColor: "#16a34a", fillOpacity: 0.08, weight: 2, dashArray: "6 4" }}
                          />
                        </>
                      ))}

                      {/* Employee markers */}
                      {liveEmployees.filter(e => e.lastLocation?.lat).map(emp => (
                        <Marker
                          key={emp.employeeId}
                          position={[emp.lastLocation.lat, emp.lastLocation.lng]}
                          icon={makeEmployeeIcon(emp.isInsideBranch)}
                        >
                          <Popup>
                            <div dir="rtl" className="text-sm space-y-1" style={{ minWidth: 160 }}>
                              <div className="font-bold">{emp.employeeName}</div>
                              <div>{emp.isInsideBranch ? '✅ داخل الفرع' : '❌ خارج الفرع'}</div>
                              <div>المسافة: {emp.distanceFromBranch}م</div>
                              <div className="text-gray-400 text-xs">آخر تحديث: {new Date(emp.lastSeen).toLocaleTimeString('ar-SA')}</div>
                              <a
                                href={`https://www.google.com/maps?q=${emp.lastLocation.lat},${emp.lastLocation.lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 text-xs"
                              >
                                📍 فتح في Google Maps
                              </a>
                            </div>
                          </Popup>
                          <Tooltip direction="top" offset={[0, -14]}>
                            {emp.employeeName} — {emp.isInsideBranch ? '✅' : '❌'}
                          </Tooltip>
                        </Marker>
                      ))}
                    </MapContainer>
                  </div>
                  <div className="px-4 py-2 flex flex-wrap gap-3 text-xs text-gray-400 border-t border-primary/10">
                    <span className="flex items-center gap-1"><span style={{ background: '#16a34a', borderRadius: '50%', display: 'inline-block', width: 10, height: 10 }} /> داخل الفرع</span>
                    <span className="flex items-center gap-1"><span style={{ background: '#dc2626', borderRadius: '50%', display: 'inline-block', width: 10, height: 10 }} /> خارج الفرع</span>
                    <span className="flex items-center gap-1"><span style={{ background: '#16a34a', borderRadius: '50%', display: 'inline-block', width: 10, height: 10 }} />🏪 مركز الفرع</span>
                    {!hasBranchLoc && (
                      <span className="text-amber-400 flex items-center gap-1">
                        ⚠️ لم يتم تعيين موقع GPS للفرع — يرجى ضبطه في إعدادات الفرع
                      </span>
                    )}
                  </div>
                </Card>
              );
            })()}

            {/* Employee location cards */}
            {liveEmployees.length === 0 ? (
              <Card className="bg-[#1a1410] border-primary/20">
                <CardContent className="p-8 text-center text-gray-400">
                  <Navigation className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>لا يوجد موظفون قاموا بتسجيل الحضور حالياً</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {liveEmployees.map(emp => (
                  <Card
                    key={emp.employeeId}
                    className={`border transition-all ${emp.isInsideBranch ? 'bg-[#1a1410] border-green-800/40' : 'bg-red-950/30 border-red-700/50'}`}
                    data-testid={`card-live-employee-${emp.employeeId}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
                          {emp.employeePhoto ? (
                            <img src={emp.employeePhoto} alt={emp.employeeName} className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-5 h-5 text-primary" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{emp.employeeName}</span>
                            {emp.isInsideBranch ? (
                              <Badge className="bg-green-800/60 text-green-300 text-xs">داخل الفرع</Badge>
                            ) : (
                              <Badge className="bg-red-800/60 text-red-300 text-xs">خارج الفرع</Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-400">
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              <span>
                                {emp.isInsideBranch
                                  ? `على بُعد ${emp.distanceFromBranch}م من الفرع`
                                  : `خارج النطاق بـ ${emp.distanceFromBranch}م`}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>آخر تحديث: {new Date(emp.lastSeen).toLocaleTimeString('ar-SA')}</span>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-2 flex-wrap">
                            <a
                              href={`https://www.google.com/maps?q=${emp.lastLocation.lat},${emp.lastLocation.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                              data-testid={`link-map-${emp.employeeId}`}
                            >
                              <ExternalLink className="w-3 h-3" />
                              فتح في الخريطة
                            </a>
                            <button
                              className="flex items-center gap-1 text-xs text-accent hover:text-accent/80"
                              data-testid={`button-trail-${emp.employeeId}`}
                              onClick={() => {
                                if (selectedTrailEmployeeId === emp.employeeId) {
                                  setSelectedTrailEmployeeId(null);
                                  setLocationTrail([]);
                                } else {
                                  setSelectedTrailEmployeeId(emp.employeeId);
                                  fetchLocationTrail(emp.attendanceId);
                                }
                              }}
                            >
                              <Navigation className="w-3 h-3" />
                              {selectedTrailEmployeeId === emp.employeeId ? 'إخفاء التحركات' : 'عرض التحركات'}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Movement trail */}
                      {selectedTrailEmployeeId === emp.employeeId && (
                        <div className="mt-3 pt-3 border-t border-primary/20">
                          {locationTrail.length === 0 ? (
                            <p className="text-xs text-gray-500 text-center">لا توجد تحركات مسجلة بعد</p>
                          ) : (
                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                              <p className="text-xs text-gray-400 font-medium mb-2">
                                سجل التحركات ({locationTrail.length} نقطة)
                              </p>
                              {locationTrail.map((point, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-xs">
                                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${point.isInsideBranch ? 'bg-green-500' : 'bg-red-500'}`} />
                                  <span className="text-gray-400">
                                    {new Date(point.timestamp).toLocaleTimeString('ar-SA')}
                                  </span>
                                  <span className={point.isInsideBranch ? 'text-green-400' : 'text-red-400'}>
                                    {point.isInsideBranch ? 'داخل الفرع' : 'خارج الفرع'}
                                  </span>
                                  <a
                                    href={`https://www.google.com/maps?q=${point.lat},${point.lng}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-400 hover:underline mr-auto"
                                  >
                                    📍
                                  </a>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'daily' && (<>
        <Card className="bg-gradient-to-br from-background to-background border-primary/20 mb-6">
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3 items-center">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder={tc("بحث بالاسم أو الهاتف...", "Search by name or phone...")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pr-10 bg-[#1a1410] border-primary/20 text-white"
                      data-testid="input-search"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-accent" />
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-[#1a1410] border-primary/20 text-white w-40"
                    data-testid="input-date"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {(employee.role === 'admin' || employee.role === 'owner') && (
                  <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger className="w-40 bg-[#1a1410] border-primary/20 text-white" data-testid="select-branch">
                      <Filter className="w-4 h-4 ml-2" />
                      <SelectValue placeholder={tc("جميع الفروع", "All Branches")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{tc("جميع الفروع", "All Branches")}</SelectItem>
                      {branches.map(branch => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.nameAr || branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger className="w-40 bg-[#1a1410] border-primary/20 text-white" data-testid="select-role">
                    <Filter className="w-4 h-4 ml-2" />
                    <SelectValue placeholder={tc("جميع الأدوار", "All Roles")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tc("جميع الأدوار", "All Roles")}</SelectItem>
                    <SelectItem value="cashier">{tc("كاشير", "Cashier")}</SelectItem>
                    <SelectItem value="manager">{tc("مدير","Manager")}</SelectItem>
                    <SelectItem value="admin">{tc("إدمن","Admin")}</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-40 bg-[#1a1410] border-primary/20 text-white" data-testid="select-status">
                    <Filter className="w-4 h-4 ml-2" />
                    <SelectValue placeholder={tc("جميع الحالات","All Statuses")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tc("جميع الحالات","All Statuses")}</SelectItem>
                    <SelectItem value="checked_in">{tc("حاضر","Present")}</SelectItem>
                    <SelectItem value="checked_out">{tc("انصرف","Checked Out")}</SelectItem>
                    <SelectItem value="late">{tc("متأخر","Late")}</SelectItem>
                    <SelectItem value="absent">{tc("غياب","Absent")}</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  onClick={downloadReport}
                  className="bg-primary hover:bg-primary text-white"
                  data-testid="button-download-report"
                >
                  <Download className="w-4 h-4 ml-2" />
                  تنزيل تقرير
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {leaveRequests.length > 0 && (
          <Card className="bg-gradient-to-br from-background to-background border-primary/20 mb-6">
            <CardHeader>
              <CardTitle className="text-accent flex items-center gap-2">
                <FileText className="w-5 h-5" />
                طلبات الجازات المعلقة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {leaveRequests.map((request) => (
                  <div
                    key={request.id}
                    className="bg-[#1a1410] rounded-lg p-4 border border-primary/10"
                    data-testid={`leave-request-card-${request.id}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-white font-bold">
                          {request.employee?.fullName || 'موظف غير معروف'}
                        </h3>
                        <p className="text-gray-400 text-sm">{request.reason}</p>
                      </div>
                      <Badge className="bg-yellow-500/20 text-yellow-400">
                        {request.numberOfDays} يوم
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4 text-sm">
                      <div>
                        <p className="text-gray-500">تاريخ البداية</p>
                        <p className="text-accent font-medium flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(request.startDate).toLocaleDateString('ar-SA')}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">تاريخ النهاية</p>
                        <p className="text-accent font-medium flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(request.endDate).toLocaleDateString('ar-SA')}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">تاريخ الطلب</p>
                        <p className="text-gray-400 text-xs">
                          {new Date(request.createdAt).toLocaleDateString('ar-SA')}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => approveLeaveRequest(request.id)}
                        disabled={approvingId === request.id}
                        className="bg-green-500/20 text-green-400 border border-green-500/50 hover:bg-green-500/30 flex-1"
                        data-testid={`button-approve-leave-${request.id}`}
                      >
                        <Check className="w-4 h-4 ml-2" />
                        {approvingId === request.id ? 'جاري...' : 'موافقة'}
                      </Button>
                      <Button
                        onClick={() => rejectLeaveRequest(request.id)}
                        disabled={rejectingId === request.id}
                        className="bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 flex-1"
                        data-testid={`button-reject-leave-${request.id}`}
                      >
                        <X className="w-4 h-4 ml-2" />
                        {rejectingId === request.id ? 'جاري...' : 'رفض'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-gradient-to-br from-background to-background border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-accent flex items-center gap-2">
                <Clock className="w-5 h-5" />
                {tc("سجلات الحضور", "Attendance Records")}
              </CardTitle>
              <Tabs value={viewMode} onValueChange={(val) => setViewMode(val as 'cards' | 'table')}>
                <TabsList className="bg-[#1a1410]">
                  <TabsTrigger value="cards">{tc("بطاقات", "Cards")}</TabsTrigger>
                  <TabsTrigger value="table">{tc("جدول", "Table")}</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
                <p className="text-gray-400 mt-2">جاري التحميل...</p>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="text-center py-8">
                <XCircle className="w-12 h-12 text-gray-500 mx-auto mb-2" />
                <p className="text-gray-400">لا توجد سجلات حضور لهذا اليوم</p>
              </div>
            ) : viewMode === 'table' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-primary/20">
                      <th className="text-right py-3 px-4 text-accent">الاسم</th>
                      <th className="text-right py-3 px-4 text-accent">الدور</th>
                      <th className="text-right py-3 px-4 text-accent">الفرع</th>
                      <th className="text-right py-3 px-4 text-accent">وقت الحضور</th>
                      <th className="text-right py-3 px-4 text-accent">وقت الانصراف</th>
                      <th className="text-right py-3 px-4 text-accent">الحالة</th>
                      <th className="text-right py-3 px-4 text-accent">الموقع/المسافة</th>
                      <th className="text-right py-3 px-4 text-accent">الصور</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((record) => (
                      <tr key={record.id} className="border-b border-primary/10 hover:bg-[#2d1f1a]/50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {record.employee?.imageUrl ? (
                              <img 
                                src={record.employee.imageUrl} 
                                alt={record.employee.fullName}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 bg-primary/30 rounded-full flex items-center justify-center text-xs">
                                {record.employee?.fullName?.charAt(0) || '?'}
                              </div>
                            )}
                            <span className="text-white">{record.employee?.fullName || 'موظف غير معروف'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-400">{record.employee?.jobTitle || 'موظف'}</td>
                        <td className="py-3 px-4 text-gray-400 text-xs">{record.branch?.nameAr || record.branch?.name || '-'}</td>
                        <td className="py-3 px-4 text-green-400">{formatTime(record.checkInTime)}</td>
                        <td className="py-3 px-4 text-accent">{formatTime(record.checkOutTime)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            {record.isLate === 1 && (
                              <Badge variant="destructive" className="text-xs">
                                تأخير {record.lateMinutes}د
                              </Badge>
                            )}
                            <Badge
                              className={
                                record.status === 'checked_out'
                                  ? 'bg-green-500/20 text-green-400'
                                  : record.status === 'checked_in'
                                  ? 'bg-blue-500/20 text-blue-400'
                                  : 'bg-gray-500/20 text-gray-400'
                              }
                            >
                              {record.status === 'checked_out' ? tc('انصرف', 'Checked Out') : tc('حاضر', 'Present')}
                            </Badge>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            className={`text-xs ${
                              record.isAtBranch === 1
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {record.isAtBranch === 1 ? tc('في الفرع', 'At Branch') : `${Math.round(record.distanceFromBranch || 0)}م`}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            {record.checkInPhoto && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedPhoto(record.checkInPhoto)}
                                className="text-accent p-0 h-auto text-xs"
                                data-testid={`button-view-checkin-photo-${record.id}`}
                              >
                                <Camera className="w-3 h-3" />
                              </Button>
                            )}
                            {record.checkOutPhoto && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedPhoto(record.checkOutPhoto!)}
                                className="text-accent p-0 h-auto text-xs"
                                data-testid={`button-view-checkout-photo-${record.id}`}
                              >
                                <Camera className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRecords.map((record) => (
                  <div
                    key={record.id}
                    className="bg-[#1a1410] rounded-lg p-4 border border-primary/10"
                    data-testid={`attendance-record-${record.id}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {record.employee?.imageUrl ? (
                          <img 
                            src={record.employee.imageUrl} 
                            alt={record.employee.fullName}
                            className="w-12 h-12 rounded-full object-cover border-2 border-primary/50"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                            <span className="text-white font-bold text-lg">
                              {record.employee?.fullName?.charAt(0) || '?'}
                            </span>
                          </div>
                        )}
                        <div>
                          <h3 className="text-white font-bold">
                            {record.employee?.fullName || 'موظف غير معروف'}
                          </h3>
                          <p className="text-gray-400 text-sm">
                            {record.employee?.jobTitle || 'موظف'}
                          </p>
                          {(record.branch?.nameAr || record.branch?.name) && (
                            <p className="text-accent/70 text-xs flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {record.branch.nameAr || record.branch.name}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                          {record.isLate === 1 && (
                            <Badge variant="destructive" className="text-xs">
                              تأخير {record.lateMinutes} د
                            </Badge>
                          )}
                          <Badge
                            className={
                              record.status === 'checked_out'
                                ? 'bg-green-500/20 text-green-400'
                                : record.status === 'checked_in'
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-gray-500/20 text-gray-400'
                            }
                          >
                            {record.status === 'checked_out' ? tc('انصرف', 'Checked Out') : tc('حاضر', 'Present')}
                          </Badge>
                        </div>
                        {record.isAtBranch !== undefined && (
                          <Badge
                            className={
                              record.isAtBranch === 1
                                ? 'bg-green-500/20 text-green-400 text-xs'
                                : 'bg-red-500/20 text-red-400 text-xs'
                            }
                          >
                            <MapPin className="w-3 h-3 ml-1" />
                            {record.isAtBranch === 1 ? tc('في الفرع', 'At Branch') : `خارج الفرع (${Math.round(record.distanceFromBranch || 0)}م)`}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">وقت الحضور</p>
                        <p className="text-green-400 font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(record.checkInTime)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">موقع الحضور</p>
                        {record.isAtBranch !== undefined ? (
                          <p className={`font-medium flex items-center gap-1 ${record.isAtBranch === 1 ? 'text-green-400' : 'text-red-400'}`}>
                            {record.isAtBranch === 1 ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" />
                                في الفرع
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3" />
                                بعيد ({Math.round(record.distanceFromBranch || 0)}م)
                              </>
                            )}
                          </p>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </div>
                      <div>
                        <p className="text-gray-500">صورة الحضور</p>
                        {record.checkInPhoto ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedPhoto(record.checkInPhoto)}
                            className="text-accent p-0 h-auto"
                            data-testid={`button-view-checkin-photo-${record.id}`}
                          >
                            <Camera className="w-3 h-3 ml-1" />
                            عرض
                          </Button>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </div>
                      <div>
                        <p className="text-gray-500">وقت الانصراف</p>
                        <p className="text-accent font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(record.checkOutTime)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">موقع الانصراف</p>
                        {record.checkOutTime && record.checkOutIsAtBranch !== undefined ? (
                          <p className={`font-medium flex items-center gap-1 ${record.checkOutIsAtBranch === 1 ? 'text-green-400' : 'text-red-400'}`}>
                            {record.checkOutIsAtBranch === 1 ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" />
                                في الفرع
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3" />
                                بعيد ({Math.round(record.checkOutDistanceFromBranch || 0)}م)
                              </>
                            )}
                          </p>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </div>
                      <div>
                        <p className="text-gray-500">صورة الانصراف</p>
                        {record.checkOutPhoto ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedPhoto(record.checkOutPhoto!)}
                            className="text-accent p-0 h-auto"
                            data-testid={`button-view-checkout-photo-${record.id}`}
                          >
                            <Camera className="w-3 h-3 ml-1" />
                            عرض
                          </Button>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        </>)}

        {selectedPhoto && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedPhoto(null)}
          >
            <div className="max-w-lg w-full">
              <img
                src={selectedPhoto}
                alt="صورة الحضور"
                className="w-full rounded-lg"
              />
              <Button
                variant="outline"
                onClick={() => setSelectedPhoto(null)}
                className="w-full mt-4 border-primary/50 text-accent"
                data-testid="button-close-photo"
              >
                إغلاق
              </Button>
            </div>
          </div>
        )}
      </div>
      <MobileBottomNav />
    </div>
  );
}
