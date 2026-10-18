package com.bibbidi.wedding.catalog.persistence;

// 카테고리·단계·항목을 한 번에 읽은 결과의 한 행. 단계나 항목이 없는 쪽은 null이다.
public record CatalogRow(JpaCategoryEntity category, JpaStepEntity step, JpaCatalogItemEntity item) {
}
