package com.iare.placementportal.service;

import com.iare.placementportal.dto.SelectedStudentRequest;
import com.iare.placementportal.dto.SelectedStudentResponse;
import com.iare.placementportal.entity.Company;
import com.iare.placementportal.entity.PlacementDrive;
import com.iare.placementportal.entity.SelectedStudent;
import com.iare.placementportal.repository.PlacementDriveRepository;
import com.iare.placementportal.repository.SelectedStudentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.net.URISyntaxException;
import java.time.Year;
import java.util.List;

@Service
@Transactional
public class SelectedStudentService {

    private static final Logger LOGGER = LoggerFactory.getLogger(SelectedStudentService.class);

    private final SelectedStudentRepository selectedStudentRepository;
    private final PlacementDriveRepository placementDriveRepository;

    public SelectedStudentService(SelectedStudentRepository selectedStudentRepository,
                                  PlacementDriveRepository placementDriveRepository) {
        this.selectedStudentRepository = selectedStudentRepository;
        this.placementDriveRepository = placementDriveRepository;
    }

    public SelectedStudentResponse createSelectedStudent(SelectedStudentRequest request) {
        LOGGER.info("Create selected student request received: placementDriveId={}, studentName='{}', rollNumber='{}', branch='{}', gender='{}', packageOffered='{}', offerType='{}', selectionYear={}, photoUrlPresent={}",
                request.placementDriveId(),
                request.studentName(),
                request.rollNumber(),
                request.branch(),
                request.gender(),
                request.packageOffered(),
                request.offerType(),
                request.selectionYear(),
                normalizeOptional(request.photoUrl()) != null);
        validateRequest(request);
        PlacementDrive placementDrive = findDriveOrThrow(request.placementDriveId());

        if (selectedStudentRepository.existsByPlacementDriveIdAndRollNumberIgnoreCase(
                request.placementDriveId(), request.rollNumber().trim())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This roll number already exists for the selected placement drive.");
        }

        SelectedStudent selectedStudent = new SelectedStudent();
        mapRequestToEntity(request, selectedStudent, placementDrive);

        return saveSelectedStudent(selectedStudent, "create");
    }

