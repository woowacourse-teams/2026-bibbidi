package com.bibbidi.wedding.user.repository;

import com.bibbidi.wedding.user.domain.User;
import com.bibbidi.wedding.user.persistence.JpaUserEntity;
import org.springframework.stereotype.Component;

@Component
public class UserMapper {

    public JpaUserEntity toEntity(User user) {
        return new JpaUserEntity(user.id(), user.nickname(), user.passwordHash());
    }

    public User toDomain(JpaUserEntity entity) {
        return User.restore(entity.id(), entity.nickname(), entity.passwordHash());
    }
}
