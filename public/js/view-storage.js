// TODO: should be fetched from the css for consistency reasons
const Color = Object.freeze({
    DEFAULT: '#f0f0f0',
    BORDER: '#606060',
    HIGHLIGHT: '#30aaee',
    ACCESS: '#ee3060',
    OVERLAY: '#909090'
});

let storage, cols, rows;
let stage, layer, greyOverlayLayer, popupLayer, statusLayer;
let socket, sessionID;

const canvasWidth = window.innerWidth;
const canvasHeight = window.innerHeight;
const tileSize = 32;

function main() {
    sessionID = readFromSessionStorage('sessionID');
    connectToServer().then(() => {
	requestStorageLayoutFromServer(sessionID);
    });
}

// called by message handler as soon as the requested server response
// is available
function storageReceivedFromServer() {
    if (!storage || !storage.width || !storage.height) {
	console.log("Requested storage layout is not valid:", storage);
	return;
    }
    cols = storage.width;
    rows = storage.height;
    recreateStorageLayout();
}

// initialize the canvas and setup all the graphical fluff (tiles,
// borders, layers, popup, etc)
function recreateStorageLayout() {
    stage = new Konva.Stage({
	container: 'mainContainer',
	x: (window.innerWidth - cols * tileSize) / 2,
	y: (window.innerHeight - rows * tileSize) / 2,
	width: canvasWidth,
	height: canvasHeight,
	draggable: true
    });
    window.addEventListener('wheel', handleMouseScroll);

    layer = new Konva.Layer();
    createStorageBorder();
    createShelves();
    createEntrances();
    stage.add(layer);

    greyOverlayLayer = new Konva.Layer();
    let block = new Konva.Rect({
	x: 0,
	y: 0,
	width: cols * tileSize,
	height: rows * tileSize,
	fill: Color.OVERLAY,
	opacity: 0.7
    });
    greyOverlayLayer.add(block);
    greyOverlayLayer.hide();
    stage.add(greyOverlayLayer);

    // TODO: should really be html+css instead of this ugly overlay
    popupLayer = new Konva.Layer();
    let popup = new Konva.Rect({
	id: 'popup',
	x: cols * tileSize / 4,
	y: rows * tileSize / 8,
	width: cols * tileSize / 2,
	height: rows * tileSize * 0.75,
	fill: Color.DEFAULT,
	stroke: Color.BORDER,
	strokeWidth: 3
    });
    const textPadding = 20;
    let inventoryText = new Konva.Text({
	id: 'invLabel',
	x: popup.x() + textPadding,
	y: popup.y() + textPadding,
	width: popup.width() - textPadding * 2,
	height: popup.height() - textPadding * 2,
	fontSize: 24,
	fill: Color.BORDER,
	text: 'EMPTY'
    });
    popupLayer.add(popup);
    popupLayer.add(inventoryText);
    popupLayer.hide();
    stage.add(popupLayer);

    // TODO: should really be html+css instead of this ugly overlay.
    statusLayer = new Konva.Layer();
    let orderText = new Konva.Text({
	id: 'ordLabel',
	x: cols * tileSize + 30,
	y: 0,
	fontSize: 16,
	fill: Color.BORDER,
	text: 'No orders yet.'
    });
    statusLayer.add(orderText);
    stage.add(statusLayer);
}

// zoom in at and out of mouse position instead of left upper corner
// (default behaviour)
function handleMouseScroll(e) {
    e.preventDefault();
    const fact = 1.1;
    const origScale = stage.scaleX();
    const newScale = e.deltaY < 0 ? origScale * fact : origScale / fact;
    const mx = stage.getPointerPosition().x;
    const my = stage.getPointerPosition().y;
    const nx = (mx - stage.x()) / origScale;
    const ny = (my - stage.y()) / origScale;
    stage.scale({ x: newScale, y: newScale });
    stage.position({
	x: mx - nx * newScale,
	y: my - ny * newScale
    });
    stage.batchDraw();
}

