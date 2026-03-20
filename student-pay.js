const API_URL = "https://script.google.com/macros/s/AKfycbyE1U8-EgBh-pQHzHM9MtkzBAmzhdYTuqixpOY0i6dbLoTh7-jHsr7xPLccIrOH35Ye/exec";

// URL se Member ID nikalna (e.g., student-pay.html?memberId=S0001)
const urlParams = new URLSearchParams(window.location.search);
const currentMemberId = urlParams.get('memberId');

if (currentMemberId) {
    document.getElementById('payMemberId').value = currentMemberId;
    loadMemberDues(currentMemberId);
} else {
    document.getElementById('displayDue').innerText = "0 (Invalid ID)";
    alert("Invalid Member ID link. Please open this page from your email.");
}

async function loadMemberDues(memberId) {
    try {
        const response = await fetch(API_URL + "?sheet=Issued");
        const issuedBooksList = await response.json();
        
        let totalDue = 0;
        issuedBooksList.forEach(record => {
            if (record.memberId === memberId && record.paymentStatus === 'Unpaid') {
                totalDue += parseInt(record.fineAmount) || 0;
            }
        });
        
        document.getElementById('displayDue').innerText = totalDue;
        document.getElementById('payAmount').max = totalDue;
        
        if (totalDue > 0) {
            document.getElementById('payAmount').value = totalDue;
            
            const upiId = "7982326285-2@axl";
            const upiUrl = `upi://pay?pa=${upiId}&pn=LibraryFine&am=${totalDue}&cu=INR`;
            const qrApi = `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(upiUrl)}&choe=UTF-8`;
            document.getElementById('upiQrCode').src = qrApi;
        } else {
            document.getElementById('displayDue').innerText = "0 (All Clear)";
            if(document.getElementById('upiQrCode')) document.getElementById('upiQrCode').style.opacity = "0.2";
            document.querySelector('button[type="submit"]').disabled = true;
            document.querySelector('button[type="submit"]').innerText = "No Pending Dues";
        }
    } catch (error) {
        document.getElementById('displayDue').innerText = "Error loading";
    }
}

document.getElementById('studentPayForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = document.querySelector('button[type="submit"]');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating System...';
    btn.disabled = true;

    const amountPaid = document.getElementById('payAmount').value;
    
    // Aaj ki date nikalna
    const today = new Date();
    const payDate = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

    try {
        await fetch(API_URL, { 
            method: "POST", 
            body: JSON.stringify({ 
                action: 'pay_partial_fines', 
                sheet: 'Issued', 
                memberId: currentMemberId, 
                amountPaid: amountPaid,
                payDate: payDate
            }) 
        });
        
        alert(`Success! Payment of ₹${amountPaid} has been recorded in the library system.`);
        
        // Payment ke baad unko thank you ya history dikha sakte ho
        document.getElementById('studentPayForm').innerHTML = `
            <div style="color: #27ae60; font-size: 1.2rem; font-weight: bold; margin-top: 20px;">
                <i class="fa-solid fa-circle-check" style="font-size: 3rem; margin-bottom: 10px;"></i><br>
                System Updated Successfully!
            </div>`;
    } catch(err) { 
        alert("Network error. Please try again.");
        btn.innerHTML = '<i class="fa-solid fa-check-circle"></i> Confirm Payment Update'; 
        btn.disabled = false;
    }
});