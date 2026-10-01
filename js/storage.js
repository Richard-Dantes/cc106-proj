
// SecureHR — Persistent Storage & MySQL API Bridge
// Local metadata cache + authenticated PHP/MySQL backend

const SecureHRStorage = (() => {

    const KEYS = {
        EMPLOYEES: 'securehr_employees',
        DOCUMENTS: 'securehr_documents',
        AUDIT_LOG: 'securehr_audit_log',
        INITIALIZED: 'securehr_initialized',
        API_TOKEN:   'securehr_token',
    };

    const API_BASE = 'api';

    const SEED_EMPLOYEES = [
        {
            id: 'EMP-001',
            firstName: 'Juan',
            lastName: 'Dela Cruz',
            email: 'juan.delacruz@bestlink.edu.ph',
            department: 'Human Resources',
            role: 'employee',
            status: 'active',
            dateAdded: '2026-08-01',
        },
        {
            id: 'EMP-002',
            firstName: 'Maria',
            lastName: 'Santos',
            email: 'maria.santos@bestlink.edu.ph',
            department: 'Finance',
            role: 'employee',
            status: 'active',
            dateAdded: '2026-08-05',
        },
        {
            id: 'EMP-003',
            firstName: 'Roberto',
            lastName: 'Reyes',
            email: 'roberto.reyes@bestlink.edu.ph',
            department: 'IT Department',
            role: 'employee',
            status: 'inactive',
            dateAdded: '2026-07-20',
        },
    ];

    const SEED_ADMIN = {
        id: 'ADM-001',
        firstName: 'Admin',
        lastName: 'Account',
        email: 'admin@bestlink.edu.ph',
        department: 'Administration',
        role: 'admin',
        status: 'active',
        dateAdded: '2026-01-01',
    };

    function _read(key) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            console.error(`SecureHRStorage: Error reading key "${key}"`, e);
            return null;
        }
    }

    function _write(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.error(`SecureHRStorage: Error writing key "${key}"`, e);
        }
    }

    function isHttpServer() {
        return window.location.protocol === 'http:' || window.location.protocol === 'https:';
    }

    function getToken() {
        return sessionStorage.getItem(KEYS.API_TOKEN) || '';
    }

    function authHeaders(extra) {
        const headers = Object.assign({}, extra || {});
        const token = getToken();
        if (token) {
            headers.Authorization = 'Bearer ' + token;
        }
        return headers;
    }

    function stripSecrets(record) {
        if (!record || typeof record !== 'object') return record;
        const copy = Object.assign({}, record);
        delete copy.password;
        delete copy.fileData;
        return copy;
    }

    function sanitizeEmployees(list) {
        return (list || []).map(stripSecrets);
    }

    function sanitizeDocuments(list) {
        return (list || []).map(stripSecrets);
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function init() {
        const cached = sanitizeEmployees(_read(KEYS.EMPLOYEES) || []);
        if (!_read(KEYS.INITIALIZED)) {
            _write(KEYS.EMPLOYEES, [SEED_ADMIN, ...SEED_EMPLOYEES]);
            _write(KEYS.DOCUMENTS, []);
            _write(KEYS.AUDIT_LOG, []);
            _write(KEYS.INITIALIZED, true);
        } else {
            _write(KEYS.EMPLOYEES, cached.length ? cached : [SEED_ADMIN, ...SEED_EMPLOYEES]);
            _write(KEYS.DOCUMENTS, sanitizeDocuments(_read(KEYS.DOCUMENTS) || []));
        }
    }

    async function apiFetch(path, options) {
        const opts = options || {};
        const headers = authHeaders(opts.headers || {});
        const res = await fetch(`${API_BASE}/${path}`, Object.assign({}, opts, { headers }));
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const json = await res.json();
            return { ok: res.ok, status: res.status, json, res };
        }
        return { ok: res.ok, status: res.status, json: null, res };
    }

    async function syncFromDatabase() {
        if (!isHttpServer() || !getToken()) return false;

        try {
            const empRes = await apiFetch('employees.php?role=all');
            if (empRes.json && empRes.json.success) {
                const empList = Array.isArray(empRes.json.data) ? empRes.json.data : (empRes.json.data && empRes.json.data.employees);
                if (Array.isArray(empList)) _write(KEYS.EMPLOYEES, sanitizeEmployees(empList));
            }

            const docRes = await apiFetch('documents.php');
            if (docRes.json && docRes.json.success) {
                const docList = Array.isArray(docRes.json.data) ? docRes.json.data : (docRes.json.data && docRes.json.data.documents);
                if (Array.isArray(docList)) _write(KEYS.DOCUMENTS, sanitizeDocuments(docList));
            }

            const role = sessionStorage.getItem('securehr_role');
            if (role === 'admin') {
                const auditRes = await apiFetch('audit.php?limit=200');
                if (auditRes.json && auditRes.json.success && Array.isArray(auditRes.json.data)) {
                    _write(KEYS.AUDIT_LOG, auditRes.json.data);
                }
            }

            return true;
        } catch (error) {
            console.warn('SecureHRStorage: Sync error:', error);
            return false;
        }
    }

    async function apiAuthenticate(username, password, role) {
        if (!isHttpServer()) {
            return {
                success: false,
                message: 'Open SecureHR through XAMPP (http://localhost/...) to sign in. File login is disabled.',
            };
        }

        try {
            const response = await fetch(`${API_BASE}/auth.php?action=login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, role }),
            });
            const result = await response.json();

            if (result.success && result.data && result.data.user) {
                setCurrentUser(result.data.user);
                if (result.data.token) {
                    sessionStorage.setItem(KEYS.API_TOKEN, result.data.token);
                }
                syncFromDatabase().catch(() => {});
                return { success: true, user: result.data.user };
            }

            return {
                success: false,
                message: result.message || 'Invalid credentials',
                isInactive: result.message && result.message.toLowerCase().includes('inactive'),
            };
        } catch (err) {
            console.warn('SecureHRStorage: API auth error:', err);
            return { success: false, message: 'Unable to connect to the server.' };
        }
    }

    async function apiChangePassword(currentPassword, newPassword) {
        if (!isHttpServer()) {
            return { success: false, message: 'Password changes require the PHP backend.' };
        }

        try {
            const { json } = await apiFetch('auth.php?action=change_password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword }),
            });
            return json || { success: false, message: 'Unable to change password.' };
        } catch (err) {
            console.warn('SecureHRStorage: apiChangePassword error:', err);
            return { success: false, message: 'Unable to change password.' };
        }
    }

    function getEmployees() {
        return sanitizeEmployees(_read(KEYS.EMPLOYEES) || []);
    }

    function saveEmployees(data) {
        _write(KEYS.EMPLOYEES, sanitizeEmployees(data));
    }

    function getEmployeeById(id) {
        return getEmployees().find(e => e.id === id) || null;
    }

    function getStaffEmployees() {
        return getEmployees().filter(e => e.role !== 'admin');
    }

    async function addEmployee(emp) {
        const safe = stripSecrets(emp);
        const all = getEmployees();
        all.push(safe);
        saveEmployees(all);

        if (isHttpServer()) {
            try {
                await apiFetch('employees.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(emp),
                });
                await syncFromDatabase();
            } catch (err) {
                console.warn('SecureHRStorage: Error adding employee to MySQL:', err);
            }
        }
    }

    async function updateEmployee(id, updates) {
        const all = getEmployees();
        const idx = all.findIndex(e => e.id === id);
        if (idx !== -1) {
            all[idx] = stripSecrets(Object.assign({}, all[idx], updates));
            saveEmployees(all);
        }

        if (isHttpServer()) {
            try {
                await apiFetch('employees.php', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(Object.assign({ id }, updates)),
                });
                await syncFromDatabase();
            } catch (err) {
                console.warn('SecureHRStorage: Error updating employee in MySQL:', err);
            }
        }
        return true;
    }

    async function deleteEmployee(id) {
        const all = getEmployees();
        const filtered = all.filter(e => e.id !== id);
        saveEmployees(filtered);

        if (isHttpServer()) {
            try {
                await apiFetch('employees.php', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id }),
                });
                await syncFromDatabase();
            } catch (err) {
                console.warn('SecureHRStorage: Error deleting employee from MySQL:', err);
            }
        }
        return filtered.length < all.length;
    }

    function generateEmployeeId() {
        const all = getEmployees();
        let maxNum = 0;
        all.forEach(e => {
            const match = e.id.match(/^EMP-(\d+)$/);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxNum) maxNum = num;
            }
        });
        return 'EMP-' + String(maxNum + 1).padStart(3, '0');
    }

    function getDocuments() {
        return sanitizeDocuments(_read(KEYS.DOCUMENTS) || []);
    }

    function saveDocuments(data) {
        _write(KEYS.DOCUMENTS, sanitizeDocuments(data));
    }

    function getDocumentsByEmployee(employeeId) {
        return getDocuments().filter(d => d.employeeId === employeeId);
    }

    async function addDocument(doc) {
        const all = getDocuments();
        all.unshift(stripSecrets(doc));
        saveDocuments(all);

        if (isHttpServer()) {
            try {
                await apiFetch('documents.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(doc),
                });
                await syncFromDatabase();
            } catch (err) {
                console.warn('SecureHRStorage: Error adding document to MySQL:', err);
            }
        }
    }

    async function deleteDocument(docId) {
        const all = getDocuments();
        const filtered = all.filter(d => d.id !== docId);
        saveDocuments(filtered);

        if (isHttpServer()) {
            try {
                await apiFetch('documents.php', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: docId }),
                });
                await syncFromDatabase();
            } catch (err) {
                console.warn('SecureHRStorage: Error deleting document from MySQL:', err);
            }
        }
    }

    async function fetchDocument(docId) {
        if (!isHttpServer() || !getToken()) {
            return { success: false, message: 'Open SecureHR through XAMPP to view files.' };
        }

        try {
            const { ok, res, json } = await apiFetch('documents.php?action=download&id=' + encodeURIComponent(docId));
            if (!ok) {
                return { success: false, message: (json && json.message) || 'Unable to open document.' };
            }
            const blob = await res.blob();
            if (!blob || blob.size === 0) {
                return { success: false, message: 'This file is empty. Upload it again.' };
            }
            const headerName = res.headers.get('X-File-Name');
            const fileName = headerName ? decodeURIComponent(headerName) : (docId + '.bin');
            const fileType = res.headers.get('X-File-Type') || blob.type || 'application/octet-stream';
            const typedBlob = blob.type ? blob : new Blob([blob], { type: fileType });
            return { success: true, blob: typedBlob, fileName, fileType };
        } catch (err) {
            console.warn('SecureHRStorage: fetchDocument error:', err);
            return { success: false, message: 'Unable to open document.' };
        }
    }

    function triggerBrowserDownload(blob, fileName) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName || 'document';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
    }

    let viewerObjectUrl = null;

    function ensureDocumentViewer() {
        let overlay = document.getElementById('documentViewerModal');
        if (overlay) return overlay;

        overlay = document.createElement('div');
        overlay.className = 'modal-overlay document-viewer-modal';
        overlay.id = 'documentViewerModal';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h3 id="documentViewerTitle">Document</h3>
                    <button class="modal-close" id="btnCloseDocumentViewer" type="button" aria-label="Close viewer">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                    </button>
                </div>
                <div class="modal-body" id="documentViewerBody"></div>
                <div class="modal-footer">
                    <button class="btn-secondary" id="btnCloseDocumentViewerFooter" type="button">Close</button>
                    <button class="btn-primary" id="btnDownloadFromViewer" type="button">Download file</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const close = () => closeDocumentViewer();
        overlay.querySelector('#btnCloseDocumentViewer').addEventListener('click', close);
        overlay.querySelector('#btnCloseDocumentViewerFooter').addEventListener('click', close);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });
        overlay.querySelector('#btnDownloadFromViewer').addEventListener('click', () => {
            const blob = overlay._blob;
            const name = overlay._fileName || 'document';
            if (blob) triggerBrowserDownload(blob, name);
        });
        return overlay;
    }

    function closeDocumentViewer() {
        const overlay = document.getElementById('documentViewerModal');
        if (overlay) overlay.classList.remove('show');
        document.body.style.overflow = '';
        if (viewerObjectUrl) {
            URL.revokeObjectURL(viewerObjectUrl);
            viewerObjectUrl = null;
        }
    }

    function showDocumentViewer(file) {
        const overlay = ensureDocumentViewer();
        overlay._blob = file.blob;
        overlay._fileName = file.fileName;
        document.getElementById('documentViewerTitle').textContent = file.fileName || 'Document';

        const body = document.getElementById('documentViewerBody');
        body.innerHTML = '';
        if (viewerObjectUrl) {
            URL.revokeObjectURL(viewerObjectUrl);
        }
        viewerObjectUrl = URL.createObjectURL(file.blob);
        const type = (file.fileType || file.blob.type || '').toLowerCase();

        if (type.includes('pdf')) {
            const frame = document.createElement('iframe');
            frame.className = 'document-viewer-frame';
            frame.title = file.fileName || 'PDF preview';
            frame.src = viewerObjectUrl;
            body.appendChild(frame);
        } else if (type.indexOf('image/') === 0) {
            const img = document.createElement('img');
            img.className = 'document-viewer-image';
            img.alt = file.fileName || 'Document image';
            img.src = viewerObjectUrl;
            body.appendChild(img);
        } else {
            const fallback = document.createElement('div');
            fallback.className = 'document-viewer-fallback';
            fallback.innerHTML = '<p></p><p></p>';
            fallback.querySelectorAll('p')[0].textContent = file.fileName || 'Document';
            fallback.querySelectorAll('p')[1].textContent = 'This file type cannot be previewed in the browser. Use Download file to save and open it.';
            body.appendChild(fallback);
        }

        overlay.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    async function openDocument(docId) {
        const result = await fetchDocument(docId);
        if (!result.success) return result;
        showDocumentViewer(result);
        return { success: true };
    }

    async function downloadDocument(docId) {
        const result = await fetchDocument(docId);
        if (!result.success) return result;
        triggerBrowserDownload(result.blob, result.fileName);
        return { success: true };
    }

    function getAuditLog() {
        return _read(KEYS.AUDIT_LOG) || [];
    }

    async function appendAuditLog(entry) {
        if (isHttpServer()) {
            return;
        }
        const log = getAuditLog();
        const newEntry = Object.assign({}, entry, {
            timestamp: new Date().toISOString(),
        });
        log.unshift(newEntry);
        if (log.length > 500) log.length = 500;
        _write(KEYS.AUDIT_LOG, log);
    }

    function setCurrentUser(user) {
        const safeUser = stripSecrets(user);
        sessionStorage.setItem('securehr_user', JSON.stringify(safeUser));
        sessionStorage.setItem('securehr_loggedIn', 'true');
        sessionStorage.setItem('securehr_role', user.role);
        sessionStorage.setItem('securehr_loginTime', new Date().toISOString());
    }

    function getCurrentUser() {
        try {
            const raw = sessionStorage.getItem('securehr_user');
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    function clearSession() {
        sessionStorage.removeItem('securehr_user');
        sessionStorage.removeItem('securehr_loggedIn');
        sessionStorage.removeItem('securehr_role');
        sessionStorage.removeItem('securehr_loginTime');
        sessionStorage.removeItem(KEYS.API_TOKEN);
    }

    function isLoggedIn() {
        return sessionStorage.getItem('securehr_loggedIn') === 'true' && getCurrentUser() !== null;
    }

    function getSessionRole() {
        return sessionStorage.getItem('securehr_role');
    }

    function resetAll() {
        Object.values(KEYS).forEach(k => localStorage.removeItem(k));
        clearSession();
        console.log('SecureHRStorage: All local data cleared.');
    }

    init();

    return {
        syncFromDatabase,
        isHttpServer,
        escapeHtml,
        openDocument,
        downloadDocument,
        apiFetch,

        apiAuthenticate,
        apiChangePassword,

        getEmployees,
        saveEmployees,
        getEmployeeById,
        getStaffEmployees,
        addEmployee,
        updateEmployee,
        deleteEmployee,
        generateEmployeeId,

        getDocuments,
        saveDocuments,
        getDocumentsByEmployee,
        addDocument,
        deleteDocument,

        getAuditLog,
        appendAuditLog,

        setCurrentUser,
        getCurrentUser,
        clearSession,
        isLoggedIn,
        getSessionRole,

        resetAll,
    };
})();
