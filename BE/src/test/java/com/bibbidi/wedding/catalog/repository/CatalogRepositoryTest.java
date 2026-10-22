package com.bibbidi.wedding.catalog.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bibbidi.wedding.catalog.domain.Catalog;
import com.bibbidi.wedding.catalog.domain.Category;
import com.bibbidi.wedding.catalog.domain.Item;
import com.bibbidi.wedding.catalog.persistence.JpaCatalogItemEntity;
import com.bibbidi.wedding.catalog.persistence.JpaCatalogItemRepository;
import com.bibbidi.wedding.catalog.persistence.JpaCategoryEntity;
import com.bibbidi.wedding.catalog.persistence.JpaCategoryRepository;
import com.bibbidi.wedding.catalog.persistence.JpaStepEntity;
import com.bibbidi.wedding.catalog.persistence.JpaStepRepository;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemDetailSnapshot;
import com.bibbidi.wedding.catalog.service.dto.CatalogItemSnapshot;
import com.bibbidi.wedding.common.exception.BusinessException;
import com.bibbidi.wedding.common.exception.ClientError;
import com.bibbidi.wedding.support.TestDatabaseLocks;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

@DataJpaTest
@ActiveProfiles("test")
@Import({CatalogRepository.class, CatalogMapper.class})
@ResourceLock(TestDatabaseLocks.SPRING_TEST)
class CatalogRepositoryTest {

    @Autowired
    private CatalogRepository catalogRepository;

    @Autowired
    private JpaCategoryRepository jpaCategoryRepository;

    @Autowired
    private JpaStepRepository jpaStepRepository;

    @Autowired
    private JpaCatalogItemRepository jpaCatalogItemRepository;

    @Test
    @DisplayName("단계가 없는 준비 영역까지 포함해 준비 목록을 조회한다")
    void shouldFindCatalogIncludingCategoryWithoutStep() {
        // given
        JpaCategoryEntity weddingHall = jpaCategoryRepository.save(new JpaCategoryEntity(null, "웨딩홀", 1));
        JpaCategoryEntity studio = jpaCategoryRepository.save(new JpaCategoryEntity(null, "스드메", 2));
        JpaStepEntity contract = jpaStepRepository.save(new JpaStepEntity(
                null, weddingHall.id(), "웨딩홀 계약", "웨딩홀을 결정하고 계약한다.",
                "https://www.bibbidi.kr/icon/wedding/venue-hall-tour.png", 1
        ));
        JpaCatalogItemEntity item = jpaCatalogItemRepository.save(new JpaCatalogItemEntity(
                null, contract.id(), "계약서 확인", 1, true
        ));

        // when
        Catalog catalog = catalogRepository.findCatalog();

        // then
        assertThat(catalog.categories())
                .extracting(Category::id)
                .containsExactly(weddingHall.id(), studio.id());
        assertThat(catalog.categories().getFirst().steps().getFirst().items())
                .extracting(Item::id)
                .containsExactly(item.id());
        assertThat(catalog.categories().getLast().steps()).isEmpty();
    }

    @Test
    @DisplayName("준비 항목 전체를 카테고리 이름과 단계 번호와 단계 이름과 함께 조회한다")
    void shouldFindAllItemDetailsWithCategoryAndStep() {
        // given
        JpaCategoryEntity weddingHall = jpaCategoryRepository.save(new JpaCategoryEntity(null, "웨딩홀", 1));
        JpaCategoryEntity styling = jpaCategoryRepository.save(new JpaCategoryEntity(null, "스드메", 2));
        JpaStepEntity hallChoice = jpaStepRepository.save(new JpaStepEntity(
                null, weddingHall.id(), "웨딩홀 정하기", null, null, 1
        ));
        JpaStepEntity ceremonyStyle = jpaStepRepository.save(new JpaStepEntity(
                null, weddingHall.id(), "예식 진행 방식 결정", null, null, 2
        ));
        JpaStepEntity packageContract = jpaStepRepository.save(new JpaStepEntity(
                null, styling.id(), "스드메 패키지 계약", null, null, 1
        ));
        JpaCatalogItemEntity hallTour = jpaCatalogItemRepository.save(new JpaCatalogItemEntity(
                null, hallChoice.id(), "웨딩홀 투어", 1, true
        ));
        JpaCatalogItemEntity ceremonyType = jpaCatalogItemRepository.save(new JpaCatalogItemEntity(
                null, ceremonyStyle.id(), "예식 형태 결정", 1, true
        ));
        JpaCatalogItemEntity stylingConsulting = jpaCatalogItemRepository.save(new JpaCatalogItemEntity(
                null, packageContract.id(), "스드메 상담", 1, true
        ));

        // when
        List<CatalogItemDetailSnapshot> itemDetails = catalogRepository.findAllItemDetails();

        // then
        assertThat(itemDetails).containsExactlyInAnyOrder(
                new CatalogItemDetailSnapshot(hallTour.id(), "웨딩홀 투어", "웨딩홀", 1, "웨딩홀 정하기"),
                new CatalogItemDetailSnapshot(ceremonyType.id(), "예식 형태 결정", "웨딩홀", 2, "예식 진행 방식 결정"),
                new CatalogItemDetailSnapshot(stylingConsulting.id(), "스드메 상담", "스드메", 1, "스드메 패키지 계약")
        );
    }

