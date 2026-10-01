<?php
require_once __DIR__ . '/../config/db.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

switch ($method) {
    case 'GET':
        handleListAuditLogs($pdo);
        break;

    default:
        sendError('Method not allowed', 405);
}

function handleListAuditLogs($pdo) {
    requireAuth($pdo, 'admin');

    $limit  = isset($_GET['limit']) ? (int)$_GET['limit'] : 200;
    $action = $_GET['action'] ?? '';

    if ($limit <= 0 || $limit > 1000) {
        $limit = 200;
    }

    try {
        if ($action !== '' && $action !== 'all') {
            $stmt = $pdo->prepare("
                SELECT id, timestamp, actor, actor_id AS actorId, action, target, details
                FROM audit_log
                WHERE action = :action
                ORDER BY timestamp DESC
                LIMIT :limit
            ");
            $stmt->bindValue(':action', $action, PDO::PARAM_STR);
            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
            $stmt->execute();
        } else {
            $stmt = $pdo->prepare("
                SELECT id, timestamp, actor, actor_id AS actorId, action, target, details
                FROM audit_log
                ORDER BY timestamp DESC
                LIMIT :limit
            ");
            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
            $stmt->execute();
        }

        sendSuccess($stmt->fetchAll());

    } catch (Exception $e) {
        error_log('Error retrieving audit logs: ' . $e->getMessage());
        sendError('Error retrieving audit logs.', 500);
    }
}
?>
