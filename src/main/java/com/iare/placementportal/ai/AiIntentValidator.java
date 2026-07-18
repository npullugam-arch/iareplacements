package com.iare.placementportal.ai;

import org.springframework.stereotype.Component;

import java.util.EnumSet;

@Component
public class AiIntentValidator {

    public boolean isValid(AiIntentResult intent) {
        if (intent == null || intent.intent() == null || intent.mode() == null || intent.projection() == null) {
            return false;
        }

        return switch (intent.intent()) {
            case ACTIVE_NOTICES -> validateActiveNotices(intent);
            case COMPANIES_VISITED_BY_YEAR -> validateCompaniesVisitedByYear(intent);
            case COMPANY_VISIT_COUNT_BY_YEAR -> validateCompanyVisitCountByYear(intent);
            case PLACEMENT_STATISTICS_BY_COMPANY -> validatePlacementStatisticsByCompany(intent);
            case SELECTED_STUDENTS_BY_COMPANY -> validateSelectedStudentsByCompany(intent);
            case SELECTED_COUNT_BY_COMPANY -> validateSelectedCountByCompany(intent);
            case DRIVE_DETAILS_BY_COMPANY -> validateDriveDetailsByCompany(intent);
            case RESOURCES_BY_COMPANY -> validateResourcesByCompany(intent);
            case GENERAL_CHAT, UNKNOWN -> true;
            default -> false;
        };
    }

    private boolean validateActiveNotices(AiIntentResult intent) {
        return EnumSet.of(AiAnswerMode.COUNT, AiAnswerMode.LIST).contains(intent.mode())
                && EnumSet.of(AiProjection.NONE, AiProjection.DEFAULT, AiProjection.VALID_DATES, AiProjection.TITLES_ONLY).contains(intent.projection())
                && (intent.mode() != AiAnswerMode.COUNT || intent.projection() == AiProjection.NONE);
    }

    private boolean validateCompaniesVisitedByYear(AiIntentResult intent) {
        return intent.mode() == AiAnswerMode.LIST
                && intent.projection() == AiProjection.COMPANY_NAMES
                && intent.year() != null;
    }

    private boolean validateCompanyVisitCountByYear(AiIntentResult intent) {
        return intent.mode() == AiAnswerMode.COUNT
                && intent.projection() == AiProjection.NONE
                && intent.year() != null;
    }

    private boolean validatePlacementStatisticsByCompany(AiIntentResult intent) {
        return EnumSet.of(AiAnswerMode.LIST, AiAnswerMode.DETAIL, AiAnswerMode.SUMMARY).contains(intent.mode())
                && intent.projection() == AiProjection.STATISTICS
                && hasText(intent.company());
    }

    private boolean validateSelectedStudentsByCompany(AiIntentResult intent) {
        return intent.mode() == AiAnswerMode.LIST
                && intent.projection() == AiProjection.DEFAULT
                && hasText(intent.company());
    }

    private boolean validateSelectedCountByCompany(AiIntentResult intent) {
        return intent.mode() == AiAnswerMode.COUNT
                && intent.projection() == AiProjection.NONE
                && hasText(intent.company());
    }

    private boolean validateDriveDetailsByCompany(AiIntentResult intent) {
        return EnumSet.of(AiAnswerMode.COUNT, AiAnswerMode.LIST).contains(intent.mode())
                && EnumSet.of(AiProjection.NONE, AiProjection.DEFAULT, AiProjection.TITLES_ONLY).contains(intent.projection())
                && hasText(intent.company())
                && (intent.mode() != AiAnswerMode.COUNT || intent.projection() == AiProjection.NONE);
    }

    private boolean validateResourcesByCompany(AiIntentResult intent) {
        return EnumSet.of(AiAnswerMode.COUNT, AiAnswerMode.LIST).contains(intent.mode())
                && EnumSet.of(AiProjection.NONE, AiProjection.DEFAULT, AiProjection.TITLES_ONLY).contains(intent.projection())
                && hasText(intent.company())
                && (intent.mode() != AiAnswerMode.COUNT || intent.projection() == AiProjection.NONE);
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
