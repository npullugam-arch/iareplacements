package com.iare.placementportal.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "students")
public class Student {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String rollNo;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private String studentName;

    private String gender;
    private String status;
    private String caste;
    private String subCaste;
    private String religion;
    private String branch;
    private Integer semester;
    private String admissionCategory;
    private String feeCategory;
    private String cetRank;
    private String sscMarks;
    private String sscPercentage;
    private String interMarks;
    private String interPercentage;
    private String ugMarks;
    private String ugPercentage;
    private String dob;
    private String doj;
    private String fatherName;
    private String motherName;
    private String studentPhone;
    private String parentPhone;
    private String motherPhone;
    private String studentEmailId;

    @Lob
    private String currentAddress;

    @Lob
    private String permanentAddress;

    private String aadhar;

    @Column(length = 1000)
    private String fatherOccupation;

    @Column(length = 1000)
    private String occupationType;

    @Column(length = 1000)
    private String income;
    private String section;

    @Column(length = 1000)
    private String moles;
    private String placeOfBirth;
    private String currentDno;
    private String currentStreet;
    private String currentVillageTown;
    private String currentMandal;
    private String currentDistrict;
    private String currentState;
    private String currentPincode;
    private String permanentDno;
    private String permanentStreet;
    private String permanentVillageTown;
    private String permanentMandal;
    private String permanentDistrict;
    private String permanentState;
    private String permanentPincode;
    private String domicileState;
    private String sscState;
    private String interState;

    @Column(length = 1000)
    private String photoUrl;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @Column(nullable = false)
    private Boolean active = true;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
        if (this.active == null) {
            this.active = true;
        }
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getRollNo() {
        return rollNo;
    }

