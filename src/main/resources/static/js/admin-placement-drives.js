(function () {
    const DRIVES_API = "/api/admin/placement-drives";
    const DRIVE_UPLOAD_API = "/api/admin/placement-drives/upload";
    const COMPANIES_API = "/api/admin/companies";
    const DEFAULT_EMPTY_MESSAGE = "No placement drives added yet. Create your first drive to get started.";
    const DRIVE_TEMPLATE_HEADERS = [
        "S.No",
        "Company",
        "Drive Title",
        "Hiring Year",
        "Hiring Date",
        "Hiring Mode",
        "Hiring Location",
        "Drive Status",
        "Eligible Branches",
        "Eligible CGPA",
        "Job Type",
        "CTC Package",
        "Stipend",
        "Bond Details",
        "Backlogs Allowed",
        "Max Backlogs",
        "No. of Rounds",
        "Round Names",
        "Registration Deadline",
        "Exam Date",
        "Interview Date",
        "Description"
    ];
    let companies = [];

    async function fetchJson(url, options) {
        const requestOptions = { ...(options || {}) };
        const headers = { ...(requestOptions.headers || {}) };

        if (!(requestOptions.body instanceof FormData) && !headers["Content-Type"]) {
            headers["Content-Type"] = "application/json";
        }

        const response = await fetch(url, {
            ...requestOptions,
            headers
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

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function formatDate(dateString) {
        if (!dateString) {
            return "";
        }
        return new Date(dateString).toLocaleDateString("en-IN", {
            year: "numeric",
            month: "short",
            day: "numeric"
        });
    }

    function setFeedback(message, isError) {
        const successElement = document.getElementById("driveSuccess");
        const errorElement = document.getElementById("driveError");

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
        const successElement = document.getElementById("driveSuccess");
        const errorElement = document.getElementById("driveError");

        successElement.textContent = "";
        successElement.classList.add("hidden");
        errorElement.textContent = "";
    }

    function setUploadFeedback(message, isError) {
        const successElement = document.getElementById("placementDriveUploadSuccess");
        const errorElement = document.getElementById("placementDriveUploadError");
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

    function clearUploadFeedback() {
        const successElement = document.getElementById("placementDriveUploadSuccess");
        const errorElement = document.getElementById("placementDriveUploadError");
        if (!successElement || !errorElement) {
            return;
        }

        successElement.textContent = "";
        successElement.classList.add("hidden");
        errorElement.textContent = "";
    }

    function setLoading(isLoading) {
        const submitButton = document.getElementById("submitDriveButton");
        submitButton.disabled = isLoading;
        submitButton.textContent = isLoading
            ? "Saving..."
            : (document.getElementById("editingDriveId").value ? "Update Drive" : "Add Drive");
    }

    function setUploadLoading(isLoading) {
        const uploadButton = document.getElementById("placementDriveUploadButton");
        if (!uploadButton) {
            return;
        }

        uploadButton.disabled = isLoading;
        uploadButton.textContent = isLoading ? "Uploading..." : "Upload Drives";
    }

    function renderCompanyOptions() {
        const select = document.getElementById("companyId");
        select.innerHTML = '<option value="">Select company</option>';

        companies.forEach(function (company) {
            const option = document.createElement("option");
            option.value = String(company.id);
            option.textContent = company.companyName;
            select.appendChild(option);
        });
    }

    function renderCompanyPreview(companyId) {
        const preview = document.getElementById("companyPreview");
        if (!companyId) {
            preview.classList.add("hidden");
            preview.innerHTML = "";
            return;
        }

        const company = companies.find(function (item) {
            return String(item.id) === String(companyId);
        });

        if (!company) {
            preview.classList.add("hidden");
            preview.innerHTML = "";
            return;
        }

        const logoMarkup = company.logoUrl
            ? '<img class="company-preview-logo" src="' + escapeHtml(company.logoUrl) + '" alt="' + escapeHtml(company.companyName) + ' logo">'
            : '<div class="company-preview-logo"></div>';

        preview.innerHTML = [
            logoMarkup,
            "<div>",
            "<strong>" + escapeHtml(company.companyName) + "</strong>",
            "<p>" + escapeHtml(company.companyType) + " | " + escapeHtml(company.industry) + "</p>",
            "</div>"
        ].join("");
        preview.classList.remove("hidden");
    }

    async function loadCompanies() {
        companies = await fetchJson(COMPANIES_API, { method: "GET" });
        renderCompanyOptions();
    }

    function resetForm() {
        const form = document.getElementById("placementDriveForm");
        form.reset();
        document.getElementById("editingDriveId").value = "";
        document.getElementById("submitDriveButton").textContent = "Add Drive";
        document.getElementById("submitDriveButton").disabled = false;
        document.getElementById("cancelDriveEditButton").classList.add("hidden");
        renderCompanyPreview("");
        clearFeedback();
    }

    function setUploadSummary(summary) {
        const summaryCard = document.getElementById("placementDriveUploadSummary");
        const totalRows = document.getElementById("placementDriveSummaryTotalRows");
        const successCount = document.getElementById("placementDriveSummarySuccess");
        const failedCount = document.getElementById("placementDriveSummaryFailed");
        const errorList = document.getElementById("placementDriveUploadErrors");

        if (!summaryCard || !totalRows || !successCount || !failedCount || !errorList) {
            return;
        }

        totalRows.textContent = String(summary.totalRows || 0);
        successCount.textContent = String(summary.successCount || 0);
        failedCount.textContent = String(summary.failedCount || 0);

        errorList.innerHTML = "";
        (summary.errors || []).forEach(function (error) {
            const item = document.createElement("li");
            const companyLabel = error.companyName ? " (" + error.companyName + ")" : "";
            item.textContent = "Row " + error.rowNumber + companyLabel + ": " + error.reason;
            errorList.appendChild(item);
        });

        if (!(summary.errors || []).length) {
            const item = document.createElement("li");
            item.textContent = "No row errors.";
            errorList.appendChild(item);
        }

        summaryCard.classList.remove("hidden");
    }

    function buildUploadErrorMessage(payload) {
        if (!payload) {
            return "Unable to upload placement drive Excel.";
        }

        if (payload.message && payload.error) {
            return payload.message + ": " + payload.error;
        }

        return payload.message || payload.error || "Unable to upload placement drive Excel.";
    }

    function populateForm(drive) {
        document.getElementById("editingDriveId").value = String(drive.id);
        document.getElementById("companyId").value = String(drive.companyId);
        document.getElementById("driveTitle").value = drive.driveTitle || "";
        document.getElementById("hiringYear").value = drive.hiringYear || "";
        document.getElementById("hiringDate").value = drive.hiringDate || "";
        document.getElementById("hiringMode").value = drive.hiringMode || "";
        document.getElementById("hiringLocation").value = drive.hiringLocation || "";
        document.getElementById("eligibleBranches").value = drive.eligibleBranches || "";
        document.getElementById("eligibleCgpa").value = drive.eligibleCgpa || "";
        document.getElementById("backlogsAllowed").value = String(Boolean(drive.backlogsAllowed));
        document.getElementById("maxBacklogs").value = drive.maxBacklogs ?? "";
        document.getElementById("bondDetails").value = drive.bondDetails || "";
        document.getElementById("jobType").value = drive.jobType || "";
        document.getElementById("ctcPackage").value = drive.ctcPackage || "";
        document.getElementById("stipend").value = drive.stipend || "";
        document.getElementById("numberOfRounds").value = drive.numberOfRounds ?? "";
        document.getElementById("roundNames").value = drive.roundNames || "";
        document.getElementById("registrationDeadline").value = drive.registrationDeadline || "";
        document.getElementById("examDate").value = drive.examDate || "";
        document.getElementById("interviewDate").value = drive.interviewDate || "";
        document.getElementById("driveStatus").value = drive.driveStatus || "";
        document.getElementById("description").value = drive.description || "";
        document.getElementById("submitDriveButton").textContent = "Update Drive";
        document.getElementById("cancelDriveEditButton").classList.remove("hidden");
        renderCompanyPreview(drive.companyId);
        clearFeedback();
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function buildPayload(form) {
        const companyId = form.elements.companyId.value ? Number(form.elements.companyId.value) : null;
        const hiringYear = form.elements.hiringYear.value ? Number(form.elements.hiringYear.value) : null;
        const selectedCompany = companies.find(function (company) {
            return String(company.id) === String(companyId);
        });
        const enteredDriveTitle = form.elements.driveTitle.value.trim();

        return {
            companyId: companyId,
            driveTitle: enteredDriveTitle || buildGeneratedDriveTitle(selectedCompany ? selectedCompany.companyName : "", hiringYear),
            hiringYear: hiringYear,
            hiringDate: form.elements.hiringDate.value,
            hiringMode: form.elements.hiringMode.value,
            hiringLocation: form.elements.hiringLocation.value.trim(),
            eligibleBranches: form.elements.eligibleBranches.value.trim(),
            eligibleCgpa: form.elements.eligibleCgpa.value ? Number(form.elements.eligibleCgpa.value) : null,
            backlogsAllowed: form.elements.backlogsAllowed.value === "true",
            maxBacklogs: form.elements.maxBacklogs.value ? Number(form.elements.maxBacklogs.value) : null,
            bondDetails: form.elements.bondDetails.value.trim(),
            jobType: form.elements.jobType.value,
            ctcPackage: form.elements.ctcPackage.value.trim(),
            stipend: form.elements.stipend.value.trim(),
            numberOfRounds: form.elements.numberOfRounds.value ? Number(form.elements.numberOfRounds.value) : null,
            roundNames: form.elements.roundNames.value.trim(),
            registrationDeadline: form.elements.registrationDeadline.value || null,
            examDate: form.elements.examDate.value || null,
            interviewDate: form.elements.interviewDate.value || null,
            driveStatus: form.elements.driveStatus.value,
            description: form.elements.description.value.trim()
        };
    }

    function validatePayload(payload) {
        if (!payload.companyId || !payload.hiringYear || !payload.hiringDate || !payload.hiringMode
            || !payload.eligibleBranches || payload.eligibleCgpa === null || !payload.jobType || !payload.ctcPackage || !payload.driveStatus) {
            return "Please fill all required fields for the placement drive.";
        }
        if (payload.eligibleCgpa < 0 || payload.eligibleCgpa > 10) {
            return "Eligible CGPA must be between 0 and 10.";
        }
        if (payload.maxBacklogs !== null && payload.maxBacklogs < 0) {
            return "Maximum Backlogs cannot be negative.";
        }
        if (payload.numberOfRounds !== null && payload.numberOfRounds < 0) {
            return "Number of Rounds cannot be negative.";
        }
        if (payload.registrationDeadline && payload.hiringDate && payload.registrationDeadline > payload.hiringDate) {
            return "Registration Deadline cannot be after Hiring Date.";
        }
        return "";
    }

    function getStatusClass(status) {
        const normalized = (status || "").toLowerCase();
        if (normalized === "upcoming") {
            return "status-upcoming";
        }
        if (normalized === "ongoing") {
            return "status-ongoing";
        }
        if (normalized === "completed") {
            return "status-completed";
        }
        return "status-closed";
    }

    function getLogoMarkup(drive) {
        if (drive.companyLogoUrl) {
            return '<img class="drive-company-logo" src="' + escapeHtml(drive.companyLogoUrl) + '" alt="' + escapeHtml(drive.companyName) + ' logo">';
        }
        return '<div class="drive-company-logo"></div>';
    }

    function buildGeneratedDriveTitle(companyName, hiringYear) {
        const safeCompanyName = companyName ? String(companyName).trim() : "";
        const safeHiringYear = hiringYear != null ? String(hiringYear).trim() : "";
        if (safeCompanyName && safeHiringYear) {
            return safeCompanyName + " - " + safeHiringYear;
        }
        return safeCompanyName || safeHiringYear || "";
    }

    function getDisplayDriveTitle(drive) {
        return buildGeneratedDriveTitle(drive.companyName, drive.hiringYear)
            || drive.driveTitle
            || "Untitled Drive";
    }

    function getDriveSubtitle(drive) {
        const generatedTitle = buildGeneratedDriveTitle(drive.companyName, drive.hiringYear);
        const storedTitle = drive.driveTitle ? String(drive.driveTitle).trim() : "";
        if (storedTitle && storedTitle !== generatedTitle) {
            return storedTitle;
        }
        return "";
    }

    async function loadDrives() {
        const loadingElement = document.getElementById("adminDrivesLoading");
        const list = document.getElementById("adminDriveList");
        const emptyState = document.getElementById("adminDriveEmpty");

        loadingElement.classList.remove("hidden");
        list.innerHTML = "";
        emptyState.classList.add("hidden");
        emptyState.textContent = DEFAULT_EMPTY_MESSAGE;

        try {
            const drives = await fetchJson(DRIVES_API, { method: "GET" });
            loadingElement.classList.add("hidden");

            if (!drives.length) {
                emptyState.classList.remove("hidden");
                return;
            }

            drives.forEach(function (drive) {
                const displayTitle = getDisplayDriveTitle(drive);
                const driveSubtitle = getDriveSubtitle(drive);
                const card = document.createElement("article");
                card.className = "admin-drive-item";
                card.innerHTML = [
                    '<div class="drive-item-header">',
                    '<div class="drive-company-block">',
                    getLogoMarkup(drive),
                    "<div>",
                    "<h3>" + escapeHtml(displayTitle) + "</h3>",
                    (driveSubtitle
                        ? "<p>" + escapeHtml(driveSubtitle) + "</p>"
                        : "<p>" + escapeHtml(drive.companyName) + " | Hiring Year " + escapeHtml(drive.hiringYear) + "</p>"),
                    "</div>",
                    "</div>",
                    '<span class="active-badge ' + (drive.active ? "active-enabled" : "active-disabled") + '">' + (drive.active ? "Active" : "Disabled") + "</span>",
                    "</div>",
                    '<div class="drive-badges">',
                    '<span class="status-badge ' + getStatusClass(drive.driveStatus) + '">' + escapeHtml(drive.driveStatus) + "</span>",
                    '<span class="mode-badge">' + escapeHtml(drive.hiringMode) + "</span>",
                    '<span class="job-badge">' + escapeHtml(drive.jobType) + "</span>",
                    "</div>",
                    '<div class="drive-company-meta">',
                    "<span>Hiring Date: " + formatDate(drive.hiringDate) + "</span>",
                    "<span>Eligible Branches: " + escapeHtml(drive.eligibleBranches) + "</span>",
                    "<span>Eligible CGPA: " + escapeHtml(drive.eligibleCgpa) + "</span>",
                    "<span>CTC: " + escapeHtml(drive.ctcPackage) + "</span>",
                    "</div>",
                    (drive.description ? '<p class="drive-description">' + escapeHtml(drive.description).replace(/\n/g, "<br>") + "</p>" : ""),
                    '<div class="drive-item-actions">',
                    '<button class="mini-btn toggle-drive-btn" type="button" data-drive-id="' + drive.id + '" data-active="' + drive.active + '">'
                        + (drive.active ? "Disable" : "Enable") + "</button>",
                    '<button class="mini-btn edit-drive-btn" type="button" data-drive-json="' + encodeURIComponent(JSON.stringify(drive)) + '">Edit</button>',
                    '<button class="mini-btn delete-btn" type="button" data-drive-id="' + drive.id + '">Delete</button>',
                    "</div>"
                ].join("");
                list.appendChild(card);
            });

            bindDriveActions();
        } catch (error) {
            loadingElement.classList.add("hidden");
            emptyState.textContent = error.message || "Unable to load placement drives right now.";
            emptyState.classList.remove("hidden");
        }
    }

    function bindDriveActions() {
        document.querySelectorAll(".edit-drive-btn").forEach(function (button) {
            button.addEventListener("click", function () {
                populateForm(JSON.parse(decodeURIComponent(button.dataset.driveJson)));
            });
        });

        document.querySelectorAll(".delete-btn").forEach(function (button) {
            button.addEventListener("click", async function () {
                if (!window.confirm("Delete this placement drive?")) {
                    return;
                }

                try {
                    clearFeedback();
                    await fetchJson(DRIVES_API + "/" + button.dataset.driveId, { method: "DELETE" });
                    if (document.getElementById("editingDriveId").value === button.dataset.driveId) {
                        resetForm();
                    }
                    setFeedback("Placement drive deleted successfully.", false);
                    await loadDrives();
                } catch (error) {
                    setFeedback(error.message || "Unable to delete placement drive.", true);
                }
            });
        });

        document.querySelectorAll(".toggle-drive-btn").forEach(function (button) {
            button.addEventListener("click", async function () {
                const currentState = button.dataset.active === "true";

                try {
                    clearFeedback();
                    await fetchJson(DRIVES_API + "/" + button.dataset.driveId + "/status?active=" + (!currentState), {
                        method: "PATCH"
                    });
                    setFeedback("Placement drive status updated successfully.", false);
                    await loadDrives();
                } catch (error) {
                    setFeedback(error.message || "Unable to update placement drive status.", true);
                }
            });
        });
    }

    function setupForm() {
        const form = document.getElementById("placementDriveForm");
        if (!form) {
            return;
        }

        document.getElementById("companyId").addEventListener("change", function () {
            renderCompanyPreview(this.value);
        });

        document.getElementById("cancelDriveEditButton").addEventListener("click", resetForm);

        form.addEventListener("submit", async function (event) {
            event.preventDefault();

            const payload = buildPayload(form);
            const validationMessage = validatePayload(payload);
            if (validationMessage) {
                setFeedback(validationMessage, true);
                return;
            }

            const editingDriveId = document.getElementById("editingDriveId").value;

            try {
                clearFeedback();
                setLoading(true);
                await fetchJson(editingDriveId ? DRIVES_API + "/" + editingDriveId : DRIVES_API, {
                    method: editingDriveId ? "PUT" : "POST",
                    body: JSON.stringify(payload)
                });
                resetForm();
                setFeedback(editingDriveId ? "Placement drive updated successfully." : "Placement drive created successfully.", false);
                await loadDrives();
            } catch (error) {
                setFeedback(error.message || "Unable to save placement drive.", true);
            } finally {
                setLoading(false);
            }
        });
    }

    function downloadTemplate() {
        const csvContent = [DRIVE_TEMPLATE_HEADERS.join(",")].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "placement-drives-template.csv";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    function setupUpload() {
        const form = document.getElementById("placementDriveUploadForm");
        const fileInput = document.getElementById("placementDriveExcelFile");
        const fileName = document.getElementById("placementDriveUploadFileName");
        const templateButton = document.getElementById("placementDriveTemplateButton");

        if (templateButton) {
            templateButton.addEventListener("click", downloadTemplate);
        }

        if (!form || !fileInput || !fileName) {
            return;
        }

        fileInput.addEventListener("change", function () {
            fileName.textContent = fileInput.files && fileInput.files[0] ? fileInput.files[0].name : "No file selected";
        });

        form.addEventListener("submit", async function (event) {
            event.preventDefault();

            if (!fileInput.files || !fileInput.files[0]) {
                setUploadFeedback("Please select an Excel file first.", true);
                return;
            }

            clearUploadFeedback();
            setUploadLoading(true);

            try {
                const formData = new FormData();
                formData.append("file", fileInput.files[0]);

                const response = await fetch(DRIVE_UPLOAD_API, {
                    method: "POST",
                    body: formData
                });

                const payload = await response.json().catch(function () {
                    return null;
                });

                if (!response.ok) {
                    throw new Error(buildUploadErrorMessage(payload));
                }

                setUploadSummary(payload || {});
                setUploadFeedback("Placement drives uploaded successfully.", false);
                form.reset();
                fileName.textContent = "No file selected";
                await loadDrives();
            } catch (error) {
                setUploadFeedback(error.message || "Unable to upload placement drive Excel.", true);
            } finally {
                setUploadLoading(false);
            }
        });
    }

    document.addEventListener("DOMContentLoaded", async function () {
        if (!document.getElementById("placementDriveForm")) {
            return;
        }

        try {
            await loadCompanies();
            setupForm();
            setupUpload();
            await loadDrives();
        } catch (error) {
            setFeedback(error.message || "Unable to initialize placement drive management.", true);
        }
    });
})();
