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

ENV NETWORK="mainnet"
EXPOSE 5555

# rebuild native modules
# uncomment and run once
#RUN npm rebuild

CMD npx lerna run debug:$NETWORK --stream --no-prefix -- \
	-e /home/rise/config.json

# debug
#CMD bash