    public void setRollNo(String rollNo) {
        this.rollNo = rollNo;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getStudentName() {
        return studentName;
    }

    public void setStudentName(String studentName) {
        this.studentName = studentName;
    }

    public String getGender() {
        return gender;
    }

    public void setGender(String gender) {
        this.gender = gender;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getCaste() {
        return caste;
    }

    public void setCaste(String caste) {
        this.caste = caste;
    }

    public String getSubCaste() {
        return subCaste;
    }

    public void setSubCaste(String subCaste) {
        this.subCaste = subCaste;
    }

    public String getReligion() {
        return religion;
    }

    public void setReligion(String religion) {
        this.religion = religion;
    }

    public String getBranch() {
        return branch;
    }

    public void setBranch(String branch) {
        this.branch = branch;
    }

    public Integer getSemester() {
        return semester;
    }

    public void setSemester(Integer semester) {
        this.semester = semester;
    }

    public String getAdmissionCategory() {
        return admissionCategory;
    }

    public void setAdmissionCategory(String admissionCategory) {
        this.admissionCategory = admissionCategory;
    }

    public String getFeeCategory() {
        return feeCategory;
    }

    public void setFeeCategory(String feeCategory) {
        this.feeCategory = feeCategory;
    }

    public String getCetRank() {
        return cetRank;
    }

    public void setCetRank(String cetRank) {
        this.cetRank = cetRank;
    }

    public String getSscMarks() {
        return sscMarks;
    }

    public void setSscMarks(String sscMarks) {
        this.sscMarks = sscMarks;
    }

    public String getSscPercentage() {
        return sscPercentage;
    }

    public void setSscPercentage(String sscPercentage) {
        this.sscPercentage = sscPercentage;
    }

    public String getInterMarks() {
        return interMarks;
    }

    public void setInterMarks(String interMarks) {
        this.interMarks = interMarks;
    }

    public String getInterPercentage() {
        return interPercentage;
    }

    public void setInterPercentage(String interPercentage) {
        this.interPercentage = interPercentage;
    }

    public String getUgMarks() {
        return ugMarks;
    }

    public void setUgMarks(String ugMarks) {
        this.ugMarks = ugMarks;
    }

    public String getUgPercentage() {
        return ugPercentage;
    }

    public void setUgPercentage(String ugPercentage) {
        this.ugPercentage = ugPercentage;
    }

    public String getDob() {
        return dob;
    }

    public void setDob(String dob) {
        this.dob = dob;
    }

    public String getDoj() {
        return doj;
    }

    public void setDoj(String doj) {
        this.doj = doj;
    }

    public String getFatherName() {
        return fatherName;
    }

    public void setFatherName(String fatherName) {
        this.fatherName = fatherName;
    }

    public String getMotherName() {
        return motherName;
    }

    public void setMotherName(String motherName) {
        this.motherName = motherName;
    }

    public String getStudentPhone() {
        return studentPhone;
    }

    public void setStudentPhone(String studentPhone) {
        this.studentPhone = studentPhone;
    }

    public String getParentPhone() {
        return parentPhone;
    }

    public void setParentPhone(String parentPhone) {
        this.parentPhone = parentPhone;
    }

    public String getMotherPhone() {
        return motherPhone;
    }

    public void setMotherPhone(String motherPhone) {
        this.motherPhone = motherPhone;
    }

    public String getStudentEmailId() {
        return studentEmailId;
    }

    public void setStudentEmailId(String studentEmailId) {
        this.studentEmailId = studentEmailId;
    }

    public String getCurrentAddress() {
        return currentAddress;
    }

    public void setCurrentAddress(String currentAddress) {
        this.currentAddress = currentAddress;
    }

    public String getPermanentAddress() {
        return permanentAddress;
    }

    public void setPermanentAddress(String permanentAddress) {
        this.permanentAddress = permanentAddress;
    }

    public String getAadhar() {
        return aadhar;
    }

    public void setAadhar(String aadhar) {
        this.aadhar = aadhar;
    }

    public String getFatherOccupation() {
        return fatherOccupation;
    }

    public void setFatherOccupation(String fatherOccupation) {
        this.fatherOccupation = fatherOccupation;
    }

    public String getOccupationType() {
        return occupationType;
    }

    public void setOccupationType(String occupationType) {
        this.occupationType = occupationType;
    }

    public String getIncome() {
        return income;
    }

    public void setIncome(String income) {
        this.income = income;
    }

    public String getSection() {
        return section;
    }

    public void setSection(String section) {
        this.section = section;
    }

    public String getMoles() {
        return moles;
    }

    public void setMoles(String moles) {
        this.moles = moles;
    }

    public String getPlaceOfBirth() {
        return placeOfBirth;
    }

    public void setPlaceOfBirth(String placeOfBirth) {
        this.placeOfBirth = placeOfBirth;
    }

    public String getCurrentDno() {
        return currentDno;
    }

    public void setCurrentDno(String currentDno) {
        this.currentDno = currentDno;
    }

    public String getCurrentStreet() {
        return currentStreet;
    }

    public void setCurrentStreet(String currentStreet) {
        this.currentStreet = currentStreet;
    }

    public String getCurrentVillageTown() {
        return currentVillageTown;
    }

    public void setCurrentVillageTown(String currentVillageTown) {
        this.currentVillageTown = currentVillageTown;
    }

    public String getCurrentMandal() {
        return currentMandal;
    }

    public void setCurrentMandal(String currentMandal) {
        this.currentMandal = currentMandal;
    }

    public String getCurrentDistrict() {
        return currentDistrict;
    }

    public void setCurrentDistrict(String currentDistrict) {
        this.currentDistrict = currentDistrict;
    }

    public String getCurrentState() {
        return currentState;
    }

    public void setCurrentState(String currentState) {
        this.currentState = currentState;
    }

    public String getCurrentPincode() {
        return currentPincode;
    }

    public void setCurrentPincode(String currentPincode) {
        this.currentPincode = currentPincode;
    }

    public String getPermanentDno() {
        return permanentDno;
    }

    public void setPermanentDno(String permanentDno) {
        this.permanentDno = permanentDno;
    }

    public String getPermanentStreet() {
        return permanentStreet;
    }

    public void setPermanentStreet(String permanentStreet) {
        this.permanentStreet = permanentStreet;
    }

    public String getPermanentVillageTown() {
        return permanentVillageTown;
    }

    public void setPermanentVillageTown(String permanentVillageTown) {
        this.permanentVillageTown = permanentVillageTown;
    }

    public String getPermanentMandal() {
        return permanentMandal;
    }

    public void setPermanentMandal(String permanentMandal) {
        this.permanentMandal = permanentMandal;
    }

    public String getPermanentDistrict() {
        return permanentDistrict;
    }

    public void setPermanentDistrict(String permanentDistrict) {
        this.permanentDistrict = permanentDistrict;
    }

    public String getPermanentState() {
        return permanentState;
    }

    public void setPermanentState(String permanentState) {
        this.permanentState = permanentState;
    }

    public String getPermanentPincode() {
        return permanentPincode;
    }

    public void setPermanentPincode(String permanentPincode) {
        this.permanentPincode = permanentPincode;
    }

    public String getDomicileState() {
        return domicileState;
    }

    public void setDomicileState(String domicileState) {
        this.domicileState = domicileState;
    }

    public String getSscState() {
        return sscState;
    }

    public void setSscState(String sscState) {
        this.sscState = sscState;
    }

    public String getInterState() {
        return interState;
    }

    public void setInterState(String interState) {
        this.interState = interState;
    }

    public String getPhotoUrl() {
        return photoUrl;
    }

    public void setPhotoUrl(String photoUrl) {
        this.photoUrl = photoUrl;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Boolean getActive() {
        return active;
    }

    public void setActive(Boolean active) {
        this.active = active;
    }
}
