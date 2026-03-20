function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('collapsed');
}

function switchTab(pageUrl, element) {
    // Update active class
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    element.classList.add('active');
    
    // Change iframe source
    document.getElementById('main-frame').src = pageUrl;
}