document.addEventListener("DOMContentLoaded", function () {

    // Mobile menu
    const menuBtn = document.getElementById("menuBtn");
    const sidebar = document.getElementById("sidebar");

    if (menuBtn && sidebar) {
        menuBtn.addEventListener("click", function () {
            sidebar.classList.toggle("active");
        });
    }

    // Dashboard demo data
    const data = {
        users: 10,
        admins: 10,
        channels: 3,
        videos: 0
    };

    const totalUsers = document.getElementById("totalUsers");
    const totalAdmins = document.getElementById("totalAdmins");
    const totalChannels = document.getElementById("totalChannels");
    const totalVideos = document.getElementById("totalVideos");

    if (totalUsers) totalUsers.textContent = data.users;
    if (totalAdmins) totalAdmins.textContent = data.admins;
    if (totalChannels) totalChannels.textContent = data.channels;
    if (totalVideos) totalVideos.textContent = data.videos;

    // Navigation
    const navLinks = document.querySelectorAll(".nav-link");

    navLinks.forEach(function (link) {
        link.addEventListener("click", function () {

            navLinks.forEach(function (item) {
                item.classList.remove("active");
            });

            this.classList.add("active");

            if (window.innerWidth < 950 && sidebar) {
                sidebar.classList.remove("active");
            }
        });
    });

});
