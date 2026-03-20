const API_URL = "https://script.google.com/macros/s/AKfycbyE1U8-EgBh-pQHzHM9MtkzBAmzhdYTuqixpOY0i6dbLoTh7-jHsr7xPLccIrOH35Ye/exec";

let booksList = [];
let issuedBookIds = []; 
let liveIssuedRecords = []; 
let masterDataList = {}; 
let isEditing = false;
let currentForceEditId = null;
window.globalDefaultLibrary = ""; 

const FINE_PER_DAY = 5;

const bookForm = document.getElementById('bookForm');
const bookTableBody = document.getElementById('bookTableBody');
const bookModal = document.getElementById('bookModal');
const filterModal = document.getElementById('filterModal');
const bulkUpdateModal = document.getElementById('bulkUpdateModal');
const bulkUpdateTableBody = document.getElementById('bulkUpdateTableBody');

// 🟢 NAYA: SELECT2 INITIALIZATION FUNCTION 🟢
function initSearchableDropdowns() {
    // Single form select2 init
    if ($.fn.select2) {
        $('#bookModal .searchable-select').select2({
            dropdownParent: $('#bookModal'),
            width: '100%',
            placeholder: "Select an option"
        });
        // Bulk form select2 init
        $('#bulkUpdateModal .searchable-select').select2({
            dropdownParent: $('#bulkUpdateModal'),
            width: '100%'
        });
    }
}

async function safeFetchJSON(bodyData) {
    try {
        const res = await fetch(API_URL, { method: "POST", body: JSON.stringify(bodyData), headers: { "Content-Type": "text/plain;charset=utf-8" } });
        const textData = await res.text();
        if (textData.includes("<!DOCTYPE") || textData.includes("<html")) throw new Error("API Error.");
        return JSON.parse(textData);
    } catch (e) { throw new Error(e.message); }
}

async function safeFetchText(bodyData) {
    const res = await fetch(API_URL, { method: "POST", body: JSON.stringify(bodyData), headers: { "Content-Type": "text/plain;charset=utf-8" } });
    return await res.text();
}

function calculateFine(dueDateStr) {
    if (!dueDateStr) return { days: 0, fine: 0 };
    let parts = dueDateStr.split('-');
    if(parts.length !== 3) return { days: 0, fine: 0 };
    let dueDate = new Date(parts[0], parts[1] - 1, parts[2]); dueDate.setHours(0,0,0,0);
    let today = new Date(); today.setHours(0,0,0,0);
    let diffDays = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 0) return { days: diffDays, fine: diffDays * FINE_PER_DAY };
    return { days: 0, fine: 0 };
}

async function fetchBooks() {
    bookTableBody.innerHTML = `<tr><td colspan="5"><div class="spinner-container"><div class="spinner"></div><p>Syncing Library Data...</p></div></td></tr>`;
    try {
        const [booksRes, issuedRes, masterRes] = await Promise.all([
            fetch(API_URL + "?sheet=Books"),
            fetch(API_URL + "?sheet=Issued"),
            safeFetchJSON({ action: 'get_master_data' }) 
        ]);
        booksList = await booksRes.json();
        const issuedData = await issuedRes.json();
        masterDataList = masterRes;

        populateAllDropdowns();
        liveIssuedRecords = issuedData.filter(record => String(record.status || record.Status || '').toLowerCase() === "issued");
        issuedBookIds = liveIssuedRecords.map(record => String(record.bookId || record['Book ID']).trim().toLowerCase());

        renderBooks();
    } catch (error) {
        bookTableBody.innerHTML = '<tr><td colspan="5" style="color:red; text-align:center;">Failed to load data!</td></tr>';
    }
}

