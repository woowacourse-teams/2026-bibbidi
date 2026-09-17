FROM eclipse-temurin:25-jre-noble

WORKDIR /app

COPY --chown=10001:10001 build/libs/app.jar /app/app.jar

USER 10001:10001

EXPOSE 8080

ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=60.0"

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
