#!/bin/bash

docker exec pg bash -c '/usr/local/bin/pg_dump -Ft $POSTGRES_DB -U $POSTGRES_USER > /tmp/backup.tar'
docker cp pg:/tmp/backup.tar $(dirname $0)/../backup.tar