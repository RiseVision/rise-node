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
RUN mkdir /home/rise/logs

WORKDIR /home/rise
COPY config.json config.json

WORKDIR /home/rise/rise-node
COPY rise.tar .
RUN tar -xf rise.tar
RUN rm rise.tar

ENV NETWORK="mainnet"
EXPOSE 5555

# rebuild the native modules
#RUN npm rebuild

CMD ./node_modules/.bin/lerna run \
	start:$NETWORK --stream --no-prefix -- \
	-e config.json

# debug
#CMD sh
