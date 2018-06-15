// express allows serving html files in the public subfolder quite
// easily. 'fs' is for nicer file reading and writing.
//'db' is data to establish connection to local databse
const express = require('express');
const app = express();
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');

const db = require('./include/db');
const optimize = require('./include/optimize');
const orders = require('./include/orders');
const pathfinding = require('./include/pathfinding');
const util = require('./include/util');

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

    db.readInMockArticles((err, articles_db) => {
        if (err) { return console.log(err.message); }
        articles = articles_db;
    });

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
// second timestamp, might change to something more elgant.
function generateSessionID() {
    return util.unix();
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
	sendLayoutToClient(content._id, socket, content.observeStorage);
	break;
    case 'reqpreview':
	sendOptimizedStoragePreviewToClient(
	    content._id, socket, content.from, content.to);
	break;
    case 'applypreview':
	applyOptimizedStoragePreview(
	    content._id, content.from, content.to, socket);
	break;
    case 'shelfinventory':
	sendShelfToClient(content._id, content.x, content.y, socket);
	break;
    case 'reqrange':
	sendAccessTimeRangeToClient(content._id, socket);
	break;
    default:
	console.log('Unknown type provided in client message:', type);
    }
}

// client sends storage ID and expects storage layout which is either
// loaded from mem cache or json file on disk when not active
function sendLayoutToClient(storageID, socket, observeStorage = true) {
    if (!storageID) {
	storageID = getTemplateStorageID();
    }
    let storage = activeStorages.get(storageID);
    if (!storage) {
	storage = loadStorageFromJSONFile(storageID, observeStorage);
    }
    if (observeStorage) {
	let observers = observingClients.get(storage._id);
	if (!observers) {
	    observingClients.set(storage._id, [socket]);
	} else {
	    observers.push(socket);
	}
	observingClients.forEach((clients, id) => {
	    console.log('Clients observing storage \"' + id + '\":', clients.length);
	});
	console.log('Active storages:', activeStorages.size);
    }
    sendMessage(socket, 'storage', storage);
}

// client sends storage ID and log access range and expects and
// optimized storage setup preview to later animate the transition
// between the current state and what it could look once subshelves
// were to be rearranged.
function sendOptimizedStoragePreviewToClient(storageID, socket, fromTime, toTime) {
    if (!storageID) {
	storageID = getTemplateStorageID();
    }
    const observeStorage = false;
    const storage = loadStorageFromJSONFile(storageID, observeStorage);
    if (storage) {
	optimize.rearrangeSubShelves(storage, fromTime, toTime, (optimizedStorage) => {
	    console.log('Storage "' + storage._id + '" optimized');
	    sendMessage(socket, 'preview', {
		regular: storage,
		optimized: optimizedStorage
	    });
	});
    }
}

// client sends storage ID and gets back the optimized storage ID
// after the subshelf transformation. Optimized storage is written to
// a new file, preserving the original storage setup.
function applyOptimizedStoragePreview(storageID, fromTime, toTime, socket) {
    if (!storageID) {
	storageID = getTemplateStorageID();
    }
    if (!(storageID > 0) || fromTime === 0 || toTime === 10) {
	console.log('Provided optimization parameters are not valid.');
	return;
    }
    const storage = loadStorageFromJSONFile(storageID, false);
    optimize.rearrangeSubShelves(storage, fromTime, toTime, (optimizedStorage) => {
	optimize.updateOrderCache(optimizedStorage);
	const updatedID = writeStorageToJSONFile(optimizedStorage);
	if (updatedID > 0) {
	    sendMessage(socket, 'applied', { _id: updatedID });
	}
    });
}

// client sends storage ID and click coordiantes and expects the
// contents of that very shelf in a tabular layout.
async function sendShelfToClient(storageID, shelfX, shelfY, socket) {
    if (!storageID) {
	storageID = getTemplateStorageID();
    }
    let storage = activeStorages.get(storageID);
    if (storage && (shelfX >= 0 || shelfX <= storage.width) &&
	(shelfY >= 0 || shelfY <= storage.height))
    {
	let shelf = storage.shelves.find((elem) => {
	    return elem.x === shelfX && elem.y == shelfY;
	});
	for (let i = 0; i < shelf.sub.length; i++) {
	    let sub = shelf.sub[i];
	    sub.accessCounter = await db.accessById(sub.article.id, 0, util.unix(), storageID);
	}
	sendMessage(socket, 'shelfinventory', shelf);
    }
}

// client sends storage id and expects the min and max timestamp
// values straight from the db access log that are associated with the
// given id.
function sendAccessTimeRangeToClient(storageID, socket) {
    if (!storageID) {
	storageID = getTemplateStorageID();
    }
    db.getTimeRange(storageID, (minTime, maxTime) => {
	if (minTime >= 0 && maxTime <= util.unix()) {
	    sendMessage(socket, 'range', { min: minTime, max: maxTime });
	}
    });
}