function populateAllDropdowns() {
    // Destroy select2 if already exists before repopulating
    if ($.fn.select2 && $('.searchable-select').hasClass("select2-hidden-accessible")) {
        $('.searchable-select').select2('destroy');
    }

    if(masterDataList['Authors']) {
        let options = '<option value="">Select</option>';
        masterDataList['Authors'].forEach(a => { 
            let name = `${a['First Name'] || a[Object.keys(a)[0]]} ${a['Last Name'] || a[Object.keys(a)[1]] || ''}`.trim();
            options += `<option value="${name}">${name}</option>`; 
        });
        document.getElementById('b_author').innerHTML = options;
        document.getElementById('b_coauthor').innerHTML = options;
    }
    if(masterDataList['Publishers']) {
        let options = '<option value="">Select Publisher</option>';
        masterDataList['Publishers'].forEach(p => { 
            let name = p['Name'] || p[Object.keys(p)[0]];
            options += `<option value="${name}">${name}</option>`; 
        });
        document.getElementById('b_publisher').innerHTML = options;
    }
    if(masterDataList['Subjects']) {
        let options = '<option value="">Select Subject</option>';
        masterDataList['Subjects'].forEach(s => { 
            let name = s['Name'] || s[Object.keys(s)[0]];
            options += `<option value="${name}">${name}</option>`; 
        });
        document.getElementById('b_subject').innerHTML = options;
    }
    if(masterDataList['DDCs']) {
        let options = '<option value="">Select DDC</option>';
        masterDataList['DDCs'].forEach(d => { 
            let code = d['Code'] || d[Object.keys(d)[0]];
            options += `<option value="${code}">${code}</option>`; 
        });
        document.getElementById('b_ddc').innerHTML = options;
    }
    if(masterDataList['Suppliers']) {
        let options = '<option value="">Select Supplier</option>';
        masterDataList['Suppliers'].forEach(s => { 
            let name = s['Name'] || s['Vendor Name'] || s[Object.keys(s)[0]];
            options += `<option value="${name}">${name}</option>`; 
        });
        document.getElementById('b_supplier').innerHTML = options;
    }
    
    // 🟢 COMBINING SHELF AND RACKS FOR DROPDOWN 🟢
    let shelfOpts = '';
    if(masterDataList['Racks'] && masterDataList['Racks'].length > 0) {
        masterDataList['Racks'].forEach(r => {
            let sName = r['Shelf Name'] || r['ShelfName'] || r[Object.keys(r)[1]] || '';
            let rName = r['Name'] || r['Rack Name'] || r[Object.keys(r)[2]] || '';
            let combined = `${sName} - ${rName}`;
            shelfOpts += `<option value="${combined}">${combined}</option>`;
        });
    } else if (masterDataList['Shelfs']) {
        masterDataList['Shelfs'].forEach(s => {
            let name = s['Name'] || s[Object.keys(s)[0]];
            shelfOpts += `<option value="${name}">${name}</option>`;
        });
    }
    document.getElementById('b_shelf').innerHTML = `<option value="">Select Shelf-Rack</option>` + shelfOpts;
    window.globalShelfOptions = shelfOpts;
    
    if(masterDataList['Libraries']) {
        let options = '<option value="">Select Library</option>';
        window.globalDefaultLibrary = "";
        masterDataList['Libraries'].forEach(l => { 
            let name = l['Name'] || l[Object.keys(l)[0]];
            let isDefault = String(l['Default Library'] || l['DefaultLibrary'] || '').toLowerCase();
            if (isDefault === 'yes' || isDefault === 'true') {
                window.globalDefaultLibrary = name;
            }
            options += `<option value="${name}">${name}</option>`; 
        });
        document.getElementById('b_library').innerHTML = options;
    }

    // 🟢 Init Select2 after rendering options
    initSearchableDropdowns();
}

window.openMasterModal = function(type) {
    if(type === 'CoAuthor') { document.getElementById('m_author_type').value = 'CoAuthor'; type = 'Author';
    }
    else if(type === 'Author') { document.getElementById('m_author_type').value = 'Author'; }
    document.getElementById(`masterModal_${type}`).classList.add('show');
}
window.closeMasterModal = function(type) { document.getElementById(`masterModal_${type}`).classList.remove('show'); }

window.saveMasterData = async function(sheetName, ...inputIds) {
    let btn = event.target;
    btn.innerText = "Saving..."; btn.disabled = true;
    let rowData = [];
    inputIds.forEach(id => { rowData.push(document.getElementById(id).value.trim()); });
    
    let headers = [];
    if(sheetName === 'Authors') headers = ["First Name", "Last Name", "Spine"];
    if(sheetName === 'Publishers') headers = ["Name", "Mobile", "Address", "City", "State", "Country"];
    if(sheetName === 'Subjects') headers = ["Name", "Code"];
    if(sheetName === 'DDCs') headers = ["Code", "Description"];
    if(sheetName === 'Suppliers') headers = ["Name", "Code", "Contact Coordinator", "Contact No.", "Email ID", "Address"];
    try {
        await safeFetchText({ action: 'add_master', masterSheet: sheetName, headers: headers, rowData: rowData });
        let selectId = ""; let displayVal = rowData[0];
        if(sheetName === 'Authors') {
            displayVal = `${rowData[0]} ${rowData[1]}`.trim();
            selectId = (document.getElementById('m_author_type').value === 'CoAuthor') ? 'b_coauthor' : 'b_author';
        }
        else if(sheetName === 'Publishers') selectId = 'b_publisher';
        else if(sheetName === 'Subjects') selectId = 'b_subject';
        else if(sheetName === 'DDCs') selectId = 'b_ddc';
        else if(sheetName === 'Suppliers') selectId = 'b_supplier';

        let dropdown = document.getElementById(selectId);
        
        // 🟢 NAYA: Trigger Select2 to recognize new option
        let newOption = new Option(displayVal, displayVal, true, true);
        $(dropdown).append(newOption).trigger('change');
        
        inputIds.forEach(id => document.getElementById(id).value = "");
        closeMasterModal(sheetName === 'Authors' ? 'Author' : sheetName.replace('s',''));
    } catch(e) { alert("Failed to add data to Database!"); }
    finally { btn.innerText = "Apply";
    btn.disabled = false; }
}

