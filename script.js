// ==========================================
// 🟢 UNIVERSAL GRANULAR ENFORCEMENT ENGINE 🟢
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    applyGranularAccess();
    if(typeof injectClientDatabaseModal === "function") {
        injectClientDatabaseModal();
    }
});

function applyGranularAccess() {
    const MASTER_EMAIL = "shubham347779@gmail.com"; 
    
    const currentUserRaw = localStorage.getItem('tms_user'); 
    const currentRoleRaw = sessionStorage.getItem('userRole'); 
    
    if(!currentUserRaw && !sessionStorage.getItem('isLoggedIn')) return; 

    let isSuper = false;

    // 🟢 BULLETPROOF CHECK: Converts everything to lower case and removes spaces 🟢
    let r = currentRoleRaw ? currentRoleRaw.trim().toLowerCase() : '';
    let u = currentUserRaw ? currentUserRaw.trim().toLowerCase() : '';

    if (r === 'superadmin' || r === 'admin' || r === 'owner') {
        isSuper = true;
    }
    if (u === 'admin' || u === 'superadmin' || u === MASTER_EMAIL.toLowerCase()) {
        isSuper = true;
    }

    let usersDb = JSON.parse(localStorage.getItem('lms_users_db')) || [];
    let activeUserData = usersDb.find(user => 
        (user.email && user.email.toLowerCase() === u) || 
        (user.userId && user.userId.toLowerCase() === u)
    );

    if (activeUserData && activeUserData.isSuperAdmin) {
        isSuper = true;
    }

    const adminTab = document.getElementById('superAdminTab') || window.parent.document.getElementById('superAdminTab');
    const systemUsersTab = document.getElementById('systemUsersTab') || window.parent.document.getElementById('systemUsersTab');
    
    if(!isSuper) {
        if(adminTab) adminTab.style.display = 'none';
        if(systemUsersTab) systemUsersTab.style.display = 'none';
    } else {
        if(adminTab) adminTab.style.display = 'flex';
        if(systemUsersTab) systemUsersTab.style.display = 'flex';
    }

    if(isSuper) return; 

    const allPermissions = JSON.parse(localStorage.getItem('lms_granular_permissions')) || {};
    let permKey = activeUserData ? activeUserData.email : currentUserRaw;
    const myPermissions = allPermissions[permKey] || {};

    const titleToIdMap = {
        "Manage Books": "manage_books",
        "Manage Members": "manage_members",
        "Issue & Return": "issue_return",
        "Dashboard": "dashboard",
        "Setup": "setup",
        "Communication": "communication"
    };

    const navItems = document.querySelectorAll('.nav-links .nav-item') || window.parent.document.querySelectorAll('.nav-links .nav-item');
    
    if(navItems) {
        navItems.forEach(item => {
            const title = item.getAttribute('data-title');
            const engineId = titleToIdMap[title];
            if (engineId && myPermissions[engineId] && myPermissions[engineId].view === false) {
                item.style.display = 'none';
            }
        });
    }

    const securedElements = document.querySelectorAll('[data-perm]');
    securedElements.forEach(element => {
        const permPath = element.getAttribute('data-perm').split('.'); 
        if(permPath.length === 2) {
            if(myPermissions[permPath[0]] && myPermissions[permPath[0]][permPath[1]] === false) {
                element.style.display = 'none';
            }
        }
    });
}
