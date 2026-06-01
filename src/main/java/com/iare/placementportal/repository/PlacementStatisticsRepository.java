package com.iare.placementportal.repository;

import com.iare.placementportal.entity.PlacementStatistics;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PlacementStatisticsRepository extends JpaRepository<PlacementStatistics, Long> {

    List<PlacementStatistics> findAllByOrderByCreatedAtDesc();

    List<PlacementStatistics> findByActiveTrueOrderByCreatedAtDesc();

    Optional<PlacementStatistics> findByPlacementDriveId(Long placementDriveId);

    boolean existsByPlacementDriveId(Long placementDriveId);

    @EntityGraph(attributePaths = {"placementDrive", "placementDrive.company"})
    @Query("""
            select ps from PlacementStatistics ps
            join ps.placementDrive pd
            join pd.company c
            where ps.active = true
              and (:search = '' or
                   lower(c.companyName) like lower(concat('%', :search, '%')) or
                   lower(pd.driveTitle) like lower(concat('%', :search, '%')))
              and (:hiringYear is null or pd.hiringYear = :hiringYear)
              and (:driveStatus = '' or lower(pd.driveStatus) = lower(:driveStatus))
            """)
    Page<PlacementStatistics> findActivePageForStudents(@Param("search") String search,
                                                        @Param("hiringYear") Integer hiringYear,
                                                        @Param("driveStatus") String driveStatus,
                                                        Pageable pageable);

    @Query("""
            select distinct pd.hiringYear from PlacementStatistics ps
            join ps.placementDrive pd
            where ps.active = true
              and pd.hiringYear is not null
            order by pd.hiringYear desc
            """)
    List<Integer> findDistinctActiveHiringYears();

    @Query("""
            select max(ps.highestPackage)
            from PlacementStatistics ps
            join ps.placementDrive pd
            where ps.active = true
              and pd.hiringYear = :hiringYear
            """)
    Double findHighestPackageByHiringYear(@Param("hiringYear") Integer hiringYear);

    @Query("""
            select avg(ps.averagePackage)
            from PlacementStatistics ps
            join ps.placementDrive pd
            where ps.active = true
              and pd.hiringYear = :hiringYear
              and ps.averagePackage is not null
            """)
    Double findAveragePackageByHiringYear(@Param("hiringYear") Integer hiringYear);

    @EntityGraph(attributePaths = {"placementDrive", "placementDrive.company"})
    @Query("""
            select ps from PlacementStatistics ps
            join ps.placementDrive pd
            join pd.company c
            where ps.active = true
              and lower(c.companyName) = lower(:companyName)
              and (:hiringYear is null or pd.hiringYear = :hiringYear)
            order by pd.hiringYear desc, ps.createdAt desc, ps.id desc
            """)
    List<PlacementStatistics> findActiveByCompanyName(@Param("companyName") String companyName,
                                                      @Param("hiringYear") Integer hiringYear,
                                                      Pageable pageable);
}
