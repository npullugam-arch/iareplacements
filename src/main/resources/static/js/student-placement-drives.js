(function () {
    const DRIVES_API = "/api/student/placement-drives";
    let allDrives = [];

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    async function fetchDrives() {
        const result = await window.apiClient.cachedGet('placement_drives_v1', DRIVES_API, 120000);
        return Array.isArray(result.data) ? result.data : [];
    }

    function safeText(value, fallback) {
        const normalized = String(value == null ? "" : value).trim();
        return normalized || fallback;
    }

    function safeNumber(value, fallback) {
        const numberValue = Number(value);
        if (!Number.isFinite(numberValue)) {
            return fallback;
        }

        return String(numberValue);
    }

    function formatDate(dateString) {
        if (!dateString) {
            return "N/A";
        }

        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) {
            return "N/A";
        }

        return date.toLocaleDateString("en-IN", {
            year: "numeric",
            month: "short",
            day: "numeric"
        });
    }

    function formatJobType(jobType) {
        const normalized = safeText(jobType, "N/A");
        if (normalized.toLowerCase() === "full time") {
            return "Full-Time";
        }
        return normalized;
    }

    function getStatusClass(status) {
        const normalized = safeText(status, "Closed").toLowerCase();
        if (normalized === "upcoming") return "badge";
        if (normalized === "ongoing") return "badge";
        if (normalized === "completed") return "badge";
        return "badge";
    }

    function getStatusDotClass(status) {
        const normalized = safeText(status, "Closed").toLowerCase();
        if (normalized === "completed") return "dot-green";
        if (normalized === "ongoing") return "dot-blue";
        if (normalized === "upcoming") return "dot-blue";
        return "dot-gray";
    }

    function getLogoMarkup(drive) {
        const companyName = safeText(drive.companyName, "Company");

        if (drive.companyLogoUrl) {
            return [
                '<div class="company-logo">',
                '<img src="', escapeHtml(drive.companyLogoUrl), '" alt="', escapeHtml(companyName), ' logo" loading="lazy" decoding="async" width="60" height="60">',
                '</div>'
            ].join("");
        }

        return [
            '<div class="company-logo text-logo">',
            "<span>", escapeHtml(companyName.charAt(0).toUpperCase()), "</span>",
            "</div>"
        ].join("");
    }

    function buildGeneratedDriveTitle(companyName, hiringYear) {
        const safeCompanyName = safeText(companyName, "").trim();
        const safeHiringYear = hiringYear != null ? String(hiringYear).trim() : "";
        if (safeCompanyName && safeHiringYear) {
            return safeCompanyName + " - " + safeHiringYear;
        }
        return safeCompanyName || safeHiringYear || "";
    }

    function getDisplayDriveTitle(drive) {
        return buildGeneratedDriveTitle(drive.companyName, drive.hiringYear)
            || safeText(drive.driveTitle, "Untitled Drive");
    }

    function getDriveSubtitle(drive) {
        const generatedTitle = buildGeneratedDriveTitle(drive.companyName, drive.hiringYear);
        const storedTitle = safeText(drive.driveTitle, "").trim();
        if (storedTitle && storedTitle !== generatedTitle) {
            return storedTitle;
        }
        return safeText(drive.companyName, "Company") + " • Hiring Year " + safeText(drive.hiringYear, "N/A");
    }

    function buildDetailItem(icon, label, value) {
        return [
            '<div class="detail-item">',
            '<i data-lucide="', icon, '"></i> ',
            escapeHtml(label), ": ", escapeHtml(value),
            "</div>"
        ].join("");
    }

    function buildTimelineStep(label, value) {
        return [
            '<div class="timeline-step">',
            '<span class="step-label">', escapeHtml(label), "</span>",
            '<span class="step-date">', escapeHtml(value), "</span>",
            "</div>"
        ].join("");
    }

    function populateYearFilter(drives) {
        const yearFilter = document.getElementById("driveYearFilter");
        if (!yearFilter) return;

        const years = Array.from(
            new Set(
                drives
                    .map(function (drive) { return drive.hiringYear; })
                    .filter(Boolean)
            )
        ).sort(function (first, second) {
            return Number(second) - Number(first);
        });

        yearFilter.innerHTML = '<option value="">All Hiring Years</option>';
        years.forEach(function (year) {
            const option = document.createElement("option");
            option.value = String(year);
            option.textContent = String(year);
            yearFilter.appendChild(option);
        });
    }

    function populateJobTypeFilter(drives) {
        const jobTypeFilter = document.getElementById("driveJobTypeFilter");
        if (!jobTypeFilter) return;

        const jobTypes = Array.from(
            new Set(
                drives
                    .map(function (drive) { return formatJobType(drive.jobType); })
                    .filter(Boolean)
            )
        );

        jobTypeFilter.innerHTML = '<option value="">All Job Types</option>';
        jobTypes.forEach(function (jobType) {
            const option = document.createElement("option");
            option.value = jobType;
            option.textContent = jobType;
            jobTypeFilter.appendChild(option);
        });
    }

    function updateDriveCount(count) {
        const driveCount = document.getElementById("driveCount");
        if (driveCount) {
            driveCount.textContent = String(count);
        }
    }

    function buildCardSearchText(drive) {
        return [
            safeText(drive.companyName, ""),
            safeText(drive.driveTitle, ""),
            safeText(drive.hiringYear, ""),
            safeText(drive.driveStatus, ""),
            safeText(drive.jobType, "")
        ].join(" ").toLowerCase();
    }

    function filterDrives() {
        const searchValue = document.getElementById("driveSearchInput").value.trim().toLowerCase();
        const yearValue = document.getElementById("driveYearFilter").value;
        const statusValue = document.getElementById("driveStatusFilter").value;
        const jobTypeValue = document.getElementById("driveJobTypeFilter").value;

        const filteredDrives = allDrives.filter(function (drive) {
            const matchesSearch = !searchValue || buildCardSearchText(drive).includes(searchValue);
            const matchesYear = !yearValue || String(drive.hiringYear || "") === yearValue;
            const matchesStatus = !statusValue || safeText(drive.driveStatus, "Closed") === statusValue;
            const matchesJobType = !jobTypeValue || formatJobType(drive.jobType) === jobTypeValue;

            return matchesSearch && matchesYear && matchesStatus && matchesJobType;
        });

        renderDrives(filteredDrives);
    }

    function renderDrives(drives) {
        const loadingElement = document.getElementById("studentDrivesLoading");
        const list = document.getElementById("studentDriveList");
        const emptyState = document.getElementById("studentDriveEmpty");

        if (loadingElement) {
            loadingElement.classList.add("hidden");
        }
        if (!list) {
            return;
        }

        list.innerHTML = "";
        updateDriveCount(drives.length);

        if (!drives.length) {
            if (emptyState) {
                emptyState.classList.remove("hidden");
            }
            if (window.lucide && typeof window.lucide.createIcons === "function") {
                window.lucide.createIcons();
            }
            return;
        }

        if (emptyState) {
            emptyState.classList.add("hidden");
        }

        drives.forEach(function (drive) {
            const displayTitle = getDisplayDriveTitle(drive);
            const driveSubtitle = getDriveSubtitle(drive);
            const websiteMarkup = drive.companyWebsiteUrl
                ? [
                    '<a class="btn-primary" href="', escapeHtml(drive.companyWebsiteUrl), '" target="_blank" rel="noopener noreferrer">',
                    'Visit Website <i data-lucide="external-link"></i>',
                    "</a>"
                ].join("")
                : '<span class="btn-primary" aria-disabled="true">Visit Website <i data-lucide="external-link"></i></span>';

            const card = document.createElement("article");
            card.className = "card";
            card.innerHTML = [
                '<div class="card-header">',
                '<div class="company-info">',
                getLogoMarkup(drive),
                '<div class="company-titles">',
                "<h3>", escapeHtml(displayTitle), "</h3>",
                "<p>", escapeHtml(driveSubtitle), "</p>",
                "</div>",
                "</div>",
                "</div>",

                '<div class="card-badges">',
                '<span class="', getStatusClass(drive.driveStatus), '">', escapeHtml(safeText(drive.driveStatus, "Closed")), "</span>",
                '<span class="badge">', escapeHtml(safeText(drive.hiringMode, "N/A")), "</span>",
                '<span class="badge">', escapeHtml(formatJobType(drive.jobType)), "</span>",
                "</div>",

                '<div class="card-details-grid">',
                buildDetailItem("calendar", "Hiring Date", formatDate(drive.hiringDate)),
                buildDetailItem("map-pin", "Location", safeText(drive.hiringLocation, "N/A")),
                buildDetailItem("graduation-cap", "Branches", safeText(drive.eligibleBranches, "N/A")),
                buildDetailItem("pen-tool", "CGPA", safeText(drive.eligibleCgpa, "N/A")),
                buildDetailItem("clock", "Backlogs", drive.backlogsAllowed ? "Allowed" : "Not Allowed"),
                buildDetailItem("dollar-sign", "CTC", safeText(drive.ctcPackage, "N/A")),
                buildDetailItem("briefcase", "Stipend", safeText(drive.stipend, "N/A")),
                buildDetailItem("layers", "Rounds", safeText(drive.roundNames, drive.numberOfRounds != null ? safeNumber(drive.numberOfRounds, "0") : "N/A")),
                "</div>",

                '<div class="card-timeline">',
                buildTimelineStep("REGISTRATION", formatDate(drive.registrationDeadline)),
                '<i data-lucide="arrow-right" class="timeline-arrow"></i>',
                buildTimelineStep("EXAM", formatDate(drive.examDate)),
                '<i data-lucide="arrow-right" class="timeline-arrow"></i>',
                buildTimelineStep("INTERVIEW", formatDate(drive.interviewDate)),
                "</div>",

                '<div class="card-footer">',
                websiteMarkup,
                '<div class="status-dot ', getStatusDotClass(drive.driveStatus), '"></div>',
                "</div>"
            ].join("");

            card.addEventListener("mousedown", function (event) {
                addRipple(event, card);
            });

            list.appendChild(card);
        });

        initCardObserver();

        if (window.lucide && typeof window.lucide.createIcons === "function") {
            window.lucide.createIcons();
        }
    }

    function showError(message) {
        const loadingElement = document.getElementById("studentDrivesLoading");
        const emptyState = document.getElementById("studentDriveEmpty");

        if (loadingElement) {
            loadingElement.classList.add("hidden");
        }
        if (emptyState) {
            emptyState.innerHTML = [
                '<i data-lucide="briefcase"></i>',
                "<h3>No drives found</h3>",
                "<p>", escapeHtml(message || "Unable to load placement drives right now."), "</p>"
            ].join("");
            emptyState.classList.remove("hidden");
        }

        updateDriveCount(0);

        if (window.lucide && typeof window.lucide.createIcons === "function") {
            window.lucide.createIcons();
        }
    }

    function setupFilters() {
        ["driveSearchInput", "driveYearFilter", "driveStatusFilter", "driveJobTypeFilter"].forEach(function (id) {
            const element = document.getElementById(id);
            if (!element) return;

            element.addEventListener("input", filterDrives);
            element.addEventListener("change", filterDrives);
        });
    }

    function addRipple(event, element) {
        const ripple = document.createElement("span");
        ripple.className = "ripple";

        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);

        ripple.style.width = size + "px";
        ripple.style.height = size + "px";
        ripple.style.left = event.clientX - rect.left - size / 2 + "px";
        ripple.style.top = event.clientY - rect.top - size / 2 + "px";

        element.appendChild(ripple);
        ripple.addEventListener("animationend", function () {
            ripple.remove();
        });
    }

    function initScrollProgress() {
        const progress = document.getElementById("scrollProgress");
        if (!progress) return;

        window.addEventListener("scroll", function () {
            const scrolled = document.documentElement.scrollTop;
            const max = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            progress.style.width = max > 0 ? Math.round((scrolled / max) * 100) + "%" : "0%";
        }, { passive: true });
    }

    let cardObserver = null;

    function initCardObserver() {
        const cards = document.querySelectorAll(".card");

        if (!("IntersectionObserver" in window)) {
            cards.forEach(function (card) {
                card.classList.add("visible");
            });
            return;
        }

        if (!cardObserver) {
            cardObserver = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("visible");
                    } else {
                        entry.target.classList.remove("visible");
                    }
                });
            }, {
                threshold: 0.05,
                rootMargin: "0px 0px -30px 0px"
            });
        }

        cards.forEach(function (card) {
            cardObserver.observe(card);
        });
    }

    function setupBackButton() {
        const backBtn = document.getElementById("placementDrivesBackBtn");
        if (!backBtn) return;

        const params = new URLSearchParams(window.location.search);
        if (params.get("from") === "dashboard-placement-drives-card") {
            backBtn.href = "/student-dashboard#placement-drives-card";
        }
    }

    function initLucideIcons() {
        if (window.lucide && typeof window.lucide.createIcons === "function") {
            window.lucide.createIcons();
        }
    }

    document.addEventListener("DOMContentLoaded", async function () {
        initLucideIcons();
        initScrollProgress();
        setupBackButton();

        try {
            allDrives = await fetchDrives();
            populateYearFilter(allDrives);
            populateJobTypeFilter(allDrives);
            setupFilters();
            renderDrives(allDrives);
        } catch (error) {
            console.error("Failed to load placement drives:", error);
            if (error && error.code === 'server_wake') {
                const loading = document.getElementById('studentDrivesLoading');
                if (loading) loading.classList.remove('hidden');
                setTimeout(async function () {
                    try {
                        allDrives = await fetchDrives();
                        populateYearFilter(allDrives);
                        populateJobTypeFilter(allDrives);
                        renderDrives(allDrives);
                    } catch (err) {
                        console.error("Failed to reload placement drives after wake:", err);
                        showError("Unable to load placement drives. Please refresh.");
                    }
                }, 2000);
                return;
            }

            showError("Unable to load placement drives. Please refresh.");
        }
    });
})();
