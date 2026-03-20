const API_URL = "https://script.google.com/macros/s/AKfycbyE1U8-EgBh-pQHzHM9MtkzBAmzhdYTuqixpOY0i6dbLoTh7-jHsr7xPLccIrOH35Ye/exec";

let globalBooksList = [];
let issuedBooksList = [];
let globalMembersList = [];

const dashboardLoader = document.getElementById('dashboardLoader');
const dashboardContent = document.getElementById('dashboardContent');

let inventoryChartInstance = null;
let memberChartInstance = null;
let popularBooksChartInstance = null;

async function fetchDashboardData() {
    dashboardLoader.style.display = 'block';
    dashboardContent.style.display = 'none';

    try {
        // 🔥 SMART CACHE CHECK
        let bData = sessionStorage.getItem('cache_Books');
        let iData = sessionStorage.getItem('cache_Issued');
        let mData = sessionStorage.getItem('cache_Members');

        if (bData && iData && mData) {
            globalBooksList = JSON.parse(bData);
            issuedBooksList = JSON.parse(iData);
            globalMembersList = JSON.parse(mData);
        } else {
            const [booksRes, issuedRes, membersRes] = await Promise.all([
                fetch(API_URL),
                fetch(API_URL + "?sheet=Issued"),
                fetch(API_URL + "?sheet=Members")
            ]);
            globalBooksList = await booksRes.json();
            issuedBooksList = await issuedRes.json();
            globalMembersList = await membersRes.json();
            
            // Save to Cache
            sessionStorage.setItem('cache_Books', JSON.stringify(globalBooksList));
            sessionStorage.setItem('cache_Issued', JSON.stringify(issuedBooksList));
            sessionStorage.setItem('cache_Members', JSON.stringify(globalMembersList));
        }

        calculateAndRenderKPIs();
        renderCharts();
        renderRecentActivity();

        dashboardLoader.style.display = 'none';
        dashboardContent.style.display = 'block';

        const now = new Date();
        document.getElementById('lastUpdatedText').innerText = `Live data synced at ${now.toLocaleTimeString()}`;
    } catch (error) {
        console.error("Dashboard Error:", error);
        dashboardLoader.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:#e74c3c; font-size:3rem; margin-bottom:15px;"></i><h3 style="color:#333;">Sync Failed</h3><p style="color:#888;">Could not connect to the library database.</p>`;
    }
}

function calculateAndRenderKPIs() {
    let totalInventory = 0;
    globalBooksList.forEach(book => totalInventory += (parseInt(book.copies) || 1));

    const totalMembers = globalMembersList.length;
    const activeIssues = issuedBooksList.filter(i => i.status === 'Issued');
    const totalIssued = activeIssues.length;

    let overdueCount = 0;
    const today = new Date();
    today.setHours(0,0,0,0);

    activeIssues.forEach(issue => {
        const dueDate = new Date(issue.dueDate);
        if (dueDate < today) overdueCount++;
    });

    document.getElementById('kpiTotalBooks').innerText = totalInventory;
    document.getElementById('kpiTotalMembers').innerText = totalMembers;
    document.getElementById('kpiIssuedBooks').innerText = totalIssued;
    document.getElementById('kpiOverdue').innerText = overdueCount;

    window.chartData = {
        totalInventory: totalInventory,
        totalIssued: totalIssued,
        available: totalInventory - totalIssued
    };
}

function renderCharts() {
    if(inventoryChartInstance) inventoryChartInstance.destroy();
    if(memberChartInstance) memberChartInstance.destroy();
    if(popularBooksChartInstance) popularBooksChartInstance.destroy();

    Chart.defaults.font.family = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
    Chart.defaults.color = '#7f8c8d';

    // 1. INVENTORY HEALTH
    const ctxInv = document.getElementById('inventoryChart').getContext('2d');
    inventoryChartInstance = new Chart(ctxInv, {
        type: 'doughnut',
        data: {
            labels: ['Available', 'Issued'],
            datasets: [{
                data: [window.chartData.available, window.chartData.totalIssued],
                backgroundColor: ['#2ecc71', '#ffb74d'],
                borderWidth: 0, hoverOffset: 5
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '75%',
            plugins: { legend: { position: 'bottom', labels: { padding: 20, usePointStyle: true } } }
        }
    });

    // 2. MEMBER DEMOGRAPHICS
    let stuCount = 0, empCount = 0, gstCount = 0;
    globalMembersList.forEach(m => {
        if(m.type === 'Student') stuCount++;
        else if(m.type === 'Employee') empCount++;
        else gstCount++;
    });

    const ctxMem = document.getElementById('memberChart').getContext('2d');
    memberChartInstance = new Chart(ctxMem, {
        type: 'pie',
        data: {
            labels: ['Students', 'Staff/Emp', 'Guests'],
            datasets: [{
                data: [stuCount, empCount, gstCount],
                backgroundColor: ['#3498db', '#9b59b6', '#95a5a6'],
                borderWidth: 0, hoverOffset: 5
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'right', labels: { padding: 15, usePointStyle: true } } }
        }
    });

    // 3. MOST POPULAR BOOKS
    const bookDemand = {};
    issuedBooksList.forEach(issue => {
        bookDemand[issue.bookId] = (bookDemand[issue.bookId] || 0) + 1;
    });

    const topBooks = Object.keys(bookDemand).map(id => {
        const bookDetails = globalBooksList.find(b => b.id === id);
        return { id: id, title: bookDetails ? bookDetails.title : id, count: bookDemand[id] };
    }).sort((a, b) => b.count - a.count).slice(0, 5);

    const labels = topBooks.map(b => b.title.length > 20 ? b.title.substring(0, 20) + '...' : b.title);
    const data = topBooks.map(b => b.count);

    const ctxPop = document.getElementById('popularBooksChart').getContext('2d');
    if(topBooks.length === 0) { labels.push("No data yet"); data.push(0); }

    popularBooksChartInstance = new Chart(ctxPop, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Times Issued', data: data,
                backgroundColor: 'rgba(52, 152, 219, 0.7)', borderColor: '#3498db', borderWidth: 1, borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { beginAtZero: true, ticks: { precision: 0 } }, y: { grid: { display: false } } }
        }
    });
}

function renderRecentActivity() {
    const tbody = document.getElementById('recentActivityTable');
    tbody.innerHTML = '';

    if (issuedBooksList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px; color:#888;">No transactions recorded yet.</td></tr>';
        return;
    }

    const recentTxns = [...issuedBooksList].reverse().slice(0, 6);

    recentTxns.forEach(txn => {
        const isIssue = txn.status === 'Issued';
        const badge = isIssue ? `<span class="status-pill pill-active">Issued</span>` : `<span class="status-pill pill-returned">Returned</span>`;
        const date = isIssue ? txn.issueDate : txn.returnDate;

        tbody.innerHTML += `
            <tr>
                <td><strong style="color:#2c3e50;">${txn.txnId}</strong></td>
                <td>
                    <div style="font-weight:600; color:#333;">${txn.memberName}</div>
                    <div style="font-size:0.8rem; color:#888;">${txn.memberId}</div>
                </td>
                <td><span style="background:#f8f9fa; padding:4px 8px; border-radius:4px; border:1px solid #eee;">${txn.bookId}</span></td>
                <td>${badge}</td>
                <td>${date}</td>
            </tr>
        `;
    });
}

fetchDashboardData();