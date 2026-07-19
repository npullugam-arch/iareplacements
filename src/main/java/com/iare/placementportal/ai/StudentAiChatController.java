package com.iare.placementportal.ai;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/student")
public class StudentAiChatController {

    private final N8nAiChatService n8nAiChatService;

    public StudentAiChatController(N8nAiChatService n8nAiChatService) {
        this.n8nAiChatService = n8nAiChatService;
    }

    @PostMapping("/ai-chat")
    public StudentAiChatResponse chat(@Valid @RequestBody StudentAiChatRequest request, HttpServletRequest httpServletRequest) {
        String studentIdHeader = httpServletRequest.getHeader("X-Student-Id");
        if (studentIdHeader == null || studentIdHeader.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required.");
        }

        Long studentId;
        try {
            studentId = Long.parseLong(studentIdHeader.trim());
        } catch (NumberFormatException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid student session.");
        }

        String sessionId = String.valueOf(studentId);
        String reply = n8nAiChatService.getReply(request.message(), studentId, sessionId);
        return new StudentAiChatResponse(reply);
    }
}
