package com.bibbidi.wedding.user.repository;

import com.bibbidi.wedding.user.domain.User;
import com.bibbidi.wedding.user.persistence.UserEntity;
import org.springframework.stereotype.Component;

@Component
public class UserMapper {

    public UserEntity toEntity(User user) {
        return new UserEntity(user.id(), user.nickname(), user.passwordHash());
    }

    public User toDomain(UserEntity entity) {
        return User.restore(entity.id(), entity.nickname(), entity.passwordHash());
    }
}
