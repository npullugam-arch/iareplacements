(function () {
    const QUESTIONS = [
        {
            title: "Tell me about yourself.",
            copy: "Structure your answer around academics, core strengths, top projects, and why you are targeting this role.",
            feedback: "A strong answer should stay under 90 seconds, include your technical direction, and end with why this role fits you."
        },
        {
            title: "Describe a project where you solved a difficult problem.",
            copy: "Focus on the challenge, your approach, the tools used, and the measurable outcome.",
            feedback: "Mention your exact role, trade-offs you considered, and what result improved because of your solution."
        },
        {
            title: "Why do you want to work at this company?",
            copy: "Connect the company’s product, engineering culture, or learning opportunities to your goals.",
            feedback: "Avoid generic praise. Tie your answer to one real product, team, or growth area that genuinely fits you."
        }
    ];

    let currentIndex = 0;

    function ensureStudentAuth() {
        const authState = window.PlacementPortalAuth ? window.PlacementPortalAuth.getAuthState() : null;
        if (!authState || String(authState.role || "").toLowerCase() !== "student") {
            window.location.replace("/student-login.html");
            return false;
        }
        return true;
    }

    function renderQuestion() {
        const question = QUESTIONS[currentIndex];
        document.getElementById("questionTitle").textContent = question.title;
        document.getElementById("questionCopy").textContent = question.copy;
        document.getElementById("feedbackText").textContent = question.feedback;
    }

    document.addEventListener("DOMContentLoaded", function () {
        if (!ensureStudentAuth()) {
            return;
        }

        const startButton = document.getElementById("startInterviewBtn");
        const nextButton = document.getElementById("nextQuestionBtn");
        const submitButton = document.getElementById("submitAnswerBtn");
        const answerBox = document.getElementById("answerBox");

        startButton.addEventListener("click", function () {
            currentIndex = 0;
            answerBox.value = "";
            renderQuestion();
        });

        nextButton.addEventListener("click", function () {
            currentIndex = (currentIndex + 1) % QUESTIONS.length;
            answerBox.value = "";
            renderQuestion();
        });

        submitButton.addEventListener("click", function () {
            const value = answerBox.value.trim();
            document.getElementById("feedbackText").textContent = value
                ? "Good start. Now tighten your answer, add one measurable outcome, and align it more clearly with the selected role."
                : "Write an answer first, then review it against clarity, structure, and relevance to the role.";
        });
    });
})();
