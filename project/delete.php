<?php
$host = "localhost";
$user = "booking_user";
$pass = "Book@1234";
$dbname = "booking_system";

$conn = new mysqli($host, $user, $pass, $dbname);
if ($conn->connect_error) die("DB failed: " . $conn->connect_error);

$id = $_GET['id'] ?? 0;
if ($id) {
    $stmt = $conn->prepare("DELETE FROM bookings WHERE id=?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $stmt->close();
}
$conn->close();
header("Location: admin.php");
exit;

