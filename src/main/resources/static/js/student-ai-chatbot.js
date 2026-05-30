(function () {
    function ensureStudentAuth() {
        const authState = window.PlacementPortalAuth ? window.PlacementPortalAuth.getAuthState() : null;
        if (!authState || String(authState.role || "").toLowerCase() !== "student") {
            window.location.replace("/student-login.html");
            return false;
        }
        return true;
    }

    function appendMessage(type, text) {
        const messages = document.getElementById("chatMessages");
        const row = document.createElement("article");
        row.className = "message-row " + type;

        if (type === "user") {
            row.innerHTML = '<div class="message-bubble"><p></p></div><div class="message-avatar user-avatar">You</div>';
        } else {
            row.innerHTML = '<div class="message-avatar">AI</div><div class="message-bubble"><p></p></div>';
        }

        row.querySelector("p").textContent = text;
        messages.appendChild(row);
        messages.scrollTop = messages.scrollHeight;
    }

    document.addEventListener("DOMContentLoaded", function () {
        if (!ensureStudentAuth()) {
            return;
        }

        const form = document.getElementById("chatForm");
        const input = document.getElementById("chatInput");

        form.addEventListener("submit", function (event) {
            event.preventDefault();
            const value = input.value.trim();
            if (!value) {
                return;
            }

            appendMessage("user", value);
            input.value = "";

            window.setTimeout(function () {
                appendMessage("bot", "This demo page is ready for backend integration. For now, focus on resume keywords, core DSA revision, aptitude practice, and your project explanations.");
            }, 450);
        });
    });
})();
