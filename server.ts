import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Data storage configuration
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'bookings.json');

interface Booking {
  id: number;
  name: string;
  email: string;
  roll_number: string;
  category: 'UG' | 'PG' | 'PhD' | 'PDF' | 'Faculty';
  group_size: number;
  allow_coshare?: boolean; // false if user opted out of room sharing
  date: string;
  time_slot: string;
  room: 'DR-1' | 'DR-2' | 'DR-3';
  key_status: 'not_collected' | 'key_issued' | 'key_returned';
  created_at: string;
}

// In-memory 2FA verification code store for anti-misuse
const verificationCodes: Record<string, { code: string; expiresAt: number }> = {};

// Pluggable email dispatch service (Ready for Nodemailer / SendGrid / Resend)
async function sendEmailNotification(to: string, subject: string, body: string, code: string): Promise<boolean> {
  // Production hook: Replace with nodemailer.createTransport() or Resend API
  console.log(`[EMAIL DISPATCH PING] To: ${to} | Subject: ${subject} | 2FA Code: ${code}`);
  return true;
}

// Ensure DB directory and seed file exist
function getTodayDateStr(): string {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

function initDatabase(): Booking[] {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(content);
    } catch (e) {
      console.error('Error reading db file, resetting with seed data', e);
    }
  }

  const today = getTodayDateStr();
  const seed: Booking[] = [
    {
      id: 1,
      name: 'Dr. Sarah Jenkins',
      email: 's.jenkins@etd2026.org',
      roll_number: 'ETD-DEL-102',
      category: 'Faculty',
      group_size: 4,
      date: today,
      time_slot: '10:00 - 12:00',
      room: 'DR-1',
      key_status: 'key_issued',
      created_at: `${today} 08:30:00`,
    },
    {
      id: 2,
      name: 'Rohan Mehra',
      email: 'rohan.m@etd2026.org',
      roll_number: 'ETD-RES-405',
      category: 'PhD',
      group_size: 3,
      date: today,
      time_slot: '14:00 - 16:00',
      room: 'DR-2',
      key_status: 'not_collected',
      created_at: `${today} 09:15:00`,
    },
    {
      id: 3,
      name: 'Ananya Sharma',
      email: 'ananya.s@etd2026.org',
      roll_number: 'ETD-PG-889',
      category: 'PG',
      group_size: 2,
      date: today,
      time_slot: '16:00 - 18:00',
      room: 'DR-1',
      key_status: 'not_collected',
      created_at: `${today} 11:00:00`,
    },
  ];

  fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), 'utf-8');
  return seed;
}

function readBookings(): Booking[] {
  try {
    if (!fs.existsSync(DB_FILE)) {
      return initDatabase();
    }
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading bookings:', err);
    return [];
  }
}

function writeBookings(bookings: Booking[]): boolean {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(bookings, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing bookings:', err);
    return false;
  }
}

// Initial check
initDatabase();

// --- REST API ENDPOINTS ---

// 0. POST /api/auth/send-verification (2FA Confirmation Email Ping)
app.post('/api/auth/send-verification', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ success: false, error: 'Email address is required.' });
  }

  const trimmed = email.trim().toLowerCase();
  // Strictly enforce @etd2026.org
  if (!trimmed.endsWith('@etd2026.org')) {
    return res.status(400).json({
      success: false,
      error: '❌ Access restricted: Email must end with @etd2026.org (e.g. yourname@etd2026.org).',
    });
  }

  // Generate 6-digit confirmation code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  verificationCodes[trimmed] = {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
  };

  await sendEmailNotification(
    trimmed,
    'ETD-2026 Discussion Room 2FA Authorization Code',
    `Your verification code to confirm room reservation is: ${code}`,
    code
  );

  return res.json({
    success: true,
    message: `📨 Confirmation ping sent to ${trimmed}. Please enter the 6-digit 2FA code to confirm your reservation.`,
    demoCode: code, // Provided for instant hackathon demonstration/testing
  });
});

