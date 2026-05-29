(function () {
    const STUDENTS_API = "/api/admin/students";
    const UPLOAD_API = "/api/admin/students/upload-excel";
    let allStudents = [];

    async function fetchJson(url, options) {
        const response = await fetch(url, options);

        if (response.status === 204) {
            return null;
        }

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

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function initials(name) {
        return String(name || "Student")
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(function (part) { return part.charAt(0).toUpperCase(); })
            .join("");
    }

    function renderPhoto(photoUrl, name, extraClass) {
        if (photoUrl) {
            return [
                '<img class="' + extraClass + '" src="' + escapeHtml(photoUrl) + '" alt="' + escapeHtml(name) + ' photo">',
                '<span class="' + extraClass + '-fallback hidden">' + escapeHtml(initials(name)) + "</span>"
            ].join("");
        }
        return '<span class="' + extraClass + '-fallback">' + escapeHtml(initials(name)) + "</span>";
    }

    function populateFilters(students) {
        populateSelect("studentBranchFilter", students.map(function (student) { return student.branch; }));
        populateSelect("studentSemesterFilter", students.map(function (student) { return student.semester ? String(student.semester) : ""; }));
        populateSelect("studentSectionFilter", students.map(function (student) { return student.section; }));
        populateSelect("studentGenderFilter", students.map(function (student) { return student.gender; }));
        populateSelect("studentStatusFilter", students.map(function (student) { return student.status; }));
    }

    function populateSelect(id, values) {
        const select = document.getElementById(id);
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

    function studentMatchesFilters(student) {
        const searchValue = document.getElementById("studentSearchInput").value.trim().toLowerCase();
        const branchValue = document.getElementById("studentBranchFilter").value;
        const semesterValue = document.getElementById("studentSemesterFilter").value;
        const sectionValue = document.getElementById("studentSectionFilter").value;
        const genderValue = document.getElementById("studentGenderFilter").value;
        const statusValue = document.getElementById("studentStatusFilter").value;

        const matchesSearch = !searchValue
            || String(student.studentName || "").toLowerCase().includes(searchValue)
            || String(student.rollNo || "").toLowerCase().includes(searchValue)
            || String(student.studentEmailId || "").toLowerCase().includes(searchValue);

        return matchesSearch
            && (!branchValue || student.branch === branchValue)
            && (!semesterValue || String(student.semester || "") === semesterValue)
            && (!sectionValue || student.section === sectionValue)
            && (!genderValue || student.gender === genderValue)
            && (!statusValue || student.status === statusValue);
    }

    function renderStudents(students) {
        const list = document.getElementById("studentList");
        const emptyState = document.getElementById("studentListEmpty");
        const loading = document.getElementById("studentListLoading");

        loading.classList.add("hidden");
        list.innerHTML = "";

        if (!students.length) {
            emptyState.classList.remove("hidden");
            return;
        }

        emptyState.classList.add("hidden");

        students.forEach(function (student) {
            const card = document.createElement("article");
            card.className = "student-card";
            card.innerHTML = [
                '<div class="student-card-top">',
                '<div class="student-avatar-shell">' + renderPhoto(student.photoUrl, student.studentName, "student-avatar") + "</div>",
                "<div>",
                "<h3>" + escapeHtml(student.studentName) + "</h3>",
                '<p class="student-meta">' + escapeHtml(student.rollNo) + " | " + escapeHtml(student.branch || "-") + " | Sem " + escapeHtml(student.semester || "-") + "</p>",
                '<span class="status-chip ' + (student.active ? "status-active" : "status-disabled") + '">' + (student.active ? "Active" : "Disabled") + "</span>",
                "</div>",
                "</div>",
                '<p class="student-contact">' + escapeHtml(student.section || "-") + " | " + escapeHtml(student.gender || "-") + "</p>",
                '<p class="student-contact">' + escapeHtml(student.studentEmailId || "No email") + "</p>",
                '<p class="student-contact">' + escapeHtml(student.studentPhone || "No phone") + "</p>",
                '<div class="student-actions">',
                '<button class="mini-btn" type="button" data-student-action="details" data-student-id="' + student.id + '">View Details</button>',
                '<button class="mini-btn" type="button" data-student-action="status" data-active="' + student.active + '" data-student-id="' + student.id + '">' + (student.active ? "Disable" : "Enable") + "</button>",
                '<button class="mini-btn delete-btn" type="button" data-student-action="delete" data-student-id="' + student.id + '">Delete</button>',
                "</div>"
            ].join("");
            list.appendChild(card);
        });

        bindPhotoFallbacks();
    }

    function bindPhotoFallbacks() {
        document.querySelectorAll(".student-avatar, .details-avatar").forEach(function (image) {
            image.addEventListener("error", function () {
                image.classList.add("hidden");
                const fallback = image.parentElement.querySelector("." + image.className + "-fallback");
                if (fallback) {
                    fallback.classList.remove("hidden");
                }
            }, { once: true });
        });
    }

    async function loadStudents() {
        const loading = document.getElementById("studentListLoading");
        const emptyState = document.getElementById("studentListEmpty");

        loading.classList.remove("hidden");
        emptyState.classList.add("hidden");
        allStudents = await fetchJson(STUDENTS_API, { method: "GET" });
        populateFilters(allStudents);
        applyFilters();
    }

    function applyFilters() {
        renderStudents(allStudents.filter(studentMatchesFilters));
    }

    function setUploadSummary(summary) {
        document.getElementById("summaryTotalRows").textContent = summary.totalRows || 0;
        document.getElementById("summaryInserted").textContent = summary.insertedCount || 0;
        document.getElementById("summaryUpdated").textContent = summary.updatedCount || 0;
        document.getElementById("summarySkipped").textContent = summary.skippedCount || 0;

        const errorList = document.getElementById("studentUploadErrors");
        errorList.innerHTML = "";
        const errors = summary.errors || [];
        errors.slice(0, 20).forEach(function (error) {
            const item = document.createElement("li");
            item.textContent = error;
            errorList.appendChild(item);
        });

        if (errors.length > 20) {
            const item = document.createElement("li");
            item.textContent = "View more errors in backend logs. Showing first 20 of " + errors.length + ".";
            errorList.appendChild(item);
        }

        document.getElementById("studentUploadSummary").classList.remove("hidden");
    }

    function buildUploadErrorMessage(payload) {
        if (!payload) {
            return "Unable to upload student Excel.";
        }

        if (payload.message && payload.error) {
            return payload.message + ": " + payload.error;
        }

        return payload.message || payload.error || "Unable to upload student Excel.";
    }

    function setupUpload() {
        const form = document.getElementById("studentUploadForm");
        const fileInput = document.getElementById("studentExcelFile");
        const fileName = document.getElementById("studentUploadFileName");
        const errorElement = document.getElementById("studentUploadError");
        const submitButton = document.getElementById("studentUploadButton");

        fileInput.addEventListener("change", function () {
            fileName.textContent = fileInput.files && fileInput.files[0] ? fileInput.files[0].name : "No file selected";
        });

        form.addEventListener("submit", async function (event) {
            event.preventDefault();

            if (!fileInput.files || !fileInput.files[0]) {
                errorElement.textContent = "Please select an Excel file first.";
                return;
            }

            try {
                errorElement.textContent = "";
                submitButton.disabled = true;
                submitButton.textContent = "Uploading...";

                const formData = new FormData();
                formData.append("file", fileInput.files[0]);

                const response = await fetch(UPLOAD_API, {
                    method: "POST",
                    body: formData
                });

                const payload = await response.json().catch(function () { return null; });
                if (!response.ok) {
                    throw new Error(buildUploadErrorMessage(payload));
                }

                setUploadSummary(payload);
                form.reset();
                fileName.textContent = "No file selected";
                await loadStudents();
            } catch (error) {
                errorElement.textContent = error.message || "Unable to upload student Excel.";
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = "Upload Students";
            }
        });
    }

    function buildDetailField(label, value) {
        return [
            '<div class="detail-field">',
            '<span class="field-label">' + escapeHtml(label) + "</span>",
            '<span class="field-value">' + escapeHtml(value || "-") + "</span>",
            "</div>"
        ].join("");
    }

    function openStudentDetails(student) {
        const content = document.getElementById("studentDetailsContent");
        const fields = [
            ["Roll No", student.rollNo],
            ["Branch", student.branch],
            ["Semester", student.semester],
            ["Section", student.section],
            ["Gender", student.gender],
            ["Status", student.status],
            ["DOB", student.dob],
            ["DOJ", student.doj],
            ["Student Email", student.studentEmailId],
            ["Student Phone", student.studentPhone],
            ["Parent Phone", student.parentPhone],
            ["Mother Phone", student.motherPhone],
            ["Father Name", student.fatherName],
            ["Mother Name", student.motherName],
            ["Religion", student.religion],
            ["Caste", student.caste],
            ["Sub Caste", student.subCaste],
            ["Admission Category", student.admissionCategory],
            ["Fee Category", student.feeCategory],
            ["CET Rank", student.cetRank],
            ["SSC Marks", student.sscMarks],
            ["SSC %", student.sscPercentage],
            ["Inter Marks", student.interMarks],
            ["Inter %", student.interPercentage],
            ["UG Marks", student.ugMarks],
            ["UG %", student.ugPercentage],
            ["Aadhar", student.aadhar],
            ["Father Occupation", student.fatherOccupation],
            ["Occupation Type", student.occupationType],
            ["Income", student.income],
            ["Moles", student.moles],
            ["Place of Birth", student.placeOfBirth],
            ["Current Address", student.currentAddress],
            ["Permanent Address", student.permanentAddress],
            ["Current D.No", student.currentDno],
            ["Current Street", student.currentStreet],
            ["Current Village/Town", student.currentVillageTown],
            ["Current Mandal", student.currentMandal],
            ["Current District", student.currentDistrict],
            ["Current State", student.currentState],
            ["Current Pincode", student.currentPincode],
            ["Permanent D.No", student.permanentDno],
            ["Permanent Street", student.permanentStreet],
            ["Permanent Village/Town", student.permanentVillageTown],
            ["Permanent Mandal", student.permanentMandal],
            ["Permanent District", student.permanentDistrict],
            ["Permanent State", student.permanentState],
            ["Permanent Pincode", student.permanentPincode],
            ["Domicile State", student.domicileState],
            ["SSC State", student.sscState],
            ["Inter State", student.interState]
        ];

        content.innerHTML = [
            '<div class="details-header">',
            '<div class="details-avatar-shell">' + renderPhoto(student.photoUrl, student.studentName, "details-avatar") + "</div>",
            "<div>",
            '<h2 class="details-name">' + escapeHtml(student.studentName) + "</h2>",
            '<p class="student-meta">' + escapeHtml(student.rollNo) + " | " + escapeHtml(student.branch || "-") + "</p>",
            "</div>",
            "</div>",
            '<div class="details-grid">' + fields.map(function (field) {
                return buildDetailField(field[0], field[1]);
            }).join("") + "</div>"
        ].join("");

        document.getElementById("studentDetailsModal").classList.remove("hidden");
        bindPhotoFallbacks();
    }

    function closeStudentDetails() {
        document.getElementById("studentDetailsModal").classList.add("hidden");
    }

    function bindActions() {
        document.getElementById("studentList").addEventListener("click", async function (event) {
            const button = event.target.closest("[data-student-action]");
            if (!button) {
                return;
            }

            const studentId = button.dataset.studentId;
            const student = allStudents.find(function (item) { return String(item.id) === String(studentId); });
            if (!student) {
                return;
            }

            if (button.dataset.studentAction === "details") {
                openStudentDetails(student);
                return;
            }

            if (button.dataset.studentAction === "status") {
                try {
                    await fetchJson(STUDENTS_API + "/" + studentId + "/status?active=" + (button.dataset.active !== "true"), {
                        method: "PATCH"
                    });
                    await loadStudents();
                } catch (error) {
                    window.alert(error.message || "Unable to update student status.");
                }
                return;
            }

            if (!window.confirm("Delete this student record?")) {
                return;
            }

            try {
                await fetchJson(STUDENTS_API + "/" + studentId, { method: "DELETE" });
                await loadStudents();
            } catch (error) {
                window.alert(error.message || "Unable to delete student.");
            }
        });

        ["studentSearchInput", "studentBranchFilter", "studentSemesterFilter", "studentSectionFilter", "studentGenderFilter", "studentStatusFilter"]
            .forEach(function (id) {
                const element = document.getElementById(id);
                element.addEventListener("input", applyFilters);
                element.addEventListener("change", applyFilters);
            });

        document.getElementById("closeStudentDetailsButton").addEventListener("click", closeStudentDetails);
        document.querySelector("[data-close-student-modal='true']").addEventListener("click", closeStudentDetails);
    }

    document.addEventListener("DOMContentLoaded", async function () {
        setupUpload();
        bindActions();

        try {
            await loadStudents();
        } catch (error) {
            document.getElementById("studentListLoading").textContent = error.message || "Unable to load students right now.";
        }
    });
})();
