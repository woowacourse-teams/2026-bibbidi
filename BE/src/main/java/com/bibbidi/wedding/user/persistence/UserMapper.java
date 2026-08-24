package com.bibbidi.wedding.user.persistence;

import com.bibbidi.wedding.user.domain.User;
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