// 1. GET /api/bookings with filters
app.get('/api/bookings', (req: Request, res: Response) => {
  const { date, email, room, roll_number } = req.query;
  let bookings = readBookings();

  if (date && typeof date === 'string') {
    bookings = bookings.filter((b) => b.date === date);
  }
  if (email && typeof email === 'string') {
    bookings = bookings.filter((b) => b.email.toLowerCase().includes(email.toLowerCase()));
  }
  if (room && typeof room === 'string' && room !== 'All') {
    bookings = bookings.filter((b) => b.room === room);
  }
  if (roll_number && typeof roll_number === 'string') {
    bookings = bookings.filter((b) => b.roll_number.toLowerCase() === roll_number.toLowerCase());
  }

  // Sort by date ascending, time_slot ascending, room
  bookings.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.time_slot !== b.time_slot) return a.time_slot.localeCompare(b.time_slot);
    return a.room.localeCompare(b.room);
  });

  res.json({ success: true, count: bookings.length, data: bookings });
});

// 2. GET /api/bookings/:id
app.get('/api/bookings/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const bookings = readBookings();
  const booking = bookings.find((b) => b.id === id);
  if (!booking) {
    return res.status(404).json({ success: false, error: 'Booking not found' });
  }
  res.json({ success: true, data: booking });
});

// 3. POST /api/bookings (Create a booking with strict @etd2026.org and group_size)
app.post('/api/bookings', (req: Request, res: Response) => {
  const { name, email, roll_number, category, group_size, allow_coshare, date, time_slot, room, verification_code } = req.body;

  if (!name || !email || !roll_number || !category || !date || !time_slot || !room) {
    return res.status(400).json({ success: false, error: 'All fields are required.' });
  }

  const trimmedEmail = String(email).trim().toLowerCase();

  // Strict validation: must end with @etd2026.org
  if (!trimmedEmail.endsWith('@etd2026.org')) {
    return res.status(400).json({
      success: false,
      error: '❌ Access restricted: Email must end with @etd2026.org (e.g. yourname@etd2026.org).',
    });
  }

  // Check 2FA verification code if provided
  if (verification_code) {
    const record = verificationCodes[trimmedEmail];
    if (!record || record.code !== String(verification_code).trim()) {
      return res.status(400).json({
        success: false,
        error: '❌ Invalid or expired 2FA confirmation code. Please request a new code.',
      });
    }
    // Remove used code
    delete verificationCodes[trimmedEmail];
  }

  const bookings = readBookings();

  // Rule 2: Max 2 slots per day per email
  const userSlotsToday = bookings.filter(
    (b) => b.email.toLowerCase() === trimmedEmail.toLowerCase() && b.date === date
  );
  if (userSlotsToday.length >= 2) {
    return res.status(400).json({ success: false, error: '❌ Maximum 2 slots per day.' });
  }

  const ROOM_CAPACITIES: Record<string, number> = {
    'DR-1': 10,
    'DR-2': 8,
    'DR-3': 14,
  };

  const roomMax = ROOM_CAPACITIES[room] || 10;
  const existingForSlot = bookings.filter(
    (b) => b.date === date && b.time_slot === time_slot && b.room === room
  );

  const newGroupSize = Math.max(1, Number(group_size) || 1);

  // Partial Booking Rule check:
  if (existingForSlot.length >= 2) {
    return res.status(400).json({
      success: false,
      error: '❌ This room is already fully booked for this time slot (maximum 2 co-sharing groups reached).',
    });
  }

  if (existingForSlot.length === 1) {
    const firstGroup = existingForSlot[0];
    const firstGroupSize = Number(firstGroup.group_size) || 2;
    const halfRoom = roomMax / 2;

    // Rule 0: Check if first group opted out of co-sharing
    if (firstGroup.allow_coshare === false) {
      return res.status(400).json({
        success: false,
        error: '❌ The primary group opted for an exclusive private reservation. Co-sharing is not permitted.',
      });
    }

    // Rule 1: Less than half of the room must be filled by group 1
    if (firstGroupSize >= halfRoom) {
      return res.status(400).json({
        success: false,
        error: `❌ This room is reserved by a primary group of ${firstGroupSize} students and is not eligible for co-sharing.`,
      });
    }

    // Rule 2: Two bookings total must be at least 2 less than max (leaving 2-seat buffer)
    const maxAllowedForSecondGroup = (roomMax - 2) - firstGroupSize;
    if (newGroupSize > maxAllowedForSecondGroup) {
      return res.status(400).json({
        success: false,
        error: `❌ Group size exceeds co-sharing partition limit. Maximum ${maxAllowedForSecondGroup} students allowed to ensure a 2-seat partition buffer.`,
      });
    }
  } else {
    if (newGroupSize > roomMax) {
      return res.status(400).json({
        success: false,
        error: `❌ Group size (${newGroupSize}) exceeds maximum room capacity of ${roomMax} persons.`,
      });
    }
  }

  const now = new Date();
  const created_at = `${now.toISOString().split('T')[0]} ${now.toTimeString().split(' ')[0]}`;
  const newId = bookings.length > 0 ? Math.max(...bookings.map((b) => b.id)) + 1 : 1;

  const newBooking: Booking = {
    id: newId,
    name: String(name).trim(),
    email: trimmedEmail,
    roll_number: String(roll_number).trim(),
    category,
    group_size: Math.max(1, Math.min(20, Number(group_size) || 1)),
    allow_coshare: allow_coshare === undefined ? true : Boolean(allow_coshare),
    date,
    time_slot,
    room,
    key_status: 'not_collected',
    created_at,
  };

  bookings.push(newBooking);
  writeBookings(bookings);

  return res.status(201).json({
    success: true,
    message: `✅ Booking confirmed for ${room} on ${date} (${time_slot}).`,
    data: newBooking,
  });
});

