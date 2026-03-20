const API_URL = "https://script.google.com/macros/s/AKfycbyE1U8-EgBh-pQHzHM9MtkzBAmzhdYTuqixpOY0i6dbLoTh7-jHsr7xPLccIrOH35Ye/exec";

const summaryBody = document.getElementById("attendanceSummaryBody");
const liveDeskTableBody = document.getElementById("liveDeskTableBody");
const historyView = document.getElementById("historyView");
const liveDeskView = document.getElementById("liveDeskView");
const datePromptModal = document.getElementById("datePromptModal");
const promptDateInput = document.getElementById("promptDateInput");

let globalMembersList = [];
let targetDateLogs = []; 
let currentLiveDateStr = ""; 

function formatToIndiaDate(isoString) { 
    if(!isoString) return "";
    const parts = isoString.split('-');
    return `${parts[2]}-${parts[1]}-${parts[0]}`; 
}

function cleanTimeFormat(timeString) {
    if (!timeString || String(timeString).trim() === "" || String(timeString).trim() === "'" || timeString === "--") return "--";
    let str = String(timeString).replace(/^'/, ''); 
    if (str.includes("1899") || str.includes("T")) {
        try {
            let d = new Date(str);
            return d.toLocaleTimeString('en-IN', { hour12: true, hour: '2-digit', minute: '2-digit' });
        } catch(e) { return str; }
    }
    return str;
}

async function safeFetchJSON(bodyData) {
    try {
        const res = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify(bodyData),
            headers: { "Content-Type": "text/plain;charset=utf-8" }
        });
        const textData = await res.text();
        if (textData.includes("<!DOCTYPE") || textData.includes("<html")) {
            throw new Error("Google Apps Script HTML Error. Check API URL.");
        }
        return JSON.parse(textData);
    } catch (e) {
        throw new Error(e.message);
    }
}

async function safeFetchText(bodyData) {
    const res = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify(bodyData),
        headers: { "Content-Type": "text/plain;charset=utf-8" }
    });
    return await res.text();
}

async function initializeAttendancePage() {
    try {
        let mData = sessionStorage.getItem("cache_Members");
        if(mData) { globalMembersList = JSON.parse(mData); } 
        else {
            const res = await fetch(API_URL + "?sheet=Members");
            globalMembersList = await res.json();
            sessionStorage.setItem("cache_Members", JSON.stringify(globalMembersList));
        }
    } catch(err) { console.error("Cache load failed"); }
    await fetchAttendanceSummary(); 
}

async function fetchAttendanceSummary() {
    summaryBody.innerHTML = `<tr><td colspan="3"><div class="spinner-container"><div class="spinner"></div><p>Syncing summary...</p></div></td></tr>`;
    try {
        const summaryData = await safeFetchJSON({ action: "get_attendance_summary" });
        renderSummaryTable(summaryData);
    } catch (err) {
        summaryBody.innerHTML = `<tr><td colspan="3" style="color:red; text-align:center; font-weight:bold;">Error: ${err.message}</td></tr>`;
    }
}

function renderSummaryTable(summaryData) {
    summaryBody.innerHTML = "";
    if (!summaryData || summaryData.length === 0) {
        summaryBody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#777; padding: 25px;">No attendance records found yet. Click Add Attendance to start.</td></tr>';
        return;
    }

    summaryData.forEach(item => {
        summaryBody.innerHTML += `
            <tr>
                <td><strong><i class="fa-regular fa-calendar" style="color:#7f8c8d; margin-right:8px;"></i> ${item.date}</strong></td>
                <td><span style="background:#e3f2fd; color:#1565c0; padding:4px 10px; border-radius:12px; font-weight:bold;">${item.totalPresent} Members</span></td>
                <td>
                    <button class="btn-edit" onclick="openLiveDeskForDate('${item.date}')">
                        <i class="fa-solid fa-pencil"></i> Edit
                    </button>
                    <button class="btn-delete" onclick="deleteAttendanceDate('${item.date}')">
                        <i class="fa-solid fa-trash-can"></i> Delete
                    </button>
                </td>
            </tr>
        `;
    });
}

