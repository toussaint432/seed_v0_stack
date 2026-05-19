# syntax=docker/dockerfile:1
# Étape 1 : build avec Maven + JDK 21
FROM maven:3.9.8-eclipse-temurin-21 AS build
WORKDIR /app

# Cache BuildKit pour le dépôt Maven local — évite de re-télécharger entre les builds
COPY pom.xml .
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B dependency:resolve dependency:resolve-plugins -q \
    -Dmaven.wagon.http.retryHandler.count=3 \
    -Dmaven.wagon.http.retryHandler.requestSentRetryEnabled=true

COPY src ./src
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -DskipTests package -q \
    -Dmaven.wagon.http.retryHandler.count=3 \
    -Dmaven.wagon.http.retryHandler.requestSentRetryEnabled=true

RUN ls -lah target && \
    JAR="$(ls -1 target/*.jar | grep -v 'original' | head -n 1)" && \
    echo "Using jar: $JAR" && \
    cp "$JAR" /app/app.jar

# Étape 2 : runtime
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/app.jar /app/app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
