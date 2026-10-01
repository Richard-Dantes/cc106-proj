<?php
require_once __DIR__ . '/../config/db.php';

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'login':
        handleLogin($pdo);
        break;

    case 'logout':
        handleLogout($pdo);
        break;

    case 'change_password':
        handleChangePassword($pdo);
        break;

    case 'forgot_password':
        handleForgotPassword($pdo);
        break;

    case 'check':
        handleCheckSession($pdo);
        break;

    default:
        sendError('Invalid action specified', 400);
}

function handleLogin($pdo) {
    $input = getJsonInput();
    $username = trim($input['username'] ?? '');
    $password = $input['password'] ?? '';
    $role     = trim($input['role'] ?? '');

    if ($username === '' || $password === '') {
        sendError('Username and password are required', 400);
    }

    try {
        $stmt = $pdo->prepare("
            SELECT * FROM employees
            WHERE LOWER(email) = LOWER(:u1)
               OR LOWER(id) = LOWER(:u2)
               OR LOWER(first_name) = LOWER(:u3)
               OR (role = 'admin' AND LOWER(:u4) = 'admin')
            LIMIT 1
        ");
        $stmt->execute([
            ':u1' => $username,
            ':u2' => $username,
            ':u3' => $username,
            ':u4' => $username,
        ]);
        $user = $stmt->fetch();

        if (!$user || !verifyEmployeePassword($pdo, $user, $password)) {
            sendError('Invalid username or password. Please try again.', 401);
        }

        if (!empty($role) && $user['role'] !== $role) {
            sendError('This account does not have permission to access that portal.', 403);
        }

        if ($user['status'] !== 'active') {
            sendError('Your account is inactive. Please contact the HR administrator.', 403);
        }

        $sessionToken = bin2hex(random_bytes(32));
        $expiresAt = date('Y-m-d H:i:s', strtotime('+8 hours'));

        $sessStmt = $pdo->prepare("
            INSERT INTO sessions (id, employee_id, role, login_time, last_activity, expires_at, is_active)
            VALUES (:id, :emp_id, :role, NOW(), NOW(), :expires, 1)
        ");
        $sessStmt->execute([
            ':id'      => $sessionToken,
            ':emp_id'  => $user['id'],
            ':role'    => $user['role'],
            ':expires' => $expiresAt,
        ]);

        $actorName = $user['first_name'] . ' ' . $user['last_name'];
        $roleTitle = $user['role'] === 'admin' ? 'HR Admin' : 'HR Employee';
        logAudit($pdo, $actorName, $user['id'], 'LOGIN', '-', "Signed in as {$roleTitle}");

        $userData = [
            'id'         => $user['id'],
            'firstName'  => $user['first_name'],
            'lastName'   => $user['last_name'],
            'email'      => $user['email'],
            'department' => $user['department'],
            'role'       => $user['role'],
            'status'     => $user['status'],
            'dateAdded'  => $user['date_added'],
        ];

        sendSuccess([
            'user'  => $userData,
            'token' => $sessionToken,
        ], 'Login successful!');

    } catch (Exception $e) {
        error_log('Authentication server error: ' . $e->getMessage());
        sendError('Authentication failed.', 500);
    }
}

function handleLogout($pdo) {
    $input = getJsonInput();
    $token = getBearerToken();
    if ($token === '') {
        $token = $input['token'] ?? '';
    }

    $actorId = null;
    $actorName = 'User';

    if ($token !== '') {
        try {
            $stmt = $pdo->prepare("
                SELECT s.employee_id, e.first_name, e.last_name
                FROM sessions s
                JOIN employees e ON s.employee_id = e.id
                WHERE s.id = :token
                LIMIT 1
            ");
            $stmt->execute([':token' => $token]);
            $row = $stmt->fetch();
            if ($row) {
                $actorId = $row['employee_id'];
                $actorName = $row['first_name'] . ' ' . $row['last_name'];
            }

            $upd = $pdo->prepare('UPDATE sessions SET is_active = 0 WHERE id = :token');
            $upd->execute([':token' => $token]);
        } catch (Exception $e) {
            error_log('Logout error: ' . $e->getMessage());
        }
    }

    if ($actorId) {
        logAudit($pdo, $actorName, $actorId, 'LOGOUT', '-', 'User logged out');
    }

    sendSuccess(null, 'Logged out successfully');
}

function handleChangePassword($pdo) {
    $auth = requireAuth($pdo);
    $input = getJsonInput();
    $currentPassword = $input['currentPassword'] ?? '';
    $newPassword = $input['newPassword'] ?? '';

    if ($currentPassword === '' || $newPassword === '') {
        sendError('All password fields are required', 400);
    }

    if (strlen($newPassword) < 6) {
        sendError('New password must be at least 6 characters', 400);
    }

    if ($currentPassword === $newPassword) {
        sendError('New password must be different from your current password', 400);
    }

    try {
        $stmt = $pdo->prepare('SELECT * FROM employees WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $auth['id']]);
        $user = $stmt->fetch();

        if (!$user) {
            sendError('Employee record not found', 404);
        }

        if (!verifyEmployeePassword($pdo, $user, $currentPassword)) {
            sendError('Current password is incorrect', 401);
        }

        $updateStmt = $pdo->prepare('UPDATE employees SET password = :new_pass WHERE id = :id');
        $updateStmt->execute([
            ':new_pass' => hashPassword($newPassword),
            ':id'       => $auth['id'],
        ]);

        logAudit($pdo, $auth['fullName'], $auth['id'], 'CHANGE_PASSWORD', $auth['id'], 'Changed account password');

        sendSuccess(null, 'Password updated successfully');

    } catch (Exception $e) {
        error_log('Error updating password: ' . $e->getMessage());
        sendError('Error updating password.', 500);
    }
}

function handleCheckSession($pdo) {
    $auth = requireAuth($pdo);
    sendSuccess(['user' => [
        'id'         => $auth['id'],
        'firstName'  => $auth['firstName'],
        'lastName'   => $auth['lastName'],
        'email'      => $auth['email'],
        'department' => $auth['department'],
        'role'       => $auth['role'],
        'status'     => $auth['status'],
        'dateAdded'  => $auth['dateAdded'],
    ]]);
}

function handleForgotPassword($pdo) {
    $input = getJsonInput();
    $target = trim($input['emailOrId'] ?? ($input['email'] ?? ($input['username'] ?? '')));

    if ($target === '') {
        sendError('Please enter your registered email address or Employee ID', 400);
    }

    try {
        $stmt = $pdo->prepare("
            SELECT * FROM employees
            WHERE LOWER(email) = LOWER(:t1)
               OR LOWER(id) = LOWER(:t2)
            LIMIT 1
        ");
        $stmt->execute([':t1' => $target, ':t2' => $target]);
        $emp = $stmt->fetch();

        if (!$emp) {
            sendError('No account found with the provided email or Employee ID.', 404);
        }

        if ($emp['status'] !== 'active') {
            sendError('This account is inactive. Please contact the HR department.', 403);
        }

        // Generate temporary password (e.g., Reset#9482)
        $tempPassword = 'Reset#' . random_int(1000, 9999);
        $resetToken = bin2hex(random_bytes(16));
        $expiresAt = date('Y-m-d H:i:s', strtotime('+2 hours'));

        // Store reset record
        $insStmt = $pdo->prepare("
            INSERT INTO password_resets (email, token, temp_password, expires_at, used)
            VALUES (:email, :token, :temp_pass, :expires, 0)
        ");
        $insStmt->execute([
            ':email'     => $emp['email'],
            ':token'     => $resetToken,
            ':temp_pass' => $tempPassword,
            ':expires'   => $expiresAt,
        ]);

        // Update employee password to the temporary password
        $updStmt = $pdo->prepare("UPDATE employees SET password = :hash WHERE id = :id");
        $updStmt->execute([
            ':hash' => hashPassword($tempPassword),
            ':id'   => $emp['id'],
        ]);

        $fullName = $emp['first_name'] . ' ' . $emp['last_name'];
        logAudit(
            $pdo,
            $fullName,
            $emp['id'],
            'FORGOT_PASSWORD',
            $emp['email'],
            "Self-service password reset requested for {$fullName} ({$emp['id']})"
        );

        sendSuccess([
            'employeeId'        => $emp['id'],
            'email'             => $emp['email'],
            'temporaryPassword' => $tempPassword,
        ], 'A temporary password has been successfully generated!');

    } catch (Exception $e) {
        error_log('Forgot password error: ' . $e->getMessage());
        sendError('Error processing password reset request.', 500);
    }
}
?>
