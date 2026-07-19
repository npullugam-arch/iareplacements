(function () {
    const ACTIVE_NOTICES_API = "/api/student/notices/active";
    const PAGE_SIZE = 20;
    let allNotices = [];
    let currentPage = 0;
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

    async function fetchActiveNotices() {
        const result = await window.apiClient.cachedGet('active_notices_v1', ACTIVE_NOTICES_API, 120000);
        return Array.isArray(result.data) ? result.data : [];
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

    function getNoticeStatus(notice) {
        const explicitStatus = String(notice.status || notice.noticeStatus || "").trim();
        if (explicitStatus) {
            return explicitStatus;
        }

        const now = new Date();
        const validFrom = notice.validFrom ? new Date(notice.validFrom) : null;
        const validTo = notice.validTo ? new Date(notice.validTo) : null;

        if (validFrom && !Number.isNaN(validFrom.getTime()) && validFrom > now) {
            return "Upcoming";
        }

        if (validTo && !Number.isNaN(validTo.getTime()) && validTo < now) {
            return "Expired";
        }

        return "Active";
    }

    function getCategoryLabel(notice) {
        return (
            notice.category ||
            notice.noticeCategory ||
            notice.type ||
            ""
        );
    }

    function updateNoticeCount(count) {
        const countElement = document.getElementById("noticeCount");
        if (countElement) {
            countElement.textContent = String(count);
        }
    }

    function getTotalPages() {
        return allNotices.length ? Math.ceil(allNotices.length / PAGE_SIZE) : 0;
    }

    function updatePaginationControls() {
        const totalPages = getTotalPages();
        const prevButton = document.getElementById("noticesPrevButton");
        const nextButton = document.getElementById("noticesNextButton");
        const pageInfo = document.getElementById("noticesPageInfo");

        if (prevButton) {
            prevButton.disabled = currentPage <= 0;
        }
        if (nextButton) {
            nextButton.disabled = totalPages === 0 || currentPage >= totalPages - 1;
        }
        if (pageInfo) {
            pageInfo.textContent = "Page " + (totalPages === 0 ? 0 : currentPage + 1) + " of " + totalPages;
        }
    }

    function renderStudentNoticesPage(notices) {
        const loadingElement = document.getElementById("studentNoticesLoading");
        const container = document.getElementById("studentNoticesList");
        const emptyState = document.getElementById("studentNoticesEmpty");

        if (!container || !emptyState) {
            return;
        }

        if (loadingElement) {
            loadingElement.classList.add("hidden");
        }

        container.innerHTML = "";
        updateNoticeCount(allNotices.length);
        updatePaginationControls();

        if (!notices.length) {
            emptyState.classList.remove("hidden");
            return;
        }

        emptyState.classList.add("hidden");

        notices.forEach(function (notice) {
            const card = document.createElement("article");
            const status = getNoticeStatus(notice);
            const category = getCategoryLabel(notice);
            const title = notice.title || notice.subject || "Untitled Notice";
            const message = notice.message || notice.description || notice.content || "N/A";

            card.className = "card notice-card ripple-container";
            card.innerHTML = [
                '<div class="card-status">',
                '<span class="badge badge-dark">' + escapeHtml(status.toUpperCase()) + "</span>",
                category ? '<span class="badge badge-muted">' + escapeHtml(category) + "</span>" : "",
                "</div>",
                '<h3 class="notice-title">' + escapeHtml(title) + "</h3>",
                '<div class="notice-desc"><p>' + escapeHtml(message).replace(/\n/g, "</p><p>") + "</p></div>",
                '<div class="notice-footer">',
                '<div class="date-badge"><i data-lucide="calendar"></i><span>Valid From: ' + escapeHtml(formatDate(notice.validFrom)) + "</span></div>",
                '<div class="date-badge"><i data-lucide="calendar"></i><span>Valid To: ' + escapeHtml(formatDate(notice.validTo)) + "</span></div>",
                "</div>"
            ].join("");

            container.appendChild(card);
        });
    }

    function renderCurrentNoticePage() {
        const startIndex = currentPage * PAGE_SIZE;
        renderStudentNoticesPage(allNotices.slice(startIndex, startIndex + PAGE_SIZE));
    }

    function renderDashboardPreview(notices) {
        const container = document.getElementById("studentDashboardNoticePreview");
        const emptyState = document.getElementById("studentDashboardNoticeEmpty");

        if (!container || !emptyState) {
            return;
        }

        container.innerHTML = "";
        const previewNotices = notices.slice(0, 3);

        if (!previewNotices.length) {
            emptyState.classList.remove("hidden");
            return;
        }

        emptyState.classList.add("hidden");

        previewNotices.forEach(function (notice) {
            const card = document.createElement("article");
            card.className = "notice-preview-card";
            card.innerHTML = [
                '<span class="status-badge status-active">Active</span>',
                "<h3>" + escapeHtml(notice.title || "Untitled Notice") + "</h3>",
                "<p>" + escapeHtml((notice.message || "N/A")).replace(/\n/g, "<br>") + "</p>",
                '<div class="notice-meta">',
                "<span>Until " + formatDate(notice.validTo) + "</span>",
                "</div>"
            ].join("");
            container.appendChild(card);
        });
    }

    function showStudentError(message) {
        const loadingElement = document.getElementById("studentNoticesLoading");
        const emptyState = document.getElementById("studentNoticesEmpty");
        const previewEmptyState = document.getElementById("studentDashboardNoticeEmpty");

        if (loadingElement) {
            loadingElement.classList.add("hidden");
        }
        if (emptyState) {
            emptyState.textContent = message;
            emptyState.classList.remove("hidden");
        }

        if (previewEmptyState) {
            previewEmptyState.textContent = message;
            previewEmptyState.classList.remove("hidden");
        }

        allNotices = [];
        updateNoticeCount(0);
        updatePaginationControls();
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
            const scrollTop = document.documentElement.scrollTop;
            const height =
                document.documentElement.scrollHeight -
                document.documentElement.clientHeight;

            progress.style.width = height > 0
                ? Math.round((scrollTop / height) * 100) + "%"
                : "100%";
        }, { passive: true });
    }

    function initNoticeCards() {
        const cards = document.querySelectorAll(".notice-card");

        cards.forEach(function (card) {
            card.addEventListener("mousedown", function (event) {
                addRipple(event, card);
            });
        });

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

    function initBackButton() {
        const backButton = document.getElementById("noticesBackBtn");
        if (!backButton) {
            return;
        }

        const params = new URLSearchParams(window.location.search);
        if (params.get("from") === "dashboard-notices-card") {
            backButton.setAttribute("href", "/student-dashboard#notices-card");
        }
    }

    function setupPagination() {
        const prevButton = document.getElementById("noticesPrevButton");
        const nextButton = document.getElementById("noticesNextButton");

        if (prevButton) {
            prevButton.addEventListener("click", function () {
                if (currentPage > 0) {
                    currentPage -= 1;
                    renderCurrentNoticePage();
                    initNoticeCards();
                    initLucideIcons();
                }
            });
        }

        if (nextButton) {
            nextButton.addEventListener("click", function () {
                if (currentPage < getTotalPages() - 1) {
                    currentPage += 1;
                    renderCurrentNoticePage();
                    initNoticeCards();
                    initLucideIcons();
                }
            });
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
        setupPagination();
        updatePaginationControls();

        const requestId = ++loadRequestToken;

        try {
            allNotices = await fetchActiveNotices();
            if (!isPageActive || requestId !== loadRequestToken) {
                return;
            }
            currentPage = 0;
            renderCurrentNoticePage();
            renderDashboardPreview(allNotices);
            initLucideIcons();
            initNoticeCards();
        } catch (error) {
            if (!isPageActive || requestId !== loadRequestToken) {
                return;
            }
            showStudentError('Unable to load notices. Please refresh.');
        }
    });
})();
