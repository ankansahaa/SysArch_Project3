# syntax=docker/dockerfile:1.7

FROM docker.io/library/eclipse-temurin:21-jdk-jammy AS build

WORKDIR /build

ARG SBT_VERSION=1.10.7

RUN apt-get update \
	&& apt-get install -y --no-install-recommends curl ca-certificates tar \
	&& rm -rf /var/lib/apt/lists/*

RUN curl -fsSL "https://github.com/sbt/sbt/releases/download/v${SBT_VERSION}/sbt-${SBT_VERSION}.tgz" \
	| tar -xz -C /opt \
	&& ln -s /opt/sbt/bin/sbt /usr/local/bin/sbt

COPY build.sbt ./
COPY project ./project
COPY app ./app
COPY conf ./conf

RUN sbt -Dsbt.log.noformat=true stage

FROM docker.io/library/eclipse-temurin:21-jre-jammy AS runtime

WORKDIR /app

ENV JAVA_OPTS=""

COPY --from=build /build/target/universal/stage/ /app/

RUN mkdir -p /app/logs

EXPOSE 9000

ENTRYPOINT ["/app/bin/simulator-server"]