#!/bin/bash

docker cp ${1} pg:/tmp/latest.gz
docker exec pg bash -c '/usr/local/bin/dropdb -U $POSTGRES_USER --if-exists $POSTGRES_DB'
docker exec pg bash -c '/usr/local/bin/createdb -U $POSTGRES_USER -O $POSTGRES_USER $POSTGRES_DB'
docker exec pg bash -c 'gunzip -c /tmp/latest.gz | /usr/local/bin/psql -U $POSTGRES_USER $POSTGRES_DB > /dev/null'
docker exec pg bash -c 'rm /tmp/latest.gz'

