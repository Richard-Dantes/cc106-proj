<?php
// Database connection and shared API helpers

if (!headers_sent()) {
    applyCorsHeaders();
}

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$dbHost = '127.0.0.1';
$dbPort = '3306';
$dbName = 'securehr_db';
$dbUser = 'root';
$dbPass = '';

try {
    $dsn = "mysql:host={$dbHost};port={$dbPort};dbname={$dbName};charset=utf8mb4";
    $pdo = new PDO($dsn, $dbUser, $dbPass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
} catch (PDOException $e) {
    error_log('Database connection error: ' . $e->getMessage());
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'Database connection error.',
    ]);
    exit;
}

function applyCorsHeaders() {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') {
        return;
    }
    if (preg_match('#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#i', $origin)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
    }
}

function sendSuccess($data = null, $message = 'Success', $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json');
    $response = ['success' => true, 'message' => $message];
    if ($data !== null) {
        $response['data'] = $data;
    }
    echo json_encode($response);
    exit;
}

function sendError($message = 'An error occurred', $code = 400, $data = null) {
    http_response_code($code);
    header('Content-Type: application/json');
    $response = ['success' => false, 'message' => $message];
    if ($data !== null) {
        $response['data'] = $data;
    }
    echo json_encode($response);
    exit;
}

function getJsonInput() {
    $raw = file_get_contents('php://input');
    if ($raw) {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            return $decoded;
        }
    }
    return !empty($_POST) ? $_POST : [];
}

function getRequestHeaders() {
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        if (is_array($headers)) {
            return $headers;
        }
    }
    $headers = [];
    foreach ($_SERVER as $key => $value) {
        if (strpos($key, 'HTTP_') === 0) {
            $name = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($key, 5)))));
            $headers[$name] = $value;
        }
    }
    return $headers;
}

function getBearerToken() {
    $headers = getRequestHeaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    if (preg_match('/Bearer\s+(\S+)/', $authHeader, $matches)) {
        return $matches[1];
    }
    if (!empty($_GET['token'])) {
        return trim($_GET['token']);
    }
    return '';
}

function hashPassword($plain) {
    return password_hash($plain, PASSWORD_DEFAULT);
}

function verifyEmployeePassword($pdo, $user, $password) {
    $stored = $user['password'] ?? '';
    if ($stored === '') {
        return false;
    }

    $info = password_get_info($stored);
    if (!empty($info['algo'])) {
        return password_verify($password, $stored);
    }

    if (!hash_equals($stored, $password)) {
        return false;
    }

    try {
        $stmt = $pdo->prepare('UPDATE employees SET password = :password WHERE id = :id');
        $stmt->execute([
            ':password' => hashPassword($password),
            ':id'       => $user['id'],
        ]);
    } catch (Exception $e) {
        error_log('Password rehash failed: ' . $e->getMessage());
    }

    return true;
}

