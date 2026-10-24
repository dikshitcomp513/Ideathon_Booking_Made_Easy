<?php
session_start();
if(!isset($_SESSION['admin_logged_in']) || $_SESSION['admin_logged_in']!==true){
    header("Location: admin_login.php");
    exit();
}

$host="localhost"; $user="booking_user"; $pass="Book@1234"; $dbname="booking_system";
$conn=new mysqli($host,$user,$pass,$dbname);
if($conn->connect_error) die("DB Connection failed: ".$conn->connect_error);

// Filters
$search_email = $_GET['email'] ?? "";
$search_date = $_GET['date'] ?? "";
$search_room = $_GET['room'] ?? "";

// Build query
$sql="SELECT * FROM bookings WHERE 1=1";
if($search_email) $sql.=" AND email LIKE '%".$conn->real_escape_string($search_email)."%'";
if($search_date) $sql.=" AND date='".$conn->real_escape_string($search_date)."'";
if($search_room) $sql.=" AND room='".$conn->real_escape_string($search_room)."'";
$sql.=" ORDER BY date,time_slot,room";
$result=$conn->query($sql);
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Admin Dashboard - DRBS</title>
<style>
body { font-family: Arial, sans-serif; background:#f5f8fa; padding:20px; }
header { text-align:center; margin-bottom:20px; }
header img { height:80px; }
h1,h2,h3{margin:5px;}
table { width:100%; border-collapse:collapse; background:#fff; }
th,td { padding:8px; border:1px solid #ccc; text-align:center; }
th { background:#0077cc; color:white; }
tr:nth-child(even){background:#f2f2f2;}
.delete-btn { color:white; background:red; padding:5px 10px; border:none; border-radius:5px; cursor:pointer;}
.delete-btn:hover{ background:darkred; }
.logout { text-align:right; margin-bottom:10px; }
.logout a { color:red; text-decoration:none; font-weight:bold; }
.filter-box { background:#fff; padding:15px; border-radius:10px; box-shadow:0 0 8px rgba(0,0,0,.1); margin-bottom:20px; }
input,select,button { padding:6px; border-radius:5px; margin-right:5px; }
</style>
</head>
<body>
<header>
<img src="iitb_logo.png" alt="IIT Bombay Logo">
<h1>INDIAN INSTITUTE OF TECHNOLOGY BOMBAY</h1>
<h2>CENTRAL LIBRARY</h2>
<h3>Discussion Room Booking System (DRBS)</h3>
</header>
<div class="logout"><a href="logout.php">Logout</a></div>

<div class="filter-box">
<form method="GET" action="">
<label>Email:</label>
<input type="text" name="email" value="<?php echo htmlspecialchars($search_email); ?>">
<label>Date:</label>
<input type="date" name="date" value="<?php echo htmlspecialchars($search_date); ?>">
<label>Room:</label>
<select name="room">
<option value="">All</option>
<option value="DR-1" <?php if($search_room=="DR-1") echo "selected"; ?>>DR-1</option>
<option value="DR-2" <?php if($search_room=="DR-2") echo "selected"; ?>>DR-2</option>
<option value="DR-3" <?php if($search_room=="DR-3") echo "selected"; ?>>DR-3</option>
</select>
<button type="submit">Search</button>
<a href="admin.php">Reset</a>
</form>
</div>

<table>
<tr>
<th>ID</th><th>Name</th><th>Email</th><th>Roll No</th><th>Category</th><th>Date</th><th>Time Slot</th><th>Room</th><th>Action</th>
</tr>
<?php
if($result->num_rows>0){
    while($row=$result->fetch_assoc()){
        echo "<tr>
        <td>".$row['id']."</td>
        <td>".$row['name']."</td>
        <td>".$row['email']."</td>
        <td>".$row['roll_number']."</td>
        <td>".$row['category']."</td>
        <td>".$row['date']."</td>
        <td>".$row['time_slot']."</td>
        <td>".$row['room']."</td>
        <td>
        <form action='delete.php' method='POST' style='margin:0;'>
        <input type='hidden' name='id' value='".$row['id']."'>
        <button type='submit' class='delete-btn'>Delete</button>
        </form>
        </td>
        </tr>";
    }
}else{ echo "<tr><td colspan='9'>No bookings found.</td></tr>"; }
$conn->close();
?>
</table>
</body>
</html>

