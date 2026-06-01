(function () {
    const API_BASE_URL = "/api/admin/notices";
    const NOTIFY_API_SUFFIX = "/notify";
    const DEFAULT_EMPTY_MESSAGE = "No notices added yet. Create your first announcement to get started.";

    async function fetchJson(url, options) {
        const response = await fetch(url, {
            headers: {
                "Content-Type": "application/json"
            },
            ...options
        });

        if (response.status === 204) {
            return null;
        }

        const payload = await response.json().catch(function () {
            return null;
        });

        if (!response.ok) {
            throw new Error(payload && payload.message ? payload.message : "Request failed.");
        }

        return payload;
    }

    function formatDate(dateString) {
        return new Date(dateString).toLocaleDateString("en-IN", {
            year: "numeric",
            month: "short",
            day: "numeric"
        });
    }

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function getStatusClass(status) {
        if (status === "Active") {
            return "status-active";
        }
        if (status === "Upcoming") {
            return "status-upcoming";
        }
        if (status === "Disabled") {
            return "status-disabled";
        }
        return "status-expired";
    }

    function setFeedback(message, isError) {
        const successElement = document.getElementById("adminNoticeSuccess");
        const errorElement = document.getElementById("adminNoticeError");

        if (!successElement || !errorElement) {
            return;
        }

        if (isError) {
            successElement.textContent = "";
            successElement.classList.add("hidden");
            errorElement.textContent = message;
            return;
        }

        errorElement.textContent = "";
        successElement.textContent = message;
        successElement.classList.remove("hidden");
    }

    function clearFeedback() {
        const successElement = document.getElementById("adminNoticeSuccess");
        const errorElement = document.getElementById("adminNoticeError");

        if (successElement) {
            successElement.textContent = "";
            successElement.classList.add("hidden");
        }
        if (errorElement) {
            errorElement.textContent = "";
        }
    }

    function setLoading(isLoading) {
        const submitButton = document.getElementById("submitNoticeButton");
        if (!submitButton) {
            return;
        }
        submitButton.disabled = isLoading;
        submitButton.textContent = isLoading
            ? "Saving..."
            : (document.getElementById("editingNoticeId").value ? "Update Notice" : "Add Notice");
    }

    function resetForm() {
        const form = document.getElementById("adminNoticeForm");
        const editingId = document.getElementById("editingNoticeId");
        const submitButton = document.getElementById("submitNoticeButton");
        const cancelButton = document.getElementById("cancelEditButton");

        if (!form || !editingId || !submitButton || !cancelButton) {
            return;
        }

        form.reset();
        editingId.value = "";
        submitButton.textContent = "Add Notice";
        submitButton.disabled = false;
        cancelButton.classList.add("hidden");
        clearFeedback();
    }

    function populateForm(notice) {
        document.getElementById("editingNoticeId").value = String(notice.id);
        document.getElementById("noticeTitle").value = notice.title || "";
        document.getElementById("noticeMessage").value = notice.message || "";
        document.getElementById("validFrom").value = notice.validFrom || "";
        document.getElementById("validTo").value = notice.validTo || "";
        document.getElementById("submitNoticeButton").textContent = "Update Notice";
        document.getElementById("cancelEditButton").classList.remove("hidden");
        clearFeedback();
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    async function loadNotices() {
        const list = document.getElementById("adminNoticeList");
        const emptyState = document.getElementById("adminNoticeEmpty");
        if (!list || !emptyState) {
            return;
        }

        list.innerHTML = "";
        emptyState.classList.add("hidden");
        emptyState.textContent = DEFAULT_EMPTY_MESSAGE;

        try {
            const notices = await fetchJson(API_BASE_URL, { method: "GET" });

            if (!notices.length) {
                emptyState.classList.remove("hidden");
                return;
            }

            notices.forEach(function (notice) {
                const card = document.createElement("article");
                card.className = "admin-notice-item";
                card.dataset.noticeJson = encodeURIComponent(JSON.stringify(notice));
                card.innerHTML = [
                    '<div class="admin-notice-item-header">',
                    "<div>",
                    '<span class="card-tag">Notice</span>',
                    "<h3>" + escapeHtml(notice.title) + "</h3>",
                    "</div>",
                    '<span class="status-badge ' + getStatusClass(notice.status) + '">' + notice.status + "</span>",
                    "</div>",
                    "<p>" + escapeHtml(notice.message).replace(/\n/g, "<br>") + "</p>",
                    '<div class="admin-notice-meta">',
                    "<span>Valid From: " + formatDate(notice.validFrom) + "</span>",
                    "<span>Valid To: " + formatDate(notice.validTo) + "</span>",
                    "</div>",
                    '<div class="admin-notice-actions">',
                    '<button class="mini-btn notify-btn" type="button" data-notice-id="' + notice.id + '">Notify</button>',
                    '<button class="mini-btn toggle-status-btn" type="button" data-notice-id="' + notice.id + '" data-active="' + notice.active + '">'
                        + (notice.active ? "Disable" : "Enable") + "</button>",
                    '<button class="mini-btn edit-btn" type="button" data-notice-id="' + notice.id + '">Edit</button>',
                    '<button class="mini-btn delete-btn" type="button" data-notice-id="' + notice.id + '">Delete</button>',
                    "</div>"
                ].join("");
                list.appendChild(card);
            });

        } catch (error) {
            console.error("Failed to load notices:", error);
            emptyState.classList.remove("hidden");
            emptyState.textContent = error.message || "Unable to load notices right now.";
        }
    }

    async function handleDeleteNotice(noticeId) {
        try {
            clearFeedback();
            await fetchJson(API_BASE_URL + "/" + noticeId, {
                method: "DELETE"
            });
            if (document.getElementById("editingNoticeId").value === String(noticeId)) {
                resetForm();
            }
            setFeedback("Notice deleted successfully.", false);
            await loadNotices();
        } catch (error) {
            console.error("Delete notice failed:", noticeId, error);
            setFeedback(error.message || "Unable to delete notice.", true);
        }
    }

    async function handleToggleNoticeStatus(button) {
        const noticeId = button.dataset.noticeId;
        const currentState = button.dataset.active === "true";

        try {
            clearFeedback();
            await fetchJson(API_BASE_URL + "/" + noticeId + "/status?active=" + (!currentState), {
                method: "PATCH"
            });
            setFeedback("Notice status updated successfully.", false);
            await loadNotices();
        } catch (error) {
            console.error("Toggle notice status failed:", noticeId, error);
            setFeedback(error.message || "Unable to update notice status.", true);
        }
    }

    async function handleNotifyNotice(noticeId) {
        try {
            clearFeedback();
            const response = await fetchJson(API_BASE_URL + "/" + noticeId + NOTIFY_API_SUFFIX, {
                method: "POST"
            });
            const message = typeof response === "string" ? response : "Notification sent successfully.";
            setFeedback(message, false);
        } catch (error) {
            console.error("Notify notice failed:", noticeId, error);
            setFeedback(error.message || "Unable to send notice notification.", true);
        }
    }

    function findNoticeFromCard(button) {
        const card = button.closest(".admin-notice-item");
        if (!card || !card.dataset.noticeJson) {
            return null;
        }

        try {
            return JSON.parse(decodeURIComponent(card.dataset.noticeJson));
        } catch (error) {
            console.error("Failed to parse notice payload from card:", error);
            return null;
        }
    }

    function bindNoticeActions() {
        const list = document.getElementById("adminNoticeList");
        if (!list || list.dataset.bound === "true") {
            return;
        }

        list.addEventListener("click", async function (event) {
            const notifyButton = event.target.closest(".notify-btn");
            if (notifyButton) {
                event.preventDefault();
                await handleNotifyNotice(notifyButton.dataset.noticeId);
                return;
            }

            const editButton = event.target.closest(".edit-btn");
            if (editButton) {
                event.preventDefault();
                const notice = findNoticeFromCard(editButton);
                if (!notice) {
                    setFeedback("Unable to load notice details for editing.", true);
                    return;
                }
                populateForm(notice);
                return;
            }

            const deleteButton = event.target.closest(".delete-btn");
            if (deleteButton) {
                event.preventDefault();
                if (!window.confirm("Delete this notice?")) {
                    return;
                }
                await handleDeleteNotice(deleteButton.dataset.noticeId);
                return;
            }

            const toggleButton = event.target.closest(".toggle-status-btn");
            if (toggleButton) {
                event.preventDefault();
                await handleToggleNoticeStatus(toggleButton);
            }
        });

        list.dataset.bound = "true";
    }

    function buildPayload(form) {
        return {
            title: form.elements.title.value.trim(),
            message: form.elements.message.value.trim(),
            validFrom: form.elements.validFrom.value,
            validTo: form.elements.validTo.value
        };
    }

    function validatePayload(payload) {
        if (!payload.title || !payload.message || !payload.validFrom || !payload.validTo) {
            return "All fields are required.";
        }
        if (payload.validTo < payload.validFrom) {
            return "Valid To Date must be greater than or equal to Valid From Date.";
        }
        return "";
    }

    function setupForm() {
        const form = document.getElementById("adminNoticeForm");
        if (!form) {
            return;
        }

        document.getElementById("cancelEditButton").addEventListener("click", resetForm);

        form.addEventListener("submit", async function (event) {
            event.preventDefault();

            const payload = buildPayload(form);
            const validationMessage = validatePayload(payload);
            if (validationMessage) {
                setFeedback(validationMessage, true);
                return;
            }

            const editingNoticeId = document.getElementById("editingNoticeId").value;

            try {
                clearFeedback();
                setLoading(true);

                await fetchJson(editingNoticeId ? API_BASE_URL + "/" + editingNoticeId : API_BASE_URL, {
                    method: editingNoticeId ? "PUT" : "POST",
                    body: JSON.stringify(payload)
                });

                resetForm();
                setFeedback(editingNoticeId ? "Notice updated successfully." : "Notice created successfully.", false);
                await loadNotices();
            } catch (error) {
                setFeedback(error.message || "Unable to save notice.", true);
            } finally {
                setLoading(false);
            }
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        if (!document.getElementById("adminNoticeForm")) {
            return;
        }

        setupForm();
        bindNoticeActions();
        loadNotices();
    });
})();
