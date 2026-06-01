package com.iare.placementportal.ai;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class AiDbAnswerService {

    private static final Logger LOGGER = LoggerFactory.getLogger(AiDbAnswerService.class);
    private static final String DB_ANSWER_SYSTEM_PROMPT = """
            You are IARE AI Placement Assistant.
            Answer using only the verified portal data context provided to you.
            Do not invent companies, numbers, names, dates, or packages.
            If the context says no matching data was found, say that clearly and politely.
            Keep the response concise, clear, and student-friendly.
            """;
    private static final String DB_ANSWER_USER_PROMPT_TEMPLATE = """
            Student question:
            %s

            Verified portal data context:
            %s

            Write a natural answer for the student using only this verified data.
            If useful, format short bullet points.
            """;

    private final OllamaAiService ollamaAiService;

    public AiDbAnswerService(OllamaAiService ollamaAiService) {
        this.ollamaAiService = ollamaAiService;
    }

    public String generateAnswer(String question, String dbContext) {
        LOGGER.info("AI DB answer generation started: questionLength={}, contextLength={}",
                question == null ? 0 : question.length(),
                dbContext == null ? 0 : dbContext.length());
        return ollamaAiService.generateText(
                DB_ANSWER_SYSTEM_PROMPT,
                DB_ANSWER_USER_PROMPT_TEMPLATE.formatted(
                        question == null ? "" : question.trim(),
                        dbContext == null ? "" : dbContext.trim()
                ),
                0.2,
                280
        );
    }
}
