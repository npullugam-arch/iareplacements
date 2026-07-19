(function () {
    var AI_ENDPOINT = "/api/student/ai-chat";
    var FALLBACK_ERROR = "Sorry, the placement assistant is temporarily unavailable. Please try again.";
    var THINKING_TEXT = "IARE AI is thinking...";
    var REQUEST_TIMEOUT_MS = 30000;
    var isSubmitting = false;

    function ensureStudentAuth() {
        var authState = window.PlacementPortalAuth ? window.PlacementPortalAuth.getAuthState() : null;
        if (!authState || String(authState.role || "").toLowerCase() !== "student") {
            window.location.replace("/student-login.html");
            return false;
        }
        return true;
    }

    function scrollMessagesToBottom() {
        var messages = document.getElementById("chatMessages");
        messages.scrollTop = messages.scrollHeight;
    }

    function resizeTextarea(textarea) {
        textarea.style.height = "auto";
        textarea.style.height = Math.min(textarea.scrollHeight, 180) + "px";
    }

    function setBusyState(isBusy) {
        var sendBtn = document.getElementById("sendBtn");
        var chatInput = document.getElementById("chatInput");
        var chatStatus = document.getElementById("chatStatus");
        var chips = document.querySelectorAll(".suggestion-chip");

        sendBtn.disabled = isBusy;
        chatInput.disabled = isBusy;
        chatStatus.textContent = isBusy ? "Thinking" : "Ready";

        chips.forEach(function (chip) {
            chip.disabled = isBusy;
        });
    }

    function appendMessage(type, text) {
        var messages = document.getElementById("chatMessages");
        var row = document.createElement("article");
        row.className = "message-row " + type;

        if (type === "user") {
            row.innerHTML = '<div class="message-bubble"><p></p></div><div class="message-avatar user-avatar">You</div>';
        } else {
            row.innerHTML = '<div class="message-avatar">AI</div><div class="message-bubble"><p></p></div>';
        }

        row.querySelector("p").textContent = text;
        messages.appendChild(row);
        scrollMessagesToBottom();
        return row;
    }

    function appendThinkingMessage() {
        var messages = document.getElementById("chatMessages");
        var row = document.createElement("article");
        row.className = "message-row bot thinking";
        row.innerHTML = ''
            + '<div class="message-avatar">AI</div>'
            + '<div class="message-bubble">'
            + '  <div class="thinking-text">'
            + '    <span>' + THINKING_TEXT + '</span>'
            + '    <span class="thinking-dots" aria-hidden="true"><span></span><span></span><span></span></span>'
            + '  </div>'
            + '</div>';

        messages.appendChild(row);
        scrollMessagesToBottom();
        return row;
    }

    function removeElement(element) {
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }
    }

    async function requestAiAnswer(userMessage) {
        var authState = window.PlacementPortalAuth ? window.PlacementPortalAuth.getAuthState() : null;
        var studentId = authState && authState.studentId ? String(authState.studentId) : "";

        var controller = new AbortController();
        var timeoutId = window.setTimeout(function () {
            controller.abort();
        }, REQUEST_TIMEOUT_MS);

        try {
            var response = await fetch(AI_ENDPOINT, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Student-Id": studentId
                },
                credentials: "same-origin",
                body: JSON.stringify({ message: userMessage }),
                signal: controller.signal
            });

            if (!response.ok) {
                console.error("AI status:", response.status);
                console.error("AI response:", await response.text());
                throw new Error(FALLBACK_ERROR);
            }

            var data = await response.json();
            var aiText = data.reply || data.answer || "";
            if (!String(aiText || "").trim()) {
                throw new Error(FALLBACK_ERROR);
            }
            return String(aiText).trim();
        } finally {
            window.clearTimeout(timeoutId);
        }
    }

    async function sendMessage(messageText) {
        if (isSubmitting) {
            return;
        }

        var chatInput = document.getElementById("chatInput");
        var trimmedMessage = String(messageText || "").trim();
        if (!trimmedMessage) {
            return;
        }

        isSubmitting = true;
        appendMessage("user", trimmedMessage);
        chatInput.value = "";
        resizeTextarea(chatInput);
        setBusyState(true);

        var thinkingRow = appendThinkingMessage();

        try {
            var answer = await requestAiAnswer(trimmedMessage);
            removeElement(thinkingRow);
            appendMessage("bot", answer);
        } catch (error) {
            removeElement(thinkingRow);
            appendMessage("bot", FALLBACK_ERROR);
            console.error("Student AI chatbot request failed:", error);
        } finally {
            setBusyState(false);
            isSubmitting = false;
            chatInput.focus();
        }
    }

    document.addEventListener("DOMContentLoaded", function () {
        if (!ensureStudentAuth()) {
            return;
        }

        var form = document.getElementById("chatForm");
        var input = document.getElementById("chatInput");
        var chips = document.querySelectorAll(".suggestion-chip");

        input.focus();
        resizeTextarea(input);

        input.addEventListener("input", function () {
            resizeTextarea(input);
        });

        input.addEventListener("keydown", function (event) {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (!document.getElementById("sendBtn").disabled) {
                    sendMessage(input.value);
                }
            }
        });

        form.addEventListener("submit", function (event) {
            event.preventDefault();
            if (!document.getElementById("sendBtn").disabled) {
                sendMessage(input.value);
            }
        });

        chips.forEach(function (chip) {
            chip.addEventListener("click", function () {
                sendMessage(chip.textContent || "");
            });
        });

        scrollMessagesToBottom();
    });
})();
