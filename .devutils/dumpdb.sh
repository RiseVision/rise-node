#!/bin/bash

docker exec pg bash -c '/usr/local/bin/pg_dump -O $POSTGRES_DB -U $POSTGRES_USER | gzip > /tmp/backup.gz'
docker cp pg:/tmp/backup.gz $(dirname $0)/../backup.gz