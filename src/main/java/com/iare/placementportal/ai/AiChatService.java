package com.iare.placementportal.ai;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class AiChatService {

    private static final Logger LOGGER = LoggerFactory.getLogger(AiChatService.class);

    private final N8nAiChatService n8nAiChatService;

    public AiChatService(N8nAiChatService n8nAiChatService) {
        this.n8nAiChatService = n8nAiChatService;
    }

    public AiChatResponse chat(String studentMessage) {
        String normalizedMessage = studentMessage == null ? "" : studentMessage.trim();
        LOGGER.info("AI chat question received: '{}'", normalizedMessage);
        String reply = n8nAiChatService.getReply(normalizedMessage, null, null);
        return new AiChatResponse(reply);
    }
}
