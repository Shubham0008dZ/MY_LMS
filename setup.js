// 👇 Apna latest API URL daal dena
const API_URL = "https://script.google.com/macros/s/AKfycbyE1U8-EgBh-pQHzHM9MtkzBAmzhdYTuqixpOY0i6dbLoTh7-jHsr7xPLccIrOH35Ye/exec";

// 🟢 10 MAIN CONFIGURATIONS + 1 HIDDEN (Racks) 🟢
const SETUP_CONFIG = [
    { id: 'Subjects', icon: 'fa-book-bookmark', label: 'Subjects', sheet: 'Subjects', fields: [{name: 'Code', label: 'Code'}, {name: 'Name', label: 'Name'}] },
    { id: 'Languages', icon: 'fa-language', label: 'Languages', sheet: 'Languages', fields: [{name: 'Name', label: 'Name'}] },
    { id: 'Publishers', icon: 'fa-building', label: 'Publishers', sheet: 'Publishers', fields: [{name: 'Name', label: 'Name'}, {name: 'Mobile', label: 'Mobile No.'}, {name: 'Address', label: 'Address'}, {name: 'City', label: 'City'}, {name: 'State', label: 'State'}, {name: 'Country', label: 'Country'}] },
    { id: 'Authors', icon: 'fa-user-pen', label: 'Authors', sheet: 'Authors', fields: [{name: 'FirstName', label: 'First Name'}, {name: 'LastName', label: 'Last Name'}, {name: 'Spine', label: 'Spine Author Mark'}] },
    { id: 'Vendors', icon: 'fa-truck-field', label: 'Vendors', sheet: 'Vendors', fields: [{name: 'Name', label: 'Name'}, {name: 'Code', label: 'Code'}, {name: 'ContactCoordinator', label: 'Contact Coordinator'}, {name: 'ContactNo', label: 'Contact No.'}, {name: 'EmailID', label: 'Email ID'}, {name: 'Address', label: 'Address'}] },
    { id: 'DDCs', icon: 'fa-swatchbook', label: 'DDC', sheet: 'DDCs', fields: [{name: 'Code', label: 'Code'}, {name: 'Description', label: 'Description'}] },
    { id: 'Shelfs', icon: 'fa-server', label: 'Shelfs', sheet: 'Shelfs', fields: [{name: 'Name', label: 'Name'}] },
    // 🟢 HIDDEN RACKS CONFIGURATION 🟢
    { id: 'Racks', icon: 'fa-layer-group', label: 'Shelf Racks', sheet: 'Racks', isSubMenu: true, fields: [{name: 'Shelf Name', label: 'Shelf Name'}, {name: 'Name', label: 'Rack Name'}] },
    { id: 'Lexiles', icon: 'fa-book-open', label: 'Lexiles', sheet: 'Lexiles', fields: [{name: 'Name', label: 'Name'}] },
    { id: 'Libraries', icon: 'fa-building-columns', label: 'Libraries', sheet: 'Libraries', fields: [{name: 'Name', label: 'Name'}, {name: 'ShortName', label: 'Short Name'}, {name: 'InCharge', label: 'In Charge'}, {name: 'DefaultLibrary', label: 'Default Library'}] },
    { id: 'Genres', icon: 'fa-masks-theater', label: 'Genres', sheet: 'Genres', fields: [{name: 'Name', label: 'Name'}] }
];

let allMasterData = {};
let currentConfig = null;
let isFetchingData = true; 
let activeShelfName = ""; // Global variable to track which shelf's racks we are viewing

async function fetchAllSetupData() {
    isFetchingData = true; 
    document.getElementById('setupLoader').style.display = 'block';
    document.getElementById('setupTable').style.display = 'none';
    document.getElementById('setupEmptyState').style.display = 'none';
    
    try {
        const res = await fetch(API_URL, {
            method: "POST", body: JSON.stringify({ action: "get_all_masters" }), headers: { "Content-Type": "text/plain;charset=utf-8" }
        });
        allMasterData = JSON.parse(await res.text());
    } catch (e) {
        document.getElementById('setupLoader').innerHTML = `<p style="color:red;">Error connecting to database.</p>`;
    } finally {
        isFetchingData = false; 
        if(currentConfig) renderTable(currentConfig.id); 
    }
}

function initSidebar() {
    const sidebar = document.getElementById('setupSidebar');
    sidebar.innerHTML = '';
    SETUP_CONFIG.forEach(config => {
        if (config.isSubMenu) return; // Hide 'Racks' from the sidebar!
        
        let div = document.createElement('div');
        div.className = 'setup-item';
        div.id = `tab_${config.id}`;
        div.innerHTML = `<i class="fa-solid ${config.icon}" style="width:20px; text-align:center; color:#7f8c8d;"></i> <span style="flex-grow:1;">${config.label}</span>`;
        div.onclick = () => selectTab(config.id);
        sidebar.appendChild(div);
    });
}

