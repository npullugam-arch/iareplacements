(function () {
    "use strict";

    /* ============================================================
       CONFIGURATION
    ============================================================ */

    const CREDENTIALS = {
        admin: {
            username: "admin",
            password: "admin123",
            redirectUrl: "/admin-dashboard",
            loginUrl: "/admin"
        },

        student: {
            redirectUrl: "/student-dashboard.html",
            loginUrl: "/student-login.html",
            apiLoginUrl: "/api/student/auth/login"
        }
    };

    const STORAGE_KEY = "placementPortalAuth";
    const STORAGE_FALLBACKS = [sessionStorage, localStorage];

    /* ============================================================
       STORAGE
    ============================================================ */

    function saveAuthState(authState) {

        const payload = JSON.stringify({
            loginTime: new Date().toISOString(),
            ...authState
        });

        STORAGE_FALLBACKS.forEach(storage => {

            try {
                storage.setItem(STORAGE_KEY, payload);
            } catch (e) {}

        });

    }

    function getAuthState() {

        for (const storage of STORAGE_FALLBACKS) {

            try {

                const data = storage.getItem(STORAGE_KEY);

                if (data) {
                    return JSON.parse(data);
                }

            } catch (e) {}

        }

        return null;

    }

    function clearAuthState() {

        STORAGE_FALLBACKS.forEach(storage => {

            try {
                storage.removeItem(STORAGE_KEY);
            } catch (e) {}

        });

    }

    /* ============================================================
       FETCH
    ============================================================ */

    async function postJson(url, payload) {

        const response = await fetch(url, {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            credentials: "same-origin",

            body: JSON.stringify(payload)

        });

        const text = await response.text();

        let data = null;

        try {
            data = JSON.parse(text);
        } catch (e) {}

        if (!response.ok) {

            throw new Error(
                data?.message ||
                text ||
                "Login failed."
            );

        }

        return data;

    }

    /* ============================================================
       ERROR
    ============================================================ */

    function setError(el, msg) {

        if (el) {
            el.textContent = msg || "";
        }

    }

    /* ============================================================
       DOM
    ============================================================ */

    const form = document.getElementById("studentLoginForm");

    // auth.js is shared by the login page and dashboard pages. Export the
    // session API before the login-only setup can return on dashboard pages.
    if (!form) {
        window.PlacementPortalAuth = {
            getAuthState,
            clearAuthState
        };

        // Dashboard pages do not contain the login form, so bind their logout
        // controls before returning from the login-only setup.
        document.addEventListener("DOMContentLoaded", () => {
            document.querySelectorAll(".logout-trigger").forEach(button => {
                button.addEventListener("click", () => {
                    logout(button.dataset.logoutRole || "student");
                });
            });
        });
        return;
    }

    const usernameIn = document.getElementById("studentUsername");
    const passwordIn = document.getElementById("studentPassword");
    const errorBox = document.getElementById("studentError");
    const loginBtn = document.getElementById("loginBtn");

    /* ============================================================
       PC ELEMENTS
    ============================================================ */

    const screen = document.getElementById("pc-screen");
    const cpuLed = document.getElementById("cpu-led");
    const hddLight = document.getElementById("hdd-light");
    const keyboard = document.getElementById("keyboard");
    const physicalMouse = document.getElementById("mouse");

    /* ============================================================
       VIRTUAL OS
    ============================================================ */

    const osUi = document.getElementById("os-ui");
    const welcomeUi = document.getElementById("welcome-ui");
    const welcomeText = document.getElementById("welcome-text");
    const welcomePhoto = document.getElementById("welcome-photo");
    const welcomeDefaultAvatar = document.getElementById("welcome-default-avatar");
    const errorModal = document.getElementById("error-modal");

    const vUsername = document.getElementById("v-username");
    const vPassword = document.getElementById("v-password");

    const cUser = document.getElementById("c-user");
    const cPass = document.getElementById("c-pass");

    const vUserWrap = document.getElementById("v-user-wrap");
    const vPassWrap = document.getElementById("v-pass-wrap");

    const vBtn = document.getElementById("v-login-btn");
    const vCursor = document.getElementById("v-cursor");

    const osTime = document.getElementById("os-time");
    let redirectTimer = null;

    /* ============================================================
       CLOCK
    ============================================================ */

    function updateClock() {

        const now = new Date();

        osTime.innerText =
            now.getHours().toString().padStart(2, "0") +
            ":" +
            now.getMinutes().toString().padStart(2, "0");

    }

    if (osTime) {
        updateClock();
        setInterval(updateClock, 1000);
    }

    /* ============================================================
       KEYBOARD
    ============================================================ */

    const keysContainer = keyboard ? keyboard.querySelector(".keys") : null;

    if (keysContainer && keysContainer.children.length === 0) {

        for (let i = 0; i < 30; i++) {

            const key = document.createElement("div");

            key.className = "key";

            keysContainer.appendChild(key);

        }

    }

    const keyEls = keysContainer ? keysContainer.querySelectorAll(".key") : [];

    function pressRandomKey() {

        if (!keyEls.length) return;

        const key =
            keyEls[Math.floor(Math.random() * keyEls.length)];

        key.classList.add("pressed");

        setTimeout(() => {

            key.classList.remove("pressed");

        }, 90);

        if (hddLight) {
            hddLight.style.opacity = "1";
            hddLight.style.boxShadow = "0 0 5px white";
        }

        setTimeout(() => {

            if (hddLight) {
                hddLight.style.opacity = ".2";
                hddLight.style.boxShadow = "none";
            }

        }, 70);

    }

    /* ============================================================
       CURSOR
    ============================================================ */

    function moveVirtualCursor(target) {

        if (!target) return;

        if (!screen || !vCursor) return;

        if (physicalMouse) physicalMouse.className = "mouse moving-left";

        setTimeout(() => {

            if (physicalMouse) physicalMouse.className = "mouse";

        }, 300);

        const screenRect = screen.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();

        const top =
            ((targetRect.top -
                screenRect.top +
                targetRect.height / 2) /
                screenRect.height) *
            100;

        const left =
            ((targetRect.left -
                screenRect.left +
                targetRect.width / 2) /
                screenRect.width) *
            100;

        vCursor.style.top = top + "%";
        vCursor.style.left = left + "%";

        setTimeout(() => {

            vCursor.classList.add("clicking");
            if (physicalMouse) physicalMouse.classList.add("pressed");

            setTimeout(() => {

                vCursor.classList.remove("clicking");
                if (physicalMouse) physicalMouse.classList.remove("pressed");

            }, 150);

        }, 400);

    }

    /* ============================================================
       INPUT EVENTS
    ============================================================ */

    usernameIn.addEventListener("focus", () => {

        screen.className = "screen active";

        cpuLed.style.background = "#fff";
        cpuLed.style.boxShadow = "0 0 15px white";

        moveVirtualCursor(vUserWrap);

        setTimeout(() => {

            vUserWrap.classList.add("focused");
            vPassWrap.classList.remove("focused");

            cUser.style.display = "inline";
            cPass.style.display = "none";

        }, 500);

    });

    usernameIn.addEventListener("input", e => {

        pressRandomKey();

        vUsername.innerText = e.target.value;

    });

    passwordIn.addEventListener("focus", () => {

        screen.className = "screen active";

        moveVirtualCursor(vPassWrap);

        setTimeout(() => {

            vPassWrap.classList.add("focused");
            vUserWrap.classList.remove("focused");

            cPass.style.display = "inline";
            cUser.style.display = "none";

        }, 500);

    });

    passwordIn.addEventListener("input", e => {

        pressRandomKey();

        vPassword.innerText =
            "•".repeat(e.target.value.length);

    });

    // ===== PART 2 CONTINUES FROM HERE =====

        /* ============================================================
       LOGIN SUBMIT
    ============================================================ */

    form.addEventListener("submit", async (e) => {

        e.preventDefault();

        if (redirectTimer) {
            clearTimeout(redirectTimer);
            redirectTimer = null;
        }

        moveVirtualCursor(vBtn);

        vUserWrap.classList.remove("focused");
        vPassWrap.classList.remove("focused");

        cUser.style.display = "none";
        cPass.style.display = "none";

        setTimeout(() => {

            vBtn.classList.add("focused");

        }, 500);

        const rollNo = usernameIn.value.trim();

        // DON'T trim password
        const password = passwordIn.value.trim();

        if (!rollNo || !password) {

            errorBox.textContent =
                "Samvidha ID and Password are required.";

            screen.classList.add("crash");

            errorModal.innerHTML =
                "⚠ Samvidha ID and Password Required";

            errorModal.style.display = "block";

            cpuLed.style.background = "#aa0000";
            cpuLed.style.boxShadow = "0 0 15px #aa0000";

            setTimeout(() => {

                screen.classList.remove("crash");

                errorModal.style.display = "none";

                cpuLed.style.background = "#fff";
                cpuLed.style.boxShadow = "0 0 15px #fff";

                vBtn.classList.remove("focused");

            }, 2200);

            return;

        }

        loginBtn.disabled = true;
        loginBtn.innerText = "Authenticating...";

        try {

            const result = await postJson(
                CREDENTIALS.student.apiLoginUrl,
                {
                    rollNo,
                    password
                }
            );

            if (!result || !result.success) {

                throw new Error(
                    result.message ||
                    "Invalid Samvidha ID or Password."
                );

            }

            /* ======================================
               SAVE SESSION
            ====================================== */

            const session = {

                role: "student",

                username: result.rollNo || rollNo,

                studentId: result.studentId || null,

                rollNo: result.rollNo || rollNo,

                studentName: result.studentName || result.name || result.rollNo || rollNo || "Student",

                branch: result.branch || "",

                semester: result.semester || "",

                section: result.section || "",

                photoUrl: result.photoUrl || result.photo_url || result.profilePhoto || result.profile_photo || result.studentPhoto || ""

            };
            saveAuthState(session);

            /* ======================================
               SUCCESS ANIMATION
            ====================================== */

            if (welcomeText) welcomeText.textContent = "Welcome back, " + session.studentName;
            if (welcomePhoto) {
                welcomePhoto.hidden = true;
                welcomePhoto.removeAttribute("src");
            }
            if (welcomeDefaultAvatar) welcomeDefaultAvatar.hidden = false;

            if (osUi) osUi.style.display = "none";

            if (vCursor) vCursor.style.display = "none";

            if (welcomeUi) welcomeUi.style.display = "flex";

            if (cpuLed) {
                cpuLed.style.background = "#ffffff";
                cpuLed.style.boxShadow = "0 0 15px white";
            }

            loginBtn.innerHTML = "Approved ✓";

            redirectTimer = setTimeout(() => {

                const dashboardUrl = "/student-dashboard.html";
                window.location.assign(dashboardUrl);

            }, 1800);

        }

        catch (err) {

            clearAuthState();

            errorBox.textContent =
                err.message ||
                "Login Failed";

            screen.classList.add("crash");

            errorModal.innerHTML =
                "⚠ ACCESS DENIED";

            errorModal.style.display = "block";

            cpuLed.style.background = "#aa0000";
            cpuLed.style.boxShadow =
                "0 0 15px #aa0000";

            passwordIn.value = "";

            vPassword.innerHTML = "";

            loginBtn.disabled = false;

            loginBtn.innerHTML = "Authenticate";

            setTimeout(() => {

                screen.classList.remove("crash");

                errorModal.style.display = "none";

                cpuLed.style.background = "#fff";
                cpuLed.style.boxShadow =
                    "0 0 15px white";

                vBtn.classList.remove("focused");

            }, 2500);

        }

    });

    /* ============================================================
       DASHBOARD PROTECTION
    ============================================================ */

    function protectDashboard() {

        const role =
            document.body.dataset.portalRole;

        if (!role) return;

        const session = getAuthState();

        if (
            !session ||
            session.role !== role
        ) {

            window.location.replace(
                CREDENTIALS[role].loginUrl
            );

        }

    }

    /* ============================================================
       LOGOUT
    ============================================================ */

    function logout(role) {

        clearAuthState();

        window.location.assign(
            CREDENTIALS[role].loginUrl
        );

    }

    /* ============================================================
       DASHBOARD DATA
    ============================================================ */

    function hydrateSessionDetails() {

        const session = getAuthState();

        if (!session) return;

        document
            .querySelectorAll(
                "[data-session-student-name]"
            )
            .forEach(el => {

                el.textContent =
                    session.studentName ||
                    session.rollNo ||
                    "Student";

            });

        document
            .querySelectorAll(
                "[data-session-roll-no]"
            )
            .forEach(el => {

                el.textContent =
                    session.rollNo || "-";

            });

    }

    /* ============================================================
       GLOBAL
    ============================================================ */

    window.PlacementPortalAuth = {

        getAuthState,

        clearAuthState

    };

    document.addEventListener(
        "DOMContentLoaded",
        () => {

            protectDashboard();

            hydrateSessionDetails();

            document
                .querySelectorAll(".logout-trigger")
                .forEach(btn => {

                    btn.addEventListener(
                        "click",
                        () => {

                            logout(
                                btn.dataset.logoutRole
                            );

                        }
                    );

                });

        }
    );

})();
