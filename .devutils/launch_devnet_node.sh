#!/bin/bash

CURNODE=$1;
shift;
DBPORT=$(( $CURNODE + 5432 ))
PEERPORT=$(( $CURNODE + 10001 ))

if ! docker top pg_$DBPORT &>/dev/null
then
    echo "Launching docker"
    docker run --rm --name pg_$DBPORT -d \
        -e POSTGRES_PASSWORD=password -e POSTGRES_USER=test -e POSTGRES_DB=test \
        -p $DBPORT:5432 postgres:9.6-alpine;

    sleep 5;
fi

PARAMS="-C $.blockTime=1 -C $.dposv2.firstBlock=102 -o $.consoleLogLevel=info -o $.db.port=$DBPORT $@"
if [ "$PEERPORT" -eq "10001" ]; then
    PARAMS="$PARAMS -o $.forging.force=true"
else
    PARAMS="$PARAMS -o $.forging.secret=[]"
fi

NODE_ENV=TEST ./node_modules/.bin/ts-node ./src/app.ts \
    -x 127.0.0.1:10001 -n devnet -p $PEERPORT \
    $PARAMS
