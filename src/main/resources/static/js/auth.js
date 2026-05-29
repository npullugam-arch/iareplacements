(function () {
    const CREDENTIALS = {
        admin: {
            username: "admin",
            password: "admin123",
            redirectUrl: "/admin-dashboard",
            loginUrl: "/admin"
        },
        student: {
            redirectUrl: "/student-dashboard",
            loginUrl: "/student",
            apiLoginUrl: "/api/student/auth/login"
        }
    };

    const STORAGE_KEY = "placementPortalAuth";

    function saveAuthState(authState) {
        sessionStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                loginTime: new Date().toISOString(),
                ...authState
            })
        );
    }

    function getAuthState() {
        const storedValue = sessionStorage.getItem(STORAGE_KEY);
        if (!storedValue) {
            return null;
        }

        try {
            return JSON.parse(storedValue);
        } catch (error) {
            sessionStorage.removeItem(STORAGE_KEY);
            return null;
        }
    }

    function clearAuthState() {
        sessionStorage.removeItem(STORAGE_KEY);
    }

    async function postJson(url, payload) {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const rawText = await response.text();
        let data = null;

        if (rawText) {
            try {
                data = JSON.parse(rawText);
            } catch (error) {
                data = null;
            }
        }

        if (!response.ok) {
            throw new Error(data && data.message ? data.message : (rawText || "Request failed."));
        }

        return data;
    }

    function setError(errorElement, message) {
        if (errorElement) {
            errorElement.textContent = message || "";
        }
    }

    function setVisualState(type, message) {
        const cardContainer = document.getElementById("cardContainer");
        const rollInput = document.getElementById("studentUsername");
        const passwordInput = document.getElementById("studentPassword");
        const loginBtn = document.getElementById("loginBtn");

        if (!cardContainer || !rollInput || !passwordInput || !loginBtn) {
            return;
        }

        cardContainer.classList.remove("shake", "success-card");
        rollInput.classList.remove("error-input", "success-input");
        passwordInput.classList.remove("error-input", "success-input");
        loginBtn.classList.remove("btn-loading", "btn-error", "btn-success");

        void cardContainer.offsetWidth;

        if (type === "loading") {
            loginBtn.textContent = message || "Authenticating...";
            loginBtn.classList.add("btn-loading");
            loginBtn.disabled = true;
            return;
        }

        if (type === "error") {
            cardContainer.classList.add("shake");
            rollInput.classList.add("error-input");
            passwordInput.classList.add("error-input");
            loginBtn.classList.add("btn-error");
            loginBtn.textContent = message || "Access Denied";
            loginBtn.disabled = false;
            return;
        }

        if (type === "success") {
            cardContainer.classList.add("success-card");
            rollInput.classList.add("success-input");
            passwordInput.classList.add("success-input");
            loginBtn.classList.add("btn-success");
            loginBtn.textContent = message || "Approved ✓";
            loginBtn.disabled = true;
            return;
        }

        loginBtn.textContent = "Authenticate";
        loginBtn.disabled = false;
    }

    function setupAdminLogin(formId, errorId) {
        const form = document.getElementById(formId);
        if (!form) {
            return;
        }

        const activeSession = getAuthState();
        if (activeSession && activeSession.role === "admin") {
            window.location.replace(CREDENTIALS.admin.redirectUrl);
            return;
        }

        const errorElement = document.getElementById(errorId);

        form.addEventListener("submit", function (event) {
            event.preventDefault();

            const username = form.elements.username.value.trim();
            const password = form.elements.password.value.trim();
            const validUser = CREDENTIALS.admin;

            if (username === validUser.username && password === validUser.password) {
                saveAuthState({
                    role: "admin",
                    username: username
                });
                setError(errorElement, "");
                window.location.assign(validUser.redirectUrl);
                return;
            }

            clearAuthState();
            setError(errorElement, "Invalid username or password. Please try again.");
        });
    }

    function setupStudentLogin(formId, errorId) {
        const form = document.getElementById(formId);
        if (!form) {
            return;
        }

        const activeSession = getAuthState();
        if (activeSession && activeSession.role === "student") {
            window.location.replace(CREDENTIALS.student.redirectUrl);
            return;
        }

        const errorElement = document.getElementById(errorId);

        form.addEventListener("submit", async function (event) {
            event.preventDefault();

            const rollNo = form.elements.username.value.trim();
            const password = form.elements.password.value.trim();

            if (!rollNo || !password) {
                setError(errorElement, "User ID and password are required.");
                setVisualState("error", "Required fields missing");
                setTimeout(function () {
                    setVisualState("normal");
                }, 1800);
                return;
            }

            try {
                setError(errorElement, "");
                setVisualState("loading", "Authenticating...");

                const result = await postJson(CREDENTIALS.student.apiLoginUrl, {
                    rollNo: rollNo,
                    password: password
                });

                if (!result || !result.success) {
                    clearAuthState();
                    setError(errorElement, result && result.message ? result.message : "Invalid roll number or password.");
                    setVisualState("error", "Access Denied");
                    setTimeout(function () {
                        setVisualState("normal");
                    }, 2000);
                    return;
                }

                saveAuthState({
                    role: "student",
                    username: result.rollNo,
                    studentId: result.studentId,
                    rollNo: result.rollNo,
                    studentName: result.studentName,
                    branch: result.branch,
                    semester: result.semester,
                    section: result.section,
                    photoUrl: result.photoUrl
                });

                setVisualState("success", "Approved ✓");
                setTimeout(function () {
                    window.location.assign(CREDENTIALS.student.redirectUrl);
                }, 700);
            } catch (error) {
                clearAuthState();
                setError(errorElement, error.message || "Unable to login right now.");
                setVisualState("error", "Access Denied");
                setTimeout(function () {
                    setVisualState("normal");
                }, 2000);
            }
        });
    }

    function protectDashboard() {
        const pageRole = document.body.dataset.portalRole;
        if (!pageRole) {
            return;
        }

        const activeSession = getAuthState();
        if (!activeSession || activeSession.role !== pageRole) {
            window.location.replace(CREDENTIALS[pageRole].loginUrl);
        }
    }

    function logout(role) {
        clearAuthState();
        window.location.assign(CREDENTIALS[role].loginUrl);
    }

    function hydrateSessionDetails() {
        const activeSession = getAuthState();
        if (!activeSession) {
            return;
        }

        document.querySelectorAll("[data-session-student-name]").forEach(function (element) {
            element.textContent = activeSession.studentName || activeSession.rollNo || "Student";
        });
        document.querySelectorAll("[data-session-roll-no]").forEach(function (element) {
            element.textContent = activeSession.rollNo || "-";
        });
    }

    window.PlacementPortalAuth = {
        getAuthState: getAuthState,
        clearAuthState: clearAuthState
    };

    document.addEventListener("DOMContentLoaded", function () {
        setupAdminLogin("adminLoginForm", "adminError");
        setupStudentLogin("studentLoginForm", "studentError");
        protectDashboard();
        hydrateSessionDetails();

        document.querySelectorAll(".logout-trigger").forEach(function (button) {
            button.addEventListener("click", function () {
                logout(button.dataset.logoutRole);
            });
        });
    });
})();
