package com.bibbidi.wedding.terms.repository;

import com.bibbidi.wedding.terms.domain.Terms;
import com.bibbidi.wedding.terms.domain.TermsAgreement;
import com.bibbidi.wedding.terms.persistence.JpaTermsAgreementRepository;
import com.bibbidi.wedding.terms.persistence.JpaTermsRepository;
import java.util.List;
import org.springframework.stereotype.Repository;

@Repository
public class TermsRepository {

    private final JpaTermsRepository jpaTermsRepository;
    private final JpaTermsAgreementRepository jpaTermsAgreementRepository;
    private final TermsMapper termsMapper;

    public TermsRepository(
            JpaTermsRepository jpaTermsRepository,
            JpaTermsAgreementRepository jpaTermsAgreementRepository,
            TermsMapper termsMapper
    ) {
        this.jpaTermsRepository = jpaTermsRepository;
        this.jpaTermsAgreementRepository = jpaTermsAgreementRepository;
        this.termsMapper = termsMapper;
    }

    public List<Terms> findAll() {
        return jpaTermsRepository.findAll().stream().map(termsMapper::toDomain).toList();
    }

    public List<Terms> findAllRequired() {
        return jpaTermsRepository.findAllByRequiredTrue().stream().map(termsMapper::toDomain).toList();
    }

    public List<Terms> findAllRequiredByVersion(String version) {
        return jpaTermsRepository.findAllByRequiredTrueAndVersion(version)
                .stream().map(termsMapper::toDomain).toList();
    }

    public List<Terms> findAllByIds(List<Long> termsIds) {
        return jpaTermsRepository.findAllById(termsIds).stream().map(termsMapper::toDomain).toList();
    }

    public List<TermsAgreement> saveAll(List<TermsAgreement> agreements) {
        return jpaTermsAgreementRepository
                .saveAllAndFlush(agreements.stream().map(termsMapper::toEntity).toList())
                .stream()
                .map(termsMapper::toDomain)
                .toList();
    }

    public List<TermsAgreement> findAgreementsByUserId(Long userId) {
        return jpaTermsAgreementRepository.findAllByUserId(userId).stream()
                .map(termsMapper::toDomain)
                .toList();
    }

    public int deleteAgreementsByUserId(Long userId) {
        return jpaTermsAgreementRepository.deleteByUserId(userId);
    }
}
