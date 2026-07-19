(function () {
    const SELECTED_STUDENTS_API = "/api/student/selected-students/paged";
    const FILTER_OPTIONS_API = "/api/student/selected-students/filter-options";
    const PAGE_SIZE = 20;
    const SEARCH_DEBOUNCE_MS = 300;
    const selectedStudentsPageCache = new Map();

    let currentPage = 0;
    let totalPages = 0;
    let totalElements = 0;
    let currentPageStudents = [];
    let currentSearch = "";
    let currentBranch = "";
    let currentCompany = "";
    let isStudentsLoading = false;
    let activeStudentsRequest = null;
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

    function formatSelectionYear(value) {
        const normalized = String(value == null ? "" : value).trim();
        return normalized || "N/A";
    }

    async function fetchSelectedStudents(page, signal) {
        const params = new URLSearchParams({
            page: String(Math.max(0, Number(page) || 0)),
            size: String(PAGE_SIZE)
        });

        if (currentSearch) {
            params.set("search", currentSearch);
        }
        if (currentBranch) {
            params.set("branch", currentBranch);
        }
        if (currentCompany) {
            params.set("company", currentCompany);
        }

        const payload = await window.apiClient.get(SELECTED_STUDENTS_API + "?" + params.toString(), {
            timeout: 20000,
            retries: 3,
            retryDelay: 1200,
            signal,
            headers: {
                Accept: "application/json"
            }
        });

        if (!payload || !Array.isArray(payload.content)) {
            throw new Error("Invalid selected students response received.");
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

        return payload || { branches: [], companies: [] };
    }

    function getStudentPhotoUrl(student) {
        return safeText(student.photoUrl, "");
    }

    function getAvatarFallbackUrl(student) {
        const name = safeText(student.studentName, "Student");
        return "https://ui-avatars.com/api/?name=" + encodeURIComponent(name) + "&background=f4f4f4&color=0a0a0a";
    }

    function getCompanyLogoMarkup(student) {
        if (student.companyLogoUrl) {
            return '<div class="company-logo"><img src="' + escapeHtml(student.companyLogoUrl) + '" alt="' + escapeHtml(safeText(student.companyName, "Company")) + '" loading="lazy" decoding="async" width="56" height="56"></div>';
        }

        return [
            '<div class="company-logo">',
            '<i data-lucide="building-2" style="color: var(--black); width: 24px; height: 24px;"></i>',
            "</div>"
        ].join("");
    }

    function populateSelect(selectId, values, fallbackLabel, selectedValue) {
        const select = document.getElementById(selectId);
        if (!select) {
            return;
        }

        const uniqueValues = Array.from(new Set((values || []).filter(Boolean))).sort();
        select.innerHTML = '<option value="">' + fallbackLabel + "</option>";

        uniqueValues.forEach(function (value) {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = value;
            select.appendChild(option);
        });

        if (selectedValue && uniqueValues.includes(selectedValue)) {
            select.value = selectedValue;
        }
    }

    function populateFilters(options) {
        populateSelect("branchFilter", options.branches, "All Branches", currentBranch);
        populateSelect("companyFilter", options.companies, "All Companies", currentCompany);
    }

    function updateStudentCount() {
        const countElement = document.getElementById("studentCount");
        if (countElement) {
            countElement.textContent = String(totalElements);
        }
    }

    function hasActiveSearchOrFilters() {
        return Boolean(currentSearch || currentBranch || currentCompany);
    }

    function updatePaginationControls() {
        const prevButton = document.getElementById("studentsPrevButton");
        const nextButton = document.getElementById("studentsNextButton");
        const pageInfo = document.getElementById("studentsPageInfo");

        if (prevButton) {
            prevButton.disabled = isStudentsLoading || currentPage <= 0;
        }
        if (nextButton) {
            nextButton.disabled = isStudentsLoading || totalPages === 0 || currentPage >= totalPages - 1;
        }
        if (pageInfo) {
            pageInfo.textContent = "Page " + (totalPages === 0 ? 0 : currentPage + 1) + " of " + totalPages;
        }
    }

    function setListLoading(isLoading, initialLoad) {
        const loadingElement = document.getElementById("studentSelectedStudentsLoading");
        const list = document.getElementById("studentsGrid");
        const emptyState = document.getElementById("emptyState");
        const inlineLoading = document.getElementById("studentsInlineLoading");

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

    function renderStudents(students) {
        const loadingElement = document.getElementById("studentSelectedStudentsLoading");
        const studentsGrid = document.getElementById("studentsGrid");
        const emptyState = document.getElementById("emptyState");

        hideElement(loadingElement);
        if (!studentsGrid || !emptyState) {
            return;
        }

        studentsGrid.innerHTML = "";
        updateStudentCount();
        updatePaginationControls();

        if (!students.length) {
            studentsGrid.classList.add("hidden");
            emptyState.classList.remove("hidden");
            emptyState.innerHTML = [
                '<i data-lucide="users-round"></i>',
                hasActiveSearchOrFilters() ? '<h3>No matching students found</h3>' : '<h3>No students found</h3>',
                hasActiveSearchOrFilters()
                    ? '<p>Try adjusting your search or filters to find what you\'re looking for.</p>'
                    : '<p>No selected student records are available yet.</p>'
            ].join("");
            initLucideIcons();
            return;
        }

        studentsGrid.classList.remove("hidden");
        emptyState.classList.add("hidden");

        const fragment = document.createDocumentFragment();

        students.forEach(function (student) {
            const companyName = safeText(student.companyName, "N/A");
            const driveTitle = safeText(student.driveTitle, "N/A");
            const hiringYear = safeText(student.hiringYear, "N/A");
            const offerType = safeText(student.offerType, "N/A");
            const packageOffered = safeText(student.packageOffered, "N/A");
            const studentName = safeText(student.studentName, "Student");
            const rollNumber = safeText(student.rollNumber, "N/A");
            const branch = safeText(student.branch, "N/A");
            const gender = safeText(student.gender, "N/A");
            const selectionYear = formatSelectionYear(student.selectionYear);
            const photoUrl = getStudentPhotoUrl(student) || getAvatarFallbackUrl(student);

            const card = document.createElement("article");
            card.className = "card ripple-container student-card";
            card.tabIndex = 0;
            card.dataset.company = companyName;
            card.dataset.name = studentName;
            card.dataset.roll = rollNumber;
            card.dataset.branch = branch;
            card.dataset.package = packageOffered;
            card.dataset.year = selectionYear;
            card.dataset.img = photoUrl;

            card.innerHTML = [
                '<div class="card-header">',
                '<div class="company-info-wrap">',
                getCompanyLogoMarkup(student),
                '<div class="company-titles">',
                '<h3 class="company-name">', escapeHtml(driveTitle), "</h3>",
                '<p class="company-sub">', escapeHtml(companyName), " | Hiring Year ", escapeHtml(hiringYear), "</p>",
                "</div>",
                "</div>",
                '<div class="status-badge">Active</div>',
                "</div>",
                '<div class="job-badges">',
                '<span class="job-badge outline">', escapeHtml(offerType), "</span>",
                '<span class="job-badge filled">', escapeHtml(packageOffered), "</span>",
                "</div>",
                '<div class="student-row">',
                '<div class="student-avatar">',
                '<img src="', escapeHtml(photoUrl), '" alt="', escapeHtml(studentName), '" loading="lazy" decoding="async" width="64" height="64" onerror="this.src=\'', escapeHtml(getAvatarFallbackUrl(student)), '\'">',
                "</div>",
                '<div class="student-details">',
                '<h4 class="student-name">', escapeHtml(studentName), "</h4>",
                '<p class="student-meta-line">', escapeHtml(rollNumber), " &nbsp;&nbsp;|&nbsp;&nbsp; ", escapeHtml(branch), "</p>",
                '<p class="student-meta-line">Gender: ', escapeHtml(gender), " &nbsp;&nbsp;&nbsp; Selection Year: ", escapeHtml(selectionYear), "</p>",
                "</div>",
                "</div>"
            ].join("");

            card.addEventListener("mousedown", function (event) {
                addRipple(event, card);
            });

            card.addEventListener("click", function () {
                setTimeout(function () {
                    openModal(card);
                }, 120);
            });

            card.addEventListener("keydown", function (event) {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    card.click();
                }
            });

            fragment.appendChild(card);
        });

        studentsGrid.appendChild(fragment);
        initCardObserver();
        initLucideIcons();
    }

    function buildCacheKey(page) {
        return [Number(page) || 0, PAGE_SIZE, currentSearch, currentBranch, currentCompany].join("|");
    }

    function storePageInCache(page, payload) {
        selectedStudentsPageCache.set(buildCacheKey(page), payload);
    }

    function getCachedPage(page) {
        return selectedStudentsPageCache.get(buildCacheKey(page)) || null;
    }

    async function prefetchSelectedStudentsPage(page) {
        const safePage = Number(page) || 0;
        if (safePage < 0 || safePage >= totalPages || getCachedPage(safePage)) {
            return;
        }

        const controller = new AbortController();
        try {
            const payload = await fetchSelectedStudents(safePage, controller.signal);
            storePageInCache(safePage, payload);
        } catch (error) {
            console.error("Failed to prefetch selected students page:", safePage, error);
        }
    }

    function applyPagePayload(payload) {
        currentPage = Number(payload.page) || 0;
        totalPages = Number(payload.totalPages) || 0;
        totalElements = Number(payload.totalElements) || 0;
        currentPageStudents = Array.isArray(payload.content) ? payload.content : [];

        renderStudents(currentPageStudents);
        void prefetchSelectedStudentsPage(currentPage + 1);
    }

    async function loadSelectedStudents(page, options) {
        options = options || {};
        const safePage = Math.max(0, Number(page) || 0);
        const initialLoad = Boolean(options.initialLoad);
        const requestId = ++loadRequestToken;

        if (isStudentsLoading && !options.force) {
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

        if (activeStudentsRequest) {
            activeStudentsRequest.abort();
        }

        activeStudentsRequest = new AbortController();
        isStudentsLoading = true;
        updatePaginationControls();
        setListLoading(true, initialLoad);

        try {
            const payload = await fetchSelectedStudents(safePage, activeStudentsRequest.signal);
            if (!isPageActive || requestId !== loadRequestToken) {
                return;
            }
            storePageInCache(safePage, payload);
            applyPagePayload(payload);

            if (!currentPageStudents.length && currentPage > 0 && totalPages > 0) {
                await loadSelectedStudents(totalPages - 1, { force: true });
                return;
            }
        } catch (error) {
            if (!isPageActive || requestId !== loadRequestToken) {
                return;
            }
            if (error && error.name === "AbortError") {
                return;
            }
            console.error("Failed to load paginated selected students:", error);
            totalPages = 0;
            totalElements = 0;
            currentPageStudents = [];
            updatePaginationControls();
            showError("Unable to load selected students. Please try again.");
        } finally {
            if (requestId === loadRequestToken) {
                isStudentsLoading = false;
                activeStudentsRequest = null;
                updatePaginationControls();
                setListLoading(false, initialLoad);
            }
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

    function initCardObserver() {
        const cards = document.querySelectorAll(".student-card");

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

    function openModal(card) {
        const modal = document.getElementById("studentModal");
        if (!modal) return;

        document.getElementById("modalImg").src = card.dataset.img || "";
        document.getElementById("modalName").textContent = card.dataset.name || "N/A";
        document.getElementById("modalRoll").textContent = card.dataset.roll || "N/A";
        document.getElementById("modalCompany").textContent = card.dataset.company || "N/A";
        document.getElementById("modalBranch").textContent = card.dataset.branch || "N/A";
        document.getElementById("modalPackage").textContent = card.dataset.package || "N/A";
        document.getElementById("modalYear").textContent = card.dataset.year || "N/A";

        initLucideIcons();
        modal.classList.add("active");
        document.body.style.overflow = "hidden";
    }

    function closeModal() {
        const modal = document.getElementById("studentModal");
        if (!modal) return;

        modal.classList.remove("active");
        document.body.style.overflow = "";
    }

    function setupModal() {
        const modal = document.getElementById("studentModal");
        const modalClose = document.getElementById("modalClose");

        if (modalClose) {
            modalClose.addEventListener("click", closeModal);
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
        const loadingElement = document.getElementById("studentSelectedStudentsLoading");
        const studentsGrid = document.getElementById("studentsGrid");
        const emptyState = document.getElementById("emptyState");
        const inlineLoading = document.getElementById("studentsInlineLoading");

        hideElement(loadingElement);
        hideElement(inlineLoading);
        if (studentsGrid) {
            studentsGrid.classList.add("hidden");
        }
        if (emptyState) {
            emptyState.innerHTML = [
                '<i data-lucide="users-round"></i>',
                '<h3>Unable to load selected students.</h3>',
                '<p>', escapeHtml(message || "Please try again."), '</p>'
            ].join("");
            emptyState.classList.remove("hidden");
        }

        totalPages = 0;
        totalElements = 0;
        updateStudentCount();
        updatePaginationControls();
        initLucideIcons();
    }

    function setupFilters() {
        const searchInput = document.getElementById("searchInput");
        const branchFilter = document.getElementById("branchFilter");
        const companyFilter = document.getElementById("companyFilter");

        if (searchInput) {
            searchInput.addEventListener("input", function () {
                const nextSearch = searchInput.value.trim();
                if (searchDebounceTimer) {
                    clearTimeout(searchDebounceTimer);
                }
                searchDebounceTimer = setTimeout(function () {
                    currentSearch = nextSearch;
                    loadSelectedStudents(0, { initialLoad: false, force: true });
                }, SEARCH_DEBOUNCE_MS);
            });
        }

        if (branchFilter) {
            branchFilter.addEventListener("change", function () {
                currentBranch = branchFilter.value;
                loadSelectedStudents(0, { initialLoad: false, force: true });
            });
        }

        if (companyFilter) {
            companyFilter.addEventListener("change", function () {
                currentCompany = companyFilter.value;
                loadSelectedStudents(0, { initialLoad: false, force: true });
            });
        }
    }

    function setupPagination() {
        const prevButton = document.getElementById("studentsPrevButton");
        const nextButton = document.getElementById("studentsNextButton");

        if (prevButton) {
            prevButton.addEventListener("click", function () {
                if (currentPage > 0) {
                    loadSelectedStudents(currentPage - 1, { initialLoad: false });
                }
            });
        }

        if (nextButton) {
            nextButton.addEventListener("click", function () {
                if (currentPage < totalPages - 1) {
                    loadSelectedStudents(currentPage + 1, { initialLoad: false });
                }
            });
        }
    }

    function setupBackButton() {
        const backBtn = document.getElementById("selectedStudentsBackBtn");
        if (!backBtn) return;

        const params = new URLSearchParams(window.location.search);
        if (params.get("from") === "dashboard-selected-students-card") {
            backBtn.href = "/student-dashboard#selected-students-card";
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
                    console.error("Failed to load selected student filters:", error);
                });

            const firstPagePromise = loadSelectedStudents(0, { initialLoad: true, force: true });
            await Promise.all([filterOptionsPromise, firstPagePromise]);
        } catch (error) {
            console.error("Failed to initialize selected students page:", error);
            showError("Unable to load selected students. Please try again.");
        }
    });
})();
