# Portable Swift challenges use the official pinned Swift Linux toolchain.
FROM docker.io/swift:6.3.3-noble

# Cloudflare documents copying the matching standalone Sandbox binary into an
# arbitrary base image. The npm package and binary image remain version-locked.
COPY --from=docker.io/cloudflare/sandbox:0.12.4 /container-server/sandbox /sandbox

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY runner/judge_runner.py /opt/judge/judge_runner.py
RUN chmod 0555 /opt/judge/judge_runner.py \
    && mkdir -p /tmp/judge \
    && chmod 1777 /tmp/judge

ENTRYPOINT ["/sandbox"]
