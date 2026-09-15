package com.bibbidi.wedding.user.repository;

import static com.bibbidi.wedding.common.exception.ClientError.USER_NOT_FOUND;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.user.domain.WeddingDate;
import com.bibbidi.wedding.user.persistence.JpaUserEntity;
import com.bibbidi.wedding.user.persistence.JpaUserRepository;
import org.springframework.stereotype.Repository;

@Repository
public class WeddingDateRepository {

    private final JpaUserRepository jpaUserRepository;
    private final WeddingDateMapper weddingDateMapper;

    public WeddingDateRepository(JpaUserRepository jpaUserRepository, WeddingDateMapper weddingDateMapper) {
        this.jpaUserRepository = jpaUserRepository;
        this.weddingDateMapper = weddingDateMapper;
    }

    public WeddingDate findByUserId(Long userId) {
        JpaUserEntity entity = jpaUserRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(
                        USER_NOT_FOUND,
                        "결혼 예정일을 조회할 사용자를 찾을 수 없습니다. userId=" + userId
                ));
        return weddingDateMapper.toDomain(entity);
    }

    public WeddingDate save(WeddingDate weddingDate) {
        JpaUserEntity currentEntity = jpaUserRepository.findById(weddingDate.userId())
                .orElseThrow(() -> new BusinessException(
                        USER_NOT_FOUND,
                        "결혼 예정일을 저장할 사용자를 찾을 수 없습니다. userId=" + weddingDate.userId()
                ));
        JpaUserEntity updatedEntity = new JpaUserEntity(
                weddingDate.userId(),
                currentEntity.nickname(),
                currentEntity.passwordHash(),
                weddingDate.date()
        );
        JpaUserEntity saved = jpaUserRepository.saveAndFlush(updatedEntity);
        return weddingDateMapper.toDomain(saved);
    }
}
