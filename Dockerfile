FROM alpine:3.24 AS build
WORKDIR /site
COPY ["Project Files/", "/site/"]
COPY ["scripts/version-assets.sh", "/usr/local/bin/version-assets.sh"]
RUN sh /usr/local/bin/version-assets.sh /site

FROM nginxinc/nginx-unprivileged:alpine-slim

USER root
# hadolint ignore=DL3017
RUN apk update && apk upgrade --no-cache && rm -rf /var/cache/apk/*

COPY --from=build --chown=nginx:nginx ["/site/", "/usr/share/nginx/html/"]
COPY --chown=nginx:nginx ["nginx.conf", "/etc/nginx/conf.d/default.conf"]

USER 101

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO /dev/null http://127.0.0.1:8080/ || exit 1


