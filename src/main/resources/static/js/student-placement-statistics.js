(function () {
    const STATISTICS_API = "/api/student/placement-statistics";

    let allStatistics = [];

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    async function fetchStatistics() {
        const response = await fetch(STATISTICS_API);
        const text = await response.text();

        let payload = [];
        if (text) {
            try {
                payload = JSON.parse(text);
            } catch (error) {
                payload = [];
            }
        }

        if (!response.ok) {
            throw new Error(payload && payload.message ? payload.message : "Unable to load placement statistics.");
        }

        return Array.isArray(payload) ? payload : [];
    }

    function formatDate(dateString) {
        if (!dateString) return "Date unavailable";

        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) return "Date unavailable";

        return date.toLocaleDateString("en-IN", {
            year: "numeric",
            month: "short",
            day: "numeric"
        });
    }

    function packageText(value) {
        if (value === null || value === undefined || value === "") return "N/A";
        return value + " LPA";
    }

    function safeNumber(value) {
        const num = Number(value);
        return Number.isFinite(num) ? num : 0;
    }

    function safePercentage(numerator, denominator) {
        numerator = safeNumber(numerator);
        denominator = safeNumber(denominator);

        if (!denominator || denominator <= 0) return 0;
        return Math.round((numerator / denominator) * 100);
    }

    function getStatusClass(status) {
        const normalized = String(status || "").toLowerCase();

        if (normalized === "upcoming") return "status-upcoming";
        if (normalized === "ongoing") return "status-ongoing";
        if (normalized === "completed") return "status-completed";

        return "status-closed";
    }

    function getLogoMarkup(record) {
        const companyName = record.companyName || "Company";

        if (record.companyLogoUrl) {
            return `
                <div class="company-logo">
                    <img src="${escapeHtml(record.companyLogoUrl)}" alt="${escapeHtml(companyName)} logo">
                </div>
            `;
        }

        return `
            <div class="company-logo text-logo">
                ${escapeHtml(companyName.charAt(0).toUpperCase())}
            </div>
        `;
    }

    function buildDonutGradient(record) {
        const applied = safeNumber(record.studentsApplied);
        const attended = safeNumber(record.studentsAttended);
        const shortlisted = safeNumber(record.studentsShortlisted);
        const selected = safeNumber(record.studentsSelected);

        if (applied <= 0) {
            return "conic-gradient(#e2e8f0 0% 100%)";
        }

        const selectedPercent = safePercentage(selected, applied);
        const shortlistedOnlyPercent = safePercentage(Math.max(shortlisted - selected, 0), applied);
        const attendedOnlyPercent = safePercentage(Math.max(attended - shortlisted, 0), applied);
        const notAttendedPercent = Math.max(100 - selectedPercent - shortlistedOnlyPercent - attendedOnlyPercent, 0);

        const selectedEnd = selectedPercent;
        const shortlistedEnd = selectedEnd + shortlistedOnlyPercent;
        const attendedEnd = shortlistedEnd + attendedOnlyPercent;
        const notAttendedEnd = attendedEnd + notAttendedPercent;

        return `
            conic-gradient(
                #22c55e 0% ${selectedEnd}%,
                #3b82f6 ${selectedEnd}% ${shortlistedEnd}%,
                #f59e0b ${shortlistedEnd}% ${attendedEnd}%,
                #94a3b8 ${attendedEnd}% ${notAttendedEnd}%
            )
        `;
    }

    function renderCard(record, index) {
        const applied = safeNumber(record.studentsApplied);
        const attended = safeNumber(record.studentsAttended);
        const shortlisted = safeNumber(record.studentsShortlisted);
        const selected = safeNumber(record.studentsSelected);
        const male = safeNumber(record.maleSelected);
        const female = safeNumber(record.femaleSelected);

        const card = document.createElement("article");
        card.className = "card stat-card ripple-container";
        card.tabIndex = 0;
        card.style.animationDelay = (0.05 * index) + "s";

        card.innerHTML = `
            <div class="mini-pie-indicator" style="background: ${buildDonutGradient(record)};"></div>

            <div class="card-header">
                <div class="company-info">
                    ${getLogoMarkup(record)}
                    <div class="company-titles">
                        <h3>${escapeHtml(record.driveTitle || "Untitled Drive")}</h3>
                        <p>
                            ${escapeHtml(record.companyName || "Company unavailable")}
                            &bull;
                            ${escapeHtml(record.hiringYear || "Year unavailable")}
                            &bull;
                            ${escapeHtml(formatDate(record.hiringDate))}
                        </p>
                    </div>
                </div>
            </div>

            <div class="badges-row">
                <span class="badge">${escapeHtml(record.companyType || "Company Type")}</span>
                <span class="badge">${escapeHtml(record.industry || "Industry")}</span>
                <span class="badge ${getStatusClass(record.driveStatus)}">${escapeHtml(record.driveStatus || "Closed")}</span>
            </div>

            <div class="stat-pills-container">
                <div class="stat-pills">
                    <span class="pill"><span class="pill-lbl">Applied:</span> <span class="pill-val">${escapeHtml(applied)}</span></span>
                    <span class="pill"><span class="pill-lbl">Attended:</span> <span class="pill-val">${escapeHtml(attended)}</span></span>
                    <span class="pill"><span class="pill-lbl">Shortlisted:</span> <span class="pill-val">${escapeHtml(shortlisted)}</span></span>
                    <span class="pill"><span class="pill-lbl">Selected:</span> <span class="pill-val">${escapeHtml(selected)}</span></span>
                </div>

                <div class="stat-pills">
                    <span class="pill"><span class="pill-lbl">Male:</span> <span class="pill-val">${escapeHtml(male)}</span></span>
                    <span class="pill"><span class="pill-lbl">Female:</span> <span class="pill-val">${escapeHtml(female)}</span></span>
                    <span class="pill"><span class="pill-lbl">High:</span> <span class="pill-val">${escapeHtml(packageText(record.highestPackage))}</span></span>
                    <span class="pill"><span class="pill-lbl">Avg:</span> <span class="pill-val">${escapeHtml(packageText(record.averagePackage))}</span></span>
                    <span class="pill"><span class="pill-lbl">Low:</span> <span class="pill-val">${escapeHtml(packageText(record.lowestPackage))}</span></span>
                </div>
            </div>
        `;

        card.addEventListener("mousedown", function (event) {
            addRipple(event, card);
        });

        card.addEventListener("click", function () {
            openStatsModal(record);
        });

        card.addEventListener("keydown", function (event) {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openStatsModal(record);
            }
        });

        return card;
    }

    function renderStatistics(records) {
        const loading = document.getElementById("studentStatisticsLoading");
        const list = document.getElementById("studentStatisticsList");
        const empty = document.getElementById("studentStatisticsEmpty");

        if (loading) loading.classList.add("hidden");
        if (!list) return;

        list.innerHTML = "";

        if (!records.length) {
            if (empty) empty.classList.remove("hidden");
            return;
        }

        if (empty) empty.classList.add("hidden");

        records.forEach(function (record, index) {
            list.appendChild(renderCard(record, index));
        });

        observeCards();

        if (window.lucide && typeof window.lucide.createIcons === "function") {
            window.lucide.createIcons();
        }
    }

    function populateYearFilter(records) {
        const yearFilter = document.getElementById("statisticsYearFilter");
        if (!yearFilter) return;

        const years = Array.from(
            new Set(
                records
                    .map(function (record) {
                        return record.hiringYear;
                    })
                    .filter(Boolean)
            )
        ).sort(function (a, b) {
            return Number(b) - Number(a);
        });

        yearFilter.innerHTML = '<option value="">All Hiring Years</option>';

        years.forEach(function (year) {
            const option = document.createElement("option");
            option.value = String(year);
            option.textContent = String(year);
            yearFilter.appendChild(option);
        });
    }

    function filterStatistics() {
        const searchInput = document.getElementById("statisticsSearchInput");
        const yearFilter = document.getElementById("statisticsYearFilter");
        const statusFilter = document.getElementById("statisticsStatusFilter");

        const searchValue = searchInput ? searchInput.value.trim().toLowerCase() : "";
        const yearValue = yearFilter ? yearFilter.value : "";
        const statusValue = statusFilter ? statusFilter.value : "";

        const filtered = allStatistics.filter(function (record) {
            const companyName = String(record.companyName || "").toLowerCase();
            const driveTitle = String(record.driveTitle || "").toLowerCase();

            const matchesSearch =
                !searchValue ||
                companyName.includes(searchValue) ||
                driveTitle.includes(searchValue);

            const matchesYear =
                !yearValue || String(record.hiringYear || "") === yearValue;

            const matchesStatus =
                !statusValue || String(record.driveStatus || "") === statusValue;

            return matchesSearch && matchesYear && matchesStatus;
        });

        renderStatistics(filtered);
    }

    function setupFilters() {
        const searchInput = document.getElementById("statisticsSearchInput");
        const yearFilter = document.getElementById("statisticsYearFilter");
        const statusFilter = document.getElementById("statisticsStatusFilter");

        if (searchInput) searchInput.addEventListener("input", filterStatistics);
        if (yearFilter) yearFilter.addEventListener("change", filterStatistics);
        if (statusFilter) statusFilter.addEventListener("change", filterStatistics);
    }

    function setupBackButton() {
        const backBtn = document.getElementById("statisticsBackBtn");
        if (!backBtn) return;

        const params = new URLSearchParams(window.location.search);
        const cameFromDashboardCard = params.get("from") === "dashboard-placement-card";

        if (cameFromDashboardCard) {
            backBtn.href = "/student-dashboard#placement-statistics-card";
        }
    }

    function observeCards() {
        if (!("IntersectionObserver" in window)) {
            document.querySelectorAll(".stat-card").forEach(function (card) {
                card.classList.add("visible");
            });
            return;
        }

        const observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                }
            });
        }, {
            threshold: 0.1
        });

        document.querySelectorAll(".stat-card").forEach(function (card) {
            observer.observe(card);
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

    function openStatsModal(record) {
        const modal = document.getElementById("statsModal");
        if (!modal) return;

        const applied = safeNumber(record.studentsApplied);
        const attended = safeNumber(record.studentsAttended);
        const shortlisted = safeNumber(record.studentsShortlisted);
        const selected = safeNumber(record.studentsSelected);

        const shortlistedNotSelected = Math.max(shortlisted - selected, 0);
        const attendedNotShortlisted = Math.max(attended - shortlisted, 0);
        const notAttended = Math.max(applied - attended, 0);

        setText("modalTitle", "Placement Funnel");
        setText("modalSub", "Detailed breakdown");
        setText(
            "modalDriveLabel",
            (record.driveTitle || "Placement drive") +
            " - " +
            (record.companyName || "Company unavailable")
        );
        setText("modalTotal", applied);
        setText("valSelected", selected + " (" + safePercentage(selected, applied) + "%)");
        setText("valShortlisted", shortlistedNotSelected + " (" + safePercentage(shortlistedNotSelected, applied) + "%)");
        setText("valAttended", attendedNotShortlisted + " (" + safePercentage(attendedNotShortlisted, applied) + "%)");
        setText("valNotAttended", notAttended + " (" + safePercentage(notAttended, applied) + "%)");

        const donut = document.getElementById("modalDonut");
        if (donut) {
            donut.style.background = buildDonutGradient(record);
        }

        modal.classList.add("active");
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
    }

    function closeStatsModal() {
        const modal = document.getElementById("statsModal");
        if (!modal) return;

        modal.classList.remove("active");
        modal.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
    }

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    function setupModal() {
        const modal = document.getElementById("statsModal");
        const closeBtn = document.getElementById("closeModalBtn");

        if (closeBtn) {
            closeBtn.addEventListener("click", closeStatsModal);
        }

        if (modal) {
            modal.addEventListener("click", function (event) {
                if (event.target === modal) {
                    closeStatsModal();
                }
            });
        }

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                closeStatsModal();
            }
        });
    }

    function showError(message) {
        const loading = document.getElementById("studentStatisticsLoading");
        const empty = document.getElementById("studentStatisticsEmpty");

        if (loading) loading.classList.add("hidden");

        if (empty) {
            empty.textContent = message || "Unable to load placement statistics right now.";
            empty.classList.remove("hidden");
        }
    }

    function checkStudentAuth() {
        if (!window.PlacementPortalAuth) return true;

        const authState = window.PlacementPortalAuth.getAuthState();

        if (!authState || String(authState.role || "").toLowerCase() !== "student") {
            window.location.replace("/student-login.html");
            return false;
        }

        return true;
    }

    document.addEventListener("DOMContentLoaded", async function () {
        if (!checkStudentAuth()) return;

        if (window.lucide && typeof window.lucide.createIcons === "function") {
            window.lucide.createIcons();
        }

        setupFilters();
        setupBackButton();
        setupModal();

        try {
            allStatistics = await fetchStatistics();
            populateYearFilter(allStatistics);
            renderStatistics(allStatistics);
        } catch (error) {
            showError(error.message);
        }
    });
})();
