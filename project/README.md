# ETD-2026 Library — Discussion Room Booking System (DRBS)

A full-stack, standalone discussion room booking system built for the **Library of ETD-2026**.

---

## 🚀 Quick Start (Running on Any Computer)

You only need **Node.js** (v18 or higher) installed on your machine.

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Application
```bash
npm run dev
```

### 3. Open in Browser
Visit:
```
http://localhost:3000
```

---

## 📁 Project Structure

```
project/
├── data/
│   └── bookings.json        # Atomic JSON server database (persists across restarts)
├── public/
│   └── ideathon_logo.png    # ETD-2026 library crest & emblem
├── src/
│   ├── App.tsx              # Complete React application & views
│   ├── main.tsx             # React client bootstrap
│   └── index.css            # Tailwind CSS styles
├── php_legacy/              # Original PHP/MySQL scripts archive
├── index.html               # Main HTML entry point
├── server.ts                # Express REST API backend with Vite integration
├── vite.config.ts           # Vite build configuration
├── tsconfig.json            # TypeScript configuration
└── package.json             # NPM dependencies & scripts
```

---

## 🌟 Key Features

* **Google Calendar-Style Monthly Overview:**
  * Intuitive calendar view displaying free room availability count and shared slots per day.
  * Direct one-click navigation into time slots & rooms for any selected date.
* **Strict `@etd2026.org` Domain Authorization & 2FA Confirmation:**
  * Only accepts institutional emails ending in `@etd2026.org` to prevent abuse.
  * 2FA email confirmation ping with 6-digit verification code to ensure student identity.
* **Smart Partial Co-Sharing & Partition Buffer Rule:**
  * If an existing group occupies $< 50\%$ of room capacity, another group can co-share the room.
  * Enforces an automatic 2-seat partition buffer: $\text{Group 1} + \text{Group 2} \le \text{Room Capacity} - 2$.
* **Privacy Opt-Out Toggle:**
  * Primary bookers can check *"Reserve as Exclusive / Private Room"* to disable co-sharing completely for confidential sessions.
* **Real-Time Booking Matrix:** 24-hour slots (12 two-hour blocks) across rooms **DR-1** (10 max), **DR-2** (8 max), and **DR-3** (14 max).
* **Pre-Booking Rules Enforced:**
  * Maximum 2 slots per day per applicant.
  * Double-booking and collision prevention.
* **Digital e-Pass Generation:** Instant printable pass with unique reference ID (`ETD-DRBS-#ID`), privacy badge, and verification QR code.
* **Security Desk Key Registry:** Security guards can track physical ID card deposit and room key handover/return.
* **Delegate Self-Service:** Search and retrieve previous reservations using Delegate ID or Email.
* **Admin Dashboard & Analytics:** Metrics on daily utilization, room popularity, category breakdowns, and one-click booking cancellation.
  * Default Admin credentials: `admin` / `admin123`.
