// ==========================================
// 🟢 SYSTEM USERS DATABASE ENGINE (WITH API SYNC) 🟢
// ==========================================
const API_URL = "https://script.google.com/macros/s/AKfycbyE1U8-EgBh-pQHzHM9MtkzBAmzhdYTuqixpOY0i6dbLoTh7-jHsr7xPLccIrOH35Ye/exec";
const MASTER_EMAIL = "shubham347779@gmail.com"; 

let isEmailVerified = false;
let registrationOTP = null;
let verifiedEmailId = "";

document.addEventListener("DOMContentLoaded", () => {
    initializeDatabase();
    renderUsers();
});

function initializeDatabase() {
    let db = JSON.parse(localStorage.getItem('lms_users_db'));
    if (!db) {
        db = [{ 
            name: "Shubham (Owner)", email: MASTER_EMAIL, userId: "admin",
            password: "1122", isSuperAdmin: true, dbAttached: true, tenantApiUrl: API_URL,
            dateAdded: new Date().toLocaleDateString() 
        }];
        localStorage.setItem('lms_users_db', JSON.stringify(db));
    }
}

async function initiateEmailVerification() {
    const emailInput = document.getElementById('newUserEmail').value.trim().toLowerCase();
    if (emailInput === "") { alert("Please enter an email address first."); return; }

    let db = JSON.parse(localStorage.getItem('lms_users_db')) || [];
    if (db.find(u => u.email === emailInput)) {
        document.getElementById('duplicateEmailModal').style.display = 'flex';
        return;
    }

    const btnVerify = document.getElementById('btnVerifyEmail');
    btnVerify.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';
    btnVerify.disabled = true;

    registrationOTP = Math.floor(1000 + Math.random() * 9000);
    verifiedEmailId = emailInput;

    const emailPayload = { action: 'send_email', to: emailInput, subject: 'LMS User Registration OTP', message: `<h3>LMS Account Setup</h3><p>Your OTP for verifying your email address is: <b>${registrationOTP}</b></p>` };

    try {
        const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify(emailPayload) });
        const resText = await response.text();
        if (resText === "Sent") {
            document.getElementById('otpSection').style.display = 'block';
            document.getElementById('newUserEmail').readOnly = true;
            btnVerify.innerHTML = '<i class="fa-solid fa-check"></i> Sent';
            showToast("OTP Sent to Email!");
        } else {
            alert("Backend Error: " + resText);
            btnVerify.innerHTML = '<i class="fa-solid fa-envelope-circle-check"></i> Verify';
            btnVerify.disabled = false;
        }
    } catch(e) {
        alert("Network error while sending email.");
        btnVerify.innerHTML = '<i class="fa-solid fa-envelope-circle-check"></i> Verify';
        btnVerify.disabled = false;
    }
}

function confirmRegOtp() {
    const enteredOtp = document.getElementById('regOtpInput').value;
    if (enteredOtp != registrationOTP) { alert("Invalid OTP! Please check your email."); return; }
    isEmailVerified = true;
    document.getElementById('otpSection').style.display = 'none';
    const idField = document.getElementById('newUserId');
    const passField = document.getElementById('newUserPass');
    const finalAddBtn = document.getElementById('finalAddBtn');
    idField.disabled = false; passField.disabled = false; finalAddBtn.disabled = false; finalAddBtn.style.opacity = '1';
    document.getElementById('lockIcon1').innerHTML = '<i class="fa-solid fa-unlock" style="color:#10b981;"></i>';
    document.getElementById('lockIcon2').innerHTML = '<i class="fa-solid fa-unlock" style="color:#10b981;"></i>';
    showToast("Email Verified Successfully!");
}

async function addUser(e) {
    e.preventDefault();
    if (!isEmailVerified) { alert("Please verify your email address first!"); return; }

    const btn = document.querySelector('.btn-add');
    const nameInput = document.getElementById('newUserName').value.trim();
    const emailInput = document.getElementById('newUserEmail').value.trim().toLowerCase();
    const idInput = document.getElementById('newUserId').value.trim();
    const passInput = document.getElementById('newUserPass').value.trim();
    
    let db = JSON.parse(localStorage.getItem('lms_users_db')) || [];
    if(db.find(u => u.userId === idInput)) { alert("This User ID is already registered in the system!"); return; }

    const finalAddBtn = document.getElementById('finalAddBtn');
    finalAddBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    finalAddBtn.disabled = true;

    // By default Role sheet me "User" bankar jayega
    const payload = {
        action: 'addUser', name: nameInput, email: emailInput, username: idInput, password: passInput, role: 'User'
    };

    try {
        const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
        const result = await response.json();

        if(result.success || result.status === 'success' || result.message) {
            const newUser = {
                name: nameInput, email: emailInput, userId: idInput, password: passInput, 
                isSuperAdmin: false, dbAttached: false, tenantApiUrl: "",
                dateAdded: new Date().toLocaleDateString()
            };

            db.push(newUser);
            localStorage.setItem('lms_users_db', JSON.stringify(db));

            document.getElementById('addUserForm').reset();
            document.getElementById('newUserEmail').readOnly = false;
            document.getElementById('btnVerifyEmail').disabled = false;
            document.getElementById('btnVerifyEmail').innerHTML = '<i class="fa-solid fa-envelope-circle-check"></i> Verify';
            document.getElementById('newUserId').disabled = true;
            document.getElementById('newUserPass').disabled = true;
            finalAddBtn.disabled = true; finalAddBtn.style.opacity = '0.5';
            finalAddBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Add User';
            document.getElementById('lockIcon1').innerHTML = '<i class="fa-solid fa-lock"></i> Verify Email';
            document.getElementById('lockIcon2').innerHTML = '<i class="fa-solid fa-lock"></i>';
            
            isEmailVerified = false; registrationOTP = null; verifiedEmailId = "";
            renderUsers();
            showToast("User Saved to Google Sheet & System!");
        } else {
            alert("Failed to save in Google Sheet. Check Backend.");
            finalAddBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Add User'; finalAddBtn.disabled = false;
        }
    } catch(error) {
        alert("Connection Error.");
        finalAddBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Add User'; finalAddBtn.disabled = false;
    } 
}

