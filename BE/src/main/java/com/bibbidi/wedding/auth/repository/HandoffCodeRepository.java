package com.bibbidi.wedding.auth.repository;

import com.bibbidi.wedding.auth.domain.HandoffCode;
import com.bibbidi.wedding.auth.persistence.JpaHandoffCodeRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;

@Repository
public class HandoffCodeRepository {

    private final JpaHandoffCodeRepository jpaHandoffCodeRepository;
    private final AuthMapper authMapper;

    public HandoffCodeRepository(JpaHandoffCodeRepository jpaHandoffCodeRepository, AuthMapper authMapper) {
        this.jpaHandoffCodeRepository = jpaHandoffCodeRepository;
        this.authMapper = authMapper;
    }

    public HandoffCode save(HandoffCode code) {
        return authMapper.toDomain(jpaHandoffCodeRepository.saveAndFlush(authMapper.toEntity(code)));
    }

    public Optional<HandoffCode> findByCodeHash(String codeHash) {
        return jpaHandoffCodeRepository.findByCodeHash(codeHash).map(authMapper::toDomain);
    }

    public int deleteExpiredOrUsed(LocalDateTime threshold, int batchSize) {
        List<Long> ids = jpaHandoffCodeRepository.findIdsToClean(threshold, PageRequest.of(0, batchSize));
        jpaHandoffCodeRepository.deleteAllByIdInBatch(ids);
        return ids.size();
    }
}
