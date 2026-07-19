(function () {
    const EXPERIENCES_API = "/api/student/interview-experiences/paged";
    const FILTER_OPTIONS_API = "/api/student/interview-experiences/filter-options";
    const PAGE_SIZE = 20;
    const SEARCH_DEBOUNCE_MS = 300;
    const experiencesPageCache = new Map();

    let currentPage = 0;
    let totalPages = 0;
    let totalElements = 0;
    let currentPageExperiences = [];
    let currentSearch = "";
    let currentPlacementDriveId = "";
    let currentDifficultyLevel = "";
    let currentFinalResult = "";
    let currentHiringYear = "";
    let isExperiencesLoading = false;
    let activeExperiencesRequest = null;
    let searchDebounceTimer = null;
    let cardObserver = null;
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

    function safeText(value, fallback) {
        const normalized = String(value == null ? "" : value).trim();
        return normalized || fallback;
    }

    async function fetchExperiences(page, signal) {
        const params = new URLSearchParams({
            page: String(Math.max(0, Number(page) || 0)),
            size: String(PAGE_SIZE)
        });

        if (currentSearch) {
            params.set("search", currentSearch);
        }
        if (currentPlacementDriveId) {
            params.set("placementDriveId", currentPlacementDriveId);
        }
        if (currentDifficultyLevel) {
            params.set("difficultyLevel", currentDifficultyLevel);
        }
        if (currentFinalResult) {
            params.set("finalResult", currentFinalResult);
        }
        if (currentHiringYear) {
            params.set("hiringYear", currentHiringYear);
        }

        const payload = await window.apiClient.get(EXPERIENCES_API + "?" + params.toString(), {
            timeout: 20000,
            retries: 3,
            retryDelay: 1200,
            signal,
            headers: {
                Accept: "application/json"
            }
        });

        if (!payload || !Array.isArray(payload.content)) {
            throw new Error("Invalid interview experiences response received.");
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

        return payload || { drives: [], hiringYears: [], finalResults: [] };
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

    function getDifficultyBadgeClass() {
        return "badge";
    }

    function getResultBadgeClass() {
        return "badge";
    }

    function populateSelect(id, values, defaultLabel, selectedValue, valueSelector, labelSelector) {
        const select = document.getElementById(id);
        if (!select) return;

        select.innerHTML = '<option value="">' + defaultLabel + "</option>";

        (values || []).forEach(function (value) {
            const option = document.createElement("option");
            option.value = String(valueSelector ? valueSelector(value) : value);
            option.textContent = String(labelSelector ? labelSelector(value) : value);
            select.appendChild(option);
        });

        if (selectedValue) {
            select.value = String(selectedValue);
        }
    }

    function populateFilters(options) {
        populateSelect("driveFilter", options.drives, "All Placement Drives", currentPlacementDriveId, function (option) {
            return option.value;
        }, function (option) {
            return option.label;
        });

        populateSelect("yearFilter", options.hiringYears, "All Hiring Years", currentHiringYear);
        populateSelect("resultFilter", options.finalResults, "All Final Results", currentFinalResult);
    }

    function getDriveLabel(experience) {
        return safeText(experience.companyName, "N/A") + " - " + safeText(experience.driveTitle, "N/A") + " (" + safeText(experience.hiringYear, "N/A") + ")";
    }

    function getCompanyLogoMarkup(experience) {
        if (experience.companyLogoUrl) {
            return [
                '<div class="company-logo">',
                '<img src="', escapeHtml(experience.companyLogoUrl), '" alt="', escapeHtml(safeText(experience.companyName, "Company")), '" loading="lazy" decoding="async" width="48" height="48">',
                '</div>'
            ].join("");
        }

        return '<div class="company-logo text-logo"><span>' + escapeHtml(safeText(experience.companyName, "C").charAt(0).toUpperCase()) + "</span></div>";
    }

    function getPhotoUrl(experience) {
        if (experience.studentPhotoUrl) {
            return experience.studentPhotoUrl;
        }

        return "https://ui-avatars.com/api/?name=" + encodeURIComponent(safeText(experience.studentName, "Student")) + "&background=0a0a0a&color=fff";
    }

    function updateExperienceCount() {
        const expCount = document.getElementById("expCount");
        if (expCount) {
            expCount.textContent = String(totalElements);
        }
    }

    function hasActiveSearchOrFilters() {
        return Boolean(currentSearch || currentPlacementDriveId || currentDifficultyLevel || currentFinalResult || currentHiringYear);
    }

    function updatePaginationControls() {
        const prevButton = document.getElementById("experiencesPrevButton");
        const nextButton = document.getElementById("experiencesNextButton");
        const pageInfo = document.getElementById("experiencesPageInfo");

        if (prevButton) {
            prevButton.disabled = isExperiencesLoading || currentPage <= 0;
        }
        if (nextButton) {
            nextButton.disabled = isExperiencesLoading || totalPages === 0 || currentPage >= totalPages - 1;
        }
        if (pageInfo) {
            pageInfo.textContent = "Page " + (totalPages === 0 ? 0 : currentPage + 1) + " of " + totalPages;
        }
    }

    function setListLoading(isLoading, initialLoad) {
        const loadingElement = document.getElementById("studentExperienceLoading");
        const list = document.getElementById("expGrid");
        const emptyState = document.getElementById("studentExperienceEmpty");
        const inlineLoading = document.getElementById("experiencesInlineLoading");

        if (loadingElement) {
            loadingElement.classList.toggle("hidden", !(isLoading && initialLoad));
        }
        if (list) {
            list.classList.toggle("hidden", Boolean(isLoading && initialLoad));
        }
        if (emptyState && isLoading) {
            emptyState.classList.add("hidden");
        }
        if (inlineLoading) {
            inlineLoading.classList.toggle("hidden", !(isLoading && !initialLoad));
        }
    }

    function renderExperiences(experiences) {
        const loadingElement = document.getElementById("studentExperienceLoading");
        const list = document.getElementById("expGrid");
        const emptyState = document.getElementById("studentExperienceEmpty");

        hideElement(loadingElement);
        if (!list || !emptyState) {
            return;
        }

        list.innerHTML = "";
        updateExperienceCount();
        updatePaginationControls();

        if (!experiences.length) {
            list.classList.add("hidden");
            emptyState.classList.remove("hidden");
            emptyState.innerHTML = [
                '<i data-lucide="messages-square"></i>',
                hasActiveSearchOrFilters() ? '<h3>No matching experiences found</h3>' : '<h3>No experiences found</h3>',
                hasActiveSearchOrFilters()
                    ? '<p>Try adjusting your search filters.</p>'
                    : '<p>No interview experiences are available yet.</p>'
            ].join("");
            initLucideIcons();
            return;
        }

        list.classList.remove("hidden");
        emptyState.classList.add("hidden");

        const fragment = document.createDocumentFragment();

        experiences.forEach(function (experience) {
            const companyName = safeText(experience.companyName, "N/A");
            const driveTitle = safeText(experience.driveTitle, "N/A");
            const hiringYear = safeText(experience.hiringYear, "N/A");
            const hiringDate = formatDate(experience.hiringDate);
            const roleOffered = safeText(experience.roleOffered, "N/A");
            const difficultyLevel = safeText(experience.difficultyLevel, "N/A");
            const finalResult = safeText(experience.finalResult, "N/A");
            const studentName = safeText(experience.studentName, "N/A");
            const roundsFaced = safeText(experience.roundsFaced, "N/A");
            const experienceDate = formatDate(experience.experienceDate);
            const photoUrl = getPhotoUrl(experience);

            const card = document.createElement("article");
            card.className = "card exp-card ripple-container open-modal-btn";
            card.tabIndex = 0;
            card.dataset.company = companyName + " Interview Experience";
            card.dataset.student = studentName;
            card.dataset.questionsAsked = safeText(experience.questionsAsked, "N/A");
            card.dataset.codingQuestions = safeText(experience.codingQuestions, "N/A");
            card.dataset.technicalTopics = safeText(experience.technicalTopics, "N/A");
            card.dataset.hrQuestions = safeText(experience.hrQuestions, "N/A");
            card.dataset.preparationTips = safeText(experience.preparationTips, "N/A");

            card.innerHTML = [
                '<div class="card-action-btn"><i data-lucide="arrow-up-right"></i></div>',
                '<div class="card-header">',
                '<div class="company-info">',
                getCompanyLogoMarkup(experience),
                '<div class="company-titles">',
                '<h3>', escapeHtml(companyName), '</h3>',
                '<p>', escapeHtml(driveTitle), ' • ', escapeHtml(hiringYear), ' • ', escapeHtml(hiringDate), '</p>',
                '</div>',
                '</div>',
                '</div>',
                '<div class="card-badges">',
                '<span class="badge ', getResultBadgeClass(roleOffered), '">', escapeHtml(roleOffered), '</span>',
                '<span class="badge ', getDifficultyBadgeClass(difficultyLevel), '">', escapeHtml(difficultyLevel), '</span>',
                '<span class="badge ', getResultBadgeClass(finalResult), '">', escapeHtml(finalResult), '</span>',
                '</div>',
                '<div class="student-profile">',
                '<div class="student-avatar"><img src="', escapeHtml(photoUrl), '" alt="', escapeHtml(studentName), '" loading="lazy" decoding="async"></div>',
                '<div class="student-details"><h4>', escapeHtml(studentName), '</h4><p>', escapeHtml(roleOffered), '</p></div>',
                '</div>',
                '<div class="exp-summary">',
                '<p><strong>Drive:</strong> ', escapeHtml(getDriveLabel(experience)), '</p>',
                '<p><strong>Rounds Faced:</strong> ', escapeHtml(roundsFaced), '</p>',
                '<p><strong>Date:</strong> ', escapeHtml(experienceDate), '</p>',
                '</div>'
            ].join("");

            card.addEventListener("mousedown", function (event) {
                addRipple(event, card);
            });

            card.addEventListener("click", function () {
                openModal(card);
            });

            card.addEventListener("keydown", function (event) {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openModal(card);
                }
            });

            fragment.appendChild(card);
        });

        list.appendChild(fragment);
        initCardObserver();
        initLucideIcons();
    }

    function buildCacheKey(page) {
        return [Number(page) || 0, PAGE_SIZE, currentSearch, currentPlacementDriveId, currentDifficultyLevel, currentFinalResult, currentHiringYear].join("|");
    }

    function storePageInCache(page, payload) {
        experiencesPageCache.set(buildCacheKey(page), payload);
    }

    function getCachedPage(page) {
        return experiencesPageCache.get(buildCacheKey(page)) || null;
    }

    async function prefetchExperiencesPage(page) {
        const safePage = Number(page) || 0;
        if (safePage < 0 || safePage >= totalPages || getCachedPage(safePage)) {
            return;
        }

        const controller = new AbortController();
        try {
            const payload = await fetchExperiences(safePage, controller.signal);
            storePageInCache(safePage, payload);
        } catch (error) {
            console.error("Failed to prefetch interview experiences page:", safePage, error);
        }
    }

    function applyPagePayload(payload) {
        currentPage = Number(payload.page) || 0;
        totalPages = Number(payload.totalPages) || 0;
        totalElements = Number(payload.totalElements) || 0;
        currentPageExperiences = Array.isArray(payload.content) ? payload.content : [];

        renderExperiences(currentPageExperiences);
        void prefetchExperiencesPage(currentPage + 1);
    }

    async function loadExperiences(page, options) {
        options = options || {};
        const safePage = Math.max(0, Number(page) || 0);
        const initialLoad = Boolean(options.initialLoad);
        const requestId = ++loadRequestToken;

        if (isExperiencesLoading && !options.force) {
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

        if (activeExperiencesRequest) {
            activeExperiencesRequest.abort();
        }

        activeExperiencesRequest = new AbortController();
        isExperiencesLoading = true;
        updatePaginationControls();
        setListLoading(true, initialLoad);

        try {
            const payload = await fetchExperiences(safePage, activeExperiencesRequest.signal);
            if (!isPageActive || requestId !== loadRequestToken) {
                return;
            }
            storePageInCache(safePage, payload);
            applyPagePayload(payload);

            if (!currentPageExperiences.length && currentPage > 0 && totalPages > 0) {
                await loadExperiences(totalPages - 1, { force: true });
                return;
            }
        } catch (error) {
            if (!isPageActive || requestId !== loadRequestToken) {
                return;
            }
            if (error && error.name === "AbortError") {
                return;
            }
            console.error("Failed to load paginated interview experiences:", error);
            totalPages = 0;
            totalElements = 0;
            currentPageExperiences = [];
            updatePaginationControls();
            showError("Unable to load interview experiences. Please try again.");
        } finally {
            if (requestId === loadRequestToken) {
                isExperiencesLoading = false;
                activeExperiencesRequest = null;
                updatePaginationControls();
                setListLoading(false, initialLoad);
            }
        }
    }

    function setupFilters() {
        const searchInput = document.getElementById("searchInput");
        const driveFilter = document.getElementById("driveFilter");
        const difficultyFilter = document.getElementById("difficultyFilter");
        const resultFilter = document.getElementById("resultFilter");
        const yearFilter = document.getElementById("yearFilter");

        if (searchInput) {
            searchInput.addEventListener("input", function () {
                const nextSearch = searchInput.value.trim();
                if (searchDebounceTimer) {
                    clearTimeout(searchDebounceTimer);
                }
                searchDebounceTimer = setTimeout(function () {
                    currentSearch = nextSearch;
                    loadExperiences(0, { initialLoad: false, force: true });
                }, SEARCH_DEBOUNCE_MS);
            });
        }

        if (driveFilter) {
            driveFilter.addEventListener("change", function () {
                currentPlacementDriveId = driveFilter.value;
                loadExperiences(0, { initialLoad: false, force: true });
            });
        }

        if (difficultyFilter) {
            difficultyFilter.addEventListener("change", function () {
                currentDifficultyLevel = difficultyFilter.value;
                loadExperiences(0, { initialLoad: false, force: true });
            });
        }

        if (resultFilter) {
            resultFilter.addEventListener("change", function () {
                currentFinalResult = resultFilter.value;
                loadExperiences(0, { initialLoad: false, force: true });
            });
        }

        if (yearFilter) {
            yearFilter.addEventListener("change", function () {
                currentHiringYear = yearFilter.value;
                loadExperiences(0, { initialLoad: false, force: true });
            });
        }
    }

    function setupPagination() {
        const prevButton = document.getElementById("experiencesPrevButton");
        const nextButton = document.getElementById("experiencesNextButton");

        if (prevButton) {
            prevButton.addEventListener("click", function () {
                if (currentPage > 0) {
                    loadExperiences(currentPage - 1, { initialLoad: false });
                }
            });
        }

        if (nextButton) {
            nextButton.addEventListener("click", function () {
                if (currentPage < totalPages - 1) {
                    loadExperiences(currentPage + 1, { initialLoad: false });
                }
            });
        }
    }

    function openModal(card) {
        const modal = document.getElementById("expModal");
        if (!modal) return;

        document.getElementById("modalCompany").textContent = card.dataset.company || "N/A";
        document.getElementById("modalStudent").textContent = card.dataset.student || "N/A";
        document.getElementById("m-qs-asked").innerHTML = escapeHtml(card.dataset.questionsAsked || "N/A").replace(/\n/g, "<br>");
        document.getElementById("m-coding-qs").innerHTML = escapeHtml(card.dataset.codingQuestions || "N/A").replace(/\n/g, "<br>");
        document.getElementById("m-tech-topics").innerHTML = escapeHtml(card.dataset.technicalTopics || "N/A").replace(/\n/g, "<br>");
        document.getElementById("m-hr-qs").innerHTML = escapeHtml(card.dataset.hrQuestions || "N/A").replace(/\n/g, "<br>");
        document.getElementById("m-prep-tips").innerHTML = escapeHtml(card.dataset.preparationTips || "N/A").replace(/\n/g, "<br>");

        modal.classList.add("active");
        document.body.style.overflow = "hidden";
        initLucideIcons();
    }

    function closeModal() {
        const modal = document.getElementById("expModal");
        if (!modal) return;

        modal.classList.remove("active");
        document.body.style.overflow = "";
    }

    function setupModal() {
        const modal = document.getElementById("expModal");
        const closeButton = document.getElementById("closeModal");

        if (closeButton) {
            closeButton.addEventListener("click", closeModal);
        }

        if (modal) {
            modal.addEventListener("click", function (event) {
                if (event.target === modal) {
                    closeModal();
                }
            });
        }

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                closeModal();
            }
        });
    }

    function showError(message) {
        const loadingElement = document.getElementById("studentExperienceLoading");
        const list = document.getElementById("expGrid");
        const emptyState = document.getElementById("studentExperienceEmpty");
        const inlineLoading = document.getElementById("experiencesInlineLoading");

        hideElement(loadingElement);
        hideElement(inlineLoading);
        if (list) {
            list.classList.add("hidden");
        }
        if (emptyState) {
            emptyState.innerHTML = [
                '<i data-lucide="messages-square"></i>',
                '<h3>Unable to load interview experiences.</h3>',
                '<p>', escapeHtml(message || "Please try again."), '</p>'
            ].join("");
            emptyState.classList.remove("hidden");
        }

        totalPages = 0;
        totalElements = 0;
        currentPageExperiences = [];
        updateExperienceCount();
        updatePaginationControls();
        initLucideIcons();
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

    function initCardObserver() {
        const cards = document.querySelectorAll(".exp-card");

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
        const backButton = document.getElementById("interviewExperienceBackBtn");
        if (!backButton) return;

        const params = new URLSearchParams(window.location.search);
        if (params.get("from") === "dashboard-interview-experience-card") {
            backButton.href = "/student-dashboard#interview-experience-card";
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
        setupModal();
        setupFilters();
        setupPagination();
        updatePaginationControls();
        setListLoading(true, true);

        try {
            const filterOptionsPromise = fetchFilterOptions()
                .then(populateFilters)
                .catch(function (error) {
                    console.error("Failed to load interview experience filters:", error);
                });

            const firstPagePromise = loadExperiences(0, { initialLoad: true, force: true });
            await Promise.all([filterOptionsPromise, firstPagePromise]);
        } catch (error) {
            console.error("Failed to initialize interview experiences page:", error);
            showError("Unable to load interview experiences. Please try again.");
        }
    });
})();
