(function () {
    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function safeValue(value) {
        return value == null || value === "" ? "N/A" : String(value);
    }

    function initials(name) {
        return String(name || "Student")
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(function (part) { return part.charAt(0).toUpperCase(); })
            .join("") || "ST";
    }

    async function fetchJson(url) {
        const response = await fetch(url);
        const rawText = await response.text();
        let payload = null;

        if (rawText) {
            try {
                payload = JSON.parse(rawText);
            } catch (error) {
                payload = null;
            }
        }

        if (!response.ok) {
            throw new Error(payload && payload.message ? payload.message : (rawText || "Request failed."));
        }

        return payload;
    }

    function buildField(iconPath, label, value) {
        return [
            '<div class="detail-card">',
            '<div class="detail-label">',
            iconPath,
            '<span>' + escapeHtml(label) + "</span>",
            "</div>",
            '<p class="detail-value">' + escapeHtml(safeValue(value)) + "</p>",
            "</div>"
        ].join("");
    }

    function renderGrid(elementId, fields) {
        const element = document.getElementById(elementId);
        if (!element) {
            return;
        }

        element.innerHTML = fields.map(function (field) {
            return buildField(field.icon, field.label, field.value);
        }).join("");
    }

    function icon(path) {
        return '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">' + path + "</svg>";
    }

    function renderProfile(student) {
        const studentName = safeValue(student.studentName || student.name);
        const rollNo = safeValue(student.rollNo || student.rollNumber);
        const branch = safeValue(student.branch);
        const semester = safeValue(student.semester || student.sem);
        const section = safeValue(student.section || student.sec);
        const email = safeValue(student.studentEmailId || student.email);
        const phone = safeValue(student.studentPhone || student.phone);

        document.getElementById("studentName").textContent = studentName;
        document.getElementById("semesterTag").textContent = semester === "N/A" ? "Semester N/A" : "Semester " + semester;
        document.getElementById("branchTag").textContent = branch;
        document.getElementById("sectionTag").textContent = section === "N/A" ? "Section N/A" : "Section " + section;

        const profilePhoto = document.getElementById("studentProfilePhoto");
        const profileFallback = document.getElementById("studentProfilePhotoFallback");
        profileFallback.textContent = initials(studentName);

        if (student.photoUrl) {
            profilePhoto.src = student.photoUrl;
            profilePhoto.classList.remove("hidden");
            profilePhoto.addEventListener("error", function () {
                profilePhoto.classList.add("hidden");
                profileFallback.classList.remove("hidden");
            }, { once: true });
            profileFallback.classList.add("hidden");
        } else {
            profilePhoto.classList.add("hidden");
            profileFallback.classList.remove("hidden");
        }

        renderGrid("studentAcademicGrid", [
            { label: "Name", value: studentName, icon: icon('<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>') },
            { label: "Email", value: email, icon: icon('<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>') },
            { label: "Roll Number", value: rollNo, icon: icon('<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"></path>') },
            { label: "Father Name", value: student.fatherName, icon: icon('<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>') },
            { label: "Gender", value: student.gender, icon: icon('<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>') },
            { label: "Branch", value: branch, icon: icon('<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222"></path>') },
            { label: "Semester", value: semester, icon: icon('<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>') },
            { label: "Section", value: section, icon: icon('<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>') }
        ]);

        renderGrid("studentFamilyGrid", [
            { label: "Student Phone", value: phone, icon: icon('<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path>') },
            { label: "Parent Phone", value: student.parentPhone, icon: icon('<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>') },
            { label: "Date of Birth", value: student.dob, icon: icon('<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2h12z"></path>') },
            { label: "Mother Name", value: student.motherName, icon: icon('<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"></path>') },
            { label: "Father Occupation", value: student.fatherOccupation, icon: icon('<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2a4 4 0 014-4h6"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h6v6"></path>') },
            { label: "Income", value: student.income, icon: icon('<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"></path>') },
            { label: "Student Email", value: email, icon: icon('<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>') }
        ]);

        renderGrid("studentAddressGrid", [
            { label: "Current Address", value: student.currentAddress, icon: icon('<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0L6.343 16.657a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>') },
            { label: "Permanent Address", value: student.permanentAddress, icon: icon('<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0L6.343 16.657a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>') },
            { label: "Current State", value: student.currentState, icon: icon('<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7h18M3 12h18M3 17h18"></path>') },
            { label: "Permanent State", value: student.permanentState, icon: icon('<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7h18M3 12h18M3 17h18"></path>') },
            { label: "Current Pincode", value: student.currentPincode, icon: icon('<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>') },
            { label: "Permanent Pincode", value: student.permanentPincode, icon: icon('<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>') },
            { label: "Religion", value: student.religion, icon: icon('<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 2v20M5 12h14"></path>') },
            { label: "Caste", value: student.caste, icon: icon('<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-3.314 0-6 1.79-6 4s2.686 4 6 4 6-1.79 6-4-2.686-4-6-4z"></path>') }
        ]);
    }

    document.addEventListener("DOMContentLoaded", async function () {
        const loading = document.getElementById("studentProfileLoading");
        const errorBox = document.getElementById("studentProfileError");
        const content = document.getElementById("studentProfileContent");
        const authState = window.PlacementPortalAuth ? window.PlacementPortalAuth.getAuthState() : null;

        if (!authState || String(authState.role || "").toLowerCase() !== "student") {
            window.location.replace("/student");
            return;
        }

        try {
            const profileUrl = authState.studentId && Number(authState.studentId) > 0
                ? "/api/student/profile/" + encodeURIComponent(authState.studentId)
                : "/api/student/profile/roll/" + encodeURIComponent(authState.rollNo || authState.username || "");
            const student = await fetchJson(profileUrl);
            renderProfile(student);
            loading.classList.add("hidden");
            content.classList.remove("hidden");
        } catch (error) {
            loading.classList.add("hidden");
            errorBox.textContent = error.message || "Unable to load your profile right now.";
            errorBox.classList.remove("hidden");
        }
    });
})();
