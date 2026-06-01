package com.iare.placementportal.ai;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AiChatService {

    private static final Logger LOGGER = LoggerFactory.getLogger(AiChatService.class);
    private static final String CLARIFICATION_MESSAGE = """
            I can help with placement portal data like selected students, company visits, packages, drives, notices, and resources.
            Please mention the company or year you want me to check.
            """.trim();
    private static final String PORTAL_NAME_ANSWER = "The portal name is IARE AI Placement Portal.";
    private static final String PORTAL_IDENTITY_ANSWER = """
            This website is the IARE AI Placement Portal for the Institute of Aeronautical Engineering.
            It helps students and admins manage companies, placement drives, statistics, selected students, notices, resources, resume analysis, AI chatbot support, and mock interviews.
            """.trim();
    private static final String IARE_FULL_FORM_ANSWER = "IARE stands for Institute of Aeronautical Engineering.";
    private static final String IARE_ANSWER = "IARE stands for Institute of Aeronautical Engineering.";
    private static final String PORTAL_PURPOSE_ANSWER = """
            This is the IARE AI Placement Portal, a placement and training portal for Institute of Aeronautical Engineering.
            It supports companies, placement drives, placement statistics, selected students, notices, resources, interview experiences, mock interviews, resume analysis, and AI chatbot help.
            """.trim();

    private final OllamaAiService ollamaAiService;
    private final AiIntentService aiIntentService;
    private final PlacementAiDataService placementAiDataService;

    public AiChatService(OllamaAiService ollamaAiService,
                         AiIntentService aiIntentService,
                         PlacementAiDataService placementAiDataService) {
        this.ollamaAiService = ollamaAiService;
        this.aiIntentService = aiIntentService;
        this.placementAiDataService = placementAiDataService;
    }

    public AiChatResponse chat(String studentMessage) {
        long startTime = System.currentTimeMillis();
        String normalizedMessage = studentMessage == null ? "" : studentMessage.trim();
        LOGGER.info("AI chat question received: '{}'", normalizedMessage);

        String portalIdentityAnswer = answerPortalIdentityQuestion(normalizedMessage);
        if (portalIdentityAnswer != null) {
            LOGGER.info("AI chat flow used: PORTAL_CONTEXT");
            LOGGER.info("AI chat completed: flow=PORTAL_CONTEXT, totalTimeMs={}",
                    System.currentTimeMillis() - startTime);
            return new AiChatResponse(portalIdentityAnswer);
        }

        AiIntentResult intent = aiIntentService.extractIntent(normalizedMessage);

        LOGGER.info("AI chat routing: intent={}, entity={}, answerMode={}, company='{}', year={}, branch='{}', limit={}",
                intent.intent(), intent.entity(), intent.answerMode(), intent.company(), intent.year(), intent.branch(), intent.limit());

        if (intent.intent() == AiIntentType.GENERAL_CHAT) {
            LOGGER.info("AI chat flow used: GENERAL_CHAT");
            AiChatResponse response = ollamaAiService.chat(normalizedMessage);
            LOGGER.info("AI chat completed: flow=GENERAL_CHAT, totalTimeMs={}",
                    System.currentTimeMillis() - startTime);
            return response;
        }
        if (intent.intent() == AiIntentType.UNKNOWN) {
            LOGGER.info("AI clarification required: question='{}', intent={}, company='{}', year={}, normalized='{}', companySample={}",
                    normalizedMessage,
                    intent.intent(),
                    intent.company(),
                    intent.year(),
                    normalizedMessage.toLowerCase(),
                    aiIntentService.getCompanyNameSample());
            LOGGER.info("AI chat flow used: CLARIFICATION");
            LOGGER.info("AI chat completed: flow=CLARIFICATION, totalTimeMs={}",
                    System.currentTimeMillis() - startTime);
            return new AiChatResponse(CLARIFICATION_MESSAGE);
        }

        try {
            LOGGER.info("AI chat flow used: DB");
            String dbAnswer = placementAiDataService.answerPortalQuestion(intent);
            LOGGER.info("AI DB answer result: {}", dbAnswer);
            LOGGER.info("AI chat completed: flow=DB, totalTimeMs={}",
                    System.currentTimeMillis() - startTime);
            return new AiChatResponse(dbAnswer);
        } catch (ResponseStatusException exception) {
            if (exception.getStatusCode() == HttpStatus.BAD_REQUEST
                    || exception.getStatusCode() == HttpStatus.NOT_FOUND) {
                LOGGER.info("AI clarification/error result: question='{}', intent={}, company='{}', year={}, normalized='{}', companySample={}",
                        normalizedMessage,
                        intent.intent(),
                        intent.company(),
                        intent.year(),
                        normalizedMessage.toLowerCase(),
                        aiIntentService.getCompanyNameSample());
                LOGGER.info("AI DB clarification/error result: {}", exception.getReason());
                LOGGER.info("AI chat completed: flow=DB-CLARIFICATION, totalTimeMs={}",
                        System.currentTimeMillis() - startTime);
                return new AiChatResponse(exception.getReason() == null ? CLARIFICATION_MESSAGE : exception.getReason());
            }
            LOGGER.error("AI portal data answer failed.", exception);
            LOGGER.info("AI chat completed: flow=DB-ERROR, totalTimeMs={}",
                    System.currentTimeMillis() - startTime);
            return new AiChatResponse("I could not read portal data right now. Please try again in a moment.");
        } catch (Exception exception) {
            LOGGER.error("AI chat flow failed unexpectedly.", exception);
            LOGGER.info("AI chat completed: flow=ERROR, totalTimeMs={}",
                    System.currentTimeMillis() - startTime);
            return new AiChatResponse("I could not process that request right now. Please try again.");
        }
    }

    private String answerPortalIdentityQuestion(String question) {
        String lower = question == null ? "" : question.toLowerCase();
        if (lower.isBlank()) {
            return null;
        }
        if (lower.contains("portal name") || lower.contains("website name")) {
            return PORTAL_NAME_ANSWER;
        }
        if (lower.contains("iare full form") || (lower.contains("what is iare") && lower.contains("full form"))) {
            return IARE_FULL_FORM_ANSWER;
        }
        if (lower.contains("what is iare")) {
            return IARE_ANSWER;
        }
        if (lower.contains("what is this website") || lower.contains("what is this portal")
                || lower.contains("what is this placement portal")) {
            return PORTAL_PURPOSE_ANSWER;
        }
        if (lower.contains("what is the portal") || lower.contains("what is this ai placement portal")) {
            return PORTAL_PURPOSE_ANSWER;
        }
        return null;
    }
}
