package com.iare.placementportal.ai;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class N8nAiChatService {

    private static final Logger LOGGER = LoggerFactory.getLogger(N8nAiChatService.class);
    private static final String FALLBACK_MESSAGE = "Sorry, the placement assistant is temporarily unavailable. Please try again.";

    private final RestTemplate restTemplate;
    private final String webhookUrl;

    public N8nAiChatService(
            @Qualifier("n8nRestTemplate") RestTemplate restTemplate,
            @Value("${n8n.placement-chatbot.webhook-url}") String webhookUrl
    ) {
        this.restTemplate = restTemplate;
        this.webhookUrl = webhookUrl;
    }

    public String getReply(String message, Long studentId, String sessionId) {
        String trimmedMessage = message == null ? "" : message.trim();
        if (trimmedMessage.isEmpty()) {
            return FALLBACK_MESSAGE;
        }

        if (webhookUrl == null || webhookUrl.isBlank()) {
            LOGGER.warn("n8n chatbot webhook URL is not configured.");
            return FALLBACK_MESSAGE;
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("message", trimmedMessage);
        payload.put("studentId", studentId == null ? "" : String.valueOf(studentId));
        payload.put("sessionId", sessionId == null || sessionId.isBlank() ? String.valueOf(studentId) : sessionId);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);

        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    webhookUrl,
                    HttpMethod.POST,
                    entity,
                    Map.class
            );

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                LOGGER.warn("n8n chatbot webhook returned unexpected response: status={}", response.getStatusCode());
                return FALLBACK_MESSAGE;
            }

            Object success = response.getBody().get("success");
            Object reply = response.getBody().get("reply");
            if (!Boolean.TRUE.equals(success)) {
                LOGGER.warn("n8n chatbot webhook returned unsuccessful payload: {}", response.getBody());
                return FALLBACK_MESSAGE;
            }

            String replyText = reply == null ? "" : String.valueOf(reply).trim();
            if (replyText.isEmpty()) {
                LOGGER.warn("n8n chatbot webhook returned an empty reply.");
                return FALLBACK_MESSAGE;
            }

            return replyText;
        } catch (RestClientException exception) {
            LOGGER.warn("n8n chatbot webhook request failed.", exception);
            return FALLBACK_MESSAGE;
        }
    }
}
