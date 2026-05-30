(function () {
    const COMPANIES_API = "/api/student/companies";
    let allCompanies = [];

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

    async function fetchCompanies() {
        const response = await fetch(COMPANIES_API);
        const payload = await response.json().catch(function () {
            return [];
        });

        if (!response.ok) {
            throw new Error(payload && payload.message ? payload.message : "Unable to load companies.");
        }

        return Array.isArray(payload) ? payload : [];
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
            return '<div class="company-logo"><img src="' + escapeHtml(company.logoUrl) + '" alt="' + escapeHtml(companyName) + ' logo"></div>';
        }

        return '<div class="company-logo text-logo"><span>' + escapeHtml(companyName.charAt(0).toUpperCase()) + "</span></div>";
    }

    function buildSearchText(company) {
        return [
            safeText(company.companyName, ""),
            safeText(company.companyType, ""),
            safeText(company.industry, ""),
            safeText(company.headquarters, "")
        ].join(" ").toLowerCase();
    }

    function updateCompanyCount(count) {
        const companyCount = document.getElementById("companyCount");
        if (companyCount) {
            companyCount.textContent = String(count);
        }
    }

    function renderCompanies(companies) {
        const loadingElement = document.getElementById("studentCompaniesLoading");
        const list = document.getElementById("companiesGrid");
        const emptyState = document.getElementById("studentCompaniesEmpty");

        if (loadingElement) {
            loadingElement.classList.add("hidden");
        }
        if (!list || !emptyState) {
            return;
        }

        list.innerHTML = "";
        updateCompanyCount(companies.length);

        if (!companies.length) {
            list.classList.add("hidden");
            emptyState.classList.remove("hidden");
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

            const card = document.createElement("article");
            card.className = "company-card card";
            card.innerHTML = [
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
                    : '<span class="btn-visit" aria-disabled="true">Visit Website</span>'
            ].join("");

            const rippleTarget = card.querySelector(".ripple-container");
            if (rippleTarget) {
                rippleTarget.addEventListener("click", function (event) {
                    addRipple(event, rippleTarget);
                });
            }

            list.appendChild(card);
        });

        initCardObserver();
        initLucideIcons();
    }

    function filterCompanies() {
        const searchTerm = document.getElementById("searchInput").value.trim().toLowerCase();
        const typeValue = document.getElementById("typeFilter").value;
        const industryValue = document.getElementById("industryFilter").value;

        const filteredCompanies = allCompanies.filter(function (company) {
            const matchesSearch = !searchTerm || buildSearchText(company).includes(searchTerm);
            const matchesType = !typeValue || safeText(company.companyType, "N/A") === typeValue;
            const matchesIndustry = !industryValue || safeText(company.industry, "N/A") === industryValue;

            return matchesSearch && matchesType && matchesIndustry;
        });

        renderCompanies(filteredCompanies);
    }

    function showError(message) {
        const loadingElement = document.getElementById("studentCompaniesLoading");
        const emptyState = document.getElementById("studentCompaniesEmpty");

        if (loadingElement) {
            loadingElement.classList.add("hidden");
        }
        if (emptyState) {
            emptyState.innerHTML = [
                '<i data-lucide="building-2"></i>',
                '<h3>No companies found</h3>',
                '<p>', escapeHtml(message || "Unable to load companies right now."), '</p>'
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

        if (searchInput) searchInput.addEventListener("input", filterCompanies);
        if (typeFilter) typeFilter.addEventListener("change", filterCompanies);
        if (industryFilter) industryFilter.addEventListener("change", filterCompanies);
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

    document.addEventListener("DOMContentLoaded", async function () {
        initLucideIcons();
        initScrollProgress();
        setupBackButton();

        try {
            allCompanies = await fetchCompanies();
            populateFilters(allCompanies);
            setupFilters();
            renderCompanies(allCompanies);
        } catch (error) {
            showError(error.message || "Unable to load companies right now.");
        }
    });
})();
