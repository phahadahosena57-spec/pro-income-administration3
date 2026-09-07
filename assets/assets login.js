document.getElementById("loginForm").addEventListener("submit", function(event) {
    event.preventDefault();

    const email = document.getElementById("adminEmail").value;
    const password = document.getElementById("adminPassword").value;
    const message = document.getElementById("loginMessage");

    if (email === "" || password === "") {
        message.textContent = "Please enter email and password.";
        return;
    }

    message.textContent = "Login system is ready.";
});
