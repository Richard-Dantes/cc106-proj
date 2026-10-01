<?php
require_once __DIR__ . '/../config/db.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? '';

switch ($method) {
    case 'GET':
        if ($action === 'next_id') {
            handleNextId($pdo);
        } else if (isset($_GET['id'])) {
            handleGetEmployee($pdo, $_GET['id']);
        } else {
            handleListEmployees($pdo);
        }
        break;

    case 'POST':
        if ($action === 'reset_password') {
            handleResetPassword($pdo);
        } else {
            handleCreateEmployee($pdo);
        }
        break;

    case 'PUT':
        handleUpdateEmployee($pdo);
        break;

    case 'DELETE':
        handleDeleteEmployee($pdo);
        break;

    default:
        sendError('Method not allowed', 405);
}

function employeeSelectColumns() {
    return 'id, first_name, last_name, email, department, role, status, date_added';
}

function mapEmployeeRow($row) {
    return [
        'id'         => $row['id'],
        'firstName'  => $row['first_name'],
        'lastName'   => $row['last_name'],
        'email'      => $row['email'],
        'department' => $row['department'],
        'role'       => $row['role'],
        'status'     => $row['status'],
        'dateAdded'  => $row['date_added'],
    ];
}

function handleListEmployees($pdo) {
    $auth = requireAuth($pdo);
    $roleFilter = $_GET['role'] ?? 'all';
    $search     = trim($_GET['search'] ?? '');
    $department = trim($_GET['department'] ?? '');
    $status     = trim($_GET['status'] ?? '');
    $page       = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
    $limitParam = $_GET['limit'] ?? '';
    $usePagination = ($limitParam !== '' && $limitParam !== 'all' && (int)$limitParam > 0);
    $limit      = $usePagination ? min(100, max(1, (int)$limitParam)) : 0;
    $columns    = employeeSelectColumns();

    try {
        $where = ['1=1'];
        $params = [];

        if ($auth['role'] !== 'admin') {
            $where[] = 'id = :auth_id';
            $params[':auth_id'] = $auth['id'];
        } else {
            if ($roleFilter === 'staff' || $roleFilter === 'employee') {
                $where[] = "role != 'admin'";
            } else if ($roleFilter === 'admin') {
                $where[] = "role = 'admin'";
            }

            if ($department !== '' && $department !== 'all') {
                $where[] = 'department = :dept';
                $params[':dept'] = $department;
            }

            if ($status !== '' && $status !== 'all') {
                $where[] = 'status = :status';
                $params[':status'] = $status;
            }

            if ($search !== '') {
                $where[] = '(LOWER(first_name) LIKE :search OR LOWER(last_name) LIKE :search OR LOWER(id) LIKE :search OR LOWER(email) LIKE :search OR LOWER(department) LIKE :search)';
                $params[':search'] = '%' . strtolower($search) . '%';
            }
        }

        $whereClause = implode(' AND ', $where);

        // Count for pagination
        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM employees WHERE {$whereClause}");
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        // Main query
        $sql = "SELECT {$columns} FROM employees WHERE {$whereClause} ORDER BY role DESC, id ASC";

        if ($usePagination) {
            $offset = ($page - 1) * $limit;
            $sql .= " LIMIT {$limit} OFFSET {$offset}";
        }

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();
        $employees = array_map('mapEmployeeRow', $rows);

        if ($usePagination) {
            $totalPages = $limit > 0 ? (int)ceil($total / $limit) : 1;
            sendSuccess([
                'employees'  => $employees,
                'pagination' => [
                    'page'       => $page,
                    'limit'      => $limit,
                    'total'      => $total,
                    'totalPages' => max(1, $totalPages),
                ]
            ]);
        } else {
            sendSuccess($employees);
        }

    } catch (Exception $e) {
        error_log('Error retrieving employees: ' . $e->getMessage());
        sendError('Error retrieving employees.', 500);
    }
}

function handleGetEmployee($pdo, $id) {
    $auth = requireAuth($pdo);
    $columns = employeeSelectColumns();

    if ($auth['role'] !== 'admin' && $auth['id'] !== $id) {
        sendError('You do not have permission to view this employee.', 403);
    }

    try {
        $stmt = $pdo->prepare("SELECT {$columns} FROM employees WHERE id = :id LIMIT 1");
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();

        if (!$row) {
            sendError('Employee not found', 404);
        }

        sendSuccess(mapEmployeeRow($row));

    } catch (Exception $e) {
        error_log('Error retrieving employee: ' . $e->getMessage());
        sendError('Error retrieving employee.', 500);
    }
}

function handleNextId($pdo) {
    requireAuth($pdo, 'admin');

    try {
        $stmt = $pdo->query("SELECT id FROM employees WHERE id LIKE 'EMP-%'");
        $ids = $stmt->fetchAll(PDO::FETCH_COLUMN);

        $maxNum = 0;
        foreach ($ids as $id) {
            if (preg_match('/^EMP-(\d+)$/', $id, $matches)) {
                $num = (int)$matches[1];
                if ($num > $maxNum) $maxNum = $num;
            }
        }

        $nextId = 'EMP-' . str_pad($maxNum + 1, 3, '0', STR_PAD_LEFT);
        sendSuccess(['nextId' => $nextId]);

    } catch (Exception $e) {
        error_log('Error generating employee ID: ' . $e->getMessage());
        sendError('Error generating employee ID.', 500);
    }
}

