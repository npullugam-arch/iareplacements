(function () {
    const ACTIVE_NOTICES_API = "/api/student/notices/active";

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function getInitials(name) {
        return String(name || "Student")
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(part => part.charAt(0).toUpperCase())
            .join("") || "ST";
    }

    async function fetchJson(url) {
        const response = await fetch(url);
        const text = await response.text();

        let data = null;
        if (text) {
            try {
                data = JSON.parse(text);
            } catch (e) {
                data = null;
            }
        }

        if (!response.ok) {
            throw new Error(data?.message || text || "Request failed");
        }

        return data;
    }

    function formatDate(dateString) {
        if (!dateString) return "Date unavailable";

        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) return "Date unavailable";

        return date.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    }

    function getProfileUrl(authState) {
        if (authState.studentId && Number(authState.studentId) > 0) {
            return "/api/student/profile/" + encodeURIComponent(authState.studentId);
        }

        return "/api/student/profile/roll/" + encodeURIComponent(
            authState.rollNo || authState.username || ""
        );
    }

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    function applyStudentIdentity(student) {
        const name =
            student.studentName ||
            student.name ||
            student.fullName ||
            "Student";

        const rollNo =
            student.rollNo ||
            student.rollNumber ||
            student.username ||
            "Roll No unavailable";

        const branch = student.branch || "Branch unavailable";
        const semester = student.semester || student.sem || "";
        const section = student.section || student.sec || "";

        setText("studentDashboardName", name);
        setText("studentDashboardProfileName", name);
        setText("studentDashboardRollNo", rollNo);
        setText("studentDashboardInitials", getInitials(name));

        setText(
            "studentDashboardMeta",
            [
                branch,
                semester ? "Semester " + semester : "Semester unavailable",
                section ? "Section " + section : "Section unavailable"
            ].join(" | ")
        );

        const topAvatar = document.getElementById("studentDashboardTopAvatar");
        if (topAvatar) {
            topAvatar.textContent = getInitials(name);
        }

        const photo = document.getElementById("studentDashboardPhoto");
        const fallback = document.getElementById("studentDashboardInitials");

        const photoUrl =
            student.photoUrl ||
            student.photo ||
            student.imageUrl ||
            student.profilePhoto ||
            "";

        if (photo && fallback) {
            if (photoUrl) {
                photo.src = photoUrl;
                photo.classList.remove("hidden");
                fallback.classList.add("hidden");

                photo.onerror = function () {
                    photo.classList.add("hidden");
                    fallback.classList.remove("hidden");
                };
            } else {
                photo.classList.add("hidden");
                fallback.classList.remove("hidden");
            }
        }
    }

    function renderNoticePreview(notices) {
        const container = document.getElementById("studentDashboardNoticePreview");
        const empty = document.getElementById("studentDashboardNoticeEmpty");

        if (!container) return;

        container.innerHTML = "";

        const latest = Array.isArray(notices) ? notices.slice(0, 1) : [];

        if (!latest.length) {
            if (empty) {
                empty.textContent = "No active notices right now. Please check again later.";
                empty.classList.remove("hidden");
            }
            return;
        }

        if (empty) empty.classList.add("hidden");

        latest.forEach(function (notice) {
            const card = document.createElement("div");
            card.className = "notice-card ripple-container";

            card.innerHTML = `
                <div class="notice-left-block">
                    <div class="notice-badge">
                        <span class="pulse-dot" aria-hidden="true"></span>
                        Active
                    </div>
                    <div class="notice-body">
                        <div class="notice-title">${escapeHtml(notice.title || "Untitled Notice")}</div>
                        <div class="notice-meta">
                            Valid until ${formatDate(notice.validTo)}
                        </div>
                    </div>
                </div>
                <a href="/student-notices" class="notice-cta">View Notice</a>
            `;

            card.addEventListener("click", function (event) {
                addRipple(event, card);
            });

            container.appendChild(card);
        });
    }

    async function hydrateStudentHeader(authState) {
        const fallbackStudent = {
            studentName: authState.studentName || authState.name || authState.username || "Student",
            rollNo: authState.rollNo || authState.username,
            branch: authState.branch,
            semester: authState.semester,
            section: authState.section,
            photoUrl: authState.photoUrl
        };

        applyStudentIdentity(fallbackStudent);

        try {
            const profile = await fetchJson(getProfileUrl(authState));

            applyStudentIdentity({
                studentName: profile.studentName || profile.name || fallbackStudent.studentName,
                rollNo: profile.rollNo || fallbackStudent.rollNo,
                branch: profile.branch || fallbackStudent.branch,
                semester: profile.semester || profile.sem || fallbackStudent.semester,
                section: profile.section || profile.sec || fallbackStudent.section,
                photoUrl: profile.photoUrl || profile.photo || fallbackStudent.photoUrl
            });
        } catch (error) {
            console.warn("Student profile loading failed:", error.message);
            applyStudentIdentity(fallbackStudent);
        }
    }

    async function hydrateNoticePreview() {
        const empty = document.getElementById("studentDashboardNoticeEmpty");

        try {
            const notices = await fetchJson(ACTIVE_NOTICES_API);
            renderNoticePreview(notices);
        } catch (error) {
            if (empty) {
                empty.textContent = error.message || "Unable to load notices right now.";
                empty.classList.remove("hidden");
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

    function initRippleCards() {
        document.querySelectorAll(".card, .notice-card").forEach(function (card) {
            card.addEventListener("click", function (event) {
                addRipple(event, card);
            });
        });
    }

    function initScrollProgress() {
        const progress = document.getElementById("scrollProgress");
        if (!progress) return;

        window.addEventListener("scroll", function () {
            const scrollTop = document.documentElement.scrollTop;
            const height =
                document.documentElement.scrollHeight -
                document.documentElement.clientHeight;

            progress.style.width = height > 0
                ? Math.round((scrollTop / height) * 100) + "%"
                : "0%";
        }, { passive: true });
    }

    function initKeyboardCards() {
        document.querySelectorAll(".card[tabindex]").forEach(function (card) {
            card.addEventListener("keydown", function (event) {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    card.click();
                }
            });
        });
    }

    function initLucideIcons() {
        if (window.lucide && typeof window.lucide.createIcons === "function") {
            window.lucide.createIcons();
        }
    }

    function highlightDashboardCard(cardId) {
        const targetCard = document.getElementById(cardId);
        if (!targetCard) {
            return;
        }

        window.setTimeout(function () {
            targetCard.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
            targetCard.classList.add("card-return-highlight");

            window.setTimeout(function () {
                targetCard.classList.remove("card-return-highlight");
            }, 1800);
        }, 250);
    }

    function handleDashboardHashFocus() {
        if (window.location.hash === "#placement-statistics-card") {
            highlightDashboardCard("placement-statistics-card");
            return;
        }

        if (window.location.hash === "#placement-drives-card") {
            highlightDashboardCard("placement-drives-card");
            return;
        }

        if (window.location.hash === "#selected-students-card") {
            highlightDashboardCard("selected-students-card");
            return;
        }

        if (window.location.hash === "#interview-experience-card") {
            highlightDashboardCard("interview-experience-card");
        }
    }

    document.addEventListener("DOMContentLoaded", function () {
        const authState = window.PlacementPortalAuth
            ? window.PlacementPortalAuth.getAuthState()
            : null;

        if (!authState || String(authState.role).toLowerCase() !== "student") {
            window.location.replace("/student-login.html");
            return;
        }

        hydrateStudentHeader(authState);
        hydrateNoticePreview();

        initRippleCards();
        initScrollProgress();
        initKeyboardCards();
        initLucideIcons();
        handleDashboardHashFocus();
    });
})();
