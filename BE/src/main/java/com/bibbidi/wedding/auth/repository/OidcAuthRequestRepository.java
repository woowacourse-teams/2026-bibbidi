package com.bibbidi.wedding.auth.repository;

import com.bibbidi.wedding.auth.domain.OidcAuthRequest;
import com.bibbidi.wedding.auth.persistence.JpaOidcAuthRequestRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;

@Repository
public class OidcAuthRequestRepository {

    private final JpaOidcAuthRequestRepository jpaOidcAuthRequestRepository;
    private final AuthMapper authMapper;

    public OidcAuthRequestRepository(
            JpaOidcAuthRequestRepository jpaOidcAuthRequestRepository,
            AuthMapper authMapper
    ) {
        this.jpaOidcAuthRequestRepository = jpaOidcAuthRequestRepository;
        this.authMapper = authMapper;
    }

    public OidcAuthRequest save(OidcAuthRequest request) {
        return authMapper.toDomain(
                jpaOidcAuthRequestRepository.saveAndFlush(authMapper.toEntity(request))
        );
    }

    public Optional<OidcAuthRequest> findByStateHash(String stateHash) {
        return jpaOidcAuthRequestRepository
                .findByStateHash(stateHash)
                .map(authMapper::toDomain);
    }

    public int deleteExpiredOrUsed(LocalDateTime threshold, int batchSize) {
        List<Long> ids = jpaOidcAuthRequestRepository.findIdsToClean(
                threshold,
                PageRequest.of(0, batchSize)
        );
        jpaOidcAuthRequestRepository.deleteAllByIdInBatch(ids);
        return ids.size();
    }
}
