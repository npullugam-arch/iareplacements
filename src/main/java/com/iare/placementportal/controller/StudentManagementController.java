package com.iare.placementportal.controller;

import com.iare.placementportal.dto.StudentExcelUploadResponse;
import com.iare.placementportal.dto.StudentLoginRequest;
import com.iare.placementportal.dto.StudentLoginResponse;
import com.iare.placementportal.dto.StudentResponse;
import com.iare.placementportal.service.StudentService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping
public class StudentManagementController {

    private final StudentService studentService;

    public StudentManagementController(StudentService studentService) {
        this.studentService = studentService;
    }

    @PostMapping(value = "/api/admin/students/upload-excel", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public StudentExcelUploadResponse uploadStudents(@RequestParam("file") MultipartFile file) {
        return studentService.uploadStudentsFromExcel(file);
    }

    @GetMapping("/api/admin/students")
    public List<StudentResponse> getAllStudents() {
        return studentService.getAllStudents();
    }

    @GetMapping("/api/admin/students/{id}")
    public StudentResponse getStudentById(@PathVariable Long id) {
        return studentService.getStudentById(id);
    }

    @GetMapping("/api/admin/students/roll/{rollNo}")
    public StudentResponse getStudentByRollNo(@PathVariable String rollNo) {
        return studentService.getStudentByRollNo(rollNo);
    }

    @PatchMapping("/api/admin/students/{id}/status")
    public StudentResponse changeStudentStatus(@PathVariable Long id, @RequestParam boolean active) {
        return studentService.changeStudentActiveStatus(id, active);
    }

    @DeleteMapping("/api/admin/students/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteStudent(@PathVariable Long id) {
        studentService.deleteStudent(id);
    }

    @PostMapping("/api/student/auth/login")
    public StudentLoginResponse studentLogin(@RequestBody StudentLoginRequest request) {
        return studentService.studentLogin(request);
    }

    @GetMapping("/api/student/profile/{id}")
    public StudentResponse getStudentProfile(@PathVariable Long id) {
        return studentService.getStudentById(id);
    }

    @GetMapping("/api/student/profile/roll/{rollNo}")
    public StudentResponse getStudentProfileByRollNo(@PathVariable String rollNo) {
        return studentService.getStudentByRollNo(rollNo);
    }
}
