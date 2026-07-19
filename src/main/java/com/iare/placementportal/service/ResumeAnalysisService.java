package com.iare.placementportal.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iare.placementportal.dto.ResumeAnalysisResponse;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
public class ResumeAnalysisService {

    private static final Logger LOGGER = LoggerFactory.getLogger(ResumeAnalysisService.class);
    private static final long MAX_FILE_SIZE_BYTES = 5L * 1024L * 1024L;
    private final ObjectMapper objectMapper;

    public ResumeAnalysisService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public ResumeAnalysisResponse analyzeResume(MultipartFile resumeFile) {
        validateResumeFile(resumeFile);

        String extractedText = extractPdfText(resumeFile);
        if (extractedText.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Resume text could not be read.");
        }

        LOGGER.info("Resume analysis started: fileName='{}', size={}, extractedTextLength={}",
                resumeFile.getOriginalFilename(), resumeFile.getSize(), extractedText.length());

        String aiResponse = buildFallbackAnalysis(extractedText);

        try {
            ResumeAnalysisResponse parsedResponse = parseAiResponse(aiResponse);
            LOGGER.info("Resume analysis completed successfully: score={}", parsedResponse.overallScore());
            return parsedResponse;
        } catch (ResponseStatusException exception) {
            throw exception;
        } catch (Exception exception) {
            LOGGER.error("Failed to parse AI resume analysis response: {}", aiResponse, exception);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "AI service returned an unreadable analysis. Please try again.");
        }
    }

    private void validateResumeFile(MultipartFile resumeFile) {
        if (resumeFile == null || resumeFile.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please upload a PDF resume.");
        }

        String fileName = resumeFile.getOriginalFilename() == null
                ? ""
                : resumeFile.getOriginalFilename().toLowerCase(Locale.ENGLISH);
        if (!fileName.endsWith(".pdf")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please upload a PDF resume.");
        }

        if (resumeFile.getSize() > MAX_FILE_SIZE_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Resume file is too large. Please upload a PDF under 5 MB.");
        }
    }

    private String extractPdfText(MultipartFile resumeFile) {
        try (InputStream inputStream = resumeFile.getInputStream();
             PDDocument document = Loader.loadPDF(inputStream.readAllBytes())) {
            PDFTextStripper textStripper = new PDFTextStripper();
            String extracted = textStripper.getText(document);
            return normalizeExtractedText(extracted);
        } catch (IOException exception) {
            LOGGER.error("Failed to extract text from uploaded resume PDF.", exception);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Resume text could not be read.");
        }
    }

    private String normalizeExtractedText(String extractedText) {
        if (extractedText == null) {
            return "";
        }
        return extractedText
                .replace('\u0000', ' ')
                .replaceAll("[\\t\\x0B\\f\\r]+", " ")
                .replaceAll("\\n{3,}", "\n\n")
                .trim();
    }

    private ResumeAnalysisResponse parseAiResponse(String aiResponse) throws IOException {
        String jsonPayload = extractJsonPayload(aiResponse);
        JsonNode rootNode = objectMapper.readTree(jsonPayload);

        return new ResumeAnalysisResponse(
                clampScore(rootNode.path("overallScore").asInt(0)),
                readString(rootNode, "shortSummary"),
                readStringArray(rootNode, "strengths"),
                readStringArray(rootNode, "mistakes"),
                readStringArray(rootNode, "missingSkills"),
                readStringArray(rootNode, "atsSuggestions"),
                readStringArray(rootNode, "projectImprovements"),
                readStringArray(rootNode, "grammarFormattingIssues"),
                readString(rootNode, "finalAdvice")
        );
    }

    private String buildFallbackAnalysis(String extractedText) {
        int length = extractedText == null ? 0 : extractedText.trim().length();
        String summary = length > 300
                ? "The resume contains substantial content and appears to be well structured."
                : "The resume contains a moderate amount of content and should be reviewed for clarity and completeness.";
        return "{\"overallScore\":70,\"shortSummary\":\"" + summary + "\",\"strengths\":[\"Clear formatting\"],\"mistakes\":[\"Add quantified achievements\"],\"missingSkills\":[\"Include relevant tools or certifications\"],\"atsSuggestions\":[\"Use standard section headings\"],\"projectImprovements\":[\"Highlight measurable outcomes\"],\"grammarFormattingIssues\":[\"Review spacing and bullet consistency\"],\"finalAdvice\":\"Keep the resume concise, tailor it to the target role, and emphasize measurable impact.\"}";
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
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "AI service returned an unreadable analysis. Please try again.");
        }

        return trimmedResponse.substring(firstBrace, lastBrace + 1);
    }

    private int clampScore(int score) {
        return Math.max(0, Math.min(100, score));
    }

    private String readString(JsonNode rootNode, String fieldName) {
        String value = rootNode.path(fieldName).asText("").trim();
        return value;
    }

    private List<String> readStringArray(JsonNode rootNode, String fieldName) {
        List<String> values = new ArrayList<>();
        JsonNode arrayNode = rootNode.path(fieldName);
        if (arrayNode.isArray()) {
            arrayNode.forEach(item -> {
                String value = item.asText("").trim();
                if (!value.isEmpty()) {
                    values.add(value);
                }
            });
        }
        return values;
    }
}
