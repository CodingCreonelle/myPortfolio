FROM alpine:3.20 AS build
WORKDIR /site
COPY ["Project Files/", "/site/"]
COPY ["scripts/version-assets.sh", "/usr/local/bin/version-assets.sh"]
RUN sh /usr/local/bin/version-assets.sh /site

FROM nginxinc/nginx-unprivileged:alpine

COPY --from=build --chown=nginx:nginx ["/site/", "/usr/share/nginx/html/"]
COPY --chown=nginx:nginx ["nginx.conf", "/etc/nginx/conf.d/default.conf"]

EXPOSE 8080
