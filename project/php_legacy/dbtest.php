<?php
$host = "localhost";
$user = "booking_user";
$pass = "Book@1234";
$dbname = "booking_system";

// Try connection
$conn = new mysqli($host, $user, $pass, $dbname);

// Check connection
if ($conn->connect_error) {
    die("❌ Database connection failed: " . $conn->connect_error);
} else {
    echo "✅ Database connection successful!<br>";
}

// Try a simple query
$sql = "SHOW TABLES";
$result = $conn->query($sql);

if ($result) {
    echo "Tables in database <strong>$dbname</strong>:<br>";
    while ($row = $result->fetch_array()) {
        echo " - " . $row[0] . "<br>";
    }
} else {
    echo "⚠️ Could not fetch tables: " . $conn->error;
}

$conn->close();
?>

