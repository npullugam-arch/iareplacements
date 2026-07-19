(function () {
    const STATISTICS_API = "/api/student/placement-statistics/paged";
    const FILTER_OPTIONS_API = "/api/student/placement-statistics/filter-options";
    const PAGE_SIZE = 20;
    const SEARCH_DEBOUNCE_MS = 300;
    const statisticsPageCache = new Map();

    let currentPage = 0;
    let totalPages = 0;
    let totalElements = 0;
    let currentPageStatistics = [];
    let currentSearch = "";
    let currentHiringYear = "";
    let currentDriveStatus = "";
    let isStatisticsLoading = false;
    let activeStatisticsRequest = null;
    let searchDebounceTimer = null;
    let statisticsObserver = null;
    let loadRequestToken = 0;
    let isPageActive = true;

    function deactivatePage() {
        isPageActive = false;
    }

    window.addEventListener("pagehide", deactivatePage);
    window.addEventListener("beforeunload", deactivatePage);

    function showElement(element) {
        if (element) {
            element.classList.remove("hidden");
        }
    }

    function hideElement(element) {
        if (element) {
            element.classList.add("hidden");
        }
    }

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    async function fetchStatistics(page, signal) {
        const params = new URLSearchParams({
            page: String(Math.max(0, Number(page) || 0)),
            size: String(PAGE_SIZE)
        });

        if (currentSearch) {
            params.set("search", currentSearch);
        }
        if (currentHiringYear) {
            params.set("hiringYear", currentHiringYear);
        }
        if (currentDriveStatus) {
            params.set("driveStatus", currentDriveStatus);
        }

        const payload = await window.apiClient.get(STATISTICS_API + "?" + params.toString(), {
            timeout: 20000,
            retries: 3,
            retryDelay: 1200,
            signal,
            headers: {
                Accept: "application/json"
            }
        });

        if (!payload || !Array.isArray(payload.content)) {
            throw new Error("Invalid placement statistics response received.");
        }

        return payload;
    }

    async function fetchFilterOptions() {
        const payload = await window.apiClient.get(FILTER_OPTIONS_API, {
            timeout: 20000,
            retries: 2,
            retryDelay: 1000,
            headers: {
                Accept: "application/json"
            }
        });

        return payload || { hiringYears: [] };
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

    function updateStatisticsCount() {
        const countElement = document.getElementById("statisticsCount");
        if (countElement) {
            countElement.textContent = String(totalElements);
        }
    }

    function hasActiveSearchOrFilters() {
        return Boolean(currentSearch || currentHiringYear || currentDriveStatus);
    }

    function updatePaginationControls() {
        const prevButton = document.getElementById("statisticsPrevButton");
        const nextButton = document.getElementById("statisticsNextButton");
        const pageInfo = document.getElementById("statisticsPageInfo");

        if (prevButton) {
            prevButton.disabled = isStatisticsLoading || currentPage <= 0;
        }
        if (nextButton) {
            nextButton.disabled = isStatisticsLoading || totalPages === 0 || currentPage >= totalPages - 1;
        }
        if (pageInfo) {
            pageInfo.textContent = "Page " + (totalPages === 0 ? 0 : currentPage + 1) + " of " + totalPages;
        }
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
            return [
                '<div class="company-logo">',
                '<img src="', escapeHtml(record.companyLogoUrl), '" alt="', escapeHtml(companyName), ' logo" loading="lazy" decoding="async" width="60" height="60">',
                '</div>'
            ].join("");
        }

        return [
            '<div class="company-logo text-logo">',
            escapeHtml(companyName.charAt(0).toUpperCase()),
            '</div>'
        ].join("");
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

        return [
            "conic-gradient(",
            "#22c55e 0% ", selectedEnd, "%, ",
            "#3b82f6 ", selectedEnd, "% ", shortlistedEnd, "%, ",
            "#f59e0b ", shortlistedEnd, "% ", attendedEnd, "%, ",
            "#94a3b8 ", attendedEnd, "% ", notAttendedEnd, "%)",
        ].join("");
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

        card.innerHTML = [
            '<div class="mini-pie-indicator" style="background: ', buildDonutGradient(record), ';"></div>',
            '<div class="card-header">',
            '<div class="company-info">',
            getLogoMarkup(record),
            '<div class="company-titles">',
            '<h3>', escapeHtml(record.driveTitle || "Untitled Drive"), '</h3>',
            '<p>',
            escapeHtml(record.companyName || "Company unavailable"),
            ' &bull; ',
            escapeHtml(record.hiringYear || "Year unavailable"),
            ' &bull; ',
            escapeHtml(formatDate(record.hiringDate)),
            '</p>',
            '</div>',
            '</div>',
            '</div>',
            '<div class="badges-row">',
            '<span class="badge">', escapeHtml(record.companyType || "Company Type"), '</span>',
            '<span class="badge">', escapeHtml(record.industry || "Industry"), '</span>',
            '<span class="badge ', getStatusClass(record.driveStatus), '">', escapeHtml(record.driveStatus || "Closed"), '</span>',
            '</div>',
            '<div class="stat-pills-container">',
            '<div class="stat-pills">',
            '<span class="pill"><span class="pill-lbl">Applied:</span> <span class="pill-val">', escapeHtml(applied), '</span></span>',
            '<span class="pill"><span class="pill-lbl">Attended:</span> <span class="pill-val">', escapeHtml(attended), '</span></span>',
            '<span class="pill"><span class="pill-lbl">Shortlisted:</span> <span class="pill-val">', escapeHtml(shortlisted), '</span></span>',
            '<span class="pill"><span class="pill-lbl">Selected:</span> <span class="pill-val">', escapeHtml(selected), '</span></span>',
            '</div>',
            '<div class="stat-pills">',
            '<span class="pill"><span class="pill-lbl">Male:</span> <span class="pill-val">', escapeHtml(male), '</span></span>',
            '<span class="pill"><span class="pill-lbl">Female:</span> <span class="pill-val">', escapeHtml(female), '</span></span>',
            '<span class="pill"><span class="pill-lbl">High:</span> <span class="pill-val">', escapeHtml(packageText(record.highestPackage)), '</span></span>',
            '<span class="pill"><span class="pill-lbl">Avg:</span> <span class="pill-val">', escapeHtml(packageText(record.averagePackage)), '</span></span>',
            '<span class="pill"><span class="pill-lbl">Low:</span> <span class="pill-val">', escapeHtml(packageText(record.lowestPackage)), '</span></span>',
            '</div>',
            '</div>'
        ].join("");

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

    function setListLoading(isLoading, initialLoad) {
        const loading = document.getElementById("studentStatisticsLoading");
        const list = document.getElementById("studentStatisticsList");
        const empty = document.getElementById("studentStatisticsEmpty");
        const inlineLoading = document.getElementById("statisticsInlineLoading");

        if (loading) {
            loading.classList.toggle("hidden", !(isLoading && initialLoad));
        }
        if (list) {
            list.classList.toggle("hidden", Boolean(isLoading && initialLoad));
        }
        if (empty && isLoading) {
            empty.classList.add("hidden");
        }
        if (inlineLoading) {
            inlineLoading.classList.toggle("hidden", !(isLoading && !initialLoad));
        }
    }

    function renderStatistics(records) {
        const loading = document.getElementById("studentStatisticsLoading");
        const list = document.getElementById("studentStatisticsList");
        const empty = document.getElementById("studentStatisticsEmpty");

        hideElement(loading);
        if (!list || !empty) {
            return;
        }

        list.innerHTML = "";
        updateStatisticsCount();
        updatePaginationControls();

        if (!records.length) {
            list.classList.add("hidden");
            empty.classList.remove("hidden");
            empty.innerHTML = hasActiveSearchOrFilters()
                ? "No matching placement statistics found."
                : "No placement statistics found.";
            return;
        }

        list.classList.remove("hidden");
        empty.classList.add("hidden");

        const fragment = document.createDocumentFragment();
        records.forEach(function (record, index) {
            fragment.appendChild(renderCard(record, index));
        });
        list.appendChild(fragment);

        observeCards();

        if (window.lucide && typeof window.lucide.createIcons === "function") {
            window.lucide.createIcons();
        }
    }

    function populateYearFilter(options) {
        const yearFilter = document.getElementById("statisticsYearFilter");
        if (!yearFilter) return;

        const years = Array.isArray(options.hiringYears) ? options.hiringYears : [];
        yearFilter.innerHTML = '<option value="">All Hiring Years</option>';

        years.forEach(function (year) {
            const option = document.createElement("option");
            option.value = String(year);
            option.textContent = String(year);
            yearFilter.appendChild(option);
        });

        if (currentHiringYear && years.map(String).includes(String(currentHiringYear))) {
            yearFilter.value = String(currentHiringYear);
        }
    }

    function buildCacheKey(page) {
        return [Number(page) || 0, PAGE_SIZE, currentSearch, currentHiringYear, currentDriveStatus].join("|");
    }

    function storePageInCache(page, payload) {
        statisticsPageCache.set(buildCacheKey(page), payload);
    }

    function getCachedPage(page) {
        return statisticsPageCache.get(buildCacheKey(page)) || null;
    }

    async function prefetchStatisticsPage(page) {
        const safePage = Number(page) || 0;
        if (safePage < 0 || safePage >= totalPages || getCachedPage(safePage)) {
            return;
        }

        const controller = new AbortController();
        try {
            const payload = await fetchStatistics(safePage, controller.signal);
            storePageInCache(safePage, payload);
        } catch (error) {
            console.error("Failed to prefetch placement statistics page:", safePage, error);
        }
    }

    function applyPagePayload(payload) {
        currentPage = Number(payload.page) || 0;
        totalPages = Number(payload.totalPages) || 0;
        totalElements = Number(payload.totalElements) || 0;
        currentPageStatistics = Array.isArray(payload.content) ? payload.content : [];

        renderStatistics(currentPageStatistics);
        void prefetchStatisticsPage(currentPage + 1);
    }

    async function loadStatistics(page, options) {
        options = options || {};
        const safePage = Math.max(0, Number(page) || 0);
        const initialLoad = Boolean(options.initialLoad);
        const requestId = ++loadRequestToken;

        if (isStatisticsLoading && !options.force) {
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

        if (activeStatisticsRequest) {
            activeStatisticsRequest.abort();
        }

        activeStatisticsRequest = new AbortController();
        isStatisticsLoading = true;
        updatePaginationControls();
        setListLoading(true, initialLoad);

        try {
            const payload = await fetchStatistics(safePage, activeStatisticsRequest.signal);
            if (!isPageActive || requestId !== loadRequestToken) {
                return;
            }
            storePageInCache(safePage, payload);
            applyPagePayload(payload);

            if (!currentPageStatistics.length && currentPage > 0 && totalPages > 0) {
                await loadStatistics(totalPages - 1, { force: true });
                return;
            }
        } catch (error) {
            if (!isPageActive || requestId !== loadRequestToken) {
                return;
            }
            if (error && error.name === "AbortError") {
                return;
            }
            console.error("Failed to load paginated placement statistics:", error);
            totalPages = 0;
            totalElements = 0;
            currentPageStatistics = [];
            updatePaginationControls();
            showError("Unable to load placement statistics. Please try again.");
        } finally {
            if (requestId === loadRequestToken) {
                isStatisticsLoading = false;
                activeStatisticsRequest = null;
                updatePaginationControls();
                setListLoading(false, initialLoad);
            }
        }
    }

    function setupFilters() {
        const searchInput = document.getElementById("statisticsSearchInput");
        const yearFilter = document.getElementById("statisticsYearFilter");
        const statusFilter = document.getElementById("statisticsStatusFilter");

        if (searchInput) {
            searchInput.addEventListener("input", function () {
                const nextSearch = searchInput.value.trim();
                if (searchDebounceTimer) {
                    clearTimeout(searchDebounceTimer);
                }
                searchDebounceTimer = setTimeout(function () {
                    currentSearch = nextSearch;
                    loadStatistics(0, { initialLoad: false, force: true });
                }, SEARCH_DEBOUNCE_MS);
            });
        }

        if (yearFilter) {
            yearFilter.addEventListener("change", function () {
                currentHiringYear = yearFilter.value;
                loadStatistics(0, { initialLoad: false, force: true });
            });
        }

        if (statusFilter) {
            statusFilter.addEventListener("change", function () {
                currentDriveStatus = statusFilter.value;
                loadStatistics(0, { initialLoad: false, force: true });
            });
        }
    }

    function setupPagination() {
        const prevButton = document.getElementById("statisticsPrevButton");
        const nextButton = document.getElementById("statisticsNextButton");

        if (prevButton) {
            prevButton.addEventListener("click", function () {
                if (currentPage > 0) {
                    loadStatistics(currentPage - 1, { initialLoad: false });
                }
            });
        }

        if (nextButton) {
            nextButton.addEventListener("click", function () {
                if (currentPage < totalPages - 1) {
                    loadStatistics(currentPage + 1, { initialLoad: false });
                }
            });
        }
    }

    function setupBackButton() {
        const backBtn = document.getElementById("statisticsBackBtn");
        if (!backBtn) return;

        const params = new URLSearchParams(window.location.search);
        if (params.get("from") === "dashboard-placement-card") {
            backBtn.href = "/student-dashboard#placement-statistics-card";
        }
    }

    function observeCards() {
        const cards = document.querySelectorAll(".stat-card");

        if (!("IntersectionObserver" in window)) {
            cards.forEach(function (card) {
                card.classList.add("visible");
            });
            return;
        }

        if (!statisticsObserver) {
            statisticsObserver = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("visible");
                    }
                });
            }, {
                threshold: 0.1
            });
        }

        cards.forEach(function (card) {
            statisticsObserver.unobserve(card);
            statisticsObserver.observe(card);
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
            (record.driveTitle || "Placement drive") + " - " + (record.companyName || "Company unavailable")
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
        const list = document.getElementById("studentStatisticsList");
        const empty = document.getElementById("studentStatisticsEmpty");
        const inlineLoading = document.getElementById("statisticsInlineLoading");

        hideElement(loading);
        hideElement(inlineLoading);
        if (list) {
            list.classList.add("hidden");
        }
        if (empty) {
            empty.textContent = message || "Unable to load placement statistics right now.";
            empty.classList.remove("hidden");
        }

        totalPages = 0;
        totalElements = 0;
        currentPageStatistics = [];
        updateStatisticsCount();
        updatePaginationControls();
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
        setupPagination();
        updatePaginationControls();
        setListLoading(true, true);

        try {
            const filterOptionsPromise = fetchFilterOptions()
                .then(populateYearFilter)
                .catch(function (error) {
                    console.error("Failed to load placement statistics filters:", error);
                });

            const firstPagePromise = loadStatistics(0, { initialLoad: true, force: true });
            await Promise.all([filterOptionsPromise, firstPagePromise]);
        } catch (error) {
            console.error("Failed to initialize placement statistics page:", error);
            showError("Unable to load placement statistics. Please try again.");
        }
    });
})();
