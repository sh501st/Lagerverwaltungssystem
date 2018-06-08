#!/usr/bin/env bash
if $(systemctl is-active --quiet mariadb.service); then
    echo "MariaDB service is already running."
else
    echo "Starting MariaDB service:"
    systemctl start mariadb.service
fi
./node_modules/.bin/nodemon --ignore data/ server.js
