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

WORKDIR /home/rise/rise-node

RUN mkdir /home/rise/logs
ENV NETWORK="mainnet"
EXPOSE 5555

# rebuild native modules
#CMD npm rebuild \
#	&& npx lerna run start:$NETWORK --stream --no-prefix -- \
#	-e /home/rise/config.json

# skip rebuilding
CMD npx lerna run start:$NETWORK --stream --no-prefix -- \
	-e /home/rise/config.json

# debug
#CMD bash
