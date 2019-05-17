FROM node:11-alpine

RUN apk --update add --no-cache --virtual .gyp \
        autoconf \
        automake \
        findutils \
        g++ \
        libtool \
        make \
        python \
        postgresql-dev

RUN mkdir -p /home/rise/rise-node
RUN mkdir /home/rise/logs
WORKDIR /home/rise/rise-node

COPY docker/bundle/config.json config.json
COPY docker/bundle/rise.tar rise.tar
RUN tar -xf rise.tar
RUN rm rise.tar

ENV NETWORK="mainnet"
EXPOSE 5555

CMD node packages/core-launchpad/dist/app.js \
	start:$NETWORK --stream --no-prefix -- \
	-e config.json

# debug
CMD sh
