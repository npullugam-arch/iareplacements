(function () {
    const EXPERIENCES_API = "/api/student/interview-experiences";
    let allExperiences = [];

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

    async function fetchExperiences() {
        const response = await fetch(EXPERIENCES_API);
        const payload = await response.json().catch(function () {
            return [];
        });

        if (!response.ok) {
            throw new Error(payload && payload.message ? payload.message : "Unable to load interview experiences.");
        }

        return Array.isArray(payload) ? payload : [];
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

    function getDifficultyBadgeClass(value) {
        const normalized = safeText(value, "N/A").toLowerCase();
        if (normalized === "easy") return "badge";
        if (normalized === "medium") return "badge";
        if (normalized === "hard") return "badge";
        return "badge";
    }

    function getResultBadgeClass(value) {
        return "badge";
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

    function getDriveLabel(experience) {
        return safeText(experience.companyName, "N/A") + " - " + safeText(experience.driveTitle, "N/A") + " (" + safeText(experience.hiringYear, "N/A") + ")";
    }

    function populateFilters(experiences) {
        populateSelect("driveFilter", experiences.map(getDriveLabel), "All Placement Drives");
        populateSelect("yearFilter", experiences.map(function (experience) {
            return safeText(experience.hiringYear, "");
        }), "All Hiring Years");
        populateSelect("resultFilter", experiences.map(function (experience) {
            return safeText(experience.finalResult, "");
        }), "All Final Results");
    }

    function getCompanyLogoMarkup(experience) {
        if (experience.companyLogoUrl) {
            return '<div class="company-logo"><img src="' + escapeHtml(experience.companyLogoUrl) + '" alt="' + escapeHtml(safeText(experience.companyName, "Company")) + '"></div>';
        }

        return '<div class="company-logo text-logo"><span>' + escapeHtml(safeText(experience.companyName, "C").charAt(0).toUpperCase()) + "</span></div>";
    }

    function getPhotoUrl(experience) {
        if (experience.studentPhotoUrl) {
            return experience.studentPhotoUrl;
        }

        return "https://ui-avatars.com/api/?name=" + encodeURIComponent(safeText(experience.studentName, "Student")) + "&background=0a0a0a&color=fff";
    }

    function buildSearchText(experience) {
        return [
            safeText(experience.studentName, ""),
            safeText(experience.companyName, ""),
            safeText(experience.driveTitle, ""),
            safeText(experience.roleOffered, ""),
            safeText(experience.technicalTopics, ""),
            safeText(experience.finalResult, ""),
            safeText(experience.difficultyLevel, "")
        ].join(" ").toLowerCase();
    }

    function updateExperienceCount(count) {
        const expCount = document.getElementById("expCount");
        if (expCount) {
            expCount.textContent = String(count);
        }
    }

    function renderExperiences(experiences) {
        const loadingElement = document.getElementById("studentExperienceLoading");
        const list = document.getElementById("expGrid");
        const emptyState = document.getElementById("studentExperienceEmpty");

        if (loadingElement) {
            loadingElement.classList.add("hidden");
        }
        if (!list || !emptyState) {
            return;
        }

        list.innerHTML = "";
        updateExperienceCount(experiences.length);

        if (!experiences.length) {
            list.classList.add("hidden");
            emptyState.classList.remove("hidden");
            initLucideIcons();
            return;
        }

        list.classList.remove("hidden");
        emptyState.classList.add("hidden");

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
                "<h3>", escapeHtml(companyName), "</h3>",
                "<p>", escapeHtml(driveTitle), " • ", escapeHtml(hiringYear), " • ", escapeHtml(hiringDate), "</p>",
                "</div>",
                "</div>",
                "</div>",
                '<div class="card-badges">',
                '<span class="badge ', getResultBadgeClass(roleOffered), '">', escapeHtml(roleOffered), "</span>",
                '<span class="badge ', getDifficultyBadgeClass(difficultyLevel), '">', escapeHtml(difficultyLevel), "</span>",
                '<span class="badge ', getResultBadgeClass(finalResult), '">', escapeHtml(finalResult), "</span>",
                "</div>",
                '<div class="student-profile">',
                '<div class="student-avatar"><img src="', escapeHtml(photoUrl), '" alt="', escapeHtml(studentName), '"></div>',
                '<div class="student-details"><h4>', escapeHtml(studentName), "</h4><p>", escapeHtml(roleOffered), "</p></div>",
                "</div>",
                '<div class="exp-summary">',
                "<p><strong>Drive:</strong> ", escapeHtml(getDriveLabel(experience)), "</p>",
                "<p><strong>Rounds Faced:</strong> ", escapeHtml(roundsFaced), "</p>",
                "<p><strong>Date:</strong> ", escapeHtml(experienceDate), "</p>",
                "</div>"
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

            list.appendChild(card);
        });

        initCardObserver();
        initLucideIcons();
    }

    function filterExperiences() {
        const searchValue = document.getElementById("searchInput").value.trim().toLowerCase();
        const driveValue = document.getElementById("driveFilter").value;
        const difficultyValue = document.getElementById("difficultyFilter").value;
        const resultValue = document.getElementById("resultFilter").value;
        const yearValue = document.getElementById("yearFilter").value;

        const filteredExperiences = allExperiences.filter(function (experience) {
            const matchesSearch = !searchValue || buildSearchText(experience).includes(searchValue);
            const matchesDrive = !driveValue || getDriveLabel(experience) === driveValue;
            const matchesDifficulty = !difficultyValue || safeText(experience.difficultyLevel, "N/A") === difficultyValue;
            const matchesResult = !resultValue || safeText(experience.finalResult, "N/A") === resultValue;
            const matchesYear = !yearValue || safeText(experience.hiringYear, "N/A") === yearValue;

            return matchesSearch && matchesDrive && matchesDifficulty && matchesResult && matchesYear;
        });

        renderExperiences(filteredExperiences);
    }

    function setupFilters() {
        ["searchInput", "driveFilter", "difficultyFilter", "resultFilter", "yearFilter"].forEach(function (id) {
            const element = document.getElementById(id);
            if (!element) return;

            element.addEventListener("input", filterExperiences);
            element.addEventListener("change", filterExperiences);
        });
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
        const emptyState = document.getElementById("studentExperienceEmpty");

        if (loadingElement) {
            loadingElement.classList.add("hidden");
        }
        if (emptyState) {
            emptyState.innerHTML = [
                '<i data-lucide="messages-square"></i>',
                '<h3>No experiences found</h3>',
                '<p>', escapeHtml(message || "Unable to load interview experiences right now."), '</p>'
            ].join("");
            emptyState.classList.remove("hidden");
        }

        updateExperienceCount(0);
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

    let cardObserver = null;

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

        try {
            allExperiences = await fetchExperiences();
            populateFilters(allExperiences);
            setupFilters();
            renderExperiences(allExperiences);
        } catch (error) {
            showError(error.message || "Unable to load interview experiences right now.");
        }
    });
})();
