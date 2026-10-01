<?php
require_once __DIR__ . '/../config/db.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? '';

switch ($method) {
    case 'GET':
        if (($action === 'download' || $action === 'preview') && isset($_GET['id'])) {
            handleServeDocument($pdo, $_GET['id'], $action === 'download');
        } else {
            handleListDocuments($pdo);
        }
        break;

    case 'POST':
        handleUploadDocument($pdo);
        break;

    case 'DELETE':
        handleDeleteDocument($pdo);
        break;

    default:
        sendError('Method not allowed', 405);
}

function allowedCategories() {
    return ['Contract', 'Payslip', 'Certificate', 'ID', 'Other'];
}

function mapDocumentRow($row) {
    return [
        'id'           => $row['id'],
        'employeeId'   => $row['employee_id'],
        'fileName'     => $row['file_name'],
        'fileType'     => $row['file_type'] ?? 'application/octet-stream',
        'category'     => $row['category'],
        'uploadedBy'   => $row['uploaded_by'],
        'uploadedAt'   => $row['uploaded_at'],
        'size'         => $row['file_size'] ?? '—',
        'note'         => $row['note'] ?? '',
        'hasFilePath'  => !empty($row['file_path']),
        'employeeName' => trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? '')),
    ];
}

function canAccessDocument($auth, $employeeId) {
    return $auth['role'] === 'admin' || $auth['id'] === $employeeId;
}

function handleListDocuments($pdo) {
    $auth = requireAuth($pdo);
    $employeeId = $_GET['employee_id'] ?? '';
    $category   = $_GET['category'] ?? '';
    $search     = trim($_GET['search'] ?? '');
    $page       = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
    $limitParam = $_GET['limit'] ?? '';
    $usePagination = ($limitParam !== '' && $limitParam !== 'all' && (int)$limitParam > 0);
    $limit      = $usePagination ? min(100, max(1, (int)$limitParam)) : 0;

    try {
        $where = ['1=1'];
        $params = [];

        if ($auth['role'] !== 'admin') {
            $where[] = 'd.employee_id = :auth_emp';
            $params[':auth_emp'] = $auth['id'];
        } else if ($employeeId !== '' && $employeeId !== 'all') {
            $where[] = 'd.employee_id = :emp_id';
            $params[':emp_id'] = $employeeId;
        }

        if ($category !== '' && $category !== 'all') {
            if (!in_array($category, allowedCategories(), true)) {
                sendError('Invalid document category', 400);
            }
            $where[] = 'd.category = :cat';
            $params[':cat'] = $category;
        }

        if ($search !== '') {
            $where[] = '(LOWER(d.file_name) LIKE :search OR LOWER(d.employee_id) LIKE :search OR LOWER(CONCAT(e.first_name, " ", e.last_name)) LIKE :search OR LOWER(d.note) LIKE :search)';
            $params[':search'] = '%' . strtolower($search) . '%';
        }

        $whereClause = implode(' AND ', $where);

        // Count query for pagination
        $countSql = "
            SELECT COUNT(*) AS total
            FROM documents d
            LEFT JOIN employees e ON d.employee_id = e.id
            WHERE {$whereClause}
        ";
        $countStmt = $pdo->prepare($countSql);
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        // Main query
        $sql = "
            SELECT d.id, d.employee_id, d.file_name, d.file_type, d.category,
                   d.uploaded_by, d.uploaded_at, d.file_size, d.file_path, d.note,
                   e.first_name, e.last_name
            FROM documents d
            LEFT JOIN employees e ON d.employee_id = e.id
            WHERE {$whereClause}
            ORDER BY d.created_at DESC
        ";

        if ($usePagination) {
            $offset = ($page - 1) * $limit;
            $sql .= " LIMIT {$limit} OFFSET {$offset}";
        }

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();
        $docs = array_map('mapDocumentRow', $rows);

        if ($usePagination) {
            $totalPages = $limit > 0 ? (int)ceil($total / $limit) : 1;
            sendSuccess([
                'documents'  => $docs,
                'pagination' => [
                    'page'       => $page,
                    'limit'      => $limit,
                    'total'      => $total,
                    'totalPages' => max(1, $totalPages),
                ]
            ]);
        } else {
            sendSuccess($docs);
        }

    } catch (Exception $e) {
        error_log('Error retrieving documents: ' . $e->getMessage());
        sendError('Error retrieving documents.', 500);
    }
}

