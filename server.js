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

    readInMockArticles();
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
	sendLayoutToClient(content._id ? content._id : 0, socket,
			   content.observeStorage);
	break;
    case 'reqpreview':
	sendOptimizedStoragePreviewToClient(
	    content._id ? content._id : 0, socket, content.from, content.to);
	break;
    case 'shelfinventory':
	sendShelfToClient(content._id, content.x, content.y, socket);
	break;
    default:
	console.log('Unknown type provided in client message:', type);
    }
}

// client sends storage ID and expects storage layout which is either
// loaded from mem cache or json file on disk when not active
function sendLayoutToClient(storageID, socket, observeStorage = true) {
    let storage = activeStorages.get(storageID);
    if (!storage) {
	storage = loadStorageFromJSONFile(storageID, observeStorage);
    }
    if (observeStorage) {
	storageID = storage._id; // TODO: necessary? deep checking.
	let observers = observingClients.get(storageID);
	if (!observers) {
	    observingClients.set(storageID, [socket]);
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
// were reordered.
function sendOptimizedStoragePreviewToClient(storageID, socket, fromTime, toTime) {
    const observeStorage = false;
    const storage = loadStorageFromJSONFile(storageID, observeStorage);
    if (storage) {
	const optimizedStorage = optimize.sortSubShelvesByAccess(storage, fromTime, toTime);
	if (optimizedStorage) {
	    sendMessage(socket, 'preview', optimizedStorage);
	}
    }
}

// client sends storage ID and click coordiantes and expects the
// contents of that very shelf
function sendShelfToClient(storageID, shelfX, shelfY, socket) {
    let storage = activeStorages.get(storageID);
    if (storage && (shelfX >= 0 || shelfX <= storage.width) &&
	(shelfY >= 0 || shelfY <= storage.height))
    {
	let shelf = storage.shelves.find((elem) => {
	    return elem.x === shelfX && elem.y == shelfY;
	});
	sendMessage(socket, 'shelfinventory', shelf);
    }
}

// TODO: article volume/capacity not yet specified in the csv, also
// needs to be handled here later on.
// Needs to be transitioned to MySQL
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
		notifyObservingClients(storage, order);
		db.updateLog(storage, order);    
	    }
	});
	setTimeout(f, 3500);
    };
    f();
}

function notifyObservingClients(storage, currentOrder = null) {
    let clients = observingClients.get(storage._id);
    if (clients) {
	clients.forEach((client) => {
	    sendMessage(client, 'orderupdate', {
		orders: storage.orders,
		currentOrder: currentOrder
	    });
	});
    }
}

// fill the newly created storage's shelves with random articles on
// the server-side due to file reading issues in the frontend.
// Currently every shelf has four subshelves (arbitrarily hardcoded).
function fillShelvesRandomly(shelves) {
    for (let shelf of shelves) {
	const numSubShelves = 4;
	shelf.sub = [];
	for (let i = 0; i < numSubShelves; i++) {
	    let acopy = Object.assign({
		shelfX: shelf.x,
		shelfY: shelf.y
	    }, articles[util.randInt(0, articles.length - 1)]);
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
    fillShelvesRandomly(storage.shelves);
    const filename = 'data/storages/' + storage._id + '.json';
    try {
	fs.writeFileSync(filename, JSON.stringify(storage), 'utf8');
	console.log("Storage written sucessfully");
    } catch (err) {
	console.log("Couldn't write storage json to disk: " + err);
    }
}

// when client requests a certain file via the provided sessionID we
// try to load it. If the sessionID is not valid and thus the file not
// found, we will serve the default storage template instead. This
// will also happen when the client chooses the view-storage.html from
// the index.html before building his/her own with
// create-storage.html.
function loadStorageFromJSONFile(sessionID, observeStorage = true) {
    if (!sessionID) { sessionID = 0; }
    const dir = 'data/storages/';
    const templateFile = dir + 'template.json';
    const sessionFile = dir + sessionID + '.json';
    const toLoad = fs.existsSync(sessionFile) ? sessionFile : templateFile;

    try {
	let storage = JSON.parse(fs.readFileSync(toLoad, 'utf8'));
	if (observeStorage) {
	    storage.orderCounter = 0;
	    storage.orders = [];
	    storage.orderCache = [];
	    orders.generateOrderCache(storage);
	    activeStorages.set(storage._id, storage);
	}
	return storage;
    } catch (err) {
	console.log("Couldn't read-in storage file with given sessionID:", err);
	return;
    }
}
