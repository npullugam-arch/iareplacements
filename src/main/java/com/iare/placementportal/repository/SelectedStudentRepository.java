package com.iare.placementportal.repository;

import com.iare.placementportal.entity.SelectedStudent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SelectedStudentRepository extends JpaRepository<SelectedStudent, Long> {

    List<SelectedStudent> findAllByOrderByCreatedAtDesc();

    List<SelectedStudent> findByActiveTrueOrderByCreatedAtDesc();

    List<SelectedStudent> findByPlacementDriveIdOrderByCreatedAtDesc(Long placementDriveId);

    List<SelectedStudent> findByPlacementDriveIdAndActiveTrueOrderByCreatedAtDesc(Long placementDriveId);

    boolean existsByPlacementDriveIdAndRollNumberIgnoreCase(Long placementDriveId, String rollNumber);

    @EntityGraph(attributePaths = {"placementDrive", "placementDrive.company"})
    @Query("""
            select ss from SelectedStudent ss
            join ss.placementDrive pd
            join pd.company c
            where ss.active = true
              and (:search = '' or
                   lower(ss.studentName) like lower(concat('%', :search, '%')) or
                   lower(ss.rollNumber) like lower(concat('%', :search, '%')) or
                   lower(ss.branch) like lower(concat('%', :search, '%')) or
                   lower(ss.packageOffered) like lower(concat('%', :search, '%')) or
                   lower(ss.offerType) like lower(concat('%', :search, '%')) or
                   lower(pd.driveTitle) like lower(concat('%', :search, '%')) or
                   lower(c.companyName) like lower(concat('%', :search, '%')) or
                   str(ss.selectionYear) like concat('%', :search, '%'))
              and (:branch = '' or lower(ss.branch) = lower(:branch))
              and (:company = '' or lower(c.companyName) = lower(:company))
            """)
    Page<SelectedStudent> findActivePageForStudents(@Param("search") String search,
                                                    @Param("branch") String branch,
                                                    @Param("company") String company,
                                                    Pageable pageable);

    @Query("""
            select distinct ss.branch from SelectedStudent ss
            where ss.active = true
              and ss.branch is not null
              and trim(ss.branch) <> ''
            order by ss.branch asc
            """)
    List<String> findDistinctActiveBranches();

    @Query("""
            select distinct c.companyName from SelectedStudent ss
            join ss.placementDrive pd
            join pd.company c
            where ss.active = true
              and c.companyName is not null
              and trim(c.companyName) <> ''
            order by c.companyName asc
            """)
    List<String> findDistinctActiveCompanyNames();

    @EntityGraph(attributePaths = {"placementDrive", "placementDrive.company"})
    @Query("""
            select ss from SelectedStudent ss
            join ss.placementDrive pd
            join pd.company c
            where ss.active = true
              and lower(c.companyName) = lower(:companyName)
              and (:year is null or pd.hiringYear = :year or ss.selectionYear = :year)
              and (:branch = '' or lower(ss.branch) = lower(:branch))
            order by ss.createdAt desc, ss.id desc
            """)
    List<SelectedStudent> findTopActiveByCompanyName(@Param("companyName") String companyName,
                                                     @Param("year") Integer year,
                                                     @Param("branch") String branch,
                                                     Pageable pageable);

    @Query("""
            select count(ss) from SelectedStudent ss
            join ss.placementDrive pd
            join pd.company c
            where ss.active = true
              and lower(c.companyName) = lower(:companyName)
              and (:year is null or pd.hiringYear = :year or ss.selectionYear = :year)
              and (:branch = '' or lower(ss.branch) = lower(:branch))
            """)
    long countActiveByCompanyName(@Param("companyName") String companyName,
                                  @Param("year") Integer year,
                                  @Param("branch") String branch);
}