window.deleteAttendanceDate = async function(dateStr) {
    if(confirm(`Are you sure you want to completely DELETE all attendance records for ${dateStr}?`)) {
        try {
            const actionText = await safeFetchText({ action: "delete_attendance_date", date: dateStr });
            if(actionText.includes("Error")) alert(actionText);
            fetchAttendanceSummary(); 
        } catch(e) {
            alert("Delete failed! Exact Error: " + e.message);
        }
    }
}

window.openDatePromptModal = function() {
    promptDateInput.valueAsDate = new Date(); 
    datePromptModal.classList.add("show");
}
window.closeDatePromptModal = function() { datePromptModal.classList.remove("show"); }

// 🟢 FIX: YAHAN THI MERI GALTI! AB YE EKDUM SAHI HAI 🟢
window.proceedToLiveDesk = async function() {
    const isoDate = promptDateInput.value;
    if(!isoDate) { alert("Please select a date first."); return; }
    
    currentLiveDateStr = formatToIndiaDate(isoDate);
    const proceedBtn = document.getElementById("proceedBtn");
    proceedBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Checking...`;
    proceedBtn.disabled = true;
    
    try {
        targetDateLogs = await safeFetchJSON({ action: "get_attendance_by_date", date: currentLiveDateStr });
        
        if (targetDateLogs.length > 0) {
            let userConfirms = confirm(`⚠️ ATTENTION ⚠️\n\nAttendance is already marked for ${currentLiveDateStr}.\n\nClick 'OK' if you want to View or Edit the existing records.`);
            if (!userConfirms) {
                proceedBtn.innerHTML = `<i class="fa-solid fa-arrow-right-to-bracket"></i> Proceed to Desk`;
                proceedBtn.disabled = false;
                return; 
            }
        }
        
        closeDatePromptModal();
        // 🔴 Yahan pehle 'toggleView' tha jo error de raha tha. Maine use theek karke sahi function laga diya hai:
        openLiveDeskForDate(currentLiveDateStr);

    } catch(e) { 
        alert("❌ JAVASCRIPT/SERVER ERROR ❌\n\nExact Reason:\n" + e.message);
    } finally {
        proceedBtn.innerHTML = `<i class="fa-solid fa-arrow-right-to-bracket"></i> Proceed to Desk`;
        proceedBtn.disabled = false;
    }
}

window.openLiveDeskForDate = async function(dateStr) {
    currentLiveDateStr = dateStr;
    document.getElementById("displayLiveDate").innerText = currentLiveDateStr;
    
    historyView.style.display = "none";
    liveDeskView.style.display = "block";
    document.getElementById("pageTitle").innerHTML = `<i class="fa-solid fa-user-check" style="color: #2ecc71;"></i> Live Attendance Desk`;
    document.getElementById("pageSubtitle").innerText = "Mark IN and OUT for members.";
    document.getElementById("headerButtons").innerHTML = `<button class="btn btn-secondary" onclick="backToSummary()" style="background-color: #7f8c8d; color:white; border: none;"><i class="fa-solid fa-arrow-left"></i> Back to Summary</button>`;
        
    liveDeskTableBody.innerHTML = `<tr><td colspan="5"><div class="spinner-container"><div class="spinner"></div><p>Loading members for this date...</p></div></td></tr>`;
    
    try {
        targetDateLogs = await safeFetchJSON({ action: "get_attendance_by_date", date: currentLiveDateStr });
        renderLiveDesk();
    } catch(e) { 
        liveDeskTableBody.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center; font-weight:bold;">Error: ${e.message}</td></tr>`; 
    }
}

