package com.iare.placementportal.ai;

public record AiIntentResult(
        AiIntentType intent,
        AiAnswerMode mode,
        AiProjection projection,
        String company,
        Integer year,
        String branch,
        Integer limit,
        String originalQuestion
) {
}
