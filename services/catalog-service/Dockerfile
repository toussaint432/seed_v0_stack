# syntax=docker/dockerfile:1
FROM maven:3.9.8-eclipse-temurin-21 AS build
WORKDIR /app

# 1. Installer seed-common dans le cache Maven local
COPY seed-common/pom.xml ./seed-common/pom.xml
COPY seed-common/src     ./seed-common/src
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B install -f seed-common/pom.xml -DskipTests -q

# 2. Résoudre les dépendances de catalog-service (cache layer)
COPY catalog-service/pom.xml ./pom.xml
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B dependency:resolve dependency:resolve-plugins -q \
    -Dmaven.wagon.http.retryHandler.count=3 \
    -Dmaven.wagon.http.retryHandler.requestSentRetryEnabled=true

# 3. Compiler et packager
COPY catalog-service/src ./src
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -DskipTests package -q \
    -Dmaven.wagon.http.retryHandler.count=3 \
    -Dmaven.wagon.http.retryHandler.requestSentRetryEnabled=true

RUN cp $(ls target/*.jar | grep -v original | head -1) /app/app.jar

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/app.jar /app/app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
