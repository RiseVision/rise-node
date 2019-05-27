FROM node:11-alpine

RUN apk --update add --no-cache --virtual .gyp \
        autoconf \
        automake \
        findutils \
        g++ \
        libtool \
        make \
        python \
        postgresql-dev \
        libc6-compat

RUN mkdir -p /home/rise/rise-node
RUN mkdir -p /home/rise/logs

WORKDIR /home/rise
COPY config.json config.json

WORKDIR /home/rise/rise-node
COPY rise-node.tar.gz .
RUN tar -zxf rise-node.tar.gz
RUN rm rise-node.tar.gz

ENV NETWORK="mainnet"
EXPOSE 5555

CMD ./node_modules/.bin/lerna run \
	start:$NETWORK --stream --no-prefix -- \
	-e config.json

# debug
#CMD sh
