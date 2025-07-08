<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

// Database configuration
$host = 'localhost';
$dbname = 'database';
$username = 'root';
$password = 'smit0987';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch(PDOException $e) {
    echo json_encode(['success' => false, 'error' => 'Database connection failed']);
    exit;
}

// GET - Fetch sessions for a trainer
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $trainer_id = $_GET['trainer_id'] ?? '';
    
    if (empty($trainer_id)) {
        echo json_encode(['success' => false, 'error' => 'Trainer ID is required']);
        exit;
    }
    
    try {
        // First, auto-remove completed sessions
        $current_datetime = date('Y-m-d H:i:s');
        $cleanup_stmt = $pdo->prepare("
            DELETE FROM sessions 
            WHERE trainer_id = ? 
            AND CONCAT(session_date, ' ', session_time) + INTERVAL duration MINUTE < ?
        ");
        $cleanup_stmt->execute([$trainer_id, $current_datetime]);
        
        if ($cleanup_stmt->rowCount() > 0) {
            error_log("Auto-removed " . $cleanup_stmt->rowCount() . " completed sessions for trainer " . $trainer_id);
        }
        
        // Then fetch remaining sessions
        $stmt = $pdo->prepare("SELECT * FROM sessions WHERE trainer_id = ? ORDER BY session_date, session_time");
        $stmt->execute([$trainer_id]);
        $sessions = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode(['success' => true, 'sessions' => $sessions]);
    } catch(PDOException $e) {
        echo json_encode(['success' => false, 'error' => 'Failed to fetch sessions']);
    }
}

// POST - Create new sessions
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $trainer_id = $input['trainer_id'] ?? '';
    $sessions = $input['sessions'] ?? [];
    
    if (empty($trainer_id) || empty($sessions)) {
        echo json_encode(['success' => false, 'error' => 'Trainer ID and sessions are required']);
        exit;
    }
    
    try {
        $pdo->beginTransaction();
        
        $stmt = $pdo->prepare("INSERT INTO sessions (trainer_id, title, client_name, session_date, session_time, duration, session_type, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        
        $created_sessions = [];
        foreach ($sessions as $session) {
            $stmt->execute([
                $trainer_id,
                $session['title'],
                $session['client'],
                $session['date'],
                $session['time'],
                $session['duration'],
                $session['type'],
                $session['description']
            ]);
            
            $created_sessions[] = [
                'id' => $pdo->lastInsertId(),
                'trainer_id' => $trainer_id,
                'title' => $session['title'],
                'client_name' => $session['client'],
                'session_date' => $session['date'],
                'session_time' => $session['time'],
                'duration' => $session['duration'],
                'session_type' => $session['type'],
                'description' => $session['description']
            ];
        }
        
        $pdo->commit();
        echo json_encode(['success' => true, 'sessions' => $created_sessions]);
    } catch(PDOException $e) {
        $pdo->rollback();
        echo json_encode(['success' => false, 'error' => 'Failed to create sessions']);
    }
}

// DELETE - Delete a session
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $input = json_decode(file_get_contents('php://input'), true);
    $session_id = $input['id'] ?? '';
    $auto_remove = $input['auto_remove'] ?? false;
    
    if (empty($session_id)) {
        echo json_encode(['success' => false, 'error' => 'Session ID is required']);
        exit;
    }
    
    try {
        $stmt = $pdo->prepare("DELETE FROM sessions WHERE id = ?");
        $stmt->execute([$session_id]);
        
        if ($stmt->rowCount() > 0) {
            $message = $auto_remove ? 'Session auto-removed after completion' : 'Session deleted successfully';
            echo json_encode(['success' => true, 'message' => $message]);
        } else {
            echo json_encode(['success' => false, 'error' => 'Session not found']);
        }
    } catch(PDOException $e) {
        echo json_encode(['success' => false, 'error' => 'Failed to delete session']);
    }
}
?>
