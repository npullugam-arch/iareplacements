package com.iare.placementportal.repository;

import com.iare.placementportal.entity.PlacementDrive;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PlacementDriveRepository extends JpaRepository<PlacementDrive, Long> {

    List<PlacementDrive> findAllByOrderByCreatedAtDesc();

    List<PlacementDrive> findByActiveTrueOrderByCreatedAtDesc();

    List<PlacementDrive> findByCompanyIdOrderByCreatedAtDesc(Long companyId);

    List<PlacementDrive> findByCompanyIdAndActiveTrueOrderByCreatedAtDesc(Long companyId);

    @EntityGraph(attributePaths = "company")
    @Query(
            value = """
                    select pd
                    from PlacementDrive pd
                    join pd.company c
                    where pd.active = true
                      and (
                        :search = ''
                        or lower(c.companyName) like lower(concat('%', :search, '%'))
                        or lower(pd.driveTitle) like lower(concat('%', :search, '%'))
                      )
                      and (:hiringYear is null or pd.hiringYear = :hiringYear)
                      and (:driveStatus = '' or lower(pd.driveStatus) = lower(:driveStatus))
                      and (:jobType = '' or lower(pd.jobType) = lower(:jobType))
                    order by pd.createdAt desc, pd.id desc
                    """,
            countQuery = """
                    select count(pd)
                    from PlacementDrive pd
                    join pd.company c
                    where pd.active = true
                      and (
                        :search = ''
                        or lower(c.companyName) like lower(concat('%', :search, '%'))
                        or lower(pd.driveTitle) like lower(concat('%', :search, '%'))
                      )
                      and (:hiringYear is null or pd.hiringYear = :hiringYear)
                      and (:driveStatus = '' or lower(pd.driveStatus) = lower(:driveStatus))
                      and (:jobType = '' or lower(pd.jobType) = lower(:jobType))
                    """
    )
    Page<PlacementDrive> findStudentDrivePage(
            @Param("search") String search,
            @Param("hiringYear") Integer hiringYear,
            @Param("driveStatus") String driveStatus,
            @Param("jobType") String jobType,
            Pageable pageable
    );

    @Query("""
            select distinct pd.hiringYear
            from PlacementDrive pd
            where pd.active = true and pd.hiringYear is not null
            order by pd.hiringYear desc
            """)
    List<Integer> findDistinctActiveHiringYears();

    @Query("""
            select distinct pd.jobType
            from PlacementDrive pd
            where pd.active = true and pd.jobType is not null and trim(pd.jobType) <> ''
            order by pd.jobType asc
            """)
    List<String> findDistinctActiveJobTypes();

    @Query("""
            select count(distinct c.id)
            from PlacementDrive pd
            join pd.company c
            where pd.active = true
              and pd.hiringYear = :hiringYear
            """)
    long countDistinctActiveCompaniesByHiringYear(@Param("hiringYear") Integer hiringYear);

    @Query("""
            select distinct c.companyName
            from PlacementDrive pd
            join pd.company c
            where pd.active = true
              and pd.hiringYear = :hiringYear
              and c.companyName is not null
              and trim(c.companyName) <> ''
            order by c.companyName asc
            """)
    List<String> findDistinctActiveCompanyNamesByHiringYear(@Param("hiringYear") Integer hiringYear);

    @EntityGraph(attributePaths = "company")
    @Query("""
            select pd
            from PlacementDrive pd
            join pd.company c
            where pd.active = true
              and lower(c.companyName) = lower(:companyName)
              and (:hiringYear is null or pd.hiringYear = :hiringYear)
            order by pd.hiringDate desc, pd.id desc
            """)
    List<PlacementDrive> findActiveByCompanyName(@Param("companyName") String companyName,
                                                 @Param("hiringYear") Integer hiringYear,
                                                 Pageable pageable);
}
