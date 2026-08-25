package com.bibbidi.wedding.user.persistence;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserDao extends JpaRepository<UserEntity, Long> {

    boolean existsByNicknameIgnoreCase(String nickname);

    Optional<UserEntity> findByNicknameIgnoreCase(String nickname);
}
