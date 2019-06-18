#!/bin/bash

docker cp ${1} devnet_postgres_1_1:/tmp/latest.gz
docker exec devnet_postgres_1_1 bash -c '/usr/local/bin/dropdb -U $POSTGRES_USER --if-exists $POSTGRES_DB'
docker exec devnet_postgres_1_1 bash -c '/usr/local/bin/createdb -U $POSTGRES_USER -O $POSTGRES_USER $POSTGRES_DB'
docker exec devnet_postgres_1_1 bash -c 'gunzip -c /tmp/latest.gz | /usr/local/bin/psql -U $POSTGRES_USER $POSTGRES_DB > /dev/null'
docker exec devnet_postgres_1_1 bash -c 'rm /tmp/latest.gz'

