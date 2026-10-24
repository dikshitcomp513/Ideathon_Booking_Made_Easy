import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
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
  Download,
  Printer,
  Key,
  Users,
  BarChart3,
  BookOpen,
  ArrowRight,
  Check,
  Building2,
  FileText
} from 'lucide-react';

interface Booking {
  id: number;
  name: string;
  email: string;
  roll_number: string;
  category: 'UG' | 'PG' | 'PhD' | 'PDF' | 'Faculty';
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
  'DR-1': { capacity: '8-10 Persons', features: 'Interactive Smart Board, AC, Whiteboard, High-speed Wi-Fi', floor: '1st Floor, East Wing' },
  'DR-2': { capacity: '6-8 Persons', features: 'Display Monitor, HDMI/Type-C, Whiteboard, Power Pods', floor: '1st Floor, Central Area' },
  'DR-3': { capacity: '12-14 Persons', features: 'Conference Display, Soundbar, Dual Whiteboards, Modular Seating', floor: '2nd Floor, Quiet Zone' }
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

const PHP_FILES: Record<string, string> = {
  'index.php': `<?php
$host = "localhost";
$user = "booking_user";
$pass = "Book@1234";
$dbname = "booking_system";

$conn = new mysqli($host, $user, $pass, $dbname);
if ($conn->connect_error) {
    die("DB Connection failed: " . $conn->connect_error);
}

$date = $_GET['date'] ?? date("Y-m-d"); // Default = today

// Generate 2-hour slots (24 hrs -> 12 slots)
$slots = [];
for ($h = 0; $h < 24; $h += 2) {
    $start = str_pad($h, 2, "0", STR_PAD_LEFT) . ":00";
    $end = str_pad($h + 2, 2, "0", STR_PAD_LEFT) . ":00";
    $slots[] = "$start - $end";
}

$rooms = ["DR-1", "DR-2", "DR-3"];
// (Renders Guidelines modal + 12-slot booking matrix)
?>`,
  'book.php': `<?php
// Checks @iitb.ac.in email, max 2 slots/day, and duplicate bookings
if (!preg_match("/@iitb\\.ac\\.in$/", $email)) {
    die("<h3 style='color:red;'>❌ Email must be @iitb.ac.in</h3>");
}
// Max 2 slots per day
$checkSlots = $conn->prepare("SELECT COUNT(*) FROM bookings WHERE email=? AND date=?");
// Check already booked
$checkTime = $conn->prepare("SELECT id FROM bookings WHERE date=? AND time_slot=? AND room=?");
?>`,
  'admin_login.php': `<?php
session_start();
// Default credentials: admin / admin123
if($username==="admin" && $password==="admin123"){
    $_SESSION['admin_logged_in']=true;
    header("Location: admin.php");
}
?>`,
  'admin.php': `<?php
// Admin Dashboard with filters by Email, Date, Room and Delete actions
$sql="SELECT * FROM bookings WHERE 1=1";
if($search_email) $sql.=" AND email LIKE '%".$conn->real_escape_string($search_email)."%'";
if($search_date) $sql.=" AND date='".$conn->real_escape_string($search_date)."'";
if($search_room) $sql.=" AND room='".$conn->real_escape_string($search_room)."'";
?>`,
  'delete.php': `<?php
$id = $_GET['id'] ?? 0;
if ($id) {
    $stmt = $conn->prepare("DELETE FROM bookings WHERE id=?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
}
header("Location: admin.php");
?>`,
  'availability.php': `<?php
$sql = "SELECT * FROM bookings WHERE date=? ORDER BY room, time_slot";
// Prints table of all bookings for the specified date
?>`
};

export default function App() {
  const getTodayStr = () => new Date().toISOString().split('T')[0];

  // Active Navigation Tab
  // 'booking' | 'my_bookings' | 'security_desk' | 'admin' | 'architecture'
  const [activeTab, setActiveTab] = useState<'booking' | 'my_bookings' | 'security_desk' | 'admin' | 'architecture'>('booking');

  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr());
  const [showGuidelines, setShowGuidelines] = useState<boolean>(true);
  const [acceptedGuidelines, setAcceptedGuidelines] = useState<boolean>(false);
  const [selectedPhpFile, setSelectedPhpFile] = useState<string>('index.php');

