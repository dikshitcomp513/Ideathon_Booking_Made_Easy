import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  DoorClosed, 
  UserCheck, 
  ShieldCheck, 
  LogOut, 
  Trash2, 
  Search, 
  Code2, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  QrCode, 
  Printer, 
  Key, 
  BarChart3, 
  Building2, 
  FileText,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowLeft,
  Mail,
  ShieldAlert,
  Users,
  Split,
  Lock
} from 'lucide-react';

interface Booking {
  id: number;
  name: string;
  email: string;
  roll_number: string;
  category: 'UG' | 'PG' | 'PhD' | 'PDF' | 'Faculty';
  group_size: number;
  allow_coshare?: boolean;
  date: string;
  time_slot: string;
  room: 'DR-1' | 'DR-2' | 'DR-3';
  key_status: 'not_collected' | 'key_issued' | 'key_returned';
  created_at: string;
}

interface StatsData {
  totalBookings: number;
  todayBookings: number;
  roomCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
  activeRooms: number;
  totalDailyCapacity: number;
}

const ROOMS: ('DR-1' | 'DR-2' | 'DR-3')[] = ['DR-1', 'DR-2', 'DR-3'];

const ROOM_SPECS = {
  'DR-1': { capacity: '8-10 Persons', maxStudents: 10, features: 'Interactive Smart Board, AC, Whiteboard, High-speed Wi-Fi', floor: '1st Floor, East Wing' },
  'DR-2': { capacity: '6-8 Persons', maxStudents: 8, features: 'Display Monitor, HDMI/Type-C, Whiteboard, Power Pods', floor: '1st Floor, Central Area' },
  'DR-3': { capacity: '12-14 Persons', maxStudents: 14, features: 'Conference Display, Soundbar, Dual Whiteboards, Modular Seating', floor: '2nd Floor, Quiet Zone' }
};

const TIME_SLOTS = [
  '00:00 - 02:00',
  '02:00 - 04:00',
  '04:00 - 06:00',
  '06:00 - 08:00',
  '08:00 - 10:00',
  '10:00 - 12:00',
  '12:00 - 14:00',
  '14:00 - 16:00',
  '16:00 - 18:00',
  '18:00 - 20:00',
  '20:00 - 22:00',
  '22:00 - 24:00',
];

const TOTAL_SLOTS_PER_DAY = 36; // 3 rooms * 12 slots

