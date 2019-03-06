FROM node:11-alpine

RUN apk --update add --no-cache --virtual .gyp \
        autoconf \
        automake \
        findutils \
        g++ \
        libtool \
        make \
        python

RUN apk --update add --no-cache postgresql-dev

RUN adduser -D rise
USER rise

COPY --chown=rise ./package.json /home/rise/rise-node/package.json
COPY --chown=rise ./yarn.lock /home/rise/rise-node/yarn.lock

WORKDIR /home/rise/rise-node

COPY --chown=rise ./packages/rise/package.json ./packages/rise/package.json
COPY --chown=rise ./packages/core/package.json ./packages/core/package.json
COPY --chown=rise ./packages/core-accounts/package.json ./packages/core-accounts/package.json
COPY --chown=rise ./packages/core-apis/package.json ./packages/core-apis/package.json
COPY --chown=rise ./packages/core-blocks/package.json ./packages/core-blocks/package.json
COPY --chown=rise ./packages/core-consensus-dpos/package.json ./packages/core-consensus-dpos/package.json
COPY --chown=rise ./packages/core-crypto/package.json ./packages/core-crypto/package.json
COPY --chown=rise ./packages/core-exceptions/package.json ./packages/core-exceptions/package.json
COPY --chown=rise ./packages/core-helpers/package.json ./packages/core-helpers/package.json
COPY --chown=rise ./packages/core-launchpad/package.json ./packages/core-launchpad/package.json
COPY --chown=rise ./packages/core-models/package.json ./packages/core-models/package.json
COPY --chown=rise ./packages/core-p2p/package.json ./packages/core-p2p/package.json
COPY --chown=rise ./packages/core-secondsignature/package.json ./packages/core-secondsignature/package.json
COPY --chown=rise ./packages/core-transactions/package.json ./packages/core-transactions/package.json
COPY --chown=rise ./packages/core-types/package.json ./packages/core-types/package.json
COPY --chown=rise ./packages/core-utils/package.json ./packages/core-utils/package.json

RUN yarn install

COPY --chown=rise ./lerna.json ./lerna.json

USER root
RUN apk del .gyp
USER rise

COPY --chown=rise . .
RUN ./node_modules/.bin/lerna run transpile && \
    ./node_modules/.bin/lerna bootstrap && \
    ./node_modules/.bin/lerna link

RUN mkdir /home/rise/logs && ln -s /home/rise/logs ./packages/rise/logs
COPY --chown=rise ./docker/node_config.json /home/rise/config.json

ENV NETWORK="mainnet"
EXPOSE 5555
CMD ./node_modules/.bin/lerna run start:$NETWORK --stream --no-prefix -- -e /home/rise/config.json
