FROM node:8-alpine

RUN apk add --no-cache --virtual .gyp \
        autoconf \
        automake \
        findutils \
        g++ \
        libtool \
        make \
        python

RUN apk add postgresql-dev

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
RUN npm run transpile

CMD ["node", "app.js"]