function selectTab(id) {
    document.querySelectorAll('.setup-item').forEach(el => {
        el.classList.remove('active');
        el.querySelector('i').style.color = '#7f8c8d';
    });
    
    // Hide Back Button if returning to main tabs
    document.getElementById('btnBackToShelfs').style.display = 'none';
    activeShelfName = ""; 

    let activeTab = document.getElementById(`tab_${id}`);
    if (activeTab) {
        activeTab.classList.add('active');
        activeTab.querySelector('i').style.color = '#1a73e8';
    }
    
    currentConfig = SETUP_CONFIG.find(c => c.id === id);
    document.getElementById('setupSearch').value = ""; 
    
    renderTable(id);
}

// 🟢 NAYA: TRANSITION TO RACKS VIEW 🟢
window.viewShelfRacks = function(shelfName) {
    activeShelfName = shelfName;
    document.querySelectorAll('.setup-item').forEach(el => {
        el.classList.remove('active');
        el.querySelector('i').style.color = '#7f8c8d';
    });
    
    // Keep the 'Shelfs' menu looking active
    let shelfTab = document.getElementById('tab_Shelfs');
    shelfTab.classList.add('active');
    shelfTab.querySelector('i').style.color = '#1a73e8';
    
    currentConfig = SETUP_CONFIG.find(c => c.id === 'Racks');
    document.getElementById('setupSearch').value = ""; 
    document.getElementById('btnBackToShelfs').style.display = 'inline-flex';
    
    renderTable('Racks');
}

window.toggleActionMenu = function(recordId) {
    document.querySelectorAll('.action-menu').forEach(menu => menu.classList.remove('show'));
    let menu = document.getElementById(`actionMenu_${recordId}`);
    if (menu) menu.classList.toggle('show');
    
    document.addEventListener('click', function closeMenu(e) {
        if (!e.target.closest('.action-dropdown')) {
            document.querySelectorAll('.action-menu').forEach(m => m.classList.remove('show'));
            document.removeEventListener('click', closeMenu);
        }
    });
}

