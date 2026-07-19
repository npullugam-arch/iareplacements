(function () {
    const COMPANIES_API = "/api/companies";
    const PAGE_SIZE = 20;
    const SEARCH_DEBOUNCE_MS = 300;
    const SKELETON_CARD_COUNT = 6;
    const companiesPageCache = new Map();
    let currentPage = 0;
    let totalPages = 0;
    let totalElements = 0;
    let currentPageCompanies = [];
    let currentSearch = "";
    let isCompaniesLoading = false;
    let activeCompaniesRequest = null;
    let searchDebounceTimer = null;
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

    function createCompanySkeletonMarkup(count) {
        return Array.from({ length: count }).map(function () {
            return '<article class="company-card company-card-skeleton"></article>';
        }).join("");
    }

    function ensureSkeletonGrid() {
        const loadingElement = document.getElementById("studentCompaniesLoading");
        if (!loadingElement || loadingElement.dataset.initialized === "true") {
            return;
        }

        loadingElement.innerHTML = createCompanySkeletonMarkup(SKELETON_CARD_COUNT);
        loadingElement.dataset.initialized = "true";
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

    function buildFallbackLogo(companyName) {
        return [
            '<div class="company-logo-wrapper company-logo-fallback" aria-label="',
            escapeHtml(companyName),
            ' logo fallback">',
            '<span class="company-logo-fallback-letter">',
            escapeHtml(safeText(companyName, "C").charAt(0).toUpperCase()),
            "</span>",
            "</div>"
        ].join("");
    }

    async function fetchCompanies(page, signal) {
        const safePage = Math.max(0, Number(page) || 0);
        const params = new URLSearchParams({
            page: String(safePage),
            size: String(PAGE_SIZE)
        });
        if (currentSearch) {
            params.set("search", currentSearch);
        }
        const url = COMPANIES_API + "?" + params.toString();
        const payload = await window.apiClient.get(url, {
            timeout: 20000,
            retries: 3,
            retryDelay: 1200,
            signal,
            headers: {
                Accept: "application/json"
            }
        });

        if (!payload || !Array.isArray(payload.content)) {
            throw new Error("Invalid companies response received.");
        }

        return payload;
    }

    function populateSelect(id, values, defaultLabel) {
        const select = document.getElementById(id);
        if (!select) return;

        const uniqueValues = Array.from(new Set(values.filter(Boolean))).sort();
        select.innerHTML = '<option value="">' + defaultLabel + "</option>";

        uniqueValues.forEach(function (value) {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = value;
            select.appendChild(option);
        });
    }

    function populateFilters(companies) {
        populateSelect("typeFilter", companies.map(function (company) {
            return safeText(company.companyType, "");
        }), "All Types");

        populateSelect("industryFilter", companies.map(function (company) {
            return safeText(company.industry, "");
        }), "All Industries");
    }

    function getLogoMarkup(company) {
        const companyName = safeText(company.companyName, "C");

        if (company.logoUrl) {
            return [
                '<div class="company-logo-wrapper" data-company-logo-wrapper>',
                '<img src="', escapeHtml(company.logoUrl),
                '" alt="', escapeHtml(companyName), ' logo" class="company-logo" loading="lazy" decoding="async" width="140" height="140">',
                '<div class="company-logo-fallback hidden" data-company-logo-fallback aria-hidden="true">',
                '<span class="company-logo-fallback-letter">',
                escapeHtml(safeText(companyName, "C").charAt(0).toUpperCase()),
                "</span>",
                "</div>",
                '</div>'
            ].join("");
        }

        return buildFallbackLogo(companyName);
    }

    function initCompanyLogos() {
        const logos = document.querySelectorAll("[data-company-logo-wrapper] img.company-logo");

        logos.forEach(function (image) {
            if (image.dataset.logoHandled === "true") {
                return;
            }

            const wrapper = image.closest("[data-company-logo-wrapper]");
            const fallback = wrapper ? wrapper.querySelector("[data-company-logo-fallback]") : null;

            function showFallback() {
                if (fallback) {
                    fallback.classList.remove("hidden");
                    fallback.setAttribute("aria-hidden", "false");
                }
                image.classList.add("hidden");
            }

            function showImage() {
                if (fallback) {
                    fallback.classList.add("hidden");
                    fallback.setAttribute("aria-hidden", "true");
                }
                image.classList.remove("hidden");
            }

            image.addEventListener("load", showImage, { once: true });
            image.addEventListener("error", showFallback, { once: true });
            image.dataset.logoHandled = "true";

            if (image.complete) {
                if (image.naturalWidth > 0) {
                    showImage();
                } else {
                    showFallback();
                }
            }
        });
    }

    function updateCompanyCount(count) {
        const companyCount = document.getElementById("companyCount");
        if (companyCount) {
            companyCount.textContent = String(count);
        }
    }

    function hasActiveSearch() {
        return currentSearch.length > 0;
    }

    function updatePaginationControls() {
        const prevButton = document.getElementById("companiesPrevButton");
        const nextButton = document.getElementById("companiesNextButton");
        const pageInfo = document.getElementById("companiesPageInfo");

        if (prevButton) {
            prevButton.disabled = isCompaniesLoading || currentPage <= 0;
        }
        if (nextButton) {
            nextButton.disabled = isCompaniesLoading || totalPages === 0 || currentPage >= totalPages - 1;
        }
        if (pageInfo) {
            pageInfo.textContent = "Page " + (totalPages === 0 ? 0 : currentPage + 1) + " of " + totalPages;
        }
    }

    function setListLoading(isLoading, initialLoad) {
        const loadingElement = document.getElementById("studentCompaniesLoading");
        const list = document.getElementById("companiesGrid");
        const loadingHint = document.getElementById("companiesInlineLoading");
        const emptyState = document.getElementById("studentCompaniesEmpty");

        ensureSkeletonGrid();

        if (loadingElement) {
            if (isLoading && initialLoad) {
                showElement(loadingElement);
            } else {
                hideElement(loadingElement);
            }
        }
        if (list) {
            if (isLoading && initialLoad) {
                hideElement(list);
            } else {
                showElement(list);
            }
        }
        if (emptyState && isLoading) {
            hideElement(emptyState);
        }
        if (loadingHint) {
            loadingHint.classList.toggle("hidden", !(isLoading && !initialLoad));
        }
    }

    function renderCompanies(companies) {
        const loadingElement = document.getElementById("studentCompaniesLoading");
        const list = document.getElementById("companiesGrid");
        const emptyState = document.getElementById("studentCompaniesEmpty");

        hideElement(loadingElement);
        if (!list || !emptyState) {
            return;
        }

        let markup = "";
        updateCompanyCount(totalElements);
        updatePaginationControls();

        if (!companies.length) {
            list.classList.add("hidden");
            emptyState.classList.remove("hidden");
            emptyState.innerHTML = [
                '<i data-lucide="building-2"></i>',
                hasActiveSearch() ? '<h3>No matching companies found.</h3>' : '<h3>No companies available yet.</h3>',
                hasActiveSearch()
                    ? '<p>Try a different company name or keyword.</p>'
                    : '<p>Try again later or check another page.</p>'
            ].join("");
            initLucideIcons();
            return;
        }

        list.classList.remove("hidden");
        emptyState.classList.add("hidden");

        companies.forEach(function (company) {
            const companyName = safeText(company.companyName, "N/A");
            const companyType = safeText(company.companyType, "N/A");
            const industry = safeText(company.industry, "N/A");
            const description = safeText(company.description, "N/A");
            const headquarters = safeText(company.headquarters, "N/A");
            const foundedYear = safeText(company.foundedYear, "N/A");

            markup += [
                '<article class="company-card card">',
                '<div class="company-header">',
                getLogoMarkup(company),
                '<div class="company-titles">',
                "<h3>", escapeHtml(companyName), "</h3>",
                '<div class="card-badges">',
                '<span class="badge badge-orange">', escapeHtml(companyType), "</span>",
                '<span class="badge badge-teal">', escapeHtml(industry), "</span>",
                "</div>",
                "</div>",
                "</div>",
                '<div class="company-description"><p>', escapeHtml(description), "</p></div>",
                '<div class="company-meta">',
                '<span class="meta-item">HQ: ', escapeHtml(headquarters), "</span>",
                '<span class="meta-item">Founded: ', escapeHtml(foundedYear), "</span>",
                "</div>",
                company.websiteUrl
                    ? '<a href="' + escapeHtml(company.websiteUrl) + '" target="_blank" rel="noopener noreferrer" class="btn-visit ripple-container">Visit Website</a>'
                    : '<span class="btn-visit" aria-disabled="true">Visit Website</span>',
                '</article>'
            ].join("");
        });
        list.innerHTML = markup;

        initCompanyLogos();
        initCardObserver();
        initLucideIcons();
    }

    function filterCompanies() {
        const typeFilter = document.getElementById("typeFilter");
        const industryFilter = document.getElementById("industryFilter");
        const typeValue = typeFilter ? typeFilter.value : "";
        const industryValue = industryFilter ? industryFilter.value : "";

        const filteredCompanies = currentPageCompanies.filter(function (company) {
            const matchesType = !typeValue || safeText(company.companyType, "N/A") === typeValue;
            const matchesIndustry = !industryValue || safeText(company.industry, "N/A") === industryValue;

            return matchesType && matchesIndustry;
        });

        renderCompanies(filteredCompanies);
    }

    function showError(message) {
        const loadingElement = document.getElementById("studentCompaniesLoading");
        const emptyState = document.getElementById("studentCompaniesEmpty");
        const list = document.getElementById("companiesGrid");
        const loadingHint = document.getElementById("companiesInlineLoading");

        hideElement(loadingElement);
        hideElement(loadingHint);
        if (list) {
            list.classList.add("hidden");
        }
        if (emptyState) {
            emptyState.innerHTML = [
                '<i data-lucide="building-2"></i>',
                '<h3>Unable to load companies.</h3>',
                '<p>', escapeHtml(message || "Please try again."), '</p>'
            ].join("");
            emptyState.classList.remove("hidden");
        }

        updateCompanyCount(0);
        initLucideIcons();
    }

    function setupFilters() {
        const searchInput = document.getElementById("searchInput");
        const typeFilter = document.getElementById("typeFilter");
        const industryFilter = document.getElementById("industryFilter");

        if (searchInput) {
            searchInput.addEventListener("input", function () {
                const nextSearch = searchInput.value.trim();
                if (searchDebounceTimer) {
                    clearTimeout(searchDebounceTimer);
                }
                searchDebounceTimer = setTimeout(function () {
                    currentSearch = nextSearch;
                    loadCompanies(0, { initialLoad: false, force: true });
                }, SEARCH_DEBOUNCE_MS);
            });
        }
        if (typeFilter) typeFilter.addEventListener("change", filterCompanies);
        if (industryFilter) industryFilter.addEventListener("change", filterCompanies);
    }

    function bindRippleEffects() {
        const list = document.getElementById("companiesGrid");
        if (!list || list.dataset.rippleBound === "true") {
            return;
        }

        list.addEventListener("click", function (event) {
            const rippleTarget = event.target.closest(".ripple-container");
            if (rippleTarget) {
                addRipple(event, rippleTarget);
            }
        });
        list.dataset.rippleBound = "true";
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
        setTimeout(function () {
            ripple.remove();
        }, 600);
    }

    function initScrollProgress() {
        const scrollProgress = document.getElementById("scrollProgress");
        if (!scrollProgress) return;

        window.addEventListener("scroll", function () {
            const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
            const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
            scrollProgress.style.width = scrolled + "%";
        }, { passive: true });
    }

    let observer = null;

    function initCardObserver() {
        const cards = document.querySelectorAll(".company-card");

        if (!("IntersectionObserver" in window)) {
            cards.forEach(function (card) {
                card.classList.add("visible");
            });
            return;
        }

        if (!observer) {
            observer = new IntersectionObserver(function (entries) {
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
            observer.unobserve(card);
            observer.observe(card);
        });
    }

    function setupBackButton() {
        const backButton = document.getElementById("companiesBackBtn");
        if (!backButton) return;

        const params = new URLSearchParams(window.location.search);
        if (params.get("from") === "dashboard-companies-card") {
            backButton.href = "/student-dashboard#companies-card";
        }
    }

    function initLucideIcons() {
        if (window.lucide && typeof window.lucide.createIcons === "function") {
            window.lucide.createIcons();
        }
    }

    function buildCacheKey(page) {
        return [Number(page) || 0, PAGE_SIZE, currentSearch].join("|");
    }

    function storePageInCache(page, payload) {
        companiesPageCache.set(buildCacheKey(page), payload);
    }

    function getCachedPage(page) {
        return companiesPageCache.get(buildCacheKey(page)) || null;
    }

    async function prefetchCompaniesPage(page) {
        const safePage = Number(page) || 0;
        if (safePage < 0 || safePage >= totalPages || getCachedPage(safePage)) {
            return;
        }

        const controller = new AbortController();
        try {
            const payload = await fetchCompanies(safePage, controller.signal);
            storePageInCache(safePage, payload);
        } catch (error) {
            console.error("Failed to prefetch companies page:", safePage, error);
        }
    }

    function applyPagePayload(payload) {
        currentPage = Number(payload.page) || 0;
        totalPages = Number(payload.totalPages) || 0;
        totalElements = Number(payload.totalElements) || 0;
        currentPageCompanies = Array.isArray(payload.content) ? payload.content : [];

        populateFilters(currentPageCompanies);
        filterCompanies();
        void prefetchCompaniesPage(currentPage + 1);
    }

    async function loadCompanies(page, options) {
        options = options || {};
        const safePage = Math.max(0, Number(page) || 0);
        const initialLoad = Boolean(options.initialLoad);
        const requestId = ++loadRequestToken;

        if (isCompaniesLoading && !options.force) {
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

        if (activeCompaniesRequest) {
            activeCompaniesRequest.abort();
        }

        activeCompaniesRequest = new AbortController();
        isCompaniesLoading = true;
        updatePaginationControls();
        setListLoading(true, initialLoad);
        try {
            const payload = await fetchCompanies(safePage, activeCompaniesRequest.signal);
            if (!isPageActive || requestId !== loadRequestToken) {
                return;
            }
            storePageInCache(safePage, payload);
            applyPagePayload(payload);

            if (!currentPageCompanies.length && currentPage > 0 && totalPages > 0) {
                await loadCompanies(totalPages - 1, { force: true });
                return;
            }
        } catch (error) {
            if (!isPageActive || requestId !== loadRequestToken) {
                return;
            }
            if (error && error.name === "AbortError") {
                return;
            }
            console.error("Failed to load paginated companies:", error);
            totalPages = 0;
            totalElements = 0;
            currentPageCompanies = [];
            updatePaginationControls();
            showError("Unable to load companies. Please try again.");
        } finally {
            if (requestId === loadRequestToken) {
                isCompaniesLoading = false;
                activeCompaniesRequest = null;
                updatePaginationControls();
                setListLoading(false, initialLoad);
            }
        }
    }

    function setupPagination() {
        const prevButton = document.getElementById("companiesPrevButton");
        const nextButton = document.getElementById("companiesNextButton");

        if (prevButton) {
            prevButton.addEventListener("click", function () {
                if (currentPage > 0) {
                    loadCompanies(currentPage - 1, { initialLoad: false });
                }
            });
        }

        if (nextButton) {
            nextButton.addEventListener("click", function () {
                if (currentPage < totalPages - 1) {
                    loadCompanies(currentPage + 1, { initialLoad: false });
                }
            });
        }
    }

    document.addEventListener("DOMContentLoaded", async function () {
        initLucideIcons();
        initScrollProgress();
        setupBackButton();
        bindRippleEffects();
        setupFilters();
        setupPagination();
        updatePaginationControls();
        ensureSkeletonGrid();
        setListLoading(true, true);

        await loadCompanies(0, { initialLoad: true });
    });
})();