    @Transactional(readOnly = true)
    public List<SelectedStudentResponse> getAllSelectedStudents() {
        return selectedStudentRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<SelectedStudentResponse> getActiveSelectedStudentsForStudents() {
        return selectedStudentRepository.findByActiveTrueOrderByCreatedAtDesc()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<SelectedStudentResponse> getSelectedStudentsByDrive(Long placementDriveId) {
        findDriveOrThrow(placementDriveId);
        return selectedStudentRepository.findByPlacementDriveIdOrderByCreatedAtDesc(placementDriveId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<SelectedStudentResponse> getActiveSelectedStudentsByDrive(Long placementDriveId) {
        findDriveOrThrow(placementDriveId);
        return selectedStudentRepository.findByPlacementDriveIdAndActiveTrueOrderByCreatedAtDesc(placementDriveId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public SelectedStudentResponse updateSelectedStudent(Long id, SelectedStudentRequest request) {
        LOGGER.info("Update selected student request received: id={}, placementDriveId={}, studentName='{}', rollNumber='{}', branch='{}', gender='{}', packageOffered='{}', offerType='{}', selectionYear={}, photoUrlPresent={}",
                id,
                request.placementDriveId(),
                request.studentName(),
                request.rollNumber(),
                request.branch(),
                request.gender(),
                request.packageOffered(),
                request.offerType(),
                request.selectionYear(),
                normalizeOptional(request.photoUrl()) != null);
        validateRequest(request);

        SelectedStudent selectedStudent = findSelectedStudentOrThrow(id);
        PlacementDrive placementDrive = findDriveOrThrow(request.placementDriveId());

        List<SelectedStudent> studentsInDrive = selectedStudentRepository.findByPlacementDriveIdOrderByCreatedAtDesc(request.placementDriveId());
        boolean duplicateExists = studentsInDrive.stream()
                .anyMatch(existing -> !existing.getId().equals(id)
                        && existing.getRollNumber().equalsIgnoreCase(request.rollNumber().trim()));

        if (duplicateExists) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This roll number already exists for the selected placement drive.");
        }

        mapRequestToEntity(request, selectedStudent, placementDrive);
        return saveSelectedStudent(selectedStudent, "update");
    }

    public void deleteSelectedStudent(Long id) {
        SelectedStudent selectedStudent = findSelectedStudentOrThrow(id);
        selectedStudentRepository.delete(selectedStudent);
    }

    public SelectedStudentResponse changeSelectedStudentActiveStatus(Long id, boolean active) {
        SelectedStudent selectedStudent = findSelectedStudentOrThrow(id);
        selectedStudent.setActive(active);
        return saveSelectedStudent(selectedStudent, "status-change");
    }

    private PlacementDrive findDriveOrThrow(Long placementDriveId) {
        return placementDriveRepository.findById(placementDriveId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Selected placement drive does not exist."));
    }

    private SelectedStudent findSelectedStudentOrThrow(Long id) {
        return selectedStudentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Selected student record not found."));
    }

    private void validateRequest(SelectedStudentRequest request) {
        validateUrl(request.photoUrl(), "Photo URL must be a valid URL.");
        if (request.selectionYear() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Selection Year is required.");
        }
        int currentYear = Year.now().getValue();
        if (request.selectionYear() < 2000 || request.selectionYear() > currentYear + 10) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Selection Year must be a valid year.");
        }
    }

    private void validateUrl(String value, String message) {
        String normalizedValue = normalizeOptional(value);
        if (normalizedValue == null) {
            return;
        }

        try {
            URI uri = new URI(normalizedValue);
            if (uri.getScheme() == null || uri.getHost() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
            }
        } catch (URISyntaxException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
    }

    private void mapRequestToEntity(SelectedStudentRequest request,
                                    SelectedStudent selectedStudent,
                                    PlacementDrive placementDrive) {
        selectedStudent.setPlacementDrive(placementDrive);
        selectedStudent.setStudentName(request.studentName().trim());
        selectedStudent.setRollNumber(request.rollNumber().trim());
        selectedStudent.setBranch(request.branch().trim());
        selectedStudent.setGender(request.gender().trim());
        selectedStudent.setPhotoUrl(normalizeOptional(request.photoUrl()));
        selectedStudent.setPackageOffered(request.packageOffered().trim());
        selectedStudent.setOfferType(request.offerType().trim());
        selectedStudent.setSelectionYear(request.selectionYear());
        if (selectedStudent.getActive() == null) {
            selectedStudent.setActive(true);
        }
    }

    private SelectedStudentResponse saveSelectedStudent(SelectedStudent selectedStudent, String operation) {
        try {
            SelectedStudent savedStudent = selectedStudentRepository.saveAndFlush(selectedStudent);
            LOGGER.info("Selected student {} successful: id={}, rollNumber='{}', branch='{}', selectionYear={}, active={}",
                    operation,
                    savedStudent.getId(),
                    savedStudent.getRollNumber(),
                    savedStudent.getBranch(),
                    savedStudent.getSelectionYear(),
                    savedStudent.getActive());
            return toResponse(savedStudent);
        } catch (DataIntegrityViolationException exception) {
            LOGGER.error("Selected student {} failed due to database constraint: placementDriveId={}, rollNumber='{}', branch='{}', selectionYear={}",
                    operation,
                    selectedStudent.getPlacementDrive() != null ? selectedStudent.getPlacementDrive().getId() : null,
                    selectedStudent.getRollNumber(),
                    selectedStudent.getBranch(),
                    selectedStudent.getSelectionYear(),
                    exception);

            String rootMessage = findRootCauseMessage(exception);
            if (rootMessage != null && rootMessage.toLowerCase().contains("section")) {
                throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "Selected student record could not be saved because the database still expects the removed Section field.");
            }

            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Selected student record could not be saved. Please verify the submitted values and try again.");
        }
    }

    private String normalizeOptional(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String findRootCauseMessage(Throwable throwable) {
        Throwable current = throwable;
        while (current.getCause() != null && current.getCause() != current) {
            current = current.getCause();
        }
        return current.getMessage();
    }

    private SelectedStudentResponse toResponse(SelectedStudent selectedStudent) {
        PlacementDrive placementDrive = selectedStudent.getPlacementDrive();
        Company company = placementDrive.getCompany();

        return new SelectedStudentResponse(
                selectedStudent.getId(),
                placementDrive.getId(),
                placementDrive.getDriveTitle(),
                placementDrive.getHiringYear(),
                company.getId(),
                company.getCompanyName(),
                company.getLogoUrl(),
                selectedStudent.getStudentName(),
                selectedStudent.getRollNumber(),
                selectedStudent.getBranch(),
                selectedStudent.getGender(),
                selectedStudent.getPhotoUrl(),
                selectedStudent.getPackageOffered(),
                selectedStudent.getOfferType(),
                selectedStudent.getSelectionYear(),
                selectedStudent.getActive(),
                selectedStudent.getCreatedAt(),
                selectedStudent.getUpdatedAt()
        );
    }
}
