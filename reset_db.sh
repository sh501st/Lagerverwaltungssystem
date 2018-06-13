#!/bin/bash 

echo "Make sure your mariadb is running!"

mysql -u "programmierpraktikum" "-pAaSfayZPU8Pvleff" "-Dprogrammierpraktikum" "-eDROP TABLE compartments, log, products;"

mysql -u "programmierpraktikum" "-pAaSfayZPU8Pvleff" "programmierpraktikum" < "datenbankmodell/programmierpraktikum.sql"
