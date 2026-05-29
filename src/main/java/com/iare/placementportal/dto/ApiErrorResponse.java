package com.iare.placementportal.dto;

import java.time.LocalDateTime;

public record ApiErrorResponse(
        String message,
        String error,
        LocalDateTime timestamp
) {
}