window.openFilterModal = function() { filterModal.classList.add('show'); }
window.closeFilterModal = function() { filterModal.classList.remove('show'); }
window.applyFilters = function() { renderBooks(); closeFilterModal();
}
window.clearFilters = function() { document.getElementById("bookSearch").value = ""; document.getElementById("statusFilter").value = "All"; renderBooks(); closeFilterModal();
}

window.renderBooks = function() {
    bookTableBody.innerHTML = '';
    const searchText = (document.getElementById("bookSearch").value || "").toLowerCase();
    const statusVal = document.getElementById("statusFilter").value;
    let displayList = booksList.filter(book => {
        const bId = String(book.id || book['Book ID'] || '').trim();
        const bTitle = String(book.title || book['Title'] || '').toLowerCase();
        const bAuthor = String(book.author || book['Author'] || '').toLowerCase();
        
        let isAvailable = !issuedBookIds.includes(bId.toLowerCase());
        const matchSearch = bId.toLowerCase().includes(searchText) || bTitle.includes(searchText) || bAuthor.includes(searchText);
        
        let matchStatus = true;
        if (statusVal === "Available" && !isAvailable) matchStatus = false;
        if (statusVal === "Issued" && isAvailable) matchStatus = false;
        return matchSearch && matchStatus;
    });
    const countBadge = document.getElementById('bookCountBadge');
    if (countBadge) countBadge.innerText = displayList.length;
    if (displayList.length === 0) { bookTableBody.innerHTML = `<tr><td colspan="5" class="empty-msg" style="text-align:center;">No matching books.</td></tr>`;
    return; }

    displayList.reverse().forEach((book) => {
        const bId = String(book.id || book['Book ID'] || '').trim();
        let isAvailable = !issuedBookIds.includes(bId.toLowerCase());
        let badgeHtml = isAvailable ? `<span class="badge-green"><i class="fa-solid fa-circle-check"></i> Available</span>` : `<span class="badge-red"><i class="fa-solid fa-ban"></i> Issued</span>`;
        
        bookTableBody.innerHTML += `
            <tr>
                <td><strong>${bId}</strong></td>
                <td>${book.title || book['Title'] || '--'}</td>
                <td>${book.author || book['Author'] || '--'}</td>
                <td>${badgeHtml}</td>
                <td>
                    <button class="btn btn-primary" onclick="editBook('${bId}')" style="padding:5px 10px; margin-right:5px; background:#f39c12; border:none;"><i class="fa-solid fa-pencil"></i></button>
                    <button class="btn btn-danger" onclick="deleteBook('${bId}')" style="padding:5px 10px; border:none;"><i class="fa-solid fa-trash-can"></i></button>
                </td>
            </tr>`;
    });
}

function showWarningModal(book, issueRecord, showBruteEdit) {
    document.getElementById('warnBookId').innerText = book.id || book['Book ID'];
    document.getElementById('warnBookTitle').innerText = book.title || book['Title'];
    document.getElementById('warnMemberName').innerText = issueRecord.memberName || issueRecord['Member Name'] || "N/A";
    document.getElementById('warnMemberId').innerText = issueRecord.memberId || issueRecord['Member ID'] || "N/A";
    
    let issueDateFormatted = issueRecord.issueDate ? issueRecord.issueDate.split('-').reverse().join('-') : "N/A";
    let dueDateFormatted = issueRecord.dueDate ? issueRecord.dueDate.split('-').reverse().join('-') : "N/A";
    document.getElementById('warnIssueDate').innerText = issueDateFormatted;
    document.getElementById('warnDueDate').innerText = dueDateFormatted;
    
    let fineInfo = calculateFine(issueRecord.dueDate);
    document.getElementById('warnLiveFine').innerHTML = fineInfo.days > 0 ? `<span style="color: #e74c3c; font-weight: bold;">₹ ${fineInfo.fine} (${fineInfo.days} Days Overdue)</span>` : `<span style="color: #27ae60; font-weight: bold;">Safe (No Fine)</span>`;
    document.getElementById('btnBruteEdit').style.display = showBruteEdit ? 'block' : 'none';
    document.getElementById('issuedWarningModal').classList.add('show');
}
window.closeIssuedWarningModal = function() { document.getElementById('issuedWarningModal').classList.remove('show');
}


