FROM mcr.microsoft.com/devcontainers/java:17

# Install sbt from the official Scala apt repository
RUN curl -fsSL "https://keyserver.ubuntu.com/pks/lookup?op=get&search=0x2EE0EA64E40A89B84B2DF73499E82A75642AC823" \
      | gpg --dearmor -o /usr/share/keyrings/scalasbt-archive-keyring.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/scalasbt-archive-keyring.gpg] https://repo.scala-sbt.org/scalasbt/debian all main" \
      > /etc/apt/sources.list.d/sbt.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends sbt && \
    rm -rf /var/lib/apt/lists/*
