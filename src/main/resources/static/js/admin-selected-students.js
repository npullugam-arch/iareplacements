(function () {
    const SELECTED_STUDENTS_API = "/api/admin/selected-students";
    const DRIVES_API = "/api/admin/placement-drives";
    const DEFAULT_EMPTY_MESSAGE = "No selected student records added yet. Create your first record to get started.";
    let drives = [];

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
            console.error("Admin selected students request failed:", {
                url: url,
                status: response.status,
                payload: payload
            });

            const validationErrors = payload && Array.isArray(payload.errors) ? payload.errors.join(" ") : "";
            const errorMessage = payload && (payload.message || payload.detail || payload.error || payload.title);
            throw new Error(errorMessage || validationErrors || "Unable to save selected student record.");
        }

        return payload;
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function formatSelectionYear(value) {
        const normalized = String(value == null ? "" : value).trim();
        return normalized || "N/A";
    }

    function setFeedback(message, isError) {
        const successElement = document.getElementById("selectedStudentSuccess");
        const errorElement = document.getElementById("selectedStudentError");

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
        const successElement = document.getElementById("selectedStudentSuccess");
        const errorElement = document.getElementById("selectedStudentError");

        successElement.textContent = "";
        successElement.classList.add("hidden");
        errorElement.textContent = "";
    }

    function setLoading(isLoading) {
        const submitButton = document.getElementById("submitSelectedStudentButton");
        submitButton.disabled = isLoading;
        submitButton.textContent = isLoading
            ? "Saving..."
            : (document.getElementById("editingSelectedStudentId").value ? "Update Student" : "Add Student");
    }

    function renderDriveOptions() {
        const select = document.getElementById("selectedPlacementDriveId");
        select.innerHTML = '<option value="">Select placement drive</option>';

        drives.forEach(function (drive) {
            const option = document.createElement("option");
            option.value = String(drive.id);
            option.textContent = drive.companyName + " - " + drive.driveTitle + " (" + drive.hiringYear + ")";
            select.appendChild(option);
        });
    }

    function renderDrivePreview(placementDriveId) {
        const preview = document.getElementById("selectedDrivePreview");
        if (!placementDriveId) {
            preview.classList.add("hidden");
            preview.innerHTML = "";
            return;
        }

        const drive = drives.find(function (item) {
            return String(item.id) === String(placementDriveId);
        });

        if (!drive) {
            preview.classList.add("hidden");
            preview.innerHTML = "";
            return;
        }

        const logoMarkup = drive.companyLogoUrl
            ? '<img class="selected-drive-logo" src="' + escapeHtml(drive.companyLogoUrl) + '" alt="' + escapeHtml(drive.companyName) + ' logo">'
            : '<div class="selected-drive-logo"></div>';

        preview.innerHTML = [
            logoMarkup,
            "<div>",
            "<strong>" + escapeHtml(drive.companyName) + "</strong>",
            "<p>" + escapeHtml(drive.driveTitle) + " | " + escapeHtml(drive.hiringYear) + " | " + formatDate(drive.hiringDate) + "</p>",
            "</div>"
        ].join("");
        preview.classList.remove("hidden");
    }

    async function loadDrives() {
        drives = await fetchJson(DRIVES_API, { method: "GET" });
        renderDriveOptions();
    }

    function resetForm() {
        const form = document.getElementById("selectedStudentForm");
        form.reset();
        document.getElementById("editingSelectedStudentId").value = "";
        document.getElementById("submitSelectedStudentButton").textContent = "Add Student";
        document.getElementById("submitSelectedStudentButton").disabled = false;
        document.getElementById("cancelSelectedStudentEditButton").classList.add("hidden");
        renderDrivePreview("");
        clearFeedback();
    }

    function populateForm(student) {
        document.getElementById("editingSelectedStudentId").value = String(student.id);
        document.getElementById("selectedPlacementDriveId").value = String(student.placementDriveId);
        document.getElementById("studentName").value = student.studentName || "";
        document.getElementById("rollNumber").value = student.rollNumber || "";
        document.getElementById("branch").value = student.branch || "";
        document.getElementById("gender").value = student.gender || "";
        document.getElementById("photoUrl").value = student.photoUrl || "";
        document.getElementById("packageOffered").value = student.packageOffered || "";
        document.getElementById("offerType").value = student.offerType || "";
        document.getElementById("selectionYear").value = student.selectionYear || "";
        document.getElementById("submitSelectedStudentButton").textContent = "Update Student";
        document.getElementById("cancelSelectedStudentEditButton").classList.remove("hidden");
        renderDrivePreview(student.placementDriveId);
        clearFeedback();
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function buildPayload(form) {
        return {
            placementDriveId: form.elements.placementDriveId.value ? Number(form.elements.placementDriveId.value) : null,
            studentName: form.elements.studentName.value.trim(),
            rollNumber: form.elements.rollNumber.value.trim(),
            branch: form.elements.branch.value.trim(),
            gender: form.elements.gender.value,
            photoUrl: form.elements.photoUrl.value.trim(),
            packageOffered: form.elements.packageOffered.value.trim(),
            offerType: form.elements.offerType.value,
            selectionYear: form.elements.selectionYear.value ? Number(form.elements.selectionYear.value) : null
        };
    }

    function validatePayload(payload) {
        if (!payload.placementDriveId || !payload.studentName || !payload.rollNumber || !payload.branch
            || !payload.gender || !payload.packageOffered || !payload.offerType || !payload.selectionYear) {
            return "Please fill all required selected student fields.";
        }
        return "";
    }

    function getLogoMarkup(student) {
        if (student.companyLogoUrl) {
            return '<img class="selected-company-logo" src="' + escapeHtml(student.companyLogoUrl) + '" alt="' + escapeHtml(student.companyName) + ' logo">';
        }
        return '<div class="selected-company-logo"></div>';
    }

    function getPhotoMarkup(student) {
        if (student.photoUrl) {
            return '<img class="selected-student-photo" src="' + escapeHtml(student.photoUrl) + '" alt="' + escapeHtml(student.studentName) + ' photo">';
        }
        return '<div class="selected-student-photo"></div>';
    }

    async function loadSelectedStudents() {
        const loadingElement = document.getElementById("adminSelectedStudentsLoading");
        const list = document.getElementById("adminSelectedStudentsList");
        const emptyState = document.getElementById("adminSelectedStudentsEmpty");

        loadingElement.classList.remove("hidden");
        list.innerHTML = "";
        emptyState.classList.add("hidden");
        emptyState.textContent = DEFAULT_EMPTY_MESSAGE;

        try {
            const students = await fetchJson(SELECTED_STUDENTS_API, { method: "GET" });
            loadingElement.classList.add("hidden");

            if (!students.length) {
                emptyState.classList.remove("hidden");
                return;
            }

            students.forEach(function (student) {
                const card = document.createElement("article");
                card.className = "admin-selected-item";
                card.innerHTML = [
                    '<div class="selected-header">',
                    '<div class="selected-header-main">',
                    getLogoMarkup(student),
                    "<div>",
                    "<h3>" + escapeHtml(student.driveTitle) + "</h3>",
                    "<p>" + escapeHtml(student.companyName) + " | Hiring Year " + escapeHtml(student.hiringYear) + "</p>",
                    "</div>",
                    "</div>",
                    '<span class="active-badge ' + (student.active ? "active-enabled" : "active-disabled") + '">' + (student.active ? "Active" : "Disabled") + "</span>",
                    "</div>",
                    '<div class="selected-badges">',
                    '<span class="offer-type-badge">' + escapeHtml(student.offerType) + "</span>",
                    '<span class="badge-pill">' + escapeHtml(student.packageOffered) + "</span>",
                    "</div>",
                    '<div class="selected-student-row">',
                    getPhotoMarkup(student),
                    '<div class="selected-student-group">',
                    "<div>",
                    "<h4>" + escapeHtml(student.studentName) + "</h4>",
                    "<p>" + escapeHtml(student.rollNumber) + " | " + escapeHtml(student.branch) + "</p>",
                    "</div>",
                    "</div>",
                    "</div>",
                    '<div class="selected-meta">',
                    "<span>Gender: " + escapeHtml(student.gender) + "</span>",
                    "<span>Selection Year: " + escapeHtml(formatSelectionYear(student.selectionYear)) + "</span>",
                    "</div>",
                    '<div class="selected-actions">',
                    '<button class="mini-btn toggle-selected-btn" type="button" data-selected-id="' + student.id + '" data-active="' + student.active + '">'
                        + (student.active ? "Disable" : "Enable") + "</button>",
                    '<button class="mini-btn edit-selected-btn" type="button" data-selected-json="' + encodeURIComponent(JSON.stringify(student)) + '">Edit</button>',
                    '<button class="mini-btn delete-btn" type="button" data-selected-id="' + student.id + '">Delete</button>',
                    "</div>"
                ].join("");
                list.appendChild(card);
            });

            bindSelectedStudentActions();
        } catch (error) {
            loadingElement.classList.add("hidden");
            emptyState.textContent = error.message || "Unable to load selected student records right now.";
            emptyState.classList.remove("hidden");
        }
    }

    function bindSelectedStudentActions() {
        document.querySelectorAll(".edit-selected-btn").forEach(function (button) {
            button.addEventListener("click", function () {
                populateForm(JSON.parse(decodeURIComponent(button.dataset.selectedJson)));
            });
        });

        document.querySelectorAll(".delete-btn").forEach(function (button) {
            button.addEventListener("click", async function () {
                if (!window.confirm("Delete this selected student record?")) {
                    return;
                }

                try {
                    clearFeedback();
                    await fetchJson(SELECTED_STUDENTS_API + "/" + button.dataset.selectedId, { method: "DELETE" });
                    if (document.getElementById("editingSelectedStudentId").value === button.dataset.selectedId) {
                        resetForm();
                    }
                    setFeedback("Selected student record deleted successfully.", false);
                    await loadSelectedStudents();
                } catch (error) {
                    setFeedback(error.message || "Unable to delete selected student record.", true);
                }
            });
        });

        document.querySelectorAll(".toggle-selected-btn").forEach(function (button) {
            button.addEventListener("click", async function () {
                const currentState = button.dataset.active === "true";

                try {
                    clearFeedback();
                    await fetchJson(SELECTED_STUDENTS_API + "/" + button.dataset.selectedId + "/status?active=" + (!currentState), {
                        method: "PATCH"
                    });
                    setFeedback("Selected student status updated successfully.", false);
                    await loadSelectedStudents();
                } catch (error) {
                    setFeedback(error.message || "Unable to update selected student status.", true);
                }
            });
        });
    }

    function setupForm() {
        const form = document.getElementById("selectedStudentForm");
        if (!form) {
            return;
        }

        document.getElementById("selectedPlacementDriveId").addEventListener("change", function () {
            renderDrivePreview(this.value);
        });

        document.getElementById("cancelSelectedStudentEditButton").addEventListener("click", resetForm);

        form.addEventListener("submit", async function (event) {
            event.preventDefault();

            const payload = buildPayload(form);
            console.log("Admin selected student payload:", payload);
            const validationMessage = validatePayload(payload);
            if (validationMessage) {
                setFeedback(validationMessage, true);
                return;
            }

            const editingSelectedStudentId = document.getElementById("editingSelectedStudentId").value;

            try {
                clearFeedback();
                setLoading(true);
                await fetchJson(editingSelectedStudentId ? SELECTED_STUDENTS_API + "/" + editingSelectedStudentId : SELECTED_STUDENTS_API, {
                    method: editingSelectedStudentId ? "PUT" : "POST",
                    body: JSON.stringify(payload)
                });
                resetForm();
                setFeedback(editingSelectedStudentId ? "Selected student record updated successfully." : "Selected student record created successfully.", false);
                await loadSelectedStudents();
            } catch (error) {
                setFeedback(error.message || "Unable to save selected student record.", true);
            } finally {
                setLoading(false);
            }
        });
    }

    document.addEventListener("DOMContentLoaded", async function () {
        if (!document.getElementById("selectedStudentForm")) {
            return;
        }

        try {
            await loadDrives();
            setupForm();
            await loadSelectedStudents();
        } catch (error) {
            setFeedback(error.message || "Unable to initialize selected student management.", true);
        }
    });
})();
