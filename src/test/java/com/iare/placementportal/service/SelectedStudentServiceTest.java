package com.iare.placementportal.service;

import com.iare.placementportal.dto.SelectedStudentRequest;
import com.iare.placementportal.dto.SelectedStudentResponse;
import com.iare.placementportal.entity.Company;
import com.iare.placementportal.entity.PlacementDrive;
import com.iare.placementportal.repository.CompanyRepository;
import com.iare.placementportal.repository.PlacementDriveRepository;
import com.iare.placementportal.repository.SelectedStudentRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class SelectedStudentServiceTest {

    @Autowired
    private SelectedStudentService selectedStudentService;

    @Autowired
    private SelectedStudentRepository selectedStudentRepository;

    @Autowired
    private PlacementDriveRepository placementDriveRepository;

    @Autowired
    private CompanyRepository companyRepository;

    @AfterEach
    void tearDown() {
        selectedStudentRepository.deleteAll();
        placementDriveRepository.deleteAll();
        companyRepository.deleteAll();
    }

    @Test
    void createSelectedStudentSavesWithoutSectionField() {
        Company company = new Company();
        company.setCompanyName("Microsoft");
        company.setCompanyType("Product");
        company.setIndustry("Software");
        company.setDescription("Technology company");
        company.setActive(true);
        company = companyRepository.save(company);

        PlacementDrive drive = new PlacementDrive();
        drive.setCompany(company);
        drive.setDriveTitle("Microsoft - 2026");
        drive.setHiringYear(2026);
        drive.setHiringDate(LocalDate.of(2026, 6, 1));
        drive.setHiringMode("Online");
        drive.setDriveStatus("Open");
        drive.setEligibleBranches("CSE");
        drive.setEligibleCgpa(7.0);
        drive.setJobType("Full Time");
        drive.setCtcPackage("12 LPA");
        drive.setBacklogsAllowed(false);
        drive.setActive(true);
        drive = placementDriveRepository.save(drive);

        SelectedStudentRequest request = new SelectedStudentRequest(
                drive.getId(),
                "John Doe",
                "22951A0501",
                "CSE",
                "Male",
                "https://example.com/photo.jpg",
                "12 LPA",
                "Full Time",
                2026
        );

        SelectedStudentResponse response = selectedStudentService.createSelectedStudent(request);

        assertThat(response.id()).isNotNull();
        assertThat(response.studentName()).isEqualTo("John Doe");
        assertThat(response.rollNumber()).isEqualTo("22951A0501");
        assertThat(response.branch()).isEqualTo("CSE");
        assertThat(response.selectionYear()).isEqualTo(2026);
        assertThat(selectedStudentRepository.count()).isEqualTo(1);
    }
}
