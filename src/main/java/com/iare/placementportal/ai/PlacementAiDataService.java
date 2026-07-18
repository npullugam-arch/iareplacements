package com.iare.placementportal.ai;

import com.iare.placementportal.entity.Company;
import com.iare.placementportal.entity.Notice;
import com.iare.placementportal.entity.PlacementDrive;
import com.iare.placementportal.entity.PlacementStatistics;
import com.iare.placementportal.entity.PreparationResource;
import com.iare.placementportal.entity.SelectedStudent;
import com.iare.placementportal.repository.CompanyRepository;
import com.iare.placementportal.repository.NoticeRepository;
import com.iare.placementportal.repository.PlacementDriveRepository;
import com.iare.placementportal.repository.PlacementStatisticsRepository;
import com.iare.placementportal.repository.PreparationResourceRepository;
import com.iare.placementportal.repository.SelectedStudentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Service
@Transactional(readOnly = true)
public class PlacementAiDataService {

    private static final Logger LOGGER = LoggerFactory.getLogger(PlacementAiDataService.class);

    private final CompanyRepository companyRepository;
    private final SelectedStudentRepository selectedStudentRepository;
    private final PlacementDriveRepository placementDriveRepository;
    private final PlacementStatisticsRepository placementStatisticsRepository;
    private final NoticeRepository noticeRepository;
    private final PreparationResourceRepository preparationResourceRepository;

    public PlacementAiDataService(CompanyRepository companyRepository,
                                  SelectedStudentRepository selectedStudentRepository,
                                  PlacementDriveRepository placementDriveRepository,
                                  PlacementStatisticsRepository placementStatisticsRepository,
                                  NoticeRepository noticeRepository,
                                  PreparationResourceRepository preparationResourceRepository) {
        this.companyRepository = companyRepository;
        this.selectedStudentRepository = selectedStudentRepository;
        this.placementDriveRepository = placementDriveRepository;
        this.placementStatisticsRepository = placementStatisticsRepository;
        this.noticeRepository = noticeRepository;
        this.preparationResourceRepository = preparationResourceRepository;
    }

