(function () {
    const RESOURCES_API = "/api/student/preparation-resources";
    const PDF_TYPES = [
        { key: "hasAptitudePdf", type: "aptitude", label: "Aptitude Material", modalId: "mc-aptitude" },
        { key: "hasCodingPdf", type: "coding", label: "Coding Material", modalId: "mc-coding" },
        { key: "hasTechnicalPdf", type: "technical", label: "Technical Topics", modalId: "mc-tech" },
        { key: "hasHrPdf", type: "hr", label: "HR Preparation", modalId: "mc-hr" }
    ];
    let allResources = [];
    let filteredResources = [];

    async function fetchResources() {
        const response = await fetch(RESOURCES_API);
        const payload = await response.json().catch(function () {
            return [];
        });

        if (!response.ok) {
            throw new Error(payload && payload.message ? payload.message : "Unable to load preparation resources.");
        }

        return Array.isArray(payload) ? payload : [];
    }

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function getSafeText(value, fallback) {
        return String(value == null || value === "" ? fallback : value);
    }

    function getTextLogo(companyName) {
        return getSafeText(companyName, "N/A").trim().charAt(0).toUpperCase() || "N";
    }

    function getLogoMarkup(resource) {
        const companyName = getSafeText(resource.companyName, "N/A");

        if (resource.companyLogoUrl) {
            return [
                '<div class="company-logo">',
                '<img src="' + escapeHtml(resource.companyLogoUrl) + '" alt="' + escapeHtml(companyName) + ' logo" loading="lazy" onerror="this.closest(\'.company-logo\').classList.add(\'text-logo\');this.replaceWith(document.createTextNode(\'' + escapeHtml(getTextLogo(companyName)) + '\'));">',
                "</div>"
            ].join("");
        }

        return [
            '<div class="company-logo text-logo">',
            "<span>" + escapeHtml(getTextLogo(companyName)) + "</span>",
            "</div>"
        ].join("");
    }

    function getDriveLabel(resource) {
        return [
            getSafeText(resource.companyName, "N/A"),
            " - ",
            getSafeText(resource.driveTitle, "N/A"),
            " (",
            getSafeText(resource.hiringYear, "N/A"),
            ")"
        ].join("");
    }

    function populateFilters(resources) {
        populateSelect("driveFilter", resources.map(getDriveLabel));
        populateSelect("yearFilter", resources.map(function (resource) {
            return String(getSafeText(resource.hiringYear, ""));
        }).filter(Boolean));
    }

    function populateSelect(id, values) {
        const select = document.getElementById(id);
        if (!select) {
            return;
        }

        const firstOption = select.options[0].outerHTML;
        const uniqueValues = Array.from(new Set(values.filter(Boolean))).sort();

        select.innerHTML = firstOption;
        uniqueValues.forEach(function (value) {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = value;
            select.appendChild(option);
        });
    }

    function buildPdfActionUrl(resourceId, type, action) {
        return "/api/student/preparation-resources/" + encodeURIComponent(resourceId) + "/pdf/" + encodeURIComponent(type) + "/" + action;
    }

    function generateButtons(resource, pdfType) {
        if (!resource[pdfType.key]) {
            return [
                '<button class="btn-action btn-disabled" type="button" disabled>',
                '<i data-lucide="x-square"></i> No PDF',
                "</button>"
            ].join("");
        }

        return [
            '<button class="btn-action btn-view" type="button" data-pdf-action="view" data-resource-id="' + escapeHtml(resource.id) + '" data-pdf-type="' + escapeHtml(pdfType.type) + '">',
            '<i data-lucide="eye"></i> View PDF',
            "</button>",
            '<button class="btn-action btn-download" type="button" data-pdf-action="download" data-resource-id="' + escapeHtml(resource.id) + '" data-pdf-type="' + escapeHtml(pdfType.type) + '">',
            '<i data-lucide="download"></i> Download PDF',
            "</button>"
        ].join("");
    }

    function handlePdfAction(button) {
        const resourceId = button.dataset.resourceId;
        const pdfType = button.dataset.pdfType;
        if (!resourceId || !pdfType) {
            return;
        }

        const pdfActionUrl = buildPdfActionUrl(resourceId, pdfType, button.dataset.pdfAction);

        if (button.dataset.pdfAction === "view") {
            window.open(pdfActionUrl, "_blank", "noopener");
            return;
        }

        window.location.href = pdfActionUrl;
    }

    function updateResultsCount(count) {
        const countElement = document.getElementById("packCount");
        if (countElement) {
            countElement.textContent = String(count);
        }
    }

    function renderResources(resources) {
        const loadingElement = document.getElementById("studentResourceLoading");
        const list = document.getElementById("roadmapGrid");
        const emptyState = document.getElementById("studentResourceEmpty");

        if (loadingElement) {
            loadingElement.classList.add("hidden");
        }

        if (!list || !emptyState) {
            return;
        }

        list.innerHTML = "";
        updateResultsCount(resources.length);

        if (!resources.length) {
            emptyState.classList.remove("hidden");
            return;
        }

        emptyState.classList.add("hidden");

        resources.forEach(function (resource) {
            const card = document.createElement("article");
            card.className = "card pack-card ripple-container open-modal-btn";
            card.tabIndex = 0;
            card.dataset.resourceId = getSafeText(resource.id, "");

            card.innerHTML = [
                '<div class="card-action-btn"><i data-lucide="eye"></i></div>',
                '<div class="card-header">',
                '<div class="company-info">',
                getLogoMarkup(resource),
                '<div class="company-titles">',
                "<h3>" + escapeHtml(getSafeText(resource.companyName, "N/A")) + "</h3>",
                "<p>" + escapeHtml(getSafeText(resource.driveTitle, "N/A")) + " | " + escapeHtml(getSafeText(resource.hiringYear, "N/A")) + "</p>",
                "</div>",
                "</div>",
                "</div>",
                '<div class="card-badges"><span class="badge badge-dark">PREPARATION PACK</span></div>',
                '<div class="pack-summary"><p>' + escapeHtml(getSafeText(resource.description, "N/A")) + "</p></div>"
            ].join("");

            card.addEventListener("mousedown", function (event) {
                addRipple(event, card);
            });

            card.addEventListener("click", function () {
                openModal(resource);
            });

            card.addEventListener("keydown", function (event) {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openModal(resource);
                }
            });

            list.appendChild(card);
        });

        initScrollAnimation();
        initLucideIcons();
    }

    function filterResources() {
        const searchValue = document.getElementById("searchInput").value.trim().toLowerCase();
        const driveValue = document.getElementById("driveFilter").value;
        const yearValue = document.getElementById("yearFilter").value;

        filteredResources = allResources.filter(function (resource) {
            const companyName = getSafeText(resource.companyName, "").toLowerCase();
            const driveTitle = getSafeText(resource.driveTitle, "").toLowerCase();
            const resourceTitle = getSafeText(resource.resourceTitle, "").toLowerCase();
            const driveLabel = getDriveLabel(resource);

            const matchesSearch = !searchValue
                || companyName.includes(searchValue)
                || driveTitle.includes(searchValue)
                || resourceTitle.includes(searchValue);
            const matchesDrive = !driveValue || driveLabel === driveValue;
            const matchesYear = !yearValue || String(getSafeText(resource.hiringYear, "")) === yearValue;

            return matchesSearch && matchesDrive && matchesYear;
        });

        renderResources(filteredResources);
    }

    function setupFilters() {
        ["searchInput", "driveFilter", "yearFilter"].forEach(function (id) {
            const element = document.getElementById(id);
            if (!element) {
                return;
            }

            element.addEventListener("input", filterResources);
            element.addEventListener("change", filterResources);
        });
    }

    function showError(message) {
        const loadingElement = document.getElementById("studentResourceLoading");
        const emptyState = document.getElementById("studentResourceEmpty");

        if (loadingElement) {
            loadingElement.classList.add("hidden");
        }

        if (emptyState) {
            emptyState.textContent = message;
            emptyState.classList.remove("hidden");
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
        if (!progress) {
            return;
        }

        window.addEventListener("scroll", function () {
            const scrolled = document.documentElement.scrollTop;
            const max = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            progress.style.width = max > 0 ? Math.round((scrolled / max) * 100) + "%" : "100%";
        }, { passive: true });
    }

    function initScrollAnimation() {
        const cards = document.querySelectorAll(".pack-card");

        if (!("IntersectionObserver" in window)) {
            cards.forEach(function (card) {
                card.classList.add("visible");
            });
            return;
        }

        const observer = new IntersectionObserver(function (entries) {
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

        cards.forEach(function (card) {
            observer.observe(card);
        });
    }

    function openModal(resource) {
        const modal = document.getElementById("packModal");
        if (!modal) {
            return;
        }

        document.getElementById("modalCompany").textContent = getSafeText(resource.companyName, "N/A");
        document.getElementById("modalDrive").textContent = getSafeText(resource.driveTitle, "N/A") + " | " + getSafeText(resource.hiringYear, "N/A");

        const modalLogo = document.getElementById("modalLogo");
        modalLogo.className = "company-logo";
        if (resource.companyLogoUrl) {
            modalLogo.innerHTML = '<img src="' + escapeHtml(resource.companyLogoUrl) + '" alt="' + escapeHtml(getSafeText(resource.companyName, "N/A")) + ' logo">';
            const modalImage = modalLogo.querySelector("img");
            if (modalImage) {
                modalImage.onerror = function () {
                    modalLogo.classList.add("text-logo");
                    modalLogo.textContent = getTextLogo(resource.companyName);
                };
            }
        } else {
            modalLogo.classList.add("text-logo");
            modalLogo.textContent = getTextLogo(resource.companyName);
        }

        PDF_TYPES.forEach(function (pdfType) {
            const actions = document.querySelector("#" + pdfType.modalId + " .mc-actions");
            if (actions) {
                actions.innerHTML = generateButtons(resource, pdfType);
            }
        });

        initLucideIcons();
        modal.classList.add("active");
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
    }

    function closeModal() {
        const modal = document.getElementById("packModal");
        if (!modal) {
            return;
        }

        modal.classList.remove("active");
        modal.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
    }

    function bindModalAndActions() {
        const modal = document.getElementById("packModal");
        const closeButton = document.getElementById("closeModal");

        if (closeButton) {
            closeButton.addEventListener("click", closeModal);
        }

        if (modal) {
            modal.addEventListener("click", function (event) {
                if (event.target === modal) {
                    closeModal();
                    return;
                }

                const button = event.target.closest("[data-pdf-action]");
                if (button) {
                    handlePdfAction(button);
                }
            });
        }

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                closeModal();
            }
        });
    }

    function initBackButton() {
        const backButton = document.getElementById("resourcesBackBtn");
        if (!backButton) {
            return;
        }

        const params = new URLSearchParams(window.location.search);
        if (params.get("from") === "dashboard-preparation-resources-card") {
            backButton.setAttribute("href", "/student-dashboard#preparation-resources-card");
        }
    }

    function initLucideIcons() {
        if (window.lucide && typeof window.lucide.createIcons === "function") {
            window.lucide.createIcons();
        }
    }

    document.addEventListener("DOMContentLoaded", async function () {
        const authState = window.PlacementPortalAuth
            ? window.PlacementPortalAuth.getAuthState()
            : null;

        if (!authState || String(authState.role || "").toLowerCase() !== "student") {
            window.location.replace("/student-login.html");
            return;
        }

        initBackButton();
        initScrollProgress();
        bindModalAndActions();

        try {
            allResources = await fetchResources();
            filteredResources = allResources.slice();
            populateFilters(allResources);
            setupFilters();
            renderResources(allResources);
        } catch (error) {
            showError(error.message || "Unable to load preparation resources right now.");
        }
    });
})();
