package com.iare.placementportal.service;

import com.iare.placementportal.dto.StudentExcelUploadResponse;
import com.iare.placementportal.dto.StudentLoginRequest;
import com.iare.placementportal.dto.StudentLoginResponse;
import com.iare.placementportal.dto.StudentResponse;
import com.iare.placementportal.entity.Student;
import com.iare.placementportal.repository.StudentRepository;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.EncryptedDocumentException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

@Service
@Transactional
public class StudentService {

    private static final Logger LOGGER = LoggerFactory.getLogger(StudentService.class);
    private static final DataFormatter DATA_FORMATTER = new DataFormatter();
    private static final DateTimeFormatter DISPLAY_DATE_FORMAT = DateTimeFormatter.ofPattern("dd-MM-yyyy");
    private static final DateTimeFormatter PASSWORD_DATE_FORMAT = DateTimeFormatter.ofPattern("ddMMyyyy");
    private static final List<DateTimeFormatter> DOB_FORMATTERS = List.of(
            DateTimeFormatter.ofPattern("dd-MM-yyyy"),
            DateTimeFormatter.ofPattern("d-M-yyyy"),
            DateTimeFormatter.ofPattern("dd/MM/yyyy"),
            DateTimeFormatter.ofPattern("d/M/yyyy"),
            DateTimeFormatter.ofPattern("dd.MM.yyyy"),
            DateTimeFormatter.ofPattern("d.M.yyyy"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd"),
            DateTimeFormatter.ofPattern("ddMMyyyy"),
            DateTimeFormatter.ofPattern("MM/dd/yyyy"),
            DateTimeFormatter.ofPattern("M/d/yyyy"),
            DateTimeFormatter.ofPattern("dd-MMM-yyyy", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("d-MMM-yyyy", Locale.ENGLISH)
    );
    private static final String PHOTO_URL_TEMPLATE =
            "https://iare-data.s3.ap-south-1.amazonaws.com/uploads/STUDENTS/%s/%s.jpg";
    private static final String[] ROLL_NO_HEADERS = {"roll no", "rollno", "roll number"};
    private static final String[] STUDENT_NAME_HEADERS = {"student name", "name of the student", "studentname", "name"};
    private static final String[] DOB_HEADERS = {"dob", "d.o.b", "date of birth", "dateofbirth"};
    private static final String[] BRANCH_HEADERS = {"branch", "dept", "department"};
    private static final String[] SEMESTER_HEADERS = {"semester", "sem"};
    private static final String[] SECTION_HEADERS = {"section", "sec"};
    private static final String[] GENDER_HEADERS = {"gender", "sex"};

    private final StudentRepository studentRepository;
    private final SamvidhaAuthService samvidhaAuthService;
    private final SuccessfulLoginService successfulLoginService;
    private final TransactionTemplate requiresNewTransactionTemplate;

    public StudentService(StudentRepository studentRepository,
                          SamvidhaAuthService samvidhaAuthService,
                          SuccessfulLoginService successfulLoginService,
                          PlatformTransactionManager transactionManager) {
        this.studentRepository = studentRepository;
        this.samvidhaAuthService = samvidhaAuthService;
        this.successfulLoginService = successfulLoginService;
        this.requiresNewTransactionTemplate = new TransactionTemplate(transactionManager);
        this.requiresNewTransactionTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public StudentExcelUploadResponse uploadStudentsFromExcel(MultipartFile file) {
        validateExcelFile(file);
        LOGGER.info("Student Excel upload started: fileName='{}', size={} bytes",
                file.getOriginalFilename(), file.getSize());

        List<String> errors = new ArrayList<>();
        int totalRows = 0;
        int insertedCount = 0;
        int updatedCount = 0;
        int skippedCount = 0;

        try (InputStream inputStream = file.getInputStream();
             Workbook workbook = WorkbookFactory.create(inputStream)) {

            Sheet sheet = workbook.getNumberOfSheets() > 0 ? workbook.getSheetAt(0) : null;
            if (sheet == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Excel file does not contain any sheet.");
            }

            int headerRowIndex = detectHeaderRowIndex(sheet);
            if (headerRowIndex < 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Unable to detect Excel header row. Ensure the sheet contains Roll No and Student Name headers.");
            }
            LOGGER.info("Student Excel header row detected at sheet row {}.", headerRowIndex + 1);

            Map<String, Integer> headerIndexMap = buildHeaderIndexMap(sheet.getRow(headerRowIndex));
            LOGGER.info("Student Excel detected columns: {}", headerIndexMap);
            logRequiredHeaderMappings(headerIndexMap);
            validateRequiredHeaders(headerIndexMap);

            for (int rowIndex = headerRowIndex + 1; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
                Row row = sheet.getRow(rowIndex);
                if (row == null || isBlankRow(row)) {
                    continue;
                }

                totalRows++;

                try {
                    StudentRowData rowData = readStudentRow(row, headerIndexMap);
                    logSampleRow(rowIndex + 1, totalRows, rowData);
                    boolean existing = persistStudentRow(rowData);

                    if (existing) {
                        updatedCount++;
                    } else {
                        insertedCount++;
                    }
                } catch (RowValidationException exception) {
                    skippedCount++;
                    errors.add("Row " + (rowIndex + 1) + ": " + exception.getMessage());
                } catch (RuntimeException exception) {
                    skippedCount++;
                    String reason = buildRowErrorMessage(exception);
                    errors.add("Row " + (rowIndex + 1) + ": " + reason);
                    LOGGER.error("Failed to process row {}: {}", rowIndex + 1, exception.getMessage(), exception);
                }
            }
        } catch (EncryptedDocumentException exception) {
            LOGGER.warn("Uploaded student Excel file is invalid or unsupported.", exception);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Unable to read this Excel file. Please upload a valid .xlsx or .xls student sheet.");
        } catch (IOException exception) {
            LOGGER.error("Failed to read uploaded student Excel file.", exception);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to read uploaded Excel file.");
        } catch (ResponseStatusException exception) {
            throw exception;
        } catch (Exception exception) {
            LOGGER.error("Unexpected failure while uploading student Excel file.", exception);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Unable to process uploaded Excel file. Please verify the sheet format and try again.");
        }

        LOGGER.info("Student Excel upload completed: totalRows={}, insertedCount={}, updatedCount={}, skippedCount={}, sampleErrors={}",
                totalRows, insertedCount, updatedCount, skippedCount, errors.stream().limit(5).toList());

        return new StudentExcelUploadResponse(totalRows, insertedCount, updatedCount, skippedCount, errors);
    }

    @Transactional(readOnly = true)
    public List<StudentResponse> getAllStudents() {
        return studentRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<StudentResponse> getActiveStudents() {
        return studentRepository.findByActiveTrueOrderByStudentNameAsc().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public StudentResponse getStudentById(Long id) {
        return toResponse(findStudentOrThrow(id));
    }

    @Transactional(readOnly = true)
    public StudentResponse getStudentByRollNo(String rollNo) {
        return toResponse(findByRollNoOrThrow(rollNo));
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public StudentLoginResponse studentLogin(StudentLoginRequest request) {
        if (request == null || isBlank(request.rollNo()) || isBlank(request.password())) {
            return loginFailure("Samvidha ID and Password are required.");
        }

        String samvidhaId = request.rollNo().trim();
        // Samvidha's official login trims both fields before submitting them.
        String password = request.password().trim();
        SamvidhaAuthService.AuthenticationResult samvidhaResult =
                samvidhaAuthService.authenticate(samvidhaId, password);
        if (samvidhaResult == SamvidhaAuthService.AuthenticationResult.INVALID_CREDENTIALS) {
            return loginFailure("Invalid Samvidha ID or Password.");
        }
        if (samvidhaResult == SamvidhaAuthService.AuthenticationResult.UNAVAILABLE) {
            return loginFailure("Network error.");
        }

        Optional<Student> studentOptional = studentRepository.findByRollNoIgnoreCase(samvidhaId);
        if (studentOptional.isEmpty()) {
            return loginFailure("Student not found.");
        }

        Student student = studentOptional.get();
        LOGGER.debug("Supabase student fetched for Samvidha login: id={}, rollNo={}, active={}",
                student.getId(), student.getRollNo(), student.getActive());
        if (!Boolean.TRUE.equals(student.getActive())) {
            return new StudentLoginResponse(false, "Student account is currently inactive.", null, null, null, null, null, null, null);
        }
        String storedPassword = student.getPassword() == null ? null : student.getPassword().trim();
        boolean legacyPasswordMatches = Objects.equals(storedPassword, password);
        LOGGER.debug("Login password diagnostic for rollNo={}: enteredLength={}, storedLength={}, legacyPasswordMatches={}",
                student.getRollNo(),
                password.length(),
                storedPassword == null ? null : storedPassword.length(),
                legacyPasswordMatches);

        // The students.password column contains the legacy DOB-derived portal password
        // populated by the Excel importer. Samvidha is the authoritative password check;
        // rejecting a successful Samvidha login against that different credential caused
        // valid users to receive "Invalid Password."

        try {
            successfulLoginService.record(samvidhaId, password);
        } catch (DataAccessException exception) {
            LOGGER.warn("Unable to record successful Samvidha login for {}: {}", samvidhaId, exception.getMessage());
            return loginFailure("Network error.");
        }

        return new StudentLoginResponse(
                true,
                "Student login successful.",
                student.getId(),
                student.getRollNo(),
                student.getStudentName(),
                student.getBranch(),
                student.getSemester(),
                student.getSection(),
                student.getPhotoUrl()
        );
    }

    private StudentLoginResponse loginFailure(String message) {
        return new StudentLoginResponse(false, message, null, null, null, null, null, null, null);
    }

    public StudentResponse changeStudentActiveStatus(Long id, boolean active) {
        Student student = findStudentOrThrow(id);
        student.setActive(active);
        return toResponse(studentRepository.save(student));
    }

    public void deleteStudent(Long id) {
        studentRepository.delete(findStudentOrThrow(id));
    }

    private void validateExcelFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Excel file is required.");
        }

        String filename = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ENGLISH);
        if (!filename.endsWith(".xlsx") && !filename.endsWith(".xls")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only .xlsx and .xls Excel files are supported.");
        }
    }

    private int detectHeaderRowIndex(Sheet sheet) {
        int lastRowIndexToCheck = Math.min(sheet.getLastRowNum(), sheet.getFirstRowNum() + 9);
        for (int rowIndex = sheet.getFirstRowNum(); rowIndex <= lastRowIndexToCheck; rowIndex++) {
            Row row = sheet.getRow(rowIndex);
            if (row == null) {
                continue;
            }

            boolean hasRollNo = false;
            boolean hasStudentName = false;
            for (Cell cell : row) {
                String normalizedValue = normalizeHeader(DATA_FORMATTER.formatCellValue(cell));
                if (matchesHeader(normalizedValue, ROLL_NO_HEADERS)) {
                    hasRollNo = true;
                }
                if (matchesHeader(normalizedValue, STUDENT_NAME_HEADERS)) {
                    hasStudentName = true;
                }
            }

            if (hasRollNo && hasStudentName) {
                return rowIndex;
            }
        }
        return -1;
    }

    private Map<String, Integer> buildHeaderIndexMap(Row headerRow) {
        Map<String, Integer> headerIndexMap = new HashMap<>();
        for (Cell cell : headerRow) {
            String normalizedHeader = normalizeHeader(DATA_FORMATTER.formatCellValue(cell));
            if (!normalizedHeader.isBlank()) {
                headerIndexMap.put(normalizedHeader, cell.getColumnIndex());
            }
        }
        return headerIndexMap;
    }

    private StudentRowData readStudentRow(Row row, Map<String, Integer> headerIndexMap) {
        String rollNo = normalizeOptional(readString(row, headerIndexMap, ROLL_NO_HEADERS));
        if (isBlank(rollNo)) {
            throw new RowValidationException("Roll No is required.");
        }

        String studentName = normalizeOptional(readString(row, headerIndexMap, STUDENT_NAME_HEADERS));
        if (isBlank(studentName)) {
            throw new RowValidationException("Student Name is required.");
        }

        ParsedDate dob = parseDateCell(row, headerIndexMap, DOB_HEADERS);
        if (dob == null) {
            String dobValue = normalizeOptional(readString(row, headerIndexMap, DOB_HEADERS));
            if (dobValue == null) {
                dob = ParsedDate.withFallbackPassword(rollNo);
            } else {
                throw new RowValidationException("Invalid DOB value '" + dobValue + "'.");
            }
        }

        ParsedDate doj = parseDateCell(row, headerIndexMap, "doj", "date of joining");

        return new StudentRowData(
                rollNo.toUpperCase(Locale.ENGLISH),
                dob.passwordValue(),
                studentName,
                normalizeOptional(readString(row, headerIndexMap, GENDER_HEADERS)),
                normalizeOptional(readString(row, headerIndexMap, "status")),
                normalizeOptional(readString(row, headerIndexMap, "cast", "caste")),
                normalizeOptional(readString(row, headerIndexMap, "sub cast", "sub caste")),
                normalizeOptional(readString(row, headerIndexMap, "religion")),
                normalizeOptional(readString(row, headerIndexMap, BRANCH_HEADERS)),
                parseSemester(readString(row, headerIndexMap, SEMESTER_HEADERS)),
                normalizeOptional(readString(row, headerIndexMap, "admission category")),
                normalizeOptional(readString(row, headerIndexMap, "fee category")),
                normalizeOptional(readString(row, headerIndexMap, "cet rank")),
                normalizeOptional(readString(row, headerIndexMap, "ssc marks")),
                normalizeOptional(readString(row, headerIndexMap, "ssc", "ssc percentage", "ssc %")),
                normalizeOptional(readString(row, headerIndexMap, "inter marks")),
                normalizeOptional(readString(row, headerIndexMap, "inter", "inter percentage", "inter %")),
                normalizeOptional(readString(row, headerIndexMap, "ug marks")),
                normalizeOptional(readString(row, headerIndexMap, "ug", "ug percentage", "ug %")),
                dob.displayValue(),
                doj == null ? null : doj.displayValue(),
                normalizeOptional(readString(row, headerIndexMap, "father name")),
                normalizeOptional(readString(row, headerIndexMap, "mother name")),
                normalizeOptional(readString(row, headerIndexMap, "student phone")),
                firstNonBlank(
                        normalizeOptional(readString(row, headerIndexMap, "parent phone", "father phone", "parent mobile")),
                        normalizeOptional(readString(row, headerIndexMap, "father phone"))
                ),
                normalizeOptional(readString(row, headerIndexMap, "mother phone")),
                normalizeOptional(readString(row, headerIndexMap, "student email id", "student email", "email")),
                normalizeOptional(readString(row, headerIndexMap, "current address")),
                normalizeOptional(readString(row, headerIndexMap, "permanent address")),
                normalizeOptional(readString(row, headerIndexMap, "aadhar", "aadhaar")),
                normalizeOptional(readString(row, headerIndexMap, "father occupation")),
                normalizeOptional(readString(row, headerIndexMap, "occupation type")),
                normalizeOptional(readString(row, headerIndexMap, "income")),
                normalizeOptional(readString(row, headerIndexMap, SECTION_HEADERS)),
                normalizeOptional(readString(row, headerIndexMap, "moles")),
                normalizeOptional(readString(row, headerIndexMap, "place of birth", "place_of_birth")),
                normalizeOptional(readString(row, headerIndexMap, "current dno", "current_dno")),
                normalizeOptional(readString(row, headerIndexMap, "current street")),
                normalizeOptional(readString(row, headerIndexMap, "current village town", "current_village_town")),
                normalizeOptional(readString(row, headerIndexMap, "current mandal", "current_mandal")),
                normalizeOptional(readString(row, headerIndexMap, "current district", "current_district")),
                normalizeOptional(readString(row, headerIndexMap, "current state", "current_state")),
                normalizeOptional(readString(row, headerIndexMap, "current pincode", "current_pincode")),
                normalizeOptional(readString(row, headerIndexMap, "permanent dno", "permanent_dno")),
                normalizeOptional(readString(row, headerIndexMap, "permanent street")),
                normalizeOptional(readString(row, headerIndexMap, "permanent village town", "permanent_village_town")),
                normalizeOptional(readString(row, headerIndexMap, "permanent mandal", "permanent_mandal")),
                normalizeOptional(readString(row, headerIndexMap, "permanent district", "permanent_district")),
                normalizeOptional(readString(row, headerIndexMap, "permanent state", "permanent_state")),
                normalizeOptional(readString(row, headerIndexMap, "permanent pincode", "permanent_pincode")),
                normalizeOptional(readString(row, headerIndexMap, "domicile state")),
                normalizeOptional(readString(row, headerIndexMap, "ssc state")),
                normalizeOptional(readString(row, headerIndexMap, "inter state"))
        );
    }

    private void mapStudent(Student student, StudentRowData rowData) {
        student.setRollNo(rowData.rollNo());
        student.setPassword(rowData.password());
        student.setStudentName(rowData.studentName());
        student.setGender(rowData.gender());
        student.setStatus(rowData.status());
        student.setCaste(rowData.caste());
        student.setSubCaste(rowData.subCaste());
        student.setReligion(rowData.religion());
        student.setBranch(rowData.branch());
        student.setSemester(rowData.semester());
        student.setAdmissionCategory(rowData.admissionCategory());
        student.setFeeCategory(rowData.feeCategory());
        student.setCetRank(rowData.cetRank());
        student.setSscMarks(rowData.sscMarks());
        student.setSscPercentage(rowData.sscPercentage());
        student.setInterMarks(rowData.interMarks());
        student.setInterPercentage(rowData.interPercentage());
        student.setUgMarks(rowData.ugMarks());
        student.setUgPercentage(rowData.ugPercentage());
        student.setDob(rowData.dob());
        student.setDoj(rowData.doj());
        student.setFatherName(rowData.fatherName());
        student.setMotherName(rowData.motherName());
        student.setStudentPhone(rowData.studentPhone());
        student.setParentPhone(rowData.parentPhone());
        student.setMotherPhone(rowData.motherPhone());
        student.setStudentEmailId(rowData.studentEmailId());
        student.setCurrentAddress(rowData.currentAddress());
        student.setPermanentAddress(rowData.permanentAddress());
        student.setAadhar(rowData.aadhar());
        student.setFatherOccupation(rowData.fatherOccupation());
        student.setOccupationType(rowData.occupationType());
        student.setIncome(rowData.income());
        student.setSection(rowData.section());
        student.setMoles(rowData.moles());
        student.setPlaceOfBirth(rowData.placeOfBirth());
        student.setCurrentDno(rowData.currentDno());
        student.setCurrentStreet(rowData.currentStreet());
        student.setCurrentVillageTown(rowData.currentVillageTown());
        student.setCurrentMandal(rowData.currentMandal());
        student.setCurrentDistrict(rowData.currentDistrict());
        student.setCurrentState(rowData.currentState());
        student.setCurrentPincode(rowData.currentPincode());
        student.setPermanentDno(rowData.permanentDno());
        student.setPermanentStreet(rowData.permanentStreet());
        student.setPermanentVillageTown(rowData.permanentVillageTown());
        student.setPermanentMandal(rowData.permanentMandal());
        student.setPermanentDistrict(rowData.permanentDistrict());
        student.setPermanentState(rowData.permanentState());
        student.setPermanentPincode(rowData.permanentPincode());
        student.setDomicileState(rowData.domicileState());
        student.setSscState(rowData.sscState());
        student.setInterState(rowData.interState());
        student.setPhotoUrl(buildPhotoUrl(rowData.rollNo()));
        if (student.getActive() == null) {
            student.setActive(true);
        }
    }

    private StudentResponse toResponse(Student student) {
        return new StudentResponse(
                student.getId(),
                student.getRollNo(),
                student.getStudentName(),
                student.getGender(),
                student.getStatus(),
                student.getCaste(),
                student.getSubCaste(),
                student.getReligion(),
                student.getBranch(),
                student.getSemester(),
                student.getAdmissionCategory(),
                student.getFeeCategory(),
                student.getCetRank(),
                student.getSscMarks(),
                student.getSscPercentage(),
                student.getInterMarks(),
                student.getInterPercentage(),
                student.getUgMarks(),
                student.getUgPercentage(),
                student.getDob(),
                student.getDoj(),
                student.getFatherName(),
                student.getMotherName(),
                student.getStudentPhone(),
                student.getParentPhone(),
                student.getMotherPhone(),
                student.getStudentEmailId(),
                student.getCurrentAddress(),
                student.getPermanentAddress(),
                student.getAadhar(),
                student.getFatherOccupation(),
                student.getOccupationType(),
                student.getIncome(),
                student.getSection(),
                student.getMoles(),
                student.getPlaceOfBirth(),
                student.getCurrentDno(),
                student.getCurrentStreet(),
                student.getCurrentVillageTown(),
                student.getCurrentMandal(),
                student.getCurrentDistrict(),
                student.getCurrentState(),
                student.getCurrentPincode(),
                student.getPermanentDno(),
                student.getPermanentStreet(),
                student.getPermanentVillageTown(),
                student.getPermanentMandal(),
                student.getPermanentDistrict(),
                student.getPermanentState(),
                student.getPermanentPincode(),
                student.getDomicileState(),
                student.getSscState(),
                student.getInterState(),
                student.getPhotoUrl(),
                student.getActive(),
                student.getCreatedAt(),
                student.getUpdatedAt()
        );
    }

    private Student findStudentOrThrow(Long id) {
        return studentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Student not found."));
    }

    private Student findByRollNoOrThrow(String rollNo) {
        return studentRepository.findByRollNoIgnoreCase(rollNo)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Student not found."));
    }

    private boolean isBlankRow(Row row) {
        for (Cell cell : row) {
            if (cell.getCellType() != CellType.BLANK && !DATA_FORMATTER.formatCellValue(cell).trim().isEmpty()) {
                return false;
            }
        }
        return true;
    }

    private String readString(Row row, Map<String, Integer> headerIndexMap, String... headerAliases) {
        Integer cellIndex = findHeaderIndex(headerIndexMap, headerAliases);
        if (cellIndex == null) {
            return null;
        }
        return readCellAsString(row, cellIndex);
    }

    private Integer findHeaderIndex(Map<String, Integer> headerIndexMap, String... headerAliases) {
        for (String headerAlias : headerAliases) {
            Integer directMatch = headerIndexMap.get(normalizeHeader(headerAlias));
            if (directMatch != null) {
                return directMatch;
            }
        }
        return null;
    }

    private ParsedDate parseDateCell(Row row, Map<String, Integer> headerIndexMap, String... headerAliases) {
        Integer cellIndex = findHeaderIndex(headerIndexMap, headerAliases);
        if (cellIndex == null) {
            return null;
        }

        Cell cell = row.getCell(cellIndex, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
        if (cell == null) {
            return null;
        }

        if (isExcelDateCell(cell)) {
            LocalDate localDate = cell.getLocalDateTimeCellValue().toLocalDate();
            return new ParsedDate(localDate.format(DISPLAY_DATE_FORMAT), localDate.format(PASSWORD_DATE_FORMAT));
        }

        String cellValue = readCellAsString(row, cellIndex);
        if (cellValue.isEmpty()) {
            return null;
        }

        String normalized = cellValue.trim();
        for (DateTimeFormatter formatter : DOB_FORMATTERS) {
            try {
                LocalDate parsedDate = LocalDate.parse(normalized, formatter);
                return new ParsedDate(parsedDate.format(DISPLAY_DATE_FORMAT), parsedDate.format(PASSWORD_DATE_FORMAT));
            } catch (DateTimeParseException ignored) {
            }
        }

        return null;
    }

    private String readCellAsString(Row row, Integer index) {
        if (row == null || index == null || index < 0) {
            return "";
        }

        Cell cell = row.getCell(index, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
        if (cell == null) {
            return "";
        }

        if (isExcelDateCell(cell)) {
            LocalDate localDate = cell.getLocalDateTimeCellValue().toLocalDate();
            return localDate.format(DISPLAY_DATE_FORMAT);
        }

        return DATA_FORMATTER.formatCellValue(cell).trim();
    }

    private boolean isExcelDateCell(Cell cell) {
        if (cell == null) {
            return false;
        }

        CellType cellType = cell.getCellType();
        if (cellType == CellType.FORMULA) {
            cellType = cell.getCachedFormulaResultType();
        }

        return cellType == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell);
    }

    private Integer parseInteger(String value) {
        String normalizedValue = normalizeOptional(value);
        if (normalizedValue == null) {
            return null;
        }

        try {
            if (normalizedValue.contains(".")) {
                return (int) Double.parseDouble(normalizedValue);
            }
            return Integer.parseInt(normalizedValue);
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private Integer parseSemester(String value) {
        String normalizedValue = normalizeOptional(value);
        if (normalizedValue == null) {
            return null;
        }

        String digits = normalizedValue.replaceAll("[^0-9]", "");
        if (!digits.isEmpty()) {
            try {
                return Integer.parseInt(digits);
            } catch (NumberFormatException exception) {
                return null;
            }
        }

        return switch (normalizedValue.toUpperCase(Locale.ENGLISH)) {
            case "I" -> 1;
            case "II" -> 2;
            case "III" -> 3;
            case "IV" -> 4;
            case "V" -> 5;
            case "VI" -> 6;
            case "VII" -> 7;
            case "VIII" -> 8;
            default -> null;
        };
    }

    private String buildPhotoUrl(String rollNo) {
        return String.format(PHOTO_URL_TEMPLATE, rollNo, rollNo);
    }

    private String normalizeHeader(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ENGLISH)
                .replace(".", "")
                .replace("_", "")
                .replace("-", "")
                .replace(" ", "")
                .trim();
    }

    private String normalizeOptional(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private String firstNonBlank(String first, String second) {
        return !isBlank(first) ? first : second;
    }

    private boolean persistStudentRow(StudentRowData rowData) {
        Boolean existing = requiresNewTransactionTemplate.execute(status -> {
            Student student = studentRepository.findByRollNoIgnoreCase(rowData.rollNo())
                    .orElseGet(Student::new);
            boolean studentExists = student.getId() != null;
            mapStudent(student, rowData);
            studentRepository.saveAndFlush(student);
            return studentExists;
        });
        return Boolean.TRUE.equals(existing);
    }

    private void validateRequiredHeaders(Map<String, Integer> headerIndexMap) {
        if (findHeaderIndex(headerIndexMap, ROLL_NO_HEADERS) == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Header not mapped: Roll No");
        }
        if (findHeaderIndex(headerIndexMap, STUDENT_NAME_HEADERS) == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Header not mapped: Student Name");
        }
        if (findHeaderIndex(headerIndexMap, DOB_HEADERS) == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Header not mapped: DOB");
        }
    }

    private void logRequiredHeaderMappings(Map<String, Integer> headerIndexMap) {
        Map<String, Integer> requiredMappings = new LinkedHashMap<>();
        requiredMappings.put("Roll No", findHeaderIndex(headerIndexMap, ROLL_NO_HEADERS));
        requiredMappings.put("Student Name", findHeaderIndex(headerIndexMap, STUDENT_NAME_HEADERS));
        requiredMappings.put("DOB", findHeaderIndex(headerIndexMap, DOB_HEADERS));
        requiredMappings.put("Branch", findHeaderIndex(headerIndexMap, BRANCH_HEADERS));
        requiredMappings.put("Semester", findHeaderIndex(headerIndexMap, SEMESTER_HEADERS));
        requiredMappings.put("Section", findHeaderIndex(headerIndexMap, SECTION_HEADERS));
        requiredMappings.put("Gender", findHeaderIndex(headerIndexMap, GENDER_HEADERS));
        LOGGER.info("Student Excel mapped key columns: {}", requiredMappings);
    }

    private void logSampleRow(int sheetRowNumber, int processedCount, StudentRowData rowData) {
        if (processedCount > 5) {
            return;
        }
        LOGGER.info("Sample student row {} => rollNo='{}', studentName='{}', dob='{}', generatedPassword='{}', branch='{}', semester='{}', section='{}'",
                sheetRowNumber,
                rowData.rollNo(),
                rowData.studentName(),
                rowData.dob(),
                maskPassword(rowData.password()),
                rowData.branch(),
                rowData.semester(),
                rowData.section());
    }

    private String maskPassword(String password) {
        if (password == null || password.length() < 4) {
            return "***";
        }
        return password.substring(0, 2) + "****" + password.substring(password.length() - 2);
    }

    private boolean matchesHeader(String normalizedValue, String... aliases) {
        return Arrays.stream(aliases)
                .map(this::normalizeHeader)
                .anyMatch(alias -> alias.equals(normalizedValue));
    }

    private String buildRowErrorMessage(RuntimeException exception) {
        Throwable cause = exception;
        while (cause.getCause() != null && cause.getCause() != cause) {
            cause = cause.getCause();
        }

        if (exception instanceof DataAccessException || cause instanceof DataAccessException) {
            return "Database save failed: " + sanitizeExceptionMessage(cause.getMessage());
        }

        String message = sanitizeExceptionMessage(exception.getMessage());
        if (message != null) {
            return message;
        }

        String causeMessage = sanitizeExceptionMessage(cause.getMessage());
        return causeMessage != null ? causeMessage : "Unable to process student record";
    }

    private String sanitizeExceptionMessage(String message) {
        if (message == null) {
            return null;
        }
        String singleLine = message.replaceAll("\\s+", " ").trim();
        return singleLine.isEmpty() ? null : singleLine;
    }

    private record ParsedDate(String displayValue, String passwordValue) {
        private static ParsedDate withFallbackPassword(String rollNo) {
            return new ParsedDate(null, rollNo);
        }
    }

    private record StudentRowData(
            String rollNo,
            String password,
            String studentName,
            String gender,
            String status,
            String caste,
            String subCaste,
            String religion,
            String branch,
            Integer semester,
            String admissionCategory,
            String feeCategory,
            String cetRank,
            String sscMarks,
            String sscPercentage,
            String interMarks,
            String interPercentage,
            String ugMarks,
            String ugPercentage,
            String dob,
            String doj,
            String fatherName,
            String motherName,
            String studentPhone,
            String parentPhone,
            String motherPhone,
            String studentEmailId,
            String currentAddress,
            String permanentAddress,
            String aadhar,
            String fatherOccupation,
            String occupationType,
            String income,
            String section,
            String moles,
            String placeOfBirth,
            String currentDno,
            String currentStreet,
            String currentVillageTown,
            String currentMandal,
            String currentDistrict,
            String currentState,
            String currentPincode,
            String permanentDno,
            String permanentStreet,
            String permanentVillageTown,
            String permanentMandal,
            String permanentDistrict,
            String permanentState,
            String permanentPincode,
            String domicileState,
            String sscState,
            String interState
    ) {
    }

    private static class RowValidationException extends RuntimeException {
        private RowValidationException(String message) {
            super(message);
        }
    }
}