// simply draw the edges of the storage, more visually pleasing
function createStorageBorder() {
    let border = new Konva.Line({
	points: [0, 0, 0, rows*tileSize, cols*tileSize,
		 rows*tileSize, cols*tileSize, 0, 0, 0],
	stroke: Color.BORDER,
	strokeWidth: 2
    });
    layer.add(border);
}

// setup tiles and mouse hooks for hover highlight and popup inventory
// clicking
function createShelves() {
    storage.shelves.forEach(shelf => {
	let rect = new Konva.Rect({
	    x: shelf.x * tileSize,
	    y: shelf.y * tileSize,
	    width: tileSize,
	    height: tileSize,
	    fill: Color.DEFAULT,
	    stroke: Color.BORDER,
	    strokeWidth: 2
	});
	rect.on('mouseenter', (e) => {
	    e.target.fill(Color.HIGHLIGHT);
	    layer.batchDraw();
	});
	rect.on('mouseleave', (e) => {
	    e.target.fill(Color.DEFAULT);
	    layer.batchDraw();
	});
	rect.on('click', (e) => {
	    const x = Math.floor(e.target.x() / tileSize);
	    const y = Math.floor(e.target.y() / tileSize);
	    sendMessage('shelfinventory', { _id: storage._id, x: x, y: y });
	});
	layer.add(rect);
    });
}

// gets called when user clicked on a shelf tile, which fires off a
// request to the server which sends back the articles the shelf
// holds. Show an popup overlay while deactivating all other event
// handling while it is being displayed and closed with a mouse click
// within the canvas dimensions.
function showShelfInventory(shelf) {
    if (!shelf || !shelf.sub) {
	console.log("Can't show shelf inventory, not valid.", shelf);
	return;
    }
    layer.listening(false);
    stage.draggable(false);
    window.removeEventListener('wheel', handleMouseScroll);

    let invLabel = popupLayer.find('#invLabel');
    let txt = 'Shelf:\n\n';
    shelf.sub.forEach((obj) => {
	txt += '  ' + obj.article.name + ': ' + obj.count + '\n';
    });
    invLabel.text(txt);

    greyOverlayLayer.show();
    popupLayer.show();
    stage.draw();

    stage.on('click', () => {
	window.addEventListener('wheel', handleMouseScroll);
	stage.draggable(true);
	layer.listening(true);
	popupLayer.hide();
	greyOverlayLayer.hide();
	stage.draw();
	stage.off('click');
    });
}

// fancy looking arrows instead of simple rectangles for entrance
// representation.
function createEntrances() {
    storage.entrances.forEach(ent => {
	let x, y, points;
	if (ent.x === 0 || ent.x === cols - 1) {
	    x = ent.x * tileSize + (ent.x === 0 ? 0 : tileSize);
	    y = ent.y * tileSize + tileSize / 2;
	    points = [-tileSize*0.6, 0, tileSize*0.6, 0];
	}
	if (ent.y === 0 || ent.y === rows - 1) {
	    x = ent.x * tileSize + tileSize / 2;
	    y = ent.y * tileSize + (ent.y === 0 ? 0 : tileSize);
	    points = [0, -tileSize*0.6, 0, tileSize*0.6];
	}
	let arrow = new Konva.Arrow({
	    x: x,
	    y: y,
	    points: points,
	    pointerLength: 5,
	    pointerWidth: 5,
	    pointerAtBeginning: true,
	    fill: Color.BORDER,
	    stroke: Color.BORDER,
	    strokeWidth: 2
	});
	layer.add(arrow);
    });
}

// find the corresponing shelf that holds the provided article, used
// for highlighting shelf access.
function findShelf(article) {
    if (!article) {
	console.log('Article not valid, not searching.');
	return null;
    }
    for (shelf of storage.shelves) {
	for (sub of shelf.sub) {
	    if (sub.article.id === article.id) {
		return shelf;
	    }
	}
    }
    return null;
}

