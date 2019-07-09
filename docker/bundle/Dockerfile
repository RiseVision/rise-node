FROM node:10-jessie-slim

RUN apt-get update
RUN apt-get install -y \
		build-essential \
        python \
        postgresql-server-dev-all

RUN mkdir -p /home/rise
#RUN mkdir -p /home/rise/logs

WORKDIR /home/rise
COPY config-docker.json config.json

COPY source.tar.gz .
RUN tar -zxf source.tar.gz
RUN rm source.tar.gz
# TODO should log to /home/rise/logs instead, fix pwd
RUN mkdir -p /home/rise/source/packages/rise/logs
# rebuild npm modules
RUN cd source && npm rebuild

ENV NETWORK="mainnet"
EXPOSE 5554
EXPOSE 5555

WORKDIR /home/rise/source
CMD ./node_modules/.bin/lerna run \
	start:$NETWORK --stream --no-prefix -- \
	-e $(pwd)/../config.json

# debug
#CMD bash