// simulate and endless stream of workers that are handling all the
// queued up orders. Again, all watching clients will be notifed so
// that they can update their order list next to the canvas.
function dispatchWorkers() {
    orders.generateOrders(activeStorages, notifyObservingClients);

    const moveSpeedInTilesPerSec = 4;
    let f = () => {
	activeStorages.forEach((storage) => {
	    let order = orders.takeOrderFromQueue(storage);
	    if (order) {
		order.path = pathfinding.generateWorkerPath(storage, order);
		order.speed = moveSpeedInTilesPerSec;
		notifyObservingClients(storage, order, true);
		db.updateLog(storage, order);
	    }
	});
	setTimeout(f, 2000);
    };
    f();
}

function notifyObservingClients(storage, order, removed = false) {
    let clients = observingClients.get(storage._id);
    if (clients) {
	clients.forEach((client) => {
	    sendMessage(client, 'orderupdate', {
		order: order,
		removed: removed
	    });
	});
    }
}

// fill the newly created storage's shelves with random articles
// coming from a predefined set in the database. Currently every shelf
// has four subshelves (arbitrarily hardcoded) and of which each and
// every one is unique, meaning that no two subshelves contain the
// same article.
function fillShelvesRandomly(shelves) {
    if (articles.length === 0) {
	console.log('No articles available, database running?');
	return;
    }
    util.shuffle(articles);
    let articleIdx = 0;
    for (let shelf of shelves) {
	const numSubShelves = 4;
	shelf.sub = [];
	for (let i = 0; i < numSubShelves; i++) {
	    let acopy = Object.assign({
		shelfX: shelf.x,
		shelfY: shelf.y
	    }, articles[articleIdx++]);
	    let subshelf = {
		article: acopy,
		count: util.randInt(1, 100)
	    };
	    shelf.sub[i] = subshelf;
	}
    }
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
    if (storage.width < 5 || storage.height < 5 ||
	storage.width > 20 || storage.height > 20)
    {
	console.log('Storage dimensions are invalid, need to be within 5x5 to 20x20:',
		    storage.width, storage.height);
	return;
    }
    fillShelvesRandomly(storage.shelves);
    writeStorageToJSONFile(storage);
}

// Copy on write behaviour: if storage with same ID (or filename in
// this case) already exists, create to a new file and return that
// very ID as an usable sessionID. Mainly to avoid overwriting the
// default template.json over and over again.
function writeStorageToJSONFile(storage) {
    try {
	let storageCopy;
	let filename = 'data/storages/' + storage._id + '.json';
	if (fs.existsSync(filename)) {
	    storageCopy = JSON.parse(JSON.stringify(storage));
	    storageCopy._id = generateSessionID();
	    filename = 'data/storages/' + storageCopy._id + '.json';
	}
	const serialized = JSON.stringify(storageCopy ? storageCopy : storage);
	fs.writeFileSync(filename, serialized, 'utf8');
	console.log("Storage written sucessfully");
	return storageCopy ? storageCopy._id : storage._id;
    } catch (err) {
	console.log("Couldn't write storage json to disk:", err);
	return -1;
    }
}

// when reloading the same storage file we want to reload a certain
// set of pre-generated orders to retain the occuring heatmap pattern
// even after optimizing the subshelf structure. Essentially a simple
// write-back after generating the order cache.
function bindOrderCacheToStorageFile(storage) {
    try {
	let filename = 'data/storages/' + storage._id + '.json';
	if (fs.existsSync(filename)) {
	    fs.writeFileSync(filename, JSON.stringify(storage), 'utf8');
	} else {
	    console.log("Can't bind order cache since storageID is not valid");
	}
    } catch (err) {
	console.log("Couldn't update storage's order cache:", err);
    }
}

// when client requests a certain file via the provided sessionID we
// try to load it. If the sessionID is not valid and thus the file not
// found, we will serve the default storage template instead. This
// will also happen when the client chooses the view-storage.html from
// the index.html before building his/her own with
// create-storage.html.
function loadStorageFromJSONFile(sessionID, observeStorage = true) {
    const dir = 'data/storages/';
    const templateFile = dir + 'template.json';
    const sessionFile = dir + sessionID + '.json';
    const toLoad = fs.existsSync(sessionFile) ? sessionFile : templateFile;

    try {
	let storage = JSON.parse(fs.readFileSync(toLoad, 'utf8'));
	if (observeStorage) {
	    storage.orderCounter = 0;
	    storage.orders = [];
	    if (!storage.orderCache) {
		orders.generateOrderCache(storage);
		bindOrderCacheToStorageFile(storage);
	    }
	    activeStorages.set(storage._id, storage);
	}
	return storage;
    } catch (err) {
	console.log("Couldn't read-in storage file with given sessionID:", err);
	return;
    }
}

let templateStorageID;
function getTemplateStorageID() {
    if (templateStorageID) {
	return templateStorageID;
    }
    const templateFile = 'data/storages/template.json';
    if (!fs.existsSync(templateFile)) {
	console.log("Couldn't find the template storage");
	return -1;
    }
    try {
	const storage = JSON.parse(fs.readFileSync(templateFile, 'utf8'));
	return storage._id;
    } catch (err) {
	console.log("Couldn't read-in template storage file:", err);
	return -1;
    }
}
