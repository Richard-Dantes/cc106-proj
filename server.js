import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads', 'documents');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Minimal valid PDF buffer for seeded documents so preview & download work seamlessly
function createSamplePdfBuffer(title, subtitle) {
  const content = `BT /F1 16 Tf 50 750 Td (${title.replace(/[()\\]/g, '')}) Tj 0 -28 Td /F1 11 Tf (${subtitle.replace(/[()\\]/g, '')}) Tj ET`;
  const pdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length ${content.length} >> stream
${content}
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000241 00000 n 
0000000340 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
408
%%EOF`;
  return Buffer.from(pdf, 'utf-8');
}

// 1x1 PNG buffer for seeded PNG document
const SAMPLE_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// ============================================================================
// In-Memory Data Store (Migrated from MySQL securehr_database.sql)
// ============================================================================

const employees = new Map([
  [
    'ADM-001',
    {
      id: 'ADM-001',
      first_name: 'Admin',
      last_name: 'Account',
      email: 'admin@bestlink.edu.ph',
      department: 'Administration',
      position: 'HR Director',
      role: 'admin',
      status: 'active',
      password: bcrypt.hashSync('admin123', 10),
      date_added: '2026-01-01',
    },
  ],
  [
    'EMP-001',
    {
      id: 'EMP-001',
      first_name: 'Juan',
      last_name: 'Dela Cruz',
      email: 'juan.delacruz@bestlink.edu.ph',
      department: 'Human Resources',
      position: 'HR Specialist',
      role: 'employee',
      status: 'active',
      password: bcrypt.hashSync('employee123', 10),
      date_added: '2026-08-01',
    },
  ],
  [
    'EMP-002',
    {
      id: 'EMP-002',
      first_name: 'Maria',
      last_name: 'Santos',
      email: 'maria.santos@bestlink.edu.ph',
      department: 'Finance',
      position: 'Senior Accountant',
      role: 'employee',
      status: 'active',
      password: bcrypt.hashSync('employee123', 10),
      date_added: '2026-08-05',
    },
  ],
  [
    'EMP-003',
    {
      id: 'EMP-003',
      first_name: 'Roberto',
      last_name: 'Reyes',
      email: 'roberto.reyes@bestlink.edu.ph',
      department: 'IT Department',
      position: 'Systems Engineer',
      role: 'employee',
      status: 'inactive',
      password: bcrypt.hashSync('employee123', 10),
      date_added: '2026-07-20',
    },
  ],
]);

const documents = new Map([
  [
    'DOC-1',
    {
      id: 'DOC-1',
      employee_id: 'EMP-001',
      title: 'Employment Contract 2026',
      file_name: 'Employment_Contract_JuanDelaCruz.pdf',
      file_type: 'application/pdf',
      category: 'Contract',
      uploaded_by: 'ADM-001',
      uploaded_at: '2026-08-01',
      file_size: '245 KB',
      note: 'Signed permanent employment contract',
      file_path: null,
      file_data: createSamplePdfBuffer('Employment Contract 2026', 'Employee: Juan Dela Cruz (EMP-001) - Signed permanent employment contract'),
      status: 'Verified',
      created_at: new Date('2026-08-01T09:15:00Z').getTime(),
    },
  ],
  [
    'DOC-2',
    {
      id: 'DOC-2',
      employee_id: 'EMP-001',
      title: 'PRC Professional License',
      file_name: 'PRC_License_JuanDelaCruz.pdf',
      file_type: 'application/pdf',
      category: 'Certificate',
      uploaded_by: 'EMP-001',
      uploaded_at: '2026-08-02',
      file_size: '180 KB',
      note: 'Valid until December 2028',
      file_path: null,
      file_data: createSamplePdfBuffer('PRC Professional License', 'Employee: Juan Dela Cruz (EMP-001) - Valid until December 2028'),
      status: 'Verified',
      created_at: new Date('2026-08-02T11:30:00Z').getTime(),
    },
  ],
  [
    'DOC-3',
    {
      id: 'DOC-3',
      employee_id: 'EMP-002',
      title: 'Official Transcript of Records',
      file_name: 'TOR_MariaSantos.pdf',
      file_type: 'application/pdf',
      category: 'Certificate',
      uploaded_by: 'EMP-002',
      uploaded_at: '2026-08-06',
      file_size: '520 KB',
      note: 'Undergraduate academic records',
      file_path: null,
      file_data: createSamplePdfBuffer('Official Transcript of Records', 'Employee: Maria Santos (EMP-002) - Undergraduate academic records'),
      status: 'Verified',
      created_at: new Date('2026-08-06T14:00:00Z').getTime(),
    },
  ],
  [
    'DOC-4',
    {
      id: 'DOC-4',
      employee_id: 'EMP-001',
      title: 'NBI Clearance 2026',
      file_name: 'NBI_Clearance.png',
      file_type: 'image/png',
      category: 'ID',
      uploaded_by: 'EMP-001',
      uploaded_at: '2026-08-10',
      file_size: '410 KB',
      note: 'Annual security clearance certificate',
      file_path: null,
      file_data: SAMPLE_PNG_BUFFER,
      status: 'Verified',
      created_at: new Date('2026-08-10T16:45:00Z').getTime(),
    },
  ],
]);

// Load any existing file in uploads/documents
const existingDocx = path.join(uploadsDir, 'DOC-1789805142721_SF-SHIRT-SIZES-TEMPLATE__1_.docx');
if (fs.existsSync(existingDocx)) {
  const stats = fs.statSync(existingDocx);
  documents.set('DOC-1789805142721', {
    id: 'DOC-1789805142721',
    employee_id: 'EMP-001',
    title: 'SF-SHIRT-SIZES-TEMPLATE (1).docx',
    file_name: 'SF-SHIRT-SIZES-TEMPLATE (1).docx',
    file_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    category: 'Other',
    uploaded_by: 'EMP-001',
    uploaded_at: '2026-08-12',
    file_size: `${(stats.size / 1024).toFixed(1)} KB`,
    note: 'Uploaded template document',
    file_path: 'uploads/documents/DOC-1789805142721_SF-SHIRT-SIZES-TEMPLATE__1_.docx',
    file_data: fs.readFileSync(existingDocx),
    status: 'Verified',
    created_at: new Date('2026-08-12T10:00:00Z').getTime(),
  });
}

const sessions = new Map();
const passwordResets = [];
let auditIdCounter = 3;
const auditLog = [
  {
    id: 2,
    actor: 'Admin Account',
    actorId: 'ADM-001',
    action: 'LOGIN',
    target: '-',
    details: 'Signed in as HR Admin',
    timestamp: new Date(Date.now() - 3600 * 1000).toISOString(),
  },
  {
    id: 1,
    actor: 'Admin Account',
    actorId: 'ADM-001',
    action: 'SYSTEM_INIT',
    target: '-',
    details: 'SecureHR database initialized with standard schema and seed data',
    timestamp: new Date(Date.now() - 7200 * 1000).toISOString(),
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

function sendSuccess(res, data = null, message = 'Success', code = 200) {
  const payload = { success: true, message };
  if (data !== null) payload.data = data;
  return res.status(code).json(payload);
}

function sendError(res, message = 'An error occurred', code = 400, data = null) {
  const payload = { success: false, message };
  if (data !== null) payload.data = data;
  return res.status(code).json(payload);
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/Bearer\s+(\S+)/i);
  if (match) return match[1];
  if (req.query.token) return String(req.query.token).trim();
  return '';
}

function verifyEmployeePassword(user, password) {
  const stored = user.password || '';
  if (!stored) return false;
  if (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')) {
    const normalized = stored.replace(/^\$2y\$/, '$2a$');
    if (bcrypt.compareSync(password, normalized)) return true;
  }
  if (stored === password) {
    user.password = bcrypt.hashSync(password, 10);
    return true;
  }
  return false;
}

function requireAuth(req, res, allowedRoles = null) {
  const token = getBearerToken(req);
  if (!token) {
    sendError(res, 'Authentication required', 401);
    return null;
  }

  const sess = sessions.get(token);
  if (!sess || !sess.is_active || new Date(sess.expires_at).getTime() <= Date.now()) {
    sendError(res, 'Session expired or invalid', 401);
    return null;
  }

  const emp = employees.get(sess.employee_id);
  if (!emp) {
    sendError(res, 'Session expired or invalid', 401);
    return null;
  }

  if (emp.status !== 'active') {
    sendError(res, 'Your account is inactive. Please contact the HR administrator.', 403);
    return null;
  }

  if (allowedRoles !== null) {
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    if (!roles.includes(sess.role)) {
      sendError(res, 'You do not have permission to perform this action.', 403);
      return null;
    }
  }

  sess.last_activity = new Date().toISOString();

  return {
    id: emp.id,
    firstName: emp.first_name,
    lastName: emp.last_name,
    email: emp.email,
    department: emp.department,
    role: emp.role,
    status: emp.status,
    dateAdded: emp.date_added,
    fullName: `${emp.first_name} ${emp.last_name}`.trim(),
    token,
  };
}

function logAudit(actor, actorId, action, target = '-', details = '') {
  auditLog.unshift({
    id: auditIdCounter++,
    actor,
    actorId,
    action,
    target,
    details,
    timestamp: new Date().toISOString(),
  });
}

function mapEmployeeRow(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    department: row.department,
    role: row.role,
    status: row.status,
    dateAdded: row.date_added,
  };
}

function mapDocumentRow(row) {
  const emp = employees.get(row.employee_id);
  return {
    id: String(row.id),
    employeeId: row.employee_id,
    fileName: row.file_name,
    fileType: row.file_type || 'application/octet-stream',
    category: row.category,
    uploadedBy: row.uploaded_by,
    uploadedAt: row.uploaded_at,
    size: row.file_size || '—',
    note: row.note || '',
    hasFilePath: Boolean(row.file_path || row.file_data),
    employeeName: emp ? `${emp.first_name} ${emp.last_name}`.trim() : '',
  };
}

function nextEmployeeId() {
  let maxNum = 0;
  for (const id of employees.keys()) {
    const m = id.match(/^EMP-(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  return 'EMP-' + String(maxNum + 1).padStart(3, '0');
}

function safeDownloadFilename(name) {
  let clean = String(name || '').replace(/[\\/]/g, '_');
  clean = path.basename(clean).replace(/[^\w.\- ()]/g, '_').trim();
  return clean || 'download';
}

function decodeDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return { buffer: null, mime: 'application/octet-stream' };
  const trimmed = dataUrl.trim();
  if (trimmed.startsWith('data:')) {
    const parts = trimmed.split(',');
    const meta = parts[0] || '';
    const base64Data = parts.slice(1).join(',');
    const mimeMatch = meta.match(/data:([^;]+);/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    try {
      return { buffer: Buffer.from(base64Data, 'base64'), mime };
    } catch {
      return { buffer: null, mime };
    }
  }
  return { buffer: Buffer.from(trimmed, 'utf-8'), mime: 'application/octet-stream' };
}

// ============================================================================
// Route: /api/auth.php
// ============================================================================

app.all('/api/auth.php', (req, res) => {
  const action = String(req.query.action || '');
  const input = req.body || {};

  if (action === 'login') {
    const username = String(input.username || '').trim();
    const password = String(input.password || '');
    const role = String(input.role || '').trim();

    if (!username || !password) {
      return sendError(res, 'Username and password are required', 400);
    }

    const uLower = username.toLowerCase();
    let user = null;
    for (const emp of employees.values()) {
      if (
        emp.email.toLowerCase() === uLower ||
        emp.id.toLowerCase() === uLower ||
        emp.first_name.toLowerCase() === uLower ||
        (emp.role === 'admin' && uLower === 'admin')
      ) {
        user = emp;
        break;
      }
    }

    if (!user || !verifyEmployeePassword(user, password)) {
      return sendError(res, 'Invalid username or password. Please try again.', 401);
    }

    if (role && user.role !== role) {
      return sendError(res, 'This account does not have permission to access that portal.', 403);
    }

    if (user.status !== 'active') {
      return sendError(res, 'Your account is inactive. Please contact the HR administrator.', 403);
    }

    const sessionToken = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 8 * 3600 * 1000).toISOString();

    sessions.set(sessionToken, {
      id: sessionToken,
      employee_id: user.id,
      role: user.role,
      login_time: now.toISOString(),
      last_activity: now.toISOString(),
      expires_at: expiresAt,
      is_active: 1,
    });

    const actorName = `${user.first_name} ${user.last_name}`;
    const roleTitle = user.role === 'admin' ? 'HR Admin' : 'HR Employee';
    logAudit(actorName, user.id, 'LOGIN', '-', `Signed in as ${roleTitle}`);

    return sendSuccess(
      res,
      {
        user: mapEmployeeRow(user),
        token: sessionToken,
      },
      'Login successful!'
    );
  }

  if (action === 'logout') {
    let token = getBearerToken(req);
    if (!token && input.token) token = String(input.token);

    if (token && sessions.has(token)) {
      const sess = sessions.get(token);
      sess.is_active = 0;
      const emp = employees.get(sess.employee_id);
      if (emp) {
        logAudit(`${emp.first_name} ${emp.last_name}`, emp.id, 'LOGOUT', '-', 'User logged out');
      }
    }
    return sendSuccess(res, null, 'Logged out successfully');
  }

  if (action === 'change_password') {
    const auth = requireAuth(req, res);
    if (!auth) return;

    const currentPassword = String(input.currentPassword || '');
    const newPassword = String(input.newPassword || '');

    if (!currentPassword || !newPassword) {
      return sendError(res, 'All password fields are required', 400);
    }
    if (newPassword.length < 6) {
      return sendError(res, 'New password must be at least 6 characters', 400);
    }
    if (currentPassword === newPassword) {
      return sendError(res, 'New password must be different from your current password', 400);
    }

    const user = employees.get(auth.id);
    if (!user) return sendError(res, 'Employee record not found', 404);

    if (!verifyEmployeePassword(user, currentPassword)) {
      return sendError(res, 'Current password is incorrect', 401);
    }

    user.password = bcrypt.hashSync(newPassword, 10);
    logAudit(auth.fullName, auth.id, 'CHANGE_PASSWORD', auth.id, 'Changed account password');
    return sendSuccess(res, null, 'Password updated successfully');
  }

  if (action === 'forgot_password') {
    const target = String(input.emailOrId || input.email || input.username || '').trim();
    if (!target) {
      return sendError(res, 'Please enter your registered email address or Employee ID', 400);
    }

    const tLower = target.toLowerCase();
    let emp = null;
    for (const e of employees.values()) {
      if (e.email.toLowerCase() === tLower || e.id.toLowerCase() === tLower) {
        emp = e;
        break;
      }
    }

    if (!emp) {
      return sendError(res, 'No account found with the provided email or Employee ID.', 404);
    }
    if (emp.status !== 'active') {
      return sendError(res, 'This account is inactive. Please contact the HR department.', 403);
    }

    const tempPassword = 'Reset#' + Math.floor(1000 + Math.random() * 9000);
    const resetToken = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 2 * 3600 * 1000).toISOString();

    passwordResets.push({
      email: emp.email,
      token: resetToken,
      temp_password: tempPassword,
      expires_at: expiresAt,
      used: 0,
    });

    emp.password = bcrypt.hashSync(tempPassword, 10);
    const fullName = `${emp.first_name} ${emp.last_name}`;
    logAudit(fullName, emp.id, 'FORGOT_PASSWORD', emp.email, `Self-service password reset requested for ${fullName} (${emp.id})`);

    return sendSuccess(
      res,
      {
        employeeId: emp.id,
        email: emp.email,
        temporaryPassword: tempPassword,
      },
      'A temporary password has been successfully generated!'
    );
  }

  if (action === 'check') {
    const auth = requireAuth(req, res);
    if (!auth) return;
    return sendSuccess(res, {
      user: {
        id: auth.id,
        firstName: auth.firstName,
        lastName: auth.lastName,
        email: auth.email,
        department: auth.department,
        role: auth.role,
        status: auth.status,
        dateAdded: auth.dateAdded,
      },
    });
  }

  return sendError(res, 'Invalid action specified', 400);
});

// ============================================================================
// Route: /api/employees.php
// ============================================================================

app.all('/api/employees.php', (req, res) => {
  const method = req.method.toUpperCase();
  const action = String(req.query.action || '');
  const input = req.body || {};

  if (method === 'GET') {
    if (action === 'next_id') {
      const auth = requireAuth(req, res, 'admin');
      if (!auth) return;
      return sendSuccess(res, { nextId: nextEmployeeId() });
    }

    if (req.query.id) {
      const auth = requireAuth(req, res);
      if (!auth) return;
      const targetId = String(req.query.id);
      if (auth.role !== 'admin' && auth.id !== targetId) {
        return sendError(res, 'You do not have permission to view this employee.', 403);
      }
      const emp = employees.get(targetId);
      if (!emp) return sendError(res, 'Employee not found', 404);
      return sendSuccess(res, mapEmployeeRow(emp));
    }

    const auth = requireAuth(req, res);
    if (!auth) return;

    const roleFilter = String(req.query.role || 'all');
    const search = String(req.query.search || '').trim().toLowerCase();
    const department = String(req.query.department || '').trim();
    const status = String(req.query.status || '').trim();
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limitParam = String(req.query.limit || '');
    const usePagination = limitParam !== '' && limitParam !== 'all' && parseInt(limitParam, 10) > 0;
    const limit = usePagination ? Math.min(100, Math.max(1, parseInt(limitParam, 10))) : 0;

    let list = Array.from(employees.values());

    if (auth.role !== 'admin') {
      list = list.filter((e) => e.id === auth.id);
    } else {
      if (roleFilter === 'staff' || roleFilter === 'employee') {
        list = list.filter((e) => e.role !== 'admin');
      } else if (roleFilter === 'admin') {
        list = list.filter((e) => e.role === 'admin');
      }

      if (department && department !== 'all') {
        list = list.filter((e) => e.department === department);
      }

      if (status && status !== 'all') {
        list = list.filter((e) => e.status === status);
      }

      if (search) {
        list = list.filter(
          (e) =>
            e.first_name.toLowerCase().includes(search) ||
            e.last_name.toLowerCase().includes(search) ||
            e.id.toLowerCase().includes(search) ||
            e.email.toLowerCase().includes(search) ||
            e.department.toLowerCase().includes(search)
        );
      }
    }

    const total = list.length;
    const mapped = list.map(mapEmployeeRow);

    if (usePagination) {
      const offset = (page - 1) * limit;
      const paged = mapped.slice(offset, offset + limit);
      const totalPages = Math.max(1, Math.ceil(total / limit));
      return sendSuccess(res, {
        employees: paged,
        pagination: { page, limit, total, totalPages },
      });
    }

    return sendSuccess(res, mapped);
  }

  if (method === 'POST') {
    const auth = requireAuth(req, res, 'admin');
    if (!auth) return;

    if (action === 'reset_password') {
      const id = String(input.id || '').trim();
      if (!id) return sendError(res, 'Employee ID is required', 400);

      const emp = employees.get(id);
      if (!emp) return sendError(res, 'Employee not found', 404);

      const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
      let tempPassword = 'Temp#';
      for (let i = 0; i < 5; i++) {
        tempPassword += chars[Math.floor(Math.random() * chars.length)];
      }

      emp.password = bcrypt.hashSync(tempPassword, 10);
      const fullName = `${emp.first_name} ${emp.last_name}`;
      logAudit(auth.fullName, auth.id, 'RESET_PASSWORD', `${fullName} (${id})`, `Admin reset password for ${fullName}. Temporary password issued.`);

      return sendSuccess(
        res,
        {
          temporaryPassword: tempPassword,
          employeeId: id,
          employeeName: fullName,
          email: emp.email,
        },
        `Password has been successfully reset for ${fullName}!`
      );
    }

    const firstName = String(input.firstName || '').trim();
    const lastName = String(input.lastName || '').trim();
    const email = String(input.email || '').trim();
    const department = String(input.department || '').trim();
    const role = ['admin', 'employee'].includes(input.role) ? input.role : 'employee';
    const status = ['active', 'inactive'].includes(input.status) ? input.status : 'active';
    const password = String(input.password || 'emp123');
    const id = String(input.id || '').trim() || nextEmployeeId();

    if (!firstName || !lastName || !email || !department) {
      return sendError(res, 'First name, last name, email, and department are required', 400);
    }

    if (password.length < 6) {
      return sendError(res, 'Password must be at least 6 characters', 400);
    }

    if (employees.has(id)) {
      return sendError(res, 'That employee ID is already in use.', 400);
    }

    for (const e of employees.values()) {
      if (e.email.toLowerCase() === email.toLowerCase()) {
        return sendError(res, 'That email address is already registered.', 400);
      }
    }

    const dateAdded = new Date().toISOString().split('T')[0];
    const newRow = {
      id,
      first_name: firstName,
      last_name: lastName,
      email,
      department,
      role,
      status,
      password: bcrypt.hashSync(password, 10),
      date_added: dateAdded,
    };

    employees.set(id, newRow);
    logAudit(auth.fullName, auth.id, 'CREATE_USER', `${firstName} ${lastName} (${id})`, `Created new ${role} account in ${department} with status: ${status}`);

    return sendSuccess(res, mapEmployeeRow(newRow), 'Employee account created successfully!', 201);
  }

  if (method === 'PUT') {
    const auth = requireAuth(req, res, 'admin');
    if (!auth) return;

    const id = String(input.id || req.query.id || '').trim();
    if (!id) return sendError(res, 'Employee ID is required for update', 400);

    const curr = employees.get(id);
    if (!curr) return sendError(res, 'Employee not found', 404);

    const firstName = input.firstName !== undefined ? String(input.firstName).trim() : curr.first_name;
    const lastName = input.lastName !== undefined ? String(input.lastName).trim() : curr.last_name;
    const email = input.email !== undefined ? String(input.email).trim() : curr.email;
    const department = input.department !== undefined ? String(input.department).trim() : curr.department;
    const role = ['admin', 'employee'].includes(input.role) ? input.role : curr.role;
    const status = ['active', 'inactive'].includes(input.status) ? input.status : curr.status;
    const password = String(input.password || '');

    for (const e of employees.values()) {
      if (e.id !== id && e.email.toLowerCase() === email.toLowerCase()) {
        return sendError(res, 'That email is already in use by another employee.', 400);
      }
    }

    curr.first_name = firstName;
    curr.last_name = lastName;
    curr.email = email;
    curr.department = department;
    curr.role = role;
    curr.status = status;

    if (password) {
      if (password.length < 6) {
        return sendError(res, 'Password must be at least 6 characters', 400);
      }
      curr.password = bcrypt.hashSync(password, 10);
    }

    logAudit(auth.fullName, auth.id, 'UPDATE_USER', `${firstName} ${lastName} (${id})`, `Updated employee details: ${department}, role: ${role}, status: ${status}`);
    return sendSuccess(res, mapEmployeeRow(curr), 'Employee updated successfully!');
  }

  if (method === 'DELETE') {
    const auth = requireAuth(req, res, 'admin');
    if (!auth) return;

    const id = String(input.id || req.query.id || '').trim();
    if (!id) return sendError(res, 'Employee ID is required', 400);
    if (id === auth.id) return sendError(res, 'You cannot delete your own account.', 403);

    const emp = employees.get(id);
    if (!emp) return sendError(res, 'Employee not found', 404);
    if (emp.role === 'admin') return sendError(res, 'Cannot delete an administrator account.', 403);

    employees.delete(id);
    for (const [docId, doc] of documents.entries()) {
      if (doc.employee_id === id) documents.delete(docId);
    }

    logAudit(auth.fullName, auth.id, 'DELETE_USER', `${emp.first_name} ${emp.last_name} (${id})`, `Deleted employee account from ${emp.department}`);
    return sendSuccess(res, null, 'Employee deleted successfully!');
  }

  return sendError(res, 'Method not allowed', 405);
});

// ============================================================================
// Route: /api/documents.php
// ============================================================================

const ALLOWED_CATEGORIES = ['Contract', 'Payslip', 'Certificate', 'ID', 'Other'];

app.all('/api/documents.php', (req, res) => {
  const method = req.method.toUpperCase();
  const action = String(req.query.action || '');
  const input = req.body || {};

  if (method === 'GET') {
    const auth = requireAuth(req, res);
    if (!auth) return;

    if ((action === 'download' || action === 'preview') && req.query.id) {
      const docId = String(req.query.id);
      const doc = documents.get(docId);
      if (!doc) return sendError(res, 'Document not found', 404);

      if (auth.role !== 'admin' && auth.id !== doc.employee_id) {
        return sendError(res, 'You do not have permission to access this document.', 403);
      }

      const fileName = safeDownloadFilename(doc.file_name);
      const storedType = doc.file_type || 'application/octet-stream';
      let binary = doc.file_data || null;

      if ((!binary || binary.length === 0) && doc.file_path) {
        const diskPath = path.join(__dirname, doc.file_path);
        if (fs.existsSync(diskPath)) {
          binary = fs.readFileSync(diskPath);
        }
      }

      if (!binary || binary.length === 0) {
        return sendError(res, 'No file data available for this document', 404);
      }

      const disposition = action === 'download' ? 'attachment' : 'inline';
      res.setHeader('Content-Type', storedType);
      res.setHeader('Content-Disposition', `${disposition}; filename="${fileName.replace(/["\r\n]/g, '')}"`);
      res.setHeader('Content-Length', binary.length);
      res.setHeader('X-File-Name', encodeURIComponent(fileName));
      res.setHeader('X-File-Type', storedType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, max-age=3600');
      return res.send(binary);
    }

    const employeeId = String(req.query.employee_id || '');
    const category = String(req.query.category || '');
    const search = String(req.query.search || '').trim().toLowerCase();
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limitParam = String(req.query.limit || '');
    const usePagination = limitParam !== '' && limitParam !== 'all' && parseInt(limitParam, 10) > 0;
    const limit = usePagination ? Math.min(100, Math.max(1, parseInt(limitParam, 10))) : 0;

    let list = Array.from(documents.values()).sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

    if (auth.role !== 'admin') {
      list = list.filter((d) => d.employee_id === auth.id);
    } else if (employeeId && employeeId !== 'all') {
      list = list.filter((d) => d.employee_id === employeeId);
    }

    if (category && category !== 'all') {
      if (!ALLOWED_CATEGORIES.includes(category)) {
        return sendError(res, 'Invalid document category', 400);
      }
      list = list.filter((d) => d.category === category);
    }

    if (search) {
      list = list.filter((d) => {
        const emp = employees.get(d.employee_id);
        const empName = emp ? `${emp.first_name} ${emp.last_name}`.toLowerCase() : '';
        return (
          d.file_name.toLowerCase().includes(search) ||
          d.employee_id.toLowerCase().includes(search) ||
          empName.includes(search) ||
          (d.note || '').toLowerCase().includes(search)
        );
      });
    }

    const total = list.length;
    const mapped = list.map(mapDocumentRow);

    if (usePagination) {
      const offset = (page - 1) * limit;
      const paged = mapped.slice(offset, offset + limit);
      const totalPages = Math.max(1, Math.ceil(total / limit));
      return sendSuccess(res, {
        documents: paged,
        pagination: { page, limit, total, totalPages },
      });
    }

    return sendSuccess(res, mapped);
  }

  if (method === 'POST') {
    const auth = requireAuth(req, res);
    if (!auth) return;

    const id = String(input.id || `DOC-${Date.now()}`).trim();
    const employeeId = auth.role !== 'admin' ? auth.id : String(input.employeeId || '').trim();
    let fileName = String(input.fileName || '').trim();
    let fileType = String(input.fileType || '').trim();
    const category = ALLOWED_CATEGORIES.includes(input.category) ? input.category : 'Other';
    const fileSize = String(input.size || '0 KB').trim();
    const note = String(input.note || '').trim();
    const fileData = input.fileData || null;

    if (!employeeId) return sendError(res, 'Employee ID is required for document upload', 400);
    if (!fileName) return sendError(res, 'File name is required', 400);

    const { buffer, mime } = decodeDataUrl(fileData);
    if (!buffer || buffer.length === 0) {
      return sendError(res, 'File content is required', 400);
    }
    if (buffer.length > 15 * 1024 * 1024) {
      return sendError(res, 'File is too large. Maximum size is 15MB.', 400);
    }
    if (!fileType) fileType = mime;

    fileName = safeDownloadFilename(fileName);
    const emp = employees.get(employeeId);
    if (!emp) return sendError(res, 'Employee not found.', 404);

    const safeDiskName = `${id}_${fileName.replace(/[^\w.\-]/g, '_')}`;
    const diskPath = path.join(uploadsDir, safeDiskName);
    const relativePath = `uploads/documents/${safeDiskName}`;
    try {
      fs.writeFileSync(diskPath, buffer);
    } catch {
      // Ignore disk write issues if container filesystem is restricted; in-memory buffer is kept
    }

    const dateAdded = new Date().toISOString().split('T')[0];
    const newDoc = {
      id,
      employee_id: employeeId,
      title: fileName,
      file_name: fileName,
      file_type: fileType,
      category,
      uploaded_by: auth.id,
      uploaded_at: dateAdded,
      file_size: fileSize,
      file_path: relativePath,
      note,
      file_data: buffer,
      status: 'Verified',
      created_at: Date.now(),
    };

    documents.set(id, newDoc);

    const empName = `${emp.first_name} ${emp.last_name}`;
    logAudit(auth.fullName, auth.id, 'UPLOAD_DOCUMENT', fileName, `Uploaded ${category} document for ${empName} (${employeeId}) [${fileSize}]`);

    return sendSuccess(res, mapDocumentRow(newDoc), 'Document uploaded successfully!', 201);
  }

  if (method === 'DELETE') {
    const auth = requireAuth(req, res);
    if (!auth) return;

    const id = String(input.id || req.query.id || '').trim();
    if (!id) return sendError(res, 'Document ID is required', 400);

    const doc = documents.get(id);
    if (!doc) return sendError(res, 'Document not found', 404);

    if (auth.role !== 'admin' && auth.id !== doc.employee_id) {
      return sendError(res, 'You do not have permission to delete this document.', 403);
    }

    if (doc.file_path) {
      const fullPath = path.join(__dirname, doc.file_path);
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
        } catch {
          // ignore
        }
      }
    }

    documents.delete(id);
    logAudit(auth.fullName, auth.id, 'DELETE_DOCUMENT', doc.file_name, `Deleted ${doc.category} document for employee ${doc.employee_id}`);
    return sendSuccess(res, null, 'Document deleted successfully!');
  }

  return sendError(res, 'Method not allowed', 405);
});

// ============================================================================
// Route: /api/audit.php
// ============================================================================

app.get('/api/audit.php', (req, res) => {
  const auth = requireAuth(req, res, 'admin');
  if (!auth) return;

  let limit = parseInt(String(req.query.limit || '200'), 10);
  if (!limit || limit <= 0 || limit > 1000) limit = 200;
  const action = String(req.query.action || '');

  let logs = auditLog;
  if (action && action !== 'all') {
    logs = logs.filter((entry) => entry.action === action);
  }

  return sendSuccess(res, logs.slice(0, limit));
});

// Serve static frontend files
app.use(express.static(__dirname));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SecureHR server running on http://0.0.0.0:${PORT}`);
});
