<?php
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

// Discussion Rooms
$rooms = ["DR-1", "DR-2", "DR-3"];
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Discussion Room Booking System (DRBS)</title>
<style>
/* Page Layout */
body { font-family: Arial, sans-serif; background:#f5f8fa; margin:0; padding:0; }
header { text-align:center; padding:20px; background:#fff; border-bottom:2px solid #0077cc; }
header img { height:80px; }
header h1 { margin:10px 0 5px; color:#002855; }
header h2 { margin:5px 0; color:#0077cc; }
header h3 { margin:5px 0; color:#444; }
.date-box { text-align:center; margin:20px; }
.date-box input { padding:5px; font-size:16px; }

/* Availability Table */
table { border-collapse:collapse; margin:20px auto; width:90%; background:#fff; box-shadow:0 2px 8px rgba(0,0,0,.1); border-radius:8px; overflow:hidden; }
th, td { border:1px solid #ccc; padding:10px; text-align:center; font-size:14px; }
th { background:#0077cc; color:white; }
.available { background:#c8f7c5; }   /* Green */
.booked { background:#f7c5c5; }      /* Red */
a.book-btn { text-decoration:none; color:white; background:#0077cc; padding:5px 10px; border-radius:5px; }
a.book-btn:hover { background:#005fa3; }

/* Modal (Guidelines Popup) */
.modal {
  display:block; position:fixed; z-index:9999;
  left:0; top:0; width:100%; height:100%;
  background-color:rgba(0,0,0,0.6); padding-top:80px;
}
.modal-content {
  background-color:#fff; margin:auto; padding:20px;
  border-radius:10px; width:60%;
  box-shadow:0 4px 12px rgba(0,0,0,0.2);
  animation:fadeIn 0.5s;
}
@keyframes fadeIn { from {opacity:0} to {opacity:1} }
.modal h2 { text-align:center; color:#0077cc; }
.modal p { line-height:1.6; font-size:15px; }
.accept-box { margin-top:15px; text-align:center; }
button {
  background:#0077cc; color:white; border:none; padding:10px 20px;
  border-radius:5px; cursor:pointer; margin-top:10px;
}
button:disabled { background:#ccc; cursor:not-allowed; }
</style>
</head>
<body>

<!-- Header with Logo and Headings -->
<header>
  <img src="iitb_logo.png" alt="IIT Bombay Logo">
  <h1>INDIAN INSTITUTE OF TECHNOLOGY BOMBAY</h1>
  <h2>Central Library</h2>
  <h3>Discussion Room Booking System (DRBS)</h3>
</header>

<!-- Guidelines Modal -->
<div id="guidelinesModal" class="modal">
  <div class="modal-content">
    <h2>Attention!!!</h2>
    <p><strong>Discussion Rooms are available by pre-booking.</strong></p>
    <p>To book a room and collect the key, please submit your Institute ID card to the security personnel.</p>
    <p>Each IITB group can use a Discussion Room for up to two hours.</p>
    <p>Please maintain cleanliness in the room.</p>
    <p>Handle all equipment with care.</p>
    <p><strong>This facility is exclusively for IITB students.</strong></p>
    
    <div class="accept-box">
      <input type="checkbox" id="acceptGuidelines"> I have read and accept the guidelines.
      <br>
      <button id="continueBtn" disabled>Continue</button>
    </div>
  </div>
</div>

<!-- Date Selection -->
<div class="date-box">
  <form method="GET" action="">
    <label><strong>Select Date:</strong></label>
    <input type="date" name="date" value="<?php echo $date; ?>" min="<?php echo date('Y-m-d'); ?>" onchange="this.form.submit()">
  </form>
</div>

<!-- Availability Table -->
<table>
  <tr>
    <th>Time Slot</th>
    <?php foreach ($rooms as $room) echo "<th>$room</th>"; ?>
  </tr>
  <?php foreach ($slots as $slot): ?>
    <tr>
      <td><?php echo $slot; ?></td>
      <?php foreach ($rooms as $room): ?>
        <?php
        $stmt = $conn->prepare("SELECT id FROM bookings WHERE date=? AND time_slot=? AND room=?");
        $stmt->bind_param("sss", $date, $slot, $room);
        $stmt->execute();
        $stmt->store_result();
        if ($stmt->num_rows > 0) {
            echo "<td class='booked'>Booked</td>";
        } else {
            echo "<td class='available'><a class='book-btn' href='book.php?date=$date&time=$slot&room=$room'>Book</a></td>";
        }
        $stmt->close();
        ?>
      <?php endforeach; ?>
    </tr>
  <?php endforeach; ?>
</table>

<script>
const checkbox = document.getElementById("acceptGuidelines");
const continueBtn = document.getElementById("continueBtn");
const modal = document.getElementById("guidelinesModal");

checkbox.addEventListener("change", () => {
  continueBtn.disabled = !checkbox.checked;
});

continueBtn.addEventListener("click", () => {
  modal.style.display = "none"; // Hide modal
});
</script>
</body>
</html>
<?php $conn->close(); ?>