function handleUploadDocument($pdo) {
    $auth = requireAuth($pdo);
    $input = getJsonInput();

    $id         = trim($input['id'] ?? ($_POST['id'] ?? ('DOC-' . round(microtime(true) * 1000))));
    $employeeId = trim($input['employeeId'] ?? ($_POST['employeeId'] ?? ''));
    $fileName   = trim($input['fileName'] ?? ($_POST['fileName'] ?? ''));
    $fileType   = trim($input['fileType'] ?? ($_POST['fileType'] ?? ''));
    $category   = trim($input['category'] ?? ($_POST['category'] ?? 'Other'));
    $fileSize   = trim($input['size'] ?? ($_POST['size'] ?? '0 KB'));
    $note       = trim($input['note'] ?? ($_POST['note'] ?? ''));
    $fileData   = $input['fileData'] ?? null;

    if ($auth['role'] !== 'admin') {
        $employeeId = $auth['id'];
    }

    $binary = null;
    $maxBytes = 15 * 1024 * 1024; // 15MB limit

    if (isset($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
        $fileInfo = $_FILES['file'];
        if ($fileInfo['size'] > $maxBytes) {
            sendError('File is too large. Maximum size is 15MB.', 400);
        }
        $fileName = $fileInfo['name'];
        $fileType = $fileInfo['type'];
        $binary = file_get_contents($fileInfo['tmp_name']);
        $bytes = $fileInfo['size'];
        if ($bytes < 1024) {
            $fileSize = $bytes . ' B';
        } else if ($bytes < 1024 * 1024) {
            $fileSize = round($bytes / 1024, 1) . ' KB';
        } else {
            $fileSize = round($bytes / (1024 * 1024), 1) . ' MB';
        }
    } else if (is_string($fileData) && strpos($fileData, 'data:') === 0) {
        [$decoded, $decodedType] = decodeStoredFile($fileData);
        if ($decoded === null) {
            sendError('Invalid file data', 400);
        }
        if (strlen($decoded) > $maxBytes) {
            sendError('File is too large. Maximum size is 15MB.', 400);
        }
        $binary = $decoded;
        if ($fileType === '') {
            $fileType = $decodedType;
        }
    }

    if ($employeeId === '') {
        sendError('Employee ID is required for document upload', 400);
    }
    if ($fileName === '') {
        sendError('File name is required', 400);
    }
    if ($binary === null || $binary === '') {
        sendError('File content is required', 400);
    }
    if (!in_array($category, allowedCategories(), true)) {
        $category = 'Other';
    }

    $fileName = safeDownloadFilename($fileName);

    try {
        $empCheck = $pdo->prepare('SELECT id, first_name, last_name FROM employees WHERE id = :id LIMIT 1');
        $empCheck->execute([':id' => $employeeId]);
        $emp = $empCheck->fetch();

        if (!$emp) {
            sendError('Employee not found.', 404);
        }

        // Save file to protected disk storage
        $uploadsDir = getUploadsDir();
        $safeDiskName = $id . '_' . preg_replace('/[^\w.\-]/', '_', $fileName);
        $diskPath = $uploadsDir . DIRECTORY_SEPARATOR . $safeDiskName;
        $relativePath = 'uploads/documents/' . $safeDiskName;

        file_put_contents($diskPath, $binary);

        $dateAdded = date('Y-m-d');
        $stmt = $pdo->prepare("
            INSERT INTO documents (id, employee_id, file_name, file_type, category, uploaded_by, uploaded_at, file_size, file_path, note, file_data)
            VALUES (:id, :employee_id, :file_name, :file_type, :category, :uploaded_by, :uploaded_at, :file_size, :file_path, :note, :file_data)
        ");

        $stmt->bindValue(':id', $id);
        $stmt->bindValue(':employee_id', $employeeId);
        $stmt->bindValue(':file_name', $fileName);
        $stmt->bindValue(':file_type', $fileType);
        $stmt->bindValue(':category', $category);
        $stmt->bindValue(':uploaded_by', $auth['id']);
        $stmt->bindValue(':uploaded_at', $dateAdded);
        $stmt->bindValue(':file_size', $fileSize);
        $stmt->bindValue(':file_path', $relativePath);
        $stmt->bindValue(':note', $note);
        $stmt->bindValue(':file_data', $binary, PDO::PARAM_STR); // Fallback storage
        $stmt->execute();

        $empName = $emp['first_name'] . ' ' . $emp['last_name'];
        logAudit(
            $pdo,
            $auth['fullName'],
            $auth['id'],
            'UPLOAD_DOCUMENT',
            $fileName,
            "Uploaded {$category} document for {$empName} ({$employeeId}) [{$fileSize}]"
        );

        sendSuccess([
            'id'           => $id,
            'employeeId'   => $employeeId,
            'fileName'     => $fileName,
            'fileType'     => $fileType,
            'category'     => $category,
            'uploadedBy'   => $auth['id'],
            'uploadedAt'   => $dateAdded,
            'size'         => $fileSize,
            'filePath'     => $relativePath,
            'note'         => $note,
            'employeeName' => $empName,
        ], 'Document uploaded successfully!', 201);

    } catch (Exception $e) {
        error_log('Error uploading document: ' . $e->getMessage());
        sendError('Error uploading document.', 500);
    }
}

function handleDeleteDocument($pdo) {
    $auth = requireAuth($pdo);
    $input = getJsonInput();
    $id = trim($input['id'] ?? ($_GET['id'] ?? ''));

    if ($id === '') {
        sendError('Document ID is required', 400);
    }

    try {
        $stmt = $pdo->prepare('SELECT * FROM documents WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $id]);
        $doc = $stmt->fetch();

        if (!$doc) {
            sendError('Document not found', 404);
        }

        if (!canAccessDocument($auth, $doc['employee_id'])) {
            sendError('You do not have permission to delete this document.', 403);
        }

        // Remove disk file if exists
        if (!empty($doc['file_path'])) {
            $rootPath = dirname(__DIR__) . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $doc['file_path']);
            if (file_exists($rootPath)) {
                @unlink($rootPath);
            }
        }

        $delStmt = $pdo->prepare('DELETE FROM documents WHERE id = :id');
        $delStmt->execute([':id' => $id]);

        logAudit(
            $pdo,
            $auth['fullName'],
            $auth['id'],
            'DELETE_DOCUMENT',
            $doc['file_name'],
            "Deleted {$doc['category']} document for employee {$doc['employee_id']}"
        );

        sendSuccess(null, 'Document deleted successfully!');

    } catch (Exception $e) {
        error_log('Error deleting document: ' . $e->getMessage());
        sendError('Error deleting document.', 500);
    }
}

function handleServeDocument($pdo, $id, $forceDownload = false) {
    $auth = requireAuth($pdo);

    try {
        $stmt = $pdo->prepare('SELECT * FROM documents WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $id]);
        $doc = $stmt->fetch();

        if (!$doc) {
            sendError('Document not found', 404);
        }

        if (!canAccessDocument($auth, $doc['employee_id'])) {
            sendError('You do not have permission to access this document.', 403);
        }

        $fileName = safeDownloadFilename($doc['file_name']);
        $storedType = $doc['file_type'] ?: 'application/octet-stream';
        $binary = null;

        // Try reading from disk first
        if (!empty($doc['file_path'])) {
            $diskPath = dirname(__DIR__) . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $doc['file_path']);
            if (file_exists($diskPath) && is_readable($diskPath)) {
                $binary = file_get_contents($diskPath);
            }
        }

        // Fallback to database BLOB
        if (($binary === null || $binary === '') && !empty($doc['file_data'])) {
            [$decoded, $detectedType] = decodeStoredFile($doc['file_data']);
            $binary = $decoded;
            if ($detectedType !== 'application/octet-stream') {
                $storedType = $detectedType;
            }
        }

        if ($binary === null || $binary === '') {
            sendError('No file data available for this document', 404);
        }

        $dispositionName = str_replace(['"', "\r", "\n"], '', $fileName);
        $disposition = $forceDownload ? 'attachment' : 'inline';

        header('Content-Type: ' . $storedType);
        header('Content-Disposition: ' . $disposition . '; filename="' . $dispositionName . '"');
        header('Content-Length: ' . strlen($binary));
        header('X-File-Name: ' . rawurlencode($fileName));
        header('X-File-Type: ' . $storedType);
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: private, max-age=3600');
        echo $binary;
        exit;

    } catch (Exception $e) {
        error_log('Error serving document: ' . $e->getMessage());
        sendError('Error serving document.', 500);
    }
}
?>
