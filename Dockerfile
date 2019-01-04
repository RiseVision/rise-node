FROM node:8-alpine

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
COPY --chown=rise ./package-lock.json /home/rise/rise-node/package-lock.json

WORKDIR /home/rise/rise-node

RUN npm install

USER root
RUN apk del .gyp
USER rise

COPY --chown=rise . /home/rise/rise-node/
RUN npm run transpile && npm prune --production

COPY --chown=rise ./docker/mainnet_config.json /home/rise/config.json

EXPOSE 5555
CMD ["node", "dist/app.js", "-n", "mainnet", "-e", "/home/rise/config.json"]
