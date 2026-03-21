# Étape 1 : build avec Maven + JDK 21
FROM maven:3.9.8-eclipse-temurin-21 AS build
WORKDIR /app

# Copier le pom.xml et télécharger les dépendances (cache Docker layer)
COPY pom.xml .
RUN mvn -B dependency:resolve dependency:resolve-plugins -q

# Copier le code source
COPY src ./src

# Compiler l'application (Spring Boot repackage => jar exécutable)
RUN mvn -B -DskipTests package -q

# Récupérer le jar exécutable (exclure *.original si présent)
RUN ls -lah target && \
    JAR="$(ls -1 target/*.jar | grep -v '\.original$' | head -n 1)" && \
    echo "Using jar: $JAR" && \
    cp "$JAR" /app/app.jar

# Étape 2 : runtime minimal avec JRE 21
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/app.jar /app/app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]