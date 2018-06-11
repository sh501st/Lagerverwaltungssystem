const util = require('./util');
const mysql = require('mysql');
const db_conn = mysql.createConnection({
  host     : 'localhost',
  user     : 'programmierpraktikum',
  password : 'AaSfayZPU8Pvleff',
  database : 'programmierpraktikum'
});


//add log entry for each article that's part of given order
exports.updateLog = (storage, order) => {
    //isolate article name from order
	let storage_id = storage._id;
    let unixtime = util.unix;
    let article_names = new Array();
    for (let i=0; i<order.articles.length; i++) {
        article_names.push(order.articles[i].name);        
    }
    //for each article determine id and add log entry
    article_names.forEach(function(article_name) {
        let prod_id;
        //get product id based on name
        db_conn.query("SELECT id from products WHERE name = '"+article_name+"' LIMIT 1", function(err, rows, fields) {
            if (err)  throw err;
            let prod_id = rows[0].id;
            console.log("INSERT INTO log (product, unix, storage_id) VALUES ('"+prod_id+"', '"+unixtime+"', '"+storage_id+"')");
            db_conn.query("INSERT INTO log (product, unix, storage_id) VALUES ('"+prod_id+"', '"+unixtime+"', '"+storage_id+"')", function (err, result) {
                if (err)  throw err;
            });
        });
    })
}

//returns number of accesses to given article_name in given timeframe via callback. 'article_name' must be a string e.g 'BookQ', 'start' and 'end' unix time in seconds.
/*example use to log number of accesses to 'BookQ' within the last 5 minutes:
db.accessByArticle('BookQ',util.unix-60*5,util.unix,storage._id, (err, number) => {
    if (err) {
        return console.log(err.message);
    }
    console.log(number);
});
*/
exports.accessByArticle = (article_name,start,end,storage_id,callback) => {
    //get product id based on name
    db_conn.query("SELECT id from products WHERE name = '"+article_name+"' LIMIT 1", function(err, rows1, fields) {
        if (err)  throw err;
        let prod_id = rows1[0].id;
        console.log("rows1.length: "+rows1.length);
        //determine occurences in log
        console.log("SELECT id from log WHERE product = '"+prod_id+"' AND unix > '"+start+"' AND unix <= '"+end+"' AND storage_id = '"+storage_id+"'");
        db_conn.query("SELECT id from log WHERE product = '"+prod_id+"' AND unix > '"+start+"' AND unix <= '"+end+"' AND storage_id = '"+storage_id+"'", function(err, rows2, fields) {
            if (err)  throw err;
            callback(null, rows2.length)
        });
    });
}

//returns number of accesses to given article_id in given timeframe via callback. 'article_id' must be the article id, 'start' and 'end' unix time in seconds.
/*example use:
db.accessById('42',1528336516,util.unix,2147483647, (err, number) => {
    if (err) {
        return console.log(err.message);
    }
    console.log(number);
});
*/
exports.accessById = (article_id,start,end,storage_id,callback) => {
    //determine occurences in log
    db_conn.query("SELECT id from log WHERE product = '"+article_id+"' AND unix > '"+start+"' AND unix <= '"+end+"' AND storage_id = '"+storage_id+"'", function(err, rows, fields) {
        if (err)  throw err;
        callback(null, rows.length)
    });
}
