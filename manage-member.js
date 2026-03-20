const API_URL = "https://script.google.com/macros/s/AKfycbyE1U8-EgBh-pQHzHM9MtkzBAmzhdYTuqixpOY0i6dbLoTh7-jHsr7xPLccIrOH35Ye/exec";
let membersList = [];
let isEditing = false;

// DOM Elements
const memberForm = document.getElementById('memberForm');
const memberTableBody = document.getElementById('memberTableBody');
const memberModal = document.getElementById('memberModal');
const bulkUpdateModal = document.getElementById('bulkUpdateModal');
const bulkUpdateTableBody = document.getElementById('bulkUpdateTableBody');
const renewModal = document.getElementById('renewModal');
const renewForm = document.getElementById('renewForm');
const filterModal = document.getElementById('filterModal');

// --- HELPER: DATE CALCULATION ---
function calculateExpiryFromDate(startDateStr, months) {
    if(!startDateStr) return "";
    let date = new Date(startDateStr);
    if(parseInt(months) === 999) { 
        date.setFullYear(date.getFullYear() + 50);
    } else {
        date.setMonth(date.getMonth() + parseInt(months));
    }
    return date.toISOString().split('T')[0];
}

// Handle Add/Edit Form Duration Change
window.handleDurationChange = function() {
    const duration = document.getElementById('memberDuration').value;
    const joinDateInput = document.getElementById('joinDate');
    const expiryContainer = document.getElementById('expiryDateContainer');
    const expiryInput = document.getElementById('expiryDate');

    if(duration === '999') {
        expiryContainer.style.display = 'none';
        expiryInput.removeAttribute('required');
        expiryInput.value = calculateExpiryFromDate(joinDateInput.value, 999);
    } else {
        expiryContainer.style.display = 'block';
        expiryInput.setAttribute('required', 'true');
        if(duration !== 'custom') {
            expiryInput.value = calculateExpiryFromDate(joinDateInput.value, duration);
        }
    }
}

// Handle Renew Form Duration Change
window.handleRenewDurationChange = function() {
    const duration = document.getElementById('renewDuration').value;
    const expiryContainer = document.getElementById('renewExpiryContainer');
    const expiryInput = document.getElementById('renewExpiryDate');
    
    const todayStr = new Date().toISOString().split('T')[0];
    if(duration === '999') {
        expiryContainer.style.display = 'none';
        expiryInput.removeAttribute('required');
        expiryInput.value = calculateExpiryFromDate(todayStr, 999);
    } else {
        expiryContainer.style.display = 'block';
        expiryInput.setAttribute('required', 'true');
        if(duration !== 'custom') {
            expiryInput.value = calculateExpiryFromDate(todayStr, duration);
        }
    }
}

// Handle Bulk Update Duration Change
window.handleBulkDurationChange = function(selectElement) {
    const row = selectElement.closest('.bulk-row');
    const duration = selectElement.value;
    const joinInput = row.querySelector('.b-join');
    const expiryInput = row.querySelector('.b-expiry');
    if(!joinInput.value) {
        joinInput.value = new Date().toISOString().split('T')[0];
    }
    if(duration === '999') {
        expiryInput.style.display = 'none';
        expiryInput.value = calculateExpiryFromDate(joinInput.value, 999);
    } else {
        expiryInput.style.display = 'block';
        if(duration !== 'custom') {
            expiryInput.value = calculateExpiryFromDate(joinInput.value, duration);
        }
    }
}

// AUTO ID GENERATION
window.generateMemberID = function() {
    const type = document.getElementById('memberType').value;
    const idField = document.getElementById('memberId');
    if (isEditing) return;
    if (!type) { idField.value = ""; return; }

    let prefix = (type === "Student") ? "S" : (type === "Employee") ? "E" : "G";
    const filteredIDs = membersList
        .filter(m => String(m.id).startsWith(prefix))
        .map(m => {
            const numPart = String(m.id).substring(1);
            return parseInt(numPart) || 0;
        });
    const maxNum = filteredIDs.length > 0 ? Math.max(...filteredIDs) : 0;
    const nextNum = maxNum + 1;
    idField.value = prefix + String(nextNum).padStart(4, '0');
}

