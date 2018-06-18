#!/usr/bin/env bash
if $(systemctl is-active --quiet mariadb.service); then
    echo "MariaDB service is already running."
else
    echo "Starting MariaDB service:"
    systemctl start mariadb.service
fi

./reset_db.sh

echo "Starting node server..."
./node_modules/.bin/nodemon --ignore data/ server.js
