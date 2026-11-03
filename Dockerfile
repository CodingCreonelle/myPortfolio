FROM nginxinc/nginx-unprivileged:alpine

COPY --chown=nginx:nginx ["Project Files/", "/usr/share/nginx/html/"]
COPY --chown=nginx:nginx ["nginx.conf", "/etc/nginx/conf.d/default.conf"]

EXPOSE 8080