function renderUsers() {
    let db = JSON.parse(localStorage.getItem('lms_users_db')) || [];
    const tbody = document.getElementById('usersTableBody');
    let html = '';

    db.forEach(user => {
        let initial = user.name.charAt(0).toUpperCase();
        let isAdminChecked = user.isSuperAdmin ? "checked" : "";
        let adminBadge = user.isSuperAdmin ? `<span class="admin-badge"><i class="fa-solid fa-crown"></i> ADMIN</span>` : "";
        
        let dbBadge = user.dbAttached 
            ? `<span style="color:#10b981; font-size:11px; font-weight:bold; background:#ecfdf5; padding:2px 6px; border-radius:4px;"><i class="fa-solid fa-database"></i> Attached</span>` 
            : `<span style="color:#ef4444; font-size:11px; font-weight:bold; background:#fef2f2; padding:2px 6px; border-radius:4px;"><i class="fa-solid fa-triangle-exclamation"></i> Pending</span>`;
        
        let isMaster = user.email === MASTER_EMAIL;
        let disableToggle = isMaster ? "disabled" : "";

        let deleteBtn = isMaster 
            ? `<div style="color:#cbd5e1; font-size:12px;">Protected</div>`
            : `<button class="btn-delete" onclick="deleteUser('${user.email}')" title="Delete User"><i class="fa-solid fa-trash"></i></button>`;

        html += `
            <tr>
                <td>
                    <div class="user-badge">
                        <div class="user-avatar">${initial}</div>
                        <div style="font-weight:600;">${user.name} ${adminBadge}<br><div style="margin-top:4px;">${dbBadge}</div></div>
                    </div>
                </td>
                <td><strong>${user.userId || 'N/A'}</strong></td>
                <td>${user.email}</td>
                <td style="text-align: center;">
                    <label class="switch" title="Toggle SuperAdmin Power">
                        <input type="checkbox" onchange="toggleSuperAdmin('${user.email}', this.checked)" ${isAdminChecked} ${disableToggle}>
                        <span class="slider"></span>
                    </label>
                </td>
                <td style="display:flex; justify-content:center; align-items:center;">
                    ${deleteBtn}
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// 🟢 NEW: TOGGLE NOW SYNC WITH GOOGLE SHEET API 🟢
async function toggleSuperAdmin(email, isNowAdmin) {
    let db = JSON.parse(localStorage.getItem('lms_users_db')) || [];
    let userIndex = db.findIndex(u => u.email === email);
    
    if(userIndex !== -1) {
        // Update Local Storage
        db[userIndex].isSuperAdmin = isNowAdmin;
        localStorage.setItem('lms_users_db', JSON.stringify(db));
        renderUsers();
        
        showToast(isNowAdmin ? "Promoting in Database..." : "Demoting in Database...");

        // Fire API Call to change Role in Google Sheet!
        const payload = {
            action: 'changeRole',
            email: email,
            newRole: isNowAdmin ? 'Admin' : 'User'
        };

        try {
            const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
            const result = await response.json();
            if(result.success) {
                showToast(isNowAdmin ? "Promoted to SuperAdmin!" : "Demoted to Normal Access.");
            }
        } catch(error) {
            console.error("Role update failed:", error);
        }
    }
}

async function attachDatabase(email) {
    console.log(`Database attachment for ${email} is handled on the client's screen directly.`);
}

async function deleteUser(email) {
    if(confirm(`Are you sure you want to permanently delete user ${email} from the System and Google Sheet?`)) {
        let db = JSON.parse(localStorage.getItem('lms_users_db')) || [];
        db = db.filter(u => u.email !== email);
        localStorage.setItem('lms_users_db', JSON.stringify(db));
        
        let perms = JSON.parse(localStorage.getItem('lms_granular_permissions')) || {};
        delete perms[email];
        localStorage.setItem('lms_granular_permissions', JSON.stringify(perms));

        renderUsers();
        showToast("Deleting from Database...");

        const payload = { action: 'deleteUser', email: email };
        try {
            const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
            const result = await response.json();
            if(result.success || result.message === "User Deleted") {
                showToast("User Permanently Deleted from Sheet!");
            }
        } catch(error) { console.error("Background Sheet Delete Error:", error); }
    }
}

function showToast(msg) {
    const toast = document.getElementById("toastMsg");
    toast.innerHTML = `<i class="fa-solid fa-check"></i> ${msg}`;
    toast.classList.add("show");
    setTimeout(() => { toast.classList.remove("show"); }, 3000);
}
