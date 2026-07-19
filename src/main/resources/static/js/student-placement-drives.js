(function () {
    const DRIVES_API = "/api/placement-drives";
    const DRIVE_FILTERS_API = "/api/placement-drives/filter-options";
    const PAGE_SIZE = 20;
    const SEARCH_DEBOUNCE_MS = 300;
    const drivesPageCache = new Map();
    let currentPage = 0;
    let totalPages = 0;
    let totalElements = 0;
    let currentSearch = "";
    let currentYearFilter = "";
    let currentStatusFilter = "";
    let currentJobTypeFilter = "";
    let currentPageDrives = [];
    let isDrivesLoading = false;
    let activeDrivesRequest = null;
    let searchDebounceTimer = null;
    let loadRequestToken = 0;
    let isPageActive = true;

    function deactivatePage() {
        isPageActive = false;
    }

    window.addEventListener("pagehide", deactivatePage);
    window.addEventListener("beforeunload", deactivatePage);

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
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
                "</div>"
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
        return safeText(drive.companyName, "Company") + " - Hiring Year " + safeText(drive.hiringYear, "N/A");
    }

    async function fetchDrivePage(page, signal) {
        const params = new URLSearchParams({
            page: String(Math.max(0, Number(page) || 0)),
            size: String(PAGE_SIZE)
        });
        if (currentSearch) params.set("search", currentSearch);
        if (currentYearFilter) params.set("hiringYear", currentYearFilter);
        if (currentStatusFilter) params.set("driveStatus", currentStatusFilter);
        if (currentJobTypeFilter) params.set("jobType", currentJobTypeFilter);

        const payload = await window.apiClient.get(DRIVES_API + "?" + params.toString(), {
            timeout: 20000,
            retries: 3,
            retryDelay: 1200,
            signal,
            headers: { Accept: "application/json" }
        });

        if (!payload || !Array.isArray(payload.content)) {
            throw new Error("Invalid placement drives response received.");
        }

        return payload;
    }

    async function fetchDriveFilterOptions() {
        const payload = await window.apiClient.get(DRIVE_FILTERS_API, {
            timeout: 20000,
            retries: 2,
            retryDelay: 1000,
            headers: { Accept: "application/json" }
        });

        return payload || { hiringYears: [], jobTypes: [] };
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

    function populateYearFilter(years) {
        const yearFilter = document.getElementById("driveYearFilter");
        if (!yearFilter) return;

        yearFilter.innerHTML = '<option value="">All Hiring Years</option>';
        (years || []).forEach(function (year) {
            const option = document.createElement("option");
            option.value = String(year);
            option.textContent = String(year);
            yearFilter.appendChild(option);
        });
        yearFilter.value = currentYearFilter;
    }

    function populateJobTypeFilter(jobTypes) {
        const jobTypeFilter = document.getElementById("driveJobTypeFilter");
        if (!jobTypeFilter) return;

        jobTypeFilter.innerHTML = '<option value="">All Job Types</option>';
        (jobTypes || []).forEach(function (jobType) {
            const formatted = formatJobType(jobType);
            const option = document.createElement("option");
            option.value = formatted;
            option.textContent = formatted;
            jobTypeFilter.appendChild(option);
        });
        jobTypeFilter.value = currentJobTypeFilter;
    }

    function updateDriveCount(count) {
        const driveCount = document.getElementById("driveCount");
        if (driveCount) {
            driveCount.textContent = String(count);
        }
    }

    function updatePaginationControls() {
        const prevButton = document.getElementById("drivesPrevButton");
        const nextButton = document.getElementById("drivesNextButton");
        const pageInfo = document.getElementById("drivesPageInfo");

        if (prevButton) {
            prevButton.disabled = isDrivesLoading || currentPage <= 0;
        }
        if (nextButton) {
            nextButton.disabled = isDrivesLoading || totalPages === 0 || currentPage >= totalPages - 1;
        }
        if (pageInfo) {
            pageInfo.textContent = "Page " + (totalPages === 0 ? 0 : currentPage + 1) + " of " + totalPages;
        }
    }

    function setListLoading(isLoading, initialLoad) {
        const loadingElement = document.getElementById("studentDrivesLoading");
        const loadingHint = document.getElementById("drivesInlineLoading");
        const list = document.getElementById("studentDriveList");
        const emptyState = document.getElementById("studentDriveEmpty");

        if (loadingElement) {
            loadingElement.classList.toggle("hidden", !(isLoading && initialLoad));
        }
        if (list && initialLoad) {
            list.classList.toggle("hidden", isLoading);
        }
        if (emptyState && isLoading) {
            emptyState.classList.add("hidden");
        }
        if (loadingHint) {
            loadingHint.classList.toggle("hidden", !(isLoading && !initialLoad));
        }
    }

    function renderDrives(drives) {
        const loadingElement = document.getElementById("studentDrivesLoading");
        const list = document.getElementById("studentDriveList");
        const emptyState = document.getElementById("studentDriveEmpty");

        if (loadingElement) {
            loadingElement.classList.add("hidden");
        }
        if (!list || !emptyState) {
            return;
        }

        list.classList.remove("hidden");
        list.innerHTML = "";
        updateDriveCount(totalElements);
        updatePaginationControls();

        if (!drives.length) {
            list.classList.add("hidden");
            emptyState.innerHTML = [
                '<i data-lucide="briefcase"></i>',
                currentSearch || currentYearFilter || currentStatusFilter || currentJobTypeFilter
                    ? "<h3>No matching drives found</h3>"
                    : "<h3>No drives found</h3>",
                currentSearch || currentYearFilter || currentStatusFilter || currentJobTypeFilter
                    ? "<p>Try adjusting your search or filters.</p>"
                    : "<p>Placement drives will appear here once they are available.</p>"
            ].join("");
            emptyState.classList.remove("hidden");
            initLucideIcons();
            return;
        }

        emptyState.classList.add("hidden");

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
        initLucideIcons();
    }

    function showError(message) {
        const loadingElement = document.getElementById("studentDrivesLoading");
        const loadingHint = document.getElementById("drivesInlineLoading");
        const emptyState = document.getElementById("studentDriveEmpty");
        const list = document.getElementById("studentDriveList");

        if (loadingElement) {
            loadingElement.classList.add("hidden");
        }
        if (loadingHint) {
            loadingHint.classList.add("hidden");
        }
        if (list) {
            list.classList.add("hidden");
        }
        if (emptyState) {
            emptyState.innerHTML = [
                '<i data-lucide="briefcase"></i>',
                "<h3>Unable to load placement drives.</h3>",
                "<p>", escapeHtml(message || "Please try again."), "</p>"
            ].join("");
            emptyState.classList.remove("hidden");
        }

        totalElements = 0;
        totalPages = 0;
        currentPageDrives = [];
        updateDriveCount(0);
        updatePaginationControls();
        initLucideIcons();
    }

    function setupFilters() {
        const searchInput = document.getElementById("driveSearchInput");
        const yearFilter = document.getElementById("driveYearFilter");
        const statusFilter = document.getElementById("driveStatusFilter");
        const jobTypeFilter = document.getElementById("driveJobTypeFilter");

        if (searchInput) {
            searchInput.addEventListener("input", function () {
                const nextSearch = searchInput.value.trim();
                if (searchDebounceTimer) {
                    clearTimeout(searchDebounceTimer);
                }
                searchDebounceTimer = setTimeout(function () {
                    currentSearch = nextSearch;
                    clearDrivesCache();
                    loadDrives(0, { force: true, initialLoad: false });
                }, SEARCH_DEBOUNCE_MS);
            });
        }

        if (yearFilter) {
            yearFilter.addEventListener("change", function () {
                currentYearFilter = yearFilter.value;
                clearDrivesCache();
                loadDrives(0, { force: true, initialLoad: false });
            });
        }

        if (statusFilter) {
            statusFilter.addEventListener("change", function () {
                currentStatusFilter = statusFilter.value;
                clearDrivesCache();
                loadDrives(0, { force: true, initialLoad: false });
            });
        }

        if (jobTypeFilter) {
            jobTypeFilter.addEventListener("change", function () {
                currentJobTypeFilter = jobTypeFilter.value;
                clearDrivesCache();
                loadDrives(0, { force: true, initialLoad: false });
            });
        }
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
            cardObserver.unobserve(card);
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

    function buildCacheKey(page) {
        return [
            Number(page) || 0,
            PAGE_SIZE,
            currentSearch,
            currentYearFilter,
            currentStatusFilter,
            currentJobTypeFilter
        ].join("|");
    }

    function storePageInCache(page, payload) {
        drivesPageCache.set(buildCacheKey(page), payload);
    }

    function getCachedPage(page) {
        return drivesPageCache.get(buildCacheKey(page)) || null;
    }

    function clearDrivesCache() {
        drivesPageCache.clear();
    }

    async function prefetchDrivesPage(page) {
        const safePage = Number(page) || 0;
        if (safePage < 0 || safePage >= totalPages || getCachedPage(safePage)) {
            return;
        }

        const controller = new AbortController();
        try {
            const payload = await fetchDrivePage(safePage, controller.signal);
            storePageInCache(safePage, payload);
        } catch (error) {
            console.error("Failed to prefetch placement drives page:", safePage, error);
        }
    }

    function applyPagePayload(payload) {
        currentPage = Number(payload.page) || 0;
        totalPages = Number(payload.totalPages) || 0;
        totalElements = Number(payload.totalElements) || 0;
        currentPageDrives = Array.isArray(payload.content) ? payload.content : [];
        renderDrives(currentPageDrives);
        void prefetchDrivesPage(currentPage + 1);
    }

    async function loadDrives(page, options) {
        options = options || {};
        const safePage = Math.max(0, Number(page) || 0);
        const initialLoad = Boolean(options.initialLoad);
        const requestId = ++loadRequestToken;

        if (isDrivesLoading && !options.force) {
            return;
        }

        const cachedPage = getCachedPage(safePage);
        if (cachedPage) {
            if (!isPageActive || requestId !== loadRequestToken) {
                return;
            }
            setListLoading(false, initialLoad);
            applyPagePayload(cachedPage);
            return;
        }

        if (activeDrivesRequest) {
            activeDrivesRequest.abort();
        }

        activeDrivesRequest = new AbortController();
        isDrivesLoading = true;
        updatePaginationControls();
        setListLoading(true, initialLoad);

        try {
            const payload = await fetchDrivePage(safePage, activeDrivesRequest.signal);
            if (!isPageActive || requestId !== loadRequestToken) {
                return;
            }
            storePageInCache(safePage, payload);
            applyPagePayload(payload);

            if (!currentPageDrives.length && currentPage > 0 && totalPages > 0) {
                await loadDrives(totalPages - 1, { force: true, initialLoad: false });
                return;
            }
        } catch (error) {
            if (!isPageActive || requestId !== loadRequestToken) {
                return;
            }
            if (error && error.name === "AbortError") {
                return;
            }
            console.error("Failed to load placement drives:", error);
            showError("Unable to load placement drives. Please try again.");
        } finally {
            if (requestId === loadRequestToken) {
                isDrivesLoading = false;
                activeDrivesRequest = null;
                updatePaginationControls();
                setListLoading(false, initialLoad);
            }
        }
    }

    function setupPagination() {
        const prevButton = document.getElementById("drivesPrevButton");
        const nextButton = document.getElementById("drivesNextButton");

        if (prevButton) {
            prevButton.addEventListener("click", function () {
                if (currentPage > 0) {
                    loadDrives(currentPage - 1, { initialLoad: false });
                }
            });
        }

        if (nextButton) {
            nextButton.addEventListener("click", function () {
                if (currentPage < totalPages - 1) {
                    loadDrives(currentPage + 1, { initialLoad: false });
                }
            });
        }
    }

    document.addEventListener("DOMContentLoaded", async function () {
        initLucideIcons();
        initScrollProgress();
        setupBackButton();
        setupPagination();
        setupFilters();
        updatePaginationControls();
        setListLoading(true, true);

        try {
            const filterOptions = await fetchDriveFilterOptions();
            populateYearFilter(filterOptions.hiringYears || []);
            populateJobTypeFilter(filterOptions.jobTypes || []);
            await loadDrives(0, { initialLoad: true });
        } catch (error) {
            console.error("Failed to initialize placement drives page:", error);
            showError("Unable to load placement drives. Please try again.");
        }
    });
})();
