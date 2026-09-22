package com.bibbidi.wedding.user.repository;

import com.bibbidi.wedding.user.domain.User;
import com.bibbidi.wedding.user.persistence.JpaUserEntity;
import java.time.LocalDate;
import org.springframework.stereotype.Component;

@Component
public class UserMapper {

    public JpaUserEntity toEntity(User user) {
        return toEntity(user, null);
    }

    public JpaUserEntity toEntity(User user, LocalDate weddingDate) {
        return new JpaUserEntity(
                user.id(),
                user.nickname(),
                user.status(),
                user.role(),
                user.email(),
                weddingDate);
    }

    public User toDomain(JpaUserEntity entity) {
        return new User(
                entity.id(),
                entity.nickname(),
                entity.status(),
                entity.role(),
                entity.email());
    }
}
