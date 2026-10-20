FROM eclipse-temurin:25-jre-noble AS extract

WORKDIR /workspace
COPY build/libs/app.jar app.jar
RUN java -Djarmode=tools -jar app.jar extract --layers --destination extracted

FROM eclipse-temurin:25-jre-noble

WORKDIR /app

COPY --from=extract --chown=10001:10001 /workspace/extracted/dependencies/ ./
COPY --from=extract --chown=10001:10001 /workspace/extracted/spring-boot-loader/ ./
COPY --from=extract --chown=10001:10001 /workspace/extracted/snapshot-dependencies/ ./
COPY --from=extract --chown=10001:10001 /workspace/extracted/application/ ./

USER 10001:10001

EXPOSE 8080 8081

ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=60.0"

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
