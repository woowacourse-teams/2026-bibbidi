package com.bibbidi.wedding;

import static org.assertj.core.api.Assertions.assertThat;

import com.bibbidi.wedding.catalog.persistence.JpaCatalogItemRepository;
import com.bibbidi.wedding.catalog.persistence.JpaCategoryRepository;
import com.bibbidi.wedding.catalog.persistence.JpaStepRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("dev")
class DevelopmentProfileCatalogInitializationTest {

    @Autowired
    private JpaCategoryRepository categoryRepository;

    @Autowired
    private JpaStepRepository stepRepository;

    @Autowired
    private JpaCatalogItemRepository catalogItemRepository;

    @Test
    void initializesCatalogReferenceData() {
        assertThat(categoryRepository.count()).isEqualTo(5);
        assertThat(stepRepository.count()).isEqualTo(43);
        assertThat(catalogItemRepository.count()).isEqualTo(169);
    }
}