window.openBookModal = function() {
    isEditing = false; bookForm.reset();
    document.getElementById('modalTitle').innerHTML = '<i class="fa-solid fa-book-medical"></i> Add New Book';
    document.getElementById('b_id').readOnly = false; 
    document.getElementById('oldBookId').value = "";
    document.getElementById('b_id').value = ""; 
    
    // 🟢 NAYA: Reset Searchable Dropdowns 🟢
    $('#bookForm .searchable-select').val('').trigger('change');
    
    // Auto-select library via trigger
    if(window.globalDefaultLibrary) {
        $('#b_library').val(window.globalDefaultLibrary).trigger('change');
    }
    
    const submitBtn = bookForm.querySelector('button[type="submit"]');
    submitBtn.innerText = "Save Book"; 
    bookModal.classList.add('show');
}

window.closeBookModal = function() { bookModal.classList.remove('show'); bookForm.reset();
}

window.actuallyOpenEditModal = function(id) {
    const book = booksList.find(b => String(b.id || b['Book ID']) === String(id));
    if(book) {
        isEditing = true;
        document.getElementById('modalTitle').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Edit Book';
        document.getElementById('oldBookId').value = book.id || book['Book ID'] || ''; 
        document.getElementById('b_id').value = book.id || book['Book ID'] || ''; 
        
        // 🟢 NAYA: Trigger Select2 to show saved values 🟢
        $('#b_library').val(book.library || book['Library_Name'] || '').trigger('change');
        
        document.getElementById('b_title').value = book.title || book['Title'] || '';
        document.getElementById('b_subtitle').value = book.subtitle || book['Subtitle'] || '';
        
        $('#b_author').val(book.author || book['Author'] || '').trigger('change');
        $('#b_coauthor').val(book.coAuthor || book['Co_Author'] || '').trigger('change');
        
        document.getElementById('b_spine').value = book.spine || book['Spine'] || '';
        
        $('#b_publisher').val(book.publisher || book['Publisher'] || '').trigger('change');
        document.getElementById('b_booktype').value = book.bookType || book['Book_Type'] || 'Textbook';
        $('#b_subject').val(book.subject || book['Subject'] || '').trigger('change');
        document.getElementById('b_isbn').value = book.isbn || book['ISBN'] || '';
        $('#b_ddc').val(book.ddc || book['DDC'] || '').trigger('change');
        
        document.getElementById('b_keywords').value = book.keywords || book['Keywords'] || '';
        document.getElementById('b_year').value = book.year || book['Year'] || '';
        document.getElementById('b_edition').value = book.edition || book['Edition'] || '';
        document.getElementById('b_genre').value = book.genre || book['Genre'] || '';
        document.getElementById('b_language').value = book.language || book['Language'] || 'English';
        
        $('#b_shelf').val(book.shelf || book['Shelf'] || '').trigger('change');
        
        document.getElementById('b_shelfpos').value = book.shelfPos || book['Shelf_Pos'] || '';
        document.getElementById('b_pages').value = book.pages || book['Pages'] || '';
        let isDonated = String(book.isDonated || book['Donate']).toLowerCase() === 'true';
        document.getElementById('b_donate').checked = isDonated;
        
        $('#b_supplier').val(book.supplier || book['Supplier'] || '').trigger('change');
        let pDate = book.purchaseDate || book['Purchase_Date'];
        if (pDate && pDate.includes('-')) document.getElementById('b_purchasedate').value = pDate.split('T')[0];
        
        let bDate = book.billDate || book['Bill_Date'];
        if (bDate && bDate.includes('-')) document.getElementById('b_billdate').value = bDate.split('T')[0];
        
        document.getElementById('b_billno').value = book.billNo || book['Bill_No'] || '';
        document.getElementById('b_currency').value = book.currency || book['Currency'] || 'INR';
        document.getElementById('b_price').value = book.price || book['Price'] || '';
        
        bookForm.querySelector('button[type="submit"]').innerText = "Update Book"; 
        bookModal.classList.add('show');
    }
}

window.editBook = function(id) {
    const book = booksList.find(b => String(b.id || b['Book ID']) === String(id));
    const issueRecord = liveIssuedRecords.find(r => String(r.bookId || r['Book ID']).trim().toLowerCase() === String(id).toLowerCase());
    if(issueRecord && book) { currentForceEditId = id;
    showWarningModal(book, issueRecord, true); return; }
    actuallyOpenEditModal(id);
}

window.forceEditBook = function() {
    if(confirm("⚠️ FINAL WARNING ⚠️\n\nThis book is actively issued. Are you sure you want to 'Brute Edit'?")) {
        closeIssuedWarningModal();
        actuallyOpenEditModal(currentForceEditId);
    }
}

bookForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const submitBtn = bookForm.querySelector('button[type="submit"]'); const originalText = submitBtn.innerText; submitBtn.innerText = "Saving..."; submitBtn.disabled = true;
    
    const bookData = {
        action: isEditing ? 'edit' : 'add',
        sheet: 'Books',
        id: document.getElementById('b_id').value.trim(),
        old_id: document.getElementById('oldBookId').value.trim(),
        title: document.getElementById('b_title').value.trim(),
        subtitle: document.getElementById('b_subtitle').value.trim(),
        author: document.getElementById('b_author').value,
        coAuthor: document.getElementById('b_coauthor').value,
        spine: document.getElementById('b_spine').value.trim(),
        publisher: document.getElementById('b_publisher').value,
        bookType: document.getElementById('b_booktype').value,
        subject: document.getElementById('b_subject').value,
        isbn: document.getElementById('b_isbn').value.trim(),
        ddc: document.getElementById('b_ddc').value,
        keywords: document.getElementById('b_keywords').value.trim(),
        year: document.getElementById('b_year').value.trim(),
        edition: document.getElementById('b_edition').value.trim(),
        genre: document.getElementById('b_genre').value,
        language: document.getElementById('b_language').value,
        shelf: document.getElementById('b_shelf').value,
        shelfPos: document.getElementById('b_shelfpos').value.trim(),
        pages: document.getElementById('b_pages').value,
        isDonated: document.getElementById('b_donate').checked,
        supplier: document.getElementById('b_supplier').value,
        purchaseDate: document.getElementById('b_purchasedate').value,
        billDate: document.getElementById('b_billdate').value,
        billNo: document.getElementById('b_billno').value.trim(),
        currency: document.getElementById('b_currency').value,
        price: document.getElementById('b_price').value,
        library: document.getElementById('b_library').value
    };

    try { await safeFetchText(bookData); closeBookModal();
    await fetchBooks(); } 
    catch (error) { alert("Failed to save book.");
    } 
    finally { submitBtn.innerText = originalText; submitBtn.disabled = false; }
});

window.deleteBook = async function(id) {
    const book = booksList.find(b => String(b.id || b['Book ID']) === String(id));
    const issueRecord = liveIssuedRecords.find(r => String(r.bookId || r['Book ID']).trim().toLowerCase() === String(id).toLowerCase());
    if(issueRecord && book) { showWarningModal(book, issueRecord, false); return;
    }
    if(confirm(`Are you sure you want to delete Book ID: ${id}?`)) {
        try { await safeFetchText({ action: 'delete', sheet: 'Books', id: id });
        fetchBooks(); } 
        catch(error) { alert("Delete failed!"); }
    }
};

