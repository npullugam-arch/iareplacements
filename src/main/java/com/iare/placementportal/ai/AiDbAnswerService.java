package com.iare.placementportal.ai;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class AiDbAnswerService {

    private static final Logger LOGGER = LoggerFactory.getLogger(AiDbAnswerService.class);

    public String generateAnswer(String question, String dbContext) {
        LOGGER.info("AI DB answer generation started: questionLength={}, contextLength={}",
                question == null ? 0 : question.length(),
                dbContext == null ? 0 : dbContext.length());
        return "I can help you with portal data, but the placement assistant is currently using the n8n workflow for chat responses.";
    }
}