  // Bookings state synced with backend API
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Booking Modal / Form
  const [bookingSlot, setBookingSlot] = useState<{ room: 'DR-1' | 'DR-2' | 'DR-3'; time: string; date: string } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    roll_number: '',
    category: '' as 'UG' | 'PG' | 'PhD' | 'PDF' | 'Faculty' | '',
  });
  const [confirmedPass, setConfirmedPass] = useState<Booking | null>(null);

  // Student Search Tab State
  const [searchRollOrEmail, setSearchRollOrEmail] = useState<string>('');
  const [searchedStudentBookings, setSearchedStudentBookings] = useState<Booking[] | null>(null);

  // Admin Portal State
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);
  const [adminUsername, setAdminUsername] = useState<string>('');
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [adminLoginError, setAdminLoginError] = useState<string>('');
  const [adminFilterEmail, setAdminFilterEmail] = useState<string>('');
  const [adminFilterDate, setAdminFilterDate] = useState<string>('');
  const [adminFilterRoom, setAdminFilterRoom] = useState<string>('');

  // Fetch all bookings and stats from server
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
      console.warn('Backend fetch failed, falling back to local copy', err);
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

  // Handle slot reservation
  const handleStartBooking = (room: 'DR-1' | 'DR-2' | 'DR-3', time: string) => {
    setBookingSlot({ room, time, date: selectedDate });
    setFormData({ name: '', email: '', roll_number: '', category: '' });
    setConfirmedPass(null);
  };

  const submitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingSlot) return;

    const email = formData.email.trim();
    if (!email.endsWith('@iitb.ac.in')) {
      showToast('error', '❌ Email must be @iitb.ac.in');
      return;
    }

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          email,
          roll_number: formData.roll_number.trim(),
          category: formData.category,
          date: bookingSlot.date,
          time_slot: bookingSlot.time,
          room: bookingSlot.room,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        showToast('error', json.error || 'Booking creation failed.');
        return;
      }

      showToast('success', json.message || 'Booking confirmed!');
      setConfirmedPass(json.data);
      loadData();
    } catch (err) {
      showToast('error', 'Network error connecting to booking API.');
    }
  };

  // Admin login
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

  // Delete booking (Admin)
  const handleDeleteBooking = async (id: number) => {
    if (!confirm(`Are you sure you want to delete and cancel booking #${id}?`)) return;
    try {
      const res = await fetch(`/api/bookings/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('success', `Booking #${id} deleted.`);
        loadData();
      } else {
        showToast('error', 'Failed to delete booking.');
      }
    } catch {
      showToast('error', 'Network error deleting booking.');
    }
  };

  // Update Key Status (Security Desk)
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

  // Search bookings for a student
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

  // Demo reset
  const handleResetDemo = async () => {
    if (confirm('Reset database to clean initial state for hackathon demo?')) {
      await fetch('/api/reset-demo', { method: 'POST' });
      await loadData();
      showToast('success', 'Database reset to demo state.');
    }
  };

  // Admin filtered table
  const adminFiltered = bookings.filter((b) => {
    if (adminFilterEmail && !b.email.toLowerCase().includes(adminFilterEmail.toLowerCase())) return false;
    if (adminFilterDate && b.date !== adminFilterDate) return false;
    if (adminFilterRoom && adminFilterRoom !== 'All' && b.room !== adminFilterRoom) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#f5f8fa] text-slate-800 flex flex-col font-sans">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-xl text-sm font-semibold flex items-center gap-2 border transition-all animate-bounce ${
          notification.type === 'success' 
            ? 'bg-emerald-600 text-white border-emerald-700' 
            : 'bg-rose-600 text-white border-rose-700'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Top Hackathon Ribbon & View Switcher */}
      <nav className="bg-[#002855] text-white px-4 py-2.5 text-xs flex flex-wrap items-center justify-between border-b border-sky-950 shadow-md z-30">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 font-bold tracking-wide text-sky-300">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            IITB Central Library • DRBS Portal
          </div>
          <span className="text-slate-400">|</span>
          <span className="text-emerald-300 font-mono text-[11px] bg-sky-950/80 px-2 py-0.5 rounded border border-sky-800">
            Full-Stack Node.js + Express API
          </span>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 flex-wrap my-1">
          <button
            onClick={() => setActiveTab('booking')}
            className={`px-3 py-1.5 rounded-md font-medium transition flex items-center gap-1.5 ${
              activeTab === 'booking' ? 'bg-[#0077cc] text-white shadow-xs' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Calendar size={13} />
            Reserve Room
          </button>

          <button
            onClick={() => setActiveTab('my_bookings')}
            className={`px-3 py-1.5 rounded-md font-medium transition flex items-center gap-1.5 ${
              activeTab === 'my_bookings' ? 'bg-[#0077cc] text-white shadow-xs' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <QrCode size={13} />
            My Bookings & Pass
          </button>

          <button
            onClick={() => setActiveTab('security_desk')}
            className={`px-3 py-1.5 rounded-md font-medium transition flex items-center gap-1.5 ${
              activeTab === 'security_desk' ? 'bg-[#0077cc] text-white shadow-xs' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Key size={13} />
            Security Guard Desk
          </button>

          <button
            onClick={() => setActiveTab('admin')}
            className={`px-3 py-1.5 rounded-md font-medium transition flex items-center gap-1.5 ${
              activeTab === 'admin' ? 'bg-[#0077cc] text-white shadow-xs' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <ShieldCheck size={13} />
            Admin & Analytics
          </button>

          <button
            onClick={() => setActiveTab('architecture')}
            className={`px-3 py-1.5 rounded-md font-medium transition flex items-center gap-1.5 ${
              activeTab === 'architecture' ? 'bg-amber-600 text-white shadow-xs' : 'bg-slate-800/80 text-amber-300 hover:bg-slate-700'
            }`}
          >
            <Code2 size={13} />
            PHP Code & Architecture
          </button>

          <button
            onClick={handleResetDemo}
            title="Reset to sample records for demo"
            className="p-1.5 rounded bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition ml-1"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </nav>

      {/* Main Header with Official IIT Bombay Crest */}
      <header className="bg-white border-b-2 border-[#0077cc] py-4 px-4 text-center shadow-xs">
        <div className="max-w-4xl mx-auto flex flex-col items-center justify-center">
          <img 
            src="/iitb_logo.png" 
            alt="IIT Bombay Logo" 
            className="h-20 object-contain mb-1.5"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }} 
          />
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[#002855] uppercase my-0.5">
            Indian Institute of Technology Bombay
          </h1>
          <h2 className="text-sm md:text-base font-semibold text-[#0077cc] my-0.5">
            Central Library
          </h2>
          <h3 className="text-xs md:text-sm font-medium text-slate-600 my-0.5">
            Discussion Room Booking System (DRBS)
          </h3>
        </div>
      </header>

      {/* TAB 1: PUBLIC ROOM RESERVATION MATRIX */}
      {activeTab === 'booking' && (
        <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6">
          {/* Attention Guidelines Modal (Mandatory as in index.php) */}
          {showGuidelines && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border-t-4 border-[#0077cc] animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="text-amber-500" size={24} />
                  <h2 className="text-2xl font-bold text-[#0077cc]">Attention!!!</h2>
                </div>
                <div className="space-y-2.5 text-slate-700 text-sm leading-relaxed border-y border-slate-100 py-3">
                  <p><strong>Discussion Rooms are available by pre-booking only.</strong></p>
                  <p>To book a room and collect the key, please submit your Institute ID card to the security personnel at the counter.</p>
                  <p>Each IITB group can use a Discussion Room for up to two hours.</p>
                  <p>Please maintain cleanliness in the room and handle all electronic equipment with care.</p>
                  <p className="text-red-600 font-semibold">This facility is exclusively for registered IITB students and faculty.</p>
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
                      Continue to Booking Matrix
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Notice Banner & Guidelines Re-open button */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-sky-50 border border-sky-200 text-sky-900 px-4 py-3 rounded-lg mb-6 text-xs md:text-sm shadow-2xs">
            <div className="flex items-center gap-2">
              <Info size={18} className="text-[#0077cc] shrink-0" />
              <span>
                <strong>Discussion Rooms 1, 2, and 3</strong> are operating 24/7 in 2-hour slots. Max 2 slots per day per student.
              </span>
            </div>
            <button
              onClick={() => {
                setAcceptedGuidelines(false);
                setShowGuidelines(true);
              }}
              className="text-[#0077cc] underline font-semibold hover:text-[#005fa3] ml-auto shrink-0"
            >
              Review Rules & Guidelines
            </button>
          </div>

          {/* Room Specs & Facilities Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {ROOMS.map((rm) => (
              <div key={rm} className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <Building2 size={16} className="text-[#0077cc]" />
                    {rm}
                  </span>
                  <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                    {ROOM_SPECS[rm].capacity}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{ROOM_SPECS[rm].floor}</p>
                <p className="text-[11px] text-slate-600 mt-1 line-clamp-1">
                  <strong>Amenities:</strong> {ROOM_SPECS[rm].features}
                </p>
              </div>
            ))}
          </div>

          {/* Date Selector & Legend Controls */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Calendar className="text-[#0077cc]" size={20} />
              <label htmlFor="datePicker" className="font-semibold text-slate-700 text-sm">
                Select Date:
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
            </div>

            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-[#c8f7c5] border border-green-500 inline-block"></span>
                Available (Click to Book)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-[#f7c5c5] border border-red-300 inline-block"></span>
                Booked
              </span>
            </div>
          </div>

          {/* 12-Slot Matrix Table */}
          <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-center text-sm">
                <thead>
                  <tr className="bg-[#0077cc] text-white">
                    <th className="p-3 border border-slate-300 font-semibold w-1/4">Time Slot (2-Hour Blocks)</th>
                    {ROOMS.map((room) => (
                      <th key={room} className="p-3 border border-slate-300 font-semibold w-1/4">
                        <div className="font-bold">{room}</div>
                        <div className="text-[11px] font-normal opacity-90">{ROOM_SPECS[room].capacity}</div>
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
                        const existingBooking = bookings.find(
                          (b) => b.date === selectedDate && b.time_slot === slot && b.room === room
                        );

                        if (existingBooking) {
                          return (
                            <td key={room} className="p-2.5 border border-slate-200 bg-[#f7c5c5] text-red-900 font-medium">
                              <div className="flex flex-col items-center justify-center gap-0.5">
                                <span className="inline-block px-3 py-1 rounded text-xs bg-red-100 text-red-700 border border-red-200 font-bold">
                                  Booked
                                </span>
                                <span className="text-[10px] text-red-700/80 font-mono">
                                  Ref #{existingBooking.id}
                                </span>
                              </div>
                            </td>
                          );
                        }

                        return (
                          <td key={room} className="p-2.5 border border-slate-200 bg-[#c8f7c5]">
                            <button
                              onClick={() => handleStartBooking(room, slot)}
                              className="inline-block text-white bg-[#0077cc] hover:bg-[#005fa3] px-4 py-1.5 rounded text-xs font-semibold shadow-xs transition hover:scale-105 active:scale-95 cursor-pointer"
                            >
                              Book Now
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Helper Links */}
          <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 border-t pt-4">
            <div>
              Already booked a slot?{' '}
              <button
                onClick={() => setActiveTab('my_bookings')}
                className="text-[#0077cc] font-semibold underline hover:text-[#005fa3]"
              >
                Find & Print Your Pass
              </button>
            </div>
            <div>
              Library Desk Officer?{' '}
              <button
                onClick={() => setActiveTab('security_desk')}
                className="text-[#0077cc] font-semibold underline hover:text-[#005fa3]"
              >
                Open Security Key Registry
              </button>
            </div>
          </div>
        </main>
      )}

      {/* MODAL: BOOKING FORM (Active when slot chosen) */}
      {bookingSlot && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border-t-4 border-[#0077cc] animate-in fade-in zoom-in-95 duration-200 my-8">
            {!confirmedPass ? (
              <>
                <div className="flex items-center justify-between border-b pb-3 mb-4">
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Calendar size={18} className="text-[#0077cc]" />
                    Confirm Room Reservation
                  </h2>
                  <button
                    onClick={() => setBookingSlot(null)}
                    className="text-slate-400 hover:text-slate-600 font-bold text-lg"
                  >
                    ×
                  </button>
                </div>

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

                <form onSubmit={submitBooking} className="space-y-3 text-left text-sm">
                  <div>
                    <label className="block font-semibold text-slate-700 text-xs mb-1">
                      Applicant Full Name:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Siddharth Joshi"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-[#0077cc] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 text-xs mb-1">
                      Institute Email (<span className="text-red-600 font-bold">@iitb.ac.in strictly required</span>):
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="siddharth.j@iitb.ac.in"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-[#0077cc] focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Enforced by DRBS: Non-IITB domains are blocked.
                    </span>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 text-xs mb-1">
                      Roll Number / Employee ID:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 23B0912 or EMP448"
                      value={formData.roll_number}
                      onChange={(e) => setFormData({ ...formData, roll_number: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-[#0077cc] focus:outline-none"
                    />
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
                      <option value="Faculty">Faculty Member</option>
                    </select>
                  </div>

                  <div className="pt-3 flex items-center gap-2">
                    <button
                      type="submit"
                      className="flex-1 bg-[#0077cc] hover:bg-[#005fa3] text-white py-2.5 px-4 rounded font-semibold text-xs transition cursor-pointer"
                    >
                      Confirm Reservation
                    </button>
                    <button
                      type="button"
                      onClick={() => setBookingSlot(null)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 px-4 rounded font-medium text-xs transition"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </>
            ) : (
              /* DIGITAL PASS / E-TICKET */
              <div className="text-center">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 size={28} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Booking Confirmed!</h3>
                <p className="text-xs text-slate-500 mb-4">Your Discussion Room Digital Pass is ready.</p>

                {/* Printable Ticket Card */}
                <div className="bg-slate-50 border-2 border-dashed border-[#0077cc] p-4 rounded-xl text-left text-xs mb-4">
                  <div className="flex items-center justify-between border-b pb-2 mb-2">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Pass Reference</span>
                      <strong className="text-sm font-mono text-[#002855]">IITB-DRBS-#{confirmedPass.id}</strong>
                    </div>
                    {/* Simulated Authentic SVG QR Code */}
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
                      <span className="text-slate-500 text-[10px] block">Roll No:</span>
                      <strong className="text-slate-800 font-mono">{confirmedPass.roll_number}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Room Allocated:</span>
                      <strong className="text-[#0077cc] text-sm">{confirmedPass.room}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Category:</span>
                      <strong className="text-slate-800">{confirmedPass.category}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Date:</span>
                      <strong className="text-slate-800 font-mono">{confirmedPass.date}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Time Slot:</span>
                      <strong className="text-slate-800">{confirmedPass.time_slot}</strong>
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 text-amber-900 p-2 rounded text-[10px] leading-tight mt-2">
                    <strong>Important:</strong> Present this pass & deposit your physical IITB ID card with library security personnel to collect key.
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
              Student Pass & Reservation Lookup
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Enter your Roll Number or IITB Email to retrieve your passes and check-in statuses.
            </p>

            <form onSubmit={handleSearchStudent} className="flex gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="e.g. 210050012 or student@iitb.ac.in"
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

          {/* Results */}
          {searchedStudentBookings !== null && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600 px-1">
                <span>Found {searchedStudentBookings.length} booking(s)</span>
                {searchedStudentBookings.length > 0 && (
                  <button
                    onClick={() => setSearchedStudentBookings(null)}
                    className="text-[#0077cc] underline"
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
                        <span className="text-[11px] font-mono text-slate-500">Pass #IITB-{b.id}</span>
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

      {/* TAB 3: SECURITY GUARD DESK (Key issuance & return tracker) */}
      {activeTab === 'security_desk' && (
        <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-6">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Key size={20} className="text-amber-600" />
                Library Security Desk • Physical Key & ID Registry
              </h2>
              <span className="text-xs bg-slate-100 text-slate-600 font-mono px-2 py-1 rounded">
                Today: {getTodayStr()}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Per IITB library protocol, students must deposit their physical ID card at the security counter to receive the Discussion Room key. Security guards mark issuance and return below.
            </p>
          </div>

          {/* Table for Today's Active Reservations */}
          <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-center text-xs">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="p-3 border border-slate-700">Ref #</th>
                    <th className="p-3 border border-slate-700">Room</th>
                    <th className="p-3 border border-slate-700">Time Slot</th>
                    <th className="p-3 border border-slate-700">Student Name</th>
                    <th className="p-3 border border-slate-700">Roll No</th>
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
                      <td colSpan={7} className="p-8 text-slate-400">
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
            /* Admin Login Card */
            <div className="max-w-sm mx-auto my-12 bg-white p-6 rounded-xl shadow-md border border-slate-200 text-center">
              <div className="w-12 h-12 bg-sky-100 text-[#0077cc] rounded-full flex items-center justify-center mx-auto mb-3">
                <ShieldCheck size={26} />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-1">Admin Login</h2>
              <p className="text-xs text-slate-500 mb-4">Central Library Staff Management</p>

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
            /* Admin Console & Metrics */
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <BarChart3 className="text-[#0077cc]" size={22} />
                    DRBS Administrative Management & Analytics
                  </h2>
                  <p className="text-xs text-slate-500">Live metrics across all 3 IIT Bombay discussion rooms</p>
                </div>
                <button
                  onClick={() => setIsAdminLoggedIn(false)}
                  className="text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded transition flex items-center gap-1.5"
                >
                  <LogOut size={13} />
                  Logout
                </button>
              </div>

              {/* KPI Stat Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-xs text-slate-500">Today's Bookings</span>
                  <div className="text-2xl font-bold text-[#002855] mt-1">
                    {stats?.todayBookings ?? 0}
                  </div>
                  <span className="text-[10px] text-emerald-600 font-medium">
                    Out of 36 max slots
                  </span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-xs text-slate-500">Total All-Time Bookings</span>
                  <div className="text-2xl font-bold text-[#0077cc] mt-1">
                    {stats?.totalBookings ?? bookings.length}
                  </div>
                  <span className="text-[10px] text-slate-400">Saved on server database</span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-xs text-slate-500">Active Discussion Rooms</span>
                  <div className="text-2xl font-bold text-slate-800 mt-1">3 Rooms</div>
                  <span className="text-[10px] text-slate-400">DR-1, DR-2, DR-3</span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-xs text-slate-500">Domain Verification</span>
                  <div className="text-2xl font-bold text-emerald-600 mt-1">100%</div>
                  <span className="text-[10px] text-emerald-700 font-medium">Strict @iitb.ac.in</span>
                </div>
              </div>

              {/* Search & Filter Bar */}
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
                    className="ml-auto bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded font-medium transition"
                  >
                    Reset Filters
                  </button>
                </div>
              </div>

              {/* Admin Table */}
              <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-center text-xs">
                    <thead>
                      <tr className="bg-[#0077cc] text-white">
                        <th className="p-2.5 border border-slate-300">ID</th>
                        <th className="p-2.5 border border-slate-300">Name</th>
                        <th className="p-2.5 border border-slate-300">Email</th>
                        <th className="p-2.5 border border-slate-300">Roll No</th>
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
                            <td className="p-2 border border-slate-200 text-slate-600">{row.email}</td>
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
                          <td colSpan={9} className="p-6 text-slate-400">
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

      {/* TAB 5: ARCHITECTURE & ORIGINAL PHP CODE VIEWER */}
      {activeTab === 'architecture' && (
        <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-2">
              <Code2 className="text-amber-500" size={24} />
              Technical Architecture & Hackathon Presentation Guide
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              This system transitions the original PHP/MySQL prototype into an enterprise-grade full-stack Node.js + Express + React architecture with atomic server persistence, live REST APIs, security desk key tracking, and digital e-passes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Architecture Card */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <Building2 size={16} className="text-[#0077cc]" />
                Full-Stack System Components
              </h3>
              <ul className="text-xs text-slate-600 space-y-2">
                <li className="flex items-start gap-2">
                  <Check className="text-emerald-500 shrink-0 mt-0.5" size={14} />
                  <span><strong>Express REST Backend (<code>server.ts</code>):</strong> Handles REST endpoints, validation rules, collision locking, and security logging.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="text-emerald-500 shrink-0 mt-0.5" size={14} />
                  <span><strong>Server Persistence (<code>data/bookings.json</code>):</strong> Atomic server-side JSON storage so bookings are synchronized across multiple browser sessions in real time.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="text-emerald-500 shrink-0 mt-0.5" size={14} />
                  <span><strong>Security Protocol Integration:</strong> Physical ID deposit and key check-in workflow required by IITB Central Library regulations.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="text-emerald-500 shrink-0 mt-0.5" size={14} />
                  <span><strong>Digital Pass Verification:</strong> Instant pass generation with reference ID and QR code for security verification.</span>
                </li>
              </ul>
            </div>

            {/* PHP Inspector Selector */}
            <div className="bg-slate-900 text-white p-5 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
                  <FileText size={16} />
                  Original PHP Scripts from /project:
                </h3>
                <div className="flex items-center gap-1 flex-wrap">
                  {Object.keys(PHP_FILES).map((file) => (
                    <button
                      key={file}
                      onClick={() => setSelectedPhpFile(file)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono transition ${
                        selectedPhpFile === file
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {file}
                    </button>
                  ))}
                </div>
              </div>
              <pre className="bg-slate-950 text-emerald-400 p-3 rounded font-mono text-[11px] overflow-x-auto border border-slate-800 max-h-48 leading-relaxed">
                {PHP_FILES[selectedPhpFile]}
              </pre>
            </div>
          </div>
        </main>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-3 text-center text-xs text-slate-500 mt-auto">
        Indian Institute of Technology Bombay • Central Library Discussion Room Booking System (DRBS)
      </footer>
    </div>
  );
}
