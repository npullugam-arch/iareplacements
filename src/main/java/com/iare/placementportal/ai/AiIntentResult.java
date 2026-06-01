package com.iare.placementportal.ai;

public record AiIntentResult(
        AiIntentType intent,
        AiEntityType entity,
        AiAnswerMode answerMode,
        String company,
        Integer year,
        String branch,
        Integer limit,
        String originalQuestion
) {
}
