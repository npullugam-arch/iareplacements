(function () {
    const SELECTED_STUDENTS_API = "/api/student/selected-students";
    let allStudents = [];
    let visibleStudents = [];

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

    async function fetchSelectedStudents() {
        const response = await fetch(SELECTED_STUDENTS_API);
        const payload = await response.json().catch(function () {
            return [];
        });

        if (!response.ok) {
            throw new Error(payload && payload.message ? payload.message : "Unable to load selected student records.");
        }

        return Array.isArray(payload) ? payload : [];
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
            return '<div class="company-logo"><img src="' + escapeHtml(student.companyLogoUrl) + '" alt="' + escapeHtml(safeText(student.companyName, "Company")) + '"></div>';
        }

        return [
            '<div class="company-logo">',
            '<i data-lucide="building-2" style="color: var(--black); width: 24px; height: 24px;"></i>',
            '</div>'
        ].join("");
    }

    function populateSelect(id, values, fallbackLabel) {
        const select = document.getElementById(id);
        if (!select) return;

        const uniqueValues = Array.from(new Set(values.filter(Boolean))).sort();
        select.innerHTML = '<option value="">' + fallbackLabel + "</option>";

        uniqueValues.forEach(function (value) {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = value;
            select.appendChild(option);
        });
    }

    function populateFilters(students) {
        populateSelect("branchFilter", students.map(function (student) {
            return safeText(student.branch, "");
        }), "All Branches");

        populateSelect("sectionFilter", students.map(function (student) {
            return safeText(student.section, "");
        }), "All Sections");

        populateSelect("companyFilter", students.map(function (student) {
            return safeText(student.companyName, "");
        }), "All Companies");
    }

    function buildStudentSearch(student) {
        return [
            safeText(student.studentName, ""),
            safeText(student.rollNumber, ""),
            safeText(student.companyName, ""),
            safeText(student.driveTitle, ""),
            safeText(student.branch, ""),
            safeText(student.section, ""),
            safeText(student.packageOffered, "")
        ].join(" ").toLowerCase();
    }

    function applyFilters() {
        const searchValue = document.getElementById("searchInput").value.trim().toLowerCase();
        const branchValue = document.getElementById("branchFilter").value;
        const sectionValue = document.getElementById("sectionFilter").value;
        const companyValue = document.getElementById("companyFilter").value;

        visibleStudents = allStudents.filter(function (student) {
            const matchesQuery = !searchValue || buildStudentSearch(student).includes(searchValue);
            const matchesBranch = !branchValue || safeText(student.branch, "N/A") === branchValue;
            const matchesSection = !sectionValue || safeText(student.section, "N/A") === sectionValue;
            const matchesCompany = !companyValue || safeText(student.companyName, "N/A") === companyValue;

            return matchesQuery && matchesBranch && matchesSection && matchesCompany;
        });

        renderStudents(visibleStudents);
    }

    function renderStudents(students) {
        const loadingElement = document.getElementById("studentSelectedStudentsLoading");
        const studentsGrid = document.getElementById("studentsGrid");
        const emptyState = document.getElementById("emptyState");

        if (loadingElement) {
            loadingElement.classList.add("hidden");
        }
        if (!studentsGrid || !emptyState) {
            return;
        }

        studentsGrid.innerHTML = "";

        if (!students.length) {
            studentsGrid.classList.add("hidden");
            emptyState.classList.remove("hidden");
            if (window.lucide && typeof window.lucide.createIcons === "function") {
                window.lucide.createIcons();
            }
            return;
        }

        studentsGrid.classList.remove("hidden");
        emptyState.classList.add("hidden");

        students.forEach(function (student) {
            const companyName = safeText(student.companyName, "N/A");
            const driveTitle = safeText(student.driveTitle, "N/A");
            const hiringYear = safeText(student.hiringYear, "N/A");
            const offerType = safeText(student.offerType, "N/A");
            const packageOffered = safeText(student.packageOffered, "N/A");
            const roleOffered = safeText(student.roleOffered, "N/A");
            const studentName = safeText(student.studentName, "Student");
            const rollNumber = safeText(student.rollNumber, "N/A");
            const branch = safeText(student.branch, "N/A");
            const section = safeText(student.section, "N/A");
            const gender = safeText(student.gender, "N/A");
            const selectionDate = formatDate(student.selectionDate);
            const photoUrl = getStudentPhotoUrl(student) || getAvatarFallbackUrl(student);

            const card = document.createElement("article");
            card.className = "card ripple-container student-card";
            card.tabIndex = 0;
            card.dataset.company = companyName;
            card.dataset.name = studentName;
            card.dataset.roll = rollNumber;
            card.dataset.branch = branch;
            card.dataset.section = section;
            card.dataset.package = packageOffered;
            card.dataset.date = selectionDate;
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
                '<span class="job-badge filled">', escapeHtml(roleOffered), "</span>",
                "</div>",

                '<div class="student-row">',
                '<div class="student-avatar">',
                '<img src="', escapeHtml(photoUrl), '" alt="', escapeHtml(studentName), '" onerror="this.src=\'', escapeHtml(getAvatarFallbackUrl(student)), '\'">',
                "</div>",
                '<div class="student-details">',
                '<h4 class="student-name">', escapeHtml(studentName), "</h4>",
                '<p class="student-meta-line">', escapeHtml(rollNumber), " &nbsp;&nbsp;|&nbsp;&nbsp; ", escapeHtml(branch), " &nbsp;&nbsp;|&nbsp;&nbsp; ", escapeHtml(section), "</p>",
                '<p class="student-meta-line">Gender: ', escapeHtml(gender), " &nbsp;&nbsp;&nbsp; Selection Date: ", escapeHtml(selectionDate), "</p>",
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

            studentsGrid.appendChild(card);
        });

        initCardObserver();

        if (window.lucide && typeof window.lucide.createIcons === "function") {
            window.lucide.createIcons();
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
        document.getElementById("modalSection").textContent = card.dataset.section || "N/A";
        document.getElementById("modalPackage").textContent = card.dataset.package || "N/A";
        document.getElementById("modalDate").textContent = card.dataset.date || "N/A";

        if (window.lucide && typeof window.lucide.createIcons === "function") {
            window.lucide.createIcons();
        }

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
        const emptyState = document.getElementById("emptyState");

        if (loadingElement) {
            loadingElement.classList.add("hidden");
        }
        if (emptyState) {
            emptyState.innerHTML = [
                '<i data-lucide="users-round"></i>',
                '<h3>No students found</h3>',
                '<p>', escapeHtml(message || "Unable to load selected student records right now."), '</p>'
            ].join("");
            emptyState.classList.remove("hidden");
        }

        if (window.lucide && typeof window.lucide.createIcons === "function") {
            window.lucide.createIcons();
        }
    }

    function setupFilters() {
        ["searchInput", "branchFilter", "sectionFilter", "companyFilter"].forEach(function (id) {
            const element = document.getElementById(id);
            if (!element) return;

            element.addEventListener("input", applyFilters);
            element.addEventListener("change", applyFilters);
        });
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

        try {
            allStudents = await fetchSelectedStudents();
            populateFilters(allStudents);
            setupFilters();
            applyFilters();
        } catch (error) {
            showError(error.message || "Unable to load selected student records right now.");
        }
    });
})();
