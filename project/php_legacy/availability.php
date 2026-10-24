<?php
$host = "localhost";
$user = "booking_user";
$pass = "Book@1234";
$dbname = "booking_system";

$conn = new mysqli($host, $user, $pass, $dbname);
if ($conn->connect_error) {
    die("DB Connection failed: " . $conn->connect_error);
}

$date = $_GET['date'] ?? date("Y-m-d");

$sql = "SELECT * FROM bookings WHERE date=? ORDER BY room, time_slot";
$stmt = $conn->prepare($sql);
$stmt->bind_param("s", $date);
$stmt->execute();
$result = $stmt->get_result();
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Admin - Booking Availability</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; background: #f5f8fa; }
    h2 { text-align: center; }
    table { width: 100%; border-collapse: collapse; background: #fff; margin-top: 20px; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: center; }
    th { background: #0077cc; color: #fff; }
    tr:nth-child(even) { background: #f2f2f2; }
  </style>
</head>
<body>
  <h2>Admin - Bookings for <?php echo htmlspecialchars($date); ?></h2>

  <table>
    <tr>
      <th>ID</th>
      <th>Name</th>
      <th>Roll Number</th>
      <th>Category</th>
      <th>Email</th>
      <th>Date</th>
      <th>Time Slot</th>
      <th>Room</th>
      <th>Created At</th>
    </tr>
    <?php while ($row = $result->fetch_assoc()): ?>
      <tr>
        <td><?php echo $row['id']; ?></td>
        <td><?php echo htmlspecialchars($row['name']); ?></td>
        <td><?php echo htmlspecialchars($row['roll_number']); ?></td>
        <td><?php echo htmlspecialchars($row['category']); ?></td>
        <td><?php echo htmlspecialchars($row['email']); ?></td>
        <td><?php echo htmlspecialchars($row['date']); ?></td>
        <td><?php echo htmlspecialchars($row['time_slot']); ?></td>
        <td><?php echo htmlspecialchars($row['room']); ?></td>
        <td><?php echo htmlspecialchars($row['created_at']); ?></td>
      </tr>
    <?php endwhile; ?>
  </table>
</body>
</html>
<?php $conn->close(); ?>

