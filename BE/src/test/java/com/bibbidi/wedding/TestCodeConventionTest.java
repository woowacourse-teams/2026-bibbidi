package com.bibbidi.wedding;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaField;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;

/**
 * docs/convention/test-strategy.md 에서 ArchUnit으로 검사 가능한 테스트 코드 작성 규칙. 프로덕션 코드가 아닌 테스트 클래스 자체를 검사 대상으로 하므로
 * ArchitectureTest와 분리한다.
 */
@AnalyzeClasses(packages = "com.bibbidi.wedding")
class TestCodeConventionTest {

    @ArchTest
    static final ArchRule Controller_통합_테스트는_Repository를_주입받지_않는다 = classes()
            .that().resideInAPackage("..controller..")
            .and().haveSimpleNameEndingWith("IntegrationTest")
            .should(Repository_타입_필드를_갖지_않는다())
            .because("픽스처를 만들기 위해 Controller 통합 테스트에 Repository를 주입하지 않는다 (test-strategy.md)");

    private static ArchCondition<JavaClass> Repository_타입_필드를_갖지_않는다() {
        return new ArchCondition<>("Repository/Persistence 타입 필드를 갖지 않는다") {
            @Override
            public void check(JavaClass javaClass, ConditionEvents events) {
                for (JavaField field : javaClass.getFields()) {
                    String fieldTypePackage = field.getRawType().getPackageName();
                    if (fieldTypePackage.contains(".repository") || fieldTypePackage.contains(".persistence")) {
                        events.add(SimpleConditionEvent.violated(field,
                                field.getFullName() + " -- Repository/Persistence 타입 필드는 Controller 통합 테스트에 둘 수 없음"));
                    }
                }
            }
        };
    }
}
