package com.bibbidi.wedding.terms.service;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.terms.domain.Terms;
import com.bibbidi.wedding.terms.domain.TermsAgreement;
import com.bibbidi.wedding.terms.repository.TermsRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 약관을 보여 주고 동의를 받는다.
 *
 * <p>동의는 약관 건마다 남긴다. 나중에 문구가 바뀌어도 누가 어떤 판에 동의했는지 그대로 남는다.
 */
@Service
@Transactional(readOnly = true)
public class TermsService {

    private final TermsRepository termsRepository;

    public TermsService(TermsRepository termsRepository) {
        this.termsRepository = termsRepository;
    }

    public List<TermsResult> findAll() {
        return termsRepository.findAll().stream().map(TermsResult::from).toList();
    }

    /**
     * 필수 약관에 모두 동의했을 때만 기록한다.
     * 하나라도 빠지면 아무것도 저장하지 않는다.
     */
    @Transactional
    public void agree(Long userId, List<Long> agreedTermsIds) {
        List<Terms> agreedTerms = termsRepository.findAllByIds(agreedTermsIds);
        if (agreedTerms.size() != Set.copyOf(agreedTermsIds).size()) {
            throw new BusinessException(ClientError.INVALID_REQUEST,
                    "존재하지 않는 약관에 동의를 시도했습니다. userId=" + userId);
        }

        validateAllRequiredAgreed(userId, agreedTerms);

        LocalDateTime agreedAt = LocalDateTime.now();
        termsRepository.saveAll(agreedTerms.stream()
                .map(terms -> TermsAgreement.of(userId, terms.id(), agreedAt))
                .toList());
    }

    @Transactional
    public void agree(Long userId, String termsVersion) {
        List<Terms> agreedTerms = termsRepository.findAllRequiredByVersion(termsVersion);
        if (agreedTerms.isEmpty()) {
            throw new BusinessException(ClientError.INVALID_REQUEST,
                    "존재하지 않는 약관 버전입니다. version=" + termsVersion);
        }
        LocalDateTime agreedAt = LocalDateTime.now();
        termsRepository.saveAll(agreedTerms.stream()
                .map(terms -> TermsAgreement.of(userId, terms.id(), agreedAt))
                .toList());
    }

    /** 그 회원이 어떤 약관에 동의했는지다. */
    public List<Long> findAgreedTermsIds(Long userId) {
        return termsRepository.findAgreementsByUserId(userId).stream()
                .map(TermsAgreement::termsId)
                .toList();
    }

    @Transactional
    public void moveAgreements(Long userId, Long newUserId) {
        termsRepository.changeAgreementsUserId(userId, newUserId);
    }

    @Transactional
    public void deleteAgreementsOf(Long userId) {
        termsRepository.deleteAgreementsByUserId(userId);
    }

    private void validateAllRequiredAgreed(Long userId, List<Terms> agreedTerms) {
        Set<Long> agreedIds = agreedTerms.stream().map(Terms::id).collect(java.util.stream.Collectors.toSet());
        List<Terms> notAgreed = termsRepository.findAllRequired().stream()
                .filter(required -> !agreedIds.contains(required.id()))
                .toList();
        if (!notAgreed.isEmpty()) {
            throw new BusinessException(ClientError.TERMS_AGREEMENT_REQUIRED,
                    "동의하지 않은 필수 약관이 있습니다. userId=" + userId + " 미동의수=" + notAgreed.size());
        }
    }
}
