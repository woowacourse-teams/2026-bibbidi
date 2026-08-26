package com.bibbidi.wedding.user.repository;

import com.bibbidi.wedding.user.domain.User;
import com.bibbidi.wedding.user.persistence.JpaUserEntity;
import com.bibbidi.wedding.user.persistence.JpaUserRepository;
import java.util.NoSuchElementException;
import org.springframework.stereotype.Repository;

@Repository
public class UserRepository {

    private final JpaUserRepository jpaUserRepository;
    private final UserMapper userMapper;

    public UserRepository(JpaUserRepository jpaUserRepository, UserMapper userMapper) {
        this.jpaUserRepository = jpaUserRepository;
        this.userMapper = userMapper;
    }

    public boolean existsByNickname(String nickname) {
        return jpaUserRepository.existsByNicknameIgnoreCase(nickname);
    }

    public User save(User user) {
        JpaUserEntity saved = jpaUserRepository.save(userMapper.toEntity(user));
        return userMapper.toDomain(saved);
    }

    public User findByNickname(String nickname) {
        return jpaUserRepository.findByNicknameIgnoreCase(nickname)
                .map(userMapper::toDomain)
                .orElseThrow(NoSuchElementException::new);
    }
}
