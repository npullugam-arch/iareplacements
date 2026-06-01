package com.iare.placementportal.service;

import com.iare.placementportal.dto.NoticeRequest;
import com.iare.placementportal.dto.NoticeResponse;
import com.iare.placementportal.entity.Notice;
import com.iare.placementportal.repository.NoticeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;

@Service
@Transactional
public class NoticeService {
    private static final Logger LOGGER = LoggerFactory.getLogger(NoticeService.class);

    private final NoticeRepository noticeRepository;

    public NoticeService(NoticeRepository noticeRepository) {
        this.noticeRepository = noticeRepository;
    }

    public NoticeResponse createNotice(NoticeRequest request) {
        validateDateRange(request);
        validateMessage(request.message());

        Notice notice = new Notice();
        mapRequestToEntity(request, notice);
        LOGGER.info("Notice create requested: title='{}', incomingMessage='{}', finalMessage='{}'",
                request.title(), request.message(), notice.getMessage());

        return toResponse(noticeRepository.save(notice));
    }

    @Transactional(readOnly = true)
    public List<NoticeResponse> getAllNotices() {
        return noticeRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<NoticeResponse> getActiveNoticesForStudents() {
        return noticeRepository.findCurrentlyActiveNotices(LocalDate.now())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public NoticeResponse updateNotice(Long id, NoticeRequest request) {
        validateDateRange(request);
        validateMessage(request.message());

        Notice notice = findNoticeOrThrow(id);
        String existingMessageBefore = notice.getMessage();
        mapRequestToEntity(request, notice);
        LOGGER.info("Notice update requested: id={}, title='{}', incomingMessage='{}', existingMessageBefore='{}', finalMessage='{}'",
                id, request.title(), request.message(), existingMessageBefore, notice.getMessage());

        return toResponse(noticeRepository.save(notice));
    }

    public void deleteNotice(Long id) {
        Notice notice = findNoticeOrThrow(id);
        noticeRepository.delete(notice);
    }

    public NoticeResponse changeNoticeActiveStatus(Long id, boolean active) {
        Notice notice = findNoticeOrThrow(id);
        notice.setActive(active);
        return toResponse(noticeRepository.save(notice));
    }

    public String sendNoticeNotification(Long id) {
        Notice notice = findNoticeOrThrow(id);
        LOGGER.info("Notice notification requested: id={}, title='{}', active={}, validFrom={}, validTo={}",
                notice.getId(), notice.getTitle(), notice.getActive(), notice.getValidFrom(), notice.getValidTo());

        return "Notification sent successfully for notice: " + notice.getTitle();
    }

    private Notice findNoticeOrThrow(Long id) {
        return noticeRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Notice not found."));
    }

    private void mapRequestToEntity(NoticeRequest request, Notice notice) {
        notice.setTitle(request.title().trim());
        notice.setMessage(normalizeMeaningfulText(request.message()));
        notice.setValidFrom(request.validFrom());
        notice.setValidTo(request.validTo());
        if (notice.getActive() == null) {
            notice.setActive(true);
        }
    }

    private void validateDateRange(NoticeRequest request) {
        if (request.validFrom() != null && request.validTo() != null && request.validTo().isBefore(request.validFrom())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Valid To Date must be greater than or equal to Valid From Date."
            );
        }
    }

    private void validateMessage(String message) {
        if (normalizeMeaningfulText(message) == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Message is required.");
        }
    }

    private String normalizeMeaningfulText(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            return null;
        }

        String normalized = trimmed.toLowerCase();
        if ("n/a".equals(normalized) || "na".equals(normalized) || "-".equals(trimmed) || "null".equals(normalized)) {
            return null;
        }

        return trimmed;
    }

    private NoticeResponse toResponse(Notice notice) {
        return new NoticeResponse(
                notice.getId(),
                notice.getTitle(),
                notice.getMessage(),
                notice.getValidFrom(),
                notice.getValidTo(),
                notice.getCreatedAt(),
                notice.getUpdatedAt(),
                notice.getActive(),
                resolveStatus(notice)
        );
    }

    private String resolveStatus(Notice notice) {
        if (!Boolean.TRUE.equals(notice.getActive())) {
            return "Disabled";
        }

        LocalDate today = LocalDate.now();
        if (today.isBefore(notice.getValidFrom())) {
            return "Upcoming";
        }
        if (today.isAfter(notice.getValidTo())) {
            return "Expired";
        }
        return "Active";
    }
}
