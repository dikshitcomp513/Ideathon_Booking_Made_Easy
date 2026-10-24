<?php
$host = "localhost";
$user = "booking_user";
$pass = "Book@1234";
$dbname = "booking_system";

$conn = new mysqli($host, $user, $pass, $dbname);
if ($conn->connect_error) die("DB Connection failed: ".$conn->connect_error);

$date = $_GET['date'] ?? $_POST['date'] ?? '';
$time = $_GET['time'] ?? $_POST['time'] ?? '';
$room = $_GET['room'] ?? $_POST['room'] ?? '';

if ($_SERVER["REQUEST_METHOD"] === "POST" && isset($_POST['name'])) {
    $name = $_POST['name'];
    $email = $_POST['email'];
    $roll = $_POST['roll_number'];
    $category = $_POST['category'];

    if (!preg_match("/@iitb\.ac\.in$/", $email)) die("<h3 style='color:red;text-align:center;'>❌ Email must be @iitb.ac.in</h3>");

    // Max 2 slots per day
    $checkSlots = $conn->prepare("SELECT COUNT(*) FROM bookings WHERE email=? AND date=?");
    $checkSlots->bind_param("ss",$email,$date);
    $checkSlots->execute();
    $checkSlots->bind_result($count);
    $checkSlots->fetch();
    $checkSlots->close();
    if($count >=2) die("<h3 style='color:red;text-align:center;'>❌ Maximum 2 slots per day.</h3>");

    // Time slot already booked?
    $checkTime = $conn->prepare("SELECT id FROM bookings WHERE date=? AND time_slot=?");
    $checkTime->bind_param("ss",$date,$time);
    $checkTime->execute();
    $checkTime->store_result();
    if($checkTime->num_rows>0) die("<h3 style='color:red;text-align:center;'>❌ This time slot is already booked.</h3>");
    $checkTime->close();

    $stmt = $conn->prepare("INSERT INTO bookings (name,email,roll_number,category,date,time_slot,room) VALUES (?,?,?,?,?,?,?)");
    $stmt->bind_param("sssssss",$name,$email,$roll,$category,$date,$time,$room);
    if($stmt->execute()){
        echo "<h3 style='color:green;text-align:center;'>✅ Booking confirmed for $room on $date ($time).</h3>";
        echo "<p style='text-align:center;'><a href='index.php?date=$date'>Back to Availability</a></p>";
    } else{
        echo "<h3 style='color:red;text-align:center;'>Error: ".$stmt->error."</h3>";
    }
    $stmt->close();
} else {
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Confirm Booking</title>
<style>
body { font-family: Arial; background:#f5f8fa; padding:40px; text-align:center; }
.form-box { max-width:400px;margin:auto;background:#fff;padding:20px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.1);}
input,select { width:100%;padding:8px;margin-bottom:10px;border-radius:5px;border:1px solid #ccc; }
button { width:100%;background:#0077cc;color:#fff;border:none;padding:10px;border-radius:5px;cursor:pointer;}
button:hover { background:#005fa3; }
</style>
</head>
<body>
<div class="form-box">
<h2>Confirm Booking</h2>
<form method="POST" action="book.php">
<label>Date:</label>
<input type="text" name="date" value="<?php echo htmlspecialchars($date); ?>" readonly>
<label>Time Slot:</label>
<input type="text" name="time" value="<?php echo htmlspecialchars($time); ?>" readonly>
<label>Room:</label>
<input type="text" name="room" value="<?php echo htmlspecialchars($room); ?>" readonly>
<label>Your Name:</label>
<input type="text" name="name" required>
<label>Email (@iitb.ac.in):</label>
<input type="email" name="email" required>
<label>Roll Number:</label>
<input type="text" name="roll_number" required>
<label>Category:</label>
<select name="category" required>
<option value="">Select</option>
<option value="UG">UG Student</option>
<option value="PG">PG Student</option>
<option value="PhD">PhD</option>
<option value="PDF">PDF</option>
<option value="Faculty">Faculty</option>
</select>
<button type="submit">Confirm Booking</button>
</form>
</div>
</body>
</html>
<?php } $conn->close(); ?>