window.backToSummary = function() {
    liveDeskView.style.display = "none";
    historyView.style.display = "block";
    document.getElementById("pageTitle").innerHTML = `<i class="fa-solid fa-clipboard-user" style="color: #3498db;"></i> Attendance Records`;
    document.getElementById("pageSubtitle").innerText = "Date-wise summary of member attendance";
    document.getElementById("headerButtons").innerHTML = `<button class="btn btn-primary" onclick="openDatePromptModal()" style="background-color: #3498db; border: none;"><i class="fa-solid fa-user-check"></i> ADD ATTENDANCE</button>`;
    fetchAttendanceSummary(); 
}

window.renderLiveDesk = function() {
    liveDeskTableBody.innerHTML = "";
    const searchTerm = document.getElementById("liveSearch").value.toLowerCase();
    
    const todayStr = formatToIndiaDate(new Date().toISOString().split('T')[0]);
    const isPastDate = currentLiveDateStr !== todayStr;

    let displayMembers = globalMembersList;
    if (searchTerm) {
        displayMembers = displayMembers.filter(m => String(m.id).toLowerCase().includes(searchTerm) || String(m.name).toLowerCase().includes(searchTerm));
    }

    if (displayMembers.length === 0) {
        liveDeskTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#777;">No members found.</td></tr>';
        return;
    }

    displayMembers.forEach(member => {
        let memberLogs = targetDateLogs.filter(log => String(log.memberId) === String(member.id));
        let isPresent = memberLogs.length > 0;
        let isActive = false; 
        
        if (isPresent) {
            let lastLog = memberLogs[0]; 
            let safeExit = cleanTimeFormat(lastLog.exitTime);
            let properlyOut = safeExit && safeExit !== "--";
            
            if (!properlyOut) {
                if (isPastDate) {
                    isActive = false; 
                } else {
                    isActive = true;  
                }
            }
        }

        let statusHtml = `<span class="badge-absent">Absent</span>`;
        if (isPresent) {
            if (isActive) {
                statusHtml = `<span class="badge-present-active">Present (Inside)</span>`;
            } else if (isPastDate && memberLogs[0] && cleanTimeFormat(memberLogs[0].exitTime) === "--") {
                statusHtml = `<span class="badge-present-left" style="background:#fdebd0; color:#d35400; border-color:#f8c471;">Auto-Out (System)</span>`;
            } else {
                statusHtml = `<span class="badge-present-left">Present (Left)</span>`;
            }
        }

        let disableIn = isActive ? "disabled" : "";
        let disableOut = !isActive ? "disabled" : "";
        
        if (isPastDate && statusHtml.includes("Auto-Out")) {
            disableOut = "disabled";
        }

        liveDeskTableBody.innerHTML += `
            <tr style="${isActive ? 'background-color:#f4fcff;' : ''}">
                <td><strong>${member.id}</strong></td>
                <td>${member.name}</td>
                <td><span style="font-size:0.8rem; background:#eee; padding:2px 8px; border-radius:10px;">${member.type}</span></td>
                <td>${statusHtml}</td>
                <td>
                    <button class="btn-in" ${disableIn} onclick="markExplicitAttendance('${member.id}', 'IN', this)">IN</button>
                    <button class="btn-out" ${disableOut} onclick="markExplicitAttendance('${member.id}', 'OUT', this)">OUT</button>
                </td>
            </tr>
        `;
    });
}

window.markExplicitAttendance = async function(memberId, actionType, btnElement) {
    const originalText = btnElement.innerText;
    btnElement.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
    btnElement.disabled = true;

    try {
        const actionText = await safeFetchText({ 
            action: "mark_attendance", 
            memberId: memberId, 
            actionType: actionType, 
            targetDate: currentLiveDateStr 
        });
        
        if(actionText.includes("Error")) { alert(actionText); }
        
        targetDateLogs = await safeFetchJSON({ action: "get_attendance_by_date", date: currentLiveDateStr });
        renderLiveDesk();

    } catch(err) {
        alert("Action failed.\nExact Error: " + err.message);
        btnElement.innerHTML = originalText;
        btnElement.disabled = false;
    }
}

initializeAttendancePage();