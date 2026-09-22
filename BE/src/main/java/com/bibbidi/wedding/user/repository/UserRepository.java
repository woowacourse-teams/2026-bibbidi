package com.bibbidi.wedding.user.repository;

import static com.bibbidi.wedding.common.exception.ClientError.DUPLICATE_NICKNAME;
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

    private static final String USER_NOT_FOUND_MESSAGE = "제공받은 아이디를 기반으로 회원을 찾을 수 없습니다. userId=";
    private static final String DUPLICATE_NICKNAME_MESSAGE = "이미 사용 중인 닉네임입니다. nickname=";

    private final JpaUserRepository jpaUserRepository;
    private final UserMapper userMapper;

    public UserRepository(JpaUserRepository jpaUserRepository, UserMapper userMapper) {
        this.jpaUserRepository = jpaUserRepository;
        this.userMapper = userMapper;
    }

    public boolean existsPasswordLoginUserByNickname(String nickname) {
        return jpaUserRepository.existsByNicknameIgnoreCaseAndPasswordHashIsNotNull(nickname);
    }

    public User create(User user) {
        validateNicknameNotUsed(user.nickname());
        JpaUserEntity saved = jpaUserRepository.saveAndFlush(userMapper.toEntity(user));
        return userMapper.toDomain(saved);
    }

    public User update(User user) {
        validateNicknameNotUsedByOthers(user.nickname(), user.id());
        JpaUserEntity currentEntity = getJpaUserEntity(user.id());
        JpaUserEntity updatedEntity = new JpaUserEntity(
                user.id(),
                user.nickname(),
                user.passwordHash(),
                currentEntity.weddingDate()
        );
        JpaUserEntity saved = jpaUserRepository.saveAndFlush(updatedEntity);
        return userMapper.toDomain(saved);
    }

    public User findPasswordLoginUserByNickname(String nickname) {
        return jpaUserRepository.findByNicknameIgnoreCaseAndPasswordHashIsNotNull(nickname)
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
                currentEntity.passwordHash(),
                weddingDate.date()
        );
        JpaUserEntity saved = jpaUserRepository.saveAndFlush(updatedEntity);
        return new WeddingDate(saved.id(), saved.weddingDate());
    }

    public int deleteById(Long userId) {
        return jpaUserRepository.deleteByUserId(userId);
    }

    private void validateNicknameNotUsed(String nickname) {
        if (jpaUserRepository.existsByNicknameIgnoreCaseAndPasswordHashIsNotNull(nickname)) {
            throw new BusinessException(
                    DUPLICATE_NICKNAME,
                    DUPLICATE_NICKNAME_MESSAGE + nickname
            );
        }
    }

    private void validateNicknameNotUsedByOthers(String nickname, Long userId) {
        if (jpaUserRepository.existsByNicknameIgnoreCaseAndIdNotAndPasswordHashIsNotNull(nickname, userId)) {
            throw new BusinessException(
                    DUPLICATE_NICKNAME,
                    DUPLICATE_NICKNAME_MESSAGE + nickname
            );
        }
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
