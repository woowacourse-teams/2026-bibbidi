package com.bibbidi.wedding.user.persistence;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserDao extends JpaRepository<UserEntity, UUID> {

    boolean existsByNicknameIgnoreCase(String nickname);

    Optional<UserEntity> findByNicknameIgnoreCase(String nickname);
}
