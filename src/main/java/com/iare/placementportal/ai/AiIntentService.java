package com.iare.placementportal.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iare.placementportal.entity.Company;
import com.iare.placementportal.repository.CompanyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class AiIntentService {

    private static final Logger LOGGER = LoggerFactory.getLogger(AiIntentService.class);
    private static final Pattern YEAR_PATTERN = Pattern.compile("\\b(20\\d{2})\\b");
    private static final String INTENT_SYSTEM_PROMPT = """
            You are an intent extractor for the IARE AI Placement Portal.
            Return only valid JSON. Do not return markdown, code fences, explanations, SQL, or extra text.
            Your job is only to classify the request. You must not answer the question.
            """;
    private static final String INTENT_USER_PROMPT_TEMPLATE = """
            Extract a JSON object for this student question.

            Allowed intent values:
            ACTIVE_NOTICES
            COMPANIES_VISITED_BY_YEAR
            COMPANY_VISIT_COUNT_BY_YEAR
            PLACEMENT_STATISTICS_BY_COMPANY
            SELECTED_STUDENTS_BY_COMPANY
            SELECTED_COUNT_BY_COMPANY
            DRIVE_DETAILS_BY_COMPANY
            RESOURCES_BY_COMPANY
            GENERAL_CHAT
            UNKNOWN

            Allowed mode values:
            COUNT
            LIST
            DETAIL
            SUMMARY

            Allowed projection values:
            NONE
            DEFAULT
            VALID_DATES
            TITLES_ONLY
            COMPANY_NAMES
            STATISTICS

            Valid combinations:
            ACTIVE_NOTICES: COUNT with NONE, or LIST with DEFAULT, VALID_DATES, or TITLES_ONLY.
            COMPANIES_VISITED_BY_YEAR: LIST with COMPANY_NAMES and a year.
            COMPANY_VISIT_COUNT_BY_YEAR: COUNT with NONE and a year.
            PLACEMENT_STATISTICS_BY_COMPANY: LIST, DETAIL, or SUMMARY with STATISTICS and a company.
            SELECTED_STUDENTS_BY_COMPANY: LIST with DEFAULT and a company.
            SELECTED_COUNT_BY_COMPANY: COUNT with NONE and a company.
            DRIVE_DETAILS_BY_COMPANY: COUNT with NONE, or LIST with DEFAULT or TITLES_ONLY, and a company.
            RESOURCES_BY_COMPANY: COUNT with NONE, or LIST with DEFAULT or TITLES_ONLY, and a company.

            Examples:
            "What are the active notices?" -> {"intent":"ACTIVE_NOTICES","mode":"LIST","projection":"DEFAULT","company":null,"year":null,"branch":null,"limit":5}
            "How many active notices are there?" -> {"intent":"ACTIVE_NOTICES","mode":"COUNT","projection":"NONE","company":null,"year":null,"branch":null,"limit":5}
            "Give me only valid dates of active notices." -> {"intent":"ACTIVE_NOTICES","mode":"LIST","projection":"VALID_DATES","company":null,"year":null,"branch":null,"limit":5}
            "Show notice titles only." -> {"intent":"ACTIVE_NOTICES","mode":"LIST","projection":"TITLES_ONLY","company":null,"year":null,"branch":null,"limit":5}
            "Show company names for 2024." -> {"intent":"COMPANIES_VISITED_BY_YEAR","mode":"LIST","projection":"COMPANY_NAMES","company":null,"year":2024,"branch":null,"limit":5}
            "How many companies came in 2024?" -> {"intent":"COMPANY_VISIT_COUNT_BY_YEAR","mode":"COUNT","projection":"NONE","company":null,"year":2024,"branch":null,"limit":5}

            Return exactly this JSON shape:
            {
              "intent": "UNKNOWN",
              "mode": "SUMMARY",
              "projection": "NONE",
              "company": null,
              "year": null,
              "branch": null,
              "limit": 5
            }

            Student question:
            %s
            """;

    private final OllamaAiService ollamaAiService;
    private final ObjectMapper objectMapper;
    private final CompanyRepository companyRepository;
    private final AiIntentValidator aiIntentValidator;

    public AiIntentService(OllamaAiService ollamaAiService,
                           ObjectMapper objectMapper,
                           CompanyRepository companyRepository,
                           AiIntentValidator aiIntentValidator) {
        this.ollamaAiService = ollamaAiService;
        this.objectMapper = objectMapper;
        this.companyRepository = companyRepository;
        this.aiIntentValidator = aiIntentValidator;
    }

    public AiIntentResult extractIntent(String userQuestion) {
        String normalizedQuestion = userQuestion == null ? "" : userQuestion.trim();
        if (normalizedQuestion.isEmpty()) {
            return unknownIntent("");
        }

        try {
            String aiResponse = ollamaAiService.generateText(
                    INTENT_SYSTEM_PROMPT,
                    INTENT_USER_PROMPT_TEMPLATE.formatted(normalizedQuestion),
                    0.0,
                    260
            );
            AiIntentResult extractedIntent = parseIntentResponse(aiResponse, normalizedQuestion);
            AiIntentResult normalizedIntent = normalizeIntent(extractedIntent, normalizedQuestion);

            if (!aiIntentValidator.isValid(normalizedIntent)) {
                LOGGER.info("AI intent rejected by Java validator: intent={}, mode={}, projection={}, company='{}', year={}, branch='{}', limit={}",
                        normalizedIntent.intent(), normalizedIntent.mode(), normalizedIntent.projection(),
                        normalizedIntent.company(), normalizedIntent.year(), normalizedIntent.branch(), normalizedIntent.limit());
                return unknownIntent(normalizedQuestion);
            }

            LOGGER.info("AI intent extracted by Ollama and validated: intent={}, mode={}, projection={}, company='{}', year={}, branch='{}', limit={}",
                    normalizedIntent.intent(), normalizedIntent.mode(), normalizedIntent.projection(),
                    normalizedIntent.company(), normalizedIntent.year(), normalizedIntent.branch(), normalizedIntent.limit());
            return normalizedIntent;
        } catch (IllegalStateException exception) {
            LOGGER.warn("Intent extraction via Ollama unavailable. Returning safe clarification intent.");
            return unknownIntent(normalizedQuestion);
        } catch (Exception exception) {
            LOGGER.warn("Intent extraction via Ollama returned invalid or unsupported output. Returning safe clarification intent.", exception);
            return unknownIntent(normalizedQuestion);
        }
    }

    private AiIntentResult parseIntentResponse(String aiResponse, String originalQuestion) throws IOException {
        JsonNode rootNode = objectMapper.readTree(extractJsonPayload(aiResponse));
        AiIntentType intent = parseIntent(rootNode.path("intent").asText(null));
        AiAnswerMode mode = parseMode(rootNode.path("mode").asText(null));
        AiProjection projection = parseProjection(rootNode.path("projection").asText(null));

        if (intent == null || mode == null || projection == null) {
            throw new IllegalArgumentException("AI intent response contained unsupported enum values.");
        }

        return new AiIntentResult(
                intent,
                mode,
                projection,
                normalizeOptional(rootNode.path("company").asText(null)),
                parseOptionalInteger(rootNode.path("year")),
                normalizeOptional(rootNode.path("branch").asText(null)),
                clampLimit(parseOptionalInteger(rootNode.path("limit"))),
                originalQuestion
        );
    }

    private AiIntentResult normalizeIntent(AiIntentResult intent, String question) {
        String company = intent.company() != null
                ? resolveCompanyNameFromQuestion(intent.company())
                : resolveCompanyNameFromQuestion(question);
        Integer year = intent.year() != null ? intent.year() : extractYear(question);
        String branch = intent.branch() != null ? intent.branch() : extractBranch(question.toLowerCase(Locale.ENGLISH));

        return new AiIntentResult(
                intent.intent(),
                intent.mode(),
                intent.projection(),
                company,
                year,
                branch,
                intent.limit(),
                question
        );
    }

    private String extractJsonPayload(String aiResponse) {
        String trimmedResponse = aiResponse == null ? "" : aiResponse.trim();
        if (trimmedResponse.startsWith("```")) {
            trimmedResponse = trimmedResponse.replaceFirst("^```(?:json)?\\s*", "")
                    .replaceFirst("\\s*```$", "")
                    .trim();
        }

        int firstBrace = trimmedResponse.indexOf('{');
        int lastBrace = trimmedResponse.lastIndexOf('}');
        if (firstBrace < 0 || lastBrace <= firstBrace) {
            throw new IllegalArgumentException("AI intent response did not contain a JSON object.");
        }
        return trimmedResponse.substring(firstBrace, lastBrace + 1);
    }

    private AiIntentType parseIntent(String rawIntent) {
        String normalizedIntent = normalizeOptional(rawIntent);
        if (normalizedIntent == null) {
            return null;
        }
        try {
            return AiIntentType.valueOf(normalizedIntent.toUpperCase(Locale.ENGLISH));
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private AiAnswerMode parseMode(String rawMode) {
        String normalizedMode = normalizeOptional(rawMode);
        if (normalizedMode == null) {
            return null;
        }
        try {
            return AiAnswerMode.valueOf(normalizedMode.toUpperCase(Locale.ENGLISH));
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private AiProjection parseProjection(String rawProjection) {
        String normalizedProjection = normalizeOptional(rawProjection);
        if (normalizedProjection == null) {
            return null;
        }
        try {
            return AiProjection.valueOf(normalizedProjection.toUpperCase(Locale.ENGLISH));
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private Integer parseOptionalInteger(JsonNode node) {
        if (node == null || node.isNull()) {
            return null;
        }
        if (node.isInt() || node.isLong()) {
            return node.asInt();
        }
        String value = normalizeOptional(node.asText(null));
        if (value == null) {
            return null;
        }
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private Integer clampLimit(Integer limit) {
        if (limit == null || limit <= 0) {
            return 5;
        }
        return Math.min(limit, 10);
    }

    public List<String> getCompanyNameSample() {
        return companyRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(Company::getCompanyName)
                .filter(this::hasText)
                .limit(8)
                .toList();
    }

    private String resolveCompanyNameFromQuestion(String question) {
        String normalizedQuestion = normalizeOptional(question);
        if (normalizedQuestion == null) {
            return null;
        }

        List<Company> companies = companyRepository.findAllByOrderByCreatedAtDesc();
        String lowerQuestion = normalizedQuestion.toLowerCase(Locale.ENGLISH);

        Optional<Company> exactPhraseMatch = companies.stream()
                .filter(company -> lowerQuestion.contains(company.getCompanyName().toLowerCase(Locale.ENGLISH)))
                .findFirst();
        if (exactPhraseMatch.isPresent()) {
            return exactPhraseMatch.get().getCompanyName();
        }

        String canonicalQuestion = canonicalizeCompanyName(normalizedQuestion);
        List<Company> canonicalMatches = companies.stream()
                .filter(company -> {
                    String canonicalName = canonicalizeCompanyName(company.getCompanyName());
                    return !canonicalName.isEmpty()
                            && (canonicalQuestion.contains(canonicalName) || canonicalName.contains(canonicalQuestion));
                })
                .sorted(Comparator.comparingInt(company -> canonicalizeCompanyName(company.getCompanyName()).length()))
                .toList();
        if (!canonicalMatches.isEmpty()) {
            return canonicalMatches.get(0).getCompanyName();
        }

        return null;
    }

    private Integer extractYear(String question) {
        Matcher matcher = YEAR_PATTERN.matcher(question);
        if (matcher.find()) {
            try {
                return Integer.parseInt(matcher.group(1));
            } catch (NumberFormatException ignored) {
            }
        }
        return null;
    }

    private String extractBranch(String lowerQuestion) {
        String padded = " " + lowerQuestion + " ";
        if (containsAny(padded, " cse ", " computer science ")) {
            return "CSE";
        }
        if (containsAny(padded, " ece ", " electronics and communication ")) {
            return "ECE";
        }
        if (containsAny(padded, " eee ", " electrical and electronics ")) {
            return "EEE";
        }
        if (containsAny(padded, " it ", " information technology ")) {
            return "IT";
        }
        if (containsAny(padded, " civil ")) {
            return "CIVIL";
        }
        if (containsAny(padded, " mech ", " mechanical ")) {
            return "MECH";
        }
        return null;
    }

    private AiIntentResult unknownIntent(String originalQuestion) {
        return new AiIntentResult(
                AiIntentType.UNKNOWN,
                AiAnswerMode.SUMMARY,
                AiProjection.NONE,
                null,
                null,
                null,
                5,
                originalQuestion
        );
    }

    private boolean containsAny(String value, String... tokens) {
        for (String token : tokens) {
            if (value.contains(token)) {
                return true;
            }
        }
        return false;
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

    private boolean hasText(String value) {
        return normalizeOptional(value) != null;
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
}