    public String answerPortalQuestion(AiIntentResult intent) {
        LOGGER.info("AI portal data fetch started: intent={}, mode={}, projection={}, company='{}', year={}, branch='{}', limit={}",
                intent.intent(), intent.mode(), intent.projection(), intent.company(), intent.year(), intent.branch(), intent.limit());

        return switch (intent.intent()) {
            case COMPANY_INFO -> answerCompanyInfo(intent);
            case SELECTED_STUDENTS_BY_COMPANY -> answerSelectedStudents(intent);
            case SELECTED_COUNT_BY_COMPANY -> answerSelectedCount(intent);
            case COMPANY_VISIT_COUNT_BY_YEAR -> answerCompanyVisitCount(intent);
            case COMPANIES_VISITED_BY_YEAR -> answerCompaniesVisited(intent);
            case HIGHEST_PACKAGE_BY_YEAR -> answerHighestPackage(intent);
            case AVERAGE_PACKAGE_BY_YEAR -> answerAveragePackage(intent);
            case DRIVE_DETAILS_BY_COMPANY -> answerDriveDetails(intent);
            case PLACEMENT_STATISTICS_BY_COMPANY -> answerPlacementStatistics(intent);
            case ACTIVE_NOTICES -> answerNotices(intent);
            case RESOURCES_BY_COMPANY -> answerResources(intent);
            case GENERAL_CHAT, UNKNOWN -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "This request does not require portal data lookup.");
        };
    }

    public String fetchPortalData(AiIntentResult intent) {
        return answerPortalQuestion(intent);
    }

    private String answerCompanyInfo(AiIntentResult intent) {
        Company company = resolveCompany(intent.company());
        if (intent.mode() == AiAnswerMode.COUNT) {
            return "Yes, " + company.getCompanyName() + " is a company in the portal database.";
        }

        StringBuilder answer = new StringBuilder();
        answer.append(company.getCompanyName()).append(" is listed in the portal database.");
        if (normalizeOptional(company.getIndustry()) != null) {
            answer.append("\nIndustry: ").append(company.getIndustry());
        }
        if (company.getFoundedYear() != null) {
            answer.append("\nFounded Year: ").append(company.getFoundedYear());
        }
        if (normalizeOptional(company.getCompanyType()) != null) {
            answer.append("\nCompany Type: ").append(company.getCompanyType());
        }
        if (normalizeOptional(company.getHeadquarters()) != null) {
            answer.append("\nHeadquarters: ").append(company.getHeadquarters());
        }
        if (normalizeOptional(company.getWebsiteUrl()) != null) {
            answer.append("\nWebsite: ").append(company.getWebsiteUrl());
        }
        if (normalizeOptional(company.getDescription()) != null) {
            answer.append("\nDescription: ").append(company.getDescription());
        }
        return answer.toString();
    }

    private String answerSelectedStudents(AiIntentResult intent) {
        requireModeAndProjection(intent, AiAnswerMode.LIST, AiProjection.DEFAULT);
        Company company = resolveCompany(intent.company());
        Integer year = intent.year();
        List<SelectedStudent> students = selectedStudentRepository.findTopActiveByCompanyName(
                company.getCompanyName(),
                year,
                normalizeFilter(intent.branch()),
                PageRequest.of(0, sanitizeLimit(intent.limit()))
        );

        if (students.isEmpty()) {
            return year == null
                    ? "No selected students data found for " + company.getCompanyName() + " in the portal database."
                    : "No selected students data found for " + company.getCompanyName() + " in " + year + " in the portal database.";
        }

        StringBuilder answer = new StringBuilder();
        answer.append(company.getCompanyName())
                .append(" selected ")
                .append(students.size())
                .append(students.size() == 1 ? " student" : " students")
                .append(year == null ? " in the available portal records" : " in " + year)
                .append(":\n");

        for (int index = 0; index < students.size(); index++) {
            SelectedStudent student = students.get(index);
            answer.append(index + 1)
                    .append(". ")
                    .append(student.getStudentName())
                    .append(" - ")
                    .append(student.getRollNumber())
                    .append(" - ")
                    .append(student.getBranch())
                    .append(" - ")
                    .append(student.getPackageOffered());
            if (normalizeOptional(student.getOfferType()) != null) {
                answer.append(" - ").append(student.getOfferType());
            }
            if (index < students.size() - 1) {
                answer.append('\n');
            }
        }
        return answer.toString();
    }

    private String answerSelectedCount(AiIntentResult intent) {
        requireModeAndProjection(intent, AiAnswerMode.COUNT, AiProjection.NONE);
        Company company = resolveCompany(intent.company());
        Integer year = intent.year();
        long count = selectedStudentRepository.countActiveByCompanyName(
                company.getCompanyName(),
                year,
                normalizeFilter(intent.branch())
        );
        if (count == 0) {
            return year == null
                    ? "No selected students data found for " + company.getCompanyName() + " in the portal database."
                    : "No selected students data found for " + company.getCompanyName() + " in " + year + " in the portal database.";
        }
        return company.getCompanyName() + " selected " + count + " student"
                + (count == 1 ? "" : "s")
                + (year == null ? " in the available portal records." : " in " + year + ".");
    }

    private String answerCompanyVisitCount(AiIntentResult intent) {
        requireModeAndProjection(intent, AiAnswerMode.COUNT, AiProjection.NONE);
        Integer year = requireYear(intent, "Please mention the company name or year.");
        long count = placementDriveRepository.countDistinctActiveCompaniesByHiringYear(year);
        if (count == 0) {
            return "No company visit data found for " + year + " in the portal database.";
        }
        return count + " compan" + (count == 1 ? "y" : "ies") + " visited in " + year + " according to the portal database.";
    }

    private String answerCompaniesVisited(AiIntentResult intent) {
        requireModeAndProjection(intent, AiAnswerMode.LIST, AiProjection.COMPANY_NAMES);
        Integer year = requireYear(intent, "Please mention the company name or year.");
        List<String> companies = placementDriveRepository.findDistinctActiveCompanyNamesByHiringYear(year);
        if (companies.isEmpty()) {
            return "No company visit data found for " + year + " in the portal database.";
        }
        List<String> limitedCompanies = companies.stream().limit(sanitizeLimit(intent.limit())).toList();
        StringBuilder answer = new StringBuilder("Companies visited in ")
                .append(year)
                .append(":\n");
        for (int index = 0; index < limitedCompanies.size(); index++) {
            answer.append(index + 1).append(". ").append(limitedCompanies.get(index));
            if (index < limitedCompanies.size() - 1) {
                answer.append('\n');
            }
        }
        return answer.toString();
    }

    private String answerHighestPackage(AiIntentResult intent) {
        Integer year = requireYear(intent, "Please mention the company name or year.");
        Double highestPackage = placementStatisticsRepository.findHighestPackageByHiringYear(year);
        if (highestPackage == null) {
            return "No highest package data found for " + year + " in the portal database.";
        }
        return "The highest package recorded in " + year + " is " + formatDecimal(highestPackage) + ".";
    }

    private String answerAveragePackage(AiIntentResult intent) {
        Integer year = requireYear(intent, "Please mention the company name or year.");
        Double averagePackage = placementStatisticsRepository.findAveragePackageByHiringYear(year);
        if (averagePackage == null) {
            return "No average package data found for " + year + " in the portal database.";
        }
        return "The average package recorded in " + year + " is " + formatDecimal(averagePackage) + ".";
    }

    private String answerDriveDetails(AiIntentResult intent) {
        Company company = resolveCompany(intent.company());
        Integer year = intent.year();
        if (intent.mode() == AiAnswerMode.COUNT) {
            long count = placementDriveRepository.countActiveByCompanyName(company.getCompanyName(), year);
            if (count == 0) {
                return year == null
                        ? "No placement drive data found for " + company.getCompanyName() + " in the portal database."
                        : "No placement drive data found for " + company.getCompanyName() + " in " + year + " in the portal database.";
            }
            return company.getCompanyName() + " has " + count + " drive"
                    + (count == 1 ? "" : "s")
                    + (year == null ? " in the available portal records." : " in " + year + ".");
        }

        List<PlacementDrive> drives = placementDriveRepository.findActiveByCompanyName(
                company.getCompanyName(),
                year,
                PageRequest.of(0, sanitizeLimit(intent.limit()))
        );

        if (drives.isEmpty()) {
            return year == null
                    ? "No placement drive data found for " + company.getCompanyName() + " in the portal database."
                    : "No placement drive data found for " + company.getCompanyName() + " in " + year + " in the portal database.";
        }
        StringBuilder answer = new StringBuilder();
        answer.append(company.getCompanyName())
                .append(" has ")
                .append(drives.size())
                .append(drives.size() == 1 ? " drive" : " drives")
                .append(year == null ? " in the available portal records" : " in " + year)
                .append(":\n");

        for (int index = 0; index < drives.size(); index++) {
            PlacementDrive drive = drives.get(index);
            answer.append(index + 1)
                    .append(". ")
                    .append(drive.getDriveTitle());
            if (intent.projection() != AiProjection.TITLES_ONLY) {
                answer.append(" | Date: ")
                        .append(drive.getHiringDate())
                        .append(" | Mode: ")
                        .append(drive.getHiringMode())
                        .append(" | Status: ")
                        .append(drive.getDriveStatus())
                        .append(" | CTC: ")
                        .append(drive.getCtcPackage());
            }
            if (index < drives.size() - 1) {
                answer.append('\n');
            }
        }
        return answer.toString();
    }

    private String answerPlacementStatistics(AiIntentResult intent) {
        requireProjection(intent, AiProjection.STATISTICS);
        Company company = resolveCompany(intent.company());
        Integer year = intent.year();
        List<PlacementStatistics> statistics = placementStatisticsRepository.findActiveByCompanyName(
                company.getCompanyName(),
                year,
                PageRequest.of(0, sanitizeLimit(intent.limit()))
        );

        if (statistics.isEmpty()) {
            return year == null
                    ? "No placement statistics data found for " + company.getCompanyName() + " in the portal database."
                    : "No placement statistics data found for " + company.getCompanyName() + " in " + year + " in the portal database.";
        }

        StringBuilder answer = new StringBuilder("Placement statistics for ")
                .append(company.getCompanyName())
                .append(year == null ? " in the available portal records" : " in " + year)
                .append(":\n");

        for (int index = 0; index < statistics.size(); index++) {
            PlacementStatistics stat = statistics.get(index);
            PlacementDrive drive = stat.getPlacementDrive();
            answer.append(index + 1)
                    .append(". ")
                    .append(drive.getDriveTitle())
                    .append(" | Applied: ")
                    .append(stat.getStudentsApplied())
                    .append(" | Shortlisted: ")
                    .append(stat.getStudentsShortlisted())
                    .append(" | Selected: ")
                    .append(stat.getStudentsSelected())
                    .append(" | Highest: ")
                    .append(formatDecimal(stat.getHighestPackage()))
                    .append(" | Average: ")
                    .append(formatDecimal(stat.getAveragePackage()));
            if (index < statistics.size() - 1) {
                answer.append('\n');
            }
        }
        return answer.toString();
    }

    private String answerNotices(AiIntentResult intent) {
        if (intent.mode() == AiAnswerMode.COUNT) {
            requireProjection(intent, AiProjection.NONE);
            long count = noticeRepository.countCurrentlyActiveNotices(LocalDate.now());
            if (count == 0) {
                return "There are no active notices in the portal database right now.";
            }
            return "There are " + count + " active notice" + (count == 1 ? "" : "s") + " in the portal database.";
        }

        List<Notice> notices = noticeRepository.findCurrentlyActiveNotices(LocalDate.now());
        if (notices.isEmpty()) {
            return "There are no active notices in the portal database right now.";
        }

        StringBuilder answer = new StringBuilder("Active notices:\n");
        for (int index = 0; index < notices.size(); index++) {
            Notice notice = notices.get(index);
            answer.append(index + 1)
                    .append(". ");
            if (intent.projection() == AiProjection.VALID_DATES) {
                answer.append(notice.getValidFrom()).append(" to ").append(notice.getValidTo());
            } else if (intent.projection() == AiProjection.TITLES_ONLY) {
                answer.append(notice.getTitle());
            } else {
                answer.append(notice.getTitle())
                        .append(" | Valid: ")
                        .append(notice.getValidFrom())
                        .append(" to ")
                        .append(notice.getValidTo());
                if (normalizeOptional(notice.getMessage()) != null) {
                    answer.append(" | ").append(notice.getMessage());
                }
            }
            if (index < notices.size() - 1) {
                answer.append('\n');
            }
        }
        return answer.toString();
    }

    private String answerResources(AiIntentResult intent) {
        Company company = resolveCompany(intent.company());
        Integer year = intent.year();
        if (intent.mode() == AiAnswerMode.COUNT) {
            long count = preparationResourceRepository.countActiveByCompanyName(company.getCompanyName(), year);
            if (count == 0) {
                return year == null
                        ? "No preparation resources found for " + company.getCompanyName() + " in the portal database."
                        : "No preparation resources found for " + company.getCompanyName() + " in " + year + " in the portal database.";
            }
            return "There are " + count + " preparation resource"
                    + (count == 1 ? "" : "s")
                    + " for " + company.getCompanyName()
                    + (year == null ? " in the portal database." : " in " + year + ".");
        }

        List<PreparationResource> resources = preparationResourceRepository.findActiveByCompanyName(
                company.getCompanyName(),
                year,
                PageRequest.of(0, sanitizeLimit(intent.limit()))
        );

        if (resources.isEmpty()) {
            return year == null
                    ? "No preparation resources found for " + company.getCompanyName() + " in the portal database."
                    : "No preparation resources found for " + company.getCompanyName() + " in " + year + " in the portal database.";
        }
        StringBuilder answer = new StringBuilder("Resources found for ")
                .append(company.getCompanyName())
                .append(year == null ? ":" : " in " + year + ":")
                .append(":\n");

        for (int index = 0; index < resources.size(); index++) {
            PreparationResource resource = resources.get(index);
            answer.append(index + 1)
                    .append(". ")
                    .append(resource.getResourceTitle());
            if (intent.projection() != AiProjection.TITLES_ONLY) {
                if (normalizeOptional(resource.getDescription()) != null) {
                    answer.append(" - ").append(resource.getDescription());
                }
                answer.append(" | PDFs: aptitude=").append(yesNo(resource.getAptitudePdfUrl()))
                        .append(", coding=").append(yesNo(resource.getCodingPdfUrl()))
                        .append(", technical=").append(yesNo(resource.getTechnicalPdfUrl()))
                        .append(", hr=").append(yesNo(resource.getHrPdfUrl()));
            }
            if (index < resources.size() - 1) {
                answer.append('\n');
            }
        }
        return answer.toString();
    }

    private Company resolveCompany(String requestedCompanyName) {
        String normalizedName = normalizeOptional(requestedCompanyName);
        if (normalizedName == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Please mention the company name or year.");
        }

        Optional<Company> exactMatch = companyRepository.findByCompanyNameIgnoreCase(normalizedName);
        if (exactMatch.isPresent()) {
            return exactMatch.get();
        }

        List<Company> companies = companyRepository.findAllByOrderByCreatedAtDesc();
        String canonicalInput = canonicalizeCompanyName(normalizedName);

        Optional<Company> canonicalMatch = companies.stream()
                .filter(company -> canonicalizeCompanyName(company.getCompanyName()).equals(canonicalInput))
                .findFirst();
        if (canonicalMatch.isPresent()) {
            return canonicalMatch.get();
        }

        List<Company> aliasMatches = companies.stream()
                .filter(company -> {
                    String canonicalCompanyName = canonicalizeCompanyName(company.getCompanyName());
                    return canonicalCompanyName.contains(canonicalInput) || canonicalInput.contains(canonicalCompanyName);
                })
                .sorted(Comparator.comparingInt(company -> canonicalizeCompanyName(company.getCompanyName()).length()))
                .toList();

        if (!aliasMatches.isEmpty()) {
            return aliasMatches.get(0);
        }

        throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                "No company record found in the portal database.");
    }

    private Integer requireYear(AiIntentResult intent, String message) {
        if (intent.year() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return intent.year();
    }

    private void requireModeAndProjection(AiIntentResult intent, AiAnswerMode mode, AiProjection projection) {
        if (intent.mode() != mode || intent.projection() != projection) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "This portal data request has an unsupported answer format.");
        }
    }

    private void requireProjection(AiIntentResult intent, AiProjection projection) {
        if (intent.projection() != projection) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "This portal data request has an unsupported answer format.");
        }
    }

    private int sanitizeLimit(Integer limit) {
        if (limit == null || limit <= 0) {
            return 5;
        }
        return Math.min(limit, 10);
    }

    private String normalizeFilter(String value) {
        String normalized = normalizeOptional(value);
        return normalized == null ? "" : normalized;
    }

    private String normalizeOptional(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        String lower = trimmed.toLowerCase(Locale.ENGLISH);
        if (lower.equals("null") || lower.equals("n/a") || lower.equals("na")) {
            return null;
        }
        return trimmed;
    }

    private String canonicalizeCompanyName(String value) {
        String normalizedValue = normalizeOptional(value);
        if (normalizedValue == null) {
            return "";
        }
        String canonical = normalizedValue.toLowerCase(Locale.ENGLISH)
                .replace("&", "and")
                .replaceAll("[^a-z0-9]", "");
        if (canonical.startsWith("ltm")) {
            canonical = "lti" + canonical.substring(3);
        }
        return canonical;
    }

    private String formatDecimal(Double value) {
        if (value == null) {
            return "Not available";
        }
        return String.format(Locale.ENGLISH, "%.2f", value);
    }

    private String yesNo(String value) {
        return normalizeOptional(value) == null ? "No" : "Yes";
    }
}
