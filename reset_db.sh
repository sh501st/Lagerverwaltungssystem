#!/bin/bash

if $(systemctl is-active --quiet mariadb.service); then
    echo "MariaDB service is running..."
else
    echo "Starting MariaDB service:"
    systemctl start mariadb.service
fi

echo "Deleting old tables..."
mysql -u "programmierpraktikum" "-pAaSfayZPU8Pvleff" "-Dprogrammierpraktikum" "-eDROP TABLE log, products;"

echo "Importing new tables..."
mysql -u "programmierpraktikum" "-pAaSfayZPU8Pvleff" "programmierpraktikum" < "datenbankmodell/programmierpraktikum.sql"
