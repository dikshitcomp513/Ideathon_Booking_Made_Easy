<?php
session_start();
if(isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true){
    header("Location: admin.php");
    exit();
}

$error = '';
if($_SERVER["REQUEST_METHOD"]==="POST"){
    $username = $_POST['username'];
    $password = $_POST['password'];
    // Set admin credentials
    if($username==="admin" && $password==="admin123"){
        $_SESSION['admin_logged_in']=true;
        header("Location: admin.php");
        exit();
    } else {
        $error="Invalid username or password.";
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Admin Login - DRBS</title>
<style>
body { font-family: Arial; background:#f5f8fa; text-align:center; padding:50px; }
.form-box { max-width:400px;margin:auto;background:#fff;padding:20px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.1);}
input { width:100%; padding:8px; margin-bottom:10px; border-radius:5px; border:1px solid #ccc; }
button { width:100%; background:#0077cc; color:white; border:none; padding:10px; border-radius:5px; cursor:pointer;}
button:hover{ background:#005fa3; }
.error{color:red; margin-bottom:10px;}
header { text-align: center; margin-bottom: 20px; }
header img { height: 80px; }
</style>
</head>
<body>
<header>
<img src="iitb_logo.png" alt="IIT Bombay Logo">
<h1>INDIAN INSTITUTE OF TECHNOLOGY BOMBAY</h1>
<h2>CENTRAL LIBRARY</h2>
<h3>Discussion Room Booking System (DRBS)</h3>
</header>
<div class="form-box">
<h2>Admin Login</h2>
<?php if($error) echo "<div class='error'>$error</div>"; ?>
<form method="POST" action="">
<input type="text" name="username" placeholder="Username" required>
<input type="password" name="password" placeholder="Password" required>
<button type="submit">Login</button>
</form>
</div>
</body>
</html>

