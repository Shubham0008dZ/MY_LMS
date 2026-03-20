const API_URL = "https://script.google.com/macros/s/AKfycbyE1U8-EgBh-pQHzHM9MtkzBAmzhdYTuqixpOY0i6dbLoTh7-jHsr7xPLccIrOH35Ye/exec";

const issueForm = document.getElementById("issueForm");
const returnForm = document.getElementById("returnForm");
const bookSelect = document.getElementById("bookSelect");
const memberSelect = document.getElementById("memberSelect");
const issuedTableBody = document.getElementById("issuedTableBody");
const returnModal = document.getElementById("returnModal");
const historyTitle = document.getElementById("historyTitle");
const paymentHistoryModal = document.getElementById("paymentHistoryModal");
const paymentCollectionModal = document.getElementById("paymentCollectionModal");
const paymentCollectionForm = document.getElementById("paymentCollectionForm");

const emailModal = document.getElementById("emailModal");
const emailForm = document.getElementById("emailForm");

let globalBooksList = [];
let issuedBooksList = [];
let globalMembersList = [];

function setupDefaults() {
  const today = new Date();
  document.getElementById("issueDate").valueAsDate = today;
  const dueDate = new Date();
  dueDate.setDate(today.getDate() + 7);
  document.getElementById("dueDate").valueAsDate = dueDate;
  document.getElementById("txnId").value = "TXN-" + Date.now();
}

async function loadAllData() {
  bookSelect.innerHTML = '<option value="">Loading...</option>';
  memberSelect.innerHTML = '<option value="">Loading...</option>';
  issuedTableBody.innerHTML = `<tr><td colspan="6"><div class="spinner-container"><div class="spinner"></div><p>Loading database...</p></div></td></tr>`;
  try {
    let bData = sessionStorage.getItem("cache_Books");
    let iData = sessionStorage.getItem("cache_Issued");
    let mData = sessionStorage.getItem("cache_Members");
    if (bData && iData && mData) {
      globalBooksList = JSON.parse(bData);
      issuedBooksList = JSON.parse(iData);
      globalMembersList = JSON.parse(mData);
    } else {
      const [booksRes, issuedRes, membersRes] = await Promise.all([
        fetch(API_URL),
        fetch(API_URL + "?sheet=Issued"),
        fetch(API_URL + "?sheet=Members"),
      ]);
      globalBooksList = await booksRes.json();
      issuedBooksList = await issuedRes.json();
      globalMembersList = await membersRes.json();

      sessionStorage.setItem("cache_Books", JSON.stringify(globalBooksList));
      sessionStorage.setItem("cache_Issued", JSON.stringify(issuedBooksList));
      sessionStorage.setItem("cache_Members", JSON.stringify(globalMembersList));
    }

    populateDropdowns();
    const currentSelectedMember = memberSelect.value;
    renderIssuedBooks(currentSelectedMember);
    setupDefaults();
  } catch (error) {
    issuedTableBody.innerHTML = '<tr><td colspan="6" class="empty-msg" style="color:red;">Database connection failed.</td></tr>';
  }
}

function populateDropdowns() {
  bookSelect.innerHTML = '<option value="">-- Choose Book --</option>';
  const activeIssuedBookIds = issuedBooksList.filter((i) => i.status === "Issued").map((i) => i.bookId);
  const availableBooks = globalBooksList.filter((b) => !activeIssuedBookIds.includes(b.id));
  availableBooks.forEach((book) => {
    bookSelect.innerHTML += `<option value="${book.id}">${book.id} - ${book.title}</option>`;
  });
  
  const currentSelection = memberSelect.value;
  memberSelect.innerHTML = '<option value="">-- Select a Member --</option>';
  globalMembersList.forEach((member) => {
    memberSelect.innerHTML += `<option value="${member.id}">${member.id} - ${member.name} (${member.type})</option>`;
  });
  if (currentSelection) memberSelect.value = currentSelection;

  $(bookSelect).select2({ placeholder: "-- Choose Book --", width: "100%" });
  $(memberSelect).select2({ placeholder: "-- Select a Member --", width: "100%" });
  
  $(memberSelect).on("select2:select", function (e) {
    autoFillMemberName();
  });
}

