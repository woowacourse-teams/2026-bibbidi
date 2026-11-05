package com.bibbidi.wedding.migration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import jakarta.persistence.EntityManagerFactory;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.flyway.autoconfigure.FlywayAutoConfiguration;
import org.springframework.boot.hibernate.autoconfigure.HibernateJpaAutoConfiguration;
import org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration;
import org.springframework.boot.persistence.autoconfigure.EntityScan;
import org.springframework.boot.test.context.ConfigDataApplicationContextInitializer;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;
import org.testcontainers.DockerClientFactory;

class FlywayMigrationIntegrationTest {

    @Test
    void createsSchemaThatPassesJpaValidationOnEmptyDatabase() {
        assumeTrue(DockerClientFactory.instance().isDockerAvailable());

        new ApplicationContextRunner()
                .withInitializer(new ConfigDataApplicationContextInitializer())
                .withConfiguration(AutoConfigurations.of(
                        DataSourceAutoConfiguration.class,
                        FlywayAutoConfiguration.class,
                        HibernateJpaAutoConfiguration.class
                ))
                .withUserConfiguration(MappingConfiguration.class)
                .withPropertyValues(
                        "spring.profiles.active=prod",
                        "spring.datasource.driver-class-name=org.testcontainers.jdbc.ContainerDatabaseDriver",
                        "spring.datasource.url=jdbc:tc:mysql:8.0.36:///bibbidi"
                )
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).hasSingleBean(EntityManagerFactory.class);
                });
    }

    @Configuration(proxyBeanMethods = false)
    @EntityScan("com.bibbidi.wedding")
    static class MappingConfiguration {
    }
}