// 4. DELETE /api/bookings/:id (Admin deletion)
app.delete('/api/bookings/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const bookings = readBookings();
  const index = bookings.findIndex((b) => b.id === id);

  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Booking not found.' });
  }

  const [removed] = bookings.splice(index, 1);
  writeBookings(bookings);

  res.json({ success: true, message: `Booking #${id} deleted successfully.`, data: removed });
});

// 5. PATCH /api/bookings/:id/key-status (Security desk check-in/return tracker)
app.patch('/api/bookings/:id/key-status', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { key_status } = req.body;

  if (!['not_collected', 'key_issued', 'key_returned'].includes(key_status)) {
    return res.status(400).json({ success: false, error: 'Invalid key status.' });
  }

  const bookings = readBookings();
  const booking = bookings.find((b) => b.id === id);

  if (!booking) {
    return res.status(404).json({ success: false, error: 'Booking not found.' });
  }

  booking.key_status = key_status;
  writeBookings(bookings);

  res.json({ success: true, message: 'Key status updated.', data: booking });
});

// 6. POST /api/admin/login
app.post('/api/admin/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    return res.json({ success: true, token: 'drbs_admin_jwt_secret_token_123' });
  }
  return res.status(401).json({ success: false, error: 'Invalid username or password.' });
});

// 7. GET /api/stats (Real-time analytics for hackathon presentation)
app.get('/api/stats', (req: Request, res: Response) => {
  const bookings = readBookings();
  const today = getTodayDateStr();

  const totalBookings = bookings.length;
  const todayBookings = bookings.filter((b) => b.date === today).length;

  const roomCounts: Record<string, number> = { 'DR-1': 0, 'DR-2': 0, 'DR-3': 0 };
  const categoryCounts: Record<string, number> = { UG: 0, PG: 0, PhD: 0, PDF: 0, Faculty: 0 };

  bookings.forEach((b) => {
    if (roomCounts[b.room] !== undefined) roomCounts[b.room]++;
    if (categoryCounts[b.category] !== undefined) categoryCounts[b.category]++;
  });

  res.json({
    success: true,
    data: {
      totalBookings,
      todayBookings,
      roomCounts,
      categoryCounts,
      activeRooms: 3,
      totalDailyCapacity: 36, // 12 slots * 3 rooms
    },
  });
});

// 8. POST /api/reset-demo
app.post('/api/reset-demo', (req: Request, res: Response) => {
  if (fs.existsSync(DB_FILE)) {
    fs.unlinkSync(DB_FILE);
  }
  const seed = initDatabase();
  res.json({ success: true, message: 'Database reset to initial sample state.', data: seed });
});

// --- VITE MIDDLEWARE IN DEV / STATIC SERVE IN PROD ---
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DRBS Full-Stack Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