// temporarily highlight a shelf that was accessed by (for now)
// imaginary worker
function flashShelf(article) {
    let shelf = findShelf(article);
    if (!shelf) {
	console.log("Couldn't find that article in the storage", article);
	return;
    }
    let rect;
    layer.find('Rect').each((r) => {
	if (r.x() === shelf.x * tileSize && r.y() === shelf.y * tileSize) {
	    rect = r; // TODO: elegant way to short-circuit this?
		      // find('Rect') returns fake array.
	}
    });

    const durInSec = 0.5;
    rect.to({ duration: durInSec, fill: Color.ACCESS });
    setTimeout(() => {
	rect.to({ duration: durInSec, fill: Color.DEFAULT });
    }, durInSec * 1000);
}

// update the list beside the storage area whenever new updates from
// the server come in. TODO: should really be html+css instead of this
// inelegant horror show.
function updateOrderQueueLabel(orders) {
    let label = statusLayer.find('#ordLabel');
    let txt = 'Order queue:\n\n';
    orders.forEach((ord) => {
	txt += 'Order ' + ord.id + ':\n';
	ord.articles.forEach((art) => {
	    txt += '    - ' + art.name + '\n';
	});
	txt += '\n';
    });
    label.text(txt);
    statusLayer.batchDraw();
}

// TODO: close connection of tab refresh or close events socket events
// slightly different from the server's socket handling since this is
// provided by the web browser instead of the node wrapper for
// websockets. Promise for semi-blocking and waiting while connection
// is established in the background.
function connectToServer() {
    socket = new WebSocket('ws://localhost:8080');
    socket.onopen = () => {
	console.log('Connected to server');
    };
    socket.onmessage = (msg) => {
	handleServerMessage(msg);
    };
    return new Promise((resolve) => setTimeout(resolve, 500));
}

// if we can find a sessionID within the browser's html5 session
// storage, we use that. This way we can directly request the
// previously created and sent storage layout from
// create-storage.html.
function readFromSessionStorage(key) {
    let storage = window['sessionStorage'];
    if (!storage) {
	console.log('Session storage not available in your browser. Are your cookies disabled?');
	return;
    }
    if (!key) {
	console.log("Provided key not valid:", key);
	return;
    }
    return storage.getItem(key);
}

// only accepting server messages in the following object form:
// {
//     type: '...',
//     content: { ... }
// }
function handleServerMessage(msg) {
    let data, type, content;
    try {
	data = JSON.parse(msg.data);
	type = data.type;
	content = data.content;
    } catch (err) {
	console.log('Message parsing error: ' + err);
	console.log(msg);
	return;
    }
    if (type !== 'orderupdate') {
	console.log('Received:', type);
    }
    switch (type) {
    case 'id': // ignore for now, accept only in 'create-storage'
	break;
    case 'storage':
	storage = content;
	storageReceivedFromServer();
	break;
    case 'shelfinventory':
	showShelfInventory(content);
	break;
    case 'orderupdate':
	updateOrderQueueLabel(content.orders);
	if (content.removed) {
	    content.removed.articles.forEach((article) => {
		flashShelf(article);
	    });
	}
	break;
    default:
	console.log('Unknown type provided in server message:', type);
    }
}

function requestStorageLayoutFromServer(sessionID) {
    if (!socket || socket.readyState !== socket.OPEN) {
	console.log('Server connection not established, try refreshing the page');
	return;
    }
    sendMessage('reqlayout', { _id: sessionID });
}

// stringify because that's what the websockets expect, other options
// would be sending array or binary blob data.
function sendMessage(type, data) {
    try {
	socket.send(JSON.stringify({ type: type, content: data }));
    } catch (err) {
	console.log('Could not send message to server: ' + err);
    }
    console.log('Sent:', type);
}
