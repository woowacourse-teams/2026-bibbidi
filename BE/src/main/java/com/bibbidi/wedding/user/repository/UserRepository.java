package com.bibbidi.wedding.user.repository;

import static com.bibbidi.wedding.common.exception.ClientError.USER_NOT_FOUND;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.user.domain.User;
import com.bibbidi.wedding.user.domain.WeddingDate;
import com.bibbidi.wedding.user.persistence.JpaUserEntity;
import com.bibbidi.wedding.user.persistence.JpaUserRepository;
import com.bibbidi.wedding.user.service.dto.PasswordLoginInfo;
import java.util.Optional;
import org.jspecify.annotations.NonNull;
import org.springframework.stereotype.Repository;

@Repository
public class UserRepository {

    private static final String USER_NOT_FOUND_MESSAGE = "제공받은 아이디를 기반으로 회원을 찾을 수 없습니다. userId=";

    private final JpaUserRepository jpaUserRepository;
    private final UserMapper userMapper;

    public UserRepository(JpaUserRepository jpaUserRepository, UserMapper userMapper) {
        this.jpaUserRepository = jpaUserRepository;
        this.userMapper = userMapper;
    }

    public boolean existsByNickname(String nickname) {
        return jpaUserRepository.existsByNicknameIgnoreCase(nickname);
    }

    /**
     * 소셜 가입으로 만들어지는 회원이다.
     * 소셜에서 받은 닉네임은 서로 겹칠 수 있으므로 닉네임 중복을 막지 않는다.
     */
    public User create(User user) {
        JpaUserEntity saved = jpaUserRepository.saveAndFlush(userMapper.toEntity(user));
        return userMapper.toDomain(saved);
    }

    public User update(User user) {
        JpaUserEntity currentEntity = getJpaUserEntity(user.id());
        JpaUserEntity saved = jpaUserRepository.saveAndFlush(
                userMapper.toEntity(user, currentEntity.weddingDate()));
        return userMapper.toDomain(saved);
    }

    public User findById(Long userId) {
        return userMapper.toDomain(
                getJpaUserEntity(userId)
        );
    }

    public WeddingDate findWeddingDateByUserId(Long userId) {
        JpaUserEntity entity = getJpaUserEntity(userId);
        return new WeddingDate(entity.id(), entity.weddingDate());
    }

    public WeddingDate saveWeddingDate(WeddingDate weddingDate) {
        JpaUserEntity currentEntity = getJpaUserEntity(weddingDate.userId());
        JpaUserEntity saved = jpaUserRepository.saveAndFlush(
                userMapper.toEntity(userMapper.toDomain(currentEntity), weddingDate.date()));
        return new WeddingDate(saved.id(), saved.weddingDate());
    }

    public Optional<PasswordLoginInfo> findPasswordLoginInfo(String nickname) {
        return jpaUserRepository.findByNicknameIgnoreCaseAndPasswordHashIsNotNull(nickname)
                .map(entity -> new PasswordLoginInfo(entity.id(), entity.passwordHash()));
    }

    public int removePasswordHash(Long userId) {
        return jpaUserRepository.removePasswordHashByUserId(userId);
    }

    public int deleteById(Long userId) {
        return jpaUserRepository.deleteByUserId(userId);
    }

    private @NonNull JpaUserEntity getJpaUserEntity(Long userId) {
        return jpaUserRepository.findById(userId)
                .orElseThrow(
                        () -> new BusinessException(
                                USER_NOT_FOUND,
                                USER_NOT_FOUND_MESSAGE + userId
                        )
                );
    }
}
