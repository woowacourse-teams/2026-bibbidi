package com.bibbidi.wedding;

import static com.tngtech.archunit.base.DescribedPredicate.not;
import static com.tngtech.archunit.core.domain.JavaClass.Predicates.resideInAPackage;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noMethods;
import static com.tngtech.archunit.library.Architectures.layeredArchitecture;
import static com.tngtech.archunit.library.dependencies.SlicesRuleDefinition.slices;

import com.bibbidi.wedding.common.exception.BusinessException;
import com.tngtech.archunit.core.domain.Dependency;
import com.tngtech.archunit.core.domain.JavaAnnotation;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaMethod;
import com.tngtech.archunit.core.domain.JavaParameter;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import jakarta.persistence.Entity;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Objects;
import java.util.function.Supplier;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@AnalyzeClasses(packages = "com.bibbidi.wedding", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureConventionTest {

    private static final String BASE_PACKAGE = "com.bibbidi.wedding";
    private static final List<String> FEATURES = List.of(
            "auth",
            "catalog",
            "checklist",
            "feedback",
            "user"
    );

    @ArchTest
    static final ArchRule 계층은_정해진_방향으로만_의존한다 = layeredArchitecture()
            .consideringOnlyDependenciesInLayers()
            .layer("Controller").definedBy(
                    resideInAPackage("..controller..").and(
                            not(resideInAPackage("..controller.dto.."))
                    )
            )
            .layer("Service").definedBy(
                    resideInAPackage("..service..").and(
                            not(resideInAPackage("..service.dto.."))
                    )
            )
            .layer("Repository").definedBy("..repository..")
            .layer("Persistence").definedBy("..persistence..")

            .whereLayer("Controller").mayNotBeAccessedByAnyLayer()
            .whereLayer("Service").mayOnlyBeAccessedByLayers("Controller", "Service")
            .whereLayer("Repository").mayOnlyBeAccessedByLayers("Service", "Repository")
            .whereLayer("Persistence").mayOnlyBeAccessedByLayers("Repository", "Persistence");

    @ArchTest
    static final ArchRule domain_패키지는_다른_계층에_의존하지_않는다 = noClasses()
            .that().resideInAPackage("..domain..")
            .should().dependOnClassesThat()
            .resideInAnyPackage("..controller..", "..service..", "..repository..", "..persistence..");

    @ArchTest
    static final ArchRule Service_애노테이션_클래스는_service_패키지에_위치하고_이름이_Service로_끝난다 = classes()
            .that().areAnnotatedWith(Service.class)
            .should().resideInAPackage("..service..")
            .andShould().haveSimpleNameEndingWith("Service");

    @ArchTest
    static final ArchRule Repository_애노테이션_클래스는_repository_패키지에_위치하고_이름이_Repository로_끝난다 = classes()
            .that().areAnnotatedWith(Repository.class)
            .should().resideInAPackage("..repository..")
            .andShould().haveSimpleNameEndingWith("Repository");

    @ArchTest
    static final ArchRule RestController_애노테이션_클래스는_controller_패키지에_위치하고_이름이_Controller로_끝난다 = classes()
            .that().areAnnotatedWith(RestController.class)
            .should().resideInAPackage("..controller..")
            .andShould().haveSimpleNameEndingWith("Controller");

    @ArchTest
    static final ArchRule Jpa_레포지토리는_Jpa로_시작해서_Repository로_끝난다 = classes()
            .that().areAssignableTo(JpaRepository.class)
            .and().resideInAPackage("..persistence..")
            .should().haveSimpleNameStartingWith("Jpa")
            .andShould().haveSimpleNameEndingWith("Repository");

    @ArchTest
    static final ArchRule Entity_애노테이션_클래스는_Jpa로_시작해서_Entity로_끝난다 = classes()
            .that().areAnnotatedWith(Entity.class)
            .should().haveSimpleNameStartingWith("Jpa")
            .andShould().haveSimpleNameEndingWith("Entity");

    @ArchTest
    static final ArchRule Lombok은_Slf4j만_허용한다 = classes()
            .should(Slf4j_외의_Lombok_애노테이션을_사용하지_않는다());

    private static ArchCondition<JavaClass> Slf4j_외의_Lombok_애노테이션을_사용하지_않는다() {
        return new ArchCondition<>("Slf4j 외의 Lombok 애노테이션을 사용하지 않는다") {
            @Override
            public void check(JavaClass javaClass, ConditionEvents events) {
                for (JavaAnnotation<JavaClass> annotation : javaClass.getAnnotations()) {
                    String annotationTypeName = annotation.getRawType().getFullName();
                    validateLombokUsage(javaClass, events, annotationTypeName);
                }
            }

            private static void validateLombokUsage(JavaClass javaClass, ConditionEvents events,
                                                    String annotationTypeName) {
                boolean hasLombokAnnotation = annotationTypeName.startsWith("lombok.");
                boolean hasLombokFeatureWithoutSlf4J = !annotationTypeName.equals("lombok.extern.slf4j.Slf4j");
                if (hasLombokAnnotation && hasLombokFeatureWithoutSlf4J) {
                    String errorMessage = javaClass.getFullName() + "에서 Lombok 애노테이션 사용 위반 : " + annotationTypeName
                            + "\n (@Slf4j만 허용)";
                    events.add(SimpleConditionEvent.violated(javaClass, errorMessage));
                }
            }
        };
    }

    @ArchTest
    static final ArchRule domain_패키지는_requireNonNull로_방어적_검증을_하지_않는다 = noClasses()
            .that().resideInAPackage("..domain..")
            .should().callMethod(Objects.class, "requireNonNull", Object.class)
            .orShould().callMethod(Objects.class, "requireNonNull", Object.class, String.class)
            .orShould().callMethod(Objects.class, "requireNonNull", Object.class, Supplier.class);

    @ArchTest
    static final ArchRule private_메서드는_BusinessException을_만들어_반환하지_않는다 = noMethods()
            .that().arePrivate()
            .should().haveRawReturnType(BusinessException.class)
            .because("예외는 던지는 자리에서 만든다. BusinessException을 만들어 돌려주는 private 헬퍼로 빼지 않는다.");

    @ArchTest
    static final ArchRule Controller의_RequestBody_파라미터는_Valid를_함께_받는다 = classes()
            .that().resideInAPackage("..controller..")
            .should(RequestBody_파라미터에_Valid를_동반한다());

    private static ArchCondition<JavaClass> RequestBody_파라미터에_Valid를_동반한다() {
        return new ArchCondition<>("@RequestBody 파라미터에 @Valid를 동반한다") {
            @Override
            public void check(JavaClass javaClass, ConditionEvents events) {
                for (JavaMethod method : javaClass.getMethods()) {
                    for (JavaParameter parameter : method.getParameters()) {
                        boolean hasRequestBody = parameter.isAnnotatedWith(RequestBody.class);
                        boolean hasValid = parameter.isAnnotatedWith(Valid.class);
                        if (hasRequestBody && !hasValid) {
                            events.add(SimpleConditionEvent.violated(method,
                                    method.getFullName() + " -- @RequestBody 파라미터에 @Valid가 없음"));
                        }
                    }
                }
            }
        };
    }

    @ArchTest
    static final ArchRule feature_패키지_사이에는_순환참조가_없다 = slices()
            .matching("com.bibbidi.wedding.(*)..")
            .should().beFreeOfCycles();

    @ArchTest
    static final ArchRule 다른_feature는_그_feature의_Service를_통해서만_접근한다 = classes()
            .should(다른_feature에_접근할땐_서비스만_거친다());

    private static ArchCondition<JavaClass> 다른_feature에_접근할땐_서비스만_거친다() {
        return new ArchCondition<>("다른 feature는 그 feature의 service 패키지를 통해서만 접근한다") {
            @Override
            public void check(JavaClass javaClass, ConditionEvents events) {
                String ownFeature = featureOf(javaClass.getPackageName());
                for (Dependency dependency : javaClass.getDirectDependenciesFromSelf()) {
                    JavaClass target = dependency.getTargetClass();
                    String targetFeature = featureOf(target.getPackageName());
                    if (targetFeature.isEmpty() || targetFeature.equals(ownFeature)) {
                        continue;
                    }
                    if (target.isAnnotation()
                            || isExemptCrossFeaturePackage(target.getPackageName(), targetFeature)) {
                        continue;
                    }
                    String servicePackage = BASE_PACKAGE + "." + targetFeature + ".service";
                    boolean accessesThroughService = target.getPackageName().equals(servicePackage)
                            || target.getPackageName().startsWith(servicePackage + ".");
                    if (!accessesThroughService) {
                        events.add(SimpleConditionEvent.violated(dependency,
                                dependency.getDescription() + " -- '" + targetFeature
                                        + "' feature는 service 패키지를 통해서만 접근해야 함"));
                    }
                }
            }
        };
    }

    private static boolean isExemptCrossFeaturePackage(String packageName, String feature) {
        String controllerDto = BASE_PACKAGE + "." + feature + ".controller.dto";
        String persistence = BASE_PACKAGE + "." + feature + ".persistence";
        return packageName.equals(controllerDto) || packageName.startsWith(controllerDto + ".")
                || packageName.equals(persistence) || packageName.startsWith(persistence + ".");
    }

    private static String featureOf(String packageName) {
        for (String feature : FEATURES) {
            String featurePackage = BASE_PACKAGE + "." + feature;
            if (packageName.equals(featurePackage) || packageName.startsWith(featurePackage + ".")) {
                return feature;
            }
        }
        return "";
    }
}
