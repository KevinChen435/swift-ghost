# The npm SDK and container image versions must match exactly.
FROM docker.io/cloudflare/sandbox:0.12.4-python

COPY runner/judge_runner.py /opt/judge/judge_runner.py
RUN chmod 0555 /opt/judge/judge_runner.py \
    && mkdir -p /tmp/judge \
    && chmod 1777 /tmp/judge

# Keep the base image ENTRYPOINT. Cloudflare's sandbox binary owns container RPC.
