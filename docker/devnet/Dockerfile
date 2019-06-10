FROM node:10-jessie-slim

RUN apt-get update
RUN apt-get install -y \
		build-essential \
        python \
        postgresql-server-dev-all

RUN mkdir -p /home/rise/rise-node
RUN mkdir -p /home/rise/logs
WORKDIR /home/rise/rise-node

ENV NETWORK="mainnet"
EXPOSE 9999
EXPOSE 9998
EXPOSE 9229

# rebuild native modules
# uncomment and run once, on one node only (docker-compose.yml)
#CMD npm rebuild

# debug with --inspect
CMD npx lerna run debug:$NETWORK --stream --no-prefix -- \
	-e /home/rise/config.json

# debug with --inspect-brk
#CMD npx lerna run break:$NETWORK --stream --no-prefix -- \
#	-e /home/rise/config.json

# debug
#CMD bash