    @Test
    @DisplayName("요청한 항목만 중복 없이 카테고리와 단계와 항목의 표시 순서로 조회한다")
    void shouldFindOnlyRequestedItemsInCatalogOrder() {
        // ID 순서와 표시 순서를 다르게 구성한다.
        JpaCategoryEntity laterCategory = jpaCategoryRepository.save(new JpaCategoryEntity(null, "나중 영역", 2));
        JpaCategoryEntity firstCategory = jpaCategoryRepository.save(new JpaCategoryEntity(null, "먼저 영역", 1));
        JpaStepEntity laterStep = jpaStepRepository.save(new JpaStepEntity(
                null, firstCategory.id(), "나중 단계", null, null, 2));
        JpaStepEntity firstStep = jpaStepRepository.save(new JpaStepEntity(
                null, firstCategory.id(), "먼저 단계", null, null, 1));
        JpaStepEntity otherStep = jpaStepRepository.save(new JpaStepEntity(
                null, laterCategory.id(), "다른 영역 단계", null, null, 1));
        JpaCatalogItemEntity other = jpaCatalogItemRepository.save(new JpaCatalogItemEntity(
                null, otherStep.id(), "다른 영역 항목", 1, true));
        JpaCatalogItemEntity later = jpaCatalogItemRepository.save(new JpaCatalogItemEntity(
                null, laterStep.id(), "나중 단계 항목", 1, true));
        JpaCatalogItemEntity second = jpaCatalogItemRepository.save(new JpaCatalogItemEntity(
                null, firstStep.id(), "두 번째 항목", 2, false));
        JpaCatalogItemEntity first = jpaCatalogItemRepository.save(new JpaCatalogItemEntity(
                null, firstStep.id(), "첫 번째 항목", 1, true));
        jpaCatalogItemRepository.save(new JpaCatalogItemEntity(null, firstStep.id(), "요청하지 않은 항목", 3, true));

        List<CatalogItemSnapshot> items = catalogRepository.findItems(
                List.of(other.id(), later.id(), second.id(), first.id(), first.id(), Long.MAX_VALUE));

        assertThat(items).containsExactly(
                new CatalogItemSnapshot(first.id(), firstCategory.id(), "첫 번째 항목"),
                new CatalogItemSnapshot(second.id(), firstCategory.id(), "두 번째 항목"),
                new CatalogItemSnapshot(later.id(), firstCategory.id(), "나중 단계 항목"),
                new CatalogItemSnapshot(other.id(), laterCategory.id(), "다른 영역 항목")
        );
        assertThat(catalogRepository.findItems(List.of(second.id())))
                .containsExactly(new CatalogItemSnapshot(second.id(), firstCategory.id(), "두 번째 항목"));
    }

    @Test
    @DisplayName("빈 ID 모음과 존재하지 않는 ID는 빈 결과를 반환한다")
    void shouldReturnEmptyForEmptyOrMissingIds() {
        assertThat(catalogRepository.findItems(List.of())).isEmpty();
        assertThat(catalogRepository.findItems(List.of(Long.MAX_VALUE))).isEmpty();
    }

    @Test
    @DisplayName("존재하는 카테고리의 검증을 통과시킨다")
    void shouldValidateExistingCategory() {
        // given
        JpaCategoryEntity category = jpaCategoryRepository.save(new JpaCategoryEntity(null, "웨딩홀", 1));

        // when, then
        catalogRepository.validateCategoryExists(category.id());
    }

    @Test
    @DisplayName("존재하지 않는 카테고리 검증에서 오류를 던진다")
    void shouldThrowWhenCategoryDoesNotExist() {
        // when, then
        assertThatThrownBy(() -> catalogRepository.validateCategoryExists(999L))
                .isInstanceOf(BusinessException.class)
                .extracting(exception -> ((BusinessException) exception).clientError())
                .isEqualTo(ClientError.CATEGORY_NOT_FOUND);
    }
}
