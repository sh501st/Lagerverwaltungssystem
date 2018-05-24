// express allows serving html files in the public subfolder quite
// easily. 'fs' is for nicer file reading and writing.
const express = require('express');
const app = express();
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');

// TODO: close/delete inactive storage upon client disconnect and no
// other client uses it
let activeStorages = new Map();
let observingClients = new Map();
let articles = []; // holds the csv articles

main();

// ======================================================================

// serve html files in public subfolders to clients connecting to
// localhost:8080. Also spawn mock order generation and imaginary
// worker dispatching upon start for all currently active storages. We
// handle all storages at the same time for every client that connects
// and requests a new json not yet loading. No longer bound to a
// single storage instance.
function main() {
    const server = http.createServer(app);
    const wss = new WebSocket.Server({ server });
    const port = 8080;

    wss.on('connection', (socket) => {
	socket.on('message', (msg) => {
	    handleClientMessage(socket, msg)
	});
	console.log('client connected');
	sendMessage(socket, 'id', { _id: generateSessionID() });
    });

    app.use(express.static(__dirname + '/public'));
    server.listen(port, () => { console.log('Listening on port %s', port); });

    readInMockArticles();
    generateOrders();
    dispatchWorkers();
}

// TODO: impl, find out how to do this the right way
function quitServer() {
    // wss.server.close/terminate();
    // server.close();
}


// Send unique ID to the session upon connecting, it will be used to
// name the created json storage file from the client side for later
// retrieval in the view-storage.html. For now it's just a unix
// millisecond timestamp, might change to something more elgant.
function generateSessionID() {
    return "" + Date.now();
}

function sendMessage(socket, type, data) {
    try {
	socket.send(JSON.stringify({ type: type, content: data }));
	if (type !== 'orderupdate') {
	    console.log('Sent:', type);
	}
    } catch (err) {
	console.log('Could not send message to client: ' + err);
	console.log('Removing client from observer list');
	removeClient(socket);
    }
}

// clients that we no longer reachable will be excluded from future
// status updates.
function removeClient(socket) {
    // TODO: close storages no one is observing anymore
    observingClients.forEach((clients, id) => {
	let remaining = clients.filter(client => client !== socket);
	if (remaining.length > 0) {
	    observingClients.set(id, remaining);
	} else {
	    observingClients.delete(id);
	}
    });
}

// only accepting client messages in the following object form:
// {
//     type: '...',
//     content: { ... }
// }
function handleClientMessage(socket, msg) {
    let data;
    try {
	data = JSON.parse(msg);
    } catch (err) {
	console.log('Message parsing error: ' + err);
	console.log(msg);
	return;
    }
    if (!data || !data.type || !data.content) {
	console.log('Received client data not valid.');
	console.log(msg);
	return;
    }
    const type = data.type;
    const content = data.content;

    console.log('Received:', type);

    switch (type) {
    case 'newstorage':
	createNewStorage(content);
	break;
    case 'reqlayout':
	let sid = content._id ? content._id : 0;
	let storage = activeStorages.get(sid);
	if (!storage) {
	    storage = loadStorageFromJSONFile(sid);
	}
	sid = storage._id; // TODO: necessary? deep checking.
	let observers = observingClients.get(sid);
	if (!observers) {
	    observingClients.set(sid, [socket]);
	} else {
	    observers.push(socket);
	}
	observingClients.forEach((clients, id) => {
	    console.log('Clients observing storage \"' + id + '\":', clients.length);
	});
	console.log('Active storages:', activeStorages.size);
	sendMessage(socket, 'storage', storage);
	break;
    case 'shelfinventory':
	let shelf = findShelf(content._id, content.x, content.y);
	sendMessage(socket, 'shelfinventory', shelf);
	break;
    default:
	console.log('Unknown type provided in client message:', type);
    }
}

function findShelf(id, x, y) {
    let storage = activeStorages.get(id);
    let shelf;
    if (storage) {
	shelf = storage.shelves.find((elem) => {
	    return elem.x === x && elem.y == y;
	});
    }
    return shelf;
}

// TODO: article volume/capacity not yet specified in the csv, also
// needs to be handled here later on.
function readInMockArticles() {
    fs.readFile('data/articles.csv', 'utf8', (err, text) => {
	if (err) {
	    console.log("Couldn't read-in mock articles: " + err);
	    quitServer();
	    return;
	}
	text.split('\n').map(line => {
	    const art = line.split(',');
	    const obj = { id: art[0], name: art[1], desc: art[2], prod: art[3] };
	    if (obj.id !== '#id') {
		articles.push(obj);
	    }
	});
    });
}

// newly generated order consistens of up to five randomly chosen
// articles from all available shelves within the provided storage,
// but will not contain any articles which are present in the csv but
// not in the current storage. 'genValid' is used for filling up the
// initial order cache, which is used to fake access patterns to get a
// nice looking heatmap, without increasing the inital order count, so
// a new storage will always begin with order number one.
function generateOrder(storage, genValidID = true) {
    let order = {
	id: (genValidID ? ++storage.orderCounter : -1),
	articles: []
    };
    let numItems = randInt(1,5);
    for (let i = 0; i < numItems; i++) {
	let shelf = storage.shelves[randInt(0, storage.shelves.length - 1)];
	let article = shelf.sub[randInt(0, shelf.sub.length - 1)].article;
	order.articles.push({ id: article.id, name: article.name });
    }
    return order;
}

