document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("loginForm");

    if (!form) return;

    form.addEventListener("submit", function (event) {
        event.preventDefault();

        const email = document.getElementById("adminEmail").value.trim();
        const password = document.getElementById("adminPassword").value.trim();
        const message = document.getElementById("loginMessage");

        if (email === "admin@proincome.com" && password === "123456") {
            message.textContent = "Login successful!";

            setTimeout(function () {
                window.location.href = "../index.html";
            }, 800);
        } else {
            message.textContent = "Invalid email or password.";
        }
    });
});
