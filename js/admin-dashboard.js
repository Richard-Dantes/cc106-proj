
// SecureHR — Admin Dashboard JavaScript
// Users management, modal, table, search

document.addEventListener('DOMContentLoaded', () => {

    const currentUser = SecureHRSession.requireAuth('admin');
    if (!currentUser) return; // redirect already triggered

    const esc = SecureHRStorage.escapeHtml;

    // Start inactivity timer
    SecureHRSession.startInactivityTimer();

    const sidebarAvatar = document.querySelector('.sidebar-avatar');
    const sidebarUserName = document.querySelector('.sidebar-user-name');
    const sidebarUserEmail = document.querySelector('.sidebar-user-email');
    if (sidebarAvatar) sidebarAvatar.textContent = (currentUser.firstName[0] + currentUser.lastName[0]).toUpperCase();
    if (sidebarAvatar) sidebarAvatar.title = currentUser.firstName + ' ' + currentUser.lastName;
    if (sidebarUserName) sidebarUserName.textContent = currentUser.firstName + ' ' + currentUser.lastName;
    if (sidebarUserEmail) sidebarUserEmail.textContent = currentUser.email;

    function updateClock() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        const el = document.getElementById('liveClock');
        if (el) el.textContent = timeStr;
    }
    updateClock();
    setInterval(updateClock, 1000);

    let editingId = null;

    function getEmployees() {
        return SecureHRStorage.getStaffEmployees();
    }

    const tableBody = document.getElementById('employeeTableBody');
    const emptyState = document.getElementById('emptyState');
    const searchInput = document.getElementById('searchInput');
    const totalUsersEl = document.getElementById('totalUsers');
    const activeUsersEl = document.getElementById('activeUsers');
    const inactiveUsersEl = document.getElementById('inactiveUsers');

    // Modal
    const modalOverlay = document.getElementById('employeeModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalForm = document.getElementById('employeeForm');
    const btnAddUser = document.getElementById('btnAddUser');
    const btnCloseModal = document.getElementById('btnCloseModal');
    const btnCancelModal = document.getElementById('btnCancelModal');
    const btnSubmitModal = document.getElementById('btnSubmitModal');
    const generatedPasswordDisplay = document.getElementById('generatedPasswordDisplay');
    const generatedPasswordCode = document.getElementById('generatedPasswordCode');

    // Nav items
    const navItems = document.querySelectorAll('.nav-item[data-section]');
    const pageSections = document.querySelectorAll('.page-section');

    // Sidebar toggle (mobile)
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const hamburgerBtn = document.getElementById('hamburgerBtn');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.dataset.section;
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            pageSections.forEach(s => s.classList.toggle('hidden', s.id !== target));
            document.getElementById('topbarTitle').textContent = item.querySelector('.nav-label').textContent.trim();
            closeSidebar();
        });
    });

    function openSidebar() {
        sidebar.classList.add('open');
        sidebarOverlay.classList.add('show');
    }
    function closeSidebar() {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('show');
    }
    hamburgerBtn.addEventListener('click', openSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);

    function goToSection(sectionId) {
        const item = document.querySelector('.nav-item[data-section="' + sectionId + '"]');
        if (item) item.click();
    }

    document.querySelectorAll('.stat-card[data-section]').forEach(card => {
        const open = () => goToSection(card.dataset.section);
        card.addEventListener('click', open);
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                open();
            }
        });
    });

    document.getElementById('btnLogout').addEventListener('click', () => {
        SecureHRSession.logout();
    });

    function renderPaginationBar(containerId, currentPage, totalPages, totalItems, onPageChange) {
        const container = document.getElementById(containerId);
        if (!container) return;
        if (totalItems === 0 || totalPages <= 1) {
            container.style.display = 'none';
            container.innerHTML = '';
            return;
        }
        container.style.display = 'flex';
        container.innerHTML = `
            <div class="pagination-info">
                Page <strong>${currentPage}</strong> of <strong>${totalPages}</strong> (${totalItems} total)
            </div>
            <div class="pagination-controls">
                <button type="button" class="pagination-btn" id="${containerId}_prev" ${currentPage <= 1 ? 'disabled' : ''}>&larr; Previous</button>
                <button type="button" class="pagination-btn" id="${containerId}_next" ${currentPage >= totalPages ? 'disabled' : ''}>Next &rarr;</button>
            </div>
        `;
        const prevBtn = document.getElementById(`${containerId}_prev`);
        const nextBtn = document.getElementById(`${containerId}_next`);
        if (prevBtn) prevBtn.onclick = () => onPageChange(currentPage - 1);
        if (nextBtn) nextBtn.onclick = () => onPageChange(currentPage + 1);
    }

    let empPage = 1;
    const empLimit = 8;

    function renderTable(data) {
        tableBody.innerHTML = '';
        updateStats();

        // Update badge count in sidebar
        const userCountBadge = document.getElementById('userCount');
        if (userCountBadge) userCountBadge.textContent = getEmployees().length;

        if (!data || data.length === 0) {
            emptyState.classList.remove('hidden');
            renderPaginationBar('employeePagination', 1, 0, 0, () => {});
            return;
        }
        emptyState.classList.add('hidden');

        const totalPages = Math.ceil(data.length / empLimit);
        if (empPage > totalPages) empPage = totalPages;
        if (empPage < 1) empPage = 1;

        const pageData = data.slice((empPage - 1) * empLimit, empPage * empLimit);

        pageData.forEach(emp => {
            const initials = (emp.firstName[0] + emp.lastName[0]).toUpperCase();
            const row = document.createElement('tr');
            row.dataset.id = emp.id;
            row.innerHTML = `
                <td>
                    <div class="user-cell">
                        <div class="user-avatar-sm">${esc(initials)}</div>
                        <div class="user-info-cell">
                            <div class="name">${esc(emp.firstName)} ${esc(emp.lastName)}</div>
                            <div class="email">${esc(emp.email)}</div>
                        </div>
                    </div>
                </td>
                <td><code style="font-size:0.82rem;color:var(--gray-500)">${esc(emp.id)}</code></td>
                <td>${esc(emp.department)}</td>
                <td><span class="role-badge ${esc(emp.role)}">${emp.role === 'admin' ? 'HR Admin' : 'HR Employee'}</span></td>
                <td><span class="status-badge ${esc(emp.status)}">${esc(emp.status.charAt(0).toUpperCase() + emp.status.slice(1))}</span></td>
                <td>${esc(formatDate(emp.dateAdded))}</td>
                <td>
                    <div class="table-actions">
                        <button class="action-btn edit" title="Edit" onclick="editEmployee('${esc(emp.id)}')">
                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                        </button>
                        <button class="action-btn edit" title="Reset Temporary Password" onclick="adminResetEmployeePassword('${esc(emp.id)}', '${esc(emp.firstName)} ${esc(emp.lastName)}')">
                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>
                        </button>
                        <button class="action-btn delete" title="Delete" onclick="deleteEmployee('${esc(emp.id)}')">
                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                        </button>
                    </div>
                </td>
            `;
            tableBody.appendChild(row);
        });

        renderPaginationBar('employeePagination', empPage, totalPages, data.length, (newPage) => {
            empPage = newPage;
            filterEmployees();
        });
    }

    function filterEmployees() {
        const q = (searchInput ? searchInput.value : '').trim().toLowerCase();
        const employees = getEmployees();
        const filtered = employees.filter(e =>
            e.firstName.toLowerCase().includes(q) ||
            e.lastName.toLowerCase().includes(q) ||
            e.email.toLowerCase().includes(q) ||
            e.department.toLowerCase().includes(q) ||
            e.id.toLowerCase().includes(q)
        );
        renderTable(filtered);
    }

    function updateStats() {
        const employees = getEmployees();
        totalUsersEl.textContent = employees.length;
        activeUsersEl.textContent = employees.filter(e => e.status === 'active').length;
        inactiveUsersEl.textContent = employees.filter(e => e.status === 'inactive').length;

        // Document count
        const allDocs = SecureHRStorage.getDocuments();
        const totalDocsEl = document.getElementById('totalDocs');
        if (totalDocsEl) totalDocsEl.textContent = allDocs.length;
        const docCountBadge = document.getElementById('docCount');
        if (docCountBadge) docCountBadge.textContent = allDocs.length;
    }

    function formatDate(dateStr) {
        return new Date(dateStr).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    searchInput.addEventListener('input', () => {
        empPage = 1;
        filterEmployees();
    });

    function generatePassword() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
        let pass = '';
        for (let i = 0; i < 10; i++) {
            pass += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return pass;
    }

    btnAddUser.addEventListener('click', () => {
        editingId = null;
        modalTitle.textContent = 'Create New Employee Account';
        modalForm.reset();
        const newId = SecureHRStorage.generateEmployeeId();
        document.getElementById('empId').value = newId;
        const pass = generatePassword();
        document.getElementById('empPassword').value = pass;
        generatedPasswordCode.textContent = pass;
        generatedPasswordDisplay.classList.remove('hidden');
        btnSubmitModal.textContent = 'Create Account';
        openModal();
    });

    window.editEmployee = function(id) {
        const emp = SecureHRStorage.getEmployeeById(id);
        if (!emp) return;
        editingId = id;
        modalTitle.textContent = 'Edit Employee Account';
        document.getElementById('empId').value = emp.id;
        document.getElementById('empFirstName').value = emp.firstName;
        document.getElementById('empLastName').value = emp.lastName;
        document.getElementById('empEmail').value = emp.email;
        document.getElementById('empDepartment').value = emp.department;
        document.getElementById('empRole').value = emp.role;
        document.getElementById('empStatus').value = emp.status;
        document.getElementById('empPassword').value = '';
        generatedPasswordDisplay.classList.add('hidden');
        btnSubmitModal.textContent = 'Save Changes';
        openModal();
    };

    window.deleteEmployee = async function(id) {
        const emp = SecureHRStorage.getEmployeeById(id);
        if (!emp) return;

        if (confirm(`Are you sure you want to delete ${emp.firstName} ${emp.lastName}'s account? This action cannot be undone.`)) {
            await SecureHRStorage.deleteEmployee(id);

            // Audit log
            await SecureHRStorage.appendAuditLog({
                actor: currentUser.firstName + ' ' + currentUser.lastName,
                actorId: currentUser.id,
                action: 'DELETE_USER',
                target: emp.firstName + ' ' + emp.lastName + ' (' + id + ')',
                details: `Deleted employee account from ${emp.department}`,
            });

            renderTable(getEmployees());
            populateEmployeeDropdowns();
            showToast('Employee account deleted.', 'info');
        }
    };

    btnSubmitModal.addEventListener('click', async () => {
        const firstName = document.getElementById('empFirstName').value.trim();
        const lastName = document.getElementById('empLastName').value.trim();
        const email = document.getElementById('empEmail').value.trim();
        const department = document.getElementById('empDepartment').value.trim();
        const role = document.getElementById('empRole').value;
        const status = document.getElementById('empStatus').value;
        const password = document.getElementById('empPassword').value.trim();

        if (!firstName || !lastName || !email || !department) {
            showToast('Please fill in all required fields.', 'error');
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showToast('Please enter a valid email address.', 'error');
            return;
        }

        // Check email uniqueness
        const allUsers = SecureHRStorage.getEmployees();
        const emailTaken = allUsers.find(u => u.email.toLowerCase() === email.toLowerCase() && u.id !== (editingId || ''));
        if (emailTaken) {
            showToast('This email address is already in use.', 'error');
            return;
        }

        if (editingId) {
            // Update existing employee
            const updates = { firstName, lastName, email, department, role, status };
            if (password) updates.password = password; // only update password if provided
            await SecureHRStorage.updateEmployee(editingId, updates);

            // Audit log
            await SecureHRStorage.appendAuditLog({
                actor: currentUser.firstName + ' ' + currentUser.lastName,
                actorId: currentUser.id,
                action: 'EDIT_USER',
                target: firstName + ' ' + lastName + ' (' + editingId + ')',
                details: `Updated employee profile`,
            });

            showToast('Employee account updated successfully.', 'success');
        } else {
            // Create new employee
            const newEmp = {
                id: document.getElementById('empId').value,
                firstName, lastName, email, department, role, status,
                password: password || generatePassword(),
                dateAdded: new Date().toISOString().split('T')[0],
            };
            await SecureHRStorage.addEmployee(newEmp);

            // Audit log
            await SecureHRStorage.appendAuditLog({
                actor: currentUser.firstName + ' ' + currentUser.lastName,
                actorId: currentUser.id,
                action: 'CREATE_USER',
                target: firstName + ' ' + lastName + ' (' + newEmp.id + ')',
                details: `Created new ${role === 'admin' ? 'admin' : 'employee'} account in ${department}`,
            });

            showToast('New employee account created successfully!', 'success');
        }

        closeModal();
        renderTable(getEmployees());
        populateEmployeeDropdowns();
    });

    document.getElementById('btnRegenPass').addEventListener('click', () => {
        const pass = generatePassword();
        document.getElementById('empPassword').value = pass;
        generatedPasswordCode.textContent = pass;
        generatedPasswordDisplay.classList.remove('hidden');
    });

    document.getElementById('btnCopyPass').addEventListener('click', () => {
        const pass = generatedPasswordCode.textContent;
        navigator.clipboard.writeText(pass).then(() => {
            showToast('Password copied to clipboard!', 'success');
        });
    });

    function openModal() {
        modalOverlay.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
    function closeModal() {
        modalOverlay.classList.remove('show');
        document.body.style.overflow = '';
        editingId = null;
    }
    btnCloseModal.addEventListener('click', closeModal);
    btnCancelModal.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });

    function showToast(message, type = 'info') {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const icons = {
            success: '<path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" fill="#059669"/>',
            error: '<path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" fill="#E53E3E"/>',
            info: '<path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2a1 1 0 002 0V7zm0 6a1 1 0 10-2 0 1 1 0 002 0z" fill="#3B82F6"/>',
        };
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<svg viewBox="0 0 20 20" width="20" height="20">${icons[type] || icons.info}</svg><span></span>`;
        toast.querySelector('span').textContent = message;
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 4000);
    }

    //  DOCUMENT MANAGEMENT

    const adminDocTableBody = document.getElementById('adminDocTableBody');
    const adminDocEmptyState = document.getElementById('adminDocEmptyState');
    const adminDocEmpFilter = document.getElementById('adminDocEmpFilter');
    const adminDocCatFilter = document.getElementById('adminDocCatFilter');

    // Admin upload modal elements
    const adminUploadModal = document.getElementById('adminUploadModal');
    const adminUploadForm = document.getElementById('adminUploadForm');
    const adminFileDropZone = document.getElementById('adminFileDropZone');
    const adminFileInput = document.getElementById('adminFileInput');
    const adminSelectedFileInfo = document.getElementById('adminSelectedFileInfo');
    const adminSelectedFileName = document.getElementById('adminSelectedFileName');
    const btnAdminRemoveFile = document.getElementById('btnAdminRemoveFile');
    const btnAdminUploadDoc = document.getElementById('btnAdminUploadDoc');
    const btnCloseAdminUploadModal = document.getElementById('btnCloseAdminUploadModal');
    const btnCancelAdminUpload = document.getElementById('btnCancelAdminUpload');
    const btnSubmitAdminUpload = document.getElementById('btnSubmitAdminUpload');
    const adminDocEmployee = document.getElementById('adminDocEmployee');

    let adminSelectedFile = null;

    function populateEmployeeDropdowns() {
        const employees = getEmployees();

        // Filter dropdown
        adminDocEmpFilter.innerHTML = '<option value="all">All Employees</option>';
        employees.forEach(emp => {
            const opt = document.createElement('option');
            opt.value = emp.id;
            opt.textContent = `${emp.firstName} ${emp.lastName} (${emp.id})`;
            adminDocEmpFilter.appendChild(opt);
        });

        // Upload modal employee selector
        adminDocEmployee.innerHTML = '<option value="">Select an employee...</option>';
        employees.forEach(emp => {
            const opt = document.createElement('option');
            opt.value = emp.id;
            opt.textContent = `${emp.firstName} ${emp.lastName} (${emp.id})`;
            adminDocEmployee.appendChild(opt);
        });
    }

    let adminDocPage = 1;
    const adminDocLimit = 8;

    function renderAdminDocuments() {
        const empFilter = adminDocEmpFilter.value;
        const catFilter = adminDocCatFilter.value;
        let docs = SecureHRStorage.getDocuments();

        if (empFilter !== 'all') {
            docs = docs.filter(d => d.employeeId === empFilter);
        }
        if (catFilter !== 'all') {
            docs = docs.filter(d => d.category === catFilter);
        }
        const docSearch = (document.getElementById('adminDocSearch')?.value || '').trim().toLowerCase();
        if (docSearch) {
            docs = docs.filter(d => {
                const emp = SecureHRStorage.getEmployeeById(d.employeeId);
                const empName = emp ? `${emp.firstName} ${emp.lastName}` : (d.employeeName || '');
                return (d.fileName || '').toLowerCase().includes(docSearch)
                    || (d.note || '').toLowerCase().includes(docSearch)
                    || empName.toLowerCase().includes(docSearch)
                    || (d.employeeId || '').toLowerCase().includes(docSearch);
            });
        }

        adminDocTableBody.innerHTML = '';
        updateStats();

        if (!docs || docs.length === 0) {
            adminDocEmptyState.classList.remove('hidden');
            renderPaginationBar('adminDocPagination', 1, 0, 0, () => {});
            return;
        }
        adminDocEmptyState.classList.add('hidden');

        const totalPages = Math.ceil(docs.length / adminDocLimit);
        if (adminDocPage > totalPages) adminDocPage = totalPages;
        if (adminDocPage < 1) adminDocPage = 1;

        const pageDocs = docs.slice((adminDocPage - 1) * adminDocLimit, adminDocPage * adminDocLimit);

        pageDocs.forEach(doc => {
            const ext = getFileExtension(doc.fileName);
            const badgeClass = getBadgeClass(ext);
            const emp = SecureHRStorage.getEmployeeById(doc.employeeId);
            const empName = emp ? `${emp.firstName} ${emp.lastName}` : doc.employeeId;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div class="doc-icon">
                        <div class="doc-icon-badge ${esc(badgeClass)}">${esc(ext)}</div>
                        <div>
                            <div class="doc-name">${esc(doc.fileName)}</div>
                            ${doc.note ? `<div class="doc-note">${esc(doc.note)}</div>` : ''}
                        </div>
                    </div>
                </td>
                <td>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <div class="user-avatar-sm" style="width:28px;height:28px;font-size:0.65rem;">${esc(emp ? (emp.firstName[0] + emp.lastName[0]).toUpperCase() : '??')}</div>
                        <span style="font-size:0.85rem;font-weight:500;color:var(--gray-700);">${esc(empName)}</span>
                    </div>
                </td>
                <td><span class="category-badge ${esc(doc.category)}">${esc(doc.category)}</span></td>
                <td style="font-size:0.85rem;color:var(--gray-500)">${esc(doc.size || '—')}</td>
                <td style="font-size:0.85rem;color:var(--gray-500)">${esc(formatDate(doc.uploadedAt))}</td>
                <td>
                    <div class="table-actions">
                        <button class="action-btn edit" title="View" onclick="adminViewDocument('${esc(doc.id)}')">
                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                        </button>
                        <button class="action-btn edit" title="Download" onclick="adminDownloadDocument('${esc(doc.id)}')">
                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z"/></svg>
                        </button>
                        <button class="action-btn delete" title="Delete" onclick="adminDeleteDocument('${esc(doc.id)}')">
                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                        </button>
                    </div>
                </td>
            `;
            adminDocTableBody.appendChild(row);
        });

        renderPaginationBar('adminDocPagination', adminDocPage, totalPages, docs.length, (p) => {
            adminDocPage = p;
            renderAdminDocuments();
        });
    }

    function getFileExtension(filename) {
        const parts = filename.split('.');
        return parts.length > 1 ? parts.pop().toLowerCase() : '?';
    }

    function getBadgeClass(ext) {
        if (ext === 'pdf') return 'pdf';
        if (['doc', 'docx'].includes(ext)) return 'doc';
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'img';
        return 'other';
    }

    // Filters
    adminDocEmpFilter.addEventListener('change', () => {
        adminDocPage = 1;
        renderAdminDocuments();
    });
    adminDocCatFilter.addEventListener('change', () => {
        adminDocPage = 1;
        renderAdminDocuments();
    });
    const adminDocSearch = document.getElementById('adminDocSearch');
    if (adminDocSearch) {
        adminDocSearch.addEventListener('input', () => {
            adminDocPage = 1;
            renderAdminDocuments();
        });
    }

    // ADMIN RESET PASSWORD MODAL LOGIC
    const adminResetModal = document.getElementById('adminResetModal');
    const adminResetMessage = document.getElementById('adminResetMessage');
    const adminResetPasswordCode = document.getElementById('adminResetPasswordCode');
    const btnAdminCopyResetPass = document.getElementById('btnAdminCopyResetPass');
    const btnCloseAdminResetModal = document.getElementById('btnCloseAdminResetModal');
    const btnDoneAdminResetModal = document.getElementById('btnDoneAdminResetModal');

    function openAdminResetModal(name, id, tempPass) {
        if (adminResetMessage) adminResetMessage.innerHTML = `A new temporary password has been generated for <strong>${esc(name)}</strong> (<code>${esc(id)}</code>):`;
        if (adminResetPasswordCode) adminResetPasswordCode.textContent = tempPass;
        if (adminResetModal) adminResetModal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    function closeAdminResetModal() {
        if (adminResetModal) adminResetModal.classList.remove('show');
        document.body.style.overflow = '';
    }

    if (btnCloseAdminResetModal) btnCloseAdminResetModal.addEventListener('click', closeAdminResetModal);
    if (btnDoneAdminResetModal) btnDoneAdminResetModal.addEventListener('click', closeAdminResetModal);
    if (adminResetModal) {
        adminResetModal.addEventListener('click', (e) => {
            if (e.target === adminResetModal) closeAdminResetModal();
        });
    }

    if (btnAdminCopyResetPass) {
        btnAdminCopyResetPass.addEventListener('click', async () => {
            const pass = adminResetPasswordCode ? adminResetPasswordCode.textContent : '';
            if (!pass) return;
            try {
                await navigator.clipboard.writeText(pass);
                btnAdminCopyResetPass.querySelector('span').textContent = 'Copied!';
                setTimeout(() => {
                    if (btnAdminCopyResetPass.querySelector('span')) btnAdminCopyResetPass.querySelector('span').textContent = 'Copy';
                }, 2000);
            } catch (err) {
                showToast('Copied to clipboard: ' + pass, 'info');
            }
        });
    }

    window.adminResetEmployeePassword = async function(id, name) {
        if (!confirm(`Generate a new temporary password for ${name} (${id})?`)) return;

        try {
            if (SecureHRStorage.isHttpServer()) {
                const { ok, json } = await SecureHRStorage.apiFetch('employees.php?action=reset_password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id }),
                });

                if (ok && json && json.success && json.data) {
                    openAdminResetModal(name, id, json.data.temporaryPassword);
                    showToast('Temporary password generated successfully!', 'success');
                    return;
                } else {
                    showToast((json && json.message) || 'Failed to reset password.', 'error');
                    return;
                }
            }

            // Fallback for non-server mode
            const tempPass = generatePassword();
            const emp = SecureHRStorage.getEmployeeById(id);
            if (emp) {
                emp.password = tempPass;
                emp.mustChangePassword = true;
                await SecureHRStorage.updateEmployee(id, emp);
                openAdminResetModal(name, id, tempPass);
                showToast('Temporary password generated (local)!', 'success');
            }
        } catch (err) {
            console.error('adminResetEmployeePassword error:', err);
            showToast('Unable to reset password.', 'error');
        }
    };

    window.adminViewDocument = async function(docId) {
        const result = await SecureHRStorage.openDocument(docId);
        if (!result.success) {
            showToast(result.message || 'File preview not available.', 'info');
        }
    };

    window.adminDownloadDocument = async function(docId) {
        const result = await SecureHRStorage.downloadDocument(docId);
        if (!result.success) {
            showToast(result.message || 'Unable to download this file.', 'error');
        }
    };

    window.adminDeleteDocument = async function(docId) {
        const docs = SecureHRStorage.getDocuments();
        const doc = docs.find(d => d.id === docId);
        if (!doc) return;

        if (confirm(`Delete "${doc.fileName}"? This action cannot be undone.`)) {
            await SecureHRStorage.deleteDocument(docId);

            await SecureHRStorage.appendAuditLog({
                actor: currentUser.firstName + ' ' + currentUser.lastName,
                actorId: currentUser.id,
                action: 'DELETE_DOCUMENT',
                target: doc.fileName,
                details: `Admin deleted ${doc.category} document for employee ${doc.employeeId}`,
            });

            renderAdminDocuments();
            showToast('Document deleted.', 'info');
        }
    };

    btnAdminUploadDoc.addEventListener('click', () => {
        adminSelectedFile = null;
        adminUploadForm.reset();
        adminSelectedFileInfo.classList.add('hidden');
        adminFileDropZone.style.display = '';
        populateEmployeeDropdowns(); // refresh list
        openAdminUploadModal();
    });

    // File drop zone
    adminFileDropZone.addEventListener('click', () => adminFileInput.click());
    adminFileDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        adminFileDropZone.classList.add('drag-over');
    });
    adminFileDropZone.addEventListener('dragleave', () => {
        adminFileDropZone.classList.remove('drag-over');
    });
    adminFileDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        adminFileDropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) handleAdminFileSelect(e.dataTransfer.files[0]);
    });
    adminFileInput.addEventListener('change', () => {
        if (adminFileInput.files.length > 0) handleAdminFileSelect(adminFileInput.files[0]);
    });

    function handleAdminFileSelect(file) {
        if (file.size > 5 * 1024 * 1024) {
            showToast('File is too large. Maximum size is 5MB.', 'error');
            return;
        }
        adminSelectedFile = file;
        adminSelectedFileName.textContent = `${file.name} (${formatFileSize(file.size)})`;
        adminSelectedFileInfo.classList.remove('hidden');
        adminFileDropZone.style.display = 'none';
    }

    btnAdminRemoveFile.addEventListener('click', () => {
        adminSelectedFile = null;
        adminFileInput.value = '';
        adminSelectedFileInfo.classList.add('hidden');
        adminFileDropZone.style.display = '';
    });

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    // Submit upload
    btnSubmitAdminUpload.addEventListener('click', () => {
        const employeeId = adminDocEmployee.value;
        const category = document.getElementById('adminDocCategory').value;
        const note = document.getElementById('adminDocNote').value.trim();

        if (!employeeId) {
            showToast('Please select an employee.', 'error');
            return;
        }
        if (!adminSelectedFile) {
            showToast('Please select a file to upload.', 'error');
            return;
        }
        if (!category) {
            showToast('Please select a document category.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = async function(e) {
            const emp = SecureHRStorage.getEmployeeById(employeeId);
            const docId = 'DOC-' + Date.now();
            const newDoc = {
                id: docId,
                employeeId: employeeId,
                fileName: adminSelectedFile.name,
                fileType: adminSelectedFile.type,
                category: category,
                uploadedBy: currentUser.id,
                uploadedAt: new Date().toISOString().split('T')[0],
                size: formatFileSize(adminSelectedFile.size),
                note: note,
                fileData: e.target.result,
            };

            await SecureHRStorage.addDocument(newDoc);

            await SecureHRStorage.appendAuditLog({
                actor: currentUser.firstName + ' ' + currentUser.lastName,
                actorId: currentUser.id,
                action: 'UPLOAD_DOCUMENT',
                target: adminSelectedFile.name,
                details: `Admin uploaded ${category} document for ${emp ? emp.firstName + ' ' + emp.lastName : employeeId} (${formatFileSize(adminSelectedFile.size)})`,
            });

            closeAdminUploadModal();
            renderAdminDocuments();
            showToast('Document uploaded successfully!', 'success');
        };
        reader.readAsDataURL(adminSelectedFile);
    });

    // Modal helpers
    function openAdminUploadModal() {
        adminUploadModal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
    function closeAdminUploadModal() {
        adminUploadModal.classList.remove('show');
        document.body.style.overflow = '';
        adminSelectedFile = null;
    }
    btnCloseAdminUploadModal.addEventListener('click', closeAdminUploadModal);
    btnCancelAdminUpload.addEventListener('click', closeAdminUploadModal);
    adminUploadModal.addEventListener('click', e => { if (e.target === adminUploadModal) closeAdminUploadModal(); });

    //  AUDIT LOG

    const auditTableBody = document.getElementById('auditTableBody');
    const auditEmptyState = document.getElementById('auditEmptyState');
    const auditActionFilter = document.getElementById('auditActionFilter');

    // Human-readable action labels
    const ACTION_LABELS = {
        LOGIN: 'Login',
        LOGOUT: 'Logout',
        CREATE_USER: 'Create User',
        EDIT_USER: 'Edit User',
        UPDATE_USER: 'Update User',
        DELETE_USER: 'Delete User',
        UPLOAD_DOCUMENT: 'Upload Doc',
        DELETE_DOCUMENT: 'Delete Doc',
        CHANGE_PASSWORD: 'Password Change',
    };

    function renderAuditLog() {
        const filter = auditActionFilter.value;
        let log = SecureHRStorage.getAuditLog();

        if (filter !== 'all') {
            log = log.filter(entry => entry.action === filter);
        }

        auditTableBody.innerHTML = '';

        if (log.length === 0) {
            auditEmptyState.classList.remove('hidden');
            return;
        }
        auditEmptyState.classList.add('hidden');

        log.forEach(entry => {
            const row = document.createElement('tr');
            const ts = new Date(entry.timestamp);
            const timeStr = ts.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
                + ' ' + ts.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

            row.innerHTML = `
                <td style="font-size:0.82rem;color:var(--gray-500);white-space:nowrap;">${esc(timeStr)}</td>
                <td style="font-size:0.85rem;font-weight:500;color:var(--gray-700);">${esc(entry.actor || '—')}</td>
                <td><span class="action-badge ${esc(entry.action)}">${esc(ACTION_LABELS[entry.action] || entry.action)}</span></td>
                <td style="font-size:0.85rem;color:var(--gray-700);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(entry.target || '')}">${esc(entry.target || '—')}</td>
                <td style="font-size:0.82rem;color:var(--gray-500);max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(entry.details || '')}">${esc(entry.details || '—')}</td>
            `;
            auditTableBody.appendChild(row);
        });
    }

    auditActionFilter.addEventListener('change', renderAuditLog);

    const notifPanel = document.getElementById('notifPanel');
    const searchPanel = document.getElementById('searchPanel');
    const notifDot = document.getElementById('notifDot');
    const notifList = document.getElementById('notifList');
    const NOTIF_SEEN_KEY = 'securehr_admin_notif_seen';

    function closeTopbarPanels() {
        if (notifPanel) notifPanel.hidden = true;
        if (searchPanel) searchPanel.hidden = true;
        const btnN = document.getElementById('btnNotifications');
        const btnS = document.getElementById('btnTopSearch');
        if (btnN) btnN.setAttribute('aria-expanded', 'false');
        if (btnS) btnS.setAttribute('aria-expanded', 'false');
    }

    function refreshNotifications() {
        if (!notifList) return;
        const items = SecureHRStorage.getAuditLog().slice(0, 8);
        const seen = Number(sessionStorage.getItem(NOTIF_SEEN_KEY) || 0);
        const unread = items.filter(entry => new Date(entry.timestamp).getTime() > seen).length;
        if (notifDot) notifDot.classList.toggle('hidden', unread === 0);

        notifList.innerHTML = '';
        if (items.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'dropdown-empty';
            empty.textContent = 'No recent activity yet.';
            notifList.appendChild(empty);
            return;
        }
        items.forEach(entry => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'dropdown-item';
            const title = document.createElement('span');
            title.className = 'dropdown-item-title';
            title.textContent = ACTION_LABELS[entry.action] || entry.action;
            const meta = document.createElement('span');
            meta.className = 'dropdown-item-meta';
            meta.textContent = (entry.details || entry.target || 'Activity') + '';
            btn.appendChild(title);
            btn.appendChild(meta);
            btn.addEventListener('click', () => {
                closeTopbarPanels();
                goToSection('section-audit');
            });
            notifList.appendChild(btn);
        });
    }

    function renderGlobalSearch(query) {
        const resultsEl = document.getElementById('globalSearchResults');
        if (!resultsEl) return;
        resultsEl.innerHTML = '';
        const q = (query || '').trim().toLowerCase();
        if (!q) {
            const empty = document.createElement('p');
            empty.className = 'dropdown-empty';
            empty.textContent = 'Type a name, email, ID, or file name.';
            resultsEl.appendChild(empty);
            return;
        }

        const employees = getEmployees().filter(e =>
            (e.firstName + ' ' + e.lastName).toLowerCase().includes(q)
            || (e.email || '').toLowerCase().includes(q)
            || (e.id || '').toLowerCase().includes(q)
            || (e.department || '').toLowerCase().includes(q)
        ).slice(0, 5);

        const docs = SecureHRStorage.getDocuments().filter(d =>
            (d.fileName || '').toLowerCase().includes(q)
            || (d.note || '').toLowerCase().includes(q)
        ).slice(0, 5);

        if (employees.length === 0 && docs.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'dropdown-empty';
            empty.textContent = 'No matching employees or documents.';
            resultsEl.appendChild(empty);
            return;
        }

        employees.forEach(emp => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'dropdown-item';
            const title = document.createElement('span');
            title.className = 'dropdown-item-title';
            title.textContent = emp.firstName + ' ' + emp.lastName;
            const meta = document.createElement('span');
            meta.className = 'dropdown-item-meta';
            meta.textContent = emp.id + ' · ' + emp.department;
            btn.appendChild(title);
            btn.appendChild(meta);
            btn.addEventListener('click', () => {
                closeTopbarPanels();
                goToSection('section-users');
                searchInput.value = emp.firstName;
                searchInput.dispatchEvent(new Event('input'));
            });
            resultsEl.appendChild(btn);
        });

        docs.forEach(doc => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'dropdown-item';
            const title = document.createElement('span');
            title.className = 'dropdown-item-title';
            title.textContent = doc.fileName;
            const meta = document.createElement('span');
            meta.className = 'dropdown-item-meta';
            meta.textContent = (doc.category || 'Document') + ' · ' + (doc.employeeId || '');
            btn.appendChild(title);
            btn.appendChild(meta);
            btn.addEventListener('click', () => {
                closeTopbarPanels();
                goToSection('section-documents');
                const docSearch = document.getElementById('adminDocSearch');
                if (docSearch) {
                    docSearch.value = doc.fileName;
                    renderAdminDocuments();
                }
            });
            resultsEl.appendChild(btn);
        });
    }

    document.getElementById('btnNotifications')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const willOpen = notifPanel.hidden;
        closeTopbarPanels();
        if (willOpen) {
            refreshNotifications();
            notifPanel.hidden = false;
            document.getElementById('btnNotifications').setAttribute('aria-expanded', 'true');
            sessionStorage.setItem(NOTIF_SEEN_KEY, String(Date.now()));
            if (notifDot) notifDot.classList.add('hidden');
        }
    });

    document.getElementById('btnTopSearch')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const willOpen = searchPanel.hidden;
        closeTopbarPanels();
        if (willOpen) {
            searchPanel.hidden = false;
            document.getElementById('btnTopSearch').setAttribute('aria-expanded', 'true');
            const input = document.getElementById('globalSearchInput');
            renderGlobalSearch(input.value);
            setTimeout(() => input.focus(), 0);
        }
    });

    document.getElementById('globalSearchInput')?.addEventListener('input', (e) => {
        renderGlobalSearch(e.target.value);
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.topbar-menu')) closeTopbarPanels();
    });

    const btnRefreshAudit = document.getElementById('btnRefreshAudit');
    if (btnRefreshAudit) {
        btnRefreshAudit.addEventListener('click', async () => {
            await SecureHRStorage.syncFromDatabase();
            renderAuditLog();
            refreshNotifications();
            showToast('Audit log refreshed.', 'success');
        });
    }

    // ─── Export Suite ─────────────────────────────────────────────────────────

    /**
     * Convert an array of objects to a CSV string and trigger a browser download.
     * @param {Object[]} rows   Array of flat objects
     * @param {string[]} headers Column headers (keys of each row)
     * @param {string}   filename Download file name (e.g. "bcp_employees.csv")
     */
    function downloadCsv(rows, headers, filename) {
        if (!rows || rows.length === 0) {
            showToast('No data available to export.', 'info');
            return;
        }

        const escape = (v) => {
            if (v === null || v === undefined) return '';
            const s = String(v).replace(/"/g, '""');
            return /[,"\n\r]/.test(s) ? `"${s}"` : s;
        };

        const csvLines = [
            headers.map(escape).join(','),
            ...rows.map(row => headers.map(h => escape(row[h])).join(',')),
        ];
        const blob = new Blob(['\uFEFF' + csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast(`Exported "${filename}" successfully.`, 'success');
    }

    // --- Employees CSV Export ---
    document.getElementById('btnExportEmployeesCsv')?.addEventListener('click', () => {
        const employees = SecureHRStorage.getEmployees();
        const headers = ['id', 'firstName', 'lastName', 'email', 'department', 'role', 'status', 'dateAdded'];
        const friendlyHeaders = ['Employee ID', 'First Name', 'Last Name', 'Email', 'Department', 'Role', 'Status', 'Date Added'];

        // Build rows with friendly header mapping
        const rows = employees.map(e => ({
            'Employee ID':  e.id        || '',
            'First Name':   e.firstName  || '',
            'Last Name':    e.lastName   || '',
            'Email':        e.email      || '',
            'Department':   e.department || '',
            'Role':         e.role       || '',
            'Status':       e.status     || '',
            'Date Added':   e.dateAdded  || '',
        }));

        const today = new Date().toISOString().slice(0, 10);
        downloadCsv(rows, friendlyHeaders, `BCP_Employees_${today}.csv`);
    });

    // --- Documents CSV Export ---
    document.getElementById('btnExportDocsCsv')?.addEventListener('click', () => {
        const documents = SecureHRStorage.getDocuments();
        const friendlyHeaders = ['Document ID', 'Title', 'Employee ID', 'Employee Name', 'Category', 'File Name', 'File Size', 'Uploaded By', 'Date Uploaded', 'Note'];

        const rows = documents.map(d => ({
            'Document ID':   d.id           || '',
            'Title':         d.fileName      || '',
            'Employee ID':   d.employeeId    || '',
            'Employee Name': d.employeeName  || '',
            'Category':      d.category      || '',
            'File Name':     d.fileName      || '',
            'File Size':     d.size          || '',
            'Uploaded By':   d.uploadedBy    || '',
            'Date Uploaded': d.uploadedAt    ? new Date(d.uploadedAt).toLocaleDateString() : '',
            'Note':          d.note          || '',
        }));

        const today = new Date().toISOString().slice(0, 10);
        downloadCsv(rows, friendlyHeaders, `BCP_Documents_${today}.csv`);
    });

    // --- Documents Print View ---
    document.getElementById('btnPrintDocs')?.addEventListener('click', () => {
        const documents = SecureHRStorage.getDocuments();

        if (!documents || documents.length === 0) {
            showToast('No documents available to print.', 'info');
            return;
        }

        const today = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
        const rows = documents.map(d => `
            <tr>
                <td>${SecureHRStorage.escapeHtml(d.id || '')}</td>
                <td>${SecureHRStorage.escapeHtml(d.fileName || '')}</td>
                <td>${SecureHRStorage.escapeHtml(d.employeeName || d.employeeId || '')}</td>
                <td>${SecureHRStorage.escapeHtml(d.category || '')}</td>
                <td>${SecureHRStorage.escapeHtml(d.size || '—')}</td>
                <td>${SecureHRStorage.escapeHtml(d.uploadedBy || '')}</td>
                <td>${d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString() : '—'}</td>
            </tr>`).join('');

        const printWindow = window.open('', '_blank', 'width=1100,height=800');
        printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>BCP SecureHR — Document Registry</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1a1a2e; padding: 32px; }
        .header { display: flex; align-items: center; gap: 20px; margin-bottom: 24px; border-bottom: 3px solid #2563eb; padding-bottom: 16px; }
        .header-text h1 { font-size: 18px; font-weight: 700; color: #1a1a2e; }
        .header-text p  { font-size: 11px; color: #64748b; margin-top: 2px; }
        .report-title { font-size: 15px; font-weight: 600; color: #2563eb; margin-bottom: 6px; }
        .report-meta  { font-size: 11px; color: #64748b; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th { background: #2563eb; color: #fff; text-align: left; padding: 8px 12px; font-size: 11px; font-weight: 600; letter-spacing: 0.3px; }
        td { padding: 7px 12px; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
        tr:nth-child(even) td { background: #f8fafc; }
        .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }
        @media print {
            body { padding: 16px; }
            button { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-text">
            <h1>Bestlink College of the Philippines</h1>
            <p>SecureHR — Employee Records &amp; Document Management System</p>
        </div>
    </div>
    <p class="report-title">Official Document Registry</p>
    <p class="report-meta">Generated on: ${today} &nbsp;|&nbsp; Total Records: ${documents.length}</p>
    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>File Name</th>
                <th>Employee</th>
                <th>Category</th>
                <th>Size</th>
                <th>Uploaded By</th>
                <th>Date Uploaded</th>
            </tr>
        </thead>
        <tbody>${rows}</tbody>
    </table>
    <div class="footer">
        SecureHR &copy; ${new Date().getFullYear()} Bestlink College of the Philippines — Confidential. For Internal HR Use Only.
    </div>
    <script>window.onload = () => window.print();<\/script>
</body>
</html>`);
        printWindow.document.close();
    });

    // --- Audit Log CSV Export ---
    document.getElementById('btnExportAuditCsv')?.addEventListener('click', () => {
        const logs = SecureHRStorage.getAuditLog();
        const friendlyHeaders = ['ID', 'Timestamp', 'Actor', 'Actor ID', 'Action', 'Target', 'Details'];

        const rows = logs.map(l => ({
            'ID':        l.id        || '',
            'Timestamp': l.timestamp ? new Date(l.timestamp).toLocaleString() : '',
            'Actor':     l.actor     || '',
            'Actor ID':  l.actorId   || l.actor_id  || '',
            'Action':    l.action    || '',
            'Target':    l.target    || '-',
            'Details':   l.details   || '',
        }));

        const today = new Date().toISOString().slice(0, 10);
        downloadCsv(rows, friendlyHeaders, `BCP_AuditLog_${today}.csv`);
    });

    // ─── End Export Suite ──────────────────────────────────────────────────────

    renderTable(getEmployees());
    populateEmployeeDropdowns();
    renderAdminDocuments();
    renderAuditLog();
    refreshNotifications();

    // Fetch live data from MySQL database
    SecureHRStorage.syncFromDatabase().then(() => {
        renderTable(getEmployees());
        populateEmployeeDropdowns();
        renderAdminDocuments();
        renderAuditLog();
        refreshNotifications();
    });
});
