package com.iare.placementportal.ai;

import jakarta.validation.constraints.NotBlank;

public record StudentAiChatRequest(
        @NotBlank(message = "Message is required.")
        String message
) {
}
