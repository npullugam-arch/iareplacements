package com.iare.placementportal.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iare.placementportal.entity.Company;
import com.iare.placementportal.repository.CompanyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.ArrayList;
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
    private static final List<String> QUESTION_STOP_WORDS = List.of(
            "is", "there", "for", "the", "a", "an", "of", "to", "in", "on", "at", "show", "any",
            "please", "can", "you", "me", "details", "company", "companies", "resources", "resource", "materials",
            "material", "pdf", "pdfs", "preparation", "study", "about", "with", "and", "or", "do", "have",
            "tell", "what", "which", "how", "many", "are", "their", "them", "those", "this", "that"
    );
    private static final String INTENT_SYSTEM_PROMPT = """
            You are an intent extractor for the IARE AI Placement Portal.
            The portal is for Institute of Aeronautical Engineering placement and training data.
            Return only valid JSON. Do not return markdown, code fences, explanations, or extra text.
            """;
    private static final String INTENT_USER_PROMPT_TEMPLATE = """
            Extract a JSON object for this student question.

            Allowed intent values:
            COMPANY_INFO
            SELECTED_STUDENTS_BY_COMPANY
            SELECTED_COUNT_BY_COMPANY
            COMPANY_VISIT_COUNT_BY_YEAR
            COMPANIES_VISITED_BY_YEAR
            HIGHEST_PACKAGE_BY_YEAR
            AVERAGE_PACKAGE_BY_YEAR
            DRIVE_DETAILS_BY_COMPANY
            PLACEMENT_STATISTICS_BY_COMPANY
            ACTIVE_NOTICES
            RESOURCES_BY_COMPANY
            GENERAL_CHAT
            UNKNOWN

            Allowed entity values:
            PORTAL
            COMPANY
            PLACEMENT_DRIVE
            PLACEMENT_STATISTICS
            SELECTED_STUDENT
            RESOURCE
            NOTICE
            INTERVIEW_EXPERIENCE
            MOCK_INTERVIEW
            UNKNOWN

            Allowed answerMode values:
            COUNT
            LIST
            DETAIL
            SUMMARY

            Return exactly this JSON shape:
            {
              "intent": "GENERAL_CHAT",
              "entity": "UNKNOWN",
              "answerMode": "SUMMARY",
              "company": null,
              "year": null,
              "branch": null,
              "limit": 5,
              "originalQuestion": ""
            }

            Student question:
            %s
            """;

    private final OllamaAiService ollamaAiService;
    private final ObjectMapper objectMapper;
    private final CompanyRepository companyRepository;

    public AiIntentService(OllamaAiService ollamaAiService,
                           ObjectMapper objectMapper,
                           CompanyRepository companyRepository) {
        this.ollamaAiService = ollamaAiService;
        this.objectMapper = objectMapper;
        this.companyRepository = companyRepository;
    }

    public AiIntentResult extractIntent(String userQuestion) {
        String normalizedQuestion = userQuestion == null ? "" : userQuestion.trim();
        if (normalizedQuestion.isEmpty()) {
            return buildIntent(AiIntentType.UNKNOWN, AiEntityType.UNKNOWN, AiAnswerMode.SUMMARY,
                    null, null, null, 5, "");
        }

        AiIntentResult ruleBasedIntent = parseIntentRuleBased(normalizedQuestion);
        if (ruleBasedIntent.intent() != AiIntentType.UNKNOWN) {
            LOGGER.info("AI intent resolved by semantic Java parser: intent={}, entity={}, mode={}, company='{}', year={}, branch='{}', limit={}",
                    ruleBasedIntent.intent(), ruleBasedIntent.entity(), ruleBasedIntent.answerMode(),
                    ruleBasedIntent.company(), ruleBasedIntent.year(), ruleBasedIntent.branch(), ruleBasedIntent.limit());
            return ruleBasedIntent;
        }

        if (!isPortalQuestion(normalizedQuestion)) {
            return buildIntent(AiIntentType.GENERAL_CHAT, AiEntityType.UNKNOWN, AiAnswerMode.SUMMARY,
                    null, null, null, 5, normalizedQuestion);
        }

        try {
            String aiResponse = ollamaAiService.generateText(
                    INTENT_SYSTEM_PROMPT,
                    INTENT_USER_PROMPT_TEMPLATE.formatted(normalizedQuestion),
                    0.0,
                    260
            );
            AiIntentResult aiIntent = parseIntentResponse(aiResponse, normalizedQuestion);
            AiIntentResult normalizedIntent = mergeCompanyAndYearFallbacks(aiIntent, normalizedQuestion);
            if (normalizedIntent.intent() != AiIntentType.UNKNOWN && normalizedIntent.intent() != AiIntentType.GENERAL_CHAT) {
                LOGGER.info("AI intent extracted by Ollama fallback: intent={}, entity={}, mode={}, company='{}', year={}, branch='{}', limit={}",
                        normalizedIntent.intent(), normalizedIntent.entity(), normalizedIntent.answerMode(),
                        normalizedIntent.company(), normalizedIntent.year(), normalizedIntent.branch(), normalizedIntent.limit());
                return normalizedIntent;
            }
        } catch (IllegalStateException exception) {
            LOGGER.warn("Intent extraction via Ollama unavailable. Falling back to semantic parser.");
        } catch (Exception exception) {
            LOGGER.warn("Intent extraction via Ollama returned unreadable output. Falling back to semantic parser.", exception);
        }

        AiIntentResult fallbackIntent = parseIntentRuleBased(normalizedQuestion);
        LOGGER.info("AI intent fallback result: intent={}, entity={}, mode={}, company='{}', year={}, branch='{}', limit={}",
                fallbackIntent.intent(), fallbackIntent.entity(), fallbackIntent.answerMode(),
                fallbackIntent.company(), fallbackIntent.year(), fallbackIntent.branch(), fallbackIntent.limit());
        return fallbackIntent;
    }

    private AiIntentResult parseIntentRuleBased(String question) {
        String lower = question.toLowerCase(Locale.ENGLISH);
        String company = resolveCompanyNameFromQuestion(question);
        Integer year = extractYear(question);
        String branch = extractBranch(lower);
        Integer limit = extractLimit(lower);

        if (isPortalIdentityQuestion(lower)) {
            return buildIntent(AiIntentType.GENERAL_CHAT, AiEntityType.PORTAL, AiAnswerMode.DETAIL,
                    null, null, null, limit, question);
        }

        if (containsAny(lower, "notice", "notices", "notification", "notifications", "announcement", "announcements")) {
            AiAnswerMode mode = containsAny(lower, "how many", "count", "number of") ? AiAnswerMode.COUNT : AiAnswerMode.LIST;
            return buildIntent(AiIntentType.ACTIVE_NOTICES, AiEntityType.NOTICE, mode, null, year, branch, limit, question);
        }

        if (containsAny(lower, "resource", "resources", "material", "materials", "pdf", "pdfs",
                "preparation resource", "prep resource", "study material", "prep material")) {
            return buildIntent(company == null ? AiIntentType.UNKNOWN : AiIntentType.RESOURCES_BY_COMPANY,
                    AiEntityType.RESOURCE,
                    containsAny(lower, "how many", "count", "number of") ? AiAnswerMode.COUNT : AiAnswerMode.LIST,
                    company, year, branch, limit, question);
        }

        if (containsAny(lower, "highest package", "max package", "top package")) {
            return buildIntent(AiIntentType.HIGHEST_PACKAGE_BY_YEAR, AiEntityType.PLACEMENT_STATISTICS, AiAnswerMode.SUMMARY,
                    company, year, branch, limit, question);
        }

        if (containsAny(lower, "average package", "avg package", "mean package")) {
            return buildIntent(AiIntentType.AVERAGE_PACKAGE_BY_YEAR, AiEntityType.PLACEMENT_STATISTICS, AiAnswerMode.SUMMARY,
                    company, year, branch, limit, question);
        }

        if (containsAny(lower, "statistics", "stats", "placement statistics")) {
            return buildIntent(company == null ? AiIntentType.UNKNOWN : AiIntentType.PLACEMENT_STATISTICS_BY_COMPANY,
                    AiEntityType.PLACEMENT_STATISTICS,
                    containsAny(lower, "tell me about", "summary", "overview") ? AiAnswerMode.SUMMARY : AiAnswerMode.DETAIL,
                    company, year, branch, limit, question);
        }

        if (containsAny(lower, "visited", "visit", "came")) {
            if (containsAny(lower, "how many", "count", "number of")) {
                return buildIntent(AiIntentType.COMPANY_VISIT_COUNT_BY_YEAR, AiEntityType.PLACEMENT_DRIVE, AiAnswerMode.COUNT,
                        company, year, branch, limit, question);
            }
            return buildIntent(AiIntentType.COMPANIES_VISITED_BY_YEAR, AiEntityType.PLACEMENT_DRIVE, AiAnswerMode.LIST,
                    company, year, branch, limit, question);
        }

        if (containsAny(lower, "drive", "drives", "hiring", "recruitment")) {
            return buildIntent(company == null ? AiIntentType.UNKNOWN : AiIntentType.DRIVE_DETAILS_BY_COMPANY,
                    AiEntityType.PLACEMENT_DRIVE,
                    containsAny(lower, "how many", "count", "number of") ? AiAnswerMode.COUNT : AiAnswerMode.LIST,
                    company, year, branch, limit, question);
        }

        if (containsAny(lower, "selected", "select ayyaru", "got selected", "placed", "students placed", "evaru")) {
            boolean countLike = containsAny(lower, "how many", "count", "number of");
            return buildIntent(company == null ? AiIntentType.UNKNOWN : (countLike ? AiIntentType.SELECTED_COUNT_BY_COMPANY : AiIntentType.SELECTED_STUDENTS_BY_COMPANY),
                    AiEntityType.SELECTED_STUDENT,
                    countLike ? AiAnswerMode.COUNT : AiAnswerMode.LIST,
                    company, year, branch, limit, question);
        }

        if ((company != null && containsAny(lower, "tell me about", "about", "company details", "is ")) || company != null) {
            if (containsAny(lower, "is ", "is there", "does", "exist")) {
                return buildIntent(AiIntentType.COMPANY_INFO, AiEntityType.COMPANY, AiAnswerMode.COUNT, company, year, branch, limit, question);
            }
            if (containsAny(lower, "tell me about", "about", "details", "company details", "what is")) {
                return buildIntent(AiIntentType.COMPANY_INFO, AiEntityType.COMPANY, AiAnswerMode.DETAIL, company, year, branch, limit, question);
            }
        }

        if (containsAny(lower, "company", "companies", "student", "students", "portal", "website", "iare")) {
            return buildIntent(AiIntentType.UNKNOWN, AiEntityType.UNKNOWN, AiAnswerMode.SUMMARY, company, year, branch, limit, question);
        }

        return buildIntent(AiIntentType.GENERAL_CHAT, AiEntityType.UNKNOWN, AiAnswerMode.SUMMARY,
                null, null, null, limit, question);
    }

    private AiIntentResult mergeCompanyAndYearFallbacks(AiIntentResult aiIntent, String question) {
        String company = aiIntent.company() != null ? resolveCompanyNameFromQuestion(aiIntent.company()) : resolveCompanyNameFromQuestion(question);
        Integer year = aiIntent.year() != null ? aiIntent.year() : extractYear(question);
        String branch = aiIntent.branch() != null ? aiIntent.branch() : extractBranch(question.toLowerCase(Locale.ENGLISH));
        AiEntityType entity = aiIntent.entity() == null ? AiEntityType.UNKNOWN : aiIntent.entity();
        AiAnswerMode answerMode = aiIntent.answerMode() == null ? AiAnswerMode.SUMMARY : aiIntent.answerMode();
        return buildIntent(aiIntent.intent(), entity, answerMode, company, year, branch, aiIntent.limit(), question);
    }

    private boolean isPortalQuestion(String question) {
        String lower = question.toLowerCase(Locale.ENGLISH);
        return containsAny(lower,
                "selected", "placed", "students", "company", "companies", "visited", "visit", "came",
                "package", "drive", "drives", "statistics", "stats", "notice", "notices",
                "notification", "resource", "resources", "material", "portal", "website", "iare",
                "mock interview", "interview experience");
    }

    private boolean isPortalIdentityQuestion(String lower) {
        return containsAny(lower,
                "portal name", "website name", "what is this website", "what is this portal",
                "what is this placement portal", "what is iare", "iare full form");
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

        List<String> candidates = buildCandidateCompanyTokens(normalizedQuestion);
        for (String candidate : candidates) {
            String canonicalCandidate = canonicalizeCompanyName(candidate);
            if (canonicalCandidate.isEmpty()) {
                continue;
            }

            List<Company> fuzzyMatches = companies.stream()
                    .filter(company -> isHighConfidenceFuzzyMatch(canonicalCandidate, canonicalizeCompanyName(company.getCompanyName())))
                    .sorted(Comparator.comparingInt(company -> levenshteinDistance(canonicalCandidate, canonicalizeCompanyName(company.getCompanyName()))))
                    .toList();
            if (!fuzzyMatches.isEmpty()) {
                return fuzzyMatches.get(0).getCompanyName();
            }
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

    private Integer extractLimit(String lowerQuestion) {
        if (containsAny(lowerQuestion, "top 10")) {
            return 10;
        }
        if (containsAny(lowerQuestion, "top 3")) {
            return 3;
        }
        return 5;
    }

    private AiIntentResult parseIntentResponse(String aiResponse, String originalQuestion) throws IOException {
        JsonNode rootNode = objectMapper.readTree(extractJsonPayload(aiResponse));

        return buildIntent(
                parseIntent(rootNode.path("intent").asText(null)),
                parseEntity(rootNode.path("entity").asText(null)),
                parseAnswerMode(rootNode.path("answerMode").asText(null)),
                normalizeOptional(rootNode.path("company").asText(null)),
                parseOptionalInteger(rootNode.path("year")),
                normalizeOptional(rootNode.path("branch").asText(null)),
                clampLimit(parseOptionalInteger(rootNode.path("limit"))),
                normalizeOptional(rootNode.path("originalQuestion").asText(null)) == null ? originalQuestion : normalizeOptional(rootNode.path("originalQuestion").asText(null))
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
            return AiIntentType.UNKNOWN;
        }
        try {
            return AiIntentType.valueOf(normalizedIntent.toUpperCase(Locale.ENGLISH));
        } catch (IllegalArgumentException exception) {
            return AiIntentType.UNKNOWN;
        }
    }

    private AiEntityType parseEntity(String rawEntity) {
        String normalizedEntity = normalizeOptional(rawEntity);
        if (normalizedEntity == null) {
            return AiEntityType.UNKNOWN;
        }
        try {
            return AiEntityType.valueOf(normalizedEntity.toUpperCase(Locale.ENGLISH));
        } catch (IllegalArgumentException exception) {
            return AiEntityType.UNKNOWN;
        }
    }

    private AiAnswerMode parseAnswerMode(String rawAnswerMode) {
        String normalizedAnswerMode = normalizeOptional(rawAnswerMode);
        if (normalizedAnswerMode == null) {
            return AiAnswerMode.SUMMARY;
        }
        try {
            return AiAnswerMode.valueOf(normalizedAnswerMode.toUpperCase(Locale.ENGLISH));
        } catch (IllegalArgumentException exception) {
            return AiAnswerMode.SUMMARY;
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

    private AiIntentResult buildIntent(AiIntentType intent,
                                       AiEntityType entity,
                                       AiAnswerMode answerMode,
                                       String company,
                                       Integer year,
                                       String branch,
                                       Integer limit,
                                       String originalQuestion) {
        return new AiIntentResult(intent, entity, answerMode, company, year, branch, limit, originalQuestion);
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

    private List<String> buildCandidateCompanyTokens(String question) {
        String[] rawTokens = question.toLowerCase(Locale.ENGLISH)
                .replaceAll("[^a-z0-9\\s]", " ")
                .trim()
                .split("\\s+");

        List<String> filteredTokens = new ArrayList<>();
        for (String token : rawTokens) {
            if (!token.isBlank() && !QUESTION_STOP_WORDS.contains(token)) {
                filteredTokens.add(token);
            }
        }

        List<String> candidates = new ArrayList<>();
        for (int index = 0; index < filteredTokens.size(); index++) {
            candidates.add(filteredTokens.get(index));
            if (index + 1 < filteredTokens.size()) {
                candidates.add(filteredTokens.get(index) + filteredTokens.get(index + 1));
                candidates.add(filteredTokens.get(index) + " " + filteredTokens.get(index + 1));
            }
        }
        return candidates;
    }

    private boolean isHighConfidenceFuzzyMatch(String source, String target) {
        if (source.isEmpty() || target.isEmpty()) {
            return false;
        }
        int distance = levenshteinDistance(source, target);
        int maxLength = Math.max(source.length(), target.length());
        if (maxLength <= 4) {
            return distance == 0;
        }
        if (maxLength <= 7) {
            return distance <= 1;
        }
        return distance <= 2;
    }

    private int levenshteinDistance(String source, String target) {
        int[][] dp = new int[source.length() + 1][target.length() + 1];
        for (int i = 0; i <= source.length(); i++) {
            dp[i][0] = i;
        }
        for (int j = 0; j <= target.length(); j++) {
            dp[0][j] = j;
        }
        for (int i = 1; i <= source.length(); i++) {
            for (int j = 1; j <= target.length(); j++) {
                int cost = source.charAt(i - 1) == target.charAt(j - 1) ? 0 : 1;
                dp[i][j] = Math.min(
                        Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1),
                        dp[i - 1][j - 1] + cost
                );
            }
        }
        return dp[source.length()][target.length()];
    }
}
