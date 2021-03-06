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
    const timestamp = util.unix();
    order.articles.forEach((article, index) => {
        const sqlStr = `INSERT INTO log (order_id, no_in_order, product, unix, storage_id) VALUES
                        ('${order.id}', '${index}', '${article.id}', '${timestamp}', '${storage._id}')`;
        db_conn.query(sqlStr, (err, res) => {
            if (err) { console.log('Inserting access updates failed:', err); }
        });
    });
}

//returns number of accesses to given article_name in given timeframe via callback. 'article_name' must be a string e.g 'BookQ', 'start' and 'end' unix time in seconds.
/*example use to log number of accesses to 'BookQ' within the last 5 minutes:
  db.accessByArticle('BookQ',util.unix()-60*5,util.unix(),storage._id, (err, number) => {
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
        //determine occurences in log
        db_conn.query("SELECT id from log WHERE product = '"+prod_id+"' AND unix > '"+start+"' AND unix <= '"+end+"' AND storage_id = '"+storage_id+"'", function(err, rows2, fields) {
            if (err)  throw err;
            callback(null, rows2.length)
        });
    });
}

// returns number of accesses to given article_id in given timeframe.
// 'article_id' must be the article id, 'start' and 'end' unix time in seconds
// and 'storage_id' the id of the storage file in question.
//
// Since this is called repeatedly to lookup access for the shelf
// inventory, it's cumbersome and ugly to chain up to five callbacks,
// because we need to wait for all of them to finish before sending
// out the msg. Async+await makes the call to accessById seem like a
// regular old function call. One note, the function from within await
// db.accessById(...) was called needs to be declared async (see
// sendShelfToClient in server.js)
//
// example usages:
//
// let accesses = await db.accessById('42', 1528336516, util.unix(), 2147483647);
//
// for (let i = 0; i < shelf.sub.length; i++) {
//     let article = shelf.sub[i].article;
//     article.accessCounter = await db.accessById(article.id, 0, util.unix(), storageID);
// }
exports.accessById = (article_id, start, end, storage_id) => {
    const sqlStr =
          `SELECT COUNT(*) AS accesses FROM log
           WHERE product = '${article_id}' AND unix > '${start}' AND
                 unix <= '${end}' AND storage_id = '${storage_id}'`;
    return new Promise((resolve, reject) => {
        db_conn.query(sqlStr, (err, rows, fields) => {
            if (err) {
                console.log("Can't get number of accesses for given IDs:", err.message);
                reject(err);
            }
            resolve(rows[0].accesses);
        });
    });
}

// exports.readInMockArticles
// get all articleIDs and the access count per article in a given
// start and end time range; sort the matches in ascending descening
// order. Results is an array in the following form: [{product: 12,
// accesses: 3,}, {...}, ...]
exports.sortedAccessesInRange = (start, end, storage_id, callback) => {
    const sqlStr =
          `SELECT product, COUNT(*) AS accesses FROM log
           WHERE unix >= '${start}' AND unix <= '${end}' AND storage_id = '${storage_id}'
           GROUP BY product ORDER BY accesses DESC`;
    db_conn.query(sqlStr, (err, rows, fields) => {
        if (err) {
            console.log("Can't get sorted articles in time range from database");
        } else {
            callback(rows);
        }
    });
}

// lookup max and min timestamp values for a given storage ID to set
// access sliders accordingly
exports.getTimeRange = (storage_id, callback) => {
    const sqlStr = `SELECT MIN(unix) AS min, MAX(unix) AS max FROM log WHERE storage_id='${storage_id}'`;
    db_conn.query(sqlStr, (err, res, fields) => {
        if (err) {
            console.log("Can't get unix timestamp range for given storage ID:", storage_id);
        } else if (res && res.length === 1) {
            const minTime = res[0].min ? res[0].min : 0;
            const maxTime = res[0].max ? res[0].max : 0;
            callback(minTime, maxTime);
        }
    });
}


// TODO: article volume/capacity not yet specified in the db, also
// needs to be handled here later on.
exports.readInMockArticles = (callback) => {
    db_conn.query("SELECT id, name, description, producer from products", function(err, rows, fields) {
        let articles_db = [];
        rows.forEach(function(row) {
            articles_db.push({
                id: row.id,
                name: row.name,
                desc: row.description,
                prod: row.producer
            });
        });
        callback(err, articles_db);
    });
}

//get latest order counter of given storage via callback
exports.getLatestOrderCounter = (storage) => {
    const sqlStr = `SELECT MAX(order_id) AS max FROM log WHERE storage_id='${storage._id}'`;
    return new Promise((resolve, reject) => {
        db_conn.query(sqlStr, (err, rows, fields) => {
            if (err) {
                console.log("Can't get order counter for given storage:", err.message);
                reject(err);
            }
            resolve(rows.length > 0 ? rows[0].max : 0);
        });
    });
}


//get the top 6 of frequently accessed products within one order of given 'product id'
//rows contains a table with the columns product and cnt sorted by cnt desc.
//product is the article id of a product that is being ordered frequently with given 'product_id'.
//cnt is the number of orders in which both products are present.
exports.getFrequentlyOrderedTogether = (product_id, storage_id) => {
    const sqlStr = `SELECT products.name as product, count(*) AS cnt FROM log
                    LEFT JOIN products ON log.product = products.id
                    WHERE order_id IN
                        ( SELECT order_id FROM log WHERE product='${product_id}'
                        AND storage_id='${storage_id}' GROUP BY order_id )
                    AND product != '${product_id}'
                    GROUP BY product
                    ORDER BY cnt DESC
                    LIMIT 6`;
    return new Promise((resolve, reject) => {
        db_conn.query(sqlStr, (err, rows, fields) => {
            if (err) {
                console.log("Can't get \"frequently bought together\" of given product_id:", err.message);
                reject(err);
            }
            if(rows.length <= 0){rows = [{product:null, cnt:null}];}
            resolve(rows);
        });
    });
}


//get the total amount of orders that contain given 'product id'
exports.getAmountOfOrders = (product_id, storage_id) => {
    const sqlStr = `SELECT count(order_id) AS totalOrders from
                       ( SELECT order_id FROM log WHERE product='${product_id}'
                        AND storage_id='${storage_id}' GROUP BY order_id ) AS orders`;
    return new Promise((resolve, reject) => {
        db_conn.query(sqlStr, (err, rows, fields) => {
            if (err) {
                console.log("Can't get \"frequently bought together\" of given product_id:", err.message);
                reject(err);
            }
            if(rows.length <= 0){rows = {amountOfOrders:null};}
            resolve(rows);
        });
    });
}
