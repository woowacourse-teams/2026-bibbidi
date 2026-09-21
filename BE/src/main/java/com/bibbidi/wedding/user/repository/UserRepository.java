package com.bibbidi.wedding.user.repository;

import static com.bibbidi.wedding.common.exception.ClientError.USER_NOT_FOUND;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.user.domain.User;
import com.bibbidi.wedding.user.domain.WeddingDate;
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

    public boolean existsByPasswordLoginId(String passwordLoginId) {
        return jpaUserRepository.existsByPasswordLoginIdIgnoreCase(passwordLoginId);
    }

    public User create(User user) {
        JpaUserEntity saved = jpaUserRepository.saveAndFlush(userMapper.toEntity(user));
        return userMapper.toDomain(saved);
    }

    public User update(User user) {
        JpaUserEntity currentEntity = getJpaUserEntity(user.id());
        JpaUserEntity updatedEntity = new JpaUserEntity(
                user.id(),
                user.nickname(),
                user.passwordLoginId(),
                user.passwordHash(),
                currentEntity.weddingDate()
        );
        JpaUserEntity saved = jpaUserRepository.saveAndFlush(updatedEntity);
        return userMapper.toDomain(saved);
    }

    public User findByPasswordLoginId(String passwordLoginId) {
        return jpaUserRepository.findByPasswordLoginIdIgnoreCase(passwordLoginId)
                .map(userMapper::toDomain)
                .orElseThrow(NoSuchElementException::new);
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
        JpaUserEntity updatedEntity = new JpaUserEntity(
                weddingDate.userId(),
                currentEntity.nickname(),
                currentEntity.passwordLoginId(),
                currentEntity.passwordHash(),
                weddingDate.date()
        );
        JpaUserEntity saved = jpaUserRepository.saveAndFlush(updatedEntity);
        return new WeddingDate(saved.id(), saved.weddingDate());
    }

    public int deleteById(Long userId) {
        return jpaUserRepository.deleteByUserId(userId);
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
