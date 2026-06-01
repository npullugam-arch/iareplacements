package com.iare.placementportal.service;

import com.iare.placementportal.dto.PlacementDriveExcelUploadError;
import com.iare.placementportal.dto.PlacementDriveExcelUploadResponse;
import com.iare.placementportal.dto.PlacementDriveRequest;
import com.iare.placementportal.dto.PlacementDriveResponse;
import com.iare.placementportal.entity.Company;
import com.iare.placementportal.entity.PlacementDrive;
import com.iare.placementportal.repository.CompanyRepository;
import com.iare.placementportal.repository.PlacementDriveRepository;
import org.apache.poi.EncryptedDocumentException;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.HashMap;
import java.util.Optional;

@Service
@Transactional
public class PlacementDriveService {

    private static final Logger LOGGER = LoggerFactory.getLogger(PlacementDriveService.class);
    private static final DataFormatter DATA_FORMATTER = new DataFormatter();
    private static final List<DateTimeFormatter> DATE_FORMATTERS = List.of(
            DateTimeFormatter.ISO_LOCAL_DATE,
            DateTimeFormatter.ofPattern("d/M/yyyy"),
            DateTimeFormatter.ofPattern("dd/MM/yyyy"),
            DateTimeFormatter.ofPattern("d-M-yyyy"),
            DateTimeFormatter.ofPattern("dd-MM-yyyy"),
            DateTimeFormatter.ofPattern("d.M.yyyy"),
            DateTimeFormatter.ofPattern("dd.MM.yyyy"),
            DateTimeFormatter.ofPattern("d-MMM-yyyy", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("dd-MMM-yyyy", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("M/d/yyyy"),
            DateTimeFormatter.ofPattern("MM/dd/yyyy")
    );

    private final PlacementDriveRepository placementDriveRepository;
    private final CompanyRepository companyRepository;

    public PlacementDriveService(PlacementDriveRepository placementDriveRepository,
                                 CompanyRepository companyRepository) {
        this.placementDriveRepository = placementDriveRepository;
        this.companyRepository = companyRepository;
    }

    public PlacementDriveResponse createDrive(PlacementDriveRequest request) {
        validateRequest(request);
        Company company = findCompanyOrThrow(request.companyId());

        PlacementDrive placementDrive = new PlacementDrive();
        mapRequestToEntity(request, placementDrive, company);

        return toResponse(placementDriveRepository.save(placementDrive));
    }

    @Transactional(readOnly = true)
    public List<PlacementDriveResponse> getAllDrives() {
        return placementDriveRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PlacementDriveResponse> getActiveDrivesForStudents() {
        return placementDriveRepository.findByActiveTrueOrderByCreatedAtDesc()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PlacementDriveResponse> getDrivesByCompany(Long companyId) {
        findCompanyOrThrow(companyId);
        return placementDriveRepository.findByCompanyIdOrderByCreatedAtDesc(companyId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PlacementDriveResponse> getActiveDrivesByCompany(Long companyId) {
        findCompanyOrThrow(companyId);
        return placementDriveRepository.findByCompanyIdAndActiveTrueOrderByCreatedAtDesc(companyId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public PlacementDriveResponse updateDrive(Long id, PlacementDriveRequest request) {
        validateRequest(request);
        Company company = findCompanyOrThrow(request.companyId());
        PlacementDrive placementDrive = findDriveOrThrow(id);

        mapRequestToEntity(request, placementDrive, company);

        return toResponse(placementDriveRepository.save(placementDrive));
    }

    public void deleteDrive(Long id) {
        PlacementDrive placementDrive = findDriveOrThrow(id);
        placementDriveRepository.delete(placementDrive);
    }

    public PlacementDriveResponse changeDriveActiveStatus(Long id, boolean active) {
        PlacementDrive placementDrive = findDriveOrThrow(id);
        placementDrive.setActive(active);
        return toResponse(placementDriveRepository.save(placementDrive));
    }

    @Transactional
    public PlacementDriveExcelUploadResponse uploadDrivesFromExcel(MultipartFile file) {
        validateExcelFile(file);
        LOGGER.info("Placement drive Excel upload started: fileName='{}', size={} bytes",
                file.getOriginalFilename(), file.getSize());

        List<PlacementDriveExcelUploadError> errors = new ArrayList<>();
        int totalRows = 0;
        int successCount = 0;
        int failedCount = 0;

        try (InputStream inputStream = file.getInputStream();
             Workbook workbook = WorkbookFactory.create(inputStream)) {

            Sheet sheet = workbook.getNumberOfSheets() > 0 ? workbook.getSheetAt(0) : null;
            if (sheet == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Excel file does not contain any sheet.");
            }

            int headerRowIndex = detectHeaderRowIndex(sheet);
            if (headerRowIndex < 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Unable to detect the header row. Ensure the sheet contains Company and Drive Title columns.");
            }

            Map<String, Integer> headerIndexMap = buildHeaderIndexMap(sheet.getRow(headerRowIndex));
            validateRequiredHeaders(headerIndexMap);

            for (int rowIndex = headerRowIndex + 1; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
                Row row = sheet.getRow(rowIndex);
                if (row == null || isBlankRow(row)) {
                    continue;
                }

                totalRows++;
                String companyName = normalizeOptional(readString(row, headerIndexMap, "Company"));

                try {
                    PlacementDriveRequest request = readPlacementDriveRow(row, headerIndexMap);
                    persistPlacementDriveRow(request);
                    successCount++;
                } catch (RowValidationException exception) {
                    failedCount++;
                    errors.add(new PlacementDriveExcelUploadError(rowIndex + 1, companyName, exception.getMessage()));
                } catch (RuntimeException exception) {
                    failedCount++;
                    String reason = buildRowErrorMessage(exception);
                    errors.add(new PlacementDriveExcelUploadError(rowIndex + 1, companyName, reason));
                    LOGGER.error("Failed to process placement drive upload row {}: {}", rowIndex + 1, reason, exception);
                }
            }
        } catch (EncryptedDocumentException exception) {
            LOGGER.warn("Uploaded placement drive Excel file is invalid or unsupported.", exception);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Unable to read this Excel file. Please upload a valid .xlsx or .xls placement drive sheet.");
        } catch (IOException exception) {
            LOGGER.error("Failed to read uploaded placement drive Excel file.", exception);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to read uploaded Excel file.");
        } catch (ResponseStatusException exception) {
            throw exception;
        } catch (Exception exception) {
            LOGGER.error("Unexpected failure while uploading placement drive Excel file.", exception);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Unable to process uploaded placement drive Excel file. Please verify the sheet format and try again.");
        }

        LOGGER.info("Placement drive Excel upload completed: totalRows={}, successCount={}, failedCount={}, errorCount={}",
                totalRows, successCount, failedCount, errors.size());

        return new PlacementDriveExcelUploadResponse(totalRows, successCount, failedCount, errors);
    }

    private Company findCompanyOrThrow(Long companyId) {
        return companyRepository.findById(companyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Selected company does not exist."));
    }

    private PlacementDrive findDriveOrThrow(Long id) {
        return placementDriveRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Placement drive not found."));
    }

    private void validateRequest(PlacementDriveRequest request) {
        if (request.eligibleCgpa() != null && (request.eligibleCgpa() < 0 || request.eligibleCgpa() > 10)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Eligible CGPA must be between 0 and 10.");
        }
        if (request.maxBacklogs() != null && request.maxBacklogs() < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Maximum Backlogs cannot be negative.");
        }
        if (request.numberOfRounds() != null && request.numberOfRounds() < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Number of Rounds cannot be negative.");
        }
        if (request.registrationDeadline() != null
                && request.hiringDate() != null
                && request.registrationDeadline().isAfter(request.hiringDate())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Registration Deadline cannot be after Hiring Date.");
        }
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

            boolean hasCompany = false;
            boolean hasDriveTitle = false;
            for (Cell cell : row) {
                String normalizedValue = normalizeHeader(DATA_FORMATTER.formatCellValue(cell));
                if ("company".equals(normalizedValue)) {
                    hasCompany = true;
                }
                if ("drivetitle".equals(normalizedValue)) {
                    hasDriveTitle = true;
                }
            }

            if (hasCompany && hasDriveTitle) {
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

    private void validateRequiredHeaders(Map<String, Integer> headerIndexMap) {
        String[] requiredHeaders = {
                "Company",
                "Drive Title",
                "Hiring Year",
                "Hiring Date",
                "Hiring Mode",
                "Drive Status",
                "Eligible Branches",
                "Eligible CGPA",
                "Job Type",
                "CTC Package"
        };

        for (String requiredHeader : requiredHeaders) {
            if (findHeaderIndex(headerIndexMap, requiredHeader) == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Header not mapped: " + requiredHeader);
            }
        }
    }

    private PlacementDriveRequest readPlacementDriveRow(Row row, Map<String, Integer> headerIndexMap) {
        String companyName = normalizeOptional(readString(row, headerIndexMap, "Company"));
        if (companyName == null) {
            throw new RowValidationException("Company is required.");
        }

        Company company = findCompanyByImportedName(companyName)
                .orElseThrow(() -> new RowValidationException(
                        "Company '" + companyName + "' was not found in company master data."));

        String driveTitle = normalizeOptional(readString(row, headerIndexMap, "Drive Title"));
        if (driveTitle == null) {
            throw new RowValidationException("Drive Title is required.");
        }

        Integer hiringYear = parseIntegerRequired(row, headerIndexMap, "Hiring Year");
        LocalDate hiringDate = parseDateRequired(row, headerIndexMap, "Hiring Date");
        String hiringMode = requireText(readString(row, headerIndexMap, "Hiring Mode"), "Hiring Mode");
        String hiringLocation = normalizeOptional(readString(row, headerIndexMap, "Hiring Location"));
        String driveStatus = requireText(readString(row, headerIndexMap, "Drive Status"), "Drive Status");
        String eligibleBranches = requireText(readString(row, headerIndexMap, "Eligible Branches"), "Eligible Branches");
        Double eligibleCgpa = parseDoubleRequired(row, headerIndexMap, "Eligible CGPA");
        String jobType = requireText(readString(row, headerIndexMap, "Job Type"), "Job Type");
        String ctcPackage = requireText(readString(row, headerIndexMap, "CTC Package"), "CTC Package");

        PlacementDriveRequest request = new PlacementDriveRequest(
                company.getId(),
                driveTitle,
                hiringYear,
                hiringDate,
                hiringMode,
                hiringLocation,
                eligibleBranches,
                eligibleCgpa,
                parseBoolean(readString(row, headerIndexMap, "Backlogs Allowed")),
                parseIntegerOptional(row, headerIndexMap, "Max Backlogs"),
                normalizeOptional(readString(row, headerIndexMap, "Bond Details")),
                jobType,
                ctcPackage,
                normalizeOptional(readString(row, headerIndexMap, "Stipend")),
                parseIntegerOptional(row, headerIndexMap, "No. of Rounds"),
                normalizeOptional(readString(row, headerIndexMap, "Round Names")),
                parseDateOptional(row, headerIndexMap, "Registration Deadline"),
                parseDateOptional(row, headerIndexMap, "Exam Date"),
                parseDateOptional(row, headerIndexMap, "Interview Date"),
                driveStatus,
                normalizeOptional(readString(row, headerIndexMap, "Description"))
        );

        try {
            validateRequest(request);
        } catch (ResponseStatusException exception) {
            throw new RowValidationException(exception.getReason());
        }

        return request;
    }

    private void persistPlacementDriveRow(PlacementDriveRequest request) {
        Company company = findCompanyOrThrow(request.companyId());
        PlacementDrive placementDrive = new PlacementDrive();
        mapRequestToEntity(request, placementDrive, company);
        placementDriveRepository.save(placementDrive);
    }

    private Optional<Company> findCompanyByImportedName(String importedCompanyName) {
        String normalizedInput = normalizeOptional(importedCompanyName);
        if (normalizedInput == null) {
            return Optional.empty();
        }

        Optional<Company> exactMatch = companyRepository.findByCompanyNameIgnoreCase(normalizedInput.trim());
        if (exactMatch.isPresent()) {
            return exactMatch;
        }

        String canonicalInput = canonicalizeCompanyName(normalizedInput);
        List<Company> companies = companyRepository.findAll();

        List<Company> normalizedMatches = companies.stream()
                .filter(company -> canonicalizeCompanyName(company.getCompanyName()).equals(canonicalInput))
                .toList();
        if (normalizedMatches.size() == 1) {
            return Optional.of(normalizedMatches.get(0));
        }

        List<Company> aliasMatches = companies.stream()
                .filter(company -> {
                    String canonicalCompanyName = canonicalizeCompanyName(company.getCompanyName());
                    return canonicalCompanyName.contains(canonicalInput) || canonicalInput.contains(canonicalCompanyName);
                })
                .sorted(Comparator.comparingInt(company -> canonicalizeCompanyName(company.getCompanyName()).length()))
                .toList();

        if (aliasMatches.size() == 1) {
            return Optional.of(aliasMatches.get(0));
        }
        if (!aliasMatches.isEmpty()) {
            return Optional.of(aliasMatches.get(0));
        }

        return Optional.empty();
    }

    private String readString(Row row, Map<String, Integer> headerIndexMap, String headerName) {
        Integer cellIndex = findHeaderIndex(headerIndexMap, headerName);
        if (cellIndex == null) {
            return "";
        }
        return readCellAsString(row, cellIndex);
    }

    private Integer findHeaderIndex(Map<String, Integer> headerIndexMap, String headerName) {
        return headerIndexMap.get(normalizeHeader(headerName));
    }

    private Cell getCell(Row row, Map<String, Integer> headerIndexMap, String headerName) {
        Integer cellIndex = findHeaderIndex(headerIndexMap, headerName);
        if (cellIndex == null) {
            return null;
        }
        return row.getCell(cellIndex, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
    }

    private String readCellAsString(Row row, Integer index) {
        if (row == null || index == null || index < 0) {
            return "";
        }

        Cell cell = row.getCell(index, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
        if (cell == null) {
            return "";
        }

        if (isExcelDateLikeCell(cell)) {
            return getCellAsLocalDate(cell).toString();
        }

        return DATA_FORMATTER.formatCellValue(cell).trim();
    }

    private boolean isBlankRow(Row row) {
        for (Cell cell : row) {
            if (cell.getCellType() != CellType.BLANK && !DATA_FORMATTER.formatCellValue(cell).trim().isEmpty()) {
                return false;
            }
        }
        return true;
    }

    private LocalDate parseDateRequired(Row row, Map<String, Integer> headerIndexMap, String headerName) {
        LocalDate parsedDate = parseDateOptional(row, headerIndexMap, headerName);
        if (parsedDate == null) {
            throw new RowValidationException("Invalid value in column '" + headerName + "': blank");
        }
        return parsedDate;
    }

    private LocalDate parseDateOptional(Row row, Map<String, Integer> headerIndexMap, String headerName) {
        Cell cell = getCell(row, headerIndexMap, headerName);
        if (cell == null) {
            return null;
        }

        if (isExcelDateLikeCell(cell)) {
            return getCellAsLocalDate(cell);
        }

        String rawValue = normalizeOptional(DATA_FORMATTER.formatCellValue(cell));
        if (rawValue == null) {
            return null;
        }

        for (DateTimeFormatter formatter : DATE_FORMATTERS) {
            try {
                return LocalDate.parse(rawValue, formatter);
            } catch (DateTimeParseException ignored) {
            }
        }

        throw new RowValidationException("Invalid value in column '" + headerName + "': " + rawValue);
    }

    private boolean isExcelDateLikeCell(Cell cell) {
        if (cell == null) {
            return false;
        }

        CellType cellType = cell.getCellType();
        if (cellType == CellType.FORMULA) {
            cellType = cell.getCachedFormulaResultType();
        }

        if (cellType != CellType.NUMERIC) {
            return false;
        }

        return DateUtil.isCellDateFormatted(cell);
    }

    private LocalDate getCellAsLocalDate(Cell cell) {
        return DateUtil.getLocalDateTime(cell.getNumericCellValue()).toLocalDate();
    }

    private Integer parseIntegerRequired(Row row, Map<String, Integer> headerIndexMap, String fieldName) {
        Integer parsedValue = parseIntegerOptional(row, headerIndexMap, fieldName);
        if (parsedValue == null) {
            throw new RowValidationException("Invalid value in column '" + fieldName + "': blank");
        }
        return parsedValue;
    }

    private Integer parseIntegerOptional(Row row, Map<String, Integer> headerIndexMap, String fieldName) {
        Cell cell = getCell(row, headerIndexMap, fieldName);
        if (cell == null) {
            return null;
        }

        CellType cellType = cell.getCellType();
        if (cellType == CellType.FORMULA) {
            cellType = cell.getCachedFormulaResultType();
        }

        if (cellType == CellType.NUMERIC) {
            if (isExcelDateLikeCell(cell)) {
                String rawValue = DATA_FORMATTER.formatCellValue(cell).trim();
                throw new RowValidationException("Invalid value in column '" + fieldName + "': " + rawValue);
            }
            return parseWholeNumberValue(BigDecimal.valueOf(cell.getNumericCellValue()), fieldName,
                    DATA_FORMATTER.formatCellValue(cell).trim());
        }

        String normalizedValue = normalizeOptional(DATA_FORMATTER.formatCellValue(cell));
        if (normalizedValue == null) {
            return null;
        }

        try {
            return parseWholeNumberValue(new BigDecimal(normalizedValue), fieldName, normalizedValue);
        } catch (NumberFormatException exception) {
            throw new RowValidationException("Invalid value in column '" + fieldName + "': " + normalizedValue);
        } catch (ArithmeticException exception) {
            throw new RowValidationException("Invalid value in column '" + fieldName + "': " + normalizedValue);
        }
    }

    private Integer parseWholeNumberValue(BigDecimal value, String fieldName, String rawValue) {
        BigDecimal normalizedValue = value.stripTrailingZeros();
        if (normalizedValue.scale() > 0) {
            throw new RowValidationException("Invalid value in column '" + fieldName + "': " + rawValue);
        }
        return normalizedValue.intValueExact();
    }

    private Double parseDoubleRequired(Row row, Map<String, Integer> headerIndexMap, String fieldName) {
        Double parsedValue = parseDoubleOptional(row, headerIndexMap, fieldName);
        if (parsedValue == null) {
            throw new RowValidationException("Invalid value in column '" + fieldName + "': blank");
        }
        return parsedValue;
    }

    private Double parseDoubleOptional(Row row, Map<String, Integer> headerIndexMap, String fieldName) {
        Cell cell = getCell(row, headerIndexMap, fieldName);
        if (cell == null) {
            return null;
        }

        CellType cellType = cell.getCellType();
        if (cellType == CellType.FORMULA) {
            cellType = cell.getCachedFormulaResultType();
        }

        if (cellType == CellType.NUMERIC) {
            if (isExcelDateLikeCell(cell)) {
                String rawValue = DATA_FORMATTER.formatCellValue(cell).trim();
                throw new RowValidationException("Invalid value in column '" + fieldName + "': " + rawValue);
            }
            return cell.getNumericCellValue();
        }

        String normalizedValue = normalizeOptional(DATA_FORMATTER.formatCellValue(cell));
        if (normalizedValue == null) {
            return null;
        }

        try {
            return Double.parseDouble(normalizedValue);
        } catch (NumberFormatException exception) {
            throw new RowValidationException("Invalid value in column '" + fieldName + "': " + normalizedValue);
        }
    }

    private Boolean parseBoolean(String value) {
        String normalizedValue = normalizeOptional(value);
        if (normalizedValue == null) {
            return Boolean.FALSE;
        }

        String lower = normalizedValue.toLowerCase(Locale.ENGLISH);
        return switch (lower) {
            case "yes", "y", "true", "1" -> true;
            case "no", "n", "false", "0" -> false;
            default -> throw new RowValidationException(
                    "Backlogs Allowed must be Yes/No, True/False, or 1/0.");
        };
    }

    private String requireText(String value, String fieldName) {
        String normalizedValue = normalizeOptional(value);
        if (normalizedValue == null) {
            throw new RowValidationException(fieldName + " is required.");
        }
        return normalizedValue;
    }

    private String normalizeHeader(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ENGLISH)
                .replace(".", "")
                .replace("_", "")
                .replace("-", "")
                .replace(" ", "")
                .trim();
    }

    private String canonicalizeCompanyName(String value) {
        String normalizedValue = normalizeOptional(value);
        if (normalizedValue == null) {
            return "";
        }

        String canonical = normalizedValue.toLowerCase(Locale.ENGLISH)
                .replace("&", "and")
                .replaceAll("[^a-z0-9]", "");

        if (canonical.startsWith("ltm")) {
            canonical = "lti" + canonical.substring(3);
        }

        return canonical;
    }

    private void mapRequestToEntity(PlacementDriveRequest request, PlacementDrive placementDrive, Company company) {
        placementDrive.setCompany(company);
        placementDrive.setDriveTitle(request.driveTitle().trim());
        placementDrive.setHiringYear(request.hiringYear());
        placementDrive.setHiringDate(request.hiringDate());
        placementDrive.setHiringMode(request.hiringMode().trim());
        placementDrive.setHiringLocation(normalizeOptional(request.hiringLocation()));
        placementDrive.setEligibleBranches(request.eligibleBranches().trim());
        placementDrive.setEligibleCgpa(request.eligibleCgpa());
        placementDrive.setBacklogsAllowed(Boolean.TRUE.equals(request.backlogsAllowed()));
        placementDrive.setMaxBacklogs(request.maxBacklogs());
        placementDrive.setBondDetails(normalizeOptional(request.bondDetails()));
        placementDrive.setJobType(request.jobType().trim());
        placementDrive.setCtcPackage(request.ctcPackage().trim());
        placementDrive.setStipend(normalizeOptional(request.stipend()));
        placementDrive.setNumberOfRounds(request.numberOfRounds());
        placementDrive.setRoundNames(normalizeOptional(request.roundNames()));
        placementDrive.setRegistrationDeadline(request.registrationDeadline());
        placementDrive.setExamDate(request.examDate());
        placementDrive.setInterviewDate(request.interviewDate());
        placementDrive.setDriveStatus(request.driveStatus().trim());
        placementDrive.setDescription(normalizeOptional(request.description()));
        if (placementDrive.getActive() == null) {
            placementDrive.setActive(true);
        }
    }

    private String normalizeOptional(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
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
        return causeMessage != null ? causeMessage : "Unable to process placement drive record";
    }

    private String sanitizeExceptionMessage(String message) {
        if (message == null) {
            return null;
        }
        String singleLine = message.replaceAll("\\s+", " ").trim();
        return singleLine.isEmpty() ? null : singleLine;
    }

    private PlacementDriveResponse toResponse(PlacementDrive placementDrive) {
        Company company = placementDrive.getCompany();
        return new PlacementDriveResponse(
                placementDrive.getId(),
                company.getId(),
                company.getCompanyName(),
                company.getLogoUrl(),
                company.getWebsiteUrl(),
                company.getCompanyType(),
                company.getIndustry(),
                placementDrive.getDriveTitle(),
                placementDrive.getHiringYear(),
                placementDrive.getHiringDate(),
                placementDrive.getHiringMode(),
                placementDrive.getHiringLocation(),
                placementDrive.getEligibleBranches(),
                placementDrive.getEligibleCgpa(),
                placementDrive.getBacklogsAllowed(),
                placementDrive.getMaxBacklogs(),
                placementDrive.getBondDetails(),
                placementDrive.getJobType(),
                placementDrive.getCtcPackage(),
                placementDrive.getStipend(),
                placementDrive.getNumberOfRounds(),
                placementDrive.getRoundNames(),
                placementDrive.getRegistrationDeadline(),
                placementDrive.getExamDate(),
                placementDrive.getInterviewDate(),
                placementDrive.getDriveStatus(),
                placementDrive.getDescription(),
                placementDrive.getActive(),
                placementDrive.getCreatedAt(),
                placementDrive.getUpdatedAt()
        );
    }

    private static class RowValidationException extends RuntimeException {
        private RowValidationException(String message) {
            super(message);
        }
    }
}