// 1. FETCH DATA
async function fetchMembers() {
    memberTableBody.innerHTML = `<tr><td colspan="6"><div class="spinner-container"><div class="spinner"></div><p>Loading members...</p></div></td></tr>`;
    try {
        let mData = sessionStorage.getItem('cache_Members');
        if (mData) {
            membersList = JSON.parse(mData);
        } else {
            const response = await fetch(API_URL + "?sheet=Members");
            membersList = await response.json();
            sessionStorage.setItem('cache_Members', JSON.stringify(membersList));
        }
        renderMembers();
    } catch (error) {
        console.error("Fetch Error:", error);
        memberTableBody.innerHTML = '<tr><td colspan="6" class="empty-msg" style="color:red;">Failed to load data!</td></tr>';
    }
}

// 🟢 NAYA FILTER MODAL LOGIC 🟢
window.openFilterModal = function() { filterModal.classList.add('show'); }
window.closeFilterModal = function() { filterModal.classList.remove('show'); }

window.applyFilters = function() {
    renderMembers();
    closeFilterModal();
}

window.clearFilters = function() {
    document.getElementById("memberSearch").value = "";
    document.getElementById("statusFilter").value = "All";
    document.querySelectorAll('.cat-filter').forEach(cb => cb.checked = true);
    renderMembers();
    closeFilterModal();
}

