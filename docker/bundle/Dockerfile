FROM node:10-jessie-slim

RUN apt-get update
RUN apt-get install -y \
		build-essential \
        python \
        postgresql-server-dev-all

RUN mkdir -p /home/rise
#RUN mkdir -p /home/rise/logs

WORKDIR /home/rise
COPY config.json config.json

COPY rise-node.tar.gz .
RUN tar -zxf rise-node.tar.gz
RUN rm rise-node.tar.gz
# TODO should log to /home/rise/logs instead, fix pwd
RUN mkdir -p /home/rise/rise-node/packages/rise/logs
# rebuild npm modules
RUN cd rise-node && npm rebuild

ENV NETWORK="mainnet"
EXPOSE 5554
EXPOSE 5555

WORKDIR /home/rise/rise-node
CMD ./node_modules/.bin/lerna run \
	start:$NETWORK --stream --no-prefix -- \
	-e $(pwd)/../config.json

# debug
#CMD bash