export default function App() {
  const getTodayStr = () => new Date().toISOString().split('T')[0];

  const [activeTab, setActiveTab] = useState<'booking' | 'my_bookings' | 'security_desk' | 'admin' | 'architecture'>('booking');
  const [bookingViewMode, setBookingViewMode] = useState<'calendar' | 'slots'>('calendar');

  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr());
  const [showGuidelines, setShowGuidelines] = useState<boolean>(true);
  const [acceptedGuidelines, setAcceptedGuidelines] = useState<boolean>(false);
  const [selectedPhpFile, setSelectedPhpFile] = useState<string>('index.php');

  // Calendar Month Navigation
  const [currentCalendarDate, setCurrentCalendarDate] = useState<Date>(() => new Date());

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Booking Form & 2FA State (Includes partial sharing context)
  const [bookingSlot, setBookingSlot] = useState<{ 
    room: 'DR-1' | 'DR-2' | 'DR-3'; 
    time: string; 
    date: string;
    existingGroup?: Booking;
    maxGroupAllowed: number;
  } | null>(null);

  const [bookingStep, setBookingStep] = useState<'form' | 'verify'>('form');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    roll_number: '',
    category: '' as 'UG' | 'PG' | 'PhD' | 'PDF' | 'Faculty' | '',
    group_size: 2,
    opt_out_coshare: false,
  });
  const [verificationCodeInput, setVerificationCodeInput] = useState<string>('');
  const [activeDemoCode, setActiveDemoCode] = useState<string | null>(null);
  const [isSendingCode, setIsSendingCode] = useState<boolean>(false);
  const [confirmedPass, setConfirmedPass] = useState<Booking | null>(null);

  // Search State
  const [searchRollOrEmail, setSearchRollOrEmail] = useState<string>('');
  const [searchedStudentBookings, setSearchedStudentBookings] = useState<Booking[] | null>(null);

  // Admin State
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);
  const [adminUsername, setAdminUsername] = useState<string>('');
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [adminLoginError, setAdminLoginError] = useState<string>('');
  const [adminFilterEmail, setAdminFilterEmail] = useState<string>('');
  const [adminFilterDate, setAdminFilterDate] = useState<string>('');
  const [adminFilterRoom, setAdminFilterRoom] = useState<string>('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/bookings');
      if (res.ok) {
        const json = await res.json();
        setBookings(json.data || []);
      }
      const statsRes = await fetch('/api/stats');
      if (statsRes.ok) {
        const statsJson = await statsRes.json();
        setStats(statsJson.data || null);
      }
    } catch (err) {
      console.warn('Backend fetch failed', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (type: 'success' | 'error', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4000);
  };

  // Launch booking for either a fresh room or a co-sharing partial room
  const handleStartBooking = (
    room: 'DR-1' | 'DR-2' | 'DR-3', 
    time: string, 
    existingGroup?: Booking
  ) => {
    const roomMax = ROOM_SPECS[room].maxStudents;
    let maxGroupAllowed = roomMax;

    if (existingGroup) {
      // Co-sharing formula: (Max Capacity - 2 buffer) - existingGroup.group_size
      maxGroupAllowed = Math.max(1, (roomMax - 2) - (existingGroup.group_size || 2));
    }

    setBookingSlot({ 
      room, 
      time, 
      date: selectedDate, 
      existingGroup, 
      maxGroupAllowed 
    });

    setFormData({ 
      name: '', 
      email: '', 
      roll_number: '', 
      category: '', 
      group_size: Math.min(2, maxGroupAllowed),
      opt_out_coshare: false,
    });

    setBookingStep('form');
    setVerificationCodeInput('');
    setActiveDemoCode(null);
    setConfirmedPass(null);
  };

  // STEP 1: Request 2FA Email Confirmation Code
  const handleRequestVerificationCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingSlot) return;

    const email = formData.email.trim().toLowerCase();

    // Strict validation: Must end with @etd2026.org
    if (!email.endsWith('@etd2026.org')) {
      showToast('error', '❌ Invalid Email: Must end with @etd2026.org (e.g. user@etd2026.org)');
      return;
    }

    if (formData.group_size < 1) {
      showToast('error', 'Group size must be at least 1 person.');
      return;
    }

    if (formData.group_size > bookingSlot.maxGroupAllowed) {
      showToast('error', `Maximum allowed students for this booking is ${bookingSlot.maxGroupAllowed}.`);
      return;
    }

    setIsSendingCode(true);
    try {
      const res = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        showToast('error', json.error || 'Failed to dispatch confirmation ping.');
        return;
      }

      setActiveDemoCode(json.demoCode || '948123');
      setBookingStep('verify');
      showToast('success', `📨 Confirmation email sent to ${email}`);
    } catch {
      showToast('error', 'Error connecting to verification server.');
    } finally {
      setIsSendingCode(false);
    }
  };

  // STEP 2: Verify Code and Finalize Booking
  const handleVerifyAndBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingSlot) return;

    if (!verificationCodeInput.trim()) {
      showToast('error', 'Please enter the 6-digit confirmation code.');
      return;
    }

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          roll_number: formData.roll_number.trim(),
          category: formData.category,
          group_size: Number(formData.group_size) || 1,
          allow_coshare: !formData.opt_out_coshare,
          date: bookingSlot.date,
          time_slot: bookingSlot.time,
          room: bookingSlot.room,
          verification_code: verificationCodeInput.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        showToast('error', json.error || 'Verification or booking failed.');
        return;
      }

      showToast('success', '✅ 2FA Verified! Booking confirmed.');
      setConfirmedPass(json.data);
      loadData();
    } catch {
      showToast('error', 'Network error finalizing booking.');
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminUsername, password: adminPassword }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setIsAdminLoggedIn(true);
        setAdminLoginError('');
      } else {
        setAdminLoginError(json.error || 'Invalid credentials.');
      }
    } catch {
      setAdminLoginError('Connection to server failed.');
    }
  };

  const handleDeleteBooking = async (id: number) => {
    if (!confirm(`Are you sure you want to cancel booking #${id}?`)) return;
    try {
      const res = await fetch(`/api/bookings/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('success', `Booking #${id} cancelled.`);
        loadData();
      } else {
        showToast('error', 'Failed to delete booking.');
      }
    } catch {
      showToast('error', 'Network error deleting booking.');
    }
  };

  const handleUpdateKeyStatus = async (id: number, newStatus: 'not_collected' | 'key_issued' | 'key_returned') => {
    try {
      const res = await fetch(`/api/bookings/${id}/key-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key_status: newStatus }),
      });
      if (res.ok) {
        showToast('success', 'Security key log updated.');
        loadData();
      }
    } catch {
      showToast('error', 'Error updating key status.');
    }
  };

  const handleSearchStudent = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchRollOrEmail.trim().toLowerCase();
    if (!query) {
      setSearchedStudentBookings(null);
      return;
    }
    const found = bookings.filter(
      (b) => b.roll_number.toLowerCase() === query || b.email.toLowerCase().includes(query)
    );
    setSearchedStudentBookings(found);
  };

  const handleResetDemo = async () => {
    if (confirm('Reset database to clean initial state for ETD-2026?')) {
      await fetch('/api/reset-demo', { method: 'POST' });
      await loadData();
      showToast('success', 'Database reset to demo state.');
    }
  };

  const adminFiltered = bookings.filter((b) => {
    if (adminFilterEmail && !b.email.toLowerCase().includes(adminFilterEmail.toLowerCase())) return false;
    if (adminFilterDate && b.date !== adminFilterDate) return false;
    if (adminFilterRoom && adminFilterRoom !== 'All' && b.room !== adminFilterRoom) return false;
    return true;
  });

  // --- CALENDAR HELPERS (Google Calendar Style) ---
  const calYear = currentCalendarDate.getFullYear();
  const calMonth = currentCalendarDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const prevMonth = () => {
    setCurrentCalendarDate(new Date(calYear, calMonth - 1, 1));
  };

  const nextMonth = () => {
    setCurrentCalendarDate(new Date(calYear, calMonth + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentCalendarDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(getTodayStr());
  };

  const firstDayOfWeek = new Date(calYear, calMonth, 1).getDay();
  const daysInCurrentMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(calYear, calMonth, 0).getDate();

  interface CalendarDay {
    dateStr: string;
    dayNum: number;
    isCurrentMonth: boolean;
    isPast: boolean;
    isToday: boolean;
    freeSlots: number;
    partialSlots: number;
    bookedSlots: number;
  }

  const calendarGrid: CalendarDay[] = [];
  const todayStr = getTodayStr();

  // Helper to calculate free & partial slots for any date
  const getSlotStatsForDate = (dateStr: string) => {
    const forDate = bookings.filter((b) => b.date === dateStr);
    let fullyBooked = 0;
    let partial = 0;

    for (const slot of TIME_SLOTS) {
      for (const room of ROOMS) {
        const slotBookings = forDate.filter((b) => b.time_slot === slot && b.room === room);
        const maxCap = ROOM_SPECS[room].maxStudents;
        const firstGroup = slotBookings[0];
        const firstGroupSize = firstGroup ? (Number(firstGroup.group_size) || 2) : 0;
        if (slotBookings.length === 0) {
          // free
        } else if (
          slotBookings.length === 1 && 
          firstGroup.allow_coshare !== false && 
          firstGroupSize < maxCap / 2
        ) {
          partial++;
        } else {
          fullyBooked++;
        }
      }
    }
    const free = TOTAL_SLOTS_PER_DAY - fullyBooked - partial;
    return { free, partial, fullyBooked };
  };

  // 1. Prev month filler
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const prevMonthDate = new Date(calYear, calMonth - 1, dayNum);
    const dateStr = prevMonthDate.toISOString().split('T')[0];
    const isPast = dateStr < todayStr;
    const stats = getSlotStatsForDate(dateStr);
    calendarGrid.push({
      dateStr,
      dayNum,
      isCurrentMonth: false,
      isPast,
      isToday: dateStr === todayStr,
      freeSlots: stats.free,
      partialSlots: stats.partial,
      bookedSlots: stats.fullyBooked,
    });
  }

  // 2. Current month days
  for (let day = 1; day <= daysInCurrentMonth; day++) {
    const currentDayDate = new Date(calYear, calMonth, day);
    const yyyy = currentDayDate.getFullYear();
    const mm = String(currentDayDate.getMonth() + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const isPast = dateStr < todayStr;
    const stats = getSlotStatsForDate(dateStr);
    calendarGrid.push({
      dateStr,
      dayNum: day,
      isCurrentMonth: true,
      isPast,
      isToday: dateStr === todayStr,
      freeSlots: stats.free,
      partialSlots: stats.partial,
      bookedSlots: stats.fullyBooked,
    });
  }

  // 3. Next month filler
  const remainingCells = 42 - calendarGrid.length;
  for (let day = 1; day <= remainingCells; day++) {
    const nextMonthDate = new Date(calYear, calMonth + 1, day);
    const dateStr = nextMonthDate.toISOString().split('T')[0];
    const isPast = dateStr < todayStr;
    const stats = getSlotStatsForDate(dateStr);
    calendarGrid.push({
      dateStr,
      dayNum: day,
      isCurrentMonth: false,
      isPast,
      isToday: dateStr === todayStr,
      freeSlots: stats.free,
      partialSlots: stats.partial,
      bookedSlots: stats.fullyBooked,
    });
  }

  const handleSelectCalendarDay = (day: CalendarDay) => {
    if (day.isPast) {
      showToast('error', 'Cannot book rooms for dates in the past.');
      return;
    }
    setSelectedDate(day.dateStr);
    setBookingViewMode('slots');
  };

  return (
    <div className="min-h-screen bg-[#f5f8fa] text-slate-800 flex flex-col font-sans">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-xl text-sm font-semibold flex items-center gap-2 border transition-all ${
          notification.type === 'success' 
            ? 'bg-emerald-600 text-white border-emerald-700' 
            : 'bg-rose-600 text-white border-rose-700'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Top Ribbon & Tab Bar */}
      <nav className="bg-[#0b1c34] text-white px-4 py-2.5 text-xs flex flex-wrap items-center justify-between border-b border-slate-700 shadow-md z-30">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 font-bold tracking-wide text-sky-300">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            ETD-2026 Library • DRBS
          </div>
          <span className="text-slate-400">|</span>
          <span className="text-emerald-300 font-mono text-[11px] bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700">
            Discussion Room System
          </span>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap my-1">
          <button
            onClick={() => setActiveTab('booking')}
            className={`px-3 py-1.5 rounded-md font-medium transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'booking' ? 'bg-[#0077cc] text-white shadow-xs' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <CalendarIcon size={13} />
            Reserve Room
          </button>

          <button
            onClick={() => setActiveTab('my_bookings')}
            className={`px-3 py-1.5 rounded-md font-medium transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'my_bookings' ? 'bg-[#0077cc] text-white shadow-xs' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <QrCode size={13} />
            My Bookings & Pass
          </button>

          <button
            onClick={() => setActiveTab('security_desk')}
            className={`px-3 py-1.5 rounded-md font-medium transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'security_desk' ? 'bg-[#0077cc] text-white shadow-xs' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Key size={13} />
            Security Desk
          </button>

          <button
            onClick={() => setActiveTab('admin')}
            className={`px-3 py-1.5 rounded-md font-medium transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'admin' ? 'bg-[#0077cc] text-white shadow-xs' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <ShieldCheck size={13} />
            Admin & Analytics
          </button>

          <button
            onClick={() => setActiveTab('architecture')}
            className={`px-3 py-1.5 rounded-md font-medium transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'architecture' ? 'bg-amber-600 text-white shadow-xs' : 'bg-slate-800 text-amber-300 hover:bg-slate-700'
            }`}
          >
            <Code2 size={13} />
            Architecture & Docs
          </button>

          <button
            onClick={handleResetDemo}
            title="Reset data"
            className="p-1.5 rounded bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition ml-1 cursor-pointer"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </nav>

      {/* Main Header */}
      <header className="bg-white border-b-2 border-[#0077cc] py-4 px-4 text-center shadow-xs">
        <div className="max-w-4xl mx-auto flex flex-col items-center justify-center">
          <div className="flex items-center justify-center mb-1.5">
            <img 
              src="/ideathon_logo.png" 
              alt="ETD-2026 Logo" 
              className="h-16 md:h-20 object-contain drop-shadow-sm"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }} 
            />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-50 text-sky-800 border border-sky-200 mb-1">
            <span>Library of ETD-2026</span>
          </div>
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-[#0b1c34] uppercase">
            ETD-2026
          </h1>
          <h2 className="text-sm md:text-base font-semibold text-[#0077cc] mt-0.5">
            Central Library
          </h2>
          <h3 className="text-xs md:text-sm font-medium text-slate-600 mt-0.5">
            Discussion Room Booking System (DRBS)
          </h3>
        </div>
      </header>

      {/* TAB 1: ROOM RESERVATION */}
      {activeTab === 'booking' && (
        <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6">
          {/* Attention Guidelines Modal */}
          {showGuidelines && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border-t-4 border-[#0077cc] animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="text-amber-500" size={24} />
                  <h2 className="text-2xl font-bold text-[#0077cc]">Attention!!!</h2>
                </div>
                <div className="space-y-2.5 text-slate-700 text-sm leading-relaxed border-y border-slate-100 py-3">
                  <p><strong>Discussion Rooms are available by pre-booking only.</strong></p>
                  <p>To book a room and collect the key, please submit your Delegate / Institutional ID card to the security personnel at the counter.</p>
                  <p>Each registered ETD-2026 group can use a Discussion Room for up to two hours.</p>
                  <p>
                    <strong>Partial Co-Sharing Allowed:</strong> If a room is reserved by a group filling less than half the room, another group can co-share the space provided a 2-seat buffer partition is preserved.
                  </p>
                  <p>
                    <strong>Privacy Option:</strong> Groups conducting confidential discussions may check <em>"Reserve as Exclusive / Private Room"</em> during booking to opt out of co-sharing completely.
                  </p>
                  <p className="text-sky-700 font-semibold">
                    This facility is strictly restricted to valid <span className="underline font-mono">@etd2026.org</span> email holders with 2FA email authorization.
                  </p>
                </div>

                <div className="mt-4 pt-2 text-center">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={acceptedGuidelines}
                      onChange={(e) => setAcceptedGuidelines(e.target.checked)}
                      className="w-4 h-4 text-[#0077cc] rounded focus:ring-sky-500 cursor-pointer"
                    />
                    <span>I have read and accept the guidelines.</span>
                  </label>
                  <div className="mt-4">
                    <button
                      disabled={!acceptedGuidelines}
                      onClick={() => setShowGuidelines(false)}
                      className={`w-full py-2.5 px-4 rounded-md font-medium text-white transition ${
                        acceptedGuidelines
                          ? 'bg-[#0077cc] hover:bg-[#005fa3] cursor-pointer'
                          : 'bg-slate-300 cursor-not-allowed'
                      }`}
                    >
                      Continue to Calendar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Notice Banner with Partial Booking Hint */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-indigo-50 border border-indigo-200 text-indigo-950 px-4 py-2.5 rounded-lg mb-6 text-xs md:text-sm shadow-2xs">
            <div className="flex items-center gap-2">
              <Split size={17} className="text-indigo-600 shrink-0" />
              <span>
                <strong>Smart Co-Sharing Enabled:</strong> When a room is &lt;50% occupied, a second group can co-share with an automatic 2-seat buffer partition (<span className="text-indigo-700 font-semibold">Total $\le$ Room Capacity - 2</span>).
              </span>
            </div>
            <button
              onClick={() => {
                setAcceptedGuidelines(false);
                setShowGuidelines(true);
              }}
              className="text-indigo-700 underline font-semibold hover:text-indigo-900 ml-auto shrink-0 cursor-pointer"
            >
              Review Rules
            </button>
          </div>

          {/* View Mode Toggle Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs mb-6">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Booking Mode:
              </span>
              <div className="inline-flex rounded-lg p-1 bg-slate-100 border border-slate-200">
                <button
                  onClick={() => setBookingViewMode('calendar')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    bookingViewMode === 'calendar'
                      ? 'bg-white text-[#0077cc] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CalendarIcon size={14} />
                  Google Calendar View
                </button>
                <button
                  onClick={() => setBookingViewMode('slots')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    bookingViewMode === 'slots'
                      ? 'bg-white text-[#0077cc] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Clock size={14} />
                  Time Slots & Rooms ({selectedDate})
                </button>
              </div>
            </div>

            {bookingViewMode === 'slots' && (
              <button
                onClick={() => setBookingViewMode('calendar')}
                className="text-xs font-semibold text-[#0077cc] hover:text-[#005fa3] flex items-center gap-1 hover:underline cursor-pointer"
              >
                <ArrowLeft size={14} />
                ← Back to Calendar Overview
              </button>
            )}
          </div>

          {/* SUB-VIEW A: GOOGLE CALENDAR VIEW */}
          {bookingViewMode === 'calendar' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                    <button
                      onClick={prevMonth}
                      title="Previous month"
                      className="p-1.5 rounded hover:bg-white text-slate-600 hover:text-slate-900 transition cursor-pointer"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      onClick={nextMonth}
                      title="Next month"
                      className="p-1.5 rounded hover:bg-white text-slate-600 hover:text-slate-900 transition cursor-pointer"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>

                  <button
                    onClick={goToToday}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
                  >
                    Today
                  </button>

                  <h3 className="text-lg md:text-xl font-bold text-slate-800 ml-1">
                    {monthNames[calMonth]} {calYear}
                  </h3>
                </div>

                <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    High Availability
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                    Shared Rooms Open
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                    Filling Fast
                  </span>
                </div>
              </div>

              {/* Monthly Calendar Grid */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden">
                <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-semibold text-slate-600 py-2.5">
                  {daysOfWeek.map((day, idx) => (
                    <div key={day} className={idx === 0 || idx === 6 ? 'text-slate-400' : ''}>
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
                  {calendarGrid.map((day, idx) => {
                    const isSelected = day.dateStr === selectedDate;
                    const totalOpen = day.freeSlots + day.partialSlots;
                    
                    let statusColor = 'bg-emerald-500';
                    let badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                    let statusText = `${day.freeSlots} free`;

                    if (day.partialSlots > 0 && day.freeSlots <= 20) {
                      statusColor = 'bg-indigo-500';
                      badgeBg = 'bg-indigo-50 text-indigo-700 border-indigo-200';
                      statusText = `${day.freeSlots} free • ${day.partialSlots} shared`;
                    } else if (totalOpen < 10) {
                      statusColor = 'bg-rose-500';
                      badgeBg = 'bg-rose-50 text-rose-700 border-rose-200';
                      statusText = `${totalOpen} left`;
                    } else if (totalOpen <= 24) {
                      statusColor = 'bg-amber-500';
                      badgeBg = 'bg-amber-50 text-amber-800 border-amber-200';
                      statusText = `${totalOpen} open`;
                    }

                    return (
                      <div
                        key={idx}
                        onClick={() => !day.isPast && handleSelectCalendarDay(day)}
                        className={`min-h-[96px] md:min-h-[112px] p-2 flex flex-col justify-between transition relative group select-none ${
                          !day.isCurrentMonth
                            ? 'bg-slate-50/50 text-slate-300'
                            : day.isPast
                            ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                            : 'bg-white hover:bg-sky-50/40 cursor-pointer'
                        } ${isSelected ? 'ring-2 ring-inset ring-[#0077cc] bg-sky-50/20' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs md:text-sm font-semibold rounded-full w-6 h-6 flex items-center justify-center ${
                              day.isToday
                                ? 'bg-[#0077cc] text-white font-bold'
                                : isSelected
                                ? 'text-[#0077cc] font-bold'
                                : day.isCurrentMonth && !day.isPast
                                ? 'text-slate-800'
                                : 'text-slate-400'
                            }`}
                          >
                            {day.dayNum}
                          </span>

                          {day.isToday && (
                            <span className="text-[10px] font-bold text-[#0077cc] uppercase tracking-wider hidden md:inline">
                              Today
                            </span>
                          )}
                        </div>

                        {!day.isPast ? (
                          <div className="mt-1 space-y-1">
                            <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] md:text-[11px] font-semibold border ${badgeBg}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${statusColor} shrink-0`}></span>
                              <span className="truncate">{statusText}</span>
                            </div>

                            <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden mt-1">
                              <div
                                className={`h-full rounded-full ${statusColor}`}
                                style={{ width: `${(totalOpen / TOTAL_SLOTS_PER_DAY) * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-300 italic">Past</div>
                        )}

                        {!day.isPast && (
                          <div className="text-[9px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
                            Click to view slots →
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* SUB-VIEW B: TIME SLOTS & ROOMS MATRIX */}
          {bookingViewMode === 'slots' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Room Specs & Facilities Bar */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {ROOMS.map((rm) => (
                  <div key={rm} className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        <Building2 size={16} className="text-[#0077cc]" />
                        {rm}
                      </span>
                      <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                        Capacity: {ROOM_SPECS[rm].maxStudents} Students
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{ROOM_SPECS[rm].floor}</p>
                    <p className="text-[11px] text-slate-600 mt-1 line-clamp-1">
                      <strong>Amenities:</strong> {ROOM_SPECS[rm].features}
                    </p>
                  </div>
                ))}
              </div>

              {/* Date Header Controls & Legend with Partial Booking */}
              <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <CalendarIcon className="text-[#0077cc]" size={20} />
                  <label htmlFor="datePicker" className="font-semibold text-slate-700 text-sm">
                    Selected Date:
                  </label>
                  <input
                    id="datePicker"
                    type="date"
                    value={selectedDate}
                    min={getTodayStr()}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-3 py-1.5 border border-slate-300 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0077cc]"
                  />
                  {selectedDate === getTodayStr() && (
                    <span className="text-[11px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded">
                      Today
                    </span>
                  )}
                  <button
                    onClick={() => setBookingViewMode('calendar')}
                    className="text-xs text-[#0077cc] underline font-medium hover:text-[#005fa3] ml-2 cursor-pointer"
                  >
                    Change via Calendar
                  </button>
                </div>

                <div className="flex items-center gap-4 text-xs font-medium">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded bg-[#c8f7c5] border border-green-500 inline-block"></span>
                    Available (Full Room)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded bg-indigo-100 border border-indigo-400 inline-block"></span>
                    Partial Co-Sharing Available (&lt;50% filled)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded bg-[#f7c5c5] border border-red-300 inline-block"></span>
                    Fully Booked
                  </span>
                </div>
              </div>

              {/* 12-Slot Matrix Table with Partial Booking Handling */}
              <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-center text-sm">
                    <thead>
                      <tr className="bg-[#0077cc] text-white">
                        <th className="p-3 border border-slate-300 font-semibold w-1/4">Time Slot (2-Hour Blocks)</th>
                        {ROOMS.map((room) => (
                          <th key={room} className="p-3 border border-slate-300 font-semibold w-1/4">
                            <div className="font-bold">{room}</div>
                            <div className="text-[11px] font-normal opacity-90">Max {ROOM_SPECS[room].maxStudents} Persons</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {TIME_SLOTS.map((slot, idx) => (
                        <tr key={slot} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                          <td className="p-2.5 border border-slate-200 font-medium text-slate-700 flex items-center justify-center gap-1.5">
                            <Clock size={14} className="text-slate-400" />
                            {slot}
                          </td>
                          {ROOMS.map((room) => {
                            const roomMax = ROOM_SPECS[room].maxStudents;
                            const slotBookings = bookings.filter(
                              (b) => b.date === selectedDate && b.time_slot === slot && b.room === room
                            );

                            // SCENARIO 1: Completely Free Room
                            if (slotBookings.length === 0) {
                              return (
                                <td key={room} className="p-2.5 border border-slate-200 bg-[#c8f7c5]">
                                  <button
                                    onClick={() => handleStartBooking(room, slot)}
                                    className="inline-block text-white bg-[#0077cc] hover:bg-[#005fa3] px-4 py-1.5 rounded text-xs font-semibold shadow-xs transition hover:scale-105 active:scale-95 cursor-pointer"
                                  >
                                    Book Room
                                  </button>
                                </td>
                              );
                            }

                            // SCENARIO 2: Single Booking Exists -> Check if Partial Sharing is Available (< 50% filled AND not opted out)
                            if (slotBookings.length === 1) {
                              const firstGroup = slotBookings[0];
                              const firstGroupSize = Number(firstGroup.group_size) || 2;
                              const halfCap = roomMax / 2;
                              const isPrivate = firstGroup.allow_coshare === false;

                              if (!isPrivate && firstGroupSize < halfCap) {
                                // Eligible for partial co-sharing!
                                const maxAllowedForSecond = Math.max(1, (roomMax - 2) - firstGroupSize);

                                return (
                                  <td key={room} className="p-2.5 border border-indigo-200 bg-indigo-50/70">
                                    <div className="flex flex-col items-center justify-center gap-1">
                                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">
                                        <Split size={12} className="text-indigo-600" />
                                        <span>Co-Share Space Open</span>
                                      </div>
                                      <span className="text-[10px] text-slate-600">
                                        Occupied: <strong>{firstGroupSize}</strong>/{roomMax} • Partition: 2 seats
                                      </span>
                                      <button
                                        onClick={() => handleStartBooking(room, slot, firstGroup)}
                                        className="inline-flex items-center gap-1 text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1 rounded text-xs font-semibold shadow-xs transition hover:scale-105 active:scale-95 cursor-pointer mt-0.5"
                                        title={`Join co-sharing space. Max ${maxAllowedForSecond} students allowed.`}
                                      >
                                        <Users size={12} />
                                        Co-Share (Max {maxAllowedForSecond} ppl)
                                      </button>
                                    </div>
                                  </td>
                                );
                              }

                              // Group fills >= 50% of the room OR opted out of co-sharing -> Fully Booked
                              return (
                                <td key={room} className="p-2.5 border border-slate-200 bg-[#f7c5c5] text-red-900 font-medium">
                                  <div className="flex flex-col items-center justify-center gap-0.5">
                                    <span className="inline-block px-3 py-1 rounded text-xs bg-red-100 text-red-700 border border-red-200 font-bold flex items-center gap-1">
                                      {isPrivate ? (
                                        <>
                                          <Lock size={11} className="text-red-700" />
                                          Private Room
                                        </>
                                      ) : (
                                        'Fully Booked'
                                      )}
                                    </span>
                                    <span className="text-[10px] text-red-700/80 font-mono">
                                      Ref #{firstGroup.id} • {firstGroupSize} ppl {isPrivate && '(Co-share disabled)'}
                                    </span>
                                  </div>
                                </td>
                              );
                            }

                            // SCENARIO 3: 2 Groups Already Sharing Room -> Fully Booked
                            const totalOccupants = slotBookings.reduce((sum, b) => sum + (b.group_size || 1), 0);
                            return (
                              <td key={room} className="p-2.5 border border-slate-200 bg-[#f7c5c5] text-red-900 font-medium">
                                <div className="flex flex-col items-center justify-center gap-0.5">
                                  <span className="inline-block px-3 py-1 rounded text-xs bg-red-100 text-red-700 border border-red-200 font-bold">
                                    Fully Booked (Shared)
                                  </span>
                                  <span className="text-[10px] text-red-700 font-mono">
                                    2 Groups ({totalOccupants}/{roomMax} seats used)
                                  </span>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      )}

      {/* MODAL: 2-STEP BOOKING FORM WITH PARTIAL CO-SHARING LOGIC & 2FA EMAIL CONFIRMATION */}
      {bookingSlot && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border-t-4 border-[#0077cc] animate-in fade-in zoom-in-95 duration-200 my-8">
            {!confirmedPass ? (
              <>
                <div className="flex items-center justify-between border-b pb-3 mb-4">
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    {bookingSlot.existingGroup ? (
                      <>
                        <Split size={20} className="text-indigo-600" />
                        Co-Share Room Reservation
                      </>
                    ) : (
                      <>
                        <CalendarIcon size={18} className="text-[#0077cc]" />
                        Confirm Room Reservation
                      </>
                    )}
                  </h2>
                  <button
                    onClick={() => setBookingSlot(null)}
                    className="text-slate-400 hover:text-slate-600 font-bold text-lg"
                  >
                    ×
                  </button>
                </div>

                {/* Co-Sharing Alert Notice Banner */}
                {bookingSlot.existingGroup && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-xs text-indigo-950 mb-3 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-indigo-800">
                      <Split size={14} />
                      Partial Booking: Co-Sharing {bookingSlot.room}
                    </div>
                    <p>
                      An existing group of <strong>{bookingSlot.existingGroup.group_size} students</strong> is booked for this slot (&lt;50% room capacity).
                    </p>
                    <p className="text-[11px] text-indigo-700">
                      Per ETD-2026 rules, a <strong>2-seat buffer partition</strong> is reserved between groups (<span className="font-mono">{bookingSlot.existingGroup.group_size} + your group $\le$ {ROOM_SPECS[bookingSlot.room].maxStudents - 2}</span>). Your group size can be at most <strong>{bookingSlot.maxGroupAllowed} students</strong>.
                    </p>
                  </div>
                )}

                <div className="bg-sky-50 border border-sky-100 p-3 rounded-lg mb-4 text-xs grid grid-cols-3 gap-2 text-center">
                  <div>
                    <span className="text-slate-500 block">Room</span>
                    <strong className="text-slate-900 font-bold">{bookingSlot.room}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Date</span>
                    <strong className="text-slate-900 font-bold">{bookingSlot.date}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Time</span>
                    <strong className="text-[#0077cc] font-bold">{bookingSlot.time}</strong>
                  </div>
                </div>

                {/* STEP 1: APPLICANT DETAILS & DYNAMIC GROUP SIZE */}
                {bookingStep === 'form' ? (
                  <form onSubmit={handleRequestVerificationCode} className="space-y-3 text-left text-sm">
                    <div>
                      <label className="block font-semibold text-slate-700 text-xs mb-1">
                        Applicant Full Name:
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Dr. Alex Morgan"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-[#0077cc] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 text-xs mb-1">
                        Institutional Email (<span className="text-red-600 font-mono font-bold">Strictly @etd2026.org</span>):
                      </label>
                      <div className="relative">
                        <input
                          type="email"
                          required
                          placeholder="yourname@etd2026.org"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full p-2 pr-8 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-[#0077cc] focus:outline-none font-mono"
                        />
                        <Mail size={14} className="absolute right-2.5 top-2.5 text-slate-400" />
                      </div>
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        Must end with <strong>@etd2026.org</strong>. A 2FA authorization code will be dispatched to this address.
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 text-xs mb-1">
                          Delegate ID / Roll No:
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. ETD-DEL-402"
                          value={formData.roll_number}
                          onChange={(e) => setFormData({ ...formData, roll_number: e.target.value })}
                          className="w-full p-2 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-[#0077cc] focus:outline-none"
                        />
                      </div>

                      {/* DYNAMIC GROUP SIZE FIELD (Adjusts maximum automatically based on partition math) */}
                      <div>
                        <label className="block font-semibold text-slate-700 text-xs mb-1 flex items-center justify-between">
                          <span>Group Size:</span>
                          <span className={`text-[10px] font-bold ${bookingSlot.existingGroup ? 'text-indigo-600' : 'text-slate-500'}`}>
                            Max: {bookingSlot.maxGroupAllowed}
                          </span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min={1}
                            max={bookingSlot.maxGroupAllowed}
                            required
                            value={formData.group_size}
                            onChange={(e) => setFormData({ 
                              ...formData, 
                              group_size: Math.max(1, Math.min(bookingSlot.maxGroupAllowed, parseInt(e.target.value) || 1)) 
                            })}
                            className={`w-full p-2 pl-7 border rounded text-xs font-bold focus:outline-none ${
                              bookingSlot.existingGroup 
                                ? 'border-indigo-400 focus:ring-2 focus:ring-indigo-500 bg-indigo-50/30' 
                                : 'border-slate-300 focus:ring-2 focus:ring-[#0077cc]'
                            }`}
                          />
                          <Users size={14} className="absolute left-2 top-2.5 text-slate-400" />
                        </div>
                        <span className="text-[10px] text-slate-500 mt-0.5 block">
                          {bookingSlot.existingGroup ? 'Co-sharing partition limit' : 'Total students in room'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 text-xs mb-1">Category:</label>
                      <select
                        required
                        value={formData.category}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            category: e.target.value as 'UG' | 'PG' | 'PhD' | 'PDF' | 'Faculty' | '',
                          })
                        }
                        className="w-full p-2 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-[#0077cc] focus:outline-none"
                      >
                        <option value="">Select Academic Category</option>
                        <option value="UG">Undergraduate (UG)</option>
                        <option value="PG">Postgraduate (PG)</option>
                        <option value="PhD">Doctoral (PhD)</option>
                        <option value="PDF">Post-Doctoral Fellow (PDF)</option>
                        <option value="Faculty">Faculty / Delegate</option>
                      </select>
                    </div>

                    {/* OPT-OUT OF CO-SHARING (For primary bookings) */}
                    {!bookingSlot.existingGroup ? (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                        <label className="flex items-start gap-2.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={formData.opt_out_coshare}
                            onChange={(e) => setFormData({ ...formData, opt_out_coshare: e.target.checked })}
                            className="w-4 h-4 mt-0.5 text-[#0077cc] rounded focus:ring-[#0077cc] border-slate-300 cursor-pointer"
                          />
                          <div>
                            <span className="font-semibold text-xs text-slate-800 flex items-center gap-1.5">
                              <Lock size={13} className="text-slate-600" />
                              Reserve as Exclusive / Private Room (Opt Out of Co-Sharing)
                            </span>
                            <span className="text-[11px] text-slate-500 block mt-0.5 leading-snug">
                              Check this box if your discussion or research requires strict privacy. When selected, no other group will be allowed to co-share this room, even if your group occupies less than 50% capacity.
                            </span>
                          </div>
                        </label>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-900 flex items-center gap-2">
                        <Split size={15} className="text-indigo-600 shrink-0" />
                        <span>
                          <strong>Co-Sharing Mode:</strong> Joining existing group #{bookingSlot.existingGroup.id}. A 2-seat partition buffer is automatically enforced.
                        </span>
                      </div>
                    )}

                    <div className="pt-3 flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={isSendingCode}
                        className={`flex-1 text-white py-2.5 px-4 rounded font-semibold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
                          bookingSlot.existingGroup 
                            ? 'bg-indigo-600 hover:bg-indigo-700' 
                            : 'bg-[#0077cc] hover:bg-[#005fa3]'
                        }`}
                      >
                        <Mail size={14} />
                        {isSendingCode ? 'Sending Ping...' : 'Send 2FA Email Confirmation'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setBookingSlot(null)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 px-4 rounded font-medium text-xs transition cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  /* STEP 2: 2FA EMAIL VERIFICATION CODE PING */
                  <form onSubmit={handleVerifyAndBook} className="space-y-4 text-left text-sm">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-amber-800">
                        <Mail size={16} />
                        <span>Confirmation Email Ping Dispatched!</span>
                      </div>
                      <p>
                        A 6-digit confirmation code was sent to <strong className="font-mono">{formData.email}</strong> to verify your identity and prevent unauthorized room reservation.
                      </p>
                      {activeDemoCode && (
                        <div className="bg-white/80 p-2 rounded border border-amber-300 mt-2 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-slate-500 block">Demo 2FA Code (Simulation):</span>
                            <span className="font-mono font-bold text-sm text-[#002855]">{activeDemoCode}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setVerificationCodeInput(activeDemoCode)}
                            className="text-[11px] bg-amber-600 hover:bg-amber-700 text-white font-semibold px-2.5 py-1 rounded cursor-pointer"
                          >
                            Auto-Fill Code
                          </button>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 text-xs mb-1">
                        Enter 6-Digit 2FA Code:
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        required
                        placeholder="e.g. 123456"
                        value={verificationCodeInput}
                        onChange={(e) => setVerificationCodeInput(e.target.value)}
                        className="w-full p-2.5 border-2 border-[#0077cc] rounded-lg text-center font-mono text-lg tracking-widest font-bold focus:outline-none"
                      />
                    </div>

                    <div className="pt-2 flex items-center gap-2">
                      <button
                        type="submit"
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-4 rounded-lg font-semibold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 size={16} />
                        Verify & Confirm Booking
                      </button>
                      <button
                        type="button"
                        onClick={() => setBookingStep('form')}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 px-3 rounded-lg font-medium text-xs transition cursor-pointer"
                      >
                        Back
                      </button>
                    </div>

                    <div className="text-center">
                      <button
                        type="button"
                        onClick={(e) => handleRequestVerificationCode(e as any)}
                        className="text-[11px] text-[#0077cc] underline hover:text-[#005fa3] cursor-pointer"
                      >
                        Didn't receive code? Resend email ping
                      </button>
                    </div>
                  </form>
                )}
              </>
            ) : (
              /* DIGITAL PASS / E-TICKET */
              <div className="text-center">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 size={28} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Booking Confirmed!</h3>
                <p className="text-xs text-slate-500 mb-4">Your ETD-2026 Discussion Room Pass is ready.</p>

                {/* Printable Ticket Card */}
                <div className="bg-slate-50 border-2 border-dashed border-[#0077cc] p-4 rounded-xl text-left text-xs mb-4">
                  <div className="flex items-center justify-between border-b pb-2 mb-2">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Pass Reference</span>
                      <strong className="text-sm font-mono text-[#002855]">ETD-DRBS-#{confirmedPass.id}</strong>
                    </div>
                    {/* SVG QR Code */}
                    <div className="p-1 bg-white border rounded">
                      <svg viewBox="0 0 40 40" className="w-12 h-12">
                        <rect width="40" height="40" fill="white" />
                        <rect x="2" y="2" width="10" height="10" fill="#002855" />
                        <rect x="4" y="4" width="6" height="6" fill="white" />
                        <rect x="28" y="2" width="10" height="10" fill="#002855" />
                        <rect x="30" y="4" width="6" height="6" fill="white" />
                        <rect x="2" y="28" width="10" height="10" fill="#002855" />
                        <rect x="4" y="30" width="6" height="6" fill="white" />
                        <rect x="16" y="4" width="6" height="4" fill="#002855" />
                        <rect x="14" y="16" width="12" height="8" fill="#002855" />
                        <rect x="18" y="28" width="6" height="6" fill="#002855" />
                        <rect x="28" y="20" width="8" height="6" fill="#002855" />
                      </svg>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <span className="text-slate-500 text-[10px] block">Name:</span>
                      <strong className="text-slate-800">{confirmedPass.name}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Delegate ID:</span>
                      <strong className="text-slate-800 font-mono">{confirmedPass.roll_number}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Room Allocated:</span>
                      <strong className="text-[#0077cc] text-sm">{confirmedPass.room}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Group Size:</span>
                      <strong className="text-slate-800 font-semibold">{confirmedPass.group_size || 2} Students</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Category:</span>
                      <strong className="text-slate-800">{confirmedPass.category}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">2FA Verification:</span>
                      <strong className="text-emerald-700 font-semibold">Verified (@etd2026.org)</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Date:</span>
                      <strong className="text-slate-800 font-mono">{confirmedPass.date}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Time Slot:</span>
                      <strong className="text-slate-800">{confirmedPass.time_slot}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Privacy Status:</span>
                      <strong className={`font-semibold ${confirmedPass.allow_coshare === false ? 'text-amber-700' : 'text-indigo-700'}`}>
                        {confirmedPass.allow_coshare === false ? '🔒 Private (No Co-sharing)' : 'Co-Sharing Permitted'}
                      </strong>
                    </div>
                  </div>

                  <div className="bg-sky-50 border border-sky-200 text-sky-900 p-2 rounded text-[10px] leading-tight mt-2">
                    <strong>Important:</strong> Present this pass & deposit your physical ID card with ETD-2026 security personnel to collect key for your group of {confirmedPass.group_size || 2}.
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-2 rounded text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Printer size={13} />
                    Print Pass
                  </button>
                  <button
                    onClick={() => {
                      setConfirmedPass(null);
                      setBookingSlot(null);
                    }}
                    className="flex-1 bg-[#0077cc] hover:bg-[#005fa3] text-white py-2 rounded text-xs font-semibold cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: MY BOOKINGS & PASS LOOKUP */}
      {activeTab === 'my_bookings' && (
        <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6">
            <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
              <QrCode size={20} className="text-[#0077cc]" />
              Delegate Pass & Reservation Lookup
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Enter your Delegate ID or Email to retrieve your passes and check-in statuses.
            </p>

            <form onSubmit={handleSearchStudent} className="flex gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="e.g. ETD-DEL-102 or delegate@etd2026.org"
                  value={searchRollOrEmail}
                  onChange={(e) => setSearchRollOrEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#0077cc] focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="bg-[#0077cc] hover:bg-[#005fa3] text-white px-5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Search
              </button>
            </form>
          </div>

          {searchedStudentBookings !== null && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600 px-1">
                <span>Found {searchedStudentBookings.length} booking(s)</span>
                {searchedStudentBookings.length > 0 && (
                  <button
                    onClick={() => setSearchedStudentBookings(null)}
                    className="text-[#0077cc] underline cursor-pointer"
                  >
                    Clear Search
                  </button>
                )}
              </div>

              {searchedStudentBookings.length === 0 ? (
                <div className="bg-white p-8 rounded-xl border text-center text-slate-500 text-sm">
                  No bookings found for <strong>{searchRollOrEmail}</strong>.
                </div>
              ) : (
                searchedStudentBookings.map((b) => (
                  <div key={b.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#002855]">{b.room}</span>
                        <span className="text-[11px] font-mono text-slate-500">Pass #ETD-{b.id}</span>
                        <span className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                          👥 {b.group_size || 2} Students
                        </span>
                        {b.allow_coshare === false && (
                          <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 font-semibold px-2 py-0.5 rounded flex items-center gap-1">
                            <Lock size={10} />
                            Private
                          </span>
                        )}
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                          b.key_status === 'key_issued' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : b.key_status === 'key_returned'
                            ? 'bg-slate-100 text-slate-700'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {b.key_status === 'key_issued' ? 'Key Issued (ID Deposited)' : b.key_status === 'key_returned' ? 'Completed & Key Returned' : 'Pending Key Pickup'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600">
                        {b.date} • {b.time_slot}
                      </div>
                      <div className="text-xs text-slate-500">
                        Booked for: <strong>{b.name}</strong> ({b.roll_number}) • {b.email}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-auto">
                      <button
                        onClick={() => setConfirmedPass(b)}
                        className="bg-sky-50 text-[#0077cc] hover:bg-sky-100 px-3 py-1.5 rounded text-xs font-semibold border border-sky-200 flex items-center gap-1 cursor-pointer"
                      >
                        <QrCode size={13} />
                        View Pass
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </main>
      )}

      {/* TAB 3: SECURITY GUARD DESK */}
      {activeTab === 'security_desk' && (
        <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-6">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Key size={20} className="text-amber-600" />
                ETD-2026 Security Desk • Physical Key & ID Registry
              </h2>
              <span className="text-xs bg-slate-100 text-slate-600 font-mono px-2 py-1 rounded">
                Today: {getTodayStr()}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Per ETD-2026 library guidelines, delegates submit their physical ID card at the security desk to collect the room key. Co-shared rooms will show both registered groups.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-center text-xs">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="p-3 border border-slate-700">Ref #</th>
                    <th className="p-3 border border-slate-700">Room</th>
                    <th className="p-3 border border-slate-700">Time Slot</th>
                    <th className="p-3 border border-slate-700">Group Size</th>
                    <th className="p-3 border border-slate-700">Delegate Name</th>
                    <th className="p-3 border border-slate-700">ID / Roll No</th>
                    <th className="p-3 border border-slate-700">Key Status</th>
                    <th className="p-3 border border-slate-700">Security Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.filter((b) => b.date === getTodayStr()).length > 0 ? (
                    bookings
                      .filter((b) => b.date === getTodayStr())
                      .map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50 border-b border-slate-200">
                          <td className="p-2.5 font-mono font-bold text-slate-700">#{row.id}</td>
                          <td className="p-2.5 font-bold text-[#0077cc]">{row.room}</td>
                          <td className="p-2.5 font-medium">{row.time_slot}</td>
                          <td className="p-2.5 font-semibold text-slate-700">
                            <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded">
                              <Users size={12} className="text-slate-500" />
                              {row.group_size || 2}
                            </span>
                          </td>
                          <td className="p-2.5 font-semibold text-slate-800">{row.name}</td>
                          <td className="p-2.5 font-mono">{row.roll_number}</td>
                          <td className="p-2.5">
                            <span className={`px-2 py-0.5 rounded font-semibold text-[10px] ${
                              row.key_status === 'key_issued'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : row.key_status === 'key_returned'
                                ? 'bg-slate-200 text-slate-700'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}>
                              {row.key_status === 'key_issued' ? 'Key Handed Out (ID in Box)' : row.key_status === 'key_returned' ? 'Key & ID Returned' : 'Not Yet Collected'}
                            </span>
                          </td>
                          <td className="p-2.5">
                            <div className="flex items-center justify-center gap-1.5">
                              {row.key_status !== 'key_issued' && (
                                <button
                                  onClick={() => handleUpdateKeyStatus(row.id, 'key_issued')}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded text-[11px] font-semibold cursor-pointer"
                                >
                                  Issue Key
                                </button>
                              )}
                              {row.key_status === 'key_issued' && (
                                <button
                                  onClick={() => handleUpdateKeyStatus(row.id, 'key_returned')}
                                  className="bg-slate-700 hover:bg-slate-800 text-white px-2 py-1 rounded text-[11px] font-semibold cursor-pointer"
                                >
                                  Return Key & ID
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="p-8 text-slate-400">
                        No bookings scheduled for today ({getTodayStr()}).
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      )}

      {/* TAB 4: ADMIN & ANALYTICS DASHBOARD */}
      {activeTab === 'admin' && (
        <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6">
          {!isAdminLoggedIn ? (
            <div className="max-w-sm mx-auto my-12 bg-white p-6 rounded-xl shadow-md border border-slate-200 text-center">
              <div className="w-12 h-12 bg-sky-100 text-[#0077cc] rounded-full flex items-center justify-center mx-auto mb-3">
                <ShieldCheck size={26} />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-1">Admin Login</h2>
              <p className="text-xs text-slate-500 mb-4">ETD-2026 Central Library Console</p>

              {adminLoginError && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded text-xs font-semibold mb-4">
                  {adminLoginError}
                </div>
              )}

              <form onSubmit={handleAdminLogin} className="space-y-3.5 text-left text-sm">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Username:</label>
                  <input
                    type="text"
                    required
                    placeholder="admin"
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-[#0077cc] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Password:</label>
                  <input
                    type="password"
                    required
                    placeholder="admin123"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-[#0077cc] focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#0077cc] hover:bg-[#005fa3] text-white py-2 rounded font-semibold text-xs transition cursor-pointer"
                >
                  Login to Admin Console
                </button>
              </form>

              <div className="mt-4 pt-3 border-t text-[11px] text-slate-500 font-mono">
                Credentials: admin / admin123
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <BarChart3 className="text-[#0077cc]" size={22} />
                    ETD-2026 Administrative Management & Analytics
                  </h2>
                  <p className="text-xs text-slate-500">Live metrics across all 3 ETD-2026 discussion rooms</p>
                </div>
                <button
                  onClick={() => setIsAdminLoggedIn(false)}
                  className="text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded transition flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut size={13} />
                  Logout
                </button>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-xs text-slate-500">Today's Reservations</span>
                  <div className="text-2xl font-bold text-[#0b1c34] mt-1">
                    {stats?.todayBookings ?? 0}
                  </div>
                  <span className="text-[10px] text-emerald-600 font-medium">
                    Out of 36 base slots
                  </span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-xs text-slate-500">Total Bookings</span>
                  <div className="text-2xl font-bold text-[#0077cc] mt-1">
                    {stats?.totalBookings ?? bookings.length}
                  </div>
                  <span className="text-[10px] text-slate-400">Synchronized on server</span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-xs text-slate-500">Active Rooms</span>
                  <div className="text-2xl font-bold text-slate-800 mt-1">3 Rooms</div>
                  <span className="text-[10px] text-slate-400">DR-1, DR-2, DR-3</span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-xs text-slate-500">Co-Sharing Policy</span>
                  <div className="text-2xl font-bold text-indigo-600 mt-1">Active</div>
                  <span className="text-[10px] text-indigo-700 font-medium">2-Seat Buffer Partition</span>
                </div>
              </div>

              {/* Filters */}
              <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <label className="font-semibold text-slate-600">Email:</label>
                    <input
                      type="text"
                      placeholder="Search email..."
                      value={adminFilterEmail}
                      onChange={(e) => setAdminFilterEmail(e.target.value)}
                      className="px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-[#0077cc]"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <label className="font-semibold text-slate-600">Date:</label>
                    <input
                      type="date"
                      value={adminFilterDate}
                      onChange={(e) => setAdminFilterDate(e.target.value)}
                      className="px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-[#0077cc]"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <label className="font-semibold text-slate-600">Room:</label>
                    <select
                      value={adminFilterRoom}
                      onChange={(e) => setAdminFilterRoom(e.target.value)}
                      className="px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-[#0077cc]"
                    >
                      <option value="All">All Rooms</option>
                      <option value="DR-1">DR-1</option>
                      <option value="DR-2">DR-2</option>
                      <option value="DR-3">DR-3</option>
                    </select>
                  </div>

                  <button
                    onClick={() => {
                      setAdminFilterEmail('');
                      setAdminFilterDate('');
                      setAdminFilterRoom('All');
                    }}
                    className="ml-auto bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded font-medium transition cursor-pointer"
                  >
                    Reset Filters
                  </button>
                </div>
              </div>

              {/* Bookings Table */}
              <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-center text-xs">
                    <thead>
                      <tr className="bg-[#0077cc] text-white">
                        <th className="p-2.5 border border-slate-300">ID</th>
                        <th className="p-2.5 border border-slate-300">Name</th>
                        <th className="p-2.5 border border-slate-300">Email</th>
                        <th className="p-2.5 border border-slate-300">Group</th>
                        <th className="p-2.5 border border-slate-300">ID No</th>
                        <th className="p-2.5 border border-slate-300">Category</th>
                        <th className="p-2.5 border border-slate-300">Date</th>
                        <th className="p-2.5 border border-slate-300">Slot</th>
                        <th className="p-2.5 border border-slate-300">Room</th>
                        <th className="p-2.5 border border-slate-300">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminFiltered.length > 0 ? (
                        adminFiltered.map((row, idx) => (
                          <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="p-2 border border-slate-200 font-mono text-slate-600">#{row.id}</td>
                            <td className="p-2 border border-slate-200 font-medium text-slate-800">{row.name}</td>
                            <td className="p-2 border border-slate-200 text-slate-600 font-mono">{row.email}</td>
                            <td className="p-2 border border-slate-200 font-semibold text-slate-700">
                              <div className="flex flex-col items-center gap-0.5">
                                <span>{row.group_size || 2} ppl</span>
                                {row.allow_coshare === false ? (
                                  <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                                    <Lock size={9} /> Private
                                  </span>
                                ) : (
                                  <span className="text-[9px] text-indigo-600 font-medium">
                                    Co-shareable
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-2 border border-slate-200 font-mono">{row.roll_number}</td>
                            <td className="p-2 border border-slate-200">
                              <span className="px-1.5 py-0.5 rounded bg-sky-50 text-[#0077cc] border border-sky-200 font-semibold text-[10px]">
                                {row.category}
                              </span>
                            </td>
                            <td className="p-2 border border-slate-200 font-mono">{row.date}</td>
                            <td className="p-2 border border-slate-200">{row.time_slot}</td>
                            <td className="p-2 border border-slate-200 font-bold text-slate-700">{row.room}</td>
                            <td className="p-2 border border-slate-200">
                              <button
                                onClick={() => handleDeleteBooking(row.id)}
                                className="bg-red-600 hover:bg-red-800 text-white px-2.5 py-1 rounded text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 mx-auto"
                              >
                                <Trash2 size={12} />
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={10} className="p-6 text-slate-400">
                            No bookings match the current filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      )}

      {/* TAB 5: ARCHITECTURE & DOCS */}
      {activeTab === 'architecture' && (
        <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-2">
              <Code2 className="text-amber-500" size={24} />
              ETD-2026 Technical Architecture & Hackathon Presentation Guide
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Configured specifically for the <strong>Library of ETD-2026</strong>. Features strict <code>@etd2026.org</code> domain validation, 2FA confirmation email verification to prevent identity misuse, dynamic group size allocation with <strong>Partial Co-Sharing & 2-Seat Partition Buffer</strong>, Google Calendar-style visual availability, and security desk key tracking.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <Building2 size={16} className="text-[#0077cc]" />
                ETD-2026 Smart Capacity & Security Rules
              </h3>
              <ul className="text-xs text-slate-600 space-y-2">
                <li className="flex items-start gap-2">
                  <Check className="text-emerald-500 shrink-0 mt-0.5" size={14} />
                  <span><strong>Partial Co-Sharing:</strong> When an existing group occupies &lt;50% of room capacity, a second group can book the room.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="text-emerald-500 shrink-0 mt-0.5" size={14} />
                  <span><strong>2-Seat Partition Buffer Rule:</strong> Enforces <code>group1 + group2 $\le$ RoomMax - 2</code> to guarantee comfortable physical space and social distancing.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="text-emerald-500 shrink-0 mt-0.5" size={14} />
                  <span><strong>Strict Domain Restriction:</strong> Rejects any email not ending in <code>@etd2026.org</code>.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="text-emerald-500 shrink-0 mt-0.5" size={14} />
                  <span><strong>Anti-Misuse 2FA Confirmation Email:</strong> Pings confirmation code before reserving to prevent unauthorized reservations.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="text-emerald-500 shrink-0 mt-0.5" size={14} />
                  <span><strong>Privacy Opt-Out:</strong> Primary booker can opt out of co-sharing to keep the discussion room 100% private and confidential.</span>
                </li>
              </ul>
            </div>

            <div className="bg-slate-900 text-white p-5 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
                  <Mail size={16} />
                  2FA Email Service Integration Hook
                </h3>
              </div>
              <div className="text-xs text-slate-300 leading-relaxed font-mono bg-slate-950 p-3 rounded border border-slate-800">
                {`// server.ts - Pluggable email dispatch
async function sendEmailNotification(to, subject, body, code) {
  // Production: Hook into Nodemailer / SendGrid / Resend
  console.log(\`[EMAIL DISPATCH PING] To: \${to} | 2FA: \${code}\`);
  return true;
}`}
              </div>
              <p className="text-[11px] text-slate-400">
                Currently running in safe <strong>Simulation Mode</strong>: displays a verification dispatch ping with an auto-fill helper for hackathon live judging.
              </p>
            </div>
          </div>
        </main>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-3.5 text-center text-xs text-slate-500 mt-auto">
        Library of ETD-2026 • Discussion Room Booking System (DRBS)
      </footer>
    </div>
  );
}