// 🟢 2. SMART RENDER TABLE (Reads from Modal & Search) 🟢
function renderMembers() {
    memberTableBody.innerHTML = '';
    
    // Get filter values
    const searchText = (document.getElementById("memberSearch").value || "").toLowerCase();
    const statusVal = document.getElementById("statusFilter").value;
    
    // Get multiple checked categories
    const checkedCats = Array.from(document.querySelectorAll('.cat-filter:checked')).map(cb => cb.value.toLowerCase());

    const today = new Date();
    today.setHours(0,0,0,0);

    let displayList = membersList.filter(member => {
        // Search Match
        const matchSearch = String(member.id).toLowerCase().includes(searchText) || 
                            String(member.name).toLowerCase().includes(searchText) ||
                            String(member.phone).toLowerCase().includes(searchText);
        
        // Category Match
        const matchCategory = checkedCats.length === 0 || checkedCats.includes(String(member.type).toLowerCase());

        // Status Match
        let matchStatus = true;
        if (statusVal !== "All") {
            let isExpired = false;
            if (member.ExpiryDate) { // Fix: case sensitive DB key
                let expDate = new Date(member.ExpiryDate);
                if (expDate < today) isExpired = true;
            } else {
                isExpired = true; 
            }
            if (statusVal === "Active" && isExpired) matchStatus = false;
            if (statusVal === "Expired" && !isExpired) matchStatus = false;
        }

        return matchSearch && matchCategory && matchStatus;
    });
    
    // Update top right badge [cite: 89]
    const countBadge = document.getElementById('memberCountBadge');
    if (countBadge) countBadge.innerText = displayList.length;

    if (displayList.length === 0) {
        memberTableBody.innerHTML = `<tr><td colspan="6" class="empty-msg" style="text-align:center; padding: 20px; color: #777;">No matching members found.</td></tr>`;
        return;
    }

    displayList.reverse().forEach((member) => {
        let badgeHtml = `<span class="expiry-badge badge-green">Lifetime</span>`;
        if(member.ExpiryDate) {
            let expDate = new Date(member.ExpiryDate);
            let diffTime = expDate - today;
            let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if(diffDays < 0) {
                badgeHtml = `<span class="expiry-badge badge-red"><i class="fa-solid fa-circle-exclamation"></i> Expired</span>`;
            } else if (diffDays <= 15) {
                badgeHtml = `<span class="expiry-badge badge-orange">Expires in ${diffDays} Days</span>`;
            } else if (diffDays > 10000) {
                badgeHtml = `<span class="expiry-badge badge-green">Lifetime Active</span>`;
            } else {
                badgeHtml = `<span class="expiry-badge badge-green">Active (${diffDays} Days left)</span>`;
            }
        } else {
            badgeHtml = `<span class="expiry-badge badge-red">Not Set</span>`;
        }

        memberTableBody.innerHTML += `
            <tr>
                <td><strong>${member.id}</strong></td>
                <td>${member.name}</td>
                <td><span class="status-pill" style="background:#e3f2fd; color:#1565c0; padding:4px 10px; border-radius:12px; font-size:0.8rem;">${member.type}</span></td>
                <td>${badgeHtml}</td>
                <td>${member.phone}</td>
                <td>
                    <button class="btn btn-primary" onclick="editMember('${member.id}')" style="padding: 5px 10px; margin-right: 5px; background-color: #f39c12; border:none; cursor:pointer;" title="Edit details">
                        <i class="fa-solid fa-pencil"></i>
                    </button>
                    <button class="btn btn-success" onclick="openRenewModal('${member.id}', '${member.name}', '${member.JoinDate}')" style="padding: 5px 10px; margin-right: 5px; background-color: #2ecc71; border:none; cursor:pointer;" title="Renew Membership">
                        <i class="fa-solid fa-arrows-rotate"></i>
                    </button>
                    <button class="btn btn-danger" onclick="deleteMember('${member.id}')" style="padding: 5px 10px; border:none; cursor:pointer;" title="Delete Member">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}

// 3. OPEN ADD MODAL
window.openMemberModal = function() {
    isEditing = false;
    memberForm.reset();
    document.getElementById('modalTitle').innerHTML = '<i class="fa-solid fa-user-plus"></i> Add New Member';
    const idField = document.getElementById('memberId');
    idField.value = "";
    idField.readOnly = true;
    idField.style.backgroundColor = "#f8f9fa";
    document.getElementById('memberDuration').value = '12';
    document.getElementById('joinDate').value = new Date().toISOString().split('T')[0];
    handleDurationChange();
    const submitBtn = memberForm.querySelector('button[type="submit"]');
    submitBtn.innerText = "Save Member";
    submitBtn.className = "btn btn-primary w-100";
    memberModal.classList.add('show');
}

// 4. CLOSE MODAL
window.closeMemberModal = function() {
    memberModal.classList.remove('show');
    memberForm.reset();
}

// 5. EDIT MEMBER
window.editMember = function(memberId) {
    const member = membersList.find(m => String(m.id) === String(memberId));
    if(member) {
        isEditing = true;
        document.getElementById('modalTitle').innerHTML = '<i class="fa-solid fa-user-pen"></i> Edit Member';
        document.getElementById('memberId').value = member.id;
        document.getElementById('memberId').readOnly = true; 
        document.getElementById('memberId').style.backgroundColor = "#e9ecef";
        document.getElementById('memberName').value = member.name;
        document.getElementById('memberType').value = member.type;
        document.getElementById('memberPhone').value = member.phone;
        document.getElementById('memberEmail').value = member.email || '';
        document.getElementById('joinDate').value = member.JoinDate || "";
        document.getElementById('expiryDate').value = member.ExpiryDate || "";
        document.getElementById('memberDuration').value = 'custom';
        handleDurationChange();

        const submitBtn = memberForm.querySelector('button[type="submit"]');
        submitBtn.innerText = "Update Member";
        submitBtn.className = "btn btn-success w-100";
        memberModal.classList.add('show');
    } else {
        alert("Member not found!");
    }
};

// 6. FORM SUBMIT
memberForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const submitBtn = memberForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerText;
    submitBtn.innerText = "Syncing...";
    submitBtn.disabled = true;

    const memberData = {
        action: isEditing ? 'edit' : 'add',
        sheet: 'Members',
        id: document.getElementById('memberId').value.trim(),
        name: document.getElementById('memberName').value.trim(),
        type: document.getElementById('memberType').value,
        phone: document.getElementById('memberPhone').value.trim(),
        email: document.getElementById('memberEmail').value.trim(),
        joinDate: document.getElementById('joinDate').value,
        expiryDate: document.getElementById('expiryDate').value
    };

    try {
        await fetch(API_URL, { method: "POST", body: JSON.stringify(memberData) });
        sessionStorage.removeItem('cache_Members');
        closeMemberModal();
        await fetchMembers(); 
    } catch (error) {
        alert("Server Error: Action failed.");
    } finally {
        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
    }
});

// --- RENEW MEMBER LOGIC ---
window.openRenewModal = function(id, name, originalJoinDate) {
    document.getElementById('renewMemberId').value = id;
    document.getElementById('renewMemberName').value = name;
    document.getElementById('renewOriginalJoinDate').value = originalJoinDate || new Date().toISOString().split('T')[0];
    document.getElementById('renewDuration').value = '12';
    handleRenewDurationChange();
    renewModal.classList.add('show');
}
window.closeRenewModal = function() { renewModal.classList.remove('show'); renewForm.reset(); }

renewForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = renewForm.querySelector('button[type="submit"]');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
    btn.disabled = true;

    const memberId = document.getElementById('renewMemberId').value;
    const oldJoinDate = document.getElementById('renewOriginalJoinDate').value;
    const newExpiryDate = document.getElementById('renewExpiryDate').value;

    try {
        await fetch(API_URL, { 
            method: "POST", 
            body: JSON.stringify({ action: 'renew_member', sheet: 'Members', id: memberId, joinDate: oldJoinDate, expiryDate: newExpiryDate })
        });
        sessionStorage.removeItem('cache_Members');
        closeRenewModal();
        alert("Membership renewed successfully!");
        await fetchMembers(); 
    } catch (error) {
        alert("Renewal failed!");
    } finally {
        btn.innerHTML = '<i class="fa-solid fa-check-circle"></i> Confirm Renewal';
        btn.disabled = false;
    }
});

// 7. BULK UPDATE MODAL
window.openBulkUpdateModal = function() {
    bulkUpdateTableBody.innerHTML = '';
    if(membersList.length === 0){
        bulkUpdateTableBody.innerHTML = '<tr><td colspan="7" class="empty-msg">No data to display.</td></tr>';
    } else {
        membersList.forEach((member) => {
            let isLifetime = false;
            if (member.ExpiryDate) {
                let exp = new Date(member.ExpiryDate);
                let today = new Date();
                let diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
                if (diffDays > 10000) isLifetime = true;
            }
            let durationValue = isLifetime ? '999' : 'custom';
            let expiryDisplayStyle = isLifetime ? 'display: none;' : 'display: block;';

            bulkUpdateTableBody.innerHTML += `
                <tr class="bulk-row">
                    <td><strong>${member.id}</strong><input type="hidden" class="b-id" value="${member.id}"></td>
                    <td><input type="text" class="bulk-input b-name" value="${member.name}"></td>
                    <td>
                        <select class="bulk-input b-type">
                            <option value="Student" ${member.type === 'Student' ? 'selected' : ''}>Student</option>
                            <option value="Employee" ${member.type === 'Employee' ? 'selected' : ''}>Employee</option>
                            <option value="Guest" ${member.type === 'Guest' ? 'selected' : ''}>Guest</option>
                        </select>
                    </td>
                    <td><input type="text" class="bulk-input b-phone" value="${member.phone}"></td>
                    <td>
                        <select class="bulk-input b-duration" onchange="handleBulkDurationChange(this)">
                            <option value="custom" ${durationValue === 'custom' ? 'selected' : ''}>Custom / Existing</option>
                            <option value="1">1 Month</option>
                            <option value="3">3 Months</option>
                            <option value="6">6 Months</option>
                            <option value="12">1 Year</option>
                            <option value="999" ${durationValue === '999' ? 'selected' : ''}>Lifetime</option>
                        </select>
                    </td>
                    <td><input type="date" class="bulk-input b-join" value="${member.JoinDate || ''}" onchange="handleBulkDurationChange(this.closest('.bulk-row').querySelector('.b-duration'))"></td>
                    <td><input type="date" class="bulk-input b-expiry" value="${member.ExpiryDate || ''}" style="${expiryDisplayStyle}" oninput="this.closest('.bulk-row').querySelector('.b-duration').value = 'custom'; this.style.display='block';"></td>
                </tr>
            `;
        });
    }
    bulkUpdateModal.classList.add('show');
}
window.closeBulkUpdateModal = function() { bulkUpdateModal.classList.remove('show'); }

async function saveBulkUpdate() {
    const btn = document.getElementById('saveBulkBtn');
    btn.innerText = "Saving Changes..."; btn.disabled = true;
    const rows = document.querySelectorAll('.bulk-row');
    const updatedData = Array.from(rows).map(row => ({
        id: row.querySelector('.b-id').value,
        name: row.querySelector('.b-name').value.trim(),
        type: row.querySelector('.b-type').value,
        phone: row.querySelector('.b-phone').value.trim(),
        email: row.querySelector('.b-email') ? row.querySelector('.b-email').value.trim() : "",
        joinDate: row.querySelector('.b-join').value,
        expiryDate: row.querySelector('.b-expiry').value
    }));
    try {
        await fetch(API_URL, { method: "POST", body: JSON.stringify({ action: 'bulk_update', sheet: 'Members', updates: updatedData }) });
        sessionStorage.removeItem('cache_Members');
        closeBulkUpdateModal();
        await fetchMembers(); 
    } catch (error) { alert("Bulk update failed!"); } 
    finally { btn.innerText = "Save All Changes"; btn.disabled = false; }
}

// 8. DELETE
window.deleteMember = async function(memberId) {
    if(confirm(`Are you sure you want to delete member ${memberId}?`)) {
        try {
            await fetch(API_URL, { method: "POST", body: JSON.stringify({ action: 'delete', sheet: 'Members', id: memberId }) });
            sessionStorage.removeItem('cache_Members');
            fetchMembers();
        } catch(error) { alert("Delete failed!"); }
    }
};

// --- 9. EXPORT TO EXCEL (CSV) ---
window.exportToExcel = function() {
    // Re-calculating display list based on current filters for export [cite: 143, 144]
    const searchText = (document.getElementById("memberSearch").value || "").toLowerCase();
    const statusVal = document.getElementById("statusFilter").value;
    const checkedCats = Array.from(document.querySelectorAll('.cat-filter:checked')).map(cb => cb.value.toLowerCase());
    const today = new Date();
    today.setHours(0,0,0,0);

    let displayList = membersList.filter(member => {
        const matchSearch = String(member.id).toLowerCase().includes(searchText) || String(member.name).toLowerCase().includes(searchText);
        const matchCategory = checkedCats.length === 0 || checkedCats.includes(String(member.type).toLowerCase());
        let matchStatus = true;
        if (statusVal !== "All") {
            let isExpired = false;
            if (member.ExpiryDate) {
                let expDate = new Date(member.ExpiryDate);
                if (expDate < today) isExpired = true;
            } else { isExpired = true; }
            if (statusVal === "Active" && isExpired) matchStatus = false;
            if (statusVal === "Expired" && !isExpired) matchStatus = false;
        }
        return matchSearch && matchCategory && matchStatus;
    });

    if (displayList.length === 0) {
        alert("No members found to export!");
        return;
    }

    let csvData = "Member ID,Full Name,Category,Contact,Email,Join Date,Expiry Date\n";
    displayList.forEach(member => {
        let email = member.email ? member.email : "N/A";
        let join = member.JoinDate ? member.JoinDate : "N/A";
        let expiry = member.ExpiryDate ? member.ExpiryDate : "N/A";
        let name = member.name.replace(/"/g, '""'); 
        csvData += `"${member.id}","${name}","${member.type}","${member.phone}","${email}","${join}","${expiry}"\n`;
    });

    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const downloadDate = new Date().toISOString().split('T')[0];
    link.setAttribute("href", url);
    link.setAttribute("download", `LMS_Members_Filtered_${downloadDate}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// Initial Load
fetchMembers();