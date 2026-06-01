package com.iare.placementportal.controller;

import com.iare.placementportal.dto.NoticeRequest;
import com.iare.placementportal.dto.NoticeResponse;
import com.iare.placementportal.service.NoticeService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping
public class NoticeController {

    private final NoticeService noticeService;

    public NoticeController(NoticeService noticeService) {
        this.noticeService = noticeService;
    }

    @PostMapping("/api/admin/notices")
    @ResponseStatus(HttpStatus.CREATED)
    public NoticeResponse createNotice(@Valid @RequestBody NoticeRequest request) {
        return noticeService.createNotice(request);
    }

    @GetMapping("/api/admin/notices")
    public List<NoticeResponse> getAllNotices() {
        return noticeService.getAllNotices();
    }

    @PutMapping("/api/admin/notices/{id}")
    public NoticeResponse updateNotice(@PathVariable Long id, @Valid @RequestBody NoticeRequest request) {
        return noticeService.updateNotice(id, request);
    }

    @DeleteMapping("/api/admin/notices/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteNotice(@PathVariable Long id) {
        noticeService.deleteNotice(id);
    }

    @PatchMapping("/api/admin/notices/{id}/status")
    public NoticeResponse changeNoticeStatus(@PathVariable Long id, @RequestParam boolean active) {
        return noticeService.changeNoticeActiveStatus(id, active);
    }

    @PostMapping("/api/admin/notices/{id}/notify")
    public ResponseEntity<String> sendNoticeNotification(@PathVariable Long id) {
        return ResponseEntity.ok(noticeService.sendNoticeNotification(id));
    }

    @GetMapping("/api/student/notices/active")
    public List<NoticeResponse> getActiveNotices() {
        return noticeService.getActiveNoticesForStudents();
    }
}