// 🟢 EXPIRY & ACTION HUB LOGIC 🟢
window.autoFillMemberName = function () {
  const selectedMemberId = memberSelect.value;
  const member = globalMembersList.find((m) => m.id === selectedMemberId);
  const fineContainer = document.getElementById("fineAlertContainer");
  const fineBody = document.getElementById("fineDetailsBody");
  const submitBtn = issueForm.querySelector('button[type="submit"]');
  const btnHistory = document.getElementById("btnPaymentHistory");

  fineContainer.style.display = "none";
  if (btnHistory) btnHistory.style.display = "none";
  submitBtn.disabled = false;
  submitBtn.style.background = "";
  submitBtn.style.borderColor = "";
  submitBtn.innerText = "Issue Book";
  
  if (member) {
    document.getElementById("memberName").value = member.name;
    if (btnHistory) btnHistory.style.display = "block";
    renderIssuedBooks(selectedMemberId);
    
    const unpaidRecords = issuedBooksList.filter((i) => i.memberId === selectedMemberId && i.paymentStatus === "Unpaid");
    window.currentUnpaidRecords = unpaidRecords;

    const today = new Date();
    today.setHours(0,0,0,0);
    let isExpired = false;
    
    if (member.ExpiryDate) {
        let expDate = new Date(member.ExpiryDate);
        let diffTime = expDate - today;
        let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays < 0) {
            isExpired = true;
        }
    }

    let totalFine = 0;
    let fineHTML = '';
    
    if (unpaidRecords.length > 0) {
      fineHTML = `
        <table style="width:100%; font-size:0.85rem; background:#fff; border:1px solid #ffcdd2; border-collapse: collapse; text-align: left;">
            <tr style="background:#ffcdd2; color:#b71c1c;">
                <th style="padding:6px; border:1px solid #ef9a9a;">Book ID</th>
                <th style="padding:6px; border:1px solid #ef9a9a;">Issue Date</th>
                <th style="padding:6px; border:1px solid #ef9a9a;">Return Date</th>
                <th style="padding:6px; border:1px solid #ef9a9a;">Late By</th>
                <th style="padding:6px; border:1px solid #ef9a9a; text-align:right;">Amount</th>
            </tr>`;
      unpaidRecords.forEach((record) => {
        const amt = parseInt(record.fineAmount) || 0;
        totalFine += amt;
        fineHTML += `<tr>
            <td style="padding:6px; border:1px solid #ef9a9a;">${record.bookId}</td>
            <td style="padding:6px; border:1px solid #ef9a9a;">${record.issueDate || "N/A"}</td>
            <td style="padding:6px; border:1px solid #ef9a9a;">${record.returnDate || "N/A"}</td>
            <td style="padding:6px; border:1px solid #ef9a9a;">${record.daysOverdue || 0} Days</td>
            <td style="padding:6px; border:1px solid #ef9a9a; font-weight:bold; color:#c62828; text-align:right;">₹${amt}</td>
        </tr>`;
      });
      fineHTML += `
            <tr style="background:#ffebee; color:#b71c1c;">
                <td colspan="4" style="padding:8px 6px; border:1px solid #ef9a9a; text-align:right; font-weight:bold; text-transform:uppercase;">Total Unpaid Amount:</td>
                <td style="padding:8px 6px; border:1px solid #ef9a9a; font-weight:bold; font-size:1.1rem; text-align:right;">₹${totalFine}</td>
            </tr>
        </table>`;
    }

    // --- SMART BUTTONS (Always Show Email Button Now) ---
    const emailBtnHtml = `<button type="button" onclick="openEmailModal('${member.id}', 'fine', ${totalFine})" class="btn btn-primary" style="background-color: #3498db; border: none;"><i class="fa-solid fa-envelope"></i> Communicate</button>`;
    const membershipInfoBtnHtml = `<button type="button" onclick="openMembershipInfoModal('${member.id}')" class="btn btn-info" style="background-color: #8e44ad; color: white; border: none;"><i class="fa-solid fa-id-card"></i> Membership Info</button>`;

    let actionButtons = `
        <div style="margin-top: 15px; display: flex; justify-content: flex-end; align-items: center; flex-wrap: wrap; gap: 10px;">
            ${membershipInfoBtnHtml}
            ${emailBtnHtml}
            <button type="button" onclick="openPaymentCollectionModal('${selectedMemberId}', ${totalFine})" class="btn btn-success" style="background-color: #2ecc71; border: none; ${totalFine === 0 ? 'opacity: 0.5; pointer-events: none;' : ''}">
                <i class="fa-solid fa-money-bill-wave"></i> Collect Payment
            </button>
        </div>`;

    fineContainer.style.display = "block";
    fineContainer.style.background = unpaidRecords.length > 0 ? "#ffebee" : "#f8f9fa";
    fineContainer.style.borderLeft = unpaidRecords.length > 0 ? "4px solid #f44336" : "4px solid #3498db";
    
    let alertTitle = fineContainer.querySelector('h4');
    if (alertTitle) {
        if (unpaidRecords.length > 0) {
            alertTitle.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Unpaid Dues Alert`;
            alertTitle.style.color = "#d32f2f";
        } else {
            alertTitle.innerHTML = `<i class="fa-solid fa-user-check"></i> Member Hub Actions`;
            alertTitle.style.color = "#2c3e50";
        }
    }

    fineBody.innerHTML = (fineHTML ? fineHTML : '') + actionButtons;

    if (isExpired) {
        fineBody.innerHTML += `<div style="margin-top:12px; background:#c62828; color:white; padding:10px; border-radius:4px; font-weight:bold; text-align:center;">
            <i class="fa-solid fa-ban"></i> Issue Blocked: Membership Expired. Please renew from 'Manage Members' tab.
        </div>`;
        submitBtn.disabled = true;
        submitBtn.style.background = "#e53935";
        submitBtn.style.borderColor = "#e53935";
        submitBtn.innerText = "Blocked - Membership Expired";
    } 
    else if (totalFine > 500) {
        fineBody.innerHTML += `<div style="margin-top:12px; background:#c62828; color:white; padding:10px; border-radius:4px; font-weight:bold; text-align:center;">
            <i class="fa-solid fa-ban"></i> Issue Blocked: Pending fine exceeds ₹500 limit. Please clear dues first.
        </div>`;
        submitBtn.disabled = true;
        submitBtn.style.background = "#e53935";
        submitBtn.style.borderColor = "#e53935";
        submitBtn.innerText = "Blocked - Clear Dues";
    }

  } else {
    document.getElementById("memberName").value = "";
    renderIssuedBooks("");
  }
};

window.openPaymentCollectionModal = function (memberId, totalDue) {
  document.getElementById("payMemberId").value = memberId;
  document.getElementById("payTotalDue").value = totalDue;
  document.getElementById("payAmountNow").value = totalDue;
  document.getElementById("payAmountNow").max = totalDue;
  if (document.getElementById("payDate")) {
    document.getElementById("payDate").valueAsDate = new Date();
  }
  document.getElementById("payBalance").value = 0;
  paymentCollectionModal.classList.add("show");
};

window.closePaymentCollectionModal = function () { paymentCollectionModal.classList.remove("show"); };

window.calculateBalance = function () {
  const totalDue = parseInt(document.getElementById("payTotalDue").value) || 0;
  let payingNow = parseInt(document.getElementById("payAmountNow").value) || 0;
  if (payingNow > totalDue) { payingNow = totalDue; document.getElementById("payAmountNow").value = totalDue; } 
  else if (payingNow < 0) { payingNow = 0; document.getElementById("payAmountNow").value = 0; }
  document.getElementById("payBalance").value = totalDue - payingNow;
};

paymentCollectionForm.addEventListener("submit", async function (e) {
  e.preventDefault();
  const btn = paymentCollectionForm.querySelector('button[type="submit"]');
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
  btn.disabled = true;

  const memberId = document.getElementById("payMemberId").value;
  const amountPaid = document.getElementById("payAmountNow").value;
  const payDate = document.getElementById("payDate") ? document.getElementById("payDate").value : "";

  try {
    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "pay_partial_fines", sheet: "Issued", memberId: memberId, amountPaid: amountPaid, payDate: payDate }),
    });
    alert(`₹${amountPaid} collected successfully!`);
    sessionStorage.removeItem("cache_Issued");
    closePaymentCollectionModal();
    await loadAllData();
    autoFillMemberName();
  } catch (e) {
    alert("Failed to process payment. Please try again.");
  } finally {
    btn.innerHTML = '<i class="fa-solid fa-check-circle"></i> Confirm Payment';
    btn.disabled = false;
  }
});

window.showPaymentHistory = function () {
  const memberId = memberSelect.value;
  const historyBody = document.getElementById("paymentHistoryBody");
  historyBody.innerHTML = "";

  const fineRecords = issuedBooksList.filter((i) => i.memberId === memberId && (parseInt(i.fineAmount) > 0 || (i.remarks && String(i.remarks).includes("Paid:"))));
  
  if (fineRecords.length === 0) {
    historyBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px; color: #666;">No payment history found for this member.</td></tr>';
  } else {
    let overallCollected = 0;
    let currentUnpaid = 0;

    fineRecords.forEach((r) => {
      currentUnpaid += parseInt(r.fineAmount) || 0;
      let remarksText = String(r.remarks || "");
      let matches = remarksText.match(/Paid:\s*₹(\d+)/g);
      if (matches) { matches.forEach((m) => { overallCollected += parseInt(m.replace(/[^\d]/g, "")) || 0; }); }
    });
  
    let totalGeneratedFine = currentUnpaid + overallCollected;

    historyBody.innerHTML += `
            <tr style="background: #e3f2fd; color: #1565c0; font-weight: bold; font-size: 0.95rem;">
                <td colspan="5" style="padding: 12px; border-bottom: 2px solid #bbdefb; text-align: center;">
                    <span style="margin-right: 20px;"><i class="fa-solid fa-file-invoice"></i> Total Fine: ₹${totalGeneratedFine}</span>
                    <span style="margin-right: 20px; color: #2e7d32;"><i class="fa-solid fa-hand-holding-dollar"></i> Collected: ₹${overallCollected}</span>
                    <span style="color: #c62828;"><i class="fa-solid fa-circle-exclamation"></i> Current Due: ₹${currentUnpaid}</span>
                </td>
            </tr>
        `;
        
    [...fineRecords].reverse().forEach((record) => {
      let isPaid = record.paymentStatus === "Paid";
      let statusColor = isPaid ? "#2ecc71" : "#e74c3c";
      let paymentLogsHtml = "";
      let remarksText = String(record.remarks || "");

      if (remarksText.includes("Paid:")) {
        let logsArray = remarksText.split("|").filter((log) => log.includes("Paid:"));
        paymentLogsHtml = logsArray.map((log) => `<div style="font-size:0.8rem; color:#27ae60; margin-top:4px; font-weight: 600;"><i class="fa-solid fa-check-circle"></i> ${log.trim()}</div>`).join("");
      }

      historyBody.innerHTML += `
                <tr>
                    <td style="padding:10px; border-bottom:1px solid #eee; color: #555;">${record.txnId}</td>
                    <td style="padding:10px; border-bottom:1px solid #eee; font-weight: 600;">${record.bookId}</td>
                    <td style="padding:10px; border-bottom:1px solid #eee;">${record.daysOverdue} Days</td>
                    <td style="padding:10px; border-bottom:1px solid #eee;">
                        <div style="font-weight:bold; color: #e74c3c;">Current Due: ₹${record.fineAmount || 0}</div>
                        ${paymentLogsHtml}
                    </td>
                    <td style="padding:10px; border-bottom:1px solid #eee; color:${statusColor}; font-weight:bold;">${record.paymentStatus}</td>
                </tr>
            `;
    });
  }
  paymentHistoryModal.classList.add("show");
};

window.closePaymentHistoryModal = function () { paymentHistoryModal.classList.remove("show"); };

function renderIssuedBooks(memberFilter = "") {
  issuedTableBody.innerHTML = "";
  if (!memberFilter) {
    historyTitle.innerText = "Member Library History";
    issuedTableBody.innerHTML = '<tr><td colspan=\"6\" class=\"empty-msg\">Please select a member from the dropdown above to view their history.</td></tr>';
    return;
  }
  const member = globalMembersList.find((m) => m.id === memberFilter);
  historyTitle.innerText = `Library History for: ${member.name} (${member.id})`;
  const displayList = issuedBooksList.filter((i) => i.memberId === memberFilter);
  
  if (displayList.length === 0) {
    issuedTableBody.innerHTML = '<tr><td colspan=\"6\" class=\"empty-msg\">No library records found for this member.</td></tr>';
    return;
  }

  const sortedList = [...displayList].reverse();
  sortedList.forEach((record) => {
    let isReturned = record.status !== "Issued";
    let statusColor = isReturned ? "#2ecc71" : "#ffc107";
    let textColor = isReturned ? "#fff" : "#000";
    let actionHtml = isReturned
      ? `<span style="color: #2ecc71; font-weight: 600;"><i class="fa-solid fa-check"></i> Returned</span>`
      : `<button class="btn btn-primary" onclick="openReturnModal('${record.txnId}', '${record.dueDate}')" style="padding: 5px 10px;">Return</button>`;

    issuedTableBody.innerHTML += `
            <tr>
                <td><small>${record.txnId}</small></td>
                <td><strong>${record.bookId}</strong></td>
                <td>${record.memberName}</td>
                <td>${record.dueDate}</td>
                <td><span style="background:${statusColor}; padding:2px 8px; border-radius:10px; font-size:12px; color:${textColor};">${record.status}</span></td>
                <td>${actionHtml}</td>
            </tr>
        `;
  });
}

issueForm.addEventListener("submit", async function (e) {
  e.preventDefault();
  const submitBtn = issueForm.querySelector('button[type="submit"]');
  const selectedMemberId = memberSelect.value;
  const unpaidRecords = issuedBooksList.filter((i) => i.memberId === selectedMemberId && i.paymentStatus === "Unpaid");
  const totalUnpaid = unpaidRecords.reduce((sum, record) => sum + (parseInt(record.fineAmount) || 0), 0);
  
  if (totalUnpaid > 500) { alert("Action Denied! Member has unpaid fines exceeding ₹500."); return; }

  submitBtn.innerText = "Issuing...";
  submitBtn.disabled = true;
  const bookId = bookSelect.value;
  const selectedBook = globalBooksList.find((b) => b.id === bookId);

  const issueData = {
    action: "add", sheet: "Issued", txnId: document.getElementById("txnId").value, bookId: selectedBook.id, memberId: memberSelect.value,
    memberName: document.getElementById("memberName").value, issueDate: document.getElementById("issueDate").value, dueDate: document.getElementById("dueDate").value, issuedBy: document.getElementById("issuedBy").value.trim(),
  };
  try {
    await fetch(API_URL, { method: "POST", body: JSON.stringify(issueData) });
    sessionStorage.removeItem("cache_Issued");
    document.getElementById("bookSelect").value = "";
    setupDefaults();
    loadAllData();
  } catch (error) { alert("Failed to issue book."); } finally { submitBtn.innerText = "Issue Book"; submitBtn.disabled = false; }
});

// RETURN FORM LOGIC
window.openReturnModal = function (txnId, dueDate) {
  document.getElementById("retTxnId").value = txnId;
  document.getElementById("retDueDate").value = dueDate;
  document.getElementById("retDate").valueAsDate = new Date();
  calculateFine();
  returnModal.classList.add("show");
};

window.closeModal = function () { returnModal.classList.remove("show"); returnForm.reset(); };

window.calculateFine = function () {
  const returnDate = new Date(document.getElementById("retDate").value);
  const dueDate = new Date(document.getElementById("retDueDate").value);
  const diffTime = returnDate - dueDate;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  let overdueDays = 0;
  let fineAmount = 0;
  if (diffDays > 0) { overdueDays = diffDays; fineAmount = overdueDays * 1; document.getElementById("retPayment").value = "Unpaid"; } 
  else { document.getElementById("retPayment").value = "N/A"; }
  document.getElementById("retOverdue").value = overdueDays; document.getElementById("retFine").value = fineAmount;
};

returnForm.addEventListener("submit", async function (e) {
  e.preventDefault();
  const submitBtn = returnForm.querySelector('button[type="submit"]');
  submitBtn.innerText = "Processing..."; submitBtn.disabled = true;
  const returnData = {
    action: "return", sheet: "Issued", txnId: document.getElementById("retTxnId").value, returnDate: document.getElementById("retDate").value,
    daysOverdue: document.getElementById("retOverdue").value, fineAmount: document.getElementById("retFine").value, bookCondition: document.getElementById("retCondition").value,
    paymentStatus: document.getElementById("retPayment").value, remarks: document.getElementById("retRemarks").value,
  };
  try {
    await fetch(API_URL, { method: "POST", body: JSON.stringify(returnData) });
    sessionStorage.removeItem("cache_Issued");
    closeModal();
    loadAllData();
  } catch (error) { alert("Error returning book."); } finally { submitBtn.innerText = "Confirm Return"; submitBtn.disabled = false; }
});

// 🟢 NEW MEMBERSHIP INFO MODAL LOGIC 🟢
window.openMembershipInfoModal = function(memberId) {
    const member = globalMembersList.find(m => String(m.id) === String(memberId));
    if(!member) return;
    
    document.getElementById('infoMemberName').innerText = member.name;
    document.getElementById('infoJoinDate').innerText = member.JoinDate || "N/A";
    document.getElementById('infoExpiryDate').innerText = member.ExpiryDate || "N/A";
    
    const today = new Date();
    today.setHours(0,0,0,0);
    let badgeHtml = `<span style="color: #2ecc71; font-weight: bold;">Lifetime</span>`;
    if(member.ExpiryDate) {
        let expDate = new Date(member.ExpiryDate);
        let diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) { badgeHtml = `<span style="color: #e74c3c; font-weight: bold;">Expired (${Math.abs(diffDays)} Days ago)</span>`; } 
        else if (diffDays <= 15) { badgeHtml = `<span style="color: #f39c12; font-weight: bold;">Expires in ${diffDays} Days</span>`; } 
        else if (diffDays > 10000) { badgeHtml = `<span style="color: #2ecc71; font-weight: bold;">Lifetime</span>`; } 
        else { badgeHtml = `<span style="color: #2ecc71; font-weight: bold;">Active (${diffDays} Days left)</span>`; }
    }
    document.getElementById('infoStatusBadge').innerHTML = badgeHtml;
    
    // Yahan seedha email modal khulwana hai "expiry" type ke saath
    const actionArea = document.querySelector('#membershipInfoModal .modal-box div:last-child');
    actionArea.innerHTML = `
        <button class="btn w-100" onclick="closeMembershipInfoModal(); openEmailModal('${member.id}', 'expiry')" style="background-color: #8e44ad; color: white; border: none; padding: 10px; font-weight: bold; margin-top: 15px;">
            <i class="fa-solid fa-envelope"></i> Send Expiry Reminder Email
        </button>`;
        
    document.getElementById('membershipInfoModal').classList.add('show');
}

window.closeMembershipInfoModal = function() { document.getElementById('membershipInfoModal').classList.remove('show'); }

// 🟢 SMART UNIVERSAL EMAIL LOGIC (FINE + EXPIRY + AUTO-UPDATE) 🟢
let globalFineAmountForEmail = 0;

window.openEmailModal = function (memberId, type, fineAmount = 0) {
    if (!document.getElementById("emailTo")) { alert("Email Modal HTML is missing."); return; }
    
    window.currentEmailMemberId = memberId;
    window.currentEmailType = type;
    const member = globalMembersList.find(m => m.id === memberId);
    
    const emailInput = document.getElementById("emailTo");
    const warningDiv = document.getElementById("emailWarningMsg");
    const btnSend = document.getElementById("btnSendEmail");

    // Check if email exists
    if (member.email && member.email.trim() !== "") {
        emailInput.value = member.email;
        emailInput.readOnly = true;
        emailInput.style.background = "#e9ecef";
        warningDiv.style.display = "none";
        btnSend.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send Email';
    } else {
        emailInput.value = "";
        emailInput.readOnly = false;
        emailInput.style.background = "#ffffff";
        warningDiv.style.display = "block"; // Dikhaye Warning + Input
        btnSend.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Email & Send';
    }

    document.getElementById("emailCc").value = "";

    if (type === 'fine') {
        globalFineAmountForEmail = fineAmount;
        document.getElementById("emailSubject").value = "Notice: Pending Library Dues & Overdue Books";
        document.getElementById("emailMessage").value = "Please visit the library desk immediately to settle your account and avoid suspension of borrowing privileges.";
    } else if (type === 'expiry') {
        document.getElementById("emailSubject").value = "Notice: Library Membership Expiry";
        document.getElementById("emailMessage").value = "Please visit the library desk to renew your membership and ensure uninterrupted access to our services.";
    }

    emailModal.classList.add("show");
};

window.closeEmailModal = function () {
    if (emailModal) emailModal.classList.remove("show");
};

if (emailForm) {
  emailForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const btn = emailForm.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
    btn.disabled = true;

    const newEmail = document.getElementById("emailTo").value.trim();
    const ccEmail = document.getElementById("emailCc") ? document.getElementById("emailCc").value : "";
    let customNoteRaw = document.getElementById("emailMessage").value.trim();
    let customNote = customNoteRaw ? customNoteRaw.replace(/\n/g, "<br>") : "Please visit the library helpdesk.";
    
    let member = globalMembersList.find(m => m.id === window.currentEmailMemberId);

    try {
        // --- AUTO-UPDATE BACKEND IF EMAIL WAS ADDED ---
        if (!member.email || member.email !== newEmail) {
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving Email...';
            member.email = newEmail; // Update local array
            await fetch(API_URL, { 
                method: "POST", 
                body: JSON.stringify({
                    action: 'edit',
                    sheet: 'Members',
                    id: member.id, name: member.name, type: member.type, phone: member.phone, email: member.email,
                    joinDate: member.JoinDate || "", expiryDate: member.ExpiryDate || ""
                }) 
            });
            sessionStorage.setItem('cache_Members', JSON.stringify(globalMembersList));
        }

        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending Mail...';

        // --- GENERATE HTML BODY BASED ON TYPE ---
        let htmlEmailBody = "";

        if (window.currentEmailType === 'fine') {
            let booksHtmlTable = "";
            if (window.currentUnpaidRecords && window.currentUnpaidRecords.length > 0) {
              window.currentUnpaidRecords.forEach((record) => {
                let matchedBook = globalBooksList.find(b => String(b.id) === String(record.bookId));
                let bookTitle = matchedBook ? matchedBook.title : "Unknown Title";
                booksHtmlTable += `
                        <tr>
                            <td style="padding: 8px 10px; border-bottom: 1px solid #E5E7EB; color: #111827; font-weight: 600; font-size: 13px;">${record.bookId}<br><span style="font-size: 11px; color: #6B7280; font-weight: normal;">${bookTitle}</span></td>
                            <td style="padding: 8px 10px; border-bottom: 1px solid #E5E7EB; color: #4B5563; font-size: 13px;">${record.dueDate || "N/A"}</td>
                            <td style="padding: 8px 10px; border-bottom: 1px solid #E5E7EB; color: #EF4444; font-weight: 600; text-align: center; font-size: 13px;">${record.daysOverdue || 0}d</td>
                            <td style="padding: 8px 10px; border-bottom: 1px solid #E5E7EB; color: #111827; font-weight: bold; text-align: right; font-size: 13px;">₹${record.fineAmount || 0}</td>
                        </tr>`;
              });
            }

            htmlEmailBody = `
            <div style="background-color: #F3F4F6; padding: 20px 10px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                <div style="max-width: 500px; margin: 0 auto; background-color: #FFFFFF; border-radius: 8px; overflow: hidden; border: 1px solid #E5E7EB;">
                    <div style="background-color: #3B82F6; padding: 15px 20px; text-align: center; border-bottom: 3px solid #2563EB;">
                        <h2 style="color: #FFFFFF; margin: 0; font-size: 20px; font-weight: 600;"> Library Notice</h2>
                    </div>
                    <div style="padding: 20px;">
                        <p style="font-size: 14px; margin: 0 0 10px 0; color: #374151;"><strong>Dear ${member.name},</strong></p>
                        <p style="font-size: 13px; margin: 0 0 15px 0; color: #4B5563; line-height: 1.4;">
This is to inform you that your ward’s library fee is still pending. Kindly clear the due amount at the earliest..</p>
                        <div style="background-color: #FEF2F2; border: 1px solid #FCA5A5; padding: 10px 15px; border-radius: 6px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 14px; color: #991B1B; font-weight: 600;">⚠️ Outstanding Amount:</span>
                            <span style="font-size: 18px; font-weight: bold; color: #DC2626;">₹${globalFineAmountForEmail}</span>
                        </div>
                        <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
                            <thead>
                                <tr style="background-color: #F9FAFB;">
                                    <th style="padding: 8px 10px; text-align: left; font-size: 11px; color: #6B7280; font-weight: 600; text-transform: uppercase; border-bottom: 2px solid #E5E7EB;">Book Details</th>
                                    <th style="padding: 8px 10px; text-align: left; font-size: 11px; color: #6B7280; font-weight: 600; text-transform: uppercase; border-bottom: 2px solid #E5E7EB;">Due</th>
                                    <th style="padding: 8px 10px; text-align: center; font-size: 11px; color: #6B7280; font-weight: 600; text-transform: uppercase; border-bottom: 2px solid #E5E7EB;">Late</th>
                                    <th style="padding: 8px 10px; text-align: right; font-size: 11px; color: #6B7280; font-weight: 600; text-transform: uppercase; border-bottom: 2px solid #E5E7EB;">Fine</th>
                                </tr>
                            </thead>
                            <tbody>${booksHtmlTable}</tbody>
                        </table>
                        <div style="background-color: #F3F4F6; padding: 12px 15px; border-radius: 6px; margin-bottom: 15px;">
                            <p style="margin: 0 0 5px 0; font-weight: 600; font-size: 13px; color: #374151;">Librarian's Note:</p>
                            <p style="margin: 0; color: #4B5563; font-size: 13px; line-height: 1.4;">${customNote}</p>
                        </div>
                    </div>
                    <div style="background-color: #F9FAFB; padding: 12px 20px; text-align: center; border-top: 1px solid #E5E7EB;">
                        <p style="margin: 0; font-size: 11px; color: #9CA3AF;">Automated notification. Please do not reply.</p>
                    </div>
                </div>
            </div>`;

        } else if (window.currentEmailType === 'expiry') {
            
            // Generate Status Box Data
            const today = new Date();
            today.setHours(0,0,0,0);
            let statusText = "Lifetime Active";
            let statusColor = "#2ecc71"; // Green
            let statusBg = "#e8f5e9";
            
            if(member.ExpiryDate) {
                let expDate = new Date(member.ExpiryDate);
                let diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
                if (diffDays < 0) { 
                    statusText = `Expired (${Math.abs(diffDays)} Days ago)`; 
                    statusColor = "#e74c3c"; // Red
                    statusBg = "#ffebee";
                } else if (diffDays <= 15) { 
                    statusText = `Expires in ${diffDays} Days`; 
                    statusColor = "#e67e22"; // Orange
                    statusBg = "#fff3cd";
                } else if (diffDays > 10000) {
                    statusText = "Lifetime Active";
                } else { 
                    statusText = `Active (${diffDays} Days left)`; 
                }
            }

            htmlEmailBody = `
            <div style="background-color: #F3F4F6; padding: 20px 10px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                <div style="max-width: 500px; margin: 0 auto; background-color: #FFFFFF; border-radius: 8px; overflow: hidden; border: 1px solid #E5E7EB;">
                    
                    <div style="background-color: #8e44ad; padding: 15px 20px; text-align: center; border-bottom: 3px solid #732d91;">
                        <h2 style="color: #FFFFFF; margin: 0; font-size: 20px; font-weight: 600;">Membership Notice</h2>
                    </div>
                    
                    <div style="padding: 20px;">
                        <p style="font-size: 14px; margin: 0 0 10px 0; color: #374151;"><strong>Dear ${member.name},</strong></p>
                        <p style="font-size: 13px; margin: 0 0 15px 0; color: #4B5563; line-height: 1.4;">This is a system-generated update regarding your library membership profile.</p>
                        
                        <div style="background-color: ${statusBg}; border: 1px solid ${statusColor}; padding: 12px 15px; border-radius: 6px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 14px; color: #333; font-weight: 600;">Account Status:</span>
                            <span style="font-size: 16px; font-weight: bold; color: ${statusColor};">${statusText}</span>
                        </div>
                        
                        <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
                            <tr>
                                <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; color: #4B5563; font-size: 13px;">Member ID</td>
                                <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; color: #111827; font-weight: 600; text-align: right; font-size: 13px;">${member.id}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; color: #4B5563; font-size: 13px;">Join Date</td>
                                <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; color: #111827; font-weight: 600; text-align: right; font-size: 13px;">${member.JoinDate || 'N/A'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; color: #4B5563; font-size: 13px;">Expiry Date</td>
                                <td style="padding: 10px; border-bottom: 1px solid #E5E7EB; color: #111827; font-weight: 600; text-align: right; font-size: 13px;">${member.ExpiryDate || 'N/A'}</td>
                            </tr>
                        </table>

                        <div style="background-color: #F3F4F6; padding: 12px 15px; border-radius: 6px; margin-bottom: 15px;">
                            <p style="margin: 0 0 5px 0; font-weight: 600; font-size: 13px; color: #374151;">Librarian's Note:</p>
                            <p style="margin: 0; color: #4B5563; font-size: 13px; line-height: 1.4;">${customNote}</p>
                        </div>
                    </div>
                    
                    <div style="background-color: #F9FAFB; padding: 12px 20px; text-align: center; border-top: 1px solid #E5E7EB;">
                        <p style="margin: 0; font-size: 11px; color: #9CA3AF;">Automated notification. Please do not reply.</p>
                    </div>
                </div>
            </div>`;
        }

        // --- SEND THE EMAIL ---
        const payload = {
            action: 'send_email',
            to: newEmail,
            cc: ccEmail.trim(),
            subject: document.getElementById('emailSubject').value,
            message: htmlEmailBody 
        };

        const res = await fetch(API_URL, { method: "POST", body: JSON.stringify(payload) });
        const resultText = await res.text();

        if (resultText.includes("Error")) {
            alert(resultText);
        } else {
            alert("Email successfully sent to the member!");
            closeEmailModal();
        }
    } catch (err) {
        alert("Action failed. Check your internet connection.");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
  });
}

loadAllData();