function requireAuth($pdo, $allowedRoles = null) {
    $token = getBearerToken();
    if ($token === '') {
        sendError('Authentication required', 401);
    }

    try {
        $stmt = $pdo->prepare("
            SELECT
                s.id AS session_id,
                s.employee_id,
                s.role,
                s.expires_at,
                e.first_name,
                e.last_name,
                e.email,
                e.department,
                e.status,
                e.date_added
            FROM sessions s
            JOIN employees e ON s.employee_id = e.id
            WHERE s.id = :token AND s.is_active = 1 AND s.expires_at > NOW()
            LIMIT 1
        ");
        $stmt->execute([':token' => $token]);
        $row = $stmt->fetch();
    } catch (Exception $e) {
        error_log('Session lookup failed: ' . $e->getMessage());
        sendError('Authentication failed', 500);
    }

    if (!$row) {
        sendError('Session expired or invalid', 401);
    }

    if ($row['status'] !== 'active') {
        sendError('Your account is inactive. Please contact the HR administrator.', 403);
    }

    if ($allowedRoles !== null) {
        $roles = is_array($allowedRoles) ? $allowedRoles : [$allowedRoles];
        if (!in_array($row['role'], $roles, true)) {
            sendError('You do not have permission to perform this action.', 403);
        }
    }

    try {
        $upd = $pdo->prepare('UPDATE sessions SET last_activity = NOW() WHERE id = :token');
        $upd->execute([':token' => $token]);
    } catch (Exception $e) {
        error_log('Session activity update failed: ' . $e->getMessage());
    }

    return [
        'id'         => $row['employee_id'],
        'firstName'  => $row['first_name'],
        'lastName'   => $row['last_name'],
        'email'      => $row['email'],
        'department' => $row['department'],
        'role'       => $row['role'],
        'status'     => $row['status'],
        'dateAdded'  => $row['date_added'],
        'fullName'   => trim($row['first_name'] . ' ' . $row['last_name']),
        'token'      => $token,
    ];
}

function logAudit($pdo, $actor, $actorId, $action, $target = '-', $details = '') {
    try {
        $stmt = $pdo->prepare("
            INSERT INTO audit_log (actor, actor_id, action, target, details, timestamp)
            VALUES (:actor, :actor_id, :action, :target, :details, NOW())
        ");
        $stmt->execute([
            ':actor'    => $actor,
            ':actor_id' => $actorId,
            ':action'   => $action,
            ':target'   => $target,
            ':details'  => $details,
        ]);
    } catch (Exception $e) {
        error_log('Audit log failure: ' . $e->getMessage());
    }
}

function safeDownloadFilename($name) {
    $name = str_replace(['\\', '/'], '_', (string) $name);
    $name = basename($name);
    $name = preg_replace('/[^\w.\- ()]/u', '_', $name);
    $name = trim($name);
    return $name !== '' ? $name : 'download';
}

function detectMimeFromBytes($bytes) {
    if ($bytes === '' || $bytes === null) {
        return 'application/octet-stream';
    }
    if (strncmp($bytes, '%PDF', 4) === 0) {
        return 'application/pdf';
    }
    if (strncmp($bytes, "\x89PNG", 4) === 0) {
        return 'image/png';
    }
    if (strncmp($bytes, "\xFF\xD8\xFF", 3) === 0) {
        return 'image/jpeg';
    }
    if (strncmp($bytes, 'GIF8', 4) === 0) {
        return 'image/gif';
    }
    if (strncmp($bytes, "RIFF", 4) === 0 && substr($bytes, 8, 4) === 'WEBP') {
        return 'image/webp';
    }
    if (strncmp($bytes, 'PK', 2) === 0) {
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
    return 'application/octet-stream';
}

function decodeStoredFile($fileData) {
    if ($fileData === null || $fileData === '') {
        return [null, 'application/octet-stream'];
    }
    if (is_resource($fileData)) {
        $fileData = stream_get_contents($fileData);
    }

    $raw = (string) $fileData;
    $trimmed = ltrim($raw);

    if (strncmp($trimmed, 'data:', 5) === 0) {
        $parts = explode(',', $trimmed, 2);
        $fileType = 'application/octet-stream';
        if (preg_match('/data:([^;]+);/', $parts[0], $matches)) {
            $fileType = $matches[1];
        }
        $binary = base64_decode($parts[1] ?? '', true);
        if ($binary === false) {
            return [null, $fileType];
        }
        if (strncmp(ltrim($binary), 'data:', 5) === 0) {
            return decodeStoredFile($binary);
        }
        $detected = detectMimeFromBytes($binary);
        if ($detected !== 'application/octet-stream') {
            $fileType = $detected;
        }
        return [$binary, $fileType];
    }

    $detected = detectMimeFromBytes($raw);
    if ($detected !== 'application/octet-stream') {
        return [$raw, $detected];
    }

    $maybeBinary = base64_decode($trimmed, true);
    if ($maybeBinary !== false && $maybeBinary !== '') {
        $fromB64 = detectMimeFromBytes($maybeBinary);
        if ($fromB64 !== 'application/octet-stream' || strncmp(ltrim($maybeBinary), 'data:', 5) === 0) {
            return decodeStoredFile($maybeBinary);
        }
    }

    return [$raw, 'application/octet-stream'];
}

function getUploadsDir() {
    $dir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'documents';
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    return $dir;
}
?>