function nextEmployeeId($pdo) {
    $stmt = $pdo->query("SELECT id FROM employees WHERE id LIKE 'EMP-%'");
    $ids = $stmt->fetchAll(PDO::FETCH_COLUMN);
    $maxNum = 0;
    foreach ($ids as $eid) {
        if (preg_match('/^EMP-(\d+)$/', $eid, $matches)) {
            $num = (int)$matches[1];
            if ($num > $maxNum) $maxNum = $num;
        }
    }
    return 'EMP-' . str_pad($maxNum + 1, 3, '0', STR_PAD_LEFT);
}

function handleCreateEmployee($pdo) {
    $auth = requireAuth($pdo, 'admin');
    $input = getJsonInput();

    $firstName  = trim($input['firstName'] ?? '');
    $lastName   = trim($input['lastName'] ?? '');
    $email      = trim($input['email'] ?? '');
    $department = trim($input['department'] ?? '');
    $role       = trim($input['role'] ?? 'employee');
    $status     = trim($input['status'] ?? 'active');
    $password   = $input['password'] ?? 'emp123';
    $id         = trim($input['id'] ?? '');

    if ($firstName === '' || $lastName === '' || $email === '' || $department === '') {
        sendError('First name, last name, email, and department are required', 400);
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        sendError('A valid email address is required', 400);
    }

    if (!in_array($role, ['admin', 'employee'], true)) {
        $role = 'employee';
    }
    if (!in_array($status, ['active', 'inactive'], true)) {
        $status = 'active';
    }
    if (strlen($password) < 6) {
        sendError('Password must be at least 6 characters', 400);
    }

    try {
        if ($id === '') {
            $id = nextEmployeeId($pdo);
        }

        $checkStmt = $pdo->prepare('SELECT id, email FROM employees WHERE id = :id OR LOWER(email) = LOWER(:email) LIMIT 1');
        $checkStmt->execute([':id' => $id, ':email' => $email]);
        $existing = $checkStmt->fetch();

        if ($existing) {
            if ($existing['id'] === $id) {
                sendError('That employee ID is already in use.', 400);
            }
            sendError('That email address is already registered.', 400);
        }

        $dateAdded = date('Y-m-d');
        $insertStmt = $pdo->prepare("
            INSERT INTO employees (id, first_name, last_name, email, department, role, status, password, date_added)
            VALUES (:id, :first_name, :last_name, :email, :department, :role, :status, :password, :date_added)
        ");

        $insertStmt->execute([
            ':id'          => $id,
            ':first_name'  => $firstName,
            ':last_name'   => $lastName,
            ':email'       => $email,
            ':department'  => $department,
            ':role'        => $role,
            ':status'      => $status,
            ':password'    => hashPassword($password),
            ':date_added'  => $dateAdded,
        ]);

        logAudit(
            $pdo,
            $auth['fullName'],
            $auth['id'],
            'CREATE_USER',
            "{$firstName} {$lastName} ({$id})",
            "Created new {$role} account in {$department} with status: {$status}"
        );

        sendSuccess([
            'id'         => $id,
            'firstName'  => $firstName,
            'lastName'   => $lastName,
            'email'      => $email,
            'department' => $department,
            'role'       => $role,
            'status'     => $status,
            'dateAdded'  => $dateAdded,
        ], 'Employee account created successfully!', 201);

    } catch (Exception $e) {
        error_log('Error creating employee: ' . $e->getMessage());
        sendError('Error creating employee.', 500);
    }
}

function handleUpdateEmployee($pdo) {
    $auth = requireAuth($pdo, 'admin');
    $input = getJsonInput();
    $id = trim($input['id'] ?? ($_GET['id'] ?? ''));

    if ($id === '') {
        sendError('Employee ID is required for update', 400);
    }

    try {
        $stmt = $pdo->prepare('SELECT * FROM employees WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $id]);
        $curr = $stmt->fetch();

        if (!$curr) {
            sendError('Employee not found', 404);
        }

        $firstName  = trim($input['firstName']  ?? $curr['first_name']);
        $lastName   = trim($input['lastName']   ?? $curr['last_name']);
        $email      = trim($input['email']      ?? $curr['email']);
        $department = trim($input['department'] ?? $curr['department']);
        $role       = trim($input['role']       ?? $curr['role']);
        $status     = trim($input['status']     ?? $curr['status']);
        $password   = $input['password']        ?? '';

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            sendError('A valid email address is required', 400);
        }
        if (!in_array($role, ['admin', 'employee'], true)) {
            $role = $curr['role'];
        }
        if (!in_array($status, ['active', 'inactive'], true)) {
            $status = $curr['status'];
        }

        if (strtolower($email) !== strtolower($curr['email'])) {
            $checkEmail = $pdo->prepare('SELECT id FROM employees WHERE LOWER(email) = LOWER(:email) AND id != :id LIMIT 1');
            $checkEmail->execute([':email' => $email, ':id' => $id]);
            if ($checkEmail->fetch()) {
                sendError('That email is already in use by another employee.', 400);
            }
        }

        if ($password !== '') {
            if (strlen($password) < 6) {
                sendError('Password must be at least 6 characters', 400);
            }
            $upd = $pdo->prepare("
                UPDATE employees
                SET first_name = :first_name, last_name = :last_name, email = :email,
                    department = :department, role = :role, status = :status, password = :password
                WHERE id = :id
            ");
            $upd->execute([
                ':first_name'  => $firstName,
                ':last_name'   => $lastName,
                ':email'       => $email,
                ':department'  => $department,
                ':role'        => $role,
                ':status'      => $status,
                ':password'    => hashPassword($password),
                ':id'          => $id,
            ]);
        } else {
            $upd = $pdo->prepare("
                UPDATE employees
                SET first_name = :first_name, last_name = :last_name, email = :email,
                    department = :department, role = :role, status = :status
                WHERE id = :id
            ");
            $upd->execute([
                ':first_name'  => $firstName,
                ':last_name'   => $lastName,
                ':email'       => $email,
                ':department'  => $department,
                ':role'        => $role,
                ':status'      => $status,
                ':id'          => $id,
            ]);
        }

        logAudit(
            $pdo,
            $auth['fullName'],
            $auth['id'],
            'UPDATE_USER',
            "{$firstName} {$lastName} ({$id})",
            "Updated employee details: {$department}, role: {$role}, status: {$status}"
        );

        sendSuccess([
            'id'         => $id,
            'firstName'  => $firstName,
            'lastName'   => $lastName,
            'email'      => $email,
            'department' => $department,
            'role'       => $role,
            'status'     => $status,
            'dateAdded'  => $curr['date_added'],
        ], 'Employee updated successfully!');

    } catch (Exception $e) {
        error_log('Error updating employee: ' . $e->getMessage());
        sendError('Error updating employee.', 500);
    }
}

function handleDeleteEmployee($pdo) {
    $auth = requireAuth($pdo, 'admin');
    $input = getJsonInput();
    $id = trim($input['id'] ?? ($_GET['id'] ?? ''));

    if ($id === '') {
        sendError('Employee ID is required', 400);
    }

    if ($id === $auth['id']) {
        sendError('You cannot delete your own account.', 403);
    }

    try {
        $stmt = $pdo->prepare('SELECT * FROM employees WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $id]);
        $emp = $stmt->fetch();

        if (!$emp) {
            sendError('Employee not found', 404);
        }

        if ($emp['role'] === 'admin') {
            sendError('Cannot delete an administrator account.', 403);
        }

        $delStmt = $pdo->prepare('DELETE FROM employees WHERE id = :id');
        $delStmt->execute([':id' => $id]);

        logAudit(
            $pdo,
            $auth['fullName'],
            $auth['id'],
            'DELETE_USER',
            "{$emp['first_name']} {$emp['last_name']} ({$id})",
            "Deleted employee account from {$emp['department']}"
        );

        sendSuccess(null, 'Employee deleted successfully!');

    } catch (Exception $e) {
        error_log('Error deleting employee: ' . $e->getMessage());
        sendError('Error deleting employee.', 500);
    }
}

function handleResetPassword($pdo) {
    $auth = requireAuth($pdo, 'admin');
    $input = getJsonInput();
    $id = trim($input['id'] ?? ($_POST['id'] ?? ''));

    if ($id === '') {
        sendError('Employee ID is required', 400);
    }

    try {
        $stmt = $pdo->prepare('SELECT id, first_name, last_name, email, role FROM employees WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $id]);
        $emp = $stmt->fetch();

        if (!$emp) {
            sendError('Employee not found', 404);
        }

        // Generate a random temporary password (8 chars alphanumeric + symbols)
        $chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
        $tempPassword = 'Temp#';
        for ($i = 0; $i < 5; $i++) {
            $tempPassword .= $chars[random_int(0, strlen($chars) - 1)];
        }

        $hash = hashPassword($tempPassword);
        $upd = $pdo->prepare('UPDATE employees SET password = :hash WHERE id = :id');
        $upd->execute([':hash' => $hash, ':id' => $id]);

        $fullName = $emp['first_name'] . ' ' . $emp['last_name'];
        logAudit(
            $pdo,
            $auth['fullName'],
            $auth['id'],
            'RESET_PASSWORD',
            "{$fullName} ({$id})",
            "Admin reset password for {$fullName}. Temporary password issued."
        );

        sendSuccess([
            'temporaryPassword' => $tempPassword,
            'employeeId'        => $id,
            'employeeName'      => $fullName,
            'email'             => $emp['email'],
        ], "Password has been successfully reset for {$fullName}!");

    } catch (Exception $e) {
        error_log('Error resetting password: ' . $e->getMessage());
        sendError('Error resetting password.', 500);
    }
}
?>
