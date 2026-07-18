package com.iare.placementportal.repository;

import com.iare.placementportal.entity.PreparationResource;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PreparationResourceRepository extends JpaRepository<PreparationResource, Long> {

    List<PreparationResource> findAllByOrderByCreatedAtDesc();

    List<PreparationResource> findByActiveTrueOrderByCreatedAtDesc();

    List<PreparationResource> findByPlacementDriveIdOrderByCreatedAtDesc(Long placementDriveId);

    List<PreparationResource> findByPlacementDriveIdAndActiveTrueOrderByCreatedAtDesc(Long placementDriveId);

    @EntityGraph(attributePaths = {"placementDrive", "placementDrive.company"})
    @Query("""
            select pr from PreparationResource pr
            join pr.placementDrive pd
            join pd.company c
            where pr.active = true
              and lower(c.companyName) = lower(:companyName)
              and (:hiringYear is null or pd.hiringYear = :hiringYear)
            order by pr.createdAt desc, pr.id desc
            """)
    List<PreparationResource> findActiveByCompanyName(@Param("companyName") String companyName,
                                                      @Param("hiringYear") Integer hiringYear,
                                                      Pageable pageable);

    @Query("""
            select count(pr)
            from PreparationResource pr
            join pr.placementDrive pd
            join pd.company c
            where pr.active = true
              and lower(c.companyName) = lower(:companyName)
              and (:hiringYear is null or pd.hiringYear = :hiringYear)
            """)
    long countActiveByCompanyName(@Param("companyName") String companyName,
                                  @Param("hiringYear") Integer hiringYear);
}
