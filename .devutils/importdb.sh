#!/bin/bash

docker cp ${1} pg:/tmp/latest.tar
docker exec pg bash -c '/usr/local/bin/pg_restore -d $POSTGRES_DB /tmp/latest.tar -U $POSTGRES_USER -c -n public'
docker exec pg bash -c 'rm /tmp/latest.tar'

