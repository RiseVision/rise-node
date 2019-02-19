FROM arm32v6/postgres:11-alpine

COPY ./docker/qemu-arm-static /usr/bin/qemu-arm-static

ARG NETWORK=mainnet

# RUN wget https://downloads.rise.vision/snapshots/$NETWORK/latest -O latestsnap.sql.gz && \
#     mkdir -p /docker-entrypoint-initdb.d && \
#    mv latestsnap.sql.gz /docker-entrypoint-initdb.d

RUN rm /usr/bin/qemu-arm-static
