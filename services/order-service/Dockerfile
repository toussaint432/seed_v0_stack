# syntax=docker/dockerfile:1
FROM maven:3.9.8-eclipse-temurin-21 AS build
WORKDIR /app

# 1. Installer seed-common dans le cache Maven local
COPY seed-common/pom.xml ./seed-common/pom.xml
COPY seed-common/src     ./seed-common/src
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B install -f seed-common/pom.xml -DskipTests -q

# 2. Résoudre les dépendances de order-service (cache layer)
COPY order-service/pom.xml ./pom.xml
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B dependency:resolve dependency:resolve-plugins -q \
    -Dmaven.wagon.http.retryHandler.count=3 \
    -Dmaven.wagon.http.retryHandler.requestSentRetryEnabled=true

# 3. Compiler et packager
COPY order-service/src ./src
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -DskipTests package -q \
    -Dmaven.wagon.http.retryHandler.count=3 \
    -Dmaven.wagon.http.retryHandler.requestSentRetryEnabled=true

RUN ls -lah target && \
    JAR="$(ls -1 target/*.jar | grep -v 'original' | head -n 1)" && \
    echo "Using jar: $JAR" && \
    cp "$JAR" /app/app.jar

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/app.jar /app/app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
