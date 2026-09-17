package com.bibbidi.wedding.feedback.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

public interface JpaFeedbackRepository extends JpaRepository<JpaFeedbackEntity, Long> {
}
