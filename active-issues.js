// 🔴 YAHAN APNA SAME API URL DAALNA
const API_URL = "https://script.google.com/macros/s/AKfycbyE1U8-EgBh-pQHzHM9MtkzBAmzhdYTuqixpOY0i6dbLoTh7-jHsr7xPLccIrOH35Ye/exec";

const tableBody = document.getElementById("activeIssuesTableBody");
const searchInput = document.getElementById("liveSearch");

let allActiveIssues = [];
const FINE_PER_DAY = 5; // Ek din late hone ka fine (Change kar sakta hai)

// 1. Data Fetch Karna
async function fetchActiveIssues() {
    tableBody.innerHTML = `<tr><td colspan="6"><div class="spinner-container"><div class="spinner"></div><p>Fetching live records...</p></div></td></tr>`;
    
    try {
        const res = await fetch(API_URL + "?sheet=Issued");
        const issuedData = await res.json();
        
        // Sirf wo records nikalne hain jinka status 'Issued' hai (matlab abhi wapas nahi aayi)
        allActiveIssues = issuedData.filter(record => String(record.status).toLowerCase() === "issued");
        
        // Latest wale upar dikhane ke liye
        allActiveIssues.reverse(); 
        
        renderTable();
    } catch(err) {
        tableBody.innerHTML = `<tr><td colspan="6" style="color:red; text-align:center; font-weight:bold;">Failed to connect to server. Check API URL.</td></tr>`;
    }
}

// 2. Date aur Fine Calculate Karna
function calculateFine(dueDateStr) {
    if (!dueDateStr) return { days: 0, fine: 0 };
    
    // Backend se date YYYY-MM-DD format me aati hai
    let parts = dueDateStr.split('-');
    if(parts.length !== 3) return { days: 0, fine: 0 };
    
    let dueDate = new Date(parts[0], parts[1] - 1, parts[2]);
    dueDate.setHours(0,0,0,0);
    
    let today = new Date();
    today.setHours(0,0,0,0);
    
    // Dono dates ka difference nikalna (in milliseconds)
    let diffTime = today.getTime() - dueDate.getTime();
    let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 0) {
        return { days: diffDays, fine: diffDays * FINE_PER_DAY };
    }
    return { days: 0, fine: 0 };
}

// 3. Table UI Render Karna
window.renderTable = function() {
    tableBody.innerHTML = "";
    let searchTerm = searchInput.value.toLowerCase();
    
    let displayRecords = allActiveIssues;
    if (searchTerm) {
        displayRecords = displayRecords.filter(r => 
            String(r.memberId).toLowerCase().includes(searchTerm) || 
            String(r.memberName).toLowerCase().includes(searchTerm) ||
            String(r.bookId).toLowerCase().includes(searchTerm)
        );
    }

    if (displayRecords.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#777; padding: 25px;">No active issued books found.</td></tr>';
        return;
    }

    displayRecords.forEach(record => {
        // Date ko India format (DD-MM-YYYY) me dikhana
        let issueDateFormatted = record.issueDate ? record.issueDate.split('-').reverse().join('-') : "--";
        let dueDateFormatted = record.dueDate ? record.dueDate.split('-').reverse().join('-') : "--";
        
        // Fine Calculate karna aaj ki date ke hisaab se
        let overdueInfo = calculateFine(record.dueDate);
        
        let statusBadge = `<span class="badge-safe"><i class="fa-solid fa-clock"></i> On Time</span>`;
        let fineHtml = `<span style="color: #95a5a6; font-weight:bold;">₹ 0</span>`;
        let rowStyle = "";

        // Agar book late hai toh usko highlight karo
        if (overdueInfo.days > 0) {
            statusBadge = `<span class="badge-danger"><i class="fa-solid fa-circle-exclamation"></i> Overdue (${overdueInfo.days} Days)</span>`;
            fineHtml = `<span style="color: #e74c3c; font-weight:bold; font-size:1.1rem;">₹ ${overdueInfo.fine}</span>`;
            rowStyle = "background-color: #fff9f9;"; // Halka laal background
        }

        tableBody.innerHTML += `
            <tr style="${rowStyle}">
                <td>
                    <strong>${record.memberId}</strong><br>
                    <span style="font-size:0.85rem; color:#555;">${record.memberName}</span>
                </td>
                <td><strong>${record.bookId}</strong></td>
                <td>${issueDateFormatted}</td>
                <td style="font-weight:bold; color:#2c3e50;">${dueDateFormatted}</td>
                <td>${fineHtml}</td>
                <td>${statusBadge}</td>
            </tr>
        `;
    });
}

// Page load hote hi data fetch karlo
fetchActiveIssues();