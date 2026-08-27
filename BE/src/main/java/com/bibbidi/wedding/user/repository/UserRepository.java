package com.bibbidi.wedding.user.repository;

import static com.bibbidi.wedding.common.exception.ClientError.USER_NOT_FOUND;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.user.domain.User;
import com.bibbidi.wedding.user.persistence.JpaUserEntity;
import com.bibbidi.wedding.user.persistence.JpaUserRepository;
import java.util.NoSuchElementException;
import org.jspecify.annotations.NonNull;
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

    public boolean existsByNicknameExcludingUser(String nickname, Long userId) {
        return jpaUserRepository.existsByNicknameIgnoreCaseAndIdNot(nickname, userId);
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

    public User findById(Long userId) {
        return userMapper.toDomain(
                getJpaUserEntity(userId)
        );
    }

    public void updateNickname(Long userId, String nickname) {
        JpaUserEntity entity = getJpaUserEntity(userId);
        entity.changeNickname(nickname);
        jpaUserRepository.save(entity);
    }

    private @NonNull JpaUserEntity getJpaUserEntity(Long userId) {
        return jpaUserRepository.findById(userId)
                .orElseThrow(
                        () -> new BusinessException(
                                USER_NOT_FOUND,
                                "제공받은 아이디를 기반으로 회원을 찾을 수 없습니다." + userId
                        )
                );
    }
}