// repeatable orders with invalid IDs for visible access pattern,
// otherwise you would get no clear heatmap pattern in a
// pseudoranom scenario
function generateOrderCache(storage, cacheSize = 5) {
    for (let i = 0; i < cacheSize; i++) {
	storage.orderCache.push(generateOrder(storage, false));
    }
}

// endless generation of fake orders from imaginary customers. Some
// will not be generated anew but reused from the cache to fight
// pseudo-random access distribution.
function generateOrders() {
    let f = () => {
	activeStorages.forEach((storage) => {
	    if (storage.orders.length < 8) {
		if (randBool(25)) { // 25% chance to recycle cached order
		    let order = Object.assign(
			{}, storage.orderCache[randInt(0, storage.orderCache.length - 1)]
		    );
		    order.id = ++storage.orderCounter;
		    addOrderToQueue(storage, order);
		} else {
		    addOrderToQueue(storage, generateOrder(storage));
		}
	    }
	});
	const minDelay = 1000;
	const maxDelay = 5000;
	const randDelay = randInt(minDelay, maxDelay);
	setTimeout(f, randDelay);
    };
    f();
}

// once a new order was generated, add it to the storage's internal
// queue and notify all client which are currenly viewing this storage
// so they can update their order queue list besides the canvas.
function addOrderToQueue(storage, order) {
    if (!order) {
	console.log("No order specified, not adding.");
	return;
    }
    storage.orders.push(order);
    notifyObservingClients(storage);
}

// simulated worker handling an order.
function takeOrderFromQueue(storage) {
    if (storage.orders.length === 0) {
	console.log('No orders left in queue. Come again later.');
	return null;
    }
    let order = storage.orders.shift();
    return order;
}

// simulate and endless stream of workers that are handling all the
// queued up orders. Again, all watching clients will be notifed so
// that they can update their order list next to the canvas.
function dispatchWorkers() {
    let f = () => {
	activeStorages.forEach((storage) => {
	    if (storage.orders.length > 0) {
		let order = takeOrderFromQueue(storage);
		notifyObservingClients(storage, order);
	    }
	});
	setTimeout(f, 3500);
    };
    f();
}

function notifyObservingClients(storage, removed = null) {
    let clients = observingClients.get(storage._id);
    if (clients) {
	clients.forEach((client) => {
	    sendMessage(client, 'orderupdate', {
		orders: storage.orders,
		removed: removed
	    });
	});
    }
}

// random ranged integer, both inclusive
function randInt(from, to) {
    return Math.floor(Math.random() * (to - from + 1) + from);
}

// weighted random bool, used for order cache reuse
function randBool(percent = 50) {
    return Math.random() * 100 < percent;
}

function getRandomArticle() {
    return articles[randInt(0, articles.length -1)];
}

// count is the number of articles within this subshelf.
function generateRandomSubShelf(subshelf) {
    return {
	article: getRandomArticle(),
	count: randInt(1, 100)
    };
}

// fill the newly created storage's shelves with random articles on
// the server-side due to file reading issues in the frontend.
// Currently every shelf has four subshelves (arbitrarily hardcoded).
function fillShelvesRandomly(shelves) {
    const numSubShelves = 4;
    shelves.forEach((shelf) => {
	for (let i = 0; i < numSubShelves; i++) {
	    shelf.sub.push(generateRandomSubShelf());
	}
    });
}

// this is called when a client has sent over his empty storage draft
// via the create-storage.html export button. All empty shelves will
// be filled randomly and the whole thing will be written to disk with
// the sessionID as the filename.
function createNewStorage(storage) {
    // TODO: check reachability as well and not trust client to avoid
    // problems down the road?
    if (!storage || !storage.shelves) {
	console.log("Can't access shelves in newly created storage");
	return;
    }
    fillShelvesRandomly(storage.shelves);
    const filename = 'data/storages/' + storage._id + '.json';
    fs.writeFile(filename, JSON.stringify(storage), 'utf8', (err) => {
	if (err) {
	    console.log("Couldn't write storage json to disk: " + err);
	} else {
	    console.log("Storage written sucessfully");
	}
    })
}

// when client requests a certain file via the provided sessionID we
// try to load it. If the sessionID is not valid and thus the file not
// found, we will serve the default storage template instead. This
// will also happen when the client chooses the view-storage.html from
// the index.html before building his/her own with
// create-storage.html.
function loadStorageFromJSONFile(sessionID) {
    if (!sessionID) { sessionID = 0; }
    const dir = 'data/storages/';
    const templateFile = dir + 'template.json';
    const sessionFile = dir + sessionID + '.json';
    const toLoad = fs.existsSync(sessionFile) ? sessionFile : templateFile;

    try {
	let storage = JSON.parse(fs.readFileSync(toLoad, 'utf8'));
	storage.orderCounter = 0;
	storage.orders = [];
	storage.orderCache = [];
	generateOrderCache(storage);
	activeStorages.set(storage._id, storage);
	return storage;
    } catch (err) {
	console.log("Couldn't read-in storage file with given sessionID:", err);
	return;
    }
}