function renderTable(id) {
    const table = document.getElementById('setupTable');
    const thead = document.getElementById('setupTableHead').querySelector('tr');
    const tbody = document.getElementById('setupTableBody');
    const loader = document.getElementById('setupLoader');
    const emptyState = document.getElementById('setupEmptyState');
    const pageText = document.getElementById('pageCountText');

    if (isFetchingData) {
        loader.style.display = 'block';
        table.style.display = 'none';
        emptyState.style.display = 'none';
        return;
    }

    const config = SETUP_CONFIG.find(c => c.id === id);
    loader.style.display = 'none';
    
    let searchText = document.getElementById('setupSearch').value.toLowerCase();
    let sheetData = allMasterData[config.sheet] || [];
    
    let displayData = sheetData.filter(row => {
        // 🟢 NAYA: FILTER RACKS BY SELECTED SHELF ONLY 🟢
        if (config.id === 'Racks') {
            let sName = row['Shelf Name'] || row['ShelfName'] || row[Object.keys(row)[1]];
            if (sName !== activeShelfName) return false;
        }
        
        if(!searchText) return true;
        let match = false;
        config.fields.forEach(f => {
            let val = String(row[f.label] || row[f.name] || "");
            if(val.toLowerCase().includes(searchText)) match = true;
        });
        return match;
    });

    thead.innerHTML = '';
    config.fields.forEach(f => { thead.innerHTML += `<th>${f.label}</th>`; });
    thead.innerHTML += `<th style="text-align:right;">Actions</th>`;

    let total = displayData.length;
    pageText.innerText = total > 0 ? `1-${total} of ${total}` : `0-0 of 0`;

    if(total === 0) {
        table.style.display = 'none';
        emptyState.style.display = 'block'; 
        return;
    }

    table.style.display = 'table';
    emptyState.style.display = 'none';
    
    tbody.innerHTML = '';
    displayData.reverse().forEach(row => {
        let tr = document.createElement('tr');
        let recordId = row['ID'] || row[Object.keys(row)[0]]; 
        
        config.fields.forEach(f => {
            let val = row[f.label] || row[f.name] || '--';
            tr.innerHTML += `<td>${val}</td>`;
        });
        
        // 🟢 NAYA: INJECT 'SHELF RACKS' LINK ONLY FOR SHELFS MENU 🟢
        let extraActions = "";
        if (config.id === 'Shelfs') {
            let shelfName = row['Name'] || row[Object.keys(row)[1]] || '--';
            let safeShelfName = String(shelfName).replace(/'/g, "\\'");
            extraActions = `<a onclick="viewShelfRacks('${safeShelfName}')"><i class="fa-solid fa-list"></i> Shelf Racks</a>`;
        }

        tr.innerHTML += `
            <td style="text-align:right;">
                <div class="action-dropdown">
                    <button class="btn-action-trigger" onclick="toggleActionMenu('${recordId}')">
                        <i class="fa-solid fa-bars"></i>
                    </button>
                    <div class="action-menu" id="actionMenu_${recordId}" style="text-align:left;">
                        <a onclick="openSetupModal('${recordId}')"><i class="fa-solid fa-pencil"></i> Edit</a>
                        <a onclick="deleteRecord('${config.sheet}', '${recordId}')" class="text-danger"><i class="fa-solid fa-trash-can"></i> Delete</a>
                        ${extraActions}
                    </div>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.openSetupModal = function(editId = null) {
    document.getElementById('modalTitle').innerHTML = editId ?
        `<i class="fa-solid fa-pen-to-square"></i> Edit ${currentConfig.label}` : `<i class="fa-solid fa-plus"></i> Add ${currentConfig.label}`;
    
    document.getElementById('editRecordId').value = editId || "";
    document.getElementById('btnSaveSetup').innerText = editId ? "Update" : "Save";
    
    const formDiv = document.getElementById('dynamicFormFields');
    formDiv.innerHTML = '';
    
    let editRecord = null;
    if (editId) {
        let sheetData = allMasterData[currentConfig.sheet] || [];
        editRecord = sheetData.find(r => String(r['ID']) === String(editId) || String(r[Object.keys(r)[0]]) === String(editId));
    }

    currentConfig.fields.forEach((f, index) => {
        let val = editRecord ? (editRecord[f.label] || editRecord[f.name] || "") : "";
        if (f.name === 'DefaultLibrary') {
            let isChecked = (val.toString().toLowerCase() === 'yes' || val.toString().toLowerCase() === 'true') ? 'checked' : '';
            formDiv.innerHTML += `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 12px; border: 1px solid #d1d5db; border-radius: 6px; background: #fafafa;">
                    <label style="font-weight:600; font-size:14px; color:#555; margin:0;">${f.label}</label>
                    <label class="switch" style="margin:0;">
                        <input type="checkbox" id="setup_input_${index}" ${isChecked}>
                        <span class="slider round"></span>
                    </label>
                </div>
            `;
        } 
        // 🟢 NAYA: RACKS ME SHELF NAME PEHLE SE BHAR DENA AUR READONLY KARNA 🟢
        else if (currentConfig.id === 'Racks' && f.label === 'Shelf Name') {
            val = activeShelfName; // Auto assign active shelf
            formDiv.innerHTML += `
                <label style="font-weight:600; font-size:13px; margin-bottom:5px; display:block; color:#555;">${f.label}</label>
                <input type="text" id="setup_input_${index}" class="bulk-input" value="${val}" readonly style="background:#f3f4f6; cursor:not-allowed;">
            `;
        } else {
            formDiv.innerHTML += `
                <label style="font-weight:600; font-size:13px; margin-bottom:5px; display:block; color:#555;">${f.label}</label>
                <input type="text" id="setup_input_${index}" class="bulk-input" value="${val}" required>
            `;
        }
    });
    
    document.querySelectorAll('.action-menu').forEach(m => m.classList.remove('show'));
    document.getElementById('setupModal').classList.add('show');
}
window.closeSetupModal = function() { document.getElementById('setupModal').classList.remove('show'); }

document.getElementById('setupForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSaveSetup');
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`; btn.disabled = true;

    let isEdit = document.getElementById('editRecordId').value !== "";
    let recordId = document.getElementById('editRecordId').value;
    
    let rowData = [];
    currentConfig.fields.forEach((f, index) => { 
        let el = document.getElementById(`setup_input_${index}`);
        if (f.name === 'DefaultLibrary') {
            rowData.push(el.checked ? "Yes" : "No");
        } else {
            rowData.push(el.value.trim()); 
        }
    });
    let headers = currentConfig.fields.map(f => f.label);

    try {
        await fetch(API_URL, {
            method: "POST", body: JSON.stringify({ 
                action: "save_master_record", masterSheet: currentConfig.sheet, 
                headers: headers, rowData: rowData, isEdit: isEdit, recordId: recordId
            }), headers: { "Content-Type": "text/plain;charset=utf-8" }
        });
        closeSetupModal();
        fetchAllSetupData(); 
    } catch(err) {
        alert("Save failed!"); 
    } finally { 
        btn.innerText = isEdit ? "Update" : "Save";
        btn.disabled = false; 
    }
});


window.openSetupBulkUpdateModal = function() {
    let sheetData = allMasterData[currentConfig.sheet] || [];
    
    // Racks ke case mein sirf current shelf ke racks bulk me khulenge!
    if (currentConfig.id === 'Racks') {
        sheetData = sheetData.filter(row => {
            let sName = row['Shelf Name'] || row['ShelfName'] || row[Object.keys(row)[1]];
            return sName === activeShelfName;
        });
    }

    if (sheetData.length === 0) {
        alert("No data available to update in this category!");
        return;
    }

    document.getElementById('bulkModalTitle').innerHTML = `<i class="fa-solid fa-table-list"></i> Bulk Update - ${currentConfig.label}`;

    const thead = document.getElementById('setupBulkTableHead').querySelector('tr');
    const tbody = document.getElementById('setupBulkTableBody');

    thead.innerHTML = '';
    currentConfig.fields.forEach(f => {
        thead.innerHTML += `<th>${f.label}</th>`;
    });

    tbody.innerHTML = '';
    sheetData.reverse().forEach(row => {
        let tr = document.createElement('tr');
        tr.className = 'bulk-setup-row';
        let recordId = row['ID'] || row[Object.keys(row)[0]];
        
        tr.innerHTML += `<input type="hidden" class="bulk-id" value="${recordId}">`;

        currentConfig.fields.forEach((f) => {
            let val = row[f.label] || row[f.name] || '';
            if (f.name === 'DefaultLibrary') {
                let isChecked = (val.toString().toLowerCase() === 'yes' || val.toString().toLowerCase() === 'true') ? 'checked' : '';
                tr.innerHTML += `
                    <td>
                        <label class="switch" style="margin:0; transform: scale(0.8);">
                            <input type="checkbox" class="bulk-input-field" data-type="toggle" ${isChecked}>
                            <span class="slider round"></span>
                        </label>
                    </td>`;
            } else if (currentConfig.id === 'Racks' && f.label === 'Shelf Name') {
                // Shelf name bulk mein read-only hi rahega taaki galti se shelf mix na ho jaye
                tr.innerHTML += `<td><input type="text" class="bulk-input bulk-input-field" value="${val}" readonly style="margin-bottom:0; background:#f3f4f6; cursor:not-allowed;"></td>`;
            } else {
                let safeVal = val.toString().replace(/"/g, '&quot;');
                tr.innerHTML += `<td><input type="text" class="bulk-input bulk-input-field" value="${safeVal}" style="margin-bottom:0;"></td>`;
            }
        });
        tbody.appendChild(tr);
    });

    document.getElementById('setupBulkModal').classList.add('show');
}

window.closeSetupBulkUpdateModal = function() { document.getElementById('setupBulkModal').classList.remove('show'); }

window.saveSetupBulkUpdate = async function() {
    const btn = document.getElementById('btnSaveBulkSetup');
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;
    btn.disabled = true;

    const rows = document.querySelectorAll('.bulk-setup-row');
    const updatedData = [];

    rows.forEach(row => {
        let id = row.querySelector('.bulk-id').value;
        let inputs = row.querySelectorAll('.bulk-input-field');
        let rowData = [];
        inputs.forEach(input => {
            if (input.dataset.type === 'toggle') {
                rowData.push(input.checked ? "Yes" : "No");
            } else {
                rowData.push(input.value.trim());
            }
        });
        updatedData.push({ id: id, rowData: rowData });
    });

    try {
        await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({
                action: "bulk_update_master",
                masterSheet: currentConfig.sheet,
                updates: updatedData
            }),
            headers: { "Content-Type": "text/plain;charset=utf-8" }
        });
        closeSetupBulkUpdateModal();
        fetchAllSetupData();
    } catch(err) {
        alert("Bulk update failed!");
    } finally {
        btn.innerText = "Save All Changes";
        btn.disabled = false;
    }
}

window.deleteRecord = async function(sheetName, recordId) {
    document.querySelectorAll('.action-menu').forEach(m => m.classList.remove('show'));
    if(confirm("Are you sure you want to permanently delete this record?")) {
        try {
            await fetch(API_URL, {
                method: "POST", body: JSON.stringify({ action: "delete_master_record", masterSheet: sheetName, recordId: recordId }), headers: { "Content-Type": "text/plain;charset=utf-8" }
            });
            fetchAllSetupData();
        } catch(err) { alert("Delete failed!"); }
    }
}

window.exportSetupData = function() {
    let sheetData = allMasterData[currentConfig.sheet] || [];
    if(sheetData.length === 0) { alert("No data to export!"); return; }
    
    let csvData = currentConfig.fields.map(f => `"${f.label}"`).join(",") + "\n";
    sheetData.forEach(row => {
        let rowArray = currentConfig.fields.map(f => `"${String(row[f.label] || row[f.name] || "").replace(/"/g, '""')}"`);
        csvData += rowArray.join(",") + "\n";
    });

    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${currentConfig.sheet}_Export.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

initSidebar();
selectTab('Subjects'); 
fetchAllSetupData();