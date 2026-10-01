
// SecureHR — Employee Dashboard JavaScript
// My Documents, Profile, Change Password

document.addEventListener('DOMContentLoaded', () => {

    const currentUser = SecureHRSession.requireAuth('employee');
    if (!currentUser) return;

    const esc = SecureHRStorage.escapeHtml;

    SecureHRSession.startInactivityTimer();

    const initials = (currentUser.firstName[0] + currentUser.lastName[0]).toUpperCase();
    document.getElementById('empAvatar').textContent = initials;
    document.getElementById('empAvatar').title = currentUser.firstName + ' ' + currentUser.lastName;
    document.getElementById('empName').textContent = currentUser.firstName + ' ' + currentUser.lastName;
    document.getElementById('empEmail').textContent = currentUser.email;

    function updateClock() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        const el = document.getElementById('liveClock');
        if (el) el.textContent = timeStr;
    }
    updateClock();
    setInterval(updateClock, 1000);

    const navItems = document.querySelectorAll('.nav-item[data-section]');
    const pageSections = document.querySelectorAll('.page-section');

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

    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const hamburgerBtn = document.getElementById('hamburgerBtn');

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

    document.querySelectorAll('.stat-card[data-section], .quick-link[data-section]').forEach(el => {
        const open = () => goToSection(el.dataset.section);
        el.addEventListener('click', open);
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                open();
            }
        });
    });

    document.getElementById('btnLogout').addEventListener('click', () => {
        SecureHRSession.logout();
    });

    //  OVERVIEW SECTION

    function updateOverview() {
        const docs = SecureHRStorage.getDocumentsByEmployee(currentUser.id);
        document.getElementById('welcomeHeading').textContent = `Welcome back, ${currentUser.firstName}!`;
        document.getElementById('statTotalDocs').textContent = docs.length;
        document.getElementById('statStatus').textContent = currentUser.status.charAt(0).toUpperCase() + currentUser.status.slice(1);
        document.getElementById('statDepartment').textContent = currentUser.department;
        document.getElementById('statEmpId').textContent = currentUser.id;

        // Update doc count badge in sidebar
        document.getElementById('docCount').textContent = docs.length;
    }

    //  PROFILE SECTION

    function renderProfile() {
        document.getElementById('profileAvatar').textContent = initials;
        document.getElementById('profileName').textContent = currentUser.firstName + ' ' + currentUser.lastName;
        document.getElementById('profileId').textContent = currentUser.id;
        document.getElementById('profileEmail').textContent = currentUser.email;
        document.getElementById('profileDept').textContent = currentUser.department;
        document.getElementById('profileRole').textContent = currentUser.role === 'admin' ? 'HR Admin' : 'HR Employee';

        const statusEl = document.getElementById('profileStatus');
        statusEl.textContent = '';
        const badge = document.createElement('span');
        badge.className = 'status-badge ' + currentUser.status;
        badge.textContent = currentUser.status.charAt(0).toUpperCase() + currentUser.status.slice(1);
        statusEl.appendChild(badge);

        document.getElementById('profileDate').textContent = new Date(currentUser.dateAdded).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    //  DOCUMENTS SECTION

    const docTableBody = document.getElementById('docTableBody');
    const docEmptyState = document.getElementById('docEmptyState');
    const docCategoryFilter = document.getElementById('docCategoryFilter');

    function getMyDocuments() {
        return SecureHRStorage.getDocumentsByEmployee(currentUser.id);
    }

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

    let empDocPage = 1;
    const empDocLimit = 6;

    function renderDocuments() {
        let docs = getMyDocuments();
        const filterCategory = docCategoryFilter ? docCategoryFilter.value : 'all';
        if (filterCategory && filterCategory !== 'all') {
            docs = docs.filter(d => d.category === filterCategory);
        }
        const q = (document.getElementById('empDocSearch')?.value || '').trim().toLowerCase();
        if (q) {
            docs = docs.filter(d =>
                (d.fileName || '').toLowerCase().includes(q)
                || (d.note || '').toLowerCase().includes(q)
                || (d.category || '').toLowerCase().includes(q)
            );
        }

        docTableBody.innerHTML = '';
        updateOverview();

        if (!docs || docs.length === 0) {
            docEmptyState.classList.remove('hidden');
            renderPaginationBar('empDocPagination', 1, 0, 0, () => {});
            return;
        }
        docEmptyState.classList.add('hidden');

        const totalPages = Math.ceil(docs.length / empDocLimit);
        if (empDocPage > totalPages) empDocPage = totalPages;
        if (empDocPage < 1) empDocPage = 1;

        const pageDocs = docs.slice((empDocPage - 1) * empDocLimit, empDocPage * empDocLimit);

        pageDocs.forEach(doc => {
            const ext = getFileExtension(doc.fileName);
            const badgeClass = getBadgeClass(ext);
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
                <td><span class="category-badge ${esc(doc.category)}">${esc(doc.category)}</span></td>
                <td style="font-size:0.85rem;color:var(--gray-500)">${esc(doc.size || '—')}</td>
                <td style="font-size:0.85rem;color:var(--gray-500)">${esc(formatDate(doc.uploadedAt))}</td>
                <td>
                    <div class="table-actions">
                        <button class="action-btn edit" title="View" onclick="viewDocument('${esc(doc.id)}')">
                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                        </button>
                        <button class="action-btn edit" title="Download" onclick="downloadDocument('${esc(doc.id)}')">
                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z"/></svg>
                        </button>
                        <button class="action-btn delete" title="Delete" onclick="deleteDocument('${esc(doc.id)}')">
                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                        </button>
                    </div>
                </td>
            `;
            docTableBody.appendChild(row);
        });

        renderPaginationBar('empDocPagination', empDocPage, totalPages, docs.length, (p) => {
            empDocPage = p;
            renderDocuments();
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

    function formatDate(dateStr) {
        return new Date(dateStr).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    // Category filter
    docCategoryFilter.addEventListener('change', () => {
        empDocPage = 1;
        renderDocuments();
    });
    const empDocSearch = document.getElementById('empDocSearch');
    if (empDocSearch) {
        empDocSearch.addEventListener('input', () => {
            empDocPage = 1;
            renderDocuments();
        });
    }

    window.viewDocument = async function(docId) {
        const result = await SecureHRStorage.openDocument(docId);
        if (!result.success) {
            showToast(result.message || 'File preview not available.', 'info');
        }
    };

    window.downloadDocument = async function(docId) {
        const result = await SecureHRStorage.downloadDocument(docId);
        if (!result.success) {
            showToast(result.message || 'Unable to download this file.', 'error');
        }
    };

    window.deleteDocument = async function(docId) {
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
                details: `Deleted ${doc.category} document`,
            });

            renderDocuments();
            showToast('Document deleted.', 'info');
        }
    };

    //  UPLOAD DOCUMENT MODAL

    const uploadModal = document.getElementById('uploadModal');
    const uploadForm = document.getElementById('uploadForm');
    const fileDropZone = document.getElementById('fileDropZone');
    const fileInput = document.getElementById('fileInput');
    const selectedFileInfo = document.getElementById('selectedFileInfo');
    const selectedFileName = document.getElementById('selectedFileName');
    const btnRemoveFile = document.getElementById('btnRemoveFile');
    const btnUploadDoc = document.getElementById('btnUploadDoc');
    const btnCloseUploadModal = document.getElementById('btnCloseUploadModal');
    const btnCancelUpload = document.getElementById('btnCancelUpload');
    const btnSubmitUpload = document.getElementById('btnSubmitUpload');

    let selectedFile = null;

    btnUploadDoc.addEventListener('click', () => {
        selectedFile = null;
        uploadForm.reset();
        selectedFileInfo.classList.add('hidden');
        fileDropZone.style.display = '';
        openUploadModal();
    });

    // File drop zone click
    fileDropZone.addEventListener('click', () => fileInput.click());

    // Drag and drop
    fileDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileDropZone.classList.add('drag-over');
    });
    fileDropZone.addEventListener('dragleave', () => {
        fileDropZone.classList.remove('drag-over');
    });
    fileDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        fileDropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    });

    // File input change
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            handleFileSelect(fileInput.files[0]);
        }
    });

    function handleFileSelect(file) {
        // Validate size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            showToast('File is too large. Maximum size is 5MB.', 'error');
            return;
        }
        selectedFile = file;
        selectedFileName.textContent = `${file.name} (${formatFileSize(file.size)})`;
        selectedFileInfo.classList.remove('hidden');
        fileDropZone.style.display = 'none';
    }

    // Remove file
    btnRemoveFile.addEventListener('click', () => {
        selectedFile = null;
        fileInput.value = '';
        selectedFileInfo.classList.add('hidden');
        fileDropZone.style.display = '';
    });

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    // Submit upload
    btnSubmitUpload.addEventListener('click', () => {
        const category = document.getElementById('docCategory').value;
        const note = document.getElementById('docNote').value.trim();

        if (!selectedFile) {
            showToast('Please select a file to upload.', 'error');
            return;
        }
        if (!category) {
            showToast('Please select a document category.', 'error');
            return;
        }

        // Read file as base64
        const reader = new FileReader();
        reader.onload = async function(e) {
            const docId = 'DOC-' + Date.now();
            const newDoc = {
                id: docId,
                employeeId: currentUser.id,
                fileName: selectedFile.name,
                fileType: selectedFile.type,
                category: category,
                uploadedBy: currentUser.id,
                uploadedAt: new Date().toISOString().split('T')[0],
                size: formatFileSize(selectedFile.size),
                note: note,
                fileData: e.target.result, // base64 data URL
            };

            await SecureHRStorage.addDocument(newDoc);

            await SecureHRStorage.appendAuditLog({
                actor: currentUser.firstName + ' ' + currentUser.lastName,
                actorId: currentUser.id,
                action: 'UPLOAD_DOCUMENT',
                target: selectedFile.name,
                details: `Uploaded ${category} document (${formatFileSize(selectedFile.size)})`,
            });

            closeUploadModal();
            renderDocuments();
            showToast('Document uploaded successfully!', 'success');
        };
        reader.readAsDataURL(selectedFile);
    });

    // Modal helpers
    function openUploadModal() {
        uploadModal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
    function closeUploadModal() {
        uploadModal.classList.remove('show');
        document.body.style.overflow = '';
        selectedFile = null;
    }
    btnCloseUploadModal.addEventListener('click', closeUploadModal);
    btnCancelUpload.addEventListener('click', closeUploadModal);
    uploadModal.addEventListener('click', e => { if (e.target === uploadModal) closeUploadModal(); });

    //  CHANGE PASSWORD

    const changePasswordForm = document.getElementById('changePasswordForm');
    const newPasswordInput = document.getElementById('newPassword');
    const strengthFill = document.getElementById('strengthFill');
    const strengthText = document.getElementById('strengthText');

    // Password strength checker
    newPasswordInput.addEventListener('input', () => {
        const val = newPasswordInput.value;
        const strength = getPasswordStrength(val);

        // Remove all classes
        strengthFill.className = 'strength-fill';

        if (!val) {
            strengthText.textContent = 'Enter a new password';
            return;
        }

        strengthFill.classList.add(strength.level);
        strengthText.textContent = strength.label;
    });

    function getPasswordStrength(password) {
        let score = 0;
        if (password.length >= 6) score++;
        if (password.length >= 10) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;

        if (score <= 1) return { level: 'weak', label: 'Weak' };
        if (score === 2) return { level: 'fair', label: 'Fair' };
        if (score === 3) return { level: 'good', label: 'Good' };
        return { level: 'strong', label: 'Strong' };
    }

    // Form submit
    changePasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const currentPass = document.getElementById('currentPassword').value;
        const newPass = document.getElementById('newPassword').value;
        const confirmPass = document.getElementById('confirmPassword').value;

        // Validate new password
        if (newPass.length < 6) {
            showToast('New password must be at least 6 characters.', 'error');
            return;
        }

        if (newPass !== confirmPass) {
            showToast('New passwords do not match.', 'error');
            return;
        }

        if (newPass === currentPass) {
            showToast('New password must be different from your current password.', 'error');
            return;
        }

        // Update password in MySQL database via API
        const res = await SecureHRStorage.apiChangePassword(currentPass, newPass);
        if (!res.success) {
            showToast(res.message || 'Current password is incorrect.', 'error');
            return;
        }

        changePasswordForm.reset();
        strengthFill.className = 'strength-fill';
        strengthText.textContent = 'Enter a new password';
        showToast('Password updated successfully!', 'success');
    });

    //  TOAST

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

    const notifPanel = document.getElementById('notifPanel');
    const searchPanel = document.getElementById('searchPanel');
    const notifDot = document.getElementById('notifDot');
    const notifList = document.getElementById('notifList');
    const NOTIF_SEEN_KEY = 'securehr_emp_notif_seen';

    function closeTopbarPanels() {
        if (notifPanel) notifPanel.hidden = true;
        if (searchPanel) searchPanel.hidden = true;
        document.getElementById('btnNotifications')?.setAttribute('aria-expanded', 'false');
        document.getElementById('btnTopSearch')?.setAttribute('aria-expanded', 'false');
    }

    function refreshNotifications() {
        if (!notifList) return;
        const items = getMyDocuments().slice(0, 8);
        const seen = Number(sessionStorage.getItem(NOTIF_SEEN_KEY) || 0);
        const unread = items.filter(doc => new Date(doc.uploadedAt || 0).getTime() > seen).length;
        if (notifDot) notifDot.classList.toggle('hidden', unread === 0 || items.length === 0);

        notifList.innerHTML = '';
        if (items.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'dropdown-empty';
            empty.textContent = 'No document updates yet.';
            notifList.appendChild(empty);
            return;
        }
        items.forEach(doc => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'dropdown-item';
            const title = document.createElement('span');
            title.className = 'dropdown-item-title';
            title.textContent = doc.fileName;
            const meta = document.createElement('span');
            meta.className = 'dropdown-item-meta';
            meta.textContent = (doc.category || 'Document') + ' · ' + formatDate(doc.uploadedAt);
            btn.appendChild(title);
            btn.appendChild(meta);
            btn.addEventListener('click', () => {
                closeTopbarPanels();
                goToSection('section-documents');
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
            empty.textContent = 'Type a file name or category.';
            resultsEl.appendChild(empty);
            return;
        }
        const docs = getMyDocuments().filter(d =>
            (d.fileName || '').toLowerCase().includes(q)
            || (d.note || '').toLowerCase().includes(q)
            || (d.category || '').toLowerCase().includes(q)
        ).slice(0, 8);
        if (docs.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'dropdown-empty';
            empty.textContent = 'No matching documents.';
            resultsEl.appendChild(empty);
            return;
        }
        docs.forEach(doc => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'dropdown-item';
            const title = document.createElement('span');
            title.className = 'dropdown-item-title';
            title.textContent = doc.fileName;
            const meta = document.createElement('span');
            meta.className = 'dropdown-item-meta';
            meta.textContent = doc.category || 'Document';
            btn.appendChild(title);
            btn.appendChild(meta);
            btn.addEventListener('click', () => {
                closeTopbarPanels();
                goToSection('section-documents');
                const searchBox = document.getElementById('empDocSearch');
                if (searchBox) {
                    searchBox.value = doc.fileName;
                    renderDocuments();
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

    //  INITIAL RENDER

    updateOverview();
    renderProfile();
    renderDocuments();
    refreshNotifications();

    // Fetch live data from MySQL database
    SecureHRStorage.syncFromDatabase().then(() => {
        updateOverview();
        renderProfile();
        renderDocuments();
        refreshNotifications();
    });
});
