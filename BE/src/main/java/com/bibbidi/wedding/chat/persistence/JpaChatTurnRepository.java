package com.bibbidi.wedding.chat.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

public interface JpaChatTurnRepository extends JpaRepository<JpaChatTurnEntity, Long> {
}