window.openBulkUpdateModal = function() {
    bulkUpdateTableBody.innerHTML = '';
    
    // Destroy previous Select2 to avoid layout bugs when re-opening
    if ($.fn.select2 && $('#bulkUpdateTableBody .searchable-select').hasClass("select2-hidden-accessible")) {
        $('#bulkUpdateTableBody .searchable-select').select2('destroy');
    }

    if(booksList.length === 0){
        bulkUpdateTableBody.innerHTML = '<tr><td colspan="27" class="empty-msg">No data to display.</td></tr>';
    } else {
        let typeOpts = `<option value="Textbook">Textbook</option><option value="Reference Book">Reference Book</option><option value="Magazine">Magazine / Journal</option>`;
        let langOpts = `<option value="English">English</option><option value="Hindi">Hindi</option><option value="Spanish">Spanish</option>`;
        let currOpts = `<option value="INR">INR</option><option value="USD">USD</option>`;

        let libOpts = '';
        if(masterDataList['Libraries']) masterDataList['Libraries'].forEach(l => libOpts += `<option value="${l['Name'] || l[Object.keys(l)[0]]}">${l['Name'] || l[Object.keys(l)[0]]}</option>`);
        let authorOpts = '';
        if(masterDataList['Authors']) masterDataList['Authors'].forEach(a => { let name = `${a['First Name'] || a[Object.keys(a)[0]]} ${a['Last Name'] || a[Object.keys(a)[1]] || ''}`.trim(); authorOpts += `<option value="${name}">${name}</option>`; });
        let pubOpts = ''; if(masterDataList['Publishers']) masterDataList['Publishers'].forEach(p => pubOpts += `<option value="${p['Name'] || p[Object.keys(p)[0]]}">${p['Name'] || p[Object.keys(p)[0]]}</option>`);
        let subOpts = '';
        if(masterDataList['Subjects']) masterDataList['Subjects'].forEach(s => subOpts += `<option value="${s['Name'] || s[Object.keys(s)[0]]}">${s['Name'] || s[Object.keys(s)[0]]}</option>`);
        let ddcOpts = '';
        if(masterDataList['DDCs']) masterDataList['DDCs'].forEach(d => ddcOpts += `<option value="${d['Code'] || d[Object.keys(d)[0]]}">${d['Code'] || d[Object.keys(d)[0]]}</option>`);
        let supOpts = '';
        if(masterDataList['Suppliers']) masterDataList['Suppliers'].forEach(s => { let name = s['Name'] || s['Vendor Name'] || s[Object.keys(s)[0]]; supOpts += `<option value="${name}">${name}</option>`; });
        let html = '';
        
        booksList.forEach((book) => {
            const bId = String(book.id || book['Book ID'] || '').trim();
            const bTitle = String(book.title || book['Title'] || '').replace(/"/g, '&quot;');
            const bSubtitle = String(book.subtitle || book['Subtitle'] || '').replace(/"/g, '&quot;');
            const bAuthor = String(book.author || book['Author'] || '').replace(/"/g, '&quot;');
            const bCoAuthor = String(book.coAuthor || book['Co_Author'] || '').replace(/"/g, '&quot;');
            const bSpine = String(book.spine || book['Spine'] || '').replace(/"/g, '&quot;');
            const bPublisher = String(book.publisher || book['Publisher'] || '').replace(/"/g, '&quot;');
            const bBookType = String(book.bookType || book['Book_Type'] || 'Textbook');
            const bSubject = String(book.subject || book['Subject'] || '').replace(/"/g, '&quot;');
            const bIsbn = String(book.isbn || book['ISBN'] || '').replace(/"/g, '&quot;');
            const bDdc = String(book.ddc || book['DDC'] || '').replace(/"/g, '&quot;');
            const bKeywords = String(book.keywords || book['Keywords'] || '').replace(/"/g, '&quot;');
            const bYear = String(book.year || book['Year'] || '').replace(/"/g, '&quot;');
            const bEdition = String(book.edition || book['Edition'] || '').replace(/"/g, '&quot;');
            const bGenre = String(book.genre || book['Genre'] || '').replace(/"/g, '&quot;');
            const bLanguage = String(book.language || book['Language'] || 'English');
            const bShelf = String(book.shelf || book['Shelf'] || '').replace(/"/g, '&quot;');
            const bShelfPos = String(book.shelfPos || book['Shelf_Pos'] || '').replace(/"/g, '&quot;');
            const bPages = String(book.pages || book['Pages'] || '');
            const bIsDonated = String(book.isDonated || book['Donate']).toLowerCase() === 'true' ? 'checked' : '';
            const bSupplier = String(book.supplier || book['Supplier'] || '').replace(/"/g, '&quot;');
            let bPurchaseDate = book.purchaseDate || book['Purchase_Date'] || '';
            if(bPurchaseDate && bPurchaseDate.includes('T')) bPurchaseDate = bPurchaseDate.split('T')[0];
            let bBillDate = book.billDate || book['Bill_Date'] || '';
            if(bBillDate && bBillDate.includes('T')) bBillDate = bBillDate.split('T')[0];
            
            const bBillNo = String(book.billNo || book['Bill_No'] || '').replace(/"/g, '&quot;');
            const bCurrency = String(book.currency || book['Currency'] || 'INR');
            const bPrice = String(book.price || book['Price'] || '');
            const bLibrary = String(book.library || book['Library_Name'] || '').replace(/"/g, '&quot;');
            
            // 🟢 NAYA: ADDED 'searchable-select' CLASS TO BULK DROPDOWNS 🟢
            html += `
                <tr class="bulk-row">
                    <td style="padding: 8px; border-right: 1px solid #eee;"><strong>${bId}</strong><input type="hidden" class="b_id" value="${bId}"></td>
                    
                    <td style="padding: 8px; border-right: 1px solid #eee; width:150px;">
                        <select class="bulk-input searchable-select b_library" style="width:100%;">
                            <option value="${bLibrary}" selected>${bLibrary || 'Select Library'}</option>
                            ${libOpts}
                        </select>
                    </td>
                    
                    <td style="padding: 8px; border-right: 1px solid #eee;"><input type="text" class="bulk-input b_title" value="${bTitle}" style="margin:0; width:180px;"></td>
                    <td style="padding: 8px; border-right: 1px solid #eee;"><input type="text" class="bulk-input b_subtitle" value="${bSubtitle}" style="margin:0; width:150px;"></td>
                    
                    <td style="padding: 8px; border-right: 1px solid #eee; width:170px;">
                        <select class="bulk-input searchable-select b_author" style="width:100%;">
                            <option value="${bAuthor}" selected>${bAuthor || 'Select Author'}</option>
                            ${authorOpts}
                        </select>
                    </td>
                    
                    <td style="padding: 8px; border-right: 1px solid #eee; width:150px;">
                        <select class="bulk-input searchable-select b_coauthor" style="width:100%;">
                            <option value="${bCoAuthor}" selected>${bCoAuthor || 'Select Co-author'}</option>
                            ${authorOpts}
                        </select>
                    </td>
                    
                    <td style="padding: 8px; border-right: 1px solid #eee;"><input type="text" class="bulk-input b_spine" value="${bSpine}" style="margin:0; width:100px;"></td>
                    
                    <td style="padding: 8px; border-right: 1px solid #eee; width:170px;">
                        <select class="bulk-input searchable-select b_publisher" style="width:100%;">
                            <option value="${bPublisher}" selected>${bPublisher || 'Select Publisher'}</option>
                            ${pubOpts}
                        </select>
                    </td>
                    
                    <td style="padding: 8px; border-right: 1px solid #eee;">
                        <select class="bulk-input b_booktype" style="margin:0; width:120px;">
                            <option value="${bBookType}" selected>${bBookType}</option>
                            ${typeOpts}
                        </select>
                    </td>
                    
                    <td style="padding: 8px; border-right: 1px solid #eee; width:150px;">
                        <select class="bulk-input searchable-select b_subject" style="width:100%;">
                            <option value="${bSubject}" selected>${bSubject || 'Select Subject'}</option>
                            ${subOpts}
                        </select>
                    </td>
                    
                    <td style="padding: 8px; border-right: 1px solid #eee;"><input type="text" class="bulk-input b_isbn" value="${bIsbn}" style="margin:0; width:120px;"></td>
                    
                    <td style="padding: 8px; border-right: 1px solid #eee; width:120px;">
                        <select class="bulk-input searchable-select b_ddc" style="width:100%;">
                            <option value="${bDdc}" selected>${bDdc || 'Select DDC'}</option>
                            ${ddcOpts}
                        </select>
                    </td>
                    
                    <td style="padding: 8px; border-right: 1px solid #eee;"><input type="text" class="bulk-input b_keywords" value="${bKeywords}" style="margin:0; width:150px;"></td>
                    <td style="padding: 8px; border-right: 1px solid #eee;"><input type="text" class="bulk-input b_year" value="${bYear}" style="margin:0; width:80px;"></td>
                    <td style="padding: 8px; border-right: 1px solid #eee;"><input type="text" class="bulk-input b_edition" value="${bEdition}" style="margin:0; width:80px;"></td>
                    <td style="padding: 8px; border-right: 1px solid #eee;"><input type="text" class="bulk-input b_genre" value="${bGenre}" style="margin:0; width:120px;"></td>
                    
                    <td style="padding: 8px; border-right: 1px solid #eee;">
                        <select class="bulk-input b_language" style="margin:0; width:100px;">
                            <option value="${bLanguage}" selected>${bLanguage}</option>
                            ${langOpts}
                        </select>
                    </td>
                    
                    <td style="padding: 8px; border-right: 1px solid #eee; width:160px;">
                        <select class="bulk-input searchable-select b_shelf" style="width:100%;">
                            <option value="${bShelf}" selected>${bShelf || 'Select Shelf-Rack'}</option>
                            ${window.globalShelfOptions || ''}
                        </select>
                    </td>
                    <td style="padding: 8px; border-right: 1px solid #eee;"><input type="text" class="bulk-input b_shelfpos" value="${bShelfPos}" style="margin:0; width:80px;"></td>
                    <td style="padding: 8px; border-right: 1px solid #eee;"><input type="number" class="bulk-input b_pages" value="${bPages}" style="margin:0; width:80px;"></td>
                    <td style="padding: 8px; border-right: 1px solid #eee; text-align: center;">
                        <label class="switch" style="transform: scale(0.8); margin:0;">
                            <input type="checkbox" class="b_donate" ${bIsDonated}>
                            <span class="slider round"></span>
                        </label>
                    </td>
                    
                    <td style="padding: 8px; border-right: 1px solid #eee; width:160px;">
                        <select class="bulk-input searchable-select b_supplier" style="width:100%;">
                            <option value="${bSupplier}" selected>${bSupplier || 'Select Supplier'}</option>
                            ${supOpts}
                        </select>
                    </td>
                    
                    <td style="padding: 8px; border-right: 1px solid #eee;"><input type="date" class="bulk-input b_purchasedate" value="${bPurchaseDate}" style="margin:0; width:130px;"></td>
                    <td style="padding: 8px; border-right: 1px solid #eee;"><input type="date" class="bulk-input b_billdate" value="${bBillDate}" style="margin:0; width:130px;"></td>
                    <td style="padding: 8px; border-right: 1px solid #eee;"><input type="text" class="bulk-input b_billno" value="${bBillNo}" style="margin:0; width:100px;"></td>
                    <td style="padding: 8px; border-right: 1px solid #eee;">
                        <select class="bulk-input b_currency" style="margin:0; width:80px;">
                            <option value="${bCurrency}" selected>${bCurrency}</option>
                            ${currOpts}
                        </select>
                    </td>
                    <td style="padding: 8px;"><input type="number" class="bulk-input b_price" value="${bPrice}" style="margin:0; width:90px;"></td>
                </tr>
            `;
        });
        bulkUpdateTableBody.innerHTML = html;
        
        // 🟢 NAYA: Init Select2 for newly created dynamic bulk selects
        initSearchableDropdowns();
    }
    bulkUpdateModal.classList.add('show');
}

window.closeBulkUpdateModal = function() { bulkUpdateModal.classList.remove('show'); }

window.saveBulkUpdate = async function() {
    const btn = document.getElementById('saveBulkBtn'); btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...'; btn.disabled = true;
    const rows = document.querySelectorAll('.bulk-row');
    
    const updatedData = Array.from(rows).map(row => 
    ({
        id: row.querySelector('.b_id').value,
        title: row.querySelector('.b_title').value.trim(),
        subtitle: row.querySelector('.b_subtitle').value.trim(),
        author: row.querySelector('.b_author').value,
        coAuthor: row.querySelector('.b_coauthor').value,
        spine: row.querySelector('.b_spine').value.trim(),
        publisher: row.querySelector('.b_publisher').value,
        bookType: row.querySelector('.b_booktype').value, 
        subject: row.querySelector('.b_subject').value,
        isbn: row.querySelector('.b_isbn').value.trim(),
        ddc: row.querySelector('.b_ddc').value,
        keywords: row.querySelector('.b_keywords').value.trim(),
        year: row.querySelector('.b_year').value.trim(),
        edition: row.querySelector('.b_edition').value.trim(),
        genre: row.querySelector('.b_genre').value.trim(),
        language: row.querySelector('.b_language').value, 
        shelf: row.querySelector('.b_shelf').value,
        shelfPos: row.querySelector('.b_shelfpos').value.trim(),
        pages: row.querySelector('.b_pages').value,
        isDonated: row.querySelector('.b_donate').checked,
        supplier: row.querySelector('.b_supplier').value,
        purchaseDate: row.querySelector('.b_purchasedate').value,
        billDate: row.querySelector('.b_billdate').value,
        billNo: row.querySelector('.b_billno').value.trim(),
        currency: row.querySelector('.b_currency').value, 
        price: row.querySelector('.b_price').value,
        library: row.querySelector('.b_library').value
    }));
    try {
        await safeFetchText({ action: 'bulk_update', sheet: 'Books', updates: updatedData });
        closeBulkUpdateModal();
        await fetchBooks(); 
    } catch (error) { alert("Bulk update failed!"); } 
    finally { btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Save All Changes';
    btn.disabled = false; }
}

window.exportBooksToExcel = function() {
    const searchText = (document.getElementById("bookSearch").value || "").toLowerCase();
    const statusVal = document.getElementById("statusFilter").value;
    let displayList = booksList.filter(book => {
        const bId = String(book.id || book['Book ID'] || '').trim();
        const bTitle = String(book.title || book['Title'] || '').toLowerCase();
        const bAuthor = String(book.author || book['Author'] || '').toLowerCase();
        let isAvailable = !issuedBookIds.includes(bId.toLowerCase());
        
        const matchSearch = bId.toLowerCase().includes(searchText) || bTitle.includes(searchText) || bAuthor.includes(searchText);
        let matchStatus = true;
    
        if (statusVal === "Available" && !isAvailable) matchStatus = false;
        if (statusVal === "Issued" && isAvailable) matchStatus = false;

        return matchSearch && matchStatus;
    });
    if (displayList.length === 0) { alert("No books found to export!"); return; }

    let csvData = "Book ID,Title,Author,Publisher,ISBN,DDC,Price,Status\n";
    displayList.forEach(book => {
        const bId = String(book.id || book['Book ID'] || '').trim();
        const bTitle = String(book.title || book['Title'] || '').replace(/"/g, '""');
        const bAuthor = String(book.author || book['Author'] || '').replace(/"/g, '""');
        const bPub = String(book.publisher || book['Publisher'] || '').replace(/"/g, '""');
        const bIsbn = String(book.isbn || book['ISBN'] || '').replace(/"/g, '""');
        const bDdc = String(book.ddc || book['DDC'] || '').replace(/"/g, '""');
  
        const bPrice = String(book.price || book['Price'] || '');
        
        let isAvailable = !issuedBookIds.includes(bId.toLowerCase());
        let statusText = isAvailable ? "Available" : "Issued";
        
        csvData += `"${bId}","${bTitle}","${bAuthor}","${bPub}","${bIsbn}","${bDdc}","${bPrice}","${statusText}"\n`;
    });

    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${new Date().toISOString().split('T')[0]}_Library_Books_Export.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

fetchBooks();