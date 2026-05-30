(function () {
    let resumeContent = "";

    function addRipple(event, element) {
        const ripple = document.createElement("span");
        ripple.className = "ripple";
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        ripple.style.cssText = "width:" + size + "px;height:" + size + "px;left:" + (event.clientX - rect.left - size / 2) + "px;top:" + (event.clientY - rect.top - size / 2) + "px";
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
            progress.style.width = max > 0 ? Math.round((scrolled / max) * 100) + "%" : "0%";
        }, { passive: true });
    }

    function showError(message) {
        const errorState = document.getElementById("errorState");
        errorState.textContent = message;
        errorState.classList.add("visible");
    }

    function hideError() {
        document.getElementById("errorState").classList.remove("visible");
    }

    function checkReady() {
        const hasText = document.getElementById("resumeText").value.trim().length > 10;
        const hasFile = Boolean(resumeContent);
        document.getElementById("analyseBtn").disabled = !(hasText || hasFile);
    }

    function setStep(stepNumber) {
        [1, 2, 3].forEach(function (index) {
            const dot = document.getElementById("step" + index + "dot");
            const label = document.getElementById("step" + index + "lbl");

            if (index < stepNumber) {
                dot.className = "step-dot done";
                label.className = "step-label";
            } else if (index === stepNumber) {
                dot.className = "step-dot active";
                dot.innerHTML = "<span>" + index + "</span>";
                label.className = "step-label active";
            } else {
                dot.className = "step-dot";
                dot.innerHTML = "<span>" + index + "</span>";
                label.className = "step-label";
            }
        });

        document.getElementById("line12").classList.toggle("done", stepNumber > 1);
        document.getElementById("line23").classList.toggle("done", stepNumber > 2);
    }

    function animateLoadingSteps() {
        [1, 2, 3, 4].forEach(function (index, arrayIndex) {
            window.setTimeout(function () {
                document.getElementById("ls" + index).classList.add("show");
            }, arrayIndex * 800);
        });
    }

    function processTextResume(text, fileName) {
        resumeContent = text;
        document.getElementById("resumeText").value = text.substring(0, 3000);
        document.getElementById("dropTitle").textContent = fileName ? "✓ " + fileName + " loaded" : "✓ Resume content loaded";
        document.getElementById("dropZone").classList.add("upload-ready");
        checkReady();
    }

    function processFile(file) {
        const lowerName = String(file.name || "").toLowerCase();

        if (!(/\.(txt|doc|docx|pdf)$/i.test(lowerName))) {
            showError("Please upload a PDF, DOC, DOCX, or TXT resume file.");
            return;
        }

        const reader = new FileReader();
        reader.onload = function (event) {
            processTextResume(String(event.target.result || ""), file.name);
            hideError();
        };
        reader.onerror = function () {
            showError("Unable to read this file. Please try another resume file or paste the text manually.");
        };
        reader.readAsText(file);
    }

    function generateAnalysis(resumeText) {
        const textLength = resumeText.length;
        const hasTech = /(python|java|javascript|react|node|sql|aws|docker|kubernetes|html|css|api|rest|git)/i.test(resumeText);
        const hasExp = /(experience|intern|worked|developed|built|created|managed|led)/i.test(resumeText);
        const hasProjects = /(project|built|developed|created|portfolio|github)/i.test(resumeText);
        const hasEducation = /(b\.tech|bachelor|master|degree|university|college|cgpa|gpa)/i.test(resumeText);

        let baseScore = 50;
        if (hasTech) baseScore += 15;
        if (hasExp) baseScore += 15;
        if (hasProjects) baseScore += 10;
        if (hasEducation) baseScore += 10;
        if (textLength > 500) baseScore += 5;
        if (textLength > 1000) baseScore += 5;
        baseScore = Math.min(98, Math.max(42, baseScore));

        const strengths = [];
        const weaknesses = [];
        const improvements = [];

        if (hasTech) strengths.push("Strong technical skills section with relevant technologies");
        else weaknesses.push("Technical skills section needs more relevant keywords");

        if (hasExp) strengths.push("Shows relevant work or internship experience");
        else weaknesses.push("Add internship or project experience to strengthen your profile");

        if (hasProjects) strengths.push("Good project portfolio demonstrating practical application");
        else weaknesses.push("Include more detailed project descriptions");

        if (textLength > 800) strengths.push("Comprehensive resume with good detail");
        if (textLength < 400) weaknesses.push("Resume is too brief, add more details about your work");

        while (strengths.length < 4) strengths.push("Strong foundation in relevant skills");
        while (weaknesses.length < 4) weaknesses.push("Consider adding more quantifiable achievements");

        improvements.push("Add specific numbers and metrics to highlight your impact");
        improvements.push("Tailor your resume with keywords from target job descriptions");
        improvements.push("Include a projects section with links to GitHub or live demos");
        improvements.push("Add a professional summary at the top to grab attention");

        const techKeywords = ["Python", "JavaScript", "React", "Node.js", "SQL", "Git", "REST APIs", "AWS", "Docker", "Problem Solving", "Team Collaboration", "Agile Methodology"];
        const keywordsPresent = techKeywords.filter(function (keyword) {
            return resumeText.toLowerCase().includes(keyword.toLowerCase());
        }).slice(0, 6);
        const keywordsMissing = techKeywords.filter(function (keyword) {
            return !resumeText.toLowerCase().includes(keyword.toLowerCase());
        }).slice(0, 6);

        return {
            overallScore: baseScore,
            grade: baseScore >= 80 ? "Excellent" : baseScore >= 65 ? "Good" : baseScore >= 50 ? "Average" : "Needs Work",
            headline: baseScore >= 80 ? "Strong, well-structured resume" : baseScore >= 65 ? "Solid foundation with room to grow" : "Good starting point, needs refinement",
            summary: baseScore >= 80
                ? "Your resume demonstrates strong technical skills and clear impact. Excellent formatting and relevant experience."
                : baseScore >= 65
                    ? "Your resume has good content and skills. Focus on quantifying achievements and adding more project details."
                    : "Your resume has potential. Add more technical keywords, quantify results, and improve the overall structure.",
            subscores: {
                content: Math.min(98, Math.max(40, baseScore + (hasExp ? 5 : -5))),
                formatting: Math.min(98, Math.max(40, baseScore + (hasTech ? 5 : -3))),
                skills: Math.min(98, Math.max(40, baseScore + (hasTech ? 10 : -8))),
                impact: Math.min(98, Math.max(40, baseScore + (textLength > 600 ? 5 : -5)))
            },
            strengths: strengths.slice(0, 4),
            weaknesses: weaknesses.slice(0, 4),
            improvements: improvements.slice(0, 4),
            keywordsPresent: keywordsPresent.length ? keywordsPresent : ["Python", "JavaScript", "React"],
            keywordsMissing: keywordsMissing.length ? keywordsMissing : ["Docker", "AWS", "REST APIs", "Git"],
            recommendations: [
                { text: "Quantify your achievements using numbers and metrics to show impact.", priority: "high" },
                { text: "Add LinkedIn and GitHub profile links to showcase your work.", priority: "high" },
                { text: "Customize your resume for each application by highlighting relevant skills.", priority: "medium" },
                { text: "Include a strong professional summary highlighting your career goals.", priority: "medium" },
                { text: "Consider adding relevant certifications that strengthen your target role.", priority: "low" }
            ]
        };
    }

    function renderResults(result) {
        document.getElementById("loadingSection").classList.remove("visible");
        setStep(3);

        const score = result.overallScore;
        document.getElementById("scoreVal").textContent = score;

        const circumference = 283;
        const offset = circumference - (score / 100) * circumference;
        const ring = document.getElementById("scoreRing");
        ring.style.strokeDashoffset = offset;
        ring.classList.remove("green", "amber", "red");
        ring.classList.add(score >= 75 ? "green" : score >= 50 ? "amber" : "red");

        const grade = document.getElementById("scoreGrade");
        const gradeMap = {
            "Excellent": "excellent",
            "Good": "good",
            "Average": "average",
            "Needs Work": "poor"
        };

        grade.className = "score-grade " + (gradeMap[result.grade] || "average");
        grade.textContent = result.grade;
        document.getElementById("scoreHeadline").textContent = result.headline;
        document.getElementById("scoreSummary").textContent = result.summary;

        const subscoreDefinitions = [
            { key: "content", label: "Content Quality" },
            { key: "formatting", label: "Formatting" },
            { key: "skills", label: "Skills Match" },
            { key: "impact", label: "Impact & Clarity" }
        ];

        document.getElementById("subscoresGrid").innerHTML = subscoreDefinitions.map(function (subscore) {
            const value = result.subscores[subscore.key];
            const colorClass = value >= 75 ? "green" : value >= 50 ? "amber" : "red";
            return '<div class="subscore-card"><div class="subscore-label">' + subscore.label + '</div><div class="subscore-val">' + value + '<small class="subscore-unit">/100</small></div><div class="subscore-bar"><div class="subscore-bar-fill ' + colorClass + '" style="width:' + value + '%"></div></div></div>';
        }).join("");

        const analysisColumns = [
            {
                title: "Strengths",
                items: result.strengths,
                colorClass: "green",
                dotClass: "green",
                icon: '<svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><path d="M22 4L12 14.01l-3-3"></path></svg>'
            },
            {
                title: "Areas to Improve",
                items: result.weaknesses,
                colorClass: "red",
                dotClass: "red",
                icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>'
            },
            {
                title: "Suggested Actions",
                items: result.improvements,
                colorClass: "amber",
                dotClass: "amber",
                icon: '<svg viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>'
            }
        ];

        document.getElementById("analysisCols").innerHTML = analysisColumns.map(function (column) {
            return '<div class="analysis-col"><div class="col-header"><div class="col-icon ' + column.colorClass + '">' + column.icon + '</div><div class="col-title">' + column.title + '</div><div class="col-count">' + column.items.length + '</div></div><div class="col-items">' + column.items.map(function (item) {
                return '<div class="col-item"><span class="col-item-dot ' + column.dotClass + '"></span><span>' + item + '</span></div>';
            }).join("") + '</div></div>';
        }).join("");

        document.getElementById("keywordsWrap").innerHTML =
            result.keywordsPresent.map(function (keyword) {
                return '<span class="keyword-pill present">' + keyword + '</span>';
            }).join("") +
            result.keywordsMissing.map(function (keyword) {
                return '<span class="keyword-pill missing">' + keyword + '</span>';
            }).join("");

        document.getElementById("recList").innerHTML = result.recommendations.map(function (recommendation, index) {
            return '<div class="rec-item"><div class="rec-num">' + (index + 1) + '</div><div class="rec-text">' + recommendation.text + '</div><div class="rec-priority ' + recommendation.priority + '">' + recommendation.priority + '</div></div>';
        }).join("");

        const resultsSection = document.getElementById("resultsSection");
        resultsSection.classList.add("visible");
        resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });

        window.setTimeout(function () {
            document.querySelectorAll(".subscore-bar-fill").forEach(function (element) {
                const width = element.style.width;
                element.style.width = "0";
                window.requestAnimationFrame(function () {
                    window.requestAnimationFrame(function () {
                        element.style.width = width;
                    });
                });
            });
        }, 100);
    }

    function resetPage() {
        document.getElementById("resultsSection").classList.remove("visible");
        document.getElementById("uploadSection").style.display = "block";
        document.getElementById("loadingSection").classList.remove("visible");
        document.getElementById("resumeText").value = "";
        document.getElementById("dropTitle").textContent = "Drag and drop your resume here";
        document.getElementById("dropZone").classList.remove("upload-ready", "drag-over");
        document.getElementById("fileInput").value = "";
        document.getElementById("analyseBtn").disabled = true;
        [1, 2, 3, 4].forEach(function (index) {
            document.getElementById("ls" + index).classList.remove("show");
        });
        resumeContent = "";
        hideError();
        setStep(1);
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function bindEvents() {
        const dropZone = document.getElementById("dropZone");
        const fileInput = document.getElementById("fileInput");
        const resumeText = document.getElementById("resumeText");
        const analyseButton = document.getElementById("analyseBtn");
        const exportButton = document.getElementById("exportBtn");
        const resetButton = document.getElementById("resetBtn");

        dropZone.addEventListener("click", function () {
            fileInput.click();
        });

        dropZone.addEventListener("dragover", function (event) {
            event.preventDefault();
            dropZone.classList.add("drag-over");
        });

        dropZone.addEventListener("dragleave", function () {
            dropZone.classList.remove("drag-over");
        });

        dropZone.addEventListener("drop", function (event) {
            event.preventDefault();
            dropZone.classList.remove("drag-over");
            const file = event.dataTransfer.files[0];
            if (file) {
                processFile(file);
            }
        });

        fileInput.addEventListener("change", function (event) {
            const file = event.target.files[0];
            if (file) {
                processFile(file);
            }
        });

        resumeText.addEventListener("input", checkReady);

        analyseButton.addEventListener("click", async function (event) {
            addRipple(event, analyseButton);

            const text = resumeText.value.trim() || resumeContent;
            if (text.length < 20) {
                showError("Please provide at least 20 characters of resume text for analysis.");
                return;
            }

            hideError();
            setStep(2);
            document.getElementById("uploadSection").style.display = "none";
            document.getElementById("resultsSection").classList.remove("visible");
            document.getElementById("loadingSection").classList.add("visible");
            animateLoadingSteps();

            await new Promise(function (resolve) {
                window.setTimeout(resolve, 2800);
            });

            renderResults(generateAnalysis(text));
        });

        exportButton.addEventListener("click", function (event) {
            addRipple(event, exportButton);
            window.print();
        });

        resetButton.addEventListener("click", function (event) {
            addRipple(event, resetButton);
            resetPage();
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        const authState = window.PlacementPortalAuth
            ? window.PlacementPortalAuth.getAuthState()
            : null;

        if (!authState || String(authState.role || "").toLowerCase() !== "student") {
            window.location.replace("/student-login.html");
            return;
        }

        initScrollProgress();
        bindEvents();
    });
})();
