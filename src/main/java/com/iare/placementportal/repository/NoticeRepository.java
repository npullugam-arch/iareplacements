package com.iare.placementportal.repository;

import com.iare.placementportal.entity.Notice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface NoticeRepository extends JpaRepository<Notice, Long> {

    List<Notice> findAllByOrderByCreatedAtDesc();

    List<Notice> findByActiveTrueOrderByCreatedAtDesc();

    @Query("""
            select notice
            from Notice notice
            where notice.active = true
              and notice.validFrom <= :today
              and notice.validTo >= :today
            order by notice.createdAt desc
            """)
    List<Notice> findCurrentlyActiveNotices(@Param("today") LocalDate today);

    @Query("""
            select count(notice)
            from Notice notice
            where notice.active = true
              and notice.validFrom <= :today
              and notice.validTo >= :today
            """)
    long countCurrentlyActiveNotices(@Param("today") LocalDate today);
}
