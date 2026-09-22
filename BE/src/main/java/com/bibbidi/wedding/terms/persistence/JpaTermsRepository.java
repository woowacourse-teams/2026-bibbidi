package com.bibbidi.wedding.terms.persistence;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface JpaTermsRepository extends JpaRepository<JpaTermsEntity, Long> {

    List<JpaTermsEntity> findAllByRequiredTrue();
}
