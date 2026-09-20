# syntax=docker/dockerfile:1

# ---------- build ----------
FROM gradle:jdk25-alpine AS build

# Repository and ref to build. The Spring Boot code lives on its own branch:
# `main` carries only the README, which is why a clone of it has no gradlew.
#   docker build --build-arg GIT_REF=feature/quarkus -f app.dockerfile .
ARG GIT_REPO=https://github.com/pontalti/place.git
ARG GIT_REF=feature/springboot

# Changing this argument invalidates the cache from the clone onwards, which
# is how a rebuild picks up new commits on the same branch:
#   docker build --build-arg CACHE_BUST=$(date +%s) ...
ARG CACHE_BUST=0

# git is not part of the gradle image; installed as root, then dropped again.
USER root
RUN apk add --no-cache git
USER gradle

WORKDIR /home/app

# --depth 1: only the tip of the ref is needed to build it.
# The clone lands in the current directory, so no COPY of the sources is left.
RUN echo "cache bust: ${CACHE_BUST}" \
    && git clone --depth 1 --branch "${GIT_REF}" "${GIT_REPO}" /home/app \
    && git -C /home/app log -1 --pretty='build of %h (%an, %ad): %s'

# The wrapper loses its permission bit when the repository is cloned on a
# filesystem that does not keep it.
# Tests run under the `test` profile against H2, so no database is needed here.
RUN chmod +x gradlew \
    && ./gradlew clean build --refresh-dependencies --no-daemon

# ---------- runtime ----------
FROM eclipse-temurin:25-jre-alpine
LABEL maintainer="Gustavo Pontalti"

# Remote debugging on 8000; suspend=n so the container starts without a client.
ENV JAVA_TOOL_OPTIONS="-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:8000"

WORKDIR /app
COPY --from=build /home/app/build/libs/place.jar place.jar
EXPOSE 8080 8000
CMD ["java", "-jar", "place.jar"]
