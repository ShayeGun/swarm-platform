FROM quay.io/keycloak/keycloak:26.7.3

# Enable health and metrics support
ENV KC_HEALTH_ENABLED=true
ENV KC_METRICS_ENABLED=true

# Build Options
ENV KC_DB="postgres"
ENV KC_FEATURES="account:v3,admin:v2,admin-fine-grained-authz:v2,hostname:v2,login:v2,organization:v1,passkeys:v1,web-authn:v1,persistent-user-sessions:v1"

RUN /opt/keycloak/bin/kc.sh build

ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]

